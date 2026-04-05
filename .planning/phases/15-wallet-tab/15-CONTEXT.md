# Phase 15: Wallet Tab Completion - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Wallet tab shows live USDC balance, recent transaction history, and World ID verification — with auth guards on sensitive backend endpoints. Reuses existing hooks (useBalance, useTransactions) and the Verify component. The decorative card UI is preserved and enhanced with live data.

</domain>

<decisions>
## Implementation Decisions

### Wallet Tab Layout
- **D-01:** Layout order top-to-bottom: header, decorative card (existing), live balance section, Verify section (conditional), transaction history, Add Funds button.
- **D-02:** Reuse `useBalance(walletAddress)` and `useTransactions(userId)` hooks — same patterns as DashboardInterface.
- **D-03:** Session data (`walletAddress`, `userId`) obtained via `useSession()` — same as DashboardInterface.

### Verify Placement & Visibility
- **D-04:** Verify component renders between balance and transaction sections, only when user is NOT verified. After successful verification, hide the section.
- **D-05:** Verification state tracked via local component state after `onVerified` callback fires. On next page load, backend session/DB reflects verified status.
- **D-06:** Verify section styled as a prominent card/banner encouraging verification — "Verify with World ID to unlock sending and debt tracking."

### Auth Guards on Backend Endpoints
- **D-07:** POST `/api/confirm` — already validates `userId` matches `senderUserId` on the transaction. No additional auth guard needed (caller must know both txId and userId).
- **D-08:** PATCH `/api/users/profile` — add a session-based check or ensure the `userId` in the body matches the caller's identity. Minimal change to existing route.
- **D-09:** Auth guards are per-route validation (consistent with existing codebase pattern), not Hono middleware.

### Transaction Display
- **D-10:** Reuse exact DashboardInterface transaction rendering pattern — list items with direction icon, formatted wallet address, relative time, and amount.
- **D-11:** Extract shared transaction list rendering into a reusable pattern or duplicate the markup (Claude's discretion on whether extraction is warranted for two consumers).
- **D-12:** Loading skeleton and empty state follow same patterns as DashboardInterface.

### Claude's Discretion
- Whether to extract a shared TransactionList component or keep inline rendering in both Dashboard and Wallet
- Loading skeleton animation style for wallet tab (match existing pulse pattern)
- Exact styling of the Verify banner/card section
- Whether isVerified state comes from session data or a separate API check

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Wallet Tab (current state)
- `apps/web/src/components/WalletInterface/index.tsx` — Current static shell with hardcoded $0.00, decorative card, Add Funds button
- `apps/web/src/app/(protected)/wallet/page.tsx` — Wallet page route

### Data Hooks (reuse as-is)
- `apps/web/src/hooks/useBalance.ts` — Balance hook with walletAddress param, returns { balance, loading, error, refetch }
- `apps/web/src/hooks/useTransactions.ts` — Transactions hook with userId param, returns { transactions, loading, error, refetch }

### Verify Component
- `apps/web/src/components/Verify/index.tsx` — World ID verify with onVerified callback, MiniKit IDKit 4.0 flow

### Dashboard (reference for transaction display pattern)
- `apps/web/src/components/DashboardInterface/index.tsx` — Live balance + transaction list with formatRelativeTime and formatWallet helpers

### Backend Endpoints (auth guard targets)
- `apps/api/src/routes/confirm.ts` — POST /api/confirm, validates txId + userId match
- `apps/api/src/routes/users.ts` — PATCH /api/users/profile, uses resolveUserId

### Auth / Session
- `apps/web/src/auth/index.ts` — NextAuth config, session includes walletAddress and id
- `apps/web/middleware.ts` — Middleware redirects unauthenticated users from protected paths

### Prior Context
- `.planning/phases/08-identity-wiring/08-CONTEXT.md` — Phase 8 identity decisions (Verify flow, middleware)
- `.planning/phases/11-live-balance/11-CONTEXT.md` — Phase 11 balance decisions (endpoint, hook, formatting)
- `.planning/phases/13-recent-transactions/13-CONTEXT.md` — Phase 13 transaction decisions (endpoint, hook, display format)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useBalance` hook — proven, ready to drop into WalletInterface
- `useTransactions` hook — proven, ready to drop into WalletInterface
- `Verify` component — working with onVerified callback
- `formatRelativeTime()` and `formatWallet()` — in DashboardInterface, can be extracted or duplicated
- `useSession()` — provides walletAddress and userId

### Established Patterns
- Data fetching: useState + useEffect + useCallback (see useBalance, useTransactions)
- Loading states: `animate-pulse` skeleton divs
- Error states: fallback text (e.g., `$--.--`)
- Dark theme: bg-background, bg-surface, text-white, text-white/40, text-accent
- Transaction list: divide-y divide-white/5, material-symbols-outlined icons

### Integration Points
- WalletInterface replaces hardcoded $0.00 with useBalance data
- WalletInterface adds transaction list section using useTransactions data
- Verify component added conditionally based on verification status
- Backend routes: minimal auth guard additions to confirm and users/profile

</code_context>

<specifics>
## Specific Ideas

- This is primarily a data-wiring phase — the wallet tab UI structure exists, just needs live data and the Verify component
- Keep the decorative card visual — it gives the wallet tab its distinct personality vs the dashboard
- The transaction list on wallet tab should feel identical to dashboard — user sees consistent data regardless of which tab they're on

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-wallet-tab*
*Context gathered: 2026-04-05*
