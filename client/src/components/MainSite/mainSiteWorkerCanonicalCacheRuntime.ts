import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { createLogger } from 'utilities/logging.js';

const log = createLogger('mainSite');

type UnknownRecord = Record<string, unknown>;

export type MainSiteWorkerCanonicalCacheRuntimeHost = {
  initializeQuestionCacheForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  initializeSbtCacheForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  initializeSurveyCacheForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  fetchQuestionResponsesChunkedForGroup: (slug: string, opts?: UnknownRecord) => Promise<void>;
  setReadinessStateIfChanged: (patch: UnknownRecord, callback?: () => void) => unknown;
  checkAllCachesReady: () => unknown;
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
  // A private session's shell holds nothing to load; the page reads the session again once it is let in.
  if ((sessionConfig as UnknownRecord | null)?.privateSession) return true;

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

  // Surveys load before answers: a large session's answers take a while, and the questions never wait on them.
  // Others' answers can be refused, as on a private session before sign-in; that says nothing about the questions
  // or surveys, and response readiness stays with its own controller.
  const loadAnswers = () =>
    host.fetchQuestionResponsesChunkedForGroup(sessionSlug).catch((error: unknown) => {
      log.warn('Responses did not load:', error);
    });
  try {
    await host.initializeSurveyCacheForGroup(sessionSlug);
  } catch (error) {
    // Answers still load, but the survey error is reported now, not after them.
    if (isCurrent()) void loadAnswers();
    throw error;
  }
  if (!isCurrent()) return true;
  host.setReadinessStateIfChanged({ isSurveyCacheReady: true }, () => {
    if (isCurrent()) host.checkAllCachesReady();
  });
  await loadAnswers();

  return true;
};
