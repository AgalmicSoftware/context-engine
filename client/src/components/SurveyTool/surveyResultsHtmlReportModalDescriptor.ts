import type { ReactNode } from 'react';

import {
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsAnalysisEligibility,
  type SessionResultsAnalysisPayloadBuildResult,
  type SessionResultsExportFormat,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import { buildSurveyResultsHtmlReportReadinessPlan } from './surveyResultsHtmlReportReadiness';
import type { SurveyResultsHtmlReportSectionRow } from './surveyResultsHtmlReportReadiness';

export type SurveyResultsHtmlReportAnalysisPayload = Partial<SessionResultsAnalysisPayloadBuildResult> &
  Record<string, unknown> & {
    eligibility?: Partial<SessionResultsAnalysisEligibility>;
    inputSignature?: unknown;
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
