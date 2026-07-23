import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';

type UnknownRecord = Record<string, unknown>;

export type MainSiteWorkerCanonicalCacheRuntimeHost = {
  initializeQuestionCacheForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  initializeSbtCacheForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  initializeSurveyCacheForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  fetchQuestionResponsesChunkedForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  setReadinessStateIfChanged: (patch: UnknownRecord, callback?: () => void) => unknown;
  startSbtEventListenerForGroup: (slug: string) => unknown;
};

export type MainSiteWorkerCanonicalCacheRuntimeOptions = {
  host: MainSiteWorkerCanonicalCacheRuntimeHost;
  sessionConfig: unknown;
  sessionSlug: string;
  isCurrent?: () => boolean;
};

export const initializeMainSiteWorkerCanonicalCaches = async ({
  host,
  sessionConfig,
  sessionSlug,
  isCurrent = () => true,
}: MainSiteWorkerCanonicalCacheRuntimeOptions): Promise<boolean> => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (!projection.profileValid || !projection.isWorkerCanonical) return false;

  await host.initializeQuestionCacheForGroup(sessionSlug);
  if (!isCurrent()) return true;

  if (projection.usesOnChainSbt) {
    await host.initializeSbtCacheForGroup(sessionSlug, { mode: 'partial' });
    if (!isCurrent()) return true;
    host.setReadinessStateIfChanged({ isSBTCacheReady: true });
    host.startSbtEventListenerForGroup(sessionSlug);
  } else {
    host.setReadinessStateIfChanged({ isSBTCacheReady: true });
  }
  if (!isCurrent()) return true;

  await host.fetchQuestionResponsesChunkedForGroup(sessionSlug);
  if (!isCurrent()) return true;

  await host.initializeSurveyCacheForGroup(sessionSlug);
  if (!isCurrent()) return true;
  host.setReadinessStateIfChanged({ isSurveyCacheReady: true });

  return true;
};
