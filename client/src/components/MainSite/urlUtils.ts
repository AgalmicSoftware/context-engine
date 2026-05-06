/**
 * @module components/MainSite/urlUtils
 */

import { buildPublicRoute as buildSharedPublicRoute, readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { isRouteResponderAddress } from './mainSiteUtils.js';

export const getConfiguredPublicBasePath = (): string => readPublicUrlBasePath();

export const buildPublicRoute = (pathname = ''): string => buildSharedPublicRoute(pathname);

export const stripConfiguredPublicBasePath = (pathname = ''): string => {
  const rawPath = String(pathname || '').trim();
  const basePath = getConfiguredPublicBasePath();
  if (!rawPath || !basePath || basePath === '/') return rawPath;
  if (rawPath === basePath || rawPath === `${basePath}/`) return '/';
  if (rawPath.startsWith(`${basePath}/`)) {
    return rawPath.slice(basePath.length) || '/';
  }
  return rawPath;
};

export const buildPublicUrl = (pathname = '', search = '', hash = ''): string => {
  const normalizedSearch = search
    ? (String(search).startsWith('?') ? String(search) : `?${search}`)
    : '';
  const normalizedHash = hash
    ? (String(hash).startsWith('#') ? String(hash) : `#${hash}`)
    : '';
  return `${buildPublicRoute(pathname)}${normalizedSearch}${normalizedHash}`;
};

export const replaceRouteResponderQueryParam = (
  pathname: string | null | undefined,
  responder: unknown,
  search = ''
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
