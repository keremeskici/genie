---
phase: 01-agent-infra
plan: 01
subsystem: api
tags: [hono, bun, vercel-ai-sdk, 0g-compute, turborepo, pnpm, vitest, typescript]

# Dependency graph
requires: []
provides:
  - Turborepo monorepo scaffold with pnpm workspaces (apps/api)
  - Hono server with /health endpoint and Bun-native export
  - 0G Compute OpenAI-compatible provider instances (glm5, deepseekV3) via static API key
  - Three-layer context assembly (assembleContext + UserContext interface)
  - Sliding window with sticky message preservation (applyWindow + isSticky)
  - System prompt template with {{date}} interpolation
  - 21 passing unit tests across providers, context, and window modules
affects: [01-02, 02-tools-and-memory, all backend phases]

# Tech tracking
tech-stack:
  added:
    - ai@6.0.146 (Vercel AI SDK — streamText, CoreMessage, tool())
    - "@ai-sdk/openai@3.0.50 (createOpenAI with custom baseURL for 0G)"
    - hono@4.12.10 (HTTP server, routing, CORS, logger)
    - zod@3.24.6 (tool input schemas)
    - vitest@latest (unit test runner)
    - "@hono/node-server@1.19.12 (Node.js fallback for dev without Bun)"
    - turbo@2.9.3 (monorepo build orchestration)
  patterns:
    - Static OG_API_KEY authentication for Phase 1 (broker SDK deferred to Phase 2)
    - Bun export default { port, fetch } pattern with Node.js dynamic import fallback
    - Three-layer context: system string + context injection + history + current message
    - Sticky message predicate for sliding window (tool, system, yes-send, no-cancel roles)

key-files:
  created:
    - apps/api/src/index.ts
    - apps/api/src/agent/providers.ts
    - apps/api/src/agent/context.ts
    - apps/api/src/agent/window.ts
    - apps/api/src/prompts/system.md
    - apps/api/src/agent/providers.test.ts
    - apps/api/src/agent/context.test.ts
    - apps/api/src/agent/window.test.ts
    - apps/api/package.json
    - apps/api/tsconfig.json
    - apps/api/vitest.config.ts
    - pnpm-workspace.yaml
    - turbo.json
    - package.json
  modified: []

key-decisions:
  - "Phase 1 uses static OG_API_KEY — @0glabs/0g-serving-broker and ethers deferred to Phase 2 for wallet-based on-chain auth"
  - "hono/logger import path used (not hono/middleware which is not exported by hono 4.x)"
  - "@hono/node-server added as devDep with dynamic import fallback for CI/dev without Bun runtime"
  - "window.ts applyWindow defaults to 40-message limit; sticky: tool, system, yes-send, no-cancel"

patterns-established:
  - "Pattern 1: 0G providers — createOpenAI with OG_COMPUTE_URL/v1/proxy baseURL and static apiKey, two named model exports (glm5, deepseekV3)"
  - "Pattern 2: Hono server — export default { port, fetch } for Bun, dynamic @hono/node-server import fallback for Node.js"
  - "Pattern 3: Context assembly — assembleContext(systemPrompt, userCtx, history, userMsg) returns { system, messages }"
  - "Pattern 4: Sliding window — applyWindow(messages, limit=40) drops oldest non-sticky; isSticky(msg) detects protected messages"

requirements-completed: [AGEN-01, AGEN-05, AGEN-06]

# Metrics
duration: 5min
completed: 2026-04-04
---

# Phase 01 Plan 01: Agent Infra Scaffold Summary

**Turborepo monorepo scaffolded with Hono/Bun API server, 0G Compute dual-model providers (GLM-5 + DeepSeek V3) via static API key, and three-layer context + 40-message sticky sliding window with 21 passing unit tests**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-04T09:18:48Z
- **Completed:** 2026-04-04T09:23:19Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Monorepo scaffolded with Turborepo + pnpm workspaces, all dependencies installed
- Hono server runs on Bun (export default { port, fetch }), verified health endpoint returns `{"status":"ok","service":"genie-api"}`
- 0G Compute provider instances `glm5` and `deepseekV3` configured via `OG_COMPUTE_URL` env var with static API key (Phase 1 scope)
- Three-layer context assembly with correct message ordering: context injection + assistant ack + history + current message
- Sliding window with sticky message preservation: tool results, system messages, "yes, send" and "no, cancel" confirmations never dropped
- 21 unit tests across 3 test files, all passing (providers, context, window)

## Task Commits

1. **Task 1: Scaffold monorepo + apps/api package + 0G providers + Hono skeleton** - `453b2cc` (feat)
2. **Task 2: Implement context assembly + sliding window + all unit tests** - `6d98de7` (feat)

## Files Created/Modified

- `pnpm-workspace.yaml` - pnpm workspace definition (apps/*)
- `turbo.json` - Turborepo pipeline (dev, test, build)
- `package.json` - Root package with turbo devDep
- `apps/api/package.json` - @genie/api with ai, @ai-sdk/openai, hono, zod, vitest, @hono/node-server
- `apps/api/tsconfig.json` - ES2022, bundler moduleResolution, strict mode
- `apps/api/vitest.config.ts` - Vitest with node environment
- `apps/api/src/index.ts` - Hono app with /health, Bun export, Node.js fallback
- `apps/api/src/agent/providers.ts` - glm5 and deepseekV3 via 0G Compute static API key
- `apps/api/src/agent/context.ts` - UserContext interface, loadSystemPrompt(), assembleContext()
- `apps/api/src/agent/window.ts` - isSticky(), applyWindow() with 40-message limit
- `apps/api/src/prompts/system.md` - Genie system prompt with {{date}} placeholder
- `apps/api/src/agent/providers.test.ts` - 3 provider tests
- `apps/api/src/agent/context.test.ts` - 4 context assembly tests
- `apps/api/src/agent/window.test.ts` - 14 sliding window tests

## Decisions Made

- Static OG_API_KEY for Phase 1 speed; @0glabs/0g-serving-broker wallet-based auth is a Phase 2 concern
- Used `hono/logger` import (hono 4.x exports named subpaths, not `hono/middleware` barrel)
- Added `@hono/node-server` as devDep for testing in Node.js environments without Bun installed

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect Hono middleware import path**
- **Found during:** Task 1 (Hono skeleton creation)
- **Issue:** Plan specified `import { logger } from 'hono/middleware'` but hono@4.x does not export a `middleware` subpath; correct export is `hono/logger`
- **Fix:** Changed import to `from 'hono/logger'`
- **Files modified:** `apps/api/src/index.ts`
- **Verification:** Server starts and /health returns 200
- **Committed in:** `453b2cc` (Task 1 commit)

**2. [Rule 3 - Blocking] Added @hono/node-server + Node.js dynamic import fallback**
- **Found during:** Task 1 (server verification)
- **Issue:** Bun runtime not installed in this environment; `export default { port, fetch }` is Bun-only and the server would not start under Node.js/tsx
- **Fix:** Added `@hono/node-server` as devDep; added `typeof Bun === 'undefined'` guard with dynamic `import('@hono/node-server')` fallback in index.ts
- **Files modified:** `apps/api/src/index.ts`, `apps/api/package.json`
- **Verification:** Server responds to `curl http://localhost:3001/health` when run via `npx tsx`
- **Committed in:** `453b2cc` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix, 1 blocking issue)
**Impact on plan:** Both auto-fixes necessary for correctness. Bun-native export preserved; Node.js fallback is dev-only. No scope creep.

## Issues Encountered

- Bun not available in execution environment — resolved via @hono/node-server dev dependency and runtime detection (see deviation #2 above)

## User Setup Required

None - no external service configuration required for this plan. 0G Compute URL is configurable via `OG_COMPUTE_URL` env var (defaults to `https://compute-network-1.integratenetwork.work`).

## Next Phase Readiness

- Plan 01-02 can now wire the chat endpoint using providers.ts, context.ts, and window.ts
- glm5 and deepseekV3 model instances are ready to pass to streamText()
- assembleContext() and applyWindow() are tested and ready for integration
- System prompt template is loaded at startup and interpolated with current date

---
*Phase: 01-agent-infra*
*Completed: 2026-04-04*
