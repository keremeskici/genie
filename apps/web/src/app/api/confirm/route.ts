import type { NextRequest } from 'next/server';
import { db, transactions, users, eq, and } from '@genie/db';
import { agentTransfer } from '@/lib/server/chain/vault';

export const runtime = 'nodejs';

/**
 * POST /api/confirm — confirm and execute an over-threshold pending send.
 *
 * Custodial: confirmation is a chat/UI tap (not a wallet signature). On confirm the agent
 * executes the transfer on-chain via agentTransfer and marks the tx confirmed with the real
 * txHash.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { txId, userId } = body;

    console.log('[route:confirm] request received', { txId, userId });

    if (!txId || typeof txId !== 'string') {
      return Response.json({ error: 'txId is required' }, { status: 400 });
    }
    if (!userId || typeof userId !== 'string') {
      return Response.json({ error: 'userId is required' }, { status: 400 });
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
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (tx.status === 'confirmed') {
      return Response.json({ error: 'Transaction already confirmed', txHash: tx.txHash }, { status: 409 });
    }

    if (tx.status === 'expired' || tx.status === 'failed') {
      return Response.json({ error: `Transaction is ${tx.status}` }, { status: 410 });
    }

    // Check time-based expiry even if status is still 'pending'
    if (tx.expiresAt && new Date(tx.expiresAt) < new Date()) {
      await db.update(transactions)
        .set({ status: 'expired' })
        .where(eq(transactions.id, txId));
      return Response.json({ error: 'Transaction expired' }, { status: 410 });
    }

    const [user] = await db.select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Execute the transfer custodially (no user signature)
    const txHash = await agentTransfer(
      user.walletAddress as `0x${string}`,
      tx.recipientWallet as `0x${string}`,
      parseFloat(tx.amountUsd),
    );

    await db.update(transactions)
      .set({ status: 'confirmed', txHash, executedAt: new Date() })
      .where(eq(transactions.id, txId));

    return Response.json({
      success: true,
      txHash,
      amount: tx.amountUsd,
      recipient: tx.recipientWallet,
    });
  } catch (err) {
    console.error('[route:confirm] error:', err);
    return Response.json(
      { error: 'CONFIRM_FAILED', message: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
