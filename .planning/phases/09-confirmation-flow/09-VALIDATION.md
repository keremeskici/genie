---
phase: 9
slug: confirmation-flow
status: audited
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-05
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/api) |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `cd apps/api && npx vitest run src/routes/confirm.test.ts` |
| **Full suite command** | `cd apps/api && npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run src/routes/confirm.test.ts`
- **After every plan wave:** Run `cd apps/api && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual confirmation flow smoke test
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | FOPS-05 | manual | Manual smoke test — send over-threshold transfer, verify ConfirmCard renders | ❌ no web test infra | ⚠️ manual-only |
| 09-01-02 | 01 | 1 | FOPS-05 | unit | `cd apps/api && npx vitest run src/routes/confirm.test.ts` | ✅ existing | ✅ green (8/8) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No new test framework installation needed.

- `apps/api/src/routes/confirm.test.ts` already covers backend contract
- Frontend: No automated test infra for React components — accepted for hackathon scope

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ConfirmCard renders from JSON block | FOPS-05 | No React test infra in apps/web | 1. Send over-threshold transfer in chat 2. Verify ConfirmCard appears with amount, recipient, countdown 3. Click Confirm 4. Verify card updates to "Sent $X USDC ✓" |
| Countdown timer expires | FOPS-05 | Timer behavior requires visual verification | 1. Wait for countdown to reach 0 2. Verify card shows "Expired" state with buttons removed |
| Cancel flow | FOPS-05 | Local-only UI state change | 1. Click Cancel on ConfirmCard 2. Verify card shows "Cancelled" with buttons removed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-05

---

## Validation Audit 2026-04-05

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

**Notes:**
- Backend confirm route: 8/8 vitest tests passing (400/404/409/410/200/500 coverage)
- Frontend ConfirmCard: Manual-only — no React test infra in apps/web (accepted for hackathon scope)
- All automated tests verified green at audit time
