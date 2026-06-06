import { useCallback, useEffect, useState } from 'react';
import { getPublicApiUrl } from '@/lib/backend-url';

export interface Debt {
  id: string;
  ownerUserId: string;
  counterpartyWallet: string;
  amountUsd: string;
  description: string | null;
  settled: boolean;
  iOwe: boolean;
  createdAt: string;
}

export function useDebts(userId: string) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchDebts = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(getPublicApiUrl(`/api/debts?userId=${userId}`));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { debts: Debt[] };
      setDebts(data.debts ?? []);
    } catch (err) {
      console.error('[useDebts] fetch failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  return { debts, loading, error, refetch: fetchDebts };
}
