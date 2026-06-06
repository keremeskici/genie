import { useCallback, useEffect, useState } from 'react';
import { createPublicClient, formatUnits, http } from 'viem';
import { worldchain } from 'viem/chains';

const vaultAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'convertToAssets',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const worldChainClient = createPublicClient({
  chain: worldchain,
  transport: http(process.env.NEXT_PUBLIC_WORLD_CHAIN_RPC_URL!),
});

export function useYieldPosition(walletAddress: string, vaultAddress: `0x${string}`) {
  const [positionUsd, setPositionUsd] = useState<string | null>(null);
  const [shares, setShares] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchPosition = useCallback(async () => {
    if (!walletAddress || !vaultAddress) return;

    setLoading(true);
    setError(false);
    try {
      const shareBalance = await worldChainClient.readContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: 'balanceOf',
        args: [walletAddress as `0x${string}`],
      });

      setShares(formatUnits(shareBalance, 6));

      if (shareBalance === BigInt(0)) {
        setPositionUsd('0.00');
        return;
      }

      const assetValue = await worldChainClient.readContract({
        address: vaultAddress,
        abi: vaultAbi,
        functionName: 'convertToAssets',
        args: [shareBalance],
      });

      setPositionUsd(Number(formatUnits(assetValue, 6)).toFixed(2));
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

  return { positionUsd, shares, loading, error, refetch: fetchPosition };
}
