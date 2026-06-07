"use client";

import { getPublicApiUrl } from "@/lib/backend-url";
import {
  executeMiniKitTransactionBundle,
  extractMiniKitTransactionHash,
  worldChainReceiptClient,
} from "@/lib/minikit";
import { buildVaultFundingBundle, RE7_USDC_VAULT_APR } from "@/lib/yield";
import { useUserOperationReceipt } from "@worldcoin/minikit-react";
import { useEffect, useMemo, useState } from "react";

type DepositModalProps = {
  walletAddress: string;
  userId: string;
  /** USDC available in the user's wallet. */
  balanceAmount: number | null;
  defaultAmount?: string;
  onClose: () => void;
  onSuccess?: () => void;
};

const PRESETS = ["25", "50", "100", "250"];

export function DepositModal({
  walletAddress,
  userId,
  balanceAmount,
  defaultAmount = "",
  onClose,
  onSuccess,
}: DepositModalProps) {
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState(defaultAmount);
  const [status, setStatus] = useState<
    "idle" | "signing" | "success" | "error"
  >("idle");
  const [error, setError] = useState("");
  const { poll, isLoading } = useUserOperationReceipt({
    client: worldChainReceiptClient,
  });

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleClose = () => {
    if (status === "signing") return;
    setVisible(false);
    setTimeout(onClose, 220);
  };

  const parsedAmount = useMemo(() => parseFloat(amount), [amount]);
  const hasValidAmount = Boolean(
    walletAddress &&
    balanceAmount !== null &&
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    parsedAmount <= balanceAmount + 1e-9,
  );

  const handleDeposit = async () => {
    if (!hasValidAmount || !walletAddress) return;
    setError("");
    setStatus("signing");

    try {
      const { userOpHash } = await executeMiniKitTransactionBundle(
        buildVaultFundingBundle(
          walletAddress as `0x${string}`,
          parsedAmount.toFixed(2),
        ),
      );

      const receipt = await poll(userOpHash);
      const finalHash = extractMiniKitTransactionHash(receipt) ?? userOpHash;

      // Best-effort: record the deposit so it shows in history. Never fail the UX on this.
      try {
        await fetch(getPublicApiUrl("/api/deposit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            amount: parsedAmount,
            txHash: finalHash,
          }),
        });
      } catch (recordErr) {
        console.warn("[deposit] failed to record (non-fatal):", recordErr);
      }

      setStatus("success");
      onSuccess?.();
      setTimeout(handleClose, 1400);
    } catch (err) {
      console.error("[deposit] failed", err);
      setError(
        err instanceof Error ? err.message : "Vault deposit failed. Try again.",
      );
      setStatus("error");
    }
  };

  const busy = status === "signing" || isLoading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-6 touch-none"
      style={{
        touchAction: "none",
        backgroundColor: `rgba(0,0,0,${visible ? 0.7 : 0})`,
        transition: "background-color 220ms ease",
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm bg-surface px-5 pt-5 pb-6 flex flex-col gap-5 rounded-2xl"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible
            ? "scale(1) translateY(0)"
            : "scale(0.95) translateY(12px)",
          transition: "opacity 220ms ease, transform 220ms ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
            Deposit to Vault
          </span>
          <button
            onClick={handleClose}
            className="w-7 h-7 flex items-center justify-center text-white/40 active:text-white"
            aria-label="Close"
            disabled={busy}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Available + APR */}
        <div className="flex items-center justify-between rounded-xl bg-background px-4 py-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              In wallet
            </p>
            <p className="mt-1 font-headline text-lg font-bold text-white">
              ${balanceAmount?.toFixed(2) ?? "0.00"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-white/40">
              Earns
            </p>
            <p className="mt-1 font-headline text-lg font-bold text-accent">
              {RE7_USDC_VAULT_APR} APR
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="font-headline text-[10px] uppercase tracking-widest text-white/40 font-bold">
              Deposit Amount
            </p>
            <button
              type="button"
              onClick={() =>
                balanceAmount && setAmount(balanceAmount.toFixed(2))
              }
              className="text-[10px] uppercase tracking-widest font-bold text-accent active:scale-95 transition-transform"
            >
              Max
            </button>
          </div>
          <div className="bg-background flex items-center px-4 py-3">
            <span className="text-white/30 font-bold mr-1 select-none">$</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                if (status !== "idle") setStatus("idle");
                if (error) setError("");
              }}
              placeholder="0.00"
              className="flex-1 bg-transparent outline-none text-white placeholder:text-white/20 appearance-none"
              style={{ fontSize: "16px" }}
            />
            <span className="text-white/30 text-xs uppercase tracking-wider ml-2">
              USDC
            </span>
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((amt) => (
            <button
              key={amt}
              onClick={() => {
                setAmount(amt);
                if (error) setError("");
              }}
              className="py-2 text-center font-headline font-bold text-xs uppercase tracking-wider transition-colors duration-150 active:scale-95 rounded-md"
              style={{
                backgroundColor: amount === amt ? "#ccff00" : "#0a0a0a",
                color: amount === amt ? "#000" : "#fff",
              }}
            >
              ${amt}
            </button>
          ))}
        </div>

        <p className="text-[11px] text-white/45 leading-relaxed">
          One signature funds your vault. Afterwards Genie manages it for you —
          no more popups — and it earns yield while it sits.
        </p>

        {/* Status */}
        {status === "success" && (
          <p className="text-xs text-accent text-center font-headline font-bold uppercase tracking-widest">
            Deposited!
          </p>
        )}
        {status === "error" && error && (
          <p className="text-xs text-red-400 text-center leading-relaxed">
            {error}
          </p>
        )}
        {!hasValidAmount && amount.trim().length > 0 && status !== "error" && (
          <p className="text-[11px] text-red-300 text-center">
            Enter an amount above 0 and no more than your wallet balance.
          </p>
        )}

        {/* CTA */}
        <button
          onClick={handleDeposit}
          disabled={!hasValidAmount || busy}
          className="w-full bg-accent text-black font-headline font-bold text-sm uppercase tracking-widest py-4 active:scale-95 transition-transform disabled:opacity-30 disabled:pointer-events-none rounded-lg"
        >
          {busy
            ? "Opening wallet…"
            : `Deposit${hasValidAmount ? ` $${parsedAmount.toFixed(2)}` : ""}`}
        </button>
      </div>
    </div>
  );
}
