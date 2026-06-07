import type { NextRequest } from "next/server";
import { z } from "zod";
import { db, users, eq } from "@genie/db";
import { resolveUserId, invalidateContextCache } from "@/lib/server/users";
import { setSpendingLimit } from "@/lib/server/chain/vault";

export const runtime = "nodejs";

const patchProfileSchema = z.object({
  userId: z.string().min(1),
  autoApproveUsd: z.number().positive().max(10000),
});

/**
 * GET /api/users/profile?userId=... — read identity + agent spending limit.
 *
 * Used by the Profile page to prefill the spending-limit field and show identity.
 * Accepts wallet address or UUID (resolveUserId handles both).
 */
export async function GET(req: NextRequest) {
  const rawUserId = req.nextUrl.searchParams.get("userId");
  if (!rawUserId) {
    return Response.json(
      { error: "MISSING_USER_ID", message: "userId query param is required" },
      { status: 400 },
    );
  }

  try {
    const userId = await resolveUserId(rawUserId);
    if (!userId) {
      return Response.json(
        { error: "USER_NOT_FOUND", message: "Could not resolve userId" },
        { status: 404 },
      );
    }

    const [user] = await db
      .select({
        walletAddress: users.walletAddress,
        displayName: users.displayName,
        worldId: users.worldId,
        autoApproveUsd: users.autoApproveUsd,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return Response.json(
        { error: "USER_NOT_FOUND", message: "User not found" },
        { status: 404 },
      );
    }

    return Response.json({
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      isVerified: user.worldId !== null,
      autoApproveUsd: parseFloat(user.autoApproveUsd),
    });
  } catch (err) {
    console.error("[route:users] GET error:", err);
    return Response.json(
      { error: "FETCH_FAILED", message: "Could not load profile" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/users/profile — update user's auto-approve threshold.
 *
 * Accepts wallet address or UUID as userId (resolveUserId handles both).
 * Used by the onboarding flow to persist the spending limit the user configures.
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = patchProfileSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "INVALID_INPUT", message: parsed.error.message },
        { status: 400 },
      );
    }

    const { userId: rawUserId, autoApproveUsd } = parsed.data;

    const userId = await resolveUserId(rawUserId);
    if (!userId) {
      return Response.json(
        { error: "USER_NOT_FOUND", message: "Could not resolve userId" },
        { status: 404 },
      );
    }

    const [user] = await db
      .update(users)
      .set({ autoApproveUsd: autoApproveUsd.toFixed(2) })
      .where(eq(users.id, userId))
      .returning({ walletAddress: users.walletAddress });

    // Invalidate context cache so updated threshold is picked up on next chat request
    invalidateContextCache(userId);

    console.log(
      `[route:users] updated autoApproveUsd to ${autoApproveUsd} for user ${userId}`,
    );

    // Best-effort: mirror the threshold to the on-chain per-tx spending cap so the agent can
    // move funds up to it. Awaited so it actually submits (serverless functions can freeze
    // after the response), but failures (e.g. vault not deployed) never fail the request.
    if (user?.walletAddress) {
      try {
        const txHash = await setSpendingLimit(
          user.walletAddress as `0x${string}`,
          autoApproveUsd,
        );
        console.log(`[route:users] on-chain spending limit set: ${txHash}`);
      } catch (err) {
        console.warn(
          "[route:users] on-chain setSpendingLimit failed (non-fatal):",
          err,
        );
      }
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("[route:users] error:", err);
    return Response.json(
      { error: "Internal server error", message: String(err) },
      { status: 500 },
    );
  }
}
