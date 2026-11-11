import { act, screen } from '@testing-library/react';

import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';

const mockEmptyQuestionsCache = () =>
  jest
    .spyOn(cacheScripts, 'readCache')
    .mockImplementation(async (namespace) =>
      namespace === 'questionsCache'
        ? { 84532: { questions: {}, questionResponses: {}, pendingQuestionMetadata: {} } }
        : {},
    );

const questionReads = (readCache) =>
  readCache.mock.calls.filter(([namespace]) => namespace === 'questionsCache').length;

// A session with no questions gets no later cache nonce, so nothing else re-reads it.
const renderEmptyPile = (props = {}) =>
  renderSurveyPileViewMode({
    minifiedMode: 'pile',
    network: { id: 84532 },
    networkChainId: 84532,
    sessionSlug: 'empty',
    sessionConfig: {
      slug: 'empty',
      networkChainId: 84532,
      __registry: { sessionIdHex: '0x00112233445566778899aabbccddeeff', registryChainId: 84532 },
    },
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    questionScanProgress: null,
    questionsCacheNonce: 4,
    questionResponsesNonce: 4,
    onFilterChange: jest.fn(),
    runtimeStrategy: createPileViewRuntimeStrategy(),
    ...props,
  });

// One act per second, so React renders between timers as the browser does.
const advance = async (ms) => {
  for (let elapsed = 0; elapsed < ms; elapsed += 1000) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(Math.min(1000, ms - elapsed));
    });
  }
};

const expectSettledEmpty = async (readCache) => {
  expect(screen.getByText('No questions available.')).toBeInTheDocument();
  expect(screen.queryByText(/Loading/)).toBeNull();
  const settledReads = questionReads(readCache);
  await advance(60000);
  expect(questionReads(readCache)).toBe(settledReads);
};

describe('SurveyPileViewMode empty session', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    delete window.__LAST_RPC_RATE_LIMIT_ERROR__;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('settles to the empty state when the cache finishes loading after the last read', async () => {
    const readCache = mockEmptyQuestionsCache();
    const { rerenderSurveyQuestions } = renderEmptyPile({ cacheHasLoaded: false });
    await advance(1000);
    expect(questionReads(readCache)).toBeGreaterThan(0);

    rerenderSurveyQuestions({ cacheHasLoaded: true });
    await advance(21000);

    await expectSettledEmpty(readCache);
  });

  it('settles to the empty state when a recent rate limit stops holding it', async () => {
    window.__LAST_RPC_RATE_LIMIT_ERROR__ = { ts: Date.now() };
    const readCache = mockEmptyQuestionsCache();
    renderEmptyPile();
    await advance(2000);
    expect(questionReads(readCache)).toBeGreaterThan(0);
    expect(screen.getByText(/Loading/)).toBeInTheDocument();

    await advance(2 * 60 * 1000 + 21000);

    await expectSettledEmpty(readCache);
  });
});
