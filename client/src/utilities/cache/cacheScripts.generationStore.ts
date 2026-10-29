import * as idb from './cacheScripts.idb.impl.js';

const GENERATION_PREFIX = 'ce:cache-generation:';
const SEPARATOR = '\u0000';
const namespaceForKey = (key: string): string => key.match(/^dg:([^:]+):/)?.[1] || '';

export const cacheNamespaceGeneration = (namespace: string): string =>
  typeof localStorage === 'undefined' ? '' : localStorage.getItem(`${GENERATION_PREFIX}${namespace}`) || '';

export const currentCacheStorageKey = (key: string): string => {
  const namespace = namespaceForKey(key);
  const generation = namespace ? cacheNamespaceGeneration(namespace) : '';
  return generation ? `${key}${SEPARATOR}${generation}` : key;
};

export const logicalCacheStorageKey = (key: string): string | null => {
  const logical = key.split(SEPARATOR)[0];
  return currentCacheStorageKey(logical) === key ? logical : null;
};

export const advanceCacheNamespace = (namespace: string): boolean => {
  try {
    const generation = crypto.randomUUID();
    localStorage.setItem(`${GENERATION_PREFIX}${namespace}`, generation);
    return cacheNamespaceGeneration(namespace) === generation;
  } catch (_) {
    return false;
  }
};

export const removeNamespaceLocalEntries = (namespace: string): boolean => {
  try {
    const prefix = `dg:${namespace}:`;
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(prefix) && logicalCacheStorageKey(key) === null) localStorage.removeItem(key);
    }
    return true;
  } catch (_) {
    return false;
  }
};

export const createStore = idb.createStore;
type Store = Parameters<typeof idb.get>[1];

export const get = async (key: string, store: Store): Promise<unknown> => {
  const physical = currentCacheStorageKey(key);
  const value = await idb.get(physical, store);
  return physical === currentCacheStorageKey(key) ? value : undefined;
};

export const set = async (key: string, value: unknown, store: Store): Promise<void> => {
  const physical = currentCacheStorageKey(key);
  await idb.set(physical, value, store);
  if (physical !== currentCacheStorageKey(key)) {
    await idb.del(physical, store);
    throw new Error('Cache was cleared during the write');
  }
};

export const del = async (key: string, store: Store): Promise<void> => {
  await idb.del(currentCacheStorageKey(key), store);
};

// A new generation makes old entries unreadable even while IDB is offline.
// Enumerations remove those entries before recovery can hydrate the mirror.
export const entries = async (store: Store): Promise<Array<[string, unknown]>> => {
  const all = await idb.entries(store);
  const current: Array<[string, unknown]> = [];
  for (const [raw, value] of all) {
    const key = String(raw);
    const logical = logicalCacheStorageKey(key);
    if (logical === null) await idb.del(raw, store);
    else current.push([logical, value]);
  }
  return current;
};
