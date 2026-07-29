type RevisionState = {
  questionResponsesNonce?: unknown;
  [key: string]: unknown;
};

type RevisionOptions = {
  checkAllCachesReady?: boolean;
  needsQuestionResponsesNonce?: boolean;
};

export const createSessionCacheRevisionUpdater =
  <State extends RevisionState, Options extends RevisionOptions>({
    checkAllCachesReady,
    host,
    setState,
  }: {
    checkAllCachesReady: () => void;
    host: { queueLocalRevisionUpdate?: (options: Options) => void };
    setState: (updater: State | ((prev: State) => State | null) | null, cb?: () => void) => void;
  }) =>
  (options: Options): void => {
    if (typeof host.queueLocalRevisionUpdate === 'function') {
      host.queueLocalRevisionUpdate(options);
      return;
    }
    const shouldBumpNonce = !!options.needsQuestionResponsesNonce;
    const shouldCheckReady = !!options.checkAllCachesReady;
    if (!shouldBumpNonce && !shouldCheckReady) return;
    setState(
      (prev) => {
        const next = {} as State;
        if (shouldBumpNonce) {
          next.questionResponsesNonce = Number(prev.questionResponsesNonce || 0) + 1;
        }
        return Object.keys(next).length ? next : null;
      },
      () => {
        if (shouldCheckReady) checkAllCachesReady();
      },
    );
  };
