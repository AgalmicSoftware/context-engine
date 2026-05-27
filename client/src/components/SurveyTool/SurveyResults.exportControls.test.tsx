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

const attachStateHarness = (subject: any): any => {
  subject.setState = jest.fn((updater, cb) => {
    const patch = typeof updater === 'function' ? updater(subject.state, subject.props) : updater;
    subject.state = { ...subject.state, ...(patch || {}) };
    if (typeof cb === 'function') cb();
    return patch;
  });
  return subject;
};

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
    const toggleSwitch = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('toggleSwitch')
    );
    expect(toggleSwitch).toBeTruthy();

    expect(treeHasText(tree, 'Individual')).toBe(true);
    expect(treeHasText(tree, 'Aggregate')).toBe(true);
    expect(treeHasText(tree, 'Individuals View')).toBe(false);
    expect(treeHasText(tree, 'Aggregate View')).toBe(false);
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
