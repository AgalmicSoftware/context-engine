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

type CacheRecord = Record<string, unknown>;
type StateRecord = {
  isQuestionCacheReady?: boolean;
  isResponsesCacheReady?: boolean;
  questionResponsesNonce?: number;
  [key: string]: unknown;
};
type SetStateArg = StateRecord | ((prev: StateRecord) => StateRecord | null) | null;
type UserDataListKey =
  | 'sbts'
  | 'createdSurveys'
  | 'createdQuestions'
  | 'surveyResponses'
  | 'questionResponses';

interface QueueLocalRevisionUpdateOptions {
  needsQuestionResponsesNonce?: boolean;
  checkAllCachesReady?: boolean;
}

interface ResponseInitOptions {
  background?: boolean;
  forceArweaveFetch?: boolean;
  notifyOnCompletion?: boolean;
}

export interface RefreshQuestionResponsesOptions {
  slug?: string;
  responder?: string;
  questionIDs?: string[];
  forceFull?: boolean;
}

interface ResponseRecencyPair extends CacheRecord {
  bn: number;
  txi: number;
  li: number;
  ts: number;
}

type QuestionResponseByResponder = Record<string, unknown>;
type QuestionResponseMetaByResponder = Record<string, ResponseRecencyPair | undefined>;

interface QuestionCacheNetworkNode extends CacheRecord {
  questionsLatestBlock: number;
  questionsDiscoveryCheckpointBlock: number;
  questions: CacheRecord;
  questionResponses: Record<string, QuestionResponseByResponder>;
  questionResponsesMeta: Record<string, QuestionResponseMetaByResponder>;
  questionResponsesLatestBlock: number;
  pendingQuestionMetadata: CacheRecord;
  arweaveTxCache: CacheRecord;
  arweaveTxFailureCache: CacheRecord;
  questionHydrationMeta: CacheRecord;
}

type QuestionCache = Record<string, QuestionCacheNetworkNode | unknown>;

interface UserCacheEntry extends CacheRecord {
  questionId?: unknown;
  id?: unknown;
  responder?: unknown;
  surveyID?: unknown;
  surveyId?: unknown;
  address?: unknown;
  sbtAddress?: unknown;
  tokenId?: unknown;
  response?: unknown;
  blockNumber?: unknown;
  bn?: unknown;
  transactionIndex?: unknown;
  txIndex?: unknown;
  txi?: unknown;
  logIndex?: unknown;
  li?: unknown;
  timestamp?: unknown;
  ts?: unknown;
}

interface UserDataRecord extends CacheRecord {
  sbts: UserCacheEntry[];
  createdSurveys: UserCacheEntry[];
  createdQuestions: UserCacheEntry[];
  surveyResponses: UserCacheEntry[];
  questionResponses: UserCacheEntry[];
}

interface UserNetworkCache extends CacheRecord {
  lastBlockScanned: number;
  lastScanTimestamp: number;
  data: UserDataRecord;
}

type UserCacheByNetwork = Record<string, UserNetworkCache | unknown>;
type UserCache = Record<string, UserCacheByNetwork | unknown>;

interface PartialResponseAggregateRow extends CacheRecord {
  responder?: string;
  response?: unknown;
  blockNumber?: unknown;
  transactionIndex?: unknown;
  txIndex?: unknown;
  txi?: unknown;
  logIndex?: unknown;
  li?: unknown;
  timestamp?: unknown;
  ts?: unknown;
}

type PartialResponseAggregate = Record<string, PartialResponseAggregateRow[]>;

interface ResponseHydrationContractScripts {
  getRelevantBlockWindowForFilter: (
    slug: string
  ) => Promise<{ fromBlock: number; toBlock: number }>;
  getQuestionResponsesChunkedWithCallback: (
    providerName: string,
    fromBlock: number,
    toBlock: number,
    handleProgress: unknown,
    handlePartialData: unknown,
    slug: string,
    opts?: CacheRecord
  ) => Promise<unknown>;
  getResponse: (
    providerName: string,
    responder: string,
    questionId: string,
    slug: string
  ) => Promise<unknown>;
}

interface ResponseHydrationCryptoUtils {
  hashIdentifier?: (value: unknown) => string;
}

export interface SessionResponseHydrationHost {
  [key: string]: unknown;
  setState?: (updater: SetStateArg, cb?: () => void) => void;
  isMounted?: () => boolean;
  dgRead?: (name: string, slug: string) => Record<string, unknown> | null | undefined;
  dgWrite?: (name: string, slug: string, value: Record<string, unknown>) => unknown;
  getActiveSessionSlug?: () => string | null | undefined;
  getSessionChainId?: (slug: string) => string | number | null | undefined;
  getAccount?: () => string | null | undefined;
  scanScopeNoop?: (slug: string, op: string, onSkipped?: () => void) => boolean;
  setReadinessStateIfChanged?: (
    nextState: Record<string, unknown> | null | undefined,
    cb?: () => void
  ) => unknown;
  checkAllCachesReady?: () => void;
  mergeLegacyNumericNetworkKey?: (cache: Record<string, unknown>, networkID: string) => boolean;
  queueLocalRevisionUpdate?: (opts?: QueueLocalRevisionUpdateOptions) => void;
}

export interface SessionResponseHydrationController {
  fetchQuestionResponsesChunkedForGroup: (
    slug: string,
    opts?: ResponseInitOptions
  ) => Promise<void>;
  refreshQuestionResponses: (
    questionIds?: string[] | null,
    opts?: RefreshQuestionResponsesOptions
  ) => Promise<void>;
  isInitInFlight: (slugIn?: string) => boolean;
  destroy: () => void;
}

interface SessionResponseHydrationControllerRuntime {
  fetchQuestionResponsesChunkedForGroup: (
    slug: string,
    opts?: ResponseInitOptions
  ) => Promise<void>;
  refreshQuestionResponses: (
    questionIds?: string[] | null,
    opts?: RefreshQuestionResponsesOptions
  ) => Promise<void>;
  isInitInFlight: (slugIn?: string) => boolean;
  destroy: () => void;
}

const mainSiteLog = createLogger('mainSite');
const responseHydrationContractScripts = contractScripts as unknown as ResponseHydrationContractScripts;
const responseHydrationCryptoUtils = cryptoUtils as unknown as ResponseHydrationCryptoUtils;

const isRecord = (value: unknown): value is CacheRecord => (
  !!value && typeof value === 'object'
);

const toRecord = (value: unknown): CacheRecord => (
  isRecord(value) ? value : {}
);

const isPendingQuestionMetadataPlaceholder = (value: unknown): boolean => (
  isRecord(value) && value.__ceQuestionMetadataPending === true
);

const hasHydratedQuestionMetadata = (value: unknown): boolean => (
  isRecord(value) && !isPendingQuestionMetadataPlaceholder(value)
);

const buildPendingQuestionMetadataPlaceholder = (
  qid: unknown,
  slug: unknown,
  existing: unknown = null
): CacheRecord | null => {
  const id = String(qid || '').trim().toLowerCase();
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

const seedPendingQuestionMetadataFromResponse = (
  net: QuestionCacheNetworkNode,
  qid: unknown,
  slug: unknown
): boolean => {
  const questionId = String(qid || '').trim().toLowerCase();
  if (!questionId || !net || typeof net !== 'object') return false;

  if (!net.questions || typeof net.questions !== 'object') net.questions = {};
  if (!net.pendingQuestionMetadata || typeof net.pendingQuestionMetadata !== 'object') {
    net.pendingQuestionMetadata = {};
  }

  const existingQuestion = net.questions[questionId];
  if (hasHydratedQuestionMetadata(existingQuestion)) return false;

  let changed = false;
  if (!net.pendingQuestionMetadata[questionId]) {
    net.pendingQuestionMetadata[questionId] = {
      attempts: 0,
      nextRetryAtMs: 0,
      state: 'discovered-from-response',
      lastStatus: null,
      message: 'Question response discovered before question metadata; awaiting Arweave hydration.',
    };
    changed = true;
  }

  if (!isPendingQuestionMetadataPlaceholder(existingQuestion)) {
    const placeholder = buildPendingQuestionMetadataPlaceholder(questionId, slug, existingQuestion);
    if (placeholder) {
      net.questions[questionId] = placeholder;
      changed = true;
    }
  }

  return changed;
};

const createEmptyQuestionCacheNetworkNode = (initialLastBlockQR: number): QuestionCacheNetworkNode => ({
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
});

const createEmptyUserDataRecord = (): UserDataRecord => ({
  sbts: [],
  createdSurveys: [],
  createdQuestions: [],
  surveyResponses: [],
  questionResponses: [],
});

const ensureUserDataRecord = (value: unknown): UserDataRecord => {
  const data = toRecord(value) as UserDataRecord;
  if (!Array.isArray(data.sbts)) data.sbts = [];
  if (!Array.isArray(data.createdSurveys)) data.createdSurveys = [];
  if (!Array.isArray(data.createdQuestions)) data.createdQuestions = [];
  if (!Array.isArray(data.surveyResponses)) data.surveyResponses = [];
  if (!Array.isArray(data.questionResponses)) data.questionResponses = [];
  return data;
};

export const createSessionResponseHydrationController = (
  host: SessionResponseHydrationHost = {}
): SessionResponseHydrationControllerRuntime => {
  let _responseInitInFlight: Record<string, Promise<void> | undefined> = {};
  let _responseInitPending: Record<string, ResponseInitOptions | undefined> = {};
  let _destroyed: boolean = false;
  let _continuationTimers: ReturnType<typeof setTimeout>[] = [];

  const setState = (updater: SetStateArg, cb?: () => void): void => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };
  const isMounted = (): boolean => (
    typeof host.isMounted === 'function' ? host.isMounted() : false
  );
  const dgRead = (...args: [string, string]): CacheRecord | null => (
    typeof host.dgRead === 'function' ? (host.dgRead(...args) as CacheRecord | null) : null
  );
  const dgWrite = (...args: [string, string, CacheRecord]): unknown => (
    typeof host.dgWrite === 'function' ? host.dgWrite(...args) : null
  );
  const getActiveSessionSlug = (): string => String(
    typeof host.getActiveSessionSlug === 'function' ? host.getActiveSessionSlug() || '' : ''
  );
  const getSessionChainId = (slug: string): string | number | null | undefined => (
    typeof host.getSessionChainId === 'function' ? host.getSessionChainId(slug) : null
  );
  const getAccount = (): string | null | undefined => (
    typeof host.getAccount === 'function' ? host.getAccount() : ''
  );
  const scanScopeNoop = (slug: string, op: string, onSkipped?: () => void): boolean => (
    typeof host.scanScopeNoop === 'function' ? host.scanScopeNoop(slug, op, onSkipped) : false
  );
  const setReadinessStateIfChanged = (
    ...args: [StateRecord | null | undefined, (() => void)?]
  ): void => {
    if (typeof host.setReadinessStateIfChanged === 'function') {
      host.setReadinessStateIfChanged(...args);
    }
  };
  const checkAllCachesReady = (): void => {
    if (typeof host.checkAllCachesReady === 'function') {
      host.checkAllCachesReady();
    }
  };
  const mergeLegacyNumericNetworkKey = (cache: CacheRecord, networkID: string): boolean => (
    typeof host.mergeLegacyNumericNetworkKey === 'function'
      ? host.mergeLegacyNumericNetworkKey(cache, networkID)
      : false
  );
  const queueLocalRevisionUpdate = (opts: QueueLocalRevisionUpdateOptions = {}): void => {
    if (typeof host.queueLocalRevisionUpdate === 'function') {
      host.queueLocalRevisionUpdate(opts);
      return;
    }
    const shouldBumpQuestionResponsesNonce = !!opts?.needsQuestionResponsesNonce;
    const shouldCheckAllCachesReady = !!opts?.checkAllCachesReady;
    if (!shouldBumpQuestionResponsesNonce && !shouldCheckAllCachesReady) return;
    setState((prev) => {
      const next: StateRecord = {};
      if (shouldBumpQuestionResponsesNonce) {
        next.questionResponsesNonce = Number(prev?.questionResponsesNonce || 0) + 1;
      }
      return Object.keys(next).length ? next : null;
    }, () => {
      if (shouldCheckAllCachesReady) checkAllCachesReady();
    });
  };

  const isInitInFlight = (slugIn: string = ''): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    return !!_responseInitInFlight?.[slug];
  };

  const destroy = (): void => {
    _destroyed = true;
    _continuationTimers.forEach((timer) => {
      try {
        clearTimeout(timer);
      } catch (e: unknown) {
        mainSiteLog.warn('MainSite: cleanup', e);
      }
    });
    _continuationTimers = [];
    _responseInitInFlight = {};
    _responseInitPending = {};
  };

  const fetchQuestionResponsesChunkedForGroup = async (
    slugIn: string,
    opts: ResponseInitOptions = {}
  ): Promise<void> => {
    const slug = normalizeSessionSlug(slugIn || '');
    const suppressUiState = !!(opts && opts.background === true);
    const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
    const notifyOnCompletion = !!(opts && opts.notifyOnCompletion === true);
    const initRunKey = slug;
    const rerunOpts: ResponseInitOptions = {
      ...(opts && typeof opts === 'object' ? opts : {}),
      background: suppressUiState,
      forceArweaveFetch,
      notifyOnCompletion,
    };
    const mergePendingResponseInitOpts = (
      prevOpts: ResponseInitOptions | undefined,
      nextOpts: ResponseInitOptions | undefined
    ): ResponseInitOptions => {
      const nextBackground = !!(
        nextOpts &&
        typeof nextOpts === 'object' &&
        nextOpts.background === true
      );
      const nextForceArweaveFetch = !!(
        nextOpts &&
        typeof nextOpts === 'object' &&
        nextOpts.forceArweaveFetch === true
      );
      const nextNotifyOnCompletion = !!(
        nextOpts &&
        typeof nextOpts === 'object' &&
        nextOpts.notifyOnCompletion === true
      );
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
    const setResponseState = (nextState: SetStateArg, cb?: () => void): void => {
      if (suppressUiState || !isMounted()) return;
      setState(nextState, cb);
    };
    const notifyBackgroundCompletion = (): void => {
      if (!suppressUiState || !notifyOnCompletion) return;
      queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
    };
    const maybeCheckAllCachesReady = (): void => {
      if (suppressUiState) return;
      checkAllCachesReady();
    };
    if (scanScopeNoop(slug, 'fetchQuestionResponsesChunkedForGroup', () => {
      setResponseState((prev) => ({
        isResponsesCacheReady: true,
        questionResponsesNonce: (prev.questionResponsesNonce as number) + 1,
      }), checkAllCachesReady);
      notifyBackgroundCompletion();
    })) {
      return;
    }
    _responseInitInFlight = _responseInitInFlight || {};
    _responseInitPending = _responseInitPending || {};
    if (_responseInitInFlight[initRunKey]) {
      _responseInitPending[initRunKey] = mergePendingResponseInitOpts(
        _responseInitPending[initRunKey],
        rerunOpts
      );
      return _responseInitInFlight[initRunKey];
    }

    const run = (async (): Promise<void> => {
      mainSiteLog.log('fetchQuestionResponsesChunkedForGroup() - invoked for new question responses', {
        slug,
      });
      setResponseState({ isResponsesCacheReady: false });

      const chainId = getSessionChainId(slug);
      if (!chainId) {
        mainSiteLog.warn('No group chainId for fetchQuestionResponsesChunkedForGroup; aborting.');
        setResponseState((prev) => ({
          isResponsesCacheReady: true,
          questionResponsesNonce: (prev.questionResponsesNonce as number) + 1,
        }), checkAllCachesReady);
        notifyBackgroundCompletion();
        return;
      }

      const networkID = String(getSessionChainId(slug) || '');
      const { fromBlock: baseFrom, toBlock: baseTo } =
        await responseHydrationContractScripts.getRelevantBlockWindowForFilter(slug);
      if (baseFrom > baseTo) {
        setResponseState((prev) => ({
          isResponsesCacheReady: true,
          questionResponsesNonce: (prev.questionResponsesNonce as number) + 1,
        }), checkAllCachesReady);
        notifyBackgroundCompletion();
        return;
      }
      const initialLastBlockQR = Math.max(0, baseFrom - 1);

      let questionsCache = (dgRead('questionsCache', slug) || {}) as QuestionCache;
      // Migration: numeric -> string key
      if (questionsCache && networkID) {
        mergeLegacyNumericNetworkKey(questionsCache as CacheRecord, networkID);
      }
      if (!questionsCache[networkID]) {
        questionsCache[networkID] = createEmptyQuestionCacheNetworkNode(initialLastBlockQR);
      }
      ensureQuestionArweaveCacheBranches(
        questionsCache[networkID] as QuestionCacheNetworkNode
      );
      const mergeFreshArweaveBranches = (): void => {
        try {
          const freshCache = (dgRead('questionsCache', slug) || {}) as QuestionCache;
          const freshNet = freshCache?.[networkID];
          if (!freshNet || typeof freshNet !== 'object') return;
          ensureQuestionArweaveCacheBranches(
            questionsCache[networkID] as QuestionCacheNetworkNode
          );
          mergeQuestionArweaveCacheBranches(
            questionsCache[networkID] as QuestionCacheNetworkNode,
            freshNet as QuestionCacheNetworkNode
          );
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: fallback', e);
        }
      };

      let lastProcessedQRBlock = Number(
        (questionsCache[networkID] as QuestionCacheNetworkNode).questionResponsesLatestBlock
      ) || 0;
      const floorBlock = initialLastBlockQR;
      if (lastProcessedQRBlock < floorBlock) lastProcessedQRBlock = floorBlock;

      const latestBlock = baseTo;

      if (lastProcessedQRBlock >= latestBlock) {
        mainSiteLog.log('No new question responses to fetch: already up-to-date.');
        setResponseState((prev) => ({
          isResponsesCacheReady: true,
          questionResponsesNonce: (prev.questionResponsesNonce as number) + 1,
        }), maybeCheckAllCachesReady);
        notifyBackgroundCompletion();
        return;
      }

      // Track what we really persisted this run
      let processedToBlock = lastProcessedQRBlock;
      const pendingPersistenceWrites: Promise<boolean>[] = [];
      let persistenceFailureCount = 0;

      const settleManagedWrite = (key: string, writePromise: unknown): Promise<boolean> => {
        return Promise.resolve(writePromise)
          .then((ok) => {
            if (!ok) {
              persistenceFailureCount += 1;
              mainSiteLog.warn('[MainSite] managed cache write returned false', { slug, key });
            }
            return !!ok;
          })
          .catch((e: unknown) => {
            persistenceFailureCount += 1;
            mainSiteLog.warn('[MainSite] managed cache write threw', {
              slug,
              key,
              error: e instanceof Error ? e.message : e,
            });
            return false;
          });
      };

      const trackManagedWrite = (key: string, writePromise: unknown): Promise<boolean> => {
        const tracked = settleManagedWrite(key, writePromise);
        pendingPersistenceWrites.push(tracked);
        return tracked;
      };

      const awaitManagedWrite = (key: string, writePromise: unknown): Promise<boolean> => (
        settleManagedWrite(key, writePromise)
      );

      const RESPONSE_CACHE_WRITE_MIN_INTERVAL_MS = 1000;
      const RESPONSE_CACHE_WRITE_MAX_PENDING_CHUNKS = 4;
      let lastResponseCacheWriteMs = 0;
      let pendingResponseChunkCount = 0;
      let hasPendingQuestionsCacheWrite = false;
      let pendingQuestionsCacheSnapshot: QuestionCache | null = null;
      let pendingQuestionsCacheWatermark = 0;
      let hasPendingUserCacheWrite = false;
      let pendingUserCacheSnapshot: UserCache | null = null;
      let responseUserCache = (dgRead('userCache', slug) || {}) as UserCache;
      const RESPONSE_USER_CACHE_DATA_KEYS: UserDataListKey[] = [
        'sbts',
        'createdSurveys',
        'createdQuestions',
        'surveyResponses',
        'questionResponses',
      ];
      const normalizeResponseCacheNetworkKey = (cacheObj: CacheRecord): void => {
        mergeLegacyNumericNetworkKey(cacheObj, networkID);
      };
      const ensureResponseQuestionCacheBucket = (cacheObj: CacheRecord): QuestionCache => {
        const cacheRef = (cacheObj && typeof cacheObj === 'object')
          ? (cacheObj as QuestionCache)
          : ({} as QuestionCache);
        normalizeResponseCacheNetworkKey(cacheRef as CacheRecord);
        if (!cacheRef[networkID]) {
          cacheRef[networkID] = createEmptyQuestionCacheNetworkNode(initialLastBlockQR);
        }
        const net = cacheRef[networkID] as QuestionCacheNetworkNode;
        if (!net.questions || typeof net.questions !== 'object') net.questions = {};
        if (!net.questionResponses || typeof net.questionResponses !== 'object') {
          net.questionResponses = {};
        }
        if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') {
          net.questionResponsesMeta = {};
        }
        if (!net.pendingQuestionMetadata || typeof net.pendingQuestionMetadata !== 'object') {
          net.pendingQuestionMetadata = {};
        }
        if (!net.questionHydrationMeta || typeof net.questionHydrationMeta !== 'object') {
          net.questionHydrationMeta = {};
        }
        ensureQuestionArweaveCacheBranches(net);
        return cacheRef;
      };
      const toResponseRecencyPair = (
        value: unknown,
        responseValue: unknown = null
      ): ResponseRecencyPair => {
        const src = (value && typeof value === 'object') ? (value as CacheRecord) : {};
        const responseObj = (
          responseValue && typeof responseValue === 'object'
            ? (responseValue as CacheRecord)
            : {}
        );
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
      const compareResponseRecency = (
        incomingRecency: ResponseRecencyPair,
        existingRecency: ResponseRecencyPair
      ): number => {
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
      const mergeResponseMapsByRecency = (
        targetNet: QuestionCacheNetworkNode,
        sourceNet: QuestionCacheNetworkNode
      ): void => {
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
            const targetByResponder = targetResponses[qid] || {};
            const targetMetaByResponder = targetMeta[qid] || {};
            const hasExistingResponse = Object.prototype.hasOwnProperty.call(targetByResponder, responder);
            const existingMeta = targetMetaByResponder[responder];
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
            targetByResponder[responder] = incomingResponse;
            targetMetaByResponder[responder] = toResponseRecencyPair(incomingMeta, incomingResponse);
            targetResponses[qid] = targetByResponder;
            targetMeta[qid] = targetMetaByResponder;
          });
        });
        targetNet.questionResponses = targetResponses;
        targetNet.questionResponsesMeta = targetMeta;
      };
      const mergeFreshQuestionsCacheIntoPendingSnapshot = (
        pendingCache: QuestionCache | CacheRecord,
        freshCache: QuestionCache | CacheRecord
      ): QuestionCache => {
        const targetCache = ensureResponseQuestionCacheBucket(pendingCache as CacheRecord);
        const sourceCache = ensureResponseQuestionCacheBucket(freshCache as CacheRecord);
        const targetNet = targetCache[networkID] as QuestionCacheNetworkNode;
        const sourceNet = sourceCache[networkID] as QuestionCacheNetworkNode;
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
      const buildUserCacheEntryKey = (listKey: UserDataListKey, entry: unknown): string => {
        const item = (entry && typeof entry === 'object') ? (entry as UserCacheEntry) : {};
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
      const readUserCacheRowRecency = (entry: unknown): ResponseRecencyPair => {
        const row = (entry && typeof entry === 'object') ? (entry as UserCacheEntry) : {};
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
      const hasUserCacheRowRecencyHints = (entry: unknown): boolean => {
        const recency = readUserCacheRowRecency(entry);
        return recency.bn > 0 || recency.txi > 0 || recency.li > 0 || recency.ts > 0;
      };
      const compareUserCacheRowsByRecency = (
        incomingRow: unknown,
        existingRow: unknown
      ): number => {
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
      const mergeUserDataArray = (
        targetData: UserDataRecord,
        sourceData: UserDataRecord,
        listKey: UserDataListKey
      ): void => {
        const sourceArr = Array.isArray(sourceData?.[listKey]) ? sourceData[listKey] : [];
        if (!sourceArr.length) return;
        const targetArr = Array.isArray(targetData?.[listKey]) ? targetData[listKey] : [];
        if (!targetArr.length) {
          targetData[listKey] = [...sourceArr];
          return;
        }
        const merged: UserCacheEntry[] = [];
        const keyedIndex = new Map<string, number>();
        const upsert = (
          entry: UserCacheEntry,
          { allowReplace = true }: { allowReplace?: boolean } = {}
        ): void => {
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
          if (idx == null) return;
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
            if (
              cmp === 0 &&
              existing &&
              typeof existing === 'object' &&
              entry &&
              typeof entry === 'object'
            ) {
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
      const mergeUserNetworkBucket = (
        targetBucket: unknown,
        sourceBucket: unknown
      ): UserNetworkCache => {
        const targetRef = (targetBucket && typeof targetBucket === 'object')
          ? (targetBucket as UserNetworkCache)
          : ({
            lastBlockScanned: 0,
            lastScanTimestamp: 0,
            data: createEmptyUserDataRecord(),
          } as UserNetworkCache);
        const sourceRef = (sourceBucket && typeof sourceBucket === 'object')
          ? (sourceBucket as UserNetworkCache)
          : ({
            lastBlockScanned: 0,
            lastScanTimestamp: 0,
            data: createEmptyUserDataRecord(),
          } as UserNetworkCache);
        targetRef.lastBlockScanned = Math.max(
          Number(targetRef.lastBlockScanned || 0),
          Number(sourceRef.lastBlockScanned || 0)
        );
        targetRef.lastScanTimestamp = Math.max(
          Number(targetRef.lastScanTimestamp || 0),
          Number(sourceRef.lastScanTimestamp || 0)
        );
        targetRef.data = ensureUserDataRecord(targetRef.data);
        const sourceData = ensureUserDataRecord(sourceRef.data);
        RESPONSE_USER_CACHE_DATA_KEYS.forEach((listKey) => {
          mergeUserDataArray(targetRef.data, sourceData, listKey);
        });
        return targetRef;
      };
      const mergeFreshUserCacheIntoPendingSnapshot = (
        pendingCache: UserCache | CacheRecord,
        freshCache: UserCache | CacheRecord
      ): UserCache => {
        const targetCache = (pendingCache && typeof pendingCache === 'object')
          ? (pendingCache as UserCache)
          : ({} as UserCache);
        const sourceCache = (freshCache && typeof freshCache === 'object')
          ? (freshCache as UserCache)
          : ({} as UserCache);
        Object.keys(sourceCache).forEach((addrRaw) => {
          const sourceByNetwork = sourceCache[addrRaw];
          if (!sourceByNetwork || typeof sourceByNetwork !== 'object') return;
          const lowerAddr = String(addrRaw || '').trim().toLowerCase();
          if (!lowerAddr) return;
          if (!targetCache[lowerAddr] || typeof targetCache[lowerAddr] !== 'object') {
            targetCache[lowerAddr] = {};
          }
          const targetByNetwork = targetCache[lowerAddr] as UserCacheByNetwork;
          const sourceByNetworkRecord = sourceByNetwork as UserCacheByNetwork;
          Object.keys(sourceByNetworkRecord).forEach((netKey) => {
            const sourceBucket = sourceByNetworkRecord[netKey];
            if (!sourceBucket || typeof sourceBucket !== 'object') return;
            if (!targetByNetwork[netKey] || typeof targetByNetwork[netKey] !== 'object') {
              targetByNetwork[netKey] = {};
            }
            targetByNetwork[netKey] = mergeUserNetworkBucket(
              targetByNetwork[netKey],
              sourceBucket
            );
          });
        });
        return targetCache;
      };
      const flushResponsePartialWrites = ({ force = false }: { force?: boolean } = {}): boolean => {
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
            (dgRead('questionsCache', slug) || {}) as QuestionCache
          );
          questionsCache = latestQuestionsSnapshot;
          const questionsWrite = trackManagedWrite(
            'questionsCache',
            dgWrite('questionsCache', slug, latestQuestionsSnapshot as CacheRecord)
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
            (dgRead('userCache', slug) || {}) as UserCache
          );
          responseUserCache = latestUserSnapshot;
          trackManagedWrite('userCache', dgWrite('userCache', slug, latestUserSnapshot as CacheRecord));
        }
        return true;
      };

      const handleProgress = (info: {
        chunkFrom: number;
        chunkTo: number;
        chunkEventCount: number;
        overallEventCount: number;
      }): void => {
        mainSiteLog.debug(
          `Chunk ${info.chunkFrom}-${info.chunkTo}, events=${info.chunkEventCount}, soFar=${info.overallEventCount}`
        );
      };

      const handlePartialData = (
        partialAgg: PartialResponseAggregate,
        chunkToBlock: number,
        extra: CacheRecord = {}
      ): void => {
        // Rebase the local pending snapshot onto fresh persisted state to avoid stale overwrites.
        const persistedQuestionsCache = (dgRead('questionsCache', slug) || {}) as QuestionCache;
        const fresh = mergeFreshQuestionsCacheIntoPendingSnapshot(
          (pendingQuestionsCacheSnapshot || questionsCache || {}) as QuestionCache,
          persistedQuestionsCache
        );
        ensureQuestionArweaveCacheBranches(fresh[networkID] as QuestionCacheNetworkNode);
        mergeQuestionArweaveCacheBranches(
          fresh[networkID] as QuestionCacheNetworkNode,
          questionsCache?.[networkID] as QuestionCacheNetworkNode
        );

        const freshNet = fresh[networkID] as QuestionCacheNetworkNode;
        const currentQR = freshNet.questionResponses;
        const metaQR = freshNet.questionResponsesMeta;

        // Proactive user cache population
        const userCache = mergeFreshUserCacheIntoPendingSnapshot(
          (pendingUserCacheSnapshot || responseUserCache || {}) as UserCache,
          (dgRead('userCache', slug) || {}) as UserCache
        );
        let userCacheModified = false;

        const ensureUserNode = (addr: string, block: number): UserDataRecord => {
          const lower = addr.toLowerCase();
          if (!userCache[lower]) userCache[lower] = {};
          const byNetwork = userCache[lower] as UserCacheByNetwork;
          if (!byNetwork[networkID]) {
            byNetwork[networkID] = {
              lastBlockScanned: block,
              lastScanTimestamp: Math.floor(Date.now() / 1000),
              data: createEmptyUserDataRecord(),
            };
          }
          const networkNode = byNetwork[networkID] as UserNetworkCache;
          if (block > networkNode.lastBlockScanned) {
            networkNode.lastBlockScanned = block;
            networkNode.lastScanTimestamp = Math.floor(Date.now() / 1000);
          }
          networkNode.data = ensureUserDataRecord(networkNode.data);
          return networkNode.data;
        };

        // Merge partialAgg deterministically
        Object.keys(partialAgg).forEach((qId) => {
          seedPendingQuestionMetadataFromResponse(freshNet, qId, slug);
          if (!currentQR[qId]) currentQR[qId] = {};
          if (!metaQR[qId]) metaQR[qId] = {};

          partialAgg[qId].forEach((respObj) => {
            const responderKey = String(respObj.responder || '').toLowerCase();

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
              const nextEntry: UserCacheEntry = {
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
                const mergedEntry: UserCacheEntry = {
                  ...(prevEntry && typeof prevEntry === 'object' ? prevEntry : {}),
                  ...nextEntry,
                };
                const prevQuestionId = String(prevEntry?.questionId || '');
                const prevResponder = String(prevEntry?.responder || '');
                const prevResponse = prevEntry?.response;
                const prevBlockNumber = Number(prevEntry?.blockNumber ?? 0);
                const prevTransactionIndex = Number(
                  prevEntry?.transactionIndex ?? prevEntry?.txIndex ?? prevEntry?.txi ?? 0
                );
                const prevLogIndex = Number(prevEntry?.logIndex ?? 0);
                const prevTimestamp = Number(prevEntry?.timestamp ?? prevEntry?.ts ?? 0);
                if (
                  prevQuestionId !== String(mergedEntry.questionId || '') ||
                  prevResponder !== String(mergedEntry.responder || '') ||
                  prevResponse !== mergedEntry.response ||
                  prevBlockNumber !== Number(mergedEntry.blockNumber ?? 0) ||
                  prevTransactionIndex !== Number(
                    mergedEntry.transactionIndex ?? mergedEntry.txIndex ?? mergedEntry.txi ?? 0
                  ) ||
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
        const prevWatermark = Number(
          (fresh[networkID] as QuestionCacheNetworkNode).questionResponsesLatestBlock
        ) || 0;
        const thisChunkTo = Number(chunkToBlock) || 0;
        (fresh[networkID] as QuestionCacheNetworkNode).questionResponsesLatestBlock = Math.max(
          prevWatermark,
          thisChunkTo
        );

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
        await responseHydrationContractScripts.getQuestionResponsesChunkedWithCallback(
          'none',
          lastProcessedQRBlock + 1,
          latestBlock,
          handleProgress,
          handlePartialData,
          slug,
          { forceArweaveFetch }
        );
      } catch (e: unknown) {
        mainSiteLog.error('getQuestionResponsesChunkedWithCallback failed:', e);
        // DO NOT mark complete; we’ll leave the watermark where we truly got to (processedToBlock)
      }

      flushResponsePartialWrites({ force: true });
      await Promise.allSettled(pendingPersistenceWrites);

      // Clamp watermark to the last block that actually persisted
      (questionsCache[networkID] as QuestionCacheNetworkNode).questionResponsesLatestBlock =
        resolvePersistedQuestionResponsesWatermark({
          floorBlock,
          processedToBlock,
        });
      mergeFreshArweaveBranches();
      await awaitManagedWrite(
        'questionsCache',
        dgWrite('questionsCache', slug, questionsCache as CacheRecord)
      );

      if (persistenceFailureCount > 0) {
        mainSiteLog.warn(
          '[MainSite] response-cache initialization finished with persistence failures; continuing with in-memory data',
          { slug, persistenceFailureCount }
        );
      }

      mainSiteLog.log(
        `Finished responses. Watermark now ${
          (questionsCache[networkID] as QuestionCacheNetworkNode).questionResponsesLatestBlock
        } (latest=${latestBlock}).`
      );

      setResponseState((prev) => ({
        isResponsesCacheReady: true,
        questionResponsesNonce: (prev.questionResponsesNonce as number) + 1,
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
          } catch (e: unknown) {
            mainSiteLog.warn('MainSite: fallback', e);
          }
        }, 0);
        _continuationTimers.push(continuationTimer);
      }
    }
  };

  const refreshQuestionResponses = async (
    questionIds: string[] | null = null,
    opts: RefreshQuestionResponsesOptions = {}
  ): Promise<void> => {
    const slug = normalizeSessionSlug((opts?.slug ?? getActiveSessionSlug()) || '');
    const forceFull = !!opts?.forceFull;
    const responderLower = String(opts?.responder || getAccount() || '').trim().toLowerCase();
    const migrateQuestionCacheNetworkKey = (cacheObj: CacheRecord, netId: string): void => {
      mergeLegacyNumericNetworkKey(cacheObj, netId);
    };
    const ensureQuestionCacheNetworkNode = (
      cacheObj: QuestionCache,
      netId: string,
      initialLastBlockQR: number
    ): QuestionCacheNetworkNode => {
      if (!cacheObj[netId]) {
        cacheObj[netId] = createEmptyQuestionCacheNetworkNode(initialLastBlockQR);
      }
      const net = cacheObj[netId] as QuestionCacheNetworkNode;
      if (!Number.isFinite(Number(net.questionsDiscoveryCheckpointBlock))) {
        net.questionsDiscoveryCheckpointBlock = Number(net.questionsLatestBlock) || initialLastBlockQR;
      }
      if (!net.questionResponses || typeof net.questionResponses !== 'object') {
        net.questionResponses = {};
      }
      if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') {
        net.questionResponsesMeta = {};
      }
      ensureQuestionArweaveCacheBranches(net);
      return net;
    };
    const ensureUserCacheNetworkNode = (
      cacheObj: UserCache,
      responder: string,
      netId: string,
      initialLastBlockQR: number
    ): UserNetworkCache | null => {
      const responderKey = String(responder || '').trim().toLowerCase();
      if (!responderKey) return null;
      if (!cacheObj[responderKey] || typeof cacheObj[responderKey] !== 'object') {
        cacheObj[responderKey] = {};
      }
      const responderCache = cacheObj[responderKey] as UserCacheByNetwork;
      if (!responderCache[netId] || typeof responderCache[netId] !== 'object') {
        responderCache[netId] = {
          lastBlockScanned: initialLastBlockQR,
          lastScanTimestamp: Math.floor(Date.now() / 1000),
          data: createEmptyUserDataRecord(),
        };
      }
      const node = responderCache[netId] as UserNetworkCache;
      node.data = ensureUserDataRecord(node.data);
      if (!Array.isArray(node.data.questionResponses)) node.data.questionResponses = [];
      return node;
    };
    const ensureHash = (value: unknown): string => {
      try {
        if (ethers.utils.isHexString(value, 32)) return String(value || '').toLowerCase();
      } catch (e: unknown) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
      try {
        if (typeof responseHydrationCryptoUtils.hashIdentifier === 'function') {
          return String(responseHydrationCryptoUtils.hashIdentifier(value) || '').toLowerCase();
        }
      } catch (e: unknown) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
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
      mainSiteLog.log('refreshQuestionResponses() - targeted refresh', {
        slug,
        responder: responderLower,
        questionCount: normalizedQids.length,
      });
      setState({ isResponsesCacheReady: false });

      const networkID = String(getSessionChainId(slug) || '');
      const { fromBlock: baseFrom } = await responseHydrationContractScripts.getRelevantBlockWindowForFilter(slug);
      const initialLastBlockQR = Math.max(0, Number(baseFrom || 0) - 1);

      const results = await Promise.all(
        normalizedQids.map(async (qId): Promise<{ qId: string; response: unknown | null }> => {
          try {
            const response = await responseHydrationContractScripts.getResponse('none', responderLower, qId, slug);
            return { qId, response };
          } catch (e: unknown) {
            mainSiteLog.warn(`refreshQuestionResponses(targeted): failed qId=${qId}`, e);
            return { qId, response: null };
          }
        })
      );

      let updatedAny = false;
      const nextByQid = new Map<string, unknown>();
      results.forEach(({ qId, response }) => {
        if (!response) return;
        nextByQid.set(qId, response);
      });

      if (nextByQid.size > 0) {
        // Re-read right before merge/write so concurrent listener hydrations are preserved.
        const freshCache = (dgRead('questionsCache', slug) || {}) as QuestionCache;
        const freshUserCache = (dgRead('userCache', slug) || {}) as UserCache;
        migrateQuestionCacheNetworkKey(freshCache as CacheRecord, networkID);
        const net = ensureQuestionCacheNetworkNode(freshCache, networkID, initialLastBlockQR);
        const userNode = ensureUserCacheNetworkNode(
          freshUserCache,
          responderLower,
          networkID,
          initialLastBlockQR
        );
        let userCacheUpdated = false;

        nextByQid.forEach((response, qId) => {
          seedPendingQuestionMetadataFromResponse(net, qId, slug);
          if (!net.questionResponses[qId] || typeof net.questionResponses[qId] !== 'object') {
            net.questionResponses[qId] = {};
          }
          if (!net.questionResponsesMeta[qId] || typeof net.questionResponsesMeta[qId] !== 'object') {
            net.questionResponsesMeta[qId] = {};
          }

          net.questionResponses[qId][responderLower] = response;

          // Targeted refresh is not event-ordered, so never stamp synthetic high logIndex values.
          // Clamp any legacy synthetic marker (li >= 1000) to 0 so same-block real events can win.
          const prevMeta = toRecord(net.questionResponsesMeta[qId][responderLower]);
          const prevBn = Number(prevMeta.bn);
          const prevTxi = Number(prevMeta.txi ?? prevMeta.transactionIndex ?? prevMeta.txIndex);
          const prevLi = Number(prevMeta.li);
          const prevTs = Number(prevMeta.ts ?? prevMeta.timestamp);
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
            const responseMetaBn = Number((responseMeta as ResponseRecencyPair).bn ?? 0);
            const responseMetaTxi = Number(
              (responseMeta as CacheRecord).txi ??
              (responseMeta as CacheRecord).transactionIndex ??
              (responseMeta as CacheRecord).txIndex ??
              0
            );
            const responseMetaLi = Number(
              (responseMeta as CacheRecord).li ?? (responseMeta as CacheRecord).logIndex ?? 0
            );
            const responseMetaTs = Number(
              (responseMeta as CacheRecord).ts ?? (responseMeta as CacheRecord).timestamp ?? 0
            );
            const hasResponseRecencyHint = (
              (Number.isFinite(responseMetaBn) && responseMetaBn > 0) ||
              (Number.isFinite(responseMetaTxi) && responseMetaTxi > 0) ||
              (Number.isFinite(responseMetaLi) && responseMetaLi > 0) ||
              (Number.isFinite(responseMetaTs) && responseMetaTs > 0)
            );
            const nextEntry: UserCacheEntry = {
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
          dgWrite('questionsCache', slug, freshCache as CacheRecord);
          if (userNode) {
            const prevLast = Number(userNode.lastBlockScanned) || 0;
            userNode.lastBlockScanned = Math.max(prevLast, initialLastBlockQR);
            userNode.lastScanTimestamp = Math.floor(Date.now() / 1000);
          }
          if (userCacheUpdated) {
            dgWrite('userCache', slug, freshUserCache as CacheRecord);
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
      mainSiteLog.log('refreshQuestionResponses() - targeted refresh complete', {
        slug,
        updatedAny,
      });
      return;
    }

    mainSiteLog.log('refreshQuestionResponses() - full refresh fallback', {
      slug,
      forceFull,
      responderLower,
      questionCount: normalizedQids.length,
    });
    // No wallet network required; we use group-aware read providers internally.
    setReadinessStateIfChanged({ isQuestionCacheReady: false, isResponsesCacheReady: false });
    await fetchQuestionResponsesChunkedForGroup(slug);
    checkAllCachesReady();
    mainSiteLog.log('refreshQuestionResponses() - done');
  };

  return {
    fetchQuestionResponsesChunkedForGroup,
    refreshQuestionResponses,
    isInitInFlight,
    destroy,
  };
};
