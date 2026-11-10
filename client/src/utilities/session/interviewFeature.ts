const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

// Voice interviews, and the AI prefill that uses them, are on unless either switch turns them off.
export const isInterviewFeatureEnabled = (sessionConfig: unknown): boolean => {
  const config = asRecord(sessionConfig);
  const interview = asRecord(config.interviewMode || config.interview);
  return config.interviewModeEnabled !== false && interview.enabled !== false;
};
