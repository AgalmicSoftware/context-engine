const { updateSbtRealtimeCursorForNetworkCache } = require('./sbtRealtimeCursorCache.js');

describe('updateSbtRealtimeCursorForNetworkCache', () => {
  it('writes the normalized cursor when the cache has no previous cursor', () => {
    const networkCache = {};

    expect(
      updateSbtRealtimeCursorForNetworkCache(networkCache, {
        blockNumber: '10',
        transactionIndex: '2',
        logIndex: '3',
      }),
    ).toBe(true);
    expect(networkCache.lastRealtimeEventCursor).toEqual({
      blockNumber: 10,
      transactionIndex: 2,
      logIndex: 3,
    });
    expect(networkCache.recentRealtimeEventCursors).toEqual([
      { blockNumber: 10, transactionIndex: 2, logIndex: 3 },
    ]);
  });

  it('updates the cache when the incoming cursor is newer', () => {
    const networkCache = {
      lastRealtimeEventCursor: {
        blockNumber: 10,
        transactionIndex: 2,
        logIndex: 3,
      },
    };

    expect(
      updateSbtRealtimeCursorForNetworkCache(networkCache, {
        blockNumber: 10,
        transactionIndex: 2,
        logIndex: 4,
      }),
    ).toBe(true);
    expect(networkCache.lastRealtimeEventCursor).toEqual({
      blockNumber: 10,
      transactionIndex: 2,
      logIndex: 4,
    });
  });

  it('records a distinct older cursor without moving the high-water cursor backward', () => {
    const previous = {
      blockNumber: 10,
      transactionIndex: 2,
      logIndex: 3,
    };
    const networkCache = {
      lastRealtimeEventCursor: previous,
    };

    expect(
      updateSbtRealtimeCursorForNetworkCache(networkCache, {
        blockNumber: 10,
        transactionIndex: 2,
        logIndex: 2,
      }),
    ).toBe(true);
    expect(networkCache.lastRealtimeEventCursor).toBe(previous);
    expect(networkCache.recentRealtimeEventCursors).toEqual([
      { blockNumber: 10, transactionIndex: 2, logIndex: 2 },
    ]);
  });

  it('rejects an exact duplicate from the recent cursor window', () => {
    const cursor = { blockNumber: 10, transactionIndex: 2, logIndex: 2 };
    const networkCache = {
      lastRealtimeEventCursor: { blockNumber: 11, transactionIndex: 0, logIndex: 0 },
      recentRealtimeEventCursors: [cursor],
    };

    expect(updateSbtRealtimeCursorForNetworkCache(networkCache, cursor)).toBe(false);
    expect(networkCache.recentRealtimeEventCursors).toEqual([cursor]);
  });

  it('ignores invalid cursors', () => {
    const networkCache = {};

    expect(
      updateSbtRealtimeCursorForNetworkCache(networkCache, {
        blockNumber: 'not-a-block',
      }),
    ).toBe(false);
    expect(networkCache.lastRealtimeEventCursor).toBeUndefined();
  });
});
