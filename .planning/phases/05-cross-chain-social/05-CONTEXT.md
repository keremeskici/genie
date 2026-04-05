# Phase 5: Cross-Chain & Social - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Spending tracking, spending queries, and debt management via natural language. Users can categorize transactions, ask spending summaries, create/track debts, and get auto-settlement when incoming transfers match open debts. All delivered in `apps/api` as new agent tools and schema extensions.

**XCHD-01 (cross-chain deposits via Arc CCTP) is DEFERRED** — Circle Bridge Kit requires frontend wallet signing on the source chain, which conflicts with the Mini App living inside World App. Will be implemented post-hackathon.

Active requirements: SPND-01, SPND-02, DEBT-01, DEBT-02

</domain>

<decisions>
## Implementation Decisions

### Transaction Categorization
- **D-01:** AI-inferred categorization at creation time — agent infers category from conversation context (e.g., "send $30 to Alice for dinner" -> food). No user action needed.
- **D-02:** Fixed category set matching SPND-01: `food`, `transport`, `entertainment`, `bills`, `transfers`. No dynamic category creation.
- **D-03:** Both outgoing (sent) and incoming (received) transactions are categorized.
- **D-04:** Default to `transfers` when the agent cannot infer a category from context. Every transaction always has a category — no nulls.
- **D-05:** Add nullable `category` text column to the existing `transactions` table.
- **D-06:** Add `source` text column to `transactions` table (e.g., `genie_send`, `received`, future: `world_card`). Enables filtering/grouping by transaction origin.
- **D-07:** Categorization logic must be a **standalone function/service**, decoupled from `send_usdc` tool. It should accept any transaction and infer category from available context. This enables future World Card transactions to flow through the same categorization pipeline with minimal integration work.

### Debt Management
- **D-08:** Debts support both directions — "Alice owes me $30" (owed-to-me) and "I owe Bob $20" (I-owe). Direction stored via a flag or sign convention on the existing `debts` table.
- **D-09:** Auto-settlement matching: when an incoming transfer arrives, match by counterparty wallet AND approximate amount (within tolerance, e.g., +/-$1) against open debts. If match found, mark debt as settled.
- **D-10:** Settlement notification at next chat message — agent mentions it at conversation start: "Alice's $30 transfer matched your dinner debt — I've marked it settled." No push notifications.
- **D-11:** `create_debt` tool is gated (requires World ID verification, per Phase 3 D-07).
- **D-12:** `list_debts` tool shows open debts with counterparty, amount, direction, and description. Available to verified users.

### Spending Queries
- **D-13:** Natural language time range parsing — agent extracts start/end dates from user messages ("this week", "last month", "in March"). Tool receives date range parameters.
- **D-14:** Text breakdown format — agent responds with categorized summary: "Food: $120, Transport: $45, Entertainment: $30. Total: $195 this week." Clean for chat interface.
- **D-15:** `get_spending` tool queries transactions table filtered by userId, date range, and optionally category. Returns aggregated amounts per category.

### Scalability for World Card
- **D-16:** The `source` column (D-06) and standalone categorization layer (D-07) are designed so that future World Card transaction imports can plug into the same spending tracking and categorization pipeline with minimal changes.

### Claude's Discretion
- Exact tolerance threshold for debt auto-settlement matching
- Direction storage approach (boolean flag vs positive/negative amounts vs enum)
- How the agent detects incoming transfers for auto-settlement (polling vs event-driven)
- Spending query aggregation SQL structure
- How categorization context is passed (conversation history snippet, transaction description, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Circle CCTP (Deferred)
- `https://github.com/circlefin/circle-bridge-kit-transfer` — Reference implementation for future XCHD-01 (deferred, not in this phase)
- `https://developers.circle.com/cctp` — CCTP V2 documentation (deferred)

### Existing Code
- `apps/db/src/schema.ts` — Transactions table (add `category`, `source` columns), debts table (already exists with `ownerUserId`, `counterpartyWallet`, `amountUsd`, `description`, `settled`)
- `apps/api/src/tools/send-usdc.ts` — Send tool factory pattern; categorization hooks into post-transfer logic
- `apps/api/src/tools/require-verified.ts` — Gating guard for debt tools
- `apps/api/src/agent/context.ts` — UserContext interface, assembleContext for notification injection
- `apps/api/src/agent/index.ts` — Agent orchestrator where new tools get registered
- `apps/api/src/chain/clients.ts` — viem clients for World Chain (balance monitoring for auto-settlement)
- `apps/api/src/kv/types.ts` — AgentMemory with `spendingCategories` in financialProfile

### Prior Context
- `.planning/phases/04-financial-ops/04-CONTEXT.md` — Smart contract architecture (D-01 through D-05), confirmation flow, viem setup
- `.planning/phases/03-identity/03-CONTEXT.md` — Verification gating (D-06 through D-10), requireVerified pattern
- `.planning/phases/02-data-layer/02-CONTEXT.md` — Schema design, context loading flow, KV memory

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireVerified()` in `tools/require-verified.ts` — Gate for `create_debt` and `list_debts` tools
- `createSendUsdcTool()` factory pattern — Template for new tool factories (`create_debt`, `list_debts`, `get_spending`)
- `debts` table already in schema — Has `ownerUserId`, `counterpartyWallet`, `amountUsd`, `description`, `settled`, `createdAt`
- `transactions` table — Ready for `category` and `source` column additions
- `publicClient` in `chain/clients.ts` — Can read on-chain events/balances for settlement detection
- `AgentMemory.financialProfile.spendingCategories` — Already typed, can store user's common categories

### Established Patterns
- Tool factory pattern with `userId` + `userContext` binding per request
- Vercel AI SDK `tool()` with Zod `inputSchema`
- Drizzle ORM for all database operations
- `drizzle-kit push` for schema sync (no migration files)
- Vitest for testing with `vi.mock()` patterns

### Integration Points
- `agent/index.ts` — Register `create_debt`, `list_debts`, `get_spending` tools
- `routes/chat.ts` — Pass userId/userContext to new tool factories
- `schema.ts` — Add `category` and `source` columns to transactions table
- `send-usdc.ts` — After successful transfer, call categorization function
- System prompt — Update to mention spending tracking and debt capabilities

</code_context>

<specifics>
## Specific Ideas

- World Card integration is coming — the categorization layer must be designed as a standalone service that any transaction source can use, not hardwired to the send_usdc tool
- The `source` column on transactions enables future analytics by payment method (genie_send vs world_card vs received)
- Auto-settlement should feel magical — "I noticed Alice sent you $30, which matches the dinner debt. I've marked it settled." — but only surface at conversation start, not interrupt

</specifics>

<deferred>
## Deferred Ideas

- **XCHD-01: Cross-chain USDC deposits via Circle Bridge Kit / CCTP V2** — Deferred because Bridge Kit requires frontend wallet signing on the source chain, which doesn't work inside World App Mini App. Will revisit post-hackathon, potentially using Circle Gateway or a server-side approach once World App supports external wallet connections.
- **World Card transaction import** — Future capability. Schema and categorization designed to support it (D-06, D-07, D-16) but no implementation in this phase.

</deferred>

---

*Phase: 05-cross-chain-social*
*Context gathered: 2026-04-04*
