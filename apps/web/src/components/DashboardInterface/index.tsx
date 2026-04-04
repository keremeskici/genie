'use client';

// Prototype: balance, card, and transactions will be populated from API endpoints
// once the backend (transaction history + balance) is connected.

const MOCK_TRANSACTIONS = [
  { id: '1', label: 'Received USDC', amount: '+$0.00', time: 'Today', positive: true },
  { id: '2', label: 'Sent to 0x…a1f2', amount: '-$0.00', time: 'Yesterday', positive: false },
  { id: '3', label: 'Add Funds', amount: '+$0.00', time: '2 days ago', positive: true },
];

const GENIE_SUMMARY =
  "Your wallet is all set. Add funds and I'll track every move for you.";

export const DashboardInterface = () => {
  return (
    <div className="flex flex-col bg-background text-white font-body overflow-y-auto pb-[108px]" style={{ minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <div className="px-6 pt-10 pb-4">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
          Overview
        </p>
        <h1 className="font-headline text-2xl font-extrabold tracking-tighter text-white">
          Dashboard
        </h1>
      </div>

      {/* ── Genie finance summary ── */}
      <div className="flex items-end gap-3 px-6 mb-8">
        {/* Genie */}
        <div className="flex-shrink-0 w-20 h-24 self-end">
          <img
            src="/genie.png"
            alt="Genie"
            className="w-full h-full object-contain"
            style={{ mixBlendMode: 'screen' }}
          />
        </div>

        {/* Speech bubble */}
        <div className="relative flex-1 bg-surface p-4 rounded-t-2xl rounded-br-2xl">
          {/* Tail pointing left toward genie */}
          <span
            className="absolute bottom-5 -left-[9px] w-0 h-0"
            style={{
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '10px solid #171717',
            }}
          />
          <div className="flex items-center gap-2 mb-2">
            <span
              className="material-symbols-outlined text-accent text-base"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <span className="font-headline text-[10px] uppercase tracking-widest text-accent font-bold">
              Genie
            </span>
          </div>
          {/* TODO: replace with live finance summary from API */}
          <p className="text-sm text-white/80 leading-relaxed">{GENIE_SUMMARY}</p>
        </div>
      </div>

      {/* ── Total Balance ── */}
      <div className="px-6 mb-6">
        <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
          Total Balance
        </p>
        {/* TODO: replace $0.00 with live balance from API */}
        <p className="font-headline text-5xl font-extrabold tracking-tighter text-white">
          $0.00
        </p>
        <p className="font-headline text-sm font-bold text-accent tracking-widest uppercase mt-1">
          USDC
        </p>
      </div>

      {/* ── Card (below balance) ── */}
      <div className="px-6 mb-8">
        <div className="relative w-full aspect-[1.586/1] bg-surface border border-white/10 rounded-2xl p-6 flex flex-col justify-between overflow-hidden">
          {/* Top row */}
          <div className="flex items-center justify-between">
            <span className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40">
              World App
            </span>
            <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
              <rect x="0.5" y="0.5" width="35" height="27" rx="3.5" stroke="white" strokeOpacity="0.2" fill="none" />
              <rect x="12" y="0.5" width="12" height="27" stroke="white" strokeOpacity="0.12" fill="none" />
              <rect x="0.5" y="9" width="35" height="10" stroke="white" strokeOpacity="0.12" fill="none" />
              <rect x="12" y="9" width="12" height="10" fill="white" fillOpacity="0.06" />
            </svg>
          </div>
          {/* Card number */}
          <div className="flex flex-col gap-2">
            <p className="font-mono text-sm tracking-[0.3em] text-white/30">
              •••• •••• •••• 0000
            </p>
            <p className="font-headline text-xs uppercase tracking-widest text-white/40">
              USDC
            </p>
          </div>
          {/* Decorative rings */}
          <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full border border-accent/10" />
          <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full border border-accent/5" />
        </div>
      </div>

      {/* ── Quick actions ── */}
      <div className="px-6 mb-8 grid grid-cols-3 gap-3">
        {[
          { label: 'Send', icon: 'north_east' },
          { label: 'Receive', icon: 'south_west' },
          { label: 'Add Funds', icon: 'add' },
        ].map(({ label, icon }) => (
          <button
            key={label}
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
        {/* TODO: replace with live transactions from API */}
        <div className="flex flex-col divide-y divide-white/5">
          {MOCK_TRANSACTIONS.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-surface flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-white/40 text-base">
                    {tx.positive ? 'arrow_downward' : 'arrow_upward'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{tx.label}</p>
                  <p className="text-[11px] text-white/40">{tx.time}</p>
                </div>
              </div>
              <p className={`font-headline font-bold text-sm ${tx.positive ? 'text-accent' : 'text-white/60'}`}>
                {tx.amount}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
