import contractScripts, { normalizeSessionSlug } from '../web3/contractScripts.js';
import { createLogger } from 'utilities/logging.js';
import {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
  normalizeArweaveFailureMeta,
  shouldStopPendingMetadataRetry,
} from '../arweave/arweaveRetryHelpers.js';
import {
  DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE,
  readSessionScanMaxBlockRange,
  resolveValidatedSessionScanWindow,
} from '../session/sessionScanScope.js';
import { getGlobalLitHooks } from '../crypto/litProtocol.js';
import {
  buildQuestionDecryptContextForSession,
  hasMaskedQuestionPayloadImproved,
} from '../session/sessionQuestionDecryption.js';
import {
  buildQuestionReadyStatePatch,
  shouldClearQuestionProgressInFinalize,
  shouldCommitThrottledProgress,
  shouldFlushCoalescedRun,
} from '../../components/MainSite/progressHelpers.js';
import {
  MASKED_Q_DECRYPT_BACKOFF_MAX,
  MASKED_Q_DECRYPT_BACKOFF_TTL_MS,
} from '../../components/MainSite/cacheConstants.js';
import {
  isMaskedQuestionPayload,
  pickBetterQuestionPayload,
} from './questionRouting.js';

const mainSiteLog = createLogger('mainSite');

const mergePendingQuestionInitOpts = (prevOpts, nextOpts) => {
  const nextBackground = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.background === true);
  const nextSkipDiscoveryScan = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.skipDiscoveryScan === true);
  if (!prevOpts || typeof prevOpts !== 'object') {
    return {
      background: nextBackground,
      skipDiscoveryScan: nextSkipDiscoveryScan,
    };
  }
  const prevBackground = !!(prevOpts.background === true);
  const prevSkipDiscoveryScan = !!(prevOpts.skipDiscoveryScan === true);
  return {
    background: prevBackground && nextBackground,
    // If any queued caller needs a real discovery pass, do not keep skip mode.
    skipDiscoveryScan: prevSkipDiscoveryScan && nextSkipDiscoveryScan,
  };
};

export const createSessionQuestionCacheController = (host = {}) => {
  let _questionInitInFlight = {};
  let _questionInitPending = {};
  let _destroyed = false;
  let _continuationTimers = [];
  let _pendingQuestionMetadataRetryTimers = {};
  let _maskedQuestionRefreshInFlight = {};
  let _maskedQuestionRefreshPending = {};
  let _maskedQuestionRefreshLastStart = {};
  let _maskedQuestionRefreshCursor = {};
  let _maskedQuestionDecryptBackoff = new Map();

  const setState = (updater, cb) => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };
  const getState = () => (
    typeof host.getState === 'function' ? host.getState() || {} : {}
  );
  const isMounted = () => (
    typeof host.isMounted === 'function' ? host.isMounted() : false
  );
  const dgRead = (...args) => (
    typeof host.dgRead === 'function' ? host.dgRead(...args) : null
  );
  const dgWrite = (...args) => (
    typeof host.dgWrite === 'function' ? host.dgWrite(...args) : null
  );
  const getActiveSessionSlug = () => String(
    typeof host.getActiveSessionSlug === 'function' ? host.getActiveSessionSlug() || '' : ''
  );
  const getSessionCfg = (slug) => (
    typeof host.getSessionCfg === 'function' ? host.getSessionCfg(slug) : null
  );
  const getSessionChainId = (slug) => (
    typeof host.getSessionChainId === 'function' ? host.getSessionChainId(slug) : null
  );
  const getSessionScanScope = () => String(
    typeof host.getSessionScanScope === 'function' ? host.getSessionScanScope() || '' : ''
  );
  const getAccount = () => (
    typeof host.getAccount === 'function' ? host.getAccount() : ''
  );
  const getProviderLike = () => {
    if (typeof host.getProviderLike === 'function') return host.getProviderLike();
    if (typeof host.getProvider === 'function') return host.getProvider();
    return host.provider || '';
  };
  const getNetwork = () => {
    if (typeof host.getNetwork === 'function') return host.getNetwork();
    return host.network || null;
  };
  const scanScopeNoop = (slug, op, onSkipped) => (
    typeof host.scanScopeNoop === 'function' ? host.scanScopeNoop(slug, op, onSkipped) : false
  );
  const setReadinessStateIfChanged = (...args) => {
    if (typeof host.setReadinessStateIfChanged === 'function') {
      host.setReadinessStateIfChanged(...args);
    }
  };
  const checkAllCachesReady = () => {
    if (typeof host.checkAllCachesReady === 'function') {
      host.checkAllCachesReady();
    }
  };
  const mergeLegacyNumericNetworkKey = (cache, networkID) => (
    typeof host.mergeLegacyNumericNetworkKey === 'function'
      ? host.mergeLegacyNumericNetworkKey(cache, networkID)
      : false
  );
  const buildMetadataSessionCacheEnvelope = (...args) => (
    typeof host.buildMetadataSessionCacheEnvelope === 'function'
      ? host.buildMetadataSessionCacheEnvelope(...args)
      : { metadata: args?.[0] || {}, targetSlug: normalizeSessionSlug(args?.[1] || '') }
  );
  const writeQuestionMetadataToCache = (...args) => (
    typeof host.writeQuestionMetadataToCache === 'function'
      ? host.writeQuestionMetadataToCache(...args)
      : false
  );
  const queueLocalRevisionUpdate = (opts = {}) => {
    if (typeof host.queueLocalRevisionUpdate === 'function') {
      host.queueLocalRevisionUpdate(opts);
      return;
    }
    const shouldBumpQuestionResponsesNonce = !!opts?.needsQuestionResponsesNonce;
    const shouldCheckAllCachesReady = !!opts?.checkAllCachesReady;
    if (!shouldBumpQuestionResponsesNonce && !shouldCheckAllCachesReady) return;
    setState((prev) => {
      const next = {};
      if (shouldBumpQuestionResponsesNonce) {
        next.questionResponsesNonce = Number(prev?.questionResponsesNonce || 0) + 1;
      }
      return Object.keys(next).length ? next : null;
    }, () => {
      if (shouldCheckAllCachesReady) checkAllCachesReady();
    });
  };

  const isInitInFlight = (slugIn = '') => {
    const slug = normalizeSessionSlug(slugIn || '');
    return !!_questionInitInFlight?.[slug];
  };

  const destroy = () => {
    _destroyed = true;
    if (_pendingQuestionMetadataRetryTimers && typeof _pendingQuestionMetadataRetryTimers === 'object') {
      Object.values(_pendingQuestionMetadataRetryTimers).forEach((timer) => {
        try { clearTimeout(timer); } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
      });
    }
    _continuationTimers.forEach((timer) => {
      try { clearTimeout(timer); } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    });
    _continuationTimers = [];
    if (_maskedQuestionDecryptBackoff instanceof Map) {
      _maskedQuestionDecryptBackoff.clear();
    }
    _pendingQuestionMetadataRetryTimers = null;
    _questionInitInFlight = {};
    _questionInitPending = {};
    _maskedQuestionRefreshInFlight = {};
    _maskedQuestionRefreshPending = {};
    _maskedQuestionRefreshLastStart = null;
    _maskedQuestionRefreshCursor = {};
  };

  const hasMaskedQuestionPayloadInCache = (slug) => {
    const networkID = String(getSessionChainId(slug) || '');
    if (!networkID) return false;
    const questionsCache = dgRead('questionsCache', slug, { clone: false }) || {};
    const questionMap = questionsCache?.[networkID]?.questions;
    if (!questionMap || typeof questionMap !== 'object') return false;
    return Object.values(questionMap).some((q) => isMaskedQuestionPayload(q));
  };

  const buildQuestionDecryptContext = (slug) => {
    const cfg = getSessionCfg(slug) || {};
    const state = getState();
    const network = getNetwork();
    return buildQuestionDecryptContextForSession({
      cfg,
      account: getAccount() || '',
      providerLike: getProviderLike() || '',
      litHooks: state.litHooks || getGlobalLitHooks() || null,
      fallbackChainId: network?.id || network?.chainId || null,
    });
  };

  const initializeQuestionCacheForGroup = async (slugIn, opts = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const suppressUiState = !!(opts && opts.background === true);
    const skipDiscoveryScan = !!(opts && opts.skipDiscoveryScan === true);
    const QUESTION_METADATA_BULK_ARWEAVE_RETRIES = 0;
    const QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS = 4500;
    const initRunKey = slug;
    const rerunOpts = {
      ...(opts && typeof opts === 'object' ? opts : {}),
      background: suppressUiState,
      skipDiscoveryScan,
    };
    const setQuestionState = (nextState, cb) => {
      if (suppressUiState || !isMounted()) return;
      setState(nextState, cb);
    };
    const maybeCheckAllCachesReady = () => {
      if (suppressUiState) return;
      checkAllCachesReady();
    };
    if (scanScopeNoop(slug, 'initializeQuestionCacheForGroup', () => {
      setQuestionState({ isQuestionCacheReady: true }, checkAllCachesReady);
    })) {
      return;
    }
    _questionInitInFlight = _questionInitInFlight || {};
    _questionInitPending = _questionInitPending || {};
    if (_questionInitInFlight[initRunKey]) {
      _questionInitPending[initRunKey] = mergePendingQuestionInitOpts(_questionInitPending[initRunKey], rerunOpts);
      return _questionInitInFlight[initRunKey];
    }

    const run = (async () => {
      mainSiteLog.log("initializeQuestionCacheForGroup() - invoked with Infura chunked scanning", { slug });
      setQuestionState((prev) =>
        prev.questionCacheInitializationError ? { questionCacheInitializationError: false } : null
      );

      const networkID = String(getSessionChainId(slug) || '');
      const scopedSlug = normalizeSessionSlug(slug || '');
      const QUESTION_SCAN_MAX_BLOCK_RANGE = readSessionScanMaxBlockRange(
        DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE
      );
      const abortQuestionScan = ({ code = 'scan_aborted', message = 'Question scan aborted.' } = {}) => {
        const nowMs = Date.now();
        mainSiteLog.warn('[QuestionScan] Aborting question scan', {
          slug: scopedSlug || 'general',
          code,
          message,
        });
        setQuestionState((prev) => ({
          isQuestionCacheReady: true,
          questionScanProgress: {
            ...(prev?.questionScanProgress || {}),
            slug: scopedSlug,
            phase: 'error',
            errorCode: String(code || 'scan_aborted'),
            errorMessage: String(message || 'Question scan aborted.'),
            finishedAtMs: nowMs,
            totalBlocks: 0,
            scannedBlocks: 0,
            remainingBlocks: 0,
          },
        }), checkAllCachesReady);
      };
      const sessionCfgForScan = getSessionCfg(slug);
      const shouldRequireRegistryGeneral = slug === '';
      if (shouldRequireRegistryGeneral && !sessionCfgForScan) {
        abortQuestionScan({
          code: 'session_not_found',
          message: 'No session found for "general".',
        });
        return;
      }
      let resolvedWindow = null;
      try {
        resolvedWindow = await contractScripts.getRelevantBlockWindowForFilter(slug);
      } catch (windowErr) {
        abortQuestionScan({
          code: 'block_window_unavailable',
          message: windowErr?.message || 'Failed to resolve session block window.',
        });
        return;
      }
      const scanWindow = resolveValidatedSessionScanWindow({
        slug,
        blockLimits: sessionCfgForScan?.blockLimits || null,
        resolvedWindow,
        maxBlockRange: QUESTION_SCAN_MAX_BLOCK_RANGE,
      });
      if (!scanWindow.ok) {
        abortQuestionScan({
          code: scanWindow.code || 'invalid_block_window',
          message: scanWindow.message || 'Invalid session block window.',
        });
        return;
      }
      const baseFrom = Number(scanWindow.fromBlock || 0);
      const baseTo = Number(scanWindow.toBlock || 0);
      const requestedToBlockRaw = Number(scanWindow.requestedToBlock);
      const scanRequestedToBlock = Number.isFinite(requestedToBlockRaw)
        ? Math.max(baseTo, Math.floor(requestedToBlockRaw))
        : baseTo;
      const scanMaxBlockRange = Math.max(
        1,
        Number(scanWindow.maxBlockRange || QUESTION_SCAN_MAX_BLOCK_RANGE)
      );
      const didCapScanRange = scanWindow.wasCapped === true;
      if (didCapScanRange) {
        mainSiteLog.warn('[QuestionScan] Capped question scan range to safety max.', {
          slug: scopedSlug || 'general',
          fromBlock: baseFrom,
          requestedToBlock: scanRequestedToBlock,
          cappedToBlock: baseTo,
          maxBlockRange: scanMaxBlockRange,
        });
      }
      if (baseFrom > baseTo) {
        setQuestionState({ isQuestionCacheReady: true }, checkAllCachesReady);
        return;
      }
      const initialLastBlockQuestion = Math.max(0, baseFrom - 1);
      let questionsCache = dgRead("questionsCache", slug) || {};
      // Migration: merge legacy numeric key into string key once
      if (questionsCache && networkID) {
        mergeLegacyNumericNetworkKey(questionsCache, networkID);
      }

      // Create structure if missing
      if (!questionsCache[networkID]) {
        questionsCache[networkID] = {
          questionsLatestBlock: initialLastBlockQuestion,
          questionsDiscoveryCheckpointBlock: initialLastBlockQuestion,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},                 // Recency guard map
          pendingQuestionMetadata: {},               // Retry map for off-chain question metadata fetches
          questionResponsesLatestBlock: initialLastBlockQuestion,
          arweaveTxCache: {},
          arweaveTxFailureCache: {},
          questionHydrationMeta: {},
        };
      }
      if (typeof questionsCache[networkID].pendingQuestionMetadata !== 'object' || !questionsCache[networkID].pendingQuestionMetadata) {
        questionsCache[networkID].pendingQuestionMetadata = {};
      }
      ensureQuestionArweaveCacheBranches(questionsCache[networkID]);
      if (!Number.isFinite(Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock))) {
        questionsCache[networkID].questionsDiscoveryCheckpointBlock = Number(questionsCache[networkID].questionsLatestBlock) || initialLastBlockQuestion;
      }
      const rebucketedQuestionIds = new Set();

      // Merge helper to avoid stomping concurrent responses writes
      const mergeFreshIntoLocalCopy = () => {
        try {
          const fresh = dgRead("questionsCache", slug) || {};
          const freshNet = fresh[networkID];
          if (!freshNet) return;

          // Merge questionResponses + recency metadata (qId -> responder -> {bn/txi/li/ts})
          const localNet = questionsCache[networkID];
          ensureQuestionArweaveCacheBranches(localNet);
          if (!localNet.questionResponses || typeof localNet.questionResponses !== 'object') {
            localNet.questionResponses = {};
          }
          if (!localNet.questionResponsesMeta || typeof localNet.questionResponsesMeta !== 'object') {
            localNet.questionResponsesMeta = {};
          }
          const freshQR = (freshNet && typeof freshNet.questionResponses === 'object')
            ? freshNet.questionResponses
            : {};
          const freshQRMeta = (freshNet && typeof freshNet.questionResponsesMeta === 'object')
            ? freshNet.questionResponsesMeta
            : {};
          const toResponseRecencyPair = (value, responseValue = null) => {
            const src = (value && typeof value === 'object') ? value : {};
            const responseObj = (responseValue && typeof responseValue === 'object') ? responseValue : {};
            return {
              bn: Number(src.bn ?? src.blockNumber ?? responseObj.blockNumber ?? responseObj.bn ?? 0) || 0,
              txi: Number(
                src.txi ??
                src.transactionIndex ??
                src.txIndex ??
                responseObj.transactionIndex ??
                responseObj.txIndex ??
                0
              ) || 0,
              li: Number(src.li ?? src.logIndex ?? responseObj.logIndex ?? responseObj.li ?? 0) || 0,
              ts: Number(src.ts ?? src.timestamp ?? responseObj.timestamp ?? 0) || 0,
            };
          };
          const compareResponseRecency = (incomingRecency, existingRecency) => {
            if (incomingRecency.bn > existingRecency.bn) return 1;
            if (incomingRecency.bn < existingRecency.bn) return -1;
            if (incomingRecency.txi > existingRecency.txi) return 1;
            if (incomingRecency.txi < existingRecency.txi) return -1;
            if (incomingRecency.li > existingRecency.li) return 1;
            if (incomingRecency.li < existingRecency.li) return -1;
            if (incomingRecency.ts > existingRecency.ts) return 1;
            if (incomingRecency.ts < existingRecency.ts) return -1;
            return 0;
          };
          const shouldApplyIncomingResponse = ({ existingMeta, incomingMeta, hasExistingResponse }) => {
            if (!hasExistingResponse) return true;
            const existing = toResponseRecencyPair(existingMeta);
            const incoming = toResponseRecencyPair(incomingMeta);
            return compareResponseRecency(incoming, existing) >= 0;
          };
          const freshQuestionIds = new Set([
            ...Object.keys(freshQR || {}),
            ...Object.keys(freshQRMeta || {}),
          ]);
          freshQuestionIds.forEach((qIdRaw) => {
            const qId = String(qIdRaw || '').trim().toLowerCase();
            if (!qId) return;
            const freshResponsesByResponder = (
              (freshQR[qIdRaw] && typeof freshQR[qIdRaw] === 'object')
                ? freshQR[qIdRaw]
                : (freshQR[qId] && typeof freshQR[qId] === 'object')
                  ? freshQR[qId]
                  : {}
            );
            const freshMetaByResponder = (
              (freshQRMeta[qIdRaw] && typeof freshQRMeta[qIdRaw] === 'object')
                ? freshQRMeta[qIdRaw]
                : (freshQRMeta[qId] && typeof freshQRMeta[qId] === 'object')
                  ? freshQRMeta[qId]
                  : {}
            );
            if (!localNet.questionResponses[qId] || typeof localNet.questionResponses[qId] !== 'object') {
              localNet.questionResponses[qId] = {};
            }
            if (!localNet.questionResponsesMeta[qId] || typeof localNet.questionResponsesMeta[qId] !== 'object') {
              localNet.questionResponsesMeta[qId] = {};
            }
            const localResponsesByResponder = localNet.questionResponses[qId];
            const localMetaByResponder = localNet.questionResponsesMeta[qId];
            const responderSet = new Set([
              ...Object.keys(freshResponsesByResponder || {}),
              ...Object.keys(freshMetaByResponder || {}),
            ]);
            responderSet.forEach((responderRaw) => {
              const responder = String(responderRaw || '').trim().toLowerCase();
              if (!responder) return;

              const hasIncomingResponse = (
                Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responderRaw) ||
                Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responder)
              );
              const incomingResponse = hasIncomingResponse
                ? (
                  Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responderRaw)
                    ? freshResponsesByResponder[responderRaw]
                    : freshResponsesByResponder[responder]
                )
                : undefined;
              const incomingMeta = (
                freshMetaByResponder[responderRaw] ??
                freshMetaByResponder[responder] ??
                null
              );
              const hasExistingResponse = Object.prototype.hasOwnProperty.call(localResponsesByResponder, responder);
              if (!shouldApplyIncomingResponse({
                existingMeta: localMetaByResponder[responder],
                incomingMeta: toResponseRecencyPair(incomingMeta, incomingResponse),
                hasExistingResponse,
              })) {
                return;
              }
              if (hasIncomingResponse) {
                localResponsesByResponder[responder] = incomingResponse;
              }
              if (incomingMeta && typeof incomingMeta === 'object') {
                localMetaByResponder[responder] = toResponseRecencyPair(incomingMeta, incomingResponse);
              } else if (!Object.prototype.hasOwnProperty.call(localMetaByResponder, responder)) {
                localMetaByResponder[responder] = toResponseRecencyPair(null, incomingResponse);
              }
            });
          });

          // Watermark: take max
          const localWM = Number(localNet.questionResponsesLatestBlock) || 0;
          const freshWM = Number(freshNet.questionResponsesLatestBlock) || 0;
          localNet.questionResponsesLatestBlock = Math.max(localWM, freshWM);

          // Also merge any questions discovered by listeners meanwhile (do not overwrite ours)
          const freshQs = freshNet.questions || {};
          if (!localNet.questions) localNet.questions = {};
          Object.keys(freshQs).forEach((qid) => {
            const qidLower = String(qid || '').toLowerCase();
            if (qidLower && rebucketedQuestionIds.has(qidLower)) return;
            if (!localNet.questions[qid]) {
              localNet.questions[qid] = freshQs[qid];
            }
          });

          // Make sure questionsLatestBlock never goes backwards
          const localQBlk = Number(localNet.questionsLatestBlock) || 0;
          const freshQBlk = Number(freshNet.questionsLatestBlock) || 0;
          localNet.questionsLatestBlock = Math.max(localQBlk, freshQBlk);
          const localCheckpointBlk = Number(localNet.questionsDiscoveryCheckpointBlock) || 0;
          const freshCheckpointBlk = Number(freshNet.questionsDiscoveryCheckpointBlock) || 0;
          const mergedCheckpointBlk = Math.max(localCheckpointBlk, freshCheckpointBlk);
          if (mergedCheckpointBlk > 0) {
            localNet.questionsDiscoveryCheckpointBlock = mergedCheckpointBlk;
          } else if (Object.prototype.hasOwnProperty.call(localNet, 'questionsDiscoveryCheckpointBlock')) {
            delete localNet.questionsDiscoveryCheckpointBlock;
          }

          // Preserve immutable Arweave payload and failure caches across stale whole-object writes.
          mergeQuestionArweaveCacheBranches(localNet, freshNet);

          // Merge pending off-chain metadata retries (never resurrect entries for questions we already have)
          if (typeof localNet.pendingQuestionMetadata !== 'object' || !localNet.pendingQuestionMetadata) {
            localNet.pendingQuestionMetadata = {};
          }
          const localPending = localNet.pendingQuestionMetadata;
          const freshPending = (freshNet && typeof freshNet.pendingQuestionMetadata === 'object')
            ? freshNet.pendingQuestionMetadata
            : {};
          Object.keys(freshPending || {}).forEach((qidRaw) => {
            const qid = String(qidRaw || '').toLowerCase();
            if (!qid) return;

            // If the question already exists in cache, any pending entry is stale; do not merge it.
            if (localNet.questions && localNet.questions[qid]) {
              if (localPending[qid]) delete localPending[qid];
              return;
            }

            const a = localPending[qid];
            const b = freshPending[qidRaw];
            if (!b || typeof b !== 'object') return;
            if (!a || typeof a !== 'object') {
              localPending[qid] = { ...b };
              return;
            }
            localPending[qid] = {
              attempts: Math.max(Number(a.attempts || 0), Number(b.attempts || 0)),
              nextRetryAtMs: Math.max(Number(a.nextRetryAtMs || 0), Number(b.nextRetryAtMs || 0)),
            };
          });

          // Cleanup: if the question exists, it should never remain in the pending set.
          try {
            const stale = Object.keys(localPending || {}).filter((qidRaw) => {
              const qid = String(qidRaw || '').toLowerCase();
              return qid && localNet.questions && localNet.questions[qid];
            });
            stale.forEach((qidRaw) => {
              try { delete localPending[qidRaw]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
            });
          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      };

      const QUESTION_CACHE_WRITE_MIN_INTERVAL_MS = 1000;
      const QUESTION_CACHE_WRITE_MAX_PENDING_OPS = 4;
      let lastQuestionCacheWriteMs = 0;
      let pendingQuestionCacheWriteOps = 0;
      let hasPendingQuestionCacheWrite = false;
      const flushQuestionCacheWrite = ({ force = false } = {}) => {
        const nowMs = Date.now();
        if (!shouldFlushCoalescedRun({
          force,
          dirty: hasPendingQuestionCacheWrite,
          nowMs,
          lastFlushMs: lastQuestionCacheWriteMs,
          minIntervalMs: QUESTION_CACHE_WRITE_MIN_INTERVAL_MS,
          pendingOps: pendingQuestionCacheWriteOps,
          maxPendingOps: QUESTION_CACHE_WRITE_MAX_PENDING_OPS,
        })) {
          return false;
        }
        mergeFreshIntoLocalCopy();
        dgWrite("questionsCache", slug, questionsCache);
        hasPendingQuestionCacheWrite = false;
        pendingQuestionCacheWriteOps = 0;
        lastQuestionCacheWriteMs = nowMs;
        return true;
      };
      const queueQuestionCacheWrite = ({ force = false, opCount = 1 } = {}) => {
        hasPendingQuestionCacheWrite = true;
        pendingQuestionCacheWriteOps += Math.max(1, Number(opCount || 1));
        return flushQuestionCacheWrite({ force });
      };

      // Floor resume checkpoints to the group’s known start and keep watermarks monotonic.
      const floorBlock = initialLastBlockQuestion;
      let stableDiscoveryBlock = Number(questionsCache[networkID].questionsLatestBlock) || 0;
      if (stableDiscoveryBlock < floorBlock) stableDiscoveryBlock = floorBlock;
      questionsCache[networkID].questionsLatestBlock = stableDiscoveryBlock;

      let checkpointDiscoveryBlock = Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || 0;
      if (checkpointDiscoveryBlock < floorBlock) checkpointDiscoveryBlock = floorBlock;
      questionsCache[networkID].questionsDiscoveryCheckpointBlock = checkpointDiscoveryBlock;

      const resumeDiscoveryBlock = Math.max(stableDiscoveryBlock, checkpointDiscoveryBlock);

      // Off-chain metadata retry queue (prevents log rescans when Arweave fetch fails)
      const MAX_PENDING_QUESTION_METADATA_ATTEMPTS = 12;
      const MAX_PENDING_QUESTION_COOLDOWN_MS = 5 * 60 * 1000;
      const computeBackoffMs = (attempts) => {
        const n = Math.max(0, Math.min(6, Number(attempts || 0) - 1));
        return Math.min(60000, Math.round(1000 * Math.pow(2, n)));
      };
      const markPendingQuestion = (qidLower, { bumpAttempts = true, error = null } = {}) => {
        if (!qidLower) return;
        if (typeof questionsCache[networkID].pendingQuestionMetadata !== 'object' || !questionsCache[networkID].pendingQuestionMetadata) {
          questionsCache[networkID].pendingQuestionMetadata = {};
        }
        const slot = questionsCache[networkID].pendingQuestionMetadata;
        const prev = slot[qidLower] && typeof slot[qidLower] === 'object' ? slot[qidLower] : { attempts: 0, nextRetryAtMs: 0 };
        const attempts = bumpAttempts ? (Number(prev.attempts || 0) + 1) : Number(prev.attempts || 0);
        const stopDecision = shouldStopPendingMetadataRetry({
          pendingEntry: { ...prev, attempts },
          error,
          maxAttempts: MAX_PENDING_QUESTION_METADATA_ATTEMPTS,
        });
        const failureMeta = normalizeArweaveFailureMeta(error);
        const terminalRetryAtMs = Number(failureMeta.nextRetryAtMs || 0);
        if (stopDecision.stop) {
          if (
            stopDecision.terminal &&
            Number.isFinite(terminalRetryAtMs) &&
            terminalRetryAtMs > Date.now()
          ) {
            slot[qidLower] = {
              attempts,
              nextRetryAtMs: terminalRetryAtMs,
              state: failureMeta.state || 'terminal_not_found',
              lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
              message: String(failureMeta.message || ''),
            };
            return;
          }
          if (stopDecision.reachedMaxAttempts && !stopDecision.terminal) {
            const cooldownRetryAtMs = Date.now() + MAX_PENDING_QUESTION_COOLDOWN_MS;
            const externalNextRetryAt = Number(failureMeta.nextRetryAtMs || 0);
            slot[qidLower] = {
              attempts,
              nextRetryAtMs: Number.isFinite(externalNextRetryAt) && externalNextRetryAt > cooldownRetryAtMs
                ? externalNextRetryAt
                : cooldownRetryAtMs,
              state: failureMeta.state || 'transient',
              lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
              message: String(failureMeta.message || ''),
            };
            mainSiteLog.warn('[MainSite] Pending question metadata reached max attempts; applying cooldown', {
              group: slug,
              questionId: qidLower,
              attempts,
              nextRetryAtMs: slot[qidLower].nextRetryAtMs,
            });
            return;
          }
          try { delete slot[qidLower]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
          mainSiteLog.warn('[MainSite] Stopping pending question metadata retry', {
            group: slug,
            questionId: qidLower,
            terminal: stopDecision.terminal,
            reachedMaxAttempts: stopDecision.reachedMaxAttempts,
            attempts,
            state: failureMeta.state || null,
            status: failureMeta.status,
          });
          return;
        }
        const externalNextRetryAt = Number(failureMeta.nextRetryAtMs || 0);
        const computedNextRetryAt = Date.now() + computeBackoffMs(attempts);
        slot[qidLower] = {
          attempts,
          nextRetryAtMs: Number.isFinite(externalNextRetryAt) && externalNextRetryAt > computedNextRetryAt
            ? externalNextRetryAt
            : computedNextRetryAt,
          state: failureMeta.state || 'transient',
          lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
          message: String(failureMeta.message || ''),
        };
      };
      const clearPendingQuestion = (qidLower) => {
        try {
          if (questionsCache?.[networkID]?.pendingQuestionMetadata?.[qidLower]) {
            delete questionsCache[networkID].pendingQuestionMetadata[qidLower];
          }
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      };
      const pruneLoadedPendingQuestionMetadata = () => {
        try {
          const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
          if (!pending || typeof pending !== 'object') return 0;
          const cachedQuestions = (
            questionsCache?.[networkID]?.questions &&
            typeof questionsCache[networkID].questions === 'object'
          ) ? questionsCache[networkID].questions : {};
          let removed = 0;
          Object.keys(pending).forEach((qidRaw) => {
            const qid = String(qidRaw || '').toLowerCase();
            if (!qid || !cachedQuestions[qid]) return;
            try {
              delete pending[qidRaw];
              removed += 1;
            } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
          });
          return removed;
        } catch (_) {
          return 0;
        }
      };
      const retryPendingQuestionMetadata = async ({ maxToProcess = 15, batchSize = 5 } = {}) => {
        try {
          let recoveredCount = 0;
          const removedStalePending = pruneLoadedPendingQuestionMetadata();
          if (removedStalePending > 0) {
            queueQuestionCacheWrite({ force: true });
          }
          const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
          if (!pending || typeof pending !== 'object') return 0;
          const now = Date.now();
          const due = Object.keys(pending)
            .map((qid) => ({ qid, entry: pending[qid] }))
            .filter((row) => (
              row &&
              row.qid &&
              !questionsCache?.[networkID]?.questions?.[String(row.qid || '').toLowerCase()] &&
              Number(row.entry?.nextRetryAtMs || 0) <= now
            ))
            .sort((a, b) => (Number(a.entry?.nextRetryAtMs || 0) - Number(b.entry?.nextRetryAtMs || 0)))
            .slice(0, Math.max(0, Number(maxToProcess || 0)));
          if (!due.length) return 0;

          mainSiteLog.log(`[MainSite] Retrying ${due.length} pending question metadata fetch(es) (group=${slug}).`);

          for (let i = 0; i < due.length; i += batchSize) {
            const batch = due.slice(i, i + batchSize);
            // eslint-disable-next-line no-await-in-loop
            const results = await Promise.all(batch.map(async ({ qid }) => {
              const lowered = String(qid || '').toLowerCase();
              if (!lowered) return { qid: lowered, questionData: null };
              if (questionsCache?.[networkID]?.questions?.[lowered]) {
                return {
                  qid: lowered,
                  questionData: questionsCache[networkID].questions[lowered],
                  skippedCached: true,
                };
              }
              try {
                const questionData = await contractScripts.getQuestionData('none', lowered, slug, {
                  decryptContext: buildQuestionDecryptContext(slug),
                  skipDecrypt: true,
                  throwOnFailure: true,
                  arweaveRetries: QUESTION_METADATA_BULK_ARWEAVE_RETRIES,
                  arweaveGatewayTimeoutMs: QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS,
                });
                return { qid: lowered, questionData };
              } catch (err) {
                return { qid: lowered, questionData: null, err };
              }
            }));

            for (const item of results) {
              const lowered = String(item.qid || '').toLowerCase();
              if (!lowered) continue;
              if (item.questionData) {
                item.questionData.id = lowered;
                const preparedQuestion = buildMetadataSessionCacheEnvelope(item.questionData, slug, {
                  scoped: true,
                });
                const preparedQuestionData = {
                  ...item.questionData,
                  ...preparedQuestion.metadata,
                };
                if (preparedQuestion.targetSlug === slug) {
                  questionsCache[networkID].questions[lowered] = preparedQuestionData;
                } else {
                  rebucketedQuestionIds.add(lowered);
                  try { delete questionsCache[networkID].questions[lowered]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
                  writeQuestionMetadataToCache(
                    preparedQuestion.targetSlug,
                    lowered,
                    preparedQuestionData,
                    networkID,
                    { enforceScopedIsolation: true }
                  );
                }
                clearPendingQuestion(lowered);
                if (!item.skippedCached) recoveredCount += 1;
              } else {
                markPendingQuestion(lowered, { error: item.err });
              }
            }

            // Persist in coalesced chunks without wiping concurrent response writes.
            queueQuestionCacheWrite();
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          flushQuestionCacheWrite({ force: true });
          return recoveredCount;
        } catch (_) {
          return 0;
        }
      };

      // If we discovered question IDs but couldn't fetch their off-chain metadata (often due to
      // RPC rate limits), keep the cache "not ready" and retry using the pending backoff queue.
      const schedulePendingQuestionMetadataRetry = () => {
        try {
          const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
          if (!pending || typeof pending !== 'object') return;

          const entries = Object.values(pending).filter((v) => v && typeof v === 'object');
          if (!entries.length) return;

          let nextAtMs = Infinity;
          entries.forEach((entry) => {
            const at = Number(entry.nextRetryAtMs || 0);
            if (at > 0 && at < nextAtMs) nextAtMs = at;
          });
          if (!Number.isFinite(nextAtMs)) nextAtMs = Date.now() + 1500;
          const delayMs = Math.max(500, nextAtMs - Date.now());

          _pendingQuestionMetadataRetryTimers = _pendingQuestionMetadataRetryTimers || {};
          if (_pendingQuestionMetadataRetryTimers[slug]) {
            clearTimeout(_pendingQuestionMetadataRetryTimers[slug]);
          }
          _pendingQuestionMetadataRetryTimers[slug] = setTimeout(() => {
            try {
              if (_pendingQuestionMetadataRetryTimers) {
                delete _pendingQuestionMetadataRetryTimers[slug];
              }
              if (!isMounted()) return;
              // Avoid background churn if the user navigated away, except for explicit
              // general-scope backfill retries (slug === '').
              const activeSlug = normalizeSessionSlug(getActiveSessionSlug() || '');
              const allowGeneralBackfillRetry = slug === '' && getSessionScanScope() === 'general';
              if (!allowGeneralBackfillRetry && activeSlug !== slug) return;
              initializeQuestionCacheForGroup(slug, {
                background: suppressUiState,
                skipDiscoveryScan: true,
              });
            } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
          }, delayMs);
        } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
      };

      const fromBlockForDiscovery = skipDiscoveryScan ? (baseTo + 1) : (resumeDiscoveryBlock + 1);
      const latestBlock = (!skipDiscoveryScan && didCapScanRange)
        ? Math.max(
          floorBlock,
          Math.min(
            scanRequestedToBlock,
            fromBlockForDiscovery + scanMaxBlockRange - 1
          )
        )
        : baseTo;
      const shouldContinueCappedDiscoveryScan = (
        !skipDiscoveryScan &&
        didCapScanRange &&
        scanRequestedToBlock > latestBlock
      );
      const queueCappedDiscoveryRerun = () => {
        if (!shouldContinueCappedDiscoveryScan) return false;
        _questionInitPending[initRunKey] = mergePendingQuestionInitOpts(
          _questionInitPending[initRunKey],
          {
            ...rerunOpts,
            background: suppressUiState,
            skipDiscoveryScan: false,
          }
        );
        return true;
      };
      const totalScanBlocks = fromBlockForDiscovery <= latestBlock
        ? Math.max(0, latestBlock - fromBlockForDiscovery + 1)
        : 0;
      const requestedTotalScanBlocks = Math.max(
        totalScanBlocks,
        Number(scanWindow.requestedRangeBlocks || totalScanBlocks || 0)
      );
      const buildQuestionScanProgressCounts = (batchScannedIn = 0) => {
        const batchScanned = Math.max(0, Math.min(totalScanBlocks, Number(batchScannedIn || 0)));
        if (!didCapScanRange) {
          return {
            scannedBlocks: batchScanned,
            remainingBlocks: Math.max(0, totalScanBlocks - batchScanned),
          };
        }
        // Preserve overall discovery progress across capped reruns so the UI
        // doesn't appear stuck at the current 50k safety window.
        const completedBeforeCurrentWindow = Math.max(0, fromBlockForDiscovery - baseFrom);
        const scannedBlocks = Math.max(
          0,
          Math.min(requestedTotalScanBlocks, completedBeforeCurrentWindow + batchScanned)
        );
        return {
          scannedBlocks,
          remainingBlocks: Math.max(0, requestedTotalScanBlocks - scannedBlocks),
        };
      };
      const QUESTION_PROGRESS_MIN_INTERVAL_MS = 250;
      let lastQuestionProgressCommitMs = 0;
      let pendingQuestionProgressPatch = null;
      let pendingQuestionReadySignal = false;
      const clearQueuedQuestionProgress = () => {
        pendingQuestionProgressPatch = null;
        pendingQuestionReadySignal = false;
      };
      const flushQueuedQuestionProgress = ({ force = false } = {}) => {
        if (!pendingQuestionProgressPatch && !pendingQuestionReadySignal) return false;
        const nowMs = Date.now();
        if (!shouldCommitThrottledProgress({
          force,
          nowMs,
          lastCommitMs: lastQuestionProgressCommitMs,
          minIntervalMs: QUESTION_PROGRESS_MIN_INTERVAL_MS,
        })) {
          return false;
        }
        const patch = pendingQuestionProgressPatch;
        const shouldMarkReady = pendingQuestionReadySignal;
        clearQueuedQuestionProgress();
        lastQuestionProgressCommitMs = nowMs;
        setQuestionState((prev) => {
          const next = {};
          if (shouldMarkReady && !prev.isQuestionCacheReady) {
            next.isQuestionCacheReady = true;
          }
          if (patch && typeof patch === 'object') {
            next.questionScanProgress = {
              ...(prev.questionScanProgress || {}),
              ...patch,
            };
          }
          return Object.keys(next).length ? next : null;
        });
        return true;
      };
      const queueQuestionProgressPatch = (patch, { force = false, markReady = false } = {}) => {
        if (patch && typeof patch === 'object') {
          pendingQuestionProgressPatch = {
            ...(pendingQuestionProgressPatch || {}),
            ...patch,
          };
        }
        if (markReady) pendingQuestionReadySignal = true;
        flushQueuedQuestionProgress({ force });
      };
      const DISCOVERY_CHECKPOINT_WRITE_MIN_INTERVAL_MS = 1200;
      const DISCOVERY_CHECKPOINT_WRITE_MIN_BLOCK_DELTA = 512;
      let lastDiscoveryCheckpointWriteMs = 0;
      let lastPersistedDiscoveryCheckpoint = Number(questionsCache?.[networkID]?.questionsDiscoveryCheckpointBlock) || 0;
      if (lastPersistedDiscoveryCheckpoint < stableDiscoveryBlock) {
        lastPersistedDiscoveryCheckpoint = stableDiscoveryBlock;
      }
      let contiguousDiscoveryFrontier = resumeDiscoveryBlock;
      const pendingDiscoveryRanges = [];

      const normalizeDiscoveryRange = (fromIn, toIn) => {
        const fromNum = Number(fromIn);
        const toNum = Number(toIn);
        if (!Number.isFinite(fromNum) || !Number.isFinite(toNum)) return null;
        const from = Math.max(fromBlockForDiscovery, Math.floor(Math.min(fromNum, toNum)));
        const to = Math.min(latestBlock, Math.floor(Math.max(fromNum, toNum)));
        if (from > to) return null;
        return [from, to];
      };

      const enqueueCompletedDiscoveryRange = (fromIn, toIn) => {
        const normalized = normalizeDiscoveryRange(fromIn, toIn);
        if (!normalized) return;
        pendingDiscoveryRanges.push(normalized);
        pendingDiscoveryRanges.sort((a, b) => a[0] - b[0]);
        const merged = [];
        pendingDiscoveryRanges.forEach((range) => {
          if (!merged.length) {
            merged.push([...range]);
            return;
          }
          const last = merged[merged.length - 1];
          if (range[0] <= last[1] + 1) {
            last[1] = Math.max(last[1], range[1]);
            return;
          }
          merged.push([...range]);
        });
        pendingDiscoveryRanges.length = 0;
        merged.forEach((range) => pendingDiscoveryRanges.push(range));
      };

      const advanceContiguousDiscoveryFrontier = () => {
        while (pendingDiscoveryRanges.length && pendingDiscoveryRanges[0][0] <= contiguousDiscoveryFrontier + 1) {
          const [, end] = pendingDiscoveryRanges.shift();
          contiguousDiscoveryFrontier = Math.max(contiguousDiscoveryFrontier, end);
        }
        return contiguousDiscoveryFrontier;
      };

      const markDiscoveryRangeComplete = (fromIn, toIn) => {
        enqueueCompletedDiscoveryRange(fromIn, toIn);
        return advanceContiguousDiscoveryFrontier();
      };

      const persistDiscoveryCheckpoint = (blockIn, { force = false } = {}) => {
        const blockNum = Number(blockIn);
        if (!Number.isFinite(blockNum)) return false;
        const nextCheckpoint = Math.max(floorBlock, Math.min(latestBlock, Math.floor(blockNum)));
        if (nextCheckpoint <= lastPersistedDiscoveryCheckpoint) return false;
        const now = Date.now();
        if (
          !force &&
          (now - lastDiscoveryCheckpointWriteMs) < DISCOVERY_CHECKPOINT_WRITE_MIN_INTERVAL_MS &&
          (nextCheckpoint - lastPersistedDiscoveryCheckpoint) < DISCOVERY_CHECKPOINT_WRITE_MIN_BLOCK_DELTA
        ) {
          return false;
        }

        questionsCache[networkID].questionsDiscoveryCheckpointBlock = Math.max(
          Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || floorBlock,
          nextCheckpoint
        );
        queueQuestionCacheWrite({ force: true, opCount: 0 });

        lastPersistedDiscoveryCheckpoint = Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || nextCheckpoint;
        lastDiscoveryCheckpointWriteMs = now;
        return true;
      };

      const finalizeDiscoveryWatermark = (finalBlockIn) => {
        const finalBlockNum = Number(finalBlockIn);
        const finalBlock = Number.isFinite(finalBlockNum)
          ? Math.max(floorBlock, Math.min(latestBlock, Math.floor(finalBlockNum)))
          : floorBlock;

        const checkpointBlock = Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || floorBlock;
        questionsCache[networkID].questionsLatestBlock = Math.max(
          Number(questionsCache[networkID].questionsLatestBlock) || floorBlock,
          checkpointBlock,
          finalBlock
        );
        try { delete questionsCache[networkID].questionsDiscoveryCheckpointBlock; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        queueQuestionCacheWrite({ force: true, opCount: 0 });

        lastPersistedDiscoveryCheckpoint = Number(questionsCache[networkID].questionsLatestBlock) || finalBlock;
        lastDiscoveryCheckpointWriteMs = Date.now();
      };

      if (!suppressUiState && totalScanBlocks > 0) {
        const progressCounts = buildQuestionScanProgressCounts(0);
        queueQuestionProgressPatch({
          slug,
          phase: 'scan',
          fromBlock: fromBlockForDiscovery,
          toBlock: latestBlock,
          totalBlocks: totalScanBlocks,
          requestedTotalBlocks: requestedTotalScanBlocks,
          wasCapped: didCapScanRange,
          scannedBlocks: progressCounts.scannedBlocks,
          remainingBlocks: progressCounts.remainingBlocks,
          discoveredQuestions: 0,
          hydratedQuestions: 0,
          startedAtMs: Date.now(),
        }, { force: true });
      }
      if (fromBlockForDiscovery > latestBlock) {
        if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
          mainSiteLog.log(
            `[MainSite] Question cache up-to-date: fromBlock(${fromBlockForDiscovery}) > latestBlock(${latestBlock}). Skipping scan.`
          );
        }
        // Even when logs are up-to-date, retry any pending off-chain metadata fetches.
        const recoveredPendingCount = await retryPendingQuestionMetadata().catch(() => 0);
        // Retry-only mode must not advance discovery watermark without a real log scan.
        if (!skipDiscoveryScan) finalizeDiscoveryWatermark(latestBlock);
        const cachedCount = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
        const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
        const ready = cachedCount > 0 || pendingCount === 0;
        flushQuestionCacheWrite({ force: true });
        clearQueuedQuestionProgress();
        setQuestionState((prev) => buildQuestionReadyStatePatch({
          prevState: prev,
          ready,
          incrementNonce: recoveredPendingCount > 0,
        }));
        if (pendingCount > 0) schedulePendingQuestionMetadataRetry();
        return;
      }

      // Proactive user cache population
      let userCache = dgRead('userCache', slug) || {};
      let userCacheModified = false;

      const ensureUserNode = (addr, block) => {
        const lower = addr.toLowerCase();
        if (!userCache[lower]) userCache[lower] = {};
        if (!userCache[lower][networkID]) {
          userCache[lower][networkID] = {
            lastBlockScanned: block,
            lastScanTimestamp: Math.floor(Date.now() / 1000),
            data: { sbts: [], createdSurveys: [], createdQuestions: [], surveyResponses: [], questionResponses: [] }
          };
        }
        if (block > userCache[lower][networkID].lastBlockScanned) {
          userCache[lower][networkID].lastBlockScanned = block;
          userCache[lower][networkID].lastScanTimestamp = Math.floor(Date.now() / 1000);
        }
        return userCache[lower][networkID].data;
      };

      /********************************************
      * 1. Fetch new question IDs via chunked scan (group-aware)
      ********************************************/
      mainSiteLog.log(
        `initializeQuestionCacheForGroup: scanning for new question IDs from block ${fromBlockForDiscovery} to ${latestBlock} (group=${slug})...`
      );
      let allDiscoveredQIDs;
      try {
        allDiscoveredQIDs = await contractScripts.getAllQuestionIDsChunkedWithCallback(
          'none', // ensure read-only provider path
          fromBlockForDiscovery,
          latestBlock,
          (progressInfo) => {
            const totalBlocks = Math.max(1, Number(progressInfo?.totalRangeBlocks || totalScanBlocks || 1));
            const batchScannedBlocks = Math.max(0, Number(progressInfo?.doneSoFarBlocks || 0));
            const progressCounts = buildQuestionScanProgressCounts(batchScannedBlocks);
            const chunkFrom = Number(progressInfo?.chunkFrom);
            const chunkTo = Number(progressInfo?.chunkTo);
            if (Number.isFinite(chunkFrom) && Number.isFinite(chunkTo)) {
              const contiguousCheckpoint = markDiscoveryRangeComplete(chunkFrom, chunkTo);
              persistDiscoveryCheckpoint(contiguousCheckpoint);
            }
            queueQuestionProgressPatch({
              slug,
              phase: 'scan',
              fromBlock: fromBlockForDiscovery,
              toBlock: latestBlock,
              totalBlocks,
              requestedTotalBlocks: requestedTotalScanBlocks,
              wasCapped: didCapScanRange,
              scannedBlocks: progressCounts.scannedBlocks,
              remainingBlocks: progressCounts.remainingBlocks,
            });
            // onChunkProgress callback
            if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
              mainSiteLog.debug(
                `Question ID chunk: [${progressInfo.chunkFrom}..${progressInfo.chunkTo}] => ${progressInfo.chunkEventCount} events.`
              );
            }
          },
          (partialQIDs, chunkToBlock) => {
            // onPartialData callback
            // optional: could save intermediate progress here if desired
          },
          slug,
          {
            rpcDebugContext: {
              fnTag: 'initialize-question-cache',
              scopeTag: 'question-discovery',
            },
          }
        );
      } catch (chunkErr) {
        mainSiteLog.error("Error fetching chunked question IDs:", chunkErr);
        persistDiscoveryCheckpoint(contiguousDiscoveryFrontier, { force: true });
        const cachedCount = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
        // If we have cached data, allow UI to proceed with it; otherwise keep the "ready" gate closed.
        flushQuestionCacheWrite({ force: true });
        clearQueuedQuestionProgress();
        setQuestionState({ isQuestionCacheReady: cachedCount > 0, questionCacheInitializationError: true });
        return;
      }

      // Advance discovery watermark immediately once logs scan succeeds (even if Arweave metadata fetch fails).
      // This prevents repeated eth_getLogs rescans due to transient off-chain errors.
      finalizeDiscoveryWatermark(latestBlock);

      // We might get duplicates if question IDs were repeated in multiple events
      // so we’ll unify them here. Also ensure all are lowercased:
      let newQIDsSet = new Set();
      (allDiscoveredQIDs || []).forEach((q) => {
        if (q) newQIDsSet.add(q.toLowerCase());
      });
      const newQIDsForDiscovery = Array.from(newQIDsSet);
      const cachedQuestionRefreshIds = (
        slug
          ? Object.values(questionsCache?.[networkID]?.questions || {})
            .map((question) => String(question?.id || '').toLowerCase())
            .filter((qid) => (
              !!qid &&
              !Object.prototype.hasOwnProperty.call(
                questionsCache?.[networkID]?.questions?.[qid] || {},
                'sessionSlugExplicit'
              )
            ))
          : []
      );
      const hydrateTargetQIDs = Array.from(new Set([
        ...newQIDsForDiscovery,
        ...cachedQuestionRefreshIds,
      ]));

      if (newQIDsForDiscovery.length > 0) {
        mainSiteLog.log(
          `initializeQuestionCacheForGroup: discovered ${newQIDsForDiscovery.length} unique question IDs total.`
        );
      }
      queueQuestionProgressPatch({
        slug,
        phase: 'hydrate',
        discoveredQuestions: hydrateTargetQIDs.length,
        hydratedQuestions: 0,
        failedQuestions: 0,
        pendingMetadataCount: Object.keys(
          questionsCache?.[networkID]?.pendingQuestionMetadata || {}
        ).length,
        requestedTotalBlocks: requestedTotalScanBlocks,
        wasCapped: didCapScanRange,
        ...buildQuestionScanProgressCounts(totalScanBlocks),
      }, { force: true });

      /**********************************************************************
      * 2) Filter out those we already have in the cache. We only load new ones
      **********************************************************************/
      const existingQIDs = Object.keys(questionsCache[networkID].questions).map((id) => id.toLowerCase());
      let finalNewQIDs = newQIDsForDiscovery.filter((id) => !existingQIDs.includes(id));
      finalNewQIDs = Array.from(new Set([
        ...finalNewQIDs,
        ...cachedQuestionRefreshIds,
      ]));
      const totalCachedQuestionsBeforeHydration = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
      const pendingQuestionMetadataCountBeforeHydration = Object.keys(
        questionsCache?.[networkID]?.pendingQuestionMetadata || {}
      ).length;
      // Regression guard: only raise this terminal error after the final capped window.
      // Interim empty windows must fall through so queued reruns keep scanning later blocks.
      const shouldRaiseRangeLimitError = (
        didCapScanRange &&
        scanRequestedToBlock === latestBlock &&
        totalCachedQuestionsBeforeHydration === 0 &&
        finalNewQIDs.length === 0 &&
        pendingQuestionMetadataCountBeforeHydration === 0
      );
      if (shouldRaiseRangeLimitError) {
        clearQueuedQuestionProgress();
        setQuestionState((prev) => ({
          isQuestionCacheReady: true,
          questionScanProgress: {
            ...(prev?.questionScanProgress || {}),
            slug: scopedSlug,
            phase: 'error',
            errorCode: 'scan_range_exceeded',
            errorMessage: `Scanned ${requestedTotalScanBlocks.toLocaleString()} blocks from session start without finding questions. Loading continued in ${QUESTION_SCAN_MAX_BLOCK_RANGE.toLocaleString()}-block safety windows.`,
            finishedAtMs: Date.now(),
            totalBlocks: totalScanBlocks,
            requestedTotalBlocks: requestedTotalScanBlocks,
            wasCapped: didCapScanRange,
            ...buildQuestionScanProgressCounts(totalScanBlocks),
            discoveredQuestions: 0,
            hydratedQuestions: 0,
          },
        }));
        maybeCheckAllCachesReady();
        return;
      }
      if (finalNewQIDs.length === 0) {
        // No brand-new question IDs, just mark the block updated
        const recoveredPendingCount = await retryPendingQuestionMetadata().catch(() => 0);
        queueCappedDiscoveryRerun();
        mergeFreshIntoLocalCopy(); // <-- prevent wiping concurrent responses
        questionsCache[networkID].questionsLatestBlock = latestBlock;
        queueQuestionCacheWrite({ force: true });
        mainSiteLog.log("No new question IDs to fetch. question cache up-to-date.");
        const cachedCount = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
        const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
        const ready = cachedCount > 0 || pendingCount === 0;
        clearQueuedQuestionProgress();
        setQuestionState((prev) => buildQuestionReadyStatePatch({
          prevState: prev,
          ready,
          incrementNonce: recoveredPendingCount > 0,
        }));
        if (pendingCount > 0) schedulePendingQuestionMetadataRetry();
        return;
      }
      mainSiteLog.log(`We have ${finalNewQIDs.length} question IDs that are brand-new to the cache.`);

      /*******************************************
      * 3) For each new question ID, fetch the data
      *******************************************/
      const BATCH_SIZE = 10;
      let hydratedSuccessCount = 0;
      let hasHydrationDataNonceSignal = false;
      const getPendingMetadataCount = () => (
        Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length
      );
      const updateHydrationProgress = ({ hydratedCount = 0, failedCount = 0 } = {}) => {
        const hasAnyQuestions = Object.keys(questionsCache?.[networkID]?.questions || {}).length > 0;
        queueQuestionProgressPatch({
          slug,
          phase: 'hydrate',
          discoveredQuestions: finalNewQIDs.length,
          hydratedQuestions: Math.min(finalNewQIDs.length, Math.max(0, Number(hydratedCount || 0))),
          failedQuestions: Math.max(0, Number(failedCount || 0)),
          pendingMetadataCount: getPendingMetadataCount(),
          requestedTotalBlocks: requestedTotalScanBlocks,
          wasCapped: didCapScanRange,
          ...buildQuestionScanProgressCounts(totalScanBlocks),
        }, { markReady: hasAnyQuestions });
        if (hasAnyQuestions && !hasHydrationDataNonceSignal) {
          hasHydrationDataNonceSignal = true;
          setQuestionState((prev) => ({
            isQuestionCacheReady: true,
            questionResponsesNonce: Number(prev.questionResponsesNonce || 0) + 1,
          }));
        }
      };
      let failedFetchCount = 0;
      for (let i = 0; i < finalNewQIDs.length; i += BATCH_SIZE) {
        const batch = finalNewQIDs.slice(i, i + BATCH_SIZE);

        // Parallel fetch each question's data from Arweave (group-aware)
        // eslint-disable-next-line no-loop-func
        const results = await Promise.all(
          batch.map(async (qId) => {
            try {
              const questionData = await contractScripts.getQuestionData('none', qId, slug, {
                decryptContext: buildQuestionDecryptContext(slug),
                // Decrypting every encrypted prompt/options/tags during bulk cache hydration is very expensive.
                // We decrypt lazily in small batches via refreshEncryptedQuestionPayloadsForGroup().
                skipDecrypt: true,
                throwOnFailure: true,
                arweaveRetries: QUESTION_METADATA_BULK_ARWEAVE_RETRIES,
                arweaveGatewayTimeoutMs: QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS,
              });
              return { qId, questionData };
            } catch (err) {
              mainSiteLog.warn(`Error fetching question data for ID ${qId}:`, err);
              return { qId, questionData: null, err };
            }
          })
        );

        // Store successfully fetched question data in questionsCache
        for (const item of results) {
          const lowered = String(item.qId || '').toLowerCase();
          if (item.questionData) {
            // Force ID to lowerCase. Also do item.questionData.id = qId
            item.questionData.id = lowered;
            const preparedQuestion = buildMetadataSessionCacheEnvelope(item.questionData, slug, {
              scoped: true,
            });
            const preparedQuestionData = {
              ...item.questionData,
              ...preparedQuestion.metadata,
            };
            const targetSlug = preparedQuestion.targetSlug;
            if (targetSlug === slug) {
              // Insert into our local structure
              questionsCache[networkID].questions[lowered] = preparedQuestionData;
            } else {
              rebucketedQuestionIds.add(lowered);
              try { delete questionsCache[networkID].questions[lowered]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
              writeQuestionMetadataToCache(targetSlug, lowered, preparedQuestionData, networkID, {
                enforceScopedIsolation: true,
              });
            }
            clearPendingQuestion(lowered);
            hydratedSuccessCount += 1;

            // Update user cache (creator)
            if (targetSlug === slug && preparedQuestionData.creator) {
              const uData = ensureUserNode(preparedQuestionData.creator, latestBlock);
              if (!uData.createdQuestions) uData.createdQuestions = [];
              if (!uData.createdQuestions.some((q) => q.id === lowered)) {
                uData.createdQuestions.push({ id: lowered, data: preparedQuestionData });
                userCacheModified = true;
              }
            }
          } else {
            failedFetchCount++;
            markPendingQuestion(lowered, { error: item.err });
          }
        }

        // Save partial progress to localStorage after each batch (merge to keep responses)
        queueQuestionCacheWrite();
        updateHydrationProgress({
          hydratedCount: hydratedSuccessCount,
          failedCount: failedFetchCount,
        });
        // small sleep to avoid rate-limits
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // 4) Mark the main "questionsLatestBlock" as fully updated (merge first)
      mergeFreshIntoLocalCopy();
      if (failedFetchCount > 0) {
        mainSiteLog.warn(
          `initializeQuestionCacheForGroup: ${failedFetchCount}/${finalNewQIDs.length} question metadata fetches failed. ` +
          `Queued pending metadata retries; discovery watermark stays advanced.`
        );
      }
      questionsCache[networkID].questionsLatestBlock = Math.max(
        Number(questionsCache[networkID].questionsLatestBlock) || 0,
        latestBlock
      );
      // Persist the final hydrated question batch before publishing the terminal
      // hydrate-progress snapshot. Embedded survey views reload off the cache when
      // they observe hydratedQuestions advance, so the cache must already reflect
      // that final count or cold loads can freeze on the first 10-question batch.
      queueQuestionCacheWrite({ force: true });
      flushQueuedQuestionProgress({ force: true });

      // Write user cache
      if (userCacheModified) {
        dgWrite("userCache", slug, userCache);
      }

      const totalCachedQuestions = Object.keys(questionsCache[networkID].questions).length;
      mainSiteLog.log(
        `initializeQuestionCacheForGroup: completed. We now have ${
          totalCachedQuestions
        } total questions in local cache for network ${networkID}, up to block ${latestBlock}.`
      );
      if (totalCachedQuestions === 0 && fromBlockForDiscovery <= latestBlock) {
        mainSiteLog.warn(
          `initializeQuestionCacheForGroup: cache is EMPTY after scanning valid block range ` +
          `[${fromBlockForDiscovery}..${latestBlock}] for group '${slug}'. ` +
          `This may indicate a contract/config issue or all fetches failed.`
        );
      }
      // If we have pending metadata but still no cached questions, keep the UI in a loading state
      // and retry using the pending backoff schedule.
      const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
      queueCappedDiscoveryRerun();
      const ready = totalCachedQuestions > 0 || pendingCount === 0;
      clearQueuedQuestionProgress();
      setQuestionState((prev) => ({
        isQuestionCacheReady: ready,
        questionResponsesNonce: hydratedSuccessCount > 0 && !hasHydrationDataNonceSignal
          ? (Number(prev.questionResponsesNonce || 0) + 1)
          : Number(prev.questionResponsesNonce || 0),
      }));
      if (pendingCount > 0) schedulePendingQuestionMetadataRetry();
      // Also re-check the “all caches ready” in case we were the last piece
      maybeCheckAllCachesReady();
    })();

    _questionInitInFlight[initRunKey] = run;
    try {
      return await run;
    } finally {
      delete _questionInitInFlight[initRunKey];
      const hasPendingRerun = !!_questionInitPending[initRunKey];
      if (isMounted() && !hasPendingRerun) {
        setQuestionState((prev) => (
          shouldClearQuestionProgressInFinalize({
            hasPendingRerun,
            isQuestionCacheReady: !!prev?.isQuestionCacheReady,
            questionScanProgress: prev?.questionScanProgress || null,
          })
            ? { questionScanProgress: null }
            : null
        ));
      }
      if (hasPendingRerun) {
        const pendingOpts = _questionInitPending[initRunKey];
        delete _questionInitPending[initRunKey];
        const rerunTimer = setTimeout(() => {
          if (_destroyed) return;
          try {
            if (!isMounted()) return;
            initializeQuestionCacheForGroup(slug, pendingOpts || rerunOpts);
          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        }, 0);
        _continuationTimers.push(rerunTimer);
      }
    }
  };

  const pruneMaskedQuestionDecryptBackoff = (nowIn = Date.now()) => {
    const memo = _maskedQuestionDecryptBackoff;
    if (!(memo instanceof Map) || memo.size === 0) return;
    const now = Number(nowIn || Date.now());
    const staleBefore = now - MASKED_Q_DECRYPT_BACKOFF_TTL_MS;
    memo.forEach((entry, key) => {
      const ts = Number(entry?.ts || 0);
      if (!Number.isFinite(ts) || ts <= 0 || ts <= staleBefore) {
        memo.delete(key);
      }
    });
    while (memo.size > MASKED_Q_DECRYPT_BACKOFF_MAX) {
      const oldest = memo.keys().next().value;
      if (!oldest) break;
      memo.delete(oldest);
    }
  };

  const refreshEncryptedQuestionPayloadsForGroup = async (slug, opts = {}) => {
    const force = !!opts?.force;
    const continuation = !!opts?.continuation;
    const now = Date.now();

    // Coalesce refreshes; this can be triggered by multiple signals (login, lit readiness, SBT events).
    _maskedQuestionRefreshInFlight = _maskedQuestionRefreshInFlight || {};
    _maskedQuestionRefreshPending = _maskedQuestionRefreshPending || {};
    _maskedQuestionRefreshLastStart = _maskedQuestionRefreshLastStart || {};
    _maskedQuestionRefreshCursor = _maskedQuestionRefreshCursor || {};
    _maskedQuestionDecryptBackoff = _maskedQuestionDecryptBackoff || new Map();
    pruneMaskedQuestionDecryptBackoff(now);

    const inFlight = _maskedQuestionRefreshInFlight[slug];
    if (inFlight) {
      if (force) _maskedQuestionRefreshPending[slug] = { force: true };
      return await inFlight;
    }

    const MIN_GAP_MS = 4000;
    const lastStart = Number(_maskedQuestionRefreshLastStart[slug] || 0);
    if (!force && !continuation && lastStart && (now - lastStart) < MIN_GAP_MS) return;
    _maskedQuestionRefreshLastStart[slug] = now;

    const run = (async () => {
      const networkID = String(getSessionChainId(slug) || '');
      if (!networkID) return;

      const questionsCache = dgRead('questionsCache', slug) || {};
      const networkCache = questionsCache?.[networkID];
      const questionMap = networkCache?.questions;
      if (!questionMap || typeof questionMap !== 'object') return;

      const encryptedQuestionIds = Object.keys(questionMap).filter((qid) => isMaskedQuestionPayload(questionMap[qid]));
      if (!encryptedQuestionIds.length) return;

      const decryptContext = buildQuestionDecryptContext(slug);
      const accountLower = String(decryptContext?.account || '').trim().toLowerCase();
      const hasProviderLike = !!String(decryptContext?.providerLike || '').trim();
      const hasLitKey = !!(decryptContext?.litOpts && typeof decryptContext.litOpts.getKey === 'function');
      if (!accountLower || (!hasProviderLike && !hasLitKey)) return;

      const backoffMs = force ? 0 : 30000;
      const backoffKey = (qid) => `${accountLower}|${slug}|${networkID}|${String(qid || '').toLowerCase()}`;

      // Time-slice: decrypt only a small number per invocation so we don't stall the app.
      const MAX_ATTEMPTS_PER_RUN = force ? 24 : 12;
      const BATCH_SIZE = 4;

      const total = encryptedQuestionIds.length;
      let cursor = Math.max(0, Number(_maskedQuestionRefreshCursor[slug] || 0));
      if (total > 0) cursor = cursor % total;

      const toProcess = [];
      let scanned = 0;
      while (toProcess.length < MAX_ATTEMPTS_PER_RUN && scanned < total) {
        const idx = total > 0 ? ((cursor + scanned) % total) : 0;
        const id = String(encryptedQuestionIds[idx] || '').toLowerCase();
        scanned += 1;

        const prev = questionMap[id] || {};
        if (!isMaskedQuestionPayload(prev)) continue;

        const key = backoffKey(id);
        const lastAttempt = _maskedQuestionDecryptBackoff.get(key);
        if (!force && lastAttempt && (now - Number(lastAttempt.ts || 0)) < backoffMs) {
          continue;
        }
        toProcess.push(id);
      }

      // Advance cursor even if many entries were skipped (fairness across runs).
      if (total > 0) {
        _maskedQuestionRefreshCursor[slug] = (cursor + scanned) % total;
      }

      let changed = 0;
      for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        // eslint-disable-next-line no-loop-func
        const refreshedBatch = await Promise.all(
          batch.map(async (id) => {
            const prev = questionMap[id] || {};
            if (!isMaskedQuestionPayload(prev)) return { qid: id, next: null, improved: false };

            const key = backoffKey(id);
            const next = { ...(prev || {}), id };
            try {
              await contractScripts.decryptQuestionPayloadInPlace(next, slug, { decryptContext });
            } catch (err) {
              mainSiteLog.warn(`Failed to decrypt cached question payload for ${id}:`, err);
              const attemptTs = Date.now();
              _maskedQuestionDecryptBackoff.set(key, { ts: attemptTs });
              pruneMaskedQuestionDecryptBackoff(attemptTs);
              return { qid: id, next: null, improved: false };
            }

            const improved = hasMaskedQuestionPayloadImproved(prev, next);
            if (!improved) {
              const attemptTs = Date.now();
              _maskedQuestionDecryptBackoff.set(key, { ts: attemptTs });
              pruneMaskedQuestionDecryptBackoff(attemptTs);
              return { qid: id, next: null, improved: false };
            }

            // Success: clear backoff so future partial decrypts can run immediately.
            _maskedQuestionDecryptBackoff.delete(key);
            return { qid: id, next, improved: true };
          })
        );

        for (const { qid, next, improved } of refreshedBatch) {
          if (!improved || !next) continue;
          const prev = questionMap[qid] || {};
          const picked = pickBetterQuestionPayload(prev, next);
          if (!picked) continue;
          questionMap[qid] = { ...prev, ...picked, id: qid };
          changed += 1;
        }
      }

      if (changed) {
        dgWrite('questionsCache', slug, questionsCache);
        queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
      }

      // If we hit our budget before scanning the full set, schedule a continuation.
      if (scanned < total && toProcess.length >= MAX_ATTEMPTS_PER_RUN) {
        const pending = _maskedQuestionRefreshPending[slug] || {};
        _maskedQuestionRefreshPending[slug] = {
          ...pending,
          continuation: true,
          // Yield to UI before the next batch.
          delayMs: Math.max(150, Number(pending.delayMs || 0) || 0),
        };
      }
    })();

    _maskedQuestionRefreshInFlight[slug] = run;
    try {
      return await run;
    } finally {
      delete _maskedQuestionRefreshInFlight[slug];
      const pending = _maskedQuestionRefreshPending[slug];
      if (pending) {
        delete _maskedQuestionRefreshPending[slug];
        const delayMs = Math.max(0, Number(pending.delayMs || 0));
        const continuationTimer = setTimeout(() => {
          if (_destroyed) return;
          try { refreshEncryptedQuestionPayloadsForGroup(slug, pending); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        }, delayMs);
        _continuationTimers.push(continuationTimer);
      }
    }
  };

  const refreshQuestionMetadataForGroup = async (slug) => {
    mainSiteLog.log("refreshQuestionMetadataForGroup() - invoked", { slug });
    if (!getSessionChainId(slug)) { mainSiteLog.warn("No group chainId for refreshQuestionMetadataForGroup"); return; }
    // Re-running initializeQuestionCacheForGroup will handle fetching new QIDs and their metadata
    // from the last known block.
    setReadinessStateIfChanged({ isQuestionCacheReady: false }); // Temporarily mark as not ready
    await initializeQuestionCacheForGroup(slug);
    checkAllCachesReady(); // Re-check global readiness
    mainSiteLog.log("refreshQuestionMetadataForGroup() - done");
  };

  return {
    initializeQuestionCacheForGroup,
    refreshEncryptedQuestionPayloadsForGroup,
    hasMaskedQuestionPayloadInCache,
    buildQuestionDecryptContext,
    refreshQuestionMetadataForGroup,
    pruneMaskedQuestionDecryptBackoff,
    isInitInFlight,
    destroy,
  };
};
