import {
  compareSbtRealtimeEventCursor,
  normalizeSbtRealtimeEventCursor,
} from './sbtRealtimeCursorHelpers.js';

export const getSbtRealtimeEventCursorGuard = ({
  eventBlockNumber = 0,
  lastRealtimeEventCursor = null,
  logIndex = undefined,
  overallLastBlockProcessedByNetwork = 0,
  transactionIndex = undefined,
} = {}) => {
  const eventCursor = normalizeSbtRealtimeEventCursor({
    blockNumber: eventBlockNumber,
    transactionIndex,
    logIndex,
  });
  const lastRealtimeCursor = normalizeSbtRealtimeEventCursor(lastRealtimeEventCursor);

  if (
    lastRealtimeCursor &&
    eventCursor &&
    compareSbtRealtimeEventCursor(eventCursor, lastRealtimeCursor) <= 0
  ) {
    return {
      eventCursor,
      lastRealtimeCursor,
      reason: 'cursor',
      shouldSkip: true,
    };
  }

  if (eventBlockNumber < overallLastBlockProcessedByNetwork) {
    return {
      eventBlockNumber,
      eventCursor,
      lastRealtimeCursor,
      overallLastBlockProcessedByNetwork,
      reason: 'block',
      shouldSkip: true,
    };
  }

  return {
    eventCursor,
    lastRealtimeCursor,
    reason: '',
    shouldSkip: false,
  };
};
