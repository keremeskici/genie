---
phase: 15
slug: wallet-tab
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing) |
| **Config file** | `apps/web/vitest.config.ts` / `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm -F @genie/web test --run` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm -F @genie/web test --run`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | WRID-01 | manual | Visual: Verify component renders on wallet tab | N/A | ⬜ pending |
| 15-01-02 | 01 | 1 | WRID-02, WRID-03 | manual | Visual: Balance displays, transactions list renders | N/A | ⬜ pending |
| 15-01-03 | 01 | 1 | WRID-04 | integration | `grep -q "userId" apps/api/src/routes/users.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verify component renders and hides after verification | WRID-01 | Requires MiniKit environment | Open wallet tab → see Verify button → verify → button disappears |
| Balance displays on wallet tab | WRID-03 | Requires running API + blockchain | Open wallet tab → see live USDC balance |
| Transactions display on wallet tab | WRID-03 | Requires DB with transactions | Open wallet tab → see transaction list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
