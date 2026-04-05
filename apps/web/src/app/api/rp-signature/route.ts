import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { randomBytes } from 'crypto';

export const runtime = 'nodejs';

const SIGNING_KEY = process.env.RP_SIGNING_KEY;
const RP_ID = process.env.RP_ID ?? 'rp_e87d44dbb7b76d91';

/**
 * World ID RP Signature Route
 * Manually signs the request using viem to avoid WASM/Environment issues with IDKit's signRequest.
 * Message format: action|nonce|createdAt|expiresAt
 */
export async function POST(req: Request) {
  // D-11: Only authenticated users can request RP signatures
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SIGNING_KEY) {
    return NextResponse.json(
      { error: 'RP_SIGNING_KEY not configured' },
      { status: 500 },
    );
  }

  try {
    const { action } = await req.json();
    
    // 1. Prepare parameters
    const nonce = randomBytes(16).toString('hex');
    const createdAt = Math.floor(Date.now() / 1000);
    const expiresAt = createdAt + 3600; // 1 hour expiry
    
    // 2. Format the message according to World ID spec
    const message = `${action}|${nonce}|${createdAt}|${expiresAt}`;
    
    // 3. Sign using viem
    const account = privateKeyToAccount(SIGNING_KEY as `0x${string}`);
    const sig = await account.signMessage({ message });

    return NextResponse.json({
      rp_id: RP_ID,
      sig: sig,
      nonce: nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error('[rp-signature] signing error:', err);
    return NextResponse.json({ error: 'Signing failed' }, { status: 500 });
  }
}
