'use client';

import { useState } from 'react';
import { Verify } from '../Verify';

// TODO: replace with real data from API
const MOCK_OLD_TRANSACTIONS = [
  { id: '1', label: 'Sent to 0x…3a9f', amount: '-$12.00', date: 'Mar 18, 2025', positive: false },
  { id: '2', label: 'Received USDC', amount: '+$50.00', date: 'Mar 10, 2025', positive: true },
  { id: '3', label: 'Add Funds', amount: '+$100.00', date: 'Feb 28, 2025', positive: true },
  { id: '4', label: 'Sent to 0x…b72c', amount: '-$8.50', date: 'Feb 14, 2025', positive: false },
  { id: '5', label: 'Received USDC', amount: '+$25.00', date: 'Jan 30, 2025', positive: true },
];

export const ProfileInterface = () => {
  // TODO: initialise from session / user API
  const [displayName, setDisplayName] = useState('');
  const [spendingLimit, setSpendingLimit] = useState('');
  const [limitSaved, setLimitSaved] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const handleSaveName = () => {
    if (!displayName.trim()) return;
    // TODO: persist to user profile API
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
  };

  const handleSaveLimit = () => {
    const val = parseFloat(spendingLimit);
    if (isNaN(val) || val <= 0) return;
    // TODO: persist spending limit to agent config API
    setLimitSaved(true);
    setTimeout(() => setLimitSaved(false), 2000);
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

      {/* ── Display Name ── */}
      <Section label="Your Name">
        <div className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Enter your name"
            className="flex-1 bg-transparent px-4 py-3 text-white placeholder:text-white/30 outline-none"
            style={{ fontSize: '16px' }}
          />
          <button
            onClick={handleSaveName}
            className="px-5 bg-accent text-black font-headline font-extrabold text-xs uppercase tracking-widest active:scale-95 transition-transform"
          >
            {nameSaved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </Section>

      {/* ── Agent Spending Limit ── */}
      <Section label="Agent Spending Limit">
        <p className="text-xs text-white/40 mb-3 leading-relaxed">
          Set the maximum amount Genie can spend per transaction on your behalf.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 flex items-center bg-transparent px-4">
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
            className="px-5 bg-accent text-black font-headline font-extrabold text-xs uppercase tracking-widest active:scale-95 transition-transform"
          >
            {limitSaved ? 'Saved!' : 'Set'}
          </button>
        </div>
        {spendingLimit && !isNaN(parseFloat(spendingLimit)) && (
          <p className="mt-2 text-[11px] text-accent/70">
            Genie will ask for approval on anything above ${parseFloat(spendingLimit).toFixed(2)} USDC.
          </p>
        )}
      </Section>

      {/* ── Transaction History ── */}
      <Section label="Transaction History">
        <p className="text-xs text-white/40 mb-4">Full history of past activity.</p>
        {/* TODO: replace with paginated API results */}
        <div className="flex flex-col divide-y divide-white/5">
          {MOCK_OLD_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white/40 text-base">
                    {tx.positive ? 'arrow_downward' : 'arrow_upward'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{tx.label}</p>
                  <p className="text-[11px] text-white/40">{tx.date}</p>
                </div>
              </div>
              <p
                className={`font-headline font-bold text-sm ${
                  tx.positive ? 'text-accent' : 'text-white/60'
                }`}
              >
                {tx.amount}
              </p>
            </div>
          ))}
        </div>
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
      <div className="bg-surface p-4">
        {children}
      </div>
    </div>
  );
}
