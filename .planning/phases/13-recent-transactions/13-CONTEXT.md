# Phase 13: Recent Transactions - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard and wallet tab show real transaction history from the database. A new GET /api/transactions endpoint queries the transactions table and returns recent activity. DashboardInterface replaces MOCK_TRANSACTIONS with live data. Transactions show amount, recipient/sender, timestamp, and direction (sent/received).

</domain>

<decisions>
## Implementation Decisions

### Transaction Direction
- **D-01:** Sent transactions: query where `senderUserId = userId`. Received transactions: query where `recipientWallet = user's walletAddress`. Combine and sort by createdAt descending.
- **D-02:** Each transaction in the response includes a `direction` field: `"sent"` or `"received"`. Frontend uses this for display label and icon.

### Endpoint Design
- **D-03:** New `GET /api/transactions?userId={uuid}` Hono route. Requires userId query param (same pattern as other endpoints).
- **D-04:** Simple `limit` query param (default 20, max 50). No cursor pagination — hackathon scope.
- **D-05:** Only return `status = 'confirmed'` transactions. Pending/expired are excluded from the history view.
- **D-06:** Response shape: `{ transactions: Array<{ id, direction, label, amount, category, timestamp, txHash }> }` where amount is formatted string (e.g., "$10.00"), label is "Sent to 0x…a1f2" / "Received from 0x…b3c4", timestamp is ISO string (frontend formats to relative).

### Transaction Display Format
- **D-07:** Label format: "Sent to [0x…last4]" or "Received from [0x…last4]" using truncated wallet addresses. No contact name resolution — keep it simple for hackathon.
- **D-08:** Amount displays as `$X.XX` with dollar sign, 2 decimal places. Sent amounts prefixed with `-`, received with `+`.
- **D-09:** Frontend converts ISO timestamp to relative format ("Today", "Yesterday", "2 days ago") — same style as existing MOCK_TRANSACTIONS.

### Category in Response
- **D-10:** Include `category` field in each transaction (nullable). SPND-01 requires categorization to happen — the data is already stored. Dashboard list shows category as subtle secondary text if present.
- **D-11:** No category filtering or category icons in the dashboard — just the transaction list with optional category label.

### Claude's Discretion
- Whether to use a single SQL query with UNION or two separate queries merged in JS for sent/received
- Loading skeleton style for the transactions list (match balance skeleton pattern from Phase 11)
- Empty state message when no transactions exist
- Whether to create a `useTransactions` hook or inline the fetch in DashboardInterface

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `apps/db/src/schema.ts` — `transactions` table definition with senderUserId, recipientWallet, amountUsd, txHash, status, category, source, createdAt

### Backend Route Patterns
- `apps/api/src/routes/balance.ts` — GET endpoint pattern to replicate (Hono handler, query param, JSON response)
- `apps/api/src/routes/send.ts` — POST /api/send shows how transactions are created (D-01 sent direction)
- `apps/api/src/tools/get-spending.ts` — Drizzle query pattern for transactions table (conditions, eq, and)

### Frontend Integration
- `apps/web/src/components/DashboardInterface/index.tsx` — Lines 14-18: MOCK_TRANSACTIONS to replace. Lines 126-152: Recent Transactions section rendering.
- `apps/web/src/hooks/useBalance.ts` — Hook pattern for data fetching (useState + useEffect + refetch)

### API Route Registration
- `apps/api/src/index.ts` — Where routes are mounted

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db`, `transactions`, `eq`, `and`, `gte` from `@genie/db` — Drizzle ORM query building, same as get-spending tool
- `useBalance` hook — Fetch pattern to replicate for transactions (useState + useEffect + memoized fetch)
- `useSession()` — Provides `session.user.walletAddress` and `session.user.id` in DashboardInterface
- Hono route registration — Follow existing pattern in routes/balance.ts

### Established Patterns
- Backend routes: Hono handlers with typed request/response, try/catch error handling
- Frontend data fetching: direct fetch to API URL with useState/useEffect (see useBalance)
- Dark theme: bg-surface, text-white/40 for secondary text, text-accent for positive amounts
- Transaction list UI already built with correct styling (lines 132-151 in DashboardInterface)

### Integration Points
- `MOCK_TRANSACTIONS` constant (line 14) → replace with hook data
- Transaction map (lines 133-150) → adapt to real data shape
- API route registration in main Hono app
- `refetchBalance` pattern → can add `refetchTransactions` similarly

</code_context>

<specifics>
## Specific Ideas

- The transaction list UI is already built with correct dark theme styling — this is purely a data-wiring phase
- The endpoint is essentially get_spending logic but returning individual rows instead of aggregates
- Keep the response shape close to the MOCK_TRANSACTIONS format to minimize frontend changes

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 13-recent-transactions*
*Context gathered: 2026-04-05*
