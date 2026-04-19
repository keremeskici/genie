'use client';

import { ConfirmCard, type ConfirmCardData } from '@/components/ConfirmCard';
import { getPublicApiUrl } from '@/lib/backend-url';
import {
  executeMiniKitTransactions,
  extractMiniKitTransactionHash,
  isWalletTransactionRequiredResponse,
  worldChainReceiptClient,
} from '@/lib/minikit';
import { useUserOperationReceipt } from '@worldcoin/minikit-react';
import { useEffect, useState } from 'react';

type ChainOption = 'World Chain' | 'Base' | 'Arbitrum' | 'Ethereum' | 'Optimism';

const CHAIN_OPTIONS: { value: ChainOption; label: string }[] = [
  { value: 'World Chain', label: 'World Chain (instant)' },
  { value: 'Base', label: 'Base (~15 min)' },
  { value: 'Arbitrum', label: 'Arbitrum (~15 min)' },
  { value: 'Ethereum', label: 'Ethereum (~15 min)' },
  { value: 'Optimism', label: 'Optimism (~15 min)' },
];

interface SendModalProps {
  onClose: () => void;
  userId: string;
  refetchBalance?: () => void;
}

export function SendModal({ onClose, userId, refetchBalance }: SendModalProps) {
  const [visible, setVisible] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [selectedChain, setSelectedChain] = useState<ChainOption>('World Chain');
  const [confirmData, setConfirmData] = useState<ConfirmCardData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const { poll, isLoading } = useUserOperationReceipt({ client: worldChainReceiptClient });

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const submitSend = async () => {
    return fetch(getPublicApiUrl('/api/send'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        recipient: recipient.trim(),
        amount: parseFloat(amount),
        chain: selectedChain,
      }),
    });
  };

  const handleSend = async () => {
    if (!recipient.trim() || !amount || parseFloat(amount) <= 0) return;
    setErrorMessage('');
    setStatus('sending');

    try {
      let res = await submitSend();
      let json = await res.json();

      if (!res.ok) {
        setErrorMessage(json.message ?? json.error ?? 'Transaction failed. Try again.');
        setStatus('error');
        setTimeout(() => setStatus('idle'), 2500);
        return;
      }

      if (isWalletTransactionRequiredResponse(json)) {
        const { userOpHash } = await executeMiniKitTransactions(json.txPlan);
        const receipt = await poll(userOpHash);
        const finalHash = extractMiniKitTransactionHash(receipt) ?? userOpHash;

        const finalizeRes = await fetch(getPublicApiUrl('/api/confirm'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ txId: json.txId, userId, txHash: finalHash }),
        });
        const finalizeJson = await finalizeRes.json();

        if (!finalizeRes.ok && finalizeRes.status !== 409) {
          setErrorMessage(finalizeJson.message ?? finalizeJson.error ?? 'Transaction failed. Try again.');
          setStatus('error');
          setTimeout(() => setStatus('idle'), 2500);
          return;
        }

        setStatus('success');
        refetchBalance?.();
        setTimeout(handleClose, 1500);
      } else if (json.type === 'transfer_complete') {
        setStatus('success');
        refetchBalance?.();
        setTimeout(handleClose, 1500);
      } else if (json.type === 'bridge_initiated') {
        setStatus('success');
        refetchBalance?.();
        setTimeout(handleClose, 2000);
      } else if (json.type === 'confirmation_required') {
        setConfirmData(json as ConfirmCardData);
        setStatus('idle');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Transaction failed. Try again.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const canSend = recipient.trim().length > 0 && parseFloat(amount) > 0 && status === 'idle' && !isLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 touch-none"
      style={{
        touchAction: 'none',
        backgroundColor: `rgba(0,0,0,${visible ? 0.7 : 0})`,
        transition: 'background-color 220ms ease',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm bg-surface px-5 pt-5 pb-6 flex flex-col gap-5"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
          transition: 'opacity 220ms ease, transform 220ms ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {confirmData ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
                Confirm Transfer
              </span>
              <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center text-white/40 active:text-white" aria-label="Close">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>
            <ConfirmCard data={confirmData} userId={userId} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between">
              <span className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
                Send
              </span>
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center text-white/40 active:text-white"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {/* Recipient */}
            <div className="flex flex-col gap-1.5">
              <p className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
                Recipient Address
              </p>
              <div className="bg-background flex items-center px-4 py-3">
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 bg-transparent outline-none text-white placeholder:text-white/20 font-mono"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>

            {/* Amount */}
            <div className="flex flex-col gap-1.5">
              <p className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
                Amount (USDC)
              </p>
              <div className="bg-background flex items-center px-4 py-3">
                <span className="text-white/30 font-bold mr-1 select-none">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="flex-1 bg-transparent outline-none text-white placeholder:text-white/20 appearance-none"
                  style={{ fontSize: '16px' }}
                />
                <span className="text-white/30 text-xs uppercase tracking-wider ml-2">USDC</span>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="grid grid-cols-4 gap-2">
              {['10', '25', '50', '100'].map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAmount(amt)}
                  className="py-2 text-center font-headline font-bold text-xs uppercase tracking-wider transition-colors duration-150 active:scale-95"
                  style={{
                    backgroundColor: amount === amt ? '#ccff00' : '#0a0a0a',
                    color: amount === amt ? '#000' : '#fff',
                  }}
                >
                  ${amt}
                </button>
              ))}
            </div>

            {/* Destination Chain */}
            <div className="flex flex-col gap-1.5">
              <p className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
                Destination Chain
              </p>
              <div className="bg-background flex items-center px-4 py-3 relative">
                <select
                  value={selectedChain}
                  onChange={(e) => setSelectedChain(e.target.value as ChainOption)}
                  className="w-full bg-transparent outline-none font-headline font-bold text-xs uppercase tracking-widest appearance-none cursor-pointer"
                  style={{ fontSize: '16px', color: '#ccff00' }}
                >
                  {CHAIN_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value} style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
                      {label}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined text-white/30 text-base pointer-events-none flex-shrink-0">
                  expand_more
                </span>
              </div>
            </div>

            {selectedChain === 'World Chain' && (
              <p className="text-[11px] text-white/45 leading-relaxed">
                World Chain sends now open a wallet transaction prompt for the bundled Permit2 approval and transfer.
              </p>
            )}

            {/* Status message */}
            {status === 'success' && selectedChain === 'World Chain' && (
              <p className="text-xs text-accent text-center font-headline font-bold uppercase tracking-widest">
                Sent successfully!
              </p>
            )}
            {status === 'success' && selectedChain !== 'World Chain' && (
              <p className="text-xs text-accent text-center font-headline font-bold uppercase tracking-widest">
                Bridge initiated! ~15 min to arrive.
              </p>
            )}
            {status === 'error' && (
              <p className="text-xs text-red-400 text-center font-headline font-bold uppercase tracking-widest">
                {errorMessage || 'Transaction failed. Try again.'}
              </p>
            )}
            {/* CTA */}
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="w-full bg-accent text-black font-headline font-bold text-sm uppercase tracking-widest py-4 active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none"
            >
              {status === 'sending' ? 'Sending…' : 'Send'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
