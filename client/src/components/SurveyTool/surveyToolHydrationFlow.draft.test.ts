import {
  buildDraftHydrationUpdatePlan,
  shouldSkipDraftHydrationRun,
  buildDraftHydrationSeedContext,
  buildDraftHydrationRunPlan,
  buildDraftHydrationRenderedQuestionIds,
  buildDraftHydrationOverwriteDecision,
  buildDraftHydrationState,
  loadDraftAnswersByQuestionIdSafely,
} from './surveyToolHydrationFlow.js';

describe('surveyToolHydrationFlow draft hydration helpers', () => {
  it('restores draft edits for rendered questions without touching the loaded baseline', () => {
    const applyDraftEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }) => {
      targetSlice.answers[questionId] = { value: draftEntry.value };
      targetSlice.importance[questionId] = draftEntry.importance;
      return true;
    });

    expect(
      buildDraftHydrationState({
        renderedQuestionIds: ['Q1', 'q2'],
        draft: {
          answers: {
            q1: { value: 'answer-1', importance: 4 },
          },
          baseline: {
            q2: { value: 'baseline-2' },
          },
        },
        prevSlice: {
          answers: { q0: { value: 'keep' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        prevBaseline: {
          answers: { q9: { value: 'baseline-keep' } },
          importance: {},
          conviction: {},
          additionalComments: {},
        },
        allowOverwrite: true,
        applyDraftEntryToSlice,
      }),
    ).toEqual({
      nextSlice: {
        answers: {
          q0: { value: 'keep' },
          q1: { value: 'answer-1' },
        },
        importance: { q1: 4 },
        conviction: {},
        additionalComments: {},
      },
      changed: true,
    });

    expect(applyDraftEntryToSlice).toHaveBeenCalledTimes(1);
  });

  it('returns unchanged slices when no rendered ids or draft entries apply', () => {
    const applyDraftEntryToSlice = jest.fn();

    expect(
      buildDraftHydrationState({
        renderedQuestionIds: [],
        draft: null,
        prevSlice: null,
        prevBaseline: null,
        allowOverwrite: false,
        applyDraftEntryToSlice,
      }),
    ).toEqual({
      nextSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      changed: false,
    });

    expect(applyDraftEntryToSlice).not.toHaveBeenCalled();
  });

  it('loads draft answers safely for local-cache rehydrate fallback handling', () => {
    const buildDraftAnswersByQuestionId = jest.fn(() => ({
      q1: { value: 'draft-answer' },
    }));
    const onError = jest.fn();

    expect(
      loadDraftAnswersByQuestionIdSafely({
        loadDraft: () => ({ answers: { q1: { value: 'raw-draft' } } }),
        buildDraftAnswersByQuestionId,
        onError,
      }),
    ).toEqual({
      q1: { value: 'draft-answer' },
    });
    expect(onError).not.toHaveBeenCalled();

    const draftError = new Error('draft-load-failed');
    expect(
      loadDraftAnswersByQuestionIdSafely({
        loadDraft: () => {
          throw draftError;
        },
        buildDraftAnswersByQuestionId,
        onError,
      }),
    ).toEqual({});
    expect(onError).toHaveBeenCalledWith(draftError);

    onError.mockClear();
    const buildError = new Error('draft-map-failed');
    expect(
      loadDraftAnswersByQuestionIdSafely({
        loadDraft: () => ({ answers: { q1: { value: 'raw-draft' } } }),
        buildDraftAnswersByQuestionId: () => {
          throw buildError;
        },
        onError,
      }),
    ).toEqual({});
    expect(onError).toHaveBeenCalledWith(buildError);
  });

  it('builds draft hydration rendered ids with optional pile expansion', () => {
    expect(
      buildDraftHydrationRenderedQuestionIds({
        hydrationQuestionIds: ['q1', 'Q2'],
        pileQuestions: [{ id: 'q2' }, { id: 'q3' }],
        forceOverwrite: false,
      }),
    ).toEqual(['q1', 'q2']);

    expect(
      buildDraftHydrationRenderedQuestionIds({
        hydrationQuestionIds: ['q1', 'Q2'],
        pileQuestions: [{ id: 'q2' }, { id: 'q3' }],
        forceOverwrite: true,
      }),
    ).toEqual(['q1', 'q2', 'q3']);
  });

  it('builds draft hydration overwrite decisions from pending edit state', () => {
    expect(
      buildDraftHydrationOverwriteDecision({
        forceOverwrite: true,
        isDirty: false,
        modifiedCount: 0,
        pendingStats: { total: 0 },
        submittedSinceLastEdit: false,
        submissionComplete: false,
      }),
    ).toEqual({
      pendingTotal: 0,
      submittedStateActive: false,
      allowOverwrite: true,
    });

    expect(
      buildDraftHydrationOverwriteDecision({
        forceOverwrite: false,
        isDirty: true,
        modifiedCount: 2,
        pendingStats: { total: 2 },
        submittedSinceLastEdit: true,
        submissionComplete: true,
      }),
    ).toEqual({
      pendingTotal: 2,
      submittedStateActive: true,
      allowOverwrite: false,
    });
  });

  it('decides when draft hydration should skip and resolves its seed context', () => {
    expect(
      shouldSkipDraftHydrationRun({
        suppressPrefill: true,
        submissionError: '',
        draft: { answers: { q1: { value: 'x' } } },
      }),
    ).toBe(true);

    expect(
      shouldSkipDraftHydrationRun({
        suppressPrefill: false,
        submissionError: 'failed',
        draft: { answers: { q1: { value: 'x' } } },
      }),
    ).toBe(true);

    expect(
      shouldSkipDraftHydrationRun({
        suppressPrefill: false,
        submissionError: '',
        draft: { answers: {}, baseline: {} },
      }),
    ).toBe(false);

    expect(
      buildDraftHydrationSeedContext({
        isStandalone: false,
        singleQuestionMode: false,
        surveyIndex: 2,
        surveysResponseState: [
          { answers: { q0: { value: 'keep-0' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
      }),
    ).toEqual({
      surveyIndex: 2,
      prevSlice: {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    });

    expect(
      buildDraftHydrationSeedContext({
        isStandalone: true,
        singleQuestionMode: false,
        surveyIndex: 3,
        surveysResponseState: [
          { answers: { q1: { value: 'keep-1' } }, importance: {}, conviction: {}, additionalComments: {} },
        ],
      }),
    ).toEqual({
      surveyIndex: 0,
      prevSlice: {
        answers: { q1: { value: 'keep-1' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
    });
  });

  it('builds draft hydration run plans from rendered ids, overwrite rules, and update plan state', () => {
    const applyDraftEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }) => {
      targetSlice.answers[questionId] = { value: draftEntry.value };
      return true;
    });

    expect(
      buildDraftHydrationRunPlan({
        hydrationQuestionIds: ['q1'],
        pileQuestions: [{ id: 'q2' }],
        forceOverwrite: true,
        isDirty: false,
        modifiedCount: 0,
        pendingStats: { total: 0 },
        submittedSinceLastEdit: false,
        submissionComplete: false,
        prevSurveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
        surveyIndex: 0,
        draft: {
          answers: {
            q2: { value: 'off-screen' },
          },
        },
        prevSlice: {
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
        applyDraftEntryToSlice,
      }),
    ).toEqual({
      renderedQuestionIds: ['q1', 'q2'],
      allowOverwrite: true,
      nextSlice: {
        answers: { q2: { value: 'off-screen' } },
        importance: {},
        conviction: {},
        additionalComments: {},
      },
      changed: true,
      updates: {
        surveysResponseState: [
          {
            answers: { q2: { value: 'off-screen' } },
            importance: {},
            conviction: {},
            additionalComments: {},
          },
        ],
      },
    });
  });

  it('builds draft hydration update plans that leave the loaded baseline alone', () => {
    const applyDraftEntryToSlice = jest.fn(({ targetSlice, questionId, draftEntry }) => {
      targetSlice.answers[questionId] = { value: draftEntry.value };
      targetSlice.importance[questionId] = draftEntry.importance;
      return true;
    });

    expect(
      buildDraftHydrationUpdatePlan({
        prevSurveysResponseState: [{ answers: { keep: { value: 'persisted' } } }],
        surveyIndex: 2,
        renderedQuestionIds: ['q1'],
        draft: {
          answers: {
            q1: { value: 'answer-1', importance: 4 },
          },
          baseline: {
            q1: { value: 'baseline-1', importance: 2 },
          },
        },
        prevSlice: {
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
        allowOverwrite: true,
        applyDraftEntryToSlice,
      }),
    ).toEqual({
      nextSlice: {
        answers: { q1: { value: 'answer-1' } },
        importance: { q1: 4 },
        conviction: {},
        additionalComments: {},
      },
      changed: true,
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
            answers: { q1: { value: 'answer-1' } },
            importance: { q1: 4 },
            conviction: {},
            additionalComments: {},
          },
        ],
      },
    });
  });
});
