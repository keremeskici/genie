# Roadmap: Genie

## Overview

Genie is built component-by-component in 6 phases optimized for a 36-hour hackathon sprint. The backend (apps/api) and frontend (apps/web) run in parallel tracks — Phase 6 (Mini App Shell) is independent work the frontend developer executes alongside Phases 3-5. The backend track moves agent infra first, then data persistence, then identity, then financial operations, then cross-chain and social features. Every phase closes with observable, testable behaviors before the next phase begins.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Agent Infra** - 0G Compute Adapter + Vercel AI SDK loop with dual-model routing (completed 2026-04-04)
- [x] **Phase 2: Data Layer** - Supabase + Drizzle schemas, 0G Storage KV for agent memory (completed 2026-04-04)
- [ ] **Phase 3: Identity** - World ID 4.0 verification and World Agent Kit classification
- [ ] **Phase 4: Financial Ops** - Smart contracts, balance check, send USDC, contact resolution
- [ ] **Phase 5: Cross-Chain & Social** - Arc CCTP deposits, spending tracking, debt management
- [ ] **Phase 6: Mini App Shell** - Next.js Mini App, MiniKit 2.0, chat UI, streaming (parallel track)

## Phase Details

### Phase 1: Agent Infra
**Goal**: The AI agent loop works end-to-end — inference routes through 0G Compute Adapter with dual-model routing and streaming tool calls
**Depends on**: Nothing (first phase)
**Requirements**: AGEN-01, AGEN-02, AGEN-03, AGEN-04, AGEN-05, AGEN-06
**Success Criteria** (what must be TRUE):
  1. A test prompt sent to the Hono API returns a streamed response routed through 0G Compute (localhost:8000)
  2. Financial planning prompts are handled by GLM-5 and tool-execution prompts are handled by DeepSeek V3
  3. The agent loop correctly calls a registered tool (e.g., `get_balance`) and incorporates the result into its reply
  4. The three-layer context (system prompt + user context + conversation history) is assembled correctly on every request
  5. Conversation history is bounded by sliding window with sticky messages — oldest non-sticky messages are dropped first
**Plans**: 2 plans
Plans:
- [x] 01-01-PLAN.md — Scaffold monorepo, 0G providers, context assembly, sliding window, system prompt
- [x] 01-02-PLAN.md — Classifier, tool stub, agent orchestrator, chat route wiring

### Phase 2: Data Layer
**Goal**: User data and agent memory persist reliably — Supabase stores structured data and 0G Storage KV stores cross-session agent context
**Depends on**: Phase 1
**Requirements**: AGEN-07
**Success Criteria** (what must be TRUE):
  1. After a conversation, user financial preferences and goals written to 0G Storage KV are readable in a subsequent fresh session
  2. Drizzle schema migrations apply cleanly to the Supabase database with correct tables for users, contacts, transactions, and debts
  3. Agent context loaded from 0G KV at session start is correctly injected into the user-context layer of the three-layer prompt
**Plans**: 4 plans
Plans:
- [x] 02-01-PLAN.md — Drizzle schema (users, contacts, transactions, debts), DB client, drizzle-kit push config
- [x] 02-02-PLAN.md — 0G KV service layer (AgentMemory type, read/write helpers, graceful fallback)
- [x] 02-03-PLAN.md — Context wiring (extend assembleContext with KV memory, cache in chat route)
- [x] 02-04-PLAN.md — Gap closure: wire writeMemory via update_memory tool, cache invalidation

### Phase 3: Identity
**Goal**: World ID proof-of-human is verified server-side and controls what actions users can take
**Depends on**: Phase 2
**Requirements**: WRID-01, WRID-02, WRID-03, WRID-04, WRID-05
**Success Criteria** (what must be TRUE):
  1. A user who has not verified can chat, check their balance, and receive money — but cannot send or create debts
  2. A user who completes World ID 4.0 verification gets their proof validated server-side and unlocks send money and debt tracking
  3. The server rejects gated actions (send, debt) with a clear error when presented with no or invalid World ID proof
  4. World Agent Kit correctly labels agents acting on behalf of verified users as human-backed and all others as bot
**Plans**: 2 plans
Plans:
- [x] 03-01-PLAN.md — Verify endpoint + UserContext isVerified extension + cache invalidation
- [x] 03-02-PLAN.md — Agent Kit classification, system prompt verification awareness, gating guard utility

### Phase 4: Financial Ops
**Goal**: Users can check their USDC balance and send USDC to contacts or addresses through natural language — backed by deployed smart contracts
**Depends on**: Phase 3
**Requirements**: FOPS-01, FOPS-02, FOPS-03, FOPS-04, FOPS-05, FOPS-06
**Success Criteria** (what must be TRUE):
  1. User can ask "what's my balance?" and receive their current USDC balance on World Chain
  2. User can say "send $10 to Alice" and the agent resolves Alice to a wallet address, then executes the transfer
  3. Transfers under the auto-approve threshold execute immediately without a confirmation step
  4. Transfers over the threshold pause and ask the user to confirm before executing
  5. GenieRouter and PayHandler contracts are deployed on World Chain and the API routes transfers through them
**Plans**: 3 plans
Plans:
- [x] 04-01-PLAN.md — Foundry contracts (GenieRouter + PayHandler), schema migration, viem clients + ABI exports
- [ ] 04-02-PLAN.md — Tools: get_balance upgrade, resolve_contact, send_usdc + on-chain transfer module
- [ ] 04-03-PLAN.md — POST /confirm endpoint + agent tool registration wiring

### Phase 5: Cross-Chain & Social
**Goal**: Users can deposit USDC from other chains and track spending and debts via natural language
**Depends on**: Phase 4
**Requirements**: XCHD-01, SPND-01, SPND-02, DEBT-01, DEBT-02
**Success Criteria** (what must be TRUE):
  1. User can initiate a USDC deposit from Ethereum, Base, or Arbitrum and it arrives on World Chain via Arc CCTP
  2. Agent automatically categorizes each transaction into food, transport, entertainment, bills, or transfers
  3. User can ask "how much did I spend on food this week?" and receive an accurate summary
  4. User can say "Alice owes me $30 for dinner" and the debt is recorded and retrievable
  5. When an incoming transfer matches an open debt, the agent automatically marks it as settled
**Plans**: TBD

### Phase 6: Mini App Shell
**Goal**: The frontend Mini App runs inside World App with a working chat interface, streaming responses, and contact management
**Depends on**: Phase 1 (API streaming endpoint must exist; can develop shell in parallel, integrate after Phase 3)
**Requirements**: MAPP-01, MAPP-02, MAPP-03, MAPP-04
**Success Criteria** (what must be TRUE):
  1. The Next.js app loads inside World App via MiniKit 2.0 SDK without errors
  2. User sees a dark-themed chat interface with neon blue accents and can type and submit messages
  3. AI responses stream token-by-token into the chat UI in real time
  4. User can add, list, and resolve contacts from within the app
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 (backend). Phase 6 runs in parallel from Phase 1 onward.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Agent Infra | 2/2 | Complete   | 2026-04-04 |
| 2. Data Layer | 4/4 | Complete   | 2026-04-04 |
| 3. Identity | 1/2 | In Progress|  |
| 4. Financial Ops | 1/3 | In Progress|  |
| 5. Cross-Chain & Social | 0/? | Not started | - |
| 6. Mini App Shell | 0/? | Not started | - |
