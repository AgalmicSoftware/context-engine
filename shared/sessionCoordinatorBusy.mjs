// A session Worker's answer (503) when its session coordinator is briefly
// overloaded, before the request has had any effect; for a group join, it may
// also mean the join's outcome is not yet known (joining again is harmless).
// Clients send a request that is safe to repeat again after these delays, with
// jitter.
export const SESSION_COORDINATOR_UNAVAILABLE = 'Session config coordination is unavailable; retry.';
export const COORDINATOR_RETRY_DELAYS_MS = Object.freeze([400, 1000, 2000]);
