'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { useUserOperationReceipt } from '@worldcoin/minikit-react';
import { createPublicClient, encodeFunctionData, http } from 'viem';
import { worldchain } from 'viem/chains';
import { PERMIT2_APPROVE_ABI, PERMIT2_ADDRESS, USDC_ADDRESS, GENIE_ROUTER_ADDRESS } from '@/lib/contracts';

interface ApprovalOverlayProps {
  budgetUsd: number;
  onSuccess: () => void;
  onClose: () => void;
}

type ApprovalState = 'pending' | 'confirming' | 'success' | 'error';

export function ApprovalOverlay({ budgetUsd, onSuccess, onClose }: ApprovalOverlayProps) {
  const [state, setState] = useState<ApprovalState>('pending');
  const [errorMsg, setErrorMsg] = useState('');
  const hasRun = useRef(false);

  const client = useMemo(
    () =>
      createPublicClient({
        chain: worldchain,
        transport: http(process.env.NEXT_PUBLIC_WORLD_CHAIN_RPC_URL!),
      }),
    [],
  );

  const { poll } = useUserOperationReceipt({ client });

  const requiredAmount = BigInt(budgetUsd) * BigInt(1_000_000);

  const runApproval = useCallback(async () => {
    setState('pending');
    setErrorMsg('');
    try {
      const result = await MiniKit.sendTransaction({
        chainId: 480,
        transactions: [
          {
            to: PERMIT2_ADDRESS,
            data: encodeFunctionData({
              abi: PERMIT2_APPROVE_ABI,
              functionName: 'approve',
              args: [USDC_ADDRESS, GENIE_ROUTER_ADDRESS, requiredAmount, 0],
            }),
          },
        ],
      });

      if (!result?.data?.userOpHash) {
        throw new Error('Approval was not submitted. Please try again.');
      }

      // Wait for the user operation to be mined on-chain
      setState('confirming');
      const { receipt } = await poll(result.data.userOpHash);

      if (!receipt || receipt.status === 'reverted') {
        throw new Error('Approval transaction reverted on-chain.');
      }

      setState('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('[ApprovalOverlay] transaction failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed or was rejected');
      setState('error');
    }
  }, [poll, onSuccess, requiredAmount]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    runApproval();
  }, [runApproval]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      {(state === 'pending' || state === 'confirming') && (
        <>
          <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#ccff00] animate-spin mb-8" />
          <p className="font-headline text-white/80 text-center text-sm px-8">
            {state === 'pending'
              ? `Authorizing Genie to spend up to $${budgetUsd} USDC on your behalf`
              : 'Confirming on-chain\u2026'}
          </p>
        </>
      )}

      {state === 'success' && (
        <>
          <div className="flex items-center justify-center w-16 h-16 mb-8">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="32" cy="32" r="30" stroke="#ccff00" strokeWidth="3" />
              <path
                d="M20 32L28 40L44 24"
                stroke="#ccff00"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="font-headline text-white/80 text-center text-sm px-8">
            Approved! Redirecting...
          </p>
        </>
      )}

      {state === 'error' && (
        <>
          <div className="flex items-center justify-center w-16 h-16 mb-8">
            <svg
              width="64"
              height="64"
              viewBox="0 0 64 64"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="32" cy="32" r="30" stroke="#ff4444" strokeWidth="3" />
              <path
                d="M22 22L42 42M42 22L22 42"
                stroke="#ff4444"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="font-headline text-white/80 text-center text-sm px-8 mb-2">
            Approval required to continue
          </p>
          <p className="text-white/40 text-xs text-center px-12 mb-8">
            {errorMsg}
          </p>
          <div className="w-full px-12 flex flex-col gap-3">
            <button
              onClick={() => { hasRun.current = false; runApproval(); }}
              className="w-full bg-[#ccff00] text-black font-headline font-bold rounded-2xl py-4 active:scale-95 transition-transform"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="w-full bg-transparent border border-white/20 text-white/60 font-headline font-bold rounded-2xl py-4 active:scale-95 transition-transform"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
