/**
 * @module sessionRegistryReader
 * @description Shared read-only accessor for the session registry localStorage cache.
 *              Provides getRegistrySessionConfig(slug) for use by worker/session consumers
 *              without importing the full sessionRegistry module.
 */

import { canonicalizeSessionSlug } from './canonicalSessionContext.js';
import { overlayCachedSessionWorkerConfig } from './sessionWorkerConfigCache.js';

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

type RegistryCache = {
  groups?: Record<string, any>;
  sessions?: Record<string, any>;
  [key: string]: any;
};

export const readRegistryCache = (): unknown => {
  if (typeof window === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem(REGISTRY_CACHE_KEY) || 'null') as unknown;
    if (!cache || typeof cache !== 'object') return cache;
    const normalizedCache = cache as RegistryCache;
    if (!normalizedCache.groups && normalizedCache.sessions) {
      normalizedCache.groups = normalizedCache.sessions;
    }
    if (!normalizedCache.sessions && normalizedCache.groups) {
      normalizedCache.sessions = normalizedCache.groups;
    }
    return normalizedCache;
  } catch (_) {
    return null;
  }
};

export const getRegistrySessionConfig = (slug: unknown) => {
  const cache = readRegistryCache();
  if (!cache || typeof cache !== 'object' || !(cache as RegistryCache).sessions) return null;
  const normalizedCache = cache as RegistryCache;
  const normalizedSlug = canonicalizeSessionSlug(slug);
  return overlayCachedSessionWorkerConfig({
    slug: normalizedSlug,
    sessionConfig: normalizedCache.sessions?.[normalizedSlug] || null,
  });
};
