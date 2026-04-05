# Phase 7: API Wiring — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 07-api-wiring
**Areas discussed:** User provisioning strategy, Path alignment approach, Identity mapping flow, Error & fallback behavior

---

## User Provisioning Strategy

### When to create DB user record

| Option | Description | Selected |
|--------|-------------|----------|
| During auth callback | NextAuth authorize() calls backend to get-or-create user, returns UUID | |
| Lazy on first chat | Backend /chat creates user if not found | |
| Dedicated /provision endpoint | Separate BFF route called after wallet connect | |

**User's choice:** During auth callback (initially selected)
**Notes:** User later clarified that the app should check if user exists on launch, redirect to onboarding if not. New user creation happens at end of onboarding. Since onboarding UI doesn't exist yet, auth callback creates minimal user as stopgap.

### Provisioning call path

| Option | Description | Selected |
|--------|-------------|----------|
| Direct backend call | Auth callback calls backend POST /users/provision directly | ✓ |
| Via BFF proxy route | Auth callback → /api/provision-user → backend | |

**User's choice:** Direct backend call
**Notes:** Auth runs server-side, no CORS issues.

### User fields at provisioning

| Option | Description | Selected |
|--------|-------------|----------|
| walletAddress + displayName | Only required fields without defaults | |
| You decide | Claude picks | |

**User's choice:** walletAddress, displayName (from World username if available, null otherwise — schema needs nullable), autoApproveUsd with default $25.
**Notes:** User wants display name to be their World username if available, null otherwise until they set it in onboarding.

### Onboarding steps

| Option | Description | Selected |
|--------|-------------|----------|
| Welcome + Display name | Step 1: welcome, Step 2: enter name | |
| Display name + Auto-approve limit | Step 1: name, Step 2: approval threshold | ✓ |
| Display name + World ID verify | Step 1: name, Step 2: verify (skippable) | |

**User's choice:** Display name + Auto-approve limit
**Notes:** Simple 2-step placeholder, will be adjusted in the future.

### Auth failure on provisioning error

| Option | Description | Selected |
|--------|-------------|----------|
| Fail auth entirely | No session if provisioning fails | ✓ |
| Session with wallet only | Allow session, retry later | |

**User's choice:** Fail auth entirely

### Idempotency

**User's choice:** Get-or-create semantics (clarified through discussion)
**Notes:** User described onboarding-first flow. Since onboarding is deferred, auth callback get-or-creates as stopgap.

---

## Path Alignment Approach

### API path alignment

| Option | Description | Selected |
|--------|-------------|----------|
| Add /api prefix to backend | Mount Hono routes under /api | ✓ |
| Strip /api from frontend | Change frontend calls | |
| BFF proxies everything | All calls through Next.js routes | |

**User's choice:** Add /api prefix to backend

### Verify-proof BFF route

| Option | Description | Selected |
|--------|-------------|----------|
| Keep BFF route | BFF validates with worldcoin.org, then forwards | ✓ |
| Frontend calls backend directly | Remove BFF middleman | |

**User's choice:** Keep BFF route

### Provisioning endpoint path

| Option | Description | Selected |
|--------|-------------|----------|
| POST /api/users/provision | RESTful, under /api | ✓ |
| POST /api/provision | Flatter path | |

**User's choice:** POST /api/users/provision

### CORS configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Configure CORS on backend | Hono CORS middleware for frontend origin | ✓ |
| You decide | Claude picks | |

**User's choice:** Configure CORS on backend

### Health check

| Option | Description | Selected |
|--------|-------------|----------|
| Existing /health is fine | Move to /api/health, keep simple | ✓ |
| Add DB connectivity check | Extend to verify Supabase | |

**User's choice:** Existing /health is fine, move to /api/health

---

## Identity Mapping Flow

### UUID storage in session

| Option | Description | Selected |
|--------|-------------|----------|
| session.user.id = UUID | Replace wallet with UUID, add walletAddress field | ✓ |
| session.user.dbId = UUID | Keep id as wallet, add new field | |

**User's choice:** session.user.id = UUID

### 0G KV key format

| Option | Description | Selected |
|--------|-------------|----------|
| Use UUID consistently | All KV keys use UUID, orphan old data | ✓ |
| Keep wallet address for KV | Look up wallet from UUID for KV ops | |

**User's choice:** Use UUID consistently

### Onboarding flow wallet source

| Option | Description | Selected |
|--------|-------------|----------|
| Auth provisions, onboarding updates | Minimal user at auth, onboarding updates fields | ✓ |
| Auth sets temp session, onboarding creates | UUID only available after onboarding | |

**User's choice:** Auth callback provisions, onboarding updates

### Onboarding detection

| Option | Description | Selected |
|--------|-------------|----------|
| Session field | session.user.needsOnboarding when displayName null | ✓ |
| Backend endpoint | GET /api/users/me on load | |

**User's choice:** Session field

---

## Error & Fallback Behavior

### Backend unreachable

| Option | Description | Selected |
|--------|-------------|----------|
| Inline error in chat | Styled error message in chat thread with retry | ✓ |
| Toast/banner notification | Top banner, chat stays clean | |

**User's choice:** Inline error in chat

### Anonymous chat access

| Option | Description | Selected |
|--------|-------------|----------|
| No — require auth | Chat page requires session | ✓ |
| Yes — limited anonymous | Allow chatting, disable user-dependent tools | |

**User's choice:** No — require auth for chat

### Tool call failure surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Agent explains in natural language | Tool returns error, agent incorporates conversationally | ✓ |
| Structured error card | Distinct error UI component | |

**User's choice:** Agent explains in natural language

---

## Claude's Discretion

- Health check implementation details
- CORS origin configuration specifics
- Onboarding screen styling
- Error message copy/wording

## Deferred Ideas

- Full onboarding UI polish — proper design, animations, branding
- Profile editing screen — change display name and auto-approve limit after setup
