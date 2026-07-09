import React from 'react';
import { Alert, FormGroup, Input, Label, Modal, ModalBody, ModalHeader } from 'reactstrap';

import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsExportFormat,
  type SessionResultsHtmlSnapshot,
  type SessionResultsSectionSelection,
} from '../../utilities/sessionResultsExport';
import { renderSurveyResultsHtmlReportActionControls } from './SurveyResultsHtmlReportActionControls';
import SurveyResultsHtmlReportAnalysisControls from './SurveyResultsHtmlReportAnalysisControls';
import SurveyResultsHtmlReportSectionTable, {
  type SurveyResultsHtmlReportSectionRow,
} from './SurveyResultsHtmlReportSectionTable';
import type { SurveyResultsHtmlReportAnalysisPayload } from './surveyResultsHtmlReportModalDescriptor';
import type { SurveyResultsHtmlReportSectionKey } from './surveyResultsHtmlReportReadiness';

export type SurveyResultsHtmlReportExportModalDisplayProps = {
  analysisGenerating?: boolean;
  analysisPayload: SurveyResultsHtmlReportAnalysisPayload;
  analysisProgress?: string;
  canDownload?: boolean;
  exportFormat?: SessionResultsExportFormat;
  htmlReportAnalysisError?: React.ReactNode;
  isAuthorized?: boolean;
  isDemoMode?: boolean;
  isDemoSession?: boolean;
  isOpen?: boolean;
  needsAnalysisGeneration?: boolean;
  sectionRows: SurveyResultsHtmlReportSectionRow[];
  selectedSections: SessionResultsSectionSelection;
  snapshot: SessionResultsHtmlSnapshot;
  styleMap: Record<string, string>;
};

export type SurveyResultsHtmlReportExecutionProps = {
  onClose: () => void;
  onDownload: () => void;
  onFormatChange: (format: SessionResultsExportFormat) => void;
  onGenerateAnalysis: () => void;
  onToggleDemoMode: () => void;
  onToggleSection: (key: SurveyResultsHtmlReportSectionKey) => void;
};

export type SurveyResultsHtmlReportExportModalProps = SurveyResultsHtmlReportExportModalDisplayProps &
  SurveyResultsHtmlReportExecutionProps;

export const HTML_REPORT_EXPORT_FORMATS: readonly {
  description: string;
  label: string;
  value: SessionResultsExportFormat;
}[] = Object.freeze([
  {
    description: 'Interactive local HTML',
    label: 'Exported viewer',
    value: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  },
  {
    description: 'Static local HTML',
    label: 'Single HTML file',
    value: SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  },
  {
    description: 'Multi-page PDF report',
    label: 'PDF report',
    value: SESSION_RESULTS_EXPORT_FORMAT_PDF,
  },
]);

export const buildSurveyResultsHtmlReportDownloadLabel = (
  exportFormat: SessionResultsExportFormat = SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
): string => {
  if (exportFormat === SESSION_RESULTS_EXPORT_FORMAT_PDF) return 'Download PDF';
  if (exportFormat === SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML) return 'Download Single HTML';
  return 'Download HTML Viewer';
};

export type SurveyResultsHtmlReportExportModalDisplayPlanInput = {
  analysisGenerating?: boolean;
  analysisPayload?: SurveyResultsHtmlReportAnalysisPayload;
  analysisProgress?: string;
  exportFormat?: SessionResultsExportFormat;
  isAuthorized?: boolean;
  isDemoMode?: boolean;
  snapshot?: Partial<SessionResultsHtmlSnapshot>;
};

export type SurveyResultsHtmlReportExportModalDisplayPlan = {
  canGenerateAnalysis: boolean;
  downloadBlockedMessage: string;
  downloadLabel: string;
  exporterLabel: string;
  generateAnalysisLabel: string;
  sessionLabel: string;
  sessionSlugLabel: string;
};

export const buildSurveyResultsHtmlReportExportModalDisplayPlan = ({
  analysisGenerating = false,
  analysisPayload = {},
  analysisProgress = '',
  exportFormat = SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  isAuthorized = false,
  isDemoMode = false,
  snapshot = {},
}: SurveyResultsHtmlReportExportModalDisplayPlanInput = {}): SurveyResultsHtmlReportExportModalDisplayPlan => {
  const sessionSlug = snapshot?.session?.slug;

  return {
    canGenerateAnalysis:
      (isAuthorized || isDemoMode) && !!analysisPayload?.eligibility?.eligible && !analysisGenerating,
    downloadBlockedMessage: isAuthorized
      ? 'Select only available sections, or generate selected analysis views before download.'
      : 'Connect a wallet to enable download.',
    downloadLabel: buildSurveyResultsHtmlReportDownloadLabel(exportFormat),
    exporterLabel: snapshot?.exportedBy?.displayAddress || 'Not connected',
    generateAnalysisLabel: analysisGenerating
      ? analysisProgress || 'Generating Analysis Views...'
      : isDemoMode
        ? 'Refresh Demo Analysis'
        : 'Generate Analysis Views',
    sessionLabel: snapshot?.session?.name || snapshot?.session?.slug || 'Session',
    sessionSlugLabel: sessionSlug ? ` (${sessionSlug})` : '',
  };
};

export const renderSurveyResultsHtmlReportExportModal = ({
  analysisGenerating = false,
  analysisPayload,
  analysisProgress = '',
  canDownload = false,
  exportFormat = SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  htmlReportAnalysisError = '',
  isAuthorized = false,
  isDemoMode = false,
  isDemoSession = false,
  isOpen = false,
  needsAnalysisGeneration = false,
  onClose,
  onDownload,
  onFormatChange,
  onGenerateAnalysis,
  onToggleDemoMode,
  onToggleSection,
  sectionRows,
  selectedSections,
  snapshot,
  styleMap,
}: SurveyResultsHtmlReportExportModalProps): React.ReactNode => {
  const {
    canGenerateAnalysis,
    downloadBlockedMessage,
    downloadLabel,
    exporterLabel,
    generateAnalysisLabel,
    sessionLabel,
    sessionSlugLabel,
  } = buildSurveyResultsHtmlReportExportModalDisplayPlan({
    analysisGenerating,
    analysisPayload,
    analysisProgress,
    exportFormat,
    isAuthorized,
    isDemoMode,
    snapshot,
  });

  return (
    <Modal
      isOpen={!!isOpen}
      toggle={onClose}
      className={styleMap.htmlReportModal}
      data-testid="ce-surveyresults-html-report-modal"
    >
      <ModalHeader toggle={onClose} className={styleMap.htmlReportModalHeader}>
        Export HTML Report
      </ModalHeader>
      <ModalBody className={styleMap.htmlReportModalBody}>
        <p>
          <strong>{sessionLabel}</strong>
          {sessionSlugLabel}
        </p>
        <p>
          Export timestamp: <strong>{snapshot?.exportedAt}</strong>
        </p>
        <p>
          Privacy mode: <strong>Redacted</strong>
        </p>
        <p>
          Downloaded by: <strong>{exporterLabel}</strong>
        </p>
        {!isAuthorized && (
          <Alert color="info" fade={false} className={styleMap.htmlReportInfo}>
            Connect a wallet to download authenticated exports.
          </Alert>
        )}
        <div className={styleMap.htmlReportOptionGroup}>
          <h6>Export format</h6>
          {HTML_REPORT_EXPORT_FORMATS.map((formatOption) => (
            <FormGroup check key={formatOption.value} className={styleMap.htmlReportOptionRow}>
              <Input
                id={`html-report-format-${formatOption.value}`}
                type="radio"
                checked={exportFormat === formatOption.value}
                onChange={() => onFormatChange(formatOption.value)}
              />
              <Label check for={`html-report-format-${formatOption.value}`}>
                <strong>{formatOption.label}</strong>
                <small>{formatOption.description}</small>
              </Label>
            </FormGroup>
          ))}
        </div>
        {isDemoSession && (
          <div className={styleMap.htmlReportOptionGroup}>
            <FormGroup check className={styleMap.htmlReportOptionRow}>
              <Input
                id="html-report-demo-mode"
                type="checkbox"
                checked={isDemoMode}
                onChange={onToggleDemoMode}
                data-testid="ce-surveyresults-html-report-demo-mode"
              />
              <Label check for="html-report-demo-mode">
                <strong>Demo preview mode</strong>
                <small>Use local demo analysis sections without AI or wallet auth.</small>
              </Label>
            </FormGroup>
          </div>
        )}
        <SurveyResultsHtmlReportSectionTable
          onToggleSection={onToggleSection}
          sectionRows={sectionRows}
          selectedSections={selectedSections}
          styleMap={styleMap}
        />
        <SurveyResultsHtmlReportAnalysisControls
          analysisPayload={analysisPayload}
          canGenerateAnalysis={canGenerateAnalysis}
          generateAnalysisLabel={generateAnalysisLabel}
          htmlReportAnalysisError={htmlReportAnalysisError}
          onGenerateAnalysis={onGenerateAnalysis}
          styleMap={styleMap}
        />
        {needsAnalysisGeneration && (
          <Alert color="info" fade={false} className={styleMap.htmlReportInfo}>
            Selected analysis sections need generated data before download.
          </Alert>
        )}
        <Alert color="warning" fade={false} className={styleMap.htmlReportWarning}>
          Redacted exports omit raw response records, wallet addresses, encrypted payloads, and gated values by default.
        </Alert>
        {!canDownload && (
          <Alert color="info" fade={false} className={styleMap.htmlReportInfo}>
            {downloadBlockedMessage}
          </Alert>
        )}
      </ModalBody>
      {renderSurveyResultsHtmlReportActionControls({
        canDownload,
        downloadLabel,
        onClose,
        onDownload,
        styleMap,
      })}
    </Modal>
  );
};
