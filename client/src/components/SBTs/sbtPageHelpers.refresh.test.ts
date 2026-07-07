import {
  buildSbtPageRefreshOptions,
  resolveSbtPageOwnerLookupFallbackDecision,
  resolveSbtPageOwnerLookupTokenCount,
  resolveSbtPageCacheRevisionReloadPlan,
  resolveSbtPageLoadInfoPendingQueuePlan,
  resolveSbtPageRefreshLifecyclePlan,
  resolveSbtPageShouldRefreshCounts,
} from './sbtPageHelpers';

describe('sbtPageHelpers refresh helpers', () => {
  it('builds forced SBT refresh options', () => {
    const onProgress = jest.fn();

    expect(buildSbtPageRefreshOptions({
      forceEventFetch: false,
      onProgress,
      preferCountsOnly: true,
    })).toBeUndefined();
    expect(buildSbtPageRefreshOptions({
      forceEventFetch: true,
    })).toEqual({ forceCounts: true });
    expect(buildSbtPageRefreshOptions({
      forceEventFetch: true,
      onProgress,
      preferCountsOnly: true,
    })).toEqual({
      forceCounts: true,
      countsOnly: true,
      onProgress,
    });
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: false,
      forceEventFetch: false,
      mintedAddresses: [],
      mintedTokensOverride: null,
    })).toBe(true);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: false,
      forceEventFetch: false,
      mintedAddresses: ['0x1'],
      mintedTokensOverride: null,
    })).toBe(true);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: true,
      forceEventFetch: false,
      mintedAddresses: [],
      mintedTokensOverride: null,
    })).toBe(false);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: true,
      forceEventFetch: true,
      mintedAddresses: ['0x1'],
      mintedTokensOverride: { '0x1': 1 },
    })).toBe(true);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: false,
      forceEventFetch: false,
      mintedAddresses: [],
      mintedTokensOverride: { total: 1 },
    })).toBe(true);
    expect(resolveSbtPageShouldRefreshCounts({
      burnedAddresses: [],
      countsLoaded: false,
      forceEventFetch: false,
      mintedAddresses: [],
      mintedTokensOverride: '1',
    })).toBe(true);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      countsLoaded: false,
      mintedAddresses: [],
      ownerLookupTokenCount: 3,
      preferCountsOnly: false,
      requireCountsNotLoaded: true,
    })).toBe(true);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      countsLoaded: true,
      mintedAddresses: [],
      ownerLookupTokenCount: 3,
      preferCountsOnly: false,
      requireCountsNotLoaded: true,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      mintedAddresses: ['0x1'],
      ownerLookupTokenCount: 3,
      preferCountsOnly: false,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      mintedAddresses: [],
      ownerLookupTokenCount: 3,
      preferCountsOnly: true,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupFallbackDecision({
      burnedAddresses: [],
      mintedAddresses: [],
      ownerLookupTokenCount: 0,
      preferCountsOnly: false,
    })).toBe(false);
    expect(resolveSbtPageOwnerLookupTokenCount({
      mintedTokensOverride: '7',
      ownerLookupUpperBound: '5',
    })).toBe(5);
    expect(resolveSbtPageOwnerLookupTokenCount({
      mintedTokensOverride: '7',
      ownerLookupUpperBound: 'bad',
    })).toBe(7);
    expect(resolveSbtPageOwnerLookupTokenCount({
      mintedTokensOverride: null,
      ownerLookupUpperBound: null,
    })).toBeNaN();
  });

  it('plans centralized refresh lifecycle work without owning refresh execution', () => {
    expect(resolveSbtPageRefreshLifecyclePlan({
      eventScanTried: false,
      parentOwnsInitialRefresh: false,
      refreshOptions: undefined,
      shouldRefreshCounts: true,
      usingCentralHydration: true,
    })).toEqual({
      shouldPromoteToForcedCountsRefresh: true,
      shouldRunEventScanRefresh: true,
    });
    expect(resolveSbtPageRefreshLifecyclePlan({
      eventScanTried: true,
      parentOwnsInitialRefresh: false,
      refreshOptions: { forceCounts: true },
      shouldRefreshCounts: true,
      usingCentralHydration: true,
    })).toEqual({
      shouldPromoteToForcedCountsRefresh: false,
      shouldRunEventScanRefresh: false,
    });
    expect(resolveSbtPageRefreshLifecyclePlan({
      eventScanTried: 'already-scanned',
      parentOwnsInitialRefresh: false,
      refreshOptions: { forceCounts: 1 },
      shouldRefreshCounts: true,
      usingCentralHydration: true,
    })).toEqual({
      shouldPromoteToForcedCountsRefresh: false,
      shouldRunEventScanRefresh: false,
    });
    expect(resolveSbtPageRefreshLifecyclePlan({
      eventScanTried: false,
      parentOwnsInitialRefresh: true,
      refreshOptions: null,
      shouldRefreshCounts: true,
      usingCentralHydration: true,
    })).toEqual({
      shouldPromoteToForcedCountsRefresh: false,
      shouldRunEventScanRefresh: false,
    });
    expect(resolveSbtPageRefreshLifecyclePlan({
      eventScanTried: false,
      parentOwnsInitialRefresh: false,
      refreshOptions: null,
      shouldRefreshCounts: true,
      usingCentralHydration: false,
    })).toEqual({
      shouldPromoteToForcedCountsRefresh: false,
      shouldRunEventScanRefresh: false,
    });
  });

  it('plans cache revision reloads without owning component lifecycle execution', () => {
    expect(resolveSbtPageCacheRevisionReloadPlan({
      isMounted: true,
      nextSbtAddress: '0x00000000000000000000000000000000000000a1',
      nextSbtCacheRevision: 2,
      prevSbtCacheRevision: 1,
    })).toEqual({
      cacheRevisionChanged: true,
      shouldReloadSbtInfo: true,
      shouldResetMetaHydrationTried: true,
      loadOptions: false,
    });
    expect(resolveSbtPageCacheRevisionReloadPlan({
      isMounted: true,
      nextSbtAddress: '0x00000000000000000000000000000000000000a1',
      nextSbtCacheRevision: 1,
      prevSbtCacheRevision: 1,
    })).toEqual({
      cacheRevisionChanged: false,
      shouldReloadSbtInfo: false,
      shouldResetMetaHydrationTried: false,
      loadOptions: null,
    });
    expect(resolveSbtPageCacheRevisionReloadPlan({
      isMounted: false,
      nextSbtAddress: '0x00000000000000000000000000000000000000a1',
      nextSbtCacheRevision: 2,
      prevSbtCacheRevision: 1,
    })).toEqual({
      cacheRevisionChanged: true,
      shouldReloadSbtInfo: false,
      shouldResetMetaHydrationTried: false,
      loadOptions: null,
    });
    expect(resolveSbtPageCacheRevisionReloadPlan({
      isMounted: true,
      nextSbtAddress: '',
      nextSbtCacheRevision: 2,
      prevSbtCacheRevision: 1,
    })).toEqual({
      cacheRevisionChanged: true,
      shouldReloadSbtInfo: false,
      shouldResetMetaHydrationTried: false,
      loadOptions: null,
    });
  });

  it('plans pending load queue merges without scheduling the rerun', () => {
    expect(resolveSbtPageLoadInfoPendingQueuePlan({
      forceEventFetch: false,
      preferCountsOnly: true,
    })).toEqual({
      pendingForce: false,
      pendingOptions: {
        forceEventFetch: false,
        preferCountsOnly: true,
      },
      shouldQueueLoad: true,
    });
    expect(resolveSbtPageLoadInfoPendingQueuePlan({
      forceEventFetch: true,
      pendingForce: false,
      pendingOptions: {
        forceEventFetch: false,
        preferCountsOnly: true,
      },
      preferCountsOnly: false,
    })).toEqual({
      pendingForce: true,
      pendingOptions: {
        forceEventFetch: true,
        preferCountsOnly: true,
      },
      shouldQueueLoad: true,
    });
    expect(resolveSbtPageLoadInfoPendingQueuePlan({
      forceEventFetch: false,
      pendingForce: true,
      pendingOptions: {
        forceEventFetch: true,
        preferCountsOnly: false,
      },
      preferCountsOnly: false,
    })).toEqual({
      pendingForce: true,
      pendingOptions: {
        forceEventFetch: true,
        preferCountsOnly: false,
      },
      shouldQueueLoad: true,
    });
  });
});
