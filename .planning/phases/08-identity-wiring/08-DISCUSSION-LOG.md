# Phase 8: Identity Wiring — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 08-identity-wiring
**Areas discussed:** Verify flow fix, Auth redirect gaps, isVerified awareness, RP signature flow

---

## Verify Flow Fix

### Action String Management

| Option | Description | Selected |
|--------|-------------|----------|
| Single env var | Use NEXT_PUBLIC_WORLD_ACTION on frontend, WORLD_ACTION on backend — both set to the same value | ✓ |
| Frontend sends, backend trusts | Frontend sends action string with proof, backend uses whatever was sent | |
| You decide | Claude picks safest and simplest approach | |

**User's choice:** Single env var (Recommended)
**Notes:** None

### Double Validation Dedup

| Option | Description | Selected |
|--------|-------------|----------|
| BFF validates, backend trusts | BFF calls World ID Cloud API. If valid, forwards just nullifier_hash + userId to backend for DB storage | ✓ |
| Backend validates only | BFF forwards raw proof to backend, backend does Cloud API call and DB storage | |
| Keep both (current) | Both BFF and backend validate with World ID | |

**User's choice:** BFF validates, backend trusts (Recommended)
**Notes:** None

---

## Auth Redirect Gaps

### Auth Enforcement Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Middleware redirects | Middleware checks session and redirects unauthenticated users to '/' for protected paths | ✓ |
| Layout-only redirect | Keep middleware as session-attacher only, (protected) layout handles all redirects | |
| You decide | Claude picks the approach that closes bug #5 most reliably | |

**User's choice:** Middleware redirects (Recommended)
**Notes:** None

### Public Paths

| Option | Description | Selected |
|--------|-------------|----------|
| Landing + auth + API routes | Public: '/', '/api/auth/*', '/api/verify-proof', '/api/rp-signature', static assets | ✓ |
| Minimal public | Only '/' and '/api/auth/*' are public | |
| You decide | Claude determines right set of public paths | |

**User's choice:** Landing + auth + API routes (Recommended)
**Notes:** None

---

## isVerified Awareness

### Frontend Verification State

| Option | Description | Selected |
|--------|-------------|----------|
| Local state after success | Verify component sets isVerified=true in React context/state after success response | ✓ |
| Refresh session | After verification, call session refresh endpoint to update JWT with isVerified | |
| Add isVerified to session | Add isVerified to JWT/session from the start, trigger session update after verify | |
| You decide | Claude picks simplest approach for hackathon scope | |

**User's choice:** Local state after success (Recommended)
**Notes:** None

---

## RP Signature Flow

### Endpoint Location

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js API route | Create /api/rp-signature as BFF route, signs with WORLD_DEV_PORTAL_API_KEY server-side | ✓ |
| Backend Hono route | Add /api/rp-signature to Hono backend, frontend calls directly | |
| You decide | Claude picks based on key safety and simplicity | |

**User's choice:** Next.js API route (Recommended)
**Notes:** None

### RP Endpoint Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Requires session | Only authenticated users can request RP signatures | ✓ |
| Public endpoint | Anyone can request RP signature | |
| You decide | Claude picks based on security vs simplicity | |

**User's choice:** Requires session (Recommended)
**Notes:** None

---

## Claude's Discretion

- RP signature response format and caching strategy
- Exact middleware path matching implementation
- Error handling details for RP signature failures
- Rate limiting for RP signature endpoint

## Deferred Ideas

None — discussion stayed within phase scope
