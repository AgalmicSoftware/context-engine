import { authorityError } from './authority.mjs';
const inFlight = new Map();
const activeSessions = new Set();

// Coalesce one principal's run in an isolate; the coordinated daily provider
// budget below remains authoritative across isolates and provider retries.
export async function runBoundedPoster(context, identity, generate) {
  const session = context.sessionId;
  const key = JSON.stringify([session, context.auth?.delegation?.principal?.principalId, identity]);
  if (inFlight.has(key)) return inFlight.get(key);
  if (activeSessions.has(session)) throw authorityError('agent_poster_busy', 429);
  activeSessions.add(session);
  const promise = Promise.resolve().then(generate).finally(() => { inFlight.delete(key); activeSessions.delete(session); });
  inFlight.set(key, promise);
  return promise;
}
