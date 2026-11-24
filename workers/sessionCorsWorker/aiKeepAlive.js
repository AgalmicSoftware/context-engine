// An AI reply can take minutes, and a connection that carries nothing for that long can be cut on the way: a
// phone's browser drops a request it thinks is idle. A caller that asks for it (`keepAlive: true` in the request)
// is answered at once, and a space is sent every few seconds until the reply is ready, then the reply itself.
// Spaces before JSON are allowed, so a reader that parses the whole body gets the same object as before.
//
// The status is sent before the outcome is known, so it is always 200. A failure is told in the body as before,
// `{ error, ... }`, with the status it would have had as `status`. Only the provider call is answered this way:
// sign-in, limits and the other refusals before it keep their own status, which callers act on.
export const AI_KEEP_ALIVE_INTERVAL_MS = 10_000;

export const asksForAiKeepAlive = (payload) => payload?.keepAlive === true;

const failureBody = (data, status, retryAfter = '') => ({
  ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}),
  error: String((data && data.error) || 'AI request failed'),
  status,
  // The header it would have come with can't be sent after the status.
  ...(retryAfter ? { retryAfter } : {}),
});

/**
 * @param {() => Promise<Response>} call the provider call, as the route would have returned it
 * @param {HeadersInit} baseHeaders the route's headers (CORS)
 */
export const keepAliveAiResponse = (call, baseHeaders, { intervalMs = AI_KEEP_ALIVE_INTERVAL_MS } = {}) => {
  const headers = new Headers(baseHeaders);
  headers.set('Content-Type', 'application/json');
  headers.set('Cache-Control', 'no-store');
  headers.delete('Content-Length');
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  // A write fails only when the reader has gone; there is then nothing left to tell.
  const write = (text) => writer.write(encoder.encode(text)).catch(() => {});
  const run = async () => {
    // One space at once, so the answer starts before anything is waited on.
    void write(' ');
    const timer = setInterval(() => void write(' '), intervalMs);
    let text;
    try {
      const response = await call();
      const data = await response.json().catch(() => null);
      text = JSON.stringify(
        response.ok && data && typeof data === 'object'
          ? data
          : failureBody(data, response.status, response.headers?.get?.('retry-after') || ''),
      );
    } catch {
      text = JSON.stringify(failureBody(null, 500));
    } finally {
      clearInterval(timer);
    }
    await write(text);
    await writer.close().catch(() => {});
  };
  void run();
  return new Response(readable, { status: 200, headers });
};

// The route's provider call, answered either way.
export const answerAiCall = async (payload, call, baseHeaders) =>
  asksForAiKeepAlive(payload) ? keepAliveAiResponse(call, baseHeaders) : call();
