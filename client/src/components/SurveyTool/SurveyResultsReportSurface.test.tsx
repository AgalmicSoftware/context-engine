import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import {
  SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML,
  SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
} from '../../utilities/sessionResultsExport';
import SurveyResultsReportSurface from './SurveyResultsReportSurface';

const mockDemoSurface = jest.fn((props: any) => <div data-testid="mock-demo-surface">{String(props.viewKey)}</div>);

jest.mock('./SurveyResultsDemoSurface', () => ({
  __esModule: true,
  default: (props: any) => mockDemoSurface(props),
}));

const styleMap = {
  alertMessage: 'alertMessage',
  biggerIcon: 'biggerIcon',
  clickableQuestionId: 'clickableQuestionId',
  demoResultsSurface: 'demoResultsSurface',
  demoResultsViewButton: 'demoResultsViewButton',
  demoResultsViewButtonActive: 'demoResultsViewButtonActive',
  demoResultsViewNav: 'demoResultsViewNav',
  externalLink: 'externalLink',
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
  loadingContainer: 'loadingContainer',
  modalBody: 'modalBody',
  modalHeader: 'modalHeader',
  modalHeaderContent: 'modalHeaderContent',
  modalHeaderControls: 'modalHeaderControls',
  modalHeaderTitleBlock: 'modalHeaderTitleBlock',
  modalSubtitle: 'modalSubtitle',
  modalTitle: 'modalTitle',
  promptColumn: 'promptColumn',
  questionIdTable: 'questionIdTable',
  questionIdTableWrapper: 'questionIdTableWrapper',
  questionListCard: 'questionListCard',
  questionSummaries: 'questionSummaries',
  questionSummaryHeader: 'questionSummaryHeader',
  questionTitle: 'questionTitle',
  responseCard: 'responseCard',
  responseHeader: 'responseHeader',
  responseList: 'responseList',
  responderAddress: 'responderAddress',
  responderLink: 'responderLink',
  resultsModal: 'resultsModal',
  singleResponseCard: 'singleResponseCard',
  surveyDocUrlLink: 'surveyDocUrlLink',
  surveyDocUrls: 'surveyDocUrls',
  surveyIdLink: 'surveyIdLink',
  surveyIdMeta: 'surveyIdMeta',
  surveyResultsCollapse: 'surveyResultsCollapse',
  surveyResultsOverride: 'surveyResultsOverride',
  surveyViewModeToggle: 'surveyViewModeToggle',
  tableActionButton: 'tableActionButton',
  toggleKnob: 'toggleKnob',
  toggleLabel: 'toggleLabel',
  toggleSwitch: 'toggleSwitch',
};

const cacheReadinessDisplay = {
  areSummaryCountsHydrated: true,
  filterSummaryDisplay: {
    displayedTotalQuestionsCount: 2,
    displayedTotalResponsesCount: 4,
    normalizedFilteredQuestionsCount: 1,
    normalizedFilteredResponsesCount: 3,
    showFilteredCountSpinner: false,
  },
  questionListDisplay: {
    shouldRenderQuestionTable: false,
    showEmptyState: true,
  },
  readinessDescriptor: {
    areSummaryCountsHydrated: true,
    filterLoading: false,
    mode: 'survey',
    summaryCountsSource: 'survey-results',
  },
  syncStatusDisplay: {
    isSynced: true,
    isSyncingOrLoading: false,
    question: {
      color: 'success',
      label: 'Loaded',
      progress: 100,
      remainingBlocks: 0,
      showRemainingSpinner: false,
      showSpinner: false,
    },
    response: {
      color: 'success',
      label: 'Loaded',
      progress: 100,
      remainingBlocks: 0,
      showRemainingSpinner: false,
      showSpinner: false,
    },
    showLongSyncNotice: false,
    showQuickRefresh: false,
    syncStatusText: 'In Sync',
    viewMode: 'survey',
  },
};

const createProps = (overrides: Record<string, any> = {}) => {
  const onCloseResultsModal = jest.fn();
  const onCloseReportModal = jest.fn();
  const onDownloadHtmlReport = jest.fn();
  const onExportFormatChange = jest.fn();
  const onGenerateAnalysis = jest.fn();
  const onToggleReportDemoMode = jest.fn();
  const onToggleReportSection = jest.fn();
  const onSurveyViewModeToggle = jest.fn();
  const onSurveyViewModeKeyDown = jest.fn();

  const selectedSections = {
    report: true,
    snapshotJson: true,
  };

  return {
    callbacks: {
      onCloseReportModal,
      onCloseResultsModal,
      onDownloadHtmlReport,
      onExportFormatChange,
      onGenerateAnalysis,
      onSurveyViewModeKeyDown,
      onSurveyViewModeToggle,
      onToggleReportDemoMode,
      onToggleReportSection,
    },
    props: {
      displayPanelsProps: {
        account: '',
        activeQuestionToggles: {},
        activeToggles: {},
        alertMessage: 'Ready for review',
        applyDecryptedOverrideToResponse: jest.fn(({ response }) => response),
        cacheReadinessDisplay,
        currentSurveyId: 'survey-1',
        effectiveSlug: 'session-one',
        filterControlsNode: (
          <button type="button" data-testid="filter-display">
            Filters
          </button>
        ),
        filterLoading: false,
        getFallbackQuestion: jest.fn((questionId) => ({ id: questionId, prompt: 'Fallback', type: 'freeform' })),
        getLockedResponseKey: jest.fn(() => 'locked-key'),
        getResponseCardProps: jest.fn(() => ({
          bodyClassName: 'response-body',
          containerClassName: 'response-card',
        })),
        lockedResponsesBannerNode: <div data-testid="locked-banner">Locked banner</div>,
        network: { id: 11155420 },
        onSurveyViewModeKeyDown,
        onSurveyViewModeToggle,
        onToggleQuestionList: jest.fn(),
        onToggleResponse: jest.fn(),
        preNetworkQuestions: {},
        questionModeEntries: [],
        questionResponsesNonce: 1,
        questionsCacheNonce: 2,
        renderQuestionSummary: jest.fn((questionId) => <div>{questionId}</div>),
        renderQuestionTable: jest.fn(() => (
          <table>
            <tbody />
          </table>
        )),
        responses: [],
        sbtCacheRevision: 3,
        styleMap,
        surveyAggregateEntries: [['q1', [{ answer: 'Agree' }]]],
        surveyViewMode: 'aggregate',
        viewMode: 'survey',
      },
      htmlReportModalProps: {
        analysisGenerating: false,
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
        analysisProgress: '',
        canDownload: false,
        exportFormat: SESSION_RESULTS_EXPORT_FORMAT_VIEWER,
        htmlReportAnalysisError: '',
        isAuthorized: false,
        isDemoMode: false,
        isDemoSession: false,
        isOpen: true,
        needsAnalysisGeneration: true,
        onClose: onCloseReportModal,
        onDownload: onDownloadHtmlReport,
        onFormatChange: onExportFormatChange,
        onGenerateAnalysis,
        onToggleDemoMode: onToggleReportDemoMode,
        onToggleSection: onToggleReportSection,
        sectionRows: [
          {
            available: true,
            key: 'report',
            label: 'Report',
            reason: 'Ready',
          },
          {
            available: true,
            key: 'snapshotJson',
            label: 'Embedded Snapshot JSON',
            reason: 'Always available',
          },
        ],
        selectedSections,
        snapshot: {
          exportedAt: '2026-06-07T12:00:00.000Z',
          session: {
            name: 'Results Session',
            slug: 'results-session',
          },
        },
        styleMap,
      },
      isOpen: true,
      modalHeaderProps: {
        bookmarkedSurveyIDs: [],
        currentSurveyId: 'survey-1',
        demoResultsViewMode: 'raw',
        demoResultsViewOptions: [],
        effectiveSlug: 'session-one',
        isDemoQuestionResults: false,
        lockedResponsesToggleNode: <button type="button">Locked responses</button>,
        onDemoResultsViewSelect: jest.fn(),
        onToggleSurveyBookmark: jest.fn(),
        styleMap,
        surveyDocumentURLs: [],
        surveyIdAbbreviation: 'survey-1',
        surveyTitle: 'Results Session',
        syncStatusNode: <div data-testid="sync-status">In Sync</div>,
        viewMode: 'survey',
      },
      onCloseResultsModal,
      reportSurfaceDisplayPlan: {
        demoResultsViewMode: 'raw',
        isDemoAlternateResultsView: false,
      },
      styleMap,
      ...overrides,
    },
    selectedSections,
  };
};

describe('SurveyResultsReportSurface', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('composes the report display surface and keeps unavailable downloads inert', () => {
    const { callbacks, props, selectedSections } = createProps();
    render(<SurveyResultsReportSurface {...props} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Results Session' })).toBeInTheDocument();
    expect(screen.getByTestId('sync-status')).toHaveTextContent('In Sync');
    expect(screen.getByTestId('locked-banner')).toHaveTextContent('Locked banner');
    expect(screen.getByTestId('filter-display')).toHaveTextContent('Filters');
    expect(
      screen.getByText(
        (_, element) =>
          !!element?.classList.contains('filterSummaryText') &&
          element.textContent?.includes('Questions:') &&
          element.textContent?.includes('Responses:'),
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Toggle between individual and aggregate view' }));
    expect(callbacks.onSurveyViewModeToggle).toHaveBeenCalledTimes(1);
    expect(callbacks.onDownloadHtmlReport).not.toHaveBeenCalled();
    expect(callbacks.onGenerateAnalysis).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/Single HTML file/));
    fireEvent.click(screen.getByLabelText('Include Embedded Snapshot JSON'));
    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-generate-analysis'));
    fireEvent.click(screen.getByTestId('ce-surveyresults-html-report-download'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(callbacks.onExportFormatChange).toHaveBeenCalledWith(SESSION_RESULTS_EXPORT_FORMAT_SINGLE_HTML);
    expect(callbacks.onToggleReportSection).toHaveBeenCalledWith('snapshotJson');
    expect(selectedSections).toEqual({
      report: true,
      snapshotJson: true,
    });
    expect(callbacks.onGenerateAnalysis).not.toHaveBeenCalled();
    expect(callbacks.onDownloadHtmlReport).not.toHaveBeenCalled();
    expect(callbacks.onCloseReportModal).toHaveBeenCalledTimes(1);
    expect(callbacks.onCloseResultsModal).not.toHaveBeenCalled();
  });

  it('routes demo alternate results through the demo surface without rendering display panels', () => {
    const { props } = createProps({
      demoSurfaceProps: {
        activeSlug: 'demo-session',
        onAtlasModalClose: jest.fn(),
        onAtlasNodeOpen: jest.fn(),
        questionResponses: {},
        viewKey: 'atlas',
      },
      htmlReportModalProps: {
        ...createProps().props.htmlReportModalProps,
        isOpen: false,
      },
      reportSurfaceDisplayPlan: {
        demoResultsViewMode: 'atlas',
        isDemoAlternateResultsView: true,
      },
    });

    render(<SurveyResultsReportSurface {...props} />);

    expect(screen.getByTestId('ce-surveyresults-demo-surface-atlas')).toBeInTheDocument();
    expect(screen.getByTestId('mock-demo-surface')).toHaveTextContent('atlas');
    expect(screen.queryByTestId('filter-display')).toBeNull();
    expect(mockDemoSurface).toHaveBeenCalledWith(
      expect.objectContaining({
        activeSlug: 'demo-session',
        viewKey: 'atlas',
      }),
    );
  });
});
