---
status: partial
phase: 07-api-wiring
source: [07-VERIFICATION.md]
started: "2026-04-05"
updated: "2026-04-05"
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end chat with wallet address
expected: Send a message via ChatInterface with a wallet-authenticated session; verify streamed response from Hono backend (no 404)
result: [pending]

### 2. New user onboarding redirect
expected: Sign in with a new wallet; verify redirect to /onboarding, complete flow, verify threshold persists to DB
result: [pending]

### 3. Existing user skip-onboarding
expected: Sign in with a user who has a non-0x displayName; verify direct access to /home without onboarding
result: [pending]

### 4. Protected route redirect
expected: Access /home without a session; verify redirect to landing page
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
