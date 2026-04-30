import { normalizeSessionSlug } from '../../utilities/session/sessionNaming.js';
import {
  isKnownOrGeneralSessionSlug,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
} from '../../utilities/survey/questionRouting.js';
import type {
  ResolveSessionConfigById,
  ResolveSessionConfigBySlug,
  SessionConfigLike,
} from '../shellTypes';

type FormatSessionId = ((value: string) => string | null | undefined) | undefined;
type ResolveSessionSlugFromPathToken = ((sessionToken: string) => string | null | undefined) | undefined;

const readSessionTokenFromPath = (path = ''): string => {
  const clean = String(path || '').split('?')[0].split('#')[0];
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

  const resolvedSessionSlug = (
    typeof resolveSessionSlugFromPathToken === 'function'
      ? resolveSessionSlugFromPathToken(rawToken)
      : normalizeSessionSlug(rawToken)
  );
  if (resolvedSessionSlug) {
    return { hasExplicitSessionSlug: true, sessionSlug: resolvedSessionSlug };
  }

  if (normalizeSessionSlug(rawToken) === '') {
    return { hasExplicitSessionSlug: true, sessionSlug: '' };
  }

  return { hasExplicitSessionSlug: false, sessionSlug: '' };
};

const readResolvedSessionConfigById = (
  resolveSessionConfigById?: ResolveSessionConfigById,
  sessionId?: string | number | null
): SessionConfigLike | null => (
  typeof resolveSessionConfigById === 'function'
    ? (resolveSessionConfigById(sessionId as string | number) || null)
    : null
);

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

  const normalized = (
    typeof formatSessionId === 'function'
      ? formatSessionId(raw)
      : null
  ) || raw;

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
  const sessionSlugKnown = sessionSlug !== null &&
    isKnownOrGeneralSessionSlug(sessionSlug, getSessionConfigBySlug);
  const sessionSlugPinned = sessionSlug !== null &&
    (sessionSlugKnown || !isCacheManagerReady);

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
  const querySlugKnown = querySlug !== null && (
    isKnownOrGeneralSessionSlug(querySlug, getSessionConfigBySlug) ||
    (
      typeof resolveDisplaySessionConfigBySlug === 'function' &&
      !!resolveDisplaySessionConfigBySlug(querySlug)
    )
  );
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
  const sessionIdFromPath = typeof formatSessionId === 'function'
    ? (formatSessionId(sessionTokenRaw) || null)
    : null;
  const configBySessionId = sessionIdFromPath
    ? readResolvedSessionConfigById(resolveSessionConfigById, sessionIdFromPath)
    : null;
  const sessionSlug = normalizeSessionSlug(
    sessionTokenRaw
      ? (
        typeof resolveSessionSlugFromPathToken === 'function'
          ? resolveSessionSlugFromPathToken(sessionTokenRaw)
          : sessionTokenRaw
      )
      : ''
  );
  const hasUnresolvedSessionId = !!(sessionIdFromPath && !configBySessionId && !sessionSlug);
  const sessionConfig = configBySessionId || (
    !hasUnresolvedSessionId && typeof resolveSessionConfigBySlug === 'function'
      ? (resolveSessionConfigBySlug(sessionSlug) || null)
      : null
  );
  const displaySessionConfig = !sessionConfig && !hasUnresolvedSessionId && typeof resolveDisplaySessionConfigBySlug === 'function'
    ? (resolveDisplaySessionConfigBySlug(sessionSlug) || null)
    : null;

  return {
    sessionIdFromPath,
    configBySessionId,
    sessionSlug,
    sessionConfig: sessionConfig || displaySessionConfig,
    hasUnresolvedSessionId,
  };
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

  const sessionId = typeof formatSessionId === 'function'
    ? (formatSessionId(token) || null)
    : null;

  if (!sessionId) {
    return normalizeSessionSlug(token);
  }

  const cfgById = typeof resolveSessionConfigById === 'function'
    ? (resolveSessionConfigById(sessionId) || null)
    : null;

  if (cfgById) {
    return normalizeSessionSlug(cfgById.slug || '');
  }

  const normalizedSlug = normalizeSessionSlug(token);
  if (normalizedSlug) {
    const cfgBySlug = typeof resolveSessionConfigBySlug === 'function'
      ? (resolveSessionConfigBySlug(normalizedSlug) || null)
      : null;
    if (cfgBySlug) {
      return normalizeSessionSlug(cfgBySlug.slug || normalizedSlug);
    }
  }

  return '';
};
