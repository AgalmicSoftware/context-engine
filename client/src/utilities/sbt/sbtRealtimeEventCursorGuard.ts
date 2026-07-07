import { compareSbtRealtimeEventCursor, normalizeSbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';
import type { SbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';

interface SbtRealtimeEventCursorGuardOptions {
  eventBlockNumber?: unknown;
  lastRealtimeEventCursor?: unknown;
  logIndex?: unknown;
  overallLastBlockProcessedByNetwork?: unknown;
  transactionIndex?: unknown;
}

interface SbtRealtimeEventCursorGuardResult {
  eventBlockNumber?: unknown;
  eventCursor: SbtRealtimeEventCursor | null;
  lastRealtimeCursor: SbtRealtimeEventCursor | null;
  overallLastBlockProcessedByNetwork?: unknown;
  reason: 'cursor' | 'block' | '';
  shouldSkip: boolean;
}

export const getSbtRealtimeEventCursorGuard = ({
  eventBlockNumber = 0,
  lastRealtimeEventCursor = null,
  logIndex = undefined,
  overallLastBlockProcessedByNetwork = 0,
  transactionIndex = undefined,
}: SbtRealtimeEventCursorGuardOptions = {}): SbtRealtimeEventCursorGuardResult => {
  const eventCursor = normalizeSbtRealtimeEventCursor({
    blockNumber: eventBlockNumber,
    transactionIndex,
    logIndex,
  });
  const lastRealtimeCursor = normalizeSbtRealtimeEventCursor(lastRealtimeEventCursor);

  if (lastRealtimeCursor && eventCursor && compareSbtRealtimeEventCursor(eventCursor, lastRealtimeCursor) <= 0) {
    return {
      eventCursor,
      lastRealtimeCursor,
      reason: 'cursor',
      shouldSkip: true,
    };
  }

  if ((eventBlockNumber as number) < (overallLastBlockProcessedByNetwork as number)) {
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
