import { CE_DEMO_SESSION_SLUGS } from '../../variables/appConfig.js';
import { normalizeSlug } from '../shared/primitives.js';

const FALLBACK_DEMO_SESSION_SLUG = 'demo';

export const normalizeDemoSessionSlug = (slug: unknown): string => normalizeSlug(slug);

export const getDemoSessionSlugs = (slugs: unknown = CE_DEMO_SESSION_SLUGS): string[] => {
  const rawList = Array.isArray(slugs) ? slugs : [slugs];
  const seen = new Set<string>();
  const out: string[] = [];
  rawList.forEach((entry) => {
    const slug = normalizeDemoSessionSlug(entry);
    if (!slug || seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

export const getPrimaryDemoSessionSlug = (slugs: unknown = CE_DEMO_SESSION_SLUGS): string =>
  getDemoSessionSlugs(slugs)[0] || FALLBACK_DEMO_SESSION_SLUG;

export const isDemoSessionSlug = (slug: unknown, slugs: unknown = CE_DEMO_SESSION_SLUGS): boolean => {
  const normalized = normalizeDemoSessionSlug(slug);
  if (!normalized) return false;
  return getDemoSessionSlugs(slugs).includes(normalized);
};
