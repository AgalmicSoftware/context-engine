// An AI reply can take minutes, and a connection that carries nothing for that long can be cut on the way: a
// phone's browser drops a request it thinks is idle. A caller that asks for it (`keepAlive: true` in the request)
// is answered at once, and a space is sent every few seconds until the reply is ready, then the reply itself.
// Spaces before JSON are allowed, so a reader that parses the whole body gets the same object as before.
//
// The status is sent before the outcome is known, so it is always 200. A failure is told in the body as before,
// `{ error, ... }`, with the status it would have had as `status`. That includes the provider adapter's own refusals
// (no AI key, a model the session doesn't allow, a custom RPC's refusal), which no caller acts on by status. Sign-in,
// limits and the other refusals before the adapter keep their own status, which callers act on. Cloudflare's
// analytics count a failed call answered this way as a 200.
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
  // No compression on the way: a compressor may hold the spaces back until it has enough to send.
  headers.set('Cache-Control', 'no-store, no-transform');
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
    } catch (error) {
      // As the route would have done had it thrown there: logged, and its message passed on.
      console.error('[ai] provider call failed', error?.message);
      text = JSON.stringify(failureBody({ error: error?.message }, 500));
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
