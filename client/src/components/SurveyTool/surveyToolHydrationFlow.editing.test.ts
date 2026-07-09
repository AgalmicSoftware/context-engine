import {
  buildExitEditingStatePatch,
  buildRevertPendingStatePatch,
  resolveExitEditingBaselineSlice,
  resolveRevertPendingBaselineSlice,
} from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationFlow editing state', () => {
  it('resolves revert-pending baseline slices from edit, saved, or cached sources', () => {
    const buildSliceFromUserAnswers = jest.fn(() => ({
      answers: { q1: { value: 'saved' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    const buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(
      resolveRevertPendingBaselineSlice({
        editBaseline: {
          answers: { q0: { value: 'edit' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        isLoggedIn: true,
        userAnswers: { answer: { value: 'saved' } },
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      answers: { q0: { value: 'edit' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(
      resolveRevertPendingBaselineSlice({
        editBaseline: null,
        isLoggedIn: true,
        userAnswers: { answer: { value: 'saved' } },
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      answers: { q1: { value: 'saved' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(
      resolveRevertPendingBaselineSlice({
        editBaseline: null,
        isLoggedIn: true,
        userAnswers: null,
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
  });

  it('builds revert-pending state patches for the active survey slice', () => {
    expect(
      buildRevertPendingStatePatch({
        prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
        surveyIndex: 2,
        nextSlice: {
          answers: { q1: { value: 'saved' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        isLoggedIn: false,
      }),
    ).toEqual({
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        {
          answers: { q1: { value: 'saved' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      isEditing: true,
      displayAnswerMode: false,
      startFresh: true,
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      submissionError: '',
    });
  });

  it('resolves exit-editing baseline slices from viewed, self, or cached sources', () => {
    const buildSliceFromUserAnswers = jest.fn((sourceAnswers) => ({
      answers: { q1: { value: sourceAnswers.answer?.value || sourceAnswers.responses?.[0]?.answer?.value } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));
    const buildSliceFromLocalCache = jest.fn(() => ({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    }));

    expect(
      resolveExitEditingBaselineSlice({
        responderAddress: '0xdef',
        parsedViewAddressAnswers: { answer: { value: 'viewed' } },
        userAnswers: { answer: { value: 'self' } },
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      answers: { q1: { value: 'viewed' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(
      resolveExitEditingBaselineSlice({
        responderAddress: '',
        parsedViewAddressAnswers: { answer: { value: 'viewed' } },
        userAnswers: { answer: { value: 'self' } },
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      answers: { q1: { value: 'self' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });

    expect(
      resolveExitEditingBaselineSlice({
        responderAddress: '',
        parsedViewAddressAnswers: null,
        userAnswers: null,
        buildSliceFromUserAnswers,
        buildSliceFromLocalCache,
      }),
    ).toEqual({
      answers: { q2: { value: 'cached' } },
      importance: {},
      conviction: {},
      additionalComments: {},
    });
  });

  it('builds exit-editing state patches for the restored survey slice', () => {
    const cloneValue = jest.fn((value) => JSON.parse(JSON.stringify(value)));
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(
      buildExitEditingStatePatch({
        prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
        surveyIndex: 2,
        baselineSlice: {
          answers: { q1: { value: 'saved' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        renderedQuestionIds: ['q1', 'q2'],
        buildEmptyResponseFieldState,
        cloneValue,
        nextSubmittedSinceLastEdit: false,
      }),
    ).toEqual({
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        {
          answers: {
            q1: { value: 'saved' },
            q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
          },
          importance: {},
          conviction: {},
          additionalComments: {
            q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
            q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
          },
        },
      ],
      isEditing: false,
      displayAnswerMode: true,
      startFresh: false,
      editBaseline: {
        answers: {
          q1: { value: 'saved' },
          q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
          q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
        },
      },
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: false,
    });

    expect(cloneValue).toHaveBeenCalledTimes(3);
  });
});
