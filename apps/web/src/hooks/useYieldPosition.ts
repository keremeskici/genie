import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, formatUnits, http } from 'viem';
import { worldchain } from 'viem/chains';
import { GenieVaultAbi } from '@/lib/genie-vault-abi';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const worldChainClient = createPublicClient({
  chain: worldchain,
  transport: http(process.env.NEXT_PUBLIC_WORLD_CHAIN_RPC_URL!),
});

/**
 * Reads the user's managed GenieVault balance (principal + accrued yield) via balanceOfAssets.
 * The vault balance IS the yield position. `vaultAddress` should be the GenieVault address.
 */
export function useYieldPosition(walletAddress: string, vaultAddress: `0x${string}`) {
  const [positionUsd, setPositionUsd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchPosition = useCallback(async () => {
    if (!walletAddress || !vaultAddress || vaultAddress === ZERO_ADDRESS) return;

    setLoading(true);
    setError(false);
    try {
      const assetValue = await worldChainClient.readContract({
        address: vaultAddress,
        abi: GenieVaultAbi,
        functionName: 'balanceOfAssets',
        args: [walletAddress as `0x${string}`],
      });

      setPositionUsd(Number(formatUnits(assetValue as bigint, 6)).toFixed(2));
    } catch (err) {
      console.error('[useYieldPosition] fetch failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [vaultAddress, walletAddress]);

  useEffect(() => {
    fetchPosition();
  }, [fetchPosition]);

  return { positionUsd, loading, error, refetch: fetchPosition };
}
