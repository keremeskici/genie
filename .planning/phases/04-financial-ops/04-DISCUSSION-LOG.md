# Phase 4: Financial Ops - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 04-financial-ops
**Areas discussed:** Smart contract design, Recipient resolution, Confirmation flow, On-chain interaction

---

## Smart Contract Design

| Option | Description | Selected |
|--------|-------------|----------|
| Router + Handler pair | GenieRouter receives send requests and delegates to PayHandler which executes the USDC transferFrom. Two contracts with separation of concerns. | |
| Single contract | One GenieRouter contract that handles both routing logic and USDC transfers directly. | |
| No custom contracts | Skip smart contracts entirely — API calls USDC.transfer() directly. | |
| You decide | Claude picks simplest approach. | |

**User's choice:** Custom approach — Router pulls USDC and forwards to operation-specific handler contracts. Backend orchestrates by calling handlers separately after routing. Scalable architecture for future operations.

### Follow-up: Approval mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-approve GenieRouter | One-time USDC.approve(GenieRouter, maxUint256) during onboarding. | |
| Per-tx approve | Each transaction requires exact amount approval first. | |
| Permit (EIP-2612) | Gasless off-chain signatures. | |
| You decide | Claude picks. | |

**User's choice:** Custom — User approves USDC once on onboarding page 2 for the amount they determine. Transactions work until that allowance runs out.

### Follow-up: Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Router + PayHandler only | Deploy both, router has operation mapping, only PayHandler registered. | |
| Router + handler interface | Deploy both plus IOperationHandler interface for future handlers. | |
| You decide | Claude picks. | |

**User's choice:** Custom — Router is funds-routing only. Backend manually calls handler contracts for further operations. Keeps contracts simple.

---

## Recipient Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Contacts first, then ENS | Search contacts → ENS → ask for address. | |
| Contacts only | Only resolve from contacts list. | |
| Contacts + ENS + address | Full chain: contacts → ENS → raw address. | |
| You decide | Claude picks. | |

**User's choice:** Custom — Three paths: raw wallet address, World username (via World APIs at docs.world.org), and contact display name. Research World's identity APIs for best approach.

### Follow-up: Ambiguity

| Option | Description | Selected |
|--------|-------------|----------|
| Ask user to pick | Agent lists matches with wallet snippets, user chooses. | ✓ |
| Best match wins | Most recent or exact-match-first heuristic. | |
| You decide | Claude picks. | |

**User's choice:** Ask user to pick
**Notes:** Standard disambiguation — list all matches and let user choose.

---

## Confirmation Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Chat confirmation | Agent asks in text, user replies yes/no. | |
| Structured confirm | Agent returns structured confirmation card for frontend. | ✓ |
| You decide | Claude picks. | |

**User's choice:** Structured confirm
**Notes:** Frontend (Phase 6) will render confirm/cancel buttons.

### Follow-up: Backend handling

| Option | Description | Selected |
|--------|-------------|----------|
| Return pending tx object | Create pending tx in DB, return structured payload, /confirm endpoint completes it. | ✓ |
| Chat fallback + structured | Return structured payload AND text message for chat testing. | |
| You decide | Claude picks. | |

**User's choice:** Return pending tx object

### Follow-up: Timeout

| Option | Description | Selected |
|--------|-------------|----------|
| Expire after timeout | Pending tx auto-cancels after a set period. | ✓ |
| No expiry | Stays until confirmed or cancelled. | |
| You decide | Claude picks. | |

**User's choice:** Expire after timeout

---

## On-Chain Interaction

### Library

| Option | Description | Selected |
|--------|-------------|----------|
| viem | Modern, TypeScript-native, tree-shakeable. Works great with Bun. | ✓ |
| ethers.js v6 | Battle-tested, huge ecosystem. Heavier. | |
| You decide | Claude picks. | |

**User's choice:** viem

### Signing

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side hot wallet | API holds private key as relayer, pays gas. | ✓ |
| User wallet via MiniKit | Frontend sends txs via MiniKit wallet interface. | |
| Hybrid approach | Server for auto-approved, MiniKit for confirmed. | |
| You decide | Claude picks. | |

**User's choice:** Server-side hot wallet

### Toolchain

| Option | Description | Selected |
|--------|-------------|----------|
| Foundry | Fast compilation, Solidity-native tests, forge script for deploy. | ✓ |
| Hardhat | JavaScript/TypeScript ecosystem, familiar deploy scripts. | |
| You decide | Claude picks. | |

**User's choice:** Foundry

---

## Claude's Discretion

- Pending transaction timeout duration
- Foundry project placement in monorepo
- Forge deploy script details
- Error handling for failed on-chain txs
- Gas estimation approach

## Deferred Ideas

None — discussion stayed within phase scope
