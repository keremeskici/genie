import { Hono } from 'hono';
import { z } from 'zod';
import { db, users, eq } from '@genie/db';

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
