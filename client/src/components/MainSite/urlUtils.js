/**
 * @module components/MainSite/urlUtils
 */

import { isRouteResponderAddress } from './mainSiteUtils.js';

export const getConfiguredPublicBasePath = () => {
  const raw = String(
    (typeof process !== 'undefined' && process?.env ? process.env.PUBLIC_URL : '') || ''
  ).trim();
  if (!raw) return '';
  try {
    return String(new URL(raw).pathname || '').trim().replace(/\/+$/, '');
  } catch (_) {
    return raw.replace(/\/+$/, '');
  }
};

export const buildPublicRoute = (pathname = '') => {
  const normalizedPath = String(pathname || '').trim();
  if (!normalizedPath) return getConfiguredPublicBasePath() || '/';
  const basePath = getConfiguredPublicBasePath();
  return `${basePath}${normalizedPath}` || normalizedPath;
};

export const stripConfiguredPublicBasePath = (pathname = '') => {
  const rawPath = String(pathname || '').trim();
  const basePath = getConfiguredPublicBasePath();
  if (!rawPath || !basePath || basePath === '/') return rawPath;
  if (rawPath === basePath || rawPath === `${basePath}/`) return '/';
  if (rawPath.startsWith(`${basePath}/`)) {
    return rawPath.slice(basePath.length) || '/';
  }
  return rawPath;
};

export const buildPublicUrl = (pathname = '', search = '', hash = '') => {
  const normalizedSearch = search
    ? (String(search).startsWith('?') ? String(search) : `?${search}`)
    : '';
  const normalizedHash = hash
    ? (String(hash).startsWith('#') ? String(hash) : `#${hash}`)
    : '';
  return `${buildPublicRoute(pathname)}${normalizedSearch}${normalizedHash}`;
};

export const replaceRouteResponderQueryParam = (pathname, responder, search = '') => {
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
