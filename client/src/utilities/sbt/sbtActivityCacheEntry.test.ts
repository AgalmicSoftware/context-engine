import {
  applySbtActivityCacheEntryUpdate,
  buildSbtActivityCacheEntry,
  hydrateSbtActivityCacheEntry,
  isSbtActivityCacheEntry,
  mergeSbtActivityCacheEntryCounts,
  SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION,
} from './sbtActivityCacheEntry.js';

describe('sbtActivityCacheEntry', () => {
  it('builds the default uncached activity entry shape', () => {
    expect(
      buildSbtActivityCacheEntry({
        sbtAddress: '0xSBT',
        sbtInfo: { creationBlock: 12 },
      }),
    ).toEqual({
      schemaVersion: SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION,
      sbtAddress: '0xSBT',
      sbtInfo: { creationBlock: 12 },
      mintedAddresses: [],
      burnedAddresses: [],
      blockNumber: 0,
      creationBlock: 12,
      mintedCountByAddress: {},
      burnedCountByAddress: {},
      mintedEventCount: 0,
      burnedEventCount: 0,
      historySummary: {
        totalMinted: '0',
        totalBurned: '0',
        activeSupply: '0',
        currentHolderCount: '0',
        historicalHolderCount: '0',
      },
      countsLoaded: false,
    });
  });

  it('narrows legacy entries in place without dropping extension fields', () => {
    const legacyEntry = {
      sbtAddress: '0xSBT',
      legacyExtension: { retained: true },
    };

    const hydrated = hydrateSbtActivityCacheEntry(legacyEntry);

    expect(hydrated).toBe(legacyEntry);
    expect(hydrated).toEqual({
      schemaVersion: SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION,
      sbtAddress: '0xSBT',
      legacyExtension: { retained: true },
    });
    expect(isSbtActivityCacheEntry(hydrated)).toBe(true);
    expect(isSbtActivityCacheEntry({ sbtAddress: '0xSBT' })).toBe(false);
  });

  it('supports event-block overrides for newly created SBTs', () => {
    expect(
      buildSbtActivityCacheEntry({
        sbtAddress: '0xSBT',
        sbtInfo: { creationBlock: 12 },
        creationBlock: 24,
        blockNumber: 24,
      }),
    ).toEqual(
      expect.objectContaining({
        sbtAddress: '0xSBT',
        creationBlock: 24,
        blockNumber: 24,
        countsLoaded: false,
        mintedCountByAddress: {},
        burnedCountByAddress: {},
      }),
    );
  });

  it('normalizes legacy state and applies a mint event', () => {
    const entry = {
      mintedAddresses: ['0xAAA', '0xbbb', '0xAAA'],
      burnedAddresses: ['0xccc'],
      mintedCountByAddress: { '0xAAA': 2 },
      burnedCountByAddress: { '0xBBB': 2 },
      mintedEventCount: 1,
      burnedEventCount: 0,
      blockNumber: 7,
      countsLoaded: true,
    };

    const updated = applySbtActivityCacheEntryUpdate(entry, {
      account: '0xBBB',
      burned: false,
      eventBlockNumber: 11,
    });

    expect(updated).toBe(entry);
    expect(updated).toEqual({
      schemaVersion: SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION,
      mintedAddresses: ['0xaaa', '0xbbb'],
      burnedAddresses: ['0xccc'],
      mintedCountByAddress: {
        '0xaaa': 2,
        '0xbbb': 2,
      },
      burnedCountByAddress: {
        '0xbbb': 2,
        '0xccc': 1,
      },
      mintedEventCount: 4,
      burnedEventCount: 3,
      historySummary: {
        totalMinted: '4',
        totalBurned: '3',
        activeSupply: '2',
        currentHolderCount: '1',
        historicalHolderCount: '2',
      },
      blockNumber: 11,
      countsLoaded: true,
    });
  });

  it('applies a burn event without duplicating burned addresses', () => {
    const entry = {
      mintedAddresses: ['0xaaa'],
      burnedAddresses: ['0xaaa'],
      mintedCountByAddress: { '0xaaa': 2 },
      burnedCountByAddress: { '0xaaa': 1 },
      mintedEventCount: 2,
      burnedEventCount: 1,
      blockNumber: 14,
    };

    const updated = applySbtActivityCacheEntryUpdate(entry, {
      account: '0xAAA',
      burned: true,
      eventBlockNumber: 12,
    });

    expect(updated.burnedAddresses).toEqual(['0xaaa']);
    expect(updated.burnedCountByAddress).toEqual({ '0xaaa': 2 });
    expect(updated.burnedEventCount).toBe(2);
    expect(updated.historySummary).toEqual({
      totalMinted: '2',
      totalBurned: '2',
      activeSupply: '0',
      currentHolderCount: '0',
      historicalHolderCount: '1',
    });
    expect(updated.blockNumber).toBe(14);
    expect(updated.countsLoaded).toBe(false);
    expect(updated.schemaVersion).toBe(SBT_ACTIVITY_CACHE_ENTRY_SCHEMA_VERSION);
  });

  it('does not finalize a stale scan behind a newer partial checkpoint', () => {
    const merged = mergeSbtActivityCacheEntryCounts(
      {
        blockNumber: 105,
        countsLoaded: false,
        countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
        mintedAddresses: ['0xholder'],
        mintedCountByAddress: { '0xholder': 2 },
        mintedEventCount: 2,
      },
      {
        blockNumber: 100,
        countsLoaded: true,
        countsScanCheckpoint: null,
        mintedAddresses: ['0xholder'],
        mintedCountByAddress: { '0xholder': 1 },
        mintedEventCount: 1,
      },
    );

    expect(merged).toMatchObject({
      blockNumber: 105,
      countsLoaded: false,
      countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
      mintedCountByAddress: { '0xholder': 2 },
      mintedEventCount: 2,
    });
  });

  it('does not finalize a stale scan behind newer activity when no checkpoint exists', () => {
    const merged = mergeSbtActivityCacheEntryCounts(
      {
        blockNumber: 120,
        countsLoaded: false,
        mintedCountByAddress: { '0xholder': 2 },
        mintedEventCount: 2,
      },
      {
        blockNumber: 100,
        countsLoaded: true,
        mintedCountByAddress: { '0xholder': 1 },
        mintedEventCount: 1,
      },
    );

    expect(merged).toMatchObject({
      blockNumber: 120,
      countsLoaded: false,
      mintedCountByAddress: { '0xholder': 2 },
      mintedEventCount: 2,
    });
  });

  it('keeps the newest checkpoint when partial scans finish out of order', () => {
    const merged = mergeSbtActivityCacheEntryCounts(
      {
        blockNumber: 105,
        countsLoaded: false,
        countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
      },
      {
        blockNumber: 100,
        countsLoaded: false,
        countsScanCheckpoint: { phase: 'activity', blockNumber: 100 },
      },
    );

    expect(merged).toMatchObject({
      blockNumber: 105,
      countsLoaded: false,
      countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
    });
  });

  it('finalizes a scan that covers the latest partial checkpoint', () => {
    const merged = mergeSbtActivityCacheEntryCounts(
      {
        blockNumber: 105,
        countsLoaded: false,
        countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
      },
      {
        blockNumber: 115,
        countsLoaded: true,
        mintedCountByAddress: { '0xholder': 1 },
        mintedEventCount: 1,
      },
    );

    expect(merged).toMatchObject({
      blockNumber: 115,
      countsLoaded: true,
      countsScanCheckpoint: null,
      mintedCountByAddress: { '0xholder': 1 },
      mintedEventCount: 1,
    });
  });
});
