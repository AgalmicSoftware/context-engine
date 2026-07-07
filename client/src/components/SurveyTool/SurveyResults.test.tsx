// Remaining broad SurveyResults coverage owns pure count helpers and display-helper constants.
// Behavior-level port: instance-driven tests now mount through surveyResultsTestHarness and
// drive the component exclusively via DOM events, recorded child-mock props, prop-callback
// spies, and jest-spied module boundaries (cacheScripts / contractScripts / sessionScanScope).
import React from 'react';
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import {
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
      // eslint-disable-next-line no-await-in-loop
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

describe('SurveyResults question-list display wiring', () => {
  it('passes empty question-list display state without rendering the question table', async () => {
    installCacheFixtures({});
    mockLatestBlock(0);
    mockQuestionReadScope();

    await mountSurveyResults({ isOpen: true, viewMode: 'questions' });

    // Enable the question-list view through its real toggle control.
    fireEvent.click(screen.getByText('View & Sort Questions'));
    await settle();

    // port note: the renderQuestionIDsTable spy-not-called guard became absence of any
    // rendered table; empty display state is asserted via the card's empty-state copy.
    expect(screen.getByText('No questions found.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('keeps loading question-list display active without showing the empty state', async () => {
    installCacheFixtures({});
    mockLatestBlock(0);
    mockQuestionReadScope();

    await mountSurveyResults({ isOpen: true, viewMode: 'questions' });
    fireEvent.click(screen.getByText('View & Sort Questions'));

    const questionFilterProps = lastRecordedProps(mockQuestionFilter);
    expect(typeof questionFilterProps.setFilterLoading).toBe('function');
    act(() => {
      questionFilterProps.setFilterLoading(true);
    });
    await settle();

    // port note: the renderQuestionIDsTable invocation-count facet became presence of a
    // real rendered table while loading keeps the empty-state copy hidden.
    expect(screen.queryByText('No questions found.')).toBeNull();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('SurveyResults cache/readiness shell wiring', () => {
  it('preserves selected survey identity outputs for the header and individual response list', async () => {
    const responder = '0x1111111111111111111111111111111111111111';
    installCacheFixtures({
      surveysBySlug: {
        'controller-session': {
          [NETWORK_ID]: buildSurveysBucket({
            title: 'Controller Input Survey',
            questionIDs: ['q1'],
            responsesByResponder: {
              [responder]: { responses: [{ questionID: 'q1', answer: { value: 'Visible answer' } }] },
            },
            latestBlock: 90,
          }),
        },
      },
    });
    mockLatestBlock(90);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      isResponsesCacheReady: true,
      isSurveyCacheReady: true,
      sessionSlug: 'controller-session',
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });

    await waitFor(() => {
      expect(lastRecordedProps(mockIndividualResponsesList)?.responses).toHaveLength(1);
    });

    expect(lastRecordedProps(mockModalHeader)).toEqual(
      expect.objectContaining({
        currentSurveyId: SURVEY_ID,
        effectiveSlug: 'controller-session',
        surveyTitle: 'Controller Input Survey',
        viewMode: 'survey',
      }),
    );
    const listProps = lastRecordedProps(mockIndividualResponsesList);
    expect(listProps).toEqual(
      expect.objectContaining({
        currentSurveyId: SURVEY_ID,
        effectiveSlug: 'controller-session',
        filterLoading: false,
      }),
    );
    expect(listProps.responses).toEqual([
      expect.objectContaining({
        responder,
        surveyId: SURVEY_ID,
        response: expect.objectContaining({
          responses: [expect.objectContaining({ questionID: 'q1', answer: { value: 'Visible answer' } })],
        }),
      }),
    ]);
  });

  it('preserves question filter, cache readiness, filter loading, and polling inputs for controller extraction', async () => {
    const filterState = { text: 'controller input', sbtFilter: { selectedSBTGroups: ['group-a'] } };
    const defaultTags = ['alpha', 'beta'];
    installCacheFixtures({
      questionsBySlug: {
        edge: {
          [NETWORK_ID]: buildQuestionsBucket({
            questionsLatestBlock: 40,
            questionResponsesLatestBlock: 20,
          }),
        },
      },
    });
    const latestBlockSpy = mockLatestBlock(100);
    mockQuestionReadScope({ scope: 'list', slugs: ['demo'] });

    const harness = await mountSurveyResults({
      activeSessionSlug: 'edge',
      defaultTags,
      filterState,
      isOpen: true,
      isQuestionCacheReady: false,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      questionResponsesNonce: 'responses-nonce-1',
      questionsCacheNonce: 'questions-nonce-2',
      sbtCacheRevision: 'sbt-revision-3',
      viewMode: 'questions',
    });

    // port note: remaining-block strings recomputed from fixture math — the mount-time
    // manual refresh now seeds refresh targets (latest 100 vs local 40/20), replacing the
    // direct state-injected 80/70 targets of the legacy test.
    await screen.findByText('Remaining Blocks: 60');
    await screen.findByText('Remaining Blocks: 80');

    const questionFilterProps = lastRecordedProps(mockQuestionFilter);
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
    expect(questionFilterProps.filterState).toBe(filterState);

    // port note: the legacy `setFilterLoading === subject.setFilterLoading` identity check
    // became referential stability of the captured prop across re-renders.
    const firstSetFilterLoading = questionFilterProps.setFilterLoading;
    expect(typeof firstSetFilterLoading).toBe('function');
    await rerenderAndSettle(harness, { sbtCacheRevision: 'sbt-revision-3-nudge' });
    expect(lastRecordedProps(mockQuestionFilter).setFilterLoading).toBe(firstSetFilterLoading);

    const blockCallsBefore = latestBlockSpy.mock.calls.length;
    fireEvent.click(screen.getByLabelText('Refresh sync data'));
    await waitFor(() => {
      expect(latestBlockSpy.mock.calls.length).toBeGreaterThan(blockCallsBefore);
    });
  });

  it('shows the quick refresh action during missing-cache loading and dispatches the parent refresh handler', async () => {
    installCacheFixtures({});
    mockLatestBlock(0);
    mockQuestionReadScope();
    const refreshQuestionMetadata = jest.fn();
    const refreshQuestionResponses = jest.fn();

    await mountSurveyResults({
      isOpen: true,
      refreshQuestionMetadata,
      refreshQuestionResponses,
      viewMode: 'questions',
    });

    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
    const quickRefresh = screen.getByLabelText('Refresh sync data');
    const metadataCallsBefore = refreshQuestionMetadata.mock.calls.length;
    const responsesCallsBefore = refreshQuestionResponses.mock.calls.length;

    fireEvent.click(quickRefresh);
    await settle();

    expect(refreshQuestionMetadata.mock.calls.length).toBeGreaterThan(metadataCallsBefore);
    expect(refreshQuestionResponses.mock.calls.length).toBeGreaterThan(responsesCallsBefore);
  });

  it('keeps the current filter state when a commit receives a non-object filter payload', async () => {
    const onFilterChange = jest.fn();
    const onFilterStateChangeForUrlUpdate = jest.fn();
    const onCountUpdate = jest.fn();
    const currentFilterState = {
      questionTypes: ['rating'],
      sbtFilter: { selectedSBTGroups: ['group-a'] },
    };
    installCacheFixtures({});
    mockLatestBlock(0);
    mockQuestionReadScope();

    await mountSurveyResults({
      isOpen: true,
      isQuestionCacheReady: true,
      onCountUpdate,
      onFilterChange,
      onFilterStateChangeForUrlUpdate,
      viewMode: 'questions',
    });

    // First commit a valid filter-state object through the QuestionFilter seam.
    act(() => {
      lastRecordedProps(mockQuestionFilter).onFilter([], currentFilterState);
    });
    await settle();
    expect(onFilterChange).toHaveBeenLastCalledWith(currentFilterState);
    expect(onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0]).toBe(currentFilterState);
    expect(onFilterStateChangeForUrlUpdate.mock.calls[onFilterStateChangeForUrlUpdate.mock.calls.length - 1][0]).toBe(
      currentFilterState,
    );

    onFilterChange.mockClear();
    onFilterStateChangeForUrlUpdate.mockClear();

    // Then deliver a filtered commit whose filter-state payload is a non-object.
    act(() => {
      lastRecordedProps(mockQuestionFilter).onFilter([{ id: 'q-a' }, { id: 'q-b' }], 'stale-filter-payload');
    });
    await settle();

    // port note: the legacy direct commit called both outward callbacks again with the
    // prior object; the mounted QuestionFilter path dedupes the unchanged filter-state
    // notification after the filtered count update.
    expect(onCountUpdate).toHaveBeenLastCalledWith(2);
    expect(lastRecordedProps(mockQuestionFilter).filterState).toBe(currentFilterState);
    expect(onFilterChange).not.toHaveBeenCalled();
    expect(onFilterStateChangeForUrlUpdate).not.toHaveBeenCalled();
  });

  it('merges SBT filter state into the current filter state for filtered response updates', async () => {
    const onFilterChange = jest.fn();
    const sbtFilterState = { selectedSBTGroups: ['group-b'] };
    const rows = [
      {
        responder: '0x1111111111111111111111111111111111111111',
        response: { responses: [] },
      },
    ];
    installCacheFixtures({
      surveysBySlug: {
        edge: {
          [NETWORK_ID]: buildSurveysBucket({
            title: 'Merge Survey',
            questionIDs: ['q1'],
            responsesByResponder: {
              '0x2222222222222222222222222222222222222222': {
                responses: [{ questionID: 'q1', answer: { value: 'First answer' } }],
              },
              '0x3333333333333333333333333333333333333333': {
                responses: [{ questionID: 'q1', answer: { value: 'Second answer' } }],
              },
            },
            latestBlock: 10,
          }),
        },
      },
    });
    mockLatestBlock(10);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      filterState: { questionTypes: ['rating'], selectedTags: ['alpha'] },
      isOpen: true,
      isQuestionCacheReady: true,
      onFilterChange,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    await waitFor(() => {
      expect(lastRecordedProps(mockIndividualResponsesList)?.responses).toHaveLength(2);
    });

    const sbtFilterProps = lastRecordedProps(mockSbtFilter);
    act(() => {
      sbtFilterProps.onFilter(rows, sbtFilterState);
    });
    await settle();

    expect(lastRecordedProps(mockIndividualResponsesList).responses).toBe(rows);
    expect(onFilterChange).toHaveBeenLastCalledWith({
      questionTypes: ['rating'],
      selectedTags: ['alpha'],
      sbtFilter: sbtFilterState,
    });
    expect(onFilterChange.mock.calls[onFilterChange.mock.calls.length - 1][0].sbtFilter).toBe(sbtFilterState);
    const filterSummaryText = (document.querySelector('.filterSummaryText')?.textContent || '').replace(/‎/g, '');
    expect(filterSummaryText).toMatch(/Responses:\s*2\s*Filtered:\s*1/);
  });

  it('hides quick refresh when results are in sync while keeping the detailed refresh action parent-owned', async () => {
    installCacheFixtures({
      questionsBySlug: {
        edge: {
          [NETWORK_ID]: buildQuestionsBucket({
            questionsLatestBlock: 25,
            questionResponsesLatestBlock: 25,
          }),
        },
      },
    });
    const latestBlockSpy = mockLatestBlock(25);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });
    openSyncDetails();

    await screen.findByText('In Sync');
    expect(screen.queryByLabelText('Refresh sync data')).toBeNull();
    const detailedRefresh = screen.getByTitle('Refresh Data from Cache/Chain');

    const blockCallsBefore = latestBlockSpy.mock.calls.length;
    fireEvent.click(detailedRefresh);
    await settle();

    expect(latestBlockSpy.mock.calls.length).toBeGreaterThan(blockCallsBefore);
  });

  it('renders question-mode loading tracks from missing polling blocks', async () => {
    installCacheFixtures({});
    mockLatestBlock(0);
    mockQuestionReadScope();

    await mountSurveyResults({ isOpen: true, viewMode: 'questions' });
    openSyncDetails();

    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
    expect(screen.getByText('Questions:')).toBeInTheDocument();
    expect(screen.getByText('Responses:')).toBeInTheDocument();
    expect(screen.queryByText('In Sync')).toBeNull();
    expect(screen.getByLabelText('Refresh sync data')).toBeInTheDocument();
  });

  it('renders question and response tracks while question-mode polling is stale', async () => {
    installCacheFixtures({
      questionsBySlug: {
        edge: {
          [NETWORK_ID]: buildQuestionsBucket({
            questionsLatestBlock: 80,
            questionResponsesLatestBlock: 70,
          }),
        },
      },
    });
    mockLatestBlock(100);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });
    openSyncDetails();

    // port note: remaining-block labels recomputed from fixture math — the mount-time
    // manual refresh seeds refresh targets at the latest block (100), so the tracks use
    // the short refresh-target label form instead of the legacy '(Current/Latest)' form;
    // the legacy _syncLoadingStartedAt seeding had no rendered output and was dropped.
    await screen.findByText('Syncing...');
    expect(screen.getByText('Questions:')).toBeInTheDocument();
    await screen.findByText('Remaining Blocks: 20');
    expect(screen.getByText('Responses:')).toBeInTheDocument();
    await screen.findByText('Remaining Blocks: 30');
    expect(screen.getByText('Refresh Now')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh sync data')).toBeInTheDocument();
  });

  it('renders survey-mode readiness from the survey response track only', async () => {
    installCacheFixtures({
      questionsBySlug: {
        edge: {
          [NETWORK_ID]: buildQuestionsBucket({
            questionsLatestBlock: 100,
            questionResponsesLatestBlock: 100,
          }),
        },
      },
      surveysBySlug: {
        edge: {
          [NETWORK_ID]: buildSurveysBucket({
            title: 'Readiness Survey',
            questionIDs: [],
            responsesByResponder: {},
            latestBlock: 40,
          }),
        },
      },
    });
    mockLatestBlock(100);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    openSyncDetails();

    // port note: remaining-block label recomputed from fixture math (survey local 40 vs
    // mount-refresh target 100) — short label form replaces '(Current: 40 / Latest: 100)'.
    await screen.findByText('Syncing...');
    expect(screen.queryByText('Questions:')).toBeNull();
    expect(screen.getByText('Responses:')).toBeInTheDocument();
    await screen.findByText('Remaining Blocks: 60');
    expect(screen.getByText('Refresh Now')).toBeInTheDocument();
  });

  it('keeps long-sync gating from changing status copy or refresh availability', async () => {
    let mockNow = 50000;
    jest.spyOn(Date, 'now').mockImplementation(() => mockNow);
    const fixtures: SurveyResultsCacheFixtures = {
      questionsBySlug: {
        edge: {
          [NETWORK_ID]: buildQuestionsBucket({
            questionsLatestBlock: 90,
            questionResponsesLatestBlock: 100,
          }),
        },
      },
    };
    installCacheFixtures(fixtures);
    mockLatestBlock(100);
    mockQuestionReadScope();

    const harness = await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });
    openSyncDetails();

    await screen.findByText('Syncing...');
    expect(screen.getByLabelText('Refresh sync data')).toBeInTheDocument();

    // Cross the long-sync threshold: status copy and refresh availability must not change.
    mockNow += 20000;
    await rerenderAndSettle(harness, { sbtCacheRevision: 'long-sync-nudge' });
    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(screen.getByLabelText('Refresh sync data')).toBeInTheDocument();

    // Transition to synced through the real cache + manual refresh path.
    (fixtures.questionsBySlug as Record<string, unknown>).edge = {
      [NETWORK_ID]: buildQuestionsBucket({
        questionsLatestBlock: 100,
        questionResponsesLatestBlock: 100,
      }),
    };
    fireEvent.click(screen.getByLabelText('Refresh sync data'));
    await settle();

    await screen.findByText('In Sync');
    expect(screen.queryByLabelText('Refresh sync data')).toBeNull();
  });

  it('routes async scoped question cache reads through peek before read fallback without side effects', async () => {
    const peekBucket = buildQuestionsBucket({
      questionsLatestBlock: 40,
      questionResponsesLatestBlock: 41,
      questions: {
        qpeek: {
          id: 'qpeek',
          prompt: 'Peek prompt',
          sessionSlug: 'edge',
        },
      },
      questionResponses: {
        qpeek: {
          '0xaaa': { answer: { value: 'Peek answer' } },
        },
      },
    });
    const readBucket = buildQuestionsBucket({
      questionsLatestBlock: 50,
      questionResponsesLatestBlock: 51,
      questions: {
        qread: {
          id: 'qread',
          prompt: 'Read prompt',
          sessionSlug: 'fallback',
        },
      },
      questionResponses: {
        qread: {
          '0xbbb': { answer: { value: 'Read answer' } },
        },
      },
    });
    const { peekSpy, readSpy, writeSpy } = installCacheFixtures({
      questionsBySlug: { edge: { [NETWORK_ID]: peekBucket } },
      readQuestionsBySlug: {
        edge: {},
        fallback: { [NETWORK_ID]: readBucket },
      },
    });
    mockLatestBlock(60);
    mockQuestionReadScope({ scope: 'list', slugs: ['fallback'] });

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });

    // Peeked-bucket metadata renders directly...
    await screen.findAllByText('Peek prompt');
    // ...while the read-fallback bucket proves itself through the merged aggregator: its
    // question id gains a summary card (display metadata comes from the sync peek path,
    // so the card uses the unknown-question fallback) carrying the read-bucket response.
    await screen.findByText('Unknown question: qread');
    const readBackedSummary = recordedAggregateSummaryProps().find((props) => props?.question?.id === 'qread');
    expect(readBackedSummary).toBeTruthy();
    expect(readBackedSummary.allResponses).toEqual([
      expect.objectContaining({
        responder: '0xbbb',
        response: expect.objectContaining({ answer: { value: 'Read answer' } }),
      }),
    ]);

    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'fallback', { clone: false });
    const questionCacheReads = readSpy.mock.calls.filter((call) => call[0] === 'questionsCache');
    expect(questionCacheReads.length).toBeGreaterThan(0);
    questionCacheReads.forEach((call) => expect(call[1]).toBe('fallback'));
    expect(writeSpy).not.toHaveBeenCalled();
    // port note: dropped internal-orchestration facets with no behavior seam — the
    // getQuestionReadSlugs/shouldRequireAuthoritativeQuestionScope argument shapes, the
    // merged 50/51 max-block arithmetic, the exactly-once readCache count (the mounted
    // refresh pipeline legitimately re-reads), and the setState/queueResultsRefresh/
    // fetchResponses/decrypt/CSV/JSON purity guards; covered by
    // surveyResultsQuestionNetworkReadController unit tests.
  });

  it('passes stable missing-metadata fallbacks to selected question summaries without reading cache again', async () => {
    const { writeSpy } = installCacheFixtures({
      surveysBySlug: {
        edge: {
          [NETWORK_ID]: buildSurveysBucket({
            title: 'Fallback Survey',
            questionIDs: ['q-missing'],
            responsesByResponder: {
              '0xabc0000000000000000000000000000000000abc': {
                responses: [{ questionID: 'q-missing', answer: { value: 'Fallback answer' } }],
              },
            },
            latestBlock: 10,
          }),
        },
      },
    });
    mockLatestBlock(10);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    await waitFor(() => {
      expect(lastRecordedProps(mockIndividualResponsesList)?.responses).toHaveLength(1);
    });

    // Enter the aggregate summaries through the real survey view-mode toggle.
    fireEvent.click(screen.getByRole('switch'));
    await settle();

    await screen.findByText('Unknown question: q-missing');
    expect(screen.getByText('No metadata found for this question in local cache.')).toBeInTheDocument();
    const summaryProps = recordedAggregateSummaryProps().find((props) => props?.question?.id === 'q-missing');
    expect(summaryProps).toBeTruthy();
    expect(summaryProps.question).toEqual({
      id: 'q-missing',
      prompt: 'Unknown question',
    });
    expect(writeSpy).not.toHaveBeenCalled();
    // port note: the 'metadata reader not called when a render cache is preloaded' facet
    // was dropped — the per-render preloaded-questions cache has no DOM/mock seam; it
    // belongs to surveyResultsQuestionMetadataReadController unit tests
    // (preloadedNetworkQuestions short-circuits ports.readNetworkQuestions).
  });

  it('reads cached question metadata for selected summaries when no render cache is preloaded', async () => {
    const { writeSpy } = installCacheFixtures({
      questionsBySlug: {
        edge: {
          [NETWORK_ID]: buildQuestionsBucket({
            questionsLatestBlock: 12,
            questionResponsesLatestBlock: 12,
            questions: {
              // Mixed-case cache key preserves the case-insensitive lookup guard.
              'Q-Ready': {
                id: 'q-ready',
                prompt: 'Ready cached prompt',
                sessionSlug: 'edge',
                type: 'binary',
              },
              'q-other': {
                id: 'q-other',
                prompt: 'Other cached prompt',
                sessionSlug: 'edge',
                type: 'binary',
              },
            },
          }),
        },
      },
    });
    mockLatestBlock(12);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });

    await screen.findAllByText('Ready cached prompt');
    const readyProps = recordedAggregateSummaryProps().find((props) => props?.question?.id === 'q-ready');
    expect(readyProps).toBeTruthy();
    // port note: the legacy toBe identity on the cached question degraded to a structural
    // match — the scoped network merge clones question records before they reach summaries.
    expect(readyProps.question).toMatchObject({
      id: 'q-ready',
      prompt: 'Ready cached prompt',
      sessionSlug: 'edge',
      type: 'binary',
    });
    expect(screen.queryByText(/Unknown question:/)).toBeNull();
    expect(screen.queryByText('No metadata found for this question in local cache.')).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
    // port note: the reader-call-args facet ({activeSessionSlug, currentSurveyId,
    // questionId, viewMode}) is internal wiring with no seam here; covered by
    // surveyResultsQuestionMetadataReadController unit tests. The old no-state,
    // no-refresh, no-fetch, no-decrypt, and no-export side-effect guards are covered by
    // that controller's injected-port purity test; the mounted seam can only observe that
    // cache persistence was not invoked and no fallback UI rendered.
  });

  it('passes selected survey and question identity to selected summary metadata reads', async () => {
    const surveyBucket = {
      [NETWORK_ID]: buildSurveysBucket({
        title: 'Identity Survey',
        questionIDs: ['q-survey'],
        responsesByResponder: {},
        latestBlock: 10,
      }),
    };
    const questionsBucket = {
      [NETWORK_ID]: buildQuestionsBucket({
        questionsLatestBlock: 10,
        questionResponsesLatestBlock: 10,
        questions: {
          'q-survey': {
            id: 'q-survey',
            prompt: 'Survey selected prompt',
            sessionSlug: 'edge',
            type: 'binary',
          },
        },
      }),
    };
    installCacheFixtures({
      questionsBySlug: { edge: questionsBucket },
      surveysBySlug: { edge: surveyBucket },
    });
    mockLatestBlock(10);
    mockQuestionReadScope();

    const harness = await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    fireEvent.click(screen.getByRole('switch'));
    await settle();

    await screen.findAllByText('Survey selected prompt');
    expect(screen.queryByText(/Unknown question:/)).toBeNull();

    // port note: the legacy reader-args identity assertion became a scope-observable
    // guard — metadata resolves only from the survey-scoped session bucket; the same
    // metadata stored under a different slug falls back to 'Unknown question'.
    harness.unmount();
    installCacheFixtures({
      questionsBySlug: { elsewhere: questionsBucket },
      surveysBySlug: { edge: surveyBucket },
    });
    mockLatestBlock(10);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    fireEvent.click(screen.getByRole('switch'));
    await settle();

    await screen.findByText('Unknown question: q-survey');
    expect(screen.queryByText('Survey selected prompt')).toBeNull();
  });

  it('keeps loading selected metadata placeholders as cached results without side effects', async () => {
    const { writeSpy } = installCacheFixtures({
      questionsBySlug: {
        edge: {
          [NETWORK_ID]: buildQuestionsBucket({
            questionsLatestBlock: 9,
            questionResponsesLatestBlock: 9,
            questions: {
              'q-loading': {
                __ceQuestionMetadataPending: true,
                id: 'q-loading',
                prompt: 'Loading cached question metadata...',
                sessionSlug: 'edge',
                type: 'binary',
              },
              'q-ready': {
                id: 'q-ready',
                prompt: 'Ready cached prompt',
                sessionSlug: 'edge',
                type: 'binary',
              },
            },
            questionResponses: {
              'q-loading': {
                '0xaaa': { answer: { value: 'Cached answer' } },
              },
            },
          }),
        },
      },
    });
    mockLatestBlock(9);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      viewMode: 'questions',
    });

    // port note: the legacy direct renderQuestionSummary facet (pending placeholder passes
    // through as a cached result with metadataMissing=false and no fallback lookup) is owned
    // by surveyResultsQuestionMetadataReadController's pending-placeholder and port-purity
    // tests. The mounted scoped-network path intentionally filters pending placeholders
    // before the summary layer, so this component-level guard covers the observable absence
    // of ready/fallback rendering and cache persistence.
    await screen.findAllByText('Ready cached prompt');
    expect(screen.queryByText('Loading cached question metadata...')).toBeNull();
    expect(screen.queryByText('Unknown question: q-loading')).toBeNull();
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('falls back for selected summaries when the cached metadata read is empty without side effects', async () => {
    const { writeSpy } = installCacheFixtures({
      surveysBySlug: {
        edge: {
          [NETWORK_ID]: buildSurveysBucket({
            title: 'Empty Metadata Survey',
            questionIDs: ['q-empty'],
            responsesByResponder: {},
            latestBlock: 10,
          }),
        },
      },
    });
    mockLatestBlock(10);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    fireEvent.click(screen.getByRole('switch'));
    await settle();

    await screen.findByText('Unknown question: q-empty');
    const fallbackProps = recordedAggregateSummaryProps().find((props) => props?.question?.id === 'q-empty');
    expect(fallbackProps).toBeTruthy();
    expect(fallbackProps.question).toEqual({
      id: 'q-empty',
      prompt: 'Unknown question',
    });
    expect(writeSpy).not.toHaveBeenCalled();
    // port note: the old reader-args plus no-state/no-refresh/no-fetch/no-decrypt/no-export
    // guards are internal-only for the mounted component; surveyResultsQuestionMetadataReadController
    // covers the injected-port identity and purity contract directly.
  });

  it('reuses selected-summary fallback status objects without cache persistence or state writes', async () => {
    const { writeSpy } = installCacheFixtures({
      surveysBySlug: {
        edge: {
          [NETWORK_ID]: buildSurveysBucket({
            title: 'Fallback Reuse Survey',
            questionIDs: ['q-empty'],
            responsesByResponder: {},
            latestBlock: 10,
          }),
        },
      },
    });
    mockLatestBlock(10);
    mockQuestionReadScope();

    const harness = await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    fireEvent.click(screen.getByRole('switch'));
    await settle();
    await screen.findByText('Unknown question: q-empty');

    const firstFallbackQuestion = recordedAggregateSummaryProps().find(
      (props) => props?.question?.id === 'q-empty',
    )?.question;
    expect(firstFallbackQuestion).toEqual({
      id: 'q-empty',
      prompt: 'Unknown question',
    });

    mockSingleQuestionResponse.mockClear();
    await rerenderAndSettle(harness, { sbtCacheRevision: 'fallback-reuse-nudge' });

    const secondFallbackQuestion = recordedAggregateSummaryProps().find(
      (props) => props?.question?.id === 'q-empty',
    )?.question;
    expect(secondFallbackQuestion).toBe(firstFallbackQuestion);
    expect(writeSpy).not.toHaveBeenCalled();
    // port note: the previous direct setState/queue/fetch/decrypt/export not-called guards
    // have no mounted seam here; the helper/controller tests own those side-effect-free
    // contracts while this test preserves fallback object reuse and no cache persistence.
  });

  it('wires selected fallback status plans through parent summary and individual modes', async () => {
    installCacheFixtures({
      surveysBySlug: {
        edge: {
          [NETWORK_ID]: buildSurveysBucket({
            title: 'Fallback Plan Survey',
            questionIDs: ['q-plan'],
            responsesByResponder: {
              '0xabc0000000000000000000000000000000000abc': {
                responses: [{ questionID: 'q-plan', answer: { value: 'Plan answer' } }],
              },
            },
            latestBlock: 10,
          }),
        },
      },
    });
    mockLatestBlock(10);
    mockQuestionReadScope();

    await mountSurveyResults({
      activeSessionSlug: 'edge',
      isOpen: true,
      surveyId: SURVEY_ID,
      viewMode: 'survey',
    });
    await waitFor(() => {
      expect(lastRecordedProps(mockIndividualResponsesList)?.responses).toHaveLength(1);
    });

    // port note: the direct getStableFallbackQuestion API facet (per-call memoization on a
    // bare instance) moved to surveyResultsFallbackQuestionHelpers unit coverage; here the
    // component-owned guard is exercised end-to-end: fallback identity is stable per mode
    // across view toggles and differs between summary and individual modes.
    const individualFirst = recordedIndividualResponseProps().find(
      (props) => props?.question?.id === 'q-plan',
    )?.question;
    expect(individualFirst).toEqual({
      id: 'q-plan',
      creator: '',
      type: '',
      prompt: '',
    });

    mockSingleQuestionResponse.mockClear();
    fireEvent.click(screen.getByRole('switch'));
    await settle();
    const summaryFirst = recordedAggregateSummaryProps().find((props) => props?.question?.id === 'q-plan')?.question;
    expect(summaryFirst).toEqual({
      id: 'q-plan',
      prompt: 'Unknown question',
    });

    mockSingleQuestionResponse.mockClear();
    fireEvent.click(screen.getByRole('switch'));
    await settle();
    const individualSecond = recordedIndividualResponseProps().find(
      (props) => props?.question?.id === 'q-plan',
    )?.question;
    expect(individualSecond).toBe(individualFirst);

    mockSingleQuestionResponse.mockClear();
    fireEvent.click(screen.getByRole('switch'));
    await settle();
    const summarySecond = recordedAggregateSummaryProps().find((props) => props?.question?.id === 'q-plan')?.question;
    expect(summarySecond).toBe(summaryFirst);

    expect(summaryFirst).not.toBe(individualFirst);
  });
});
