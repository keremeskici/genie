import type { NextRequest } from 'next/server';
import { and, db, debts, eq, desc } from '@genie/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return Response.json({ error: 'MISSING_USER_ID', message: 'userId query param is required' }, { status: 400 });
  }

  try {
    const rows = await db
      .select()
      .from(debts)
      .where(and(eq(debts.ownerUserId, userId), eq(debts.settled, false), eq(debts.iOwe, false)))
      .orderBy(desc(debts.createdAt))
      .limit(10);

    return Response.json({ debts: rows });
  } catch (err) {
    console.error('[route:debts] error:', err);
    return Response.json({ error: 'FETCH_FAILED', message: 'Could not retrieve debts' }, { status: 500 });
  }
}
