import { tool } from 'ai';
import { z } from 'zod';
import { db, debts, eq, and } from '@genie/db';

/**
 * list_debts tool factory — returns all open (unsettled) debts for the user (D-12).
 *
 * Returns debts with direction: "I owe them" or "they owe me".
 * Only returns settled=false debts.
 *
 * Factory pattern binds userId per request.
 * CRITICAL: Uses inputSchema (not parameters) per Vercel AI SDK v6 (Pitfall 2).
 */
export function createListDebtsTool(userId: string) {
  return tool({
    description:
      'List open (unsettled) debts. Shows who owes what.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const openDebts = await db
          .select()
          .from(debts)
          .where(and(eq(debts.ownerUserId, userId), eq(debts.settled, false)));

        return {
          type: 'debts_list',
          debts: openDebts.map((d) => ({
            id: d.id,
            counterpartyWallet: d.counterpartyWallet,
            amountUsd: d.amountUsd,
            direction: d.iOwe ? 'I owe them' : 'they owe me',
            description: d.description,
            createdAt: d.createdAt.toISOString(),
          })),
          count: openDebts.length,
        };
      } catch (err) {
        console.error('[tool:list_debts] error:', err);
        return {
          error: 'DEBT_LIST_FAILED',
          message: `Failed to list debts: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
