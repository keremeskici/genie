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
  const [status, setStatus] = useState<string>('Initializing...');
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isInstalled || hasAttemptedAuth.current) {
      if (!isInstalled && mounted) {
        setStatus('World ID MiniKit not detected.');
      }
      return;
    }
    hasAttemptedAuth.current = true;

    const onboardingDone = typeof window !== 'undefined' ? localStorage.getItem('genie_onboarding_done') === '1' : false;

    setStatus('Checking for existing session...');
    setDebugInfo(prev => ({ ...prev, isInstalled, apiUrl: process.env.NEXT_PUBLIC_API_URL }));

    getSession().then((session) => {
      setDebugInfo(prev => ({ ...prev, hasExistingSession: !!session }));
      if (session) {
        setStatus('Session found. Redirecting...');
        if (session.user?.needsOnboarding && !onboardingDone) {
          router.push('/onboarding');
        } else {
          router.push('/home');
        }
      } else {
        setStatus('No session. Requesting wallet authentication...');
        walletAuth()
          .then(async () => {
            setStatus('Wallet approved. Finalizing session...');
            const freshSession = await getSession();
            setDebugInfo(prev => ({ ...prev, hasFreshSession: !!freshSession }));
            if (!freshSession) {
              setAuthError('Failed to obtain a session after approval. Backend may be unreachable.');
              return;
            }
            setStatus('Sign in successful. Redirecting...');
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
  }, [isInstalled, router, mounted]);

  if (mounted && !isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-6 px-8 text-center">
          <p className="text-white text-lg font-body font-semibold">Open in World App</p>
          <p className="text-white/40 text-sm font-body">
            This app must be opened inside the World App to work.
          </p>
          <div className="mt-4 p-4 bg-surface rounded-xl text-left w-full overflow-hidden border border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-headline">Debug Info</p>
            <pre className="text-[10px] text-white/60 font-mono whitespace-pre-wrap break-all">
              {JSON.stringify({ isInstalled, mounted, apiUrl: process.env.NEXT_PUBLIC_API_URL }, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-6 w-full max-w-sm">
        <div className="w-12 h-12 rounded-full border-2 border-t-accent border-white/10 animate-spin" />
        
        <div className="text-center space-y-2">
          <p className="text-white/80 text-sm font-body font-medium">{status}</p>
          {authError && (
            <p className="text-red-400 text-xs font-body">{authError}</p>
          )}
        </div>

        {authError && (
          <button
            onClick={() => { hasAttemptedAuth.current = false; setAuthError(null); setStatus('Retrying...'); }}
            className="w-full py-4 bg-accent text-black font-headline font-bold text-xs uppercase tracking-widest rounded-2xl active:scale-95 transition-transform"
          >
            Try Again
          </button>
        )}

        <div className="mt-8 p-4 bg-surface rounded-xl text-left w-full overflow-hidden border border-white/5">
          <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 font-headline">Debug Console</p>
          <pre className="text-[10px] text-white/60 font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
