# Phase 3: Identity - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

World ID proof-of-human verification and action gating. Server-side proof validation controls what users can do: unverified users chat freely, check balance, and receive money; verified users unlock send, debt tracking, and agent automation. World Agent Kit classifies verified user agents as human-backed. This phase delivers identity middleware and verification endpoints in `apps/api` — no financial operations, no frontend widget (Phase 6), no cross-chain.

</domain>

<decisions>
## Implementation Decisions

### Verification Flow
- **D-01:** Dedicated `POST /verify` endpoint receives World ID proof from frontend (IDKit widget sends `proof`, `merkle_root`, `nullifier_hash`, `verification_level`)
- **D-02:** Server validates proof via World ID Cloud API (`https://developer.worldcoin.org/api/v2/verify/{app_id}`) — no on-chain verification for hackathon
- **D-03:** On successful verification, store `nullifier_hash` in `users.worldId` column (already nullable text in schema) and return success
- **D-04:** Reject duplicate nullifier hashes — one World ID per Genie account (sybil resistance)
- **D-05:** World ID app_id and action configured via environment variables (`WORLD_APP_ID`, `WORLD_ACTION`)

### Action Gating Strategy
- **D-06:** Per-tool gating — each tool that requires verification checks `userContext.isVerified` before executing
- **D-07:** Gated actions: send USDC, create debt, set goals. Ungated: chat, check balance, receive money, view transactions
- **D-08:** Gated tools return a structured error with a clear message: "This action requires World ID verification. Please verify to continue."
- **D-09:** `isVerified` boolean derived from `users.worldId !== null` — added to `UserContext` interface
- **D-10:** Chat route's `fetchUserContext` already loads user from DB — extend to set `isVerified` from worldId column presence

### World Agent Kit Classification
- **D-11:** Classify at request time in chat route — check if user has worldId set, pass `isHumanBacked` flag through agent context
- **D-12:** Classification is a metadata flag on the agent context, not a separate SDK integration — keep it lightweight for hackathon
- **D-13:** System prompt includes verification status so the agent knows what actions it can offer the user

### Proof Storage & Session
- **D-14:** Verification state persists via DB — `users.worldId` column presence means verified, null means unverified
- **D-15:** No separate session/JWT for verification — checked on every request via cached user context (same 30-min cache from Phase 2)
- **D-16:** Re-verification not required within cache TTL — once verified, stays verified until cache expires and re-fetches from DB (which will still have worldId)

### Claude's Discretion
- Exact World ID Cloud API request/response handling and error codes
- Verification endpoint error response format details
- How system prompt communicates verification status to the agent
- Whether to add a `verifiedAt` timestamp column or just use worldId presence

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### World ID
- `.reference/genie-prd-v2.docx` — Product requirements doc with World ID 4.0 integration details
- `.reference/genie-interaction-architecture.docx` — Interaction architecture with verification flow

### World Agent Kit
- `.reference/genie-prd-v2.docx` — Agent Kit classification requirements (human-backed vs bot)

### Existing Code
- `apps/api/src/routes/chat.ts` — Chat route with context cache, fetchUserContext — extend with isVerified
- `apps/api/src/agent/context.ts` �� UserContext interface — extend with isVerified boolean
- `apps/api/src/db/schema.ts` — Users table with nullable worldId column already in place
- `apps/api/src/tools/get-balance.ts` — Tool pattern reference (ungated tool)
- `apps/api/src/tools/update-memory.ts` — Tool with factory pattern (gated tools will follow similar pattern)

### Prior Context
- `.planning/phases/01-agent-infra/01-CONTEXT.md` — Tool registration pattern (D-11, D-12)
- `.planning/phases/02-data-layer/02-CONTEXT.md` — Schema design (D-01: worldId nullable), context loading flow (D-08 through D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `users.worldId` column — already exists as nullable text, ready for nullifier hash storage
- `fetchUserContext()` in chat.ts — already loads user from DB, extend to derive isVerified
- `contextCache` — 30-min TTL cache means verification status is checked per-session
- `tool()` pattern from ai SDK — gated tools follow same pattern with verification check added

### Established Patterns
- Hono routes in `routes/` — verification endpoint follows same pattern as chat route
- Tool factory pattern (`createUpdateMemoryTool`) — gated tools can use similar factory with userId + isVerified
- Per-tool error handling — tools return structured errors (not throw), matches D-08 gating error pattern

### Integration Points
- `routes/chat.ts` — Extend `fetchUserContext` to set `isVerified` from worldId column
- `agent/context.ts` — Add `isVerified: boolean` to `UserContext` interface, include in `assembleContext` output
- `agent/index.ts` — Pass isVerified through to tool factories for gated tools
- New `routes/verify.ts` — World ID proof validation endpoint
- No middleware directory needed — gating is per-tool, not per-route

</code_context>

<specifics>
## Specific Ideas

- Verification should feel seamless — user taps verify in chat, IDKit opens, proof comes back, server validates, user is immediately unlocked
- Agent should proactively mention verification when user tries a gated action: "I can't send money yet — you'll need to verify with World ID first"
- The isVerified flag should be visible in the system prompt so the agent naturally adapts its suggestions

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-identity*
*Context gathered: 2026-04-04*
