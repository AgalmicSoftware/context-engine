/**
 * @module components/MainSite/urlUtils
 */

import { buildPublicRoute as buildSharedPublicRoute, stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { isRouteResponderAddress } from '../../utilities/session/mainSiteUtils.js';

export const buildPublicRoute = (pathname = ''): string => buildSharedPublicRoute(pathname);

export const stripConfiguredPublicBasePath = (pathname = ''): string => stripPublicUrlBasePath(pathname);

export const buildPublicUrl = (pathname = '', search = '', hash = ''): string => {
  const normalizedSearch = search ? (String(search).startsWith('?') ? String(search) : `?${search}`) : '';
  const normalizedHash = hash ? (String(hash).startsWith('#') ? String(hash) : `#${hash}`) : '';
  return `${buildPublicRoute(pathname)}${normalizedSearch}${normalizedHash}`;
};

export const replaceRouteResponderQueryParam = (
  pathname: string | null | undefined,
  responder: unknown,
  search = '',
): void => {
  if (typeof window === 'undefined' || !pathname || !isRouteResponderAddress(responder)) return;
  const params = new URLSearchParams(String(search || ''));
  params.set('responder', String(responder || '').trim());
  const nextSearch = params.toString();
  const nextUrl = buildPublicUrl(pathname, nextSearch ? `?${nextSearch}` : '', window.location.hash || '');
  const currentUrl = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState({}, '', nextUrl);
  }
};
