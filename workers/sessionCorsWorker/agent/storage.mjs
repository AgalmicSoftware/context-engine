import { base64UrlDecode, base64UrlEncode, signHmac, timingSafeEqual } from '../tokenSigning.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const storageError = (reason, status = 503) => Object.assign(new Error(reason), { reason, status });
const providerRead = async (operation) => {
  try { return await operation(); }
  catch { throw storageError('agent_storage_unavailable'); }
};
export const agentStoragePrefix = (sessionId) => {
  if (!/^0x[0-9a-f]{32}$/i.test(sessionId || '') || /^0x0+$/.test(sessionId)) {
    throw new Error('agent_session_identity_invalid');
  }
  return `ce-agent:${sessionId.toLowerCase()}:`;
};

export const createAgentStorage = ({ kv, sessionId, cursorSecret, beforeWrite } = {}) => {
  const prefix = agentStoragePrefix(sessionId);
  if (!kv?.get || !kv?.put || !kv?.delete || !kv?.list) return null;
  const key = (value) => {
    if (typeof value !== 'string' || !value || value.length > 512) throw new Error('agent_storage_key_invalid');
    return `${prefix}${value}`;
  };
  const encodeCursor = async (cursor, scope) => {
    if (!cursor) return '';
    if (!cursorSecret) throw new Error('agent_cursor_signing_unavailable');
    const payload = base64UrlEncode(encoder.encode(JSON.stringify({ scope, cursor })));
    return `${payload}.${base64UrlEncode(await signHmac(payload, cursorSecret))}`;
  };
  const decodeCursor = async (value, scope) => {
    if (!value) return '';
    if (typeof value !== 'string' || value.length > 8192 || !cursorSecret) throw storageError('agent_cursor_invalid', 400);
    try {
      const parts = value.split('.');
      if (parts.length !== 2 || !timingSafeEqual(parts[1], base64UrlEncode(await signHmac(parts[0], cursorSecret)))) throw new Error();
      const parsed = JSON.parse(decoder.decode(base64UrlDecode(parts[0])));
      if (parsed.scope !== scope || typeof parsed.cursor !== 'string') throw new Error();
      return parsed.cursor;
    } catch {
      throw storageError('agent_cursor_invalid', 400);
    }
  };
  return Object.freeze({
    get: (name, options) => providerRead(() => kv.get(key(name), options)),
    put: async (name, value, options) => { await beforeWrite?.(); return kv.put(key(name), value, options); },
    delete: async (name) => { await beforeWrite?.(); return kv.delete(key(name)); },
    async list(options = {}) {
      const suffix = options.prefix ?? '';
      if (typeof suffix !== 'string' || suffix.length > 512) throw new Error('agent_storage_prefix_invalid');
      const scope = `${prefix}${suffix}`;
      const cursor = await decodeCursor(options.cursor, scope);
      const limit = Math.min(1000, Math.max(1, Math.floor(Number(options.limit) || 100)));
      const result = await providerRead(() => kv.list({ prefix: scope, limit, ...(cursor ? { cursor } : {}) }));
      // A provider cursor is not an authority boundary. Check every returned
      // key before exposing suffixes, including on empty/continuing pages.
      if (!Array.isArray(result?.keys) || result.keys.some((row) => typeof row.name !== 'string' || !row.name.startsWith(scope))) {
        throw storageError('agent_storage_scope_mismatch');
      }
      if (result.list_complete === false && !result.cursor) throw storageError('agent_storage_cursor_missing');
      return { ...result, keys: result.keys.map((row) => ({ ...row, name: row.name.slice(prefix.length) })),
        cursor: result.list_complete === true ? '' : await encodeCursor(result.cursor, scope) };
    },
  });
};
