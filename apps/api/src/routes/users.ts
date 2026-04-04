import { Hono } from 'hono';
import { z } from 'zod';
import { db, users, eq } from '@genie/db';
import { resolveUserId, invalidateContextCache } from './chat';

export const usersRoute = new Hono();

const provisionSchema = z.object({
  walletAddress: z.string().min(1),
  displayName: z.string().nullable().optional(),
});

/**
 * POST /users/provision
 * Get-or-create a user by wallet address (idempotent — D-02).
 * Returns { userId: UUID, needsOnboarding: boolean }.
 * needsOnboarding is true when the user has no proper display name (only a wallet-derived default).
 */
usersRoute.post('/users/provision', async (c) => {
  const body = await c.req.json();
  const parsed = provisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_INPUT', message: 'walletAddress is required' }, 400);
  }

  const { walletAddress: rawAddress, displayName } = parsed.data;
  const walletAddress = rawAddress.toLowerCase();

  // Check for existing user
  const [existing] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.walletAddress, walletAddress))
    .limit(1);

  if (existing) {
    const needsOnboarding = existing.displayName.startsWith('0x');
    console.log(`[route:users] provision — existing user ${existing.id}, needsOnboarding=${needsOnboarding}`);
    return c.json({ userId: existing.id, needsOnboarding });
  }

  // Provision new user — use MiniKit username if available (D-07), else wallet-derived default
  const resolvedDisplayName = displayName ?? walletAddress.slice(0, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      walletAddress,
      displayName: resolvedDisplayName,
      autoApproveUsd: '25',
    })
    .returning({ id: users.id, displayName: users.displayName });

  if (!newUser) {
    return c.json({ error: 'PROVISION_FAILED', message: 'Could not create user' }, 500);
  }

  const needsOnboarding = newUser.displayName.startsWith('0x');
  console.log(`[route:users] provision — new user ${newUser.id}, needsOnboarding=${needsOnboarding}`);
  return c.json({ userId: newUser.id, needsOnboarding });
});

const patchProfileSchema = z.object({
  userId: z.string().min(1),
  autoApproveUsd: z.number().positive().max(10000),
});

/**
 * PATCH /users/profile — update user's auto-approve threshold.
 *
 * Accepts wallet address or UUID as userId (resolveUserId handles both).
 * Used by the onboarding flow to persist the spending limit the user configures.
 */
usersRoute.patch('/users/profile', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = patchProfileSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'INVALID_INPUT', message: parsed.error.message }, 400);
    }

    const { userId: rawUserId, autoApproveUsd } = parsed.data;

    const userId = await resolveUserId(rawUserId);
    if (!userId) {
      return c.json({ error: 'USER_NOT_FOUND', message: 'Could not resolve userId' }, 404);
    }

    await db
      .update(users)
      .set({ autoApproveUsd: autoApproveUsd.toFixed(2) })
      .where(eq(users.id, userId));

    // Invalidate context cache so updated threshold is picked up on next chat request
    invalidateContextCache(userId);

    console.log(`[route:users] updated autoApproveUsd to ${autoApproveUsd} for user ${userId}`);
    return c.json({ success: true });
  } catch (err) {
    console.error('[route:users] error:', err);
    return c.json({ error: 'Internal server error', message: String(err) }, 500);
  }
});
