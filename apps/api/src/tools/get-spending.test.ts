import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @genie/db
// db.select({ category: sql`...`, total: sql`...` }).from(table).where(conditions).groupBy(expr) -> Promise<Row[]>
const mockGroupBy = vi.fn();
const mockWhere = vi.fn(() => ({ groupBy: mockGroupBy }));
const mockFrom = vi.fn(() => ({ where: mockWhere }));
vi.mock('@genie/db', () => ({
  db: {
    select: vi.fn(() => ({ from: mockFrom })),
  },
  transactions: {
    senderUserId: 'sender_user_id',
    status: 'status',
    category: 'category',
    amountUsd: 'amount_usd',
    createdAt: 'created_at',
  },
  eq: vi.fn((col, val) => ({ col, val, op: 'eq' })),
  and: vi.fn((...args) => ({ op: 'and', args })),
  gte: vi.fn((col, val) => ({ col, val, op: 'gte' })),
  lte: vi.fn((col, val) => ({ col, val, op: 'lte' })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join('?'),
      values,
    })),
    { raw: vi.fn() }
  ),
}));

import { createGetSpendingTool } from './get-spending';
import { db } from '@genie/db';

const BASE_USER_ID = 'user-spending-test-123';
const START = '2026-03-28T00:00:00Z';
const END = '2026-04-04T23:59:59Z';

describe('createGetSpendingTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return two category rows
    mockGroupBy.mockResolvedValue([
      { category: 'food', total: '45.00' },
      { category: 'transport', total: '20.00' },
    ]);
    mockWhere.mockReturnValue({ groupBy: mockGroupBy });
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it('returns aggregated spending per category for a date range', async () => {
    const tool = createGetSpendingTool(BASE_USER_ID);
    const result = await tool.execute(
      { startDate: START, endDate: END },
      { messages: [], toolCallId: 'test' },
    ) as {
      type: string;
      categories: Array<{ category: string; total: string }>;
      total: string;
      startDate: string;
      endDate: string;
    };
    expect(result.type).toBe('spending_summary');
    expect(result.categories).toHaveLength(2);
    expect(result.categories).toContainEqual({ category: 'food', total: '45.00' });
    expect(result.categories).toContainEqual({ category: 'transport', total: '20.00' });
    expect(result.total).toBe('65.00');
    expect(result.startDate).toBe(START);
    expect(result.endDate).toBe(END);
  });

  it('returns empty categories and total 0.00 when no transactions in range', async () => {
    mockGroupBy.mockResolvedValue([]);
    const tool = createGetSpendingTool(BASE_USER_ID);
    const result = await tool.execute(
      { startDate: START, endDate: END },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({
      type: 'spending_summary',
      categories: [],
      total: '0.00',
    });
  });

  it('applies optional category filter and still returns correct shape', async () => {
    mockGroupBy.mockResolvedValue([{ category: 'food', total: '45.00' }]);
    const tool = createGetSpendingTool(BASE_USER_ID);
    const result = await tool.execute(
      { startDate: START, endDate: END, category: 'food' },
      { messages: [], toolCallId: 'test' },
    ) as { type: string; categories: Array<{ category: string; total: string }>; total: string };
    expect(result.type).toBe('spending_summary');
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].category).toBe('food');
    expect(result.total).toBe('45.00');
  });

  it('returns SPENDING_QUERY_FAILED on DB error', async () => {
    mockGroupBy.mockRejectedValue(new Error('Query timeout'));
    const tool = createGetSpendingTool(BASE_USER_ID);
    const result = await tool.execute(
      { startDate: START, endDate: END },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({
      error: 'SPENDING_QUERY_FAILED',
      message: expect.stringContaining('Query timeout'),
    });
  });

  it('uses db.select and queries from transactions table with groupBy', async () => {
    const tool = createGetSpendingTool(BASE_USER_ID);
    await tool.execute(
      { startDate: START, endDate: END },
      { messages: [], toolCallId: 'test' },
    );
    expect(db.select).toHaveBeenCalledOnce();
    expect(mockFrom).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalledOnce();
    expect(mockGroupBy).toHaveBeenCalledOnce();
  });
});
