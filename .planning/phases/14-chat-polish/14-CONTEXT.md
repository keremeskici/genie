# Phase 14: Chat Interface Polish - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a polished chat-to-agent flow: tool results render correctly in the chat UI, the system prompt includes contact_list JSON format for disambiguation consistency, and ProfileInterface spending limit persists to the backend via PATCH /api/users/profile.

</domain>

<decisions>
## Implementation Decisions

### Tool Result Rendering
- **D-01:** Tool results (balance, spending, debts, etc.) render as markdown text in chat bubbles — no new custom card components needed. ContactList and ConfirmCard already have dedicated renderers for their JSON blocks; other tool outputs are handled by the existing ReactMarkdown renderer.
- **D-02:** Verify that all tool outputs from the agent (get_balance, get_spending, list_debts, list_contacts, etc.) produce readable markdown in the current AiMessageBubble component.

### Contact List System Prompt Format
- **D-03:** System prompt must specify the exact JSON format that `parseContactList` in ContactCard expects, so the agent outputs contacts in a parseable structure for the disambiguation UI.
- **D-04:** The format should match what `parseContactList` already parses — inspect the function to determine the expected JSON shape and add matching instructions to `system.md`.

### Profile Save Wiring
- **D-05:** ProfileInterface spending limit save calls `PATCH /api/users/profile` with `{ userId, autoApproveUsd }` using the session user ID.
- **D-06:** Existing save button shows inline success/error feedback (already has `limitSaved` state pattern — extend to handle API response).
- **D-07:** The endpoint already exists (`apps/api/src/routes/users.ts:74`) — no backend changes needed, only frontend wiring.

### Streaming Behavior
- **D-08:** Keep existing streaming implementation as-is. Token-by-token streaming with ThinkingIndicator is functional. Focus is on tool result correctness, not streaming UX changes.

### Claude's Discretion
- Error handling details for the profile save API call (retry logic, error message copy)
- Any minor system prompt wording improvements beyond the contact_list format addition

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Chat Interface
- `apps/web/src/components/ChatInterface/index.tsx` — Main chat UI with useChat v5, streaming, ContactList/ConfirmCard rendering
- `apps/web/src/components/ContactCard/index.tsx` — ContactList parser and renderer (defines expected JSON format)
- `apps/web/src/components/ConfirmCard/index.tsx` — ConfirmCard parser and renderer

### System Prompt
- `apps/api/src/prompts/system.md` — Agent system prompt (needs contact_list format addition)

### Profile
- `apps/web/src/components/ProfileInterface/index.tsx` — Profile UI with local-only spending limit (needs API wiring)
- `apps/api/src/routes/users.ts` — PATCH /api/users/profile endpoint (already exists)

### Agent & Tools
- `apps/api/src/agent/index.ts` — Agent loop (runAgent)
- `apps/api/src/tools/` — All registered tools (get_balance, send_usdc, list_contacts, etc.)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useChat` (ai-sdk/react): Already wired with DefaultChatTransport to `/api/chat`
- `parseContactList` / `parseConfirmCard`: JSON block parsers that extract structured data from agent responses
- `ReactMarkdown` with `remarkGfm`: Renders all non-card agent text
- `useSession` (next-auth): Provides `session.user.id` for API calls
- `PATCH /api/users/profile`: Backend endpoint already implemented with validation and cache invalidation

### Established Patterns
- JSON blocks in agent responses: Agent outputs ```json blocks, frontend parses and renders with dedicated components (ContactList, ConfirmCard)
- Hook pattern: `useBalance`, `useTransactions` — fetch + state + refetch pattern for API data
- API URL: `process.env.NEXT_PUBLIC_API_URL` prefix for all backend calls
- Session identity: `session?.user?.id` passed as `userId` in API request bodies

### Integration Points
- ProfileInterface needs to import `useSession` and call fetch to PATCH endpoint
- System prompt file (`system.md`) is read by agent context assembly — changes propagate automatically
- ChatInterface already handles ContactList and ConfirmCard — tool result rendering is about verifying agent output format

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 14-chat-polish*
*Context gathered: 2026-04-05*
