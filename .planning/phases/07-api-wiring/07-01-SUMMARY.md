---
phase: 07-api-wiring
plan: "01"
subsystem: api
tags: [api-routing, user-provisioning, hono, nextjs, nextauth, drizzle]

# Dependency graph
requires:
  - phase: 06-mini-app-shell-04
    provides: ChatInterface with NEXT_PUBLIC_API_URL and session.user.id userId
  - phase: 01-agent-infra-02
    provides: Hono app with chatRoute, verifyRoute, confirmRoute
  - phase: 03-identity-01
    provides: verifyRoute backend

provides:
  - All Hono routes accessible under /api prefix (chat, verify, confirm)
  - resolveUserId(): wallet address to UUID provisioning (idempotent upsert)
  - Frontend-to-backend chat flow works end-to-end with wallet address identity
  - Full World ID proof payload forwarded from BFF to backend verify endpoint
  - Protected routes redirect unauthenticated users to landing page

affects: [api-routing, user-identity, auth-flow, frontend-backend-integration]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - resolveUserId() adapter pattern: accepts 0x wallet address or UUID, provisions user on first request
    - Route prefix mounting: sub-routers mounted under /api in Hono app

key-files:
  created: []
  modified:
    - apps/api/src/index.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/routes/verify.ts
    - apps/web/src/app/api/verify-proof/route.ts
    - apps/web/src/app/(protected)/layout.tsx

key-decisions:
  - "resolveUserId accepts both 0x wallet addresses and UUIDs — wallet addresses trigger upsert, UUIDs pass through unchanged"
  - "User provisioning on first chat request — display name defaults to first 10 chars of wallet address"
  - "verify route shares resolveUserId from chat module — single implementation for wallet-to-UUID resolution"

patterns-established:
  - "Identity adapter pattern: session.user.id (wallet address) -> resolveUserId() -> internal UUID -> all DB queries"

requirements-completed: [AGEN-04, AGEN-05, AGEN-07, MAPP-03, FOPS-01, FOPS-02, FOPS-03, FOPS-04, SPND-02, DEBT-01, DEBT-02, MAPP-04]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 07 Plan 01: API Path Alignment + User Provisioning Summary

**Hono routes moved to /api prefix; resolveUserId() adapter provisions DB users from wallet addresses; verify-proof BFF sends full proof payload; protected layout redirect re-enabled**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T23:00:22Z
- **Completed:** 2026-04-04T23:04:00Z
- **Tasks:** 4
- **Files modified:** 5

## Accomplishments

1. **Task 1 — API route prefix fix**: Mounted all three Hono route modules under `/api` in `apps/api/src/index.ts`. Frontend's `DefaultChatTransport` was calling `/api/chat` which returned 404; backend was serving at `/chat`. Now aligned: `/api/chat`, `/api/verify`, `/api/confirm`.

2. **Task 2 — User provisioning via resolveUserId()**: Added `resolveUserId(rawId)` to `apps/api/src/routes/chat.ts`. NextAuth's `session.user.id` is a wallet address (e.g., `0x1a2b...`), but Drizzle queries use UUID primary keys. The function detects `0x` prefix, looks up existing user, or provisions a new row via `db.insert(users).values(...)`. Chat route now calls this before `fetchUserContext` and passes the resolved UUID downstream.

3. **Task 3 — Verify-proof BFF payload fix**: The Next.js BFF at `apps/web/src/app/api/verify-proof/route.ts` was only sending `nullifier_hash + userId` to the backend, but the backend `proofSchema` requires `proof`, `merkle_root`, `nullifier_hash`, `verification_level`. Updated to send all five fields. Also confirmed route path is `/api/verify` (correct after Task 1).

4. **Task 4 — Verify route + redirect fix**: Updated `apps/api/src/routes/verify.ts` to change `userId` schema from `z.string().uuid()` to `z.string().min(1)` and call `resolveUserId()` for wallet-address provisioning before DB operations. Uncommented `redirect('/')` in `apps/web/src/app/(protected)/layout.tsx` and added the `next/navigation` import — unauthenticated users are now properly redirected to the landing page.

## Task Commits

| Task | Name | Commit |
|------|------|--------|
| 1 | Add /api prefix to all Hono routes | 9a31f43 |
| 2 | User provisioning — resolveUserId() in chat route | 56241cc |
| 3 | Fix verify-proof BFF path and payload | 43d2adb |
| 4 | Verify route accepts wallet address + enable redirect | 5df390f |

## Files Created/Modified

- `apps/api/src/index.ts` — `app.route('/', ...)` → `app.route('/api', ...)` for all three route modules
- `apps/api/src/routes/chat.ts` — added `resolveUserId()` function and UUID_REGEX; chat handler calls it before fetchUserContext
- `apps/api/src/routes/verify.ts` — userId schema relaxed to accept wallet addresses; calls `resolveUserId()` for provisioning
- `apps/web/src/app/api/verify-proof/route.ts` — BFF now sends full proof payload (proof, merkle_root, nullifier_hash, verification_level)
- `apps/web/src/app/(protected)/layout.tsx` — added `redirect` import; uncommented `redirect('/')`

## Decisions Made

- `resolveUserId()` exported from `chat.ts` so `verify.ts` can import it without duplicating logic — single source of truth for wallet-to-UUID resolution
- New user display name defaults to the first 10 characters of the wallet address (`0x1a2b3c4d5`) — readable short handle until user sets a proper name
- `autoApproveUsd` defaults to `'25'` for provisioned users — consistent with existing stub context default

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all integration paths now use real data. The `displayName` of provisioned users defaults to a truncated wallet address but this is intentional and functional.

## Self-Check: PASSED

All files found:
- FOUND: apps/api/src/index.ts
- FOUND: apps/api/src/routes/chat.ts
- FOUND: apps/api/src/routes/verify.ts
- FOUND: apps/web/src/app/api/verify-proof/route.ts
- FOUND: apps/web/src/app/(protected)/layout.tsx

All commits found:
- FOUND: 9a31f43 (Task 1)
- FOUND: 56241cc (Task 2)
- FOUND: 43d2adb (Task 3)
- FOUND: 5df390f (Task 4)
