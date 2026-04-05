# Phase 5: Cross-Chain & Social - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 05-cross-chain-social
**Areas discussed:** Cross-chain deposit flow, Transaction categorization, Debt management, Spending queries

---

## Cross-Chain Deposit Flow

Researched Circle Bridge Kit (`@circle-fin/bridge-kit`) per user request. Key finding: CCTP V2 requires explicit `depositForBurn()` transactions signed by the user on the source chain. No passive deposit-address model exists.

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-initiated bridge | Server uses Arc CCTP SDK to bridge server-side | |
| Frontend widget (Bridge Kit pattern) | User connects source-chain wallet, signs approve+burn | |
| QR code / deposit address | User sends to static address, backend detects and bridges | |
| Defer XCHD-01 | Skip for hackathon, implement later | ✓ |

**User's choice:** Defer XCHD-01 entirely
**Notes:** User initially wanted a QR code / deposit address approach. After research showed this isn't supported by CCTP, and frontend wallet approach conflicts with the Mini App living inside World App (connecting MetaMask inside World App is "weird and counter productive"), user decided to defer.

---

## Transaction Categorization

| Option | Description | Selected |
|--------|-------------|----------|
| AI-inferred at creation | Agent infers from conversation context at send time | ✓ |
| User-specified | Agent asks user to pick category after each tx | |
| Retroactive batch | Categorize in bulk when user asks for summary | |

**User's choice:** AI-inferred at creation
**Notes:** None

### Categories

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed set | food, transport, entertainment, bills, transfers | ✓ |
| Extensible set | Start with 5, agent can create new ones | |

**User's choice:** Fixed set

### Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Column on transactions | Add nullable category text column | ✓ |
| Separate table | New table linking tx ID to category + confidence | |

**User's choice:** Column on transactions

### Incoming Categorization

| Option | Description | Selected |
|--------|-------------|----------|
| Outgoing only | Only categorize sent money | |
| Both directions | Categorize incoming and outgoing | ✓ |

**User's choice:** Both directions

### Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Default to 'transfers' | Always have a category, default when uncertain | ✓ |
| Ask the user | Agent asks "what's this for?" | |
| Leave uncategorized | Null category when uncertain | |

**User's choice:** Default to 'transfers'

### Scalability Note
**User input:** World App has an upcoming World Card feature (traditional card payments) that will be the main source of transaction history. Categorization must be implemented as a standalone, scalable layer so World Card transactions can plug in with minimal work. Added `source` column decision.

---

## Debt Management

### Settlement Matching

| Option | Description | Selected |
|--------|-------------|----------|
| Sender + approximate amount | Match by wallet AND amount within tolerance | ✓ |
| Sender only | Any transfer from debtor settles oldest debt | |
| Manual only | User explicitly marks debts settled | |

**User's choice:** Sender + approximate amount

### Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Both directions | "Alice owes me" and "I owe Bob" | ✓ |
| Only owed-to-me | Only track debts others owe the user | |

**User's choice:** Both directions

### Notification

| Option | Description | Selected |
|--------|-------------|----------|
| Next chat message | Agent mentions at conversation start | ✓ |
| Inline during transfer | Immediate if user is in chat | |

**User's choice:** Next chat message

---

## Spending Queries

### Time Ranges

| Option | Description | Selected |
|--------|-------------|----------|
| Natural language | Agent parses "this week", "last month", etc. | ✓ |
| Fixed periods | Today, this week, this month, all time | |

**User's choice:** Natural language

### Format

| Option | Description | Selected |
|--------|-------------|----------|
| Text breakdown | Categorized text summary in chat | ✓ |
| Structured data for frontend | JSON for charts/visuals | |
| Both | Structured data + text summary | |

**User's choice:** Text breakdown

---

## Claude's Discretion

- Exact tolerance for debt auto-settlement matching
- Direction storage approach (flag vs sign vs enum)
- Incoming transfer detection mechanism
- Spending query SQL aggregation structure
- Categorization context extraction method

## Deferred Ideas

- XCHD-01: Cross-chain deposits via Circle Bridge Kit / CCTP V2 (deferred — Mini App UX conflict)
- World Card transaction import (schema designed to support, no implementation)
