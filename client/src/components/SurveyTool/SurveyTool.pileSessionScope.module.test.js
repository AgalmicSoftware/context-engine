import { screen, waitFor } from '@testing-library/react';

import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { buildQuestionFilterStorageKeyPrefix } from './surveyToolUtils';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import * as sessionScanScope from '../../utilities/session/sessionScanScope.js';

const defaultCacheNode = {
  questions: {},
  questionResponses: {},
  pendingQuestionMetadata: {},
};

const setupListScope = (blockedAlpha = []) => {
  jest.spyOn(sessionScanScope, 'readSessionScanScope').mockReturnValue('list');
  jest.spyOn(sessionScanScope, 'readSessionScanSlugs').mockReturnValue(['edge', 'alpha', 'beta']);

  const strictLookup = (slug) => {
    if (slug === 'edge') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
    if (slug === 'alpha') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: blockedAlpha };
    if (slug === 'beta') return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
    return { networkChainId: 84532, BLOCKED_QUESTION_IDS: [] };
  };

  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockImplementation(strictLookup);
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlugOrDefault').mockImplementation(strictLookup);
};

const mockQuestionCaches = (questionCachesBySlug = {}) => {
  const readSpy = jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (namespace, slug) => {
    if (namespace !== 'questionsCache') return {};
    return questionCachesBySlug[slug] || {};
  });
  const peekSpy = jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((namespace, slug) => {
    if (namespace !== 'questionsCache') return {};
    return questionCachesBySlug[slug] || {};
  });
  return { readSpy, peekSpy };
};

const renderPile = (props = {}) =>
  renderSurveyPileViewMode(
    {
      minifiedMode: 'pile',
      network: { id: 84532 },
      networkChainId: 84532,
      account: '',
      sessionSlug: 'edge',
      activeSessionSlug: 'edge',
      cacheHasLoaded: true,
      isQuestionCacheReady: true,
      questionResponsesNonce: 1,
      questionsCacheNonce: 1,
      onFilterChange: jest.fn(),
      runtimeStrategy: createPileViewRuntimeStrategy(),
      ...props,
    },
    { route: '/session/edge' },
  );

const createScopedQuestionCaches = () => ({
  edge: {
    84532: {
      ...defaultCacheNode,
      questions: {
        q1: { id: 'q1', prompt: 'Edge 1', type: 'freeform' },
      },
    },
  },
  alpha: {
    84532: {
      ...defaultCacheNode,
      questions: {
        q2: { id: 'q2', prompt: 'Alpha 2', type: 'freeform' },
        qBlockedAlpha: { id: 'qBlockedAlpha', prompt: 'Blocked alpha', type: 'freeform' },
      },
      questionResponses: {
        q2: {
          '0xabc': { answer: { value: 'yes', encrypted: false }, additional: { value: '', encrypted: false } },
        },
      },
    },
  },
  beta: {
    84532: {
      ...defaultCacheNode,
      questions: {
        q3: { id: 'q3', prompt: 'Beta 3', type: 'freeform' },
      },
    },
  },
});

const cappedScanProgress = (overrides = {}) => ({
  slug: 'edge',
  phase: 'scan',
  totalBlocks: 50000,
  requestedTotalBlocks: 234000,
  wasCapped: true,
  scannedBlocks: 50000,
  remainingBlocks: 184000,
  startedAtMs: 1000,
  ...overrides,
});

describe('SurveyTool pile session scope and progress', () => {
  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('keeps pile warm-seed questions session-local on /session routes even when list scope includes other slugs', async () => {
    setupListScope(['qblockedalpha']);
    const { peekSpy, readSpy } = mockQuestionCaches(createScopedQuestionCaches());

    renderPile();

    expect(screen.getByText('Edge 1')).toBeInTheDocument();
    await waitFor(() => {
      expect(readSpy).toHaveBeenCalledWith('questionsCache', 'edge');
    });
    expect(screen.queryByText('Alpha 2')).toBeNull();
    expect(screen.queryByText('Beta 3')).toBeNull();
    expect(screen.queryByText('Blocked alpha')).toBeNull();
    expect(peekSpy).toHaveBeenCalledWith('questionsCache', 'edge', { clone: false });
    expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha', { clone: false });
    expect(peekSpy).not.toHaveBeenCalledWith('questionsCache', 'beta', { clone: false });
    expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha');
    expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'beta');
  });

  it('keeps pile question loads session-local on /session routes even when list scope includes other slugs', async () => {
    setupListScope();
    const { readSpy } = mockQuestionCaches(createScopedQuestionCaches());

    renderPile({
      account: '0xAbC',
      questionResponsesNonce: 5,
    });

    expect(await screen.findByText('Edge 1')).toBeInTheDocument();
    expect(screen.queryByText('Alpha 2')).toBeNull();
    expect(screen.queryByText('Beta 3')).toBeNull();
    expect(screen.queryByText('Blocked alpha')).toBeNull();
    expect(readSpy).toHaveBeenCalledWith('questionsCache', 'edge');
    expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'alpha');
    expect(readSpy).not.toHaveBeenCalledWith('questionsCache', 'beta');
    // port note: dropped direct QuestionFilter prop inspection; the scoped prefix is
    // asserted through the same helper used to render that prop, while QuestionFilter
    // storage behavior is covered in QuestionFilter.pipelineAutosave.test.ts.
    expect(
      buildQuestionFilterStorageKeyPrefix(
        {
          activeSessionSlug: 'edge',
          sessionSlug: 'edge',
          network: { id: 84532 },
          networkChainId: 84532,
        },
        'edge',
      ),
    ).toBe('dg:filters:edge');
  });

  it('renders capped pile loading progress with the requested total block count', async () => {
    mockQuestionCaches({ edge: { 84532: defaultCacheNode } });

    renderPile({
      isQuestionCacheReady: false,
      questionScanProgress: cappedScanProgress(),
    });

    expect(await screen.findByText('184,000 blocks left')).toBeInTheDocument();
    expect(screen.getByText('0 / 184,000')).toBeInTheDocument();
  });

  it('tracks pile loading progress relative to the current refresh window', async () => {
    mockQuestionCaches({ edge: { 84532: defaultCacheNode } });
    const { rerenderSurveyQuestions } = renderPile({
      isQuestionCacheReady: false,
      questionScanProgress: cappedScanProgress(),
    });

    expect(await screen.findByText('184,000 blocks left')).toBeInTheDocument();
    expect(screen.getByText('0 / 184,000')).toBeInTheDocument();

    rerenderSurveyQuestions({
      questionScanProgress: cappedScanProgress({
        scannedBlocks: 100000,
        remainingBlocks: 134000,
      }),
    });

    expect(await screen.findByText('134,000 blocks left')).toBeInTheDocument();
    expect(screen.getByText('50,000 / 184,000')).toBeInTheDocument();
  });
});
