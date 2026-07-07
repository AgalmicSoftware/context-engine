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

const lower = (value: string): string => value.toLowerCase();

const buildQuestionsCache = (questions: QuestionsById = defaultQuestions): Record<string, any> => ({
  [NETWORK_ID]: {
    questionsLatestBlock: 1,
    questionResponsesLatestBlock: 1,
    questions,
    questionResponses: {},
  },
});

const buildSurveyCache = ({
  surveyId,
  title = 'Mounted Survey',
  questionIDs = ['q1'],
  documentURLs = [],
  responsesByResponder = {},
  surveysLatestBlock = 4,
  surveyResponsesLatestBlock = 5,
}: {
  surveyId: string;
  title?: string;
  questionIDs?: string[];
  documentURLs?: string[];
  responsesByResponder?: Record<string, any>;
  surveysLatestBlock?: number;
  surveyResponsesLatestBlock?: number;
}): SurveyCache => ({
  [NETWORK_ID]: {
    surveys: {
      [lower(surveyId)]: {
        title,
        questionIDs,
        documentURLs,
      },
    },
    surveyResponses: {
      [lower(surveyId)]: responsesByResponder,
    },
    surveyResponsesLatestBlock: {
      [lower(surveyId)]: surveyResponsesLatestBlock,
    },
    surveysLatestBlock,
  },
});

const seedCacheReads = ({
  surveysCache,
  questionsCache = buildQuestionsCache(),
  bookmarksCache = { surveys: [], questions: [] },
}: {
  surveysCache: SurveyCache;
  questionsCache?: Record<string, any>;
  bookmarksCache?: Record<string, any>;
}): void => {
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
    if (namespace === 'surveysCache') return surveysCache;
    if (namespace === 'questionsCache') return questionsCache;
    if (namespace === 'bookmarksCache') return bookmarksCache;
    return null;
  });
  return subject;
};

const mountSurveyResults = (props: Record<string, any> = {}, options: Record<string, any> = {}) =>
  renderSurveyResults(
    {
      isOpen: true,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      isSurveyCacheReady: true,
      network: { id: Number(NETWORK_ID) },
      networkChainId: Number(NETWORK_ID),
      preventUrlChange: true,
      provider: {},
      sessionSlug: SESSION_SLUG,
      viewMode: 'survey',
      ...props,
    },
    options,
  );

const waitForSurveyTitle = async (title: string): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });
};

const flushAsync = async (cycles = 6): Promise<void> => {
  for (let index = 0; index < cycles; index += 1) {
    await Promise.resolve();
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

const switchToAggregateView = async (_responder: string = RESPONDER_ONE): Promise<void> => {
  const viewSwitch = await screen.findByRole('switch', { name: VIEW_MODE_SWITCH_NAME });
  if (viewSwitch.getAttribute('aria-checked') !== 'true') {
    fireEvent.click(viewSwitch);
    await flushAsync();
  }
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: VIEW_MODE_SWITCH_NAME })).toHaveAttribute('aria-checked', 'true');
  });
};

const getResponderUserLink = (responder: string): HTMLAnchorElement | null => {
  const expectedHref = `/u/${encodeURIComponent(lower(responder))}`;
  return (
    (Array.from(document.querySelectorAll('a')).find((link) => link.getAttribute('href') === expectedHref) as
      HTMLAnchorElement | undefined) || null
  );
};

const expandResponderCard = async (responder: string = RESPONDER_ONE): Promise<void> => {
  const responderLink = await waitFor(() => {
    const link = getResponderUserLink(responder);
    expect(link).toBeTruthy();
    return link as HTMLAnchorElement;
  });
  const header = responderLink.closest('.card-header');
  expect(header).toBeTruthy();
  mockSingleQuestionResponse.mockClear();
  fireEvent.click(header as HTMLElement);
  await waitFor(() => {
    expect(getIndividualResponseProps().length).toBeGreaterThan(0);
  });
};

const expandAggregateQuestion = async (prompt: string): Promise<void> => {
  const promptNodes = await screen.findAllByText(prompt);
  const promptNode = promptNodes.find((node) => node.closest('.card-header'));
  expect(promptNode).toBeTruthy();
  const header = promptNode?.closest('.card-header');
  expect(header).toBeTruthy();
  mockSingleQuestionResponse.mockClear();
  fireEvent.click(header as HTMLElement);
  await waitFor(() => {
    expect(getAggregateResponseProps().length).toBeGreaterThan(0);
  });
};

const getResponseProps = (): any[] => mockSingleQuestionResponse.mock.calls.map((call) => call[0]);

const getIndividualResponseProps = (): any[] =>
  getResponseProps().filter((props) => props?.aggregatorResponseMode === false);

const getAggregateResponseProps = (): any[] =>
  getResponseProps().filter((props) => props?.aggregatorResponseMode === true);

const getLatestAggregateRows = (questionId: string): any[] => {
  const matchingCalls = getAggregateResponseProps().filter(
    (props) => String(props?.question?.id || '').toLowerCase() === questionId,
  );
  const latest = matchingCalls[matchingCalls.length - 1];
  return Array.isArray(latest?.allResponses) ? latest.allResponses : [];
};

const getAnswerValue = (response: any): unknown => response?.answer?.value;

const rerenderWithNonce = async (view: ReturnType<typeof mountSurveyResults>, nonce: number): Promise<void> => {
  await act(async () => {
    view.rerenderSurveyResults({ questionResponsesNonce: nonce });
    await flushAsync(10);
  });
};

beforeEach(() => {
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
});

afterEach(() => {
  jest.restoreAllMocks();
  try {
    window.history.replaceState({}, '', '/');
  } catch (_) {
    /* noop */
  }
});

describe('SurveyResults survey-mode source signature', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('changes survey source signature when question-cache readiness changes', async () => {
    const surveyId = 'survey-id-1';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Survey One',
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
              responses: [
                { questionID: 'q1', answer: { value: 'A visible answer' } },
              ],
            },
          },
        },
      },
    };

    const subject = createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: false,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);
    subject.setState = jest.fn();

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();
    const notReadySignature = subject._surveyModeSourceCoarseSignature;
    expect(notReadySignature.split('::')[3]).toBe('0');

    subject.props = {
      ...subject.props,
      isQuestionCacheReady: true,
      questionResponsesNonce: 2,
    });
    await waitFor(() => {
      const latestResponse = getLatestAggregateRows('q1')[0]?.response;
      expect(latestResponse).toEqual(
        expect.objectContaining({
          questionID: 'q1',
          answer: expect.objectContaining({ value: 'A visible answer' }),
        }),
      );
      expect(latestResponse).not.toBe(firstResponse);
    });
    // port note: the literal private coarse-signature string layout is unobservable in RTL; TASK 7 should cover exact signature construction in a helper-level test if that encoding remains public to tests.
  });

  it('parses each survey responder payload once while building survey-mode views', async () => {
    const surveyId = 'survey-parse-once';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Perf Survey',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            '0xAa': JSON.stringify({
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            }),
            '0xBb': JSON.stringify({
              timeStamp: 20,
              responses: [
                { questionID: 'q1', answer: { value: 'b1' } },
                { questionID: 'q2', answer: { value: 'b2' } },
              ],
            }),
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 7 },
        surveysLatestBlock: 9,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(2);
    expect(subject.state.responses).toHaveLength(2);
    expect(subject.state.aggregateQuestionResponses.q1).toHaveLength(2);
    expect(subject.state.aggregateQuestionResponses.q2).toHaveLength(1);
  });

  it('skips survey-mode rebuild when source signature is unchanged', async () => {
    const surveyId = 'survey-noop-signature';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Stable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            '0xAa': JSON.stringify({
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            }),
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).not.toHaveBeenCalled();
    expect(subject.setState).not.toHaveBeenCalled();
  });

  it('rebuilds survey-mode responses when payload changes under same metadata', async () => {
    const surveyId = 'survey-signature-payload-change';
    const responder = '0xAa';
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Mutable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: 10,
              responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
            },
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    surveyCache['84532'].surveyResponses[surveyId][responder] = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'b1' } }],
    };

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalled();
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('b1');
  });

  it('rebuilds survey-mode responses when payload mutates deeply in place under stable refs', async () => {
    const surveyId = 'survey-signature-deep-mutation';
    const responder = '0xAa';
    const responderPayload = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
    };
    const surveyCache = {
      '84532': {
        surveys: {
          [surveyId]: {
            title: 'Mutable Survey',
            questionIDs: ['q1'],
          },
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: responderPayload,
          },
        },
        surveyResponsesLatestBlock: { [surveyId]: 3 },
        surveysLatestBlock: 4,
      },
    };
    const bookmarksCache = { surveys: [], questions: [] };
    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any) => {
      if (namespace === 'surveysCache') return surveyCache;
      if (namespace === 'bookmarksCache') return bookmarksCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    const subject = createSubject({
      provider: {},
      surveyId,
      viewMode: 'survey',
    });
    subject._isMounted = true;
    subject.getEffectiveSlug = jest.fn(() => 'edge');
    subject.state = {
      ...subject.state,
      surveyId,
      viewMode: 'survey',
    };
    attachStateHarness(subject);
    const parseSpy = jest.spyOn(subject, 'parseResponse');

    await subject.fetchSurveyModeResponses();
    subject.setState.mockClear();
    parseSpy.mockClear();

    responderPayload.responses[0].answer.value = 'b2';

    await subject.fetchSurveyModeResponses();

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(subject.setState).toHaveBeenCalled();
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('b2');
  });

  it('invalidates survey source signature when toggling away from survey mode', async () => {
    const surveyId = `0x${'a'.repeat(64)}`;
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'URL Survey',
      responsesByResponder: {
        [RESPONDER_ONE]: {
          timeStamp: 10,
          responses: [{ questionID: 'q1', answer: { value: 'url answer' } }],
        },
      },
      surveyResponsesLatestBlock: 3,
    });
    seedCacheReads({ surveysCache });

    mountSurveyResults({ viewMode: undefined }, { route: `/survey/${surveyId}/results?session=${SESSION_SLUG}` });
    await waitForSurveyTitle('URL Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');
    const firstResponse = getLatestAggregateRows('q1')[0].response;

    window.history.pushState({}, '', `/questions/results?session=${SESSION_SLUG}`);
    fireEvent.popState(window);
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Question Results' })).toBeInTheDocument();
    });

    subject._isMounted = true;
    subject._surveyModeSourceSignature = 'edge::84532::0xabc::stable';
    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      surveyId: '0xabc',
      filterState: {},
    };
    subject.requestFetchResponses = jest.fn();
    attachStateHarness(subject);

    await waitFor(() => {
      const nextResponse = getLatestAggregateRows('q1')[0]?.response;
      expect(nextResponse).toEqual(
        expect.objectContaining({
          questionID: 'q1',
          answer: expect.objectContaining({ value: 'url answer' }),
        }),
      );
      expect(nextResponse).not.toBe(firstResponse);
    });
  });
});

describe('SurveyResults survey document URLs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('stores survey document URLs from cache in survey mode state', async () => {
    const surveyId = 'survey-id-1';
    const documentURLs = ['https://example.com/documents/alpha', 'https://example.com/documents/beta'];
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Survey One',
      documentURLs,
      responsesByResponder: {
        [RESPONDER_ONE]: {
          responses: [{ questionID: 'q1', answer: { value: 'A visible answer' } }],
        },
      },
    };

    const subject = createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    });

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);
    subject.setState = jest.fn((next) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      return patch;
    });

    const documentLinks = Array.from(document.querySelectorAll('a')).filter((link) =>
      String(link.getAttribute('href') || '').startsWith('https://example.com/documents/'),
    );
    expect(documentLinks.map((link) => link.getAttribute('href'))).toEqual(documentURLs);
  });

  it('clears stale survey document URLs when no survey is selected', async () => {
    const surveyId = 'survey-doc-clear';
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Survey With Docs',
      documentURLs: ['https://example.com/documents/stale'],
      responsesByResponder: {
        [RESPONDER_ONE]: {
          timeStamp: 10,
          responses: [{ questionID: 'q1', answer: { value: 'A visible answer' } }],
        },
      },
    });
    seedCacheReads({ surveysCache });

    const view = mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Survey With Docs');
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'https://example.com/documents/stale' })).toBeInTheDocument();
    });

    surveysCache[NETWORK_ID].surveys[surveyId].documentURLs = [];
    surveysCache[NETWORK_ID].surveyResponsesLatestBlock[surveyId] = 6;
    await rerenderWithNonce(view, 1);

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: 'https://example.com/documents/stale' })).not.toBeInTheDocument();
    });

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') {
        return {
          [networkId]: {
            surveys: {},
            surveyResponses: {},
          },
        };
      }
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.surveyDocumentURLs).toEqual([]);
  });
});

describe('SurveyResults freeform aggregator summary', () => {
  it('renders the empty freeform state inside the SurveyResults-only aggregator panel', () => {
    const { container } = render(
      <SurveyResultsFreeformAggregatorSummary summary={buildSurveyResultsFreeformSummaryModel([])} />,
    );

    expect(panel).toBeTruthy();
    expect(treeHasText(tree, 'No freeform responses available.')).toBe(true);
  });
});

describe('SurveyResults survey-mode dedupe', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps only the latest answer per responder/question when hydrating survey-mode state', async () => {
    const surveyId = 'survey-dedupe-1';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Deduped Survey',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
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
                {
                  questionID: 'q2',
                  timeStamp: '2025-01-02T00:00:00.000Z',
                  answer: { value: 'Second question answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
      q2: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(subject.state.responses[0].response.responses).toHaveLength(2);
    expect(subject.state.responses[0].response.responses[0]).toEqual(expect.objectContaining({
      questionID: 'q1',
      answer: expect.objectContaining({ value: 'Latest answer' }),
    }));
    expect(subject.state.aggregateQuestionResponses.q1).toHaveLength(1);
    expect(subject.state.aggregateQuestionResponses.q1[0].response.answer.value).toBe('Latest answer');
    expect(subject.state.aggregateQuestionResponses.q2).toHaveLength(1);
  });

  it('preserves the first-seen question order when duplicate rows are interleaved', async () => {
    const surveyId = 'survey-dedupe-order';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Deduped Survey Order',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old first answer' },
                },
                {
                  questionID: 'q2',
                  timeStamp: '2024-01-02T00:00:00.000Z',
                  answer: { value: 'Second question answer' },
                },
                {
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                  answer: { value: 'Latest first answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
      q2: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    const individualRows = getIndividualResponseProps();
    expect(individualRows.map((props) => props.response?.questionID || props.response?.questionId)).toEqual([
      'q1',
      'q2',
    ]);
    expect(getAnswerValue(individualRows[0].response)).toBe('Latest first answer');
    expect(getAnswerValue(individualRows[1].response)).toBe('Second question answer');
  });

  it('preserves passthrough row order when duplicate question rows are collapsed around them', async () => {
    const surveyId = 'survey-dedupe-passthrough-order';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Deduped Survey Passthrough Order',
            questionIDs: ['q1', 'q2'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-01-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Old first answer' },
                },
                {
                  kind: 'legacyMeta',
                  note: 'Keep this row between the deduped answers',
                },
                {
                  questionID: 'q1',
                  timeStamp: '2025-01-01T00:00:00.000Z',
                  answer: { value: 'Latest first answer' },
                },
                {
                  questionID: 'q2',
                  timeStamp: '2025-01-02T00:00:00.000Z',
                  answer: { value: 'Second question answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
      q2: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response: any) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(
      individualRows.map((props) => props.response?.questionID || props.response?.questionId || props.response?.kind),
    ).toEqual(['q1', 'legacyMeta', 'q2']);
    expect(getAnswerValue(individualRows[0].response)).toBe('Latest first answer');
    expect(individualRows[1].response).toEqual(
      expect.objectContaining({
        kind: 'legacyMeta',
        note: 'Keep this row between the deduped answers',
      }),
    );
    // port note: the passthrough order seam is observed through the individuals renderer; TASK 7 should keep direct normalizeSurveyResponsePayloadByQuestionId coverage as the durable logic-level guard.
  });

  it('prefers a newer payload timestamp when the edited answer row has no timestamp', async () => {
    const surveyId = 'survey-dedupe-payload-timestamp';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Payload Timestamp Dedupe Survey',
            questionIDs: ['q1'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
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
                  answer: { value: 'Latest answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(subject.state.responses[0].response.responses).toEqual([
      expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({ value: 'Latest answer' }),
      }),
    ]);
    expect(subject.state.aggregateQuestionResponses.q1).toEqual([
      expect.objectContaining({
        response: expect.objectContaining({
          answer: expect.objectContaining({ value: 'Latest answer' }),
        }),
      }),
    ]);
  });

  it('prefers a newer payload timestamp when the edited answer row keeps a stale row timestamp', async () => {
    const surveyId = 'survey-dedupe-stale-entry-timestamp';
    const responder = '0x1111111111111111111111111111111111111111';
    const networkId = '84532';
    const surveysCache = {
      [networkId]: {
        surveys: {
          [surveyId]: {
            title: 'Payload Wins Over Stale Entry Timestamp',
            questionIDs: ['q1'],
          },
        },
        surveysLatestBlock: 7,
        surveyResponsesLatestBlock: {
          [surveyId]: 9,
        },
        surveyResponses: {
          [surveyId]: {
            [responder]: {
              timeStamp: '2025-02-01T00:00:00.000Z',
              responses: [
                {
                  questionId: 'q1',
                  timeStamp: '2025-01-15T00:00:00.000Z',
                  answer: { value: 'Old answer' },
                },
                {
                  questionID: 'q1',
                  timeStamp: '2024-01-01T00:00:00.000Z',
                  answer: { value: 'Latest answer' },
                },
              ],
            },
          },
        },
      },
    };

    const subject = attachStateHarness(createSubject({
      network: { id: Number(networkId) },
      isQuestionCacheReady: true,
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'survey',
      surveyId,
    };
    subject.getEffectiveSlug = jest.fn(() => 'session-slug');
    subject.getNetworkQuestionsForCurrentContext = jest.fn(() => ({
      q1: { type: 'freeform' },
    }));
    subject.parseResponse = jest.fn((response) => response);

    jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace) => {
      if (namespace === 'surveysCache') return surveysCache;
      return {};
    });
    jest.spyOn(cacheScripts, 'readCache').mockResolvedValue({});

    await subject.fetchSurveyModeResponses();

    expect(subject.state.responses).toHaveLength(1);
    expect(subject.state.responses[0].response.responses).toEqual([
      expect.objectContaining({
        questionID: 'q1',
        answer: expect.objectContaining({ value: 'Latest answer' }),
      }),
    ]);
    expect(subject.state.aggregateQuestionResponses.q1).toEqual([
      expect.objectContaining({
        response: expect.objectContaining({
          answer: expect.objectContaining({ value: 'Latest answer' }),
        }),
      }),
    ]);
  });
});
