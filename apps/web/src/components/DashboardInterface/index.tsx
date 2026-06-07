"use client";

import { DepositModal } from "@/components/DepositModal";
import { ReceiveModal } from "@/components/ReceiveModal";
import { WithdrawModal } from "@/components/WithdrawModal";
import { useBalance } from "@/hooks/useBalance";
import { useDebts } from "@/hooks/useDebts";
import { useYieldPosition } from "@/hooks/useYieldPosition";
import { useTransactions } from "@/hooks/useTransactions";
import {
  getHomeGenieSuggestion,
  HOME_CHAT_SEED_STORAGE_KEY,
} from "@/lib/home-genie";
import { getTransactionDisplay } from "@/lib/transaction-display";
import {
  getSuggestedYieldDepositAmount,
  GENIE_VAULT_ADDRESS,
  RE7_USDC_VAULT_APR,
  RE7_USDC_VAULT_PROVIDER,
} from "@/lib/yield";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function formatWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function formatExpectedCollectionDate(dateStr: string): string {
  const expected = new Date(dateStr);
  expected.setDate(expected.getDate() + 30);

  return expected.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const DashboardInterface = () => {
  const { data: session } = useSession();
  const router = useRouter();

  const [showReceive, setShowReceive] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const walletAddress = session?.user?.walletAddress ?? "";
  const userId = session?.user?.id ?? "";
  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
    refetch: refetchBalance,
  } = useBalance(walletAddress);
  const {
    transactions,
    loading: txLoading,
    refetch: refetchTransactions,
  } = useTransactions(userId);
  const { debts, loading: debtLoading, error: debtError } = useDebts(userId);
  const {
    positionUsd: yieldPositionUsd,
    loading: yieldPositionLoading,
    error: yieldPositionError,
    refetch: refetchYieldPosition,
  } = useYieldPosition(walletAddress, GENIE_VAULT_ADDRESS);
  const recentTransactions = transactions.slice(0, 5);
  const numericBalance = balance ? parseFloat(balance) : null;
  const vaultBalance = yieldPositionUsd ? parseFloat(yieldPositionUsd) : null;
  const numericYieldPosition = vaultBalance ?? 0;
  const hasYieldPosition =
    !yieldPositionLoading &&
    !yieldPositionError &&
    yieldPositionUsd !== null &&
    !Number.isNaN(numericYieldPosition) &&
    numericYieldPosition > 0;
  const suggestedDepositAmount =
    numericBalance !== null && !Number.isNaN(numericBalance)
      ? getSuggestedYieldDepositAmount(numericBalance, 0.6)
      : "0.00";
  const homeSuggestion = getHomeGenieSuggestion({
    balanceAmount: numericBalance,
    suggestedDepositAmount,
    userId,
  });

  const afterDeposit = () => {
    refetchBalance();
    refetchYieldPosition();
    refetchTransactions();
  };
  const afterWithdraw = () => {
    refetchBalance();
    refetchYieldPosition();
    refetchTransactions();
  };

  return (
    <>
      <div className="flex flex-col bg-background text-white font-body overflow-hidden h-full">
        <div
          className="flex-1 overflow-y-auto overscroll-contain"
          style={{ touchAction: "pan-y" }}
        >
          {/* ── Header ── */}
          <div className="px-6 pt-10 pb-4">
            <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-white">
              Home
            </h1>
          </div>

          {/* ── Genie finance summary ── */}
          <div className="px-6 mb-8">
            <button
              type="button"
              onClick={() => {
                window.sessionStorage.setItem(
                  HOME_CHAT_SEED_STORAGE_KEY,
                  JSON.stringify({
                    userId,
                    message: homeSuggestion.message,
                    followUp: homeSuggestion.followUp,
                    createdAt: Date.now(),
                  }),
                );
                router.push("/chat");
              }}
              className="flex items-end gap-2 w-full text-left"
            >
              <div className="flex-shrink-0 w-20 h-24 self-end">
                <img
                  src="/genie.png"
                  alt="Genie"
                  className="w-full h-full object-contain"
                  style={{ mixBlendMode: "screen" }}
                />
              </div>
              <div className="relative flex-1 min-w-0 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white break-words">
                <span
                  className="absolute bottom-5 -left-[9px] w-0 h-0"
                  style={{
                    borderTop: "8px solid transparent",
                    borderBottom: "8px solid transparent",
                    borderRight: "10px solid #171717",
                  }}
                />
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="material-symbols-outlined text-accent text-lg"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    auto_awesome
                  </span>
                  <span className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
                    Genie
                  </span>
                </div>
                <p className="text-sm leading-relaxed">
                  {homeSuggestion.message}
                </p>
              </div>
            </button>
          </div>

          {/* ── Wallet Balance ── */}
          <div className="px-6 mb-6">
            <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
              In Your Wallet
            </p>
            {balanceLoading ? (
              <div className="h-12 w-32 bg-white/10 animate-pulse rounded" />
            ) : balanceError ? (
              <p className="font-headline text-5xl font-extrabold tracking-tighter text-white/30">
                $--.--
              </p>
            ) : (
              <p className="font-headline text-5xl font-extrabold tracking-tighter text-white">
                ${balance ?? "0.00"}
              </p>
            )}
          </div>

          {/* ── Quick actions ── */}
          <div className="px-6 mb-8 grid grid-cols-3 gap-3">
            {[
              {
                label: "Deposit",
                icon: "savings",
                onClick: () => setShowDeposit(true),
              },
              {
                label: "Withdraw",
                icon: "account_balance_wallet",
                onClick: () => setShowWithdraw(true),
              },
              {
                label: "Receive",
                icon: "south_west",
                onClick: () => setShowReceive(true),
              },
            ].map(({ label, icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className="flex flex-col items-center gap-2 bg-surface py-4 active:scale-95 transition-transform duration-150 rounded-xl"
              >
                <span className="material-symbols-outlined text-accent text-xl">
                  {icon}
                </span>
                <span className="font-headline text-[10px] uppercase tracking-widest text-white/60 font-bold">
                  {label}
                </span>
              </button>
            ))}
          </div>

          {/* ── Genie Vault (managed, yield-bearing) ── */}
          <div className="px-6 mb-8">
            <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
              Your Genie Vault
            </p>
            <div className="bg-surface rounded-[24px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
                    {RE7_USDC_VAULT_PROVIDER}
                  </p>
                  {yieldPositionLoading ? (
                    <div className="mt-2 h-8 w-24 bg-white/10 animate-pulse rounded" />
                  ) : (
                    <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tighter text-white">
                      ${yieldPositionUsd ?? "0.00"}
                    </h3>
                  )}
                  <p className="mt-2 text-sm text-white/55">
                    Managed by Genie, earning yield — ready to spend or withdraw
                    anytime.
                  </p>
                </div>
                <div className="rounded-2xl bg-white/5 px-4 py-3 text-right min-w-[110px]">
                  <p className="text-[11px] uppercase tracking-widest text-white/35">
                    APR
                  </p>
                  <p className="mt-2 font-headline text-lg font-bold text-white">
                    {RE7_USDC_VAULT_APR}
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeposit(true)}
                  className="rounded-full bg-accent px-6 py-4 text-base font-headline font-black tracking-[0.04em] text-black active:scale-95 transition-transform"
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => setShowWithdraw(true)}
                  disabled={!hasYieldPosition}
                  className="rounded-full border border-white/15 px-6 py-4 text-base font-headline font-black tracking-[0.04em] text-white active:scale-95 transition-transform disabled:opacity-30"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </div>

          {/* ── Money Lent ── */}
          <div className="px-6 mt-8">
            <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
              Current Loans
            </p>
            <div className="flex flex-col divide-y divide-white/5">
              {debtLoading ? (
                <div className="py-4 flex flex-col gap-3">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-12 bg-white/5 animate-pulse rounded"
                    />
                  ))}
                </div>
              ) : debtError ? (
                <p className="py-4 text-sm text-red-400">
                  Could not load money lent.
                </p>
              ) : debts.length === 0 ? (
                <p className="py-4 text-sm text-white/40">
                  No open loans to collect.
                </p>
              ) : (
                debts.map((debt) => (
                  <div
                    key={debt.id}
                    className="flex items-center justify-between py-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0">
                        <span className="material-symbols-outlined text-accent text-base">
                          payments
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">
                          Lent to {formatWallet(debt.counterpartyWallet)}
                        </p>
                        <p className="text-[11px] text-white/40">
                          Expected by{" "}
                          {formatExpectedCollectionDate(debt.createdAt)}
                        </p>
                      </div>
                    </div>
                    <p className="font-headline font-bold text-sm text-accent">
                      +{parseFloat(debt.amountUsd).toFixed(2)} USDC
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Recent Transactions ── */}
          <div className="px-6 mt-8 mb-8">
            <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
              Recent Transactions
            </p>
            <div className="flex flex-col divide-y divide-white/5">
              {txLoading ? (
                <div className="py-4 flex flex-col gap-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-white/5 animate-pulse rounded"
                    />
                  ))}
                </div>
              ) : recentTransactions.length === 0 ? (
                <p className="py-4 text-sm text-white/40">
                  No transactions yet
                </p>
              ) : (
                recentTransactions.map((tx) => {
                  const display = getTransactionDisplay(tx);
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0 rounded-lg">
                          <span
                            className={`material-symbols-outlined text-base ${display.iconClassName}`}
                          >
                            {display.icon}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-white">
                            {display.title}
                          </p>
                          <p className="text-[11px] text-white/40">
                            {formatRelativeTime(tx.createdAt)}
                          </p>
                        </div>
                      </div>
                      <p
                        className={`font-headline font-bold text-sm ${display.amountClassName}`}
                      >
                        {display.sign}
                        {parseFloat(tx.amountUsd).toFixed(2)} USDC
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
      {showDeposit && walletAddress && (
        <DepositModal
          walletAddress={walletAddress}
          userId={userId}
          balanceAmount={numericBalance}
          defaultAmount={
            suggestedDepositAmount !== "0.00" ? suggestedDepositAmount : ""
          }
          onClose={() => setShowDeposit(false)}
          onSuccess={afterDeposit}
        />
      )}
      {showWithdraw && (
        <WithdrawModal
          userId={userId}
          vaultBalanceAmount={vaultBalance}
          onClose={() => setShowWithdraw(false)}
          onSuccess={afterWithdraw}
        />
      )}
      {showReceive && walletAddress && (
        <ReceiveModal
          address={walletAddress}
          onClose={() => setShowReceive(false)}
        />
      )}
    </>
  );
};
