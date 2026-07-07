import contractScripts, { normalizeSessionSlug } from '../web3/chainGateway.js';
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
import { getTemporaryDemoSessionQuestionFixtures } from '../session/demoSessionQuestionFixtures.js';
import { getGlobalLitHooks } from '../crypto/litProtocol.js';
import {
  buildQuestionDecryptContextForSession,
  hasMaskedQuestionPayloadImproved,
  type QuestionDecryptContext,
} from '../session/sessionQuestionDecryption.js';
import {
  buildQuestionReadyStatePatch,
  shouldClearQuestionProgressInFinalize,
  shouldCommitThrottledProgress,
  shouldFlushCoalescedRun,
} from '../session/mainSiteProgressHelpers.js';
import { MASKED_Q_DECRYPT_BACKOFF_MAX, MASKED_Q_DECRYPT_BACKOFF_TTL_MS } from '../cache/sessionCacheConstants.js';
import { isMaskedQuestionPayload, pickBetterQuestionPayload } from './questionRouting.js';
import { compareResponseRecency, toResponseRecencyPair, type ResponseRecencyPair } from './responseRecency';

type CacheRecord = Record<string, unknown>;
type StateRecord = {
  litHooks?: unknown;
  questionResponsesNonce?: number;
  questionCacheInitializationError?: boolean;
  isQuestionCacheReady?: boolean;
  questionScanProgress?: CacheRecord | null;
  [key: string]: unknown;
};
type SetStateArg = StateRecord | ((prev: StateRecord) => StateRecord | null) | null;
type DiscoveryRange = [number, number];

interface QuestionInitOptions extends CacheRecord {
  background?: boolean;
  skipDiscoveryScan?: boolean;
  forceDiscoveryRescan?: boolean;
}

interface RefreshEncryptedQuestionPayloadsOptions extends CacheRecord {
  force?: boolean;
  continuation?: boolean;
  delayMs?: number;
}

interface QueueLocalRevisionUpdateOptions extends CacheRecord {
  needsQuestionResponsesNonce?: boolean;
  checkAllCachesReady?: boolean;
}

interface NetworkLike extends CacheRecord {
  id?: string | number | null;
  chainId?: string | number | null;
}

interface MetadataSessionCacheEnvelope extends CacheRecord {
  metadata: CacheRecord;
  targetSlug: string;
}

interface QuestionMetadata extends CacheRecord {
  __ceQuestionMetadataPending?: unknown;
  id?: string;
  creator?: string;
  encryption?: unknown;
  prompt?: unknown;
  sessionSlugExplicit?: unknown;
  sessionName?: unknown;
  tags?: unknown;
  type?: unknown;
}

interface PendingQuestionMetadataEntry extends CacheRecord {
  attempts?: number;
  nextRetryAtMs?: number;
  state?: string;
  lastStatus?: number | null;
  message?: string;
}

type QuestionResponsesByResponder = Record<string, unknown>;
type QuestionResponsesMetaByResponder = Record<string, ResponseRecencyPair>;

interface QuestionCacheNetworkNode extends CacheRecord {
  questionsLatestBlock: number;
  questionsDiscoveryCheckpointBlock?: number;
  questions: Record<string, QuestionMetadata>;
  questionResponses: Record<string, QuestionResponsesByResponder>;
  questionResponsesMeta: Record<string, QuestionResponsesMetaByResponder>;
  pendingQuestionMetadata: Record<string, PendingQuestionMetadataEntry>;
  questionResponsesLatestBlock: number;
  arweaveTxCache: CacheRecord;
  arweaveTxFailureCache: CacheRecord;
  questionHydrationMeta: CacheRecord;
}

type QuestionCache = Record<string, QuestionCacheNetworkNode>;
type QuestionsCacheAtomicUpdater = (current: QuestionCache | null) => QuestionCache | Promise<QuestionCache>;

interface CreatedQuestionEntry extends CacheRecord {
  id: string;
  data: QuestionMetadata;
}

interface UserDataRecord extends CacheRecord {
  sbts: unknown[];
  createdSurveys: unknown[];
  createdQuestions: CreatedQuestionEntry[];
  surveyResponses: unknown[];
  questionResponses: unknown[];
}

interface UserNetworkCache extends CacheRecord {
  lastBlockScanned: number;
  lastScanTimestamp: number;
  data: UserDataRecord;
}

type UserCache = Record<string, Record<string, UserNetworkCache>>;
type UserCacheAtomicUpdater = (current: UserCache | null) => UserCache | Promise<UserCache>;

interface PendingQuestionRetryRow {
  qid: string;
  entry: PendingQuestionMetadataEntry | undefined;
}

interface PendingQuestionRetryResult {
  qid: string;
  questionData: QuestionMetadata | null;
  skippedCached?: boolean;
  err?: unknown;
}

interface QuestionHydrationResult {
  qId: string;
  questionData: QuestionMetadata | null;
  err?: unknown;
}

interface ChunkProgressInfo extends CacheRecord {
  totalRangeBlocks?: unknown;
  doneSoFarBlocks?: unknown;
  chunkFrom?: unknown;
  chunkTo?: unknown;
  chunkEventCount?: unknown;
}

interface MaskedQuestionDecryptBackoffEntry extends CacheRecord {
  ts?: number;
}

interface RefreshQuestionPayloadResult {
  qid: string;
  next: QuestionMetadata | null;
  improved: boolean;
}

type ResolvedSessionWindowLike = {
  fromBlock?: unknown;
  toBlock?: unknown;
};

interface QuestionCacheContractScripts {
  getRelevantBlockWindowForFilter: (sessionRef: unknown) => Promise<ResolvedSessionWindowLike>;
  getQuestionData: (
    providerName: string,
    questionId: string,
    slug: string,
    opts?: CacheRecord,
  ) => Promise<QuestionMetadata | null>;
  getAllQuestionIDsChunkedWithCallback: (
    providerName: string,
    fromBlock: number,
    toBlock: number,
    handleProgress: (progressInfo: ChunkProgressInfo) => void,
    handlePartialData: (partialQIDs: unknown, chunkToBlock: unknown) => void,
    slug: string,
    opts?: CacheRecord,
  ) => Promise<string[]>;
  decryptQuestionPayloadInPlace: (
    questionData: QuestionMetadata,
    slug: string,
    opts?: { decryptContext?: QuestionDecryptContext },
  ) => Promise<void>;
}

export interface SessionQuestionCacheHost extends WorkerMetadataHydrationHost {
  [key: string]: unknown;
  setState?: (updater: SetStateArg, cb?: () => void) => void;
  getState?: () => StateRecord;
  isMounted?: () => boolean;
  dgRead?: (name: string, slug: string, opts?: CacheRecord) => CacheRecord | null | undefined;
  updateQuestionsCacheAtomic: (slug: string, updater: QuestionsCacheAtomicUpdater) => Promise<boolean>;
  updateUserCacheAtomic: (slug: string, updater: UserCacheAtomicUpdater) => Promise<boolean>;
  getActiveSessionSlug?: () => string | null | undefined;
  getSessionChainId?: (slug: string) => string | number | null | undefined;
  getSessionScanScope?: () => string | null | undefined;
  getNetwork?: () => NetworkLike | null | undefined;
  network?: NetworkLike | null | undefined;
  scanScopeNoop?: (slug: string, op: string, onSkipped?: () => void) => boolean;
  setReadinessStateIfChanged?: (nextState: CacheRecord | null | undefined, cb?: () => void) => unknown;
  checkAllCachesReady?: () => void;
  mergeLegacyNumericNetworkKey?: (cache: CacheRecord, networkID: string) => boolean;
  buildMetadataSessionCacheEnvelope?: (
    questionData: CacheRecord,
    slug: string,
    opts?: CacheRecord,
  ) => MetadataSessionCacheEnvelope;
  writeQuestionMetadataToCache?: (
    slug: string,
    questionID: string,
    questionData: CacheRecord,
    networkID: string,
    opts?: CacheRecord,
  ) => boolean | void;
  queueLocalRevisionUpdate?: (opts?: QueueLocalRevisionUpdateOptions) => void;
}

export interface SessionQuestionCacheController {
  initializeQuestionCacheForGroup: (slug: string, opts?: QuestionInitOptions) => Promise<void>;
  refreshEncryptedQuestionPayloadsForGroup: (
    slug: string,
    opts?: RefreshEncryptedQuestionPayloadsOptions,
  ) => Promise<void>;
  hasMaskedQuestionPayloadInCache: (slug: string) => boolean;
  buildQuestionDecryptContext: (slug: string) => QuestionDecryptContext;
  refreshQuestionMetadataForGroup: (slug: string, opts?: QuestionInitOptions) => Promise<void>;
  pruneMaskedQuestionDecryptBackoff: (nowIn?: number) => void;
  isInitInFlight: (slugIn?: string) => boolean;
  destroy: () => void;
}

const mainSiteLog = createLogger('mainSite');
const questionCacheContractScripts = contractScripts as unknown as QuestionCacheContractScripts;

const isRecord = (value: unknown): value is CacheRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isPendingQuestionMetadataPlaceholder = (value: unknown): boolean =>
  isRecord(value) && value.__ceQuestionMetadataPending === true;

const hasHydratedQuestionMetadata = (value: unknown): boolean =>
  isRecord(value) && !isPendingQuestionMetadataPlaceholder(value);

const countHydratedQuestionMetadata = (questionMap: unknown): number => {
  if (!isRecord(questionMap)) return 0;
  return Object.values(questionMap).filter((value) => hasHydratedQuestionMetadata(value)).length;
};

const buildPendingQuestionMetadataPlaceholder = (
  qid: unknown,
  slug: unknown,
  existing: unknown = null,
): QuestionMetadata | null => {
  const id = String(qid || '')
    .trim()
    .toLowerCase();
  if (!id) return null;

  const existingQuestion = isRecord(existing) ? existing : {};
  const sessionName = String(existingQuestion.sessionName || slug || '').trim();
  const encryption = isRecord(existingQuestion.encryption)
    ? existingQuestion.encryption
    : {
        enabled: true,
        status: 'metadata-pending',
        targets: {
          questions: true,
        },
      };

  return {
    ...existingQuestion,
    id,
    type: String(existingQuestion.type || '').trim() || 'freeform',
    prompt: '[encrypted]',
    tags: Array.isArray(existingQuestion.tags) ? existingQuestion.tags : [],
    ...(sessionName ? { sessionName } : {}),
    encryption,
    __ceQuestionMetadataPending: true,
  };
};

const createEmptyQuestionNetworkCacheNode = (initialLastBlockQuestion: number): QuestionCacheNetworkNode => ({
  questionsLatestBlock: initialLastBlockQuestion,
  questionsDiscoveryCheckpointBlock: initialLastBlockQuestion,
  questions: {},
  questionResponses: {},
  questionResponsesMeta: {},
  pendingQuestionMetadata: {},
  questionResponsesLatestBlock: initialLastBlockQuestion,
  arweaveTxCache: {},
  arweaveTxFailureCache: {},
  questionHydrationMeta: {},
});

const createEmptyUserDataRecord = (): UserDataRecord => ({
  sbts: [],
  createdSurveys: [],
  createdQuestions: [],
  surveyResponses: [],
  questionResponses: [],
});

const isRpcDebugLoggingEnabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  const runtimeWindow = window as Window & { ENABLE_RPC_DEBUG_LOGGING?: boolean };
  return runtimeWindow.ENABLE_RPC_DEBUG_LOGGING === true;
};

const mergePendingQuestionInitOpts = (
  prevOpts: QuestionInitOptions | undefined,
  nextOpts: QuestionInitOptions | undefined,
): QuestionInitOptions => {
  const nextBackground = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.background === true);
  const nextSkipDiscoveryScan = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.skipDiscoveryScan === true);
  const nextForceDiscoveryRescan = !!(
    nextOpts &&
    typeof nextOpts === 'object' &&
    nextOpts.forceDiscoveryRescan === true
  );
  if (!prevOpts || typeof prevOpts !== 'object') {
    return {
      background: nextBackground,
      skipDiscoveryScan: nextSkipDiscoveryScan,
      forceDiscoveryRescan: nextForceDiscoveryRescan,
    };
  }
  const prevBackground = !!(prevOpts.background === true);
  const prevSkipDiscoveryScan = !!(prevOpts.skipDiscoveryScan === true);
  const prevForceDiscoveryRescan = !!(prevOpts.forceDiscoveryRescan === true);
  return {
    background: prevBackground && nextBackground,
    // If any queued caller needs a real discovery pass, do not keep skip mode.
    skipDiscoveryScan: prevSkipDiscoveryScan && nextSkipDiscoveryScan,
    // If any queued caller detected a gated empty cache, recover the discovery window.
    forceDiscoveryRescan: prevForceDiscoveryRescan || nextForceDiscoveryRescan,
  };
};

class QuestionCachePersistenceError extends Error {}

export const createSessionQuestionCacheController = (
  host: SessionQuestionCacheHost = {},
): SessionQuestionCacheController => {
  let _questionInitInFlight: Record<string, Promise<void> | undefined> = {};
  let _questionInitPending: Record<string, QuestionInitOptions | undefined> = {};
  let _destroyed: boolean = false;
  let _continuationTimers: ReturnType<typeof setTimeout>[] = [];
  let _pendingQuestionMetadataRetryTimers: Record<string, ReturnType<typeof setTimeout> | undefined> | null = {};
  let _maskedQuestionRefreshInFlight: Record<string, Promise<void> | undefined> = {};
  let _maskedQuestionRefreshPending: Record<string, RefreshEncryptedQuestionPayloadsOptions | undefined> = {};
  let _maskedQuestionRefreshLastStart: Record<string, number | undefined> | null = {};
  let _maskedQuestionRefreshCursor: Record<string, number | undefined> = {};
  let _maskedQuestionDecryptBackoff: Map<string, MaskedQuestionDecryptBackoffEntry> = new Map();
  const setState = (updater: SetStateArg, cb?: () => void): void => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };
  const getState = (): StateRecord => (typeof host.getState === 'function' ? host.getState() || {} : {});
  const isMounted = (): boolean => (typeof host.isMounted === 'function' ? host.isMounted() : false);
  const dgRead = (...args: [string, string, CacheRecord?]): CacheRecord | null =>
    typeof host.dgRead === 'function' ? host.dgRead(...args) || null : null;
  const dgWrite = (...args: [string, string, CacheRecord]): unknown =>
    typeof host.dgWrite === 'function' ? host.dgWrite(...args) : null;
  const getActiveSessionSlug = (): string =>
    String(typeof host.getActiveSessionSlug === 'function' ? host.getActiveSessionSlug() || '' : '');
  const getSessionCfg = (slug: string): CacheRecord | null =>
    typeof host.getSessionCfg === 'function' ? host.getSessionCfg(slug) || null : null;
  const getSessionChainId = (slug: string): string | number | null | undefined =>
    typeof host.getSessionChainId === 'function' ? host.getSessionChainId(slug) : null;
  const getSessionScanScope = (): string =>
    String(typeof host.getSessionScanScope === 'function' ? host.getSessionScanScope() || '' : '');
  const getAccount = (): string | null | undefined => (typeof host.getAccount === 'function' ? host.getAccount() : '');
  const getProviderLike = (): unknown => {
    if (typeof host.getProviderLike === 'function') return host.getProviderLike();
    if (typeof host.getProvider === 'function') return host.getProvider();
    return host.provider || '';
  };
  const getNetwork = (): NetworkLike | null | undefined => {
    if (typeof host.getNetwork === 'function') return host.getNetwork();
    return host.network || null;
  };
  const scanScopeNoop = (slug: string, op: string, onSkipped?: () => void): boolean =>
    typeof host.scanScopeNoop === 'function' ? host.scanScopeNoop(slug, op, onSkipped) : false;
  const setReadinessStateIfChanged = (...args: [CacheRecord | null | undefined, (() => void)?]): void => {
    if (typeof host.setReadinessStateIfChanged === 'function') {
      host.setReadinessStateIfChanged(...args);
    }
  };
  const checkAllCachesReady = (): void => {
    if (typeof host.checkAllCachesReady === 'function') {
      host.checkAllCachesReady();
    }
  };
  const mergeLegacyNumericNetworkKey = (cache: CacheRecord, networkID: string): boolean =>
    typeof host.mergeLegacyNumericNetworkKey === 'function'
      ? host.mergeLegacyNumericNetworkKey(cache, networkID)
      : false;
  const buildMetadataSessionCacheEnvelope = (
    ...args: [CacheRecord, string, CacheRecord?]
  ): MetadataSessionCacheEnvelope =>
    typeof host.buildMetadataSessionCacheEnvelope === 'function'
      ? host.buildMetadataSessionCacheEnvelope(...args)
      : { metadata: args?.[0] || {}, targetSlug: normalizeSessionSlug(args?.[1] || '') };
  const writeQuestionMetadataToCache = (
    ...args: [string, string, CacheRecord, string, CacheRecord?]
  ): boolean | void =>
    typeof host.writeQuestionMetadataToCache === 'function' ? host.writeQuestionMetadataToCache(...args) : false;
  const queueLocalRevisionUpdate = (opts: QueueLocalRevisionUpdateOptions = {}): void => {
    if (typeof host.queueLocalRevisionUpdate === 'function') {
      host.queueLocalRevisionUpdate(opts);
      return;
    }
    const shouldBumpQuestionResponsesNonce = !!opts?.needsQuestionResponsesNonce;
    const shouldCheckAllCachesReady = !!opts?.checkAllCachesReady;
    if (!shouldBumpQuestionResponsesNonce && !shouldCheckAllCachesReady) return;
    setState(
      (prev) => {
        const next: StateRecord = {};
        if (shouldBumpQuestionResponsesNonce) {
          next.questionResponsesNonce = Number(prev?.questionResponsesNonce || 0) + 1;
        }
        return Object.keys(next).length ? next : null;
      },
      () => {
        if (shouldCheckAllCachesReady) checkAllCachesReady();
      },
    );
  };
  const queueLocalRevisionUpdate = createSessionCacheRevisionUpdater<StateRecord, QueueLocalRevisionUpdateOptions>({
    host,
    setState,
    checkAllCachesReady,
  });

  const isInitInFlight = (slugIn = ''): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    return isWorkerMetadataHydrationInFlight(_questionInitInFlight, host, slug);
  };

  const destroy = (): void => {
    _destroyed = true;
    if (_pendingQuestionMetadataRetryTimers && typeof _pendingQuestionMetadataRetryTimers === 'object') {
      Object.values(_pendingQuestionMetadataRetryTimers).forEach((timer) => {
        try {
          clearTimeout(timer);
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: cleanup', e);
        }
      });
    }
    _continuationTimers.forEach((timer) => {
      try {
        clearTimeout(timer);
      } catch (e: unknown) {
        mainSiteLog.warn('MainSite: cleanup', e);
      }
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

  const hasMaskedQuestionPayloadInCache = (slug: string): boolean => {
    const networkID = String(getSessionChainId(slug) || '');
    if (!networkID) return false;
    const questionsCache = (dgRead('questionsCache', slug, { clone: false }) || {}) as QuestionCache;
    const questionMap = questionsCache?.[networkID]?.questions;
    if (!questionMap || typeof questionMap !== 'object') return false;
    return Object.values(questionMap).some((q: unknown) => isMaskedQuestionPayload(q));
  };

  const buildQuestionDecryptContext = (slug: string): QuestionDecryptContext => {
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

  const initializeQuestionCacheForGroup = async (slugIn: string, opts: QuestionInitOptions = {}): Promise<void> => {
    const slug = normalizeSessionSlug(slugIn || '');
    const suppressUiState = !!(opts && opts.background === true);
    const skipDiscoveryScan = !!(opts && opts.skipDiscoveryScan === true);
    const forceDiscoveryRescan = !skipDiscoveryScan && !!(opts && opts.forceDiscoveryRescan === true);
    const QUESTION_METADATA_BULK_ARWEAVE_RETRIES = 0;
    const QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS = 4500;
    const workerTarget = resolveWorkerMetadataHydrationTarget(host, slug);
    const initRunKey = workerTarget.runKey;
    const rerunOpts = {
      ...(opts && typeof opts === 'object' ? opts : {}),
      background: suppressUiState,
      skipDiscoveryScan,
      forceDiscoveryRescan,
    };
    const setQuestionState = (nextState: SetStateArg, cb?: () => void): void => {
      if (suppressUiState || !isMounted()) return;
      setState(nextState, cb);
    };
    const maybeCheckAllCachesReady = (): void => {
      if (suppressUiState) return;
      checkAllCachesReady();
    };
    if (
      scanScopeNoop(slug, 'initializeQuestionCacheForGroup', () => {
        setQuestionState({ isQuestionCacheReady: true }, checkAllCachesReady);
      })
    ) {
      return;
    }
    _questionInitInFlight = _questionInitInFlight || {};
    _questionInitPending = _questionInitPending || {};
    if (_questionInitInFlight[workerTarget.runKey]) {
      _questionInitPending[workerTarget.runKey] = mergePendingQuestionInitOpts(
        _questionInitPending[workerTarget.runKey],
        rerunOpts,
      );
      return _questionInitInFlight[workerTarget.runKey];
    }

    const run = (async () => {
      mainSiteLog.log('initializeQuestionCacheForGroup() - invoked with Infura chunked scanning', { slug });
      setQuestionState((prev) =>
        prev.questionCacheInitializationError ? { questionCacheInitializationError: false } : null,
      );

      if (workerTarget.isWorkerCanonical) {
        await hydrateSessionWorkerQuestionCache<QuestionCache>({
          host,
          target: workerTarget,
          sessionSlug: slug,
          createPersistenceError: () =>
            new QuestionCachePersistenceError(`Failed to persist Worker questions cache for ${slug}`),
          onSuccess: (count) => {
            setQuestionState({ isQuestionCacheReady: true, questionScanProgress: null });
            if (count > 0) queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
            maybeCheckAllCachesReady();
          },
        });
        return;
      }

      const networkID = String(getSessionChainId(slug) || '');
      const scopedSlug = normalizeSessionSlug(slug || '');
      const QUESTION_SCAN_MAX_BLOCK_RANGE = readSessionScanMaxBlockRange(DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE);
      const abortQuestionScan = ({ code = 'scan_aborted', message = 'Question scan aborted.' } = {}) => {
        const nowMs = Date.now();
        mainSiteLog.warn('[QuestionScan] Aborting question scan', {
          slug: scopedSlug || 'general',
          code,
          message,
        });
        setQuestionState(
          (prev) => ({
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
          }),
          checkAllCachesReady,
        );
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
      const blockLimitsForScan = isRecord(sessionCfgForScan?.blockLimits) ? sessionCfgForScan.blockLimits : null;
      const cfgStartBlock = Number(blockLimitsForScan?.start || 0);
      const initialLastBlockQuestionFromCfg =
        Number.isFinite(cfgStartBlock) && cfgStartBlock > 0 ? Math.max(0, Math.floor(cfgStartBlock) - 1) : 0;
      let questionsCache = (dgRead('questionsCache', slug) || {}) as QuestionCache;
      if (questionsCache && networkID) {
        mergeLegacyNumericNetworkKey(questionsCache, networkID);
      }
      const rebucketedQuestionIds = new Set<string>();
      const ensureLocalQuestionCacheNode = (initialLastBlockQuestion: number): QuestionCacheNetworkNode => {
        if (!questionsCache[networkID]) {
          questionsCache[networkID] = createEmptyQuestionNetworkCacheNode(initialLastBlockQuestion);
        }
        if (
          typeof questionsCache[networkID].pendingQuestionMetadata !== 'object' ||
          !questionsCache[networkID].pendingQuestionMetadata
        ) {
          questionsCache[networkID].pendingQuestionMetadata = {};
        }
        ensureQuestionArweaveCacheBranches(questionsCache[networkID]);
        if (!Number.isFinite(Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock))) {
          questionsCache[networkID].questionsDiscoveryCheckpointBlock =
            Number(questionsCache[networkID].questionsLatestBlock) || initialLastBlockQuestion;
        }
        return questionsCache[networkID];
      };
      const seedTemporaryDemoQuestionFixtures = (initialLastBlockQuestion: number): number => {
        const fixtureQuestions = getTemporaryDemoSessionQuestionFixtures(scopedSlug, sessionCfgForScan || {});
        if (!fixtureQuestions.length) return 0;

        const localNet = ensureLocalQuestionCacheNode(initialLastBlockQuestion);
        if (!localNet.questions || typeof localNet.questions !== 'object') {
          localNet.questions = {};
        }
        if (!localNet.pendingQuestionMetadata || typeof localNet.pendingQuestionMetadata !== 'object') {
          localNet.pendingQuestionMetadata = {};
        }

        let seeded = 0;
        fixtureQuestions.forEach((questionRaw) => {
          const lowered = String(questionRaw?.id || '')
            .trim()
            .toLowerCase();
          if (!lowered) return;
          if (hasHydratedQuestionMetadata(localNet.questions[lowered])) return;

          const questionData = {
            ...questionRaw,
            id: lowered,
          } as QuestionMetadata;
          const preparedQuestion = buildMetadataSessionCacheEnvelope(questionData, slug, {
            scoped: true,
          });
          const preparedQuestionData = {
            ...questionData,
            ...preparedQuestion.metadata,
            id: lowered,
          } as QuestionMetadata;
          const targetSlug = normalizeSessionSlug(preparedQuestion.targetSlug || slug);

          if (targetSlug === slug) {
            localNet.questions[lowered] = preparedQuestionData;
            try {
              delete localNet.pendingQuestionMetadata[lowered];
            } catch (e: unknown) {
              mainSiteLog.warn('MainSite: fallback', e);
            }
          } else {
            rebucketedQuestionIds.add(lowered);
            writeQuestionMetadataToCache(targetSlug, lowered, preparedQuestionData, networkID, {
              enforceScopedIsolation: true,
            });
          }
          seeded += 1;
        });

        if (seeded <= 0) return 0;
        dgWrite('questionsCache', slug, questionsCache);
        mainSiteLog.info('[MainSite] Seeded temporary demo question fixture metadata', {
          group: slug,
          count: seeded,
        });
        setQuestionState(
          (prev) => ({
            isQuestionCacheReady: true,
            questionResponsesNonce: Number(prev?.questionResponsesNonce || 0) + 1,
          }),
          maybeCheckAllCachesReady,
        );
        return seeded;
      };

      seedTemporaryDemoQuestionFixtures(initialLastBlockQuestionFromCfg);

      let resolvedWindow: unknown = null;
      try {
        resolvedWindow = await questionCacheContractScripts.getRelevantBlockWindowForFilter(
          getSessionBlockWindowRef(slug),
        );
      } catch (windowErr: unknown) {
        const windowError = isRecord(windowErr) ? windowErr : {};
        abortQuestionScan({
          code: 'block_window_unavailable',
          message:
            typeof windowError.message === 'string' ? windowError.message : 'Failed to resolve session block window.',
        });
        return;
      }
      const scanWindow = resolveValidatedSessionScanWindow({
        slug,
        blockLimits: sessionCfgForScan?.blockLimits || null,
        resolvedWindow: (isRecord(resolvedWindow) ? resolvedWindow : null) as ResolvedSessionWindowLike | null,
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
      const scanMaxBlockRange = Math.max(1, Number(scanWindow.maxBlockRange || QUESTION_SCAN_MAX_BLOCK_RANGE));
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
      ensureLocalQuestionCacheNode(initialLastBlockQuestion);
      if (forceDiscoveryRescan && countHydratedQuestionMetadata(questionsCache?.[networkID]?.questions) === 0) {
        questionsCache[networkID].questionsLatestBlock = initialLastBlockQuestion;
        questionsCache[networkID].questionsDiscoveryCheckpointBlock = initialLastBlockQuestion;
      }

      // Merge helper to avoid stomping concurrent responses writes
      const mergeFreshIntoLocalCopy = (localCache = questionsCache, freshCache?: QuestionCache | null) => {
        try {
          const fresh = (dgRead('questionsCache', slug) || {}) as QuestionCache;
          const freshNet = fresh[networkID];
          if (!freshNet) return;

          // Merge questionResponses + recency metadata (qId -> responder -> {bn/txi/li/ts})
          const localNet = localCache[networkID];
          ensureQuestionArweaveCacheBranches(localNet);
          if (!localNet.questionResponses || typeof localNet.questionResponses !== 'object') {
            localNet.questionResponses = {};
          }
          if (!localNet.questionResponsesMeta || typeof localNet.questionResponsesMeta !== 'object') {
            localNet.questionResponsesMeta = {};
          }
          const freshQR = freshNet && typeof freshNet.questionResponses === 'object' ? freshNet.questionResponses : {};
          const freshQRMeta =
            freshNet && typeof freshNet.questionResponsesMeta === 'object' ? freshNet.questionResponsesMeta : {};
          const shouldApplyIncomingResponse = ({
            existingMeta,
            incomingMeta,
            hasExistingResponse,
          }: {
            existingMeta: unknown;
            incomingMeta: ResponseRecencyPair;
            hasExistingResponse: boolean;
          }): boolean => {
            if (!hasExistingResponse) return true;
            const existing = toResponseRecencyPair(existingMeta);
            const incoming = toResponseRecencyPair(incomingMeta);
            return compareResponseRecency(incoming, existing) >= 0;
          };
          const freshQuestionIds = new Set([...Object.keys(freshQR || {}), ...Object.keys(freshQRMeta || {})]);
          freshQuestionIds.forEach((qIdRaw) => {
            const qId = String(qIdRaw || '')
              .trim()
              .toLowerCase();
            if (!qId) return;
            const freshResponsesByResponder =
              freshQR[qIdRaw] && typeof freshQR[qIdRaw] === 'object'
                ? freshQR[qIdRaw]
                : freshQR[qId] && typeof freshQR[qId] === 'object'
                  ? freshQR[qId]
                  : {};
            const freshMetaByResponder =
              freshQRMeta[qIdRaw] && typeof freshQRMeta[qIdRaw] === 'object'
                ? freshQRMeta[qIdRaw]
                : freshQRMeta[qId] && typeof freshQRMeta[qId] === 'object'
                  ? freshQRMeta[qId]
                  : {};
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
              const responder = String(responderRaw || '')
                .trim()
                .toLowerCase();
              if (!responder) return;

              const hasIncomingResponse =
                Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responderRaw) ||
                Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responder);
              const incomingResponse = hasIncomingResponse
                ? Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responderRaw)
                  ? freshResponsesByResponder[responderRaw]
                  : freshResponsesByResponder[responder]
                : undefined;
              const incomingMeta = freshMetaByResponder[responderRaw] ?? freshMetaByResponder[responder] ?? null;
              const hasExistingResponse = Object.prototype.hasOwnProperty.call(localResponsesByResponder, responder);
              if (
                !shouldApplyIncomingResponse({
                  existingMeta: localMetaByResponder[responder],
                  incomingMeta: toResponseRecencyPair(incomingMeta, incomingResponse),
                  hasExistingResponse,
                })
              ) {
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
            if (!qidLower) return;
            if (qidLower && rebucketedQuestionIds.has(qidLower)) return;
            const existingQuestion = localNet.questions[qidLower] || localNet.questions[qid];
            if (
              !hydratedQuestionIds.has(qidLower) ||
              !existingQuestion ||
              isPendingQuestionMetadataPlaceholder(existingQuestion)
            ) {
              localNet.questions[qidLower] = freshQs[qid];
            }
          });

          // Make sure questionsLatestBlock never goes backwards
          const localQBlk = Number(localNet.questionsLatestBlock) || 0;
          const freshQBlk = Number(freshNet.questionsLatestBlock) || 0;
          localNet.questionsLatestBlock = Math.max(localQBlk, freshQBlk);
          const localCheckpointBlk = Number(localNet.questionsDiscoveryCheckpointBlock) || 0;
          const freshCheckpointBlk = Number(freshNet.questionsDiscoveryCheckpointBlock) || 0;
          const mergedCheckpointBlk = Math.max(localCheckpointBlk, freshCheckpointBlk);
          const explicitlyClearedCompletedCheckpoint =
            Object.prototype.hasOwnProperty.call(localNet, 'questionsDiscoveryCheckpointBlock') &&
            localNet.questionsDiscoveryCheckpointBlock == null &&
            Number(localNet.questionsLatestBlock || 0) >= freshCheckpointBlk;
          if (explicitlyClearedCompletedCheckpoint) {
            localNet.questionsDiscoveryCheckpointBlock = undefined;
          } else if (mergedCheckpointBlk > 0) {
            localNet.questionsDiscoveryCheckpointBlock = mergedCheckpointBlk;
          } else if (Object.prototype.hasOwnProperty.call(localNet, 'questionsDiscoveryCheckpointBlock')) {
            localNet.questionsDiscoveryCheckpointBlock = undefined;
          }

          // Preserve immutable Arweave payload and failure caches across stale whole-object writes.
          mergeQuestionArweaveCacheBranches(localNet, freshNet);
          localNet.questionHydrationMeta = {
            ...(isRecord(localNet.questionHydrationMeta) ? localNet.questionHydrationMeta : {}),
            ...(isRecord(freshNet.questionHydrationMeta) ? freshNet.questionHydrationMeta : {}),
          };

          // Merge pending off-chain metadata retries (never resurrect entries for questions we already have)
          if (typeof localNet.pendingQuestionMetadata !== 'object' || !localNet.pendingQuestionMetadata) {
            localNet.pendingQuestionMetadata = {};
          }
          const localPending = localNet.pendingQuestionMetadata;
          const freshPending =
            freshNet && typeof freshNet.pendingQuestionMetadata === 'object' ? freshNet.pendingQuestionMetadata : {};
          Object.keys(freshPending || {}).forEach((qidRaw) => {
            const qid = String(qidRaw || '').toLowerCase();
            if (!qid) return;

            // Hydrated question metadata makes pending retry rows stale; placeholders still need retries.
            if (localNet.questions && hasHydratedQuestionMetadata(localNet.questions[qid])) {
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
            const aAttempts = Number(a.attempts || 0);
            const bAttempts = Number(b.attempts || 0);
            const aNextRetryAtMs = Number(a.nextRetryAtMs || 0);
            const bNextRetryAtMs = Number(b.nextRetryAtMs || 0);
            const preferred =
              aAttempts > bAttempts || (aAttempts === bAttempts && aNextRetryAtMs >= bNextRetryAtMs) ? a : b;
            const fallback = preferred === a ? b : a;
            localPending[qid] = {
              ...fallback,
              ...preferred,
              attempts: Math.max(aAttempts, bAttempts),
              nextRetryAtMs: Math.max(aNextRetryAtMs, bNextRetryAtMs),
              state: preferred.state || fallback.state || 'transient',
              lastStatus: preferred.lastStatus ?? fallback.lastStatus ?? null,
              message: preferred.message || fallback.message || '',
            };
          });

          // Cleanup: if the question exists, it should never remain in the pending set.
          try {
            const stale = Object.keys(localPending || {}).filter((qidRaw) => {
              const qid = String(qidRaw || '').toLowerCase();
              return qid && localNet.questions && hasHydratedQuestionMetadata(localNet.questions[qid]);
            });
            stale.forEach((qidRaw) => {
              try {
                delete localPending[qidRaw];
              } catch (e: unknown) {
                mainSiteLog.warn('MainSite: fallback', e);
              }
            });
          } catch (e: unknown) {
            mainSiteLog.warn('MainSite: fallback', e);
          }
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: fallback', e);
        }
      };

      const QUESTION_CACHE_WRITE_MIN_INTERVAL_MS = 1000;
      const QUESTION_CACHE_WRITE_MAX_PENDING_OPS = 4;
      let lastQuestionCacheWriteMs = 0;
      let pendingQuestionCacheWriteOps = 0;
      let hasPendingQuestionCacheWrite = false;
      let questionCachePersistenceTail = Promise.resolve();
      let questionCachePersistenceError: unknown = null;
      const cloneQuestionCache = (cache: QuestionCache): QuestionCache => {
        const clone = JSON.parse(JSON.stringify(cache)) as QuestionCache;
        const sourceNet = cache[networkID];
        if (
          sourceNet &&
          Object.prototype.hasOwnProperty.call(sourceNet, 'questionsDiscoveryCheckpointBlock') &&
          sourceNet.questionsDiscoveryCheckpointBlock == null &&
          clone[networkID]
        ) {
          clone[networkID].questionsDiscoveryCheckpointBlock = undefined;
        }
        return clone;
      };
      const enqueueQuestionCachePersistence = (): void => {
        const snapshot = cloneQuestionCache(questionsCache);
        questionCachePersistenceTail = questionCachePersistenceTail.then(async () => {
          if (questionCachePersistenceError) return;
          try {
            const persisted = await host.updateQuestionsCacheAtomic(slug, (current) => {
              const fresh = (current && typeof current === 'object' ? current : {}) as QuestionCache;
              mergeFreshIntoLocalCopy(snapshot, fresh);
              return {
                ...fresh,
                [networkID]: snapshot[networkID],
              };
            });
            if (!persisted) {
              throw new QuestionCachePersistenceError(`Failed to persist questions cache for ${slug}`);
            }
          } catch (error: unknown) {
            questionCachePersistenceError =
              error instanceof QuestionCachePersistenceError
                ? error
                : new QuestionCachePersistenceError(
                    `Failed to persist questions cache for ${slug}: ${
                      error instanceof Error ? error.message : String(error)
                    }`,
                  );
          }
        });
      };
      const awaitQuestionCachePersistence = async (): Promise<void> => {
        await questionCachePersistenceTail;
        if (questionCachePersistenceError) throw questionCachePersistenceError;
      };
      const flushQuestionCacheWrite = ({ force = false } = {}) => {
        const nowMs = Date.now();
        if (
          !shouldFlushCoalescedRun({
            force,
            dirty: hasPendingQuestionCacheWrite,
            nowMs,
            lastFlushMs: lastQuestionCacheWriteMs,
            minIntervalMs: QUESTION_CACHE_WRITE_MIN_INTERVAL_MS,
            pendingOps: pendingQuestionCacheWriteOps,
            maxPendingOps: QUESTION_CACHE_WRITE_MAX_PENDING_OPS,
          })
        ) {
          return false;
        }
        mergeFreshIntoLocalCopy();
        dgWrite('questionsCache', slug, questionsCache);
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
      const computeBackoffMs = (attempts: number): number => {
        const n = Math.max(0, Math.min(6, Number(attempts || 0) - 1));
        return Math.min(60000, Math.round(1000 * Math.pow(2, n)));
      };
      const markPendingQuestion = (
        qidLower: string,
        { bumpAttempts = true, error = null }: { bumpAttempts?: boolean; error?: unknown } = {},
      ): void => {
        if (!qidLower) return;
        if (
          typeof questionsCache[networkID].pendingQuestionMetadata !== 'object' ||
          !questionsCache[networkID].pendingQuestionMetadata
        ) {
          questionsCache[networkID].pendingQuestionMetadata = {};
        }
        const slot = questionsCache[networkID].pendingQuestionMetadata;
        const prev =
          slot[qidLower] && typeof slot[qidLower] === 'object' ? slot[qidLower] : { attempts: 0, nextRetryAtMs: 0 };
        const attempts = bumpAttempts ? Number(prev.attempts || 0) + 1 : Number(prev.attempts || 0);
        const stopDecision = shouldStopPendingMetadataRetry({
          pendingEntry: { ...prev, attempts },
          error,
          maxAttempts: MAX_PENDING_QUESTION_METADATA_ATTEMPTS,
        });
        const failureMeta = normalizeArweaveFailureMeta(error);
        const terminalRetryAtMs = Number(failureMeta.nextRetryAtMs || 0);
        if (stopDecision.stop) {
          if (stopDecision.terminal && Number.isFinite(terminalRetryAtMs) && terminalRetryAtMs > Date.now()) {
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
              nextRetryAtMs:
                Number.isFinite(externalNextRetryAt) && externalNextRetryAt > cooldownRetryAtMs
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
          try {
            delete slot[qidLower];
          } catch (e: unknown) {
            mainSiteLog.warn('MainSite: fallback', e);
          }
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
          nextRetryAtMs:
            Number.isFinite(externalNextRetryAt) && externalNextRetryAt > computedNextRetryAt
              ? externalNextRetryAt
              : computedNextRetryAt,
          state: failureMeta.state || 'transient',
          lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
          message: String(failureMeta.message || ''),
        };
      };
      const clearPendingQuestion = (qidLower: string): void => {
        try {
          if (questionsCache?.[networkID]?.pendingQuestionMetadata?.[qidLower]) {
            delete questionsCache[networkID].pendingQuestionMetadata[qidLower];
          }
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: fallback', e);
        }
      };
      const seedPendingDiscoveredQuestionMetadata = (questionIds: string[]): number => {
        if (!Array.isArray(questionIds) || questionIds.length === 0) return 0;
        if (
          typeof questionsCache[networkID].pendingQuestionMetadata !== 'object' ||
          !questionsCache[networkID].pendingQuestionMetadata
        ) {
          questionsCache[networkID].pendingQuestionMetadata = {};
        }
        const pending = questionsCache[networkID].pendingQuestionMetadata;
        let seeded = 0;
        questionIds.forEach((qidRaw) => {
          const qid = String(qidRaw || '')
            .trim()
            .toLowerCase();
          if (!qid) return;
          if (hasHydratedQuestionMetadata(questionsCache?.[networkID]?.questions?.[qid])) return;
          if (pending[qid]) return;
          pending[qid] = {
            attempts: 0,
            nextRetryAtMs: 0,
            state: 'discovered',
            lastStatus: null,
            message: 'Question metadata discovered; awaiting Arweave hydration.',
          };
          seeded += 1;
        });
        return seeded;
      };
      const pruneLoadedPendingQuestionMetadata = (): number => {
        try {
          const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
          if (!pending || typeof pending !== 'object') return 0;
          const cachedQuestions =
            questionsCache?.[networkID]?.questions && typeof questionsCache[networkID].questions === 'object'
              ? questionsCache[networkID].questions
              : {};
          let removed = 0;
          Object.keys(pending).forEach((qidRaw) => {
            const qid = String(qidRaw || '').toLowerCase();
            if (!qid || !hasHydratedQuestionMetadata(cachedQuestions[qid])) return;
            try {
              delete pending[qidRaw];
              removed += 1;
            } catch (e: unknown) {
              mainSiteLog.warn('MainSite: fallback', e);
            }
          });
          return removed;
        } catch (error: unknown) {
          if (error instanceof QuestionCachePersistenceError) throw error;
          return 0;
        }
      };
      const retryPendingQuestionMetadata = async ({
        maxToProcess = 15,
        batchSize = 5,
      }: { maxToProcess?: number; batchSize?: number } = {}): Promise<number> => {
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
            .map((qid): PendingQuestionRetryRow => ({ qid, entry: pending[qid] }))
            .filter(
              (row) =>
                row &&
                row.qid &&
                !hasHydratedQuestionMetadata(
                  questionsCache?.[networkID]?.questions?.[String(row.qid || '').toLowerCase()],
                ) &&
                Number(row.entry?.nextRetryAtMs || 0) <= now,
            )
            .sort((a, b) => Number(a.entry?.nextRetryAtMs || 0) - Number(b.entry?.nextRetryAtMs || 0))
            .slice(0, Math.max(0, Number(maxToProcess || 0)));
          if (!due.length) return 0;

          mainSiteLog.log(`[MainSite] Retrying ${due.length} pending question metadata fetch(es) (group=${slug}).`);

          for (let i = 0; i < due.length; i += batchSize) {
            const batch = due.slice(i, i + batchSize);
            // eslint-disable-next-line no-await-in-loop
            const results: PendingQuestionRetryResult[] = await Promise.all(
              batch.map(async ({ qid }) => {
                const lowered = String(qid || '').toLowerCase();
                if (!lowered) return { qid: lowered, questionData: null };
                if (hasHydratedQuestionMetadata(questionsCache?.[networkID]?.questions?.[lowered])) {
                  return {
                    qid: lowered,
                    questionData: questionsCache[networkID].questions[lowered],
                    skippedCached: true,
                  };
                }
                try {
                  const questionData = await questionCacheContractScripts.getQuestionData('none', lowered, slug, {
                    decryptContext: buildQuestionDecryptContext(slug),
                    skipDecrypt: true,
                    throwOnFailure: true,
                    arweaveRetries: QUESTION_METADATA_BULK_ARWEAVE_RETRIES,
                    arweaveGatewayTimeoutMs: QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS,
                  });
                  return { qid: lowered, questionData };
                } catch (err: unknown) {
                  return { qid: lowered, questionData: null, err };
                }
              }),
            );

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
                  hydratedQuestionIds.add(lowered);
                } else {
                  rebucketedQuestionIds.add(lowered);
                  try {
                    delete questionsCache[networkID].questions[lowered];
                  } catch (e: unknown) {
                    mainSiteLog.warn('MainSite: fallback', e);
                  }
                  writeQuestionMetadataToCache(preparedQuestion.targetSlug, lowered, preparedQuestionData, networkID, {
                    enforceScopedIsolation: true,
                  });
                }
                clearPendingQuestion(lowered);
                if (!item.skippedCached) recoveredCount += 1;
              } else {
                markPendingQuestion(lowered, { error: item.err });
              }
            }

            // Persist in coalesced chunks without wiping concurrent response writes.
            queueQuestionCacheWrite();

            await new Promise((resolve) => setTimeout(resolve, 100));
          }

          flushQuestionCacheWrite({ force: true });
          await awaitQuestionCachePersistence();
          return recoveredCount;
        } catch (error: unknown) {
          if (error instanceof QuestionCachePersistenceError) throw error;
          return 0;
        }
      };

      // If we discovered question IDs but couldn't fetch their off-chain metadata (often due to
      // RPC rate limits), keep the cache "not ready" and retry using the pending backoff queue.
      const schedulePendingQuestionMetadataRetry = (): void => {
        try {
          const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
          if (!pending || typeof pending !== 'object') return;

          const entries = Object.values(pending).filter(
            (v): v is PendingQuestionMetadataEntry => !!v && typeof v === 'object',
          );
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
            } catch (e: unknown) {
              mainSiteLog.warn('MainSite: fallback', e);
            }
          }, delayMs);
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: cleanup', e);
        }
      };

      const fromBlockForDiscovery = skipDiscoveryScan ? baseTo + 1 : resumeDiscoveryBlock + 1;
      const latestBlock =
        !skipDiscoveryScan && didCapScanRange
          ? Math.max(floorBlock, Math.min(scanRequestedToBlock, fromBlockForDiscovery + scanMaxBlockRange - 1))
          : baseTo;
      const shouldContinueCappedDiscoveryScan =
        !skipDiscoveryScan && didCapScanRange && scanRequestedToBlock > latestBlock;
      const queueCappedDiscoveryRerun = (): boolean => {
        if (!shouldContinueCappedDiscoveryScan) return false;
        _questionInitPending[initRunKey] = mergePendingQuestionInitOpts(_questionInitPending[initRunKey], {
          ...rerunOpts,
          background: suppressUiState,
          skipDiscoveryScan: false,
        });
        return true;
      };
      const totalScanBlocks =
        fromBlockForDiscovery <= latestBlock ? Math.max(0, latestBlock - fromBlockForDiscovery + 1) : 0;
      const requestedTotalScanBlocks = Math.max(
        totalScanBlocks,
        Number(scanWindow.requestedRangeBlocks || totalScanBlocks || 0),
      );
      const buildQuestionScanProgressCounts = (
        batchScannedIn: number = 0,
      ): {
        scannedBlocks: number;
        remainingBlocks: number;
      } => {
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
          Math.min(requestedTotalScanBlocks, completedBeforeCurrentWindow + batchScanned),
        );
        return {
          scannedBlocks,
          remainingBlocks: Math.max(0, requestedTotalScanBlocks - scannedBlocks),
        };
      };
      const QUESTION_PROGRESS_MIN_INTERVAL_MS = 250;
      let lastQuestionProgressCommitMs = 0;
      let pendingQuestionProgressPatch: CacheRecord | null = null;
      let pendingQuestionReadySignal = false;
      const clearQueuedQuestionProgress = (): void => {
        pendingQuestionProgressPatch = null;
        pendingQuestionReadySignal = false;
      };
      const flushQueuedQuestionProgress = ({ force = false }: { force?: boolean } = {}): boolean => {
        if (!pendingQuestionProgressPatch && !pendingQuestionReadySignal) return false;
        const nowMs = Date.now();
        if (
          !shouldCommitThrottledProgress({
            force,
            nowMs,
            lastCommitMs: lastQuestionProgressCommitMs,
            minIntervalMs: QUESTION_PROGRESS_MIN_INTERVAL_MS,
          })
        ) {
          return false;
        }
        const patch = pendingQuestionProgressPatch;
        const shouldMarkReady = pendingQuestionReadySignal;
        clearQueuedQuestionProgress();
        lastQuestionProgressCommitMs = nowMs;
        setQuestionState((prev) => {
          const next: StateRecord = {};
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
      const queueQuestionProgressPatch = (
        patch: CacheRecord | null,
        { force = false, markReady = false }: { force?: boolean; markReady?: boolean } = {},
      ): void => {
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
      let lastPersistedDiscoveryCheckpoint =
        Number(questionsCache?.[networkID]?.questionsDiscoveryCheckpointBlock) || 0;
      if (lastPersistedDiscoveryCheckpoint < stableDiscoveryBlock) {
        lastPersistedDiscoveryCheckpoint = stableDiscoveryBlock;
      }
      let contiguousDiscoveryFrontier = resumeDiscoveryBlock;
      const pendingDiscoveryRanges: DiscoveryRange[] = [];

      const normalizeDiscoveryRange = (fromIn: unknown, toIn: unknown): DiscoveryRange | null => {
        const fromNum = Number(fromIn);
        const toNum = Number(toIn);
        if (!Number.isFinite(fromNum) || !Number.isFinite(toNum)) return null;
        const from = Math.max(fromBlockForDiscovery, Math.floor(Math.min(fromNum, toNum)));
        const to = Math.min(latestBlock, Math.floor(Math.max(fromNum, toNum)));
        if (from > to) return null;
        return [from, to];
      };

      const enqueueCompletedDiscoveryRange = (fromIn: unknown, toIn: unknown): void => {
        const normalized = normalizeDiscoveryRange(fromIn, toIn);
        if (!normalized) return;
        pendingDiscoveryRanges.push(normalized);
        pendingDiscoveryRanges.sort((a, b) => a[0] - b[0]);
        const merged: DiscoveryRange[] = [];
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

      const advanceContiguousDiscoveryFrontier = (): number => {
        while (pendingDiscoveryRanges.length && pendingDiscoveryRanges[0][0] <= contiguousDiscoveryFrontier + 1) {
          const nextRange = pendingDiscoveryRanges.shift();
          if (!nextRange) break;
          const [, end] = nextRange;
          contiguousDiscoveryFrontier = Math.max(contiguousDiscoveryFrontier, end);
        }
        return contiguousDiscoveryFrontier;
      };

      const markDiscoveryRangeComplete = (fromIn: unknown, toIn: unknown): number => {
        enqueueCompletedDiscoveryRange(fromIn, toIn);
        return advanceContiguousDiscoveryFrontier();
      };

      const persistDiscoveryCheckpoint = (blockIn: unknown, { force = false }: { force?: boolean } = {}): boolean => {
        const blockNum = Number(blockIn);
        if (!Number.isFinite(blockNum)) return false;
        const nextCheckpoint = Math.max(floorBlock, Math.min(latestBlock, Math.floor(blockNum)));
        if (nextCheckpoint <= lastPersistedDiscoveryCheckpoint) return false;
        const now = Date.now();
        if (
          !force &&
          now - lastDiscoveryCheckpointWriteMs < DISCOVERY_CHECKPOINT_WRITE_MIN_INTERVAL_MS &&
          nextCheckpoint - lastPersistedDiscoveryCheckpoint < DISCOVERY_CHECKPOINT_WRITE_MIN_BLOCK_DELTA
        ) {
          return false;
        }

        questionsCache[networkID].questionsDiscoveryCheckpointBlock = Math.max(
          Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || floorBlock,
          nextCheckpoint,
        );
        queueQuestionCacheWrite({ force: true, opCount: 0 });

        lastPersistedDiscoveryCheckpoint =
          Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || nextCheckpoint;
        lastDiscoveryCheckpointWriteMs = now;
        return true;
      };

      const finalizeDiscoveryWatermark = (finalBlockIn: unknown): void => {
        const finalBlockNum = Number(finalBlockIn);
        const finalBlock = Number.isFinite(finalBlockNum)
          ? Math.max(floorBlock, Math.min(latestBlock, Math.floor(finalBlockNum)))
          : floorBlock;

        const checkpointBlock = Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || floorBlock;
        questionsCache[networkID].questionsLatestBlock = Math.max(
          Number(questionsCache[networkID].questionsLatestBlock) || floorBlock,
          checkpointBlock,
          finalBlock,
        );
        try {
          questionsCache[networkID].questionsDiscoveryCheckpointBlock = undefined;
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: fallback', e);
        }
        queueQuestionCacheWrite({ force: true, opCount: 0 });

        lastPersistedDiscoveryCheckpoint = Number(questionsCache[networkID].questionsLatestBlock) || finalBlock;
        lastDiscoveryCheckpointWriteMs = Date.now();
      };

      if (!suppressUiState && totalScanBlocks > 0) {
        const progressCounts = buildQuestionScanProgressCounts(0);
        queueQuestionProgressPatch(
          {
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
          },
          { force: true },
        );
      }
      if (fromBlockForDiscovery > latestBlock) {
        if (isRpcDebugLoggingEnabled()) {
          mainSiteLog.log(
            `[MainSite] Question cache up-to-date: fromBlock(${fromBlockForDiscovery}) > latestBlock(${latestBlock}). Skipping scan.`,
          );
        }
        // Even when logs are up-to-date, retry any pending off-chain metadata fetches.
        const recoveredPendingCount = await retryPendingQuestionMetadata();
        // Retry-only mode must not advance discovery watermark without a real log scan.
        if (!skipDiscoveryScan) finalizeDiscoveryWatermark(latestBlock);
        const cachedCount = countHydratedQuestionMetadata(questionsCache?.[networkID]?.questions);
        const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
        const ready = cachedCount > 0 || pendingCount === 0;
        flushQuestionCacheWrite({ force: true });
        await awaitQuestionCachePersistence();
        clearQueuedQuestionProgress();
        setQuestionState((prev) =>
          buildQuestionReadyStatePatch({
            prevState: prev,
            ready,
            incrementNonce: recoveredPendingCount > 0,
          }),
        );
        if (pendingCount > 0) schedulePendingQuestionMetadataRetry();
        return;
      }

      // Proactive user cache population
      let userCache = (dgRead('userCache', slug) || {}) as UserCache;
      let userCacheModified = false;
      const touchedUserNodes = new Set<string>();

      const ensureUserNode = (addr: string, block: number): UserDataRecord => {
        const lower = addr.toLowerCase();
        if (!userCache[lower]) userCache[lower] = {} as Record<string, UserNetworkCache>;
        if (!userCache[lower][networkID]) {
          userCache[lower][networkID] = {
            lastBlockScanned: block,
            lastScanTimestamp: Math.floor(Date.now() / 1000),
            data: createEmptyUserDataRecord(),
          };
          touchedUserNodes.add(lower);
        }
        if (block > userCache[lower][networkID].lastBlockScanned) {
          userCache[lower][networkID].lastBlockScanned = block;
          userCache[lower][networkID].lastScanTimestamp = Math.floor(Date.now() / 1000);
          touchedUserNodes.add(lower);
        }
        return userCache[lower][networkID].data;
      };

      /********************************************
       * 1. Fetch new question IDs via chunked scan (group-aware)
       ********************************************/
      mainSiteLog.log(
        `initializeQuestionCacheForGroup: scanning for new question IDs from block ${fromBlockForDiscovery} to ${latestBlock} (group=${slug})...`,
      );
      let allDiscoveredQIDs: string[] | null = null;
      try {
        allDiscoveredQIDs = await questionCacheContractScripts.getAllQuestionIDsChunkedWithCallback(
          'none', // ensure read-only provider path
          fromBlockForDiscovery,
          latestBlock,
          (progressInfo: ChunkProgressInfo) => {
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
            if (isRpcDebugLoggingEnabled()) {
              mainSiteLog.debug(
                `Question ID chunk: [${progressInfo.chunkFrom}..${progressInfo.chunkTo}] => ${progressInfo.chunkEventCount} events.`,
              );
            }
          },
          (_partialQIDs: unknown, _chunkToBlock: unknown) => {
            // onPartialData callback
            // optional: could save intermediate progress here if desired
          },
          slug,
          {
            rpcDebugContext: {
              fnTag: 'initialize-question-cache',
              scopeTag: 'question-discovery',
            },
          },
        );
      } catch (chunkErr: unknown) {
        mainSiteLog.error('Error fetching chunked question IDs:', chunkErr);
        persistDiscoveryCheckpoint(contiguousDiscoveryFrontier, { force: true });
        const cachedCount = countHydratedQuestionMetadata(questionsCache?.[networkID]?.questions);
        // If we have cached data, allow UI to proceed with it; otherwise keep the "ready" gate closed.
        flushQuestionCacheWrite({ force: true });
        await awaitQuestionCachePersistence();
        clearQueuedQuestionProgress();
        setQuestionState({ isQuestionCacheReady: cachedCount > 0, questionCacheInitializationError: true });
        return;
      }

      // We might get duplicates if question IDs were repeated in multiple events
      // so we’ll unify them here. Also ensure all are lowercased:
      let newQIDsSet = new Set<string>();
      (allDiscoveredQIDs || []).forEach((q: string) => {
        if (q) newQIDsSet.add(q.toLowerCase());
      });
      const newQIDsForDiscovery = Array.from(newQIDsSet);
      seedPendingDiscoveredQuestionMetadata(newQIDsForDiscovery);

      // Advance discovery watermark immediately once logs scan succeeds (even if Arweave metadata fetch fails).
      // Persisting pending metadata rows first prevents refreshes from treating discovered-but-unhydrated
      // questions as an empty ready cache while Arweave is still propagating.
      finalizeDiscoveryWatermark(latestBlock);

      const cachedQuestionRefreshIds = slug
        ? Object.values(questionsCache?.[networkID]?.questions || {})
            .map((question) => String(question?.id || '').toLowerCase())
            .filter(
              (qid) =>
                !!qid &&
                !Object.prototype.hasOwnProperty.call(
                  questionsCache?.[networkID]?.questions?.[qid] || {},
                  'sessionSlugExplicit',
                ),
            )
        : [];
      const hydrateTargetQIDs = Array.from(new Set([...newQIDsForDiscovery, ...cachedQuestionRefreshIds]));

      if (newQIDsForDiscovery.length > 0) {
        mainSiteLog.log(
          `initializeQuestionCacheForGroup: discovered ${newQIDsForDiscovery.length} unique question IDs total.`,
        );
      }
      queueQuestionProgressPatch(
        {
          slug,
          phase: 'hydrate',
          discoveredQuestions: hydrateTargetQIDs.length,
          hydratedQuestions: 0,
          failedQuestions: 0,
          pendingMetadataCount: Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length,
          requestedTotalBlocks: requestedTotalScanBlocks,
          wasCapped: didCapScanRange,
          ...buildQuestionScanProgressCounts(totalScanBlocks),
        },
        { force: true },
      );

      /**********************************************************************
       * 2) Filter out those we already have in the cache. We only load new ones
       **********************************************************************/
      const existingQIDs = new Set(Object.keys(questionsCache[networkID].questions).map((id) => id.toLowerCase()));
      let finalNewQIDs = newQIDsForDiscovery.filter((id) => !existingQIDs.has(String(id || '').toLowerCase()));
      finalNewQIDs = Array.from(new Set([...finalNewQIDs, ...cachedQuestionRefreshIds]));
      const totalCachedQuestionsBeforeHydration = countHydratedQuestionMetadata(questionsCache?.[networkID]?.questions);
      const pendingQuestionMetadataCountBeforeHydration = Object.keys(
        questionsCache?.[networkID]?.pendingQuestionMetadata || {},
      ).length;
      // Regression guard: only raise this terminal error after the final capped window.
      // Interim empty windows must fall through so queued reruns keep scanning later blocks.
      const shouldRaiseRangeLimitError =
        didCapScanRange &&
        scanRequestedToBlock === latestBlock &&
        totalCachedQuestionsBeforeHydration === 0 &&
        finalNewQIDs.length === 0 &&
        pendingQuestionMetadataCountBeforeHydration === 0;
      if (shouldRaiseRangeLimitError) {
        await awaitQuestionCachePersistence();
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
        const recoveredPendingCount = await retryPendingQuestionMetadata();
        queueCappedDiscoveryRerun();
        questionsCache[networkID].questionsLatestBlock = latestBlock;
        queueQuestionCacheWrite({ force: true });
        mainSiteLog.log('No new question IDs to fetch. question cache up-to-date.');
        const cachedCount = countHydratedQuestionMetadata(questionsCache?.[networkID]?.questions);
        const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
        const ready = cachedCount > 0 || pendingCount === 0;
        clearQueuedQuestionProgress();
        setQuestionState((prev) =>
          buildQuestionReadyStatePatch({
            prevState: prev,
            ready,
            incrementNonce: recoveredPendingCount > 0,
          }),
        );
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
      const getPendingMetadataCount = (): number =>
        Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
      const updateHydrationProgress = ({
        hydratedCount = 0,
        failedCount = 0,
        force = false,
      }: { hydratedCount?: number; failedCount?: number; force?: boolean } = {}): void => {
        const hasAnyQuestions = countHydratedQuestionMetadata(questionsCache?.[networkID]?.questions) > 0;
        queueQuestionProgressPatch(
          {
            slug,
            phase: 'hydrate',
            discoveredQuestions: finalNewQIDs.length,
            hydratedQuestions: Math.min(finalNewQIDs.length, Math.max(0, Number(hydratedCount || 0))),
            failedQuestions: Math.max(0, Number(failedCount || 0)),
            pendingMetadataCount: getPendingMetadataCount(),
            requestedTotalBlocks: requestedTotalScanBlocks,
            wasCapped: didCapScanRange,
            ...buildQuestionScanProgressCounts(totalScanBlocks),
          },
          { force, markReady: hasAnyQuestions },
        );
        if (hasAnyQuestions && !hasHydrationDataNonceSignal) {
          hasHydrationDataNonceSignal = true;
          setQuestionState((prev) => ({
            isQuestionCacheReady: true,
            questionResponsesNonce: Number(prev.questionResponsesNonce || 0) + 1,
          }));
        }
      };
      let failedFetchCount = 0;
      const processHydrationResult = (item: QuestionHydrationResult): void => {
        const lowered = String(item.qId || '').toLowerCase();
        if (item.questionData) {
          // Force ID to lowerCase. Also do item.questionData.id = qId
          item.questionData.id = lowered;
          const preparedQuestion = buildMetadataSessionCacheEnvelope(item.questionData, slug, {
            scoped: true,
          });
          const preparedQuestionData: QuestionMetadata = {
            ...item.questionData,
            ...preparedQuestion.metadata,
          };
          const targetSlug = preparedQuestion.targetSlug;
          if (targetSlug === slug) {
            // Insert into our local structure
            questionsCache[networkID].questions[lowered] = preparedQuestionData;
          } else {
            rebucketedQuestionIds.add(lowered);
            try {
              delete questionsCache[networkID].questions[lowered];
            } catch (e: unknown) {
              mainSiteLog.warn('MainSite: fallback', e);
            }
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
            if (!uData.createdQuestions.some((q: CreatedQuestionEntry) => q.id === lowered)) {
              uData.createdQuestions.push({ id: lowered, data: preparedQuestionData });
              userCacheModified = true;
            }
          }
        } else {
          failedFetchCount++;
          markPendingQuestion(lowered, { error: item.err });
          const pendingMetadataEntry = questionsCache[networkID].pendingQuestionMetadata?.[lowered];
          const existingQuestion = questionsCache[networkID].questions[lowered] || null;
          if (pendingMetadataEntry && !hasHydratedQuestionMetadata(existingQuestion)) {
            const placeholder = buildPendingQuestionMetadataPlaceholder(lowered, slug, existingQuestion);
            if (placeholder) {
              questionsCache[networkID].questions[lowered] = placeholder;
            }
          }
        }

        const forcePublish =
          !!item.questionData && countHydratedQuestionMetadata(questionsCache?.[networkID]?.questions) === 1;
        // Save incremental progress as metadata arrives (merge to keep responses).
        queueQuestionCacheWrite({ force: forcePublish });
        updateHydrationProgress({
          hydratedCount: hydratedSuccessCount,
          failedCount: failedFetchCount,
          force: forcePublish,
        });
      };
      for (let i = 0; i < finalNewQIDs.length; i += BATCH_SIZE) {
        const batch = finalNewQIDs.slice(i, i + BATCH_SIZE);

        // Parallel fetch each question's data from Arweave (group-aware), publishing
        // each result as soon as it lands so the UI can render the first card.
        // eslint-disable-next-line no-loop-func
        await Promise.all(
          batch.map(async (qId: string) => {
            let result: QuestionHydrationResult;
            try {
              const questionData = await questionCacheContractScripts.getQuestionData('none', qId, slug, {
                decryptContext: buildQuestionDecryptContext(slug),
                // Decrypting every encrypted prompt/options/tags during bulk cache hydration is very expensive.
                // We decrypt lazily in small batches via refreshEncryptedQuestionPayloadsForGroup().
                skipDecrypt: true,
                throwOnFailure: true,
                arweaveRetries: QUESTION_METADATA_BULK_ARWEAVE_RETRIES,
                arweaveGatewayTimeoutMs: QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS,
              });
              result = { qId, questionData };
            } catch (err: unknown) {
              mainSiteLog.warn(`Error fetching question data for ID ${qId}:`, err);
              result = { qId, questionData: null, err };
            }
            processHydrationResult(result);
          }),
        );
        // small sleep to avoid rate-limits
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // 4) Mark the main "questionsLatestBlock" as fully updated (merge first)
      if (failedFetchCount > 0) {
        mainSiteLog.warn(
          `initializeQuestionCacheForGroup: ${failedFetchCount}/${finalNewQIDs.length} question metadata fetches failed. ` +
            `Queued pending metadata retries; discovery watermark stays advanced.`,
        );
      }
      questionsCache[networkID].questionsLatestBlock = Math.max(
        Number(questionsCache[networkID].questionsLatestBlock) || 0,
        latestBlock,
      );
      // Persist the final hydrated question batch before publishing the terminal
      // hydrate-progress snapshot. Embedded survey views reload off the cache when
      // they observe hydratedQuestions advance, so the cache must already reflect
      // that final count or cold loads can freeze on the first 10-question batch.
      queueQuestionCacheWrite({ force: true });
      await awaitQuestionCachePersistence();
      flushQueuedQuestionProgress({ force: true });

      // Write user cache
      if (userCacheModified) {
        dgWrite('userCache', slug, userCache);
      }

      const totalCachedQuestions = countHydratedQuestionMetadata(questionsCache[networkID].questions);
      mainSiteLog.log(
        `initializeQuestionCacheForGroup: completed. We now have ${
          totalCachedQuestions
        } total questions in local cache for network ${networkID}, up to block ${latestBlock}.`,
      );
      if (totalCachedQuestions === 0 && fromBlockForDiscovery <= latestBlock) {
        mainSiteLog.warn(
          `initializeQuestionCacheForGroup: cache is EMPTY after scanning valid block range ` +
            `[${fromBlockForDiscovery}..${latestBlock}] for group '${slug}'. ` +
            `This may indicate a contract/config issue or all fetches failed.`,
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
        questionResponsesNonce:
          hydratedSuccessCount > 0 && !hasHydrationDataNonceSignal
            ? Number(prev.questionResponsesNonce || 0) + 1
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
        setQuestionState((prev) =>
          shouldClearQuestionProgressInFinalize({
            hasPendingRerun,
            isQuestionCacheReady: !!prev?.isQuestionCacheReady,
            questionScanProgress: prev?.questionScanProgress || null,
          })
            ? { questionScanProgress: null }
            : null,
        );
      }
      if (hasPendingRerun) {
        const pendingOpts = _questionInitPending[initRunKey];
        delete _questionInitPending[initRunKey];
        const rerunTimer = setTimeout(() => {
          if (_destroyed) return;
          try {
            if (!isMounted()) return;
            initializeQuestionCacheForGroup(slug, pendingOpts || rerunOpts);
          } catch (e: unknown) {
            mainSiteLog.warn('MainSite: fallback', e);
          }
        }, 0);
        _continuationTimers.push(rerunTimer);
      }
    }
  };

  const pruneMaskedQuestionDecryptBackoff = (nowIn = Date.now()): void => {
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

  async function refreshEncryptedQuestionPayloadsForGroup(
    slug: string,
    opts: RefreshEncryptedQuestionPayloadsOptions = {},
  ): Promise<void> {
    const options = (opts && typeof opts === 'object' ? opts : {}) as RefreshEncryptedQuestionPayloadsOptions;
    const force = !!options.force;
    const continuation = !!options.continuation;
    const now = Date.now();

    // Coalesce refreshes; this can be triggered by multiple signals (login, lit readiness, SBT events).
    _maskedQuestionRefreshInFlight = _maskedQuestionRefreshInFlight || {};
    _maskedQuestionRefreshPending = _maskedQuestionRefreshPending || {};
    _maskedQuestionRefreshLastStart = _maskedQuestionRefreshLastStart || {};
    _maskedQuestionRefreshCursor = _maskedQuestionRefreshCursor || {};
    _maskedQuestionDecryptBackoff = _maskedQuestionDecryptBackoff || new Map();
    pruneMaskedQuestionDecryptBackoff(now);
    const maskedQuestionDecryptBackoff = _maskedQuestionDecryptBackoff;

    const inFlight = _maskedQuestionRefreshInFlight[slug];
    if (inFlight) {
      if (force) _maskedQuestionRefreshPending[slug] = { force: true };
      return await inFlight;
    }

    const MIN_GAP_MS = 4000;
    const lastStart = Number(_maskedQuestionRefreshLastStart[slug] || 0);
    if (!force && !continuation && lastStart && now - lastStart < MIN_GAP_MS) return;
    _maskedQuestionRefreshLastStart[slug] = now;

    const run = (async () => {
      const networkID = String(getSessionChainId(slug) || '');
      if (!networkID) return;

      const questionsCache = (dgRead('questionsCache', slug) || {}) as QuestionCache;
      const networkCache = (questionsCache?.[networkID] || null) as QuestionCacheNetworkNode | null;
      const questionMap = networkCache?.questions || null;
      if (!questionMap || typeof questionMap !== 'object') return;

      const encryptedQuestionIds = Object.keys(questionMap).filter((qid: string) =>
        isMaskedQuestionPayload(questionMap[qid]),
      );
      if (!encryptedQuestionIds.length) return;

      const decryptContext = buildQuestionDecryptContext(slug);
      const accountLower = String(decryptContext?.account || '')
        .trim()
        .toLowerCase();
      const hasProviderLike = !!String(decryptContext?.providerLike || '').trim();
      const litOpts = (isRecord(decryptContext?.litOpts) ? decryptContext.litOpts : {}) as CacheRecord & {
        getKey?: unknown;
      };
      const hasLitKey = typeof litOpts.getKey === 'function';
      if (!accountLower || (!hasProviderLike && !hasLitKey)) return;

      const backoffMs = force ? 0 : 30000;
      const backoffKey = (qid: string): string =>
        `${accountLower}|${slug}|${networkID}|${String(qid || '').toLowerCase()}`;

      // Time-slice: decrypt only a small number per invocation so we don't stall the app.
      const MAX_ATTEMPTS_PER_RUN = force ? 24 : 12;
      const BATCH_SIZE = 4;

      const total = encryptedQuestionIds.length;
      let cursor = Math.max(0, Number(_maskedQuestionRefreshCursor[slug] || 0));
      if (total > 0) cursor = cursor % total;

      const toProcess: string[] = [];
      let scanned = 0;
      while (toProcess.length < MAX_ATTEMPTS_PER_RUN && scanned < total) {
        const idx = total > 0 ? (cursor + scanned) % total : 0;
        const id = String(encryptedQuestionIds[idx] || '').toLowerCase();
        scanned += 1;

        const prev = questionMap[id] || {};
        if (!isMaskedQuestionPayload(prev)) continue;

        const key = backoffKey(id);
        const lastAttempt = maskedQuestionDecryptBackoff.get(key);
        if (!force && lastAttempt && now - Number(lastAttempt.ts || 0) < backoffMs) {
          continue;
        }
        toProcess.push(id);
      }

      // Advance cursor even if many entries were skipped (fairness across runs).
      if (total > 0) {
        _maskedQuestionRefreshCursor[slug] = (cursor + scanned) % total;
      }

      const refreshQuestionPayload = async (id: string): Promise<RefreshQuestionPayloadResult> => {
        const prev = questionMap[id] || {};
        if (!isMaskedQuestionPayload(prev)) return { qid: id, next: null, improved: false };

        const key = backoffKey(id);
        const next: QuestionMetadata = { ...(prev || {}), id };
        try {
          await questionCacheContractScripts.decryptQuestionPayloadInPlace(next, slug, { decryptContext });
        } catch (err: unknown) {
          mainSiteLog.warn(`Failed to decrypt cached question payload for ${id}:`, err);
          const attemptTs = Date.now();
          maskedQuestionDecryptBackoff.set(key, { ts: attemptTs });
          pruneMaskedQuestionDecryptBackoff(attemptTs);
          return { qid: id, next: null, improved: false };
        }

        const improved = hasMaskedQuestionPayloadImproved(prev, next);
        if (!improved) {
          const attemptTs = Date.now();
          maskedQuestionDecryptBackoff.set(key, { ts: attemptTs });
          pruneMaskedQuestionDecryptBackoff(attemptTs);
          return { qid: id, next: null, improved: false };
        }

        // Success: clear backoff so future partial decrypts can run immediately.
        maskedQuestionDecryptBackoff.delete(key);
        return { qid: id, next, improved: true };
      };

      let changed = 0;
      const improvedQuestions = new Map<string, QuestionMetadata>();
      for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        const refreshedBatch: RefreshQuestionPayloadResult[] = await Promise.all(batch.map(refreshQuestionPayload));

        for (const { qid, next, improved } of refreshedBatch) {
          if (!improved || !next) continue;
          const prev = questionMap[qid] || {};
          const picked = pickBetterQuestionPayload(prev, next);
          if (!picked) continue;
          questionMap[qid] = { ...prev, ...picked, id: qid };
          improvedQuestions.set(qid, questionMap[qid]);
          changed += 1;
        }
      }

      if (changed) {
        const persisted = await host.updateQuestionsCacheAtomic(slug, (current) => {
          const next = (current && typeof current === 'object' ? current : {}) as QuestionCache;
          mergeLegacyNumericNetworkKey(next, networkID);
          const targetNet = next[networkID] || createEmptyQuestionNetworkCacheNode(0);
          ensureQuestionArweaveCacheBranches(targetNet);
          improvedQuestions.forEach((incoming, qid) => {
            const existing = targetNet.questions[qid] || {};
            const picked = pickBetterQuestionPayload(existing, incoming);
            if (picked) targetNet.questions[qid] = { ...existing, ...picked, id: qid };
          });
          next[networkID] = targetNet;
          return next;
        });
        if (!persisted) {
          throw new QuestionCachePersistenceError(`Failed to persist questions cache for ${slug}`);
        }
        queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
      }

      // If we hit our budget before scanning the full set, schedule a continuation.
      if (scanned < total && toProcess.length >= MAX_ATTEMPTS_PER_RUN) {
        const pending: RefreshEncryptedQuestionPayloadsOptions = _maskedQuestionRefreshPending[slug] || {};
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
          try {
            refreshEncryptedQuestionPayloadsForGroup(slug, pending);
          } catch (e: unknown) {
            mainSiteLog.warn('MainSite: fallback', e);
          }
        }, delayMs);
        _continuationTimers.push(continuationTimer);
      }
    }
  }

  async function refreshQuestionMetadataForGroup(slug: string, opts: QuestionInitOptions = {}): Promise<void> {
    mainSiteLog.log('refreshQuestionMetadataForGroup() - invoked', { slug });
    if (!getSessionChainId(slug)) {
      mainSiteLog.warn('No group chainId for refreshQuestionMetadataForGroup');
      return;
    }
    // Re-running initializeQuestionCacheForGroup will handle fetching new QIDs and their metadata
    // from the last known block.
    setReadinessStateIfChanged({ isQuestionCacheReady: false }); // Temporarily mark as not ready
    await initializeQuestionCacheForGroup(slug, opts);
    checkAllCachesReady(); // Re-check global readiness
    mainSiteLog.log('refreshQuestionMetadataForGroup() - done');
  }

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
