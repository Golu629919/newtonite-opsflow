import { queryHelpers } from './db.js';
import { sseManager } from './sse.js';

class OutboxWorker {
  constructor() {
    this.intervalId = null;
    this.isProcessing = false;
  }

  start(intervalMs = 2000) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.processNextBatch(), intervalMs);
    console.log(`[OutboxWorker] Started background processing worker (poll interval: ${intervalMs}ms)`);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async processNextBatch() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      // Pick pending events that are ready for execution
      const jobs = queryHelpers.all(`
        SELECT * FROM outbox 
        WHERE (status = 'PENDING' OR status = 'RETRYING')
          AND datetime(next_attempt_at) <= datetime('now')
        ORDER BY created_at ASC 
        LIMIT 5
      `);

      for (const job of jobs) {
        await this.processJob(job);
      }
    } catch (err) {
      console.error('[OutboxWorker] Error during batch processing:', err);
    } finally {
      this.isProcessing = false;
    }
  }

  async processJob(job) {
    // Optimistically mark as PROCESSING
    queryHelpers.run(`UPDATE outbox SET status = 'PROCESSING' WHERE id = ?`, [job.id]);

    let payload = {};
    try {
      payload = JSON.parse(job.payload);
    } catch (e) {
      payload = { raw: job.payload };
    }

    try {
      // Simulate real asynchronous secondary operations
      await this.executeJobHandler(job.event_type, payload);

      // On Success
      queryHelpers.run(`
        UPDATE outbox 
        SET status = 'COMPLETED', 
            processed_at = CURRENT_TIMESTAMP, 
            last_error = NULL 
        WHERE id = ?
      `, [job.id]);

      sseManager.broadcast('outbox_event', {
        type: 'JOB_COMPLETED',
        jobId: job.id,
        eventType: job.event_type,
        workItemId: job.work_item_id
      });
    } catch (jobErr) {
      const nextRetryCount = job.retry_count + 1;
      const isDeadLetter = nextRetryCount >= job.max_retries;
      const backoffSeconds = Math.pow(2, nextRetryCount) * 2; // 4s, 8s, 16s
      const nextAttempt = new Date(Date.now() + backoffSeconds * 1000).toISOString();

      const newStatus = isDeadLetter ? 'DEAD_LETTER' : 'RETRYING';

      queryHelpers.run(`
        UPDATE outbox 
        SET status = ?, 
            retry_count = ?, 
            next_attempt_at = ?, 
            last_error = ?
        WHERE id = ?
      `, [newStatus, nextRetryCount, nextAttempt, jobErr.message, job.id]);

      sseManager.broadcast('outbox_event', {
        type: isDeadLetter ? 'JOB_DEAD_LETTER' : 'JOB_FAILED_RETRYING',
        jobId: job.id,
        eventType: job.event_type,
        retryCount: nextRetryCount,
        maxRetries: job.max_retries,
        error: jobErr.message
      });
    }
  }

  async executeJobHandler(eventType, payload) {
    // If simulation flag is explicitly passed to test retry & dead letter handling
    if (payload.simulate_failure) {
      // Simulate external webhook/email gateway downtime
      throw new Error(`External Gateway Timeout (Simulated Failure for demonstration: ${payload.failure_reason || '503 Service Unavailable'})`);
    }

    switch (eventType) {
      case 'NOTIFICATION_DISPATCH':
        // Simulated Slack / Email dispatch
        await new Promise(res => setTimeout(res, 80));
        break;

      case 'AUDIT_LEDGER_ENRICH':
        // SLA & metric calculation
        await new Promise(res => setTimeout(res, 50));
        break;

      case 'SLA_MONITOR':
        // High priority incident alert dispatch
        await new Promise(res => setTimeout(res, 60));
        break;

      default:
        await new Promise(res => setTimeout(res, 40));
        break;
    }
  }

  // Trigger immediate manual retry for an outbox job (useful for operators in UI)
  retryJob(jobId) {
    const job = queryHelpers.get('SELECT * FROM outbox WHERE id = ?', [jobId]);
    if (!job) throw new Error('Outbox job not found');

    queryHelpers.run(`
      UPDATE outbox 
      SET status = 'PENDING', 
          next_attempt_at = CURRENT_TIMESTAMP, 
          last_error = NULL 
      WHERE id = ?
    `, [jobId]);

    // Kick the worker
    this.processNextBatch();
    return queryHelpers.get('SELECT * FROM outbox WHERE id = ?', [jobId]);
  }
}

export const outboxWorker = new OutboxWorker();
