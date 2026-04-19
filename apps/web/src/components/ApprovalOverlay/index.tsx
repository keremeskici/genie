'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { MiniKit } from '@worldcoin/minikit-js';
import { useUserOperationReceipt } from '@worldcoin/minikit-react';
import { createPublicClient, encodeFunctionData, getAddress, http, parseUnits } from 'viem';
import { worldchain } from 'viem/chains';
import { ERC20_APPROVE_ABI, USDC_ADDRESS, GENIE_ROUTER_ADDRESS } from '@/lib/contracts';

interface ApprovalOverlayProps {
  budgetUsd: number;
  walletAddress: `0x${string}`;
  onSuccess: () => void;
  onClose: () => void;
}

type ApprovalState = 'pending' | 'success' | 'error';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function ApprovalOverlay({ budgetUsd, walletAddress, onSuccess, onClose }: ApprovalOverlayProps) {
  const [state, setState] = useState<ApprovalState>('pending');
  const [errorMessage, setErrorMessage] = useState('');
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
    setErrorMessage('');
    try {
      const amount = parseUnits(budgetUsd.toString(), 6);

      console.log('[ApprovalOverlay] approving USDC allowance', {
        token: USDC_ADDRESS,
        owner: walletAddress,
        spender: GENIE_ROUTER_ADDRESS,
        amount: amount.toString(),
      });

      const result = await MiniKit.sendTransaction({
        chainId: 480,
        transactions: [
          {
            to: USDC_ADDRESS,
            value: '0x0',
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

      console.log('[ApprovalOverlay] MiniKit approval submitted', {
        userOpHash: result.data.userOpHash,
        from: result.data.from,
        timestamp: result.data.timestamp,
      });

      const { transactionHash, receipt } = await poll(result.data.userOpHash);
      const minedTx = await client.getTransaction({ hash: transactionHash });

      console.log('[ApprovalOverlay] approval transaction mined', {
        transactionHash,
        status: receipt.status,
        transactionFrom: minedTx.from,
        transactionTo: minedTx.to,
        expectedTo: USDC_ADDRESS,
        inputPrefix: minedTx.input.slice(0, 10),
      });

      // Give RPC/indexed reads a short moment after the AA receipt before reading allowance.
      await sleep(1500);

      const approvalOwner = getAddress(minedTx.from);
      const sessionOwner = getAddress(walletAddress);

      const sessionAllowance = await client.readContract({
        address: USDC_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: [sessionOwner, GENIE_ROUTER_ADDRESS],
      });

      const approvalOwnerAllowance = approvalOwner === sessionOwner
        ? sessionAllowance
        : await client.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_APPROVE_ABI,
            functionName: 'allowance',
            args: [approvalOwner, GENIE_ROUTER_ADDRESS],
          });

      console.log('[ApprovalOverlay] allowance after approval', {
        sessionOwner,
        approvalOwner,
        spender: GENIE_ROUTER_ADDRESS,
        expected: amount.toString(),
        sessionAllowance: sessionAllowance.toString(),
        approvalOwnerAllowance: approvalOwnerAllowance.toString(),
      });

      if (sessionAllowance < amount) {
        throw new Error(
          `Approval confirmed, but allowance is still too low. Expected ${budgetUsd} USDC for router ${GENIE_ROUTER_ADDRESS}; session owner ${sessionOwner} allowance is ${sessionAllowance.toString()}, approval tx owner ${approvalOwner} allowance is ${approvalOwnerAllowance.toString()}.`,
        );
      }

      setState('success');
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err) {
      console.error('[ApprovalOverlay] transaction failed:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Transaction failed or was rejected');
      setState('error');
    }
  }, [budgetUsd, client, poll, onSuccess, walletAddress]);

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
            {errorMessage || 'Transaction failed or was rejected'}
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
