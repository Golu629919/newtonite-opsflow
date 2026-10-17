import test from 'node:test';
import assert from 'node:assert/strict';
import { app } from '../server/index.js';
import { queryHelpers } from '../server/db.js';

test('Critical Behaviour 3: Idempotency Key prevents duplicate ticket creation and repeated mutations', async (t) => {
  // Start server on an ephemeral port for the test
  const server = await new Promise(resolve => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;

  t.after(() => {
    server.close();
  });

  const idempotencyKey = `test-key-${Date.now()}`;
  const payload = {
    title: 'Idempotency Payment Reconciliation Ticket',
    type: 'PAYMENT_INVESTIGATION',
    priority: 'P1_HIGH',
    team_id: 'team-payments',
    why_it_exists: 'Network timeout retry simulation',
    next_action: 'Check bank statement'
  };

  const initialCount = queryHelpers.get('SELECT COUNT(*) as c FROM work_items WHERE title = ?', [payload.title])?.c || 0;

  // 1. First HTTP Request with Idempotency-Key
  const res1 = await fetch(`${baseUrl}/work-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': 'usr_bob',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  assert.equal(res1.status, 201, 'First request should create item with 201 Created');
  const data1 = await res1.json();
  assert.ok(data1.id, 'Should return created work item');

  // 2. Second HTTP Request with EXACT SAME Idempotency-Key (simulating retry / double click)
  const res2 = await fetch(`${baseUrl}/work-items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': 'usr_bob',
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(payload)
  });

  assert.equal(res2.status, 201, 'Second request should return 201 identical cached response');
  assert.equal(res2.headers.get('x-idempotent-replay'), 'true', 'Must include X-Idempotent-Replay header');

  const data2 = await res2.json();
  assert.equal(data2.id, data1.id, 'Returned IDs must be identical');

  // 3. Verify Database: Only ONE row must exist in work_items
  const finalCount = queryHelpers.get('SELECT COUNT(*) as c FROM work_items WHERE title = ?', [payload.title])?.c || 0;
  assert.equal(finalCount, initialCount + 1, 'Exactly one work item must have been created in database');
});
