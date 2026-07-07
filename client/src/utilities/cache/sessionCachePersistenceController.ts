import { readCache } from '../../utilities/cache/cacheScripts.js';
import { DG_PRIMARY_ROUTE_CACHE_NAMES } from './sessionCacheConstants.js';
import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import { createLogger } from 'utilities/logging.js';

const log = createLogger('sessionCachePersistenceController');

export interface SessionCachePersistenceHost {
  dgRead?: (name: string, slug: string) => unknown;
  dgWrite?: (name: string, slug: string, value: boolean) => void;
  isMounted?: () => boolean;
  getActiveSlug?: () => string;
  setState?: (
    updater: (prev: Record<string, unknown>) => Record<string, unknown> | null,
    callback?: () => void,
  ) => void;
}

export interface SessionCachePersistenceController {
  readFlag: (name: string, slug: string) => boolean;
  writeFlag: (name: string, slug: string, val: unknown) => void;
  hasPersistedManagedCacheData: (slugIn: string) => Promise<boolean>;
  syncCacheHasLoadedFlagFromPersistent: (slugIn: string, opts?: { force?: boolean }) => Promise<boolean>;
  destroy: () => void;
}

export const createSessionCachePersistenceController = (
  host: SessionCachePersistenceHost = {},
): SessionCachePersistenceController => {
  const cacheHasLoadedSyncInFlight: Map<string, Promise<boolean>> = new Map();
  const cacheHasLoadedSyncTokenBySlug: Map<string, symbol> = new Map();

  const readFlag = (name: string, slug: string): boolean => {
    try {
      return !!host.dgRead?.(name, slug);
    } catch (_) {
      return false;
    }
  };

  const writeFlag = (name: string, slug: string, val: unknown): void => {
    host.dgWrite?.(name, slug, !!val);
  };

  const hasPersistedManagedCacheData = async (slugIn: string): Promise<boolean> => {
    const slug = normalizeSessionSlug(slugIn || '');
    try {
      const entries = await Promise.all(DG_PRIMARY_ROUTE_CACHE_NAMES.map((namespace) => readCache(namespace, slug)));
      return entries.some((entry) => entry != null);
    } catch (error: unknown) {
      log.warn('[MainSite] Failed to verify persisted cache state', {
        slug,
        error: (error as { message?: string })?.message || error,
      });
      return false;
    }
  };

  const syncCacheHasLoadedFlagFromPersistent = (slugIn: string, opts: { force?: boolean } = {}): Promise<boolean> => {
    const slug = normalizeSessionSlug(slugIn || '');
    const force = !!opts.force;
    if (!force && cacheHasLoadedSyncInFlight.has(slug)) {
      return cacheHasLoadedSyncInFlight.get(slug)!;
    }

    const runToken = Symbol(`cacheHasLoadedSync:${slug}`);
    cacheHasLoadedSyncTokenBySlug.set(slug, runToken);
    const run = (async (): Promise<boolean> => {
      const persisted = await hasPersistedManagedCacheData(slug);
      if (cacheHasLoadedSyncTokenBySlug.get(slug) !== runToken) {
        return persisted;
      }
      writeFlag('cacheHasLoaded', slug, persisted);

      if (host.isMounted?.() && String(host.getActiveSlug?.() || '') === String(slug || '')) {
        host.setState?.((prev) => (prev.cacheHasLoaded === persisted ? null : { cacheHasLoaded: persisted }));
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

  const destroy = (): void => {
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
