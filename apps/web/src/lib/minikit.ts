'use client';
import { MiniKit } from '@worldcoin/minikit-js';
import { Tokens, tokenToDecimals } from '@worldcoin/minikit-js/commands';
import { createPublicClient, http } from 'viem';
import { worldchain } from 'viem/chains';

function createMiniKitNonce(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

/**
 * Trigger MiniKit Pay for a USDC transfer (per D-12).
 * Called when the agent confirms a send action in chat.
 * Returns the transaction result or null if MiniKit is unavailable.
 */
export async function triggerMiniKitPay(opts: {
  to: string;
  amountUsdc: number;
  description?: string;
}): Promise<{ success: boolean; transactionId?: string } | null> {
  if (!MiniKit.isInstalled()) {
    console.warn('[minikit] MiniKit not installed — skipping pay');
    return null;
  }

  // Get a payment reference from the backend for verification
  const res = await fetch('/api/initiate-payment', { method: 'POST' });
  const { id } = await res.json();

  try {
    const result = await MiniKit.pay({
      reference: id,
      to: opts.to,
      tokens: [
        {
          symbol: Tokens.USDC,
          token_amount: tokenToDecimals(opts.amountUsdc, Tokens.USDC).toString(),
        },
      ],
      description: opts.description ?? 'Send USDC via Genie',
    });

    return {
      success: true,
      transactionId: result.data?.transactionId,
    };
  } catch (err) {
    console.error('[minikit] pay failed:', err);
    return { success: false };
  }
}

/**
 * Request wallet address, username, and profile picture from the World App user (per D-15).
 * Uses walletAuth to get the wallet address, then getUserInfo to fetch profile data.
 * Returns the user data or null if MiniKit is unavailable.
 */
export async function requestMiniKitPermissions(): Promise<{
  walletAddress?: string;
  username?: string;
  profilePictureUrl?: string;
} | null> {
  if (!MiniKit.isInstalled()) {
    console.warn('[minikit] MiniKit not installed — skipping permission request');
    return null;
  }

  try {
    // walletAuth provides wallet address and identity via SIWE (D-15)
    const authResult = await MiniKit.walletAuth({
      nonce: createMiniKitNonce(),
    });

    const walletAddress = authResult.data?.address;
    if (!walletAddress) return null;

    // Fetch profile data (username, profilePictureUrl) for the connected wallet
    const userInfo = await MiniKit.getUserInfo(walletAddress);

    return {
      walletAddress,
      username: userInfo?.username,
      profilePictureUrl: userInfo?.profilePictureUrl,
    };
  } catch (err) {
    console.error('[minikit] permission request failed:', err);
    return null;
  }
}

/**
 * Trigger MiniKit wallet signing for on-chain transaction commands (per D-13).
 * Used when the agent needs the user to sign a transaction via World App wallet.
 * Returns the signed payload or null if MiniKit is unavailable.
 */
export async function triggerWalletSign(nonce?: string): Promise<{
  signature?: string;
  address?: string;
} | null> {
  if (!MiniKit.isInstalled()) {
    console.warn('[minikit] MiniKit not installed — skipping wallet sign');
    return null;
  }

  try {
    const result = await MiniKit.walletAuth({
      nonce: nonce?.replace(/[^a-zA-Z0-9]/g, '') ?? createMiniKitNonce(),
    });

    return {
      signature: result.data?.signature,
      address: result.data?.address,
    };
  } catch (err) {
    console.error('[minikit] wallet auth failed:', err);
    return null;
  }
}

export type WalletTransactionPlan = {
  chainId: number;
  permit2: {
    address: `0x${string}`;
    token: `0x${string}`;
    spender: `0x${string}`;
    amount: string;
    expiration: number;
  };
  transactions: Array<{
    to: `0x${string}`;
    data: `0x${string}`;
    value?: `0x${string}`;
  }>;
  amountRaw: string;
  recipient: `0x${string}`;
};

export type MiniKitTransactionBundle = {
  chainId: number;
  transactions: Array<{
    to: `0x${string}`;
    data: `0x${string}`;
    value?: `0x${string}`;
  }>;
};

export type WalletTransactionRequiredResponse = {
  type: 'wallet_transaction_required';
  txId: string;
  amount: number;
  recipient: string;
  expiresInMinutes: number;
  requiresExplicitConfirmation: boolean;
  txPlan: WalletTransactionPlan;
};

export function isWalletTransactionRequiredResponse(
  value: unknown,
): value is WalletTransactionRequiredResponse {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<WalletTransactionRequiredResponse>;
  return (
    candidate.type === 'wallet_transaction_required'
    && typeof candidate.txId === 'string'
    && !!candidate.txPlan
    && Array.isArray(candidate.txPlan.transactions)
  );
}

function extractHashFromUnknown(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const candidate = value as Record<string, unknown>;
  const directKeys = ['transactionHash', 'txHash', 'userOpHash', 'hash'];
  for (const key of directKeys) {
    const hash = candidate[key];
    if (typeof hash === 'string' && hash.startsWith('0x')) {
      return hash;
    }
  }

  const nestedKeys = ['receipt', 'transactionReceipt', 'data', 'result'];
  for (const key of nestedKeys) {
    const nested = extractHashFromUnknown(candidate[key]);
    if (nested) return nested;
  }

  return undefined;
}

export function extractMiniKitTransactionHash(value: unknown): string | undefined {
  return extractHashFromUnknown(value);
}

export async function executeMiniKitTransactionBundle(txPlan: MiniKitTransactionBundle): Promise<{
  userOpHash: string;
}> {
  if (!MiniKit.isInstalled()) {
    throw new Error('World App is required to approve this transfer');
  }

  let result;
  try {
    result = await MiniKit.sendTransaction({
      chainId: txPlan.chainId,
      transactions: txPlan.transactions,
    });
  } catch (err) {
    console.error('[minikit] sendTransaction failed', err);
    if (typeof err === 'object' && err !== null && 'details' in err) {
      console.error('[minikit] sendTransaction error details', (err as { details?: unknown }).details);
    }
    throw err;
  }

  const userOpHash = extractMiniKitTransactionHash(result?.data);
  if (!userOpHash) {
    throw new Error('World App did not return a transaction identifier');
  }

  return { userOpHash };
}

export async function executeMiniKitTransactions(txPlan: WalletTransactionPlan): Promise<{
  userOpHash: string;
}> {
  return executeMiniKitTransactionBundle({
    chainId: txPlan.chainId,
    transactions: txPlan.transactions,
  });
}

export const worldChainReceiptClient = createPublicClient({
  chain: worldchain,
  transport: http(process.env.NEXT_PUBLIC_WORLD_CHAIN_RPC_URL!),
});
