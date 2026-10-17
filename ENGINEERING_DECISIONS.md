# Engineering Decisions & Architecture Trade-Offs

**Project**: Newtonite OpsFlow (Operations Under Pressure)  
**Author**: Candidate Engineer  
**Date**: October 2026  

---

## 1. Concurrency Control: Optimistic Concurrency Control (OCC) vs. Pessimistic Locking

### Decision
We implemented **Optimistic Concurrency Control (OCC)** using a strictly incremented `version` integer column on the `work_items` table, paired with conditional atomic SQL mutations (`UPDATE work_items SET ..., version = version + 1 WHERE id = ? AND version = ?`), and Server-Sent Events (SSE) for proactive client-side stale detection.

### Trade-Off Rationale
* **Why not Pessimistic Locking (`SELECT FOR UPDATE`)?**
  In operational workflows, humans frequently hold tickets open in browser tabs for minutes or hours while investigating. Pessimistic locks would tie up database rows, block other users from adding investigation notes, cause lock contention under hundreds of simultaneous operators, and lead to distributed deadlocks if an operator disconnects abruptly.
* **Why OCC + Real-Time SSE?**
  OCC guarantees **zero lost updates** without database lock overhead. When User A updates or claims an item, User B's pending update is detected as stale and safely rejected with `HTTP 409 Conflict`. Crucially, because SSE streams ticket mutations in real time, User B is alerted the instant User A saves, turning what would have been a blind collision into an informed merge experience.

---

## 2. Accidental Duplicate Action Prevention: Idempotency Key Middleware

### Decision
We designed an application-level **Idempotency Key** middleware for all mutating operations (`POST`, `PUT`, `PATCH`). The client generates and transmits a unique `Idempotency-Key: <UUID>` header. The server records an in-flight lock during execution and caches the final status code and JSON payload in a dedicated `idempotency_keys` table.

### Trade-Off Rationale
* **The Real-World Operational Risk**:
  During operational stress (e.g., European payment gateway outage, high-value wire reconciliation), network latency increases. Operators frequently double-click "Submit" or refresh during a timeout. Without idempotency, this results in duplicate refund requests, multiple incident tickets, or duplicate approval ledger entries.
* **Trade-Off**:
  Storing idempotency keys incurs a modest storage overhead and a fast key lookup on mutations. In return, we achieve total duplicate operation prevention across distributed retries, timeouts, and frontend retries, returning the cached response with `X-Idempotent-Replay: true`.

---

## 3. Synchronous Core vs. Asynchronous Secondary Operations: Transactional Outbox Pattern

### Decision
We separated the operational lifecycle into two distinct execution tiers:
1. **Synchronous Tier**: State machine transitions, ownership assignment, priority escalation, and audit ledger persistence happen synchronously inside a single SQLite transaction.
2. **Asynchronous Tier**: Secondary side effects—external Slack/Email notification dispatches, downstream webhook events, SLA breach timer registrations, and metric ledger enrichment—are written to a `outbox` table in the same transaction and processed by a background worker (`OutboxWorker`).

### Trade-Off Rationale
* **Failure Isolation**:
  If the corporate Slack API or external email provider suffers a 503 outage or 10-second latency spike, the operator's ticket status transition still succeeds immediately without delay or failure.
* **Resiliency & Retries**:
  The background worker employs exponential backoff (`2^retry_count * 2s`) with max retries (3) and moves permanently failing events into a **Dead-Letter Queue (DLQ)**. Operators can inspect and manually re-trigger failed outbox jobs directly through the UI.

---

## 4. Authorization Model: System-Enforced RBAC + Resource-Level ABAC Boundaries

### Decision
Authorization is strictly enforced in the backend service layer and API middleware, not merely by hiding UI controls. We combined **Role-Based Access Control (RBAC)** (`admin`, `lead`, `member`, `viewer`) with **Attribute-Based Team Scoping (ABAC)** across the company's functional teams (`Engineering`, `Payments`, `Compliance`, `Operations`, `Customer Support`).

### Key Enforced Policies:
1. **Team Ownership Boundaries**: An operator from Customer Support cannot claim or resolve an incident assigned to Engineering without reassignment by a Lead.
2. **Compliance & Legal Confidentiality**: Sensitive regulatory items (`COMPLIANCE_REQUEST`) are restricted at the resource level, unreadable by external team members unless directly involved.
3. **Guarded Approval Authority**: Operational sign-offs (e.g. wire adjustments > $10,000, GDPR erasures) strictly require a `lead` or `admin` role within the responsible domain. Regular members are rejected with `HTTP 403 Forbidden`.
4. **Auditor / Viewer Role**: The `viewer` role can inspect all public operational records and historical audit logs but is blocked from mutating tickets.

---

## 5. Formal State Machine & Guarded Workflow Transitions

### Decision
Rather than allowing arbitrary status updates via simple CRUD, work item progression is governed by a formal directed state machine (`OPEN` &rarr; `INVESTIGATING` &rarr; `PENDING_APPROVAL` &rarr; `BLOCKED` &rarr; `RESOLVED` &rarr; `CLOSED`) with strict business guards:
* **Approval Guard**: If a ticket has `requires_approval = 1`, transition to `RESOLVED` or `CLOSED` is strictly forbidden unless formal approval has been granted.
* **Accountability Guard**: A ticket cannot be marked `RESOLVED` without an assigned operator taking responsibility (`assignee_id != null`).
* **Blocker Documentation Guard**: Moving to `BLOCKED` mandates a non-empty `blocked_reason`.
* **Immutability of Closed Work**: Once `CLOSED`, work items cannot undergo status or field mutations without an explicit audit-logged re-opening justification.

---

## 6. What Was Intentionally Chosen Not to Build (Scope & Trade-Offs)

1. **Complex Distributed Event Bus (Kafka / RabbitMQ)**:
   * *Rationale*: For the expected scale of hundreds to low thousands of concurrent internal enterprise users and tens of thousands of active tickets, an in-database Transactional Outbox pattern with WAL mode is significantly more reliable, easier to debug, transactional, and eliminates two-phase commit overhead.
2. **Full Free-Text ElasticSearch Cluster**:
   * *Rationale*: SQLite's indexed B-tree queries and sub-millisecond filtering across title, why_it_exists, status, and team fields provide instantaneous responses without running a separate heavyweight Java/Lucene service.
3. **Heavy End-to-End Test Frameworks (Cypress/Playwright) in CI**:
   * *Rationale*: Automated tests prioritized high-risk correctness behaviors (concurrency collision, idempotency replay, authorization violations, state machine guards, outbox retry mechanics) via fast, deterministic unit and integration test suites that execute in < 2.5 seconds.
