'use client';

import { walletAuth } from '@/auth/wallet';
import { useMiniKit } from '@worldcoin/minikit-js/minikit-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function Home() {
  const { isInstalled } = useMiniKit();
  const hasAttemptedAuth = useRef(false);
  const router = useRouter();

  useEffect(() => {
    if (isInstalled && !hasAttemptedAuth.current) {
      hasAttemptedAuth.current = true;
      walletAuth()
        .then(() => router.push('/home'))
        .catch((error) => console.error('Auto wallet authentication error', error));
    }
  }, [isInstalled, router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-t-accent border-white/10 animate-spin" />
        <p className="text-white/40 text-sm font-body uppercase tracking-widest">Connecting...</p>
      </div>
    </div>
  );
}
