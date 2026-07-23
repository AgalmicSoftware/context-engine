import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { getSessionConfigBySlug, normalizeSessionSlug } from '../../utilities/web3/chainGateway.js';
import {
  resolveWorkerCanonicalCacheIdentity,
  type WorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';

type UnknownRecord = Record<string, unknown>;
type ManagedResourceMap = Record<string, unknown>;
type ManagedCacheSnapshot = UnknownRecord | null;

export type CreateQuestionsManagedCacheSeedTargets = {
  primaryNetId: string;
  primarySlug: string;
};

type SubmittedResourcesCacheOptions = {
  slug?: string;
  netId?: unknown;
  surveyAddedSuccessfully?: unknown;
  questionsAddedSuccessfully?: unknown;
  surveyId?: unknown;
  questionIds?: unknown;
};

const isObjectLikeRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

const getManagedResourceMap = (bucket: unknown, mapKey: 'questions' | 'surveys'): ManagedResourceMap => {
  if (!isObjectLikeRecord(bucket)) return {};
  const resourceMap = bucket[mapKey];
  return isObjectLikeRecord(resourceMap) ? resourceMap : {};
};

export const readManagedCacheSnapshot = (namespace: string, slug = ''): ManagedCacheSnapshot => {
  const snapshot = peekCacheSync(namespace, slug, { clone: false });
  return isObjectLikeRecord(snapshot) ? snapshot : null;
};

export const selectManagedNetBucketSnapshot = (
  namespace: string,
  slug: string,
  netKey: string,
): ManagedCacheSnapshot => {
  const obj = readManagedCacheSnapshot(namespace, slug);
  if (!obj || !netKey) return null;
  const netBucket = obj[netKey];
  return isObjectLikeRecord(netBucket) ? netBucket : null;
};

export const resolveCreateQuestionsManagedCacheSeedTargets = ({
  activeSessionSlug,
  currentSessionSlug,
  network,
  networkChainId,
  resolveSessionChainId,
  routePathname,
  sessionConfig,
  sessionSlug,
}: {
  activeSessionSlug?: unknown;
  currentSessionSlug?: unknown;
  network?: { chainId?: unknown; id?: unknown } | null;
  networkChainId?: unknown;
  resolveSessionChainId: (sessionConfig: UnknownRecord) => unknown;
  routePathname?: unknown;
  sessionConfig?: UnknownRecord | null;
  sessionSlug?: unknown;
}): CreateQuestionsManagedCacheSeedTargets => {
  const routeSlug = (() => {
    try {
      const pathname = String(routePathname || '');
      if (!pathname.startsWith('/session/')) return '';
      return normalizeSessionSlug((pathname.split('/').filter(Boolean)[1] || '').trim());
    } catch {
      return '';
    }
  })();
  const cfg = sessionConfig || {};
  const slugCandidates = Array.from(
    new Set(
      [cfg.slug, activeSessionSlug, sessionSlug, currentSessionSlug, routeSlug].map((slug) =>
        normalizeSessionSlug(slug || ''),
      ),
    ),
  ).filter((slug) => slug !== '');
  const primarySlug = slugCandidates[0] || '';
  const sessionConfigSlug = normalizeSessionSlug(cfg.slug || '');
  const cfgForNet =
    sessionConfigSlug === primarySlug ? cfg : (getSessionConfigBySlug(primarySlug) as UnknownRecord | null) || cfg;
  const projection = resolveSessionCapabilityProjection(cfgForNet);
  if (projection.profileValid && projection.isWorkerCanonical) {
    try {
      resolveWorkerCanonicalCacheIdentity({ sessionConfig: cfgForNet, sessionSlug: primarySlug });
      return { primarySlug, primaryNetId: 'worker' };
    } catch {
      return { primarySlug, primaryNetId: '' };
    }
  }

  const netIdCandidates = Array.from(
    new Set(
      [
        resolveSessionChainId(cfg),
        cfgForNet.networkChainId,
        (cfgForNet.contracts as UnknownRecord | undefined)?.surveys &&
          ((cfgForNet.contracts as UnknownRecord).surveys as UnknownRecord).chainId,
        (cfgForNet.contracts as UnknownRecord | undefined)?.sbtFactory &&
          ((cfgForNet.contracts as UnknownRecord).sbtFactory as UnknownRecord).chainId,
        networkChainId,
        network?.id,
        network?.chainId,
      ]
        .map((value) => String(value ?? '').trim())
        .filter(Boolean),
    ),
  );
  if (!netIdCandidates.length) {
    ['questionsCache', 'surveysCache'].forEach((namespace) => {
      const existing = readManagedCacheSnapshot(namespace, primarySlug);
      if (!existing) return;
      Object.keys(existing).forEach((key) => {
        const normalized = String(key || '').trim();
        if (normalized) netIdCandidates.push(normalized);
      });
    });
  }
  const normalizedNetIds = Array.from(
    new Set(
      netIdCandidates
        .map((value) => String(value || '').trim())
        .filter((value) => value && value !== 'undefined' && value !== 'null'),
    ),
  );
  return { primarySlug, primaryNetId: normalizedNetIds[0] || '' };
};

export const resolveCreateQuestionsManagedWorkerCacheIdentity = ({
  sessionConfig,
  target,
}: {
  sessionConfig?: unknown;
  target: CreateQuestionsManagedCacheSeedTargets;
}): WorkerCanonicalCacheIdentity | null => {
  if (target.primaryNetId !== 'worker') return null;
  try {
    return resolveWorkerCanonicalCacheIdentity({
      sessionConfig,
      sessionSlug: target.primarySlug,
    });
  } catch {
    return null;
  }
};

export const hasSubmittedResourcesInManagedCache = ({
  slug = '',
  netId = '',
  surveyAddedSuccessfully = false,
  questionsAddedSuccessfully = false,
  surveyId = '',
  questionIds = [],
}: SubmittedResourcesCacheOptions = {}): boolean => {
  const netKey = String(netId || '');
  if (!netKey) return false;

  const surveyIdLower = String(surveyId || '').toLowerCase();
  const questionIdsLower = (Array.isArray(questionIds) ? questionIds : [])
    .map((id: unknown) => String(id || '').toLowerCase())
    .filter(Boolean);

  if (surveyAddedSuccessfully && surveyIdLower) {
    const netBucket = selectManagedNetBucketSnapshot('surveysCache', slug, netKey);
    return !!getManagedResourceMap(netBucket, 'surveys')[surveyIdLower];
  }

  if (questionsAddedSuccessfully && questionIdsLower.length > 0) {
    const netBucket = selectManagedNetBucketSnapshot('questionsCache', slug, netKey);
    const map = getManagedResourceMap(netBucket, 'questions');
    return questionIdsLower.every((id) => !!map[id]);
  }

  return false;
};
