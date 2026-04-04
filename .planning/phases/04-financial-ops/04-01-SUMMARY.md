---
phase: 04-financial-ops
plan: 01
subsystem: payments
tags: [solidity, foundry, viem, smart-contracts, usdc, world-chain, drizzle, schema]

# Dependency graph
requires:
  - phase: 03-identity
    provides: UserContext with isVerified/isHumanBacked, requireVerified guard
  - phase: 02-data-layer
    provides: transactions table schema in apps/db/src/schema.ts
provides:
  - GenieRouter Solidity contract with route(sender, amount, handler) function
  - PayHandler Solidity contract with execute(recipient, amount) function
  - Foundry project scaffolding at apps/contracts with OZ dependencies
  - Deploy script for GenieRouter + PayHandler on World Chain
  - viem publicClient and getWalletClient() singletons for World Chain
  - USDC_ADDRESS, GENIE_ROUTER_ADDRESS, PAY_HANDLER_ADDRESS constants
  - Typed ABI constants (GenieRouterAbi, PayHandlerAbi) with as const
  - transactions table updated with status (default 'confirmed') and expiresAt columns
affects: [04-02, 04-03, 05-cross-chain]

# Tech tracking
tech-stack:
  added: [viem@2.x, foundry/forge, openzeppelin-contracts, forge-std, SafeERC20]
  patterns: [lazy wallet client initialization, typed ABI constants, Solidity relayer pattern with owner-only access]

key-files:
  created:
    - apps/contracts/src/GenieRouter.sol
    - apps/contracts/src/PayHandler.sol
    - apps/contracts/test/GenieRouter.t.sol
    - apps/contracts/test/PayHandler.t.sol
    - apps/contracts/test/MockUSDC.sol
    - apps/contracts/script/Deploy.s.sol
    - apps/contracts/foundry.toml
    - apps/contracts/remappings.txt
    - apps/api/src/chain/clients.ts
    - apps/api/src/contracts/abis.ts
  modified:
    - apps/db/src/schema.ts
    - apps/api/package.json
    - apps/api/vitest.config.ts
    - pnpm-lock.yaml

key-decisions:
  - "SafeERC20 used over raw IERC20.transfer/transferFrom — eliminates unchecked return value warnings and is more secure"
  - "Lazy wallet client init in getWalletClient() prevents crash when RELAYER_PRIVATE_KEY not set at import time (test environments)"
  - "status column defaults to 'confirmed' for backward compatibility — existing rows and direct on-chain sends are auto-confirmed"
  - "Contract addresses use zero-address defaults with env var override — graceful until deployment provides real addresses"
  - "ABIs defined manually as const (not from forge JSON output) — simpler, fully typed, no build-time file reading needed"

patterns-established:
  - "Foundry relayer pattern: contracts have owner (relayer) address set in constructor, all mutating functions require msg.sender == owner"
  - "viem client pattern: eager publicClient + lazy walletClient with private key loaded on first use"
  - "ABI constants pattern: typed as const arrays in abis.ts, imported by tools and routes for type-safe contract calls"

requirements-completed: [FOPS-06]

# Metrics
duration: 4min
completed: 2026-04-04
---

# Phase 4 Plan 01: Financial Ops Foundation Summary

**Foundry smart contracts (GenieRouter + PayHandler with SafeERC20), World Chain viem clients, and transactions schema migration with pending-status support**

## Performance

- **Duration:** 4 min
- **Started:** 2026-04-04T14:21:23Z
- **Completed:** 2026-04-04T14:25:15Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- GenieRouter and PayHandler Solidity contracts compiled and 8 Foundry tests pass (4 each)
- viem client singletons configured for World Chain with lazy wallet initialization to prevent test crashes
- transactions table schema updated with status (text, default 'confirmed') and expiresAt (timestamp, nullable) columns
- Typed ABI constants exported for full viem type inference in Phase 4 tools

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration + Foundry contracts with tests** - `60046f3` (feat)
2. **Task 2: viem clients + ABI exports + install viem dependency** - `38b12fd` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/contracts/src/GenieRouter.sol` - Routes USDC via safeTransferFrom from sender to handler, owner-only access
- `apps/contracts/src/PayHandler.sol` - Transfers USDC from handler to recipient via safeTransfer, owner-only access
- `apps/contracts/test/GenieRouter.t.sol` - 4 Foundry tests: constructor, successful route, non-owner revert, insufficient allowance revert
- `apps/contracts/test/PayHandler.t.sol` - 4 Foundry tests: constructor, successful execute, non-owner revert, insufficient balance revert
- `apps/contracts/test/MockUSDC.sol` - 6-decimal ERC20 mock for testing
- `apps/contracts/script/Deploy.s.sol` - Deployment script reading RELAYER_PRIVATE_KEY and USDC_ADDRESS from env
- `apps/contracts/foundry.toml` - Solc 0.8.20 with optimizer enabled (200 runs)
- `apps/contracts/remappings.txt` - OpenZeppelin import remapping
- `apps/api/src/chain/clients.ts` - publicClient (eager) + getWalletClient() (lazy) for World Chain, USDC/contract addresses
- `apps/api/src/contracts/abis.ts` - Typed ABI constants for GenieRouter and PayHandler
- `apps/db/src/schema.ts` - Added status and expiresAt columns to transactions table
- `apps/api/package.json` - Added viem 2.x dependency
- `apps/api/vitest.config.ts` - Added test env vars for chain clients

## Decisions Made
- Used SafeERC20 instead of raw IERC20 transfer calls — eliminates unchecked return value warnings and prevents silent failure if token returns false
- Lazy wallet client initialization in `getWalletClient()` prevents module-import crash when `RELAYER_PRIVATE_KEY` is not set (common in test environments)
- transactions.status defaults to 'confirmed' for backward compatibility — auto-approved transfers and existing records don't need status set
- Contract addresses loaded from env with zero-address fallback — no crash during development before deployment

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added SafeERC20 for safe token transfers**
- **Found during:** Task 1 (Foundry contracts)
- **Issue:** Plan used raw IERC20.transfer/transferFrom which don't check return values — forge build warned about this, and USDC-like tokens can return false instead of reverting
- **Fix:** Added SafeERC20 import and use safeTransfer/safeTransferFrom in both contracts
- **Files modified:** apps/contracts/src/GenieRouter.sol, apps/contracts/src/PayHandler.sol
- **Verification:** forge test passes, no unchecked transfer warnings
- **Committed in:** 60046f3 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — security)
**Impact on plan:** SafeERC20 is a security best practice for ERC20 transfers. No scope creep.

## Issues Encountered
- Worktree branch was missing the phase plan files (committed in main but not yet in worktree) — merged main into worktree before execution

## User Setup Required
None - no external service configuration required. Contract deployment (POST to World Chain) is a Phase 4 plan 03 step.

## Next Phase Readiness
- Contracts ready to deploy with `forge script script/Deploy.s.sol` once `RELAYER_PRIVATE_KEY` and `USDC_ADDRESS` are set
- viem clients ready for plan 02 tools (get_balance, resolve_contact, send_usdc)
- ABI constants ready for type-safe contract calls in plan 02
- transactions schema updated and ready for plan 02 to create pending transactions
- Plans 02 and 03 can proceed immediately

---
*Phase: 04-financial-ops*
*Completed: 2026-04-04*
