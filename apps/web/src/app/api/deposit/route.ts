import type { NextRequest } from "next/server";
import { db, transactions } from "@genie/db";
import { GENIE_VAULT_ADDRESS } from "@/lib/server/chain/clients";
import { resolveUserId } from "@/lib/server/users";

export const runtime = "nodejs";

/**
 * POST /api/deposit — record a vault deposit in the transaction history.
 *
 * The deposit itself is signed and executed client-side via MiniKit (bundled
 * approve + GenieVault.deposit, the World-recommended single-signature flow). The
 * on-chain balance is read live from the vault; this route only logs the deposit so
 * it appears in transaction history.
 *
 * Body: { userId, amount: number, txHash: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId: rawUserId,
      amount,
      txHash,
    } = body as {
      userId?: string;
      amount?: number;
      txHash?: string;
    };

    if (!rawUserId || typeof rawUserId !== "string") {
      return Response.json({ error: "userId is required" }, { status: 400 });
    }
    if (typeof amount !== "number" || amount <= 0) {
      return Response.json(
        { error: "amount must be a positive number" },
        { status: 400 },
      );
    }

    const userId = await resolveUserId(rawUserId);
    if (!userId) {
      return Response.json(
        { error: "USER_NOT_FOUND", message: "Could not resolve userId" },
        { status: 404 },
      );
    }

    const [recorded] = await db
      .insert(transactions)
      .values({
        senderUserId: userId,
        recipientWallet: GENIE_VAULT_ADDRESS,
        amountUsd: amount.toFixed(2),
        txHash: txHash ?? null,
        status: "confirmed",
        executedAt: new Date(),
        source: "vault_deposit",
      })
      .returning();

    return Response.json({ success: true, txId: recorded.id });
  } catch (err) {
    console.error("[route:deposit] error:", err);
    return Response.json(
      {
        error: "DEPOSIT_RECORD_FAILED",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
