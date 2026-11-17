import { heldSessionToken } from './workerAuthTokenCache';
import { groupReadHeaders, isKnownPrivateSession } from './workerGroupReadProof';

/**
 * Headers for a bare read of a session's Worker: its invite proof when held, and, for a session known to be private,
 * this tab's sign-in for it. A private session admits either, so a member signed in without an invite, or a guest
 * holding one, reads. Workers before private sessions refuse a sign-in on some of these routes (a 0.9.10 Worker
 * answers a signed-in voice call 404), and only a newer Worker makes a session known private, so they never get one.
 * Kept apart from the proof store, which session discovery imports, so the token cache adds no import cycle.
 */
export const sessionReadHeaders = (workerUrl: unknown, sessionSlug: unknown): Record<string, string> => {
  const token = isKnownPrivateSession(workerUrl, sessionSlug) ? heldSessionToken(workerUrl, sessionSlug) : '';
  return { ...groupReadHeaders(workerUrl, sessionSlug), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
