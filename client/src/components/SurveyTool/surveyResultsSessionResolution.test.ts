import {
  resolveSurveyResultsExplicitSessionSlug,
  resolveSurveyResultsEffectiveSlug,
  resolveSurveyResultsQuestionReadScope,
  resolveSurveyResultsSessionContext,
  scanSurveyResultsSessionSlugFromCache,
} from './surveyResultsSessionResolution.js';

describe('surveyResultsSessionResolution', () => {
  it('preserves explicit session slugs while still canonicalizing the general alias', () => {
    expect(
      resolveSurveyResultsExplicitSessionSlug({
        sessionSlug: ' DEBATE ',
        activeSessionSlug: 'edge',
      }),
    ).toBe('DEBATE');

    expect(
      resolveSurveyResultsExplicitSessionSlug({
        sessionSlug: 'general',
        activeSessionSlug: 'edge',
      }),
    ).toBe('');
  });

  it('prefers explicit query session pins over hardcoded session routes', () => {
    expect(
      resolveSurveyResultsExplicitSessionSlug({
        search: '?session=alpha',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
      }),
    ).toBe('alpha');

    expect(
      resolveSurveyResultsQuestionReadScope({
        pathname: '/session/edge/questions/results',
        search: '?session=alpha',
        activeSessionSlug: 'edge',
        viewMode: 'questions',
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['edge', 'alpha', 'beta'],
      }),
    ).toEqual({
      baseSlug: 'alpha',
      questionReadSlugs: ['alpha'],
      extraQuestionReadSlugs: [],
      storageKeyPrefix: 'dg:filters:alpha',
    });
  });

  it('does not replace an explicit unknown non-general slug from cache hits', () => {
    expect(
      resolveSurveyResultsEffectiveSlug({
        sessionSlug: 'missing-session-slug',
        surveyId: 'survey-1',
        surveyCacheEntries: [
          {
            slug: 'edge',
            value: {
              '84532': {
                surveys: {
                  'survey-1': { title: 'Edge survey' },
                },
              },
            },
          },
        ],
      }),
    ).toBe('missing-session-slug');
  });

  it('preserves cache-entry session slugs when scanning survey caches by survey id', () => {
    expect(
      scanSurveyResultsSessionSlugFromCache({
        surveyId: 'Survey-1',
        surveyCacheEntries: [
          {
            slug: 'DEBATE',
            value: {
              '84532': {
                surveys: {
                  'survey-1': { title: 'Debate survey' },
                },
              },
            },
          },
        ],
      }),
    ).toBe('DEBATE');
  });

  it('returns the canonical general slug when an explicit general alias is provided', () => {
    expect(
      resolveSurveyResultsEffectiveSlug({
        sessionSlug: 'General',
        surveyId: 'survey-1',
        surveyCacheEntries: [
          {
            slug: 'edge',
            value: {
              '84532': {
                surveys: {
                  'survey-1': { title: 'Edge survey' },
                },
              },
            },
          },
        ],
      }),
    ).toBe('');
  });

  it('fails closed for unresolved explicit session aliases', () => {
    const resolveBySlug = jest.fn((slug: string) => (slug === 'rxc' ? { slug: 'rxc', networkChainId: 84532 } : null));

    const resolved = resolveSurveyResultsSessionContext({
      sessionSlug: 'DEBATE',
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'DEBATE',
      sessionConfig: null,
    });
    expect(resolveBySlug).toHaveBeenCalledWith('DEBATE');
  });

  it('does not inherit the general session config for unknown cache-scanned slugs', () => {
    const resolveBySlug = jest.fn((slug: string) => (slug === '' ? { slug: '', networkChainId: 84532 } : null));

    const resolved = resolveSurveyResultsSessionContext({
      surveyId: 'survey-1',
      surveyCacheEntries: [
        {
          slug: 'missing-session-slug',
          value: {
            '84532': {
              surveys: {
                'survey-1': { title: 'Unknown survey' },
              },
            },
          },
        },
      ],
      resolveBySlug,
    });

    expect(resolved).toMatchObject({
      sessionSlug: 'missing-session-slug',
      sessionConfig: null,
    });
    expect(resolveBySlug).toHaveBeenCalledWith('missing-session-slug');
    expect(resolveBySlug).not.toHaveBeenCalledWith('');
  });

  it('keeps session-pinned question-mode results single-session even when the global scan scope is list', () => {
    expect(
      resolveSurveyResultsQuestionReadScope({
        pathname: '/session/edge',
        search: '?session=edge',
        activeSessionSlug: 'edge',
        viewMode: 'questions',
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['edge', 'alpha', 'beta'],
      }),
    ).toEqual({
      baseSlug: 'edge',
      questionReadSlugs: ['edge'],
      extraQuestionReadSlugs: [],
      storageKeyPrefix: 'dg:filters:edge',
    });
  });

  it('includes the canonical general source for built-in demo question results', () => {
    expect(
      resolveSurveyResultsQuestionReadScope({
        pathname: '/questions/results',
        search: '?session=demo',
        activeSessionSlug: 'demo',
        viewMode: 'questions',
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['demo', 'edge'],
      }),
    ).toEqual({
      baseSlug: 'demo',
      questionReadSlugs: ['demo', ''],
      extraQuestionReadSlugs: [],
      storageKeyPrefix: 'dg:filters:__scope__:__general__|demo',
    });
  });

  it('treats pinned session props as an explicit question-results scope pin', () => {
    expect(
      resolveSurveyResultsQuestionReadScope({
        pathname: '/questions/results',
        search: '',
        sessionSlug: 'edge',
        activeSessionSlug: 'edge',
        sessionSlugPinned: true,
        viewMode: 'questions',
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['edge', 'alpha', 'beta'],
      }),
    ).toEqual({
      baseSlug: 'edge',
      questionReadSlugs: ['edge'],
      extraQuestionReadSlugs: [],
      storageKeyPrefix: 'dg:filters:edge',
    });
  });

  it('fans out generic question-mode results across list scope when no explicit session pin is present', () => {
    expect(
      resolveSurveyResultsQuestionReadScope({
        pathname: '/questions/results',
        activeSessionSlug: 'edge',
        viewMode: 'questions',
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['edge', 'alpha', 'beta'],
      }),
    ).toEqual({
      baseSlug: 'edge',
      questionReadSlugs: ['edge', 'alpha', 'beta'],
      extraQuestionReadSlugs: ['alpha', 'beta'],
      storageKeyPrefix: 'dg:filters:__scope__:alpha|beta|edge',
    });
  });

  it('keeps survey-mode results single-session even when the global scan scope is list', () => {
    expect(
      resolveSurveyResultsQuestionReadScope({
        pathname: '/session/edge',
        activeSessionSlug: 'edge',
        viewMode: 'survey',
        readSessionScanScope: () => 'list',
        readSessionScanSlugs: () => ['edge', 'alpha', 'beta'],
      }),
    ).toEqual({
      baseSlug: 'edge',
      questionReadSlugs: ['edge'],
      extraQuestionReadSlugs: [],
      storageKeyPrefix: 'dg:filters:edge',
    });
  });
});
