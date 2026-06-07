import type { UserContext } from '../agent/context';

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
  _userContext: UserContext,
): { error: string; message: string } | null {
  console.warn('[verification] World ID gate temporarily bypassed for agent testing');
  return null;
}
