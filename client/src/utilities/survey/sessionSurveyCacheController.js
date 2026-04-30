import contractScripts, { normalizeSessionSlug } from '../web3/contractScripts.js';
import { createLogger } from 'utilities/logging.js';
import {
  normalizeArweaveFailureMeta,
  shouldStopPendingMetadataRetry,
} from '../arweave/arweaveRetryHelpers.js';
import { prepareSurveyMetadataCacheEntry } from '../../components/MainSite/metadataCacheEntryBuilders.js';
import { resolveScopedMetadataSessionSlug } from '../../components/MainSite/metadataSessionBinding.js';

const mainSiteLog = createLogger('mainSite');

const normalizeSurveyResponseBatchResult = (batchResult) => {
  if (Array.isArray(batchResult)) {
    return { responses: batchResult, hadPartialFailure: false, lowestFailedBlock: null };
  }
  const responses = Array.isArray(batchResult?.responses) ? batchResult.responses : [];
  const lowestFailedBlock = Number(batchResult?.lowestFailedBlock);
  return {
    responses,
    hadPartialFailure: !!batchResult?.hadPartialFailure,
    lowestFailedBlock: Number.isFinite(lowestFailedBlock) ? lowestFailedBlock : null,
  };
};

const resolveSurveyResponseWatermark = ({ startBlock, latestBlock, hadPartialFailure, lowestFailedBlock }) => {
  if (!hadPartialFailure) return latestBlock;
  const failedBlock = Number(lowestFailedBlock);
  if (!Number.isFinite(failedBlock)) return latestBlock;
  return Math.max(
    Math.max(0, Number(startBlock) - 1),
    Math.min(Number(latestBlock) || 0, failedBlock - 1)
  );
};

export const createSessionSurveyCacheController = (host = {}) => {
  let _surveyInitInFlight = {};
  let _surveyInitPending = {};
  let _pendingSurveyMetadataRetryTimers = {};

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
  const getSessionScanScope = () => String(
    typeof host.getSessionScanScope === 'function' ? host.getSessionScanScope() || '' : ''
  );
  const scanScopeNoop = (slug, op, onSkipped) => (
    typeof host.scanScopeNoop === 'function' ? host.scanScopeNoop(slug, op, onSkipped) : false
  );
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
  const writeSurveyMetadataToCache = (...args) => (
    typeof host.writeSurveyMetadataToCache === 'function'
      ? host.writeSurveyMetadataToCache(...args)
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
    return !!_surveyInitInFlight?.[slug];
  };

  const destroy = () => {
    if (_pendingSurveyMetadataRetryTimers && typeof _pendingSurveyMetadataRetryTimers === 'object') {
      Object.values(_pendingSurveyMetadataRetryTimers).forEach((timer) => {
        try { clearTimeout(timer); } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
      });
    }
    _pendingSurveyMetadataRetryTimers = {};
    _surveyInitInFlight = {};
    _surveyInitPending = {};
  };

  const mergePendingSurveyInitOpts = (prevOpts, nextOpts) => {
    const nextBackground = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.background === true);
    if (!prevOpts || typeof prevOpts !== 'object') return { background: nextBackground };
    const prevBackground = !!(prevOpts.background === true);
    return { background: prevBackground && nextBackground };
  };

  const initializeSurveyCacheForGroup = async (slugIn, opts = {}) => {
    const slug = normalizeSessionSlug(slugIn || '');
    const suppressUiState = !!(opts && opts.background === true);
    const rerunOpts = { ...(opts && typeof opts === 'object' ? opts : {}), background: suppressUiState };
    const setSurveyState = (nextState, cb) => {
      if (suppressUiState || !isMounted()) return;
      setState(nextState, cb);
    };

    if (scanScopeNoop(slug, 'initializeSurveyCacheForGroup', () => {
      setSurveyState({ isSurveyCacheReady: true }, checkAllCachesReady);
    })) {
      return;
    }

    _surveyInitInFlight = _surveyInitInFlight || {};
    _surveyInitPending = _surveyInitPending || {};
    if (_surveyInitInFlight[slug]) {
      _surveyInitPending[slug] = mergePendingSurveyInitOpts(_surveyInitPending[slug], rerunOpts);
      return _surveyInitInFlight[slug];
    }

    const run = (async () => {
      mainSiteLog.log('initializeSurveyCacheForGroup() - invoked', { slug });
      setSurveyState((prev) => (
        prev.surveyCacheInitializationError ? { surveyCacheInitializationError: false } : null
      ));
      const networkID = String(getSessionChainId(slug) || '');

      const { fromBlock: baseFrom, toBlock: baseTo } = await contractScripts.getRelevantBlockWindowForFilter(slug);
      if (baseFrom > baseTo) {
        setSurveyState({ isSurveyCacheReady: true }, checkAllCachesReady);
        return;
      }
      const initialLastBlockSurvey = Math.max(0, baseFrom - 1);

      let surveysCache = dgRead('surveysCache', slug) || {};
      mergeLegacyNumericNetworkKey(surveysCache, networkID);
      if (!surveysCache[networkID]) {
        surveysCache[networkID] = {
          surveysLatestBlock: initialLastBlockSurvey,
          surveys: {},
          surveyResponses: {},
          surveyResponsesLatestBlock: {},
          pendingSurveyMetadata: {},
        };
      }
      let currentNetworkCache = surveysCache[networkID];
      let lastProcessedSurveyBlock = Number(currentNetworkCache.surveysLatestBlock) || 0;
      if (lastProcessedSurveyBlock < initialLastBlockSurvey) {
        lastProcessedSurveyBlock = initialLastBlockSurvey;
      }
      currentNetworkCache.surveysLatestBlock = lastProcessedSurveyBlock;

      if (typeof currentNetworkCache.surveyResponses !== 'object' || currentNetworkCache.surveyResponses === null) {
        currentNetworkCache.surveyResponses = {};
      }
      if (
        typeof currentNetworkCache.surveyResponsesLatestBlock !== 'object' ||
        currentNetworkCache.surveyResponsesLatestBlock === null
      ) {
        currentNetworkCache.surveyResponsesLatestBlock = {};
      }
      if (
        typeof currentNetworkCache.pendingSurveyMetadata !== 'object' ||
        currentNetworkCache.pendingSurveyMetadata === null
      ) {
        currentNetworkCache.pendingSurveyMetadata = {};
      }

      const cachedSurveyRefreshItems = (
        slug
          ? Object.values(currentNetworkCache.surveys || {})
            .map((survey) => ({
              surveyId: String(survey?.surveyID || survey?.id || '').toLowerCase(),
              creationBlock: Number.isFinite(Number(survey?.creationBlock)) ? Number(survey.creationBlock) : null,
            }))
            .filter((item) => (
              !!item.surveyId &&
              !Object.prototype.hasOwnProperty.call(
                currentNetworkCache.surveys?.[item.surveyId] || {},
                'sessionSlugExplicit'
              )
            ))
          : []
      );

      const latestBlock = baseTo;
      mainSiteLog.log('Latest block number (Surveys, clamped):', latestBlock);

      const fromBlockForSurveyDiscovery = currentNetworkCache.surveysLatestBlock + 1;
      let surveyItems = [];

      const MAX_PENDING_SURVEY_METADATA_ATTEMPTS = 12;
      const MAX_PENDING_SURVEY_COOLDOWN_MS = 5 * 60 * 1000;
      const computeBackoffMs = (attempts) => {
        const n = Math.max(0, Math.min(6, Number(attempts || 0) - 1));
        return Math.min(60000, Math.round(1000 * Math.pow(2, n)));
      };
      const markPendingSurvey = (surveyIdLower, creationBlock, { bumpAttempts = true, error = null } = {}) => {
        if (!surveyIdLower) return;
        if (
          typeof currentNetworkCache.pendingSurveyMetadata !== 'object' ||
          !currentNetworkCache.pendingSurveyMetadata
        ) {
          currentNetworkCache.pendingSurveyMetadata = {};
        }
        const slot = currentNetworkCache.pendingSurveyMetadata;
        const prev = slot[surveyIdLower] && typeof slot[surveyIdLower] === 'object'
          ? slot[surveyIdLower]
          : { attempts: 0, nextRetryAtMs: 0, creationBlock: null };
        const attempts = bumpAttempts ? (Number(prev.attempts || 0) + 1) : Number(prev.attempts || 0);
        const stopDecision = shouldStopPendingMetadataRetry({
          pendingEntry: { ...prev, attempts },
          error,
          maxAttempts: MAX_PENDING_SURVEY_METADATA_ATTEMPTS,
        });
        const failureMeta = normalizeArweaveFailureMeta(error);
        const terminalRetryAtMs = Number(failureMeta.nextRetryAtMs || 0);
        if (stopDecision.stop) {
          if (
            stopDecision.terminal &&
            Number.isFinite(terminalRetryAtMs) &&
            terminalRetryAtMs > Date.now()
          ) {
            slot[surveyIdLower] = {
              attempts,
              nextRetryAtMs: terminalRetryAtMs,
              creationBlock: Number.isFinite(Number(creationBlock))
                ? Number(creationBlock)
                : (Number(prev.creationBlock) || null),
              state: failureMeta.state || 'terminal_not_found',
              lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
              message: String(failureMeta.message || ''),
            };
            return;
          }
          if (stopDecision.reachedMaxAttempts && !stopDecision.terminal) {
            const cooldownRetryAtMs = Date.now() + MAX_PENDING_SURVEY_COOLDOWN_MS;
            const externalNextRetryAt = Number(failureMeta.nextRetryAtMs || 0);
            slot[surveyIdLower] = {
              attempts,
              nextRetryAtMs: Number.isFinite(externalNextRetryAt) && externalNextRetryAt > cooldownRetryAtMs
                ? externalNextRetryAt
                : cooldownRetryAtMs,
              creationBlock: Number.isFinite(Number(creationBlock))
                ? Number(creationBlock)
                : (Number(prev.creationBlock) || null),
              state: failureMeta.state || 'transient',
              lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
              message: String(failureMeta.message || ''),
            };
            mainSiteLog.warn('[MainSite] Pending survey metadata reached max attempts; applying cooldown', {
              group: slug,
              surveyId: surveyIdLower,
              attempts,
              nextRetryAtMs: slot[surveyIdLower].nextRetryAtMs,
            });
            return;
          }
          try { delete slot[surveyIdLower]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
          mainSiteLog.warn('[MainSite] Stopping pending survey metadata retry', {
            group: slug,
            surveyId: surveyIdLower,
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
        slot[surveyIdLower] = {
          attempts,
          nextRetryAtMs: Number.isFinite(externalNextRetryAt) && externalNextRetryAt > computedNextRetryAt
            ? externalNextRetryAt
            : computedNextRetryAt,
          creationBlock: Number.isFinite(Number(creationBlock))
            ? Number(creationBlock)
            : (Number(prev.creationBlock) || null),
          state: failureMeta.state || 'transient',
          lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
          message: String(failureMeta.message || ''),
        };
      };
      const clearPendingSurvey = (surveyIdLower) => {
        try {
          if (currentNetworkCache?.pendingSurveyMetadata?.[surveyIdLower]) {
            delete currentNetworkCache.pendingSurveyMetadata[surveyIdLower];
          }
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      };
      const pruneLoadedPendingSurveyMetadata = () => {
        try {
          const pending = currentNetworkCache?.pendingSurveyMetadata;
          if (!pending || typeof pending !== 'object') return 0;
          const cachedSurveys = (
            currentNetworkCache?.surveys && typeof currentNetworkCache.surveys === 'object'
          ) ? currentNetworkCache.surveys : {};
          let removed = 0;
          Object.keys(pending).forEach((sidRaw) => {
            const sid = String(sidRaw || '').toLowerCase();
            if (!sid || !cachedSurveys[sid]) return;
            try {
              delete pending[sidRaw];
              removed += 1;
            } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
          });
          return removed;
        } catch (_) {
          return 0;
        }
      };
      const prepareScopedSurveyMetadataEntry = (surveyIdLower, surveyData, creationBlock) => {
        const preparedSurveyData = prepareSurveyMetadataCacheEntry({
          surveyId: surveyIdLower,
          surveyData,
          slug,
          creationBlock,
          enforceScopedIsolation: true,
        });
        const targetSlug = resolveScopedMetadataSessionSlug(surveyData, slug);
        preparedSurveyData.slug = targetSlug;
        return {
          preparedSurveyData,
          targetSlug,
        };
      };
      const retryPendingSurveyMetadata = async ({ maxToProcess = 10, batchSize = 3 } = {}) => {
        try {
          const removedStalePending = pruneLoadedPendingSurveyMetadata();
          if (removedStalePending > 0) {
            dgWrite('surveysCache', slug, surveysCache);
          }
          const pending = currentNetworkCache?.pendingSurveyMetadata;
          if (!pending || typeof pending !== 'object') return 0;
          const now = Date.now();
          const due = Object.keys(pending)
            .map((sid) => ({ sid, entry: pending[sid] }))
            .filter((row) => (
              row &&
              row.sid &&
              !currentNetworkCache?.surveys?.[String(row.sid || '').toLowerCase()] &&
              Number(row.entry?.nextRetryAtMs || 0) <= now
            ))
            .sort((a, b) => (Number(a.entry?.nextRetryAtMs || 0) - Number(b.entry?.nextRetryAtMs || 0)))
            .slice(0, Math.max(0, Number(maxToProcess || 0)));
          if (!due.length) return 0;

          mainSiteLog.log(`[MainSite] Retrying ${due.length} pending survey metadata fetch(es) (group=${slug}).`);

          for (let i = 0; i < due.length; i += batchSize) {
            const batch = due.slice(i, i + batchSize);
            // eslint-disable-next-line no-await-in-loop
            const results = await Promise.all(batch.map(async ({ sid, entry }) => {
              const sidLower = String(sid || '').toLowerCase();
              if (!sidLower) return { sid: sidLower, entry, surveyData: null };
              if (currentNetworkCache?.surveys?.[sidLower]) {
                return {
                  sid: sidLower,
                  entry,
                  surveyData: currentNetworkCache.surveys[sidLower],
                  skippedCached: true,
                };
              }
              try {
                const surveyData = await contractScripts.getSurveyDataById('none', sidLower, slug, { throwOnFailure: true });
                return { sid: sidLower, entry, surveyData };
              } catch (err) {
                return { sid: sidLower, entry, surveyData: null, err };
              }
            }));

            results.forEach((item) => {
              const sid = String(item.sid || '').toLowerCase();
              if (!sid) return;
              if (item.surveyData) {
                const { preparedSurveyData, targetSlug } = prepareScopedSurveyMetadataEntry(
                  sid,
                  item.surveyData,
                  item.entry?.creationBlock
                );
                if (targetSlug === slug) {
                  currentNetworkCache.surveys[sid] = preparedSurveyData;
                } else {
                  try { delete currentNetworkCache.surveys[sid]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
                  writeSurveyMetadataToCache(
                    targetSlug,
                    sid,
                    preparedSurveyData,
                    item.entry?.creationBlock,
                    networkID,
                    { enforceScopedIsolation: true }
                  );
                }
                clearPendingSurvey(sid);
              } else {
                markPendingSurvey(sid, item.entry?.creationBlock, { error: item.err });
              }
            });

            dgWrite('surveysCache', slug, surveysCache);
            // eslint-disable-next-line no-await-in-loop
            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          return due.length;
        } catch (_) {
          return 0;
        }
      };

      const schedulePendingSurveyMetadataRetry = () => {
        try {
          const pending = currentNetworkCache?.pendingSurveyMetadata;
          if (!pending || typeof pending !== 'object') return;

          const entries = Object.values(pending).filter((value) => value && typeof value === 'object');
          if (!entries.length) return;

          let nextAtMs = Infinity;
          entries.forEach((entry) => {
            const at = Number(entry.nextRetryAtMs || 0);
            if (at > 0 && at < nextAtMs) nextAtMs = at;
          });
          if (!Number.isFinite(nextAtMs)) nextAtMs = Date.now() + 1500;
          const delayMs = Math.max(500, nextAtMs - Date.now());

          if (_pendingSurveyMetadataRetryTimers[slug]) {
            clearTimeout(_pendingSurveyMetadataRetryTimers[slug]);
          }
          _pendingSurveyMetadataRetryTimers[slug] = setTimeout(() => {
            try {
              delete _pendingSurveyMetadataRetryTimers[slug];
              if (!isMounted()) return;
              const activeSlug = normalizeSessionSlug(getActiveSessionSlug() || '');
              const allowGeneralBackfillRetry = slug === '' && getSessionScanScope() === 'general';
              if (!allowGeneralBackfillRetry && activeSlug !== slug) return;
              initializeSurveyCacheForGroup(
                slug,
                suppressUiState ? { background: true } : undefined
              );
            } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
          }, delayMs);
        } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
      };

      let userCache = dgRead('userCache', slug) || {};
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

      try {
        await retryPendingSurveyMetadata().catch(() => null);

        if (fromBlockForSurveyDiscovery <= latestBlock) {
          mainSiteLog.log(`Fetching survey IDs from block ${fromBlockForSurveyDiscovery} to ${latestBlock} (group=${slug})`);
          surveyItems = await contractScripts.fetchUserSubmittedSurveyIDs(
            'none',
            fromBlockForSurveyDiscovery,
            latestBlock,
            slug
          );
        } else {
          mainSiteLog.log('No new blocks to fetch survey IDs from.');
        }

        surveyItems = [
          ...cachedSurveyRefreshItems,
          ...(Array.isArray(surveyItems) ? surveyItems : []),
        ];

        if (surveyItems && surveyItems.length > 0) {
          for (const item of surveyItems) {
            const surveyID = item.surveyId.toLowerCase();
            const creationBlock = item.creationBlock;
            const existingSurvey = currentNetworkCache.surveys[surveyID];
            const needsBindingRefresh = (
              !!slug &&
              !!existingSurvey &&
              !Object.prototype.hasOwnProperty.call(existingSurvey, 'sessionSlugExplicit')
            );

            if (!existingSurvey || needsBindingRefresh) {
              let surveyData = null;
              let surveyFetchErr = null;
              try {
                // eslint-disable-next-line no-await-in-loop
                surveyData = await contractScripts.getSurveyDataById('none', surveyID, slug, { throwOnFailure: true });
              } catch (e) {
                surveyFetchErr = e;
                surveyData = null;
              }
              if (surveyData) {
                const { preparedSurveyData, targetSlug } = prepareScopedSurveyMetadataEntry(
                  surveyID,
                  surveyData,
                  creationBlock
                );
                if (targetSlug === slug) {
                  currentNetworkCache.surveys[surveyID] = preparedSurveyData;
                } else {
                  try { delete currentNetworkCache.surveys[surveyID]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
                  writeSurveyMetadataToCache(
                    targetSlug,
                    surveyID,
                    preparedSurveyData,
                    creationBlock,
                    networkID,
                    { enforceScopedIsolation: true }
                  );
                }
                clearPendingSurvey(surveyID);

                if (targetSlug === slug && preparedSurveyData.creator) {
                  const uData = ensureUserNode(preparedSurveyData.creator, latestBlock);
                  if (!uData.createdSurveys) uData.createdSurveys = [];
                  if (!uData.createdSurveys.some((survey) => survey.id === surveyID)) {
                    uData.createdSurveys.push({ id: surveyID, data: preparedSurveyData });
                    userCacheModified = true;
                  }
                }
              } else {
                markPendingSurvey(surveyID, creationBlock, { error: surveyFetchErr });
              }
            }
          }
        }

        currentNetworkCache.surveysLatestBlock = Math.max(
          Number(currentNetworkCache.surveysLatestBlock) || 0,
          latestBlock
        );
        dgWrite('surveysCache', slug, surveysCache);

        for (const surveyID in currentNetworkCache.surveys) {
          const surveyIDLower = surveyID.toLowerCase();
          const surveyObj = currentNetworkCache.surveys[surveyID];
          const surveyResponseLastBlock = Object.prototype.hasOwnProperty.call(
            currentNetworkCache.surveyResponsesLatestBlock,
            surveyIDLower
          )
            ? currentNetworkCache.surveyResponsesLatestBlock[surveyIDLower]
            : initialLastBlockSurvey;

          const startBlock = Math.max(
            surveyResponseLastBlock + 1,
            surveyObj?.creationBlock || 0,
            initialLastBlockSurvey
          );

          if (latestBlock >= startBlock) {
            mainSiteLog.log(
              `Fetching/updating responses for survey ${surveyIDLower}, from block ${startBlock} up to ${latestBlock} (group=${slug})`
            );
            const surveyResponseBatch = normalizeSurveyResponseBatchResult(await contractScripts.fetchAllSurveyResponses(
              'none',
              surveyIDLower,
              startBlock,
              latestBlock,
              slug
            ));

            if (!currentNetworkCache.surveyResponses[surveyIDLower]) {
              currentNetworkCache.surveyResponses[surveyIDLower] = {};
            }
            for (const item of surveyResponseBatch.responses) {
              const responderAddr = item.responder.toLowerCase();
              currentNetworkCache.surveyResponses[surveyIDLower][responderAddr] = item.response;

              const uData = ensureUserNode(responderAddr, latestBlock);
              if (!uData.surveyResponses) uData.surveyResponses = [];
              if (!uData.surveyResponses.some((response) => response.surveyId === surveyIDLower)) {
                uData.surveyResponses.push({
                  surveyId: surveyIDLower,
                  responder: responderAddr,
                  response: item.response,
                });
                userCacheModified = true;
              }
            }
            currentNetworkCache.surveyResponsesLatestBlock[surveyIDLower] = resolveSurveyResponseWatermark({
              startBlock,
              latestBlock,
              hadPartialFailure: surveyResponseBatch.hadPartialFailure,
              lowestFailedBlock: surveyResponseBatch.lowestFailedBlock,
            });
          }
        }

        dgWrite('surveysCache', slug, surveysCache);

        if (userCacheModified) {
          dgWrite('userCache', slug, userCache);
        }

        schedulePendingSurveyMetadataRetry();

        mainSiteLog.log('Surveys cache initialized or updated (group-aware).');
      } catch (error) {
        mainSiteLog.error('Error fetching surveys or responses (group-aware):', error);
        dgWrite('surveysCache', slug, surveysCache);
        if (userCacheModified) dgWrite('userCache', slug, userCache);
        setSurveyState({ surveyCacheInitializationError: true });
      }
    })();

    _surveyInitInFlight[slug] = run;
    try {
      return await run;
    } finally {
      delete _surveyInitInFlight[slug];
      if (_surveyInitPending[slug]) {
        const pendingOpts = _surveyInitPending[slug];
        delete _surveyInitPending[slug];
        setTimeout(() => {
          try {
            if (!isMounted()) return;
            initializeSurveyCacheForGroup(slug, pendingOpts || rerunOpts);
          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        }, 0);
      }
    }
  };

  const refreshSurveyResponsesByIDForGroup = async (slugIn, surveyID) => {
    const slug = normalizeSessionSlug(slugIn || '');
    mainSiteLog.log('refreshSurveyResponsesByIDForGroup() for surveyID:', surveyID, 'slug:', slug);
    const netId = String(getSessionChainId(slug) || '');
    if (!netId) {
      mainSiteLog.warn('No group chainId available');
      return;
    }
    const { fromBlock: baseFrom, toBlock: baseTo } = await contractScripts.getRelevantBlockWindowForFilter(slug);
    const initialLastBlockSurvey = Math.max(0, baseFrom - 1);
    let surveysCache = dgRead('surveysCache', slug) || {};

    if (!surveysCache[netId]) {
      surveysCache[netId] = {
        surveysLatestBlock: initialLastBlockSurvey,
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
      };
    }
    if (!surveysCache[netId].surveyResponses) surveysCache[netId].surveyResponses = {};
    if (
      typeof surveysCache[netId].surveyResponsesLatestBlock !== 'object' ||
      surveysCache[netId].surveyResponsesLatestBlock === null
    ) {
      surveysCache[netId].surveyResponsesLatestBlock = {};
    }

    const surveyIDLower = surveyID.toLowerCase();
    const surveyObj = surveysCache[netId].surveys[surveyIDLower];
    const currentLocalBlock = Object.prototype.hasOwnProperty.call(
      surveysCache[netId].surveyResponsesLatestBlock,
      surveyIDLower
    )
      ? surveysCache[netId].surveyResponsesLatestBlock[surveyIDLower]
      : initialLastBlockSurvey;

    const latestChainBlock = baseTo;
    const startBlock = Math.max(currentLocalBlock + 1, surveyObj?.creationBlock || 0, initialLastBlockSurvey);

    if (startBlock > latestChainBlock) {
      mainSiteLog.log('Survey responses are already up-to-date for surveyID:', surveyIDLower);
      return;
    }

    mainSiteLog.log(
      `Fetching new responses for surveyID ${surveyIDLower} from block ${startBlock} to ${latestChainBlock} (group=${slug})`
    );
    const surveyResponseBatch = normalizeSurveyResponseBatchResult(await contractScripts.fetchAllSurveyResponses(
      'none',
      surveyIDLower,
      startBlock,
      latestChainBlock,
      slug
    ));

    if (!surveysCache[netId].surveyResponses[surveyIDLower]) {
      surveysCache[netId].surveyResponses[surveyIDLower] = {};
    }
    for (const item of surveyResponseBatch.responses) {
      const responderAddr = item.responder.toLowerCase();
      surveysCache[netId].surveyResponses[surveyIDLower][responderAddr] = item.response;
    }
    surveysCache[netId].surveyResponsesLatestBlock[surveyIDLower] = resolveSurveyResponseWatermark({
      startBlock,
      latestBlock: latestChainBlock,
      hadPartialFailure: surveyResponseBatch.hadPartialFailure,
      lowestFailedBlock: surveyResponseBatch.lowestFailedBlock,
    });
    dgWrite('surveysCache', slug, surveysCache);
    mainSiteLog.log('Survey responses updated for surveyID:', surveyIDLower);
    queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
  };

  return {
    initializeSurveyCacheForGroup,
    refreshSurveyResponsesByIDForGroup,
    isInitInFlight,
    destroy,
  };
};
