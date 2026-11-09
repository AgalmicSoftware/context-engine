import { remaskQuestionForReader, remaskSurveyForReader } from '../../utilities/survey/decryptedQuestionReader';
import {
  buildWorkerCanonicalCacheRunKey,
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  type WorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import { getWorkerCanonicalCacheReader } from '../../utilities/survey/workerCanonicalCacheReader';
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

const CHAIN_NODE_REMASKS = [
  ['questions', remaskQuestionForReader],
  ['surveys', remaskSurveyForReader],
] as const;

// Chain nodes are shared by every account using this browser, and relocking them
// in storage waits for an account change. Reads lock text decrypted for another
// reader, or for anyone while signed out, in a copy of the changed entries.
const remaskChainNodeForReader = (node: UnknownRecord, reader = getWorkerCanonicalCacheReader()): UnknownRecord => {
  let next = node;
  for (const [collection, remask] of CHAIN_NODE_REMASKS) {
    const entries = node[collection];
    if (!isRecord(entries)) continue;
    let masked: UnknownRecord | null = null;
    for (const id of Object.keys(entries)) {
      const entry = remask(entries[id], reader);
      if (entry) (masked ??= { ...entries })[id] = entry;
    }
    if (masked) next = { ...next, [collection]: masked };
  }
  return next;
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
  if (!node) return null;
  if (scope !== WORKER_CANONICAL_CACHE_SCOPE_KEY) return remaskChainNodeForReader(node);

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
