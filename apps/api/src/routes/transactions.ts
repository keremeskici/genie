import { Hono } from 'hono';
import { db, transactions, eq, desc } from '@genie/db';

export const transactionsRoute = new Hono();

transactionsRoute.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) {
    return c.json({ error: 'MISSING_USER_ID', message: 'userId query param is required' }, 400);
  }
  try {
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.senderUserId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(20);

    return c.json({ transactions: rows });
  } catch (err) {
    console.error('[route:transactions] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: 'Could not retrieve transactions' }, 500);
  }
});
