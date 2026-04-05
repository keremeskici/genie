'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { useUserOperationReceipt } from '@worldcoin/minikit-react';
import { createPublicClient, encodeFunctionData, http } from 'viem';
import { worldchain } from 'viem/chains';
import { ERC20_APPROVE_ABI, USDC_ADDRESS, GENIE_ROUTER_ADDRESS } from '@/lib/contracts';

interface ApprovalOverlayProps {
  budgetUsd: number;
  onSuccess: () => void;
  onClose: () => void;
}

type ApprovalState = 'pending' | 'success' | 'error';

export function ApprovalOverlay({ budgetUsd, onSuccess, onClose }: ApprovalOverlayProps) {
  const [state, setState] = useState<ApprovalState>('pending');
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

  const runApproval = useCallback(async () => {
    setState('pending');
    try {
      const amount = BigInt(budgetUsd) * BigInt(1_000_000);
      const result = await MiniKit.sendTransaction({
        chainId: 480,
        transactions: [
          {
            to: USDC_ADDRESS,
            data: encodeFunctionData({
              abi: ERC20_APPROVE_ABI,
              functionName: 'approve',
              args: [GENIE_ROUTER_ADDRESS, amount],
            }),
          },
        ],
      });

      if (!result?.data?.userOpHash) {
        throw new Error('MiniKit did not return a userOpHash — approval may not have been submitted');
      }

      await poll(result.data.userOpHash);

      setState('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('[ApprovalOverlay] transaction failed:', err);
      setState('error');
    }
  }, [budgetUsd, poll, onSuccess]);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;
    runApproval();
  }, [runApproval]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center">
      {state === 'pending' && (
        <>
          <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#ccff00] animate-spin mb-8" />
          <p className="font-headline text-white/80 text-center text-sm px-8">
            Authorizing Genie to spend up to ${budgetUsd} USDC on your behalf
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
          <p className="font-headline text-white/80 text-center text-sm px-8 mb-8">
            Transaction failed or was rejected
          </p>
          <div className="flex flex-col gap-3 w-full px-12">
            <button
              onClick={runApproval}
              className="bg-[#ccff00] text-black font-headline font-bold rounded-2xl py-4 active:scale-95 transition-transform"
            >
              Try Again
            </button>
            <button
              onClick={onClose}
              className="bg-white/10 text-white/60 font-headline font-bold rounded-2xl py-4 active:scale-95 transition-transform"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
