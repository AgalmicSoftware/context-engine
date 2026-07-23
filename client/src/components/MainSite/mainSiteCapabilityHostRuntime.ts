import { getDemoSessionConfigBySlug, normalizeSessionSlug } from '../../domains/sessions/sessionConfig.js';
import { getPrimaryDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import type { MainSiteSessionConfigLike } from '../../utilities/session/mainSiteSessionConfig.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { isBrowserOriginAllowedBySessionWorkerConfig } from '../../utilities/session/sessionWorkerCorsPolicy';
import { getChainById } from '../../variables/chains.js';
import type { SessionConfigLike } from '../shellTypes';
import type { AppShell } from './AppShell';
import { mergeMainSiteSessionDisplayConfig } from './routeSessionResolution.js';
import { getWorkerCanonicalRouteController } from './workerCanonicalRouteController.js';

type LogError = (message: string, error: unknown) => void;
type LogWarning = (message: string, details: Record<string, unknown>) => void;

export const resolveMainSiteDisplaySessionConfig = (
  host: AppShell,
  slugIn: unknown,
): MainSiteSessionConfigLike | null => {
  const slug = normalizeSessionSlug(slugIn ?? '');
  const workerCanonicalRoutes = getWorkerCanonicalRouteController(host);
  if (workerCanonicalRoutes.isSessionSlug(slug)) {
    return workerCanonicalRoutes.getActiveVerifiedConfig(slug) as MainSiteSessionConfigLike | null;
  }
  const strictConfig = host.getSessionCfg(slug);
  let demoConfig =
    (getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) as MainSiteSessionConfigLike | null) || null;
  if (!demoConfig && slug === 'demo') {
    demoConfig =
      (getDemoSessionConfigBySlug('', { allowDemoFallback: true }) as MainSiteSessionConfigLike | null) || null;
  }
  return mergeMainSiteSessionDisplayConfig(
    strictConfig as SessionConfigLike | null,
    demoConfig as SessionConfigLike | null,
  ) as MainSiteSessionConfigLike | null;
};

export const resolveMainSiteDisplaySessionChainId = (host: AppShell, slugIn: unknown): number | null => {
  const slug = normalizeSessionSlug(slugIn ?? '');
  const projection = resolveSessionCapabilityProjection(host.getDisplaySessionCfg(slug));
  if (!projection.showNetworkControls) return null;
  if (projection.chainId) return projection.chainId;
  if (projection.source !== 'legacy_registry') return null;
  return host.getSessionChainId(slug) || null;
};

export const resolveMainSiteDisplaySessionNetwork = (host: AppShell, slugIn: unknown) => {
  const slug = normalizeSessionSlug(slugIn ?? '');
  const chainId = host.getDisplaySessionChainId(slug);
  if (!chainId) return null;
  const strictNetwork = host.getSessionNetwork(slug);
  if (Number(strictNetwork?.id || strictNetwork?.chainId || 0) === chainId) return strictNetwork;
  return (
    getChainById(chainId) || {
      id: chainId,
      name: `Chain ${chainId}`,
      network: String(chainId),
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [] }, public: { http: [] } },
      blockExplorers: { default: { name: '', url: '' } },
      unsupported: false,
    }
  );
};

export const initializeMainSiteWorkerCanonicalCachesForGroup = async (
  host: AppShell,
  slugIn: unknown,
  { resetReadiness = false }: { resetReadiness?: boolean } = {},
  logError: LogError,
): Promise<boolean> => {
  const slug = normalizeSessionSlug(slugIn ?? '');
  const sessionConfig = host.getCacheSessionCfg(slug);
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (!projection.profileValid || !projection.isWorkerCanonical) return false;

  const cacheReinitRunToken = host.startCacheReinitRun();
  const isCurrent = () => host.isCacheReinitRunActive(cacheReinitRunToken);
  if (resetReadiness) {
    host.setReadinessStateIfChanged({
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      isAllCachesReady: false,
      cacheHasLoaded: false,
      surveyCacheInitializationError: false,
      questionCacheInitializationError: false,
    });
  }

  try {
    const { initializeMainSiteWorkerCanonicalCaches } = await import('./mainSiteWorkerCanonicalCacheRuntime.js');
    await initializeMainSiteWorkerCanonicalCaches({
      host,
      sessionConfig,
      sessionSlug: slug,
      isCurrent,
    });
    if (isCurrent()) host.checkAllCachesReady();
  } catch (error: unknown) {
    if (isCurrent()) {
      logError('[WorkerCanonical] Cache initialization failed:', error);
      host.setReadinessStateIfChanged(
        {
          isSBTCacheReady: true,
          isSurveyCacheReady: true,
          isQuestionCacheReady: true,
          isResponsesCacheReady: true,
          surveyCacheInitializationError: true,
          questionCacheInitializationError: true,
        },
        host.checkAllCachesReady,
      );
    }
  }
  return true;
};

export const preloadMainSiteAboutDemoSessionData = (
  host: AppShell,
  pathIn: unknown,
  logWarning: LogWarning,
): Promise<void> | null => {
  if (!host.isAboutRoutePath(pathIn)) return null;

  const slug = normalizeSessionSlug(getPrimaryDemoSessionSlug());
  if (!slug) return null;
  const sessionConfig = host.getDisplaySessionCfg(slug);
  if (!isBrowserOriginAllowedBySessionWorkerConfig(sessionConfig)) return null;
  if (host._aboutDemoSessionPreloadSlug === slug && host._aboutDemoSessionPreloadPromise) {
    return host._aboutDemoSessionPreloadPromise;
  }

  const run = (async () => {
    const projection = resolveSessionCapabilityProjection(sessionConfig);
    const preloadTasks: Array<Promise<unknown>> = [
      host.initializeQuestionCacheForGroup(slug, { background: true }),
      host.initializeSurveyCacheForGroup(slug, { background: true }),
    ];
    if (projection.isRegistryCanonical || projection.usesOnChainSbt) {
      preloadTasks.push(host.initializeSbtCacheForGroup(slug, { mode: 'partial', background: true }));
    }
    const results = await Promise.allSettled(preloadTasks);
    const firstRejected = results.find((result) => result.status === 'rejected');
    if (firstRejected?.status === 'rejected') throw firstRejected.reason;
  })()
    .catch((error: unknown) => {
      logWarning('[About] Demo session preload failed', { slug, error });
    })
    .finally(() => {
      if (host._aboutDemoSessionPreloadPromise === run) {
        host._aboutDemoSessionPreloadPromise = null;
      }
    });

  host._aboutDemoSessionPreloadSlug = slug;
  host._aboutDemoSessionPreloadPromise = run;
  return run;
};
