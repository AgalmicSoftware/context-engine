import {
  buildSurveyResultsBookmarksCacheReadRequest,
  selectSurveyResultsBookmarkLists,
} from './surveyResultsBookmarkCacheReadPorts';

describe('surveyResultsBookmarkCacheReadPorts', () => {
  it('builds the current bookmark cache read identity', () => {
    expect(buildSurveyResultsBookmarksCacheReadRequest({ slug: 'alpha-session' })).toEqual({
      namespace: 'bookmarksCache',
      slug: 'alpha-session',
      options: { clone: false },
    });
  });

  it('coerces non-string slugs and defaults to an empty slug', () => {
    expect(buildSurveyResultsBookmarksCacheReadRequest({ slug: 123 })).toEqual({
      namespace: 'bookmarksCache',
      slug: '123',
      options: { clone: false },
    });

    expect(buildSurveyResultsBookmarksCacheReadRequest()).toEqual({
      namespace: 'bookmarksCache',
      slug: '',
      options: { clone: false },
    });
  });

  it('selects bookmark lists from valid cache values as copied arrays', () => {
    const surveys = ['survey-a', 'survey-b'];
    const questions = ['question-a'];
    const selected = selectSurveyResultsBookmarkLists({ surveys, questions });

    expect(selected).toEqual({
      surveys: ['survey-a', 'survey-b'],
      questions: ['question-a'],
    });
    expect(selected.surveys).not.toBe(surveys);
    expect(selected.questions).not.toBe(questions);
  });

  it('defaults nullish and malformed cache values to empty lists', () => {
    expect(selectSurveyResultsBookmarkLists(null)).toEqual({ surveys: [], questions: [] });
    expect(selectSurveyResultsBookmarkLists(undefined)).toEqual({ surveys: [], questions: [] });
    expect(selectSurveyResultsBookmarkLists({})).toEqual({ surveys: [], questions: [] });
    expect(selectSurveyResultsBookmarkLists({ surveys: 'x', questions: 5 })).toEqual({
      surveys: [],
      questions: [],
    });
  });

  it('requires both survey and question arrays before selecting lists', () => {
    expect(selectSurveyResultsBookmarkLists({ surveys: ['survey-only'] })).toEqual({
      surveys: [],
      questions: [],
    });
    expect(selectSurveyResultsBookmarkLists({ questions: ['question-only'] })).toEqual({
      surveys: [],
      questions: [],
    });
  });
});
