export type SurveyResultsBookmarksCacheNamespace = 'bookmarksCache';

export type SurveyResultsBookmarksCacheReadOptions = {
  clone: false;
};

export type SurveyResultsBookmarksCacheReadPort = (
  namespace: SurveyResultsBookmarksCacheNamespace,
  slug: string,
  options: SurveyResultsBookmarksCacheReadOptions,
) => unknown;

export type SurveyResultsBookmarksCacheReadRequest = {
  namespace: SurveyResultsBookmarksCacheNamespace;
  slug: string;
  options: SurveyResultsBookmarksCacheReadOptions;
};

export type SurveyResultsBookmarkLists = {
  surveys: string[];
  questions: string[];
};

type SurveyResultsBookmarksCacheValue = {
  surveys?: unknown;
  questions?: unknown;
};

export function buildSurveyResultsBookmarksCacheReadRequest({
  slug = '',
}: { slug?: unknown } = {}): SurveyResultsBookmarksCacheReadRequest {
  return { namespace: 'bookmarksCache', slug: String(slug || ''), options: { clone: false } };
}

export function selectSurveyResultsBookmarkLists(cacheValue: unknown): SurveyResultsBookmarkLists {
  if (!cacheValue || typeof cacheValue !== 'object') {
    return { surveys: [], questions: [] };
  }
  const v = cacheValue as SurveyResultsBookmarksCacheValue;
  return {
    surveys: Array.isArray(v.surveys) ? [...(v.surveys as string[])] : [],
    questions: Array.isArray(v.questions) ? [...(v.questions as string[])] : [],
  };
}
