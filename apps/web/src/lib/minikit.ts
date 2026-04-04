'use client';
import { MiniKit } from '@worldcoin/minikit-js';
import { Tokens, tokenToDecimals } from '@worldcoin/minikit-js/commands';

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
      nonce: crypto.randomUUID(),
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
      nonce: nonce ?? crypto.randomUUID(),
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
