/**
 * @module components/MainSite/mainSiteRouteViewMap
 * @description Typed route-key to render-method dispatch for MainSite.
 */

import type { ReactNode } from 'react';
import type { MainSiteRouteKey } from './routeTable.js';

export type MainSiteRouteViewKey = Exclude<MainSiteRouteKey, 'wizard' | 'notFound'>;
export type MainSiteRouteViewRenderers = {
  [Key in MainSiteRouteViewKey]: () => ReactNode;
};

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

  return renderers[routeKey]();
};
