// A session Worker's answer (503) when its session coordinator is briefly
// overloaded, before the request has had any effect. Clients send a request
// that is safe to repeat again after these delays, with jitter.
export const SESSION_COORDINATOR_UNAVAILABLE = 'Session config coordination is unavailable; retry.';
export const COORDINATOR_RETRY_DELAYS_MS = Object.freeze([400, 1000, 2000]);
