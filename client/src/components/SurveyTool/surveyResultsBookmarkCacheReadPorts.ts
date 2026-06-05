export type SurveyResultsBookmarksCacheNamespace = 'bookmarksCache';

export type SurveyResultsBookmarksCacheReadOptions = {
  clone: false;
};

export type SurveyResultsBookmarksCacheReadPort = (
  namespace: SurveyResultsBookmarksCacheNamespace,
  slug: string,
  options: SurveyResultsBookmarksCacheReadOptions
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

export function buildSurveyResultsBookmarksCacheReadRequest(
  { slug = '' }: { slug?: unknown } = {}
): SurveyResultsBookmarksCacheReadRequest {
  return { namespace: 'bookmarksCache', slug: String(slug || ''), options: { clone: false } };
}

export function selectSurveyResultsBookmarkLists(cacheValue: unknown): SurveyResultsBookmarkLists {
  const ok = !!cacheValue && typeof cacheValue === 'object'
    && Array.isArray((cacheValue as any).surveys)
    && Array.isArray((cacheValue as any).questions);
  if (!ok) return { surveys: [], questions: [] };
  const v = cacheValue as { surveys: unknown[]; questions: unknown[] };
  return { surveys: [...(v.surveys as string[])], questions: [...(v.questions as string[])] };
}
