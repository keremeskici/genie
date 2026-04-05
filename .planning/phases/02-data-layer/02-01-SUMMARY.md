---
phase: 02-data-layer
plan: 01
subsystem: data-layer
tags: [drizzle, postgres, pglite, schema, database]
dependency_graph:
  requires: []
  provides: [db-schema, db-client, drizzle-config]
  affects: [03-identity, 04-financial-ops, 05-spending-social]
tech_stack:
  added: [drizzle-orm, postgres, drizzle-kit, "@electric-sql/pglite", dotenv]
  patterns: [drizzle-pglite-pushschema, prepare-false-supabase-pooler]
key_files:
  created:
    - apps/api/src/db/schema.ts
    - apps/api/src/db/client.ts
    - apps/api/src/db/index.ts
    - apps/api/drizzle.config.ts
    - apps/api/src/db/schema.test.ts
  modified:
    - apps/api/package.json
decisions:
  - prepare:false required for Supabase transaction pooler (port 6543) — without it prepared statements fail intermittently
  - drizzle-kit/api pushSchema returns result object with apply() method — must call apply() to execute DDL
  - PGlite numeric(10,2) returns "25.00" not "25" — test expectations must match precision
metrics:
  duration: 4 minutes
  completed_date: 2026-04-04
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 02 Plan 01: Drizzle Schema + DB Client Summary

**One-liner:** Drizzle ORM with four-table PostgreSQL schema (users, contacts, transactions, debts), postgres-js client with prepare:false for Supabase pooler, and drizzle-kit push config with PGlite-based tests passing.

## Tasks Completed

| # | Task | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Install deps + Drizzle schema with PGlite tests | 60de3a0 | schema.ts, schema.test.ts, package.json |
| 2 | DB client, barrel export, drizzle-kit push config | 4df9a92 | client.ts, index.ts, drizzle.config.ts |

## What Was Built

- **`apps/api/src/db/schema.ts`** — Four pgTable definitions:
  - `users`: id (uuid PK), wallet_address (unique, not null), world_id (nullable), display_name (not null), auto_approve_usd (numeric, default 25), created_at
  - `contacts`: id, owner_user_id (FK->users, cascade delete), wallet_address, display_name, genie_user_id (FK->users, nullable), created_at
  - `transactions`: id, sender_user_id (FK->users), recipient_wallet, amount_usd, tx_hash (nullable), created_at
  - `debts`: id, owner_user_id (FK->users), counterparty_wallet, amount_usd, description (nullable), settled (boolean, default false), created_at

- **`apps/api/src/db/client.ts`** — Drizzle postgres-js instance with `prepare: false` for Supabase transaction pooler compatibility

- **`apps/api/src/db/index.ts`** — Barrel re-export of db instance and all schema tables

- **`apps/api/drizzle.config.ts`** — drizzle-kit push config pointing to schema.ts, using dotenv for env loading

- **`apps/api/src/db/schema.test.ts`** — PGlite in-memory tests: column shape checks + insert/select round-trips for all four tables

## Verification Results

- `npx vitest run`: 48 tests passed (8 test files)
- `tsc --noEmit` on db files: no errors
- All acceptance criteria met

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pushSchema missing .apply() call**
- **Found during:** Task 1 GREEN phase
- **Issue:** Plan showed `await pushSchema(schema, db)` but the API returns `{ apply: () => Promise<void>, ... }` — tables were not created without calling `.apply()`
- **Fix:** Changed to `const result = await pushSchema(schema, db as any); await result.apply();`
- **Files modified:** apps/api/src/db/schema.test.ts
- **Commit:** 60de3a0

**2. [Rule 1 - Bug] numeric(10,2) precision in test expectation**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test expected `autoApproveUsd` to equal `'25'` but PGlite returns `'25.00'` for numeric(10,2) columns
- **Fix:** Updated expectation to `'25.00'`
- **Files modified:** apps/api/src/db/schema.test.ts
- **Commit:** 60de3a0

## Known Stubs

None — all schema tables are fully defined with correct types and constraints. DB client is wired to real Supabase via DATABASE_URL env var.

## Self-Check: PASSED

- apps/api/src/db/schema.ts: FOUND
- apps/api/src/db/client.ts: FOUND
- apps/api/src/db/index.ts: FOUND
- apps/api/drizzle.config.ts: FOUND
- apps/api/src/db/schema.test.ts: FOUND
- Commit 60de3a0: FOUND
- Commit 4df9a92: FOUND
