/**
 * @module sessionRegistryReader
 * @description Shared read-only accessor for the session registry localStorage cache.
 *              Provides getRegistrySessionConfig(slug) for use by worker/session consumers
 *              without importing the full sessionRegistry module.
 */

import { canonicalizeSessionSlug } from './canonicalSessionContext.js';
import { overlayCachedSessionWorkerConfig } from './sessionWorkerConfigCache.js';

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

export const readRegistryCache = () => {
  if (typeof window === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem(REGISTRY_CACHE_KEY) || 'null');
    if (!cache || typeof cache !== 'object') return cache;
    if (!cache.groups && cache.sessions) cache.groups = cache.sessions;
    if (!cache.sessions && cache.groups) cache.sessions = cache.groups;
    return cache;
  } catch (_) {
    return null;
  }
};

export const getRegistrySessionConfig = (slug) => {
  const cache = readRegistryCache();
  if (!cache || !cache.sessions) return null;
  const normalizedSlug = canonicalizeSessionSlug(slug);
  return overlayCachedSessionWorkerConfig({
    slug: normalizedSlug,
    sessionConfig: cache.sessions[normalizedSlug] || null,
  });
};
