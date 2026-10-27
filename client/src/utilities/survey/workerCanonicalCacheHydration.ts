import {
  mergeWorkerCanonicalQuestionMetadata,
  mergeWorkerCanonicalSurveyMetadata,
  workerCanonicalMetadataHydrationPort,
  type WorkerCanonicalMetadataHydrationPort,
} from '../../domains/surveys/workerCanonicalMetadataHydrationPort';
import { resolveSessionCapabilityProjection } from '../session/sessionCapabilityProjection';
import {
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalSessionTargetMatches,
  type WorkerCanonicalCacheIdentity,
} from './workerCanonicalCacheIdentity';

export type WorkerMetadataHydrationHost = {
  getAccount?: () => string | null | undefined;
  getProviderLike?: () => unknown;
  getProvider?: () => unknown;
  getSessionCfg?: (slug: string) => Record<string, unknown> | null | undefined;
  provider?: unknown;
  workerCanonicalMetadataHydrationPort?: Partial<WorkerCanonicalMetadataHydrationPort>;
};

type WorkerMetadataHydrationOptions = {
  host: WorkerMetadataHydrationHost;
  sessionConfig: unknown;
  sessionSlug: string;
};

type WorkerMetadataMergeResult = {
  count: number;
  identity: WorkerCanonicalCacheIdentity;
  merge: (current: unknown) => unknown;
};

type WorkerMetadataCachePreparation = {
  identity: WorkerCanonicalCacheIdentity;
  merge: WorkerMetadataMergeResult['merge'];
};

type WorkerCacheHydrationOptions = WorkerMetadataHydrationOptions & {
  createPersistenceError: () => Error;
  onError?: (error: unknown) => void;
  onSuccess: (count: number) => void;
  persist: (merge: WorkerMetadataMergeResult['merge']) => Promise<boolean>;
};

const resolveHydrationContext = (host: WorkerMetadataHydrationHost) => ({
  account: typeof host.getAccount === 'function' ? host.getAccount() : '',
  providerLike:
    typeof host.getProviderLike === 'function'
      ? host.getProviderLike()
      : typeof host.getProvider === 'function'
        ? host.getProvider()
        : host.provider || '',
});

export const shouldHydrateWorkerCanonicalMetadata = (sessionConfig: unknown): boolean => {
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  return projection.profileValid && projection.isWorkerCanonical;
};

export const readWorkerMetadataSessionConfig = (
  host: WorkerMetadataHydrationHost,
  slug: string,
): Record<string, unknown> | null =>
  typeof host.getSessionCfg === 'function' ? host.getSessionCfg(slug) || null : null;

const loadWorkerCanonicalQuestionMetadata = async (
  { host, sessionConfig, sessionSlug }: WorkerMetadataHydrationOptions,
  identity: WorkerCanonicalCacheIdentity,
): Promise<WorkerMetadataMergeResult> => {
  const loader =
    host.workerCanonicalMetadataHydrationPort?.loadQuestions || workerCanonicalMetadataHydrationPort.loadQuestions;
  const rows = await loader({ ...resolveHydrationContext(host), sessionConfig, sessionSlug });
  return {
    count: rows.length,
    identity,
    merge: (current) => mergeWorkerCanonicalQuestionMetadata(current, rows, identity),
  };
};

const loadWorkerCanonicalSurveyMetadata = async (
  { host, sessionConfig, sessionSlug }: WorkerMetadataHydrationOptions,
  identity: WorkerCanonicalCacheIdentity,
): Promise<WorkerMetadataMergeResult> => {
  const loader =
    host.workerCanonicalMetadataHydrationPort?.loadSurveys || workerCanonicalMetadataHydrationPort.loadSurveys;
  const rows = await loader({ ...resolveHydrationContext(host), sessionConfig, sessionSlug });
  return {
    count: rows.length,
    identity,
    merge: (current) => mergeWorkerCanonicalSurveyMetadata(current, rows, identity),
  };
};

// Listings are authorized as the host account, so their rows belong to that reader.
const workerMetadataTargetIsCurrent = (
  options: WorkerMetadataHydrationOptions,
  expected: WorkerCanonicalCacheIdentity,
): boolean =>
  workerCanonicalSessionTargetMatches({
    expected,
    sessionConfig: readWorkerMetadataSessionConfig(options.host, options.sessionSlug),
    sessionSlug: options.sessionSlug,
    reader: resolveHydrationContext(options.host).account,
  });

export const resolveWorkerMetadataCacheIdentity = (options: WorkerMetadataHydrationOptions) =>
  resolveWorkerCanonicalCacheIdentity({ ...options, reader: resolveHydrationContext(options.host).account });

const prepareWorkerCanonicalQuestionCache = (
  options: WorkerMetadataHydrationOptions,
): WorkerMetadataCachePreparation => {
  const identity = resolveWorkerMetadataCacheIdentity(options);
  return { identity, merge: (current) => mergeWorkerCanonicalQuestionMetadata(current, [], identity) };
};

const prepareWorkerCanonicalSurveyCache = (options: WorkerMetadataHydrationOptions): WorkerMetadataCachePreparation => {
  const identity = resolveWorkerMetadataCacheIdentity(options);
  return { identity, merge: (current) => mergeWorkerCanonicalSurveyMetadata(current, [], identity) };
};

const hydrateWorkerCanonicalCache = async (
  prepare: (options: WorkerMetadataHydrationOptions) => WorkerMetadataCachePreparation,
  load: (
    options: WorkerMetadataHydrationOptions,
    identity: WorkerCanonicalCacheIdentity,
  ) => Promise<WorkerMetadataMergeResult>,
  options: WorkerCacheHydrationOptions,
): Promise<void> => {
  try {
    const prepared = prepare(options);
    if (!workerMetadataTargetIsCurrent(options, prepared.identity)) return;
    const initialized = await options.persist((current) => {
      if (!workerMetadataTargetIsCurrent(options, prepared.identity)) return current;
      const merged = prepared.merge(current) as Record<string, Record<string, unknown>>;
      merged.worker.workerMetadataHydrationStatus = 'loading';
      return merged;
    });
    if (!initialized) throw options.createPersistenceError();
    if (!workerMetadataTargetIsCurrent(options, prepared.identity)) return;
    const metadata = await load(options, prepared.identity);
    if (!workerMetadataTargetIsCurrent(options, metadata.identity)) return;
    const persisted = await options.persist((current) => {
      if (!workerMetadataTargetIsCurrent(options, metadata.identity)) return current;
      const merged = metadata.merge(current) as Record<string, Record<string, unknown>>;
      // An empty initialized map is not a completed empty catalog. Keep that
      // distinction in the exact Worker cache for Stats after switching sessions.
      merged.worker.workerMetadataHydrationStatus = 'complete';
      return merged;
    });
    if (!persisted) throw options.createPersistenceError();
    if (!workerMetadataTargetIsCurrent(options, metadata.identity)) return;
    options.onSuccess(metadata.count);
  } catch (error: unknown) {
    options.onError?.(error);
    throw error;
  }
};

export const hydrateWorkerCanonicalQuestionCache = (options: WorkerCacheHydrationOptions): Promise<void> =>
  hydrateWorkerCanonicalCache(prepareWorkerCanonicalQuestionCache, loadWorkerCanonicalQuestionMetadata, options);

export const hydrateWorkerCanonicalSurveyCache = (options: WorkerCacheHydrationOptions): Promise<void> =>
  hydrateWorkerCanonicalCache(prepareWorkerCanonicalSurveyCache, loadWorkerCanonicalSurveyMetadata, options);
