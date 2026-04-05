---
phase: 06-mini-app-shell
plan: "04"
subsystem: api
tags: [contact-tools, drizzle, ai-sdk, hono, nextjs, env-config]

# Dependency graph
requires:
  - phase: 06-mini-app-shell-01
    provides: Chat UI shell and DefaultChatTransport wiring
  - phase: 06-mini-app-shell-03
    provides: ContactCard component and parseContactList
  - phase: 02-data-layer
    provides: contacts DB table via @genie/db

provides:
  - NEXT_PUBLIC_API_URL env var so useChat DefaultChatTransport routes to Hono backend
  - createAddContactTool: validates 0x address format, inserts row into contacts table
  - createListContactsTool: queries all contacts for userId via eq filter
  - add_contact and list_contacts registered in agent/index.ts tool map
  - ContactCard selection wired back into conversation via sendMessage

affects: [06-mini-app-shell, financial-ops, contacts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Factory pattern for tool creation: createXxxTool(userId) returns ai.tool() instance
    - Prop-drilling onContactSelect from ChatInterface down to AiMessageBubble for session access

key-files:
  created:
    - apps/api/src/tools/add-contact.ts
    - apps/api/src/tools/list-contacts.ts
  modified:
    - apps/web/.env.local
    - apps/api/src/agent/index.ts
    - apps/web/src/components/ChatInterface/index.tsx

key-decisions:
  - "ContactCard onContactSelect prop-drilled from ChatInterface so session and sendMessage are available without Context API"
  - "add_contact does not require verification gate — saving contacts is ungated per plan spec"

patterns-established:
  - "Tool factory pattern: export function createXxxTool(userId: string) returning tool({ inputSchema: z.object(...), execute: async (...) => {} })"

requirements-completed: [MAPP-03, MAPP-04]

# Metrics
duration: 8min
completed: 2026-04-04
---

# Phase 06 Plan 04: Contact Tools and API URL Fix Summary

**NEXT_PUBLIC_API_URL env var added to unblock streaming; add_contact and list_contacts tool factories created, registered in agent, and ContactCard selection wired back into conversation via sendMessage**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T20:17:00Z
- **Completed:** 2026-04-04T20:25:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Added `NEXT_PUBLIC_API_URL=http://localhost:3001` to `apps/web/.env.local` so `DefaultChatTransport` in `useChat` routes to the Hono backend instead of a nonexistent Next.js route
- Created `createAddContactTool`: validates 0x wallet address format and inserts a contact row into the contacts DB table with `db.insert(contacts).values(...).returning()`
- Created `createListContactsTool`: queries all contacts for the authenticated user via `db.select().from(contacts).where(eq(contacts.ownerUserId, userId))`
- Registered both tools in `apps/api/src/agent/index.ts` with the same userId-gated factory pattern as existing tools
- Replaced `console.log` stub in `handleContactSelect` with `sendMessage` call passing selected contact name and wallet address back into the conversation
- `next build` completes without TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix NEXT_PUBLIC_API_URL env var and create add_contact + list_contacts tools** - `2beed40` (feat)
2. **Task 2: Register new tools in agent and wire contact selection in ChatInterface** - `6be9793` (feat)

## Files Created/Modified
- `apps/web/.env.local` - Appended `NEXT_PUBLIC_API_URL=http://localhost:3001` (gitignored, local only)
- `apps/api/src/tools/add-contact.ts` - createAddContactTool factory: validates address, inserts contact row
- `apps/api/src/tools/list-contacts.ts` - createListContactsTool factory: queries contacts by ownerUserId
- `apps/api/src/agent/index.ts` - Added imports and tool registration for add_contact and list_contacts
- `apps/web/src/components/ChatInterface/index.tsx` - Wired onContactSelect prop through AiMessageBubble to sendMessage

## Decisions Made
- `onContactSelect` is passed as a prop from `ChatInterface` down to `AiMessageBubble` so the callback has access to `sendMessage` and `session` from the parent scope — avoids adding a Context API dependency for a single callback
- `add_contact` has no verification gate (adding contacts is ungated — only financial transfers require World ID verification)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `apps/web/.env.local` is gitignored — only the tool files were committed; env var applied locally as intended

## User Setup Required
None - no external service configuration required. The `NEXT_PUBLIC_API_URL` env var is already written to `apps/web/.env.local` locally.

## Next Phase Readiness
- All Phase 06 plans complete: env config, contact resolution, contact CRUD, and MiniKit Pay/permissions are all wired
- Mini app shell is feature-complete for demo: chat streams to Hono backend, contacts can be added/listed/resolved, payments can be triggered via MiniKit Pay
- No known blocking issues

---
*Phase: 06-mini-app-shell*
*Completed: 2026-04-04*
