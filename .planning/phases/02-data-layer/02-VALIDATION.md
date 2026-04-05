---
phase: 02
slug: data-layer
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-04
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 |
| **Config file** | apps/api/vitest.config.ts |
| **Quick run command** | `pnpm --filter @genie/api test` |
| **Full suite command** | `pnpm --filter @genie/api test` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @genie/api test`
- **After every plan wave:** Run `pnpm --filter @genie/api test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 1 second

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AGEN-07 | unit | `pnpm --filter @genie/api test` | ✅ db/schema.test.ts | ✅ green |
| 02-01-02 | 01 | 1 | AGEN-07 | type-check | `npx tsc --noEmit --project apps/api/tsconfig.json` | ✅ client.ts, index.ts, drizzle.config.ts | ✅ green |
| 02-02-01 | 02 | 1 | AGEN-07 | unit | `pnpm --filter @genie/api test` | ✅ kv/memory.test.ts | ✅ green |
| 02-02-02 | 02 | 1 | AGEN-07 | unit | `pnpm --filter @genie/api test` | ✅ kv/memory.test.ts (extended) | ✅ green |
| 02-03-01 | 03 | 2 | AGEN-07 | unit | `pnpm --filter @genie/api test` | ✅ agent/context.test.ts | ✅ green |
| 02-03-02 | 03 | 2 | AGEN-07 | integration | `pnpm --filter @genie/api test` | ✅ routes/chat.test.ts | ✅ green |
| 02-04-01 | 04 | 1 | AGEN-07 | unit | `pnpm --filter @genie/api test` | ✅ tools/update-memory.test.ts | ✅ green |
| 02-04-02 | 04 | 1 | AGEN-07 | unit | `pnpm --filter @genie/api test` | ✅ agent/index.test.ts | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

All phase behaviors have automated verification.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 1s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-04

---

## Validation Audit 2026-04-04

| Metric | Count |
|--------|-------|
| Gaps found | 3 |
| Resolved | 3 |
| Escalated | 0 |

### Tests Added

| File | Tests Added | Coverage |
|------|-------------|----------|
| `apps/api/src/kv/memory.test.ts` | 6 | readMemory null returns, writeMemory failure/success paths |
| `apps/api/src/routes/chat.test.ts` | 11 | Cache miss/hit, TTL expiry, invalidation, stub fallback, anonymous requests |
| `apps/api/src/agent/index.test.ts` | 2 | update_memory registration with/without userId |

**Total:** 155 tests across 19 files — all green.
