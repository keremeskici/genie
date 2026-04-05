import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @genie/db
// db.select() returns { from() -> { where() -> Promise<Debt[]> } }
const mockWhere = vi.fn();
const mockFrom = vi.fn(() => ({ where: mockWhere }));
vi.mock('@genie/db', () => ({
  db: {
    select: vi.fn(() => ({ from: mockFrom })),
  },
  debts: {},
  eq: vi.fn(),
  and: vi.fn(),
}));

import { createListDebtsTool } from './list-debts';
import { db } from '@genie/db';

const BASE_USER_ID = 'user-list-debts-test-123';

const OPEN_DEBTS = [
  {
    id: 'debt-id-001',
    ownerUserId: BASE_USER_ID,
    counterpartyWallet: '0xBob0000000000000000000000000000000000001',
    amountUsd: '30.00',
    description: 'dinner last Friday',
    settled: false,
    iOwe: false,
    createdAt: new Date('2026-04-04T10:00:00Z'),
  },
  {
    id: 'debt-id-002',
    ownerUserId: BASE_USER_ID,
    counterpartyWallet: '0xCarol00000000000000000000000000000000001',
    amountUsd: '50.00',
    description: 'rent',
    settled: false,
    iOwe: true,
    createdAt: new Date('2026-04-03T08:00:00Z'),
  },
];

describe('createListDebtsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return open debts
    mockWhere.mockResolvedValue(OPEN_DEBTS);
    mockFrom.mockReturnValue({ where: mockWhere });
  });

  it('returns open debts with correct shape including direction', async () => {
    const tool = createListDebtsTool(BASE_USER_ID);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' }) as {
      type: string;
      debts: Array<{
        id: string;
        counterpartyWallet: string;
        amountUsd: string;
        direction: string;
        description: string | null;
        createdAt: string;
      }>;
      count: number;
    };
    expect(result.type).toBe('debts_list');
    expect(result.count).toBe(2);
    expect(result.debts[0]).toMatchObject({
      id: 'debt-id-001',
      counterpartyWallet: '0xBob0000000000000000000000000000000000001',
      amountUsd: '30.00',
      direction: 'they owe me',
      description: 'dinner last Friday',
    });
    expect(result.debts[1]).toMatchObject({
      id: 'debt-id-002',
      direction: 'I owe them',
    });
  });

  it('returns empty debts list when no open debts exist', async () => {
    mockWhere.mockResolvedValue([]);
    const tool = createListDebtsTool(BASE_USER_ID);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      type: 'debts_list',
      debts: [],
      count: 0,
    });
  });

  it('returns DEBT_LIST_FAILED on DB error', async () => {
    mockWhere.mockRejectedValue(new Error('DB timeout'));
    const tool = createListDebtsTool(BASE_USER_ID);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });
    expect(result).toMatchObject({
      error: 'DEBT_LIST_FAILED',
      message: expect.stringContaining('DB timeout'),
    });
  });
});
