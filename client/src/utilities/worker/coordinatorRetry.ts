import {
  SESSION_COORDINATOR_UNAVAILABLE,
  coordinatorRetryDelayMs,
  isRetryableBusy,
} from '@ce-shared/sessionCoordinatorBusy.mjs';

export { SESSION_COORDINATOR_UNAVAILABLE };

// Requests that are safe to send again wait a moment and retry a 503 the Worker
// marks as safe to send again (a busy coordinator or an unreachable count).
const READ_PATHS = /\/(capabilities|storage\/(list|read|read-batch)|realtime\/call)$/;
// Joining a group again is a no-op that finishes an interrupted join; draft text is
// stored or deleted per question, so sending it twice leaves the same rows. A busy
// nonce request answers before a nonce is issued. A busy sign-in may have spent its
// nonce, so it is not sent again here; sign-in starts over with a new one.
const REPEATABLE_WRITE_PATHS = /\/(groups\/join|storage\/draft-text\/(put|delete)|auth\/nonce)$/;

const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

// Reads, group joins, and answer uploads that carry a request id the Worker
// replays rather than stores twice. Streamed bodies cannot be sent again.
const replaySafe = (url: string, init: RequestInit) => {
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  const body = init.body;
  if (body != null && typeof body !== 'string' && !(body instanceof FormData)) return false;
  const path = new URL(url, 'https://worker.invalid').pathname;
  if (READ_PATHS.test(path) || REPEATABLE_WRITE_PATHS.test(path)) return true;
  if (!path.endsWith('/storage/upload')) return false;
  if (body instanceof FormData) return !!body.get('requestId');
  try {
    return !!JSON.parse(body || '{}').requestId;
  } catch {
    return false;
  }
};

export const withCoordinatorRetry =
  (fetchImpl: typeof fetch = fetch) =>
  async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    const safe = !(input instanceof Request) && replaySafe(url, init);
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(input, init);
      // Spread retries so a crowd does not return in step.
      const delayMs = coordinatorRetryDelayMs(attempt);
      if (!safe || response.status !== 503 || delayMs == null) return response;
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (!isRetryableBusy(response.status, body)) return response;
      await wait(delayMs, init.signal);
    }
  };
