# Phase 7: API Wiring — Path Alignment + User Provisioning - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Frontend-to-backend integration works end-to-end. API paths match, user identity resolves to correct UUIDs, all chat/tool flows connect, and a simple onboarding flow provisions new users into the database.

</domain>

<decisions>
## Implementation Decisions

### User Provisioning
- **D-01:** Auth callback (NextAuth authorize) calls backend `POST /api/users/provision` to get-or-create user by wallet address. Returns UUID. Session always has a valid UUID from the start.
- **D-02:** Provisioning is idempotent get-or-create — if walletAddress exists, return existing UUID; if not, insert and return new UUID.
- **D-03:** Minimal user created during auth: walletAddress only, displayName null. Schema must make displayName nullable.
- **D-04:** If provisioning fails during auth, auth fails entirely — no session created. Prevents split state.
- **D-05:** Simple 2-step onboarding screens built in this phase (placeholder UI, will be polished later): Step 1 = enter display name, Step 2 = set auto-approve USDC threshold (default $25).
- **D-06:** Onboarding completion updates the existing user record (displayName, autoApproveUsd), does not create a new one.
- **D-07:** Display name should default to World username if available from MiniKit userInfo, otherwise null until user enters it in onboarding.

### Path Alignment
- **D-08:** Backend Hono routes get `/api` prefix — `app.route('/api', chatRoute)` etc. Frontend stays as-is (`${NEXT_PUBLIC_API_URL}/api/chat`).
- **D-09:** BFF verify-proof route stays — validates proof with worldcoin.org first, then forwards to backend `/api/verify`.
- **D-10:** New provisioning endpoint: `POST /api/users/provision` on the backend, called directly from auth callback (no BFF proxy needed — auth runs server-side).
- **D-11:** CORS middleware configured on Hono backend for frontend origin(s).
- **D-12:** Existing `GET /health` moves to `GET /api/health` for consistency. No additional probes needed.

### Identity Mapping
- **D-13:** `session.user.id` stores the UUID (not wallet address). `session.user.walletAddress` added as a separate field for the original 0x address.
- **D-14:** 0G KV keys switch from wallet address to UUID. Existing KV data keyed by wallet address is orphaned (acceptable for hackathon).
- **D-15:** `session.user.needsOnboarding` flag set to true when displayName is null. Frontend checks this client-side to redirect to onboarding screens. No extra API call on app launch.
- **D-16:** Auth callback provisions first (creates minimal user), then sets session fields (id=UUID, walletAddress=0x, needsOnboarding=bool).

### Error & Fallback Behavior
- **D-17:** Authentication required for chat — unauthenticated users see landing page, not chat. Simplifies backend (every /api/chat request has a valid userId).
- **D-18:** Backend unreachable → inline error message in chat thread ("Could not reach Genie. Try again.") with retry. Keeps user in context.
- **D-19:** Tool call failures (e.g., send_usdc on-chain error) surfaced through agent natural language response, not structured error cards.

### Claude's Discretion
- Health check implementation details
- CORS origin configuration specifics (dev vs production)
- Onboarding screen styling (placeholder — will be redesigned)
- Error message copy/wording

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Database Schema
- `apps/db/src/schema.ts` — Users table definition (id UUID PK, walletAddress, worldId, displayName, autoApproveUsd, createdAt). displayName needs to become nullable.

### Backend Routes
- `apps/api/src/routes/chat.ts` — Chat route, expects userId in body, resolves user from DB
- `apps/api/src/routes/verify.ts` — Verify route, expects UUID userId, updates worldId
- `apps/api/src/routes/confirm.ts` — Confirm route, expects UUID userId and txId
- `apps/api/src/index.ts` — Route mounting (currently at root `/`, needs `/api` prefix)

### Frontend Auth
- `apps/web/src/auth/index.ts` — NextAuth config, authorize callback, JWT/session callbacks. Currently sets session.user.id to wallet address — must change to UUID.

### Frontend Chat
- `apps/web/src/components/ChatInterface/index.tsx` — useChat with DefaultChatTransport, sends userId in body
- `apps/web/src/components/ContactCard/index.tsx` — Contact rendering and selection

### Agent & Tools
- `apps/api/src/agent/index.ts` — Tool registration, factory pattern with userId
- `apps/api/src/tools/add-contact.ts` — Requires valid UUID ownerUserId (FK constraint)
- `apps/api/src/tools/list-contacts.ts` — Queries by ownerUserId
- `apps/api/src/kv/memory.ts` — 0G KV operations, key format needs UUID

### Frontend Lib
- `apps/web/src/lib/minikit.ts` — MiniKit wallet auth, permission requests, userInfo extraction

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `DefaultChatTransport` from `@ai-sdk/react` — already configured for streaming, just needs correct URL
- NextAuth credentials provider — already handles SIWE verification, needs provisioning call added
- `resolveUserContext()` in chat route — already handles user lookup by ID, just needs correct UUID input
- Tool factory pattern (createAddContactTool, etc.) — already parameterized by userId, will work once UUID is correct

### Established Patterns
- BFF pattern: frontend → Next.js API route → backend (used for verify-proof, payment initiation)
- Direct pattern: frontend → backend (used for chat streaming via useChat)
- Tool registration: conditional on userId presence (no userId = no DB-dependent tools)
- Context cache: in-process Map with 30-min TTL keyed by userId

### Integration Points
- Auth callback → new backend provisioning endpoint (new connection)
- Session → useChat body.userId (existing, needs UUID instead of wallet)
- Session → BFF verify-proof → backend /api/verify (existing, needs UUID)
- Onboarding screens → backend update endpoint (new connection)
- App launch → session.needsOnboarding check → redirect (new)

</code_context>

<specifics>
## Specific Ideas

- Onboarding is a placeholder — 2 simple steps, will be redesigned later. Don't over-invest in UI.
- Display name pre-fills from World username (MiniKit userInfo) if available.
- The users.displayName column must become nullable to support the "provisioned but not onboarded" state.

</specifics>

<deferred>
## Deferred Ideas

- **Full onboarding UI polish** — proper design, animations, branding. This phase builds functional placeholder screens only.
- **Profile editing screen** — let users change display name and auto-approve limit after initial setup.

</deferred>

---

*Phase: 07-api-wiring*
*Context gathered: 2026-04-04*
