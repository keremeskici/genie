import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

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
    `https://developer.worldcoin.org/api/v2/verify/${app_id}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, action, signal }),
    },
  );

  const verifyRes = (await response.json()) as IVerifyResponse;

  if (verifyRes.success) {
    // Persist verification to Genie backend (Phase 3 endpoint)
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    if (apiUrl) {
      try {
        // Get userId from server-side session via NextAuth v5 auth()
        // session.user.id is the wallet address — the backend resolveUserId() handles provisioning
        const session = await auth();
        const userId = session?.user?.id;

        // Send the full proof payload so the backend can validate against World ID Cloud API
        // Backend proofSchema requires: userId, proof, merkle_root, nullifier_hash, verification_level
        await fetch(`${apiUrl}/api/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            proof: (payload as Record<string, unknown>).proof,
            merkle_root: (payload as Record<string, unknown>).merkle_root,
            nullifier_hash: (payload as Record<string, unknown>).nullifier_hash,
            verification_level: (payload as Record<string, unknown>).verification_level ?? 'orb',
          }),
        });
        console.log('[verify-proof] persisted to Genie backend');
      } catch (err) {
        // Don't fail the verification if backend persistence fails
        console.error('[verify-proof] failed to persist to Genie backend:', err);
      }
    }

    return NextResponse.json({ verifyRes, status: 200 });
  } else {
    // This is where you should handle errors from the World ID /verify endpoint.
    // Usually these errors are due to a user having already verified.
    return NextResponse.json({ verifyRes, status: 400 });
  }
}
