# Phase 1: Agent Infra - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 01-agent-infra
**Areas discussed:** Model routing strategy, 0G Adapter integration, Tool registration design, Context & sliding window

---

## Model Routing Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Intent classifier first | Lightweight classification step routes: planning → GLM-5, action → DeepSeek V3 | ✓ |
| Always GLM-5 first | GLM-5 handles initial response, delegates tool calls to DeepSeek V3 | |
| Endpoint-based split | Two separate endpoints, frontend/agent decides which to call | |

**User's choice:** Intent classifier first
**Notes:** None

### Classifier Implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Keyword/regex rules | Fast pattern matching on financial keywords | |
| Small LLM prompt | Send to DeepSeek V3 for classify prompt returning model choice | ✓ |

**User's choice:** Small LLM prompt
**Notes:** None

### Fallback on Ambiguity

| Option | Description | Selected |
|--------|-------------|----------|
| Default to GLM-5 | Planning model handles ambiguity | ✓ |
| Default to DeepSeek V3 | Action model handles ambiguity | |

**User's choice:** Default to GLM-5
**Notes:** None

### Multi-step Model Chaining

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, chain models | GLM-5 plans then DeepSeek V3 executes in one request | |
| No, single model per request | One model handles entire request | ✓ |

**User's choice:** No, single model per request
**Notes:** None

### Classifier Inference Route

| Option | Description | Selected |
|--------|-------------|----------|
| Through 0G Compute | All inference goes through 0G | ✓ |
| Local/direct fallback OK | Classifier can use direct API | |

**User's choice:** Through 0G Compute
**Notes:** None

### Streaming Support

| Option | Description | Selected |
|--------|-------------|----------|
| Both models stream | GLM-5 and DeepSeek V3 both stream | ✓ |
| Only response model | Classifier non-streaming, only main response streams | |

**User's choice:** Both models stream
**Notes:** None

### Routing Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden from user | User sees one "Genie" assistant | ✓ |
| Subtle indicator | Show tags like "Planning..." or "Acting..." | |

**User's choice:** Hidden from user
**Notes:** None

---

## 0G Adapter Integration

### Communication Approach

| Option | Description | Selected |
|--------|-------------|----------|
| OpenAI SDK compatible | Use Vercel AI SDK's OpenAI provider pointed at 0G Adapter | ✓ |
| Custom HTTP client | Build thin wrapper around fetch() | |

**User's choice:** OpenAI SDK + Vercel AI SDK (via Other)
**Notes:** User emphasized that 0G Compute Adapter needs to be hosted somewhere accessible from Vercel, not just localhost. Needs assistance figuring out hosting during planning.

### Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Fail with clear error | Show friendly error, no fallback | |
| Retry then fail | Retry 2-3 times with backoff, then show error | ✓ |

**User's choice:** Retry then fail
**Notes:** None

### URL Configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Env variable | OG_COMPUTE_URL env var, localhost in dev, hosted URL in prod | ✓ |
| Hardcoded localhost | Simpler but needs code change to deploy | |

**User's choice:** Env variable
**Notes:** None

---

## Tool Registration Design

### Code Organization

| Option | Description | Selected |
|--------|-------------|----------|
| One file per tool | Separate files in src/tools/ | ✓ |
| Grouped by domain | Files by domain: financial-tools.ts, etc. | |
| Single tools file | All tools in one file | |

**User's choice:** One file per tool
**Notes:** None

### Phase 1 Stub Tools

| Option | Description | Selected |
|--------|-------------|----------|
| get_balance only | Minimal — one tool proves the loop | ✓ |
| get_balance + send_usdc | Two tools — proves read and write patterns | |
| Full set of stubs | All planned tools as stubs | |

**User's choice:** get_balance only
**Notes:** None

### Tool Format

| Option | Description | Selected |
|--------|-------------|----------|
| Native Vercel AI SDK | Use tool() with Zod schemas directly | ✓ |
| Thin wrapper | createTool() wrapper with logging/auth | |

**User's choice:** Native Vercel AI SDK
**Notes:** None

### Error Handling in Tools

| Option | Description | Selected |
|--------|-------------|----------|
| Return error to model | Return error as tool result for natural explanation | ✓ |
| Catch and generic message | Generic "Something went wrong" | |

**User's choice:** Return error to model (via Other)
**Notes:** User emphasized extensive error handling — full request/response logging, API call tracing, verbose terminal output for easy debugging. Example: when getting balance from World Chain Sepolia, the GET request to Etherscan API should be tracked with all details.

---

## Context & Sliding Window

### System Prompt Location

| Option | Description | Selected |
|--------|-------------|----------|
| Hardcoded in code | String constant in backend | |
| Template file | .txt or .md file loaded and interpolated at runtime | ✓ |

**User's choice:** Template file
**Notes:** None

### Sliding Window Size

| Option | Description | Selected |
|--------|-------------|----------|
| 20 messages | ~10 exchanges, tight context | |
| 40 messages | ~20 exchanges, more memory | ✓ |

**User's choice:** 40 messages
**Notes:** None

### Sticky Messages

| Option | Description | Selected |
|--------|-------------|----------|
| Tool results with balances | Balance checks and tx confirmations | ✓ |
| User confirmations | "Yes, send it" / "No, cancel" | ✓ |
| System/context messages | System prompt and user context layer | ✓ |

**User's choice:** All three selected
**Notes:** None

### Summarization of Dropped Messages

| Option | Description | Selected |
|--------|-------------|----------|
| Summarize dropped messages | Generate summary and prepend to context | |
| Just discard | Simply remove oldest non-sticky messages | ✓ |

**User's choice:** Just discard
**Notes:** None

---

## Claude's Discretion

- Exact classifier prompt wording and format
- File naming conventions within tools/ directory
- Template interpolation approach for system prompt
- Retry backoff strategy specifics

## Deferred Ideas

None — discussion stayed within phase scope
