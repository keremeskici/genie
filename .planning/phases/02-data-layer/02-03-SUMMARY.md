---
phase: 02-data-layer
plan: "03"
subsystem: agent-pipeline
tags: [context, kv, agent, cache, supabase]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [context-with-memory, context-cache, full-agen07-flow]
  affects: [agent/context.ts, routes/chat.ts, agent/index.ts]
tech_stack:
  added: []
  patterns: [context-cache-ttl, graceful-kv-degradation, tdd-red-green]
key_files:
  created: []
  modified:
    - apps/api/src/agent/context.ts
    - apps/api/src/agent/context.test.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/agent/index.ts
    - apps/api/vitest.config.ts
decisions:
  - "UserContext.memory is optional — backwards compatible with all Phase 1 tests"
  - "assembleContext builds memoryStr inline using template literal — no helper function needed"
  - "contextCache uses in-process Map (no Redis/external) — acceptable for hackathon scope"
  - "resolvedUserContext replaces stubUserContext — stub preserved as fallback when no userId"
metrics:
  duration: "~12 minutes"
  completed: "2026-04-04"
  tasks: 2
  files: 5
---

# Phase 02 Plan 03: Wire Data Layer into Agent Pipeline Summary

**One-liner:** KV memory injected into assembleContext via optional UserContext.memory, with 30-min in-process context cache and graceful KV degradation in chat route.

## What Was Built

### Task 1: Extend UserContext and assembleContext with KV memory injection

Modified `apps/api/src/agent/context.ts`:
- Added `import type { AgentMemory } from '../kv/types'`
- Extended `UserContext` interface with `memory?: AgentMemory` (optional, backwards-compatible)
- Updated `assembleContext` to build `memoryStr` when memory is present: `, goals=N, profile={...}`
- No change to function signature or return type

Extended `apps/api/src/agent/context.test.ts`:
- Added 4 new `describe` blocks testing with-memory and without-memory cases
- Tests confirm `goals=2` when 2 activeGoals, `profile=` with `moderate` when riskTolerance set, `goals=0` and `profile={}` for DEFAULT_MEMORY
- Existing backwards-compatibility tests preserved

### Task 2: Add context cache and Supabase/KV fetch to chat route

Rewrote `apps/api/src/routes/chat.ts`:
- Added `contextCache` Map with 30-min TTL (`SESSION_TTL_MS = 30 * 60 * 1000`)
- `getCachedContext(userId)` — returns cached context or null if expired/missing
- `fetchUserContext(userId)` — checks cache, falls back to Supabase DB query, then 0G KV read; graceful when user not found (stub) or KV unavailable (null memory)
- Updated POST /chat handler to extract `userId` from body, fetch context, pass to `runAgent`
- Imports: `db`, `users` from `../db`; `readMemory` from `../kv`; `eq` from `drizzle-orm`

Updated `apps/api/src/agent/index.ts`:
- Extended `ChatRequest` with `userContext?: UserContext`
- Replaced `stubUserContext` with `resolvedUserContext = request.userContext ?? stub`
- Added `export type { UserContext }` for re-export convenience

Updated `apps/api/vitest.config.ts`:
- Added `DATABASE_URL: 'postgresql://test:test@localhost:5432/test'` for type safety in tests

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | 77b4c62 | feat(02-03): extend UserContext with memory field and inject into assembleContext |
| Task 2 | 8978a36 | feat(02-03): add context cache and Supabase/KV fetch to chat route, update runAgent |

## Verification

- `pnpm --filter @genie/api test` — 8 test files, 52 tests, all pass
- TypeScript: no new errors introduced by our changes (pre-existing `CoreMessage` errors from Phase 1 are out of scope)
- `assembleContext` includes memory data in context injection string
- Chat route caches context per-user with 30-min TTL
- Chat route degrades gracefully when userId not provided (stub context used)
- KV unavailability does not break chat (`null memory` -> no memory in context)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Merge wave 1 outputs from main branch**
- **Found during:** Task 1 setup
- **Issue:** Worktree branch `worktree-agent-a54e8228` was behind `main` — the `kv/` and `db/` directories (Plans 02-01 and 02-02 outputs) didn't exist in the worktree
- **Fix:** `git merge main` fast-forward merge to bring wave 1 outputs into worktree
- **Files modified:** All wave 1 files (db/*, kv/*, drizzle.config.ts, etc.)
- **Commit:** Fast-forward merge (no separate commit — clean fast-forward)

**2. [Rule 3 - Blocking] Install pnpm dependencies in worktree**
- **Found during:** Task 1 setup
- **Issue:** `node_modules` in worktree used broken symlinks pointing to pnpm store; `npm install` failed due to peer dep conflicts with `@0glabs/0g-ts-sdk`
- **Fix:** Used `pnpm install --frozen-lockfile` to properly install all dependencies
- **No commit needed** — node_modules are gitignored

None of the plan's intended changes were modified — only setup blockers were resolved.

## AGEN-07 Flow Complete

The full end-to-end flow now works:
1. `readMemory(userId)` reads from 0G KV Store
2. Memory is injected into `UserContext.memory`
3. `fetchUserContext` caches result for 30 minutes
4. `assembleContext` builds context injection string with `goals=N, profile={...}`
5. LLM receives memory context in every conversation turn

## Known Stubs

None — all data paths are wired. The chat route uses stub context only as fallback when `userId` is not provided (intentional graceful degradation).

## Self-Check: PASSED
