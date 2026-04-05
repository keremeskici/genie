import { Hono } from 'hono';
import { db, transactions, users, eq, or, desc } from '@genie/db';
import { USDC_ADDRESS } from '../chain/clients';

interface EtherscanTokenTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenDecimal: string;
  tokenSymbol: string;
  timeStamp: string;
  contractAddress: string;
}

const WORLDSCAN_API_KEY = process.env.WORLDSCAN_API_KEY ?? '';

async function fetchOnChainTokenTransfers(wallet: string): Promise<EtherscanTokenTx[]> {
  if (!WORLDSCAN_API_KEY) return [];
  const url = `https://api.etherscan.io/v2/api?chainid=480&module=account&action=tokentx&address=${wallet}&sort=desc&apikey=${WORLDSCAN_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json() as { status: string; result: EtherscanTokenTx[] };
  if (data.status !== '1' || !Array.isArray(data.result)) return [];
  return data.result;
}

export const transactionsRoute = new Hono();

transactionsRoute.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) {
    return c.json({ error: 'MISSING_USER_ID', message: 'userId query param is required' }, 400);
  }
  try {
    const [user] = await db.select({ walletAddress: users.walletAddress }).from(users).where(eq(users.id, userId));
    const wallet = user?.walletAddress ?? '';

    // Fetch DB transactions
    const dbRows = await db
      .select()
      .from(transactions)
      .where(
        or(
          eq(transactions.senderUserId, userId),
          eq(transactions.recipientWallet, wallet),
        ),
      )
      .orderBy(desc(transactions.createdAt))
      .limit(20);

    const dbTxHashes = new Set(dbRows.filter((r) => r.txHash).map((r) => r.txHash));

    const withDirection = dbRows.map((tx) => ({
      ...tx,
      direction: tx.senderUserId === userId ? 'sent' as const : 'received' as const,
    }));

    // Fetch on-chain token transfers via Etherscan v2 API (WorldScan)
    if (wallet) {
      try {
        const onChainTxs = await fetchOnChainTokenTransfers(wallet);
        const usdcAddress = USDC_ADDRESS.toLowerCase();

        for (const tx of onChainTxs) {
          if (dbTxHashes.has(tx.hash)) continue;
          if (tx.contractAddress.toLowerCase() !== usdcAddress) continue;

          const isSent = tx.from.toLowerCase() === wallet.toLowerCase();
          const decimals = parseInt(tx.tokenDecimal, 10) || 6;
          const amount = (parseInt(tx.value, 10) / 10 ** decimals).toFixed(2);

          withDirection.push({
            id: tx.hash,
            senderUserId: isSent ? userId : '',
            recipientWallet: isSent ? tx.to : tx.from,
            amountUsd: amount,
            txHash: tx.hash,
            status: 'confirmed',
            category: 'transfers',
            source: 'onchain',
            createdAt: new Date(parseInt(tx.timeStamp, 10) * 1000) as unknown as Date,
            expiresAt: null,
            direction: isSent ? 'sent' as const : 'received' as const,
          });
        }
      } catch (err) {
        console.error('[route:transactions] on-chain fetch failed (continuing with DB only):', err);
      }
    }

    // Sort by date descending, take top 20
    withDirection.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ transactions: withDirection.slice(0, 20) });
  } catch (err) {
    console.error('[route:transactions] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: 'Could not retrieve transactions' }, 500);
  }
});
