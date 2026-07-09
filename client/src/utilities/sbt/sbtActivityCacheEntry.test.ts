import { applySbtActivityCacheEntryUpdate, buildSbtActivityCacheEntry } from './sbtActivityCacheEntry.js';

describe('sbtActivityCacheEntry', () => {
  it('builds the default uncached activity entry shape', () => {
    expect(
      buildSbtActivityCacheEntry({
        sbtAddress: '0xSBT',
        sbtInfo: { creationBlock: 12 },
      }),
    ).toEqual({
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
  });
});
