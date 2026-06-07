import { auth } from "@/auth";
import { markVerified } from "@/lib/server/users";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Server-side World ID proof verification (IDKit / World ID 4.0).
 *
 * The client forwards the raw IDKit result here; we forward it byte-for-byte to
 * the Developer Portal's verify endpoint, then persist the nullifier on success.
 * It is critical proofs are verified server-side.
 * Read More: https://docs.world.org/world-id/idkit/integrate#step-5-verify-the-proof-in-your-backend
 */
interface IRequestPayload {
  rp_id?: string;
  idkitResponse: {
    responses?: Array<Record<string, unknown>>;
    [key: string]: unknown;
  };
}

// Prefer the server-configured RP ID so a tampered client value can't redirect
// verification at a different relying party.
const RP_ID = process.env.RP_ID;
const VERIFY_BASE_URL =
  process.env.WORLD_VERIFY_API_V4_URL ??
  "https://developer.world.org/api/v4/verify";

function extractNullifier(
  idkitResponse: IRequestPayload["idkitResponse"],
): string | undefined {
  const response = idkitResponse?.responses?.[0];
  if (!response) return undefined;
  if (typeof response.nullifier === "string") return response.nullifier;
  // Session proofs return [session_nullifier, generated_action].
  if (
    Array.isArray(response.session_nullifier) &&
    typeof response.session_nullifier[0] === "string"
  ) {
    return response.session_nullifier[0] as string;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  let body: IRequestPayload;
  try {
    body = (await req.json()) as IRequestPayload;
  } catch {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "Malformed request body" },
      { status: 400 },
    );
  }

  const { rp_id: clientRpId, idkitResponse } = body;
  const rpId = RP_ID ?? clientRpId;

  if (!rpId) {
    return NextResponse.json(
      { error: "CONFIG", message: "RP ID is not configured" },
      { status: 500 },
    );
  }
  if (!idkitResponse || typeof idkitResponse !== "object") {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "Missing IDKit response" },
      { status: 400 },
    );
  }

  // Forward the IDKit payload as-is — no field remapping.
  const portalRes = await fetch(`${VERIFY_BASE_URL}/${rpId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(idkitResponse),
  });

  const portalJson = (await portalRes.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!portalRes.ok) {
    // Usually a stale root, env mismatch, or an already-spent proof.
    console.error(
      "[verify-proof] portal verification failed:",
      portalRes.status,
      portalJson,
    );
    return NextResponse.json(
      {
        error: "VERIFICATION_FAILED",
        message: "World ID proof could not be verified",
        detail: portalJson,
      },
      { status: 400 },
    );
  }

  // Proof is valid — persist the nullifier against the signed-in user.
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const nullifierHash = extractNullifier(idkitResponse);

    if (userId && nullifierHash) {
      const result = await markVerified(userId, nullifierHash);
      if (result.ok) {
        console.log("[verify-proof] persisted verification");
      } else if (result.code === "ALREADY_VERIFIED") {
        // The proof is valid and this user is already verified — still a success.
        console.log("[verify-proof] user already verified");
      } else {
        console.warn(
          "[verify-proof] could not resolve user to persist verification",
        );
      }
    } else {
      console.warn(
        "[verify-proof] missing userId or nullifier — proof valid but not persisted",
      );
    }
  } catch (err) {
    // Don't fail a valid verification just because persistence hiccupped.
    console.error("[verify-proof] failed to persist verification:", err);
  }

  return NextResponse.json({ success: true });
}
