import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_MEMORY,
  encodeKvKey,
  encodeKvValue,
  decodeKvValue,
  type AgentMemory,
} from './types';

// Top-level mock — hoisted before all tests, stable across the file
const mockGetValue = vi.fn();
const mockExec = vi.fn();
const mockSetKey = vi.fn();

vi.mock('./client', () => ({
  createKvReader: vi.fn(() => ({
    getValue: mockGetValue,
  })),
  createKvWriter: vi.fn(async () => ({
    streamId: '0xtest-stream-id',
    batcher: {
      streamDataBuilder: { set: mockSetKey },
      exec: mockExec,
    },
  })),
}));

// Import after mocks are in place
import { readMemory, writeMemory } from './memory';
import { createKvReader, createKvWriter } from './client';

describe('DEFAULT_MEMORY', () => {
  it('has empty financialProfile object', () => {
    expect(DEFAULT_MEMORY.financialProfile).toEqual({});
  });

  it('has empty preferences object', () => {
    expect(DEFAULT_MEMORY.preferences).toEqual({});
  });

  it('has empty activeGoals array', () => {
    expect(DEFAULT_MEMORY.activeGoals).toEqual([]);
  });

  it('has updatedAt as ISO string', () => {
    expect(DEFAULT_MEMORY.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/
    );
  });
});

describe('encodeKvKey', () => {
  it('returns a Uint8Array of the UTF-8 bytes', () => {
    const key = 'user:abc:memory';
    const result = encodeKvKey(key);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Buffer.from(result).toString('utf-8')).toBe(key);
  });
});

describe('readMemory graceful fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when createKvReader returns null (KV client unavailable)', async () => {
    vi.mocked(createKvReader).mockReturnValueOnce(null);
    const result = await readMemory('user-abc');
    expect(result).toBeNull();
  });

  it('returns null when KvClient.getValue throws (network error)', async () => {
    // createKvReader returns a client whose getValue throws
    vi.mocked(createKvReader).mockReturnValueOnce({
      getValue: vi.fn(async () => { throw new Error('network error'); }),
    } as any);
    const result = await readMemory('user-xyz');
    expect(result).toBeNull();
  });

  it('returns null when KvClient.getValue returns null (key not found)', async () => {
    mockGetValue.mockResolvedValueOnce(null);
    const result = await readMemory('user-no-key');
    expect(result).toBeNull();
  });
});

describe('writeMemory graceful fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when createKvWriter returns null (OG_PRIVATE_KEY missing)', async () => {
    vi.mocked(createKvWriter).mockResolvedValueOnce(null);
    const result = await writeMemory('user-abc', { ...DEFAULT_MEMORY });
    expect(result).toBe(false);
  });

  it('returns false when batcher.exec returns an error tuple', async () => {
    mockExec.mockResolvedValueOnce([null, new Error('exec failed')]);
    const result = await writeMemory('user-abc', { ...DEFAULT_MEMORY });
    expect(result).toBe(false);
  });

  it('returns true when batcher.exec succeeds', async () => {
    mockExec.mockResolvedValueOnce(['0xtxhash', null]);
    const result = await writeMemory('user-abc', { ...DEFAULT_MEMORY });
    expect(result).toBe(true);
  });
});

describe('encodeKvValue / decodeKvValue', () => {
  it('round-trips AgentMemory correctly', () => {
    const memory: AgentMemory = {
      financialProfile: {
        monthlyIncome: 5000,
        spendingCategories: ['food', 'rent'],
        riskTolerance: 'moderate',
      },
      preferences: {
        confirmationStyle: 'threshold',
        reminderFrequency: 'weekly',
      },
      activeGoals: [
        {
          id: 'goal-1',
          type: 'savings',
          description: 'Emergency fund',
          targetAmount: 10000,
          currentAmount: 1500,
          createdAt: '2026-04-04T00:00:00.000Z',
        },
      ],
      updatedAt: '2026-04-04T00:00:00.000Z',
    };

    const encoded = encodeKvValue(memory);
    const decoded = decodeKvValue(encoded);
    expect(decoded).toEqual(memory);
  });

  it('returns null for null input', () => {
    expect(decodeKvValue(null)).toBeNull();
  });

  it('returns null for empty string input', () => {
    expect(decodeKvValue('')).toBeNull();
  });
});
