import type { NextRequest } from 'next/server';
import { isAddress } from 'viem';
import { db, transactions, users, eq, and } from '@genie/db';
import { agentTransfer } from '@/lib/server/chain/vault';
import { inferCategory } from '@/lib/server/tools/categorize';

export const runtime = 'nodejs';

const PENDING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Supported send chains. The Genie vault is custodial and lives on World Chain, so only
 * same-chain (World Chain) sends are executed. Cross-chain bridging is out of scope.
 */
const SUPPORTED_CHAINS = new Set(['World Chain', 'worldchain']);

/**
 * POST /api/send — custodial send from the SendModal.
 *
 * Under threshold → the agent executes the transfer on-chain immediately (no signature) and
 * records a confirmed tx. Over threshold → records a pending tx; the confirm route executes it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, recipient, amount, chain: chainName, description } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }
    if (!recipient || !isAddress(recipient)) {
      return Response.json({ error: 'Invalid recipient address' }, { status: 400 });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return Response.json({ error: 'amount must be a positive number' }, { status: 400 });
    }
    if (!chainName || !SUPPORTED_CHAINS.has(chainName)) {
      return Response.json(
        { error: 'UNSUPPORTED_CHAIN', message: 'Only World Chain sends are supported.' },
        { status: 400 },
      );
    }

    // Load user from DB
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Verification gate
    if (user.worldId === null) {
      return Response.json(
        { error: 'VERIFICATION_REQUIRED', message: 'World ID verification required to send' },
        { status: 403 },
      );
    }

    const autoApproveUsd = parseFloat(user.autoApproveUsd);

    // Clear stale pending sends
    await db
      .update(transactions)
      .set({ status: 'expired' })
      .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')));

    if (amount <= autoApproveUsd) {
      // Execute custodially now (no signature)
      const txHash = await agentTransfer(
        user.walletAddress as `0x${string}`,
        recipient as `0x${string}`,
        amount,
      );

      const [executed] = await db
        .insert(transactions)
        .values({
          senderUserId: userId,
          recipientWallet: recipient,
          amountUsd: amount.toFixed(2),
          txHash,
          status: 'confirmed',
          executedAt: new Date(),
          category: inferCategory(description),
          source: 'genie_send',
        })
        .returning();

      return Response.json({
        type: 'transfer_executed',
        txId: executed.id,
        txHash,
        amount,
        recipient,
      });
    } else {
      // Over threshold → record pending, require an in-app confirmation tap (no signature)
      const [pending] = await db
        .insert(transactions)
        .values({
          senderUserId: userId,
          recipientWallet: recipient,
          amountUsd: amount.toFixed(2),
          status: 'pending',
          expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
          category: inferCategory(description),
          source: 'genie_send',
        })
        .returning();

      return Response.json({
        type: 'confirmation_required',
        txId: pending.id,
        amount,
        recipient,
        expiresInMinutes: 15,
      });
    }
  } catch (err) {
    console.error('[route:send] error:', err);
    return Response.json(
      {
        error: 'SEND_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
