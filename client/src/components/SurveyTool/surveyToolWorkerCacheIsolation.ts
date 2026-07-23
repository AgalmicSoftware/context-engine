import {
  buildWorkerCanonicalCacheRunKey,
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  type WorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import { mergeSurveyToolCachePatchIntoSurveysCache } from './surveyToolCacheState';

type UnknownRecord = Record<string, unknown>;
type SurveyCacheRoot = Record<string, UnknownRecord>;
type SurveyCacheMatch = { data?: unknown; foundSlug?: unknown } | null | undefined;

export type SurveyToolWorkerTargetSignature = {
  identity: WorkerCanonicalCacheIdentity | null;
  isWorkerCanonical: boolean;
  key: string;
  valid: boolean;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const resolveSurveyToolWorkerTargetSignature = ({
  sessionConfig,
  sessionSlug,
}: {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
} = {}): SurveyToolWorkerTargetSignature => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  const isWorkerCanonical =
    claimsWorkerCanonicalAuthority(sessionConfig) || (projection.profileValid && projection.isWorkerCanonical);
  if (!isWorkerCanonical) {
    return {
      identity: null,
      isWorkerCanonical: false,
      key: '',
      valid: true,
    };
  }

  try {
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug });
    return {
      identity,
      isWorkerCanonical: true,
      key: buildWorkerCanonicalCacheRunKey(identity),
      valid: true,
    };
  } catch {
    return {
      identity: null,
      isWorkerCanonical: true,
      key: 'worker:invalid',
      valid: false,
    };
  }
};

type SurveyToolCacheWriteContext = {
  networkIdStr?: string;
  sessionConfig?: unknown;
  sessionSlug?: string | null;
};

export const persistSurveyToolCachePatchForCurrentTarget = ({
  expectedContext,
  expectedSessionSlug,
  getCurrentContext,
  patch,
  readSurveysCache,
  writeSurveysCache,
}: {
  expectedContext: SurveyToolCacheWriteContext;
  expectedSessionSlug: string;
  getCurrentContext: () => SurveyToolCacheWriteContext;
  patch: UnknownRecord;
  readSurveysCache: (slug: string) => UnknownRecord;
  writeSurveysCache: (slug: string, cache: unknown) => unknown;
}): boolean => {
  const cacheScope = String(expectedContext.networkIdStr || '');
  if (!cacheScope) return false;
  const expectedWorkerTarget = resolveSurveyToolWorkerTargetSignature({
    sessionConfig: expectedContext.sessionConfig,
    sessionSlug: expectedContext.sessionSlug || expectedSessionSlug,
  });
  if (cacheScope === WORKER_CANONICAL_CACHE_SCOPE_KEY) {
    const currentContext = getCurrentContext();
    const currentWorkerTarget = resolveSurveyToolWorkerTargetSignature({
      sessionConfig: currentContext.sessionConfig,
      sessionSlug: currentContext.sessionSlug || expectedSessionSlug,
    });
    if (
      !expectedWorkerTarget.valid ||
      !expectedWorkerTarget.identity ||
      currentContext.networkIdStr !== WORKER_CANONICAL_CACHE_SCOPE_KEY ||
      !currentWorkerTarget.valid ||
      currentWorkerTarget.key !== expectedWorkerTarget.key
    ) {
      return false;
    }
  }

  const global = mergeSurveyToolCachePatchIntoSurveysCache(readSurveysCache(expectedSessionSlug), cacheScope, patch, {
    workerIdentity: expectedWorkerTarget.identity,
  });
  writeSurveysCache(expectedSessionSlug, global);
  return true;
};

export const readSurveyToolScopedCacheNode = ({
  cache,
  cacheScope,
  sessionConfig,
  sessionSlug,
}: {
  cache?: unknown;
  cacheScope?: unknown;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
} = {}): UnknownRecord | null => {
  const scope = String(cacheScope || '');
  const root = isRecord(cache) ? cache : {};
  const node = isRecord(root[scope]) ? (root[scope] as UnknownRecord) : null;
  if (!node || scope !== WORKER_CANONICAL_CACHE_SCOPE_KEY) return node;

  try {
    const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug });
    return workerCanonicalCacheIdentityMatches(node, identity) ? node : null;
  } catch {
    return null;
  }
};

export const shouldUseSurveyToolCrossSessionCacheFallback = (cacheScope: unknown): boolean =>
  String(cacheScope || '') !== WORKER_CANONICAL_CACHE_SCOPE_KEY;

export const shouldUseSurveyToolChainCacheMissFallback = (cacheScope: unknown): boolean => {
  const scope = String(cacheScope || '');
  return !!scope && scope !== WORKER_CANONICAL_CACHE_SCOPE_KEY;
};

export const loadSurveyToolSurveyData = async ({
  cacheScope,
  ensureSurveysNet,
  findSurveyInAllCaches,
  getSurveyDataById,
  logger,
  provider,
  readSurveysCache,
  sessionConfig,
  sessionSlug,
  surveyId,
  writeSurveysCache,
}: {
  cacheScope?: unknown;
  ensureSurveysNet: (cache: unknown, cacheScope: string) => SurveyCacheRoot;
  findSurveyInAllCaches: (surveyId: string) => SurveyCacheMatch;
  getSurveyDataById: (...args: unknown[]) => Promise<unknown>;
  logger: Pick<Console, 'error' | 'log'>;
  provider?: unknown;
  readSurveysCache: (sessionSlug: string) => Promise<unknown>;
  sessionConfig?: unknown;
  sessionSlug: string;
  surveyId?: unknown;
  writeSurveysCache: (sessionSlug: string, cache: unknown) => unknown;
}): Promise<UnknownRecord | null> => {
  const scope = String(cacheScope || '');
  const loweredSurveyId = String(surveyId || '').toLowerCase();
  logger.log(`[SurveyTool] Getting data for ${loweredSurveyId} in context: ${sessionSlug} (Chain: ${scope})`);

  let surveyData: UnknownRecord | null = null;
  if (scope) {
    const scopedCache = readSurveyToolScopedCacheNode({
      cache: await readSurveysCache(sessionSlug),
      cacheScope: scope,
      sessionConfig,
      sessionSlug,
    });
    const surveys = isRecord(scopedCache?.surveys) ? scopedCache.surveys : {};
    if (surveys[loweredSurveyId]) surveyData = surveys[loweredSurveyId] as UnknownRecord;
  }
  if (!surveyData && shouldUseSurveyToolCrossSessionCacheFallback(scope)) {
    const found = findSurveyInAllCaches(loweredSurveyId);
    if (found) {
      logger.log(
        `[SurveyTool] Found survey ${loweredSurveyId} cached in different group: '${String(found.foundSlug || '')}'. Using cached data.`,
      );
      surveyData = found.data as UnknownRecord;
    }
  }
  if (!surveyData && shouldUseSurveyToolChainCacheMissFallback(scope)) {
    logger.log(`[SurveyTool] Cache miss. Fetching from chain for ${sessionSlug}...`);
    try {
      const fetched = (await getSurveyDataById(provider, loweredSurveyId, sessionSlug)) as UnknownRecord | null;
      if (fetched) {
        surveyData = fetched;
        surveyData.surveyID = loweredSurveyId;
        if (!surveyData.questionIDs) surveyData.questionIDs = [];
        if (!surveyData.creator) surveyData.creator = '';
        surveyData.id = surveyData.surveyID;

        const cacheToUpdate = ensureSurveysNet(await readSurveysCache(sessionSlug), scope);
        if (!cacheToUpdate[scope]) {
          cacheToUpdate[scope] = { surveys: {}, surveysLatestBlock: 0, surveyResponses: {} };
        }
        if (!cacheToUpdate[scope].surveys) cacheToUpdate[scope].surveys = {};
        (cacheToUpdate[scope].surveys as UnknownRecord)[loweredSurveyId] = surveyData;
        await writeSurveysCache(sessionSlug, cacheToUpdate);
      }
    } catch (error: unknown) {
      logger.error('[SurveyTool] Chain fetch failed:', error);
    }
  }
  return surveyData;
};
