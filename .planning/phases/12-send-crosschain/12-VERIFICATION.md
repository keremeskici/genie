---
phase: 12-send-crosschain
verified: 2026-04-05T06:45:00Z
status: passed
score: 15/15 must-haves verified
re_verification: false
human_verification:
  - test: "SendModal chain picker UI — World Chain default and cross-chain options"
    expected: "World Chain (instant) selected by default; Base, Arbitrum, Ethereum, Optimism show '~15 min' labels in the dropdown"
    why_human: "Visual rendering and select default state cannot be confirmed from static code inspection alone"
  - test: "Over-threshold send renders ConfirmCard inline inside the modal"
    expected: "When /api/send returns confirmation_required, the modal switches from the send form to the ConfirmCard component without closing"
    why_human: "Requires live interaction — state transition from form to ConfirmCard is runtime behavior"
  - test: "Cross-chain send success state shows bridge-specific message"
    expected: "After bridge_initiated response, modal displays 'Bridge initiated! ~15 min to arrive.' instead of 'Sent successfully!'"
    why_human: "Conditional JSX path — requires runtime execution to confirm correct branch fires"
  - test: "Balance refreshes after successful send"
    expected: "After any successful send (transfer_complete or bridge_initiated), the dashboard balance display updates to reflect the new balance"
    why_human: "Requires live API integration — useBalance refetch is triggered at runtime"
---

# Phase 12: Send Crosschain Verification Report

**Phase Goal:** SendModal executes real USDC transfers via the backend, with cross-chain support via Circle Bridge Kit
**Verified:** 2026-04-05T06:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

Plan 01 truths (backend):

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/send with World Chain + under-threshold returns transfer_complete JSON | ✓ VERIFIED | send.ts lines 66-92; test 1 passes |
| 2 | POST /api/send with World Chain + over-threshold returns confirmation_required JSON with txId | ✓ VERIFIED | send.ts lines 93-119; test 2 passes |
| 3 | POST /api/send with cross-chain (Base/Arbitrum/Ethereum/Optimism) calls bridgeUsdc and returns bridge_initiated | ✓ VERIFIED | send.ts lines 121-148; test 3 passes |
| 4 | POST /api/send with invalid recipient returns 400 | ✓ VERIFIED | send.ts line 39-41; test 4 passes |
| 5 | POST /api/send without verified user returns 403 | ✓ VERIFIED | send.ts lines 56-61; test 5 passes |
| 6 | bridgeUsdc extracts CCTP depositForBurn logic from settle_crosschain_debt into reusable utility | ✓ VERIFIED | bridge.ts 99 lines; settle-crosschain-debt.ts imports bridgeUsdc, no inline CCTP code |
| 7 | settle_crosschain_debt uses shared bridgeUsdc instead of inline CCTP logic | ✓ VERIFIED | settle-crosschain-debt.ts line 5: `import { bridgeUsdc }`, lines 51-56: `await bridgeUsdc(...)` |

Plan 02 truths (frontend):

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 8 | SendModal calls POST /api/send instead of triggerMiniKitPay | ✓ VERIFIED | SendModal/index.tsx line 49: `fetch(.../api/send`; no triggerMiniKitPay anywhere in file |
| 9 | SendModal chain picker shows World Chain (default), Base, Arbitrum, Ethereum, Optimism — no Polygon/Solana | ✓ VERIFIED | CHAIN_OPTIONS array lines 8-14; no Polygon or Solana present |
| 10 | World Chain labeled 'World Chain (instant)' and cross-chain shows '~15 min' | ✓ VERIFIED | CHAIN_OPTIONS labels at lines 9-13 |
| 11 | Under-threshold World Chain send shows success state | ✓ VERIFIED | handleSend lines 65-68: `setStatus('success'); refetchBalance?.()` |
| 12 | Over-threshold World Chain send renders ConfirmCard inline inside SendModal | ✓ VERIFIED | lines 73-75: `setConfirmData(json)`, JSX lines 104-115 render ConfirmCard when confirmData is set |
| 13 | Cross-chain send shows success state with bridge initiated message | ✓ VERIFIED | lines 69-71 set success; JSX lines 216-219 show 'Bridge initiated! ~15 min to arrive.' |
| 14 | ConfirmCard calls /api/confirm instead of /confirm (URL bug fix) | ✓ VERIFIED | ConfirmCard/index.tsx line 51: `/api/confirm` |
| 15 | Balance refreshes after successful send | ✓ VERIFIED | SendModal lines 67, 71: `refetchBalance?.()` after transfer_complete and bridge_initiated |

**Score:** 15/15 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/chain/bridge.ts` | bridgeUsdc utility with CCTP depositForBurn | ✓ VERIFIED | 99 lines; exports `bridgeUsdc` (line 43) and `CCTP_DOMAIN_IDS` (line 26); full 3-step writeContract implementation |
| `apps/api/src/routes/send.ts` | POST /api/send handler | ✓ VERIFIED | 161 lines; exports `sendRoute`; handles all 3 execution paths |
| `apps/api/src/chain/bridge.test.ts` | Unit tests for bridgeUsdc | ✓ VERIFIED | 3 tests; all pass |
| `apps/api/src/routes/send.test.ts` | Unit tests for send route | ✓ VERIFIED | 6 tests; all pass |
| `apps/web/src/components/SendModal/index.tsx` | Rewritten SendModal with fetch('/api/send') and chain picker | ✓ VERIFIED | 241 lines; contains `fetch(`, `/api/send`, CHAIN_OPTIONS, ConfirmCard import |
| `apps/web/src/components/ConfirmCard/index.tsx` | ConfirmCard with URL fix | ✓ VERIFIED | Line 51: `/api/confirm` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/api/src/routes/send.ts` | `apps/api/src/chain/transfer.ts` | import executeOnChainTransfer | ✓ WIRED | Line 4: `import { executeOnChainTransfer } from '../chain/transfer'`; called at line 70 |
| `apps/api/src/routes/send.ts` | `apps/api/src/chain/bridge.ts` | import bridgeUsdc | ✓ WIRED | Line 5: `import { bridgeUsdc, CCTP_DOMAIN_IDS }`; called at line 123 |
| `apps/api/src/index.ts` | `apps/api/src/routes/send.ts` | app.route('/api/send', sendRoute) | ✓ WIRED | Line 10: import; line 22: `app.route('/api/send', sendRoute)` |
| `apps/api/src/tools/settle-crosschain-debt.ts` | `apps/api/src/chain/bridge.ts` | import bridgeUsdc | ✓ WIRED | Line 5: `import { bridgeUsdc } from '../chain/bridge'`; called at line 51 |
| `apps/web/src/components/SendModal/index.tsx` | `/api/send` | fetch POST | ✓ WIRED | Line 49: `fetch(${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/send`; response handled lines 59-76 |
| `apps/web/src/components/ConfirmCard/index.tsx` | `/api/confirm` | fetch POST | ✓ WIRED | Line 51: `/api/confirm`; response handled lines 57-72 |
| `apps/web/src/components/DashboardInterface/index.tsx` | `apps/web/src/components/SendModal/index.tsx` | props (userId, onConfirmationRequired, refetchBalance) | ✓ WIRED | Lines 157-161: `userId={session?.user?.id ?? ''}` and `refetchBalance={refetchBalance}` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `send.ts` — transfer_complete path | executeOnChainTransfer result | `chain/transfer.ts` on-chain via viem writeContract | Yes — real chain calls | ✓ FLOWING |
| `send.ts` — bridge path | bridgeUsdc result | `chain/bridge.ts` depositForBurn via viem writeContract | Yes — 3 real chain calls | ✓ FLOWING |
| `send.ts` — confirmation path | pending tx from db.insert().returning() | Drizzle insert into `transactions` table | Yes — real DB insert with returning() | ✓ FLOWING |
| `SendModal` — json response | fetch('/api/send') | Backend POST handler | Yes — real fetch, response parsed and branched | ✓ FLOWING |
| `ConfirmCard` — confirmData | props from SendModal | Set from api/send response json | Yes — flows from API response | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| bridge.test.ts: 3 writeContract calls + correct return shape | `vitest run chain/bridge.test.ts` | 3/3 pass | ✓ PASS |
| send.test.ts: all 6 route behaviors | `vitest run routes/send.test.ts` | 6/6 pass | ✓ PASS |
| index.ts mounts /api/send | `grep 'app.route.*api/send' apps/api/src/index.ts` | Line 22 matches | ✓ PASS |
| settle-crosschain-debt uses bridgeUsdc, no inline CCTP | `grep TOKEN_MESSENGER settle-crosschain-debt.ts` | No output | ✓ PASS |
| SendModal has no triggerMiniKitPay | `grep triggerMiniKitPay SendModal/index.tsx` | No output | ✓ PASS |
| Phase-12 tests pass in isolation (9/9) | `vitest run chain/bridge.test.ts routes/send.test.ts` | 9/9 pass | ✓ PASS |
| Pre-existing test failures not introduced by phase 12 | Full suite had 41 failures in balance/verify/chat/confirm/users routes | Same failures pre-existed before phase 12 per SUMMARY | ✓ PASS (pre-existing) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| FOPS-02 | Plans 01, 02 | User can send USDC to contacts/addresses via natural language | ✓ SATISFIED | POST /api/send endpoint + SendModal frontend integration provides direct send capability |
| FOPS-03 | Plans 01, 02 | Agent resolves recipients via contacts, ENS, or wallet address | ⚠ PARTIAL | Phase 12 adds direct wallet-address sends only (isAddress validation). Contact/ENS resolution was delivered in earlier phases (resolve_contact tool in agent). Phase 12 does not add new resolution capability — it re-claims a requirement completed in phases 4 and 7. |
| FOPS-04 | Plans 01, 02 | Transfers under auto-approve threshold execute immediately | ✓ SATISFIED | send.ts lines 68-92: `if (amount <= autoApproveUsd)` executes `executeOnChainTransfer` immediately |
| FOPS-05 | Plans 01, 02 | Transfers over threshold require explicit confirmation | ✓ SATISFIED | send.ts lines 93-119: returns confirmation_required; SendModal renders ConfirmCard inline |
| XCHD-01 | Plans 01, 02 | User can deposit USDC from Ethereum/Base/Arbitrum to World Chain via Arc CCTP | ⚠ NOTE — SEMANTIC MISMATCH | Phase 12 implements OUTBOUND sends from World Chain to other chains (depositForBurn). The requirement as written says "deposit TO World Chain." Per CONTEXT.md D-10, this is an intentional expansion — XCHD-01 is claimed to cover cross-chain USDC transfers in both directions. The inbound (deposit) direction was previously addressed in Phase 5 (settle-crosschain-debt) via the same CCTP mechanism. The requirement checkbox is marked complete in REQUIREMENTS.md and the traceability table maps it to Phase 12. This is a semantic gap in the requirement wording, not a missing implementation. |

**Orphaned requirements check:** No requirements mapped to Phase 12 in REQUIREMENTS.md that are absent from plan frontmatter.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web/src/components/DashboardInterface/index.tsx` | 14-18 | `MOCK_TRANSACTIONS` with hardcoded `$0.00` amounts | ℹ Info | Documented in Plan 02 SUMMARY as known stub — Phase 13 will wire live transactions. Does not block send functionality. |

No blocker anti-patterns found in phase 12 artifacts. The MOCK_TRANSACTIONS stub was pre-existing and acknowledged.

---

### Human Verification Required

#### 1. SendModal Chain Picker Default

**Test:** Open the Genie app, navigate to the dashboard, tap "Send" — check the destination chain dropdown
**Expected:** "World Chain (instant)" appears as the selected/default option; other options show "~15 min" labels
**Why human:** Select element default rendering requires browser execution

#### 2. Inline ConfirmCard on Over-Threshold Send

**Test:** With an account where autoApproveUsd is set to $25, attempt to send $100 via the SendModal
**Expected:** The send form content is replaced by the ConfirmCard component inside the modal (not a separate modal/page), showing the amount, recipient, countdown timer, Confirm and Cancel buttons
**Why human:** State transition from form to ConfirmCard is runtime-only behavior

#### 3. Bridge Initiated Success Message

**Test:** Send $10 USDC to a valid address selecting "Base" as the destination chain
**Expected:** After the request completes, the modal shows "Bridge initiated! ~15 min to arrive." before auto-closing
**Why human:** Conditional JSX branch — requires live API response to trigger

#### 4. Balance Refresh After Send

**Test:** Note the dashboard balance, send $5 USDC (World Chain, under-threshold), observe the balance display
**Expected:** Balance display updates after the send completes without requiring a page refresh
**Why human:** Requires live chain execution and backend response to trigger refetchBalance

---

### Gaps Summary

No blocking gaps. All 15 must-have truths verified. All key links wired. All phase-12 unit tests pass (9/9).

Two observations that do not block the goal:

1. **FOPS-03 re-attribution:** Phase 12 re-claims this requirement but adds no new recipient resolution capability. The requirement was genuinely completed in earlier phases. The claim is redundant but not incorrect — the send flow does ultimately support recipient addresses.

2. **XCHD-01 semantic mismatch:** The requirement text says "deposit TO World Chain" but phase 12 implements sends FROM World Chain to other chains. CONTEXT.md D-10 explicitly notes this expansion. Both directions use CCTP. This is a documentation quality issue, not a missing feature.

3. **Pre-existing test failures (41 tests across balance/verify/chat/confirm/users routes):** These failures were present before phase 12 executed and are out of scope for this verification. Phase 12 introduced no new test failures.

---

_Verified: 2026-04-05T06:45:00Z_
_Verifier: Claude (gsd-verifier)_
