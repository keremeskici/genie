# Phase 14: Chat Interface Polish - Research

**Researched:** 2026-04-05
**Domain:** Next.js frontend wiring, AI SDK streaming, system prompt authoring, REST API integration
**Confidence:** HIGH

## Summary

Phase 14 is a polish and wiring phase — no new architecture or external libraries are required. All three deliverables (tool result rendering verification, system prompt contact_list format, profile spending limit persistence) operate on existing infrastructure that is already in place. The research task is to audit exactly what already exists, identify the precise gaps, and map them to targeted edits.

The AiMessageBubble component in ChatInterface already handles ContactList and ConfirmCard via JSON block parsing. All other tool outputs (get_balance, get_spending, list_debts, list_contacts) return structured objects that the agent should narrate as markdown text — the existing ReactMarkdown renderer handles that correctly. The agent needs to be instructed in system.md to output the contact_list JSON block when disambiguating recipients, matching the exact shape that `parseContactList` expects. ProfileInterface needs `useSession` imported and a fetch call added to `handleSaveLimit` to hit the already-implemented PATCH /api/users/profile endpoint.

**Primary recommendation:** Three targeted edits — (1) verify/fix agent tool output narration by reviewing each tool's return shape, (2) add contact_list JSON format spec to system.md, (3) wire ProfileInterface.handleSaveLimit to PATCH /api/users/profile using session.user.id.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Tool results (balance, spending, debts, etc.) render as markdown text in chat bubbles — no new custom card components needed. ContactList and ConfirmCard already have dedicated renderers for their JSON blocks; other tool outputs are handled by the existing ReactMarkdown renderer.
- **D-02:** Verify that all tool outputs from the agent (get_balance, get_spending, list_debts, list_contacts, etc.) produce readable markdown in the current AiMessageBubble component.
- **D-03:** System prompt must specify the exact JSON format that `parseContactList` in ContactCard expects, so the agent outputs contacts in a parseable structure for the disambiguation UI.
- **D-04:** The format should match what `parseContactList` already parses — inspect the function to determine the expected JSON shape and add matching instructions to `system.md`.
- **D-05:** ProfileInterface spending limit save calls `PATCH /api/users/profile` with `{ userId, autoApproveUsd }` using the session user ID.
- **D-06:** Existing save button shows inline success/error feedback (already has `limitSaved` state pattern — extend to handle API response).
- **D-07:** The endpoint already exists (`apps/api/src/routes/users.ts:74`) — no backend changes needed, only frontend wiring.
- **D-08:** Keep existing streaming implementation as-is. Token-by-token streaming with ThinkingIndicator is functional. Focus is on tool result correctness, not streaming UX changes.

### Claude's Discretion
- Error handling details for the profile save API call (retry logic, error message copy)
- Any minor system prompt wording improvements beyond the contact_list format addition

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGEN-04 | Vercel AI SDK agent loop with tool calling and streaming responses | Agent loop already implemented in apps/api/src/agent/index.ts using streamText + stepCountIs(5). Phase work is about ensuring tool result narration is correct, not modifying the loop itself. |
| MAPP-03 | Streaming AI responses render token-by-token | ChatInterface uses useChat from @ai-sdk/react with DefaultChatTransport. ThinkingIndicator shows during `status === 'submitted'`. AiMessageBubble renders parts array. All streaming infrastructure is in place — verification that tool results render readably is the remaining work. |
| MAPP-04 | Contact management (add, list, resolve) | list_contacts tool returns `{ contacts: [{name, walletAddress}], count }`. parseContactList expects `{ type: "contact_list", contacts: [{name, walletAddress, username?}], prompt? }`. System prompt must instruct agent to wrap contact disambiguation output in this exact JSON structure so the ContactList UI renders it. |
</phase_requirements>

## Standard Stack

### Core (already installed — no new installs needed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @ai-sdk/react | v5 (useChat) | Chat hook, streaming | Already wired via DefaultChatTransport |
| next-auth | v5 beta | Session provider, user ID | `useSession` gives `session.user.id` |
| react-markdown | existing | Markdown rendering for AI text | Already in AiMessageBubble |
| remark-gfm | existing | GFM tables/lists in markdown | Already in AiMessageBubble |

No new packages are needed for this phase.

## Architecture Patterns

### Existing Project Structure (relevant paths)

```
apps/
├── api/src/
│   ├── prompts/system.md          # Agent system prompt — plain markdown
│   ├── agent/index.ts             # runAgent — loads system.md at module init
│   ├── tools/
│   │   ├── get-balance.ts         # returns { balance, currency, chain }
│   │   ├── list-contacts.ts       # returns { contacts: [{name, walletAddress}], count }
│   │   ├── list-debts.ts          # returns { type:'debts_list', debts:[...], count }
│   │   ├── get-spending.ts        # returns { type:'spending_summary', categories, total }
│   │   └── send-usdc.ts           # returns { type:'transfer_complete'|'confirmation_required' }
│   └── routes/users.ts            # PATCH /api/users/profile (line 74)
└── web/src/components/
    ├── ChatInterface/index.tsx    # AiMessageBubble with ReactMarkdown + card parsers
    ├── ContactCard/index.tsx      # parseContactList + ContactList + ContactData types
    ├── ConfirmCard/index.tsx      # parseConfirmCard + ConfirmCard component
    └── ProfileInterface/index.tsx # Spending limit UI (local state only — needs API wiring)
```

### Pattern 1: JSON Block Rendering (existing)

The AiMessageBubble calls `parseContactList(textContent)` and `parseConfirmCard(textContent)`. Both look for a fenced ```json block. If the block's `type` matches, the card renders. The remaining markdown text (with the json block stripped) still goes through ReactMarkdown.

```typescript
// Source: apps/web/src/components/ChatInterface/index.tsx
const contactData = parseContactList(textContent);
const confirmData = parseConfirmCard(textContent);
const markdownText = (contactData || confirmData)
  ? textContent.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim()
  : textContent;
```

**Key constraint:** The parser uses `text.match(/```json\s*\n([\s\S]*?)\n```/)` — a single regex that captures one JSON block. If the agent outputs multiple JSON blocks in one message, only the first will be parsed. The system prompt must instruct the agent to output at most one JSON block per message.

### Pattern 2: parseContactList Expected Shape

From `apps/web/src/components/ContactCard/index.tsx`:

```typescript
// Source: apps/web/src/components/ContactCard/index.tsx
export interface ContactListData {
  type: 'contact_list';
  contacts: ContactData[];  // [{ name, walletAddress, username? }]
  prompt?: string;
}

export function parseContactList(text: string): ContactListData | null {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;
  const parsed = JSON.parse(jsonMatch[1]);
  if (parsed.type === 'contact_list' && Array.isArray(parsed.contacts)) {
    return parsed as ContactListData;
  }
  return null;
}
```

The system prompt must instruct the agent to output exactly this structure when presenting contacts for disambiguation:

```json
{
  "type": "contact_list",
  "contacts": [
    { "name": "Alice", "walletAddress": "0x...", "username": "alice" }
  ],
  "prompt": "Which contact did you mean?"
}
```

`username` is optional. `walletAddress` is required (ContactCard truncates it for display).

### Pattern 3: Profile API Wiring (the primary frontend change)

**Current state (`ProfileInterface`):**
```typescript
// Local-state-only save — no API call
const handleSaveLimit = () => {
  const val = parseFloat(spendingLimit);
  if (isNaN(val) || val <= 0) return;
  // TODO: persist spending limit to agent config API
  setLimitSaved(true);
  setTimeout(() => setLimitSaved(false), 2000);
};
```

**Required state after this phase:**
- Import `useSession` from `next-auth/react`
- `handleSaveLimit` becomes async
- Calls `PATCH /api/users/profile` with `{ userId: session?.user?.id, autoApproveUsd: val }`
- On success: show "Saved!" inline feedback (existing `limitSaved` pattern)
- On failure: show inline error message (Claude's discretion for copy)

**Backend endpoint contract (`apps/api/src/routes/users.ts:74`):**
```typescript
// Input schema (already validated server-side):
// { userId: string, autoApproveUsd: number (positive, max 10000) }
// Success: { success: true }
// Errors: 400 INVALID_INPUT, 404 USER_NOT_FOUND, 500 Internal
// Side-effect: invalidateContextCache(userId) — auto-approve threshold refreshed
```

**Existing API URL pattern:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
// fetch(`${API_URL}/api/users/profile`, { method: 'PATCH', ... })
```

### Pattern 4: Tool Result Narration Audit

The agent (LLM) receives structured tool results and narrates them as text. No special output format is required — the LLM should convert structured data to readable markdown. The current tool return shapes are:

| Tool | Return Type | Agent Narration Expectation |
|------|------------|----------------------------|
| get_balance | `{ balance: string, currency: 'USDC', chain: 'World Chain' }` | "Your balance is X USDC on World Chain." |
| list_contacts | `{ contacts: [{name, walletAddress}], count }` | Output as contact_list JSON block when disambiguating (new system prompt instruction needed) |
| list_debts | `{ type:'debts_list', debts:[...], count }` | Narrate as bullet list of debts |
| get_spending | `{ type:'spending_summary', categories:[{category,total}], total }` | Narrate as markdown table or bullet list |
| send_usdc (auto) | `{ type:'transfer_complete', txHash, amount, recipient }` | "Sent X USDC to..." |
| send_usdc (confirm) | `{ type:'confirmation_required', txId, amount, recipient, expiresInMinutes }` | Output verbatim json block (already in system.md) |

The system.md already has correct instructions for `confirmation_required`. The missing piece is the `contact_list` block instruction.

### Anti-Patterns to Avoid

- **Do not** add a `limitError` state variable before checking if the existing `limitSaved` boolean pattern can be extended with an error state alongside it. ProfileInterface already uses `limitSaved` — add a parallel `limitError` string state.
- **Do not** send `autoApproveUsd` as a string — the backend schema validates `z.number().positive()`. Parse the float before sending.
- **Do not** nest the json block instruction for contact_list inside a conditional block in system.md — place it as a top-level section so the agent always knows the format.
- **Do not** modify the streaming pipeline (D-08). ChatInterface streaming is functional.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Session user ID in ProfileInterface | Manual cookie parsing / localStorage | `useSession` from `next-auth/react` | Already used in ChatInterface; consistent pattern |
| API URL construction | Hardcoded URL | `process.env.NEXT_PUBLIC_API_URL ?? ''` prefix | Established pattern across all components |
| JSON block parsing for new types | New parseXxx function | Reuse existing parseContactList / parseConfirmCard | Both already handle the only two structured card types needed |

## Common Pitfalls

### Pitfall 1: autoApproveUsd Sent as String
**What goes wrong:** ProfileInterface manages `spendingLimit` as a string state (from the input element). Sending the string directly to PATCH /api/users/profile will fail the `z.number().positive()` validation with a 400 error.
**Why it happens:** `<input type="number">` value is always a string in React state.
**How to avoid:** Call `parseFloat(spendingLimit)` before including in the request body. This is already done for the validation check (`isNaN(val) || val <= 0`) — use the same `val` variable.
**Warning signs:** API returns 400 INVALID_INPUT in the browser network tab.

### Pitfall 2: contact_list JSON Block Must Not Be Double-Parsed
**What goes wrong:** The `AiMessageBubble` regex `/```json\s*\n([\s\S]*?)\n```/` is non-greedy and captures only the first json block. If the agent outputs any json block before the contact_list block, the first will shadow it.
**Why it happens:** Agent might output explanation text with an inline code snippet before the contacts block.
**How to avoid:** System prompt must instruct the agent to output the contact_list JSON block as the first and only json block in the message when presenting contacts.

### Pitfall 3: parseConfirmCard and parseContactList Are Mutually Exclusive (by implementation)
**What goes wrong:** Both parsers run on the same textContent. If the agent outputs a contact_list block, `parseContactList` returns data; `parseConfirmCard` returns null. This is correct — but if the agent ever outputs both types in one message, the second block is silently dropped.
**Why it happens:** Single-regex parser captures first block only.
**How to avoid:** System prompt must forbid outputting multiple json blocks in a single message.

### Pitfall 4: limitSaved Timeout vs. Async API Response Race
**What goes wrong:** Current `handleSaveLimit` sets `limitSaved = true` then resets via `setTimeout`. After API wiring, the timeout should only start after the API resolves successfully — not before the fetch.
**Why it happens:** Copy-paste from the pre-wired pattern where the save was instant.
**How to avoid:** Move `setLimitSaved(true)` inside the `if (res.ok)` branch, after the fetch resolves. Set `limitSaved` back to false via setTimeout only after successful response.

### Pitfall 5: system.md Changes Propagate on Server Restart Only
**What goes wrong:** `loadSystemPrompt()` is called once at module init in `apps/api/src/agent/index.ts`. The file is read at startup, not per-request.
**Why it happens:** `const systemPrompt = loadSystemPrompt()` is a module-level constant.
**How to avoid:** After editing system.md, restart the API server to pick up the change. No code changes needed — this is expected behavior.

## Code Examples

### contact_list System Prompt Addition

```markdown
## Contact Disambiguation

When the user requests to send money and multiple contacts match, or when listing contacts for selection,
output a contact_list JSON block as the ONLY json block in your response.

Format:
\`\`\`json
{
  "type": "contact_list",
  "contacts": [
    { "name": "Alice Chen", "walletAddress": "0xabc...123", "username": "alicechen" }
  ],
  "prompt": "Which Alice did you mean?"
}
\`\`\`

Rules:
- `type` must be exactly `"contact_list"`
- `contacts` is an array; each entry requires `name` and `walletAddress`; `username` is optional
- Include a brief `prompt` explaining why you are showing contacts
- Do NOT include any other json fenced blocks in the same message
- Surround the json block with a brief explanation (e.g. "I found a few contacts — which one?")
```

### ProfileInterface API Wiring

```typescript
// Source pattern from ChatInterface/index.tsx and users.ts endpoint
'use client';
import { useState } from 'react';
import { useSession } from 'next-auth/react';

// Inside ProfileInterface:
const { data: session } = useSession();
const [spendingLimit, setSpendingLimit] = useState('');
const [limitSaved, setLimitSaved] = useState(false);
const [limitError, setLimitError] = useState('');

const handleSaveLimit = async () => {
  const val = parseFloat(spendingLimit);
  if (isNaN(val) || val <= 0) return;

  setLimitError('');
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? ''}/api/users/profile`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: session?.user?.id, autoApproveUsd: val }),
      },
    );
    if (res.ok) {
      setLimitSaved(true);
      setTimeout(() => setLimitSaved(false), 2000);
    } else {
      const json = await res.json();
      setLimitError(json.message ?? 'Failed to save');
    }
  } catch {
    setLimitError('Network error — please try again');
  }
};
```

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — all tools, runtimes, and API endpoints are already present in the codebase)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | apps/api/vitest.config.ts |
| Quick run command | `cd apps/api && npx vitest run src/tools/` |
| Full suite command | `cd apps/api && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGEN-04 | Agent loop streams with tool results | Integration (manual) | N/A — existing agent tested via smoke test | N/A |
| MAPP-03 | Streaming renders token-by-token | Manual smoke | Run app, observe chat bubbles | N/A |
| MAPP-04 | contact_list JSON block triggers ContactList UI | Unit | No existing test for parseContactList | ❌ Wave 0 |

The profile save is a frontend wiring change — testable via manual interaction (enter limit, tap Set, verify network call in DevTools). No automated test file exists for ProfileInterface; given the hackathon timeline, manual verification is acceptable.

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run src/tools/`
- **Per wave merge:** `cd apps/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/src/components/ContactCard/parseContactList.test.ts` — unit test for parseContactList covering the contact_list JSON shape (REQ MAPP-04). Optionally added if time permits; manual verification is acceptable for hackathon scope.

*(All existing tool tests cover AGEN-04 behavior; no framework install needed)*

## Sources

### Primary (HIGH confidence)
- Direct read of `apps/web/src/components/ContactCard/index.tsx` — parseContactList function, ContactListData interface
- Direct read of `apps/web/src/components/ChatInterface/index.tsx` — AiMessageBubble rendering logic, JSON block stripping
- Direct read of `apps/web/src/components/ProfileInterface/index.tsx` — current handleSaveLimit, limitSaved state pattern
- Direct read of `apps/api/src/routes/users.ts:74` — PATCH /api/users/profile request/response schema
- Direct read of `apps/api/src/prompts/system.md` — current system prompt, missing contact_list section
- Direct read of all tool files — confirmed return shapes for agent narration

### Secondary (MEDIUM confidence)
- N/A — all findings grounded in direct codebase reads

### Tertiary (LOW confidence)
- N/A

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing imports confirmed by reading source files
- Architecture: HIGH — parseContactList expected shape read directly from source; PATCH endpoint contract read directly from source
- Pitfalls: HIGH — identified by direct inspection of code patterns (regex, state mutation timing, type coercion)

**Research date:** 2026-04-05
**Valid until:** Stable for the duration of the hackathon (no dependency changes expected)
