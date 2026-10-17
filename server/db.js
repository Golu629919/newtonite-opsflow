import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Data directory
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.TEST_DB ? ':memory:' : path.join(dataDir, 'opsflow.db');
export const db = new DatabaseSync(dbPath);

// Set busy timeout and WAL mode for high concurrency
try {
  db.exec('PRAGMA busy_timeout = 10000;');
  if (dbPath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA synchronous = NORMAL;');
  }
} catch (e) {
  // Ignore if already set by concurrent connection
}
db.exec('PRAGMA foreign_keys = ON;');

export function initSchema() {
  db.exec(`
    -- Teams
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3b82f6',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      avatar_url TEXT,
      role TEXT NOT NULL DEFAULT 'member', -- 'admin', 'lead', 'member', 'viewer'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- User Teams mapping
    CREATE TABLE IF NOT EXISTS user_teams (
      user_id TEXT NOT NULL,
      team_id TEXT NOT NULL,
      team_role TEXT NOT NULL DEFAULT 'member', -- 'lead', 'member'
      PRIMARY KEY (user_id, team_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
    );

    -- Operational Work Items
    CREATE TABLE IF NOT EXISTS work_items (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      type TEXT NOT NULL, -- 'CUSTOMER_ISSUE', 'ENGINEERING_BUG', 'PAYMENT_INVESTIGATION', 'PRODUCTION_INCIDENT', 'COMPLIANCE_REQUEST', 'OPERATIONAL_APPROVAL'
      status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'INVESTIGATING', 'PENDING_APPROVAL', 'BLOCKED', 'RESOLVED', 'CLOSED'
      priority TEXT NOT NULL DEFAULT 'P2_MEDIUM', -- 'P0_CRITICAL', 'P1_HIGH', 'P2_MEDIUM', 'P3_LOW'
      team_id TEXT NOT NULL,
      assignee_id TEXT,
      creator_id TEXT NOT NULL,
      why_it_exists TEXT NOT NULL,
      current_state_summary TEXT,
      next_action TEXT NOT NULL,
      blocked_reason TEXT,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      approval_status TEXT NOT NULL DEFAULT 'NONE', -- 'NONE', 'REQUESTED', 'APPROVED', 'REJECTED'
      approved_by TEXT,
      approval_note TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (team_id) REFERENCES teams(id),
      FOREIGN KEY (assignee_id) REFERENCES users(id),
      FOREIGN KEY (creator_id) REFERENCES users(id)
    );

    -- Indexes for high-scale querying
    CREATE INDEX IF NOT EXISTS idx_work_items_team ON work_items(team_id);
    CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
    CREATE INDEX IF NOT EXISTS idx_work_items_priority ON work_items(priority);
    CREATE INDEX IF NOT EXISTS idx_work_items_assignee ON work_items(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_work_items_updated ON work_items(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_work_items_created ON work_items(created_at DESC);

    -- Activity & Audit Log (Full Event Trail)
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      work_item_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      action_type TEXT NOT NULL, -- 'CREATED', 'CLAIMED', 'REASSIGNED', 'STATUS_CHANGED', 'PRIORITY_CHANGED', 'APPROVAL_REQUESTED', 'APPROVED', 'REJECTED', 'COMMENTED', 'EDITED'
      from_value TEXT,
      to_value TEXT,
      note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_activity_work_item ON activity_log(work_item_id, created_at DESC);

    -- Collaboration Comments / Investigation Notes
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      work_item_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      message TEXT NOT NULL,
      is_internal INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_comments_work_item ON comments(work_item_id, created_at ASC);

    -- Idempotency Keys (Deduplication store)
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      key TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      route TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status_code INTEGER,
      response_body TEXT,
      locked_until TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);

    -- Transactional Outbox (Guaranteed Secondary Asynchronous Processing)
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      work_item_id TEXT,
      event_type TEXT NOT NULL, -- 'NOTIFICATION_DISPATCH', 'AUDIT_LEDGER_ENRICH', 'SLA_MONITOR', 'SLACK_BROADCAST'
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER'
      retry_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      next_attempt_at TEXT DEFAULT CURRENT_TIMESTAMP,
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      processed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, next_attempt_at);
  `);
}

// Helpers for cleaner query syntax
export const queryHelpers = {
  all(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  },
  get(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.get(...params);
  },
  run(sql, params = []) {
    const stmt = db.prepare(sql);
    return stmt.run(...params);
  },
  transaction(fn) {
    db.exec('BEGIN TRANSACTION');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
};
