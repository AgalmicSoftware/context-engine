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
  markReady: () => void;
  updateQuestionsCacheAtomic: (updater: CacheUpdater) => Promise<boolean>;
  updateUserCacheAtomic: (updater: CacheUpdater) => Promise<boolean>;
  createPersistenceError: (message: string) => Error;
};

export const resolveWorkerResponseHydrationRun = ({
  sessionConfig,
  sessionSlug,
}: {
  sessionConfig: unknown;
  sessionSlug: string;
}): WorkerResponseHydrationRun | null => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  if (!projection.profileValid || !projection.isWorkerCanonical) return null;
  const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug });
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
  const targetIsCurrent = (): boolean =>
    workerCanonicalSessionTargetMatches({
      expected: run.identity,
      sessionConfig: getCurrentSessionConfig(),
      sessionSlug,
    });
  const shouldStop = (): boolean => shouldAbort() || !targetIsCurrent();

  markLoading();
  const workerHydration = await import('./workerResponseHydration.js');
  const loadRows = loadWorkerResponses || workerHydration.loadWorkerResponses;
  if (shouldStop()) return;

  const initializedQuestions = await updateQuestionsCacheAtomic((current) =>
    targetIsCurrent()
      ? workerHydration.mergeWorkerQuestionResponses(current, [], sessionSlug, run.identity)
      : current || {},
  );
  if (!initializedQuestions) {
    throw createPersistenceError(`Failed to initialize Worker questions cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  const initializedUsers = await updateUserCacheAtomic((current) =>
    targetIsCurrent() ? workerHydration.mergeWorkerUserResponses(current, [], run.identity) : current || {},
  );
  if (!initializedUsers) {
    throw createPersistenceError(`Failed to initialize Worker user cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  const rows = await loadRows({
    account: getAccount(),
    providerLike: getProviderLike(),
    sessionSlug,
    sessionConfig,
  });
  if (shouldStop()) return;

  const questionsPersisted = await updateQuestionsCacheAtomic((current) =>
    targetIsCurrent()
      ? workerHydration.mergeWorkerQuestionResponses(current, rows, sessionSlug, run.identity)
      : current || {},
  );
  if (!questionsPersisted) {
    throw createPersistenceError(`Failed to persist Worker questions cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  const usersPersisted = await updateUserCacheAtomic((current) =>
    targetIsCurrent() ? workerHydration.mergeWorkerUserResponses(current, rows, run.identity) : current || {},
  );
  if (!usersPersisted) {
    throw createPersistenceError(`Failed to persist Worker user cache for ${sessionSlug}`);
  }
  if (shouldStop()) return;

  markReady();
};
