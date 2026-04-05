# Phase 11: Live Balance Display - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard shows the user's real USDC balance fetched from the blockchain. A new GET /api/balance endpoint reads on-chain balance via viem, and DashboardInterface replaces the hardcoded $0.00 with the live value. Balance refreshes on page load and after transactions.

</domain>

<decisions>
## Implementation Decisions

### Balance Endpoint
- **D-01:** New GET /api/balance?wallet={address} Hono route in the API. Reuses `publicClient` and `USDC_ADDRESS` from `apps/api/src/chain/clients.ts` with `erc20Abi` `balanceOf` call — same pattern as `createGetBalanceTool`.
- **D-02:** Returns `{ balance: string, currency: "USDC" }` where balance is formatted (human-readable, 6→decimal via `formatUnits`).

### Balance Refresh Strategy
- **D-03:** Fetch balance on component mount (page load). No polling interval — keeps it simple for hackathon.
- **D-04:** Refetch balance after transactions (send, confirm) — the relevant modals/flows should trigger a refetch when they close or succeed.

### Loading & Error States
- **D-05:** Show a skeleton/shimmer placeholder in the balance area while the fetch is in-flight.
- **D-06:** On fetch failure, display `$--.--` as fallback with no retry button. Non-disruptive — dashboard remains functional.

### Balance Formatting
- **D-07:** Display as `$X.XX` — dollar sign prefix, exactly 2 decimal places. USDC is 1:1 USD, standard money formatting.
- **D-08:** Large amounts: no thousand separators needed for hackathon demo (balances will be small).

### Claude's Discretion
- Skeleton animation style (pulse vs shimmer — match existing dark theme)
- Whether to use SWR/React Query or a simple useState+useEffect fetch pattern
- Error logging approach for failed balance fetches
- Exact placement of loading skeleton relative to the existing balance text

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Balance Reading (backend pattern to replicate)
- `apps/api/src/tools/get-balance.ts` — Existing `createGetBalanceTool` reads USDC balance via `publicClient.readContract` with `erc20Abi`. Reuse the same approach for the REST endpoint.
- `apps/api/src/chain/clients.ts` — Exports `publicClient`, `USDC_ADDRESS`, `chain`. All needed for the balance endpoint.

### API Route Pattern
- `apps/api/src/routes/users.ts` — Reference for Hono route structure, request parsing, and response format.
- `apps/api/src/routes/confirm.ts` — Another route reference with error handling pattern.

### Frontend Integration Point
- `apps/web/src/components/DashboardInterface/index.tsx` — Line 93-96: hardcoded `$0.00` balance display. Replace with live data.
- `apps/web/src/lib/contracts.ts` — Frontend USDC contract addresses (may be useful for reference but balance comes from API).

### Session & Auth
- `apps/web/src/auth/index.ts` — NextAuth config, session includes `walletAddress`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `publicClient.readContract` with `erc20Abi` — already proven in get-balance tool, exact same call for the endpoint
- `formatUnits(raw, 6)` from viem — already used for USDC decimal conversion
- `useSession()` — provides `session.user.walletAddress` in DashboardInterface (already imported)
- Hono route registration pattern — follow existing routes in `apps/api/src/routes/`

### Established Patterns
- Backend routes: Hono handlers with typed request/response, error try/catch
- Frontend data fetching: direct fetch to API URL (see ChatInterface, ConfirmCard)
- Dark theme: bg-background, text-white, font-headline classes

### Integration Points
- `DashboardInterface` line 95: `$0.00` text → replace with fetched balance
- API route registration in the main Hono app (wherever routes are mounted)
- Session walletAddress → passed as query param to balance endpoint

</code_context>

<specifics>
## Specific Ideas

- The balance endpoint is essentially the get_balance tool logic extracted into a REST route — minimal new code needed
- DashboardInterface already has the layout; this is a data-wiring phase, not a UI redesign
- Keep the fetch simple (useState + useEffect) unless there's already a data-fetching library in use

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-live-balance*
*Context gathered: 2026-04-05*
