---
phase: 12-send-crosschain
plan: 01
subsystem: api
tags: [hono, viem, cctp, usdc, bridge, world-chain, cross-chain, vitest]

# Dependency graph
requires:
  - phase: 04-financial-ops
    provides: executeOnChainTransfer, GenieRouterAbi, chain/clients pattern
  - phase: 05-cross-chain-social
    provides: settle_crosschain_debt with inline CCTP logic to extract
  - phase: 11-live-balance
    provides: balance route pattern for Hono routes

provides:
  - POST /api/send endpoint handling World Chain and cross-chain USDC sends
  - bridgeUsdc shared CCTP utility in chain/bridge.ts
  - CCTP_DOMAIN_IDS export (ethereum=0, optimism=2, arbitrum=3, base=6)
  - settle_crosschain_debt refactored to use bridgeUsdc

affects: [13-recent-transactions, 14-chat-polish, send-frontend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Chain-normalized sends: CHAIN_MAP maps display names to CCTP keys (null=World Chain)
    - Shared bridge utility: CCTP logic extracted from tools into chain/ layer
    - Same route for auto-execute and confirmation_required based on autoApproveUsd threshold

key-files:
  created:
    - apps/api/src/chain/bridge.ts
    - apps/api/src/chain/bridge.test.ts
    - apps/api/src/routes/send.ts
    - apps/api/src/routes/send.test.ts
  modified:
    - apps/api/src/index.ts
    - apps/api/src/tools/settle-crosschain-debt.ts

key-decisions:
  - "bridgeUsdc validates destinationChain against CCTP_DOMAIN_IDS at entry, throws Unknown destination chain error"
  - "CHAIN_MAP in send route maps frontend display names (World Chain, Base) to backend keys (null, base)"
  - "settle_crosschain_debt enum restricted to 4 CCTP-supported chains: base, ethereum, optimism, arbitrum"

patterns-established:
  - "Chain layer (chain/*.ts) owns on-chain utilities; routes import from chain layer"
  - "Send route mirrors send_usdc tool logic for threshold-based auto-execute vs confirmation"

requirements-completed: [FOPS-02, FOPS-03, FOPS-04, FOPS-05, XCHD-01]

# Metrics
duration: 15min
completed: 2026-04-05
---

# Phase 12 Plan 01: Send Crosschain Backend Summary

**CCTP bridgeUsdc utility extracted from settle_crosschain_debt, POST /api/send endpoint built supporting World Chain auto-execute, confirmation-required, and cross-chain CCTP bridge paths**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-05T06:28:00Z
- **Completed:** 2026-04-05T06:32:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Extracted inline CCTP depositForBurn logic from settle-crosschain-debt.ts into shared `bridgeUsdc` utility
- Built POST /api/send Hono route with full validation, verification gate, and 3 execution paths
- Mounted /api/send in index.ts after /api/balance
- Refactored settle_crosschain_debt to delegate to bridgeUsdc, removing ~50 lines of inline CCTP code
- 9 unit tests (3 bridge + 6 send route), all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract bridgeUsdc utility and create send route with tests** - `843f760` (feat)
2. **Task 2: Mount send route and refactor settle_crosschain_debt** - `42864ec` (feat)

## Files Created/Modified
- `apps/api/src/chain/bridge.ts` - Shared bridgeUsdc CCTP utility with CCTP_DOMAIN_IDS export
- `apps/api/src/chain/bridge.test.ts` - 3 unit tests for bridgeUsdc (writeContract calls, error on unknown chain, domain IDs)
- `apps/api/src/routes/send.ts` - POST /api/send handler (World Chain + cross-chain, threshold logic, verification gate)
- `apps/api/src/routes/send.test.ts` - 6 unit tests for send route (all execution paths + validation + auth)
- `apps/api/src/index.ts` - Added sendRoute import and app.route('/api/send', sendRoute)
- `apps/api/src/tools/settle-crosschain-debt.ts` - Replaced 3-step inline CCTP with bridgeUsdc(), restricted chain enum to 4 chains

## Decisions Made
- CHAIN_MAP in send route normalizes display names (World Chain, Base) to backend CCTP keys — frontend sends display name, backend normalizes
- settle_crosschain_debt enum restricted from 8 chains to 4 (ethereum, optimism, arbitrum, base) — only CCTP-supported chains
- bridgeUsdc validates destinationChain at entry and throws Error to prevent silent failures

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed invalid hex address in send.test.ts**
- **Found during:** Task 1 (GREEN phase)
- **Issue:** VALID_RECIPIENT used `0xRecipient...` which contains non-hex characters, causing viem `isAddress()` to reject it, causing all user-lookup tests to fail with 400 instead of proceeding
- **Fix:** Changed VALID_RECIPIENT to `0x1234567890123456789012345678901234567890` (valid Ethereum address)
- **Files modified:** apps/api/src/routes/send.test.ts
- **Verification:** Tests 1-3 and 5 now return expected status codes
- **Committed in:** 843f760 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed DB mock missing .returning() chain**
- **Found during:** Task 1 (GREEN phase - Test 2 for over-threshold path)
- **Issue:** `db.insert().values()` mock returned a Promise directly but the route calls `.returning()` on the result for pending tx; mock didn't support this chain
- **Fix:** Updated DB insert mock to return an object with both `then` (for resolved Promise behavior) and `returning` (for the returning chain)
- **Files modified:** apps/api/src/routes/send.test.ts
- **Verification:** Test 2 (confirmation_required) now passes
- **Committed in:** 843f760 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs in test mocks)
**Impact on plan:** Both fixes in test infrastructure, no production code changes. Plan executed exactly as specified.

## Issues Encountered
- Pre-existing test failures in the full test suite (balance, confirm, users, verify routes) — these were present before this plan and are out of scope. New tests (bridge + send) all pass cleanly in isolation.

## Next Phase Readiness
- POST /api/send is live and handles all three paths: World Chain auto-execute, confirmation-required, and cross-chain bridge
- SendModal frontend (Plan 02) can call /api/send with userId, recipient, amount, chain fields
- settle_crosschain_debt uses shared bridge infrastructure consistent with direct send

## Self-Check: PASSED

All files confirmed present. All commits confirmed in git log.

---
*Phase: 12-send-crosschain*
*Completed: 2026-04-05*
