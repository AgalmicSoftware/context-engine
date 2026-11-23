// An allocation that casts no votes is no answer. Clearing a quadratic answer leaves one, every vote at 0, so the
// site reads it as blank wherever it counts or shows answers, as it reads a cleared binary ("") or multiple choice
// ([]) answer. The Worker's results analysis reads allocations on its own, in resultsAnalysisAnswerValidation.js.
export const isBlankQuadraticAllocation = (value: unknown): boolean =>
  Array.isArray(value) && value.every((vote) => vote === 0);
