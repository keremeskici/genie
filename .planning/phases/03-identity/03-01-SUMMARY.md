---
phase: 03-identity
plan: "01"
subsystem: identity
tags: [world-id, verification, user-context, zk-proof, hono]
dependency_graph:
  requires: [02-data-layer/02-04]
  provides: [isVerified-boolean, POST-verify-endpoint, context-cache-invalidation]
  affects: [agent/context.ts, routes/chat.ts, agent/index.ts, routes/verify.ts]
tech_stack:
  added: [zod-proofSchema]
  patterns: [TDD-red-green, World-ID-Cloud-v2, cache-invalidation-on-verify]
key_files:
  created:
    - apps/api/src/routes/verify.ts
    - apps/api/src/routes/verify.test.ts
  modified:
    - apps/api/src/agent/context.ts
    - apps/api/src/agent/context.test.ts
    - apps/api/src/agent/index.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/index.ts
decisions:
  - "isVerified and isHumanBacked both derive from user.worldId !== null — single source of truth in DB"
  - "verifyRoute calls developer.world.org/api/v2/verify/{appId} (World ID Cloud v2) — WORLD_APP_ID and WORLD_ACTION env vars required"
  - "nullifier_hash stored in users.worldId column — already nullable text column, no migration needed"
  - "invalidateContextCache called immediately after successful verify — ensures next chat request sees isVerified=true without 30-min TTL delay"
metrics:
  duration_minutes: 7
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_changed: 7
---

# Phase 03 Plan 01: World ID Verification Endpoint and UserContext Identity Summary

**One-liner:** POST /verify endpoint validates World ID ZK proofs via Cloud v2 API, stores nullifier_hash, and threads isVerified/isHumanBacked booleans through the entire UserContext pipeline.

## What Was Built

### Task 1: Extend UserContext with isVerified/isHumanBacked

Extended the `UserContext` interface with two required booleans: `isVerified` and `isHumanBacked`. Updated `assembleContext` to inject verification status into the context string:
- Verified: `, verified=true, humanBacked=true`
- Unverified: `, verified=false (gated actions unavailable — suggest World ID verification), humanBacked=false`

Updated all three stub/fallback paths:
- `fetchUserContext` success path: derives both from `user.worldId !== null`
- `fetchUserContext` not-found stub: both set to `false`
- `runAgent` fallback stub in `agent/index.ts`: both set to `false`

### Task 2: POST /verify Endpoint

Created `apps/api/src/routes/verify.ts` with:
- Zod schema validating `userId` (UUID), `proof`, `merkle_root`, `nullifier_hash`, `verification_level` (orb|device)
- DB pre-check: 404 if user not found, 409 if already has `worldId`
- Calls `https://developer.world.org/api/v2/verify/${WORLD_APP_ID}` with `action` from `WORLD_ACTION` env var
- 400 `VERIFICATION_FAILED` if portal rejects
- Stores `nullifier_hash` in `users.worldId` on success
- Calls `invalidateContextCache(userId)` to bust the 30-min TTL cache

Wired `verifyRoute` into `apps/api/src/index.ts`.

## Test Results

- Task 1: 12/12 context tests pass (8 existing + 4 new isVerified/isHumanBacked tests)
- Task 2: 6/6 verify route tests (success, invalid input, not found, already verified, portal failure, correct URL)
- Full suite: **67 tests across 10 files — all passing**

## Commits

- `628b1f3` feat(03-01): extend UserContext with isVerified/isHumanBacked, update assembleContext and all stubs
- `890cc8f` feat(03-01): create POST /verify endpoint with World ID Cloud v2 validation

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data paths are wired. `isVerified` and `isHumanBacked` derive from live DB state (`users.worldId`). The verify route requires two env vars (`WORLD_APP_ID`, `WORLD_ACTION`) which must be set before the endpoint can call the World ID portal.

## User Setup Required

Before POST /verify will work against the real World ID portal:
1. Create a World ID app at https://developer.world.org
2. Create an action (e.g., `verify-human`)
3. Set env vars:
   - `WORLD_APP_ID=app_xxxx`
   - `WORLD_ACTION=verify-human`

## Self-Check: PASSED

- `apps/api/src/routes/verify.ts` — exists
- `apps/api/src/routes/verify.test.ts` — exists
- `apps/api/src/agent/context.ts` contains `isVerified: boolean` — confirmed
- `apps/api/src/index.ts` contains `verifyRoute` — confirmed
- Commits `628b1f3` and `890cc8f` — confirmed in git log
