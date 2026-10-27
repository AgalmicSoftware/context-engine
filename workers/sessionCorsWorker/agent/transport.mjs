import { authorityError } from './authority.mjs';

export const boundedAgentFetch = (fetchImpl, { timeoutMs = 30_000, maxBytes = 1024 * 1024 } = {}) => async (url, init = {}) => {
  const controller = new AbortController();
  let reader, timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(authorityError('agent_provider_timeout', 502)); }, timeoutMs);
  });
  const execute = async () => {
    const response = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!response.body) return response;
    reader = response.body.getReader();
    const chunks = [];
    let length = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw authorityError('agent_provider_response_too_large', 502);
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new Response(bytes, response);
  };
  try {
    // Race the whole body read as well as fetch: custom transports and stalled
    // streams may ignore AbortSignal, but must not hold queue reconciliation open.
    return await Promise.race([execute(), deadline]);
  } catch (error) {
    controller.abort();
    reader?.cancel().catch(() => {});
    throw authorityError(error.reason || 'agent_provider_unavailable', 502);
  } finally { clearTimeout(timer); try { reader?.releaseLock(); } catch { /* pending stream cancellation */ } }
};
