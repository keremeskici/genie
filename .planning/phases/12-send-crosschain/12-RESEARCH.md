# Phase 12: Send Integration + Cross-Chain - Research

**Researched:** 2026-04-05
**Domain:** Hono REST API, USDC send flow, Circle CCTP bridge, SendModal React refactor
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** SendModal calls a new REST endpoint `POST /api/send` with `{recipient, amount, chain}` instead of using `triggerMiniKitPay`. This keeps the modal independent of the chat flow.
- **D-02:** The `/api/send` endpoint delegates to the same `send_usdc` logic (balance check, threshold check, GenieRouter route) but returns a structured JSON response rather than an agent tool result.
- **D-03:** For cross-chain sends, the endpoint delegates to CCTP bridge logic (extracted from `settle_crosschain_debt`).
- **D-04:** World Chain is the default/primary chain in the SendModal dropdown. Selecting World Chain routes through `send_usdc` (same-chain transfer).
- **D-05:** Other chains (Base, Arbitrum, Ethereum, Optimism) route through Circle CCTP `depositForBurn` — the bridge logic from `settle_crosschain_debt` is extracted into a shared utility.
- **D-06:** Chain list updated to: World Chain (default), Base, Arbitrum, Ethereum, Optimism. Polygon and Solana removed (no CCTP support in current setup).
- **D-07:** When `/api/send` returns `confirmation_required` (over-threshold World Chain send), SendModal closes and the response is rendered as a ConfirmCard in the chat thread.
- **D-08:** Cross-chain sends bypass the confirmation flow — they execute directly (CCTP bridge is already a multi-step process with its own transaction signing).
- **D-09:** ConfirmCard URL bug fix: change `fetch('/confirm', ...)` to `fetch('/api/confirm', ...)` in ConfirmCard component (line 51).
- **D-10:** XCHD-01 is implemented for any USDC transfer (not just debt settlement). SendModal chain picker enables sending USDC to any address on supported chains.
- **D-11:** The CCTP bridge logic (approve TokenMessenger, depositForBurn) is extracted from `settle_crosschain_debt` into a shared `bridgeUsdc` utility in `apps/api/src/chain/bridge.ts`.
- **D-12:** `settle_crosschain_debt` is refactored to use the shared `bridgeUsdc` utility.

### Claude's Discretion

- Error handling specifics for failed bridge transactions
- Loading state UI in SendModal during send execution
- Whether to show estimated bridge time for cross-chain sends ("~15 min" for CCTP)
- Success state rendering in SendModal vs redirecting to chat
- How SendModal obtains userId (session context)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOPS-02 | User can send USDC to contacts/addresses via natural language | New `POST /api/send` route bridges chat flow and modal flow; SendModal rewrite enables direct address entry |
| FOPS-03 | Agent resolves recipients via contacts, ENS, or wallet address | SendModal accepts resolved wallet address directly; `/api/send` validates with `isAddress` before executing |
| FOPS-04 | Transfers under auto-approve threshold execute immediately | `/api/send` reuses same `send_usdc` logic with `autoApproveUsd` threshold check; `transfer_complete` response triggers success UI |
| FOPS-05 | Transfers over threshold require explicit confirmation | `/api/send` returns `confirmation_required` JSON; SendModal closes and hands off to ConfirmCard in chat thread |
| XCHD-01 | User can deposit USDC from Ethereum/Base/Arbitrum to World Chain via Arc CCTP | `bridgeUsdc` utility uses direct `depositForBurn` CCTP flow; chain routing in `/api/send` branches on selected chain |
</phase_requirements>

---

## Summary

Phase 12 wires the SendModal to real on-chain execution via a new `POST /api/send` Hono route, extracts the CCTP bridge logic from `settle_crosschain_debt` into a reusable `bridgeUsdc` utility, and fixes a one-line URL bug in ConfirmCard that has been silently breaking all over-threshold confirmations in production.

The backend work is three pieces: (1) create `apps/api/src/chain/bridge.ts` with the extracted `bridgeUsdc(amount, destinationDomain, recipientWallet)` function, (2) refactor `settle_crosschain_debt` to call it, and (3) create `apps/api/src/routes/send.ts` with a `POST /api/send` handler that re-implements the `send_usdc` threshold logic as a REST response. The frontend work is two pieces: (1) rewrite `SendModal/index.tsx` to `fetch('/api/send', ...)` and handle the response types, and (2) fix the one-line bug at ConfirmCard line 51 (`/confirm` → `/api/confirm`).

All dependency code is already in the repo. The Circle Bridge Kit v1.8.1 (`@circle-fin/bridge-kit`) is already a declared dependency. The existing CCTP call pattern inside `settle_crosschain_debt` is the implementation template — the bridge utility is a direct extraction, not new code.

**Primary recommendation:** Extract `bridgeUsdc` first, then build the `/api/send` route reusing both `executeOnChainTransfer` and `bridgeUsdc`, then rewrite SendModal as a thin fetch-and-handle-response component.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hono | 4.12.10 | New `/api/send` route handler | Already used for all routes |
| viem | 2.45.3 | `writeContract`, `parseUnits`, `pad`, `erc20Abi`, `isAddress` | Already used for all chain calls |
| @genie/db | workspace | Drizzle ORM — insert transactions | Already used in `send_usdc` tool |
| zod | 3.24.6 | Request body validation | Already used in all tools |
| vitest | latest | Unit tests | Already used for all route/tool tests |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @circle-fin/bridge-kit | 1.8.1 | BridgeKit abstraction for CCTPv2 | Already installed but NOT needed — existing manual `depositForBurn` pattern is simpler and already working in `settle_crosschain_debt`. Use `depositForBurn` directly. |

**Key finding on Circle Bridge Kit:** The `@circle-fin/bridge-kit` package is installed (v1.8.1) but its companion adapter `@circle-fin/adapter-viem-v2` is NOT installed. The kit requires an adapter to function. Installing the adapter would add a new dependency. The decision context (D-11) says "extract bridge logic from `settle_crosschain_debt`" — meaning the existing manual CCTP approach (approve + `depositForBurn`) is the target, not the BridgeKit API. Confidence: HIGH (verified by package.json inspection and node_modules scan).

**Installation (only if Bridge Kit adapter path is chosen):**
```bash
pnpm add @circle-fin/adapter-viem-v2 --filter @genie/api
```

**Recommended path:** Use the manual `depositForBurn` approach exactly as it exists in `settle_crosschain_debt`. No new package installs needed.

---

## Architecture Patterns

### Recommended File Structure for This Phase
```
apps/api/src/
├── chain/
│   ├── bridge.ts         # NEW — extracted bridgeUsdc() utility
│   ├── clients.ts        # UNCHANGED
│   └── transfer.ts       # UNCHANGED
├── routes/
│   ├── send.ts           # NEW — POST /api/send handler
│   └── [others]          # UNCHANGED
├── tools/
│   └── settle-crosschain-debt.ts  # REFACTORED — uses bridgeUsdc
└── index.ts              # ADD: app.route('/api/send', sendRoute)

apps/web/src/components/
├── SendModal/index.tsx   # REWRITTEN — fetch('/api/send', ...) + chain picker
└── ConfirmCard/index.tsx # ONE-LINE FIX — line 51 /confirm → /api/confirm
```

### Pattern 1: Extracting bridgeUsdc Utility

The full CCTP flow is already in `settle_crosschain_debt`. Extract it verbatim:

```typescript
// apps/api/src/chain/bridge.ts
import { erc20Abi, parseUnits, pad } from 'viem';
import { getWalletClient, relayerAccount, USDC_ADDRESS } from './clients';

const TOKEN_MESSENGER_WORLD_CHAIN = '0x1682bd6a475003921322496e952627702f7823f9';

const TokenMessengerAbi = [
  {
    type: 'function',
    name: 'depositForBurn',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
    stateMutability: 'nonpayable',
  },
] as const;

export const CCTP_DOMAIN_IDS: Record<string, number> = {
  ethereum: 0,
  optimism: 2,
  arbitrum: 3,
  base: 6,
};

export async function bridgeUsdc(params: {
  senderWallet: `0x${string}`;
  amountUsd: number;
  destinationChain: string;
  recipientWallet: string;
}): Promise<{ routeTxHash: string; approveTxHash: string; bridgeTxHash: string }> {
  const { senderWallet, amountUsd, destinationChain, recipientWallet } = params;
  const amountUnits = parseUnits(amountUsd.toString(), 6);
  const walletClient = getWalletClient();
  const relayer = relayerAccount();

  // Step 1: Pull from user to relayer via GenieRouter
  const { routeTxHash } = await executeOnChainTransferToRelayer(senderWallet, amountUnits);

  // Step 2: Approve TokenMessenger
  const approveTxHash = await walletClient.writeContract({
    account: relayer,
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'approve',
    args: [TOKEN_MESSENGER_WORLD_CHAIN, amountUnits],
  });

  // Step 3: depositForBurn
  const destinationDomain = CCTP_DOMAIN_IDS[destinationChain];
  const mintRecipient = pad(recipientWallet as `0x${string}`, { size: 32 });
  const bridgeTxHash = await walletClient.writeContract({
    account: relayer,
    address: TOKEN_MESSENGER_WORLD_CHAIN,
    abi: TokenMessengerAbi,
    functionName: 'depositForBurn',
    args: [amountUnits, destinationDomain, mintRecipient, USDC_ADDRESS],
  });

  return { routeTxHash, approveTxHash, bridgeTxHash };
}
```

**Note:** The bridge utility needs a "pull from user to relayer" step before it can call `depositForBurn`, because the relayer holds the USDC to bridge. This is a GenieRouter.route call to `relayer.address` as handler — same as Step 1 in `settle_crosschain_debt` (line 85-92). The bridge utility can import `GENIE_ROUTER_ADDRESS` and `GenieRouterAbi` for this, or accept `routeTxHash` as pre-computed input from the route handler. Simplest design: `bridgeUsdc` takes pre-pulled amount from the user — caller is responsible for the GenieRouter.route step — matching how `settle_crosschain_debt` currently works.

### Pattern 2: POST /api/send Route

The route mirrors `createSendUsdcTool` logic but as HTTP:

```typescript
// apps/api/src/routes/send.ts
import { Hono } from 'hono';
import { isAddress } from 'viem';
import { db, transactions, users, eq, and } from '@genie/db';
import { executeOnChainTransfer } from '../chain/transfer';
import { bridgeUsdc, CCTP_DOMAIN_IDS } from '../chain/bridge';

export const sendRoute = new Hono();

sendRoute.post('/', async (c) => {
  const { userId, recipient, amount, chain } = await c.req.json();
  // validate inputs, load user, check verification, run threshold check...
  // World Chain → executeOnChainTransfer (under threshold) or create pending (over threshold)
  // Other chains → bridgeUsdc (direct execute, no confirmation needed per D-08)
});
```

**Key design note:** The route must fetch `userContext` (specifically `autoApproveUsd`, `walletAddress`, `isVerified`) from the DB/KV rather than receiving it as a tool parameter, since it's a direct HTTP call without the agent's context injection.

### Pattern 3: SendModal Refactor

```typescript
// apps/web/src/components/SendModal/index.tsx
const handleSend = async () => {
  setStatus('sending');
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: session?.user?.id,
      recipient: recipient.trim(),
      amount: parseFloat(amount),
      chain: selectedChain,   // 'World Chain' | 'Base' | 'Arbitrum' | 'Ethereum' | 'Optimism'
    }),
  });
  const json = await res.json();
  if (!res.ok) { setStatus('error'); return; }
  if (json.type === 'transfer_complete') { setStatus('success'); refetchBalance?.(); setTimeout(handleClose, 1500); }
  if (json.type === 'bridge_initiated')  { setStatus('success'); setTimeout(handleClose, 1500); }
  if (json.type === 'confirmation_required') { onConfirmationRequired?.(json); handleClose(); }
};
```

The `confirmation_required` handoff requires SendModal to notify DashboardInterface, which can then inject the ConfirmCard into the chat thread. The simplest approach: pass an `onConfirmationRequired` callback prop from `DashboardInterface` to `SendModal`. However, DashboardInterface renders separately from ChatInterface — it does not have access to `sendMessage`. The cleanest solution given the existing architecture: store the pending confirmation data in a React state at the page/app level, then navigate to `/chat` with a query param that causes ChatInterface to show the ConfirmCard. An even simpler approach: SendModal renders the ConfirmCard inline within itself when `confirmation_required` is received (no cross-component handoff needed).

**Recommendation (Claude's Discretion):** When `confirmation_required` is returned, render the ConfirmCard inline inside SendModal rather than injecting into the chat thread. The ConfirmCard component is self-contained and only needs `data` + `userId` props. The modal stays open, transforms its content to show the ConfirmCard. This avoids cross-component state threading entirely.

### Pattern 4: ConfirmCard URL Fix

```typescript
// apps/web/src/components/ConfirmCard/index.tsx — line 51
// BEFORE:
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/confirm`, {

// AFTER:
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/confirm`, {
```

This is a one-line change. The `/api/confirm` route is already mounted and complete.

### Anti-Patterns to Avoid

- **Calling the AI agent tool from the REST route:** The `/api/send` route must NOT instantiate `createSendUsdcTool` and call `execute()`. It duplicates logic but avoids the agent runtime dependency. Share the chain-layer helpers (`executeOnChainTransfer`, `bridgeUsdc`) directly.
- **Relying on `NEXT_PUBLIC_API_URL` being empty string in dev:** The existing fetch pattern uses `${process.env.NEXT_PUBLIC_API_URL ?? ''}` — match this pattern exactly so the same component works in both dev and production.
- **Omitting the chain/account parameters on viem writeContract:** As documented in Phase 4 state: "Export chain from clients.ts; pass explicit account + chain to writeContract — viem 2.45 requires both for non-narrowed wallet client types." The `bridgeUsdc` utility must pass `account: relayer` and `chain` (from clients.ts) to each `writeContract` call.
- **Using `chain: selectedChain` as a string in the send request without normalization:** The frontend chain names ("World Chain", "Base") need to map to backend keys ("worldchain", "base"). Define a canonical mapping on the backend and accept both display names or the canonical keys.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| USDC 6-decimal conversion | Custom decimal math | `parseUnits(amount.toString(), 6)` from viem | Already used everywhere |
| Address padding for bytes32 | Manual zero-padding | `pad(addr, { size: 32 })` from viem | Already used in settle_crosschain_debt |
| ERC20 approve ABI | Inline ABI | `erc20Abi` from viem | Standard, already imported |
| Address validation | Regex | `isAddress(wallet)` from viem | Already used in balance route |
| Fetch pattern | Custom HTTP client | `fetch('/api/send', { method: 'POST', ... })` | Direct pattern used by all frontend routes |
| DB insert | Custom query | Drizzle `db.insert(transactions).values({...})` | Established pattern from send_usdc tool |

---

## Common Pitfalls

### Pitfall 1: `@circle-fin/bridge-kit` needs `@circle-fin/adapter-viem-v2` but it is NOT installed
**What goes wrong:** Importing `BridgeKit` or `createViemAdapterFromPrivateKey` at runtime throws MODULE_NOT_FOUND because `@circle-fin/adapter-viem-v2` is not in `node_modules`.
**Why it happens:** `bridge-kit` is declared in `package.json` but the adapter is a separate package not installed.
**How to avoid:** Do not use the `BridgeKit` class. Use the manual CCTP approach (already in `settle_crosschain_debt`). If BridgeKit is desired, run `pnpm add @circle-fin/adapter-viem-v2 --filter @genie/api` first.
**Warning signs:** TypeScript cannot resolve `@circle-fin/adapter-viem-v2` imports; `pnpm install` resolves the kit itself but not the adapter.

### Pitfall 2: User context not available in REST route (unlike agent tool)
**What goes wrong:** `/api/send` receives `userId` but not the full `UserContext` (walletAddress, autoApproveUsd, isVerified). These must be loaded from DB, not assumed.
**Why it happens:** The tool factory pattern binds context per request from the agent's already-resolved user context. REST calls do not have this.
**How to avoid:** In the send route, load the user row from the `users` table (same as confirm.ts does) to get `walletAddress`. Load `autoApproveUsd` from user context. Check `worldId !== null` for verification. Pattern already demonstrated in `confirm.ts` lines 52-59.
**Warning signs:** Sending without verification gate → unverified users can send.

### Pitfall 3: Cross-chain chain name mismatch between frontend and CCTP domain IDs
**What goes wrong:** Frontend sends chain: "World Chain" but backend `CCTP_DOMAIN_IDS` map only has lowercase keys like "ethereum", "base".
**Why it happens:** Display labels and internal keys diverge.
**How to avoid:** Define a mapping on the backend: `{ 'World Chain': null, 'Base': 6, 'Arbitrum': 3, 'Ethereum': 0, 'Optimism': 2 }`. World Chain maps to null (same-chain, no bridge). Validate on input: if chain not in map, return 400.
**Warning signs:** `destinationDomain` is `undefined`, causing `depositForBurn` to revert.

### Pitfall 4: Confirmation flow handoff — SendModal closes before ConfirmCard renders
**What goes wrong:** SendModal calls `handleClose()` after receiving `confirmation_required`, but the chat thread is on a different route (/chat) and the ConfirmCard data is not persisted.
**Why it happens:** DashboardInterface and ChatInterface are on different routes/tabs. Closing the modal drops the pending data.
**How to avoid:** Render the ConfirmCard inline within SendModal itself when `confirmation_required` is returned. The ConfirmCard only needs `data` (txId, amount, recipient, expiresInMinutes) and `userId` — both available in the modal. This is the cleanest solution (no cross-route state threading).
**Warning signs:** Modal closes, user sees no confirmation card anywhere.

### Pitfall 5: viem `writeContract` requires explicit `account` and `chain` in viem 2.45
**What goes wrong:** `writeContract` call without `chain` fails at runtime with type error or silent wrong-chain submission.
**Why it happens:** viem 2.45 requires explicit account + chain on non-narrowed wallet clients.
**How to avoid:** Always pass `account: relayer` and `chain` (imported from `clients.ts`) to every `writeContract` call. Pattern established in `transfer.ts` lines 24-38.
**Warning signs:** TypeScript error on writeContract call; or transaction sent to wrong chain.

---

## Code Examples

Verified patterns from existing source files:

### DB User Load (from confirm.ts)
```typescript
// Source: apps/api/src/routes/confirm.ts lines 52-59
const [user] = await db.select()
  .from(users)
  .where(eq(users.id, userId))
  .limit(1);
if (!user) return c.json({ error: 'User not found' }, 404);
```

### Pending TX Cancel + Insert (from send-usdc.ts)
```typescript
// Source: apps/api/src/tools/send-usdc.ts lines 66-84
await db.update(transactions)
  .set({ status: 'expired' })
  .where(and(eq(transactions.senderUserId, userId), eq(transactions.status, 'pending')));

const [pending] = await db.insert(transactions)
  .values({ senderUserId: userId, recipientWallet, amountUsd: amountUsd.toFixed(2),
    status: 'pending', expiresAt: new Date(Date.now() + 15 * 60 * 1000), ... })
  .returning();
return { type: 'confirmation_required', txId: pending.id, amount: amountUsd, ... };
```

### CCTP depositForBurn (from settle-crosschain-debt.ts)
```typescript
// Source: apps/api/src/tools/settle-crosschain-debt.ts lines 96-116
const approveMessengerHash = await walletClient.writeContract({
  account: relayer, address: USDC_ADDRESS, abi: erc20Abi,
  functionName: 'approve', args: [TOKEN_MESSENGER_WORLD_CHAIN, amountUnits],
});
const mintRecipient = pad(destinationWallet as `0x${string}`, { size: 32 });
const bridgeTxHash = await walletClient.writeContract({
  account: relayer, address: TOKEN_MESSENGER_WORLD_CHAIN, abi: TokenMessengerAbi,
  functionName: 'depositForBurn',
  args: [amountUnits, destinationDomain, mintRecipient, USDC_ADDRESS],
});
```

### SendModal fetch pattern (target)
```typescript
// Modeled on balance hook and existing fetch patterns in ChatInterface
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/send`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId, recipient, amount, chain }),
});
```

### viem writeContract with explicit account + chain (from transfer.ts)
```typescript
// Source: apps/api/src/chain/transfer.ts lines 24-32
const routeTxHash = await walletClient.writeContract({
  account: relayerAccount(),
  chain,                      // <-- required in viem 2.45
  address: GENIE_ROUTER_ADDRESS,
  abi: GenieRouterAbi,
  functionName: 'route',
  args: [senderWallet, amount, PAY_HANDLER_ADDRESS],
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MiniKit Pay stub in SendModal | Direct `fetch('/api/send')` | This phase | SendModal becomes a real send UI |
| CCTP logic only in settle_crosschain_debt | Shared `bridgeUsdc` utility | This phase | Both settlement and modal sends use one code path |
| Manual depositForBurn (CCTPv1-style) | Same manual depositForBurn | Unchanged | Bridge Kit abstraction available but adapter not installed; stay with manual approach |
| ConfirmCard calls `/confirm` (broken) | ConfirmCard calls `/api/confirm` (fixed) | This phase | Over-threshold confirmations actually work |

**Key insight on Circle Bridge Kit:** The repo has `@circle-fin/bridge-kit@1.8.1` which uses CCTPv2. The existing `settle_crosschain_debt` uses the lower-level `depositForBurn` contract directly (CCTPv1-style). For the hackathon scope, staying with the direct approach is correct — it's already working code, no new adapter dependency needed, and refactoring to BridgeKit would require installing `@circle-fin/adapter-viem-v2` and redesigning the call.

---

## Open Questions

1. **Does the send route need to pull user's `autoApproveUsd` from context KV, or is a hardcoded default acceptable?**
   - What we know: `send_usdc` tool reads it from `userContext.autoApproveUsd`. The KV context loading is done by `loadUserContext()` in `apps/api/src/agent/context.ts`. The `/api/send` route could call the same function.
   - What's unclear: Whether the KV context loading adds meaningful latency for a synchronous REST endpoint.
   - Recommendation: For hackathon scope, call `loadUserContext(userId)` in the send route — same pattern as the agent. The context is cached (30-min TTL per Phase 2 decisions), so latency impact is minimal.

2. **What `chain` value does sendRoute receive, and how does it map to World Chain vs cross-chain routing?**
   - What we know: The frontend chain picker values will be display strings ("World Chain", "Base", etc.).
   - What's unclear: Whether to normalize in the frontend (send "worldchain") or backend (accept "World Chain" and map).
   - Recommendation: Normalize in the backend route. Accept display-friendly strings and map internally. Reject unknown chains with 400.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API server | Yes | v24.10.0 | — |
| pnpm | Package management | Yes | 10.33.0 | — |
| viem | CCTP bridge calls | Yes | 2.45.3 | — |
| @circle-fin/bridge-kit | BridgeKit (optional path) | Yes (v1.8.1) | 1.8.1 | Use direct depositForBurn (recommended) |
| @circle-fin/adapter-viem-v2 | BridgeKit adapter (required if BridgeKit used) | No | — | Use direct depositForBurn instead |
| @genie/db (Drizzle+Postgres) | Transaction inserts | Yes | workspace | — |

**Missing dependencies with no fallback:**
- None — all required dependencies present.

**Missing dependencies with fallback:**
- `@circle-fin/adapter-viem-v2`: Not installed. Fallback is the existing manual `depositForBurn` approach. This is the RECOMMENDED path.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (latest) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `pnpm --filter @genie/api test -- --reporter=verbose --testPathPattern=routes/send` |
| Full suite command | `pnpm --filter @genie/api test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOPS-02 | POST /api/send returns transfer_complete for World Chain under-threshold send | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | No — Wave 0 |
| FOPS-03 | POST /api/send returns 400 for invalid recipient address | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | No — Wave 0 |
| FOPS-04 | Under-threshold send executes immediately and returns transfer_complete | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | No — Wave 0 |
| FOPS-05 | Over-threshold send returns confirmation_required with txId | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | No — Wave 0 |
| XCHD-01 | Cross-chain send calls bridgeUsdc and returns bridge_initiated | unit | `pnpm --filter @genie/api test -- --testPathPattern=routes/send` | No — Wave 0 |
| D-09 (bug fix) | ConfirmCard calls /api/confirm not /confirm | manual smoke | Open app, trigger over-threshold send via chat | ConfirmCard.tsx exists, no test needed |
| D-11/D-12 | bridgeUsdc utility matches settle_crosschain_debt behavior | unit | `pnpm --filter @genie/api test -- --testPathPattern=chain/bridge` | No — Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @genie/api test -- --testPathPattern=routes/send`
- **Per wave merge:** `pnpm --filter @genie/api test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/routes/send.test.ts` — covers FOPS-02, FOPS-03, FOPS-04, FOPS-05, XCHD-01
- [ ] `apps/api/src/chain/bridge.test.ts` — covers D-11/D-12 (bridgeUsdc utility unit test)

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/tools/settle-crosschain-debt.ts` — CCTP depositForBurn implementation, domain IDs
- `apps/api/src/tools/send-usdc.ts` — Threshold logic, pending TX pattern, factory pattern
- `apps/api/src/routes/confirm.ts` — User load from DB pattern, status handling
- `apps/api/src/chain/transfer.ts` — executeOnChainTransfer, viem 2.45 writeContract pattern
- `apps/api/src/chain/clients.ts` — getWalletClient, relayerAccount, USDC_ADDRESS, chain export
- `apps/web/src/components/ConfirmCard/index.tsx` — Confirmed bug at line 51 (`/confirm` → `/api/confirm`)
- `apps/web/src/components/SendModal/index.tsx` — Current stub to be replaced
- `apps/api/package.json` — Confirmed bridge-kit@1.8.1 installed, adapter-viem-v2 NOT installed
- `node_modules/.pnpm/@circle-fin+bridge-kit@1.8.1/.../QUICKSTART.md` — BridgeKit API reference
- `node_modules/.pnpm/@circle-fin+bridge-kit@1.8.1/.../chains.d.ts` — BridgeChain enum (World_Chain, Arbitrum, Base, Ethereum, Optimism all present)
- `.planning/phases/12-send-crosschain/12-CONTEXT.md` — Locked decisions D-01 through D-12

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Accumulated decisions, viem 2.45 explicit account+chain requirement
- `apps/api/src/routes/balance.ts` — isAddress validation pattern for REST route inputs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified by package.json and node_modules inspection
- Architecture: HIGH — all patterns derived from existing working code in the repo
- Pitfalls: HIGH — Pitfall 1 (adapter) verified by filesystem scan; Pitfall 5 (viem) documented in STATE.md
- ConfirmCard bug: HIGH — confirmed by reading source at line 51

**Research date:** 2026-04-05
**Valid until:** 2026-05-05 (stable stack, no fast-moving dependencies)
