---
phase: 05
slug: cross-chain-social
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
updated: 2026-04-04
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | apps/api/vitest.config.ts |
| **Quick run command** | `cd apps/api && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/api && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/api && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Test File | Status |
|---------|------|------|-------------|-----------|-----------|--------|
| 05-01-01 | 01 | 1 | SPND-01 | unit | `categorize.test.ts` (23 tests) | ✅ green |
| 05-01-02 | 01 | 1 | SPND-01 | unit | `send-usdc.test.ts` (3 new tests) | ✅ green |
| 05-01-03 | 01 | 1 | SPND-01 | unit | `schema.test.ts` (4 new col tests) | ✅ green |
| 05-02-01 | 02 | 2 | DEBT-01 | unit | `create-debt.test.ts` (5 tests) | ✅ green |
| 05-02-02 | 02 | 2 | DEBT-01 | unit | `list-debts.test.ts` (4 tests) | ✅ green |
| 05-02-03 | 02 | 2 | SPND-02 | unit | `get-spending.test.ts` (5 tests) | ✅ green |
| 05-03-01 | 03 | 3 | DEBT-02 | unit | `settlement.test.ts` (13 tests) | ✅ green |
| 05-03-02 | 03 | 3 | DEBT-02 | integration | `chat.test.ts` (tool registration) | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement Coverage Summary

| Requirement | Tests | Coverage |
|-------------|-------|----------|
| SPND-01 | 30 tests (categorize: 23, send-usdc: 3, schema: 4) | COVERED |
| SPND-02 | 5 tests (get-spending) | COVERED |
| DEBT-01 | 9 tests (create-debt: 5, list-debts: 4) | COVERED |
| DEBT-02 | 13 tests (settlement) | COVERED |
| XCHD-01 | N/A — formally deferred | N/A |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| AI-inferred category from conversation context | SPND-01 | Requires LLM inference | Send "send $30 to Alice for dinner" and verify category is "food" |
| Natural language time range parsing | SPND-02 | Requires LLM date extraction | Ask "how much did I spend this week?" and verify date range |
| Settlement notification at conversation start | DEBT-02 | Requires agent context injection | Create debt, simulate incoming transfer, start new chat |

---

## Validation Sign-Off

- [x] All tasks have automated verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] All requirement references have test coverage
- [x] No watch-mode flags
- [x] Feedback latency < 10s (actual: ~1s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** passed

---

## Validation Audit 2026-04-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Suite results:** 155 tests passing across 19 test files. All Phase 5 requirements have automated coverage.
