import { resolveSessionCapabilityProjection } from '../session/sessionCapabilityProjection';
import {
  buildWorkerCanonicalCacheRunKey,
  resolveWorkerCanonicalCacheIdentity,
  type WorkerCanonicalCacheIdentity,
  workerCanonicalSessionTargetMatches,
} from './workerCanonicalCacheIdentity';
import type { WorkerCanonicalResponseRow } from './workerResponseHydration.js';

type CacheRecord = Record<string, unknown>;
type CacheUpdater = (current: unknown) => unknown;

export type WorkerResponseHydrationLoader = (options: {
  account?: unknown;
  providerLike?: unknown;
  sessionSlug: string;
  sessionConfig: CacheRecord;
  cachedStorageRefIds?: ReadonlySet<string>;
  startCursor?: string | null;
  onPartial?: (resumeCursor: string) => void;
  onListed?: (storageRefIds: ReadonlySet<string>) => void;
}) => Promise<WorkerCanonicalResponseRow[]>;

export type WorkerResponseHydrationRun = {
  identity: WorkerCanonicalCacheIdentity;
  key: string;
};

type WorkerResponseHydrationOptions = {
  sessionSlug: string;
  sessionConfig: CacheRecord;
  run: WorkerResponseHydrationRun;
  loadWorkerResponses?: WorkerResponseHydrationLoader;
  getAccount: () => unknown;
  getProviderLike: () => unknown;
  getCurrentSessionConfig: () => CacheRecord | null;
  shouldAbort: () => boolean;
  markLoading: () => void;
  markReady: (partial?: boolean) => void;
  updateQuestionsCacheAtomic: (updater: CacheUpdater) => Promise<boolean>;
  updateUserCacheAtomic: (updater: CacheUpdater) => Promise<boolean>;
  createPersistenceError: (message: string) => Error;
};

export const resolveWorkerResponseHydrationRun = ({
  sessionConfig,
  sessionSlug,
  reader,
}: {
  sessionConfig: unknown;
  sessionSlug: string;
  reader?: unknown;
}): WorkerResponseHydrationRun | null => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (!projection.profileValid || !projection.isWorkerCanonical) return null;
  const identity = resolveWorkerCanonicalCacheIdentity({
    sessionConfig,
    sessionSlug,
    ...(reader === undefined ? {} : { reader }),
  });
  return {
    identity,
    key: buildWorkerCanonicalCacheRunKey(identity),
  };
};

export const hydrateWorkerCanonicalResponses = async ({
  sessionSlug,
  sessionConfig,
  run,
  loadWorkerResponses,
  getAccount,
  getProviderLike,
  getCurrentSessionConfig,
  shouldAbort,
  markLoading,
  markReady,
  updateQuestionsCacheAtomic,
  updateUserCacheAtomic,
  createPersistenceError,
}: WorkerResponseHydrationOptions): Promise<void> => {
  // The listing is authorized as getAccount(), so its rows belong to that reader.
  const targetIsCurrent = (): boolean =>
    workerCanonicalSessionTargetMatches({
      expected: run.identity,
      sessionConfig: getCurrentSessionConfig(),
      sessionSlug,
      reader: getAccount(),
    });
  const shouldStop = (): boolean => shouldAbort() || !targetIsCurrent();

  markLoading();
  const workerHydration = await import('./workerResponseHydration.js');
  const loadRows = loadWorkerResponses || workerHydration.loadWorkerResponses;
  if (shouldStop()) return;

  let cachedStorageRefIds = new Set<string>();
  let cachedRows: WorkerCanonicalResponseRow[] = [];
  let startCursor = '';
  const initializedQuestions = await updateQuestionsCacheAtomic((current) => {
    const merged = targetIsCurrent()
      ? workerHydration.mergeWorkerQuestionResponses(current, [], sessionSlug, run.identity)
      : current || {};
    // Only reuse refs after the merge has checked the exact Worker/session identity.
    const worker = (merged as CacheRecord).worker as CacheRecord | undefined;
    if (targetIsCurrent() && worker) {
      worker.workerResponseHydrationStatus = 'loading';
      // Each run consumes the continuation a capped run saved, so a failed
      // continuation (such as an expired cursor) restarts from the first page.
      startCursor = typeof worker.workerResponseListCursor === 'string' ? worker.workerResponseListCursor : '';
      delete worker.workerResponseListCursor;
    }
    cachedStorageRefIds = new Set(Object.keys((worker?.workerResponseStorageRefs as CacheRecord) || {}));
    const responses = (worker?.questionResponses || {}) as Record<string, Record<string, CacheRecord>>;
    const metadata = (worker?.questionResponsesMeta || {}) as Record<string, Record<string, CacheRecord>>;
    cachedRows = Object.entries(responses).flatMap(([questionId, byResponder]) =>
      Object.entries(byResponder).map(([responder, response]) => ({
        questionId,
        responder,
        response,
        storageRefId: String(metadata[questionId]?.[responder]?.storageRefId || ''),
        timestamp: Number(metadata[questionId]?.[responder]?.ts || 0),
      })),
    );
    return merged;
  });
  if (!initializedQuestions) {
    throw createPersistenceError(`Failed to initialize Worker questions cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  const initializedUsers = await updateUserCacheAtomic((current) =>
    targetIsCurrent() ? workerHydration.mergeWorkerUserResponses(current, cachedRows, run.identity) : current || {},
  );
  if (!initializedUsers) {
    throw createPersistenceError(`Failed to initialize Worker user cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  let capped = false;
  let resumeCursor = '';
  let listedStorageRefIds = null as ReadonlySet<string> | null;
  const rows = await loadRows({
    account: getAccount(),
    providerLike: getProviderLike(),
    sessionSlug,
    sessionConfig,
    cachedStorageRefIds,
    startCursor: startCursor || null,
    onPartial: (cursor) => {
      capped = true;
      resumeCursor = typeof cursor === 'string' ? cursor : '';
    },
    onListed: (storageRefIds) => {
      listedStorageRefIds = storageRefIds;
    },
  });
  if (shouldStop()) return;
  // Only one run that lists from the first page to the last sees every row.
  const partial = capped || !!startCursor;
  // A complete listing is authoritative for this reader.
  const listed = listedStorageRefIds;
  const staleRefIds = listed ? new Set([...cachedStorageRefIds].filter((refId) => !listed.has(refId))) : undefined;

  const questionsPersisted = await updateQuestionsCacheAtomic((current) => {
    if (!targetIsCurrent()) return current || {};
    const merged = workerHydration.mergeWorkerQuestionResponses(current, rows, sessionSlug, run.identity, staleRefIds);
    // A capped listing is a settled snapshot, not a complete history. Reports
    // may display its new rows while missing-answer checks still remain unready.
    const worker = merged.worker as CacheRecord;
    worker.workerResponseHydrationStatus = partial ? 'partial' : 'complete';
    // The next refresh continues from here instead of rereading the same prefix.
    if (resumeCursor) worker.workerResponseListCursor = resumeCursor;
    return merged;
  });
  if (!questionsPersisted) {
    throw createPersistenceError(`Failed to persist Worker questions cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  const usersPersisted = await updateUserCacheAtomic((current) =>
    targetIsCurrent()
      ? workerHydration.mergeWorkerUserResponses(current, rows, run.identity, staleRefIds)
      : current || {},
  );
  if (!usersPersisted) {
    throw createPersistenceError(`Failed to persist Worker user cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  markReady(partial);
};
