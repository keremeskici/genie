import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { signRequest } from '@worldcoin/idkit/signing';

export const runtime = 'nodejs';

const RP_ID = process.env.RP_ID ?? 'rp_e87d44dbb7b76d91';

/**
 * World ID RP Signature Route
 * Uses the official IDKit signRequest to generate RP signatures.
 */
export async function POST(req: Request) {
  // D-11: Only authenticated users can request RP signatures
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.RP_SIGNING_KEY) {
    return NextResponse.json(
      { error: 'RP_SIGNING_KEY not configured' },
      { status: 500 },
    );
  }

  try {
    const { action } = await req.json();

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: process.env.RP_SIGNING_KEY,
      action,
    });

    return NextResponse.json({
      rp_id: RP_ID,
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('[rp-signature] signing error:', err);
    return NextResponse.json({ error: 'Signing failed' }, { status: 500 });
  }
}
