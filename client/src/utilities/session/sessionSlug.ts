/**
 * @module sessionSlug
 * @description Canonical session identity, transport, registry, and storage slug conversions.
 *
 * Key exports: parseSessionSlug, canonicalizeSessionSlug, sessionSlugStorageKey
 */
import { normalizeSlug as normalizeBaseSlug, toStr } from '../shared/primitives.js';
import { canonicalizeLegacySessionAlias } from './sessionDemoCompat.js';

export const DEFAULT_SESSION_SLUG = '';
export const DEFAULT_SESSION_STORAGE_KEY = 'general';

const RESERVED_SESSION_SLUG_KEYS = new Set<string>(['__proto__', 'constructor', 'prototype']);

export type ParsedSessionSlug =
  | { ok: true; slug: string }
  | { ok: false; error: string };

export const trimSessionSlug = (raw: unknown): string => toStr(raw).trim();

export const normalizeSessionSlugAliasToken = (raw: unknown): string =>
  normalizeBaseSlug(trimSessionSlug(raw));

export const isReservedSessionSlugKey = (raw: unknown): boolean =>
  RESERVED_SESSION_SLUG_KEYS.has(normalizeSessionSlugAliasToken(raw));

export const parseSessionSlug = (raw: unknown): ParsedSessionSlug => {
  const slug = trimSessionSlug(raw);
  if (!slug) return { ok: true, slug: DEFAULT_SESSION_SLUG };
  const canonicalSlug = canonicalizeLegacySessionAlias(slug);
  if (isReservedSessionSlugKey(canonicalSlug)) {
    return { ok: false, error: 'This session slug is reserved.' };
  }
  return { ok: true, slug: canonicalSlug };
};

export const canonicalizeSessionSlug = (raw: unknown): string => {
  const parsed = parseSessionSlug(raw);
  return parsed.ok ? parsed.slug : DEFAULT_SESSION_SLUG;
};

// Use for permissive identity comparisons that historically lowercased but did
// not strip custom characters.
export const normalizeSessionSlugAlias = (raw: unknown): string => {
  const slug = trimSessionSlug(raw).toLowerCase();
  return slug === DEFAULT_SESSION_STORAGE_KEY ? DEFAULT_SESSION_SLUG : slug;
};

// Use at Worker-config boundaries that historically stripped unsupported chars.
export const sanitizeSessionSlug = (raw: unknown): string => normalizeBaseSlug(raw);

export const normalizeSessionSlugToken = (raw: unknown): string => {
  const slug = sanitizeSessionSlug(raw);
  return slug === DEFAULT_SESSION_STORAGE_KEY ? DEFAULT_SESSION_SLUG : slug;
};

export const sessionSlugStorageKey = (raw: unknown): string =>
  normalizeSessionSlugAlias(raw) || DEFAULT_SESSION_STORAGE_KEY;

export const normalizeRegistrySessionSlugForWriteValue = (
  raw: unknown,
  defaultAlias: unknown = DEFAULT_SESSION_STORAGE_KEY,
): string => {
  const normalized = trimSessionSlug(raw).toLowerCase();
  const normalizedDefault = trimSessionSlug(defaultAlias).toLowerCase() || DEFAULT_SESSION_STORAGE_KEY;
  return !normalized || normalized === normalizedDefault ? normalizedDefault : normalized;
};

export const normalizeRegistrySessionSlugForRead = (
  raw: unknown,
  defaultAlias: unknown = DEFAULT_SESSION_STORAGE_KEY,
): string => {
  const slug = trimSessionSlug(raw);
  return !slug || slug === trimSessionSlug(defaultAlias) ? DEFAULT_SESSION_SLUG : slug;
};

export const normalizeBoundedSessionStorageSlug = (raw: unknown, maxLength = 128): string => {
  const slug = trimSessionSlug(raw).toLowerCase() || DEFAULT_SESSION_STORAGE_KEY;
  return new RegExp(`^[a-z0-9_-]{1,${maxLength}}$`).test(slug) ? slug : '';
};
