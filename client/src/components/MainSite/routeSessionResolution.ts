import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  isKnownOrGeneralSessionSlug,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import type { ResolveSessionConfigById, ResolveSessionConfigBySlug, SessionConfigLike } from '../shellTypes';

type FormatSessionId = ((value: string) => string | null | undefined) | undefined;
type ResolveSessionSlugFromPathToken = ((sessionToken: string) => string | null | undefined) | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasAuthoritativeRegistryIdentity = (sessionConfig: SessionConfigLike | null | undefined): boolean => {
  if (!isRecord(sessionConfig)) return false;
  const registry = isRecord(sessionConfig.__registry) ? sessionConfig.__registry : {};
  return !!(
    sessionConfig.sessionId ||
    sessionConfig.sessionIdHex ||
    sessionConfig.metadataURI ||
    registry.sessionId ||
    registry.sessionIdHex ||
    registry.metadataURI
  );
};

const readSessionTokenFromPath = (path = ''): string => {
  const clean = String(path || '')
    .split('?')[0]
    .split('#')[0];
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] !== 'session' || !parts[1]) return '';
  return String(parts[1] || '').trim();
};

const resolveExplicitSessionSlugFromPathToken = ({
  sessionToken = '',
  resolveSessionSlugFromPathToken,
}: {
  sessionToken?: string;
  resolveSessionSlugFromPathToken?: ResolveSessionSlugFromPathToken;
} = {}): {
  hasExplicitSessionSlug: boolean;
  sessionSlug: string;
} => {
  const rawToken = String(sessionToken || '').trim();
  if (!rawToken) {
    return { hasExplicitSessionSlug: false, sessionSlug: '' };
  }

  const resolvedSessionSlug =
    typeof resolveSessionSlugFromPathToken === 'function'
      ? resolveSessionSlugFromPathToken(rawToken)
      : normalizeSessionSlug(rawToken);
  if (resolvedSessionSlug) {
    return { hasExplicitSessionSlug: true, sessionSlug: resolvedSessionSlug };
  }

  if (normalizeSessionSlug(rawToken) === '') {
    return { hasExplicitSessionSlug: true, sessionSlug: '' };
  }

  return { hasExplicitSessionSlug: false, sessionSlug: '' };
};

export const resolveMainSiteExplicitSessionSlugFromPath = ({
  path = '',
  resolveSessionSlugFromPathToken,
}: {
  path?: string;
  resolveSessionSlugFromPathToken?: ResolveSessionSlugFromPathToken;
} = {}): {
  hasExplicitSessionSlug: boolean;
  sessionSlug: string;
} => {
  const sessionToken = readSessionTokenFromPath(path);
  if (!sessionToken) {
    return { hasExplicitSessionSlug: false, sessionSlug: '' };
  }
  if (sessionToken.toLowerCase() === 'new') {
    return { hasExplicitSessionSlug: true, sessionSlug: '' };
  }
  return resolveExplicitSessionSlugFromPathToken({
    sessionToken,
    resolveSessionSlugFromPathToken,
  });
};

const readSessionStateStringList = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

export const resolveMainSiteGlobalPrimarySessionSlug = ({
  sessionState = {},
  derivePrimarySessionSlugFromList,
}: {
  sessionState?: Record<string, unknown> | null;
  derivePrimarySessionSlugFromList?: (slugs: unknown[]) => string;
} = {}): string => {
  const state = sessionState || {};
  const primarySessionSlug = normalizeSessionSlug(state.primarySessionSlug || '');
  const primarySessionExplicit = state.primarySessionExplicit === true;
  const selectedSessionScope = String(state.selectedSessionScope || '')
    .trim()
    .toLowerCase();
  const selectedSessionSlugs = readSessionStateStringList(state.selectedSessionSlugs);
  const listIncludesGeneral = selectedSessionSlugs.some((slug: unknown) => normalizeSessionSlug(slug || '') === '');
  if (primarySessionSlug) return primarySessionSlug;
  if (primarySessionExplicit) {
    if (selectedSessionScope === 'list' && !listIncludesGeneral) {
      return typeof derivePrimarySessionSlugFromList === 'function'
        ? derivePrimarySessionSlugFromList(selectedSessionSlugs)
        : '';
    }
    return primarySessionSlug;
  }
  if (selectedSessionScope === 'list') {
    return typeof derivePrimarySessionSlugFromList === 'function'
      ? derivePrimarySessionSlugFromList(selectedSessionSlugs)
      : '';
  }
  return '';
};

export const resolveMainSiteSessionSlugFromProps = ({
  path = '',
  activeSessionSlug = '',
  sessionState = {},
  resolveSessionSlugFromPathToken,
  derivePrimarySessionSlugFromList,
}: {
  path?: string;
  activeSessionSlug?: string;
  sessionState?: Record<string, unknown> | null;
  resolveSessionSlugFromPathToken?: ResolveSessionSlugFromPathToken;
  derivePrimarySessionSlugFromList?: (slugs: unknown[]) => string;
} = {}): string => {
  const routeSession = resolveMainSiteExplicitSessionSlugFromPath({
    path,
    resolveSessionSlugFromPathToken,
  });
  if (routeSession.hasExplicitSessionSlug) return routeSession.sessionSlug;

  const state = sessionState || {};
  const primarySessionExplicit = state.primarySessionExplicit === true;
  const selectedSessionScope = String(state.selectedSessionScope || '')
    .trim()
    .toLowerCase();
  const selectedSessionSlugs = readSessionStateStringList(state.selectedSessionSlugs);
  const listIncludesGeneral = selectedSessionSlugs.some((slug: unknown) => normalizeSessionSlug(slug || '') === '');
  if (activeSessionSlug) return activeSessionSlug;
  if (primarySessionExplicit) {
    if (selectedSessionScope === 'list' && !listIncludesGeneral) {
      return typeof derivePrimarySessionSlugFromList === 'function'
        ? derivePrimarySessionSlugFromList(selectedSessionSlugs)
        : '';
    }
    return activeSessionSlug;
  }
  if (selectedSessionScope === 'list') {
    return typeof derivePrimarySessionSlugFromList === 'function'
      ? derivePrimarySessionSlugFromList(selectedSessionSlugs)
      : '';
  }
  return '';
};

const readResolvedSessionConfigById = (
  resolveSessionConfigById?: ResolveSessionConfigById,
  sessionId?: string | number | null,
): SessionConfigLike | null =>
  typeof resolveSessionConfigById === 'function'
    ? resolveSessionConfigById(sessionId as string | number) || null
    : null;

const DEMO_DISPLAY_ARRAY_FIELDS = [
  'defaultFeaturedSBTs',
  'featured_SBTs_LIST',
  'ignored_SBTs_LIST',
  'HIGHLIGHTED_QUESTION_IDS',
  'BLOCKED_QUESTION_IDS',
  'HIGHLIGHTED_SURVEY_IDS',
  'BLOCKED_SURVEY_IDS',
] as const;

const DEMO_DISPLAY_VALUE_FIELDS = [
  'sessionName',
  'sessionInfo',
  'sessionHeaderImg',
  'defaultTags',
  'defaultSbtTags',
  'defaultFilterState',
  'autoFeatureSBTsBySessionSlug',
  'demoCompatibilitySeed',
] as const;

const DEMO_DISPLAY_OBJECT_FIELDS = ['contracts', 'blockLimits', 'ai'] as const;

const isMissingDisplayValue = (value: unknown): boolean =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

const sameRouteSessionSlug = (strictConfig: SessionConfigLike, displayConfig: SessionConfigLike): boolean => {
  const strictSlug = normalizeSessionSlug(strictConfig.slug || strictConfig.sessionSlug || '');
  const displaySlug = normalizeSessionSlug(displayConfig.slug || displayConfig.sessionSlug || '');
  return !strictSlug || !displaySlug || strictSlug === displaySlug;
};

const shouldApplyDemoDisplayOverlay = (
  strictConfig: SessionConfigLike | null | undefined,
  displayConfig: SessionConfigLike | null | undefined,
): strictConfig is SessionConfigLike =>
  isRecord(strictConfig) &&
  isRecord(displayConfig) &&
  sameRouteSessionSlug(strictConfig, displayConfig) &&
  (isRecord(displayConfig.demoCompatibilitySeed) ||
    normalizeSessionSlug(displayConfig.slug || displayConfig.sessionSlug || '').startsWith('demo-'));

export const mergeMainSiteSessionDisplayConfig = (
  strictConfig: SessionConfigLike | null | undefined,
  displayConfig: SessionConfigLike | null | undefined,
): SessionConfigLike | null => {
  if (!strictConfig) return displayConfig || null;
  if (!shouldApplyDemoDisplayOverlay(strictConfig, displayConfig)) return strictConfig;

  const display = displayConfig as SessionConfigLike;
  const merged: SessionConfigLike = { ...display, ...strictConfig };

  for (const field of DEMO_DISPLAY_ARRAY_FIELDS) {
    if (Array.isArray(display[field]) && display[field].length > 0) {
      merged[field] = [...display[field]];
    }
  }

  for (const field of DEMO_DISPLAY_VALUE_FIELDS) {
    if (!isMissingDisplayValue(display[field])) {
      merged[field] = display[field];
    }
  }

  for (const field of DEMO_DISPLAY_OBJECT_FIELDS) {
    if (isRecord(display[field]) && !isRecord(strictConfig[field])) {
      merged[field] = { ...display[field] };
    }
  }

  return merged;
};

export const resolveMainSiteRouteSessionSlugHint = ({
  search = '',
  allowSessionIdLookup = true,
  resolveSessionConfigById,
}: {
  search?: string;
  allowSessionIdLookup?: boolean;
  resolveSessionConfigById?: ResolveSessionConfigById;
} = {}): string | null => {
  const sessionSlug = parseQuestionSessionSlugFromSearch(search);
  if (sessionSlug !== null) return sessionSlug;
  if (!allowSessionIdLookup) return null;

  const sessionId = parseQuestionSessionIdFromSearch(search);
  if (!sessionId) return null;

  const cfgById = readResolvedSessionConfigById(resolveSessionConfigById, sessionId);
  const resolvedSlug = normalizeSessionSlug(cfgById?.slug || cfgById?.sessionSlug || '');
  return resolvedSlug || null;
};

export const resolveMainSiteRouteSessionIdHint = ({
  search = '',
  requireResolved = false,
  formatSessionId,
  resolveSessionConfigById,
}: {
  search?: string;
  requireResolved?: boolean;
  formatSessionId?: FormatSessionId;
  resolveSessionConfigById?: ResolveSessionConfigById;
} = {}): string | null => {
  const raw = parseQuestionSessionIdFromSearch(search);
  if (!raw) return null;

  const normalized = (typeof formatSessionId === 'function' ? formatSessionId(raw) : null) || raw;

  if (!requireResolved) return normalized;

  const resolved =
    readResolvedSessionConfigById(resolveSessionConfigById, raw) ||
    readResolvedSessionConfigById(resolveSessionConfigById, normalized);

  return resolved ? normalized : null;
};

export const resolveMainSiteQuestionRouteSessionContext = ({
  search = '',
  isCacheManagerReady = false,
  getSessionConfigBySlug,
  formatSessionId,
  resolveSessionConfigById,
}: {
  search?: string;
  isCacheManagerReady?: boolean;
  getSessionConfigBySlug?: ResolveSessionConfigBySlug;
  formatSessionId?: FormatSessionId;
  resolveSessionConfigById?: ResolveSessionConfigById;
} = {}): {
  sessionSlug: string | null;
  sessionId: string | null;
  sessionSlugKnown: boolean;
  sessionSlugPinned: boolean;
  shouldBlockDuringBootstrap: boolean;
} => {
  const sessionSlug = resolveMainSiteRouteSessionSlugHint({
    search,
    allowSessionIdLookup: true,
    resolveSessionConfigById,
  });
  const sessionId = resolveMainSiteRouteSessionIdHint({
    search,
    requireResolved: sessionSlug !== null,
    formatSessionId,
    resolveSessionConfigById,
  });
  const sessionSlugKnown = sessionSlug !== null && isKnownOrGeneralSessionSlug(sessionSlug, getSessionConfigBySlug);
  const sessionSlugPinned = sessionSlug !== null && (sessionSlugKnown || !isCacheManagerReady);

  return {
    sessionSlug,
    sessionId,
    sessionSlugKnown,
    sessionSlugPinned,
    shouldBlockDuringBootstrap: !sessionSlugPinned && !isCacheManagerReady,
  };
};

export const resolveMainSiteRenderActiveSessionSlug = ({
  path = '',
  search = '',
  activeSessionSlug = '',
  isCacheManagerReady = false,
  getSessionConfigBySlug,
  resolveDisplaySessionConfigBySlug,
  resolveSessionConfigById,
  resolveSessionSlugFromPathToken,
}: {
  path?: string;
  search?: string;
  activeSessionSlug?: string;
  isCacheManagerReady?: boolean;
  getSessionConfigBySlug?: ResolveSessionConfigBySlug;
  resolveDisplaySessionConfigBySlug?: ResolveSessionConfigBySlug;
  resolveSessionConfigById?: ResolveSessionConfigById;
  resolveSessionSlugFromPathToken?: ResolveSessionSlugFromPathToken;
} = {}): string => {
  const sessionToken = readSessionTokenFromPath(path);
  if (sessionToken) {
    const routeSession = resolveExplicitSessionSlugFromPathToken({
      sessionToken,
      resolveSessionSlugFromPathToken,
    });
    if (routeSession.hasExplicitSessionSlug) return routeSession.sessionSlug;
    return normalizeSessionSlug(activeSessionSlug);
  }

  const querySlug = resolveMainSiteRouteSessionSlugHint({
    search,
    allowSessionIdLookup: true,
    resolveSessionConfigById,
  });
  const querySlugKnown =
    querySlug !== null &&
    (isKnownOrGeneralSessionSlug(querySlug, getSessionConfigBySlug) ||
      (typeof resolveDisplaySessionConfigBySlug === 'function' && !!resolveDisplaySessionConfigBySlug(querySlug)));
  if (querySlug !== null && (querySlugKnown || !isCacheManagerReady)) {
    return querySlug;
  }

  return normalizeSessionSlug(activeSessionSlug);
};

export const resolveMainSiteSessionRouteContext = ({
  sessionTokenRaw = '',
  formatSessionId,
  resolveSessionConfigById,
  resolveSessionConfigBySlug,
  resolveDisplaySessionConfigBySlug,
  resolveSessionSlugFromPathToken,
}: {
  sessionTokenRaw?: string;
  formatSessionId?: FormatSessionId;
  resolveSessionConfigById?: ResolveSessionConfigById;
  resolveSessionConfigBySlug?: ResolveSessionConfigBySlug;
  resolveDisplaySessionConfigBySlug?: ResolveSessionConfigBySlug;
  resolveSessionSlugFromPathToken?: ResolveSessionSlugFromPathToken;
} = {}): {
  sessionIdFromPath: string | null;
  configBySessionId: SessionConfigLike | null;
  sessionSlug: string;
  sessionConfig: SessionConfigLike | null;
  hasUnresolvedSessionId: boolean;
} => {
  const sessionIdFromPath = typeof formatSessionId === 'function' ? formatSessionId(sessionTokenRaw) || null : null;
  const configBySessionId = sessionIdFromPath
    ? readResolvedSessionConfigById(resolveSessionConfigById, sessionIdFromPath)
    : null;
  const sessionSlug = normalizeSessionSlug(
    sessionTokenRaw
      ? typeof resolveSessionSlugFromPathToken === 'function'
        ? resolveSessionSlugFromPathToken(sessionTokenRaw)
        : sessionTokenRaw
      : '',
  );
  const hasUnresolvedSessionId = !!(sessionIdFromPath && !configBySessionId && !sessionSlug);
  const sessionConfig =
    configBySessionId ||
    (!hasUnresolvedSessionId && typeof resolveSessionConfigBySlug === 'function'
      ? resolveSessionConfigBySlug(sessionSlug) || null
      : null);
  const displaySessionConfig =
    !hasUnresolvedSessionId && typeof resolveDisplaySessionConfigBySlug === 'function'
      ? resolveDisplaySessionConfigBySlug(sessionSlug) || null
      : null;

  return {
    sessionIdFromPath,
    configBySessionId,
    sessionSlug,
    sessionConfig: mergeMainSiteSessionDisplayConfig(sessionConfig, displaySessionConfig),
    hasUnresolvedSessionId,
  };
};

export const resolveMainSiteSessionRouteSourceSlug = ({
  sessionTokenRaw = '',
  sessionSlug = '',
  sessionConfig = null,
}: {
  sessionTokenRaw?: string;
  sessionSlug?: string;
  sessionConfig?: SessionConfigLike | null;
} = {}): string => {
  const token = String(sessionTokenRaw || '')
    .trim()
    .toLowerCase();
  const configHasSlug = isRecord(sessionConfig) && Object.prototype.hasOwnProperty.call(sessionConfig, 'slug');
  const configSlug = configHasSlug ? normalizeSessionSlug(sessionConfig.slug || '') : '';
  if (token === 'demo' && (!sessionConfig || configSlug === '') && !hasAuthoritativeRegistryIdentity(sessionConfig)) {
    return '';
  }
  return normalizeSessionSlug(configHasSlug ? configSlug : sessionSlug);
};

export const resolveMainSiteSessionSlugFromPathToken = ({
  rawToken,
  formatSessionId,
  resolveSessionConfigById,
  resolveSessionConfigBySlug,
}: {
  rawToken?: string | null;
  formatSessionId?: FormatSessionId;
  resolveSessionConfigById?: ResolveSessionConfigById;
  resolveSessionConfigBySlug?: ResolveSessionConfigBySlug;
} = {}): string => {
  const token = String(rawToken || '').trim();
  if (!token) return '';
  if (token.toLowerCase() === 'new') return '';

  const sessionId = typeof formatSessionId === 'function' ? formatSessionId(token) || null : null;

  if (!sessionId) {
    return normalizeSessionSlug(token);
  }

  const cfgById = typeof resolveSessionConfigById === 'function' ? resolveSessionConfigById(sessionId) || null : null;

  if (cfgById) {
    return normalizeSessionSlug(cfgById.slug || '');
  }

  const normalizedSlug = normalizeSessionSlug(token);
  if (normalizedSlug) {
    const cfgBySlug =
      typeof resolveSessionConfigBySlug === 'function' ? resolveSessionConfigBySlug(normalizedSlug) || null : null;
    if (cfgBySlug) {
      return normalizeSessionSlug(cfgBySlug.slug || normalizedSlug);
    }
  }

  return '';
};
