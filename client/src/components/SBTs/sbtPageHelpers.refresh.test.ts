import {
  buildSbtPageRefreshOptions,
  resolveSbtPageOwnerLookupFallbackDecision,
  resolveSbtPageOwnerLookupTokenCount,
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
});
