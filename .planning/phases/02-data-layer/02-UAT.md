---
status: testing
phase: 02-data-layer
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-03-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-04-04T18:00:00Z
updated: 2026-04-04T18:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server/service. Start the API from scratch (`pnpm --filter @genie/api dev` or equivalent). Server boots without errors, no crash on startup. A basic health check or POST /chat request returns a response (not a connection error).
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Start the API from scratch. Server boots without errors. A basic health check or POST /chat request returns a response.
result: [pending]

### 2. Supabase Schema Push
expected: Running `npx drizzle-kit push` from `apps/api/` against a real Supabase DATABASE_URL creates all four tables (users, contacts, transactions, debts) without errors.
result: [pending]

### 3. Chat with Memory Context
expected: Send a POST /chat with a userId that exists in the DB. The agent responds normally. Behind the scenes, the route fetches the user from Supabase and reads their 0G KV memory — but from the user's perspective, the chat just works without errors.
result: [pending]

### 4. Chat without userId (Graceful Fallback)
expected: Send a POST /chat without a userId field. The agent still responds normally using stub context. No crash, no error — just a normal chat response.
result: [pending]

### 5. update_memory Tool — Agent Persists a Preference
expected: In a chat session with a userId, tell the agent something like "I have moderate risk tolerance" or "my goal is to save $500". The agent should call the update_memory tool and confirm it saved your preference. On the next chat session, the agent should remember what you told it.
result: [pending]

### 6. Context Cache — Repeated Requests Are Fast
expected: Send two POST /chat requests with the same userId within 30 minutes. The second request should be noticeably faster (no Supabase + KV round-trip). Both responses work correctly.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
