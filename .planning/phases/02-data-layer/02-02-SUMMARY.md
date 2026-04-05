---
phase: 02-data-layer
plan: 02
subsystem: kv
tags: [kv, agent-memory, 0g-storage, typescript]
dependency_graph:
  requires: []
  provides: [kv-service-layer, agent-memory-type, kv-read-write-helpers]
  affects: [agent/context.ts, routes/chat.ts]
tech_stack:
  added: ["@0glabs/0g-ts-sdk@0.3.3", "ethers@6.16.0"]
  patterns: [graceful-degradation, tdd, barrel-export]
key_files:
  created:
    - apps/api/src/kv/types.ts
    - apps/api/src/kv/client.ts
    - apps/api/src/kv/memory.ts
    - apps/api/src/kv/index.ts
    - apps/api/src/kv/memory.test.ts
  modified:
    - apps/api/vitest.config.ts
    - pnpm-lock.yaml
decisions:
  - "Used Value.data (Base64 string) from KvClient.getValue return type — SDK returns structured object not raw string"
  - "Passed undefined as unknown as FixedPriceFlow for Batcher constructor — SDK auto-discovers flowContract via indexer (RESEARCH open question 2)"
  - "encodeKvKey returns Uint8Array passed directly to KvClient.getValue without ethers.encodeBase64 — SDK accepts Bytes-compatible input"
metrics:
  duration: "~4 minutes"
  completed: "2026-04-04T11:34:54Z"
  tasks: 2
  files: 7
---

# Phase 02 Plan 02: 0G Storage KV Service Layer Summary

**One-liner:** 0G KV service layer with AgentMemory type, encode/decode helpers, and graceful read/write functions that never break chat.

## What Was Built

### Task 1: AgentMemory Type and Tests (TDD)

Created `apps/api/src/kv/types.ts` with:
- `AgentMemory` interface covering `financialProfile`, `preferences`, `activeGoals`, and `updatedAt`
- `DEFAULT_MEMORY` constant with empty defaults for new users
- `encodeKvKey(key: string): Uint8Array` — UTF-8 encode for KV key
- `encodeKvValue(memory: AgentMemory): string` — base64 encode for KV write
- `decodeKvValue(raw: string | null | undefined): AgentMemory | null` — safe base64 decode with null/error guard

TDD: failing tests committed first (RED), then implementation (GREEN). 8 tests covering shape, encode, decode, round-trip, and null handling.

### Task 2: KV Client Factories and Read/Write Helpers

Created `apps/api/src/kv/client.ts`:
- `createKvReader()` — returns `KvClient | null` (warns and returns null if `OG_KV_CLIENT_URL` unset)
- `createKvWriter()` — returns `{ batcher, streamId } | null` (warns and returns null if `OG_PRIVATE_KEY` or `OG_KV_STREAM_ID` unset)

Created `apps/api/src/kv/memory.ts`:
- `readMemory(userId: string): Promise<AgentMemory | null>` — wraps KvClient.getValue, never throws
- `writeMemory(userId: string, memory: AgentMemory): Promise<boolean>` — wraps Batcher.exec, never throws

Created `apps/api/src/kv/index.ts` — barrel re-export of all public API.

Updated `apps/api/vitest.config.ts` with `OG_KV_CLIENT_URL` and `OG_KV_STREAM_ID` test env vars.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| ad5694a | test | TDD RED: failing tests for AgentMemory encode/decode |
| 046bd6a | feat | TDD GREEN: AgentMemory type, DEFAULT_MEMORY, encode/decode |
| f932537 | feat | KV client factories, memory read/write, barrel export |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SDK API mismatch: KvClient.getValue returns Value object, not string**
- **Found during:** Task 2
- **Issue:** The plan's `memory.ts` template called `decodeKvValue(raw)` where `raw` was the direct return of `kvClient.getValue()`. The SDK returns `Value | null` where `Value = { version, data: Base64, size }`, not a plain string.
- **Fix:** Changed to `decodeKvValue(result.data)` — passes `result.data` (the Base64 string field) to the decoder.
- **Files modified:** `apps/api/src/kv/memory.ts`
- **Commit:** f932537

**2. [Rule 1 - Bug] Fixed SDK type: getValue key parameter is Bytes, not string**
- **Found during:** Task 2
- **Issue:** Plan template used `ethers.encodeBase64(encodeKvKey(key))` as the key argument. KvClient.getValue accepts `Bytes` (Uint8Array-compatible), not a base64 string. The base64 encoding is only needed for the HTTP query param at the transport level (done internally by SDK).
- **Fix:** Pass `encodeKvKey(key)` directly (Uint8Array) with `as unknown as Parameters<...>[1]` cast to satisfy TypeScript.
- **Files modified:** `apps/api/src/kv/memory.ts`
- **Commit:** f932537

**3. [Rule 2 - Missing] FixedPriceFlow type cast for Batcher constructor**
- **Found during:** Task 2
- **Issue:** `new Batcher(1, nodes, undefined, EVM_RPC)` fails TypeScript — third arg is `FixedPriceFlow` (a contract type), not optional. Plan intended `undefined` to trigger SDK auto-discovery.
- **Fix:** Used `undefined as unknown as FixedPriceFlow` cast with comment explaining the intent.
- **Files modified:** `apps/api/src/kv/client.ts`
- **Commit:** f932537

## Known Stubs

None — all functions are fully implemented with graceful degradation. KV unavailability returns null/false, not placeholder data.

## Test Results

```
Test Files  8 passed (8)
     Tests  48 passed (48)
```

All kv tests pass. TypeScript compilation clean for kv/* files.

## Self-Check: PASSED
