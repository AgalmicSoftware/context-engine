import { toStr } from '../shared/primitives.js';

type ProcWithEnv = { env?: Record<string, unknown> } | undefined;

// We currently deploy from the site root, but keep PUBLIC_URL/base-path support
// so the SPA can still be mounted under a subpath in preview or alternate hosting
// setups without rewriting every internal route helper.
export const readPublicUrlBasePath = (
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv,
): string => {
  const raw = toStr(proc?.env?.PUBLIC_URL || '').trim();
  if (!raw) return '';
  try {
    return toStr(new URL(raw).pathname || '')
      .trim()
      .replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

export const buildPublicUrlPath = (
  pathname = '',
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv,
): string => {
  const normalizedPath = toStr(pathname).trim();
  if (!normalizedPath) return '';
  const basePath = readPublicUrlBasePath(proc);
  return `${basePath}${normalizedPath}` || normalizedPath;
};

export const stripPublicUrlBasePath = (
  pathname = '',
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv,
): string => {
  const rawPath = toStr(pathname).trim();
  const basePath = readPublicUrlBasePath(proc);
  if (!rawPath || !basePath || basePath === '/') return rawPath;
  const match = rawPath.match(/^([^?#]*)([?#].*)?$/);
  const routePath = match?.[1] || '';
  const suffix = match?.[2] || '';
  if (routePath === basePath || routePath === `${basePath}/`) {
    return `/${suffix}`;
  }
  if (routePath.startsWith(`${basePath}/`)) {
    return `${routePath.slice(basePath.length) || '/'}${suffix}`;
  }
  return rawPath;
};

export const buildPublicRoute = (
  pathname = '',
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv,
): string => {
  const normalizedPath = toStr(pathname).trim();
  if (!normalizedPath) return readPublicUrlBasePath(proc) || '/';
  return buildPublicUrlPath(normalizedPath, proc) || normalizedPath;
};

type AtlasNodeRouteOptions = {
  demo?: boolean;
  returnTo?: string | null;
};

type WindowLike =
  | {
      location?: {
        hash?: unknown;
        origin?: unknown;
        pathname?: unknown;
        search?: unknown;
      };
    }
  | undefined;

export const readWindowLocationPath = (
  win: WindowLike = (typeof window !== 'undefined' ? window : undefined) as WindowLike,
): string => {
  const pathname = toStr(win?.location?.pathname || '').trim();
  const search = toStr(win?.location?.search || '').trim();
  const hash = toStr(win?.location?.hash || '').trim();
  return `${pathname}${search}${hash}`;
};

export const buildAtlasNodeRoute = (
  nodeId = '',
  options: AtlasNodeRouteOptions = {},
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv,
): string => {
  const normalizedNodeId = toStr(nodeId).trim();
  const baseRoute = buildPublicRoute(normalizedNodeId ? `/atlas/${normalizedNodeId}` : '/atlas', proc);
  const params = new URLSearchParams();

  if (options.demo) {
    params.set('demo', '1');
  }

  const returnTo = toStr(options.returnTo || '').trim();
  if (returnTo) {
    params.set('returnTo', returnTo);
  }

  const search = params.toString();
  return search ? `${baseRoute}?${search}` : baseRoute;
};

export const readSafeInternalReturnTo = (
  returnTo = '',
  win: WindowLike = (typeof window !== 'undefined' ? window : undefined) as WindowLike,
): string => {
  const normalizedReturnTo = toStr(returnTo).trim();
  const origin = toStr(win?.location?.origin || '').trim();
  if (!normalizedReturnTo || !origin) return '';

  try {
    const parsed = new URL(normalizedReturnTo, origin);
    if (parsed.origin !== origin) return '';
    const nextPath = `${toStr(parsed.pathname || '').trim()}${toStr(parsed.search || '').trim()}${toStr(parsed.hash || '').trim()}`;
    if (!nextPath.startsWith('/') || nextPath.startsWith('//')) return '';
    return nextPath;
  } catch {
    return '';
  }
};
