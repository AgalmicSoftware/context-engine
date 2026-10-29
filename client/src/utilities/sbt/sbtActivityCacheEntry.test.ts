import {
  applySbtActivityCacheEntryUpdate,
  buildSbtActivityCacheEntry,
  hydrateSbtActivityCacheEntry,
  mergeSbtActivityCacheEntryCounts,
  type SbtActivityCacheEntry,
} from './sbtActivityCacheEntry.js';

const makeEntry = (patch: Partial<SbtActivityCacheEntry>): SbtActivityCacheEntry => ({
  ...buildSbtActivityCacheEntry({ sbtAddress: '0xsbt' }),
  ...patch,
  coveredCounts: {
    mintedCountByAddress: patch.mintedCountByAddress || {},
    burnedCountByAddress: patch.burnedCountByAddress || {},
    mintedEventCount: patch.mintedEventCount || 0,
    burnedEventCount: patch.burnedEventCount || 0,
  },
});

describe('sbtActivityCacheEntry', () => {
  it('keeps a live delta separate from coverage and retires it when a scan covers it', () => {
    const initial = mergeSbtActivityCacheEntryCounts(buildSbtActivityCacheEntry({ sbtAddress: '0xsbt' }), {
      blockNumber: 10,
      countsLoaded: true,
      mintedCountByAddress: { '0xaaa': 1 },
      mintedEventCount: 1,
    });
    applySbtActivityCacheEntryUpdate(initial, {
      account: '0xccc',
      burned: false,
      eventBlockNumber: 20,
      eventId: 'tx20:0',
    });
    applySbtActivityCacheEntryUpdate(initial, {
      account: '0xccc',
      burned: false,
      eventBlockNumber: 20,
      eventId: 'tx20:0',
    });
    expect(initial.blockNumber).toBe(10);
    expect(initial.mintedCountByAddress).toEqual({ '0xaaa': 1, '0xccc': 1 });
    const refreshed = mergeSbtActivityCacheEntryCounts(initial, {
      blockNumber: 30,
      countsLoaded: true,
      mintedCountByAddress: { '0xaaa': 1, '0xbbb': 1, '0xccc': 1 },
      mintedEventCount: 3,
    });
    expect(refreshed).toMatchObject({ blockNumber: 30, mintedEventCount: 3, pendingActivity: {} });
    expect(refreshed.mintedCountByAddress).toEqual({ '0xaaa': 1, '0xbbb': 1, '0xccc': 1 });
  });

  it('replaces a complete covered snapshot, removing an orphan while retaining later live activity', () => {
    const initial = mergeSbtActivityCacheEntryCounts(buildSbtActivityCacheEntry({ sbtAddress: '0xsbt' }), {
      blockNumber: 10,
      countsLoaded: true,
      mintedCountByAddress: { '0xaaa': 1, '0xorphan': 1 },
      mintedEventCount: 2,
    });
    applySbtActivityCacheEntryUpdate(initial, {
      account: '0xlive',
      burned: false,
      eventBlockNumber: 20,
      eventId: 'tx20:0',
    });
    const replaced = mergeSbtActivityCacheEntryCounts(initial, {
      blockNumber: 10,
      countsLoaded: true,
      mintedCountByAddress: { '0xaaa': 1 },
      mintedEventCount: 1,
    });
    expect(replaced.mintedCountByAddress).toEqual({ '0xaaa': 1, '0xlive': 1 });
    expect(replaced).toMatchObject({ blockNumber: 10, lastActivityBlock: 20, mintedEventCount: 2 });
  });

  it('discards old activity entries instead of inventing coverage from their last event', () => {
    expect(hydrateSbtActivityCacheEntry({ schemaVersion: 1, blockNumber: 20, countsLoaded: true })).toBeNull();
  });

  it('builds an empty current entry without treating metadata as scan coverage', () => {
    const entry = buildSbtActivityCacheEntry({ sbtAddress: '0xsbt', sbtInfo: { creationBlock: 12 }, blockNumber: 24 });
    expect(entry).toMatchObject({
      schemaVersion: 2,
      blockNumber: 0,
      lastActivityBlock: 24,
      countsLoaded: false,
      pendingActivity: {},
      mintedCountByAddress: {},
      burnedCountByAddress: {},
      historySummary: { totalMinted: '0', totalBurned: '0' },
    });
    expect(hydrateSbtActivityCacheEntry(entry)).toBe(entry);
    expect(hydrateSbtActivityCacheEntry({ sbtAddress: '0xsbt' })).toBeNull();
  });

  it('applies each pending burn once without changing covered history', () => {
    const entry = makeEntry({
      blockNumber: 10,
      countsLoaded: true,
      mintedCountByAddress: { '0xaaa': 2 },
      burnedCountByAddress: { '0xaaa': 1 },
      mintedEventCount: 2,
      burnedEventCount: 1,
    });
    const event = { account: '0xAAA', burned: true, eventBlockNumber: 12, eventId: 'tx12:0' };
    applySbtActivityCacheEntryUpdate(entry, event);
    applySbtActivityCacheEntryUpdate(entry, event);
    expect(entry).toMatchObject({
      blockNumber: 10,
      lastActivityBlock: 12,
      burnedCountByAddress: { '0xaaa': 2 },
      burnedEventCount: 2,
      historySummary: { activeSupply: '0', totalBurned: '2' },
    });
    applySbtActivityCacheEntryUpdate(entry, { ...event, eventBlockNumber: 9, eventId: 'already-covered' });
    expect(entry.burnedEventCount).toBe(2);
  });

  it('does not finalize a stale scan behind a newer partial checkpoint', () => {
    const merged = mergeSbtActivityCacheEntryCounts(
      makeEntry({
        blockNumber: 105,
        countsLoaded: false,
        countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
        mintedAddresses: ['0xholder'],
        mintedCountByAddress: { '0xholder': 2 },
        mintedEventCount: 2,
      }),
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
      makeEntry({
        blockNumber: 120,
        countsLoaded: false,
        mintedCountByAddress: { '0xholder': 2 },
        mintedEventCount: 2,
      }),
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
      makeEntry({
        blockNumber: 105,
        countsLoaded: false,
        countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
      }),
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
      makeEntry({
        blockNumber: 105,
        countsLoaded: false,
        countsScanCheckpoint: { phase: 'activity', blockNumber: 110 },
      }),
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
