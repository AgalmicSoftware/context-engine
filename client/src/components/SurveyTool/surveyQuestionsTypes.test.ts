import {
  buildInitialSurveyQuestionsState,
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
});
