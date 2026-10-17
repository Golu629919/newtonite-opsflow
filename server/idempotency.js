import crypto from 'node:crypto';
import { queryHelpers } from './db.js';

/**
 * Idempotency Middleware:
 * Protects mutating endpoints against duplicate execution caused by network timeouts,
 * retries, or impatient double clicks.
 */
export function idempotencyMiddleware(req, res, next) {
  // Only apply to mutating requests
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'];
  if (!idempotencyKey) {
    return next();
  }

  const userId = req.user?.id || 'anonymous';
  const route = `${req.method} ${req.baseUrl || ''}${req.path}`;
  const requestHash = crypto.createHash('sha256').update(JSON.stringify(req.body || {})).digest('hex');

  // Check existing key
  const existing = queryHelpers.get('SELECT * FROM idempotency_keys WHERE key = ?', [idempotencyKey]);

  if (existing) {
    // If request is still in-flight
    if (!existing.status_code) {
      const lockTime = new Date(existing.locked_until).getTime();
      if (Date.now() < lockTime) {
        return res.status(409).json({
          error: 'CONCURRENT_REQUEST',
          message: 'An identical request with this Idempotency-Key is currently processing. Please wait.'
        });
      }
    }

    // Cached response exists: replay it without re-executing
    res.setHeader('X-Idempotent-Replay', 'true');
    res.setHeader('X-Idempotency-Key', idempotencyKey);
    return res.status(existing.status_code).json(JSON.parse(existing.response_body));
  }

  // Record in-flight lock (valid for 30 seconds)
  const lockUntil = new Date(Date.now() + 30000).toISOString();
  try {
    queryHelpers.run(`
      INSERT INTO idempotency_keys (key, user_id, route, request_hash, locked_until)
      VALUES (?, ?, ?, ?, ?)
    `, [idempotencyKey, userId, route, requestHash, lockUntil]);
  } catch (err) {
    // Handle rare race condition where two identical keys hit at the exact same millisecond
    return res.status(409).json({
      error: 'IDEMPOTENCY_RACE_CONDITION',
      message: 'Concurrent submission detected with the same Idempotency-Key.'
    });
  }

  // Intercept response to store result
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    try {
      queryHelpers.run(`
        UPDATE idempotency_keys
        SET status_code = ?, response_body = ?, locked_until = NULL
        WHERE key = ?
      `, [res.statusCode, JSON.stringify(body), idempotencyKey]);
    } catch (saveErr) {
      console.error('Failed to cache idempotent response:', saveErr);
    }
    res.setHeader('X-Idempotency-Key', idempotencyKey);
    return originalJson(body);
  };

  next();
}
