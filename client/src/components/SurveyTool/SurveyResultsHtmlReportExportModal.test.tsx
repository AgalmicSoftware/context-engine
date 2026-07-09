import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  buildSurveyResultsHtmlReportDownloadLabel,
  buildSurveyResultsHtmlReportExportModalDisplayPlan,
  renderSurveyResultsHtmlReportExportModal,
} from './SurveyResultsHtmlReportExportModal';
import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
} from '../../utilities/sessionResultsExport';

const styleMap = {
  htmlReportCancelButton: 'htmlReportCancelButton',
  htmlReportDownloadButton: 'htmlReportDownloadButton',
  htmlReportGenerateButton: 'htmlReportGenerateButton',
  htmlReportInfo: 'htmlReportInfo',
  htmlReportModal: 'htmlReportModal',
  htmlReportModalBody: 'htmlReportModalBody',
  htmlReportModalFooter: 'htmlReportModalFooter',
  htmlReportModalHeader: 'htmlReportModalHeader',
  htmlReportOptionGroup: 'htmlReportOptionGroup',
  htmlReportOptionRow: 'htmlReportOptionRow',
  htmlReportSectionTable: 'htmlReportSectionTable',
  htmlReportWarning: 'htmlReportWarning',
};

const baseProps = {
  analysisGenerating: false,
  analysisPayload: {
    eligibility: {
      counts: {
        participants: 2,
        questions: 3,
        responses: 4,
      },
      eligible: true,
      reasons: [],
    },
  },
  analysisProgress: '',
  canDownload: true,
  exportFormat: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
  htmlReportAnalysisError: '',
  isAuthorized: true,
  isDemoMode: false,
  isDemoSession: true,
  isOpen: true,
  needsAnalysisGeneration: false,
  onClose: jest.fn(),
  onDownload: jest.fn(),
  onFormatChange: jest.fn(),
  onGenerateAnalysis: jest.fn(),
  onToggleDemoMode: jest.fn(),
  onToggleSection: jest.fn(),
  sectionRows: [
    {
      available: true,
      key: 'report',
      label: 'Report',
      reason: 'Ready',
    },
    {
      available: false,
      key: 'argumentMap',
      label: 'Argument Map',
      reason: 'No report yet',
    },
  ],
  selectedSections: {
    argumentMap: false,
    report: true,
  },
  snapshot: {
    exportedAt: '2026-05-25T18:30:00.000Z',
    exportedBy: {
      displayAddress: '0xabc...def',
    },
    session: {
      name: 'Demo Session',
      slug: 'demo',
    },
  },
  styleMap,
};

describe('SurveyResultsHtmlReportExportModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders exact export labels, section availability, and enabled handlers', () => {
    render(renderSurveyResultsHtmlReportExportModal(baseProps));

    expect(screen.getByTestId('ce-surveyresults-html-report-modal')).toBeInTheDocument();
    expect(screen.getByText('Exported viewer')).toBeInTheDocument();
    expect(screen.getByText('Single HTML file')).toBeInTheDocument();
    expect(screen.getByText('PDF report')).toBeInTheDocument();
    expect(screen.getByText('Demo Session')).toBeInTheDocument();
    expect(screen.getByText('(demo)')).toBeInTheDocument();
    expect(screen.getByText('0xabc...def')).toBeInTheDocument();
    expect(screen.getByText(/4\s+responses,\s+2\s+participants,\s+3\s+questions\./)).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('No report yet')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Include Argument Map'));
    fireEvent.click(screen.getByLabelText(/PDF report/));
    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-demo-mode'));
    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-generate-analysis'));
    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-download'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(baseProps.onToggleSection).toHaveBeenCalledWith('argumentMap');
    expect(baseProps.onFormatChange).toHaveBeenCalledWith(SESSION_RESULTS_EXPORT_FORMAT_PDF);
    expect(baseProps.onToggleDemoMode).toHaveBeenCalledTimes(1);
    expect(baseProps.onGenerateAnalysis).toHaveBeenCalledTimes(1);
    expect(baseProps.onDownload).toHaveBeenCalledTimes(1);
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('shows fallback copy and disables unavailable actions', () => {
    render(
      renderSurveyResultsHtmlReportExportModal({
        ...baseProps,
        analysisGenerating: true,
        analysisProgress: '',
        analysisPayload: {
          eligibility: {
            counts: {
              participants: 0,
              questions: 0,
              responses: 0,
            },
            eligible: false,
            reasons: ['Need at least one response.'],
          },
        },
        canDownload: false,
        exportFormat: SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
        htmlReportAnalysisError: 'Analysis failed.',
        isAuthorized: false,
        isDemoMode: false,
        isDemoSession: false,
        needsAnalysisGeneration: true,
        snapshot: {
          exportedAt: '2026-05-25T18:30:00.000Z',
          session: {},
        },
      }),
    );

    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByText('Connect a wallet to download authenticated exports.')).toBeInTheDocument();
    expect(screen.getByText('Need at least one response.')).toBeInTheDocument();
    expect(screen.getByText('Analysis failed.')).toBeInTheDocument();
    expect(screen.getByText('Selected analysis sections need generated data before download.')).toBeInTheDocument();
    expect(screen.getByText('Connect a wallet to enable download.')).toBeInTheDocument();

    expect(screen.getByTestId('ce-surveyresults-html-report-generate-analysis')).toBeDisabled();
    expect(screen.getByTestId('ce-surveyresults-html-report-generate-analysis')).toHaveTextContent(
      'Generating Analysis Views...',
    );
    expect(screen.getByTestId('ce-surveyresults-html-report-download')).toBeDisabled();
    expect(screen.getByTestId('ce-surveyresults-html-report-download')).toHaveTextContent('Download Single HTML');
    expect(screen.queryByTestId('ce-surveyresults-html-report-demo-mode')).toBeNull();

    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-generate-analysis'));
    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-download'));

    expect(baseProps.onGenerateAnalysis).not.toHaveBeenCalled();
    expect(baseProps.onDownload).not.toHaveBeenCalled();
  });

  it('builds download labels for every export format', () => {
    expect(buildSurveyResultsHtmlReportDownloadLabel(SESSION_RESULTS_EXPORT_FORMAT_VIEWER)).toBe(
      'Download HTML Viewer',
    );
    expect(buildSurveyResultsHtmlReportDownloadLabel(SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML)).toBe(
      'Download Single HTML',
    );
    expect(buildSurveyResultsHtmlReportDownloadLabel(SESSION_RESULTS_EXPORT_FORMAT_PDF)).toBe('Download PDF');
  });

  it('builds action labels and inert display decisions without invoking handlers', () => {
    expect(buildSurveyResultsHtmlReportExportModalDisplayPlan(baseProps)).toEqual(
      expect.objectContaining({
        canGenerateAnalysis: true,
        downloadBlockedMessage: 'Select only available sections, or generate selected analysis views before download.',
        downloadLabel: 'Download HTML Viewer',
        exporterLabel: '0xabc...def',
        generateAnalysisLabel: 'Generate Analysis Views',
        sessionLabel: 'Demo Session',
        sessionSlugLabel: ' (demo)',
      }),
    );

    expect(
      buildSurveyResultsHtmlReportExportModalDisplayPlan({
        ...baseProps,
        analysisGenerating: true,
        analysisProgress: '',
        exportFormat: SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
        isAuthorized: false,
        snapshot: {
          exportedAt: '2026-05-25T18:30:00.000Z',
          session: {},
        },
      }),
    ).toEqual(
      expect.objectContaining({
        canGenerateAnalysis: false,
        downloadBlockedMessage: 'Connect a wallet to enable download.',
        downloadLabel: 'Download Single HTML',
        exporterLabel: 'Not connected',
        generateAnalysisLabel: 'Generating Analysis Views...',
        sessionLabel: 'Session',
        sessionSlugLabel: '',
      }),
    );

    expect(
      buildSurveyResultsHtmlReportExportModalDisplayPlan({
        ...baseProps,
        isDemoMode: true,
      }),
    ).toEqual(
      expect.objectContaining({
        canGenerateAnalysis: true,
        generateAnalysisLabel: 'Refresh Demo Analysis',
      }),
    );
  });
});
