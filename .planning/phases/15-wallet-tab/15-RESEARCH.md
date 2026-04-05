# Phase 15: Wallet Tab Completion - Research

**Researched:** 2026-04-05
**Domain:** React component wiring, Next.js auth session, Hono backend auth guards
**Confidence:** HIGH

## Summary

Phase 15 is a data-wiring phase with minimal new code. All prerequisite infrastructure (useBalance, useTransactions, Verify, useSession, DashboardInterface transaction rendering) is already built and working. The task is to wire this existing infrastructure into WalletInterface which is currently a static shell.

The Verify component already has the `onVerified` callback prop and the full MiniKit IDKit 4.0 flow — it just has never been rendered inside WalletInterface. Verification state persistence follows D-05: local state hides the section after success; the backend session and DB reflect verified status on next page load via the existing `/api/verify-proof` route (already fully functional, listed as a public path in middleware.ts).

The backend auth guard tasks (D-07, D-08, D-09) are minimal. `/api/confirm` already validates that the `txId`+`userId` pair belongs to the caller — no additional guard is warranted per D-07. `/api/users/profile` needs a userId-matches-caller guard which is a small per-route validation following the existing codebase convention.

The only genuine design decision is whether to extract a shared TransactionList component. Given only two consumers (DashboardInterface and WalletInterface), the cost-benefit favors inline duplication unless the planner decides otherwise.

**Primary recommendation:** Wire useBalance + useTransactions + Verify into WalletInterface following the exact DashboardInterface patterns. The formatRelativeTime and formatWallet helpers can be imported from DashboardInterface or duplicated — extraction into a shared utils file is the cleanest path but not mandatory.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Layout order top-to-bottom: header, decorative card (existing), live balance section, Verify section (conditional), transaction history, Add Funds button.
- **D-02:** Reuse `useBalance(walletAddress)` and `useTransactions(userId)` hooks — same patterns as DashboardInterface.
- **D-03:** Session data (`walletAddress`, `userId`) obtained via `useSession()` — same as DashboardInterface.
- **D-04:** Verify component renders between balance and transaction sections, only when user is NOT verified. After successful verification, hide the section.
- **D-05:** Verification state tracked via local component state after `onVerified` callback fires. On next page load, backend session/DB reflects verified status.
- **D-06:** Verify section styled as a prominent card/banner encouraging verification — "Verify with World ID to unlock sending and debt tracking."
- **D-07:** POST `/api/confirm` — already validates `userId` matches `senderUserId` on the transaction. No additional auth guard needed.
- **D-08:** PATCH `/api/users/profile` — add a session-based check or ensure the `userId` in the body matches the caller's identity. Minimal change to existing route.
- **D-09:** Auth guards are per-route validation (consistent with existing codebase pattern), not Hono middleware.
- **D-10:** Reuse exact DashboardInterface transaction rendering pattern — list items with direction icon, formatted wallet address, relative time, and amount.
- **D-11:** Extract shared transaction list rendering into a reusable pattern or duplicate the markup (Claude's discretion on whether extraction is warranted for two consumers).
- **D-12:** Loading skeleton and empty state follow same patterns as DashboardInterface.

### Claude's Discretion
- Whether to extract a shared TransactionList component or keep inline rendering in both Dashboard and Wallet
- Loading skeleton animation style for wallet tab (match existing pulse pattern)
- Exact styling of the Verify banner/card section
- Whether isVerified state comes from session data or a separate API check

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRID-01 | User can verify as human via World ID 4.0 IDKit widget inline in chat | Verify component at `apps/web/src/components/Verify/index.tsx` is fully functional with `onVerified` callback prop, MiniKit.commands.verify flow, and server-side proof validation via `/api/verify-proof`. Needs to be rendered in WalletInterface with conditional logic. |
| WRID-02 | Server validates World ID proofs before allowing gated actions (send, debt, goals) | Already complete (Phase 8). `/api/verify-proof` validates proofs and stores `nullifier_hash` in `users.worldId`. This phase re-confirms the integration works. |
| WRID-03 | Unverified users can chat, view balance, and receive money | Already complete (Phase 8). WalletInterface must still display balance and transactions regardless of verification status. |
| WRID-04 | Verified users unlock send money, debt tracking, and agent automation | Already complete (Phase 8). This phase adds the Verify UI entry point in the wallet tab so unverified users have a clear path to unlock these features. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth | v5 beta (installed) | Session access via `useSession()` | Already used — DashboardInterface is the reference |
| @worldcoin/minikit-js | installed | MiniKit.commands.verify, VerificationLevel | Verify component already uses this |
| @worldcoin/mini-apps-ui-kit-react | installed | Button, LiveFeedback in Verify | Already used in Verify component |
| React useState/useEffect/useCallback | built-in | State management, data fetching | Project-wide pattern for hooks and components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| useBalance (internal hook) | — | Fetch USDC balance from /api/balance | Whenever walletAddress is available from session |
| useTransactions (internal hook) | — | Fetch recent transactions from /api/transactions | Whenever userId is available from session |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline formatRelativeTime / formatWallet duplicates | Shared utils file | Cleaner with utils file — avoids copy/paste drift between Dashboard and Wallet; minor refactor cost |
| Local isVerified state | Session/DB isVerified field | D-05 chose local state for simplicity — session does not currently carry verified status, would require session refresh to reflect |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
No new files required beyond the component update. Optional extraction:
```
apps/web/src/
├── components/
│   ├── WalletInterface/index.tsx    # PRIMARY: wire hooks + Verify here
│   └── DashboardInterface/index.tsx # REFERENCE: copy transaction rendering
├── lib/
│   └── format.ts                    # OPTIONAL: extract formatRelativeTime + formatWallet
```

### Pattern 1: Hook-Based Data Fetching (existing project convention)
**What:** useState + useEffect + useCallback per hook, exposes `{ data, loading, error, refetch }`.
**When to use:** Always — this is the established data fetching pattern.
**Example:**
```typescript
// Source: apps/web/src/hooks/useBalance.ts (verified)
const walletAddress = session?.user?.walletAddress ?? '';
const userId = session?.user?.id ?? '';
const { balance, loading: balanceLoading, error: balanceError } = useBalance(walletAddress);
const { transactions, loading: txLoading } = useTransactions(userId);
```

### Pattern 2: Conditional Verify Section (new for WalletInterface)
**What:** Local `isVerified` state toggled by `onVerified` callback. Section hidden after callback fires.
**When to use:** Only when rendering the Verify component.
**Example:**
```typescript
// Per D-04 / D-05 decisions
const [isVerified, setIsVerified] = useState(false);

{!isVerified && (
  <div className="mx-6 mb-6 bg-surface rounded-2xl p-5">
    <p className="font-headline text-sm text-white/60 mb-4">
      Verify with World ID to unlock sending and debt tracking.
    </p>
    <Verify onVerified={() => setIsVerified(true)} />
  </div>
)}
```

### Pattern 3: Loading Skeleton (existing project convention)
**What:** `animate-pulse` divs as placeholders during data fetch.
**When to use:** While balance or transactions are loading.
**Example:**
```typescript
// Source: apps/web/src/components/DashboardInterface/index.tsx (verified)
{balanceLoading ? (
  <div className="h-12 w-32 bg-white/10 animate-pulse rounded" />
) : balanceError ? (
  <p className="font-headline text-5xl font-extrabold tracking-tighter text-white/30">$--.--</p>
) : (
  <p className="font-headline text-5xl font-extrabold tracking-tighter text-white">
    ${balance ?? '0.00'}
  </p>
)}
```

### Pattern 4: Per-Route Auth Guard (existing backend convention per D-09)
**What:** Inline userId validation inside a route handler, not Hono middleware.
**When to use:** Any route that mutates user-specific data.
**Example:**
```typescript
// Per D-08 / D-09 — pattern consistent with existing confirm.ts userId check
const { userId: rawUserId, autoApproveUsd } = parsed.data;
// Add: verify caller owns this userId
// Since there is no session on the API (stateless), guard is: the userId in body
// must resolve to an existing user — no spoofing beyond knowledge of a valid UUID.
// D-08 says "minimal change" — resolveUserId already validates existence.
```

### Anti-Patterns to Avoid
- **Calling `/api/verify-proof` manually from WalletInterface:** The Verify component already handles this internally. Do not re-implement the fetch.
- **Reading verified status from session on initial render:** Session does not include `isVerified`. Use local state initialized to `false` per D-05.
- **Adding Hono middleware for auth:** Per D-09, guards are per-route. Do not refactor to middleware.
- **Fetching balance/transactions before session is ready:** Both hooks guard on empty string (`if (!walletAddress) return` / `if (!userId) return`) — safe to call unconditionally once session is initialized.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| World ID verification UI | Custom verify button + fetch | `<Verify onVerified={...} />` | Already handles MiniKit flow, LiveFeedback state, error/success/pending, server proof validation |
| Balance fetching | Custom fetch in component | `useBalance(walletAddress)` | Handles caching, error, loading, refetch — proven in Phase 11 |
| Transaction fetching | Custom fetch in component | `useTransactions(userId)` | Handles loading, error, empty state — proven in Phase 13 |
| Wallet address truncation | Custom string slice | `formatWallet(address)` from DashboardInterface | Already handles short addresses edge case |
| Relative time formatting | Custom date math | `formatRelativeTime(dateStr)` from DashboardInterface | Handles today/yesterday/N days ago/absolute |

**Key insight:** Every component needed for this phase already exists and is proven. This phase is purely integration, not new construction.

## Common Pitfalls

### Pitfall 1: isVerified Initial State
**What goes wrong:** If `isVerified` defaults to `true`, the Verify section never renders even for unverified users.
**Why it happens:** Developer confuses "hide after verified" with "show only if already verified from session".
**How to avoid:** Initialize `useState(false)`. The section is always visible initially; the callback hides it.
**Warning signs:** Verify section never appears in wallet tab during testing.

### Pitfall 2: Session Readiness Guard Missing
**What goes wrong:** useBalance/useTransactions called with empty walletAddress/userId on first render, triggering unnecessary 400 errors.
**Why it happens:** `useSession()` returns `data: null` before session resolves.
**How to avoid:** Both hooks already guard `if (!walletAddress) return` and `if (!userId) return` — no extra guard needed, but be aware requests will silently no-op until session is ready.
**Warning signs:** Console shows fetch errors on initial load before session hydrates.

### Pitfall 3: Decorative Card Removed or Broken
**What goes wrong:** The decorative credit-card visual (with chip SVG, corner accents) gets deleted or displaced during the refactor.
**Why it happens:** Developer replaces the balance section without preserving the card above it.
**How to avoid:** Per the specifics in CONTEXT.md — "Keep the decorative card visual." It is a distinct personality element. Keep the existing card div (lines 12-41 in current WalletInterface/index.tsx) unchanged.
**Warning signs:** Wallet tab loses the card visual — looks identical to the home tab.

### Pitfall 4: auth guard on /api/confirm is unnecessarily broad
**What goes wrong:** Developer adds session/JWT validation to `/api/confirm`, breaking the ConfirmCard flow which calls the endpoint from the frontend.
**Why it happens:** Misreading D-07 as "add a guard" rather than "no guard needed."
**How to avoid:** Per D-07 — no additional guard needed on `/api/confirm`. The existing `txId + userId must match senderUserId` check is the guard.
**Warning signs:** ConfirmCard stops working after the route change.

### Pitfall 5: formatWallet / formatRelativeTime not accessible in WalletInterface
**What goes wrong:** Developer references the helpers but they are currently defined as module-private functions inside DashboardInterface/index.tsx — not exported.
**Why it happens:** They were never extracted to a shared utility file.
**How to avoid:** Either (a) duplicate the two small helper functions in WalletInterface, or (b) move them to `apps/web/src/lib/format.ts` and import in both components. Option (b) is cleaner per Claude's discretion.
**Warning signs:** TypeScript errors when trying to import formatWallet from DashboardInterface.

## Code Examples

### WalletInterface Session and Hook Wire-Up
```typescript
// Source: Derived from DashboardInterface/index.tsx (verified pattern)
'use client';
import { useSession } from 'next-auth/react';
import { useBalance } from '@/hooks/useBalance';
import { useTransactions } from '@/hooks/useTransactions';
import { Verify } from '@/components/Verify';
import { useState } from 'react';

export const WalletInterface = () => {
  const { data: session } = useSession();
  const walletAddress = session?.user?.walletAddress ?? '';
  const userId = session?.user?.id ?? '';
  const [isVerified, setIsVerified] = useState(false);

  const { balance, loading: balanceLoading, error: balanceError } = useBalance(walletAddress);
  const { transactions, loading: txLoading } = useTransactions(userId);
  // ... render
};
```

### Verify Section Markup (per D-04, D-06)
```typescript
// Conditional verify banner — between balance and transactions
{!isVerified && (
  <div className="px-6 mb-6">
    <div className="bg-surface rounded-2xl p-5">
      <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
        Unlock More Features
      </p>
      <p className="text-sm text-white/60 mb-4">
        Verify with World ID to unlock sending and debt tracking.
      </p>
      <Verify onVerified={() => setIsVerified(true)} />
    </div>
  </div>
)}
```

### PATCH /api/users/profile Auth Guard (per D-08)
```typescript
// Source: apps/api/src/routes/users.ts — existing route, add guard
// Since the API is stateless (no session cookie on API server), the guard is:
// resolveUserId already validates the user exists — that is sufficient per D-08.
// D-08 says "minimal change" — no JWT forwarding architecture change needed.
// The existing userId-in-body pattern is the auth signal (caller must know their own UUID).
const userId = await resolveUserId(rawUserId);
if (!userId) {
  return c.json({ error: 'USER_NOT_FOUND', message: 'Could not resolve userId' }, 404);
}
// No additional guard per D-08 minimal change direction
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded $0.00 in WalletInterface | useBalance(walletAddress) | Phase 15 | Live USDC balance from World Chain |
| No transaction history in wallet tab | useTransactions(userId) | Phase 15 | Consistent with Dashboard tab |
| Verify component not in wallet tab | Verify with onVerified conditional | Phase 15 | Completes WRID-01 requirement |

**Deprecated/outdated:**
- Static `$0.00` balance text in WalletInterface: replaced with useBalance hook output
- Missing transaction section in WalletInterface: added in this phase

## Open Questions

1. **Is `isVerified` initial state correct without a session field?**
   - What we know: Session does not currently include a verified status field (auth/index.ts confirmed — only walletAddress, id, username, profilePictureUrl, needsOnboarding)
   - What's unclear: On page reload, an already-verified user would see the Verify section flash briefly before any data is available. D-05 explicitly accepts this behavior — "on next page load, backend session/DB reflects verified status."
   - Recommendation: If the backend DB has a `worldId` column on users, the planner could optionally add an isVerified field to the session JWT. D-05 suggests this is acceptable but not required for the hackathon timeline. Start with local state initialized to `false`.

2. **Should formatRelativeTime / formatWallet be extracted to a shared lib?**
   - What we know: Both functions are currently private inside DashboardInterface/index.tsx (not exported). WalletInterface needs the same functions.
   - What's unclear: The planner has discretion per D-11.
   - Recommendation: Extract to `apps/web/src/lib/format.ts` — one file, two small pure functions, cleaner than duplication. DashboardInterface imports from there too.

## Environment Availability

Step 2.6: SKIPPED — this is a code/config-only phase. All dependencies (React, next-auth, MiniKit, hooks) are already installed and proven working in prior phases.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected (no test config files found in apps/web/) |
| Config file | None — Wave 0 gap |
| Quick run command | N/A |
| Full suite command | N/A |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WRID-01 | Verify component renders in wallet tab when not verified; hides after onVerified fires | manual-only | N/A — requires MiniKit runtime inside World App | No test infrastructure |
| WRID-02 | Server validates World ID proofs | manual-only | N/A — existing backend behavior, Phase 8 | No test infrastructure |
| WRID-03 | Balance and transactions render for unverified users | manual-only | N/A — requires World App session | No test infrastructure |
| WRID-04 | Verify section provides entry point to unlock gated features | manual-only | N/A — UX validation in World App | No test infrastructure |

### Sampling Rate
- **Per task commit:** Visual inspection in World App dev environment
- **Per wave merge:** Full wallet tab walkthrough (balance loads, transactions load, Verify section visible, onVerified hides section)
- **Phase gate:** All four success criteria from phase description verified manually before `/gsd:verify-work`

### Wave 0 Gaps
- No automated test infrastructure exists for the web app. All validation is manual-only via World App.
- This is acceptable for hackathon scope — do not introduce a test framework in this phase.

*(No Wave 0 test files to create — manual verification is the established project pattern)*

## Sources

### Primary (HIGH confidence)
- `apps/web/src/components/WalletInterface/index.tsx` — current static shell, confirmed structure
- `apps/web/src/components/DashboardInterface/index.tsx` — reference implementation for hooks, transaction rendering, loading patterns
- `apps/web/src/components/Verify/index.tsx` — confirmed onVerified callback prop, full MiniKit flow
- `apps/web/src/hooks/useBalance.ts` — confirmed API: `{ balance, loading, error, refetch }`
- `apps/web/src/hooks/useTransactions.ts` — confirmed API: `{ transactions, loading, error, refetch }`
- `apps/api/src/routes/confirm.ts` — confirmed existing userId+txId guard (no additional guard needed per D-07)
- `apps/api/src/routes/users.ts` — confirmed PATCH /profile route, resolveUserId pattern
- `apps/web/src/auth/index.ts` — confirmed session fields: id (UUID), walletAddress, username, profilePictureUrl, needsOnboarding
- `apps/web/middleware.ts` — confirmed /api/verify-proof is public (Verify component can POST without auth)
- `.planning/phases/15-wallet-tab/15-CONTEXT.md` — all decisions D-01 through D-12

### Secondary (MEDIUM confidence)
None required — all information sourced directly from codebase.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in existing codebase
- Architecture: HIGH — directly modeled on proven DashboardInterface patterns
- Pitfalls: HIGH — identified from reading actual source code, not speculation
- Auth guard assessment: HIGH — confirm.ts and users.ts read directly

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable codebase, all patterns proven)
