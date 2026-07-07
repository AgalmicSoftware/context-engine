import { toStr } from '../shared/primitives.js';

type FeaturedSbtEntry = {
  address?: unknown;
  sbtAddress?: unknown;
  value?: unknown;
};

type SessionFeaturedSbtConfig = {
  defaultFeaturedSBTs?: unknown;
  featured_SBTs_LIST?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

const readFeaturedEntryValue = (value: unknown): unknown => {
  if (typeof value === 'string') return value;
  if (!isRecord(value)) return '';
  const entry = value as FeaturedSbtEntry;
  return entry.address || entry.sbtAddress || entry.value || '';
};

const normalizeFeaturedAddressList = (values: unknown = []): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const trimmed = toStr(readFeaturedEntryValue(value)).trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(trimmed);
  });
  return out;
};

export const getCanonicalSessionFeaturedSBTs = (sessionConfig: unknown = null): string[] => {
  const config: SessionFeaturedSbtConfig = isRecord(sessionConfig) ? sessionConfig : {};
  return normalizeFeaturedAddressList([
    ...(Array.isArray(config?.defaultFeaturedSBTs) ? config.defaultFeaturedSBTs : []),
    ...(Array.isArray(config?.featured_SBTs_LIST) ? config.featured_SBTs_LIST : []),
  ]);
};
