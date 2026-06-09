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
import {
  SurveyResultsFreeformAggregatorSummary,
  SurveyResultsMultichoiceAggregatorSummary,
} from './SurveyResultsAggregatorSummaries';
import {
  SurveyResultsAggregatorEmptyState,
  SurveyResultsFreeformSummaryDisplay,
  SurveyResultsMultichoiceDistributionDisplay,
} from './SurveyResultsAggregatorSummaryDisplay';
import SurveyResultsFilterSummary from './SurveyResultsFilterSummary';
import SurveyResultsIndividualResponseBody from './SurveyResultsIndividualResponseBody';
import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';
import SurveyResultsModalHeader from './SurveyResultsModalHeader';
import SurveyResultsReportSurface from './SurveyResultsReportSurface';
import { countSurveyResultsViewableResponses } from './SurveyResultsQuestionSummary';
import SurveyResultsQuestionSummaryCard from './SurveyResultsQuestionSummaryCard';
import SurveyResultsQuestionSummariesList from './SurveyResultsQuestionSummariesList';
import SurveyResultsQuestionSummariesPanel from './SurveyResultsQuestionSummariesPanel';
import SurveyResultsQuestionTable from './SurveyResultsQuestionTable';
import {
  buildSurveyResultsFreeformSummaryModel,
  buildSurveyResultsMultichoiceSummaryModel,
  resolveSurveyResultsSummaryQuestionType,
} from './surveyResultsSummaryModels';

type TreeNode = any;
type TreePredicate = (node: TreeNode) => boolean;
type SurveyResultsProps = Record<string, any>;
const cacheScripts: any = cacheScriptsModule;
const sessionScanScope: any = sessionScanScopeModule;
const RESOLVABLE_TREE_COMPONENTS = new Set([
  SurveyResultsReportSurface,
  SurveyResultsAggregatorEmptyState,
  SurveyResultsFreeformSummaryDisplay,
  SurveyResultsFilterSummary,
  SurveyResultsIndividualResponseBody,
  SurveyResultsMultichoiceDistributionDisplay,
  SurveyResultsQuestionSummariesPanel,
]);
const resolvedTreeComponentCache = new WeakMap();

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
    if (RESOLVABLE_TREE_COMPONENTS.has(current.type)) {
      if (!resolvedTreeComponentCache.has(current)) {
        resolvedTreeComponentCache.set(current, current.type(current.props || {}));
      }
      stack.push(resolvedTreeComponentCache.get(current));
      continue;
    }
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
  if (RESOLVABLE_TREE_COMPONENTS.has(node.type)) {
    if (!resolvedTreeComponentCache.has(node)) {
      resolvedTreeComponentCache.set(node, node.type(node.props || {}));
    }
    collectTreeNodes(resolvedTreeComponentCache.get(node), predicate, acc);
  }
  return collectTreeNodes(node?.props?.children, predicate, acc);
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
  if (RESOLVABLE_TREE_COMPONENTS.has(node.type)) {
    if (!resolvedTreeComponentCache.has(node)) {
      resolvedTreeComponentCache.set(node, node.type(node.props || {}));
    }
    return treeHasText(resolvedTreeComponentCache.get(node), text);
  }
  return treeHasText(node?.props?.children, text);
};

describe('SurveyResults multichoice aggregator summary', () => {
  it('renders the empty multichoice state inside the SurveyResults-only aggregator panel', () => {
    const tree = SurveyResultsMultichoiceAggregatorSummary({
      summary: buildSurveyResultsMultichoiceSummaryModel([], {
          id: 'q1',
          type: 'multichoice',
          options: ['Alpha', 'Beta'],
        }),
    });
    const panel = findElement(
      tree,
      (element) => typeof element?.props?.className === 'string' && element.props.className.includes('surveyResultsAggregatorPanel')
    );

    expect(panel).toBeTruthy();
    expect(treeHasText(tree, 'No multichoice responses available.')).toBe(true);
  });

  it('renders multichoice question cards with the SurveyResults-only freeform-style summary rows', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      activeQuestionToggles: { q1: true },
      surveyId: 'survey-1',
    };

    const markup = renderToStaticMarkup(subject.renderQuestionSummary(
      'q1',
      [
        {
          responder: '0xaaa',
          timestamp: 1,
          response: { type: 'multichoice', answer: { value: ['Alpha'] } },
        },
        {
          responder: '0xaaa',
          timestamp: 2,
          response: { type: 'multichoice', answer: { value: ['Alpha', 'Beta'] } },
        },
        {
          responder: '0xbbb',
          timestamp: 1,
          response: { type: 'multichoice', answer: { value: ['Alpha'] } },
        },
      ],
      {
        q1: {
          id: 'q1',
          prompt: 'Pick some options',
          type: 'multichoice',
          options: ['Alpha', 'Beta', 'Gamma'],
        },
      }
    ));

    expect(markup).toContain('2 total responders to this multichoice question.');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('2 (100.00%)');
    expect(markup).toContain('Beta');
    expect(markup).toContain('1 (50.00%)');
    expect(markup).toContain('Gamma');
    expect(markup).toContain('0 (0.00%)');
  });

  it('keeps the SurveyResults multichoice summary renderer when question metadata is still missing', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      activeQuestionToggles: { q1: true },
      surveyId: 'survey-1',
    };

    const markup = renderToStaticMarkup(subject.renderQuestionSummary(
      'q1',
      [
        {
          responder: '0xaaa',
          timestamp: 2,
          response: { type: 'multichoice', answer: { value: ['Alpha', 'Beta'] } },
        },
      ],
      {}
    ));

    expect(markup).toContain('No metadata found for this question in local cache.');
    expect(markup).toContain('1 total responders to this multichoice question.');
    expect(markup).toContain('Alpha');
    expect(markup).toContain('Beta');
  });

  it('shows the deduped latest-responder count in the question card header', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      activeQuestionToggles: { q1: true },
      surveyId: 'survey-1',
    };

    const tree = subject.renderQuestionSummary(
      'q1',
      [
        {
          responder: '0xaaa',
          timestamp: 1,
          response: { type: 'multichoice', answer: { value: ['Alpha'] } },
        },
        {
          responder: '0xaaa',
          timestamp: 2,
          response: { type: 'multichoice', answer: { value: ['Alpha', 'Beta'] } },
        },
      ],
      {
        q1: {
          id: 'q1',
          prompt: 'Pick some options',
          type: 'multichoice',
          options: ['Alpha', 'Beta'],
        },
      }
    );

    const summaryCard = findElement(
      tree,
      (element) => element?.type === SurveyResultsQuestionSummaryCard
    );

    expect(summaryCard?.props?.viewableResponsesCount).toBe(1);
  });
});

describe('SurveyResults selected result display wiring', () => {
  it('renders a selected question card with decrypted override data and header handlers', () => {
    const lockedResponse = {
      questionID: 'q1',
      type: 'freeform',
      answer: { encrypted: true, locked: true, value: '*' },
      additional: { encrypted: true, locked: true, value: '*' },
    };
    const subject = createSubject();
    const responseKey = subject.getLockedResponseKey({
      responder: '0xaaa',
      questionId: 'q1',
      surveyId: 'survey-1',
      response: lockedResponse,
    });
    subject.toggleQuestionBookmark = jest.fn();
    subject.toggleQuestionSummary = jest.fn();
    subject.state = {
      ...subject.state,
      activeQuestionToggles: { q1: true },
      bookmarkedQuestionIDs: ['q1'],
      decryptedResponseOverrides: {
        [responseKey]: {
          additionalValue: 'Decrypted note',
          answerValue: 'Decrypted answer',
        },
      },
      surveyId: 'survey-1',
    };

    const tree = subject.renderQuestionSummary(
      'q1',
      [{ responder: '0xaaa', timestamp: 1, response: lockedResponse }],
      {
        q1: {
          id: 'q1',
          prompt: 'Explain the decision',
          type: 'freeform',
        },
      }
    );

    const summaryCard = findElement(
      tree,
      (element) => element?.type === SurveyResultsQuestionSummaryCard
    );
    expect(summaryCard?.props).toEqual(expect.objectContaining({
      bookmarked: true,
      isActive: true,
      metadataMissing: false,
      questionPrompt: 'Explain the decision',
      resolvedQuestionType: 'freeform',
      viewableResponsesCount: 1,
    }));

    summaryCard?.props?.onToggleBookmark();
    summaryCard?.props?.onToggleSummary();
    expect(subject.toggleQuestionBookmark).toHaveBeenCalledWith('q1');
    expect(subject.toggleQuestionSummary).toHaveBeenCalledWith('q1');

    const defaultSummary = summaryCard?.props?.renderDefaultSummary();
    const singleQuestionResponse = findElement(
      defaultSummary,
      (element) => element?.props?.aggregatorResponseMode === true
    );

    expect(singleQuestionResponse?.props?.allResponses[0].response.answer.value).toBe('Decrypted answer');
    expect(singleQuestionResponse?.props?.allResponses[0].response.additional.value).toBe('Decrypted note');
  });

  it('wires question-table view, sort, and bookmark controls without fetching data', () => {
    const subject = attachStateHarness(createSubject());
    subject.toggleQuestionBookmark = jest.fn();
    subject.changeQuestionIdSort = jest.fn();
    subject.scrollToQuestion = jest.fn();
    subject.hasEffectiveNetworkId = jest.fn(() => true);
    subject.getEffectiveSlug = jest.fn(() => 'session-one');
    subject.state = {
      ...subject.state,
      activeQuestionToggles: {},
      bookmarkedQuestionIDs: [],
      questionIdSortAsc: true,
      questionIdSortBy: '',
    };

    const tree = subject.renderQuestionIDsTable(
      {
        q1: [{ responder: '0xaaa', response: { answer: { value: 'Visible answer' } } }],
      },
      {
        q1: {
          prompt: 'Question one',
          sessionSlug: 'session-one',
          type: 'freeform',
        },
      }
    );
    const table = findElement(
      tree,
      (element) => element?.type === SurveyResultsQuestionTable
    );

    expect(table?.props?.entries).toEqual([
      expect.objectContaining({
        prompt: 'Question one',
        questionId: 'q1',
        responsesCount: 1,
        sessionSlug: 'session-one',
        type: 'freeform',
      }),
    ]);

    table?.props?.onToggleQuestionBookmark('q1');
    table?.props?.onSort('prompt');
    table?.props?.onViewQuestion('q1');

    expect(subject.toggleQuestionBookmark).toHaveBeenCalledWith('q1');
    expect(subject.changeQuestionIdSort).toHaveBeenCalledWith('prompt');
    expect(subject.state.activeQuestionToggles.q1).toBe(true);
    expect(subject.scrollToQuestion).toHaveBeenCalledWith('q1');
  });

  it('routes aggregate, question, and individual modes to the correct result panels', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
    });
    subject.getScopedQuestionNetworkDataSync = jest.fn(() => ({
      questions: {
        q1: {
          id: 'q1',
          prompt: 'Question one',
          type: 'freeform',
        },
      },
      questionResponses: {},
      questionsLatestBlock: 1,
      questionResponsesLatestBlock: 1,
    }));
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      questionResultsHydrated: true,
      sbtFilteredAggregatorQuestionResponses: {
        q1: [{ responder: '0xaaa', response: { answer: { value: 'Question answer' } } }],
      },
    };

    const questionList = findElement(
      subject.render(),
      (element) => element?.type === SurveyResultsQuestionSummariesList
    );
    expect(questionList?.props?.entries).toEqual([
      ['q1', [{ responder: '0xaaa', response: { answer: { value: 'Question answer' } } }]],
    ]);

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: 'survey-1',
      surveyResultsHydrated: true,
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {
        q2: [{ responder: '0xbbb', response: { answer: { value: 'Aggregate answer' } } }],
      },
    };

    const aggregateList = findElement(
      subject.render(),
      (element) => element?.type === SurveyResultsQuestionSummariesList
    );
    expect(aggregateList?.props?.entries).toEqual([
      ['q2', [{ responder: '0xbbb', response: { answer: { value: 'Aggregate answer' } } }]],
    ]);

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId: 'survey-1',
      surveyViewMode: 'individuals',
      responses: [{ responder: '0xccc', surveyId: 'survey-1', response: { responses: [] } }],
      sbtFilteredResponses: [{ responder: '0xccc', surveyId: 'survey-1', response: { responses: [] } }],
    };

    const individualList = findElement(
      subject.render(),
      (element) => element?.type === SurveyResultsIndividualResponsesList
    );
    const summariesList = findElement(
      subject.render(),
      (element) => element?.type === SurveyResultsQuestionSummariesList
    );
    expect(individualList?.props?.responses).toEqual([
      { responder: '0xccc', surveyId: 'survey-1', response: { responses: [] } },
    ]);
    expect(summariesList).toBeNull();
  });
});

describe('SurveyResults question table counts', () => {
  it('dedupes the question-table response count by responder before sorting/display', () => {
    const subject = createSubject();
    subject.state = {
      ...subject.state,
      questionIdSortBy: 'responses',
      questionIdSortAsc: true,
    };

    const entries = subject.getMemoizedQuestionTableEntries(
      {
        q1: [
          {
            responder: '0xaaa',
            timestamp: 1,
            response: { answer: { value: 'Old answer' } },
          },
          {
            responder: '0xaaa',
            timestamp: 2,
            response: { answer: { value: 'Latest answer' } },
          },
          {
            responder: '0xbbb',
            timestamp: 1,
            response: { answer: { value: 'Other responder' } },
          },
        ],
      },
      {
        q1: {
          prompt: 'Question one',
          type: 'freeform',
        },
      }
    );

    expect(entries).toEqual([
      expect.objectContaining({
        questionId: 'q1',
        responsesCount: 2,
      }),
    ]);
  });
});

describe('SurveyResults filter summary counts', () => {
  it('shows hydrated filtered counts while question-mode sync is still catching up', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 33,
      totalResponsesCount: 88,
      filteredQuestionsCount: 17,
      filteredResponsesCount: 29,
      questionResultsHydrated: true,
      networkLatestBlock: 100,
      questionLocalBlock: 40,
      responseLocalBlock: 25,
      questionResponses: {
        q1: {
          '0xaaa': { answer: { value: 'Visible answer' } },
        },
      },
      aggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
    };

    const tree = subject.render();
    const summaryNode = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterSummaryText')
    );
    const spinnerNodes = collectTreeNodes(
      summaryNode,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );

    expect(summaryNode).toBeTruthy();
    expect(treeHasText(summaryNode, '17')).toBe(true);
    expect(treeHasText(summaryNode, '29')).toBe(true);
    expect(spinnerNodes).toHaveLength(0);
  });

  it('keeps the summary spinners while counts have not hydrated yet', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredQuestionsCount: null,
      filteredResponsesCount: 0,
      questionResultsHydrated: false,
      networkLatestBlock: 100,
      questionLocalBlock: 0,
      responseLocalBlock: 0,
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
    };

    const tree = subject.render();
    const summaryNode = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterSummaryText')
    );
    const spinnerNodes = collectTreeNodes(
      summaryNode,
      (element) => element?.props?.icon?.iconName === 'spinner'
    );

    expect(summaryNode).toBeTruthy();
    expect(spinnerNodes).toHaveLength(2);
  });

  it('clamps stale filtered summary counts so they never exceed the visible totals', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 0,
      totalResponsesCount: 0,
      filteredQuestionsCount: 42,
      filteredResponsesCount: 7,
      questionResultsHydrated: true,
      networkLatestBlock: 100,
      questionLocalBlock: 100,
      responseLocalBlock: 100,
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
    };

    const tree = subject.render();
    const summaryNode = findElement(
      tree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('filterSummaryText')
    );
    expect(summaryNode).toBeTruthy();
    expect(treeHasText(summaryNode, 'Questions:')).toBe(true);
    expect(treeHasText(summaryNode, 'Responses:')).toBe(true);
    expect(treeHasText(summaryNode, '42')).toBe(false);
    expect(treeHasText(summaryNode, '7')).toBe(false);
  });
});

describe('SurveyResults sync status display', () => {
  it('wires sync-status display plans into the modal header progress panel', () => {
    const subject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      syncDetailsOpen: true,
      networkLatestBlock: 100,
      questionLocalBlock: 80,
      responseLocalBlock: 100,
      questionResultsHydrated: true,
      questionResponses: {},
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
    };

    const tree = subject.render();
    const headerNode = findElement(
      tree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const markup = renderToStaticMarkup(headerNode?.props?.syncStatusNode);

    expect(markup).toContain('Syncing...');
    expect(markup).toContain('Remaining Blocks: 20 (Current: 80 / Latest: 100)');
    expect(markup).toContain('In Sync (Current: 100 / Latest: 100)');
    expect(markup).toContain('Refresh Now');
  });
});

describe('SurveyResults demo results views', () => {
  it('shows the demo results switcher only for demo question results', () => {
    const nonDemoSubject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'edge',
    });
    nonDemoSubject.state = {
      ...nonDemoSubject.state,
      viewMode: 'questions',
    };

    const nonDemoTree = nonDemoSubject.render();
    const nonDemoHeader = findElement(
      nonDemoTree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const nonDemoMarkup = renderToStaticMarkup(nonDemoHeader);
    expect(nonDemoMarkup).not.toContain('ce-surveyresults-demo-view-nav');

    const demoSubject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'demo',
    });
    demoSubject.state = {
      ...demoSubject.state,
      viewMode: 'questions',
    };

    const demoTree = demoSubject.render();
    const demoHeader = findElement(
      demoTree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const demoMarkup = renderToStaticMarkup(demoHeader);
    const syncIndex = demoMarkup.indexOf('syncStatusContainer');
    const demoNavIndex = demoMarkup.indexOf('ce-surveyresults-demo-view-nav');

    expect(demoNavIndex).toBeGreaterThanOrEqual(0);
    expect(demoMarkup).toContain('Report');
    expect(demoMarkup).toContain('Breakdown');
    expect(demoMarkup).toContain('Atlas');
    expect(demoMarkup).toContain('Risk Matrix');
    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(demoNavIndex).toBeGreaterThan(syncIndex);
  });

  it('switches the demo modal surface from the top bar buttons and maps report to Polis', async () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'demo',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      totalQuestionsCount: 4,
      totalResponsesCount: 7,
      filteredQuestionsCount: 4,
      filteredResponsesCount: 7,
      questionResultsHydrated: true,
      networkLatestBlock: 50,
      questionLocalBlock: 50,
      responseLocalBlock: 50,
      questionResponses: {
        q1: {
          '0xaaa': { answer: { value: 'Visible answer' } },
        },
      },
      aggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
      sbtFilteredAggregatorQuestionResponses: {
        q1: [
          {
            responder: '0xaaa',
            response: { answer: { value: 'Visible answer' } },
          },
        ],
      },
    };

    const { rerender } = renderSubjectTree(subject);
    const rerenderSubject = () => rerender(
      <MemoryRouter>
        {subject.render()}
      </MemoryRouter>
    );

    const demoNav = screen.getByTestId('ce-surveyresults-demo-view-nav');
    expect(within(demoNav).getAllByRole('button').map((button) => button.textContent?.trim())).toEqual([
      'Report',
      'Atlas',
      'Breakdown',
      'Risk Matrix',
    ]);

    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).not.toBeInTheDocument();
    expect(mockPolisReport).not.toHaveBeenCalled();

    const reportButton = screen.getByTestId('ce-surveyresults-demo-view-report');
    const atlasButton = screen.getByTestId('ce-surveyresults-demo-view-atlas');
    const breakdownButton = screen.getByTestId('ce-surveyresults-demo-view-breakdown');
    const riskMatrixButton = screen.getByTestId('ce-surveyresults-demo-view-riskMatrix');

    expect(reportButton.compareDocumentPosition(atlasButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(atlasButton.compareDocumentPosition(breakdownButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(breakdownButton.compareDocumentPosition(riskMatrixButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(reportButton);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('ce-surveyresults-demo-surface-report')).toBeInTheDocument();
    });
    expect(mockPolisReport).toHaveBeenCalled();
    expect(subject.state.demoResultsViewMode).toBe('report');
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(reportButton);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).not.toBeInTheDocument();
    });
    expect(subject.state.demoResultsViewMode).toBe('raw');
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(breakdownButton);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('surveyresults-demo-breakdown-view')).toBeInTheDocument();
    });
    expect(subject.state.demoResultsViewMode).toBe('breakdown');
    expect(mockDemoAnalysisWorkspace).toHaveBeenLastCalledWith(
      expect.objectContaining({ sessionSlug: 'demo' })
    );

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-riskMatrix'));
    rerenderSubject();

    const riskMatrixView = await screen.findByTestId('surveyresults-demo-risk-matrix-view');
    expect(riskMatrixView).toBeInTheDocument();
    expect(riskMatrixView.closest(`.${styles.demoResultsRiskMatrixSurface}`)).not.toBeNull();
    expect(subject.state.demoResultsViewMode).toBe('riskMatrix');

    fireEvent.click(riskMatrixView);
    rerenderSubject();

    await waitFor(() => {
      expect(screen.getByTestId('surveyresults-demo-atlas-view')).toHaveTextContent('atlas-node-1');
    });
    expect(subject.state.demoResultsViewMode).toBe('atlas');
    expect(screen.getByTestId('ce-surveyresults-demo-view-atlas')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('resolveSurveyResultsSummaryQuestionType', () => {
  it('infers freeform from response.answer.type when question metadata is missing', () => {
    expect(resolveSurveyResultsSummaryQuestionType(undefined, [
      {
        response: { answer: { type: 'freeform', value: 'Legacy freeform answer' } },
      },
    ])).toBe('freeform');
  });

  it('normalizes legacy text response.answer.type to freeform when question metadata is null', () => {
    expect(resolveSurveyResultsSummaryQuestionType(null, [
      {
        response: { answer: { type: 'text', value: 'Legacy text answer' } },
      },
    ])).toBe('freeform');
  });
});

describe('countSurveyResultsViewableResponses', () => {
  it('excludes blank freeform answers and encrypted placeholders', () => {
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Visible freeform answer', encrypted: false } } },
      { response: { answer: { value: '*', encrypted: true } } },
    ];

    expect(countSurveyResultsViewableResponses(responses, 'freeform')).toBe(1);
  });

  it('does not exclude blank answers for non-freeform questions', () => {
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Agree', encrypted: false } } },
      { response: { answer: { value: '*', encrypted: true } } },
    ];

    expect(countSurveyResultsViewableResponses(responses, 'binary')).toBe(2);
  });

  it('uses question type when counting the same responses array', () => {
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Visible answer', encrypted: false } } },
    ];

    const freeformCount = countSurveyResultsViewableResponses(responses, 'freeform');
    const binaryCount = countSurveyResultsViewableResponses(responses, 'binary');

    expect(freeformCount).toBe(1);
    expect(binaryCount).toBe(2);
    expect(freeformCount).not.toBe(binaryCount);
  });

  it('does not count malformed rows that have no answer payload', () => {
    const responses = [
      { response: null },
      { response: {} },
      { response: { answer: { value: 'Visible answer', encrypted: false } } },
    ];

    expect(countSurveyResultsViewableResponses(responses, 'freeform')).toBe(1);
  });
});

describe('SurveyResults freeform summary rendering', () => {
  it('omits "0 encrypted responses not shown." when no encrypted responses exist', () => {
    const responses = [
      {
        responder: '0x1111111111111111111111111111111111111111',
        timestamp: 1,
        response: { answer: { value: '   ', encrypted: false } },
      },
      {
        responder: '0x2222222222222222222222222222222222222222',
        timestamp: 1,
        response: { answer: { value: 'Visible freeform answer', encrypted: false } },
      },
    ];

    const markup = renderToStaticMarkup(
      <SurveyResultsFreeformAggregatorSummary
        summary={buildSurveyResultsFreeformSummaryModel(responses)}
      />
    );
    expect(markup).toContain('1 total responses. 1 blank not shown.');
    expect(markup).not.toContain('0 encrypted responses not shown.');
    expect(markup).toContain('Visible freeform answer');
  });
});

describe('SurveyResults demo surface props', () => {
  it('passes scoped question scan progress through to the demo report surface', () => {
    const progress = {
      slug: 'edge',
      phase: 'scan',
      totalBlocks: 120,
      requestedTotalBlocks: 120,
      scannedBlocks: 30,
      remainingBlocks: 90,
    };
    const subject = createSubject({
      isOpen: true,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      questionScanProgress: progress,
      sessionSlug: 'demo',
      activeSessionSlug: 'demo',
      viewMode: 'questions',
    });
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      demoResultsViewMode: 'report',
      aggregatorQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
    };

    const tree = subject.render();
    const demoSurfaceNode = findElement(
      tree,
      (candidate) => (
        candidate?.props?.questionScanProgress === progress &&
        candidate?.props?.isQuestionCacheReady === false &&
        candidate?.props?.isResponsesCacheReady === false &&
        candidate?.props?.viewKey === 'report'
      )
    );

    expect(demoSurfaceNode).toBeTruthy();
    expect(demoSurfaceNode.props.questionScanProgress).toBe(progress);
  });
});

describe('SurveyResults survey/response links', () => {
  it('encodes survey IDs in /survey/:id links', () => {
    const surveyId = 'survey id/with spaces?and=query';
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
      surveyId,
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const header = findElement(
      tree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const markup = renderToStaticMarkup(header);

    expect(markup).toContain(`/survey/${encodeURIComponent(surveyId)}`);
  });

  it('appends session query to survey links when an effective slug exists', () => {
    const surveyId = 'survey id/with spaces?and=query';
    const subject = createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
      sessionSlug: 'edge',
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const header = findElement(
      tree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const markup = renderToStaticMarkup(header);

    expect(markup).toContain(`/survey/${encodeURIComponent(surveyId)}`);
    expect(markup).toContain(`session=${encodeURIComponent('edge')}`);
  });

  it('encodes responder addresses in /u/:address links', () => {
    const surveyId = 'survey id/with spaces?and=query';
    const responder = '0xabc123/def456?foo=bar';
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
      surveyId,
      surveyViewMode: 'individuals',
      responses: [
        {
          responder,
          surveyId,
          response: { responses: [] },
        },
      ],
      sbtFilteredResponses: [
        {
          responder,
          surveyId,
          response: { responses: [] },
        },
      ],
    };

    const tree = subject.render();
    const responsesList = findElement(
      tree,
      (element) => element?.type === SurveyResultsIndividualResponsesList
    );
    const markup = renderToStaticMarkup(responsesList);

    expect(markup).toContain(`/u/${encodeURIComponent(responder)}`);
  });

  it('renders only the latest answer row in expanded survey individual view for duplicate question updates', async () => {
    const surveyId = 'survey-individual-dedupe';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Individual Dedupe Survey',
            questionIDs: ['q1'],
          },
        },
        surveysLatestBlock: 4,
        surveyResponsesLatestBlock: {
          [surveyId]: 5,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old answer' },
                },
                {
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                  answer: { value: 'Latest answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'survey',
      filterState: {},
      isResponsesCacheReady: true,
      isQuestionCacheReady: true,
      isSBTCacheReady: true,
      network: { id: Number(networkId) },
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
      surveyViewMode: 'individuals',
      activeToggles: { 0: true },
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: {
        id: 'q1',
        prompt: 'Question one',
        type: 'freeform',
      },
    }));
    subject.getScopedQuestionNetworkDataSync = jest.fn(() => ({
      questions: {
        q1: {
          id: 'q1',
          prompt: 'Question one',
          type: 'freeform',
        },
      },
      questionResponses: {},
      questionsLatestBlock: 0,
      questionResponsesLatestBlock: 0,
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();
    const responsesList = findElement(
      subject.render(),
      (element) => element?.type === SurveyResultsIndividualResponsesList
    );
    const singleResponseNodes = collectTreeNodes(
      responsesList?.props?.renderResponseBody(responsesList.props.responses[0], 0),
      (element) => (
        typeof element?.type === 'function' &&
        element?.props?.aggregatorResponseMode === false
      )
    );

    expect(singleResponseNodes).toHaveLength(1);
    expect(singleResponseNodes[0].props).toEqual(expect.objectContaining({
      response: expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({ value: 'Latest answer' }),
      }),
    }));
  });

  it('renders survey document URL links in the modal header when available', () => {
    const surveyId = 'survey-id-with-docs';
    const docUrl = 'https://example.com/docs/survey-reference';
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
      surveyId,
      surveyTitle: 'Survey with docs',
      surveyDocumentURLs: [docUrl],
      surveyViewMode: 'aggregate',
      sbtFilteredAggregatorQuestionResponses: {},
      aggregateQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const header = findElement(
      tree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const markup = renderToStaticMarkup(header);

    expect(markup).toContain(`href="${docUrl}"`);
    expect(markup).toContain('target="_blank"');
  });

  it('does not render survey document URL links in question view', () => {
    const docUrl = 'https://example.com/docs/question-view-hidden';
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
      surveyDocumentURLs: [docUrl],
      aggregateQuestionResponses: {},
      sbtFilteredAggregatorQuestionResponses: {},
      responses: [],
      sbtFilteredResponses: [],
    };

    const tree = subject.render();
    const header = findElement(
      tree,
      (element) => element?.type === SurveyResultsModalHeader
    );
    const markup = renderToStaticMarkup(header);

    expect(markup).not.toContain(docUrl);
  });
});
