// Auto-advance follows session configuration and only direct, committed choices.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const mountPile = async (sessionConfig = SESSION_CONFIG, questionList = questions) => {
  jest.spyOn(contractScriptsModule, 'getSessionConfigBySlug').mockReturnValue(SESSION_CONFIG);
  const cache = {
    84532: {
      questions: Object.fromEntries(questionList.map((q) => [q.id, q])),
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
  await waitFor(() => expect(engine?.state?.pileQuestions?.length).toBe(questionList.length), { timeout: 8000 });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 400)));
  await act(async () => engine.setState({ pileQuestions: questionList, activePileIndex: 0 }));
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

it('ignores the second physical press after auto-advance, including a label-forwarded click, without delaying a new choice', async () => {
  const pile = await mountPile(
    SESSION_CONFIG,
    questions.slice(0, 3).map((q) => ({ ...q, type: 'binary' })),
  );
  const first = within(card()).getByRole('radio', { name: 'Agree' });
  fireEvent.mouseDown(first.closest('label'), { detail: 1 });
  fireEvent.click(first, { detail: 0 });
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 3'));
  const second = within(card()).getByRole('radio', { name: 'Agree' });
  // Native labels forward clicks with detail=0 even when their mouse/touch press has detail=2.
  fireEvent.mouseDown(second.closest('label'), { detail: 2 });
  fireEvent.click(second, { detail: 0 });
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(answer(pile, 'q2') || '').toBe('');
  expect(card()).toHaveAccessibleName('Question 2 of 3');
  const deliberate = within(card()).getByRole('radio', { name: 'Disagree' });
  fireEvent.mouseDown(deliberate.closest('label'), { detail: 1 });
  fireEvent.click(deliberate);
  expect(answer(pile, 'q2')).toBe('Disagree');
  expect(card()).toHaveAccessibleName('Question 3 of 3');
});

it('keeps arrow-key radio selection on the card and still advances on a later Space choice', async () => {
  const user = userEvent.setup();
  const pile = await mountPile();
  await act(async () => within(card()).getByRole('radio', { name: 'Agree' }).focus());
  await user.keyboard('{ArrowRight}');
  expect(answer(pile, 'q1')).toBe('Unsure');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  await user.keyboard('{ArrowRight}');
  expect(answer(pile, 'q1')).toBe('Disagree');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  await act(async () => within(card()).getByRole('radio', { name: 'Agree' }).focus());
  await user.keyboard(' ');
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(card()).toHaveAccessibleName('Question 2 of 6');
});

it('keeps an open comment editor mounted while choosing an answer so pending dictation can finish', async () => {
  const pile = await mountPile();
  await act(async () => pile.engine().toggleComments('q1'));
  const editor = await within(card()).findByPlaceholderText('Additional comments...');
  fireEvent.change(editor, { target: { value: 'Partial comment' } });
  choose('radio', 'Agree');
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  expect(within(card()).getByRole('textbox')).toBe(editor);
  fireEvent.change(editor, { target: { value: 'Partial comment with final dictated words' } });
  await waitFor(() =>
    expect(pile.engine().state.surveysResponseState[0].additionalComments.q1.value).toBe(
      'Partial comment with final dictated words',
    ),
  );
  await act(async () => pile.engine().handleNext());
  expect(card()).toHaveAccessibleName('Question 2 of 6');
  await act(async () => pile.engine().handlePrev());
  expect(within(card()).getByRole('textbox')).toHaveValue('Partial comment with final dictated words');
});
