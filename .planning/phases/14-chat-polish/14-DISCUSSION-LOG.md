# Phase 14: Chat Interface Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 14-chat-polish
**Areas discussed:** Tool result rendering, Contact list system prompt format, Profile save wiring, Streaming polish
**Mode:** --auto (all decisions auto-selected)

---

## Tool Result Rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown text with existing cards | Tool results render as markdown; ContactList and ConfirmCard keep dedicated renderers | ✓ |
| New card components per tool | Create custom cards for balance, spending, debts | |
| Unified tool result card | Single generic card component for all tool outputs | |

**User's choice:** [auto] Markdown text with existing cards (recommended default)
**Notes:** No new components needed — existing ReactMarkdown handles tool output well. Only ContactList and ConfirmCard need special parsing.

---

## Contact List System Prompt Format

| Option | Description | Selected |
|--------|-------------|----------|
| Match existing parseContactList format | System prompt specifies exact JSON shape that ContactCard parser expects | ✓ |
| New format with migration | Define improved format and update both prompt and parser | |

**User's choice:** [auto] Match existing parseContactList format (recommended default)
**Notes:** Consistency with existing parser avoids frontend changes.

---

## Profile Save Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Direct API call with inline feedback | Call PATCH /api/users/profile, show success/error on existing button | ✓ |
| Optimistic update with background save | Update UI immediately, save in background | |
| Full form with validation | Add input validation, loading spinner, detailed error messages | |

**User's choice:** [auto] Direct API call with inline feedback (recommended default)
**Notes:** Endpoint already exists. ProfileInterface already has limitSaved state for feedback.

---

## Streaming Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Keep existing streaming as-is | Current token-by-token with ThinkingIndicator | ✓ |
| Add tool execution indicators | Show "checking balance..." during tool calls | |
| Progressive rendering | Show partial tool results as they stream | |

**User's choice:** [auto] Keep existing streaming as-is (recommended default)
**Notes:** Streaming works. Phase focus is tool result correctness, not streaming UX.

---

## Claude's Discretion

- Error handling details for profile save API call
- Minor system prompt wording improvements beyond contact_list format

## Deferred Ideas

None — discussion stayed within phase scope
