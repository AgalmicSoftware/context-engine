const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Application budgets leave room for authentication, provider work, and parsed
// JSON copies. They are not claims about a deployment's platform limits.
export const RESULTS_ANALYSIS_SCAN_LIMITS = Object.freeze({
  operations: 800,
  rows: 1000,
  metadataBytes: 2 * 1024 * 1024,
  payloadBytes: 8 * 1024 * 1024,
});
export const STORAGE_EXPORT_PAGE_LIMITS = Object.freeze({
  rows: 100,
  metadataBytes: 2 * 1024 * 1024,
  encodedBytes: 4 * 1024 * 1024,
});

export class StorageReadLimitError extends Error {
  constructor(kind) {
    super(`Storage ${kind} exceeds the synchronous read limit.`);
    this.code = 'storage_read_limit';
    this.kind = kind;
  }
}
export const isStorageReadLimitError = (error) => error?.code === 'storage_read_limit';
export const jsonByteLength = (value) => encoder.encode(typeof value === 'string' ? value : JSON.stringify(value)).byteLength;

export const createResultsAnalysisScanBudget = () => {
  const used = { operations: 0, rows: 0, metadataBytes: 0, payloadBytes: 0 };
  const consume = (kind, amount = 1) => {
    if (used[kind] + amount > RESULTS_ANALYSIS_SCAN_LIMITS[kind]) throw new StorageReadLimitError(kind);
    used[kind] += amount;
  };
  return {
    operation: () => consume('operations'),
    rows: (count = 1) => consume('rows', count),
    metadata: (value) => consume('metadataBytes', jsonByteLength(value)),
    payload: (count) => consume('payloadBytes', count),
    get remainingPayloadBytes() { return RESULTS_ANALYSIS_SCAN_LIMITS.payloadBytes - used.payloadBytes; },
  };
};

export const readStorageBytesBounded = async (value, maxBytes = Infinity) => {
  const size = Number(value?.size);
  if (Number.isFinite(size) && size > maxBytes) {
    await value?.body?.cancel?.().catch(() => {});
    throw new StorageReadLimitError('payloadBytes');
  }
  const stream = value?.body?.getReader ? value.body : value?.getReader ? value : null;
  if (stream && Number.isFinite(maxBytes)) {
    const reader = stream.getReader();
    const chunks = [];
    let total = 0;
    try {
      for (;;) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        total += chunk.byteLength;
        if (total > maxBytes) throw new StorageReadLimitError('payloadBytes');
        chunks.push(chunk);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  }
  const bytes = value instanceof Uint8Array ? value
    : value instanceof ArrayBuffer ? new Uint8Array(value)
      : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      : typeof value?.arrayBuffer === 'function' ? new Uint8Array(await value.arrayBuffer())
        : typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value || []);
  if (bytes.byteLength > maxBytes) throw new StorageReadLimitError('payloadBytes');
  return bytes;
};

const encodeCursor = (value) => {
  const bytes = encoder.encode(JSON.stringify(value));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const storageExportCursor = ({ prefix, sessionId = '', pageCursor = '', lastKey = '', hadErrors = false }) => encodeCursor({ version: 1, prefix, sessionId, pageCursor, lastKey, hadErrors });
export const parseStorageExportCursor = ({ cursor, prefix, sessionId = '' }) => {
  if (cursor == null || cursor === '') return { pageCursor: '', lastKey: '', hadErrors: false };
  try {
    if (typeof cursor !== 'string' || cursor.length > 8192 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const base64 = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(decoder.decode(Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))));
    if (parsed?.version !== 1 || parsed.prefix !== prefix || parsed.sessionId !== sessionId || typeof parsed.pageCursor !== 'string' || parsed.pageCursor.length > 4096 ||
        typeof parsed.lastKey !== 'string' || parsed.lastKey.length > 512 || (parsed.lastKey && !parsed.lastKey.startsWith(prefix)) ||
        (parsed.hadErrors !== undefined && typeof parsed.hadErrors !== 'boolean')) throw new Error();
    return { pageCursor: parsed.pageCursor, lastKey: parsed.lastKey, hadErrors: parsed.hadErrors === true };
  } catch {
    throw new Error('Invalid export cursor for this session and resource.');
  }
};
