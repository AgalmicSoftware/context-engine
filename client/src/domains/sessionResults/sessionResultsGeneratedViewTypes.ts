export const SESSION_GENERATED_RESULTS_VIEW_KEYS = Object.freeze({
  ATLAS: 'atlas',
  BREAKDOWN: 'breakdown',
  CIRCLES: 'circles',
  RISK_MATRIX: 'riskMatrix',
} as const);

export type SessionGeneratedResultsViewKey =
  (typeof SESSION_GENERATED_RESULTS_VIEW_KEYS)[keyof typeof SESSION_GENERATED_RESULTS_VIEW_KEYS];
