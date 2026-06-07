'use client';
import { getPublicApiUrl } from '@/lib/backend-url';
import { MiniKit } from '@worldcoin/minikit-js';
import { useEffect, useState } from 'react';

export interface ConfirmCardData {
  type: 'confirmation_required';
  txId: string;
  /** What kind of action this preview represents. Defaults to "send". */
  action?: 'send' | 'deposit' | 'swap';
  amount: number;
  /** Token symbol, e.g. "USDC". Defaults to "USDC". */
  token?: string;
  /** Where the funds come from, e.g. "Genie Vault". */
  fromLabel?: string;
  recipient: string;
  /** Friendly recipient name (contact name) when known. */
  recipientName?: string;
  /** Legacy field — older payloads carried the address here. */
  recipientWallet?: string;
  /** What the payment is for, e.g. "dinner". */
  description?: string;
  expiresInMinutes: number;
}

export function parseConfirmCard(text: string): ConfirmCardData | null {
  const matches = text.matchAll(/```json\s*\n([\s\S]*?)\n```/g);
  for (const match of matches) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.type === 'confirmation_required' && parsed.txId && typeof parsed.amount === 'number') {
        return parsed as ConfirmCardData;
      }
    } catch { /* not valid JSON, render as markdown */ }
  }
  return null;
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 11) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const ACTION_LABELS: Record<NonNullable<ConfirmCardData['action']>, string> = {
  send: 'Confirm Transfer',
  deposit: 'Confirm Deposit',
  swap: 'Confirm Swap',
};

/** Small token chip (coin glyph + symbol) — mirrors the Minara preview style. */
function TokenChip({ symbol }: { symbol: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold text-white">
      <span
        className="material-symbols-outlined text-accent text-base leading-none"
        style={{ fontVariationSettings: "'FILL' 1" }}
      >
        monetization_on
      </span>
      {symbol}
    </span>
  );
}

export const ConfirmCard: React.FC<{
  data: ConfirmCardData;
  userId: string;
  initialState?: 'idle' | 'cancelled';
  onCancel?: () => void;
}> = ({ data, userId, initialState = 'idle', onCancel }) => {
  const [state, setState] = useState<'idle' | 'loading' | 'confirmed' | 'cancelled' | 'expired' | 'error'>(initialState);
  const [secondsLeft, setSecondsLeft] = useState(data.expiresInMinutes * 60);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

  const token = data.token ?? 'USDC';
  const fromLabel = data.fromLabel ?? 'Genie Vault';
  const action = data.action ?? 'send';
  const displayAddr = data.recipientWallet ?? data.recipient;
  const toName = data.recipientName ?? 'Recipient';
  const amountText = formatAmount(data.amount);

  useEffect(() => {
    if (state !== 'idle') return;
    const endTime = Date.now() + data.expiresInMinutes * 60 * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setState('expired');
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [state, data.expiresInMinutes]);

  const handleConfirm = async () => {
    if (MiniKit.isInstalled()) {
      MiniKit.sendHapticFeedback({ hapticsType: 'impact', style: 'medium' }).catch(() => {});
    }
    setState('loading');
    try {
      // Custodial: confirming executes the transfer server-side (no wallet signature).
      const res = await fetch(getPublicApiUrl('/api/confirm'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId: data.txId, userId }),
      });

      const json = await res.json();

      if (res.ok || res.status === 409) {
        setState('confirmed');
        setTxHash(json.txHash ?? '');
        return;
      }
      if (res.status === 410) {
        setState('expired');
        return;
      }

      setError(json.message ?? json.error ?? 'Transfer failed');
      setState('error');
    } catch (err) {
      console.error('[ConfirmCard] confirm failed', err);
      setError(err instanceof Error ? err.message : 'Network error - please try again');
      setState('error');
    }
  };

  const handleCancel = () => {
    if (MiniKit.isInstalled()) {
      MiniKit.sendHapticFeedback({ hapticsType: 'selection-changed' }).catch(() => {});
    }
    setState('cancelled');
    onCancel?.();
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <div className="mt-3 bg-background border border-white/10 p-4 rounded-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-accent text-base">account_balance_wallet</span>
          <span className="text-xs uppercase tracking-widest text-white/50 truncate">
            {ACTION_LABELS[action]}
          </span>
        </div>
        {state === 'idle' && (
          <span className="flex items-center gap-1 text-[11px] text-white/40 flex-shrink-0">
            <span className="material-symbols-outlined text-[13px] leading-none">schedule</span>
            {countdown}
          </span>
        )}
      </div>

      {/* From → To preview panel */}
      <div className="rounded-lg bg-surface px-3.5 py-3 mb-3">
        <div className="flex items-start gap-2">
          {/* From */}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-white/40 mb-1.5 truncate">From {fromLabel}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold text-red-400 tabular-nums">-{amountText}</span>
              <TokenChip symbol={token} />
            </div>
          </div>

          {/* Arrow */}
          <span className="material-symbols-outlined text-white/30 text-lg leading-none mt-5 flex-shrink-0">
            arrow_forward
          </span>

          {/* To */}
          <div className="flex-1 min-w-0 text-right">
            <p className="text-[11px] text-white/40 mb-1.5 truncate">To {toName}</p>
            <div className="flex items-center justify-end gap-1.5">
              <span className="text-base font-bold text-accent tabular-nums">+{amountText}</span>
              <TokenChip symbol={token} />
            </div>
            <p className="text-[10px] text-white/30 font-mono truncate mt-1">{truncateAddress(displayAddr)}</p>
          </div>
        </div>
      </div>

      {data.description && (
        <p className="text-[11px] text-white/45 mb-1">For: {data.description}</p>
      )}
      <p className="text-[11px] text-white/40 mb-4 leading-relaxed">
        Genie will send this from your vault on your behalf — no wallet popup.
      </p>

      {/* State-dependent action area */}
      {state === 'idle' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleConfirm}
            className="min-w-0 bg-accent text-black px-3 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg active:scale-95 transition-transform"
          >
            Yes
          </button>
          <button
            onClick={handleCancel}
            className="min-w-0 border border-white/20 text-white/70 px-3 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg active:scale-95 transition-transform"
          >
            No
          </button>
        </div>
      )}

      {state === 'loading' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled
            className="min-w-0 bg-accent text-black px-3 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg opacity-70 cursor-not-allowed"
          >
            Sending...
          </button>
          <button
            disabled
            className="min-w-0 border border-white/20 text-white/70 px-3 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg opacity-70 cursor-not-allowed"
          >
            No
          </button>
        </div>
      )}

      {state === 'confirmed' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-accent text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="text-sm font-bold text-white">Sent ${amountText} {token}</p>
          </div>
          {txHash && (
            <p className="text-white/40 text-xs font-mono truncate">{txHash}</p>
          )}
        </div>
      )}

      {state === 'cancelled' && (
        <p className="text-white/50 text-sm">Cancelled</p>
      )}

      {state === 'expired' && (
        <p className="text-white/50 text-sm">This confirmation expired. Ask Genie to send again.</p>
      )}

      {state === 'error' && (
        <>
          <p className="text-red-400 text-xs mb-3">{error}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleConfirm}
              className="min-w-0 bg-accent text-black px-3 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg active:scale-95 transition-transform"
            >
              Retry
            </button>
            <button
              onClick={handleCancel}
              className="min-w-0 border border-white/20 text-white/70 px-3 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg active:scale-95 transition-transform"
            >
              No
            </button>
          </div>
        </>
      )}
    </div>
  );
};
