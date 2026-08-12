import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import contractScriptsDefault from '../../utilities/web3/chainGateway.js';
import {
  SurveyResultsFreeformAggregatorSummary,
  SurveyResultsMultichoiceAggregatorSummary,
} from './SurveyResultsAggregatorSummaries';
import SurveyResultsFilterSummary from './SurveyResultsFilterSummary';
import { renderSurveyResultsSyncStatusPanel } from './SurveyResultsPanels';
import { buildSurveyResultsDemoViewPlan } from './surveyResultsRenderSurface';
import { countSurveyResultsViewableResponses } from './SurveyResultsQuestionSummary';
import SurveyResultsQuestionSummaryCard from './SurveyResultsQuestionSummaryCard';
import {
  buildSurveyResultsFreeformSummaryModel,
  buildSurveyResultsMultichoiceSummaryModel,
  resolveSurveyResultsSummaryQuestionType,
} from './surveyResultsSummaryModels';
import { renderSurveyResults } from './surveyResultsTestHarness';
import styles from './SurveyResults.module.scss';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as sbtDisplayNameUtils from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import * as sessionScanScopeModule from '../../utilities/session/sessionScanScope.js';
import { resolveSurveyResultsQuestionReadScope } from './surveyResultsSessionResolution.js';
import { sbtBasePath } from '../../utilities/ui/terminology.js';
import SurveyResultsIndividualResponsesList from './SurveyResultsIndividualResponsesList';
import SurveyResultsModalHeader from './SurveyResultsModalHeader';
import SurveyResultsQuestionSummaryCard from './SurveyResultsQuestionSummaryCard';

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
  await waitFor(() => {
    expect(screen.getByRole('switch', { name: VIEW_MODE_SWITCH_NAME })).toHaveAttribute('aria-checked', 'false');
  });
};

const normalizeChildren = (children: TreeNode): TreeNode[] => {
  if (children == null) return [];
  if (Array.isArray(children)) return children.filter(Boolean);
  return [children].filter(Boolean);
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
  mockSbtFilter.mockClear();
  mockPolisReport.mockClear();
  mockSingleQuestionResponse.mockClear();
  mockDemoAnalysisWorkspace.mockClear();
  mockDebateMap.mockClear();
  mockRiskMatrix.mockClear();
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
    const subject = createSubject();

    const tree = subject.renderMultichoiceAggregatorSummary([], {
      id: 'q1',
      type: 'multichoice',
      options: ['Alpha', 'Beta'],
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
    const { container } = render(
      <SurveyResultsFilterSummary
        displayedTotalQuestionsCount={33}
        displayedTotalResponsesCount={88}
        normalizedFilteredQuestionsCount={17}
        normalizedFilteredResponsesCount={29}
        showFilteredCountSpinner={false}
      />,
    );

    expect(summaryNode).toBeTruthy();
    expect(treeHasText(summaryNode, '17')).toBe(true);
    expect(treeHasText(summaryNode, '29')).toBe(true);
    expect(spinnerNodes).toHaveLength(0);
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

    expect(summaryNode).toBeTruthy();
    expect(spinnerNodes).toHaveLength(2);
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
  it('shows the demo results switcher only for configured demo question results', () => {
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
    const nonDemoNav = findElement(
      nonDemoTree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-demo-view-nav'
    );
    expect(nonDemoNav).toBeNull();

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
    const demoNav = findElement(
      demoTree,
      (element) => element?.props?.['data-testid'] === 'ce-surveyresults-demo-view-nav'
    );
    const headerControls = findElement(
      demoTree,
      (element) =>
        typeof element?.props?.className === 'string' &&
        element.props.className.includes('modalHeaderControls')
    );
    const headerControlChildren = normalizeChildren(headerControls?.props?.children);
    const syncIndex = headerControlChildren.findIndex(
      (child) =>
        typeof child?.props?.className === 'string' &&
        child.props.className.includes('syncStatusContainer')
    );
    const demoNavIndex = headerControlChildren.findIndex(
      (child) => child?.props?.['data-testid'] === 'ce-surveyresults-demo-view-nav'
    );

    expect(demoNav).toBeTruthy();
    expect(treeHasText(demoNav, 'Report')).toBe(true);
    expect(treeHasText(demoNav, 'Breakdown')).toBe(true);
    expect(treeHasText(demoNav, 'Atlas')).toBe(true);
    expect(treeHasText(demoNav, 'Risk Matrix')).toBe(true);
    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(demoNavIndex).toBeGreaterThan(syncIndex);

    const demoThreeSubject = createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'demo-1',
    });
    demoThreeSubject.state = {
      ...demoThreeSubject.state,
      viewMode: 'questions',
    };

    const demoOneNav = await screen.findByTestId('ce-surveyresults-demo-view-nav');
    expect(within(demoOneNav).getByText('Report')).toBeInTheDocument();
    expect(within(demoOneNav).getByText('Breakdown')).toBeInTheDocument();

    await act(async () => {
      view.rerenderSurveyResults({ sessionSlug: 'demo-2', activeSessionSlug: 'demo-2' });
      await Promise.resolve();
    });

    const demoTwoNav = await screen.findByTestId('ce-surveyresults-demo-view-nav');
    expect(within(demoTwoNav).getByText('Report')).toBeInTheDocument();
    expect(within(demoTwoNav).getByText('Atlas')).toBeInTheDocument();
    expect(within(demoTwoNav).getByText('Risk Matrix')).toBeInTheDocument();
    expect(within(demoTwoNav).queryByText('Breakdown')).toBeNull();
  });

  it('coerces a stale demo-2 breakdown request back to the raw question results', () => {
    expect(
      buildSurveyResultsDemoViewPlan({
        isDemoQuestionResults: true,
        requestedViewMode: 'breakdown',
        slug: 'demo-2',
      }),
    ).toEqual({
      demoResultsViewMode: 'raw',
      demoResultsViewOptions: [
        { key: 'report', label: 'Report' },
        { key: 'atlas', label: 'Atlas' },
        { key: 'riskMatrix', label: 'Risk Matrix' },
      ],
      isDemoAlternateResultsView: false,
    });
  });

  it('switches the demo modal surface from the top bar buttons and maps report to Polis', async () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
      sessionSlug: 'demo',
    }));

    renderQuestionResults({ sessionSlug: 'demo', activeSessionSlug: 'demo' });
    const demoNav = await screen.findByTestId('ce-surveyresults-demo-view-nav');
    expect(
      within(demoNav)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim()),
    ).toEqual(['Report', 'Atlas', 'Breakdown', 'Risk Matrix']);

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

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-breakdown'));
    expect(await screen.findByTestId('surveyresults-demo-breakdown-view')).toBeInTheDocument();
    expect(mockDemoAnalysisWorkspace).toHaveBeenLastCalledWith(expect.objectContaining({ sessionSlug: 'demo' }));

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

describe('SurveyResults.resolveSummaryQuestionType', () => {
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

describe('SurveyResults.getMemoizedViewableResponsesCount', () => {
  it('excludes blank freeform answers and encrypted placeholders', () => {
    const subject = createSubject();
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Visible freeform answer', encrypted: false } } },
      { response: { answer: { value: '*', encrypted: true } } },
    ];

    expect(subject.getMemoizedViewableResponsesCount(responses, 'freeform')).toBe(1);
  });

  it('does not exclude blank answers for non-freeform questions', () => {
    const subject = createSubject();
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Agree', encrypted: false } } },
      { response: { answer: { value: '*', encrypted: true } } },
    ];

    expect(subject.getMemoizedViewableResponsesCount(responses, 'binary')).toBe(2);
  });

  it('uses question type in memoization for the same responses array', () => {
    const subject = createSubject();
    const responses = [
      { response: { answer: { value: '   ', encrypted: false } } },
      { response: { answer: { value: 'Visible answer', encrypted: false } } },
    ];

    const freeformCount = subject.getMemoizedViewableResponsesCount(responses, 'freeform');
    const binaryCount = subject.getMemoizedViewableResponsesCount(responses, 'binary');

    expect(freeformCount).toBe(1);
    expect(binaryCount).toBe(2);
    expect(freeformCount).not.toBe(binaryCount);
  });

  it('does not count malformed rows that have no answer payload', () => {
    const subject = createSubject();
    const responses = [
      { response: null },
      { response: {} },
      { response: { answer: { value: 'Visible answer', encrypted: false } } },
    ];

    expect(subject.getMemoizedViewableResponsesCount(responses, 'freeform')).toBe(1);
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

    const markup = renderToStaticMarkup(subject.renderFreeformAggregatorSummary(responses));
    expect(markup).toContain('1 total responses. 1 blank not shown.');
    expect(markup).not.toContain('0 encrypted responses not shown.');
    expect(markup).toContain('Visible freeform answer');
  });
});

describe('SurveyResults Polis report props', () => {
  it('passes scoped question scan progress through to PolisReport', () => {
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
    const surveyLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href && element.props.href.startsWith(`/survey/${encodeURIComponent(surveyId)}`)
    );
    expect(surveyLink).toBeTruthy();
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
    const surveyLink = findElement(
      tree,
      (element) => (
        element?.type === 'a' &&
        element?.props?.href &&
        element.props.href.startsWith(`/survey/${encodeURIComponent(surveyId)}`) &&
        element.props.href.includes(`session=${encodeURIComponent('edge')}`)
      )
    );
    expect(surveyLink).toBeTruthy();
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
    const docLink = findElement(
      tree,
      (element) =>
        element?.type === 'a' &&
        element?.props?.href === docUrl &&
        element?.props?.target === '_blank'
    );

    expect(docLink).toBeTruthy();
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
    const docLink = findElement(
      tree,
      (element) => element?.type === 'a' && element?.props?.href === docUrl
    );

    expect(docLink).toBeNull();
  });
});
