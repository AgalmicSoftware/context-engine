// A session Worker's answer (503) when its session coordinator is briefly
// overloaded, before the request has had any effect; for a group join, it may
// also mean the join's outcome is not yet known (joining again is harmless).
// Such an answer carries `retryable: true`. Clients send a request that is safe
// to repeat again after these delays, with jitter; one marked
// `retryable: false` is never sent again.
export const SESSION_COORDINATOR_UNAVAILABLE = 'Session config coordination is unavailable; retry.';
export const COORDINATOR_RETRY_DELAYS_MS = Object.freeze([400, 1000, 2000]);

/** The body of a busy answer that is safe to send again. */
export const coordinatorBusyBody = (extra = {}) => ({ error: SESSION_COORDINATOR_UNAVAILABLE, ...extra, retryable: true });

// Workers before 0.9.10 send the sentence without the field.
export const isRetryableBusy = (status, body) => status === 503 && (
  body?.retryable === true || (body?.retryable === undefined && body?.error === SESSION_COORDINATOR_UNAVAILABLE)
);

/** How long to wait before the next try (attempt 0 is the first retry), spread ±50%; null once the tries run out. */
export const coordinatorRetryDelayMs = (attempt, random = Math.random) => (
  attempt >= 0 && attempt < COORDINATOR_RETRY_DELAYS_MS.length ? COORDINATOR_RETRY_DELAYS_MS[attempt] * (0.5 + random()) : null
);
