# Phase 8: Identity Wiring — Verify-Proof Fix + Auth Boundary - Research

**Researched:** 2026-04-05
**Domain:** World ID IDKit 4.0 verification flow, NextAuth v5 middleware, BFF pattern refactor
**Confidence:** HIGH

## Summary

Phase 8 has unusually low research risk: every file that needs changing already exists. The Verify component (`apps/web/src/components/Verify/index.tsx`), the BFF routes (`/api/verify-proof`, `/api/rp-signature`), the backend verify endpoint (`apps/api/src/routes/verify.ts`), and the middleware (`apps/web/middleware.ts`) are all present and partially working. The work is targeted surgical edits, not greenfield construction.

The core bug is a double-validation architectural mismatch: BFF calls World ID Cloud API, then sends full proof fields to the backend which also calls World ID Cloud API. Decision D-02 collapses this into BFF-owns-validation, backend-trusts-BFF. The backend verify route's `proofSchema` must be simplified to accept only `userId + nullifier_hash`. The BFF verify-proof route must call World ID Cloud API (it already does), then send only the slim payload downstream.

The middleware bug is simpler: `export { auth as middleware }` only attaches session context but never redirects. The fix wraps middleware in the `auth(req => { ... })` callback pattern so `req.auth` is available to gate protected paths. The `(protected)/layout.tsx` already has the correct redirect logic as defense-in-depth — middleware just needs to fire first.

**Primary recommendation:** Treat this as a refactor phase. Change the minimum surface area: (1) simplify verify-proof BFF payload, (2) simplify backend proofSchema, (3) fix middleware to redirect, (4) wire action string from env. Three source files plus one env var addition.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Verify Flow Fix**
- D-01: Action string managed via env var — `NEXT_PUBLIC_WORLD_ACTION` on frontend, `WORLD_ACTION` on backend, both set to same value. Verify component reads from env instead of hardcoding `'test-action'`.
- D-02: BFF validates proof with World ID Cloud API, then forwards only `nullifier_hash` + `userId` to backend for DB storage. Backend skips Cloud API call — single validation, no duplication.
- D-03: Backend verify endpoint simplified: receives `userId` + `nullifier_hash` from trusted BFF, stores to `users.worldId`, invalidates context cache. No proof/merkle_root/verification_level needed from BFF anymore.

**Auth Redirect Gaps**
- D-04: Middleware actively redirects unauthenticated users to `/` for protected paths. Not just session attachment — actual redirect enforcement. Closes bug #5.
- D-05: Public paths (no auth required): `/` (landing), `/api/auth/*` (NextAuth), `/api/verify-proof`, `/api/rp-signature`, static assets (`_next/static`, `_next/image`, `favicon.ico`). Everything else requires auth.
- D-06: `(protected)/layout.tsx` redirect kept as backup defense-in-depth, but middleware is the primary gate.

**isVerified Awareness**
- D-07: Frontend uses local state after verification success — Verify component gets success response, sets `isVerified=true` in React context or component state. No session refresh needed.
- D-08: Backend already handles isVerified via DB + context cache (Phase 3 decisions). No backend changes needed for this aspect.
- D-09: On next full page load/session refresh, isVerified state is implicitly correct because backend reads from DB.

**RP Signature Flow**
- D-10: `/api/rp-signature` implemented as Next.js BFF route (same pattern as verify-proof). Signs with `WORLD_DEV_PORTAL_API_KEY` server-side.
- D-11: RP signature endpoint requires session — only authenticated users can request signatures. Prevents abuse of signing key.
- D-12: Verify component calls `/api/rp-signature` → gets RP context → passes to `IDKit.request()` → gets proof → sends to `/api/verify-proof`.

### Claude's Discretion
- RP signature response format and caching strategy
- Exact middleware path matching implementation (regex vs array)
- Error handling details for RP signature failures
- Whether to add rate limiting to RP signature endpoint (hackathon scope — probably skip)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRID-01 | User can verify as human via World ID 4.0 IDKit widget inline in chat | Verify component + rp-signature + verify-proof BFF already wired; action env var fix enables correct verification |
| WRID-02 | Server validates World ID proofs before allowing gated actions (send, debt, goals) | Backend verify.ts calls World ID Cloud API; D-02 collapses to single BFF validation — requireVerified guard unchanged |
| WRID-03 | Unverified users can chat, view balance, and receive money | requireVerified tool guard only blocks send_usdc/create_debt; ungated tools unaffected; middleware public paths list preserves access |
| WRID-04 | Verified users unlock send money, debt tracking, and agent automation | After verify, nullifier_hash stored in users.worldId → isVerified=true → requireVerified passes; Verify component updates local state immediately |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@worldcoin/idkit` | `4.0.0-dev.4777311` | IDKit 4.0 widget + signRequest | Already installed; `signRequest` used by rp-signature route |
| `next-auth` | `^5.0.0-beta.25` | NextAuth v5 auth() + middleware | Already installed; current middleware uses it |
| `next` | `^15.2.8` | Next.js framework | Project framework |
| `zod` | existing | Schema validation | Already used in backend proofSchema |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@worldcoin/minikit-js` | latest | MiniKit integration | Used in auth flow, not changed in Phase 8 |

### No New Dependencies
Phase 8 requires zero new package installations. All necessary libraries are already present.

## Architecture Patterns

### Current State (What Exists)

```
Verify component (index.tsx)
  ├── calls /api/rp-signature (POST, body: {action: 'test-action'})    ← BUG: hardcoded action
  ├── calls IDKit.request() with rp_context
  └── calls /api/verify-proof (POST, body: {payload, action: 'test-action'})  ← BUG: hardcoded action

/api/rp-signature/route.ts
  ├── NO session check                                                 ← BUG: D-11 requires auth
  └── signRequest(action, SIGNING_KEY) → returns {rp_id, sig, nonce, created_at, expires_at}

/api/verify-proof/route.ts
  ├── calls World ID Cloud API (BFF validates)                         ← CORRECT
  └── on success → calls backend /api/verify with full proof payload   ← BUG: D-02 requires slim payload

apps/api/src/routes/verify.ts
  ├── proofSchema: requires proof, merkle_root, nullifier_hash, verification_level  ← needs simplification
  └── re-calls World ID Cloud API                                      ← BUG: double validation

middleware.ts
  └── export { auth as middleware }                                    ← BUG: no redirect, just session attach
```

### Target State (After Phase 8)

```
Verify component (index.tsx)
  ├── reads action from process.env.NEXT_PUBLIC_WORLD_ACTION
  ├── calls /api/rp-signature (authenticated)
  ├── calls IDKit.request() with rp_context
  └── calls /api/verify-proof with {payload, action: env.NEXT_PUBLIC_WORLD_ACTION}

/api/rp-signature/route.ts
  ├── auth() session check → 401 if no session
  └── signRequest(action, SIGNING_KEY) → same response format

/api/verify-proof/route.ts
  ├── calls World ID Cloud API (single point of validation)
  └── on success → calls backend /api/verify with {userId, nullifier_hash} ONLY

apps/api/src/routes/verify.ts (simplified)
  ├── proofSchema: only userId + nullifier_hash
  ├── NO World ID Cloud API call
  └── stores nullifier_hash → invalidates cache

middleware.ts
  └── auth(req => redirect to / if !req.auth and not in public paths list)
```

### Pattern 1: NextAuth v5 Middleware Redirect

The current middleware only exports auth as a pass-through. To add redirect logic, wrap it in the callback form:

```typescript
// Source: authjs.dev/getting-started/migrating-to-v5#middleware
import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isPublicPath =
    req.nextUrl.pathname === '/' ||
    req.nextUrl.pathname.startsWith('/api/auth') ||
    req.nextUrl.pathname.startsWith('/api/verify-proof') ||
    req.nextUrl.pathname.startsWith('/api/rp-signature') ||
    req.nextUrl.pathname.startsWith('/_next/static') ||
    req.nextUrl.pathname.startsWith('/_next/image') ||
    req.nextUrl.pathname === '/favicon.ico';

  if (!req.auth && !isPublicPath) {
    return NextResponse.redirect(new URL('/', req.url));
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

**Key detail:** `req.auth` is the session object when using the callback form. Falsy when no session exists. The `export default auth(callback)` form differs from `export { auth as middleware }`.

### Pattern 2: BFF Slim Payload (D-02/D-03)

Current verify-proof sends full proof to backend. After fix:

```typescript
// In /api/verify-proof/route.ts — after World ID Cloud API succeeds:
await fetch(`${apiUrl}/api/verify`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId,           // wallet address — backend resolveUserId handles it
    nullifier_hash: (payload as Record<string, unknown>).nullifier_hash,
  }),
});
```

Backend proofSchema collapses to:
```typescript
const proofSchema = z.object({
  userId: z.string().min(1),
  nullifier_hash: z.string(),
});
```

### Pattern 3: RP Signature Session Guard (D-11)

```typescript
// In /api/rp-signature/route.ts — add at top of POST handler:
const session = await auth();
if (!session) {
  return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
}
```

### Pattern 4: Action String from Env (D-01)

```typescript
// In Verify component — replace hardcoded 'test-action':
const action = process.env.NEXT_PUBLIC_WORLD_ACTION ?? 'verify-human';

// Use in both IDKit.request() and /api/verify-proof body
```

The env var `NEXT_PUBLIC_WORLD_ACTION` is not yet in the .env file. Must be added to `apps/web/.env.local` (or shared env) with value matching `WORLD_ACTION=verify-human` already set in the backend env.

### Anti-Patterns to Avoid

- **Touching the rp-signature response shape:** The Verify component already parses `{rp_id, nonce, created_at, expires_at, sig}` and maps `sig` to `signature`. The route already returns this exact shape. Do not rename fields.
- **Adding session refresh after verify:** D-07 locks this — use local React state only. Session refresh would require a page reload.
- **Removing proofSchema validation entirely from backend:** Even with slim payload, keep `z.string().min(1)` validation to prevent empty strings.
- **Using `export { auth as middleware }` form:** This form cannot perform redirects. Must switch to `auth(callback)` form.
- **Double-negation on matcher:** The existing matcher `/((?!_next/static|_next/image|favicon.ico|api/auth).*)` could be kept or refined. Do not add `/api/verify-proof` to the matcher exclusion — instead handle it inside the callback via the isPublicPath check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RP signing | Custom HMAC | `signRequest` from `@worldcoin/idkit` | Already used in route.ts; handles nonce, created_at, expires_at |
| Session check in middleware | Manual JWT decode | `req.auth` from NextAuth v5 auth callback | Built into NextAuth v5; decoded and typed |
| World ID proof verification | Custom merkle validation | World ID Cloud API at `WORLD_VERIFY_API_URL` | The BFF already calls it correctly |

## Common Pitfalls

### Pitfall 1: Middleware Export Form

**What goes wrong:** Keeping `export { auth as middleware }` when adding redirect logic silently does nothing — the redirect code never runs because the auth export is not the callback form.

**Why it happens:** NextAuth v5 supports both forms. The simple export attaches session context. Only the `auth(callback)` form executes custom logic.

**How to avoid:** Switch to `export default auth((req) => { ... })`. Also export `config` separately.

**Warning signs:** Unauthenticated users reach protected pages without redirect. Console shows no middleware execution logs.

### Pitfall 2: NEXT_PUBLIC_WORLD_ACTION env var missing

**What goes wrong:** `process.env.NEXT_PUBLIC_WORLD_ACTION` is `undefined` in the browser bundle. The IDKit request uses `undefined` as the action string, causing verification to fail at the World ID Cloud API with action mismatch.

**Why it happens:** The env var exists on the backend (`WORLD_ACTION=verify-human`) but was never added to the Next.js frontend env file.

**How to avoid:** Add `NEXT_PUBLIC_WORLD_ACTION=verify-human` to `apps/web/.env.local`. Use fallback `?? 'verify-human'` in Verify component for safety.

**Warning signs:** Verify succeeds locally (IDKit may pass through) but World ID Cloud API returns `invalid_action` error.

### Pitfall 3: Backend proofSchema still requires removed fields

**What goes wrong:** Simplifying the BFF to send slim payload, but forgetting to update backend `proofSchema` — backend returns 400 INVALID_INPUT because `proof`, `merkle_root`, `verification_level` fields fail zod validation.

**Why it happens:** Two files must change atomically: verify-proof route.ts (BFF payload) AND verify.ts (backend schema).

**How to avoid:** Plan these as a single atomic change or same wave.

**Warning signs:** BFF verify-proof returns success from World ID Cloud API but backend returns 400 on the downstream call.

### Pitfall 4: rp-signature auth guard breaks Verify flow

**What goes wrong:** Adding session guard to `/api/rp-signature` causes the first step of verify flow to return 401 for unauthenticated users. Since rp-signature is called before IDKit opens, unverified-but-logged-in users can verify fine, but this would block if session is somehow lost mid-flow.

**Why it happens:** D-11 decision is correct — only authenticated users should get RP signatures. The Verify component only renders inside protected routes (after middleware redirects unauthenticated users away).

**How to avoid:** Ensure `/api/rp-signature` is in the middleware public paths list only if unauthenticated access is needed. Per D-11, it should NOT be in the public list — it should require session. The verify flow only runs for logged-in users.

**Warning signs:** Verify button returns "Failed to get RP signature" for logged-in users — indicates session is not being passed correctly or auth() call fails.

### Pitfall 5: vitest env var gap for refactored verify.ts tests

**What goes wrong:** After removing Cloud API call from verify.ts, existing tests in `verify.test.ts` that mock `global.fetch` for the World ID portal mock will no longer match actual fetches. Tests may pass vacuously (mock never called).

**Why it happens:** Tests were written for the original double-validation code.

**How to avoid:** Update `verify.test.ts` to remove the World ID portal mock, and add assertions that `mockFetch` is NOT called (since backend no longer calls the portal).

## Code Examples

Verified patterns from codebase inspection:

### signRequest usage (existing, confirmed working)
```typescript
// Source: apps/web/src/app/api/rp-signature/route.ts (current)
import { signRequest } from '@worldcoin/idkit';
const sig = signRequest(action, SIGNING_KEY);
// Returns: { sig, nonce, createdAt, expiresAt }
// Note: createdAt/expiresAt are BigInt — convert with Number() before JSON serialization
```

### RpContext shape (existing Verify component)
```typescript
// Source: apps/web/src/components/Verify/index.tsx
const rpContext: RpContext = {
  rp_id: rpSig.rp_id,
  nonce: rpSig.nonce,
  created_at: rpSig.created_at,   // number
  expires_at: rpSig.expires_at,   // number
  signature: rpSig.sig,           // maps sig → signature
};
```

### invalidateContextCache (existing, works correctly)
```typescript
// Source: apps/api/src/routes/chat.ts
export function invalidateContextCache(userId: string): void {
  contextCache.delete(userId);
}
// Called after verify → ensures isVerified propagates on next chat request
```

### resolveUserId accepts wallet addresses
```typescript
// Source: apps/api/src/routes/chat.ts
// The backend verify route uses resolveUserId() — wallet address (0x...) from session
// will be resolved to internal UUID. This already works correctly.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `export { auth as middleware }` (pass-through) | `auth(callback)` with redirect logic | NextAuth v5 API | Enables actual redirect enforcement |
| Full proof forwarded BFF→backend | Slim payload (userId + nullifier_hash) | Phase 8 D-02 | Eliminates double Cloud API validation |
| Hardcoded `'test-action'` | `process.env.NEXT_PUBLIC_WORLD_ACTION` | Phase 8 D-01 | Matches backend WORLD_ACTION env var |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@worldcoin/idkit` | signRequest, IDKit.request | ✓ | 4.0.0-dev.4777311 | — |
| `next-auth` | auth(), middleware | ✓ | ^5.0.0-beta.25 | — |
| `RP_SIGNING_KEY` env var | rp-signature route | ✓ | set in .env.local | 500 error if missing (handled) |
| `NEXT_PUBLIC_APP_ID` env var | IDKit.request app_id | ✓ | set in .env.local | — |
| `NEXT_PUBLIC_WORLD_ACTION` env var | Verify component action string | ✗ | not in .env.local | Fallback `'verify-human'` in code |
| `WORLD_APP_ID` env var (vitest) | api tests | ✗ | missing from vitest.config.ts | 4 test suites fail at startup |

**Missing dependencies with no fallback:**
- `NEXT_PUBLIC_WORLD_ACTION` in `apps/web/.env.local` — must be added (value: `verify-human`)

**Missing dependencies with fallback:**
- `WORLD_APP_ID` in vitest.config.ts — 4 test suites fail (classifier, index, providers, resolve-contact) but not verify.test.ts; planners should add to vitest.config.ts env section

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npx vitest run routes/verify.test.ts` |
| Full suite command | `cd apps/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WRID-01 | Verify component reads action from env, rp-signature flow works | unit | manual (component, no test harness) | ✗ N/A — UI component |
| WRID-02 | Backend accepts slim payload (userId+nullifier_hash), validates | unit | `cd apps/api && npx vitest run routes/verify.test.ts` | ✅ verify.test.ts |
| WRID-03 | Unverified users can access ungated routes | unit | `cd apps/api && npx vitest run routes/verify.test.ts tools/require-verified.test.ts` | ✅ existing |
| WRID-04 | Verified users unlock gated tools (isVerified=true after DB write) | unit | `cd apps/api && npx vitest run routes/verify.test.ts` | ✅ existing |

**Note on middleware:** NextAuth v5 middleware cannot be unit-tested with vitest — it runs in Next.js Edge Runtime. Middleware redirect behavior must be verified manually in the running app.

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run routes/verify.test.ts`
- **Per wave merge:** `cd apps/api && npx vitest run`
- **Phase gate:** All verify.test.ts tests pass, manual check that middleware redirects unauthenticated browser to `/`

### Wave 0 Gaps
- [ ] `apps/api/src/routes/verify.test.ts` — update existing test to remove World ID portal mock assertions (since backend will no longer call the portal after D-02/D-03 refactor)
- [ ] `apps/api/vitest.config.ts` — add `WORLD_APP_ID`, `WORLD_ACTION` to env section to fix 4 failing test suites (pre-existing gap, not introduced by Phase 8)

## Open Questions

1. **isVerified local state in Verify component**
   - What we know: D-07 says "Verify component gets success response, sets `isVerified=true` in React context or component state"
   - What's unclear: The existing Verify component only has `buttonState` (pending/success/failed) — there is no isVerified prop, no context, no callback. D-07 requires surfacing the success to the parent/chat so the UI unlocks gated actions.
   - Recommendation: Add an optional `onVerified?: () => void` callback prop to Verify component. ChatInterface or parent calls this to update its own state. No shared context needed for hackathon scope.

2. **rp-signature route: `WORLD_DEV_PORTAL_API_KEY` vs `RP_SIGNING_KEY`**
   - What we know: D-10 says "Signs with `WORLD_DEV_PORTAL_API_KEY`". Existing route.ts uses `RP_SIGNING_KEY`. The .env.local already has `RP_SIGNING_KEY=...`. These are the same key, different naming conventions.
   - What's unclear: Whether the plan should rename the env var or leave it as `RP_SIGNING_KEY`.
   - Recommendation: Leave as `RP_SIGNING_KEY` — it is already set, the route works, renaming creates deployment risk.

## Sources

### Primary (HIGH confidence)
- Direct code inspection: `apps/web/src/components/Verify/index.tsx` — current component state
- Direct code inspection: `apps/web/src/app/api/verify-proof/route.ts` — current BFF state
- Direct code inspection: `apps/web/src/app/api/rp-signature/route.ts` — existing route (already correct shape)
- Direct code inspection: `apps/api/src/routes/verify.ts` — backend verify with double-validation
- Direct code inspection: `apps/web/middleware.ts` — confirms no redirect logic
- Direct code inspection: `apps/web/src/app/(protected)/layout.tsx` — confirms backup redirect exists
- Direct code inspection: `apps/web/src/auth/index.ts` — NextAuth config, session.user.id = UUID
- Direct code inspection: `apps/api/src/routes/verify.test.ts` — existing test suite passes

### Secondary (MEDIUM confidence)
- authjs.dev/getting-started/migrating-to-v5 — NextAuth v5 middleware callback pattern (verified: `auth(callback)` form is the correct approach for redirect logic)
- `.env.local` inspection — confirmed `NEXT_PUBLIC_WORLD_ACTION` is absent, `RP_SIGNING_KEY` is present

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, versions confirmed from package.json
- Architecture: HIGH — code read directly from source, current bugs confirmed by inspection
- Pitfalls: HIGH — pitfalls derive from observed code gaps, not speculation
- Middleware pattern: MEDIUM — confirmed from authjs.dev migration docs but NextAuth v5 beta has historically shifted APIs

**Research date:** 2026-04-05
**Valid until:** 2026-04-19 (stable — NextAuth v5 beta.25 is pinned)
