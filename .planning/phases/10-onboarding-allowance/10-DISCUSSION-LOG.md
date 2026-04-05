# Phase 10: Onboarding Contract Allowance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 10-onboarding-allowance
**Areas discussed:** Approval trigger & flow, Approval amount strategy, Wallet signing UX, Failure & rejection handling

---

## Approval Trigger & Flow

| Option | Description | Selected |
|--------|-------------|----------|
| On 'Let's Go' tap | User taps the final CTA on StepBudget → approve tx fires → on success, save profile to backend → redirect to /home. Single action, clean flow. | ✓ |
| Separate step after budget | Add a 4th onboarding step dedicated to approval: shows amount, explains what's happening, has a 'Sign' button. More explicit but adds friction. | |
| After onboarding completes | Save profile first, redirect to /home, then prompt for approval as a banner/modal. | |

**User's choice:** On 'Let's Go' tap
**Notes:** None

### Follow-up: Order of operations

| Option | Description | Selected |
|--------|-------------|----------|
| Approve first, then save | Approve on-chain → confirm receipt → save autoApproveUsd to backend. If approve fails, nothing is saved — consistent state. | ✓ |
| Save first, then approve | Save profile immediately → then fire approve. Profile is saved even if user rejects signing. | |

**User's choice:** Approve first, then save
**Notes:** None

---

## Approval Amount Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Exact budget amount | Approve exactly what the user typed (e.g., $100 = 100 USDC). Safer, transparent, matches user expectation. Needs re-approval if they change the limit later. | ✓ |
| Max uint256 (infinite) | One-time unlimited approval. No re-approval needed ever. Common in DeFi but grants broad trust to GenieRouter contract. | |
| Budget × 2 (buffer) | Approve double the budget as a buffer. Reduces re-approval frequency while keeping a cap. | |

**User's choice:** Exact budget amount
**Notes:** None

---

## Wallet Signing UX

| Option | Description | Selected |
|--------|-------------|----------|
| Replace CTA with spinner | 'Let's Go' button shows a loading spinner + 'Approving...' text. Minimal change, stays on the same screen. | |
| Full-screen loading overlay | Dark overlay with spinner, message like 'Setting up your wallet...'. More dramatic, blocks interaction entirely until done. | ✓ |
| Progress steps indicator | Show a mini step tracker: 'Signing → Confirming → Done'. More informative but more UI work for a hackathon. | |

**User's choice:** Full-screen loading overlay
**Notes:** None

### Follow-up: Explanation text on overlay

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, explain the approval | Short message explaining what the user is signing. Builds trust, reduces confusion about the wallet popup. | ✓ |
| Just a spinner + 'Setting up...' | Keep it simple. The wallet popup from World App already explains the transaction details. | |

**User's choice:** Yes, explain the approval
**Notes:** None

---

## Failure & Rejection Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Allow skip, proceed to /home | Show error message on overlay, then offer 'Try Again' and 'Skip for now'. | |
| Block onboarding until approved | User cannot proceed past StepBudget without successful approval. Show retry button. | ✓ |
| Auto-retry once, then skip | If first attempt fails, retry automatically. If second fails, allow skip. | |

**User's choice:** Block onboarding until approved
**Notes:** None

### Follow-up: Escape hatch after N attempts

| Option | Description | Selected |
|--------|-------------|----------|
| No escape — must approve | Approval is required for the app to function. Keep showing retry. User can close the app if they don't want to approve. | ✓ |
| Allow skip after 3 failures | After 3 rejections, show a 'Skip' option. They can explore but sends are blocked until they approve from settings. | |

**User's choice:** No escape — must approve
**Notes:** None

---

## Claude's Discretion

- Overlay animation and transition details
- Exact error message copy
- Loading spinner style
- Receipt polling strategy
- Contract address exposure to frontend

## Deferred Ideas

None — discussion stayed within phase scope
