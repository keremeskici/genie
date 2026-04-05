'use client';

import { triggerMiniKitPay } from '@/lib/minikit';
import { useEffect, useState } from 'react';

interface SendModalProps {
  onClose: () => void;
}

export function SendModal({ onClose }: SendModalProps) {
  const [visible, setVisible] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [selectedChain, setSelectedChain] = useState<'Base' | 'Arbitrum' | 'Optimism' | 'Polygon'>('Base');

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

  const handleSend = async () => {
    if (!recipient.trim() || !amount || parseFloat(amount) <= 0) return;
    setStatus('sending');
    const result = await triggerMiniKitPay({
      to: recipient.trim(),
      amountUsdc: parseFloat(amount),
      description: `Send ${amount} USDC via Genie on ${selectedChain}`,
    });
    if (result?.success) {
      setStatus('success');
      setTimeout(handleClose, 1500);
    } else {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  const canSend = recipient.trim().length > 0 && parseFloat(amount) > 0 && status === 'idle';

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
              onChange={(e) => setSelectedChain(e.target.value as typeof selectedChain)}
              className="w-full bg-transparent outline-none font-headline font-bold text-xs uppercase tracking-widest appearance-none cursor-pointer"
              style={{ fontSize: '16px', color: '#ccff00' }}
            >
              {(['Base', 'Arbitrum', 'Optimism', 'Polygon'] as const).map((chain) => (
                <option key={chain} value={chain} style={{ backgroundColor: '#0a0a0a', color: '#fff' }}>
                  {chain}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined text-white/30 text-base pointer-events-none flex-shrink-0">
              expand_more
            </span>
          </div>
        </div>

        {/* Status message */}
        {status === 'success' && (
          <p className="text-xs text-accent text-center font-headline font-bold uppercase tracking-widest">
            Sent successfully!
          </p>
        )}
        {status === 'error' && (
          <p className="text-xs text-red-400 text-center font-headline font-bold uppercase tracking-widest">
            Transaction failed. Try again.
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
      </div>
    </div>
  );
}
