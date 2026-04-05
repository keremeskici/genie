---
status: complete
phase: 01-agent-infra
source: [01-01-SUMMARY.md, 01-02-SUMMARY.md]
started: 2026-04-04T10:00:00Z
updated: 2026-04-04T12:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Run `pnpm --filter @genie/api dev` from the repo root. Server boots without errors and `curl http://localhost:3001/health` returns `{"status":"ok","service":"genie-api"}`.
result: pass

### 2. Unit Test Suite
expected: Run `pnpm --filter @genie/api test` from repo root. All 33 tests pass across 6 test files (providers, context, window, classifier, get-balance, agent index). Exit code 0.
result: pass

### 3. Chat Endpoint Streaming
expected: With server running, send `curl -X POST http://localhost:3001/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"What is my balance?"}]}'`. Server returns a streaming SSE response (chunked transfer). You should see streaming text data arriving. The response should include the get_balance tool result (100.00 USDC).
result: pass

### 4. Dual-Model Routing (Server Logs)
expected: Send a planning prompt like "Help me plan my savings" and an action prompt like "Send $10 to Alice". Check server console logs — planning prompt should log `qwen-2.5-7b-instruct` (testnet uses same model for both roles; on mainnet this would be `glm-5-fp8` vs `deepseek-chat-v3-0324`). Both requests should show the classifier routing in logs: `[agent] classified intent: planning` vs `[agent] classified intent: action`.
result: pass

## Summary

total: 4
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
