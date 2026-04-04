import { Hono } from 'hono';
import { z } from 'zod';
import { db, users, eq } from '@genie/db';
import { invalidateContextCache, resolveUserId } from './chat';
import { WORLD_APP_ID, WORLD_ACTION, WORLD_VERIFY_API_URL } from '../config/env';

export const verifyRoute = new Hono();

const proofSchema = z.object({
  // Accept wallet address (0x...) or UUID — resolveUserId handles both
  userId: z.string().min(1),
  proof: z.string(),
  merkle_root: z.string(),
  nullifier_hash: z.string(),
  verification_level: z.enum(['orb', 'device']),
});

verifyRoute.post('/verify', async (c) => {
  const body = await c.req.json();
  const parsed = proofSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_INPUT', message: 'Missing or invalid proof fields' }, 400);
  }

  const { userId: rawUserId, proof, merkle_root, nullifier_hash, verification_level } = parsed.data;

  // Resolve wallet address → internal UUID (same as chat route — session.user.id is wallet address)
  const userId = await resolveUserId(rawUserId);
  if (!userId) {
    return c.json({ error: 'USER_NOT_FOUND', message: 'Could not resolve userId' }, 404);
  }

  // D-04: Check if user exists and is not already verified
  const [existing] = await db.select({ worldId: users.worldId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) {
    return c.json({ error: 'USER_NOT_FOUND' }, 404);
  }
  if (existing.worldId !== null) {
    return c.json({ error: 'ALREADY_VERIFIED', message: 'This account is already verified with World ID' }, 409);
  }

  // D-02: Call World ID Cloud v2 API (developer.world.org per research)
  const worldResponse = await fetch(`${WORLD_VERIFY_API_URL}/${WORLD_APP_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nullifier_hash, merkle_root, proof, verification_level, action: WORLD_ACTION }),
  });

  if (!worldResponse.ok) {
    const err = await worldResponse.json().catch(() => ({})) as { code?: string; detail?: string };
    return c.json({ error: 'VERIFICATION_FAILED', code: err.code, detail: err.detail }, 400);
  }

  // D-03: Store nullifier_hash in users.worldId
  await db.update(users).set({ worldId: nullifier_hash }).where(eq(users.id, userId));

  // Pitfall 4: Invalidate context cache so isVerified updates immediately
  invalidateContextCache(userId);

  console.log(`[route:verify] user ${userId} verified with World ID`);
  return c.json({ success: true });
});
