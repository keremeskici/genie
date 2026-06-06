'use client';
import { LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { isDemoVerified, setDemoVerified } from '@/lib/demo-verification';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

/**
 * This component is an example of how to use World ID verification via IDKit.
 * Verification now goes through IDKit end-to-end (both native World App and web).
 * It's critical you verify the proof on the server side.
 * Read More: https://docs.world.org/mini-apps/commands/verify#verifying-the-proof
 */
interface VerifyProps {
  onVerified?: () => void;
}

export const Verify = ({ onVerified }: VerifyProps = {}) => {
  const { data: session } = useSession();
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);

  useEffect(() => {
    if (isDemoVerified(session?.user?.id)) {
      setButtonState('success');
    }
  }, [session?.user?.id]);

  const onClickVerify = async () => {
    setButtonState('pending');
    try {
      // Temporary mock while the real World ID flow is disabled.
      await new Promise((resolve) => setTimeout(resolve, 350));
      setDemoVerified(session?.user?.id, true);
      setButtonState('success');
      onVerified?.();
    } catch {
      setButtonState('failed');
      setTimeout(() => setButtonState(undefined), 2000);
    }
  };

  return (
    <div className="grid w-full gap-4">
      <LiveFeedback
        label={{
          failed: 'Failed to verify',
          pending: 'Verifying',
          success: 'Verified',
        }}
        state={buttonState}
        className="w-full"
      >
        <div className="w-full rounded-full bg-white p-1">
          <button
            type="button"
            onClick={onClickVerify}
            disabled={buttonState === 'pending'}
            className="inline-flex min-h-14 w-full items-center justify-center rounded-full bg-white px-6 py-4 text-base font-headline font-black uppercase tracking-[0.18em] !text-black active:scale-95 transition-transform duration-150 disabled:opacity-70 disabled:active:scale-100"
            style={{ color: '#000000' }}
          >
            Verify with World ID
          </button>
        </div>
      </LiveFeedback>
    </div>
  );
};
