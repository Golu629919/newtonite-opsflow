// Operational Workflow State Machine & Transition Guards

export const WORKFLOW_STATES = {
  OPEN: 'OPEN',
  INVESTIGATING: 'INVESTIGATING',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  BLOCKED: 'BLOCKED',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

// Allowed state transitions graph
export const ALLOWED_TRANSITIONS = {
  OPEN: ['INVESTIGATING', 'PENDING_APPROVAL', 'BLOCKED', 'CLOSED'],
  INVESTIGATING: ['OPEN', 'PENDING_APPROVAL', 'BLOCKED', 'RESOLVED', 'CLOSED'],
  PENDING_APPROVAL: ['INVESTIGATING', 'BLOCKED', 'RESOLVED'],
  BLOCKED: ['INVESTIGATING', 'OPEN', 'PENDING_APPROVAL'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: ['OPEN'] // Re-opening a closed item
};

/**
 * Validates whether a state transition is legal according to workflow state graph
 * and business guard rules.
 */
export function validateStateTransition(workItem, targetStatus, context = {}) {
  const currentStatus = workItem.status;

  if (currentStatus === targetStatus) {
    return {
      valid: false,
      reason: `Work item is already in status '${currentStatus}'.`
    };
  }

  // Check state machine edge
  const validNextStates = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!validNextStates.includes(targetStatus)) {
    return {
      valid: false,
      reason: `Illegal state transition from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${validNextStates.join(', ')}].`
    };
  }

  // Guard Rule 1: Approval requirement
  if ((targetStatus === WORKFLOW_STATES.RESOLVED || targetStatus === WORKFLOW_STATES.CLOSED)) {
    if (workItem.requires_approval && workItem.approval_status !== 'APPROVED') {
      return {
        valid: false,
        reason: `Workflow Guard Violation: This item requires formal approval before it can be marked as '${targetStatus}'. Current approval status: '${workItem.approval_status}'.`
      };
    }
  }

  // Guard Rule 2: Cannot resolve unassigned work item
  if (targetStatus === WORKFLOW_STATES.RESOLVED && !workItem.assignee_id) {
    return {
      valid: false,
      reason: `Ownership Required: A work item cannot be resolved without an assigned owner taking responsibility.`
    };
  }

  // Guard Rule 3: Moving to BLOCKED requires a reason
  if (targetStatus === WORKFLOW_STATES.BLOCKED && !context.blocked_reason && !workItem.blocked_reason) {
    return {
      valid: false,
      reason: `Information Missing: Transitioning to 'BLOCKED' requires providing a specific blocked_reason.`
    };
  }

  // Guard Rule 4: Re-opening closed item requires justification
  if (currentStatus === WORKFLOW_STATES.CLOSED && targetStatus === WORKFLOW_STATES.OPEN && !context.reopen_reason) {
    return {
      valid: false,
      reason: `Audit Compliance: Re-opening a permanently closed work item requires providing a reopen_reason.`
    };
  }

  return { valid: true };
}
