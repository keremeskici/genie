import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const MOCK_TRANSACTIONS = [
  {
    id: 'tx-1',
    senderUserId: 'user-123',
    recipientWallet: '0xabc123',
    amountUsd: '10.00',
    txHash: '0xhash1',
    status: 'confirmed',
    category: 'transfers',
    source: 'genie_send',
    createdAt: new Date('2026-04-05T00:00:00Z'),
    expiresAt: null,
  },
];

const mockOrderBy = vi.fn().mockResolvedValue(MOCK_TRANSACTIONS);
const mockLimit = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy, limit: mockLimit }));

vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: mockWhere,
        }),
      }),
    },
    transactions: {},
    eq: actual.eq,
    desc: actual.desc,
  };
});

const { transactionsRoute } = await import('./transactions');

const app = new Hono();
app.route('/', transactionsRoute);

beforeEach(() => {
  vi.clearAllMocks();
  mockOrderBy.mockResolvedValue(MOCK_TRANSACTIONS);
  mockLimit.mockImplementation(() => ({ orderBy: mockOrderBy }));
  mockWhere.mockImplementation(() => ({ orderBy: mockOrderBy, limit: mockLimit }));
});

describe('GET /transactions', () => {
  it('Test 1: returns 200 with transactions array for valid userId', async () => {
    const req = new Request('http://localhost/?userId=user-123');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { transactions: typeof MOCK_TRANSACTIONS };
    expect(Array.isArray(json.transactions)).toBe(true);
    expect(json.transactions).toHaveLength(1);
    expect(json.transactions[0].id).toBe('tx-1');
    expect(json.transactions[0].amountUsd).toBe('10.00');
  });

  it('Test 2: returns 400 MISSING_USER_ID when userId is not provided', async () => {
    const req = new Request('http://localhost/');
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('MISSING_USER_ID');
  });

  it('Test 3: returns 500 FETCH_FAILED when DB throws', async () => {
    mockWhere.mockImplementationOnce(() => ({
      orderBy: vi.fn().mockRejectedValue(new Error('DB connection error')),
      limit: vi.fn(() => ({
        orderBy: vi.fn().mockRejectedValue(new Error('DB connection error')),
      })),
    }));
    const req = new Request('http://localhost/?userId=user-123');
    const res = await app.fetch(req);
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('FETCH_FAILED');
  });
});
