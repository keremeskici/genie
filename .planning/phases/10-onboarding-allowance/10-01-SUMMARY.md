---
phase: 10-onboarding-allowance
plan: "01"
subsystem: ui
tags: [erc20, usdc, minikit, viem, worldchain, onboarding, approval]

# Dependency graph
requires:
  - phase: 07-api-wiring
    provides: "PATCH /api/users/profile endpoint for saving autoApproveUsd"
  - phase: 04-financial-ops
    provides: "GenieRouter contract deployed at known address"
provides:
  - "ERC20_APPROVE_ABI, USDC_ADDRESS, GENIE_ROUTER_ADDRESS constants in apps/web/src/lib/contracts.ts"
  - "ApprovalOverlay component with pending/success/error state machine"
  - "Onboarding flow gates /home redirect behind successful USDC.approve transaction"
affects: [financial-ops, onboarding, usdc-transfers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MiniKit.sendTransaction + useUserOperationReceipt polling pattern for on-chain approval"
    - "Full-screen overlay state machine (pending/success/error) for transaction UX"

key-files:
  created:
    - apps/web/src/lib/contracts.ts
    - apps/web/src/components/ApprovalOverlay/index.tsx
  modified:
    - apps/web/src/app/onboarding/page.tsx

key-decisions:
  - "ApprovalOverlay runs approval on mount via useEffect — no manual trigger needed after setShowApproval(true)"
  - "Budget amount in USDC units: BigInt(budgetUsd) * BigInt(1_000_000) — exact allowance, no infinite approval"
  - "Try Again resets state to pending and re-runs the approval flow via useCallback-wrapped runApproval"
  - "useUserOperationReceipt poll hook initialized at component top level (React hook rules), not inside useEffect"

patterns-established:
  - "Pattern: On-chain gate before save+redirect — approval must confirm before profile data is written to backend"

requirements-completed: [FOPS-04, FOPS-06]

# Metrics
duration: 3min
completed: 2026-04-05
---

# Phase 10 Plan 01: Onboarding Allowance Summary

**USDC.approve(GenieRouter, budget*1e6) wired into onboarding StepBudget via MiniKit wallet signing with full-screen pending/success/error overlay**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-05T03:27:14Z
- **Completed:** 2026-04-05T03:30:02Z
- **Tasks:** 3 (2 auto + 1 checkpoint auto-approved)
- **Files modified:** 3

## Accomplishments
- Created `contracts.ts` with ERC20 approve ABI and USDC/GenieRouter address constants sourced from NEXT_PUBLIC_ env vars
- Built `ApprovalOverlay` component that triggers MiniKit wallet signing on mount, polls for tx confirmation, and shows pending/success/error states
- Wired onboarding page so "Let's Go" shows ApprovalOverlay before saving profile and redirecting to /home — approval is a mandatory gate
- Build compiles cleanly with `/onboarding` page included in output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create contracts constants and ApprovalOverlay component** - `cdf3518` (feat)
2. **Task 2: Wire ApprovalOverlay into onboarding page** - `8219635` (feat)
3. **Task 3: Verify USDC approval flow in onboarding** - auto-approved (checkpoint:human-verify, AUTO_CFG=true, build passed)

## Files Created/Modified
- `apps/web/src/lib/contracts.ts` - ERC20_APPROVE_ABI, USDC_ADDRESS, GENIE_ROUTER_ADDRESS constants
- `apps/web/src/components/ApprovalOverlay/index.tsx` - Full-screen overlay component with 3-state machine
- `apps/web/src/app/onboarding/page.tsx` - Imports ApprovalOverlay, adds showApproval state, gates "Let's Go" behind approval

## Decisions Made
- `useUserOperationReceipt` initialized at component top level per React hook rules; `runApproval` wrapped in `useCallback` and called from `useEffect` on mount
- Approval amount is exact: `BigInt(budgetUsd) * BigInt(1_000_000)` — no infinite approval per D-03
- "Try Again" resets to pending and re-executes the same flow without remounting

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `.env.local` is gitignored and doesn't exist in the worktree — added env vars to `/Users/kerem/genie/apps/web/.env.local` (main repo's actual env file) which is where the Next.js build reads them from.

## User Setup Required
None - env vars already added to `apps/web/.env.local`.

## Next Phase Readiness
- USDC.approve flow is live in onboarding
- GenieRouter can now pull USDC from wallets that have completed onboarding
- FOPS-04 (auto-approve threshold) and FOPS-06 (GenieRouter transfers) are now unblocked on-chain

---
*Phase: 10-onboarding-allowance*
*Completed: 2026-04-05*

## Self-Check: PASSED

- FOUND: apps/web/src/lib/contracts.ts
- FOUND: apps/web/src/components/ApprovalOverlay/index.tsx
- FOUND: apps/web/src/app/onboarding/page.tsx
- FOUND: .planning/phases/10-onboarding-allowance/10-01-SUMMARY.md
- FOUND: commit cdf3518 (feat: contracts + ApprovalOverlay)
- FOUND: commit 8219635 (feat: wire ApprovalOverlay into onboarding)
- Build: PASSED (npx turbo build --filter=@worldcoin/next-15-template, Tasks: 1 successful)
