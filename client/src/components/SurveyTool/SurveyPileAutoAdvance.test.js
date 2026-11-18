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
// The owner's switch for agree/unsure/disagree cards: a delay moves on after it (shortened here); null stays on the card.
const TEST_DELAY_MS = 60;
let mockChoiceDelay = TEST_DELAY_MS;
jest.mock('./surveyPileNavigation', () => ({
  ...jest.requireActual('./surveyPileNavigation'),
  get CHOICE_ADVANCE_DELAY_MS() {
    return mockChoiceDelay;
  },
}));
const pause = (ms) => act(async () => new Promise((resolve) => setTimeout(resolve, ms)));

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
const next = () => screen.getByRole('button', { name: 'Next Question' });
beforeEach(() => {
  mockChoiceDelay = TEST_DELAY_MS;
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

it('moves on from agree/disagree after a ticked beat, keeps a single choice on its card, and keeps answers on Back', async () => {
  localStorage.setItem('ce:pileAutoAdvanceEnabled', 'false');
  const pile = await mountPile();
  choose('radio', 'Agree');
  // The choice shows as kept on its card for a beat before the card moves on.
  expect(within(card()).getByRole('radio', { name: 'Agree' })).toBeChecked();
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(card()).toHaveFocus();
  // A single choice stays ticked on its card until Next.
  choose('checkbox', 'Beta');
  expect(within(card()).getByRole('checkbox', { name: 'Beta' })).toBeChecked();
  await pause(TEST_DELAY_MS * 2);
  expect(card()).toHaveAccessibleName('Question 2 of 6');
  expect(answer(pile, 'q2')).toEqual(['Beta']);
  await act(async () => pile.engine().handlePrev());
  choose('radio', 'Agree');
  expect(answer(pile, 'q1')).toBe('');
  await pause(TEST_DELAY_MS * 2);
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  expect(answer(pile, 'q2')).toEqual(['Beta']);
});

it('stays on a one-choice card until Next when the move-on is switched off', async () => {
  mockChoiceDelay = null;
  const pile = await mountPile();
  choose('radio', 'Agree');
  await act(async () => pile.engine().handleNext());
  choose('checkbox', 'Beta');
  await pause(TEST_DELAY_MS * 2);
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(answer(pile, 'q2')).toEqual(['Beta']);
  expect(card()).toHaveAccessibleName('Question 2 of 6');
});

it('never moves on from a tap that ended a scroll, or once the person scrolls the card during the beat', async () => {
  const pile = await mountPile();
  const drag = (distance) => {
    const target = within(card()).getAllByRole('radio')[0].closest('div');
    fireEvent.touchStart(target, { changedTouches: [{ identifier: 0, clientX: 100, clientY: 300 }] });
    fireEvent.touchMove(target, { changedTouches: [{ identifier: 0, clientX: 100, clientY: 300 - distance }] });
  };
  const scrollCard = () => drag(30);
  scrollCard();
  choose('radio', 'Agree');
  await pause(TEST_DELAY_MS * 2);
  expect(answer(pile, 'q1')).toBe('Agree');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  await pause(350);
  choose('radio', 'Disagree');
  scrollCard();
  await pause(TEST_DELAY_MS * 2);
  expect(answer(pile, 'q1')).toBe('Disagree');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
});

it('moves on after a tap whose finger drifted a few pixels', async () => {
  await mountPile();
  const target = within(card()).getByRole('radio', { name: 'Agree' }).closest('label');
  fireEvent.touchStart(target, { changedTouches: [{ identifier: 0, clientX: 100, clientY: 300 }] });
  fireEvent.touchMove(target, { changedTouches: [{ identifier: 0, clientX: 103, clientY: 296 }] });
  choose('radio', 'Agree');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
});

it('counts a scroll made by a second finger while the first rests', async () => {
  const pile = await mountPile();
  const target = within(card()).getByRole('radio', { name: 'Agree' }).closest('label');
  fireEvent.touchStart(target, { changedTouches: [{ identifier: 0, clientX: 100, clientY: 300 }] });
  fireEvent.touchStart(target, { changedTouches: [{ identifier: 1, clientX: 200, clientY: 300 }] });
  fireEvent.touchMove(target, { changedTouches: [{ identifier: 1, clientX: 200, clientY: 200 }] });
  choose('radio', 'Agree');
  await pause(TEST_DELAY_MS * 2);
  expect(answer(pile, 'q1')).toBe('Agree');
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
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 3 of 3'));
});

it('keeps a double tap on one option as one choice while the card waits to move on', async () => {
  const pile = await mountPile();
  const agree = within(card()).getByRole('radio', { name: 'Agree' });
  fireEvent.mouseDown(agree.closest('label'), { detail: 1 });
  fireEvent.click(agree, { detail: 0 });
  fireEvent.mouseDown(agree.closest('label'), { detail: 2 });
  fireEvent.click(agree, { detail: 0 });
  expect(answer(pile, 'q1')).toBe('Agree');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
  expect(answer(pile, 'q1')).toBe('Agree');
});

it('keeps a double tap on a single choice as one choice', async () => {
  const pile = await mountPile();
  await act(async () => pile.engine().handleNext());
  const beta = within(card()).getByRole('checkbox', { name: 'Beta' });
  fireEvent.mouseDown(beta.closest('label'), { detail: 1 });
  fireEvent.click(beta, { detail: 0 });
  fireEvent.mouseDown(beta.closest('label'), { detail: 2 });
  fireEvent.click(beta, { detail: 0 });
  expect(answer(pile, 'q2')).toEqual(['Beta']);
  expect(within(card()).getByRole('checkbox', { name: 'Beta' })).toBeChecked();
  // A deliberate second press later still unticks it.
  fireEvent.mouseDown(beta.closest('label'), { detail: 1 });
  fireEvent.click(beta, { detail: 0 });
  expect(answer(pile, 'q2')).toEqual([]);
});

it('takes a quick press on another option while the card waits as the new choice', async () => {
  const pile = await mountPile();
  const agree = within(card()).getByRole('radio', { name: 'Agree' });
  const disagree = within(card()).getByRole('radio', { name: 'Disagree' });
  fireEvent.mouseDown(agree.closest('label'), { detail: 1 });
  fireEvent.click(agree, { detail: 0 });
  fireEvent.mouseDown(disagree.closest('label'), { detail: 2 });
  fireEvent.click(disagree, { detail: 0 });
  expect(answer(pile, 'q1')).toBe('Disagree');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
  expect(answer(pile, 'q1')).toBe('Disagree');
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
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
});

it('accepts every quadratic step in a new double or triple click after auto-advance', async () => {
  const allocation = {
    id: 'q2',
    type: 'quadratic',
    prompt: 'Allocate votes',
    options: ['Parks', 'Transit'],
    voiceCredits: 99,
  };
  const pile = await mountPile(SESSION_CONFIG, [questions[0], allocation, questions[5]]);
  const first = within(card()).getByRole('radio', { name: 'Agree' });
  fireEvent.mouseDown(first.closest('label'), { detail: 1 });
  fireEvent.click(first, { detail: 0 });
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 3'));
  const step = (direction, detail) => {
    const button = within(card()).getByTestId(`ce-quadratic-${direction}-0`);
    fireEvent.mouseDown(button, { detail });
    fireEvent.click(button, { detail });
  };
  // A remaining press from the previous card must still be ignored.
  step('increase', 2);
  step('increase', 3);
  expect(answer(pile, 'q2') || '').toBe('');
  for (const detail of [1, 2, 3]) step('increase', detail);
  expect(answer(pile, 'q2')).toEqual([3, 0]);
  expect(within(card()).getByRole('slider', { name: 'Parks' })).toHaveValue('3');
  expect(within(card()).getByTestId('ce-quadratic-budget')).toHaveTextContent('90 credits left');
  for (const detail of [1, 2]) step('increase', detail);
  expect(answer(pile, 'q2')).toEqual([5, 0]);
  for (const detail of [1, 2, 3, 1, 2, 3]) step('decrease', detail);
  expect(answer(pile, 'q2')).toEqual([-1, 0]);
  expect(card()).toHaveAccessibleName('Question 2 of 3');
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

it('moves on after the set delay, and not if the choice is cleared in the meantime', async () => {
  mockChoiceDelay = 200;
  const pile = await mountPile();
  choose('radio', 'Agree');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  choose('radio', 'Agree');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(answer(pile, 'q1')).toBe('');
  expect(card()).toHaveAccessibleName('Question 1 of 6');

  choose('radio', 'Disagree');
  expect(within(card()).getByRole('radio', { name: 'Disagree' })).toBeChecked();
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
  expect(answer(pile, 'q1')).toBe('Disagree');
});

it('does not move on later when the person moved by hand within the delay', async () => {
  mockChoiceDelay = 200;
  const pile = await mountPile();
  choose('radio', 'Disagree');
  await act(async () => pile.engine().handleNext());
  await act(async () => pile.engine().handlePrev());
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  expect(answer(pile, 'q1')).toBe('Disagree');
});

it('pulses Next once a card that stays is answered, for that visit only', async () => {
  const pile = await mountPile();
  // Agree/disagree moves on by itself, so Next has nothing to point at.
  choose('radio', 'Agree');
  await waitFor(() => expect(card()).toHaveAccessibleName('Question 2 of 6'));
  expect(next()).not.toHaveClass('pileNavArrowNudge');
  choose('checkbox', 'Beta');
  expect(next()).toHaveClass('pileNavArrowPrimary', 'pileNavArrowNudge');
  // Moving on ends it, and coming back to the answered card does not start it again.
  await act(async () => pile.engine().handleNext());
  expect(next()).not.toHaveClass('pileNavArrowNudge');
  await act(async () => pile.engine().handlePrev());
  expect(next()).toHaveClass('pileNavArrowPrimary');
  expect(next()).not.toHaveClass('pileNavArrowNudge');
  await act(async () => pile.engine().handleNext());
  choose('checkbox', 'Alpha');
  expect(next()).toHaveClass('pileNavArrowNudge');
  // A rating starts it once the slider is let go.
  await act(async () => pile.engine().handleNext());
  const slider = within(card()).getByRole('slider');
  fireEvent.change(slider, { target: { value: '3' } });
  fireEvent.mouseUp(slider, { target: { value: '3' } });
  await waitFor(() => expect(next()).toHaveClass('pileNavArrowNudge'));
});

it('waits for the person to leave a free-text field before pulsing Next', async () => {
  const pile = await mountPile();
  await act(async () => pile.engine().setState({ activePileIndex: 4 }));
  const field = within(card()).getByPlaceholderText('Your response...');
  await act(async () => field.focus());
  fireEvent.change(field, { target: { value: 'A typed answer' } });
  await waitFor(() => expect(answer(pile, 'q5')).toBe('A typed answer'));
  expect(next()).toHaveClass('pileNavArrowPrimary');
  expect(next()).not.toHaveClass('pileNavArrowNudge');
  await act(async () => field.blur());
  expect(next()).toHaveClass('pileNavArrowNudge');
});

it('pulses Next on agree/disagree when the session stays put, but never on the last question', async () => {
  const pile = await mountPile({ ...SESSION_CONFIG, pileAutoAdvanceEnabled: false });
  choose('radio', 'Unsure');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  expect(next()).toHaveClass('pileNavArrowNudge');
  await act(async () => pile.engine().setState({ activePileIndex: 5 }));
  choose('radio', 'Agree');
  expect(answer(pile, 'q6')).toBe('Agree');
  expect(next()).toHaveClass('pileNavArrowPrimary');
  expect(next()).not.toHaveClass('pileNavArrowNudge');
});

it('pulses Next for dictated text, and not for leaving a comment on a card answered earlier', async () => {
  const pile = await mountPile();
  await act(async () => pile.engine().setState({ activePileIndex: 4 }));
  // Text that arrives while no field has focus, as dictation does, is a finished answer.
  fireEvent.change(within(card()).getByPlaceholderText('Your response...'), { target: { value: 'Dictated' } });
  await waitFor(() => expect(next()).toHaveClass('pileNavArrowNudge'));
  await act(async () => pile.engine().handlePrev());
  await act(async () => pile.engine().handleNext());
  expect(next()).not.toHaveClass('pileNavArrowNudge');
  await act(async () => pile.engine().toggleComments('q5'));
  const comment = await within(card()).findByPlaceholderText('Additional comments...');
  await act(async () => comment.focus());
  await act(async () => comment.blur());
  expect(next()).not.toHaveClass('pileNavArrowNudge');
});

it('pulses Next when an agree/disagree choice made with the arrow keys stays on its card', async () => {
  const user = userEvent.setup();
  await mountPile();
  await act(async () => within(card()).getByRole('radio', { name: 'Agree' }).focus());
  await user.keyboard('{ArrowRight}');
  expect(card()).toHaveAccessibleName('Question 1 of 6');
  expect(next()).toHaveClass('pileNavArrowNudge');
});
