/**
 * @module cacheScripts
 * @description IndexedDB cache CRUD via a small private key-value helper — namespace-scoped read/write/subscribe
 *              with BroadcastChannel cross-tab sync and optimistic writes.
 *
 * Key exports: readCache, writeCache, writeCacheOptimistic, updateCacheAtomic, peekCacheSync, listNamespaceEntriesSync, subscribeCacheUpdates
 */
import {
  createStore,
  del as idbDel,
  entries as idbEntries,
  get as idbGet,
  set as idbSet,
} from './cacheScripts.idb.impl.js';
import { createLogger } from '../logging.js';

const cacheLog = createLogger('cacheScripts');

type CacheLegacyCollection = CacheLegacyNode & {
  includes: (searchElement: unknown, fromIndex?: number) => boolean;
};
type CacheLegacyIndexedNode = {
  [key: string]: CacheLegacyNode | CacheLegacyCollection | undefined;
  questions?: CacheLegacyCollection;
  questionResponses?: CacheLegacyNode;
  sbtList?: CacheLegacyNode;
  surveys?: CacheLegacyNode;
  users?: CacheLegacyCollection;
};
type CacheLegacyNode = CacheLegacyIndexedNode & {
  blockNumber?: number;
  burnedAddresses?: CacheLegacyCollection;
  burnedCountByAddress?: CacheLegacyNode;
  burnedEventCount?: number;
  countsLoaded?: boolean;
  countsScanCheckpoint?: CacheLegacyNode | null;
  mintedAddresses?: CacheLegacyCollection;
  mintedCountByAddress?: CacheLegacyNode;
  mintedEventCount?: number;
  sbtAddress?: string;
  sbtInfo?: CacheLegacyNode;
  tokenURI?: unknown;
};
type CacheValue = unknown;
type CacheObject = Record<string, CacheValue>;
type StorageKeyParts = {
  key: string;
  namespace: string;
  slug: string;
};
type CacheEntry<TValue = CacheLegacyNode> = {
  namespace: string;
  slug: string;
  key: string;
  value: TValue;
};
type CacheUpdatePayload<TValue = CacheValue> = {
  action?: string;
  namespace?: string;
  slug?: string;
  key?: string;
  value?: TValue;
  source?: string;
  _dgCacheScripts?: boolean;
  sourceId?: string;
  ts?: number;
};
type CacheUpdateHandler = (payload: CacheUpdatePayload) => void;
type MigrationReport = {
  moved: number;
  removed: number;
  failed: number;
};
type ActiveOptimisticMirrorEntry = {
  key: string;
  seq: number;
  value: CacheValue;
};
type ManagedWriteInput = {
  namespace: string;
  slug: string;
  key: string;
  value: CacheValue;
};
type ManagedKeyInput = {
  namespace: string;
  slug: string;
  key: string;
};
type CachePeekOptions = {
  clone?: boolean;
};
type CacheListOptions = {
  cloneValues?: boolean;
};
type CacheBackendDiagnostics = {
  persistentBackend: 'unknown' | 'indexeddb' | 'localstorage';
  probeState: 'unprobed' | 'probing' | 'ready';
  idbAvailable: boolean;
  didHydrateMirror: boolean;
  recoveryInFlight: boolean;
};

const DB_NAME = 'ce_cache_v1';
const DB_STORE = 'ce_cache_entries_v1';
const IDB_STORE = createStore(DB_NAME, DB_STORE);
const BROADCAST_CHANNEL_NAME = 'ce_dg_cache_updates_v1';
const IDB_PROBE_KEY = '__dg_cache_probe__';
const IDB_CONSECUTIVE_FAILURE_THRESHOLD = 3;
const IDB_RECOVERY_RETRY_MS = 30 * 1000;
const READ_FAILED = Symbol('dg-cache-read-failed');
const safeClone = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

const MANAGED_NAMESPACE_LIST = [
  'questionsCache',
  'surveysCache',
  'bookmarksCache',
  'filters',
  'sbtCache',
  'userCache',
  'analysisCache',
];
const MANAGED_NAMESPACES = new Set(MANAGED_NAMESPACE_LIST);

const mirrorByKey = new Map<string, CacheValue>();
const mirrorByNamespace = new Map<string, Map<string, CacheValue>>();
const writeQueuesByKey = new Map<string, Promise<unknown>>();
const optimisticWriteSeqByKey = new Map<string, number>();
const subscribers = new Set<CacheUpdateHandler>();

let initPromise: Promise<void> | null = null;
let backendReadyPromise: Promise<void> | null = null;
let didHydrateMirror = false;
let idbAvailable = true;
let idbConsecutiveFailures = 0;
let idbLastRecoveryProbeAt = 0;
let idbRecoveryPromise: Promise<boolean> | null = null;
let broadcastChannel: BroadcastChannel | null = null;
let storageListenerAttached = false;
let optimisticWriteSeqCounter = 0;

const clientId = (() => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch (e) {
    cacheLog.warn('cacheScripts: fallback', e);
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
})();

const getErrorMessage = (error: unknown): unknown => (error instanceof Error ? error.message : error);

const isManagedNamespace = (namespace: unknown): boolean => MANAGED_NAMESPACES.has(String(namespace || ''));

const toStorageKey = (namespace: unknown, slug: unknown = ''): string =>
  `dg:${String(namespace || '')}:${String(slug || '')}`;

const parseStorageKey = (key: unknown): StorageKeyParts | null => {
  const raw = String(key || '');
  const m = raw.match(/^dg:([^:]+):(.*)$/);
  if (!m) return null;
  return {
    key: raw,
    namespace: m[1],
    slug: m[2] || '',
  };
};

const cloneValue = <T>(value: T): T => {
  if (value === undefined || value === null) return value;
  try {
    return safeClone(value);
  } catch (_) {
    return value;
  }
};

const isPlainObject = (value: unknown): value is CacheObject =>
  value != null && typeof value === 'object' && !Array.isArray(value);

const valuesEqual = (a: unknown, b: unknown): boolean => {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return a === b;
  }
};

// When fallback writes land in localStorage while IDB is unhealthy, merge them
// back into IDB by preferring the fallback branch while preserving IDB-only data.
const mergeMigrationValues = (existingValue: CacheValue, incomingValue: CacheValue): CacheValue => {
  if (!isPlainObject(existingValue) || !isPlainObject(incomingValue)) {
    return cloneValue(incomingValue);
  }
  const next: CacheObject = { ...existingValue };
  Object.keys(incomingValue).forEach((key) => {
    const existingChild = existingValue[key];
    const incomingChild = incomingValue[key];
    if (isPlainObject(existingChild) && isPlainObject(incomingChild)) {
      next[key] = mergeMigrationValues(existingChild, incomingChild);
      return;
    }
    next[key] = cloneValue(incomingChild);
  });
  return next;
};

const getNamespaceBucket = (namespace: unknown): Map<string, CacheValue> => {
  const ns = String(namespace || '');
  if (!mirrorByNamespace.has(ns)) {
    mirrorByNamespace.set(ns, new Map());
  }
  return mirrorByNamespace.get(ns)!;
};

const clearMirror = () => {
  mirrorByKey.clear();
  mirrorByNamespace.clear();
};

const setMirrorValue = (namespace: unknown, slug: unknown, value: CacheValue): void => {
  const key = toStorageKey(namespace, slug);
  const next = cloneValue(value);
  mirrorByKey.set(key, next);
  getNamespaceBucket(namespace).set(String(slug || ''), next);
};

const removeMirrorValue = (namespace: unknown, slug: unknown): void => {
  const key = toStorageKey(namespace, slug);
  mirrorByKey.delete(key);
  const bucket = getNamespaceBucket(namespace);
  bucket.delete(String(slug || ''));
};

const snapshotActiveOptimisticMirrorEntries = (): ActiveOptimisticMirrorEntry[] => {
  const entries: ActiveOptimisticMirrorEntry[] = [];
  optimisticWriteSeqByKey.forEach((seq, key) => {
    if (!mirrorByKey.has(key)) return;
    entries.push({
      key,
      seq,
      value: cloneValue(mirrorByKey.get(key)),
    });
  });
  return entries;
};

const restoreActiveOptimisticMirrorEntries = (entries: ActiveOptimisticMirrorEntry[] = []): void => {
  entries.forEach(({ key, seq, value }) => {
    if (optimisticWriteSeqByKey.get(key) !== seq) return;
    const parsed = parseStorageKey(key);
    if (!parsed || !isManagedNamespace(parsed.namespace)) return;
    setMirrorValue(parsed.namespace, parsed.slug, value);
  });
};

const emitUpdate = (payload: CacheUpdatePayload = {}): void => {
  subscribers.forEach((handler) => {
    try {
      handler(payload);
    } catch (e) {
      cacheLog.warn('cacheScripts: callback', e);
    }
  });
};

const noteIdbSuccess = (): void => {
  idbConsecutiveFailures = 0;
};

const noteIdbFailure = (op: string, storageKey: string, error: unknown): void => {
  idbConsecutiveFailures += 1;
  if (idbConsecutiveFailures >= IDB_CONSECUTIVE_FAILURE_THRESHOLD) {
    idbAvailable = false;
    cacheLog.warn('[cacheScripts] IDB failed repeatedly; using localStorage fallback', {
      op,
      storageKey,
      consecutiveFailures: idbConsecutiveFailures,
      error: getErrorMessage(error),
    });
    return;
  }
  cacheLog.warn('[cacheScripts] IDB op failed; will retry IDB on next operation', {
    op,
    storageKey,
    consecutiveFailures: idbConsecutiveFailures,
    error: getErrorMessage(error),
  });
};

const getBroadcastChannel = (): BroadcastChannel | null => {
  if (broadcastChannel) return broadcastChannel;
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    return broadcastChannel;
  } catch (_) {
    broadcastChannel = null;
    return null;
  }
};

const broadcastUpdate = (payload: CacheUpdatePayload = {}): void => {
  if (!idbAvailable) return;
  const chan = getBroadcastChannel();
  if (!chan) return;
  try {
    chan.postMessage({
      ...payload,
      _dgCacheScripts: true,
      sourceId: clientId,
      ts: Date.now(),
    });
  } catch (e) {
    cacheLog.warn('cacheScripts: fallback', e);
  }
};

const parseJsonOrNull = (raw: string | null): CacheValue | null => {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
};

const readLocalStorageKey = (key: string): CacheValue | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    return parseJsonOrNull(localStorage.getItem(key));
  } catch (_) {
    return null;
  }
};

const writeLocalStorageKey = (key: string, value: CacheValue): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    cacheLog.warn('[cacheScripts] localStorage write failed', { key, error: getErrorMessage(e) });
    return false;
  }
};

const removeLocalStorageKey = (key: string): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    localStorage.removeItem(key);
    return true;
  } catch (_) {
    return false;
  }
};

const updateMirrorFromStorageKey = (storageKey: string, value: CacheValue): void => {
  const parsed = parseStorageKey(storageKey);
  if (!parsed) return;
  if (!isManagedNamespace(parsed.namespace)) return;
  setMirrorValue(parsed.namespace, parsed.slug, value);
};

const removeMirrorFromStorageKey = (storageKey: string): void => {
  const parsed = parseStorageKey(storageKey);
  if (!parsed) return;
  if (!isManagedNamespace(parsed.namespace)) return;
  removeMirrorValue(parsed.namespace, parsed.slug);
};

const attachStorageListenerOnce = (): void => {
  if (storageListenerAttached) return;
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
  window.addEventListener('storage', (event) => {
    try {
      const key = String(event?.key || '');
      if (!key.startsWith('dg:')) return;
      const parsed = parseStorageKey(key);
      if (!parsed || !isManagedNamespace(parsed.namespace)) return;
      if (event.newValue == null) {
        removeMirrorValue(parsed.namespace, parsed.slug);
        emitUpdate({
          action: 'remove',
          namespace: parsed.namespace,
          slug: parsed.slug,
          key,
          source: 'storage',
        });
        return;
      }
      const parsedValue = parseJsonOrNull(event.newValue);
      setMirrorValue(parsed.namespace, parsed.slug, parsedValue);
      emitUpdate({
        action: 'write',
        namespace: parsed.namespace,
        slug: parsed.slug,
        key,
        value: cloneValue(parsedValue),
        source: 'storage',
      });
    } catch (e) {
      cacheLog.warn('cacheScripts: telemetry', e);
    }
  });
  storageListenerAttached = true;
};

const attachBroadcastListenerOnce = (): void => {
  const chan = getBroadcastChannel();
  if (!chan) return;
  const onMessage = (event: MessageEvent<CacheUpdatePayload>) => {
    if (!idbAvailable) return;
    const data = event?.data;
    if (!data || data._dgCacheScripts !== true) return;
    if (data.sourceId && data.sourceId === clientId) return;
    const key = String(data.key || '');
    const parsed = parseStorageKey(key);
    if (!parsed || !isManagedNamespace(parsed.namespace)) return;
    if (data.action === 'remove') {
      removeMirrorValue(parsed.namespace, parsed.slug);
      emitUpdate({
        action: 'remove',
        namespace: parsed.namespace,
        slug: parsed.slug,
        key,
        source: 'broadcast',
      });
      return;
    }
    setMirrorValue(parsed.namespace, parsed.slug, data.value);
    emitUpdate({
      action: 'write',
      namespace: parsed.namespace,
      slug: parsed.slug,
      key,
      value: cloneValue(data.value),
      source: 'broadcast',
    });
  };
  try {
    chan.addEventListener('message', onMessage);
  } catch (_) {
    chan.onmessage = onMessage;
  }
};

const probeIdbAvailability = async (): Promise<boolean> => {
  try {
    await idbSet(IDB_PROBE_KEY, { ok: true, ts: Date.now() }, IDB_STORE);
    await idbDel(IDB_PROBE_KEY, IDB_STORE);
    return true;
  } catch (e) {
    cacheLog.warn('[cacheScripts] IndexedDB unavailable; using localStorage fallback', e);
    return false;
  }
};

const ensureBackendReady = async (): Promise<void> => {
  if (backendReadyPromise) return backendReadyPromise;
  backendReadyPromise = (async () => {
    attachStorageListenerOnce();
    attachBroadcastListenerOnce();
    idbAvailable = await probeIdbAvailability();
    if (idbAvailable) noteIdbSuccess();
  })();
  return backendReadyPromise;
};

const hydrateMirrorFromIdb = async ({
  preserveOptimistic = false,
}: {
  preserveOptimistic?: boolean;
} = {}): Promise<void> => {
  const optimisticSnapshots = preserveOptimistic ? snapshotActiveOptimisticMirrorEntries() : [];
  clearMirror();
  try {
    const all = await idbEntries(IDB_STORE);
    all.forEach(([key, value]) => {
      const storageKey = String(key || '');
      const parsed = parseStorageKey(storageKey);
      if (!parsed || !isManagedNamespace(parsed.namespace)) return;
      if (preserveOptimistic && optimisticWriteSeqByKey.has(storageKey)) return;
      setMirrorValue(parsed.namespace, parsed.slug, value);
    });
    if (preserveOptimistic) {
      restoreActiveOptimisticMirrorEntries(optimisticSnapshots);
    }
  } catch (e) {
    cacheLog.warn('[cacheScripts] Failed to hydrate mirror from IDB', e);
  }
  didHydrateMirror = true;
};

const hydrateMirrorFromLocalStorage = (): void => {
  clearMirror();
  try {
    if (typeof localStorage === 'undefined') {
      didHydrateMirror = true;
      return;
    }
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const parsed = parseStorageKey(key);
      if (!parsed || !isManagedNamespace(parsed.namespace)) continue;
      setMirrorValue(parsed.namespace, parsed.slug, readLocalStorageKey(key));
    }
  } catch (e) {
    cacheLog.warn('[cacheScripts] Failed to hydrate mirror from localStorage fallback', e);
  }
  didHydrateMirror = true;
};

const hydrateMissingMirrorFromLocalStorage = (): number => {
  let hydrated = 0;
  try {
    if (typeof localStorage === 'undefined') return hydrated;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || mirrorByKey.has(key)) continue;
      const parsed = parseStorageKey(key);
      if (!parsed || !isManagedNamespace(parsed.namespace)) continue;
      const value = readLocalStorageKey(key);
      if (value == null) continue;
      setMirrorValue(parsed.namespace, parsed.slug, value);
      hydrated += 1;
    }
  } catch (e) {
    cacheLog.warn('[cacheScripts] Failed to hydrate missing mirror entries from localStorage fallback', e);
  }
  return hydrated;
};

const migrateManagedKeysFromLocalStorage = async ({
  useIdb = true,
}: {
  useIdb?: boolean;
} = {}): Promise<MigrationReport> => {
  if (typeof localStorage === 'undefined') return { moved: 0, removed: 0, failed: 0 };
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const parsed = parseStorageKey(key);
      if (!parsed || !isManagedNamespace(parsed.namespace)) continue;
      keys.push(key);
    }
  } catch (e) {
    cacheLog.warn('cacheScripts: fallback', e);
  }

  let moved = 0;
  let removed = 0;
  let failed = 0;

  for (const key of keys) {
    const parsed = parseStorageKey(key);
    if (!parsed) continue;
    const value = readLocalStorageKey(key);
    if (value == null) continue;
    let valueForMirror: CacheValue = value;

    if (!useIdb) {
      updateMirrorFromStorageKey(key, value);
      continue;
    }

    let wrote = false;

    try {
      const existing = await idbGet(key, IDB_STORE);
      if (existing === undefined) {
        await idbSet(key, cloneValue(value), IDB_STORE);
        moved += 1;
      } else {
        const merged = mergeMigrationValues(existing, value);
        valueForMirror = merged;
        if (!valuesEqual(existing, merged)) {
          await idbSet(key, cloneValue(merged), IDB_STORE);
          moved += 1;
        }
      }
      wrote = true;
      noteIdbSuccess();
    } catch (e) {
      failed += 1;
      noteIdbFailure('migrate-managed-local', key, e);
      cacheLog.warn('[cacheScripts] Failed migrating managed key to IDB', {
        key,
        error: getErrorMessage(e),
      });
    }

    if (!wrote) continue;
    updateMirrorFromStorageKey(key, valueForMirror);
    if (removeLocalStorageKey(key)) removed += 1;
  }

  return { moved, removed, failed };
};

const attemptIdbRecovery = async ({ force = false }: { force?: boolean } = {}): Promise<boolean> => {
  if (idbAvailable) return true;
  const now = Date.now();
  if (!force && now - idbLastRecoveryProbeAt < IDB_RECOVERY_RETRY_MS) return false;
  if (idbRecoveryPromise) return idbRecoveryPromise;

  idbRecoveryPromise = (async () => {
    idbLastRecoveryProbeAt = Date.now();
    const recovered = await probeIdbAvailability();
    if (!recovered) return false;

    idbAvailable = true;
    noteIdbSuccess();
    cacheLog.warn('[cacheScripts] IndexedDB recovered; reconciling managed fallback cache keys');
    const managed = await migrateManagedKeysFromLocalStorage({ useIdb: true });
    await hydrateMirrorFromIdb({ preserveOptimistic: true });
    const repairedFromLocal = hydrateMissingMirrorFromLocalStorage();

    cacheLog.log('[cacheScripts] IndexedDB recovery mirror hydration complete', {
      moved: Number(managed.moved || 0),
      removed: Number(managed.removed || 0),
      failed: Number(managed.failed || 0),
      repairedFromLocal,
    });

    return true;
  })()
    .catch((e) => {
      idbAvailable = false;
      cacheLog.warn('[cacheScripts] IndexedDB recovery probe failed', e);
      return false;
    })
    .finally(() => {
      idbRecoveryPromise = null;
    });

  return idbRecoveryPromise;
};

const repairIdbKeyFromLocalStorage = async (storageKey: string, fallbackValue: CacheValue): Promise<void> => {
  if (fallbackValue == null || !idbAvailable) return;
  try {
    await idbSet(storageKey, cloneValue(fallbackValue), IDB_STORE);
    noteIdbSuccess();
    removeLocalStorageKey(storageKey);
  } catch (e) {
    noteIdbFailure('read-fallback-repair', storageKey, e);
  }
};

const persistKey = async (storageKey: string, value: CacheValue): Promise<boolean> => {
  await ensureBackendReady();
  if (!idbAvailable) {
    await attemptIdbRecovery();
  }
  if (idbAvailable) {
    try {
      try {
        await idbSet(storageKey, cloneValue(value), IDB_STORE);
      } catch (firstError) {
        cacheLog.warn('[cacheScripts] IDB write failed; retrying once', {
          storageKey,
          error: getErrorMessage(firstError),
        });
        await idbSet(storageKey, cloneValue(value), IDB_STORE);
      }
      noteIdbSuccess();
      removeLocalStorageKey(storageKey);
      return true;
    } catch (e) {
      noteIdbFailure('write', storageKey, e);
      if (!idbAvailable) {
        return writeLocalStorageKey(storageKey, value);
      }
      return false;
    }
  }
  return writeLocalStorageKey(storageKey, value);
};

const deleteKey = async (storageKey: string): Promise<boolean> => {
  await ensureBackendReady();
  if (!idbAvailable) {
    await attemptIdbRecovery();
  }
  if (idbAvailable) {
    try {
      try {
        await idbDel(storageKey, IDB_STORE);
      } catch (firstError) {
        cacheLog.warn('[cacheScripts] IDB delete failed; retrying once', {
          storageKey,
          error: getErrorMessage(firstError),
        });
        await idbDel(storageKey, IDB_STORE);
      }
      noteIdbSuccess();
      removeLocalStorageKey(storageKey);
      return true;
    } catch (e) {
      noteIdbFailure('delete', storageKey, e);
      if (!idbAvailable) {
        return removeLocalStorageKey(storageKey);
      }
      return false;
    }
  }
  return removeLocalStorageKey(storageKey);
};

const readPersistentKey = async (storageKey: string): Promise<CacheValue | null | typeof READ_FAILED> => {
  await ensureBackendReady();
  if (!idbAvailable) {
    await attemptIdbRecovery();
  }
  if (idbAvailable) {
    try {
      let value: CacheValue;
      try {
        value = await idbGet(storageKey, IDB_STORE);
      } catch (firstError) {
        cacheLog.warn('[cacheScripts] IDB read failed; retrying once', {
          storageKey,
          error: getErrorMessage(firstError),
        });
        value = await idbGet(storageKey, IDB_STORE);
      }
      noteIdbSuccess();
      if (value !== undefined) {
        removeLocalStorageKey(storageKey);
        return value;
      }
      const fallbackValue = readLocalStorageKey(storageKey);
      if (fallbackValue == null) return null;
      await repairIdbKeyFromLocalStorage(storageKey, fallbackValue);
      return cloneValue(fallbackValue);
    } catch (e) {
      noteIdbFailure('read', storageKey, e);
      const fallbackValue = readLocalStorageKey(storageKey);
      if (fallbackValue != null) return cloneValue(fallbackValue);
      if (!idbAvailable) return null;
      return READ_FAILED;
    }
  }
  return readLocalStorageKey(storageKey);
};

const enqueueWriteTaskForStorageKey = <T>(storageKey: string, task: () => Promise<T>): Promise<T> => {
  const prev = writeQueuesByKey.get(storageKey) || Promise.resolve();
  const run = prev.catch(() => null).then(async () => task());
  writeQueuesByKey.set(storageKey, run);
  run
    .finally(() => {
      if (writeQueuesByKey.get(storageKey) === run) {
        writeQueuesByKey.delete(storageKey);
      }
    })
    .catch((e) => {
      cacheLog.warn('cacheScripts: fallback', e);
    });
  return run;
};

const commitManagedWrite = ({ namespace, slug, key, value }: ManagedWriteInput): void => {
  setMirrorValue(namespace, slug, value);
  emitUpdate({
    action: 'write',
    namespace,
    slug,
    key,
    value: cloneValue(value),
    source: 'local',
  });
  broadcastUpdate({
    action: 'write',
    namespace,
    slug,
    key,
    value: cloneValue(value),
  });
};

export const initCacheManager = async (): Promise<void> => {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await ensureBackendReady();
    if (idbAvailable) {
      const managed = await migrateManagedKeysFromLocalStorage({ useIdb: true });
      await hydrateMirrorFromIdb();
      const hydrated = hydrateMissingMirrorFromLocalStorage();
      if (Number(managed.moved || 0) > 0 || Number(managed.removed || 0) > 0 || hydrated > 0) {
        cacheLog.log('[cacheScripts] Reconciled localStorage fallback data during cache init', {
          moved: Number(managed.moved || 0),
          removed: Number(managed.removed || 0),
          failed: Number(managed.failed || 0),
          hydrated,
        });
      }
    } else hydrateMirrorFromLocalStorage();
  })();
  return initPromise;
};

export const migrateLocalStorageToIDB = async (): Promise<{
  migrated: boolean;
  idb: boolean;
  moved: number;
  removed: number;
  failed: number;
}> => {
  await ensureBackendReady();
  const managed = await migrateManagedKeysFromLocalStorage({ useIdb: !!idbAvailable });
  const report = {
    migrated: Number(managed.moved || 0) > 0 || Number(managed.removed || 0) > 0,
    idb: !!idbAvailable,
    moved: Number(managed.moved || 0),
    removed: Number(managed.removed || 0),
    failed: Number(managed.failed || 0),
  };
  if (!didHydrateMirror) {
    if (idbAvailable) {
      await hydrateMirrorFromIdb();
      hydrateMissingMirrorFromLocalStorage();
    } else hydrateMirrorFromLocalStorage();
  }
  return report;
};

export const readCache = async <TValue = CacheLegacyNode>(
  namespace: unknown,
  slug: unknown = '',
): Promise<TValue | null> => {
  const ns = String(namespace || '');
  const sl = String(slug || '');
  if (!isManagedNamespace(ns)) return null;
  await initCacheManager();
  const key = toStorageKey(ns, sl);
  const value = await readPersistentKey(key);
  if (value === READ_FAILED) {
    if (mirrorByKey.has(key)) return cloneValue(mirrorByKey.get(key)) as TValue;
    return null;
  }
  if (value == null) {
    if (optimisticWriteSeqByKey.has(key) && mirrorByKey.has(key)) {
      return cloneValue(mirrorByKey.get(key)) as TValue;
    }
    removeMirrorValue(ns, sl);
    return null;
  }
  if (optimisticWriteSeqByKey.has(key) && mirrorByKey.has(key)) {
    return cloneValue(mirrorByKey.get(key)) as TValue;
  }
  setMirrorValue(ns, sl, value);
  return cloneValue(value) as TValue;
};

const writeCacheDirect = async ({ namespace, slug, key, value }: ManagedWriteInput): Promise<boolean> => {
  await initCacheManager();
  const ok = await persistKey(key, value);
  if (!ok) return false;
  commitManagedWrite({ namespace, slug, key, value });
  return true;
};

export const writeCache = async (
  namespace: unknown,
  slug: unknown = '',
  value: CacheValue = null,
): Promise<boolean> => {
  const ns = String(namespace || '');
  const sl = String(slug || '');
  if (!isManagedNamespace(ns)) return false;
  const key = toStorageKey(ns, sl);
  return enqueueWriteTaskForStorageKey(key, async () => writeCacheDirect({ namespace: ns, slug: sl, key, value }));
};

// Optimistic write for read-after-write flows that intentionally do not await persistence.
// Mirror is updated synchronously, then rolled back if persistence fails.
export const writeCacheOptimistic = (namespace: unknown, slug: unknown = '', value: CacheValue = null): Promise<boolean> => {
  const ns = String(namespace || '');
  const sl = String(slug || '');
  if (!isManagedNamespace(ns)) return Promise.resolve(false);

  const key = toStorageKey(ns, sl);
  const hadPrevious = mirrorByKey.has(key);
  const previousValue = hadPrevious ? cloneValue(mirrorByKey.get(key)) : null;
  const writeSeq = (optimisticWriteSeqCounter += 1);
  optimisticWriteSeqByKey.set(key, writeSeq);
  setMirrorValue(ns, sl, value);

  const restoreMirrorFromSnapshot = (
    snapshotValue: CacheValue | null | typeof READ_FAILED,
    { restorePreviousWhenEmpty = false }: { restorePreviousWhenEmpty?: boolean } = {},
  ): boolean => {
    if (snapshotValue === READ_FAILED) return false;
    if (snapshotValue == null) {
      if (restorePreviousWhenEmpty && hadPrevious) {
        setMirrorValue(ns, sl, previousValue);
        return true;
      }
      removeMirrorValue(ns, sl);
      return true;
    }
    setMirrorValue(ns, sl, snapshotValue);
    return true;
  };

  const rollback = async ({
    persistedSnapshot = READ_FAILED,
  }: {
    persistedSnapshot?: CacheValue | null | typeof READ_FAILED;
  } = {}): Promise<void> => {
    if (optimisticWriteSeqByKey.get(key) !== writeSeq) return;

    let restored = restoreMirrorFromSnapshot(persistedSnapshot, { restorePreviousWhenEmpty: true });
    if (!restored) {
      try {
        const persisted = await readPersistentKey(key);
        if (optimisticWriteSeqByKey.get(key) !== writeSeq) return;
        restored = restoreMirrorFromSnapshot(persisted, { restorePreviousWhenEmpty: true });
      } catch (_) {
        restored = false;
      }
    }
    if (!restored) {
      if (hadPrevious) setMirrorValue(ns, sl, previousValue);
      else removeMirrorValue(ns, sl);
    }
    optimisticWriteSeqByKey.delete(key);
  };

  const settle = (): void => {
    if (optimisticWriteSeqByKey.get(key) === writeSeq) {
      optimisticWriteSeqByKey.delete(key);
    }
  };

  const run = enqueueWriteTaskForStorageKey(key, async () => {
    await initCacheManager();
    const persistedBeforeWrite = await readPersistentKey(key);
    const ok = await persistKey(key, value);
    if (!ok) {
      await rollback({ persistedSnapshot: persistedBeforeWrite });
      return false;
    }
    if (optimisticWriteSeqByKey.get(key) !== writeSeq) {
      return true;
    }
    commitManagedWrite({ namespace: ns, slug: sl, key, value });
    settle();
    return true;
  });

  return run.catch(async (error) => {
    await rollback();
    throw error;
  });
};

export const updateCacheAtomic = async <TValue = CacheLegacyNode>(
  namespace: unknown,
  slug: unknown = '',
  updater: (current: TValue | null) => TValue | Promise<TValue> = (current) => current as TValue,
): Promise<TValue | null> => {
  const ns = String(namespace || '');
  const sl = String(slug || '');
  if (!isManagedNamespace(ns)) return null;
  if (typeof updater !== 'function') throw new Error('updateCacheAtomic requires an updater function');
  await initCacheManager();

  const key = toStorageKey(ns, sl);
  return enqueueWriteTaskForStorageKey(key, async () => {
    const current = cloneValue(mirrorByKey.get(key)) as TValue | undefined;
    const next = await updater(current == null ? null : current);
    const ok = await writeCacheDirect({ namespace: ns, slug: sl, key, value: next });
    if (!ok) {
      throw new Error(`[cacheScripts] Failed to persist atomic update for ${key}`);
    }
    return cloneValue(next) as TValue;
  });
};

const removeCacheDirect = async ({ namespace, slug, key }: ManagedKeyInput): Promise<boolean> => {
  await initCacheManager();
  const ok = await deleteKey(key);
  if (!ok) return false;
  removeMirrorValue(namespace, slug);
  emitUpdate({
    action: 'remove',
    namespace,
    slug,
    key,
    source: 'local',
  });
  broadcastUpdate({
    action: 'remove',
    namespace,
    slug,
    key,
  });
  return true;
};

export const removeCache = async (namespace: unknown, slug: unknown = ''): Promise<boolean> => {
  const ns = String(namespace || '');
  const sl = String(slug || '');
  if (!isManagedNamespace(ns)) return false;
  const key = toStorageKey(ns, sl);
  return enqueueWriteTaskForStorageKey(key, async () => removeCacheDirect({ namespace: ns, slug: sl, key }));
};

export const peekCacheSync = <TValue = CacheLegacyNode>(
  namespace: unknown,
  slug: unknown = '',
  options: CachePeekOptions = {},
): TValue | null => {
  const ns = String(namespace || '');
  const sl = String(slug || '');
  if (!isManagedNamespace(ns)) return null;
  const key = toStorageKey(ns, sl);
  if (!mirrorByKey.has(key)) return null;
  const shouldClone = options?.clone !== false;
  const value = mirrorByKey.get(key);
  return (shouldClone ? cloneValue(value) : value) as TValue;
};

export const hasNamespaceEntriesSync = (namespace: unknown): boolean => {
  const ns = String(namespace || '');
  if (!isManagedNamespace(ns)) return false;
  const bucket = getNamespaceBucket(ns);
  return bucket.size > 0;
};

export const listNamespaceSlugsSync = (namespace: unknown): string[] => {
  const ns = String(namespace || '');
  if (!isManagedNamespace(ns)) return [];
  const bucket = getNamespaceBucket(ns);
  return Array.from(bucket.keys()).map((slug) => String(slug || ''));
};

export const listNamespaceEntriesSync = <TValue = CacheLegacyNode>(
  namespace: unknown,
  options: CacheListOptions = {},
): CacheEntry<TValue>[] => {
  const ns = String(namespace || '');
  if (!isManagedNamespace(ns)) return [];
  const bucket = getNamespaceBucket(ns);
  const shouldCloneValues = options?.cloneValues !== false;
  return Array.from(bucket.entries()).map(([slug, value]) => ({
    namespace: ns,
    slug: String(slug || ''),
    key: toStorageKey(ns, slug),
    value: (shouldCloneValues ? cloneValue(value) : value) as TValue,
  }));
};

export const getCacheBackendDiagnostics = (): CacheBackendDiagnostics => {
  const probeState = backendReadyPromise ? (didHydrateMirror ? 'ready' : 'probing') : 'unprobed';
  const persistentBackend = probeState === 'unprobed' ? 'unknown' : idbAvailable ? 'indexeddb' : 'localstorage';
  return {
    persistentBackend,
    probeState,
    idbAvailable: !!idbAvailable,
    didHydrateMirror: !!didHydrateMirror,
    recoveryInFlight: !!idbRecoveryPromise,
  };
};

export const subscribeCacheUpdates = (handler: CacheUpdateHandler): (() => void) => {
  if (typeof handler !== 'function') return () => {};
  subscribers.add(handler);
  return () => {
    subscribers.delete(handler);
  };
};
