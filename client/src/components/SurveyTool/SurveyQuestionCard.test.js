import { act, waitFor } from '@testing-library/react';
import { renderSurveyQuestions } from './surveyQuestionsTestHarness';
import * as fullQuestionDisplay from './SurveyQuestionsFullQuestionDisplay';
import { advanceSurveyQuestionCardEpoch, surveyQuestionCardDeps } from './SurveyQuestionCard';

const account = '0x00000000000000000000000000000000000000a1';
const sessionConfig = {
  slug: 'edge',
  networkChainId: 84532,
  __registry: { registryChainId: 84532, sessionIdHex: '0x00112233445566778899aabbccddeeff' },
};
const questions = ['Q1', 'q2', 'q3'].map((id) => ({ id, type: 'freeform', prompt: `Question ${id}` }));

afterEach(() => {
  jest.restoreAllMocks();
  sessionStorage.clear();
});

it('renders only the edited card on a keystroke, none on an empty render, and every card on any other change', async () => {
  const rendered = [];
  const display = fullQuestionDisplay.renderSurveyQuestionsFullQuestionDisplay;
  jest.spyOn(fullQuestionDisplay, 'renderSurveyQuestionsFullQuestionDisplay').mockImplementation((args) => {
    rendered.push(args.question.id);
    return display(args);
  });
  let engine;
  const view = renderSurveyQuestions({
    account,
    loginComplete: true,
    isStandalone: true,
    sessionSlug: 'edge',
    sessionConfig,
    questionPool: questions,
    runtimeStrategy: {
      render: (current) => {
        engine = current;
        return current.renderDefaultSurveyQuestionsRoute();
      },
    },
  });
  await waitFor(() => expect(rendered).toEqual(expect.arrayContaining(['Q1', 'q2', 'q3'])));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));

  // The first edit also marks the form edited, which every card shows.
  act(() => engine.handleAnswer(0, 'Q1', 'type'));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
  rendered.length = 0;
  act(() => engine.handleAnswer(0, 'Q1', 'typed'));
  expect(engine.state.surveysResponseState[0].answers.q1.value).toBe('typed');
  expect([...new Set(rendered)]).toEqual(['Q1']);

  // A parent's render that changes nothing, as while answers load.
  rendered.length = 0;
  act(() => view.rerenderSurveyQuestions({}));
  expect(rendered).toEqual([]);

  rendered.length = 0;
  act(() => view.rerenderSurveyQuestions({ questionResponsesNonce: 7 }));
  expect([...new Set(rendered)].sort()).toEqual(['Q1', 'q2', 'q3']);
});

it('advances the epoch on any change but the answers', () => {
  const tracker = { props: null, state: null, epoch: 0 };
  const props = { a: 1 };
  const state = { surveysResponseState: [{}], other: 1 };
  const first = advanceSurveyQuestionCardEpoch(tracker, props, state);
  const typed = { ...state, surveysResponseState: [{ answers: { q: 'x' } }] };
  expect(advanceSurveyQuestionCardEpoch(tracker, props, typed)).toBe(first);
  expect(advanceSurveyQuestionCardEpoch(tracker, { a: 1 }, typed)).toBe(first);
  expect(advanceSurveyQuestionCardEpoch(tracker, { a: 2 }, typed)).toBe(first + 1);
  expect(advanceSurveyQuestionCardEpoch(tracker, { a: 2 }, { ...typed, other: 2 })).toBe(first + 2);
  expect(advanceSurveyQuestionCardEpoch(tracker, { a: 2 }, { ...typed, other: 2 })).toBe(first + 3);
});

it("keys a card's fields as edits key them", () => {
  const slice = { answers: { q1: 'a', q2: 'b' }, startFresh: false };
  const before = surveyQuestionCardDeps(1, null, 0, slice, 'Q1');
  expect(before).toContain('a');
  const otherEdited = surveyQuestionCardDeps(1, null, 0, { ...slice, answers: { ...slice.answers, q2: 'c' } }, 'Q1');
  expect(otherEdited).toEqual(before);
  const ownEdited = surveyQuestionCardDeps(1, null, 0, { ...slice, answers: { ...slice.answers, q1: 'z' } }, 'Q1');
  expect(ownEdited).not.toEqual(before);
});
