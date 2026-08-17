import { compareSbtRealtimeEventCursor, normalizeSbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';

interface SbtRealtimeNetworkCache extends Record<PropertyKey, unknown> {
  lastRealtimeEventCursor?: unknown;
  recentRealtimeEventCursors?: unknown;
}

const MAX_RECENT_REALTIME_EVENT_CURSORS = 128;

const isSameCursor = (left: unknown, right: unknown): boolean => compareSbtRealtimeEventCursor(left, right) === 0;

export const updateSbtRealtimeCursorForNetworkCache = (networkCache: unknown, eventCursor: unknown): boolean => {
  if (!networkCache || typeof networkCache !== 'object') return false;
  const cache = networkCache as SbtRealtimeNetworkCache;
  const normalizedCursor = normalizeSbtRealtimeEventCursor(eventCursor);
  if (!normalizedCursor) return false;

  const previousCursor = normalizeSbtRealtimeEventCursor(cache.lastRealtimeEventCursor);
  const recentCursors = Array.isArray(cache.recentRealtimeEventCursors)
    ? cache.recentRealtimeEventCursors.map(normalizeSbtRealtimeEventCursor).filter(Boolean)
    : [];
  if (
    (previousCursor && isSameCursor(normalizedCursor, previousCursor)) ||
    recentCursors.some((cursor) => isSameCursor(normalizedCursor, cursor))
  ) {
    return false;
  }

  // Keep dedupe identity separate from the high-water cursor: async listeners
  // can complete in reverse chain order, and both distinct events must apply.
  cache.recentRealtimeEventCursors = [...recentCursors, normalizedCursor].slice(-MAX_RECENT_REALTIME_EVENT_CURSORS);
  if (!previousCursor || compareSbtRealtimeEventCursor(normalizedCursor, previousCursor) > 0) {
    cache.lastRealtimeEventCursor = normalizedCursor;
  }
  return true;
};
