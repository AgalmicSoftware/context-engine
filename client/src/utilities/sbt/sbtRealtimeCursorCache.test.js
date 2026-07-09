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

  it('keeps the cache unchanged when the incoming cursor is stale', () => {
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
    ).toBe(false);
    expect(networkCache.lastRealtimeEventCursor).toBe(previous);
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
