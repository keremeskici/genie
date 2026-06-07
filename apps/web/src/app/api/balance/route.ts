import type { NextRequest } from 'next/server';
import { erc20Abi, formatUnits, isAddress } from 'viem';
import { publicClient, USDC_ADDRESS } from '@/lib/server/chain/clients';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet');
  if (!wallet || !isAddress(wallet)) {
    return Response.json({ error: 'INVALID_WALLET', message: 'wallet query param must be a valid address' }, { status: 400 });
  }
  try {
    const raw = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    });
    const balance = formatUnits(raw as bigint, 6);
    return Response.json({ balance, currency: 'USDC' });
  } catch (err) {
    console.error('[route:balance] error:', err);
    return Response.json({ error: 'FETCH_FAILED', message: 'Could not retrieve balance' }, { status: 500 });
  }
}
