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
- [x] **Phase 5: Cross-Chain & Social** - Arc CCTP deposits, spending tracking, debt management (completed 2026-04-04)
- [x] **Phase 6: Mini App Shell** - Next.js Mini App, MiniKit 2.0, chat UI, streaming (parallel track) (completed 2026-04-04)
- [x] **Phase 7: API Wiring** - Path alignment + user provisioning to fix frontend-backend integration (gap closure) (completed 2026-04-04)
- [x] **Phase 8: Identity Wiring** - Verify-proof fix + auth boundary enforcement (gap closure) (completed 2026-04-05, remaining gaps → Phase 15)
- [~] **Phase 9: Confirmation Flow** - Wire frontend confirm UI for over-threshold USDC transfers (superseded → Phase 12)
- [x] **Phase 10: Onboarding Contract Allowance** - StepBudget triggers USDC.approve for GenieRouter (completed 2026-04-05)
- [x] **Phase 11: Live Balance Display** - Balance REST endpoint + DashboardInterface wiring (completed 2026-04-05)
- [x] **Phase 12: Send Integration + Cross-Chain** - SendModal → send_usdc API + Circle Bridge Kit + ConfirmCard fix (completed 2026-04-05)
- [ ] **Phase 13: Recent Transactions** - Transactions REST endpoint + DashboardInterface wiring
- [ ] **Phase 14: Chat Interface Polish** - Full chat→agent flow, system prompt fixes, profile save wiring
- [ ] **Phase 15: Wallet Tab Completion** - Balance + transactions + World ID verification on wallet tab + auth guards

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
**Plans**: TBD

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
**Plans**: 4 plans
Plans:
- [x] 06-01-PLAN.md — Install streaming deps, rewrite ChatInterface with useChat v5, react-markdown, thinking indicator
- [x] 06-02-PLAN.md — ContactCard component, MiniKit haptics, Profile World ID verify integration
- [x] 06-03-PLAN.md — MiniKit Pay for USDC transfers, wallet signing, permission requests
- [x] 06-04-PLAN.md — Gap closure: env var fix, add_contact + list_contacts tools, contact selection wiring
**UI hint**: yes

### Phase 7: API Wiring — Path Alignment + User Provisioning
**Goal**: Frontend-to-backend integration works end-to-end — API paths match, user identity resolves correctly, and all chat/tool flows connect
**Depends on**: Phase 6 (frontend exists), Phase 1-5 (backend exists)
**Requirements**: AGEN-04, AGEN-05, AGEN-07, MAPP-03, FOPS-01, FOPS-02, FOPS-03, FOPS-04, SPND-02, DEBT-01, DEBT-02, MAPP-04
**Gap Closure:** Closes audit bugs #1 (path mismatch) and #2 (userId mismatch)
**Success Criteria** (what must be TRUE):
  1. Frontend ChatInterface sends a message and receives a streamed response from the Hono backend (no 404)
  2. A wallet-authenticated user is provisioned in the users table and all DB queries resolve to the correct UUID
  3. Agent tools (balance, send, contacts, debts, spending) are reachable from the frontend chat flow
  4. 0G KV keys use the correct user identifier consistently
**Plans**: 4 plans
Plans:
- [x] 07-01-PLAN.md — API path alignment, resolveUserId, verify-proof BFF fix, redirect uncomment
- [x] 07-02-PLAN.md — Auth callback provisioning, session UUID augmentation, onboarding redirect
- [x] 07-03-PLAN.md — Onboarding threshold wiring (PATCH /api/users/profile)
- [ ] 07-04-PLAN.md — Gap closure: requirements accounting, must_have truth fix, orphaned requirement cleanup

### Phase 8: Identity Wiring — Verify-Proof Fix + Auth Boundary
**Goal**: World ID verification persists to the database and protected routes enforce authentication
**Depends on**: Phase 7 (API paths must work first)
**Requirements**: WRID-01, WRID-02, WRID-03, WRID-04
**Gap Closure:** Closes audit bugs #3 (verify path/body) and #5 (redirect commented out)
**Success Criteria** (what must be TRUE):
  1. BFF verify-proof validates with World ID Cloud API then sends slim payload (userId + nullifier_hash) to backend
  2. After verification, the user's worldId is written to the database
  3. Protected routes redirect unauthenticated users to the landing page
  4. isVerified correctly reflects database state after World ID verification
**Plans**: 2 plans
Plans:
- [x] 08-01-PLAN.md — Simplify backend verify (slim schema, remove double Cloud API call) + BFF slim payload + test updates
- [x] 08-02-PLAN.md — Middleware auth redirect + Verify component env var/onVerified + rp-signature session guard

### Phase 9: Confirmation Flow
**Goal**: Over-threshold USDC transfers show a confirmation UI and execute upon user approval
**Depends on**: Phase 7 (chat flow must work), Phase 8 (verification gating must work)
**Requirements**: FOPS-05
**Gap Closure:** Closes audit bug #4 (no frontend confirm caller)
**Success Criteria** (what must be TRUE):
  1. When send_usdc returns confirmation_required, the chat UI renders a confirm/cancel button
  2. Clicking confirm calls POST /confirm with the correct txId
  3. The transaction executes after confirmation and the user sees a success message
**Plans**: 1 plan
Plans:
- [ ] 09-01-PLAN.md — ConfirmCard component, system prompt update, ChatInterface wiring

### Phase 10: Onboarding Contract Allowance
**Goal**: When user sets their spending limit in onboarding, the app calls USDC.approve(GenieRouter, amount) via MiniKit wallet signing — without this, no transfers can execute
**Depends on**: Phase 7 (user provisioning must work)
**Requirements**: FOPS-04, FOPS-06
**Success Criteria** (what must be TRUE):
  1. StepBudget triggers a USDC approval transaction for the GenieRouter contract address
  2. The approval amount matches the user's chosen spending limit
  3. User signs the transaction via MiniKit wallet
  4. After approval, GenieRouter can pull USDC up to the approved amount
**Plans**: 1 plan
Plans:
- [x] 10-01-PLAN.md — ApprovalOverlay component, contracts constants, onboarding wiring

### Phase 11: Live Balance Display
**Goal**: Dashboard shows the user's real USDC balance fetched from the blockchain
**Depends on**: Phase 10 (wallet must be connected)
**Requirements**: FOPS-01
**Success Criteria** (what must be TRUE):
  1. A new GET /api/balance?wallet= endpoint returns the user's on-chain USDC balance
  2. DashboardInterface displays the real balance instead of hardcoded $0.00
  3. Balance refreshes on page load and after transactions
**Plans**: 1 plan
Plans:
- [x] 11-01-PLAN.md — Balance REST endpoint + useBalance hook + DashboardInterface wiring

### Phase 12: Send Integration + Cross-Chain
**Goal**: SendModal executes real USDC transfers via the backend, with cross-chain support via Circle Bridge Kit
**Depends on**: Phase 11 (balance must be visible to verify sends)
**Requirements**: FOPS-02, FOPS-03, FOPS-04, FOPS-05, XCHD-01
**Absorbs**: Phase 9 (ConfirmCard URL fix)
**Success Criteria** (what must be TRUE):
  1. SendModal calls send_usdc via API with recipient address and amount
  2. Destination chain selector: World Chain uses send_usdc, other chains use Circle Bridge Kit (settle_crosschain_debt)
  3. Over-threshold sends show ConfirmCard with working confirm/cancel (fixes /confirm → /api/confirm URL bug)
  4. Under-threshold sends auto-execute and show success
**Plans**: 2 plans
Plans:
- [x] 12-01-PLAN.md — Backend: bridgeUsdc utility, POST /api/send route, settle_crosschain_debt refactor, tests
- [x] 12-02-PLAN.md — Frontend: SendModal rewrite (fetch /api/send), ConfirmCard URL fix, DashboardInterface wiring

### Phase 13: Recent Transactions
**Goal**: Dashboard and wallet tab show real transaction history from the database
**Depends on**: Phase 12 (need real transactions to display)
**Requirements**: SPND-01
**Success Criteria** (what must be TRUE):
  1. A new GET /api/transactions?userId= endpoint returns recent transactions
  2. DashboardInterface recent transactions section shows real data instead of mock
  3. Transactions show amount, recipient/sender, timestamp, and direction
**Plans**: TBD

### Phase 14: Chat Interface Polish
**Goal**: Chat-to-agent flow works end-to-end with all tools, system prompt improvements, and profile spending limit persistence
**Depends on**: Phase 12 (send flow must work for chat-initiated sends)
**Requirements**: AGEN-04, MAPP-03, MAPP-04
**Success Criteria** (what must be TRUE):
  1. Chat messages stream from backend agent with tool results rendered correctly
  2. System prompt includes contact_list JSON format for disambiguation UI consistency
  3. ProfileInterface spending limit save calls PATCH /api/users/profile (not just local state)
**Plans**: TBD

### Phase 15: Wallet Tab Completion
**Goal**: Wallet tab shows live balance, transaction history, and World ID verification — with auth guards on sensitive endpoints
**Depends on**: Phase 11 (balance endpoint), Phase 13 (transactions endpoint)
**Requirements**: WRID-01, WRID-02, WRID-03, WRID-04
**Absorbs**: Remaining Phase 8 gaps (Verify onVerified callback)
**Success Criteria** (what must be TRUE):
  1. Wallet tab displays real USDC balance (reuses Phase 11 endpoint)
  2. Wallet tab shows recent transactions (reuses Phase 13 endpoint)
  3. Verify component with onVerified callback is integrated into wallet tab
  4. Auth/session guards added to /api/confirm and /api/users/profile endpoints
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 (backend). Phase 6 runs in parallel from Phase 1 onward.
Gap closure phases 7-9 run sequentially after all original phases.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Agent Infra | 2/2 | Complete | 2026-04-04 |
| 2. Data Layer | 4/4 | Complete | 2026-04-04 |
| 3. Identity | 1/2 | In Progress | |
| 4. Financial Ops | 0/? | Not started | - |
| 5. Cross-Chain & Social | 3/3 | Complete | 2026-04-04 |
| 6. Mini App Shell | 4/4 | Complete | 2026-04-04 |
| 7. API Wiring | 4/4 | In Progress | - |
| 8. Identity Wiring | 2/2 | Complete | 2026-04-05 |
| 9. Confirmation Flow | — | Superseded | → Phase 12 |
| 10. Onboarding Allowance | 1/1 | Complete    | 2026-04-05 |
| 11. Live Balance Display | 1/1 | Complete   | 2026-04-05 |
| 12. Send + Cross-Chain | 2/2 | Complete   | 2026-04-05 |
| 13. Recent Transactions | 0/? | Not started | - |
| 14. Chat Interface Polish | 0/? | Not started | - |
| 15. Wallet Tab Completion | 0/? | Not started | - |
