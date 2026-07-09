export type ResolveUserPageAiAvailabilityRefreshArgs = {
  nextAccount?: unknown;
  nextIsQuestionCacheReady?: unknown;
  nextIsResponsesCacheReady?: unknown;
  nextIsSBTCacheReady?: unknown;
  nextIsSurveyCacheReady?: unknown;
  nextNetworkId?: unknown;
  nextViewAddress?: unknown;
  prevAccount?: unknown;
  prevIsQuestionCacheReady?: unknown;
  prevIsResponsesCacheReady?: unknown;
  prevIsSBTCacheReady?: unknown;
  prevIsSurveyCacheReady?: unknown;
  prevNetworkId?: unknown;
  prevViewAddress?: unknown;
};

export type BuildUserPageAiAvailabilityStatePatchArgs = {
  available?: unknown;
};

export type UserPageAiAvailabilityStatePatch = {
  aiAvailable: boolean | null;
};

export type UserPageAiAvailabilityRefreshDecision = {
  allCachesReady: boolean;
  contextChanged: boolean;
  shouldCheckAfterReset: boolean;
  shouldCheckNow: boolean;
};

export const buildUserPageAiAvailabilityStatePatch = ({
  available = null,
}: BuildUserPageAiAvailabilityStatePatchArgs = {}): UserPageAiAvailabilityStatePatch => ({
  aiAvailable: available === null ? null : Boolean(available),
});

export const resolveUserPageAiAvailabilityRefresh = ({
  nextAccount = '',
  nextIsQuestionCacheReady = false,
  nextIsResponsesCacheReady = false,
  nextIsSBTCacheReady = false,
  nextIsSurveyCacheReady = false,
  nextNetworkId = null,
  nextViewAddress = '',
  prevAccount = '',
  prevIsQuestionCacheReady = false,
  prevIsResponsesCacheReady = false,
  prevIsSBTCacheReady = false,
  prevIsSurveyCacheReady = false,
  prevNetworkId = null,
  prevViewAddress = '',
}: ResolveUserPageAiAvailabilityRefreshArgs = {}): UserPageAiAvailabilityRefreshDecision => {
  const allCachesReady = !!(
    nextIsSBTCacheReady &&
    nextIsSurveyCacheReady &&
    nextIsQuestionCacheReady &&
    nextIsResponsesCacheReady
  );
  const prevAllCachesReady = !!(
    prevIsSBTCacheReady &&
    prevIsSurveyCacheReady &&
    prevIsQuestionCacheReady &&
    prevIsResponsesCacheReady
  );
  const contextChanged =
    prevAccount !== nextAccount || prevViewAddress !== nextViewAddress || prevNetworkId !== nextNetworkId;
  return {
    allCachesReady,
    contextChanged,
    shouldCheckAfterReset: contextChanged && allCachesReady,
    shouldCheckNow: !contextChanged && allCachesReady && !prevAllCachesReady,
  };
};
