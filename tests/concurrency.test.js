import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkItemService } from '../server/service.js';
import { queryHelpers } from '../server/db.js';
import { getUserWithTeams } from '../server/auth.js';

test('Critical Behaviour 1: Optimistic Concurrency Control (OCC) prevents lost updates and simultaneous claim collision', async (t) => {
  const alice = getUserWithTeams('usr_alice'); // Eng lead
  const elena = getUserWithTeams('usr_elena'); // Eng admin

  // 1. Create a work item
  const item = WorkItemService.createWorkItem({
    title: 'Race Condition Test Item',
    type: 'ENGINEERING_BUG',
    priority: 'P1_HIGH',
    team_id: 'team-eng',
    why_it_exists: 'Testing simultaneous user interaction',
    next_action: 'Verify concurrency collision'
  }, alice);

  const initialVersion = item.version;
  assert.equal(initialVersion, 1, 'Initial version should be 1');

  // 2. Both Alice and Elena fetch the item at version 1
  const versionKnownByAlice = initialVersion;
  const versionKnownByElena = initialVersion;

  // 3. Alice claims the item first
  const updatedByAlice = WorkItemService.claimWorkItem(item.id, versionKnownByAlice, alice);
  assert.equal(updatedByAlice.assignee_id, alice.id);
  assert.equal(updatedByAlice.version, 2, 'Version should increment to 2 after Alice claims');

  // 4. Elena attempts to claim or update using stale version 1
  assert.throws(() => {
    WorkItemService.claimWorkItem(item.id, versionKnownByElena, elena);
  }, (err) => {
    assert.equal(err.statusCode, 409, 'Must return 409 Conflict');
    assert.match(err.message, /Conflict/i, 'Error message must describe version conflict');
    return true;
  });

  // 5. Verify database integrity: item remains assigned to Alice at version 2
  const finalState = WorkItemService.getWorkItem(item.id, alice);
  assert.equal(finalState.assignee_id, alice.id);
  assert.equal(finalState.version, 2);
});
