# Phase 03: Identity - Research

**Researched:** 2026-04-04
**Domain:** World ID cloud verification, action gating middleware, agent context extension
**Confidence:** HIGH

## Summary

Phase 3 adds World ID proof-of-human verification to the Genie API. The work has three distinct pieces: (1) a new `POST /verify` Hono route that forwards IDKit proofs to the World ID Cloud v2 API and stores the returned nullifier_hash in the existing `users.worldId` column, (2) an `isVerified` boolean derived from `users.worldId !== null` and threaded through `UserContext` and `assembleContext`, and (3) per-tool gating that returns a structured error when an unverified user attempts a gated action.

The World ID Cloud v2 API (`POST https://developer.world.org/api/v2/verify/{app_id}`) accepts the five IDKit proof fields, validates the ZK proof cryptographically, and returns a nullifier_hash on success. Duplicate nullifier detection is the app's responsibility — the portal validates cryptographic authenticity only. The `already_verified` error code from the portal means the portal itself detected a re-use; however the plan in D-04 is to reject duplicates in Supabase via a unique constraint or pre-check on `users.worldId`.

The code changes are surgical: extend two existing files (`context.ts`, `chat.ts`), add one new route file (`routes/verify.ts`), and add per-tool guards to tools that will be written in Phase 4 (send USDC) and Phase 5 (create debt). The `isVerified` flag also drives the system prompt so the agent proactively surfaces verification when a user attempts a gated action.

**Primary recommendation:** Use the v2 legacy endpoint with a simple `fetch()` call — no SDK wrapper needed. Reject duplicate nullifiers with a DB pre-check before calling the portal. Thread `isVerified` through `UserContext` unchanged, consistent with the factory + context-injection pattern already established.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dedicated `POST /verify` endpoint receives World ID proof from frontend (IDKit widget sends `proof`, `merkle_root`, `nullifier_hash`, `verification_level`)
- **D-02:** Server validates proof via World ID Cloud API (`https://developer.worldcoin.org/api/v2/verify/{app_id}`) — no on-chain verification for hackathon
- **D-03:** On successful verification, store `nullifier_hash` in `users.worldId` column (already nullable text in schema) and return success
- **D-04:** Reject duplicate nullifier hashes — one World ID per Genie account (sybil resistance)
- **D-05:** World ID app_id and action configured via environment variables (`WORLD_APP_ID`, `WORLD_ACTION`)
- **D-06:** Per-tool gating — each tool that requires verification checks `userContext.isVerified` before executing
- **D-07:** Gated actions: send USDC, create debt, set goals. Ungated: chat, check balance, receive money, view transactions
- **D-08:** Gated tools return a structured error with a clear message: "This action requires World ID verification. Please verify to continue."
- **D-09:** `isVerified` boolean derived from `users.worldId !== null` — added to `UserContext` interface
- **D-10:** Chat route's `fetchUserContext` already loads user from DB — extend to set `isVerified` from worldId column presence
- **D-11:** Classify at request time in chat route — check if user has worldId set, pass `isHumanBacked` flag through agent context
- **D-12:** Classification is a metadata flag on the agent context, not a separate SDK integration — keep it lightweight for hackathon
- **D-13:** System prompt includes verification status so the agent knows what actions it can offer the user
- **D-14:** Verification state persists via DB — `users.worldId` column presence means verified, null means unverified
- **D-15:** No separate session/JWT for verification — checked on every request via cached user context (same 30-min cache from Phase 2)
- **D-16:** Re-verification not required within cache TTL — once verified, stays verified until cache expires and re-fetches from DB

### Claude's Discretion

- Exact World ID Cloud API request/response handling and error codes
- Verification endpoint error response format details
- How system prompt communicates verification status to the agent
- Whether to add a `verifiedAt` timestamp column or just use worldId presence

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRID-01 | User can verify as human via World ID 4.0 IDKit widget inline in chat | IDKit delivers proof payload; `POST /verify` endpoint receives it |
| WRID-02 | Server validates World ID proofs before allowing gated actions (send, debt, goals) | World ID v2 Cloud API performs cryptographic ZK proof validation server-side |
| WRID-03 | Unverified users can chat, view balance, and receive money | `isVerified: false` → per-tool gate passes for ungated tools; blocked only on gated tools |
| WRID-04 | Verified users unlock send money, debt tracking, and agent automation | `isVerified: true` → gated tools execute normally; system prompt unlocks suggestions |
| WRID-05 | Agent Kit classifies verified user agents as human-backed and unverified as bot | `isHumanBacked` flag derived from `isVerified` in agent context; injected into context message |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` | ^4.12.10 (already installed) | New `/verify` route follows same pattern as `chat.ts` | Already in use; consistent route pattern |
| `drizzle-orm` | ^0.45.2 (already installed) | DB query for duplicate nullifier check and worldId update | Already wired; `eq()` + `update()` pattern in scope |
| `zod` | ^3.24.6 (already installed) | Input validation on the `/verify` request body | Already used in all tools |
| `fetch` (native) | Node/Bun built-in | HTTP call to World ID Cloud v2 API | No SDK wrapper exists; native fetch is sufficient |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | latest (already installed) | Unit tests for route logic, gated tools, context extension | All new code follows existing test pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `fetch` to v2 API | `@worldcoin/idkit` server package | No server-side SDK exists for v2; native fetch is the correct approach |
| Per-tool gating (D-06) | Route-level middleware | Middleware would gate all routes; per-tool gating allows fine-grained control (chat stays open) |
| DB pre-check for duplicates | Rely on portal `already_verified` error | Portal-level duplicate detection is unreliable for same-action re-use; DB unique constraint is the source of truth |

**Installation:** No new packages needed — all dependencies are already installed.

---

## Architecture Patterns

### Recommended File Changes
```
apps/api/src/
├── agent/
│   └── context.ts          # ADD isVerified boolean to UserContext interface
│                           # ADD isVerified + isHumanBacked to assembleContext injection
├── routes/
│   ├── chat.ts             # EXTEND fetchUserContext to derive isVerified from worldId
│   └── verify.ts           # NEW: POST /verify endpoint
└── tools/
    └── (future gated tools # WILL ADD isVerified guard pattern — reference established here)
        send-usdc.ts        # Phase 4: gated
        create-debt.ts      # Phase 5: gated
```

### Pattern 1: UserContext Extension
**What:** Add `isVerified: boolean` and `isHumanBacked: boolean` to `UserContext`. Derive from `user.worldId !== null`.
**When to use:** Any time verification status is needed (tool gating, system prompt, agent context).

```typescript
// apps/api/src/agent/context.ts
export interface UserContext {
  walletAddress: string;
  displayName: string;
  autoApproveUsd: number;
  memory?: AgentMemory;
  isVerified: boolean;        // ADD: true when users.worldId is non-null
  isHumanBacked: boolean;     // ADD: alias for D-11 World Agent Kit classification
}
```

### Pattern 2: fetchUserContext Extension (chat.ts)
**What:** After loading `user` from DB, set `isVerified` from `user.worldId !== null`.

```typescript
// In fetchUserContext — after DB select
const userContext: UserContext = {
  walletAddress: user.walletAddress,
  displayName: user.displayName,
  autoApproveUsd: parseFloat(user.autoApproveUsd),
  memory: memory ?? undefined,
  isVerified: user.worldId !== null,       // ADD
  isHumanBacked: user.worldId !== null,    // ADD (D-11)
};
```

### Pattern 3: assembleContext Verification Injection
**What:** Include verification status in the context injection message so the agent knows what actions to offer.

```typescript
// In assembleContext — extend contextInjection string
const verifiedStr = userContext.isVerified
  ? ', verified=true'
  : ', verified=false (gated actions unavailable — suggest World ID verification)';

const contextInjection = `[User context: wallet=${userContext.walletAddress}, name=${userContext.displayName}, threshold=$${userContext.autoApproveUsd}${memoryStr}${verifiedStr}]`;
```

### Pattern 4: POST /verify Endpoint
**What:** Receive IDKit proof payload, call World ID Cloud v2 API, store nullifier_hash, return success.

```typescript
// apps/api/src/routes/verify.ts
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, users } from '../db';

export const verifyRoute = new Hono();

const proofSchema = z.object({
  userId: z.string().uuid(),
  proof: z.string(),
  merkle_root: z.string(),
  nullifier_hash: z.string(),
  verification_level: z.enum(['orb', 'device']),
});

verifyRoute.post('/verify', async (c) => {
  const body = await c.req.json();
  const parsed = proofSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'INVALID_INPUT', message: 'Missing required proof fields' }, 400);
  }

  const { userId, proof, merkle_root, nullifier_hash, verification_level } = parsed.data;

  // D-04: Duplicate nullifier check — one World ID per Genie account
  const [existing] = await db.select({ worldId: users.worldId }).from(users).where(eq(users.id, userId)).limit(1);
  if (!existing) return c.json({ error: 'USER_NOT_FOUND' }, 404);
  if (existing.worldId !== null) {
    return c.json({ error: 'ALREADY_VERIFIED', message: 'This account is already verified with World ID' }, 409);
  }

  // D-02: Call World ID Cloud v2 API
  const appId = process.env.WORLD_APP_ID!;
  const action = process.env.WORLD_ACTION!;

  const worldResponse = await fetch(`https://developer.world.org/api/v2/verify/${appId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nullifier_hash, merkle_root, proof, verification_level, action }),
  });

  if (!worldResponse.ok) {
    const err = await worldResponse.json().catch(() => ({}));
    return c.json({ error: 'VERIFICATION_FAILED', code: err.code, detail: err.detail }, 400);
  }

  // D-03: Store nullifier_hash in users.worldId
  await db.update(users).set({ worldId: nullifier_hash }).where(eq(users.id, userId));

  return c.json({ success: true });
});
```

### Pattern 5: Per-Tool Gating Guard
**What:** Every gated tool checks `isVerified` at the top of its execute function before doing any work.

```typescript
// Reference pattern for Phase 4 / Phase 5 gated tools
export function createSendUsdcTool(userId: string, userContext: UserContext) {
  return tool({
    description: 'Send USDC to a recipient',
    inputSchema: z.object({ /* ... */ }),
    execute: async (input) => {
      // GATING GUARD (D-06, D-08)
      if (!userContext.isVerified) {
        return {
          error: 'VERIFICATION_REQUIRED',
          message: 'This action requires World ID verification. Please verify to continue.',
        };
      }
      // ... actual send logic
    },
  });
}
```

### Pattern 6: Stub isVerified on Fallback Context
**What:** Stub context (anonymous/no-user-found path) must default `isVerified: false`.

```typescript
// In runAgent stub context (agent/index.ts)
const resolvedUserContext: UserContext = request.userContext ?? {
  walletAddress: '0x0000000000000000000000000000000000000000',
  displayName: 'User',
  autoApproveUsd: 25,
  isVerified: false,      // ADD
  isHumanBacked: false,   // ADD
};
```

### Anti-Patterns to Avoid
- **Trusting client-sent `isVerified`:** Never derive verification status from the frontend request — always read from DB via `fetchUserContext`.
- **Relying on portal for duplicate detection:** Portal `already_verified` error code is not guaranteed for the same app/action after migration to v4. Implement DB pre-check first (D-04).
- **Throwing from gated tools:** Follow the existing pattern of returning `{ error, message }` objects — never throw. Consistent with how `update-memory.ts` handles failures.
- **Null/undefined `isVerified` on UserContext:** Add `isVerified: false` to ALL stub/fallback context paths, otherwise downstream TypeScript strict checks will fail.
- **Note on API endpoint URL:** Decision D-02 references `https://developer.worldcoin.org/api/v2/verify/{app_id}`. Official docs also show `https://developer.world.org/api/v2/verify/{app_id}`. Both domains are valid; `developer.world.org` is the current primary. Use `developer.world.org` for new code.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ZK proof cryptography | Custom ZK verifier | World ID Cloud v2 API | ZK proof validation is a PhD-level cryptographic operation; the portal handles Groth16 verification |
| Nullifier uniqueness | Custom hash comparison | DB `worldId` column unique constraint or pre-check + `eq()` select | Simple and already in the schema |
| Session state for verification | JWT or cookie with `isVerified` | `users.worldId` DB column via `fetchUserContext` 30-min cache | Already wired in Phase 2; consistent with how all user state is managed |

**Key insight:** The only custom code in this phase is the route that calls the portal, the DB write, and the boolean derivation. Every complex problem (ZK proofs, deduplication, session management) is already solved by existing infrastructure.

---

## Common Pitfalls

### Pitfall 1: Using `developer.worldcoin.org` vs `developer.world.org`
**What goes wrong:** D-02 cites the legacy hostname `developer.worldcoin.org`. The current primary is `developer.world.org`. Both resolve, but the docs use the new domain.
**Why it happens:** Domain migration from Worldcoin to World branding.
**How to avoid:** Use `developer.world.org` in the implementation. Both work but use the current one.
**Warning signs:** 404 or redirect on API calls.

### Pitfall 2: Forgetting the `action` field in the portal request
**What goes wrong:** Sending only the IDKit proof fields without the `action` field causes portal validation to fail with `invalid_proof`.
**Why it happens:** IDKit proof payload contains `proof`, `merkle_root`, `nullifier_hash`, `verification_level` — but NOT `action`. The action must be appended by the server from `WORLD_ACTION` env var.
**How to avoid:** Always merge `{ action: process.env.WORLD_ACTION }` into the portal request body.
**Warning signs:** `invalid_proof` response from portal when proof looks correct.

### Pitfall 3: TypeScript non-nullable `isVerified` on existing UserContext callers
**What goes wrong:** Adding `isVerified: boolean` (non-optional) to `UserContext` breaks the stub context objects in `chat.ts` and `agent/index.ts` that construct `UserContext` literals.
**Why it happens:** TypeScript will flag the missing field.
**How to avoid:** Update ALL three stub context locations simultaneously: `fetchUserContext` not-found path, `runAgent` stub, and the test mocks in `context.test.ts`.
**Warning signs:** TypeScript compile errors on `UserContext` literal objects.

### Pitfall 4: Context cache not invalidated after verification
**What goes wrong:** User verifies, but the 30-min context cache still returns the old context with `isVerified: false`. User can't use gated tools immediately.
**Why it happens:** `contextCache` is keyed by `userId` with 30-min TTL. The verify endpoint writes to DB but doesn't touch the cache.
**How to avoid:** Call `invalidateContextCache(userId)` from the verify route after successfully writing `worldId` to DB (same pattern as `update-memory.ts`).
**Warning signs:** Verified user still gets "verification required" error within 30 minutes.

### Pitfall 5: Not guarding the stub context path for anonymous users
**What goes wrong:** Anonymous requests (no `userId`) use a hardcoded stub. If `isVerified` is missing from that stub, gated tools will throw on undefined access.
**Why it happens:** The stub path in `runAgent` doesn't fetch from DB so no worldId is available.
**How to avoid:** Stub context always has `isVerified: false, isHumanBacked: false`.
**Warning signs:** TypeScript error or runtime crash when `userContext.isVerified` is undefined.

### Pitfall 6: `already_verified` from the portal is not sufficient duplicate protection
**What goes wrong:** The portal's `already_verified` response code indicates a person has already verified for this action globally. It does NOT protect against one Genie user trying to use a different World ID nullifier. DB-level check is the local sybil guard.
**Why it happens:** The portal operates at the action+nullifier level, not at the Genie user level.
**How to avoid:** Check `users.worldId !== null` in DB before calling the portal (D-04). Return `409 ALREADY_VERIFIED` if the user already has a worldId stored.
**Warning signs:** Second verification attempt succeeds at portal but creates a second Genie account.

---

## World ID Cloud v2 API Reference

### Request
```
POST https://developer.world.org/api/v2/verify/{app_id}
Content-Type: application/json

{
  "nullifier_hash": "<from IDKit>",
  "merkle_root": "<from IDKit>",
  "proof": "<from IDKit>",
  "verification_level": "orb" | "device",
  "action": "<WORLD_ACTION env var>",
  "signal_hash": "<optional — hash of signal, defaults to empty string hash>",
  "max_age": <optional — integer seconds, 3600-604800, default 7200>
}
```

### Success Response (200)
```json
{
  "success": true,
  "action": "my_action",
  "nullifier_hash": "0x2bf8406809dc...",
  "created_at": "2026-04-04T12:00:00.000Z"
}
```

### Error Response (400)
```json
{
  "code": "invalid_proof",
  "detail": "The provided proof is invalid and it cannot be verified. Please check all inputs and try again.",
  "attribute": null
}
```

### Error Codes
| Code | HTTP | Meaning | Action |
|------|------|---------|--------|
| `invalid_proof` | 400 | ZK proof failed cryptographic validation | Return 400 to client — user must re-verify |
| `invalid_merkle_root` | 400 | Merkle root not found — user may be unverified | Return 400 — ask user to re-open IDKit |
| `root_too_old` | 400 | Merkle root exceeded max_age | Return 400 — user must re-generate proof |
| `invalid_credential_type` | 400 | Wrong verification_level or credential | Return 400 — configuration mismatch |
| `exceeded_max_verifications` | 400 | User exceeded per-action verification limit | Return 400 — already verified globally |
| `already_verified` | 400 | This person already verified for this action | Return 409 — treat as success (already stored) |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npm test -- --reporter=verbose` |
| Full suite command | `cd apps/api && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WRID-01 | POST /verify accepts valid proof shape and calls portal | unit | `npm test -- src/routes/verify.test.ts` | ❌ Wave 0 |
| WRID-02 | POST /verify returns 400 when portal returns invalid_proof | unit | `npm test -- src/routes/verify.test.ts` | ❌ Wave 0 |
| WRID-03 | Ungated tool (get_balance) executes when isVerified=false | unit | `npm test -- src/tools/get-balance.test.ts` | ✅ exists |
| WRID-04 | Gated tool returns VERIFICATION_REQUIRED error when isVerified=false | unit | `npm test -- src/tools/send-usdc.test.ts` | ❌ Wave 0 (Phase 4 tool) |
| WRID-04 | assembleContext includes verified=true in injection when isVerified=true | unit | `npm test -- src/agent/context.test.ts` | ✅ exists (needs new test case) |
| WRID-05 | assembleContext includes isHumanBacked in context injection | unit | `npm test -- src/agent/context.test.ts` | ✅ exists (needs new test case) |

### Sampling Rate
- **Per task commit:** `cd apps/api && npm test -- src/routes/verify.test.ts src/agent/context.test.ts`
- **Per wave merge:** `cd apps/api && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/routes/verify.test.ts` — covers WRID-01 and WRID-02 (mock `fetch` to portal, test DB update)
- [ ] `src/agent/context.test.ts` — add test cases for `isVerified=true/false` in `assembleContext` injection string (file exists, add cases)

*(No new framework install needed — Vitest already configured)*

---

## Environment Availability

Step 2.6: External dependencies are limited to the World ID Cloud API (external HTTPS endpoint) and the existing Supabase DB (already proven in Phase 2). No new local services required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| World ID Cloud API (`developer.world.org`) | WRID-02 proof validation | ✓ (external HTTPS) | v2 | None — required for verification |
| Supabase / PostgreSQL | worldId column write | ✓ (proven Phase 2) | — | — |
| `WORLD_APP_ID` env var | Portal API call | Needs provisioning | — | Cannot test E2E without real app_id |
| `WORLD_ACTION` env var | Portal API call | Needs provisioning | — | Use `"verify-human"` as default for dev |

**Missing dependencies with no fallback:**
- `WORLD_APP_ID` and `WORLD_ACTION` must be configured in `.env` before E2E testing. Unit tests can mock `fetch` and do not need these.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `developer.worldcoin.org` hostname | `developer.world.org` (primary) | 2024-2025 rebrand | Both resolve; use new domain |
| World ID v1/v3 on-chain verification | v2 Cloud API (off-chain) | 2023+ | No Solidity/on-chain needed for hackathon |
| World ID 3.0 proof structure | 4.0 protocol (vOPRF-based nullifiers) | 2024 | v2 endpoint still accepts v3 proofs; v4 endpoint exists but migration not required for hackathon |

**Deprecated/outdated:**
- `developer.worldcoin.org/api/v1/verify`: Shut down after June 30, 2024 — use v2.
- `maxSteps` in AI SDK: Deprecated in favor of `stopWhen: stepCountIs(N)` — already handled in Phase 1 code.

---

## Open Questions

1. **`verifiedAt` timestamp column (Claude's Discretion)**
   - What we know: D-03 stores only `nullifier_hash` in `users.worldId`. Schema has no `verifiedAt`.
   - What's unclear: Whether the planner should add a `verifiedAt timestamp` column for auditability.
   - Recommendation: Omit for hackathon. `users.createdAt` is a rough proxy; the schema already exists and adding a column requires a migration. The worldId presence alone is sufficient for all current requirements.

2. **`signal_hash` in portal request**
   - What we know: Optional field, defaults to hash of empty string when omitted.
   - What's unclear: Whether Genie should bind the proof to the user's wallet address as the signal.
   - Recommendation: Omit `signal_hash` for hackathon simplicity. The wallet address is already available but binding it adds frontend complexity to hash it before IDKit generates the proof.

3. **Returning `already_verified` from portal (edge case)**
   - What we know: If a user somehow calls `/verify` again after the DB pre-check passes (race condition), the portal may return `already_verified`.
   - Recommendation: Treat portal `already_verified` as success — the nullifier is already valid. Try to write to DB; if it fails due to a constraint, return 409.

---

## Sources

### Primary (HIGH confidence)
- `https://docs.world.org/api-reference/developer-portal/verify-legacy.md` — v2 endpoint fields, success/error response, all error codes
- `https://docs.world.org/world-id/id/cloud` — cloud verification flow, nullifier storage guidance, duplicate detection responsibility
- `https://docs.world.org/world-id/idkit/error-codes.md` — IDKit error codes
- `apps/api/src/routes/chat.ts` — existing fetchUserContext, contextCache, invalidateContextCache patterns
- `apps/api/src/agent/context.ts` — UserContext interface, assembleContext injection format
- `apps/api/src/db/schema.ts` — confirms `worldId text` nullable column exists
- `apps/api/src/tools/update-memory.ts` — factory pattern, structured error returns, cache invalidation on write

### Secondary (MEDIUM confidence)
- `https://docs.world.org/world-id/reference/api` — v4 endpoint details (confirmed v2 still valid via error code reference)
- WebSearch results for v2 request/response format — cross-verified against official docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all libraries already installed and proven
- World ID v2 API: HIGH — fetched from official docs (`docs.world.org`) with full request/response schema
- Architecture patterns: HIGH — directly derived from existing codebase patterns (`update-memory.ts`, `chat.ts`)
- Pitfalls: HIGH — verified against official docs (error codes, duplicate handling responsibility, domain migration)
- Test gaps: HIGH — file inventory confirmed via filesystem scan

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (World ID API changes infrequently; hackathon scope limits exposure)
