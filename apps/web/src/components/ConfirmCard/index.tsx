'use client';
import { useEffect, useState } from 'react';

export interface ConfirmCardData {
  type: 'confirmation_required';
  txId: string;
  amount: number;
  recipient: string;
  recipientWallet?: string;
  expiresInMinutes: number;
}

export function parseConfirmCard(text: string): ConfirmCardData | null {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.type === 'confirmation_required' && parsed.txId && parsed.amount) {
      return parsed as ConfirmCardData;
    }
  } catch { /* not valid JSON, render as markdown */ }
  return null;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export const ConfirmCard: React.FC<{ data: ConfirmCardData; userId: string }> = ({ data, userId }) => {
  const [state, setState] = useState<'idle' | 'loading' | 'confirmed' | 'cancelled' | 'expired' | 'error'>('idle');
  const [secondsLeft, setSecondsLeft] = useState(data.expiresInMinutes * 60);
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');

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
    setState('loading');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId: data.txId, userId }),
      });
      const json = await res.json();
      if (res.ok) {
        setState('confirmed');
        setTxHash(json.txHash ?? '');
      } else if (res.status === 409) {
        setState('confirmed');
        setTxHash(json.txHash ?? '');
      } else if (res.status === 410) {
        setState('expired');
      } else {
        setError(json.message ?? json.error ?? 'Transfer failed');
        setState('error');
      }
    } catch {
      setError('Network error - please try again');
      setState('error');
    }
  };

  const handleCancel = () => {
    setState('cancelled');
  };

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const countdown = `${mins}:${String(secs).padStart(2, '0')}`;

  const displayAddr = data.recipientWallet ?? data.recipient;

  return (
    <div className="mt-3 bg-background border border-white/10 p-4 rounded-xl">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-accent text-base">account_balance_wallet</span>
        <span className="text-xs uppercase tracking-widest text-white/50">Confirm Transfer</span>
      </div>

      {/* Amount */}
      <p className="text-2xl font-bold text-white">${data.amount} USDC</p>

      {/* Recipient */}
      <p className="text-sm text-white/60 mb-4">To: {truncateAddress(displayAddr)}</p>

      {/* State-dependent rendering */}
      {state === 'idle' && (
        <>
          <p className="text-white/40 text-xs mb-3">Expires in {countdown}</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="bg-accent text-black px-6 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg"
            >
              Confirm
            </button>
            <button
              onClick={handleCancel}
              className="border border-white/20 text-white/70 px-6 py-2.5 text-sm rounded-lg"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {state === 'loading' && (
        <div className="flex gap-2">
          <button
            disabled
            className="bg-accent text-black px-6 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg opacity-70 cursor-not-allowed"
          >
            Confirming...
          </button>
          <button
            disabled
            className="border border-white/20 text-white/70 px-6 py-2.5 text-sm rounded-lg opacity-70 cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      )}

      {state === 'confirmed' && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-accent text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            <p className="text-sm font-bold text-white">Sent ${data.amount} USDC</p>
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
        <p className="text-white/50 text-sm">Expired</p>
      )}

      {state === 'error' && (
        <>
          <p className="text-red-400 text-xs mb-3">{error}</p>
          <div className="flex gap-2">
            <button
              onClick={handleConfirm}
              className="bg-accent text-black px-6 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg"
            >
              Retry
            </button>
            <button
              onClick={handleCancel}
              className="border border-white/20 text-white/70 px-6 py-2.5 text-sm rounded-lg"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
};
