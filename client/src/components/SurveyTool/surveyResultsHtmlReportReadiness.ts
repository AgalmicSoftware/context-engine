import type {
  SessionResultsHtmlSnapshot,
  SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import {
  normalizeSurveyResultsHtmlReportSelectedSections,
} from './surveyResultsHtmlReportSelection';

export type SurveyResultsHtmlReportSectionAvailability = {
  argumentMap: boolean;
  atlas: boolean;
  report: boolean;
  riskMatrix: boolean;
  snapshotJson: boolean;
};

export type SurveyResultsHtmlReportSectionKey = keyof SurveyResultsHtmlReportSectionAvailability;

export type SurveyResultsHtmlReportSectionRow = {
  available: boolean;
  key: SurveyResultsHtmlReportSectionKey;
  label: string;
  reason: string;
};

export type SurveyResultsHtmlReportReadinessPlan = {
  availability: SurveyResultsHtmlReportSectionAvailability;
  canDownload: boolean;
  hasExportableSections: boolean;
  hasUnavailableSelectedSections: boolean;
  needsAnalysisGeneration: boolean;
  sectionRows: SurveyResultsHtmlReportSectionRow[];
  selectedSections: Required<SessionResultsSectionSelection>;
};

export type SurveyResultsHtmlReportReadinessPlanInput = {
  analysisGenerating?: unknown;
  isAuthorized?: unknown;
  selectedSections?: SessionResultsSectionSelection | null;
  snapshot: SessionResultsHtmlSnapshot;
};

export const SURVEY_RESULTS_HTML_REPORT_ANALYSIS_SECTION_KEYS: readonly SurveyResultsHtmlReportSectionKey[] = Object.freeze([
  'argumentMap',
  'riskMatrix',
  'atlas',
]);

const HTML_REPORT_SECTION_LABELS: Record<SurveyResultsHtmlReportSectionKey, string> = Object.freeze({
  argumentMap: 'Argument Map',
  atlas: 'Atlas Nodes',
  report: 'Report',
  riskMatrix: 'Risk Matrix',
  snapshotJson: 'Embedded Snapshot JSON',
});

const buildSurveyResultsHtmlReportSectionAvailability = (
  snapshot: SessionResultsHtmlSnapshot
): SurveyResultsHtmlReportSectionAvailability => ({
  report: !!snapshot.sections.report.available,
  argumentMap: !!snapshot.sections.argumentMap.available,
  riskMatrix: !!snapshot.sections.riskMatrix.available,
  atlas: !!snapshot.sections.atlas.available,
  snapshotJson: true,
});

const getSurveyResultsHtmlReportSectionReason = ({
  availability,
  key,
}: {
  availability: SurveyResultsHtmlReportSectionAvailability;
  key: SurveyResultsHtmlReportSectionKey;
}): string => {
  if (availability[key]) return key === 'snapshotJson' ? 'Always available' : 'Ready';
  if (key === 'report') return 'No hydrated results';
  return 'Needs analysis';
};

export const buildSurveyResultsHtmlReportReadinessPlan = ({
  analysisGenerating = false,
  isAuthorized = false,
  selectedSections,
  snapshot,
}: SurveyResultsHtmlReportReadinessPlanInput): SurveyResultsHtmlReportReadinessPlan => {
  const normalizedSelectedSections = normalizeSurveyResultsHtmlReportSelectedSections(selectedSections);
  const availability = buildSurveyResultsHtmlReportSectionAvailability(snapshot);
  const sectionRows: SurveyResultsHtmlReportSectionRow[] = ([
    'report',
    'argumentMap',
    'riskMatrix',
    'atlas',
    'snapshotJson',
  ] as SurveyResultsHtmlReportSectionKey[]).map((key) => ({
    available: availability[key],
    key,
    label: HTML_REPORT_SECTION_LABELS[key],
    reason: getSurveyResultsHtmlReportSectionReason({ availability, key }),
  }));
  const hasExportableSections = (
    (normalizedSelectedSections.report && availability.report) ||
    (normalizedSelectedSections.argumentMap && availability.argumentMap) ||
    (normalizedSelectedSections.riskMatrix && availability.riskMatrix) ||
    (normalizedSelectedSections.atlas && availability.atlas) ||
    normalizedSelectedSections.snapshotJson
  );
  const hasUnavailableSelectedSections = (
    (normalizedSelectedSections.report && !availability.report) ||
    (normalizedSelectedSections.argumentMap && !availability.argumentMap) ||
    (normalizedSelectedSections.riskMatrix && !availability.riskMatrix) ||
    (normalizedSelectedSections.atlas && !availability.atlas)
  );
  const needsAnalysisGeneration = SURVEY_RESULTS_HTML_REPORT_ANALYSIS_SECTION_KEYS.some(
    (key) => normalizedSelectedSections[key] && !availability[key]
  );

  return {
    availability,
    canDownload: !!isAuthorized &&
      hasExportableSections &&
      !hasUnavailableSelectedSections &&
      !analysisGenerating,
    hasExportableSections,
    hasUnavailableSelectedSections,
    needsAnalysisGeneration,
    sectionRows,
    selectedSections: normalizedSelectedSections,
  };
};
