import { auth } from '@/auth';
import { NextRequest, NextResponse } from 'next/server';

interface IVerifyResponse {
  success: boolean;
  nullifier?: string;
  nullifier_hash?: string;
  [key: string]: unknown;
}

/**
 * World ID Proof Verification Route (v4 API)
 * Forwards the IDKit result payload as-is to the World ID v4 verify endpoint.
 */
export async function POST(req: NextRequest) {
  try {
    const { rp_id, idkitResponse } = await req.json();

    const response = await fetch(
      `https://developer.world.org/api/v4/verify/${rp_id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idkitResponse),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[verify-proof] Verification failed:', errorBody);
      return NextResponse.json(
        { error: 'Verification failed' },
        { status: 400 },
      );
    }

    const verifyRes = (await response.json()) as IVerifyResponse;

    // Persist verification to Genie backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? '';
    if (apiUrl) {
      try {
        const session = await auth();
        const userId = session?.user?.id;

        // Extract nullifier from v4 response or legacy v3 response
        const nullifier =
          verifyRes.nullifier ?? verifyRes.nullifier_hash ?? '';

        if (userId && nullifier) {
          await fetch(`${apiUrl}/api/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              nullifier_hash: nullifier,
            }),
          });
          console.log('[verify-proof] persisted to Genie backend');
        }
      } catch (err) {
        console.error('[verify-proof] persistence error:', err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[verify-proof] unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    );
  }
}
