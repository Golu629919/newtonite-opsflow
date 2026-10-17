import express from 'express';
import { queryHelpers } from './db.js';
import { INITIAL_USERS, INITIAL_TEAMS } from './auth.js';
import { WorkItemService } from './service.js';
import { idempotencyMiddleware } from './idempotency.js';
import { sseManager } from './sse.js';
import { outboxWorker } from './outboxWorker.js';

const router = express.Router();

// SSE Real-time Live Stream
router.get('/events/stream', (req, res) => {
  sseManager.addClient(res, req);
});

// Authentication / Identity & Persona Management
router.get('/auth/current', (req, res) => {
  res.json({
    user: req.user
  });
});

router.get('/auth/users', (req, res) => {
  const users = queryHelpers.all('SELECT id, name, email, avatar_url, role FROM users');
  res.json({ users });
});

router.get('/auth/teams', (req, res) => {
  const teams = queryHelpers.all('SELECT * FROM teams');
  res.json({ teams });
});

// Operational Analytics & Overview
router.get('/analytics/summary', (req, res) => {
  const total = queryHelpers.get('SELECT COUNT(*) as c FROM work_items')?.c || 0;
  const critical = queryHelpers.get("SELECT COUNT(*) as c FROM work_items WHERE priority = 'P0_CRITICAL' AND status NOT IN ('RESOLVED', 'CLOSED')")?.c || 0;
  const pendingApproval = queryHelpers.get("SELECT COUNT(*) as c FROM work_items WHERE approval_status = 'REQUESTED'")?.c || 0;
  const unassigned = queryHelpers.get("SELECT COUNT(*) as c FROM work_items WHERE assignee_id IS NULL AND status NOT IN ('RESOLVED', 'CLOSED')")?.c || 0;

  const myTeamIds = req.user.teams.map(t => t.team_id);
  const myTeamAssigned = queryHelpers.get(`
    SELECT COUNT(*) as c FROM work_items 
    WHERE team_id IN (${myTeamIds.map(() => '?').join(',') || "''"}) 
      AND status NOT IN ('RESOLVED', 'CLOSED')
  `, myTeamIds)?.c || 0;

  const teamDistribution = queryHelpers.all(`
    SELECT t.id, t.name, t.color, COUNT(w.id) as count
    FROM teams t
    LEFT JOIN work_items w ON t.id = w.team_id AND w.status NOT IN ('RESOLVED', 'CLOSED')
    GROUP BY t.id
  `);

  res.json({
    summary: {
      totalActive: total,
      criticalP0: critical,
      pendingApproval,
      unassigned,
      myTeamWorkload: myTeamAssigned
    },
    teamDistribution
  });
});

// Apply Idempotency Middleware to mutating operations below
router.use(idempotencyMiddleware);

// Work Items List (Paginated, Searchable, Scalable)
router.get('/work-items', (req, res, next) => {
  try {
    const { page, limit, teamId, status, priority, type, assigneeId, search, sort, order } = req.query;
    const result = WorkItemService.listWorkItems({
      page,
      limit,
      teamId,
      status,
      priority,
      type,
      assigneeId,
      search,
      sort,
      order
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Single Work Item Detail with Full Timeline
router.get('/work-items/:id', (req, res, next) => {
  try {
    const item = WorkItemService.getWorkItem(req.params.id, req.user);
    if (!item) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Work item not found' });
    }
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// Create Work Item (with Idempotency Key protection)
router.post('/work-items', (req, res, next) => {
  try {
    const item = WorkItemService.createWorkItem(req.body, req.user);
    res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

// Update Work Item details (OCC version check)
router.put('/work-items/:id', (req, res, next) => {
  try {
    const versionHeader = req.headers['if-match'];
    const expectedVersion = req.body.version !== undefined ? req.body.version : (versionHeader ? parseInt(versionHeader.replace(/"/g, ''), 10) : undefined);
    const updated = WorkItemService.updateWorkItem(req.params.id, req.body, expectedVersion, req.user);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Atomic Claim (OCC version check)
router.post('/work-items/:id/claim', (req, res, next) => {
  try {
    const expectedVersion = req.body.version;
    const updated = WorkItemService.claimWorkItem(req.params.id, expectedVersion, req.user);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Reassign (OCC version check)
router.post('/work-items/:id/assign', (req, res, next) => {
  try {
    const { assignee_id, version } = req.body;
    const updated = WorkItemService.assignWorkItem(req.params.id, assignee_id, version, req.user);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// State Machine Status Transition
router.post('/work-items/:id/transition', (req, res, next) => {
  try {
    const { status, version, note, blocked_reason, next_action, reopen_reason } = req.body;
    const updated = WorkItemService.transitionStatus(
      req.params.id,
      status,
      version,
      { note, blocked_reason, next_action, reopen_reason },
      req.user
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Formal Approval Request
router.post('/work-items/:id/approval-request', (req, res, next) => {
  try {
    const { note, version } = req.body;
    const updated = WorkItemService.requestApproval(req.params.id, note, version, req.user);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Formal Approval Decision (Requires Lead/Admin authorization)
router.post('/work-items/:id/approval-decision', (req, res, next) => {
  try {
    const { decision, note, version } = req.body;
    const updated = WorkItemService.decideApproval(req.params.id, decision, note, version, req.user);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Collaboration Comments
router.post('/work-items/:id/comments', (req, res, next) => {
  try {
    const { message, is_internal } = req.body;
    const updated = WorkItemService.addComment(req.params.id, message, is_internal, req.user);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Outbox Async Queue Monitoring & Manual Retry
router.get('/outbox', (req, res) => {
  const jobs = queryHelpers.all(`
    SELECT o.*, w.title as work_item_title
    FROM outbox o
    LEFT JOIN work_items w ON o.work_item_id = w.id
    ORDER BY o.created_at DESC
    LIMIT 50
  `);

  const stats = queryHelpers.all(`
    SELECT status, COUNT(*) as count 
    FROM outbox 
    GROUP BY status
  `);

  res.json({ jobs, stats });
});

router.post('/outbox/:id/retry', (req, res, next) => {
  try {
    const job = outboxWorker.retryJob(req.params.id);
    res.json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

export default router;
