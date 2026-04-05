---
phase: 10-onboarding-allowance
verified: 2026-04-05T04:00:00Z
status: passed
score: 6/6 must-haves verified
re_verification: false
human_verification:
  - test: "MiniKit wallet popup triggers on 'Let's Go'"
    expected: "World App wallet popup appears requesting USDC.approve(GenieRouter, budget*1e6) signature"
    why_human: "MiniKit.sendTransaction requires a live World App session; cannot invoke wallet popup programmatically in static analysis"
  - test: "Pending/success/error overlay renders correctly"
    expected: "Dark overlay with animated spinner (pending), green checkmark (success), red X + Try Again button (error)"
    why_human: "Visual rendering requires browser; CSS animation and SVG rendering not verifiable via grep"
---

# Phase 10: Onboarding Allowance Verification Report

**Phase Goal:** When user sets their spending limit in onboarding, the app calls USDC.approve(GenieRouter, amount) via MiniKit wallet signing — without this, no transfers can execute
**Verified:** 2026-04-05T04:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                  | Status     | Evidence                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | StepBudget "Let's Go" button triggers a USDC.approve transaction for GenieRouter       | VERIFIED   | `ctaAction = step === 2 ? () => setShowApproval(true) : ...` at line 88 of onboarding/page.tsx; ApprovalOverlay calls `MiniKit.sendTransaction` on mount |
| 2   | Approval amount equals the user's chosen budget in 6-decimal USDC units                | VERIFIED   | `BigInt(budgetUsd) * BigInt(1_000_000)` at ApprovalOverlay line 31; `budgetUsd={Number(budget)}` passed from onboarding line 143                    |
| 3   | User signs the transaction via MiniKit wallet popup                                    | VERIFIED   | `MiniKit.sendTransaction({ chainId: 480, transactions: [...] })` at ApprovalOverlay lines 32-44                                                      |
| 4   | After successful approval, autoApproveUsd is saved to backend and user redirects to /home | VERIFIED   | `onSuccess={() => finish(budget)}` at onboarding line 144; `finish()` calls `PATCH /api/users/profile` then `router.push('/home')`                  |
| 5   | If user rejects or tx fails, error is shown with a Try Again button                    | VERIFIED   | try/catch sets state to `'error'` at line 54; error state renders `<button onClick={runApproval}>Try Again</button>` at lines 121-127               |
| 6   | User cannot proceed to /home without successful approval                               | VERIFIED   | `ctaAction` on step 2 only calls `setShowApproval(true)` — never calls `finish()` directly; `finish()` is only reachable via `onSuccess` callback after tx confirm; swipe-forward on step 2 calls `goTo(3)` which is blocked by `if (next > 2) return` guard |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact                                                   | Expected                                                                        | Status   | Details                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `apps/web/src/lib/contracts.ts`                            | ERC20 approve ABI fragment, USDC_ADDRESS, GENIE_ROUTER_ADDRESS from env vars   | VERIFIED | Exports `ERC20_APPROVE_ABI`, `USDC_ADDRESS`, `GENIE_ROUTER_ADDRESS`; 15 lines, substantive |
| `apps/web/src/components/ApprovalOverlay/index.tsx`        | Full-screen dark overlay with spinner/success/error states, MiniKit tx signing  | VERIFIED | 131 lines; implements 3-state machine, MiniKit.sendTransaction, poll, onSuccess callback |
| `apps/web/src/app/onboarding/page.tsx`                     | Onboarding page wired to show ApprovalOverlay before saving profile/redirecting | VERIFIED | Imports ApprovalOverlay, `showApproval` state gates `finish()` call                     |

### Key Link Verification

| From                                    | To                                       | Via                                           | Status   | Details                                                                                    |
| --------------------------------------- | ---------------------------------------- | --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `apps/web/src/app/onboarding/page.tsx`  | `ApprovalOverlay`                        | Rendered when `showApproval === true`          | WIRED    | Import at line 6; JSX at line 142 guarded by `{showApproval && ...}`                      |
| `ApprovalOverlay/index.tsx`             | `MiniKit.sendTransaction`                | `encodeFunctionData` with ERC20 approve ABI   | WIRED    | Lines 32-44; chainId 480, `to: USDC_ADDRESS`, `args: [GENIE_ROUTER_ADDRESS, amount]`      |
| `ApprovalOverlay/index.tsx`             | `useUserOperationReceipt`                | `poll(result.data.userOpHash)` for confirmation | WIRED  | Hook initialized at line 26; `await poll(...)` at line 46                                 |
| `apps/web/src/lib/contracts.ts`         | `NEXT_PUBLIC_GENIE_ROUTER_ADDRESS` env var | `process.env.NEXT_PUBLIC_GENIE_ROUTER_ADDRESS` | WIRED  | Line 15 of contracts.ts; env var present in `apps/web/.env.local`                         |

### Data-Flow Trace (Level 4)

| Artifact                              | Data Variable  | Source                                              | Produces Real Data | Status    |
| ------------------------------------- | -------------- | --------------------------------------------------- | ------------------ | --------- |
| `ApprovalOverlay/index.tsx`           | `budgetUsd`    | Passed as prop from onboarding `budget` state       | Yes — user input   | FLOWING   |
| `ApprovalOverlay/index.tsx`           | `USDC_ADDRESS` | `process.env.NEXT_PUBLIC_USDC_ADDRESS` in .env.local | Yes — `0x66145f38cBAC35Ca6F1Dfb4914dF98F1614aeA88` | FLOWING |
| `ApprovalOverlay/index.tsx`           | `GENIE_ROUTER_ADDRESS` | `process.env.NEXT_PUBLIC_GENIE_ROUTER_ADDRESS` in .env.local | Yes — `0x3523872C9a5352E879a2Dfe356B51a1FC7c1808D` | FLOWING |
| `apps/web/src/app/onboarding/page.tsx` | `budget` (to `finish()`) | User input via `StepBudget` `onChange` prop      | Yes — user input   | FLOWING   |

### Behavioral Spot-Checks

Step 7b: SKIPPED — Phase requires a live MiniKit/World App session to invoke wallet signing. No server-runnable entry points exist that can simulate the on-chain tx without World App.

Commit verification passed:
- `cdf3518` — feat(10-01): add ERC20 contracts constants and ApprovalOverlay component — EXISTS in git log
- `8219635` — feat(10-01): wire ApprovalOverlay into onboarding StepBudget flow — EXISTS in git log

### Requirements Coverage

| Requirement | Source Plan      | Description                                                                    | Status   | Evidence                                                                                                       |
| ----------- | ---------------- | ------------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| FOPS-04     | 10-01-PLAN.md    | Transfers under auto-approve threshold execute immediately                     | SATISFIED | On-chain allowance is established in onboarding via `USDC.approve(GenieRouter, budget*1e6)`; this unblocks GenieRouter from pulling USDC for sub-threshold transfers |
| FOPS-06     | 10-01-PLAN.md    | GenieRouter + PayHandler smart contracts handle transfers on World Chain        | SATISFIED | `GENIE_ROUTER_ADDRESS` is the spender in the approve call; contract address sourced from `NEXT_PUBLIC_GENIE_ROUTER_ADDRESS` env var; allowance enables GenieRouter to execute transfers |

Note: REQUIREMENTS.md maps FOPS-06 to Phase 4 (contract deployment) with status Complete. Phase 10's contribution is the client-side allowance that enables GenieRouter to use its transfer capability — both phases are necessary for the requirement to be fully satisfied end-to-end.

### Anti-Patterns Found

| File                                              | Line | Pattern                                              | Severity | Impact                                                                                                                        |
| ------------------------------------------------- | ---- | ---------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/web/src/components/ApprovalOverlay/index.tsx` | 21   | `createPublicClient` called bare at render level — no `useMemo` or `useRef` | Warning | New `client` object created on every render; passed to `useUserOperationReceipt` — could cause hook instability if the component re-renders during the tx polling window. Does not block the goal but may cause polling to restart unexpectedly on re-render. |

### Human Verification Required

#### 1. MiniKit Wallet Popup

**Test:** In World App (or dev simulator), navigate to `/onboarding`, complete steps 0 and 1, enter a budget amount on step 2, and tap "Let's Go"
**Expected:** Full-screen dark overlay appears immediately, MiniKit wallet popup triggers requesting ERC20 approve signature for the exact budget amount
**Why human:** `MiniKit.sendTransaction` requires a live World App WebView session; static analysis cannot invoke the wallet popup

#### 2. Approval State Machine Visual Correctness

**Test:** Observe the overlay during the three states: (a) after tapping "Let's Go" before wallet response, (b) after approving in wallet, (c) after rejecting in wallet
**Expected:** (a) animated spinner + "Authorizing Genie..." text; (b) green checkmark + "Approved! Redirecting..." then redirect to /home; (c) red X icon + "Transaction failed or was rejected" + neon "Try Again" button
**Why human:** CSS animation (`animate-spin`) and SVG rendering require browser; redirect timing (1.5s setTimeout) requires runtime

#### 3. Post-Approval Backend Save

**Test:** Complete the full flow and verify in the database or API response that `autoApproveUsd` is saved with the correct value
**Expected:** `PATCH /api/users/profile` receives `{ userId, autoApproveUsd: <budget> }` and the value persists
**Why human:** Requires a live backend session with authenticated user

### Gaps Summary

No gaps. All 6 observable truths verified. All 3 required artifacts exist, are substantive, and are wired. All 4 key links are active. Both requirement IDs (FOPS-04, FOPS-06) are satisfied. One warning-level anti-pattern found (`createPublicClient` at render level) but it does not block goal achievement.

---

_Verified: 2026-04-05T04:00:00Z_
_Verifier: Claude (gsd-verifier)_
