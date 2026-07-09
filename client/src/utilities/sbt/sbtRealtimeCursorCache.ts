import { compareSbtRealtimeEventCursor, normalizeSbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';

interface SbtRealtimeNetworkCache extends Record<PropertyKey, unknown> {
  lastRealtimeEventCursor?: unknown;
}

export const updateSbtRealtimeCursorForNetworkCache = (networkCache: unknown, eventCursor: unknown): boolean => {
  if (!networkCache || typeof networkCache !== 'object') return false;
  const cache = networkCache as SbtRealtimeNetworkCache;
  const normalizedCursor = normalizeSbtRealtimeEventCursor(eventCursor);
  if (!normalizedCursor) return false;

  const previousCursor = normalizeSbtRealtimeEventCursor(cache.lastRealtimeEventCursor);
  if (previousCursor && compareSbtRealtimeEventCursor(normalizedCursor, previousCursor) <= 0) {
    return false;
  }

  cache.lastRealtimeEventCursor = normalizedCursor;
  return true;
};
