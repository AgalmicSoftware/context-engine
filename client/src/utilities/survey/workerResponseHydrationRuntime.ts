import { resolveSessionCapabilityProjection } from '../session/sessionCapabilityProjection';
import {
  buildWorkerCanonicalCacheRunKey,
  resolveWorkerCanonicalCacheIdentity,
  type WorkerCanonicalCacheIdentity,
  workerCanonicalSessionTargetMatches,
} from './workerCanonicalCacheIdentity';
import type { WorkerCanonicalResponseRow, WorkerResponseLoadProgress } from './workerResponseHydration.js';

type CacheRecord = Record<string, unknown>;
type CacheUpdater = (current: unknown) => unknown;

export type WorkerResponseHydrationLoader = (options: {
  account?: unknown;
  providerLike?: unknown;
  sessionSlug: string;
  sessionConfig: CacheRecord;
  cachedStorageRefIds?: ReadonlySet<string>;
  startCursor?: string | null;
  onPartial?: (resumeCursor?: string) => void;
  onListed?: (storageRefIds: ReadonlySet<string>) => void;
  onRows?: (rows: WorkerCanonicalResponseRow[], progress: WorkerResponseLoadProgress) => void;
  ownResponses?: boolean;
  signal?: AbortSignal;
}) => Promise<WorkerCanonicalResponseRow[]>;

// How often rows that have landed are merged in while a load runs, so Results fill in as answers arrive.
export const PROGRESS_MERGE_MS = 2_000;

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
  // Results read the cache again: rows merged in mid-load, or the load failed.
  markProgress?: () => void;
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
  markProgress,
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
  // Copies the Worker stripped of research material that this reader now gets whole (their own answers, or all
  // for an admin), such as ones read before they signed in: read again, never reused.
  const reader = String(getAccount() || '')
    .trim()
    .toLowerCase();
  const readsAllWhole = workerHydration.readsResearchMaterial(sessionConfig, reader);
  let strippedRefIds = new Set<string>();
  const initializedQuestions = await updateQuestionsCacheAtomic((current) => {
    const merged = targetIsCurrent()
      ? workerHydration.mergeWorkerQuestionResponses(current, [], sessionSlug, run.identity)
      : current || {};
    // Only reuse refs after the merge has checked the exact Worker/session identity.
    const worker = (merged as CacheRecord).worker as CacheRecord | undefined;
    if (targetIsCurrent() && worker) {
      worker.workerResponseHydrationStatus = 'loading';
      delete worker.workerResponseLoadProgress;
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
    strippedRefIds = new Set(
      cachedRows
        .filter(
          (row) =>
            (row.response as CacheRecord)?.interviewProvenanceWithheld === true &&
            (readsAllWhole || (!!reader && row.responder.toLowerCase() === reader)),
        )
        .map((row) => row.storageRefId)
        .filter(Boolean),
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

  // Rows that landed but are not merged yet. Merges only add rows, so Results can show them before the load ends;
  // the final merge below takes every row again and drops stale ones.
  let unmerged: WorkerCanonicalResponseRow[] = [];
  let lastProgress: WorkerResponseLoadProgress | null = null;
  let progressMerge: Promise<void> = Promise.resolve();
  let progressTimer: ReturnType<typeof setTimeout> | null = null;
  let mergedOnce = false;
  let finished = false;
  const mergeProgress = () => {
    progressTimer = null;
    const landed = unmerged;
    const progress = lastProgress;
    unmerged = [];
    mergedOnce = true;
    progressMerge = progressMerge
      .then(async () => {
        if (finished || shouldStop()) return;
        const merged = await updateQuestionsCacheAtomic((current) => {
          if (finished || !targetIsCurrent()) return current || {};
          const next = workerHydration.mergeWorkerQuestionResponses(current, landed, sessionSlug, run.identity);
          (next.worker as CacheRecord).workerResponseLoadProgress = progress;
          return next;
        });
        if (merged && !finished && !shouldStop()) markProgress?.();
      })
      // A failed mid-load merge is retried by the final one, which reports its own failure.
      .catch(() => {});
  };
  // A load whose reader or session changed while it ran is stale: nothing it reads is kept. It stops at the next
  // rows it reports, rather than read every answer to the end beside the load that replaced it (someone signing in
  // while a public session's answers load started a second full read).
  const stale = new AbortController();
  const onRows = (landed: WorkerCanonicalResponseRow[], progress: WorkerResponseLoadProgress) => {
    if (shouldStop()) {
      stale.abort();
      return;
    }
    unmerged.push(...landed);
    lastProgress = progress;
    if (!progressTimer) progressTimer = setTimeout(mergeProgress, mergedOnce ? PROGRESS_MERGE_MS : 0);
  };
  const stopProgress = async () => {
    finished = true;
    if (progressTimer) clearTimeout(progressTimer);
    progressTimer = null;
    await progressMerge;
  };

  try {
    let capped = false;
    let resumeCursor = '';
    let listedStorageRefIds = null as ReadonlySet<string> | null;
    const load = (knownRefIds: ReadonlySet<string>, fromCursor: string) =>
      loadRows({
        account: getAccount(),
        providerLike: getProviderLike(),
        sessionSlug,
        sessionConfig,
        cachedStorageRefIds: knownRefIds,
        startCursor: fromCursor || null,
        onPartial: (cursor) => {
          capped = true;
          resumeCursor = typeof cursor === 'string' ? cursor : '';
        },
        onListed: (storageRefIds) => {
          listedStorageRefIds = storageRefIds;
        },
        onRows,
        signal: stale.signal,
      });
    let rows = await load(new Set([...cachedStorageRefIds].filter((refId) => !strippedRefIds.has(refId))), startCursor);
    if (shouldStop()) return;
    // A complete listing is authoritative for this reader.
    const listed = listedStorageRefIds as ReadonlySet<string> | null;
    let staleRefIds = listed ? new Set([...cachedStorageRefIds].filter((refId) => !listed.has(refId))) : undefined;
    if (staleRefIds?.size) {
      // An answer this reader could read is gone, so a responder's older version may
      // be what it can read now. Rebuild from a full read, as a fresh client would.
      listedStorageRefIds = null;
      rows = await load(new Set(), '');
      if (shouldStop()) return;
      const relisted = listedStorageRefIds as ReadonlySet<string> | null;
      if (relisted) staleRefIds = cachedStorageRefIds;
    }
    // A stripped copy read again whole replaces the cached one.
    const reread = rows.filter((row) => strippedRefIds.has(row.storageRefId)).map((row) => row.storageRefId);
    if (reread.length) staleRefIds = new Set([...(staleRefIds || []), ...reread]);
    // Only one run that lists from the first page to the last sees every row.
    const partial = capped || !!startCursor;
    await stopProgress();
    const questionsPersisted = await updateQuestionsCacheAtomic((current) => {
      if (!targetIsCurrent()) return current || {};
      // Mid-load merges may have seen these rows already; this merge, after any stale copies are dropped, decides.
      const merged = workerHydration.mergeWorkerQuestionResponses(
        current,
        rows,
        sessionSlug,
        run.identity,
        staleRefIds,
        new Set(rows.map((row) => row.storageRefId).filter(Boolean)),
      );
      // A capped listing is a settled snapshot, not a complete history. Reports
      // may display its new rows while missing-answer checks still remain unready.
      const worker = merged.worker as CacheRecord;
      worker.workerResponseHydrationStatus = partial ? 'partial' : 'complete';
      // Unlike the status, this outlasts the next run's loading, so a report that
      // can't be shown can say the session holds more than one load reads.
      worker.workerResponseOverReadLimit = partial;
      delete worker.workerResponseLoadProgress;
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
  } catch (error) {
    await stopProgress();
    // Stopped here because it was stale: not a failure, and the load that replaced it reports for itself.
    if (stale.signal.aborted) return;
    // Say the load failed, so Results offer a retry instead of spinning; what was merged stays shown.
    if (!shouldStop()) {
      const marked = await updateQuestionsCacheAtomic((current) => {
        if (!targetIsCurrent()) return current || {};
        const next = workerHydration.mergeWorkerQuestionResponses(current, [], sessionSlug, run.identity);
        const worker = next.worker as CacheRecord;
        worker.workerResponseHydrationStatus = 'failed';
        delete worker.workerResponseLoadProgress;
        return next;
      }).catch(() => false);
      if (marked) markProgress?.();
    }
    throw error;
  } finally {
    // A load that stopped early (a newer reader or session) merges nothing more.
    finished = true;
    if (progressTimer) clearTimeout(progressTimer);
  }
};

type OwnWorkerResponseOptions = Pick<
  WorkerResponseHydrationOptions,
  | 'sessionSlug'
  | 'sessionConfig'
  | 'run'
  | 'loadWorkerResponses'
  | 'getAccount'
  | 'getProviderLike'
  | 'getCurrentSessionConfig'
  | 'shouldAbort'
  | 'updateQuestionsCacheAtomic'
  | 'updateUserCacheAtomic'
>;

// The saved-answers pass needs only the reader's own answers, so it lists those
// (mine=true, read in bulk) instead of every answer again. Its rows merge in and
// drop nothing, leaving completeness to the full listing. Resolves to false when
// the own listing could not be used, such as on a Worker older than it.
export const hydrateOwnWorkerResponses = async ({
  sessionSlug,
  sessionConfig,
  run,
  loadWorkerResponses,
  getAccount,
  getProviderLike,
  getCurrentSessionConfig,
  shouldAbort,
  updateQuestionsCacheAtomic,
  updateUserCacheAtomic,
}: OwnWorkerResponseOptions): Promise<boolean> => {
  const targetIsCurrent = (): boolean =>
    !shouldAbort() &&
    workerCanonicalSessionTargetMatches({
      expected: run.identity,
      sessionConfig: getCurrentSessionConfig(),
      sessionSlug,
      reader: getAccount(),
    });
  const workerHydration = await import('./workerResponseHydration.js');
  const loadRows = loadWorkerResponses || workerHydration.loadWorkerResponses;
  let rows: WorkerCanonicalResponseRow[];
  try {
    rows = await loadRows({
      account: getAccount(),
      providerLike: getProviderLike(),
      sessionSlug,
      sessionConfig,
      ownResponses: true,
    });
  } catch {
    return false;
  }
  if (!targetIsCurrent()) return true;
  await updateQuestionsCacheAtomic((current) =>
    targetIsCurrent()
      ? workerHydration.mergeWorkerQuestionResponses(current, rows, sessionSlug, run.identity)
      : current || {},
  );
  await updateUserCacheAtomic((current) =>
    targetIsCurrent() ? workerHydration.mergeWorkerUserResponses(current, rows, run.identity) : current || {},
  );
  return true;
};
