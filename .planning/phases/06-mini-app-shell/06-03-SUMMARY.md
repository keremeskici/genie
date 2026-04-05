---
phase: 06-mini-app-shell
plan: "03"
subsystem: mini-app-shell
tags: [minikit, payments, wallet-signing, permissions, world-app]
dependency_graph:
  requires: [06-01, 06-02]
  provides: [minikit-pay-integration, wallet-signing, permission-collection]
  affects: [apps/web/src/components/ChatInterface/index.tsx, apps/web/src/lib/minikit.ts]
tech_stack:
  added: []
  patterns: [MiniKit.pay(), MiniKit.walletAuth(), MiniKit.getUserInfo(), payment-confirmation-json-fence]
key_files:
  created:
    - apps/web/src/lib/minikit.ts
  modified:
    - apps/web/src/components/ChatInterface/index.tsx
decisions:
  - "requestMiniKitPermissions uses walletAuth+getUserInfo instead of requestPermission(['wallet-address']) — actual SDK Permission enum only supports notifications/contacts/microphone, not wallet-address"
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_changed: 2
---

# Phase 06 Plan 03: MiniKit Pay Integration Summary

**One-liner:** MiniKit Pay triggers World App's native payment sheet when agent confirms USDC send; wallet signing and permission collection wired via centralized minikit.ts helper with isInstalled() guards throughout.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create MiniKit helper module for Pay, permissions, and wallet signing | 1a655da | apps/web/src/lib/minikit.ts |
| 2 | Wire MiniKit Pay and permission requests into ChatInterface | 4c75203 | apps/web/src/components/ChatInterface/index.tsx |

## What Was Built

### MiniKit Helper Module (`apps/web/src/lib/minikit.ts`)

Three exported functions:

1. **`triggerMiniKitPay`** (D-12): Fetches a payment reference from `/api/initiate-payment`, calls `MiniKit.pay()` for USDC transfers. Returns `{ success, transactionId }` or `null` if MiniKit unavailable.

2. **`requestMiniKitPermissions`** (D-15): Uses `walletAuth` to authenticate and get wallet address, then `getUserInfo` to fetch username and profile picture. Returns `{ walletAddress, username, profilePictureUrl }` or `null`.

3. **`triggerWalletSign`** (D-13): Wraps `MiniKit.walletAuth` for on-chain transaction signing. Returns `{ signature, address }` or `null`.

All three functions guard with `MiniKit.isInstalled()` for graceful degradation outside World App.

### ChatInterface Wiring (`apps/web/src/components/ChatInterface/index.tsx`)

- **Permission collection on first message (D-15):** `permissionsRequested` ref tracks first-message state. On first `handleSend`, fires `requestMiniKitPermissions()` as fire-and-forget — doesn't block the message send.

- **Payment detection useEffect (D-12):** Watches `messages` array for latest assistant message. Scans for ` ```json ` fence containing `{ type: "payment_confirmation", to, amount }`. When detected, calls `triggerMiniKitPay` to open World App's native payment sheet.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] requestMiniKitPermissions adapted to correct SDK API**

- **Found during:** Task 1
- **Issue:** Plan's research context showed `MiniKit.requestPermission({ permission: ['wallet-address', 'username', 'profile-picture'] })` but the actual SDK's `Permission` enum only supports `notifications`, `contacts`, and `microphone`. The API cannot request wallet-address or username via `requestPermission`.
- **Fix:** Replaced with `MiniKit.walletAuth()` to authenticate and get wallet address, followed by `MiniKit.getUserInfo(walletAddress)` to fetch username and profilePictureUrl. This achieves the same behavioral goal (collecting wallet address and user profile on first interaction) using the correct SDK methods.
- **Files modified:** `apps/web/src/lib/minikit.ts`
- **Commit:** 1a655da

## Success Criteria Verification

- MiniKit Pay triggers World App's native payment sheet when agent confirms USDC send (D-12) — `triggerMiniKitPay` wired in ChatInterface useEffect
- MiniKit wallet signing helper available for transaction commands (D-13) — `triggerWalletSign` exported from minikit.ts
- Permission requests fire on first chat message to collect wallet address, username, profile picture (D-15) — `requestMiniKitPermissions` called in first-message guard
- All MiniKit commands guarded by `MiniKit.isInstalled()` for graceful degradation — 3 guards in minikit.ts + existing guard in ChatInterface
- `next build` passes with zero TypeScript errors — confirmed

## Known Stubs

None. All three MiniKit functions are fully implemented and wired. The payment `transactionId` is logged to console for hackathon scope; production flow would send it back to the agent for on-chain verification.

## Self-Check: PASSED

All created files exist. All commits verified in git log.
