import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import {
  fetchSessionFromRegistry as fetchSessionFromRegistryFn,
  sessionRegistryStore,
  sessionRegistryUtils,
  upsertSessionRegistryCache as upsertSessionRegistryCacheFn,
} from '../../utilities/web3/sessionRegistry.js';
import { getGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import { getSessionRegistryChainIds } from '../../variables/chains.js';
import { buildPublicUrl } from './urlUtils.js';
import { DEFAULT_SESSION_SLUG_ALIAS } from '../../variables/appConfig.js';

type ResolveKind = 'id' | 'slug';
type RetryTimer = ReturnType<typeof setTimeout>;
type RetryTimerBucket = Record<string, RetryTimer | undefined>;
type ErrorCountBuckets = { id: Record<string, number>; slug: Record<string, number> };
type ResolveErrorDetail = { ts?: number | null; code?: unknown; message?: string };
type ErrorDetailBuckets = { id: Record<string, ResolveErrorDetail>; slug: Record<string, ResolveErrorDetail> };
type RetryTimerBuckets = { id: RetryTimerBucket; slug: RetryTimerBucket };

export interface SessionPathResolverHost {
  getProvider: () => unknown;
  getAccount: () => unknown;
  isMounted: () => boolean;
  bumpResolutionNonce: () => void;
  normalizeRoutePath: (path: string) => string;
  getSessionTokenFromPath: (path: string) => string;
  warn: (context: string, error: unknown) => void;
}

export interface ResolveStatus {
  hasAttempted: boolean;
  isPending: boolean;
  retryCount: number;
  lastErrorTs: number | null;
}

export interface SessionPathResolverController {
  resolveId: (sessionId: string) => void;
  resolveSlug: (slug: string) => void;
  getIdStatus: (sessionId: string) => ResolveStatus;
  getSlugStatus: (slug: string) => ResolveStatus;
  destroy: () => void;
}

interface SessionPathResolverControllerInternal extends SessionPathResolverController {
  _destroyed: boolean;
  _pendingIdResolves: Set<string>;
  _pendingSlugResolves: Set<string>;
  _idAttempts: Record<string, number>;
  _slugAttempts: Record<string, number>;
  _errorCounts: ErrorCountBuckets;
  _lastErrors: ErrorDetailBuckets;
  _retryTimers: RetryTimerBuckets;
}

const MIN_ATTEMPT_GAP_MS = 3000;

const buildEmptyResolveStatus = (): ResolveStatus => ({
  hasAttempted: false,
  isPending: false,
  retryCount: 0,
  lastErrorTs: null,
});

const getRetryDelayMs = (count: number): number => {
  const n = Math.max(0, Math.min(6, Number(count || 0) - 1));
  return Math.max(3200, Math.min(30000, Math.round(1500 * Math.pow(2, n))));
};

const readResolveStatus = (
  controller: SessionPathResolverControllerInternal,
  kind: ResolveKind,
  key: string,
): ResolveStatus => {
  if (!key) return buildEmptyResolveStatus();

  const attempts = kind === 'id' ? controller._idAttempts : controller._slugAttempts;
  const pending = kind === 'id' ? controller._pendingIdResolves : controller._pendingSlugResolves;
  const retryCount = Number(controller._errorCounts[kind][key] || 0);
  const lastErrorTsRaw = controller._lastErrors[kind][key]?.ts;
  const lastErrorTsNum = Number(lastErrorTsRaw || 0);
  const lastErrorTs = Number.isFinite(lastErrorTsNum) && lastErrorTsNum > 0 ? lastErrorTsNum : null;

  return {
    hasAttempted: !!attempts[key],
    isPending: pending.has(key),
    retryCount,
    lastErrorTs,
  };
};

const clearRetryTimer = (controller: SessionPathResolverControllerInternal, kind: ResolveKind, key: string): void => {
  const timers = controller._retryTimers[kind];
  if (!timers[key]) return;
  clearTimeout(timers[key]);
  delete timers[key];
};

const clearResolveErrorState = (
  controller: SessionPathResolverControllerInternal,
  kind: ResolveKind,
  key: string,
  host: SessionPathResolverHost,
): void => {
  try {
    delete controller._errorCounts[kind][key];
    delete controller._lastErrors[kind][key];
    clearRetryTimer(controller, kind, key);
  } catch (error) {
    host.warn('MainSite: cleanup', error);
  }
};

const recordResolveFailure = (
  controller: SessionPathResolverControllerInternal,
  kind: ResolveKind,
  key: string,
  error: unknown,
  host: SessionPathResolverHost,
  retry: () => void,
): void => {
  if (controller._destroyed) return;
  try {
    const counts = controller._errorCounts[kind];
    const nextCount = Number(counts[key] || 0) + 1;
    counts[key] = nextCount;

    const errorLike = error as { code?: unknown; error?: { code?: unknown; message?: string }; message?: string };
    const code = errorLike?.code ?? errorLike?.error?.code ?? null;
    const message = errorLike?.message || errorLike?.error?.message || String(error);
    controller._lastErrors[kind][key] = {
      ts: Date.now(),
      code,
      message,
    };

    const delayMs = getRetryDelayMs(nextCount);
    clearRetryTimer(controller, kind, key);
    controller._retryTimers[kind][key] = setTimeout(() => {
      try {
        if (controller._destroyed) return;
        if (host.isMounted()) retry();
      } catch (retryError) {
        host.warn('MainSite: fallback', retryError);
      }
    }, delayMs);
  } catch (cleanupError) {
    host.warn('MainSite: cleanup', cleanupError);
  }
};

const fetchSessionFromRegistryAcrossChains = async (
  host: SessionPathResolverHost,
  request: { sessionId?: string; slug?: string },
): Promise<{ resolved: boolean; lastErr: unknown }> => {
  const fetchSessionFromRegistry = sessionRegistryUtils.fetchSessionFromRegistry || fetchSessionFromRegistryFn;
  const upsertSessionRegistryCache = sessionRegistryUtils.upsertSessionRegistryCache || upsertSessionRegistryCacheFn;
  const lit = getGlobalLitHooks();
  const chainIds = getSessionRegistryChainIds();
  let resolved = false;
  let lastErr: unknown = null;

  for (const chainId of chainIds) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const config = await fetchSessionFromRegistry({
        chainId,
        ...request,
        providerLike: host.getProvider(),
        account: host.getAccount(),
        lit,
        bootstrapRpc: true,
      });
      if (!config) continue;
      upsertSessionRegistryCache({ config });
      resolved = true;
      lastErr = null;
      break;
    } catch (error) {
      lastErr = error;
    }
  }

  return { resolved, lastErr };
};

const maybeCanonicalizeSessionIdRoute = (host: SessionPathResolverHost, sessionId: string): void => {
  const resolvedCfg = sessionRegistryStore.getSessionConfigById(sessionId);
  if (!resolvedCfg || typeof window === 'undefined') return;

  const currentPath = window.location.pathname || '';
  const normalizedCurrentPath = host.normalizeRoutePath(currentPath);
  const currentToken = host.getSessionTokenFromPath(currentPath);
  const currentSessionId = sessionRegistryUtils.formatSessionId(currentToken);
  if (!currentSessionId || currentSessionId !== sessionId) return;

  const currentParts = String(normalizedCurrentPath || '')
    .split('/')
    .filter(Boolean);
  const isDocsSubroute = currentParts.length >= 3 && currentParts[0] === 'session' && currentParts[2] === 'docs';
  if (isDocsSubroute) return;

  const resolvedSlug = normalizeSessionSlug(resolvedCfg.slug || '');
  const canonicalToken = resolvedSlug || DEFAULT_SESSION_SLUG_ALIAS;
  const nextPath = `/session/${canonicalToken}`;
  if (normalizedCurrentPath === nextPath) return;

  const nextUrl = buildPublicUrl(nextPath, window.location.search || '', window.location.hash || '');
  window.history.replaceState({}, '', nextUrl);
};

export function createSessionPathResolverController(host: SessionPathResolverHost): SessionPathResolverController {
  const controller = {
    _destroyed: false,
    _pendingIdResolves: new Set<string>(),
    _pendingSlugResolves: new Set<string>(),
    _idAttempts: {},
    _slugAttempts: {},
    _errorCounts: { id: {}, slug: {} },
    _lastErrors: { id: {}, slug: {} },
    _retryTimers: { id: {}, slug: {} },
    resolveId: (_sessionIdIn: string) => undefined,
    resolveSlug: (_slugIn: string) => undefined,
    getIdStatus: (_sessionIdIn: string) => buildEmptyResolveStatus(),
    getSlugStatus: (_slugIn: string) => buildEmptyResolveStatus(),
    destroy: () => undefined,
  } as SessionPathResolverControllerInternal;

  controller.resolveId = (sessionIdIn: string): void => {
    if (controller._destroyed) return;

    const sessionId = sessionRegistryUtils.formatSessionId(sessionIdIn);
    if (!sessionId) return;
    if (controller._pendingIdResolves.has(sessionId)) return;

    const now = Date.now();
    const lastAttempt = Number(controller._idAttempts[sessionId] || 0);
    if (now - lastAttempt < MIN_ATTEMPT_GAP_MS) return;

    controller._idAttempts[sessionId] = now;
    controller._pendingIdResolves.add(sessionId);

    void (async () => {
      try {
        const { resolved, lastErr } = await fetchSessionFromRegistryAcrossChains(host, { sessionId });

        if (resolved) {
          clearResolveErrorState(controller, 'id', sessionId, host);
        } else if (lastErr) {
          recordResolveFailure(controller, 'id', sessionId, lastErr, host, () => {
            controller.resolveId(sessionId);
          });
        }

        if (controller._destroyed) return;
        maybeCanonicalizeSessionIdRoute(host, sessionId);
      } catch (error) {
        host.warn('[SessionRegistry] Failed resolving /session/:sessionId path:', error);
      } finally {
        const wasPending = controller._pendingIdResolves.delete(sessionId);
        if (wasPending && host.isMounted()) {
          host.bumpResolutionNonce();
        }
      }
    })();
  };

  controller.resolveSlug = (slugIn: string): void => {
    if (controller._destroyed) return;

    const slug = normalizeSessionSlug(slugIn);
    if (!slug) return;
    if (controller._pendingSlugResolves.has(slug)) return;

    const now = Date.now();
    const lastAttempt = Number(controller._slugAttempts[slug] || 0);
    if (now - lastAttempt < MIN_ATTEMPT_GAP_MS) return;

    controller._slugAttempts[slug] = now;
    controller._pendingSlugResolves.add(slug);

    void (async () => {
      try {
        const { resolved, lastErr } = await fetchSessionFromRegistryAcrossChains(host, { slug });

        if (resolved) {
          clearResolveErrorState(controller, 'slug', slug, host);
        } else if (lastErr) {
          recordResolveFailure(controller, 'slug', slug, lastErr, host, () => {
            controller.resolveSlug(slug);
          });
        }
      } catch (error) {
        host.warn('[SessionRegistry] Failed resolving /session/:slug path:', error);
      } finally {
        const wasPending = controller._pendingSlugResolves.delete(slug);
        if (wasPending && host.isMounted()) {
          host.bumpResolutionNonce();
        }
      }
    })();
  };

  controller.getIdStatus = (sessionIdIn: string): ResolveStatus => {
    const sessionId = sessionRegistryUtils.formatSessionId(sessionIdIn);
    if (!sessionId) return buildEmptyResolveStatus();
    return readResolveStatus(controller, 'id', sessionId);
  };

  controller.getSlugStatus = (slugIn: string): ResolveStatus => {
    const slug = normalizeSessionSlug(slugIn);
    if (!slug) return buildEmptyResolveStatus();
    return readResolveStatus(controller, 'slug', slug);
  };

  controller.destroy = (): void => {
    controller._destroyed = true;

    (['id', 'slug'] as ResolveKind[]).forEach((kind: ResolveKind) => {
      Object.values(controller._retryTimers[kind]).forEach((timer) => {
        if (!timer) return;
        clearTimeout(timer);
      });
      controller._retryTimers[kind] = {};
    });

    controller._pendingIdResolves.clear();
    controller._pendingSlugResolves.clear();
  };

  return controller;
}
