import {
  hydrateWorkerCanonicalQuestionCache,
  hydrateWorkerCanonicalSurveyCache,
  readWorkerMetadataSessionConfig,
  shouldHydrateWorkerCanonicalMetadata,
  type WorkerMetadataHydrationHost,
} from './workerCanonicalCacheHydration';
import {
  buildWorkerCanonicalCacheRunKey,
  resolveWorkerCanonicalCacheIdentity,
  type WorkerCanonicalCacheIdentity,
} from './workerCanonicalCacheIdentity';

export type WorkerMetadataHydrationTarget = {
  identity: WorkerCanonicalCacheIdentity | null;
  isWorkerCanonical: boolean;
  runKey: string;
  sessionConfig: Record<string, unknown> | null;
};

type WorkerMetadataAtomicHost<Cache> = WorkerMetadataHydrationHost & {
  updateQuestionsCacheAtomic?: (
    slug: string,
    updater: (current: Cache | null) => Cache | Promise<Cache>,
  ) => Promise<boolean>;
  updateSurveysCacheAtomic?: (
    slug: string,
    updater: (current: Cache | null) => Cache | Promise<Cache>,
  ) => Promise<boolean>;
};

type HydrateSessionWorkerMetadataOptions<Cache> = {
  createPersistenceError: () => Error;
  host: WorkerMetadataAtomicHost<Cache>;
  onError?: (error: unknown) => void;
  onSuccess: (count: number) => void;
  sessionSlug: string;
  target: WorkerMetadataHydrationTarget;
};

export const resolveWorkerMetadataHydrationTarget = (
  host: WorkerMetadataHydrationHost,
  sessionSlug: string,
): WorkerMetadataHydrationTarget => {
  const sessionConfig = readWorkerMetadataSessionConfig(host, sessionSlug);
  const isWorkerCanonical = shouldHydrateWorkerCanonicalMetadata(sessionConfig);
  const identity = isWorkerCanonical ? resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug }) : null;
  return {
    identity,
    isWorkerCanonical,
    runKey: identity ? buildWorkerCanonicalCacheRunKey(identity) : sessionSlug,
    sessionConfig,
  };
};

export const isWorkerMetadataHydrationInFlight = (
  inFlight: Record<string, Promise<void> | undefined> | null | undefined,
  host: WorkerMetadataHydrationHost,
  sessionSlug: string,
): boolean => {
  try {
    return !!inFlight?.[resolveWorkerMetadataHydrationTarget(host, sessionSlug).runKey];
  } catch {
    return false;
  }
};

export const hydrateSessionWorkerQuestionCache = <Cache>({
  createPersistenceError,
  host,
  onError,
  onSuccess,
  sessionSlug,
  target,
}: HydrateSessionWorkerMetadataOptions<Cache>): Promise<void> =>
  hydrateWorkerCanonicalQuestionCache({
    host,
    sessionConfig: target.sessionConfig,
    sessionSlug,
    persist: (merge) => host.updateQuestionsCacheAtomic!(sessionSlug, (current) => merge(current) as Cache),
    createPersistenceError,
    onError,
    onSuccess,
  });

export const hydrateSessionWorkerSurveyCache = <Cache>({
  createPersistenceError,
  host,
  onError,
  onSuccess,
  sessionSlug,
  target,
}: HydrateSessionWorkerMetadataOptions<Cache>): Promise<void> =>
  hydrateWorkerCanonicalSurveyCache({
    host,
    sessionConfig: target.sessionConfig,
    sessionSlug,
    persist: (merge) => host.updateSurveysCacheAtomic!(sessionSlug, (current) => merge(current) as Cache),
    createPersistenceError,
    onError,
    onSuccess,
  });
