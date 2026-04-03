import { normalizeBaseUrl } from '../urlUtils.js';
import {
  canonicalizeSessionSlug,
  resolveSessionSlugAliasFromDemoSessions,
} from './canonicalSessionContext.js';
import { normalizeSessionNaming } from './sessionMetadata.js';
import { getDemoSessionMap } from './sessionDemoCompat.js';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability.js';

const DEMO_SESSION_MAP = getDemoSessionMap();

const isObj = (value) => !!value && typeof value === 'object' && !Array.isArray(value);

const findDemoSessionConfigBySlug = (slugIn = '') => {
  const slug = canonicalizeSessionSlug(slugIn);
  if (!isObj(DEMO_SESSION_MAP)) return null;
  if (!slug) return isObj(DEMO_SESSION_MAP.general) ? DEMO_SESSION_MAP.general : null;

  const byKey = DEMO_SESSION_MAP[slug];
  if (isObj(byKey) && canonicalizeSessionSlug(byKey.slug || slug) === slug) {
    return byKey;
  }

  const bySlug = Object.values(DEMO_SESSION_MAP).find((entry) => (
    isObj(entry) && canonicalizeSessionSlug(entry.slug || '') === slug
  ));
  return isObj(bySlug) ? bySlug : null;
};

export const resolveSessionSlugAlias = (sessionSlug, opts = {}) => (
  resolveSessionSlugAliasFromDemoSessions({
    sessionSlug,
    demoSessions: DEMO_SESSION_MAP,
    ...(opts || {}),
  })
);

export const getDemoSessionConfigForDisplay = (slug) => (
  normalizeSessionNaming(findDemoSessionConfigBySlug(slug))
);

export const getDefaultSessionConfig = () => (
  getDemoSessionConfigForDisplay('')
);

export const getAllDemoSessionConfigs = () => (
  Object.entries(isObj(DEMO_SESSION_MAP) ? DEMO_SESSION_MAP : {}).map(([key, cfg]) => [
    key,
    normalizeSessionNaming(cfg),
  ])
);

export const findDemoSessionByWorkerUrl = (url = '') => {
  const normalizedTargetUrl = normalizeBaseUrl(url);
  for (const [, cfg] of getAllDemoSessionConfigs()) {
    const normalizedWorkerUrl = normalizeBaseUrl(getUsableSessionWorkerUrl({
      slug: cfg?.slug || '',
      sessionConfig: cfg,
      allowSharedFallback: true,
    }));
    if (!normalizedWorkerUrl) continue;
    if (!normalizedTargetUrl || normalizedWorkerUrl === normalizedTargetUrl) return cfg;
  }
  return null;
};
