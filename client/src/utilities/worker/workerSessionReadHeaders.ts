import { heldSessionToken } from './workerAuthTokenCache';
import { groupReadHeaders } from './workerGroupReadProof';

/**
 * Headers for a bare read of a session's Worker: this tab's sign-in for the session and its invite proof, each when
 * held. A private session admits either, so a member signed in without an invite, or a guest holding one, reads.
 * Kept apart from the proof store, which session discovery imports, so the token cache adds no import cycle.
 */
export const sessionReadHeaders = (workerUrl: unknown, sessionSlug: unknown): Record<string, string> => {
  const token = heldSessionToken(workerUrl, sessionSlug);
  return { ...groupReadHeaders(workerUrl, sessionSlug), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};
