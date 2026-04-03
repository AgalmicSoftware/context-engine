import { toStr } from '../shared/primitives.js';

const normalizeFeaturedAddressList = (values = []) => {
  const out = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const raw = typeof value === 'string'
      ? value
      : (value?.address || value?.sbtAddress || value?.value || '');
    const trimmed = toStr(raw).trim();
    if (!trimmed) return;
    const lower = trimmed.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    out.push(trimmed);
  });
  return out;
};

export const getCanonicalSessionFeaturedSBTs = (sessionConfig = null) => {
  const config = sessionConfig && typeof sessionConfig === 'object'
    ? sessionConfig
    : {};
  return normalizeFeaturedAddressList([
    ...(Array.isArray(config?.defaultFeaturedSBTs) ? config.defaultFeaturedSBTs : []),
    ...(Array.isArray(config?.featured_SBTs_LIST) ? config.featured_SBTs_LIST : []),
  ]);
};
