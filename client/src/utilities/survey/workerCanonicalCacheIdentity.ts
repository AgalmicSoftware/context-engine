import { resolveWorkerCanonicalStorageTarget } from '../../domains/surveys/workerCanonicalAuthoringPort';

type UnknownRecord = Record<string, unknown>;

export const WORKER_CANONICAL_CACHE_SCOPE_KEY = 'worker';
export const WORKER_CANONICAL_CACHE_IDENTITY_FIELD = 'workerCanonicalIdentity';

export type WorkerCanonicalCacheIdentity = {
  version: 1;
  key: string;
  workerOrigin: string;
  sessionSlug: string;
  sessionId: string;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string => String(value || '').trim();

const buildIdentityKey = ({
  workerOrigin,
  sessionSlug,
  sessionId,
}: Pick<WorkerCanonicalCacheIdentity, 'workerOrigin' | 'sessionSlug' | 'sessionId'>): string =>
  JSON.stringify([workerOrigin, sessionSlug, sessionId]);

export const resolveWorkerCanonicalCacheIdentity = ({
  sessionConfig,
  sessionSlug,
}: {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
} = {}): WorkerCanonicalCacheIdentity => {
  const target = resolveWorkerCanonicalStorageTarget({ sessionConfig, sessionSlug });
  const identity = {
    version: 1 as const,
    workerOrigin: target.workerUrl,
    sessionSlug: target.sessionSlug,
    sessionId: target.sessionId,
  };
  return {
    ...identity,
    key: buildIdentityKey(identity),
  };
};

export const buildWorkerCanonicalCacheRunKey = (identity: WorkerCanonicalCacheIdentity): string =>
  `worker:${identity.key}`;

export const readWorkerCanonicalCacheIdentity = (cacheNode: unknown): WorkerCanonicalCacheIdentity | null => {
  const node = isRecord(cacheNode) ? cacheNode : {};
  const rawIdentity = isRecord(node[WORKER_CANONICAL_CACHE_IDENTITY_FIELD])
    ? (node[WORKER_CANONICAL_CACHE_IDENTITY_FIELD] as UnknownRecord)
    : {};
  const version = Number(rawIdentity.version || 0);
  const workerOrigin = readString(rawIdentity.workerOrigin);
  const sessionSlug = readString(rawIdentity.sessionSlug);
  const sessionId = readString(rawIdentity.sessionId);
  const key = readString(rawIdentity.key);
  if (
    version !== 1 ||
    !workerOrigin ||
    !sessionSlug ||
    !sessionId ||
    key !== buildIdentityKey({ workerOrigin, sessionSlug, sessionId })
  ) {
    return null;
  }
  return {
    version: 1,
    key,
    workerOrigin,
    sessionSlug,
    sessionId,
  };
};

export const workerCanonicalCacheIdentityMatches = (
  cacheNode: unknown,
  expected: WorkerCanonicalCacheIdentity,
): boolean => readWorkerCanonicalCacheIdentity(cacheNode)?.key === expected.key;

export const workerCanonicalSessionTargetMatches = ({
  expected,
  sessionConfig,
  sessionSlug,
}: {
  expected: WorkerCanonicalCacheIdentity;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
}): boolean => {
  try {
    return resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug }).key === expected.key;
  } catch {
    return false;
  }
};

export const withWorkerCanonicalCacheIdentity = (
  cacheNode: UnknownRecord,
  identity: WorkerCanonicalCacheIdentity,
): UnknownRecord => ({
  ...cacheNode,
  [WORKER_CANONICAL_CACHE_IDENTITY_FIELD]: { ...identity },
});
