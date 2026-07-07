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
