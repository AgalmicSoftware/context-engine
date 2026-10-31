// Data a link carries in its URL fragment, which browsers never send to a
// server: UTF-8 JSON as base64url, deflated first for #template= share links.
// #setup=, #template= and #prefill= all read through here, so a damaged or
// cut-off link fails the same clear way wherever it is opened.

const CUT_OFF = 'This link is incomplete: it was cut off when it was copied.';
const damaged = (detail) => `This link is damaged: ${detail}.`;
const failure = (error) => ({ ok: false, error });

/** The value of `key` in a fragment such as `location.hash`; null when absent. */
export const readLinkParam = (hash, key) => new URLSearchParams(String(hash ?? '').replace(/^#/, '')).get(key);

export const encodeBase64Url = (bytes) => {
  let binary = '';
  for (let start = 0; start < bytes.length; start += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** Base64url of the JSON's UTF-8 bytes, without padding. */
export const encodeLinkJson = (value) => encodeBase64Url(new TextEncoder().encode(JSON.stringify(value)));

const tooLong = (maxLength) =>
  failure(`This link is longer than ${maxLength.toLocaleString('en-US')} characters, the most this page reads.`);

export const decodeLinkBytes = (value, { maxLength = Infinity } = {}) => {
  const raw = String(value ?? '');
  // Measured before any pattern runs, so no regex sees an outsized value;
  // twice the limit leaves room for a wrapped link's whitespace.
  if (raw.length > maxLength * 2) return tooLong(maxLength);
  // Wrapped chat links can carry line breaks and spaces (reading the fragment
  // also turns "+" into a space), so whitespace is dropped, as is the at most
  // two "=" of padding. Each pattern does constant work per character.
  const body = raw.replace(/\s+/g, '').replace(/={1,2}$/, '');
  if (!body) return failure(damaged('it carries no data'));
  if (body.length > maxLength) return tooLong(maxLength);
  if (!/^[\w-]+$/.test(body)) return failure(damaged("it has characters that base64url doesn't use"));
  // A single character left over can't hold a byte, so the text stops partway.
  if (body.length % 4 === 1) return failure(CUT_OFF);
  const binary = atob(body.replace(/-/g, '+').replace(/_/g, '/'));
  return { ok: true, bytes: Uint8Array.from(binary, (char) => char.charCodeAt(0)) };
};

export const decodeLinkUtf8 = (bytes) => {
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text;
  try {
    text = decoder.decode(bytes, { stream: true });
  } catch {
    return failure(damaged('its data is not UTF-8 text'));
  }
  try {
    // Only a character split by the end of the data is left to flush.
    return { ok: true, text: text + decoder.decode() };
  } catch {
    return failure(CUT_OFF);
  }
};

export const decodeLinkText = (value, options) => {
  const decoded = decodeLinkBytes(value, options);
  return decoded.ok ? decodeLinkUtf8(decoded.bytes) : decoded;
};

// True when JSON text stops inside a string or an open object or list.
const endsEarly = (text) => {
  let depth = 0;
  let inString = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{' || char === '[') depth += 1;
    else if (char === '}' || char === ']') depth -= 1;
  }
  return inString || depth > 0;
};

export const parseLinkJson = (text) => {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return failure(endsEarly(text) ? CUT_OFF : damaged('its data is not valid JSON'));
  }
};

export const decodeLinkJson = (value, options) => {
  const decoded = decodeLinkText(value, options);
  return decoded.ok ? parseLinkJson(decoded.text) : decoded;
};
