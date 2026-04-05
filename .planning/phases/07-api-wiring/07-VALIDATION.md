---
phase: 7
slug: api-wiring
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
---

# Phase 7 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (apps/api) + next build (apps/web) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run src/routes/users.test.ts` |
| **Full suite command** | `cd apps/api && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run`
- **After every plan wave:** Run `cd apps/api && npx vitest run` + `cd apps/web && npx tsc --noEmit` (fast type check) or `cd apps/web && npx next build` (full build)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | AGEN-04 | unit | `cd apps/api && npx vitest run src/routes/users.test.ts` | ✅ | ✅ green |
| 07-01-02 | 01 | 1 | AGEN-05 | unit | `cd apps/api && npx vitest run src/routes/users.test.ts` | ✅ | ✅ green |
| 07-01-03 | 01 | 1 | AGEN-07 | unit | `cd apps/api && npx vitest run src/kv/memory.test.ts` | ✅ | ✅ green |
| 07-02-01 | 02 | 2 | MAPP-03 | manual | Start servers, send chat message | N/A | ⬜ manual-only |
| 07-02-02 | 02 | 2 | FOPS-01 | unit | `cd apps/api && npx vitest run src/routes/users.test.ts` | ✅ | ✅ green |
| 07-02-03 | 02 | 2 | FOPS-02 | existing | `cd apps/api && npx vitest run src/tools/send-usdc.test.ts` | ✅ | ✅ green |
| 07-02-04 | 02 | 2 | FOPS-03 | existing | `cd apps/api && npx vitest run src/tools/resolve-contact.test.ts` | ✅ | ✅ green |
| 07-02-05 | 02 | 2 | FOPS-04 | existing | `cd apps/api && npx vitest run src/routes/chat.test.ts` | ✅ | ✅ green |
| 07-02-06 | 02 | 2 | SPND-02 | existing | `cd apps/api && npx vitest run src/tools/get-spending.test.ts` | ✅ | ✅ green |
| 07-02-07 | 02 | 2 | DEBT-01 | existing | `cd apps/api && npx vitest run src/tools/create-debt.test.ts` | ✅ | ✅ green |
| 07-02-08 | 02 | 2 | DEBT-02 | existing | `cd apps/api && npx vitest run src/tools/list-debts.test.ts` | ✅ | ✅ green |
| 07-02-09 | 02 | 2 | MAPP-04 | existing | `cd apps/api && npx vitest run src/tools/add-contact.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/api/src/routes/users.test.ts` -- provision endpoint: idempotent create, idempotent get, invalid wallet rejection, response shape (14 tests)
- [x] `apps/api/src/kv/memory.test.ts` -- file exists with graceful-fallback and round-trip tests

*All Wave 0 requirements satisfied.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full E2E streaming chat | MAPP-03 | Requires live 0G Compute adapter + SSE through browser | Start both servers, send chat message from World App simulator, verify streamed response |
| Onboarding redirect flow | D-15 | Requires MiniKit environment + live session | Sign in with new wallet, verify redirect to /onboarding, complete steps, verify redirect to /home |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved

## Validation Audit 2026-04-05
| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |
