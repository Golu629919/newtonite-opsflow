import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkItemService } from '../server/service.js';
import { getUserWithTeams, checkPermission } from '../server/auth.js';

test('Critical Behaviour 4: Resource-level multi-team authorization and role boundaries', async (t) => {
  const frankViewer = getUserWithTeams('usr_frank'); // Viewer (Auditor)
  const daveSupport = getUserWithTeams('usr_dave');   // Member of Support
  const aliceEng = getUserWithTeams('usr_alice');     // Lead of Eng

  // 1. Fetch an existing Engineering work item
  const engItem = WorkItemService.getWorkItem('OPS-1001', aliceEng);
  assert.equal(engItem.team_id, 'team-eng');

  // 2. Viewer (Frank) attempting to edit details must be rejected (403 Forbidden)
  const permViewer = checkPermission(frankViewer, 'UPDATE_DETAILS', engItem);
  assert.equal(permViewer.allowed, false);
  assert.match(permViewer.reason, /viewer/i);

  assert.throws(() => {
    WorkItemService.updateWorkItem('OPS-1001', { title: 'Unauthorized modification' }, engItem.version, frankViewer);
  }, (err) => {
    assert.equal(err.statusCode, 403);
    return true;
  });

  // 3. Dave (Customer Support) attempting to claim an item in Engineering team must be rejected by team boundary
  const permDave = checkPermission(daveSupport, 'CLAIM', engItem);
  assert.equal(permDave.allowed, false);
  assert.match(permDave.reason, /Team Boundary/i);

  assert.throws(() => {
    WorkItemService.claimWorkItem('OPS-1001', engItem.version, daveSupport);
  }, (err) => {
    assert.equal(err.statusCode, 403);
    return true;
  });

  // 4. Confidential Compliance Item reading restriction
  const complianceItem = WorkItemService.getWorkItem('OPS-1003', getUserWithTeams('usr_carol'));
  const permReadDave = checkPermission(daveSupport, 'READ', complianceItem);
  // Dave is creator of OPS-1003 in seed, so he can read his own. Let's test with Bob (Payments) who is neither creator nor compliance member:
  const bob = getUserWithTeams('usr_bob');
  const permReadBob = checkPermission(bob, 'READ', complianceItem);
  assert.equal(permReadBob.allowed, false, 'Non-compliance user should not have access to confidential compliance request');
});
