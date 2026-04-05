'use client';

import { AddFundsModal } from '@/components/AddFundsModal';
import { ReceiveModal } from '@/components/ReceiveModal';
import { SendModal } from '@/components/SendModal';
import { useBalance } from '@/hooks/useBalance';
import { useTransactions } from '@/hooks/useTransactions';
import { formatRelativeTime, formatWallet } from '@/lib/format';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const GENIE_SUMMARY =
  "Saving for a trip? I can help you limit dining out spend to get there faster.";

export const DashboardInterface = () => {
  const { data: session } = useSession();
  const router = useRouter();

  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showAddFunds, setShowAddFunds] = useState(false);
  const walletAddress = session?.user?.walletAddress ?? '';
  const userId = session?.user?.id ?? '';
  const { balance, loading: balanceLoading, error: balanceError, refetch: refetchBalance } = useBalance(walletAddress);
  const { transactions, loading: txLoading } = useTransactions(userId);

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
      <div className="flex items-end gap-3 px-6 mb-8">
        {/* Genie — tap to open chat */}
        <button
          onClick={() => router.push('/chat')}
          className="flex-shrink-0 w-20 h-24 self-end active:opacity-70 transition-opacity duration-150"
        >
          <img
            src="/genie.png"
            alt="Genie"
            className="w-full h-full object-contain"
            style={{ mixBlendMode: 'screen' }}
          />
        </button>

        {/* Speech bubble — tap to open chat */}
        <button
          onClick={() => router.push('/chat')}
          className="relative flex-1 min-w-0 bg-surface p-5 rounded-t-2xl rounded-br-2xl text-white break-words text-left active:opacity-70 transition-opacity duration-150"
        >
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
          <p className="text-sm leading-relaxed">{GENIE_SUMMARY}</p>
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

      {/* ── Quick actions ── */}
      <div className="px-6 mb-8 grid grid-cols-3 gap-3">
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

      {/* ── Recent Transactions ── */}
      <div className="px-6">
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
                      {tx.direction === 'received' ? 'arrow_downward' : 'arrow_upward'}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {tx.direction === 'received'
                        ? `Received from ${formatWallet(tx.recipientWallet)}`
                        : `Sent to ${formatWallet(tx.recipientWallet)}`}
                    </p>
                    <p className="text-[11px] text-white/40">{formatRelativeTime(tx.createdAt)}</p>
                  </div>
                </div>
                <p className={`font-headline font-bold text-sm ${tx.direction === 'received' ? 'text-[#CCFF00]' : 'text-white/60'}`}>
                  {tx.direction === 'received' ? '+' : '-'}{parseFloat(tx.amountUsd).toFixed(2)} USDC
                </p>
              </div>
            ))
          )}
        </div>
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
    </>
  );
};
