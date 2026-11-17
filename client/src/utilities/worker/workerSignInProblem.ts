import { isWalletRejectionError } from '../web3/errorClassifiers';
import { getWorkerAuthRemoteErrorMessage } from './workerAuthRemoteError';

// The Worker's own sentences that say when to try again; its other failures are technical.
const PLAIN_WORKER_REASONS = new Set(['worker_auth_busy_sign_in', 'worker_auth_rate_limited']);

// A passkey prompt dismissed, timed out or refused by the browser (a page not in front) is a DOMException by name.
const PROMPT_REFUSALS = new Set(['NotAllowedError', 'AbortError']);

/**
 * A failed sign-in to a session's Worker as one plain sentence. Never the provider's own text, which carries the
 * account's address, the sign-in message's nonce and the Worker's URL.
 */
export const workerSignInProblem = (error: unknown): string => {
  if (isWalletRejectionError(error) || PROMPT_REFUSALS.has(String((error as { name?: unknown } | null)?.name)))
    return 'Sign-in was cancelled.';
  const remote = getWorkerAuthRemoteErrorMessage(error);
  return remote && PLAIN_WORKER_REASONS.has(String((error as { reason?: unknown }).reason))
    ? remote
    : 'Sign-in didn’t work.';
};
