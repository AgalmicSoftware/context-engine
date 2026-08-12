const { getSbtRealtimeEventCursorGuard } = require('./sbtRealtimeEventCursorGuard.js');

describe('getSbtRealtimeEventCursorGuard', () => {
  it('allows a distinct older event because listener callbacks may finish out of order', () => {
    expect(
      getSbtRealtimeEventCursorGuard({
        eventBlockNumber: 10,
        transactionIndex: 1,
        logIndex: 1,
        lastRealtimeEventCursor: {
          blockNumber: 10,
          transactionIndex: 1,
          logIndex: 2,
        },
      }),
    ).toMatchObject({
      reason: '',
      shouldSkip: false,
      eventCursor: {
        blockNumber: 10,
        transactionIndex: 1,
        logIndex: 1,
      },
      lastRealtimeCursor: {
        blockNumber: 10,
        transactionIndex: 1,
        logIndex: 2,
      },
    });
  });

  it('does not treat the discovery watermark as realtime activity coverage', () => {
    expect(
      getSbtRealtimeEventCursorGuard({
        eventBlockNumber: 8,
        // Kept as an unknown legacy option to prove it cannot gate the event.
        overallLastBlockProcessedByNetwork: 9,
      }),
    ).toMatchObject({
      reason: '',
      shouldSkip: false,
    });
  });

  it('skips only an exact cursor already recorded in the bounded dedupe window', () => {
    expect(
      getSbtRealtimeEventCursorGuard({
        eventBlockNumber: 8,
        transactionIndex: 1,
        logIndex: 2,
        recentRealtimeEventCursors: [{ blockNumber: 8, transactionIndex: 1, logIndex: 2 }],
      }),
    ).toMatchObject({
      reason: 'cursor',
      shouldSkip: true,
    });
  });

  it('allows newer events and returns normalized cursor details', () => {
    expect(
      getSbtRealtimeEventCursorGuard({
        eventBlockNumber: '12',
        transactionIndex: '2',
        logIndex: '3',
        lastRealtimeEventCursor: {
          blockNumber: 11,
          transactionIndex: 9,
          logIndex: 9,
        },
      }),
    ).toMatchObject({
      reason: '',
      shouldSkip: false,
      eventCursor: {
        blockNumber: 12,
        transactionIndex: 2,
        logIndex: 3,
      },
      lastRealtimeCursor: {
        blockNumber: 11,
        transactionIndex: 9,
        logIndex: 9,
      },
    });
  });
});
