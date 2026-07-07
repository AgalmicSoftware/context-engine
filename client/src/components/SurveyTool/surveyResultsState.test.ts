import {
  createInitialSurveyResultsState,
  preserveSurveyResultsFilterStateValue,
  surveyResultsReducer,
} from './surveyResultsState';
import { SURVEY_RESULTS_EXPORT_TYPES } from './surveyResultsExportPlans';
import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';

jest.mock('../../utilities/cache/cacheScripts.js', () => ({
  peekCacheSync: jest.fn(() => null),
}));

const mockPeekCacheSync = peekCacheSync as jest.Mock;

describe('surveyResultsReducer', () => {
  const baseState = createInitialSurveyResultsState({});

  it('shallow-merges a partial patch over the previous state and returns a new object', () => {
    const next = surveyResultsReducer(baseState, {
      alertMessage: 'updated',
    });
    expect(next).not.toBe(baseState);
    expect(next.alertMessage).toBe('updated');
    expect(next.surveyViewMode).toBe(baseState.surveyViewMode);
    expect(Object.keys(next).sort()).toEqual(Object.keys(baseState).sort());
  });

  it('accepts index-signature record patches (legacy queueStatePatch shape)', () => {
    const recordPatch: Record<string, unknown> = { filteredResponsesCount: 3 };
    const next = surveyResultsReducer(baseState, recordPatch);
    expect(next.filteredResponsesCount).toBe(3);
  });

  it('applies class-style updater functions against the previous state', () => {
    const seeded = surveyResultsReducer(baseState, {
      totalResponsesCount: 4,
    });
    const next = surveyResultsReducer(seeded, (prev) => ({
      totalResponsesCount: (prev.totalResponsesCount as number) + 1,
    }));
    expect(next.totalResponsesCount).toBe(5);
    expect(next.surveyId).toBe(seeded.surveyId);
  });

  it('returns a fresh object even for an empty patch (no setState bail-out drift)', () => {
    const next = surveyResultsReducer(baseState, {});
    expect(next).not.toBe(baseState);
    expect(next).toEqual(baseState);
  });
});

describe('createInitialSurveyResultsState', () => {
  beforeEach(() => {
    mockPeekCacheSync.mockReset();
    mockPeekCacheSync.mockReturnValue(null);
  });

  it('mirrors the legacy constructor defaults', () => {
    const state = createInitialSurveyResultsState({ viewMode: 'questions' });
    expect(state.viewMode).toBe('questions');
    expect(state.surveyId).toBe('');
    expect(state.exportType).toBe(SURVEY_RESULTS_EXPORT_TYPES.CSV_QUESTIONS_AND_RESPONSES);
    expect(state.surveyViewMode).toBe('individuals');
    expect(state.questionIdSortBy).toBe('responses');
    expect(state.questionIdSortAsc).toBe(true);
    expect(state.responses).toEqual([]);
    expect(state.filterState).toEqual({});
    expect(state.htmlReportAnalysisArtifact).toBeNull();
    expect(state.demoResultsViewMode).toBe('raw');
  });

  it('preserves a provided filterState reference and normalizes a missing one', () => {
    const filterState = { tags: ['a'] };
    expect(createInitialSurveyResultsState({ filterState }).filterState).toBe(filterState);
    expect(createInitialSurveyResultsState({ filterState: null }).filterState).toEqual({});
  });

  it('maps filteredQuestionsCount undefined to null but keeps explicit values', () => {
    expect(createInitialSurveyResultsState({}).filteredQuestionsCount).toBeNull();
    expect(createInitialSurveyResultsState({ filteredQuestionsCount: 0 }).filteredQuestionsCount).toBe(0);
    expect(createInitialSurveyResultsState({ filteredQuestionsCount: 7 }).filteredQuestionsCount).toBe(7);
  });

  it('bootstraps bookmark lists from the bookmarks cache', () => {
    mockPeekCacheSync.mockReturnValue({ surveys: ['0xs1'], questions: ['q1', 'q2'] });
    const state = createInitialSurveyResultsState({ sessionSlug: 'demo-session' });
    expect(mockPeekCacheSync).toHaveBeenCalledWith(
      'bookmarksCache',
      'demo-session',
      { clone: false }
    );
    expect(state.bookmarkedSurveyIDs).toEqual(['0xs1']);
    expect(state.bookmarkedQuestionIDs).toEqual(['q1', 'q2']);
  });

  it('falls back to empty bookmark lists when the cache read throws', () => {
    mockPeekCacheSync.mockImplementation(() => {
      throw new Error('cache unavailable');
    });
    const state = createInitialSurveyResultsState({});
    expect(state.bookmarkedSurveyIDs).toEqual([]);
    expect(state.bookmarkedQuestionIDs).toEqual([]);
  });
});

describe('preserveSurveyResultsFilterStateValue', () => {
  it('passes through truthy values and normalizes falsy ones to {}', () => {
    const value = { sbtFilter: { any: [] } };
    expect(preserveSurveyResultsFilterStateValue(value)).toBe(value);
    expect(preserveSurveyResultsFilterStateValue(null)).toEqual({});
    expect(preserveSurveyResultsFilterStateValue(undefined)).toEqual({});
  });
});
