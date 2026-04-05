---
phase: 14
slug: chat-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-05
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | apps/api/vitest.config.ts |
| **Quick run command** | `cd apps/api && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd apps/api && npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/api && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd apps/api && npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | MAPP-03 | integration | `grep 'contact_list' apps/api/src/prompts/system.md` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | MAPP-04 | unit | `grep 'handleSaveLimit' apps/web/src/components/ProfileInterface/index.tsx` | ✅ | ⬜ pending |
| 14-01-03 | 01 | 1 | AGEN-04 | manual | Agent tool outputs render as markdown | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tool results render in chat | AGEN-04 | Requires running frontend + backend together | Send "what's my balance?" in chat, verify response renders as markdown |
| Streaming works e2e | MAPP-03 | Requires live agent connection | Send message, verify token-by-token streaming appears |
| Contact disambiguation UI | MAPP-04 | Requires agent to trigger contact_list output | Ask to send to ambiguous name, verify ContactCard renders |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
