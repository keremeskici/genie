import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @genie/db
// db.insert(table).values(data).returning() -> Promise<Debt[]>
const mockReturning = vi.fn();
const mockValues = vi.fn(() => ({ returning: mockReturning }));
vi.mock('@genie/db', () => ({
  db: {
    insert: vi.fn(() => ({ values: mockValues })),
  },
  debts: {},
}));

import { createCreateDebtTool } from './create-debt';
import { db } from '@genie/db';

const BASE_USER_ID = 'user-debt-test-123';
const VERIFIED_CONTEXT = {
  walletAddress: '0xOwner000000000000000000000000000000000001',
  displayName: 'Alice',
  autoApproveUsd: 25,
  isVerified: true,
  isHumanBacked: true,
};
const COUNTERPARTY = '0xBob0000000000000000000000000000000000001';

describe('createCreateDebtTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default insert chain: returns a debt record
    mockReturning.mockResolvedValue([{
      id: 'debt-id-001',
      ownerUserId: BASE_USER_ID,
      counterpartyWallet: COUNTERPARTY,
      amountUsd: '30.00',
      description: 'dinner last Friday',
      settled: false,
      iOwe: false,
      createdAt: new Date('2026-04-04T12:00:00Z'),
    }]);
    mockValues.mockReturnValue({ returning: mockReturning });
  });

  it('creates debt with iOwe=false (they owe me) and returns debt_created', async () => {
    const tool = createCreateDebtTool(BASE_USER_ID, VERIFIED_CONTEXT);
    const result = await tool.execute(
      { counterpartyWallet: COUNTERPARTY, amountUsd: 30, iOwe: false, description: 'dinner last Friday' },
      { messages: [], toolCallId: 'test' },
    );
    expect(db.insert).toHaveBeenCalledWith(expect.anything());
    expect(result).toMatchObject({
      type: 'debt_created',
      id: 'debt-id-001',
      counterpartyWallet: COUNTERPARTY,
      amountUsd: 30,
      direction: 'they owe me',
      description: 'dinner last Friday',
    });
  });

  it('creates debt with iOwe=true (I owe them) and returns correct direction', async () => {
    mockReturning.mockResolvedValue([{
      id: 'debt-id-002',
      ownerUserId: BASE_USER_ID,
      counterpartyWallet: COUNTERPARTY,
      amountUsd: '50.00',
      description: 'rent contribution',
      settled: false,
      iOwe: true,
      createdAt: new Date('2026-04-04T12:00:00Z'),
    }]);
    const tool = createCreateDebtTool(BASE_USER_ID, VERIFIED_CONTEXT);
    const result = await tool.execute(
      { counterpartyWallet: COUNTERPARTY, amountUsd: 50, iOwe: true, description: 'rent contribution' },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({
      type: 'debt_created',
      direction: 'I owe them',
    });
  });

  it('handles optional description — defaults to null when not provided', async () => {
    mockReturning.mockResolvedValue([{
      id: 'debt-id-003',
      ownerUserId: BASE_USER_ID,
      counterpartyWallet: COUNTERPARTY,
      amountUsd: '20.00',
      description: null,
      settled: false,
      iOwe: false,
      createdAt: new Date('2026-04-04T12:00:00Z'),
    }]);
    const tool = createCreateDebtTool(BASE_USER_ID, VERIFIED_CONTEXT);
    const result = await tool.execute(
      { counterpartyWallet: COUNTERPARTY, amountUsd: 20, iOwe: false },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({
      type: 'debt_created',
      description: null,
    });
  });

  it('returns DEBT_CREATION_FAILED on DB error', async () => {
    mockReturning.mockRejectedValue(new Error('DB connection refused'));
    const tool = createCreateDebtTool(BASE_USER_ID, VERIFIED_CONTEXT);
    const result = await tool.execute(
      { counterpartyWallet: COUNTERPARTY, amountUsd: 30, iOwe: false },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({
      error: 'DEBT_CREATION_FAILED',
      message: expect.stringContaining('DB connection refused'),
    });
  });
});
