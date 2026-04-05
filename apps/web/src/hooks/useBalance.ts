import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export function useBalance(walletAddress: string) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_URL}/api/balance?wallet=${walletAddress}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { balance: string; currency: string };
      const parsed = parseFloat(data.balance);
      if (isNaN(parsed)) throw new Error('invalid balance');
      setBalance(parsed.toFixed(2));
    } catch (err) {
      console.error('[useBalance] fetch failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}
