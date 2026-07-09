import {
  buildPrefilledSingleQuestionState,
  buildPrefilledSingleQuestionUpdatePlan,
  buildPrefilledSurveyState,
  buildPrefilledSurveyUpdatePlan,
} from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationFlow prefill helpers', () => {
  it('builds single-question prefill state with ensured survey slots', () => {
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses, questionIdResolver }) => {
      const questionId = questionIdResolver(responses[0]);
      targetSlice.answers[questionId] = { value: responses[0].answer.value };
      targetSlice.additionalComments[questionId] = { value: responses[0].additional.value };
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn((_userAnswer, prevSlice) => ({
      ...(prevSlice || {}),
      answers: { q1: { value: 'baseline answer' } },
      additionalComments: { q1: { value: 'baseline notes' } },
      importance: {},
      conviction: {},
    }));

    expect(
      buildPrefilledSingleQuestionState({
        surveyIndex: 2,
        questionId: 'Q1',
        prevSurveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
        prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        isDirty: false,
        submissionComplete: false,
        userAnswer: {
          questionID: 'q1',
          answer: { value: 'hydrated answer' },
          additional: { value: 'hydrated notes' },
        },
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      }),
    ).toEqual({
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'hydrated answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { value: 'hydrated notes' } },
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'baseline notes' } },
      },
      shouldWriteBaseline: true,
    });

    expect(
      buildPrefilledSingleQuestionState({
        surveyIndex: 0,
        questionId: '',
        prevSurveysResponseState: [],
        prevEditBaseline: null,
        isDirty: true,
        submissionComplete: true,
        userAnswer: null,
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      }).shouldWriteBaseline,
    ).toBe(false);
  });

  it('builds single-question prefill update plans with optional baseline writes', () => {
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses, questionIdResolver }) => {
      const questionId = questionIdResolver(responses[0]);
      targetSlice.answers[questionId] = { value: responses[0].answer.value };
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(
      buildPrefilledSingleQuestionUpdatePlan({
        surveyIndex: 1,
        questionId: 'q1',
        prevSurveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
        prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        isDirty: false,
        submissionComplete: false,
        userAnswer: { answer: { value: 'answer-1' } },
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      }),
    ).toEqual({
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'answer-1' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      shouldWriteBaseline: true,
      updates: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
          {
            answers: { q1: { value: 'answer-1' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
        editBaseline: {
          answers: { q1: { value: 'baseline' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      },
    });
  });

  it('builds prefilled survey state with hydrated slice and optional baseline writes', () => {
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses }) => {
      const first = responses[0];
      if (!first) return false;
      targetSlice.answers.q1 = { value: first.answer.value };
      targetSlice.additionalComments.q1 = { value: first.additional.value };
      targetSlice.importance.q1 = first.importance;
      targetSlice.conviction.q1 = first.conviction;
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn((_userAnswers, prevSlice) => ({
      ...(prevSlice || {}),
      answers: {
        ...((prevSlice && prevSlice.answers) || {}),
        q1: { value: 'baseline answer' },
      },
      additionalComments: {
        ...((prevSlice && prevSlice.additionalComments) || {}),
        q1: { value: 'baseline notes' },
      },
      importance: { q1: 4 },
      conviction: { q1: 7 },
    }));

    expect(
      buildPrefilledSurveyState({
        surveyIndex: 1,
        prevSurveysResponseState: [
          { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
        prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        isDirty: false,
        submissionComplete: false,
        responses: [
          {
            answer: { value: 'hydrated answer' },
            additional: { value: 'hydrated notes' },
            importance: 4,
            conviction: 7,
          },
        ],
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      }),
    ).toEqual({
      nextSurveysResponseState: [
        { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'hydrated answer' } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
          additionalComments: { q1: { value: 'hydrated notes' } },
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline answer' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'baseline notes' } },
      },
      shouldWriteBaseline: true,
    });

    expect(
      buildPrefilledSurveyState({
        surveyIndex: 0,
        prevSurveysResponseState: [],
        prevEditBaseline: null,
        isDirty: true,
        submissionComplete: true,
        responses: [],
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      }).shouldWriteBaseline,
    ).toBe(false);
  });

  it('builds survey prefill update plans with optional baseline writes', () => {
    const responses = [
      { answer: { value: 'answer-1' }, additional: { value: 'notes-1' }, importance: 4, conviction: 7 },
    ];
    const applyResponseHydrationListToSlice = jest.fn(({ targetSlice, responses: nextResponses }) => {
      const first = nextResponses[0];
      targetSlice.answers.q1 = { value: first.answer.value };
      targetSlice.additionalComments.q1 = { value: first.additional.value };
      targetSlice.importance.q1 = first.importance;
      targetSlice.conviction.q1 = first.conviction;
      return true;
    });
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'baseline' } },
      importance: { q1: 4 },
      conviction: { q1: 7 },
      additionalComments: { q1: { value: 'baseline notes' } },
    }));

    expect(
      buildPrefilledSurveyUpdatePlan({
        surveyIndex: 1,
        prevSurveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
        prevEditBaseline: { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
        isDirty: false,
        submissionComplete: false,
        responses,
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      }),
    ).toEqual({
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
        {
          answers: { q1: { value: 'answer-1' } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
          additionalComments: { q1: { value: 'notes-1' } },
        },
      ],
      nextBaseline: {
        answers: { q1: { value: 'baseline' } },
        importance: { q1: 4 },
        conviction: { q1: 7 },
        additionalComments: { q1: { value: 'baseline notes' } },
      },
      shouldWriteBaseline: true,
      updates: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } }, importance: {}, conviction: {}, additionalComments: {} },
          {
            answers: { q1: { value: 'answer-1' } },
            importance: { q1: 4 },
            conviction: { q1: 7 },
            additionalComments: { q1: { value: 'notes-1' } },
          },
        ],
        editBaseline: {
          answers: { q1: { value: 'baseline' } },
          importance: { q1: 4 },
          conviction: { q1: 7 },
          additionalComments: { q1: { value: 'baseline notes' } },
        },
      },
    });
  });
});
