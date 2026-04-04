---
phase: quick
plan: 260405-0kh
subsystem: api, web, config
tags: [env, config, refactor, centralization]
dependency_graph:
  requires: []
  provides: [centralized-env-config]
  affects: [apps/api/src, apps/web/src]
tech_stack:
  added: []
  patterns: [centralized-env-module, requireEnv-helper]
key_files:
  created:
    - apps/api/src/config/env.ts
  modified:
    - apps/api/src/agent/providers.ts
    - apps/api/src/agent/index.ts
    - apps/api/src/index.ts
    - apps/api/src/chain/clients.ts
    - apps/api/src/tools/resolve-contact.ts
    - apps/api/src/routes/verify.ts
    - apps/api/src/kv/client.ts
    - apps/api/src/kv/memory.ts
    - apps/web/src/components/Transaction/index.tsx
    - apps/web/src/app/api/verify-proof/route.ts
    - .env.example
decisions:
  - "Single config/env.ts module with requireEnv (throws) and optionalEnv (returns undefined) helpers"
  - "Web/Next.js files keep process.env.NEXT_PUBLIC_* reads inline per Next.js build-time inlining requirements"
  - "WORLD_VERIFY_API_URL used by both API server and web verify-proof route via same env var name"
  - "Re-export OG_COMPUTE_URL from providers.ts to maintain test compatibility with providers.test.ts"
metrics:
  duration: "15 minutes"
  completed: "2026-04-05"
  tasks: 2
  files: 12
---

# Quick Task 260405-0kh: Tidy Up Env Variables Across Repo Summary

**One-liner:** Single `apps/api/src/config/env.ts` module centralizes all API env reads with typed exports; hardcoded URLs and contract addresses replaced across 10 source files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create centralized env config and add new env vars | d2f64de | apps/api/src/config/env.ts, .env.example |
| 2 | Refactor all source files to import from centralized config | c7809c4 | 10 source files updated |

## What Was Built

### Task 1: Centralized Env Config

Created `apps/api/src/config/env.ts` with:
- `requireEnv(name)` helper — throws with clear message if var missing
- `optionalEnv(name)` helper — returns `string | undefined` for gracefully-degraded vars
- All API env vars grouped by concern: 0G Compute, 0G KV Storage, World ID, World Chain, API Server
- Four new vars documented in `.env.example`: `WORLD_VERIFY_API_URL`, `WORLD_USERNAME_API_URL`, `USDC_ADDRESS_TESTNET`, `USDC_ADDRESS_MAINNET`
- Two new web vars: `NEXT_PUBLIC_WORLD_CHAIN_RPC_URL`, `NEXT_PUBLIC_TEST_CONTRACT_ADDRESS`

### Task 2: Source File Refactors

All 10 files now import from centralized config:

- **providers.ts** — Removed local `requireEnv` helper and 4 inline env reads; imports from config/env; re-exports `OG_COMPUTE_URL` for test compatibility
- **agent/index.ts** — `MAX_OUTPUT_TOKENS` and `WINDOW_LIMIT` now from config/env
- **api/index.ts** — `PORT` now from config/env
- **chain/clients.ts** — All 7 chain-related vars from config/env; USDC_ADDRESS ternary uses `USDC_ADDRESS_TESTNET`/`USDC_ADDRESS_MAINNET` from env instead of hardcoded strings
- **tools/resolve-contact.ts** — Hardcoded `WORLD_USERNAME_API` constant replaced with `WORLD_USERNAME_API_URL` from config/env
- **routes/verify.ts** — `WORLD_APP_ID`, `WORLD_ACTION`, `WORLD_VERIFY_API_URL` from config/env; hardcoded developer.world.org URL removed
- **kv/client.ts** — `OG_KV_CLIENT_URL`, `OG_PRIVATE_KEY`, `OG_KV_STREAM_ID` from config/env
- **kv/memory.ts** — `OG_KV_STREAM_ID` from config/env
- **web Transaction/index.tsx** — Hardcoded contract address and RPC URL replaced with `NEXT_PUBLIC_TEST_CONTRACT_ADDRESS` and `NEXT_PUBLIC_WORLD_CHAIN_RPC_URL`
- **web verify-proof/route.ts** — Hardcoded worldcoin.org verify URL replaced with `WORLD_VERIFY_API_URL` env var with fallback

## Verification

```
grep -rn "process\.env\." apps/api/src/ --include="*.ts" | grep -v "config/env.ts" | grep -v ".test.ts" | grep -v "vitest.config"
# Returns empty — zero process.env reads outside config module
```

## Deviations from Plan

### Auto-added: Re-export OG_COMPUTE_URL from providers.ts

**Found during:** Task 2
**Issue:** `providers.test.ts` imports `OG_COMPUTE_URL` from `./providers` — removing it would break the test
**Fix:** Added `OG_COMPUTE_URL` to the re-exports from providers.ts alongside `PLANNING_MODEL` and `ACTION_MODEL`
**Files modified:** apps/api/src/agent/providers.ts
**Commit:** c7809c4

### Pre-existing TypeScript errors (not introduced by this task)

The following TS errors exist in the codebase before this task and were not caused by these changes:
- `CoreMessage` not exported from `ai` module (version mismatch in several files)
- `compatibility` property not recognized in `OpenAIProviderSettings` (providers.ts)
- `.chat()` called with 2 args but expects 1 (providers.ts)
- `tool.execute` possibly undefined in test files

These are out of scope and pre-existed before this change.

## Known Stubs

None — all env vars are now wired to actual environment configuration. The `NEXT_PUBLIC_TEST_CONTRACT_ADDRESS` in Transaction/index.tsx is a template component from World Mini App scaffold that is not part of the core Genie product flow.

## Self-Check: PASSED

- `apps/api/src/config/env.ts` exists: FOUND
- Commit d2f64de exists: FOUND
- Commit c7809c4 exists: FOUND
- Zero process.env in apps/api/src/ outside config/env.ts: VERIFIED
