import { createLogger } from 'utilities/logging.js';
import { peekCacheSync, removeCache, writeCacheOptimistic } from '../../utilities/cache/cacheScripts.js';
import { DG_MANAGED_CACHE_NAMES } from './sessionCacheConstants.js';
import {
  evictOldDgEntries,
  removeDgMetaTimestamp,
  trimLargeArrays,
  updateDgMetaTimestamp,
} from './sessionCacheEviction.js';
import {
  bumpMainSitePerfCounter,
  getMainSitePerfNow,
  isMainSitePerfCountersEnabled,
} from '../session/mainSiteUtils.js';

export interface MainSiteDgStorage {
  key: (name: string, slug: string) => string;
  read: (name: string, slug: string, options?: Record<string, unknown>) => unknown;
  write: (name: string, slug: string, obj: unknown) => Promise<boolean>;
  remove: (name: string, slug: string) => Promise<void>;
  destroy: () => void;
}

const log = createLogger('mainSiteDgStorage');

const isManagedDgCacheName = (name: unknown): boolean => DG_MANAGED_CACHE_NAMES.has(String(name || ''));

export const createMainSiteDgStorage = (): MainSiteDgStorage => {
  const lastWrittenJsonByKey: Map<string, string> = new Map();

  const key = (name: string, slug: string): string => `dg:${name}:${slug}`;

  const read = (name: string, slug: string, options: Record<string, unknown> = {}): unknown => {
    if (isManagedDgCacheName(name)) {
      return peekCacheSync(name, slug, options);
    }
    try {
      return JSON.parse(localStorage.getItem(`dg:${name}:${slug}`) || 'null');
    } catch (e: unknown) {
      return null;
    }
  };

  const write = (name: string, slug: string, obj: unknown): Promise<boolean> => {
    const storageKey = `dg:${name}:${slug}`;
    if (isManagedDgCacheName(name)) {
      return writeCacheOptimistic(name, slug, obj as Parameters<typeof writeCacheOptimistic>[2])
        .then((ok: boolean) => {
          if (!ok) {
            log.warn('[MainSite] DG.write managed cache persist failed', {
              storageKey,
              error: 'write returned false',
            });
          }
          return ok;
        })
        .catch((e: unknown) => {
          log.warn('[MainSite] DG.write managed cache persist failed', {
            storageKey,
            error: (e as { message?: string })?.message || e,
          });
          return false;
        });
    }

    const perfEnabled = isMainSitePerfCountersEnabled();
    const perfStartedAt = perfEnabled ? getMainSitePerfNow() : 0;
    const finalizePerf = (resultKey = ''): void => {
      if (!perfEnabled) return;
      if (resultKey) bumpMainSitePerfCounter(resultKey);
      const elapsed = Math.max(0, Number(getMainSitePerfNow()) - Number(perfStartedAt || 0));
      bumpMainSitePerfCounter('dgWriteNonManagedDurationMsTotal', elapsed);
      bumpMainSitePerfCounter('dgWriteNonManagedDurationSamples', 1);
    };
    if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedCalls');

    let ok = true;
    let serialized: string | null = null;
    try {
      serialized = JSON.stringify(obj);
      if (perfEnabled && serialized !== undefined) {
        bumpMainSitePerfCounter('dgWriteNonManagedSerializedBytes', serialized.length);
      }
    } catch (e: unknown) {
      log.error('[MainSite] DG.write JSON stringify failed', e);
      finalizePerf('dgWriteNonManagedStringifyFailure');
      return Promise.resolve(false);
    }
    try {
      const lastWritten = lastWrittenJsonByKey.get(storageKey);
      let persistedValue: string | null = null;
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
    } catch (e: unknown) {
      log.warn('MainSite: fallback', e);
    }

    try {
      if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedSetItemAttempts');
      localStorage.setItem(storageKey, serialized);
      lastWrittenJsonByKey.set(storageKey, serialized);
      updateDgMetaTimestamp(storageKey);
    } catch (e: unknown) {
      const errorLike = e as { name?: string; code?: number };
      const isQuotaExceeded =
        errorLike?.name === 'QuotaExceededError' || errorLike?.code === 22 || errorLike?.code === 1014;

      if (isQuotaExceeded) {
        if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedQuotaRetryCount');
        try {
          evictOldDgEntries();
        } catch (e: unknown) {
          log.warn('MainSite: fallback', e);
        }
        let trimmed: unknown = obj;
        let trimmedSerialized = serialized;
        try {
          trimmed = JSON.parse(JSON.stringify(obj)) as unknown;
          trimLargeArrays(trimmed);
          trimmedSerialized = JSON.stringify(trimmed);
        } catch (e: unknown) {
          log.warn('MainSite: fallback', e);
        }

        try {
          if (perfEnabled) bumpMainSitePerfCounter('dgWriteNonManagedSetItemAttempts');
          localStorage.setItem(storageKey, trimmedSerialized);
          lastWrittenJsonByKey.set(storageKey, trimmedSerialized);
          updateDgMetaTimestamp(storageKey);
          log.warn('[MainSite] DG.write succeeded after eviction/trim for key:', storageKey);
          finalizePerf('dgWriteNonManagedQuotaRetrySuccess');
          return Promise.resolve(true);
        } catch (retryError: unknown) {
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

  const remove = (name: string, slug: string): Promise<void> => {
    const storageKey = `dg:${name}:${slug}`;
    if (isManagedDgCacheName(name)) {
      return removeCache(name, slug)
        .then(() => undefined)
        .catch((e: unknown) => {
          log.warn('[MainSite] DG.remove managed cache persist failed', {
            storageKey,
            error: (e as { message?: string })?.message || e,
          });
        });
    }
    try {
      localStorage.removeItem(storageKey);
    } catch (e: unknown) {
      log.warn('[MainSite] DG.remove localStorage failed', e);
    }
    lastWrittenJsonByKey.delete(storageKey);
    removeDgMetaTimestamp(storageKey);
    return Promise.resolve();
  };

  const destroy = (): void => {
    lastWrittenJsonByKey.clear();
  };

  return { key, read, write, remove, destroy };
};
