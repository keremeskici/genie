---
phase: 1
slug: agent-infra
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (latest) |
| **Config file** | `apps/api/vitest.config.ts` — Wave 0 gap |
| **Quick run command** | `pnpm --filter @genie/api test` |
| **Full suite command** | `pnpm --filter @genie/api test --run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @genie/api test`
- **After every plan wave:** Run `pnpm --filter @genie/api test --run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | AGEN-01 | unit | `vitest run src/agent/providers.test.ts` | ✓ | ✅ green |
| 01-02-01 | 02 | 2 | AGEN-02 | unit | `vitest run src/agent/classifier.test.ts` | ✓ | ✅ green |
| 01-02-02 | 02 | 2 | AGEN-03 | unit | `vitest run src/agent/classifier.test.ts` | ✓ | ✅ green |
| 01-02-03 | 02 | 2 | AGEN-04 | unit | `vitest run src/tools/get-balance.test.ts` | ✓ | ✅ green |
| 01-01-02 | 01 | 1 | AGEN-05 | unit | `vitest run src/agent/context.test.ts` | ✓ | ✅ green |
| 01-01-03 | 01 | 1 | AGEN-06 | unit | `vitest run src/agent/window.test.ts` | ✓ | ✅ green |
| 01-02-04 | 02 | 2 | AGEN-04 | unit | `vitest run src/agent/index.test.ts` | ✓ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/api/vitest.config.ts` — Vitest config for the api package
- [x] `apps/api/src/agent/providers.test.ts` — AGEN-01 provider initialization
- [x] `apps/api/src/agent/classifier.test.ts` — AGEN-02, AGEN-03 routing logic
- [x] `apps/api/src/tools/get-balance.test.ts` — AGEN-04 stub tool
- [x] `apps/api/src/agent/context.test.ts` — AGEN-05 three-layer assembly
- [x] `apps/api/src/agent/window.test.ts` — AGEN-06 sliding window + sticky messages
- [x] `apps/api/src/agent/index.test.ts` — Agent orchestrator wiring (runAgent)
- [x] `apps/api/package.json` with test script — required for Turborepo pipeline

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streamed response via 0G Compute | AGEN-01 | Requires live 0G API key and running adapter | `curl -X POST http://localhost:3001/chat -d '{"messages":[{"role":"user","content":"hello"}]}'` — verify chunked response |
| Dual-model routing observable | AGEN-02, AGEN-03 | Requires live inference to verify model selection | Send advisory prompt + tool prompt, check server logs for model ID in request |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ✓ validated

## Validation Audit 2026-04-04

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

All 7 requirements have automated tests. Full suite: 136 tests, 18 files, all green (941ms).
