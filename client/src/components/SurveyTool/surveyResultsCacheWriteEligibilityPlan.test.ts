import {
  buildSurveyResultsFilterBookmarkWritePlan,
  buildSurveyResultsSurveyQuestionBookmarkWritePlan,
} from './surveyResultsCacheWriteEligibilityPlan';

describe('surveyResultsCacheWriteEligibilityPlan', () => {
  it('blocks filter bookmark writes before cache reads when the results view is unmounted', () => {
    expect(buildSurveyResultsFilterBookmarkWritePlan({
      filterState: { type: 'radio' },
      isMounted: false,
      slug: 'edge',
    })).toEqual({
      blockedReason: 'unmounted',
      bookmarkedFiltersInvalid: false,
      payload: null,
      shouldReadCache: false,
      shouldWrite: false,
      successFeedback: false,
      target: {
        namespace: 'filters',
        slug: 'edge',
      },
    });
  });

  it('plans a read-only cache lookup before deriving a filter bookmark write payload', () => {
    expect(buildSurveyResultsFilterBookmarkWritePlan({
      filterState: { type: 'radio' },
      isMounted: true,
      slug: 'edge',
    })).toEqual({
      blockedReason: '',
      bookmarkedFiltersInvalid: false,
      payload: null,
      shouldReadCache: true,
      shouldWrite: false,
      successFeedback: false,
      target: {
        namespace: 'filters',
        slug: 'edge',
      },
    });
  });

  it('derives the target identity and payload shape from passed-in cache values', () => {
    const filterState = { types: ['radio'], tags: ['alpha'] };
    const filtersCache = {
      bookmarkedFilters: ['existing-filter'],
      otherField: 'kept',
    };

    const plan = buildSurveyResultsFilterBookmarkWritePlan({
      filtersCache,
      filtersCacheLoaded: true,
      filterState,
      isMounted: true,
      slug: 'edge',
    });

    expect(plan).toEqual({
      blockedReason: '',
      bookmarkedFiltersInvalid: false,
      payload: {
        bookmarkedFilters: ['existing-filter', filterState],
        otherField: 'kept',
      },
      shouldReadCache: true,
      shouldWrite: true,
      successFeedback: true,
      target: {
        namespace: 'filters',
        slug: 'edge',
      },
    });
    expect(filtersCache.bookmarkedFilters).toEqual(['existing-filter']);
  });

  it('flags invalid bookmark cache shape while preserving unrelated payload fields', () => {
    expect(buildSurveyResultsFilterBookmarkWritePlan({
      filtersCache: {
        bookmarkedFilters: 'not-an-array',
        otherField: 'kept',
      },
      filtersCacheLoaded: true,
      filterState: { type: 'slider' },
      isMounted: true,
      slug: '',
    })).toEqual({
      blockedReason: '',
      bookmarkedFiltersInvalid: true,
      payload: {
        bookmarkedFilters: [{ type: 'slider' }],
        otherField: 'kept',
      },
      shouldReadCache: true,
      shouldWrite: true,
      successFeedback: true,
      target: {
        namespace: 'filters',
        slug: '',
      },
    });
  });

  it('plans survey bookmark payloads without mutating the source cache', () => {
    const bookmarksCache = {
      surveys: ['existing-survey'],
      questions: ['existing-question'],
      otherField: 'kept',
    };

    const plan = buildSurveyResultsSurveyQuestionBookmarkWritePlan({
      bookmarkId: 's2',
      bookmarkType: 'survey',
      bookmarksCache,
      slug: 'edge',
    });

    expect(plan).toEqual({
      blockedReason: '',
      payload: {
        surveys: ['existing-survey', 's2'],
        questions: ['existing-question'],
        otherField: 'kept',
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedSurveyIDs',
        value: ['existing-survey', 's2'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'survey',
        id: 's2',
      },
    });
    expect(bookmarksCache).toEqual({
      surveys: ['existing-survey'],
      questions: ['existing-question'],
      otherField: 'kept',
    });
  });

  it('plans question bookmark removals and preserves current empty-slug identity', () => {
    expect(buildSurveyResultsSurveyQuestionBookmarkWritePlan({
      bookmarkId: 'q1',
      bookmarkType: 'question',
      bookmarksCache: {
        surveys: ['s1'],
        questions: ['q1', 'q2'],
      },
      slug: '',
    })).toEqual({
      blockedReason: '',
      payload: {
        surveys: ['s1'],
        questions: ['q2'],
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedQuestionIDs',
        value: ['q2'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: '',
      },
      toggled: {
        action: 'remove',
        bookmarkType: 'question',
        id: 'q1',
      },
    });
  });

  it('normalizes malformed bookmark cache lists while preserving unrelated fields', () => {
    expect(buildSurveyResultsSurveyQuestionBookmarkWritePlan({
      bookmarkId: 'q2',
      bookmarkType: 'question',
      bookmarksCache: {
        surveys: 'bad-surveys',
        questions: 'bad-questions',
        otherField: 'kept',
      },
      slug: 'edge',
    })).toEqual({
      blockedReason: '',
      payload: {
        surveys: [],
        questions: ['q2'],
        otherField: 'kept',
      },
      shouldWrite: true,
      statePatch: {
        key: 'bookmarkedQuestionIDs',
        value: ['q2'],
      },
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: {
        action: 'add',
        bookmarkType: 'question',
        id: 'q2',
      },
    });
  });

  it('blocks invalid survey/question bookmark write plan kinds', () => {
    expect(buildSurveyResultsSurveyQuestionBookmarkWritePlan({
      bookmarkId: 'x1',
      bookmarkType: 'unsupported',
      bookmarksCache: {
        surveys: ['s1'],
        questions: ['q1'],
      },
      slug: 'edge',
    })).toEqual({
      blockedReason: 'invalid-bookmark-type',
      payload: null,
      shouldWrite: false,
      statePatch: null,
      target: {
        namespace: 'bookmarksCache',
        slug: 'edge',
      },
      toggled: null,
    });
  });
});
