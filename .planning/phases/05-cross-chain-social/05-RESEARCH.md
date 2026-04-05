# Phase 05: Cross-Chain & Social - Research

**Researched:** 2026-04-04
**Domain:** AI agent tools, spending categorization, debt management, Drizzle ORM schema extension
**Confidence:** HIGH (all findings from direct codebase inspection — no external dependencies needed)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Transaction Categorization**
- D-01: AI-inferred categorization at creation time — agent infers category from conversation context (e.g., "send $30 to Alice for dinner" -> food). No user action needed.
- D-02: Fixed category set matching SPND-01: `food`, `transport`, `entertainment`, `bills`, `transfers`. No dynamic category creation.
- D-03: Both outgoing (sent) and incoming (received) transactions are categorized.
- D-04: Default to `transfers` when the agent cannot infer a category from context. Every transaction always has a category — no nulls.
- D-05: Add nullable `category` text column to the existing `transactions` table.
- D-06: Add `source` text column to `transactions` table (e.g., `genie_send`, `received`, future: `world_card`). Enables filtering/grouping by transaction origin.
- D-07: Categorization logic must be a **standalone function/service**, decoupled from `send_usdc` tool. It should accept any transaction and infer category from available context. This enables future World Card transactions to flow through the same categorization pipeline with minimal integration work.

**Debt Management**
- D-08: Debts support both directions — "Alice owes me $30" (owed-to-me) and "I owe Bob $20" (I-owe). Direction stored via a flag or sign convention on the existing `debts` table.
- D-09: Auto-settlement matching: when an incoming transfer arrives, match by counterparty wallet AND approximate amount (within tolerance, e.g., +/-$1) against open debts. If match found, mark debt as settled.
- D-10: Settlement notification at next chat message — agent mentions it at conversation start: "Alice's $30 transfer matched your dinner debt — I've marked it settled." No push notifications.
- D-11: `create_debt` tool is gated (requires World ID verification, per Phase 3 D-07).
- D-12: `list_debts` tool shows open debts with counterparty, amount, direction, and description. Available to verified users.

**Spending Queries**
- D-13: Natural language time range parsing — agent extracts start/end dates from user messages ("this week", "last month", "in March"). Tool receives date range parameters.
- D-14: Text breakdown format — agent responds with categorized summary: "Food: $120, Transport: $45, Entertainment: $30. Total: $195 this week." Clean for chat interface.
- D-15: `get_spending` tool queries transactions table filtered by userId, date range, and optionally category. Returns aggregated amounts per category.

**Scalability for World Card**
- D-16: The `source` column (D-06) and standalone categorization layer (D-07) are designed so that future World Card transaction imports can plug into the same spending tracking and categorization pipeline with minimal changes.

### Claude's Discretion
- Exact tolerance threshold for debt auto-settlement matching
- Direction storage approach (boolean flag vs positive/negative amounts vs enum)
- How the agent detects incoming transfers for auto-settlement (polling vs event-driven)
- Spending query aggregation SQL structure
- How categorization context is passed (conversation history snippet, transaction description, etc.)

### Deferred Ideas (OUT OF SCOPE)
- **XCHD-01: Cross-chain USDC deposits via Circle Bridge Kit / CCTP V2** — Deferred because Bridge Kit requires frontend wallet signing on the source chain, which doesn't work inside World App Mini App.
- **World Card transaction import** — Future capability. Schema and categorization designed to support it (D-06, D-07, D-16) but no implementation in this phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XCHD-01 | User can deposit USDC from Ethereum/Base/Arbitrum to World Chain via Arc CCTP | **DEFERRED per CONTEXT.md** — no implementation in this phase |
| SPND-01 | Agent categorizes transactions (food, transport, entertainment, bills, transfers) | `inferCategory()` standalone function + `category`+`source` columns on `transactions` table |
| SPND-02 | User can ask spending summaries ("how much did I spend this week?") | `get_spending` tool with Drizzle aggregation query; agent handles date range parsing |
| DEBT-01 | User can create debt entries ("Alice owes me $30 for dinner") | `create_debt` tool (gated via `requireVerified`); direction flag on `debts` table |
| DEBT-02 | Agent auto-detects incoming transfers and marks debts as settled | Polling at chat start via `checkAndSettleDebts()` function; match by wallet + amount tolerance |
</phase_requirements>

---

## Summary

Phase 5 is a pure API/backend feature extension — no new infrastructure, no external services, no new contracts. Everything builds on the existing Drizzle/Postgres schema, Vercel AI SDK tool pattern, and `requireVerified` guard. The codebase patterns from phases 1-4 are mature and directly reusable.

The four active requirements map to three new agent tools (`create_debt`, `list_debts`, `get_spending`), one standalone categorization function (`inferCategory`), two schema columns (`category`, `source` on `transactions`), one `direction` flag on `debts`, and a settlement check routine that runs at conversation start. All fit neatly in `apps/api/src/tools/` following the factory pattern already established.

The critical design insight from D-07 is that `inferCategory` must NOT be wired inside `send-usdc.ts` — it should be a pure function that takes transaction metadata (description, amount, counterparty) and returns a category. This way it can be called from `send-usdc` post-transfer, from a future `receive` handler, and from a future World Card importer without code duplication.

**Primary recommendation:** Build incrementally in three waves: (1) schema migration + `inferCategory` function, (2) `create_debt`/`list_debts` tools, (3) `get_spending` tool + settlement detection.

---

## Standard Stack

### Core (already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.45.2 | Schema definition + queries | Already used for all DB operations |
| ai (Vercel AI SDK) | ^6.0.146 | `tool()` + `inputSchema` pattern | All tools use this — established pattern |
| zod | ^3.24.6 | Input schema validation for tools | Used in all existing tools |
| viem | 2.45.3 | On-chain event reading for settlement detection | `publicClient` already in `chain/clients.ts` |
| vitest | latest | Unit tests | Already the test runner for `apps/api` |
| @electric-sql/pglite | ^0.4.3 | In-memory Postgres for schema tests | Already used in `apps/db/src/schema.test.ts` |

**No new packages required for this phase.** All dependencies are already in the monorepo.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Polling for incoming transfers at chat start | viem `watchContractEvent` | Event-driven is real-time but requires persistent process — polling at chat start is simpler and sufficient for hackathon |
| Storing direction as boolean `iOwe` | Numeric sign on `amountUsd` | Boolean is explicit, readable; sign convention is compact but confusing. Boolean chosen per D-08. |
| SQL `SUM(CASE WHEN category='food'...)` | Multiple queries per category | Single aggregation query is more efficient |

---

## Architecture Patterns

### Recommended File Structure for New Code

```
apps/api/src/
├── tools/
│   ├── categorize.ts          # inferCategory() standalone function (D-07)
│   ├── categorize.test.ts
│   ├── create-debt.ts         # createCreateDebtTool factory (D-11, D-12)
│   ├── create-debt.test.ts
│   ├── list-debts.ts          # createListDebtsTool factory (D-12)
│   ├── list-debts.test.ts
│   ├── get-spending.ts        # createGetSpendingTool factory (D-15)
│   └── get-spending.test.ts
├── agent/
│   ├── settlement.ts          # checkAndSettleDebts() (D-09, D-10, DEBT-02)
│   └── settlement.test.ts
apps/db/src/
└── schema.ts                  # Add category + source to transactions, direction to debts
```

### Pattern 1: Tool Factory (already established)

**What:** Every tool is a factory function that closes over `userId` + `userContext` per-request.
**When to use:** All new tools — `create_debt`, `list_debts`, `get_spending`.

```typescript
// Source: apps/api/src/tools/send-usdc.ts (established pattern)
export function createCreateDebtTool(userId: string, userContext: UserContext) {
  return tool({
    description: '...',
    inputSchema: z.object({
      counterpartyWallet: z.string(),
      amountUsd: z.number().positive(),
      description: z.string().optional(),
      iOwe: z.boolean().describe('true = I owe them; false = they owe me'),
    }),
    execute: async ({ counterpartyWallet, amountUsd, description, iOwe }) => {
      const gateError = requireVerified(userContext);
      if (gateError) return gateError;
      // ... Drizzle insert
    },
  });
}
```

### Pattern 2: Standalone Categorization Function (D-07)

**What:** A pure function that accepts transaction context and returns a category string. Does NOT need AI inference at runtime — the agent has already expressed the category in natural language before calling tools.
**Key insight:** When the agent calls `send_usdc`, the user's message ("send $30 to Alice for dinner") is in the conversation history. The categorization function should receive a `description` parameter that the agent fills from conversation context.

```typescript
// Source: design based on D-01, D-02, D-04
const VALID_CATEGORIES = ['food', 'transport', 'entertainment', 'bills', 'transfers'] as const;
type Category = typeof VALID_CATEGORIES[number];

export function inferCategory(description: string | null | undefined): Category {
  if (!description) return 'transfers';
  const lower = description.toLowerCase();
  if (/food|dinner|lunch|breakfast|restaurant|cafe|coffee|grocery|eat/.test(lower)) return 'food';
  if (/transport|taxi|uber|lyft|bus|train|metro|ride|gas|parking/.test(lower)) return 'transport';
  if (/entertainment|movie|game|concert|ticket|fun|bar|drink|party/.test(lower)) return 'entertainment';
  if (/bill|rent|utility|electric|water|internet|phone|insurance|subscription/.test(lower)) return 'bills';
  return 'transfers';
}
```

**Important:** `inferCategory` receives a `description` string, not the full conversation. The calling tool (or agent) passes the transaction description/context. No LLM call needed inside the function — the agent already has context and should pass it as a description parameter.

**How `send_usdc` integrates (post-transfer hook):** After recording the confirmed transaction, call `inferCategory(description)` and update the `category` column. The `description` string can be passed as an additional optional parameter to `createSendUsdcTool` or derived from the tool's `inputSchema`.

**Simplest approach:** Add optional `description` to `send_usdc` tool's `inputSchema` — the agent can populate it from conversation context. The `inferCategory` function then operates on that description.

### Pattern 3: Schema Extension with Drizzle

**What:** Add `category` (nullable text) and `source` (text, not null, default `genie_send`) to `transactions`. Add `iOwe` (boolean, not null, default false) to `debts`.

```typescript
// Source: apps/db/src/schema.ts pattern — add to transactions table
export const transactions = pgTable('transactions', {
  // ... existing columns ...
  category: text('category'),                          // nullable (D-05)
  source: text('source').notNull().default('genie_send'), // D-06
});

// Add to debts table
export const debts = pgTable('debts', {
  // ... existing columns ...
  iOwe: boolean('i_owe').notNull().default(false),     // D-08: true = I owe, false = they owe me
});
```

**Schema sync:** Run `drizzle-kit push` (already scripted as `pnpm db:push` from `apps/db`). Uses `pushSchema.apply()` pattern — no migration files needed per Phase 2 decision.

### Pattern 4: Settlement Detection at Chat Start (D-09, D-10)

**What:** Before assembling context for each chat, check if any incoming transfers match open debts. If yes, settle them and inject a notification message.
**When:** Every chat request that has a `userId`.

```typescript
// Source: design based on D-09, D-10, context.ts assembleContext pattern
// apps/api/src/agent/settlement.ts

export interface SettlementNotice {
  counterpartyWallet: string;
  amountUsd: string;
  description: string | null;
}

export async function checkAndSettleDebts(
  ownerUserId: string,
  ownerWallet: string,
): Promise<SettlementNotice[]> {
  // 1. Fetch open debts where iOwe=false (they owe me)
  // 2. Fetch recent incoming transactions (received, last 24h window or since last check)
  // 3. Match by counterpartyWallet === senderWallet and |amount - debtAmount| <= TOLERANCE
  // 4. Update matched debts: settled=true
  // 5. Return notices for chat context injection
}

const SETTLEMENT_TOLERANCE_USD = 1.00; // Claude's discretion per CONTEXT.md
```

**Integration point:** `routes/chat.ts` — after fetching `userContext`, call `checkAndSettleDebts()`. If notices exist, inject them into the context injection message (e.g., append to `contextInjection` string in `assembleContext`).

**Alternative:** Extend `assembleContext` to accept an optional `notices` parameter, or add to `UserContext`. Adding a `pendingSettlements` field to `UserContext` avoids changing `assembleContext` signature.

### Pattern 5: Spending Aggregation Query

**What:** Drizzle query that sums transaction amounts grouped by category.

```typescript
// Source: drizzle-orm patterns — verified from existing codebase sql import
import { sql, and, gte, lte, eq } from 'drizzle-orm';

const rows = await db
  .select({
    category: transactions.category,
    total: sql<string>`SUM(${transactions.amountUsd})`,
  })
  .from(transactions)
  .where(
    and(
      eq(transactions.senderUserId, userId),
      gte(transactions.createdAt, startDate),
      lte(transactions.createdAt, endDate),
      // optional: eq(transactions.status, 'confirmed')
    )
  )
  .groupBy(transactions.category);
```

**Note:** `sql` is already exported from `@genie/db` index (verified: `apps/db/src/index.ts` line: `export { eq, and, or, desc, asc, sql, inArray, isNull, isNotNull } from 'drizzle-orm'`).

### Anti-Patterns to Avoid

- **Calling LLM inside `inferCategory`:** The agent already expressed the category in the conversation — keyword matching on a description string is sufficient and faster. An LLM call here adds latency and cost.
- **Putting categorization inside `send-usdc.ts`:** Violates D-07. Must be a separate module called by send-usdc, not embedded.
- **Using `parameters` instead of `inputSchema` in tool definition:** All tools use `inputSchema` (Vercel AI SDK v6 requirement — established pitfall from Phase 4).
- **Blocking on settlement check if DB fails:** Settlement check should be graceful — log error, return empty notices, continue chat.
- **Using `gte`/`lte` on `createdAt` with string dates:** Pass `Date` objects, not strings — Drizzle/postgres-js handles the type conversion correctly.
- **Grouping by nullable `category`:** After D-04 (no nulls), this should be safe, but the `get_spending` tool should filter for `status = 'confirmed'` to avoid pending/expired transactions.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema migration | Custom ALTER TABLE scripts | `drizzle-kit push` | Already established in Phase 2; handles incremental changes |
| Input validation | Custom type checks | Zod `inputSchema` | All tools already use this; type-safe and consistent |
| Verification gating | Per-tool auth logic | `requireVerified(userContext)` | Established in Phase 3; single source of truth |
| Date aggregation SQL | Multiple queries per category | Single `GROUP BY` with `SUM` | DB does the work in one query |
| Keyword detection for categories | External NLP service | Simple `regex` / `includes` | The categories are narrow and well-defined; regex is deterministic and has no latency |

**Key insight:** This phase adds application logic on top of a solid infrastructure. The complexity is in correctness (debt direction, settlement matching) not in new systems.

---

## Common Pitfalls

### Pitfall 1: Settlement Matching on Direction
**What goes wrong:** Auto-settlement logic settles debts where the owner owes the counterparty (I-owe direction), which is wrong — only "they owe me" debts should be auto-settled by incoming transfers.
**Why it happens:** Query doesn't filter on `iOwe = false`.
**How to avoid:** Settlement check MUST include `where iOwe = false AND settled = false` in the open debts query.
**Warning signs:** Test "I owe Bob $20, Bob sends me $20 → Bob's debt gets settled" — should NOT auto-settle.

### Pitfall 2: Amount Comparison on Numeric Strings
**What goes wrong:** Drizzle returns `amountUsd` as a `string` (Postgres `numeric` -> JS string). Comparing with `===` on numbers fails.
**Why it happens:** `numeric` type in Drizzle is always `string` in JS. Confirmed in schema.test.ts: `expect(user.autoApproveUsd).toBe('25.00')`.
**How to avoid:** Parse with `parseFloat()` before arithmetic comparison in settlement tolerance check: `Math.abs(parseFloat(debt.amountUsd) - parseFloat(tx.amountUsd)) <= TOLERANCE`.
**Warning signs:** Settlement never matches even with exact amounts.

### Pitfall 3: Context Injection for Settlement Notices
**What goes wrong:** Settlement notices aren't surfaced to the agent, so the agent can't mention them at conversation start.
**Why it happens:** `assembleContext` doesn't know about settlements unless explicitly passed.
**How to avoid:** The simplest approach: append settlement info to the user context injection string in `assembleContext`, or add a `pendingSettlements` field to `UserContext` and handle it in the injection. Do NOT try to inject as a separate message — the existing context structure (user-ctx injection + ack + history + current message) is established and tested.

### Pitfall 4: Missing `status = 'confirmed'` Filter in Spending Queries
**What goes wrong:** Pending and expired transactions inflate spending totals.
**Why it happens:** The `transactions` table has a `status` column with values `confirmed`, `pending`, `expired`. `get_spending` must only sum `confirmed` transactions.
**How to avoid:** Add `eq(transactions.status, 'confirmed')` to the `get_spending` WHERE clause.

### Pitfall 5: Null Category Breaks GROUP BY
**What goes wrong:** If any transaction has `category = NULL`, it groups separately as NULL in the aggregation result and may confuse the agent's response formatting.
**Why it happens:** The `category` column is nullable (D-05 spec), even though D-04 says "no nulls in practice". Historical transactions from Phase 4 will have `category = NULL`.
**How to avoid:** Use `COALESCE(category, 'transfers')` in the SELECT: `sql\`COALESCE(${transactions.category}, 'transfers')\`` — or filter `isNotNull(transactions.category)` for spending queries. Both are exported from `@genie/db`.

### Pitfall 6: `send_usdc` description parameter and categorization coupling
**What goes wrong:** The agent calls `send_usdc` but doesn't know to pass a description, so `inferCategory` always falls back to `transfers`.
**Why it happens:** The existing `send_usdc` `inputSchema` has only `recipientAddress` and `amountUsd`. Without a `description` field, `inferCategory` has no input.
**How to avoid:** Add optional `description?: z.string()` to `send_usdc` `inputSchema`. Update the system prompt to instruct the agent to always include a description when sending (e.g., "send $30 to Alice for dinner" → description: "dinner"). The agent will naturally fill this from conversation context.

---

## Code Examples

### Schema Extension (verified Drizzle pattern)

```typescript
// apps/db/src/schema.ts — add to existing tables
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderUserId: uuid('sender_user_id').notNull().references(() => users.id),
  recipientWallet: text('recipient_wallet').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  txHash: text('tx_hash'),
  status: text('status').notNull().default('confirmed'),
  expiresAt: timestamp('expires_at'),
  category: text('category'),                              // NEW: SPND-01 (nullable)
  source: text('source').notNull().default('genie_send'),  // NEW: D-06
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const debts = pgTable('debts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  counterpartyWallet: text('counterparty_wallet').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  settled: boolean('settled').notNull().default(false),
  iOwe: boolean('i_owe').notNull().default(false),         // NEW: D-08
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Tool Registration in agent/index.ts (verified pattern)

```typescript
// apps/api/src/agent/index.ts — add to tools spread
import { createCreateDebtTool } from '../tools/create-debt';
import { createListDebtsTool } from '../tools/list-debts';
import { createGetSpendingTool } from '../tools/get-spending';

// Inside runAgent(), after sendUsdcTool:
const createDebtTool = request.userId
  ? createCreateDebtTool(request.userId, resolvedUserContext)
  : undefined;
const listDebtsTool = request.userId
  ? createListDebtsTool(request.userId, resolvedUserContext)
  : undefined;
const getSpendingTool = request.userId
  ? createGetSpendingTool(request.userId)
  : undefined;

// In streamText tools spread:
tools: {
  // ... existing tools ...
  ...(createDebtTool ? { create_debt: createDebtTool } : {}),
  ...(listDebtsTool ? { list_debts: listDebtsTool } : {}),
  ...(getSpendingTool ? { get_spending: getSpendingTool } : {}),
},
```

### Debt Auto-Settlement Integration in chat.ts (verified pattern)

```typescript
// apps/api/src/routes/chat.ts — after fetchUserContext()
import { checkAndSettleDebts } from '../agent/settlement';

// In chatRoute.post('/chat'):
const userContext = userId ? await fetchUserContext(userId) : undefined;

// Check and settle debts if user is authenticated
let settlementNotices: SettlementNotice[] = [];
if (userId && userContext) {
  settlementNotices = await checkAndSettleDebts(userId, userContext.walletAddress);
}

// Pass notices to runAgent (extend ChatRequest interface)
const result = await runAgent({ messages, userId, userContext, settlementNotices });
```

### Drizzle Aggregation for Spending (verified imports)

```typescript
// Source: apps/db/src/index.ts exports confirmed — sql, and, gte, lte, eq all available
import { db, transactions, sql, and, gte, lte, eq, isNotNull } from '@genie/db';

const rows = await db
  .select({
    category: sql<string>`COALESCE(${transactions.category}, 'transfers')`,
    total: sql<string>`SUM(${transactions.amountUsd})`,
  })
  .from(transactions)
  .where(
    and(
      eq(transactions.senderUserId, userId),
      eq(transactions.status, 'confirmed'),
      gte(transactions.createdAt, startDate),
      lte(transactions.createdAt, endDate),
    )
  )
  .groupBy(sql`COALESCE(${transactions.category}, 'transfers')`);
```

### Vi.mock Pattern for New DB Tables (verified from existing tests)

```typescript
// Established vi.mock pattern for new tools (from resolve-contact.test.ts)
vi.mock('@genie/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  debts: {},
  transactions: {},
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn(),
}));
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `parameters` in AI SDK tool | `inputSchema` (Zod) | AI SDK v6 | Must use `inputSchema` — established Phase 4 pitfall |
| `pipeDataStreamToResponse` | `toUIMessageStreamResponse()` | AI SDK v6 + Bun/Hono | All routes use `toUIMessageStreamResponse()` |
| `maxSteps` | `stopWhen: stepCountIs(5)` | AI SDK v6 | Already applied in agent/index.ts |
| Migration files (drizzle-kit) | `drizzle-kit push` / `pushSchema.apply()` | Phase 2 decision | No migration files — schema sync only |

---

## Open Questions

1. **How does settlement detection discover "incoming" transfers?**
   - What we know: The `transactions` table only stores outgoing sends (`senderUserId` is our user). Incoming transfers from other Genie users appear as their outgoing send — we'd need to query where `recipientWallet = ownerWallet`.
   - What's unclear: The current schema doesn't have a "received by userId" column — incoming transfers are only visible via `recipientWallet` lookup. The debts table has `counterpartyWallet`, which is the address of the other party.
   - Recommendation: Query transactions WHERE `recipientWallet = ownerWalletAddress AND createdAt >= (settlement check window)`. This covers Genie-to-Genie transfers. For external transfers (non-Genie senders), we'd need to either (a) query the chain via `publicClient` for USDC Transfer events, or (b) keep settlement simple: only match Genie-recorded transactions. **Recommend option (b) for hackathon scope** — only settle against transactions recorded in our own DB, which covers the demo scenario.

2. **Where does the settlement check window start?**
   - What we know: No "last checked" timestamp exists.
   - What's unclear: Do we check all time, last 24h, or since the debt was created?
   - Recommendation: Check transactions created AFTER the debt was created (`tx.createdAt >= debt.createdAt`). This prevents false positives from old transfers.

3. **Should `get_spending` include incoming transfers (received money) or only outgoing sends?**
   - What we know: D-03 says both outgoing and incoming transactions are categorized. But `get_spending` uses `senderUserId` for outgoing.
   - What's unclear: SPND-02 says "how much did I spend" — implies outgoing only for spending queries.
   - Recommendation: `get_spending` queries `senderUserId = userId` (outgoing only). A separate "received" summary would be a different tool/query. Keep it simple for hackathon.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — this phase uses only existing infrastructure: Postgres/Supabase, Drizzle ORM, Vercel AI SDK, and viem, all already present and operational from prior phases).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd /Users/kerem/genie/apps/api && pnpm test` |
| Full suite command | `cd /Users/kerem/genie/apps/api && pnpm test && cd /Users/kerem/genie/apps/db && pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPND-01 | `inferCategory` returns correct category for known keywords | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/categorize.test.ts` |
| SPND-01 | `inferCategory` defaults to `transfers` when no match | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/categorize.test.ts` |
| SPND-01 | `send_usdc` calls `inferCategory` and stores `category` column | unit | `pnpm test` (apps/api) | ❌ Wave 0: update `tools/send-usdc.test.ts` |
| SPND-01 | Schema has `category` and `source` columns on transactions | unit | `pnpm test` (apps/db) | ❌ Wave 0: update `schema.test.ts` |
| SPND-02 | `get_spending` returns aggregated amounts per category for a date range | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/get-spending.test.ts` |
| SPND-02 | `get_spending` only sums `confirmed` transactions | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/get-spending.test.ts` |
| SPND-02 | `get_spending` treats null category as `transfers` (COALESCE) | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/get-spending.test.ts` |
| DEBT-01 | `create_debt` returns VERIFICATION_REQUIRED for unverified users | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/create-debt.test.ts` |
| DEBT-01 | `create_debt` inserts debt with correct `iOwe` direction flag | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/create-debt.test.ts` |
| DEBT-01 | `list_debts` returns open debts with direction and description | unit | `pnpm test` (apps/api) | ❌ Wave 0: `tools/list-debts.test.ts` |
| DEBT-01 | Schema has `iOwe` column on debts table | unit | `pnpm test` (apps/db) | ❌ Wave 0: update `schema.test.ts` |
| DEBT-02 | `checkAndSettleDebts` matches incoming transfer by wallet + amount tolerance | unit | `pnpm test` (apps/api) | ❌ Wave 0: `agent/settlement.test.ts` |
| DEBT-02 | `checkAndSettleDebts` does NOT settle debts where `iOwe = true` | unit | `pnpm test` (apps/api) | ❌ Wave 0: `agent/settlement.test.ts` |
| DEBT-02 | `checkAndSettleDebts` marks matched debt as `settled = true` | unit | `pnpm test` (apps/api) | ❌ Wave 0: `agent/settlement.test.ts` |
| DEBT-02 | `checkAndSettleDebts` returns empty array gracefully when DB fails | unit | `pnpm test` (apps/api) | ❌ Wave 0: `agent/settlement.test.ts` |

### Sampling Rate

- **Per task commit:** `cd /Users/kerem/genie/apps/api && pnpm test`
- **Per wave merge:** `cd /Users/kerem/genie/apps/api && pnpm test && cd /Users/kerem/genie/apps/db && pnpm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/tools/categorize.ts` + `categorize.test.ts` — covers SPND-01
- [ ] `apps/api/src/tools/create-debt.ts` + `create-debt.test.ts` — covers DEBT-01
- [ ] `apps/api/src/tools/list-debts.ts` + `list-debts.test.ts` — covers DEBT-01
- [ ] `apps/api/src/tools/get-spending.ts` + `get-spending.test.ts` — covers SPND-02
- [ ] `apps/api/src/agent/settlement.ts` + `settlement.test.ts` — covers DEBT-02
- [ ] Update `apps/db/src/schema.ts` — add `category`, `source`, `iOwe` columns
- [ ] Update `apps/db/src/schema.test.ts` — verify new columns exist
- [ ] Update `apps/api/src/tools/send-usdc.ts` — add optional `description` param + call `inferCategory`
- [ ] Update `apps/api/src/tools/send-usdc.test.ts` — verify category is stored
- [ ] Update `apps/api/src/agent/index.ts` — register three new tools
- [ ] Update `apps/api/src/routes/chat.ts` — run settlement check before runAgent
- [ ] Update `apps/api/src/prompts/system.md` — mention spending tracking and debt capabilities

---

## Project Constraints (from CLAUDE.md)

CLAUDE.md does not exist in the project root (`/Users/kerem/genie/CLAUDE.md` — file not found). No project-level directives to enforce beyond what is captured in CONTEXT.md and STATE.md.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `apps/db/src/schema.ts` — confirmed existing table columns, types, and defaults
- Direct codebase inspection: `apps/api/src/tools/send-usdc.ts` — tool factory pattern, verification gating, DB insert pattern
- Direct codebase inspection: `apps/api/src/tools/require-verified.ts` — guard interface
- Direct codebase inspection: `apps/api/src/agent/context.ts` — UserContext interface, assembleContext
- Direct codebase inspection: `apps/api/src/agent/index.ts` — tool registration pattern, ChatRequest interface
- Direct codebase inspection: `apps/api/src/routes/chat.ts` — fetchUserContext, contextCache, chatRoute integration point
- Direct codebase inspection: `apps/db/src/index.ts` — confirmed exported Drizzle operators (sql, and, gte, lte, eq, etc.)
- Direct codebase inspection: `apps/db/src/schema.test.ts` — PGlite + pushSchema pattern, numeric-as-string confirmation
- Direct codebase inspection: `apps/api/vitest.config.ts` — confirmed test env vars and runner
- Direct codebase inspection: `apps/api/package.json` — confirmed all dependencies present, `vitest run` command

### Secondary (MEDIUM confidence)

- `apps/api/src/tools/send-usdc.test.ts` and `resolve-contact.test.ts` — confirmed vi.mock patterns for @genie/db
- `.planning/phases/05-cross-chain-social/05-CONTEXT.md` — locked decisions D-01 through D-16
- `.planning/STATE.md` — accumulated context from all prior phases

### Tertiary (LOW confidence)

- None. All findings derived from direct codebase inspection.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified from package.json, no new packages needed
- Architecture: HIGH — patterns verified from existing codebase
- Schema extension: HIGH — Drizzle pattern confirmed from schema.ts and schema.test.ts
- Settlement detection: MEDIUM — design is sound but the "incoming transfer" query approach (recipientWallet lookup) has an open question about coverage scope
- Pitfalls: HIGH — all verified from existing code patterns and schema behavior

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable stack, no fast-moving dependencies)
