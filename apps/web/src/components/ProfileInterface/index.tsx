'use client';

import { getPublicApiUrl } from '@/lib/backend-url';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTransactions } from '@/hooks/useTransactions';
import { Verify } from '../Verify';

function formatWallet(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const ProfileInterface = () => {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? '';
  // TODO: initialise from session / user API
  const [spendingLimit, setSpendingLimit] = useState('');
  const [limitSaved, setLimitSaved] = useState(false);
  const [limitError, setLimitError] = useState('');
  const [showAllTx, setShowAllTx] = useState(false);
  const { transactions, loading: txLoading, error: txError } = useTransactions(userId);
  const visibleTransactions = showAllTx ? transactions : transactions.slice(0, 4);

  const saveLimit = async (val: number) => {
    const userId = session?.user?.id;
    if (!userId) {
      setLimitError('Sign in before setting a spending limit');
      return;
    }

    const res = await fetch(getPublicApiUrl('/api/users/profile'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, autoApproveUsd: val }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({ message: 'Failed to save' }));
      throw new Error(json.message ?? 'Failed to save');
    }
  };

  const handleSaveLimit = async () => {
    const val = parseFloat(spendingLimit);
    if (isNaN(val) || val <= 0) return;

    setLimitError('');
    setLimitSaved(false);

    try {
      await saveLimit(val);
      setLimitSaved(true);
      setTimeout(() => setLimitSaved(false), 2000);
    } catch (err) {
      setLimitError(err instanceof Error ? err.message : 'Network error — please try again');
    }
  };

  return (
    <div className="flex flex-col bg-background text-white font-body overflow-hidden h-full">
    <div className="flex-1 overflow-y-auto overscroll-contain" style={{ touchAction: 'pan-y' }}>
      {/* ── Header ── */}
      <div className="px-6 pt-10 pb-6">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
          Account
        </p>
        <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-white">
          Profile
        </h1>
      </div>

      {/* ── Identity / World ID ── */}
      <Section label="Identity">
        <p className="text-xs text-white/40 mb-4 leading-relaxed">
          Verify your humanity with World ID to unlock send money, debt tracking, and agent automation.
        </p>
        <Verify />
      </Section>

      {/* ── Agent Spending Limit ── */}
      <Section label="Agent Spending Limit">
        <p className="text-xs text-white/40 mb-3 leading-relaxed">
          Set the maximum amount Genie can spend per transaction on your behalf.
        </p>
        <div className="flex gap-2 w-full overflow-hidden">
          <div className="flex-1 min-w-0 flex items-center bg-transparent px-4">
            <span className="text-white/40 text-sm font-bold mr-1 flex-shrink-0">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={spendingLimit}
              onChange={(e) => setSpendingLimit(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-transparent py-3 text-white placeholder:text-white/30 outline-none appearance-none"
              style={{ fontSize: '16px' }}
            />
          </div>
          <button
            onClick={handleSaveLimit}
            className="flex-shrink-0 min-w-[64px] px-4 py-3 bg-transparent border border-accent text-accent font-headline font-extrabold text-xs uppercase tracking-widest active:scale-95 transition-transform text-center whitespace-nowrap rounded-lg"
          >
            {limitSaved ? 'Saved!' : 'Set'}
          </button>
        </div>
        {spendingLimit && !isNaN(parseFloat(spendingLimit)) && (
          <p className="mt-2 text-[11px] text-accent/70">
            Genie will store ${parseFloat(spendingLimit).toFixed(2)} as your preferred spend threshold while Permit2 authorization is being built.
          </p>
        )}
        {limitError && (
          <p className="mt-2 text-[11px] text-red-400">{limitError}</p>
        )}
      </Section>

      {/* ── Transaction History ── */}
      <Section label="Transaction History">
        <p className="text-xs text-white/40 mb-4">Full history of past activity.</p>
        <div className="flex flex-col divide-y divide-white/5">
          {txLoading ? (
            <div className="py-4 flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-white/5 animate-pulse rounded" />
              ))}
            </div>
          ) : txError ? (
            <p className="py-4 text-sm text-red-400">Could not load transaction history.</p>
          ) : visibleTransactions.length === 0 ? (
            <p className="py-4 text-sm text-white/40">No transactions yet</p>
          ) : (
            visibleTransactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0 rounded-lg">
                    <span className="material-symbols-outlined text-white/40 text-base">
                      arrow_upward
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      Sent to {formatWallet(tx.recipientWallet)}
                    </p>
                    <p className="text-[11px] text-white/40">
                      {formatDate(tx.createdAt)}
                      {tx.status !== 'confirmed' ? ` • ${tx.status}` : ''}
                    </p>
                  </div>
                </div>
                <p className="font-headline font-bold text-sm text-white/60">
                  -{parseFloat(tx.amountUsd).toFixed(2)} USDC
                </p>
              </div>
            ))
          )}
        </div>
        {transactions.length > 4 && (
          <button
            onClick={() => setShowAllTx((v) => !v)}
            className="mt-2 w-full py-3 text-[11px] font-headline font-bold uppercase tracking-widest text-accent/70 active:text-accent transition-colors"
          >
            {showAllTx ? 'Show Less' : `See All Transactions (${transactions.length})`}
          </button>
        )}
      </Section>
    </div>
    </div>
  );
};

/* ── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-6 mb-8">
      <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-4">
        {label}
      </p>
      <div className="bg-surface p-4 overflow-hidden rounded-xl">
        {children}
      </div>
    </div>
  );
}
