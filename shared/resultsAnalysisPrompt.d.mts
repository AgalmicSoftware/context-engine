export type ResultsAnalysisSectionKey = 'breakdown' | 'argumentMap' | 'riskMatrix' | 'atlas';
export const RESULTS_ANALYSIS_SECTION_KEYS: readonly ResultsAnalysisSectionKey[];
export function buildResultsAnalysisPrompt(options?: {
  sections?: readonly string[];
  input?: unknown;
  exposure?: unknown;
  contextText?: string;
}): string;
