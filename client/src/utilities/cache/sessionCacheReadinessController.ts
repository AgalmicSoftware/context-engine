import { createLogger } from 'utilities/logging.js';
import { recordCeRuntimeCacheEvent } from '../../utilities/ui/uiRuntimeStats.js';
import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';

type CacheInitMode = 'auto' | 'partial' | 'full';

export interface SessionCacheReadinessHost {
  getState?: () => Record<string, unknown>;
  setState?: (updater: (prev: Record<string, unknown>) => Record<string, unknown> | null, cb?: () => void) => void;
  isMounted?: () => boolean;
  resolveActiveSlug?: () => string;
  getSessionSlugFromState?: () => string;
  getCurrentPathname?: () => string;
  checkAllCachesReady?: () => void;
  syncCacheHasLoadedFlagFromPersistent?: (slug: string, opts: { force: boolean }) => Promise<boolean>;
  isInitInFlight?: (slug: string) => { question?: boolean; survey?: boolean; response?: boolean } | null;
  readFlag?: (name: string, slug: string) => unknown;
  shouldAutoRunFullSbtScan?: (opts: { pathname: string }) => boolean;
  initializeSbtCache?: (opts: { mode: CacheInitMode }) => Promise<unknown>;
  startSbtEventListener?: () => unknown;
}

interface CacheUpdateFlags {
  needsSbtRevision: boolean;
  needsQuestionResponsesNonce: boolean;
}

export interface SessionCacheReadinessController {
  setReadinessStateIfChanged: (nextState: Record<string, unknown> | null | undefined, cb?: () => void) => boolean;
  checkAllCachesReady: () => void;
  syncCacheHasLoadedFlagOnTransition: (
    slug: string,
    opts?: { force?: boolean; isAllReady?: boolean },
  ) => Promise<boolean>;
  clearCacheUpdateFlushSchedule: () => void;
  scheduleCacheUpdateFlush: () => void;
  queueCacheUpdateFlush: (opts?: {
    slug?: string;
    needsSbtRevision?: boolean;
    needsQuestionResponsesNonce?: boolean;
  }) => void;
  flushQueuedCacheUpdates: () => void;
  clearLocalRevisionFlushSchedule: () => void;
  scheduleLocalRevisionFlush: () => void;
  queueLocalRevisionUpdate: (opts?: {
    needsSbtRevision?: boolean;
    needsQuestionResponsesNonce?: boolean;
    checkAllCachesReady?: boolean;
  }) => void;
  flushLocalRevisionUpdate: () => void;
  handleCrossTabCacheUpdateEvent: (evt: { namespace?: string; slug?: string; source?: string }) => void;
  destroy: () => void;
}

type StateRecord = Record<string, unknown>;
type ReadinessEvent = { namespace?: string; slug?: string; source?: string };

const log = createLogger('cacheReadinessCtrl');

const createDefaultCacheUpdateFlags = (): CacheUpdateFlags => ({
  needsSbtRevision: false,
  needsQuestionResponsesNonce: false,
});

export const createSessionCacheReadinessController = (
  host: SessionCacheReadinessHost = {},
): SessionCacheReadinessController => {
  let pendingReadinessValues: Map<string, unknown> = new Map();
  let pendingCacheUpdateSlug: string | null = null;
  let pendingCacheUpdateFlags: CacheUpdateFlags = createDefaultCacheUpdateFlags();
  let cacheUpdateFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let cacheUpdateFlushRaf: number | null = null;
  let pendingLocalRevisionFlags: CacheUpdateFlags = createDefaultCacheUpdateFlags();
  let pendingLocalRevisionCheckAllCachesReady: boolean = false;
  let localRevisionFlushTimer: ReturnType<typeof setTimeout> | null = null;
  let localRevisionFlushRaf: number | null = null;
  let lastCacheHasLoadedSyncSlug: string = '';
  let lastCacheHasLoadedSyncIsAllReady: boolean | null = null;

  const getState = (): StateRecord => (typeof host.getState === 'function' ? host.getState() || {} : {});

  const setState = (updater: (prev: StateRecord) => StateRecord | null, cb?: () => void): void => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };

  const isMounted = (): boolean => (typeof host.isMounted === 'function' ? !!host.isMounted() : false);

  const resolveActiveSlug = (): string =>
    String(typeof host.resolveActiveSlug === 'function' ? host.resolveActiveSlug() || '' : '');

  const resolveStateSlug = (): string =>
    String(
      typeof host.getSessionSlugFromState === 'function' ? host.getSessionSlugFromState() || '' : resolveActiveSlug(),
    );

  const getCurrentPathname = (): string =>
    String(typeof host.getCurrentPathname === 'function' ? host.getCurrentPathname() || '' : '');

  const callHostCheckAllCachesReady = (): void => {
    if (typeof host.checkAllCachesReady === 'function') host.checkAllCachesReady();
  };

  const clearCacheUpdateFlushSchedule = (): void => {
    try {
      if (
        cacheUpdateFlushRaf != null &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(cacheUpdateFlushRaf);
      }
    } catch (e) {
      log.warn('sessionCacheReadinessController: cleanup', e);
    }
    cacheUpdateFlushRaf = null;
    try {
      if (cacheUpdateFlushTimer) clearTimeout(cacheUpdateFlushTimer);
    } catch (e) {
      log.warn('sessionCacheReadinessController: cleanup', e);
    }
    cacheUpdateFlushTimer = null;
  };

  const flushQueuedCacheUpdates = (): void => {
    const pendingSlug = String(pendingCacheUpdateSlug || '');
    const flags = pendingCacheUpdateFlags;
    if (!flags.needsSbtRevision && !flags.needsQuestionResponsesNonce) return;
    pendingCacheUpdateFlags = createDefaultCacheUpdateFlags();
    pendingCacheUpdateSlug = null;
    if (!isMounted()) return;
    const activeSlug = resolveActiveSlug();
    if (pendingSlug !== activeSlug) return;
    setState((prev) => {
      const next: StateRecord = {};
      if (flags.needsSbtRevision) {
        next.sbtCacheRevision = Number(prev.sbtCacheRevision ?? 0) + 1;
      }
      if (flags.needsQuestionResponsesNonce) {
        next.isResponsesCacheReady = true;
        next.questionResponsesNonce = Number(prev.questionResponsesNonce ?? 0) + 1;
      }
      return next;
    }, callHostCheckAllCachesReady);
  };

  const scheduleCacheUpdateFlush = (): void => {
    if (cacheUpdateFlushRaf != null || cacheUpdateFlushTimer) return;
    const flush = (): void => {
      cacheUpdateFlushRaf = null;
      cacheUpdateFlushTimer = null;
      flushQueuedCacheUpdates();
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      cacheUpdateFlushRaf = window.requestAnimationFrame(flush);
      return;
    }
    cacheUpdateFlushTimer = setTimeout(flush, 16);
  };

  const queueCacheUpdateFlush = ({
    slug = '',
    needsSbtRevision = false,
    needsQuestionResponsesNonce = false,
  }: {
    slug?: string;
    needsSbtRevision?: boolean;
    needsQuestionResponsesNonce?: boolean;
  } = {}): void => {
    const nextSlug = String(slug || '');
    const pendingSlug = pendingCacheUpdateSlug == null ? null : String(pendingCacheUpdateSlug || '');
    if (pendingSlug !== null && pendingSlug !== nextSlug) {
      pendingCacheUpdateFlags = createDefaultCacheUpdateFlags();
    }
    pendingCacheUpdateSlug = nextSlug;
    if (needsSbtRevision) pendingCacheUpdateFlags.needsSbtRevision = true;
    if (needsQuestionResponsesNonce) pendingCacheUpdateFlags.needsQuestionResponsesNonce = true;
    scheduleCacheUpdateFlush();
  };

  const clearLocalRevisionFlushSchedule = (): void => {
    try {
      if (
        localRevisionFlushRaf != null &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(localRevisionFlushRaf);
      }
    } catch (e) {
      log.warn('sessionCacheReadinessController: cleanup', e);
    }
    localRevisionFlushRaf = null;
    try {
      if (localRevisionFlushTimer) clearTimeout(localRevisionFlushTimer);
    } catch (e) {
      log.warn('sessionCacheReadinessController: cleanup', e);
    }
    localRevisionFlushTimer = null;
  };

  const flushLocalRevisionUpdate = (): void => {
    const flags = pendingLocalRevisionFlags;
    const shouldCheckAllCachesReady = !!pendingLocalRevisionCheckAllCachesReady;
    if (!flags.needsSbtRevision && !flags.needsQuestionResponsesNonce) {
      pendingLocalRevisionCheckAllCachesReady = false;
      if (shouldCheckAllCachesReady && isMounted()) callHostCheckAllCachesReady();
      return;
    }
    pendingLocalRevisionFlags = createDefaultCacheUpdateFlags();
    pendingLocalRevisionCheckAllCachesReady = false;
    if (!isMounted()) return;
    setState(
      (prev) => {
        const next: StateRecord = {};
        if (flags.needsSbtRevision) {
          next.sbtCacheRevision = Number(prev.sbtCacheRevision ?? 0) + 1;
        }
        if (flags.needsQuestionResponsesNonce) {
          next.questionResponsesNonce = Number(prev.questionResponsesNonce ?? 0) + 1;
        }
        return next;
      },
      () => {
        if (shouldCheckAllCachesReady) callHostCheckAllCachesReady();
      },
    );
  };

  const scheduleLocalRevisionFlush = (): void => {
    if (localRevisionFlushRaf != null || localRevisionFlushTimer) return;
    const flush = (): void => {
      localRevisionFlushRaf = null;
      localRevisionFlushTimer = null;
      flushLocalRevisionUpdate();
    };
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      localRevisionFlushRaf = window.requestAnimationFrame(flush);
      return;
    }
    localRevisionFlushTimer = setTimeout(flush, 16);
  };

  const queueLocalRevisionUpdate = ({
    needsSbtRevision = false,
    needsQuestionResponsesNonce = false,
    checkAllCachesReady: shouldCheckAllCachesReady = false,
  }: {
    needsSbtRevision?: boolean;
    needsQuestionResponsesNonce?: boolean;
    checkAllCachesReady?: boolean;
  } = {}): void => {
    if (needsSbtRevision) pendingLocalRevisionFlags.needsSbtRevision = true;
    if (needsQuestionResponsesNonce) {
      pendingLocalRevisionFlags.needsQuestionResponsesNonce = true;
    }
    if (shouldCheckAllCachesReady) pendingLocalRevisionCheckAllCachesReady = true;
    scheduleLocalRevisionFlush();
  };

  const setReadinessStateIfChanged = (nextState: StateRecord | null | undefined, cb?: () => void): boolean => {
    if (!nextState || typeof nextState !== 'object') {
      if (typeof cb === 'function') cb();
      return false;
    }
    const keys = Object.keys(nextState);
    if (!keys.length) {
      if (typeof cb === 'function') cb();
      return false;
    }
    const finalize = (): void => {
      const currentState = getState();
      keys.forEach((key) => {
        if (!pendingReadinessValues.has(key)) return;
        if (currentState[key] === pendingReadinessValues.get(key)) {
          pendingReadinessValues.delete(key);
        }
      });
      if (typeof cb === 'function') cb();
    };
    const queueWrite = (): void => {
      keys.forEach((key) => {
        pendingReadinessValues.set(key, nextState[key]);
      });
      setState((prev) => {
        const shouldApply = keys.some((key) => prev[key] !== nextState[key]);
        return shouldApply ? nextState : null;
      }, finalize);
    };
    const currentState = getState();
    const hasChange = keys.some((key) => {
      const baseline = pendingReadinessValues.has(key) ? pendingReadinessValues.get(key) : currentState[key];
      return baseline !== nextState[key];
    });
    if (!hasChange) {
      const hasPendingCommit = keys.some(
        (key) => pendingReadinessValues.has(key) && currentState[key] !== pendingReadinessValues.get(key),
      );
      if (hasPendingCommit) {
        queueWrite();
        return false;
      }
      if (typeof cb === 'function') cb();
      return false;
    }
    queueWrite();
    return true;
  };

  const syncCacheHasLoadedFlagOnTransition = (
    slugIn: string,
    opts: { force?: boolean; isAllReady?: boolean } = {},
  ): Promise<boolean> => {
    const slug = normalizeSessionSlug(slugIn || '');
    const forceRequested = !!opts.force;
    const hasReadyHint = Object.prototype.hasOwnProperty.call(opts, 'isAllReady');
    const readyHint = hasReadyHint ? !!opts.isAllReady : null;
    const slugChanged = lastCacheHasLoadedSyncSlug !== slug;
    const readinessChanged = hasReadyHint && lastCacheHasLoadedSyncIsAllReady !== readyHint;
    if (!forceRequested && !slugChanged && !readinessChanged) {
      return Promise.resolve(false);
    }
    const shouldForceSync = forceRequested || (hasReadyHint && readinessChanged && readyHint === true);
    lastCacheHasLoadedSyncSlug = slug;
    if (hasReadyHint) {
      lastCacheHasLoadedSyncIsAllReady = readyHint;
    }
    if (typeof host.syncCacheHasLoadedFlagFromPersistent !== 'function') {
      return Promise.resolve(false);
    }
    return host.syncCacheHasLoadedFlagFromPersistent(slug, { force: shouldForceSync });
  };

  const runDeferredFullSbtScan = (slug: string, pathname: string): void => {
    void (async () => {
      try {
        if (typeof host.shouldAutoRunFullSbtScan === 'function' && !host.shouldAutoRunFullSbtScan({ pathname })) {
          return;
        }
        log.log('[SBT Deferred] Kicking off full scan after questions & surveys are ready...');
        if (typeof host.initializeSbtCache === 'function') {
          await host.initializeSbtCache({ mode: 'full' });
        }
        if (typeof host.startSbtEventListener === 'function') {
          host.startSbtEventListener();
        }
        log.log('[SBT Deferred] Full scan complete; listener started.');
      } catch (e) {
        log.error('[SBT Deferred] Full scan failed:', e);
      }
    })();
  };

  const checkAllCachesReady = (): void => {
    const state = getState();
    const isSBTCacheReady = !!state.isSBTCacheReady;
    const isSurveyCacheReady = !!state.isSurveyCacheReady;
    const isQuestionCacheReady = !!state.isQuestionCacheReady;
    const nextIsAllReady = !!(isSBTCacheReady && isSurveyCacheReady && isQuestionCacheReady);
    const slug = resolveStateSlug();

    setState((prev) => {
      if (prev.isAllCachesReady === nextIsAllReady) return null;
      return { isAllCachesReady: nextIsAllReady };
    });
    void syncCacheHasLoadedFlagOnTransition(slug, { isAllReady: nextIsAllReady });

    const pathname = getCurrentPathname();
    if (!pathname.startsWith('/session/')) return;

    const shouldKickOff =
      isSBTCacheReady &&
      isSurveyCacheReady &&
      isQuestionCacheReady &&
      !!(typeof host.readFlag === 'function' && host.readFlag('sbt:deferredFullScanNeeded', slug)) &&
      !(typeof host.readFlag === 'function' && host.readFlag('sbt:fullScanInProgress', slug));

    if (shouldKickOff) {
      runDeferredFullSbtScan(slug, pathname);
    }
  };

  const handleCrossTabCacheUpdateEvent = (evt: ReadinessEvent): void => {
    recordCeRuntimeCacheEvent(evt);
    const namespace = String(evt?.namespace || '');
    const slugForEvent = String(evt?.slug || '');
    const activeSlug = resolveActiveSlug();
    if (slugForEvent !== String(activeSlug || '')) return;
    const isLocalEcho = String(evt?.source || '') === 'local';

    if (isLocalEcho) {
      const initInFlight = typeof host.isInitInFlight === 'function' ? host.isInitInFlight(activeSlug) || {} : {};
      const questionInitBusy = !!(initInFlight?.question || initInFlight?.survey || initInFlight?.response);
      const sbtScanBusy =
        typeof host.readFlag === 'function' ? !!host.readFlag('sbt:fullScanInProgress', activeSlug) : false;
      if ((namespace === 'questionsCache' || namespace === 'surveysCache') && questionInitBusy) {
        return;
      }
      if (namespace === 'sbtCache' && sbtScanBusy) return;
    }

    if (namespace === 'sbtCache') {
      queueCacheUpdateFlush({ slug: activeSlug, needsSbtRevision: true });
      return;
    }

    if (namespace === 'questionsCache' || namespace === 'surveysCache') {
      queueCacheUpdateFlush({ slug: activeSlug, needsQuestionResponsesNonce: true });
    }
  };

  const destroy = (): void => {
    clearCacheUpdateFlushSchedule();
    clearLocalRevisionFlushSchedule();
    pendingCacheUpdateFlags = createDefaultCacheUpdateFlags();
    pendingCacheUpdateSlug = null;
    pendingLocalRevisionFlags = createDefaultCacheUpdateFlags();
    pendingLocalRevisionCheckAllCachesReady = false;
    pendingReadinessValues.clear();
    lastCacheHasLoadedSyncSlug = '';
    lastCacheHasLoadedSyncIsAllReady = null;
  };

  return {
    setReadinessStateIfChanged,
    checkAllCachesReady,
    syncCacheHasLoadedFlagOnTransition,
    clearCacheUpdateFlushSchedule,
    scheduleCacheUpdateFlush,
    queueCacheUpdateFlush,
    flushQueuedCacheUpdates,
    clearLocalRevisionFlushSchedule,
    scheduleLocalRevisionFlush,
    queueLocalRevisionUpdate,
    flushLocalRevisionUpdate,
    handleCrossTabCacheUpdateEvent,
    destroy,
  };
};
