export type SurveyResultsAnimationFramePort = {
  cancelAnimationFrame: (handle: number) => void;
  requestAnimationFrame: (callback: () => void) => number;
};

export type SurveyResultsQueuedRefreshRuntimeOptions = {
  isMounted: () => boolean;
  isOpen: () => boolean;
  requestFetchResponses: () => void;
  scheduleMicrotask: (callback: () => void) => void;
  shouldUseAnimationFrame: () => boolean;
  animationFrame?: SurveyResultsAnimationFramePort;
  measureFlush?: (label: string, callback: () => void) => void;
};

export type SurveyResultsQueuedRefreshRuntime = {
  destroy: () => void;
  flush: () => void;
  getQueuedReasons: () => string[];
  hasPendingFrame: () => boolean;
  isMicrotaskScheduled: () => boolean;
  queue: (reason?: unknown) => void;
};

const readDefaultAnimationFrame = (): SurveyResultsAnimationFramePort => ({
  cancelAnimationFrame: (handle) => {
    if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(handle);
    }
  },
  requestAnimationFrame: (callback) => {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(callback);
    }
    callback();
    return 0;
  },
});

const defaultMeasureFlush = (_label: string, callback: () => void): void => {
  callback();
};

export const createSurveyResultsQueuedRefreshRuntime = ({
  isMounted,
  isOpen,
  requestFetchResponses,
  scheduleMicrotask,
  shouldUseAnimationFrame,
  animationFrame = readDefaultAnimationFrame(),
  measureFlush = defaultMeasureFlush,
}: SurveyResultsQueuedRefreshRuntimeOptions): SurveyResultsQueuedRefreshRuntime => {
  const queuedReasons = new Set<string>();
  let microtaskScheduled = false;
  let frameRequestId: number | null = null;

  const flush = (): void => {
    if (!isMounted()) return;
    if (queuedReasons.size === 0) return;
    if (!isOpen()) {
      queuedReasons.clear();
      return;
    }
    queuedReasons.clear();
    measureFlush('ce.surveyResults.flushQueuedResultsRefresh', () => {
      requestFetchResponses();
    });
  };

  const queue = (reason: unknown = 'unknown'): void => {
    if (!isMounted()) return;
    if (reason) {
      queuedReasons.add(String(reason));
    }
    if (microtaskScheduled) return;
    microtaskScheduled = true;

    scheduleMicrotask(() => {
      microtaskScheduled = false;
      if (!isMounted()) return;
      if (frameRequestId != null) return;

      const runFlush = () => {
        frameRequestId = null;
        flush();
      };

      if (shouldUseAnimationFrame()) {
        frameRequestId = animationFrame.requestAnimationFrame(runFlush);
        return;
      }

      runFlush();
    });
  };

  const destroy = (): void => {
    microtaskScheduled = false;
    queuedReasons.clear();
    if (frameRequestId != null) {
      animationFrame.cancelAnimationFrame(frameRequestId);
    }
    frameRequestId = null;
  };

  return {
    destroy,
    flush,
    getQueuedReasons: () => Array.from(queuedReasons),
    hasPendingFrame: () => frameRequestId != null,
    isMicrotaskScheduled: () => microtaskScheduled,
    queue,
  };
};
