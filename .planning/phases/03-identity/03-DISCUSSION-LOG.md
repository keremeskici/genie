# Phase 3: Identity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 03-identity
**Areas discussed:** Verification flow, Action gating, Agent Kit classification, Proof storage
**Mode:** auto (all areas auto-selected, recommended defaults chosen)

---

## Verification Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /verify endpoint | IDKit proof validated via World ID Cloud API, nullifier stored in DB | ✓ |
| Middleware-based verification | Verify on every gated request (higher latency) | |
| Client-side only | Trust IDKit result without server validation (insecure) | |

**User's choice:** [auto] Dedicated /verify endpoint (recommended default)
**Notes:** Standard World ID integration pattern. Server-side validation is required for security. Nullifier hash stored in existing users.worldId column.

---

## Action Gating Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tool gating | Each tool checks isVerified before executing | ✓ |
| Route middleware | Auth middleware blocks gated endpoints | |
| Decorator pattern | Wrapper function adds verification to tools | |

**User's choice:** [auto] Per-tool gating (recommended default)
**Notes:** Simpler than middleware for tool-based architecture. Matches existing tool pattern where each tool handles its own validation. Clear error messages guide users to verify.

---

## World Agent Kit Classification

| Option | Description | Selected |
|--------|-------------|----------|
| Request-time classification | Check worldId in chat route, pass isHumanBacked flag | ✓ |
| Separate Agent Kit SDK | Full SDK integration with registration | |
| Post-hoc labeling | Label after response based on user's verified status | |

**User's choice:** [auto] Request-time classification (recommended default)
**Notes:** Lightweight approach for hackathon scope. Classification is a metadata flag, not a full SDK integration. Sufficient for WRID-05 requirement.

---

## Proof Storage & Session

| Option | Description | Selected |
|--------|-------------|----------|
| DB column (worldId presence) | Null = unverified, non-null = verified | ✓ |
| JWT claim | Verification encoded in session token | |
| Separate verification table | Track verification history with timestamps | |

**User's choice:** [auto] DB column presence (recommended default)
**Notes:** Already planned in Phase 2 schema design (D-01). No new tables needed. Context cache handles session-level caching.

---

## Claude's Discretion

- World ID Cloud API error handling details
- Verification endpoint response format
- System prompt verification status wording
- Whether to add verifiedAt timestamp column

## Deferred Ideas

None — discussion stayed within phase scope
