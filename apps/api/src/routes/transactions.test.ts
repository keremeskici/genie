import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

const MOCK_USER = { walletAddress: '0xwallet123' };

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
    executedAt: new Date('2026-04-05T00:01:00Z'),
    expiresAt: null,
  },
  {
    id: 'tx-2',
    senderUserId: 'user-456',
    recipientWallet: '0xwallet123',
    amountUsd: '5.00',
    txHash: '0xhash2',
    status: 'confirmed',
    category: 'transfers',
    source: 'genie_send',
    createdAt: new Date('2026-04-05T01:00:00Z'),
    executedAt: new Date('2026-04-05T01:01:00Z'),
    expiresAt: null,
  },
];

const mockLimit = vi.fn().mockResolvedValue(MOCK_TRANSACTIONS);
const mockOrderBy = vi.fn(() => ({ limit: mockLimit }));
const mockWhere = vi.fn(() => ({ orderBy: mockOrderBy }));
const mockUserWhere = vi.fn().mockResolvedValue([MOCK_USER]);

vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: (fields?: Record<string, unknown>) => ({
        from: (table: unknown) => {
          // User lookup returns mockUserWhere, transactions returns mockWhere chain
          if (fields && 'walletAddress' in fields) {
            return { where: mockUserWhere };
          }
          return { where: mockWhere };
        },
      }),
    },
    transactions: {},
    users: {},
    eq: actual.eq,
    or: actual.or,
    desc: actual.desc,
  };
});

const { transactionsRoute } = await import('./transactions');

const app = new Hono();
app.route('/', transactionsRoute);

beforeEach(() => {
  vi.clearAllMocks();
  mockLimit.mockResolvedValue(MOCK_TRANSACTIONS);
  mockOrderBy.mockImplementation(() => ({ limit: mockLimit }));
  mockWhere.mockImplementation(() => ({ orderBy: mockOrderBy }));
  mockUserWhere.mockResolvedValue([MOCK_USER]);
});

describe('GET /transactions', () => {
  it('returns 200 with transactions including direction', async () => {
    const req = new Request('http://localhost/?userId=user-123');
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { transactions: Array<{ id: string; direction: string; executedAt: string | null }> };
    expect(Array.isArray(json.transactions)).toBe(true);
    expect(json.transactions).toHaveLength(2);
    // tx-2 (received, 01:00) sorts before tx-1 (sent, 00:00) by createdAt desc
    expect(json.transactions[0].direction).toBe('received');
    expect(json.transactions[1].direction).toBe('sent');
    expect(json.transactions[0].executedAt).toBeTruthy();
  });

  it('returns 400 MISSING_USER_ID when userId is not provided', async () => {
    const req = new Request('http://localhost/');
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('MISSING_USER_ID');
  });

  it('returns 500 FETCH_FAILED when DB throws', async () => {
    mockUserWhere.mockResolvedValueOnce([MOCK_USER]);
    mockWhere.mockImplementationOnce(() => ({
      orderBy: vi.fn(() => ({
        limit: vi.fn().mockRejectedValue(new Error('DB connection error')),
      })),
    }));
    const req = new Request('http://localhost/?userId=user-123');
    const res = await app.fetch(req);
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('FETCH_FAILED');
  });
});
