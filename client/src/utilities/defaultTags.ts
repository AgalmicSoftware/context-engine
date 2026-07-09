/**
 * @file defaultTags.js
 * @module defaultTags
 * @description Default tag/label constants and normalization for surveys and questions.
 *              Provides tag list parsing and overlap detection.
 *
 * Key exports: normalizeTagList, parseDefaultTags, hasAnyTagOverlap, isDefaultTagRelevant, getRelevantDefaultTags
 */
const normalizeTag = (raw: unknown): string =>
  String(raw ?? '')
    .trim()
    .toLowerCase();
const normalizeCompact = (raw: unknown): string => normalizeTag(raw).replace(/[^a-z0-9]+/g, '');

const toIterableArray = (value: unknown): unknown[] => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return [];
  try {
    const iterable = value as Iterable<unknown> & { [Symbol.iterator]?: unknown };
    if (typeof iterable[Symbol.iterator] === 'function') return Array.from(iterable);
  } catch (e) {
    void e; /* fallback: non-iterable input. */
  }
  return [];
};

export const normalizeTagList = (rawList: unknown): string[] => {
  const list = toIterableArray(rawList);
  if (!list.length) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  list.forEach((raw) => {
    const tag = normalizeTag(raw);
    if (!tag || seen.has(tag)) return;
    seen.add(tag);
    out.push(tag);
  });
  return out;
};

export const parseDefaultTags = (rawCsv: unknown): string[] => {
  if (typeof rawCsv !== 'string') return [];
  return normalizeTagList(rawCsv.split(','));
};

const normalizeTagMatchSource = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean)
      .join(' ');
  }
  return String(value ?? '').trim();
};

const tokenizeText = (raw: unknown): string[] =>
  normalizeTag(raw)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

const hasCompactedTokenSequenceMatch = (compactTag: string, sourceTokens: string[] = []): boolean => {
  if (!compactTag || !Array.isArray(sourceTokens) || sourceTokens.length < 2) return false;

  for (let start = 0; start < sourceTokens.length; start += 1) {
    let combined = '';
    for (let end = start; end < sourceTokens.length; end += 1) {
      combined += String(sourceTokens[end] || '');
      if (end === start) continue;
      if (combined === compactTag) return true;
      if (combined.length >= compactTag.length) break;
    }
  }

  return false;
};

export const isDefaultTagRelevant = (textSource: unknown, tag: unknown): boolean => {
  const normalizedTag = normalizeTag(tag);
  if (!normalizedTag) return false;

  const sourceText = normalizeTagMatchSource(textSource);
  if (!sourceText) return false;

  const sourceNormalized = normalizeTag(sourceText);
  const sourceTokenList = tokenizeText(sourceText);
  const sourceTokens = new Set(sourceTokenList);
  const tagTokens = tokenizeText(tag);
  const compactTag = normalizeCompact(tag);

  if (tagTokens.length > 1) {
    if (sourceNormalized.includes(normalizedTag)) return true;
    if (tagTokens.every((token) => sourceTokens.has(token))) return true;
  } else if (tagTokens.length === 1 && sourceTokens.has(tagTokens[0])) {
    return true;
  }

  if (compactTag && compactTag.length >= 4 && hasCompactedTokenSequenceMatch(compactTag, sourceTokenList)) {
    return true;
  }

  return false;
};

export const getRelevantDefaultTags = (textSource: unknown, defaultTags: unknown): string[] => {
  const tags: string[] = Array.isArray(defaultTags)
    ? defaultTags
    : typeof defaultTags === 'string'
      ? defaultTags.split(',')
      : [];
  const seen = new Set<string>();
  const out: string[] = [];

  tags.forEach((raw) => {
    const trimmed = String(raw ?? '').trim();
    const normalized = normalizeTag(trimmed);
    if (!trimmed || seen.has(normalized)) return;
    if (!isDefaultTagRelevant(textSource, trimmed)) return;
    seen.add(normalized);
    out.push(trimmed);
  });

  return out;
};

// OR semantics: returns true if any required tag overlaps with questionTags.
// If requiredTags is empty, returns true (no gating).
export const hasAnyTagOverlap = (questionTags: unknown, requiredTags: unknown): boolean => {
  const required = normalizeTagList(requiredTags);
  if (required.length === 0) return true;

  const qTags = normalizeTagList(questionTags);
  if (qTags.length === 0) return false;

  const qSet = new Set(qTags);
  return required.some((tag) => qSet.has(tag));
};
