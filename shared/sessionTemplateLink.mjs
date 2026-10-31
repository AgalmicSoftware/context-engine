import { SESSION_TEMPLATE_MAX_BYTES, parseSessionTemplateJson, validateSessionTemplate } from './sessionTemplate.mjs';

// Share links carry a template in the URL fragment, which browsers never send
// to a server: compact JSON, deflate-raw, then base64url, as #template=.
const PARAM = 'template';
// Beyond this a link breaks in chats and mail; offer a .json download instead.
export const SESSION_TEMPLATE_LINK_MAX_LENGTH = 8000;
// No link longer than base64url of the largest template is worth unpacking.
const MAX_ENCODED_LENGTH = Math.ceil((SESSION_TEMPLATE_MAX_BYTES * 4) / 3);
const TOO_LARGE = `This link's template is larger than ${SESSION_TEMPLATE_MAX_BYTES / 1024} KB.`;

const failure = (message) => ({ ok: false, errors: [{ path: '', message }] });

const toBase64Url = (bytes) => {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text) => {
  const body = text.replace(/={1,2}$/, '');
  if (!body || body.length % 4 === 1 || !/^[\w-]+$/.test(body)) return null;
  const binary = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

// Streams bytes through a (de)compression stream; null once past maxBytes.
const transform = async (bytes, stream, maxBytes) => {
  const writer = stream.writable.getWriter();
  const written = writer.write(bytes).then(() => writer.close());
  written.catch(() => {}); // a failure surfaces through the reader
  const reader = stream.readable.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  await written;
  const output = new Uint8Array(size);
  chunks.reduce((offset, chunk) => (output.set(chunk, offset), offset + chunk.byteLength), 0);
  return output;
};

// { ok: true, fragment } | { ok: false, reason: 'too_long', length } | { ok: false, reason: 'invalid', errors }
export const encodeSessionTemplateLink = async (template) => {
  const checked = validateSessionTemplate(template);
  if (!checked.ok) return { ok: false, reason: 'invalid', errors: checked.errors };
  const json = new TextEncoder().encode(JSON.stringify(checked.template));
  const packed = await transform(json, new CompressionStream('deflate-raw'), Infinity);
  const fragment = `#${PARAM}=${toBase64Url(packed)}`;
  return fragment.length > SESSION_TEMPLATE_LINK_MAX_LENGTH
    ? { ok: false, reason: 'too_long', length: fragment.length }
    : { ok: true, fragment };
};

// null when the fragment carries no template; otherwise a template result.
export const decodeSessionTemplateLink = async (hash) => {
  const value = new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get(PARAM);
  if (value === null) return null;
  if (value.length > MAX_ENCODED_LENGTH) return failure(TOO_LARGE);
  const packed = fromBase64Url(value);
  if (!packed) return failure('This link is damaged: its template is not base64url text.');
  let bytes;
  try {
    bytes = await transform(packed, new DecompressionStream('deflate-raw'), SESSION_TEMPLATE_MAX_BYTES);
  } catch {
    return failure('This link is damaged: its template cannot be unpacked.');
  }
  if (!bytes) return failure(TOO_LARGE);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return failure('This link is damaged: its template is not UTF-8 text.');
  }
  return parseSessionTemplateJson(text);
};
