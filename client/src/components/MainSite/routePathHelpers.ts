/**
 * @module routePathHelpers
 * @description Pure route path normalization and matching helpers.
 *
 * Key exports: normalizeRoutePath, isGeneralRoutePath, getEffectiveRoutePath, isOnOrWithinRoutePath
 */
import { stripConfiguredPublicBasePath } from './urlUtils.js';

export const normalizeRoutePath = (pathIn = ''): string => {
  const raw = stripConfiguredPublicBasePath(
    String(pathIn || '')
      .trim()
      .split('?')[0]
      .split('#')[0],
  );
  if (/^\/demo\/dacc\/?$/i.test(raw)) return '/about';
  const legacyDemoNormalized = /^\/demo(?:\/|$)/i.test(raw) ? raw.replace(/^\/demo(?=\/|$)/i, '/session/demo') : raw;
  if (!legacyDemoNormalized) return '';
  if (legacyDemoNormalized === '/') return '/';
  return legacyDemoNormalized.replace(/\/+$/, '');
};

export const isGeneralRoutePath = (pathIn = ''): boolean => {
  const path = normalizeRoutePath(pathIn);
  return path === '/' || path === '/session' || path === '/session/general';
};

export const getEffectiveRoutePath = (
  pathIn = '',
  {
    windowPathIn = '',
    redirectPathIn = '',
  }: {
    windowPathIn?: string;
    redirectPathIn?: string;
  } = {},
): string => {
  const propPath = String(pathIn || '').trim();
  const windowPath = String(windowPathIn || '').trim();
  const normalizedPropPath = normalizeRoutePath(propPath);
  const normalizedWindowPath = normalizeRoutePath(windowPath);
  const redirectPath = normalizeRoutePath(redirectPathIn);
  if (redirectPath && isGeneralRoutePath(propPath || windowPath) && normalizedWindowPath === redirectPath) {
    return redirectPathIn;
  }
  return normalizedPropPath || normalizedWindowPath || '';
};

export const isOnOrWithinRoutePath = (pathIn = '', routePathIn = ''): boolean => {
  const path = normalizeRoutePath(pathIn);
  const routePath = normalizeRoutePath(routePathIn);
  if (!path || !routePath) return false;
  return path === routePath || path.startsWith(`${routePath}/`);
};
