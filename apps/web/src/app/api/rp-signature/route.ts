import { auth } from '@/auth';
import { NextResponse } from 'next/server';
import { keccak256, toBytes, toHex, hexToBytes } from 'viem';
import { sign } from 'viem/accounts';
import * as crypto from 'crypto';

export const runtime = 'nodejs';

const RP_ID = process.env.RP_ID ?? 'rp_e87d44dbb7b76d91';

function hashToField(input: Uint8Array): Uint8Array {
  const h = keccak256(input, 'bytes');
  // Shift right 8 bits (set first byte to 0x00)
  const result = new Uint8Array(32);
  result[0] = 0x00;
  result.set(h.slice(0, 31), 1);
  return result;
}

function u64ToBe(value: number): Uint8Array {
  const buf = new Uint8Array(8);
  const view = new DataView(buf.buffer);
  view.setBigUint64(0, BigInt(value), false);
  return buf;
}

function computeRpSignatureMessage(
  nonce: Uint8Array,
  createdAt: number,
  expiresAt: number,
  action?: string,
): Uint8Array {
  const size = action != null ? 81 : 49;
  const msg = new Uint8Array(size);
  msg[0] = 0x01; // version byte
  msg.set(nonce, 1); // 32-byte nonce at offset 1
  msg.set(u64ToBe(createdAt), 33); // 8-byte created_at at offset 33
  msg.set(u64ToBe(expiresAt), 41); // 8-byte expires_at at offset 41

  if (action != null) {
    const actionHash = hashToField(toBytes(action));
    msg.set(actionHash, 49); // 32-byte action hash at offset 49
  }

  return msg;
}

async function signRpRequest(
  signingKeyHex: string,
  action?: string,
  ttl = 300,
) {
  const key = signingKeyHex.startsWith('0x')
    ? signingKeyHex
    : `0x${signingKeyHex}`;

  // 1. Generate nonce
  const random = crypto.randomBytes(32);
  const nonceBytes = hashToField(new Uint8Array(random));

  // 2. Timestamps
  const createdAt = Math.floor(Date.now() / 1000);
  const expiresAt = createdAt + ttl;

  // 3. Build message
  const msg = computeRpSignatureMessage(nonceBytes, createdAt, expiresAt, action);

  // 4. EIP-191 prefix and hash
  const prefix = `\x19Ethereum Signed Message:\n${msg.length}`;
  const prefixBytes = toBytes(prefix);
  const combined = new Uint8Array(prefixBytes.length + msg.length);
  combined.set(prefixBytes, 0);
  combined.set(msg, prefixBytes.length);
  const digest = keccak256(combined);

  // 5. Sign with viem (returns { r, s, v, yParity })
  const { r, s, v } = await sign({ hash: digest as `0x${string}`, privateKey: key as `0x${string}` });

  // 6. Encode: r(32) || s(32) || v(1)
  const rBytes = hexToBytes(r as `0x${string}`);
  const sBytes = hexToBytes(s as `0x${string}`);
  const sig65 = new Uint8Array(65);
  sig65.set(rBytes, 0);
  sig65.set(sBytes, 32);
  sig65[64] = Number(v);

  return {
    sig: toHex(sig65),
    nonce: toHex(nonceBytes),
    createdAt,
    expiresAt,
  };
}

export async function POST(req: Request) {
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

    const { sig, nonce, createdAt, expiresAt } = await signRpRequest(
      process.env.RP_SIGNING_KEY,
      action,
    );

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
