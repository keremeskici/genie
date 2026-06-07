import { db, users, eq } from '@genie/db';
import type { UserContext } from './agent/context';
import { readMemory } from './agent/memory';

/**
 * Shared user-identity + context helpers used by the API route handlers
 * (chat, verify, users, send, confirm) and the update_memory tool.
 *
 * Lives in lib/server (not a route) so it can be imported without pulling in
 * a Next.js route handler — previously this lived in the Hono chat route.
 */

// 30-minute context cache TTL per session (D-09)
const SESSION_TTL_MS = 30 * 60 * 1000;

interface CachedContext {
  userContext: UserContext;
  fetchedAt: number;
}

const contextCache = new Map<string, CachedContext>();

function getCachedContext(userId: string): UserContext | null {
  const entry = contextCache.get(userId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SESSION_TTL_MS) {
    contextCache.delete(userId);
    return null;
  }
  return entry.userContext;
}

/** Invalidate cached context for a user so next fetch reloads from DB. Called by update_memory tool and verify/profile routes after a write. */
export function invalidateContextCache(userId: string): void {
  contextCache.delete(userId);
  console.log(`[users] context cache invalidated for user ${userId}`);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a raw identity token (wallet address or UUID) to an internal UUID.
 *
 * NextAuth session.user.id is the wallet address (e.g. "0x1a2b...").
 * The DB expects a UUID as the primary key. This function:
 *   1. Returns UUID passthrough if the input already looks like a UUID.
 *   2. If input starts with "0x", treats it as a wallet address and upserts
 *      a users row, returning the internal UUID (idempotent).
 *   3. Returns undefined for unrecognised input.
 */
export async function resolveUserId(rawId: string | undefined): Promise<string | undefined> {
  if (!rawId) return undefined;

  // Already a UUID — use as-is
  if (UUID_REGEX.test(rawId)) return rawId;

  // Wallet address — upsert user and return UUID
  if (rawId.startsWith('0x')) {
    const walletAddress = rawId.toLowerCase();
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.walletAddress, walletAddress))
      .limit(1);
    if (existing) return existing.id;

    // Provision new user — short address as default display name
    const [newUser] = await db
      .insert(users)
      .values({
        walletAddress,
        displayName: walletAddress.slice(0, 10),
        autoApproveUsd: '25',
      })
      .returning({ id: users.id });
    console.log(`[users] provisioned new user for wallet ${walletAddress}: ${newUser?.id}`);
    return newUser?.id;
  }

  // Unrecognised — pass through and let downstream handle it
  return rawId;
}

export async function fetchUserContext(userId: string): Promise<UserContext> {
  // Check cache first (D-10)
  const cached = getCachedContext(userId);
  if (cached) {
    console.log(`[users] context cache hit for user ${userId}`);
    return cached;
  }

  console.log(`[users] context cache miss — fetching for user ${userId}`);

  // Fetch from Supabase
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    console.warn(`[users] user ${userId} not found — using stub context`);
    return {
      walletAddress: '0x0000000000000000000000000000000000000000',
      displayName: 'User',
      autoApproveUsd: 25,
      isVerified: false,
      isHumanBacked: false,
    };
  }

  // Fetch agent memory from Postgres (graceful — returns null if none stored)
  const memory = await readMemory(userId);

  const userContext: UserContext = {
    walletAddress: user.walletAddress,
    displayName: user.displayName,
    autoApproveUsd: parseFloat(user.autoApproveUsd),
    memory: memory ?? undefined,
    isVerified: user.worldId !== null,
    isHumanBacked: user.worldId !== null,
  };

  // Cache it (D-08)
  contextCache.set(userId, { userContext, fetchedAt: Date.now() });
  return userContext;
}

function needsOnboarding(displayName: string): boolean {
  return displayName.startsWith('0x');
}

/**
 * Get-or-create a user by wallet address (idempotent — D-02).
 * Shared by the /api/users/provision route and the NextAuth authorize() callback.
 * needsOnboarding is true when the user has only a wallet-derived default display name.
 */
export async function provisionUser(params: {
  walletAddress: string;
  displayName?: string | null;
}): Promise<{ userId: string; needsOnboarding: boolean }> {
  const walletAddress = params.walletAddress.toLowerCase();

  const [existing] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.walletAddress, walletAddress))
    .limit(1);

  if (existing) {
    return { userId: existing.id, needsOnboarding: needsOnboarding(existing.displayName) };
  }

  // Use MiniKit username if available (D-07), else wallet-derived default
  const resolvedDisplayName = params.displayName ?? walletAddress.slice(0, 10);

  const [newUser] = await db
    .insert(users)
    .values({
      walletAddress,
      displayName: resolvedDisplayName,
      autoApproveUsd: '25',
    })
    .returning({ id: users.id, displayName: users.displayName });

  if (!newUser) {
    throw new Error('PROVISION_FAILED: could not create user');
  }

  return { userId: newUser.id, needsOnboarding: needsOnboarding(newUser.displayName) };
}

export type MarkVerifiedResult =
  | { ok: true }
  | { ok: false; code: 'USER_NOT_FOUND' | 'ALREADY_VERIFIED' };

/**
 * Mark a user as World ID verified (D-03). Stores the nullifier_hash in users.worldId.
 * The caller (BFF) has already validated the proof with the World ID Cloud API.
 * Shared by the /api/verify route and the verify-proof BFF route.
 */
export async function markVerified(
  rawUserId: string | undefined,
  nullifierHash: string,
): Promise<MarkVerifiedResult> {
  const userId = await resolveUserId(rawUserId);
  if (!userId) return { ok: false, code: 'USER_NOT_FOUND' };

  const [existing] = await db
    .select({ worldId: users.worldId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!existing) return { ok: false, code: 'USER_NOT_FOUND' };
  if (existing.worldId !== null) return { ok: false, code: 'ALREADY_VERIFIED' };

  await db.update(users).set({ worldId: nullifierHash }).where(eq(users.id, userId));

  // Invalidate context cache so isVerified updates immediately
  invalidateContextCache(userId);

  console.log(`[users] user ${userId} verified with World ID`);
  return { ok: true };
}
