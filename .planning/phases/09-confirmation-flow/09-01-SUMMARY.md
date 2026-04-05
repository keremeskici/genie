---
phase: 09-confirmation-flow
plan: 01
subsystem: web/chat-ui, api/prompts
tags: [confirmation, ux, usdc, frontend]
dependency_graph:
  requires: []
  provides: [ConfirmCard component, parseConfirmCard parser, system prompt confirmation instructions]
  affects: [ChatInterface, agent response formatting]
tech_stack:
  added: []
  patterns: [state-machine component, client-side countdown timer, polling-free interactive confirm flow]
key_files:
  created:
    - apps/web/src/components/ConfirmCard/index.tsx
  modified:
    - apps/api/src/prompts/system.md
    - apps/web/src/components/ChatInterface/index.tsx
decisions:
  - "ConfirmCard uses local state machine (idle/loading/confirmed/cancelled/expired/error) — no global state needed"
  - "Cancel is local-only per D-08 — no backend call needed to cancel a pending tx"
  - "payment_confirmation useEffect preserved unchanged — different flow from confirmation_required"
  - "Global /g flag used for json block stripping — prevents raw JSON leaking when multiple blocks present"
metrics:
  duration_minutes: 3
  completed_date: "2026-04-05"
  tasks_completed: 2
  files_changed: 3
---

# Phase 09 Plan 01: Confirmation Flow Frontend Summary

ConfirmCard component with full state machine, countdown timer, and POST /confirm integration wired into ChatInterface alongside ContactList.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create ConfirmCard component and update system prompt | 99dea6b | apps/web/src/components/ConfirmCard/index.tsx, apps/api/src/prompts/system.md |
| 2 | Wire ConfirmCard into ChatInterface | c6dcab2 | apps/web/src/components/ChatInterface/index.tsx |

## What Was Built

**ConfirmCard component** (`apps/web/src/components/ConfirmCard/index.tsx`):
- `parseConfirmCard(text)` — detects `confirmation_required` JSON blocks using same regex pattern as `parseContactList`
- `ConfirmCardData` interface with txId, amount, recipient, recipientWallet, expiresInMinutes
- `ConfirmCard` React component with full state machine
- Countdown timer via `useEffect`/`setInterval` with cleanup — ticks from `expiresInMinutes * 60` to 0
- `handleConfirm` — POST /confirm with 409/410/other error handling
- `handleCancel` — local-only state update (no backend call)
- Rendered in 6 states: idle (countdown + buttons), loading (disabled buttons), confirmed (check + txHash), cancelled, expired, error (retry available)

**System prompt update** (`apps/api/src/prompts/system.md`):
- Added `## Confirmation-Required Transfers` section
- Instructs agent to emit full JSON block verbatim in fences when send_usdc returns confirmation_required

**ChatInterface wiring** (`apps/web/src/components/ChatInterface/index.tsx`):
- Imported `ConfirmCard` and `parseConfirmCard`
- `AiMessageBubble` now receives `userId: string` prop
- `parseConfirmCard(textContent)` called alongside `parseContactList`
- JSON block stripping uses global `/g` flag — strips ALL blocks
- `<ConfirmCard data={confirmData} userId={userId} />` rendered after ContactList
- `userId={session?.user?.id ?? ''}` passed from session in messages.map
- Existing `payment_confirmation` useEffect preserved unchanged (different flow)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data wired end-to-end. ConfirmCard fetches real /confirm endpoint; userId comes from session.

## Self-Check: PASSED

- apps/web/src/components/ConfirmCard/index.tsx: FOUND
- apps/api/src/prompts/system.md: FOUND (contains confirmation_required)
- apps/web/src/components/ChatInterface/index.tsx: FOUND (contains parseConfirmCard, ConfirmCard)
- Commit 99dea6b: FOUND
- Commit c6dcab2: FOUND
