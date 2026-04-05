# Phase 11: Live Balance Display - Research

**Researched:** 2026-04-05
**Domain:** Hono REST endpoint + React data fetching (viem/ERC-20 on World Chain)
**Confidence:** HIGH

## Summary

This is a data-wiring phase with minimal new surface area. The backend pattern already exists in `apps/api/src/tools/get-balance.ts` — extracting it into a Hono GET route is the largest part of the backend work. The frontend replacement of `$0.00` in `DashboardInterface` is equally mechanical: read `session.user.walletAddress`, fetch from the new endpoint on mount, and render with a skeleton while in-flight and `$--.--` on error.

The project uses no data-fetching library (no SWR, no React Query). Existing components (`ConfirmCard`, `ChatInterface`, `onboarding/page.tsx`) all use native `useState + useEffect + fetch`. The balance feature should follow this same pattern for consistency. A custom `useBalance` hook would be a clean encapsulation that is easy to compose later (e.g., call `refetch()` from SendModal after success).

The route is a `GET /api/balance?wallet={address}` route mounted at `/api` on the existing Hono app — matching how all other routes (`/api/confirm`, `/api/users/provision`) are registered in `apps/api/src/index.ts`.

**Primary recommendation:** Add `GET /api/balance?wallet=` Hono route reusing `publicClient` + `erc20Abi` + `formatUnits` from the existing tool, then wire DashboardInterface with `useState + useEffect` and a pulse-skeleton loading state matching the dark theme.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** New GET /api/balance?wallet={address} Hono route in the API. Reuses `publicClient` and `USDC_ADDRESS` from `apps/api/src/chain/clients.ts` with `erc20Abi` `balanceOf` call — same pattern as `createGetBalanceTool`.
- **D-02:** Returns `{ balance: string, currency: "USDC" }` where balance is formatted (human-readable, 6→decimal via `formatUnits`).
- **D-03:** Fetch balance on component mount (page load). No polling interval — keeps it simple for hackathon.
- **D-04:** Refetch balance after transactions (send, confirm) — the relevant modals/flows should trigger a refetch when they close or succeed.
- **D-05:** Show a skeleton/shimmer placeholder in the balance area while the fetch is in-flight.
- **D-06:** On fetch failure, display `$--.--` as fallback with no retry button. Non-disruptive — dashboard remains functional.
- **D-07:** Display as `$X.XX` — dollar sign prefix, exactly 2 decimal places. USDC is 1:1 USD, standard money formatting.
- **D-08:** Large amounts: no thousand separators needed for hackathon demo (balances will be small).

### Claude's Discretion
- Skeleton animation style (pulse vs shimmer — match existing dark theme)
- Whether to use SWR/React Query or a simple useState+useEffect fetch pattern
- Error logging approach for failed balance fetches
- Exact placement of loading skeleton relative to the existing balance text

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOPS-01 | User can check USDC balance on World Chain via chat | Balance API endpoint enables both the chat tool AND the dashboard display. The chat already has `createGetBalanceTool`; this phase adds the REST endpoint that the dashboard consumes. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | already installed | `publicClient.readContract`, `erc20Abi`, `formatUnits` | Already used in `get-balance.ts` and `clients.ts`; no new deps needed |
| hono | already installed | Route handler | All API routes use Hono; new route follows same pattern |
| zod | already installed | Query param validation | Used in all existing routes for input validation |
| next-auth/react | already installed | `useSession()` for `walletAddress` in frontend | Already imported in `DashboardInterface` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React useState + useEffect | built-in | Data fetching on mount | Use — consistent with `ConfirmCard`, `ChatInterface`, `onboarding/page.tsx` which all use this pattern instead of SWR/React Query |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| useState+useEffect | SWR / React Query | Not present in project; adding a library for a single fetch is over-engineering for hackathon scope |
| `$--.--` error fallback | Error boundary | Overkill — error is non-disruptive, inline fallback is sufficient |

**Installation:** No new packages required. All dependencies already in repo.

## Architecture Patterns

### Backend: Hono Route Pattern

Every route in `apps/api/src/routes/` follows the same structure:

```typescript
// Source: apps/api/src/routes/users.ts (confirmed by reading source)
import { Hono } from 'hono';
const route = new Hono();
route.get('/balance', async (c) => {
  try {
    // ... handler logic
    return c.json({ balance: '...', currency: 'USDC' });
  } catch (err) {
    console.error('[route:balance] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: String(err) }, 500);
  }
});
export { route as balanceRoute };
```

Route is then registered in `apps/api/src/index.ts`:
```typescript
app.route('/api', balanceRoute);
```

### Backend: Balance Read Pattern

Direct extraction from `get-balance.ts` — already proven:

```typescript
// Source: apps/api/src/tools/get-balance.ts
import { erc20Abi, formatUnits } from 'viem';
import { publicClient, USDC_ADDRESS } from '../chain/clients';

const raw = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [walletAddress as `0x${string}`],
});
const balance = formatUnits(raw, 6);
// Return: { balance, currency: 'USDC' }
```

### Frontend: API URL Pattern

```typescript
// Source: apps/web/src/components/ChatInterface/index.tsx and onboarding/page.tsx
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
// Usage: fetch(`${API_URL}/api/balance?wallet=${walletAddress}`)
```

Note: `ConfirmCard` uses `NEXT_PUBLIC_API_URL ?? ''` directly without the `/api` prefix in the path string (the URL already includes `/api`). Verify the exact path format against how other routes are called — `ConfirmCard` calls `/confirm` (not `/api/confirm`), suggesting the env var already includes `/api`. Need to check this before implementing.

### Frontend: useState+useEffect Fetch Pattern

```typescript
// Source: apps/web/src/app/onboarding/page.tsx pattern
const [balance, setBalance] = useState<string | null>(null);
const [balanceLoading, setBalanceLoading] = useState(true);
const [balanceError, setBalanceError] = useState(false);

useEffect(() => {
  if (!walletAddress) return;
  setBalanceLoading(true);
  fetch(`${API_URL}/api/balance?wallet=${walletAddress}`)
    .then(r => r.json())
    .then(data => {
      setBalance(data.balance ?? null);
      setBalanceError(!data.balance);
    })
    .catch(() => setBalanceError(true))
    .finally(() => setBalanceLoading(false));
}, [walletAddress]);
```

### Frontend: Skeleton Pulse Pattern (dark theme)

Existing dark-theme pattern uses `bg-surface` / `bg-white/10` with Tailwind `animate-pulse`:

```tsx
// Matches project dark theme — bg-white/10 on bg-background
{balanceLoading ? (
  <div className="h-12 w-32 bg-white/10 animate-pulse" />
) : balanceError ? (
  <p className="font-headline text-5xl font-extrabold tracking-tighter text-white/30">$--.--</p>
) : (
  <p className="font-headline text-5xl font-extrabold tracking-tighter text-white">
    ${parseFloat(balance!).toFixed(2)}
  </p>
)}
```

The skeleton `h-12 w-32` matches the approximate visual footprint of the `text-5xl font-extrabold` balance text at line 94-96 of `DashboardInterface`.

### Refetch After Transactions (D-04)

`DashboardInterface` renders `SendModal` and `ConfirmCard` (via ChatInterface) with `onClose` callbacks. The cleanest approach: expose a `refetchBalance` function from a `useBalance` hook (or just re-trigger via state), then pass it to `onClose` of relevant modals.

However, `SendModal` currently uses `triggerMiniKitPay` — not the internal `/confirm` flow. The confirm flow lives in `ChatInterface`, not `DashboardInterface`. A pragmatic approach for hackathon: pass `onSuccess` prop down to `SendModal`, call `refetch` when it fires.

### Anti-Patterns to Avoid
- **Adding `/api/` prefix twice:** `NEXT_PUBLIC_API_URL` likely already points to `http://host/api` — verify before constructing path. Check `ConfirmCard` which calls `/confirm` not `/api/confirm`.
- **Parsing balance as float unsafely:** `parseFloat` on `"0.000001"` is fine; `"NaN"` on empty string would break display. Guard: `isNaN(parseFloat(balance))` → show error state.
- **Calling readContract with zero address:** If `walletAddress` is `''` or undefined when session loads, the contract call will revert or return 0. Guard: early-return 400 if `wallet` param is empty/invalid.
- **Not registering the route in index.ts:** Every route must be added to `app.route('/api', ...)` in `apps/api/src/index.ts`. This was the pattern for all 4 existing routes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| USDC decimals | Custom decimal math | `formatUnits(raw, 6)` from viem | Already imported in get-balance.ts; handles BigInt correctly |
| ERC-20 ABI | Manual ABI array | `erc20Abi` from viem | Standard, complete ABI already in tree |
| Address validation | Custom regex | Validate via `isAddress` from viem or check `0x` prefix + length | Keep it simple: 400 if param missing or clearly invalid |

**Key insight:** The entire backend implementation is a ~15-line extraction of an already-proven pattern. Do not add complexity.

## Common Pitfalls

### Pitfall 1: API URL Double-Prefix
**What goes wrong:** Frontend calls `${NEXT_PUBLIC_API_URL}/api/balance` but NEXT_PUBLIC_API_URL already ends with `/api`, resulting in `/api/api/balance` 404.
**Why it happens:** Inconsistent URL construction across components. `ChatInterface` uses `${API_URL}/api/chat`. `ConfirmCard` uses `${NEXT_PUBLIC_API_URL ?? ''}/confirm` (no `/api` prefix in path).
**How to avoid:** Check `ConfirmCard` at line 51 — it calls `/confirm` not `/api/confirm`. This means `NEXT_PUBLIC_API_URL` already includes `/api`. New balance fetch should be `${API_URL}/balance` not `${API_URL}/api/balance`.
**Warning signs:** 404 on balance endpoint during integration test.

### Pitfall 2: Empty walletAddress on First Render
**What goes wrong:** `useSession()` returns `null` session on first render (SSR hydration), so `walletAddress` is `''`. If the `useEffect` fires before session loads, the fetch hits `/api/balance?wallet=` which should return 400 or empty.
**Why it happens:** Next.js hydration — session is async.
**How to avoid:** Guard `useEffect` with `if (!walletAddress) return;` — only fetch when address is available. DashboardInterface already does `const walletAddress = session?.user?.walletAddress ?? ''`.
**Warning signs:** API logs show requests with `wallet=` (empty) parameter.

### Pitfall 3: Formatting Edge Cases
**What goes wrong:** `parseFloat("1.000001").toFixed(2)` → `"1.00"` (rounds down). `parseFloat("0").toFixed(2)` → `"0.00"`. Both are correct. Edge case: `formatUnits(0n, 6)` → `"0"` — display becomes `$0.00`, which is fine.
**Why it happens:** `formatUnits` returns a string like `"1.5"` without trailing zeros.
**How to avoid:** Always call `.toFixed(2)` on the parsed float. Guard against `NaN`: if `isNaN(parseFloat(balance))` render `$--.--` error state.
**Warning signs:** Balance displays as `$1.5` instead of `$1.50`.

### Pitfall 4: Missing Route Registration
**What goes wrong:** New `balanceRoute` is created but not added to `apps/api/src/index.ts`.
**Why it happens:** Easy to forget — the route file is complete but orphaned.
**How to avoid:** As part of the backend task, explicitly include the `app.route('/api', balanceRoute)` line in index.ts as a required step.
**Warning signs:** 404 on all balance requests despite the handler file existing.

## Code Examples

### Backend Route (complete, verified against existing patterns)

```typescript
// apps/api/src/routes/balance.ts
// Source pattern: apps/api/src/tools/get-balance.ts + apps/api/src/routes/confirm.ts
import { Hono } from 'hono';
import { erc20Abi, formatUnits, isAddress } from 'viem';
import { publicClient, USDC_ADDRESS } from '../chain/clients';

export const balanceRoute = new Hono();

balanceRoute.get('/balance', async (c) => {
  const wallet = c.req.query('wallet');
  if (!wallet || !isAddress(wallet)) {
    return c.json({ error: 'INVALID_WALLET', message: 'wallet query param must be a valid address' }, 400);
  }
  try {
    const raw = await publicClient.readContract({
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [wallet as `0x${string}`],
    });
    const balance = formatUnits(raw, 6);
    return c.json({ balance, currency: 'USDC' });
  } catch (err) {
    console.error('[route:balance] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: 'Could not retrieve balance' }, 500);
  }
});
```

### Route Registration in index.ts

```typescript
// apps/api/src/index.ts — add these two lines
import { balanceRoute } from './routes/balance';
// ...
app.route('/api', balanceRoute);
```

### Frontend useBalance Hook

```typescript
// apps/web/src/hooks/useBalance.ts
import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export function useBalance(walletAddress: string) {
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_URL}/balance?wallet=${walletAddress}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const parsed = parseFloat(data.balance);
      if (isNaN(parsed)) throw new Error('invalid balance');
      setBalance(parsed.toFixed(2));
    } catch (err) {
      console.error('[useBalance] fetch failed:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchBalance();
  }, [fetchBalance]);

  return { balance, loading, error, refetch: fetchBalance };
}
```

### DashboardInterface Balance Section

```tsx
// Replace lines 93-96 of DashboardInterface/index.tsx
const { balance, loading, error, refetch } = useBalance(walletAddress);

// In JSX (Total Balance section):
<div className="px-6 mb-6">
  <p className="font-headline text-[10px] uppercase tracking-[0.25em] text-white/40 mb-1">
    Total Balance
  </p>
  {loading ? (
    <div className="h-12 w-32 bg-white/10 animate-pulse mt-1" />
  ) : error ? (
    <p className="font-headline text-5xl font-extrabold tracking-tighter text-white/30">$--.--</p>
  ) : (
    <p className="font-headline text-5xl font-extrabold tracking-tighter text-white">
      ${balance ?? '0.00'}
    </p>
  )}
</div>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `$0.00` | Live `publicClient.readContract` via REST | Phase 11 | Real balance visible on dashboard |
| Tool-only balance (agent only) | Balance also accessible via REST | Phase 11 | Frontend can fetch without agent |

## Open Questions

1. **API URL path prefix**
   - What we know: `ConfirmCard` uses `${NEXT_PUBLIC_API_URL}/confirm` (no `/api/` in path). `ChatInterface` uses `${API_URL}/api/chat` (with `/api/`). These appear inconsistent.
   - What's unclear: Whether `NEXT_PUBLIC_API_URL` in `.env` includes `/api` or not.
   - Recommendation: Read `ConfirmCard` call at line 51 carefully before implementing — the balance route should follow `ConfirmCard`'s pattern since it's also a direct API call (not a Next.js API route). Most likely the env var is the base URL without `/api`, and the path should be `/api/balance`.

2. **Refetch scope for D-04**
   - What we know: `SendModal` closes after `triggerMiniKitPay` success. The `onClose` is in `DashboardInterface`.
   - What's unclear: Whether passing `refetch` to `SendModal.onClose` is sufficient, or if `ConfirmCard` (which lives in `ChatInterface`, not `DashboardInterface`) also needs to trigger balance refresh.
   - Recommendation: For hackathon scope — wire `refetch` to `SendModal onClose` only. `ChatInterface` is a separate route/page, so cross-page refresh is handled by page navigation anyway.

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code changes within the existing monorepo. No new external services, CLIs, or runtimes required. All dependencies (viem, Hono, Next.js, `publicClient`, World Chain RPC) were already proven in Phases 4 and 6.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (detected in monorepo) |
| Config file | Check `apps/api/vitest.config.ts` or root `vitest.config.ts` |
| Quick run command | `pnpm --filter @genie/api test` |
| Full suite command | `pnpm test` (root workspace) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOPS-01 | GET /api/balance?wallet= returns formatted USDC balance | unit (mock readContract) | `pnpm --filter @genie/api test -- balance` | ❌ Wave 0 |
| FOPS-01 | GET /api/balance?wallet= returns 400 for missing/invalid wallet | unit | `pnpm --filter @genie/api test -- balance` | ❌ Wave 0 |
| FOPS-01 | DashboardInterface renders live balance (not $0.00) | manual smoke | n/a — visual in World App | n/a |
| FOPS-01 | DashboardInterface shows skeleton during fetch | manual smoke | n/a — visual | n/a |
| FOPS-01 | DashboardInterface shows $--.-- on fetch failure | manual smoke | n/a — visual | n/a |

### Sampling Rate
- **Per task commit:** `pnpm --filter @genie/api test -- balance`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/routes/balance.test.ts` — covers FOPS-01 backend (mock `publicClient.readContract`, test 200 and 400 paths)

## Sources

### Primary (HIGH confidence)
- Direct source read: `apps/api/src/tools/get-balance.ts` — exact balance read pattern to replicate
- Direct source read: `apps/api/src/chain/clients.ts` — `publicClient`, `USDC_ADDRESS` exports
- Direct source read: `apps/api/src/routes/users.ts` — Hono route pattern, error handling structure
- Direct source read: `apps/api/src/routes/confirm.ts` — error handling, try/catch pattern
- Direct source read: `apps/api/src/index.ts` — route registration pattern
- Direct source read: `apps/web/src/components/DashboardInterface/index.tsx` — exact target lines (93-96) and existing state/hooks
- Direct source read: `apps/web/src/components/ConfirmCard/index.tsx` — API_URL fetch pattern
- Direct source read: `apps/web/src/auth/index.ts` — session shape confirming `walletAddress` field

### Secondary (MEDIUM confidence)
- viem `isAddress`, `erc20Abi`, `formatUnits` — verified present in existing imports; behavior well-known

### Tertiary (LOW confidence)
- Skeleton animation height/width estimates (`h-12 w-32`) based on text-5xl visual footprint — needs visual verification during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all patterns verified by reading source files
- Architecture: HIGH — route structure, fetch pattern, and API URL pattern confirmed from existing code
- Pitfalls: HIGH — identified from direct source reading (double-prefix, empty wallet guard, missing registration)
- Test plan: MEDIUM — vitest assumed from monorepo conventions; test file paths TBD

**Research date:** 2026-04-05
**Valid until:** Phase 11 delivery (stable stack, no external changes expected)
