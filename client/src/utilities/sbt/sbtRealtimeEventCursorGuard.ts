import { compareSbtRealtimeEventCursor, normalizeSbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';
import type { SbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';

interface SbtRealtimeEventCursorGuardOptions {
  eventBlockNumber?: unknown;
  lastRealtimeEventCursor?: unknown;
  logIndex?: unknown;
  recentRealtimeEventCursors?: unknown;
  transactionIndex?: unknown;
}

interface SbtRealtimeEventCursorGuardResult {
  eventBlockNumber?: unknown;
  eventCursor: SbtRealtimeEventCursor | null;
  lastRealtimeCursor: SbtRealtimeEventCursor | null;
  reason: 'cursor' | '';
  shouldSkip: boolean;
}

export const getSbtRealtimeEventCursorGuard = ({
  eventBlockNumber = 0,
  lastRealtimeEventCursor = null,
  logIndex = undefined,
  recentRealtimeEventCursors = [],
  transactionIndex = undefined,
}: SbtRealtimeEventCursorGuardOptions = {}): SbtRealtimeEventCursorGuardResult => {
  const eventCursor = normalizeSbtRealtimeEventCursor({
    blockNumber: eventBlockNumber,
    transactionIndex,
    logIndex,
  });
  const lastRealtimeCursor = normalizeSbtRealtimeEventCursor(lastRealtimeEventCursor);
  const recentCursors = Array.isArray(recentRealtimeEventCursors)
    ? recentRealtimeEventCursors.map(normalizeSbtRealtimeEventCursor).filter(Boolean)
    : [];

  if (
    eventCursor &&
    ((lastRealtimeCursor && compareSbtRealtimeEventCursor(eventCursor, lastRealtimeCursor) === 0) ||
      recentCursors.some((cursor) => compareSbtRealtimeEventCursor(eventCursor, cursor) === 0))
  ) {
    return {
      eventCursor,
      lastRealtimeCursor,
      reason: 'cursor',
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
