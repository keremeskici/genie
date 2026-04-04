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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isInstalled || hasAttemptedAuth.current) return;
    hasAttemptedAuth.current = true;

    const destination = () =>
      localStorage.getItem('genie_onboarding_done') ? '/home' : '/onboarding';

    getSession().then((session) => {
      if (session) {
        router.push(destination());
      } else {
        walletAuth()
          .then(() => router.push(destination()))
          .catch((error) => console.error('Auto wallet authentication error', error));
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-accent border-white/10 animate-spin" />
        <p className="text-white/40 text-sm font-body uppercase tracking-widest">Connecting...</p>
      </div>
    </div>
  );
}
