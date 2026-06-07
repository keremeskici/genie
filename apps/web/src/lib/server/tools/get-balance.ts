import { tool } from 'ai';
import { z } from 'zod';
import { erc20Abi, formatUnits } from 'viem';
import { publicClient, USDC_ADDRESS, GENIE_VAULT_ADDRESS } from '../chain/clients';
import { readVaultBalance } from '../chain/vault';
import type { UserContext } from '../agent/context';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

async function readWalletUsdc(wallet: `0x${string}`): Promise<string> {
  const raw = await publicClient.readContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [wallet],
  });
  return formatUnits(raw, 6);
}

/**
 * get_balance tool factory.
 *
 * Primary number is the user's MANAGED vault balance (principal + accrued yield) — the funds
 * Genie can spend on their behalf. Also surfaces the raw wallet USDC balance. Factory pattern
 * binds userContext (walletAddress) per request.
 */
export function createGetBalanceTool(userContext: UserContext) {
  return tool({
    description:
      "Get the user's Genie balance — their managed funds in the Genie vault (which earn yield and Genie can spend), plus their raw wallet USDC balance.",
    inputSchema: z.object({}),
    execute: async () => {
      const wallet = userContext.walletAddress as `0x${string}`;
      try {
        const walletBalance = await readWalletUsdc(wallet);

        // Managed vault balance is the primary spendable number (falls back to wallet if the
        // vault isn't configured/deployed yet).
        let balance = walletBalance;
        let source: 'vault' | 'wallet' = 'wallet';
        if (GENIE_VAULT_ADDRESS !== ZERO_ADDRESS) {
          try {
            balance = await readVaultBalance(wallet);
            source = 'vault';
          } catch (err) {
            console.error('[tool:get_balance] vault read failed, using wallet balance:', err);
          }
        }

        return {
          balance,
          walletBalance,
          source,
          currency: 'USDC' as const,
          chain: 'World Chain' as const,
        };
      } catch (err) {
        console.error('[tool:get_balance] error:', err);
        return { error: 'FETCH_FAILED', message: 'Could not retrieve balance at this time.' };
      }
    },
  });
}
