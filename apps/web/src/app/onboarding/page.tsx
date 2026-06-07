"use client";

import { getPublicApiUrl } from "@/lib/backend-url";
import { useBalance } from "@/hooks/useBalance";
import {
  executeMiniKitTransactionBundle,
  extractMiniKitTransactionHash,
  worldChainReceiptClient,
} from "@/lib/minikit";
import { buildVaultFundingBundle, RE7_USDC_VAULT_APR } from "@/lib/yield";
import { useUserOperationReceipt } from "@worldcoin/minikit-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const GOALS = [
  "Financial planning",
  "Investing",
  "Financial accountability",
  "Lending",
  "Other",
];

export default function Onboarding() {
  const router = useRouter();
  const { data: session } = useSession();
  const walletAddress = session?.user?.walletAddress ?? "";
  const userId = session?.user?.id ?? "";
  const { balance } = useBalance(walletAddress);
  const numericBalance = balance ? parseFloat(balance) : null;
  const { poll, isLoading: receiptLoading } = useUserOperationReceipt({
    client: worldChainReceiptClient,
  });

  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [deposit, setDeposit] = useState("50");
  const [status, setStatus] = useState<"idle" | "depositing">("idle");
  const [saveError, setSaveError] = useState("");
  const dirRef = useRef<"forward" | "back">("forward");
  const touchStartX = useRef<number | null>(null);

  const goTo = (next: number) => {
    if (next < 0 || next > 2) return;
    dirRef.current = next > step ? "forward" : "back";
    setStep(next);
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  };

  /** Persist a default agent spending limit so Genie can manage funds right after onboarding. */
  const persistSpendingLimit = async (limitUsd: number) => {
    if (!userId || !(limitUsd > 0)) return;
    try {
      await fetch(getPublicApiUrl("/api/users/profile"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, autoApproveUsd: limitUsd }),
      });
    } catch (err) {
      console.warn(
        "[onboarding] failed to set spending limit (non-fatal):",
        err,
      );
    }
  };

  const goHome = () => {
    localStorage.setItem("genie_onboarding_done", "1");
    router.push("/home");
  };

  const handleDeposit = async () => {
    if (status === "depositing") return;
    const amount = parseFloat(deposit);
    if (Number.isNaN(amount) || amount <= 0) return;

    setSaveError("");
    setStatus("depositing");

    try {
      // The single signed action: bundled approve + deposit into the Genie vault.
      const { userOpHash } = await executeMiniKitTransactionBundle(
        buildVaultFundingBundle(
          walletAddress as `0x${string}`,
          amount.toFixed(2),
        ),
      );
      const receipt = await poll(userOpHash);
      const finalHash = extractMiniKitTransactionHash(receipt) ?? userOpHash;

      // Record the deposit + set a default agent spending limit (both best-effort).
      await Promise.allSettled([
        fetch(getPublicApiUrl("/api/deposit"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, amount, txHash: finalHash }),
        }),
        persistSpendingLimit(amount),
      ]);

      goHome();
    } catch (err) {
      console.error("[onboarding] deposit failed:", err);
      setSaveError(
        err instanceof Error ? err.message : "Deposit failed. Try again.",
      );
      setStatus("idle");
    }
  };

  const handleSkip = async () => {
    if (status === "depositing") return;
    // No deposit now — still seed a sensible default limit so the agent is usable later.
    await persistSpendingLimit(Number(deposit) > 0 ? Number(deposit) : 25);
    goHome();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) {
      goTo(step + 1);
    } else {
      goTo(step - 1);
    }
  };

  const animClass =
    dirRef.current === "forward"
      ? "onboarding-enter-forward"
      : "onboarding-enter-back";

  const depositValid =
    !Number.isNaN(parseFloat(deposit)) && parseFloat(deposit) > 0;
  const canProceed =
    step === 0 ? true : step === 1 ? selectedGoals.length > 0 : depositValid;

  const busy = status === "depositing" || receiptLoading;
  const ctaLabel =
    step === 0
      ? "Get Started"
      : step === 1
        ? "Next"
        : `Deposit $${depositValid ? parseFloat(deposit).toFixed(0) : ""}`;
  const ctaAction = step === 2 ? handleDeposit : () => goTo(step + 1);

  return (
    <div
      className="h-dvh bg-background text-white flex flex-col overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div className="px-6 pt-10 pb-0 flex-shrink-0">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[3px] flex-1 rounded-full transition-colors duration-300"
              style={{ backgroundColor: i <= step ? "#ccff00" : "#2a2a2a" }}
            />
          ))}
        </div>
      </div>

      {/* Step content */}
      <div key={step} className={`flex-1 min-h-0 flex flex-col ${animClass}`}>
        {step === 0 && <StepWelcome />}
        {step === 1 && (
          <StepGoals selected={selectedGoals} onToggle={toggleGoal} />
        )}
        {step === 2 && (
          <StepDeposit
            deposit={deposit}
            onChange={setDeposit}
            balance={numericBalance}
          />
        )}
      </div>

      {/* Floating action bar */}
      <div className="flex-shrink-0 flex flex-col gap-2 px-5 pb-10">
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => goTo(step - 1)}
              disabled={busy}
              className="flex items-center justify-center py-5 font-headline font-black text-base uppercase tracking-widest bg-white text-black active:opacity-70 transition-opacity rounded-2xl disabled:opacity-30"
              style={{ width: "30%" }}
            >
              Back
            </button>
          )}
          <button
            onClick={ctaAction}
            disabled={!canProceed || busy}
            className="flex-1 flex items-center justify-center py-5 font-black italic text-2xl uppercase tracking-tight active:opacity-60 transition-opacity duration-150 disabled:opacity-20 disabled:pointer-events-none rounded-2xl"
            style={{
              fontFamily: "'Monument Extended', sans-serif",
              backgroundColor: "#ccff00",
              color: "#000000",
            }}
          >
            {busy ? (
              <span className="inline-flex items-center justify-center">
                <span className="h-6 w-6 rounded-full border-[3px] border-black/25 border-t-black animate-spin" />
              </span>
            ) : (
              ctaLabel
            )}
          </button>
        </div>
        {step === 2 && (
          <button
            onClick={handleSkip}
            disabled={busy}
            className="py-2 text-center text-xs font-headline font-bold uppercase tracking-widest text-white/40 active:text-white/70 transition-colors disabled:opacity-30"
          >
            Skip for now
          </button>
        )}
      </div>

      {saveError && (
        <div className="px-5 pb-4">
          <p className="text-center text-sm text-red-400">{saveError}</p>
        </div>
      )}
    </div>
  );
}

/* ── Step 1: Welcome ── */
function StepWelcome() {
  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 pb-4 overflow-hidden">
      <div className="pt-10 mb-4 flex-shrink-0">
        <p className="font-headline text-[11px] uppercase tracking-[0.25em] text-accent font-bold mb-3">
          Welcome
        </p>
        <h1 className="font-headline text-4xl font-extrabold tracking-tighter leading-tight text-white">
          Take control of your financial habits.
        </h1>
        <p className="font-headline text-4xl font-extrabold tracking-tighter text-accent mt-1">
          Meet Genie.
        </p>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center">
        <img
          src="/genie.png"
          alt="Genie"
          className="w-48 object-contain"
          style={{ mixBlendMode: "screen", maxHeight: "100%" }}
        />
      </div>

      <div className="flex flex-col gap-5 pb-2 flex-shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-14 h-16 -mt-2">
            <img
              src="/genie.png"
              alt=""
              aria-hidden
              className="w-full h-full object-contain"
              style={{ mixBlendMode: "screen" }}
            />
          </div>
          <div className="relative flex-1 bg-surface p-4 rounded-t-2xl rounded-br-2xl">
            <span
              className="absolute bottom-4 -left-[9px] w-0 h-0"
              style={{
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                borderRight: "10px solid #171717",
              }}
            />
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="material-symbols-outlined text-accent text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <span className="font-headline text-[9px] uppercase tracking-widest text-accent font-bold">
                Genie
              </span>
            </div>
            <p className="text-sm text-white/80 leading-relaxed">
              Let&apos;s get going with Genie!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Goals ── */
function StepGoals({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (g: string) => void;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col px-6 pb-4 overflow-hidden">
      <div className="pt-10 mb-6 flex-shrink-0">
        <p className="font-headline text-[11px] uppercase tracking-[0.25em] text-accent font-bold mb-3">
          Your Goals
        </p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tighter leading-tight text-white">
          Why do you want to use Genie?
        </h1>
        <p className="text-sm text-white/40 mt-2">Select all that apply.</p>
      </div>

      <div className="flex flex-col gap-3 flex-1 min-h-0 pb-2">
        {GOALS.map((goal) => {
          const active = selected.includes(goal);
          return (
            <button
              key={goal}
              onClick={() => onToggle(goal)}
              className="flex-1 w-full relative flex items-center justify-center px-7 border rounded-2xl transition-colors duration-150 active:scale-[0.98]"
              style={{
                borderColor: active ? "#ccff00" : "#2a2a2a",
                backgroundColor: active ? "rgba(204,255,0,0.06)" : "#171717",
              }}
            >
              <span
                className="font-body font-semibold text-base text-center"
                style={{ color: active ? "#ccff00" : "#ffffff" }}
              >
                {goal}
              </span>
              <span
                className="absolute right-7 material-symbols-outlined text-base"
                style={{ color: active ? "#ccff00" : "#444" }}
              >
                {active ? "check_circle" : "radio_button_unchecked"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 3: Deposit ── */
function StepDeposit({
  deposit,
  onChange,
  balance,
}: {
  deposit: string;
  onChange: (v: string) => void;
  balance: number | null;
}) {
  const handleInput = (raw: string) => {
    const cleaned = raw.replace(/[^0-9.]/g, "");
    onChange(cleaned);
  };

  return (
    <div className="flex-1 flex flex-col px-6 pb-4">
      <div className="pt-10 mb-8">
        <p className="font-headline text-[11px] uppercase tracking-[0.25em] text-accent font-bold mb-3">
          Fund Your Vault
        </p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tighter leading-tight text-white">
          How much would you like to deposit into your Genie vault?
        </h1>
        <p className="text-sm text-white/40 mt-2">
          One signature funds it. Genie then manages and grows it for you —
          earning {RE7_USDC_VAULT_APR} APR.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] uppercase tracking-widest text-white/40">
              In wallet: ${balance?.toFixed(2) ?? "—"}
            </span>
            {balance !== null && balance > 0 && (
              <button
                type="button"
                onClick={() => onChange(balance.toFixed(2))}
                className="text-[11px] uppercase tracking-widest font-bold text-accent active:scale-95 transition-transform"
              >
                Max
              </button>
            )}
          </div>
          <div className="rounded-2xl bg-surface border border-white/10 flex items-center px-5 py-5">
            <span className="font-headline text-2xl font-extrabold text-white/20 mr-1 select-none flex-shrink-0">
              $
            </span>
            <input
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={deposit}
              onChange={(e) => handleInput(e.target.value)}
              className="min-w-0 flex-1 bg-transparent border-none outline-none font-headline font-extrabold text-white placeholder:text-white/20 focus:ring-0"
              style={{ fontSize: "26px" }}
            />
            <span className="font-headline text-sm text-white/30 uppercase tracking-widest ml-2 flex-shrink-0">
              USDC
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {["25", "50", "100", "250"].map((amt) => (
              <button
                key={amt}
                onClick={() => onChange(amt)}
                className="py-4 rounded-xl text-center font-headline font-bold text-sm uppercase tracking-wider transition-colors duration-150 active:scale-95"
                style={{
                  backgroundColor: deposit === amt ? "#ccff00" : "#1f1f1f",
                  color: deposit === amt ? "#000" : "#fff",
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
