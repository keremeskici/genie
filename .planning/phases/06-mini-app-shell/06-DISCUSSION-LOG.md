# Phase 6: Mini App Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 06-mini-app-shell
**Areas discussed:** API & Streaming Integration, Chat UX Polish, Contact Management, MiniKit 2.0 Integration

---

## API & Streaming Integration

### API Connection Method

| Option | Description | Selected |
|--------|-------------|----------|
| Vercel AI SDK useChat (Recommended) | Use @ai-sdk/react useChat hook — handles streaming, message state, abort, and retry out of the box | ✓ |
| Custom fetch + ReadableStream | Manual fetch with streaming response parsing. More control, more code | |
| You decide | Claude picks based on existing backend setup | |

**User's choice:** Vercel AI SDK useChat
**Notes:** None

### Streaming Render Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Token-by-token append | Each token appends to the AI message bubble as it arrives | ✓ |
| Chunked reveal | Buffer a few tokens, then reveal in small chunks | |
| You decide | Claude picks the smoothest approach | |

**User's choice:** Token-by-token append
**Notes:** None

### Error Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error + retry button | Show error message in chat thread with a Retry button | ✓ |
| Toast notification | Show toast/banner at top, keep chat thread clean | |
| You decide | Claude picks the pattern that fits | |

**User's choice:** Inline error + retry button
**Notes:** None

### Loading Indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Animated dots in AI bubble | Genie message bubble with pulsing dots, replaced by actual response | ✓ |
| Skeleton shimmer | Shimmer/skeleton placeholder in AI message area | |
| You decide | Claude picks what feels best | |

**User's choice:** Animated dots in AI bubble
**Notes:** None

---

## Chat UX Polish

### Message Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown with react-markdown (Recommended) | Parse AI responses as markdown — supports bold, lists, code blocks. Eliminates XSS risk | ✓ |
| Plain text only | Render as plain text — simplest, safest, but no formatting | |
| You decide | Claude picks safest approach that looks good | |

**User's choice:** Markdown with react-markdown
**Notes:** None

### Rich Message Types

| Option | Description | Selected |
|--------|-------------|----------|
| Text + insight cards (keep existing) | Keep existing AiInsight cards for balance, spending summaries | ✓ |
| Text only for now | Strip insight cards, keep it simple | |
| You decide | Claude decides based on backend | |

**User's choice:** Text + insight cards (keep existing)
**Notes:** None

### Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Genie greeting + suggestion chips | Welcome message and tappable suggestion chips | |
| Simple greeting message | Existing "Hi! How can I help you?" message | |
| You decide | Claude picks for hackathon demo | |

**User's choice:** Other — keep existing UI elements
**Notes:** "you can keep the current UI elements for this, we have something that is already built now"

---

## Contact Management

### Contact UX Model

| Option | Description | Selected |
|--------|-------------|----------|
| Chat-only (Recommended) | All contact ops through natural language via AI agent. No dedicated contacts page | ✓ |
| Dedicated contacts page | Separate /contacts route with add/edit/delete UI | |
| Both — chat + simple list page | Chat commands plus read-only contacts list under Profile | |

**User's choice:** Chat-only
**Notes:** None

### Ambiguous Match Resolution

| Option | Description | Selected |
|--------|-------------|----------|
| Inline numbered list in chat | Agent responds with numbered text list, user types number | |
| Tappable contact cards | Mini contact cards the user can tap to select | ✓ |
| You decide | Claude picks for hackathon scope | |

**User's choice:** Tappable contact cards
**Notes:** None

---

## MiniKit 2.0 Integration

### Integration Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal — just load in World App (Recommended) | Ensure app loads without errors, safe area insets, basic validation | |
| Full integration | MiniKit Pay, wallet signing, haptics, native UI, permissions | ✓ |
| You decide | Claude picks for 36-hour hackathon | |

**User's choice:** Full integration
**Notes:** None

### MiniKit Features (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| MiniKit Pay | Native payment flow for USDC transfers | ✓ |
| Wallet signing (transactions) | On-chain transaction signing via World App wallet | ✓ |
| Haptics & native UI | Haptic feedback, native share sheets | ✓ |
| Permission requests | Wallet address, username, profile picture permissions | ✓ |

**User's choice:** All features selected
**Notes:** None

### World ID Verify Location

| Option | Description | Selected |
|--------|-------------|----------|
| Agent prompts, inline verify button | Verify button renders inline in chat | |
| Verify on profile page | Navigate to Profile tab, tap verify button | ✓ |
| Both available | Profile page and inline in chat | |

**User's choice:** Verify on profile page
**Notes:** None

### API Base URL

| Option | Description | Selected |
|--------|-------------|----------|
| Environment variable | NEXT_PUBLIC_API_URL env var | ✓ |
| Next.js API route proxy | /api/* routes proxy to Hono backend | |
| You decide | Claude picks simplest approach | |

**User's choice:** Environment variable
**Notes:** None

---

## Claude's Discretion

- useChat configuration details (API route path, headers, body format)
- react-markdown plugins and styling
- Tappable contact card component design
- MiniKit Pay vs smart contract flow coordination
- Haptic trigger mapping
- Safe area inset handling
- Permission request flow integration with onboarding

## Deferred Ideas

None — discussion stayed within phase scope
