import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { markVerified } from '@/lib/server/users';

export const runtime = 'nodejs';

// D-03: Backend trusts BFF — accepts only userId + nullifier_hash (no proof fields)
const proofSchema = z.object({
  userId: z.string().min(1),
  nullifier_hash: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = proofSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_INPUT', message: 'Missing or invalid proof fields' }, { status: 400 });
  }

  const { userId, nullifier_hash } = parsed.data;
  const result = await markVerified(userId, nullifier_hash);

  if (!result.ok) {
    if (result.code === 'ALREADY_VERIFIED') {
      return Response.json(
        { error: 'ALREADY_VERIFIED', message: 'This account is already verified with World ID' },
        { status: 409 },
      );
    }
    return Response.json({ error: 'USER_NOT_FOUND', message: 'Could not resolve userId' }, { status: 404 });
  }

  return Response.json({ success: true });
}
