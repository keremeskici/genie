import { Hono } from 'hono';
import { db, transactions, users, eq, or, desc } from '@genie/db';

export const transactionsRoute = new Hono();

transactionsRoute.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) {
    return c.json({ error: 'MISSING_USER_ID', message: 'userId query param is required' }, 400);
  }
  try {
    const [user] = await db.select({ walletAddress: users.walletAddress }).from(users).where(eq(users.id, userId));
    const wallet = user?.walletAddress ?? '';

    const rows = await db
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

    const withDirection = rows.map((tx) => ({
      ...tx,
      direction: tx.senderUserId === userId ? 'sent' as const : 'received' as const,
    }));

    return c.json({ transactions: withDirection });
  } catch (err) {
    console.error('[route:transactions] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: 'Could not retrieve transactions' }, 500);
  }
});
