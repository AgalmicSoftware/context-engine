import { canonicalizeSessionSlug } from '../../utilities/session/canonicalSessionContext';
import {
  fetchWorkerCanonicalSessionBootstrap,
  parseSessionWorkerDiscoveryOrigin,
} from '../../utilities/session/sessionWorkerDiscovery';
import { buildPublicRoute } from '../../utilities/ui/publicUrl';
import { readWorkerGroupAutoJoinId } from './workerGroupAutoJoin';
import type { resolveWorkerGroupAutoJoinContext } from './workerGroupAutoJoinContext';

export const AUTO_JOIN_STORAGE_KEY = 'ce:worker-group-auto-join:v1';
export const AUTO_JOIN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export type WorkerGroupAutoJoinIntent = {
  version: 1;
  sessionSlug: string;
  groupId: string;
  workerOrigin: string;
  sessionId?: string;
  createdAt: number;
  /** The group password or one-use claim code the link carried in its fragment; it stays in this tab. */
  token?: string;
};

// A link's secret rides in `#groupInvite=`, which browsers never send to a server.
const INVITE_FRAGMENT = 'groupInvite=';
const MAX_TOKEN_LENGTH = 2000;
const fragmentSegments = (hash: string) => hash.replace(/^#/, '').split('&');

/** The fragment's group invite token, '' without one. */
export const readGroupInviteFragment = (hash: string): string => {
  const segment = fragmentSegments(hash).find((part) => part.startsWith(INVITE_FRAGMENT));
  if (!segment) return '';
  try {
    const token = decodeURIComponent(segment.slice(INVITE_FRAGMENT.length)).trim();
    return token.length <= MAX_TOKEN_LENGTH ? token : '';
  } catch {
    return '';
  }
};

/** Takes the invite out of the address at once, leaving the rest of the fragment as it was. */
export const removeGroupInviteFromAddress = () => {
  const { hash } = window.location;
  if (!fragmentSegments(hash).some((part) => part.startsWith(INVITE_FRAGMENT))) return;
  const rest = fragmentSegments(hash).filter((part) => part && !part.startsWith(INVITE_FRAGMENT));
  const { pathname, search } = window.location;
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${search}${rest.length ? `#${rest.join('&')}` : ''}`,
  );
};
type Context = ReturnType<typeof resolveWorkerGroupAutoJoinContext>;

export const autoJoinIntentKey = (intent: WorkerGroupAutoJoinIntent) =>
  `${intent.workerOrigin}:${intent.sessionSlug}:${intent.groupId}:${intent.createdAt}`;

export const readPendingAutoJoin = (): WorkerGroupAutoJoinIntent | null => {
  try {
    const value = JSON.parse(sessionStorage.getItem(AUTO_JOIN_STORAGE_KEY) || 'null');
    if (
      !value ||
      value.version !== 1 ||
      typeof value.sessionSlug !== 'string' ||
      !value.sessionSlug ||
      canonicalizeSessionSlug(value.sessionSlug) !== value.sessionSlug ||
      typeof value.groupId !== 'string' ||
      !value.groupId ||
      readWorkerGroupAutoJoinId(`?joinGroup=${encodeURIComponent(value.groupId)}`) !== value.groupId ||
      parseSessionWorkerDiscoveryOrigin(value.workerOrigin) !== value.workerOrigin ||
      (value.sessionId !== undefined && !/^0x[0-9a-f]{32}$/i.test(value.sessionId)) ||
      (value.token !== undefined && (typeof value.token !== 'string' || value.token.length > MAX_TOKEN_LENGTH)) ||
      !Number.isFinite(value.createdAt) ||
      value.createdAt > Date.now() ||
      Date.now() - value.createdAt >= AUTO_JOIN_MAX_AGE_MS
    ) {
      sessionStorage.removeItem(AUTO_JOIN_STORAGE_KEY);
      return null;
    }
    // Persist only the destination and the link's own invite, never credentials or a cached config.
    return {
      version: 1,
      sessionSlug: value.sessionSlug,
      groupId: value.groupId,
      workerOrigin: value.workerOrigin,
      sessionId: value.sessionId,
      createdAt: value.createdAt,
      ...(value.token ? { token: value.token } : {}),
    };
  } catch {
    return null;
  }
};

export const savePendingAutoJoin = (intent: WorkerGroupAutoJoinIntent) => {
  try {
    sessionStorage.setItem(AUTO_JOIN_STORAGE_KEY, JSON.stringify(intent));
  } catch {
    /* In-memory joining still works. */
  }
};

export const clearPendingAutoJoin = (intent: WorkerGroupAutoJoinIntent) => {
  const stored = readPendingAutoJoin();
  if (stored && autoJoinIntentKey(stored) === autoJoinIntentKey(intent)) {
    try {
      sessionStorage.removeItem(AUTO_JOIN_STORAGE_KEY);
    } catch {
      /* Storage can be disabled. */
    }
  }
};

export const readAutoJoinLink = (path: string, context: Context): WorkerGroupAutoJoinIntent | null => {
  try {
    const url = new URL(path, 'https://session.invalid');
    const prefix = buildPublicRoute('/session/');
    if (!url.pathname.startsWith(prefix)) return null;
    const rawSlug = decodeURIComponent(url.pathname.slice(prefix.length).replace(/\/$/, ''));
    const sessionSlug = canonicalizeSessionSlug(rawSlug);
    const groupId = readWorkerGroupAutoJoinId(url.search);
    if (!sessionSlug || sessionSlug !== rawSlug || rawSlug.includes('/') || !groupId) return null;
    const workers = url.searchParams.getAll('worker');
    if (workers.length > 1) return null;
    const matchingContext = context?.sessionSlug === sessionSlug ? context : null;
    const workerOrigin = parseSessionWorkerDiscoveryOrigin(workers.length ? workers[0] : matchingContext?.workerUrl);
    const sessionId =
      matchingContext && parseSessionWorkerDiscoveryOrigin(matchingContext.workerUrl) === workerOrigin
        ? matchingContext.sessionId
        : undefined;
    const token = readGroupInviteFragment(url.hash);
    return {
      version: 1,
      sessionSlug,
      groupId,
      workerOrigin,
      sessionId,
      createdAt: Date.now(),
      ...(token ? { token } : {}),
    };
  } catch {
    return null;
  }
};

export const loadAutoJoinSessionConfig = async (intent: WorkerGroupAutoJoinIntent, signal: AbortSignal) => {
  const bootstrap = await fetchWorkerCanonicalSessionBootstrap({
    sessionSlug: intent.sessionSlug,
    workerQueryValue: intent.workerOrigin,
    signal,
  });
  if (intent.sessionId && bootstrap.sessionId.toLowerCase() !== intent.sessionId.toLowerCase())
    throw new Error('The session identity has changed. Ask the host for a new invitation.');
  return bootstrap.config;
};
