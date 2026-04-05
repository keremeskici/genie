---
phase: 11
slug: live-balance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @genie/api test -- balance` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @genie/api test -- balance`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | FOPS-01 | unit | `pnpm --filter @genie/api test -- balance` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | FOPS-01 | unit | `pnpm --filter @genie/api test -- balance` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | FOPS-01 | manual smoke | n/a — visual in World App | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/routes/balance.test.ts` — stubs for FOPS-01 backend (mock readContract, test 200 and 400 paths)

*Existing vitest infrastructure covers framework needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| DashboardInterface renders live balance | FOPS-01 | Visual UI in World App | Load /home, verify balance shows real USDC amount (not $0.00) |
| Skeleton shown during fetch | FOPS-01 | Visual animation | Load /home with slow network, verify skeleton appears |
| $--.-- shown on fetch failure | FOPS-01 | Visual fallback | Block API endpoint, verify fallback renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
