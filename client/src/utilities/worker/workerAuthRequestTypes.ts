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
  // Says whether a signed-out reply that is not itself a refusal was refused for
  // want of a sign-in, such as a batch whose items carry their own statuses.
  anonymousRefused?: (response: Response) => Promise<boolean>;
  fallbackOnGateUnavailable?: boolean;
  preferAnonymous?: boolean;
  // false: never ask the person to unlock their wallet, for requests the page makes by itself.
  prompt?: boolean;
  // Sends only as this address, failing if another account is signed in.
  requireAccount?: string;
  retry?: boolean;
};
