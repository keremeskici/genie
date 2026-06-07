import type { NextRequest } from 'next/server';
import { db, transactions, eq, desc } from '@genie/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'MISSING_USER_ID', message: 'userId query param is required' }, { status: 400 });
  }
  try {
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.senderUserId, userId))
      .orderBy(desc(transactions.createdAt))
      .limit(20);

    return Response.json({ transactions: rows });
  } catch (err) {
    console.error('[route:transactions] error:', err);
    return Response.json({ error: 'FETCH_FAILED', message: 'Could not retrieve transactions' }, { status: 500 });
  }
}
