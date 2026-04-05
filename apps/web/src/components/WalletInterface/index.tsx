'use client';
import { useSession } from 'next-auth/react';
import { useBalance } from '@/hooks/useBalance';
import { useTransactions } from '@/hooks/useTransactions';
import { Verify } from '@/components/Verify';
import { formatRelativeTime, formatWallet } from '@/lib/format';
import { useState } from 'react';

export const WalletInterface = () => {
  const { data: session } = useSession();
  const walletAddress = session?.user?.walletAddress ?? '';
  const userId = session?.user?.id ?? '';
  const [isVerified, setIsVerified] = useState(false);
  const { balance, loading: balanceLoading, error: balanceError } = useBalance(walletAddress);
  const { transactions, loading: txLoading } = useTransactions(userId);

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col p-6 pb-[100px]">

      {/* Header */}
      <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-white mb-8">
        Wallet
      </h1>

      {/* Black Card */}
      <div className="relative w-full aspect-[1.586/1] bg-[#171717] border border-white/10 rounded-2xl p-6 flex flex-col justify-between overflow-hidden mb-8">
        {/* Card top row */}
        <div className="flex items-center justify-between">
          <span className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40">
            World App
          </span>
          {/* Chip SVG */}
          <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0.5" y="0.5" width="35" height="27" rx="3.5" stroke="white" strokeOpacity="0.2" fill="none" />
            <rect x="12" y="0.5" width="12" height="27" stroke="white" strokeOpacity="0.12" fill="none" />
            <rect x="0.5" y="9" width="35" height="10" stroke="white" strokeOpacity="0.12" fill="none" />
            <rect x="12" y="9" width="12" height="10" fill="white" fillOpacity="0.06" />
          </svg>
        </div>

        {/* Card number placeholder */}
        <div className="flex flex-col gap-2">
          <p className="font-mono text-sm tracking-[0.3em] text-white/30">
            •••• •••• •••• 0000
          </p>
          <p className="font-headline text-xs uppercase tracking-widest text-white/40">
            USDC
          </p>
        </div>

        {/* Decorative corner accent */}
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full border border-[#CCFF00]/10" />
        <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full border border-[#CCFF00]/5" />
      </div>

      {/* Live Balance */}
      <div className="mb-10">
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
        <p className="font-headline text-sm font-bold text-[#CCFF00] tracking-widest uppercase mt-1">
          USDC
        </p>
      </div>

      {/* Verify with World ID — only shown for unverified users */}
      {!isVerified && (
        <div className="px-0 mb-6">
          <div className="bg-surface rounded-2xl p-5">
            <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
              Unlock More Features
            </p>
            <p className="text-sm text-white/60 mb-4">
              Verify with World ID to unlock sending and debt tracking.
            </p>
            <Verify onVerified={() => setIsVerified(true)} />
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="mb-10">
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
          ) : transactions.length === 0 ? (
            <p className="py-4 text-sm text-white/40">No transactions yet</p>
          ) : (
            transactions.map((tx) => (
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

      {/* Add Funds Button */}
      <button className="w-full bg-[#CCFF00] text-black font-headline font-extrabold text-sm uppercase tracking-widest py-4 active:scale-95 transition-transform duration-150">
        Add Funds
      </button>

    </div>
  );
};
