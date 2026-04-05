# Genie

An AI-powered personal finance agent that lives inside [World App](https://world.org/world-app). Users interact with Genie through natural language to send USDC, track spending, manage debts, settle cross-chain payments, and more — all on [World Chain](https://world.org/world-chain).

Built as a monorepo with four packages: a Hono API server, a Next.js mini app, a shared database layer, and Solidity smart contracts.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [How It Works](#how-it-works)
- [Monorepo Structure](#monorepo-structure)
- [Apps](#apps)
  - [API](#api)
  - [Web](#web)
  - [DB](#db)
  - [Contracts](#contracts)
- [Agent System](#agent-system)
- [Available Tools](#available-tools)
- [Blockchain Integration](#blockchain-integration)
- [Authentication & Identity](#authentication--identity)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Development Commands](#development-commands)
- [Tech Stack](#tech-stack)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        World App (Mobile)                       │
│                    Wallet Auth / MiniKit SDK                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / SSE
┌──────────────────────────▼──────────────────────────────────────┐
│                     apps/web (Next.js 15)                        │
│   Chat UI  ·  Wallet View  ·  Send/Receive  ·  Profile          │
│   NextAuth v5  ·  World App Wallet Auth (SIWE)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST + SSE streaming
┌──────────────────────────▼──────────────────────────────────────┐
│                      apps/api (Hono)                             │
│                                                                  │
│  ┌─────────────┐   ┌───────────────┐   ┌────────────────────┐   │
│  │  Classifier  │──▶│ Model Router  │──▶│ Streaming Agent    │   │
│  │ (DeepSeek)   │   │ plan / action │   │ (Vercel AI SDK v6) │   │
│  └─────────────┘   └───────────────┘   └────────┬───────────┘   │
│                                                  │ tool calls    │
│  ┌───────────────────────────────────────────────▼───────────┐   │
│  │  Tools: send_usdc · get_balance · create_debt · ...       │   │
│  └───────────────────────────────────────────────────────────┘   │
└───────┬──────────────────┬───────────────────┬──────────────────┘
        │                  │                   │
   ┌────▼────┐      ┌─────▼─────┐      ┌──────▼──────┐
   │Supabase │      │ 0G Compute│      │ World Chain │
   │ (Postgres)│    │  (LLMs)   │      │  (on-chain) │
   └─────────┘      └───────────┘      └─────────────┘
```

---

## How It Works

1. **User sends a message** (e.g. "Send $20 to Alice for lunch") through the chat interface in World App.
2. **Intent classification** — A fast classifier model determines if the message is a "planning" query (informational) or an "action" query (requires tool execution), then routes to the appropriate LLM.
3. **Context assembly** — The agent loads the system prompt, user profile (wallet, display name, auto-approve threshold), persistent memory from 0G KV, and recent conversation history (sliding window of 40 messages).
4. **Tool execution** — The LLM calls tools as needed: resolve "Alice" to a wallet address, check balances, create a pending transaction. Up to 5 chained tool calls per turn.
5. **Confirmation flow** — Transfers above the user's auto-approve threshold (default $25) require explicit confirmation through the UI before executing on-chain.
6. **On-chain execution** — USDC moves through the GenieRouter and PayHandler smart contracts on World Chain, with the relayer handling gas.
7. **Auto-settlement** — When an incoming transfer matches an open debt (within $1 tolerance), Genie auto-settles the debt and notifies the user.

---

## Monorepo Structure

```
genie/
├── apps/
│   ├── api/            # Hono backend — agent orchestration, routes, tools
│   ├── web/            # Next.js 15 mini app — chat UI, wallet, auth
│   ├── db/             # Shared Drizzle ORM schema + client
│   └── contracts/      # Solidity smart contracts (Foundry)
├── package.json        # Root workspace config
├── pnpm-workspace.yaml # pnpm workspace definition
├── turbo.json          # Turborepo task pipeline
└── .env.example        # All environment variables documented
```

Managed with **pnpm workspaces** and **Turborepo** for parallel builds and shared dependencies.

---

## Apps

### API

**`apps/api`** — The core backend built on [Hono](https://hono.dev/) (a lightweight, edge-first web framework).

**Key routes:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Main streaming agent endpoint. Accepts messages + userId, returns SSE stream. |
| `/api/verify` | POST | World ID verification. Stores nullifier hash, unlocks debt features. |
| `/api/confirm` | POST | Confirms a pending high-value USDC transfer and executes it on-chain. |
| `/api/users/provision` | POST | Idempotent get-or-create user by wallet address. Returns userId + onboarding flag. |
| `/api/users/profile` | PATCH | Update user settings (e.g. auto-approve threshold). |
| `/api/balance` | GET | Check user's USDC balance on World Chain. |
| `/api/transactions` | GET | Query transaction history with filtering. |

**Key directories:**

| Path | Purpose |
|------|---------|
| `src/agent/` | Agent orchestration — classifier, context assembly, settlement logic, memory |
| `src/tools/` | LLM tool definitions (each a factory function that closes over userId + context) |
| `src/routes/` | HTTP route handlers |
| `src/chain/` | Blockchain interactions — transfers, CCTP bridging |
| `src/kv/` | 0G KV storage for persistent agent memory |
| `src/prompts/` | System prompt template |
| `src/contracts/` | Contract ABIs |

### Web

**`apps/web`** — A [Next.js 15](https://nextjs.org/) mini app designed to run inside World App using the [MiniKit SDK](https://docs.world.org/mini-apps).

**Key components:**

- **ChatInterface** — Streaming AI conversation with markdown rendering, confirmation cards, and contact disambiguation UI
- **WalletInterface** — Balance display and transaction history
- **SendModal / ReceiveModal** — Payment flows with QR codes
- **ProfileInterface** — User settings (auto-approve threshold, World ID verification status)
- **ApprovalOverlay** — On-chain ERC-20 allowance approval flow
- **Navigation** — Bottom tab bar (Chat, Wallet, Profile)

**Authentication flow:**

1. World App generates a wallet-signed nonce (SIWE — Sign-In With Ethereum)
2. Server verifies the signature and creates a NextAuth v5 JWT session (30-day expiry)
3. On first login, the backend provisions a user record and returns an onboarding flag

### DB

**`apps/db`** — Shared database package using [Drizzle ORM](https://orm.drizzle.team/) over PostgreSQL (hosted on [Supabase](https://supabase.com/)).

**Schema (4 tables):**

```
users
  id             UUID (PK)
  walletAddress  text (unique)
  worldId        text (nullable — set after World ID verification)
  displayName    text
  autoApproveUsd numeric (default 25)
  memoryRootHash text (0G KV pointer)
  createdAt      timestamp

contacts
  id             UUID (PK)
  ownerUserId    UUID (FK → users)
  walletAddress  text
  displayName    text
  genieUserId    UUID (nullable — if contact is also a Genie user)
  createdAt      timestamp

transactions
  id              UUID (PK)
  senderUserId    UUID (FK → users)
  recipientWallet text
  amountUsd       numeric
  txHash          text (nullable — set after on-chain confirmation)
  status          text (pending / confirmed / expired)
  expiresAt       timestamp
  category        text (food, transport, entertainment, bills, transfers)
  source          text
  createdAt       timestamp

debts
  id                UUID (PK)
  ownerUserId       UUID (FK → users)
  counterpartyWallet text
  amountUsd         numeric
  description       text
  settled           boolean (default false)
  iOwe              boolean
  createdAt         timestamp
```

**Exports:** `./` (client + schema + utils), `./schema` (table definitions), `./client` (pg client instance).

### Contracts

**`apps/contracts`** — Solidity smart contracts built with [Foundry](https://book.getfoundry.sh/).

**GenieRouter.sol** — Pulls USDC from a user's ERC-20 allowance via the relayer and routes it to the PayHandler. Owned by the relayer EOA.

**PayHandler.sol** — Receives USDC from the GenieRouter and executes the final transfer to the recipient. Also owned by the relayer.

**Flow:**
```
User approves USDC allowance to GenieRouter
  → Relayer calls GenieRouter.route()    (pulls USDC from user)
    → GenieRouter calls PayHandler.execute()  (sends USDC to recipient)
```

This two-contract pattern separates authorization (user's allowance) from execution (relayer-controlled), so users never need to hold ETH for gas.

**Deployed addresses (World Chain mainnet):**
- GenieRouter: `0x24079Ecda5eEd48a052Bbf795A54b05233B17102`
- PayHandler: `0x754F7fEaBf1950562c00f4e706cd8002f386F4e0`

---

## Agent System

The AI agent follows a 5-step orchestration pipeline on every user message:

### 1. Intent Classification

A fast classifier (DeepSeek V3 via 0G Compute) reads the user message and outputs one of two labels:

- **"planning"** — Informational queries, spending summaries, balance checks, conversation
- **"action"** — Requires tool execution: send money, create debt, settle payment

If classification fails, it defaults to "planning" (safe fallback).

### 2. Model Routing

Based on the classified intent, the agent selects the optimal model:

- **Planning queries** → A quality-focused model (configurable via `OG_PLANNING_MODEL`)
- **Action queries** → A fast, tool-capable model (configurable via `OG_ACTION_MODEL`)

Both models are served through [0G Compute](https://0g.ai/), a decentralized AI inference network that exposes an OpenAI-compatible API.

### 3. Context Assembly (Three Layers)

1. **System prompt** — The agent's personality, rules, and capabilities (from `system.md`, with current date interpolated)
2. **User context** — Wallet address, display name, auto-approve threshold, verification status, and persistent memory (financial profile, preferences, goals from 0G KV)
3. **Conversation history** — Recent messages, capped at a configurable sliding window (default 40 messages) to prevent context explosion

Context is cached in-memory for 30 minutes per user to avoid redundant database and KV fetches.

### 4. Streaming with Tool Calling

The agent uses [Vercel AI SDK v6](https://sdk.vercel.ai/) (`streamText()`) with up to 5 chained tool invocations per turn. Responses stream back to the client as Server-Sent Events (SSE).

### 5. Auto-Settlement

On each chat request, the settlement engine checks if any recent incoming transactions match open debts (by counterparty wallet + amount within $1 tolerance). Matched debts are auto-settled, and settlement notices are injected into the agent's context so it can mention them naturally.

---

## Available Tools

The agent has access to the following tools, instantiated per-request with the user's context:

| Tool | Description | Gate |
|------|-------------|------|
| `get_balance` | Check USDC balance on World Chain | None |
| `resolve_contact` | Resolve a name to a wallet address (DB contacts → World username API → direct address) | userId |
| `send_usdc` | Send USDC — auto-approves below threshold, requires confirmation above | userId |
| `get_spending` | Query spending by category and date range | userId |
| `create_debt` | Record a debt ("Alice owes me $30") | userId + World ID verified |
| `list_debts` | List all debts (owed and owing) | userId |
| `settle_crosschain_debt` | Bridge USDC via CCTP V2 to settle a debt on another chain | userId |
| `add_contact` | Save a contact to the address book | userId |
| `list_contacts` | View saved contacts | userId |
| `update_memory` | Persist financial profile, preferences, and goals to 0G KV | userId |

Each tool is a factory function that closes over the user's ID and context, ensuring clean per-request isolation with no shared mutable state.

---

## Blockchain Integration

### World Chain

Genie operates on [World Chain](https://world.org/world-chain) (Chain ID 480), a Layer 2 designed for the World App ecosystem.

- **USDC contract:** `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` (mainnet)
- **RPC:** Alchemy endpoints (configurable)
- **Client library:** [Viem](https://viem.sh/) v2.45 for all contract interactions

### CCTP V2 (Cross-Chain Transfer Protocol)

For cross-chain debt settlement, Genie integrates with Circle's [CCTP V2](https://developers.circle.com/stablecoins/cctp-getting-started):

- **Token Messenger:** `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` (World Chain)
- **Supported destinations:** Ethereum, Optimism, Arbitrum, Base
- **Flow:** Route USDC → Approve Token Messenger → DepositForBurn → ~15 min finality on destination

### Relayer Pattern

Users never need ETH for gas. The relayer (a server-controlled EOA) submits all on-chain transactions:

1. User approves USDC allowance to GenieRouter (one-time, via MiniKit)
2. When a send is confirmed, the relayer calls `GenieRouter.route()` → `PayHandler.execute()`
3. USDC moves from user's wallet to recipient in a single relayed transaction

---

## Authentication & Identity

### World App Wallet Auth

The mini app uses World App's embedded wallet for authentication:

1. Server generates a random nonce + HMAC signature
2. User signs the nonce with their World App wallet (SIWE message)
3. Server verifies the signature and issues a NextAuth v5 JWT (30-day max age)

### World ID Verification

Optional human verification through [World ID](https://world.org/world-id):

1. User initiates verification in the Profile tab
2. World App provides a zero-knowledge proof of personhood
3. Server verifies the proof via the World ID API and stores the nullifier hash
4. Verified users unlock debt tracking features (prevents Sybil abuse)

### User Provisioning

On first login, `POST /api/users/provision` creates a user record keyed by wallet address. This is idempotent — subsequent calls return the existing user. The response includes a `needsOnboarding` flag to trigger first-time setup flows.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **pnpm** >= 10.33 (`corepack enable && corepack prepare pnpm@10.33.0 --activate`)
- **Foundry** (for smart contracts): `curl -L https://foundry.paradigm.xyz | bash && foundryup`
- A **Supabase** project (or any PostgreSQL instance)
- An **0G Compute** endpoint (for LLM inference)

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/your-org/genie.git
cd genie

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp .env.example .env
# Fill in your values (see Environment Variables section below)

# 4. Push database schema to Supabase
pnpm --filter db db:push

# 5. Build smart contracts (optional)
cd apps/contracts && forge build && cd ../..

# 6. Start all apps in development mode
pnpm dev
```

This starts:
- **API server** on `http://localhost:3001`
- **Web app** on `http://localhost:3000`

---

## Environment Variables

Copy `.env.example` to `.env` and fill in the values. Here's what each section configures:

### Supabase / PostgreSQL

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (use Supabase transaction pooler port 6543) |

### 0G Compute (LLM Inference)

| Variable | Description |
|----------|-------------|
| `OG_COMPUTE_URL` | 0G Compute adapter endpoint (default: `http://localhost:8000`) |
| `OG_API_KEY` | API key for 0G Compute |
| `OG_PLANNING_MODEL` | Model for informational queries (e.g. `qwen-2.5-7b-instruct`) |
| `OG_ACTION_MODEL` | Model for tool-calling actions (e.g. `qwen-2.5-7b-instruct`) |

### 0G KV Storage (Optional)

| Variable | Description |
|----------|-------------|
| `OG_KV_CLIENT_URL` | 0G KV client endpoint |
| `OG_PRIVATE_KEY` | Private key for KV writes |
| `OG_KV_STREAM_ID` | KV stream identifier |

If omitted, the agent runs without persistent memory (graceful degradation).

### World ID

| Variable | Description |
|----------|-------------|
| `WORLD_APP_ID` | Your World App registration ID |
| `WORLD_ACTION` | Action name for verification (e.g. `verify-human`) |
| `WORLD_VERIFY_API_URL` | World ID verification API endpoint |
| `WORLD_USERNAME_API_URL` | World username resolution API endpoint |

### World Chain / Financial Ops

| Variable | Description |
|----------|-------------|
| `WORLD_CHAIN_RPC_URL` | World Chain RPC endpoint (Alchemy) |
| `WORLD_CHAIN_TESTNET` | `true` for Sepolia testnet, `false` for mainnet |
| `RELAYER_PRIVATE_KEY` | Private key for the relayer EOA (submits on-chain txs) |
| `GENIE_ROUTER_ADDRESS` | Deployed GenieRouter contract address |
| `PAY_HANDLER_ADDRESS` | Deployed PayHandler contract address |
| `USDC_ADDRESS_TESTNET` | USDC token address on World Chain Sepolia |
| `USDC_ADDRESS_MAINNET` | USDC token address on World Chain mainnet |

### API Server

| Variable | Description |
|----------|-------------|
| `PORT` | API server port (default: `3001`) |
| `MAX_OUTPUT_TOKENS` | Max LLM output tokens per turn (default: `2048`) |
| `WINDOW_LIMIT` | Sliding window size for conversation history (default: `40`) |

### Web / Next.js

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | API endpoint (exposed to browser) |
| `NEXT_PUBLIC_APP_ID` | World App ID (client-side) |
| `NEXT_PUBLIC_APP_ENV` | `development` or `production` |
| `NEXT_PUBLIC_WORLD_ACTION` | Action name (client-side) |
| `AUTH_SECRET` | NextAuth JWT signing secret |
| `HMAC_SECRET_KEY` | Key for nonce HMAC signatures |
| `RP_SIGNING_KEY` | Relying party signing key |
| `RP_ID` | Relying party identifier |

---

## Development Commands

### Root (all packages)

```bash
pnpm dev          # Start all apps in parallel (Turbo)
pnpm build        # Build all apps (topological order)
pnpm test         # Run all tests
```

### API (`apps/api`)

```bash
pnpm --filter api dev       # Start with nodemon file watching
pnpm --filter api test      # Run Vitest
```

### Web (`apps/web`)

```bash
pnpm --filter web dev       # Next.js dev server (port 3000)
pnpm --filter web build     # Production build
```

### Database (`apps/db`)

```bash
pnpm --filter db db:push       # Push schema changes to database
pnpm --filter db db:studio     # Open Drizzle Studio (web UI for browsing data)
pnpm --filter db db:generate   # Generate schema TypeScript from DB
pnpm --filter db db:clear      # Reset database (destructive)
```

### Contracts (`apps/contracts`)

```bash
cd apps/contracts
forge build     # Compile contracts
forge test      # Run tests
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces, Turborepo |
| Backend | Node.js, Hono 4.12, TypeScript |
| Frontend | Next.js 15, React 19, Tailwind CSS 4 |
| Database | PostgreSQL (Supabase), Drizzle ORM |
| AI / LLM | Vercel AI SDK v6, 0G Compute (decentralized inference) |
| Blockchain | Viem, World Chain (L2), CCTP V2 |
| Smart Contracts | Solidity 0.8.20, Foundry |
| Auth | NextAuth v5, SIWE (Sign-In With Ethereum) |
| Identity | World ID (zero-knowledge proof of personhood) |
| UI Components | @worldcoin/mini-apps-ui-kit-react, Iconoir |
| Memory | 0G KV (decentralized key-value storage) |
| Testing | Vitest |
