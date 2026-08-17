/**
 * @module utilities/cache/sessionCacheConstants
 */

import managedCacheNamespaces from './managedCacheNamespaces.json';

export const SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX = 'dg:sessionFallbackRedirectSeen:';

export const DG_MANAGED_CACHE_NAMESPACE_LIST = Object.freeze([...managedCacheNamespaces.managedNamespaces]);

export const DG_MANAGED_CACHE_NAMES = new Set(DG_MANAGED_CACHE_NAMESPACE_LIST);

export const DG_PRIMARY_ROUTE_CACHE_NAMES = Object.freeze([...managedCacheNamespaces.primaryRouteNamespaces]);

export const MASKED_Q_DECRYPT_BACKOFF_TTL_MS = 12 * 60 * 60 * 1000;
export const MASKED_Q_DECRYPT_BACKOFF_MAX = 3000;
