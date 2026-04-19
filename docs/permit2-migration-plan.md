# Permit2 Migration Plan

This document captures the phased migration from the current ERC-20 allowance-based Genie transfer flow to a Permit2-based architecture that is compatible with World App / MiniKit.

## Context

The current architecture depends on a raw ERC-20 `approve(router, amount)` transaction followed by relayer-side `transferFrom`. That design does not work with the current World App / MiniKit transaction model for this app. The existing checkpoint before this migration is:

- Commit: `4bddc76`
- Tag: `pre-permit2-approval-checkpoint-2026-04-19`

If the Permit2 migration needs to be abandoned or reworked, use that tag as the rollback point.

## Target Outcome

Replace the broken approval flow with a Permit2-based authorization flow where:

- the user authorizes a bounded token spend using a supported signature path
- Genie can only move the exact amount authorized
- backend execution is tied to a specific payload, nonce, amount, token, and expiry
- no raw ERC-20 approval is required

## Phase 0: Freeze The Old Path

Goal:
- stop mixing the old allowance architecture with the new one

Work:
- keep `4bddc76` and tag `pre-permit2-approval-checkpoint-2026-04-19` as the rollback point
- remove or hard-disable the broken approval UX so nobody can continue down the unsupported `approve` flow
- write down the target flow in one place: user signs a Permit2 authorization in World App, Genie uses that authorization to move exactly the approved amount, and the backend records the result
- confirm one architectural choice before deeper implementation:
  - use `SignatureTransfer` for one-time spend authorizations
  - do not use `AllowanceTransfer`, because the point is to avoid persistent token approvals

Exit criteria:
- no live path in the UI attempts raw ERC-20 `approve`
- there is a short design note defining the new transaction flow end-to-end

## Phase 1: Add Permit2 Contract Support

Goal:
- make the contracts capable of pulling user USDC via Permit2 instead of ERC-20 allowance

Work:
- update `GenieRouter` so it integrates Uniswap Permit2
- replace `route(sender, amount, handler)` with a Permit2-based entrypoint that accepts:
  - permit struct
  - transfer details
  - user signature
  - destination handler
- keep `PayHandler` simple: receive funds and forward to recipient
- add contract tests for:
  - valid signature transfers for the exact amount
  - expired permit rejection
  - wrong token rejection
  - wrong spender/router rejection
  - replay prevention / nonce use

Exit criteria:
- local contract tests prove the router can pull USDC with Permit2 and cannot over-pull

## Phase 2: Refactor Backend Transfer Orchestration

Goal:
- make the API and relayer use the new contract entrypoint safely

Work:
- replace the backend assumption that `allowance(owner, router)` exists
- update `api/src/chain/transfer.ts` to call the new router method with Permit2 payloads
- define strict backend types for:
  - token
  - amount
  - nonce
  - deadline
  - signature
  - owner
  - recipient
- add validation to reject malformed or mismatched payloads before touching chain
- preserve transaction recording and logging, but log Permit2-specific identifiers instead of allowance reads

Exit criteria:
- backend can execute a transfer using a mocked or test Permit2 payload
- old allowance checks are removed from the send path

## Phase 3: Build The Frontend Signing Flow

Goal:
- replace the broken approval overlay with a signature authorization flow the wallet actually supports

Work:
- replace `ApprovalOverlay` with a `PermitOverlay` or equivalent UX
- explain to the user that they are authorizing a capped spend for a single transfer or bounded action, not sending funds immediately
- use a World App / MiniKit supported signing flow to collect the Permit2 signature
- send the signed payload to the backend only after local validation of:
  - wallet address
  - amount
  - expiry
  - nonce presence
- make failures explicit:
  - user rejected
  - signature invalid
  - expired authorization
  - backend rejected payload

Exit criteria:
- frontend can obtain a valid Permit2 authorization from the authenticated user and submit it

## Phase 4: Connect Chat And Send Flows

Goal:
- make actual Genie sends work end-to-end with confirmation rules

Work:
- redefine the meaning of the auto-approve threshold
- for amounts below threshold:
  - still require a Permit2 authorization if funds move on-chain
  - streamline the UX so it feels like one confirmation
- for amounts above threshold:
  - create a pending transaction
  - collect explicit confirmation
  - then collect Permit2 authorization tied to that pending tx
- ensure every pending tx binds:
  - sender
  - recipient
  - amount
  - deadline
  - nonce or unique reference

Exit criteria:
- same-chain send works through the normal product flow without any ERC-20 allowance dependency

## Phase 5: Security Hardening And Replay Controls

Goal:
- close the obvious financial risk gaps before broader use

Work:
- bind signature payloads to:
  - exact token
  - exact amount
  - exact intended router/spender
  - short expiry
  - unique nonce
- add backend replay protection for submitted authorizations
- add monitoring and logs for:
  - rejected signatures
  - reused nonces
  - chain failures
  - partial backend failures
- review failure recovery:
  - tx pending but DB write failed
  - DB pending but signature expired
  - relayer submitted but receipt fetch delayed

Exit criteria:
- replay, mismatch, and stale authorization cases are explicitly tested

## Phase 6: End-To-End Verification And Cleanup

Goal:
- ship the new path without dragging old assumptions behind it

Work:
- add integration tests across frontend, API, and contracts
- remove dead code tied to:
  - `approve`
  - allowance polling
  - approval-specific copy and logs
- add a short operator runbook:
  - how to verify a Permit2 transfer
  - how to inspect failure states
  - how to roll back to the checkpoint if needed

Exit criteria:
- full happy path and core failure paths are tested
- old allowance architecture is fully removed or isolated behind a dead feature flag

## Recommended Build Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6

## Working Recommendation

Start with Phase 0 and Phase 1 only, then stop and validate the contract surface before touching the frontend again.
