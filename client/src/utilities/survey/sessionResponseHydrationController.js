import { ethers } from 'ethers';
import contractScripts, { normalizeSessionSlug } from '../web3/contractScripts.js';
import { cryptoUtils } from '../crypto/cryptography.js';
import { createLogger } from 'utilities/logging.js';
import {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
} from '../arweave/arweaveRetryHelpers.js';
import { resolvePersistedQuestionResponsesWatermark } from './questionResponsesWatermark.js';
import { shouldFlushCoalescedRun } from '../../components/MainSite/progressHelpers.js';

const mainSiteLog = createLogger('mainSite');

export const createSessionResponseHydrationController = (host = {}) => {
  let _responseInitInFlight = {};
  let _responseInitPending = {};
  let _destroyed = false;
  let _continuationTimers = [];

  const setState = (updater, cb) => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };
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
  const getSessionChainId = (slug) => (
    typeof host.getSessionChainId === 'function' ? host.getSessionChainId(slug) : null
  );
  const getAccount = () => (
    typeof host.getAccount === 'function' ? host.getAccount() : ''
  );
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
    return !!_responseInitInFlight?.[slug];
  };

  const destroy = () => {
    _destroyed = true;
    _continuationTimers.forEach((timer) => {
      try { clearTimeout(timer); } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    });
    _continuationTimers = [];
    _responseInitInFlight = {};
    _responseInitPending = {};
  };

  const fetchQuestionResponsesChunkedForGroup = async (slugIn, opts = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const suppressUiState = !!(opts && opts.background === true);
    const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
    const notifyOnCompletion = !!(opts && opts.notifyOnCompletion === true);
    const initRunKey = slug;
    const rerunOpts = {
      ...(opts && typeof opts === 'object' ? opts : {}),
      background: suppressUiState,
      forceArweaveFetch,
      notifyOnCompletion,
    };
    const mergePendingResponseInitOpts = (prevOpts, nextOpts) => {
      const nextBackground = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.background === true);
      const nextForceArweaveFetch = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.forceArweaveFetch === true);
      const nextNotifyOnCompletion = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.notifyOnCompletion === true);
      if (!prevOpts || typeof prevOpts !== 'object') {
        return {
          background: nextBackground,
          forceArweaveFetch: nextForceArweaveFetch,
          notifyOnCompletion: nextNotifyOnCompletion,
        };
      }
      const prevBackground = !!(prevOpts.background === true);
      const prevForceArweaveFetch = !!(prevOpts.forceArweaveFetch === true);
      const prevNotifyOnCompletion = !!(prevOpts.notifyOnCompletion === true);
      return {
        background: prevBackground && nextBackground,
        forceArweaveFetch: prevForceArweaveFetch || nextForceArweaveFetch,
        notifyOnCompletion: prevNotifyOnCompletion || nextNotifyOnCompletion,
      };
    };
    const setResponseState = (nextState, cb) => {
      if (suppressUiState || !isMounted()) return;
      setState(nextState, cb);
    };
    const notifyBackgroundCompletion = () => {
      if (!suppressUiState || !notifyOnCompletion) return;
      queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
    };
    const maybeCheckAllCachesReady = () => {
      if (suppressUiState) return;
      checkAllCachesReady();
    };
    if (scanScopeNoop(slug, 'fetchQuestionResponsesChunkedForGroup', () => {
      setResponseState((prev) => ({
        isResponsesCacheReady: true,
        questionResponsesNonce: prev.questionResponsesNonce + 1,
      }), checkAllCachesReady);
      notifyBackgroundCompletion();
    })) {
      return;
    }
    _responseInitInFlight = _responseInitInFlight || {};
    _responseInitPending = _responseInitPending || {};
    if (_responseInitInFlight[initRunKey]) {
      _responseInitPending[initRunKey] = mergePendingResponseInitOpts(_responseInitPending[initRunKey], rerunOpts);
      return _responseInitInFlight[initRunKey];
    }

    const run = (async () => {
      mainSiteLog.log("fetchQuestionResponsesChunkedForGroup() - invoked for new question responses", { slug });
      setResponseState({ isResponsesCacheReady: false });

      const chainId = getSessionChainId(slug);
      if (!chainId) {
        mainSiteLog.warn("No group chainId for fetchQuestionResponsesChunkedForGroup; aborting.");
        setResponseState((prev) => ({
          isResponsesCacheReady: true,
          questionResponsesNonce: prev.questionResponsesNonce + 1,
        }), checkAllCachesReady);
        notifyBackgroundCompletion();
        return;
      }

      const networkID = String(getSessionChainId(slug) || '');
      const { fromBlock: baseFrom, toBlock: baseTo } = await contractScripts.getRelevantBlockWindowForFilter(slug);
      if (baseFrom > baseTo) {
        setResponseState((prev) => ({
          isResponsesCacheReady: true,
          questionResponsesNonce: prev.questionResponsesNonce + 1,
        }), checkAllCachesReady);
        notifyBackgroundCompletion();
        return;
      }
      const initialLastBlockQR = Math.max(0, baseFrom - 1);

      let questionsCache = dgRead("questionsCache", slug) || {};
      // Migration: numeric -> string key
      if (questionsCache && networkID) {
        mergeLegacyNumericNetworkKey(questionsCache, networkID);
      }
      if (!questionsCache[networkID]) {
        questionsCache[networkID] = {
          questionsLatestBlock: initialLastBlockQR,
          questionsDiscoveryCheckpointBlock: initialLastBlockQR,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},
          questionResponsesLatestBlock: initialLastBlockQR,
          pendingQuestionMetadata: {},
          arweaveTxCache: {},
          arweaveTxFailureCache: {},
          questionHydrationMeta: {},
        };
      }
      ensureQuestionArweaveCacheBranches(questionsCache[networkID]);
      const mergeFreshArweaveBranches = () => {
        try {
          const freshCache = dgRead("questionsCache", slug) || {};
          const freshNet = freshCache?.[networkID];
          if (!freshNet || typeof freshNet !== 'object') return;
          ensureQuestionArweaveCacheBranches(questionsCache[networkID]);
          mergeQuestionArweaveCacheBranches(questionsCache[networkID], freshNet);
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      };

      let lastProcessedQRBlock = Number(questionsCache[networkID].questionResponsesLatestBlock) || 0;
      const floorBlock = initialLastBlockQR;
      if (lastProcessedQRBlock < floorBlock) lastProcessedQRBlock = floorBlock;

      const latestBlock = baseTo;

      if (lastProcessedQRBlock >= latestBlock) {
        mainSiteLog.log("No new question responses to fetch: already up-to-date.");
        setResponseState((prev) => ({
          isResponsesCacheReady: true,
          questionResponsesNonce: prev.questionResponsesNonce + 1,
        }), maybeCheckAllCachesReady);
        notifyBackgroundCompletion();
        return;
      }

      // Track what we really persisted this run
      let processedToBlock = lastProcessedQRBlock;
      const pendingPersistenceWrites = [];
      let persistenceFailureCount = 0;

      const settleManagedWrite = (key, writePromise) => {
        return Promise.resolve(writePromise)
          .then((ok) => {
            if (!ok) {
              persistenceFailureCount += 1;
              mainSiteLog.warn('[MainSite] managed cache write returned false', { slug, key });
            }
            return !!ok;
          })
          .catch((error) => {
            persistenceFailureCount += 1;
            mainSiteLog.warn('[MainSite] managed cache write threw', {
              slug,
              key,
              error: error?.message || error,
            });
            return false;
          });
      };

      const trackManagedWrite = (key, writePromise) => {
        const tracked = settleManagedWrite(key, writePromise);
        pendingPersistenceWrites.push(tracked);
        return tracked;
      };

      const awaitManagedWrite = (key, writePromise) => (
        settleManagedWrite(key, writePromise)
      );

      const RESPONSE_CACHE_WRITE_MIN_INTERVAL_MS = 1000;
      const RESPONSE_CACHE_WRITE_MAX_PENDING_CHUNKS = 4;
      let lastResponseCacheWriteMs = 0;
      let pendingResponseChunkCount = 0;
      let hasPendingQuestionsCacheWrite = false;
      let pendingQuestionsCacheSnapshot = null;
      let pendingQuestionsCacheWatermark = 0;
      let hasPendingUserCacheWrite = false;
      let pendingUserCacheSnapshot = null;
      let responseUserCache = dgRead('userCache', slug) || {};
      const RESPONSE_USER_CACHE_DATA_KEYS = [
        'sbts',
        'createdSurveys',
        'createdQuestions',
        'surveyResponses',
        'questionResponses',
      ];
      const normalizeResponseCacheNetworkKey = (cacheObj) => {
        mergeLegacyNumericNetworkKey(cacheObj, networkID);
      };
      const ensureResponseQuestionCacheBucket = (cacheObj) => {
        const cacheRef = (cacheObj && typeof cacheObj === 'object') ? cacheObj : {};
        normalizeResponseCacheNetworkKey(cacheRef);
        if (!cacheRef[networkID]) {
          cacheRef[networkID] = {
            questionsLatestBlock: initialLastBlockQR,
            questionsDiscoveryCheckpointBlock: initialLastBlockQR,
            questions: {},
            questionResponses: {},
            questionResponsesMeta: {},
            questionResponsesLatestBlock: initialLastBlockQR,
            pendingQuestionMetadata: {},
            arweaveTxCache: {},
            arweaveTxFailureCache: {},
            questionHydrationMeta: {},
          };
        }
        const net = cacheRef[networkID];
        if (!net.questions || typeof net.questions !== 'object') net.questions = {};
        if (!net.questionResponses || typeof net.questionResponses !== 'object') net.questionResponses = {};
        if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') net.questionResponsesMeta = {};
        if (!net.pendingQuestionMetadata || typeof net.pendingQuestionMetadata !== 'object') {
          net.pendingQuestionMetadata = {};
        }
        if (!net.questionHydrationMeta || typeof net.questionHydrationMeta !== 'object') {
          net.questionHydrationMeta = {};
        }
        ensureQuestionArweaveCacheBranches(net);
        return cacheRef;
      };
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
      const mergeResponseMapsByRecency = (targetNet, sourceNet) => {
        const targetResponses = targetNet.questionResponses || {};
        const targetMeta = targetNet.questionResponsesMeta || {};
        const sourceResponses = (
          sourceNet &&
          typeof sourceNet === 'object' &&
          sourceNet.questionResponses &&
          typeof sourceNet.questionResponses === 'object'
        )
          ? sourceNet.questionResponses
          : {};
        const sourceMeta = (
          sourceNet &&
          typeof sourceNet === 'object' &&
          sourceNet.questionResponsesMeta &&
          typeof sourceNet.questionResponsesMeta === 'object'
        )
          ? sourceNet.questionResponsesMeta
          : {};
        Object.keys(sourceResponses).forEach((qidRaw) => {
          const sourceByResponder = sourceResponses[qidRaw];
          if (!sourceByResponder || typeof sourceByResponder !== 'object') return;
          const qid = String(qidRaw || '').trim().toLowerCase();
          if (!qid) return;
          if (!targetResponses[qid] || typeof targetResponses[qid] !== 'object') targetResponses[qid] = {};
          if (!targetMeta[qid] || typeof targetMeta[qid] !== 'object') targetMeta[qid] = {};
          Object.keys(sourceByResponder).forEach((responderRaw) => {
            const responder = String(responderRaw || '').trim().toLowerCase();
            if (!responder) return;
            const incomingResponse = (
              Object.prototype.hasOwnProperty.call(sourceByResponder, responderRaw)
                ? sourceByResponder[responderRaw]
                : sourceByResponder[responder]
            );
            const hasExistingResponse = Object.prototype.hasOwnProperty.call(targetResponses[qid], responder);
            const existingMeta = targetMeta[qid][responder];
            const incomingMeta = (
              sourceMeta?.[qidRaw]?.[responderRaw] ||
              sourceMeta?.[qidRaw]?.[responder] ||
              sourceMeta?.[qid]?.[responderRaw] ||
              sourceMeta?.[qid]?.[responder] ||
              null
            );
            if (!shouldApplyIncomingResponse({
              existingMeta,
              incomingMeta: toResponseRecencyPair(incomingMeta, incomingResponse),
              hasExistingResponse,
            })) return;
            targetResponses[qid][responder] = incomingResponse;
            targetMeta[qid][responder] = toResponseRecencyPair(incomingMeta, incomingResponse);
          });
        });
        targetNet.questionResponses = targetResponses;
        targetNet.questionResponsesMeta = targetMeta;
      };
      const mergeFreshQuestionsCacheIntoPendingSnapshot = (pendingCache, freshCache) => {
        const targetCache = ensureResponseQuestionCacheBucket(pendingCache);
        const sourceCache = ensureResponseQuestionCacheBucket(freshCache);
        const targetNet = targetCache[networkID];
        const sourceNet = sourceCache[networkID];
        targetNet.questionsLatestBlock = Math.max(
          Number(targetNet.questionsLatestBlock || 0),
          Number(sourceNet?.questionsLatestBlock || 0)
        );
        targetNet.questionsDiscoveryCheckpointBlock = Math.max(
          Number(targetNet.questionsDiscoveryCheckpointBlock || 0),
          Number(sourceNet?.questionsDiscoveryCheckpointBlock || 0)
        );
        targetNet.questions = {
          ...(targetNet.questions || {}),
          ...(sourceNet?.questions || {}),
        };
        targetNet.pendingQuestionMetadata = {
          ...(targetNet.pendingQuestionMetadata || {}),
          ...(sourceNet?.pendingQuestionMetadata || {}),
        };
        targetNet.questionHydrationMeta = {
          ...(targetNet.questionHydrationMeta || {}),
          ...(sourceNet?.questionHydrationMeta || {}),
        };
        mergeQuestionArweaveCacheBranches(targetNet, sourceNet);
        mergeResponseMapsByRecency(targetNet, sourceNet);
        targetNet.questionResponsesLatestBlock = Math.max(
          Number(targetNet.questionResponsesLatestBlock || 0),
          Number(sourceNet?.questionResponsesLatestBlock || 0)
        );
        return targetCache;
      };
      const buildUserCacheEntryKey = (listKey, entry) => {
        const item = (entry && typeof entry === 'object') ? entry : {};
        if (listKey === 'questionResponses') {
          const qid = String(item.questionId || item.id || '').trim().toLowerCase();
          const responder = String(item.responder || '').trim().toLowerCase();
          return qid ? `${qid}|${responder}` : '';
        }
        if (listKey === 'createdQuestions') {
          const qid = String(item.id || item.questionId || '').trim().toLowerCase();
          return qid;
        }
        if (listKey === 'createdSurveys') {
          const sid = String(item.id || item.surveyID || item.surveyId || '').trim().toLowerCase();
          return sid;
        }
        if (listKey === 'surveyResponses') {
          const sid = String(item.id || item.surveyID || item.surveyId || '').trim().toLowerCase();
          const responder = String(item.responder || '').trim().toLowerCase();
          return sid ? `${sid}|${responder}` : '';
        }
        if (listKey === 'sbts') {
          const addr = String(item.address || item.sbtAddress || '').trim().toLowerCase();
          const token = String(item.tokenId || item.id || '').trim().toLowerCase();
          return addr || token ? `${addr}|${token}` : '';
        }
        return '';
      };
      const readUserCacheRowRecency = (entry) => {
        const row = (entry && typeof entry === 'object') ? entry : {};
        const bn = Number(row.blockNumber ?? row.bn ?? 0);
        const txi = Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0);
        const li = Number(row.logIndex ?? row.li ?? 0);
        const ts = Number(row.timestamp ?? row.ts ?? 0);
        return {
          bn: Number.isFinite(bn) ? bn : 0,
          txi: Number.isFinite(txi) ? txi : 0,
          li: Number.isFinite(li) ? li : 0,
          ts: Number.isFinite(ts) ? ts : 0,
        };
      };
      const hasUserCacheRowRecencyHints = (entry) => {
        const recency = readUserCacheRowRecency(entry);
        return recency.bn > 0 || recency.txi > 0 || recency.li > 0 || recency.ts > 0;
      };
      const compareUserCacheRowsByRecency = (incomingRow, existingRow) => {
        const incoming = readUserCacheRowRecency(incomingRow);
        const existing = readUserCacheRowRecency(existingRow);
        const hasBlockHints = (
          incoming.bn > 0 ||
          existing.bn > 0 ||
          incoming.txi > 0 ||
          existing.txi > 0 ||
          incoming.li > 0 ||
          existing.li > 0 ||
          incoming.ts > 0 ||
          existing.ts > 0
        );
        if (!hasBlockHints) return 0;
        if (incoming.bn > existing.bn) return 1;
        if (incoming.bn < existing.bn) return -1;
        if (incoming.txi > existing.txi) return 1;
        if (incoming.txi < existing.txi) return -1;
        if (incoming.li > existing.li) return 1;
        if (incoming.li < existing.li) return -1;
        if (incoming.ts > existing.ts) return 1;
        if (incoming.ts < existing.ts) return -1;
        return 0;
      };
      const mergeUserDataArray = (targetData, sourceData, listKey) => {
        const sourceArr = Array.isArray(sourceData?.[listKey]) ? sourceData[listKey] : [];
        if (!sourceArr.length) return;
        const targetArr = Array.isArray(targetData?.[listKey]) ? targetData[listKey] : [];
        if (!targetArr.length) {
          targetData[listKey] = [...sourceArr];
          return;
        }
        const merged = [];
        const keyedIndex = new Map();
        const upsert = (entry, { allowReplace = true } = {}) => {
          const key = buildUserCacheEntryKey(listKey, entry);
          if (!key) {
            merged.push(entry);
            return;
          }
          if (!keyedIndex.has(key)) {
            keyedIndex.set(key, merged.length);
            merged.push(entry);
            return;
          }
          if (!allowReplace) return;
          const idx = keyedIndex.get(key);
          if (
            listKey === 'questionResponses' ||
            listKey === 'surveyResponses'
          ) {
            const existing = merged[idx];
            const cmp = compareUserCacheRowsByRecency(entry, existing);
            if (cmp > 0) {
              merged[idx] = entry;
              return;
            }
            if (cmp === 0 && existing && typeof existing === 'object' && entry && typeof entry === 'object') {
              const hasIncomingHints = hasUserCacheRowRecencyHints(entry);
              const hasExistingHints = hasUserCacheRowRecencyHints(existing);
              if (!hasIncomingHints && !hasExistingHints) {
                // If neither row has recency hints, preserve merge order and let source payload win.
                merged[idx] = {
                  ...existing,
                  ...entry,
                };
              } else {
                // Preserve existing payload values while backfilling any missing fields.
                merged[idx] = {
                  ...entry,
                  ...existing,
                };
              }
            }
            return;
          }
          merged[idx] = entry;
        };

        targetArr.forEach((entry) => upsert(entry, { allowReplace: true }));
        // Prefer fresher source rows when the dedupe key collides.
        sourceArr.forEach((entry) => upsert(entry, { allowReplace: true }));
        targetData[listKey] = merged;
      };
      const mergeUserNetworkBucket = (targetBucket, sourceBucket) => {
        const targetRef = (targetBucket && typeof targetBucket === 'object') ? targetBucket : {};
        const sourceRef = (sourceBucket && typeof sourceBucket === 'object') ? sourceBucket : {};
        targetRef.lastBlockScanned = Math.max(
          Number(targetRef.lastBlockScanned || 0),
          Number(sourceRef.lastBlockScanned || 0)
        );
        targetRef.lastScanTimestamp = Math.max(
          Number(targetRef.lastScanTimestamp || 0),
          Number(sourceRef.lastScanTimestamp || 0)
        );
        if (!targetRef.data || typeof targetRef.data !== 'object') targetRef.data = {};
        const sourceData = (sourceRef.data && typeof sourceRef.data === 'object') ? sourceRef.data : {};
        RESPONSE_USER_CACHE_DATA_KEYS.forEach((listKey) => {
          mergeUserDataArray(targetRef.data, sourceData, listKey);
        });
        return targetRef;
      };
      const mergeFreshUserCacheIntoPendingSnapshot = (pendingCache, freshCache) => {
        const targetCache = (pendingCache && typeof pendingCache === 'object') ? pendingCache : {};
        const sourceCache = (freshCache && typeof freshCache === 'object') ? freshCache : {};
        Object.keys(sourceCache).forEach((addrRaw) => {
          const sourceByNetwork = sourceCache[addrRaw];
          if (!sourceByNetwork || typeof sourceByNetwork !== 'object') return;
          const lowerAddr = String(addrRaw || '').trim().toLowerCase();
          if (!lowerAddr) return;
          if (!targetCache[lowerAddr] || typeof targetCache[lowerAddr] !== 'object') {
            targetCache[lowerAddr] = {};
          }
          const targetByNetwork = targetCache[lowerAddr];
          Object.keys(sourceByNetwork).forEach((netKey) => {
            const sourceBucket = sourceByNetwork[netKey];
            if (!sourceBucket || typeof sourceBucket !== 'object') return;
            if (!targetByNetwork[netKey] || typeof targetByNetwork[netKey] !== 'object') {
              targetByNetwork[netKey] = {};
            }
            targetByNetwork[netKey] = mergeUserNetworkBucket(targetByNetwork[netKey], sourceBucket);
          });
        });
        return targetCache;
      };
      const flushResponsePartialWrites = ({ force = false } = {}) => {
        const nowMs = Date.now();
        if (!shouldFlushCoalescedRun({
          force,
          dirty: hasPendingQuestionsCacheWrite || hasPendingUserCacheWrite,
          nowMs,
          lastFlushMs: lastResponseCacheWriteMs,
          minIntervalMs: RESPONSE_CACHE_WRITE_MIN_INTERVAL_MS,
          pendingOps: pendingResponseChunkCount,
          maxPendingOps: RESPONSE_CACHE_WRITE_MAX_PENDING_CHUNKS,
        })) {
          return false;
        }
        const questionsSnapshot = hasPendingQuestionsCacheWrite ? pendingQuestionsCacheSnapshot : null;
        const questionsWatermark = Number(pendingQuestionsCacheWatermark || 0);
        const userSnapshot = hasPendingUserCacheWrite ? pendingUserCacheSnapshot : null;

        hasPendingQuestionsCacheWrite = false;
        pendingQuestionsCacheSnapshot = null;
        pendingQuestionsCacheWatermark = 0;
        hasPendingUserCacheWrite = false;
        pendingUserCacheSnapshot = null;
        pendingResponseChunkCount = 0;
        lastResponseCacheWriteMs = nowMs;

        if (questionsSnapshot) {
          const latestQuestionsSnapshot = mergeFreshQuestionsCacheIntoPendingSnapshot(
            questionsSnapshot,
            dgRead("questionsCache", slug) || {}
          );
          questionsCache = latestQuestionsSnapshot;
          const questionsWrite = trackManagedWrite(
            'questionsCache',
            dgWrite("questionsCache", slug, latestQuestionsSnapshot)
          );
          questionsWrite.then((ok) => {
            if (ok) {
              processedToBlock = Math.max(processedToBlock, questionsWatermark);
            }
          });
        }
        if (userSnapshot) {
          const latestUserSnapshot = mergeFreshUserCacheIntoPendingSnapshot(
            userSnapshot,
            dgRead('userCache', slug) || {}
          );
          responseUserCache = latestUserSnapshot;
          trackManagedWrite('userCache', dgWrite("userCache", slug, latestUserSnapshot));
        }
        return true;
      };

      const handleProgress = (info) => {
        mainSiteLog.debug(`Chunk ${info.chunkFrom}-${info.chunkTo}, events=${info.chunkEventCount}, soFar=${info.overallEventCount}`);
      };

      const handlePartialData = (partialAgg, chunkToBlock, extra = {}) => {
        // Rebase the local pending snapshot onto fresh persisted state to avoid stale overwrites.
        const persistedQuestionsCache = dgRead("questionsCache", slug) || {};
        let fresh = mergeFreshQuestionsCacheIntoPendingSnapshot(
          pendingQuestionsCacheSnapshot || questionsCache || {},
          persistedQuestionsCache
        );
        ensureQuestionArweaveCacheBranches(fresh[networkID]);
        mergeQuestionArweaveCacheBranches(fresh[networkID], questionsCache?.[networkID]);

        const currentQR = fresh[networkID].questionResponses;
        const metaQR = fresh[networkID].questionResponsesMeta;

        // Proactive user cache population
        let userCache = mergeFreshUserCacheIntoPendingSnapshot(
          pendingUserCacheSnapshot || responseUserCache || {},
          dgRead('userCache', slug) || {}
        );
        let userCacheModified = false;

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
          if (block > userCache[lower][networkID].lastBlockScanned) {
            userCache[lower][networkID].lastBlockScanned = block;
            userCache[lower][networkID].lastScanTimestamp = Math.floor(Date.now() / 1000);
          }
          return userCache[lower][networkID].data;
        };

        // Merge partialAgg deterministically
        Object.keys(partialAgg).forEach((qId) => {
          if (!currentQR[qId]) currentQR[qId] = {};
          if (!metaQR[qId]) metaQR[qId] = {};

          partialAgg[qId].forEach((respObj) => {
            const responderKey = (respObj.responder || '').toLowerCase();

            const bn = Number(respObj.blockNumber ?? extra.chunkToBlock ?? chunkToBlock ?? 0);
            const txi = Number(respObj.transactionIndex ?? respObj.txIndex ?? respObj.txi ?? 0);
            const li = Number(respObj.logIndex ?? 0);
            const ts = Number(respObj.timestamp ?? 0);

            const prev = toResponseRecencyPair(metaQR[qId][responderKey]);
            const incoming = toResponseRecencyPair({ bn, txi, li, ts }, respObj?.response);
            const isNewer = compareResponseRecency(incoming, prev) > 0;

            if (isNewer) {
              currentQR[qId][responderKey] = respObj.response;
              metaQR[qId][responderKey] = incoming;

              // Update user cache (responder)
              const uData = ensureUserNode(responderKey, bn);
              if (!uData.questionResponses) uData.questionResponses = [];
              const existingIndex = uData.questionResponses.findIndex(
                (row) => String(row?.questionId || '').toLowerCase() === String(qId || '').toLowerCase()
              );
              const nextEntry = {
                questionId: qId,
                responder: responderKey,
                response: respObj.response,
                blockNumber: bn,
                transactionIndex: txi,
                logIndex: li,
                timestamp: ts,
              };
              if (existingIndex < 0) {
                uData.questionResponses.push(nextEntry);
                userCacheModified = true;
              } else {
                const prevEntry = uData.questionResponses[existingIndex];
                const mergedEntry = {
                  ...(prevEntry && typeof prevEntry === 'object' ? prevEntry : {}),
                  ...nextEntry,
                };
                const prevQuestionId = String(prevEntry?.questionId || '');
                const prevResponder = String(prevEntry?.responder || '');
                const prevResponse = prevEntry?.response;
                const prevBlockNumber = Number(prevEntry?.blockNumber ?? 0);
                const prevTransactionIndex = Number(prevEntry?.transactionIndex ?? prevEntry?.txIndex ?? prevEntry?.txi ?? 0);
                const prevLogIndex = Number(prevEntry?.logIndex ?? 0);
                const prevTimestamp = Number(prevEntry?.timestamp ?? prevEntry?.ts ?? 0);
                if (
                  prevQuestionId !== String(mergedEntry.questionId || '') ||
                  prevResponder !== String(mergedEntry.responder || '') ||
                  prevResponse !== mergedEntry.response ||
                  prevBlockNumber !== Number(mergedEntry.blockNumber ?? 0) ||
                  prevTransactionIndex !== Number(mergedEntry.transactionIndex ?? mergedEntry.txIndex ?? mergedEntry.txi ?? 0) ||
                  prevLogIndex !== Number(mergedEntry.logIndex ?? 0) ||
                  prevTimestamp !== Number(mergedEntry.timestamp ?? mergedEntry.ts ?? 0)
                ) {
                  uData.questionResponses[existingIndex] = mergedEntry;
                  userCacheModified = true;
                }
              }
            }
          });
        });

        // Optimistically advance chunk watermark; final clamp uses processedToBlock.
        const prevWatermark = Number(fresh[networkID].questionResponsesLatestBlock) || 0;
        const thisChunkTo = Number(chunkToBlock) || 0;
        fresh[networkID].questionResponsesLatestBlock = Math.max(prevWatermark, thisChunkTo);

        pendingResponseChunkCount += 1;
        hasPendingQuestionsCacheWrite = true;
        pendingQuestionsCacheSnapshot = fresh;
        pendingQuestionsCacheWatermark = Math.max(
          Number(pendingQuestionsCacheWatermark || 0),
          thisChunkTo
        );

        // Write user cache
        if (userCacheModified) {
          hasPendingUserCacheWrite = true;
          pendingUserCacheSnapshot = userCache;
        }
        const didFlushPartialWrites = flushResponsePartialWrites();
        if (!didFlushPartialWrites) {
          responseUserCache = userCache;
          questionsCache = fresh;
        }
      };

      try {
        await contractScripts.getQuestionResponsesChunkedWithCallback(
          'none',
          lastProcessedQRBlock + 1,
          latestBlock,
          handleProgress,
          handlePartialData,
          slug,
          { forceArweaveFetch }
        );
      } catch (chunkErr) {
        mainSiteLog.error("getQuestionResponsesChunkedWithCallback failed:", chunkErr);
        // DO NOT mark complete; we’ll leave the watermark where we truly got to (processedToBlock)
      }

      flushResponsePartialWrites({ force: true });
      await Promise.allSettled(pendingPersistenceWrites);

      // Clamp watermark to the last block that actually persisted
      questionsCache[networkID].questionResponsesLatestBlock = resolvePersistedQuestionResponsesWatermark({
        floorBlock,
        processedToBlock,
      });
      mergeFreshArweaveBranches();
      await awaitManagedWrite('questionsCache', dgWrite("questionsCache", slug, questionsCache));

      if (persistenceFailureCount > 0) {
        mainSiteLog.warn(
          '[MainSite] response-cache initialization finished with persistence failures; continuing with in-memory data',
          { slug, persistenceFailureCount }
        );
      }

      mainSiteLog.log(`Finished responses. Watermark now ${questionsCache[networkID].questionResponsesLatestBlock} (latest=${latestBlock}).`);

      setResponseState((prev) => ({
        isResponsesCacheReady: true,
        questionResponsesNonce: prev.questionResponsesNonce + 1,
      }));
      maybeCheckAllCachesReady();
      notifyBackgroundCompletion();
    })();

    _responseInitInFlight[initRunKey] = run;
    try {
      return await run;
    } finally {
      delete _responseInitInFlight[initRunKey];
      if (_responseInitPending[initRunKey]) {
        const pendingOpts = _responseInitPending[initRunKey];
        delete _responseInitPending[initRunKey];
        const continuationTimer = setTimeout(() => {
          try {
            if (_destroyed || !isMounted()) return;
            fetchQuestionResponsesChunkedForGroup(slug, pendingOpts || rerunOpts);
          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        }, 0);
        _continuationTimers.push(continuationTimer);
      }
    }
  };

  const refreshQuestionResponses = async (questionIds = null, opts = {}) => {
    const slug = normalizeSessionSlug((opts?.slug ?? getActiveSessionSlug()) || '');
    const forceFull = !!opts?.forceFull;
    const responderLower = String(opts?.responder || getAccount() || '').trim().toLowerCase();
    const migrateQuestionCacheNetworkKey = (cacheObj, netId) => {
      mergeLegacyNumericNetworkKey(cacheObj, netId);
    };
    const ensureQuestionCacheNetworkNode = (cacheObj, netId, initialLastBlockQR) => {
      if (!cacheObj[netId]) {
        cacheObj[netId] = {
          questionsLatestBlock: initialLastBlockQR,
          questionsDiscoveryCheckpointBlock: initialLastBlockQR,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},
          questionResponsesLatestBlock: initialLastBlockQR,
          pendingQuestionMetadata: {},
          arweaveTxCache: {},
          arweaveTxFailureCache: {},
          questionHydrationMeta: {},
        };
      }
      const net = cacheObj[netId];
      if (!Number.isFinite(Number(net.questionsDiscoveryCheckpointBlock))) {
        net.questionsDiscoveryCheckpointBlock = Number(net.questionsLatestBlock) || initialLastBlockQR;
      }
      if (!net.questionResponses || typeof net.questionResponses !== 'object') net.questionResponses = {};
      if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') net.questionResponsesMeta = {};
      ensureQuestionArweaveCacheBranches(net);
      return net;
    };
    const ensureUserCacheNetworkNode = (cacheObj, responder, netId, initialLastBlockQR) => {
      const responderKey = String(responder || '').trim().toLowerCase();
      if (!responderKey) return null;
      if (!cacheObj[responderKey] || typeof cacheObj[responderKey] !== 'object') {
        cacheObj[responderKey] = {};
      }
      if (!cacheObj[responderKey][netId] || typeof cacheObj[responderKey][netId] !== 'object') {
        cacheObj[responderKey][netId] = {
          lastBlockScanned: initialLastBlockQR,
          lastScanTimestamp: Math.floor(Date.now() / 1000),
          data: {
            sbts: [],
            createdSurveys: [],
            createdQuestions: [],
            surveyResponses: [],
            questionResponses: [],
          },
        };
      }
      const node = cacheObj[responderKey][netId];
      if (!node.data || typeof node.data !== 'object') node.data = {};
      if (!Array.isArray(node.data.questionResponses)) node.data.questionResponses = [];
      return node;
    };
    const ensureHash = (value) => {
      try {
        if (ethers.utils.isHexString(value, 32)) return String(value || '').toLowerCase();
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      try {
        if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') {
          return String(cryptoUtils.hashIdentifier(value) || '').toLowerCase();
        }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      const raw = String(value || '').trim();
      if (!raw) return '';
      return String(ethers.utils.id(raw) || '').toLowerCase();
    };

    const normalizedQids = Array.from(
      new Set(
        (Array.isArray(questionIds) ? questionIds : [])
          .map((id) => ensureHash(id))
          .filter((id) => !!id && ethers.utils.isHexString(id, 32))
      )
    );

    const canTarget =
      !forceFull &&
      !!responderLower &&
      normalizedQids.length > 0 &&
      !!getSessionChainId(slug);

    if (canTarget) {
      mainSiteLog.log("refreshQuestionResponses() - targeted refresh", {
        slug,
        responder: responderLower,
        questionCount: normalizedQids.length,
      });
      setState({ isResponsesCacheReady: false });

      const networkID = String(getSessionChainId(slug) || '');
      const { fromBlock: baseFrom } = await contractScripts.getRelevantBlockWindowForFilter(slug);
      const initialLastBlockQR = Math.max(0, Number(baseFrom || 0) - 1);

      const results = await Promise.all(
        normalizedQids.map(async (qId) => {
          try {
            const response = await contractScripts.getResponse('none', responderLower, qId, slug);
            return { qId, response };
          } catch (err) {
            mainSiteLog.warn(`refreshQuestionResponses(targeted): failed qId=${qId}`, err);
            return { qId, response: null };
          }
        })
      );

      let updatedAny = false;
      const nextByQid = new Map();
      results.forEach(({ qId, response }) => {
        if (!response) return;
        nextByQid.set(qId, response);
      });

      if (nextByQid.size > 0) {
        // Re-read right before merge/write so concurrent listener hydrations are preserved.
        const freshCache = dgRead("questionsCache", slug) || {};
        const freshUserCache = dgRead("userCache", slug) || {};
        migrateQuestionCacheNetworkKey(freshCache, networkID);
        const net = ensureQuestionCacheNetworkNode(freshCache, networkID, initialLastBlockQR);
        const userNode = ensureUserCacheNetworkNode(
          freshUserCache,
          responderLower,
          networkID,
          initialLastBlockQR
        );
        let userCacheUpdated = false;

        nextByQid.forEach((response, qId) => {
          if (!net.questionResponses[qId] || typeof net.questionResponses[qId] !== 'object') {
            net.questionResponses[qId] = {};
          }
          if (!net.questionResponsesMeta[qId] || typeof net.questionResponsesMeta[qId] !== 'object') {
            net.questionResponsesMeta[qId] = {};
          }

          net.questionResponses[qId][responderLower] = response;

          // Targeted refresh is not event-ordered, so never stamp synthetic high logIndex values.
          // Clamp any legacy synthetic marker (li >= 1000) to 0 so same-block real events can win.
          const prevMeta = net.questionResponsesMeta[qId][responderLower] || {};
          const prevBn = Number(prevMeta?.bn);
          const prevTxi = Number(prevMeta?.txi ?? prevMeta?.transactionIndex ?? prevMeta?.txIndex);
          const prevLi = Number(prevMeta?.li);
          const prevTs = Number(prevMeta?.ts ?? prevMeta?.timestamp);
          const hadLegacySyntheticLi = Number.isFinite(prevLi) && prevLi >= 1000;
          net.questionResponsesMeta[qId][responderLower] = hadLegacySyntheticLi
            ? { bn: 0, txi: 0, li: 0, ts: 0 }
            : {
              bn: Number.isFinite(prevBn) && prevBn >= 0 ? prevBn : 0,
              txi: Number.isFinite(prevTxi) && prevTxi >= 0 ? prevTxi : 0,
              li: Number.isFinite(prevLi) && prevLi >= 0 ? prevLi : 0,
              ts: Number.isFinite(prevTs) && prevTs >= 0 ? prevTs : 0,
            };
          updatedAny = true;

          if (userNode) {
            const responseMeta = net.questionResponsesMeta[qId]?.[responderLower] || {};
            const responseMetaBn = Number(responseMeta.bn ?? responseMeta.blockNumber ?? 0);
            const responseMetaTxi = Number(
              responseMeta.txi ?? responseMeta.transactionIndex ?? responseMeta.txIndex ?? 0
            );
            const responseMetaLi = Number(responseMeta.li ?? responseMeta.logIndex ?? 0);
            const responseMetaTs = Number(responseMeta.ts ?? responseMeta.timestamp ?? 0);
            const hasResponseRecencyHint = (
              (Number.isFinite(responseMetaBn) && responseMetaBn > 0) ||
              (Number.isFinite(responseMetaTxi) && responseMetaTxi > 0) ||
              (Number.isFinite(responseMetaLi) && responseMetaLi > 0) ||
              (Number.isFinite(responseMetaTs) && responseMetaTs > 0)
            );
            const nextEntry = {
              questionId: qId,
              responder: responderLower,
              response,
            };
            if (hasResponseRecencyHint) {
              nextEntry.blockNumber = Math.max(0, responseMetaBn);
              nextEntry.transactionIndex = Math.max(0, responseMetaTxi);
              nextEntry.logIndex = Math.max(0, responseMetaLi);
              nextEntry.timestamp = Math.max(0, responseMetaTs);
            }
            const responses = userNode.data.questionResponses;
            const existingIdx = responses.findIndex(
              (item) => String(item?.questionId || '').toLowerCase() === qId
            );
            if (existingIdx === -1) {
              if (!hasResponseRecencyHint) {
                // Brand-new targeted rows may lack ordering metadata; store explicit neutral hints.
                nextEntry.blockNumber = 0;
                nextEntry.transactionIndex = 0;
                nextEntry.logIndex = 0;
                nextEntry.timestamp = 0;
              }
              responses.push(nextEntry);
            } else {
              responses[existingIdx] = { ...(responses[existingIdx] || {}), ...nextEntry };
            }
            userCacheUpdated = true;
          }
        });

        // Targeted refresh only touches selected (questionId,responder) pairs.
        // Never advance the global scan watermark here, or we can skip unscanned responders.
        if (updatedAny) {
          dgWrite("questionsCache", slug, freshCache);
          if (userNode) {
            const prevLast = Number(userNode.lastBlockScanned) || 0;
            userNode.lastBlockScanned = Math.max(prevLast, initialLastBlockQR);
            userNode.lastScanTimestamp = Math.floor(Date.now() / 1000);
          }
          if (userCacheUpdated) {
            dgWrite("userCache", slug, freshUserCache);
          }
        }
      }

      setState((prev) => ({
        isQuestionCacheReady: updatedAny ? true : prev.isQuestionCacheReady,
        isResponsesCacheReady: true,
      }));
      queueLocalRevisionUpdate({
        needsQuestionResponsesNonce: true,
        checkAllCachesReady: true,
      });
      mainSiteLog.log("refreshQuestionResponses() - targeted refresh complete", {
        slug,
        updatedAny,
      });
      return;
    }

    mainSiteLog.log("refreshQuestionResponses() - full refresh fallback", {
      slug,
      forceFull,
      responderLower,
      questionCount: normalizedQids.length,
    });
    // No wallet network required; we use group-aware read providers internally.
    setReadinessStateIfChanged({ isQuestionCacheReady: false, isResponsesCacheReady: false });
    await fetchQuestionResponsesChunkedForGroup(slug);
    checkAllCachesReady();
    mainSiteLog.log("refreshQuestionResponses() - done");
  };

  return {
    fetchQuestionResponsesChunkedForGroup,
    refreshQuestionResponses,
    isInitInFlight,
    destroy,
  };
};
