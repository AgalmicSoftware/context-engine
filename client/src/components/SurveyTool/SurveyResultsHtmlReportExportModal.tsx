import React from 'react';
import {
  Alert,
  Button,
  FormGroup,
  Input,
  Label,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
} from 'reactstrap';

import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  type SessionResultsExportFormat,
} from '../../utilities/sessionResultsExport';

type SurveyResultsRecord = Record<string, any>;

type SurveyResultsHtmlReportSectionRow = {
  available: boolean;
  key: string;
  label: string;
  reason?: React.ReactNode;
};

type SurveyResultsHtmlReportExportModalProps = {
  analysisGenerating?: boolean;
  analysisPayload: SurveyResultsRecord;
  analysisProgress?: string;
  canDownload?: boolean;
  exportFormat?: SessionResultsExportFormat;
  htmlReportAnalysisError?: React.ReactNode;
  isAuthorized?: boolean;
  isDemoMode?: boolean;
  isDemoSession?: boolean;
  isOpen?: boolean;
  needsAnalysisGeneration?: boolean;
  onClose: () => void;
  onDownload: () => void;
  onFormatChange: (format: SessionResultsExportFormat) => void;
  onGenerateAnalysis: () => void;
  onToggleDemoMode: () => void;
  onToggleSection: (key: any) => void;
  sectionRows: SurveyResultsHtmlReportSectionRow[];
  selectedSections: Record<string, unknown>;
  snapshot: SurveyResultsRecord;
  styleMap: Record<string, string>;
};

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
  exportFormat: SessionResultsExportFormat = SESSION_RESULTS_EXPORT_FORMAT_VIEWER
): string => {
  if (exportFormat === SESSION_RESULTS_EXPORT_FORMAT_PDF) return 'Download PDF';
  if (exportFormat === SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML) return 'Download Single HTML';
  return 'Download HTML Viewer';
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
  const canGenerateAnalysis =
    (isAuthorized || isDemoMode) &&
    !!analysisPayload?.eligibility?.eligible &&
    !analysisGenerating;
  const sessionLabel = snapshot?.session?.name || snapshot?.session?.slug || 'Session';
  const exporterLabel = snapshot?.exportedBy?.displayAddress || 'Not connected';
  const downloadLabel = buildSurveyResultsHtmlReportDownloadLabel(exportFormat);

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
          {snapshot?.session?.slug ? ` (${snapshot.session.slug})` : ''}
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
        <Table size="sm" responsive className={styleMap.htmlReportSectionTable}>
          <thead>
            <tr>
              <th scope="col">Include</th>
              <th scope="col">Section</th>
              <th scope="col">Availability</th>
              <th scope="col">Why</th>
            </tr>
          </thead>
          <tbody>
            {sectionRows.map((row) => (
              <tr key={row.key}>
                <td>
                  <Input
                    aria-label={`Include ${row.label}`}
                    checked={!!selectedSections[row.key]}
                    type="checkbox"
                    onChange={() => onToggleSection(row.key)}
                  />
                </td>
                <td>{row.label}</td>
                <td>{row.available ? 'Available' : 'Unavailable'}</td>
                <td>{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        <div className={styleMap.htmlReportOptionGroup}>
          <h6>Analysis views</h6>
          <p>
            {analysisPayload?.eligibility?.counts?.responses} responses,
            {' '}{analysisPayload?.eligibility?.counts?.participants} participants,
            {' '}{analysisPayload?.eligibility?.counts?.questions} questions.
            {' '}AI mode uses synthetic participant IDs.
          </p>
          {analysisPayload?.eligibility?.reasons?.length > 0 && (
            <Alert color="info" fade={false} className={styleMap.htmlReportInfo}>
              {analysisPayload.eligibility.reasons.join(' ')}
            </Alert>
          )}
          {htmlReportAnalysisError && (
            <Alert color="warning" fade={false} className={styleMap.htmlReportWarning}>
              {htmlReportAnalysisError}
            </Alert>
          )}
          <Button
            type="button"
            color="secondary"
            onClick={onGenerateAnalysis}
            disabled={!canGenerateAnalysis}
            className={styleMap.htmlReportGenerateButton}
            data-testid="ce-surveyresults-html-report-generate-analysis"
          >
            {analysisGenerating
              ? analysisProgress || 'Generating Analysis Views...'
              : isDemoMode
                ? 'Refresh Demo Analysis'
                : 'Generate Analysis Views'}
          </Button>
        </div>
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
            {isAuthorized
              ? 'Select only available sections, or generate selected analysis views before download.'
              : 'Connect a wallet to enable download.'}
          </Alert>
        )}
      </ModalBody>
      <ModalFooter className={styleMap.htmlReportModalFooter}>
        <Button
          color="secondary"
          onClick={onClose}
          className={styleMap.htmlReportCancelButton}
        >
          Cancel
        </Button>
        <Button
          color="primary"
          onClick={onDownload}
          disabled={!canDownload}
          className={styleMap.htmlReportDownloadButton}
          data-testid="ce-surveyresults-html-report-download"
        >
          {downloadLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
