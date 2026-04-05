# Phase 11: Live Balance Display - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 11-live-balance
**Areas discussed:** Balance refresh strategy, Loading & error states, Balance formatting
**Mode:** --auto (all decisions auto-selected)

---

## Balance Refresh Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Fetch on page load only | Simple useEffect fetch on mount, refetch after transactions | ✓ |
| Poll every N seconds | setInterval polling for real-time updates | |
| WebSocket / SSE | Push-based updates from backend | |

**User's choice:** [auto] Fetch on page load only (recommended default)
**Notes:** Success criteria says "refreshes on page load and after transactions" — mount fetch + post-transaction refetch covers both. Polling/WebSocket adds complexity with no demo value.

---

## Loading & Error States

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton/shimmer placeholder | Animated placeholder while loading | ✓ |
| Spinner | Loading spinner in balance area | |
| Show $0.00 until loaded | No loading indicator | |

**User's choice:** [auto] Skeleton/shimmer placeholder (recommended default)

| Option | Description | Selected |
|--------|-------------|----------|
| Show $--.-- fallback | Non-disruptive error state, no retry | ✓ |
| Show error message with retry | Explicit error with retry button | |
| Keep showing last known balance | Cache previous value | |

**User's choice:** [auto] Show $--.-- fallback (recommended default)
**Notes:** Dashboard remains functional even if balance fetch fails. Non-disruptive for demo.

---

## Balance Formatting

| Option | Description | Selected |
|--------|-------------|----------|
| $X.XX (2 decimals) | Standard USD money format | ✓ |
| $X.XXXXXX (6 decimals) | Full USDC precision | |
| Adaptive decimals | Show more decimals for small amounts | |

**User's choice:** [auto] $X.XX — 2 decimal places (recommended default)
**Notes:** USDC is 1:1 USD stablecoin. Standard money formatting is intuitive. No thousand separators needed for hackathon demo balances.

---

## Claude's Discretion

- Skeleton animation style
- Data-fetching pattern (SWR vs useState+useEffect)
- Error logging approach
- Loading skeleton placement

## Deferred Ideas

None — discussion stayed within phase scope
