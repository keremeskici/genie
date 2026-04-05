# Phase 12: Send Integration + Cross-Chain - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

SendModal executes real USDC transfers via the backend API (replacing MiniKit Pay stub), with cross-chain support via Circle CCTP, and fixes the ConfirmCard URL bug. World Chain sends use the existing send_usdc tool; cross-chain sends extract the CCTP bridge logic from settle_crosschain_debt into a reusable path. Over-threshold sends surface ConfirmCard in the chat thread.

</domain>

<decisions>
## Implementation Decisions

### SendModal API Routing
- **D-01:** SendModal calls a new REST endpoint `POST /api/send` with `{recipient, amount, chain}` instead of using `triggerMiniKitPay`. This keeps the modal independent of the chat flow.
- **D-02:** The `/api/send` endpoint delegates to the same `send_usdc` logic (balance check, threshold check, GenieRouter route) but returns a structured JSON response rather than an agent tool result.
- **D-03:** For cross-chain sends, the endpoint delegates to CCTP bridge logic (extracted from `settle_crosschain_debt`).

### Chain Selection UX
- **D-04:** World Chain is the default/primary chain in the SendModal dropdown. Selecting World Chain routes through `send_usdc` (same-chain transfer).
- **D-05:** Other chains (Base, Arbitrum, Ethereum, Optimism) route through Circle CCTP `depositForBurn` — the bridge logic from `settle_crosschain_debt` is extracted into a shared utility.
- **D-06:** Chain list updated to: World Chain (default), Base, Arbitrum, Ethereum, Optimism. Polygon and Solana removed (no CCTP support in current setup).

### Confirmation Flow Wiring
- **D-07:** When `/api/send` returns `confirmation_required` (over-threshold World Chain send), SendModal closes and the response is rendered as a ConfirmCard in the chat thread.
- **D-08:** Cross-chain sends bypass the confirmation flow — they execute directly (CCTP bridge is already a multi-step process with its own transaction signing).
- **D-09:** ConfirmCard URL bug fix: change `fetch('/confirm', ...)` to `fetch('/api/confirm', ...)` in ConfirmCard component (line 51).

### Cross-Chain Scope
- **D-10:** XCHD-01 is implemented for any USDC transfer (not just debt settlement). SendModal chain picker enables sending USDC to any address on supported chains.
- **D-11:** The CCTP bridge logic (approve TokenMessenger, depositForBurn) is extracted from `settle_crosschain_debt` into a shared `bridgeUsdc` utility in `apps/api/src/chain/bridge.ts`.
- **D-12:** `settle_crosschain_debt` is refactored to use the shared `bridgeUsdc` utility.

### Claude's Discretion
- Error handling specifics for failed bridge transactions
- Loading state UI in SendModal during send execution
- Whether to show estimated bridge time for cross-chain sends ("~15 min" for CCTP)
- Success state rendering in SendModal vs redirecting to chat
- How SendModal obtains userId (session context)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend Components
- `apps/web/src/components/SendModal/index.tsx` — Current SendModal using MiniKit Pay stub, needs rewrite to call backend API
- `apps/web/src/components/ConfirmCard/index.tsx` — ConfirmCard with URL bug at line 51 (`/confirm` → `/api/confirm`)
- `apps/web/src/components/ChatInterface/index.tsx` — Chat thread where ConfirmCard renders; already parses JSON blocks
- `apps/web/src/components/DashboardInterface/index.tsx` — Dashboard that opens SendModal

### Backend Routes & Tools
- `apps/api/src/routes/confirm.ts` — POST /api/confirm handler (already complete)
- `apps/api/src/tools/send-usdc.ts` — send_usdc tool with threshold check, GenieRouter route, pending tx creation
- `apps/api/src/tools/settle-crosschain-debt.ts` — CCTP bridge logic to extract into shared utility
- `apps/api/src/chain/clients.ts` — viem clients, contract addresses, chain config
- `apps/api/src/contracts/abis.ts` — GenieRouter ABI

### API Index
- `apps/api/src/index.ts` — Route mounting (confirm at `/api/confirm`)

### Prior Phase Context
- `.planning/phases/04-financial-ops/04-CONTEXT.md` — Smart contract architecture (D-01 through D-18), confirmation flow design
- `.planning/phases/05-cross-chain-social/05-CONTEXT.md` — XCHD-01 deferral context, CCTP research refs
- `.planning/phases/09-confirmation-flow/09-CONTEXT.md` — ConfirmCard design decisions (D-01 through D-10)
- `.planning/phases/10-onboarding-allowance/10-CONTEXT.md` — USDC approval flow, MiniKit transaction pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ConfirmCard` component — Fully built with countdown timer, confirm/cancel, state management. Just needs URL fix.
- `parseConfirmCard()` — JSON block parser for `confirmation_required` type, already in ConfirmCard module.
- `settle_crosschain_debt` tool — Contains complete CCTP bridge flow (approve TokenMessenger, depositForBurn) ready to extract.
- `GenieRouterAbi`, `GENIE_ROUTER_ADDRESS`, `USDC_ADDRESS` — Contract constants available in `chain/clients.ts` and `contracts/abis.ts`.
- `send_usdc` tool — Complete same-chain send logic with threshold checking and pending tx creation.
- `useBalance` hook — Can be used to refresh balance after successful send.

### Established Patterns
- Direct `fetch()` to backend API from frontend components (no BFF proxy for data mutations)
- Dark theme with neon accents (#ccff00 accent, #171717 surface)
- MiniKit transaction flow for wallet signing (if needed for cross-chain)
- Hono route handlers with JSON responses
- Drizzle ORM for all DB operations

### Integration Points
- SendModal `handleSend` — Replace `triggerMiniKitPay` with `fetch('/api/send', ...)`
- ChatInterface — Already renders ConfirmCard via `parseConfirmCard`; may need to handle SendModal → chat thread handoff
- New `POST /api/send` route — New endpoint in `apps/api/src/routes/send.ts`
- New `apps/api/src/chain/bridge.ts` — Extracted CCTP bridge utility
- `useBalance` `refetch` — Call after successful send to update displayed balance

</code_context>

<specifics>
## Specific Ideas

- SendModal should feel like a quick-send shortcut; complex sends (chat-initiated with contact resolution) still go through the chat flow
- World Chain should be labeled "World Chain (instant)" and cross-chain options should show "~15 min" to set expectations
- The ConfirmCard URL fix is a one-line change but critical — without it, confirmations fail silently in production

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 12-send-crosschain*
*Context gathered: 2026-04-05*
