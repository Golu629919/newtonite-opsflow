// API client layer with Idempotency Key injection, OCC headers, and SSE streaming

let currentUserId = localStorage.getItem('opsflow_user_id') || 'usr_alice';

export function setCurrentUserId(userId) {
  currentUserId = userId;
  localStorage.setItem('opsflow_user_id', userId);
}

export function getCurrentUserId() {
  return currentUserId;
}

export async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'X-User-Id': currentUserId,
    ...(options.headers || {})
  };

  // Automatically attach Idempotency-Key for mutating requests if not already provided
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method?.toUpperCase());
  if (isMutating && !headers['Idempotency-Key']) {
    headers['Idempotency-Key'] = `key_${crypto.randomUUID()}`;
  }

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const error = new Error(data.message || `Request failed with status ${response.status}`);
    error.status = response.status;
    error.data = data;
    error.isConflict = response.status === 409;
    error.isForbidden = response.status === 403;
    error.isUnprocessable = response.status === 422;
    throw error;
  }

  return {
    data,
    status: response.status,
    isIdempotentReplay: response.headers.get('x-idempotent-replay') === 'true',
    idempotencyKey: response.headers.get('x-idempotency-key')
  };
}

// SSE Live Event Subscriber
export function subscribeToEvents(onEvent, onError) {
  const eventSource = new EventSource('/api/events/stream');

  eventSource.addEventListener('connected', (e) => {
    onEvent({ type: 'CONNECTED', data: JSON.parse(e.data) });
  });

  eventSource.addEventListener('work_item_created', (e) => {
    onEvent({ type: 'WORK_ITEM_CREATED', data: JSON.parse(e.data) });
  });

  eventSource.addEventListener('work_item_updated', (e) => {
    onEvent({ type: 'WORK_ITEM_UPDATED', data: JSON.parse(e.data) });
  });

  eventSource.addEventListener('comment_added', (e) => {
    onEvent({ type: 'COMMENT_ADDED', data: JSON.parse(e.data) });
  });

  eventSource.addEventListener('outbox_event', (e) => {
    onEvent({ type: 'OUTBOX_EVENT', data: JSON.parse(e.data) });
  });

  eventSource.onerror = (err) => {
    if (onError) onError(err);
  };

  return () => {
    eventSource.close();
  };
}
