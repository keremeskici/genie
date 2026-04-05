# Phase 7: API Wiring — Path Alignment + User Provisioning - Research

**Researched:** 2026-04-05
**Domain:** NextAuth session augmentation, Hono route prefixing, Drizzle schema migration, user provisioning, onboarding flow
**Confidence:** HIGH — all findings are from direct source inspection, no speculative claims

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**User Provisioning**
- D-01: Auth callback (NextAuth authorize) calls backend `POST /api/users/provision` to get-or-create user by wallet address. Returns UUID. Session always has a valid UUID from the start.
- D-02: Provisioning is idempotent get-or-create — if walletAddress exists, return existing UUID; if not, insert and return new UUID.
- D-03: Minimal user created during auth: walletAddress only, displayName null. Schema must make displayName nullable.
- D-04: If provisioning fails during auth, auth fails entirely — no session created. Prevents split state.
- D-05: Simple 2-step onboarding screens built in this phase (placeholder UI, will be polished later): Step 1 = enter display name, Step 2 = set auto-approve USDC threshold (default $25).
- D-06: Onboarding completion updates the existing user record (displayName, autoApproveUsd), does not create a new one.
- D-07: Display name should default to World username if available from MiniKit userInfo, otherwise null until user enters it in onboarding.

**Path Alignment**
- D-08: Backend Hono routes get `/api` prefix — `app.route('/api', chatRoute)` etc. Frontend stays as-is (`${NEXT_PUBLIC_API_URL}/api/chat`).
- D-09: BFF verify-proof route stays — validates proof with worldcoin.org first, then forwards to backend `/api/verify`.
- D-10: New provisioning endpoint: `POST /api/users/provision` on the backend, called directly from auth callback (no BFF proxy needed — auth runs server-side).
- D-11: CORS middleware configured on Hono backend for frontend origin(s).
- D-12: Existing `GET /health` moves to `GET /api/health` for consistency. No additional probes needed.

**Identity Mapping**
- D-13: `session.user.id` stores the UUID (not wallet address). `session.user.walletAddress` added as a separate field for the original 0x address.
- D-14: 0G KV keys switch from wallet address to UUID. Existing KV data keyed by wallet address is orphaned (acceptable for hackathon).
- D-15: `session.user.needsOnboarding` flag set to true when displayName is null. Frontend checks this client-side to redirect to onboarding screens. No extra API call on app launch.
- D-16: Auth callback provisions first (creates minimal user), then sets session fields (id=UUID, walletAddress=0x, needsOnboarding=bool).

**Error & Fallback Behavior**
- D-17: Authentication required for chat — unauthenticated users see landing page, not chat. Simplifies backend (every /api/chat request has a valid userId).
- D-18: Backend unreachable → inline error message in chat thread ("Could not reach Genie. Try again.") with retry.
- D-19: Tool call failures surfaced through agent natural language response, not structured error cards.

### Claude's Discretion
- Health check implementation details
- CORS origin configuration specifics (dev vs production)
- Onboarding screen styling (placeholder — will be redesigned)
- Error message copy/wording

### Deferred Ideas (OUT OF SCOPE)
- Full onboarding UI polish — proper design, animations, branding
- Profile editing screen — let users change display name and auto-approve limit after initial setup
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGEN-04 | Vercel AI SDK agent loop with tool calling and streaming responses | Agent already built; path mismatch (no `/api` prefix) prevents frontend reaching it. Fix: D-08 route prefix. |
| AGEN-05 | Three-layer context: system prompt + user context + conversation history | Implemented in `runAgent`. Blocked by userId being a wallet address. Fix: D-13 UUID session field. |
| AGEN-07 | 0G Storage KV persists user context across sessions | `readMemory`/`writeMemory` use `user:${userId}:memory` key. Key format switches from walletAddress to UUID per D-14. |
| MAPP-03 | Streaming AI responses render token-by-token | `DefaultChatTransport` in ChatInterface already configured for `${API_URL}/api/chat` — path will be correct after D-08. |
| FOPS-01 | User can check USDC balance via chat | `get_balance` tool available ungated, but `fetchUserContext` fails when UUID is invalid (wallet as ID). Fix: D-01 provisioning. |
| FOPS-02 | User can send USDC via natural language | `send_usdc` gated on userId (UUID). Fix: D-01 + D-13. |
| FOPS-03 | Agent resolves recipients via contacts, ENS, or wallet address | `resolve_contact` gated on userId. Same fix. |
| FOPS-04 | Transfers under auto-approve threshold execute immediately | `autoApproveUsd` read from `fetchUserContext` — requires valid DB user. Fix: D-01 provisioning. |
| SPND-02 | User can ask spending summaries | `get_spending` tool gated on userId. Same fix. |
| DEBT-01 | User can create debt entries | `create_debt` tool gated on userId. Same fix. |
| DEBT-02 | Agent auto-detects incoming transfers and marks debts as settled | `checkAndSettleDebts` called in chat route with userId. Same fix. |
| MAPP-04 | Contact management (add, list, resolve) | `add_contact` / `list_contacts` gated on userId. Same fix. |
</phase_requirements>

---

## Summary

Phase 7 is a wiring phase — the backend and frontend were built in parallel without being connected. Two audit bugs block all functionality: (1) the Hono backend mounts routes at `/` but the frontend calls `${API_URL}/api/chat`, and (2) `session.user.id` contains the wallet address (`0x...`) not a database UUID, so every DB query that uses `userId` as a foreign key either returns 0 rows or throws a FK constraint error.

The fix is surgical but must be applied in the right order: first add the `/api` prefix to Hono routes, then create the provisioning endpoint, then wire the auth callback to call it, then update the session shape to carry UUID + walletAddress. The 0G KV key format change follows automatically once session.user.id is a UUID.

The onboarding flow (D-05 through D-07) is new UI that must be built. It is intentionally minimal — two static form screens with no polish. The `needsOnboarding` flag is computed during auth from the provisioned user record and stored in the JWT, so no runtime DB call is needed on app launch.

**Primary recommendation:** Implement changes in dependency order — (1) DB schema patch (make displayName nullable), (2) backend provision endpoint, (3) Hono route prefix, (4) CORS configuration, (5) auth callback rewire, (6) session type augmentation, (7) onboarding screens + redirect, (8) KV key validation.

---

## Standard Stack

### Core (all already installed — no new packages needed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next-auth v5 (`next-auth`) | `^5.0.0-beta.25` | JWT session, credentials provider, authorize callback | Already in use; authorize callback is the correct injection point for provisioning |
| Hono (`hono`) | `^4.x` | Route mounting with `/api` prefix via `app.route()` | Already in use; `app.route('/api', chatRoute)` is canonical Hono pattern |
| drizzle-orm | `^0.x` | Schema column mutation (`.notNull()` → nullable) | Already in use; schema edit + `pushSchema` is the established DDL flow |
| drizzle-kit | `^0.x` | DDL push to Supabase | Already established — `pushSchema.apply()` required (Phase 2 decision) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `hono/cors` | bundled with hono | CORS middleware with origin filtering | D-11: configure for frontend origin |
| `zod` | `^3.x` | Input validation on provision endpoint | Already used in verify.ts — same pattern |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Auth callback provisioning | Lazy provisioning on first chat request | Auth-callback approach (D-01) guarantees every session has a UUID from the start — lazy approach creates race conditions and requires fallback logic in every route |
| Direct backend call in authorize | BFF proxy for provisioning | Auth runs server-side in Next.js; direct call to backend is simpler with no extra hop needed (D-10) |

**Installation:** No new packages required. All dependencies are already present.

---

## Architecture Patterns

### Recommended Change Sequence

The changes form a dependency chain. Do not reorder.

```
1. apps/db/src/schema.ts          — displayName: nullable
2. DB migration                    — push schema to Supabase
3. apps/api/src/routes/users.ts   — new: POST /provision endpoint
4. apps/api/src/index.ts          — app.route('/api', ...) prefix + CORS
5. apps/web/src/auth/index.ts     — authorize: fetch provision, set UUID
6. apps/web/src/auth/index.ts     — JWT/session callbacks: UUID + walletAddress + needsOnboarding
7. apps/web/src/app/              — onboarding screens (2 steps)
8. apps/web/src/app/page.tsx      — redirect to onboarding if needsOnboarding
9. apps/api/src/kv/memory.ts      — key format already uses userId (no change needed if UUID is correct)
```

### Pattern 1: Hono Route Prefixing

**What:** Change `app.route('/', chatRoute)` to `app.route('/api', chatRoute)` for all three routes.
**When to use:** D-08 — all backend routes need `/api` prefix.

```typescript
// apps/api/src/index.ts — after change
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'genie-api' }));
app.route('/api', chatRoute);    // POST /api/chat
app.route('/api', verifyRoute);  // POST /api/verify
app.route('/api', confirmRoute); // POST /api/confirm
app.route('/api', usersRoute);   // POST /api/users/provision
```

The sub-routes in `chatRoute`, `verifyRoute`, and `confirmRoute` are defined with `/chat`, `/verify`, `/confirm` — no change needed in those files. `app.route('/api', chatRoute)` means the handler registered as `.post('/chat', ...)` becomes reachable at `/api/chat`.

### Pattern 2: Provision Endpoint (Idempotent Get-or-Create)

**What:** Backend endpoint that accepts a wallet address and returns the user's UUID. Creates user if not found.
**When to use:** D-01 through D-03.

```typescript
// apps/api/src/routes/users.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { db, users, eq } from '@genie/db';

export const usersRoute = new Hono();

const provisionSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid Ethereum address'),
  displayName: z.string().nullable().optional(),  // pre-fill from World username (D-07)
});

usersRoute.post('/users/provision', async (c) => {
  const body = await c.req.json();
  const parsed = provisionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_INPUT', message: parsed.error.message }, 400);
  }

  const { walletAddress, displayName } = parsed.data;

  // Idempotent get-or-create (D-02)
  const [existing] = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.walletAddress, walletAddress))
    .limit(1);

  if (existing) {
    return c.json({
      userId: existing.id,
      needsOnboarding: existing.displayName === null,
    });
  }

  // Insert minimal user (D-03) — displayName defaults to null or pre-filled from World username
  const [created] = await db
    .insert(users)
    .values({
      walletAddress,
      displayName: displayName ?? null,
    })
    .returning({ id: users.id });

  return c.json({
    userId: created.id,
    needsOnboarding: (displayName ?? null) === null,
  });
});
```

### Pattern 3: NextAuth authorize — Provision and Return UUID

**What:** The `authorize` callback calls the backend provisioning endpoint and puts UUID in the returned user object.
**When to use:** D-01, D-16.

```typescript
// apps/web/src/auth/index.ts — authorize callback (after SIWE verification)
const walletAddress = result.siweMessageData.address;
const userInfo = await MiniKit.getUserInfo(finalPayload.address);

// D-01: Provision user in backend — fail auth if provisioning fails (D-04)
const apiUrl = process.env.API_URL ?? 'http://localhost:3001';
const provisionRes = await fetch(`${apiUrl}/api/users/provision`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress,
    displayName: userInfo?.username ?? null,  // D-07: pre-fill from World username
  }),
});

if (!provisionRes.ok) {
  console.error('[auth] provisioning failed:', await provisionRes.text());
  return null;  // D-04: fail auth entirely
}

const { userId, needsOnboarding } = await provisionRes.json();

return {
  id: userId,                                          // D-13: UUID
  walletAddress,                                       // D-13: separate field
  needsOnboarding,                                     // D-15: computed flag
  username: userInfo?.username,
  profilePictureUrl: userInfo?.profilePictureUrl,
};
```

### Pattern 4: Session Type Augmentation

**What:** Extend NextAuth User/Session/JWT types to include UUID id, walletAddress, and needsOnboarding.
**When to use:** D-13, D-15.

```typescript
// apps/web/src/auth/index.ts — module augmentation
declare module 'next-auth' {
  interface User {
    walletAddress: string;
    username: string;
    profilePictureUrl: string;
    needsOnboarding: boolean;  // NEW
  }

  interface Session {
    user: {
      walletAddress: string;    // NEW (was missing from Session type)
      username: string;
      profilePictureUrl: string;
      needsOnboarding: boolean; // NEW
    } & DefaultSession['user']; // id: string (UUID) comes from here
  }
}

// JWT callback — store all fields
async jwt({ token, user }) {
  if (user) {
    token.userId = user.id;                    // UUID
    token.walletAddress = user.walletAddress;  // 0x address
    token.username = user.username;
    token.profilePictureUrl = user.profilePictureUrl;
    token.needsOnboarding = user.needsOnboarding;  // NEW
  }
  return token;
},

// Session callback — expose all fields
session: async ({ session, token }) => {
  if (token.userId) {
    session.user.id = token.userId as string;
    session.user.walletAddress = token.walletAddress as string;
    session.user.username = token.username as string;
    session.user.profilePictureUrl = token.profilePictureUrl as string;
    session.user.needsOnboarding = token.needsOnboarding as boolean;  // NEW
  }
  return session;
},
```

### Pattern 5: Onboarding Flow — 2-Step Placeholder

**What:** Two sequential screens shown after auth if `session.user.needsOnboarding === true`. Completion calls `PATCH /api/users/profile` (or a similar update endpoint) to set displayName + autoApproveUsd.
**When to use:** D-05 through D-07, D-15.

```
apps/web/src/app/
├── onboarding/
│   ├── page.tsx          — Step 1: Enter display name
│   └── threshold/
│       └── page.tsx      — Step 2: Set auto-approve limit
```

Redirect logic in `apps/web/src/app/page.tsx`:
```typescript
// After walletAuth() succeeds, check session.user.needsOnboarding
const session = await getSession();
if (session?.user?.needsOnboarding) {
  router.push('/onboarding');
} else {
  router.push('/home');
}
```

Onboarding completion hits a new backend endpoint (e.g., `PATCH /api/users/profile`):
```typescript
// apps/api/src/routes/users.ts — additional endpoint
usersRoute.patch('/users/profile', async (c) => {
  const { userId, displayName, autoApproveUsd } = await c.req.json();
  await db.update(users)
    .set({ displayName, autoApproveUsd: autoApproveUsd.toString() })
    .where(eq(users.id, userId));
  return c.json({ success: true });
});
```

After completion, the needsOnboarding flag is stale in the JWT. Options:
1. Re-sign in silently (complex)
2. Store `needsOnboarding` in client-side state after onboarding completes and never show onboarding again in this session

Given hackathon constraints, option 2 is simpler: after successful onboarding form submission, set a `localStorage` flag or just redirect to `/home` — the flag is only read once at app launch.

### Pattern 6: CORS Configuration

**What:** Configure `hono/cors` with explicit origin list instead of wildcard.
**When to use:** D-11.

```typescript
// apps/api/src/index.ts
import { cors } from 'hono/cors';

app.use('*', cors({
  origin: [
    'http://localhost:3000',                   // dev
    process.env.FRONTEND_URL ?? '',            // production (set in env)
  ].filter(Boolean),
  allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
```

### Pattern 7: Schema Migration — displayName Nullable

**What:** Change `displayName: text('display_name').notNull()` to `text('display_name')` (nullable by default in Drizzle).
**When to use:** D-03.

```typescript
// apps/db/src/schema.ts — users table, displayName column
displayName: text('display_name'),  // removed .notNull() — nullable for provisioned-not-onboarded state
```

After this change, run `pushSchema.apply()` via the established drizzle-kit DDL flow (Phase 2 decision: must call `.apply()` explicitly).

**Important for chat route:** `fetchUserContext` in `chat.ts` currently reads `user.displayName` and passes it to `UserContext`. After the schema change, `displayName` may be `null`. The `displayName` field in `UserContext` is typed as `string`. Add a null-coalesce:
```typescript
displayName: user.displayName ?? 'User',
```

### Anti-Patterns to Avoid

- **Wildcard CORS in production:** `cors()` with no origin currently allows all origins. Use explicit origin list (D-11).
- **Sending wallet address as userId to chat:** After fix, `session.user.id` is UUID. `ChatInterface` already does `session?.user?.id` — will work correctly once session is fixed.
- **Assuming KV key format needs changing in code:** The key format `user:${userId}:memory` in `memory.ts` is already parameterized by `userId`. Once `userId` is a UUID (not wallet address), existing KV data is orphaned (D-14: acceptable). No code change needed in `memory.ts`.
- **Re-signing JWT after onboarding:** The `needsOnboarding` flag in JWT becomes stale after onboarding. Do not attempt silent re-sign — it's complex. Use client-side state after completion or simply rely on `localStorage` flag.
- **Two separate provision calls:** The authorize callback must provision once and store the UUID in the JWT. Do NOT provision again in the JWT callback (which runs on every request) — the check against `if (user)` in the JWT callback already guards this correctly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Idempotent upsert | Custom race-condition-prone get+insert | Drizzle `.insert().onConflictDoUpdate()` or simple get-then-insert with DB unique constraint | `walletAddress` has `.unique()` — duplicate insert throws; use try-catch or conflict clause |
| CORS headers | Manual `c.header('Access-Control-Allow-Origin', ...)` | `hono/cors` middleware | Handles preflight OPTIONS, credentials, multiple methods correctly |
| Session type safety | `(session as any).user.walletAddress` | NextAuth module augmentation (`declare module 'next-auth'`) | Type-safe session with compile-time checking |

**Key insight:** The `walletAddress` column already has `.unique()` in schema. A naive insert without conflict handling will throw on duplicate provision. Use either `INSERT ... ON CONFLICT DO NOTHING RETURNING` or do a select-first pattern. The select-first pattern (show in Pattern 2) is simpler and more readable for the provision endpoint.

---

## Runtime State Inventory

> This phase modifies userId identity — runtime state using the old identifier (wallet address) must be inventoried.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | 0G KV entries keyed by `user:${walletAddress}:memory` — these will become unreachable once userId switches to UUID | Data migration explicitly deferred (D-14: "orphaned — acceptable for hackathon"). Code change only. |
| Stored data | Supabase `users` table — `displayName` is currently NOT NULL; existing rows may have empty string as display name | Schema migration: remove `.notNull()`, allow NULL. Existing non-null rows unaffected. |
| Stored data | Supabase `contacts` table — `ownerUserId` FK references `users.id` UUID. No change needed; FK already uses UUID. | None — correct already. |
| Live service config | None identified — no external services store userId/walletAddress as config | None |
| OS-registered state | None — no OS-level task registrations | None |
| Secrets/env vars | `API_URL` (or similar) needed in `apps/web` for auth callback to call backend provisioning directly (server-side call, not NEXT_PUBLIC_). Currently `NEXT_PUBLIC_API_URL` is the only API URL env var. | Add `API_URL` (non-public) for server-side calls, or reuse `NEXT_PUBLIC_API_URL` — both work since auth callback is server-side only for reads, the env var just needs to be set. |
| Build artifacts | None — no compiled binaries or egg-info directories | None |

**Nothing found in categories:** OS-registered state, live service config (none verified by direct codebase inspection).

---

## Common Pitfalls

### Pitfall 1: Provisioning endpoint called from JWT callback instead of authorize

**What goes wrong:** `jwt()` callback runs on every session token refresh. If provision is called there instead of in `authorize`, it fires on every request, not just during sign-in.
**Why it happens:** Developers add logic to `jwt()` for convenience since it runs frequently.
**How to avoid:** Gate provisioning with `if (user)` — the `user` object is only present during the initial sign-in. The `authorize` callback is the right place (D-16).
**Warning signs:** Excessive provision API calls in backend logs; `user` object undefined mid-session.

### Pitfall 2: Frontend calling backend directly from the browser for provisioning

**What goes wrong:** If provisioning is wired to a browser-side fetch (e.g., inside a `useEffect`), it runs after page load and races with other requests.
**Why it happens:** Easier to conceptualize client-side flow.
**How to avoid:** Auth runs server-side — `authorize` in `apps/web/src/auth/index.ts` is a Node.js server context, not a browser context. `fetch()` here is a server-to-server call. This is D-10.
**Warning signs:** CORS errors on the provision call (wouldn't happen server-to-server).

### Pitfall 3: displayName null in UserContext typed as string

**What goes wrong:** After making `displayName` nullable in schema, TypeScript infers `string | null` for `user.displayName`. The `UserContext` type has `displayName: string`. Drizzle returns the DB type, so `user.displayName` becomes `string | null` — assignment will fail TypeScript compilation.
**Why it happens:** Schema and TypeScript interface diverge silently.
**How to avoid:** Add null-coalesce in `fetchUserContext`: `displayName: user.displayName ?? 'User'`. Alternatively update `UserContext` to `displayName: string | null` (less work but requires updating downstream consumers).
**Warning signs:** `next build` fails with type error in `apps/api/src/routes/chat.ts`.

### Pitfall 4: /api prefix on individual route files instead of index.ts

**What goes wrong:** Developer adds `/api` prefix inside `chatRoute.post('/api/chat', ...)` instead of at `app.route('/api', chatRoute)`. Results in double-prefixed routes like `/api/api/chat`.
**Why it happens:** Misunderstanding of Hono's route composition.
**How to avoid:** The prefix goes on `app.route('/api', chatRoute)` in `index.ts` only. The route files themselves keep their short paths (`/chat`, `/verify`, etc.).
**Warning signs:** 404 on `/api/chat`, 200 on `/api/api/chat`.

### Pitfall 5: Verify-proof BFF route already calls `/api/verify` — will break if Hono prefixing not done first

**What goes wrong:** `apps/web/src/app/api/verify-proof/route.ts` currently calls `${apiUrl}/api/verify`. This is currently broken (backend has `/verify` not `/api/verify`). After D-08 fix, it will work. If the order is reversed (route file changed to remove `/api` prefix expecting old backend) the BFF breaks.
**Why it happens:** The BFF already anticipates the `/api` prefix — it was written after Phase 3 research specified the prefix.
**How to avoid:** Apply D-08 (Hono prefix) before testing verify-proof flow. No change needed to `verify-proof/route.ts`.
**Warning signs:** BFF verify returns 404 from backend; World ID verification fails.

### Pitfall 6: walletAddress uniqueness constraint causes provision insert to fail

**What goes wrong:** Two concurrent auth attempts for the same wallet address race. First insert succeeds; second throws a unique constraint violation from Postgres.
**Why it happens:** Select-then-insert is not atomic without a transaction.
**How to avoid:** For hackathon scope, the select-first pattern is sufficient (race is extremely unlikely). For robustness, use `INSERT ... ON CONFLICT DO NOTHING RETURNING id` with a follow-up select if no row returned. Document this as known limitation.
**Warning signs:** 500 errors during auth with Postgres unique violation messages.

### Pitfall 7: NEXT_PUBLIC_ vs private env var for backend URL in auth callback

**What goes wrong:** `authorize` runs server-side in Next.js. If you use `process.env.NEXT_PUBLIC_API_URL`, it works but exposes the backend URL to the browser bundle. If you use `process.env.API_URL` (private), it must be set in the server environment.
**Why it happens:** Developers use the `NEXT_PUBLIC_` variable because it's already defined.
**How to avoid:** For hackathon, reusing `NEXT_PUBLIC_API_URL` in `authorize` is acceptable — it's already public and the URL is not a secret. Document this explicitly.
**Warning signs:** `process.env.API_URL` is undefined in production; provisioning fails silently.

---

## Code Examples

### Drizzle nullable column

```typescript
// Source: direct inspection of apps/db/src/schema.ts pattern
// Before:
displayName: text('display_name').notNull(),
// After (nullable — no .notNull()):
displayName: text('display_name'),
```

### Hono sub-router composition

```typescript
// Source: Hono docs pattern — app.route mounts sub-router at prefix
// Child route registers at '/chat' → becomes '/api/chat' when mounted at '/api'
const chatRoute = new Hono();
chatRoute.post('/chat', handler);

const app = new Hono();
app.route('/api', chatRoute); // POST /api/chat
```

### NextAuth JWT type extension

```typescript
// Source: NextAuth v5 docs pattern — module augmentation
declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    walletAddress?: string;
    needsOnboarding?: boolean;
  }
}
```

### Idempotent provision — safe select-first pattern

```typescript
// Source: established Drizzle pattern from Phase 2/3
const [existing] = await db.select({ id: users.id, displayName: users.displayName })
  .from(users).where(eq(users.walletAddress, walletAddress)).limit(1);

if (existing) return { userId: existing.id, needsOnboarding: existing.displayName === null };

const [created] = await db.insert(users)
  .values({ walletAddress, displayName: displayName ?? null })
  .returning({ id: users.id });
return { userId: created.id, needsOnboarding: true };
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase (PostgreSQL) | Schema migration + user provisioning | Assumed available (used in phases 2-6) | — | None — blocks migration |
| Next.js dev server | Onboarding pages + auth flow | Available (Phase 6 complete) | 14.x | — |
| Hono backend | Provisioning endpoint | Available (Phase 1-5 complete) | 4.x | — |
| drizzle-kit | DB schema push | Assumed available (Phase 2 used it) | — | Manual SQL ALTER |

**Missing dependencies with no fallback:** None identified — all dependencies established in prior phases.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (apps/api) + next build (apps/web) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command (backend) | `cd apps/api && npx vitest run src/routes/users.test.ts` |
| Quick run command (frontend) | `cd apps/web && npx next build` |
| Full suite command | `cd apps/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGEN-04 | Agent receives valid UUID userId, tools register | unit | `cd apps/api && npx vitest run src/routes/users.test.ts` | Wave 0 |
| AGEN-05 | fetchUserContext resolves correct user from DB via UUID | unit | `cd apps/api && npx vitest run src/routes/users.test.ts` | Wave 0 |
| AGEN-07 | KV memory read/write uses UUID key format | unit | `cd apps/api && npx vitest run src/kv/memory.test.ts` | Wave 0 |
| MAPP-03 | Streaming response reachable at /api/chat | manual-only | Start both servers, send chat message | N/A |
| FOPS-01 through FOPS-04 | Tool calls work end-to-end with valid UUID | unit (provision endpoint) + manual (full flow) | `cd apps/api && npx vitest run src/routes/users.test.ts` | Wave 0 |
| SPND-02 | get_spending receives valid UUID | existing | `cd apps/api && npx vitest run src/tools/get-spending.test.ts` | ✅ |
| DEBT-01 | create_debt receives valid UUID | existing | `cd apps/api && npx vitest run src/tools/create-debt.test.ts` | ✅ |
| DEBT-02 | checkAndSettleDebts receives valid UUID | existing | `cd apps/api && npx vitest run src/tools/list-debts.test.ts` | ✅ |
| MAPP-04 | add/list contacts receive valid UUID | existing | `cd apps/api && npx vitest run src/tools/add-contact.test.ts src/tools/list-contacts.test.ts` | ✅ |

**Manual-only with justification:**
- Full end-to-end streaming (MAPP-03): requires live 0G Compute adapter + SSE connection through browser — not automatable in unit test
- Onboarding redirect flow (D-15): requires MiniKit environment + live session — next build covers TypeScript, manual test covers behavior

### Sampling Rate

- **Per task commit:** `cd apps/api && npx vitest run` (exits fast ~3s for all tool tests)
- **Per wave merge:** `cd apps/api && npx vitest run` + `cd apps/web && npx next build`
- **Phase gate:** Full suite green + manual smoke: send one chat message from World App simulator, verify streaming response received

### Wave 0 Gaps

- [ ] `apps/api/src/routes/users.test.ts` — covers provision endpoint: idempotent create, idempotent get, invalid wallet address rejection, provisioning failure response shape
- [ ] `apps/api/src/kv/memory.test.ts` — covers UUID key format: `user:${uuid}:memory` key is written/read correctly (existing tests may not cover post-UUID-switch behavior)

---

## Sources

### Primary (HIGH confidence — direct source inspection)

- `apps/api/src/index.ts` — Current route mounting at `/` (bug #1 confirmed)
- `apps/web/src/auth/index.ts` — `session.user.id = finalPayload.address` (wallet address, not UUID — bug #2 confirmed)
- `apps/db/src/schema.ts` — `displayName: text('display_name').notNull()` — must become nullable
- `apps/api/src/routes/chat.ts` — `fetchUserContext(userId)` and context cache logic
- `apps/api/src/routes/verify.ts` — Already uses `userId: z.string().uuid()` — expects UUID; currently receives wallet address
- `apps/api/src/kv/memory.ts` — Key format `user:${userId}:memory` — parameterized, no code change needed
- `apps/web/src/components/ChatInterface/index.tsx` — `${API_URL}/api/chat` — already has `/api` prefix (D-08 fix on backend makes this work)
- `apps/web/src/app/api/verify-proof/route.ts` — Already calls `${apiUrl}/api/verify` — works after D-08

### Secondary (MEDIUM confidence)

- Phase 2 accumulated decisions in STATE.md: `pushSchema.apply()` must be called explicitly for DDL; `prepare:false` for Supabase pooler
- Phase 6 VALIDATION.md: Confirmed no test framework in `apps/web`; `next build` is the frontend gate

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all existing libraries confirmed by direct file inspection
- Architecture: HIGH — all patterns derived from existing codebase, not speculation
- Pitfalls: HIGH — all pitfalls identified from direct code reading of the exact files being changed
- Test map: HIGH — existing test files confirmed present; Wave 0 gaps identified precisely

**Research date:** 2026-04-05
**Valid until:** 2026-04-26 (stable stack, 30-day window)
