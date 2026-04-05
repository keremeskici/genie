import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

interface IRequestPayload {
  payload: {
    merkle_root: string;
    nullifier_hash: string;
    proof: string;
    verification_level: string;
    [key: string]: unknown;
  };
  action: string;
  signal?: string;
}

interface IVerifyResponse {
  success: boolean;
  [key: string]: unknown;
}

/**
 * World ID Proof Verification Route (RP Compatible)
 * Verifies the proof on the server side via World ID Cloud API.
 */
export async function POST(req: NextRequest) {
  try {
    const { payload, action, signal } = (await req.json()) as IRequestPayload;
    const app_id = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;

    // Standard World ID verification body
    const verificationBody = {
      merkle_root: payload.merkle_root,
      nullifier_hash: payload.nullifier_hash,
      proof: payload.proof,
      verification_level: payload.verification_level,
      action,
      signal: signal ?? '',
    };

    const response = await fetch(
      `${process.env.WORLD_VERIFY_API_URL ?? 'https://developer.worldcoin.org/api/v2/verify'}/${app_id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verificationBody),
      },
    );

    const verifyRes = (await response.json()) as IVerifyResponse;

    if (verifyRes.success) {
      // D-02: Persist verification to Genie backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
      if (apiUrl) {
        try {
          const session = await auth();
          const userId = session?.user?.id;

          if (userId) {
            await fetch(`${apiUrl}/api/verify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId,
                nullifier_hash: payload.nullifier_hash,
              }),
            });
            console.log('[verify-proof] persisted to Genie backend');
          }
        } catch (err) {
          console.error('[verify-proof] persistence error:', err);
        }
      }

      return NextResponse.json({ verifyRes, status: 200 });
    } else {
      console.error('[verify-proof] Verification failed:', verifyRes);
      return NextResponse.json({ verifyRes, status: 400 });
    }
  } catch (error) {
    console.error('[verify-proof] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
