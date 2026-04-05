# Phase 12: Send Integration + Cross-Chain - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 12-send-crosschain
**Areas discussed:** SendModal API routing, Chain selection UX, Confirmation flow wiring, Cross-chain scope
**Mode:** Auto (--auto flag)

---

## SendModal API Routing

| Option | Description | Selected |
|--------|-------------|----------|
| REST POST /api/send | Direct API call from modal, independent of chat flow | ✓ |
| Chat message injection | Send a chat message that triggers send_usdc tool | |
| MiniKit Pay (current) | Keep current approach with MiniKit wallet signing | |

**User's choice:** [auto] REST POST /api/send (recommended default)
**Notes:** Keeps SendModal independent of chat flow. Matches existing pattern of direct API calls from frontend components.

---

## Chain Selection UX

| Option | Description | Selected |
|--------|-------------|----------|
| World Chain default + dropdown | World Chain primary, others in dropdown with different routing | ✓ |
| Separate modals per chain type | One modal for same-chain, another for cross-chain | |
| Chat-only cross-chain | Only allow cross-chain via chat commands | |

**User's choice:** [auto] World Chain default with dropdown routing (recommended default)
**Notes:** Aligns with Phase 12 success criteria #2 — World Chain uses send_usdc, other chains use CCTP.

---

## Confirmation Flow Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Modal closes, ConfirmCard in chat | Over-threshold response surfaces as ConfirmCard in chat thread | ✓ |
| Inline confirmation in modal | Show confirm/cancel inside SendModal itself | |
| Separate confirmation page | Navigate to a dedicated confirmation view | |

**User's choice:** [auto] Modal closes, ConfirmCard in chat (recommended default)
**Notes:** ConfirmCard already built and designed for chat thread per Phase 9. Avoids duplicating confirmation UI.

---

## Cross-Chain Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full XCHD-01 via SendModal | Any transfer can be cross-chain, not just debt settlement | ✓ |
| Debt settlement only | Cross-chain limited to settle_crosschain_debt tool | |
| Chat-only cross-chain | Cross-chain only available via chat commands | |

**User's choice:** [auto] Full XCHD-01 via SendModal (recommended default)
**Notes:** Phase 12 requirements explicitly include XCHD-01. CCTP infrastructure from settle_crosschain_debt extracted into shared utility.

---

## Claude's Discretion

- Error handling for failed bridge transactions
- Loading state UI during send execution
- Bridge time estimates display
- Success state rendering approach
- userId acquisition from session

## Deferred Ideas

None — discussion stayed within phase scope
