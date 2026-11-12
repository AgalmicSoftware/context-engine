// A session Worker answers this 503 when its session coordinator is briefly
// overloaded, before the request has any effect. Requests that are safe to
// send again wait a moment and retry instead of failing.
export const SESSION_COORDINATOR_UNAVAILABLE = 'Session config coordination is unavailable; retry.';

const RETRY_DELAYS_MS = [400, 1000, 2000];
const READ_PATHS = /\/(capabilities|storage\/(list|read|read-batch)|realtime\/call)$/;

const wait = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(timer), reject(signal.reason)), { once: true });
  });

// Reads, and answer uploads that carry a request id the Worker replays rather
// than stores twice. Streamed bodies cannot be sent again.
const replaySafe = (url: string, init: RequestInit) => {
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  const body = init.body;
  if (body != null && typeof body !== 'string' && !(body instanceof FormData)) return false;
  const path = new URL(url, 'https://worker.invalid').pathname;
  if (READ_PATHS.test(path)) return true;
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
      if (!safe || response.status !== 503 || attempt >= RETRY_DELAYS_MS.length) return response;
      const body = await response
        .clone()
        .json()
        .catch(() => null);
      if (body?.error !== SESSION_COORDINATOR_UNAVAILABLE) return response;
      // Spread retries so a crowd does not return in step.
      await wait(RETRY_DELAYS_MS[attempt] * (0.5 + Math.random()), init.signal);
    }
  };
