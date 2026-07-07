import {
  applySurveyQuestionsRuntimeInitialState,
  createInitialSurveyQuestionsState,
  surveyQuestionsReducer,
} from './surveyQuestionsState';
import type { SurveyQuestionsRuntimeEngine, SurveyQuestionsRuntimeStrategy } from './surveyQuestionsTypes';

describe('surveyQuestionsReducer', () => {
  const baseState = createInitialSurveyQuestionsState({
    displayAnswerMode: true,
    isStandalone: true,
    questionPool: [{ id: 'q1' }],
  });

  it('shallow-merges a partial patch over the previous state and returns a new object', () => {
    const next = surveyQuestionsReducer(baseState, {
      submissionError: 'updated',
    });

    expect(next).not.toBe(baseState);
    expect(next.submissionError).toBe('updated');
    expect(next.displayAnswerMode).toBe(true);
    expect(next.questionPool).toBe(baseState.questionPool);
    expect(Object.keys(next).sort()).toEqual(Object.keys(baseState).sort());
  });

  it('accepts index-signature record patches from controller adapters', () => {
    const recordPatch: Record<string, unknown> = { modifiedCount: 3 };
    const next = surveyQuestionsReducer(baseState, recordPatch);

    expect(next.modifiedCount).toBe(3);
  });

  it('applies class-style updater functions against the previous state', () => {
    const seeded = surveyQuestionsReducer(baseState, {
      gateSbtNameRevision: 4,
    });
    const next = surveyQuestionsReducer(seeded, (prev) => ({
      gateSbtNameRevision: (prev.gateSbtNameRevision as number) + 1,
    }));

    expect(next.gateSbtNameRevision).toBe(5);
    expect(next.submissionError).toBe(seeded.submissionError);
  });

  it('returns a fresh object even for an empty patch', () => {
    const next = surveyQuestionsReducer(baseState, {});

    expect(next).not.toBe(baseState);
    expect(next).toEqual(baseState);
  });
});

describe('createInitialSurveyQuestionsState', () => {
  it('mirrors the legacy constructor defaults', () => {
    const state = createInitialSurveyQuestionsState({
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
    expect(state.lockedGateDetailsExpanded).toBe(false);
  });

  it('preserves the provided question pool for standalone and single-question flows', () => {
    const questionPool = [{ id: 'q1' }];

    expect(
      createInitialSurveyQuestionsState({
        isStandalone: true,
        questionPool,
      }).questionPool,
    ).toBe(questionPool);

    expect(
      createInitialSurveyQuestionsState({
        singleQuestionMode: true,
        questionPool,
      }).questionPool,
    ).toBe(questionPool);
  });
});

describe('applySurveyQuestionsRuntimeInitialState', () => {
  it('leaves base state unchanged when there is no runtime strategy', () => {
    const baseState = createInitialSurveyQuestionsState({});
    const engine = {
      props: {},
      state: baseState,
      setState: jest.fn(),
    } as unknown as SurveyQuestionsRuntimeEngine;

    expect(applySurveyQuestionsRuntimeInitialState(baseState, engine)).toBe(baseState);
  });

  it('merges runtime initial state through the existing strategy engine seam', () => {
    const baseState = createInitialSurveyQuestionsState({});
    const strategy: SurveyQuestionsRuntimeStrategy = {
      buildInitialState: jest.fn(() => ({
        showComments: { q1: true },
        pileQuestions: [{ id: 'q1' }],
      })),
    };
    const engine = {
      props: { runtimeStrategy: strategy },
      state: null,
      setState: jest.fn(),
      runtimeField: true,
    } as unknown as SurveyQuestionsRuntimeEngine;

    const next = applySurveyQuestionsRuntimeInitialState(baseState, engine);

    expect(strategy.buildInitialState).toHaveBeenCalledWith(engine);
    expect(engine.state).toBe(baseState);
    expect(next).not.toBe(baseState);
    expect(next.showComments).toEqual({ q1: true });
    expect(next.pileQuestions).toEqual([{ id: 'q1' }]);
    expect(next.submissionError).toBe(baseState.submissionError);
  });
});
