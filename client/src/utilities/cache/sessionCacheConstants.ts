/**
 * @module utilities/cache/sessionCacheConstants
 */

export const SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX = 'dg:sessionFallbackRedirectSeen:';

export const DG_MANAGED_CACHE_NAMES = new Set([
  'questionsCache',
  'surveysCache',
  'bookmarksCache',
  'filters',
  'sbtCache',
  'userCache',
]);

export const DG_PRIMARY_ROUTE_CACHE_NAMES = ['questionsCache', 'surveysCache', 'sbtCache'];

export const MASKED_Q_DECRYPT_BACKOFF_TTL_MS = 12 * 60 * 60 * 1000;
export const MASKED_Q_DECRYPT_BACKOFF_MAX = 3000;
