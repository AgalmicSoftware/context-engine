import { SESSION_COORDINATOR_UNAVAILABLE } from '../../shared/sessionCoordinatorBusy.mjs';

// checkRateLimit answers null when the count could not be reached. That is
// refused too, but as busy: nothing has happened yet, so clients send it again.
export const rateLimitRefusal = (allowed, json, headers) => (allowed === null
  ? json?.({ error: SESSION_COORDINATOR_UNAVAILABLE, reason: 'rate_limit_unavailable' }, 503, headers)
  : json?.({ error: 'Rate limit exceeded.' }, 429, headers));
