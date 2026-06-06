'use client';

import {
  executeMiniKitTransactionBundle,
  extractMiniKitTransactionHash,
  worldChainReceiptClient,
} from '@/lib/minikit';
import {
  buildYieldDepositBundle,
  RE7_USDC_VAULT_APR,
  RE7_USDC_VAULT_PROVIDER,
} from '@/lib/yield';
import { useUserOperationReceipt } from '@worldcoin/minikit-react';
import { useEffect, useMemo, useState } from 'react';

type YieldDepositModalProps = {
  isOpen: boolean;
  walletAddress: string;
  balanceAmount: number | null;
  defaultAmount: string;
  suggestionLabel: string;
  requiresVerification?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

export function YieldDepositModal({
  isOpen,
  walletAddress,
  balanceAmount,
  defaultAmount,
  suggestionLabel,
  requiresVerification = false,
  onClose,
  onSuccess,
}: YieldDepositModalProps) {
  const [amount, setAmount] = useState(defaultAmount);
  const [status, setStatus] = useState<'idle' | 'signing' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const { poll, isLoading } = useUserOperationReceipt({ client: worldChainReceiptClient });

  useEffect(() => {
    if (!isOpen) return;
    setAmount(defaultAmount);
    setStatus('idle');
    setError('');
  }, [defaultAmount, isOpen]);

  const parsedAmount = useMemo(() => parseFloat(amount), [amount]);
  const hasValidAmount = Boolean(
    walletAddress
      && balanceAmount !== null
      && !Number.isNaN(parsedAmount)
      && parsedAmount > 0
      && parsedAmount <= balanceAmount,
  );

  if (!isOpen) return null;

  const handleDeposit = async () => {
    if (requiresVerification || !hasValidAmount || !walletAddress) return;

    setError('');
    setStatus('signing');

    try {
      const { userOpHash } = await executeMiniKitTransactionBundle(
        buildYieldDepositBundle(walletAddress as `0x${string}`, parsedAmount.toFixed(2)),
      );

      const receipt = await poll(userOpHash);
      const finalHash = extractMiniKitTransactionHash(receipt) ?? userOpHash;
      console.log('[yield] deposit completed', {
        userOpHash,
        finalHash,
        amountUsd: parsedAmount.toFixed(2),
      });

      setStatus('success');
      onSuccess?.();
    } catch (err) {
      console.error('[yield] deposit failed', err);
      setError(err instanceof Error ? err.message : 'Vault deposit failed. Try again.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm px-4 py-6 flex items-center justify-center">
      <div className="w-full max-w-sm mx-auto bg-background border border-white/10 rounded-[28px] p-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-accent mb-2">
              Yield Deposit
            </p>
            <h2 className="font-headline text-2xl font-extrabold tracking-tighter">
              {RE7_USDC_VAULT_PROVIDER}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center active:scale-95 transition-transform"
            aria-label="Close yield deposit"
            disabled={status === 'signing'}
          >
            <span className="material-symbols-outlined text-white/60 text-lg">close</span>
          </button>
        </div>

        <div className="mt-5 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white/60">Available in wallet</span>
            <span className="font-headline text-xl font-bold">
              ${balanceAmount?.toFixed(2) ?? '0.00'}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-white/40 text-[11px] uppercase tracking-widest">Asset</p>
              <p className="mt-2 font-medium">USDC</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-white/40 text-[11px] uppercase tracking-widest">APR</p>
              <p className="mt-2 font-medium">{RE7_USDC_VAULT_APR}</p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/5 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-white/40 text-[11px] uppercase tracking-widest">Suggested deposit</p>
                <p className="mt-2 text-sm text-white/60">
                  {suggestionLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAmount(defaultAmount)}
                className="rounded-full border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-widest text-white/70"
              >
                Use default
              </button>
            </div>
            <label className="mt-4 block">
              <span className="text-white/40 text-[11px] uppercase tracking-widest">Deposit amount</span>
              <div className="mt-2 flex items-center rounded-2xl bg-background px-4 py-3">
                <span className="font-headline text-lg font-bold text-white mr-2">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  max={balanceAmount?.toFixed(2) ?? undefined}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (status !== 'idle') setStatus('idle');
                    if (error) setError('');
                  }}
                  className="w-full bg-transparent text-white text-lg outline-none"
                />
              </div>
            </label>
            <p className="mt-2 text-[11px] text-white/40">
              Available: ${balanceAmount?.toFixed(2) ?? '0.00'}
            </p>
            {!hasValidAmount && amount.trim().length > 0 && (
              <p className="mt-2 text-[11px] text-red-300">
                Enter an amount above 0 and no more than your current USDC balance.
              </p>
            )}
            {requiresVerification && (
              <p className="mt-2 text-[11px] text-accent">
                Verify with World ID in Profile to unlock yield deposits.
              </p>
            )}
          </div>
          {status === 'success' && (
            <div className="mt-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
              Deposit submitted successfully. Your balance should refresh in a moment.
            </div>
          )}
          {status === 'error' && error && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={status === 'signing'}
            className="rounded-full border border-white/10 px-4 py-3 text-sm font-medium text-white/80"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleDeposit}
            disabled={status === 'signing' || isLoading || !hasValidAmount || requiresVerification}
            className="rounded-full bg-accent px-3 py-2 text-sm font-bold text-black disabled:opacity-60"
          >
            <span className="inline-flex w-full items-center justify-center gap-2">
              <span>
                {status === 'signing' || isLoading
                  ? 'Opening wallet...'
                  : `Deposit $${hasValidAmount ? parsedAmount.toFixed(2) : amount}`}
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-accent">
                <span className="material-symbols-outlined text-base">north_east</span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
