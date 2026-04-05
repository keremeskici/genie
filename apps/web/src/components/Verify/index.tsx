'use client';
import { IDKit, orbLegacy, type RpContext } from '@worldcoin/idkit';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useState } from 'react';

interface VerifyProps {
  onVerified?: () => void;
}

function dlog(step: string, data?: unknown) {
  fetch('/api/debug-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step, data, ts: Date.now() }),
  }).catch(() => {});
}

export const Verify = ({ onVerified }: VerifyProps = {}) => {
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);

  const WORLD_ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION ?? 'verify-human';

  const onClickVerify = async () => {
    setButtonState('pending');
    try {
      // Step 1: Fetch RP signature
      dlog('1-start', { action: WORLD_ACTION });
      const rpRes = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: WORLD_ACTION }),
      });

      if (!rpRes.ok) {
        const errText = await rpRes.text();
        dlog('1-fail', { status: rpRes.status, body: errText });
        throw new Error(`RP signature failed: ${rpRes.status}`);
      }

      const rpSig = await rpRes.json();
      dlog('1-done', {
        rp_id: rpSig.rp_id,
        nonce: rpSig.nonce?.slice(0, 10),
        created_at: rpSig.created_at,
        expires_at: rpSig.expires_at,
        sig_len: rpSig.sig?.length,
      });

      const rpContext: RpContext = {
        rp_id: rpSig.rp_id,
        nonce: rpSig.nonce,
        created_at: rpSig.created_at,
        expires_at: rpSig.expires_at,
        signature: rpSig.sig,
      };

      // Step 2: IDKit request
      dlog('2-start', {
        app_id: process.env.NEXT_PUBLIC_APP_ID,
        action: WORLD_ACTION,
      });

      const request = await IDKit.request({
        app_id: process.env.NEXT_PUBLIC_APP_ID as `app_${string}`,
        action: WORLD_ACTION,
        rp_context: rpContext,
        allow_legacy_proofs: true,
      }).preset(orbLegacy({ signal: '' }));

      dlog('2-polling');
      const completion = await request.pollUntilCompletion();

      if (!completion.success) {
        dlog('2-fail', {
          success: false,
          error: (completion as Record<string, unknown>).error,
          full: JSON.stringify(completion).slice(0, 500),
        });
        setButtonState('failed');
        setTimeout(() => setButtonState(undefined), 2000);
        return;
      }

      dlog('2-done', {
        protocol_version: (completion.result as unknown as Record<string, unknown>)?.protocol_version,
        has_responses: !!(completion.result as unknown as Record<string, unknown>)?.responses,
      });

      // Step 3: Verify proof on server
      dlog('3-start');
      const response = await fetch('/api/verify-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rp_id: rpContext.rp_id,
          idkitResponse: completion.result,
        }),
      });

      if (response.ok) {
        dlog('3-done', { success: true });
        setButtonState('success');
        onVerified?.();
      } else {
        const errBody = await response.text();
        dlog('3-fail', { status: response.status, body: errBody.slice(0, 500) });
        setButtonState('failed');
        setTimeout(() => setButtonState(undefined), 2000);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dlog('catch', { error: msg, stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined });
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
