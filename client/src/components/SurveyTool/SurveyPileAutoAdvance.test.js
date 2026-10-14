// Auto-advance follows session configuration and only direct, committed choices.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import * as cacheScripts from '../../utilities/cache/cacheScripts.js';
import * as contractScriptsModule from '../../utilities/web3/chainGateway.js';
import { applySessionInterviewAnswer, createPileViewRuntimeStrategy } from './SurveyPileViewMode';
import { renderSurveyPileViewMode } from './surveyQuestionsTestHarness';

jest.mock('./CreateQuestionsAndSurveys', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionListeningPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('./SessionVoiceModeModal', () => ({ __esModule: true, default: () => null }));

const SESSION_CONFIG = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};

const questions = [
  { id: 'q1', type: 'binary', prompt: 'First binary' },
  { id: 'q2', type: 'multichoice', singleSelect: true, options: ['Alpha', 'Beta'], prompt: 'Single choice' },
  { id: 'q3', type: 'multichoice', options: ['Alpha', 'Beta'], prompt: 'Multiple choices' },
  { id: 'q4', type: 'rating', prompt: 'Rating' },
  { id: 'q5', type: 'freeform', prompt: 'Freeform' },
  { id: 'q6', type: 'binary', prompt: 'Last binary' },
];

const mountPile = async (sessionConfig = SESSION_CONFIG) => {
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(SESSION_CONFIG);
  const cache = {
    84532: {
      questions: Object.fromEntries(questions.map((q) => [q.id, q])),
      questionResponses: {},
      pendingQuestionMetadata: {},
    },
  };
  jest.spyOn(cacheScripts, 'readCache').mockImplementation(async (ns) => (ns === 'questionsCache' ? cache : {}));
  jest.spyOn(cacheScripts, 'peekCacheSync').mockImplementation((ns) => (ns === 'questionsCache' ? cache : null));
  let engine;
  const strategy = createPileViewRuntimeStrategy();
  const renderPile = strategy.render;
  strategy.render = (current) => {
    engine = current;
    return renderPile(current);
  };
  const harness = renderSurveyPileViewMode({
    minifiedMode: 'pile',
    network: { id: 84532 },
    networkChainId: 84532,
    account: '',
    loginComplete: false,
    cacheHasLoaded: true,
    isQuestionCacheReady: true,
    isResponsesCacheReady: true,
    questionsCacheNonce: 1,
    questionResponsesNonce: 1,
    onFilterChange: jest.fn(),
    runtimeStrategy: strategy,
    sessionConfig,
    sessionSlug: 'edge',
    activeSessionSlug: 'edge',
  });
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(6), { timeout: 8000 });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
  await act(async () => engine.setState({ pileQuestions: questions, activePileIndex: 0 }));
  return { engine: () => engine, ...harness };
};
const card = () => screen.getByTestId('ce-pile-active-question');
const choose = (role, name) => fireEvent.click(within(card()).getByRole(role, { name }));
const answer = (pile, id) => pile.engine().state.surveysResponseState[0].answers[id]?.value;
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

it('saves binary and single-choice answers, advances exactly once, focuses the next card, and keeps answers on Back', async () => {
  localStorage.setItem('ce:pileAutoAdvanceEnabled', 'false');
  const pile = await mountPile();
  choose('radio', 'Agree');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(card()).toHaveFocus();
  choose('checkbox', 'Beta');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 3 of 6'));
  expect(answer(pile, 'q2')).toEqual(['Beta']);
  await act(async () => pile.engine().handlePrev());
  expect(within(card()).getByRole('checkbox', { name: 'Beta' })).toBeChecked();
  choose('checkbox', 'Beta');
  expect(answer(pile, 'q2')).toEqual([]);
  expect(card()).toHaveAccessibleName('Question 2 of 6');
  await act(async () => pile.engine().handlePrev());
  choose('radio', 'Agree');
  expect(answer(pile, 'q1')).toBe('');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
});

it('uses updated session config and leaves multi-select and final questions in place', async () => {
  localStorage.setItem('ce:pileAutoAdvanceEnabled', 'true');
  const pile = await mountPile({ ...SESSION_CONFIG, pileAutoAdvanceEnabled: false });
  choose('radio', 'Unsure');
  expect(answer(pile, 'q1')).toBe('Unsure');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  pile.rerenderSurveyQuestions({ sessionConfig: { ...SESSION_CONFIG, pileAutoAdvanceEnabled: true } });
  choose('radio', 'Disagree');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
  await act(async () => pile.engine().handleNext());
  choose('checkbox', 'Alpha');
  choose('checkbox', 'Beta');
  expect(answer(pile, 'q3')).toEqual(['Alpha', 'Beta']);
  expect(card()).toHaveAccessibleName('Question 3 of 6');
  await act(async () => pile.engine().setState({ activePileIndex: 5 }));
  choose('radio', 'Agree');
  expect(answer(pile, 'q6')).toBe('Agree');
  expect(card()).toHaveAccessibleName('Question 6 of 6');
  expect(pile.engine().state.isSubmitting).toBeFalsy();
});

it('does not advance when an interview draft or programmatic response updates the current question', async () => {
  const pile = await mountPile();
  let applied;
  await act(async () => {
    applied = applySessionInterviewAnswer(pile.engine(), 'q1', 'Agree');
  });
  await applied;
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
});
