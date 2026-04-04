import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock chain/transfer module
vi.mock('../chain/transfer', () => ({
  executeOnChainTransfer: vi.fn(),
}));

// Mock @genie/db
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@genie/db', () => ({
  db: {
    insert: vi.fn(() => mockInsert),
    update: vi.fn(() => mockUpdate),
  },
  transactions: {},
  eq: vi.fn(),
  and: vi.fn(),
}));

// Mock categorize module
vi.mock('./categorize', () => ({
  inferCategory: vi.fn((desc: string | null | undefined) => {
    if (!desc) return 'transfers';
    if (desc.toLowerCase().includes('dinner')) return 'food';
    return 'transfers';
  }),
}));

// Mock require-verified
vi.mock('./require-verified', () => ({
  requireVerified: vi.fn(),
}));

import { createSendUsdcTool } from './send-usdc';
import { executeOnChainTransfer } from '../chain/transfer';
import { db } from '@genie/db';
import { requireVerified } from './require-verified';
import { inferCategory } from './categorize';

const mockExecuteOnChainTransfer = executeOnChainTransfer as ReturnType<typeof vi.fn>;
const mockRequireVerified = requireVerified as ReturnType<typeof vi.fn>;

const BASE_USER_ID = 'user-abc-123';
const BASE_USER_CONTEXT = {
  walletAddress: '0xSender00000000000000000000000000000000001',
  displayName: 'Alice',
  autoApproveUsd: 25,
  isVerified: true,
  isHumanBacked: true,
};
const RECIPIENT = '0xRecipient0000000000000000000000000000001';

describe('createSendUsdcTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: pass verification
    mockRequireVerified.mockReturnValue(null);
    // Default DB insert chain
    mockInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'tx-pending-id-1' }]),
      }),
    });
    // Default DB insert (confirmed — no returning needed)
    const insertValues = vi.fn().mockResolvedValue([]);
    mockInsert.mockReturnValue({
      values: insertValues,
      // Also support chained .returning()
    });
    // Default DB update chain
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    // Default transfer success
    mockExecuteOnChainTransfer.mockResolvedValue({
      routeTxHash: '0xroute111',
      executeTxHash: '0xexec222',
    });
  });

  it('returns VERIFICATION_REQUIRED error when userContext.isVerified is false', async () => {
    mockRequireVerified.mockReturnValue({
      error: 'VERIFICATION_REQUIRED',
      message: 'This action requires World ID verification. Please verify to continue.',
    });
    const tool = createSendUsdcTool(BASE_USER_ID, { ...BASE_USER_CONTEXT, isVerified: false });
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({ error: 'VERIFICATION_REQUIRED' });
    expect(mockExecuteOnChainTransfer).not.toHaveBeenCalled();
  });

  it('calls executeOnChainTransfer and records confirmed transaction when amountUsd <= autoApproveUsd', async () => {
    const insertValues = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 }, // 10 <= 25
      { messages: [], toolCallId: 'test' },
    );

    expect(mockExecuteOnChainTransfer).toHaveBeenCalledWith(
      BASE_USER_CONTEXT.walletAddress,
      RECIPIENT,
      10,
    );
    expect(result).toMatchObject({
      type: 'transfer_complete',
      txHash: '0xexec222',
      routeTxHash: '0xroute111',
      amount: 10,
      recipient: RECIPIENT,
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'confirmed' }),
    );
  });

  it('creates pending transaction and returns confirmation_required when amountUsd > autoApproveUsd', async () => {
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSet });
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'pending-tx-999' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 100 }, // 100 > 25
      { messages: [], toolCallId: 'test' },
    );

    expect(mockExecuteOnChainTransfer).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      type: 'confirmation_required',
      txId: 'pending-tx-999',
      amount: 100,
      recipient: RECIPIENT,
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('cancels existing pending transactions before creating a new one', async () => {
    const whereUpdate = vi.fn().mockResolvedValue([]);
    const setUpdate = vi.fn().mockReturnValue({ where: whereUpdate });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: setUpdate });
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'new-pending' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 100 },
      { messages: [], toolCallId: 'test' },
    );

    // db.update should be called to expire existing pending transactions
    expect(db.update).toHaveBeenCalled();
    expect(setUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }));
  });

  it('returns TRANSFER_FAILED error when on-chain transfer throws', async () => {
    mockExecuteOnChainTransfer.mockRejectedValue(new Error('Blockchain rejected tx'));
    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    const result = await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 },
      { messages: [], toolCallId: 'test' },
    );
    expect(result).toMatchObject({
      error: 'TRANSFER_FAILED',
      message: expect.stringContaining('Blockchain rejected tx'),
    });
  });

  it('stores category "food" when description is "dinner" on confirmed transaction', async () => {
    const insertValues = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10, description: 'dinner' },
      { messages: [], toolCallId: 'test' },
    );

    expect(inferCategory).toHaveBeenCalledWith('dinner');
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'food', source: 'genie_send' }),
    );
  });

  it('stores category "transfers" when no description provided on confirmed transaction', async () => {
    const insertValues = vi.fn().mockResolvedValue([]);
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 10 },
      { messages: [], toolCallId: 'test' },
    );

    expect(inferCategory).toHaveBeenCalledWith(undefined);
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'transfers', source: 'genie_send' }),
    );
  });

  it('stores category and source on pending transaction too', async () => {
    const updateSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
    (db.update as ReturnType<typeof vi.fn>).mockReturnValue({ set: updateSet });
    const insertReturning = vi.fn().mockResolvedValue([{ id: 'pending-cat-test' }]);
    const insertValues = vi.fn().mockReturnValue({ returning: insertReturning });
    (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({ values: insertValues });

    const tool = createSendUsdcTool(BASE_USER_ID, BASE_USER_CONTEXT);
    await tool.execute(
      { recipientAddress: RECIPIENT, amountUsd: 100, description: 'dinner' }, // 100 > 25 → pending
      { messages: [], toolCallId: 'test' },
    );

    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'food', source: 'genie_send', status: 'pending' }),
    );
  });
});
