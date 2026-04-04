---
phase: 07-api-wiring
plan: "02"
subsystem: auth
tags: [nextauth, user-provisioning, session-augmentation, auth-boundary, onboarding]

# Dependency graph
requires:
  - phase: 07-api-wiring-01
    provides: resolveUserId() and /api prefix on all Hono routes
  - phase: 06-mini-app-shell-04
    provides: ChatInterface with session.user.id and walletAuth flow

provides:
  - POST /api/users/provision HTTP endpoint (idempotent get-or-create by wallet address)
  - session.user.id contains UUID from DB (not wallet address)
  - session.user.walletAddress contains original 0x address
  - session.user.needsOnboarding true when displayName is wallet-derived
  - Protected routes redirect unauthenticated users to landing page
  - New users redirect to /onboarding; existing users go to /home

affects: [auth-flow, session-identity, user-provisioning, route-protection]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Provision-on-auth: authorize callback calls POST /api/users/provision, stores UUID in session
    - needsOnboarding flag derived from displayName.startsWith('0x') — no schema change needed
    - Session carries both UUID (id) and wallet address (walletAddress) for different consumers

key-files:
  created:
    - apps/api/src/routes/users.ts
  modified:
    - apps/web/src/auth/index.ts
    - apps/web/src/app/page.tsx
    - apps/api/src/index.ts

key-decisions:
  - "POST /api/users/provision created as separate HTTP endpoint — resolveUserId() is internal only, not exposed directly"
  - "needsOnboarding = displayName.startsWith('0x') — schema keeps displayName notNull, wallet-derived name is the 'no real name' signal"
  - "declare module 'next-auth/jwt' removed — not available in next-auth v5 beta; JWT token fields use as-cast without augmentation"
  - "Page.tsx switches from localStorage genie_onboarding_done to session.user.needsOnboarding — server authoritative"

# Metrics
duration: 8min
completed: 2026-04-05
---

# Phase 07 Plan 02: Auth Provisioning + Session UUID Fix Summary

**NextAuth authorize callback calls POST /api/users/provision, stores UUID in session.user.id, walletAddress in separate field, needsOnboarding flag drives /onboarding vs /home routing**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-05T01:13:35+02:00
- **Completed:** 2026-04-05T01:21:00+02:00
- **Tasks:** 2
- **Files modified:** 4 (1 created)

## Accomplishments

1. **Task 1 — Auth callback provisioning + session type augmentation**: Created `POST /api/users/provision` HTTP endpoint in a new `apps/api/src/routes/users.ts` (idempotent get-or-create by wallet address, returns `{ userId, needsOnboarding }`). Registered `usersRoute` under `/api` in Hono app. Rewrote `apps/web/src/auth/index.ts`: added `needsOnboarding: boolean` to User/Session module augmentation, added provisioning fetch after SIWE verification, updated JWT callback to store all fields including needsOnboarding, updated session callback to expose all fields. Auth now fails entirely if provisioning is unreachable (D-04).

2. **Task 2 — Auth boundary enforcement + onboarding redirect**: Protected layout redirect was already enabled by Plan 01 (no change needed). Updated `apps/web/src/app/page.tsx` to replace the localStorage-based `destination()` function with `session.user.needsOnboarding` check — both the existing-session path and the fresh-auth path now read from the session. New users with a wallet-derived display name go to `/onboarding`; existing users go to `/home`.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Auth callback provisioning + session type augmentation | 4017aac |
| 2 | Auth boundary enforcement + onboarding redirect | 1206979 |

## Files Created/Modified

- `apps/api/src/routes/users.ts` — New file: POST /users/provision endpoint with idempotent get-or-create logic
- `apps/api/src/index.ts` — Added usersRoute import and `app.route('/api', usersRoute)`
- `apps/web/src/auth/index.ts` — Added needsOnboarding to User/Session types; provisioning call; UUID in session.user.id; walletAddress as separate field
- `apps/web/src/app/page.tsx` — Switched from localStorage to session.user.needsOnboarding for onboarding routing

## Decisions Made

- `POST /api/users/provision` created as separate HTTP endpoint — `resolveUserId()` is internal to the Hono app and not directly callable from the Next.js auth server
- `needsOnboarding = displayName.startsWith('0x')` — schema keeps `displayName notNull`; the wallet-derived default (e.g., `0x1a2b3c4d5`) is the "no real name set" signal; no schema migration required
- `declare module 'next-auth/jwt'` removed — next-auth v5 beta does not export this module; JWT token fields use `as` casts in callbacks instead
- `page.tsx` switches from `localStorage.getItem('genie_onboarding_done')` to `session.user.needsOnboarding` — server is authoritative for this flag, no client-side state needed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] next-auth/jwt module augmentation not available in v5 beta**
- **Found during:** Task 1 build verification
- **Issue:** `declare module 'next-auth/jwt'` causes TypeScript error — next-auth v5.0.0-beta.30 does not export this module path
- **Fix:** Removed the `declare module 'next-auth/jwt'` block; JWT token fields (`token.userId`, etc.) use `as string` and `as boolean` casts in the jwt/session callbacks
- **Files modified:** apps/web/src/auth/index.ts
- **Commit:** 4017aac

**2. [Rule 2 - Missing functionality] No HTTP provision endpoint existed**
- **Found during:** Task 1 implementation
- **Issue:** The plan references `POST /api/users/provision` but Plan 01 only created `resolveUserId()` as an internal function, not an HTTP endpoint
- **Fix:** Created `apps/api/src/routes/users.ts` with the full provision endpoint; registered in Hono app
- **Files modified:** apps/api/src/routes/users.ts, apps/api/src/index.ts
- **Commit:** 4017aac

## Known Stubs

None — auth provisioning calls real backend endpoint; session fields all populated from live data.

## Self-Check: PASSED

All files found:
- FOUND: apps/api/src/routes/users.ts
- FOUND: apps/api/src/index.ts
- FOUND: apps/web/src/auth/index.ts
- FOUND: apps/web/src/app/page.tsx

All commits found:
- FOUND: 4017aac (Task 1)
- FOUND: 1206979 (Task 2)
