/**
 * @module chainEventScans
 * @description Stateless survey chain event-scan helpers extracted from contractScripts.impl.
 */

import { ethers } from 'ethers';

type UnknownRecord = Record<string, unknown>;

type ContractsLogger = {
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

type SessionAddresses = {
  surveys?: {
    address?: string | null;
    chainId?: string | number | null;
  } | null;
};

type ProviderLike = Partial<ethers.providers.Provider> & UnknownRecord & {
  getLogs?: (filter: UnknownRecord) => Promise<UnknownRecord[]>;
  __CE_RPC_META?: UnknownRecord;
};

type LogLike = Partial<ethers.providers.Log> & UnknownRecord & {
  topics?: string[];
  data?: string;
};

type RpcDebugContext = UnknownRecord & {
  fnTag?: string;
  scopeTag?: string;
  method?: string;
  fromBlock?: number | string;
  toBlock?: number | string;
};

type FetchLogsProgressState = UnknownRecord & {
  maxConcurrency?: unknown;
  onProgress?: ((payload: UnknownRecord) => unknown) | null;
  totalBlocks?: unknown;
  scannedBlocks?: number;
  phase?: unknown;
  fromBlock?: unknown;
  toBlock?: unknown;
  onLogs?: ((payload: UnknownRecord) => Promise<unknown> | unknown) | null;
};

type SurveyReadContract = ethers.Contract & {
  address: string;
  filters: {
    QuestionsAdded: (...args: unknown[]) => ethers.EventFilter;
    ResponsesSubmitted: (...args: unknown[]) => ethers.EventFilter;
    SurveyAdded: (...args: unknown[]) => ethers.EventFilter;
  };
};

type BlockWindow = {
  fromBlock: number;
  toBlock: number;
};

type EventScanRuntime = {
  getRelevantBlockWindowForFilter: (
    groupKeyOrCfg: unknown,
    opts?: UnknownRecord
  ) => Promise<BlockWindow>;
};

type ProgressPayload = {
  phase: 'scan';
  fromBlock: number;
  toBlock: number;
  chunkFrom: number;
  chunkTo: number;
  doneSoFarBlocks: number;
  totalRangeBlocks: number;
  remainingBlocks: number;
  chunkEventCount: number;
  overallEventCount: number;
};

type FetchProgressPayload = {
  totalBlocks?: unknown;
  scannedBlocks?: unknown;
  remainingBlocks?: unknown;
  scanFrom?: unknown;
  scanTo?: unknown;
  lastScannedBlock?: unknown;
};

type ChunkProgressCallback = (payload: ProgressPayload) => void;
type PartialQuestionDataCallback = (questionIds: string[], scannedToBlock: number) => void;

type QuestionScanOptions = {
  rpcDebugContext?: unknown;
};

type QuestionResponseByAddressOptions = {
  withMeta?: boolean;
};

type QuestionResponseByAddressEntry = {
  questionId: string;
  blockNumber: number;
  transactionIndex: number;
  logIndex: number;
};

type ChainEventScanDeps = {
  ethers: typeof ethers;
  SURVEYS: ethers.ContractInterface;
  SURVEYS_INTERFACE: ethers.utils.Interface;
  resolveSession: (groupKeyOrCfg: unknown) => unknown;
  getSessionAddresses: (cfg: UnknownRecord | null | undefined) => SessionAddresses;
  getSurveysReadProviderForSession: (
    groupKeyOrCfg: unknown,
    cfg: unknown,
    chainId: unknown
  ) => ProviderLike;
  fetchLogsSmartWithProvider: (
    provider: ProviderLike,
    filter: UnknownRecord,
    fromBlock: number,
    toBlock: number,
    depth?: number,
    maxDepth?: number,
    progressState?: FetchLogsProgressState | null,
    rpcDebugContext?: RpcDebugContext | null
  ) => Promise<LogLike[]>;
  normalizeRpcDebugContext: (context: unknown) => RpcDebugContext | null;
  rpcLog: (...args: unknown[]) => void;
  contractsLog: ContractsLogger;
};

const isRecord = (value: unknown): value is UnknownRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const getCfgField = (cfg: unknown, key: string): unknown => (
  isRecord(cfg) ? cfg[key] : undefined
);

const toLowerIdentifier = (value: unknown): string => (
  String(value || '').toLowerCase()
);

const normalizeBlockWindow = async (
  runtime: EventScanRuntime,
  groupKeyOrCfg: unknown,
  cfg: unknown,
  fromBlock: unknown,
  toBlock: unknown
): Promise<BlockWindow> => {
  const { fromBlock: baseFrom, toBlock: baseTo } =
    await runtime.getRelevantBlockWindowForFilter(groupKeyOrCfg, { _resolvedCfg: cfg });

  const fromBlockNum = Number.isFinite(Number(fromBlock))
    ? Math.max(Number(fromBlock), baseFrom)
    : baseFrom;

  const toBlockNum = (toBlock === 'latest' || typeof toBlock !== 'number')
    ? baseTo
    : Math.min(Number(toBlock), baseTo);

  return { fromBlock: fromBlockNum, toBlock: toBlockNum };
};

const createSurveyReadContext = (
  deps: ChainEventScanDeps,
  groupKeyOrCfg: unknown
) => {
  const cfg = deps.resolveSession(groupKeyOrCfg || '');
  const cfgRecord = isRecord(cfg) ? cfg : null;
  const gAddrs = deps.getSessionAddresses(cfgRecord);
  const addr = gAddrs.surveys?.address;
  const chId = gAddrs.surveys?.chainId || getCfgField(cfg, 'networkChainId') || undefined;
  const provider = deps.getSurveysReadProviderForSession(groupKeyOrCfg, cfg, chId);
  const contract = new deps.ethers.Contract(
    String(addr || ''),
    deps.SURVEYS,
    provider as ethers.providers.Provider
  ) as SurveyReadContract;
  return {
    cfg,
    addr,
    provider,
    contract,
  };
};

const parseSurveyLogs = (
  deps: ChainEventScanDeps,
  logs: LogLike[]
) => logs.map((log) => deps.SURVEYS_INTERFACE.parseLog(log as ethers.providers.Log));

const collectQuestionIdsFromEvents = (
  deps: ChainEventScanDeps,
  events: ethers.utils.LogDescription[]
): string[] => {
  const questionIDSet = new Set<string>();
  events.forEach((event) => {
    const args = event.args as UnknownRecord;
    const questionIds = Array.isArray(args.questionIds) ? args.questionIds : [];
    questionIds.forEach((id) => {
      if (id && id !== deps.ethers.constants.HashZero) {
        questionIDSet.add(toLowerIdentifier(id));
      }
    });
  });
  return Array.from(questionIDSet);
};

export function createChainEventScanMethods(deps: ChainEventScanDeps) {
  return {
    async fetchAllQuestionIDs(
      runtime: EventScanRuntime,
      _providerName: unknown,
      fromBlock: unknown = null,
      toBlock: unknown = null,
      groupKeyOrCfg: unknown = null
    ): Promise<string[]> {
      const { cfg, provider, contract } = createSurveyReadContext(deps, groupKeyOrCfg);
      const questionsAddedEventFilter = contract.filters.QuestionsAdded(null, null, null);
      const blockWindow = await normalizeBlockWindow(runtime, groupKeyOrCfg, cfg, fromBlock, toBlock);

      if (blockWindow.fromBlock > blockWindow.toBlock) return [];

      deps.rpcLog('fetchAllQuestionIDs: Fetching logs with fetchLogsSmartWithProvider:', {
        address: contract.address,
        fromBlock: blockWindow.fromBlock,
        toBlock: blockWindow.toBlock,
      });

      const rawLogs = await deps.fetchLogsSmartWithProvider(
        provider,
        questionsAddedEventFilter,
        blockWindow.fromBlock,
        blockWindow.toBlock
      );
      return collectQuestionIdsFromEvents(deps, parseSurveyLogs(deps, rawLogs));
    },

    async getAllQuestionIDsChunkedWithCallback(
      runtime: EventScanRuntime,
      _providerName: unknown,
      fromBlock: unknown = 0,
      toBlock: unknown = 'latest',
      onChunkProgress: ChunkProgressCallback | null = null,
      onPartialData: PartialQuestionDataCallback | null = null,
      groupKeyOrCfg: unknown = null,
      scanOptions: QuestionScanOptions | null = null
    ): Promise<string[]> {
      const { cfg, addr, provider, contract } = createSurveyReadContext(deps, groupKeyOrCfg);
      if (!addr) {
        deps.contractsLog.warn('[getAllQuestionIDsChunkedWithCallback] Missing surveys address; skipping scan.', {
          group: String(getCfgField(cfg, 'slug') || ''),
        });
        if (onPartialData) onPartialData([], Number(fromBlock) || 0);
        return [];
      }

      const questionsAddedEventFilter = contract.filters.QuestionsAdded();
      const rpcDebugContext = deps.normalizeRpcDebugContext(scanOptions?.rpcDebugContext) || null;
      const blockWindow = await normalizeBlockWindow(runtime, groupKeyOrCfg, cfg, fromBlock, toBlock);

      if (blockWindow.fromBlock > blockWindow.toBlock) {
        if (onPartialData) onPartialData([], blockWindow.fromBlock);
        return [];
      }

      try {
        deps.rpcLog('getAllQuestionIDsChunkedWithCallback: Fetching logs:', {
          contractAddress: contract.address,
          fromBlock: blockWindow.fromBlock,
          toBlock: blockWindow.toBlock,
        });
        const totalRangeBlocks = Math.max(0, blockWindow.toBlock - blockWindow.fromBlock + 1);
        const progressState = onChunkProgress ? {
          phase: 'scan',
          fromBlock: blockWindow.fromBlock,
          toBlock: blockWindow.toBlock,
          totalBlocks: totalRangeBlocks,
          scannedBlocks: 0,
          onProgress: (payload: FetchProgressPayload) => {
            const totalBlocks = Math.max(0, Number(payload?.totalBlocks || totalRangeBlocks));
            const doneSoFarBlocks = Math.max(0, Math.min(totalBlocks, Number(payload?.scannedBlocks || 0)));
            const remainingBlocks = Math.max(0, Number(payload?.remainingBlocks ?? (totalBlocks - doneSoFarBlocks)));
            onChunkProgress({
              phase: 'scan',
              fromBlock: blockWindow.fromBlock,
              toBlock: blockWindow.toBlock,
              chunkFrom: Number(payload?.scanFrom ?? payload?.lastScannedBlock ?? blockWindow.fromBlock),
              chunkTo: Number(payload?.scanTo ?? payload?.lastScannedBlock ?? blockWindow.fromBlock),
              doneSoFarBlocks,
              totalRangeBlocks: totalBlocks,
              remainingBlocks,
              chunkEventCount: 0,
              overallEventCount: 0,
            });
          },
        } : null;

        const rawLogs = await deps.fetchLogsSmartWithProvider(
          provider,
          questionsAddedEventFilter,
          blockWindow.fromBlock,
          blockWindow.toBlock,
          0,
          20,
          progressState,
          rpcDebugContext
        );
        const allEvents = parseSurveyLogs(deps, rawLogs);
        const finalQIDs = collectQuestionIdsFromEvents(deps, allEvents);

        if (onChunkProgress) {
          onChunkProgress({
            phase: 'scan',
            fromBlock: blockWindow.fromBlock,
            toBlock: blockWindow.toBlock,
            chunkFrom: blockWindow.fromBlock,
            chunkTo: blockWindow.toBlock,
            doneSoFarBlocks: totalRangeBlocks,
            totalRangeBlocks,
            remainingBlocks: 0,
            chunkEventCount: allEvents.length,
            overallEventCount: finalQIDs.length,
          });
        }

        if (onPartialData) {
          onPartialData(finalQIDs, blockWindow.toBlock);
        }

        return finalQIDs;
      } catch (error: unknown) {
        deps.contractsLog.error('getAllQuestionIDsChunkedWithCallback failed:', error);
        throw error;
      }
    },

    async getSurveyResponsesByAddress(
      runtime: EventScanRuntime,
      _providerName: unknown,
      userAddress: unknown,
      fromBlock: unknown = null,
      toBlock: unknown = null,
      groupKeyOrCfg: unknown = null
    ): Promise<unknown[]> {
      const { cfg, provider, contract } = createSurveyReadContext(deps, groupKeyOrCfg);
      const responseSubmittedEventTopic = contract.filters.ResponsesSubmitted(userAddress, null, null);
      const blockWindow = await normalizeBlockWindow(runtime, groupKeyOrCfg, cfg, fromBlock, toBlock);

      if (blockWindow.fromBlock > blockWindow.toBlock) return [];

      deps.rpcLog('getSurveyResponsesByAddress: Fetching logs with fetchLogsSmartWithProvider:', {
        address: contract.address,
        fromBlock: blockWindow.fromBlock,
        toBlock: blockWindow.toBlock,
      });
      const rawLogs = await deps.fetchLogsSmartWithProvider(
        provider,
        responseSubmittedEventTopic,
        blockWindow.fromBlock,
        blockWindow.toBlock
      );
      return parseSurveyLogs(deps, rawLogs).map((event) => (event.args as UnknownRecord).surveyId);
    },

    async getSurveysCreatedByAddress(
      runtime: EventScanRuntime,
      _providerName: unknown,
      userAddress: unknown,
      fromBlock: unknown = null,
      toBlock: unknown = null,
      groupKeyOrCfg: unknown = null
    ): Promise<unknown[]> {
      const { cfg, provider, contract } = createSurveyReadContext(deps, groupKeyOrCfg);
      const surveyCreatedEventTopic = contract.filters.SurveyAdded(userAddress, null);
      const blockWindow = await normalizeBlockWindow(runtime, groupKeyOrCfg, cfg, fromBlock, toBlock);

      if (blockWindow.fromBlock > blockWindow.toBlock) return [];

      deps.rpcLog('getSurveysCreatedByAddress: Fetching logs with fetchLogsSmartWithProvider:', {
        address: contract.address,
        fromBlock: blockWindow.fromBlock,
        toBlock: blockWindow.toBlock,
      });
      const rawLogs = await deps.fetchLogsSmartWithProvider(
        provider,
        surveyCreatedEventTopic,
        blockWindow.fromBlock,
        blockWindow.toBlock
      );
      return parseSurveyLogs(deps, rawLogs).map((event) => (event.args as UnknownRecord).surveyId);
    },

    async getQuestionsCreatedByAddress(
      runtime: EventScanRuntime,
      _providerName: unknown,
      userAddress: unknown,
      fromBlock: unknown = null,
      toBlock: unknown = null,
      groupKeyOrCfg: unknown = null
    ): Promise<string[]> {
      const { cfg, provider, contract } = createSurveyReadContext(deps, groupKeyOrCfg);
      const questionsAddedEventFilter = contract.filters.QuestionsAdded(userAddress, null, null);
      const blockWindow = await normalizeBlockWindow(runtime, groupKeyOrCfg, cfg, fromBlock, toBlock);

      if (blockWindow.fromBlock > blockWindow.toBlock) return [];

      deps.rpcLog('getQuestionsCreatedByAddress: Fetching logs with fetchLogsSmartWithProvider:', {
        address: contract.address,
        fromBlock: blockWindow.fromBlock,
        toBlock: blockWindow.toBlock,
      });
      const rawLogs = await deps.fetchLogsSmartWithProvider(
        provider,
        questionsAddedEventFilter,
        blockWindow.fromBlock,
        blockWindow.toBlock
      );
      const questionIDs: string[] = [];
      parseSurveyLogs(deps, rawLogs).forEach((event) => {
        const args = event.args as UnknownRecord;
        const questionIds = Array.isArray(args.questionIds) ? args.questionIds : [];
        questionIds.forEach((id) => {
          if (id && id !== deps.ethers.constants.HashZero) {
            questionIDs.push(toLowerIdentifier(id));
          }
        });
      });
      return questionIDs;
    },

    async getQuestionResponsesByAddress(
      runtime: EventScanRuntime,
      _providerName: unknown,
      userAddress: unknown,
      fromBlock: unknown = null,
      toBlock: unknown = null,
      groupKeyOrCfg: unknown = null,
      opts: QuestionResponseByAddressOptions | null = {}
    ): Promise<Array<string | QuestionResponseByAddressEntry>> {
      const { cfg, provider, contract } = createSurveyReadContext(deps, groupKeyOrCfg);
      const responsesSubmittedEventFilter = contract.filters.ResponsesSubmitted(userAddress, null);
      const blockWindow = await normalizeBlockWindow(runtime, groupKeyOrCfg, cfg, fromBlock, toBlock);

      if (blockWindow.fromBlock > blockWindow.toBlock) return [];

      deps.rpcLog('getQuestionResponsesByAddress: Fetching logs with fetchLogsSmartWithProvider:', {
        address: contract.address,
        fromBlock: blockWindow.fromBlock,
        toBlock: blockWindow.toBlock,
      });
      const withMeta = !!(opts && opts.withMeta === true);
      const rawLogs = await deps.fetchLogsSmartWithProvider(
        provider,
        responsesSubmittedEventFilter,
        blockWindow.fromBlock,
        blockWindow.toBlock
      );
      const latestByQuestion = new Map<string, QuestionResponseByAddressEntry>();
      rawLogs.forEach((log) => {
        let event: ethers.utils.LogDescription | null;
        try {
          event = deps.SURVEYS_INTERFACE.parseLog(log as ethers.providers.Log);
        } catch {
          event = null;
        }
        if (!event) return;
        const args = event.args as UnknownRecord;
        const questionIds = Array.isArray(args.questionIds) ? args.questionIds : [];
        const blockNumber = Number(log?.blockNumber || 0);
        const transactionIndex = Number(log?.transactionIndex || 0);
        const logIndex = Number(log?.logIndex || 0);
        questionIds.forEach((id) => {
          if (!id || id === deps.ethers.constants.HashZero) return;
          const qid = toLowerIdentifier(id);
          if (!qid) return;
          const prev = latestByQuestion.get(qid);
          const isNewer =
            !prev ||
            blockNumber > Number(prev.blockNumber || 0) ||
            (
              blockNumber === Number(prev.blockNumber || 0) &&
              (
                transactionIndex > Number(prev.transactionIndex || 0) ||
                (
                  transactionIndex === Number(prev.transactionIndex || 0) &&
                  logIndex > Number(prev.logIndex || 0)
                )
              )
            );
          if (!isNewer) return;
          latestByQuestion.set(qid, {
            questionId: qid,
            blockNumber,
            transactionIndex,
            logIndex,
          });
        });
      });
      const entries = Array.from(latestByQuestion.values());
      return withMeta ? entries : entries.map((entry) => entry.questionId);
    },
  };
}
