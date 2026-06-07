import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { provisionUser } from '@/lib/server/users';

export const runtime = 'nodejs';

const provisionSchema = z.object({
  walletAddress: z.string().min(1),
  displayName: z.string().nullable().optional(),
});

function errorDetails(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }

  const cause = err.cause;
  return {
    name: err.name,
    message: err.message,
    cause: cause instanceof Error
      ? {
          name: cause.name,
          message: cause.message,
          code: 'code' in cause ? cause.code : undefined,
          detail: 'detail' in cause ? cause.detail : undefined,
        }
      : cause,
  };
}

/**
 * POST /api/users/provision
 * Get-or-create a user by wallet address (idempotent — D-02).
 * Returns { userId: UUID, needsOnboarding: boolean }.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = provisionSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: 'INVALID_INPUT', message: 'walletAddress is required' }, { status: 400 });
    }

    const result = await provisionUser(parsed.data);
    console.log(`[route:users] provision — user ${result.userId}, needsOnboarding=${result.needsOnboarding}`);
    return Response.json(result);
  } catch (err) {
    console.error('[route:users] provision error:', err);
    return Response.json({
      error: 'PROVISION_FAILED',
      message: err instanceof Error ? err.message : String(err),
      details: errorDetails(err),
    }, { status: 500 });
  }
}
