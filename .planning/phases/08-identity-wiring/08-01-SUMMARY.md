---
phase: 08-identity-wiring
plan: "01"
subsystem: identity
tags: [world-id, verify, env-vars, identity-wiring]

# Dependency graph
requires:
  - phase: 07-api-wiring-01
    provides: verify-proof BFF sends full payload to /api/verify, protected layout redirect enabled

provides:
  - Verify component uses NEXT_PUBLIC_WORLD_ACTION env var (no hardcoded test-action)
  - .env.example documents all required frontend env vars for identity flow

affects: [world-id-verification, frontend-config, env-documentation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - NEXT_PUBLIC_ env var pattern for configurable World ID action identifier

key-files:
  created: []
  modified:
    - apps/web/src/components/Verify/index.tsx
    - .env.example

key-decisions:
  - "NEXT_PUBLIC_WORLD_ACTION with 'verify-human' fallback — matches backend WORLD_ACTION, works without env var set"
  - "NEXT_PUBLIC_API_URL added to .env.example with localhost:3001 default — frontend BFF and ChatInterface depend on it"

patterns-established: []

requirements-completed: [WRID-01, WRID-02, WRID-03, WRID-04]

# Metrics
duration: 1min
completed: 2026-04-05
---

# Phase 08 Plan 01: Identity Wiring Summary

**Verify component action fixed from hardcoded 'test-action' to NEXT_PUBLIC_WORLD_ACTION env var; .env.example updated with missing frontend env vars**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-05T00:21:46Z
- **Completed:** 2026-04-05T00:22:46Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

1. **Task 1 — Fix Verify component action identifier**: The `apps/web/src/components/Verify/index.tsx` component hardcoded `'test-action'` in three places (rp-signature request, IDKit.request call, and verify-proof POST). The World ID Cloud API validates that the `action` field matches the registered app action. Using `'test-action'` would cause verification failures in production since the app's actual action is `'verify-human'` (per `.env.example`). Fixed by reading `process.env.NEXT_PUBLIC_WORLD_ACTION` with `'verify-human'` as fallback.

2. **Task 2 — Add missing env vars to .env.example**: The frontend code references `NEXT_PUBLIC_API_URL` (in ChatInterface and verify-proof BFF) and `NEXT_PUBLIC_WORLD_ACTION` (now in Verify component) but neither was documented in `.env.example`. Developers setting up the app would not know to set these variables. Added both with sensible defaults: `NEXT_PUBLIC_API_URL=http://localhost:3001` and `NEXT_PUBLIC_WORLD_ACTION=verify-human`.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Fix Verify component action identifier | 1850f06 |
| 2 | Add missing env vars to .env.example | dde4376 |

## Files Created/Modified

- `apps/web/src/components/Verify/index.tsx` — `WORLD_ACTION` constant reads `NEXT_PUBLIC_WORLD_ACTION` env var; all three `'test-action'` hardcodes replaced
- `.env.example` — added `NEXT_PUBLIC_API_URL=http://localhost:3001` and `NEXT_PUBLIC_WORLD_ACTION=verify-human` under Web/Next.js section

## Decisions Made

- `NEXT_PUBLIC_WORLD_ACTION` with `'verify-human'` fallback — matches backend `WORLD_ACTION` from `.env.example`, works without env var set during local development
- `NEXT_PUBLIC_API_URL` defaults to `http://localhost:3001` — matches the API server default port from `.env.example`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all identity wiring is now functionally complete:
- verify-proof BFF calls correct `/api/verify` path (Phase 7)
- Full proof payload forwarded (Phase 7)
- Verify component uses correct action identifier (this plan)
- Protected routes redirect unauthenticated users (Phase 7)
- isVerified reflects DB state via `users.worldId !== null` check (Phase 3)

## Self-Check: PASSED

All files found:
- FOUND: apps/web/src/components/Verify/index.tsx
- FOUND: .env.example

All commits found:
- FOUND: 1850f06 (Task 1)
- FOUND: dde4376 (Task 2)
