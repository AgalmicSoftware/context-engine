import {
  buildSbtPageRefreshOptions,
  resolveSbtPageOwnerLookupFallbackDecision,
  resolveSbtPageOwnerLookupTokenCount,
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
    })).toBe(false);
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
});
