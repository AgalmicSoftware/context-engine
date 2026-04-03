import demoSessions from '../../variables/demo/demo_sessions.json';
import { toStr, normalizeSlug as normalizeBaseSlug } from '../shared/primitives.js';

export const LEGACY_SESSION_ALIASES = Object.freeze({
  general: '',
});

export const SESSION_TEMPLATE_SEED_KEYS = Object.freeze({
  wizardBase: Object.freeze(['general']),
});

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
const readTrimmedSessionSlug = (raw) => toStr(raw).trim();
const normalizeLegacyAliasToken = (raw) => normalizeBaseSlug(readTrimmedSessionSlug(raw));
const cloneValue = (value) => {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  if (isObj(value)) {
    return Object.keys(value).reduce((acc, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {});
  }
  return value;
};
const mergeDeep = (target, source) => {
  const out = isObj(target) ? { ...target } : {};
  Object.entries(isObj(source) ? source : {}).forEach(([key, value]) => {
    if (isObj(value)) {
      out[key] = mergeDeep(out[key], value);
    } else {
      out[key] = cloneValue(value);
    }
  });
  return out;
};
const getBaselineDemoSessionKeys = () => (
  isObj(demoSessions) ? Object.keys(demoSessions) : []
);
const readDemoSessionSlugByKey = (key) => {
  const sessionConfig = getDemoSessionConfigByKey(key);
  if (key === 'general') return readTrimmedSessionSlug(sessionConfig?.slug || '');
  return readTrimmedSessionSlug(sessionConfig?.slug);
};

export const canonicalizeLegacySessionAlias = (rawSlug) => {
  const slug = readTrimmedSessionSlug(rawSlug);
  if (!slug) return '';
  const aliasToken = normalizeLegacyAliasToken(slug);
  if (Object.prototype.hasOwnProperty.call(LEGACY_SESSION_ALIASES, aliasToken)) {
    return LEGACY_SESSION_ALIASES[aliasToken];
  }
  return slug;
};

export const getReservedLegacySessionSlugs = () => (
  new Set([
    ...Object.keys(LEGACY_SESSION_ALIASES),
    ...Object.values(LEGACY_SESSION_ALIASES).filter(Boolean),
  ])
);

export const isReservedLegacySessionSlug = (slug) => (
  getReservedLegacySessionSlugs().has(readTrimmedSessionSlug(slug).toLowerCase())
);

export const getBaselineDemoSessionSlugs = () => (
  getBaselineDemoSessionKeys().map((key) => readDemoSessionSlugByKey(key))
);

export const getBaselineDemoPlaceholderSlugs = () => (
  getBaselineDemoSessionSlugs().filter((slug) => slug !== '')
);

export const getDemoTemplateSeed = (name) => {
  const keys = SESSION_TEMPLATE_SEED_KEYS[name];
  if (!Array.isArray(keys)) return {};
  return keys.reduce((acc, key) => (
    mergeDeep(acc, cloneValue(getDemoSessionConfigByKey(key) || {}))
  ), {});
};

export const getDemoSessionConfigByKey = (key) => {
  const normalizedKey = toStr(key).trim();
  if (!normalizedKey || !isObj(demoSessions)) return null;
  const entry = demoSessions[normalizedKey];
  return isObj(entry) ? entry : null;
};

export const getDemoSessionMap = () => demoSessions;
