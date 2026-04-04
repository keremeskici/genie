'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';

interface ReceiveModalProps {
  address: string;
  onClose: () => void;
}

export function ReceiveModal({ address, onClose }: ReceiveModalProps) {
  const [copied, setCopied] = useState(false);

  // Prevent background from scrolling while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const short = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6 touch-none"
      style={{ touchAction: 'none' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-surface px-5 pt-5 pb-6 flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header row */}
        <div className="flex items-center justify-between w-full">
          <span className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
            Receive
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-white/40 active:text-white"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* QR code */}
        <div className="bg-white p-3">
          <QRCode value={address} size={160} />
        </div>

        {/* Wallet address + copy */}
        <div className="w-full flex items-center gap-3 bg-background px-4 py-3">
          <p className="flex-1 text-sm text-white/80 font-mono truncate">{short}</p>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-accent active:scale-95 transition-transform flex-shrink-0"
            aria-label="Copy address"
          >
            <span className="material-symbols-outlined text-base">
              {copied ? 'check' : 'content_copy'}
            </span>
            <span className="font-headline text-[10px] uppercase tracking-widest font-bold">
              {copied ? 'Copied' : 'Copy'}
            </span>
          </button>
        </div>

        <p className="text-xs text-white/30 text-center">
          Send only USDC or compatible tokens to this address
        </p>
      </div>
    </div>
  );
}
