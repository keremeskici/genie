import type { Transaction } from "@/hooks/useTransactions";

/**
 * Maps a transaction's `source` to how it should render in history lists.
 *
 * The transactions table records three kinds of activity, all keyed off `source`:
 *   - genie_send     → Genie sent USDC from the vault to an external recipient (money out).
 *   - vault_deposit  → user funded the vault (money into the vault, earning yield).
 *   - vault_withdraw → Genie returned funds from the vault to the user's own wallet.
 */
export interface TransactionDisplay {
  /** Material Symbols icon name. */
  icon: string;
  /** Primary line, e.g. "Deposited to vault" or "Sent to 0x12…ab". */
  title: string;
  /** '+' for inflows to a balance, '−' for outflows. */
  sign: "+" | "−";
  /** Tailwind text color class for the amount + icon. */
  amountClassName: string;
  /** Tailwind text color class for the icon. */
  iconClassName: string;
}

function shortWallet(wallet: string): string {
  if (!wallet || wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;
}

export function getTransactionDisplay(
  tx: Pick<Transaction, "source" | "recipientWallet">,
): TransactionDisplay {
  switch (tx.source) {
    case "vault_deposit":
      return {
        icon: "savings",
        title: "Deposited to vault",
        sign: "+",
        amountClassName: "text-accent",
        iconClassName: "text-accent",
      };
    case "vault_withdraw":
      return {
        icon: "account_balance_wallet",
        title: "Withdrew to wallet",
        sign: "−",
        amountClassName: "text-white/60",
        iconClassName: "text-white/40",
      };
    case "genie_send":
    default:
      return {
        icon: "north_east",
        title: `Sent to ${shortWallet(tx.recipientWallet)}`,
        sign: "−",
        amountClassName: "text-white/60",
        iconClassName: "text-white/40",
      };
  }
}
