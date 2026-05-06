import {
  compareSbtRealtimeEventCursor,
  normalizeSbtRealtimeEventCursor,
} from './sbtRealtimeCursorHelpers.js';

export const updateSbtRealtimeCursorForNetworkCache = (
  networkCache,
  eventCursor
) => {
  if (!networkCache || typeof networkCache !== 'object') return false;
  const normalizedCursor = normalizeSbtRealtimeEventCursor(eventCursor);
  if (!normalizedCursor) return false;

  const previousCursor = normalizeSbtRealtimeEventCursor(networkCache.lastRealtimeEventCursor);
  if (previousCursor && compareSbtRealtimeEventCursor(normalizedCursor, previousCursor) <= 0) {
    return false;
  }

  networkCache.lastRealtimeEventCursor = normalizedCursor;
  return true;
};
