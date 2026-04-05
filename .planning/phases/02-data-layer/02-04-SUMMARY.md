---
phase: 02-data-layer
plan: "04"
subsystem: api
tags: [0g-kv, agent-memory, tool-calling, vitest, typescript]

# Dependency graph
requires:
  - phase: 02-data-layer/02-03
    provides: contextCache Map in chat.ts, writeMemory in kv/memory.ts, readMemory wired into chat route
provides:
  - update_memory tool (createUpdateMemoryTool factory) that calls writeMemory with merged AgentMemory
  - invalidateContextCache export from chat.ts for post-write cache busting
  - update_memory registered in streamText tools map (only when userId present)
  - Unit tests verifying merge, goal add/remove, cache invalidation, and write failure path
affects: [agent, kv, routes/chat, tools]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Factory pattern for tools: createUpdateMemoryTool(userId, currentMemory) creates per-request bound tool
    - Conditional tool registration: spread pattern to add update_memory only when userId present
    - In-place Object.assign to update currentMemory snapshot for same-session subsequent tool calls

key-files:
  created:
    - apps/api/src/tools/update-memory.ts
    - apps/api/src/tools/update-memory.test.ts
  modified:
    - apps/api/src/routes/chat.ts
    - apps/api/src/agent/index.ts

key-decisions:
  - "Factory pattern for update_memory: each request gets its own tool instance with userId + memory snapshot (not a singleton)"
  - "update_memory only registered when userId present — anonymous users cannot persist memory"
  - "KV write failure returns { success: false } gracefully — never throws or breaks conversation flow (D-07)"

patterns-established:
  - "Tool factory pattern: createXxxTool(userId, context) for tools needing request-scoped state"
  - "Cache invalidation via exported function: invalidateContextCache(userId) called post-write"

requirements-completed: [AGEN-07]

# Metrics
duration: 3min
completed: 2026-04-04
---

# Phase 02 Plan 04: Wire writeMemory via update_memory Tool Summary

**update_memory tool factory that merges AgentMemory partial updates, writes to 0G KV, and busts context cache — completing AGEN-07 write path**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-04T11:59:36Z
- **Completed:** 2026-04-04T12:02:46Z
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Created `createUpdateMemoryTool` factory in `apps/api/src/tools/update-memory.ts` that merges partial AgentMemory updates (financialProfile, preferences, activeGoals via addGoal/removeGoalId), writes to 0G KV via `writeMemory`, and invalidates context cache on success
- Exported `invalidateContextCache` from `apps/api/src/routes/chat.ts` so the tool can bust the 30-min session cache after a successful KV write
- Registered `update_memory` in `runAgent`'s `streamText` tools map using spread-conditional pattern (only when `userId` present); 57 tests pass (5 new)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create update_memory tool and export cache invalidation** - `802a259` (feat)
2. **Task 2: Register update_memory tool in agent orchestrator** - `dc3e3b3` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified
- `apps/api/src/tools/update-memory.ts` - Factory function returning AI SDK tool; merges partial AgentMemory, calls writeMemory, invalidates cache
- `apps/api/src/tools/update-memory.test.ts` - 5 unit tests covering merge, addGoal, removeGoalId, cache invalidation, and write failure
- `apps/api/src/routes/chat.ts` - Added `export function invalidateContextCache(userId)` after `getCachedContext`
- `apps/api/src/agent/index.ts` - Imports createUpdateMemoryTool + DEFAULT_MEMORY; creates tool per request; adds to streamText tools map conditionally

## Decisions Made
- Factory pattern (`createUpdateMemoryTool`) rather than singleton: each request needs its own userId and memory snapshot to avoid cross-user contamination
- Anonymous users get no `update_memory` tool: conditional spread `...(updateMemoryTool ? { update_memory: updateMemoryTool } : {})` keeps tools map clean
- `Object.assign(currentMemory, merged)` in-place update: so subsequent tool calls in the same agent session see already-written changes without re-fetching from KV

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `apps/api` (window.ts CoreMessage export, providers.ts compatibility flag, get-balance.test.ts execute possibly undefined) — all pre-date this plan and are unrelated to changes made. My new production files introduce no new type errors.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `writeMemory` is no longer orphaned — the agent will now call it when the user states a financial preference, sets a goal, or changes their profile
- AGEN-07 ("0G Storage KV persists user context across sessions") is fully satisfied: read path (02-03) + write path (02-04) both complete
- Phase 03 features can rely on memory persisting across sessions

---
*Phase: 02-data-layer*
*Completed: 2026-04-04*
