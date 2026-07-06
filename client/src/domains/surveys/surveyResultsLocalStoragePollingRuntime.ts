export type SurveyResultsPollingTimerHandle = ReturnType<typeof setTimeout>;

export type SurveyResultsPollingTimerPort = {
  setTimeout: (callback: () => void, delayMs: number) => SurveyResultsPollingTimerHandle;
  clearTimeout: (handle: SurveyResultsPollingTimerHandle) => void;
};

export type SurveyResultsLocalStoragePollingRuntimeOptions = {
  minDelayMs: number;
  midDelayMs: number;
  maxDelayMs: number;
  isOpen: () => boolean;
  isDocumentHidden: () => boolean;
  isMounted: () => boolean;
  pollLocalStorageForUpdates: () => boolean;
  onResetWithReason?: (reason: string) => void;
  timers?: SurveyResultsPollingTimerPort;
};

export type SurveyResultsLocalStoragePollingRuntime = {
  destroy: () => void;
  getDelayMs: () => number;
  getStableCycles: () => number;
  hasScheduledPoll: () => boolean;
  resetBackoff: (reason?: unknown) => void;
  start: () => void;
  stop: () => void;
  updateBackoff: (didObserveChange: unknown) => void;
};

const normalizeDelayMs = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const readDefaultTimers = (): SurveyResultsPollingTimerPort => ({
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (handle) => clearTimeout(handle),
});

export const createSurveyResultsLocalStoragePollingRuntime = ({
  minDelayMs,
  midDelayMs,
  maxDelayMs,
  isOpen,
  isDocumentHidden,
  isMounted,
  pollLocalStorageForUpdates,
  onResetWithReason,
  timers = readDefaultTimers(),
}: SurveyResultsLocalStoragePollingRuntimeOptions): SurveyResultsLocalStoragePollingRuntime => {
  const minDelay = normalizeDelayMs(minDelayMs, 1);
  const midDelay = normalizeDelayMs(midDelayMs, minDelay);
  const maxDelay = normalizeDelayMs(maxDelayMs, midDelay);
  let scheduledPoll: SurveyResultsPollingTimerHandle | null = null;
  let delayMs = minDelay;
  let stableCycles = 0;

  const resetBackoff = (reason: unknown = ''): void => {
    stableCycles = 0;
    delayMs = minDelay;
    const normalizedReason = String(reason || '');
    if (normalizedReason && typeof onResetWithReason === 'function') {
      onResetWithReason(normalizedReason);
    }
  };

  const updateBackoff = (didObserveChange: unknown): void => {
    if (didObserveChange) {
      resetBackoff();
      return;
    }
    stableCycles += 1;
    if (stableCycles <= 0) {
      delayMs = minDelay;
      return;
    }
    if (stableCycles === 1) {
      delayMs = midDelay;
      return;
    }
    delayMs = maxDelay;
  };

  const stop = (): void => {
    if (scheduledPoll == null) return;
    timers.clearTimeout(scheduledPoll);
    scheduledPoll = null;
  };

  const start = (): void => {
    if (!isOpen()) return;
    if (isDocumentHidden()) return;
    if (scheduledPoll != null) return;
    scheduledPoll = timers.setTimeout(() => {
      scheduledPoll = null;
      if (!isMounted()) return;
      if (isDocumentHidden()) return;
      const didObserveChange = pollLocalStorageForUpdates();
      updateBackoff(!!didObserveChange);
      start();
    }, delayMs);
  };

  const destroy = (): void => {
    stop();
  };

  return {
    destroy,
    getDelayMs: () => delayMs,
    getStableCycles: () => stableCycles,
    hasScheduledPoll: () => scheduledPoll != null,
    resetBackoff,
    start,
    stop,
    updateBackoff,
  };
};
