import type { SbtCountMap, SbtCountState, SbtCountsPayload, SbtCountsPayloadInput } from './sbtCountHelpers.js';
import type { SbtHistorySummary } from './sbtHistoryHelpers.js';
import type { SbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';
import type { SbtEventStreamsPort } from '../../domains/sbts/sbtPorts.js';

type CacheRecord = Record<string, unknown>;
type SetStateArg = CacheRecord | ((prev: CacheRecord) => CacheRecord | null) | null;

export interface SbtLiveProgressPatch extends CacheRecord {
  currentBlock?: number;
  latestBlock?: number;
  slug?: string;
  updatedAtMs?: number;
}

export interface SbtDiscoveryOptions extends CacheRecord {
  force?: boolean;
  forceExactSlugs?: boolean;
  forceScopeSlug?: string;
}

export interface SbtCacheInitOptions extends CacheRecord {
  background?: boolean;
  mode?: 'auto' | 'partial' | 'full';
}

export interface SbtRefreshOptions extends CacheRecord {
  forceCounts?: boolean;
  onCheckpoint?: (checkpoint: CacheRecord) => void;
}

export interface RemoveSbtRealtimeListenersOptions {
  removeFactory?: boolean;
  removeInstance?: boolean;
}

export interface SbtRealtimeEventLike extends CacheRecord {
  blockNumber?: number | string | null;
  logIndex?: number | string | null;
  sbtAddress?: string | null;
  to?: string | null;
  transactionIndex?: number | string | null;
  type?: string | null;
}

export interface SessionSbtCacheHost {
  [key: string]: unknown;
  checkAllCachesReady?: () => void;
  dgKey?: (...args: unknown[]) => unknown;
  dgRead?: (...args: unknown[]) => unknown;
  dgWrite?: (...args: unknown[]) => unknown;
  getAccount?: () => string | null | undefined;
  getActiveSessionSlug?: () => string | null | undefined;
  getCurrentPath?: () => string | null | undefined;
  getEffectiveRoutePath?: (pathIn?: string) => string;
  getScopeFilteredSlugs?: (slugs: string[], scope?: string) => string[];
  getScopedSessionSlugs?: (scope?: string) => string[];
  getSessionCfg?: (slug: string) => CacheRecord | null | undefined;
  getSessionChainId?: (slug: string) => string | number | null | undefined;
  getSessionScanScope?: () => string | null | undefined;
  getSessionScanScopeContext?: (scope?: string) => unknown;
  eventStreamsPort?: SbtEventStreamsPort;
  initializeSurveyCacheForGroup?: (...args: unknown[]) => unknown;
  isMounted?: () => boolean;
  isSbtHistoryScanEnabled?: () => boolean;
  isSbtInstanceListenerEnabledForGroup?: (slug: string) => boolean;
  logScopeSkipOnce?: (op: string, slug: string, scopeCtx?: unknown) => void;
  mergeLegacyNumericNetworkKey?: (cache: CacheRecord, networkID: string) => boolean;
  queueLocalRevisionUpdate?: (opts?: CacheRecord) => void;
  readFlag?: (flag: string, slug: string) => boolean;
  refreshEncryptedQuestionPayloadsForGroup?: (slug: string, opts?: CacheRecord) => Promise<unknown>;
  runWithGeneralSessionBackfill?: (opts: CacheRecord) => Promise<unknown>;
  scanScopeNoop?: (slug: string, op: string, onSkipped?: () => void) => boolean;
  setReadinessStateIfChanged?: (patch: CacheRecord, cb?: () => void) => unknown;
  setState?: (updater: SetStateArg, cb?: () => void) => void;
  shouldAttachSbtDetailInstanceListener?: () => boolean;
  shouldAutoRunFullSbtScan?: (opts?: CacheRecord) => boolean;
  shouldSkipSessionScanForSlug?: (slug: string, op: string, scopeCtx?: unknown) => boolean;
  sbtEventStreamsPort?: SbtEventStreamsPort;
  writeFlag?: (flag: string, slug: string, value: unknown) => void;
}

export interface SessionSbtCacheController {
  beginSbtLiveProgress: (slugIn: string, initialPatch?: SbtLiveProgressPatch) => number;
  updateSbtLiveProgress: (
    slugIn: string,
    token: number | null,
    nextPatch?: SbtLiveProgressPatch,
    options?: { force?: boolean },
  ) => boolean;
  clearSbtLiveProgress: (slugIn: string, token?: number | null) => void;
  setSbtRealtimeCoverageForGroup: (slugIn: string, hasCoverage?: boolean) => void;
  clearSbtRealtimeCoverageForGroup: (slugIn: string) => void;
  normalizeSbtRealtimeEventCursor: (value?: unknown) => SbtRealtimeEventCursor | null;
  compareSbtRealtimeEventCursor: (leftIn?: unknown, rightIn?: unknown) => number;
  removeSbtRealtimeListenersForGroup: (slugIn: string, options?: RemoveSbtRealtimeListenersOptions) => void;
  ensureSessionRouteSbtDiscovery: (slugIn?: string | null) => Promise<void> | null;
  ensureLightSbtDiscovery: (slugIn?: string | null, opts?: SbtDiscoveryOptions) => Promise<void>;
  ensureLightSbtUniverse: (slugsIn?: string[] | null, opts?: SbtDiscoveryOptions) => Promise<void>;
  mergeSbtCountMaps: (base?: Record<string, unknown> | null, delta?: Record<string, unknown> | null) => SbtCountMap;
  mergeSbtCountsPayload: (
    base?: Partial<SbtCountsPayloadInput>,
    delta?: Partial<SbtCountsPayloadInput>,
  ) => SbtCountsPayload;
  normalizeSbtHistorySummary: (summaryIn: unknown) => SbtHistorySummary | null;
  normalizeSbtCountMap: (value?: Record<string, unknown> | null) => SbtCountMap;
  sumSbtCountMap: (value?: Record<string, unknown> | null) => number;
  seedSbtCountMapFromLegacyAddresses: (
    countMapIn?: Record<string, unknown> | null,
    addresses?: Array<string | null | undefined> | null,
  ) => SbtCountMap;
  hydrateLegacySbtCountState: (entry?: SbtCountState | null) => SbtCountState | null;
  buildSbtHistorySummaryFromCounts: (counts?: Partial<SbtCountsPayloadInput> | null) => SbtHistorySummary | null;
  getCurrentHolderAddressesFromCounts: (counts?: Partial<SbtCountsPayloadInput>) => string[];
  initializeSbtCache: (options?: SbtCacheInitOptions) => Promise<void>;
  initializeSbtCacheWithGeneralBackfill: (slugIn?: string | null, options?: SbtCacheInitOptions) => Promise<unknown>;
  initializeSbtCacheForGroup: (slugIn?: string | null, options?: SbtCacheInitOptions) => Promise<void>;
  refreshSbtData: (sbtAddressParam?: string | null, slug?: string | null, options?: SbtRefreshOptions) => Promise<void>;
  refreshSbtDataForGroup: (
    slug?: string | null,
    sbtAddressParam?: string | null,
    options?: SbtRefreshOptions,
  ) => Promise<void>;
  startSbtEventListener: () => void;
  startSbtEventListenerForGroup: (slugIn?: string | null) => void;
  startSbtDetailInstanceListenerForGroup: (
    slugIn?: string | null,
    addressesIn?: Array<string | null | undefined> | string | null,
  ) => boolean;
  onNewSbtEventDetected: (event?: SbtRealtimeEventLike | null) => Promise<void>;
  onNewSbtEventDetectedForGroup: (slug?: string | null, event?: SbtRealtimeEventLike | null) => Promise<void>;
  onSbtCreatedDetected: (
    sbtAddressOriginalCase?: string | null,
    eventBlockNumber?: number | string | null,
  ) => Promise<void>;
  onSbtCreatedDetectedForGroup: (
    slug?: string | null,
    sbtAddressOriginalCase?: string | null,
    eventBlockNumber?: number | string | null,
    eventCursor?: SbtRealtimeEventCursor | null,
  ) => Promise<void>;
  onSbtIssuedDetected: (
    sbtAddressOriginalCase?: string | null,
    toAddressOriginalCase?: string | null,
    eventBlockNumber?: number | string | null,
  ) => Promise<void>;
  onSbtIssuedDetectedForGroup: (
    slug?: string | null,
    sbtAddressOriginalCase?: string | null,
    toAddressOriginalCase?: string | null,
    eventBlockNumber?: number | string | null,
  ) => Promise<void>;
  onSbtActivityDetected: (
    sbtAddressOriginalCase?: string | null,
    accountOriginalCase?: string | null,
    burned?: boolean,
    eventBlockNumber?: number | string | null,
  ) => Promise<void>;
  onSbtActivityDetectedForGroup: (
    slug?: string | null,
    sbtAddressOriginalCase?: string | null,
    accountOriginalCase?: string | null,
    burned?: boolean,
    eventBlockNumber?: number | string | null,
    eventCursor?: SbtRealtimeEventCursor | null,
  ) => Promise<void>;
  onSbtTransferDetected: (
    sbtAddressOriginalCase?: string | null,
    fromAddressOriginalCase?: string | null,
    eventBlockNumber?: number | string | null,
  ) => Promise<void>;
  onSbtTransferDetectedForGroup: (
    slug?: string | null,
    sbtAddressOriginalCase?: string | null,
    fromAddressOriginalCase?: string | null,
    eventBlockNumber?: number | string | null,
  ) => Promise<void>;
  destroy: () => void;
}
