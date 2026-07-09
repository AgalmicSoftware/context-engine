import type { ReactNode } from 'react';

import type {
  SessionResultsAnalysisPayloadBuildResult,
  SessionResultsExportFormat,
  SessionResultsHtmlSnapshot,
  SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import type { SurveyResultsHtmlReportExportModalProps } from './SurveyResultsHtmlReportExportModal';
import { buildSurveyResultsHtmlReportExportModalDescriptor } from './surveyResultsHtmlReportModalDescriptor';

export type SurveyResultsHtmlReportModalPropsInput = Pick<
  SurveyResultsHtmlReportExportModalProps,
  | 'onClose'
  | 'onDownload'
  | 'onFormatChange'
  | 'onGenerateAnalysis'
  | 'onToggleDemoMode'
  | 'onToggleSection'
  | 'styleMap'
> & {
  analysisGenerating?: unknown;
  analysisPayload?: SessionResultsAnalysisPayloadBuildResult | Record<string, unknown>;
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

export const buildSurveyResultsHtmlReportModalProps = ({
  analysisGenerating = false,
  analysisPayload = {},
  analysisProgress = '',
  exportFormat = null,
  htmlReportAnalysisError = '',
  isAuthorized = false,
  isDemoMode = false,
  isDemoSession = false,
  isOpen = false,
  onClose,
  onDownload,
  onFormatChange,
  onGenerateAnalysis,
  onToggleDemoMode,
  onToggleSection,
  selectedSections,
  snapshot,
  styleMap,
}: SurveyResultsHtmlReportModalPropsInput): SurveyResultsHtmlReportExportModalProps => ({
  ...buildSurveyResultsHtmlReportExportModalDescriptor({
    analysisGenerating,
    analysisPayload,
    analysisProgress,
    exportFormat,
    htmlReportAnalysisError,
    isAuthorized,
    isDemoMode,
    isDemoSession,
    isOpen,
    selectedSections,
    snapshot,
  }),
  onClose,
  onDownload,
  onFormatChange,
  onGenerateAnalysis,
  onToggleDemoMode,
  onToggleSection,
  styleMap,
});
