# Phase 4: Financial Ops - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can check their USDC balance and send USDC to contacts or addresses through natural language — backed by deployed smart contracts (GenieRouter + PayHandler) on World Chain. This phase delivers on-chain contract infrastructure, real balance lookups, send flow with confirmation, and recipient resolution in `apps/api`. No cross-chain bridging (Phase 5), no debt tracking (Phase 5), no frontend (Phase 6).

</domain>

<decisions>
## Implementation Decisions

### Smart Contract Architecture
- **D-01:** Router + handler architecture — GenieRouter is a funds-routing contract that pulls USDC from the user via `transferFrom` and sends to operation-specific handler contracts
- **D-02:** PayHandler is the first handler — receives USDC from GenieRouter, backend then calls PayHandler to execute the transfer to the final recipient
- **D-03:** Backend orchestrates the two-step flow: (1) call GenieRouter.route(amount, handlerAddress) to move funds, (2) call PayHandler.execute(recipient, amount) to complete the transfer
- **D-04:** Architecture is pluggable — future handlers (BridgeHandler, etc.) can be registered with the router for different operations
- **D-05:** User approves USDC to GenieRouter once during onboarding (page 2, spending limit page) for the amount they choose. Transactions work until that allowance is exhausted

### Recipient Resolution
- **D-06:** Three resolution paths: raw wallet address (0x...), World username (via World APIs), and contact display name (from local contacts table)
- **D-07:** Resolution priority: exact wallet address match → World username lookup → contact name search
- **D-08:** When multiple contacts match a name, agent lists all matches with wallet snippets and asks the user to pick
- **D-09:** Researcher should investigate World's identity/username resolution APIs at docs.world.org for optimal integration

### Confirmation Flow
- **D-10:** Transfers under `autoApproveUsd` threshold execute immediately without confirmation
- **D-11:** Transfers over threshold create a pending transaction in DB, return structured payload `{type: 'confirmation_required', txId, amount, recipient}` to the agent
- **D-12:** Separate `POST /confirm` endpoint completes the pending transaction when user confirms
- **D-13:** Pending transactions expire after a timeout (exact duration at Claude's discretion) — auto-cancelled if not confirmed

### On-Chain Interaction
- **D-14:** viem library for all World Chain interactions (TypeScript-native, tree-shakeable, works well with Bun)
- **D-15:** Server-side hot wallet — API holds a private key (env var `RELAYER_PRIVATE_KEY`) that acts as relayer, calling GenieRouter and PayHandler on behalf of users. Server pays gas.
- **D-16:** Foundry for Solidity development — forge compile, forge test, forge script for deployment
- **D-17:** World Chain RPC URL configured via env var (`WORLD_CHAIN_RPC_URL`)
- **D-18:** Real `get_balance` replaces Phase 1 stub — reads USDC balance from World Chain via viem publicClient

### Claude's Discretion
- Exact pending transaction timeout duration
- Foundry project structure within the monorepo (e.g., `packages/contracts/` or `contracts/`)
- Forge deploy script details and verification approach
- Error handling specifics for failed on-chain transactions
- Gas estimation and relay fee handling

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### World APIs
- `https://docs.world.org/` — World username resolution and identity APIs (user-referenced — research for recipient resolution D-09)

### Existing Code
- `apps/api/src/tools/get-balance.ts` — Phase 1 stub to replace with real USDC balance lookup
- `apps/api/src/tools/require-verified.ts` — Gating guard for verified-only tools (send_usdc must use this)
- `apps/api/src/agent/index.ts` — Agent orchestrator where new tools (send_usdc, resolve_contact) get registered
- `apps/api/src/agent/context.ts` — UserContext with `autoApproveUsd`, `isVerified`, `walletAddress`
- `apps/api/src/routes/chat.ts` — Chat route with context cache and fetchUserContext
- `apps/db/src/schema.ts` — Users, contacts, transactions tables (all already defined)

### Prior Context
- `.planning/phases/01-agent-infra/01-CONTEXT.md` — Tool registration pattern (D-11, D-12), 0G Compute routing
- `.planning/phases/02-data-layer/02-CONTEXT.md` — Schema design (D-01 through D-04), context loading (D-08 through D-11), user onboarding (D-12 through D-15)
- `.planning/phases/03-identity/03-CONTEXT.md` — Verification gating (D-06 through D-10), requireVerified pattern

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `requireVerified()` in `tools/require-verified.ts` — Gating guard, send_usdc must call this before executing
- `createUpdateMemoryTool()` factory pattern — Template for creating per-request tool instances with user context
- `getBalanceTool` in `tools/get-balance.ts` — Stub to replace with real on-chain USDC balance via viem
- Contacts table in `apps/db/src/schema.ts` — Ready for lookups with `displayName`, `walletAddress`, `genieUserId`
- Transactions table — Ready for recording sends with `senderUserId`, `recipientWallet`, `amountUsd`, `txHash`

### Established Patterns
- Vercel AI SDK `tool()` with Zod `inputSchema` — All new tools follow this pattern
- Tool factory pattern for tools needing user context (userId, memory, isVerified)
- Hono routes in `routes/` — New `/confirm` endpoint follows same pattern
- Vitest for testing — Tool tests follow existing patterns in `*.test.ts`

### Integration Points
- `agent/index.ts` — Register `send_usdc`, `resolve_contact` (and upgraded `get_balance`) in the tools object
- `routes/chat.ts` — Pass `userContext` and `userId` to new tool factories
- New `routes/confirm.ts` — Confirm pending transaction endpoint
- New Foundry project — Solidity contracts for GenieRouter + PayHandler
- `apps/db/src/schema.ts` — May need `status` column on transactions table for pending/confirmed/expired states

</code_context>

<specifics>
## Specific Ideas

- The protocol should be scalable — router + handler separation means new operation types only need a new handler contract, not changes to the router
- Onboarding page 2 (spending limit) doubles as the USDC approval step — user sets their limit AND approves the router in one flow
- World username resolution is a key differentiator — research docs.world.org thoroughly for the best API approach
- Backend orchestration (not contract-to-contract calls) keeps contracts simple and auditable

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-financial-ops*
*Context gathered: 2026-04-04*
