# Phase 6: Mini App Shell - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

The Next.js Mini App runs inside World App with a fully functional chat interface, streaming AI responses, contact management, and full MiniKit 2.0 SDK integration. This phase wires the existing frontend scaffold (`apps/web`) to the Hono backend API (`apps/api`), adds streaming rendering, replaces unsafe HTML injection with markdown parsing, integrates MiniKit payment/signing/haptics/permissions, and enables chat-based contact management. Delivered in `apps/web`.

Active requirements: MAPP-01, MAPP-02, MAPP-03, MAPP-04

</domain>

<decisions>
## Implementation Decisions

### API & Streaming Integration
- **D-01:** Use Vercel AI SDK `@ai-sdk/react` `useChat` hook to connect ChatInterface to the backend `/api/chat` Hono endpoint. Handles streaming, message state, abort, and retry out of the box.
- **D-02:** Token-by-token streaming render — each token appends to the AI message bubble as it arrives (ChatGPT-style).
- **D-03:** API errors show inline in the chat thread with a "Retry" button on the failed message. No toasts.
- **D-04:** Animated dots ("...") in a Genie AI bubble as thinking indicator while waiting for the first token. Gets replaced by actual response once tokens start streaming.
- **D-05:** API base URL configured via `NEXT_PUBLIC_API_URL` environment variable pointing to the Hono backend.

### Chat UX Polish
- **D-06:** Replace `dangerouslySetInnerHTML` with `react-markdown` for AI message rendering — supports bold, lists, code blocks, and eliminates XSS risk.
- **D-07:** Keep existing AiInsight cards (label/value pairs below messages) for structured data like balance, spending summaries.
- **D-08:** Preserve existing empty state and UI elements — no redesign of the current chat layout, greeting, or Genie avatar treatment.

### Contact Management
- **D-09:** Chat-only contact management — all contact operations (add, list, resolve) through natural language via the AI agent. No dedicated contacts page.
- **D-10:** Ambiguous contact matches render as tappable contact cards in the chat. Backend tool returns structured contact data; frontend renders interactive mini cards the user can tap to select.

### MiniKit 2.0 Integration
- **D-11:** Full MiniKit SDK integration — MiniKit Pay, wallet signing (transaction commands), haptic feedback, native UI elements, and permission requests.
- **D-12:** MiniKit Pay for USDC transfers — triggers World App's built-in payment UX for the send flow.
- **D-13:** Wallet signing via MiniKit wallet commands for on-chain transaction signing through World App wallet.
- **D-14:** Haptic feedback on key actions (send confirmed, error, etc.) and native share sheets where applicable.
- **D-15:** Permission requests for wallet address, username, and profile picture via MiniKit SDK.
- **D-16:** World ID verification lives on the Profile page — user navigates to Profile tab and taps "Verify with World ID" button. Agent directs unverified users there when they attempt gated actions.

### Claude's Discretion
- Exact `useChat` configuration (API route path, headers, body format)
- react-markdown plugins and styling approach
- Tappable contact card component design and interaction
- MiniKit Pay vs direct smart contract flow coordination
- How haptic triggers map to user actions
- Safe area inset handling for World App shell
- How permission request flow integrates with onboarding

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### MiniKit SDK
- `https://docs.world.org/mini-apps` — MiniKit 2.0 SDK docs, Mini App requirements, permissions, payment flows
- `https://docs.world.org/mini-apps/quick-start/installing` — MiniKit installation and setup
- `https://docs.world.org/mini-apps/commands/pay` — MiniKit Pay command reference
- `https://docs.world.org/mini-apps/commands/wallet-auth` — Wallet signing/auth commands
- `https://docs.world.org/mini-apps/commands/verify` — World ID verification via MiniKit

### Vercel AI SDK
- `https://sdk.vercel.ai/docs/reference/ai-sdk-react/use-chat` — useChat hook reference for streaming chat UI

### Existing Code
- `apps/web/src/components/ChatInterface/index.tsx` — Current chat UI (local state, no API wiring, dangerouslySetInnerHTML to replace)
- `apps/web/src/providers/index.tsx` — MiniKitProvider + SessionProvider already configured
- `apps/web/src/app/(protected)/layout.tsx` — Protected layout with Navigation footer
- `apps/web/src/components/Navigation/index.tsx` — Tab navigation (Dashboard, Chat, Profile)
- `apps/web/src/app/globals.css` — Theme tokens (background, surface, accent)
- `apps/web/src/app/(protected)/chat/page.tsx` — Chat page route
- `apps/web/src/app/(protected)/profile/page.tsx` — Profile page (World ID verify button goes here)
- `apps/api/src/routes/chat.ts` — Backend chat endpoint (streaming via toUIMessageStreamResponse)
- `apps/api/src/agent/index.ts` — Agent orchestrator with registered tools

### Prior Context
- `.planning/phases/04-financial-ops/04-CONTEXT.md` — Smart contract architecture, confirmation flow (D-10 through D-13)
- `.planning/phases/03-identity/03-CONTEXT.md` — World ID verification gating, requireVerified pattern
- `.planning/phases/05-cross-chain-social/05-CONTEXT.md` — Spending/debt tools the chat UI will surface

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatInterface` component — Message bubbles, input bar, keyboard-aware positioning, Genie avatar. Needs API wiring and markdown rendering.
- `AiInsight` type and insight card grid — Already renders label/value pairs below AI messages.
- `MiniKitProvider` — Already wrapping the app in providers/index.tsx.
- `Navigation` component — 3-tab nav (Dashboard, Chat, Profile) with animated indicator.
- `Page` + `Page.Footer` layout components from `@/components/PageLayout`.
- `AuthButton`, `Verify`, `Pay`, `WalletInterface` components — Existing component directories to build on.
- `@worldcoin/mini-apps-ui-kit-react` — Installed, imported in layout. Provides World-native UI components.
- `@worldcoin/idkit` v4.0 — Installed for World ID verification widget.

### Established Patterns
- Tailwind v4 with `@theme inline` custom tokens (--color-background, --color-surface, --color-accent)
- Plus Jakarta Sans for headlines, Manrope for body text
- Material Symbols Outlined for icons
- Dark theme: black background, #171717 surface, #ccff00 accent
- `use client` directive on interactive components
- next-auth for session management

### Integration Points
- `ChatInterface` — Wire `useChat` hook to `NEXT_PUBLIC_API_URL/api/chat`
- Profile page — Add World ID verify button using IDKit widget
- Agent tools return structured data (contacts, confirmations) — frontend needs to render these as interactive elements
- MiniKit Pay command replaces/augments the backend confirmation flow for transfers

</code_context>

<specifics>
## Specific Ideas

- Full MiniKit integration is the differentiator for the hackathon — MiniKit Pay, wallet signing, haptics, and permissions show deep World App integration
- Tappable contact cards for disambiguation make the chat feel native and interactive, not just text
- The verify flow is on Profile page, not inline in chat — keeps the chat clean and puts verification in a deliberate location
- react-markdown replaces the XSS-vulnerable dangerouslySetInnerHTML — security fix and UX improvement in one

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-mini-app-shell*
*Context gathered: 2026-04-04*
