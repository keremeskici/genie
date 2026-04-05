# Phase 8: Identity Wiring — Verify-Proof Fix + Auth Boundary - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

World ID verification flow works end-to-end and auth boundaries are enforced. Fixes audit bug #3 (verify path/body alignment) and #5 (redirect not active). After this phase: BFF validates proofs and persists to backend, middleware redirects unauthenticated users, and frontend knows when verification succeeds.

</domain>

<decisions>
## Implementation Decisions

### Verify Flow Fix
- **D-01:** Action string managed via env var — `NEXT_PUBLIC_WORLD_ACTION` on frontend, `WORLD_ACTION` on backend, both set to same value. Verify component reads from env instead of hardcoding `'test-action'`.
- **D-02:** BFF validates proof with World ID Cloud API, then forwards only `nullifier_hash` + `userId` to backend for DB storage. Backend skips Cloud API call — single validation, no duplication.
- **D-03:** Backend verify endpoint simplified: receives `userId` + `nullifier_hash` from trusted BFF, stores to `users.worldId`, invalidates context cache. No proof/merkle_root/verification_level needed from BFF anymore.

### Auth Redirect Gaps
- **D-04:** Middleware actively redirects unauthenticated users to `/` for protected paths. Not just session attachment — actual redirect enforcement. Closes bug #5.
- **D-05:** Public paths (no auth required): `/` (landing), `/api/auth/*` (NextAuth), `/api/verify-proof`, `/api/rp-signature`, static assets (`_next/static`, `_next/image`, `favicon.ico`). Everything else requires auth.
- **D-06:** `(protected)/layout.tsx` redirect kept as backup defense-in-depth, but middleware is the primary gate.

### isVerified Awareness
- **D-07:** Frontend uses local state after verification success — Verify component gets success response, sets `isVerified=true` in React context or component state. No session refresh needed.
- **D-08:** Backend already handles isVerified via DB + context cache (Phase 3 decisions). No backend changes needed for this aspect.
- **D-09:** On next full page load/session refresh, isVerified state is implicitly correct because backend reads from DB.

### RP Signature Flow
- **D-10:** `/api/rp-signature` implemented as Next.js BFF route (same pattern as verify-proof). Signs with `WORLD_DEV_PORTAL_API_KEY` server-side.
- **D-11:** RP signature endpoint requires session — only authenticated users can request signatures. Prevents abuse of signing key.
- **D-12:** Verify component calls `/api/rp-signature` → gets RP context → passes to `IDKit.request()` → gets proof → sends to `/api/verify-proof`.

### Claude's Discretion
- RP signature response format and caching strategy
- Exact middleware path matching implementation (regex vs array)
- Error handling details for RP signature failures
- Whether to add rate limiting to RP signature endpoint (hackathon scope — probably skip)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### World ID / IDKit
- `apps/web/src/components/Verify/index.tsx` — Current Verify component with IDKit 4.0 flow, hardcoded 'test-action'
- `apps/web/src/app/api/verify-proof/route.ts` — BFF verify-proof route, currently double-validates

### Backend Verify
- `apps/api/src/routes/verify.ts` — Backend verify endpoint with proofSchema, Cloud API call, DB storage
- `apps/api/src/config/env.ts` — WORLD_APP_ID, WORLD_ACTION, WORLD_VERIFY_API_URL env vars

### Auth / Middleware
- `apps/web/middleware.ts` — Current middleware (auth export only, no redirect logic)
- `apps/web/src/app/(protected)/layout.tsx` — Protected layout with session check + redirect
- `apps/web/src/auth/index.ts` — NextAuth config, JWT/session callbacks, User type augmentation

### Identity Context
- `apps/api/src/agent/context.ts` — UserContext interface with isVerified
- `apps/api/src/routes/chat.ts` — fetchUserContext with context cache, resolveUserId, invalidateContextCache
- `apps/api/src/tools/require-verified.ts` — Per-tool verification gate

### Prior Context
- `.planning/phases/03-identity/03-CONTEXT.md` — Phase 3 identity decisions (D-01 through D-16)
- `.planning/phases/07-api-wiring/07-CONTEXT.md` — Phase 7 API wiring decisions (D-08 through D-17)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Verify` component — IDKit 4.0 integration already working, just needs action string and RP endpoint fixes
- `verify-proof` BFF route — Already forwards to backend, needs simplification (drop backend Cloud API call)
- `verifyRoute` on backend — Full proof validation logic, needs simplification to trust BFF
- `invalidateContextCache()` — Already called after verify, ensures isVerified propagates
- `auth()` from NextAuth — Available in middleware for session checking

### Established Patterns
- BFF pattern: frontend → Next.js API route → backend (verify-proof, initiate-payment)
- Middleware: `export { auth as middleware }` with matcher config
- Protected layout: server-side `auth()` check + `redirect('/')`
- Env var pattern: `NEXT_PUBLIC_*` for client-side, plain for server-side

### Integration Points
- New `/api/rp-signature` BFF route (Next.js API route)
- Middleware update: add redirect logic for unauthenticated users
- Verify component: read action from env, call rp-signature endpoint
- BFF verify-proof: simplify payload sent to backend (just userId + nullifier_hash)
- Backend verify: simplify to accept trusted BFF payload (drop Cloud API re-validation)

</code_context>

<specifics>
## Specific Ideas

- The verify flow should feel seamless — user taps verify, IDKit opens, proof validates, user immediately unlocked
- Middleware redirect should be invisible — unauthenticated users land on `/` naturally, never see a flash of protected content
- Keep the double-validation removal clean — BFF is the trust boundary for World ID Cloud API calls

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-identity-wiring*
*Context gathered: 2026-04-05*
