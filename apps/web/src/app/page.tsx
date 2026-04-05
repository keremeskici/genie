'use client';

import { walletAuth } from '@/auth/wallet';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const { isInstalled } = useMiniKit();
  const hasAttemptedAuth = useRef(false);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isInstalled || hasAttemptedAuth.current) return;
    hasAttemptedAuth.current = true;

    const onboardingDone = localStorage.getItem('genie_onboarding_done') === '1';

    getSession().then((session) => {
      if (session) {
        if (session.user?.needsOnboarding && !onboardingDone) {
          router.push('/onboarding');
        } else {
          router.push('/home');
        }
      } else {
        walletAuth()
          .then(async () => {
            const freshSession = await getSession();
            if (!freshSession) {
              setAuthError('Sign in failed. Please try again.');
              return;
            }
            if (freshSession.user?.needsOnboarding && !onboardingDone) {
              router.push('/onboarding');
            } else {
              router.push('/home');
            }
          })
          .catch((error) => {
            console.error('Auto wallet authentication error', error);
            setAuthError(error?.message ?? 'Authentication failed. Please try again.');
          });
      }
    });
  }, [isInstalled, router]);

  if (mounted && !isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 px-8 text-center">
          <p className="text-white text-lg font-body font-semibold">Open in World App</p>
          <p className="text-white/40 text-sm font-body">
            This app must be opened inside the World App to work.
          </p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-white text-sm font-body font-semibold">Sign in failed</p>
          <p className="text-white/40 text-xs font-body">{authError}</p>
          <button
            onClick={() => { hasAttemptedAuth.current = false; setAuthError(null); }}
            className="mt-2 px-6 py-3 bg-accent text-black font-headline font-bold text-xs uppercase tracking-widest"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-accent border-white/10 animate-spin" />
        <p className="text-white/40 text-sm font-body uppercase tracking-widest">Connecting...</p>
      </div>
    </div>
  );
}
