'use client';

import { AddFundsModal } from '@/components/AddFundsModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { SendModal } from '@/components/SendModal';
import { YieldDepositModal } from '@/components/YieldDepositModal';
import { useBalance } from '@/hooks/useBalance';
import { useDebts } from '@/hooks/useDebts';
import { useYieldPosition } from '@/hooks/useYieldPosition';
import { useTransactions } from '@/hooks/useTransactions';
import {
  getHomeGenieSuggestion,
  HOME_CHAT_SEED_STORAGE_KEY,
} from '@/lib/home-genie';
import { isDemoVerified } from '@/lib/demo-verification';
import {
  getSuggestedYieldDepositAmount,
  RE7_USDC_VAULT_ADDRESS,
  RE7_USDC_VAULT_APR,
  RE7_USDC_VAULT_PROVIDER,
} from '@/lib/yield';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
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
    month: 'short',
    day: 'numeric',
  });
}

export const DashboardInterface = () => {
  const { data: session } = useSession();
  const router = useRouter();

  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [showYieldPreview, setShowYieldPreview] = useState(false);
  const walletAddress = session?.user?.walletAddress ?? '';
  const userId = session?.user?.id ?? '';
  const { balance, loading: balanceLoading, error: balanceError, refetch: refetchBalance } = useBalance(walletAddress);
  const { transactions, loading: txLoading } = useTransactions(userId);
  const { debts, loading: debtLoading, error: debtError } = useDebts(userId);
  const {
    positionUsd: yieldPositionUsd,
    shares: yieldShares,
    loading: yieldPositionLoading,
    error: yieldPositionError,
    refetch: refetchYieldPosition,
  } = useYieldPosition(walletAddress, RE7_USDC_VAULT_ADDRESS);
  const recentTransactions = transactions.slice(0, 5);
  const numericBalance = balance ? parseFloat(balance) : null;
  const numericYieldPosition = yieldPositionUsd ? parseFloat(yieldPositionUsd) : 0;
  const demoVerified = isDemoVerified(userId);
  const hasUsdcToDeposit = !balanceLoading && !balanceError && numericBalance !== null && !Number.isNaN(numericBalance) && numericBalance > 0;
  const hasYieldPosition =
    !yieldPositionLoading &&
    !yieldPositionError &&
    yieldPositionUsd !== null &&
    !Number.isNaN(numericYieldPosition) &&
    numericYieldPosition > 0;
  const suggestedDepositAmount = numericBalance !== null && !Number.isNaN(numericBalance)
    ? getSuggestedYieldDepositAmount(numericBalance, 0.6)
    : '0.00';
  const homeSuggestion = getHomeGenieSuggestion({
    balanceAmount: numericBalance,
    suggestedDepositAmount,
    userId,
  });

  return (
    <>
    <div className="flex flex-col bg-background text-white font-body overflow-hidden h-full">
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>

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
            window.sessionStorage.setItem(HOME_CHAT_SEED_STORAGE_KEY, JSON.stringify({
              userId,
              message: homeSuggestion.message,
              followUp: homeSuggestion.followUp,
              createdAt: Date.now(),
            }));
            router.push('/chat');
          }}
          className="flex items-end gap-2 w-full text-left"
        >
          <div className="flex-shrink-0 w-20 h-24 self-end">
            <img
              src="/genie.png"
              alt="Genie"
              className="w-full h-full object-contain"
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
          <div className="relative flex-1 min-w-0 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white break-words">
            <span
              className="absolute bottom-5 -left-[9px] w-0 h-0"
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '10px solid #171717',
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
            <p className="text-sm leading-relaxed">{homeSuggestion.message}</p>
          </div>
        </button>
      </div>

      {/* ── Total Balance ── */}
      <div className="px-6 mb-6">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
          Total Balance
        </p>
        {balanceLoading ? (
          <div className="h-12 w-32 bg-white/10 animate-pulse rounded" />
        ) : balanceError ? (
          <p className="font-headline text-5xl font-extrabold tracking-tighter text-white/30">$--.--</p>
        ) : (
          <p className="font-headline text-5xl font-extrabold tracking-tighter text-white">
            ${balance ?? '0.00'}
          </p>
        )}
      </div>

      {hasYieldPosition ? (
        <div className="px-6 mb-8">
          <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
            Yield Position
          </p>
          <div className="bg-surface rounded-[24px] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
                  {RE7_USDC_VAULT_PROVIDER}
                </p>
                <h3 className="mt-2 font-headline text-2xl font-extrabold tracking-tighter text-white">
                  ${yieldPositionUsd}
                </h3>
                <p className="mt-2 text-sm text-white/55">
                  Current estimated asset value in the vault.
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 px-4 py-3 text-right min-w-[110px]">
                <p className="text-[11px] uppercase tracking-widest text-white/35">APR</p>
                <p className="mt-2 font-headline text-lg font-bold text-white">{RE7_USDC_VAULT_APR}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-white/55">
              <span>Vault shares</span>
              <span>{yieldShares ? Number(yieldShares).toFixed(2) : '0.00'}</span>
            </div>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => {
                  if (hasUsdcToDeposit) {
                    setShowYieldPreview(true);
                  }
                }}
                disabled={!hasUsdcToDeposit}
                className="w-full rounded-full border border-accent/30 bg-accent px-6 py-4 text-base font-headline font-black tracking-[0.04em] text-black shadow-[0_0_0_4px_rgba(204,255,0,0.08)] disabled:opacity-60"
              >
                Add to yield position
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Money Lent ── */}
      <div className="px-6 mt-8">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
          Current Loans
        </p>
        <div className="flex flex-col divide-y divide-white/5">
          {debtLoading ? (
            <div className="py-4 flex flex-col gap-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 bg-white/5 animate-pulse rounded" />
              ))}
            </div>
          ) : debtError ? (
            <p className="py-4 text-sm text-red-400">Could not load money lent.</p>
          ) : debts.length === 0 ? (
            <p className="py-4 text-sm text-white/40">No open loans to collect.</p>
          ) : (
            debts.map((debt) => (
              <div key={debt.id} className="flex items-center justify-between py-4">
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
                      Expected by {formatExpectedCollectionDate(debt.createdAt)}
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
      <div className="px-6 mt-8">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
          Recent Transactions
        </p>
        <div className="flex flex-col divide-y divide-white/5">
          {txLoading ? (
            <div className="py-4 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-white/5 animate-pulse rounded" />
              ))}
            </div>
          ) : recentTransactions.length === 0 ? (
            <p className="py-4 text-sm text-white/40">No transactions yet</p>
          ) : (
            recentTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-white/40 text-base">
                      arrow_upward
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Sent to {formatWallet(tx.recipientWallet)}
                    </p>
                    <p className="text-[11px] text-white/40">{formatRelativeTime(tx.createdAt)}</p>
                  </div>
                </div>
                <p className="font-headline font-bold text-sm text-white/60">
                  -{parseFloat(tx.amountUsd).toFixed(2)} USDC
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="px-6 mt-8 mb-8 grid grid-cols-3 gap-3">
        {[
          { label: 'Send', icon: 'north_east', onClick: () => setShowSend(true) },
          { label: 'Receive', icon: 'south_west', onClick: () => setShowReceive(true) },
          { label: 'Add Funds', icon: 'add', onClick: () => setShowAddFunds(true) },
        ].map(({ label, icon, onClick }) => (
          <button
            key={label}
            onClick={onClick}
            className="flex flex-col items-center gap-2 bg-surface py-4 active:scale-95 transition-transform duration-150"
          >
            <span className="material-symbols-outlined text-accent text-xl">{icon}</span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-white/60 font-bold">
              {label}
            </span>
          </button>
        ))}
      </div>

    </div>
    </div>
      {showSend && (
        <SendModal
          onClose={() => { setShowSend(false); refetchBalance(); }}
          userId={session?.user?.id ?? ''}
          refetchBalance={refetchBalance}
        />
      )}
      {showReceive && walletAddress && (
        <ReceiveModal address={walletAddress} onClose={() => setShowReceive(false)} />
      )}
      {showAddFunds && walletAddress && (
        <AddFundsModal address={walletAddress} onClose={() => setShowAddFunds(false)} />
      )}
      {showYieldPreview && (
        <YieldDepositModal
          isOpen={showYieldPreview}
          walletAddress={walletAddress}
          balanceAmount={numericBalance}
          defaultAmount={suggestedDepositAmount}
          suggestionLabel="Genie suggests parking 60% of your idle USDC in yield."
          requiresVerification={!demoVerified}
          onClose={() => setShowYieldPreview(false)}
          onSuccess={() => {
            refetchBalance();
            refetchYieldPosition();
          }}
        />
      )}
    </>
  );
};
