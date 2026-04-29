import { createLogger } from 'utilities/logging.js';
import {
  peekCacheSync,
  removeCache,
  writeCacheOptimistic,
} from '../../utilities/cache/cacheScripts.js';
import { DG_MANAGED_CACHE_NAMES } from '../../components/MainSite/cacheConstants.js';
import {
  evictOldDgEntries,
  removeDgMetaTimestamp,
  trimLargeArrays,
  updateDgMetaTimestamp,
} from '../../components/MainSite/storageEviction.js';
import {
  bumpMainSitePerfCounter,
  getMainSitePerfNow,
  isMainSitePerfCountersEnabled,
} from '../../components/MainSite/mainSiteUtils.js';

const log = createLogger('mainSiteDgStorage');

const isManagedDgCacheName = (name) => DG_MANAGED_CACHE_NAMES.has(String(name || ''));

export const createMainSiteDgStorage = () => {
  const lastWrittenJsonByKey = new Map();

  const key = (name, slug) => `dg:${name}:${slug}`;

  const read = (name, slug, options = {}) => {
    if (isManagedDgCacheName(name)) {
      return peekCacheSync(name, slug, options);
    }
    try { return JSON.parse(localStorage.getItem(`dg:${name}:${slug}`) || 'null'); } catch { return null; }
  };

  const write = (name, slug, obj) => {
    const storageKey = `dg:${name}:${slug}`;
    if (isManagedDgCacheName(name)) {
      return writeCacheOptimistic(name, slug, obj)
        .then((ok) => {
          if (!ok) {
            log.warn('[MainSite] DG.write managed cache persist failed', { storageKey, error: 'write returned false' });
          }
          return ok;
        })
        .catch((e) => {
          log.warn('[MainSite] DG.write managed cache persist failed', { storageKey, error: e?.message || e });
          return false;
        });
    }

    const perfEnabled = isMainSitePerfCountersEnabled();
    const perfStartedAt = perfEnabled ? getMainSitePerfNow() : 0;
    const finalizePerf = (resultKey = '') => {
      if (!perfEnabled) return;
      if (resultKey) bumpMainSitePerfCounter(resultKey);
      const elapsed = Math.max(0, Number(getMainSitePerfNow()) - Number(perfStartedAt || 0));
      bumpMainSitePerfCounter('dgWriteNonManagedDurationMsTotal', elapsed);
      bumpMainSitePerfCounter('dgWriteNonManagedDurationSamples', 1);
    };
    if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedCalls');

    let ok = true;
    let serialized = null;
    try {
      serialized = JSON.stringify(obj);
      if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedSerializedBytes', serialized.length);
    } catch (e) {
      log.error('[MainSite] DG.write JSON stringify failed', e);
      finalizePerf('dgWriteNonManagedStringifyFailure');
      return Promise.resolve(false);
    }
    try {
      const lastWritten = lastWrittenJsonByKey.get(storageKey);
      let persistedValue = null;
      let didReadPersistedValue = false;

      if (lastWritten === serialized) {
        // Fast path with safety: verify persistence in case localStorage was cleared/evicted externally.
        persistedValue = localStorage.getItem(storageKey);
        didReadPersistedValue = true;
        if (persistedValue === serialized) {
          updateDgMetaTimestamp(storageKey);
          finalizePerf('dgWriteNonManagedSkipBySnapshot');
          return Promise.resolve(true);
        }
        lastWrittenJsonByKey.delete(storageKey);
      }

      if (!didReadPersistedValue) {
        persistedValue = localStorage.getItem(storageKey);
      }
      if (persistedValue === serialized) {
        lastWrittenJsonByKey.set(storageKey, serialized);
        updateDgMetaTimestamp(storageKey);
        finalizePerf('dgWriteNonManagedSkipByStorageMatch');
        return Promise.resolve(true);
      }
    } catch (e) { log.warn('MainSite: fallback', e); }

    try {
      if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedSetItemAttempts');
      localStorage.setItem(storageKey, serialized);
      lastWrittenJsonByKey.set(storageKey, serialized);
      updateDgMetaTimestamp(storageKey);
    } catch (e) {
      const isQuotaExceeded =
        e?.name === 'QuotaExceededError' ||
        e?.code === 22 ||
        e?.code === 1014;

      if (isQuotaExceeded) {
        if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedQuotaRetryCount');
        try { evictOldDgEntries(); } catch (e) { log.warn('MainSite: fallback', e); }
        let trimmed = obj;
        let trimmedSerialized = serialized;
        try {
          trimmed = JSON.parse(JSON.stringify(obj));
          trimLargeArrays(trimmed);
          trimmedSerialized = JSON.stringify(trimmed);
        } catch (e) { log.warn('MainSite: fallback', e); }

        try {
          if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedSetItemAttempts');
          localStorage.setItem(storageKey, trimmedSerialized);
          lastWrittenJsonByKey.set(storageKey, trimmedSerialized);
          updateDgMetaTimestamp(storageKey);
          log.warn('[MainSite] DG.write succeeded after eviction/trim for key:', storageKey);
          finalizePerf('dgWriteNonManagedQuotaRetrySuccess');
          return Promise.resolve(true);
        } catch (retryError) {
          log.error('[MainSite] DG.write localStorage failed after eviction/trim', retryError);
          finalizePerf('dgWriteNonManagedQuotaRetryFailure');
          return Promise.resolve(false);
        }
      }

      log.error('[MainSite] DG.write localStorage failed', e);
      ok = false;
    }
    finalizePerf(ok ? 'dgWriteNonManagedWriteSuccess' : 'dgWriteNonManagedWriteFailure');
    return Promise.resolve(ok);
  };

  const remove = (name, slug) => {
    const storageKey = `dg:${name}:${slug}`;
    if (isManagedDgCacheName(name)) {
      return removeCache(name, slug).catch((e) => {
        log.warn('[MainSite] DG.remove managed cache persist failed', { storageKey, error: e?.message || e });
      });
    }
    try {
      localStorage.removeItem(storageKey);
    } catch (e) {
      log.warn('[MainSite] DG.remove localStorage failed', e);
    }
    lastWrittenJsonByKey.delete(storageKey);
    removeDgMetaTimestamp(storageKey);
    return Promise.resolve();
  };

  const destroy = () => {
    lastWrittenJsonByKey.clear();
  };

  return { key, read, write, remove, destroy };
};
