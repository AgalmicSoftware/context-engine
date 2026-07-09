import { normalizeOriginList } from '../../utilities/urlUtils.js';
import { toStr } from '../../utilities/shared/primitives.js';

export const formatPreviewValue = (value: unknown, limit: unknown = 180): string => {
  const raw = toStr(value);
  const maxLength = Number(limit || 0) || 0;
  if (!raw) return '';
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}…`;
};

export const dedupeTrimmedList = (values: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const trimmed = toStr(value).trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(trimmed);
  });
  return out;
};

export const formatDelimitedDraftList = (value: unknown): string =>
  Array.isArray(value) ? dedupeTrimmedList(value).join('\n') : '';

export const parseDelimitedDraftList = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return dedupeTrimmedList(raw);
  const trimmed = toStr(raw).trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return dedupeTrimmedList(parsed);
    } catch (_) {}
  }
  return dedupeTrimmedList(trimmed.split(/[\n,]+/));
};

export const splitAllowOriginsInput = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => splitAllowOriginsInput(entry));
  }
  return toStr(value)
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

export const parseAllowOriginsDraft = (raw: unknown): string[] => normalizeOriginList(splitAllowOriginsInput(raw));

export const formatAllowOriginsDraft = (value: unknown): string => parseAllowOriginsDraft(value).join('\n');

export const formatDefaultFilterStateDraft = (value: unknown): string => {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_) {
    return String(value);
  }
};

export const parseDefaultFilterStateDraft = (raw: unknown): unknown => {
  const trimmed = toStr(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error('Default filter state must be valid JSON or a plain query string.');
    }
  }
  return trimmed;
};

export const buildUserPageUrl = (address: unknown): string => {
  const trimmed = toStr(address).trim();
  if (!trimmed) return '';
  return `/u/${encodeURIComponent(trimmed)}`;
};
