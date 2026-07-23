/**
 * @module components/MainSite/mainSiteRouteViewMap
 * @description Ordered route-key to render-method dispatch for MainSite.
 */

import type { ReactNode } from 'react';
import type { MainSiteRouteKey } from './routeTable.js';

export type MainSiteRouteViewKey = Exclude<MainSiteRouteKey, 'wizard' | 'notFound'>;
export type MainSiteRouteViewRenderers = {
  [Key in MainSiteRouteViewKey]: () => ReactNode;
};

export const MAIN_SITE_ROUTE_VIEW_KEYS: MainSiteRouteViewKey[] = [
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
];

export type RenderMainSiteRouteViewArgs = {
  routeKey: MainSiteRouteKey;
  fullPath: string;
  renderers: MainSiteRouteViewRenderers;
  renderNotFound: (path: string) => ReactNode;
};

export const renderMainSiteRouteView = ({
  routeKey,
  fullPath,
  renderers,
  renderNotFound,
}: RenderMainSiteRouteViewArgs): ReactNode => {
  if (routeKey === 'wizard' || routeKey === 'notFound') {
    return renderNotFound(fullPath);
  }

  for (const key of MAIN_SITE_ROUTE_VIEW_KEYS) {
    if (routeKey === key) return renderers[key]();
  }

  return renderNotFound(fullPath);
};
