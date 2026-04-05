# Phase 2: Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 02-data-layer
**Areas discussed:** Supabase Schema Design, 0G KV Agent Memory, Context Loading Flow, User Bootstrap

---

## Supabase Schema Design

### User Identity

| Option | Description | Selected |
|--------|-------------|----------|
| Wallet address as PK | Users exist as soon as they connect. World ID added later. Simplest. | |
| UUID PK + wallet column | Internal UUID as primary key, wallet as unique column. More flexible. | |
| (User clarification) | UUID PK, wallet address required, World ID nullable — added on verification | ✓ |

**User's choice:** UUID as primary key, wallet address as required unique column, World ID nullable (added when verified). User clarified that World App provides identity context and users should be created after onboarding.
**Notes:** User specified this directly rather than picking from options.

### Contacts Model

| Option | Description | Selected |
|--------|-------------|----------|
| Simple: name + wallet | Display name mapped to wallet address. Minimal. | |
| Linked: reference other users | Link to Genie users by wallet match, fallback to raw address + name | ✓ |
| You decide | Claude picks based on downstream needs | |

**User's choice:** Linked — contacts reference other Genie users when possible.

### Transaction Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Genie-only | Only track Genie-initiated transfers. No indexer needed. | ✓ |
| All on-chain | Index all USDC transfers. Full spending summaries but complex. | |
| You decide | Claude picks pragmatic approach | |

**User's choice:** Genie-only — no on-chain indexing.

### Migration Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Push (no files) | drizzle-kit push syncs directly. Fastest iteration. | ✓ |
| Migration files | Generate SQL migration files. Safer but more ceremony. | |
| You decide | Claude picks for hackathon | |

**User's choice:** Push — no migration files.

---

## 0G KV Agent Memory

### Memory Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Financial profile only | Risk tolerance, spending habits, savings goals | |
| Profile + conversation summary | Financial profile plus rolling interaction summary | |
| Profile + preferences + goals | Financial profile, UI/interaction preferences, active goals with progress | ✓ |
| You decide | Claude picks | |

**User's choice:** Profile + preferences + goals — most complete memory.

### KV Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Single JSON blob | One key per user containing all data. Simple read/write. | ✓ |
| Multiple keys | Separate keys per concern. Granular but more KV calls. | |
| You decide | Claude picks | |

**User's choice:** Single JSON blob per user.

### Write Timing

| Option | Description | Selected |
|--------|-------------|----------|
| End of session | Batch update on close/timeout. Fewer writes, risk of data loss. | |
| After key moments | Write when agent detects meaningful new info. Balanced. | ✓ |
| Every turn | Update after every message. Most durable, highest volume. | |
| You decide | Claude picks | |

**User's choice:** After key moments — write when something meaningful is learned.

---

## Context Loading Flow

**User's choice:** Provided direct specification rather than picking from options:
- Context loaded once at conversation start, cached for the session
- Cache re-fetched when certain time passes since last conversation
- Chat route handles fetching (checks cache first, fetches if none)
- KV memory merged into existing user context injection message

**Notes:** User wanted elaboration on what "context loading flow" means before making decisions. After explanation of how `assembleContext()` works and what changes with external data sources, user specified the approach directly.

---

## User Bootstrap

### User Creation Timing

| Option | Description | Selected |
|--------|-------------|----------|
| On app open | Create as soon as Mini App opens and wallet connects | |
| On first chat message | Lazy creation on first message | |
| During onboarding flow | Explicit onboarding step triggers creation | ✓ |

**User's choice:** During onboarding flow.

### Onboarding Data

| Option | Description | Selected |
|--------|-------------|----------|
| Wallet only | Just wallet from World App. Fastest path. | |
| Wallet + display name | Wallet plus chosen name. Minimal. | |
| Wallet + name + preferences | Wallet, name, preference questions. Richer but longer. | |
| (User specification) | Two-page onboarding: intro page + spending limit setup | ✓ |

**User's choice:** Two-page onboarding — (1) product intro, (2) agent spending limit. Username and wallet come from World App; spending limit is user-set.
**Notes:** User specified the exact onboarding flow structure.

### Initial KV Memory

| Option | Description | Selected |
|--------|-------------|----------|
| Create at onboarding | Initialize default KV blob at onboarding completion | ✓ |
| Create on first insight | No KV entry until agent detects something worth remembering | |
| You decide | Claude picks | |

**User's choice:** Create at onboarding — memory ready from first chat.

---

## Claude's Discretion

- Drizzle schema column types and constraints
- KV key naming convention
- Cache TTL duration
- Default KV memory blob structure
- Key moment detection mechanism for memory writes

## Deferred Ideas

None — discussion stayed within phase scope.
