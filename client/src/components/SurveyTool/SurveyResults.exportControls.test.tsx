import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TestMemoryRouter as MemoryRouter } from 'testUtils/TestMemoryRouter';
import ConnectedSurveyResults, {
  SURVEY_RESULTS_CLICKABLE_ICON_STYLE,
  SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE,
  SURVEY_RESULTS_METADATA_MISSING_STYLE,
  SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE,
  SURVEY_RESULTS_MINI_PROGRESS_STYLE,
  SURVEY_RESULTS_SORTABLE_HEADER_STYLE,
  SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE,
  SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE,
  SURVEY_RESULTS_TABLE_BOOKMARK_STYLE,
  SURVEY_RESULTS_TABLE_CELL_STYLE,
  SURVEY_RESULTS_TRAILING_LABEL_STYLE,
  buildSurveyResultsAggregatorPanelClassName,
  buildSurveyResultsMultichoiceOptionClassName,
  countQuestionModeResponses,
  hasAnyCountableSurveyAnswer,
  resolveSurveyResultsSyncDetailsStyle,
  resolveSurveyResultsToggleKnobStyle,
} from './SurveyResults';
import styles from './SurveyResults.module.scss';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import * as sessionScanScopeModule from '../../utilities/session/sessionScanScope.js';
import { resolveSurveyResultsQuestionReadScope } from './surveyResultsSessionResolution.js';
import { sbtBasePath } from '../../utilities/ui/terminology.js';
import SurveyResultsExportControls from './SurveyResultsExportControls';
import SurveyResultsSurveyViewModeToggle from './SurveyResultsSurveyViewModeToggle';
import { callAI } from '../../utilities/ai/aiScripts.js';
import {
  SESSION_RESULTS_EXPORT_FORMAT_PDF,
  downloadSessionResultsHtmlReport,
  downloadSessionResultsPdfReport,
} from '../../utilities/sessionResultsExport';

type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type SurveyResultsProps = Record<string, any>;
const cacheScripts: any = cacheScriptsModule;
const sessionScanScope: any = sessionScanScopeModule;

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
jest.mock('../../utilities/ai/aiScripts.js', () => ({
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

const SurveyResults: any = (ConnectedSurveyResults as any).WrappedComponent;

const createSubject = (props: SurveyResultsProps = {}): any =>
  new SurveyResults({
    network: { id: 84532 },
    ...props,
  });

const createDeferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const flushMicrotasks = async (cycles = 3): Promise<void> => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
  }
};

const attachStateHarness = (subject: any): any => {
  subject.setState = jest.fn((updater, cb) => {
    const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject;
};

const createAnalysisArtifact = (inputSignature = 'input-sig') => ({
  generatedAt: '2026-06-01T00:00:00.000Z',
  inputSignature,
  kind: 'ce_session_results_analysis_artifact',
  participants: [],
  sections: {
    argumentMap: { available: true, debates: [] },
    atlas: { available: true, edges: [], nodes: [] },
    breakdown: { available: true, dimensions: [], groups: [], summary: {} },
    riskMatrix: { available: true, categories: [], comments: [], heatmap: {}, scenarioLinks: [] },
  },
  source: 'ai-generated',
  version: 1,
});

const findElement = (node: TreeNode, predicate: TreePredicate): TreeNode | null => {
  const stack: TreeNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    if (Array.isArray(current)) {
      for (let i = current.length - 1; i >= 0; i -= 1) {
        stack.push(current[i]);
      }
      continue;
    }
    if (typeof current !== 'object') continue;
    if (predicate(current)) return current;
    const children = current?.props?.children;
    if (children !== undefined) stack.push(children);
  }
  return null;
};

const collectTreeNodes = (
  node: TreeNode,
  predicate: TreePredicate,
  acc: TreeNode[] = []
): TreeNode[] => {
  if (node == null) return acc;
  if (Array.isArray(node)) {
    node.forEach((child) => collectTreeNodes(child, predicate, acc));
    return acc;
  }
  if (typeof node !== 'object') return acc;
  if (predicate(node)) acc.push(node);
  return collectTreeNodes(node?.props?.children, predicate, acc);
};

const normalizeChildren = (children: TreeNode): TreeNode[] => {
  if (children == null) return [];
  if (Array.isArray(children)) return children.filter(Boolean);
  return [children].filter(Boolean);
};

const renderSubjectTree = (subject: any) => (
  render(
    <MemoryRouter>
      {subject.render()}
    </MemoryRouter>
  )
);

beforeEach(() => {
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
  (downloadSessionResultsHtmlReport as jest.Mock).mockClear();
  (downloadSessionResultsPdfReport as jest.Mock).mockClear();
  (callAI as jest.Mock).mockClear();
});

const treeHasText = (node: TreeNode, text: string): boolean => {
  if (node == null) return false;
  if (Array.isArray(node)) return node.some((child) => treeHasText(child, text));
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node).includes(text);
  }
  if (typeof node !== 'object') return false;
  return treeHasText(node?.props?.children, text);
};

describe('SurveyResults export/view controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults export area to collapsed', () => {
    const subject = createSubject();
    expect(subject.state.exportAreaOpen).toBe(false);
  });

  it('toggleExportArea flips exportAreaOpen state', () => {
    const subject = attachStateHarness(createSubject());

    subject.toggleExportArea();
    expect(subject.state.exportAreaOpen).toBe(true);

    subject.toggleExportArea();
    expect(subject.state.exportAreaOpen).toBe(false);
  });

  it('renders the survey view mode toggle switch without legacy view buttons', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      surveyViewMode: 'individuals',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const toggleNode = findElement(
      tree,
      (element) => element?.type === SurveyResultsSurveyViewModeToggle
    );
    expect(toggleNode).toBeTruthy();
    expect(toggleNode.props.isAggregate).toBe(false);
    expect(toggleNode.props.knobStyle).toEqual(resolveSurveyResultsToggleKnobStyle(false));

    const markup = renderToStaticMarkup(<SurveyResultsSurveyViewModeToggle {...toggleNode.props} />);
    expect(markup).toContain('Individual');
    expect(markup).toContain('Aggregate');
    expect(markup).not.toContain('Individuals View');
    expect(markup).not.toContain('Aggregate View');
  });

  it('toggles survey view mode from keyboard activation and ignores other keys', () => {
    const subject = attachStateHarness(createSubject());
    subject.state = {
      ...subject.state,
      surveyViewMode: 'individuals',
    };

    const ignoredPreventDefault = jest.fn();
    subject.handleSurveyViewModeKeyDown({
      key: 'ArrowRight',
      preventDefault: ignoredPreventDefault,
    });
    expect(ignoredPreventDefault).not.toHaveBeenCalled();
    expect(subject.state.surveyViewMode).toBe('individuals');

    const enterPreventDefault = jest.fn();
    subject.handleSurveyViewModeKeyDown({
      key: 'Enter',
      preventDefault: enterPreventDefault,
    });
    expect(enterPreventDefault).toHaveBeenCalledTimes(1);
    expect(subject.state.surveyViewMode).toBe('aggregate');

    const spacePreventDefault = jest.fn();
    subject.handleSurveyViewModeKeyDown({
      key: ' ',
      preventDefault: spacePreventDefault,
    });
    expect(spacePreventDefault).toHaveBeenCalledTimes(1);
    expect(subject.state.surveyViewMode).toBe('individuals');
  });

  it('passes the light-surface filter button variant to survey-mode SBT filters', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
      filterState: { sbtFilter: {} },
    };

    const tree = subject.render();
    const surveyFilter = findElement(
      tree,
      (element) =>
        element?.props?.autoExpand === false &&
        element?.props?.buttonSurface === 'light'
    );

    expect(surveyFilter).toBeTruthy();
  });

  it('suppresses the embedded SBTFilter loading overlay in survey results', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
      filterState: { sbtFilter: {} },
    };

    const tree = subject.render();
    const surveyFilter = findElement(
      tree,
      (element) =>
        element?.props?.autoExpand === false &&
        element?.props?.buttonSurface === 'light'
    );

    expect(surveyFilter).toBeTruthy();
    expect(surveyFilter.props.hideLoadingOverlay).toBe(true);
  });

  it('renders the current export options list', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportAreaOpen: true,
      exportType: 'csv-questions-and-responses',
      aggregateQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const exportControls = findElement(
      tree,
      (element) => element?.type === SurveyResultsExportControls
    );
    const optionLabels = exportControls?.props?.exportOptions?.map((option: any) => option.label) || [];

    expect(exportControls).toBeTruthy();
    expect(exportControls.props.exportTypeLabel).toBe('CSV: Questions + Responses');
    expect(optionLabels).toEqual([
      'CSV: Questions',
      'CSV: Questions + Responses',
      'JSON: Questions',
      'JSON: Questions + Responses',
    ]);
    expect(optionLabels).not.toContain('Polis Report');
  });

  it('renders the HTML report export action in the expanded export area', () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportAreaOpen: true,
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const exportControls = findElement(
      tree,
      (element) => element?.type === SurveyResultsExportControls
    );

    expect(exportControls).toBeTruthy();
    expect(exportControls.props.onExportHtmlReport).toBe(subject.openHtmlReportExportModal);

    exportControls.props.onExportHtmlReport();
    expect(subject.state.htmlReportModalOpen).toBe(true);
  });

  it('shows the HTML report confirmation modal in redacted mode and disables download without reportable data', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'demo',
    });

    subject.state = {
      ...subject.state,
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      viewMode: 'questions',
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.renderHtmlReportExportModal();
    const modal = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-html-report-modal'
    );
    const downloadButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-html-report-download'
    );

    expect(modal?.props?.className).toBe(styles.htmlReportModal);
    expect(treeHasText(tree, 'Privacy mode:')).toBe(true);
    expect(treeHasText(tree, 'Redacted')).toBe(true);
    expect(treeHasText(tree, 'Exported viewer')).toBe(true);
    expect(treeHasText(tree, 'Single HTML file')).toBe(true);
    expect(treeHasText(tree, 'PDF report')).toBe(true);
    expect(treeHasText(tree, 'Embedded Snapshot JSON')).toBe(true);
    expect(treeHasText(tree, 'Unavailable')).toBe(true);
    expect(treeHasText(tree, 'Connect a wallet to download authenticated exports.')).toBe(true);
    expect(treeHasText(tree, 'Protection')).toBe(false);
    expect(treeHasText(tree, 'Exporter metadata')).toBe(false);
    expect(treeHasText(tree, 'Integrity warning')).toBe(false);
    expect(treeHasText(tree, 'Redaction')).toBe(false);
    expect(treeHasText(tree, 'Raw responses in snapshot')).toBe(false);
    expect(treeHasText(tree, 'Downloader address in artifact metadata')).toBe(false);
    expect(downloadButton?.props?.disabled).toBe(true);
    expect(downloadButton?.props?.className).toBe(styles.htmlReportDownloadButton);
  });

  it('enables demo preview mode with local analysis sections without a connected wallet', () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
    }));

    subject.state = {
      ...subject.state,
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      viewMode: 'questions',
      totalQuestionsCount: 2,
      totalResponsesCount: 3,
      filteredResponsesCount: 3,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          { responder: '0x1111111111111111111111111111111111111111', response: { answer: { value: 'Use a viewer.' } } },
          { responder: '0x2222222222222222222222222222222222222222', response: { answer: { value: 'Make it readable.' } } },
        ],
        q2: [
          { responder: '0x1111111111111111111111111111111111111111', response: { answer: { value: 'Show risk clearly.' } } },
        ],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { id: 'q1', prompt: 'What export should exist?', type: 'freeform' },
      q2: { id: 'q2', prompt: 'What risk matters?', type: 'freeform' },
    }));

    let tree = subject.renderHtmlReportExportModal();
    const demoToggle = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-html-report-demo-mode'
    );

    expect(demoToggle).toBeTruthy();
    expect(demoToggle?.props?.checked).toBe(false);
    expect(treeHasText(tree, 'Demo preview mode')).toBe(true);

    demoToggle?.props?.onChange();

    expect(subject.state.htmlReportDemoMode).toBe(true);
    expect(subject.state.htmlReportAnalysisArtifact?.model).toBe('demo-preview');
    expect(subject.state.htmlReportSelectedSections).toEqual({
      argumentMap: true,
      atlas: true,
      report: true,
      riskMatrix: true,
      snapshotJson: true,
    });

    tree = subject.renderHtmlReportExportModal();
    const downloadButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-html-report-download'
    );
    const argumentMapCheckbox = findElement(
      tree,
      (element) => element?.props?.['aria-label'] === 'Include Argument Map'
    );
    const snapshot = subject.buildSessionResultsHtmlReportSnapshot('2026-05-25T18:30:00.000Z');

    expect(argumentMapCheckbox?.props?.checked).toBe(true);
    expect(downloadButton?.props?.disabled).toBe(false);
    expect(snapshot.exportedBy).toEqual({
      address: 'demo-preview',
      chainId: 84532,
      displayAddress: 'Demo preview',
    });
    expect(snapshot.sections.argumentMap.available).toBe(true);
    expect(snapshot.sections.riskMatrix.available).toBe(true);
    expect(snapshot.sections.atlas.available).toBe(true);
  });

  it('builds a redacted HTML report snapshot from hydrated SurveyResults state', () => {
    const subject = createSubject({
      viewMode: 'questions',
      sessionSlug: 'demo',
      network: { id: 11155420 },
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredResponsesCount: 1,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xabc',
            response: {
              answer: { value: 'Raw answer' },
              additional: { value: 'Raw note' },
            },
          },
        ],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Should exports be redacted?',
        type: 'binary',
        options: ['Yes', 'No'],
      },
    }));

    const snapshot = subject.buildSessionResultsHtmlReportSnapshot('2026-05-25T18:30:00.000Z');
    const snapshotText = JSON.stringify(snapshot);

    expect(snapshot.sections.report.available).toBe(true);
    expect(snapshot.sections.report.questions).toEqual([
      {
        id: 'q1',
        prompt: 'Should exports be redacted?',
        type: 'binary',
        tags: [],
        options: ['Yes', 'No'],
        responseCount: 1,
      },
    ]);
    expect(snapshot.counts.participants).toBe(1);
    expect(snapshot.privacyMode).toBe('redacted');
    expect(snapshot.exportedBy).toEqual({
      address: '0x9999999999999999999999999999999999999999',
      chainId: 11155420,
      displayAddress: '0x9999...9999',
    });
    expect(snapshotText).not.toContain('0xabc');
    expect(snapshotText).not.toContain('Raw answer');
    expect(snapshotText).not.toContain('Raw note');
  });

  it('downloads the confirmed HTML report through the browser helper', async () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
      network: { id: 11155420 },
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
    }));

    subject.state = {
      ...subject.state,
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      viewMode: 'questions',
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredResponsesCount: 1,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xabc',
            response: {
              answer: { value: 'Agree' },
            },
          },
        ],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Export this report?',
        type: 'binary',
        options: ['Agree', 'Disagree'],
      },
    }));

    const tree = subject.renderHtmlReportExportModal();
    const downloadButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-html-report-download'
    );

    expect(downloadButton?.props?.disabled).toBe(false);
    await downloadButton.props.onClick();

    expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1);
    const [html, filename] = (downloadSessionResultsHtmlReport as jest.Mock).mock.calls[0];
    expect(html).toContain('<!doctype html>');
    expect(html).toContain('Export this report?');
    expect(html).toContain('Downloaded by 0x9999...9999');
    expect(html).toContain('"address": "0x9999999999999999999999999999999999999999"');
    expect(html).not.toContain('0xabc');
    expect(filename).toBe('contextEngine_sessionReport_demo_2026-05-25T18_30_00_000Z.html');
    expect(subject.state.htmlReportModalOpen).toBe(false);
  });

  it('downloads the selected report as a PDF report when that format is selected', async () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
      network: { id: 11155420 },
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
    }));

    subject.state = {
      ...subject.state,
      htmlReportExportFormat: SESSION_RESULTS_EXPORT_FORMAT_PDF,
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      viewMode: 'questions',
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredResponsesCount: 1,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xabc',
            response: {
              answer: { value: 'Agree' },
            },
          },
        ],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Export this report?',
        type: 'binary',
        options: ['Agree', 'Disagree'],
      },
    }));

    await subject.downloadHtmlReport();

    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).toHaveBeenCalledTimes(1);
    expect((downloadSessionResultsPdfReport as jest.Mock).mock.calls[0][0]).toEqual(expect.objectContaining({
      filename: 'contextEngine_sessionReport_demo_2026-05-25T18_30_00_000Z.pdf',
      html: expect.stringContaining('ce-report-pdf'),
    }));
  });

  it('blocks HTML report downloads without exporter identity before rendering artifacts', async () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
      loginComplete: false,
    }));

    subject.state = {
      ...subject.state,
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      viewMode: 'questions',
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredResponsesCount: 1,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xabc', response: { answer: { value: 'Agree' } } }],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Export this report?',
        type: 'binary',
        options: ['Agree', 'Disagree'],
      },
    }));

    await subject.downloadHtmlReport();

    expect(subject.state.alertMessage).toBe(
      'Connect a wallet with permission to view these results before export.'
    );
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(subject.state.htmlReportModalOpen).toBe(true);
  });

  it('blocks selected report sections when the generated analysis artifact is missing', async () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
    }));

    subject.state = {
      ...subject.state,
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      htmlReportSelectedSections: {
        argumentMap: false,
        atlas: false,
        report: true,
        riskMatrix: true,
        snapshotJson: true,
      },
      viewMode: 'questions',
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredResponsesCount: 1,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xabc', response: { answer: { value: 'Agree' } } }],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Export this report?',
        type: 'binary',
        options: ['Agree', 'Disagree'],
      },
    }));

    await subject.downloadHtmlReport();

    expect(subject.state.alertMessage).toBe(
      'Generate selected analysis views before downloading the report.'
    );
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(subject.state.htmlReportModalOpen).toBe(true);
  });

  it('surfaces HTML report download failures and allows a later retry', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
      network: { id: 11155420 },
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
    }));
    (downloadSessionResultsHtmlReport as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('download failed');
      });

    subject.state = {
      ...subject.state,
      htmlReportModalOpen: true,
      htmlReportExportedAt: '2026-05-25T18:30:00.000Z',
      viewMode: 'questions',
      totalQuestionsCount: 1,
      totalResponsesCount: 1,
      filteredResponsesCount: 1,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xabc', response: { answer: { value: 'Agree' } } }],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Export this report?',
        type: 'binary',
        options: ['Agree', 'Disagree'],
      },
    }));

    await subject.downloadHtmlReport();

    expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(1);
    expect(subject.state.alertMessage).toBe('Unable to export the HTML report.');
    expect(subject.state.htmlReportModalOpen).toBe(true);
    expect(consoleErrorSpy.mock.calls.some((call) => call.some((arg) => (
      String(arg).includes('[SurveyResults.downloadHtmlReport] Failed to export HTML report')
    )))).toBe(true);

    await subject.downloadHtmlReport();

    expect(downloadSessionResultsHtmlReport).toHaveBeenCalledTimes(2);
    expect(subject.state.alertMessage).toBe('');
    expect(subject.state.htmlReportModalOpen).toBe(false);
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('generates AI analysis with synthetic participant IDs and stores the local artifact', async () => {
    (callAI as jest.Mock).mockImplementation((prompt: string) => {
      if (prompt.includes('Generate only this result view: Breakdown')) {
        return Promise.resolve(JSON.stringify({
          breakdown: {
            dimensions: [{ id: 'question_tags', label: 'Question Tags', values: [{ id: 'exports', label: 'exports', count: 3 }] }],
            summary: { overview: 'Participants broadly prioritize clear export controls.' },
            groups: [{ id: 'group_1', label: 'Export controls', participantIds: ['participant_001'] }],
          },
        }));
      }
      if (prompt.includes('Generate only this result view: Argument Map')) {
        return Promise.resolve(JSON.stringify({
          argumentMap: {
            debates: [{ id: 'debate_1', title: 'Export scope', claims: [{ id: 'claim_1', participantIds: ['participant_001'] }] }],
          },
        }));
      }
      if (prompt.includes('Generate only this result view: Risk Matrix')) {
        return Promise.resolve(JSON.stringify({
          riskMatrix: {
            categories: [{ id: 'risk_1', label: 'Privacy leakage' }],
            comments: [{ id: 'risk_comment_1', participantIds: ['participant_002'] }],
            heatmap: { risk_1: { likelihood: 'medium', impact: 'high' } },
          },
        }));
      }
      return Promise.resolve(JSON.stringify({
        atlas: {
          nodes: [{ id: 'atlas_1', label: 'Privacy-preserving exports', participantIds: ['participant_001'] }],
          edges: [],
        },
      }));
    });
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionName: 'Demo Session',
      sessionSlug: 'demo',
      network: { id: 11155420 },
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      htmlReportSelectedSections: {
        argumentMap: true,
        atlas: true,
        report: true,
        riskMatrix: true,
        snapshotJson: true,
      },
      totalQuestionsCount: 2,
      totalResponsesCount: 3,
      filteredResponsesCount: 3,
      filterState: {
        sbtFilter: {
          onlyVerifiedHumans: true,
          selectedSBTGroupsResponder: [
            {
              address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
              label: 'Builders Guild',
            },
            {
              address: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          ],
        },
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          { responder: '0x1111111111111111111111111111111111111111', response: { answer: { value: 'Use a viewer.' } } },
          { responder: '0x2222222222222222222222222222222222222222', response: { answer: { value: 'Keep it private.' } } },
        ],
        q2: [
          { responder: '0x1111111111111111111111111111111111111111', response: { answer: { value: 'Make PDF readable.' } } },
        ],
      },
      sbtFilteredResponses: [],
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { id: 'q1', prompt: 'What export should exist?', tags: ['exports'], type: 'freeform' },
      q2: { id: 'q2', prompt: 'What risk matters?', tags: ['safety'], type: 'freeform' },
    }));
    subject.readSessionResultsAnalysisArtifactFromCache = jest.fn(() => null);
    subject.writeSessionResultsAnalysisArtifactToCache = jest.fn(() => Promise.resolve());

    await subject.generateHtmlReportAnalysisViews();

    expect(callAI).toHaveBeenCalledTimes(4);
    const prompt = (callAI as jest.Mock).mock.calls[0][0];
    expect(prompt).toContain('participant_001');
    expect(prompt).toContain('Use a viewer.');
    expect(prompt).toContain('Question Tags');
    expect(prompt).toContain('Builders Guild');
    expect(prompt).toContain('Verified humans');
    expect(prompt).not.toContain('0x1111111111111111111111111111111111111111');
    expect(prompt).not.toContain('0x2222222222222222222222222222222222222222');
    expect(prompt).not.toContain('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(subject.writeSessionResultsAnalysisArtifactToCache).toHaveBeenCalledTimes(4);
    expect((callAI as jest.Mock).mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining('Generate only this result view: Breakdown'),
      expect.stringContaining('Generate only this result view: Argument Map'),
      expect.stringContaining('Generate only this result view: Risk Matrix'),
      expect.stringContaining('Generate only this result view: Atlas Nodes'),
    ]);
    expect(subject.state.htmlReportAnalysisArtifact.sections.argumentMap.available).toBe(true);
    expect(subject.state.htmlReportAnalysisArtifact.sections.breakdown.available).toBe(true);

    const snapshot = subject.buildSessionResultsHtmlReportSnapshot('2026-05-25T18:30:00.000Z');
    expect(snapshot.sections.argumentMap.available).toBe(true);
    expect(snapshot.sections.riskMatrix.available).toBe(true);
    expect(snapshot.sections.atlas.available).toBe(true);
  });

  it('orders analysis generation status, cache writes, and final parent state on success', async () => {
    const firstAnalysis = createDeferred<string>();
    const secondAnalysis = createDeferred<string>();
    (callAI as jest.Mock)
      .mockImplementationOnce(() => firstAnalysis.promise)
      .mockImplementationOnce(() => secondAnalysis.promise);

    const subject = attachStateHarness(createSubject({
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
      sessionSlug: 'lifecycle-session',
    }));
    const stateEvents: Array<{
      generating: unknown;
      patch: Record<string, unknown>;
      progress: unknown;
    }> = [];
    const originalSetState = subject.setState;
    subject.setState = jest.fn((updater, cb) => {
      const patch = originalSetState(updater, cb);
      stateEvents.push({
        generating: subject.state.htmlReportAnalysisGenerating,
        patch,
        progress: subject.state.htmlReportAnalysisProgress,
      });
      return patch;
    });
    const writeEvents: Array<{ artifact: any; progress: unknown }> = [];

    subject.isHtmlReportDemoModeActive = jest.fn(() => false);
    subject.isHtmlReportExportAuthorized = jest.fn(() => true);
    subject.buildSessionResultsAnalysisPayloadForAi = jest.fn(() => ({
      aiPayload: { questions: [], responses: [], segmentDimensions: [] },
      eligibility: { eligible: true, reasons: [] },
      inputSignature: 'lifecycle-input',
      participants: [],
    }));
    subject.readSessionResultsAnalysisArtifactFromCache = jest.fn(() => null);
    subject.getHtmlReportAnalysisSectionsToGenerate = jest.fn(() => ['breakdown', 'riskMatrix']);
    subject.getHtmlReportAnalysisArtifact = jest.fn(() => null);
    subject.writeSessionResultsAnalysisArtifactToCache = jest.fn(async (artifact) => {
      writeEvents.push({
        artifact,
        progress: subject.state.htmlReportAnalysisProgress,
      });
    });

    const generation = subject.generateHtmlReportAnalysisViews();

    expect((callAI as jest.Mock).mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining('Generate only this result view: Breakdown'),
    ]);
    expect(stateEvents.map((event) => event.patch)).toEqual([
      expect.objectContaining({
        htmlReportAnalysisGenerating: true,
        htmlReportAnalysisError: '',
        htmlReportAnalysisInputSignature: 'lifecycle-input',
        htmlReportAnalysisProgress: '',
      }),
      {
        htmlReportAnalysisProgress: 'Generating Breakdown (1/2)',
      },
    ]);
    expect(subject.state.htmlReportAnalysisGenerating).toBe(true);
    expect(subject.state.htmlReportAnalysisProgress).toBe('Generating Breakdown (1/2)');
    expect(treeHasText(subject.renderHtmlReportExportModal(), 'Generating Breakdown (1/2)')).toBe(true);
    expect(subject.writeSessionResultsAnalysisArtifactToCache).not.toHaveBeenCalled();

    firstAnalysis.resolve(JSON.stringify({
      breakdown: {
        dimensions: [],
        groups: [{ id: 'group_1', label: 'Lifecycle group' }],
        summary: { overview: 'First section ready.' },
      },
    }));
    await flushMicrotasks();

    expect(subject.writeSessionResultsAnalysisArtifactToCache).toHaveBeenCalledTimes(1);
    expect(writeEvents[0].progress).toBe('Generating Breakdown (1/2)');
    expect(writeEvents[0].artifact.sections.breakdown.available).toBe(true);
    expect(subject.state.htmlReportAnalysisProgress).toBe('Generating Risk Matrix (2/2)');
    expect((callAI as jest.Mock).mock.calls.map((call) => call[0])).toEqual([
      expect.stringContaining('Generate only this result view: Breakdown'),
      expect.stringContaining('Generate only this result view: Risk Matrix'),
    ]);

    secondAnalysis.resolve(JSON.stringify({
      riskMatrix: {
        categories: [{ id: 'risk_1', label: 'Lifecycle risk' }],
        comments: [],
        heatmap: {},
        scenarioLinks: [],
      },
    }));
    await generation;

    expect(subject.writeSessionResultsAnalysisArtifactToCache).toHaveBeenCalledTimes(2);
    expect(writeEvents[1].progress).toBe('Generating Risk Matrix (2/2)');
    expect(writeEvents[1].artifact.sections.breakdown.available).toBe(true);
    expect(writeEvents[1].artifact.sections.riskMatrix.available).toBe(true);
    expect(subject.state.htmlReportAnalysisArtifact).toBe(writeEvents[1].artifact);
    expect(subject.state.htmlReportAnalysisGenerating).toBe(false);
    expect(subject.state.htmlReportAnalysisError).toBe('');
    expect(subject.state.htmlReportAnalysisProgress).toBe('');
    expect(subject.state.htmlReportAnalysisInputSignature).toBe('lifecycle-input');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(stateEvents[stateEvents.length - 1].patch).toEqual(expect.objectContaining({
      htmlReportAnalysisArtifact: writeEvents[1].artifact,
      htmlReportAnalysisGenerating: false,
      htmlReportAnalysisError: '',
      htmlReportAnalysisProgress: '',
    }));
  });

  it('writes generated analysis artifacts to the scoped cache key without clobbering siblings', async () => {
    const subject = createSubject({
      network: { id: 11155420 },
      sessionSlug: 'alpha-session',
    });
    subject.getEffectiveSlug = jest.fn(() => 'alpha-session');

    const existingArtifact = createAnalysisArtifact('old-input');
    const nextArtifact = createAnalysisArtifact('new-input');
    const readSpy = jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      existingFlag: true,
      sessionResultsAnalysis: {
        'sessionResultsAnalysis:v1:OP Sepolia:old-input': existingArtifact,
      },
    });
    const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);

    await subject.writeSessionResultsAnalysisArtifactToCache(nextArtifact);

    expect(readSpy).toHaveBeenCalledWith('analysisCache', 'alpha-session');
    expect(writeSpy).toHaveBeenCalledWith('analysisCache', 'alpha-session', {
      existingFlag: true,
      sessionResultsAnalysis: {
        'sessionResultsAnalysis:v1:OP Sepolia:old-input': existingArtifact,
        'sessionResultsAnalysis:v1:OP Sepolia:new-input': nextArtifact,
      },
    });
  });

  it('uses a cached complete analysis artifact without AI calls or cache writes', async () => {
    const subject = attachStateHarness(createSubject({
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
    }));
    const cachedArtifact = createAnalysisArtifact('cached-input');
    subject.isHtmlReportDemoModeActive = jest.fn(() => false);
    subject.isHtmlReportExportAuthorized = jest.fn(() => true);
    subject.buildSessionResultsAnalysisPayloadForAi = jest.fn(() => ({
      aiPayload: { questions: [], responses: [], segmentDimensions: [] },
      eligibility: { eligible: true, reasons: [] },
      inputSignature: 'cached-input',
      participants: [],
    }));
    subject.readSessionResultsAnalysisArtifactFromCache = jest.fn(() => cachedArtifact);
    subject.getHtmlReportAnalysisSectionsToGenerate = jest.fn(() => ['breakdown']);
    subject.getHtmlReportAnalysisArtifact = jest.fn(() => null);
    subject.writeSessionResultsAnalysisArtifactToCache = jest.fn();

    await subject.generateHtmlReportAnalysisViews();

    expect(callAI).not.toHaveBeenCalled();
    expect(subject.writeSessionResultsAnalysisArtifactToCache).not.toHaveBeenCalled();
    expect(subject.state.htmlReportAnalysisArtifact).toBe(cachedArtifact);
    expect(subject.state.htmlReportAnalysisError).toBe('');
    expect(subject.state.htmlReportAnalysisInputSignature).toBe('cached-input');
  });

  it('blocks analysis generation before cache reads when exporter identity is missing', async () => {
    const subject = attachStateHarness(createSubject({
      account: '',
      loginComplete: false,
      sessionSlug: 'missing-identity-session',
    }));
    subject.isHtmlReportDemoModeActive = jest.fn(() => false);
    subject.buildSessionResultsAnalysisPayloadForAi = jest.fn();
    subject.readSessionResultsAnalysisArtifactFromCache = jest.fn();
    subject.getHtmlReportAnalysisSectionsToGenerate = jest.fn();
    subject.getHtmlReportAnalysisArtifact = jest.fn();
    subject.writeSessionResultsAnalysisArtifactToCache = jest.fn();

    await subject.generateHtmlReportAnalysisViews();

    expect(subject.buildSessionResultsAnalysisPayloadForAi).not.toHaveBeenCalled();
    expect(subject.readSessionResultsAnalysisArtifactFromCache).not.toHaveBeenCalled();
    expect(subject.getHtmlReportAnalysisSectionsToGenerate).not.toHaveBeenCalled();
    expect(subject.getHtmlReportAnalysisArtifact).not.toHaveBeenCalled();
    expect(callAI).not.toHaveBeenCalled();
    expect(subject.writeSessionResultsAnalysisArtifactToCache).not.toHaveBeenCalled();
    expect(subject.setState).toHaveBeenCalledWith({
      htmlReportAnalysisError: 'Connect a wallet with permission to view these results before generating analysis views.',
    });
    expect(subject.state.htmlReportAnalysisGenerating).toBe(false);
    expect(subject.state.htmlReportAnalysisError).toBe(
      'Connect a wallet with permission to view these results before generating analysis views.'
    );
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('ignores stale in-memory analysis artifacts and regenerates the current input signature', async () => {
    (callAI as jest.Mock).mockResolvedValue(JSON.stringify({
      breakdown: {
        dimensions: [],
        groups: [{ id: 'fresh_group', label: 'Fresh group' }],
        summary: { overview: 'Fresh analysis.' },
      },
    }));
    const staleArtifact = createAnalysisArtifact('stale-input');
    const subject = attachStateHarness(createSubject({
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
      sessionSlug: 'stale-artifact-session',
    }));
    subject.isHtmlReportDemoModeActive = jest.fn(() => false);
    subject.isHtmlReportExportAuthorized = jest.fn(() => true);
    subject.buildSessionResultsAnalysisPayloadForAi = jest.fn(() => ({
      aiPayload: { questions: [], responses: [], segmentDimensions: [] },
      eligibility: { eligible: true, reasons: [] },
      inputSignature: 'fresh-input',
      participants: [],
    }));
    subject.readSessionResultsAnalysisArtifactFromCache = jest.fn(() => null);
    subject.getHtmlReportAnalysisSectionsToGenerate = jest.fn(() => ['breakdown']);
    subject.getHtmlReportAnalysisArtifact = jest.fn(() => staleArtifact);
    subject.writeSessionResultsAnalysisArtifactToCache = jest.fn(() => Promise.resolve());

    await subject.generateHtmlReportAnalysisViews();

    expect(subject.readSessionResultsAnalysisArtifactFromCache).toHaveBeenCalledWith('fresh-input');
    expect(callAI).toHaveBeenCalledTimes(1);
    expect(subject.writeSessionResultsAnalysisArtifactToCache).toHaveBeenCalledTimes(1);
    const [writtenArtifact] = subject.writeSessionResultsAnalysisArtifactToCache.mock.calls[0];
    expect(writtenArtifact.inputSignature).toBe('fresh-input');
    expect(writtenArtifact).not.toBe(staleArtifact);
    expect(writtenArtifact.sections.breakdown.available).toBe(true);
    expect(subject.state.htmlReportAnalysisArtifact).toBe(writtenArtifact);
    expect(subject.state.htmlReportAnalysisInputSignature).toBe('fresh-input');
    expect(subject.state.htmlReportAnalysisError).toBe('');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('blocks ineligible analysis payloads before cache lookup, AI calls, or artifact writes', async () => {
    const subject = attachStateHarness(createSubject({
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
      sessionSlug: 'blocked-session',
    }));
    subject.state = {
      ...subject.state,
      htmlReportModalOpen: true,
    };
    subject.isHtmlReportDemoModeActive = jest.fn(() => false);
    subject.isHtmlReportExportAuthorized = jest.fn(() => true);
    subject.buildSessionResultsAnalysisPayloadForAi = jest.fn(() => ({
      aiPayload: { questions: [], responses: [], segmentDimensions: [] },
      eligibility: {
        counts: {
          participants: 0,
          questions: 0,
          responses: 0,
        },
        eligible: false,
        reasons: ['Need at least one response.'],
      },
      inputSignature: 'blocked-input',
      participants: [],
    }));
    subject.readSessionResultsAnalysisArtifactFromCache = jest.fn();
    subject.getHtmlReportAnalysisSectionsToGenerate = jest.fn();
    subject.getHtmlReportAnalysisArtifact = jest.fn();
    subject.writeSessionResultsAnalysisArtifactToCache = jest.fn();

    await subject.generateHtmlReportAnalysisViews();

    expect(subject.readSessionResultsAnalysisArtifactFromCache).not.toHaveBeenCalled();
    expect(subject.getHtmlReportAnalysisSectionsToGenerate).not.toHaveBeenCalled();
    expect(subject.getHtmlReportAnalysisArtifact).not.toHaveBeenCalled();
    expect(callAI).not.toHaveBeenCalled();
    expect(subject.writeSessionResultsAnalysisArtifactToCache).not.toHaveBeenCalled();
    expect(subject.setState).toHaveBeenCalledWith({
      htmlReportAnalysisError: 'Need at least one response.',
      htmlReportAnalysisInputSignature: 'blocked-input',
    });
    expect(subject.state.htmlReportAnalysisGenerating).toBe(false);
    expect(subject.state.htmlReportAnalysisError).toBe('Need at least one response.');
    expect(subject.state.htmlReportAnalysisInputSignature).toBe('blocked-input');

    const tree = subject.renderHtmlReportExportModal();
    const generateButton = findElement(
      tree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-html-report-generate-analysis'
    );
    expect(treeHasText(tree, 'Need at least one response.')).toBe(true);
    expect(generateButton?.props?.disabled).toBe(true);
    expect(generateButton?.props?.children).toBe('Generate Analysis Views');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('surfaces analysis cache write failures and allows a later retry at the write boundary', async () => {
    const subject = createSubject({
      network: { id: 84532 },
      sessionSlug: 'beta-session',
    });
    subject.getEffectiveSlug = jest.fn(() => 'beta-session');

    const artifact = createAnalysisArtifact('retry-input');
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({
      sessionResultsAnalysis: {},
    });
    const writeSpy = jest
      .spyOn(cacheScripts, 'writeCache')
      .mockRejectedValueOnce(new Error('analysis write failed'))
      .mockResolvedValueOnce(undefined);

    await expect(subject.writeSessionResultsAnalysisArtifactToCache(artifact)).rejects.toThrow(
      'analysis write failed'
    );
    await expect(subject.writeSessionResultsAnalysisArtifactToCache(artifact)).resolves.toBeUndefined();

    expect(writeSpy).toHaveBeenCalledTimes(2);
    expect(writeSpy).toHaveBeenLastCalledWith('analysisCache', 'beta-session', {
      sessionResultsAnalysis: {
        'sessionResultsAnalysis:v1:Base Sepolia:retry-input': artifact,
      },
    });
  });

  it('keeps analysis write failures in the generation status path and recovers without starting downloads', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (callAI as jest.Mock).mockResolvedValue(JSON.stringify({
      breakdown: {
        dimensions: [],
        groups: [],
        summary: { overview: 'Generated but not cached.' },
      },
    }));
    const subject = attachStateHarness(createSubject({
      account: '0x9999999999999999999999999999999999999999',
      loginComplete: true,
      sessionSlug: 'write-failure-session',
    }));
    subject.isHtmlReportDemoModeActive = jest.fn(() => false);
    subject.isHtmlReportExportAuthorized = jest.fn(() => true);
    subject.buildSessionResultsAnalysisPayloadForAi = jest.fn(() => ({
      aiPayload: { questions: [], responses: [], segmentDimensions: [] },
      eligibility: { eligible: true, reasons: [] },
      inputSignature: 'write-failure-input',
      participants: [],
    }));
    subject.readSessionResultsAnalysisArtifactFromCache = jest.fn(() => null);
    subject.getHtmlReportAnalysisSectionsToGenerate = jest.fn(() => ['breakdown']);
    subject.getHtmlReportAnalysisArtifact = jest.fn(() => null);
    subject.writeSessionResultsAnalysisArtifactToCache = jest
      .fn()
      .mockRejectedValueOnce(new Error('cache write failed'))
      .mockResolvedValueOnce(undefined);

    await subject.generateHtmlReportAnalysisViews();

    expect(callAI).toHaveBeenCalledTimes(1);
    expect(subject.writeSessionResultsAnalysisArtifactToCache).toHaveBeenCalledTimes(1);
    expect(subject.state.htmlReportAnalysisGenerating).toBe(false);
    expect(subject.state.htmlReportAnalysisError).toBe(
      'Unable to generate analysis views right now. Check AI settings and try again.'
    );
    expect(subject.state.htmlReportAnalysisProgress).toBe('');
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls.some((call) => call.some((arg) => (
      String(arg).includes('[SurveyResults.generateHtmlReportAnalysisViews] Failed to generate analysis')
    )))).toBe(true);
    expect(subject.state.htmlReportAnalysisArtifact).toBeNull();

    await subject.generateHtmlReportAnalysisViews();

    expect(callAI).toHaveBeenCalledTimes(2);
    expect(subject.writeSessionResultsAnalysisArtifactToCache).toHaveBeenCalledTimes(2);
    expect(subject.state.htmlReportAnalysisGenerating).toBe(false);
    expect(subject.state.htmlReportAnalysisError).toBe('');
    expect(subject.state.htmlReportAnalysisProgress).toBe('');
    expect(subject.state.htmlReportAnalysisInputSignature).toBe('write-failure-input');
    expect(subject.state.htmlReportAnalysisArtifact?.sections.breakdown.available).toBe(true);
    expect(downloadSessionResultsHtmlReport).not.toHaveBeenCalled();
    expect(downloadSessionResultsPdfReport).not.toHaveBeenCalled();
  });

  it('exports survey-response CSV from current individual payloads with metadata fallbacks and latest-row dedupe', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'survey',
      sessionName: 'Demo Session',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyViewMode: 'individuals',
      sbtFilteredResponses: [
        {
          responder: '0xAbC',
          timeStamp: '2024-01-01T00:00:00.000Z',
          response: JSON.stringify({
            responses: [
              {
                questionId: 'Q1',
                answer: { value: ['Alpha'], encrypted: false },
                additional: { value: 'Old note', encrypted: false },
                importance: 1,
              },
            ],
          }),
        },
        {
          responder: { address: '0xAbC' },
          response: {
            responses: [
              {
                questionID: 'q1',
                timeStamp: '2025-01-01T00:00:00.000Z',
                answer: { value: ['Alpha', 'Gamma'], encrypted: false, hash: 'hash-1' },
                additional: { value: 'Latest note', encrypted: false, hash: 'add-hash-1' },
                conviction: 7,
              },
            ],
          },
        },
        {
          responder: '0xDef',
          response: {
            responses: [
              {
                questionId: 'q2',
                timeStamp: '2025-02-02T00:00:00.000Z',
                answer: { value: '*', encrypted: true },
                additional: { value: '', encrypted: false },
                importance: 4,
              },
            ],
          },
        },
      ],
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Question One',
        type: 'multichoice',
        options: ['Alpha', 'Beta', 'Gamma'],
      },
      q2: {
        id: 'q2',
        prompt: 'Question Two',
        type: 'freeform',
      },
    }));

    const csv = subject.generateResponsesCSV();
    const lines = csv.split('\n');

    expect(lines[0]).toBe('responderAddress,questionID,questionPrompt,type,options,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp');
    expect(lines[1]).toBe('"0xAbC","q1","Question One","multichoice","Alpha;Beta;Gamma","7","Alpha, Gamma","hash-1","Latest note","false","false","add-hash-1","2025-01-01T00:00:00.000Z"');
    expect(lines[2]).toBe('"0xDef","q2","Question Two","freeform","","4","*","","","true","false","","2025-02-02T00:00:00.000Z"');
    expect(csv).not.toContain('Old note');
  });

  it('exports aggregate response CSV from mixed object/string payloads using current question metadata', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xAbC',
            response: JSON.stringify({
              questionId: 'Q1',
              timeStamp: '2024-03-01T00:00:00.000Z',
              answer: { value: ['Alpha'], encrypted: false },
              importance: 1,
            }),
          },
          {
            responder: { address: '0xAbC' },
            response: {
              questionID: 'q1',
              timeStamp: '2025-03-01T00:00:00.000Z',
              answer: { value: ['Alpha', 'Gamma'], encrypted: false, hash: 'ans-hash' },
              additional: { value: 'Current note', encrypted: false, hash: 'add-hash' },
              conviction: 9,
            },
          },
        ],
      },
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Aggregate Question',
        type: 'multichoice',
        options: ['Alpha', 'Beta', 'Gamma'],
      },
    }));

    const csv = subject.generateResponsesCSV();
    const lines = csv.split('\n');

    expect(lines[0]).toBe('questionID,questionPrompt,type,options,responderAddress,importance,answer,answerHash,additionalComments,answerEncrypted,additionalEncrypted,additionalHash,timestamp');
    expect(lines[1]).toBe('"q1","Aggregate Question","multichoice","Alpha;Beta;Gamma","0xAbC","9","Alpha, Gamma","ans-hash","Current note","false","false","add-hash","2025-03-01T00:00:00.000Z"');
    expect(lines).toHaveLength(2);
  });

  it('falls back to the aggregate bucket key when response payloads omit question IDs', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      sbtFilteredAggregatorQuestionResponses: {
        q2: [
          {
            responder: '0xDef',
            response: {
              timeStamp: '2025-04-01T00:00:00.000Z',
              answer: { value: 'Yes', encrypted: false },
              importance: 4,
            },
          },
        ],
      },
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q2: {
        id: 'q2',
        prompt: 'Fallback Question',
        type: 'multichoice',
        options: ['Yes', 'No'],
      },
    }));

    const csv = subject.generateResponsesCSV();
    const lines = csv.split('\n');

    expect(lines[1]).toBe('"q2","Fallback Question","multichoice","Yes;No","0xDef","4","Yes","","","false","","","2025-04-01T00:00:00.000Z"');
  });

  it('exports results JSON for the current filtered question view', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionSlug: 'demo',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyTitle: 'Demo Survey',
      totalQuestionsCount: 2,
      filteredQuestionsCount: 1,
      totalResponsesCount: 5,
      filteredResponsesCount: 2,
      filterState: {
        sbtFilter: {
          selectedTraits: ['builder'],
        },
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xabc', response: { answer: { value: 'Agree' } } }],
      },
      sbtFilteredResponses: [
        {
          responder: '0xabc',
          response: {
            responses: [{ questionId: 'q1', answer: { value: 'Agree' } }],
          },
        },
      ],
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'multichoice',
        tags: ['governance', 'ai'],
        options: ['Alpha', 'Beta'],
      },
    }));

    const exported = JSON.parse(subject.generateResultsJSON());

    expect(exported.sessionSlug).toBe('demo');
    expect(exported.viewMode).toBe('questions');
    expect(exported.surveyTitle).toBe('Demo Survey');
    expect(exported.counts).toEqual({
      totalQuestions: 2,
      filteredQuestions: 1,
      totalResponses: 5,
      filteredResponses: 2,
    });
    expect(exported.filterState).toEqual({
      sbtFilter: {
        selectedTraits: ['builder'],
      },
    });
    expect(exported.filteredQuestions).toEqual([
      {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'multichoice',
        tags: ['governance', 'ai'],
        options: ['Alpha', 'Beta'],
      },
    ]);
    expect(exported.filteredQuestionResponses.q1).toHaveLength(1);
    expect(exported.filteredResponses).toHaveLength(1);
    expect(typeof exported.exportedAt).toBe('string');
  });

  it('exports question-only JSON without response payloads', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
      sessionSlug: 'edge',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyTitle: 'Edge Survey',
      totalQuestionsCount: 3,
      filteredQuestionsCount: 2,
      totalResponsesCount: 7,
      filteredResponsesCount: 4,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xabc', response: { answer: { value: 'Agree' } } }],
      },
      sbtFilteredResponses: [
        {
          responder: '0xdef',
          response: {
            responses: [{ questionId: 'q2', answer: { value: 'Disagree' } }],
          },
        },
      ],
    };

    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'binary',
        tags: ['governance'],
        options: [],
      },
      q2: {
        id: 'Q2',
        prompt: 'Prompt Two',
        type: 'freeform',
        tags: ['safety'],
        options: [],
      },
    }));

    const exported = JSON.parse(subject.generateQuestionsJSON());

    expect(exported.filteredQuestions).toEqual([
      {
        id: 'Q1',
        prompt: 'Prompt One',
        type: 'binary',
        tags: ['governance'],
        options: [],
      },
      {
        id: 'Q2',
        prompt: 'Prompt Two',
        type: 'freeform',
        tags: ['safety'],
        options: [],
      },
    ]);
    expect(exported.filteredQuestionResponses).toBeUndefined();
    expect(exported.filteredResponses).toBeUndefined();
  });

  it('downloads current json exports through the active download path', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportType: 'json-questions-and-responses',
      alertMessage: '',
    };
    subject.getExportBaseFileName = jest.fn(() => 'contextEngine_questionResults');
    subject.generateResultsJSON = jest.fn(() => '{"ok":true}');

    const originalCreateObjectURL = window.URL.createObjectURL;
    const createObjectURLMock = jest.fn(() => 'blob:test-export');
    window.URL.createObjectURL = createObjectURLMock as any;
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const anchorClickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: any) => (
      String(tagName).toLowerCase() === 'a' ? anchor : originalCreateElement(tagName)
    )) as any);

    subject.downloadCSV();

    expect(subject.generateResultsJSON).toHaveBeenCalledTimes(1);
    expect(subject.setState).not.toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchor.getAttribute('href')).toBe('blob:test-export');
    expect(anchor.getAttribute('download')).toMatch(/^contextEngine_questionResults_.*\.json$/);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(subject.state.alertMessage).toBe('');

    createElementSpy.mockRestore();
    anchorClickSpy.mockRestore();
    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (window.URL as any).createObjectURL;
    }
  });

  it('routes the rendered download button through the export controller path', () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportAreaOpen: true,
      exportType: 'json-questions-and-responses',
      alertMessage: '',
      aggregateQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };
    subject.getExportBaseFileName = jest.fn(() => 'contextEngine_questionResults');
    subject.generateResultsJSON = jest.fn(() => '{"ok":true}');

    const originalCreateObjectURL = window.URL.createObjectURL;
    const createObjectURLMock = jest.fn(() => 'blob:test-export');
    window.URL.createObjectURL = createObjectURLMock as any;
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const anchorClickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: any) => (
      String(tagName).toLowerCase() === 'a' ? anchor : originalCreateElement(tagName)
    )) as any);

    renderSubjectTree(subject);
    fireEvent.click(screen.getByRole('button', { name: 'Download' }));

    expect(subject.generateResultsJSON).toHaveBeenCalledTimes(1);
    expect(subject.setState).not.toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchor.getAttribute('href')).toBe('blob:test-export');
    expect(anchor.getAttribute('download')).toMatch(/^contextEngine_questionResults_.*\.json$/);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);

    createElementSpy.mockRestore();
    anchorClickSpy.mockRestore();
    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (window.URL as any).createObjectURL;
    }
  });

  it('downloads question-only csv exports through the active download path', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportType: 'csv-questions',
      alertMessage: '',
    };
    subject.getExportBaseFileName = jest.fn(() => 'contextEngine_filteredQuestions');
    subject.generateQuestionsCSV = jest.fn(() => '"questionID","prompt","type","tags","options"\n"q1","Prompt","binary","",""');

    const originalCreateObjectURL = window.URL.createObjectURL;
    const createObjectURLMock = jest.fn(() => 'blob:test-export');
    window.URL.createObjectURL = createObjectURLMock as any;
    const appendChildSpy = jest.spyOn(document.body, 'appendChild');
    const removeChildSpy = jest.spyOn(document.body, 'removeChild');
    const originalCreateElement = document.createElement.bind(document);
    const anchor = originalCreateElement('a');
    const anchorClickSpy = jest.spyOn(anchor, 'click').mockImplementation(() => {});
    const createElementSpy = jest.spyOn(document, 'createElement').mockImplementation(((tagName: any) => (
      String(tagName).toLowerCase() === 'a' ? anchor : originalCreateElement(tagName)
    )) as any);

    subject.downloadCSV();

    expect(subject.generateQuestionsCSV).toHaveBeenCalledTimes(1);
    expect(subject.setState).not.toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(anchor.getAttribute('href')).toBe('blob:test-export');
    expect(anchor.getAttribute('download')).toMatch(/^contextEngine_filteredQuestions_.*\.csv$/);
    expect(anchorClickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(removeChildSpy).toHaveBeenCalledWith(anchor);
    expect(subject.state.alertMessage).toBe('');

    createElementSpy.mockRestore();
    anchorClickSpy.mockRestore();
    removeChildSpy.mockRestore();
    appendChildSpy.mockRestore();
    if (originalCreateObjectURL) {
      window.URL.createObjectURL = originalCreateObjectURL;
    } else {
      delete (window.URL as any).createObjectURL;
    }
  });

  it('rejects unknown export types through the invalid-export fallback', () => {
    const subject = attachStateHarness(createSubject({
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      exportType: 'Legacy Removed Export',
    };

    subject.downloadCSV();

    expect(subject.state.alertMessage).toBe('Invalid export type selected.');
  });
});
