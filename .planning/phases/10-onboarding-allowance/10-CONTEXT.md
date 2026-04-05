# Phase 10: Onboarding Contract Allowance - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

When the user sets their spending limit in onboarding, the app calls USDC.approve(GenieRouter, amount) via MiniKit wallet signing. Without this on-chain approval, GenieRouter cannot pull USDC from the user's wallet, so no transfers can execute. This phase wires the approval into the existing onboarding StepBudget flow.

</domain>

<decisions>
## Implementation Decisions

### Approval Trigger & Flow
- **D-01:** The USDC.approve transaction fires when the user taps "Let's Go" on StepBudget — single action, no extra onboarding steps.
- **D-02:** Order is: approve on-chain first → confirm receipt → save autoApproveUsd to backend via PATCH /api/users/profile → redirect to /home. If approve fails, nothing is saved — consistent state.

### Approval Amount
- **D-03:** Approve the exact budget amount the user entered (e.g., $100 = 100e6 USDC units). No infinite approval, no buffer multiplier.
- **D-04:** If the user later changes their spending limit (from settings/profile), a new approval will be needed — this is acceptable and out of scope for this phase.

### Wallet Signing UX
- **D-05:** Full-screen dark overlay with spinner appears while the approval tx is in-flight. Overlay explains what's happening: "Authorizing Genie to spend up to $X USDC on your behalf".
- **D-06:** On success, overlay transitions to success state briefly, then auto-redirects to /home.

### Failure & Rejection Handling
- **D-07:** If user rejects the wallet signing or tx fails on-chain, show error on overlay with a "Try Again" button. User cannot proceed past onboarding without a successful approval.
- **D-08:** No escape hatch — approval is mandatory. User can close the app if they don't want to approve, but cannot access /home without it.

### Claude's Discretion
- Overlay animation and transition details
- Exact error message copy for different failure scenarios (rejection vs on-chain failure)
- Loading spinner style (matches existing dark theme + neon accents)
- Whether to use `useUserOperationReceipt` polling or simpler receipt wait
- Contract address exposure strategy (env vars, hardcoded, or API fetch)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MiniKit Transaction Pattern
- `apps/web/src/components/Transaction/index.tsx` — Reference implementation for `MiniKit.sendTransaction()` with `encodeFunctionData`, `useUserOperationReceipt` polling, and success/failure handling
- `apps/web/src/lib/minikit.ts` — MiniKit helpers (pay, wallet auth, permissions)

### Onboarding Page
- `apps/web/src/app/onboarding/page.tsx` — Current onboarding with StepBudget component, `finish()` function that saves autoApproveUsd to backend

### Contract Addresses & ABIs
- `apps/api/src/config/env.ts` — `GENIE_ROUTER_ADDRESS`, `USDC_ADDRESS_TESTNET`, `USDC_ADDRESS_MAINNET`
- `apps/api/src/chain/clients.ts` — Exports `GENIE_ROUTER_ADDRESS`, `USDC_ADDRESS`, chain config
- `apps/api/src/contracts/abis.ts` — `GenieRouterAbi` (reference for ABI pattern)

### Backend Profile Endpoint
- `apps/api/src/routes/users.ts` — `PATCH /users/profile` handler for autoApproveUsd update

### Database Schema
- `apps/db/src/schema.ts` — Users table with `autoApproveUsd` field (numeric, default 25)

### Prior Phase Context
- `.planning/phases/07-api-wiring/07-CONTEXT.md` — Phase 7 decisions on onboarding flow (D-05, D-06), user provisioning, session management

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MiniKit.sendTransaction()` — Already used in Transaction component for arbitrary contract calls via World App wallet. Accepts `chainId` + `transactions[]` with `to` and `data` (encoded function data).
- `useUserOperationReceipt` from `@worldcoin/minikit-react` — Polls for tx confirmation, returns `isLoading` state
- `encodeFunctionData` from `viem` — Already imported in Transaction component for encoding contract calls
- ERC20 `approve(spender, amount)` ABI — Standard, can be defined inline or imported

### Established Patterns
- MiniKit transaction flow: `sendTransaction()` → get `userOpHash` → poll with `useUserOperationReceipt` → handle success/failure
- Dark theme with neon accents (#ccff00 accent, #171717 surface) — used throughout onboarding
- `finish()` function in onboarding already handles profile save + redirect — needs to be extended with approval step

### Integration Points
- StepBudget `onFinish` callback → new approval flow (currently calls `finish()` directly)
- USDC contract address + GenieRouter address need to be available in frontend (currently only in backend env)
- `useUserOperationReceipt` hook needs a viem `PublicClient` for World Chain

</code_context>

<specifics>
## Specific Ideas

- The overlay should feel like a natural part of the onboarding, not a jarring interruption — dark background consistent with the rest of the flow
- The explanation text ("Authorizing Genie to spend up to $X USDC") builds user trust and reduces confusion when World App's wallet popup appears
- Blocking until approved is strict but correct — the entire app premise relies on GenieRouter having allowance

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 10-onboarding-allowance*
*Context gathered: 2026-04-05*
