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

// An upload's fields, read from its form or JSON body.
const uploadField = (body: RequestInit['body'], field: string): string => {
  if (body instanceof FormData) return String(body.get(field) || '');
  if (typeof body !== 'string') return '';
  try {
    return String(JSON.parse(body || '{}')[field] || '');
  } catch {
    return '';
  }
};

// Reads, group joins, and answer uploads that carry a request id the Worker
// replays rather than stores twice. Streamed bodies cannot be sent again.
const replaySafe = (url: string, init: RequestInit) => {
  const method = (init.method || 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  const body = init.body;
  if (body != null && typeof body !== 'string' && !(body instanceof FormData)) return false;
  const path = new URL(url, 'https://worker.invalid').pathname;
  if (READ_PATHS.test(path) || REPEATABLE_WRITE_PATHS.test(path)) return true;
  return path.endsWith('/storage/upload') && !!uploadField(body, 'requestId');
};

// A Worker with its session coordinator (every Worker deployed by the deploy helper or from the template) stores an
// answer upload with a request id once, whatever becomes of its reply: sent again, it gets the copy already stored.
// So it is also sent again when no reply came (the connection dropped, or a gateway answered for the Worker).
// Otherwise the answer is saved while the page says it failed.
// Limit: the Worker takes that receipt only for a signed-in person's 'responses' upload on a Worker with its
// coordinator bound. Only those uploads are sent again after no reply; an older or custom Worker without the
// coordinator may still keep the repeat as a second version of the answer, never losing one.
const RECEIPT_RESOURCE = 'responses';
const NO_REPLY_STATUSES = new Set([502, 504]);
// The Worker holds a send it is still storing for up to two minutes, and answers a repeat sent meanwhile with
// 'upload_in_progress', changing nothing. So a repeat that hears this asks again for about half a minute, while
// Submit counts the seconds, before the page passes on the Worker's answer. That answer is not a failure: the
// upload parser says so plainly, and Submit pressed again sends the same request id, so it replays.
export const UPLOAD_IN_PROGRESS = 'upload_in_progress';
const UPLOAD_IN_PROGRESS_DELAYS_MS = [1000, 2000, 4000, 6000, 8000, 8000];
// Each wait runs from 75% to 125% of its planned length, so a crowd does not return in step.
const WAIT_JITTER_MIN = 0.75;
const WAIT_JITTER_SPAN = 0.5;
const uploadInProgressDelayMs = (waits: number): number | null =>
  waits < UPLOAD_IN_PROGRESS_DELAYS_MS.length
    ? UPLOAD_IN_PROGRESS_DELAYS_MS[waits] * (WAIT_JITTER_MIN + Math.random() * WAIT_JITTER_SPAN)
    : null;

export const withCoordinatorRetry =
  (fetchImpl: typeof fetch = fetch) =>
  async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    const safe = !(input instanceof Request) && replaySafe(url, init);
    const answerUpload =
      safe &&
      new URL(url, 'https://worker.invalid').pathname.endsWith('/storage/upload') &&
      uploadField(init.body, 'resource') === RECEIPT_RESOURCE;
    // Sends again after a busy coordinator or no reply, and, counted apart, after an answer still being stored.
    let retries = 0;
    let waits = 0;
    for (;;) {
      let response: Response;
      try {
        response = await fetchImpl(input, init);
      } catch (error) {
        // A failed fetch is a TypeError; one the page cancelled is not sent again.
        const resend = answerUpload && error instanceof TypeError && !init.signal?.aborted;
        const delayMs = resend ? coordinatorRetryDelayMs(retries++) : null;
        if (delayMs == null) throw error;
        await wait(delayMs, init.signal);
        continue;
      }
      if (!safe) return response;
      let delayMs: number | null = null;
      if (answerUpload && NO_REPLY_STATUSES.has(response.status)) {
        delayMs = coordinatorRetryDelayMs(retries++);
      } else if (response.status === 503) {
        const body = await response
          .clone()
          .json()
          .catch(() => null);
        if (answerUpload && body?.reason === UPLOAD_IN_PROGRESS) delayMs = uploadInProgressDelayMs(waits++);
        else if (isRetryableBusy(response.status, body)) delayMs = coordinatorRetryDelayMs(retries++);
      }
      if (delayMs == null) return response;
      // Spread so a crowd does not return in step.
      await wait(delayMs, init.signal);
    }
  };

// A sign-in request (a nonce, a login) that got no reply. It is marked so that nothing sends the whole call again
// on its account: a second try would ask the person to sign a second time.
const signInRequestFailures = new WeakSet<object>();

export const asSignInRequestFailure = (error: unknown): never => {
  if (error && typeof error === 'object') signInRequestFailures.add(error);
  throw error;
};

export const isSignInRequestFailure = (error: unknown): boolean =>
  !!error && typeof error === 'object' && signInRequestFailures.has(error);
