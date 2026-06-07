import { tool } from 'ai';
import { z } from 'zod';
import { requireVerified } from './require-verified';
import { inferCategory } from './categorize';
import { db, transactions, eq, and } from '@genie/db';
import type { UserContext } from '../agent/context';

const PENDING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes (D-13)

/**
 * send_usdc tool factory — custodial USDC send (Phase 4).
 *
 * The Genie vault is custodial: the agent can move the user's managed funds with NO per-tx
 * wallet signature. But every send — regardless of amount — is previewed to the user first
 * via an in-chat confirmation card so they always see the exact transaction before it goes out.
 *
 * Behaviour: record a PENDING transaction and return { type: 'confirmation_required', ... }.
 * The confirmation is a chat tap (not a wallet signature); the /api/confirm route then
 * executes the transfer via agentTransfer once the user taps "Yes".
 *
 * Factory pattern binds userId + userContext per request.
 */
export function createSendUsdcTool(userId: string, userContext: UserContext) {
  return tool({
    description:
      "Send USDC to a resolved wallet address from the user's Genie vault. Returns a confirmation preview the user must approve before the transfer runs — no wallet popup. Use resolve_contact first to get the address.",
    inputSchema: z.object({
      recipientAddress: z.string().describe('Resolved 0x wallet address of recipient'),
      amountUsd: z.number().positive().describe('Amount in USD to send'),
      recipientName: z
        .string()
        .optional()
        .describe('Human-friendly name of the recipient (e.g. contact name "Alice") for the confirmation preview, if known.'),
      description: z.string().optional().describe('Transaction context from conversation, e.g. "dinner", "rent". Used for spending categorization and shown on the confirmation preview.'),
    }),
    execute: async ({ recipientAddress, amountUsd, recipientName, description }) => {
      // Gate: require World ID verification (per Phase 3 guard)
      const gateError = requireVerified(userContext);
      if (gateError) return gateError;

      try {
        // Clear any stale pending sends for this user
        await db
          .update(transactions)
          .set({ status: 'expired' })
          .where(
            and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')),
          );

        // Always record pending and ask for an in-chat confirmation tap so the user
        // sees the exact transaction before any money moves.
        const [pending] = await db
          .insert(transactions)
          .values({
            senderUserId: userId,
            recipientWallet: recipientAddress,
            amountUsd: amountUsd.toFixed(2),
            status: 'pending',
            expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
            category: inferCategory(description),
            source: 'genie_send',
          })
          .returning();

        return {
          type: 'confirmation_required',
          txId: pending.id,
          action: 'send',
          amount: amountUsd,
          token: 'USDC',
          fromLabel: 'Genie Vault',
          recipient: recipientAddress,
          ...(recipientName ? { recipientName } : {}),
          ...(description ? { description } : {}),
          expiresInMinutes: 15,
        };
      } catch (err) {
        console.error('[tool:send_usdc] error:', err);
        return {
          error: 'TRANSFER_FAILED',
          message: `Transfer failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
