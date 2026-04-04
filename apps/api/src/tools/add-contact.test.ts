import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @genie/db before any imports that use it
vi.mock('@genie/db', () => ({
  db: {
    insert: vi.fn(),
  },
  contacts: {},
}));

import { createAddContactTool } from './add-contact';
import { db } from '@genie/db';

const mockDbInsert = db.insert as ReturnType<typeof vi.fn>;

// Helper to set up a DB insert chain that returns given rows
function mockDbInsertReturning(rows: object[]) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  });
}

// Helper to set up a DB insert chain that throws
function mockDbInsertThrows(error: Error) {
  mockDbInsert.mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockRejectedValue(error),
    }),
  });
}

const USER_ID = 'user-abc';
const VALID_ADDRESS = '0x1234567890123456789012345678901234567890';

describe('createAddContactTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success with contact data when name and valid 0x address are provided', async () => {
    mockDbInsertReturning([
      { displayName: 'Alice', walletAddress: VALID_ADDRESS },
    ]);

    const tool = createAddContactTool(USER_ID);
    const result = await tool.execute(
      { name: 'Alice', walletAddress: VALID_ADDRESS },
      { messages: [], toolCallId: 'test' },
    );

    expect(result).toEqual({
      success: true,
      contact: { name: 'Alice', walletAddress: VALID_ADDRESS },
    });
  });

  it('returns error when wallet address is missing 0x prefix', async () => {
    const tool = createAddContactTool(USER_ID);
    const result = await tool.execute(
      { name: 'Bob', walletAddress: '1234567890123456789012345678901234567890' },
      { messages: [], toolCallId: 'test' },
    );

    expect(result).toEqual({
      success: false,
      error: 'Invalid wallet address format',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns error when wallet address has 0x prefix but wrong length', async () => {
    const tool = createAddContactTool(USER_ID);
    // 0x + 38 hex chars = 40 total (not 42)
    const result = await tool.execute(
      { name: 'Carol', walletAddress: '0x12345678901234567890123456789012345678' },
      { messages: [], toolCallId: 'test' },
    );

    expect(result).toEqual({
      success: false,
      error: 'Invalid wallet address format',
    });
    expect(db.insert).not.toHaveBeenCalled();
  });

  it('returns failure gracefully when DB insert throws', async () => {
    mockDbInsertThrows(new Error('DB connection lost'));

    const tool = createAddContactTool(USER_ID);
    const result = await tool.execute(
      { name: 'Dave', walletAddress: VALID_ADDRESS },
      { messages: [], toolCallId: 'test' },
    );

    expect(result).toEqual({
      success: false,
      error: 'Failed to save contact',
    });
  });
});
