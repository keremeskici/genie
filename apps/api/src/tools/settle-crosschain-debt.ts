import { tool } from 'ai';
import { z } from 'zod';
import { requireVerified } from './require-verified';
import { db, debts, transactions, eq, and } from '@genie/db';
import { bridgeUsdc } from '../chain/bridge';
import type { UserContext } from '../agent/context';

/**
 * settle_crosschain_debt tool factory — implements the "Escrow-to-Anywhere" flow.
 *
 * Flow:
 * 1. Pull funds from debtor's allowance to the Genie Relayer via GenieRouter.route.
 * 2. Initiate CCTP bridge to move funds to the creditor's wallet on the destination chain.
 * 3. Update local DB records.
 *
 * Uses shared bridgeUsdc utility from chain/bridge.ts (extracted per D-12).
 */
export function createSettleCrosschainDebtTool(userId: string, userContext: UserContext) {
  return tool({
    description:
      'Settle an existing debt by sending USDC to a friend on a different blockchain (like Base, Ethereum, Optimism, or Arbitrum). This uses the Genie Escrow system and Circle CCTP to bridge funds.',
    inputSchema: z.object({
      debtId: z.string().describe('The unique ID of the debt to settle'),
      destinationChain: z
        .enum(['base', 'ethereum', 'optimism', 'arbitrum'])
        .describe('The blockchain where the recipient wants to receive their funds'),
      destinationWallet: z.string().describe('The recipient wallet address on the destination chain'),
    }),
    execute: async ({ debtId, destinationChain, destinationWallet }) => {
      // Gate: require World ID verification
      const gateError = requireVerified(userContext);
      if (gateError) return gateError;

      try {
        // 1. Fetch the debt record
        const [debt] = await db
          .select()
          .from(debts)
          .where(and(eq(debts.id, debtId), eq(debts.ownerUserId, userId)))
          .limit(1);

        if (!debt) {
          return { error: 'DEBT_NOT_FOUND', message: 'Could not find the specified debt record.' };
        }

        if (debt.settled) {
          return { error: 'ALREADY_SETTLED', message: 'This debt has already been settled.' };
        }

        // 2. Bridge USDC via shared CCTP utility (D-12)
        const { routeTxHash, bridgeTxHash } = await bridgeUsdc({
          senderWallet: userContext.walletAddress as `0x${string}`,
          amountUsd: parseFloat(debt.amountUsd),
          destinationChain,
          recipientWallet: destinationWallet,
        });

        console.log(`[tool:settle_crosschain_debt] Pull TX: ${routeTxHash}`);
        console.log(`[tool:settle_crosschain_debt] Bridge TX: ${bridgeTxHash}`);

        // 3. Record the settlement transaction
        await db.insert(transactions).values({
          senderUserId: userId,
          recipientWallet: destinationWallet,
          amountUsd: debt.amountUsd,
          txHash: bridgeTxHash, // Use bridge hash for tracking
          status: 'confirmed',
          executedAt: new Date(),
          source: 'genie_bridge',
          category: 'transfers',
        });

        // 4. Mark debt as settled
        await db
          .update(debts)
          .set({ settled: true })
          .where(eq(debts.id, debtId));

        return {
          type: 'settlement_initiated',
          debtId,
          amount: debt.amountUsd,
          destinationChain,
          destinationWallet,
          routeTxHash,
          bridgeTxHash,
          status: 'bridging',
          message: `I've successfully initiated the cross-chain settlement. I've pulled ${debt.amountUsd} USDC and burned it for minting on ${destinationChain}. Bob will receive it in ~15 mins!`,
        };
      } catch (err) {
        console.error('[tool:settle_crosschain_debt] error:', err);
        return {
          error: 'SETTLEMENT_FAILED',
          message: `Cross-chain settlement failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
