/** @file currentWorkerHint.ts: the `worker` an unlisted session's page was opened with, kept on its links. */
import { normalizeSessionSlug, resolveSessionSlugFromPathname } from '../session/sessionNaming.js';
import { parseSessionWorkerDiscoveryQuery } from '../session/sessionWorkerDiscovery';

/** The page's own `worker`, checked as discovery checks it; '' when there is none or it is not valid. */
export const readCurrentWorkerHint = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    return parseSessionWorkerDiscoveryQuery(window.location.search || '');
  } catch {
    return '';
  }
};

/** A same-site path that keeps the page's `worker`, without which an unlisted session is not found. */
export const withCurrentWorkerHint = (path: string): string => {
  const worker = readCurrentWorkerHint();
  if (!worker) return path;
  const hashAt = path.indexOf('#');
  const beforeHash = hashAt < 0 ? path : path.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : path.slice(hashAt);
  const queryAt = beforeHash.indexOf('?');
  const pathname = queryAt < 0 ? beforeHash : beforeHash.slice(0, queryAt);
  const params = new URLSearchParams(queryAt < 0 ? '' : beforeHash.slice(queryAt + 1));
  if (!params.has('worker')) params.set('worker', worker);
  return `${pathname}?${params.toString()}${hash}`;
};

/**
 * As `withCurrentWorkerHint`, for a link built off the session's own page: the page's `worker` goes
 * along only when the page is showing `sessionSlug`, since a Worker answers for one session.
 */
export const withWorkerHintForSession = (path: string, sessionSlug: unknown): string => {
  if (typeof window === 'undefined') return path;
  const { pathname, search } = window.location;
  const query = new URLSearchParams(search || '');
  // The names a page's address gives its session: a profile or comparison link, a groups link, a docs link.
  const named = query.get('session') ?? query.get('sessionSlug') ?? query.get('s');
  const pageSession = normalizeSessionSlug(named || resolveSessionSlugFromPathname(pathname) || '');
  return pageSession && pageSession === normalizeSessionSlug(sessionSlug) ? withCurrentWorkerHint(path) : path;
};
