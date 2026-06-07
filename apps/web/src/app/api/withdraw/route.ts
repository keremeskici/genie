import type { NextRequest } from "next/server";
import { db, transactions, users, eq } from "@genie/db";
import { agentWithdraw, readVaultBalance } from "@/lib/server/chain/vault";
import { resolveUserId } from "@/lib/server/users";

export const runtime = "nodejs";

/**
 * POST /api/withdraw — custodial withdraw from the Genie vault back to the user's wallet.
 *
 * Returns funds via agentWithdraw (relayer-signed, no wallet popup). The on-chain
 * agentWithdraw is NOT capped by spendingLimit because funds go to their own owner.
 *
 * Body: { userId, amount?: number, max?: boolean }
 *   - max: true  → withdraw the full managed balance (rounding-safe: balanceOfAssets is
 *                  floored, so previewWithdraw(assets) <= the user's shares; no revert).
 *   - amount     → withdraw that USDC amount.
 *
 * Records a CONFIRMED `vault_withdraw` transaction (recipient = the user's own wallet).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId: rawUserId,
      amount: rawAmount,
      max,
    } = body as {
      userId?: string;
      amount?: number;
      max?: boolean;
    };

    if (!rawUserId || typeof rawUserId !== "string") {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }

    const userId = await resolveUserId(rawUserId);
    if (!userId) {
      return Response.json(
        { error: "USER_NOT_FOUND", message: "Could not resolve userId" },
        { status: 404 },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const wallet = user.walletAddress as `0x${string}`;

    // Determine amount: explicit, or the full managed balance for a max withdraw.
    let amount: number;
    if (max) {
      amount = parseFloat(await readVaultBalance(wallet));
    } else if (typeof rawAmount === "number" && rawAmount > 0) {
      amount = rawAmount;
    } else {
      return Response.json(
        { error: "amount must be a positive number" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        {
          error: "NOTHING_TO_WITHDRAW",
          message: "No managed balance to withdraw",
        },
        { status: 400 },
      );
    }

    const txHash = await agentWithdraw(wallet, amount);

    const [recorded] = await db
      .insert(transactions)
      .values({
        senderUserId: userId,
        recipientWallet: wallet,
        amountUsd: amount.toFixed(2),
        txHash,
        status: "confirmed",
        executedAt: new Date(),
        source: "vault_withdraw",
      })
      .returning();

    return Response.json({ success: true, txId: recorded.id, txHash, amount });
  } catch (err) {
    console.error("[route:withdraw] error:", err);
    return Response.json(
      {
        error: "WITHDRAW_FAILED",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
