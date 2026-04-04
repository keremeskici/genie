import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @genie/db before any imports that use it
vi.mock('@genie/db', () => ({
  db: {
    select: vi.fn(),
  },
  contacts: {},
  eq: vi.fn(),
}));

import { createListContactsTool } from './list-contacts';
import { db } from '@genie/db';

const mockDbSelect = db.select as ReturnType<typeof vi.fn>;

// Helper to set up a DB select chain that returns given rows
function mockDbReturning(rows: object[]) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

// Helper to set up a DB select chain that throws
function mockDbSelectThrows(error: Error) {
  mockDbSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockRejectedValue(error),
    }),
  });
}

const USER_ID = 'user-xyz';

describe('createListContactsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns mapped contacts for the user when contacts exist', async () => {
    mockDbReturning([
      { displayName: 'Alice', walletAddress: '0xAlice000000000000000000000000000000001A' },
      { displayName: 'Bob', walletAddress: '0xBob0000000000000000000000000000000000001' },
    ]);

    const tool = createListContactsTool(USER_ID);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });

    expect(result).toEqual({
      contacts: [
        { name: 'Alice', walletAddress: '0xAlice000000000000000000000000000000001A' },
        { name: 'Bob', walletAddress: '0xBob0000000000000000000000000000000000001' },
      ],
      count: 2,
    });
  });

  it('returns empty contacts array and count 0 when user has no contacts', async () => {
    mockDbReturning([]);

    const tool = createListContactsTool(USER_ID);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });

    expect(result).toEqual({ contacts: [], count: 0 });
  });

  it('returns empty contacts array with error message when DB select throws', async () => {
    mockDbSelectThrows(new Error('DB unavailable'));

    const tool = createListContactsTool(USER_ID);
    const result = await tool.execute({}, { messages: [], toolCallId: 'test' });

    expect(result).toEqual({
      contacts: [],
      count: 0,
      error: 'Failed to load contacts',
    });
  });
});
