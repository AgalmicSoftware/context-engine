import { toStr } from './stringCoercion.js';

const CE_TAG_PREFIX = 'CE-';
const MAX_CE_TAGS = 32;
const MAX_TAG_NAME_LENGTH = 128;
const MAX_TAG_VALUE_LENGTH = 2048;
const RESERVED_TAG_NAMES = new Set(['Content-Type', 'App-Name']);
const TAGS_PARSE_ERROR = Symbol('tags_parse_error');

const parseTagsPayload = (raw) => {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch {
      return TAGS_PARSE_ERROR;
    }
  }
  if (typeof raw === 'object') return raw;
  return null;
};

export const normalizeArweaveCeTags = (raw) => {
  if (raw == null) return { ok: true, tags: [] };
  const parsed = parseTagsPayload(raw);
  if (parsed === TAGS_PARSE_ERROR) return { ok: false, error: 'Invalid tags JSON.' };
  if (parsed == null) return { ok: true, tags: [] };

  const entries = Array.isArray(parsed)
    ? parsed
    : (parsed && typeof parsed === 'object')
      ? Object.entries(parsed).map(([name, value]) => ({ name, value }))
      : null;
  if (!entries) return { ok: false, error: 'Invalid tags payload.' };
  if (entries.length > MAX_CE_TAGS) {
    return { ok: false, error: `Too many tags (max ${MAX_CE_TAGS}).` };
  }

  const out = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: 'Invalid tag entry.' };
    }
    if (typeof entry.name !== 'string' || typeof entry.value !== 'string') {
      return { ok: false, error: 'Tag name/value must be strings.' };
    }
    const name = entry.name.trim();
    const value = entry.value.trim();
    if (!name) return { ok: false, error: 'Tag name cannot be empty.' };
    if (seen.has(name)) return { ok: false, error: `Duplicate tag name: ${name}` };
    seen.add(name);
    if (RESERVED_TAG_NAMES.has(name)) return { ok: false, error: `Reserved tag name: ${name}` };
    if (!name.startsWith(CE_TAG_PREFIX)) {
      return { ok: false, error: `Custom tags must start with ${CE_TAG_PREFIX}` };
    }
    if (name.length > MAX_TAG_NAME_LENGTH) {
      return { ok: false, error: `Tag name too long (max ${MAX_TAG_NAME_LENGTH}).` };
    }
    if (value.length > MAX_TAG_VALUE_LENGTH) {
      return { ok: false, error: `Tag value too long (max ${MAX_TAG_VALUE_LENGTH}).` };
    }
    out.push({ name, value });
  }
  return { ok: true, tags: out };
};

export const findArweaveTagIndex = (tags, name) => (
  tags.findIndex((tag) => tag && typeof tag === 'object' && tag.name === name)
);

export const getArweaveTagValue = (tags, name) => {
  const idx = findArweaveTagIndex(tags, name);
  return idx >= 0 ? toStr(tags[idx]?.value).trim() : '';
};

export const setArweaveTagValue = (tags, name, value) => {
  const idx = findArweaveTagIndex(tags, name);
  const normalizedValue = toStr(value).trim();
  if (idx >= 0) {
    tags[idx] = { name, value: normalizedValue };
    return;
  }
  tags.push({ name, value: normalizedValue });
};
