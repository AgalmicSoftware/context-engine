import { base64UrlDecode, base64UrlEncode, signHmac, timingSafeEqual } from '../tokenSigning.js';
import { authorityError } from './authority.mjs';

export const createAgentPagination = (secret, context) => {
  const scope = () => JSON.stringify([context.sessionId, context.revision, context.address?.toLowerCase(), context.auth?.delegation?.tokenHash]);
  return async (rows, { cursor = '', limit = 50, fingerprint }) => {
    const size = Math.max(1, Math.min(200, Math.floor(Number(limit) || 50)));
    let offset = 0;
    if (!secret) throw authorityError('agent_cursor_signing_unavailable', 503);
    if (cursor) {
      try {
        if (typeof cursor !== 'string' || cursor.length > 4096) throw new Error();
        const parts = cursor.split('.');
        if (parts.length !== 2 || !timingSafeEqual(parts[1], base64UrlEncode(await signHmac(parts[0], secret)))) throw new Error();
        const value = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
        if (value.scope !== scope() || value.fingerprint !== fingerprint || !Number.isSafeInteger(value.offset) || value.offset < 1 || value.offset >= rows.length) throw new Error();
        offset = value.offset;
      } catch { throw authorityError('agent_cursor_invalid_or_stale', 400); }
    }
    const next = offset + size;
    let nextCursor = '';
    if (next < rows.length) {
      const encoded = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ scope: scope(), fingerprint, offset: next })));
      nextCursor = `${encoded}.${base64UrlEncode(await signHmac(encoded, secret))}`;
    }
    return { items: rows.slice(offset, next), nextCursor, hasMore: !!nextCursor, total: rows.length };
  };
};
