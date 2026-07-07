/** @file SBTsList */

import React, { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react';
import contractScripts, {
  getAllSessionEntries,
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionConfigBySlug,
  getSessionLists,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
import styles from './SBTsList.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSync, faTrash, faPlus, faCog } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';
import SBTPage from './SBTPage';
import CreateGroup from './CreateSBTGroup';
import TagModal from '../TagPage/TagModal';
import SbtListSessionUniversePanel from './SbtListSessionUniversePanel';
import { SbtListDetailsPanel, SbtListMetaRow } from './SbtListCardChrome';
import { SbtListCompactLinkCard, SbtListStandardCard } from './SbtListDisplayCards';
import {
  SbtListInitialLoader,
  SbtListSectionBody,
  SbtListSectionLoadingHint,
  SbtListSectionTitle,
} from './SbtListSectionChrome';
import { ethers } from 'ethers';
import { createLogger } from '../../utilities/logging.js';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  readCache,
  removeCache,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import { SESSION_REGISTRY_CACHE_UPDATED_EVENT, sessionRegistryStore } from '../../utilities/web3/sessionRegistry.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import {
  GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
  readStoredGlobalSessionSelection,
} from '../../utilities/session/globalSessionState.js';
import { hasUsableSessionWorkerConfig } from '../../utilities/session/sessionWorkerAvailability.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/sbtCreateFormCache.js';
import { getSbtDescriptionText, getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { readPublicUrlBasePath, stripPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { bindSbtListRuntimePorts } from './sbtListRuntimePorts';
import {
  filterSessionUniverseEntriesByDemoVisibility,
  getCustomDemoSessionEntries,
  mergeSessionUniverseEntriesBySlug,
} from './sbtSessionUniverse.js';
import { getDemoSessionMap } from '../../utilities/session/sessionDemoCompat.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  areSbtListArraysEqual,
  buildSbtListDetailHref,
  buildSbtListDisplayCardModel,
  buildSbtListExpandedAddressSetToggle,
  buildSbtListExpandedCardShellClassName,
  buildSbtListFeaturedCardModel,
  buildSbtListFilterContainerClassName,
  buildSbtListFilterLabelClassName,
  findSbtListInteractiveAncestor,
  buildSbtListInteractiveMiniCardModel,
  buildSbtListCacheReadPlan,
  buildSbtListChipLoadingStatusBySlug,
  buildSbtListChipProgressDesiredVisibilityBySlug,
  buildSbtListInitialLoaderStatuses,
  buildSbtListMetaRowModel,
  buildSbtListMiniSettingsButtonClassName,
  buildSbtListRealtimeProgressInputPlan,
  buildSbtListRenderItemKey,
  buildSbtListRenderBuckets,
  buildSbtListRootClassName,
  buildSbtListPassiveLatestLookupPlan,
  buildSbtListSessionRouteHref,
  buildSbtListSessionSelectorOptions,
  buildSbtListSessionChipStateBySlug,
  buildSbtListSessionLoadingStatus,
  buildSbtListSessionProgressSnapshot,
  coerceSbtMintEndSeconds,
  collectSbtListLinkedScopedEntries,
  dedupeNormalizedSbtListSlugs,
  getSbtCardDetails,
  getVisibleSbtListSessionSlugsFromEntries,
  mergeSbtListsByAddress,
  hasSbtListExplicitNoSessionAssociation,
  hasSbtListMissingOrEmptySessionSlug,
  isModifiedSbtListPointerNavigation,
  isSbtListManagedDgCacheName,
  normalizeSbtListAddressLower,
  readSbtListShowDemoSessions,
  readSbtListUniverseCollapsedState,
  readSbtListSyncBarResearchBlockStep,
  readSbtListCacheMetaSnapshot,
  readStoredSbtListModeSelectedSessionSlugs,
  resolveSbtListConcreteSessionBindingSlug,
  resolveSbtListActionableSessionSlugs,
  resolveSbtListChipSelectedSessionSlugs,
  resolveSbtListChipProgressVisibilityPlan,
  resolveSbtListClampedSelectedSessionSlugs,
  resolveSbtListDefaultSelectedSessionSlugs,
  resolveSbtListDisplayedSessionUniverseSlugs,
  resolveSbtListHiddenRegistrySessionSlugs,
  resolveSbtListItemSessionSlug,
  resolveSbtListHeaderBlocksLeftStyle,
  resolveSbtListHeaderSpinnerWrapStyle,
  resolveSbtListRemainingHiddenRegistrySessionSlugs,
  resolveSbtListReadinessDisplayPlan,
  resolveSbtListRealtimeProgressRetentionPlan,
  resolveSbtListSelectedSessionUniverseSlugs,
  resolveSbtListSelectedHiddenRegistrySessionSlugs,
  resolveSbtListSectionLoadingState,
  resolveSbtListSectionSessionSlugs,
  resolveSbtListSessionUniverseSnapshotUpdate,
  resolveSbtListCreateGroupInitialVisibility,
  resolveSbtListRelativeImageStyle,
  resolveSbtListRegistryRetryPlan,
  SBT_LIST_MODE_SELECTION_STORAGE_KEY,
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
  isSbtListSyntheticNoSessionSlug,
  resolveSbtListSessionSelectorSummarySlugs,
} from './sbtListHelpers';
import type {
  SbtListChipProgressBooleanBySlug,
  SbtListChipProgressVisibilityMeta,
  SbtCacheMetaSnapshot,
  SbtCardDetails,
  SbtListHelperItem,
  SbtPassiveLatestLookupInFlightBySlug,
  SbtPassiveLatestLookupStateBySlug,
  SbtListRealtimeProgressBySlug,
  SbtListRealtimeProgressRecord,
  SbtListScopedEntryOptions,
  SbtListSessionChipStateBySlug,
  SbtListSessionLoadingStatus,
  SbtListSessionLoadingStatusBySlug,
  SbtListSessionLoadingStatusOptions,
  SbtListSessionProgressSnapshot,
  SbtListSessionUniverseSnapshot,
} from './sbtListHelpers';

const sbtLog = createLogger('sbt');
type UnknownRecord = Record<string, unknown>;
type SbtListMetadata = UnknownRecord & {
  chainID?: unknown;
  chainId?: unknown;
  description?: unknown;
  image?: unknown;
  name?: unknown;
  sessionName?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
  title?: unknown;
  tokenURI?: unknown;
  tokenUri?: unknown;
};
type SbtListItem = SbtListHelperItem & {
  blockNumber?: unknown;
  burnedAddresses?: unknown;
  defaultSbtTags?: unknown;
  docURLs?: unknown;
  documentURLs?: unknown;
  documentUrls?: unknown;
  documents?: unknown;
  featuredSbtTags?: unknown;
  historySummary?: UnknownRecord & {
    currentHolderCount?: unknown;
    historicalHolderCount?: unknown;
  };
  mintedAddresses?: unknown;
  sbtAddress?: unknown;
  sbtInfo?: SbtListMetadata;
  sessionName?: unknown;
  sessionSlug?: unknown;
  sessionSlugExplicit?: unknown;
  slug?: unknown;
  __sourceSessionSlug?: unknown;
};
type SbtListPointerEventLike = {
  altKey?: boolean;
  button?: number;
  ctrlKey?: boolean;
  currentTarget?: EventTarget | null;
  defaultPrevented?: boolean;
  metaKey?: boolean;
  preventDefault?: () => void;
  shiftKey?: boolean;
  stopPropagation?: () => void;
  target?: EventTarget | null;
};
type SbtSessionUniverseSnapshot = SbtListSessionUniverseSnapshot;
type SbtListLiveProgress = SbtListRealtimeProgressRecord;
type SbtListBySlug = Record<string, SbtListItem[] | undefined>;
type SbtListLiveProgressBySlug = SbtListRealtimeProgressBySlug;
type SbtListBooleanBySlug = Record<string, boolean | undefined>;
type SbtListLoadState = 'idle' | 'loading' | 'loaded' | 'error';
type SbtListLoadStateBySlug = Record<string, SbtListLoadState | undefined>;
type SbtListFetchRunBySlug = Record<string, number | undefined>;
type SbtSessionDisplayConfig = UnknownRecord & {
  blockLimits?: UnknownRecord & {
    start?: unknown;
  };
  sessionName?: string;
};
type SbtSessionProgressSnapshot = SbtListSessionProgressSnapshot;
type SbtSessionLoadingOptions = SbtListSessionLoadingStatusOptions;
type SbtSessionLoadingStatus = SbtListSessionLoadingStatus;
type SbtSessionLoadingStatusBySlug = SbtListSessionLoadingStatusBySlug;
type SbtSessionChipStateBySlug = SbtListSessionChipStateBySlug;
type SbtListInitDeps = {
  listSlug: string;
  allSessionsMode: boolean;
  selectedSessionSignature: string;
  universeSignature: string;
  sessionUniverseRegistryPending: boolean;
  sbtCacheRevision: number;
};
type SbtListFetchSBTs = (
  forceRefresh?: boolean,
  showLoadingIndicator?: boolean,
  slugOverride?: unknown,
  options?: {
    markSessionLoading?: boolean;
  },
) => Promise<boolean>;
type SbtListChipProgressMeta = SbtListChipProgressVisibilityMeta;
type SbtListChipProgressMetaBySlug = Record<string, SbtListChipProgressMeta | undefined>;
type SbtListGroupPasswordMap = Record<string, boolean | undefined>;
type SbtListPasswordFlagResult = [string, boolean];
type SbtListNetwork = UnknownRecord & {
  id?: unknown;
};
type SbtLightDiscoveryOptions = {
  force?: boolean;
  forceScopeSlug?: string;
};
type SbtUniverseDiscoveryOptions = {
  force?: boolean;
};
type SBTsListProps = {
  account?: unknown;
  litHooks?: unknown;
  allSessionsMode?: boolean;
  communityTabCompactSettings?: boolean;
  embeddedMode?: boolean;
  ensureLightSbtDiscovery?: (slug: string, options?: SbtLightDiscoveryOptions) => Promise<unknown> | unknown;
  ensureLightSbtUniverse?: (slugs: string[], options?: SbtUniverseDiscoveryOptions) => Promise<unknown> | unknown;
  interactiveMiniCards?: boolean;
  isSBTCacheReady?: boolean;
  latestBlockNumber?: unknown;
  loginComplete?: unknown;
  miniaturized?: boolean;
  network?: SbtListNetwork | null;
  onNavigateToSbt?: (sbtAddress: string, href: string) => void;
  onRequestSbtCacheRefresh?: () => void;
  provider?: unknown;
  refreshSbtData?: unknown;
  refreshSessionUniverseRegistryCache?: () => Promise<unknown> | unknown;
  sbtCacheRevision?: unknown;
  sbtRealtimeCoverageBySlug?: SbtListBooleanBySlug | UnknownRecord;
  sbtScanProgressBySlug?: SbtListLiveProgressBySlug | UnknownRecord;
  sessionSlug?: unknown;
  toggleLoginModal?: unknown;
  viewMode?: 'standard' | 'modal' | string;
};
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';
const isSbtListPointerEventLike = (value: unknown): value is SbtListPointerEventLike =>
  !!value && typeof value === 'object';
const sbtListRuntimePorts = bindSbtListRuntimePorts({
  contractScripts: () => contractScripts,
  hasCachedCreateSbtForm: () => hasCachedCreateSbtForm,
});
const DEMO_SESSION_MAP = getDemoSessionMap();

const SBT_LIVE_PROGRESS_BRIDGE_MS = 2500;
const SBT_LIVE_PROGRESS_BRIDGE_TAIL_BLOCKS = 5;
const SBT_CHIP_PROGRESS_VISIBILITY_MIN_INTERVAL_MS = 5000;
const FEATURED_CARD_INTERACTIVE_SELECTOR = [
  'button',
  'a',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="link"]',
  '[data-featured-card-ignore-nav="true"]',
].join(', ');

const getVisibleSessionSlugsFromEntries = (entries: unknown = []): string[] =>
  getVisibleSbtListSessionSlugsFromEntries(entries, { demoSessionMap: DEMO_SESSION_MAP });

export const __test__areSbtListArraysEqual = areSbtListArraysEqual;

export const __test__getSbtCardDetails = getSbtCardDetails;

export const __test__buildSbtRenderBuckets = buildSbtListRenderBuckets;

export { readSbtListCacheMetaSnapshot as readSbtCacheMetaSnapshot };

const SBTsList = ({
  provider,
  network,
  account,
  litHooks,
  sessionSlug,
  loginComplete,
  miniaturized,
  toggleLoginModal,
  viewMode = 'standard',
  sbtCacheRevision,
  onRequestSbtCacheRefresh,
  isSBTCacheReady,
  refreshSbtData,
  latestBlockNumber, // used to show "Blocks left"
  allSessionsMode: allSessionsModeProp,
  sbtScanProgressBySlug = {},
  sbtRealtimeCoverageBySlug = {},
  /* Discovery orchestrated by MainSite */
  ensureLightSbtDiscovery,
  ensureLightSbtUniverse,
  refreshSessionUniverseRegistryCache,
  onNavigateToSbt,
  /* Embedded mode suppresses header and featured section to avoid duplication in SBTsPage */
  embeddedMode = false,
  communityTabCompactSettings = false,
  interactiveMiniCards = false,
}: SBTsListProps) => {
  const routeSlug = normalizeSessionSlug(sessionSlug || '');
  // Determine if we should enumerate ALL groups (route-based fallback + explicit prop)
  const allSessionsMode = useMemo(() => {
    if (allSessionsModeProp) return true;
    try {
      const path =
        typeof window !== 'undefined' && window.location && window.location.pathname ? window.location.pathname : '';
      const parts = stripPublicUrlBasePath(path).split('/').filter(Boolean);
      return (parts[0] === 'sbts' || parts[0] === 'groups') && parts.length === 1;
    } catch (_) {
      return false;
    }
  }, [allSessionsModeProp]);

  const [globalSessionSelectionRevision, setGlobalSessionSelectionRevision] = useState<number>(0);
  const [sessionConfigRevision, setSessionConfigRevision] = useState<number>(0);
  const [activeTag, setActiveTag] = useState<string>('');
  const [activeSessionSlug, setActiveGroupSlug] = useState<string>(() => {
    const globalPrimarySessionSlug = normalizeSessionSlug(readStoredGlobalSessionSelection().primarySessionSlug || '');
    try {
      if (typeof window === 'undefined' || !window.localStorage) return normalizeSessionSlug(routeSlug);
      const stored = window.localStorage.getItem('dg:lastActiveSbtSession');
      if (stored != null) return normalizeSessionSlug(stored);
    } catch (e) {
      sbtLog.warn('SBTsList: fallback', e);
    }
    if (globalPrimarySessionSlug) return globalPrimarySessionSlug;
    return normalizeSessionSlug(routeSlug);
  });

  const shouldExpectRegistryUniverse = true;

  const readSessionUniverseSnapshot = useCallback((): SbtSessionUniverseSnapshot => {
    const allEntries = getAllSessionEntries();
    const showDemoSessions = readSbtListShowDemoSessions();
    const customDemoEntries = getCustomDemoSessionEntries(DEMO_SESSION_MAP);
    let registryEntryCount = 0;
    let registryEntries: unknown[] = [];
    try {
      registryEntries = sessionRegistryStore.getAllSessionEntries();
      registryEntryCount = Array.isArray(registryEntries) ? registryEntries.length : 0;
    } catch (_) {
      registryEntryCount = 0;
    }
    const fallbackEntries = Array.isArray(allEntries) ? allEntries : [];
    const visibleFallbackEntries = filterSessionUniverseEntriesByDemoVisibility(fallbackEntries, showDemoSessions, {
      demoSessionMap: DEMO_SESSION_MAP,
    });
    const fallbackEntryCount = Array.isArray(fallbackEntries) ? fallbackEntries.length : 0;
    const entriesForUniverse = shouldExpectRegistryUniverse
      ? registryEntryCount > 0
        ? mergeSessionUniverseEntriesBySlug([registryEntries, customDemoEntries], {
            demoSessionMap: DEMO_SESSION_MAP,
          })
        : visibleFallbackEntries
      : visibleFallbackEntries;
    const slugs = getVisibleSessionSlugsFromEntries(entriesForUniverse);
    const cache = sessionRegistryStore.readCache();
    const registryHydrated = !!(
      cache &&
      cache.__hadLoadErrors !== true &&
      (typeof cache.__hadLoadErrors === 'boolean' || Object.keys(cache.sessions || {}).length > 0)
    );
    return { slugs, registryEntryCount, fallbackEntryCount, registryHydrated };
  }, [shouldExpectRegistryUniverse]);

  const syncSessionUniverseFromCache = useCallback(() => {
    const next = readSessionUniverseSnapshot();
    setAvailableSessionUniverse((prev) => {
      return resolveSbtListSessionUniverseSnapshotUpdate({
        nextSnapshot: next,
        previousSnapshot: prev,
      });
    });
    return next;
  }, [readSessionUniverseSnapshot]);

  const [availableSessionUniverse, setAvailableSessionUniverse] = useState<SbtSessionUniverseSnapshot>(() =>
    readSessionUniverseSnapshot(),
  );
  const [showMoreSessions, setShowMoreSessions] = useState<boolean>(false);
  const [showMoreSessionsLoading, setShowMoreSessionsLoading] = useState<boolean>(false);
  const [hasNoSessionUniverseItems, setHasNoSessionUniverseItems] = useState<boolean>(false);
  const availableSessionSlugs = availableSessionUniverse.slugs;
  const registryEntryCount = Number(availableSessionUniverse.registryEntryCount || 0);
  const fallbackEntryCount = Number(availableSessionUniverse.fallbackEntryCount || 0);
  const registryHydrated = !!availableSessionUniverse.registryHydrated;
  const sessionUniverseRegistryPending =
    allSessionsMode && shouldExpectRegistryUniverse && registryEntryCount <= 0 && !registryHydrated;

  const isListModeScopeEnabled = useMemo(() => {
    void globalSessionSelectionRevision;
    return allSessionsMode && readSessionScanScope() === 'list';
  }, [allSessionsMode, globalSessionSelectionRevision]);

  const listModeConfiguredSessionSlugs = useMemo<string[]>(() => {
    void globalSessionSelectionRevision;
    return isListModeScopeEnabled ? dedupeNormalizedSbtListSlugs(readSessionScanSlugs()) : [];
  }, [globalSessionSelectionRevision, isListModeScopeEnabled]);
  const listModeConfiguredSessionSlugSet = useMemo(
    () => new Set(listModeConfiguredSessionSlugs),
    [listModeConfiguredSessionSlugs],
  );

  const registrySessionUniverseSlugs = useMemo<string[]>(() => {
    const snapshot = availableSessionUniverse;
    if (!snapshot) return [];
    try {
      const registryEntries = sessionRegistryStore.getAllSessionEntries();
      return getVisibleSessionSlugsFromEntries(registryEntries);
    } catch (_) {
      return [];
    }
  }, [availableSessionUniverse]);

  const baseSessionUniverseSlugs = useMemo<string[]>(
    () => (!isListModeScopeEnabled ? availableSessionSlugs : listModeConfiguredSessionSlugs),
    [availableSessionSlugs, isListModeScopeEnabled, listModeConfiguredSessionSlugs],
  );

  const [selectedSessionSlugs, setSelectedSessionSlugs] = useState<string[]>(() =>
    dedupeNormalizedSbtListSlugs(readStoredSbtListModeSelectedSessionSlugs()),
  );

  const hiddenRegistrySessionSlugs = useMemo<string[]>(() => {
    return resolveSbtListHiddenRegistrySessionSlugs({
      availableSessionSlugs,
      baseSessionUniverseSlugs,
      isListModeScopeEnabled,
      registrySessionUniverseSlugs,
    });
  }, [availableSessionSlugs, baseSessionUniverseSlugs, isListModeScopeEnabled, registrySessionUniverseSlugs]);

  const selectedHiddenRegistrySessionSlugs = useMemo<string[]>(() => {
    return resolveSbtListSelectedHiddenRegistrySessionSlugs({
      hiddenRegistrySessionSlugs,
      isListModeScopeEnabled,
      selectedSessionSlugs,
    });
  }, [hiddenRegistrySessionSlugs, isListModeScopeEnabled, selectedSessionSlugs]);

  const remainingHiddenRegistrySessionSlugs = useMemo<string[]>(() => {
    return resolveSbtListRemainingHiddenRegistrySessionSlugs({
      hiddenRegistrySessionSlugs,
      isListModeScopeEnabled,
      selectedHiddenRegistrySessionSlugs,
    });
  }, [hiddenRegistrySessionSlugs, isListModeScopeEnabled, selectedHiddenRegistrySessionSlugs]);

  const displayedSessionUniverseSlugs = useMemo<string[]>(() => {
    return resolveSbtListDisplayedSessionUniverseSlugs({
      allSessionsMode,
      availableSessionSlugs,
      baseSessionUniverseSlugs,
      hasNoSessionUniverseItems,
      hiddenRegistrySessionSlugs,
      isListModeScopeEnabled,
      selectedHiddenRegistrySessionSlugs,
      showMoreSessions,
    });
  }, [
    allSessionsMode,
    availableSessionSlugs,
    baseSessionUniverseSlugs,
    hasNoSessionUniverseItems,
    hiddenRegistrySessionSlugs,
    isListModeScopeEnabled,
    selectedHiddenRegistrySessionSlugs,
    showMoreSessions,
  ]);

  const displayedSessionUniverseSlugsNormalized = useMemo(
    () => dedupeNormalizedSbtListSlugs(displayedSessionUniverseSlugs),
    [displayedSessionUniverseSlugs],
  );

  const defaultListModeSelectedSessionSlugs = useMemo<string[]>(() => {
    return resolveSbtListDefaultSelectedSessionSlugs({
      displayedSessionUniverseSlugs: displayedSessionUniverseSlugsNormalized,
      isListModeScopeEnabled,
      listModeConfiguredSessionSlugs,
    });
  }, [displayedSessionUniverseSlugsNormalized, isListModeScopeEnabled, listModeConfiguredSessionSlugs]);

  const selectedSessionUniverseSlugs = useMemo<string[]>(() => {
    return resolveSbtListSelectedSessionUniverseSlugs({
      allSessionsMode,
      defaultListModeSelectedSessionSlugs,
      displayedSessionUniverseSlugs: displayedSessionUniverseSlugsNormalized,
      isListModeScopeEnabled,
      selectedSessionSlugs,
    });
  }, [
    allSessionsMode,
    defaultListModeSelectedSessionSlugs,
    displayedSessionUniverseSlugsNormalized,
    isListModeScopeEnabled,
    selectedSessionSlugs,
  ]);

  const selectedSessionUniverseSlugSet = useMemo(
    () => new Set(selectedSessionUniverseSlugs),
    [selectedSessionUniverseSlugs],
  );

  useEffect(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) return;
    if (!displayedSessionUniverseSlugsNormalized.length) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          SBT_LIST_MODE_SELECTION_STORAGE_KEY,
          JSON.stringify(dedupeNormalizedSbtListSlugs(selectedSessionSlugs)),
        );
      }
    } catch (e) {
      sbtLog.warn('SBTsList: fallback', e);
    }
  }, [allSessionsMode, displayedSessionUniverseSlugsNormalized.length, isListModeScopeEnabled, selectedSessionSlugs]);

  useEffect(() => {
    if (isListModeScopeEnabled) return;
    if (showMoreSessions) setShowMoreSessions(false);
    if (showMoreSessionsLoading) setShowMoreSessionsLoading(false);
  }, [isListModeScopeEnabled, showMoreSessions, showMoreSessionsLoading]);

  useEffect(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) {
      listModeUniverseRefreshRequestedRef.current = false;
      return;
    }
    if (!displayedSessionUniverseSlugsNormalized.length) return;
    setSelectedSessionSlugs((prev) =>
      resolveSbtListClampedSelectedSessionSlugs({
        availableSessionSlugs,
        displayedSessionUniverseSlugs: displayedSessionUniverseSlugsNormalized,
        hiddenRegistrySessionSlugs,
        listModeConfiguredSessionSlugs,
        registrySessionUniverseSlugs,
        selectedSessionSlugs: prev,
      }),
    );
  }, [
    allSessionsMode,
    availableSessionSlugs,
    displayedSessionUniverseSlugsNormalized,
    hiddenRegistrySessionSlugs,
    isListModeScopeEnabled,
    listModeConfiguredSessionSlugs,
    registrySessionUniverseSlugs,
  ]);

  useEffect(() => {
    if (!allSessionsMode || !isListModeScopeEnabled || !sessionUniverseRegistryPending) {
      listModeUniverseRefreshRequestedRef.current = false;
    }
  }, [allSessionsMode, isListModeScopeEnabled, sessionUniverseRegistryPending]);

  useEffect(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) return;
    if (!sessionUniverseRegistryPending) return;
    if (listModeUniverseRefreshRequestedRef.current) return;
    if (typeof refreshSessionUniverseRegistryCache !== 'function') return;
    listModeUniverseRefreshRequestedRef.current = true;

    void (async () => {
      try {
        await refreshSessionUniverseRegistryCache();
      } catch (e) {
        sbtLog.warn('SBTsList: fallback', e);
      } finally {
        if (isMounted.current) {
          syncSessionUniverseFromCache();
        }
      }
    })();
  }, [
    allSessionsMode,
    isListModeScopeEnabled,
    refreshSessionUniverseRegistryCache,
    sessionUniverseRegistryPending,
    syncSessionUniverseFromCache,
  ]);

  useEffect(() => {
    if (!allSessionsMode) return undefined;
    syncSessionUniverseFromCache();
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
      return undefined;
    }
    const handleRegistryCacheUpdated = () => {
      if (!isMounted.current) return;
      setSessionConfigRevision((value) => value + 1);
      syncSessionUniverseFromCache();
    };
    const handleGlobalSessionSelectionUpdated = () => {
      if (!isMounted.current) return;
      setGlobalSessionSelectionRevision((value) => value + 1);
    };
    window.addEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, handleRegistryCacheUpdated);
    window.addEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, handleGlobalSessionSelectionUpdated);
    return () => {
      window.removeEventListener(SESSION_REGISTRY_CACHE_UPDATED_EVENT, handleRegistryCacheUpdated);
      window.removeEventListener(GLOBAL_SESSION_SELECTION_UPDATED_EVENT, handleGlobalSessionSelectionUpdated);
    };
  }, [allSessionsMode, sbtCacheRevision, syncSessionUniverseFromCache]);

  useEffect(() => {
    if (!allSessionsMode || !sessionUniverseRegistryPending) return undefined;
    let cancelled = false;
    let attempt = 0;
    const maxAttempts = 4;
    let retryTimerId: ReturnType<typeof setTimeout> | null = null;
    const runRetry = () => {
      if (cancelled || !isMounted.current) return;
      const next = syncSessionUniverseFromCache();
      const retryPlan = resolveSbtListRegistryRetryPlan({
        attempt,
        maxAttempts,
        shouldExpectRegistryUniverse,
        snapshot: next,
      });
      if (!retryPlan.shouldSchedule || retryPlan.delayMs == null) return;
      attempt = retryPlan.nextAttempt;
      retryTimerId = setTimeout(runRetry, retryPlan.delayMs);
    };
    runRetry();
    return () => {
      cancelled = true;
      if (retryTimerId) clearTimeout(retryTimerId);
    };
  }, [allSessionsMode, sessionUniverseRegistryPending, shouldExpectRegistryUniverse, syncSessionUniverseFromCache]);

  useEffect(() => {
    if (!allSessionsMode) return;
    if (!displayedSessionUniverseSlugs.length) {
      if (activeSessionSlug !== '') setActiveGroupSlug('');
      return;
    }
    if (!displayedSessionUniverseSlugs.includes(activeSessionSlug)) {
      const fallback = displayedSessionUniverseSlugs.includes(routeSlug)
        ? routeSlug
        : displayedSessionUniverseSlugs[0] || '';
      if (fallback !== activeSessionSlug) setActiveGroupSlug(fallback);
    }
  }, [allSessionsMode, activeSessionSlug, displayedSessionUniverseSlugs, routeSlug]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (!allSessionsMode) {
          window.localStorage.removeItem('dg:lastActiveSbtSession');
          return;
        }
        const globalPrimarySessionSlug = normalizeSessionSlug(
          readStoredGlobalSessionSelection().primarySessionSlug || '',
        );
        if (activeSessionSlug && activeSessionSlug !== globalPrimarySessionSlug) {
          window.localStorage.setItem('dg:lastActiveSbtSession', activeSessionSlug);
        } else {
          window.localStorage.removeItem('dg:lastActiveSbtSession');
        }
      }
    } catch (e) {
      sbtLog.warn('SBTsList: fallback', e);
    }
  }, [activeSessionSlug, allSessionsMode]);

  useEffect(() => {
    if (allSessionsMode) return;
    if (activeSessionSlug !== routeSlug) {
      setActiveGroupSlug(routeSlug);
    }
  }, [allSessionsMode, activeSessionSlug, routeSlug]);

  useEffect(() => {
    if (!allSessionsMode) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedLocalOverride = window.localStorage.getItem('dg:lastActiveSbtSession');
        if (storedLocalOverride != null) return;
      }
    } catch (e) {
      sbtLog.warn('SBTsList: fallback', e);
    }
    const nextPrimary = normalizeSessionSlug(readStoredGlobalSessionSelection().primarySessionSlug || '');
    const nextTargetSlug = displayedSessionUniverseSlugs.includes(nextPrimary)
      ? nextPrimary
      : displayedSessionUniverseSlugs[0] || '';
    if (nextTargetSlug !== activeSessionSlug) {
      setActiveGroupSlug(nextTargetSlug);
    }
  }, [activeSessionSlug, allSessionsMode, displayedSessionUniverseSlugs, globalSessionSelectionRevision]);

  const listSlug = allSessionsMode
    ? displayedSessionUniverseSlugs.includes(activeSessionSlug)
      ? activeSessionSlug
      : displayedSessionUniverseSlugs[0] || ''
    : routeSlug;

  const sectionSessionSlugs = useMemo(() => {
    return resolveSbtListSectionSessionSlugs({
      allSessionsMode,
      isListModeScopeEnabled,
      listSlug,
      selectedSessionUniverseSlugs,
    });
  }, [allSessionsMode, isListModeScopeEnabled, listSlug, selectedSessionUniverseSlugs]);

  const actionableUniverseSessionSlugs = useMemo(
    () => resolveSbtListActionableSessionSlugs(displayedSessionUniverseSlugs),
    [displayedSessionUniverseSlugs],
  );

  const actionableSectionSessionSlugs = useMemo(
    () => resolveSbtListActionableSessionSlugs(sectionSessionSlugs),
    [sectionSessionSlugs],
  );

  const resolvedListSlugForGroupLists = isSbtListSyntheticNoSessionSlug(listSlug) ? '' : listSlug;
  const groupListRevision = Number(sbtCacheRevision || 0);
  const { featured_SBTs_LIST = [], ignored_SBTs_LIST = [] } = useMemo(() => {
    void groupListRevision;
    return getSessionLists(resolvedListSlugForGroupLists);
  }, [groupListRevision, resolvedListSlugForGroupLists]);

  const [sbtListBySlug, setSbtListBySlug] = useState<SbtListBySlug>({});
  const [sessionLoadStateBySlug, setSessionLoadStateBySlug] = useState<SbtListLoadStateBySlug>({});
  const [sessionHasLoadedOnceBySlug, setSessionHasLoadedOnceBySlug] = useState<SbtListBooleanBySlug>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [revisionSyncPending, setRevisionSyncPending] = useState<boolean>(false);

  const [excludePasswordLocked, setExcludePasswordLocked] = useState<boolean>(false);
  const [showCreateGroup, setShowCreateGroup] = useState<boolean>(() =>
    resolveSbtListCreateGroupInitialVisibility({
      hasCachedCreateSbtForm: sbtListRuntimePorts.hasCachedCreateSbtForm,
      listSlug,
    }),
  );
  const [showAdminButtons, setShowAdminButtons] = useState<boolean>(false);
  const [showLocalSessionSettings, setShowLocalSessionSettings] = useState<boolean>(false);
  const [expandedSbtAddresses, setExpandedSbtAddresses] = useState<Set<string>>(() => new Set());
  const [isUniverseCollapsed, setIsUniverseCollapsed] = useState<boolean>(() => readSbtListUniverseCollapsedState());

  /** tracks addresses with a non-zero on-chain groupPasswordHash (unlimited group-password mint) */
  const [groupPasswordMap, setGroupPasswordMap] = useState<SbtListGroupPasswordMap>({});

  const [latestBlockBySlug, setLatestBlockBySlug] = useState<Record<string, number>>({});
  const [chipProgressVisibilityBySlug, setChipProgressVisibilityBySlug] = useState<SbtListBooleanBySlug>({});
  const [sessionCacheMetaBySlug, setSessionCacheMetaBySlug] = useState<
    Record<string, SbtCacheMetaSnapshot | undefined>
  >({});
  const [emptySectionSpinnerActive, setEmptySectionSpinnerActive] = useState<boolean>(false);
  const [recentLiveProgressNowMs, setRecentLiveProgressNowMs] = useState<number>(() => Date.now());

  const isMounted = useRef<boolean>(true);
  const refreshSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emptySectionSpinnerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentLiveProgressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sessionFetchRunBySlugRef = useRef<SbtListFetchRunBySlug>({});
  const sessionHasLoadedOnceRef = useRef<SbtListBooleanBySlug>(sessionHasLoadedOnceBySlug);
  const sbtListBySlugRef = useRef<SbtListBySlug>(sbtListBySlug);
  const listModeUniverseRefreshRequestedRef = useRef<boolean>(false);
  const recentLiveProgressBySlugRef = useRef<SbtListLiveProgressBySlug>({});
  const chipProgressVisibilityMetaRef = useRef<SbtListChipProgressMetaBySlug>({});
  const chipProgressDesiredBySlugRef = useRef<SbtListBooleanBySlug>({});
  const passiveLatestLookupStateBySlugRef = useRef<SbtPassiveLatestLookupStateBySlug>({});
  const passiveLatestLookupInFlightBySlugRef = useRef<SbtPassiveLatestLookupInFlightBySlug>({});

  /** tracks if the component has *ever* completed a successful load */
  const initialLoadCompletedRef = useRef<boolean>(false);

  const lastInitDepsRef = useRef<SbtListInitDeps>({
    listSlug: listSlug,
    allSessionsMode: allSessionsMode,
    selectedSessionSignature: '',
    universeSignature: '',
    sessionUniverseRegistryPending: false,
    sbtCacheRevision: Number(sbtCacheRevision || 0),
  });
  const ensureLightSbtDiscoveryRef = useRef<SBTsListProps['ensureLightSbtDiscovery']>(ensureLightSbtDiscovery);
  ensureLightSbtDiscoveryRef.current = ensureLightSbtDiscovery;
  const fetchSBTsRef = useRef<SbtListFetchSBTs | null>(null);

  const clearRefreshSafetyTimeout = useCallback(() => {
    if (refreshSafetyTimeoutRef.current) {
      clearTimeout(refreshSafetyTimeoutRef.current);
      refreshSafetyTimeoutRef.current = null;
    }
  }, []);

  const clearEmptySectionSpinnerTimeout = useCallback(() => {
    if (emptySectionSpinnerTimeoutRef.current) {
      clearTimeout(emptySectionSpinnerTimeoutRef.current);
      emptySectionSpinnerTimeoutRef.current = null;
    }
  }, []);

  const clearRecentLiveProgressTimeout = useCallback(() => {
    if (recentLiveProgressTimeoutRef.current) {
      clearTimeout(recentLiveProgressTimeoutRef.current);
      recentLiveProgressTimeoutRef.current = null;
    }
  }, []);

  const usesTopLevelSessionSettingsSurface =
    allSessionsMode &&
    ((!miniaturized && !embeddedMode) || (miniaturized && viewMode === 'modal' && communityTabCompactSettings));
  const usesFallbackSessionSettingsToggle = allSessionsMode && !usesTopLevelSessionSettingsSurface;
  const isSessionSelectorOpen = usesTopLevelSessionSettingsSurface ? showAdminButtons : showLocalSessionSettings;
  const sessionSelectorPanelId = 'session-selector-panel';
  const hideSessionUniverseSummary = !!(miniaturized && viewMode === 'modal' && communityTabCompactSettings);

  const clearChipProgressVisibilityTimeout = useCallback((slugIn: unknown): void => {
    const slug = normalizeSessionSlug(slugIn || '');
    const meta = chipProgressVisibilityMetaRef.current[slug];
    if (!meta?.timerId) return;
    clearTimeout(meta.timerId);
    chipProgressVisibilityMetaRef.current[slug] = {
      ...meta,
      timerId: null,
    };
  }, []);

  const clearAllChipProgressVisibilityTimeouts = useCallback(() => {
    Object.keys(chipProgressVisibilityMetaRef.current || {}).forEach((slug) => {
      clearChipProgressVisibilityTimeout(slug);
    });
  }, [clearChipProgressVisibilityTimeout]);

  useEffect(() => {
    return () => {
      clearRefreshSafetyTimeout();
      clearEmptySectionSpinnerTimeout();
      clearRecentLiveProgressTimeout();
      clearAllChipProgressVisibilityTimeouts();
    };
  }, [
    clearAllChipProgressVisibilityTimeouts,
    clearEmptySectionSpinnerTimeout,
    clearRecentLiveProgressTimeout,
    clearRefreshSafetyTimeout,
  ]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('dg:sbtUniverseCollapsed', isUniverseCollapsed ? 'true' : 'false');
      }
    } catch (e) {
      sbtLog.warn('SBTsList: fallback', e);
    }
  }, [isUniverseCollapsed]);

  useEffect(() => {
    sessionHasLoadedOnceRef.current = sessionHasLoadedOnceBySlug;
  }, [sessionHasLoadedOnceBySlug]);

  useEffect(() => {
    sbtListBySlugRef.current = sbtListBySlug;
  }, [sbtListBySlug]);

  const hasNoSessionCards = useMemo(
    () =>
      Object.values(sbtListBySlug).some(
        (list) =>
          Array.isArray(list) &&
          list.some(
            (item) =>
              hasSbtListExplicitNoSessionAssociation(item) ||
              (allSessionsMode && isListModeScopeEnabled && hasSbtListMissingOrEmptySessionSlug(item)),
          ),
      ),
    [allSessionsMode, isListModeScopeEnabled, sbtListBySlug],
  );

  useEffect(() => {
    if (!allSessionsMode) {
      if (hasNoSessionUniverseItems) setHasNoSessionUniverseItems(false);
      return;
    }
    setHasNoSessionUniverseItems((prev) => (prev === hasNoSessionCards ? prev : hasNoSessionCards));
  }, [allSessionsMode, hasNoSessionCards, hasNoSessionUniverseItems]);

  useLayoutEffect(() => {
    const nowMs = Date.now();
    const inputPlan = buildSbtListRealtimeProgressInputPlan({
      nowMs,
      progressBySlug: sbtScanProgressBySlug,
    });
    Object.entries(inputPlan.updatesBySlug).forEach(([slug, progress]) => {
      if (!progress) return;
      recentLiveProgressBySlugRef.current[slug] = {
        ...recentLiveProgressBySlugRef.current[slug],
        ...progress,
      };
    });

    const retentionPlan = resolveSbtListRealtimeProgressRetentionPlan({
      activeSlugs: inputPlan.validSlugs,
      bridgeMs: SBT_LIVE_PROGRESS_BRIDGE_MS,
      nowMs,
      progressBySlug: recentLiveProgressBySlugRef.current,
    });
    if (retentionPlan.changed) {
      recentLiveProgressBySlugRef.current = retentionPlan.nextProgressBySlug;
    }
  }, [sbtScanProgressBySlug]);

  useEffect(() => {
    clearRecentLiveProgressTimeout();

    const nowMs = Date.now();
    const inputPlan = buildSbtListRealtimeProgressInputPlan({
      nowMs,
      progressBySlug: sbtScanProgressBySlug,
    });
    const retentionPlan = resolveSbtListRealtimeProgressRetentionPlan({
      activeSlugs: inputPlan.propSlugs,
      bridgeMs: SBT_LIVE_PROGRESS_BRIDGE_MS,
      nowMs,
      progressBySlug: recentLiveProgressBySlugRef.current,
    });
    if (retentionPlan.changed) {
      recentLiveProgressBySlugRef.current = retentionPlan.nextProgressBySlug;
      setRecentLiveProgressNowMs(nowMs);
    }

    if (retentionPlan.nextPruneAtMs == null) return undefined;
    recentLiveProgressTimeoutRef.current = setTimeout(
      () => {
        const nextNowMs = Date.now();
        const nextRetentionPlan = resolveSbtListRealtimeProgressRetentionPlan({
          activeSlugs: inputPlan.propSlugs,
          bridgeMs: SBT_LIVE_PROGRESS_BRIDGE_MS,
          nowMs: nextNowMs,
          progressBySlug: recentLiveProgressBySlugRef.current,
        });
        if (nextRetentionPlan.changed) {
          recentLiveProgressBySlugRef.current = nextRetentionPlan.nextProgressBySlug;
          setRecentLiveProgressNowMs(nextNowMs);
        }
      },
      Math.max(0, retentionPlan.nextPruneAtMs - nowMs) + 10,
    );

    return clearRecentLiveProgressTimeout;
  }, [clearRecentLiveProgressTimeout, sbtScanProgressBySlug]);

  const getDisplaySessionConfig = useCallback((slugIn: unknown) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return null;
    return getSessionConfigBySlug(slug) || getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) || null;
  }, []);

  const getDisplaySessionChainId = useCallback(
    (slugIn: unknown): string => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return '';
      try {
        const chainId = getSessionChainId(slug);
        if (chainId) return String(chainId);
      } catch (_) {}
      const cfg = getDisplaySessionConfig(slug);
      const fallbackChainId =
        Number(
          cfg?.networkChainId ||
            cfg?.chainId ||
            (isRecord(cfg?.contracts) &&
              ((isRecord(cfg.contracts.sbtFactory) && cfg.contracts.sbtFactory.chainId) ||
                (isRecord(cfg.contracts.surveys) && cfg.contracts.surveys.chainId))) ||
            0,
        ) || 0;
      return fallbackChainId ? String(fallbackChainId) : '';
    },
    [getDisplaySessionConfig],
  );

  const labelForSessionSlug = useCallback(
    (slugIn: unknown): string => {
      const normalized = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(normalized)) return 'No Session';
      if (!normalized) return 'General';
      const cfg = getDisplaySessionConfig(normalized);
      return cfg?.sessionName || normalized;
    },
    [getDisplaySessionConfig],
  );

  const embeddedCreateGroupLockGateSources = useMemo(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) return [];
    return dedupeNormalizedSbtListSlugs(selectedSessionUniverseSlugs)
      .filter((slug) => !isSbtListSyntheticNoSessionSlug(slug))
      .map((slug) => {
        const sessionConfig = getDisplaySessionConfig(slug);
        if (!sessionConfig || typeof sessionConfig !== 'object') return null;
        return {
          sessionSlug: slug,
          sessionConfig,
        };
      })
      .filter(Boolean);
  }, [allSessionsMode, getDisplaySessionConfig, isListModeScopeEnabled, selectedSessionUniverseSlugs]);

  // Derive netKey from group config (not wallet) - helper used for cache watermark UI
  const deriveGroupNetKey = useCallback(
    (slugIn: unknown): string => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return '';
      return getDisplaySessionChainId(slug);
    },
    [getDisplaySessionChainId],
  );

  const deriveCacheNetKeyForSlug = useCallback(
    (slugIn: unknown): string => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return '';
      const displayChainId = getDisplaySessionChainId(slug);
      if (displayChainId) return displayChainId;
      return String(network?.id || '');
    },
    [getDisplaySessionChainId, network?.id],
  );

  const getCacheReadSlugsForTarget = useCallback(
    (slugIn: unknown): string[] => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return [];
      const slugs: string[] = [slug];
      if (slug) {
        const displayConfig = getDisplaySessionConfig(slug);
        const hasCanonicalConfigSlug =
          isRecord(displayConfig) && Object.prototype.hasOwnProperty.call(displayConfig, 'slug');
        const canonicalConfigSlug = hasCanonicalConfigSlug ? normalizeSessionSlug(displayConfig.slug ?? '') : slug;
        if (hasCanonicalConfigSlug && canonicalConfigSlug !== slug) {
          slugs.push(canonicalConfigSlug);
        }
      }
      return dedupeNormalizedSbtListSlugs(slugs);
    },
    [getDisplaySessionConfig],
  );

  const formatBlockCount = useCallback((value: unknown): string => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString() : '-';
  }, []);

  const updateSessionCacheMeta = useCallback(
    (slugIn: unknown, metaIn: Partial<SbtCacheMetaSnapshot> | null = null): void => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (!slug && slug !== '') return;
      if (!metaIn || typeof metaIn !== 'object') return;

      const nextMeta: SbtCacheMetaSnapshot = {
        lastBlock: Math.max(0, Number(metaIn?.lastBlock || 0)),
        sbtCount: Math.max(0, Number(metaIn?.sbtCount || 0)),
      };

      setSessionCacheMetaBySlug((prev) => {
        const existing = prev[slug];
        if (
          existing &&
          Number(existing.lastBlock || 0) === nextMeta.lastBlock &&
          Number(existing.sbtCount || 0) === nextMeta.sbtCount
        ) {
          return prev;
        }
        return { ...prev, [slug]: nextMeta };
      });
    },
    [],
  );

  const readSbtCacheMeta = useCallback(
    (slug: unknown): SbtCacheMetaSnapshot | null => {
      try {
        const netKey = deriveGroupNetKey(slug);
        const syncMeta = readSbtListCacheMetaSnapshot(slug, netKey);
        const normalizedSlug = normalizeSessionSlug(slug || '');
        const localMeta = sessionCacheMetaBySlug[normalizedSlug] || null;
        if (!syncMeta && !localMeta) return null;
        return {
          lastBlock: Math.max(Number(syncMeta?.lastBlock || 0), Number(localMeta?.lastBlock || 0)),
          sbtCount: Math.max(Number(syncMeta?.sbtCount || 0), Number(localMeta?.sbtCount || 0)),
        };
      } catch (_) {
        const normalizedSlug = normalizeSessionSlug(slug || '');
        return sessionCacheMetaBySlug[normalizedSlug] || null;
      }
    },
    [deriveGroupNetKey, sessionCacheMetaBySlug],
  );

  const hasResolvableSessionWorker = useCallback(
    (slugIn: unknown): boolean => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return true;
      return hasUsableSessionWorkerConfig({
        slug,
        sessionConfig: getDisplaySessionConfig(slug),
        allowSharedFallback: true,
      });
    },
    [getDisplaySessionConfig],
  );

  const readBooleanFlag = useCallback(
    (name: unknown, slug: unknown): boolean => {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        const flagName = String(name || '');
        if (isSbtListManagedDgCacheName(flagName)) return false;
        const normalizedSlug = normalizeSessionSlug(slug || '');
        const key = `dg:${flagName}:${normalizedSlug}`;
        const value = localStorage.getItem(key) === 'true';
        if (!value) return false;
        const isSbtScanFlag = flagName === 'sbt:fullScanInProgress' || flagName === 'sbt:deferredFullScanNeeded';
        if (isSbtScanFlag && !hasResolvableSessionWorker(normalizedSlug)) {
          // Avoid sticky loading indicators when a session config is present in UI state
          // but still missing its worker URL (common for partially-provisioned test sessions).
          localStorage.removeItem(key);
          return false;
        }
        return value;
      } catch (_) {
        return false;
      }
    },
    [hasResolvableSessionWorker],
  );

  const resolveConcreteSessionBindingSlug = useCallback((sbt: SbtListItem | null | undefined): string | null => {
    return resolveSbtListConcreteSessionBindingSlug(sbt, { getSessionSlugByName });
  }, []);

  const resolveSbtSessionSlug = useCallback(
    (sbt: SbtListItem | null | undefined): string => {
      return resolveSbtListItemSessionSlug(sbt, {
        allSessionsMode,
        isListModeScopeEnabled,
        listSlug,
        resolveConcreteSessionBindingSlug,
      });
    },
    [allSessionsMode, isListModeScopeEnabled, listSlug, resolveConcreteSessionBindingSlug],
  );

  const coerceAliasCacheItemsForTarget = useCallback(
    (items: unknown = [], targetSlugIn: unknown = '', readSlugIn: unknown = ''): SbtListItem[] => {
      const rawItems = Array.isArray(items) ? (items as SbtListItem[]) : [];
      const targetSlug = normalizeSessionSlug(targetSlugIn || '');
      const readSlug = normalizeSessionSlug(readSlugIn || '');
      if (!targetSlug || readSlug === targetSlug) return rawItems;

      const out: SbtListItem[] = [];
      rawItems.forEach((item) => {
        const concreteBindingSlug = resolveConcreteSessionBindingSlug(item);
        if (concreteBindingSlug != null && concreteBindingSlug !== targetSlug) return;
        const sbtInfo = isRecord(item?.sbtInfo) ? item.sbtInfo : {};
        out.push({
          ...item,
          __sourceSessionSlug: targetSlug,
          slug: targetSlug,
          sessionSlug: targetSlug,
          sessionSlugExplicit: true,
          sbtInfo: {
            ...sbtInfo,
            sessionSlug: targetSlug,
            sessionSlugExplicit: true,
          },
        });
      });
      return out;
    },
    [resolveConcreteSessionBindingSlug],
  );

  const collectLinkedScopedSbtEntries = useCallback(
    (targetSlugs: unknown = [], options: SbtListScopedEntryOptions = {}): SbtListItem[] => {
      const normalizedTargetSlugs = dedupeNormalizedSbtListSlugs(targetSlugs);
      if (!normalizedTargetSlugs.length) return [];

      let knownEntries: unknown[] = [];
      try {
        const entries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
        knownEntries = Array.isArray(entries) ? entries : [];
      } catch (_) {
        return [];
      }

      return collectSbtListLinkedScopedEntries({
        entries: knownEntries,
        options,
        resolveConcreteSessionBindingSlug,
        resolveSbtSessionSlug,
        targetSlugs: normalizedTargetSlugs,
      });
    },
    [resolveConcreteSessionBindingSlug, resolveSbtSessionSlug],
  );

  const sbtList = useMemo(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) {
      const slug = normalizeSessionSlug(listSlug || '');
      if (allSessionsMode && isSbtListSyntheticNoSessionSlug(slug)) {
        const deduped: SbtListItem[] = [];
        const seen = new Set<string>();
        Object.entries(sbtListBySlug).forEach(([bucketSlug, bucketItems]) => {
          const normalizedBucketSlug = normalizeSessionSlug(bucketSlug || '');
          (Array.isArray(bucketItems) ? bucketItems : []).forEach((item) => {
            const itemWithSource: SbtListItem =
              item && item.__sourceSessionSlug === normalizedBucketSlug
                ? item
                : { ...(item || {}), __sourceSessionSlug: normalizedBucketSlug };
            const addrLower = String(itemWithSource?.sbtAddress || '').toLowerCase();
            if (!addrLower) return;
            if (resolveSbtSessionSlug(itemWithSource) !== SBT_LIST_NO_SESSION_UNIVERSE_SLUG) return;
            if (seen.has(addrLower)) return;
            seen.add(addrLower);
            deduped.push(itemWithSource);
          });
        });
        return mergeSbtListsByAddress(deduped, collectLinkedScopedSbtEntries([SBT_LIST_NO_SESSION_UNIVERSE_SLUG]));
      }
      const list = sbtListBySlug[slug];
      const rawList = Array.isArray(list) ? list : [];
      if (!allSessionsMode && slug && !isSbtListSyntheticNoSessionSlug(slug)) {
        return mergeSbtListsByAddress(
          rawList.filter((item) => resolveConcreteSessionBindingSlug(item) === slug),
          collectLinkedScopedSbtEntries([slug], { requireConcreteBinding: true }),
        );
      }
      return mergeSbtListsByAddress(rawList, collectLinkedScopedSbtEntries([slug]));
    }
    const selectedSlugs = dedupeNormalizedSbtListSlugs(sectionSessionSlugs);
    if (!selectedSlugs.length) return [];
    const selectedSlugSet = new Set<string>(selectedSlugs.map((slug) => normalizeSessionSlug(slug)));
    const bucketsToScan = dedupeNormalizedSbtListSlugs([...selectedSlugs, ...Object.keys(sbtListBySlug)]);
    const deduped: SbtListItem[] = [];
    const seen = new Set<string>();
    bucketsToScan.forEach((slug) => {
      const normalized = normalizeSessionSlug(slug || '');
      const list = Array.isArray(sbtListBySlug[normalized]) ? sbtListBySlug[normalized] : [];
      list.forEach((item) => {
        const itemWithSource: SbtListItem =
          item && item.__sourceSessionSlug === normalized ? item : { ...(item || {}), __sourceSessionSlug: normalized };
        const addrLower = String(item?.sbtAddress || '').toLowerCase();
        if (!addrLower) return;
        const itemSlug = normalizeSessionSlug(resolveSbtSessionSlug(itemWithSource) || normalized);
        if (!selectedSlugSet.has(itemSlug)) return;
        if (seen.has(addrLower)) return;
        seen.add(addrLower);
        deduped.push(itemWithSource);
      });
    });
    return mergeSbtListsByAddress(deduped, collectLinkedScopedSbtEntries(selectedSlugs));
  }, [
    allSessionsMode,
    collectLinkedScopedSbtEntries,
    isListModeScopeEnabled,
    listSlug,
    resolveConcreteSessionBindingSlug,
    resolveSbtSessionSlug,
    sbtListBySlug,
    sectionSessionSlugs,
  ]);

  const loaderSessionSlugs = useMemo(() => {
    if (allSessionsMode && isListModeScopeEnabled) {
      if (actionableSectionSessionSlugs.length > 0) return actionableSectionSessionSlugs;
      return actionableUniverseSessionSlugs;
    }
    if (allSessionsMode) return actionableUniverseSessionSlugs;
    const singleSlug = normalizeSessionSlug(listSlug || '');
    if (isSbtListSyntheticNoSessionSlug(singleSlug)) return actionableUniverseSessionSlugs;
    return [singleSlug];
  }, [
    actionableSectionSessionSlugs,
    actionableUniverseSessionSlugs,
    allSessionsMode,
    isListModeScopeEnabled,
    listSlug,
  ]);

  const fetchSessionSlugs = useMemo(
    () =>
      allSessionsMode && isListModeScopeEnabled
        ? actionableSectionSessionSlugs.length > 0
          ? actionableSectionSessionSlugs
          : actionableUniverseSessionSlugs
        : isSbtListSyntheticNoSessionSlug(listSlug)
          ? actionableUniverseSessionSlugs
          : [normalizeSessionSlug(listSlug || '')],
    [actionableSectionSessionSlugs, actionableUniverseSessionSlugs, allSessionsMode, isListModeScopeEnabled, listSlug],
  );

  const getScopeBypassSessionRef = useCallback(
    (slugIn: unknown): string | UnknownRecord => {
      const slug = normalizeSessionSlug(slugIn);
      if (!allSessionsMode) return slug;
      const cfg = getDisplaySessionConfig(slug);
      return {
        ...(cfg && typeof cfg === 'object' ? cfg : {}),
        slug,
        __ignoreSessionScanScope: true,
      };
    },
    [allSessionsMode, getDisplaySessionConfig],
  );

  const refreshLatestBlocks = useCallback(
    async (slugs: unknown, force: boolean = false): Promise<void> => {
      const targets = Array.from(
        new Set((Array.isArray(slugs) ? slugs : [listSlug]).map((slug) => normalizeSessionSlug(slug))),
      );
      if (!targets.length) return;

      const updates: Record<string, number> = {};
      await Promise.all(
        targets.map(async (slug) => {
          if (!force && !isMounted.current) return;
          try {
            const scopeRef = getScopeBypassSessionRef(slug);
            const blockWindowRef = force
              ? scopeRef && typeof scopeRef === 'object'
                ? { ...scopeRef, __forceLatestBlock: true }
                : { slug, __forceLatestBlock: true }
              : scopeRef;
            const { toBlock } =
              await sbtListRuntimePorts.contractScripts.getRelevantBlockWindowForFilter(blockWindowRef);
            const latest = Number(toBlock || 0);
            if (Number.isFinite(latest) && latest > 0) {
              updates[slug] = latest;
            }
          } catch (e) {
            sbtLog.warn('SBTsList: fallback', e);
          }
        }),
      );

      if (!isMounted.current) return;
      if (!Object.keys(updates).length) return;
      setLatestBlockBySlug((prev) => {
        let changed = false;
        const next = { ...prev };
        Object.entries(updates).forEach(([slug, block]) => {
          if (Number(next[slug] || 0) !== Number(block || 0)) {
            next[slug] = Number(block);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    },
    [listSlug, getScopeBypassSessionRef],
  );

  const getSessionProgressSnapshot = useCallback(
    (slugIn: unknown): SbtSessionProgressSnapshot | null => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return null;

      const cfgRaw = getDisplaySessionConfig(slug);
      const cfg: SbtSessionDisplayConfig | null = isRecord(cfgRaw) ? cfgRaw : null;
      const cacheMeta = readSbtCacheMeta(slug);
      const scanProgressBySlug =
        sbtScanProgressBySlug && typeof sbtScanProgressBySlug === 'object' ? sbtScanProgressBySlug : {};
      const liveProgressFromProps: SbtListLiveProgress | null = isRecord(scanProgressBySlug[slug])
        ? scanProgressBySlug[slug]
        : null;
      const scanInProgressRaw = readBooleanFlag('sbt:fullScanInProgress', slug);
      const deferredRaw = readBooleanFlag('sbt:deferredFullScanNeeded', slug);
      const bridgedLiveProgress = !liveProgressFromProps ? recentLiveProgressBySlugRef.current[slug] || null : null;
      return buildSbtListSessionProgressSnapshot({
        allSessionsMode,
        bridgeMs: SBT_LIVE_PROGRESS_BRIDGE_MS,
        bridgeTailBlocks: SBT_LIVE_PROGRESS_BRIDGE_TAIL_BLOCKS,
        bridgedLiveProgress,
        cacheMeta,
        cfg,
        deferredRaw,
        latestBlock: latestBlockBySlug[slug],
        liveProgressFromProps,
        recentLiveProgressNowMs,
        scanInProgressRaw,
        slug,
      });
    },
    [
      allSessionsMode,
      getDisplaySessionConfig,
      latestBlockBySlug,
      recentLiveProgressNowMs,
      readBooleanFlag,
      readSbtCacheMeta,
      sbtScanProgressBySlug,
    ],
  );

  const deriveSessionLoadingStatus = useCallback(
    (slugIn: unknown, options: SbtSessionLoadingOptions = {}): SbtSessionLoadingStatus | null => {
      const { forceShow = false, alwaysShow = false } = options || {};
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return null;

      const snapshot = getSessionProgressSnapshot(slug);
      if (!snapshot) return null;
      return buildSbtListSessionLoadingStatus({
        allSessionsMode,
        alwaysShow,
        forceShow,
        formatBlockCount,
        loading,
        snapshot,
      });
    },
    [allSessionsMode, getSessionProgressSnapshot, loading, formatBlockCount],
  );

  const loadingSessionStatuses = useMemo(() => {
    return buildSbtListInitialLoaderStatuses({
      fallbackSlug: listSlug,
      loaderSessionSlugs,
      resolveStatus: deriveSessionLoadingStatus,
      windowAvailable: typeof window !== 'undefined',
    });
  }, [deriveSessionLoadingStatus, loaderSessionSlugs, listSlug]);

  const chipLoadingStatusBySlug = useMemo(() => {
    return buildSbtListChipLoadingStatusBySlug({
      allSessionsMode,
      displayedSessionUniverseSlugs,
      isListModeScopeEnabled,
      resolveStatus: deriveSessionLoadingStatus,
      selectedSessionUniverseSlugs: selectedSessionUniverseSlugSet,
    });
  }, [
    allSessionsMode,
    deriveSessionLoadingStatus,
    displayedSessionUniverseSlugs,
    isListModeScopeEnabled,
    selectedSessionUniverseSlugSet,
  ]);

  const sessionChipStateBySlug = useMemo(() => {
    return buildSbtListSessionChipStateBySlug({
      allSessionsMode,
      displayedSessionUniverseSlugs,
      getSessionProgressSnapshot,
      hasNoSessionCards,
      readSbtCacheMeta,
      refreshing,
      sbtListBySlug,
      sessionHasLoadedOnceBySlug,
      sessionLoadStateBySlug,
    });
  }, [
    allSessionsMode,
    displayedSessionUniverseSlugs,
    getSessionProgressSnapshot,
    readSbtCacheMeta,
    refreshing,
    hasNoSessionCards,
    sbtListBySlug,
    sessionHasLoadedOnceBySlug,
    sessionLoadStateBySlug,
  ]);

  const chipProgressDesiredVisibilityBySlug = useMemo(() => {
    return buildSbtListChipProgressDesiredVisibilityBySlug({
      allSessionsMode,
      chipLoadingStatusBySlug,
      sessionChipStateBySlug,
    });
  }, [allSessionsMode, chipLoadingStatusBySlug, sessionChipStateBySlug]);

  const commitChipProgressVisibility = useCallback(
    (slugIn: unknown, visible: unknown, nowMs: number = Date.now()): void => {
      const slug = normalizeSessionSlug(slugIn || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return;

      clearChipProgressVisibilityTimeout(slug);
      const previousMeta = chipProgressVisibilityMetaRef.current[slug] || {};
      const shouldShow = Boolean(visible);
      chipProgressVisibilityMetaRef.current[slug] = {
        ...previousMeta,
        visible: shouldShow,
        pendingVisible: shouldShow,
        lastModeChangeAtMs: Math.max(0, Number(nowMs || Date.now()) || 0),
        timerId: null,
      };
      setChipProgressVisibilityBySlug((prev) => {
        const currentlyVisible = !!prev?.[slug];
        if (currentlyVisible === shouldShow) {
          if (!shouldShow && !Object.prototype.hasOwnProperty.call(prev || {}, slug)) {
            return prev;
          }
          if (shouldShow) return prev;
        }
        const next = { ...(prev || {}) };
        if (visible) next[slug] = true;
        else delete next[slug];
        return next;
      });
    },
    [clearChipProgressVisibilityTimeout],
  );

  useEffect(() => {
    chipProgressDesiredBySlugRef.current = chipProgressDesiredVisibilityBySlug;
    const nowMs = Date.now();
    const visibilityPlan = resolveSbtListChipProgressVisibilityPlan({
      desiredVisibilityBySlug: chipProgressDesiredVisibilityBySlug,
      metaBySlug: chipProgressVisibilityMetaRef.current,
      minVisibleMs: SBT_CHIP_PROGRESS_VISIBILITY_MIN_INTERVAL_MS,
      nowMs,
    });

    visibilityPlan.actions.forEach((action) => {
      if (action.type === 'remove') {
        clearChipProgressVisibilityTimeout(action.slug);
        delete chipProgressVisibilityMetaRef.current[action.slug];
        setChipProgressVisibilityBySlug((prev) => {
          if (!Object.prototype.hasOwnProperty.call(prev || {}, action.slug)) return prev;
          const next = { ...(prev || {}) };
          delete next[action.slug];
          return next;
        });
        return;
      }

      if (action.type === 'initialize') {
        chipProgressVisibilityMetaRef.current[action.slug] = {
          visible: action.visible,
          pendingVisible: action.visible,
          lastModeChangeAtMs: nowMs,
          timerId: null,
        };
        if (action.visible) {
          setChipProgressVisibilityBySlug((prev) => {
            if (prev?.[action.slug]) return prev;
            return { ...(prev || {}), [action.slug]: true };
          });
        }
        return;
      }

      if (action.type === 'sync-pending') {
        const existingMeta = chipProgressVisibilityMetaRef.current[action.slug] || {};
        clearChipProgressVisibilityTimeout(action.slug);
        chipProgressVisibilityMetaRef.current[action.slug] = {
          ...existingMeta,
          pendingVisible: action.visible,
          timerId: null,
        };
        return;
      }

      if (action.type === 'commit') {
        commitChipProgressVisibility(action.slug, action.visible, nowMs);
        return;
      }

      if (action.type === 'keep-timer') {
        return;
      }

      const existingMeta = chipProgressVisibilityMetaRef.current[action.slug] || {};
      clearChipProgressVisibilityTimeout(action.slug);
      const timerId = setTimeout(() => {
        const nextDesiredVisible = !!chipProgressDesiredBySlugRef.current?.[action.slug];
        commitChipProgressVisibility(action.slug, nextDesiredVisible, Date.now());
      }, action.delayMs);
      chipProgressVisibilityMetaRef.current[action.slug] = {
        ...existingMeta,
        pendingVisible: action.visible,
        timerId,
      };
    });
  }, [chipProgressDesiredVisibilityBySlug, clearChipProgressVisibilityTimeout, commitChipProgressVisibility]);

  const { sectionSessionDiscoveryPending, sectionSessionSearchFlag, shouldKeepSectionSpinnersOn, refreshButtonBusy } =
    useMemo(() => {
      return resolveSbtListSectionLoadingState({
        getSessionProgressSnapshot,
        hasNoSessionCards,
        isSBTCacheReady,
        loading,
        refreshing,
        revisionSyncPending,
        sbtListBySlug,
        sectionSessionSlugs,
        sessionHasLoadedOnceBySlug,
        sessionLoadStateBySlug,
        sessionUniverseRegistryPending,
      });
    }, [
      getSessionProgressSnapshot,
      hasNoSessionCards,
      isSBTCacheReady,
      loading,
      refreshing,
      revisionSyncPending,
      sbtListBySlug,
      sectionSessionSlugs,
      sessionHasLoadedOnceBySlug,
      sessionLoadStateBySlug,
      sessionUniverseRegistryPending,
    ]);
  const SECTION_SPINNER_HIDE_DELAY_MS = 1200;

  useEffect(() => {
    if (shouldKeepSectionSpinnersOn) {
      clearEmptySectionSpinnerTimeout();
      if (!emptySectionSpinnerActive) setEmptySectionSpinnerActive(true);
      return;
    }
    clearEmptySectionSpinnerTimeout();
    emptySectionSpinnerTimeoutRef.current = setTimeout(() => {
      emptySectionSpinnerTimeoutRef.current = null;
      if (isMounted.current) {
        setEmptySectionSpinnerActive((prev) => (prev ? false : prev));
      }
    }, SECTION_SPINNER_HIDE_DELAY_MS);
  }, [clearEmptySectionSpinnerTimeout, emptySectionSpinnerActive, shouldKeepSectionSpinnersOn]);

  const primeSbtCardsFromSyncCache = useCallback(
    (slugList: unknown = []): boolean => {
      const targets = dedupeNormalizedSbtListSlugs(slugList);
      let primed = false;

      targets.forEach((slug) => {
        if (isSbtListSyntheticNoSessionSlug(slug)) return;
        const hydrated: SbtListItem[] = [];
        const meta: SbtCacheMetaSnapshot = { lastBlock: 0, sbtCount: 0 };
        getCacheReadSlugsForTarget(slug).forEach((readSlug) => {
          const netKey = deriveCacheNetKeyForSlug(readSlug);
          if (!netKey) return;

          let cache: unknown = null;
          try {
            cache = peekCacheSync('sbtCache', readSlug, { clone: false });
          } catch (_) {
            cache = null;
          }
          if (!isRecord(cache)) return;

          const cacheReadPlan = buildSbtListCacheReadPlan({
            netKey,
            rawCache: cache,
            targetSlug: readSlug,
          });
          const nextItems = coerceAliasCacheItemsForTarget(cacheReadPlan.hydrated, slug, readSlug);
          hydrated.push(...nextItems);
          meta.lastBlock = Math.max(Number(meta.lastBlock || 0), Number(cacheReadPlan.meta.lastBlock || 0));
          meta.sbtCount += nextItems.length;
        });
        if (!hydrated.length) return;

        updateSessionCacheMeta(slug, meta);

        primed = true;
        setSbtListBySlug((prev) => {
          const existing = Array.isArray(prev[slug]) ? prev[slug] : [];
          const merged = mergeSbtListsByAddress(hydrated);
          if (areSbtListArraysEqual(existing, merged)) return prev;
          return { ...prev, [slug]: merged };
        });
        setSessionHasLoadedOnceBySlug((prev) => (prev[slug] ? prev : { ...prev, [slug]: true }));
        setSessionLoadStateBySlug((prev) => {
          if (prev[slug] === 'loaded') return prev;
          return { ...prev, [slug]: 'loaded' };
        });
      });

      return primed;
    },
    [coerceAliasCacheItemsForTarget, deriveCacheNetKeyForSlug, getCacheReadSlugsForTarget, updateSessionCacheMeta],
  );

  // Effect: initial data fetch + polling setup / teardown
  useEffect(() => {
    isMounted.current = true;
    const universeSignature = Array.isArray(displayedSessionUniverseSlugs)
      ? displayedSessionUniverseSlugs.join('|')
      : '';
    const selectedSessionSignature = Array.isArray(fetchSessionSlugs) ? fetchSessionSlugs.join('|') : '';
    const prevInitDeps = lastInitDepsRef.current || {};
    const prevRevision = Number(prevInitDeps.sbtCacheRevision || 0);
    const nextRevision = Number(sbtCacheRevision || 0);
    const slugChanged = prevInitDeps.listSlug !== listSlug;
    const modeChanged = prevInitDeps.allSessionsMode !== allSessionsMode;
    const selectionChanged = prevInitDeps.selectedSessionSignature !== selectedSessionSignature;
    const universeChanged = prevInitDeps.universeSignature !== universeSignature;
    const registryPendingChanged = prevInitDeps.sessionUniverseRegistryPending !== sessionUniverseRegistryPending;
    const revisionOnlyTick =
      initialLoadCompletedRef.current &&
      !slugChanged &&
      !modeChanged &&
      !selectionChanged &&
      !universeChanged &&
      !registryPendingChanged &&
      prevRevision !== nextRevision;
    const shouldShowBlockingLoader = !revisionOnlyTick;
    if (!revisionOnlyTick) {
      setRevisionSyncPending((prev) => (prev ? false : prev));
    }

    const init = async () => {
      const trackRevisionSync = revisionOnlyTick;
      if (trackRevisionSync && isMounted.current) {
        setRevisionSyncPending(true);
      }

      try {
        if (allSessionsMode && !displayedSessionUniverseSlugsNormalized.length) {
          if (isMounted.current) setLoading(false);
          initialLoadCompletedRef.current = true;
          return;
        }
        const targets = dedupeNormalizedSbtListSlugs(fetchSessionSlugs);
        if (!targets.length) {
          if (isMounted.current) setLoading(false);
          initialLoadCompletedRef.current = true;
          return;
        }

        const hasPrimedCachedCards = primeSbtCardsFromSyncCache(targets);
        if (hasPrimedCachedCards) {
          initialLoadCompletedRef.current = true;
        }
        const shouldShowLoaderForThisRun = shouldShowBlockingLoader && !hasPrimedCachedCards;
        if (isMounted.current) {
          setLoading(shouldShowLoaderForThisRun);
        }

        try {
          const runFetchSBTs = fetchSBTsRef.current;
          const initialCacheReadPromise =
            typeof runFetchSBTs === 'function'
              ? Promise.all(targets.map((slug: string) => runFetchSBTs(false, false, slug)))
              : Promise.resolve([]);

          // Let MainSite own tokenURI hydration during light discovery, but do not
          // block the first cache read on a long scan. Cached groups should paint
          // as soon as the local cache is available.
          const runLightDiscovery = ensureLightSbtDiscoveryRef.current;
          const lightDiscoveryTargets = dedupeNormalizedSbtListSlugs(
            targets.flatMap((slug) => getCacheReadSlugsForTarget(slug)),
          );
          const lightDiscoveryPromise =
            shouldShowLoaderForThisRun && typeof runLightDiscovery === 'function'
              ? Promise.all(
                  lightDiscoveryTargets.map(async (slug: string) => {
                    try {
                      await runLightDiscovery(
                        slug,
                        allSessionsMode ? { force: true, forceScopeSlug: slug } : undefined,
                      );
                    } catch (e) {
                      sbtLog.warn('SBTsList: fallback', e);
                    }
                  }),
                )
              : Promise.resolve([]);

          const initialCacheReadResults = await initialCacheReadPromise;
          const hasFetchedCachedCards = initialCacheReadResults.some(Boolean);
          if (hasFetchedCachedCards) {
            initialLoadCompletedRef.current = true;
            if (shouldShowLoaderForThisRun && isMounted.current) setLoading(false);
          }

          await lightDiscoveryPromise;
          if (typeof runFetchSBTs === 'function') {
            void Promise.all(
              targets.map((slug: string) => runFetchSBTs(false, false, slug, { markSessionLoading: false })),
            ).catch((e: unknown) => {
              sbtLog.warn('SBTsList: fallback', e);
            });
          }
        } finally {
          if (shouldShowLoaderForThisRun && isMounted.current) setLoading(false);
        }
      } finally {
        if (trackRevisionSync && isMounted.current) {
          setRevisionSyncPending(false);
        }
      }
    };

    lastInitDepsRef.current = {
      listSlug,
      allSessionsMode,
      selectedSessionSignature,
      universeSignature,
      sessionUniverseRegistryPending,
      sbtCacheRevision: nextRevision,
    };
    init();

    return () => {
      isMounted.current = false;
    };
  }, [
    listSlug,
    allSessionsMode,
    fetchSessionSlugs,
    sessionConfigRevision,
    sbtCacheRevision,
    displayedSessionUniverseSlugs,
    displayedSessionUniverseSlugsNormalized,
    getCacheReadSlugsForTarget,
    primeSbtCardsFromSyncCache,
    sessionUniverseRegistryPending,
  ]);

  useEffect(() => {
    const targets = dedupeNormalizedSbtListSlugs(fetchSessionSlugs);
    if (!targets.length) return;
    const liveProgressBySlug =
      sbtScanProgressBySlug && typeof sbtScanProgressBySlug === 'object' ? sbtScanProgressBySlug : {};
    const hasRelevantScan = targets.some(
      (slug: string) => !isSbtListSyntheticNoSessionSlug(slug) && !!liveProgressBySlug[slug],
    );
    if (!hasRelevantScan) return;

    // Keep consuming sync-cache writes while MainSite discovery is still running
    // so the first hydrated cards can paint before the final read-cache pass.
    const hasPrimedCachedCards = primeSbtCardsFromSyncCache(targets);
    if (!hasPrimedCachedCards) return;

    initialLoadCompletedRef.current = true;
    if (loading && isMounted.current) {
      setLoading(false);
    }
  }, [fetchSessionSlugs, loading, primeSbtCardsFromSyncCache, sbtScanProgressBySlug]);

  /* No background discovery/polling — cache-first */

  // Effect: stop admin/header spinners when cache is rebuilt
  useEffect(() => {
    // When a scan completes and parent bumps revision, end our small spinner if it was showing.
    if (refreshing && isSBTCacheReady) {
      setRefreshing(false);
    }
  }, [isSBTCacheReady, sbtCacheRevision, refreshing]);

  /* Helper: detect unlimited group-password SBTs (non-zero hash).
     This is the only remaining call to contractScripts in this file.
     It is not used for discovery; solely for showing the lock icon.
     If you need a strict zero-call policy, remove this and rely on
     sbtInfo.hasPasswordMint from tokenURI.
     --------------------------------- */
  const ensureGroupPasswordFlags = useCallback(
    async (items: unknown): Promise<void> => {
      if (!Array.isArray(items) || items.length === 0) return;
      // Only check unknown ones to minimize RPC calls
      const toCheck = items.filter((s): s is SbtListItem => {
        const sbtAddress = String(isRecord(s) ? s.sbtAddress || '' : '').trim();
        return !!sbtAddress && groupPasswordMap[sbtAddress.toLowerCase()] === undefined;
      });
      if (toCheck.length === 0) return;

      try {
        const results = await Promise.all(
          toCheck.map(async (s): Promise<SbtListPasswordFlagResult> => {
            const sbtAddress = String(s.sbtAddress || '').trim();
            const sbtAddressLower = sbtAddress.toLowerCase();
            try {
              // Per-item slug awareness
              const sSlug = s && s.slug != null ? s.slug : listSlug;
              const gph = await sbtListRuntimePorts.contractScripts.getGroupPasswordHash('none', sbtAddress, sSlug);
              const isLocked = !!gph && gph !== ethers.constants.HashZero;
              return [sbtAddressLower, isLocked];
            } catch {
              return [sbtAddressLower, false];
            }
          }),
        );
        if (!isMounted.current) return;
        const updates: SbtListGroupPasswordMap = {};
        results.forEach(([k, v]) => {
          updates[k] = v;
        });
        setGroupPasswordMap((prev) => ({ ...prev, ...updates }));
      } catch (e) {
        sbtLog.warn('SBTsList: fallback', e);
      }
    },
    [groupPasswordMap, listSlug],
  );

  // Helper: fetchSBTs (reads cache) - single-group mode
  const fetchSBTs = useCallback(
    async (
      forceRefresh: boolean = false,
      showLoadingIndicator: boolean = true,
      slugOverride: unknown = null,
      options: { markSessionLoading?: boolean } = {},
    ): Promise<boolean> => {
      const markSessionLoading = options?.markSessionLoading !== false;
      const targetSlug = normalizeSessionSlug(slugOverride != null ? slugOverride : listSlug);
      if (isSbtListSyntheticNoSessionSlug(targetSlug)) return false;
      if (!isMounted.current) return false;

      if (forceRefresh && onRequestSbtCacheRefresh) {
        if (showLoadingIndicator) setLoading(true);
        // Reset group-password map when forcing a hard refresh (network-scoped)
        setGroupPasswordMap({});
        onRequestSbtCacheRefresh();
        return false;
      }

      const runId = Number(sessionFetchRunBySlugRef.current[targetSlug] || 0) + 1;
      sessionFetchRunBySlugRef.current[targetSlug] = runId;
      if (markSessionLoading) {
        setSessionLoadStateBySlug((prev) => {
          if (prev[targetSlug] === 'loading') return prev;
          return { ...prev, [targetSlug]: 'loading' };
        });
      }

      try {
        const cacheReadSlugs = getCacheReadSlugsForTarget(targetSlug);
        const cacheReadTargets = cacheReadSlugs
          .map((readSlug) => ({ readSlug, netKey: deriveCacheNetKeyForSlug(readSlug) }))
          .filter(({ netKey }) => !!netKey);

        if (!cacheReadTargets.length) {
          if (markSessionLoading && sessionFetchRunBySlugRef.current[targetSlug] === runId) {
            setSessionLoadStateBySlug((prev) => ({ ...prev, [targetSlug]: 'error' }));
            setSessionHasLoadedOnceBySlug((prev) => (prev[targetSlug] ? prev : { ...prev, [targetSlug]: true }));
          }
          return false;
        }

        const hasLoadedBefore = !!sessionHasLoadedOnceRef.current[targetSlug];
        const currentForSlug = Array.isArray(sbtListBySlugRef.current[targetSlug])
          ? sbtListBySlugRef.current[targetSlug]
          : [];
        const readPlans = await Promise.all(
          cacheReadTargets.map(async ({ readSlug, netKey }) => {
            const currentGlobalCacheRaw = await readCache('sbtCache', readSlug);
            const cacheReadPlan = buildSbtListCacheReadPlan({
              currentItems: readSlug === targetSlug ? currentForSlug : [],
              forceRefresh,
              hasLoadedBefore: readSlug === targetSlug ? hasLoadedBefore : false,
              netKey,
              rawCache: currentGlobalCacheRaw,
              targetSlug: readSlug,
            });
            return {
              ...cacheReadPlan,
              hydrated: coerceAliasCacheItemsForTarget(cacheReadPlan.hydrated, targetSlug, readSlug),
              passwordFlagItems: coerceAliasCacheItemsForTarget(cacheReadPlan.passwordFlagItems, targetSlug, readSlug),
              readSlug,
            };
          }),
        );
        const hydrated = mergeSbtListsByAddress(readPlans.flatMap((plan) => plan.hydrated));
        const passwordFlagItems = mergeSbtListsByAddress(readPlans.flatMap((plan) => plan.passwordFlagItems));
        const shouldKeepExistingCards = readPlans.some((plan) => plan.shouldKeepExistingCards);
        const latestForSlug = Array.isArray(sbtListBySlugRef.current[targetSlug])
          ? sbtListBySlugRef.current[targetSlug]
          : [];
        const shouldKeepLatestExistingCards = hydrated.length === 0 && !forceRefresh && latestForSlug.length > 0;
        const shouldApplyCards = hydrated.length > 0 || (!shouldKeepExistingCards && !shouldKeepLatestExistingCards);
        const shouldEnsurePasswordFlags = passwordFlagItems.length > 0;
        updateSessionCacheMeta(targetSlug, {
          lastBlock: Math.max(...readPlans.map((plan) => Number(plan.meta.lastBlock || 0)), 0),
          sbtCount: hydrated.length,
        });

        if (sessionFetchRunBySlugRef.current[targetSlug] !== runId || !isMounted.current) {
          return false;
        }

        if (shouldApplyCards) {
          setSbtListBySlug((prev) => {
            const existing = Array.isArray(prev[targetSlug]) ? prev[targetSlug] : [];
            if (areSbtListArraysEqual(existing, hydrated)) return prev;
            return { ...prev, [targetSlug]: hydrated };
          });
        }

        if (shouldEnsurePasswordFlags) {
          // PASSWORD-LOCK FLAGS WITH CORRECT SLUG CONTEXT
          await ensureGroupPasswordFlags(passwordFlagItems);
        }
        setSessionLoadStateBySlug((prev) => ({ ...prev, [targetSlug]: 'loaded' }));
        setSessionHasLoadedOnceBySlug((prev) => (prev[targetSlug] ? prev : { ...prev, [targetSlug]: true }));
        return hydrated.length > 0 || shouldKeepExistingCards || shouldKeepLatestExistingCards;
      } catch (error) {
        sbtLog.error('Error reading SBTs from cache:', error);
        if (markSessionLoading && sessionFetchRunBySlugRef.current[targetSlug] === runId) {
          setSessionLoadStateBySlug((prev) => ({ ...prev, [targetSlug]: 'error' }));
          setSessionHasLoadedOnceBySlug((prev) => (prev[targetSlug] ? prev : { ...prev, [targetSlug]: true }));
        }
        return false;
      } finally {
        if (!forceRefresh) {
          // Initial-load state should complete after a finished attempt,
          // even when the cache is empty or the slug has no chain config.
          initialLoadCompletedRef.current = true;
        }
        if (showLoadingIndicator && isMounted.current && forceRefresh) setLoading(false);
      }
    },
    [
      deriveCacheNetKeyForSlug,
      ensureGroupPasswordFlags,
      getCacheReadSlugsForTarget,
      coerceAliasCacheItemsForTarget,
      listSlug,
      onRequestSbtCacheRefresh,
      updateSessionCacheMeta,
    ],
  );
  fetchSBTsRef.current = fetchSBTs;

  // Derived helpers / rendering utils

  // derive last processed block and a friendly "Blocks left" number
  const cacheLastBlock = useMemo(() => {
    try {
      if (allSessionsMode) return 0; // not applicable in cross-group enumerations
      const netKey = deriveGroupNetKey(listSlug);
      if (!netKey) return 0;
      return Number(readSbtListCacheMetaSnapshot(listSlug, netKey)?.lastBlock || 0);
    } catch (_) {
      return 0;
    }
  }, [listSlug, allSessionsMode, deriveGroupNetKey]);

  const singleSessionProgressSnapshot = useMemo(
    () => (allSessionsMode ? null : getSessionProgressSnapshot(listSlug)),
    [allSessionsMode, getSessionProgressSnapshot, listSlug],
  );

  const blocksLeft = useMemo(() => {
    if (allSessionsMode) return null;
    const snapshotRemaining = Number(singleSessionProgressSnapshot?.remainingBlocks);
    if (Number.isFinite(snapshotRemaining)) {
      return Math.max(0, snapshotRemaining);
    }
    const fallbackLatest = Number(latestBlockNumber || 0);
    if (!Number.isFinite(fallbackLatest) || fallbackLatest <= 0) return null;
    return Math.max(0, fallbackLatest - Number(cacheLastBlock || 0));
  }, [allSessionsMode, cacheLastBlock, latestBlockNumber, singleSessionProgressSnapshot]);

  // SBTPage-compatible logic (tolerate strings/ms; treat 0 or missing as live)
  const isMintingLive = useCallback((sbt: SbtListItem | null | undefined): boolean => {
    const endSec = coerceSbtMintEndSeconds(sbt?.sbtInfo?.mintingEndTime);
    const nowSec = Math.floor(Date.now() / 1000);
    if (endSec === 0) return true;
    return endSec > nowSec;
  }, []);

  const ignoredSBTAddressesLower_single = useMemo(
    () => ignored_SBTs_LIST.map((addr: unknown) => normalizeSbtListAddressLower(addr)),
    [ignored_SBTs_LIST],
  );

  /** unified predicate for “password-locked” (commit-reveal OR unlimited) */
  const isPasswordLocked = useCallback(
    (sbt: SbtListItem | null | undefined): boolean => {
      const sbtInfo = sbt?.sbtInfo;
      const sbtAddress = String(sbt?.sbtAddress || '').trim();
      if (!sbtAddress || !sbtInfo) return false;
      const addrLower = sbtAddress.toLowerCase();
      return !!(sbtInfo.hasPasswordMint || groupPasswordMap[addrLower]);
    },
    [groupPasswordMap],
  );

  // Admin button actions
  const handleRefresh = async () => {
    if (isMounted.current) setRefreshing(true);
    clearRefreshSafetyTimeout();

    try {
      let refreshSlugs: string[] = loaderSessionSlugs;
      if (allSessionsMode) {
        if (typeof refreshSessionUniverseRegistryCache === 'function') {
          await refreshSessionUniverseRegistryCache();
        }
        const nextUniverse = readSessionUniverseSnapshot();
        const nextSlugs = Array.isArray(nextUniverse?.slugs) ? nextUniverse.slugs : [];
        const targetSlug = nextSlugs.includes(listSlug) ? listSlug : nextSlugs[0] || listSlug;
        if (isMounted.current) setAvailableSessionUniverse(nextUniverse);
        if (targetSlug && targetSlug !== normalizeSessionSlug(activeSessionSlug)) {
          setActiveGroupSlug(targetSlug);
        }
        if (isListModeScopeEnabled) {
          refreshSlugs = dedupeNormalizedSbtListSlugs(
            actionableSectionSessionSlugs.length > 0
              ? actionableSectionSessionSlugs
              : actionableUniverseSessionSlugs.length > 0
                ? actionableUniverseSessionSlugs
                : [targetSlug],
          );
          if (typeof ensureLightSbtDiscovery === 'function') {
            await Promise.all(
              refreshSlugs.map((slug: string) =>
                Promise.resolve(ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug })).catch(
                  (e: unknown) => {
                    sbtLog.warn('SBTsList: fallback', e);
                  },
                ),
              ),
            );
          }
          await Promise.all(refreshSlugs.map((slug: string) => fetchSBTs(false, false, slug)));
        } else {
          refreshSlugs = nextSlugs.length ? nextSlugs : loaderSessionSlugs;
          if (typeof ensureLightSbtDiscovery === 'function' && targetSlug != null) {
            await ensureLightSbtDiscovery(targetSlug, { force: true, forceScopeSlug: targetSlug });
          }
          if (typeof ensureLightSbtUniverse === 'function' && nextSlugs.length > 0) {
            await ensureLightSbtUniverse(nextSlugs, { force: true });
          }
          await fetchSBTs(false, false, targetSlug);
        }
      } else {
        await fetchSBTs(true, false, listSlug);
      }
      await refreshLatestBlocks(refreshSlugs, true);
      if (isMounted.current) setRefreshing(false);
    } catch (e) {
      sbtLog.error('[SBTsList] handleRefresh error:', e);
      if (isMounted.current) setRefreshing(false);
    }

    // Safety timeout to avoid a stuck micro-spinner in rare fallback paths
    refreshSafetyTimeoutRef.current = setTimeout(() => {
      refreshSafetyTimeoutRef.current = null;
      if (isMounted.current) setRefreshing(false);
    }, 1000);
  };

  const handleClearCache = async () => {
    if (isMounted.current) setRefreshing(true);
    clearRefreshSafetyTimeout();

    // Wipe local cache and reset list view to an empty, first-load state
    const clearTargetSlugs = dedupeNormalizedSbtListSlugs(
      allSessionsMode && isListModeScopeEnabled
        ? actionableSectionSessionSlugs.length > 0
          ? actionableSectionSessionSlugs
          : actionableUniverseSessionSlugs
        : isSbtListSyntheticNoSessionSlug(listSlug)
          ? actionableUniverseSessionSlugs
          : [listSlug],
    );
    await Promise.all(clearTargetSlugs.map((slug) => removeCache('sbtCache', slug)));
    if (isMounted.current) {
      setSessionCacheMetaBySlug((prev) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug) => {
          next[normalizeSessionSlug(slug || '')] = { lastBlock: 0, sbtCount: 0 };
        });
        return next;
      });
      setSbtListBySlug((prev) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug) => {
          next[slug] = [];
        });
        return next;
      });
      setSessionLoadStateBySlug((prev) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug) => {
          next[slug] = 'idle';
        });
        return next;
      });
      setSessionHasLoadedOnceBySlug((prev) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug) => {
          next[slug] = false;
        });
        return next;
      });
      initialLoadCompletedRef.current = false; // ensures big spinner shows
      setGroupPasswordMap({}); // keep password flags reset untouched
    }

    try {
      if (allSessionsMode) {
        const nextUniverse = readSessionUniverseSnapshot();
        const nextSlugs = Array.isArray(nextUniverse?.slugs) ? nextUniverse.slugs : [];
        const targetSlug = nextSlugs.includes(listSlug) ? listSlug : nextSlugs[0] || listSlug;
        if (isMounted.current) setAvailableSessionUniverse(nextUniverse);
        if (isListModeScopeEnabled) {
          const targetSlugs = dedupeNormalizedSbtListSlugs(
            actionableSectionSessionSlugs.length > 0
              ? actionableSectionSessionSlugs
              : actionableUniverseSessionSlugs.length > 0
                ? actionableUniverseSessionSlugs
                : [targetSlug],
          );
          if (typeof ensureLightSbtDiscovery === 'function') {
            await Promise.all(
              targetSlugs.map((slug: string) =>
                Promise.resolve(ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug })).catch(
                  (e: unknown) => {
                    sbtLog.warn('SBTsList: fallback', e);
                  },
                ),
              ),
            );
          }
          await Promise.all(targetSlugs.map((slug: string) => fetchSBTs(false, false, slug)));
        } else {
          if (typeof ensureLightSbtDiscovery === 'function' && targetSlug != null) {
            await ensureLightSbtDiscovery(targetSlug, { force: true, forceScopeSlug: targetSlug });
          }
          if (typeof ensureLightSbtUniverse === 'function' && nextSlugs.length > 0) {
            await ensureLightSbtUniverse(nextSlugs, { force: true });
          }
          await fetchSBTs(false, false, targetSlug);
        }
      } else {
        await fetchSBTs(true, true, listSlug);
      }
      await refreshLatestBlocks(loaderSessionSlugs, true);
      if (isMounted.current) setRefreshing(false);
    } catch (e) {
      sbtLog.error('[SBTsList] handleClearCache error:', e);
      if (isMounted.current) setRefreshing(false);
    }

    refreshSafetyTimeoutRef.current = setTimeout(() => {
      refreshSafetyTimeoutRef.current = null;
      if (isMounted.current) setRefreshing(false);
    }, 1000);
  };

  const handleShowMoreSessions = useCallback(async () => {
    if (!isListModeScopeEnabled || showMoreSessions || showMoreSessionsLoading) return;
    const extraRegistrySlugs = dedupeNormalizedSbtListSlugs(remainingHiddenRegistrySessionSlugs);
    const configuredSet = new Set(
      dedupeNormalizedSbtListSlugs(listModeConfiguredSessionSlugs).map((slug) => normalizeSessionSlug(slug)),
    );
    const triggerUniverseDiscovery = (slugsIn: unknown = []) => {
      const slugs = dedupeNormalizedSbtListSlugs(slugsIn);
      if (typeof ensureLightSbtUniverse !== 'function' || !slugs.length) return;
      void Promise.resolve(ensureLightSbtUniverse(slugs, { force: true })).catch((e: unknown) => {
        sbtLog.warn('SBTsList: fallback', e);
      });
    };
    if (isMounted.current) {
      setShowMoreSessions(true);
      setShowMoreSessionsLoading(true);
    }
    try {
      // Expand immediately; refresh registry in background.
      triggerUniverseDiscovery(extraRegistrySlugs);

      if (typeof refreshSessionUniverseRegistryCache === 'function') {
        await refreshSessionUniverseRegistryCache();
      }
      const nextUniverse = readSessionUniverseSnapshot();
      if (isMounted.current) setAvailableSessionUniverse(nextUniverse);

      const postRefreshSlugs = dedupeNormalizedSbtListSlugs(
        Array.isArray(nextUniverse?.slugs) ? nextUniverse.slugs : [],
      ).filter((slug) => !configuredSet.has(normalizeSessionSlug(slug)));
      if (postRefreshSlugs.length > 0) {
        triggerUniverseDiscovery(postRefreshSlugs);
      }
    } catch (e) {
      sbtLog.error('[SBTsList] handleShowMoreSessions error:', e);
    } finally {
      if (isMounted.current) setShowMoreSessionsLoading(false);
    }
  }, [
    ensureLightSbtUniverse,
    isListModeScopeEnabled,
    listModeConfiguredSessionSlugs,
    remainingHiddenRegistrySessionSlugs,
    refreshSessionUniverseRegistryCache,
    showMoreSessions,
    showMoreSessionsLoading,
    readSessionUniverseSnapshot,
  ]);

  const handleSessionChipClick = useCallback(
    (slugRaw: unknown) => {
      const normalized = normalizeSessionSlug(slugRaw || '');
      if (!allSessionsMode) return;
      if (!isListModeScopeEnabled) {
        if (normalized !== normalizeSessionSlug(activeSessionSlug)) {
          setActiveGroupSlug(normalized);
        }
        if (isSbtListSyntheticNoSessionSlug(normalized)) {
          const targets = actionableUniverseSessionSlugs;
          if (!targets.length) return;
          void (async () => {
            try {
              if (typeof ensureLightSbtDiscovery === 'function') {
                await Promise.all(
                  targets.map((slug) =>
                    Promise.resolve(ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug })).catch(
                      (e: unknown) => {
                        sbtLog.warn('SBTsList: fallback', e);
                      },
                    ),
                  ),
                );
              }
              await Promise.all(targets.map((slug) => fetchSBTs(false, false, slug)));
            } catch (e) {
              sbtLog.warn('SBTsList: fallback', e);
            }
          })();
        }
        return;
      }

      const wasSelected = selectedSessionUniverseSlugSet.has(normalized);
      setSelectedSessionSlugs((prev) => {
        return resolveSbtListChipSelectedSessionSlugs({
          defaultListModeSelectedSessionSlugs,
          displayedSessionUniverseSlugs: displayedSessionUniverseSlugsNormalized,
          selectedSessionSlugs: prev,
          selectedSlug: normalized,
          wasSelected,
        });
      });

      if (!wasSelected) {
        if (!isSbtListSyntheticNoSessionSlug(normalized) && normalized !== normalizeSessionSlug(activeSessionSlug)) {
          setActiveGroupSlug(normalized);
        }
        void (async () => {
          try {
            if (isSbtListSyntheticNoSessionSlug(normalized)) {
              const targets = actionableUniverseSessionSlugs;
              if (!targets.length) return;
              if (typeof ensureLightSbtDiscovery === 'function') {
                await Promise.all(
                  targets.map((slug: string) =>
                    Promise.resolve(ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug })).catch(
                      (e: unknown) => {
                        sbtLog.warn('SBTsList: fallback', e);
                      },
                    ),
                  ),
                );
              }
              await Promise.all(targets.map((slug: string) => fetchSBTs(false, false, slug)));
              return;
            }
            if (typeof ensureLightSbtDiscovery === 'function') {
              await ensureLightSbtDiscovery(normalized, { force: true, forceScopeSlug: normalized });
            }
            await fetchSBTs(false, false, normalized);
          } catch (e) {
            sbtLog.warn('SBTsList: fallback', e);
          }
        })();
      }
    },
    [
      activeSessionSlug,
      actionableUniverseSessionSlugs,
      allSessionsMode,
      defaultListModeSelectedSessionSlugs,
      displayedSessionUniverseSlugsNormalized,
      ensureLightSbtDiscovery,
      fetchSBTs,
      isListModeScopeEnabled,
      selectedSessionUniverseSlugSet,
    ],
  );

  const { mintingLiveList, expiredList, displayedFeatured, featuredItemKeySet } = useMemo(
    () =>
      buildSbtListRenderBuckets({
        allSessionsMode,
        excludePasswordLocked,
        featuredSbtAddresses: featured_SBTs_LIST,
        getSessionListsForSlug: getSessionLists,
        ignoredSbtAddressesLower: ignoredSBTAddressesLower_single,
        isListModeScopeEnabled,
        isMintingLive,
        isPasswordLocked,
        listSlug,
        resolveSbtSessionSlug,
        sbtList,
        sectionSessionSlugs,
      }),
    [
      allSessionsMode,
      excludePasswordLocked,
      featured_SBTs_LIST,
      ignoredSBTAddressesLower_single,
      isListModeScopeEnabled,
      isMintingLive,
      isPasswordLocked,
      listSlug,
      resolveSbtSessionSlug,
      sectionSessionSlugs,
      sbtList,
    ],
  );

  const buildSbtItemKey = useCallback(
    (sbt: SbtListItem) => buildSbtListRenderItemKey(sbt, { allSessionsMode, listSlug, resolveSbtSessionSlug }),
    [allSessionsMode, listSlug, resolveSbtSessionSlug],
  );

  const mintingLiveListWithoutFeatured = useMemo(
    () => mintingLiveList.filter((sbt: SbtListItem) => !featuredItemKeySet.has(buildSbtItemKey(sbt))),
    [buildSbtItemKey, featuredItemKeySet, mintingLiveList],
  );

  const expiredListWithoutFeatured = useMemo(
    () => expiredList.filter((sbt: SbtListItem) => !featuredItemKeySet.has(buildSbtItemKey(sbt))),
    [buildSbtItemKey, expiredList, featuredItemKeySet],
  );

  const initialLoadCompleted = initialLoadCompletedRef.current;
  const readinessDisplayPlan = resolveSbtListReadinessDisplayPlan({
    allSessionsMode,
    availableSessionSlugCount: availableSessionSlugs.length,
    displayedFeaturedCount: displayedFeatured.length,
    displayedSessionUniverseSlugs,
    emptySectionSpinnerActive,
    expiredCount: expiredListWithoutFeatured.length,
    initialLoadCompleted,
    isSBTCacheReady,
    loading,
    mintingLiveCount: mintingLiveListWithoutFeatured.length,
    refreshing,
    revisionSyncPending,
    sectionSessionDiscoveryPending,
    sectionSessionSearchFlag,
    sessionUniverseRegistryPending,
  });
  const {
    sectionHeaderSpinnerVisible,
    showExpiredSectionLoadingHint,
    showFeaturedSectionLoadingHint,
    showInitialLoader,
    showLiveSectionLoadingHint,
    showUniverseSpinner,
  } = readinessDisplayPlan;

  useEffect(() => {
    const researchStep = readSbtListSyncBarResearchBlockStep();
    const passiveLatestLookupPlan = buildSbtListPassiveLatestLookupPlan({
      chipLoadingStatusBySlug,
      getSessionProgressSnapshot,
      lookupInFlightBySlug: passiveLatestLookupInFlightBySlugRef.current,
      lookupStateBySlug: passiveLatestLookupStateBySlugRef.current,
      researchStep,
      sbtRealtimeCoverageBySlug,
      sessionChipStateBySlug,
    });

    passiveLatestLookupPlan.staleSlugs.forEach((slug) => {
      delete passiveLatestLookupStateBySlugRef.current[slug];
      delete passiveLatestLookupInFlightBySlugRef.current[slug];
    });

    passiveLatestLookupPlan.requests.forEach(({ slug, currentWatermark }) => {
      passiveLatestLookupStateBySlugRef.current[slug] = {
        lastRequestedAtBlock: Number(currentWatermark || 0),
      };
      passiveLatestLookupInFlightBySlugRef.current[slug] = true;
      Promise.resolve(refreshLatestBlocks([slug], false))
        .catch((e: unknown) => {
          sbtLog.warn('SBTsList: fallback', e);
        })
        .finally(() => {
          delete passiveLatestLookupInFlightBySlugRef.current[slug];
        });
    });
  }, [
    chipLoadingStatusBySlug,
    getSessionProgressSnapshot,
    refreshLatestBlocks,
    sbtRealtimeCoverageBySlug,
    sessionChipStateBySlug,
  ]);

  if (showInitialLoader) {
    return (
      <SbtListInitialLoader loadingLabel={`Loading ${t('sbts')}`} loadingSessionStatuses={loadingSessionStatuses} />
    );
  }

  const buildSbtHref = (sbtAddress: unknown, sessionSlug: unknown = ''): string =>
    buildSbtListDetailHref(sbtAddress, sessionSlug);

  const handleSbtLinkClick = (event: SbtListPointerEventLike, sbtAddress: unknown, sessionSlug: unknown = ''): void => {
    if (!sbtAddress || event?.defaultPrevented) return;
    if (typeof onNavigateToSbt !== 'function') return;
    if (isModifiedSbtListPointerNavigation(event)) return;
    event.preventDefault?.();
    const address = String(sbtAddress || '');
    onNavigateToSbt(address, buildSbtHref(address, sessionSlug));
  };

  const handleFeaturedCardClick = (
    event: SbtListPointerEventLike,
    sbtAddress: unknown,
    sessionSlug: unknown = '',
  ): void => {
    if (!sbtAddress) return;
    if (event?.defaultPrevented) return;
    const interactiveAncestor = findSbtListInteractiveAncestor(event?.target, FEATURED_CARD_INTERACTIVE_SELECTOR);
    if (interactiveAncestor && interactiveAncestor !== event?.currentTarget) {
      const interactiveTag = String(interactiveAncestor?.tagName || '').toLowerCase();
      if (interactiveTag !== 'a' && typeof event?.preventDefault === 'function') {
        event.preventDefault();
      }
      return;
    }
    handleSbtLinkClick(event, sbtAddress, sessionSlug);
  };

  const toggleExpandedSbt = (sbtAddress: unknown): void => {
    const normalized = String(sbtAddress || '')
      .trim()
      .toLowerCase();
    if (!normalized) return;
    setExpandedSbtAddresses((prev) => buildSbtListExpandedAddressSetToggle(prev, normalized));
  };

  const renderSbtDetailsPanel = (details: SbtCardDetails | null | undefined, detailsId: string): React.ReactNode => (
    <SbtListDetailsPanel details={details} detailsId={detailsId} styles={styles} />
  );

  const handleTagChipClick = (event: SbtListPointerEventLike, tag: unknown): void => {
    if (event?.preventDefault) event.preventDefault();
    if (event?.stopPropagation) event.stopPropagation();
    const normalizedTag = String(tag || '').trim();
    if (!normalizedTag) return;
    setActiveTag(normalizedTag);
  };

  const renderSbtMetaRow = (
    sbt: SbtListItem,
    details: SbtCardDetails | null | undefined,
    detailsId: string,
    buttonLabel: unknown,
  ): React.ReactNode => {
    const model = buildSbtListMetaRowModel({
      details,
      expandedSbtAddresses,
      miniaturized,
      sbt,
    });
    if (!model) return null;
    return (
      <SbtListMetaRow
        buttonLabel={buttonLabel}
        detailsId={detailsId}
        model={model}
        onTagClick={handleTagChipClick}
        onToggleDetails={() => toggleExpandedSbt(sbt?.sbtAddress)}
        styles={styles}
      />
    );
  };

  const renderCompactSbtLinkCard = (sbt: SbtListItem | null | undefined, keyPrefix = 'sbt'): React.ReactNode => {
    const model = buildSbtListDisplayCardModel({
      addressMode: 'raw',
      getDescriptionText: getSbtDescriptionText,
      getDisplayName: getSbtDisplayName,
      isPasswordLocked,
      keyPrefix,
      resolveSbtSessionSlug,
      sbt,
      unnamedLabel: t('sbt'),
    });
    if (!model) return null;
    const compactCardClassName = [styles.sbtItem, miniaturized && viewMode === 'modal' ? styles.modalMiniSbtItem : '']
      .filter(Boolean)
      .join(' ');

    return (
      <SbtListCompactLinkCard
        key={model.key}
        className={compactCardClassName}
        href={buildSbtHref(model.sbtAddress, model.sessionSlug)}
        imageStyle={resolveSbtListRelativeImageStyle()}
        model={model}
        onClick={(event) => handleSbtLinkClick(event, model.sbtAddress, model.sessionSlug)}
        sbtLabel={t('sbt')}
        styles={styles}
      />
    );
  };

  const renderInteractiveMiniSbtCard = (sbt: SbtListItem | null | undefined, keyPrefix = 'sbt'): React.ReactNode => {
    const model = buildSbtListInteractiveMiniCardModel({
      keyPrefix,
      resolveSbtSessionSlug,
      sbt,
    });
    if (!model) return null;
    const { key, sbtAddress, sessionSlug } = model;

    return (
      <SBTPage
        key={key}
        miniaturized
        miniMintable
        SBTAddress={sbtAddress}
        account={account}
        provider={provider}
        network={network}
        loginComplete={loginComplete}
        toggleLoginModal={toggleLoginModal}
        sbtCacheRevision={sbtCacheRevision}
        sessionSlug={sessionSlug}
        isSBTCacheReady={isSBTCacheReady}
        refreshSbtData={refreshSbtData}
      />
    );
  };

  const renderFeaturedSBTCard = (sbt: SbtListItem): React.ReactNode => {
    const model = buildSbtListFeaturedCardModel({
      expandedSbtAddresses,
      fallbackLabel: t('sbt'),
      getDisplayName: getSbtDisplayName,
      resolveSbtSessionSlug,
      sbt,
    });
    if (!model) return null;
    const { detailsId, isExpanded, linkLabel, sbtAddress, sbtAddressLower, sessionSlug } = model;
    const details = getSbtCardDetails(sbt);

    if (miniaturized && interactiveMiniCards) {
      return renderInteractiveMiniSbtCard(sbt, 'featured-mini');
    }

    const featuredCardLink = (
      <a
        key={`${sessionSlug}|${sbtAddressLower}`}
        className={styles.featuredSbtCardLink}
        href={buildSbtHref(sbtAddress, sessionSlug)}
        data-testid={`featured-sbt-link-${sbtAddressLower}`}
        aria-label={`Open ${t('sbt')} details for ${linkLabel}`}
        onClick={(event) => handleFeaturedCardClick(event, sbtAddress, sessionSlug)}
      >
        <SBTPage
          miniaturized
          miniMintable
          SBTAddress={sbtAddress}
          account={account}
          provider={provider}
          network={network}
          loginComplete={loginComplete}
          toggleLoginModal={toggleLoginModal}
          sbtCacheRevision={sbtCacheRevision}
          sessionSlug={sessionSlug}
          isSBTCacheReady={isSBTCacheReady}
          refreshSbtData={refreshSbtData}
        />
      </a>
    );

    if (miniaturized && viewMode === 'modal') {
      return renderCompactSbtLinkCard(sbt, 'featured-modal');
    }
    if (miniaturized || (!details.hasDetails && details.tags.length <= 0)) {
      return featuredCardLink;
    }

    return (
      <article
        key={`featured-shell-${sessionSlug}|${sbtAddressLower}`}
        className={buildSbtListExpandedCardShellClassName({
          baseClassName: styles.featuredCardShell,
          expandedClassName: styles.featuredCardShellExpanded,
          isExpanded,
        })}
      >
        {featuredCardLink}
        {renderSbtMetaRow(sbt, details, detailsId, linkLabel)}
        {isExpanded && renderSbtDetailsPanel(details, detailsId)}
      </article>
    );
  };

  const renderFeaturedSection = () => {
    return (
      <SbtListSectionBody
        emptyLabel={`No featured ${t('sbtsLower')}.`}
        hasItems={displayedFeatured.length > 0}
        loadingHint={showFeaturedSectionLoadingHint ? renderSectionLoadingHint() : null}
        wrapClassName={styles.featuredSBTsContainer}
      >
        {displayedFeatured.map(renderFeaturedSBTCard)}
      </SbtListSectionBody>
    );
  };

  const renderSectionTitle = (label: React.ReactNode, spinnerId: string): React.ReactNode => (
    <SbtListSectionTitle label={label} showSpinner={sectionHeaderSpinnerVisible} spinnerId={spinnerId} />
  );

  const renderSectionLoadingHint = () => (
    <SbtListSectionLoadingHint
      allSessionsMode={allSessionsMode}
      blocksLeft={typeof blocksLeft === 'number' ? blocksLeft : null}
    />
  );

  const renderSBTButton = (sbt: SbtListItem | null | undefined): React.ReactNode => {
    const model = buildSbtListDisplayCardModel({
      getDescriptionText: getSbtDescriptionText,
      getDisplayName: getSbtDisplayName,
      isPasswordLocked,
      resolveSbtSessionSlug,
      sbt,
      unnamedLabel: t('sbt'),
    });
    if (!model || !sbt) return null;
    const { name, sbtAddress, sbtAddressLower, sessionSlug } = model;
    const resolvedSbt = sbt;
    const details = getSbtCardDetails(sbt);
    const detailsId = `sbt-details-${sbtAddressLower}`;
    const isExpanded = expandedSbtAddresses.has(sbtAddressLower);

    if (miniaturized) {
      if (interactiveMiniCards) {
        return renderInteractiveMiniSbtCard(sbt, 'mini-list');
      }
      return renderCompactSbtLinkCard(sbt);
    }

    return (
      <SbtListStandardCard
        key={model.key}
        href={buildSbtHref(sbtAddress, sessionSlug)}
        imageStyle={resolveSbtListRelativeImageStyle()}
        isExpanded={isExpanded}
        metaRow={renderSbtMetaRow(resolvedSbt, details, detailsId, name || resolvedSbt.sbtAddress || t('sbt'))}
        detailsPanel={renderSbtDetailsPanel(details, detailsId)}
        model={model}
        onClick={(event) => handleSbtLinkClick(event, sbtAddress, sessionSlug)}
        sbtLabel={t('sbt')}
        shellClassName={buildSbtListExpandedCardShellClassName({
          baseClassName: styles.standardCardShell,
          expandedClassName: styles.standardCardShellExpanded,
          isExpanded,
        })}
        styles={styles}
      />
    );
  };

  const renderSessionUniverseSelector = () => {
    if (!allSessionsMode) return null;
    const publicBasePath = readPublicUrlBasePath();
    const buildSessionRouteHref = (slugRaw: unknown): string =>
      buildSbtListSessionRouteHref({
        getSessionConfig: getDisplaySessionConfig,
        publicBasePath,
        slug: slugRaw,
      });

    const handleOpenSessionChip = (
      slugRaw: unknown,
      optionOrEvent: unknown = null,
      maybeEvent: unknown = null,
    ): void => {
      const event = isSbtListPointerEventLike(maybeEvent)
        ? maybeEvent
        : isSbtListPointerEventLike(optionOrEvent)
          ? optionOrEvent
          : null;
      if (event?.stopPropagation) event.stopPropagation();
      if (event?.preventDefault) event.preventDefault();
      const href = buildSessionRouteHref(slugRaw);
      if (!href) return;
      try {
        window.open(href, '_blank', 'noopener,noreferrer');
      } catch (e) {
        sbtLog.warn('SBTsList: fallback', e);
      }
    };

    const canShowMoreSessions =
      isListModeScopeEnabled && !showMoreSessions && remainingHiddenRegistrySessionSlugs.length > 0;
    const collapsedSummarySlugs = resolveSbtListSessionSelectorSummarySlugs({
      isListModeScopeEnabled,
      listSlug,
      selectedSessionUniverseSlugs,
    });
    const sessionSelectorOptions = buildSbtListSessionSelectorOptions({
      activeSessionSlug,
      buildSessionRouteHref,
      chipLoadingStatusBySlug,
      chipProgressVisibilityBySlug,
      displayedSessionUniverseSlugs,
      isListModeScopeEnabled,
      labelForSessionSlug,
      selectedSessionUniverseSlugs: selectedSessionUniverseSlugSet,
      sessionChipStateBySlug,
    });

    return (
      <SbtListSessionUniversePanel
        buildSessionRouteHref={buildSessionRouteHref}
        canShowMoreSessions={canShowMoreSessions}
        chipLoadingStatusBySlug={chipLoadingStatusBySlug}
        chipProgressVisibilityBySlug={chipProgressVisibilityBySlug}
        hideSessionUniverseSummary={hideSessionUniverseSummary}
        isOpen={isSessionSelectorOpen}
        isUniverseCollapsed={isUniverseCollapsed}
        labelForSessionSlug={labelForSessionSlug}
        onOpenSessionChip={handleOpenSessionChip}
        onShowMoreSessions={handleShowMoreSessions}
        onToggleSessionChip={(slug) => handleSessionChipClick(slug)}
        onToggleSessionSettings={() => setShowLocalSessionSettings((prev) => !prev)}
        onToggleUniverseCollapsed={() => setIsUniverseCollapsed((prev) => !prev)}
        remainingHiddenSessionCount={remainingHiddenRegistrySessionSlugs.length}
        selectedSummarySlugs={collapsedSummarySlugs}
        selectorPanelId={sessionSelectorPanelId}
        sessionSelectorOptions={sessionSelectorOptions}
        showMoreSessionsLoading={showMoreSessionsLoading}
        showUniverseSpinner={showUniverseSpinner}
        usesFallbackSessionSettingsToggle={usesFallbackSessionSettingsToggle}
      />
    );
  };

  const renderCreateGroupControl = (className: string = styles.createGroupButton): React.ReactNode => (
    <Button className={className} onClick={() => setShowCreateGroup(!showCreateGroup)}>
      <FontAwesomeIcon icon={faPlus} /> {showCreateGroup ? `Exit ${t('sbt')} Creation` : `Create ${t('sbt')}`}
    </Button>
  );

  const showEmbeddedCreateGroupControl = embeddedMode && allSessionsMode;
  const shouldRenderCreateGroupPanel = showCreateGroup && (!embeddedMode || showEmbeddedCreateGroupControl);

  const rootClassName = viewMode === 'modal' ? styles.modalViewContainer : styles.standardViewContainer;

  // Miniaturized mode
  if (miniaturized) {
    const isModal = viewMode === 'modal';
    const showCommunityTabCompactSettings = isModal && communityTabCompactSettings;
    const miniFeatured = displayedFeatured;
    const miniMintingLive = mintingLiveListWithoutFeatured;
    const miniExpired = expiredListWithoutFeatured;

    return (
      <div
        className={buildSbtListRootClassName({
          baseClassName: styles.miniaturizedBase,
          rootClassName,
        })}
      >
        {isModal &&
          (showCommunityTabCompactSettings ? (
            <>
              <div className={styles.miniSettingsRow}>
                <button
                  type="button"
                  className={buildSbtListMiniSettingsButtonClassName({
                    activeClassName: styles.miniSettingsButtonActive,
                    baseClassName: styles.miniSettingsButton,
                    isActive: showAdminButtons || excludePasswordLocked,
                  })}
                  onClick={() => setShowAdminButtons(!showAdminButtons)}
                  aria-label={`${t('sbt')} list settings`}
                  aria-expanded={showAdminButtons}
                  data-testid="sbt-mini-settings-button"
                >
                  <FontAwesomeIcon icon={faCog} />
                </button>
              </div>
              {showAdminButtons && (
                <div
                  className={buildSbtListFilterContainerClassName({
                    baseClassName: styles.filterContainer,
                    panelClassName: styles.miniSettingsPanel,
                  })}
                  data-testid="sbt-mini-settings-panel"
                >
                  <div className={styles.filterRow}>
                    <label
                      className={buildSbtListFilterLabelClassName({
                        activeClassName: styles.filterLabelActive,
                        baseClassName: styles.filterLabel,
                        isActive: excludePasswordLocked,
                        toggleClassName: styles.filterLabelToggle,
                      })}
                    >
                      <input
                        type="checkbox"
                        checked={excludePasswordLocked}
                        onChange={() => setExcludePasswordLocked(!excludePasswordLocked)}
                      />
                      {`No Password ${t('sbts')}`}
                    </label>
                  </div>
                  {allSessionsMode && renderSessionUniverseSelector()}
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.filterContainer}>
                <div className={styles.filterRow}>
                  <label
                    className={buildSbtListFilterLabelClassName({
                      activeClassName: styles.filterLabelActive,
                      baseClassName: styles.filterLabel,
                      isActive: excludePasswordLocked,
                      toggleClassName: styles.filterLabelToggle,
                    })}
                  >
                    <input
                      type="checkbox"
                      checked={excludePasswordLocked}
                      onChange={() => setExcludePasswordLocked(!excludePasswordLocked)}
                    />
                    {`Exclude Password-Locked ${t('sbts')}`}
                  </label>
                </div>
              </div>
              {allSessionsMode && renderSessionUniverseSelector()}
            </>
          ))}
        {allSessionsMode && !showCommunityTabCompactSettings && !isModal && renderSessionUniverseSelector()}
        {allSessionsMode && showCommunityTabCompactSettings && !showAdminButtons && renderSessionUniverseSelector()}

        {renderSectionTitle(`Featured ${t('sbts')}`, 'section-spinner-featured')}
        <SbtListSectionBody
          emptyLabel={`No featured ${t('sbtsLower')}.`}
          hasItems={miniFeatured.length > 0}
          loadingHint={showFeaturedSectionLoadingHint ? renderSectionLoadingHint() : null}
          wrapClassName={styles.sbtGrid}
        >
          {miniFeatured.map(renderFeaturedSBTCard)}
        </SbtListSectionBody>

        {renderSectionTitle(`${t('minting')} Live`, 'section-spinner-live')}
        <SbtListSectionBody
          emptyLabel={`No live ${t('sbtsLower')}.`}
          hasItems={miniMintingLive.length > 0}
          loadingHint={showLiveSectionLoadingHint ? renderSectionLoadingHint() : null}
          wrapClassName={styles.sbtGrid}
        >
          {miniMintingLive.map(renderSBTButton)}
        </SbtListSectionBody>

        {renderSectionTitle(`${t('minting')} Expired`, 'section-spinner-expired')}
        <SbtListSectionBody
          emptyLabel={`No expired ${t('sbtsLower')}.`}
          hasItems={miniExpired.length > 0}
          loadingHint={showExpiredSectionLoadingHint ? renderSectionLoadingHint() : null}
          wrapClassName={styles.sbtGrid}
        >
          {miniExpired.map(renderSBTButton)}
        </SbtListSectionBody>
      </div>
    );
  }

  // Standard (full) mode
  return (
    <div
      className={buildSbtListRootClassName({
        baseClassName: styles.standardBase,
        rootClassName,
      })}
    >
      {/* If embeddedMode is true, suppress the header to avoid duplication in parent */}
      {!embeddedMode && (
        <div className={styles.header}>
          {renderCreateGroupControl(styles.createGroupButton)}

          <Button
            className={styles.settingsButton}
            onClick={() => setShowAdminButtons(!showAdminButtons)}
            aria-label={`${t('sbt')} list settings`}
          >
            <FontAwesomeIcon icon={faCog} />
          </Button>

          {/* Small spinner for background refreshes */}
          {loading && initialLoadCompletedRef.current && (
            <div className={styles.headerSpinnerWrap} style={resolveSbtListHeaderSpinnerWrapStyle()}>
              <FontAwesomeIcon icon={faSpinner} spin className={styles.headerSpinner} />
              {!allSessionsMode && typeof blocksLeft === 'number' && (
                <span style={resolveSbtListHeaderBlocksLeftStyle()}>Blocks left: {blocksLeft}</span>
              )}
            </div>
          )}
        </div>
      )}

      {showEmbeddedCreateGroupControl && (
        <div className={styles.embeddedCreateGroupRow}>
          {renderCreateGroupControl(styles.embeddedCreateGroupButton)}
        </div>
      )}

      {/* In all-groups embedded mode, keep CreateGroup panel above universe chooser. */}
      {shouldRenderCreateGroupPanel && (
        <div className={styles.createGroupPanelWrap}>
          <CreateGroup
            account={account}
            loginComplete={loginComplete}
            provider={provider}
            litHooks={litHooks}
            toggleLoginModal={toggleLoginModal}
            expanded={showCreateGroup}
            network={network}
            sessionSlug={listSlug}
            lockGateSessionSources={
              showEmbeddedCreateGroupControl && isListModeScopeEnabled ? embeddedCreateGroupLockGateSources : undefined
            }
            lockGatePreferredSessionSlug={
              showEmbeddedCreateGroupControl && isListModeScopeEnabled ? listSlug : undefined
            }
            sbtCacheRevision={sbtCacheRevision}
          />
        </div>
      )}

      {showAdminButtons && (
        <div className={styles.adminButtonsContainer}>
          <div className={styles.adminControlsRow}>
            <label className={styles.filterLabel}>
              <input
                type="checkbox"
                checked={excludePasswordLocked}
                onChange={() => setExcludePasswordLocked(!excludePasswordLocked)}
              />
              {`Exclude Password-Locked ${t('sbts')}`}
            </label>
            <Button className={styles.refreshButton} onClick={handleRefresh} disabled={refreshing || loading}>
              <FontAwesomeIcon icon={faSync} spin={refreshing} /> Refresh
              {refreshButtonBusy && (
                <>
                  {' '}
                  <FontAwesomeIcon icon={faSpinner} spin data-testid="sbt-refresh-busy-spinner" />
                </>
              )}
            </Button>
            <Button className={styles.clearCacheButton} onClick={handleClearCache} disabled={refreshing || loading}>
              <FontAwesomeIcon icon={faTrash} /> Clear Cache
            </Button>
          </div>
          {allSessionsMode && renderSessionUniverseSelector()}
        </div>
      )}

      {allSessionsMode && !showAdminButtons && renderSessionUniverseSelector()}

      {/* If embeddedMode is true, the parent handles the "Featured" section; suppress it here */}
      {!embeddedMode && (
        <>
          {renderSectionTitle('Featured', 'section-spinner-featured')}
          {renderFeaturedSection()}
        </>
      )}

      {renderSectionTitle(`${t('minting')} Live`, 'section-spinner-live')}
      <SbtListSectionBody
        emptyLabel={`No live ${t('sbtsLower')}.`}
        hasItems={mintingLiveListWithoutFeatured.length > 0}
        loadingHint={showLiveSectionLoadingHint ? renderSectionLoadingHint() : null}
      >
        {mintingLiveListWithoutFeatured.map(renderSBTButton)}
      </SbtListSectionBody>

      {renderSectionTitle(`${t('minting')} Expired`, 'section-spinner-expired')}
      <SbtListSectionBody
        emptyLabel={`No expired ${t('sbtsLower')}.`}
        hasItems={expiredListWithoutFeatured.length > 0}
        loadingHint={showExpiredSectionLoadingHint ? renderSectionLoadingHint() : null}
      >
        {expiredListWithoutFeatured.map(renderSBTButton)}
      </SbtListSectionBody>
      <TagModal isOpen={!!activeTag} toggle={() => setActiveTag('')} activeTag={activeTag || null} />
    </div>
  );
};

export default SBTsList;
