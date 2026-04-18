import type { UserContext } from '../agent/context';
import { ALLOW_UNVERIFIED_AGENT_ACTIONS } from '../config/env';

/**
 * Gating guard for tools that require World ID verification (D-06, D-08).
 *
 * Usage in gated tool execute():
 *   const gateError = requireVerified(userContext);
 *   if (gateError) return gateError;
 *
 * Returns null if user is verified (guard passes).
 * Returns structured error object if user is not verified.
 *
 * Gated actions per D-07: send USDC, create debt, set goals.
 * Ungated: chat, check balance, receive money, view transactions.
 */
export function requireVerified(
  userContext: UserContext,
): { error: string; message: string } | null {
  if (userContext.isVerified) return null;
  if (ALLOW_UNVERIFIED_AGENT_ACTIONS) {
    console.warn('[verification] ALLOW_UNVERIFIED_AGENT_ACTIONS=true — bypassing World ID gate');
    return null;
  }

  return {
    error: 'VERIFICATION_REQUIRED',
    message: 'This action requires World ID verification. Please verify to continue.',
  };
}
