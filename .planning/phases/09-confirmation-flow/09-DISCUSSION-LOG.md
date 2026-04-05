# Phase 9: Confirmation Flow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 09-confirmation-flow
**Areas discussed:** Confirmation UI, Agent response format, Expiry & cancel, Post-confirm UX

---

## Confirmation UI

### How should the confirm/cancel UI appear?

| Option | Description | Selected |
|--------|-------------|----------|
| Inline chat card | Styled card in chat thread with amount, recipient, Confirm/Cancel buttons. Follows existing payment_confirmation pattern. | ✓ |
| Modal overlay | Centered dialog over chat. Blocks interaction until dismissed. | |
| Bottom sheet | Slides up from bottom. Common in mobile fintech. | |

**User's choice:** Inline chat card
**Notes:** None

### Card color scheme

| Option | Description | Selected |
|--------|-------------|----------|
| Neon blue accent | Consistent with app theme (MAPP-02). | |
| Amber/warning accent | Distinct attention color for financial actions. | |
| You decide | Claude picks. | |

**User's choice:** Match the current UI elements color scheme
**Notes:** User specifically said to match existing UI elements, not introduce new colors.

### Post-action card behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Update in-place | Card stays, shows 'Confirmed ✓' or 'Cancelled', buttons removed. | ✓ |
| Collapse to text | Card replaced by simple text line. | |

**User's choice:** Update in-place

---

## Agent Response Format

### How to surface confirmation_required payload

| Option | Description | Selected |
|--------|-------------|----------|
| JSON block in markdown | Agent includes ```json block. ChatInterface parses it like payment_confirmation. | ✓ |
| Tool call annotation | Use AI SDK tool result metadata. | |
| Custom stream event | Backend emits custom SSE data event. | |

**User's choice:** JSON block in markdown
**Notes:** Reuses existing parsing pattern, minimal new code.

### How to ensure agent emits the JSON block

| Option | Description | Selected |
|--------|-------------|----------|
| System prompt instruction | Add instruction to system.md for agent behavior. | ✓ |
| Tool result formatting | Pre-format markdown in tool result. | |
| You decide | Claude picks. | |

**User's choice:** System prompt instruction

---

## Expiry & Cancel

### Countdown timer

| Option | Description | Selected |
|--------|-------------|----------|
| Live countdown | Ticking timer, auto-expires at 0. | ✓ |
| Static text | Just says "expires in ~15 min". | |
| No expiry display | Don't show expiry. Backend rejects if expired. | |

**User's choice:** Live countdown

### Cancel behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Cancel locally only | Card updates, no backend call. Tx expires naturally. | ✓ |
| Cancel via backend | Call cancel endpoint to mark tx expired in DB. | |
| You decide | Claude picks. | |

**User's choice:** Cancel locally only

---

## Post-Confirm UX

### What user sees after confirming

| Option | Description | Selected |
|--------|-------------|----------|
| Card updates + agent message | Card shows "Confirmed ✓" with tx hash, then agent sends follow-up message. | ✓ |
| Agent message only | Card goes static, agent sends text. | |
| Card only | Card updates, no agent message. | |

**User's choice:** Card updates + agent message

### How confirm calls backend

| Option | Description | Selected |
|--------|-------------|----------|
| Direct fetch from component | ConfirmCard calls POST /confirm directly. | ✓ |
| Via chat message | Sends special chat message for agent to process. | |
| BFF proxy route | Next.js BFF forwards to backend. | |

**User's choice:** Direct fetch from component

---

## Claude's Discretion

- ConfirmCard component structure and state management
- Countdown timer implementation details
- Error handling for failed confirm calls
- Loading state during confirm in-flight
- How agent follow-up message is triggered after confirm

## Deferred Ideas

None — discussion stayed within phase scope
