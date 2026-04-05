# Phase 2: Data Layer - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

User data and agent memory persistence. Supabase stores structured data (users, contacts, transactions, debts) via Drizzle ORM. 0G Storage KV stores cross-session agent context (financial profile, preferences, goals). This phase delivers the data layer that all subsequent phases build on — no identity verification, no financial operations, no frontend.

</domain>

<decisions>
## Implementation Decisions

### Supabase Schema Design
- **D-01:** Users table uses UUID as primary key, wallet address as required unique column, World ID as nullable column (added when user verifies in Phase 3)
- **D-02:** Contacts table links to other Genie users by wallet match when possible, with fallback to raw address + display name for external wallets
- **D-03:** Transactions table tracks only Genie-initiated transfers — no on-chain indexing of external transactions
- **D-04:** Schema synced via `drizzle-kit push` (no migration files) — fastest iteration for hackathon

### 0G KV Agent Memory
- **D-05:** Agent memory stores financial profile, interaction preferences, and active savings/budget goals with progress
- **D-06:** Single JSON blob per user under one KV key (e.g., `user:{uuid}:memory`) — simple read/write pattern
- **D-07:** Memory written after key moments (new goal set, preference stated, profile change) — not every turn, not only at session end

### Context Loading Flow
- **D-08:** Context loaded once at conversation start, cached for the session duration
- **D-09:** Cache invalidated and re-fetched when a certain time has passed since the last conversation
- **D-10:** Chat route is responsible for fetching context — checks for cached context first, fetches from Supabase + 0G KV if none exists
- **D-11:** KV memory merged into the existing user context injection message (extends the `[User context: ...]` string in `assembleContext`)

### User Bootstrap
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 0G Storage
- `.reference/genie-prd-v2.docx` — Product requirements doc with 0G KV integration details
- `.reference/genie-interaction-architecture.docx` — Interaction architecture reference

### Prior Codebase Reference
- `.reference/repomix-reference.xml` — Prior Genie codebase (reference only, not starting point per hackathon rules)

### Existing Code
- `apps/api/src/agent/context.ts` — Current `assembleContext` and `UserContext` interface that Phase 2 extends
- `apps/api/src/routes/chat.ts` — Chat route that will handle context fetching
- `apps/api/src/agent/providers.ts` — 0G Compute provider setup (pattern reference for 0G KV provider)

### Project Planning
- `.planning/REQUIREMENTS.md` — AGEN-07 mapped to this phase
- `.planning/phases/01-agent-infra/01-CONTEXT.md` — Phase 1 decisions on context architecture and tool patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `assembleContext()` in `agent/context.ts` — Three-layer context assembly, will be extended with KV memory data
- `UserContext` interface — Currently has `walletAddress`, `displayName`, `autoApproveUsd`; will grow to include KV-loaded fields
- `tools/` directory pattern — One file per tool with Zod schemas; same pattern for any memory-related tools

### Established Patterns
- Vercel AI SDK with `@ai-sdk/openai` provider — same SDK for any data-layer integrations
- Hono routes in `routes/` — chat route will add context-fetching middleware/logic
- Vitest for testing — schema and KV operations should follow same test pattern

### Integration Points
- `routes/chat.ts` — Add context cache check + fetch before calling agent
- `agent/context.ts` — Extend `UserContext` and `assembleContext` to include KV memory
- `agent/index.ts` — Agent orchestrator may need awareness of memory write triggers

</code_context>

<specifics>
## Specific Ideas

- Onboarding is two pages: intro + spending limit — this is a frontend concern (Phase 6) but the API must support the user creation endpoint with these fields
- Agent memory should make the agent "feel smart" across sessions — remembering goals, preferences, and financial personality
- Memory writes happen at meaningful moments, not mechanically — the agent should recognize when something worth remembering was said

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-data-layer*
*Context gathered: 2026-04-04*
