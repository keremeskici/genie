'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { ApprovalOverlay } from '../ApprovalOverlay';

export interface ApprovalCardData {
  type: 'approval_required';
  amount: number;
  approvalAmount?: number;
  token?: 'USDC';
  spender: string;
  reason?: string;
}

export function parseApprovalCard(text: string): ApprovalCardData | null {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (
      parsed.type === 'approval_required' &&
      typeof parsed.amount === 'number' &&
      parsed.amount > 0 &&
      typeof parsed.spender === 'string'
    ) {
      return parsed as ApprovalCardData;
    }
  } catch {
    // Not valid JSON, render as markdown.
  }

  return null;
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function ApprovalCard({ data }: { data: ApprovalCardData }) {
  const { data: session } = useSession();
  const [showOverlay, setShowOverlay] = useState(false);
  const [approved, setApproved] = useState(false);
  const token = data.token ?? 'USDC';
  const approvalAmount = data.approvalAmount ?? data.amount;

  return (
    <div className="mt-3 bg-background border border-white/10 p-4 rounded-lg">
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-accent text-base">verified_user</span>
        <span className="text-xs uppercase tracking-widest text-white/50">USDC Approval</span>
      </div>

      <p className="text-2xl font-bold text-white">
        ${approvalAmount} {token}
      </p>
      <p className="text-sm text-white/60 mb-4">
        Allow Genie router {truncateAddress(data.spender)} to spend up to this amount from your wallet.
      </p>

      {approved ? (
        <div className="text-sm text-accent font-bold">Approved. Retry the transfer when ready.</div>
      ) : (
        <button
          onClick={() => setShowOverlay(true)}
          className="bg-accent text-black px-6 py-2.5 text-sm font-bold uppercase tracking-widest rounded-lg active:scale-95 transition-transform"
        >
          Approve {token}
        </button>
      )}

      {data.reason && <p className="text-xs text-white/40 mt-3">{data.reason}</p>}

      {showOverlay && (
        <ApprovalOverlay
          budgetUsd={approvalAmount}
          walletAddress={session?.user?.walletAddress}
          onSuccess={() => {
            setApproved(true);
            setShowOverlay(false);
          }}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </div>
  );
}
