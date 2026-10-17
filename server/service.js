import crypto from 'node:crypto';
import { queryHelpers } from './db.js';
import { checkPermission } from './auth.js';
import { validateStateTransition, WORKFLOW_STATES } from './stateMachine.js';
import { sseManager } from './sse.js';

export class WorkItemService {
  /**
   * Search, filter, and paginate work items (scalable for tens of thousands of items)
   */
  static listWorkItems({
    page = 1,
    limit = 15,
    teamId,
    status,
    priority,
    type,
    assigneeId,
    search,
    sort = 'updated_at',
    order = 'DESC'
  } = {}) {
    page = Math.max(1, parseInt(page, 10) || 1);
    limit = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const offset = (page - 1) * limit;

    const whereClauses = [];
    const params = [];

    if (teamId) {
      whereClauses.push('w.team_id = ?');
      params.push(teamId);
    }
    if (status) {
      whereClauses.push('w.status = ?');
      params.push(status);
    }
    if (priority) {
      whereClauses.push('w.priority = ?');
      params.push(priority);
    }
    if (type) {
      whereClauses.push('w.type = ?');
      params.push(type);
    }
    if (assigneeId) {
      if (assigneeId === 'unassigned') {
        whereClauses.push('w.assignee_id IS NULL');
      } else {
        whereClauses.push('w.assignee_id = ?');
        params.push(assigneeId);
      }
    }
    if (search && search.trim()) {
      whereClauses.push('(w.id LIKE ? OR w.title LIKE ? OR w.why_it_exists LIKE ? OR w.next_action LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Allowed sort columns
    const safeSortCols = ['updated_at', 'created_at', 'priority', 'status', 'id'];
    const safeSort = safeSortCols.includes(sort) ? sort : 'updated_at';
    const safeOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count query
    const countRow = queryHelpers.get(`
      SELECT COUNT(*) as total 
      FROM work_items w 
      ${whereSql}
    `, params);
    const total = countRow ? countRow.total : 0;

    // Items query with user and team joins
    const items = queryHelpers.all(`
      SELECT 
        w.*,
        t.name as team_name,
        t.color as team_color,
        u_assignee.name as assignee_name,
        u_assignee.avatar_url as assignee_avatar,
        u_creator.name as creator_name
      FROM work_items w
      LEFT JOIN teams t ON w.team_id = t.id
      LEFT JOIN users u_assignee ON w.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON w.creator_id = u_creator.id
      ${whereSql}
      ORDER BY w.${safeSort} ${safeOrder}
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Retrieve work item detail along with full timeline and comments
   */
  static getWorkItem(id, user) {
    const item = queryHelpers.get(`
      SELECT 
        w.*,
        t.name as team_name,
        t.color as team_color,
        u_assignee.name as assignee_name,
        u_assignee.email as assignee_email,
        u_assignee.avatar_url as assignee_avatar,
        u_creator.name as creator_name,
        u_approver.name as approver_name
      FROM work_items w
      LEFT JOIN teams t ON w.team_id = t.id
      LEFT JOIN users u_assignee ON w.assignee_id = u_assignee.id
      LEFT JOIN users u_creator ON w.creator_id = u_creator.id
      LEFT JOIN users u_approver ON w.approved_by = u_approver.id
      WHERE w.id = ?
    `, [id]);

    if (!item) return null;

    // Resource level authorization
    const auth = checkPermission(user, 'READ', item);
    if (!auth.allowed) {
      const err = new Error(auth.reason);
      err.statusCode = 403;
      throw err;
    }

    const activity = queryHelpers.all(`
      SELECT * FROM activity_log 
      WHERE work_item_id = ? 
      ORDER BY created_at DESC
    `, [id]);

    const comments = queryHelpers.all(`
      SELECT * FROM comments 
      WHERE work_item_id = ? 
      ORDER BY created_at ASC
    `, [id]);

    const outboxJobs = queryHelpers.all(`
      SELECT * FROM outbox 
      WHERE work_item_id = ? 
      ORDER BY created_at DESC
    `, [id]);

    return {
      ...item,
      activity,
      comments,
      outboxJobs
    };
  }

  /**
   * Create a new work item atomically with activity log and outbox events
   */
  static createWorkItem(data, user) {
    const auth = checkPermission(user, 'CREATE');
    if (!auth.allowed) {
      const err = new Error(auth.reason);
      err.statusCode = 403;
      throw err;
    }

    if (!data.title || !data.why_it_exists || !data.team_id || !data.next_action) {
      const err = new Error('Missing required fields: title, why_it_exists, team_id, and next_action are mandatory.');
      err.statusCode = 400;
      throw err;
    }

    const nextIdNum = (queryHelpers.get('SELECT COUNT(*) as count FROM work_items')?.count || 0) + 1001;
    const id = `OPS-${nextIdNum}`;
    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;
    const outboxId1 = `out_${crypto.randomUUID().slice(0, 8)}`;
    const outboxId2 = `out_${crypto.randomUUID().slice(0, 8)}`;

    const priority = data.priority || 'P2_MEDIUM';
    const type = data.type || 'OPERATIONAL_APPROVAL';
    const status = data.status || WORKFLOW_STATES.OPEN;
    const requiresApproval = data.requires_approval ? 1 : (type === 'COMPLIANCE_REQUEST' || type === 'PAYMENT_INVESTIGATION' ? 1 : 0);

    queryHelpers.transaction(() => {
      // 1. Insert Work Item
      queryHelpers.run(`
        INSERT INTO work_items (
          id, title, type, status, priority, team_id, assignee_id, 
          creator_id, why_it_exists, current_state_summary, next_action, 
          requires_approval, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        id,
        data.title,
        type,
        status,
        priority,
        data.team_id,
        data.assignee_id || null,
        user.id,
        data.why_it_exists,
        data.current_state_summary || 'Newly created operational ticket.',
        data.next_action,
        requiresApproval
      ]);

      // 2. Insert Activity Log
      queryHelpers.run(`
        INSERT INTO activity_log (
          id, work_item_id, actor_id, actor_name, action_type, to_value, note
        ) VALUES (?, ?, ?, ?, 'CREATED', ?, ?)
      `, [
        activityId,
        id,
        user.id,
        user.name,
        JSON.stringify({ status, priority, team_id: data.team_id }),
        `Work item created by ${user.name}`
      ]);

      // 3. Insert Outbox Notification Job
      queryHelpers.run(`
        INSERT INTO outbox (id, work_item_id, event_type, payload, status)
        VALUES (?, ?, 'NOTIFICATION_DISPATCH', ?, 'PENDING')
      `, [
        outboxId1,
        id,
        JSON.stringify({
          recipient_team: data.team_id,
          title: data.title,
          priority,
          creator: user.name,
          simulate_failure: data.simulate_outbox_failure || false
        })
      ]);

      // 4. Insert Outbox SLA Job for P0/P1 items
      if (priority === 'P0_CRITICAL' || priority === 'P1_HIGH') {
        queryHelpers.run(`
          INSERT INTO outbox (id, work_item_id, event_type, payload, status)
          VALUES (?, ?, 'SLA_MONITOR', ?, 'PENDING')
        `, [
          outboxId2,
          id,
          JSON.stringify({
            sla_tier: priority === 'P0_CRITICAL' ? '1_HOUR' : '4_HOURS',
            alert_channels: ['#ops-incidents', '#on-call']
          })
        ]);
      }
    });

    const created = this.getWorkItem(id, user);
    sseManager.broadcast('work_item_created', created);
    return created;
  }

  /**
   * Update work item details with Optimistic Concurrency Control (OCC)
   */
  static updateWorkItem(id, data, expectedVersion, user) {
    const item = queryHelpers.get('SELECT * FROM work_items WHERE id = ?', [id]);
    if (!item) {
      const err = new Error(`Work item '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // OCC VERSION CHECK
    if (expectedVersion !== undefined && expectedVersion !== null && parseInt(expectedVersion, 10) !== item.version) {
      const err = new Error(`OCC Conflict: Work item was modified by another user (current version: ${item.version}, your version: ${expectedVersion}). Please refresh latest data.`);
      err.statusCode = 409;
      err.currentVersion = item.version;
      err.serverItem = this.getWorkItem(id, user);
      throw err;
    }

    const auth = checkPermission(user, 'UPDATE_DETAILS', item);
    if (!auth.allowed) {
      const err = new Error(auth.reason);
      err.statusCode = 403;
      throw err;
    }

    const title = data.title !== undefined ? data.title : item.title;
    const whyItExists = data.why_it_exists !== undefined ? data.why_it_exists : item.why_it_exists;
    const currentStateSummary = data.current_state_summary !== undefined ? data.current_state_summary : item.current_state_summary;
    const nextAction = data.next_action !== undefined ? data.next_action : item.next_action;
    const priority = data.priority !== undefined ? data.priority : item.priority;
    const teamId = data.team_id !== undefined ? data.team_id : item.team_id;

    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;
    const outboxId = `out_${crypto.randomUUID().slice(0, 8)}`;

    queryHelpers.transaction(() => {
      // Atomic increment conditional on matching version
      const result = queryHelpers.run(`
        UPDATE work_items 
        SET title = ?, why_it_exists = ?, current_state_summary = ?, 
            next_action = ?, priority = ?, team_id = ?,
            version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `, [title, whyItExists, currentStateSummary, nextAction, priority, teamId, id, item.version]);

      if (result.changes === 0) {
        const err = new Error('Concurrent mutation conflict detected. The work item was updated during your request.');
        err.statusCode = 409;
        throw err;
      }

      // Record activity
      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, from_value, to_value, note)
        VALUES (?, ?, ?, ?, 'EDITED', ?, ?, ?)
      `, [
        activityId,
        id,
        user.id,
        user.name,
        JSON.stringify({ title: item.title, priority: item.priority }),
        JSON.stringify({ title, priority }),
        data.change_note || `Updated details by ${user.name}`
      ]);

      // Outbox event
      queryHelpers.run(`
        INSERT INTO outbox (id, work_item_id, event_type, payload, status)
        VALUES (?, ?, 'AUDIT_LEDGER_ENRICH', ?, 'PENDING')
      `, [
        outboxId,
        id,
        JSON.stringify({ action: 'ITEM_EDITED', updated_by: user.name, item_id: id })
      ]);
    });

    const updated = this.getWorkItem(id, user);
    sseManager.broadcast('work_item_updated', updated);
    return updated;
  }

  /**
   * Atomic Claim: Takes ownership of an item with OCC version check
   */
  static claimWorkItem(id, expectedVersion, user) {
    const item = queryHelpers.get('SELECT * FROM work_items WHERE id = ?', [id]);
    if (!item) {
      const err = new Error(`Work item '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (expectedVersion !== undefined && expectedVersion !== null && parseInt(expectedVersion, 10) !== item.version) {
      const err = new Error(`Conflict: Work item was updated before claim (current version: ${item.version}, your version: ${expectedVersion}).`);
      err.statusCode = 409;
      err.currentVersion = item.version;
      err.serverItem = this.getWorkItem(id, user);
      throw err;
    }

    const auth = checkPermission(user, 'CLAIM', item);
    if (!auth.allowed) {
      const err = new Error(auth.reason);
      err.statusCode = 403;
      throw err;
    }

    if (item.assignee_id === user.id) {
      return this.getWorkItem(id, user); // Already owned by user
    }

    if (item.assignee_id && item.assignee_id !== user.id && user.role !== 'admin') {
      const err = new Error(`Collision Detected: Work item is already claimed by another operator.`);
      err.statusCode = 409;
      throw err;
    }

    const targetStatus = item.status === WORKFLOW_STATES.OPEN ? WORKFLOW_STATES.INVESTIGATING : item.status;
    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;
    const outboxId = `out_${crypto.randomUUID().slice(0, 8)}`;

    queryHelpers.transaction(() => {
      const result = queryHelpers.run(`
        UPDATE work_items 
        SET assignee_id = ?, status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `, [user.id, targetStatus, id, item.version]);

      if (result.changes === 0) {
        const err = new Error('Claim conflict: another user claimed or modified this item simultaneously.');
        err.statusCode = 409;
        throw err;
      }

      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, from_value, to_value, note)
        VALUES (?, ?, ?, ?, 'CLAIMED', ?, ?, ?)
      `, [
        activityId,
        id,
        user.id,
        user.name,
        item.assignee_id || 'unassigned',
        user.name,
        `Claimed ownership by ${user.name}`
      ]);

      queryHelpers.run(`
        INSERT INTO outbox (id, work_item_id, event_type, payload, status)
        VALUES (?, ?, 'NOTIFICATION_DISPATCH', ?, 'PENDING')
      `, [
        outboxId,
        id,
        JSON.stringify({ type: 'OWNERSHIP_CLAIMED', assignee: user.name, item_id: id })
      ]);
    });

    const updated = this.getWorkItem(id, user);
    sseManager.broadcast('work_item_updated', updated);
    return updated;
  }

  /**
   * Reassign to another user or team
   */
  static assignWorkItem(id, newAssigneeId, expectedVersion, user) {
    const item = queryHelpers.get('SELECT * FROM work_items WHERE id = ?', [id]);
    if (!item) {
      const err = new Error(`Work item '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (expectedVersion !== undefined && expectedVersion !== null && parseInt(expectedVersion, 10) !== item.version) {
      const err = new Error(`OCC Conflict: Item version mismatch.`);
      err.statusCode = 409;
      throw err;
    }

    const auth = checkPermission(user, 'ASSIGN', item);
    if (!auth.allowed) {
      const err = new Error(auth.reason);
      err.statusCode = 403;
      throw err;
    }

    const targetUser = newAssigneeId ? queryHelpers.get('SELECT name FROM users WHERE id = ?', [newAssigneeId]) : null;
    const targetName = targetUser ? targetUser.name : 'Unassigned';

    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;
    queryHelpers.transaction(() => {
      const result = queryHelpers.run(`
        UPDATE work_items 
        SET assignee_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `, [newAssigneeId || null, id, item.version]);

      if (result.changes === 0) {
        const err = new Error('Reassign conflict: Item was changed concurrently.');
        err.statusCode = 409;
        throw err;
      }

      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, from_value, to_value, note)
        VALUES (?, ?, ?, ?, 'REASSIGNED', ?, ?, ?)
      `, [
        activityId,
        id,
        user.id,
        user.name,
        item.assignee_id || 'unassigned',
        targetName,
        `Assigned to ${targetName} by ${user.name}`
      ]);
    });

    const updated = this.getWorkItem(id, user);
    sseManager.broadcast('work_item_updated', updated);
    return updated;
  }

  /**
   * State Machine Transition with guard enforcement
   */
  static transitionStatus(id, targetStatus, expectedVersion, context = {}, user) {
    const item = queryHelpers.get('SELECT * FROM work_items WHERE id = ?', [id]);
    if (!item) {
      const err = new Error(`Work item '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (expectedVersion !== undefined && expectedVersion !== null && parseInt(expectedVersion, 10) !== item.version) {
      const err = new Error(`OCC Conflict: Work item was updated before status transition.`);
      err.statusCode = 409;
      err.currentVersion = item.version;
      err.serverItem = this.getWorkItem(id, user);
      throw err;
    }

    const auth = checkPermission(user, 'TRANSITION', item);
    if (!auth.allowed) {
      const err = new Error(auth.reason);
      err.statusCode = 403;
      throw err;
    }

    // STATE MACHINE VALIDATION
    const validation = validateStateTransition(item, targetStatus, context);
    if (!validation.valid) {
      const err = new Error(validation.reason);
      err.statusCode = 422; // Unprocessable Entity
      throw err;
    }

    const blockedReason = targetStatus === WORKFLOW_STATES.BLOCKED ? (context.blocked_reason || item.blocked_reason) : null;
    const nextAction = context.next_action || item.next_action;

    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;
    const outboxId = `out_${crypto.randomUUID().slice(0, 8)}`;

    queryHelpers.transaction(() => {
      const result = queryHelpers.run(`
        UPDATE work_items 
        SET status = ?, blocked_reason = ?, next_action = ?, 
            version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `, [targetStatus, blockedReason, nextAction, id, item.version]);

      if (result.changes === 0) {
        const err = new Error('Status transition conflict: Concurrent update occurred.');
        err.statusCode = 409;
        throw err;
      }

      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, from_value, to_value, note)
        VALUES (?, ?, ?, ?, 'STATUS_CHANGED', ?, ?, ?)
      `, [
        activityId,
        id,
        user.id,
        user.name,
        item.status,
        targetStatus,
        context.note || `Status transitioned from ${item.status} to ${targetStatus}`
      ]);

      queryHelpers.run(`
        INSERT INTO outbox (id, work_item_id, event_type, payload, status)
        VALUES (?, ?, 'AUDIT_LEDGER_ENRICH', ?, 'PENDING')
      `, [
        outboxId,
        id,
        JSON.stringify({ transition: `${item.status} -> ${targetStatus}`, actor: user.name, work_item_id: id })
      ]);
    });

    const updated = this.getWorkItem(id, user);
    sseManager.broadcast('work_item_updated', updated);
    return updated;
  }

  /**
   * Request formal approval for high-risk work item
   */
  static requestApproval(id, note, expectedVersion, user) {
    const item = queryHelpers.get('SELECT * FROM work_items WHERE id = ?', [id]);
    if (!item) throw Object.assign(new Error('Work item not found'), { statusCode: 404 });

    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;
    const outboxId = `out_${crypto.randomUUID().slice(0, 8)}`;

    queryHelpers.transaction(() => {
      const result = queryHelpers.run(`
        UPDATE work_items 
        SET requires_approval = 1, approval_status = 'REQUESTED', status = 'PENDING_APPROVAL',
            approval_note = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `, [note || 'Formal approval requested', id, item.version]);

      if (result.changes === 0) {
        throw Object.assign(new Error('Approval request conflict'), { statusCode: 409 });
      }

      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, from_value, to_value, note)
        VALUES (?, ?, ?, ?, 'APPROVAL_REQUESTED', 'NONE', 'REQUESTED', ?)
      `, [activityId, id, user.id, user.name, note || 'Approval requested']);

      queryHelpers.run(`
        INSERT INTO outbox (id, work_item_id, event_type, payload, status)
        VALUES (?, ?, 'NOTIFICATION_DISPATCH', ?, 'PENDING')
      `, [
        outboxId,
        id,
        JSON.stringify({ type: 'APPROVAL_NEEDED', target_team: item.team_id, item_id: id, requested_by: user.name })
      ]);
    });

    const updated = this.getWorkItem(id, user);
    sseManager.broadcast('work_item_updated', updated);
    return updated;
  }

  /**
   * Approve or reject formal approval request
   */
  static decideApproval(id, decision, note, expectedVersion, user) {
    const item = queryHelpers.get('SELECT * FROM work_items WHERE id = ?', [id]);
    if (!item) throw Object.assign(new Error('Work item not found'), { statusCode: 404 });

    const auth = checkPermission(user, 'APPROVE_OR_REJECT', item);
    if (!auth.allowed) {
      const err = new Error(auth.reason);
      err.statusCode = 403;
      throw err;
    }

    if (!['APPROVED', 'REJECTED'].includes(decision)) {
      throw Object.assign(new Error("Decision must be either 'APPROVED' or 'REJECTED'"), { statusCode: 400 });
    }

    const nextStatus = decision === 'APPROVED' ? WORKFLOW_STATES.INVESTIGATING : WORKFLOW_STATES.BLOCKED;
    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;
    const outboxId = `out_${crypto.randomUUID().slice(0, 8)}`;

    queryHelpers.transaction(() => {
      const result = queryHelpers.run(`
        UPDATE work_items 
        SET approval_status = ?, approved_by = ?, approval_note = ?,
            status = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND version = ?
      `, [decision, user.id, note || `Approval ${decision}`, nextStatus, id, item.version]);

      if (result.changes === 0) {
        throw Object.assign(new Error('Approval decision conflict'), { statusCode: 409 });
      }

      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, from_value, to_value, note)
        VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, ?)
      `, [activityId, id, user.id, user.name, decision, decision, note || `Approval marked ${decision} by ${user.name}`]);

      queryHelpers.run(`
        INSERT INTO outbox (id, work_item_id, event_type, payload, status)
        VALUES (?, ?, 'NOTIFICATION_DISPATCH', ?, 'PENDING')
      `, [
        outboxId,
        id,
        JSON.stringify({ type: `APPROVAL_${decision}`, decision_by: user.name, item_id: id })
      ]);
    });

    const updated = this.getWorkItem(id, user);
    sseManager.broadcast('work_item_updated', updated);
    return updated;
  }

  /**
   * Collaboration Comments
   */
  static addComment(id, message, isInternal = true, user) {
    const item = queryHelpers.get('SELECT * FROM work_items WHERE id = ?', [id]);
    if (!item) throw Object.assign(new Error('Work item not found'), { statusCode: 404 });

    const auth = checkPermission(user, 'COMMENT', item);
    if (!auth.allowed) throw Object.assign(new Error(auth.reason), { statusCode: 403 });

    if (!message || !message.trim()) {
      throw Object.assign(new Error('Comment message cannot be empty'), { statusCode: 400 });
    }

    const commentId = `cmt_${crypto.randomUUID().slice(0, 8)}`;
    const activityId = `act_${crypto.randomUUID().slice(0, 8)}`;

    queryHelpers.transaction(() => {
      queryHelpers.run(`
        INSERT INTO comments (id, work_item_id, author_id, author_name, author_role, message, is_internal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [commentId, id, user.id, user.name, user.role, message.trim(), isInternal ? 1 : 0]);

      queryHelpers.run(`
        INSERT INTO activity_log (id, work_item_id, actor_id, actor_name, action_type, note)
        VALUES (?, ?, ?, ?, 'COMMENTED', ?)
      `, [activityId, id, user.id, user.name, `Added investigation note: "${message.slice(0, 40)}..."`]);
    });

    const updated = this.getWorkItem(id, user);
    sseManager.broadcast('comment_added', { workItemId: id, commentId });
    return updated;
  }
}
