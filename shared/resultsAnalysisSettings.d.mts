export type ResultsAnalysisGenerationMode = "manual" | "automatic" | "both";
export type ResultsAnalysisViewKey = "circles" | "breakdown" | "riskMatrix";
export type ResultsAnalysisAutoAfterUnit = "distinctParticipants";
export type ResultsAnalysisInputScope = "submitted";
export type ResultsAnalysisPublication = "latest_success_visible";
export type ResultsAnalysisSectionKey =
  "breakdown" | "riskMatrix" | "argumentMap" | "atlas";

export type ResultsAnalysisSettings = {
  version: 1;
  generationMode: ResultsAnalysisGenerationMode;
  views: Record<ResultsAnalysisViewKey, boolean>;
  autoAfter: {
    threshold: number;
    unit: ResultsAnalysisAutoAfterUnit;
  };
  inputScope: ResultsAnalysisInputScope;
  publication: ResultsAnalysisPublication;
};

export const RESULTS_ANALYSIS_GENERATION_MODES: readonly ResultsAnalysisGenerationMode[];
export const RESULTS_ANALYSIS_VIEW_KEYS: readonly ResultsAnalysisViewKey[];
export const RESULTS_ANALYSIS_AUTO_AFTER_UNITS: readonly ResultsAnalysisAutoAfterUnit[];
export const RESULTS_ANALYSIS_INPUT_SCOPES: readonly ResultsAnalysisInputScope[];
export const RESULTS_ANALYSIS_PUBLICATIONS: readonly ResultsAnalysisPublication[];
export const RESULTS_ANALYSIS_THRESHOLD_MIN: number;
export const RESULTS_ANALYSIS_THRESHOLD_MAX: number;
export const DEFAULT_RESULTS_ANALYSIS_SETTINGS: Readonly<ResultsAnalysisSettings>;
export function validateResultsAnalysisSettings(
  value?: unknown,
):
  | { ok: true; settings: ResultsAnalysisSettings }
  | { ok: false; path: string; error: string };
export function normalizeResultsAnalysisSettings(
  value?: unknown,
): ResultsAnalysisSettings;
export function validResultsAnalysisSettings(value?: unknown): boolean;
export function resolveResultsAnalysisSectionKeys(
  settings?: unknown,
): ResultsAnalysisSectionKey[];
