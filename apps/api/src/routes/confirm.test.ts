import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
const mockDbSelectReturn = vi.fn();
const mockDbUpdateSet = vi.fn();
const mockDbUpdateWhere = vi.fn();

// We need to track multiple select calls (one for tx, one for user)
let selectCallCount = 0;
const mockSelectResults: unknown[][] = [];

vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => {
              const result = mockSelectResults[selectCallCount] ?? [];
              selectCallCount++;
              return Promise.resolve(result);
            },
          }),
        }),
      }),
      update: () => ({
        set: (values: unknown) => {
          mockDbUpdateSet(values);
          return {
            where: (cond: unknown) => {
              mockDbUpdateWhere(cond);
              return Promise.resolve();
            },
          };
        },
      }),
    },
    transactions: {},
    users: {},
    eq: actual.eq,
    and: actual.and,
  };
});

// Mock executeOnChainTransfer
const mockExecuteTransfer = vi.fn();
vi.mock('../chain/transfer', () => ({
  executeOnChainTransfer: (...args: unknown[]) => mockExecuteTransfer(...args),
}));

// Import after mocks
const { confirmRoute } = await import('./confirm');

const app = new Hono();
app.route('/confirm', confirmRoute);

const validPendingTx = {
  id: 'tx-uuid-001',
  senderUserId: 'user-uuid-001',
  recipientWallet: '0xRecipient000000000000000000000000000001',
  amountUsd: '50.00',
  txHash: null,
  status: 'pending',
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min from now
  createdAt: new Date(),
};

const validUser = {
  id: 'user-uuid-001',
  walletAddress: '0xSender0000000000000000000000000000000001',
  worldId: '0xnull',
  displayName: 'Test User',
  autoApproveUsd: '25',
  createdAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  selectCallCount = 0;
  mockSelectResults.length = 0;
  mockDbUpdateSet.mockReturnValue(undefined);
  mockDbUpdateWhere.mockReturnValue(undefined);
});

describe('POST /confirm', () => {
  it('Test 1: returns 400 when txId is missing', async () => {
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('txId');
  });

  it('Test 2: returns 400 when userId is missing', async () => {
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('userId');
  });

  it('Test 3: returns 404 when transaction not found', async () => {
    mockSelectResults[0] = []; // No transaction found
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('Transaction not found');
  });

  it('Test 4: returns 410 when transaction status is expired', async () => {
    mockSelectResults[0] = [{ ...validPendingTx, status: 'expired' }];
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(410);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('expired');
  });

  it('Test 5: returns 409 when transaction is already confirmed', async () => {
    mockSelectResults[0] = [{ ...validPendingTx, status: 'confirmed', txHash: '0xexistinghash' }];
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(409);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('already confirmed');
  });

  it('Test 6: returns 410 when transaction expiresAt is in the past', async () => {
    mockSelectResults[0] = [{
      ...validPendingTx,
      status: 'pending',
      expiresAt: new Date(Date.now() - 1000), // 1 second in the past
    }];
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(410);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('expired');
    // Should update DB to mark as expired
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ status: 'expired' });
  });

  it('Test 7: returns 200 with txHash on successful pending transaction', async () => {
    mockSelectResults[0] = [validPendingTx]; // tx found
    mockSelectResults[1] = [validUser];       // user found
    mockExecuteTransfer.mockResolvedValue({
      routeTxHash: '0xrouteHash',
      executeTxHash: '0xexecuteHash',
    });
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean; txHash: string };
    expect(json.success).toBe(true);
    expect(json.txHash).toBe('0xexecuteHash');
    expect(mockExecuteTransfer).toHaveBeenCalledWith(
      validUser.walletAddress,
      validPendingTx.recipientWallet,
      50.0,
    );
    expect(mockDbUpdateSet).toHaveBeenCalledWith({
      status: 'confirmed',
      txHash: '0xexecuteHash',
      executedAt: expect.any(Date),
    });
  });

  it('Test 8: returns 500 and marks tx as failed when executeOnChainTransfer throws', async () => {
    mockSelectResults[0] = [validPendingTx]; // tx found
    mockSelectResults[1] = [validUser];       // user found
    mockExecuteTransfer.mockRejectedValue(new Error('Chain error'));
    const req = new Request('http://localhost/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: 'tx-uuid-001', userId: 'user-uuid-001' }),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(500);
    const json = await res.json() as { error: string; message: string };
    expect(json.error).toBe('TRANSFER_FAILED');
    expect(mockDbUpdateSet).toHaveBeenCalledWith({ status: 'failed' });
  });
});
