# Phase 9: Confirmation Flow - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Over-threshold USDC transfers show a confirmation UI in the chat and execute upon user approval. Backend is already complete (send_usdc returns `confirmation_required`, POST /confirm executes pending tx). This phase wires the frontend: ChatInterface detects the confirmation payload, renders an inline confirm card, and calls the confirm endpoint on approval.

</domain>

<decisions>
## Implementation Decisions

### Confirmation UI
- **D-01:** Inline chat card rendered inside the chat thread — amount, recipient, countdown timer, Confirm/Cancel buttons. No modal or bottom sheet.
- **D-02:** Card matches existing dark theme with neon blue accents (consistent with MAPP-02). No special warning/amber colors.
- **D-03:** After user action, card updates in-place: shows "Confirmed ✓" or "Cancelled" with buttons removed. Card stays in chat history.
- **D-04:** When countdown reaches 0, card updates to "Expired" state with buttons removed.

### Agent Response Format
- **D-05:** Agent includes a ```json block with `{type: 'confirmation_required', txId, amount, recipient, recipientWallet, expiresInMinutes}` in its response text. ChatInterface parses this the same way it already parses `payment_confirmation` JSON blocks.
- **D-06:** System prompt updated to instruct the agent: when send_usdc returns confirmation_required, include the JSON block verbatim in the response.

### Expiry & Cancellation
- **D-07:** Live countdown timer on the confirm card (ticks down from expiresInMinutes). When it hits 0, card transitions to expired state.
- **D-08:** Cancel is local-only — card updates to "Cancelled" immediately. No backend call. The pending tx expires naturally after 15 min.

### Post-Confirm UX
- **D-09:** After confirm, card updates in-place to "Sent $X USDC ✓" with truncated tx hash. Then agent sends a follow-up chat message confirming the transfer.
- **D-10:** Confirm button calls `POST /confirm` directly via fetch from the ConfirmCard component (no BFF proxy, no chat message). Uses session userId and txId from the card data.

### Claude's Discretion
- ConfirmCard component structure and internal state management
- Exact countdown timer implementation (setInterval vs requestAnimationFrame)
- Error handling for failed confirm calls (retry, error message in card)
- Loading state while confirm is in-flight (spinner on button, etc.)
- How the agent follow-up message is triggered after confirm succeeds

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend (already complete — read for integration contracts)
- `apps/api/src/routes/confirm.ts` — POST /confirm handler: accepts `{txId, userId}`, executes pending tx, returns `{txHash, routeTxHash, amount, recipient}`
- `apps/api/src/tools/send-usdc.ts` — Returns `{type: 'confirmation_required', txId, amount, recipient, expiresInMinutes: 15}` for over-threshold transfers
- `apps/api/src/prompts/system.md` — System prompt, needs update to instruct agent on JSON block emission

### Frontend (where changes happen)
- `apps/web/src/components/ChatInterface/index.tsx` — Already parses `payment_confirmation` JSON blocks (lines 118-147). Add `confirmation_required` parsing following same pattern.
- `apps/web/src/components/Pay/index.tsx` — MiniKit Pay component (reference for payment UI patterns)

### Database Schema
- `apps/db/src/schema.ts` — Transactions table with status enum: pending/confirmed/expired/failed, expiresAt timestamp

### Prior Context
- `.planning/phases/04-financial-ops/04-CONTEXT.md` — Phase 4 decisions D-10 through D-13 (confirmation architecture, threshold, expiry)
- `.planning/phases/07-api-wiring/07-CONTEXT.md` — Phase 7 decisions on auth, session userId, error handling
- `.planning/phases/08-identity-wiring/08-CONTEXT.md` — Phase 8 decisions on auth boundary enforcement

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- ChatInterface JSON block parser — Already detects `payment_confirmation` in markdown; extend for `confirmation_required`
- Dark theme + neon blue accent system — Tailwind classes used throughout the app
- `useChat` from `@ai-sdk/react` — Manages message state, streaming, message append

### Established Patterns
- JSON block in agent response → frontend component rendering (payment_confirmation pattern)
- Direct fetch to backend API (not BFF) for chat and confirm endpoints
- Session userId available via NextAuth `useSession` hook

### Integration Points
- ChatInterface message rendering — Add ConfirmCard detection and rendering alongside existing payment_confirmation
- System prompt — Add instruction for confirmation_required JSON block emission
- POST `/confirm` endpoint — Frontend calls directly with txId + userId

</code_context>

<specifics>
## Specific Ideas

- Reuse the same JSON-block parsing approach as payment_confirmation for consistency
- Card should feel native to the chat — not a jarring interruption, just a richer message type
- The countdown timer gives urgency without being stressful (15 min is generous)
- Cancel is cheap (no backend call) — encourages users to cancel freely if unsure

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-confirmation-flow*
*Context gathered: 2026-04-05*
