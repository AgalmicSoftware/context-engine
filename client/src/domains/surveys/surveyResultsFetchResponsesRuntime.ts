export type SurveyResultsFetchResponsesRuntimeOptions = {
  fetchResponses: () => Promise<void> | void;
  isMounted: () => boolean;
  scheduleRequestMicrotask?: (callback: () => void) => void;
};

export type SurveyResultsFetchResponsesRuntimeSnapshot = {
  inFlight: boolean;
  queued: boolean;
  requestScheduled: boolean;
};

export type SurveyResultsFetchResponsesRuntime = {
  destroy: () => void;
  flush: () => Promise<void>;
  getSnapshot: () => SurveyResultsFetchResponsesRuntimeSnapshot;
  request: () => void;
};

const schedulePromiseMicrotask = (callback: () => void): void => {
  Promise.resolve().then(callback);
};

export const createSurveyResultsFetchResponsesRuntime = ({
  fetchResponses,
  isMounted,
  scheduleRequestMicrotask = schedulePromiseMicrotask,
}: SurveyResultsFetchResponsesRuntimeOptions): SurveyResultsFetchResponsesRuntime => {
  let inFlight = false;
  let queued = false;
  let requestScheduled = false;

  const flush = async (): Promise<void> => {
    if (!isMounted() || inFlight) return;
    inFlight = true;
    try {
      await fetchResponses();
    } finally {
      inFlight = false;
      if (queued) {
        queued = false;
        if (isMounted()) {
          void flush();
        }
      }
    }
  };

  const request = (): void => {
    if (!isMounted()) return;
    if (requestScheduled) return;
    requestScheduled = true;
    scheduleRequestMicrotask(() => {
      requestScheduled = false;
      if (!isMounted()) return;
      if (inFlight) {
        queued = true;
        return;
      }
      void flush();
    });
  };

  const destroy = (): void => {
    queued = false;
    inFlight = false;
    requestScheduled = false;
  };

  return {
    destroy,
    flush,
    getSnapshot: () => ({
      inFlight,
      queued,
      requestScheduled,
    }),
    request,
  };
};
