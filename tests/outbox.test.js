import test from 'node:test';
import assert from 'node:assert/strict';
import { WorkItemService } from '../server/service.js';
import { outboxWorker } from '../server/outboxWorker.js';
import { queryHelpers } from '../server/db.js';
import { getUserWithTeams } from '../server/auth.js';

test('Critical Behaviour 5: Transactional outbox pattern and asynchronous retry processing', async (t) => {
  const alice = getUserWithTeams('usr_alice');

  // 1. Create a work item configured with simulated outbox failure to test retry backoff
  const item = WorkItemService.createWorkItem({
    title: 'Outbox Test Item with Simulated External Failure',
    type: 'CUSTOMER_ISSUE',
    priority: 'P2_MEDIUM',
    team_id: 'team-ops',
    why_it_exists: 'Testing async worker resiliency',
    next_action: 'Observe outbox worker retries',
    simulate_outbox_failure: true
  }, alice);

  // 2. Verify that outbox record was written atomically in the same transaction
  const outboxRecords = queryHelpers.all('SELECT * FROM outbox WHERE work_item_id = ?', [item.id]);
  assert.ok(outboxRecords.length >= 1, 'Outbox event must exist in database');

  const pendingJob = outboxRecords[0];
  assert.equal(pendingJob.status, 'PENDING');
  assert.equal(pendingJob.retry_count, 0);

  // 3. Trigger worker processJob directly to simulate worker tick
  await outboxWorker.processJob(pendingJob);

  // 4. Verify that worker caught the failure, set status to RETRYING, incremented retry_count, and set backoff
  const retriedJob = queryHelpers.get('SELECT * FROM outbox WHERE id = ?', [pendingJob.id]);
  assert.equal(retriedJob.status, 'RETRYING');
  assert.equal(retriedJob.retry_count, 1);
  assert.ok(retriedJob.last_error.includes('Simulated Failure'), 'Error message should be logged');

  // 5. Test manual operator recovery via retryJob()
  const resetJob = outboxWorker.retryJob(pendingJob.id);
  assert.equal(resetJob.status, 'PENDING');
  assert.equal(resetJob.last_error, null);
});
