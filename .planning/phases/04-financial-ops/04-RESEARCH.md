# Phase 4: Financial Ops - Research

**Researched:** 2026-04-04
**Domain:** Solidity smart contracts (Foundry), viem on-chain interactions, World Chain, World username API, Hono API patterns
**Confidence:** HIGH

## Summary

Phase 4 wires real on-chain financial operations into the existing Hono API. The work splits into three distinct areas: (1) a Foundry Solidity project for GenieRouter + PayHandler contracts deployed on World Chain, (2) viem-based on-chain interactions replacing the Phase 1 stub, and (3) new Vercel AI SDK tools (get_balance upgrade, send_usdc, resolve_contact) and a confirm endpoint following established project patterns.

The good news: viem already has `worldchain` (chain ID 480) and `worldchainSepolia` (chain ID 4801) built into `viem/chains` — no `defineChain` call needed. Foundry is already installed on the machine (forge 1.5.1-stable). The World username resolution API at `usernames.worldcoin.org` has a clean REST interface for username-to-address lookups. The transactions table in `apps/db/src/schema.ts` needs a `status` column added before pending confirmation flow can work.

**Primary recommendation:** Build the contracts package first at `apps/contracts/` using `forge init --no-git`, deploy to World Chain Sepolia for testing, then wire viem clients against deployed addresses. All new API tools follow the existing factory pattern from `createUpdateMemoryTool`.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Smart Contract Architecture**
- D-01: Router + handler architecture — GenieRouter is a funds-routing contract that pulls USDC from the user via `transferFrom` and sends to operation-specific handler contracts
- D-02: PayHandler is the first handler — receives USDC from GenieRouter, backend then calls PayHandler to execute the transfer to the final recipient
- D-03: Backend orchestrates the two-step flow: (1) call GenieRouter.route(amount, handlerAddress) to move funds, (2) call PayHandler.execute(recipient, amount) to complete the transfer
- D-04: Architecture is pluggable — future handlers (BridgeHandler, etc.) can be registered with the router for different operations
- D-05: User approves USDC to GenieRouter once during onboarding (page 2, spending limit page) for the amount they choose. Transactions work until that allowance is exhausted

**Recipient Resolution**
- D-06: Three resolution paths: raw wallet address (0x...), World username (via World APIs), and contact display name (from local contacts table)
- D-07: Resolution priority: exact wallet address match → World username lookup → contact name search
- D-08: When multiple contacts match a name, agent lists all matches with wallet snippets and asks the user to pick
- D-09: Researcher should investigate World's identity/username resolution APIs at docs.world.org for optimal integration

**Confirmation Flow**
- D-10: Transfers under `autoApproveUsd` threshold execute immediately without confirmation
- D-11: Transfers over threshold create a pending transaction in DB, return structured payload `{type: 'confirmation_required', txId, amount, recipient}` to the agent
- D-12: Separate `POST /confirm` endpoint completes the pending transaction when user confirms
- D-13: Pending transactions expire after a timeout (exact duration at Claude's discretion) — auto-cancelled if not confirmed

**On-Chain Interaction**
- D-14: viem library for all World Chain interactions (TypeScript-native, tree-shakeable, works well with Bun)
- D-15: Server-side hot wallet — API holds a private key (env var `RELAYER_PRIVATE_KEY`) that acts as relayer, calling GenieRouter and PayHandler on behalf of users. Server pays gas.
- D-16: Foundry for Solidity development — forge compile, forge test, forge script for deployment
- D-17: World Chain RPC URL configured via env var (`WORLD_CHAIN_RPC_URL`)
- D-18: Real `get_balance` replaces Phase 1 stub — reads USDC balance from World Chain via viem publicClient

### Claude's Discretion
- Exact pending transaction timeout duration
- Foundry project structure within the monorepo (e.g., `packages/contracts/` or `contracts/`)
- Forge deploy script details and verification approach
- Error handling specifics for failed on-chain transactions
- Gas estimation and relay fee handling

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOPS-01 | User can check USDC balance on World Chain via chat | viem `publicClient.readContract` with `erc20Abi` + `balanceOf` against USDC address `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` |
| FOPS-02 | User can send USDC to contacts/addresses via natural language | `send_usdc` tool factory calling GenieRouter.route() then PayHandler.execute() via `walletClient.writeContract` |
| FOPS-03 | Agent resolves recipients via contacts, ENS, or wallet address | `resolve_contact` tool: 0x check → World username API GET `/api/v1/{name}` → DB contacts fuzzy match |
| FOPS-04 | Transfers under auto-approve threshold execute immediately | `autoApproveUsd` in UserContext compared to amount; direct execution path in `send_usdc` |
| FOPS-05 | Transfers over threshold require explicit confirmation | Pending transactions with `status='pending'` in DB; `POST /confirm` route; 15-minute expiry |
| FOPS-06 | GenieRouter + PayHandler smart contracts handle transfers on World Chain | Foundry project at `apps/contracts/`; forge test; forge script --broadcast deploy |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| viem | 2.47.10 (npm) / 2.45.3 (installed) | On-chain reads/writes, contract interaction | Locked D-14; TypeScript-native, tree-shakeable, Bun-compatible |
| Foundry (forge) | 1.5.1-stable (installed) | Solidity compile, test, deploy | Locked D-16; already installed on machine |
| Hono | 4.12.10 (installed) | New `/confirm` route | Existing project standard |
| Drizzle ORM | 0.45.2 (installed) | Transactions table update, pending tx queries | Existing project standard |
| Zod | 3.24.6 (installed) | Tool inputSchema validation | Vercel AI SDK pattern |
| Vitest | latest (installed) | Unit tests for new tools | Existing project standard |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `viem/accounts` (privateKeyToAccount) | bundled with viem | Server-side relayer wallet | Creating walletClient from `RELAYER_PRIVATE_KEY` env var |
| `erc20Abi` from viem | bundled | Standard ERC20 ABI | Balance reads, no need to define custom ABI |
| World Username API | REST (no npm package) | Username → wallet address resolution | resolve_contact tool, D-06/D-07 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| viem (locked) | ethers.js | ethers already installed but not tree-shakeable, viem is locked per D-14 |
| Foundry (locked) | Hardhat | Foundry is faster, already installed, locked per D-16 |
| In-process pending tx Map | Redis | Redis not available; DB `status` column is sufficient and consistent |

**Installation:**
```bash
# viem not yet installed in apps/api — add it
cd apps/api && pnpm add viem
```

**Version verification (2026-04-04):** `npm view viem version` → `2.47.10` (published 2026-04-04). Installed in workspace is `2.45.3` from pnpm store. Install latest into `apps/api`.

---

## Architecture Patterns

### Recommended Project Structure

```
apps/
├── api/src/
│   ├── tools/
│   │   ├── get-balance.ts          # REPLACE stub with real viem readContract
│   │   ├── send-usdc.ts            # NEW factory tool (verified-gated)
│   │   └── resolve-contact.ts     # NEW factory tool (contact + World API)
│   ├── routes/
│   │   ├── chat.ts                 # Existing — no changes needed
│   │   ├── verify.ts               # Existing — no changes needed
│   │   └── confirm.ts              # NEW — POST /confirm endpoint
│   ├── chain/
│   │   └── clients.ts              # NEW — viem publicClient + walletClient singletons
│   └── agent/
│       └── index.ts                # Register send_usdc, resolve_contact; upgrade get_balance
├── contracts/                      # NEW Foundry project (forge init --no-git)
│   ├── foundry.toml
│   ├── src/
│   │   ├── GenieRouter.sol
│   │   └── PayHandler.sol
│   ├── test/
│   │   ├── GenieRouter.t.sol
│   │   └── PayHandler.t.sol
│   └── script/
│       └── Deploy.s.sol
apps/db/src/
└── schema.ts                       # ADD status column to transactions table
```

### Pattern 1: viem Client Singletons (chain/clients.ts)

**What:** Create publicClient and walletClient once at module load, export as singletons.
**When to use:** All on-chain calls in tools — avoids re-creating clients per request.

```typescript
// apps/api/src/chain/clients.ts
// Source: viem docs + installed worldchain chain definition

import { createPublicClient, createWalletClient, http } from 'viem';
import { worldchain, worldchainSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const isTestnet = process.env.WORLD_CHAIN_TESTNET === 'true';
const chain = isTestnet ? worldchainSepolia : worldchain;
const rpcUrl = process.env.WORLD_CHAIN_RPC_URL; // override default if set

export const publicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const relayerKey = process.env.RELAYER_PRIVATE_KEY as `0x${string}`;
export const relayerAccount = privateKeyToAccount(relayerKey);

export const walletClient = createWalletClient({
  account: relayerAccount,
  chain,
  transport: http(rpcUrl),
});

// USDC contract addresses
export const USDC_ADDRESS = isTestnet
  ? '0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88' as const  // Sepolia testnet
  : '0x79A02482A880bCE3F13e09Da970dC34db4CD24d1' as const;  // Mainnet
```

### Pattern 2: Real get_balance (replace stub)

**What:** Replace hardcoded stub with `publicClient.readContract` using `erc20Abi`.
**When to use:** `get_balance` tool execute — FOPS-01.

```typescript
// apps/api/src/tools/get-balance.ts
// Source: viem readContract docs

import { erc20Abi, formatUnits } from 'viem';
import { publicClient, USDC_ADDRESS } from '../chain/clients';

// Inside execute():
const raw = await publicClient.readContract({
  address: USDC_ADDRESS,
  abi: erc20Abi,
  functionName: 'balanceOf',
  args: [userContext.walletAddress as `0x${string}`],
});
// USDC has 6 decimals
const balance = formatUnits(raw, 6);
return { balance, currency: 'USDC', chain: 'World Chain' };
```

### Pattern 3: send_usdc Tool Factory

**What:** Factory function (same pattern as `createUpdateMemoryTool`) binding userId and userContext to the tool.
**When to use:** FOPS-02, FOPS-04, FOPS-05.

```typescript
// apps/api/src/tools/send-usdc.ts
export function createSendUsdcTool(userId: string, userContext: UserContext) {
  return tool({
    description: 'Send USDC to a recipient wallet address.',
    inputSchema: z.object({
      recipientAddress: z.string().describe('Resolved 0x wallet address'),
      amountUsd: z.number().positive().describe('Amount in USD'),
    }),
    execute: async ({ recipientAddress, amountUsd }) => {
      const gateError = requireVerified(userContext);
      if (gateError) return gateError;

      if (amountUsd <= userContext.autoApproveUsd) {
        // FOPS-04: auto-execute
        return await executeTransfer(userId, recipientAddress, amountUsd);
      } else {
        // FOPS-05: create pending, return confirmation_required
        const pending = await createPendingTransaction(userId, recipientAddress, amountUsd);
        return {
          type: 'confirmation_required',
          txId: pending.id,
          amount: amountUsd,
          recipient: recipientAddress,
        };
      }
    },
  });
}
```

### Pattern 4: Two-Step On-Chain Transfer

**What:** GenieRouter.route() pulls funds, then PayHandler.execute() pushes to recipient.
**When to use:** Both immediate (FOPS-04) and confirmed (FOPS-05) transfers.

```typescript
// apps/api/src/chain/transfer.ts
import { walletClient, GENIE_ROUTER_ADDRESS, PAY_HANDLER_ADDRESS } from './clients';
import { GenieRouterAbi, PayHandlerAbi } from '../contracts/abis';
import { parseUnits } from 'viem';

export async function executeOnChainTransfer(recipient: `0x${string}`, amountUsd: number) {
  const amount = parseUnits(amountUsd.toString(), 6); // USDC 6 decimals

  // Step 1: GenieRouter.route(amount, payHandlerAddress)
  const routeTxHash = await walletClient.writeContract({
    address: GENIE_ROUTER_ADDRESS,
    abi: GenieRouterAbi,
    functionName: 'route',
    args: [amount, PAY_HANDLER_ADDRESS],
  });

  // Step 2: PayHandler.execute(recipient, amount)
  const executeTxHash = await walletClient.writeContract({
    address: PAY_HANDLER_ADDRESS,
    abi: PayHandlerAbi,
    functionName: 'execute',
    args: [recipient, amount],
  });

  return { routeTxHash, executeTxHash };
}
```

### Pattern 5: World Username Resolution

**What:** REST call to `https://usernames.worldcoin.org/api/v1/{name}` returns `{username, address, profile_picture_url}`.
**When to use:** resolve_contact tool, second fallback after 0x check.

```typescript
// apps/api/src/tools/resolve-contact.ts
const WORLD_USERNAME_API = 'https://usernames.worldcoin.org/api/v1';

async function resolveWorldUsername(name: string): Promise<string | null> {
  const res = await fetch(`${WORLD_USERNAME_API}/${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = await res.json() as { address?: string };
  return data.address ?? null;
}
```

World API response shape (verified from OpenAPI spec at usernames.worldcoin.org):
```typescript
interface UsernameRecord {
  username: string;
  address: string;           // checksummed 0x wallet address
  profile_picture_url?: string;
  minimized_profile_picture_url?: string;
}
```

### Pattern 6: Transactions Table Schema Update (status column)

**What:** Add `status` column to transactions table for pending/confirmed/expired state.
**When to use:** Before any pending transaction logic — required for FOPS-05.

```typescript
// apps/db/src/schema.ts — add to transactions table
status: text('status').notNull().default('confirmed'),
// Values: 'pending' | 'confirmed' | 'expired' | 'failed'
expiresAt: timestamp('expires_at'),  // set for pending transactions only
```

After schema change: `cd apps/db && pnpm db:push` to sync to Supabase.

### Pattern 7: Foundry Solidity Contract Pattern

**What:** GenieRouter pulls USDC via transferFrom; PayHandler accepts and forwards to recipient.
**Key constraint:** GenieRouter must hold no USDC state — it transfers straight to PayHandler.

```solidity
// apps/contracts/src/GenieRouter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract GenieRouter {
    address public immutable usdc;
    address public owner;

    constructor(address _usdc) {
        usdc = _usdc;
        owner = msg.sender;
    }

    // Called by backend relayer — pulls amountUsdc from sender, sends to handler
    function route(address sender, uint256 amount, address handler) external {
        require(msg.sender == owner, "only relayer");
        IERC20(usdc).transferFrom(sender, handler, amount);
    }
}
```

```solidity
// apps/contracts/src/PayHandler.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PayHandler {
    address public immutable usdc;
    address public owner;

    constructor(address _usdc) {
        usdc = _usdc;
        owner = msg.sender;
    }

    // Called by backend relayer after route() — sends USDC to final recipient
    function execute(address recipient, uint256 amount) external {
        require(msg.sender == owner, "only relayer");
        IERC20(usdc).transfer(recipient, amount);
    }
}
```

**Note on D-03 flow:** The backend (relayer account) calls both contracts sequentially. GenieRouter's `route()` calls `transferFrom(userWallet, payHandler, amount)` — pulling from the user's approved allowance directly into PayHandler's balance. Then PayHandler's `execute()` calls `transfer(recipient, amount)` from PayHandler's own balance.

### Pattern 8: Foundry Project Init in Monorepo

```bash
# In monorepo root (--no-git avoids nested git init)
cd apps && forge init contracts --no-git
cd contracts
# Install OpenZeppelin as forge dependency
forge install OpenZeppelin/openzeppelin-contracts --no-git
# Add remapping
echo "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/" >> remappings.txt
```

Minimal `foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.20"
optimizer = true
optimizer_runs = 200

[profile.test]
optimizer = false
```

Deploy script:
```bash
forge script script/Deploy.s.sol \
  --rpc-url $WORLD_CHAIN_RPC_URL \
  --private-key $RELAYER_PRIVATE_KEY \
  --broadcast
```

### Pattern 9: Confirm Endpoint

```typescript
// apps/api/src/routes/confirm.ts
import { Hono } from 'hono';
import { z } from 'zod';

export const confirmRoute = new Hono();

confirmRoute.post('/confirm', async (c) => {
  // 1. Parse txId from body
  // 2. Load pending transaction from DB for userId
  // 3. Check not expired (expiresAt > now)
  // 4. Execute on-chain transfer
  // 5. Update transaction status to 'confirmed', set txHash
  // 6. Return { success: true, txHash }
});
```

### Anti-Patterns to Avoid

- **Calling walletClient.writeContract without awaiting the receipt:** writeContract returns a txHash only — if you need confirmation, use `publicClient.waitForTransactionReceipt`. For hackathon speed, fire-and-forget is acceptable; log the hash.
- **Storing RELAYER_PRIVATE_KEY in code:** Must be env var only — never hardcoded.
- **Using `bigint` directly in JSON responses:** viem returns bigint from contract reads. Always call `formatUnits()` or `.toString()` before returning from tool execute.
- **Singleton tool instances with user context:** send_usdc needs userId/context per request — must use factory pattern, not module-level singleton (same rule as update_memory).
- **Running forge init in monorepo root:** Use `--no-git` flag to avoid nested git repository.
- **Fuzzy contact matching with SQL LIKE:** Use exact match first; fall back to case-insensitive LIKE only if no exact match. Multiple matches → return all for agent disambiguation (D-08).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ERC20 ABI | Custom ABI object | `erc20Abi` from viem | Already typed and complete |
| Hex encode/decode | Manual bigint conversion | `parseUnits`, `formatUnits` from viem | Decimal precision errors in manual conversion |
| World Chain chain config | Custom `defineChain` call | `worldchain` from `viem/chains` | Already defined with correct ID 480, RPC, explorer |
| Username HTTP client | Custom fetch wrapper | Direct fetch to `usernames.worldcoin.org/api/v1/{name}` | Single endpoint, no SDK needed |
| Contract ABI generation | Manual ABI typing | `forge build` outputs `out/GenieRouter.json` — import `abi` from JSON | Auto-generated, always in sync with source |

**Key insight:** viem ships with `worldchain` built-in and `erc20Abi` included. Neither needs to be defined from scratch.

---

## Common Pitfalls

### Pitfall 1: bigint in JSON Serialization

**What goes wrong:** `walletClient.writeContract` returns `0x...` tx hash (string) — fine. But `publicClient.readContract` with `balanceOf` returns native `bigint`. Returning this directly from a Vercel AI SDK tool `execute()` causes `JSON.stringify` to throw `TypeError: Do not know how to serialize a BigInt`.
**Why it happens:** JavaScript `bigint` is not JSON-serializable.
**How to avoid:** Always call `formatUnits(rawBalance, 6)` (for USDC 6 decimals) to get a decimal string before returning from `execute()`.
**Warning signs:** Tool execute throws at `JSON.stringify` stage, not at the `readContract` call itself.

### Pitfall 2: RELAYER_PRIVATE_KEY not in vitest.config.ts

**What goes wrong:** Tests that import `apps/api/src/chain/clients.ts` will throw `Cannot read privateKey of undefined` because the env var is not set in test environment.
**Why it happens:** `privateKeyToAccount` is called at module load time when clients.ts is imported.
**How to avoid:** Either lazy-initialize the walletClient (only create when first called), or mock `../chain/clients` in tests that don't need real on-chain calls. The vitest config already injects env vars — add a dummy `RELAYER_PRIVATE_KEY=0x0000...` for tests.

### Pitfall 3: Pending Transaction Race Condition

**What goes wrong:** User sends two transfer requests above threshold simultaneously — both create pending transactions — user confirms one, the other silently sits as pending forever.
**Why it happens:** No uniqueness constraint per user on pending transactions.
**How to avoid:** When creating a new pending transaction, first cancel any existing pending transactions for the same user. Add an application-level check: `UPDATE transactions SET status='expired' WHERE senderUserId=? AND status='pending'` before INSERT.

### Pitfall 4: World Username API 301 Redirect on Changed Usernames

**What goes wrong:** `fetch()` in Node.js follows redirects by default, but a 301 from the World username API means the username was recently changed — the new canonical username is at the redirect target.
**Why it happens:** World username service uses 301 to indicate username renames.
**How to avoid:** Let fetch follow the redirect (default behavior is fine). Check response status after redirect — if final status is 200, proceed. If 404, user not found.

### Pitfall 5: DB Schema Needs Migration Before Phase Code Runs

**What goes wrong:** Code that writes `status='pending'` to transactions fails at runtime with a column-not-found DB error if the schema update hasn't been pushed.
**Why it happens:** The current transactions table has no `status` column.
**How to avoid:** Schema update + `pnpm db:push` must be the very first task in Phase 4 execution, before any other tool is written.

### Pitfall 6: forge init Creates a git Repo

**What goes wrong:** Running `forge init apps/contracts` inside the existing git repo creates a nested `.git` directory, breaking `git status` and submodule state.
**Why it happens:** `forge init` runs `git init` by default.
**How to avoid:** Always use `forge init apps/contracts --no-git`.

### Pitfall 7: Foundry ABI Import Path After Build

**What goes wrong:** `out/GenieRouter.json` uses a nested structure — the ABI is at `artifact.abi`, not the root. Importing the JSON and assuming it's the ABI array directly will cause "function not found" errors from viem.
**Why it happens:** `forge build` outputs full artifact JSON, not just ABI.
**How to avoid:** Create a typed ABI file: `export const GenieRouterAbi = artifact.abi as const;` or copy the ABI array into a `src/contracts/abis.ts` file for viem type inference.

---

## Runtime State Inventory

> This is a greenfield contracts package + new API tools. No rename/refactor in scope.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Transactions table lacks `status` and `expiresAt` columns | Schema migration via drizzle `pnpm db:push` (Wave 0 task) |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | `RELAYER_PRIVATE_KEY` (new), `WORLD_CHAIN_RPC_URL` (new), `GENIE_ROUTER_ADDRESS` (post-deploy), `PAY_HANDLER_ADDRESS` (post-deploy) — all new, not yet in .env | Add to .env after deploy; add dummy values to vitest config |
| Build artifacts | `apps/contracts/out/` — Foundry build output (not yet created) | Generated by `forge build`; add to .gitignore if not already |

---

## World Chain Network Details

| Property | Mainnet | Testnet (Sepolia) |
|----------|---------|-------------------|
| Chain ID | 480 | 4801 |
| viem import | `worldchain` from `viem/chains` | `worldchainSepolia` from `viem/chains` |
| Public RPC | `https://worldchain-mainnet.g.alchemy.com/public` | `https://worldchain-sepolia.g.alchemy.com/public` |
| Block Explorer | `https://worldscan.org` | `https://sepolia.worldscan.org` |
| USDC contract | `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` | `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` |
| USDC decimals | 6 | 6 |
| Faucet | — | `https://www.alchemy.com/faucets/world-chain-sepolia` |

**Confidence:** HIGH — mainnet USDC address verified from WorldScan (`worldscan.org`). viem chain definition verified from installed `viem@2.45.3` source. Testnet USDC address verified from `docs.world.org/world-chain/tokens/usdc.md`.

---

## World Username API

**Base URL:** `https://usernames.worldcoin.org`
**Documentation:** `https://usernames.worldcoin.org/docs` (OpenAPI spec at `/openapi.json`)
**No authentication required** — public API.

| Endpoint | Method | Use Case |
|----------|--------|----------|
| `/api/v1/{name}` | GET | Resolve single username OR address to UsernameRecord |
| `/api/v1/query` | POST | Batch resolve addresses/usernames |
| `/api/v1/search/{username}` | GET | Search (up to 10 results) — for fuzzy suggestions |

**Response shape:**
```typescript
interface UsernameRecord {
  username: string;
  address: string;           // checksummed 0x wallet address
  profile_picture_url?: string;
  minimized_profile_picture_url?: string;
}
```

**Status codes:** 200 success, 301 username recently changed (follow redirect), 404 not found, 422 excessive items (batch).

**Confidence:** HIGH — verified from live OpenAPI spec at `usernames.worldcoin.org/openapi.json`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| forge / foundry | FOPS-06 contract build | ✓ | 1.5.1-stable | — |
| cast | Contract interactions from CLI | ✓ | 1.5.1-stable | — |
| viem (npm package) | FOPS-01/02 on-chain | ✗ (not in apps/api deps) | — | Must install: `pnpm add viem` |
| Node.js | API runtime | ✓ | v24.10.0 | — |
| World Chain RPC | All on-chain calls | ✓ (public RPC available) | — | Use public Alchemy RPC as default |
| World Username API | FOPS-03 resolution | ✓ (public REST) | — | Graceful null return |
| Supabase (DATABASE_URL) | Pending transactions | ✓ (already used in Phase 2) | postgres | — |

**Missing dependencies with no fallback:**
- `viem` is not installed in `apps/api/package.json` — must be added with `pnpm add viem` before any on-chain code runs.

**Missing dependencies with fallback:**
- `WORLD_CHAIN_RPC_URL` env var — falls back to viem's built-in default RPC for `worldchain` (`https://worldchain-mainnet.g.alchemy.com/public`).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (latest, installed in apps/api) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && pnpm test` |
| Full suite command | `cd apps/api && pnpm test` (runs all `*.test.ts` in `src/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOPS-01 | `get_balance` returns real USDC balance shape | unit (mocked viem) | `pnpm test -- get-balance` | ❌ Wave 0 (replace existing stub test) |
| FOPS-02 | `send_usdc` calls requireVerified gate | unit | `pnpm test -- send-usdc` | ❌ Wave 0 |
| FOPS-03 | `resolve_contact` returns wallet for 0x address | unit | `pnpm test -- resolve-contact` | ❌ Wave 0 |
| FOPS-03 | `resolve_contact` calls World API for non-0x | unit (mocked fetch) | `pnpm test -- resolve-contact` | ❌ Wave 0 |
| FOPS-03 | `resolve_contact` falls back to DB contacts | unit (mocked DB) | `pnpm test -- resolve-contact` | ❌ Wave 0 |
| FOPS-04 | auto-approve path executes immediately | unit | `pnpm test -- send-usdc` | ❌ Wave 0 |
| FOPS-05 | over-threshold returns confirmation_required payload | unit | `pnpm test -- send-usdc` | ❌ Wave 0 |
| FOPS-05 | expired pending tx is rejected by /confirm | unit | `pnpm test -- confirm` | ❌ Wave 0 |
| FOPS-06 | GenieRouter.sol tests | Solidity unit (forge test) | `cd apps/contracts && forge test` | ❌ Wave 0 |
| FOPS-06 | PayHandler.sol tests | Solidity unit (forge test) | `cd apps/contracts && forge test` | ❌ Wave 0 |

**Note:** On-chain calls in TypeScript tests MUST be mocked. Do not write tests that hit real World Chain — they'll be flaky and slow. Mock `../chain/clients` in all tool tests.

### Sampling Rate
- **Per task commit:** `cd apps/api && pnpm test`
- **Per wave merge:** `cd apps/api && pnpm test && cd ../contracts && forge test`
- **Phase gate:** All vitest + forge test green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/tools/send-usdc.test.ts` — covers FOPS-02, FOPS-04, FOPS-05
- [ ] `apps/api/src/tools/resolve-contact.test.ts` — covers FOPS-03
- [ ] `apps/api/src/routes/confirm.test.ts` — covers FOPS-05 expiry path
- [ ] `apps/contracts/test/GenieRouter.t.sol` — covers FOPS-06
- [ ] `apps/contracts/test/PayHandler.t.sol` — covers FOPS-06
- [ ] Update `apps/api/vitest.config.ts` to add `RELAYER_PRIVATE_KEY=0x${'0'.repeat(64)}` and `WORLD_CHAIN_RPC_URL=http://localhost:8545` env vars
- [ ] Update `apps/api/src/tools/get-balance.test.ts` — replace stub assertions with real shape assertions (mocked viem)

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `ethers.js` for EVM | `viem` (locked D-14) | ~2023 | Viem is TypeScript-first, tree-shakeable, better DX |
| `maxSteps` in AI SDK | `stopWhen: stepCountIs(N)` | AI SDK v6 | Already used in project — confirmed in STATE.md |
| `pipeDataStreamToResponse` | `toUIMessageStreamResponse()` | Bun/Hono compat | Already implemented — no change needed |
| Custom chain config | `worldchain` from `viem/chains` | Built-in since viem 2.x | No defineChain boilerplate needed |
| Hardhat for Solidity | Foundry (locked D-16) | ~2022 | Forge is faster, Rust-based, already installed |

**Deprecated/outdated:**
- `worldchain` in viem was `defineChain` pattern before it became a built-in export — use the import directly.
- `ethers.js` is installed in `apps/api` (ethers@6.16.0) but NOT to be used for new on-chain work per D-14.

---

## Open Questions

1. **Relayer gas funding on World Chain Sepolia testnet**
   - What we know: The relayer account (server hot wallet) pays gas for both GenieRouter and PayHandler calls. World Chain is an OP Stack L2 — gas is cheap.
   - What's unclear: The relayer address needs ETH balance on testnet to deploy and call contracts. The Alchemy faucet (`https://www.alchemy.com/faucets/world-chain-sepolia`) is the source.
   - Recommendation: Fund the relayer address from the faucet as part of Wave 0 setup. Document in deploy script comments.

2. **GenieRouter.route() sender argument vs msg.sender**
   - What we know: The relayer (not the user) calls `GenieRouter.route()`. The `transferFrom` must pull from the user's wallet, so the user address must be passed as a parameter (not derived from `msg.sender`).
   - What's unclear: Whether to pass `sender` as a parameter or have the relayer act as an intermediary.
   - Recommendation: Pass `sender` (user's walletAddress) as explicit argument to `route()`. Only the `owner` (relayer) can call `route()` — this prevents abuse.

3. **Pending transaction expiry enforcement**
   - What we know: D-13 says pending transactions expire. Claude's discretion on timeout.
   - Recommendation: 15 minutes is appropriate for a hackathon demo (long enough for user to notice confirmation prompt, short enough to not leave stale state). Implement as: check `expiresAt < NOW()` in the `/confirm` route handler; run a periodic cleanup or check on each `/chat` request.

4. **Contract ABIs in TypeScript**
   - What we know: `forge build` outputs `apps/contracts/out/GenieRouter.json` with full artifact including ABI.
   - What's unclear: Best import strategy — inline JSON or typed constant file?
   - Recommendation: Copy ABI arrays into `apps/api/src/contracts/abis.ts` as `as const` typed constants after deployment. This avoids runtime file path issues with bundlers and keeps viem type inference working.

---

## Sources

### Primary (HIGH confidence)
- viem installed source at `/node_modules/.pnpm/viem@2.45.3.../viem/_cjs/chains/definitions/worldchain.js` — worldchain chain ID 480, RPC, explorer
- `usernames.worldcoin.org/openapi.json` — World username API endpoints, request/response shapes
- WorldScan search results — USDC mainnet address `0x79A02482A880bCE3F13e09Da970dC34db4CD24d1` verified on-chain
- `docs.world.org/world-chain/tokens/usdc.md` — USDC testnet address `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88`
- `apps/api/src/tools/update-memory.ts` — factory pattern source of truth for new tool factories
- `apps/api/vitest.config.ts` — test environment configuration
- `apps/db/src/schema.ts` — current schema; confirms no `status` column on transactions

### Secondary (MEDIUM confidence)
- `docs.world.org/world-chain/quick-start/info.md` — Chain ID 480 mainnet, 4801 testnet, public RPC URLs
- npm registry `npm view viem version` → `2.47.10` (2026-04-04) — current latest
- forge version check → `1.5.1-stable` confirmed installed

### Tertiary (LOW confidence)
- None — all critical findings verified from authoritative sources

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — viem verified from installed package; Foundry verified from local install; World Chain addresses verified from live explorer and official docs
- Architecture: HIGH — patterns derived from existing project code (factories, Hono routes, tool registration)
- Pitfalls: HIGH — bigint serialization is a known viem issue; others derived from codebase inspection
- World Username API: HIGH — verified from live OpenAPI spec

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (World Chain addresses are stable; API endpoints may change)
