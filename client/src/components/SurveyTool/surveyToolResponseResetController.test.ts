import {
  buildSurveyExitEditingFallbackPatch,
  buildSurveyStartFreshStatePatch,
  executeSurveyExitEditing,
  executeSurveyFormStateReset,
  executeSurveyPendingRevert,
  executeSurveyStartFresh,
  shouldSurveyAutoStartFresh,
} from './surveyToolResponseResetController';

describe('surveyToolResponseResetController', () => {
  it('builds start-fresh and exit-editing fallback patches', () => {
    const emptySlice = { answers: { q1: { value: '' } } };
    const clonedSlice = { answers: { q1: { value: '' } } };
    const responseState = [emptySlice];

    expect(
      buildSurveyStartFreshStatePatch({
        cloneValue: () => clonedSlice,
        emptySlice,
        nextSubmittedSinceLastEdit: false,
        nextSurveysResponseState: responseState,
      }),
    ).toEqual({
      suppressPrefill: true,
      startFresh: true,
      surveysResponseState: responseState,
      editBaseline: clonedSlice,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      isDirty: false,
      isLoadingResponse: false,
      submittedSinceLastEdit: false,
    });

    expect(
      buildSurveyExitEditingFallbackPatch({
        nextSubmittedSinceLastEdit: true,
      }),
    ).toEqual({
      isEditing: false,
      displayAnswerMode: true,
      submittedSinceLastEdit: true,
    });
  });

  it('resets live form state through the shared reset plan and effects', () => {
    const persistDraft = jest.fn();
    const clearPersistTimer = jest.fn();
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const callback = jest.fn();

    expect(
      executeSurveyFormStateReset({
        props: {
          singleQuestionMode: false,
          isStandalone: false,
          surveyIndex: 2,
        },
        state: {
          submittedSinceLastEdit: true,
        },
        persistDraft,
        clearPersistTimer,
        initializeSurveyResponseState: () => [
          { answers: { keep: { value: 'persisted' } } },
          null,
          {
            answers: { q2: { value: '' } },
            importance: {},
            conviction: {},
            additionalComments: { q2: { value: '' } },
          },
        ],
        cloneValue: (value) => JSON.parse(JSON.stringify(value)),
        setState,
        callback,
        updateSubmittedSinceLastEdit: () => false,
      }),
    ).toEqual({
      applied: true,
      reason: 'applied',
    });

    expect(persistDraft).toHaveBeenCalledTimes(1);
    expect(clearPersistTimer).toHaveBeenCalledTimes(1);
    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        isEditing: false,
        isLoadingResponse: true,
        submittedSinceLastEdit: false,
      }),
      expect.any(Function),
    );
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('reverts pending changes through the shared baseline and effect chain', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const clearDraft = jest.fn();
    const recalculateEditStats = jest.fn();
    const updateJsonPreview = jest.fn();

    expect(
      executeSurveyPendingRevert({
        props: {
          singleQuestionMode: false,
          isStandalone: false,
          surveyIndex: 1,
          loginComplete: true,
          account: '0xabc',
        },
        state: {
          surveysResponseState: [{}, { answers: {} }],
        },
        buildSliceFromUserAnswers: jest.fn(),
        buildSliceFromLocalCache: jest.fn(),
        getRenderedQuestionIds: () => ['q1'],
        cloneFieldState: (value) => JSON.parse(JSON.stringify(value)),
        buildEmptyResponseFieldState: (questionId?: string, fieldKey = 'answer') => ({
          value: '',
          questionId,
          fieldKey,
        }),
        setState,
        clearDraft,
        recalculateEditStats,
        updateJsonPreview,
        resolveBaselineSlice: () => ({
          answers: { q1: { value: 'saved' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        }),
        buildRevertedSlice: () => ({
          answers: { q1: { value: 'saved' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        }),
      }),
    ).toEqual({
      applied: true,
      reason: 'applied',
      renderedQuestionIds: ['q1'],
    });

    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        isEditing: true,
        displayAnswerMode: false,
        isDirty: false,
      }),
      expect.any(Function),
    );
    expect(clearDraft).toHaveBeenCalledTimes(1);
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
  });

  it('returns an error result when pending revert orchestration throws', () => {
    const onFailure = jest.fn();

    expect(
      executeSurveyPendingRevert({
        props: {},
        state: {},
        resolveBaselineSlice: () => {
          throw new Error('boom');
        },
        onFailure,
      }),
    ).toEqual({
      applied: false,
      reason: 'error',
      renderedQuestionIds: [],
    });

    expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
  });

  it('builds start-fresh state before clearing rendered drafts', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const clearDraftFor = jest.fn();
    const recalculateEditStats = jest.fn();
    const persistDraftSafely = jest.fn();

    expect(
      executeSurveyStartFresh({
        props: {
          singleQuestionMode: false,
          isStandalone: false,
          surveyIndex: 2,
        },
        state: {
          submittedSinceLastEdit: true,
          surveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
        },
        getRenderedQuestionIds: () => ['q1', 'q2'],
        buildEmptyResponseFieldState: (questionId?: string, fieldKey = 'answer') => ({
          value: '',
          questionId,
          fieldKey,
        }),
        cloneValue: (value) => JSON.parse(JSON.stringify(value)),
        setState,
        clearDraftFor,
        recalculateEditStats,
        persistDraftSafely,
        updateSubmittedSinceLastEdit: () => false,
      }),
    ).toEqual({
      applied: true,
      reason: 'applied',
      renderedQuestionIds: ['q1', 'q2'],
    });

    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        suppressPrefill: true,
        startFresh: true,
        modifiedCount: 0,
        isDirty: false,
        isLoadingResponse: false,
        submittedSinceLastEdit: false,
      }),
      expect.any(Function),
    );
    expect(clearDraftFor).toHaveBeenNthCalledWith(1, 'q1');
    expect(clearDraftFor).toHaveBeenNthCalledWith(2, 'q2');
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(persistDraftSafely).toHaveBeenCalledWith(0);
  });

  it('returns whether shared state should auto-enter start-fresh mode', () => {
    expect(
      shouldSurveyAutoStartFresh({
        props: {
          singleQuestionMode: false,
          isStandalone: false,
          surveyIndex: 1,
          viewAddress: '',
        },
        state: {
          surveysResponseState: [
            null,
            {
              answers: {},
              importance: {},
              conviction: {},
              additionalComments: {},
            },
          ],
          userHasResponse: false,
          editBaseline: null,
          isDirty: false,
        },
        getRenderedQuestionIds: () => ['q1'],
      }),
    ).toBe(true);

    expect(
      shouldSurveyAutoStartFresh({
        props: {
          singleQuestionMode: false,
          isStandalone: false,
          surveyIndex: 1,
          viewAddress: '',
        },
        state: {
          surveysResponseState: [
            null,
            {
              answers: {},
              importance: {},
              conviction: {},
              additionalComments: { q1: { value: 'notes' } },
            },
          ],
          userHasResponse: false,
          editBaseline: null,
          isDirty: false,
        },
        getRenderedQuestionIds: () => ['q1'],
      }),
    ).toBe(false);
  });

  it('restores the shared edit baseline when exiting edit mode', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const recalculateEditStats = jest.fn();
    const persistDraftSafely = jest.fn();
    const updateJsonPreview = jest.fn();
    const clearDraft = jest.fn();

    expect(
      executeSurveyExitEditing({
        props: {
          singleQuestionMode: false,
          isStandalone: false,
          surveyIndex: 2,
          responderAddress: '0xdef',
        },
        state: {
          surveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
          parsedViewAddressAnswers: { answer: { value: 'viewed' } },
          userAnswers: { answer: { value: 'self' } },
          submittedSinceLastEdit: true,
        },
        buildSliceFromUserAnswers: jest.fn(() => ({
          answers: { q1: { value: 'viewed' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        })),
        buildSliceFromLocalCache: jest.fn(),
        getRenderedQuestionIds: () => ['q1', 'q2'],
        buildEmptyResponseFieldState: (questionId?: string, fieldKey = 'answer') => ({
          value: '',
          questionId,
          fieldKey,
        }),
        cloneValue: (value) => JSON.parse(JSON.stringify(value)),
        setState,
        recalculateEditStats,
        persistDraftSafely,
        updateJsonPreview,
        clearDraft,
        updateSubmittedSinceLastEdit: () => false,
      }),
    ).toEqual({
      applied: true,
      reason: 'applied',
    });

    expect(setState).toHaveBeenCalledWith(
      expect.objectContaining({
        isEditing: false,
        displayAnswerMode: true,
        startFresh: false,
        submittedSinceLastEdit: false,
      }),
      expect.any(Function),
    );
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
    expect(persistDraftSafely).toHaveBeenCalledTimes(1);
    expect(updateJsonPreview).toHaveBeenCalledTimes(1);
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });

  it('falls back to a minimal exit-editing state when restore orchestration fails', () => {
    const setState = jest.fn((updates, callback) => {
      if (typeof callback === 'function') callback();
      return updates;
    });
    const recalculateEditStats = jest.fn();
    const onFailure = jest.fn();

    expect(
      executeSurveyExitEditing({
        props: {},
        state: {
          submittedSinceLastEdit: true,
        },
        resolveBaselineSlice: () => {
          throw new Error('boom');
        },
        setState,
        recalculateEditStats,
        updateSubmittedSinceLastEdit: () => false,
        onFailure,
      }),
    ).toEqual({
      applied: false,
      reason: 'fallback',
    });

    expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
    expect(setState).toHaveBeenCalledWith(
      {
        isEditing: false,
        displayAnswerMode: true,
        submittedSinceLastEdit: false,
      },
      expect.any(Function),
    );
    expect(recalculateEditStats).toHaveBeenCalledTimes(1);
  });
});
