# Phase 02: Data Layer - Research

**Researched:** 2026-04-04
**Domain:** Supabase + Drizzle ORM (structured data) + 0G Storage KV (agent memory)
**Confidence:** MEDIUM (Drizzle/Supabase HIGH; 0G KV SDK MEDIUM — thin docs, write path requires ethers wallet)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Users table uses UUID as primary key, wallet address as required unique column, World ID as nullable column (added when user verifies in Phase 3)
- **D-02:** Contacts table links to other Genie users by wallet match when possible, with fallback to raw address + display name for external wallets
- **D-03:** Transactions table tracks only Genie-initiated transfers — no on-chain indexing of external transactions
- **D-04:** Schema synced via `drizzle-kit push` (no migration files) — fastest iteration for hackathon
- **D-05:** Agent memory stores financial profile, interaction preferences, and active savings/budget goals with progress
- **D-06:** Single JSON blob per user under one KV key (e.g., `user:{uuid}:memory`) — simple read/write pattern
- **D-07:** Memory written after key moments (new goal set, preference stated, profile change) — not every turn, not only at session end
- **D-08:** Context loaded once at conversation start, cached for the session duration
- **D-09:** Cache invalidated and re-fetched when a certain time has passed since the last conversation
- **D-10:** Chat route is responsible for fetching context — checks for cached context first, fetches from Supabase + 0G KV if none exists
- **D-11:** KV memory merged into the existing user context injection message (extends the `[User context: ...]` string in `assembleContext`)
- **D-12:** User record created in Supabase after completing the onboarding flow (not on app open or first chat)
- **D-13:** Two-page onboarding: (1) product intro page, (2) agent spending limit setup page
- **D-14:** Username and wallet address come from World App connection; spending limit is user-set during onboarding
- **D-15:** Initial 0G KV memory blob created at onboarding completion with defaults — agent memory ready from first chat

### Claude's Discretion

- Drizzle schema column types and constraints beyond what's specified
- KV key naming convention details
- Cache TTL duration for context invalidation
- Default values for initial KV memory blob fields
- How "key moments" are detected for memory writes (tool-based vs heuristic)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGEN-07 | 0G Storage KV persists user context (financial personality, goals, preferences) across sessions | Covered by 0G KV SDK research (read/write patterns, Batcher + KvClient), context loading flow (D-08 through D-11), and session cache design |

</phase_requirements>

---

## Summary

Phase 2 delivers the persistence layer for Genie: Supabase (via Drizzle ORM) for structured relational data, and 0G Storage KV for mutable per-user agent memory. These two systems are independent but both feed the context loading flow that the chat route will own.

The Drizzle + Supabase path is well-documented and straightforward. Use `drizzle-orm` with the `postgres` driver (transaction pooler mode, `prepare: false`), define the schema in TypeScript, and apply with `drizzle-kit push` — no migration files, matches D-04. The schema design decisions (UUID PKs, wallet address unique, World ID nullable) map directly to Drizzle's `uuid`, `text`, and nullable column patterns.

The 0G KV path requires more care. Writing requires an ethers wallet signer plus a Batcher abstraction that talks to storage nodes on-chain (gas fees apply). Reading is simpler — a `KvClient` instance pointing at a KV node HTTP endpoint. The hackathon should use the 0G testnet (evmRpc: `https://evmrpc-testnet.0g.ai`, indexer: `https://indexer-storage-testnet-turbo.0g.ai`). The KV client endpoint for reads is a known public node at `http://3.101.147.150:6789`, but a proper testnet KV node endpoint may need to be confirmed at hackathon time.

**Primary recommendation:** Wire Drizzle schema first (zero external dependencies, pure TypeScript), then layer in 0G KV service with fallback-safe design so the agent still works if KV is unavailable.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.2 | TypeScript ORM for PostgreSQL schema + queries | Type-safe, schema-as-code, drizzle-kit push fits hackathon speed |
| drizzle-kit | 0.31.10 | Schema push / migration tooling | `drizzle-kit push` syncs schema without migration files |
| postgres | 3.4.8 | PostgreSQL driver for Node.js | Native ESM, works with Drizzle's postgres dialect |
| @0glabs/0g-ts-sdk | 0.3.3 | 0G Storage KV read/write | Official SDK; `@0gfoundation/0g-ts-sdk` is a mirror package |
| ethers | 6.16.0 | Wallet/signer for 0G KV writes (gas) | Required peer dep of 0g-ts-sdk; v6 already in ecosystem |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @electric-sql/pglite | 0.4.3 | In-memory Postgres for Vitest tests | Eliminates Docker for schema/query tests |
| dotenv | latest | Env var loading in scripts | Only for drizzle.config.ts, not runtime (node --env-file) |
| @supabase/supabase-js | 2.101.1 | Supabase client (auth, storage helpers) | NOT needed for this phase — Drizzle connects directly to Postgres |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| postgres (driver) | pg / node-postgres | `postgres` is lighter, native ESM; `pg` requires extra adapter |
| drizzle-kit push | migration files | Migration files are safer long-term but slow for hackathon iteration |
| @0glabs/0g-ts-sdk | @0gfoundation/0g-ts-sdk | Same codebase, different npm org — either works; use `@0glabs` (original) |

**Installation:**
```bash
# In apps/api
npm install drizzle-orm postgres @0glabs/0g-ts-sdk ethers
npm install -D drizzle-kit @electric-sql/pglite
```

**Version verification:** Versions confirmed via `npm view` on 2026-04-04.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/api/src/
├── db/
│   ├── schema.ts          # Drizzle table definitions (users, contacts, transactions, debts)
│   ├── client.ts          # drizzle() instance, exported as `db`
│   └── index.ts           # re-export db + schema
├── kv/
│   ├── client.ts          # KvClient + Batcher factory (reads + writes)
│   ├── memory.ts          # AgentMemory type + read/write helpers
│   └── index.ts           # re-export
├── routes/
│   └── chat.ts            # Extended: context fetch + cache logic (D-10)
├── agent/
│   └── context.ts         # Extended: UserContext + assembleContext with KV fields (D-11)
└── tools/                 # Existing — memory write tool lives here (D-07)
```

### Pattern 1: Drizzle Schema Definition

**What:** TypeScript schema using pgTable with UUID PK, unique constraints, nullable columns, and foreign keys.
**When to use:** All four tables — users, contacts, transactions, debts.

```typescript
// Source: https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
import { pgTable, uuid, text, numeric, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),            // D-01
  walletAddress: text('wallet_address').notNull().unique(), // D-01
  worldId: text('world_id'),                              // D-01: nullable
  displayName: text('display_name').notNull(),
  autoApproveUsd: numeric('auto_approve_usd', { precision: 10, scale: 2 }).notNull().default('25'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contacts = pgTable('contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  walletAddress: text('wallet_address').notNull(),
  displayName: text('display_name').notNull(),
  genieUserId: uuid('genie_user_id').references(() => users.id), // D-02: nullable, set when matched
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  senderUserId: uuid('sender_user_id').notNull().references(() => users.id),
  recipientWallet: text('recipient_wallet').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  txHash: text('tx_hash'),                                // nullable until confirmed
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const debts = pgTable('debts', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id),
  counterpartyWallet: text('counterparty_wallet').notNull(),
  amountUsd: numeric('amount_usd', { precision: 10, scale: 2 }).notNull(),
  description: text('description'),
  settled: boolean('settled').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

### Pattern 2: Drizzle Client + Connection

**What:** Single `db` export using `postgres` driver with `prepare: false` for Supabase transaction pooler.
**When to use:** All database access in the API.

```typescript
// Source: https://orm.drizzle.team/docs/get-started/supabase-new
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false }); // MUST: pooler transaction mode
export const db = drizzle({ client, schema });
```

### Pattern 3: drizzle.config.ts + Push

**What:** Config file at project root (or apps/api/) for `drizzle-kit push`.
**When to use:** Once during setup; run `npx drizzle-kit push` to apply schema.

```typescript
// Source: https://orm.drizzle.team/docs/get-started/supabase-new
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Pattern 4: 0G KV Write (Batcher)

**What:** Write agent memory to 0G KV using Batcher + streamDataBuilder. Requires ethers signer with gas balance.
**When to use:** After key moments — new goal, preference stated, profile change (D-07).

```typescript
// Source: https://github.com/0glabs/0g-ts-sdk README
import { Indexer, Batcher } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';

const INDEXER_RPC = 'https://indexer-storage-testnet-turbo.0g.ai';
const EVM_RPC = 'https://evmrpc-testnet.0g.ai';
const STREAM_ID = process.env.OG_KV_STREAM_ID!; // hex string, e.g. '0x...'

async function writeMemory(userId: string, memory: AgentMemory): Promise<void> {
  const provider = new ethers.JsonRpcProvider(EVM_RPC);
  const signer = new ethers.Wallet(process.env.OG_PRIVATE_KEY!, provider);
  const indexer = new Indexer(INDEXER_RPC);

  const [nodes, nodesErr] = await indexer.selectNodes(1);
  if (nodesErr) throw new Error(`selectNodes failed: ${nodesErr}`);

  // flowContract is auto-discovered via indexer — pass undefined or leave as-is
  const batcher = new Batcher(1, nodes, undefined, EVM_RPC);

  const key = Uint8Array.from(Buffer.from(`user:${userId}:memory`, 'utf-8'));
  const value = Uint8Array.from(Buffer.from(JSON.stringify(memory), 'utf-8'));
  batcher.streamDataBuilder.set(STREAM_ID, key, value);

  const [tx, err] = await batcher.exec();
  if (err) throw new Error(`KV write failed: ${err}`);
}
```

**RISK:** The `flowContract` parameter requirement is not fully documented. The README example passes a contract instance; the indexer may auto-discover it. This needs a real SDK invocation test at hackathon time. Treat as MEDIUM confidence.

### Pattern 5: 0G KV Read (KvClient)

**What:** Read agent memory from KV using KvClient. No wallet/gas required — read is free.
**When to use:** Once at conversation start (D-08), loaded by chat route (D-10).

```typescript
// Source: https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
import { KvClient } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';

const KV_CLIENT_URL = process.env.OG_KV_CLIENT_URL!; // e.g. http://3.101.147.150:6789

export async function readMemory(userId: string): Promise<AgentMemory | null> {
  const kvClient = new KvClient(KV_CLIENT_URL);
  const streamId = process.env.OG_KV_STREAM_ID!;
  const key = Uint8Array.from(Buffer.from(`user:${userId}:memory`, 'utf-8'));

  const raw = await kvClient.getValue(streamId, ethers.encodeBase64(key));
  if (!raw) return null;

  const decoded = Buffer.from(ethers.decodeBase64(raw)).toString('utf-8');
  return JSON.parse(decoded) as AgentMemory;
}
```

### Pattern 6: AgentMemory Type

**What:** TypeScript interface for the JSON blob stored in 0G KV (D-05, D-06).
**When to use:** Shared type between kv/memory.ts and agent/context.ts.

```typescript
export interface AgentMemory {
  financialProfile: {
    monthlyIncome?: number;
    spendingCategories?: string[];
    riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
  };
  preferences: {
    confirmationStyle?: 'always' | 'threshold' | 'never';
    reminderFrequency?: 'daily' | 'weekly' | 'off';
  };
  activeGoals: Array<{
    id: string;
    type: 'savings' | 'budget' | 'debt_payoff';
    description: string;
    targetAmount?: number;
    currentAmount?: number;
    createdAt: string;
  }>;
  updatedAt: string;
}

export const DEFAULT_MEMORY: AgentMemory = {
  financialProfile: {},
  preferences: {},
  activeGoals: [],
  updatedAt: new Date().toISOString(),
};
```

### Pattern 7: Context Cache (D-08, D-09, D-10)

**What:** In-process Map keyed by userId. Entries expire after TTL.
**When to use:** In chat.ts before calling runAgent.

```typescript
// Recommendation: 30-minute TTL (Claude's discretion — D-09)
const SESSION_TTL_MS = 30 * 60 * 1000;

interface CachedContext {
  userContext: FullUserContext;
  fetchedAt: number;
}

const contextCache = new Map<string, CachedContext>();

function isStale(entry: CachedContext): boolean {
  return Date.now() - entry.fetchedAt > SESSION_TTL_MS;
}
```

### Pattern 8: assembleContext Extension (D-11)

**What:** Extend `contextInjection` string to include KV memory fields.
**When to use:** In agent/context.ts, extending existing UserContext.

```typescript
// Extends existing UserContext interface
export interface UserContext {
  walletAddress: string;
  displayName: string;
  autoApproveUsd: number;
  memory?: AgentMemory; // NEW: loaded from 0G KV
}

// Extended contextInjection string in assembleContext
const memoryStr = userContext.memory
  ? `, goals=${userContext.memory.activeGoals.length}, profile=${JSON.stringify(userContext.memory.financialProfile)}`
  : '';
const contextInjection = `[User context: wallet=${userContext.walletAddress}, name=${userContext.displayName}, threshold=$${userContext.autoApproveUsd}${memoryStr}]`;
```

### Anti-Patterns to Avoid

- **Supabase JS client for DB queries:** `@supabase/supabase-js` is not needed. Drizzle connects directly to PostgreSQL via `DATABASE_URL` — the Supabase JS client adds unnecessary overhead and a second connection path.
- **Session pooler (port 5432) instead of transaction pooler (port 6543):** Session mode holds connections open per client; use transaction pooler (port 6543) with `prepare: false`.
- **Using `migrate()` instead of `push`:** The decisions lock in `drizzle-kit push` (D-04). Do not generate migration files.
- **Writing KV every turn:** Expensive (gas) and slow. Only write after key moments (D-07).
- **Blocking chat on KV read failure:** KV unavailability must NOT break chat. Return `null` memory gracefully; agent falls back to context-free mode.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PostgreSQL schema versioning | Custom SQL scripts | `drizzle-kit push` | One command, type-safe, idempotent |
| Type-safe DB queries | Raw SQL strings | Drizzle query builder | Compile-time errors, autocomplete |
| UUID generation | `crypto.randomUUID()` in app | `uuid().defaultRandom()` in Drizzle schema | DB generates, not app code |
| KV encoding/decoding | Custom base64 helpers | `ethers.encodeBase64` / `ethers.decodeBase64` | Already a dependency, handles edge cases |
| In-memory Postgres for tests | Mock objects | `@electric-sql/pglite` + Drizzle pushSchema | Real Postgres semantics, no Docker |

**Key insight:** Both Drizzle and the 0G SDK handle the most complex parts (type inference, on-chain transactions, Merkle proofs). Custom solutions in either area would reimplement significant complexity incorrectly.

---

## Common Pitfalls

### Pitfall 1: Supabase Transaction Pooler Requires `prepare: false`

**What goes wrong:** Prepared statements fail silently or throw `prepared statement does not exist` errors.
**Why it happens:** Supabase's Supavisor transaction pooler (port 6543) does not support server-side prepared statements — connections are not sticky.
**How to avoid:** Always pass `{ prepare: false }` to the `postgres()` client when using the pooler URL.
**Warning signs:** Intermittent query failures; errors mentioning prepared statement names.

### Pitfall 2: 0G KV Write Requires Gas — Wallet Must Have Testnet 0G Tokens

**What goes wrong:** `batcher.exec()` fails with "insufficient funds" or returns an error.
**Why it happens:** Writing to 0G Storage KV is an on-chain transaction; the private key's wallet must hold testnet 0G tokens for gas.
**How to avoid:** Pre-fund the hackathon wallet before the demo. Store the private key in `OG_PRIVATE_KEY` env var, never hardcode.
**Warning signs:** `err` returned from `batcher.exec()` mentioning gas or funds.

### Pitfall 3: KV Read Returns Base64-Encoded Bytes — Must Double-Decode

**What goes wrong:** `JSON.parse(rawValue)` throws because the value is base64, not JSON.
**Why it happens:** `kvClient.getValue()` returns the value already base64-encoded. Ethers' `decodeBase64` is needed to get the raw bytes, then `.toString('utf-8')` to get the string.
**How to avoid:** Always decode: `Buffer.from(ethers.decodeBase64(raw)).toString('utf-8')` before `JSON.parse`.
**Warning signs:** `JSON.parse` throws SyntaxError; first character is not `{`.

### Pitfall 4: `drizzle-kit push` Drops Columns Without Warning in Development

**What goes wrong:** Removing a column from the schema and running `push` silently drops the column and data in Supabase.
**Why it happens:** `push` applies the diff immediately with no undo.
**How to avoid:** Never remove schema columns during the hackathon without intending to. Add columns freely; only remove if the table is empty or expendable.
**Warning signs:** None — data loss is silent.

### Pitfall 5: flowContract Parameter in Batcher Is Under-Documented

**What goes wrong:** `new Batcher(1, nodes, flowContract, evmRpc)` — the `flowContract` value is unclear from docs. Some examples pass `undefined`; others pass a contract instance.
**Why it happens:** SDK documentation is sparse; the README shows a contract instance but the indexer may auto-discover the address.
**How to avoid:** Test with `undefined` first. If that fails, fetch the flow contract address from the indexer or 0G docs and create an ethers Contract instance.
**Warning signs:** Batcher construction throws or `exec()` errors on contract call.

### Pitfall 6: Context Cache Must Be Per-User, Not Global

**What goes wrong:** A Map keyed by IP address or session cookie shares context across users or persists incorrectly.
**Why it happens:** Easy to accidentally key the cache on something non-unique.
**How to avoid:** Key the cache on `userId` (Supabase UUID). Log cache hit/miss.
**Warning signs:** User B sees User A's memory.

---

## Code Examples

### Verified: Drizzle Insert + Select

```typescript
// Source: https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Insert user at onboarding completion (D-12)
const [newUser] = await db.insert(users).values({
  walletAddress: '0xabc...',
  displayName: 'Alice',
  autoApproveUsd: '25',
}).returning();

// Fetch user by wallet address (chat route context load)
const user = await db.select().from(users).where(eq(users.walletAddress, wallet)).limit(1);
```

### Verified: PGlite Test Setup

```typescript
// Source: https://github.com/drizzle-team/drizzle-orm/discussions/4216
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api-postgres';
import * as schema from '../db/schema';

let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  const client = new PGlite();
  db = drizzle({ client, schema });
  await pushSchema(schema, db); // apply schema directly, no migration files
});
```

### Verified: 0G KV Read Pattern

```typescript
// Source: https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk
import { KvClient } from '@0glabs/0g-ts-sdk';
import { ethers } from 'ethers';

const kvClient = new KvClient(process.env.OG_KV_CLIENT_URL!);
const rawVal = await kvClient.getValue(
  process.env.OG_KV_STREAM_ID!,
  ethers.encodeBase64(Uint8Array.from(Buffer.from(key, 'utf-8')))
);
// rawVal is null if key not found, base64 string if found
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma with Supabase | Drizzle ORM | 2023-2024 | Drizzle is lighter, schema-as-code, no shadow DB required for push |
| drizzle-kit `api` export | `drizzle-kit/api-postgres` | 2024 | Import path changed; old path removed |
| ethers v5 | ethers v6 | 2023 | Breaking API changes; 0g-ts-sdk ships v6 as peer dep |
| `pipeDataStreamToResponse` (Vercel AI) | `toUIMessageStreamResponse()` | Phase 1 (already decided) | Already implemented correctly in chat.ts |

**Deprecated/outdated:**
- `@supabase/supabase-js` for direct DB queries: Use Drizzle + postgres driver instead
- ethers v5 `utils.toUtf8Bytes`: Use `Buffer.from(..., 'utf-8')` in Node.js / ethers v6 equivalent

---

## Open Questions

1. **0G KV testnet public endpoint**
   - What we know: Mainnet KV node at `http://3.101.147.150:6789`; testnet indexer at `https://indexer-storage-testnet-turbo.0g.ai`
   - What's unclear: Is there a public testnet KV client HTTP endpoint (separate from indexer)? The write path goes through the indexer + Batcher; the read path needs a direct KV node URL.
   - Recommendation: At hackathon start, check 0G Discord or docs for the current testnet KV HTTP endpoint. As fallback, run the read path through the indexer if KvClient URL is unavailable.

2. **Batcher flowContract parameter**
   - What we know: SDK examples show `new Batcher(1, nodes, flowContract, evmRpc)` but documentation says "auto-discovered"
   - What's unclear: Can `undefined` be passed safely, or must a contract instance be constructed?
   - Recommendation: First attempt with `undefined`. If it fails, fetch the flow contract address from `https://docs.0g.ai/developer-hub/testnet/testnet-overview` and construct `new ethers.Contract(addr, abi, signer)`.

3. **Cache TTL for D-09**
   - What we know: Context cached per session; re-fetched after "a certain time has passed since the last conversation"
   - What's unclear: Exact TTL value is Claude's discretion
   - Recommendation: Use 30 minutes. Short enough to pick up memory changes if user restarts a session, long enough to avoid redundant fetches mid-conversation.

4. **0G KV stream ID for hackathon**
   - What we know: Stream IDs are hex strings; there are known public stream IDs for testnet
   - What's unclear: Whether Genie should use a shared public stream or create a dedicated one
   - Recommendation: Use a dedicated stream ID (generate a random hex) per deployment. Store as `OG_KV_STREAM_ID` env var. A shared stream would allow key collisions with other hackathon teams.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API runtime | Yes | v24.10.0 | — |
| npm | Package install | Yes | 11.6.1 | — |
| Supabase (cloud) | Database | Not checked | — | Must provision at hackathon start |
| 0G testnet (external) | KV reads/writes | Not checked | — | Agent works without KV (empty memory) |
| 0G private key wallet | KV writes (gas) | Not checked | — | Skip KV writes, read-only mode |
| drizzle-orm | Schema + queries | Not installed | 0.45.2 (registry) | — |
| @0glabs/0g-ts-sdk | KV operations | Not installed | 0.3.3 (registry) | — |
| ethers | KV write signing | Not installed | 6.16.0 (registry) | — |
| @electric-sql/pglite | Vitest tests | Not installed | 0.4.3 (registry) | Skip DB tests |

**Missing dependencies with no fallback:**
- Supabase project must be provisioned (free tier works) before `drizzle-kit push` can run
- `DATABASE_URL` (Supabase connection string, transaction pooler, port 6543) must be in `.env`

**Missing dependencies with fallback:**
- 0G KV (reads/writes): If testnet is unreliable, agent falls back to empty memory — chat still works
- 0G private key with gas: KV writes can be disabled; reads return null and agent runs without memory

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (latest, already installed) |
| Config file | `apps/api/vitest.config.ts` (exists) |
| Quick run command | `npm test --workspace=apps/api` |
| Full suite command | `npm test` (turbo) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGEN-07 | KV memory survives across sessions (read after write) | integration | `npm test --workspace=apps/api` | No — Wave 0 gap |
| AGEN-07 | assembleContext includes KV memory in context injection | unit | `npm test --workspace=apps/api` | No — Wave 0 gap |
| AGEN-07 | UserContext type includes memory field | unit (type check) | `npx tsc --noEmit` | No — Wave 0 gap |
| D-04 | Schema tables exist after drizzle-kit push | smoke (manual) | `npx drizzle-kit push` | No — manual step |
| D-10 | Chat route returns cached context on second call | unit | `npm test --workspace=apps/api` | No — Wave 0 gap |

**Note:** KV integration test (actual 0G network round-trip) is manual-only for hackathon — no CI access to testnet wallet.

### Sampling Rate

- **Per task commit:** `npm test --workspace=apps/api`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/db/schema.test.ts` — unit tests for schema shape (tables exist, column types)
- [ ] `apps/api/src/kv/memory.test.ts` — unit tests for AgentMemory type + encode/decode helpers
- [ ] `apps/api/src/agent/context.test.ts` — unit tests for extended assembleContext with memory
- [ ] `apps/api/src/routes/chat.test.ts` — unit tests for context cache hit/miss logic
- [ ] PGlite test setup: `npm install -D @electric-sql/pglite` — not yet in package.json

---

## Sources

### Primary (HIGH confidence)

- [Drizzle ORM Supabase Tutorial](https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase) — schema patterns, connection setup, push command
- [Drizzle ORM Get Started with Supabase](https://orm.drizzle.team/docs/get-started/supabase-new) — drizzle.config.ts, `prepare: false`, push workflow
- [0G Storage SDK Docs](https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk) — KvClient, Batcher, testnet endpoints
- [0glabs/0g-ts-sdk README](https://github.com/0glabs/0g-ts-sdk/blob/main/README.md) — full SDK reference with code examples

### Secondary (MEDIUM confidence)

- [npm: drizzle-orm 0.45.2](https://www.npmjs.com/package/drizzle-orm) — version verified 2026-04-04
- [npm: @0glabs/0g-ts-sdk 0.3.3](https://www.npmjs.com/package/@0glabs/0g-ts-sdk) — version verified 2026-04-04
- [Drizzle + PGlite Vitest Discussion](https://github.com/drizzle-team/drizzle-orm/discussions/4216) — in-memory test pattern, `drizzle-kit/api-postgres` import

### Tertiary (LOW confidence)

- 0G testnet KV public HTTP endpoint — community guides reference `http://3.101.147.150:6789` but this is likely a mainnet node; testnet equivalent needs confirmation at hackathon time
- Batcher `flowContract` behavior with `undefined` — inferred from SDK source inspection, not official documentation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry; Drizzle docs are current
- Architecture: HIGH — Drizzle patterns from official docs; KV patterns from SDK README
- Pitfalls: MEDIUM — Drizzle pitfalls from official docs (HIGH); 0G KV pitfalls from SDK README + known under-documentation (MEDIUM)
- 0G KV write path: MEDIUM — Batcher API is thin in docs; flowContract parameter is ambiguous

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (Drizzle stable); 2026-04-11 (0G SDK — fast-moving testnet)
