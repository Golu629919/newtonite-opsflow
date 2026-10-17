# Newtonite OpsFlow - Operations Under Pressure

> Full-stack operational work coordination platform built for rapid incident triage, high-concurrency cross-team workflows, and auditable state transitions under high pressure.

Built for the **Newtonite Software Engineering Challenge**.

---

## 🌟 Key Capabilities & Solution Overview

| Requirement from Brief | System Implementation |
| :--- | :--- |
| **Understand why an item exists & current state** | Dedicated contextual fields: `why_it_exists`, `current_state_summary`, `next_action`, category tags, and priority ratings. |
| **Simultaneous actions by multiple users** | **Optimistic Concurrency Control (OCC)** using version check headers & atomic SQL statements (`WHERE id = ? AND version = ?`), returning `HTTP 409 Conflict` with server diff. |
| **Accidental duplicate operations** | **Idempotency-Key** middleware caching mutating requests and returning `X-Idempotent-Replay` to prevent double clicks and network retry duplicates. |
| **Stale information handling** | **Server-Sent Events (SSE)** broadcast instant updates to all connected browser tabs, alerting operators when viewing older versions. |
| **Workflow rules & approvals** | Formal directed state machine enforcing approval gates before moving to `RESOLVED`, mandatory blocker reasons, and immutability of closed work. |
| **Teams, identity & access control** | System-level RBAC (`admin`, `lead`, `member`, `viewer`) and resource-level team scoping (`Engineering`, `Payments`, `Compliance`, `Operations`, `Support`). |
| **Secondary & asynchronous processing** | **Transactional Outbox Pattern** with background worker, exponential backoff retries, dead-letter queue (DLQ), and manual operator retry. |
| **Expected scale (tens of thousands of items)** | Server-side indexed pagination, sorting, and text searching (no unbounded client-side memory loading). |

---

## 🚀 Running the Project in VS Code

### Option A: VS Code Run & Debug (1-Click F5)
1. Open this project folder in **Visual Studio Code**.
2. Press **`F5`** or go to the **Run and Debug** view (`Ctrl + Shift + D` / `Cmd + Shift + D`).
3. Select **"Newtonite OpsFlow Server (Full App)"** and click **Start Debugging** (Play button).
4. The server will start on port `3001` and serve the pre-built React application.
5. Open your browser at:
   👉 **[http://localhost:3001](http://localhost:3001)**

### Option B: VS Code Tasks
1. In VS Code, press **`Ctrl + Shift + P`** (or `Cmd + Shift + P` on Mac).
2. Select **`Tasks: Run Task`** &rarr; **`Start OpsFlow (Dev Mode)`**.
3. This boots the Node backend and Vite dev server concurrently.
4. Open your browser at:
   👉 **[http://localhost:5173](http://localhost:5173)**

### Option C: Integrated Terminal
Open a terminal in VS Code (`Ctrl + \``) and run:

```bash
# Production server mode (serves API, SSE, and React UI on http://localhost:3001):
npm start

# Dev server mode (hot-reloading on http://localhost:5173):
npm run dev
```

---

## 🧪 Running Automated Tests

To run the automated test suite verifying all 5 critical correctness behaviors:

```bash
npm test
```

### Automated Test Coverage Summary:
* ✅ **Test 1 (`concurrency.test.js`)**: Tests two operators attempting to claim the same work item at version 1 simultaneously. First succeeds, second is rejected with `HTTP 409 Conflict`.
* ✅ **Test 2 (`idempotency.test.js`)**: Tests sending duplicate POST requests with the same `Idempotency-Key`. Proves exactly 1 work item is created in the database and returns cached response with `X-Idempotent-Replay: true`.
* ✅ **Test 3 (`workflow_guards.test.js`)**: Tests that high-risk compliance tickets cannot be marked `RESOLVED` without formal sign-off, unauthorized operators cannot approve, and authorized leads can approve.
* ✅ **Test 4 (`authorization.test.js`)**: Tests resource-level permission boundaries (viewers cannot mutate, cross-team unauthorized claims are blocked, sensitive compliance requests are restricted).
* ✅ **Test 5 (`outbox.test.js`)**: Tests atomic outbox writes, worker processing, simulated failure retry with exponential backoff, and manual operator recovery.

---

## 🎮 Interactive Simulation Lab (Operations Under Pressure)

In the web application UI, click the **"Simulation Lab (Critical Scenarios)"** tab in the top navigation bar.

Here, you can test and observe all critical behaviors live with 1 click:
1. **⚡ Simulate Concurrency Race**: Triggers 2 simultaneous claims on the same ticket, displaying the live 409 Conflict rejection and diff.
2. **🔁 Simulate Network Timeout & Idempotency**: Fires duplicate requests 10ms apart with identical idempotency key; verifies zero duplicate database records.
3. **🛡️ Simulate State Machine Guard Violation**: Attempts to resolve a ticket without required approval, rejects unauthorized approval, executes authorized lead approval, and verifies resolution.
4. **📬 Simulate Outbox Gateway Downtime & Backoff**: Submits an item with simulated gateway failure; displays background worker backoff and manual operator recovery.

---

## 👥 Switching User Personas

Use the **Persona Switcher** in the top-right header to test different roles and team boundaries in real time:

* **Alice Chen**: Engineering Lead (`team-eng`, `team-ops`) - Has lead approval authority for engineering and ops.
* **Bob Martinez**: Payment Operations (`team-payments`) - Regular contributor handling transaction reconciliations.
* **Carol Vance**: Head of Compliance (`team-compliance`) - Lead authority for regulatory and compliance requests.
* **Dave Wilson**: Customer Escalations (`team-support`) - Customer support specialist.
* **Elena Rostova**: Incident Commander / SRE (`team-eng`, `team-ops`) - System Administrator.
* **Frank Miller**: Internal Auditor (`viewer`) - Read-only auditor (all mutation attempts are blocked with HTTP 403).

---

## 🏗️ Architecture & Data Model

```
   ┌─────────────────────────────────────────────────────────────┐
   │             OpsFlow React + Tailwind Frontend               │
   │   (Triage List, Kanban Board, Simulation Lab, Detail Modal) │
   └──────────────▲───────────────────────────────▲──────────────┘
                  │ HTTP Requests                 │ Live Events (SSE)
                  │ (with Idempotency-Key & OCC)  │
   ┌──────────────▼───────────────────────────────┴──────────────┐
   │                 Express Application Server                  │
   │  ┌──────────────────────┐    ┌───────────────────────────┐  │
   │  │ Idempotency Filter   │    │ RBAC & ABAC Auth Filter   │  │
   │  └──────────────────────┘    └───────────────────────────┘  │
   │  ┌──────────────────────┐    ┌───────────────────────────┐  │
   │  │ State Machine Guards │    │ SSE Real-Time Broadcaster │  │
   │  └──────────────────────┘    └───────────────────────────┘  │
   └──────────────┬───────────────────────────────▲──────────────┘
                  │ Atomic DB Transactions        │ Polls / Emits
   ┌──────────────▼───────────────────────────────┴──────────────┐
   │             SQLite Database (WAL Mode Enabled)              │
   │  • work_items (version column for OCC)                      │
   │  • activity_log (immutable event sourcing audit trail)      │
   │  • idempotency_keys (cached responses & in-flight locks)    │
   │  • outbox (transactional secondary async queue)             │
   └──────────────────────────────┬──────────────────────────────┘
                                  │ Polls Pending Jobs
   ┌──────────────────────────────▼──────────────────────────────┐
   │           Background Outbox Worker (Async Tier)             │
   │  • Notification Dispatches (Slack/Email)                    │
   │  • Exponential Backoff Retries & Dead-Letter Queue (DLQ)    │
   │  • SLA Monitor Alerts & Audit Enrichment                    │
   └─────────────────────────────────────────────────────────────┘
```

---

## 📝 Known Limitations

1. **Single-Node In-Process Outbox Worker**:
   * Currently, the background outbox worker polls within the Node.js process using SQLite transactions. In a distributed multi-pod environment (e.g. Kubernetes with multiple replicas), a distributed queue (e.g. Redis Streams or PostgreSQL `FOR UPDATE SKIP LOCKED`) would prevent multiple pods from competing on the same outbox batch.
2. **Ephemeral In-Memory Idempotency TTL**:
   * Idempotency keys are retained indefinitely in the current SQLite database table. In a production enterprise system with millions of requests, a TTL scheduled cleanup job or an in-memory Redis key store with a 24-hour expiration would prune historical keys.
3. **Optimistic Merge Auto-Reconciliation**:
   * When an OCC conflict (409) occurs, the current implementation presents the server's latest version and prompts the user to reload and reapply their changes. A three-way field-level auto-merge (e.g., merging non-overlapping field edits automatically) would further streamline high-throughput collaborative editing.
