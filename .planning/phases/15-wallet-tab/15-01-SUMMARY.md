---
phase: 15-wallet-tab
plan: "01"
subsystem: frontend-wallet
tags: [wallet, live-data, world-id, verification, usdc, transactions, format-helpers]
dependency_graph:
  requires: []
  provides: [wallet-live-balance, wallet-transactions, wallet-verify-flow, shared-format-helpers]
  affects: [WalletInterface, DashboardInterface, users-profile-route]
tech_stack:
  added: []
  patterns: [useBalance, useTransactions, conditional-verify-section, shared-format-lib]
key_files:
  created:
    - apps/web/src/lib/format.ts
  modified:
    - apps/web/src/components/WalletInterface/index.tsx
    - apps/web/src/components/DashboardInterface/index.tsx
    - apps/api/src/routes/users.ts
decisions:
  - "Shared format helpers in @/lib/format avoid duplication between Dashboard and Wallet"
  - "isVerified state initialized to false — Verify section appears by default, hides after onVerified"
  - "Auth guard on PATCH /api/users/profile is per-route resolveUserId call (D-09), not middleware"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_modified: 4
---

# Phase 15 Plan 01: Wallet Tab Live Data + Verify Summary

WalletInterface wired with live USDC balance (useBalance hook), real transaction history (useTransactions hook), and conditional World ID verification section (Verify component hidden after onVerified), plus shared format helpers extracted from DashboardInterface.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Extract format helpers and wire WalletInterface with live data + Verify | dbe8b9b | apps/web/src/lib/format.ts, apps/web/src/components/WalletInterface/index.tsx, apps/web/src/components/DashboardInterface/index.tsx |
| 2 | Add auth guard comment to PATCH /api/users/profile | 3f3fdcf | apps/api/src/routes/users.ts |

## What Was Built

### Task 1: Live Wallet Tab

**`apps/web/src/lib/format.ts`** — New shared utility module:
- `formatRelativeTime(dateStr)` — converts ISO date to "Today", "Yesterday", "N days ago", or locale date
- `formatWallet(wallet)` — truncates wallet addresses to `0x1234...5678` form

**`apps/web/src/components/WalletInterface/index.tsx`** — Fully rewritten:
- `useSession()` for walletAddress and userId
- `useBalance(walletAddress)` for live USDC balance with loading skeleton and `$--.--` error state
- `useTransactions(userId)` for recent transactions with same rendering pattern as DashboardInterface
- Conditional `{!isVerified && <Verify onVerified={() => setIsVerified(true)} />}` section between balance and transactions
- Decorative card block (aspect-[1.586/1]) preserved exactly

**`apps/web/src/components/DashboardInterface/index.tsx`** — Minor refactor:
- Removed local `formatRelativeTime` and `formatWallet` definitions
- Added import from `@/lib/format` — no behavior changes

### Task 2: Auth Guard Documentation

**`apps/api/src/routes/users.ts`** — Comment added:
- Auth guard (D-08) comment documents that `resolveUserId` is the identity boundary
- No behavioral changes — `USER_NOT_FOUND` 404 was already present

## Deviations from Plan

None - plan executed exactly as written. Task 2 confirmed the guard was already in place and added only the documenting comment as specified.

## Verification

- TypeScript compiles without errors: `apps/web/node_modules/.bin/tsc --noEmit --project apps/web/tsconfig.json` exits 0
- WalletInterface imports useBalance, useTransactions, Verify, formatRelativeTime, formatWallet
- DashboardInterface imports format helpers from `@/lib/format` (no local definitions)
- Decorative card preserved (aspect-[1.586/1] block unchanged)
- Verify section conditional on `!isVerified`, hidden after onVerified callback
- Auth guard comment present on /api/users/profile route

## Known Stubs

None - all data is wired to real hooks (useBalance, useTransactions).

## Self-Check: PASSED

- `/Users/kerem/genie/.claude/worktrees/agent-a5e1409f/apps/web/src/lib/format.ts` — FOUND
- `/Users/kerem/genie/.claude/worktrees/agent-a5e1409f/apps/web/src/components/WalletInterface/index.tsx` — FOUND
- `/Users/kerem/genie/.claude/worktrees/agent-a5e1409f/apps/web/src/components/DashboardInterface/index.tsx` — FOUND
- `/Users/kerem/genie/.claude/worktrees/agent-a5e1409f/apps/api/src/routes/users.ts` — FOUND
- Commit dbe8b9b — FOUND
- Commit 3f3fdcf — FOUND
