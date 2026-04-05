---
phase: 4
slug: financial-ops
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
validated: 2026-04-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (apps/api), Forge (apps/contracts) |
| **Config file** | `apps/api/vitest.config.ts`, `apps/contracts/foundry.toml` |
| **Quick run command** | `cd apps/api && pnpm test` |
| **Full suite command** | `cd apps/api && pnpm test && cd ../contracts && forge test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && pnpm test`
- **After every plan wave:** Run `cd apps/api && pnpm test && cd ../contracts && forge test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | FOPS-06 | solidity unit | `cd apps/contracts && forge test` | ✅ | ✅ green |
| 04-02-01 | 02 | 1 | FOPS-01 | unit (mocked viem) | `pnpm test -- get-balance` | ✅ | ✅ green |
| 04-02-02 | 02 | 1 | FOPS-03 | unit | `pnpm test -- resolve-contact` | ✅ | ✅ green |
| 04-02-03 | 02 | 2 | FOPS-02, FOPS-04 | unit | `pnpm test -- send-usdc` | ✅ | ✅ green |
| 04-02-04 | 02 | 2 | FOPS-05 | unit | `pnpm test -- confirm` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/api/src/tools/send-usdc.test.ts` — covers FOPS-02, FOPS-04 (threshold logic)
- [x] `apps/api/src/tools/resolve-contact.test.ts` — covers FOPS-03 (three-path resolution)
- [x] `apps/api/src/routes/confirm.test.ts` — covers FOPS-05 (confirmation + expiry paths)
- [x] `apps/contracts/test/GenieRouter.t.sol` — covers FOPS-06 (4 tests: constructor, route, non-owner revert, insufficient allowance)
- [x] `apps/contracts/test/PayHandler.t.sol` — covers FOPS-06 (4 tests: constructor, execute, non-owner revert, insufficient balance)
- [x] `apps/api/src/tools/get-balance.test.ts` — covers FOPS-01 (real shape assertions, mocked viem)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GenieRouter + PayHandler deploy to World Chain Sepolia | FOPS-06 | Requires live testnet | Run `forge script Deploy --rpc-url $WORLD_CHAIN_RPC_URL --broadcast` and verify on WorldScan |
| USDC balance reads from live chain | FOPS-01 | E2E requires funded wallet | Call `get_balance` tool with a known address, verify matches WorldScan |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

---

## Validation Audit 2026-04-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Test Results:**
- Vitest: 155/155 tests pass (19 test files)
- Forge: 8/8 tests pass (2 test suites)
- All 6 FOPS requirements have automated coverage
