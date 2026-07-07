import {
  buildHolderUnionSet,
  buildHistorySummaryFromCounts,
  buildNetHoldersSet,
  buildNetHoldersSetFromCounts,
  buildSbtFilterFetchedHolderCacheEntryPatch,
  buildSbtFilterFetchedHolderRevisionKey,
  buildSbtFilterHolderFetchResult,
  buildSbtFilterHolderRequestKey,
  buildSbtFilterHolderRevisionKey,
  buildSbtFilterHolderSelectionSets,
  computeHolderListFingerprint,
  countMapFingerprint,
  normalizeAddressCountMap,
  resolveSbtFilterCreationBlock,
  resolveSbtFilterEntryCountMapUsage,
  resolveSbtFilterHolderScanFromBlock,
  setBoundedSbtHolderMemoEntry,
} from './sbtFilterHolderHelpers';

describe('sbtFilterHelpers holder helpers', () => {
  it('normalizes holder count maps to positive lower-case integer counts', () => {
    expect(
      normalizeAddressCountMap({
        '0xA': 2.9,
        '0xB': '3',
        '0xC': 0,
        '0xD': -2,
        '': 5,
        '0xE': Number.NaN,
      }),
    ).toEqual({
      '0xa': 2,
      '0xb': 3,
    });
    expect(normalizeAddressCountMap(null)).toEqual({});
    expect(
      resolveSbtFilterEntryCountMapUsage({
        entry: { countsLoaded: true },
        entryBurned: null,
        entryBurnedCountMap: {},
        entryMinted: null,
        entryMintedCountMap: {},
        rawEntryBurnedCounts: {},
        rawEntryMintedCounts: {},
      }),
    ).toEqual({
      checkpointBackedPartialCounts: false,
      hasAuthoritativeEntryCountMaps: true,
      hasStructuredEntryCountMaps: true,
      shouldUseEntryCountMaps: true,
    });
    expect(
      resolveSbtFilterEntryCountMapUsage({
        entry: { countsLoaded: false, countsScanCheckpoint: { fromBlock: 1 } },
        entryBurned: null,
        entryBurnedCountMap: {},
        entryMinted: null,
        entryMintedCountMap: { '0xa': 1 },
        rawEntryMintedCounts: { '0xa': 1 },
      }),
    ).toEqual({
      checkpointBackedPartialCounts: true,
      hasAuthoritativeEntryCountMaps: true,
      hasStructuredEntryCountMaps: true,
      shouldUseEntryCountMaps: false,
    });
    expect(
      resolveSbtFilterEntryCountMapUsage({
        entry: { countsLoaded: false },
        entryBurned: [],
        entryBurnedCountMap: {},
        entryMinted: [],
        entryMintedCountMap: {},
        rawEntryBurnedCounts: null,
        rawEntryMintedCounts: null,
      }).shouldUseEntryCountMaps,
    ).toBe(false);
  });

  it('builds stable count-map fingerprints', () => {
    expect(countMapFingerprint({ '0xB': 2, '0xA': 1 })).toBe(countMapFingerprint({ '0xa': 1, '0xb': 2 }));
    expect(countMapFingerprint({})).toBe('nil');
    expect(countMapFingerprint({ '0xA': 2 })).not.toBe(countMapFingerprint({ '0xA': 1 }));
  });

  it('builds holder-list fingerprints without sorting address arrays', () => {
    expect(computeHolderListFingerprint(null)).toBe('nil');
    expect(computeHolderListFingerprint(['0xA', '0xB'])).toBe(computeHolderListFingerprint(['0xa', '0xb']));
    expect(computeHolderListFingerprint(['0xA', '0xB'])).not.toBe(computeHolderListFingerprint(['0xB', '0xA']));
  });

  it('builds holder revision keys for cached and fetched holder sets', () => {
    expect(
      buildSbtFilterHolderRevisionKey({
        sbtSlug: 'alpha',
        netKey: 84532,
        sbtAddress: '0xSBT',
        sbtCacheRevision: 7,
        countsLoaded: true,
        shouldUseEntryCountMaps: true,
        mintedCountFingerprint: 'mint-counts',
        burnedCountFingerprint: 'burn-counts',
        mintedListFingerprint: 'mint-list',
        burnedListFingerprint: 'burn-list',
        creationBlock: 123,
      }),
    ).toBe('alpha|84532|0xSBT|7|1|1|mint-counts|burn-counts|mint-list|burn-list|123');
    expect(
      buildSbtFilterHolderRevisionKey({
        sbtSlug: '',
        netKey: '',
        sbtCacheRevision: 0,
        creationBlock: null,
      }),
    ).toBe('|||0|0|0|||||');
  });

  it('resolves SBT holder creation block precedence', () => {
    expect(
      resolveSbtFilterCreationBlock({
        entry: { creationBlock: null },
        entrySbtInfo: { creationBlock: '12' },
        sbtRecord: { creationBlock: '34' },
        sbtInfoRecord: { creationBlock: '56' },
      }),
    ).toBe('12');
    expect(
      resolveSbtFilterCreationBlock({
        entry: {},
        entrySbtInfo: {},
        sbtRecord: { creationBlock: 34 },
        sbtInfoRecord: { creationBlock: 56 },
      }),
    ).toBe(34);
    expect(
      resolveSbtFilterCreationBlock({
        entry: 'bad',
        entrySbtInfo: null,
        sbtRecord: {},
        sbtInfoRecord: {},
      }),
    ).toBeUndefined();
  });

  it('normalizes holder scan from-blocks and request keys', () => {
    expect(resolveSbtFilterHolderScanFromBlock('12.9')).toBe(12);
    expect(resolveSbtFilterHolderScanFromBlock(-1)).toBe(0);
    expect(resolveSbtFilterHolderScanFromBlock('bad')).toBe(0);
    expect(resolveSbtFilterHolderScanFromBlock(null)).toBe(0);
    expect(
      buildSbtFilterHolderRequestKey({
        sbtSlug: 'alpha',
        netKey: 84532,
        sbtAddress: '0xSBT',
        fromBlock: 12,
      }),
    ).toBe('alpha|84532|0xSBT|12');
    expect(
      buildSbtFilterHolderRequestKey({
        sbtSlug: '',
        netKey: '',
        sbtAddress: '',
        fromBlock: 0,
      }),
    ).toBe('|||0');
  });

  it('sets bounded holder memo entries with refresh ordering and oldest eviction', () => {
    const memo = new Map<string, Set<string>>();
    const alpha = new Set(['0x1']);
    const beta = new Set(['0x2']);
    const alphaNext = new Set(['0x3']);
    const gamma = new Set(['0x4']);

    setBoundedSbtHolderMemoEntry(memo, '', alpha, 2);
    expect(Array.from(memo.keys())).toEqual([]);

    setBoundedSbtHolderMemoEntry(memo, 'alpha', alpha, 2);
    setBoundedSbtHolderMemoEntry(memo, 'beta', beta, 2);
    setBoundedSbtHolderMemoEntry(memo, 'alpha', alphaNext, 2);
    expect(Array.from(memo.keys())).toEqual(['beta', 'alpha']);
    expect(memo.get('alpha')).toBe(alphaNext);

    setBoundedSbtHolderMemoEntry(memo, 'gamma', gamma, 2);
    expect(Array.from(memo.keys())).toEqual(['alpha', 'gamma']);
    expect(memo.get('beta')).toBeUndefined();
  });

  it('builds history summaries from event counts and net holder counts', () => {
    expect(
      buildHistorySummaryFromCounts({
        mintedCountByAddress: { '0xA': 2, '0xB': 1 },
        burnedCountByAddress: { '0xA': 1, '0xC': 1 },
        mintedEventCount: 0,
        burnedEventCount: 4,
      }),
    ).toEqual({
      totalMinted: '3',
      totalBurned: '4',
      activeSupply: '2',
      currentHolderCount: '2',
      historicalHolderCount: '2',
    });
  });

  it('builds net holder sets from arrays and count maps', () => {
    expect(Array.from(buildNetHoldersSet(['0xA', '0xB', '0xA'], ['0xa']))).toEqual(['0xb']);
    expect(Array.from(buildNetHoldersSetFromCounts({ '0xA': 2, '0xB': 1 }, { '0xA': 1, '0xB': 1 }))).toEqual(['0xa']);
  });

  it('builds fetched holder count results without changing count coercion', () => {
    const resolveHoldersSet = jest.fn(() => new Set(['0xa']));
    const result = buildSbtFilterHolderFetchResult({
      counts: {
        mintedCountByAddress: {
          '0xA': 2.9,
          '0xB': '1',
          '0xEmpty': 0,
        },
        burnedCountByAddress: {
          '0xA': 1,
          '0xDead': -1,
        },
        mintedEventCount: 4.8,
        burnedEventCount: -2,
        scannedToBlock: '18.9',
      },
      resolveHoldersSet,
    });

    expect(result).toEqual({
      mintedAddresses: ['0xa', '0xb'],
      burnedAddresses: ['0xa'],
      mintedCountByAddress: { '0xa': 2, '0xb': 1 },
      burnedCountByAddress: { '0xa': 1 },
      mintedEventCount: 4,
      burnedEventCount: 0,
      scannedToBlock: 18,
      holdersSet: new Set(['0xa']),
    });
    expect(resolveHoldersSet).toHaveBeenCalledWith({ '0xa': 2, '0xb': 1 }, { '0xa': 1 });

    const defaultResult = buildSbtFilterHolderFetchResult({
      counts: {
        mintedCountByAddress: { '0xA': 1, '0xB': 1 },
        burnedCountByAddress: { '0xB': 1 },
        mintedEventCount: 'bad',
        scannedToBlock: 'bad',
      },
    });
    expect(Array.from(defaultResult.holdersSet)).toEqual(['0xa']);
    expect(Number.isNaN(defaultResult.mintedEventCount)).toBe(true);
    expect(defaultResult.burnedEventCount).toBe(0);
    expect(defaultResult.scannedToBlock).toBeNull();
  });

  it('builds fetched holder cache entry patches with existing fallbacks', () => {
    expect(
      buildSbtFilterFetchedHolderCacheEntryPatch({
        fetched: {
          mintedAddresses: ['0xa'],
          burnedAddresses: ['0xb'],
          mintedCountByAddress: { '0xa': 2 },
          burnedCountByAddress: { '0xb': 1 },
          mintedEventCount: 3,
          burnedEventCount: 1,
          scannedToBlock: 22,
        },
      }),
    ).toEqual({
      mintedAddresses: ['0xa'],
      burnedAddresses: ['0xb'],
      mintedCountByAddress: { '0xa': 2 },
      burnedCountByAddress: { '0xb': 1 },
      mintedEventCount: 3,
      burnedEventCount: 1,
      historySummary: {
        totalMinted: '3',
        totalBurned: '1',
        activeSupply: '2',
        currentHolderCount: '1',
        historicalHolderCount: '1',
      },
      blockNumber: 22,
      countsLoaded: true,
      countsScanCheckpoint: null,
    });

    const invalidScannedBlockPatch = buildSbtFilterFetchedHolderCacheEntryPatch({
      fetched: {
        mintedEventCount: Number.NaN,
        burnedEventCount: Number.NaN,
        scannedToBlock: null,
      },
    });
    expect(invalidScannedBlockPatch.mintedEventCount).toBe(0);
    expect(invalidScannedBlockPatch.burnedEventCount).toBe(0);
    expect(invalidScannedBlockPatch.blockNumber).toBe(0);
  });

  it('builds fetched holder revision keys from fetched count evidence', () => {
    const fetched = {
      mintedAddresses: ['0xA', '0xB'],
      burnedAddresses: ['0xB'],
      mintedCountByAddress: { '0xA': 2, '0xB': 1 },
      burnedCountByAddress: { '0xB': 1 },
    };

    expect(
      buildSbtFilterFetchedHolderRevisionKey({
        sbtSlug: 'alpha',
        netKey: 84532,
        sbtAddress: '0xSBT',
        sbtCacheRevision: 3,
        fromBlock: 12,
        fetched,
      }),
    ).toBe(
      buildSbtFilterHolderRevisionKey({
        sbtSlug: 'alpha',
        netKey: 84532,
        sbtAddress: '0xSBT',
        sbtCacheRevision: 3,
        countsLoaded: true,
        shouldUseEntryCountMaps: true,
        mintedCountFingerprint: countMapFingerprint(fetched.mintedCountByAddress),
        burnedCountFingerprint: countMapFingerprint(fetched.burnedCountByAddress),
        mintedListFingerprint: computeHolderListFingerprint(fetched.mintedAddresses),
        burnedListFingerprint: computeHolderListFingerprint(fetched.burnedAddresses),
        creationBlock: 12,
      }),
    );

    expect(
      buildSbtFilterFetchedHolderRevisionKey({
        fromBlock: null,
        fetched: null,
      }),
    ).toBe(
      buildSbtFilterHolderRevisionKey({
        countsLoaded: true,
        shouldUseEntryCountMaps: true,
        mintedCountFingerprint: countMapFingerprint({}),
        burnedCountFingerprint: countMapFingerprint({}),
        mintedListFingerprint: computeHolderListFingerprint([]),
        burnedListFingerprint: computeHolderListFingerprint([]),
        creationBlock: 0,
      }),
    );
  });

  it('unions SBT holder sets for selected SBT entries', () => {
    const holders = buildHolderUnionSet([{ address: '0xA' }, { address: '0xB' }, { address: '0xMissing' }, '0xBad'], {
      '0xa': new Set(['0x1', '0x2']),
      '0xb': new Set(['0x2', '0x3']),
    });

    expect(Array.from(holders)).toEqual(['0x1', '0x2', '0x3']);
    expect(Array.from(buildHolderUnionSet(null, { '0xa': new Set(['0x1']) }))).toEqual([]);
  });

  it('builds holder selection sets for each SBT filter lane', () => {
    const sets = buildSbtFilterHolderSelectionSets({
      selectedSBTGroupsCreator: [{ address: '0xCreator' }],
      excludedSBTGroupsCreator: [{ address: '0xCreatorExclude' }],
      selectedSBTGroupsResponder: [{ address: '0xResponder' }],
      excludedSBTGroupsResponder: [{ address: '0xResponderExclude' }],
      selectedSBTGroups: [{ address: '0xAddress' }],
      excludedSBTGroups: [{ address: '0xAddressExclude' }],
      sbtHoldersMap: {
        '0xcreator': new Set(['0xc1']),
        '0xcreatorexclude': new Set(['0xce1']),
        '0xresponder': new Set(['0xr1']),
        '0xresponderexclude': new Set(['0xre1']),
        '0xaddress': new Set(['0xa1']),
        '0xaddressexclude': new Set(['0xae1']),
      },
    });

    expect(Array.from(sets.selectedCreatorHolderSet)).toEqual(['0xc1']);
    expect(Array.from(sets.excludedCreatorHolderSet)).toEqual(['0xce1']);
    expect(Array.from(sets.selectedResponderHolderSet)).toEqual(['0xr1']);
    expect(Array.from(sets.excludedResponderHolderSet)).toEqual(['0xre1']);
    expect(Array.from(sets.selectedAddressHolderSet)).toEqual(['0xa1']);
    expect(Array.from(sets.excludedAddressHolderSet)).toEqual(['0xae1']);
    expect(buildSbtFilterHolderSelectionSets().selectedCreatorHolderSet.size).toBe(0);
  });
});
