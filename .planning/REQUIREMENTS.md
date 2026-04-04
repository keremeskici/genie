# Requirements: Genie

**Defined:** 2026-04-04
**Core Value:** A single chat message can trigger a verified, human-backed financial transaction — send money, bridge USDC cross-chain, or plan savings — all inside World App with proof-of-human identity.

## v1 Requirements

Requirements for hackathon demo. Each maps to roadmap phases.

### World ID & Access Control

- [ ] **WRID-01**: User can verify as human via World ID 4.0 IDKit widget inline in chat
- [ ] **WRID-02**: Server validates World ID proofs before allowing gated actions (send, debt, goals)
- [ ] **WRID-03**: Unverified users can chat, view balance, and receive money
- [ ] **WRID-04**: Verified users unlock send money, debt tracking, and agent automation
- [x] **WRID-05**: Agent Kit classifies verified user agents as human-backed and unverified as bot

### AI Agent & Inference

- [x] **AGEN-01**: 0G Compute Adapter routes inference to decentralized GPU network
- [x] **AGEN-02**: GLM-5 handles financial planning and advisory responses
- [x] **AGEN-03**: DeepSeek V3 handles fast tool execution (send, balance, resolve)
- [x] **AGEN-04**: Vercel AI SDK agent loop with tool calling and streaming responses
- [x] **AGEN-05**: Three-layer context: system prompt + user context + conversation history
- [x] **AGEN-06**: Sliding window with sticky messages keeps context bounded
- [x] **AGEN-07**: 0G Storage KV persists user context (financial personality, goals, preferences) across sessions

### Financial Operations

- [x] **FOPS-01**: User can check USDC balance on World Chain via chat
- [x] **FOPS-02**: User can send USDC to contacts/addresses via natural language
- [x] **FOPS-03**: Agent resolves recipients via contacts, ENS, or wallet address
- [x] **FOPS-04**: Transfers under auto-approve threshold execute immediately
- [ ] **FOPS-05**: Transfers over threshold require explicit confirmation
- [x] **FOPS-06**: GenieRouter + PayHandler smart contracts handle transfers on World Chain

### Cross-Chain Deposits

- [~] **XCHD-01**: User can deposit USDC from Ethereum/Base/Arbitrum to World Chain via Arc CCTP (Deferred — Circle Bridge Kit incompatible with Mini App)

### Spending & Social

- [x] **SPND-01**: Agent categorizes transactions (food, transport, entertainment, bills, transfers)
- [ ] **SPND-02**: User can ask spending summaries ("how much did I spend this week?")
- [ ] **DEBT-01**: User can create debt entries ("Alice owes me $30 for dinner")
- [ ] **DEBT-02**: Agent auto-detects incoming transfers and marks debts as settled

### Mini App Shell

- [x] **MAPP-01**: Next.js 14 Mini App runs inside World App via MiniKit 2.0 SDK
- [x] **MAPP-02**: Chat-first interface with dark theme and neon blue accents
- [x] **MAPP-03**: Streaming AI responses render token-by-token
- [ ] **MAPP-04**: Contact management (add, list, resolve)

## v2 Requirements

Deferred to post-hackathon. Tracked but not in current roadmap.

### Spending & Planning

- **SAVE-01**: User can set savings goals with progress tracking
- **SAVE-02**: Agent suggests spending cuts based on transaction history
- **BUDG-01**: User can set budget limits per category with alerts

### Enhanced Features

- **NOTF-01**: Periodic debt reminder nudges
- **CONT-01**: Post-transfer contact save offer
- **VISI-01**: Receipt scanning via Qwen3 VL vision model

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Voice interface / Whisper | Post-hackathon, high complexity |
| Multi-language support | English only for demo |
| Admin dashboard | No time in 36h |
| Mobile-native app | Mini App inside World App |
| OAuth / social login | World ID is the identity layer |
| Real-time push notifications | Complexity too high for 36h |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGEN-01 | Phase 1 | Complete |
| AGEN-02 | Phase 1 | Complete |
| AGEN-03 | Phase 1 | Complete |
| AGEN-04 | Phase 7 | Complete |
| AGEN-05 | Phase 7 | Complete |
| AGEN-06 | Phase 1 | Complete |
| AGEN-07 | Phase 7 | Complete |
| WRID-01 | Phase 8 | Pending |
| WRID-02 | Phase 8 | Pending |
| WRID-03 | Phase 8 | Pending |
| WRID-04 | Phase 8 | Pending |
| WRID-05 | Phase 3 | Complete |
| FOPS-01 | Phase 7 | Pending |
| FOPS-02 | Phase 7 | Pending |
| FOPS-03 | Phase 7 | Pending |
| FOPS-04 | Phase 7 | Pending |
| FOPS-05 | Phase 9 | Pending |
| FOPS-06 | Phase 4 | Complete |
| XCHD-01 | Phase 5 | Deferred |
| SPND-01 | Phase 5 | Complete |
| SPND-02 | Phase 7 | Pending |
| DEBT-01 | Phase 7 | Pending |
| DEBT-02 | Phase 7 | Pending |
| MAPP-01 | Phase 6 | Complete |
| MAPP-02 | Phase 6 | Complete |
| MAPP-03 | Phase 7 | Complete |
| MAPP-04 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27 (12 reassigned to gap closure phases 7-9)
- Complete: 11 | Pending: 15 | Deferred: 1
- Unmapped: 0

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after roadmap creation — all 27 requirements mapped*
