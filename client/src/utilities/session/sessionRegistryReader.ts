/**
 * @module sessionRegistryReader
 * @description Shared read-only accessor for the session registry localStorage cache.
 *              Provides getRegistrySessionConfig(slug) for use by worker/session consumers
 *              without importing the full sessionRegistry module.
 */

import { canonicalizeSessionSlug } from './canonicalSessionContext.js';
import { overlayCachedSessionWorkerConfig } from './sessionWorkerConfigCache.js';

const REGISTRY_CACHE_KEY = 'dg:sessionRegistryCache:v1';

type RegistrySessionConfig = Record<string, unknown>;
type RegistrySessionMap = Record<string, RegistrySessionConfig>;
type RegistryCache = Record<string, unknown> & {
  groups?: unknown;
  sessions?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object';

export const readRegistryCache = (): unknown => {
  if (typeof window === 'undefined') return null;
  try {
    const cache = JSON.parse(localStorage.getItem(REGISTRY_CACHE_KEY) || 'null') as unknown;
    if (!isRecord(cache)) return cache;
    const normalizedCache: RegistryCache = cache;
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

export const getRegistrySessionConfig = (slug: unknown): RegistrySessionConfig | null => {
  const cache = readRegistryCache();
  if (!isRecord(cache) || !isRecord(cache.sessions)) return null;
  const sessions = cache.sessions as RegistrySessionMap;
  const normalizedSlug = canonicalizeSessionSlug(slug);
  const sessionConfig = sessions[normalizedSlug];
  return overlayCachedSessionWorkerConfig({
    slug: normalizedSlug,
    sessionConfig: isRecord(sessionConfig) ? sessionConfig : null,
  });
};
