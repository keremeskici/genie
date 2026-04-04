---
phase: 06-mini-app-shell
plan: 02
subsystem: ui
tags: [minikit, worldcoin, contact-cards, haptics, next-auth, verify]

# Dependency graph
requires:
  - phase: 06-01
    provides: ChatInterface with useChat v5 and AiMessageBubble parts rendering
  - phase: 03-identity
    provides: /api/verify endpoint that accepts nullifier_hash + userId
provides:
  - ContactCard component for tappable contact disambiguation in chat
  - parseContactList function to detect json fenced contact_list in AI messages
  - ProfileInterface Identity section with Verify component
  - verify-proof route persisting nullifier_hash to Genie backend
affects: [06-03]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - MiniKit.isInstalled() guard before all MiniKit API calls
    - parseContactList: regex-based JSON fence detection in AI message text
    - Contact disambiguation: AI returns contact_list JSON block, frontend strips fence and renders cards
    - Backend persistence in Next.js API route: call Genie backend after successful Worldcoin verify

key-files:
  created:
    - apps/web/src/components/ContactCard/index.tsx
  modified:
    - apps/web/src/components/ChatInterface/index.tsx
    - apps/web/src/components/ProfileInterface/index.tsx
    - apps/web/src/app/api/verify-proof/route.ts

key-decisions:
  - "ContactCard handleTap fires selection-changed haptic guarded by MiniKit.isInstalled()"
  - "handleSend fires impact haptic (style: medium) guarded by MiniKit.isInstalled() before sendMessage"
  - "parseContactList uses regex /```json\\s*\\n([\\s\\S]*?)\\n```/ to detect contact list blocks"
  - "AiMessageBubble strips JSON fence from markdownText when contactData detected"
  - "verify-proof route uses auth() from NextAuth v5 to get server-side userId for backend persistence"
  - "Backend persistence failure in verify-proof is swallowed — verification is not blocked"

patterns-established:
  - "ContactCard pattern: AI returns structured JSON fenced block -> frontend detects and renders interactive cards"
  - "MiniKit guard pattern: if (MiniKit.isInstalled()) { await MiniKit.sendHapticFeedback(...) }"

requirements-completed: [MAPP-01, MAPP-04]

# Metrics
duration: 15min
completed: 2026-04-04
---

# Phase 06 Plan 02: Mini App Shell — Contact Cards, Profile Verify, and Haptics Summary

**ContactCard component with JSON-fence detection in chat, World ID verify section in Profile, and MiniKit haptics on send and contact tap**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-04T19:50:00Z
- **Completed:** 2026-04-04T20:05:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created ContactCard component with tappable cards, avatar, name, address/username display, and MiniKit selection-changed haptic
- ChatInterface AiMessageBubble now detects ```json contact_list fenced blocks, strips them from markdown, and renders ContactList
- handleSend fires MiniKit impact haptic before sending message (guarded by isInstalled)
- ProfileInterface has a prominent Identity section with the existing Verify component
- verify-proof route now persists nullifier_hash + userId to Genie backend /api/verify after Worldcoin verification

## Task Commits

Each task was committed atomically:

1. **Task 1: ContactCard component and contact detection in ChatInterface** - `335d6ea` (feat)
2. **Task 2: World ID verify in ProfileInterface + backend persistence** - `5613118` (feat)

**Plan metadata:** TBD (docs: complete plan)

## Files Created/Modified
- `apps/web/src/components/ContactCard/index.tsx` - ContactCard, ContactList, ContactData types, parseContactList function
- `apps/web/src/components/ChatInterface/index.tsx` - Added MiniKit import, ContactList/parseContactList integration, haptic on send
- `apps/web/src/components/ProfileInterface/index.tsx` - Added Identity section with Verify component
- `apps/web/src/app/api/verify-proof/route.ts` - Added backend persistence via NEXT_PUBLIC_API_URL + auth() session

## Decisions Made
- ContactCard uses MiniKit selection-changed haptic on tap; all calls guarded by isInstalled()
- AiMessageBubble strips the JSON fence when contactData detected so markdown doesn't show raw JSON
- handleContactSelect logs to console (hackathon scope — production would feed selection back into sendMessage)
- verify-proof route catches backend persistence errors gracefully — Worldcoin verification is the source of truth
- auth() from NextAuth v5 is available server-side in Next.js route handlers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm install needed before next build**
- **Found during:** Task 1 (build verification)
- **Issue:** Build failed with "Can't resolve '@ai-sdk/react'" — packages not installed yet
- **Fix:** Ran `pnpm install` at monorepo root to install missing packages
- **Files modified:** pnpm-lock.yaml (updated)
- **Verification:** Build succeeded after install
- **Committed in:** 335d6ea (included in task commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Required install step not in plan but essential for build to succeed. No scope creep.

## Issues Encountered
- Build failing due to missing node_modules — resolved by running pnpm install at monorepo root

## Known Stubs
- ContactCard onSelect handler logs to console only — in production this would feed contact selection back into sendMessage flow
- ProfileInterface display name and spending limit save buttons still have TODO comments (pre-existing from Plan 01)

## Next Phase Readiness
- ContactCard pattern ready for 06-03 if any additional interactive card types needed
- World ID verify flow complete end-to-end: IDKit -> /api/verify-proof -> Genie backend /api/verify
- MiniKit haptic pattern established for all interactive elements

## Self-Check: PASSED

All created files verified on disk. All task commits (335d6ea, 5613118) confirmed in git log.

---
*Phase: 06-mini-app-shell*
*Completed: 2026-04-04*
