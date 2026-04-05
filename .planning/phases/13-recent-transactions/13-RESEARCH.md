# Phase 13: Recent Transactions - Research

**Researched:** 2026-04-05
**Domain:** Hono REST endpoint + Drizzle ORM + React hook + DashboardInterface wiring
**Confidence:** HIGH

## Summary

Phase 13 is a pure data-wiring phase. The transaction list UI already exists in DashboardInterface (lines 132-151) and is fully styled. The database schema already has every required field. The only work is: (1) a new Hono GET route that queries the transactions table with dual-direction logic and returns a formatted response, (2) a `useTransactions` hook modelled on `useBalance`, and (3) swapping `MOCK_TRANSACTIONS` for the hook's output with minor shape adaptation.

The backend query must handle two directions: sent = rows where `senderUserId = userId`, received = rows where `recipientWallet = user.walletAddress`. Because the transactions table only records `senderUserId` (not `recipientUserId`), determining "received" requires resolving the userId to a walletAddress first, then querying by `recipientWallet`. The CONTEXT.md decisions lock this: combine in JS, sort by `createdAt DESC`, limit 20, confirmed only.

SPND-01 ("Agent categorizes transactions") is fully satisfied by Phase 12's `inferCategory` call at insert time — the `category` field is already being written. Phase 13 just surfaces it in the response and displays it as secondary text. No new categorization logic is needed.

**Primary recommendation:** Build `GET /api/transactions?userId=` using two Drizzle queries merged and sorted in JS (simpler than UNION SQL). Model the hook on `useBalance`. Display `category` as `text-white/40` secondary text beneath the label.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Sent: `senderUserId = userId`. Received: `recipientWallet = user.walletAddress`. Combine and sort by `createdAt` descending.
- **D-02:** Each transaction includes `direction: "sent" | "received"`.
- **D-03:** `GET /api/transactions?userId={uuid}` Hono route, userId is required query param.
- **D-04:** `limit` query param, default 20, max 50. No cursor pagination.
- **D-05:** Only `status = 'confirmed'` transactions. Pending/expired excluded.
- **D-06:** Response shape: `{ transactions: Array<{ id, direction, label, amount, category, timestamp, txHash }> }`. `amount` is formatted string (e.g., `"$10.00"`), `label` is "Sent to 0x…a1f2" / "Received from 0x…b3c4", `timestamp` is ISO string.
- **D-07:** Label format: "Sent to [0x…last4]" / "Received from [0x…last4]" — truncated wallet, no contact name resolution.
- **D-08:** Amount: `$X.XX` with dollar sign, 2 decimal places. Sent prefixed `-`, received `+`.
- **D-09:** Frontend converts ISO timestamp to relative ("Today", "Yesterday", "2 days ago").
- **D-10:** `category` field included (nullable). Dashboard shows it as subtle secondary text if present.
- **D-11:** No category filtering or category icons.

### Claude's Discretion
- Whether to use a single SQL UNION or two separate Drizzle queries merged in JS
- Loading skeleton style (match balance skeleton from Phase 11)
- Empty state message when no transactions exist
- Whether to create a `useTransactions` hook or inline the fetch in DashboardInterface

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SPND-01 | Agent categorizes transactions (food, transport, entertainment, bills, transfers) | Category is already written to DB by `inferCategory` in send route. This phase surfaces it in GET response (D-10) and displays in UI. No new categorization code needed — the stored value is exposed. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` | existing | HTTP route handler | All existing API routes use Hono |
| `@genie/db` | workspace | Drizzle ORM + schema + query helpers | Project-standard DB access layer |
| `drizzle-orm` | existing | `eq`, `and`, `or`, `desc` query builders | Already used in get-spending; `desc` exported from `@genie/db` |
| `next-auth/react` | existing | `useSession()` for userId + walletAddress | DashboardInterface already imports this |
| `react` | existing | `useState`, `useEffect`, `useCallback` | Hook pattern follows `useBalance` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | existing | Unit tests for the new route | Every route has a `.test.ts` sibling — match the pattern |

**Installation:** None required — all dependencies are already present.

## Architecture Patterns

### Recommended Project Structure
```
apps/api/src/routes/
├── transactions.ts       # NEW: GET /api/transactions handler
├── transactions.test.ts  # NEW: vitest tests (same pattern as send.test.ts)
├── balance.ts            # existing reference
└── send.ts               # existing reference

apps/web/src/hooks/
├── useTransactions.ts    # NEW: mirrors useBalance structure
└── useBalance.ts         # existing reference

apps/api/src/index.ts     # MODIFY: add transactionsRoute import + mount
apps/web/src/components/DashboardInterface/index.tsx  # MODIFY: replace MOCK_TRANSACTIONS
```

### Pattern 1: Hono GET Route (from balance.ts)
**What:** Named export `const xRoute = new Hono()`, handler validates query param, try/catch, `c.json()`.
**When to use:** Every API route in this project.
**Example:**
```typescript
// Source: apps/api/src/routes/balance.ts
import { Hono } from 'hono';
export const transactionsRoute = new Hono();

transactionsRoute.get('/', async (c) => {
  const userId = c.req.query('userId');
  if (!userId) return c.json({ error: 'userId is required' }, 400);
  // ...
  return c.json({ transactions: [...] });
});
```

### Pattern 2: Two Drizzle Queries Merged in JS (recommended over UNION)
**What:** Run sent query and received query separately, concatenate arrays, sort by `createdAt` descending, slice to limit.
**When to use:** Avoids complex Drizzle UNION syntax; simpler to mock in tests.

The received query requires first fetching `user.walletAddress` from `users` table, then querying `transactions.recipientWallet`.

```typescript
// Source: apps/db/src/index.ts + apps/api/src/tools/get-spending.ts
import { db, transactions, users, eq, and, desc } from '@genie/db';

// Step 1: resolve walletAddress from userId
const [user] = await db.select({ walletAddress: users.walletAddress })
  .from(users).where(eq(users.id, userId)).limit(1);
if (!user) return c.json({ error: 'User not found' }, 404);

// Step 2: sent transactions
const sent = await db.select().from(transactions)
  .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'confirmed')))
  .orderBy(desc(transactions.createdAt))
  .limit(limit);

// Step 3: received transactions
const received = await db.select().from(transactions)
  .where(and(eq(transactions.recipientWallet, user.walletAddress), eq(transactions.status, 'confirmed')))
  .orderBy(desc(transactions.createdAt))
  .limit(limit);

// Step 4: merge, sort, slice
const all = [...sent.map(tx => ({...tx, direction: 'sent'})),
             ...received.map(tx => ({...tx, direction: 'received'}))]
  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  .slice(0, limit);
```

### Pattern 3: useTransactions Hook (mirrors useBalance)
**What:** `useState` + `useEffect` + `useCallback`, takes `userId` param, calls `GET /api/transactions?userId=`.
**When to use:** DashboardInterface needs `transactions`, `loading`, `error` state.

```typescript
// Source: apps/web/src/hooks/useBalance.ts (pattern to replicate)
export function useTransactions(userId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchTransactions = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${API_URL}/api/transactions?userId=${userId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { transactions: Transaction[] };
      setTransactions(data.transactions);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);
  return { transactions, loading, error, refetch: fetchTransactions };
}
```

### Pattern 4: Response Shape Formatting
**What:** Format before returning from the route so the frontend gets pre-formatted strings.

```typescript
// D-06, D-07, D-08 applied in route handler
function formatLabel(direction: 'sent' | 'received', wallet: string): string {
  const truncated = wallet.slice(0, 4) + '…' + wallet.slice(-4);
  return direction === 'sent' ? `Sent to ${truncated}` : `Received from ${truncated}`;
}

function formatAmount(direction: 'sent' | 'received', amountUsd: string): string {
  const prefix = direction === 'sent' ? '-' : '+';
  return `${prefix}$${parseFloat(amountUsd).toFixed(2)}`;
}
```

### Pattern 5: DashboardInterface Integration (lines 14-18 and 132-151)
**What:** Replace `MOCK_TRANSACTIONS` constant with `useTransactions` hook data. Adapt `positive` field to `direction === 'received'`. Add loading skeleton + empty state.

```typescript
// Replace line 14-18 (MOCK_TRANSACTIONS) with:
const userId = session?.user?.id ?? '';
const { transactions, loading: txLoading } = useTransactions(userId);

// Replace lines 133-151 mapping with real data:
// tx.positive = (tx.direction === 'received')
// Add category as secondary text: <p className="text-[11px] text-white/40">{tx.category ?? tx.time}</p>
// Or show both: time + category on separate lines
```

### Pattern 6: Route Registration (index.ts)
**What:** Add import and `app.route()` call in `apps/api/src/index.ts`.

```typescript
// Source: apps/api/src/index.ts pattern
import { transactionsRoute } from './routes/transactions';
app.route('/api/transactions', transactionsRoute);
```

### Anti-Patterns to Avoid
- **Self-join for received:** Don't try to find received by joining transactions on senderUserId. The schema stores recipient as a wallet address only, not a userId. Always resolve userId → walletAddress first.
- **Including pending/expired:** D-05 locks this — only `status = 'confirmed'`. The pending confirmation flow and bridge in-progress states must be excluded.
- **Returning raw DB timestamps:** D-06 says ISO string. `createdAt` from Drizzle is already a JS `Date` — call `.toISOString()` when mapping.
- **Inlining fetch in DashboardInterface:** Create `useTransactions` hook for testability and consistency with `useBalance`.
- **Skipping limit on the combined array:** Each individual query fetches up to `limit` rows, but merged could return up to `2 * limit`. Always slice the combined array to `limit` after sorting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Wallet truncation | Custom regex/substring | `wallet.slice(0, 4) + '…' + wallet.slice(-4)` | Simple direct string ops, no library needed |
| Relative time formatting | Custom date diff logic | Inline JS (match existing MOCK_TRANSACTIONS style: "Today", "Yesterday", "N days ago") | Only three cases needed; no moment.js/date-fns required |
| Category inference | Any new logic | Already stored by `inferCategory` at send time | SPND-01 is already satisfied at write time |
| DB connection | Any new client setup | `db` from `@genie/db` | All routes share the same pool |

**Key insight:** This phase is 100% data-wiring — no new infrastructure, no new libraries, no algorithmic complexity.

## Common Pitfalls

### Pitfall 1: Received transactions need walletAddress, not userId
**What goes wrong:** Querying `transactions.recipientWallet = userId` (a UUID) always returns zero rows because `recipientWallet` stores `0x...` addresses.
**Why it happens:** The transactions table was designed with a sender FK (`senderUserId`) but stores the recipient as a plain wallet string (FOPS-03 pattern — recipient resolved at send time).
**How to avoid:** Always fetch the user row first (`users.walletAddress`) then query `transactions.recipientWallet = user.walletAddress`.
**Warning signs:** Received array always empty in tests.

### Pitfall 2: A user can both send to and receive from the same wallet, creating duplicates
**What goes wrong:** A transaction sent to self (unlikely but possible) would appear in both sent and received arrays.
**Why it happens:** Two independent queries without deduplication.
**How to avoid:** Deduplicate by `id` after merging (use a `Map<string, tx>` keyed on `id`).

### Pitfall 3: `createdAt` comparison fails if kept as string
**What goes wrong:** Sorting merged array by `createdAt` fails or produces wrong order if comparing Date objects from one query against each other without `.getTime()`.
**Why it happens:** Drizzle returns `Date` objects. Comparing dates with `>` works but `b - a` requires `.getTime()`.
**How to avoid:** Use `b.createdAt.getTime() - a.createdAt.getTime()` in the sort comparator.

### Pitfall 4: Forgetting to include `category` in the select projection
**What goes wrong:** `category` is `null` in every response row even when the DB has data.
**Why it happens:** If using a partial `.select({ id, senderUserId, ... })` projection, `category` must be explicitly listed.
**How to avoid:** Use `db.select()` without projection (returns all columns) OR explicitly include `category: transactions.category`.

### Pitfall 5: Empty state not handled in UI
**What goes wrong:** DashboardInterface renders nothing (blank section) when `transactions` array is empty.
**Why it happens:** `MOCK_TRANSACTIONS` always had 3 items; the hook returns `[]` for new users.
**How to avoid:** Add an empty state: `<p className="text-sm text-white/40 py-4">No transactions yet.</p>`.

### Pitfall 6: Loading state shows old mock data
**What goes wrong:** During initial load, the UI flickers between no data or blank.
**Why it happens:** Hook starts with `[]` not `MOCK_TRANSACTIONS`.
**How to avoid:** Show skeleton rows (matching balance skeleton: `bg-white/10 animate-pulse rounded`) while `txLoading` is true.

## Code Examples

### Full route outline
```typescript
// apps/api/src/routes/transactions.ts
import { Hono } from 'hono';
import { db, transactions, users, eq, and, desc } from '@genie/db';

export const transactionsRoute = new Hono();

transactionsRoute.get('/', async (c) => {
  const userId = c.req.query('userId');
  const limitParam = parseInt(c.req.query('limit') ?? '20', 10);
  const limit = Math.min(isNaN(limitParam) ? 20 : limitParam, 50);

  if (!userId) {
    return c.json({ error: 'MISSING_USER_ID', message: 'userId query param is required' }, 400);
  }

  try {
    const [user] = await db.select({ walletAddress: users.walletAddress })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return c.json({ error: 'USER_NOT_FOUND' }, 404);

    const [sent, received] = await Promise.all([
      db.select().from(transactions)
        .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'confirmed')))
        .orderBy(desc(transactions.createdAt)).limit(limit),
      db.select().from(transactions)
        .where(and(eq(transactions.recipientWallet, user.walletAddress), eq(transactions.status, 'confirmed')))
        .orderBy(desc(transactions.createdAt)).limit(limit),
    ]);

    const dedupeMap = new Map<string, typeof sent[0] & { direction: 'sent' | 'received' }>();
    sent.forEach(tx => dedupeMap.set(tx.id, { ...tx, direction: 'sent' }));
    received.forEach(tx => {
      if (!dedupeMap.has(tx.id)) dedupeMap.set(tx.id, { ...tx, direction: 'received' });
    });

    const merged = Array.from(dedupeMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);

    const result = merged.map(tx => ({
      id: tx.id,
      direction: tx.direction,
      label: tx.direction === 'sent'
        ? `Sent to ${tx.recipientWallet.slice(0, 6)}…${tx.recipientWallet.slice(-4)}`
        : `Received from ${tx.recipientWallet.slice(0, 6)}…${tx.recipientWallet.slice(-4)}`,
      amount: tx.direction === 'sent'
        ? `-$${parseFloat(tx.amountUsd).toFixed(2)}`
        : `+$${parseFloat(tx.amountUsd).toFixed(2)}`,
      category: tx.category ?? null,
      timestamp: tx.createdAt.toISOString(),
      txHash: tx.txHash ?? null,
    }));

    return c.json({ transactions: result });
  } catch (err) {
    console.error('[route:transactions] error:', err);
    return c.json({ error: 'FETCH_FAILED', message: 'Could not retrieve transactions' }, 500);
  }
});
```

### Relative time helper (frontend, D-09)
```typescript
// Inline in DashboardInterface or useTransactions — no library needed
function toRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}
```

### Loading skeleton (match balance pattern)
```tsx
// Source: apps/web/src/components/DashboardInterface/index.tsx lines 95-97
{txLoading ? (
  <div className="flex flex-col divide-y divide-white/5">
    {[1, 2, 3].map(i => (
      <div key={i} className="flex items-center justify-between py-4">
        <div className="h-4 w-32 bg-white/10 animate-pulse rounded" />
        <div className="h-4 w-16 bg-white/10 animate-pulse rounded" />
      </div>
    ))}
  </div>
) : transactions.length === 0 ? (
  <p className="text-sm text-white/40 py-4">No transactions yet.</p>
) : (
  // ...existing map
)}
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npx vitest run src/routes/transactions.test.ts` |
| Full suite command | `cd apps/api && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SPND-01 | `category` field present in response (nullable, from DB) | unit | `cd apps/api && npx vitest run src/routes/transactions.test.ts` | Wave 0 |
| D-03 | Missing userId returns 400 | unit | same | Wave 0 |
| D-04 | limit param respected (default 20, max 50) | unit | same | Wave 0 |
| D-05 | Only confirmed transactions returned | unit | same | Wave 0 |
| D-06 | Response shape matches spec (id, direction, label, amount, category, timestamp, txHash) | unit | same | Wave 0 |
| D-01 | Sent direction set for senderUserId match | unit | same | Wave 0 |
| D-01 | Received direction set for recipientWallet match | unit | same | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run src/routes/transactions.test.ts`
- **Per wave merge:** `cd apps/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/routes/transactions.test.ts` — covers all D-01 through D-06, SPND-01 surface
- [ ] `apps/web/src/hooks/useTransactions.ts` — no test file needed (hook is trivial fetch wrapper, tested indirectly via manual UI verification)

## Environment Availability

Step 2.6: SKIPPED (no external dependencies beyond what is already available — all DB, Hono, and React infrastructure is established in prior phases).

## Sources

### Primary (HIGH confidence)
- `apps/db/src/schema.ts` — exact column names, types, nullability for transactions table
- `apps/db/src/index.ts` — confirms `desc`, `or`, `and`, `eq` exported from `@genie/db`
- `apps/api/src/routes/balance.ts` — canonical Hono route pattern
- `apps/api/src/routes/send.ts` — shows how transactions are inserted; `inferCategory` called at insert
- `apps/api/src/tools/get-spending.ts` — shows confirmed-only filter pattern, Drizzle query structure
- `apps/web/src/hooks/useBalance.ts` — exact hook pattern to replicate
- `apps/web/src/components/DashboardInterface/index.tsx` — identifies exact lines to modify
- `apps/api/src/index.ts` — shows how to mount the new route
- `apps/api/src/routes/send.test.ts` — canonical test structure to replicate

### Secondary (MEDIUM confidence)
- `apps/api/vitest.config.ts` — confirmed vitest setup, test environment, and env vars

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use; no new dependencies
- Architecture: HIGH — direct code inspection of all canonical files
- Pitfalls: HIGH — derived from schema analysis and existing code inspection
- Test patterns: HIGH — existing `.test.ts` files confirm exact mock pattern

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable — no external API dependencies)
