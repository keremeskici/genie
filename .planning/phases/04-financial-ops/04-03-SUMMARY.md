---
phase: 04-financial-ops
plan: "03"
subsystem: financial-ops
tags: [confirm-endpoint, agent-tools, on-chain-transfer, hono, viem]
dependency_graph:
  requires: ["04-01", "04-02"]
  provides: ["POST /confirm endpoint", "agent tool registration"]
  affects: ["apps/api/src/routes/confirm.ts", "apps/api/src/agent/index.ts"]
tech_stack:
  added: ["viem 2.45.3"]
  patterns: ["factory tool pattern", "TDD red-green", "static import over dynamic import"]
key_files:
  created:
    - apps/api/src/routes/confirm.ts
    - apps/api/src/routes/confirm.test.ts
    - apps/api/src/chain/clients.ts
    - apps/api/src/chain/transfer.ts
    - apps/api/src/contracts/abis.ts
    - apps/api/src/tools/resolve-contact.ts
    - apps/api/src/tools/send-usdc.ts
  modified:
    - apps/api/src/index.ts
    - apps/api/src/agent/index.ts
    - apps/api/src/agent/index.test.ts
    - apps/api/src/tools/get-balance.ts
    - apps/api/src/tools/get-balance.test.ts
    - apps/api/package.json
decisions:
  - "Static import for @genie/db in confirm.ts ensures vi.mock() intercepts correctly in tests"
  - "get_balance available to anonymous users; resolve_contact and send_usdc require userId"
  - "Factory pattern for get_balance to bind walletAddress from userContext at request time"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-04"
  tasks: 2
  files: 12
---

# Phase 4 Plan 03: Confirm Endpoint and Agent Tool Wiring Summary

**One-liner:** POST /confirm completes pending USDC transactions via GenieRouter+PayHandler with full error handling, and agent registers all 4 Phase 4 tools (get_balance, resolve_contact, send_usdc, update_memory).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | POST /confirm endpoint with tests (TDD) | d4286a1 | confirm.ts, confirm.test.ts, index.ts + Wave 1/2 prereqs |
| 2 | Register all Phase 4 tools in agent orchestrator | aec7ff1 | agent/index.ts, agent/index.test.ts |

## What Was Built

### Task 1: POST /confirm endpoint

`apps/api/src/routes/confirm.ts` implements the FOPS-05 confirmation flow:
- Validates `txId` and `userId` from request body (400 on missing)
- Loads transaction from DB, verifies ownership (404 if not found)
- Rejects already-confirmed (409), expired/failed (410) transactions
- Checks time-based expiry via `expiresAt` field, marks expired in DB (410)
- Fetches sender wallet from `users` table (static import — not dynamic)
- Calls `executeOnChainTransfer(senderWallet, recipientWallet, amountUsd)`
- Updates transaction to `status: 'confirmed'` with `txHash` on success
- Updates transaction to `status: 'failed'` and returns 500 on transfer error
- Registered at `app.route('/', confirmRoute)` in apps/api/src/index.ts

8 tests covering all branches: missing fields, not found, expired, confirmed, time-expired, success, transfer error.

### Task 2: Agent tool registration

`apps/api/src/agent/index.ts` updated with all 4 Phase 4 tools:
- `get_balance`: `createGetBalanceTool(resolvedUserContext)` — always available (reads USDC balance on-chain)
- `resolve_contact`: `createResolveContactTool(userId)` — userId-gated (DB access required)
- `send_usdc`: `createSendUsdcTool(userId, resolvedUserContext)` — userId-gated (verification gate + DB writes)
- `update_memory`: existing factory, userId-gated — unchanged

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wave 1/2 prerequisite files missing from worktree**
- **Found during:** Task 1 setup
- **Issue:** This worktree (agent-ad5b741e) is based on an older commit that predates Phase 4 Wave 1/2 work. Files `chain/clients.ts`, `chain/transfer.ts`, `contracts/abis.ts`, `tools/resolve-contact.ts`, `tools/send-usdc.ts` were absent. `get-balance.ts` was the old Phase 1 singleton stub.
- **Fix:** Created all prerequisite files from the main repo's Wave 1/2 implementations, updated `get-balance.ts` to factory pattern, added `viem 2.45.3` to package.json
- **Files created:** `apps/api/src/chain/clients.ts`, `apps/api/src/chain/transfer.ts`, `apps/api/src/contracts/abis.ts`, `apps/api/src/tools/resolve-contact.ts`, `apps/api/src/tools/send-usdc.ts`
- **Files modified:** `apps/api/src/tools/get-balance.ts`, `apps/api/src/tools/get-balance.test.ts`, `apps/api/package.json`
- **Commit:** d4286a1

**2. [Rule 1 - Bug] agent/index.test.ts mocked old getBalanceTool singleton**
- **Found during:** Task 2 verification
- **Issue:** Existing `agent/index.test.ts` mocked `getBalanceTool` (old export) but agent now uses `createGetBalanceTool` factory — tests failed with "No createGetBalanceTool export defined on mock"
- **Fix:** Updated mock to `createGetBalanceTool: vi.fn(() => ({ ... }))`, added mocks for `createResolveContactTool` and `createSendUsdcTool`
- **Files modified:** `apps/api/src/agent/index.test.ts`
- **Commit:** aec7ff1

## Known Stubs

None — all tools wired to real implementations (on-chain balance reads, DB contact resolution, verified send flow).

## Verification Results

- `pnpm test -- --run`: 72/72 tests pass (11 test files)
- `grep 'send_usdc' apps/api/src/agent/index.ts`: tool registered
- `grep 'resolve_contact' apps/api/src/agent/index.ts`: tool registered
- `grep 'confirmRoute' apps/api/src/index.ts`: route registered
- `grep 'createGetBalanceTool' apps/api/src/agent/index.ts`: factory import used

## Self-Check: PASSED
