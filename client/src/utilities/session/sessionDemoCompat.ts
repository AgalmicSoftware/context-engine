import demoSessions from '../../variables/demo/demo_sessions.json';
import { toStr, normalizeSlug as normalizeBaseSlug } from '../shared/primitives.js';

type DemoSessionConfig = Record<string, unknown>;
type DemoSessionMap = Record<string, DemoSessionConfig>;
type SessionTemplateSeedMap = Record<string, readonly string[]>;

export const LEGACY_SESSION_ALIASES = Object.freeze({
  general: '',
} as const);

export const SESSION_TEMPLATE_SEED_KEYS = Object.freeze({
  wizardBase: Object.freeze(['general']),
} as const);

const isObj = (value: unknown): value is DemoSessionConfig =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const readTrimmedSessionSlug = (raw: unknown): string => toStr(raw).trim();
const normalizeLegacyAliasToken = (raw: unknown): string => normalizeBaseSlug(readTrimmedSessionSlug(raw));
const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry)) as T;
  if (isObj(value)) {
    return Object.keys(value).reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = cloneValue(value[key]);
      return acc;
    }, {}) as T;
  }
  return value;
};
const mergeDeep = (target: unknown, source: unknown): DemoSessionConfig => {
  const out: DemoSessionConfig = isObj(target) ? { ...target } : {};
  Object.entries(isObj(source) ? source : {}).forEach(([key, value]) => {
    if (isObj(value)) {
      out[key] = mergeDeep(out[key], value);
    } else {
      out[key] = cloneValue(value);
    }
  });
  return out;
};
const getBaselineDemoSessionKeys = (): string[] =>
  isObj(demoSessions) ? Object.keys(demoSessions as DemoSessionMap) : [];
const readDemoSessionSlugByKey = (key: string): string => {
  const sessionConfig = getDemoSessionConfigByKey(key);
  if (key === 'general') return readTrimmedSessionSlug(sessionConfig?.slug || '');
  return readTrimmedSessionSlug(sessionConfig?.slug);
};

export const canonicalizeLegacySessionAlias = (rawSlug: unknown): string => {
  const slug = readTrimmedSessionSlug(rawSlug);
  if (!slug) return '';
  const aliasToken = normalizeLegacyAliasToken(slug);
  const aliases = LEGACY_SESSION_ALIASES as Record<string, string>;
  if (Object.prototype.hasOwnProperty.call(aliases, aliasToken)) {
    return aliases[aliasToken];
  }
  return slug;
};

export const getReservedLegacySessionSlugs = () =>
  new Set([...Object.keys(LEGACY_SESSION_ALIASES), ...Object.values(LEGACY_SESSION_ALIASES).filter(Boolean)]);

export const isReservedLegacySessionSlug = (slug: unknown): boolean =>
  getReservedLegacySessionSlugs().has(readTrimmedSessionSlug(slug).toLowerCase());

export const getBaselineDemoSessionSlugs = () =>
  getBaselineDemoSessionKeys().map((key) => readDemoSessionSlugByKey(key));

export const getBaselineDemoPlaceholderSlugs = () => getBaselineDemoSessionSlugs().filter((slug) => slug !== '');

export const getDemoTemplateSeed = (name: string): DemoSessionConfig => {
  const keys = (SESSION_TEMPLATE_SEED_KEYS as SessionTemplateSeedMap)[name];
  if (!Array.isArray(keys)) return {};
  return keys.reduce((acc, key) => mergeDeep(acc, cloneValue(getDemoSessionConfigByKey(key) || {})), {});
};

export const getDemoSessionConfigByKey = (key: unknown): DemoSessionConfig | null => {
  const normalizedKey = toStr(key).trim();
  if (!normalizedKey || !isObj(demoSessions)) return null;
  const entry = (demoSessions as DemoSessionMap)[normalizedKey];
  return isObj(entry) ? entry : null;
};

export const getDemoSessionMap = () => demoSessions;
