import type { MiniKitTransactionBundle } from '@/lib/minikit';
import { GenieVaultAbi } from '@/lib/genie-vault-abi';
import { encodeFunctionData, parseUnits } from 'viem';

export const WORLD_CHAIN_ID = 480;
export const WORLD_USDC_ADDRESS = '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as const;

// RE7 ERC-4626 vault that GenieVault routes idle balances into — kept for display only.
export const RE7_USDC_VAULT_ADDRESS = '0xb1E80387EbE53Ff75a89736097D34dC8D9E9045B' as const;
export const RE7_USDC_VAULT_APR = '5.16%' as const;
export const RE7_USDC_VAULT_PROVIDER = 'Re7 USDC' as const;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * The custodial GenieVault address (NEXT_PUBLIC_GENIE_VAULT_ADDRESS). Funding this vault is
 * the single signed action — afterwards the agent moves funds with no further signatures, and
 * the deposited balance earns yield (vault routes into RE7). The user's vault balance IS their
 * yield position.
 */
export const GENIE_VAULT_ADDRESS = (process.env.NEXT_PUBLIC_GENIE_VAULT_ADDRESS ??
  ZERO_ADDRESS) as `0x${string}`;

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

export function getSuggestedYieldDepositAmount(balance: number, ratio: number): string {
  return Math.max(Math.floor((balance * ratio) * 100) / 100, 0).toFixed(2);
}

/**
 * Build the single signed funding action: approve USDC to the GenieVault, then deposit into it.
 * The deposited amount becomes the user's managed (yield-bearing) balance that Genie can spend.
 */
export function buildVaultFundingBundle(
  walletAddress: `0x${string}`,
  amountUsd: string,
): MiniKitTransactionBundle {
  if (GENIE_VAULT_ADDRESS === ZERO_ADDRESS) {
    throw new Error('NEXT_PUBLIC_GENIE_VAULT_ADDRESS is not configured');
  }
  // walletAddress is accepted for signature symmetry; deposit credits msg.sender on-chain.
  void walletAddress;

  const amountRaw = parseUnits(Number(amountUsd).toFixed(2), 6);
  const approveData = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: 'approve',
    args: [GENIE_VAULT_ADDRESS, amountRaw],
  });
  const depositData = encodeFunctionData({
    abi: GenieVaultAbi,
    functionName: 'deposit',
    args: [amountRaw],
  });

  return {
    chainId: WORLD_CHAIN_ID,
    transactions: [
      { to: WORLD_USDC_ADDRESS, data: approveData },
      { to: GENIE_VAULT_ADDRESS, data: depositData },
    ],
  };
}

/**
 * @deprecated Use {@link buildVaultFundingBundle}. Kept as an alias — funding the Genie vault
 * is now the yield deposit (the vault routes the balance into RE7).
 */
export const buildYieldDepositBundle = buildVaultFundingBundle;
