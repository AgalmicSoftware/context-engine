export type ResolveWorkerTokenRequestContextOptions = {
  allowDemoFallback?: boolean;
  context?: unknown;
  resolvedAddress?: unknown;
  resolveWorkerUrl?: boolean;
  sessionConfig?: unknown;
  sessionSlug?: unknown;
  workerUrl?: unknown;
};

export type WorkerFetchAuthOptions = ResolveWorkerTokenRequestContextOptions & {
  anonymousOnly?: boolean;
  fallbackOnGateUnavailable?: boolean;
  preferAnonymous?: boolean;
  // false: never ask the person to unlock their wallet, for requests the page makes by itself.
  prompt?: boolean;
  retry?: boolean;
};
