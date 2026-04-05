import { Hono } from 'hono';
import { db, transactions, users, eq, or, desc } from '@genie/db';
import { publicClient, USDC_ADDRESS } from '../chain/clients';
import { formatUnits } from 'viem';

const erc20TransferEvent = {
  type: 'event',
  name: 'Transfer',
  inputs: [
    { name: 'from', type: 'address', indexed: true },
    { name: 'to', type: 'address', indexed: true },
    { name: 'value', type: 'uint256', indexed: false },
  ],
} as const;

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

    // Fetch on-chain USDC transfers (sent + received) from recent blocks
    if (wallet) {
      try {
        const currentBlock = await publicClient.getBlockNumber();
        // ~3 days of blocks at ~2s/block
        const fromBlock = currentBlock > 130_000n ? currentBlock - 130_000n : 0n;

        const [sentLogs, receivedLogs] = await Promise.all([
          publicClient.getLogs({
            address: USDC_ADDRESS,
            event: erc20TransferEvent,
            args: { from: wallet as `0x${string}` },
            fromBlock,
            toBlock: 'latest',
          }),
          publicClient.getLogs({
            address: USDC_ADDRESS,
            event: erc20TransferEvent,
            args: { to: wallet as `0x${string}` },
            fromBlock,
            toBlock: 'latest',
          }),
        ]);

        const allLogs = [...sentLogs, ...receivedLogs];

        for (const log of allLogs) {
          const txHash = log.transactionHash;
          if (dbTxHashes.has(txHash)) continue; // already in DB results

          const from = log.args.from!;
          const to = log.args.to!;
          const value = log.args.value!;
          const isSent = from.toLowerCase() === wallet.toLowerCase();

          withDirection.push({
            id: txHash,
            senderUserId: isSent ? userId : '',
            recipientWallet: isSent ? to : from,
            amountUsd: formatUnits(value, 6),
            txHash,
            status: 'confirmed',
            category: 'transfers',
            source: 'onchain',
            createdAt: new Date(Number(log.blockNumber) * 1000) as unknown as Date,
            expiresAt: null,
            direction: isSent ? 'sent' as const : 'received' as const,
          });
        }

        // Fetch real timestamps for on-chain entries
        const onchainEntries = withDirection.filter((tx) => tx.source === 'onchain');
        if (onchainEntries.length > 0) {
          const uniqueBlocks = [...new Set(allLogs.filter((l) => !dbTxHashes.has(l.transactionHash)).map((l) => l.blockNumber))];
          const blockTimestamps = new Map<bigint, number>();
          await Promise.all(
            uniqueBlocks.map(async (bn) => {
              try {
                const block = await publicClient.getBlock({ blockNumber: bn });
                blockTimestamps.set(bn, Number(block.timestamp));
              } catch { /* skip */ }
            }),
          );

          for (const log of allLogs) {
            if (dbTxHashes.has(log.transactionHash)) continue;
            const entry = withDirection.find((tx) => tx.id === log.transactionHash);
            const ts = blockTimestamps.get(log.blockNumber);
            if (entry && ts) {
              entry.createdAt = new Date(ts * 1000) as unknown as Date;
            }
          }
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
