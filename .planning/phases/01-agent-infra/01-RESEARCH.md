# Phase 1: Agent Infra - Research

**Researched:** 2026-04-04
**Domain:** AI agent loop — Vercel AI SDK + Hono + Bun + 0G Compute Network
**Confidence:** MEDIUM-HIGH (0G Compute direct API HIGH; 0G local proxy adapter details LOW; Vercel AI SDK + Hono HIGH)

## Summary

Phase 1 builds the entire AI agent runtime in `apps/api` — inference routing through 0G Compute Network, dual-model selection (GLM-5 for planning, DeepSeek V3 for tool execution), streaming tool calls via Vercel AI SDK, three-layer context assembly, and a bounded sliding window for conversation history.

The 0G Compute Network exposes an OpenAI-compatible API at `https://compute-network-1.integratenetwork.work/v1/proxy`. The `@0glabs/0g-serving-broker` SDK handles wallet-based authentication and per-request billing headers. Vercel AI SDK v6 (`ai@6.x`) with `@ai-sdk/openai@3.x` is the standard for streaming tool calls in Hono — use `result.toUIMessageStreamResponse()` on the Hono route. The key complexity is: (a) the 0G authentication flow requires per-request headers from the broker SDK and (b) the local `0g-compute-cli inference serve` proxy has limited documentation — the hosted endpoint at `compute-network-1.integratenetwork.work` is the reliable path.

**Primary recommendation:** Point `@ai-sdk/openai`'s `createOpenAI` at the hosted 0G endpoint (not localhost) for dev/staging and prod alike. Use the `@0glabs/0g-serving-broker` SDK to generate per-request auth headers, injected via a custom `fetch` wrapper. Wire two pre-configured provider instances (one for GLM-5, one for DeepSeek V3) and pick between them with a lightweight classifier call before each user message.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Model Routing Strategy**
- D-01: Small LLM classifier prompt (via DeepSeek V3 through 0G Compute) examines each user message and routes: planning/advisory prompts to GLM-5, action/tool-execution prompts to DeepSeek V3
- D-02: Default to GLM-5 when classifier is unsure or message is ambiguous
- D-03: Single model per request — no multi-step chaining between models within one user message
- D-04: All inference (including the classifier call) goes through 0G Compute Adapter — no direct cloud LLM APIs
- D-05: Both models stream responses
- D-06: Model routing is hidden from the user — Genie appears as a single assistant

**0G Compute Adapter Integration**
- D-07: Use Vercel AI SDK's OpenAI provider with baseURL pointed at the hosted 0G Compute Adapter URL — OpenAI-compatible API
- D-08: 0G Compute Adapter needs to be hosted somewhere accessible from Vercel (not just localhost) — research hosting options during planning (VPS, Railway, Fly.io, etc.)
- D-09: Adapter URL configured via `OG_COMPUTE_URL` environment variable — localhost:8000 in dev, hosted URL in production
- D-10: On failure: retry 2-3 times with backoff, then return a clear error to the user

**Tool Registration Design**
- D-11: One file per tool in a `tools/` directory — e.g., `get-balance.ts`, `send-usdc.ts`
- D-12: Use Vercel AI SDK's native `tool()` format with Zod schemas — no custom wrappers
- D-13: Phase 1 registers only `get_balance` as a stub tool (returns hardcoded USDC balance) to prove the loop works
- D-14: Extensive error handling with verbose server-side logging (full request/response details, API call traces) for easy debugging. Errors are also returned to the model as tool results so it can explain them naturally to the user.

**Context and Sliding Window**
- D-15: System prompt lives in a template file (`.txt` or `.md`) loaded and interpolated with user data at runtime
- D-16: 40-message sliding window for conversation history
- D-17: Sticky messages (never dropped): tool results containing balances/tx confirmations, user confirmation messages ("yes, send it" / "no, cancel"), and system/context layer messages
- D-18: Dropped messages are simply discarded — no async summarization (keep it simple for hackathon)

### Claude's Discretion
- Exact classifier prompt wording and format
- File naming conventions within `tools/` directory
- Template interpolation approach for system prompt
- Retry backoff strategy specifics (exponential, fixed, etc.)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGEN-01 | 0G Compute Adapter routes inference to decentralized GPU network | 0G Compute Network broker SDK + createOpenAI with custom baseURL |
| AGEN-02 | GLM-5 handles financial planning and advisory responses | Model ID: `zai-org/GLM-5-FP8` on 0G; createOpenAI instance with GLM-5 |
| AGEN-03 | DeepSeek V3 handles fast tool execution (send, balance, resolve) | Model ID: `deepseek-chat-v3-0324` on 0G; classifier routes to this model |
| AGEN-04 | Vercel AI SDK agent loop with tool calling and streaming responses | streamText + maxSteps + tool() + toUIMessageStreamResponse() |
| AGEN-05 | Three-layer context: system prompt + user context + conversation history | messages array: system string + user context injected into first message or system prompt, history as CoreMessage[] |
| AGEN-06 | Sliding window with sticky messages keeps context bounded | Custom applyWindow() — filter oldest non-sticky messages when count > 40 |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- **Runtime:** Hono + Bun for `apps/api` — not Node.js/Express
- **AI inference:** All LLM calls through 0G Compute Adapter — `OG_COMPUTE_URL` env var — no direct Anthropic/OpenAI/Groq APIs
- **Models:** GLM-5 (planning/advisory) + DeepSeek V3 (tool execution) only
- **Agent memory:** 0G Storage KV API for persistence — out of scope for Phase 1 (AGEN-07 is Phase 2)
- **Package manager:** pnpm — not npm or yarn
- **Monorepo:** Turborepo — `apps/api` is the target package for all Phase 1 code
- **No pre-built code:** All code written during hackathon — reference codebase is reference only

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `ai` (Vercel AI SDK) | 6.0.146 | streamText, tool(), agent loop, streaming response | Official SDK with Hono integration, streaming SSE, multi-step tool calling |
| `@ai-sdk/openai` | 3.0.50 | createOpenAI with custom baseURL for 0G endpoint | OpenAI-compatible adapter, supports arbitrary baseURL override |
| `hono` | 4.12.10 | HTTP server, routing, middleware | Project-mandated; native Bun support, tiny footprint |
| `zod` | 3.24.6 | Tool input schemas | Required by Vercel AI SDK tool() definition |
| `@0glabs/0g-serving-broker` | 0.7.4 | Wallet-based auth headers for 0G Compute API | Official 0G SDK — generates per-request billing headers |
| `ethers` | 6.x | ethers.Wallet + JsonRpcProvider for 0G broker init | Required peer dep for @0glabs/0g-serving-broker |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@hono/node-server` | 1.19.12 | Node-compatible serve wrapper | Dev only if Bun not installed on dev machine; prod uses Bun directly |
| `vitest` | latest | Unit tests for agent logic, tool stubs, window logic | Testing all pure functions; no live API calls in unit tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @ai-sdk/openai + custom baseURL | Raw fetch to 0G API | SDK provides streaming, tool call parsing, type safety — don't hand-roll |
| @0glabs/0g-serving-broker | Static API key only | Broker handles on-chain billing; static key only works for direct API access mode |
| streamText | generateText | generateText does not stream — D-05 requires streaming responses |

**Installation:**
```bash
pnpm add ai @ai-sdk/openai hono zod @0glabs/0g-serving-broker ethers
pnpm add -D vitest @types/node
```

**Version verification (confirmed 2026-04-04):**
- `ai`: 6.0.146
- `@ai-sdk/openai`: 3.0.50
- `hono`: 4.12.10
- `zod`: 3.24.6
- `@0glabs/0g-serving-broker`: 0.7.4 (latest)

---

## Architecture Patterns

### Recommended Project Structure
```
apps/api/
├── src/
│   ├── index.ts              # Hono app + Bun serve entry point
│   ├── routes/
│   │   └── chat.ts           # POST /chat — streaming agent endpoint
│   ├── agent/
│   │   ├── index.ts          # runAgent() — main orchestrator
│   │   ├── classifier.ts     # classifyIntent() — picks GLM-5 or DeepSeek V3
│   │   ├── context.ts        # assembleContext() — three-layer assembly
│   │   ├── window.ts         # applyWindow() — sliding window + sticky messages
│   │   └── providers.ts      # createOGProvider() — 0G Compute instances
│   ├── tools/
│   │   └── get-balance.ts    # stub tool — Phase 1 only
│   └── prompts/
│       └── system.md         # System prompt template
├── package.json
└── tsconfig.json
```

### Pattern 1: 0G Compute Provider Setup
**What:** Two `createOpenAI` instances sharing the same baseURL but different model IDs. Auth headers injected via custom fetch wrapper using `@0glabs/0g-serving-broker`.
**When to use:** All inference calls — classifier, GLM-5 planning, DeepSeek V3 tool execution.

```typescript
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/openai + https://0g.ai/blog/glm-5-live-on-0g-compute
import { createOpenAI } from '@ai-sdk/openai';

const OG_BASE_URL = process.env.OG_COMPUTE_URL ?? 'http://localhost:8000';
const OG_API_KEY = process.env.OG_API_KEY ?? 'app-sk-placeholder';

// Two provider instances — one per model
export const glm5Provider = createOpenAI({
  baseURL: `${OG_BASE_URL}/v1/proxy`,
  apiKey: OG_API_KEY,
});

export const deepseekProvider = createOpenAI({
  baseURL: `${OG_BASE_URL}/v1/proxy`,
  apiKey: OG_API_KEY,
});

// Model instances
export const glm5 = glm5Provider('zai-org/GLM-5-FP8');
export const deepseekV3 = deepseekProvider('deepseek-chat-v3-0324');
```

**0G Broker auth integration (if using wallet-based billing):**
```typescript
// Source: https://github.com/0gfoundation/0g-serving-user-broker
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL);
const wallet = new ethers.Wallet(process.env.OG_PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);
const headers = await broker.inference.getRequestHeaders(providerAddress);
// headers are injected per-request — single use only, cannot be reused
```

**Note:** For hackathon speed, the static API key path (`app-sk-...`) via the marketplace is viable. The broker SDK path is needed for on-chain settlement proofs.

### Pattern 2: Hono Streaming Chat Endpoint
**What:** POST /chat that returns Server-Sent Events from `streamText`.
**When to use:** Every user message.

```typescript
// Source: https://ai-sdk.dev/cookbook/api-servers/hono
import { Hono } from 'hono';
import { streamText } from 'ai';
import { glm5, deepseekV3 } from '../agent/providers';
import { getBalanceTool } from '../tools/get-balance';

const app = new Hono();

app.post('/chat', async (c) => {
  const { messages, userId } = await c.req.json();

  const model = await classifyAndRoute(messages.at(-1).content);
  const context = assembleContext(userId, messages);
  const windowed = applyWindow(context, 40);

  const result = streamText({
    model,
    messages: windowed,
    tools: { get_balance: getBalanceTool },
    maxSteps: 5,
    onStepFinish: ({ toolResults }) => {
      console.log('[agent] step finished', JSON.stringify(toolResults, null, 2));
    },
  });

  return result.toUIMessageStreamResponse();
});

export default { port: 3000, fetch: app.fetch };
```

**Critical:** `toUIMessageStreamResponse()` is the correct method for Hono (not `pipeDataStreamToResponse` which is Node.js-specific). Confirmed via GitHub issue #7045 — earlier `toUIMessageStream()` piped directly had serialization bugs; `toUIMessageStreamResponse()` returns a standard `Response` object Hono can return directly.

### Pattern 3: Tool Definition (Vercel AI SDK native)
**What:** One file per tool with `tool()` + Zod schema. Tool receives AgentContext via closure.
**When to use:** All Phase 1+ tool implementations.

```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
import { tool } from 'ai';
import { z } from 'zod';
import type { AgentContext } from '../agent/context';

export function getBalanceTool(ctx: AgentContext) {
  return tool({
    description: 'Get the user\'s current USDC balance on World Chain.',
    inputSchema: z.object({}),
    execute: async () => {
      try {
        // Phase 1: stub — return hardcoded value
        return { balance: '100.00', currency: 'USDC', chain: 'World Chain' };
      } catch (err) {
        // Errors returned as tool result so model can explain naturally (D-14)
        return { error: 'FETCH_FAILED', message: 'Could not retrieve balance at this time.' };
      }
    },
  });
}
```

### Pattern 4: Three-Layer Context Assembly
**What:** Assembles `messages` array with system prompt, injected user context, then conversation history.
**When to use:** Every request before calling `streamText`.

```typescript
// Three layers:
// 1. system: string (system prompt template interpolated with user data)
// 2. First user message or a context injection message (user context layer)
// 3. Remaining conversation history

export function assembleContext(
  systemPrompt: string,  // loaded from prompts/system.md
  userContext: UserContext,  // wallet address, display name, auto-approve threshold
  history: CoreMessage[],
  userMessage: string,
): { system: string; messages: CoreMessage[] } {
  const contextInjection = `[User context: wallet=${userContext.walletAddress}, name=${userContext.displayName}, threshold=$${userContext.autoApproveUsd}]`;

  return {
    system: systemPrompt,
    messages: [
      { role: 'user', content: contextInjection },
      { role: 'assistant', content: 'Understood. I have your account context.' },
      ...history,
      { role: 'user', content: userMessage },
    ],
  };
}
```

### Pattern 5: Sliding Window with Sticky Messages
**What:** Enforces 40-message cap by dropping oldest non-sticky messages first.
**When to use:** After assembleContext, before streamText.

```typescript
// Sticky predicate — never drop these
function isSticky(msg: CoreMessage): boolean {
  if (msg.role === 'tool') return true; // tool results: balances, tx confirmations
  if (typeof msg.content === 'string') {
    const lower = msg.content.toLowerCase();
    return lower.includes('yes, send') || lower.includes('no, cancel');
  }
  return false;
}

export function applyWindow(messages: CoreMessage[], limit: number): CoreMessage[] {
  if (messages.length <= limit) return messages;

  // Build index of non-sticky messages (oldest first)
  const droppable = messages
    .map((m, i) => ({ msg: m, idx: i }))
    .filter(({ msg }) => !isSticky(msg));

  const excess = messages.length - limit;
  const toDrop = new Set(droppable.slice(0, excess).map(({ idx }) => idx));

  return messages.filter((_, i) => !toDrop.has(i));
}
```

### Pattern 6: Classifier for Model Routing
**What:** Small generateText call that returns "planning" or "action" to drive model selection.
**When to use:** Before every user message, using DeepSeek V3 (fast + cheap) for the classification.

```typescript
import { generateText } from 'ai';
import { deepseekV3 } from './providers';

export type Intent = 'planning' | 'action';

export async function classifyIntent(userMessage: string): Promise<Intent> {
  try {
    const { text } = await generateText({
      model: deepseekV3,
      system: `You are a router. Classify the user's message as either "planning" (financial advice, summaries, goals, questions) or "action" (send money, check balance, resolve contacts, execute transfers). Respond with exactly one word: planning or action.`,
      prompt: userMessage,
      maxOutputTokens: 5,
    });
    const label = text.trim().toLowerCase();
    return label === 'action' ? 'action' : 'planning'; // default to planning (D-02)
  } catch {
    return 'planning'; // default on failure (D-02)
  }
}
```

### Anti-Patterns to Avoid
- **Calling 0G APIs without per-request headers:** The broker SDK generates single-use headers — do not cache or reuse them across requests.
- **Using `pipeDataStreamToResponse()` in Hono:** This is Node.js `ServerResponse`-specific and crashes in Bun/Hono. Use `result.toUIMessageStreamResponse()` only.
- **Storing conversation history server-side in Phase 1:** Phase 1 is stateless — client sends full history. AGEN-07 (0G KV persistence) is Phase 2.
- **Using `generateText` for the main response:** D-05 requires streaming. Only the classifier uses `generateText`.
- **Chaining GLM-5 then DeepSeek V3 in one request:** D-03 explicitly prohibits multi-model chaining per message.
- **Using `parameters` key in tool():** Vercel AI SDK v6 renamed `parameters` to `inputSchema`. Using `parameters` silently fails.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming LLM responses to HTTP | Custom SSE loop | `streamText().toUIMessageStreamResponse()` | Handles chunking, connection keepalive, error propagation, tool call serialization |
| Tool input validation | Manual JSON schema parsing | `tool()` with Zod `inputSchema` | SDK validates input and provides type-safe execute() params automatically |
| Multi-step tool calling loop | Manual while loop polling model | `maxSteps` in `streamText` | SDK handles tool result injection, loop termination, step callbacks |
| OpenAI-compatible client | Raw fetch with manual headers | `createOpenAI` from `@ai-sdk/openai` | Handles auth, retries, streaming parse, type safety |
| Request retry with backoff | Custom retry logic | `p-retry` or simple for-loop with delay | Edge cases in exponential backoff are subtle; use a tiny utility |

**Key insight:** The Vercel AI SDK's `streamText` with `maxSteps` replaces an entire agent loop implementation. The tool call → result injection → continue pattern is handled automatically.

---

## 0G Compute Adapter Hosting (D-08)

**The problem:** CONTEXT.md D-09 sets `OG_COMPUTE_URL=localhost:8000` in dev. But the 0G Compute CLI's `inference serve` proxy runs on port 3000 by default (not 8000) — and must be running locally.

**Recommended approach for dev:** Do not depend on a local CLI proxy. Point directly at the hosted 0G endpoint:
```
OG_COMPUTE_URL=https://compute-network-1.integratenetwork.work
```
This is always available and avoids local process management during a 36-hour hackathon.

**Deployment options for Vercel prod (D-08 requirement):**
| Option | Setup time | Cost | Verdict |
|--------|-----------|------|---------|
| Use 0G hosted endpoint directly | 0 min | 0G tokens per inference | **Recommended** — already OpenAI-compatible, no extra infra |
| Fly.io proxy | ~30 min | ~$0.01/hr | Viable if middleware layer needed |
| Railway | ~20 min | Free tier | Viable for demo only |
| VPS (DigitalOcean, Hetzner) | ~60 min | ~$5/mo | Overkill for hackathon |

**Conclusion:** The "0G Compute Adapter at localhost:8000" in CONTEXT.md D-09 refers to routing ALL calls through an env-configurable URL — the `OG_COMPUTE_URL` variable. The simplest implementation points this directly at the 0G hosted endpoint, avoiding any local/hosted proxy. The planner should set `OG_COMPUTE_URL` default to the 0G hosted URL, not localhost.

---

## Common Pitfalls

### Pitfall 1: Per-Request Headers from 0G Broker
**What goes wrong:** 0G broker `getRequestHeaders()` generates single-use billing proofs. Caching them causes subsequent requests to fail with auth/billing errors.
**Why it happens:** Each header encodes an on-chain payment nonce for settlement.
**How to avoid:** Call `getRequestHeaders()` inside the fetch wrapper, not at initialization time.
**Warning signs:** First request succeeds, all subsequent requests fail with 401 or billing errors.

### Pitfall 2: Vercel AI SDK v6 Tool API Changes
**What goes wrong:** Older examples use `parameters: z.object({})` — SDK v6 uses `inputSchema: z.object({})`. Using `parameters` silently causes tools not to be registered.
**Why it happens:** SDK v6 renamed the field. The old field is ignored without error in some versions.
**How to avoid:** Always use `inputSchema` in `tool()`. Reference: ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling.
**Warning signs:** Model responds normally but never calls any tool.

### Pitfall 3: Bun Streaming Compatibility
**What goes wrong:** `pipeDataStreamToResponse()` expects a Node.js `ServerResponse` object. Hono on Bun provides a Web API `Response`. Calling it crashes the route.
**Why it happens:** Hono uses the WHATWG Fetch `Response` spec, not Node.js http.ServerResponse.
**How to avoid:** Always use `result.toUIMessageStreamResponse()` which returns a standard `Response` object.
**Warning signs:** Route throws `TypeError: response.write is not a function`.

### Pitfall 4: 0G Model Name Mismatch
**What goes wrong:** Using model names like `glm-5` or `deepseek-v3` returns a 404 from the 0G endpoint.
**Why it happens:** 0G uses provider-qualified model IDs.
**How to avoid:** Use exact IDs: `zai-org/GLM-5-FP8` and `deepseek-chat-v3-0324`.
**Warning signs:** 404 or "model not found" error from 0G API.

### Pitfall 5: Classifier Adds Latency
**What goes wrong:** Every user message requires an extra LLM round-trip for classification before the main response starts.
**Why it happens:** D-01 specifies a classifier call.
**How to avoid:** Use `generateText` (not `streamText`) for the classifier with `maxOutputTokens: 5` — DeepSeek V3 returns in <500ms. Do not await the classifier's full streaming; use `generateText` which resolves to a single token.
**Warning signs:** Perceived response time doubles.

### Pitfall 6: Turbo/pnpm Workspace Not Configured
**What goes wrong:** `pnpm add` in `apps/api` installs to the root if workspace config is missing. Bun scripts fail if `"bun"` is not set as the runtime in turbo.json.
**Why it happens:** Turborepo requires explicit workspace configuration for per-app runtimes.
**How to avoid:** Set `apps/api/package.json` `"scripts": { "dev": "bun run src/index.ts" }` and configure turbo.json pipeline to run `dev` in `apps/api`. Use `pnpm --filter @genie/api add <pkg>` to install into the right workspace.

---

## Code Examples

### Minimal Hono + Bun Entry Point
```typescript
// Source: https://hono.dev/docs/getting-started/bun
import { Hono } from 'hono';

const app = new Hono();
app.get('/health', (c) => c.json({ status: 'ok' }));

export default {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
  fetch: app.fetch,
};
```

### streamText with Tool Call (Hono route)
```typescript
// Source: https://ai-sdk.dev/cookbook/api-servers/hono
import { streamText } from 'ai';

app.post('/chat', async (c) => {
  const { messages } = await c.req.json();
  const result = streamText({
    model: glm5,
    system: systemPrompt,
    messages,
    tools: { get_balance: getBalanceTool(ctx) },
    maxSteps: 5,
  });
  return result.toUIMessageStreamResponse();
});
```

### 0G Compute createOpenAI Setup
```typescript
// Source: https://ai-sdk.dev/providers/ai-sdk-providers/openai
import { createOpenAI } from '@ai-sdk/openai';

const og = createOpenAI({
  baseURL: `${process.env.OG_COMPUTE_URL}/v1/proxy`,
  apiKey: process.env.OG_API_KEY,
});

export const glm5 = og('zai-org/GLM-5-FP8');
export const deepseekV3 = og('deepseek-chat-v3-0324');
```

### tool() Pattern (v6 correct API)
```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
import { tool } from 'ai';
import { z } from 'zod';

export const getBalanceTool = tool({
  description: 'Get USDC balance',
  inputSchema: z.object({}),  // NOTE: inputSchema not parameters
  execute: async () => ({ balance: '100.00', currency: 'USDC' }),
});
```

### Error Handling in streamText
```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-core/error-handling
const { fullStream } = streamText({ model, messages, tools });

for await (const part of fullStream) {
  if (part.type === 'error') {
    console.error('[agent] stream error:', part.error);
  }
  if (part.type === 'tool-error') {
    console.error('[agent] tool error:', part.error);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `parameters` in tool() | `inputSchema` in tool() | AI SDK v4 → v6 | Old examples on Stack Overflow are wrong |
| `maxSteps` parameter | `stopWhen: stepCountIs(N)` | AI SDK v4 → v6 | `maxSteps` may still work but `stopWhen` is canonical |
| `toDataStreamResponse()` | `toUIMessageStreamResponse()` | AI SDK v5 → v6 | v6 UI message stream is the new standard for chat |
| Direct OpenAI SDK | Vercel AI SDK wrappers | 2024+ | SDK handles streaming, tools, multi-step automatically |

**Deprecated/outdated:**
- `maxSteps` numeric parameter: Replaced by `stopWhen: stepCountIs(N)` in AI SDK v6, though `maxSteps` may still be accepted. Use `stopWhen` per current docs.
- `@ai-sdk/anthropic` directly: Not used in this project — all inference through `@ai-sdk/openai` with custom `baseURL`.

---

## Open Questions

1. **0G Compute Adapter vs. Direct 0G API**
   - What we know: CONTEXT.md D-09 references `localhost:8000`. The 0G CLI `inference serve` proxy runs on port 3000 by default.
   - What's unclear: Does the project intend a custom proxy process, or just configurable URL pointing to hosted 0G? The reference codebase had no 0G integration at all.
   - Recommendation: Assume `OG_COMPUTE_URL` points directly at `https://compute-network-1.integratenetwork.work`. The "Adapter" is the env-configurable URL abstraction, not a running process. Planner should document this assumption explicitly.

2. **0G Auth: Static API Key vs. Broker SDK**
   - What we know: Two auth modes exist — static `app-sk-...` key via marketplace, and wallet-based per-request headers via `@0glabs/0g-serving-broker`.
   - What's unclear: Which mode is required for the 0G prize track (OpenClaw Agent)? On-chain settlement may be required for prize eligibility.
   - Recommendation: Start with static API key for Phase 1 speed. Add broker SDK in a follow-up or Phase 1 Wave 2. Flag for team decision.

3. **Bun test runner vs. Vitest**
   - What we know: Reference codebase used Vitest. Bun has built-in test runner (`bun test`).
   - What's unclear: Turborepo + Bun + Vitest compatibility vs. native `bun test`.
   - Recommendation: Use Vitest — it integrates with Turborepo's `test` pipeline and has better TypeScript support for monorepos.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | pnpm, Turborepo tooling | ✓ | v24.10.0 | — |
| pnpm | Monorepo package management | ✓ | 9.15.0 | — |
| Bun | apps/api runtime | ✗ | — | Install: `curl -fsSL https://bun.sh/install \| bash` |
| 0G Compute (localhost:8000) | AI inference in dev | ✗ | — | Use hosted endpoint directly |
| 0G Compute (hosted) | AI inference | Unknown | — | Requires `OG_API_KEY` env var |
| Turbo | Monorepo build/dev | ✓ (via npx) | 2.9.3 | `pnpm add -D turbo` |

**Missing dependencies with no fallback:**
- `bun` — required for running `apps/api` as the project-mandated runtime. Must install before Phase 1 dev starts.
- `OG_API_KEY` and `OG_COMPUTE_URL` — credentials must be provisioned (project states 0G wallet is funded).

**Missing dependencies with fallback:**
- Local 0G proxy at localhost:8000 — fallback is pointing `OG_COMPUTE_URL` at hosted endpoint directly.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (latest) |
| Config file | `apps/api/vitest.config.ts` — Wave 0 gap |
| Quick run command | `pnpm --filter @genie/api test` |
| Full suite command | `pnpm --filter @genie/api test --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGEN-01 | createOpenAI with OG_COMPUTE_URL baseURL initializes correctly | unit | `vitest run src/agent/providers.test.ts` | ❌ Wave 0 |
| AGEN-02 | classifyIntent returns 'planning' for advisory messages, routes to GLM-5 | unit | `vitest run src/agent/classifier.test.ts` | ❌ Wave 0 |
| AGEN-03 | classifyIntent returns 'action' for tool-execution messages, routes to DeepSeek V3 | unit | `vitest run src/agent/classifier.test.ts` | ❌ Wave 0 |
| AGEN-04 | getBalanceTool returns stub result and is callable | unit | `vitest run src/tools/get-balance.test.ts` | ❌ Wave 0 |
| AGEN-05 | assembleContext produces correct message order (system + context + history + user) | unit | `vitest run src/agent/context.test.ts` | ❌ Wave 0 |
| AGEN-06 | applyWindow drops oldest non-sticky, preserves sticky across 40-message boundary | unit | `vitest run src/agent/window.test.ts` | ❌ Wave 0 |

All tests are unit tests against pure functions. No live API calls in the test suite — use mocked `streamText` / `generateText` from `ai/test` (Vercel AI SDK provides test utilities).

### Sampling Rate
- **Per task commit:** `pnpm --filter @genie/api test --run`
- **Per wave merge:** `pnpm --filter @genie/api test --run` (same — all unit tests)
- **Phase gate:** Full suite green + manual smoke test (curl to `/chat` endpoint with a real 0G key)

### Wave 0 Gaps
- [ ] `apps/api/vitest.config.ts` — Vitest config for the api package
- [ ] `apps/api/src/agent/providers.test.ts` — AGEN-01 provider initialization
- [ ] `apps/api/src/agent/classifier.test.ts` — AGEN-02, AGEN-03 routing logic
- [ ] `apps/api/src/tools/get-balance.test.ts` — AGEN-04 stub tool
- [ ] `apps/api/src/agent/context.test.ts` — AGEN-05 three-layer assembly
- [ ] `apps/api/src/agent/window.test.ts` — AGEN-06 sliding window + sticky messages
- [ ] `apps/api/package.json` with test script — required for Turborepo pipeline

---

## Sources

### Primary (HIGH confidence)
- [ai-sdk.dev/cookbook/api-servers/hono](https://ai-sdk.dev/cookbook/api-servers/hono) — Official Hono + Vercel AI SDK example
- [ai-sdk.dev/providers/ai-sdk-providers/openai](https://ai-sdk.dev/providers/ai-sdk-providers/openai) — createOpenAI with custom baseURL
- [ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) — tool() API, inputSchema
- [ai-sdk.dev/docs/reference/ai-sdk-core/stream-text](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) — streamText parameters
- [0g.ai/blog/glm-5-live-on-0g-compute](https://0g.ai/blog/glm-5-live-on-0g-compute) — GLM-5 model ID, endpoint URL, auth
- [docs.0g.ai/developer-hub/building-on-0g/compute-network/inference](https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference) — 0G inference API docs
- [hono.dev/docs/getting-started/bun](https://hono.dev/docs/getting-started/bun) — Hono + Bun setup
- npm registry — confirmed versions for ai, @ai-sdk/openai, hono, zod, @0glabs/0g-serving-broker

### Secondary (MEDIUM confidence)
- [github.com/0gfoundation/0g-serving-user-broker](https://github.com/0gfoundation/0g-serving-user-broker) — broker SDK README, initialization pattern
- [github.com/vercel/ai/issues/7045](https://github.com/vercel/ai/issues/7045) — toUIMessageStreamResponse() fix for Hono
- Reference codebase (`.reference/repomix-reference.xml`) — prior agent patterns (tool() closure, AgentContext, generateText + maxSteps, Hono router structure)

### Tertiary (LOW confidence)
- WebSearch: 0G Compute hosted endpoint URL `compute-network-1.integratenetwork.work` — confirmed by two sources but URL format should be verified at runtime

---

## Metadata

**Confidence breakdown:**
- Standard stack (Vercel AI SDK, Hono, Zod): HIGH — official docs verified, versions confirmed from npm
- 0G Compute integration (direct API): MEDIUM-HIGH — official docs found, model names confirmed, auth patterns documented
- 0G broker SDK wallet-based flow: MEDIUM — SDK docs found but not deeply verified for hackathon use case
- Architecture patterns: HIGH — based on official SDK examples + reference codebase patterns
- Pitfalls: HIGH — directly from GitHub issues and official changelogs

**Research date:** 2026-04-04
**Valid until:** 2026-04-11 (7 days — 0G API is actively evolving)
