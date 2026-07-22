import contractScripts, { normalizeSessionSlug } from '../web3/chainGateway.js';
import { createLogger } from 'utilities/logging.js';
import { normalizeArweaveFailureMeta, shouldStopPendingMetadataRetry } from '../arweave/arweaveRetryHelpers.js';
import { prepareSurveyMetadataCacheEntry } from './metadataCacheEntryBuilders.js';
import { resolveScopedMetadataSessionSlug } from '../session/metadataSessionBinding.js';
import {
  mergeSurveyResponseCacheSnapshot,
  normalizeSurveyResponseBatchResult,
  resolveSurveyResponseWatermark,
} from './sessionSurveyResponseHelpers.js';
import { isResponseRecencyNewer, toResponseRecencyPair } from './responseRecency.js';
import { sbtEventStreamsPort } from '../../domains/sbts/sbtEventStreamsPort.js';
import type { SbtEventStreamsPort } from '../../domains/sbts/sbtPorts.js';

type StateRecord = Record<string, unknown>;
type CacheRecord = Record<string, unknown>;
type SetStateArg = StateRecord | ((prev: StateRecord) => StateRecord | null) | null;

interface SurveyInitOptions {
  background?: boolean;
}

interface QueueLocalRevisionUpdateOptions {
  needsQuestionResponsesNonce?: boolean;
  checkAllCachesReady?: boolean;
}

interface SurveyMetadata extends CacheRecord {
  surveyID?: string;
  id?: string;
  creationBlock?: number | null;
  creator?: string;
  sessionSlugExplicit?: unknown;
  slug?: string;
}

interface PendingSurveyMetadataEntry extends CacheRecord {
  attempts?: number;
  nextRetryAtMs?: number;
  creationBlock?: number | null;
  state?: string;
  lastStatus?: number | null;
  message?: string;
}

type PendingSurveyMetadataMap = Record<string, PendingSurveyMetadataEntry>;
type SurveyResponsesBySurvey = Record<string, Record<string, unknown>>;
type SurveyResponsesLatestBlock = Record<string, number>;
type SurveysCache = Record<string, SurveyNetworkCache>;
type SurveysCacheAtomicUpdater = (current: SurveysCache | null) => SurveysCache | Promise<SurveysCache>;
type UserCacheAtomicUpdater = (current: UserCache | null) => UserCache | Promise<UserCache>;

interface SurveyNetworkCache extends CacheRecord {
  surveysLatestBlock: number;
  surveys: Record<string, SurveyMetadata>;
  surveyResponses: SurveyResponsesBySurvey;
  surveyResponsesLatestBlock: SurveyResponsesLatestBlock;
  pendingSurveyMetadata: PendingSurveyMetadataMap;
}

interface CreatedSurveyEntry {
  id: string;
  data: SurveyMetadata;
}

interface SurveyResponseUserEntry {
  surveyId: string;
  responder: string;
  response: unknown;
  blockNumber?: number | string | null;
  transactionIndex?: number | string | null;
  logIndex?: number | string | null;
  timestamp?: number | string | null;
}

interface UserDataRecord extends CacheRecord {
  sbts?: unknown[];
  createdSurveys?: CreatedSurveyEntry[];
  createdQuestions?: unknown[];
  surveyResponses?: SurveyResponseUserEntry[];
  questionResponses?: unknown[];
}

interface UserNetworkCache extends CacheRecord {
  lastBlockScanned: number;
  lastScanTimestamp: number;
  data: UserDataRecord;
}

type UserCache = Record<string, Record<string, UserNetworkCache>>;

interface SurveyDiscoveryItem {
  surveyId: string;
  creationBlock: number | null;
}

interface PendingSurveyRetryRow {
  sid: string;
  entry: PendingSurveyMetadataEntry | undefined;
}

interface PendingSurveyRetryResult {
  sid: string;
  entry: PendingSurveyMetadataEntry | undefined;
  surveyData: SurveyMetadata | null;
  skippedCached?: boolean;
  err?: unknown;
}

interface SurveyContractScripts {
  getRelevantBlockWindowForFilter: (sessionRef: unknown) => Promise<{ fromBlock: number; toBlock: number }>;
  getSurveyDataById: (
    providerName: string,
    surveyId: string,
    slug: string,
    opts?: CacheRecord,
  ) => Promise<SurveyMetadata | null>;
  fetchUserSubmittedSurveyIDs: (
    providerName: string,
    fromBlock: number,
    toBlock: number,
    slug: string,
  ) => Promise<SurveyDiscoveryItem[]>;
  fetchAllSurveyResponses: (
    providerName: string,
    surveyId: string,
    startBlock: number,
    latestBlock: number,
    slug: string,
  ) => Promise<unknown>;
  listenForSurveyEvents?: (providerName: string, handler: (event: unknown) => unknown, slug: string) => unknown;
  removeSurveyEventsListener?: (providerName: string, slug: string) => unknown;
}
type SurveyEventStreamsPort = Pick<SbtEventStreamsPort, 'listenForSurveyEvents' | 'removeSurveyEventsListener'>;

export interface SessionSurveyCacheHost {
  [key: string]: unknown;
  setState?: (updater: SetStateArg, cb?: () => void) => void;
  getState?: () => Record<string, unknown>;
  isMounted?: () => boolean;
  dgRead?: (name: string, slug: string) => Record<string, unknown> | null | undefined;
  updateSurveysCacheAtomic: (slug: string, updater: SurveysCacheAtomicUpdater) => Promise<boolean>;
  updateUserCacheAtomic: (slug: string, updater: UserCacheAtomicUpdater) => Promise<boolean>;
  getActiveSessionSlug?: () => string;
  getSessionCfg?: (slug: string) => CacheRecord | null | undefined;
  getSessionChainId?: (slug: string) => string | number | null | undefined;
  getSessionScanScope?: () => string;
  shouldSkipSessionScanForSlug?: (slug: string, op: string, scopeCtx?: unknown) => boolean;
  scanScopeNoop?: (slug: string, op: string, onSkipped?: () => void) => boolean;
  onSurveyEventDetectedForGroup?: (slug: string, event: unknown) => unknown;
  surveyEventStreamsPort?: SurveyEventStreamsPort;
  checkAllCachesReady?: () => void;
  mergeLegacyNumericNetworkKey?: (cache: Record<string, unknown>, networkID: string) => boolean;
  writeSurveyMetadataToCache?: (
    slug: string,
    surveyID: string,
    surveyData: Record<string, unknown>,
    creationBlock: unknown,
    networkID: string,
    opts?: Record<string, unknown>,
  ) => Promise<boolean>;
  queueLocalRevisionUpdate?: (opts?: QueueLocalRevisionUpdateOptions) => void;
}

export interface SessionSurveyCacheController {
  initializeSurveyCacheForGroup: (slug: string, opts?: SurveyInitOptions) => Promise<void>;
  refreshSurveyResponsesByIDForGroup: (slug: string, surveyID: string) => Promise<void>;
  startSurveyAndQuestionEventListener: () => boolean;
  startSurveyAndQuestionEventListenerForGroup: (slugIn?: string | null) => boolean;
  isInitInFlight: (slug: string) => boolean;
  destroy: () => void;
}

const mainSiteLog = createLogger('mainSite');
const surveyContractScripts = contractScripts as unknown as SurveyContractScripts;

class SurveyCachePersistenceError extends Error {}

export const createSessionSurveyCacheController = (host: SessionSurveyCacheHost): SessionSurveyCacheController => {
  let _surveyInitInFlight: Record<string, Promise<void> | undefined> = {};
  let _surveyInitPending: Record<string, SurveyInitOptions | undefined> = {};
  let _pendingSurveyMetadataRetryTimers: Record<string, ReturnType<typeof setTimeout> | undefined> = {};

  const setState = (updater: SetStateArg, cb?: () => void): void => {
    if (typeof host.setState === 'function') {
      host.setState(updater, cb);
      return;
    }
    if (typeof cb === 'function') cb();
  };
  const isMounted = (): boolean => (typeof host.isMounted === 'function' ? host.isMounted() : false);
  const dgRead = (...args: [string, string]): CacheRecord | null =>
    typeof host.dgRead === 'function' ? (host.dgRead(...args) as CacheRecord | null) : null;
  const getActiveSessionSlug = (): string =>
    String(typeof host.getActiveSessionSlug === 'function' ? host.getActiveSessionSlug() || '' : '');
  const getSessionBlockWindowRef = (slugIn: string): CacheRecord | string => {
    const slug = normalizeSessionSlug(slugIn || '');
    const cfg = typeof host.getSessionCfg === 'function' ? host.getSessionCfg(slug) : null;
    if (!cfg || typeof cfg !== 'object') return slug;
    // Regression guard: preserve resolved demo block limits across chain scans.
    return {
      ...cfg,
      slug: normalizeSessionSlug(cfg.slug || slug),
      ...(cfg.blockLimits && typeof cfg.blockLimits === 'object'
        ? { blockLimits: { ...(cfg.blockLimits as CacheRecord) } }
        : {}),
    };
  };
  const getSessionChainId = (slug: string): string | number | null | undefined =>
    typeof host.getSessionChainId === 'function' ? host.getSessionChainId(slug) : null;
  const getSessionScanScope = (): string =>
    String(typeof host.getSessionScanScope === 'function' ? host.getSessionScanScope() || '' : '');
  const scanScopeNoop = (slug: string, op: string, onSkipped?: () => void): boolean =>
    typeof host.scanScopeNoop === 'function' ? host.scanScopeNoop(slug, op, onSkipped) : false;
  const shouldSkipSessionScanForSlug = (slug: string, op: string, scopeCtx?: unknown): boolean =>
    typeof host.shouldSkipSessionScanForSlug === 'function'
      ? host.shouldSkipSessionScanForSlug(slug, op, scopeCtx)
      : false;
  const onSurveyEventDetectedForGroup = (slug: string, event: unknown): unknown =>
    typeof host.onSurveyEventDetectedForGroup === 'function'
      ? host.onSurveyEventDetectedForGroup(slug, event)
      : undefined;
  const checkAllCachesReady = (): void => {
    if (typeof host.checkAllCachesReady === 'function') {
      host.checkAllCachesReady();
    }
  };
  const mergeLegacyNumericNetworkKey = (cache: CacheRecord, networkID: string): boolean =>
    typeof host.mergeLegacyNumericNetworkKey === 'function'
      ? host.mergeLegacyNumericNetworkKey(cache, networkID)
      : false;
  const writeSurveyMetadataToCache = async (
    ...args: [string, string, CacheRecord, unknown, string, CacheRecord?]
  ): Promise<boolean> => {
    try {
      return typeof host.writeSurveyMetadataToCache === 'function'
        ? await host.writeSurveyMetadataToCache(...args)
        : false;
    } catch (error: unknown) {
      if (error instanceof SurveyCachePersistenceError) throw error;
      throw new SurveyCachePersistenceError(
        `Failed to persist surveys cache for ${args[0]}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
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
  const isCacheRecord = (value: unknown): value is CacheRecord =>
    !!value && typeof value === 'object' && !Array.isArray(value);
  const createSurveyNetworkCache = (initialLastBlock: number): SurveyNetworkCache => ({
    surveysLatestBlock: initialLastBlock,
    surveys: {},
    surveyResponses: {},
    surveyResponsesLatestBlock: {},
    pendingSurveyMetadata: {},
  });
  const ensureSurveyNetworkCache = (
    cache: SurveysCache,
    networkID: string,
    initialLastBlock: number,
  ): SurveyNetworkCache => {
    if (!isCacheRecord(cache[networkID])) cache[networkID] = createSurveyNetworkCache(initialLastBlock);
    const networkCache = cache[networkID];
    if (!isCacheRecord(networkCache.surveys)) networkCache.surveys = {};
    if (!isCacheRecord(networkCache.surveyResponses)) networkCache.surveyResponses = {};
    if (!isCacheRecord(networkCache.surveyResponsesLatestBlock)) networkCache.surveyResponsesLatestBlock = {};
    if (!isCacheRecord(networkCache.pendingSurveyMetadata)) networkCache.pendingSurveyMetadata = {};
    networkCache.surveysLatestBlock = Math.max(Number(networkCache.surveysLatestBlock) || 0, initialLastBlock);
    return networkCache;
  };
  const mergeUserDataArray = (
    currentValue: unknown,
    incomingValue: unknown,
    listKey: keyof UserDataRecord,
  ): unknown[] => {
    const current = Array.isArray(currentValue) ? currentValue.slice() : [];
    const incoming = Array.isArray(incomingValue) ? incomingValue : [];
    const keyFor = (item: unknown): string => {
      if (!isCacheRecord(item)) return '';
      const id = item.id ?? item.surveyId ?? item.questionId ?? item.sbtAddress;
      const responder = item.responder ? `:${String(item.responder).toLowerCase()}` : '';
      return id ? `${String(id).toLowerCase()}${responder}` : '';
    };
    const indexes = new Map<string, number>();
    current.forEach((item, index) => {
      const key = keyFor(item);
      if (key) indexes.set(key, index);
    });
    incoming.forEach((item) => {
      const key = keyFor(item);
      if (key && indexes.has(key)) {
        const index = indexes.get(key)!;
        if (listKey === 'surveyResponses' || listKey === 'questionResponses') {
          const existing = isCacheRecord(current[index]) ? current[index] : {};
          const incomingRow = isCacheRecord(item) ? item : {};
          const existingRecency = toResponseRecencyPair(existing, existing.response);
          const incomingRecency = toResponseRecencyPair(incomingRow, incomingRow.response);
          if (isResponseRecencyNewer(incomingRecency, existingRecency)) current[index] = item;
          return;
        }
        current[index] = item;
      } else {
        if (key) indexes.set(key, current.length);
        current.push(item);
      }
    });
    return current;
  };
  const surveyEventStreams = host.surveyEventStreamsPort || sbtEventStreamsPort;

  const isInitInFlight = (slugIn = ''): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    return !!_surveyInitInFlight?.[slug];
  };

  const destroy = (): void => {
    if (_pendingSurveyMetadataRetryTimers && typeof _pendingSurveyMetadataRetryTimers === 'object') {
      Object.values(_pendingSurveyMetadataRetryTimers).forEach((timer) => {
        try {
          clearTimeout(timer);
        } catch (e: unknown) {
          mainSiteLog.warn('MainSite: cleanup', e);
        }
      });
    }
    _pendingSurveyMetadataRetryTimers = {};
    _surveyInitInFlight = {};
    _surveyInitPending = {};
  };

  const mergePendingSurveyInitOpts = (prevOpts: unknown, nextOpts: unknown): SurveyInitOptions => {
    const nextBackground = !!(
      nextOpts &&
      typeof nextOpts === 'object' &&
      (nextOpts as SurveyInitOptions).background === true
    );
    if (!prevOpts || typeof prevOpts !== 'object') return { background: nextBackground };
    const prevBackground = !!((prevOpts as SurveyInitOptions).background === true);
    return { background: prevBackground && nextBackground };
  };

  const initializeSurveyCacheForGroup = (slugIn: string, opts: unknown = {}): Promise<void> => {
    try {
      const slug = normalizeSessionSlug(slugIn || '');
      const suppressUiState = !!(opts && typeof opts === 'object' && (opts as SurveyInitOptions).background === true);
      const rerunOpts: SurveyInitOptions = {
        ...((opts && typeof opts === 'object' ? opts : {}) as SurveyInitOptions),
        background: suppressUiState,
      };
      const setSurveyState = (nextState: SetStateArg, cb?: () => void): void => {
        if (suppressUiState || !isMounted()) return;
        setState(nextState, cb);
      };

      if (
        scanScopeNoop(slug, 'initializeSurveyCacheForGroup', () => {
          setSurveyState({ isSurveyCacheReady: true }, checkAllCachesReady);
        })
      ) {
        return Promise.resolve();
      }

      _surveyInitInFlight = _surveyInitInFlight || {};
      _surveyInitPending = _surveyInitPending || {};
      if (_surveyInitInFlight[slug]) {
        _surveyInitPending[slug] = mergePendingSurveyInitOpts(_surveyInitPending[slug], rerunOpts);
        return _surveyInitInFlight[slug]!;
      }

      const run: Promise<void> = (async (): Promise<void> => {
        mainSiteLog.log('initializeSurveyCacheForGroup() - invoked', { slug });
        setSurveyState((prev) =>
          prev.surveyCacheInitializationError ? { surveyCacheInitializationError: false } : null,
        );
        const networkID = String(getSessionChainId(slug) || '');

        const { fromBlock: baseFrom, toBlock: baseTo } = await surveyContractScripts.getRelevantBlockWindowForFilter(
          getSessionBlockWindowRef(slug),
        );
        if (baseFrom > baseTo) {
          setSurveyState({ isSurveyCacheReady: true }, checkAllCachesReady);
          return;
        }
        const initialLastBlockSurvey = Math.max(0, baseFrom - 1);

        let surveysCache = (dgRead('surveysCache', slug) || {}) as Record<string, SurveyNetworkCache>;
        mergeLegacyNumericNetworkKey(surveysCache, networkID);
        const currentNetworkCache = ensureSurveyNetworkCache(surveysCache, networkID, initialLastBlockSurvey);
        const touchedSurveyMetadata = new Set<string>();
        const deletedSurveyMetadata = new Set<string>();
        const touchedPendingSurveyMetadata = new Set<string>();
        const deletedPendingSurveyMetadata = new Set<string>();
        const touchedUserNodes = new Set<string>();
        const responseDeltas = new Map<
          string,
          {
            preFetchResponses: Record<string, unknown>;
            fetchedResponses: ReturnType<typeof normalizeSurveyResponseBatchResult>['responses'];
            safeResponseWatermark: number;
          }
        >();
        let surveysLatestBlockTouched = false;
        const mergeSurveysCacheDelta = (current: SurveysCache | null): SurveysCache => {
          let next = (isCacheRecord(current) ? current : {}) as SurveysCache;
          mergeLegacyNumericNetworkKey(next, networkID);
          const targetNet = ensureSurveyNetworkCache(next, networkID, initialLastBlockSurvey);
          const sourceNet = ensureSurveyNetworkCache(surveysCache, networkID, initialLastBlockSurvey);
          if (surveysLatestBlockTouched) {
            targetNet.surveysLatestBlock = Math.max(
              Number(targetNet.surveysLatestBlock) || 0,
              Number(sourceNet.surveysLatestBlock) || 0,
              initialLastBlockSurvey,
            );
          }
          touchedSurveyMetadata.forEach((surveyId) => {
            const incoming = sourceNet.surveys[surveyId];
            if (!incoming) return;
            const existing = targetNet.surveys[surveyId];
            const existingBlock = Number(existing?.creationBlock || 0);
            const incomingBlock = Number(incoming.creationBlock || 0);
            if (existing && existingBlock > incomingBlock) return;
            targetNet.surveys[surveyId] = { ...(existing || {}), ...incoming };
          });
          deletedSurveyMetadata.forEach((surveyId) => {
            delete targetNet.surveys[surveyId];
          });
          touchedPendingSurveyMetadata.forEach((surveyId) => {
            const pending = sourceNet.pendingSurveyMetadata[surveyId];
            if (pending) targetNet.pendingSurveyMetadata[surveyId] = pending;
          });
          deletedPendingSurveyMetadata.forEach((surveyId) => {
            delete targetNet.pendingSurveyMetadata[surveyId];
          });
          responseDeltas.forEach((delta, surveyId) => {
            next = mergeSurveyResponseCacheSnapshot({
              currentCache: next,
              networkId: networkID,
              surveyId,
              initialWatermark: initialLastBlockSurvey,
              ...delta,
            });
          });
          return next;
        };
        const persistSurveysCache = async (): Promise<void> => {
          try {
            const persisted = await host.updateSurveysCacheAtomic(slug, mergeSurveysCacheDelta);
            if (!persisted) throw new SurveyCachePersistenceError(`Failed to persist surveys cache for ${slug}`);
          } catch (error: unknown) {
            if (error instanceof SurveyCachePersistenceError) throw error;
            throw new SurveyCachePersistenceError(
              `Failed to persist surveys cache for ${slug}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
          touchedSurveyMetadata.clear();
          deletedSurveyMetadata.clear();
          touchedPendingSurveyMetadata.clear();
          deletedPendingSurveyMetadata.clear();
          responseDeltas.clear();
          surveysLatestBlockTouched = false;
        };
        let lastProcessedSurveyBlock = Number(currentNetworkCache.surveysLatestBlock) || 0;
        if (lastProcessedSurveyBlock < initialLastBlockSurvey) {
          lastProcessedSurveyBlock = initialLastBlockSurvey;
        }
        currentNetworkCache.surveysLatestBlock = lastProcessedSurveyBlock;
        surveysLatestBlockTouched = true;

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

        const cachedSurveyRefreshItems: SurveyDiscoveryItem[] = slug
          ? Object.values(currentNetworkCache.surveys || {})
              .map((survey) => ({
                surveyId: String(survey?.surveyID || survey?.id || '').toLowerCase(),
                creationBlock: Number.isFinite(Number(survey?.creationBlock)) ? Number(survey.creationBlock) : null,
              }))
              .filter(
                (item) =>
                  !!item.surveyId &&
                  !Object.prototype.hasOwnProperty.call(
                    currentNetworkCache.surveys?.[item.surveyId] || {},
                    'sessionSlugExplicit',
                  ),
              )
          : [];

        const latestBlock = baseTo;
        mainSiteLog.log('Latest block number (Surveys, clamped):', latestBlock);

        const fromBlockForSurveyDiscovery = currentNetworkCache.surveysLatestBlock + 1;
        let surveyItems: SurveyDiscoveryItem[] = [];

        const MAX_PENDING_SURVEY_METADATA_ATTEMPTS = 12;
        const MAX_PENDING_SURVEY_COOLDOWN_MS = 5 * 60 * 1000;
        const computeBackoffMs = (attempts: number): number => {
          const n = Math.max(0, Math.min(6, Number(attempts || 0) - 1));
          return Math.min(60000, Math.round(1000 * Math.pow(2, n)));
        };
        const markPendingSurvey = (
          surveyIdLower: string,
          creationBlock: unknown,
          { bumpAttempts = true, error = null }: { bumpAttempts?: boolean; error?: unknown } = {},
        ): void => {
          if (!surveyIdLower) return;
          if (
            typeof currentNetworkCache.pendingSurveyMetadata !== 'object' ||
            !currentNetworkCache.pendingSurveyMetadata
          ) {
            currentNetworkCache.pendingSurveyMetadata = {};
          }
          const slot = currentNetworkCache.pendingSurveyMetadata;
          const prev =
            slot[surveyIdLower] && typeof slot[surveyIdLower] === 'object'
              ? slot[surveyIdLower]
              : { attempts: 0, nextRetryAtMs: 0, creationBlock: null };
          const attempts = bumpAttempts ? Number(prev.attempts || 0) + 1 : Number(prev.attempts || 0);
          const stopDecision = shouldStopPendingMetadataRetry({
            pendingEntry: { ...prev, attempts },
            error,
            maxAttempts: MAX_PENDING_SURVEY_METADATA_ATTEMPTS,
          });
          const failureMeta = normalizeArweaveFailureMeta(error) as CacheRecord;
          const terminalRetryAtMs = Number(failureMeta.nextRetryAtMs || 0);
          if (stopDecision.stop) {
            if (stopDecision.terminal && Number.isFinite(terminalRetryAtMs) && terminalRetryAtMs > Date.now()) {
              slot[surveyIdLower] = {
                attempts,
                nextRetryAtMs: terminalRetryAtMs,
                creationBlock: Number.isFinite(Number(creationBlock))
                  ? Number(creationBlock)
                  : Number(prev.creationBlock) || null,
                state: String(failureMeta.state || 'terminal_not_found'),
                lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
                message: String(failureMeta.message || ''),
              };
              touchedPendingSurveyMetadata.add(surveyIdLower);
              deletedPendingSurveyMetadata.delete(surveyIdLower);
              return;
            }
            if (stopDecision.reachedMaxAttempts && !stopDecision.terminal) {
              const cooldownRetryAtMs = Date.now() + MAX_PENDING_SURVEY_COOLDOWN_MS;
              const externalNextRetryAt = Number(failureMeta.nextRetryAtMs || 0);
              slot[surveyIdLower] = {
                attempts,
                nextRetryAtMs:
                  Number.isFinite(externalNextRetryAt) && externalNextRetryAt > cooldownRetryAtMs
                    ? externalNextRetryAt
                    : cooldownRetryAtMs,
                creationBlock: Number.isFinite(Number(creationBlock))
                  ? Number(creationBlock)
                  : Number(prev.creationBlock) || null,
                state: String(failureMeta.state || 'transient'),
                lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
                message: String(failureMeta.message || ''),
              };
              touchedPendingSurveyMetadata.add(surveyIdLower);
              deletedPendingSurveyMetadata.delete(surveyIdLower);
              mainSiteLog.warn('[MainSite] Pending survey metadata reached max attempts; applying cooldown', {
                group: slug,
                surveyId: surveyIdLower,
                attempts,
                nextRetryAtMs: slot[surveyIdLower].nextRetryAtMs,
              });
              return;
            }
            try {
              delete slot[surveyIdLower];
            } catch (e: unknown) {
              mainSiteLog.warn('MainSite: fallback', e);
            }
            touchedPendingSurveyMetadata.delete(surveyIdLower);
            deletedPendingSurveyMetadata.add(surveyIdLower);
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
            nextRetryAtMs:
              Number.isFinite(externalNextRetryAt) && externalNextRetryAt > computedNextRetryAt
                ? externalNextRetryAt
                : computedNextRetryAt,
            creationBlock: Number.isFinite(Number(creationBlock))
              ? Number(creationBlock)
              : Number(prev.creationBlock) || null,
            state: String(failureMeta.state || 'transient'),
            lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
            message: String(failureMeta.message || ''),
          };
          touchedPendingSurveyMetadata.add(surveyIdLower);
          deletedPendingSurveyMetadata.delete(surveyIdLower);
        };
        const clearPendingSurvey = (surveyIdLower: string): void => {
          try {
            if (currentNetworkCache?.pendingSurveyMetadata?.[surveyIdLower]) {
              delete currentNetworkCache.pendingSurveyMetadata[surveyIdLower];
            }
          } catch (e: unknown) {
            mainSiteLog.warn('MainSite: fallback', e);
          }
          touchedPendingSurveyMetadata.delete(surveyIdLower);
          deletedPendingSurveyMetadata.add(surveyIdLower);
        };
        const pruneLoadedPendingSurveyMetadata = (): number => {
          try {
            const pending = currentNetworkCache?.pendingSurveyMetadata;
            if (!pending || typeof pending !== 'object') return 0;
            const cachedSurveys =
              currentNetworkCache?.surveys && typeof currentNetworkCache.surveys === 'object'
                ? currentNetworkCache.surveys
                : {};
            let removed = 0;
            Object.keys(pending).forEach((sidRaw) => {
              const sid = String(sidRaw || '').toLowerCase();
              if (!sid || !cachedSurveys[sid]) return;
              try {
                delete pending[sidRaw];
                removed += 1;
                touchedPendingSurveyMetadata.delete(sid);
                deletedPendingSurveyMetadata.add(sid);
              } catch (e: unknown) {
                mainSiteLog.warn('MainSite: fallback', e);
              }
            });
            return removed;
          } catch (e: unknown) {
            return 0;
          }
        };
        const prepareScopedSurveyMetadataEntry = (
          surveyIdLower: string,
          surveyData: SurveyMetadata,
          creationBlock: string | number | null | undefined,
        ): { preparedSurveyData: SurveyMetadata; targetSlug: string } => {
          const preparedSurveyData = prepareSurveyMetadataCacheEntry({
            surveyId: surveyIdLower,
            surveyData,
            slug,
            creationBlock,
            enforceScopedIsolation: true,
          }) as SurveyMetadata;
          const targetSlug = String(resolveScopedMetadataSessionSlug(surveyData, slug) || '');
          preparedSurveyData.slug = targetSlug;
          return {
            preparedSurveyData,
            targetSlug,
          };
        };
        const retryPendingSurveyMetadata = async ({
          maxToProcess = 10,
          batchSize = 3,
        }: { maxToProcess?: number; batchSize?: number } = {}): Promise<number> => {
          try {
            const removedStalePending = pruneLoadedPendingSurveyMetadata();
            if (removedStalePending > 0) {
              await persistSurveysCache();
            }
            const pending = currentNetworkCache?.pendingSurveyMetadata;
            if (!pending || typeof pending !== 'object') return 0;
            const now = Date.now();
            const due: PendingSurveyRetryRow[] = Object.keys(pending)
              .map((sid) => ({ sid, entry: pending[sid] }))
              .filter(
                (row) =>
                  row &&
                  row.sid &&
                  !currentNetworkCache?.surveys?.[String(row.sid || '').toLowerCase()] &&
                  Number(row.entry?.nextRetryAtMs || 0) <= now,
              )
              .sort((a, b) => Number(a.entry?.nextRetryAtMs || 0) - Number(b.entry?.nextRetryAtMs || 0))
              .slice(0, Math.max(0, Number(maxToProcess || 0)));
            if (!due.length) return 0;

            mainSiteLog.log(`[MainSite] Retrying ${due.length} pending survey metadata fetch(es) (group=${slug}).`);

            for (let i = 0; i < due.length; i += batchSize) {
              const batch = due.slice(i, i + batchSize);

              const results: PendingSurveyRetryResult[] = await Promise.all(
                batch.map(async ({ sid, entry }) => {
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
                    const surveyData = (await surveyContractScripts.getSurveyDataById('none', sidLower, slug, {
                      throwOnFailure: true,
                    })) as SurveyMetadata;
                    return { sid: sidLower, entry, surveyData };
                  } catch (err: unknown) {
                    return { sid: sidLower, entry, surveyData: null, err };
                  }
                }),
              );

              for (const item of results) {
                const sid = String(item.sid || '').toLowerCase();
                if (!sid) continue;
                if (item.surveyData) {
                  const { preparedSurveyData, targetSlug } = prepareScopedSurveyMetadataEntry(
                    sid,
                    item.surveyData,
                    item.entry?.creationBlock,
                  );
                  if (targetSlug === slug) {
                    currentNetworkCache.surveys[sid] = preparedSurveyData;
                    touchedSurveyMetadata.add(sid);
                    deletedSurveyMetadata.delete(sid);
                  } else {
                    try {
                      delete currentNetworkCache.surveys[sid];
                    } catch (e: unknown) {
                      mainSiteLog.warn('MainSite: fallback', e);
                    }
                    touchedSurveyMetadata.delete(sid);
                    deletedSurveyMetadata.add(sid);
                    const persisted = await writeSurveyMetadataToCache(
                      targetSlug,
                      sid,
                      preparedSurveyData,
                      item.entry?.creationBlock,
                      networkID,
                      { enforceScopedIsolation: true },
                    );
                    if (!persisted) {
                      throw new SurveyCachePersistenceError(`Failed to persist surveys cache for ${targetSlug}`);
                    }
                  }
                  clearPendingSurvey(sid);
                } else {
                  markPendingSurvey(sid, item.entry?.creationBlock, { error: item.err });
                }
              }

              await persistSurveysCache();

              await new Promise<void>((resolve) => setTimeout(resolve, 100));
            }

            return due.length;
          } catch (e: unknown) {
            if (e instanceof SurveyCachePersistenceError) throw e;
            return 0;
          }
        };

        const schedulePendingSurveyMetadataRetry = (): void => {
          try {
            const pending = currentNetworkCache?.pendingSurveyMetadata;
            if (!pending || typeof pending !== 'object') return;

            const entries = Object.values(pending).filter(
              (value): value is PendingSurveyMetadataEntry => !!value && typeof value === 'object',
            );
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
                initializeSurveyCacheForGroup(slug, suppressUiState ? { background: true } : undefined);
              } catch (e: unknown) {
                mainSiteLog.warn('MainSite: fallback', e);
              }
            }, delayMs);
          } catch (e: unknown) {
            mainSiteLog.warn('MainSite: cleanup', e);
          }
        };

        let userCache = (dgRead('userCache', slug) || {}) as UserCache;
        let userCacheModified = false;

        const mergeUserCacheDelta = (current: UserCache | null): UserCache => {
          const next = (isCacheRecord(current) ? current : {}) as UserCache;
          touchedUserNodes.forEach((address) => {
            const sourceNode = userCache[address]?.[networkID];
            if (!sourceNode) return;
            if (!next[address]) next[address] = {};
            const targetNode = next[address][networkID] || {
              lastBlockScanned: 0,
              lastScanTimestamp: 0,
              data: {
                sbts: [],
                createdSurveys: [],
                createdQuestions: [],
                surveyResponses: [],
                questionResponses: [],
              },
            };
            const targetData = isCacheRecord(targetNode.data) ? targetNode.data : {};
            const sourceData = isCacheRecord(sourceNode.data) ? sourceNode.data : {};
            next[address][networkID] = {
              ...targetNode,
              lastBlockScanned: Math.max(
                Number(targetNode.lastBlockScanned) || 0,
                Number(sourceNode.lastBlockScanned) || 0,
              ),
              lastScanTimestamp: Math.max(
                Number(targetNode.lastScanTimestamp) || 0,
                Number(sourceNode.lastScanTimestamp) || 0,
              ),
              data: {
                ...targetData,
                createdSurveys: mergeUserDataArray(
                  targetData.createdSurveys,
                  sourceData.createdSurveys,
                  'createdSurveys',
                ),
                surveyResponses: mergeUserDataArray(
                  targetData.surveyResponses,
                  sourceData.surveyResponses,
                  'surveyResponses',
                ),
              },
            } as UserNetworkCache;
          });
          return next;
        };
        const persistUserCache = async (): Promise<void> => {
          if (!userCacheModified) return;
          try {
            const persisted = await host.updateUserCacheAtomic(slug, mergeUserCacheDelta);
            if (!persisted) throw new SurveyCachePersistenceError(`Failed to persist user cache for ${slug}`);
          } catch (error: unknown) {
            if (error instanceof SurveyCachePersistenceError) throw error;
            throw new SurveyCachePersistenceError(
              `Failed to persist user cache for ${slug}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        };

        const ensureUserNode = (addr: string, block: number): UserDataRecord => {
          const lower = addr.toLowerCase();
          if (!userCache[lower]) userCache[lower] = {};
          if (!userCache[lower][networkID]) {
            userCache[lower][networkID] = {
              lastBlockScanned: block,
              lastScanTimestamp: Math.floor(Date.now() / 1000),
              data: {
                sbts: [],
                createdSurveys: [],
                createdQuestions: [],
                surveyResponses: [],
                questionResponses: [],
              },
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

        try {
          await retryPendingSurveyMetadata();

          if (fromBlockForSurveyDiscovery <= latestBlock) {
            mainSiteLog.log(
              `Fetching survey IDs from block ${fromBlockForSurveyDiscovery} to ${latestBlock} (group=${slug})`,
            );
            surveyItems = (await surveyContractScripts.fetchUserSubmittedSurveyIDs(
              'none',
              fromBlockForSurveyDiscovery,
              latestBlock,
              slug,
            )) as SurveyDiscoveryItem[];
          } else {
            mainSiteLog.log('No new blocks to fetch survey IDs from.');
          }

          surveyItems = [...cachedSurveyRefreshItems, ...(Array.isArray(surveyItems) ? surveyItems : [])];

          if (surveyItems && surveyItems.length > 0) {
            for (const item of surveyItems) {
              const surveyID = item.surveyId.toLowerCase();
              const creationBlock = item.creationBlock;
              const existingSurvey = currentNetworkCache.surveys[surveyID];
              const needsBindingRefresh =
                !!slug &&
                !!existingSurvey &&
                !Object.prototype.hasOwnProperty.call(existingSurvey, 'sessionSlugExplicit');

              if (!existingSurvey || needsBindingRefresh) {
                let surveyData: SurveyMetadata | null = null;
                let surveyFetchErr: unknown = null;
                try {
                  surveyData = (await surveyContractScripts.getSurveyDataById('none', surveyID, slug, {
                    throwOnFailure: true,
                  })) as SurveyMetadata;
                } catch (e: unknown) {
                  surveyFetchErr = e;
                  surveyData = null;
                }
                if (surveyData) {
                  const { preparedSurveyData, targetSlug } = prepareScopedSurveyMetadataEntry(
                    surveyID,
                    surveyData,
                    creationBlock,
                  );
                  if (targetSlug === slug) {
                    currentNetworkCache.surveys[surveyID] = preparedSurveyData;
                    touchedSurveyMetadata.add(surveyID);
                    deletedSurveyMetadata.delete(surveyID);
                  } else {
                    try {
                      delete currentNetworkCache.surveys[surveyID];
                    } catch (e: unknown) {
                      mainSiteLog.warn('MainSite: fallback', e);
                    }
                    touchedSurveyMetadata.delete(surveyID);
                    deletedSurveyMetadata.add(surveyID);
                    const persisted = await writeSurveyMetadataToCache(
                      targetSlug,
                      surveyID,
                      preparedSurveyData,
                      creationBlock,
                      networkID,
                      { enforceScopedIsolation: true },
                    );
                    if (!persisted) {
                      throw new SurveyCachePersistenceError(`Failed to persist surveys cache for ${targetSlug}`);
                    }
                  }
                  clearPendingSurvey(surveyID);

                  if (targetSlug === slug && preparedSurveyData.creator) {
                    const uData = ensureUserNode(preparedSurveyData.creator, latestBlock);
                    if (!uData.createdSurveys) uData.createdSurveys = [];
                    if (!uData.createdSurveys.some((survey) => survey.id === surveyID)) {
                      uData.createdSurveys.push({ id: surveyID, data: preparedSurveyData });
                      userCacheModified = true;
                      touchedUserNodes.add(String(preparedSurveyData.creator).toLowerCase());
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
            latestBlock,
          );
          surveysLatestBlockTouched = true;
          await persistSurveysCache();

          for (const surveyID in currentNetworkCache.surveys) {
            const surveyIDLower = surveyID.toLowerCase();
            const surveyObj = currentNetworkCache.surveys[surveyID];
            const surveyResponseLastBlock = Object.prototype.hasOwnProperty.call(
              currentNetworkCache.surveyResponsesLatestBlock,
              surveyIDLower,
            )
              ? currentNetworkCache.surveyResponsesLatestBlock[surveyIDLower]
              : initialLastBlockSurvey;

            const startBlock = Math.max(
              surveyResponseLastBlock + 1,
              Number(surveyObj?.creationBlock || 0),
              initialLastBlockSurvey,
            );

            if (latestBlock >= startBlock) {
              mainSiteLog.log(
                `Fetching/updating responses for survey ${surveyIDLower}, from block ${startBlock} up to ${latestBlock} (group=${slug})`,
              );
              try {
                const preFetchResponses = { ...(currentNetworkCache.surveyResponses[surveyIDLower] || {}) };
                const surveyResponseBatch = normalizeSurveyResponseBatchResult(
                  await surveyContractScripts.fetchAllSurveyResponses(
                    'none',
                    surveyIDLower,
                    startBlock,
                    latestBlock,
                    slug,
                  ),
                );

                if (!currentNetworkCache.surveyResponses[surveyIDLower]) {
                  currentNetworkCache.surveyResponses[surveyIDLower] = {};
                }
                for (const item of surveyResponseBatch.responses) {
                  const responderAddr = item.responder.toLowerCase();
                  currentNetworkCache.surveyResponses[surveyIDLower][responderAddr] = item.response;

                  const uData = ensureUserNode(responderAddr, latestBlock);
                  if (!uData.surveyResponses) uData.surveyResponses = [];
                  const nextUserResponse: SurveyResponseUserEntry = {
                    surveyId: surveyIDLower,
                    responder: responderAddr,
                    response: item.response,
                    blockNumber: item.blockNumber,
                    transactionIndex: item.transactionIndex ?? item.txIndex ?? item.txi,
                    logIndex: item.logIndex,
                    timestamp: item.timestamp,
                  };
                  const existingResponseIndex = uData.surveyResponses.findIndex(
                    (response) => response.surveyId === surveyIDLower,
                  );
                  if (existingResponseIndex === -1) {
                    uData.surveyResponses.push(nextUserResponse);
                    userCacheModified = true;
                    touchedUserNodes.add(responderAddr);
                  } else {
                    const existingResponse = uData.surveyResponses[existingResponseIndex];
                    if (
                      isResponseRecencyNewer(
                        toResponseRecencyPair(nextUserResponse, nextUserResponse.response),
                        toResponseRecencyPair(existingResponse, existingResponse.response),
                      )
                    ) {
                      uData.surveyResponses[existingResponseIndex] = {
                        ...existingResponse,
                        ...nextUserResponse,
                      };
                      userCacheModified = true;
                      touchedUserNodes.add(responderAddr);
                    }
                  }
                }
                currentNetworkCache.surveyResponsesLatestBlock[surveyIDLower] = resolveSurveyResponseWatermark({
                  startBlock,
                  latestBlock,
                  hadPartialFailure: surveyResponseBatch.hadPartialFailure,
                  lowestFailedBlock: surveyResponseBatch.lowestFailedBlock,
                });
                responseDeltas.set(surveyIDLower, {
                  preFetchResponses,
                  fetchedResponses: surveyResponseBatch.responses,
                  safeResponseWatermark: currentNetworkCache.surveyResponsesLatestBlock[surveyIDLower],
                });
              } catch (error: unknown) {
                mainSiteLog.warn('Error fetching survey responses; leaving watermark unchanged', {
                  slug,
                  surveyID: surveyIDLower,
                  startBlock,
                  latestBlock,
                  error,
                });
              }
            }
          }

          await persistSurveysCache();

          if (userCacheModified) {
            await persistUserCache();
          }

          schedulePendingSurveyMetadataRetry();

          mainSiteLog.log('Surveys cache initialized or updated (group-aware).');
        } catch (error: unknown) {
          mainSiteLog.error('Error fetching surveys or responses (group-aware):', error);
          setSurveyState({ surveyCacheInitializationError: true });
          if (error instanceof SurveyCachePersistenceError) throw error;
          await persistSurveysCache();
          if (userCacheModified) await persistUserCache();
        }
      })();

      const finalizeRun = (): void => {
        delete _surveyInitInFlight[slug];
        if (_surveyInitPending[slug]) {
          const pendingOpts = _surveyInitPending[slug];
          delete _surveyInitPending[slug];
          setTimeout(() => {
            try {
              if (!isMounted()) return;
              initializeSurveyCacheForGroup(slug, pendingOpts || rerunOpts);
            } catch (e: unknown) {
              mainSiteLog.warn('MainSite: fallback', e);
            }
          }, 0);
        }
      };

      const flight = run.finally(finalizeRun);
      _surveyInitInFlight[slug] = flight;
      return flight;
    } catch (err: unknown) {
      return Promise.reject(err);
    }
  };

  const startSurveyAndQuestionEventListenerForGroup = (slugIn: string | null = ''): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    mainSiteLog.log('startSurveyAndQuestionEventListenerForGroup() – Setting up survey & question events listener', {
      slug,
    });
    surveyEventStreams.removeSurveyEventsListener('none', slug);
    if (shouldSkipSessionScanForSlug(slug, 'startSurveyAndQuestionEventListenerForGroup')) return false;
    surveyEventStreams.listenForSurveyEvents(
      'none',
      (event: unknown) => onSurveyEventDetectedForGroup(slug, event),
      slug,
    );
    mainSiteLog.log('Survey & Question event listener started');
    return true;
  };

  const startSurveyAndQuestionEventListener = (): boolean =>
    startSurveyAndQuestionEventListenerForGroup(getActiveSessionSlug());

  const refreshSurveyResponsesByIDForGroup = async (slugIn: string, surveyID: string): Promise<void> => {
    const slug = normalizeSessionSlug(slugIn || '');
    mainSiteLog.log('refreshSurveyResponsesByIDForGroup() for surveyID:', surveyID, 'slug:', slug);
    const netId = String(getSessionChainId(slug) || '');
    if (!netId) {
      mainSiteLog.warn('No group chainId available');
      return;
    }
    const { fromBlock: baseFrom, toBlock: baseTo } = await surveyContractScripts.getRelevantBlockWindowForFilter(
      getSessionBlockWindowRef(slug),
    );
    const initialLastBlockSurvey = Math.max(0, baseFrom - 1);
    const surveysCache = (dgRead('surveysCache', slug) || {}) as Record<string, SurveyNetworkCache>;

    if (!surveysCache[netId]) {
      surveysCache[netId] = {
        surveysLatestBlock: initialLastBlockSurvey,
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
        pendingSurveyMetadata: {},
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
    const preFetchSurveyResponses = surveysCache[netId].surveyResponses[surveyIDLower] || {};
    const currentLocalBlock = Object.prototype.hasOwnProperty.call(
      surveysCache[netId].surveyResponsesLatestBlock,
      surveyIDLower,
    )
      ? surveysCache[netId].surveyResponsesLatestBlock[surveyIDLower]
      : initialLastBlockSurvey;

    const latestChainBlock = baseTo;
    const startBlock = Math.max(currentLocalBlock + 1, Number(surveyObj?.creationBlock || 0), initialLastBlockSurvey);

    if (startBlock > latestChainBlock) {
      mainSiteLog.log('Survey responses are already up-to-date for surveyID:', surveyIDLower);
      return;
    }

    mainSiteLog.log(
      `Fetching new responses for surveyID ${surveyIDLower} from block ${startBlock} to ${latestChainBlock} (group=${slug})`,
    );
    const surveyResponseBatch = normalizeSurveyResponseBatchResult(
      await surveyContractScripts.fetchAllSurveyResponses('none', surveyIDLower, startBlock, latestChainBlock, slug),
    );

    const safeResponseWatermark = resolveSurveyResponseWatermark({
      startBlock,
      latestBlock: latestChainBlock,
      hadPartialFailure: surveyResponseBatch.hadPartialFailure,
      lowestFailedBlock: surveyResponseBatch.lowestFailedBlock,
    });
    const persisted = await host.updateSurveysCacheAtomic(slug, (current) =>
      mergeSurveyResponseCacheSnapshot({
        currentCache: current || {},
        networkId: netId,
        surveyId: surveyIDLower,
        initialWatermark: initialLastBlockSurvey,
        preFetchResponses: preFetchSurveyResponses,
        fetchedResponses: surveyResponseBatch.responses,
        safeResponseWatermark,
      }),
    );
    if (!persisted) {
      throw new Error(`Failed to persist survey responses for ${surveyIDLower}`);
    }
    mainSiteLog.log('Survey responses updated for surveyID:', surveyIDLower);
    queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
  };

  return {
    initializeSurveyCacheForGroup,
    refreshSurveyResponsesByIDForGroup,
    startSurveyAndQuestionEventListener,
    startSurveyAndQuestionEventListenerForGroup,
    isInitInFlight,
    destroy,
  };
};
