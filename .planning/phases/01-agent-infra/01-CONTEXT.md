# Phase 1: Agent Infra - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

End-to-end AI agent loop: inference routes through 0G Compute Adapter with dual-model routing (GLM-5 + DeepSeek V3), Vercel AI SDK agent loop with tool calling and streaming, three-layer context architecture, and sliding window conversation management. This phase delivers the core backend runtime in `apps/api` — no frontend, no database, no identity.

</domain>

<decisions>
## Implementation Decisions

### Model Routing Strategy
- **D-01:** Small LLM classifier prompt (via DeepSeek V3 through 0G Compute) examines each user message and routes: planning/advisory prompts to GLM-5, action/tool-execution prompts to DeepSeek V3
- **D-02:** Default to GLM-5 when classifier is unsure or message is ambiguous
- **D-03:** Single model per request — no multi-step chaining between models within one user message
- **D-04:** All inference (including the classifier call) goes through 0G Compute Adapter — no direct cloud LLM APIs
- **D-05:** Both models stream responses
- **D-06:** Model routing is hidden from the user — Genie appears as a single assistant

### 0G Compute Adapter Integration
- **D-07:** Use Vercel AI SDK's OpenAI provider with baseURL pointed at the hosted 0G Compute Adapter URL — OpenAI-compatible API
- **D-08:** 0G Compute Adapter needs to be hosted somewhere accessible from Vercel (not just localhost) — research hosting options during planning (VPS, Railway, Fly.io, etc.)
- **D-09:** Adapter URL configured via `OG_COMPUTE_URL` environment variable — localhost:8000 in dev, hosted URL in production
- **D-10:** On failure: retry 2-3 times with backoff, then return a clear error to the user

### Tool Registration Design
- **D-11:** One file per tool in a `tools/` directory — e.g., `get-balance.ts`, `send-usdc.ts`
- **D-12:** Use Vercel AI SDK's native `tool()` format with Zod schemas — no custom wrappers
- **D-13:** Phase 1 registers only `get_balance` as a stub tool (returns hardcoded USDC balance) to prove the loop works
- **D-14:** Extensive error handling with verbose server-side logging (full request/response details, API call traces) for easy debugging. Errors are also returned to the model as tool results so it can explain them naturally to the user.

### Context & Sliding Window
- **D-15:** System prompt lives in a template file (`.txt` or `.md`) loaded and interpolated with user data at runtime
- **D-16:** 40-message sliding window for conversation history
- **D-17:** Sticky messages (never dropped): tool results containing balances/tx confirmations, user confirmation messages ("yes, send it" / "no, cancel"), and system/context layer messages
- **D-18:** Dropped messages are simply discarded — no async summarization (keep it simple for hackathon)

### Claude's Discretion
- Exact classifier prompt wording and format
- File naming conventions within `tools/` directory
- Template interpolation approach for system prompt
- Retry backoff strategy specifics (exponential, fixed, etc.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 0G Compute
- `.reference/genie-prd-v2.docx` — Product requirements doc with 0G integration details
- `.reference/genie-interaction-architecture.docx` — Interaction architecture reference

### Prior Codebase Reference
- `.reference/repomix-reference.xml` — Prior Genie codebase (reference only, not starting point per hackathon rules)

### Project Planning
- `.planning/REQUIREMENTS.md` — Full requirement list with AGEN-01 through AGEN-06 mapped to this phase
- `.planning/PROJECT.md` — Key decisions on two-model routing, 0G KV vs File Storage, component-first build order

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- No existing code — this is the first phase on a fresh repo

### Established Patterns
- None yet — this phase establishes the patterns all subsequent phases will follow
- Turborepo + pnpm monorepo with `apps/api` (Hono + Bun) and `apps/web` (Next.js 14)

### Integration Points
- `apps/api` is the home for all Phase 1 code
- Hono server will expose the chat endpoint that Phase 6 (Mini App) will call
- Tool stubs created here will be replaced with real implementations in Phases 4-5

</code_context>

<specifics>
## Specific Ideas

- Debugging must be easy: full request/response logging for all external API calls (especially 0G Compute, Etherscan, etc.) with clear terminal output
- 0G Compute Adapter hosting is a deployment concern that must be solved before demo — research hosting options during planning phase

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-agent-infra*
*Context gathered: 2026-04-04*
