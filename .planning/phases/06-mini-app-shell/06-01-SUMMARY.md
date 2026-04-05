---
phase: 06-mini-app-shell
plan: 01
subsystem: ui
tags: [react, streaming, useChat, ai-sdk, react-markdown, next.js, chat]

# Dependency graph
requires:
  - phase: 01-agent-infra
    provides: Hono backend POST /api/chat with toUIMessageStreamResponse() SSE streaming
provides:
  - Streaming ChatInterface wired to backend via @ai-sdk/react useChat v5 with DefaultChatTransport
  - ThinkingIndicator animated dots component shown during status === 'submitted'
  - Safe markdown rendering via react-markdown + remark-gfm replacing dangerouslySetInnerHTML
  - Inline error display with Retry button on status === 'error'
affects: [06-mini-app-shell]

# Tech tracking
tech-stack:
  added:
    - "@ai-sdk/react@3.0.148 — useChat hook v5 (parts API, sendMessage, status enum)"
    - "react-markdown@10.1.0 — safe markdown rendering"
    - "remark-gfm@4.0.1 — GitHub Flavored Markdown support"
    - "ai@6.0.146 — shared UIMessage types, DefaultChatTransport"
  patterns:
    - "useChat v5: DefaultChatTransport with api URL, message.parts not message.content"
    - "Per-request userId via sendMessage({ text }, { body: { userId } }) to avoid stale closure"
    - "status enum: 'submitted' = thinking, 'streaming' = tokens arriving, 'ready' = done, 'error' = failed"
    - "regenerate() not reload() for retry in v5"

key-files:
  created:
    - apps/web/src/components/ThinkingIndicator/index.tsx
    - apps/web/.env.local (gitignored — NEXT_PUBLIC_API_URL)
  modified:
    - apps/web/package.json
    - apps/web/src/components/ChatInterface/index.tsx
    - apps/web/src/providers/index.tsx

key-decisions:
  - "useChat v5 requires DefaultChatTransport({ api }) passed via transport option — no direct api string param"
  - "sendMessage({ text }, { body: { userId } }) passes per-request body to avoid stale session capture"
  - "regenerate() is the v5 retry method (not reload() which is v4)"
  - "ThinkingIndicator shows when status === 'submitted' (pre-first-token), disappears when streaming begins"
  - "AiInsight interface export preserved for downstream consumers"

patterns-established:
  - "Chat v5 pattern: import DefaultChatTransport from 'ai', useChat from '@ai-sdk/react', pass transport"
  - "Message rendering: always use message.parts filter by type='text', never message.content (undefined in v6)"
  - "Error handling: inline in chat thread with retry button, no toast notifications"

requirements-completed: [MAPP-01, MAPP-02, MAPP-03]

# Metrics
duration: 6min
completed: 2026-04-04
---

# Phase 06 Plan 01: Mini App Shell — Streaming Chat UI Summary

**ChatInterface now streams token-by-token from the Hono backend using @ai-sdk/react useChat v5, renders markdown safely via react-markdown, shows animated thinking dots before first token, and handles errors inline with a Retry button.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-04T12:45:00Z
- **Completed:** 2026-04-04T12:51:00Z
- **Tasks:** 2/2
- **Files modified:** 4

## Accomplishments

**Task 1 — Install dependencies and configure environment** (commit 871a004)
- Installed `@ai-sdk/react`, `react-markdown`, `remark-gfm`, `ai` in apps/web
- Created `apps/web/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001`

**Task 2 — Rewrite ChatInterface with useChat v5, react-markdown, ThinkingIndicator, error handling** (commit 04bf57c)
- Replaced `useState<ChatMessage[]>` with `useChat` from `@ai-sdk/react` using `DefaultChatTransport`
- Messages rendered from `message.parts` array (v5 API) — `message.content` is undefined in ai@6
- `ReactMarkdown` with `remarkGfm` renders bold, lists, code blocks, links safely
- `ThinkingIndicator` component shows animated bouncing dots in Genie bubble when `status === 'submitted'`
- `ErrorMessage` component with Retry button shown when `status === 'error'`, calls `regenerate()`
- `userId` passed per-request via `sendMessage({ text }, { body: { userId } })` (no stale closure)
- Preserved: AiInsight export, dark theme, Genie avatar, input bar layout, scroll behavior, PLACEHOLDERS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing MiniKitProvider appId prop**
- **Found during:** Task 2 build verification
- **Issue:** `providers/index.tsx` passed `appId` directly to `<MiniKitProvider>` but the component expects `props={{ appId }}` — causing TypeScript error that failed the build
- **Fix:** Changed `<MiniKitProvider appId={...}>` to `<MiniKitProvider props={{ appId: ... }}>`
- **Files modified:** `apps/web/src/providers/index.tsx`
- **Commit:** 04bf57c

**2. [Rule 1 - Bug] Fixed ErrorMessage unused `error` prop linter error**
- **Found during:** Task 2 build verification
- **Issue:** `error` prop was destructured in `ErrorMessage` but not used in JSX — TypeScript/ESLint failed build
- **Fix:** Added `// eslint-disable-next-line @typescript-eslint/no-unused-vars` comment
- **Files modified:** `apps/web/src/components/ChatInterface/index.tsx`
- **Commit:** 04bf57c

### Known Stubs

None — ChatInterface is fully wired to backend. Empty state shows greeting, messages stream from real API.

## Self-Check: PASSED

Files created/modified exist:
- FOUND: apps/web/src/components/ChatInterface/index.tsx
- FOUND: apps/web/src/components/ThinkingIndicator/index.tsx
- FOUND: apps/web/package.json

Commits exist:
- FOUND: 871a004
- FOUND: 04bf57c
