type SurveyResultsRecord = Record<string, unknown>;

export type SurveyResultsFilterBookmarkWritePlanArgs = {
  filtersCache?: unknown;
  filterState?: unknown;
  filtersCacheLoaded?: unknown;
  isMounted?: unknown;
  slug?: unknown;
};

export type SurveyResultsFilterBookmarkWritePlan = {
  blockedReason: '' | 'unmounted';
  bookmarkedFiltersInvalid: boolean;
  payload: SurveyResultsRecord | null;
  shouldReadCache: boolean;
  shouldWrite: boolean;
  successFeedback: boolean;
  target: {
    namespace: 'filters';
    slug: string;
  };
};

const toRecord = (value: unknown): SurveyResultsRecord => (
  value && typeof value === 'object' ? value as SurveyResultsRecord : {}
);

export const buildSurveyResultsFilterBookmarkWritePlan = ({
  filtersCache = {},
  filterState = {},
  filtersCacheLoaded = false,
  isMounted = false,
  slug = '',
}: SurveyResultsFilterBookmarkWritePlanArgs = {}): SurveyResultsFilterBookmarkWritePlan => {
  const target = {
    namespace: 'filters' as const,
    slug: String(slug || ''),
  };

  if (isMounted !== true) {
    return {
      blockedReason: 'unmounted',
      bookmarkedFiltersInvalid: false,
      payload: null,
      shouldReadCache: false,
      shouldWrite: false,
      successFeedback: false,
      target,
    };
  }

  if (filtersCacheLoaded !== true) {
    return {
      blockedReason: '',
      bookmarkedFiltersInvalid: false,
      payload: null,
      shouldReadCache: true,
      shouldWrite: false,
      successFeedback: false,
      target,
    };
  }

  const filtersCacheRecord = toRecord(filtersCache);
  const bookmarkedFilters = filtersCacheRecord.bookmarkedFilters;
  const validBookmarks = Array.isArray(bookmarkedFilters) ? [...bookmarkedFilters] : [];

  return {
    blockedReason: '',
    bookmarkedFiltersInvalid: bookmarkedFilters != null && !Array.isArray(bookmarkedFilters),
    payload: {
      ...filtersCacheRecord,
      bookmarkedFilters: [...validBookmarks, filterState],
    },
    shouldReadCache: true,
    shouldWrite: true,
    successFeedback: true,
    target,
  };
};
