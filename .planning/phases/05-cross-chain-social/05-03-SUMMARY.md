---
phase: 05-cross-chain-social
plan: "03"
subsystem: agent-orchestrator
tags: [settlement, debt-management, spending-tracking, tool-registration, system-prompt]
dependency_graph:
  requires: ["05-01", "05-02"]
  provides: ["checkAndSettleDebts", "create_debt-tool-registered", "list_debts-tool-registered", "get_spending-tool-registered"]
  affects: ["apps/api/src/agent/index.ts", "apps/api/src/routes/chat.ts", "apps/api/src/prompts/system.md"]
tech_stack:
  added: []
  patterns: ["TDD-red-green", "factory-tool-pattern", "graceful-degradation", "context-injection"]
key_files:
  created:
    - apps/api/src/agent/settlement.ts
    - apps/api/src/agent/settlement.test.ts
  modified:
    - apps/api/src/agent/index.ts
    - apps/api/src/routes/chat.ts
    - apps/api/src/prompts/system.md
decisions:
  - "D-09: checkAndSettleDebts gracefully returns [] on any error — never blocks chat"
  - "D-10: Settlement notices injected into enrichedUserMessage before assembleContext call"
  - "XCHD-01: Formally deferred — cross-chain deposits acknowledged in system prompt as coming soon"
  - "iOwe=false filter applied at DB query level (not in-memory) — only debts where they owe me are checked"
  - "parseFloat used for amountUsd comparison — Drizzle numeric columns return JS strings (Pitfall 2)"
metrics:
  duration_seconds: 192
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_modified: 5
---

# Phase 05 Plan 03: Settlement Detection and Tool Integration Summary

**One-liner:** Auto-settlement detects matching incoming transfers and settles open debts; create_debt, list_debts, and get_spending tools wired into the agent with system prompt updated for spending/debt/XCHD-01-deferred awareness.

## What Was Built

### Task 1: Settlement Detection Module (TDD)

Created `apps/api/src/agent/settlement.ts` with `checkAndSettleDebts(ownerUserId, ownerWallet)`:

- Queries open debts where `iOwe=false` (they owe me) — Pitfall 1 handled at DB level
- For each debt, queries incoming confirmed transactions to `ownerWallet` created after the debt
- Matches by `parseFloat` amount comparison within `$1.00 SETTLEMENT_TOLERANCE_USD` — Pitfall 2 handled
- Settles matching debts via `db.update(debts).set({ settled: true })`
- Returns `SettlementNotice[]` for context injection
- Full graceful degradation: `catch` block returns `[]` — never throws, never blocks chat

Created `apps/api/src/agent/settlement.test.ts` with 13 unit tests covering:
- Empty debts → empty notices
- Exact match → settled + notice returned
- iOwe=true excluded (Pitfall 1)
- Amount outside $1 tolerance NOT matched
- Amount within $1 tolerance matched (including boundary cases)
- Multiple debts: only matching ones settled
- No matching transfers → empty notices
- Float vs string comparison (Pitfall 2)
- DB error → graceful empty array
- Transactions after debt creation (Open Question 2)
- Null description handled correctly

### Task 2: Tool Registration and Integration

**`apps/api/src/agent/index.ts`:**
- Added imports: `createCreateDebtTool`, `createListDebtsTool`, `createGetSpendingTool`
- Extended `ChatRequest` interface with `settlementNotices?` array
- Added Phase 5 tool factories (userId-gated, same pattern as existing tools)
- Settlement notice injection: prepends `[Settlement notices: ...]` to `enrichedUserMessage` before `assembleContext` call
- Registered `create_debt`, `list_debts`, `get_spending` in `streamText` tools object

**`apps/api/src/routes/chat.ts`:**
- Added `import { checkAndSettleDebts, type SettlementNotice }`
- Runs `checkAndSettleDebts(userId, userContext.walletAddress)` before `runAgent`
- Logs settled count; catches errors and continues (never blocks)
- Passes `settlementNotices` to `runAgent`

**`apps/api/src/prompts/system.md`:**
- Added `## Spending & Debt Tracking` section with spending categories, natural language date parsing, debt direction guidance
- Added XCHD-01 deferred notice ("Cross-chain deposits are not yet available")
- Settlement notice mention pattern documented for agent

## Test Results

All 136 tests pass (18 test files):
- 13 new settlement unit tests (all pass)
- 123 pre-existing tests (all still pass)
- DB schema tests: 10 passing

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all tools are wired to real DB operations. Settlement detection uses live queries.

## Self-Check: PASSED

- settlement.ts: FOUND
- settlement.test.ts: FOUND
- Commit df49565: FOUND
- Commit 7c4d3f8: FOUND
