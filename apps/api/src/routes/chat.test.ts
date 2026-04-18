import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// --- Mocks (must be at top level for hoisting) ---

const mockDbSelect = vi.fn();
vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => mockDbSelect(),
          }),
        }),
      }),
    },
    users: {},
    eq: vi.fn(),
  };
});

const mockReadMemory = vi.fn().mockResolvedValue(null);
vi.mock('../kv', () => ({
  readMemory: (...args: unknown[]) => mockReadMemory(...args),
}));

const mockRunAgent = vi.fn().mockReturnValue({
  toTextStreamResponse: () => new Response('ok'),
});
vi.mock('../agent/index', () => ({
  runAgent: (...args: unknown[]) => mockRunAgent(...args),
}));

const mockCheckAndSettleDebts = vi.fn().mockResolvedValue([]);
vi.mock('../agent/settlement', () => ({
  checkAndSettleDebts: (...args: unknown[]) => mockCheckAndSettleDebts(...args),
}));

// Import after mocks
const { chatRoute, invalidateContextCache } = await import('./chat');

const app = new Hono();
app.route('/', chatRoute);

const USER_ID = '00000000-0000-0000-0000-000000000001';
const STUB_USER = {
  id: USER_ID,
  walletAddress: '0xABC',
  displayName: 'Alice',
  autoApproveUsd: '50',
  worldId: null,
  createdAt: new Date(),
};

async function postChat(body: object) {
  return app.fetch(
    new Request('http://localhost/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to default successful DB result
  mockDbSelect.mockResolvedValue([STUB_USER]);
  mockReadMemory.mockResolvedValue(null);
  mockRunAgent.mockReturnValue({ toTextStreamResponse: () => new Response('ok') });
  mockCheckAndSettleDebts.mockResolvedValue([]);
  // Clear the context cache before each test so tests are independent
  invalidateContextCache(USER_ID);
});

describe('POST /chat — input validation', () => {
  it('returns 400 when messages array is missing', async () => {
    const res = await postChat({ userId: USER_ID });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('messages');
  });

  it('returns 400 when messages array is empty', async () => {
    const res = await postChat({ messages: [], userId: USER_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when messages contain no text content', async () => {
    const res = await postChat({
      messages: [{ id: 'm1', role: 'user', parts: [{ type: 'step-start' }] }],
      userId: USER_ID,
    });

    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toContain('text message');
  });
});

describe('POST /chat — message normalization', () => {
  it('passes legacy model messages through to runAgent', async () => {
    await postChat({ messages: [{ role: 'user', content: 'hello' }], userId: USER_ID });

    const callArgs = mockRunAgent.mock.calls[0][0];
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'hello' }]);
  });

  it('converts AI SDK UI message parts to model message content', async () => {
    await postChat({
      messages: [
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
      ],
      userId: USER_ID,
    });

    const callArgs = mockRunAgent.mock.calls[0][0];
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hi' }]);
  });

  it('drops empty UI messages so they do not become blank current prompts', async () => {
    await postChat({
      messages: [
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'Hi' }] },
        { role: 'user', content: '' },
      ],
      userId: USER_ID,
    });

    const callArgs = mockRunAgent.mock.calls[0][0];
    expect(callArgs.messages).toEqual([{ role: 'user', content: 'Hi' }]);
  });
});

describe('fetchUserContext — cache miss loads from DB + KV', () => {
  it('queries DB for user when userId is provided', async () => {
    await postChat({ messages: [{ role: 'user', content: 'hello' }], userId: USER_ID });
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });

  it('calls readMemory with userId to load KV memory', async () => {
    await postChat({ messages: [{ role: 'user', content: 'hello' }], userId: USER_ID });
    expect(mockReadMemory).toHaveBeenCalledWith(USER_ID);
  });

  it('passes walletAddress and displayName from DB row to runAgent userContext', async () => {
    await postChat({ messages: [{ role: 'user', content: 'hello' }], userId: USER_ID });
    const callArgs = mockRunAgent.mock.calls[0][0];
    expect(callArgs.userContext.walletAddress).toBe('0xABC');
    expect(callArgs.userContext.displayName).toBe('Alice');
    expect(callArgs.userContext.autoApproveUsd).toBe(50);
  });
});

describe('fetchUserContext — stub fallback when user not found in DB', () => {
  it('uses stub context when DB returns empty array', async () => {
    mockDbSelect.mockResolvedValueOnce([]);
    await postChat({ messages: [{ role: 'user', content: 'hello' }], userId: USER_ID });
    const callArgs = mockRunAgent.mock.calls[0][0];
    expect(callArgs.userContext.walletAddress).toBe('0x0000000000000000000000000000000000000000');
    expect(callArgs.userContext.displayName).toBe('User');
    expect(callArgs.userContext.autoApproveUsd).toBe(25);
  });
});

describe('fetchUserContext — context cache hit (TTL not expired)', () => {
  it('does NOT re-query DB on second request within TTL window', async () => {
    // First request: populates the cache
    await postChat({ messages: [{ role: 'user', content: 'first' }], userId: USER_ID });
    expect(mockDbSelect).toHaveBeenCalledTimes(1);

    // Second request (no time change): should use cache
    await postChat({ messages: [{ role: 'user', content: 'second' }], userId: USER_ID });
    // DB should still only have been called once
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
  });
});

describe('invalidateContextCache — forces re-fetch on next request', () => {
  it('invalidating cache causes DB to be queried again on next request', async () => {
    // First request: populates the cache
    await postChat({ messages: [{ role: 'user', content: 'first' }], userId: USER_ID });
    expect(mockDbSelect).toHaveBeenCalledTimes(1);

    // Invalidate cache
    invalidateContextCache(USER_ID);

    // Second request: cache is gone, DB must be queried again
    await postChat({ messages: [{ role: 'user', content: 'second' }], userId: USER_ID });
    expect(mockDbSelect).toHaveBeenCalledTimes(2);
  });
});

describe('fetchUserContext — TTL expiry forces re-fetch', () => {
  it('re-queries DB after 30-minute TTL expires', async () => {
    vi.useFakeTimers();
    try {
      // First request: populates cache
      await postChat({ messages: [{ role: 'user', content: 'first' }], userId: USER_ID });
      expect(mockDbSelect).toHaveBeenCalledTimes(1);

      // Advance time past 30 minutes
      vi.advanceTimersByTime(31 * 60 * 1000);

      // Second request: TTL expired, must re-query
      await postChat({ messages: [{ role: 'user', content: 'second' }], userId: USER_ID });
      expect(mockDbSelect).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('runAgent — no userId means no DB query, no userContext', () => {
  it('does not call DB or readMemory when no userId provided', async () => {
    await postChat({ messages: [{ role: 'user', content: 'anonymous' }] });
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockReadMemory).not.toHaveBeenCalled();
  });

  it('calls runAgent with undefined userContext when no userId', async () => {
    await postChat({ messages: [{ role: 'user', content: 'anonymous' }] });
    const callArgs = mockRunAgent.mock.calls[0][0];
    expect(callArgs.userContext).toBeUndefined();
  });
});
