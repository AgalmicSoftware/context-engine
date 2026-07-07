import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import contractScriptsDefault from '../../utilities/web3/contractScripts.js';
import { SurveyResultsFreeformAggregatorSummary } from './SurveyResultsAggregatorSummaries';
import { buildSurveyResultsFreeformSummaryModel } from './surveyResultsSummaryModels';
import { renderSurveyResults } from './surveyResultsTestHarness';

const cacheScripts: any = cacheScriptsModule;

const mockSbtFilter = jest.fn((..._args: any[]) => null);
jest.mock('../SBTs/SBTFilter', () => (props: any) => {
  mockSbtFilter(props);
  return null;
});
jest.mock('./QuestionFilter', () => {
  const ReactActual = jest.requireActual('react');
  return ReactActual.forwardRef(() => null);
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

const NETWORK_ID = '84532';
const SESSION_SLUG = 'edge';
const VIEW_MODE_SWITCH_NAME = 'Toggle between individual and aggregate view';
const RESPONDER_ONE = '0x1111111111111111111111111111111111111111';
const RESPONDER_TWO = '0x2222222222222222222222222222222222222222';

type SurveyBucket = Record<string, any>;
type SurveyCache = Record<string, SurveyBucket>;
type QuestionsById = Record<string, Record<string, any>>;

const defaultQuestions: QuestionsById = {
  q1: {
    id: 'q1',
    prompt: 'Question one',
    sessionSlug: SESSION_SLUG,
    type: 'rating',
  },
  q2: {
    id: 'q2',
    prompt: 'Question two',
    sessionSlug: SESSION_SLUG,
    type: 'rating',
  },
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
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace: any) => {
    if (namespace === 'surveysCache') return surveysCache;
    if (namespace === 'questionsCache') return questionsCache;
    if (namespace === 'bookmarksCache') return bookmarksCache;
    return null;
  });
  jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);
  jest.spyOn(contractScriptsDefault as any, 'getLatestBlockNumber').mockResolvedValue(0);
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
};

const clickSurveyViewToggle = async (): Promise<void> => {
  fireEvent.click(await screen.findByRole('switch', { name: VIEW_MODE_SWITCH_NAME }));
  await flushAsync();
};

const switchToIndividualsView = async (responder: string = RESPONDER_ONE): Promise<void> => {
  const viewSwitch = await screen.findByRole('switch', { name: VIEW_MODE_SWITCH_NAME });
  if (viewSwitch.getAttribute('aria-checked') === 'true') {
    fireEvent.click(viewSwitch);
    await flushAsync();
  }
  await waitFor(() => {
    expect(getResponderUserLink(responder)).toBeTruthy();
  });
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
  localStorage.clear();
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
  it('changes survey source signature when question-cache readiness changes', async () => {
    const surveyId = 'survey-source-readiness';
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Readiness Survey',
      responsesByResponder: {
        [RESPONDER_ONE]: {
          timeStamp: 10,
          responses: [{ questionID: 'q1', answer: { value: 'A visible answer' } }],
        },
      },
    });
    seedCacheReads({ surveysCache });

    const view = mountSurveyResults({
      isQuestionCacheReady: false,
      surveyId,
    });
    await waitForSurveyTitle('Readiness Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');
    const firstRows = getLatestAggregateRows('q1');
    expect(firstRows).toHaveLength(1);
    const firstResponse = firstRows[0].response;

    mockSingleQuestionResponse.mockClear();
    await rerenderWithNonce(view, 1);
    await waitFor(() => {
      expect(getLatestAggregateRows('q1')[0]?.response).toBe(firstResponse);
    });

    mockSingleQuestionResponse.mockClear();
    view.rerenderSurveyResults({
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
    const responderOnePayload = JSON.stringify({
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
    });
    const responderTwoPayload = JSON.stringify({
      timeStamp: 20,
      responses: [
        { questionID: 'q1', answer: { value: 'b1' } },
        { questionID: 'q2', answer: { value: 'b2' } },
      ],
    });
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Perf Survey',
      questionIDs: ['q1', 'q2'],
      responsesByResponder: {
        [RESPONDER_ONE]: responderOnePayload,
        [RESPONDER_TWO]: responderTwoPayload,
      },
      surveyResponsesLatestBlock: 7,
      surveysLatestBlock: 9,
    });
    seedCacheReads({ surveysCache });
    const parseSpy = jest.spyOn(JSON, 'parse');

    mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Perf Survey');
    expect(getResponderUserLink(RESPONDER_ONE)).toBeTruthy();
    expect(getResponderUserLink(RESPONDER_TWO)).toBeTruthy();
    await switchToAggregateView(RESPONDER_ONE);

    await expandAggregateQuestion('Question one');
    const q1Rows = getLatestAggregateRows('q1');
    expect(q1Rows).toHaveLength(2);
    expect(q1Rows.map((row) => getAnswerValue(row.response))).toEqual(['a1', 'b1']);

    await expandAggregateQuestion('Question two');
    const q2Rows = getLatestAggregateRows('q2');
    expect(q2Rows).toHaveLength(1);
    expect(getAnswerValue(q2Rows[0].response)).toBe('b2');
    const parsedSurveyPayloads = parseSpy.mock.calls
      .map((call) => call[0])
      .filter((value) => value === responderOnePayload || value === responderTwoPayload);
    expect(parsedSurveyPayloads).toEqual([responderOnePayload, responderTwoPayload]);
  });

  it('skips survey-mode rebuild when source signature is unchanged', async () => {
    const surveyId = 'survey-noop-signature';
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Stable Survey',
      responsesByResponder: {
        [RESPONDER_ONE]: JSON.stringify({
          timeStamp: 10,
          responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
        }),
      },
      surveyResponsesLatestBlock: 3,
    });
    seedCacheReads({ surveysCache });

    const view = mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Stable Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');
    const firstResponse = getLatestAggregateRows('q1')[0].response;

    mockSingleQuestionResponse.mockClear();
    await rerenderWithNonce(view, 1);

    await waitFor(() => {
      expect(getLatestAggregateRows('q1')[0]?.response).toBe(firstResponse);
    });
  });

  it('rebuilds survey-mode responses when payload changes under same metadata', async () => {
    const surveyId = 'survey-signature-payload-change';
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Mutable Survey',
      responsesByResponder: {
        [RESPONDER_ONE]: {
          timeStamp: 10,
          responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
        },
      },
      surveyResponsesLatestBlock: 3,
    });
    seedCacheReads({ surveysCache });

    const view = mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Mutable Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');
    expect(getAnswerValue(getLatestAggregateRows('q1')[0].response)).toBe('a1');

    surveysCache[NETWORK_ID].surveyResponses[surveyId][RESPONDER_ONE] = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'b1' } }],
    };
    mockSingleQuestionResponse.mockClear();
    await rerenderWithNonce(view, 1);

    await waitFor(() => {
      const rows = getLatestAggregateRows('q1');
      expect(rows).toHaveLength(1);
      expect(getAnswerValue(rows[0].response)).toBe('b1');
    });
    expect(JSON.stringify(getLatestAggregateRows('q1'))).not.toContain('a1');
  });

  it('rebuilds survey-mode responses when payload mutates deeply in place under stable refs', async () => {
    const surveyId = 'survey-signature-deep-mutation';
    const responderPayload = {
      timeStamp: 10,
      responses: [{ questionID: 'q1', answer: { value: 'a1' } }],
    };
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Mutable Survey',
      responsesByResponder: {
        [RESPONDER_ONE]: responderPayload,
      },
      surveyResponsesLatestBlock: 3,
    });
    seedCacheReads({ surveysCache });

    const view = mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Mutable Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');
    expect(getAnswerValue(getLatestAggregateRows('q1')[0].response)).toBe('a1');

    responderPayload.responses[0].answer.value = 'b2';
    mockSingleQuestionResponse.mockClear();
    await rerenderWithNonce(view, 1);

    await waitFor(() => {
      expect(getAnswerValue(getLatestAggregateRows('q1')[0]?.response)).toBe('b2');
    });
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

    window.history.pushState({}, '', `/survey/${surveyId}/results?session=${SESSION_SLUG}`);
    fireEvent.popState(window);
    await waitForSurveyTitle('URL Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');

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
    });
    seedCacheReads({ surveysCache });

    mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Survey One');

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
    // port note: the exact empty-surveyId stale-doc branch requires state injection; TASK 7 should cover buildSurveyResultsEmptySurveyModePatch directly.
  });
});

describe('SurveyResults freeform aggregator summary', () => {
  it('renders the empty freeform state inside the SurveyResults-only aggregator panel', () => {
    const { container } = render(
      <SurveyResultsFreeformAggregatorSummary summary={buildSurveyResultsFreeformSummaryModel([])} />,
    );

    expect(screen.getByText('No freeform responses available.')).toBeInTheDocument();
    expect(container.querySelector('[class*="surveyResultsAggregatorPanel"]')).toBeTruthy();
  });
});

describe('SurveyResults survey-mode dedupe', () => {
  it('keeps only the latest answer per responder/question when hydrating survey-mode state', async () => {
    const surveyId = 'survey-dedupe-1';
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Deduped Survey',
      questionIDs: ['q1', 'q2'],
      responsesByResponder: {
        [RESPONDER_ONE]: {
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
      surveysLatestBlock: 7,
      surveyResponsesLatestBlock: 9,
    });
    seedCacheReads({ surveysCache });

    mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Deduped Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');
    let aggregateRows = getLatestAggregateRows('q1');
    expect(aggregateRows).toHaveLength(1);
    expect(getAnswerValue(aggregateRows[0].response)).toBe('Latest answer');

    await expandAggregateQuestion('Question two');
    aggregateRows = getLatestAggregateRows('q2');
    expect(aggregateRows).toHaveLength(1);
    expect(getAnswerValue(aggregateRows[0].response)).toBe('Second question answer');

    await clickSurveyViewToggle();
    await expandResponderCard(RESPONDER_ONE);
    const individualRows = getIndividualResponseProps();
    expect(individualRows).toHaveLength(2);
    expect(individualRows.map((props) => getAnswerValue(props.response))).toEqual([
      'Latest answer',
      'Second question answer',
    ]);
  });

  it('preserves the first-seen question order when duplicate rows are interleaved', async () => {
    const surveyId = 'survey-dedupe-order';
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Deduped Survey Order',
      questionIDs: ['q1', 'q2'],
      responsesByResponder: {
        [RESPONDER_ONE]: {
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
      surveysLatestBlock: 7,
      surveyResponsesLatestBlock: 9,
    });
    seedCacheReads({ surveysCache });

    mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Deduped Survey Order');
    await switchToIndividualsView(RESPONDER_ONE);
    await expandResponderCard(RESPONDER_ONE);

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
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Deduped Survey Passthrough Order',
      questionIDs: ['q1', 'q2'],
      responsesByResponder: {
        [RESPONDER_ONE]: {
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
      surveysLatestBlock: 7,
      surveyResponsesLatestBlock: 9,
    });
    seedCacheReads({ surveysCache });

    mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Deduped Survey Passthrough Order');
    await switchToIndividualsView(RESPONDER_ONE);
    await expandResponderCard(RESPONDER_ONE);

    const individualRows = getIndividualResponseProps();
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
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Payload Timestamp Dedupe Survey',
      responsesByResponder: {
        [RESPONDER_ONE]: {
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
      surveysLatestBlock: 7,
      surveyResponsesLatestBlock: 9,
    });
    seedCacheReads({ surveysCache });

    mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Payload Timestamp Dedupe Survey');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');

    const aggregateRows = getLatestAggregateRows('q1');
    expect(aggregateRows).toHaveLength(1);
    expect(getAnswerValue(aggregateRows[0].response)).toBe('Latest answer');
    expect(JSON.stringify(aggregateRows)).not.toContain('Old answer');

    await clickSurveyViewToggle();
    await expandResponderCard(RESPONDER_ONE);
    const individualRows = getIndividualResponseProps();
    expect(individualRows).toHaveLength(1);
    expect(getAnswerValue(individualRows[0].response)).toBe('Latest answer');
  });

  it('prefers a newer payload timestamp when the edited answer row keeps a stale row timestamp', async () => {
    const surveyId = 'survey-dedupe-stale-entry-timestamp';
    const surveysCache = buildSurveyCache({
      surveyId,
      title: 'Payload Wins Over Stale Entry Timestamp',
      responsesByResponder: {
        [RESPONDER_ONE]: {
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
      surveysLatestBlock: 7,
      surveyResponsesLatestBlock: 9,
    });
    seedCacheReads({ surveysCache });

    mountSurveyResults({ surveyId });
    await waitForSurveyTitle('Payload Wins Over Stale Entry Timestamp');
    await switchToAggregateView(RESPONDER_ONE);
    await expandAggregateQuestion('Question one');

    const aggregateRows = getLatestAggregateRows('q1');
    expect(aggregateRows).toHaveLength(1);
    expect(getAnswerValue(aggregateRows[0].response)).toBe('Latest answer');
    expect(JSON.stringify(aggregateRows)).not.toContain('Old answer');

    await clickSurveyViewToggle();
    await expandResponderCard(RESPONDER_ONE);
    const individualRows = getIndividualResponseProps();
    expect(individualRows).toHaveLength(1);
    expect(getAnswerValue(individualRows[0].response)).toBe('Latest answer');
  });
});
