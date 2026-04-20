import { normalizeBaseUrl } from '../urlUtils.js';
import {
  canonicalizeSessionSlug,
  resolveSessionSlugAliasFromDemoSessions,
} from './canonicalSessionContext.js';
import { normalizeSessionNaming } from './sessionMetadata.js';
import { getDemoSessionMap } from './sessionDemoCompat.js';
import { getUsableSessionWorkerUrl } from './sessionWorkerAvailability.js';

type SessionConfigLike = Record<string, any>;

const DEMO_SESSION_MAP = getDemoSessionMap() as Record<string, SessionConfigLike>;

const isObj = (value: unknown): value is SessionConfigLike => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const findDemoSessionConfigBySlug = (slugIn: unknown = ''): SessionConfigLike | null => {
  const slug = canonicalizeSessionSlug(slugIn);
  if (!isObj(DEMO_SESSION_MAP)) return null;
  if (!slug) return isObj(DEMO_SESSION_MAP.general) ? DEMO_SESSION_MAP.general : null;
  if (String(slugIn || '').trim().toLowerCase() === 'demo') {
    return isObj(DEMO_SESSION_MAP.general) ? DEMO_SESSION_MAP.general : null;
  }

  const byKey = DEMO_SESSION_MAP[slug];
  if (isObj(byKey) && canonicalizeSessionSlug(byKey.slug || slug) === slug) {
    return byKey;
  }

  const bySlug = Object.values(DEMO_SESSION_MAP).find((entry) => (
    isObj(entry) && canonicalizeSessionSlug(entry.slug || '') === slug
  ));
  return isObj(bySlug) ? bySlug : null;
};

export const resolveSessionSlugAlias = (sessionSlug: unknown, opts: Record<string, any> = {}) => (
  (resolveSessionSlugAliasFromDemoSessions as any)({
    sessionSlug,
    demoSessions: DEMO_SESSION_MAP,
    ...(opts || {}),
  })
);

export const getDemoSessionConfigForDisplay = (slug: unknown) => (
  normalizeSessionNaming(findDemoSessionConfigBySlug(slug))
);

export const getDefaultSessionConfig = () => (
  getDemoSessionConfigForDisplay('')
);

export const getAllDemoSessionConfigs = (): Array<[string, SessionConfigLike]> => (
  Object.entries(isObj(DEMO_SESSION_MAP) ? DEMO_SESSION_MAP : {}).map(([key, cfg]) => {
    const normalized = normalizeSessionNaming(cfg);
    return [key, isObj(normalized) ? normalized : {}];
  })
);

export const findDemoSessionByWorkerUrl = (url: unknown = '') => {
  const normalizedTargetUrl = normalizeBaseUrl(url);
  for (const [, cfg] of getAllDemoSessionConfigs()) {
    const sessionConfig = (cfg && typeof cfg === 'object' && !Array.isArray(cfg))
      ? cfg as SessionConfigLike
      : null;
    const normalizedWorkerUrl = normalizeBaseUrl(getUsableSessionWorkerUrl({
      slug: sessionConfig?.slug || '',
      sessionConfig,
      allowSharedFallback: true,
    }));
    if (!normalizedWorkerUrl) continue;
    if (!normalizedTargetUrl || normalizedWorkerUrl === normalizedTargetUrl) return sessionConfig;
  }
  return null;
};
