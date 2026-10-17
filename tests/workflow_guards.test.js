import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkItemService } from '../server/service.js';
import { getUserWithTeams } from '../server/auth.js';

test('Critical Behaviour 2: Workflow State Machine enforces transition guards and approval requirements', async (t) => {
  const carol = getUserWithTeams('usr_carol'); // Compliance lead
  const bob = getUserWithTeams('usr_bob');     // Regular member (payments)
  const alice = getUserWithTeams('usr_alice'); // Eng lead

  // 1. Create a work item that requires formal approval
  const item = WorkItemService.createWorkItem({
    title: 'High-Value Compliance Refund > $50,000',
    type: 'COMPLIANCE_REQUEST',
    priority: 'P0_CRITICAL',
    team_id: 'team-compliance',
    why_it_exists: 'High-value customer claim requiring compliance sign-off',
    next_action: 'Perform AML check',
    requires_approval: true
  }, carol);

  // Claim ownership
  let current = WorkItemService.claimWorkItem(item.id, item.version, carol);

  // 2. Attempting to transition directly to RESOLVED without approval must be rejected by the state machine
  assert.throws(() => {
    WorkItemService.transitionStatus(item.id, 'RESOLVED', current.version, { note: 'Trying to bypass approval' }, carol);
  }, (err) => {
    assert.equal(err.statusCode, 422, 'Must return 422 Unprocessable Entity');
    assert.match(err.message, /Workflow Guard Violation/i);
    return true;
  });

  // 3. Attempting to transition to BLOCKED without providing a blocked_reason must fail
  assert.throws(() => {
    WorkItemService.transitionStatus(item.id, 'BLOCKED', current.version, { note: 'No blocked reason' }, carol);
  }, (err) => {
    assert.equal(err.statusCode, 422);
    assert.match(err.message, /blocked_reason/i);
    return true;
  });

  // 4. Request formal approval
  current = WorkItemService.requestApproval(item.id, 'Requesting compliance lead sign-off', current.version, carol);
  assert.equal(current.approval_status, 'REQUESTED');
  assert.equal(current.status, 'PENDING_APPROVAL');

  // 5. Unauthorized user (Bob, who is not in Compliance lead role) attempts to approve
  assert.throws(() => {
    WorkItemService.decideApproval(item.id, 'APPROVED', 'Unauthorized approval attempt', current.version, bob);
  }, (err) => {
    assert.equal(err.statusCode, 403, 'Must return 403 Forbidden for unauthorized approver');
    return true;
  });

  // 6. Authorized user (Carol, Compliance Lead) approves
  current = WorkItemService.decideApproval(item.id, 'APPROVED', 'AML verified by Carol', current.version, carol);
  assert.equal(current.approval_status, 'APPROVED');

  // 7. Now transition to RESOLVED succeeds
  const resolved = WorkItemService.transitionStatus(item.id, 'RESOLVED', current.version, { note: 'All sign-offs completed' }, carol);
  assert.equal(resolved.status, 'RESOLVED');
});
