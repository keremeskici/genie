---
phase: 04-financial-ops
plan: 02
subsystem: financial-tools
tags: [viem, usdc, tools, tdd, on-chain]
dependency_graph:
  requires:
    - 04-01 (viem clients, ABI constants, DB schema with transactions/contacts)
    - 03-02 (requireVerified guard)
  provides:
    - createGetBalanceTool (real USDC balance via viem readContract)
    - createResolveContactTool (three-path recipient resolution)
    - createSendUsdcTool (verification-gated USDC send with threshold logic)
    - executeOnChainTransfer (GenieRouter.route + PayHandler.execute)
  affects:
    - 04-03 (agent wiring will register these factory tools)
tech_stack:
  added: []
  patterns:
    - Factory pattern for tool binding (userId + userContext per request)
    - TDD with mocked viem/DB (vi.mock for external deps)
    - Three-path resolution (0x direct → World API → contacts DB)
    - Threshold-based auto-approve vs confirmation_required
key_files:
  created:
    - apps/api/src/tools/get-balance.ts
    - apps/api/src/tools/get-balance.test.ts
    - apps/api/src/tools/resolve-contact.ts
    - apps/api/src/tools/resolve-contact.test.ts
    - apps/api/src/tools/send-usdc.ts
    - apps/api/src/tools/send-usdc.test.ts
    - apps/api/src/chain/transfer.ts
  modified: []
decisions:
  - "Factory pattern for all financial tools (createGetBalanceTool, createResolveContactTool, createSendUsdcTool) — binds userId/userContext at registration time, same pattern as update_memory"
  - "resolve_contact uses includes() fuzzy match as primary strategy — 'Alice' matches both 'Alice' and 'Alice Smith', triggering D-08 disambiguation"
  - "send_usdc cancels existing pending txs (set status='expired') before creating new pending tx — prevents multiple pending transactions per user"
  - "executeOnChainTransfer is a simple two-step function (route then execute), mocked entirely in tests — no real RPC calls in test suite"
metrics:
  duration: ~15 minutes
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_created: 7
  files_modified: 0
---

# Phase 04 Plan 02: Financial Tools (get_balance, resolve_contact, send_usdc) Summary

**One-liner:** Real USDC balance lookup, three-path contact resolution, and verification-gated send with threshold-based auto-approve via viem writeContract orchestration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Failing tests for get_balance + resolve_contact | 3350103 | get-balance.test.ts, resolve-contact.test.ts |
| 1 (GREEN) | Implement get_balance + resolve_contact | 3aa7933 | get-balance.ts, resolve-contact.ts |
| 2 (RED) | Failing tests for send_usdc | 8d028e1 | send-usdc.test.ts |
| 2 (GREEN) | Implement send_usdc + transfer | 1092637 | send-usdc.ts, transfer.ts |

## What Was Built

### get_balance (upgraded from Phase 1 stub)

`createGetBalanceTool(userContext)` replaces the hardcoded `'100.00'` stub with a real `publicClient.readContract` call using `erc20Abi.balanceOf` on the USDC contract. Returns `{ balance, currency: 'USDC', chain: 'World Chain' }` or `{ error: 'FETCH_FAILED' }` on failure.

### resolve_contact

`createResolveContactTool(userId)` implements three-path resolution (D-07 priority order):
1. Raw `0x` address (42 chars) — returned directly without any API/DB calls
2. World Username API (`usernames.worldcoin.org/api/v1/{name}`) — returns address if 200
3. Contacts DB — case-insensitive `includes()` match; returns `multiple_matches` list for disambiguation (D-08)

### send_usdc

`createSendUsdcTool(userId, userContext)` gates on `requireVerified`, then branches:
- `amountUsd <= autoApproveUsd`: calls `executeOnChainTransfer`, inserts `status: 'confirmed'` tx, returns `{ type: 'transfer_complete' }`
- `amountUsd > autoApproveUsd`: expires existing pending txs, inserts `status: 'pending'` with 15-min expiry, returns `{ type: 'confirmation_required', txId }`

### executeOnChainTransfer

Two-step on-chain orchestration (D-03):
1. `GenieRouter.route(sender, amount, PAY_HANDLER_ADDRESS)` — pulls from user USDC allowance
2. `PayHandler.execute(recipient, amount)` — sends to final recipient

Amount uses `parseUnits(amountUsd.toString(), 6)` for USDC 6-decimal conversion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] viem not symlinked in apps/api node_modules**
- **Found during:** Task 1 GREEN (first test run after adding `erc20Abi` import)
- **Issue:** viem was listed in `apps/api/package.json` dependencies but not installed/symlinked by pnpm in the workspace
- **Fix:** Ran `pnpm install --filter @genie/api` which created the symlink
- **Files modified:** pnpm lockfile (no source changes)

**2. [Rule 1 - Behavior] resolve_contact fuzzy match strategy**
- **Found during:** Task 1 GREEN test run (multiple_matches test failed)
- **Issue:** Original plan had exact match first then fuzzy fallback — but test expected "Alice" to match both "Alice" and "Alice Smith" (multiple_matches). The two-pass approach would resolve "Alice" exactly to one result, bypassing disambiguation.
- **Fix:** Unified to single `includes()` pass — all contacts matching the query string are collected, then single/multiple/zero logic applied. This correctly implements D-08 intent.
- **Files modified:** resolve-contact.ts only

**3. [Rule 1 - State] STATE.md merge conflict**
- **Found during:** First commit attempt
- **Issue:** Two parallel agents modified STATE.md — git had unmerged conflict markers
- **Fix:** Resolved by keeping the upstream (04-01 completed) version as most current

## Known Stubs

None. All four production files (`get-balance.ts`, `resolve-contact.ts`, `send-usdc.ts`, `chain/transfer.ts`) are fully implemented with no placeholder logic. The prior Phase 1 stub (`'100.00'` hardcoded balance) has been removed.

## Self-Check

Files created:
- apps/api/src/tools/get-balance.ts — FOUND
- apps/api/src/tools/resolve-contact.ts — FOUND
- apps/api/src/tools/send-usdc.ts — FOUND
- apps/api/src/chain/transfer.ts — FOUND
- apps/api/src/tools/get-balance.test.ts — FOUND
- apps/api/src/tools/resolve-contact.test.ts — FOUND
- apps/api/src/tools/send-usdc.test.ts — FOUND

Commits:
- 3350103 test(04-02): add failing tests for get_balance and resolve_contact — FOUND
- 3aa7933 feat(04-02): implement createGetBalanceTool and createResolveContactTool — FOUND
- 8d028e1 test(04-02): add failing tests for send_usdc tool — FOUND
- 1092637 feat(04-02): implement executeOnChainTransfer and createSendUsdcTool — FOUND

Test results: 74/74 tests pass (12 test files, all green)

## Self-Check: PASSED
