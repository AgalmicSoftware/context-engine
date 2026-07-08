import { MAIN_SITE_ROUTE_DEFINITIONS, resolveMainSiteRouteMatch } from './routeTable.js';

const ADDRESS = '0x00000000000000000000000000000000000000f1';
const SURVEY_ID = `0x${'a'.repeat(64)}`;
const QUESTION_ID = `0x${'b'.repeat(64)}`;

const isAddress = (value: string) => /^0x[0-9a-fA-F]{40}$/.test(value);

describe('MainSite route table', () => {
  it('publishes a stable ordered set of route keys', () => {
    expect(MAIN_SITE_ROUTE_DEFINITIONS.map((entry) => entry.key)).toEqual([
      'wizard',
      'surveyId',
      'home',
      'debate',
      'atlas',
      'tag',
      'bookmarks',
      'compare',
      'surveysOrQuestionsList',
      'questionDetail',
      'sbtCreate',
      'sbtsList',
      'sbtDetail',
      'simUser',
      'userProfile',
      'about',
      'posts',
      'demos',
      'matrix',
      'contracts',
      'admin',
      'sponsor',
      'agent',
      'session',
    ]);
  });

  it.each([
    ['/session/edge', 'session', { sessionToken: 'edge' }],
    ['/session/edge/questions', 'session', { sessionToken: 'edge' }],
    ['/session/edge/docs', 'session', { sessionToken: 'edge' }],
    [`/survey/${SURVEY_ID}/results`, 'surveyId', { surveyIDFromPath: SURVEY_ID }],
    [`/question/${QUESTION_ID}?session=edge`, 'questionDetail', { questionId: QUESTION_ID }],
    ['/sbts/new', 'sbtCreate', {}],
    ['/groups/new/', 'sbtCreate', {}],
    [`/sbt/${ADDRESS}`, 'sbtDetail', { sbtAddress: ADDRESS }],
    ['/group/public-reviewers', 'sbtsList', { sbtAddress: null }],
    [`/u/${ADDRESS}`, 'userProfile', {}],
    ['/admin', 'admin', {}],
    ['/sponsor', 'sponsor', {}],
    ['/posts', 'posts', {}],
    ['/posts/first-post', 'posts', {}],
  ])('classifies %s as %s', (fullPath, key, expected) => {
    expect(resolveMainSiteRouteMatch({ fullPath, isAddress })).toEqual(
      expect.objectContaining({
        key,
        ...expected,
      }),
    );
  });

  it('keeps alias and canonicalization decisions visible to the caller', () => {
    expect(resolveMainSiteRouteMatch({ fullPath: '/new', isAddress })).toEqual(
      expect.objectContaining({
        key: 'wizard',
        canonicalPath: '/session/new',
      }),
    );
    expect(resolveMainSiteRouteMatch({ fullPath: '/session/new', isAddress })).toEqual(
      expect.objectContaining({
        key: 'wizard',
        canonicalPath: undefined,
      }),
    );
    expect(resolveMainSiteRouteMatch({ fullPath: '/groups/edge', isAddress })).toEqual(
      expect.objectContaining({
        key: 'sbtsList',
        sbtAddress: null,
      }),
    );
    expect(resolveMainSiteRouteMatch({ fullPath: `/group/${ADDRESS}`, isAddress })).toEqual(
      expect.objectContaining({
        key: 'sbtDetail',
        sbtAddress: ADDRESS,
      }),
    );
  });

  it('keeps accepted double-slash SBT address paths on the SBT detail route', () => {
    // The route contract accepts this degenerate path family as SBT detail.
    expect(resolveMainSiteRouteMatch({ fullPath: `//sbt/${ADDRESS}`, isAddress })).toEqual(
      expect.objectContaining({
        key: 'sbtDetail',
        sbtAddress: ADDRESS,
      }),
    );
    expect(resolveMainSiteRouteMatch({ fullPath: `//group/${ADDRESS}`, isAddress })).toEqual(
      expect.objectContaining({
        key: 'sbtDetail',
        sbtAddress: ADDRESS,
      }),
    );
  });

  it('exposes cache-wait metadata without rendering anything', () => {
    expect(resolveMainSiteRouteMatch({ fullPath: '/admin', isAddress })).toEqual(
      expect.objectContaining({
        isKnownRoutePrefix: true,
        shouldBypassCacheHydrationWait: true,
      }),
    );
    expect(resolveMainSiteRouteMatch({ fullPath: '/posts', isAddress })).toEqual(
      expect.objectContaining({
        isKnownRoutePrefix: true,
        shouldBypassCacheHydrationWait: true,
      })
    );
    expect(resolveMainSiteRouteMatch({ fullPath: '/posts/first-post', isAddress })).toEqual(
      expect.objectContaining({
        key: 'posts',
        isKnownRoutePrefix: true,
        shouldBypassCacheHydrationWait: true,
      })
    );
    expect(resolveMainSiteRouteMatch({ fullPath: '/not-a-route', isAddress })).toEqual(
      expect.objectContaining({
        key: 'notFound',
        isKnownRoutePrefix: false,
        shouldBypassCacheHydrationWait: false,
      }),
    );
  });
});
