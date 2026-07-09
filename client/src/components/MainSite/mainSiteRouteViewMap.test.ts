import { MAIN_SITE_ROUTE_DEFINITIONS } from './routeTable.js';
import {
  MAIN_SITE_ROUTE_VIEW_KEYS,
  renderMainSiteRouteView,
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
    sbtsList: render('sbtsList'),
    sbtDetail: render('sbtDetail'),
    simUser: render('simUser'),
    userProfile: render('userProfile'),
    about: render('about'),
    demos: render('demos'),
    matrix: render('matrix'),
    contracts: render('contracts'),
    admin: render('admin'),
    sponsor: render('sponsor'),
    agent: render('agent'),
    session: render('session'),
  };
};

describe('mainSiteRouteViewMap', () => {
  it('tracks every non-wizard concrete route definition in order', () => {
    expect(MAIN_SITE_ROUTE_VIEW_KEYS).toEqual(
      MAIN_SITE_ROUTE_DEFINITIONS.map(({ key }) => key).filter((key) => key !== 'wizard'),
    );
  });

  it('dispatches the matched route key to exactly one renderer', () => {
    const calls: string[] = [];
    const result = renderMainSiteRouteView({
      routeKey: 'tag',
      fullPath: '/tag/example',
      renderers: buildRenderers(calls),
      renderNotFound: (path) => `notFound:${path}`,
    });

    expect(result).toBe('tag');
    expect(calls).toEqual(['tag']);
  });

  it('falls back to the not-found renderer for unresolved route keys', () => {
    const calls: string[] = [];

    expect(
      renderMainSiteRouteView({
        routeKey: 'notFound',
        fullPath: '/missing',
        renderers: buildRenderers(calls),
        renderNotFound: (path) => `notFound:${path}`,
      }),
    ).toBe('notFound:/missing');
    expect(calls).toEqual([]);
  });
});
