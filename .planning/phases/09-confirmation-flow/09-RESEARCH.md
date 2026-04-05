# Phase 9: Confirmation Flow - Research

**Researched:** 2026-04-05
**Domain:** React component authoring, JSON-block parsing, countdown timers, direct fetch to Hono API
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Inline chat card rendered inside the chat thread — amount, recipient, countdown timer, Confirm/Cancel buttons. No modal or bottom sheet.
- **D-02:** Card matches existing dark theme with neon blue accents (consistent with MAPP-02). No special warning/amber colors.
- **D-03:** After user action, card updates in-place: shows "Confirmed ✓" or "Cancelled" with buttons removed. Card stays in chat history.
- **D-04:** When countdown reaches 0, card updates to "Expired" state with buttons removed.
- **D-05:** Agent includes a ```json block with `{type: 'confirmation_required', txId, amount, recipient, recipientWallet, expiresInMinutes}` in its response text. ChatInterface parses this the same way it already parses `payment_confirmation` JSON blocks.
- **D-06:** System prompt updated to instruct the agent: when send_usdc returns confirmation_required, include the JSON block verbatim in the response.
- **D-07:** Live countdown timer on the confirm card (ticks down from expiresInMinutes). When it hits 0, card transitions to expired state.
- **D-08:** Cancel is local-only — card updates to "Cancelled" immediately. No backend call. The pending tx expires naturally after 15 min.
- **D-09:** After confirm, card updates in-place to "Sent $X USDC ✓" with truncated tx hash. Then agent sends a follow-up chat message confirming the transfer.
- **D-10:** Confirm button calls `POST /confirm` directly via fetch from the ConfirmCard component (no BFF proxy, no chat message). Uses session userId and txId from the card data.

### Claude's Discretion
- ConfirmCard component structure and internal state management
- Exact countdown timer implementation (setInterval vs requestAnimationFrame)
- Error handling for failed confirm calls (retry, error message in card)
- Loading state while confirm is in-flight (spinner on button, etc.)
- How the agent follow-up message is triggered after confirm succeeds

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOPS-05 | Transfers over threshold require explicit confirmation | Backend contract confirmed (send_usdc returns `confirmation_required`, POST /confirm executes); frontend JSON-block parser pattern confirmed; ConfirmCard state machine mapped |
</phase_requirements>

---

## Summary

Phase 9 is entirely a frontend wiring phase. The backend is complete: `send_usdc` already creates a pending DB row and returns `{type: 'confirmation_required', txId, amount, recipient, expiresInMinutes}`, and `POST /confirm` already executes the on-chain transfer given `{txId, userId}`. Zero backend changes are required for FOPS-05 — only the system prompt and the frontend need updating.

The frontend work follows an established pattern already present in the codebase: `AiMessageBubble` in `ChatInterface/index.tsx` strips a ````json` block from the agent text and renders a specialized component in its place. `ContactCard` is the reference implementation — `parseContactList()` detects `type: "contact_list"` and `ContactList` renders it. `ConfirmCard` is the second instance of this pattern, detecting `type: "confirmation_required"` and rendering an inline confirmation widget.

The only novel concern is the countdown timer: it must tear down its `setInterval` when the component unmounts or when the card transitions to a terminal state (confirmed/cancelled/expired), to prevent state updates on unmounted components.

**Primary recommendation:** Implement `ConfirmCard` as a self-contained component with internal state (`idle | loading | confirmed | cancelled | expired`), driven by a `useEffect`-based `setInterval` countdown. Wire it into `AiMessageBubble` alongside the existing `ContactList` branch.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19.2.4 | Component state, effects | Already installed |
| TypeScript | ^5 | Type safety for component props | Already installed |
| Tailwind CSS v4 | ^4 | Dark theme utility classes | Already installed, theme defined in globals.css |
| `useSession` from next-auth | ^5.0.0-beta.25 | Session userId for confirm fetch | Already used throughout ChatInterface |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@ai-sdk/react` | ^3.0.148 | `useChat` for follow-up message injection | Used by ChatInterface; if follow-up message triggers via `sendMessage` this is already available |
| `clsx` | ^2.1.1 | Conditional class names | Already installed; use for card state variants |

### No New Installs Required
This phase adds zero new dependencies. All libraries are already in `apps/web/package.json`.

---

## Architecture Patterns

### Confirmed Pattern: JSON-Block → Inline Component

`AiMessageBubble` already implements this pipeline:

1. Extract full text from `parts` array (filter `type === 'text'`)
2. `parseContactList(textContent)` — regex matches ` ```json\n...\n``` `, parses JSON, checks `type`
3. Strip the JSON block from `markdownText` via `.replace(/```json\s*\n[\s\S]*?\n```/, '')`
4. Render `<ReactMarkdown>` for stripped text AND `<ContactList>` for the data

`ConfirmCard` follows the identical pattern:
1. Add `parseConfirmCard(textContent)` function (same regex, check `type === 'confirmation_required'`)
2. In `AiMessageBubble`: detect `confirmData` alongside `contactData`
3. Strip the JSON block from `markdownText` (already done generically)
4. Render `<ConfirmCard data={confirmData} userId={...} />` below the markdown

**Key detail:** The regex `/```json\s*\n([\s\S]*?)\n```/` is already used in two places. Centralizing a `parseJsonBlock(text)` helper would DRY this up, but is at Claude's discretion.

### ConfirmCard State Machine

```
idle  ──[click Confirm]──>  loading  ──[fetch success]──>  confirmed
  │                              │
  │                         [fetch error]──>  error (retry available)
  │
  ├──[click Cancel]──>  cancelled
  │
  └──[countdown = 0]──>  expired
```

State transitions are one-way: once in `confirmed`, `cancelled`, or `expired`, no further changes. Buttons are rendered only in `idle` and `error` states.

### Countdown Timer Implementation

Use `setInterval` inside `useEffect`. Clean up on unmount and on terminal state:

```typescript
// Source: React docs — useEffect cleanup pattern
useEffect(() => {
  if (state !== 'idle') return;  // stop ticking after action taken
  const endTime = Date.now() + expiresInMinutes * 60 * 1000;

  const tick = () => {
    const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
    setSecondsLeft(remaining);
    if (remaining === 0) {
      setState('expired');
    }
  };
  tick(); // immediate first tick
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}, [state, expiresInMinutes]);
```

`requestAnimationFrame` is NOT appropriate here — it would fire 60x/second for a seconds-only display. `setInterval(1000)` is correct and standard.

### POST /confirm Integration

Direct fetch from `ConfirmCard` to the API backend (D-10). The backend is at `NEXT_PUBLIC_API_URL` (already used in `ChatInterface` as `API_URL`).

```typescript
// Source: apps/api/src/routes/confirm.ts — confirmed request/response contract
const res = await fetch(`${API_URL}/confirm`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ txId, userId }),
});

// Success response shape:
// { success: true, txHash: string, routeTxHash: string, amount: string, recipient: string }

// Error response shapes:
// 400: { error: 'txId is required' }
// 404: { error: 'Transaction not found' }
// 409: { error: 'Transaction already confirmed', txHash: string }
// 410: { error: 'Transaction expired' | 'Transaction is expired' | 'Transaction is failed' }
// 500: { error: 'TRANSFER_FAILED', message: string }
```

The `userId` must come from `useSession()`. `ConfirmCard` receives `userId` as a prop from `AiMessageBubble` (which already has `session` via `useSession`). Alternatively, `ConfirmCard` calls `useSession()` directly — either approach works.

### System Prompt Update

Add to `apps/api/src/prompts/system.md`:

```markdown
## Confirmation-Required Transfers

When send_usdc returns `{type: "confirmation_required", txId, amount, recipient, expiresInMinutes}`:
1. Include the JSON block verbatim in your response text, wrapped in ```json fences
2. Ask the user to confirm the transfer by tapping the Confirm button

Example:
```json
{"type":"confirmation_required","txId":"<txId>","amount":<amount>,"recipient":"<display name>","recipientWallet":"<0x...>","expiresInMinutes":15}
```
```

Note: `send_usdc` in the current codebase does NOT include `recipientWallet` in its return value (only `recipient` which is the wallet address used as display name). D-05 in CONTEXT.md adds `recipientWallet` to the JSON block — the ConfirmCard should gracefully handle its absence and fall back to `recipient` for display.

### Recommended Component Structure

```
apps/web/src/components/
└── ConfirmCard/
    └── index.tsx        # Self-contained: state, countdown, fetch, rendering
```

`ConfirmCard` receives:
```typescript
interface ConfirmCardProps {
  data: ConfirmCardData;  // { type, txId, amount, recipient, recipientWallet?, expiresInMinutes }
  userId: string;
}
```

### Tailwind Theme Reference

From `apps/web/src/app/globals.css`:
```
--color-background: #000000    (bg-background)
--color-surface: #171717       (bg-surface)
--color-text: #ffffff          (text-white)
--color-accent: #ccff00        (text-accent, bg-accent, border-accent)
```

Card container: `bg-surface p-5 rounded-t-2xl rounded-br-2xl` (matches `AiMessageBubble`)
Confirm button: `bg-accent text-black` (matches send button in ChatInterface)
Cancel button: `border border-white/20 text-white/70` (muted, non-destructive feel)

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Countdown seconds | Custom date math utility | `Math.floor((endTime - Date.now()) / 1000)` inline | Trivial one-liner — no abstraction needed |
| Conditional classes | Manual string concatenation | `clsx` (already installed) | Avoids template literal bugs with spaces |
| Session userId | Cookie parsing | `useSession()` from next-auth | Already the established pattern throughout the app |

**Key insight:** This phase is pure UI wiring. There are no novel technical problems that require external libraries.

---

## Common Pitfalls

### Pitfall 1: Memory Leak from Uncleaned setInterval
**What goes wrong:** `setInterval` keeps firing after the card transitions to `confirmed`/`cancelled`/`expired`. React 19 strict mode will log warnings; in production this silently updates state on an unmounted component.
**Why it happens:** `useEffect` cleanup only runs on unmount, not on internal state changes — unless `state` is in the dependency array.
**How to avoid:** Include `state` in the `useEffect` dependency array AND return `clearInterval` from the cleanup function. The `if (state !== 'idle') return;` guard at the top of the effect ensures the interval is not recreated in terminal states.
**Warning signs:** Timer keeps decrementing even after "Confirmed" appears; console shows "Warning: Can't perform a React state update on an unmounted component."

### Pitfall 2: JSON Block Not Stripped from Markdown
**What goes wrong:** The raw `\`\`\`json...` block appears in the chat text above the ConfirmCard.
**Why it happens:** The `markdownText` replacement in `AiMessageBubble` strips ONE json block via `.replace(...)`. If both `contactData` and `confirmData` are present simultaneously (unlikely but possible), only one block gets stripped.
**How to avoid:** Use `.replace(/\`\`\`json\s*\n[\s\S]*?\n\`\`\`/g, '')` (global flag) to strip all JSON blocks from the markdown text.
**Warning signs:** Users see raw `\`\`\`json` syntax in the chat bubble.

### Pitfall 3: Stale `expiresInMinutes` from Agent
**What goes wrong:** The agent says `expiresInMinutes: 15` but the card was delayed in streaming — the actual remaining time is less than 15 minutes.
**Why it happens:** `expiresInMinutes` in the tool return is a static value, not a computed remaining time. The `expiresAt` timestamp in the DB is authoritative.
**How to avoid:** The 15-minute window is generous for a hackathon demo. For production, the frontend would fetch remaining time from the backend. For this phase: accept the small inaccuracy, document it. The backend will reject expired txs regardless (time-based check in `confirm.ts` line 41).
**Warning signs:** Card shows "2 minutes remaining" but backend returns 410 when user clicks Confirm.

### Pitfall 4: `userId` Unavailable at Render Time
**What goes wrong:** `useSession()` returns `{ data: null }` during server-side render or before session hydrates. Confirm fetch sends `userId: null`, backend returns 400.
**Why it happens:** NextAuth session is async; `data` is `null` on first render.
**How to avoid:** Disable the Confirm button when `!userId`. Guard: `const userId = session?.user?.id`. If undefined, show loading spinner or disabled button.
**Warning signs:** Backend returns `{ error: 'userId is required' }` on first attempt.

### Pitfall 5: Card Rendered for Every Message Re-render
**What goes wrong:** If `AiMessageBubble` re-renders (e.g., due to new messages arriving), the `ConfirmCard` component re-mounts and resets its state.
**Why it happens:** React re-renders child components when parent re-renders, but preserves state as long as the component stays in the same position with the same `key`. The `messages.map` already uses `message.id` as key — so `AiMessageBubble` instances are stable. This pitfall is a non-issue as long as the existing `key={message.id}` pattern is preserved.
**Warning signs:** Countdown resets to 15:00 when a new message arrives.

---

## Code Examples

### parseConfirmCard (mirrors parseContactList exactly)
```typescript
// Source: apps/web/src/components/ContactCard/index.tsx — parseContactList pattern
export interface ConfirmCardData {
  type: 'confirmation_required';
  txId: string;
  amount: number;
  recipient: string;
  recipientWallet?: string;
  expiresInMinutes: number;
}

export function parseConfirmCard(text: string): ConfirmCardData | null {
  const jsonMatch = text.match(/```json\s*\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.type === 'confirmation_required' && parsed.txId && parsed.amount) {
      return parsed as ConfirmCardData;
    }
  } catch { /* not valid JSON, render as markdown */ }
  return null;
}
```

### AiMessageBubble integration (diff sketch)
```typescript
// Source: apps/web/src/components/ChatInterface/index.tsx lines 329-396
// Add alongside existing contactData detection:
const contactData = parseContactList(textContent);
const confirmData = parseConfirmCard(textContent);  // ADD

// Strip ALL json blocks from markdown (add global flag)
const markdownText = (contactData || confirmData)
  ? textContent.replace(/```json\s*\n[\s\S]*?\n```/g, '').trim()
  : textContent;

// In JSX, add below ReactMarkdown:
{confirmData && (
  <ConfirmCard
    data={confirmData}
    userId={session?.user?.id ?? ''}
  />
)}
```

Note: `AiMessageBubble` does not currently receive `session` as a prop. Two options:
1. Pass `userId` as a prop to `AiMessageBubble` from `ChatInterface` (where `session` is already available via `useSession`)
2. Call `useSession()` directly inside `ConfirmCard`

Option 2 is simpler — `ConfirmCard` is a client component and can call hooks directly.

### POST /confirm fetch with error handling
```typescript
// Source: apps/api/src/routes/confirm.ts — response contract
const handleConfirm = async () => {
  setState('loading');
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ''}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ txId: data.txId, userId }),
    });
    const json = await res.json();
    if (!res.ok) {
      // 409 = already confirmed (treat as success)
      if (res.status === 409) {
        setState('confirmed');
        setTxHash(json.txHash ?? '');
      } else if (res.status === 410) {
        setState('expired');
      } else {
        setError(json.message ?? json.error ?? 'Transfer failed');
        setState('error');
      }
      return;
    }
    setTxHash(json.txHash ?? '');
    setState('confirmed');
  } catch {
    setError('Network error — please try again');
    setState('error');
  }
};
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Modal dialogs for confirmation | Inline chat card (D-01) | Consistent with chat-first UX; no context switch |
| Re-render parent to show result | In-place card state update (D-03/D-09) | Preserves chat history; card stays as receipt |

---

## Open Questions

1. **Agent follow-up message after confirm (D-09)**
   - What we know: D-09 says "agent sends a follow-up chat message confirming the transfer" — but this is at Claude's discretion HOW to trigger it.
   - What's unclear: Is the follow-up triggered by `sendMessage()` (which starts a new agent loop), or is it synthesized locally in the UI (fake message)?
   - Recommendation: Synthesize a local success message in the ConfirmCard component itself after the fetch succeeds (e.g., append a `text-white/50 text-xs` note below the card: "Transfer submitted — the agent will confirm shortly"). Avoid triggering a full agent round-trip for a simple "Transfer confirmed" message. Keep it simple for hackathon scope.

2. **`recipientWallet` field in agent JSON block**
   - What we know: `send_usdc` currently returns `{type: 'confirmation_required', txId, amount, recipient, expiresInMinutes}` — `recipient` is the wallet address. D-05 adds `recipientWallet` but the backend tool does not yet emit it.
   - What's unclear: Is `recipientWallet` already added or does the plan need a task to update `send-usdc.ts`?
   - Recommendation: Check `apps/api/src/tools/send-usdc.ts` return at plan time. If `recipientWallet` is missing, add a task to return it alongside `recipient` (display name). The ConfirmCard should fall back to `recipient` for display if `recipientWallet` is absent.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is frontend-only with no new external dependencies. The backend API is already running and tested. No new CLI tools, databases, or services are introduced.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (apps/api) |
| Config file | `apps/api/vitest.config.ts` |
| Quick run command | `cd apps/api && npx vitest run src/routes/confirm.test.ts` |
| Full suite command | `cd apps/api && npx vitest run` |

Note: There is no test framework configured for `apps/web`. Frontend component tests (ConfirmCard) would require adding Vitest + jsdom + React Testing Library, which is out of scope for a hackathon. The existing `apps/api/src/routes/confirm.test.ts` covers the backend contract. Frontend correctness is validated by manual smoke test.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOPS-05 (backend) | POST /confirm executes pending tx and returns txHash | unit | `cd apps/api && npx vitest run src/routes/confirm.test.ts` | ✅ existing |
| FOPS-05 (frontend) | ConfirmCard renders from JSON block; Confirm/Cancel/Expired states | manual | Manual smoke test in World App | ❌ no web test infra |
| FOPS-05 (prompt) | System prompt instructs agent to emit JSON block | manual | Send over-threshold transfer in chat; verify JSON block appears | N/A |

### Sampling Rate
- **Per task commit:** `cd apps/api && npx vitest run src/routes/confirm.test.ts`
- **Per wave merge:** `cd apps/api && npx vitest run`
- **Phase gate:** API tests green + manual confirmation flow smoke test before `/gsd:verify-work`

### Wave 0 Gaps
- None for API tests — `confirm.test.ts` already exists
- Frontend: No automated test infra for React components — accepted for hackathon scope. Manual smoke test is the gate.

---

## Sources

### Primary (HIGH confidence)
- `apps/web/src/components/ChatInterface/index.tsx` — JSON-block parsing pattern, `AiMessageBubble` structure, `useSession` usage
- `apps/web/src/components/ContactCard/index.tsx` — `parseContactList` reference implementation
- `apps/api/src/routes/confirm.ts` — Backend contract: request shape `{txId, userId}`, response shapes for all status codes
- `apps/api/src/tools/send-usdc.ts` — Tool return value: `{type, txId, amount, recipient, expiresInMinutes}`
- `apps/api/src/prompts/system.md` — Current system prompt; confirms no confirmation block instruction exists yet
- `apps/web/src/app/globals.css` — Tailwind theme: `--color-accent: #ccff00`, `--color-surface: #171717`
- `apps/web/package.json` — Installed dependencies; confirms no new packages needed

### Secondary (MEDIUM confidence)
- React docs pattern for `useEffect` cleanup with `setInterval` — standard React idiom, widely documented
- `apps/api/vitest.config.ts` — Test runner config; confirms Vitest is the framework

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json; no new installs
- Architecture: HIGH — JSON-block parsing pattern confirmed by reading actual source; backend contract confirmed by reading actual source
- Pitfalls: HIGH — derived from reading existing code (cleanup patterns, null session timing, key stability)
- Validation: MEDIUM — existing confirm.test.ts confirmed; frontend test gap is a known accepted limitation

**Research date:** 2026-04-05
**Valid until:** 2026-04-20 (stable — no external dependencies)
