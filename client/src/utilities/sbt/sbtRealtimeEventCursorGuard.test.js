const { getSbtRealtimeEventCursorGuard } = require('./sbtRealtimeEventCursorGuard.js');

describe('getSbtRealtimeEventCursorGuard', () => {
  it('skips when the ordered event cursor is older than the last processed cursor', () => {
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
        overallLastBlockProcessedByNetwork: 9,
      }),
    ).toMatchObject({
      reason: 'cursor',
      shouldSkip: true,
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

  it('skips when the event block is older than the network waterline', () => {
    expect(
      getSbtRealtimeEventCursorGuard({
        eventBlockNumber: 8,
        overallLastBlockProcessedByNetwork: 9,
      }),
    ).toMatchObject({
      eventBlockNumber: 8,
      overallLastBlockProcessedByNetwork: 9,
      reason: 'block',
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
        overallLastBlockProcessedByNetwork: 12,
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
