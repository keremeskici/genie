import { Hono } from 'hono';
import { and, db, debts, eq, desc } from '@genie/db';

export const debtsRoute = new Hono();

debtsRoute.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) {
    return c.json({ error: 'MISSING_USER_ID', message: 'userId query param is required' }, 400);
  }

  try {
    const rows = await db
      .select()
      .from(debts)
      .where(and(eq(debts.ownerUserId, userId), eq(debts.settled, false), eq(debts.iOwe, false)))
      .orderBy(desc(debts.createdAt))
      .limit(10);

    return c.json({ debts: rows });
  } catch (err) {
    console.error('[route:debts] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: 'Could not retrieve debts' }, 500);
  }
});
