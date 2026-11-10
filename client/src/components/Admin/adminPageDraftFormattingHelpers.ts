import { normalizeOriginList } from '../../utilities/urlUtils.js';
import { toStr } from '../../utilities/shared/primitives.js';

export const formatPreviewValue = (value: unknown, limit: unknown = 180): string => {
  const raw = toStr(value);
  const maxLength = Number(limit || 0) || 0;
  if (!raw) return '';
  if (raw.length <= maxLength) return raw;
  return `${raw.slice(0, maxLength)}…`;
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

export const buildUserPageUrl = (address: unknown): string => {
  const trimmed = toStr(address).trim();
  if (!trimmed) return '';
  return `/u/${encodeURIComponent(trimmed)}`;
};
