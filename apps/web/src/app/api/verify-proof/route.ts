import { auth } from '@/auth';
import { markVerified } from '@/lib/server/users';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface IRequestPayload {
  payload: Record<string, unknown>;
  action: string;
  signal: string | undefined;
}

interface IVerifyResponse {
  success: boolean;
  [key: string]: unknown;
}

/**
 * This route is used to verify the proof of the user
 * It is critical proofs are verified from the server side
 * Read More: https://docs.world.org/mini-apps/commands/verify#verifying-the-proof
 */
export async function POST(req: NextRequest) {
  const { payload, action, signal } = (await req.json()) as IRequestPayload;
  const app_id = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;

  const response = await fetch(
    `${process.env.WORLD_VERIFY_API_URL ?? 'https://developer.worldcoin.org/api/v2/verify'}/${app_id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action, signal }),
    },
  );

  const verifyRes = (await response.json()) as IVerifyResponse;

  if (verifyRes.success) {
    // Persist verification directly (same-app DB call — D-03)
    try {
      // Get userId from server-side session via NextAuth v5 auth()
      // session.user.id is the wallet address — markVerified() resolves/provisions it
      const session = await auth();
      const userId = session?.user?.id;
      const nullifierHash = (payload as Record<string, unknown>).nullifier_hash;

      if (userId && typeof nullifierHash === 'string') {
        await markVerified(userId, nullifierHash);
        console.log('[verify-proof] persisted verification');
      }
    } catch (err) {
      // Don't fail the verification if persistence fails
      console.error('[verify-proof] failed to persist verification:', err);
    }

    return NextResponse.json({ verifyRes, status: 200 });
  } else {
    // This is where you should handle errors from the World ID /verify endpoint.
    // Usually these errors are due to a user having already verified.
    return NextResponse.json({ verifyRes, status: 400 });
  }
}
