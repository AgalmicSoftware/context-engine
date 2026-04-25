import { toStr } from '../shared/primitives.js';

type ProcWithEnv = { env?: Record<string, unknown> } | undefined;

// We currently deploy from the site root, but keep PUBLIC_URL/base-path support
// so the SPA can still be mounted under a subpath in preview or alternate hosting
// setups without rewriting every internal route helper.
export const readPublicUrlBasePath = (
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv
): string => {
  const raw = toStr(proc?.env?.PUBLIC_URL || '').trim();
  if (!raw) return '';
  try {
    return toStr(new URL(raw).pathname || '').trim().replace(/\/+$/, '');
  } catch {
    return raw.replace(/\/+$/, '');
  }
};

export const buildPublicUrlPath = (
  pathname = '',
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv
): string => {
  const normalizedPath = toStr(pathname).trim();
  if (!normalizedPath) return '';
  const basePath = readPublicUrlBasePath(proc);
  return `${basePath}${normalizedPath}` || normalizedPath;
};

export const buildPublicRoute = (
  pathname = '',
  proc: ProcWithEnv = (typeof process !== 'undefined' ? process : undefined) as ProcWithEnv
): string => {
  const normalizedPath = toStr(pathname).trim();
  if (!normalizedPath) return readPublicUrlBasePath(proc) || '/';
  return buildPublicUrlPath(normalizedPath, proc) || normalizedPath;
};
