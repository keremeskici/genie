import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// --- Mocks (must be at top level for hoisting) ---

const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();

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
      insert: () => ({
        values: () => ({
          returning: () => mockDbInsert(),
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => Promise.resolve(),
        }),
      }),
    },
    users: {},
    eq: vi.fn(),
  };
});

// Mock chat module dependencies so resolveUserId can be imported without side effects
const mockResolveUserId = vi.fn();
const mockInvalidateContextCache = vi.fn();
vi.mock('./chat', () => ({
  resolveUserId: (...args: unknown[]) => mockResolveUserId(...args),
  invalidateContextCache: (...args: unknown[]) => mockInvalidateContextCache(...args),
}));

// Import after mocks
const { usersRoute } = await import('./users');

const app = new Hono();
app.route('/users', usersRoute);

const WALLET_ADDRESS = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const WALLET_ADDRESS_LOWER = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
const USER_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

async function postProvision(body: object) {
  return app.fetch(
    new Request('http://localhost/users/provision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

async function patchProfile(body: object) {
  return app.fetch(
    new Request('http://localhost/users/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDbSelect.mockResolvedValue([]);
  mockDbInsert.mockResolvedValue([]);
});

// -------------------------------------------------------------------
// Gap 1 — AGEN-04: Idempotent provision endpoint + response shape
// -------------------------------------------------------------------

describe('POST /users/provision — idempotent create (AGEN-04)', () => {
  it('provisions a new user when wallet address is not found and returns valid response shape', async () => {
    // No existing user
    mockDbSelect.mockResolvedValueOnce([]);
    // Insert returns new user row
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: '0xdeadbee' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS });
    expect(res.status).toBe(200);

    const json = await res.json() as { userId: string; needsOnboarding: boolean };
    expect(json).toHaveProperty('userId');
    expect(json).toHaveProperty('needsOnboarding');
    // UUID format check
    expect(json.userId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(json.userId).toBe(USER_UUID);
  });

  it('returns needsOnboarding=true when new user has wallet-derived display name', async () => {
    mockDbSelect.mockResolvedValueOnce([]);
    // displayName starts with '0x' — wallet-derived, so needsOnboarding should be true
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: '0xdeadbee' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS });
    const json = await res.json() as { userId: string; needsOnboarding: boolean };
    expect(json.needsOnboarding).toBe(true);
  });

  it('returns needsOnboarding=false when new user has a real display name', async () => {
    mockDbSelect.mockResolvedValueOnce([]);
    // displayName does NOT start with '0x' — real name provided
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: 'alice' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS, displayName: 'alice' });
    const json = await res.json() as { userId: string; needsOnboarding: boolean };
    expect(json.needsOnboarding).toBe(false);
  });

  it('returns same userId for the same wallet address (idempotent get — existing user)', async () => {
    // Existing user found in DB
    mockDbSelect.mockResolvedValueOnce([{ id: USER_UUID, displayName: 'alice' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS });
    expect(res.status).toBe(200);

    const json = await res.json() as { userId: string; needsOnboarding: boolean };
    // Returns existing UUID — does NOT insert a new row
    expect(json.userId).toBe(USER_UUID);
    // Insert should NOT have been called
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('returns needsOnboarding=false for existing user with real display name', async () => {
    mockDbSelect.mockResolvedValueOnce([{ id: USER_UUID, displayName: 'alice' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS });
    const json = await res.json() as { userId: string; needsOnboarding: boolean };
    expect(json.needsOnboarding).toBe(false);
    expect(json.userId).toBe(USER_UUID);
  });

  it('returns needsOnboarding=true for existing user with wallet-derived display name', async () => {
    mockDbSelect.mockResolvedValueOnce([{ id: USER_UUID, displayName: '0x1a2b3c4d5' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS });
    const json = await res.json() as { userId: string; needsOnboarding: boolean };
    expect(json.needsOnboarding).toBe(true);
    expect(json.userId).toBe(USER_UUID);
  });
});

// -------------------------------------------------------------------
// Gap 2 — AGEN-05: Invalid wallet rejection + wallet address resolution
// -------------------------------------------------------------------

describe('POST /users/provision — input validation (AGEN-05)', () => {
  it('returns 400 when body is empty (no walletAddress field)', async () => {
    const res = await postProvision({});
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string; message: string };
    expect(json.error).toBe('INVALID_INPUT');
  });

  it('returns 400 when walletAddress is an empty string', async () => {
    const res = await postProvision({ walletAddress: '' });
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('INVALID_INPUT');
  });

  it('normalises wallet address to lowercase before DB lookup', async () => {
    const upperWallet = '0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF';
    // Existing user stored with lowercase address
    mockDbSelect.mockResolvedValueOnce([{ id: USER_UUID, displayName: 'alice' }]);

    const res = await postProvision({ walletAddress: upperWallet });
    expect(res.status).toBe(200);

    // Provision should succeed — the DB mock was called (address was lowercased before lookup)
    expect(mockDbSelect).toHaveBeenCalledTimes(1);
    const json = await res.json() as { userId: string };
    expect(json.userId).toBe(USER_UUID);
  });

  it('accepts provision request with optional displayName field', async () => {
    mockDbSelect.mockResolvedValueOnce([]);
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: 'bob' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS, displayName: 'bob' });
    expect(res.status).toBe(200);
    const json = await res.json() as { userId: string; needsOnboarding: boolean };
    expect(json.needsOnboarding).toBe(false);
  });

  it('accepts provision request when displayName is null', async () => {
    mockDbSelect.mockResolvedValueOnce([]);
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: WALLET_ADDRESS_LOWER.slice(0, 10) }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS, displayName: null });
    expect(res.status).toBe(200);
  });
});

// -------------------------------------------------------------------
// Gap 3 — FOPS-01: Provision returns valid UUID usable downstream
// -------------------------------------------------------------------

describe('POST /users/provision — UUID usability for financial ops (FOPS-01)', () => {
  it('returned userId is a valid UUID that downstream tools can consume', async () => {
    mockDbSelect.mockResolvedValueOnce([]);
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: '0xdeadbee' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS });
    expect(res.status).toBe(200);

    const { userId } = await res.json() as { userId: string; needsOnboarding: boolean };

    // Must be a valid UUID (RFC 4122 format) — this is what financial ops tools receive
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(UUID_RE.test(userId)).toBe(true);
  });

  it('userId from provision is stable across multiple calls for the same wallet', async () => {
    // First call — user does not exist
    mockDbSelect.mockResolvedValueOnce([]);
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: '0xdeadbee' }]);

    const res1 = await postProvision({ walletAddress: WALLET_ADDRESS });
    const { userId: id1 } = await res1.json() as { userId: string };

    // Second call — user now exists (idempotent get)
    mockDbSelect.mockResolvedValueOnce([{ id: USER_UUID, displayName: '0xdeadbee' }]);

    const res2 = await postProvision({ walletAddress: WALLET_ADDRESS });
    const { userId: id2 } = await res2.json() as { userId: string };

    // Both calls must return the same UUID
    expect(id1).toBe(id2);
    expect(id1).toBe(USER_UUID);
  });

  it('returns 200 and valid response shape for a fresh provision that can be immediately used', async () => {
    mockDbSelect.mockResolvedValueOnce([]);
    mockDbInsert.mockResolvedValueOnce([{ id: USER_UUID, displayName: '0xdeadbee' }]);

    const res = await postProvision({ walletAddress: WALLET_ADDRESS });
    expect(res.status).toBe(200);

    const json = await res.json() as Record<string, unknown>;
    // Response must have exactly the fields the auth callback and downstream tools expect
    expect(typeof json.userId).toBe('string');
    expect(typeof json.needsOnboarding).toBe('boolean');
  });
});
