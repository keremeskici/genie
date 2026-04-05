'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ApprovalOverlay } from '@/components/ApprovalOverlay';

const GOALS = [
  'Financial planning',
  'Investing',
  'Financial accountability',
  'Lending',
  'Other',
];

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function Onboarding() {
  const router = useRouter();
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [budget, setBudget] = useState('100');
  const [showApproval, setShowApproval] = useState(false);
  const dirRef = useRef<'forward' | 'back'>('forward');
  const touchStartX = useRef<number | null>(null);

  const goTo = (next: number) => {
    if (next < 0 || next > 2) return;
    dirRef.current = next > step ? 'forward' : 'back';
    setStep(next);
  };

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );
  };

  const finish = async (budgetValue: string) => {
    const userId = session?.user?.id;
    if (userId && budgetValue && budgetValue !== '0') {
      try {
        await fetch(`${API_URL}/api/users/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            autoApproveUsd: Number(budgetValue),
          }),
        });
      } catch (err) {
        console.error('[onboarding] failed to save threshold:', err);
        // Non-blocking: proceed to home even if API call fails
      }
    }
    localStorage.setItem('genie_onboarding_done', '1');
    router.push('/home');
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
    dirRef.current === 'forward'
      ? 'onboarding-enter-forward'
      : 'onboarding-enter-back';

  const canProceed =
    step === 0 ? true :
    step === 1 ? selectedGoals.length > 0 :
    !!(budget && budget !== '0');

  const ctaLabel = step === 0 ? 'Get Started' : step === 1 ? 'Next' : "Let's Go";
  const ctaAction = step === 2 ? () => setShowApproval(true) : () => goTo(step + 1);

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
              style={{ backgroundColor: i <= step ? '#ccff00' : '#2a2a2a' }}
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
          <StepBudget budget={budget} onChange={setBudget} />
        )}
      </div>

      {/* Floating action bar */}
      <div className="flex-shrink-0 flex gap-3 px-5 pb-10">
        {step > 0 && (
          <button
            onClick={() => goTo(step - 1)}
            className="flex items-center justify-center py-5 font-headline font-black text-base uppercase tracking-widest bg-white text-black active:opacity-70 transition-opacity rounded-2xl"
            style={{ width: '30%' }}
          >
            Back
          </button>
        )}
        <button
          onClick={ctaAction}
          disabled={!canProceed}
          className="flex-1 flex items-center justify-center py-5 font-black italic text-2xl uppercase tracking-tight active:opacity-60 transition-opacity duration-150 disabled:opacity-20 disabled:pointer-events-none rounded-2xl"
          style={{ fontFamily: "'Monument Extended', sans-serif", backgroundColor: '#ccff00', color: '#000000' }}
        >
          {ctaLabel}
        </button>
      </div>

      {showApproval && (
        <ApprovalOverlay
          budgetUsd={Number(budget)}
          onSuccess={() => finish(budget)}
          onClose={() => setShowApproval(false)}
        />
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
          style={{ mixBlendMode: 'screen', maxHeight: '100%' }}
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
              style={{ mixBlendMode: 'screen' }}
            />
          </div>
          <div className="relative flex-1 bg-surface p-4 rounded-t-2xl rounded-br-2xl">
            <span
              className="absolute bottom-4 -left-[9px] w-0 h-0"
              style={{
                borderTop: '8px solid transparent',
                borderBottom: '8px solid transparent',
                borderRight: '10px solid #171717',
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
                borderColor: active ? '#ccff00' : '#2a2a2a',
                backgroundColor: active ? 'rgba(204,255,0,0.06)' : '#171717',
              }}
            >
              <span
                className="font-body font-semibold text-base text-center"
                style={{ color: active ? '#ccff00' : '#ffffff' }}
              >
                {goal}
              </span>
              <span
                className="absolute right-7 material-symbols-outlined text-base"
                style={{ color: active ? '#ccff00' : '#444' }}
              >
                {active ? 'check_circle' : 'radio_button_unchecked'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 3: Budget ── */
function StepBudget({
  budget,
  onChange,
}: {
  budget: string;
  onChange: (v: string) => void;
}) {
  const handleInput = (raw: string) => {
    const digits = raw.replace(/[^0-9]/g, '');
    onChange(digits);
  };

  return (
    <div className="flex-1 flex flex-col px-6 pb-4">
      <div className="pt-10 mb-10">
        <p className="font-headline text-[11px] uppercase tracking-[0.25em] text-accent font-bold mb-3">
          Spending Limit
        </p>
        <h1 className="font-headline text-3xl font-extrabold tracking-tighter leading-tight text-white">
          How much can Genie spend before asking for permission?
        </h1>
        <p className="text-sm text-white/40 mt-2">
          Set a limit. You can change this anytime.
        </p>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-8">
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl bg-surface border border-white/10 flex items-center px-5 py-5">
            <span className="font-headline text-2xl font-extrabold text-white/20 mr-1 select-none flex-shrink-0">
              $
            </span>
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={budget}
              onChange={(e) => handleInput(e.target.value)}
              className="min-w-0 flex-1 bg-transparent border-none outline-none font-headline font-extrabold text-white placeholder:text-white/20 focus:ring-0"
              style={{ fontSize: '26px' }}
            />
            <span className="font-headline text-sm text-white/30 uppercase tracking-widest ml-2 flex-shrink-0">
              USD
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {['100', '250', '500', '1000'].map((amt) => (
              <button
                key={amt}
                onClick={() => onChange(amt)}
                className="py-4 rounded-xl text-center font-headline font-bold text-sm uppercase tracking-wider transition-colors duration-150 active:scale-95"
                style={{
                  backgroundColor: budget === amt ? '#ccff00' : '#1f1f1f',
                  color: budget === amt ? '#000' : '#fff',
                }}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-white/25 leading-relaxed text-center px-4">
          Genie will never exceed this limit without your approval. This is a
          safeguard, not a commitment.
        </p>
      </div>
    </div>
  );
}
