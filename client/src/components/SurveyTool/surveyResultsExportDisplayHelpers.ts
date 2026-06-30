import {
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsAnalysisEligibility,
  type SessionResultsAnalysisPayloadBuildResult,
  type SessionResultsExportFormat,
  type SessionResultsGeneratedAnalysisArtifact,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import {
  buildSurveyResultsAlertMessagePatch,
} from './surveyResultsHelpers';
import type { ReactNode } from 'react';

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

export type SurveyResultsHtmlReportDownloadStatePatch = {
  alertMessage?: string;
  htmlReportAnalysisArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  htmlReportAnalysisError?: string;
  htmlReportAnalysisInputSignature?: string;
  htmlReportAnalysisProgress?: string;
  htmlReportDemoMode?: boolean;
  htmlReportExportedAt?: string;
  htmlReportExportFormat?: SessionResultsExportFormat;
  htmlReportModalOpen?: boolean;
  htmlReportSelectedSections?: Required<SessionResultsSectionSelection>;
};

export type SurveyResultsHtmlReportDownloadAttemptPlan =
  | {
    blockedReason: '';
    statePatch: null;
    status: 'ready';
  }
  | {
    blockedReason:
      | 'not-authorized'
      | 'no-exportable-sections'
      | 'analysis-generating'
      | 'unavailable-selected-sections';
    statePatch: SurveyResultsHtmlReportDownloadStatePatch;
    status: 'blocked';
  };

export type SurveyResultsHtmlReportAnalysisPayload =
  Partial<SessionResultsAnalysisPayloadBuildResult> &
  Record<string, unknown> & {
    eligibility?: Partial<SessionResultsAnalysisEligibility>;
    inputSignature?: unknown;
  };

export type SurveyResultsHtmlReportReadinessPlanInput = {
  analysisGenerating?: unknown;
  isAuthorized?: unknown;
  selectedSections?: SessionResultsSectionSelection | null;
  snapshot: SessionResultsHtmlSnapshot;
};

export type SurveyResultsHtmlReportExportModalDescriptorInput = {
  analysisGenerating?: unknown;
  analysisPayload?: SurveyResultsHtmlReportAnalysisPayload;
  analysisProgress?: unknown;
  exportFormat?: SessionResultsExportFormat | null;
  htmlReportAnalysisError?: ReactNode;
  isAuthorized?: unknown;
  isDemoMode?: unknown;
  isDemoSession?: unknown;
  isOpen?: unknown;
  selectedSections?: SessionResultsSectionSelection | null;
  snapshot: SessionResultsHtmlSnapshot;
};

export type SurveyResultsHtmlReportExportModalDescriptor = {
  analysisGenerating: boolean;
  analysisPayload: SurveyResultsHtmlReportAnalysisPayload;
  analysisProgress: string;
  canDownload: boolean;
  exportFormat: SessionResultsExportFormat;
  htmlReportAnalysisError: ReactNode;
  isAuthorized: boolean;
  isDemoMode: boolean;
  isDemoSession: boolean;
  isOpen: boolean;
  needsAnalysisGeneration: boolean;
  sectionRows: SurveyResultsHtmlReportSectionRow[];
  selectedSections: Required<SessionResultsSectionSelection>;
  snapshot: SessionResultsHtmlSnapshot;
};

export const SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS: Required<SessionResultsSectionSelection> = Object.freeze({
  argumentMap: false,
  atlas: false,
  report: true,
  riskMatrix: false,
  snapshotJson: true,
});

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

const normalizeSurveyResultsHtmlReportSelectedSections = (
  selectedSections: SessionResultsSectionSelection | null | undefined
): Required<SessionResultsSectionSelection> => ({
  ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS,
  ...(selectedSections || {}),
});

export const buildSurveyResultsHtmlReportModalOpenPatch = (
  exportedAt: unknown
) => ({
  htmlReportModalOpen: true,
  htmlReportExportedAt: String(exportedAt || ''),
  htmlReportAnalysisError: '',
  alertMessage: '',
});

export const buildSurveyResultsHtmlReportModalClosePatch = () => ({
  htmlReportModalOpen: false,
});

export const buildSurveyResultsHtmlReportSectionTogglePatch = ({
  currentSections = {},
  sectionKey,
}: {
  currentSections?: SessionResultsSectionSelection | null;
  sectionKey?: SurveyResultsHtmlReportSectionKey | string;
} = {}) => {
  const normalizedSections = normalizeSurveyResultsHtmlReportSelectedSections(currentSections);
  const key = String(sectionKey || '') as SurveyResultsHtmlReportSectionKey;
  if (!(key in normalizedSections)) {
    return {
      htmlReportSelectedSections: normalizedSections,
    };
  }
  return {
    htmlReportSelectedSections: {
      ...normalizedSections,
      [key]: !normalizedSections[key],
    },
  };
};

export const buildSurveyResultsHtmlReportDemoModePatch = ({
  currentArtifact = null,
  demoArtifact = null,
  nextDemoMode = false,
}: {
  currentArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  demoArtifact?: SessionResultsGeneratedAnalysisArtifact | null;
  nextDemoMode?: unknown;
} = {}) => {
  const enabled = !!nextDemoMode;
  return {
    htmlReportDemoMode: enabled,
    htmlReportAnalysisArtifact: enabled
      ? demoArtifact
      : currentArtifact?.model === 'demo-preview'
        ? null
        : currentArtifact,
    htmlReportAnalysisError: '',
    htmlReportSelectedSections: enabled
      ? {
        argumentMap: true,
        atlas: true,
        report: true,
        riskMatrix: true,
        snapshotJson: true,
      }
      : { ...SURVEY_RESULTS_HTML_REPORT_DEFAULT_SELECTED_SECTIONS },
  };
};

export const buildSurveyResultsHtmlReportFormatPatch = (
  format: SessionResultsExportFormat
) => ({
  htmlReportExportFormat: format,
});

export const buildSurveyResultsHtmlReportAnalysisDemoReadyPatch = (
  artifact: SessionResultsGeneratedAnalysisArtifact
) => ({
  htmlReportAnalysisArtifact: artifact,
  htmlReportAnalysisError: '',
});

export const buildSurveyResultsHtmlReportAnalysisErrorPatch = (
  htmlReportAnalysisError: unknown
) => ({
  htmlReportAnalysisError: String(htmlReportAnalysisError || ''),
});

export const buildSurveyResultsHtmlReportAnalysisEligibilityBlockedPatch = ({
  inputSignature = '',
  reason = '',
}: {
  inputSignature?: unknown;
  reason?: unknown;
} = {}) => ({
  htmlReportAnalysisError: String(reason || ''),
  htmlReportAnalysisInputSignature: String(inputSignature || ''),
});

export const buildSurveyResultsHtmlReportAnalysisProgressPatch = (
  htmlReportAnalysisProgress: unknown
) => ({
  htmlReportAnalysisProgress: String(htmlReportAnalysisProgress || ''),
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

export const buildSurveyResultsHtmlReportExportModalDescriptor = ({
  analysisGenerating = false,
  analysisPayload = {},
  analysisProgress = '',
  exportFormat = SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  htmlReportAnalysisError = '',
  isAuthorized = false,
  isDemoMode = false,
  isDemoSession = false,
  isOpen = false,
  selectedSections,
  snapshot,
}: SurveyResultsHtmlReportExportModalDescriptorInput): SurveyResultsHtmlReportExportModalDescriptor => {
  const generating = !!analysisGenerating;
  const authorized = !!isAuthorized;
  const readinessPlan = buildSurveyResultsHtmlReportReadinessPlan({
    analysisGenerating: generating,
    isAuthorized: authorized,
    selectedSections,
    snapshot,
  });

  return {
    analysisGenerating: generating,
    analysisPayload,
    analysisProgress: String(analysisProgress || ''),
    canDownload: readinessPlan.canDownload,
    exportFormat: exportFormat || SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
    htmlReportAnalysisError,
    isAuthorized: authorized,
    isDemoMode: !!isDemoMode,
    isDemoSession: !!isDemoSession,
    isOpen: !!isOpen,
    needsAnalysisGeneration: readinessPlan.needsAnalysisGeneration,
    sectionRows: readinessPlan.sectionRows,
    selectedSections: readinessPlan.selectedSections,
    snapshot,
  };
};

export const buildSurveyResultsHtmlReportDownloadAttemptPlan = ({
  analysisGenerating = false,
  isAuthorized = false,
  readinessPlan,
}: {
  analysisGenerating?: unknown;
  isAuthorized?: boolean;
  readinessPlan: Pick<
    SurveyResultsHtmlReportReadinessPlan,
    'hasExportableSections' | 'hasUnavailableSelectedSections'
  >;
}): SurveyResultsHtmlReportDownloadAttemptPlan => {
  if (!isAuthorized) {
    return {
      blockedReason: 'not-authorized',
      statePatch: buildSurveyResultsAlertMessagePatch('Connect a wallet with permission to view these results before export.'),
      status: 'blocked',
    };
  }
  if (!readinessPlan.hasExportableSections) {
    return {
      blockedReason: 'no-exportable-sections',
      statePatch: buildSurveyResultsAlertMessagePatch('Select at least one available report section before export.'),
      status: 'blocked',
    };
  }
  if (analysisGenerating) {
    return {
      blockedReason: 'analysis-generating',
      statePatch: buildSurveyResultsAlertMessagePatch('Wait for analysis generation to finish before downloading the report.'),
      status: 'blocked',
    };
  }
  if (readinessPlan.hasUnavailableSelectedSections) {
    return {
      blockedReason: 'unavailable-selected-sections',
      statePatch: buildSurveyResultsAlertMessagePatch('Generate selected analysis views before downloading the report.'),
      status: 'blocked',
    };
  }

  return {
    blockedReason: '',
    statePatch: null,
    status: 'ready',
  };
};

export const buildSurveyResultsHtmlReportDownloadSuccessPatch = (): SurveyResultsHtmlReportDownloadStatePatch => ({
  alertMessage: '',
  htmlReportModalOpen: false,
});

export const buildSurveyResultsHtmlReportDownloadFailurePatch = (): SurveyResultsHtmlReportDownloadStatePatch => (
  buildSurveyResultsAlertMessagePatch('Unable to export the HTML report.')
);
