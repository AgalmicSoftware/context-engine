import { readCache } from '../../utilities/cache/cacheScripts.js';
import { DG_PRIMARY_ROUTE_CACHE_NAMES } from '../../components/MainSite/cacheConstants.js';
import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { createLogger } from 'utilities/logging.js';

const log = createLogger('sessionCachePersistenceController');

export const createSessionCachePersistenceController = (host = {}) => {
  const cacheHasLoadedSyncInFlight = new Map();
  const cacheHasLoadedSyncTokenBySlug = new Map();

  const readFlag = (name, slug) => {
    try {
      return !!host.dgRead?.(name, slug);
    } catch (_) {
      return false;
    }
  };

  const writeFlag = (name, slug, val) => {
    host.dgWrite?.(name, slug, !!val);
  };

  const hasPersistedManagedCacheData = async (slugIn) => {
    const slug = normalizeSessionSlug(slugIn || '');
    try {
      const entries = await Promise.all(
        DG_PRIMARY_ROUTE_CACHE_NAMES.map((namespace) => readCache(namespace, slug))
      );
      return entries.some((entry) => entry != null);
    } catch (error) {
      log.warn('[MainSite] Failed to verify persisted cache state', {
        slug,
        error: error?.message || error,
      });
      return false;
    }
  };

  const syncCacheHasLoadedFlagFromPersistent = (slugIn, opts = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const force = !!opts.force;
    if (!force && cacheHasLoadedSyncInFlight.has(slug)) {
      return cacheHasLoadedSyncInFlight.get(slug);
    }

    const runToken = Symbol(`cacheHasLoadedSync:${slug}`);
    cacheHasLoadedSyncTokenBySlug.set(slug, runToken);
    const run = (async () => {
      const persisted = await hasPersistedManagedCacheData(slug);
      if (cacheHasLoadedSyncTokenBySlug.get(slug) !== runToken) {
        return persisted;
      }
      writeFlag('cacheHasLoaded', slug, persisted);

      if (
        host.isMounted?.() &&
        String(host.getActiveSlug?.() || '') === String(slug || '')
      ) {
        host.setState?.((prev) => (
          prev.cacheHasLoaded === persisted ? null : { cacheHasLoaded: persisted }
        ));
      }

      return persisted;
    })();

    cacheHasLoadedSyncInFlight.set(slug, run);
    run.finally(() => {
      if (cacheHasLoadedSyncInFlight.get(slug) === run) {
        cacheHasLoadedSyncInFlight.delete(slug);
      }
    });
    return run;
  };

  const destroy = () => {
    cacheHasLoadedSyncInFlight.clear();
  };

  return {
    readFlag,
    writeFlag,
    hasPersistedManagedCacheData,
    syncCacheHasLoadedFlagFromPersistent,
    destroy,
  };
};
