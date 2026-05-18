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
  countQuestionModeResponses,
  hasAnyCountableSurveyAnswer,
  resolveSurveyResultsSyncDetailsStyle,
  resolveSurveyResultsToggleKnobStyle,
} from './SurveyResults';
import { renderSurveyResults } from './surveyResultsTestHarness';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as sessionScanScopeModule from '../../utilities/session/sessionScanScope.js';

type SurveyResultsProps = Record<string, any>;
const cacheScripts: any = cacheScriptsModule;
const contractScripts: any = (contractScriptsModule as any).default;
const sessionScanScope: any = sessionScanScopeModule;

const mockSbtFilter = jest.fn((..._args: any[]) => null);
jest.mock('../SBTs/SBTFilter', () => (props: any) => {
  mockSbtFilter(props);
  return null;
});
const mockQuestionFilter = jest.fn((..._args: any[]) => null);
jest.mock('./QuestionFilter', () => {
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: ReactActual.forwardRef((props: any, _ref: any) => {
      mockQuestionFilter(props);
      return null;
    }),
  };
});
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
const mockModalHeader = jest.fn((..._args: any[]) => null);
jest.mock('./SurveyResultsModalHeader', () => ({
  __esModule: true,
  default: (props: any) => {
    mockModalHeader(props);
    return (
      <div data-testid="surveyresults-modal-header">
        <h2>{props?.viewMode === 'survey' ? props?.surveyTitle || 'Survey Results' : 'Question Results'}</h2>
        {props?.syncStatusNode}
      </div>
    );
  },
}));
const mockIndividualResponsesList = jest.fn((..._args: any[]) => null);
jest.mock('./SurveyResultsIndividualResponsesList', () => ({
  __esModule: true,
  default: (props: any) => {
    mockIndividualResponsesList(props);
    const rows = Array.isArray(props?.responses) ? props.responses : [];
    return (
      <div data-testid="surveyresults-individual-responses-list">
        {rows.map((row: any, index: number) => (
          <div key={index}>{props?.renderResponseBody?.(row, index)}</div>
        ))}
      </div>
    );
  },
}));

const NETWORK_ID = '84532';
const SURVEY_ID = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

const recordingMocks = [
  mockSbtFilter,
  mockQuestionFilter,
  mockPolisReport,
  mockSingleQuestionResponse,
  mockDemoAnalysisWorkspace,
  mockDebateMap,
  mockRiskMatrix,
  mockModalHeader,
  mockIndividualResponsesList,
];

beforeEach(() => {
  recordingMocks.forEach((recordingMock) => recordingMock.mockClear());
});

afterEach(() => {
  // Unmount while module spies are still installed, then unwind spies + URL.
  cleanup();
  jest.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

const lastRecordedProps = (recordingMock: jest.Mock): any => {
  const { calls } = recordingMock.mock;
  return calls.length > 0 ? calls[calls.length - 1][0] : undefined;
};

const recordedAggregateSummaryProps = (): any[] =>
  mockSingleQuestionResponse.mock.calls
    .map((call) => call[0])
    .filter((props) => props && props.aggregatorResponseMode === true);

const recordedIndividualResponseProps = (): any[] =>
  mockSingleQuestionResponse.mock.calls
    .map((call) => call[0])
    .filter((props) => props && props.aggregatorResponseMode === false);

type QuestionsBucketOverrides = Record<string, any>;
const buildQuestionsBucket = (overrides: QuestionsBucketOverrides = {}) => ({
  questionsLatestBlock: 0,
  questions: {},
  questionResponses: {},
  questionResponsesLatestBlock: 0,
  ...overrides,
});

const buildSurveysBucket = ({
  surveyId = SURVEY_ID,
  title = '',
  questionIDs = [] as string[],
  responsesByResponder = {} as Record<string, unknown>,
  latestBlock = 1,
}: Record<string, any> = {}) => ({
  surveys: {
    [surveyId]: {
      title,
      questionIDs,
      documentURLs: [],
    },
  },
  surveyResponses: { [surveyId]: responsesByResponder },
  surveyResponsesLatestBlock: { [surveyId]: latestBlock },
  surveysLatestBlock: latestBlock,
});

type SurveyResultsCacheFixtures = {
  bookmarks?: unknown;
  bookmarksError?: Error;
  questionsBySlug?: Record<string, unknown>;
  readQuestionsBySlug?: Record<string, unknown>;
  surveysBySlug?: Record<string, unknown>;
};

/**
 * Local fixture-driven cacheScripts control (harness gap): routes peek/read by
 * namespace+slug, records writes, and feeds the surveysCache slug scan.
 */
const installCacheFixtures = (fixtures: SurveyResultsCacheFixtures = {}) => {
  const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((...args: any[]) => {
    const [namespace, slug] = args as [string, string];
    if (namespace === 'bookmarksCache') {
      if (fixtures.bookmarksError) throw fixtures.bookmarksError;
      return fixtures.bookmarks ?? null;
    }
    if (namespace === 'questionsCache') {
      return (fixtures.questionsBySlug || {})[slug] ?? null;
    }
    if (namespace === 'surveysCache') {
      return (fixtures.surveysBySlug || {})[slug] ?? null;
    }
    return null;
  });
  const readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (...args: any[]) => {
    const [namespace, slug] = args as [string, string];
    if (namespace === 'questionsCache') {
      return (fixtures.readQuestionsBySlug || {})[slug] ?? (fixtures.questionsBySlug || {})[slug] ?? {};
    }
    if (namespace === 'surveysCache') {
      return (fixtures.surveysBySlug || {})[slug] ?? {};
    }
    return {};
  });
  const writeSpy = jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined as never);
  const listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockImplementation((...args: any[]) => {
    const [namespace] = args as [string];
    if (namespace !== 'surveysCache') return [];
    return Object.entries(fixtures.surveysBySlug || {}).map(([slug, value]) => ({ slug, value }));
  });
  return { listSpy, peekSpy, readSpy, writeSpy };
};

/** Local contractScripts seam (harness gap): mount-time refresh needs a block number. */
const mockLatestBlock = (value: number) =>
  jest.spyOn(contractScripts, 'getLatestBlockNumber').mockImplementation(async () => value);

/** Local read-scope seam (harness gap): keeps question fan-out deterministic per test. */
const mockQuestionReadScope = ({
  scope = 'active',
  slugs = [] as string[],
}: { scope?: string; slugs?: string[] } = {}) => {
  jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue(scope);
  jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(slugs);
};

/** Flush the mount-open async pipeline (manual refresh -> poll -> fetch) inside act. */
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });
};

const mountSurveyResults = async (props: SurveyResultsProps = {}) => {
  const harness = renderSurveyResults({ preventUrlChange: true, ...props });
  await settle();
  return harness;
};

const rerenderAndSettle = async (
  harness: ReturnType<typeof renderSurveyResults>,
  nextProps: SurveyResultsProps,
): Promise<void> => {
  harness.rerenderSurveyResults(nextProps);
  await settle();
};

const openSyncDetails = (): void => {
  fireEvent.click(screen.getByLabelText('Toggle sync details'));
};

describe('countQuestionModeResponses', () => {
  it('excludes blank freeform responses from question-mode totals', () => {
    const aggregatorByQuestion = {
      Q1: [{ response: { answer: { value: '   ' } } }, { response: { answer: { value: 'Visible freeform answer' } } }],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(countQuestionModeResponses(aggregatorByQuestion, questionLookup)).toBe(1);
  });

  it('keeps blank responses for non-freeform question types', () => {
    const aggregatorByQuestion = {
      q2: [{ response: { answer: { value: '   ' } } }, { response: { answer: { value: 'Agree' } } }],
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
      responses: [{ questionID: 'q1', answer: { value: '   ' } }],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, questionLookup)).toBe(false);
  });

  it('keeps encrypted placeholders countable for freeform answers', () => {
    const parsedSurveyResponse = {
      responses: [{ questionID: 'q1', answer: { value: '*', encrypted: true } }],
    };
    const questionLookup = {
      q1: { type: 'freeform' },
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, questionLookup)).toBe(true);
  });

  it('treats answers as countable when question metadata is unavailable', () => {
    const parsedSurveyResponse = {
      responses: [{ questionID: 'q1', answer: { value: '   ' } }],
    };

    expect(hasAnyCountableSurveyAnswer(parsedSurveyResponse, {})).toBe(true);
  });
});

describe('SurveyResults constructor bookmark bootstrap', () => {
  const seededBookmarkQuestionsBucket = () => ({
    [NETWORK_ID]: buildQuestionsBucket({
      questionsLatestBlock: 5,
      questionResponsesLatestBlock: 5,
      questions: {
        q1: { id: 'q1', prompt: 'Bookmarked question prompt', sessionSlug: 'edge' },
        q2: { id: 'q2', prompt: 'Unbookmarked question prompt', sessionSlug: 'edge' },
      },
    }),
  });

  it('hydrates bookmarked survey and question IDs from a valid cache copy', async () => {
    const cachedSurveys = ['s1', 's2'];
    const cachedQuestions = ['q1'];
    const { peekSpy } = installCacheFixtures({
      bookmarks: { surveys: cachedSurveys, questions: cachedQuestions },
      questionsBySlug: { edge: seededBookmarkQuestionsBucket() },
    });
    mockLatestBlock(5);
    mockQuestionReadScope();

    const harness = await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'edge', { clone: false });
    await screen.findAllByText('Bookmarked question prompt');
    expect(screen.getAllByTitle('Remove bookmark')).toHaveLength(1);
    expect(screen.getAllByTitle('Bookmark question')).toHaveLength(1);
    const headerProps = lastRecordedProps(mockModalHeader);
    expect(headerProps.bookmarkedSurveyIDs).toEqual(['s1', 's2']);
    expect(headerProps.bookmarkedSurveyIDs).not.toBe(cachedSurveys);

    // Clone guard: mutating the cached arrays after mount must not leak into the UI.
    cachedSurveys.push('s3');
    cachedQuestions.push('q2');
    await rerenderAndSettle(harness, { sbtCacheRevision: 'bookmark-clone-nudge' });

    expect(lastRecordedProps(mockModalHeader).bookmarkedSurveyIDs).toEqual(['s1', 's2']);
    expect(screen.getAllByTitle('Remove bookmark')).toHaveLength(1);
    expect(screen.getAllByTitle('Bookmark question')).toHaveLength(1);
  });

  it.each([
    ['null cache', null],
    ['missing arrays', {}],
    ['wrong bookmark list types', { surveys: 'x', questions: 5 }],
  ])('defaults bookmarked IDs for malformed cache: %s', async (_label, cachedValue) => {
    installCacheFixtures({
      bookmarks: cachedValue,
      questionsBySlug: { edge: seededBookmarkQuestionsBucket() },
    });
    mockLatestBlock(5);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });

    await screen.findAllByText('Bookmarked question prompt');
    expect(screen.queryAllByTitle('Remove bookmark')).toHaveLength(0);
    expect(screen.getAllByTitle('Bookmark question')).toHaveLength(2);
    expect(lastRecordedProps(mockModalHeader).bookmarkedSurveyIDs).toEqual([]);
  });

  it('defaults bookmarked IDs when the cache read throws', async () => {
    const readError = new Error('bookmark constructor read failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    installCacheFixtures({
      bookmarksError: readError,
      questionsBySlug: { edge: seededBookmarkQuestionsBucket() },
    });
    mockLatestBlock(5);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });

    await screen.findAllByText('Bookmarked question prompt');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[surveys]',
      '[SurveyResults] Error reading bookmarksCache:',
      readError,
    );
    expect(screen.queryAllByTitle('Remove bookmark')).toHaveLength(0);
    expect(lastRecordedProps(mockModalHeader).bookmarkedSurveyIDs).toEqual([]);
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
