import { getDemoSessionConfigBySlug, normalizeSessionSlug } from '../../domains/sessions/sessionConfig.js';
import type { MainSiteSessionConfigLike } from '../../utilities/session/mainSiteSessionConfig.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { getChainById } from '../../variables/chains.js';
import type { SessionConfigLike } from '../shellTypes';
import type { AppShell } from './AppShell';
import { initializeMainSiteWorkerCanonicalCaches } from './mainSiteWorkerCanonicalCacheRuntime.js';
import { mergeMainSiteSessionDisplayConfig } from './routeSessionResolution.js';
import { getWorkerCanonicalRouteController } from './workerCanonicalRouteController.js';

type LogError = (message: string, error: unknown) => void;

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
  const configuredSlug = normalizeSessionSlug(sessionConfig?.slug ?? '');
  // A public route alias may resolve to a different canonical Worker session.
  // Cache/storage calls must use the config-owned slug so exact authority checks
  // cannot write under the alias bucket or reject an otherwise valid session.
  const cacheSlug = configuredSlug || slug;

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
    await initializeMainSiteWorkerCanonicalCaches({
      host,
      sessionConfig,
      sessionSlug: cacheSlug,
      isCurrent,
    });
    if (isCurrent()) host.checkAllCachesReady();
  } catch (error: unknown) {
    if (isCurrent()) {
      logError('[WorkerCanonical] Cache initialization failed:', error);
      // Response readiness belongs to the response hydration controller: a failed
      // load proves nothing about saved answers, so uploads must keep waiting.
      host.setReadinessStateIfChanged(
        {
          isSBTCacheReady: true,
          isSurveyCacheReady: true,
          isQuestionCacheReady: true,
          surveyCacheInitializationError: true,
          questionCacheInitializationError: true,
        },
        host.checkAllCachesReady,
      );
    }
  }
  return true;
};
