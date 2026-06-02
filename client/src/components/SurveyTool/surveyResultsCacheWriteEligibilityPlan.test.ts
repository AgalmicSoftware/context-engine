import {
  buildSurveyResultsFilterBookmarkWritePlan,
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
});
