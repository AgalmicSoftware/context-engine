import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import {
  parseSessionWorkerDiscoveryOrigin,
  resolveWorkerCanonicalSessionIdHex,
} from '../../utilities/session/sessionWorkerDiscovery';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
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

export const buildWorkerGroupAutoJoinPath = (sessionSlug: string, groupId: string, workerUrl?: string): string => {
  const slug = canonicalizeSessionSlug(sessionSlug);
  const id = normalizeGroupId(groupId);
  if (!slug || !id) throw new Error('A session and group are required.');
  const params = new URLSearchParams({ joinGroup: id });
  // Fresh browsers need the same public discovery hint as session publish links.
  if (workerUrl) params.set('worker', parseSessionWorkerDiscoveryOrigin(workerUrl));
  return `${buildPublicRoute(`/session/${encodeURIComponent(slug)}`)}?${params}`;
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

export const resolveWorkerGroupAutoJoinContext = (sessionConfig: unknown, sessionSlug: string) => {
  const config = (sessionConfig || {}) as Record<string, unknown>;
  const slug = canonicalizeSessionSlug(sessionSlug);
  const projection = resolveSessionCapabilityProjection(config);
  const sessionId = resolveWorkerCanonicalSessionIdHex(config);
  const workerUrl = getUsableSessionWorkerUrl({ slug, sessionConfig, requireExactWorkerSession: true });
  if (
    !slug ||
    canonicalizeSessionSlug(config.slug) !== slug ||
    !sessionId ||
    !workerUrl ||
    projection.source !== 'profile' ||
    !projection.profileValid ||
    !projection.isWorkerCanonical
  )
    return null;
  return { sessionSlug: slug, sessionId, workerUrl, chainId: projection.hasOnChainComponent ? projection.chainId : 1 };
};

export const finishWorkerGroupAutoJoin = (sessionSlug: string, groupId: string, sessionId?: string) => {
  // Only consume the intent we handled; preserve other query parameters and
  // a newer link if navigation happened while a request was in flight.
  const url = new URL(window.location.href);
  if (readWorkerGroupAutoJoinId(url.search) === groupId) {
    url.searchParams.delete('joinGroup');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  if (sessionId) dispatchWorkerGroupsChanged({ sessionSlug, sessionId });
};
