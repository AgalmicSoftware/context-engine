// A card the responder can see must not change under them when response counts arrive.
import { act, waitFor } from '@testing-library/react';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const QUESTION_IDS = ['q1', 'q2', 'q3', 'q4'];
let responses = {};
const respondents = (count) =>
  Object.fromEntries(
    Array.from({ length: count }, (_, index) => [
      `0x${String(index + 1).padStart(40, '0')}`,
      JSON.stringify({ answer: { value: 'Agree' } }),
    ]),
  );

const mockCaches = () => {
  jest
    .spyOn(contractScriptsModule, 'getSessionConfigBySlug')
    .mockImplementation((slug) => (slug === 'edge' ? SESSION_CONFIG : null));
  const cache = () => ({
    84532: {
      questions: Object.fromEntries(QUESTION_IDS.map((id) => [id, { id, type: 'binary', prompt: id }])),
      questionResponses: responses,
      pendingQuestionMetadata: {},
    },
  });
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache() : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache() : null));
};

const settle = (ms = 600) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

const mountPile = async () => {
  let engine = null;
  const strategy = createPileViewRuntimeStrategy();
  const renderPile = strategy.render;
  strategy.render = (current) => {
    engine = current;
    return renderPile(current);
  };
  const view = renderSurveyPileViewMode({
    minifiedMode: 'pile',
    network: { id: 84532 },
    networkChainId: 84532,
    account: '',
    loginComplete: false,
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: false,
    questionResponsesNonce: 1,
    questionsCacheNonce: 1,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    sessionConfig: SESSION_CONFIG,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(4), { timeout: 8000 });
  await settle();
  return { view, engine: () => engine };
};

const currentCard = (engine) => engine.state.pileQuestions[engine.state.activePileIndex]?.id;
const loadResponses = async (view) => {
  responses = { q3: respondents(5), q4: respondents(3) };
  await act(async () => view.rerenderSurveyQuestions({ isResponsesCacheReady: true, questionResponsesNonce: 2 }));
  await settle();
};

beforeEach(() => {
  responses = {};
});

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

it('keeps the first card when response counts arrive after it is shown', async () => {
  mockCaches();
  const pile = await mountPile();
  const shown = currentCard(pile.engine());

  await loadResponses(pile.view);

  expect(pile.engine().state.activePileIndex).toBe(0);
  expect(currentCard(pile.engine())).toBe(shown);
  // Cards not reached yet still follow the response-count order.
  expect(
    pile
      .engine()
      .state.pileQuestions.slice(1, 3)
      .map((question) => question.id),
  ).toEqual(['q3', 'q4']);
});

it('keeps the place of a responder who already moved on', async () => {
  mockCaches();
  const pile = await mountPile();
  await act(async () => pile.engine().setState({ activePileIndex: 2 }));
  const reached = pile
    .engine()
    .state.pileQuestions.slice(0, 3)
    .map((question) => question.id);

  await loadResponses(pile.view);

  expect(pile.engine().state.activePileIndex).toBe(2);
  expect(
    pile
      .engine()
      .state.pileQuestions.slice(0, 3)
      .map((question) => question.id),
  ).toEqual(reached);
});
