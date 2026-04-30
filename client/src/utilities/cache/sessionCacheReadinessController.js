import { createLogger } from 'utilities/logging.js';
import { recordCeRuntimeCacheEvent } from '../../utilities/ui/uiRuntimeStats.js';
import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';

const log = createLogger('cacheReadinessCtrl');

const DEFAULT_CACHE_UPDATE_FLAGS = () => ({
  needsSbtRevision: false,
  needsQuestionResponsesNonce: false,
});

const DEFAULT_LOCAL_REVISION_FLAGS = () => ({
  needsSbtRevision: false,
  needsQuestionResponsesNonce: false,
});

export const createSessionCacheReadinessController = (host = {}) => {
  let pendingReadinessValues = new Map();
  let pendingCacheUpdateSlug = null;
  let pendingCacheUpdateFlags = DEFAULT_CACHE_UPDATE_FLAGS();
  let cacheUpdateFlushTimer = null;
  let cacheUpdateFlushRaf = null;
  let pendingLocalRevisionFlags = DEFAULT_LOCAL_REVISION_FLAGS();
  let pendingLocalRevisionCheckAllCachesReady = false;
  let localRevisionFlushTimer = null;
  let localRevisionFlushRaf = null;
  let lastCacheHasLoadedSyncSlug = '';
  let lastCacheHasLoadedSyncIsAllReady = null;

  const getState = () => (typeof host.getState === 'function' ? host.getState() || {} : {});
  const setState = (updater, cb) => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };
  const isMounted = () => (typeof host.isMounted === 'function' ? !!host.isMounted() : false);
  const resolveActiveSlug = () => String(
    typeof host.resolveActiveSlug === 'function' ? host.resolveActiveSlug() || '' : ''
  );
  const checkAllCachesReady = () => {
    if (typeof host.checkAllCachesReady === 'function') host.checkAllCachesReady();
  };

  const clearCacheUpdateFlushSchedule = () => {
    try {
      if (
        cacheUpdateFlushRaf != null &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(cacheUpdateFlushRaf);
      }
    } catch (e) { log.warn('sessionCacheReadinessController: cleanup', e); }
    cacheUpdateFlushRaf = null;
    try {
      if (cacheUpdateFlushTimer) clearTimeout(cacheUpdateFlushTimer);
    } catch (e) { log.warn('sessionCacheReadinessController: cleanup', e); }
    cacheUpdateFlushTimer = null;
  };

  const flushQueuedCacheUpdates = () => {
    const pendingSlug = String(pendingCacheUpdateSlug || '');
    const flags = pendingCacheUpdateFlags || {};
    if (!flags.needsSbtRevision && !flags.needsQuestionResponsesNonce) return;
    pendingCacheUpdateFlags = DEFAULT_CACHE_UPDATE_FLAGS();
    pendingCacheUpdateSlug = null;
    if (!isMounted()) return;
    const activeSlug = resolveActiveSlug();
    if (pendingSlug !== activeSlug) return;
    setState((prev) => {
      const next = {};
      if (flags.needsSbtRevision) {
        next.sbtCacheRevision = Number(prev.sbtCacheRevision || 0) + 1;
      }
      if (flags.needsQuestionResponsesNonce) {
        next.isResponsesCacheReady = true;
        next.questionResponsesNonce = Number(prev.questionResponsesNonce || 0) + 1;
      }
      return next;
    }, checkAllCachesReady);
  };

  const scheduleCacheUpdateFlush = () => {
    if (cacheUpdateFlushRaf != null || cacheUpdateFlushTimer) return;
    const flush = () => {
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
  } = {}) => {
    const nextSlug = String(slug || '');
    const pendingSlug = pendingCacheUpdateSlug == null
      ? null
      : String(pendingCacheUpdateSlug || '');
    if (pendingSlug !== null && pendingSlug !== nextSlug) {
      // Drop stale queued flags if active session changed before the scheduled flush runs.
      pendingCacheUpdateFlags = DEFAULT_CACHE_UPDATE_FLAGS();
    }
    pendingCacheUpdateSlug = nextSlug;
    if (needsSbtRevision) pendingCacheUpdateFlags.needsSbtRevision = true;
    if (needsQuestionResponsesNonce) pendingCacheUpdateFlags.needsQuestionResponsesNonce = true;
    scheduleCacheUpdateFlush();
  };

  const clearLocalRevisionFlushSchedule = () => {
    try {
      if (
        localRevisionFlushRaf != null &&
        typeof window !== 'undefined' &&
        typeof window.cancelAnimationFrame === 'function'
      ) {
        window.cancelAnimationFrame(localRevisionFlushRaf);
      }
    } catch (e) { log.warn('sessionCacheReadinessController: cleanup', e); }
    localRevisionFlushRaf = null;
    try {
      if (localRevisionFlushTimer) clearTimeout(localRevisionFlushTimer);
    } catch (e) { log.warn('sessionCacheReadinessController: cleanup', e); }
    localRevisionFlushTimer = null;
  };

  const flushLocalRevisionUpdate = () => {
    const flags = pendingLocalRevisionFlags || {};
    const shouldCheckAllCachesReady = !!pendingLocalRevisionCheckAllCachesReady;
    if (!flags.needsSbtRevision && !flags.needsQuestionResponsesNonce) {
      pendingLocalRevisionCheckAllCachesReady = false;
      if (shouldCheckAllCachesReady && isMounted()) checkAllCachesReady();
      return;
    }
    pendingLocalRevisionFlags = DEFAULT_LOCAL_REVISION_FLAGS();
    pendingLocalRevisionCheckAllCachesReady = false;
    if (!isMounted()) return;
    setState((prev) => {
      const next = {};
      if (flags.needsSbtRevision) {
        next.sbtCacheRevision = Number(prev.sbtCacheRevision || 0) + 1;
      }
      if (flags.needsQuestionResponsesNonce) {
        next.questionResponsesNonce = Number(prev.questionResponsesNonce || 0) + 1;
      }
      return next;
    }, () => {
      if (shouldCheckAllCachesReady) checkAllCachesReady();
    });
  };

  const scheduleLocalRevisionFlush = () => {
    if (localRevisionFlushRaf != null || localRevisionFlushTimer) return;
    const flush = () => {
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
  } = {}) => {
    if (needsSbtRevision) pendingLocalRevisionFlags.needsSbtRevision = true;
    if (needsQuestionResponsesNonce) pendingLocalRevisionFlags.needsQuestionResponsesNonce = true;
    if (shouldCheckAllCachesReady) pendingLocalRevisionCheckAllCachesReady = true;
    scheduleLocalRevisionFlush();
  };

  const setReadinessStateIfChanged = (nextState, cb) => {
    if (!nextState || typeof nextState !== 'object') {
      if (typeof cb === 'function') cb();
      return false;
    }
    const keys = Object.keys(nextState);
    if (!keys.length) {
      if (typeof cb === 'function') cb();
      return false;
    }
    const finalize = () => {
      const currentState = getState();
      keys.forEach((key) => {
        if (!pendingReadinessValues.has(key)) return;
        if (currentState[key] === pendingReadinessValues.get(key)) {
          pendingReadinessValues.delete(key);
        }
      });
      if (typeof cb === 'function') cb();
    };
    const queueWrite = () => {
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
      const baseline = pendingReadinessValues.has(key)
        ? pendingReadinessValues.get(key)
        : currentState[key];
      return baseline !== nextState[key];
    });
    if (!hasChange) {
      const hasPendingCommit = keys.some((key) => (
        pendingReadinessValues.has(key) && currentState[key] !== pendingReadinessValues.get(key)
      ));
      if (hasPendingCommit) {
        // Preserve callback ordering when the same value is already queued but not committed yet.
        queueWrite();
        return false;
      }
      if (typeof cb === 'function') cb();
      return false;
    }
    queueWrite();
    return true;
  };

  const syncCacheHasLoadedFlagOnTransition = (slugIn, opts = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const forceRequested = !!opts.force;
    const hasReadyHint = Object.prototype.hasOwnProperty.call(opts, 'isAllReady');
    const readyHint = hasReadyHint ? !!opts.isAllReady : null;
    const slugChanged = lastCacheHasLoadedSyncSlug !== slug;
    const readinessChanged = hasReadyHint && lastCacheHasLoadedSyncIsAllReady !== readyHint;
    if (!forceRequested && !slugChanged && !readinessChanged) {
      return Promise.resolve(false);
    }
    // When readiness flips to "all ready", force a fresh read so we do not reuse a stale in-flight sync.
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

  const handleCrossTabCacheUpdateEvent = (evt) => {
    recordCeRuntimeCacheEvent(evt);
    const namespace = String(evt?.namespace || '');
    const slugForEvent = String(evt?.slug || '');
    const activeSlug = resolveActiveSlug();
    if (slugForEvent !== String(activeSlug || '')) return;
    const isLocalEcho = String(evt?.source || '') === 'local';

    // Ignore same-tab cache echo events while active init/full-scan runs are in flight.
    // This avoids nonce/readiness feedback loops from our own chunked writes.
    if (isLocalEcho) {
      const initInFlight = typeof host.isInitInFlight === 'function'
        ? host.isInitInFlight(activeSlug) || {}
        : {};
      const questionInitBusy = !!(
        initInFlight?.question ||
        initInFlight?.survey ||
        initInFlight?.response
      );
      const sbtScanBusy = typeof host.readFlag === 'function'
        ? !!host.readFlag('sbt:fullScanInProgress', activeSlug)
        : false;
      if ((namespace === 'questionsCache' || namespace === 'surveysCache') && questionInitBusy) return;
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

  const destroy = () => {
    clearCacheUpdateFlushSchedule();
    clearLocalRevisionFlushSchedule();
    pendingCacheUpdateFlags = DEFAULT_CACHE_UPDATE_FLAGS();
    pendingCacheUpdateSlug = null;
    pendingLocalRevisionFlags = DEFAULT_LOCAL_REVISION_FLAGS();
    pendingLocalRevisionCheckAllCachesReady = false;
    pendingReadinessValues.clear();
    lastCacheHasLoadedSyncSlug = '';
    lastCacheHasLoadedSyncIsAllReady = null;
  };

  return {
    setReadinessStateIfChanged,
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
