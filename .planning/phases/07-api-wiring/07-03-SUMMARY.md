---
phase: 07-api-wiring
plan: "03"
subsystem: api, web
tags: [api-routing, onboarding, user-profile, hono, nextjs, drizzle, nextauth]

# Dependency graph
requires:
  - phase: 07-api-wiring-01
    provides: resolveUserId() and /api prefix routing established
  - phase: 06-mini-app-shell
    provides: onboarding page with 3-step flow

provides:
  - PATCH /api/users/profile endpoint for updating user's auto-approve threshold
  - Onboarding "Let's Go" button persists budget to DB via the profile endpoint
  - autoApproveUsd DB value reflects user's configured threshold from onboarding

affects: [user-profile, onboarding, auto-approve-threshold, api-routing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Non-blocking API call in onboarding — failure does not block navigation
    - Cache invalidation on profile update — updated threshold takes effect immediately

key-files:
  created:
    - apps/api/src/routes/users.ts
  modified:
    - apps/api/src/index.ts
    - apps/web/src/app/onboarding/page.tsx

key-decisions:
  - "PATCH /users/profile accepts both wallet address and UUID via resolveUserId() — same identity pattern as chat and verify routes"
  - "Onboarding API call is non-blocking — network errors do not prevent completing onboarding"
  - "Context cache invalidated after profile update so agent immediately uses the new threshold"

patterns-established:
  - "Users route reuses resolveUserId() from chat.ts — consistent wallet-to-UUID adapter across all routes"

requirements-completed: [FOPS-04]

# Metrics
duration: 2min
completed: 2026-04-05
---

# Phase 07 Plan 03: Onboarding Threshold Wiring Summary

**PATCH /api/users/profile created and wired to onboarding — user-configured spending limit now persists to DB**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-04T23:11:16Z
- **Completed:** 2026-04-04T23:13:32Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

1. **Task 1 — PATCH /api/users/profile backend route**: Created `apps/api/src/routes/users.ts` with a PATCH `/users/profile` endpoint. The handler accepts `{ userId, autoApproveUsd }`, calls `resolveUserId()` to handle wallet addresses (same pattern as chat and verify routes), updates `users.autoApproveUsd` via Drizzle, and invalidates the context cache so the new threshold takes effect on the next chat request. Mounted as `app.route('/api', usersRoute)` in `apps/api/src/index.ts`.

2. **Task 2 — Onboarding threshold wiring**: Updated `apps/web/src/app/onboarding/page.tsx` to:
   - Import `useSession` from `next-auth/react` to access the wallet address
   - Add `API_URL` constant from `NEXT_PUBLIC_API_URL` env var
   - Make `finish()` async and call `PATCH /api/users/profile` with `userId` and `autoApproveUsd` before navigating
   - Pass `budget` to `finish(budget)` from the StepBudget `onFinish` handler
   - API call failure is caught and logged but does not block navigation (non-blocking)

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Create PATCH /api/users/profile backend route | d726ca1 |
| 2 | Wire onboarding threshold to PATCH /api/users/profile | b5b613b |

## Files Created/Modified

- `apps/api/src/routes/users.ts` — new PATCH /users/profile route (created)
- `apps/api/src/index.ts` — added usersRoute import and mount under /api
- `apps/web/src/app/onboarding/page.tsx` — added useSession, async finish(), API call to PATCH /api/users/profile

## Decisions Made

- `usersRoute` reuses `resolveUserId()` from `chat.ts` — consistent wallet-to-UUID resolution across all backend routes
- The API call in onboarding is non-blocking (try/catch without re-throw) — a backend failure should not block users from accessing the app
- `invalidateContextCache()` called after profile update — ensures the agent picks up the new threshold without waiting for cache TTL expiry

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — onboarding now writes real data to the DB. The `autoApproveUsd` value configured during onboarding is persisted and used by `send_usdc` tool's auto-approve logic.

## Self-Check: PASSED

All files found:
- FOUND: apps/api/src/routes/users.ts
- FOUND: apps/api/src/index.ts
- FOUND: apps/web/src/app/onboarding/page.tsx

All commits found:
- FOUND: d726ca1 (Task 1)
- FOUND: b5b613b (Task 2)
