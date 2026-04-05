# Phase 6: Mini App Shell - Research

**Researched:** 2026-04-04
**Domain:** Next.js 15 / MiniKit 2.0 / Vercel AI SDK v5 (ai@6.x) / react-markdown
**Confidence:** HIGH

## Summary

Phase 6 wires an existing, well-structured frontend scaffold (`apps/web`) to the working Hono backend (`apps/api`). The frontend already has MiniKitProvider, SessionProvider, ChatInterface, ProfileInterface, Pay, Verify, Navigation, and PageLayout components — this phase is about integration, not greenfield building.

The key integration points are: (1) replacing ChatInterface's local `useState` with `useChat` from `@ai-sdk/react` using the v5 API (parts-based UIMessage, manual input state, `sendMessage` pattern), (2) replacing `dangerouslySetInnerHTML` with `react-markdown` for AI message rendering, (3) wiring MiniKit Pay/haptics/permissions into the agent-driven flows, and (4) adding the World ID verify button to ProfileInterface using the existing `Verify` component.

The backend already uses `ai@^6.0.146` with `toUIMessageStreamResponse()` — the frontend must use the matching `@ai-sdk/react@^3.x` which provides the v5 API with UIMessage parts. These are version-compatible. The existing `useChat` body-passing pattern (second argument to `sendMessage`) is the correct way to forward `userId` per session.

**Primary recommendation:** Install `@ai-sdk/react` + `react-markdown` + `remark-gfm` in `apps/web`, then replace `ChatInterface`'s local state with `useChat` (v5 API), render `message.parts` instead of `message.content`, and add MiniKit commands as side-effect triggers on key agent actions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**API & Streaming Integration**
- D-01: Use Vercel AI SDK `@ai-sdk/react` `useChat` hook to connect ChatInterface to the backend `/api/chat` Hono endpoint. Handles streaming, message state, abort, and retry out of the box.
- D-02: Token-by-token streaming render — each token appends to the AI message bubble as it arrives (ChatGPT-style).
- D-03: API errors show inline in the chat thread with a "Retry" button on the failed message. No toasts.
- D-04: Animated dots ("...") in a Genie AI bubble as thinking indicator while waiting for the first token. Gets replaced by actual response once tokens start streaming.
- D-05: API base URL configured via `NEXT_PUBLIC_API_URL` environment variable pointing to the Hono backend.

**Chat UX Polish**
- D-06: Replace `dangerouslySetInnerHTML` with `react-markdown` for AI message rendering — supports bold, lists, code blocks, and eliminates XSS risk.
- D-07: Keep existing AiInsight cards (label/value pairs below messages) for structured data like balance, spending summaries.
- D-08: Preserve existing empty state and UI elements — no redesign of the current chat layout, greeting, or Genie avatar treatment.

**Contact Management**
- D-09: Chat-only contact management — all contact operations (add, list, resolve) through natural language via the AI agent. No dedicated contacts page.
- D-10: Ambiguous contact matches render as tappable contact cards in the chat. Backend tool returns structured contact data; frontend renders interactive mini cards the user can tap to select.

**MiniKit 2.0 Integration**
- D-11: Full MiniKit SDK integration — MiniKit Pay, wallet signing (transaction commands), haptic feedback, native UI elements, and permission requests.
- D-12: MiniKit Pay for USDC transfers — triggers World App's built-in payment UX for the send flow.
- D-13: Wallet signing via MiniKit wallet commands for on-chain transaction signing through World App wallet.
- D-14: Haptic feedback on key actions (send confirmed, error, etc.) and native share sheets where applicable.
- D-15: Permission requests for wallet address, username, and profile picture via MiniKit SDK.
- D-16: World ID verification lives on the Profile page — user navigates to Profile tab and taps "Verify with World ID" button. Agent directs unverified users there when they attempt gated actions.

### Claude's Discretion
- Exact `useChat` configuration (API route path, headers, body format)
- react-markdown plugins and styling approach
- Tappable contact card component design and interaction
- MiniKit Pay vs direct smart contract flow coordination
- How haptic triggers map to user actions
- Safe area inset handling for World App shell
- How permission request flow integrates with onboarding

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAPP-01 | Next.js 14 Mini App runs inside World App via MiniKit 2.0 SDK | MiniKitProvider already wraps the app; `MiniKit.isInstalled()` verifies World App context |
| MAPP-02 | Chat-first interface with dark theme and neon blue accents | Existing ChatInterface + globals.css theme tokens already implement this — needs API wiring only |
| MAPP-03 | Streaming AI responses render token-by-token | `useChat` from `@ai-sdk/react` v5 + `message.parts` array streaming pattern confirmed |
| MAPP-04 | Contact management (add, list, resolve) | Chat-only via agent tools already in backend; frontend needs tappable contact card rendering |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ai-sdk/react` | ^3.0.148 (latest) | `useChat` hook for streaming chat | Official Vercel AI SDK React bindings; version-matches `ai@6.x` backend |
| `react-markdown` | ^10.1.0 (latest) | Safe markdown rendering | Replaces dangerous `dangerouslySetInnerHTML`; XSS-safe; supports remark/rehype plugins |
| `remark-gfm` | ^4.0.0 | GitHub Flavored Markdown (tables, task lists, strikethrough) | Standard companion to react-markdown |
| `@worldcoin/minikit-js` | latest (already installed) | MiniKit Pay, haptics, permissions, wallet commands | Already in `package.json`; provides all MiniKit 2.0 commands |
| `@worldcoin/mini-apps-ui-kit-react` | ^1.6.0 (already installed) | World-native UI components (`Button`, `LiveFeedback`) | Already imported in components; consistent with World App UX |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `rehype-highlight` | ^7.x | Syntax highlighting for code blocks | If AI returns code snippets (optional — adds bundle size) |
| `DefaultChatTransport` | part of `ai` package (already in api) | Configure useChat endpoint and custom body | Import from `ai` package in frontend; needed for custom body fields |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-markdown` | `marked` + DOMPurify | react-markdown is React-native, no sanitization layer needed separately |
| `@ai-sdk/react` useChat | Manual fetch + EventSource | useChat handles SSE parsing, abort, retry, and UIMessage format — no manual implementation |

**Installation:**
```bash
# From apps/web directory:
npm install @ai-sdk/react react-markdown remark-gfm
```

**Version verification (confirmed 2026-04-04):**
- `@ai-sdk/react`: 3.0.148 (published ~17h ago as of research date)
- `react-markdown`: 10.1.0
- `ai` (backend): 6.0.146 — `@ai-sdk/react` 3.x is the matching frontend package

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── components/
│   ├── ChatInterface/
│   │   └── index.tsx          # Replace useState with useChat; render parts
│   ├── ContactCard/
│   │   └── index.tsx          # NEW: tappable contact card for disambiguation
│   ├── ThinkingIndicator/
│   │   └── index.tsx          # NEW: animated dots bubble (D-04)
│   └── ProfileInterface/
│       └── index.tsx          # Add World ID verify section (D-16)
└── app/
    └── api/                   # No new API routes needed — proxy to Hono backend
```

### Pattern 1: useChat v5 API (AI SDK v5 / ai@6)

**What:** The backend uses `ai@6.x` which uses the v5 message format (UIMessage with parts arrays). The frontend MUST use `@ai-sdk/react@3.x` to get the matching `useChat` — NOT the older v4 API.

**Critical difference from v4:**
- Messages have `parts` array, NOT a `content` string
- Input state is managed manually with `useState`
- `sendMessage({ text })` replaces `handleSubmit`
- `status` is `'submitted' | 'streaming' | 'ready' | 'error'` (NOT `isLoading: boolean`)

**Example:**
```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useState } from 'react';

export const ChatInterface = () => {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: `${process.env.NEXT_PUBLIC_API_URL}/api/chat`,
    }),
  });

  const handleSend = () => {
    if (!input.trim() || status !== 'ready') return;
    // Pass userId from session as custom body field
    sendMessage(
      { text: input },
      { body: { userId: session?.user?.id } },
    );
    setInput('');
  };

  return (
    <>
      {messages.map((message) => (
        <div key={message.id}>
          {message.parts.map((part, i) =>
            part.type === 'text' ? (
              <ReactMarkdown key={i}>{part.text}</ReactMarkdown>
            ) : null
          )}
        </div>
      ))}
      {/* Thinking indicator when status === 'submitted' and no assistant message yet */}
    </>
  );
};
```

### Pattern 2: Detecting Streaming vs Thinking State (D-04)

**What:** Show animated dots when waiting for first token; replace with streaming text once tokens arrive.

**When to use:** The `status` field from `useChat` drives this.

**Logic:**
```typescript
// Status 'submitted' = request sent, no tokens yet → show ThinkingIndicator
// Status 'streaming' = tokens arriving → show last AI message being built
// Status 'ready' = complete
const isThinking = status === 'submitted';
const isStreaming = status === 'streaming';
```

The last `messages` entry with `role === 'assistant'` will have `parts` populating token-by-token during streaming. React re-renders on each token append automatically.

### Pattern 3: Rendering parts with react-markdown (D-06)

**What:** AI messages use `message.parts` array. Each `{ type: 'text', text: string }` part renders through react-markdown.

**Example:**
```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function AiMessage({ parts }: { parts: UIMessagePart[] }) {
  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm]}
              components={{
                // Style headings, links, code with existing Tailwind tokens
                p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
                code: ({ children }) => (
                  <code className="bg-background px-1 text-accent text-xs">{children}</code>
                ),
                strong: ({ children }) => (
                  <strong className="font-bold text-white">{children}</strong>
                ),
              }}
            >
              {part.text}
            </ReactMarkdown>
          );
        }
        return null;
      })}
    </>
  );
}
```

### Pattern 4: MiniKit Haptic Feedback (D-14)

**What:** Trigger haptic feedback after key actions. Available from MiniKit 1.7.1+.

**API:**
```typescript
// Source: https://docs.world.org/mini-apps/commands/send-haptic-feedback
import { MiniKit } from '@worldcoin/minikit-js';

// On send confirmed (success)
await MiniKit.sendHapticFeedback({ hapticsType: 'notification', style: 'success' });

// On error
await MiniKit.sendHapticFeedback({ hapticsType: 'notification', style: 'error' });

// On send button press
await MiniKit.sendHapticFeedback({ hapticsType: 'impact', style: 'medium' });

// On contact card tap
await MiniKit.sendHapticFeedback({ hapticsType: 'selection-changed' });
```

### Pattern 5: MiniKit Pay (D-12)

**What:** The existing `Pay` component demonstrates the complete pattern. For the chat flow, the agent initiates a transfer via backend smart contract; MiniKit Pay triggers World App's native payment UX.

**Existing pattern in `apps/web/src/components/Pay/index.tsx`:**
```typescript
// Source: existing Pay component + https://docs.world.org/mini-apps/commands/pay
import { MiniKit } from '@worldcoin/minikit-js';
import { Tokens, tokenToDecimals } from '@worldcoin/minikit-js/commands';

const res = await fetch('/api/initiate-payment', { method: 'POST' });
const { id } = await res.json();

const result = await MiniKit.pay({
  reference: id,           // backend-generated UUID, stored in DB for verification
  to: recipientAddress,
  tokens: [{
    symbol: Tokens.USDC,
    token_amount: tokenToDecimals(amount, Tokens.USDC).toString(),
  }],
  description: 'Send USDC via Genie',
});
// CRITICAL: Always verify transactionId on backend before treating as final
// GET https://developer.worldcoin.org/api/v2/minikit/transaction/{transactionId}
```

### Pattern 6: World ID Verify on Profile Page (D-16)

The existing `Verify` component in `apps/web/src/components/Verify/index.tsx` already contains the complete IDKit flow. It just needs to be integrated into `ProfileInterface` and the `verify-proof` API route needs to also update the Genie backend's user record (set `worldId` in the database).

**Integration point:** The Next.js `/api/verify-proof` route currently only calls the Worldcoin developer API. It also needs to call `POST NEXT_PUBLIC_API_URL/api/verify` (or equivalent Genie backend endpoint) to persist the nullifier hash in the users table.

### Pattern 7: Tappable Contact Cards (D-10)

**What:** When `resolve_contact` tool returns multiple matches, the agent returns structured JSON in its text response (or via a tool result). The frontend intercepts this and renders `ContactCard` components.

**Approach:** The backend agent already returns structured data. The frontend can detect contact disambiguation messages by checking `message.parts` for tool invocation parts or by having the agent output a parseable JSON block. The simpler approach (given hackathon constraints) is to render contact data that appears in the stream as interactive cards by detecting a pattern in the text part.

**Recommended:** Use a lightweight JSON fence detection: agent outputs ```json\n{...}\n``` with a `type: "contact_list"` marker. Frontend checks `part.text` for this fence and renders ContactCard instead of ReactMarkdown.

### Anti-Patterns to Avoid

- **Using `message.content` instead of `message.parts`:** In AI SDK v5 (ai@6), `content` is removed from UIMessage. Always render from `parts`. Rendering `message.content` will show `undefined`.
- **Using `handleSubmit` / `handleInputChange` from useChat:** These are v4 patterns. v5 requires manual `useState` for input.
- **Using `isLoading` from useChat:** The v5 API has `status: 'submitted' | 'streaming' | 'ready' | 'error'` — not a boolean.
- **Using `pipeDataStreamToResponse` in the backend:** Already avoided (ai@6 pattern confirmed in chat.ts).
- **Calling `dangerouslySetInnerHTML`:** Replaced by react-markdown per D-06.
- **Passing userId at hook init only:** The `body` parameter at `useChat({ body: { userId } })` is captured at init and stays stale. Pass userId as second arg to `sendMessage` per request instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Streaming SSE parsing | Custom EventSource reader | `useChat` from `@ai-sdk/react` | Handles SSE protocol, UIMessage parsing, abort signal, reconnect |
| Markdown rendering | `innerHTML` with a marked string | `react-markdown` + `remark-gfm` | XSS-safe, React component tree, plugin ecosystem |
| Thinking/loading state | Custom state machine | `useChat` `status` field | `'submitted'` = thinking, `'streaming'` = tokens arriving |
| Payment UX | Custom USDC transfer form | `MiniKit.pay()` | World App's native UX, handles wallet, receipts, confirmations |
| Haptic feedback | Web Vibration API polyfill | `MiniKit.sendHapticFeedback()` | Native iOS/Android haptics via World App bridge |
| Contact picker | Custom contact input form | `MiniKit.shareContacts()` | Native World App contact picker with wallet addresses |

**Key insight:** Almost every MiniKit command replaces something that would otherwise require a custom form + backend coordination.

## Common Pitfalls

### Pitfall 1: AI SDK v4 vs v5 Message Format Mismatch
**What goes wrong:** Code tries to render `message.content` (v4 pattern) on messages from `useChat` v5 — renders `undefined` for all AI messages.
**Why it happens:** Existing code in `ChatInterface` uses a custom `ChatMessage` type with `content: string`. When replacing with `useChat`, the message shape changes completely.
**How to avoid:** After installing `@ai-sdk/react`, render exclusively from `message.parts` array. Each text token is `{ type: 'text', text: string }`.
**Warning signs:** AI message bubbles are empty; console shows no errors but UI shows blank where AI response should be.

### Pitfall 2: useChat `body` Option Staleness
**What goes wrong:** Passing `body: { userId }` at hook initialization level — the value is captured at mount time and doesn't update if userId changes (or if it's not yet available from session on first render).
**Why it happens:** useChat v5 captures hook-level `body` once at init.
**How to avoid:** Pass `userId` as second argument to `sendMessage(message, { body: { userId } })` — this is evaluated per-call and gets the current session value.
**Warning signs:** Backend receives `userId: undefined` or stale userId after session load.

### Pitfall 3: CORS Between Next.js Frontend and Hono Backend
**What goes wrong:** `useChat` calls `NEXT_PUBLIC_API_URL/api/chat` but the Hono backend doesn't have CORS headers for the Next.js origin.
**Why it happens:** Two separate servers (Next.js on 3000, Hono on 3001) in development.
**How to avoid:** Verify Hono backend has `cors()` middleware configured. Alternatively, proxy via Next.js `rewrites` in `next.config.ts` so the frontend calls `/api/proxy/chat` which forwards to Hono.
**Warning signs:** Browser console shows CORS error on chat submission.

### Pitfall 4: MiniKit Commands Failing Outside World App
**What goes wrong:** `MiniKit.pay()`, `MiniKit.sendHapticFeedback()`, etc. throw or return errors when tested in a browser (not World App).
**Why it happens:** MiniKit commands require the World App WebView bridge. `MiniKit.isInstalled()` returns `false` in regular browsers.
**How to avoid:** Guard all MiniKit commands: `if (MiniKit.isInstalled()) { await MiniKit.pay(...) }`. For dev testing, the Pay/Verify components use a `fallback` option.
**Warning signs:** Console errors like "MiniKit not installed" when testing in browser.

### Pitfall 5: Thinking Indicator Stuck After Error
**What goes wrong:** ThinkingIndicator stays visible when an API error occurs because the status transitions to `'error'` but the UI only checks for `status === 'streaming'`.
**Why it happens:** Error state isn't handled in the status check for the thinking/streaming display logic.
**How to avoid:** Check `status !== 'ready' && status !== 'error'` to show the loading indicator. Show error state separately per D-03 (inline retry button).
**Warning signs:** Animated dots remain spinning indefinitely after a failed request.

### Pitfall 6: `DefaultChatTransport` Import Location
**What goes wrong:** `DefaultChatTransport` is imported from `@ai-sdk/react` but it's actually in the `ai` package.
**Why it happens:** Package split — `@ai-sdk/react` provides the hook; `ai` provides the transport classes.
**How to avoid:** `import { DefaultChatTransport } from 'ai'` — the `ai` package is already in `apps/api` but needs to be added to `apps/web/package.json` as well, OR use the simple `api` string shorthand: `useChat({ api: url })` without explicit transport.
**Warning signs:** TypeScript cannot find `DefaultChatTransport` in `@ai-sdk/react`.

## Code Examples

### Complete ChatInterface with useChat v5

```typescript
// Source: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot
'use client';
import { useChat } from '@ai-sdk/react';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MiniKit } from '@worldcoin/minikit-js';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';
const NAV_HEIGHT = 108;

export const ChatInterface = () => {
  const { data: session } = useSession();
  const [input, setInput] = useState('');
  const [inputBottom, setInputBottom] = useState(NAV_HEIGHT);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error } = useChat({
    api: `${API_URL}/api/chat`,
    // Note: api shorthand works without DefaultChatTransport import
  });

  const isThinking = status === 'submitted';
  const isStreaming = status === 'streaming';

  const handleSend = async () => {
    if (!input.trim() || status !== 'ready') return;
    const text = input.trim();
    setInput('');
    // Haptic on send
    if (MiniKit.isInstalled()) {
      await MiniKit.sendHapticFeedback({ hapticsType: 'impact', style: 'medium' });
    }
    sendMessage(
      { text },
      { body: { userId: session?.user?.id } },
    );
  };

  // ... keyboard-aware input bottom positioning (existing logic preserved) ...

  return (
    <div className="relative flex flex-col bg-background text-white font-body overflow-hidden touch-none"
      style={{ height: '100dvh', maxHeight: '100dvh' }}>
      <div className="flex-1 overflow-y-auto overscroll-contain pt-6 pb-6 px-6"
        style={{ touchAction: 'pan-y' }}>
        <div className="flex flex-col gap-10 max-w-md mx-auto">
          {messages.map((message) =>
            message.role === 'user' ? (
              <UserMessage key={message.id} parts={message.parts} />
            ) : (
              <AiMessage key={message.id} parts={message.parts} />
            )
          )}
          {isThinking && <ThinkingIndicator />}
          {error && status === 'error' && (
            <ErrorMessage error={error} onRetry={() => sendMessage({ text: input })} />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
      {/* input bar — same structure as existing */}
    </div>
  );
};
```

### react-markdown inside AiMessage

```typescript
// Source: https://github.com/remarkjs/react-markdown
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function AiMessage({ parts }: { parts: UIMessagePart[] }) {
  const textContent = parts
    .filter(p => p.type === 'text')
    .map(p => (p as TextUIPart).text)
    .join('');

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
        code: ({ inline, children }) =>
          inline
            ? <code className="bg-background px-1 text-accent text-xs font-mono">{children}</code>
            : <pre className="bg-background p-3 text-xs font-mono overflow-x-auto text-white/80">{children}</pre>,
        ul: ({ children }) => <ul className="list-disc list-inside text-sm space-y-1 my-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside text-sm space-y-1 my-2">{children}</ol>,
      }}
    >
      {textContent}
    </ReactMarkdown>
  );
}
```

### World ID Verify in ProfileInterface

```typescript
// Integrate the existing Verify component (apps/web/src/components/Verify/index.tsx)
// into ProfileInterface — add a new Section:
<Section label="Identity">
  <p className="text-xs text-white/40 mb-4 leading-relaxed">
    Verify your humanity with World ID to unlock send money, debt tracking, and agent automation.
  </p>
  <Verify />
</Section>
```

The `Verify` component's `onClickVerify` handler needs to also call the Genie backend to persist verification. Currently `/api/verify-proof` only checks with Worldcoin — add a fetch to `NEXT_PUBLIC_API_URL/api/verify` after success.

### MiniKit shareContacts for Contact Selection

```typescript
// Source: https://docs.world.org/mini-apps/commands/share-contacts
import { MiniKit } from '@worldcoin/minikit-js';

async function pickContact() {
  if (!MiniKit.isInstalled()) return null;
  const result = await MiniKit.shareContacts({
    isMultiSelectEnabled: false,
    inviteMessage: 'Send money via Genie',
  });
  if (result.executedWith === 'minikit' && result.data?.contacts?.length > 0) {
    return result.data.contacts[0]; // { username, walletAddress, profilePictureUrl }
  }
  return null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `message.content: string` | `message.parts: UIMessagePart[]` | AI SDK v5 (ai@6) | All message rendering must use `parts` |
| `handleSubmit` + `handleInputChange` | Manual `useState` + `sendMessage({ text })` | AI SDK v5 | Simpler but requires explicit input state |
| `isLoading: boolean` | `status: 'submitted' \| 'streaming' \| 'ready' \| 'error'` | AI SDK v5 | More granular state for thinking vs streaming UIs |
| `useChat({ api: '...' })` | `useChat({ transport: new DefaultChatTransport({...}) })` or `useChat({ api: '...' })` | AI SDK v5 | Shorthand `api` still works; transport is optional unless customizing |
| `dangerouslySetInnerHTML` | `react-markdown` | Phase 6 decision | XSS safety + proper markdown rendering |

**Deprecated/outdated:**
- `@ai-sdk/react` v2.x (useChat v4 API): `content` string, `isLoading`, `handleSubmit` — NOT compatible with `ai@6` backend
- `pipeDataStreamToResponse`: Node.js-only, already avoided in backend

## Open Questions

1. **Does `verify-proof` API route need to call Genie backend?**
   - What we know: `/api/verify-proof` in Next.js currently only validates with Worldcoin and returns success/failure. The Genie backend has a `/verify` endpoint that updates `users.worldId`.
   - What's unclear: Whether Phase 3 already wired this or it's still a TODO in `verify-proof/route.ts`.
   - Recommendation: The Profile page's verify flow must POST to `NEXT_PUBLIC_API_URL/api/verify` after IDKit success to actually persist `worldId` in the DB. This should be a task.

2. **Contact card disambiguation: how does the agent signal "this is a contact list"?**
   - What we know: `resolve_contact` tool returns structured data. The agent can embed JSON in text responses.
   - What's unclear: Whether the agent currently outputs a parseable marker the frontend can detect.
   - Recommendation: Add a lightweight convention — agent outputs a fenced JSON block with `type: "contact_list"` marker. Frontend `ContactCard` component checks part text for this pattern before rendering as markdown.

3. **MiniKit Pay vs GenieRouter for send flow?**
   - What we know: Phase 4 deployed `GenieRouter` + `PayHandler` contracts. The `send_usdc` agent tool calls `writeContract` directly. D-12 says MiniKit Pay should be used for USDC transfers.
   - What's unclear: Whether Phase 6 replaces the backend contract flow with MiniKit Pay, or MiniKit Pay is a supplementary UX layer.
   - Recommendation: MiniKit Pay is the frontend-triggered confirmation UX — it's a parallel path. For the hackathon, wire MiniKit Pay on the frontend for explicit send actions, while the backend agent tool route remains for auto-approved transfers. This matches D-04/D-12 intent.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npm install` | ✓ | (system) | — |
| `@ai-sdk/react` | MAPP-03 streaming | ✗ (not in package.json) | needs install | None — required |
| `react-markdown` | D-06 markdown render | ✗ (not in package.json) | needs install | None — required |
| `remark-gfm` | react-markdown GFM | ✗ (not in package.json) | needs install | Optional (degrades to basic markdown) |
| `@worldcoin/minikit-js` | MAPP-01, D-11-D-15 | ✓ (in package.json: latest) | latest | — |
| `@worldcoin/mini-apps-ui-kit-react` | UI components | ✓ (in package.json: ^1.6.0) | 1.6.0 | — |
| `@worldcoin/idkit` | D-16 World ID | ✓ (in package.json: 4.0.0-dev.4777311) | 4.0.0-dev | — |
| `NEXT_PUBLIC_API_URL` env var | D-05 API base URL | ✗ (not in .env.local) | — | Add to .env.local |
| Hono backend | D-01 streaming endpoint | ✓ (Phase 1 complete) | port 3001 | — |

**Missing dependencies with no fallback:**
- `@ai-sdk/react` — must install in `apps/web`
- `react-markdown` — must install in `apps/web`
- `NEXT_PUBLIC_API_URL` — must add to `apps/web/.env.local`

**Missing dependencies with fallback:**
- `remark-gfm` — optional; basic markdown still works without GFM plugin

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected in `apps/web` (no jest/vitest config, no test scripts in package.json) |
| Config file | none |
| Quick run command | `npm run lint` (only available check) |
| Full suite command | none |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAPP-01 | Mini App loads in World App | manual-only | Manual: open World App, navigate to mini app URL | ❌ |
| MAPP-02 | Dark theme chat UI visible | manual-only | Manual: visual inspection in World App | ❌ |
| MAPP-03 | Streaming renders token-by-token | manual-only | Manual: submit a message, observe streaming tokens | ❌ |
| MAPP-04 | Contact add/list/resolve via chat | manual-only | Manual: type "who owes me money", verify contacts list | ❌ |

**Justification for manual-only:** All phase requirements are UI/UX behaviors inside World App's WebView environment. Unit testing React components that depend on MiniKit requires mocking the entire World App bridge. Given the 36-hour hackathon constraint, manual smoke testing in World App simulator is the appropriate validation strategy.

### Sampling Rate
- **Per task commit:** `npm run lint` (from `apps/web` directory)
- **Per wave merge:** `npm run build` to catch TypeScript errors
- **Phase gate:** Manual smoke test in World App simulator before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] No test framework — manual testing is the strategy (acceptable per hackathon scope)
- [ ] `NEXT_PUBLIC_API_URL` must be set in `.env.local` before any testing

## Sources

### Primary (HIGH confidence)
- [ai-sdk.dev/docs/ai-sdk-ui/chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot) — useChat v5 API, parts rendering, sendMessage pattern
- [ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) — Full useChat parameter and return type reference
- [ai-sdk.dev/cookbook/next/send-custom-body-from-use-chat](https://ai-sdk.dev/cookbook/next/send-custom-body-from-use-chat) — Custom body (userId) pattern
- [docs.world.org/mini-apps/commands/send-haptic-feedback](https://docs.world.org/mini-apps/commands/send-haptic-feedback) — sendHapticFeedback API
- [docs.world.org/mini-apps/commands/pay](https://docs.world.org/mini-apps/commands/pay) — MiniKit Pay command
- [docs.world.org/mini-apps/commands/share-contacts](https://docs.world.org/mini-apps/commands/share-contacts) — shareContacts command
- [docs.world.org/mini-apps/commands/request-permission](https://docs.world.org/mini-apps/commands/request-permission) — Permission request API
- [docs.world.org/mini-apps/commands/wallet-auth](https://docs.world.org/mini-apps/commands/wallet-auth) — Wallet auth/signing
- [npmjs.com/package/@ai-sdk/react](https://www.npmjs.com/package/@ai-sdk/react) — Version 3.0.148 confirmed
- Codebase: `apps/web/src/components/` — Existing Pay, Verify, ChatInterface, ProfileInterface code
- Codebase: `apps/api/src/routes/chat.ts` — Backend streaming endpoint using `toUIMessageStreamResponse()`
- Codebase: `apps/web/package.json` — Confirmed installed packages and versions

### Secondary (MEDIUM confidence)
- [ai-sdk.dev migration guide v5](https://ai-sdk.dev/docs/migration-guides/migration-guide-5-0#usechat-changes) — Breaking changes confirmation
- [github.com/remarkjs/react-markdown](https://github.com/remarkjs/react-markdown) — react-markdown v10 confirmed

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed via npm registry; packages are either already installed or have clear install paths
- Architecture: HIGH — based directly on AI SDK official docs + existing codebase code review
- Pitfalls: HIGH — v4 vs v5 migration docs explicitly document these breaking changes; MiniKit environment guard is documented in official docs
- MiniKit commands: HIGH — all fetched from official docs.world.org

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable libraries; MiniKit may update faster — check @worldcoin/minikit-js changelog if >2 weeks out)
