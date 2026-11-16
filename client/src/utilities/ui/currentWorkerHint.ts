/** @file currentWorkerHint.ts: the `worker` an unlisted session's page was opened with, kept on its links. */
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
