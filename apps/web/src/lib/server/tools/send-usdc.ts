import { tool } from 'ai';
import { z } from 'zod';
import { requireVerified } from './require-verified';
import { agentTransfer } from '../chain/vault';
import { inferCategory } from './categorize';
import { db, transactions, eq, and } from '@genie/db';
import type { UserContext } from '../agent/context';

const PENDING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes (D-13)

/**
 * send_usdc tool factory — custodial USDC send (Phase 4).
 *
 * The Genie vault is custodial: the agent moves the user's managed funds with NO per-tx user
 * signature. Threshold-based behaviour:
 *   - amountUsd <= autoApproveUsd → execute immediately via agentTransfer, record a CONFIRMED
 *     transaction with the real txHash, return { type: 'transfer_executed', ... }.
 *   - amountUsd >  autoApproveUsd → record a PENDING transaction, return
 *     { type: 'confirmation_required', ... }. The confirmation is a chat tap (not a signature);
 *     the confirm route then executes via agentTransfer.
 *
 * Factory pattern binds userId + userContext per request.
 */
export function createSendUsdcTool(userId: string, userContext: UserContext) {
  return tool({
    description:
      "Send USDC to a resolved wallet address from the user's Genie vault. Genie executes the transfer on the user's behalf — no wallet popup. Use resolve_contact first to get the address.",
    inputSchema: z.object({
      recipientAddress: z.string().describe('Resolved 0x wallet address of recipient'),
      amountUsd: z.number().positive().describe('Amount in USD to send'),
      description: z.string().optional().describe('Transaction context from conversation, e.g. "dinner", "rent". Used for spending categorization.'),
    }),
    execute: async ({ recipientAddress, amountUsd, description }) => {
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

        if (amountUsd <= userContext.autoApproveUsd) {
          // Under threshold → execute custodially now (no signature)
          const txHash = await agentTransfer(
            userContext.walletAddress as `0x${string}`,
            recipientAddress as `0x${string}`,
            amountUsd,
          );

          const [executed] = await db
            .insert(transactions)
            .values({
              senderUserId: userId,
              recipientWallet: recipientAddress,
              amountUsd: amountUsd.toFixed(2),
              txHash,
              status: 'confirmed',
              executedAt: new Date(),
              category: inferCategory(description),
              source: 'genie_send',
            })
            .returning();

          return {
            type: 'transfer_executed',
            txId: executed.id,
            txHash,
            amount: amountUsd,
            recipient: recipientAddress,
          };
        } else {
          // Over threshold → record pending, ask for an in-chat confirmation tap
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
            amount: amountUsd,
            recipient: recipientAddress,
            expiresInMinutes: 15,
          };
        }
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
