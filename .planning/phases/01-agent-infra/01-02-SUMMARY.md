---
phase: 01-agent-infra
plan: 02
subsystem: api
tags: [hono, bun, vercel-ai-sdk, 0g-compute, classifier, tool-calling, streaming, vitest, typescript]

# Dependency graph
requires:
  - 01-01 (providers.ts: glm5, deepseekV3; context.ts: assembleContext, UserContext, loadSystemPrompt; window.ts: applyWindow)
provides:
  - Intent classifier routing between GLM-5 and DeepSeek V3 (classifyIntent, selectModel)
  - get_balance stub tool returning hardcoded USDC balance (getBalanceTool)
  - runAgent orchestrator wiring classifier + context + window + streamText
  - POST /chat Hono route returning streaming SSE response
  - 33 passing unit tests (21 from plan 01 + 12 new)
affects: [02-tools-and-memory, 03-world-id-auth, all backend phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Classifier pattern: generateText with maxTokens=5, defaults to 'planning' on any failure (D-02)"
    - "Tool pattern: tool() with inputSchema (not parameters) per Vercel AI SDK v6 (Pitfall 2)"
    - "Agent pattern: runAgent() — classifyIntent -> selectModel -> assembleContext -> applyWindow -> streamText"
    - "Streaming pattern: toUIMessageStreamResponse() for Bun/Hono (not pipeDataStreamToResponse which is Node.js-only)"
    - "TDD pattern: RED (failing tests) -> GREEN (implementation) -> verify per task"
    - "stopWhen: stepCountIs(5) — AI SDK v6 canonical API (replaces deprecated maxSteps)"

key-files:
  created:
    - apps/api/src/agent/classifier.ts
    - apps/api/src/agent/classifier.test.ts
    - apps/api/src/agent/index.ts
    - apps/api/src/agent/index.test.ts
    - apps/api/src/tools/get-balance.ts
    - apps/api/src/tools/get-balance.test.ts
    - apps/api/src/routes/chat.ts
  modified:
    - apps/api/src/index.ts (added chatRoute mount)

key-decisions:
  - "Classifier uses DeepSeek V3 (not GLM-5) for classification — fast single-token response per D-01"
  - "Default to 'planning' on any classifier failure or gibberish response — D-02 safety-first routing"
  - "get_balance stub hardcodes 100.00 USDC — real on-chain lookup deferred to Phase 2"
  - "stopWhen: stepCountIs(5) used over deprecated maxSteps — AI SDK v6 canonical API"
  - "toUIMessageStreamResponse() over pipeDataStreamToResponse — Bun/Hono SSE compatibility"

requirements-completed: [AGEN-02, AGEN-03, AGEN-04]

# Metrics
duration: 2min
completed: 2026-04-04
---

# Phase 01 Plan 02: Agent Orchestrator and Chat Route Summary

**Intent classifier (GLM-5 vs DeepSeek V3 routing), get_balance stub tool, runAgent orchestrator wiring all Phase 1 modules via streamText with stopWhen, and POST /chat SSE endpoint — 33 tests passing**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-04T09:26:20Z
- **Completed:** 2026-04-04T09:28:26Z
- **Tasks:** 2
- **Files created:** 7
- **Files modified:** 1

## Accomplishments

- `classifyIntent()` routes planning/advisory messages to GLM-5, action/tool messages to DeepSeek V3, defaults to planning on failure (D-02)
- `selectModel()` returns appropriate LanguageModelV1 instance based on intent
- `getBalanceTool` uses `inputSchema` (not `parameters`) per Vercel AI SDK v6 requirement (Pitfall 2 from RESEARCH)
- `runAgent()` full orchestration: classifyIntent -> selectModel -> assembleContext -> applyWindow -> streamText with get_balance tool
- POST /chat returns streaming SSE via `toUIMessageStreamResponse()` (Bun/Hono compatible, not Node.js-only `pipeDataStreamToResponse`)
- All 33 tests pass across 6 test files (21 from plan 01 + 12 new)
- TDD flow followed: RED (failing imports) -> GREEN (implementation passes)

## Task Commits

1. **Task 1: classifier + get_balance stub with tests** - `58c07e6` (feat)
2. **Task 2: agent orchestrator + chat route + integration test** - `a2dd91e` (feat)

## Files Created/Modified

- `apps/api/src/agent/classifier.ts` — classifyIntent(userMessage): Intent, selectModel(intent): LanguageModelV1
- `apps/api/src/agent/classifier.test.ts` — 4 tests: planning, action, error fallback, gibberish fallback
- `apps/api/src/agent/index.ts` — runAgent(request: ChatRequest) orchestrator
- `apps/api/src/agent/index.test.ts` — 5 tests: classifyIntent call, selectModel call, assembleContext call, applyWindow call, streamText call
- `apps/api/src/tools/get-balance.ts` — getBalanceTool stub returning { balance: '100.00', currency: 'USDC', chain: 'World Chain' }
- `apps/api/src/tools/get-balance.test.ts` — 3 tests: description check, schema/execute check, execute() return value
- `apps/api/src/routes/chat.ts` — POST /chat route using toUIMessageStreamResponse()
- `apps/api/src/index.ts` — added chatRoute mount (app.route('/', chatRoute))

## Decisions Made

- Classifier uses DeepSeek V3 for fast single-token classification per D-01 (not GLM-5)
- Gibberish/unexpected classifier output defaults to 'planning' per D-02 (if text.trim().toLowerCase() !== 'action', return 'planning')
- get_balance stub hardcodes 100.00 USDC — real balance lookup deferred to Phase 2 (on-chain via World Chain)
- stopWhen: stepCountIs(5) is the AI SDK v6 canonical API; maxSteps is deprecated and was not used
- toUIMessageStreamResponse() is the correct SSE method for Bun/Hono (pipeDataStreamToResponse is Node.js-specific and crashes on Bun)

## Deviations from Plan

None — plan executed exactly as written. All implementation matched plan specifications including:
- inputSchema vs parameters pitfall (correctly used inputSchema)
- toUIMessageStreamResponse vs pipeDataStreamToResponse (correctly used toUIMessageStreamResponse)
- stopWhen: stepCountIs(5) vs maxSteps (correctly used stopWhen)
- Default-to-planning classifier behavior (correctly implemented)

## Known Stubs

- `apps/api/src/tools/get-balance.ts` — `getBalanceTool.execute()` returns hardcoded `{ balance: '100.00', currency: 'USDC', chain: 'World Chain' }`. This is intentional per D-13. Real on-chain balance lookup from World Chain is scoped to Phase 2 (tools-and-memory).

- `apps/api/src/agent/index.ts` (lines 47-51) — `stubUserContext` uses hardcoded wallet address `0x0000000000000000000000000000000000000000`, displayName `'User'`, and autoApproveUsd `25`. Real user context loaded from 0G Storage KV is scoped to Phase 2.

## Self-Check: PASSED

- apps/api/src/agent/classifier.ts: FOUND
- apps/api/src/agent/classifier.test.ts: FOUND
- apps/api/src/agent/index.ts: FOUND
- apps/api/src/agent/index.test.ts: FOUND
- apps/api/src/tools/get-balance.ts: FOUND
- apps/api/src/tools/get-balance.test.ts: FOUND
- apps/api/src/routes/chat.ts: FOUND
- Commit 58c07e6: FOUND
- Commit a2dd91e: FOUND
- All 33 tests passing: CONFIRMED

---
*Phase: 01-agent-infra*
*Completed: 2026-04-04*
