import type { ContractScriptsMethodMap, ContractScriptsRuntimeDeps } from './contractScripts.runtimeDeps.js';

type SbtReadProviderRef = string | Record<string, unknown>;
type SbtReadGroupKeyOrConfig = string | Record<string, unknown> | null | undefined;
type SbtReadOptions = { allowInjectedReadFallback?: boolean; [key: string]: unknown };
type SignGroupMintAuthorizationInput = {
  password?: unknown;
  sbtAddress?: string | null;
  userAddress?: string | null;
  walletScopeSbtAddress?: string | null;
};
type GenerateInvitePayloadsInput = {
  password?: unknown;
  sbtAddress?: string | null;
  nonces?: Array<string | number>;
  walletScopeSbtAddress?: string | null;
};
type InvitePayloadResult = {
  nonce: string;
  signature: string;
  inviteCode: string;
};
type EncodedInvitePayload = {
  n: string;
  s: string;
};
type SbtMintBurnCountsByAddressResult = {
  mintedCountByAddress: Record<string, number>;
  burnedCountByAddress: Record<string, number>;
  mintedEventCount?: number;
  burnedEventCount?: number;
  scannedToBlock?: number | null;
  ok?: boolean;
  [key: string]: unknown;
};

export const createContractScriptsSurveyEventReadMethods = (
  deps: ContractScriptsRuntimeDeps,
): ContractScriptsMethodMap => {
  const {
    ARWEAVE_ACTIVE,
    CUSTOM_SBT_ABI,
    CUSTOM_SBT_INTERFACE,
    GAS_FALLBACKS,
    HASH_MISS_SENTINEL,
    HASH_READ_MAX_ENTRIES,
    HASH_READ_TTL_MS,
    READ_INFLIGHT,
    READ_MEMO,
    SBT_FACTORY_ABI,
    SBT_FACTORY_INTERFACE,
    SBT_READ_PROVIDER_OPTIONS,
    SBT_TOKENURI_METADATA_GATEWAYS,
    SBT_TOKENURI_METADATA_TIMEOUT_MS,
    STORAGE_BACKENDS,
    STORAGE_RESOURCE_KEYS,
    SURVEYS,
    SURVEYS_INTERFACE,
    arweaveScripts,
    attachStorageRefCompatibilityFields,
    buildSbtScopeMemoTag,
    clearReadCachesForGroup,
    getSessionAddresses,
    getTimedMemoValue,
    normalizeSbtSessionLinkFields,
    resolveArweaveUploadOpts,
    resolveSessionNameValue,
    attachPayloadPointerFields,
    buildArweaveDebugContext,
    buildArweaveReadModeTag,
    buildDecryptModeTag,
    buildFailureModeTag,
    buildHashReadInflightKey,
    buildHashReadMemoKey,
    buildHashUnavailableMetadataError,
    callWithRetry,
    cloneJsonSafe,
    contractEventScanMethods,
    contractsLog,
    createSbtEventScanProgressState,
    cryptoUtils,
    deriveSbtHistorySummaryFromCounts,
    downloadArweaveTextForGroup,
    ethers,
    extractChainId,
    fetchLogsSmartWithProvider,
    getLocalAwareReadProviderForGroup,
    getReadProviderForChain,
    getSurveysReadProviderForSession,
    hasNonZeroHashValue,
    hasPasswordMintForSbtMintMode,
    inviteLog,
    isCallExceptionError,
    isCloudflareStorageResource,
    isNonexistentTokenError,
    isObj,
    isRetryableSurveyResponseReadError,
    latestBlockCache,
    logArweaveMetadataFetchFailure,
    markHashRevertLoggedOnce,
    maybeWrapUnsupportedConfiguredDeterministicFactoryError,
    memoizedResolveSession,
    normalizeAddress,
    normalizeArweaveUrl,
    normalizeConvictionImportance,
    normalizeCreate2Salt,
    normalizeHistorySummaryCount,
    normalizeQuestionFlags,
    normalizeSbtHistorySummary,
    normalizeSessionNameFields,
    normalizeSessionSlug,
    normalizeStorageRef,
    notify,
    notifyUserFacingTransactionError,
    parseArweaveTxId,
    questionHashRevertLogged,
    readPayloadPointerTextForGroup,
    recordTerminalArweaveInvalidFailure,
    resolveGroupPasswordWalletScopeSbtAddress,
    resolveReadContext,
    resolveReadProvider,
    resolveSession,
    resolveSessionByName,
    resolveStorageSessionSlug,
    resolveTxGasOverrides,
    rpcLog,
    runInFlightCoalesced,
    runWithSoftTimeout,
    sendContractWriteViaProvider,
    setTimedMemoValue,
    shouldLog,
    surveyHashRevertLogged,
    uploadJsonPayloadForContractPointer,
    utils,
    validateNoLockedPlaintextInPayload,
  } = deps;

  return {
    async fetchAllQuestionIDs(
      providerName: any,
      fromBlock: any = null,
      toBlock: any = null,
      groupKeyOrCfg: any = null,
    ) {
      return contractEventScanMethods.fetchAllQuestionIDs(this, providerName, fromBlock, toBlock, groupKeyOrCfg);
    },

    // === CHANGED: +groupKeyOrCfg (optional). Uses group provider/addr and clamps
    async getAllQuestionIDsChunkedWithCallback(
      providerName: any,
      fromBlock: any = 0,
      toBlock: any = 'latest',
      onChunkProgress: any = null,
      onPartialData: any = null,
      groupKeyOrCfg: any,
      scanOptions: any = null,
    ) {
      return contractEventScanMethods.getAllQuestionIDsChunkedWithCallback(
        this,
        providerName,
        fromBlock,
        toBlock,
        onChunkProgress,
        onPartialData,
        groupKeyOrCfg,
        scanOptions,
      );
    },

    async getResponsesByQuestionID(
      providerName: any,
      questionId: any,
      fromBlock: any = null,
      toBlock: any = null,
      groupKeyOrCfg: any = null,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);
      const responseSubmittedEventFilter = SurveyContract.filters.ResponsesSubmitted();

      // 🔐 Normalize
      const ensureHash = (v: any) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };
      const qIdB32 = ensureHash(questionId);
      if (!utils.isHexString(qIdB32, 32)) return [];

      // Per-group base window + clamp caller overrides
      const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
        _resolvedCfg: cfg,
      });

      const fromBlockNum = Number.isFinite(Number(fromBlock)) ? Math.max(Number(fromBlock), baseFrom) : baseFrom;

      const toBlockNum =
        toBlock === 'latest' || typeof toBlock !== 'number' ? baseTo : Math.min(Number(toBlock), baseTo);

      if (fromBlockNum > toBlockNum) return [];

      rpcLog('getResponsesByQuestionID: Fetching logs with fetchLogsSmartWithProvider:', {
        address: SurveyContract.address,
        fromBlock: fromBlockNum,
        toBlock: toBlockNum,
      });
      const rawLogs = await fetchLogsSmartWithProvider(
        provider,
        responseSubmittedEventFilter,
        fromBlockNum,
        toBlockNum,
      );
      const events = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

      const responses = await Promise.all(
        events
          .filter((event: any) => {
            try {
              const evIds = (event.args.questionIds || []).map((x: any) => String(x).toLowerCase());
              return evIds.includes(qIdB32.toLowerCase());
            } catch {
              return false;
            }
          })
          .map(async (event: any) => {
            const responder = event.args.responder;
            const surveyId = event.args.surveyId;
            let blockTimestamp = 0;
            try {
              const blockData = await this.getBlockWithCaching(provider, event.blockNumber, providerName, String(chId));
              if (blockData) {
                blockTimestamp = blockData.timestamp;
              }
            } catch (e: any) {
              /* ignore */
            }
            let responseData = null;
            try {
              responseData = await this.getResponse(providerName, responder, qIdB32, groupKeyOrCfg, {
                _resolvedCfg: cfg,
              });
            } catch (e: any) {
              contractsLog.warn('[getResponsesByQuestionID] individual response read failed; skipping', {
                responder,
                qId: qIdB32,
                error: e?.message,
              });
            }
            return {
              responder,
              questionId: qIdB32,
              surveyId,
              response: responseData,
              timestamp: blockTimestamp,
            };
          }),
      );
      return responses;
    },

    async getSurveyResponsesByAddress(
      providerName: any,
      userAddress: any,
      fromBlock: any = null,
      toBlock: any = null,
      groupKeyOrCfg: any = null,
    ) {
      return contractEventScanMethods.getSurveyResponsesByAddress(
        this,
        providerName,
        userAddress,
        fromBlock,
        toBlock,
        groupKeyOrCfg,
      );
    },

    async getSurveyResponses(
      providerName: any,
      fromCustomBlock: any = 0,
      toCustomBlock: any = 'latest',
      groupKeyOrCfg: any = null,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
      const contract = new ethers.Contract(addr, SURVEYS, provider as any);
      const responsesSubmittedEventFilter = contract.filters.ResponsesSubmitted(null, null, null);

      // Per-group base window + clamp caller overrides
      const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
        _resolvedCfg: cfg,
      });

      const fromBlock = Number.isFinite(Number(fromCustomBlock))
        ? Math.max(Number(fromCustomBlock), baseFrom)
        : baseFrom;

      const toBlock =
        toCustomBlock === 'latest' || typeof toCustomBlock !== 'number'
          ? baseTo
          : Math.min(Number(toCustomBlock), baseTo);

      if (fromBlock > toBlock) return {};

      rpcLog('getSurveyResponses: Fetching logs with fetchLogsSmartWithProvider:', {
        address: contract.address,
        fromBlock,
        toBlock,
      });
      const rawLogs = await fetchLogsSmartWithProvider(provider, responsesSubmittedEventFilter, fromBlock, toBlock);
      const events = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

      const surveyResponses: any = {};
      const responseEntries = await Promise.all(
        events.map(async (event: any) => {
          const responder = event.args.responder.toLowerCase();
          const surveyId = event.args.surveyId.toLowerCase();
          const responseData = await this.getSurveyResponse(providerName, responder, surveyId, groupKeyOrCfg);
          return { responder, responseData, surveyId };
        }),
      );
      for (const { responder, responseData, surveyId } of responseEntries) {
        if (responseData) {
          if (!surveyResponses[surveyId]) {
            surveyResponses[surveyId] = {};
          }
          surveyResponses[surveyId][responder] = responseData;
        }
      }
      return surveyResponses;
    },

    async getSurveysCreatedByAddress(
      providerName: any,
      userAddress: any,
      fromBlock: any = null,
      toBlock: any = null,
      groupKeyOrCfg: any = null,
    ) {
      return contractEventScanMethods.getSurveysCreatedByAddress(
        this,
        providerName,
        userAddress,
        fromBlock,
        toBlock,
        groupKeyOrCfg,
      );
    },

    async getQuestionResponses(
      providerName: any,
      fromCustomBlock: any = 0,
      toCustomBlock: any = 'latest',
      onChunkProgress: any = null,
      groupKeyOrCfg: any = null,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
      const contract = new ethers.Contract(addr, SURVEYS, provider as any);
      const responsesSubmittedEventFilter = contract.filters.ResponsesSubmitted(null, null, null);

      // Per-group base window + clamp caller overrides
      const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
        _resolvedCfg: cfg,
      });

      const fromBlock = Number.isFinite(Number(fromCustomBlock))
        ? Math.max(Number(fromCustomBlock), baseFrom)
        : baseFrom;

      const toBlock =
        toCustomBlock === 'latest' || typeof toCustomBlock !== 'number'
          ? baseTo
          : Math.min(Number(toCustomBlock), baseTo);

      if (fromBlock > toBlock) {
        return {};
      }

      rpcLog('getQuestionResponses: Fetching logs with fetchLogsSmartWithProvider:', {
        address: contract.address,
        fromBlock,
        toBlock,
      });
      const rawLogs = await fetchLogsSmartWithProvider(provider, responsesSubmittedEventFilter, fromBlock, toBlock);
      const allEventData = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

      const questionResponses: any = {};
      await Promise.all(
        allEventData.map(async (event: any) => {
          const responder = event.args.responder.toLowerCase();
          const questionIds = event.args.questionIds.map((q: any) => q.toLowerCase());

          const respArray = await Promise.all(
            questionIds.map((qId: any) =>
              this.getResponse(providerName, responder, qId, groupKeyOrCfg, {
                _resolvedCfg: cfg,
              }).catch((e: any) => {
                contractsLog.warn('[getQuestionResponses] individual response read failed; skipping', {
                  qId,
                  error: e?.message,
                });
                return null;
              }),
            ),
          );

          respArray.forEach((responseData: any, idx: any) => {
            if (responseData) {
              const qId = questionIds[idx];
              if (!questionResponses[qId]) questionResponses[qId] = {};
              questionResponses[qId][responder] = responseData;
            }
          });
        }),
      );

      if (onChunkProgress) {
        onChunkProgress({
          chunkFrom: fromBlock,
          chunkTo: toBlock,
          doneSoFarBlocks: toBlock - fromBlock + 1,
          totalRangeBlocks: toBlock - fromBlock + 1,
          chunkEventCount: allEventData.length,
          overallEventCount: allEventData.length,
        });
      }

      return questionResponses;
    },

    async getQuestionResponsesChunkedWithCallback(
      providerName: any,
      fromCustomBlock: any = 0,
      toCustomBlock: any = 'latest',
      onChunkProgress: any = null,
      onPartialData: any = null,
      groupKeyOrCfg: any,
      opts: { forceArweaveFetch?: boolean } = {},
    ) {
      let resolvedFromBlockNum;
      let resolvedToBlockNum;

      try {
        const cfg = resolveSession(groupKeyOrCfg || '');
        const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
        const gAddrs = getSessionAddresses(cfg);
        const addr = gAddrs.surveys?.address;
        const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;
        if (!addr) {
          contractsLog.warn('[getQuestionResponsesChunkedWithCallback] Missing surveys address; skipping scan.', {
            group: cfg?.slug || '',
          });
          if (onPartialData) onPartialData({}, Math.max(0, Number(fromCustomBlock || 0) - 1));
          return;
        }

        const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

        const contract = new ethers.Contract(addr, SURVEYS, provider as any);
        const responsesSubmittedEventFilter = contract.filters.ResponsesSubmitted(null, null, null);

        // Per-group base window + clamp caller overrides
        const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
          _resolvedCfg: cfg,
        });

        resolvedFromBlockNum = Number.isFinite(Number(fromCustomBlock))
          ? Math.max(Number(fromCustomBlock), baseFrom)
          : baseFrom;

        resolvedToBlockNum =
          toCustomBlock === 'latest' || typeof toCustomBlock !== 'number'
            ? baseTo
            : Math.min(Number(toCustomBlock), baseTo);

        if (resolvedFromBlockNum > resolvedToBlockNum) {
          if (onPartialData) onPartialData({}, resolvedFromBlockNum);
          return;
        }

        rpcLog('getQuestionResponsesChunkedWithCallback: Fetching logs:', {
          contractAddress: contract.address,
          fromBlock: resolvedFromBlockNum,
          toBlock: resolvedToBlockNum,
        });
        const rawLogs = await fetchLogsSmartWithProvider(
          provider,
          responsesSubmittedEventFilter,
          resolvedFromBlockNum,
          resolvedToBlockNum,
        );
        const parsedEvents = rawLogs.map((log: any) => ({
          event: SURVEYS_INTERFACE.parseLog(log),
          blockNumber: Number(log?.blockNumber || 0),
          transactionIndex: Number(log?.transactionIndex || 0),
          logIndex: Number(log?.logIndex || 0),
        }));

        // Deduplicate by (questionId,responder), keeping only the latest event for each pair.
        const latestByPair = new Map();
        parsedEvents.forEach(({ event, blockNumber, transactionIndex, logIndex }: any) => {
          const responder = String(event?.args?.responder || '').toLowerCase();
          const questionIds = Array.isArray(event?.args?.questionIds)
            ? event.args.questionIds.map((id: any) => String(id || '').toLowerCase())
            : [];
          questionIds.forEach((qId: any) => {
            if (!qId) return;
            const pairKey = `${qId}|${responder}`;
            const prev = latestByPair.get(pairKey);
            const isNewer =
              !prev ||
              blockNumber > Number(prev.blockNumber || 0) ||
              (blockNumber === Number(prev.blockNumber || 0) &&
                (transactionIndex > Number(prev.transactionIndex || 0) ||
                  (transactionIndex === Number(prev.transactionIndex || 0) && logIndex > Number(prev.logIndex || 0))));
            if (isNewer) {
              latestByPair.set(pairKey, { responder, qId, blockNumber, transactionIndex, logIndex });
            }
          });
        });

        const uniquePairs = Array.from(latestByPair.values());
        const fullRangeAggregator: any = {};
        await Promise.all(
          uniquePairs.map(async ({ responder, qId, blockNumber, transactionIndex, logIndex }: any) => {
            let blockTimestamp = 0;
            try {
              const blockData = await this.getBlockWithCaching(provider, blockNumber, providerName, String(chId));
              blockTimestamp = blockData ? blockData.timestamp || 0 : 0;
            } catch (error: any) {
              blockTimestamp = Math.floor(Date.now() / 1000);
            }

            let respData = null;
            try {
              respData = await this.getResponse(providerName, responder, qId, groupKeyOrCfg, {
                _resolvedCfg: cfg,
                forceArweaveFetch,
              });
            } catch (e: any) {
              contractsLog.warn('[getQuestionResponsesFullRange] individual response read failed; skipping', {
                responder,
                qId,
                error: e?.message,
              });
            }
            if (!respData) return;
            if (!fullRangeAggregator[qId]) fullRangeAggregator[qId] = [];
            fullRangeAggregator[qId].push({
              responder,
              questionId: qId,
              response: respData,
              timestamp: blockTimestamp,
              blockNumber,
              transactionIndex,
              logIndex,
            });
          }),
        );

        if (onChunkProgress) {
          const totalRangeBlocks = resolvedToBlockNum - resolvedFromBlockNum + 1;
          onChunkProgress({
            chunkFrom: resolvedFromBlockNum,
            chunkTo: resolvedToBlockNum,
            doneSoFarBlocks: totalRangeBlocks,
            totalRangeBlocks: totalRangeBlocks,
            remainingBlocks: 0,
            chunkEventCount: parsedEvents.length,
            overallEventCount: uniquePairs.length,
          });
        }

        if (onPartialData) {
          onPartialData(fullRangeAggregator, resolvedToBlockNum);
        }
      } catch (err: any) {
        contractsLog.error('Critical Error in getQuestionResponsesChunkedWithCallback:', err);
        if (onPartialData && resolvedFromBlockNum !== undefined) {
          onPartialData({}, resolvedFromBlockNum - 1);
        }
      }
    },

    async getQuestionsCreatedByAddress(
      providerName: any,
      userAddress: any,
      fromBlock: any = null,
      toBlock: any = null,
      groupKeyOrCfg: any = null,
    ) {
      return contractEventScanMethods.getQuestionsCreatedByAddress(
        this,
        providerName,
        userAddress,
        fromBlock,
        toBlock,
        groupKeyOrCfg,
      );
    },

    async getQuestionResponsesByAddress(
      providerName: any,
      userAddress: any,
      fromBlock: any = null,
      toBlock: any = null,
      groupKeyOrCfg: any = null,
      opts: any = {},
    ) {
      return contractEventScanMethods.getQuestionResponsesByAddress(
        this,
        providerName,
        userAddress,
        fromBlock,
        toBlock,
        groupKeyOrCfg,
        opts,
      );
    },

    async fetchUserSubmittedSurveyIDs(
      providerName: any,
      fromBlock: any = null,
      toBlock: any = null,
      groupKeyOrCfg: any,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const blocklist = new Set((cfg?.BLOCKED_SURVEY_IDS || []).map((id: any) => id.toLowerCase()));

      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;
      if (!addr) {
        contractsLog.warn('[fetchUserSubmittedSurveyIDs] Missing surveys address; skipping scan.', {
          group: cfg?.slug || '',
        });
        return [];
      }

      // Provider resolution: group → chain provider; otherwise defaultProvider/Infura (no signer)
      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);
      const surveyAddedEventFilter = SurveyContract.filters.SurveyAdded(null, null);

      // Per-group base window + clamp caller overrides
      const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
        _resolvedCfg: cfg,
      });

      const fromBlockNum = Number.isFinite(Number(fromBlock)) ? Math.max(Number(fromBlock), baseFrom) : baseFrom;

      const toBlockNum =
        toBlock === 'latest' || typeof toBlock !== 'number' ? baseTo : Math.min(Number(toBlock), baseTo);

      if (fromBlockNum > toBlockNum) return [];

      rpcLog('fetchUserSubmittedSurveyIDs: Fetching logs:', {
        address: SurveyContract.address,
        fromBlock: fromBlockNum,
        toBlock: toBlockNum,
      });
      const rawLogs = await fetchLogsSmartWithProvider(provider, surveyAddedEventFilter, fromBlockNum, toBlockNum);
      const events = rawLogs.map((log: any) => SURVEYS_INTERFACE.parseLog(log));

      // Refactored to return object with creationBlock
      const surveyMap = new Map();
      events.forEach((event: any) => {
        const id = event.args.surveyId.toLowerCase();
        if (id && id !== ethers.constants.HashZero.toLowerCase() && !blocklist.has(id)) {
          // Keep the earliest block number if duplicates exist (though unlikely for creation)
          if (!surveyMap.has(id) || event.blockNumber < surveyMap.get(id)) {
            surveyMap.set(id, event.blockNumber);
          }
        }
      });

      // Return array of objects: { surveyId, creationBlock }
      return Array.from(surveyMap.entries()).map(([sid, bn]: any) => ({ surveyId: sid, creationBlock: bn }));
    },

    async fetchAllSurveyResponses(
      providerName: any,
      surveyId: any,
      fromBlockParam: any = null,
      toBlockParam: any = null,
      groupKeyOrCfg: any,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

      // 🔐 Normalize
      const ensureHash = (v: any) => {
        try {
          if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') return cryptoUtils.hashIdentifier(v);
        } catch {}
        try {
          if (utils.isHexString(v, 32)) return String(v).toLowerCase();
        } catch {}
        const s = v === null || v === undefined ? '' : String(v);
        return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
      };
      const sId = ensureHash(surveyId);
      if (!utils.isHexString(sId, 32)) {
        return { responses: [], hadPartialFailure: false, lowestFailedBlock: null };
      }

      const responseSubmittedEventTopic = SurveyContract.filters.ResponsesSubmitted(null, null, sId);

      // Per-group base window + clamp caller overrides
      const { fromBlock: baseFrom, toBlock: baseTo } = await this.getRelevantBlockWindowForFilter(groupKeyOrCfg, {
        _resolvedCfg: cfg,
      });

      const fromBlockNum = Number.isFinite(Number(fromBlockParam))
        ? Math.max(Number(fromBlockParam), baseFrom)
        : baseFrom;

      const toBlockNum =
        toBlockParam === 'latest' || typeof toBlockParam !== 'number' ? baseTo : Math.min(Number(toBlockParam), baseTo);

      if (fromBlockNum > toBlockNum) {
        return { responses: [], hadPartialFailure: false, lowestFailedBlock: null };
      }

      rpcLog('fetchAllSurveyResponses: Fetching logs:', {
        address: SurveyContract.address,
        fromBlock: fromBlockNum,
        toBlock: toBlockNum,
        surveyId: sId,
      });
      const rawLogs = await fetchLogsSmartWithProvider(provider, responseSubmittedEventTopic, fromBlockNum, toBlockNum);
      const parsedEvents = rawLogs.map((log: any) => ({
        event: SURVEYS_INTERFACE.parseLog(log),
        blockNumber: Number(log?.blockNumber || 0),
        logIndex: Number(log?.logIndex || 0),
      }));

      // Deduplicate by responder; keep only the newest event to avoid repeated response fetches.
      const latestByResponder = new Map();
      parsedEvents.forEach(({ event, blockNumber, logIndex }: any) => {
        const responder = String(event?.args?.responder || '').toLowerCase();
        if (!responder) return;
        const prev = latestByResponder.get(responder);
        const isNewer =
          !prev ||
          blockNumber > Number(prev.blockNumber || 0) ||
          (blockNumber === Number(prev.blockNumber || 0) && logIndex > Number(prev.logIndex || 0));
        if (isNewer) {
          latestByResponder.set(responder, { responder, blockNumber, logIndex });
        }
      });

      const responderEntries = Array.from(latestByResponder.values());
      const responseReadResults = await Promise.all(
        responderEntries.map(async ({ responder, blockNumber, logIndex }: any) => {
          let blockTimestamp = 0;
          try {
            const blockData = await this.getBlockWithCaching(provider, blockNumber, providerName, String(chId));
            if (blockData) blockTimestamp = blockData.timestamp;
          } catch {}
          let surveyResponseData = null;
          try {
            surveyResponseData = await this.getSurveyResponse(providerName, responder, sId, groupKeyOrCfg, {
              throwOnError: true,
            });
          } catch (error: any) {
            const retryable = isRetryableSurveyResponseReadError(error);
            contractsLog.warn('[fetchAllSurveyResponses] individual response read failed; skipping', {
              error: error?.message,
              retryable,
            });
            return { failed: true, blockNumber, retryable };
          }
          if (surveyResponseData === null) return null;
          return {
            failed: false,
            response: {
              responder,
              surveyId: sId,
              response: surveyResponseData,
              timestamp: blockTimestamp,
              blockNumber,
              logIndex,
            },
          };
        }),
      );

      let hadPartialFailure = false;
      let lowestFailedBlock: number | null = null;
      const responses = responseReadResults.reduce((acc: any, result: any) => {
        if (!result) return acc;
        if (result.failed) {
          if (!result.retryable) return acc;
          hadPartialFailure = true;
          const failedBlock = Number(result.blockNumber || 0);
          if (
            Number.isFinite(failedBlock) &&
            failedBlock > 0 &&
            (lowestFailedBlock === null || failedBlock < lowestFailedBlock)
          ) {
            lowestFailedBlock = failedBlock;
          }
          return acc;
        }
        acc.push(result.response);
        return acc;
      }, []);

      return {
        responses,
        hadPartialFailure,
        lowestFailedBlock,
      };
    },

    // === CHANGED: +groupKeyOrCfg (optional). Threads group to getSurveyHash.
  };
};
