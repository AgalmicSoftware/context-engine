// Remaining broad SurveyResults coverage owns pure count helpers and display-helper constants.
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
import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';
import SurveyResultsModalHeader from './SurveyResultsModalHeader';
import SurveyResultsQuestionListCard from './SurveyResultsQuestionListCard';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import * as sessionScanScopeModule from '../../utilities/session/sessionScanScope.js';
import { resolveSurveyResultsQuestionReadScope } from './surveyResultsSessionResolution.js';
import { sbtBasePath } from '../../utilities/ui/terminology.js';

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

const getSyncStatusNodeFromSubject = (subject: any): TreeNode => {
  const tree = subject.render();
  const headerNode = findElement(
    tree,
    (element) => element?.props?.syncStatusNode
  );
  return headerNode?.props?.syncStatusNode;
};

describe('countQuestionModeResponses', () => {
  it('excludes blank freeform responses from question-mode totals', () => {
    const aggregatorByQuestion = {
      Q1: [
        { response: { answer: { value: '   ' } } },
        { response: { answer: { value: 'Visible freeform answer' } } },
      ],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(countQuestionModeResponses(aggregatorByQuestion, questionLookup)).toBe(1);
  });

  it('keeps blank responses for non-freeform question types', () => {
    const aggregatorByQuestion = {
      q2: [
        { response: { answer: { value: '   ' } } },
        { response: { answer: { value: 'Agree' } } },
      ],
    };
    const questionLookup = {
      q2: { type: 'binary' },
    };

    expect(countQuestionModeResponses(aggregatorByQuestion, questionLookup)).toBe(2);
  });
});

describe('hasAnyCountableSurveyAnswer', () => {
  it('returns false for freeform responses that are only blank answers', () => {
    const parsedSurveyResponse = {
      responses: [
        { questionID: 'q1', answer: { value: '   ' } },
      ],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, questionLookup)).toBe(false);
  });

  it('keeps encrypted placeholders countable for freeform answers', () => {
    const parsedSurveyResponse = {
      responses: [
        { questionID: 'q1', answer: { value: '*', encrypted: true } },
      ],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, questionLookup)).toBe(true);
  });

  it('treats answers as countable when question metadata is unavailable', () => {
    const parsedSurveyResponse = {
      responses: [
        { questionID: 'q1', answer: { value: '   ' } },
      ],
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, {})).toBe(true);
  });
});

describe('SurveyResults display helpers', () => {
  it('builds aggregator classes and table icon styles', () => {
    expect(SURVEY_RESULTS_CLICKABLE_ICON_STYLE).toEqual({ cursor: 'pointer' });
    expect(SURVEY_RESULTS_METADATA_MISSING_STYLE).toEqual({
      fontStyle: 'italic',
      color: '#bbb',
      padding: '1rem',
    });
    expect(SURVEY_RESULTS_TABLE_CELL_STYLE).toEqual({ textAlign: 'center' });
    expect(SURVEY_RESULTS_SORTABLE_HEADER_STYLE).toEqual({
      textAlign: 'center',
      cursor: 'pointer',
    });
    expect(SURVEY_RESULTS_TABLE_BOOKMARK_STYLE).toEqual({
      marginRight: '6px',
      cursor: 'pointer',
    });
    expect(SURVEY_RESULTS_SYNC_REMAINING_SPINNER_STYLE).toEqual({ marginLeft: '6px' });
    expect(SURVEY_RESULTS_SURVEY_BOOKMARK_STYLE).toEqual({
      marginLeft: '8px',
      cursor: 'pointer',
    });
    expect(SURVEY_RESULTS_DOCUMENT_LINK_ICON_STYLE).toEqual({ marginRight: 4 });
    expect(SURVEY_RESULTS_MINI_BAR_SPINNER_STYLE).toEqual({ marginRight: '6px' });
    expect(SURVEY_RESULTS_MINI_PROGRESS_STYLE).toEqual({ minWidth: '100px' });
    expect(SURVEY_RESULTS_TRAILING_LABEL_STYLE).toEqual({ marginLeft: '10px' });
    expect(buildSurveyResultsAggregatorPanelClassName(styles)).toBe(
      `${styles.surveyResultsAggregatorPanel} ${styles.surveyResultsAggregatorText}`
    );
    expect(buildSurveyResultsMultichoiceOptionClassName(styles)).toBe(
      `${styles.surveyResultsFreeformAnswer} ${styles.surveyResultsMultichoiceOption}`
    );
    expect(resolveSurveyResultsSyncDetailsStyle(true)).toEqual({ display: 'block' });
    expect(resolveSurveyResultsSyncDetailsStyle(false)).toEqual({ display: undefined });
    expect(resolveSurveyResultsToggleKnobStyle(true)).toEqual({
      left: '31px',
      backgroundColor: '#4caf50',
    });
    expect(resolveSurveyResultsToggleKnobStyle(false)).toEqual({
      left: '1px',
      backgroundColor: '#fff',
    });
  });
});

describe('SurveyResults question-list display wiring', () => {
  it('passes empty question-list display state without rendering the question table', () => {
    const subject = createSubject({ isOpen: true });
    const renderQuestionIDsTableSpy = jest.spyOn(subject, 'renderQuestionIDsTable');
    subject.state = {
      ...subject.state,
      activeQuestionToggles: {
        ...subject.state.activeQuestionToggles,
        __questionList__: true,
      },
      aggregatorQuestionResponses: {},
      filterLoading: false,
      sbtFilteredAggregatorQuestionResponses: {},
      surveyViewMode: 'aggregate',
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      viewMode: 'questions',
    };

    const questionListCard = findElement(
      subject.render(),
      (element) => element?.type === SurveyResultsQuestionListCard
    );

    expect(questionListCard?.props?.showEmptyState).toBe(true);
    expect(questionListCard?.props?.questionTableNode).toBeNull();
    expect(renderQuestionIDsTableSpy).not.toHaveBeenCalled();
  });

  it('keeps loading question-list display active without showing the empty state', () => {
    const subject = createSubject({ isOpen: true });
    const renderQuestionIDsTableSpy = jest.spyOn(subject, 'renderQuestionIDsTable').mockReturnValue(<table><tbody /></table>);
    subject.state = {
      ...subject.state,
      activeQuestionToggles: {
        ...subject.state.activeQuestionToggles,
        __questionList__: true,
      },
      filterLoading: true,
      sbtFilteredAggregatorQuestionResponses: {},
      viewMode: 'questions',
    };

    const questionListCard = findElement(
      subject.render(),
      (element) => element?.type === SurveyResultsQuestionListCard
    );

    expect(questionListCard?.props?.showEmptyState).toBe(false);
    expect(questionListCard?.props?.questionTableNode?.type).toBe('table');
    expect(renderQuestionIDsTableSpy).toHaveBeenCalledTimes(1);
  });
});

describe('SurveyResults cache/readiness shell wiring', () => {
  it('preserves selected survey identity outputs for the header and individual response list', () => {
    const surveyId = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const subject = createSubject({
      activeSessionSlug: 'edge',
      isOpen: true,
      isResponsesCacheReady: true,
      isSurveyCacheReady: true,
      sessionSlug: 'controller-session',
      surveyId,
      viewMode: 'survey',
    });
    subject.state = {
      ...subject.state,
      networkLatestBlock: 90,
      surveyId,
      surveyLocalBlock: 90,
      surveyResultsHydrated: true,
      surveyTitle: 'Controller Input Survey',
      surveyViewMode: 'individuals',
      viewMode: 'survey',
      responses: [
        {
          responder: '0x1111111111111111111111111111111111111111',
          response: { responses: [] },
          surveyId,
        },
      ],
      sbtFilteredResponses: [
        {
          responder: '0x1111111111111111111111111111111111111111',
          response: { responses: [] },
          surveyId,
        },
      ],
    };

    const tree = subject.render();
    const header = findElement(
      tree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const individualList = findElement(
      tree,
      (element) => element?.type === SurveyResultsIndividualResponsesList
    );

    expect(header?.props).toEqual(expect.objectContaining({
      currentSurveyId: surveyId,
      effectiveSlug: 'controller-session',
      surveyTitle: 'Controller Input Survey',
      viewMode: 'survey',
    }));
    expect(individualList?.props).toEqual(expect.objectContaining({
      currentSurveyId: surveyId,
      effectiveSlug: 'controller-session',
      filterLoading: false,
      responses: [
        {
          responder: '0x1111111111111111111111111111111111111111',
          response: { responses: [] },
          surveyId,
        },
      ],
    }));
  });

  it('preserves question filter, cache readiness, filter loading, and polling inputs for controller extraction', () => {
    const filterState = { text: 'controller input', sbtFilter: { selectedSBTGroups: ['group-a'] } };
    const subject = createSubject({
      activeSessionSlug: 'edge',
      defaultTags: ['alpha', 'beta'],
      isOpen: true,
      isQuestionCacheReady: false,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      questionResponsesNonce: 'responses-nonce-1',
      questionsCacheNonce: 'questions-nonce-2',
      sbtCacheRevision: 'sbt-revision-3',
      viewMode: 'questions',
    });
    subject.handleManualRefresh = jest.fn();
    subject.state = {
      ...subject.state,
      filterLoading: true,
      filterState,
      networkLatestBlock: 100,
      questionLocalBlock: 40,
      questionResponses: {
        q1: {
          '0xaaa': { answer: { value: 'Visible answer' } },
        },
      },
      refreshTargetQuestionBlock: 80,
      refreshTargetResponseBlock: 70,
      responseLocalBlock: 20,
      showQuestionFilter: true,
      viewMode: 'questions',
    };

    const tree = subject.render();
    const questionFilter = findElement(
      tree,
      (element) => element?.props?.resultsMode === true && element?.props?.creatorAndResponderMode === true
    );
    const syncStatusNode = getSyncStatusNodeFromSubject(subject);
    const quickRefresh = findElement(
      syncStatusNode,
      (element) => element?.props?.['aria-label'] === 'Refresh sync data'
    );

    const questionFilterProps = questionFilter?.props || {};
    expect({
      activeSessionSlug: questionFilterProps.activeSessionSlug,
      currentSurveyIdForUrl: questionFilterProps.currentSurveyIdForUrl,
      currentViewModeForUrl: questionFilterProps.currentViewModeForUrl,
      defaultTags: questionFilterProps.defaultTags,
      filterState: questionFilterProps.filterState,
      isQuestionCacheReady: questionFilterProps.isQuestionCacheReady,
      isSBTCacheReady: questionFilterProps.isSBTCacheReady,
      questionResponsesNonce: questionFilterProps.questionResponsesNonce,
      questionsCacheNonce: questionFilterProps.questionsCacheNonce,
      sbtCacheRevision: questionFilterProps.sbtCacheRevision,
      storageKeyPrefix: questionFilterProps.storageKeyPrefix,
    }).toEqual({
      activeSessionSlug: 'edge',
      currentSurveyIdForUrl: null,
      currentViewModeForUrl: 'questions',
      defaultTags: ['alpha', 'beta'],
      filterState,
      isQuestionCacheReady: false,
      isSBTCacheReady: true,
      questionResponsesNonce: 'responses-nonce-1',
      questionsCacheNonce: 'questions-nonce-2',
      sbtCacheRevision: 'sbt-revision-3',
      storageKeyPrefix: 'dg:filters:__scope__:demo|edge',
    });
    expect(questionFilter?.props?.setFilterLoading).toBe(subject.setFilterLoading);
    expect(renderToStaticMarkup(syncStatusNode)).toContain('Remaining Blocks: 40');
    expect(renderToStaticMarkup(syncStatusNode)).toContain('Remaining Blocks: 50');

    quickRefresh?.props?.onClick();

    expect(subject.handleManualRefresh).toHaveBeenCalledTimes(1);
  });

  it('shows the quick refresh action during missing-cache loading and dispatches the parent refresh handler', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.handleManualRefresh = jest.fn();
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      networkLatestBlock: 0,
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      syncDetailsOpen: false,
    };

    const tree = subject.render();
    const headerNode = findElement(
      tree,
      (element) => element?.props?.syncStatusNode
    );
    const syncStatusNode = headerNode?.props?.syncStatusNode;
    const quickRefresh = findElement(
      syncStatusNode,
      (element) => element?.props?.['aria-label'] === 'Refresh sync data'
    );

    expect(treeHasText(syncStatusNode, 'Loading...')).toBe(true);
    expect(quickRefresh).toBeTruthy();

    quickRefresh?.props?.onClick();

    expect(subject.handleManualRefresh).toHaveBeenCalledTimes(1);
  });

  it('hides quick refresh when results are in sync while keeping the detailed refresh action parent-owned', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.handleManualRefresh = jest.fn();
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      networkLatestBlock: 25,
      questionLocalBlock: 25,
      responseLocalBlock: 25,
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      syncDetailsOpen: true,
    };

    const tree = subject.render();
    const headerNode = findElement(
      tree,
      (element) => element?.props?.syncStatusNode
    );
    const syncStatusNode = headerNode?.props?.syncStatusNode;
    const quickRefresh = findElement(
      syncStatusNode,
      (element) => element?.props?.['aria-label'] === 'Refresh sync data'
    );
    const detailedRefresh = findElement(
      syncStatusNode,
      (element) => element?.props?.title === 'Refresh Data from Cache/Chain'
    );

    expect(treeHasText(syncStatusNode, 'In Sync')).toBe(true);
    expect(quickRefresh).toBeNull();
    expect(detailedRefresh).toBeTruthy();

    detailedRefresh?.props?.onClick();

    expect(subject.handleManualRefresh).toHaveBeenCalledTimes(1);
  });

  it('renders question-mode loading tracks from missing polling blocks', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.handleManualRefresh = jest.fn();
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      networkLatestBlock: 0,
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      syncDetailsOpen: true,
    };

    const syncStatusNode = getSyncStatusNodeFromSubject(subject);

    expect(treeHasText(syncStatusNode, 'Loading...')).toBe(true);
    expect(treeHasText(syncStatusNode, 'Questions:')).toBe(true);
    expect(treeHasText(syncStatusNode, 'Responses:')).toBe(true);
    expect(treeHasText(syncStatusNode, 'In Sync')).toBe(false);
    expect(findElement(
      syncStatusNode,
      (element) => element?.props?.['aria-label'] === 'Refresh sync data'
    )).toBeTruthy();
  });

  it('renders question and response tracks while question-mode polling is stale', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.handleManualRefresh = jest.fn();
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      networkLatestBlock: 100,
      questionLocalBlock: 80,
      responseLocalBlock: 70,
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      syncDetailsOpen: true,
    };
    subject._syncLoadingStartedAt = Date.now() - 15000;

    const syncStatusNode = getSyncStatusNodeFromSubject(subject);
    const markup = renderToStaticMarkup(syncStatusNode);

    expect(markup).toContain('Syncing...');
    expect(markup).toContain('Questions:');
    expect(markup).toContain('Remaining Blocks: 20 (Current: 80 / Latest: 100)');
    expect(markup).toContain('Responses:');
    expect(markup).toContain('Remaining Blocks: 30 (Current: 70 / Latest: 100)');
    expect(markup).toContain('Refresh Now');
    expect(findElement(
      syncStatusNode,
      (element) => element?.props?.['aria-label'] === 'Refresh sync data'
    )).toBeTruthy();
  });

  it('renders survey-mode readiness from the survey response track only', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      surveyId: '0xabc',
    });
    subject.handleManualRefresh = jest.fn();
    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: '0xabc',
      networkLatestBlock: 100,
      questionLocalBlock: 100,
      responseLocalBlock: 100,
      surveyLocalBlock: 40,
      refreshTargetQuestionBlock: 0,
      refreshTargetResponseBlock: 0,
      refreshTargetSurveyBlock: 0,
      syncDetailsOpen: true,
    };

    const syncStatusNode = getSyncStatusNodeFromSubject(subject);
    const markup = renderToStaticMarkup(syncStatusNode);

    expect(markup).toContain('Syncing...');
    expect(markup).not.toContain('Questions:');
    expect(markup).toContain('Responses:');
    expect(markup).toContain('Remaining Blocks: 60 (Current: 40 / Latest: 100)');
    expect(markup).toContain('Refresh Now');
  });

  it('keeps long-sync gating from changing status copy or refresh availability', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(20000);
    try {
      const subject = createSubject({
        isOpen: true,
        viewMode: 'questions',
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
        networkLatestBlock: 100,
        questionLocalBlock: 90,
        responseLocalBlock: 100,
        syncDetailsOpen: true,
      };
      subject._syncLoadingStartedAt = 4000;

      let syncStatusNode = getSyncStatusNodeFromSubject(subject);

      expect(renderToStaticMarkup(syncStatusNode)).toContain('Syncing...');
      expect(findElement(
        syncStatusNode,
        (element) => element?.props?.['aria-label'] === 'Refresh sync data'
      )).toBeTruthy();

      subject.state = {
        ...subject.state,
        questionLocalBlock: 100,
      };
      syncStatusNode = getSyncStatusNodeFromSubject(subject);

      expect(renderToStaticMarkup(syncStatusNode)).toContain('In Sync');
      expect(findElement(
        syncStatusNode,
        (element) => element?.props?.['aria-label'] === 'Refresh sync data'
      )).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('passes stable missing-metadata fallbacks to selected question summaries without reading cache again', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { id: 'q1', prompt: 'Cached question' },
    }));
    subject.state = {
      ...subject.state,
      activeQuestionToggles: {
        ...subject.state.activeQuestionToggles,
        'Q-missing': true,
      },
    };

    const summary = subject.renderQuestionSummary(
      'Q-missing',
      [{ responder: '0xabc', response: { answer: { value: 'Fallback answer' } } }],
      {}
    ) as React.ReactElement;
    const defaultSummary = summary.props.renderDefaultSummary();

    expect(summary.props.metadataMissing).toBe(true);
    expect(summary.props.questionPrompt).toBe('Unknown question: Q-missing');
    expect(defaultSummary.props.question).toEqual({
      id: 'Q-missing',
      prompt: 'Unknown question',
    });
    expect(subject.getNetworkQuestionsForCurrentContext).not.toHaveBeenCalled();
  });

  it('reads cached question metadata for selected summaries when no render cache is preloaded', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    const cachedQuestion = {
      id: 'q-ready',
      prompt: 'Ready cached prompt',
      sessionSlug: 'edge',
      type: 'freeform',
    };
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      'q-ready': cachedQuestion,
    }));
    subject.getStableFallbackQuestion = jest.fn(subject.getStableFallbackQuestion);
    subject.setState = jest.fn();
    subject.queueResultsRefresh = jest.fn();
    subject.fetchResponses = jest.fn();
    subject.handleDecryptLockedResponses = jest.fn();
    subject.generateResponsesCSV = jest.fn();
    subject.generateResultsJSON = jest.fn();

    const writeSpy = jest.spyOn(cacheScripts, 'writeCache');
    try {
      const summary = subject.renderQuestionSummary(
        'Q-Ready',
        [],
        null
      ) as React.ReactElement;
      const defaultSummary = summary.props.renderDefaultSummary();

      expect(subject.getNetworkQuestionsForCurrentContext).toHaveBeenCalledTimes(1);
      expect(summary.props.metadataMissing).toBe(false);
      expect(summary.props.questionPrompt).toBe('Ready cached prompt');
      expect(defaultSummary.props.question).toBe(cachedQuestion);
      expect(subject.getStableFallbackQuestion).not.toHaveBeenCalled();
      expect(subject.setState).not.toHaveBeenCalled();
      expect(subject.queueResultsRefresh).not.toHaveBeenCalled();
      expect(subject.fetchResponses).not.toHaveBeenCalled();
      expect(subject.handleDecryptLockedResponses).not.toHaveBeenCalled();
      expect(subject.generateResponsesCSV).not.toHaveBeenCalled();
      expect(subject.generateResultsJSON).not.toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
    }
  });

  it('falls back for selected summaries when the cached metadata read is empty without side effects', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
    });
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({}));
    subject.setState = jest.fn();
    subject.queueResultsRefresh = jest.fn();
    subject.fetchResponses = jest.fn();
    subject.handleDecryptLockedResponses = jest.fn();
    subject.generateResponsesCSV = jest.fn();
    subject.generateResultsJSON = jest.fn();

    const writeSpy = jest.spyOn(cacheScripts, 'writeCache');
    try {
      const summary = subject.renderQuestionSummary(
        'Q-Empty',
        [],
        undefined
      ) as React.ReactElement;
      const defaultSummary = summary.props.renderDefaultSummary();

      expect(subject.getNetworkQuestionsForCurrentContext).toHaveBeenCalledTimes(1);
      expect(summary.props.metadataMissing).toBe(true);
      expect(summary.props.questionPrompt).toBe('Unknown question: Q-Empty');
      expect(defaultSummary.props.question).toEqual({
        id: 'Q-Empty',
        prompt: 'Unknown question',
      });
      expect(subject.setState).not.toHaveBeenCalled();
      expect(subject.queueResultsRefresh).not.toHaveBeenCalled();
      expect(subject.fetchResponses).not.toHaveBeenCalled();
      expect(subject.handleDecryptLockedResponses).not.toHaveBeenCalled();
      expect(subject.generateResponsesCSV).not.toHaveBeenCalled();
      expect(subject.generateResultsJSON).not.toHaveBeenCalled();
      expect(writeSpy).not.toHaveBeenCalled();
    } finally {
      writeSpy.mockRestore();
    }
  });
});
