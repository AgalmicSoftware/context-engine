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

export const shouldUseSurveyToolChainCacheMissFallback = (cacheScope: unknown): boolean => {
  const scope = String(cacheScope || '');
  return !!scope && scope !== WORKER_CANONICAL_CACHE_SCOPE_KEY;
};
