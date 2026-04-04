import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// Mock DB
const mockSelect = vi.fn();
const mockSet = vi.fn();
vi.mock('@genie/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@genie/db')>();
  return {
    ...actual,
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => mockSelect(),
          }),
        }),
      }),
      update: () => ({ set: mockSet }),
    },
    users: {},
  };
});

// Mock chat cache invalidation and resolveUserId
const mockInvalidate = vi.fn();
const mockResolveUserId = vi.fn();
vi.mock('./chat', () => ({
  invalidateContextCache: (...args: unknown[]) => mockInvalidate(...args),
  resolveUserId: (...args: unknown[]) => mockResolveUserId(...args),
}));

// Mock env config
vi.mock('../config/env', () => ({
  WORLD_APP_ID: 'app_test123',
  WORLD_ACTION: 'verify-human',
  WORLD_VERIFY_API_URL: 'https://developer.world.org/api/v2/verify',
}));

// Mock global fetch for World ID portal
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocks are set up
const { verifyRoute } = await import('./verify');

const app = new Hono();
app.route('/', verifyRoute);

const validBody = {
  userId: '00000000-0000-0000-0000-000000000001',
  proof: '0xproof',
  merkle_root: '0xroot',
  nullifier_hash: '0xnull123',
  verification_level: 'orb',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  // By default, resolveUserId returns the same UUID passed in
  mockResolveUserId.mockResolvedValue(validBody.userId);
});

describe('POST /verify', () => {
  it('returns 400 INVALID_INPUT when proof field missing', async () => {
    const body = { userId: '00000000-0000-0000-0000-000000000001' };
    const req = new Request('http://localhost/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('INVALID_INPUT');
  });

  it('returns 404 USER_NOT_FOUND when userId not in DB', async () => {
    mockResolveUserId.mockResolvedValue(null);
    const req = new Request('http://localhost/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(404);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('USER_NOT_FOUND');
  });

  it('returns 409 ALREADY_VERIFIED when user already has worldId', async () => {
    mockSelect.mockResolvedValue([{ worldId: '0xexisting' }]);
    const req = new Request('http://localhost/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(409);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('ALREADY_VERIFIED');
  });

  it('returns 400 VERIFICATION_FAILED when portal rejects proof', async () => {
    mockSelect.mockResolvedValue([{ worldId: null }]);
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ code: 'invalid_proof', detail: 'Proof is invalid' }),
    });
    const req = new Request('http://localhost/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(400);
    const json = await res.json() as { error: string };
    expect(json.error).toBe('VERIFICATION_FAILED');
  });

  it('returns success, stores nullifier, invalidates cache on valid proof', async () => {
    mockSelect.mockResolvedValue([{ worldId: null }]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, nullifier_hash: '0xnull123' }),
    });
    const req = new Request('http://localhost/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    const res = await app.fetch(req);
    expect(res.status).toBe(200);
    const json = await res.json() as { success: boolean };
    expect(json.success).toBe(true);
    expect(mockSet).toHaveBeenCalledWith({ worldId: '0xnull123' });
    expect(mockInvalidate).toHaveBeenCalledWith(validBody.userId);
  });

  it('calls portal at correct URL with action merged', async () => {
    mockSelect.mockResolvedValue([{ worldId: null }]);
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, nullifier_hash: '0xnull123' }),
    });
    const req = new Request('http://localhost/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    await app.fetch(req);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://developer.world.org/api/v2/verify/app_test123',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"action":"verify-human"'),
      }),
    );
  });
});
