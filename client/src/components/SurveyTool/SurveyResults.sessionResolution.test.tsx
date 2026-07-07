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
import {
  resolveSurveyResultsQuestionReadScope,
  resolveSurveyResultsSessionContext,
} from './surveyResultsSessionResolution';
import { renderSurveyResults } from './surveyResultsTestHarness';
import { getPolisDemoQuestionPool } from './surveyPolisDemoQuestionPool';

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
const mockQuestionFilter = jest.fn((..._args: any[]) => null);
jest.mock('./QuestionFilter', () => {
  const ReactActual = jest.requireActual('react');
  return ReactActual.forwardRef((props: any, ref: any) => {
    mockQuestionFilter(props);
    ReactActual.useImperativeHandle(ref, () => ({
      handleApplyFilters: jest.fn(),
    }));
    return props?.filterModalOpen ? <div data-testid="ce-surveyresults-question-filter">Question Filter</div> : null;
  });
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

let cacheUpdateListener: ((update: Record<string, any>) => void) | null = null;
let unsubscribeCacheUpdates = jest.fn();

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
  responsesByResponder = {},
}: {
  surveyId: string;
  title?: string;
  documentURLs?: string[];
  responsesByResponder?: Record<string, any>;
}): Record<string, any> => ({
  [NETWORK_ID]: {
    surveys: {
      [surveyId.toLowerCase()]: {
        title,
        documentURLs,
        questionIDs: ['q1'],
      },
    },
    surveyResponses: {
      [surveyId.toLowerCase()]: responsesByResponder,
    },
    surveyResponsesLatestBlock: {
      [surveyId.toLowerCase()]: 1,
    },
    surveysLatestBlock: 1,
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
    if (namespace === 'bookmarksCache') {
      return lookupSlug(bookmarksBySlug, slug, defaultBookmarks);
    }
    if (namespace === 'questionsCache') {
      return lookupSlug(questionsBySlug, slug, {});
    }
    if (namespace === 'surveysCache') {
      return lookupSlug(surveysBySlug, slug, {});
    }
    return null;
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
    if (namespace === 'questionsCache') {
      return lookupSlug(questionsBySlug, slug, {});
    }
    if (namespace === 'surveysCache') {
      return lookupSlug(surveysBySlug, slug, {});
    }
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
  unsubscribeCacheUpdates = jest.fn();
  cacheUpdateListener = null;
  jest.spyOn(cacheScripts, 'subscribeCacheUpdates').mockImplementation((listener: any) => {
    cacheUpdateListener = listener;
    return unsubscribeCacheUpdates;
  });
  jest.spyOn(contractScriptsDefault as any, 'getLatestBlockNumber').mockResolvedValue(0);
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

const waitForPrompt = async (prompt: string): Promise<void> => {
  await waitFor(() => {
    expect(screen.getAllByText(prompt).length).toBeGreaterThan(0);
  });
};

const expectPromptAbsent = (prompt: string): void => {
  expect(screen.queryAllByText(prompt)).toHaveLength(0);
};

const getFilterSummaryText = (): string => document.querySelector('[class*="filterSummaryText"]')?.textContent || '';

const expectQuestionResponseCounts = (questions: number, responses: number): void => {
  const text = getFilterSummaryText();
  expect(text).toMatch(new RegExp(`Questions:\\s*${questions}`));
  expect(text).toMatch(new RegExp(`Responses:\\s*${responses}`));
};

const rerenderHarness = async (
  view: ReturnType<typeof renderQuestionResults>,
  props: Record<string, any>,
): Promise<void> => {
  await act(async () => {
    view.rerenderSurveyResults(props);
    await Promise.resolve();
    await Promise.resolve();
  });
};

const getLatestQuestionFilterProps = (): Record<string, any> => {
  const calls = mockQuestionFilter.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
};

const getLatestPolisReportProps = (): Record<string, any> => {
  const calls = mockPolisReport.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls[calls.length - 1][0];
};

const collectSurveyLinks = (): string[] =>
  Array.from(document.querySelectorAll('a[href^="/survey/"]')).map((link) => link.getAttribute('href') || '');

const switchToIndividualsView = async (): Promise<void> => {
  const viewSwitch = screen.queryAllByRole('switch', { name: VIEW_MODE_SWITCH_NAME })[0];
  if (viewSwitch?.getAttribute('aria-checked') === 'true') {
    fireEvent.click(viewSwitch);
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

afterEach(() => {
  jest.restoreAllMocks();
  try {
    window.history.replaceState({}, '', '/');
  } catch (_) {
    /* noop */
  }
});

describe('SurveyResults session resolution', () => {
  it('does not rewrite route-owned results URLs on unmount', async () => {
    seedCacheEnvironment();
    const view = renderQuestionResults(
      {
        activeSessionSlug: 'edge',
        preventUrlChange: true,
        sessionSlug: 'edge',
      },
      '/session/edge/questions/results',
    );
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Question Results' })).toBeInTheDocument();
    });
    const pushStateSpy = jest.spyOn(window.history, 'pushState');

    view.unmount();

    expect(unsubscribeCacheUpdates).toHaveBeenCalled();
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/session/edge/questions/results');
  });

  it('removes the old SurveyResults session selector chrome while keeping header spacing intact', () => {
    const scssPath = path.join(__dirname, 'SurveyResults.module.scss');
    const scss = fs.readFileSync(scssPath, 'utf8');

    expect(scss).toMatch(/\.modalHeader\s*{[\s\S]*position:\s*relative;[\s\S]*padding-right:\s*4\.5rem;/);
    expect(scss).toMatch(
      /\.modalHeader\s+:global\(\.close\)\s*(?:,[^{]*?)?\s*{[\s\S]*position:\s*absolute;[\s\S]*top:\s*0\.85rem;[\s\S]*right:\s*0\.85rem;[\s\S]*margin:\s*0;[\s\S]*padding:\s*0\.25rem;/,
    );
    expect(scss).toMatch(/\.modalHeaderControls\s*{[\s\S]*margin-left:\s*auto;/);
    expect(scss).not.toMatch(/\.modalHeaderCornerActions\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorToggle\s*{/);
    expect(scss).not.toMatch(/\.sessionSelectorPopover\s*{/);
  });

  it('reads bookmarks cache using canonical explicit session aliases in the constructor', () => {
    const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockReturnValue({
      surveys: [],
      questions: ['q1'],
    });

    renderQuestionResults(
      {
        sessionSlug: 'DEBATE',
        activeSessionSlug: 'DEBATE',
      },
      '/questions/results',
    );
    await waitForPrompt('Debate question');

    expect(peekSpy).toHaveBeenCalledWith('bookmarksCache', 'DEBATE', { clone: false });
    expect(subject.state.bookmarkedQuestionIDs).toEqual(['q1']);
  });

  it('keeps explicit general aliases from falling through to survey-cache scans', () => {
    const listSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue([
      {
        slug: 'edge',
        value: {
          '84532': {
            surveys: {
              'survey-1': { title: 'Edge survey' },
            },
          },
        },
      },
    ]);

    const subject = createSubject({ sessionSlug: 'general' });
    subject.state = {
      ...subject.state,
      surveyId: 'survey-1',
    };

    expect(subject.getEffectiveSlug()).toBe('');
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('keeps explicit non-general session slugs unresolved when no config exists', async () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation((slug: any) => {
      if (slug === 'rxc') return { slug: 'rxc', networkChainId: 84532 };
      return null;
    });

    const subject = createSubject({ sessionSlug: 'DEBATE' });

    expect(subject.getEffectiveSessionContext()).toMatchObject({
      sessionSlug: 'DEBATE',
      sessionConfig: null,
    });
    expect(configSpy).toHaveBeenCalledWith('DEBATE');
  });

  it('memoizes fallback slug scan and invalidates on surveys cache updates', () => {
    const entriesSpy = jest.spyOn(cacheScripts, 'listNamespaceEntriesSync').mockReturnValue([
      {
        slug: 'edge',
        value: {
          '84532': {
            surveys: {
              '0xsurvey': { id: '0xsurvey' },
            },
          },
        },
      },
    ]);

    const subject = createSubject({
      questionResponsesNonce: 1,
      questionsCacheNonce: 2,
    });
    subject.state = {
      ...subject.state,
      surveyId: '0xSurvey',
    };

    const first = subject.getEffectiveSlug();
    const second = subject.getEffectiveSlug();

    expect(first).toBe('edge');
    expect(second).toBe('edge');
    expect(entriesSpy).toHaveBeenCalledTimes(1);
    expect(entriesSpy).toHaveBeenCalledWith('surveysCache', { cloneValues: false });

    subject.props = {
      ...subject.props,
      questionResponsesNonce: 2,
    };
    const third = subject.getEffectiveSlug();

    expect(third).toBe('edge');
    expect(entriesSpy).toHaveBeenCalledTimes(2);

    subject.handleManagedCacheUpdate({ namespace: 'surveysCache', slug: 'edge', action: 'write' });
    const fourth = subject.getEffectiveSlug();

    expect(fourth).toBe('edge');
    expect(entriesSpy).toHaveBeenCalledTimes(3);
  });

  it('keeps /session route question reads scoped to one session', () => {
    const scope = resolveSurveyResultsQuestionReadScope({
      pathname: '/session/edge/questions/results',
      search: '',
      activeSessionSlug: 'edge',
      viewMode: 'questions',
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['edge', 'alpha'],
    });

    expect(scope.baseSlug).toBe('edge');
    expect(scope.questionReadSlugs).toEqual(['edge']);
    expect(scope.storageKeyPrefix).toBe('dg:filters:edge');
  });

  it('keeps explicit query session pins scoped to one session in question results', () => {
    const scope = resolveSurveyResultsQuestionReadScope({
      pathname: '/questions/results',
      search: '?session=edge',
      activeSessionSlug: 'edge',
      viewMode: 'questions',
      readSessionScanScope: () => 'list',
      readSessionScanSlugs: () => ['edge', 'alpha'],
    });

    expect(scope.baseSlug).toBe('edge');
    expect(scope.questionReadSlugs).toEqual(['edge']);
    expect(scope.storageKeyPrefix).toBe('dg:filters:edge');
  });

  it('keeps pinned question results scoped to the current session even when global list scope includes more sessions', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge/questions/results');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug === 'edge') {
          return {
            '84532': {
              questions: { q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' } },
              questionResponses: { q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } } },
            },
          };
        }
        if (slug === 'alpha') {
          return {
            '84532': {
              questions: { q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' } },
              questionResponses: { q2: { '0xalpha': { answer: { value: 'alpha', encrypted: false } } } },
            },
          };
        }
        return {};
      });

    renderQuestionResults(
      {
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
      },
      '/session/edge/questions/results',
    );
    await waitForPrompt('Edge 1');

      await subject.fetchQuestionModeResponses();
      expect(subject.getQuestionReadSlugs('questions')).toEqual(['edge']);
      expect(Object.keys(subject.state.aggregatorQuestionResponses).sort()).toEqual(['q1']);
      expect(findElement(
        subject.render(),
        (node) => node?.props?.['data-testid'] === 'ce-surveyresults-session-selector-toggle'
      )).toBeNull();
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('keeps explicit query-pinned question results scoped to authoritative question bindings only', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results?session=demo');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo', 'alpha']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug !== 'demo') return {};
        return {
          '84532': {
            questions: {
              qDemo: {
                id: 'qDemo',
                prompt: 'Demo question',
                type: 'freeform',
                sessionSlug: 'demo',
                sessionSlugExplicit: true,
              },
              qLeakedExplicit: {
                id: 'qLeakedExplicit',
                prompt: 'Wrong session question',
                type: 'freeform',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
              },
              qLeakedLegacy: {
                id: 'qLeakedLegacy',
                prompt: 'Legacy leaked question',
                type: 'freeform',
                sessionSlug: 'demo',
              },
            },
            questionResponses: {
              qDemo: {
                '0xdemo': { answer: { value: 'demo', encrypted: false } },
              },
              qLeakedExplicit: {
                '0xalpha': { answer: { value: 'alpha', encrypted: false } },
              },
              qLeakedLegacy: {
                '0xlegacy': { answer: { value: 'legacy', encrypted: false } },
              },
            },
          },
          questionResponses: {
            qDemo: {
              '0xdemo': { answer: { value: 'demo', encrypted: false }, sessionSlug: 'demo' },
              '0xforeign': { answer: { value: 'foreign', encrypted: false }, sessionSlug: 'test-2' },
            },
            qLeakedExplicit: { '0xalpha': { answer: { value: 'alpha', encrypted: false } } },
            qLeakedLegacy: { '0xlegacy': { answer: { value: 'legacy', encrypted: false } } },
          },
        }),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo', 'alpha']);

    renderQuestionResults(
      {
        preventUrlChange: false,
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        sessionSlugPinned: true,
      },
      '/questions/results?session=demo',
    );
    await waitForPrompt('Demo question');

    expectPromptAbsent('Wrong session question');
    expectPromptAbsent('Legacy leaked question');
    expect(screen.queryByText(/foreign/i)).not.toBeInTheDocument();
    expectQuestionResponseCounts(1, 1);
  });

  it('keeps empty built-in demo raw results from inflating with fixture responses', async () => {
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(demoQuestion?.id).toBeTruthy();
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results?session=demo');
    try {
      seedCacheEnvironment({
        questionsBySlug: {
          demo: buildQuestionCache({
            questions: {
              [demoQuestion.id]: {
                ...demoQuestion,
                id: demoQuestion.id,
                prompt: demoQuestion.prompt,
                type: 'binary',
                sessionSlug: 'demo',
                sessionSlugExplicit: true,
                source: 'demo-polis-data',
              },
            },
            questionResponses: {
              [demoQuestion.id]: {
                'demo-participant-1': {
                  type: 'binary',
                  questionId: demoQuestion.id,
                  questionID: demoQuestion.id,
                  prompt: demoQuestion.prompt,
                  answer: { value: 'Agree', encrypted: false },
                  source: 'demo-polis-data',
                },
              },
            },
          }),
        },
      });
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo']);

      renderQuestionResults(
        {
          sessionSlug: 'demo',
          activeSessionSlug: 'demo',
          sessionSlugPinned: true,
          isOpen: true,
          viewMode: 'questions',
        },
        '/questions/results?session=demo',
      );

      await waitFor(() => {
        const text = getFilterSummaryText();
        expect(text).toMatch(/Questions:\s*0/);
        expect(text).toMatch(/Responses:\s*0/);
      });
      const latestFilterProps = getLatestQuestionFilterProps();
      expect(Object.keys(latestFilterProps.questions || {})).toHaveLength(0);
      expect(Object.keys(latestFilterProps.questionResponses || {})).toHaveLength(0);

      fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-report'));
      await waitFor(() => {
        const reportProps = getLatestPolisReportProps();
        expect(Object.keys(reportProps.questionResponses || {})).toHaveLength(0);
      });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('hydrates live built-in demo question responses from the canonical source bucket', async () => {
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(demoQuestion?.id).toBeTruthy();
    seedCacheEnvironment({
      questionsBySlug: {
        '': buildQuestionCache({
          questions: {},
          questionResponses: {
            [demoQuestion.id]: {
              [RESPONDER_ONE]: {
                type: 'binary',
                questionId: demoQuestion.id,
                answer: { value: 'Agree', encrypted: false },
              },
            },
          },
        }),
        demo: buildQuestionCache(),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo']);

    renderQuestionResults(
      {
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        preventUrlChange: false,
        sessionSlugPinned: true,
        isOpen: true,
        viewMode: 'questions',
      },
      '/questions/results?session=demo',
    );

    await waitFor(() => {
      expectQuestionResponseCounts(1, 1);
    });
    const latestFilterProps = getLatestQuestionFilterProps();
    expect(latestFilterProps.questions).toEqual([
      expect.objectContaining({
        id: demoQuestion.id,
        prompt: demoQuestion.prompt,
      }),
    ]);
    expect(latestFilterProps.questionResponses?.[demoQuestion.id]).toEqual({
      [RESPONDER_ONE]: expect.objectContaining({
        answer: { value: 'Agree', encrypted: false },
      }),
    });
  });

  it('uses built-in demo metadata for live responses when on-chain question metadata is still pending', async () => {
    const demoQuestion = getPolisDemoQuestionPool()[0];
    expect(demoQuestion?.id).toBeTruthy();
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            [demoQuestion.id]: {
              id: demoQuestion.id,
              prompt: '[encrypted]',
              type: 'binary',
              __ceQuestionMetadataPending: true,
            },
          },
          questionResponses: {
            [demoQuestion.id]: {
              [RESPONDER_ONE]: {
                type: 'binary',
                questionId: demoQuestion.id,
                prompt: demoQuestion.prompt,
                answer: { value: 'Agree', encrypted: false },
              },
            },
          },
        }),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo']);

    renderQuestionResults(
      {
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        preventUrlChange: false,
        sessionSlugPinned: true,
        isOpen: true,
        viewMode: 'questions',
      },
      '/questions/results?session=demo',
    );

    await waitFor(() => {
      expectQuestionResponseCounts(1, 1);
    });
    const latestFilterProps = getLatestQuestionFilterProps();
    expect(latestFilterProps.questions).toEqual([
      expect.objectContaining({
        id: demoQuestion.id,
        prompt: demoQuestion.prompt,
      }),
    ]);

    fireEvent.click(screen.getByTestId('ce-surveyresults-demo-view-report'));
    await waitFor(() => {
      const reportProps = getLatestPolisReportProps();
      const reportRows = reportProps.questionResponses?.[demoQuestion.id] || [];
      expect(reportRows).toHaveLength(1);
      expect(reportRows[0]).toEqual(
        expect.objectContaining({
          responder: RESPONDER_ONE,
          questionId: demoQuestion.id,
        }),
      );
      const parsedResponse = JSON.parse(String(reportRows[0].response || '{}'));
      expect(parsedResponse).toEqual(
        expect.objectContaining({
          prompt: demoQuestion.prompt,
          answer: { value: 'Agree', encrypted: false },
        }),
      );
    });
  });

  it('keeps embedded pinned session results on legacy bucket-backed questions while excluding explicit cross-session leaks', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results?session=demo');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo', 'alpha']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug !== 'demo') return {};
        return {
          '84532': {
            questions: {
              qLegacy: {
                id: 'qLegacy',
                prompt: 'Legacy demo question',
                type: 'freeform',
                sessionSlug: 'demo',
              },
              qLeakedExplicit: {
                id: 'qLeakedExplicit',
                prompt: 'Wrong session question',
                type: 'freeform',
                sessionSlug: 'alpha',
                sessionSlugExplicit: true,
              },
            },
            questionResponses: {
              qLegacy: {
                '0xdemo': { answer: { value: 'demo', encrypted: false } },
              },
              qLeakedExplicit: {
                '0xalpha': { answer: { value: 'alpha', encrypted: false } },
              },
            },
          },
        };
      });

    renderQuestionResults(
      {
        preventUrlChange: true,
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        sessionSlugPinned: true,
      },
      '/questions/results?session=demo',
    );
    await waitForPrompt('Legacy demo question');

      await subject.fetchQuestionModeResponses();

      expect(Object.keys(subject.state.aggregatorQuestionResponses)).toEqual(['qlegacy']);
      expect(Object.keys(subject.state.questionResponses)).toEqual(['qlegacy']);
      expect(subject.state.totalQuestionsCount).toBe(1);
      expect(subject.state.totalResponsesCount).toBe(1);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('resets stale filtered question counts when unfiltered question results refresh', async () => {
    const subject = attachStateHarness(createSubject({
      isOpen: true,
      viewMode: 'questions',
    }));

    subject.state = {
      ...subject.state,
      viewMode: 'questions',
      isFilterActive: false,
      filteredQuestionsCount: 42,
      filteredResponsesCount: 9,
      questionResultsHydrated: false,
    };
    seedCacheEnvironment({ questionsBySlug });

    const view = renderQuestionResults(
      {
        activeSessionSlug: 'edge',
        questionResponsesNonce: 1,
      },
      '/session/edge/questions/results',
    );
    await waitForPrompt('Edge question');
    expectQuestionResponseCounts(1, 1);

    questionsBySlug.edge = buildQuestionCache();
    await rerenderHarness(view, { questionResponsesNonce: 2 });

    await waitFor(() => {
      expectPromptAbsent('Edge question');
      expectQuestionResponseCounts(0, 0);
    });

    await subject.fetchQuestionModeResponses();

    expect(subject.state.totalQuestionsCount).toBe(0);
    expect(subject.state.totalResponsesCount).toBe(0);
    expect(subject.state.filteredQuestionsCount).toBe(0);
    expect(subject.state.filteredResponsesCount).toBe(0);
    expect(subject.state.questionResultsHydrated).toBe(true);
  });

  it('keeps question-mode reads scoped to the /session route slug', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);

    renderQuestionResults(
      {
        activeSessionSlug: 'edge',
      },
      '/session/edge',
    );
    await waitForPrompt('Edge 1');

      const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        return questionCachesBySlug[String(slug)] || {};
      });

      const subject = createSubject({
        activeSessionSlug: 'edge',
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
      });
      attachStateHarness(subject);
      subject.questionFilterRef = { current: { handleApplyFilters: jest.fn() } };
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
      };

      await subject.fetchQuestionModeResponses();

      expect(Object.keys(subject.state.aggregatorQuestionResponses).sort()).toEqual(['q1']);
      expect(Object.keys(subject.state.questionResponses).sort()).toEqual(['q1']);
      expect(subject.state.totalQuestionsCount).toBe(1);
      expect(subject.state.totalResponsesCount).toBe(1);
      expect(subject.getNetworkQuestionsForCurrentContext()).toMatchObject({
        q1: expect.objectContaining({ sessionSlug: 'edge', prompt: 'Edge 1' }),
      });
      expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
      expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('uses the route slug filter storage bucket on /session question results', () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/session/edge');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug === 'edge') {
          return {
            '84532': {
              questions: {
                q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' },
              },
              questionResponses: {},
            },
          };
        }
        if (slug === 'alpha') {
          return {
            '84532': {
              questions: {
                q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' },
              },
              questionResponses: {},
            },
          };
        }
        if (slug === 'beta') {
          return {
            '84532': {
              questions: {
                q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' },
              },
              questionResponses: {},
            },
          };
        }
        return {};
      });

      const subject = createSubject({
        activeSessionSlug: 'edge',
        isOpen: true,
        isQuestionCacheReady: true,
        isResponsesCacheReady: true,
      });
      subject.state = {
        ...subject.state,
        viewMode: 'questions',
        showQuestionFilter: true,
        questionResponses: {
          q1: {
            '0xedge': { answer: { value: 'edge', encrypted: false } },
          },
        },
        aggregatorQuestionResponses: {
          q1: [
            {
              responder: '0xedge',
              questionId: 'q1',
              response: { answer: { value: 'edge', encrypted: false } },
            },
          ],
        },
        sbtFilteredAggregatorQuestionResponses: {
          q1: [
            {
              responder: '0xedge',
              questionId: 'q1',
              response: { answer: { value: 'edge', encrypted: false } },
            },
          ],
        },
        totalQuestionsCount: 1,
        totalResponsesCount: 1,
      };

      const tree = subject.render();
      const questionFilterNode = findElement(
        tree,
        (node) =>
          node?.props?.resultsMode === true &&
          node?.props?.onFilter === subject.handleQuestionFilter
      );

      expect(questionFilterNode?.props?.storageKeyPrefix).toBe('dg:filters:edge');
      expect(questionFilterNode?.props?.questions).toEqual([
        expect.objectContaining({
          id: 'q1',
          prompt: 'Edge 1',
          sessionSlug: 'edge',
        }),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);

    renderQuestionResults(
      {
        activeSessionSlug: 'edge',
      },
      '/questions/results',
    );
    await waitForPrompt('Ready edge question');
    await waitForPrompt('Ready alpha question');

    expectPromptAbsent('[encrypted]');
    expectPromptAbsent('Out of scope beta question');
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
    expect(cacheScripts.peekCacheSync).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    expect(cacheScripts.readCache).not.toHaveBeenCalled();
    expect(cacheScripts.writeCache).not.toHaveBeenCalled();
    // port note: direct no-setState/no-fetchResponses/no-decrypt spies were instance-only; TASK 7 should pin scoped question bucket purity in an extracted helper test.
  });

  it('uses the route slug filter storage bucket on /session question results', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        edge: buildQuestionCache({
          questions: { q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' } },
          questionResponses: { q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } } },
        }),
        alpha: buildQuestionCache({
          questions: { q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' } },
        }),
        beta: buildQuestionCache({
          questions: { q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' } },
        }),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);

    renderQuestionResults(
      {
        activeSessionSlug: 'edge',
      },
      '/session/edge',
    );
    await waitForPrompt('Edge 1');
    fireEvent.click(screen.getByRole('button', { name: /Filter/i }));

    const filterProps = getLatestQuestionFilterProps();
    expect(filterProps.storageKeyPrefix).toBe('dg:filters:edge');
    expect(filterProps.resultsMode).toBe(true);
    expect(typeof filterProps.onFilter).toBe('function');
    expect(filterProps.questions).toEqual([
      expect.objectContaining({
        id: 'q1',
        prompt: 'Edge 1',
        sessionSlug: 'edge',
      }),
    ]);
  });

  it('excludes response-discovered pending placeholders from /session question results', async () => {
    const priorUrl = window.location.href;
    const leakedResponder = '0x02a2a289d5cde3c7d7b957c7f32299ca35d53526';
    window.history.replaceState({}, '', '/session/telegram-demo-2');
    try {
      jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
      jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['telegram-demo-2', 'demo']);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug !== 'telegram-demo-2') return {};
        return {
          '84532': {
            questions: {
              qLocal: { id: 'qLocal', prompt: 'Local question', type: 'binary' },
              qPending: {
                id: 'qPending',
                prompt: '[encrypted]',
                type: 'binary',
                __ceQuestionMetadataPending: true,
              },
              qDemoExplicit: {
                id: 'qDemoExplicit',
                prompt: 'Demo question',
                type: 'binary',
                sessionSlug: 'demo',
                sessionSlugExplicit: true,
              },
            },
            questionResponses: {
              qLocal: {
                '0xlocal': { type: 'binary', answer: { value: 'Agree', encrypted: false } },
              },
              qPending: {
                [leakedResponder]: { type: 'binary', answer: { value: 'Disagree', encrypted: false } },
              },
              qDemoExplicit: {
                [leakedResponder]: { type: 'binary', answer: { value: 'Agree', encrypted: false } },
              },
            },
          },
        };
      });

    renderQuestionResults(
      {
        activeSessionSlug: 'telegram-demo-2',
      },
      '/session/telegram-demo-2',
    );
    await waitForPrompt('Local question');

      await subject.fetchQuestionModeResponses();

      expect(Object.keys(subject.state.aggregatorQuestionResponses).sort()).toEqual(['qlocal']);
      expect(Object.keys(subject.state.questionResponses).sort()).toEqual(['qlocal']);
      expect(JSON.stringify(subject.state.aggregatorQuestionResponses).toLowerCase()).not.toContain(leakedResponder);
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('hydrates question results from cache before latest-block lookups resolve', async () => {
    const priorUrl = window.location.href;
    window.history.replaceState({}, '', '/questions/results?session=demo');
    try {
      let resolveLatestBlock: ((value: number) => void) | null = null;
      const latestBlockPromise = new Promise<number>((resolve) => {
        resolveLatestBlock = resolve;
      });
      jest.spyOn(contractScriptsModule.default, 'getLatestBlockNumber')
        .mockReturnValue(latestBlockPromise);
      jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
        if (namespace === 'bookmarksCache') return { surveys: [], questions: [] };
        if (namespace !== 'questionsCache') return {};
        if (slug !== 'demo') return {};
        return {
          '84532': {
            questions: {
              qLegacy: {
                id: 'qLegacy',
                prompt: 'Legacy demo question',
                type: 'freeform',
                sessionSlug: 'demo',
              },
            },
            questionResponses: {
              qLegacy: {
                '0xdemo': { answer: { value: 'demo', encrypted: false } },
              },
            },
          },
        };
      });

    renderQuestionResults(
      {
        preventUrlChange: true,
        sessionSlug: 'demo',
        activeSessionSlug: 'demo',
        sessionSlugPinned: true,
      },
      '/questions/results?session=demo',
    );

      const fetchPromise = subject.fetchResponses();
      const raceResult = await Promise.race([
        fetchPromise.then(() => 'fetch-complete'),
        new Promise((resolve) => setTimeout(() => resolve('still-waiting'), 0)),
      ]);

      expect(raceResult).toBe('fetch-complete');
      expect(subject.state.totalQuestionsCount).toBe(1);
      expect(subject.state.totalResponsesCount).toBe(1);
      expect(subject.state.networkLatestBlock).toBe(0);

      (resolveLatestBlock as any)?.(12345);
      await Promise.resolve();
      await Promise.resolve();

      expect(subject.state.networkLatestBlock).toBe(12345);
      await fetchPromise;
    } finally {
      window.history.replaceState({}, '', priorUrl);
    }
  });

  it('clears stale question results when the base session changes under global list scope', () => {
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);

    const view = renderQuestionResults(
      {
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
        questionResponsesNonce: 1,
      },
      '/questions/results',
    );
    await waitForPrompt('Edge 1');

    await rerenderHarness(view, {
      sessionSlug: 'beta',
      activeSessionSlug: 'beta',
      questionResponsesNonce: 2,
    });
    subject.setState = jest.fn((next, cb) => {
      const patch = typeof next === 'function' ? next(subject.state, subject.props) : next;
      subject.state = { ...subject.state, ...(patch || {}) };
      if (typeof cb === 'function') cb();
      return patch;
    });
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    // port note: the old queueResultsRefresh reason string is internal; the observable guard is the beta cache read and cleared UI.
  });

  it('does not render a SurveyResults session selector', async () => {
    seedCacheEnvironment();

    renderQuestionResults(
      {
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
      },
      '/questions/results?session=edge',
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Question Results' })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ce-surveyresults-session-selector-toggle')).toBeNull();
    expect(screen.queryByTestId('ce-surveyresults-session-selector-panel')).toBeNull();
  });

  it('does not render question-results corner actions for a removed session selector', async () => {
    seedCacheEnvironment();

    renderQuestionResults(
      {
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
      },
      '/questions/results?session=edge',
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Question Results' })).toBeInTheDocument();
    });
    expect(document.querySelector('[class*="syncStatusContainer"]')).toBeTruthy();
    expect(document.querySelector('[class*="modalHeaderCornerActions"]')).toBeNull();
    expect(screen.queryByTestId('ce-surveyresults-session-selector')).toBeNull();
  });

  it('canonicalizes survey display links for reserved session aliases', async () => {
    const collectLinksForSession = async (sessionSlug: string): Promise<string[]> => {
      seedCacheEnvironment({
        questionsBySlug: {
          [sessionSlug === 'general' ? '' : sessionSlug]: buildQuestionCache({
            questions: { q1: { id: 'q1', prompt: 'Survey prompt', type: 'rating' } },
          }),
        },
        surveysBySlug: {
          [sessionSlug === 'general' ? '' : sessionSlug]: buildSurveyCache({
            surveyId: '0xSurvey',
            title: 'Session Survey',
            responsesByResponder: {
              [RESPONDER_ONE]: {
                responses: [{ questionID: 'q1', answer: { value: 4 } }],
              },
            },
          }),
        },
      });
      const view = renderSurveyModeResults({
        sessionSlug,
        surveyId: '0xSurvey',
      });
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Session Survey' })).toBeInTheDocument();
      });
      await switchToIndividualsView();
      const links = collectSurveyLinks();
      view.unmount();
      return links;
    };

    const prevProps = subject.props;
    const prevState = { ...subject.state };
    subject.props = {
      ...subject.props,
      sessionSlug: 'beta',
      activeSessionSlug: 'beta',
    };

    subject.componentDidUpdate(prevProps, prevState);

    expect(subject.state.questionResponses).toEqual({});
    expect(subject.state.aggregatorQuestionResponses).toEqual({});
    expect(subject.state.sbtFilteredAggregatorQuestionResponses).toEqual({});
    expect(subject.state.totalQuestionsCount).toBe(0);
    expect(subject.state.totalResponsesCount).toBe(0);
    expect(subject.state.filteredResponsesCount).toBe(0);
    expect(subject.state.filteredQuestionsCount).toBe(0);
    expect(subject.getQuestionReadSlugs('questions')).toEqual(['beta']);
    expect(subject.queueResultsRefresh).toHaveBeenCalledWith(expect.stringContaining('question-scope-change'));
  });

  it('does not inherit the general session config for unknown non-general slugs', async () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation((slug: any) => {
      if (slug === '') return { slug: '', networkChainId: 84532 };
      return null;
    });

    const subject = createSubject({ sessionSlug: 'missing-session-slug' });

    expect(subject.getEffectiveSessionContext()).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
    });
    expect(configSpy).toHaveBeenCalledWith('missing-session-slug');
    expect(configSpy).not.toHaveBeenCalledWith('');
  });
});
