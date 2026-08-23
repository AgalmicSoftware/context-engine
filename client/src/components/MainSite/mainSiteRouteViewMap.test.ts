import { MAIN_SITE_ROUTE_DEFINITIONS } from './routeTable.js';
import {
  renderMainSiteRouteView,
  type MainSiteRouteViewKey,
  type MainSiteRouteViewRenderers,
} from './mainSiteRouteViewMap.js';

const buildRenderers = (calls: string[] = []): MainSiteRouteViewRenderers => {
  const render = (key: string) => () => {
    calls.push(key);
    return key;
  };
  return {
    surveyId: render('surveyId'),
    home: render('home'),
    debate: render('debate'),
    atlas: render('atlas'),
    tag: render('tag'),
    bookmarks: render('bookmarks'),
    compare: render('compare'),
    surveysOrQuestionsList: render('surveysOrQuestionsList'),
    questionDetail: render('questionDetail'),
    sbtCreate: render('sbtCreate'),
    sbtsList: render('sbtsList'),
    sbtDetail: render('sbtDetail'),
    simUser: render('simUser'),
    userProfile: render('userProfile'),
    about: render('about'),
    posts: render('posts'),
    demos: render('demos'),
    benchmarks: render('benchmarks'),
    matrix: render('matrix'),
    docs: render('docs'),
    admin: render('admin'),
    sponsor: render('sponsor'),
    agent: render('agent'),
    session: render('session'),
  };
};

describe('mainSiteRouteViewMap', () => {
  it('dispatches every concrete route definition in order to exactly one renderer', () => {
    const calls: string[] = [];
    const renderers = buildRenderers(calls);
    const routeKeys = MAIN_SITE_ROUTE_DEFINITIONS
      .map(({ key }) => key)
      .filter((key): key is MainSiteRouteViewKey => key !== 'wizard' && key !== 'notFound');

    expect(routeKeys).toEqual(Object.keys(renderers));

    for (const routeKey of routeKeys) {
      calls.length = 0;
      const result = renderMainSiteRouteView({
        routeKey,
        fullPath: `/${routeKey}`,
        renderers,
        renderNotFound: (path) => `notFound:${path}`,
      });

      expect(result).toBe(routeKey);
      expect(calls).toEqual([routeKey]);
    }
  });

  it.each(['wizard', 'notFound'] as const)('falls back to the not-found renderer for %s', (routeKey) => {
    const calls: string[] = [];

    expect(
      renderMainSiteRouteView({
        routeKey,
        fullPath: '/missing',
        renderers: buildRenderers(calls),
        renderNotFound: (path) => `notFound:${path}`,
      }),
    ).toBe('notFound:/missing');
    expect(calls).toEqual([]);
  });
});
