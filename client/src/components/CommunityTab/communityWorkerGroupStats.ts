import { getDemoSessionConfigBySlug, getSessionConfigBySlug } from '../../utilities/web3/chainGateway.js';
import { canonicalizeSessionSlug as normalizeSessionSlug } from '../../utilities/session/sessionSlug.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection';
import { sessionModeAllowsAnonymousWorkerGroupDiscovery } from '../../utilities/session/sessionModeProfile';
import { resolveWorkerCanonicalSessionIdHex } from '../../utilities/session/sessionWorkerDiscovery';
import { getUsableSessionWorkerUrl } from '../../utilities/session/sessionWorkerAvailability';
import {
  WORKER_CANONICAL_CACHE_SCOPE_KEY,
  resolveWorkerCanonicalCacheIdentity,
  workerCanonicalCacheIdentityMatches,
  type WorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import {
  loadPublicWorkerGroups,
  loadWorkerGroupOverview,
  type WorkerGroup,
  type WorkerGroupOverview,
} from '../../domains/worker/workerGroupPorts';
import { getWorkerSessionToken } from '../../utilities/worker/workerAuth';
import type { WorkerGroupsChangedDetail } from '../../utilities/worker/workerGroupChangeEvents';

export type CommunityWorkerGroupCountCacheEntry = {
  count: number;
  groupIds: string[];
  visibleUserIds: string[];
  status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable';
  updatedAtMs: number;
  promise?: Promise<void>;
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
  const sessionConfig =
    exactCandidate(propSessionConfig) ||
    exactCandidate(getSessionConfigBySlug(slug)) ||
    exactCandidate(getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })) ||
    {};
  const projection = resolveSessionCapabilityProjection(sessionConfig);
  const isWorkerCanonical =
    projection.source === 'profile' && projection.profileValid && projection.isWorkerCanonical;
  let workerCanonicalIdentity: WorkerCanonicalCacheIdentity | null = null;
  if (isWorkerCanonical) {
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
): string => `${identity.key}\n${String(account || '').trim().toLowerCase() || 'anonymous'}`;

export const getCommunityWorkerGroupCountState = (
  identity: WorkerCanonicalCacheIdentity | null,
  account: unknown,
  cache: Map<string, CommunityWorkerGroupCountCacheEntry>,
) => {
  const cached = identity ? cache.get(getCommunityWorkerGroupCountCacheKey(identity, account)) : null;
  return {
    workerGroupIds: Array.isArray(cached?.groupIds) ? cached.groupIds : [],
    workerVisibleUserIds: Array.isArray(cached?.visibleUserIds) ? cached.visibleUserIds : [],
    workerGroupsCount: Number(cached?.count || 0),
    workerGroupsStatus: String(cached?.status || 'idle'),
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
}: {
  scopeEntry: CommunityWorkerScope;
  runtime: CommunityWorkerGroupRuntime;
  cache: Map<string, CommunityWorkerGroupCountCacheEntry>;
  revisions: Map<string, number>;
  onWarning?: (message: string, error: unknown) => void;
}): Promise<void> => {
  if (!scopeEntry.isWorkerCanonical || !scopeEntry.workerCanonicalIdentity) return;
  const identity = scopeEntry.workerCanonicalIdentity;
  // Keep anonymous and account-authorized projections isolated across sign-in.
  const countCacheKey = getCommunityWorkerGroupCountCacheKey(identity, runtime.account);
  const requestRevision = Number(revisions.get(countCacheKey) || 0);
  const requestIsCurrent = () => Number(revisions.get(countCacheKey) || 0) === requestRevision;
  const existing = cache.get(countCacheKey);
  if (existing?.promise) {
    await existing.promise;
    return;
  }
  if (existing && Date.now() - existing.updatedAtMs < WORKER_GROUP_COUNT_TTL_MS) return;

  const { sessionConfig, slug } = scopeEntry;
  const account = String(runtime.account || '').trim();
  if (
    !account &&
    !sessionModeAllowsAnonymousWorkerGroupDiscovery(sessionConfig.sessionModeProfile)
  ) {
    cache.set(countCacheKey, {
      count: existing?.count || 0,
      groupIds: existing?.groupIds || [],
      visibleUserIds: existing?.visibleUserIds || [],
      status: 'unavailable',
      updatedAtMs: Date.now(),
    });
    return;
  }
  const workerUrl = getUsableSessionWorkerUrl({ slug, sessionConfig, requireExactWorkerSession: true });
  const sessionId = resolveWorkerCanonicalSessionIdHex(sessionConfig);
  if (!workerUrl || !sessionId) {
    cache.set(countCacheKey, {
      count: existing?.count || 0,
      groupIds: existing?.groupIds || [],
      visibleUserIds: existing?.visibleUserIds || [],
      status: 'error',
      updatedAtMs: Date.now(),
    });
    return;
  }

  const request = (async () => {
    try {
      let groups: WorkerGroup[];
      let overviewMemberships: WorkerGroupOverview['memberships'] = [];
      if (account) {
        const projection = resolveSessionCapabilityProjection(sessionConfig);
        const credentialToken = await getWorkerSessionToken({
          sessionSlug: slug,
          sessionConfig,
          workerUrl,
          context: {
            account,
            providerLike: runtime.provider,
            chainId:
              runtime.networkChainId || runtime.network?.chainId || runtime.network?.id || projection.chainId || 1,
          },
        });
        const overview = await loadWorkerGroupOverview({ workerUrl, credentialToken, sessionId, sessionSlug: slug });
        overviewMemberships = overview.memberships || [];
        groups = [...(overview.groups || []), ...(overview.memberships || []).map((membership) => membership.group)];
      } else {
        groups = await loadPublicWorkerGroups({ workerUrl, sessionId, sessionSlug: slug });
      }
      const groupIds = Array.from(new Set(groups.map((group) => String(group?.groupId || '').trim()).filter(Boolean)));
      const visibleUserIds = new Set<string>();
      groups.forEach((group) => {
        const adminAddress = String(group?.adminAddress || '').trim().toLowerCase();
        if (isDisplayableWorkerUserId(adminAddress)) visibleUserIds.add(adminAddress);
      });
      // Count only identities already visible to this viewer; aggregate member
      // counts must not become guesses or trigger hidden-list fetches.
      overviewMemberships.forEach((membership) => {
        const principal = membership?.member?.principal;
        const principalAddress =
          principal && 'address' in principal ? String(principal.address || '').trim().toLowerCase() : '';
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
        status: 'ready',
        updatedAtMs: Date.now(),
      });
    } catch (error) {
      if (!requestIsCurrent()) return;
      onWarning?.(`CommunityTab: Worker group count unavailable for ${slug}`, error);
      cache.set(countCacheKey, {
        count: existing?.count || 0,
        groupIds: existing?.groupIds || [],
        visibleUserIds: existing?.visibleUserIds || [],
        status: 'error',
        updatedAtMs: Date.now(),
      });
    }
  })();
  cache.set(countCacheKey, {
    count: existing?.count || 0,
    groupIds: existing?.groupIds || [],
    visibleUserIds: existing?.visibleUserIds || [],
    status: 'loading',
    updatedAtMs: existing?.updatedAtMs || 0,
    promise: request,
  });
  await request;
};
