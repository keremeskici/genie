import { tool } from 'ai';
import { z } from 'zod';
import { requireVerified } from './require-verified';
import { db, debts } from '@genie/db';
import type { UserContext } from '../agent/context';

/**
 * create_debt tool factory — records a debt between user and counterparty (DEBT-01, D-11).
 *
 * Gated behind World ID verification — unverified users cannot create debts.
 * Supports both debt directions:
 *   iOwe=false: counterparty owes user ("they owe me")
 *   iOwe=true:  user owes counterparty ("I owe them")
 *
 * Factory pattern binds userId + userContext per request.
 * CRITICAL: Uses inputSchema (not parameters) per Vercel AI SDK v6 (Pitfall 2).
 */
export function createCreateDebtTool(userId: string, userContext: UserContext) {
  return tool({
    description:
      'Record a debt. Use iOwe=true for "I owe them" and iOwe=false for "they owe me".',
    inputSchema: z.object({
      counterpartyWallet: z.string().describe('Wallet address of the other party'),
      amountUsd: z.number().positive().describe('Debt amount in USD'),
      description: z
        .string()
        .optional()
        .describe('What the debt is for, e.g. "dinner last Friday"'),
      iOwe: z.boolean().describe('true = I owe them; false = they owe me'),
    }),
    execute: async ({ counterpartyWallet, amountUsd, description, iOwe }) => {
      // Gate: require World ID verification (D-11)
      const gateError = requireVerified(userContext);
      if (gateError) return gateError;

      try {
        const [debt] = await db
          .insert(debts)
          .values({
            ownerUserId: userId,
            counterpartyWallet,
            amountUsd: amountUsd.toFixed(2),
            description: description ?? null,
            iOwe,
          })
          .returning();

        return {
          type: 'debt_created',
          id: debt.id,
          counterpartyWallet,
          amountUsd,
          direction: iOwe ? 'I owe them' : 'they owe me',
          description: description ?? null,
        };
      } catch (err) {
        console.error('[tool:create_debt] error:', err);
        return {
          error: 'DEBT_CREATION_FAILED',
          message: `Failed to create debt: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
