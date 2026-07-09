import {
  buildInitializedSurveyResponseState,
  buildLocalCacheRehydrationUpdatePlan,
  prepareLocalCacheRehydrateRun,
  buildResetFormStatePatch,
  buildStartFreshSurveyState,
  buildMergedSurveyResponseState,
  buildSurveyResponseStateArray,
  shouldHandleStartFresh,
} from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationFlow', () => {
  it('builds survey response state arrays with ensured indexes', () => {
    expect(
      buildSurveyResponseStateArray({
        prevSurveysResponseState: [
          { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
        surveyIndex: 2,
        nextSlice: {
          answers: { q2: { value: 'answer' } },
          importance: { q2: 4 },
          conviction: { q2: 7 },
          additionalComments: { q2: { value: 'notes' } },
        },
      }),
    ).toEqual([
      { answers: { q0: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q2: { value: 'answer' } },
        importance: { q2: 4 },
        conviction: { q2: 7 },
        additionalComments: { q2: { value: 'notes' } },
      },
    ]);

    expect(
      buildSurveyResponseStateArray({
        prevSurveysResponseState: null,
        surveyIndex: 1,
        nextSlice: null,
      }),
    ).toEqual([
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
    ]);
  });

  it('builds merged survey response state into ensured survey slots', () => {
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(
      buildMergedSurveyResponseState({
        currentState: [
          {
            answers: { keep: { value: 'persisted' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
        newQuestionPool: [{ id: 'q1' }],
        renderedQuestionIds: ['q2'],
        surveyIndex: 2,
        buildEmptyResponseFieldState,
      }),
    ).toEqual([
      {
        answers: { keep: { value: 'persisted' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
      {
        answers: { q1: { value: '', questionId: 'q1', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', questionId: 'q1', fieldKey: 'additional' } },
      },
    ]);

    expect(buildEmptyResponseFieldState).toHaveBeenCalledTimes(2);
  });

  it('builds initialized survey response state for single and survey modes', () => {
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(
      buildInitializedSurveyResponseState({
        singleQuestionMode: true,
        isStandalone: false,
        surveyIndex: 0,
        renderedQuestionIds: ['q1'],
        questionPoolIds: ['qPool'],
        prevSurveysResponseState: [],
        buildEmptyResponseFieldState,
      }),
    ).toEqual([
      {
        answers: { q1: { value: '', questionId: 'q1', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: '', questionId: 'q1', fieldKey: 'additional' } },
      },
    ]);

    expect(
      buildInitializedSurveyResponseState({
        singleQuestionMode: false,
        isStandalone: false,
        surveyIndex: 2,
        renderedQuestionIds: ['q2'],
        questionPoolIds: ['qPool'],
        prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
        buildEmptyResponseFieldState,
      }),
    ).toEqual([
      { answers: { keep: { value: 'persisted' } } },
      null,
      {
        answers: { q2: { value: '', questionId: 'q2', fieldKey: 'answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '', questionId: 'q2', fieldKey: 'additional' } },
      },
    ]);
  });

  it('detects whether start-fresh should run for the current slice', () => {
    expect(
      shouldHandleStartFresh({
        viewAddress: '',
        userHasResponse: false,
        editBaseline: null,
        isDirty: false,
        currentSlice: {
          answers: { q1: { value: '   ' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        renderedQuestionIds: ['q1'],
      }),
    ).toBe(false);

    expect(
      shouldHandleStartFresh({
        viewAddress: '',
        userHasResponse: false,
        editBaseline: null,
        isDirty: false,
        currentSlice: {
          answers: {},
          importance: { q2: undefined },
          conviction: {},
          additionalComments: {},
        },
        renderedQuestionIds: ['q2'],
      }),
    ).toBe(false);

    expect(
      shouldHandleStartFresh({
        viewAddress: '',
        userHasResponse: false,
        editBaseline: null,
        isDirty: false,
        currentSlice: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        renderedQuestionIds: ['q3'],
      }),
    ).toBe(true);
  });

  it('builds start-fresh survey state for rendered questions', () => {
    const buildEmptyResponseFieldState = jest.fn((questionId, fieldKey = 'answer') => ({
      value: '',
      questionId,
      fieldKey,
    }));

    expect(
      buildStartFreshSurveyState({
        surveyIndex: 2,
        renderedQuestionIds: ['q1', 'q2'],
        prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
        buildEmptyResponseFieldState,
      }),
    ).toEqual({
      emptySlice: {
        answers: {
          q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
          q2: { value: '', questionId: 'q2', fieldKey: 'answer' },
        },
        importance: {},
        conviction: {},
        additionalComments: {
          q1: { value: '', questionId: 'q1', fieldKey: 'additional' },
          q2: { value: '', questionId: 'q2', fieldKey: 'additional' },
        },
      },
      nextSurveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        {
          answers: {
            q1: { value: '', questionId: 'q1', fieldKey: 'answer' },
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
    });

    expect(buildEmptyResponseFieldState).toHaveBeenCalledTimes(4);
  });

  it('builds reset-form state patches from initialized survey responses', () => {
    const cloneValue = jest.fn((value) => JSON.parse(JSON.stringify(value)));

    expect(
      buildResetFormStatePatch({
        initialSurveysResponseState: [
          { answers: { keep: { value: 'persisted' } } },
          {
            answers: { q2: { value: '' } },
            importance: {},
            conviction: {},
            additionalComments: { q2: { value: '' } },
          },
        ],
        baselineIndex: 1,
        nextSubmittedSinceLastEdit: false,
        cloneValue,
      }),
    ).toEqual({
      surveysResponseState: [
        { answers: { keep: { value: 'persisted' } } },
        {
          answers: { q2: { value: '' } },
          importance: {},
          conviction: {},
          additionalComments: { q2: { value: '' } },
        },
      ],
      isEditing: false,
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: false,
      submitProgress: 0,
      userHasResponse: false,
      userAnswers: null,
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      editBaseline: {
        answers: { q2: { value: '' } },
        importance: {},
        conviction: {},
        additionalComments: { q2: { value: '' } },
      },
      isLoadingResponse: true,
    });

    expect(cloneValue).toHaveBeenCalledTimes(1);
  });

  it('prepares local-cache rehydrate runs with skip and base-slice decisions', () => {
    expect(
      prepareLocalCacheRehydrateRun({
        state: {
          suppressPrefill: true,
          submissionError: '',
          submissionComplete: false,
        },
        surveyIndex: 0,
        renderedIds: ['q1'],
        lastHydrationSig: '',
        buildHydrationSignature: jest.fn(),
      }),
    ).toEqual({
      shouldSkip: true,
      shouldBumpNoop: false,
      hydrationSig: '',
      baseSlice: null,
    });

    expect(
      prepareLocalCacheRehydrateRun({
        state: {
          suppressPrefill: false,
          submissionError: '',
          submissionComplete: false,
          surveysResponseState: [
            { answers: { q1: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
          ],
        },
        surveyIndex: 0,
        renderedIds: ['q1'],
        lastHydrationSig: 'same|sig',
        buildHydrationSignature: () => 'same|sig',
      }),
    ).toEqual({
      shouldSkip: true,
      shouldBumpNoop: true,
      hydrationSig: 'same|sig',
      baseSlice: null,
    });

    expect(
      prepareLocalCacheRehydrateRun({
        state: {
          suppressPrefill: false,
          submissionError: '',
          submissionComplete: false,
          surveysResponseState: [
            { answers: { q1: { value: 'keep' } }, importance: {}, conviction: {}, additionalComments: {} },
          ],
        },
        surveyIndex: 0,
        renderedIds: ['q1'],
        lastHydrationSig: '',
        buildHydrationSignature: () => 'next|sig',
      }),
    ).toEqual({
      shouldSkip: false,
      shouldBumpNoop: false,
      hydrationSig: 'next|sig',
      baseSlice: {
        answers: { q1: { value: 'keep' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    });
  });

  it('builds local-cache rehydration update plans from slice/baseline changes', () => {
    const cloneBaseline = jest.fn((baseline) => JSON.parse(JSON.stringify(baseline)));
    const buildDraftAwareState = jest.fn(() => ({
      effectiveAnswerState: { value: 'cached-answer' },
      effectiveAdditionalState: { value: 'cached-notes' },
      canReplaceMaskedAnswerWithDraftEmpty: false,
      canReplaceMaskedAdditionalWithDraftEmpty: false,
      canReplaceMaskedBaselineAnswerWithDraftEmpty: false,
      canReplaceMaskedBaselineAdditionalWithDraftEmpty: false,
    }));
    const applyLocalCacheHydrationEntryToSlice = jest.fn(
      ({ targetSlice, questionId, cachedAnswer, cachedAdditional }) => {
        if (cachedAnswer) targetSlice.answers[questionId] = cachedAnswer;
        if (cachedAdditional) targetSlice.additionalComments[questionId] = cachedAdditional;
        return true;
      },
    );

    expect(
      buildLocalCacheRehydrationUpdatePlan({
        prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
        surveyIndex: 2,
        renderedQuestionIds: ['q1'],
        baseSlice: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        prevBaseline: {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        cacheSlice: {
          answers: { q1: { value: 'cached-answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { value: 'cached-notes' } },
        },
        draftAnswersByQuestionId: {},
        cloneBaseline,
        buildDraftAwareCacheHydrationState: buildDraftAwareState,
        applyLocalCacheHydrationEntryToSlice,
        debugLabel: '[test][rehydrateLocal]',
      }),
    ).toEqual({
      nextSlice: {
        answers: { q1: { value: 'cached-answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'cached-notes' } },
      },
      nextBaseline: {
        answers: { q1: { value: 'cached-answer' } },
        importance: {},
        conviction: {},
        additionalComments: { q1: { value: 'cached-notes' } },
      },
      changed: true,
      baselineChanged: true,
      updates: {
        surveysResponseState: [
          { answers: { keep: { value: 'persisted' } } },
          {
            answers: {},
            importance: {},
            conviction: {},
            additionalComments: {},
          },
          {
            answers: { q1: { value: 'cached-answer' } },
            importance: {},
            conviction: {},
            additionalComments: { q1: { value: 'cached-notes' } },
          },
        ],
        editBaseline: {
          answers: { q1: { value: 'cached-answer' } },
          importance: {},
          conviction: {},
          additionalComments: { q1: { value: 'cached-notes' } },
        },
      },
    });
  });
});
