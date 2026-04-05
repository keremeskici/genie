'use client';
import { IDKit, orbLegacy, type RpContext } from '@worldcoin/idkit';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useState } from 'react';

/**
 * World ID Verification Component (RP Signature Method)
 * This uses the custom RP signature flow for verification.
 */
interface VerifyProps {
  onVerified?: () => void;
}

export const Verify = ({ onVerified }: VerifyProps = {}) => {
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);

  const WORLD_ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION ?? 'verify-human';

  const onClickVerify = async () => {
    setButtonState('pending');
    try {
      // Step 1: Fetch RP signature from your backend
      const rpRes = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: WORLD_ACTION }),
      });

      if (!rpRes.ok) {
        throw new Error('Failed to get RP signature');
      }

      const rpSig = await rpRes.json();
      const rpContext: RpContext = {
        rp_id: rpSig.rp_id,
        nonce: rpSig.nonce,
        created_at: rpSig.created_at,
        expires_at: rpSig.expires_at,
        signature: rpSig.sig,
      };

      // Step 2: Use IDKit request API with RP context
      const request = await IDKit.request({
        app_id: process.env.NEXT_PUBLIC_APP_ID as `app_${string}`,
        action: WORLD_ACTION,
        rp_context: rpContext,
        allow_legacy_proofs: true,
      }).preset(orbLegacy({ signal: '' }));

      const completion = await request.pollUntilCompletion();

      if (!completion.success) {
        setButtonState('failed');
        setTimeout(() => setButtonState(undefined), 2000);
        return;
      }

      // Step 3: Verify the proof on the server
      const response = await fetch('/api/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: completion.result,
          action: WORLD_ACTION,
        }),
      });

      const data = await response.json();
      if (response.ok && data.verifyRes?.success) {
        setButtonState('success');
        onVerified?.();
      } else {
        setButtonState('failed');
        setTimeout(() => setButtonState(undefined), 2000);
      }
    } catch (err) {
      console.error('[Verify] RP flow failed:', err);
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
        <Button
          onClick={onClickVerify}
          disabled={buttonState === 'pending'}
          size="lg"
          variant="primary"
          className="w-full !bg-white !text-black"
        >
          Verify with World ID
        </Button>
      </LiveFeedback>
    </div>
  );
};
