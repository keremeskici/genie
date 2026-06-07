import { tool } from 'ai';
import { z } from 'zod';
import { db, transactions, sql, and, eq, gte, lte } from '@genie/db';

/**
 * get_spending tool factory — queries spending aggregated by category (SPND-02, D-15).
 *
 * Only requires userId (no verification gate — viewing spending is not a gated action).
 * Agent handles natural language date parsing and passes startDate/endDate as ISO strings (D-13).
 *
 * Key behaviors:
 * - Only sums confirmed transactions (Pitfall 4: exclude pending/expired)
 * - COALESCE(category, 'transfers') ensures null categories count as transfers (Pitfall 5)
 * - Optional category filter narrows to a single spending category
 *
 * CRITICAL: Uses inputSchema (not parameters) per Vercel AI SDK v6 (Pitfall 2).
 */
export function createGetSpendingTool(userId: string) {
  return tool({
    description:
      "Get spending summary grouped by category for a date range. The agent should parse natural language dates (e.g. 'this week', 'last month') into startDate/endDate ISO strings.",
    inputSchema: z.object({
      startDate: z
        .string()
        .describe('Start of date range as ISO 8601 string, e.g. "2026-03-28T00:00:00Z"'),
      endDate: z
        .string()
        .describe('End of date range as ISO 8601 string, e.g. "2026-04-04T23:59:59Z"'),
      category: z
        .string()
        .optional()
        .describe(
          'Optional: filter to a single category (food, transport, entertainment, bills, transfers)',
        ),
    }),
    execute: async ({ startDate, endDate, category }) => {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const conditions: ReturnType<typeof eq>[] = [
          eq(transactions.senderUserId, userId),
          eq(transactions.status, 'confirmed'), // Pitfall 4: only confirmed
          gte(transactions.createdAt, start),
          lte(transactions.createdAt, end),
        ];

        if (category) {
          conditions.push(eq(transactions.category, category));
        }

        const rows = await db
          .select({
            category: sql<string>`COALESCE(${transactions.category}, 'transfers')`, // Pitfall 5: null -> transfers
            total: sql<string>`SUM(${transactions.amountUsd})`,
          })
          .from(transactions)
          .where(and(...conditions))
          .groupBy(sql`COALESCE(${transactions.category}, 'transfers')`);

        const grandTotal = rows.reduce((sum, r) => sum + parseFloat(r.total || '0'), 0);

        return {
          type: 'spending_summary',
          categories: rows.map((r) => ({ category: r.category, total: r.total })),
          total: grandTotal.toFixed(2),
          startDate,
          endDate,
        };
      } catch (err) {
        console.error('[tool:get_spending] error:', err);
        return {
          error: 'SPENDING_QUERY_FAILED',
          message: `Failed to query spending: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
      }
    },
  });
}
