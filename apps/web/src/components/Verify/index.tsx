"use client";
import {
  IDKitRequestWidget,
  orbLegacy,
  type IDKitResult,
  type RpContext,
} from "@worldcoin/idkit";
import { LiveFeedback } from "@worldcoin/mini-apps-ui-kit-react";
import { getPublicApiUrl } from "@/lib/backend-url";
import { useSession } from "next-auth/react";
import { useState } from "react";

/**
 * World ID verification via IDKit (World ID 4.0, with legacy 3.0 fallback).
 *
 * Flow (https://docs.world.org/world-id/idkit/integrate):
 *   1. Request a fresh RP signature from our backend (/api/rp-signature).
 *   2. Open the IDKitRequestWidget — it drives the World App connect flow
 *      (deep-link inside World App, QR code on web) and returns a proof.
 *   3. Forward the proof to our backend (/api/verify-proof), which validates
 *      it with the Developer Portal and persists the nullifier.
 *
 * It's critical the proof is verified server-side — never trust the client.
 */

const APP_ID = (process.env.NEXT_PUBLIC_APP_ID ?? "") as `app_${string}`;
const ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION ?? "verify-human";
// Use the production Orb network unless a deploy explicitly opts into staging
// (e.g. for the World ID simulator). Defaults to production for real users.
const ENVIRONMENT: "production" | "staging" =
  process.env.NEXT_PUBLIC_WLD_ENVIRONMENT === "staging"
    ? "staging"
    : "production";

interface VerifyProps {
  /** Whether the user is already verified (DB-backed). Renders the verified state. */
  verified?: boolean;
  /** Called after a proof is successfully verified server-side. */
  onVerified?: () => void;
}

type ButtonState = "pending" | "success" | "failed" | undefined;

function extractNullifier(result: IDKitResult): string | undefined {
  const response = result.responses?.[0] as unknown as
    | Record<string, unknown>
    | undefined;
  if (!response) return undefined;
  const nullifier = response.nullifier;
  if (typeof nullifier === "string") return nullifier;
  // Session proofs carry a [session_nullifier, generated_action] tuple.
  if (
    Array.isArray(response.session_nullifier) &&
    typeof response.session_nullifier[0] === "string"
  ) {
    return response.session_nullifier[0];
  }
  return undefined;
}

export const Verify = ({ verified = false, onVerified }: VerifyProps = {}) => {
  const { data: session } = useSession();
  const [buttonState, setButtonState] = useState<ButtonState>(
    verified ? "success" : undefined,
  );
  const [open, setOpen] = useState(false);
  const [rpContext, setRpContext] = useState<RpContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isVerified = verified || buttonState === "success";

  const onClickVerify = async () => {
    if (isVerified || buttonState === "pending") return;
    setError(null);
    setButtonState("pending");

    try {
      // 1. Fetch a fresh RP signature (nonce is short-lived) for this action.
      const res = await fetch(getPublicApiUrl("/api/rp-signature"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: ACTION }),
      });
      if (!res.ok) {
        throw new Error("Could not start verification");
      }
      const rpSig = (await res.json()) as {
        rp_id: string;
        sig: string;
        nonce: string;
        created_at: number;
        expires_at: number;
      };

      setRpContext({
        rp_id: rpSig.rp_id,
        nonce: rpSig.nonce,
        created_at: rpSig.created_at,
        expires_at: rpSig.expires_at,
        signature: rpSig.sig,
      });
      // 2. Open the widget — it takes over the connect + proof flow.
      setOpen(true);
    } catch (err) {
      console.error("[verify] failed to start verification:", err);
      setError(
        err instanceof Error ? err.message : "Could not start verification",
      );
      setButtonState("failed");
      setTimeout(() => setButtonState(undefined), 2500);
    }
  };

  const handleSuccess = async (result: IDKitResult) => {
    try {
      // 3. Verify the proof server-side and persist the nullifier.
      const res = await fetch(getPublicApiUrl("/api/verify-proof"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rp_id: rpContext?.rp_id,
          idkitResponse: result,
          nullifier_hash: extractNullifier(result),
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message ?? "Backend verification failed");
      }

      setButtonState("success");
      onVerified?.();
    } catch (err) {
      console.error("[verify] server verification failed:", err);
      setError(err instanceof Error ? err.message : "Verification failed");
      setButtonState("failed");
      setTimeout(() => setButtonState(undefined), 2500);
    }
  };

  const handleError = (code: string) => {
    console.error("[verify] IDKit error:", code);
    // User cancelling the modal isn't really a failure — just reset.
    if (code === "user_rejected" || code === "connection_failed") {
      setButtonState(undefined);
      return;
    }
    setError("Verification was not completed");
    setButtonState("failed");
    setTimeout(() => setButtonState(undefined), 2500);
  };

  return (
    <div className="grid w-full gap-2">
      <LiveFeedback
        label={{
          failed: "Failed to verify",
          pending: "Verifying",
          success: "Verified",
        }}
        state={buttonState}
        className="w-full"
      >
        <div className="w-full rounded-full bg-white p-1">
          <button
            type="button"
            onClick={onClickVerify}
            disabled={buttonState === "pending" || isVerified}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-white px-6 py-4 text-base font-headline font-black uppercase tracking-[0.18em] !text-black active:scale-95 transition-transform duration-150 disabled:opacity-70 disabled:active:scale-100"
            style={{ color: "#000000" }}
          >
            {isVerified ? "Verified with World ID" : "Verify with World ID"}
          </button>
        </div>
      </LiveFeedback>

      {error && <p className="text-[11px] text-red-400 px-1">{error}</p>}

      {rpContext && (
        <IDKitRequestWidget
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            // Closing the widget without completing resets the pending state.
            if (!next && buttonState === "pending") {
              setButtonState(undefined);
            }
          }}
          app_id={APP_ID}
          action={ACTION}
          rp_context={rpContext}
          allow_legacy_proofs={true}
          environment={ENVIRONMENT}
          preset={orbLegacy({
            signal: session?.user?.walletAddress ?? session?.user?.id,
          })}
          onSuccess={handleSuccess}
          onError={handleError}
        />
      )}
    </div>
  );
};
