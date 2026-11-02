import { resolveWorkerCanonicalStorageTarget } from '../../domains/surveys/workerCanonicalAuthoringPort';
import { initCacheManager, listNamespaceSlugsSync, peekCacheSync, updateCacheAtomic } from '../cache/cacheScripts';
import { remaskQuestionForReader } from './decryptedQuestionReader';
import { getWorkerCanonicalCacheReader, normalizeWorkerCanonicalCacheReader } from './workerCanonicalCacheReader';

type UnknownRecord = Record<string, unknown>;

export const WORKER_CANONICAL_CACHE_SCOPE_KEY = 'worker';
export const WORKER_CANONICAL_CACHE_IDENTITY_FIELD = 'workerCanonicalIdentity';

export type WorkerCanonicalCacheIdentity = {
  version: 2;
  key: string;
  workerOrigin: string;
  sessionSlug: string;
  sessionId: string;
  reader: string;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const readString = (value: unknown): string => String(value || '').trim();

const buildIdentityKey = ({
  workerOrigin,
  sessionSlug,
  sessionId,
  reader,
}: Pick<WorkerCanonicalCacheIdentity, 'workerOrigin' | 'sessionSlug' | 'sessionId' | 'reader'>): string =>
  JSON.stringify([workerOrigin, sessionSlug, sessionId, reader]);

export const resolveWorkerCanonicalCacheIdentity = ({
  sessionConfig,
  sessionSlug,
  reader = getWorkerCanonicalCacheReader(),
}: {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  // Writers pass the account their Worker requests authenticate as; display
  // reads default to the store's current reader.
  reader?: unknown;
} = {}): WorkerCanonicalCacheIdentity => {
  const target = resolveWorkerCanonicalStorageTarget({ sessionConfig, sessionSlug });
  const identity = {
    version: 2 as const,
    workerOrigin: target.workerUrl,
    sessionSlug: target.sessionSlug,
    sessionId: target.sessionId,
    reader: normalizeWorkerCanonicalCacheReader(reader),
  };
  return {
    ...identity,
    key: buildIdentityKey(identity),
  };
};

// Drafts are already stored per account, and this key is part of their storage
// key, so it names only the Worker session and must not change format.
export const resolveWorkerCanonicalSessionKey = ({
  sessionConfig,
  sessionSlug,
}: {
  sessionConfig?: unknown;
  sessionSlug?: unknown;
} = {}): string => {
  const target = resolveWorkerCanonicalStorageTarget({ sessionConfig, sessionSlug });
  return JSON.stringify([target.workerUrl, target.sessionSlug, target.sessionId]);
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
  const reader = typeof rawIdentity.reader === 'string' ? rawIdentity.reader : null;
  const key = readString(rawIdentity.key);
  if (
    version !== 2 ||
    !workerOrigin ||
    !sessionSlug ||
    !sessionId ||
    reader === null ||
    key !== buildIdentityKey({ workerOrigin, sessionSlug, sessionId, reader })
  ) {
    return null;
  }
  return {
    version: 2,
    key,
    workerOrigin,
    sessionSlug,
    sessionId,
    reader,
  };
};

export const workerCanonicalCacheIdentityMatches = (
  cacheNode: unknown,
  expected: WorkerCanonicalCacheIdentity,
): boolean => readWorkerCanonicalCacheIdentity(cacheNode)?.key === expected.key;

// Async work started for `expected` may commit only while the same session and
// reader are current; an account change between start and commit discards it.
export const workerCanonicalSessionTargetMatches = ({
  expected,
  sessionConfig,
  sessionSlug,
  reader,
}: {
  expected: WorkerCanonicalCacheIdentity;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  reader?: unknown;
}): boolean => {
  try {
    return (
      resolveWorkerCanonicalCacheIdentity({
        sessionConfig,
        sessionSlug,
        ...(reader === undefined ? {} : { reader }),
      }).key === expected.key
    );
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

// Removes one reader's Worker nodes, and nodes whose identity predates readers,
// from a cached session root: questionsCache/surveysCache keep the node at the
// root, userCache under each responder. Other readers' nodes belong to other
// tabs' accounts and stay.
const stripWorkerCanonicalCacheNodes = (
  namespace: string,
  cacheRoot: unknown,
  reader: string,
): UnknownRecord | null => {
  if (!isRecord(cacheRoot)) return null;
  const strip = (node: UnknownRecord): UnknownRecord | null => {
    if (!Object.prototype.hasOwnProperty.call(node, WORKER_CANONICAL_CACHE_SCOPE_KEY)) return null;
    const identity = readWorkerCanonicalCacheIdentity(node[WORKER_CANONICAL_CACHE_SCOPE_KEY]);
    if (identity && identity.reader !== reader) return null;
    const rest = { ...node };
    delete rest[WORKER_CANONICAL_CACHE_SCOPE_KEY];
    return rest;
  };
  if (namespace !== 'userCache') return strip(cacheRoot);
  let changed = false;
  const next: UnknownRecord = {};
  Object.entries(cacheRoot).forEach(([responder, byScope]) => {
    const stripped = isRecord(byScope) ? strip(byScope) : null;
    changed = changed || !!stripped;
    next[responder] = stripped || byScope;
  });
  return changed ? next : null;
};

const READER_SCOPED_CACHE_NAMESPACES = ['questionsCache', 'surveysCache', 'userCache'];

// Applies `change` to every cached slug of `namespace` it alters.
const updateChangedCaches = (namespace: string, change: (cacheRoot: unknown) => UnknownRecord | null) =>
  listNamespaceSlugsSync(namespace)
    .filter((slug) => change(peekCacheSync(namespace, slug, { clone: false })))
    .map((slug) => updateCacheAtomic<UnknownRecord>(namespace, slug, (current) => change(current) || current || {}));

// Locks question text in the chain nodes of a questionsCache root again when it
// was decrypted for anyone but `reader`.
const remaskChainQuestions = (cacheRoot: unknown, reader: string): UnknownRecord | null => {
  if (!isRecord(cacheRoot)) return null;
  let next: UnknownRecord | null = null;
  for (const [scope, node] of Object.entries(cacheRoot)) {
    if (scope === WORKER_CANONICAL_CACHE_SCOPE_KEY || !isRecord(node) || !isRecord(node.questions)) continue;
    const questions: UnknownRecord = { ...node.questions };
    let changed = false;
    for (const qid of Object.keys(questions)) {
      const masked = remaskQuestionForReader(questions[qid], reader);
      if (masked) questions[qid] = masked;
      changed = changed || !!masked;
    }
    if (changed) next = { ...(next || cacheRoot), [scope]: { ...node, questions } };
  }
  return next;
};

// Worker nodes hold what the previous account was authorized to read, including
// Worker-decrypted answers, so an account change also removes them from storage.
// Every account change, sign-in and sign-out included, also locks chain-node
// question text not decrypted for the new reader. Startup does not: other tabs
// of the same account share these nodes.
export const purgeWorkerCanonicalCaches = async (previousReader: unknown): Promise<void> => {
  const reader = normalizeWorkerCanonicalCacheReader(previousReader);
  // The slug listing reads the in-memory mirror, which loads from storage once.
  await initCacheManager();
  await Promise.all(
    READER_SCOPED_CACHE_NAMESPACES.flatMap((namespace) =>
      updateChangedCaches(namespace, (cacheRoot) => stripWorkerCanonicalCacheNodes(namespace, cacheRoot, reader)),
    ),
  );
  const nextReader = getWorkerCanonicalCacheReader();
  await Promise.all(updateChangedCaches('questionsCache', (cacheRoot) => remaskChainQuestions(cacheRoot, nextReader)));
};
