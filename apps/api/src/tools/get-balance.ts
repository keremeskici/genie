import { tool } from 'ai';
import { z } from 'zod';
import { erc20Abi, formatUnits } from 'viem';
import { publicClient, USDC_ADDRESS } from '../chain/clients';
import type { UserContext } from '../agent/context';

/**
 * get_balance tool factory — Phase 4 real implementation.
 * Reads actual USDC balance from World Chain via viem publicClient.readContract.
 * Factory pattern (createGetBalanceTool) binds userContext (walletAddress) per request.
 *
 * CRITICAL: Uses inputSchema (not parameters) per Vercel AI SDK v6 (Pitfall 2).
 */
export function createGetBalanceTool(userContext: UserContext) {
  return tool({
    description: "Get the user's current USDC balance on World Chain.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const raw = await publicClient.readContract({
          address: USDC_ADDRESS,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userContext.walletAddress as `0x${string}`],
        });
        const balance = formatUnits(raw, 6);
        return { balance, currency: 'USDC' as const, chain: 'World Chain' as const };
      } catch (err) {
        console.error('[tool:get_balance] error:', err);
        return { error: 'FETCH_FAILED', message: 'Could not retrieve balance at this time.' };
      }
    },
  });
}
