import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import * as cacheScriptsModule from '../../utilities/cache/cacheScripts.js';
import contractScriptsDefault, * as contractScriptsModule from '../../utilities/web3/contractScripts.js';
import * as sessionScanScopeModule from '../../utilities/session/sessionScanScope.js';
import {
  resolveSurveyResultsQuestionReadScope,
  resolveSurveyResultsSessionContext,
} from './surveyResultsSessionResolution';
import { renderSurveyResults } from './surveyResultsTestHarness';
import { getPolisDemoQuestionPool } from './surveyPolisDemoQuestionPool';

const cacheScripts: any = cacheScriptsModule;
const sessionScanScope: any = sessionScanScopeModule;

const NETWORK_ID = '84532';
const RESPONDER_ONE = '0x1111111111111111111111111111111111111111';
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

type CacheEnvironment = {
  bookmarksBySlug?: Record<string, any>;
  questionsBySlug?: Record<string, any>;
  surveysBySlug?: Record<string, any>;
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
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace: any, slug: any) => {
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
  await waitFor(() => {
    expect(collectSurveyLinks().some((href) => href.includes(`/${RESPONDER_ONE}`))).toBe(true);
  });
};

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

  it('reads bookmarks cache using canonical explicit session aliases in the constructor', async () => {
    seedCacheEnvironment({
      bookmarksBySlug: {
        DEBATE: { surveys: [], questions: ['q1'] },
      },
      questionsBySlug: {
        DEBATE: buildQuestionCache({
          questions: {
            q1: { id: 'q1', prompt: 'Debate question', type: 'rating', sessionSlug: 'DEBATE' },
          },
          questionResponses: {
            q1: { '0xdebate': { answer: { value: 4, encrypted: false } } },
          },
        }),
      },
    });

    renderQuestionResults(
      {
        sessionSlug: 'DEBATE',
        activeSessionSlug: 'DEBATE',
      },
      '/questions/results',
    );
    await waitForPrompt('Debate question');

    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('bookmarksCache', 'DEBATE', { clone: false });
    expect(document.querySelector('svg[color="gold"]')).toBeTruthy();
  });

  it('keeps explicit general aliases from falling through to survey-cache scans', async () => {
    seedCacheEnvironment({
      surveysBySlug: {
        edge: buildSurveyCache({
          surveyId: 'survey-1',
          title: 'Edge survey',
          responsesByResponder: {
            [RESPONDER_ONE]: {
              responses: [{ questionID: 'q1', answer: { value: 'edge' } }],
            },
          },
        }),
      },
    });

    renderSurveyModeResults({
      sessionSlug: 'general',
      surveyId: 'survey-1',
    });
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Survey Results' })).toBeInTheDocument();
    });

    expect(cacheScripts.listNamespaceEntriesSync).not.toHaveBeenCalled();
    expect(collectSurveyLinks()).toContain('/survey/survey-1');
    expect(collectSurveyLinks().some((href) => href.includes('session=general'))).toBe(false);
  });

  it('keeps explicit non-general session slugs unresolved when no config exists', async () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation((slug: any) => {
      if (slug === 'rxc') return { slug: 'rxc', networkChainId: 84532 };
      return null;
    });

    const context = resolveSurveyResultsSessionContext({
      sessionSlug: 'DEBATE',
      resolveBySlug: configSpy,
    });

    expect(context).toMatchObject({
      sessionSlug: 'DEBATE',
      sessionConfig: null,
    });
    expect(configSpy).toHaveBeenCalledWith('DEBATE');
    expect(configSpy).not.toHaveBeenCalledWith('rxc');
  });

  it('memoizes fallback slug scan and invalidates on surveys cache updates', async () => {
    seedCacheEnvironment({
      surveysBySlug: {
        edge: buildSurveyCache({ surveyId: '0xsurvey' }),
      },
    });

    const view = renderSurveyModeResults({
      questionResponsesNonce: 1,
      questionsCacheNonce: 2,
      surveyId: '0xSurvey',
    });
    await waitFor(() => {
      expect(collectSurveyLinks()).toContain('/survey/0xSurvey?session=edge');
    });
    const firstCount = cacheScripts.listNamespaceEntriesSync.mock.calls.length;

    await rerenderHarness(view as ReturnType<typeof renderQuestionResults>, {
      questionResponsesNonce: 1,
      questionsCacheNonce: 2,
    });
    expect(cacheScripts.listNamespaceEntriesSync.mock.calls.length).toBe(firstCount);

    await rerenderHarness(view as ReturnType<typeof renderQuestionResults>, {
      questionResponsesNonce: 2,
    });
    const nonceCount = cacheScripts.listNamespaceEntriesSync.mock.calls.length;
    expect(nonceCount).toBeGreaterThan(firstCount);

    act(() => {
      cacheUpdateListener?.({ namespace: 'surveysCache', slug: 'edge', action: 'write' });
    });
    await rerenderHarness(view as ReturnType<typeof renderQuestionResults>, {});
    expect(cacheScripts.listNamespaceEntriesSync.mock.calls.length).toBeGreaterThan(nonceCount);
    expect(collectSurveyLinks()).toContain('/survey/0xSurvey?session=edge');
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
    seedCacheEnvironment({
      questionsBySlug: {
        edge: buildQuestionCache({
          questions: { q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' } },
          questionResponses: { q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } } },
        }),
        alpha: buildQuestionCache({
          questions: { q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' } },
          questionResponses: { q2: { '0xalpha': { answer: { value: 'alpha', encrypted: false } } } },
        }),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha']);

    renderQuestionResults(
      {
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
      },
      '/session/edge/questions/results',
    );
    await waitForPrompt('Edge 1');

    expectPromptAbsent('Alpha 2');
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    expect(cacheScripts.peekCacheSync).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
    expect(screen.queryByTestId('ce-surveyresults-session-selector-toggle')).toBeNull();
  });

  it('keeps explicit query-pinned question results scoped to authoritative question bindings only', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
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
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
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
            qLegacy: { '0xdemo': { answer: { value: 'demo', encrypted: false } } },
            qLeakedExplicit: { '0xalpha': { answer: { value: 'alpha', encrypted: false } } },
          },
        }),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['demo', 'alpha']);

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

    expectPromptAbsent('Wrong session question');
    expectQuestionResponseCounts(1, 1);
  });

  it('resets stale filtered question counts when unfiltered question results refresh', async () => {
    const questionsBySlug = {
      edge: buildQuestionCache({
        questions: { q1: { id: 'q1', prompt: 'Edge question', type: 'freeform' } },
        questionResponses: { q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } } },
      }),
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
  });

  it('keeps question-mode reads scoped to the /session route slug', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        edge: buildQuestionCache({
          questionsLatestBlock: 11,
          questionResponsesLatestBlock: 12,
          questions: { q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' } },
          questionResponses: { q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } } },
        }),
        alpha: buildQuestionCache({
          questions: { q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' } },
          questionResponses: { q2: { '0xalpha': { answer: { value: 'alpha', encrypted: false } } } },
        }),
        beta: buildQuestionCache({
          questions: { q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' } },
          questionResponses: { q3: { '0xbeta': { answer: { value: 'beta', encrypted: false } } } },
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

    expectPromptAbsent('Alpha 2');
    expectPromptAbsent('Beta 3');
    expect(cacheScripts.peekCacheSync).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    expect(cacheScripts.peekCacheSync).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
    expect(cacheScripts.peekCacheSync).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    const filterProps = getLatestQuestionFilterProps();
    expect(filterProps.questions).toEqual([
      expect.objectContaining({ id: 'q1', prompt: 'Edge 1', sessionSlug: 'edge' }),
    ]);
  });

  it('reads scoped question cache buckets without write, fetch, decrypt, or state side effects', async () => {
    seedCacheEnvironment({
      questionsBySlug: {
        edge: buildQuestionCache({
          questionsLatestBlock: 41,
          questionResponsesLatestBlock: 42,
          questions: {
            q1: {
              id: 'q1',
              prompt: 'Ready edge question',
              sessionSlug: 'edge',
              type: 'freeform',
            },
            qpending: {
              id: 'qpending',
              prompt: '[encrypted]',
              sessionSlug: 'edge',
              __ceQuestionMetadataPending: true,
            },
          },
          questionResponses: {
            q1: { '0xaaa': { answer: { value: 'Ready answer' } } },
            qpending: { '0xbbb': { answer: { value: 'Pending answer' } } },
          },
        }),
        alpha: buildQuestionCache({
          questionsLatestBlock: 37,
          questionResponsesLatestBlock: 39,
          questions: {
            q2: {
              id: 'q2',
              prompt: 'Ready alpha question',
              sessionSlug: 'alpha',
              sessionSlugExplicit: true,
              type: 'binary',
            },
          },
          questionResponses: {
            q2: { '0xccc': { answer: { value: true } } },
          },
        }),
        beta: buildQuestionCache({
          questions: {
            q3: {
              id: 'q3',
              prompt: 'Out of scope beta question',
              sessionSlug: 'beta',
              sessionSlugExplicit: true,
              type: 'rating',
            },
          },
          questionResponses: {
            q3: { '0xddd': { answer: { value: 5 } } },
          },
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
    const leakedResponder = '0x02a2a289d5cde3c7d7b957c7f32299ca35d53526';
    seedCacheEnvironment({
      questionsBySlug: {
        'telegram-demo-2': buildQuestionCache({
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
            qLocal: { '0xlocal': { type: 'binary', answer: { value: 'Agree', encrypted: false } } },
            qPending: { [leakedResponder]: { type: 'binary', answer: { value: 'Disagree', encrypted: false } } },
            qDemoExplicit: { [leakedResponder]: { type: 'binary', answer: { value: 'Agree', encrypted: false } } },
          },
        }),
      },
    });
    jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
    jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['telegram-demo-2', 'demo']);

    renderQuestionResults(
      {
        activeSessionSlug: 'telegram-demo-2',
      },
      '/session/telegram-demo-2',
    );
    await waitForPrompt('Local question');

    expectPromptAbsent('[encrypted]');
    expectPromptAbsent('Demo question');
    expect(document.body.innerHTML.toLowerCase()).not.toContain(leakedResponder);
    expect(JSON.stringify(mockSingleQuestionResponse.mock.calls).toLowerCase()).not.toContain(leakedResponder);
  });

  it('hydrates question results from cache before latest-block lookups resolve', async () => {
    let resolveLatestBlock: ((value: number) => void) | null = null;
    const latestBlockPromise = new Promise<number>((resolve) => {
      resolveLatestBlock = resolve;
    });
    seedCacheEnvironment({
      questionsBySlug: {
        demo: buildQuestionCache({
          questions: {
            qLegacy: {
              id: 'qLegacy',
              prompt: 'Legacy demo question',
              type: 'freeform',
              sessionSlug: 'demo',
            },
          },
          questionResponses: {
            qLegacy: { '0xdemo': { answer: { value: 'demo', encrypted: false } } },
          },
        }),
      },
    });
    (contractScriptsDefault.getLatestBlockNumber as jest.Mock).mockReturnValue(latestBlockPromise);

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
    expectQuestionResponseCounts(1, 1);
    (resolveLatestBlock as any)?.(12345);
    await waitFor(() => {
      expect(contractScriptsDefault.getLatestBlockNumber).toHaveBeenCalled();
    });
    // port note: exact networkLatestBlock state values are internal; this keeps the cache-first hydration guarantee while RPC is unresolved.
  });

  it('clears stale question results when the base session changes under global list scope', async () => {
    const questionsBySlug = {
      edge: buildQuestionCache({
        questions: { q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' } },
        questionResponses: { q1: { '0xedge': { answer: { value: 'edge', encrypted: false } } } },
      }),
      beta: buildQuestionCache(),
    };
    seedCacheEnvironment({ questionsBySlug });
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

    await waitFor(() => {
      expectPromptAbsent('Edge 1');
      expectQuestionResponseCounts(0, 0);
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

    const debateLinks = await collectLinksForSession('DEBATE');
    expect(debateLinks).toContain('/survey/0xSurvey?session=DEBATE');
    expect(debateLinks).toContain(`/survey/0xSurvey/${RESPONDER_ONE.toLowerCase()}?session=DEBATE`);
    expect(debateLinks).not.toContain('/survey/0xSurvey?session=rxc');
    expect(debateLinks).not.toContain(`/survey/0xSurvey/${RESPONDER_ONE.toLowerCase()}?session=rxc`);

    jest.restoreAllMocks();
    mockSbtFilter.mockClear();
    mockQuestionFilter.mockClear();
    mockSingleQuestionResponse.mockClear();

    const generalLinks = await collectLinksForSession('general');
    expect(generalLinks).toContain('/survey/0xSurvey');
    expect(generalLinks).toContain(`/survey/0xSurvey/${RESPONDER_ONE.toLowerCase()}`);
    expect(generalLinks).not.toContain('/survey/0xSurvey?session=general');
    expect(generalLinks).not.toContain(`/survey/0xSurvey/${RESPONDER_ONE.toLowerCase()}?session=general`);
  });

  it('does not inherit the general session config for unknown non-general slugs', async () => {
    const configSpy = jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation((slug: any) => {
      if (slug === '') return { slug: '', networkChainId: 84532 };
      return null;
    });

    const context = resolveSurveyResultsSessionContext({
      sessionSlug: 'missing-session-slug',
      resolveBySlug: configSpy,
    });

    expect(context).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
    });
    expect(configSpy).toHaveBeenCalledWith('missing-session-slug');
    expect(configSpy).not.toHaveBeenCalledWith('');
  });
});
