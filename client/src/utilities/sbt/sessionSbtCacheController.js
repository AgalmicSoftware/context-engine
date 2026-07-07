import contractScripts, {
  getAllSessionSlugs,
  getReadProviderForSession,
  normalizeSessionSlug,
} from '../web3/chainGateway.js';
import { createLogger } from 'utilities/logging.js';
import { emitMainSiteSbtDebug, hasCoreSbtMetadata, isForcedSbtSelectorDebugEnabled } from '../session/mainSiteUtils.js';
import {
  mapSbtWorkProgressToBlock,
  SBT_FULL_SCAN_DISCOVERY_UNITS,
  SBT_FULL_SCAN_PROCESS_UNITS,
  SBT_LIGHT_DISCOVERY_HYDRATION_UNITS,
  SBT_LIGHT_DISCOVERY_SCAN_UNITS,
  SBT_PROGRESS_FINAL_TAIL_BLOCKS,
} from '../session/mainSiteProgressHelpers.js';
import {
  normalizeSbtCountMap,
  sumSbtCountMap,
  mergeSbtCountMaps,
  mergeSbtCountsPayload,
  seedSbtCountMapFromLegacyAddresses,
  hydrateLegacySbtCountState,
  getCurrentHolderAddressesFromCounts,
  normalizeSbtCountsScanCheckpoint,
} from './sbtCountHelpers.js';
import { normalizeSbtHistorySummary, buildSbtHistorySummaryFromCounts } from './sbtHistoryHelpers.js';
import { resolveSbtCreationBlock } from './sbtCacheEntryHelpers.js';
import { normalizeSbtRealtimeEventCursor, compareSbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';
import { buildSbtCountsInitialProgress, createSbtLiveProgressController } from './sbtLiveProgressController.js';
import { createSbtRealtimeCoverageController } from './sbtRealtimeCoverageController.js';
import { createSbtRealtimeListenerCleanupController } from './sbtRealtimeListenerCleanupController.js';
import { getSbtInstanceListenerPlan } from './sbtRealtimeListenerPlan.js';
import { resolveSbtRealtimeEventBlockNumber } from './sbtRealtimeEventBlockResolver.js';
import { getSbtRealtimeEventCursorGuard } from './sbtRealtimeEventCursorGuard.js';
import { updateSbtRealtimeCursorForNetworkCache } from './sbtRealtimeCursorCache.js';
import { withSessionScopedSbtCacheBinding } from './sessionSbtCacheBinding.js';
import {
  applySbtActivityCacheEntryUpdate,
  buildSbtActivityCacheEntry,
  hydrateSbtActivityCacheEntry,
} from './sbtActivityCacheEntry.js';
import { buildSessionSbtCacheWriteEnvelope } from './sbtCacheWriteContract.js';
import { buildSbtHydrationQueueEntry, buildSbtLightDiscoveryInFlightKey } from './sbtProgressListenerContract.js';
import { needsSbtListMetadataHydration } from './sbtMetadataHydrationReadiness.js';
import { sbtEventStreamsPort } from '../../domains/sbts/sbtEventStreamsPort.js';

const mainSiteLog = createLogger('mainSite');

export const createSessionSbtCacheController = (host = {}) => {
  let _sessionRouteLightDiscoveryInFlight = {};
  let _lightSbtDiscoveryInFlight = {};

  const setState = (updater, cb) => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };
  const dgRead = (...args) => (typeof host.dgRead === 'function' ? host.dgRead(...args) : null);
  const dgWrite = (...args) => (typeof host.dgWrite === 'function' ? host.dgWrite(...args) : null);
  const getActiveSessionSlug = () =>
    String(typeof host.getActiveSessionSlug === 'function' ? host.getActiveSessionSlug() || '' : '');
  const getSessionCfg = (slug) => (typeof host.getSessionCfg === 'function' ? host.getSessionCfg(slug) : null);
  const getSessionChainId = (slug) =>
    typeof host.getSessionChainId === 'function' ? host.getSessionChainId(slug) : null;
  const readSbtSessionBindingSource = (source = null) => {
    if (!source || typeof source !== 'object') return null;
    if (!Object.prototype.hasOwnProperty.call(source, 'sessionSlug')) return null;
    const hasExplicitFlag = Object.prototype.hasOwnProperty.call(source, 'sessionSlugExplicit');
    const explicit = hasExplicitFlag ? source.sessionSlugExplicit === true : true;
    return {
      slug: normalizeSessionSlug(source.sessionSlug || ''),
      explicit,
      hasExplicitFlag,
    };
  };
  const withSessionScopedSbtCacheBinding = (entry = {}, slugIn = '') => {
    const normalizedSlug = normalizeSessionSlug(slugIn || '');
    const record = entry && typeof entry === 'object' ? entry : {};
    const info = record.sbtInfo && typeof record.sbtInfo === 'object' ? record.sbtInfo : null;
    const infoBinding = readSbtSessionBindingSource(info);
    const recordBinding = readSbtSessionBindingSource(record);
    let bindingSlug = normalizedSlug;
    let bindingExplicit = false;
    let includeExplicitFlag = true;

    if (infoBinding?.explicit) {
      bindingSlug = infoBinding.slug;
      bindingExplicit = true;
      includeExplicitFlag = infoBinding.hasExplicitFlag;
    } else if (infoBinding?.hasExplicitFlag) {
      // Fresh metadata that explicitly says the binding is inferred must win over
      // stale cache records that previously promoted bucket membership to explicit.
      bindingSlug = normalizedSlug;
      bindingExplicit = false;
      includeExplicitFlag = true;
    } else if (recordBinding?.explicit) {
      bindingSlug = recordBinding.slug;
      bindingExplicit = true;
      includeExplicitFlag = recordBinding.hasExplicitFlag;
    }

    const sessionBindingPatch = bindingExplicit
      ? {
          sessionSlug: bindingSlug,
          ...(includeExplicitFlag ? { sessionSlugExplicit: true } : {}),
        }
      : {
          sessionSlug: bindingSlug,
          sessionSlugExplicit: false,
        };

    return {
      ...record,
      slug: normalizedSlug,
      ...sessionBindingPatch,
      sbtInfo: info
        ? {
            ...info,
            ...sessionBindingPatch,
          }
        : record.sbtInfo,
    };
  };
  const getSessionScanScope = () =>
    String(typeof host.getSessionScanScope === 'function' ? host.getSessionScanScope() || '' : '');
  const getSessionScanScopeContext = (scope) =>
    typeof host.getSessionScanScopeContext === 'function'
      ? host.getSessionScanScopeContext(scope)
      : { scope: String(scope || ''), list: [] };
  const getAccount = () => String(typeof host.getAccount === 'function' ? host.getAccount() || '' : '');
  const getCurrentPath = () => String(typeof host.getCurrentPath === 'function' ? host.getCurrentPath() || '' : '');
  const getEffectiveRoutePath = (pathIn = '') =>
    String(typeof host.getEffectiveRoutePath === 'function' ? host.getEffectiveRoutePath(pathIn) || '' : pathIn || '');
  const getScopeFilteredSlugs = (slugs, scope) =>
    typeof host.getScopeFilteredSlugs === 'function' ? host.getScopeFilteredSlugs(slugs, scope) : [];
  const getScopedSessionSlugs = (scope) =>
    typeof host.getScopedSessionSlugs === 'function' ? host.getScopedSessionSlugs(scope) : [];
  const shouldSkipSessionScanForSlug = (slug, op, scopeCtx) =>
    typeof host.shouldSkipSessionScanForSlug === 'function'
      ? host.shouldSkipSessionScanForSlug(slug, op, scopeCtx)
      : false;
  const scanScopeNoop = (slug, op, onSkipped) =>
    typeof host.scanScopeNoop === 'function' ? host.scanScopeNoop(slug, op, onSkipped) : false;
  const logScopeSkipOnce = (op, slug, scopeCtx) => {
    if (typeof host.logScopeSkipOnce === 'function') {
      host.logScopeSkipOnce(op, slug, scopeCtx);
    }
  };
  const isSbtInstanceListenerEnabledForGroup = (slug) =>
    typeof host.isSbtInstanceListenerEnabledForGroup === 'function'
      ? host.isSbtInstanceListenerEnabledForGroup(slug)
      : true;
  const shouldAutoRunFullSbtScan = (opts) =>
    typeof host.shouldAutoRunFullSbtScan === 'function' ? host.shouldAutoRunFullSbtScan(opts) : true;
  const isSbtHistoryScanEnabled = () =>
    typeof host.isSbtHistoryScanEnabled === 'function' ? host.isSbtHistoryScanEnabled() : true;
  const setReadinessStateIfChanged = (patch, cb) =>
    typeof host.setReadinessStateIfChanged === 'function' ? host.setReadinessStateIfChanged(patch, cb) : false;
  const checkAllCachesReady = () => {
    if (typeof host.checkAllCachesReady === 'function') {
      host.checkAllCachesReady();
    }
  };
  const queueLocalRevisionUpdate = (opts = {}) => {
    if (typeof host.queueLocalRevisionUpdate === 'function') {
      host.queueLocalRevisionUpdate(opts);
    }
  };
  const readFlag = (flag, slug) => (typeof host.readFlag === 'function' ? host.readFlag(flag, slug) : false);
  const writeFlag = (flag, slug, value) => {
    if (typeof host.writeFlag === 'function') {
      host.writeFlag(flag, slug, value);
    }
  };
  const refreshEncryptedQuestionPayloadsForGroup = (slug, opts) =>
    typeof host.refreshEncryptedQuestionPayloadsForGroup === 'function'
      ? host.refreshEncryptedQuestionPayloadsForGroup(slug, opts)
      : Promise.resolve();
  const runWithGeneralSessionBackfill = (opts) =>
    typeof host.runWithGeneralSessionBackfill === 'function'
      ? host.runWithGeneralSessionBackfill(opts)
      : Promise.resolve(
          typeof opts?.runPrimary === 'function'
            ? opts.runPrimary(normalizeSessionSlug(opts?.slugIn || ''))
            : undefined,
        );
  const mergeLegacyNumericNetworkKey = (cache, networkID) =>
    typeof host.mergeLegacyNumericNetworkKey === 'function'
      ? host.mergeLegacyNumericNetworkKey(cache, networkID)
      : false;

  const sbtLiveProgressController = createSbtLiveProgressController({ setState });
  const beginSbtLiveProgress = sbtLiveProgressController.beginSbtLiveProgress;
  const updateSbtLiveProgress = sbtLiveProgressController.updateSbtLiveProgress;
  const clearSbtLiveProgress = sbtLiveProgressController.clearSbtLiveProgress;

  const sbtRealtimeCoverageController = createSbtRealtimeCoverageController({ setState });
  const setSbtRealtimeCoverageForGroup = sbtRealtimeCoverageController.setSbtRealtimeCoverageForGroup;
  const clearSbtRealtimeCoverageForGroup = sbtRealtimeCoverageController.clearSbtRealtimeCoverageForGroup;
  const eventStreamsPort = host.sbtEventStreamsPort || host.eventStreamsPort || sbtEventStreamsPort;

  const sbtRealtimeListenerCleanupController = createSbtRealtimeListenerCleanupController({
    clearCoverage: clearSbtRealtimeCoverageForGroup,
    contractScripts: eventStreamsPort,
  });
  const removeSbtRealtimeListenersForGroup = sbtRealtimeListenerCleanupController.removeSbtRealtimeListenersForGroup;

  const ensureSessionRouteSbtDiscovery = (slugIn) => {
    const pathname = getEffectiveRoutePath(getCurrentPath());
    if (!pathname.startsWith('/session/')) return null;

    const slug = normalizeSessionSlug(slugIn || '');
    const activeSlug = normalizeSessionSlug(getActiveSessionSlug() || '');
    if (slug !== activeSlug) return null;

    const inFlightKey = slug;
    if (_sessionRouteLightDiscoveryInFlight[inFlightKey]) {
      return _sessionRouteLightDiscoveryInFlight[inFlightKey];
    }

    const run = Promise.resolve()
      .then(() => ensureLightSbtDiscovery(slug, { forceScopeSlug: slug }))
      .catch((e) => {
        mainSiteLog.error('[SessionRoute SBT discovery] Light discovery failed:', e);
      })
      .finally(() => {
        if (_sessionRouteLightDiscoveryInFlight[inFlightKey] === run) {
          delete _sessionRouteLightDiscoveryInFlight[inFlightKey];
        }
      });

    _sessionRouteLightDiscoveryInFlight[inFlightKey] = run;
    return run;
  };

  const ensureLightSbtDiscovery = (slugIn, opts = {}) => {
    const slug = normalizeSessionSlug(typeof slugIn === 'string' ? slugIn : getActiveSessionSlug() || '');
    const hasForcedScopeSlug = opts && Object.prototype.hasOwnProperty.call(opts, 'forceScopeSlug');
    const forcedScopeSlug = hasForcedScopeSlug ? normalizeSessionSlug(opts?.forceScopeSlug ?? '') : '';
    const inFlightKey = `${slug}|${forcedScopeSlug}|${opts?.force === true ? '1' : '0'}`;
    if (_lightSbtDiscoveryInFlight[inFlightKey]) {
      return _lightSbtDiscoveryInFlight[inFlightKey];
    }

    const trackedRun = (async () => {
      let liveProgressToken = null;
      try {
        emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] start', {
          slug,
          force: opts?.force === true,
          hasForcedScopeSlug,
          forcedScopeSlug,
        });
        const scopeContext = hasForcedScopeSlug
          ? {
              scope: 'active',
              list: [forcedScopeSlug],
              activeSlug: forcedScopeSlug,
              activeSlugFromRoute: true,
            }
          : null;
        if (shouldSkipSessionScanForSlug(slug, 'ensureLightSbtDiscovery', scopeContext)) return;
        const networkID = String(getSessionChainId(slug) || '');
        if (!networkID) {
          emitMainSiteSbtDebug('warn', '[ensureLightSbtDiscovery] skipped (missing chain)', {
            slug,
            hasForcedScopeSlug,
            forcedScopeSlug,
          });
          return;
        }

        const sessionCfg = getSessionCfg(slug);
        const sessionBlockWindowRef = getSessionBlockWindowRef(slug);
        const discoveryGroupRef = hasForcedScopeSlug
          ? {
              ...(typeof sessionBlockWindowRef === 'object' ? sessionBlockWindowRef : {}),
              slug,
              __ignoreSessionScanScope: true,
            }
          : slug;
        const ignoredSet = new Set((sessionCfg?.ignored_SBTs_LIST || []).map((a) => (a || '').toLowerCase()));
        const { fromBlock: baseFrom, toBlock: baseTo } =
          await contractScripts.getRelevantBlockWindowForFilter(discoveryGroupRef);
        const initialLastBlock = Math.max(0, baseFrom - 1);

        // Initial read just to check waterline
        let cache = dgRead('sbtCache', slug) || {};
        mergeLegacyNumericNetworkKey(cache, networkID);
        if (!cache[networkID]) cache[networkID] = { sbtList: {}, lastBlock: initialLastBlock };
        let netCache = cache[networkID];

        const scannedUpTo = Number(netCache.lastBlock) || 0;
        const hasListVisibleTokenUriMetadata = (info) => {
          if (!info || typeof info !== 'object') return false;
          if (info.tokenUriMetadataFetched === true) return true;
          const hasText = (value) => value !== undefined && value !== null && String(value).trim() !== '';
          const hasItems = (value) => Array.isArray(value) && value.length > 0;
          const encryptedFields =
            info.encryptedFields && typeof info.encryptedFields === 'object' ? info.encryptedFields : {};
          return (
            hasText(info.description) ||
            hasText(info.image) ||
            hasText(info.descriptionEncrypted) ||
            hasText(info.encryptedDescription) ||
            hasText(info.imageEncrypted) ||
            hasText(info.encryptedImage) ||
            hasText(encryptedFields.description) ||
            hasText(encryptedFields.image) ||
            hasItems(info.tags) ||
            hasItems(info.documentURLs) ||
            hasItems(info.documentUrls) ||
            hasItems(info.docURLs) ||
            hasItems(info.documents)
          );
        };

        const needsHydration = (info) => {
          return !hasCoreSbtMetadata(info) || !hasListVisibleTokenUriMetadata(info);
        };

        const existingHydrationTargets = Object.entries(netCache.sbtList || {})
          .map(([addrLower, entry]) => String(entry?.sbtAddress || addrLower || '').trim())
          .filter((addr) => {
            if (!addr) return false;
            if (ignoredSet.has(addr.toLowerCase())) return false;
            const existingEntry = netCache.sbtList?.[addr.toLowerCase()] || null;
            return needsHydration(existingEntry?.sbtInfo || null);
          });
        const skipDiscoveryScan = !opts.force && scannedUpTo >= baseTo && existingHydrationTargets.length > 0;
        if (!opts.force && scannedUpTo >= baseTo && existingHydrationTargets.length <= 0) {
          emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] skipped (already at watermark)', {
            slug,
            networkID,
            scannedUpTo,
            baseTo,
          });
          return;
        }
        const discoveryFromBlock = opts.force === true ? baseFrom : Math.max(scannedUpTo + 1, baseFrom);
        emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] scanning block window', {
          slug,
          networkID,
          baseFrom,
          baseTo,
          discoveryFromBlock,
          scannedUpTo,
          ignoredCount: ignoredSet.size,
        });
        const lightDiscoveryTotalUnits = SBT_LIGHT_DISCOVERY_SCAN_UNITS + SBT_LIGHT_DISCOVERY_HYDRATION_UNITS;
        const updateLightDiscoveryProgress = (completedUnits, force = false) => {
          if (!liveProgressToken) return;
          const currentBlock = mapSbtWorkProgressToBlock({
            baseFrom,
            baseTo,
            completedUnits,
            totalUnits: lightDiscoveryTotalUnits,
            reserveTailBlocks: SBT_PROGRESS_FINAL_TAIL_BLOCKS,
          });
          updateSbtLiveProgress(slug, liveProgressToken, { currentBlock, latestBlock: baseTo }, { force });
        };

        liveProgressToken = beginSbtLiveProgress(slug, {
          currentBlock: Math.max(initialLastBlock, scannedUpTo),
          latestBlock: baseTo,
        });

        const normalizeEnd = (info) => {
          if (!info) return info;
          if (info.mintingEndTime == null) return info;
          const n = Number(info.mintingEndTime);
          if (!Number.isFinite(n)) {
            info.mintingEndTime = 0;
            return info;
          }
          info.mintingEndTime = n > 1e12 ? Math.floor(n / 1000) : Math.max(0, Math.floor(n));
          return info;
        };

        let addrs = [];
        let lastLoggedDiscoveryPercent = -1;
        let discoveryComplete = false;
        let totalHydrationTargets = 0;
        let hydratedTargetCount = 0;
        let lastHydrationUnits = 0;
        const queuedHydrationAddresses = [];
        const queuedHydrationAddressSet = new Set();
        const unresolvedHydrationAddressSet = new Set();
        const BATCH = 8;
        let hydrationDrainPromise = null;

        const emitHydrationProgress = ({ force = false, lastBatchSize = 0 } = {}) => {
          if (!discoveryComplete) return;
          if (!force && hydratedTargetCount <= 0) return;
          const targetUnits = force
            ? SBT_LIGHT_DISCOVERY_HYDRATION_UNITS
            : totalHydrationTargets > 0
              ? Math.floor((hydratedTargetCount / totalHydrationTargets) * SBT_LIGHT_DISCOVERY_HYDRATION_UNITS)
              : SBT_LIGHT_DISCOVERY_HYDRATION_UNITS;
          const hydrationUnits = Math.max(lastHydrationUnits, targetUnits);
          lastHydrationUnits = hydrationUnits;
          updateLightDiscoveryProgress(
            SBT_LIGHT_DISCOVERY_SCAN_UNITS + hydrationUnits,
            force || hydratedTargetCount >= totalHydrationTargets,
          );
          emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] hydration progress', {
            slug,
            networkID,
            hydratedTargetCount,
            totalHydrationTargets,
            percent:
              totalHydrationTargets > 0
                ? Math.max(0, Math.min(100, Math.floor((hydratedTargetCount / totalHydrationTargets) * 100)))
                : 100,
            lastBatchSize,
          });
        };

        const drainHydrationQueue = async () => {
          try {
            while (queuedHydrationAddresses.length > 0) {
              const batch = queuedHydrationAddresses.splice(0, BATCH);

              mainSiteLog.log(`[ensureLightSbtDiscovery] Group '${slug}': processing batch...`, batch);

              const results = await Promise.all(
                batch.map(async (addr) => {
                  const currentRead = dgRead('sbtCache', slug) || {};
                  const currentNet = currentRead[networkID] || {};
                  const currentList = currentNet.sbtList || {};

                  const lower = addr.toLowerCase();
                  const existing = currentList[lower] || {};
                  const currentInfo = existing?.sbtInfo || null;
                  let sbtInfo = currentInfo;

                  if (!sbtInfo || needsHydration(sbtInfo) || opts.force === true) {
                    try {
                      sbtInfo = await contractScripts.getSbtMetadata('none', addr, discoveryGroupRef);
                      sbtInfo = normalizeEnd(sbtInfo);
                    } catch (e) {
                      mainSiteLog.warn('MainSite: fallback', e);
                    }
                  } else {
                    sbtInfo = normalizeEnd(sbtInfo);
                  }

                  const refreshed = !!sbtInfo && (!currentInfo || needsHydration(currentInfo));
                  return { addr, lower, sbtInfo, refreshed };
                }),
              );

              cache = dgRead('sbtCache', slug) || {};
              if (!cache[networkID]) cache[networkID] = { sbtList: {}, lastBlock: initialLastBlock };
              netCache = cache[networkID];
              netCache.sbtList = netCache.sbtList || {};

              for (const { addr, lower, sbtInfo, refreshed } of results) {
                const freshExisting = netCache.sbtList[lower] || {};
                const storedInfo = sbtInfo || freshExisting.sbtInfo || null;
                if (!hasCoreSbtMetadata(storedInfo)) {
                  unresolvedHydrationAddressSet.add(lower);
                } else {
                  unresolvedHydrationAddressSet.delete(lower);
                }

                netCache.sbtList[lower] = withSessionScopedSbtCacheBinding(
                  {
                    ...freshExisting,
                    sbtAddress: addr,
                    sbtInfo: storedInfo,
                    slug,
                    blockNumber: refreshed ? baseTo : freshExisting.blockNumber || 0,
                  },
                  slug,
                );
              }

              await writeSbtCache(slug, cache);
              mainSiteLog.log(`[ensureLightSbtDiscovery] Group '${slug}': Batch saved.`);
              hydratedTargetCount = Math.min(totalHydrationTargets, hydratedTargetCount + batch.length);
              emitHydrationProgress({ lastBatchSize: batch.length });
              await new Promise((r) => setTimeout(r, 25));
            }
          } finally {
            hydrationDrainPromise = null;
            if (queuedHydrationAddresses.length > 0) {
              hydrationDrainPromise = drainHydrationQueue();
            }
          }
        };

        const enqueueHydrationAddresses = (addresses = []) => {
          let addedCount = 0;
          (Array.isArray(addresses) ? addresses : []).forEach((addrRaw) => {
            const queueEntry = buildSbtHydrationQueueEntry(addrRaw, {
              ignoredAddressKeys: ignoredSet,
              queuedAddressKeys: queuedHydrationAddressSet,
            });
            if (!queueEntry) return;
            queuedHydrationAddressSet.add(queueEntry.addressKey);
            queuedHydrationAddresses.push(queueEntry.address);
            addedCount += 1;
          });
          if (addedCount > 0) {
            totalHydrationTargets += addedCount;
          }
          if (!hydrationDrainPromise && queuedHydrationAddresses.length > 0) {
            hydrationDrainPromise = drainHydrationQueue();
          }
        };

        enqueueHydrationAddresses(existingHydrationTargets);

        try {
          if (skipDiscoveryScan) {
            emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] skipped log scan; rehydrating cached metadata', {
              slug,
              networkID,
              existingHydrationTargetCount: existingHydrationTargets.length,
              scannedUpTo,
              baseTo,
            });
          } else {
            const discoveryOptions = {
              ...(opts.force === true ? { force: true } : {}),
              fromBlock: discoveryFromBlock,
              toBlock: baseTo,
              onProgress: (progress) => {
                const totalBlocks = Number(progress?.totalBlocks || 0);
                const scannedBlocks = Number(progress?.scannedBlocks || 0);
                const ratio = totalBlocks > 0 ? Math.max(0, Math.min(1, scannedBlocks / totalBlocks)) : 1;
                updateLightDiscoveryProgress(Math.floor(ratio * SBT_LIGHT_DISCOVERY_SCAN_UNITS));
                const percent = totalBlocks > 0 ? Math.max(0, Math.min(100, Math.floor(ratio * 100))) : 100;
                if (percent === 100 || lastLoggedDiscoveryPercent < 0 || percent >= lastLoggedDiscoveryPercent + 10) {
                  lastLoggedDiscoveryPercent = percent;
                  emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] discovery progress', {
                    slug,
                    networkID,
                    scannedBlocks,
                    totalBlocks,
                    percent,
                    scanFrom: progress?.scanFrom ?? null,
                    scanTo: progress?.scanTo ?? null,
                    lastScannedBlock: progress?.lastScannedBlock ?? null,
                  });
                }
              },
              onDiscoveredAddresses: ({ addresses = [] }) => {
                enqueueHydrationAddresses(addresses);
              },
            };
            addrs = await contractScripts.getAllSbtAddressesCached('none', discoveryGroupRef, discoveryOptions);
            emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] discovered raw SBT universe', {
              slug,
              networkID,
              addressCount: Array.isArray(addrs) ? addrs.length : 0,
            });
          }
          updateLightDiscoveryProgress(SBT_LIGHT_DISCOVERY_SCAN_UNITS, true);
        } catch (discErr) {
          mainSiteLog.error('[ensureLightSbtDiscovery] discovery failed:', discErr);
          return;
        }

        enqueueHydrationAddresses((addrs || []).map((a) => String(a || '').trim()).filter(Boolean));
        discoveryComplete = true;
        emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] hydration plan', {
          slug,
          networkID,
          existingHydrationTargetCount: existingHydrationTargets.length,
          totalHydrationTargets,
        });

        mainSiteLog.log(
          `[ensureLightSbtDiscovery] Group '${slug}': Found ${totalHydrationTargets} SBT addresses to process:`,
          Array.from(queuedHydrationAddressSet),
        );

        if (totalHydrationTargets === 0) {
          updateLightDiscoveryProgress(lightDiscoveryTotalUnits, true);
        } else {
          emitHydrationProgress({ lastBatchSize: 0 });
          if (hydrationDrainPromise) {
            await hydrationDrainPromise;
          }
          emitHydrationProgress({ force: true, lastBatchSize: 0 });
        }

        // Waterline only at top-level (Re-read one last time to be safe)
        cache = dgRead('sbtCache', slug) || {};
        if (cache[networkID]) {
          if (unresolvedHydrationAddressSet.size > 0) {
            emitMainSiteSbtDebug(
              'warn',
              '[ensureLightSbtDiscovery] leaving watermark behind failed hydration targets',
              {
                slug,
                networkID,
                baseTo,
                unresolvedHydrationCount: unresolvedHydrationAddressSet.size,
                unresolvedHydrationAddresses: Array.from(unresolvedHydrationAddressSet),
              },
            );
          } else {
            cache[networkID].lastBlock = baseTo;
            await dgWrite('sbtCache', slug, cache);
          }
        }

        setState((prev) => ({ sbtCacheRevision: prev.sbtCacheRevision + 1 }));
        emitMainSiteSbtDebug('info', '[ensureLightSbtDiscovery] complete', {
          slug,
          networkID,
          hydratedTargetCount,
          unresolvedHydrationCount: unresolvedHydrationAddressSet.size,
          finalCachedAddressCount: Object.keys(cache?.[networkID]?.sbtList || {}).length,
          lastBlock: cache?.[networkID]?.lastBlock || baseTo,
        });
      } catch (e) {
        mainSiteLog.error('[ensureLightSbtDiscovery] unexpected error:', e);
      } finally {
        if (liveProgressToken != null) {
          clearSbtLiveProgress(slug, liveProgressToken);
        }
      }
    })().finally(() => {
      if (_lightSbtDiscoveryInFlight[inFlightKey] === trackedRun) {
        delete _lightSbtDiscoveryInFlight[inFlightKey];
      }
    });

    _lightSbtDiscoveryInFlight[inFlightKey] = trackedRun;
    return trackedRun;
  };

  const ensureLightSbtUniverse = async (slugsIn, opts = {}) => {
    try {
      const scanScope = getSessionScanScope();
      const forceExactSlugs = opts?.forceExactSlugs === true;
      const providedSlugs =
        Array.isArray(slugsIn) && slugsIn.length ? slugsIn.map((s) => normalizeSessionSlug(s ?? '')) : [];
      const allSlugs = forceExactSlugs
        ? Array.from(new Set(providedSlugs))
        : scanScope === 'all'
          ? getScopeFilteredSlugs(providedSlugs.length ? providedSlugs : getAllSessionSlugs(), scanScope)
          : getScopedSessionSlugs(scanScope);
      emitMainSiteSbtDebug('info', '[ensureLightSbtUniverse] request', {
        scanScope,
        forceExactSlugs,
        providedSlugs,
        resolvedSlugs: allSlugs,
        force: opts?.force === true,
      });

      if (!allSlugs.length) {
        logScopeSkipOnce('ensureLightSbtUniverse:list-empty', '', getSessionScanScopeContext(scanScope));
        return;
      }

      const CONC = 2; // conservative concurrency
      for (let i = 0; i < allSlugs.length; i += CONC) {
        const chunk = allSlugs.slice(i, i + CONC);
        if (mainSiteLog.isEnabled('debug') || isForcedSbtSelectorDebugEnabled()) {
          emitMainSiteSbtDebug('debug', '[ensureLightSbtUniverse] dispatch chunk', {
            chunk,
            forceExactSlugs,
            scanScope,
          });
        }
        await Promise.all(
          chunk.map((s) => {
            const discoveryOpts = forceExactSlugs ? { ...opts, forceScopeSlug: s } : { ...opts };
            delete discoveryOpts.forceExactSlugs;
            return ensureLightSbtDiscovery(s, discoveryOpts).catch((e) => {
              mainSiteLog.warn('MainSite: fallback', e);
            });
          }),
        );
      }
    } catch (e) {
      mainSiteLog.error('[ensureLightSbtUniverse] error:', e);
    }
  };

  const initializeSbtCache = async (options = {}) => {
    return initializeSbtCacheWithGeneralBackfill(getActiveSessionSlug(), options);
  };

  const initializeSbtCacheWithGeneralBackfill = async (slugIn, options = {}) => {
    const backfillOptions = (() => {
      if (!options || typeof options !== 'object') return options;
      if (options.mode !== 'full') return options;
      return { ...options, mode: 'partial' };
    })();
    return runWithGeneralSessionBackfill({
      slugIn,
      operation: 'initializeSbtCache',
      runPrimary: (slug) => initializeSbtCacheForGroup(slug, options),
      runGeneral: (slug) => initializeSbtCacheForGroup(slug, backfillOptions),
    });
  };

  const initializeSbtCacheForGroup = async (slugIn, options = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (
      scanScopeNoop(slug, 'initializeSbtCacheForGroup', () => {
        setReadinessStateIfChanged({ isSBTCacheReady: true }, checkAllCachesReady);
      })
    ) {
      return;
    }
    const modeOpt = (options && options.mode) || 'auto';

    const isDemoPath = () => {
      const p = getCurrentPath();
      return p.startsWith('/session/');
    };

    let networkID = getSessionChainId(slug);

    if (!networkID) {
      try {
        const cacheObj = dgRead('sbtCache', slug, { clone: false });
        if (cacheObj && typeof cacheObj === 'object') {
          const keys = Object.keys(cacheObj);
          if (keys.length === 1) networkID = keys[0];
        }
      } catch (e) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
    }

    const providerForReads = 'none';

    const resolveMode = () => {
      if (modeOpt === 'partial' || modeOpt === 'full') return modeOpt;
      const pathname = getCurrentPath();
      const base = isDemoPath() ? 'partial' : 'full';
      if (base !== 'full') return base;
      return shouldAutoRunFullSbtScan({ pathname }) ? 'full' : 'partial';
    };

    const mode = resolveMode();
    const historyEnabled = isSbtHistoryScanEnabled();
    if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
      mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: initializeSbtCacheForGroup invoked', {
        networkId: networkID,
        mode,
        slug,
      });
    }

    if (!networkID) {
      mainSiteLog.error('Network ID is undefined in initializeSbtCacheForGroup.');
      setReadinessStateIfChanged({ isSBTCacheReady: true });
      return;
    }

    const { fromBlock: baseFrom, toBlock: baseTo } = await contractScripts.getRelevantBlockWindowForFilter(
      getSessionBlockWindowRef(slug),
    );
    if (baseFrom > baseTo) {
      setReadinessStateIfChanged({ isSBTCacheReady: true }, checkAllCachesReady);
      return;
    }
    const initialLastBlockSBT = Math.max(0, baseFrom - 1);

    const BATCH_SIZE = 5;
    const API_CALL_DELAY = 250;

    let globalCache = dgRead('sbtCache', slug) || {};
    // One-time numeric to string network-key merge for current group chain
    {
      const networkIDStr = String(getSessionChainId(slug) || '');
      if (networkIDStr) {
        const mergedLegacyKey = mergeLegacyNumericNetworkKey(globalCache, networkIDStr);
        if (mergedLegacyKey) {
          writeSbtCache(slug, globalCache);
        }
      }
    }
    if (!globalCache[networkID]) {
      globalCache[networkID] = { sbtList: {}, lastBlock: initialLastBlockSBT };
    }
    let currentNetworkCache = globalCache[networkID];
    let currentSbtListForNetwork = currentNetworkCache.sbtList || {};
    const generalCfg = getSessionCfg('general');
    const generalFeaturedSbtList = Array.isArray(generalCfg?.featured_SBTs_LIST) ? generalCfg.featured_SBTs_LIST : [];

    // Proactive user cache population.
    // We read the cache once here. We will update it in memory during the loop and write it back at the end.
    let userCache = dgRead('userCache', slug) || {};
    let userCacheModified = false;

    // Helper to ensure the user/network node exists and update the "waterline"
    const ensureUserNode = (addr, block) => {
      const lower = addr.toLowerCase();
      if (!userCache[lower]) userCache[lower] = {};
      if (!userCache[lower][networkID]) {
        userCache[lower][networkID] = {
          lastBlockScanned: block,
          lastScanTimestamp: Math.floor(Date.now() / 1000),
          data: { sbts: [], createdSurveys: [], createdQuestions: [], surveyResponses: [], questionResponses: [] },
        };
      }
      // Update waterline: If this global scan is fresher than what the user has, bump it up.
      if (block > userCache[lower][networkID].lastBlockScanned) {
        userCache[lower][networkID].lastBlockScanned = block;
        userCache[lower][networkID].lastScanTimestamp = Math.floor(Date.now() / 1000);
      }
      return userCache[lower][networkID].data;
    };
    // Priority (featured) metadata pre-pass
    const runPriorityFeaturedMetadataPass = async () => {
      const sessionCfg = getSessionCfg(slug);
      const groupFeatured = Array.isArray(sessionCfg?.defaultFeaturedSBTs) ? sessionCfg.defaultFeaturedSBTs : [];
      const merged = [...groupFeatured, ...generalFeaturedSbtList];
      const featuredGlobalLower = Array.from(new Set(merged.map((addr) => (addr || '').toLowerCase()).filter(Boolean)));
      const priorityProcessedSbts = {};
      for (let i = 0; i < featuredGlobalLower.length; i += BATCH_SIZE) {
        const batch = featuredGlobalLower.slice(i, i + BATCH_SIZE);

        const batchPromises = batch.map(async (sbtAddressLower) => {
          try {
            const cachedSBT = currentSbtListForNetwork[sbtAddressLower];
            let originalCaseAddress =
              generalFeaturedSbtList.find((s) => s.toLowerCase() === sbtAddressLower) || sbtAddressLower;
            let sbtInfoToUse;
            if (!cachedSBT?.sbtInfo) {
              // pass slug (extra arg is harmless)
              sbtInfoToUse = await contractScripts.getSbtMetadata(providerForReads, originalCaseAddress, slug);
              if (!sbtInfoToUse) {
                mainSiteLog.warn(
                  `Skipping featured SBT ${originalCaseAddress} due to metadata fetch failure in priority pass.`,
                );
                return null;
              }
            } else {
              sbtInfoToUse = cachedSBT.sbtInfo;
            }
            return hydrateSbtActivityCacheEntry({
              sbtAddress: originalCaseAddress,
              sbtInfo: sbtInfoToUse,
              mintedAddresses: (cachedSBT?.mintedAddresses || []).map((a) => (a || '').toLowerCase()),
              burnedAddresses: (cachedSBT?.burnedAddresses || []).map((a) => (a || '').toLowerCase()),
              creationBlock: cachedSBT?.creationBlock ?? cachedSBT?.sbtInfo?.creationBlock ?? null,
              countsLoaded: cachedSBT?.countsLoaded === true,
              // keep any existing counts if present; they'll be refreshed in full pass
              mintedCountByAddress: cachedSBT?.mintedCountByAddress || {},
              burnedCountByAddress: cachedSBT?.burnedCountByAddress || {},
              mintedEventCount: cachedSBT?.mintedEventCount || 0,
              burnedEventCount: cachedSBT?.burnedEventCount || 0,
              historySummary: normalizeSbtHistorySummary(cachedSBT?.historySummary),
              blockNumber: cachedSBT?.blockNumber || 0,
            });
          } catch (error) {
            mainSiteLog.error(`Error processing featured SBT ${sbtAddressLower} in priority pass:`, error);
            return null;
          }
        });
        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach((result) => {
          if (result && result.sbtAddress) {
            priorityProcessedSbts[result.sbtAddress.toLowerCase()] = result;
          }
        });
        if (i + BATCH_SIZE < featuredGlobalLower.length) {
          await new Promise((resolve) => setTimeout(resolve, API_CALL_DELAY));
        }
      }
      currentSbtListForNetwork = { ...currentSbtListForNetwork, ...priorityProcessedSbts };
      currentNetworkCache.sbtList = currentSbtListForNetwork;
      writeSbtCache(slug, globalCache);
      if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
        mainSiteLog.log('initializeSbtCacheForGroup: Priority (featured metadata) pass complete.');
      }
    };

    // Partial mode
    if (mode === 'partial') {
      try {
        await runPriorityFeaturedMetadataPass();
        writeFlag('sbt:partialReady', slug, true);
        writeFlag('sbt:deferredFullScanNeeded', slug, true);
        setState(
          (prev) => ({ isSBTCacheReady: true, sbtCacheRevision: prev.sbtCacheRevision + 1 }),
          checkAllCachesReady,
        );
        void ensureSessionRouteSbtDiscovery(slug);
        return;
      } catch (e) {
        mainSiteLog.error('[SBT Partial] Failed (will still unblock UI):', e);
        setReadinessStateIfChanged({ isSBTCacheReady: true });
        return;
      }
    }

    // Full mode
    if (readFlag('sbt:fullScanInProgress', slug)) {
      if (window.ENABLE_RPC_DEBUG_LOGGING === true)
        mainSiteLog.log('[SBT Full] Another full scan is in progress; skipping.');
      return;
    }
    writeFlag('sbt:fullScanInProgress', slug, true);
    // Force re-render so children (SBTPage) know scanning has started.
    setState((prev) => ({ sbtScanTick: Number(prev.sbtScanTick || 0) + 1 }));
    const fullScanTotalUnits = SBT_FULL_SCAN_DISCOVERY_UNITS + SBT_FULL_SCAN_PROCESS_UNITS;
    const liveProgressToken = beginSbtLiveProgress(slug, {
      currentBlock: Math.max(initialLastBlockSBT, Number(currentNetworkCache.lastBlock) || 0),
      latestBlock: baseTo,
    });
    const updateFullScanProgress = (completedUnits, force = false) => {
      const currentBlock = mapSbtWorkProgressToBlock({
        baseFrom,
        baseTo,
        completedUnits,
        totalUnits: fullScanTotalUnits,
        reserveTailBlocks: SBT_PROGRESS_FINAL_TAIL_BLOCKS,
      });
      updateSbtLiveProgress(slug, liveProgressToken, { currentBlock, latestBlock: baseTo }, { force });
    };

    // Regression guard: this flag must clear on every exit path.
    // Otherwise all-sessions list chips can remain stuck in "Scanning" forever.
    try {
      mainSiteLog.log(
        'initializeSbtCacheForGroup() - full pass starting (includes priority + discovery + history merge)',
      );

      let overallLastBlockProcessedByNetwork = Number(currentNetworkCache.lastBlock) || 0;
      const floorBlock = initialLastBlockSBT;
      if (overallLastBlockProcessedByNetwork < floorBlock) {
        overallLastBlockProcessedByNetwork = floorBlock;
      }
      currentNetworkCache.lastBlock = overallLastBlockProcessedByNetwork;

      await runPriorityFeaturedMetadataPass();

      // Cache-first: skip discovery if cache is within REORG_BUFFER of chain tip
      const SBT_REORG_BUFFER = 10;
      const hasCachedSbts = Object.keys(currentSbtListForNetwork).length > 0;
      if (hasCachedSbts && overallLastBlockProcessedByNetwork >= baseTo - SBT_REORG_BUFFER) {
        mainSiteLog.log(
          `[SBT Full] Cache is fresh (lastBlock=${overallLastBlockProcessedByNetwork}, tip=${baseTo}). Skipping discovery scan.`,
        );
        updateFullScanProgress(fullScanTotalUnits, true);
        currentNetworkCache.lastBlock = overallLastBlockProcessedByNetwork;
        writeSbtCache(slug, globalCache);
        writeFlag('sbt:deferredFullScanNeeded', slug, false);
        writeFlag('sbt:partialReady', slug, true);
        setState((prev) => ({ isSBTCacheReady: true, sbtCacheRevision: prev.sbtCacheRevision + 1 }));
        return;
      }

      // Discovery: new SBTs from factory since our last watermark
      let newSbtsEventsFromDiscovery = [];
      let discoveryScanSucceeded = true;
      const fromBlockForSbtDiscovery = overallLastBlockProcessedByNetwork + 1;
      if (fromBlockForSbtDiscovery <= baseTo) {
        try {
          newSbtsEventsFromDiscovery = await contractScripts.getSbtsCreated(
            providerForReads,
            fromBlockForSbtDiscovery,
            baseTo,
            slug,
            {
              onProgress: (progress) => {
                const totalBlocks = Number(progress?.totalBlocks || 0);
                const scannedBlocks = Number(progress?.scannedBlocks || 0);
                const ratio = totalBlocks > 0 ? Math.max(0, Math.min(1, scannedBlocks / totalBlocks)) : 1;
                updateFullScanProgress(Math.floor(ratio * SBT_FULL_SCAN_DISCOVERY_UNITS));
              },
            },
          );
          updateFullScanProgress(SBT_FULL_SCAN_DISCOVERY_UNITS, true);
          if (newSbtsEventsFromDiscovery.length > 0) {
            await new Promise((resolve) => setTimeout(resolve, API_CALL_DELAY));
          }
        } catch (discErr) {
          discoveryScanSucceeded = false;
          mainSiteLog.error('Error during SBT discovery scan:', discErr);
        }
      } else {
        updateFullScanProgress(SBT_FULL_SCAN_DISCOVERY_UNITS, true);
      }

      const existingSbtAddresses = Object.keys(currentSbtListForNetwork).map((a) => a.toLowerCase());
      const newSbtAddresses = newSbtsEventsFromDiscovery.map((sbt) => sbt.sbtAddress.toLowerCase());
      const allSbtAddressesToProcessFully = [...new Set([...existingSbtAddresses, ...newSbtAddresses])];
      const discoveryByLower = new Map(
        newSbtsEventsFromDiscovery
          .filter((sbt) => sbt && sbt.sbtAddress)
          .map((sbt) => [sbt.sbtAddress.toLowerCase(), sbt]),
      );
      const totalSbtProcessCount = Math.max(0, allSbtAddressesToProcessFully.length);
      if (totalSbtProcessCount === 0) {
        updateFullScanProgress(fullScanTotalUnits, true);
      }
      const finalProcessedSbtsMap = { ...currentSbtListForNetwork };
      const sbtHistoryFromBlock = baseFrom;

      for (let i = 0; i < allSbtAddressesToProcessFully.length; i += BATCH_SIZE) {
        const batch = allSbtAddressesToProcessFully.slice(i, i + BATCH_SIZE);
        const batchRatios = batch.map(() => 0);
        const updateBatchProgress = (index, ratio, force = false) => {
          if (index < 0 || index >= batchRatios.length) return;
          const safeRatio = Math.max(0, Math.min(1, Number(ratio || 0)));
          if (safeRatio <= batchRatios[index]) return;
          batchRatios[index] = safeRatio;
          // Regression guard: map concurrent per-SBT sub-scan callbacks into a
          // batch average so session-level block numbers stay monotonic and do not
          // jump to the chain tip just because one nested log phase completed early.
          const batchCompletionRatio =
            batch.length > 0 ? batchRatios.reduce((sum, value) => sum + value, 0) / batch.length : 1;
          const processedRatio =
            totalSbtProcessCount > 0 ? (i + batchCompletionRatio * batch.length) / totalSbtProcessCount : 1;
          updateFullScanProgress(
            SBT_FULL_SCAN_DISCOVERY_UNITS + Math.floor(processedRatio * SBT_FULL_SCAN_PROCESS_UNITS),
            force,
          );
        };
        const batchPromises = batch.map(async (sbtAddressLower, batchIndex) => {
          try {
            const sbtAlreadyInMap = finalProcessedSbtsMap[sbtAddressLower];
            const discoveryEntry = discoveryByLower.get(sbtAddressLower);
            const isNewSBTFromFactoryScan = newSbtAddresses.includes(sbtAddressLower);
            let originalCaseAddress = sbtAddressLower;
            const knownOriginal =
              sbtAlreadyInMap?.sbtAddress ||
              discoveryEntry?.sbtAddress ||
              generalFeaturedSbtList.find((s) => s.toLowerCase() === sbtAddressLower);
            if (knownOriginal) originalCaseAddress = knownOriginal;

            // Metadata (pass slug)
            let sbtInfoToUse;
            if (isNewSBTFromFactoryScan || !sbtAlreadyInMap?.sbtInfo) {
              sbtInfoToUse = await contractScripts.getSbtMetadata(providerForReads, originalCaseAddress, slug);
              if (!sbtInfoToUse) {
                mainSiteLog.warn(`Skipping SBT ${originalCaseAddress} due to metadata fetch failure in main pass.`);
                return null;
              }
            } else {
              sbtInfoToUse = sbtAlreadyInMap.sbtInfo;
            }

            // One-shot counts helper (unique arrays + counts + totals)
            const cachedCreation = sbtAlreadyInMap?.creationBlock ?? sbtAlreadyInMap?.sbtInfo?.creationBlock;
            const discoveryCreation = discoveryEntry?.creationBlock;
            const metaCreation = sbtInfoToUse?.creationBlock;
            const creationBlock = resolveSbtCreationBlock(cachedCreation, discoveryCreation, metaCreation);

            const historyFromBlock = Number.isFinite(creationBlock)
              ? Math.max(sbtHistoryFromBlock, creationBlock)
              : sbtHistoryFromBlock;

            const existingCounts = {
              mintedCountByAddress: sbtAlreadyInMap?.mintedCountByAddress || {},
              burnedCountByAddress: sbtAlreadyInMap?.burnedCountByAddress || {},
              mintedEventCount: sbtAlreadyInMap?.mintedEventCount || 0,
              burnedEventCount: sbtAlreadyInMap?.burnedEventCount || 0,
            };

            const existingBlock = Number(sbtAlreadyInMap?.blockNumber);
            let countsResult = null;
            let countsBlock = baseTo;
            let countsOk = true;
            const handleCountsProgress = (progress) => {
              const ratioCandidate = Number(progress?.completionRatio);
              const fallbackRatio =
                Number(progress?.totalBlocks || 0) > 0
                  ? Math.max(0, Math.min(1, Number(progress?.scannedBlocks || 0) / Number(progress?.totalBlocks || 0)))
                  : 1;
              updateBatchProgress(batchIndex, Number.isFinite(ratioCandidate) ? ratioCandidate : fallbackRatio);
            };

            if (!historyEnabled) {
              const mintedAddresses = (sbtAlreadyInMap?.mintedAddresses || []).map((a) => (a || '').toLowerCase());
              const burnedAddresses = (sbtAlreadyInMap?.burnedAddresses || []).map((a) => (a || '').toLowerCase());
              updateBatchProgress(batchIndex, 1, true);

              return hydrateSbtActivityCacheEntry({
                sbtAddress: originalCaseAddress,
                sbtInfo: sbtInfoToUse,
                mintedAddresses,
                burnedAddresses,
                creationBlock: Number.isFinite(creationBlock) ? creationBlock : null,
                countsLoaded: sbtAlreadyInMap?.countsLoaded === true,
                mintedCountByAddress: existingCounts.mintedCountByAddress,
                burnedCountByAddress: existingCounts.burnedCountByAddress,
                mintedEventCount: existingCounts.mintedEventCount,
                burnedEventCount: existingCounts.burnedEventCount,
                historySummary: normalizeSbtHistorySummary(sbtAlreadyInMap?.historySummary),
                blockNumber: Number.isFinite(existingBlock) ? existingBlock : baseTo,
              });
            }

            if (sbtAlreadyInMap?.countsLoaded && Number.isFinite(existingBlock)) {
              const scanFrom = Math.max(existingBlock + 1, historyFromBlock);
              if (scanFrom <= baseTo) {
                const delta = await contractScripts.getSbtMintBurnCountsByAddress(
                  'none',
                  originalCaseAddress,
                  scanFrom,
                  baseTo,
                  slug,
                  { onProgress: handleCountsProgress },
                );
                if (delta?.ok === false) {
                  countsResult = existingCounts;
                  countsBlock = existingBlock;
                  countsOk = false;
                } else {
                  countsResult = mergeSbtCountsPayload(existingCounts, delta);
                  countsBlock = baseTo;
                  countsOk = true;
                }
              } else {
                countsResult = existingCounts;
                countsBlock = existingBlock;
                countsOk = true;
              }
            }

            if (!countsResult) {
              const fullCounts = await contractScripts.getSbtMintBurnCountsByAddress(
                'none',
                originalCaseAddress,
                historyFromBlock,
                baseTo,
                slug,
                { onProgress: handleCountsProgress },
              );
              if (fullCounts?.ok === false) {
                countsResult = existingCounts;
                countsBlock = Number.isFinite(existingBlock) ? existingBlock : baseTo;
                countsOk = false;
              } else {
                countsResult = fullCounts;
                countsBlock = baseTo;
                countsOk = true;
              }
            }

            const mintedMap = countsResult?.mintedCountByAddress || {};
            const burnedMap = countsResult?.burnedCountByAddress || {};
            const mintedAddresses = Object.keys(mintedMap).map((a) => a.toLowerCase());
            const burnedAddresses = Object.keys(burnedMap).map((a) => a.toLowerCase());
            const existingHasCounts =
              Object.keys(existingCounts.mintedCountByAddress || {}).length > 0 ||
              Object.keys(existingCounts.burnedCountByAddress || {}).length > 0;
            const countsLoadedFlag = countsOk ? true : sbtAlreadyInMap?.countsLoaded === true && existingHasCounts;
            const mintedEventCount = countsOk
              ? countsResult?.mintedEventCount || 0
              : existingCounts.mintedEventCount || 0;
            const burnedEventCount = countsOk
              ? countsResult?.burnedEventCount || 0
              : existingCounts.burnedEventCount || 0;
            const historySummary = countsOk
              ? buildSbtHistorySummaryFromCounts({
                  mintedCountByAddress: mintedMap,
                  burnedCountByAddress: burnedMap,
                  mintedEventCount,
                  burnedEventCount,
                })
              : normalizeSbtHistorySummary(sbtAlreadyInMap?.historySummary);
            const finalCountsBlock = countsOk
              ? countsBlock
              : Number.isFinite(existingBlock)
                ? existingBlock
                : countsBlock;
            updateBatchProgress(batchIndex, 1, true);

            return hydrateSbtActivityCacheEntry({
              sbtAddress: originalCaseAddress,
              sbtInfo: sbtInfoToUse,
              mintedAddresses,
              burnedAddresses,
              creationBlock: Number.isFinite(creationBlock) ? creationBlock : null,
              countsLoaded: countsLoadedFlag,
              mintedCountByAddress: mintedMap,
              burnedCountByAddress: burnedMap,
              mintedEventCount,
              burnedEventCount,
              historySummary: historySummary || null,
              blockNumber: finalCountsBlock,
            });
          } catch (error) {
            updateBatchProgress(batchIndex, 1, true);
            mainSiteLog.error(`Error processing SBT ${sbtAddressLower} in main pass:`, error);
            return null;
          }
        });
        const batchResults = await Promise.all(batchPromises);

        batchResults.forEach((result) => {
          if (result && result.sbtAddress) {
            finalProcessedSbtsMap[result.sbtAddress.toLowerCase()] = result;

            // Update user cache (SBT holders)
            // Iterate minters. If they haven't burned it, they own it.
            // We update their cache entry with this SBT.
            if (historyEnabled) {
              const currentHolderAddresses = getCurrentHolderAddressesFromCounts({
                mintedCountByAddress: result.mintedCountByAddress,
                burnedCountByAddress: result.burnedCountByAddress,
              });
              currentHolderAddresses.forEach((holder) => {
                const uData = ensureUserNode(holder, baseTo);
                if (!uData.sbts) uData.sbts = [];

                // Idempotency check: Prevent duplicate SBT entries
                const resultSbtAddressLower = String(result.sbtAddress || '').toLowerCase();
                if (!uData.sbts.some((s) => String(s?.sbtAddress || '').toLowerCase() === resultSbtAddressLower)) {
                  uData.sbts.push({
                    sbtAddress: result.sbtAddress,
                    sbtInfo: result.sbtInfo,
                  });
                  userCacheModified = true;
                }
              });
            }
          }
        });
        if (i + BATCH_SIZE < allSbtAddressesToProcessFully.length) {
          await new Promise((resolve) => setTimeout(resolve, API_CALL_DELAY));
        }
      }

      updateFullScanProgress(fullScanTotalUnits, true);
      currentNetworkCache.lastBlock = discoveryScanSucceeded ? baseTo : overallLastBlockProcessedByNetwork;
      currentNetworkCache.sbtList = finalProcessedSbtsMap;
      writeSbtCache(slug, globalCache);

      // Write user cache
      if (userCacheModified) {
        dgWrite('userCache', slug, userCache);
      }

      writeFlag('sbt:deferredFullScanNeeded', slug, !discoveryScanSucceeded);
      writeFlag('sbt:partialReady', slug, true);

      setState((prev) => ({ isSBTCacheReady: true, sbtCacheRevision: prev.sbtCacheRevision + 1 }));
      if (discoveryScanSucceeded) {
        mainSiteLog.log('initializeSbtCacheForGroup: Full discovery & processing complete.');
      } else {
        mainSiteLog.warn(
          'initializeSbtCacheForGroup: Full scan persisted existing SBT updates but left discovery watermark behind after a factory scan failure.',
          {
            slug,
            networkID,
            lastBlock: overallLastBlockProcessedByNetwork,
            retryToBlock: baseTo,
          },
        );
      }
    } finally {
      writeFlag('sbt:fullScanInProgress', slug, false);
      clearSbtLiveProgress(slug, liveProgressToken);
    }
  };

  const refreshSbtData = (sbtAddressParam, slug, options) =>
    refreshSbtDataForGroup(slug || getActiveSessionSlug(), sbtAddressParam, options);

  const refreshSbtDataForGroup = async (slug, sbtAddressParam, options = {}) => {
    let flushCountsCheckpointWrite = () => false;
    // Sentinel check: '*' or '**FULL**' implies a full re-scan of the SBT universe
    if (sbtAddressParam === '*' || sbtAddressParam === '**FULL**' || sbtAddressParam == null) {
      try {
        // Stale-while-revalidate pattern:
        // Check if we have existing data in the cache for this group/network.
        // If data exists, we do not set isSBTCacheReady to false. We let the old data
        // remain visible (stale) while the background scan runs.
        // We only show the "loading" state (false) if this is a true cold start (no data).
        const networkID = String(getSessionChainId(slug) || '');
        const existingCache = dgRead('sbtCache', slug, { clone: false });
        const hasData =
          existingCache && existingCache[networkID] && Object.keys(existingCache[networkID].sbtList || {}).length > 0;

        if (!hasData) {
          setReadinessStateIfChanged({ isSBTCacheReady: false });
        } else {
          if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
            mainSiteLog.log(
              `[MainSite] refreshSbtData: Keeping stale data visible during full scan for group '${slug}'.`,
            );
          }
        }

        if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
          mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: refreshSbtData sentinel => full SBT rescan', { slug });
        }

        await initializeSbtCacheForGroup(slug, { mode: 'full' });
        startSbtEventListenerForGroup(slug);
      } catch (e) {
        mainSiteLog.error('[refreshSbtDataForGroup] Full rescan failed:', e);
        // Ensure we unblock UI even on failure
        setSbtReadinessForActiveSlug(slug);
      }
      return;
    }

    try {
      const networkID = String(getSessionChainId(slug) || '');
      if (!networkID || !sbtAddressParam) return;
      const forceCounts = !!options.forceCounts;
      const countsOnly = options.countsOnly === true;
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

      const sbtAddressOriginalCase = sbtAddressParam;
      const sbtLower = sbtAddressOriginalCase.toLowerCase();

      const { fromBlock: baseFrom, toBlock: baseTo } = await contractScripts.getRelevantBlockWindowForFilter(
        getSessionBlockWindowRef(slug),
      );
      const initialLastBlockSBT = Math.max(0, baseFrom - 1);

      // Read cache entry to decide whether we only need tokenURI metadata
      let cache = dgRead('sbtCache', slug) || {};
      // numeric → string merge (defensive)
      mergeLegacyNumericNetworkKey(cache, networkID);
      if (!cache[networkID]) cache[networkID] = { sbtList: {}, lastBlock: initialLastBlockSBT };
      if (!cache[networkID].sbtList) cache[networkID].sbtList = {};

      const existing = hydrateSbtActivityCacheEntry(cache[networkID].sbtList[sbtLower]) || {};
      const info = existing?.sbtInfo || null;
      const existingHistorySummary = normalizeSbtHistorySummary(existing?.historySummary);

      const needsTokenUriFields = (i) => !hasCoreSbtMetadata(i);
      const metadataMarkedStale = info?.burnAuthNeedsOnChainRefresh === true;

      let cachedCreationBlock = resolveSbtCreationBlock(
        existing?.creationBlock,
        existing?.sbtInfo?.creationBlock,
        info?.creationBlock,
      );
      const loadHistorySummary = async () => {
        try {
          const summary = await contractScripts.getSbtHistorySummary('none', sbtAddressOriginalCase, slug);
          return normalizeSbtHistorySummary(summary);
        } catch (err) {
          mainSiteLog.warn('[refreshSbtDataForGroup] history summary fallback:', err);
          return null;
        }
      };

      // Metadata-only on-demand hydration (no events)
      let sbtInfoOverride = null;
      if (needsTokenUriFields(info)) {
        const sbtInfo = await contractScripts.getSbtMetadata('none', sbtAddressOriginalCase, slug);
        if (!sbtInfo) {
          mainSiteLog.warn(`[refreshSbtDataForGroup] No metadata for ${sbtAddressOriginalCase}; aborting hydration.`);
          return;
        }
        const creationBlock = resolveSbtCreationBlock(
          existing?.creationBlock,
          existing?.sbtInfo?.creationBlock,
          sbtInfo?.creationBlock,
        );
        const historySummary = !forceCounts
          ? (await loadHistorySummary()) || existingHistorySummary
          : existingHistorySummary;
        cache[networkID].sbtList[sbtLower] = hydrateSbtActivityCacheEntry({
          ...existing,
          sbtAddress: sbtAddressOriginalCase,
          sbtInfo,
          slug,
          creationBlock: creationBlock != null ? creationBlock : null,
          historySummary: historySummary || null,
        };
        dgWrite('sbtCache', slug, cache);
        setState((prev) => ({ sbtCacheRevision: prev.sbtCacheRevision + 1 }));
        if (window.ENABLE_RPC_DEBUG_LOGGING === true)
          mainSiteLog.log('[refreshSbtDataForGroup] Metadata-only hydration for', sbtAddressOriginalCase);
        if (!forceCounts) {
          return; // do NOT scan events in this path
        }
        sbtInfoOverride = sbtInfo;
      }

      const shouldReuseCachedMetadataForForcedCountScan =
        forceCounts && countsOnly && !needsTokenUriFields(info) && !metadataMarkedStale;
      const sbtInfoPromise = sbtInfoOverride
        ? Promise.resolve(sbtInfoOverride)
        : shouldReuseCachedMetadataForForcedCountScan
          ? Promise.resolve(info)
          : contractScripts.getSbtMetadata('none', sbtAddressOriginalCase, slug);

      if (!forceCounts) {
        const sbtInfo = await sbtInfoPromise;
        if (!sbtInfo) {
          mainSiteLog.warn(`[refreshSbtDataForGroup] No metadata for ${sbtAddressOriginalCase}; aborting refresh.`);
          return;
        }
        const creationBlock = resolveSbtCreationBlock(
          existing?.creationBlock,
          existing?.sbtInfo?.creationBlock,
          sbtInfo?.creationBlock,
        );
        const historySummary = (await loadHistorySummary()) || existingHistorySummary;
        cache[networkID].sbtList[sbtLower] = hydrateSbtActivityCacheEntry({
          ...existing,
          sbtAddress: sbtAddressOriginalCase,
          sbtInfo,
          slug,
          creationBlock: creationBlock != null ? creationBlock : null,
          historySummary: historySummary || null,
        };
        dgWrite('sbtCache', slug, cache);
        setState((prev) => ({ sbtCacheRevision: prev.sbtCacheRevision + 1 }));
        return;
      }

      let sessionSlugForLookup = '';
      let hasExplicitSessionSlugForLookup = !!(
        info &&
        Object.prototype.hasOwnProperty.call(info, 'sessionSlug') &&
        info.sessionSlugExplicit === true
      );
      if (hasExplicitSessionSlugForLookup) {
        sessionSlugForLookup = normalizeSessionSlug(info?.sessionSlug || '');
      }
      if (!hasExplicitSessionSlugForLookup) {
        try {
          const metaForGroup = await sbtInfoPromise;
          if (
            metaForGroup &&
            Object.prototype.hasOwnProperty.call(metaForGroup, 'sessionSlug') &&
            metaForGroup.sessionSlugExplicit === true
          ) {
            hasExplicitSessionSlugForLookup = true;
            sessionSlugForLookup = normalizeSessionSlug(metaForGroup.sessionSlug || '');
          }
        } catch (e) {
          mainSiteLog.warn('MainSite: fallback', e);
        }
      }
      const creationLookupOptions = hasExplicitSessionSlugForLookup ? { sessionSlug: sessionSlugForLookup } : {};

      let creationBlockFromLookup = null;
      if (cachedCreationBlock == null) {
        creationBlockFromLookup = await contractScripts.getSbtCreationBlockByAddress(
          'none',
          sbtAddressOriginalCase,
          slug,
          creationLookupOptions,
        );
        if (Number.isFinite(creationBlockFromLookup)) {
          cachedCreationBlock = creationBlockFromLookup;
        }
      }

      const startBlock = cachedCreationBlock != null ? Math.max(baseFrom, cachedCreationBlock) : baseFrom;
      const normalizeCountsScanCheckpoint = (checkpointIn) =>
        normalizeSbtCountsScanCheckpoint(checkpointIn, { startBlock, toBlock: baseTo });
      let latestCountsCheckpoint = normalizeCountsScanCheckpoint(existing?.countsScanCheckpoint);
      let hasPendingCountsCheckpointWrite = false;
      let lastCountsCheckpointWriteMs = 0;
      const SBT_COUNTS_CHECKPOINT_WRITE_MIN_MS = 750;
      flushCountsCheckpointWrite = ({ force = false } = {}) => {
        if (!hasPendingCountsCheckpointWrite) return false;
        const nowMs = Date.now();
        if (!force && nowMs - lastCountsCheckpointWriteMs < SBT_COUNTS_CHECKPOINT_WRITE_MIN_MS) {
          return false;
        }
        writeSbtCache(slug, cache);
        hasPendingCountsCheckpointWrite = false;
        lastCountsCheckpointWriteMs = nowMs;
        return true;
      };
      const queueCountsCheckpointWrite = ({ force = false } = {}) => {
        hasPendingCountsCheckpointWrite = true;
        return flushCountsCheckpointWrite({ force });
      };
      // Persist resumable scan state for the holders modal so a refresh can continue
      // from the last processed block instead of replaying the entire history window.
      const persistCountsScanCheckpoint = (checkpointIn, sbtInfoForCache = null) => {
        const normalized = normalizeCountsScanCheckpoint(checkpointIn);
        if (!normalized) return;
        latestCountsCheckpoint = normalized;
        const currentEntry = cache[networkID].sbtList[sbtLower] || {};
        const nextSbtInfo = sbtInfoForCache || currentEntry.sbtInfo || info || null;
        // Regression guard: resumable checkpoints must stay isolated from finalized
        // holder fields. Publishing partial counts here lets cache readers treat an
        // incomplete scan as authoritative and can later double-merge the same range.
        cache[networkID].sbtList[sbtLower] = hydrateSbtActivityCacheEntry({
          ...currentEntry,
          sbtAddress: sbtAddressOriginalCase,
          ...(nextSbtInfo ? { sbtInfo: nextSbtInfo } : {}),
          countsLoaded: false,
          countsScanCheckpoint: normalized,
        });
        queueCountsCheckpointWrite();
      };

      // Original behavior (metadata + counts) when metadata is already complete
      const existingCounts = {
        mintedCountByAddress: existing?.mintedCountByAddress || {},
        burnedCountByAddress: existing?.burnedCountByAddress || {},
        mintedEventCount: existing?.mintedEventCount || 0,
        burnedEventCount: existing?.burnedEventCount || 0,
      };

      // Regression guard: once a scan is finalized, resume watermarks must come from
      // the finalized entry block. Reusing an older checkpoint here double-counts the
      // already-hydrated range when a later force-refresh merges a delta scan.
      const existingBlock =
        existing?.countsLoaded === true
          ? Number(existing?.blockNumber)
          : Number.isFinite(Number(latestCountsCheckpoint?.blockNumber))
            ? Number(latestCountsCheckpoint.blockNumber)
            : Number(existing?.blockNumber);
      let countsPromise;
      let countsBlock = baseTo;

      const progressHandler = onProgress
        ? (info) => {
            try {
              onProgress({ ...info, sbtAddress: sbtAddressOriginalCase, slug });
            } catch (e) {
              mainSiteLog.warn('MainSite: callback', e);
            }
          }
        : null;
      const countOptionsBase = progressHandler ? { onProgress: progressHandler } : {};
      const checkpointedCountOptions = {
        ...countOptionsBase,
        onCheckpoint: (checkpoint) => {
          persistCountsScanCheckpoint(checkpoint, sbtInfoOverride || info || null);
        },
      };
      const countOptions = Object.keys(countOptionsBase).length > 0 ? countOptionsBase : null;
      const resumeCheckpoint = latestCountsCheckpoint;
      const checkpointAlreadyCoversWindow =
        !existing?.countsLoaded &&
        resumeCheckpoint &&
        resumeCheckpoint.phase === 'activity' &&
        Number.isFinite(Number(resumeCheckpoint.blockNumber)) &&
        Number(resumeCheckpoint.blockNumber) >= baseTo;
      const canResumeFromCheckpoint =
        !existing?.countsLoaded &&
        resumeCheckpoint &&
        Number.isFinite(Number(resumeCheckpoint.blockNumber)) &&
        Number(resumeCheckpoint.blockNumber) >= startBlock - 1 &&
        Number(resumeCheckpoint.blockNumber) < baseTo;
      const initialProgressSeedBlock =
        existing?.countsLoaded === true && Number.isFinite(existingBlock)
          ? existingBlock
          : Number(resumeCheckpoint?.blockNumber ?? startBlock - 1);
      const initialProgress = buildSbtCountsInitialProgress({
        startBlock,
        toBlock: baseTo,
        seedBlock: initialProgressSeedBlock,
      });
      if (progressHandler && initialProgress) {
        progressHandler(initialProgress);
      }

      if (existing?.countsLoaded && Number.isFinite(existingBlock)) {
        const scanFrom = Math.max(existingBlock + 1, startBlock);
        if (scanFrom <= baseTo) {
          countsPromise = contractScripts
            .getSbtMintBurnCountsByAddress('none', sbtAddressOriginalCase, scanFrom, baseTo, slug, countOptions)
            .then((delta) => {
              if (delta?.ok === false) return { ...existingCounts, ok: false };
              return { ...mergeSbtCountsPayload(existingCounts, delta), ok: true };
            });
          countsBlock = baseTo;
        } else {
          countsPromise = Promise.resolve(existingCounts);
          countsBlock = existingBlock;
        }
      } else if (checkpointAlreadyCoversWindow) {
        countsPromise = Promise.resolve({
          mintedCountByAddress: resumeCheckpoint.mintedCountByAddress || {},
          burnedCountByAddress: resumeCheckpoint.burnedCountByAddress || {},
          mintedEventCount: resumeCheckpoint.mintedEventCount || 0,
          burnedEventCount: resumeCheckpoint.burnedEventCount || 0,
          ok: true,
        });
        countsBlock = baseTo;
      } else if (canResumeFromCheckpoint) {
        countsPromise = contractScripts.getSbtMintBurnCountsByAddress(
          'none',
          sbtAddressOriginalCase,
          startBlock,
          baseTo,
          slug,
          {
            ...checkpointedCountOptions,
            resumeState: resumeCheckpoint,
          },
        );
        countsBlock = baseTo;
      } else {
        countsPromise = contractScripts.getSbtMintBurnCountsByAddress(
          'none',
          sbtAddressOriginalCase,
          startBlock,
          baseTo,
          slug,
          checkpointedCountOptions,
        );
        countsBlock = baseTo;
      }

      const [sbtInfo, counts] = await Promise.all([sbtInfoPromise, countsPromise]);
      if (!sbtInfo) {
        mainSiteLog.warn(`[refreshSbtDataForGroup] No metadata for ${sbtAddressOriginalCase}; aborting refresh.`);
        return;
      }

      const countsOk = counts?.ok !== false;
      const existingPublicMintedMap = normalizeSbtCountMap(existing?.mintedCountByAddress);
      const existingPublicBurnedMap = normalizeSbtCountMap(existing?.burnedCountByAddress);
      const mintedMap = countsOk ? counts?.mintedCountByAddress || {} : existingPublicMintedMap;
      const burnedMap = countsOk ? counts?.burnedCountByAddress || {} : existingPublicBurnedMap;
      const mintedAddresses = countsOk
        ? Object.keys(mintedMap || {}).map((a) => a.toLowerCase())
        : Array.isArray(existing?.mintedAddresses)
          ? existing.mintedAddresses
          : [];
      const burnedAddresses = countsOk
        ? Object.keys(burnedMap || {}).map((a) => a.toLowerCase())
        : Array.isArray(existing?.burnedAddresses)
          ? existing.burnedAddresses
          : [];
      const existingHasCounts =
        Object.keys(existingPublicMintedMap || {}).length > 0 || Object.keys(existingPublicBurnedMap || {}).length > 0;
      const countsLoadedFlag = countsOk ? true : existing?.countsLoaded === true && existingHasCounts;
      const mintedEventCount = countsOk ? counts?.mintedEventCount || 0 : existing?.mintedEventCount || 0;
      const burnedEventCount = countsOk ? counts?.burnedEventCount || 0 : existing?.burnedEventCount || 0;
      const historySummary = countsOk
        ? buildSbtHistorySummaryFromCounts({
            mintedCountByAddress: mintedMap || {},
            burnedCountByAddress: burnedMap || {},
            mintedEventCount,
            burnedEventCount,
          })
        : existingHistorySummary || null;
      const finalCountsBlock = countsOk
        ? countsBlock
        : Number.isFinite(Number(existing?.blockNumber))
          ? Number(existing.blockNumber)
          : Number.isFinite(existingBlock)
            ? existingBlock
            : null;
      const creationBlock = resolveSbtCreationBlock(
        creationBlockFromLookup,
        existing?.creationBlock,
        existing?.sbtInfo?.creationBlock,
        sbtInfo?.creationBlock,
      );

      cache[networkID].sbtList[sbtLower] = hydrateSbtActivityCacheEntry({
        ...(cache[networkID].sbtList[sbtLower] || {}),
        sbtAddress: sbtAddressOriginalCase,
        sbtInfo,
        mintedAddresses,
        burnedAddresses,
        creationBlock: creationBlock != null ? creationBlock : null,
        countsLoaded: countsLoadedFlag,
        mintedCountByAddress: mintedMap || {},
        burnedCountByAddress: burnedMap || {},
        mintedEventCount,
        burnedEventCount,
        historySummary: historySummary || null,
        blockNumber: finalCountsBlock,
        countsScanCheckpoint: countsOk ? null : latestCountsCheckpoint || null,
      };

      dgWrite('sbtCache', slug, cache);
      setState((prev) => ({ sbtCacheRevision: prev.sbtCacheRevision + 1 }));
      if (window.ENABLE_RPC_DEBUG_LOGGING === true)
        mainSiteLog.log('[refreshSbtDataForGroup] Updated single SBT (full) entry:', {
          sbt: sbtAddressOriginalCase,
          baseTo,
        });
    } catch (err) {
      try {
        flushCountsCheckpointWrite({ force: true });
      } catch (e) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
      mainSiteLog.error('[refreshSbtDataForGroup] Failed:', err);
    }
  };

  const startSbtEventListener = () => startSbtEventListenerForGroup(getActiveSessionSlug());

  const startSbtEventListenerForGroup = (slugIn) => {
    const slug = normalizeSessionSlug(slugIn || '');
    removeSbtRealtimeListenersForGroup(slug);

    // Per-instance SBT listener wiring (guarded; cache + network scoped)
    try {
      // Ensure we’re not double‑subscribed on this group’s chain
      if (shouldSkipSessionScanForSlug(slug, 'startSbtEventListenerForGroup')) return;
      eventStreamsPort.listenForSBTEvents('none', (e) => onNewSbtEventDetectedForGroup(slug, e), slug);

      const networkID = String(getSessionChainId(slug) || '');
      if (!networkID) {
        if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
          mainSiteLog.log('[SBT Instances] No network ID; skipping instance listeners.', { slug });
        }
        return;
      }

      const cache = dgRead('sbtCache', slug, { clone: false }) || {};
      const sbtList = cache[networkID]?.sbtList || {};
      const allowInstanceListeners = isSbtInstanceListenerEnabledForGroup(slug);
      const hasMaxOverride = typeof window !== 'undefined' && typeof window.MAX_SBT_INSTANCE_LISTENERS !== 'undefined';
      const instanceListenerPlan = getSbtInstanceListenerPlan({
        allowInstanceListeners,
        maxOverridePresent: hasMaxOverride,
        maxOverrideValue: typeof window !== 'undefined' ? window.MAX_SBT_INSTANCE_LISTENERS : undefined,
        networkID,
        sbtList,
      });

      if (instanceListenerPlan.reason === 'empty-cache') {
        setSbtRealtimeCoverageForGroup(slug, true);
        if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
          mainSiteLog.log('[SBT Instances] No SBT addresses found in cache; not attaching instance listeners.', {
            slug,
            networkID,
          });
        }
        return;
      }

      if (instanceListenerPlan.reason === 'disabled') {
        if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
          mainSiteLog.log('[SBT Instances] Disabled for this group; skipping instance listeners.', { slug, networkID });
        }
        return;
      }

      if (instanceListenerPlan.reason === 'max-disabled') {
        if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
          mainSiteLog.log('[SBT Instances] MAX_SBT_INSTANCE_LISTENERS <= 0; skipping instance listeners.', {
            slug,
            networkID,
            max: instanceListenerPlan.maxInstanceListeners,
          });
        }
        return;
      }

      if (instanceListenerPlan.reason === 'too-many') {
        mainSiteLog.warn('[SBT Instances] Too many SBTs for per-instance listeners; skipping.', {
          slug,
          networkID,
          count: instanceListenerPlan.count,
          max: instanceListenerPlan.maxInstanceListeners,
        });
        return;
      }

      eventStreamsPort.listenForSBTInstanceEvents(
        'none',
        instanceListenerPlan.addresses,
        (e) => onNewSbtEventDetectedForGroup(slug, e),
        slug,
      );
      setSbtRealtimeCoverageForGroup(slug, true);

      if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
        mainSiteLog.log('[SBT Instances] Instance listeners attached.', {
          slug,
          networkID,
          count: instanceListenerPlan.count,
        });
      }
    } catch (err) {
      clearSbtRealtimeCoverageForGroup(slug);
      mainSiteLog.error('[SBT Instances] Failed to attach instance listeners:', err);
    }
  };

  const startSbtDetailInstanceListenerForGroup = (slugIn, addressesIn = []) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const addresses = (Array.isArray(addressesIn) ? addressesIn : [addressesIn])
      .map((address) => String(address || '').trim())
      .filter(Boolean);
    if (!slug || addresses.length === 0) return false;

    eventStreamsPort.listenForSBTInstanceEvents('none', addresses, (e) => onNewSbtEventDetectedForGroup(slug, e), slug);
    return true;
  };

  const onNewSbtEventDetected = async (event) => onNewSbtEventDetectedForGroup(getActiveSessionSlug(), event);

  const onNewSbtEventDetectedForGroup = async (slug, event) => {
    // event includes { type, sbtAddress, transactionHash, blockNumber }
    if (window.ENABLE_RPC_DEBUG_LOGGING === true)
      mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: onNewSbtEventDetectedForGroup invoked', { event, slug });
    mainSiteLog.log('onNewSbtEventDetectedForGroup() – invoked', event);

    const networkID = String(getSessionChainId(slug) || '');
    if (!networkID) {
      mainSiteLog.error('Network ID missing in onNewSbtEventDetectedForGroup');
      return;
    }

    const eventBlockNumber = await resolveSbtRealtimeEventBlockNumber({
      event,
      getReadProviderForSession,
      getRelevantBlockWindowForFilter: (slugRef) =>
        contractScripts.getRelevantBlockWindowForFilter(getSessionBlockWindowRef(slugRef)),
      log: mainSiteLog,
      slug,
    });

    const { fromBlock: baseFrom } = await contractScripts.getRelevantBlockWindowForFilter(
      getSessionBlockWindowRef(slug),
    );
    let currentCache = dgRead('sbtCache', slug) || {};
    const initialLastBlockSBT = Math.max(0, baseFrom - 1);
    // One-time migration: merge numeric-key (if any) into string key
    mergeLegacyNumericNetworkKey(currentCache, networkID);
    let networkCache = currentCache[networkID];
    if (!networkCache) {
      networkCache = { sbtList: {}, lastBlock: initialLastBlockSBT };
      currentCache[networkID] = networkCache;
    }
    if (!networkCache.sbtList) networkCache.sbtList = {};

    const overallLastBlockProcessedByNetwork = Number(networkCache.lastBlock) || 0;
    const cursorGuard = getSbtRealtimeEventCursorGuard({
      eventBlockNumber,
      transactionIndex: event?.transactionIndex,
      logIndex: event?.logIndex,
      lastRealtimeEventCursor: networkCache.lastRealtimeEventCursor,
      overallLastBlockProcessedByNetwork,
    });
    const { eventCursor, lastRealtimeCursor } = cursorGuard;
    if (cursorGuard.reason === 'cursor') {
      mainSiteLog.log('Skipping older or already processed ordered SBT event in onNewSbtEventDetectedForGroup.', {
        eventCursor,
        lastRealtimeCursor,
      });
      return;
    }
    if (cursorGuard.reason === 'block') {
      mainSiteLog.log('Skipping older or already processed SBT event in onNewSbtEventDetectedForGroup.', {
        eventBlockNumber,
        overallLastBlockProcessedByNetwork,
      });
      return;
    }

    if (event.type === 'SBTCreated') {
      await onSbtCreatedDetectedForGroup(slug, event.sbtAddress, eventBlockNumber, eventCursor);
    } else if (event.eventSignature === 'SBTActivity(address,uint256,bool)' && event.args) {
      await onSbtActivityDetectedForGroup(
        slug,
        event.address,
        event.args.account,
        event.args.burned === true,
        eventBlockNumber,
        eventCursor,
      );
    } else {
      mainSiteLog.log('Unhandled or irrelevant SBT event detected in onNewSbtEventDetectedForGroup:', event);
    }
  };

  const onSbtCreatedDetected = async (sbtAddressOriginalCase, eventBlockNumber) =>
    onSbtCreatedDetectedForGroup(getActiveSessionSlug(), sbtAddressOriginalCase, eventBlockNumber);

  const onSbtCreatedDetectedForGroup = async (slug, sbtAddressOriginalCase, eventBlockNumber, eventCursor = null) => {
    mainSiteLog.log('onSbtCreatedDetectedForGroup() – invoked for:', sbtAddressOriginalCase, 'slug:', slug);
    const networkID = String(getSessionChainId(slug) || '');
    if (!networkID) {
      mainSiteLog.error('onSbtCreatedDetectedForGroup: Network ID missing.');
      return;
    }

    const { fromBlock: baseFrom } = await contractScripts.getRelevantBlockWindowForFilter(
      getSessionBlockWindowRef(slug),
    );
    let currentCache = dgRead('sbtCache', slug) || {};
    const initialLastBlockSBT = Math.max(0, baseFrom - 1);
    // Merge any numeric-key cache into string key once
    mergeLegacyNumericNetworkKey(currentCache, networkID);
    if (!currentCache[networkID]) {
      currentCache[networkID] = { sbtList: {}, lastBlock: initialLastBlockSBT };
    }
    if (!currentCache[networkID].sbtList) {
      currentCache[networkID].sbtList = {};
    }
    let networkCache = currentCache[networkID];

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const sbtInfo = await contractScripts.getSbtMetadata('none', sbtAddressOriginalCase, slug);
      if (!sbtInfo) {
        mainSiteLog.error(
          `Failed to fetch metadata for new SBT ${sbtAddressOriginalCase} in onSbtCreatedDetectedForGroup. SBT will not be added to cache for this event.`,
        );
        return;
      }

      networkCache.sbtList[sbtAddressOriginalCase.toLowerCase()] = buildSbtActivityCacheEntry({
        sbtAddress: sbtAddressOriginalCase,
        sbtInfo,
        creationBlock: eventBlockNumber,
        blockNumber: eventBlockNumber,
      });
      networkCache.lastBlock = Math.max(networkCache.lastBlock || 0, eventBlockNumber);
      updateSbtRealtimeCursorForNetworkCache(networkCache, eventCursor);

      writeSbtCache(slug, currentCache);
      queueLocalRevisionUpdate({ needsSbtRevision: true });
      mainSiteLog.log('SBT cache updated with new SBT from onSbtCreatedDetectedForGroup:', sbtAddressOriginalCase);
      Promise.resolve().then(() => {
        startSbtEventListenerForGroup(slug);
      });
    } catch (error) {
      mainSiteLog.error(`Error handling SBTCreated event for ${sbtAddressOriginalCase}:`, error);
    }
  };

  const onSbtIssuedDetected = async (sbtAddressOriginalCase, toAddressOriginalCase, eventBlockNumber) =>
    onSbtIssuedDetectedForGroup(
      getActiveSessionSlug(),
      sbtAddressOriginalCase,
      toAddressOriginalCase,
      eventBlockNumber,
    );

  const onSbtIssuedDetectedForGroup = async (slug, sbtAddressOriginalCase, toAddressOriginalCase, eventBlockNumber) => {
    return onSbtActivityDetectedForGroup(slug, sbtAddressOriginalCase, toAddressOriginalCase, false, eventBlockNumber);
  };

  const onSbtActivityDetected = async (sbtAddressOriginalCase, accountOriginalCase, burned, eventBlockNumber) =>
    onSbtActivityDetectedForGroup(
      getActiveSessionSlug(),
      sbtAddressOriginalCase,
      accountOriginalCase,
      burned,
      eventBlockNumber,
    );

  const onSbtActivityDetectedForGroup = async (
    slug,
    sbtAddressOriginalCase,
    accountOriginalCase,
    burned,
    eventBlockNumber,
    eventCursor = null,
  ) => {
    mainSiteLog.log(
      'onSbtActivityDetectedForGroup() – invoked for SBT:',
      sbtAddressOriginalCase,
      'account:',
      accountOriginalCase,
      'burned:',
      burned,
      'slug:',
      slug,
    );
    const networkID = String(getSessionChainId(slug) || '');
    if (!networkID) {
      mainSiteLog.error('onSbtActivityDetectedForGroup: Network ID missing.');
      return;
    }

    const sbtAddressLower = sbtAddressOriginalCase.toLowerCase();
    const accountLower = String(accountOriginalCase || '').toLowerCase();

    const { fromBlock: baseFrom } = await contractScripts.getRelevantBlockWindowForFilter(
      getSessionBlockWindowRef(slug),
    );
    let currentCache = dgRead('sbtCache', slug) || {};
    const initialLastBlockSBT = Math.max(0, baseFrom - 1);
    mergeLegacyNumericNetworkKey(currentCache, networkID);
    if (!currentCache[networkID]) {
      currentCache[networkID] = { sbtList: {}, lastBlock: initialLastBlockSBT };
    }
    if (!currentCache[networkID].sbtList) {
      currentCache[networkID].sbtList = {};
    }
    let networkCache = currentCache[networkID];
    let sbtEntry = networkCache.sbtList[sbtAddressLower];

    if (!sbtEntry) {
      mainSiteLog.warn(
        `SBT ${sbtAddressOriginalCase} not found in cache during SBTActivity event. Attempting to fetch its metadata.`,
      );
      try {
        const sbtInfo = await contractScripts.getSbtMetadata('none', sbtAddressOriginalCase, slug);
        if (!sbtInfo) {
          mainSiteLog.error(
            `Failed to get metadata for SBT: ${sbtAddressOriginalCase} during SBTActivity event. Skipping update for this event.`,
          );
          return;
        }
        sbtEntry = {
          sbtAddress: sbtAddressOriginalCase,
          sbtInfo,
          mintedAddresses: [],
          burnedAddresses: [],
          blockNumber: 0,
          creationBlock: sbtInfo?.creationBlock ?? null,
          mintedCountByAddress: {},
          burnedCountByAddress: {},
          mintedEventCount: 0,
          burnedEventCount: 0,
          historySummary: {
            totalMinted: '0',
            totalBurned: '0',
            activeSupply: '0',
            currentHolderCount: '0',
            historicalHolderCount: '0',
          },
          countsLoaded: false,
        };
        networkCache.sbtList[sbtAddressLower] = sbtEntry;
      } catch (e) {
        mainSiteLog.error(
          `Error fetching metadata for uncached SBT ${sbtAddressOriginalCase} on SBTActivity event:`,
          e,
        );
        return;
      }
    }

    // Ensure arrays/maps exist
    if (!Array.isArray(sbtEntry.mintedAddresses)) sbtEntry.mintedAddresses = [];
    if (!Array.isArray(sbtEntry.burnedAddresses)) sbtEntry.burnedAddresses = [];
    if (typeof sbtEntry.mintedCountByAddress !== 'object' || !sbtEntry.mintedCountByAddress)
      sbtEntry.mintedCountByAddress = {};
    if (typeof sbtEntry.burnedCountByAddress !== 'object' || !sbtEntry.burnedCountByAddress)
      sbtEntry.burnedCountByAddress = {};
    if (typeof sbtEntry.mintedEventCount !== 'number') sbtEntry.mintedEventCount = 0;
    if (typeof sbtEntry.burnedEventCount !== 'number') sbtEntry.burnedEventCount = 0;
    if (typeof sbtEntry.countsLoaded !== 'boolean') sbtEntry.countsLoaded = false;
    hydrateLegacySbtCountState(sbtEntry);

    if (burned) {
      const hasBurnedAddress = sbtEntry.burnedAddresses.includes(accountLower);
      if (!hasBurnedAddress) {
        sbtEntry.burnedAddresses.push(accountLower);
      }
      const previousBurnedCount = Math.max(0, Math.floor(Number(sbtEntry.burnedCountByAddress[accountLower] || 0)));
      sbtEntry.burnedCountByAddress[accountLower] = previousBurnedCount + 1;
      sbtEntry.burnedEventCount += 1;
    } else {
      const hasMintedAddress = sbtEntry.mintedAddresses.includes(accountLower);
      if (!hasMintedAddress) {
        sbtEntry.mintedAddresses.push(accountLower);
      }
      const previousMintedCount = Math.max(0, Math.floor(Number(sbtEntry.mintedCountByAddress[accountLower] || 0)));
      sbtEntry.mintedCountByAddress[accountLower] = previousMintedCount + 1;
      sbtEntry.mintedEventCount += 1;
    }

    sbtEntry.historySummary =
      buildSbtHistorySummaryFromCounts({
        mintedCountByAddress: sbtEntry.mintedCountByAddress,
        burnedCountByAddress: sbtEntry.burnedCountByAddress,
        mintedEventCount: sbtEntry.mintedEventCount,
        burnedEventCount: sbtEntry.burnedEventCount,
      }) || normalizeSbtHistorySummary(sbtEntry.historySummary);

    sbtEntry.blockNumber = Math.max(sbtEntry.blockNumber || 0, eventBlockNumber);
    networkCache.lastBlock = Math.max(networkCache.lastBlock || 0, eventBlockNumber);
    updateSbtRealtimeCursorForNetworkCache(networkCache, eventCursor);

    writeSbtCache(slug, currentCache);
    queueLocalRevisionUpdate({ needsSbtRevision: true });
    mainSiteLog.log('SBT cache updated by SBTActivity event for:', sbtAddressOriginalCase);

    const connectedAccountLower = String(getAccount() || '').toLowerCase();
    if (!burned && connectedAccountLower && accountLower === connectedAccountLower) {
      refreshEncryptedQuestionPayloadsForGroup(slug, { force: true }).catch((err) => {
        mainSiteLog.warn('refreshEncryptedQuestionPayloadsForGroup failed after SBT mint event:', err);
      });
    }
  };

  const onSbtTransferDetected = async (sbtAddressOriginalCase, fromAddressOriginalCase, eventBlockNumber) =>
    onSbtTransferDetectedForGroup(
      getActiveSessionSlug(),
      sbtAddressOriginalCase,
      fromAddressOriginalCase,
      eventBlockNumber,
    );

  const onSbtTransferDetectedForGroup = async (
    slug,
    sbtAddressOriginalCase,
    fromAddressOriginalCase,
    eventBlockNumber,
  ) => {
    return onSbtActivityDetectedForGroup(slug, sbtAddressOriginalCase, fromAddressOriginalCase, true, eventBlockNumber);
  };

  const destroy = () => {
    sbtLiveProgressController.destroy();
    _sessionRouteLightDiscoveryInFlight = {};
    _lightSbtDiscoveryInFlight = {};
  };

  return {
    beginSbtLiveProgress,
    updateSbtLiveProgress,
    clearSbtLiveProgress,
    setSbtRealtimeCoverageForGroup,
    clearSbtRealtimeCoverageForGroup,
    normalizeSbtRealtimeEventCursor,
    compareSbtRealtimeEventCursor,
    removeSbtRealtimeListenersForGroup,
    ensureSessionRouteSbtDiscovery,
    ensureLightSbtDiscovery,
    ensureLightSbtUniverse,
    mergeSbtCountMaps,
    mergeSbtCountsPayload,
    normalizeSbtHistorySummary,
    normalizeSbtCountMap,
    sumSbtCountMap,
    seedSbtCountMapFromLegacyAddresses,
    hydrateLegacySbtCountState,
    buildSbtHistorySummaryFromCounts,
    getCurrentHolderAddressesFromCounts,
    initializeSbtCache,
    initializeSbtCacheWithGeneralBackfill,
    initializeSbtCacheForGroup,
    refreshSbtData,
    refreshSbtDataForGroup,
    startSbtEventListener,
    startSbtEventListenerForGroup,
    startSbtDetailInstanceListenerForGroup,
    onNewSbtEventDetected,
    onNewSbtEventDetectedForGroup,
    onSbtCreatedDetected,
    onSbtCreatedDetectedForGroup,
    onSbtIssuedDetected,
    onSbtIssuedDetectedForGroup,
    onSbtActivityDetected,
    onSbtActivityDetectedForGroup,
    onSbtTransferDetected,
    onSbtTransferDetectedForGroup,
    destroy,
  };
};
