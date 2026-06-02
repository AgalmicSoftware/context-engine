export type SurveyResultsQueuedRefreshControllerPorts = {
  queueResultsRefresh?: (reason: string) => unknown;
};

export type SurveyResultsQueuedRefreshControllerArgs = {
  ports?: SurveyResultsQueuedRefreshControllerPorts;
  reasons?: Iterable<unknown> | unknown;
};

export type SurveyResultsQueuedRefreshControllerResult = {
  dispatched: boolean;
  reason: string;
  reasons: string[];
};

const normalizeRefreshReasons = (reasons: Iterable<unknown> | unknown): string[] => {
  if (!reasons) return [];
  if (typeof reasons === 'string') {
    return reasons ? [reasons] : [];
  }
  if (typeof (reasons as Iterable<unknown>)?.[Symbol.iterator] !== 'function') return [];
  return Array.from(reasons as Iterable<unknown>)
    .map((reason) => String(reason || ''))
    .filter(Boolean);
};

export const runSurveyResultsQueuedRefreshController = ({
  ports = {},
  reasons = [],
}: SurveyResultsQueuedRefreshControllerArgs = {}): SurveyResultsQueuedRefreshControllerResult => {
  const normalizedReasons = normalizeRefreshReasons(reasons);
  const reason = normalizedReasons.join('|');
  if (!reason || typeof ports.queueResultsRefresh !== 'function') {
    return {
      dispatched: false,
      reason,
      reasons: normalizedReasons,
    };
  }

  ports.queueResultsRefresh(reason);
  return {
    dispatched: true,
    reason,
    reasons: normalizedReasons,
  };
};
