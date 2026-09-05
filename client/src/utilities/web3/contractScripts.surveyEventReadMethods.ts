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
type ProviderName = string;
type AddressInput = string;
type Bytes32Input = string | number | null | undefined;
type BlockRangeInput = number | 'latest' | string | null | undefined;
type GroupKeyOrConfig = string | Record<string, unknown> | null | undefined;
type ScanOptions = Record<string, unknown> | null;
type ProgressCallback = ((progress: Record<string, unknown>) => void) | null;
type PartialDataCallback = ((data: Record<string, unknown>, cursor?: number) => void) | null;
type ParsedSurveyEvent = {
  args: {
    responder: string;
    surveyId: string;
    questionIds?: string[];
  };
  blockNumber: number;
  transactionIndex?: number;
  logIndex?: number;
};
type ContractLogLike = {
  blockNumber?: number | string | null;
  transactionIndex?: number | string | null;
  logIndex?: number | string | null;
  [key: string]: unknown;
};
type ParsedEventWithPosition = {
  event: ParsedSurveyEvent;
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
};
type LatestQuestionPair = {
  responder: string;
  qId: string;
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
};
type LatestResponder = {
  responder: string;
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
};
type SurveyResponseLookup = Record<string, Record<string, unknown>>;
type QuestionResponseLookup = Record<string, Record<string, unknown>>;

export const createContractScriptsSurveyEventReadMethods = (
  deps: ContractScriptsRuntimeDeps,
): ContractScriptsMethodMap => {
  const {
    SURVEYS,
    SURVEYS_INTERFACE,
    getSessionAddresses,
    contractEventScanMethods,
    contractsLog,
    cryptoUtils,
    ethers,
    fetchLogsSmartWithProvider,
    getSurveysReadProviderForSession,
    isRetryableSurveyResponseReadError,
    resolveSession,
    rpcLog,
    utils,
  } = deps;

  return {
    async fetchAllQuestionIDs(
      providerName: ProviderName,
      fromBlock: BlockRangeInput = null,
      toBlock: BlockRangeInput = null,
      groupKeyOrCfg: GroupKeyOrConfig = null,
    ) {
      return contractEventScanMethods.fetchAllQuestionIDs(this, providerName, fromBlock, toBlock, groupKeyOrCfg);
    },

    // === CHANGED: +groupKeyOrCfg (optional). Uses group provider/addr and clamps
    async getAllQuestionIDsChunkedWithCallback(
      providerName: ProviderName,
      fromBlock: BlockRangeInput = 0,
      toBlock: BlockRangeInput = 'latest',
      onChunkProgress: ProgressCallback = null,
      onPartialData: PartialDataCallback = null,
      groupKeyOrCfg: GroupKeyOrConfig,
      scanOptions: ScanOptions = null,
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

    async getSurveyResponsesByAddress(
      providerName: ProviderName,
      userAddress: AddressInput,
      fromBlock: BlockRangeInput = null,
      toBlock: BlockRangeInput = null,
      groupKeyOrCfg: GroupKeyOrConfig = null,
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

    async getSurveysCreatedByAddress(
      providerName: ProviderName,
      userAddress: AddressInput,
      fromBlock: BlockRangeInput = null,
      toBlock: BlockRangeInput = null,
      groupKeyOrCfg: GroupKeyOrConfig = null,
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

    async getQuestionResponsesChunkedWithCallback(
      providerName: ProviderName,
      fromCustomBlock: BlockRangeInput = 0,
      toCustomBlock: BlockRangeInput = 'latest',
      onChunkProgress: ProgressCallback = null,
      onPartialData: PartialDataCallback = null,
      groupKeyOrCfg: GroupKeyOrConfig,
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
        const parsedEvents: ParsedEventWithPosition[] = rawLogs.map((log: ContractLogLike) => ({
          event: SURVEYS_INTERFACE.parseLog(log),
          blockNumber: Number(log?.blockNumber || 0),
          transactionIndex: Number(log?.transactionIndex || 0),
          logIndex: Number(log?.logIndex || 0),
        }));

        // Deduplicate by (questionId,responder), keeping only the latest event for each pair.
        const latestByPair = new Map<string, LatestQuestionPair>();
        parsedEvents.forEach(({ event, blockNumber, transactionIndex, logIndex }) => {
          const responder = String(event?.args?.responder || '').toLowerCase();
          const questionIds = Array.isArray(event?.args?.questionIds)
            ? event.args.questionIds.map((id) => String(id || '').toLowerCase())
            : [];
          questionIds.forEach((qId) => {
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
        const fullRangeAggregator: Record<string, unknown[]> = {};
        await Promise.all(
          uniquePairs.map(async ({ responder, qId, blockNumber, transactionIndex, logIndex }) => {
            let blockTimestamp = 0;
            try {
              const blockData = await this.getBlockWithCaching(provider, blockNumber, providerName, String(chId));
              blockTimestamp = blockData ? blockData.timestamp || 0 : 0;
            } catch {
              blockTimestamp = Math.floor(Date.now() / 1000);
            }

            let respData = null;
            try {
              respData = await this.getResponse(providerName, responder, qId, groupKeyOrCfg, {
                _resolvedCfg: cfg,
                forceArweaveFetch,
              });
            } catch (e: unknown) {
              contractsLog.warn('[getQuestionResponsesFullRange] individual response read failed; skipping', {
                responder,
                qId,
                error: e instanceof Error ? e.message : String(e),
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
      } catch (err: unknown) {
        contractsLog.error('Critical Error in getQuestionResponsesChunkedWithCallback:', err);
        if (onPartialData && resolvedFromBlockNum !== undefined) {
          onPartialData({}, resolvedFromBlockNum - 1);
        }
      }
    },

    async getQuestionsCreatedByAddress(
      providerName: ProviderName,
      userAddress: AddressInput,
      fromBlock: BlockRangeInput = null,
      toBlock: BlockRangeInput = null,
      groupKeyOrCfg: GroupKeyOrConfig = null,
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
      providerName: ProviderName,
      userAddress: AddressInput,
      fromBlock: BlockRangeInput = null,
      toBlock: BlockRangeInput = null,
      groupKeyOrCfg: GroupKeyOrConfig = null,
      opts: Record<string, unknown> = {},
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
      providerName: ProviderName,
      fromBlock: BlockRangeInput = null,
      toBlock: BlockRangeInput = null,
      groupKeyOrCfg: GroupKeyOrConfig,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const blocklist = new Set((cfg?.BLOCKED_SURVEY_IDS || []).map((id: string) => id.toLowerCase()));

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
      const events: ParsedSurveyEvent[] = rawLogs.map((log: ContractLogLike) => SURVEYS_INTERFACE.parseLog(log));

      // Refactored to return object with creationBlock
      const surveyMap = new Map<string, number>();
      events.forEach((event: ParsedSurveyEvent) => {
        const id = event.args.surveyId.toLowerCase();
        if (id && id !== ethers.constants.HashZero.toLowerCase() && !blocklist.has(id)) {
          // Keep the earliest block number if duplicates exist (though unlikely for creation)
          const previousCreationBlock = surveyMap.get(id);
          if (previousCreationBlock === undefined || event.blockNumber < previousCreationBlock) {
            surveyMap.set(id, event.blockNumber);
          }
        }
      });

      // Return array of objects: { surveyId, creationBlock }
      return Array.from(surveyMap.entries()).map(([sid, bn]) => ({ surveyId: sid, creationBlock: bn }));
    },

    async fetchAllSurveyResponses(
      providerName: ProviderName,
      surveyId: Bytes32Input,
      fromBlockParam: BlockRangeInput = null,
      toBlockParam: BlockRangeInput = null,
      groupKeyOrCfg: GroupKeyOrConfig,
    ) {
      const cfg = resolveSession(groupKeyOrCfg || '');
      const gAddrs = getSessionAddresses(cfg);
      const addr = gAddrs.surveys?.address;
      const chId = gAddrs.surveys?.chainId || cfg?.networkChainId || undefined;

      const provider = getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);

      const SurveyContract = new ethers.Contract(addr, SURVEYS, provider as any);

      // 🔐 Normalize
      const ensureHash = (v: Bytes32Input) => {
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
      const parsedEvents: ParsedEventWithPosition[] = rawLogs.map((log: ContractLogLike) => ({
        event: SURVEYS_INTERFACE.parseLog(log),
        blockNumber: Number(log?.blockNumber || 0),
        transactionIndex: Number(log?.transactionIndex || 0),
        logIndex: Number(log?.logIndex || 0),
      }));

      // Deduplicate by responder; keep only the newest event to avoid repeated response fetches.
      const latestByResponder = new Map<string, LatestResponder>();
      parsedEvents.forEach(({ event, blockNumber, transactionIndex, logIndex }) => {
        const responder = String(event?.args?.responder || '').toLowerCase();
        if (!responder) return;
        const prev = latestByResponder.get(responder);
        const isNewer =
          !prev ||
          blockNumber > Number(prev.blockNumber || 0) ||
          (blockNumber === Number(prev.blockNumber || 0) && logIndex > Number(prev.logIndex || 0));
        if (isNewer) {
          latestByResponder.set(responder, { responder, blockNumber, transactionIndex, logIndex });
        }
      });

      const responderEntries = Array.from(latestByResponder.values());
      const responseReadResults = await Promise.all(
        responderEntries.map(async ({ responder, blockNumber, transactionIndex, logIndex }) => {
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
          } catch (error: unknown) {
            const retryable = isRetryableSurveyResponseReadError(error);
            contractsLog.warn('[fetchAllSurveyResponses] individual response read failed; skipping', {
              error: error instanceof Error ? error.message : String(error),
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
              transactionIndex,
              logIndex,
            },
          };
        }),
      );

      let hadPartialFailure = false;
      let lowestFailedBlock: number | null = null;
      const responses = responseReadResults.reduce<unknown[]>((acc, result) => {
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
