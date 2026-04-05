---
phase: 05-cross-chain-social
plan: 02
subsystem: api
tags: [tools, debt-management, spending-tracking, world-id, verification-gating]
dependency_graph:
  requires:
    - "05-01 (category infrastructure, schema with iOwe/category/source/status)"
    - "03-02 (requireVerified guard)"
    - "@genie/db (debts and transactions tables, gte/lte exports)"
  provides:
    - "createCreateDebtTool factory (DEBT-01)"
    - "createListDebtsTool factory"
    - "createGetSpendingTool factory (SPND-02)"
  affects:
    - "apps/api/src/agent/index.ts (Phase 05-03 will register these tools)"
tech_stack:
  added: []
  patterns:
    - "Factory tool pattern (same as send_usdc, get_balance) — per-request userId binding"
    - "requireVerified gating on create_debt and list_debts"
    - "COALESCE(category, 'transfers') SQL pattern for null category normalization"
    - "confirmed-only filter on spending queries (status='confirmed')"
    - "TDD: RED test files first, then GREEN implementation"
key_files:
  created:
    - apps/api/src/tools/create-debt.ts
    - apps/api/src/tools/create-debt.test.ts
    - apps/api/src/tools/list-debts.ts
    - apps/api/src/tools/list-debts.test.ts
    - apps/api/src/tools/get-spending.ts
    - apps/api/src/tools/get-spending.test.ts
  modified: []
decisions:
  - "get_spending is not verification-gated — viewing spending summaries is an ungated action (same as get_balance)"
  - "iOwe direction flag uses boolean (not string enum) — matches DB schema from Phase 05-01"
  - "COALESCE for null categories returns 'transfers' — consistent with inferCategory default"
  - "conditions array with spread and(...conditions) allows optional category filter without changing base query shape"
metrics:
  duration: 8 minutes
  completed: "2026-04-04"
  tasks_completed: 2
  files_created: 6
  tests_added: 14
---

# Phase 5 Plan 2: Debt Management and Spending Summaries

**One-liner:** Three verified agent tools for debt recording (iOwe direction), debt listing (open debts only), and spending aggregation (COALESCE + confirmed-only filter).

## Tasks Completed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1 | Create debt tools (create_debt and list_debts) | Done | 30c852d |
| 2 | Create get_spending tool | Done | c4e0e8b |

## What Was Built

### create_debt tool (`apps/api/src/tools/create-debt.ts`)

Factory tool that records a debt entry. Gated behind World ID verification (requireVerified).

Key behaviors:
- `iOwe=false`: counterparty owes user ("they owe me")
- `iOwe=true`: user owes counterparty ("I owe them")
- `description` is optional, defaults to null
- Returns `{ type: 'debt_created', id, counterpartyWallet, amountUsd, direction, description }`
- DB errors return `{ error: 'DEBT_CREATION_FAILED', message }`

### list_debts tool (`apps/api/src/tools/list-debts.ts`)

Factory tool that returns all open (settled=false) debts for the user. Gated behind World ID verification.

Key behaviors:
- Queries `WHERE ownerUserId = userId AND settled = false`
- Maps `iOwe` boolean to human-readable direction string
- Returns `{ type: 'debts_list', debts: [...], count: N }`
- Empty results return count=0, debts=[]

### get_spending tool (`apps/api/src/tools/get-spending.ts`)

Factory tool that aggregates spending by category for a date range. NOT verification-gated (viewing spending is ungated, same as balance).

Key behaviors:
- Only sums `status='confirmed'` transactions
- `COALESCE(category, 'transfers')` ensures null categories are counted
- Groups by COALESCE category expression for accurate aggregation
- Optional `category` filter narrows to single spending category
- Agent is responsible for parsing natural language dates to ISO strings
- Returns `{ type: 'spending_summary', categories: [...], total, startDate, endDate }`

## Test Results

- Total tests: 123 (up from 109 before this plan)
- New tests added: 14 (5 for create_debt, 4 for list_debts, 5 for get_spending)
- All 123 tests pass

## Deviations from Plan

**1. [Rule 1 - Bug] Fixed vi.mock chain pattern for list-debts and create-debt tests**
- Found during: Task 1 (GREEN phase)
- Issue: Initial test scaffolding used `vi.fn(() => mockChain)` pattern which returns a function as the value. But the tool then calls `.from()` / `.values()` directly on the return value, not by invoking it. The chained mock needed to return objects with method properties, not callable functions.
- Fix: Restructured mocks to use `const mockWhere = vi.fn()`, `const mockFrom = vi.fn(() => ({ where: mockWhere }))` and `db.select: vi.fn(() => ({ from: mockFrom }))` pattern to match actual drizzle query builder interface.
- Files modified: `apps/api/src/tools/create-debt.test.ts`, `apps/api/src/tools/list-debts.test.ts`
- Commit: 30c852d

**2. [Rule 3 - Prerequisite] Checked out Phase 4 and Phase 5-01 prerequisite files from worktree-agent-a06b0e58**
- Found during: Task 1 setup
- Issue: This worktree branch (agent-a104740e) was on a different divergence point from `worktree-agent-a06b0e58` which had Phase 4 tools (get-balance factory, send-usdc, resolve-contact, chain/transfer, contracts, confirm route) and Phase 5-01 work (categorize, schema updates with iOwe/category/source/status columns, gte/lte exports).
- Fix: `git checkout worktree-agent-a06b0e58 -- <files>` to bring prerequisite files into this branch before implementing Phase 5-02.
- Files: categorize.ts, send-usdc.ts, resolve-contact.ts, get-balance.ts, agent/index.ts, chain/clients.ts, chain/transfer.ts, contracts/abis.ts, routes/confirm.ts, db/schema.ts, db/index.ts, planning phase files.

## Known Stubs

None — all three tools have real implementation logic (DB queries, verification gates, COALESCE SQL).

## Self-Check

- `apps/api/src/tools/create-debt.ts` contains `export function createCreateDebtTool` - FOUND
- `apps/api/src/tools/list-debts.ts` contains `export function createListDebtsTool` - FOUND
- `apps/api/src/tools/get-spending.ts` contains `export function createGetSpendingTool` - FOUND
- All tools contain proper error handling and return shapes - VERIFIED
- 123 tests pass - VERIFIED
