import type { NextRequest } from 'next/server';
import type { ModelMessage } from 'ai';
import { runAgent } from '@/lib/server/agent';
import { resolveUserId, fetchUserContext } from '@/lib/server/users';
import { checkAndSettleDebts, type SettlementNotice } from '@/lib/server/agent/settlement';

export const runtime = 'nodejs';
export const maxDuration = 60; // streaming budget

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
 * POST /api/chat — streaming agent endpoint.
 *
 * Returns a text stream via toTextStreamResponse() (standard web Response — streams
 * on the Vercel Node runtime with maxDuration set).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { messages, userId, walletAddress } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return Response.json(
        { error: 'messages array is required and must not be empty' },
        { status: 400 },
      );
    }

    const modelMessages = normalizeChatMessages(messages);
    if (modelMessages.length === 0) {
      return Response.json(
        { error: 'messages array must contain at least one text message' },
        { status: 400 },
      );
    }

    console.log(
      `[route:chat] received ${messages.length} messages (${modelMessages.length} model messages), userId: ${userId ?? 'none'}, walletAddress: ${walletAddress ?? 'none'}`,
    );

    // Prefer wallet address because old NextAuth sessions can contain stale UUIDs.
    const identityToken =
      typeof walletAddress === 'string' && walletAddress.length > 0
        ? walletAddress
        : userId;

    // Resolve wallet address → internal UUID (D-11: session.user.id may be wallet or UUID)
    const resolvedUserId = await resolveUserId(identityToken);
    if (identityToken && !resolvedUserId) {
      console.warn(`[route:chat] could not resolve user identity: ${identityToken}`);
    }

    // Fetch user context if resolvedUserId available (D-10), otherwise use stub
    const userContext = resolvedUserId ? await fetchUserContext(resolvedUserId) : undefined;

    // Auto-settle debts from incoming transfers (DEBT-02, D-09, D-10)
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
    return Response.json({ error: 'Internal server error', message: String(err) }, { status: 500 });
  }
}
