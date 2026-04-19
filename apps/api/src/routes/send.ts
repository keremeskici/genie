import { Hono } from 'hono';
import { isAddress } from 'viem';
import { db, transactions, users, eq, and } from '@genie/db';
import { executeOnChainTransfer } from '../chain/transfer';
import { bridgeUsdc, CCTP_DOMAIN_IDS } from '../chain/bridge';
import { inferCategory } from '../tools/categorize';

export const sendRoute = new Hono();

const PENDING_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Chain name mapping — normalizes frontend chain names to CCTP_DOMAIN_IDS keys.
 * null = World Chain (same-chain transfer via executeOnChainTransfer).
 * string = cross-chain destination (bridge via bridgeUsdc).
 */
const CHAIN_MAP: Record<string, string | null> = {
  'World Chain': null,
  'worldchain': null,
  'Base': 'base',
  'base': 'base',
  'Arbitrum': 'arbitrum',
  'arbitrum': 'arbitrum',
  'Ethereum': 'ethereum',
  'ethereum': 'ethereum',
  'Optimism': 'optimism',
  'optimism': 'optimism',
};

sendRoute.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { userId, recipient, amount, chain: chainName, description } = body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      return c.json({ error: 'userId is required' }, 400);
    }
    if (!recipient || !isAddress(recipient)) {
      return c.json({ error: 'Invalid recipient address' }, 400);
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return c.json({ error: 'amount must be a positive number' }, 400);
    }
    if (!chainName || !(chainName in CHAIN_MAP)) {
      return c.json({ error: 'Unsupported chain' }, 400);
    }

    // Load user from DB
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return c.json({ error: 'User not found' }, 404);
    }

    // Verification gate
    if (user.worldId === null) {
      return c.json(
        { error: 'VERIFICATION_REQUIRED', message: 'World ID verification required to send' },
        403,
      );
    }

    const autoApproveUsd = parseFloat(user.autoApproveUsd);
    const destinationChain = CHAIN_MAP[chainName];

    if (destinationChain === null) {
      // World Chain (same-chain) send
      if (amount <= autoApproveUsd) {
        // Auto-execute path (FOPS-04)
        const { routeTxHash, executeTxHash } = await executeOnChainTransfer(
          user.walletAddress as `0x${string}`,
          recipient as `0x${string}`,
          amount,
        );

        await db.insert(transactions).values({
          senderUserId: userId,
          recipientWallet: recipient,
          amountUsd: amount.toFixed(2),
          txHash: executeTxHash,
          status: 'confirmed',
          executedAt: new Date(),
          source: 'genie_send',
          category: inferCategory(description),
        });

        return c.json({
          type: 'transfer_complete',
          txHash: executeTxHash,
          routeTxHash,
          amount,
          recipient,
        });
      } else {
        // Confirmation required path (FOPS-05)
        await db
          .update(transactions)
          .set({ status: 'expired' })
          .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')));

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

        return c.json({
          type: 'confirmation_required',
          txId: pending.id,
          amount,
          recipient,
          expiresInMinutes: 15,
        });
      }
    } else {
      // Cross-chain send via CCTP bridge
      const { routeTxHash, bridgeTxHash } = await bridgeUsdc({
        senderWallet: user.walletAddress as `0x${string}`,
        amountUsd: amount,
        destinationChain,
        recipientWallet: recipient,
      });

      await db.insert(transactions).values({
        senderUserId: userId,
        recipientWallet: recipient,
        amountUsd: amount.toFixed(2),
        txHash: bridgeTxHash,
        status: 'confirmed',
        executedAt: new Date(),
        source: 'genie_bridge',
        category: 'transfers',
      });

      return c.json({
        type: 'bridge_initiated',
        routeTxHash,
        bridgeTxHash,
        amount,
        recipient,
        destinationChain,
        estimatedMinutes: 15,
      });
    }
  } catch (err) {
    console.error('[route:send] error:', err);
    return c.json(
      {
        error: 'SEND_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
      500,
    );
  }
});
