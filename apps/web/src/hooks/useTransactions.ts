import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export interface Transaction {
  id: string;
  senderUserId: string;
  recipientWallet: string;
  amountUsd: string;
  txHash: string | null;
  status: string;
  category: string | null;
  source: string;
  createdAt: string;
  executedAt: string | null;
  expiresAt: string | null;
}

export function useTransactions(userId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_URL}/api/transactions?userId=${userId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { transactions: Transaction[] };
      setTransactions(data.transactions ?? []);
    } catch (err) {
      console.error('[useTransactions] fetch failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return { transactions, loading, error, refetch: fetchTransactions };
}
