import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { parseSessionWorkerDiscoveryOrigin } from '../../utilities/session/sessionWorkerDiscovery';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';
import { dispatchWorkerGroupsChanged } from '../../utilities/worker/workerGroupChangeEvents';
import type { WorkerGroup } from './workerGroupPorts';

const normalizeGroupId = (value: string): string => {
  const normalized = value.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._-]{0,79}$/.test(normalized) ? normalized : '';
};

export const readWorkerGroupAutoJoinId = (search: string): string => {
  const values = new URLSearchParams(search).getAll('joinGroup');
  return values.length === 1 ? normalizeGroupId(values[0]) : '';
};

const copyableAutoJoinParams = new Set(['src', 'mode']);

const readValidatedWorkerHint = (searchParams: URLSearchParams): string => {
  const values = searchParams.getAll('worker');
  if (values.length !== 1) return '';
  try {
    return parseSessionWorkerDiscoveryOrigin(values[0]);
  } catch {
    return '';
  }
};

const buildAutoJoinBaseUrl = (slug: string, basePath?: string): { url: URL; workerHint: string } => {
  const fallbackPath = buildPublicRoute(`/session/${encodeURIComponent(slug)}`);
  if (!basePath) return { url: new URL(fallbackPath, 'https://session.invalid'), workerHint: '' };
  try {
    const candidate = new URL(basePath, 'https://session.invalid');
    if (candidate.pathname.replace(/\/$/, '') !== fallbackPath) {
      return { url: new URL(fallbackPath, 'https://session.invalid'), workerHint: '' };
    }
    const url = new URL(fallbackPath, 'https://session.invalid');
    candidate.searchParams.forEach((value, key) => {
      if (copyableAutoJoinParams.has(key)) url.searchParams.append(key, value);
    });
    return { url, workerHint: readValidatedWorkerHint(candidate.searchParams) };
  } catch {
    return { url: new URL(fallbackPath, 'https://session.invalid'), workerHint: '' };
  }
};

export const buildWorkerGroupAutoJoinPath = (
  sessionSlug: string,
  groupId: string,
  workerUrl?: string,
  basePath?: string,
): string => {
  const slug = canonicalizeSessionSlug(sessionSlug);
  const id = normalizeGroupId(groupId);
  if (!slug || !id) throw new Error('A session and group are required.');
  const { url, workerHint } = buildAutoJoinBaseUrl(slug, basePath);
  url.searchParams.set('joinGroup', id);
  // Fresh browsers need the same public discovery hint as session publish links.
  const resolvedWorkerHint = workerUrl ? parseSessionWorkerDiscoveryOrigin(workerUrl) : workerHint;
  if (resolvedWorkerHint) url.searchParams.set('worker', resolvedWorkerHint);
  return `${url.pathname}${url.search}${url.hash}`;
};

export const removeWorkerGroupAutoJoinQuery = (path: string): string => {
  if (!path) return '';
  const url = new URL(path, 'https://session.invalid');
  url.searchParams.delete('joinGroup');
  return `${url.pathname}${url.search}${url.hash}`;
};

export const canAutoJoinWorkerGroup = (group: WorkerGroup): boolean =>
  group.joinMode === 'open' &&
  group.memberVisibility === 'session' &&
  (!group.joinEndsAt || Date.parse(group.joinEndsAt) > Date.now());

export const finishWorkerGroupAutoJoin = (sessionSlug: string, groupId: string, sessionId?: string) => {
  // Only consume the intent we handled; preserve other query parameters and
  // a newer link if navigation happened while a request was in flight.
  const url = new URL(window.location.href);
  if (
    url.pathname.replace(/\/$/, '') === buildPublicRoute(`/session/${encodeURIComponent(sessionSlug)}`) &&
    readWorkerGroupAutoJoinId(url.search) === groupId
  ) {
    url.searchParams.delete('joinGroup');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  if (sessionId) dispatchWorkerGroupsChanged({ sessionSlug, sessionId });
};
