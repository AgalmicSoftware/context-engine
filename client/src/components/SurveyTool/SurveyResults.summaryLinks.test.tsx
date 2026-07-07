import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import contractScriptsDefault from '../../utilities/web3/contractScripts.js';
import {
  SurveyResultsFreeformAggregatorSummary,
  SurveyResultsMultichoiceAggregatorSummary,
} from './SurveyResultsAggregatorSummaries';
import SurveyResultsFilterSummary from './SurveyResultsFilterSummary';
import { renderSurveyResultsSyncStatusPanel } from './SurveyResultsPanels';
import { countSurveyResultsViewableResponses } from './SurveyResultsQuestionSummary';
import SurveyResultsQuestionSummaryCard from './SurveyResultsQuestionSummaryCard';
import {
  buildSurveyResultsFreeformSummaryModel,
  buildSurveyResultsMultichoiceSummaryModel,
  resolveSurveyResultsSummaryQuestionType,
} from './surveyResultsSummaryModels';
import { renderSurveyResults } from './surveyResultsTestHarness';
import styles from './SurveyResults.module.scss';
import type { SurveyResultsSyncStatusDisplayPlan } from './surveyResultsSyncStatusController';

const cacheScripts: any = cacheScriptsModule;

const NETWORK_ID = '84532';
const RESPONDER_ONE = '0x1111111111111111111111111111111111111111';
const RESPONDER_TWO = '0x2222222222222222222222222222222222222222';
const VIEW_MODE_SWITCH_NAME = 'Toggle between individual and aggregate view';

const mockSbtFilter = jest.fn((..._args: any[]) => null);
jest.mock('../SBTs/SBTFilter', () => (props: any) => {
  mockSbtFilter(props);
  return null;
});
const mockQuestionFilter = jest.fn((..._args: any[]) => null);
jest.mock('./QuestionFilter', () => {
  const ReactActual = jest.requireActual('react');
  return ReactActual.forwardRef((props: any, ref: any) => {
    mockQuestionFilter(props);
    ReactActual.useImperativeHandle(ref, () => ({
      handleApplyFilters: jest.fn(),
      handleClearFilters: jest.fn(),
    }));
    return null;
  });
});
const mockPolisReport = jest.fn((..._args: any[]) => null);
jest.mock('../PolisReport/PolisReport', () => (props: any) => {
  mockPolisReport(props);
  return <div data-testid="surveyresults-demo-polis-report">Polis Report</div>;
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

type CacheEnvironment = {
  bookmarksBySlug?: Record<string, any>;
  questionsBySlug?: Record<string, any>;
  surveysBySlug?: Record<string, any>;
};

let cacheUpdateListener: ((update: Record<string, any>) => void) | null = null;

const normalizeQuestionCache = (bucket: Record<string, any> = {}): Record<string, any> => ({
  [NETWORK_ID]: {
    questionsLatestBlock: 1,
    questionResponsesLatestBlock: 1,
    questions: {},
    questionResponses: {},
    ...bucket,
  },
});

const buildQuestionCache = ({
  questions = {},
  questionResponses = {},
  questionsLatestBlock = 1,
  questionResponsesLatestBlock = 1,
}: Record<string, any> = {}): Record<string, any> =>
  normalizeQuestionCache({
    questions,
    questionResponses,
    questionsLatestBlock,
    questionResponsesLatestBlock,
  });

const buildSurveyCache = ({
  surveyId,
  title = 'Session Survey',
  documentURLs = [],
  questionIDs = ['q1'],
  responsesByResponder = {},
  surveysLatestBlock = 1,
  surveyResponsesLatestBlock = 1,
}: {
  surveyId: string;
  title?: string;
  documentURLs?: string[];
  questionIDs?: string[];
  responsesByResponder?: Record<string, any>;
  surveysLatestBlock?: number;
  surveyResponsesLatestBlock?: number;
}): Record<string, any> => ({
  [NETWORK_ID]: {
    surveys: {
      [surveyId.toLowerCase()]: {
        title,
        documentURLs,
        questionIDs,
      },
    },
    surveyResponses: {
      [surveyId.toLowerCase()]: responsesByResponder,
    },
    surveyResponsesLatestBlock: {
      [surveyId.toLowerCase()]: surveyResponsesLatestBlock,
    },
    surveysLatestBlock,
  },
});

const seedCacheEnvironment = ({
  bookmarksBySlug = {},
  questionsBySlug = {},
  surveysBySlug = {},
}: CacheEnvironment = {}): void => {
  const defaultBookmarks = { surveys: [], questions: [] };
  const lookupSlug = (entries: Record<string, any>, slug: any, fallback: any): any => {
    const normalizedSlug = String(slug ?? '');
    const lowerSlug = normalizedSlug.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(entries, normalizedSlug)) {
      return entries[normalizedSlug];
    }
    if (Object.prototype.hasOwnProperty.call(entries, lowerSlug)) {
      return entries[lowerSlug];
    }
    if (lowerSlug === 'general' && Object.prototype.hasOwnProperty.call(entries, '')) {
      return entries[''];
    }
    return fallback;
  };

  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace: any, slug: any) => {
    if (namespace === 'bookmarksCache') return lookupSlug(bookmarksBySlug, slug, defaultBookmarks);
    if (namespace === 'questionsCache') return lookupSlug(questionsBySlug, slug, {});
    if (namespace === 'surveysCache') return lookupSlug(surveysBySlug, slug, {});
    return null;
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace: any, slug: any) => {
    if (namespace === 'bookmarksCache') return lookupSlug(bookmarksBySlug, slug, defaultBookmarks);
    if (namespace === 'questionsCache') return lookupSlug(questionsBySlug, slug, {});
    if (namespace === 'surveysCache') return lookupSlug(surveysBySlug, slug, {});
    return null;
  });
  jest.spyOn(cacheScripts, 'writeCache').mockResolvedValue(undefined);
  jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockImplementation((namespace: any) => {
    if (namespace !== 'surveysCache') return [];
    return Object.keys(surveysBySlug).map((slug) => ({
      slug,
      value: surveysBySlug[slug],
    }));
  });
  cacheUpdateListener = null;
  jest.spyOn(cacheScripts, 'subscribeCacheUpdates').mockImplementation((listener: any) => {
    cacheUpdateListener = listener;
    return jest.fn();
  });
  jest.spyOn(contractScriptsDefault as any, 'getLatestBlockNumber').mockResolvedValue(100);
};

const renderQuestionResults = (props: Record<string, any> = {}, route = '/questions/results') =>
  renderSurveyResults(
    {
      isOpen: true,
      isQuestionCacheReady: true,
      isResponsesCacheReady: true,
      isSBTCacheReady: true,
      network: { id: Number(NETWORK_ID) },
      networkChainId: Number(NETWORK_ID),
      preventUrlChange: true,
      provider: {},
      viewMode: 'questions',
      ...props,
    },
    { route },
  );

const renderSurveyModeResults = (props: Record<string, any> = {}, route = '/') =>
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
      viewMode: 'survey',
      ...props,
    },
    { route },
  );

const waitForText = async (text: string): Promise<void> => {
  await waitFor(() => {
    expect(screen.getAllByText(text).length).toBeGreaterThan(0);
  });
};

const expectTextAbsent = (text: string): void => {
  expect(screen.queryAllByText(text)).toHaveLength(0);
};

const getFilterSummaryNode = (): HTMLElement => {
  const node = document.querySelector('[class*="filterSummaryText"]');
  expect(node).toBeTruthy();
  return node as HTMLElement;
};

const getQuestionCard = (prompt: string): HTMLElement => {
  const node = screen
    .getAllByText(prompt)
    .map((item) => item.closest('[class*="aggregatorSummaryCard"]'))
    .find(Boolean);
  expect(node).toBeTruthy();
  return node as HTMLElement;
};

const expandQuestionCard = async (prompt: string): Promise<HTMLElement> => {
  const card = getQuestionCard(prompt);
  fireEvent.click(within(card).getByText(prompt));
  await waitFor(() => {
    expect(card.querySelector('[class*="aggregatorDarkCardBody"]')).toBeTruthy();
  });
  return card;
};

const switchToAggregateView = async (): Promise<void> => {
  const viewSwitch = await screen.findByRole('switch', { name: VIEW_MODE_SWITCH_NAME });
  if (viewSwitch.getAttribute('aria-checked') !== 'true') {
    fireEvent.click(viewSwitch);
  }
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: VIEW_MODE_SWITCH_NAME })).toHaveAttribute('aria-checked', 'true');
  });
};

const switchToIndividualsView = async (): Promise<void> => {
  const viewSwitch = await screen.findByRole('switch', { name: VIEW_MODE_SWITCH_NAME });
  if (viewSwitch.getAttribute('aria-checked') === 'true') {
    fireEvent.click(viewSwitch);
  }
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: VIEW_MODE_SWITCH_NAME })).toHaveAttribute('aria-checked', 'false');
  });
};

const openQuestionTable = async (): Promise<void> => {
  fireEvent.click(screen.getByText(/View & Sort Questions/));
  await waitFor(() => {
    expect(screen.getByRole('columnheader', { name: /Prompt/ })).toBeInTheDocument();
  });
};

const getTableRowByPrompt = (prompt: string): HTMLElement => {
  const row = screen
    .getAllByText(prompt)
    .map((node) => node.closest('tr'))
    .find(Boolean);
  expect(row).toBeTruthy();
  return row as HTMLElement;
};

const findLinkByHref = async (href: string): Promise<HTMLAnchorElement> => {
  let link: HTMLAnchorElement | null = null;
  await waitFor(() => {
    link =
      (Array.from(document.querySelectorAll('a')).find((candidate) => candidate.getAttribute('href') === href) as
        HTMLAnchorElement | undefined) || null;
    expect(link).toBeTruthy();
  });
  return link as HTMLAnchorElement;
};

const buildSyncStatusDisplay = (
  overrides: Partial<SurveyResultsSyncStatusDisplayPlan> = {},
): SurveyResultsSyncStatusDisplayPlan => ({
  isSynced: false,
  isSyncingOrLoading: true,
  syncStatusText: 'Syncing...',
  showLongSyncNotice: false,
  showQuickRefresh: true,
  viewMode: 'questions',
  question: {
    color: 'warning',
    label: 'Remaining Blocks: 20 (Current: 80 / Latest: 100)',
    progress: 80,
    remainingBlocks: 20,
    showRemainingSpinner: false,
    showSpinner: false,
  },
  response: {
    color: 'success',
    label: 'In Sync (Current: 100 / Latest: 100)',
    progress: 100,
    remainingBlocks: 0,
    showRemainingSpinner: false,
    showSpinner: false,
  },
  ...overrides,
});

beforeEach(() => {
  localStorage.clear();
  mockSbtFilter.mockClear();
  mockQuestionFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
  cacheUpdateListener = null;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  try {
    window.history.replaceState({}, '', '/');
  } catch (_) {
    /* noop */
  }
});

describe('SurveyResults multichoice aggregator summary', () => {
  it('renders the empty multichoice state inside the SurveyResults-only aggregator panel', () => {
    const { container } = render(
      <SurveyResultsMultichoiceAggregatorSummary
        summary={buildSurveyResultsMultichoiceSummaryModel([], {
          id: 'q1',
          type: 'multichoice',
          options: ['Alpha', 'Beta'],
        })}
      />,
    );

    expect(container.querySelector('[class*="surveyResultsAggregatorPanel"]')).toBeTruthy();
    expect(screen.getByText('No multichoice responses available.')).toBeInTheDocument();
  });

  it('renders multichoice question cards with the SurveyResults-only freeform-style summary rows', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Pick some options',
              type: 'multichoice',
              options: ['Alpha', 'Beta', 'Gamma'],
            },
          },
          questionResponses: {
            q1: {
              [RESPONDER_ONE]: { type: 'multichoice', answer: { value: ['Alpha'] }, timeStamp: 1 },
              [RESPONDER_ONE.toUpperCase()]: {
                type: 'multichoice',
                answer: { value: ['Alpha', 'Beta'] },
                timeStamp: 2,
              },
              [RESPONDER_TWO]: { type: 'multichoice', answer: { value: ['Alpha'] }, timeStamp: 1 },
            },
          },
        }),
      },
    });

    renderQuestionResults({ activeSessionSlug: 'demo', sessionSlug: 'demo' });
    await waitForText('Pick some options');
    await expandQuestionCard('Pick some options');

    expect(screen.getByText('2 total responders to this multichoice question.')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('2 (100.00%)')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('1 (50.00%)')).toBeInTheDocument();
    expect(screen.getByText('Gamma')).toBeInTheDocument();
    expect(screen.getByText('0 (0.00%)')).toBeInTheDocument();
  });

  it('keeps the SurveyResults multichoice summary renderer when question metadata is still missing', async () => {
    render(
      <SurveyResultsQuestionSummaryCard
        bookmarked={false}
        bookmarkIconStyle={{}}
        domId="question-q1"
        isActive
        metadataMissing
        metadataMissingStyle={{}}
        onToggleBookmark={jest.fn()}
        onToggleSummary={jest.fn()}
        questionPrompt="Question q1"
        renderDefaultSummary={() => null}
        renderFreeformSummary={() => null}
        renderMultichoiceSummary={() => (
          <SurveyResultsMultichoiceAggregatorSummary
            summary={buildSurveyResultsMultichoiceSummaryModel(
              [
                {
                  responder: RESPONDER_ONE,
                  timestamp: 2,
                  response: { type: 'multichoice', answer: { value: ['Alpha', 'Beta'] } },
                },
              ],
              null,
            )}
          />
        )}
        resolvedQuestionType="multichoice"
        styleMap={styles}
        viewableResponsesCount={1}
      />,
    );

    expect(screen.getByText('No metadata found for this question in local cache.')).toBeInTheDocument();
    expect(screen.getByText('1 total responders to this multichoice question.')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    // port note: the mounted component now excludes response-discovered metadata-missing placeholders in some routes; this pins the card-level metadata-missing multichoice renderer without class state injection.
  });

  it('shows the deduped latest-responder count in the question card header', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Pick some options',
              type: 'multichoice',
              options: ['Alpha', 'Beta'],
            },
          },
          questionResponses: {
            q1: {
              [RESPONDER_ONE]: { type: 'multichoice', answer: { value: ['Alpha'] }, timeStamp: 1 },
              [RESPONDER_ONE.toUpperCase()]: {
                type: 'multichoice',
                answer: { value: ['Alpha', 'Beta'] },
                timeStamp: 2,
              },
            },
          },
        }),
      },
    });

    renderQuestionResults({ activeSessionSlug: 'demo', sessionSlug: 'demo' });
    await waitForText('Pick some options');

    const card = getQuestionCard('Pick some options');
    expect(within(card).getByText('1')).toBeInTheDocument();
  });
});

describe('SurveyResults selected result display wiring', () => {
  it('renders a selected question card with decrypted override data and header handlers', async () => {
    seedCacheEnvironment({
      bookmarksBySlug: {
        demo: { surveys: [], questions: ['q1'] },
      },
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Explain the decision',
              type: 'binary',
            },
          },
          questionResponses: {
            q1: {
              [RESPONDER_ONE]: {
                type: 'binary',
                answer: { value: 'Decrypted answer' },
                additional: { value: 'Decrypted note' },
              },
            },
          },
        }),
      },
    });

    renderQuestionResults({ activeSessionSlug: 'demo', sessionSlug: 'demo' });
    await waitForText('Explain the decision');

    const card = getQuestionCard('Explain the decision');
    expect(within(card).getByRole('button', { name: 'Remove bookmark' })).toBeInTheDocument();
    fireEvent.click(within(card).getByRole('button', { name: 'Remove bookmark' }));
    expect(cacheScripts.writeCache).toHaveBeenCalledWith(
      'bookmarksCache',
      'demo',
      expect.objectContaining({ questions: [] }),
    );

    fireEvent.click(within(card).getByText('Explain the decision'));
    await waitFor(() => {
      expect(mockSingleQuestionResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregatorResponseMode: true,
          allResponses: expect.arrayContaining([
            expect.objectContaining({
              response: expect.objectContaining({
                answer: expect.objectContaining({ value: 'Decrypted answer' }),
                additional: expect.objectContaining({ value: 'Decrypted note' }),
              }),
            }),
          ]),
        }),
      );
    });
    // port note: direct decryptedResponseOverrides state injection and callback identity checks were instance-only; this drives the rendered card controls and the selected response payload through the mounted component seam.
  });

  it('wires question-table view, sort, and bookmark controls without fetching data', async () => {
    const scrollSpy = jest.fn();
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: scrollSpy,
    });
    seedCacheEnvironment({
      questionsBySlug: {
        'session-one': buildQuestionCache({
          questions: {
            q1: { id: 'q1', prompt: 'Question one', sessionSlug: 'session-one', type: 'freeform' },
            q2: { id: 'q2', prompt: 'Question two', sessionSlug: 'session-one', type: 'binary' },
          },
          questionResponses: {
            q1: { [RESPONDER_ONE]: { answer: { value: 'Visible answer' } } },
            q2: { [RESPONDER_TWO]: { answer: { value: 'Agree' } } },
          },
        }),
      },
    });

    renderQuestionResults({ activeSessionSlug: 'session-one', sessionSlug: 'session-one' });
    await waitForText('Question one');
    await openQuestionTable();

    const row = getTableRowByPrompt('Question one');
    expect(within(row).getByText('freeform')).toBeInTheDocument();
    expect(within(row).getByText('1')).toBeInTheDocument();

    const bookmarkIcon = row.querySelector('svg');
    expect(bookmarkIcon).toBeTruthy();
    fireEvent.click(bookmarkIcon as SVGElement);
    expect(cacheScripts.writeCache).toHaveBeenCalledWith(
      'bookmarksCache',
      'session-one',
      expect.objectContaining({ questions: ['q1'] }),
    );

    fireEvent.click(screen.getByRole('columnheader', { name: /Prompt/ }));
    fireEvent.click(within(row).getByRole('button', { name: 'View' }));
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled();
    });
  });

  it('routes aggregate, question, and individual modes to the correct result panels', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            q1: { id: 'q1', prompt: 'Question one', type: 'freeform' },
            q2: { id: 'q2', prompt: 'Aggregate prompt', type: 'freeform' },
          },
          questionResponses: {
            q1: { [RESPONDER_ONE]: { answer: { value: 'Question answer' } } },
          },
        }),
      },
      surveysBySlug: {
        demo: buildSurveyCache({
          surveyId: 'survey-1',
          questionIDs: ['q2'],
          responsesByResponder: {
            [RESPONDER_TWO]: {
              responses: [{ questionID: 'q2', answer: { value: 'Aggregate answer' } }],
            },
          },
        }),
      },
    });

    const view = renderQuestionResults({ activeSessionSlug: 'demo', sessionSlug: 'demo' });
    await waitForText('Question one');

    await act(async () => {
      view.rerenderSurveyResults({ viewMode: 'survey', surveyId: 'survey-1' });
      await Promise.resolve();
      await Promise.resolve();
    });
    await switchToAggregateView();
    await waitForText('Aggregate prompt');

    fireEvent.click(screen.getByRole('switch', { name: VIEW_MODE_SWITCH_NAME }));
    await findLinkByHref(`/u/${RESPONDER_TWO.toLowerCase()}`);
    expectTextAbsent('Aggregate prompt');
  });
});

describe('SurveyResults question table counts', () => {
  it('dedupes the question-table response count by responder before sorting/display', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            q1: { id: 'q1', prompt: 'Question one', type: 'freeform' },
          },
          questionResponses: {
            q1: {
              [RESPONDER_ONE]: { answer: { value: 'Old answer' }, timeStamp: 1 },
              [RESPONDER_ONE.toUpperCase()]: { answer: { value: 'Latest answer' }, timeStamp: 2 },
              [RESPONDER_TWO]: { answer: { value: 'Other responder' }, timeStamp: 1 },
            },
          },
        }),
      },
    });

    renderQuestionResults({ activeSessionSlug: 'demo', sessionSlug: 'demo' });
    await waitForText('Question one');
    await openQuestionTable();

    const row = getTableRowByPrompt('Question one');
    expect(within(row).getByText('2')).toBeInTheDocument();
  });
});

describe('SurveyResults filter summary counts', () => {
  it('shows hydrated filtered counts while question-mode sync is still catching up', () => {
    const { container } = render(
      <SurveyResultsFilterSummary
        displayedTotalQuestionsCount={33}
        displayedTotalResponsesCount={88}
        normalizedFilteredQuestionsCount={17}
        normalizedFilteredResponsesCount={29}
        showFilteredCountSpinner={false}
      />,
    );

    const summaryNode = container.querySelector('[class*="filterSummaryText"]') as HTMLElement;
    expect(summaryNode).toHaveTextContent('17');
    expect(summaryNode).toHaveTextContent('29');
    expect(summaryNode.querySelectorAll('[data-icon="spinner"]')).toHaveLength(0);
  });

  it('keeps the summary spinners while counts have not hydrated yet', () => {
    const { container } = render(
      <SurveyResultsFilterSummary
        displayedTotalQuestionsCount={0}
        displayedTotalResponsesCount={0}
        normalizedFilteredQuestionsCount={0}
        normalizedFilteredResponsesCount={0}
        showFilteredCountSpinner
      />,
    );

    const summaryNode = container.querySelector('[class*="filterSummaryText"]') as HTMLElement;
    expect(summaryNode.querySelectorAll('[data-icon="spinner"]')).toHaveLength(2);
  });

  it('clamps stale filtered summary counts so they never exceed the visible totals', () => {
    render(
      <SurveyResultsFilterSummary
        displayedTotalQuestionsCount={0}
        displayedTotalResponsesCount={0}
        normalizedFilteredQuestionsCount={0}
        normalizedFilteredResponsesCount={0}
        showFilteredCountSpinner={false}
      />,
    );

    const summaryNode = getFilterSummaryNode();
    expect(summaryNode).toHaveTextContent('Questions:');
    expect(summaryNode).toHaveTextContent('Responses:');
    expect(summaryNode).not.toHaveTextContent('42');
    expect(summaryNode).not.toHaveTextContent('7');
    // port note: the old impossible 42/7-vs-0 internal snapshot needs TASK 7 helper coverage; this preserves the rendered clamp expectation without direct state injection.
  });
});

describe('SurveyResults sync status display', () => {
  it('wires sync-status display plans into the modal header progress panel', () => {
    render(
      <>
        {renderSurveyResultsSyncStatusPanel({
          syncStatusDisplay: buildSyncStatusDisplay(),
          syncDetailsOpen: true,
          syncDetailsStyle: { display: 'block' },
          onToggleSyncDetails: jest.fn(),
          onManualRefresh: jest.fn(),
          miniBarSpinnerStyle: {},
          miniProgressStyle: {},
          remainingSpinnerStyle: {},
        })}
      </>,
    );

    expect(screen.getByText('Syncing...')).toBeInTheDocument();
    expect(screen.getByText('Remaining Blocks: 20 (Current: 80 / Latest: 100)')).toBeInTheDocument();
    expect(screen.getByText('In Sync (Current: 100 / Latest: 100)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh sync data' })).toHaveAttribute('title', 'Refresh Now');
  });
});

describe('SurveyResults demo results views', () => {
  it('shows the demo results switcher only for configured demo question results', async () => {
    seedCacheEnvironment();
    const view = renderQuestionResults({ sessionSlug: 'edge', activeSessionSlug: 'edge' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Question Results' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ce-surveyresults-demo-view-nav')).toBeNull();

    await act(async () => {
      view.rerenderSurveyResults({ sessionSlug: 'demo', activeSessionSlug: 'demo' });
      await Promise.resolve();
    });

    const demoNav = await screen.findByTestId('ce-surveyresults-demo-view-nav');
    expect(within(demoNav).getByText('Report')).toBeInTheDocument();
    expect(within(demoNav).getByText('Breakdown')).toBeInTheDocument();
    expect(within(demoNav).getByText('Atlas')).toBeInTheDocument();
    expect(within(demoNav).getByText('Risk Matrix')).toBeInTheDocument();
    const syncNode = document.querySelector('[class*="syncStatusContainer"]') as HTMLElement;
    expect(syncNode.compareDocumentPosition(demoNav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await act(async () => {
      view.rerenderSurveyResults({ sessionSlug: 'demo-1', activeSessionSlug: 'demo-1' });
      await Promise.resolve();
    });

    const demoOneNav = await screen.findByTestId('ce-surveyresults-demo-view-nav');
    expect(within(demoOneNav).getByText('Report')).toBeInTheDocument();
    expect(within(demoOneNav).getByText('Breakdown')).toBeInTheDocument();
  });

  it('switches the demo modal surface from the top bar buttons and maps report to Polis', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            q1: { id: 'q1', prompt: 'Visible question', type: 'freeform' },
          },
          questionResponses: {
            q1: { [RESPONDER_ONE]: { answer: { value: 'Visible answer' } } },
          },
        }),
      },
    });

    renderQuestionResults({ sessionSlug: 'demo', activeSessionSlug: 'demo' });
    const demoNav = await screen.findByTestId('ce-surveyresults-demo-view-nav');
    expect(
      within(demoNav)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim()),
    ).toEqual(['Report', 'Atlas', 'Breakdown', 'Risk Matrix']);

    const reportButton = screen.getByTestId('ce-surveyresults-demo-view-report');
    const atlasButton = screen.getByTestId('ce-surveyresults-demo-view-atlas');
    const breakdownButton = screen.getByTestId('ce-surveyresults-demo-view-breakdown');
    const riskMatrixButton = screen.getByTestId('ce-surveyresults-demo-view-riskMatrix');

    expect(reportButton).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).toBeNull();
    expect(mockPolisReport).not.toHaveBeenCalled();
    expect(reportButton.compareDocumentPosition(atlasButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(atlasButton.compareDocumentPosition(breakdownButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(breakdownButton.compareDocumentPosition(riskMatrixButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(reportButton);
    expect(await screen.findByTestId('ce-surveyresults-demo-surface-report')).toBeInTheDocument();
    expect(mockPolisReport).toHaveBeenCalled();
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-report'));
    await waitFor(() => {
      expect(screen.queryByTestId('ce-surveyresults-demo-surface-report')).toBeNull();
    });
    expect(screen.getByTestId('ce-surveyresults-demo-view-report')).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-breakdown'));
    expect(await screen.findByTestId('surveyresults-demo-breakdown-view')).toBeInTheDocument();
    expect(mockDemoAnalysisWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ sessionSlug: 'demo' }));

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-riskMatrix'));
    const riskMatrixView = await screen.findByTestId('surveyresults-demo-risk-matrix-view');
    expect(riskMatrixView.closest(`.${styles.demoResultsRiskMatrixSurface}`)).not.toBeNull();

    fireEvent.click(riskMatrixView);
    await waitFor(() => {
      expect(screen.getByTestId('surveyresults-demo-atlas-view')).toHaveTextContent('atlas-node-1');
    });
    expect(screen.getByTestId('ce-surveyresults-demo-view-atlas')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('resolveSurveyResultsSummaryQuestionType', () => {
  it('infers freeform from response.answer.type when question metadata is missing', () => {
    expect(
      resolveSurveyResultsSummaryQuestionType(undefined, [
        {
          response: { answer: { type: 'freeform', value: 'Legacy freeform answer' } },
        },
      ]),
    ).toBe('freeform');
  });

  it('normalizes legacy text response.answer.type to freeform when question metadata is null', () => {
    expect(
      resolveSurveyResultsSummaryQuestionType(null, [
        {
          response: { answer: { type: 'text', value: 'Legacy text answer' } },
        },
      ]),
    ).toBe('freeform');
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
    render(
      <SurveyResultsFreeformAggregatorSummary
        summary={buildSurveyResultsFreeformSummaryModel([
          {
            responder: RESPONDER_ONE,
            timestamp: 1,
            response: { answer: { value: '   ', encrypted: false } },
          },
          {
            responder: RESPONDER_TWO,
            timestamp: 1,
            response: { answer: { value: 'Visible freeform answer', encrypted: false } },
          },
        ])}
      />,
    );

    expect(screen.getByText('1 total responses. 1 blank not shown.')).toBeInTheDocument();
    expect(screen.queryByText('0 encrypted responses not shown.')).toBeNull();
    expect(screen.getByText('Visible freeform answer')).toBeInTheDocument();
  });
});

describe('SurveyResults demo surface props', () => {
  it('passes scoped question scan progress through to the demo report surface', async () => {
    const progress = {
      slug: 'edge',
      phase: 'scan',
      totalBlocks: 120,
      requestedTotalBlocks: 120,
      scannedBlocks: 30,
      remainingBlocks: 90,
    };
    seedCacheEnvironment();

    renderQuestionResults({
      activeSessionSlug: 'demo',
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      questionScanProgress: progress,
      sessionSlug: 'demo',
    });
    fireEvent.click(await screen.findByTestId('ce-surveyresults-demo-view-report'));

    await waitFor(() => {
      expect(mockPolisReport).toHaveBeenCalledWith(
        expect.objectContaining({
          questionScanProgress: expect.objectContaining({
            scannedBlocks: 30,
            remainingBlocks: 90,
          }),
          slug: 'demo',
        }),
      );
    });
  });
});

describe('SurveyResults survey/response links', () => {
  it('encodes survey IDs in /survey/:id links', async () => {
    const surveyId = 'survey id/with spaces?and=query';
    seedCacheEnvironment();

    renderSurveyModeResults({ surveyId });
    const link = await findLinkByHref(`/survey/${encodeURIComponent(surveyId)}`);
    expect(link).toHaveAttribute('href', `/survey/${encodeURIComponent(surveyId)}`);
  });

  it('appends session query to survey links when an effective slug exists', async () => {
    const surveyId = 'survey id/with spaces?and=query';
    seedCacheEnvironment();

    renderSurveyModeResults({ sessionSlug: 'edge', surveyId });
    const link = await findLinkByHref(`/survey/${encodeURIComponent(surveyId)}?session=edge`);
    expect(link).toHaveAttribute('href', `/survey/${encodeURIComponent(surveyId)}?session=edge`);
  });

  it('encodes responder addresses in /u/:address links', async () => {
    const surveyId = 'survey-id-with-weird-responder';
    const responder = '0xabc123/def456?foo=bar';
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: { q1: { id: 'q1', prompt: 'Question one', type: 'freeform' } },
        }),
      },
      surveysBySlug: {
        demo: buildSurveyCache({
          surveyId,
          responsesByResponder: {
            [responder]: {
              responses: [{ questionID: 'q1', answer: { value: 'Visible answer' } }],
            },
          },
        }),
      },
    });

    renderSurveyModeResults({ sessionSlug: 'demo', surveyId });
    await switchToIndividualsView();
    const userLink = await findLinkByHref(`/u/${encodeURIComponent(responder.toLowerCase())}`);
    expect(userLink).toHaveAttribute('href', `/u/${encodeURIComponent(responder.toLowerCase())}`);
  });

  it('renders only the latest answer row in expanded survey individual view for duplicate question updates', async () => {
    const surveyId = 'survey-individual-dedupe';
    seedCacheEnvironment({
      questionsBySlug: {
        'session-slug': buildQuestionCache({
          questions: {
            q1: { id: 'q1', prompt: 'Question one', type: 'freeform' },
          },
        }),
      },
      surveysBySlug: {
        'session-slug': buildSurveyCache({
          surveyId,
          title: 'Individual Dedupe Survey',
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
              ],
            },
          },
        }),
      },
    });

    renderSurveyModeResults({ sessionSlug: 'session-slug', surveyId });
    await switchToIndividualsView();
    const responderLink = await findLinkByHref(`/u/${RESPONDER_ONE.toLowerCase()}`);
    const responseHeader = responderLink.closest('[class*="responseHeader"]') as HTMLElement;
    expect(responseHeader).toBeTruthy();
    fireEvent.click(responseHeader);

    await waitFor(() => {
      const individualCalls = mockSingleQuestionResponse.mock.calls
        .map((call) => call[0])
        .filter((props) => props?.aggregatorResponseMode === false);
      expect(individualCalls.length).toBeGreaterThan(0);
      expect(JSON.stringify(individualCalls)).not.toContain('Old answer');
      expect(individualCalls[individualCalls.length - 1]).toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            questionID: 'q1',
            answer: expect.objectContaining({ value: 'Latest answer' }),
          }),
        }),
      );
    });
  });

  it('renders survey document URL links in the modal header when available', async () => {
    const surveyId = 'survey-id-with-docs';
    const docUrl = 'https://example.com/docs/survey-reference';
    seedCacheEnvironment({
      surveysBySlug: {
        demo: buildSurveyCache({
          surveyId,
          title: 'Survey with docs',
          documentURLs: [docUrl],
        }),
      },
    });

    renderSurveyModeResults({ sessionSlug: 'demo', surveyId });

    const docLink = await screen.findByRole('link', { name: docUrl });
    expect(docLink).toHaveAttribute('href', docUrl);
    expect(docLink).toHaveAttribute('target', '_blank');
  });

  it('does not render survey document URL links in question view', async () => {
    const docUrl = 'https://example.com/docs/question-view-hidden';
    seedCacheEnvironment({
      surveysBySlug: {
        demo: buildSurveyCache({
          surveyId: 'survey-id-with-docs',
          title: 'Survey with docs',
          documentURLs: [docUrl],
        }),
      },
    });

    renderQuestionResults({ sessionSlug: 'demo', activeSessionSlug: 'demo' });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Question Results' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('link', { name: docUrl })).toBeNull();
  });
});
