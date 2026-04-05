---
phase: 12
slug: send-crosschain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (latest) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @genie/api test -- --reporter=verbose --testPathPattern=routes/send` |
| **Full suite command** | `pnpm --filter @genie/api test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @genie/api test -- --reporter=verbose --testPathPattern=routes/send`
- **After every plan wave:** Run `pnpm --filter @genie/api test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | FOPS-02 | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | ❌ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | FOPS-03 | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | ❌ W0 | ⬜ pending |
| 12-01-03 | 01 | 1 | FOPS-04 | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | ❌ W0 | ⬜ pending |
| 12-01-04 | 01 | 1 | FOPS-05 | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | ❌ W0 | ⬜ pending |
| 12-01-05 | 01 | 1 | XCHD-01 | unit | `pnpm --filter @genie/api test -- --testPathPattern=chain/bridge` | ❌ W0 | ⬜ pending |
| 12-02-01 | 02 | 2 | D-09 | manual | Open app, trigger over-threshold send | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | D-11/D-12 | unit | `pnpm --filter @genie/api test -- --testPathPattern=chain/bridge` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/routes/send.test.ts` — stubs for FOPS-02, FOPS-03, FOPS-04, FOPS-05, XCHD-01
- [ ] `apps/api/src/chain/bridge.test.ts` — stubs for D-11/D-12 (bridgeUsdc utility)

*Existing test infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ConfirmCard URL fix | D-09 | Visual smoke test | Open app, trigger over-threshold send via chat, verify confirm button works |
| SendModal chain selector | XCHD-01 | Frontend interaction | Open SendModal, select different chains, verify correct routing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
