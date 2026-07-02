import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { renderSurveyResultsFilterExportControls } from './SurveyResultsFilterExportControls';

const mockSbtFilter = jest.fn();
const mockQuestionFilter = jest.fn();
const mockExportControls = jest.fn();

jest.mock('reactstrap', () => ({
  Button: ({
    children,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    className?: string;
    onClick?: React.MouseEventHandler<HTMLButtonElement>;
  }) => (
    <button type="button" className={className} onClick={onClick}>
      {children}
    </button>
  ),
  Label: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <label className={className}>{children}</label>
  ),
}));

jest.mock('../SBTs/SBTFilter', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockSbtFilter(props);
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof props.onFilter === 'function') props.onFilter(['sbt-filtered']);
        }}
      >
        SBT Filter
      </button>
    );
  },
}));

jest.mock('./QuestionFilter', () => ({
  __esModule: true,
  default: require('react').forwardRef((props: Record<string, unknown>, _ref: unknown) => {
    mockQuestionFilter(props);
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof props.onFilter === 'function') props.onFilter(['question-filtered']);
        }}
      >
        Question Filter
      </button>
    );
  }),
}));

jest.mock('./SurveyResultsExportControls', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    mockExportControls(props);
    return (
      <button
        type="button"
        onClick={() => {
          if (typeof props.onToggleExportArea === 'function') props.onToggleExportArea();
        }}
      >
        Export Data
      </button>
    );
  },
}));

const styleMap = {
  clearFilterIcon: 'clearFilterIcon',
  exportAndFilterContainer: 'exportAndFilterContainer',
  filterBox: 'filterBox',
  filterBoxLabel: 'filterBoxLabel',
  questionFilterButton: 'questionFilterButton',
  questionFilterIcon: 'questionFilterIcon',
};

const createProps = (
  overrides: Partial<Parameters<typeof renderSurveyResultsFilterExportControls>[0]> = {}
): Parameters<typeof renderSurveyResultsFilterExportControls>[0] => {
  const { exportControlsDisplay, filterState, ...restOverrides } = overrides;

  return {
    activeSessionSlug: 'demo',
    aggregateQuestionResponses: [{ responder: '0xaaa' }],
    currentSurveyIdForUrl: 'survey-1',
    currentViewModeForUrl: 'survey',
    defaultTags: ['tag'],
    ensureLightSbtUniverse: jest.fn(),
    isFilterActive: false,
    isQuestionCacheReady: true,
    isSBTCacheReady: true,
    network: { id: 84532 },
    onClearFilters: jest.fn(),
    onDownload: jest.fn(),
    onExportHtmlReport: jest.fn(),
    onExportTypeChange: jest.fn(),
    onFilterActivityChange: jest.fn(),
    onQuestionFilter: jest.fn(),
    onQuestionFilterCountUpdate: jest.fn(),
    onSbtFilter: jest.fn(),
    onSetFilterLoading: jest.fn(),
    onToggleExportArea: jest.fn(),
    onToggleQuestionFilter: jest.fn(),
    provider: 'provider',
    questionFilterQuestions: [{ id: 'q1' }],
    questionFilterRef: React.createRef(),
    questionResponses: { q1: [] },
    questionResponsesNonce: 1,
    questionsCacheNonce: 2,
    responses: [{ responder: '0xbbb' }],
    sbtCacheRevision: 3,
    sessionConfig: { slug: 'demo', networkChainId: 84532 },
    sessionSlug: 'demo',
    showQuestionFilter: false,
    storageKeyPrefix: 'demo:filters',
    styleMap,
    surveyViewMode: 'aggregate',
    viewMode: 'survey',
    ...restOverrides,
    exportControlsDisplay: {
      exportAreaOpen: false,
      exportOptions: [{ label: 'CSV', value: 'csv' }],
      exportTypeLabel: 'CSV',
      ...exportControlsDisplay,
    },
    filterState: {
      sbtFilter: { selected: ['0xaaa'] },
      ...filterState,
    },
  };
};

describe('renderSurveyResultsFilterExportControls', () => {
  beforeEach(() => {
    mockSbtFilter.mockClear();
    mockQuestionFilter.mockClear();
    mockExportControls.mockClear();
  });

  it('renders aggregate survey SBT filtering with light surface props and export controls', () => {
    const onSbtFilter = jest.fn();
    const onToggleExportArea = jest.fn();
    render(renderSurveyResultsFilterExportControls(createProps({
      isQuestionCacheReady: false,
      isSBTCacheReady: false,
      onSbtFilter,
      onToggleExportArea,
    })));

    fireEvent.click(screen.getByRole('button', { name: 'SBT Filter' }));
    fireEvent.click(screen.getByRole('button', { name: 'Export Data' }));

    expect(mockSbtFilter).toHaveBeenCalledWith(expect.objectContaining({
      autoExpand: false,
      buttonSurface: 'light',
      externalSBTFilterState: { selected: ['0xaaa'] },
      hideLoadingOverlay: true,
      isQuestionCacheReady: false,
      isSBTCacheReady: false,
      items: [{ responder: '0xaaa' }],
      mode: 'responder',
      activeSessionSlug: 'demo',
      sessionConfig: expect.objectContaining({ slug: 'demo' }),
      sessionSlug: 'demo',
      ensureLightSbtUniverse: expect.any(Function),
    }));
    expect(onSbtFilter).toHaveBeenCalledWith(['sbt-filtered']);
    expect(mockExportControls).toHaveBeenCalledWith(expect.objectContaining({
      exportOptions: [{ label: 'CSV', value: 'csv' }],
      exportTypeLabel: 'CSV',
    }));
    expect(onToggleExportArea).toHaveBeenCalledTimes(1);
  });

  it('uses response rows for individual survey filtering', () => {
    render(renderSurveyResultsFilterExportControls(createProps({
      surveyViewMode: 'individuals',
    })));

    expect(mockSbtFilter).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ responder: '0xbbb' }],
      mode: 'responder',
    }));
  });

  it('preserves an explicit general session slug for results filters', () => {
    render(renderSurveyResultsFilterExportControls(createProps({
      activeSessionSlug: 'demo',
      sessionSlug: '',
      viewMode: 'questions',
      showQuestionFilter: true,
    })));

    expect(mockQuestionFilter).toHaveBeenCalledWith(expect.objectContaining({
      activeSessionSlug: 'demo',
      sessionSlug: '',
    }));
  });

  it('renders question-mode filter controls with parent-owned handlers and storage context', () => {
    const onDownload = jest.fn();
    const onExportHtmlReport = jest.fn();
    const onQuestionFilter = jest.fn();
    const onToggleQuestionFilter = jest.fn();
    render(renderSurveyResultsFilterExportControls(createProps({
      currentViewModeForUrl: 'questions',
      isFilterActive: true,
      isQuestionCacheReady: false,
      isSBTCacheReady: false,
      onDownload,
      onExportHtmlReport,
      onQuestionFilter,
      onToggleQuestionFilter,
      showQuestionFilter: true,
      storageKeyPrefix: 'question:filters',
      surveyViewMode: 'aggregate',
      viewMode: 'questions',
    })));

    fireEvent.click(screen.getByRole('button', { name: /^Filter$/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Question Filter' }));

    expect(mockQuestionFilter).toHaveBeenCalledWith(expect.objectContaining({
      activeSessionSlug: 'demo',
      creatorAndResponderMode: true,
      currentSurveyIdForUrl: 'survey-1',
      currentViewModeForUrl: 'questions',
      filterModalOpen: true,
      isQuestionCacheReady: false,
      isSBTCacheReady: false,
      questions: [{ id: 'q1' }],
      resultsMode: true,
      sessionConfig: expect.objectContaining({ slug: 'demo' }),
      sessionSlug: 'demo',
      ensureLightSbtUniverse: expect.any(Function),
      storageKeyPrefix: 'question:filters',
    }));
    expect(mockExportControls).toHaveBeenCalledWith(expect.objectContaining({
      onDownload,
      onExportHtmlReport,
    }));
    expect(onToggleQuestionFilter).toHaveBeenCalledTimes(1);
    expect(onQuestionFilter).toHaveBeenCalledWith(['question-filtered']);
  });
});
