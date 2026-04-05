---
phase: 6
slug: mini-app-shell
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no test framework in apps/web — see rationale below) |
| **Config file** | N/A |
| **Quick run command** | `cd apps/web && npx next build` |
| **Full suite command** | `cd apps/web && npx next build` |
| **Estimated runtime** | ~30 seconds |

**Rationale:** RESEARCH.md confirms no test framework (jest/vitest) is configured in `apps/web`. All phase requirements are UI/UX behaviors inside World App's WebView environment that depend on MiniKit bridge, streaming SSE, and visual rendering. Given the 36-hour hackathon constraint, `next build` (TypeScript compilation + static analysis) is the automated gate, supplemented by manual smoke testing in World App simulator. Adding vitest + React Testing Library + MiniKit mocks would cost significant setup time with low confidence return for this phase's integration-heavy work.

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx next build`
- **After every plan wave:** Run `cd apps/web && npx next build`
- **Before `/gsd:verify-work`:** Build must pass + manual smoke test in World App
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 06-01-01 | 01 | 1 | MAPP-01 | build | `cd apps/web && npx next build` | pending |
| 06-01-02 | 01 | 1 | MAPP-02, MAPP-03 | build | `cd apps/web && npx next build` | pending |
| 06-02-01 | 02 | 2 | MAPP-04 | build | `cd apps/web && npx next build` | pending |
| 06-02-02 | 02 | 2 | MAPP-01 | build | `cd apps/web && npx next build` | pending |
| 06-03-01 | 03 | 2 | MAPP-01 | build | `cd apps/web && npx next build` | pending |
| 06-03-02 | 03 | 2 | MAPP-01 | build | `cd apps/web && npx next build` | pending |

*Status: pending | green | red | flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No test framework setup needed — `next build` provides TypeScript type-checking and static analysis as the automated gate.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming tokens appear progressively in chat bubble | MAPP-03 | Requires live SSE connection to backend | Start both servers, send a message, observe token-by-token rendering |
| App loads inside World App | MAPP-01 | Requires World App simulator or device | Open app in World App dev browser, verify no console errors |
| MiniKit Pay flow opens native payment sheet | MAPP-01 | Requires World App payment simulation | Trigger a send via chat, verify MiniKit.pay fires |
| MiniKit haptics fire on send | MAPP-01 | Requires physical device | Send a message in World App, feel haptic feedback |
| Contact cards render for disambiguation | MAPP-04 | Requires agent returning contact_list JSON | Ask agent "send to [ambiguous name]", verify cards appear |
| Permission request dialog appears | MAPP-01 | Requires World App environment | Send first message, verify permission dialog fires |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands (`npx next build`)
- [x] Sampling continuity: every task runs build check
- [x] Wave 0 not needed — no test framework, build is the gate
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
