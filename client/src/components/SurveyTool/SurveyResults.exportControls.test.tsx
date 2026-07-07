import React from 'react';
import { fireEvent, screen } from '@testing-library/react';
import { resolveSurveyResultsToggleKnobStyle } from './SurveyResults';
import {
  OP_NETWORK,
  RESPONDER_ONE,
  RESPONDER_TWO,
  SURVEY_ID,
  cacheStore,
  cacheStoreKey,
  clickExportDownload,
  installBrowserDownloadCapture,
  mountSurveyResults,
  openExportArea,
  readBlobText,
  resetSurveyResultsExportControlsHarness,
  seedQuestionsCache,
  seedSingleBinaryQuestion,
  selectExportType,
  waitForHydratedResponseCount,
} from './SurveyResults.exportControlsHarness';

const mockSbtFilter = jest.fn((..._args: any[]) => null);
jest.mock('../SBTs/SBTFilter', () => (props: any) => {
  mockSbtFilter(props);
  return null;
});
jest.mock('./QuestionFilter', () => () => null);
jest.mock('../../utilities/sessionResultsExport', () => {
  const actual = jest.requireActual('../../utilities/sessionResultsExport');
  return {
    ...actual,
    downloadSessionResultsHtmlReport: jest.fn(),
    downloadSessionResultsPdfReport: jest.fn(),
  };
});
jest.mock('../../utilities/ai/aiClient.js', () => ({
  callAI: jest.fn(),
}));
const mockPolisReport = jest.fn((..._args: any[]) => null);
jest.mock('../PolisReport/PolisReport', () => (props: any) => {
  mockPolisReport(props);
  return null;
});
const mockSingleQuestionResponse = jest.fn((..._args: any[]) => null);
jest.mock('./SingleQuestionResponse', () => (props: any) => {
  mockSingleQuestionResponse(props);
  return null;
});
const mockDemoAnalysisWorkspace = jest.fn((..._args: any[]) => null);
jest.mock('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDemoAnalysisWorkspace(props);
    return <div data-testid="surveyresults-demo-breakdown-view">Demo Breakdown View</div>;
  },
}));
const mockDebateMap = jest.fn((..._args: any[]) => null);
jest.mock('../DebateMap/DebateMap', () => ({
  __esModule: true,
  default: (props: any) => {
    mockDebateMap(props);
    return (
      <div data-testid="surveyresults-demo-atlas-view">
        Demo Atlas View
        {props?.requestedModalNodeId ? `:${props.requestedModalNodeId}` : ''}
      </div>
    );
  },
}));
const mockRiskMatrix = jest.fn((..._args: any[]) => null);
jest.mock('../MainContent/RiskMatrix', () => ({
  __esModule: true,
  default: (props: any) => {
    mockRiskMatrix(props);
    return (
      <button
        type="button"
        data-testid="surveyresults-demo-risk-matrix-view"
        onClick={() => props?.onOpenAtlasNode?.('atlas-node-1')}
      >
        Demo Risk Matrix View
      </button>
    );
  },
}));

beforeEach(() => {
  resetSurveyResultsExportControlsHarness();
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
});

describe('SurveyResults export/view controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  it('defaults export area to collapsed', () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });

    expect(screen.getByRole('button', { name: 'Export Data' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Download' })).toBeNull();
    expect(document.getElementById('surveyResultsExportArea')).toBeNull();
  });

  it('toggleExportArea flips exportAreaOpen state', () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });

    openExportArea();
    expect(document.getElementById('surveyResultsExportArea')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse export area' }));
    expect(document.getElementById('surveyResultsExportArea')).toBeNull();
    expect(screen.getByRole('button', { name: 'Export Data' })).toBeInTheDocument();
  });

  it('renders the survey view mode toggle switch without legacy view buttons', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    const toggle = screen.getByRole('switch', { name: 'Toggle between individual and aggregate view' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Individual')).toBeInTheDocument();
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
    expect(screen.queryByText('Individuals View')).toBeNull();
    expect(screen.queryByText('Aggregate View')).toBeNull();

    const knob = document.querySelector('.toggleKnob');
    expect(knob).not.toBeNull();
    expect(knob).toHaveStyle(resolveSurveyResultsToggleKnobStyle(false) as Record<string, string>);
  });

  it('toggles survey view mode from keyboard activation and ignores other keys', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    const getToggle = () => screen.getByRole('switch', { name: 'Toggle between individual and aggregate view' });

    // fireEvent returns false when preventDefault was called by the handler.
    const arrowNotPrevented = fireEvent.keyDown(getToggle(), { key: 'ArrowRight' });
    expect(arrowNotPrevented).toBe(true);
    expect(getToggle()).toHaveAttribute('aria-checked', 'false');

    const enterPrevented = fireEvent.keyDown(getToggle(), { key: 'Enter' });
    expect(enterPrevented).toBe(false);
    expect(getToggle()).toHaveAttribute('aria-checked', 'true');

    const spacePrevented = fireEvent.keyDown(getToggle(), { key: ' ' });
    expect(spacePrevented).toBe(false);
    expect(getToggle()).toHaveAttribute('aria-checked', 'false');
  });

  it('passes the light-surface filter button variant to survey-mode SBT filters', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    expect(mockSbtFilter).toHaveBeenCalled();
    const filterProps = mockSbtFilter.mock.calls[mockSbtFilter.mock.calls.length - 1][0];
    expect(filterProps.autoExpand).toBe(false);
    expect(filterProps.buttonSurface).toBe('light');
  });

  it('suppresses the embedded SBTFilter loading overlay in survey results', () => {
    mountSurveyResults({
      network: OP_NETWORK,
      sessionSlug: 'demo',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    expect(mockSbtFilter).toHaveBeenCalled();
    const filterProps = mockSbtFilter.mock.calls[mockSbtFilter.mock.calls.length - 1][0];
    expect(filterProps.hideLoadingOverlay).toBe(true);
  });

  it('renders the current export options list', () => {
    seedSingleBinaryQuestion({ slug: 'demo' });
    mountSurveyResults({ network: OP_NETWORK, sessionSlug: 'demo' });

    openExportArea();

    // Default export type label on the dropdown toggle.
    const dropdownToggle = document.querySelector('.exportDropdown');
    expect(dropdownToggle).not.toBeNull();
    expect(dropdownToggle).toHaveTextContent('CSV: Questions + Responses');

    const menu = document.querySelector('.dropdown-menu');
    expect(menu).not.toBeNull();
    const optionLabels = Array.from((menu as HTMLElement).querySelectorAll('button.dropdown-item')).map((item) =>
      item.textContent?.trim(),
    );

    expect(optionLabels).toEqual([
      'CSV: Questions',
      'CSV: Questions + Responses',
      'JSON: Questions',
      'JSON: Questions + Responses',
    ]);
    expect(optionLabels).not.toContain('Polis Report');
  });
});
