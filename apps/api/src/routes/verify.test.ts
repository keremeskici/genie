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

// Import after mocks are set up
const { verifyRoute } = await import('./verify');

const app = new Hono();
app.route('/verify', verifyRoute);

const validBody = {
  userId: '00000000-0000-0000-0000-000000000001',
  nullifier_hash: '0xnull123',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  mockResolveUserId.mockResolvedValue(validBody.userId);
});

describe('POST /verify', () => {
  it('returns 400 INVALID_INPUT when nullifier_hash missing', async () => {
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

  it('returns success, stores nullifier, invalidates cache on valid proof', async () => {
    mockSelect.mockResolvedValue([{ worldId: null }]);
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
});
