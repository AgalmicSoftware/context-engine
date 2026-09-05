export class BodyByteLimitError extends Error {
  constructor(maxBytes) {
    super(`Body exceeds ${maxBytes} bytes.`);
    this.name = 'BodyByteLimitError';
    this.status = 413;
  }
}

// Read before parsing (or returning an image), so absent/false Content-Length
// cannot turn a bounded operation into unbounded buffering or a partial 200.
export const readBodyBytes = async (source, maxBytes) => {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new RangeError('Invalid byte limit.');
  const reader = source.body?.getReader();
  const declaredLength = Number(source.headers?.get('content-length'));
  let total = 0;
  const chunks = [];
  try {
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new BodyByteLimitError(maxBytes);
    }
    if (!reader) return new Uint8Array();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new BodyByteLimitError(maxBytes);
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } catch (error) {
    try { await reader?.cancel(error); } catch { /* Preserve the original read failure. */ }
    throw error;
  } finally {
    reader?.releaseLock();
  }
};

export const readBodyText = async (source, maxBytes) => (
  new TextDecoder().decode(await readBodyBytes(source, maxBytes))
);
