import { Hono } from 'hono';
import { db, transactions, users, eq, and } from '@genie/db';
import { executeOnChainTransfer } from '../chain/transfer';

export const confirmRoute = new Hono();

confirmRoute.post('/confirm', async (c) => {
  try {
    const body = await c.req.json();
    const { txId, userId } = body;

    if (!txId || typeof txId !== 'string') {
      return c.json({ error: 'txId is required' }, 400);
    }
    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'userId is required' }, 400);
    }

    // Load the pending transaction — must belong to this user
    const [tx] = await db.select()
      .from(transactions)
      .where(and(
        eq(transactions.id, txId),
        eq(transactions.senderUserId, userId),
      ))
      .limit(1);

    if (!tx) {
      return c.json({ error: 'Transaction not found' }, 404);
    }

    if (tx.status === 'confirmed') {
      return c.json({ error: 'Transaction already confirmed', txHash: tx.txHash }, 409);
    }

    if (tx.status === 'expired' || tx.status === 'failed') {
      return c.json({ error: `Transaction is ${tx.status}` }, 410);
    }

    // Check time-based expiry even if status is still 'pending'
    if (tx.expiresAt && new Date(tx.expiresAt) < new Date()) {
      // Mark as expired in DB
      await db.update(transactions)
        .set({ status: 'expired' })
        .where(eq(transactions.id, txId));
      return c.json({ error: 'Transaction expired' }, 410);
    }

    // Execute the on-chain transfer
    try {
      // Need the user's wallet address — fetch from users table (static import)
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!user) {
        return c.json({ error: 'User not found' }, 404);
      }

      const { routeTxHash, executeTxHash } = await executeOnChainTransfer(
        user.walletAddress as `0x${string}`,
        tx.recipientWallet as `0x${string}`,
        parseFloat(tx.amountUsd),
      );

      // Update transaction to confirmed
      await db.update(transactions)
        .set({ status: 'confirmed', txHash: executeTxHash })
        .where(eq(transactions.id, txId));

      return c.json({
        success: true,
        txHash: executeTxHash,
        routeTxHash,
        amount: tx.amountUsd,
        recipient: tx.recipientWallet,
      });
    } catch (err) {
      console.error('[route:confirm] transfer error:', err);
      // Mark transaction as failed
      await db.update(transactions)
        .set({ status: 'failed' })
        .where(eq(transactions.id, txId));
      return c.json({
        error: 'TRANSFER_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      }, 500);
    }
  } catch (err) {
    console.error('[route:confirm] error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
