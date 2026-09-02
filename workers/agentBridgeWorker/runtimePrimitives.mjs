// Preserve the bridge's legacy coercion: falsy non-strings such as 0 and false become empty.
// Callers that must preserve those values intentionally keep a local variant.
export function safeString(value) {
  return String(value || '').trim();
}

export function lower(value) {
  return safeString(value).toLowerCase();
}

// Session slugs are transport identifiers. This intentionally preserves the
// bridge's existing lowercase/filter/truncate behavior and does not substitute
// a default-session sentinel.
export function sanitizeSessionSlug(value = '') {
  return lower(value).replace(/[^a-z0-9_-]/g, '').slice(0, 128);
}

export function safeJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export function safeEnvJsonParse(value, fallback = null) {
  const text = safeString(value);
  if (!text) return fallback;
  const parseFailed = Symbol('parse-failed');
  const parsed = safeJsonParse(text, parseFailed);
  if (parsed !== parseFailed) return parsed;
  const dotenvEscaped = text.includes('\\"') ? text.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
  return dotenvEscaped && dotenvEscaped !== text
    ? safeJsonParse(dotenvEscaped, fallback)
    : fallback;
}

export function nowIso(now = null) {
  if (now instanceof Date) return now.toISOString();
  if (safeString(now)) return new Date(now).toISOString();
  return new Date().toISOString();
}

export function nowIsoOrCurrent(now = null) {
  if (now instanceof Date) return now.toISOString();
  if (safeString(now)) {
    const parsed = new Date(now);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

export function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableJson(value[key])}`
    )).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

// Persisted KV identifiers depend on this exact sorted-JSON and FNV-1a encoding.
export function stableFingerprint(value = {}) {
  const input = stableJson(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(10, '0');
}

export function kvKeySafePart(value = '') {
  const text = safeString(value);
  if (!text) return '';
  const safe = text.replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 56);
  return `${safe || 'ref'}_${stableFingerprint(text)}`;
}

export function envFlagEnabled(value = '') {
  return ['1', 'true', 'yes', 'on'].includes(lower(value));
}

export function envFlagDisabled(value = '') {
  return ['0', 'false', 'no', 'off'].includes(lower(value));
}
