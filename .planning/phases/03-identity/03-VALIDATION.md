---
phase: 03
slug: identity
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
audited: 2026-04-04
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | apps/api/vitest.config.ts |
| **Quick run command** | `cd apps/api && npx vitest run` |
| **Full suite command** | `cd apps/api && npx vitest run` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run`
- **After every plan wave:** Run `cd apps/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | WRID-01, WRID-02 | unit | `cd apps/api && npx vitest run src/routes/verify.test.ts` | ✅ | ✅ green |
| 03-01-02 | 01 | 1 | WRID-03, WRID-04, WRID-09 | unit | `cd apps/api && npx vitest run src/agent/context.test.ts` | ✅ | ✅ green |
| 03-02-01 | 02 | 2 | WRID-02, WRID-03, WRID-04 | unit | `cd apps/api && npx vitest run src/tools/require-verified.test.ts` | ✅ | ✅ green |
| 03-02-02 | 02 | 2 | WRID-05 | unit | `cd apps/api && npx vitest run src/agent/index.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Requirement Coverage

| Requirement | Description | Test Files | Status |
|-------------|-------------|------------|--------|
| WRID-01 | World ID IDKit widget verify | `verify.test.ts` (6 tests) | ✅ COVERED (server) + Manual (client IDKit) |
| WRID-02 | Server validates proofs before gated actions | `verify.test.ts` (portal call, rejection, success, URL check) | ✅ COVERED |
| WRID-03 | Unverified users can chat, view balance, receive | `context.test.ts` (verified=false injection), `require-verified.test.ts` (guard) | ✅ COVERED |
| WRID-04 | Verified users unlock send, debt, automation | `context.test.ts` (verified=true injection), `require-verified.test.ts` (null return) | ✅ COVERED |
| WRID-05 | Agent Kit classifies verified as human-backed | `context.test.ts` (humanBacked=true/false), `index.test.ts` (stub context) | ✅ COVERED |

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| IDKit widget opens in World App | WRID-01 | Requires World App runtime environment | Open Mini App, tap verify, confirm IDKit widget appears |
| Live World ID Cloud API verification | WRID-02 | Requires real World ID credentials and app_id | Set WORLD_APP_ID env, submit real proof, check DB for nullifier |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-04

---

## Validation Audit 2026-04-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Test suite:** 155 tests across 19 files — all passing
**Phase 03 tests:** 28 tests across 4 files (verify: 6, context: 12, require-verified: 3, index: 7)
