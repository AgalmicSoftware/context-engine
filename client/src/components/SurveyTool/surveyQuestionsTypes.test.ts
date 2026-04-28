import {
  buildAutoDecryptDisabledState,
  buildCanDecryptOtherResponsesState,
  buildClearedSurveyQuestionPoolState,
  buildInitialSurveyQuestionsState,
  buildSurveyQuestionPoolLoadState,
} from './surveyQuestionsTypes.js';

describe('surveyQuestionsTypes', () => {
  it('builds the default SurveyQuestions state for non-standalone flows', () => {
    const state = buildInitialSurveyQuestionsState({
      displayAnswerMode: true,
      isStandalone: false,
      singleQuestionMode: false,
      questionPool: [{ id: 'q1' }],
    });

    expect(state.displayAnswerMode).toBe(true);
    expect(state.questionPool).toEqual([]);
    expect(state.surveysResponseState).toEqual([]);
    expect(state.bookmarkedQuestions).toEqual(new Set());
    expect(state.submittedSinceLastEdit).toBe(false);
    expect(state.canDecryptOtherResponsesStatus).toBe('unknown');
  });

  it('seeds standalone and single-question flows with the provided question pool', () => {
    const questionPool = [{ id: 'q1' }, { id: 'q2' }];

    expect(buildInitialSurveyQuestionsState({
      isStandalone: true,
      singleQuestionMode: false,
      questionPool,
    }).questionPool).toBe(questionPool);

    expect(buildInitialSurveyQuestionsState({
      isStandalone: false,
      singleQuestionMode: true,
      questionPool,
    }).questionPool).toBe(questionPool);
  });

  it('builds the cleared question-pool patch used by fetch fallbacks', () => {
    expect(buildClearedSurveyQuestionPoolState()).toEqual({
      questionPool: [],
      questionPoolExpectedIds: [],
      questionPoolPendingIds: [],
    });
  });

  it('reports no pending question-pool work for standalone and single-question flows', () => {
    expect(buildSurveyQuestionPoolLoadState({
      isStandalone: true,
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: ['q1'],
    })).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });

    expect(buildSurveyQuestionPoolLoadState({
      singleQuestionMode: true,
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: ['q1'],
    })).toEqual({
      expectedIds: [],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('derives pending question-pool metadata for survey flows', () => {
    expect(buildSurveyQuestionPoolLoadState({
      isStandalone: false,
      singleQuestionMode: false,
      questionPoolExpectedIds: ['q1', 'q2'],
      questionPoolPendingIds: ['q2'],
    })).toEqual({
      expectedIds: ['q1', 'q2'],
      pendingIds: ['q2'],
      pendingCount: 1,
      isIncomplete: true,
    });

    expect(buildSurveyQuestionPoolLoadState({
      questionPoolExpectedIds: ['q1'],
      questionPoolPendingIds: [],
    })).toEqual({
      expectedIds: ['q1'],
      pendingIds: [],
      pendingCount: 0,
      isIncomplete: false,
    });
  });

  it('builds the auto-decrypt disabled state patch', () => {
    expect(buildAutoDecryptDisabledState()).toEqual({
      autoDecryptEnabled: false,
      decryptingByKey: {},
    });
  });

  it('builds the response-decrypt capability state patch', () => {
    expect(buildCanDecryptOtherResponsesState()).toEqual({
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'unknown',
    });

    expect(buildCanDecryptOtherResponsesState({
      canDecrypt: true,
      status: 'granted',
    })).toEqual({
      canDecryptOtherResponses: true,
      canDecryptOtherResponsesStatus: 'granted',
    });
  });
});
