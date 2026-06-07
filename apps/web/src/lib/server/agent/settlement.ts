import { db, debts, transactions, eq, and, gte } from '@genie/db';

const SETTLEMENT_TOLERANCE_USD = 1.00;

export interface SettlementNotice {
  counterpartyWallet: string;
  amountUsd: string;
  description: string | null;
}

/**
 * Check for incoming transfers that match open debts and auto-settle them (D-09).
 * Only matches debts where iOwe=false (they owe me) -- Pitfall 1.
 * Matches by counterpartyWallet and amount within tolerance -- Pitfall 2.
 * Only matches transactions created after the debt was created (Open Question 2).
 * Returns settlement notices for context injection (D-10).
 * Gracefully returns empty array on any error.
 */
export async function checkAndSettleDebts(
  ownerUserId: string,
  ownerWallet: string,
): Promise<SettlementNotice[]> {
  try {
    // 1. Fetch open debts where iOwe=false (they owe me, not yet settled)
    const openDebts = await db
      .select()
      .from(debts)
      .where(
        and(
          eq(debts.ownerUserId, ownerUserId),
          eq(debts.iOwe, false),
          eq(debts.settled, false),
        )
      );

    if (openDebts.length === 0) return [];

    const notices: SettlementNotice[] = [];

    for (const debt of openDebts) {
      // 2. Find incoming transactions where recipientWallet = our wallet
      //    AND transaction was created after the debt was created (Open Question 2)
      const incomingTxs = await db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.recipientWallet, ownerWallet),
            eq(transactions.status, 'confirmed'),
            gte(transactions.createdAt, debt.createdAt),
          )
        );

      // 3. Match by amount within tolerance — parseFloat required (Pitfall 2)
      //    Drizzle returns numeric as JS string, must parseFloat before comparison
      const debtAmount = parseFloat(debt.amountUsd);
      const matchingTx = incomingTxs.find(tx => {
        const txAmount = parseFloat(tx.amountUsd);
        return Math.abs(txAmount - debtAmount) <= SETTLEMENT_TOLERANCE_USD;
      });

      if (matchingTx) {
        // 4. Settle the debt
        await db
          .update(debts)
          .set({ settled: true })
          .where(eq(debts.id, debt.id));

        notices.push({
          counterpartyWallet: debt.counterpartyWallet,
          amountUsd: debt.amountUsd,
          description: debt.description,
        });
      }
    }

    return notices;
  } catch (err) {
    console.error('[settlement] error during auto-settlement check:', err);
    return []; // Graceful degradation — never block chat
  }
}
