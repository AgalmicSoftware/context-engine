import { getDemoSessionConfigBySlug, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { canonicalizeSessionSlug as normalizeSessionSlug } from '../../utilities/session/sessionSlug.js';
import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import { sessionModeAllowsAnonymousWorkerGroupDiscovery } from '../../utilities/session/sessionModeProfile';
import {
  normalizeWorkerCanonicalSessionIdHex,
  parseSessionWorkerDiscoveryOrigin,
  resolveWorkerCanonicalSessionIdHex,
} from '../../utilities/session/sessionWorkerDiscovery';
import {
  getWorkerCanonicalSessionBootstrap,
  readSessionWorkerConfigCache,
} from '../../utilities/session/sessionWorkerConfigCache';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import {
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
  type WorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import {
  isWorkerGroupJoinable,
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { getWorkerSessionToken, isWorkerSignInNeededError } from '../../utilities/worker/workerAuth';
import type { WorkerGroupsChangedDetail } from '../../utilities/worker/workerGroupChangeEvents';

/** One of the groups a count counted, as the Stats Groups dialog lists it. */
export type CommunityWorkerGroupSummary = { groupId: string; label: string; open: boolean };

export type CommunityWorkerGroupCountCacheEntry = {
  count: number;
  groupIds: string[];
  visibleUserIds: string[];
  groups: CommunityWorkerGroupSummary[];
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  updatedAtMs: number;
  promise?: Promise<void>;
  // While a settled count is read again, what it settled as: the tile keeps showing that, not a spinner.
  settledStatus?: 'ready' | 'error' | 'unavailable';
};

type CommunityWorkerScope = {
  slug: string;
  isWorkerCanonical: boolean;
  sessionConfig: Record<string, unknown>;
  workerCanonicalIdentity: WorkerCanonicalCacheIdentity | null;
};

type CommunityWorkerGroupRuntime = {
  account?: unknown;
  provider?: unknown;
  networkChainId?: unknown;
  network?: { chainId?: unknown; id?: unknown } | null;
};

const WORKER_GROUP_COUNT_TTL_MS = 30000;
// Short: the other tiles show their own numbers without the groups, whose tile keeps its spinner until they settle.
export const WORKER_GROUP_COUNT_WAIT_MS = 250;
// A count with no answer by then is shown as unread, so one slow or dead Worker does not hold the Groups tile.
export const WORKER_GROUP_COUNT_TIMEOUT_MS = 15000;

// What a read with no new answer keeps from the last one.
const heldGroupCount = (existing?: CommunityWorkerGroupCountCacheEntry) => ({
  count: existing?.count || 0,
  groupIds: existing?.groupIds || [],
  visibleUserIds: existing?.visibleUserIds || [],
  groups: existing?.groups || [],
});

/**
 * Live group counts are optional: a load can wait on a Worker sign-in that is
 * never answered. Wait briefly so cached Stats can publish, and call
 * `onSettledLate` once slower loads finish.
 */
export const awaitWorkerGroupCountsBriefly = async (
  loads: Promise<unknown>,
  onSettledLate: () => void,
): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<'late'>((resolve) => {
    timer = setTimeout(() => resolve('late'), WORKER_GROUP_COUNT_WAIT_MS);
  });
  try {
    if ((await Promise.race([loads, late])) === 'late') {
      void loads.finally(onSettledLate).catch(() => undefined);
    }
  } finally {
    clearTimeout(timer);
  }
};

export const isDisplayableWorkerUserId = (value: unknown): boolean =>
  /^0x[0-9a-f]{40}$/i.test(String(value || '').trim());

export const resolveCommunityScopeAuthority = ({
  slugIn,
  propSessionConfig,
  resolveNetKeyForSlug,
}: {
  slugIn: unknown;
  propSessionConfig?: unknown;
  resolveNetKeyForSlug: (slug: string) => string;
}) => {
  const slug = normalizeSessionSlug(slugIn || '');
  const exactCandidate = (candidate: unknown) => {
    if (!candidate || typeof candidate !== 'object') return null;
    const config = candidate as Record<string, unknown>;
    const candidateSlug = normalizeSessionSlug(config.slug || config.sessionSlug || '');
    return candidateSlug === slug ? config : null;
  };
  let sessionConfig =
    exactCandidate(propSessionConfig) ||
    exactCandidate(getSessionConfigBySlug(slug)) ||
    exactCandidate(getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })) ||
    {};
  const records = Object.values(readSessionWorkerConfigCache().bySession).filter(
    (record) => record.authorityMode === 'worker_canonical' && normalizeSessionSlug(record.slug) === slug,
  );
  const hasDeclaredConfig = Object.keys(sessionConfig).length > 0;
  const claimsWorker = claimsWorkerCanonicalAuthority(sessionConfig);
  if (claimsWorker || !hasDeclaredConfig) {
    const origin = (value: unknown) => {
      try {
        return parseSessionWorkerDiscoveryOrigin(value) || '';
      } catch (_) {
        return '';
      }
    };
    const declaredOrigin = origin(sessionConfig.corsWorkerUrl);
    const expectedOrigin =
      declaredOrigin || (!hasDeclaredConfig && records.length === 1 ? origin(records[0].workerOrigin) : '');
    const matches = expectedOrigin ? records.filter((record) => origin(record.workerOrigin) === expectedOrigin) : [];
    if (matches.length === 1) {
      const record = matches[0];
      const cached = exactCandidate(getWorkerCanonicalSessionBootstrap({ slug, workerOrigin: expectedOrigin }));
      const cachedProjection = resolveSessionCapabilityProjection(cached);
      const declaredId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
      const hasDeclaredId = !!(sessionConfig.sessionId || sessionConfig.sessionIdHex);
      try {
        const identity = resolveWorkerCanonicalCacheIdentity({ sessionConfig: cached, sessionSlug: slug });
        // Cache metadata is not authority on its own: the canonical config must
        // agree with its record and any configured Worker origin/session ID.
        if (
          cached &&
          cachedProjection.profileValid &&
          cachedProjection.isWorkerCanonical &&
          identity.workerOrigin === expectedOrigin &&
          identity.sessionSlug === slug &&
          identity.sessionId === normalizeWorkerCanonicalSessionIdHex(record.sessionIdHex) &&
          (!hasDeclaredId || (!!declaredId && identity.sessionId === declaredId))
        ) {
          sessionConfig = cached;
        }
      } catch (_) {}
    }
  }
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  // Partial Worker hints and ambiguous cached-only routes must never fall back
  // to numeric or single-node caches while their canonical identity is unknown.
  const isWorkerCanonical = claimsWorkerCanonicalAuthority(sessionConfig) || (!hasDeclaredConfig && records.length > 0);
  let workerCanonicalIdentity: WorkerCanonicalCacheIdentity | null = null;
  if (isWorkerCanonical && projection.profileValid && projection.isWorkerCanonical) {
    try {
      workerCanonicalIdentity = resolveWorkerCanonicalCacheIdentity({ sessionConfig, sessionSlug: slug });
    } catch (_) {
      workerCanonicalIdentity = null;
    }
  }
  return {
    cacheScope: isWorkerCanonical ? WORKER_CANONICAL_CACHE_SCOPE_KEY : resolveNetKeyForSlug(slug),
    isWorkerCanonical,
    sessionConfig,
    workerCanonicalIdentity,
  };
};

export const pickCommunityWorkerCanonicalCache = (
  cacheObj: unknown,
  identity: WorkerCanonicalCacheIdentity | null,
): Record<string, unknown> => {
  if (!identity || !cacheObj || typeof cacheObj !== 'object') return {};
  const cacheNode = (cacheObj as Record<string, unknown>)[WORKER_CANONICAL_CACHE_SCOPE_KEY];
  return workerCanonicalCacheIdentityMatches(cacheNode, identity) ? (cacheNode as Record<string, unknown>) : {};
};

export const getCommunityWorkerGroupCountCacheKey = (
  identity: WorkerCanonicalCacheIdentity,
  account: unknown,
): string =>
  `${identity.key}\n${
    String(account || '')
      .trim()
      .toLowerCase() || 'anonymous'
  }`;

export const getCommunityWorkerGroupCountState = (
  identity: WorkerCanonicalCacheIdentity | null,
  account: unknown,
  cache: Map<string, CommunityWorkerGroupCountCacheEntry>,
) => {
  const cached = identity ? cache.get(getCommunityWorkerGroupCountCacheKey(identity, account)) : null;
  return {
    workerGroupIds: Array.isArray(cached?.groupIds) ? cached.groupIds : [],
    workerGroups: Array.isArray(cached?.groups) ? cached.groups : [],
    workerVisibleUserIds: Array.isArray(cached?.visibleUserIds) ? cached.visibleUserIds : [],
    workerGroupsCount: Number(cached?.count || 0),
    workerGroupsStatus: String((cached?.status === 'loading' && cached.settledStatus) || cached?.status || 'idle'),
  };
};

export const invalidateCommunityWorkerGroupCountCache = ({
  detail,
  cache,
  revisions,
}: {
  detail: WorkerGroupsChangedDetail;
  cache: Map<string, CommunityWorkerGroupCountCacheEntry>;
  revisions: Map<string, number>;
}): void => {
  cache.forEach((_entry, cacheKey) => {
    const identityKeyEnd = cacheKey.indexOf('\n');
    if (identityKeyEnd < 0) return;
    try {
      const identityParts = JSON.parse(cacheKey.slice(0, identityKeyEnd));
      if (
        !Array.isArray(identityParts) ||
        identityParts[1] !== detail.sessionSlug ||
        String(identityParts[2] || '').toLowerCase() !== detail.sessionId
      ) {
        return;
      }
      // Invalidate the TTL entry before forcing Stats. The revision also stops
      // an older in-flight read from restoring stale data.
      revisions.set(cacheKey, Number(revisions.get(cacheKey) || 0) + 1);
      cache.delete(cacheKey);
    } catch (_) {}
  });
};

export const loadCommunityWorkerGroupCount = async ({
  scopeEntry,
  runtime,
  cache,
  revisions,
  onWarning,
  onLateSettle,
}: {
  scopeEntry: CommunityWorkerScope;
  runtime: CommunityWorkerGroupRuntime;
  cache: Map<string, CommunityWorkerGroupCountCacheEntry>;
  revisions: Map<string, number>;
  onWarning?: (message: string, error: unknown) => void;
  // Called when a count that ran past the time limit settles after all.
  onLateSettle?: () => void;
}): Promise<void> => {
  if (!scopeEntry.isWorkerCanonical || !scopeEntry.workerCanonicalIdentity) return;
  const identity = scopeEntry.workerCanonicalIdentity;
  // Keep anonymous and account-authorized projections isolated across sign-in.
  const countCacheKey = getCommunityWorkerGroupCountCacheKey(identity, runtime.account);
  const requestRevision = Number(revisions.get(countCacheKey) || 0);
  const requestIsCurrent = () => Number(revisions.get(countCacheKey) || 0) === requestRevision;
  const existing = cache.get(countCacheKey);
  // Still loading from an earlier Stats cycle, which refreshes Stats when it settles
  // (awaitWorkerGroupCountsBriefly): later cycles show the current counts instead of waiting again.
  if (existing?.promise) return;
  if (existing && Date.now() - existing.updatedAtMs < WORKER_GROUP_COUNT_TTL_MS) return;

  const { sessionConfig, slug } = scopeEntry;
  const account = String(runtime.account || '').trim();
  if (!account && !sessionModeAllowsAnonymousWorkerGroupDiscovery(sessionConfig.sessionModeProfile)) {
    cache.set(countCacheKey, {
      ...heldGroupCount(existing),
      status: 'unavailable',
      updatedAtMs: Date.now(),
    });
    return;
  }
  const workerUrl = getUsableSessionWorkerUrl({ slug, sessionConfig, requireExactWorkerSession: true });
  const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
  if (!workerUrl || !sessionId) {
    cache.set(countCacheKey, {
      ...heldGroupCount(existing),
      status: 'error',
      updatedAtMs: Date.now(),
    });
    return;
  }

  const request = (async () => {
    try {
      let groups: WorkerGroup[];
      let overviewMemberships: WorkerGroupOverview['memberships'] = [];
      let credentialToken = '';
      if (account) {
        const projection = resolveSessionCapabilityProjection(sessionConfig);
        // A viewer's own groups count only through a sign-in that asks them for nothing.
        credentialToken = await getWorkerSessionToken({
          sessionSlug: slug,
          sessionConfig,
          workerUrl,
          context: {
            account,
            providerLike: runtime.provider,
            chainId:
              runtime.networkChainId || runtime.network?.chainId || runtime.network?.id || projection.chainId || 1,
          },
          prompt: false,
        }).catch((error: unknown) => {
          if (isWorkerSignInNeededError(error)) return '';
          throw error;
        });
      }
      if (credentialToken) {
        const overview = await loadWorkerGroupOverview({ workerUrl, credentialToken, sessionId, sessionSlug: slug });
        overviewMemberships = overview.memberships || [];
        groups = [...(overview.groups || []), ...(overview.memberships || []).map((membership) => membership.group)];
      } else if (sessionModeAllowsAnonymousWorkerGroupDiscovery(sessionConfig.sessionModeProfile)) {
        groups = await loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug: slug });
      } else {
        // A private session counts nothing for a viewer not signed in to it, as for a signed-out one.
        if (requestIsCurrent())
          cache.set(countCacheKey, {
            ...heldGroupCount(existing),
            status: 'unavailable',
            updatedAtMs: Date.now(),
          });
        return;
      }
      const summaries = new Map<string, CommunityWorkerGroupSummary>();
      groups.forEach((group) => {
        const groupId = String(group?.groupId || '').trim();
        if (!groupId || summaries.has(groupId)) return;
        summaries.set(groupId, {
          groupId,
          label: String(group.label || '').trim(),
          open: isWorkerGroupJoinable(group),
        });
      });
      const groupIds = [...summaries.keys()];
      const visibleUserIds = new Set<string>();
      groups.forEach((group) => {
        const adminAddress = String(group?.adminAddress || '')
          .trim()
          .toLowerCase();
        if (isDisplayableWorkerUserId(adminAddress)) visibleUserIds.add(adminAddress);
      });
      // Count only identities already visible to this viewer; aggregate member
      // counts must not become guesses or trigger hidden-list fetches.
      overviewMemberships.forEach((membership) => {
        const principal = membership?.member?.principal;
        const principalAddress =
          principal && 'address' in principal
            ? String(principal.address || '')
                .trim()
                .toLowerCase()
            : '';
        if (isDisplayableWorkerUserId(principalAddress)) visibleUserIds.add(principalAddress);
      });
      if (overviewMemberships.length > 0 && isDisplayableWorkerUserId(account)) {
        visibleUserIds.add(account.toLowerCase());
      }
      if (!requestIsCurrent()) return;
      cache.set(countCacheKey, {
        count: groupIds.length,
        groupIds,
        visibleUserIds: Array.from(visibleUserIds),
        groups: [...summaries.values()],
        status: 'ready',
        updatedAtMs: Date.now(),
      });
    } catch (error) {
      if (!requestIsCurrent()) return;
      onWarning?.(`CommunityTab: Worker group count unavailable for ${slug}`, error);
      cache.set(countCacheKey, {
        ...heldGroupCount(existing),
        status: 'error',
        updatedAtMs: Date.now(),
      });
    }
  })();
  cache.set(countCacheKey, {
    ...heldGroupCount(existing),
    status: 'loading',
    settledStatus:
      existing?.status === 'loading'
        ? existing.settledStatus
        : existing?.status === 'idle'
          ? undefined
          : existing?.status,
    updatedAtMs: existing?.updatedAtMs || 0,
    promise: request,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      // An answer that comes later still replaces this.
      if (requestIsCurrent() && cache.get(countCacheKey)?.promise === request) {
        cache.set(countCacheKey, {
          ...heldGroupCount(existing),
          status: 'error',
          updatedAtMs: Date.now(),
        });
      }
      void request.then(() => onLateSettle?.());
      resolve();
    }, WORKER_GROUP_COUNT_TIMEOUT_MS);
  });
  await Promise.race([request, timedOut]);
  clearTimeout(timer);
};
