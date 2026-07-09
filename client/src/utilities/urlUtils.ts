/**
 * @file urlUtils.js
 * @module urlUtils
 * @description URL utility functions — HTTP/HTTPS normalization, base URL extraction,
 *              origin normalization, and origin list parsing.
 *
 * Key exports: ensureHttpUrl, normalizeBaseUrl, normalizeOrigin, normalizeOriginList
 */
import { toStr } from './shared/primitives.js';

const hasScheme = (value: string): boolean => /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);

export const ensureHttpUrl = (raw: unknown): string => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  if (hasScheme(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  if (trimmed.startsWith('/')) return trimmed;
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(trimmed)) {
    return `http://${trimmed}`;
  }
  return `https://${trimmed}`;
};

export const normalizeBaseUrl = (raw: unknown): string => {
  const withScheme = ensureHttpUrl(raw);
  return toStr(withScheme).trim().replace(/\/+$/, '');
};

export const normalizeOrigin = (raw: unknown): string => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return '';
  const withScheme = ensureHttpUrl(trimmed);
  if (withScheme.startsWith('/')) return '';
  try {
    return new URL(withScheme).origin;
  } catch {
    return '';
  }
};

export const normalizeOriginList = (rawList: unknown): string[] => {
  const list: unknown[] = Array.isArray(rawList) ? rawList : [rawList];
  const cleaned = list.map((entry) => normalizeOrigin(entry)).filter(Boolean);
  return Array.from(new Set(cleaned));
};
