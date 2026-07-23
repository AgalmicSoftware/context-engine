import type { WorkerCanonicalMetadataHydrationPort } from '../../domains/surveys/workerCanonicalMetadataHydrationPort';
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
  const module = await import('../../domains/surveys/workerCanonicalMetadataHydrationPort');
  const loader =
    host.workerCanonicalMetadataHydrationPort?.loadQuestions ||
    module.workerCanonicalMetadataHydrationPort.loadQuestions;
  const rows = await loader({ ...resolveHydrationContext(host), sessionConfig, sessionSlug });
  return {
    count: rows.length,
    identity,
    merge: (current) => module.mergeWorkerCanonicalQuestionMetadata(current, rows, identity),
  };
};

const loadWorkerCanonicalSurveyMetadata = async (
  { host, sessionConfig, sessionSlug }: WorkerMetadataHydrationOptions,
  identity: WorkerCanonicalCacheIdentity,
): Promise<WorkerMetadataMergeResult> => {
  const module = await import('../../domains/surveys/workerCanonicalMetadataHydrationPort');
  const loader =
    host.workerCanonicalMetadataHydrationPort?.loadSurveys || module.workerCanonicalMetadataHydrationPort.loadSurveys;
  const rows = await loader({ ...resolveHydrationContext(host), sessionConfig, sessionSlug });
  return {
    count: rows.length,
    identity,
    merge: (current) => module.mergeWorkerCanonicalSurveyMetadata(current, rows, identity),
  };
};

const workerMetadataTargetIsCurrent = (
  options: WorkerMetadataHydrationOptions,
  expected: WorkerCanonicalCacheIdentity,
): boolean =>
  workerCanonicalSessionTargetMatches({
    expected,
    sessionConfig: readWorkerMetadataSessionConfig(options.host, options.sessionSlug),
    sessionSlug: options.sessionSlug,
  });

const prepareWorkerCanonicalQuestionCache = async (
  options: WorkerMetadataHydrationOptions,
): Promise<WorkerMetadataCachePreparation> => {
  const identity = resolveWorkerCanonicalCacheIdentity(options);
  const module = await import('../../domains/surveys/workerCanonicalMetadataHydrationPort');
  return {
    identity,
    merge: (current) => module.mergeWorkerCanonicalQuestionMetadata(current, [], identity),
  };
};

const prepareWorkerCanonicalSurveyCache = async (
  options: WorkerMetadataHydrationOptions,
): Promise<WorkerMetadataCachePreparation> => {
  const identity = resolveWorkerCanonicalCacheIdentity(options);
  const module = await import('../../domains/surveys/workerCanonicalMetadataHydrationPort');
  return {
    identity,
    merge: (current) => module.mergeWorkerCanonicalSurveyMetadata(current, [], identity),
  };
};

const hydrateWorkerCanonicalCache = async (
  prepare: (options: WorkerMetadataHydrationOptions) => Promise<WorkerMetadataCachePreparation>,
  load: (
    options: WorkerMetadataHydrationOptions,
    identity: WorkerCanonicalCacheIdentity,
  ) => Promise<WorkerMetadataMergeResult>,
  options: WorkerCacheHydrationOptions,
): Promise<void> => {
  try {
    const prepared = await prepare(options);
    if (!workerMetadataTargetIsCurrent(options, prepared.identity)) return;
    const initialized = await options.persist((current) =>
      workerMetadataTargetIsCurrent(options, prepared.identity) ? prepared.merge(current) : current,
    );
    if (!initialized) throw options.createPersistenceError();
    if (!workerMetadataTargetIsCurrent(options, prepared.identity)) return;
    const metadata = await load(options, prepared.identity);
    if (!workerMetadataTargetIsCurrent(options, metadata.identity)) return;
    const persisted = await options.persist((current) =>
      workerMetadataTargetIsCurrent(options, metadata.identity) ? metadata.merge(current) : current,
    );
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
