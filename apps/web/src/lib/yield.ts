import type { MiniKitTransactionBundle } from '@/lib/minikit';
import { encodeFunctionData, parseUnits } from 'viem';

export const WORLD_CHAIN_ID = 480;
export const WORLD_USDC_ADDRESS = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as const;
export const RE7_USDC_VAULT_ADDRESS = '0xb1E80387EbE53Ff75a89736097D34dC8D9E9045B' as const;
export const RE7_USDC_VAULT_APR = '5.16%' as const;
export const RE7_USDC_VAULT_PROVIDER = 'Re7 USDC' as const;

const erc20ApproveAbi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const erc4626DepositAbi = [
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
] as const;

export function getSuggestedYieldDepositAmount(balance: number, ratio: number): string {
  return Math.max(Math.floor((balance * ratio) * 100) / 100, 0).toFixed(2);
}

export function buildYieldDepositBundle(
  walletAddress: `0x${string}`,
  amountUsd: string,
): MiniKitTransactionBundle {
  const amountRaw = parseUnits(Number(amountUsd).toFixed(2), 6);
  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [RE7_USDC_VAULT_ADDRESS, amountRaw],
  });
  const depositData = encodeFunctionData({
    abi: erc4626DepositAbi,
    functionName: 'deposit',
    args: [amountRaw, walletAddress],
  });

  return {
    chainId: WORLD_CHAIN_ID,
    transactions: [
      { to: WORLD_USDC_ADDRESS, data: approveData },
      { to: RE7_USDC_VAULT_ADDRESS, data: depositData },
    ],
  };
}
