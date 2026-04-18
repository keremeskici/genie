import { Hono } from 'hono';
import { runAgent } from '../agent/index';
import { db, users, eq } from '@genie/db';
import { readMemory } from '../kv';
import type { UserContext } from '../agent/context';
import { checkAndSettleDebts, type SettlementNotice } from '../agent/settlement';
import type { ModelMessage } from 'ai';

export const chatRoute = new Hono();

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

/** Invalidate cached context for a user so next fetch reloads from DB + KV. Called by update_memory tool after KV write. */
export function invalidateContextCache(userId: string): void {
  contextCache.delete(userId);
  console.log(`[route:chat] context cache invalidated for user ${userId}`);
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type IncomingChatMessage = {
  role?: unknown;
  content?: unknown;
  parts?: unknown;
};

const MODEL_MESSAGE_ROLES = new Set(['system', 'user', 'assistant']);

function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return '';

  return parts
    .map((part) => {
      if (!part || typeof part !== 'object') return '';
      const maybeTextPart = part as { type?: unknown; text?: unknown };
      return maybeTextPart.type === 'text' && typeof maybeTextPart.text === 'string'
        ? maybeTextPart.text
        : '';
    })
    .join('');
}

function normalizeChatMessages(messages: IncomingChatMessage[]): ModelMessage[] {
  return messages.flatMap((message) => {
    const role = typeof message.role === 'string' ? message.role : '';
    if (!MODEL_MESSAGE_ROLES.has(role)) return [];

    const content =
      typeof message.content === 'string'
        ? message.content
        : extractTextFromParts(message.parts);

    if (content.trim().length === 0) return [];

    return [{ role: role as 'system' | 'user' | 'assistant', content }];
  });
}

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
    console.log(`[route:chat] provisioned new user for wallet ${walletAddress}: ${newUser?.id}`);
    return newUser?.id;
  }

  // Unrecognised — pass through and let downstream handle it
  return rawId;
}

async function fetchUserContext(userId: string): Promise<UserContext> {
  // Check cache first (D-10)
  const cached = getCachedContext(userId);
  if (cached) {
    console.log(`[route:chat] context cache hit for user ${userId}`);
    return cached;
  }

  console.log(`[route:chat] context cache miss — fetching for user ${userId}`);

  // Fetch from Supabase
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    console.warn(`[route:chat] user ${userId} not found — using stub context`);
    return {
      walletAddress: '0x0000000000000000000000000000000000000000',
      displayName: 'User',
      autoApproveUsd: 25,
      isVerified: false,
      isHumanBacked: false,
    };
  }

  // Fetch from 0G KV (graceful — returns null if KV unavailable)
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

/**
 * POST /api/chat — streaming agent endpoint.
 *
 * Returns Server-Sent Events via toUIMessageStreamResponse() (not pipeDataStreamToResponse,
 * which is Node.js-only and crashes on Bun/Hono — Pitfall 3 from RESEARCH).
 */
chatRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { messages, userId } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json(
        { error: 'messages array is required and must not be empty' },
        400,
      );
    }

    const modelMessages = normalizeChatMessages(messages);
    if (modelMessages.length === 0) {
      return c.json(
        { error: 'messages array must contain at least one text message' },
        400,
      );
    }

    console.log(`[route:chat] received ${messages.length} messages (${modelMessages.length} model messages), userId: ${userId ?? 'none'}`);

    // Resolve wallet address → internal UUID (D-11: session.user.id is wallet address not UUID)
    const resolvedUserId = await resolveUserId(userId);
    if (userId && !resolvedUserId) {
      console.warn(`[route:chat] could not resolve userId: ${userId}`);
    }

    // Fetch user context if resolvedUserId available (D-10), otherwise use stub
    const userContext = resolvedUserId ? await fetchUserContext(resolvedUserId) : undefined;

    // Phase 5: Auto-settle debts from incoming transfers (DEBT-02, D-09, D-10)
    let settlementNotices: SettlementNotice[] = [];
    if (resolvedUserId && userContext) {
      try {
        settlementNotices = await checkAndSettleDebts(resolvedUserId, userContext.walletAddress);
        if (settlementNotices.length > 0) {
          console.log(`[route:chat] settled ${settlementNotices.length} debt(s) for user ${resolvedUserId}`);
        }
      } catch (err) {
        console.error('[route:chat] settlement check failed (continuing):', err);
      }
    }

    const result = await runAgent({ messages: modelMessages, userId: resolvedUserId, userContext, settlementNotices });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error('[route:chat] error:', err);
    return c.json({ error: 'Internal server error', message: String(err) }, 500);
  }
});
