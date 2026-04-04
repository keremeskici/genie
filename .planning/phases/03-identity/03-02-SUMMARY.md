---
phase: 03-identity
plan: 02
subsystem: agent/identity
tags: [verification, world-id, gating, system-prompt, tdd]
dependency_graph:
  requires: [03-01]
  provides: [requireVerified guard, verification-aware system prompt]
  affects: [apps/api/src/tools/require-verified.ts, apps/api/src/prompts/system.md]
tech_stack:
  added: []
  patterns: [verification-guard, TDD red-green]
key_files:
  created:
    - apps/api/src/tools/require-verified.ts
    - apps/api/src/tools/require-verified.test.ts
  modified:
    - apps/api/src/prompts/system.md
decisions:
  - requireVerified returns null for pass, structured error for fail — consistent with tool return pattern
  - System prompt lists concrete gated vs available actions so agent can guide users accurately
metrics:
  duration_seconds: 79
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_changed: 3
---

# Phase 03 Plan 02: Verification Guard and Verification-Aware System Prompt Summary

**One-liner:** requireVerified guard returns null/VERIFICATION_REQUIRED based on isVerified flag, system prompt tells agent which actions are gated and how to guide unverified users toward World ID verification.

## What Was Built

### Task 1: requireVerified gating guard utility (TDD)

Created `apps/api/src/tools/require-verified.ts` with a reusable guard function for Phase 4/5 gated tools:

- Returns `null` when `userContext.isVerified` is true (guard passes, tool proceeds)
- Returns `{ error: 'VERIFICATION_REQUIRED', message: '...' }` when user is not verified
- 3 tests cover: pass case, fail case, exact key shape
- All 3 tests pass

### Task 2: Verification-aware system prompt + isHumanBacked confirmation

Updated `apps/api/src/prompts/system.md` to include a "Verification Awareness" section:

- Explains that context injection will include `verified=true` or `verified=false`
- Lists available actions for unverified users (balance, receive, view, chat)
- Lists gated (blocked) actions: sending money, creating debts, setting goals
- Instructs agent to respond with verify button prompt for blocked actions
- `isHumanBacked` already flows through context from Plan 01 — confirmed no changes needed
- Full test suite: 70/70 tests pass with no regressions

## Key Decisions

1. **requireVerified returns null for pass** — consistent with existing tool return-early pattern (matches how get-balance tool handles errors)
2. **System prompt lists concrete examples** — agent needs specific action names, not abstract descriptions, to correctly gate requests

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `apps/api/src/tools/require-verified.ts` exists
- [x] `apps/api/src/tools/require-verified.test.ts` exists  
- [x] `apps/api/src/prompts/system.md` contains "World ID", "verified=true", "verified=false"
- [x] Commits: f80b535, f43ab99
- [x] 70/70 tests pass

## Self-Check: PASSED
