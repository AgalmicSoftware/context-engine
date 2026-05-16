/** @file SBTsList */

import React, { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react';
import contractScripts, {
  getAllSessionEntries,
  getDemoSessionConfigBySlug,
  getSessionChainId,
  getSessionConfigBySlug,
  getSessionLists,
  getSessionSlugByName,
  normalizeSessionSlug
} from '../../utilities/web3/contractScripts.js';
import styles from './SBTsList.module.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSpinner, faSync, faTrash, faPlus, faLock, faCog, faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { Button } from 'reactstrap';
import SBTPage from './SBTPage';
import CreateGroup from './CreateSBTGroup';
import TagModal from '../TagPage/TagModal';
import SessionChipSelector from '../Shared/SessionChipSelector';
import SbtListSessionUniverseSummary from './SbtListSessionUniverseSummary';
import {
  SbtListDetailsPanel,
  SbtListMetaRow,
} from './SbtListCardChrome';
import {
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
import {
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  sessionRegistryStore
} from '../../utilities/web3/sessionRegistry.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import {
  GLOBAL_SESSION_SELECTION_UPDATED_EVENT,
  readStoredGlobalSessionSelection,
} from '../../utilities/session/globalSessionState.js';
import { hasUsableSessionWorkerConfig } from '../../utilities/session/sessionWorkerAvailability.js';
import { hasCachedCreateSbtForm } from '../../utilities/sbt/sbtCreateFormCache.js';
import { getSbtDescriptionText, getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
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
  buildSbtListInteractiveMiniCardModel,
  buildSbtListMetaRowModel,
  buildSbtListMiniSettingsButtonClassName,
  buildSbtListRenderItemKey,
  buildSbtListRenderBuckets,
  buildSbtListRootClassName,
  buildSbtListSessionChipStateBySlug,
  buildSbtListSessionLoadingStatus,
  buildSbtListSessionProgressSnapshot,
  buildSbtListSessionUniversePanelClassName,
  coerceSbtMintEndSeconds,
  dedupeNormalizedSbtListSlugs,
  getSbtCardDetails,
  getVisibleSbtListSessionSlugsFromEntries,
  mergeSbtListsByAddress,
  hasSbtListExplicitNoSessionAssociation,
  hasSbtListMissingOrEmptySessionSlug,
  isModifiedSbtListPointerNavigation,
  isSbtListManagedDgCacheName,
  normalizeSbtListAddressLower,
  normalizeSbtListItems,
  pickNormalizedSbtListSessionSlug,
  readSbtListShowDemoSessions,
  readSbtListUniverseCollapsedState,
  readSbtListSyncBarResearchBlockStep,
  readSbtListCacheMetaSnapshot,
  readStoredSbtListModeSelectedSessionSlugs,
  resolveSbtListConcreteSessionBindingSlug,
  resolveSbtListActionableSessionSlugs,
  resolveSbtListChipSelectedSessionSlugs,
  resolveSbtListClampedSelectedSessionSlugs,
  resolveSbtListDefaultSelectedSessionSlugs,
  resolveSbtListDisplayedSessionUniverseSlugs,
  resolveSbtListHiddenRegistrySessionSlugs,
  resolveSbtListItemSessionSlug,
  resolveSbtListHeaderBlocksLeftStyle,
  resolveSbtListHeaderSpinnerWrapStyle,
  resolveSbtListRemainingHiddenRegistrySessionSlugs,
  resolveSbtListSelectedSessionUniverseSlugs,
  resolveSbtListSelectedHiddenRegistrySessionSlugs,
  resolveSbtListSectionSessionSlugs,
  resolveSbtListSessionUniverseSnapshotUpdate,
  resolveSbtListCreateGroupInitialVisibility,
  resolveSbtListRelativeImageStyle,
  SBT_LIST_MODE_SELECTION_STORAGE_KEY,
  SBT_LIST_NO_SESSION_UNIVERSE_SLUG,
  isSbtListSyntheticNoSessionSlug,
} from './sbtListHelpers';
import type { SbtCacheMetaSnapshot, SbtCardDetails } from './sbtListHelpers';

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
type SbtListItem = UnknownRecord & {
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
type SbtListScopedCacheEntry = UnknownRecord & {
  slug?: unknown;
  value?: unknown;
};
type SbtListScopedEntryOptions = {
  requireConcreteBinding?: boolean;
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
type SbtListHeaderActionsArgs = {
  isOpen: boolean;
};
type SbtSessionUniverseSnapshot = {
  fallbackEntryCount: number;
  registryEntryCount: number;
  registryHydrated: boolean;
  slugs: string[];
};
type SbtListLiveProgress = UnknownRecord & {
  currentBlock?: unknown;
  latestBlock?: unknown;
  updatedAtMs?: number;
};
type SbtListBySlug = Record<string, SbtListItem[] | undefined>;
type SbtListLiveProgressBySlug = Record<string, SbtListLiveProgress | undefined>;
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
type SbtSessionProgressSnapshot = {
  cacheMeta: SbtCacheMetaSnapshot | null;
  cfg: SbtSessionDisplayConfig | null;
  deferred: boolean;
  displayCurrentBlock: number;
  hasCache: boolean;
  hasLatest: boolean;
  lastBlock: number;
  latestForGroup: number | null;
  liveCurrentBlock: number | null;
  liveLatestBlock: number | null;
  liveProgress: SbtListLiveProgress | null;
  remainingBlocks: number | null;
  sbtCount: number;
  scanInProgress: boolean;
  slug: string;
  startBlock: number | null;
};
type SbtSessionLoadingOptions = {
  alwaysShow?: boolean;
  forceShow?: boolean;
};
type SbtSessionLoadingStatus = {
  chipBlockProgressText: string;
  chipRemainingText: string;
  deferred: boolean;
  displayCurrentBlock: number;
  displayName: string;
  hasLatest: boolean;
  lastBlock: number;
  latestForGroup: number | null;
  progressPct: number;
  progressText: string;
  remainingBlocks: number | null;
  scanInProgress: boolean;
  slug: string;
  slugLabel: string;
  statusLabel: string;
};
type SbtSessionLoadingStatusBySlug = Record<string, SbtSessionLoadingStatus | undefined>;
type SbtSessionChipState = {
  hasCards: boolean;
  hasLoadedOnce: boolean;
  isLoaded: boolean;
  isLoading: boolean;
};
type SbtSessionChipStateBySlug = Record<string, SbtSessionChipState | undefined>;
type SbtPassiveLatestLookupState = {
  lastRequestedAtBlock?: unknown;
};
type SbtPassiveLatestLookupStateBySlug = Record<string, SbtPassiveLatestLookupState | undefined>;
type SbtPassiveLatestLookupInFlightBySlug = Record<string, boolean | undefined>;
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
  slugOverride?: unknown
) => Promise<void>;
type SbtListChipProgressMeta = UnknownRecord & {
  lastModeChangeAtMs?: number;
  pendingVisible?: boolean;
  timerId?: ReturnType<typeof setTimeout> | null;
  visible?: boolean;
};
type SbtListChipProgressMetaBySlug = Record<string, SbtListChipProgressMeta | undefined>;
type SbtListBlockWindow = UnknownRecord & {
  toBlock?: unknown;
};
type SbtListGroupPasswordMap = Record<string, boolean | undefined>;
type SbtListPasswordFlagResult = [string, boolean];
type SbtGroupPasswordHashReader = {
  getGroupPasswordHash: (
    providerName: string,
    sbtAddress: string,
    groupKeyOrCfg?: unknown,
    options?: unknown
  ) => Promise<unknown>;
};
type SbtRelevantBlockWindowReader = {
  getRelevantBlockWindowForFilter: (scopeRef: unknown) => Promise<SbtListBlockWindow | unknown>;
};
type HasCachedCreateSbtFormReader = (options?: UnknownRecord) => boolean;
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
const isRecord = (value: unknown): value is UnknownRecord => (
  !!value && typeof value === 'object'
);
const isSbtListPointerEventLike = (value: unknown): value is SbtListPointerEventLike => (
  !!value && typeof value === 'object'
);
const sbtGroupPasswordHashReader = contractScripts as unknown as SbtGroupPasswordHashReader;
const sbtRelevantBlockWindowReader = contractScripts as unknown as SbtRelevantBlockWindowReader;
const hasCachedCreateSbtFormReader = hasCachedCreateSbtForm as unknown as HasCachedCreateSbtFormReader;
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

const hasOwn = (obj: any, key: any) => (
  !!obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, key)
);

const hasAuthoritativeSessionSlug = (obj: any) => {
  if (!hasOwn(obj, 'sessionSlug')) return false;
  const hasExplicitFlag = hasOwn(obj, 'sessionSlugExplicit');
  return obj.sessionSlugExplicit === true || !hasExplicitFlag;
};

const hasExplicitNoSessionAssociation = (sbt: any) => {
  const info = sbt?.sbtInfo;
  if (hasAuthoritativeSessionSlug(info)) {
    return String(info?.sessionSlug ?? '').trim() === '';
  }
  if (hasAuthoritativeSessionSlug(sbt)) {
    return String(sbt?.sessionSlug ?? '').trim() === '';
  }
  return false;
};

const hasMetadataSessionSlugField = (sbt: any) => (
  hasOwn(sbt?.sbtInfo, 'sessionSlug') || hasOwn(sbt, 'sessionSlug')
);

const hasMissingOrEmptySessionSlug = (sbt: any) => {
  if (!hasMetadataSessionSlugField(sbt)) return true;
  return String(sbt?.sbtInfo?.sessionSlug ?? sbt?.sessionSlug ?? '').trim() === '';
};

const isSyntheticNoSessionSlug = (slugIn: any) => (
  normalizeSessionSlug(slugIn || '') === NO_SESSION_UNIVERSE_SLUG
);

const isSessionIdLikeSlug = (raw: any) => {
  const value = String(raw || '').trim();
  if (!value) return false;
  return (
    SESSION_ID_UUID_RE.test(value) ||
    SESSION_ID_HEX_RE.test(value) ||
    SESSION_ID_COMPACT_RE.test(value)
  );
};

const getVisibleSessionSlugsFromEntries = (entries: any = []) => {
  const out: any[] = [];
  const seen: any = new Set();
  (Array.isArray(entries) ? entries : []).forEach((entry: any) => {
    const [key, cfg] = Array.isArray(entry) ? entry : [undefined, undefined];
    const rawSlug = (typeof cfg?.slug === 'string' ? cfg.slug : key) || '';
    const trimmed = String(rawSlug || '').trim();
    const candidate = resolveSessionUniverseEntrySlug(entry, { demoSessionMap: DEMO_SESSION_MAP });
    const isGeneral = candidate === '';
    if (!isGeneral && !candidate) return;
    const idCheckValue = candidate || trimmed;
    if (isSessionIdLikeSlug(idCheckValue)) return;
    if (seen.has(candidate)) return;
    seen.add(candidate);
    out.push(candidate);
  });
  return out;
};

const areStringArraysEqual = (a: any = [], b: any = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (String(a[i]) !== String(b[i])) return false;
  }
  return true;
};

const dedupeNormalizedSlugs = (list: any = []) => {
  const out: any[] = [];
  const seen: any = new Set();
  (Array.isArray(list) ? list : []).forEach((raw: any) => {
    const slug = normalizeSessionSlug(raw);
    if (isSessionIdLikeSlug(slug || raw)) return;
    if (seen.has(slug)) return;
    seen.add(slug);
    out.push(slug);
  });
  return out;
};

const pickNormalizedSessionSlug = (...values: any[]) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = normalizeSessionSlug(value);
    if (normalized != null) return normalized;
  }
  return '';
};

const mergeSbtListsByAddress = (...lists: any[]) => {
  const out: any[] = [];
  const seen: any = new Set();
  lists.forEach((list: any) => {
    (Array.isArray(list) ? list : []).forEach((item: any) => {
      const addrLower = String(item?.sbtAddress || '').trim().toLowerCase();
      if (!addrLower || seen.has(addrLower)) return;
      seen.add(addrLower);
      out.push(item);
    });
  });
  return out;
};

const LIST_MODE_SELECTION_STORAGE_KEY = 'dg:sbtListModeSelectedSessions';
const DG_MANAGED_CACHE_NAMES: any = new Set([
  'questionsCache',
  'surveysCache',
  'bookmarksCache',
  'filters',
  'sbtCache',
  'userCache',
]);
const isManagedDgCacheName = (name: any) => DG_MANAGED_CACHE_NAMES.has(String(name || ''));

const readStoredListModeSelectedSessionSlugs = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(LIST_MODE_SELECTION_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return dedupeNormalizedSlugs(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return [];
  }
};

const sortSlugsByUniverseOrder = (slugs: any = [], universeSlugs: any = []) => {
  const normalizedUniverse = dedupeNormalizedSlugs(universeSlugs);
  const order: any = new Map();
  normalizedUniverse.forEach((slug: any, index: any) => {
    order.set(normalizeSessionSlug(slug), index);
  });
  return dedupeNormalizedSlugs(slugs).sort((aRaw: any, bRaw: any) => {
    const a = normalizeSessionSlug(aRaw);
    const b = normalizeSessionSlug(bRaw);
    const aOrder = order.has(a) ? order.get(a) : Number.MAX_SAFE_INTEGER;
    const bOrder = order.has(b) ? order.get(b) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
};

const getSbtNetHolderCount = (item: any = {}) => {
  const summaryCount = Number(item?.historySummary?.currentHolderCount);
  if (Number.isFinite(summaryCount) && summaryCount >= 0) {
    return Math.floor(summaryCount);
  }
  return Math.max(
    0,
    Number(item?.mintedAddresses?.length || 0) - Number(item?.burnedAddresses?.length || 0)
  );
};

const normalizeSbtItems = (items: any = []) => (
  (Array.isArray(items) ? items : [])
    .filter((item: any) => item && item.sbtAddress && item.sbtInfo)
    .sort((a: any, b: any) => {
      const netA = getSbtNetHolderCount(a);
      const netB = getSbtNetHolderCount(b);
      if (netB !== netA) return netB - netA;
      const addrA = String(a.sbtAddress || '').toLowerCase();
      const addrB = String(b.sbtAddress || '').toLowerCase();
      return addrA.localeCompare(addrB);
    })
);

const getSbtComparableText = (value: any) => String(value ?? '').trim();

const getSbtListItemSignature = (item: any = {}) => {
  const info = item?.sbtInfo || {};
  return [
    String(item?.sbtAddress || '').toLowerCase(),
    normalizeSessionSlug(item?.slug || ''),
    Number(item?.blockNumber || 0),
    Number(getSbtNetHolderCount(item)),
    String(item?.historySummary?.historicalHolderCount || ''),
    normalizeSessionSlug(info?.sessionSlug ?? item?.sessionSlug ?? ''),
    getSbtComparableText(info?.name),
    getSbtComparableText(info?.title),
    getSbtComparableText(info?.description),
    getSbtComparableText(info?.image),
    getSbtComparableText(info?.tokenURI ?? info?.tokenUri),
  ].join('|');
};

export const __test__areSbtListArraysEqual = (a: any = [], b: any = []) => {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (getSbtListItemSignature(a[i]) !== getSbtListItemSignature(b[i])) return false;
  }
  return true;
};

const areSbtListArraysEqual = __test__areSbtListArraysEqual;

const readShowDemoSessions = () => {
  try {
    if (typeof globalThis !== 'undefined' && typeof runtimeGlobal.SHOW_DEMO_SESSIONS !== 'undefined') {
      return !!runtimeGlobal.SHOW_DEMO_SESSIONS;
    }
  } catch (e) { void e; /* fallback: demo visibility lookup. */ }
  return !!SHOW_DEMO_SESSIONS;
};

const readSbtSyncBarResearchBlockStep = () => {
  try {
    if (
      typeof globalThis !== 'undefined' &&
      typeof runtimeGlobal.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP !== 'undefined'
    ) {
      const runtimeValue = Number(runtimeGlobal.CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP);
      if (Number.isFinite(runtimeValue) && runtimeValue > 0) {
        return Math.max(1, Math.floor(runtimeValue));
      }
    }
  } catch (e) { void e; /* fallback: sync-bar research step lookup. */ }

  const defaultValue = Number(CE_SBT_SYNC_BAR_RESEARCH_BLOCK_STEP || 0);
  if (Number.isFinite(defaultValue) && defaultValue > 0) {
    return Math.max(1, Math.floor(defaultValue));
  }
  return 50;
};

// Minimal helpers (cache-first; do not hydrate tokenURI here)
const normalizeGatewayUri = (uri: any, contextLabel: any = 'sbt_list_asset') => {
  if (!uri) return null;
  const s = String(uri).trim();
  if (!s) return null;
  if (/^ipfs:\/\//i.test(s)) return `https://ipfs.io/ipfs/${s.replace(/^ipfs:\/\//i, '')}`;
  return normalizeArweaveUrl(s, { contextLabel });
};

const normalizeTokenUri = (uri: any) => normalizeGatewayUri(uri, 'sbt_list_image');
const normalizeDocumentHref = (uri: any) => normalizeGatewayUri(uri, 'sbt_list_document');

const dedupeCaseInsensitiveStrings = (values: any = []) => {
  const out: any[] = [];
  const seen: any = new Set();
  (Array.isArray(values) ? values : []).forEach((value: any) => {
    const trimmed = String(value || '').trim();
    if (!trimmed) return;
    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(trimmed);
  });
  return out;
};

const collectSbtTagValues = (...candidates: any[]) => {
  const values: any[] = [];
  const visit = (candidate: any) => {
    if (candidate == null) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (typeof candidate === 'string') {
      candidate
        .split(',')
        .map((entry: any) => entry.trim())
        .filter(Boolean)
        .forEach((entry: any) => values.push(entry));
      return;
    }
    if (typeof candidate === 'object') {
      const objectText = [
        candidate.label,
        candidate.name,
        candidate.value,
        candidate.tag,
      ].find((value: any) => typeof value === 'string' && value.trim().length > 0);
      if (objectText) values.push(objectText);
    }
  };
  candidates.forEach(visit);
  return dedupeCaseInsensitiveStrings(values);
};

const collectSbtDocumentUrls = (...candidates: any[]) => {
  const values: any[] = [];
  const visit = (candidate: any) => {
    if (candidate == null) return;
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (typeof candidate === 'string') {
      values.push(candidate);
      return;
    }
    if (typeof candidate === 'object') {
      const documentHref = [
        candidate.url,
        candidate.href,
        candidate.link,
        candidate.documentURL,
        candidate.documentUrl,
        candidate.docURL,
        candidate.docUrl,
        candidate.value,
      ].find((value: any) => typeof value === 'string' && value.trim().length > 0);
      if (documentHref) values.push(documentHref);
    }
  };
  candidates.forEach(visit);
  return dedupeCaseInsensitiveStrings(values);
};

const getSbtCardDetails = (sbt: any) => {
  const sbtInfo = sbt?.sbtInfo || {};
  const tags = collectSbtTagValues(
    sbtInfo.tags,
    sbt.tags,
    sbt.defaultSbtTags,
    sbt.featuredSbtTags,
    sbtInfo.defaultSbtTags,
    sbtInfo.featuredSbtTags,
  );
  const documentUrls = collectSbtDocumentUrls(
    sbtInfo.documentURLs,
    sbtInfo.documentUrls,
    sbtInfo.docURLs,
    sbtInfo.documents,
    sbt.documentURLs,
    sbt.documentUrls,
    sbt.docURLs,
    sbt.documents,
  ).map((rawHref: any) => ({
    href: normalizeDocumentHref(rawHref) || rawHref,
    label: rawHref,
  }));

  return {
    tags,
    documentUrls,
    hasDetails: tags.length > 0 || documentUrls.length > 0,
  };
};
const coerceMintEndSeconds = (v: any) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
};

export const readSbtCacheMetaSnapshot = (slug: any, netKey: any) => {
  if (!netKey) return null;
  try {
    const cache = peekCacheSync('sbtCache', slug, { clone: false });
    if (!cache || typeof cache !== 'object') return null;
    const netCache = cache[netKey];
    return {
      lastBlock: Number(netCache?.lastBlock || 0),
      sbtCount: Object.keys(netCache?.sbtList || {}).length
    };
  } catch (_) {
    return null;
  }
};

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
}: any) => {
  const routeSlug = normalizeSessionSlug(sessionSlug || '');
  // Determine if we should enumerate ALL groups (route-based fallback + explicit prop)
  const allSessionsMode = useMemo(() => {
    if (allSessionsModeProp) return true;
    try {
      const path = (typeof window !== 'undefined' && window.location && window.location.pathname) ? window.location.pathname : '';
      const parts = path.split('/').filter(Boolean);
      return (parts[0] === 'sbts' || parts[0] === 'groups') && parts.length === 1;
    } catch (_) { return false; }
  }, [allSessionsModeProp]);

  const [globalSessionSelectionRevision, setGlobalSessionSelectionRevision] = useState<any>(0);
  const [sessionConfigRevision, setSessionConfigRevision] = useState<any>(0);
  const [activeSessionSlug, setActiveGroupSlug] = useState<any>(() => {
    const globalPrimarySessionSlug = normalizeSessionSlug(readStoredGlobalSessionSelection().primarySessionSlug || '');
    try {
      if (typeof window === 'undefined' || !window.localStorage) return normalizeSessionSlug(routeSlug);
      const stored = window.localStorage.getItem('dg:lastActiveSbtSession');
      if (stored != null) return normalizeSessionSlug(stored);
    } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
    if (globalPrimarySessionSlug) return globalPrimarySessionSlug;
    return normalizeSessionSlug(routeSlug);
  });

  const shouldExpectRegistryUniverse = true;

  const readSessionUniverseSnapshot = useCallback((): SbtSessionUniverseSnapshot => {
    const allEntries = getAllSessionEntries();
    const showDemoSessions = readSbtListShowDemoSessions();
    const customDemoEntries = getCustomDemoSessionEntries(DEMO_SESSION_MAP);
    let registryEntryCount = 0;
    let registryEntries: any[] = [];
    try {
      registryEntries = sessionRegistryStore.getAllSessionEntries();
      registryEntryCount = Array.isArray(registryEntries) ? registryEntries.length : 0;
    } catch (_) {
      registryEntryCount = 0;
    }
    const fallbackEntries = Array.isArray(allEntries) ? allEntries : [];
    const visibleFallbackEntries = filterSessionUniverseEntriesByDemoVisibility(
      fallbackEntries,
      showDemoSessions,
      { demoSessionMap: DEMO_SESSION_MAP }
    );
    const fallbackEntryCount = Array.isArray(fallbackEntries) ? fallbackEntries.length : 0;
    const entriesForUniverse = shouldExpectRegistryUniverse
      ? (registryEntryCount > 0
        ? mergeSessionUniverseEntriesBySlug([registryEntries, customDemoEntries], {
          demoSessionMap: DEMO_SESSION_MAP,
        })
        : visibleFallbackEntries)
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
    setAvailableSessionUniverse((prev: any) => {
      const prevSlugs = Array.isArray(prev?.slugs) ? prev.slugs : [];
      const nextSlugs = Array.isArray(next?.slugs) ? next.slugs : [];
      const prevRegistryCount = Number(prev?.registryEntryCount || 0);
      const nextRegistryCount = Number(next?.registryEntryCount || 0);
      const prevFallbackCount = Number(prev?.fallbackEntryCount || 0);
      const nextFallbackCount = Number(next?.fallbackEntryCount || 0);
      const prevHydrated = !!prev?.registryHydrated;
      const nextHydrated = !!next?.registryHydrated;
      if (
        prevRegistryCount === nextRegistryCount &&
        prevFallbackCount === nextFallbackCount &&
        prevHydrated === nextHydrated &&
        areStringArraysEqual(prevSlugs, nextSlugs)
      ) {
        return prev;
      }
      return next;
    });
    return next;
  }, [readSessionUniverseSnapshot]);

  const [availableSessionUniverse, setAvailableSessionUniverse] = useState<any>(() => readSessionUniverseSnapshot());
  const [showMoreSessions, setShowMoreSessions] = useState<any>(false);
  const [showMoreSessionsLoading, setShowMoreSessionsLoading] = useState<any>(false);
  const [hasNoSessionUniverseItems, setHasNoSessionUniverseItems] = useState<any>(false);
  const availableSessionSlugs = availableSessionUniverse.slugs;
  const registryEntryCount = Number(availableSessionUniverse.registryEntryCount || 0);
  const fallbackEntryCount = Number(availableSessionUniverse.fallbackEntryCount || 0);
  const registryHydrated = !!availableSessionUniverse.registryHydrated;
  const sessionUniverseRegistryPending =
    allSessionsMode &&
    shouldExpectRegistryUniverse &&
    registryEntryCount <= 0 &&
    !registryHydrated;

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
    [listModeConfiguredSessionSlugs]
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

  const baseSessionUniverseSlugs = useMemo<string[]>(() => (
    !isListModeScopeEnabled
      ? availableSessionSlugs
      : listModeConfiguredSessionSlugs
  ), [availableSessionSlugs, isListModeScopeEnabled, listModeConfiguredSessionSlugs]);

  const [selectedSessionSlugs, setSelectedSessionSlugs] = useState<any>(() => (
    readStoredListModeSelectedSessionSlugs()
  ));

  const hiddenRegistrySessionSlugs = useMemo(() => {
    if (!isListModeScopeEnabled) return [];
    const baseSet: any = new Set(baseSessionUniverseSlugs.map((s: any) => normalizeSessionSlug(s)));
    const discoverable = dedupeNormalizedSlugs([
      ...availableSessionSlugs,
      ...registrySessionUniverseSlugs,
    ]);
    return discoverable.filter((slug: any) => !baseSet.has(normalizeSessionSlug(slug)));
  }, [
    availableSessionSlugs,
    baseSessionUniverseSlugs,
    isListModeScopeEnabled,
    registrySessionUniverseSlugs,
  ]);

  const selectedHiddenRegistrySessionSlugs = useMemo(() => {
    if (!isListModeScopeEnabled) return [];
    const hiddenSet: any = new Set(dedupeNormalizedSlugs(hiddenRegistrySessionSlugs));
    return dedupeNormalizedSlugs(selectedSessionSlugs)
      .filter((slug: any) => hiddenSet.has(normalizeSessionSlug(slug)));
  }, [hiddenRegistrySessionSlugs, isListModeScopeEnabled, selectedSessionSlugs]);

  const remainingHiddenRegistrySessionSlugs = useMemo(() => {
    if (!isListModeScopeEnabled) return [];
    const selectedSet: any = new Set(selectedHiddenRegistrySessionSlugs.map((s: any) => normalizeSessionSlug(s)));
    return dedupeNormalizedSlugs(hiddenRegistrySessionSlugs)
      .filter((slug: any) => !selectedSet.has(normalizeSessionSlug(slug)));
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
    [displayedSessionUniverseSlugs]
  );

  const defaultListModeSelectedSessionSlugs = useMemo(() => {
    if (!isListModeScopeEnabled) return [];
    const displayedSet: any = new Set(displayedSessionUniverseSlugsNormalized);
    const configured = dedupeNormalizedSlugs(listModeConfiguredSessionSlugs)
      .filter((slug: any) => displayedSet.has(slug));
    if (configured.length > 0) {
      return sortSlugsByUniverseOrder(configured, displayedSessionUniverseSlugsNormalized);
    }
    const fallbackWithoutNoSession = displayedSessionUniverseSlugsNormalized.filter(
      (slug: any) => !isSyntheticNoSessionSlug(slug)
    );
    const fallbackSelection = fallbackWithoutNoSession.length > 0
      ? fallbackWithoutNoSession
      : displayedSessionUniverseSlugsNormalized;
    return sortSlugsByUniverseOrder(
      fallbackSelection,
      displayedSessionUniverseSlugsNormalized
    );
  }, [
    displayedSessionUniverseSlugsNormalized,
    isListModeScopeEnabled,
    listModeConfiguredSessionSlugs,
  ]);

  const selectedSessionUniverseSlugs = useMemo(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) return [];
    const displayedSet: any = new Set(displayedSessionUniverseSlugsNormalized);
    const userSelected = dedupeNormalizedSlugs(selectedSessionSlugs)
      .filter((slug: any) => displayedSet.has(slug));
    if (userSelected.length > 0) {
      return sortSlugsByUniverseOrder(userSelected, displayedSessionUniverseSlugsNormalized);
    }
    return defaultListModeSelectedSessionSlugs;
  }, [
    allSessionsMode,
    defaultListModeSelectedSessionSlugs,
    displayedSessionUniverseSlugsNormalized,
    isListModeScopeEnabled,
    selectedSessionSlugs,
  ]);

  const selectedSessionUniverseSlugSet = useMemo(
    () => new Set(selectedSessionUniverseSlugs),
    [selectedSessionUniverseSlugs]
  );

  useEffect(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) return;
    if (!displayedSessionUniverseSlugsNormalized.length) return;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(
          SBT_LIST_MODE_SELECTION_STORAGE_KEY,
          JSON.stringify(dedupeNormalizedSbtListSlugs(selectedSessionSlugs))
        );
      }
    } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
  }, [
    allSessionsMode,
    displayedSessionUniverseSlugsNormalized.length,
    isListModeScopeEnabled,
    selectedSessionSlugs
  ]);


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
    const discoverableSet: any = new Set(dedupeNormalizedSlugs([
      ...displayedSessionUniverseSlugsNormalized,
      ...availableSessionSlugs,
      ...registrySessionUniverseSlugs,
      ...hiddenRegistrySessionSlugs,
      ...listModeConfiguredSessionSlugs,
    ]));
    setSelectedSessionSlugs((prev: any) => {
      const normalized = dedupeNormalizedSlugs(prev);
      const clamped = normalized.filter((slug: any) => discoverableSet.has(slug));
      return areStringArraysEqual(normalized, clamped) ? prev : clamped;
    });
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
      } catch (e) { sbtLog.warn('SBTsList: fallback', e); } finally {
        if (!isMounted.current) return;
        syncSessionUniverseFromCache();
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
      setSessionConfigRevision((value: any) => value + 1);
      syncSessionUniverseFromCache();
    };
    const handleGlobalSessionSelectionUpdated = () => {
      if (!isMounted.current) return;
      setGlobalSessionSelectionRevision((value: any) => value + 1);
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
    let retryTimerId: any = null;
    const runRetry = () => {
      if (cancelled || !isMounted.current) return;
      const next = syncSessionUniverseFromCache();
      const nextPending =
        shouldExpectRegistryUniverse &&
        Number(next?.registryEntryCount || 0) <= 0 &&
        !next?.registryHydrated;
      if (!nextPending) return;
      if (attempt >= maxAttempts) return;
      attempt += 1;
      const delayMs = Math.min(8000, attempt * 1500);
      retryTimerId = setTimeout(runRetry, delayMs);
    };
    runRetry();
    return () => {
      cancelled = true;
      if (retryTimerId) clearTimeout(retryTimerId);
    };
  }, [
    allSessionsMode,
    sessionUniverseRegistryPending,
    shouldExpectRegistryUniverse,
    syncSessionUniverseFromCache,
  ]);

  useEffect(() => {
    if (!allSessionsMode) return;
    if (!displayedSessionUniverseSlugs.length) {
      if (activeSessionSlug !== '') setActiveGroupSlug('');
      return;
    }
    if (!displayedSessionUniverseSlugs.includes(activeSessionSlug)) {
      const fallback = displayedSessionUniverseSlugs.includes(routeSlug)
        ? routeSlug
        : (displayedSessionUniverseSlugs[0] || '');
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
        const globalPrimarySessionSlug = normalizeSessionSlug(readStoredGlobalSessionSelection().primarySessionSlug || '');
        if (activeSessionSlug && activeSessionSlug !== globalPrimarySessionSlug) {
          window.localStorage.setItem('dg:lastActiveSbtSession', activeSessionSlug);
        } else {
          window.localStorage.removeItem('dg:lastActiveSbtSession');
        }
      }
    } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
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
    } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
    const nextPrimary = normalizeSessionSlug(readStoredGlobalSessionSelection().primarySessionSlug || '');
    const nextTargetSlug = displayedSessionUniverseSlugs.includes(nextPrimary)
      ? nextPrimary
      : (displayedSessionUniverseSlugs[0] || '');
    if (nextTargetSlug !== activeSessionSlug) {
      setActiveGroupSlug(nextTargetSlug);
    }
  }, [activeSessionSlug, allSessionsMode, displayedSessionUniverseSlugs, globalSessionSelectionRevision]);

  const listSlug = allSessionsMode
    ? (displayedSessionUniverseSlugs.includes(activeSessionSlug)
      ? activeSessionSlug
      : (displayedSessionUniverseSlugs[0] || ''))
    : routeSlug;

  const sectionSessionSlugs = useMemo(() => {
    return resolveSbtListSectionSessionSlugs({
      allSessionsMode,
      isListModeScopeEnabled,
      listSlug,
      selectedSessionUniverseSlugs,
    });
  }, [allSessionsMode, isListModeScopeEnabled, listSlug, selectedSessionUniverseSlugs]);

  const actionableUniverseSessionSlugs = useMemo(() => (
    dedupeNormalizedSlugs(displayedSessionUniverseSlugs).filter(
      (slug: any) => !isSyntheticNoSessionSlug(slug)
    )
  ), [displayedSessionUniverseSlugs]);

  const actionableSectionSessionSlugs = useMemo(() => (
    dedupeNormalizedSlugs(sectionSessionSlugs).filter(
      (slug: any) => !isSyntheticNoSessionSlug(slug)
    )
  ), [sectionSessionSlugs]);

  const resolvedListSlugForGroupLists = isSbtListSyntheticNoSessionSlug(listSlug) ? '' : listSlug;
  const { featured_SBTs_LIST = [], ignored_SBTs_LIST = [] } = getSessionLists(resolvedListSlugForGroupLists);

  const [sbtListBySlug, setSbtListBySlug] = useState<any>({});
  const [sessionLoadStateBySlug, setSessionLoadStateBySlug] = useState<any>({});
  const [sessionHasLoadedOnceBySlug, setSessionHasLoadedOnceBySlug] = useState<any>({});
  const [loading, setLoading] = useState<any>(true);
  const [refreshing, setRefreshing] = useState<any>(false);
  const [revisionSyncPending, setRevisionSyncPending] = useState<any>(false);

  const [excludePasswordLocked, setExcludePasswordLocked] = useState<any>(false);
  // initialize Create Group panel open based on cache presence (idempotent: only initial)
  const [showCreateGroup, setShowCreateGroup] = useState<any>(() => hasCachedCreateSbtFormUntyped({
    sessionSlug: listSlug,
    migrateLegacyToSessionKey: true,
    clearInvalid: true,
  }));
  const [showAdminButtons, setShowAdminButtons] = useState<any>(false);
  const [showLocalSessionSettings, setShowLocalSessionSettings] = useState<any>(false);
  const [expandedSbtAddresses, setExpandedSbtAddresses] = useState<any>(() => new Set());
  const [isUniverseCollapsed, setIsUniverseCollapsed] = useState<any>(() => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return false;
      return window.localStorage.getItem('dg:sbtUniverseCollapsed') === 'true';
    } catch (_) {
      return false;
    }
  });

  /** tracks addresses with a non-zero on-chain groupPasswordHash (unlimited group-password mint) */
  const [groupPasswordMap, setGroupPasswordMap] = useState<any>({}); // {[addrLower]: boolean}

  const [latestBlockBySlug, setLatestBlockBySlug] = useState<any>({});
  const [chipProgressVisibilityBySlug, setChipProgressVisibilityBySlug] = useState<any>({});
  const [sessionCacheMetaBySlug, setSessionCacheMetaBySlug] = useState<any>({});
  const [emptySectionSpinnerActive, setEmptySectionSpinnerActive] = useState<any>(false);
  const [recentLiveProgressNowMs, setRecentLiveProgressNowMs] = useState<any>(() => Date.now());

  const isMounted = useRef<any>(true);
  const refreshSafetyTimeoutRef = useRef<any>(null);
  const emptySectionSpinnerTimeoutRef = useRef<any>(null);
  const recentLiveProgressTimeoutRef = useRef<any>(null);

  const sessionFetchRunBySlugRef = useRef<any>({});
  const sessionHasLoadedOnceRef = useRef<any>(sessionHasLoadedOnceBySlug);
  const sbtListBySlugRef = useRef<any>(sbtListBySlug);
  const listModeUniverseRefreshRequestedRef = useRef<any>(false);
  const recentLiveProgressBySlugRef = useRef<any>({});
  const chipProgressVisibilityMetaRef = useRef<any>({});
  const chipProgressDesiredBySlugRef = useRef<any>({});
  const passiveLatestLookupStateBySlugRef = useRef<any>({});
  const passiveLatestLookupInFlightBySlugRef = useRef<any>({});

  /** tracks if the component has *ever* completed a successful load */
  const initialLoadCompletedRef = useRef<any>(false);

  const lastInitDepsRef = useRef<any>({
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

  const usesTopLevelSessionSettingsSurface = allSessionsMode && (
    (!miniaturized && !embeddedMode) ||
    (miniaturized && viewMode === 'modal' && communityTabCompactSettings)
  );
  const usesFallbackSessionSettingsToggle = allSessionsMode && !usesTopLevelSessionSettingsSurface;
  const isSessionSelectorOpen = usesTopLevelSessionSettingsSurface
    ? showAdminButtons
    : showLocalSessionSettings;
  const sessionSelectorPanelId = 'session-selector-panel';
  const hideSessionUniverseSummary = miniaturized && viewMode === 'modal' && communityTabCompactSettings;

  const clearChipProgressVisibilityTimeout = useCallback((slugIn: any) => {
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
    Object.keys(chipProgressVisibilityMetaRef.current || {}).forEach((slug: any) => {
      clearChipProgressVisibilityTimeout(slug);
    });
  }, [clearChipProgressVisibilityTimeout]);

  const pruneRecentLiveProgress = useCallback((nowMs: any = Date.now(), activeSlugs: any = new Set()) => {
    let changed = false;
    Object.keys(recentLiveProgressBySlugRef.current).forEach((slug: any) => {
      if (activeSlugs.has(slug)) return;
      const ageMs = nowMs - Number(recentLiveProgressBySlugRef.current[slug]?.updatedAtMs || 0);
      if (ageMs > SBT_LIVE_PROGRESS_BRIDGE_MS) {
        delete recentLiveProgressBySlugRef.current[slug];
        changed = true;
      }
    });
    return changed;
  }, []);

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
    clearRefreshSafetyTimeout
  ]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('dg:sbtUniverseCollapsed', isUniverseCollapsed ? 'true' : 'false');
      }
    } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
  }, [isUniverseCollapsed]);

  useEffect(() => {
    sessionHasLoadedOnceRef.current = sessionHasLoadedOnceBySlug;
  }, [sessionHasLoadedOnceBySlug]);

  useEffect(() => {
    sbtListBySlugRef.current = sbtListBySlug;
  }, [sbtListBySlug]);

  const hasNoSessionCards = useMemo(() => (
    Object.values(sbtListBySlug || {}).some((list: any) => (
      Array.isArray(list) && list.some((item: any) => (
        hasExplicitNoSessionAssociation(item) || (
          allSessionsMode &&
          isListModeScopeEnabled &&
          hasSbtListMissingOrEmptySessionSlug(item)
        )
      ))
    ))
  ), [allSessionsMode, isListModeScopeEnabled, sbtListBySlug]);

  useEffect(() => {
    if (!allSessionsMode) {
      if (hasNoSessionUniverseItems) setHasNoSessionUniverseItems(false);
      return;
    }
    setHasNoSessionUniverseItems((prev: any) => (
      prev === hasNoSessionCards ? prev : hasNoSessionCards
    ));
  }, [allSessionsMode, hasNoSessionCards, hasNoSessionUniverseItems]);

  useLayoutEffect(() => {
    const liveProgressBySlug: Record<string, unknown> = (
      sbtScanProgressBySlug &&
      typeof sbtScanProgressBySlug === 'object'
    ) ? sbtScanProgressBySlug as Record<string, unknown> : {};
    const nowMs = Date.now();
    const nextSeen: any = new Set();

    Object.entries(liveProgressBySlug).forEach(([slugRaw, progressRaw]: any) => {
      const slug = normalizeSessionSlug(slugRaw || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return;
      const progress = isRecord(progressRaw) ? progressRaw as SbtListLiveProgress : null;
      if (!progress) return;

      const currentBlock = Number(progress.currentBlock || 0);
      const latestBlock = Number(progress.latestBlock || 0);
      if (
        (!Number.isFinite(currentBlock) || currentBlock <= 0) &&
        (!Number.isFinite(latestBlock) || latestBlock <= 0)
      ) {
        return;
      }

      recentLiveProgressBySlugRef.current[slug] = {
        ...recentLiveProgressBySlugRef.current[slug],
        ...progress,
        currentBlock: Number.isFinite(currentBlock) ? Math.floor(currentBlock) : 0,
        latestBlock: Number.isFinite(latestBlock) ? Math.floor(latestBlock) : 0,
        updatedAtMs: nowMs,
      };
      nextSeen.add(slug);
    });

    pruneRecentLiveProgress(nowMs, nextSeen);
  }, [pruneRecentLiveProgress, sbtScanProgressBySlug]);

  useEffect(() => {
    clearRecentLiveProgressTimeout();

    const activeSlugs: any = new Set(
      Object.keys(
        (sbtScanProgressBySlug && typeof sbtScanProgressBySlug === 'object')
          ? sbtScanProgressBySlug
          : {}
      )
        .map((slugRaw: any) => normalizeSessionSlug(slugRaw || ''))
        .filter((slug: any) => slug && !isSyntheticNoSessionSlug(slug))
    );
    const nowMs = Date.now();
    if (pruneRecentLiveProgress(nowMs, activeSlugs)) {
      setRecentLiveProgressNowMs(nowMs);
    }

    let soonestExpiryAtMs: any = null;
    Object.keys(recentLiveProgressBySlugRef.current).forEach((slug: any) => {
      if (activeSlugs.has(slug)) return;
      const updatedAtMs = Number(recentLiveProgressBySlugRef.current[slug]?.updatedAtMs || 0);
      if (!updatedAtMs) return;
      const expiryAtMs = updatedAtMs + SBT_LIVE_PROGRESS_BRIDGE_MS;
      if (expiryAtMs <= nowMs) return;
      soonestExpiryAtMs = soonestExpiryAtMs == null
        ? expiryAtMs
        : Math.min(soonestExpiryAtMs, expiryAtMs);
    });

    if (soonestExpiryAtMs == null) return undefined;
    recentLiveProgressTimeoutRef.current = setTimeout(() => {
      const nextNowMs = Date.now();
      const didPrune = pruneRecentLiveProgress(nextNowMs, activeSlugs);
      if (didPrune) {
        setRecentLiveProgressNowMs(nextNowMs);
      }
    }, Math.max(0, soonestExpiryAtMs - nowMs) + 10);

    return clearRecentLiveProgressTimeout;
  }, [clearRecentLiveProgressTimeout, pruneRecentLiveProgress, sbtScanProgressBySlug]);

  const getDisplaySessionConfig = useCallback((slugIn: any) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return null;
    return (
      getSessionConfigBySlug(slug)
      || getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
      || null
    );
  }, []);

  const labelForSessionSlug = useCallback((slugIn: any) => {
    const normalized = normalizeSessionSlug(slugIn || '');
    if (isSbtListSyntheticNoSessionSlug(normalized)) return 'No Session';
    if (!normalized) return 'General';
    const cfg = getDisplaySessionConfig(normalized);
    return cfg?.sessionName || normalized;
  }, [getDisplaySessionConfig]);

  const embeddedCreateGroupLockGateSources = useMemo(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) return [];
    return dedupeNormalizedSlugs(selectedSessionUniverseSlugs)
      .filter((slug: any) => !isSyntheticNoSessionSlug(slug))
      .map((slug: any) => {
        const sessionConfig = getDisplaySessionConfig(slug);
        if (!sessionConfig || typeof sessionConfig !== 'object') return null;
        return {
          sessionSlug: slug,
          sessionConfig,
        };
      })
      .filter(Boolean);
  }, [
    allSessionsMode,
    getDisplaySessionConfig,
    isListModeScopeEnabled,
    selectedSessionUniverseSlugs,
  ]);

  // Derive netKey from group config (not wallet) - helper used for cache watermark UI
  const deriveGroupNetKey = useCallback((slugIn: any) => {
    if (isSyntheticNoSessionSlug(slugIn)) return '';
    try {
      const chainId = getSessionChainId(slug);
      return chainId != null ? String(chainId) : '';
    } catch (_) {
      return '';
    }
  }, []);

  const deriveCacheNetKeyForSlug = useCallback((slugIn: any) => {
    if (isSyntheticNoSessionSlug(slugIn)) return '';
    try {
      const chainId = getSessionChainId(slug);
      if (chainId) return String(chainId);
    } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
    return String(network?.id || '');
  }, [network?.id]);

  const formatBlockCount = useCallback((value: any) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString() : '-';
  }, []);

  const updateSessionCacheMeta = useCallback((slugIn: any, metaIn: any = null) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (!slug && slug !== '') return;
    if (!metaIn || typeof metaIn !== 'object') return;

    const nextMeta: SbtCacheMetaSnapshot = {
      lastBlock: Math.max(0, Number(metaIn?.lastBlock || 0)),
      sbtCount: Math.max(0, Number(metaIn?.sbtCount || 0)),
    };

    setSessionCacheMetaBySlug((prev: any) => {
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
  }, []);

  const readSbtCacheMeta = useCallback((slug: any) => {
    try {
      const netKey = deriveGroupNetKey(slug);
      const syncMeta = readSbtListCacheMetaSnapshot(slug, netKey);
      const normalizedSlug = normalizeSessionSlug(slug || '');
      const localMeta = sessionCacheMetaBySlug[normalizedSlug] || null;
      if (!syncMeta && !localMeta) return null;
      return {
        lastBlock: Math.max(
          Number(syncMeta?.lastBlock || 0),
          Number(localMeta?.lastBlock || 0)
        ),
        sbtCount: Math.max(
          Number(syncMeta?.sbtCount || 0),
          Number(localMeta?.sbtCount || 0)
        ),
      };
    } catch (_) {
      const normalizedSlug = normalizeSessionSlug(slug || '');
      return sessionCacheMetaBySlug[normalizedSlug] || null;
    }
  }, [deriveGroupNetKey, sessionCacheMetaBySlug]);

  const hasResolvableSessionWorker = useCallback((slugIn: any) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return true;
    return hasUsableSessionWorkerConfig({
      slug,
      sessionConfig: getDisplaySessionConfig(slug),
      allowSharedFallback: true,
    });
  }, [getDisplaySessionConfig]);

  const readBooleanFlag = useCallback((name: any, slug: any) => {
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
  }, [hasResolvableSessionWorker]);

  const resolveConcreteSessionBindingSlug = useCallback((sbt: SbtListItem | null | undefined): string | null => {
    return resolveSbtListConcreteSessionBindingSlug(sbt, { getSessionSlugByName });
  }, []);

  const resolveSbtSessionSlug = useCallback((sbt: SbtListItem | null | undefined): string => {
    return resolveSbtListItemSessionSlug(sbt, {
      allSessionsMode,
      isListModeScopeEnabled,
      listSlug,
      resolveConcreteSessionBindingSlug,
    });
  }, [allSessionsMode, isListModeScopeEnabled, listSlug, resolveConcreteSessionBindingSlug]);

  const collectLinkedScopedSbtEntries = useCallback((targetSlugs: any = [], options: any = {}) => {
    const targetSlugSet: any = new Set(dedupeNormalizedSlugs(targetSlugs));
    if (targetSlugSet.size === 0) return [];

    let knownEntries: any[] = [];
    try {
      const entries = listNamespaceEntriesSync('sbtCache', { cloneValues: false });
      knownEntries = Array.isArray(entries) ? entries as SbtListScopedCacheEntry[] : [];
    } catch (_) {
      return [];
    }

    const requireConcreteBinding = options?.requireConcreteBinding === true;
    const out: any[] = [];
    const seen: any = new Set();

    (Array.isArray(knownEntries) ? knownEntries : []).forEach(({ slug: cacheSlug, value }: any) => {
      const sourceSlug = normalizeSessionSlug(cacheSlug || '');
      const cacheValue = isRecord(value) ? value : null;
      if (!cacheValue) return;

      Object.values(cacheValue).forEach((netNode: any) => {
        const scopedList = (
          netNode &&
          typeof netNode === 'object' &&
          netNode.sbtList &&
          typeof netNode.sbtList === 'object'
        ) ? netNode.sbtList : null;
        if (!scopedList) return;

        Object.entries(scopedList).forEach(([cacheAddress, entry]: any) => {
          const rawEntry = (entry && typeof entry === 'object') ? entry : {};
          const entryWithSource = {
            ...rawEntry,
            sbtAddress: rawEntry?.sbtAddress || cacheAddress,
            __sourceSessionSlug: pickNormalizedSbtListSessionSlug(rawEntry?.__sourceSessionSlug, sourceSlug),
            slug: pickNormalizedSbtListSessionSlug(rawEntry?.slug, sourceSlug),
          };
          const addrLower = String(entryWithSource?.sbtAddress || '').trim().toLowerCase();
          if (!addrLower || seen.has(addrLower)) return;

          const concreteBindingSlug = resolveConcreteSessionBindingSlug(entryWithSource);
          const bindingInScope = (
            concreteBindingSlug != null &&
            targetSlugSet.has(normalizeSessionSlug(concreteBindingSlug))
          );
          if (requireConcreteBinding && !bindingInScope) return;

          const resolvedSlug = normalizeSessionSlug(
            resolveSbtSessionSlug(entryWithSource) || entryWithSource?.slug || sourceSlug
          );
          const resolvedInScope = targetSlugSet.has(resolvedSlug);
          if (!requireConcreteBinding && !bindingInScope && !resolvedInScope) return;

          seen.add(addrLower);
          out.push(
            bindingInScope
              ? { ...entryWithSource, slug: normalizeSessionSlug(concreteBindingSlug || '') }
              : { ...entryWithSource, slug: resolvedSlug }
          );
        });
      });
    });

    return out;
  }, [resolveConcreteSessionBindingSlug, resolveSbtSessionSlug]);

  const sbtList = useMemo(() => {
    if (!allSessionsMode || !isListModeScopeEnabled) {
      const slug = normalizeSessionSlug(listSlug || '');
      if (allSessionsMode && isSyntheticNoSessionSlug(slug)) {
        const deduped: any[] = [];
        const seen: any = new Set();
        Object.entries(sbtListBySlug || {}).forEach(([bucketSlug, bucketItems]: any) => {
          const normalizedBucketSlug = normalizeSessionSlug(bucketSlug || '');
          (Array.isArray(bucketItems) ? bucketItems : []).forEach((item: any) => {
            const itemWithSource = (
              item && item.__sourceSessionSlug === normalizedBucketSlug
                ? item
                : { ...(item || {}), __sourceSessionSlug: normalizedBucketSlug }
            );
            const addrLower = String(itemWithSource?.sbtAddress || '').toLowerCase();
            if (!addrLower) return;
            if (resolveSbtSessionSlug(itemWithSource) !== SBT_LIST_NO_SESSION_UNIVERSE_SLUG) return;
            if (seen.has(addrLower)) return;
            seen.add(addrLower);
            deduped.push(itemWithSource);
          });
        });
        return mergeSbtListsByAddress(
          deduped,
          collectLinkedScopedSbtEntries([SBT_LIST_NO_SESSION_UNIVERSE_SLUG])
        );
      }
      const list = sbtListBySlug[slug];
      const rawList = Array.isArray(list) ? list : [];
      if (!allSessionsMode && slug && !isSbtListSyntheticNoSessionSlug(slug)) {
        return mergeSbtListsByAddress(
          rawList.filter((item: any) => resolveConcreteSessionBindingSlug(item) === slug),
          collectLinkedScopedSbtEntries([slug], { requireConcreteBinding: true })
        );
      }
      return mergeSbtListsByAddress(
        rawList,
        collectLinkedScopedSbtEntries([slug])
      );
    }
    const selectedSlugs = dedupeNormalizedSbtListSlugs(sectionSessionSlugs);
    if (!selectedSlugs.length) return [];
    const selectedSlugSet: any = new Set(selectedSlugs.map((slug: any) => normalizeSessionSlug(slug)));
    const bucketsToScan = dedupeNormalizedSlugs([
      ...selectedSlugs,
      ...Object.keys(sbtListBySlug),
    ]);
    const deduped: any[] = [];
    const seen: any = new Set();
    bucketsToScan.forEach((slug: any) => {
      const normalized = normalizeSessionSlug(slug || '');
      const list = Array.isArray(sbtListBySlug[normalized]) ? sbtListBySlug[normalized] : [];
      list.forEach((item: any) => {
        const itemWithSource = (
          item && item.__sourceSessionSlug === normalized
            ? item
            : { ...(item || {}), __sourceSessionSlug: normalized }
        );
        const addrLower = String(item?.sbtAddress || '').toLowerCase();
        if (!addrLower) return;
        const itemSlug = normalizeSessionSlug(resolveSbtSessionSlug(itemWithSource) || normalized);
        if (!selectedSlugSet.has(itemSlug)) return;
        if (seen.has(addrLower)) return;
        seen.add(addrLower);
        deduped.push(itemWithSource);
      });
    });
    return mergeSbtListsByAddress(
      deduped,
      collectLinkedScopedSbtEntries(selectedSlugs)
    );
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

  const fetchSessionSlugs = useMemo(() => (
    allSessionsMode && isListModeScopeEnabled
      ? (actionableSectionSessionSlugs.length > 0
        ? actionableSectionSessionSlugs
        : actionableUniverseSessionSlugs)
      : (isSbtListSyntheticNoSessionSlug(listSlug) ? actionableUniverseSessionSlugs : [normalizeSessionSlug(listSlug || '')])
  ), [
    actionableSectionSessionSlugs,
    actionableUniverseSessionSlugs,
    allSessionsMode,
    isListModeScopeEnabled,
    listSlug,
  ]);

  const getScopeBypassSessionRef = useCallback((slugIn: any) => {
    const slug = normalizeSessionSlug(slugIn);
    if (!allSessionsMode) return slug;
    const cfg = getDisplaySessionConfig(slug);
    return {
      ...(cfg && typeof cfg === 'object' ? cfg : {}),
      slug,
      __ignoreSessionScanScope: true,
    };
  }, [allSessionsMode, getDisplaySessionConfig]);

  const refreshLatestBlocks = useCallback(async (slugs: any, force: any = false) => {
    const targets = Array.from(new Set(
      (Array.isArray(slugs) ? slugs : [listSlug]).map((slug: any) => normalizeSessionSlug(slug))
    ));
    if (!targets.length) return;

    const updates: Record<string, any> = {};
    await Promise.all(targets.map(async (slug: any) => {
      if (!force && !isMounted.current) return;
      try {
        const scopeRef = getScopeBypassSessionRef(slug);
        const blockWindowRef = force
          ? (
            scopeRef && typeof scopeRef === 'object'
              ? { ...scopeRef, __forceLatestBlock: true }
              : { slug, __forceLatestBlock: true }
          )
          : scopeRef;
        const { toBlock } = await contractScriptsUntyped.getRelevantBlockWindowForFilter(
          blockWindowRef
        ) as SbtListBlockWindow;
        const latest = Number(toBlock || 0);
        if (Number.isFinite(latest) && latest > 0) {
          updates[slug] = latest;
        }
      } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
    }));

    if (!isMounted.current) return;
    if (!Object.keys(updates).length) return;
    setLatestBlockBySlug((prev: any) => {
      let changed = false;
      const next = { ...prev };
      Object.entries(updates).forEach(([slug, block]: any) => {
        if (Number(next[slug] || 0) !== Number(block || 0)) {
          next[slug] = Number(block);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [listSlug, getScopeBypassSessionRef]);

  const getSessionProgressSnapshot = useCallback((slugIn: any) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return null;

    const cfg = getDisplaySessionConfig(slug) as SbtSessionDisplayConfig | null;
    const cacheMeta = readSbtCacheMeta(slug);
    const scanProgressBySlug = (
      sbtScanProgressBySlug &&
      typeof sbtScanProgressBySlug === 'object'
    ) ? sbtScanProgressBySlug : {};
    const liveProgressFromProps: SbtListLiveProgress | null = isRecord(scanProgressBySlug[slug])
      ? scanProgressBySlug[slug] as SbtListLiveProgress
      : null;
    const scanInProgressRaw = readBooleanFlag('sbt:fullScanInProgress', slug);
    const deferredRaw = readBooleanFlag('sbt:deferredFullScanNeeded', slug);
    const bridgedLiveProgress = !liveProgressFromProps
      ? recentLiveProgressBySlugRef.current[slug] || null
      : null;
    return buildSbtListSessionProgressSnapshot({
      allSessionsMode,
      bridgeMs: SBT_LIVE_PROGRESS_BRIDGE_MS,
      bridgeTailBlocks: SBT_LIVE_PROGRESS_BRIDGE_TAIL_BLOCKS,
      bridgedLiveProgress,
      cacheMeta,
      cfg: cfg as UnknownRecord | null,
      deferredRaw,
      latestBlock: latestBlockBySlug[slug],
      liveProgressFromProps,
      recentLiveProgressNowMs,
      scanInProgressRaw,
      slug,
    }) as SbtSessionProgressSnapshot;
  }, [
    allSessionsMode,
    getDisplaySessionConfig,
    latestBlockBySlug,
    recentLiveProgressNowMs,
    readBooleanFlag,
    readSbtCacheMeta,
    sbtScanProgressBySlug,
  ]);

  const deriveSessionLoadingStatus = useCallback((slugIn: any, options: any = {}) => {
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
  }, [
    allSessionsMode,
    getSessionProgressSnapshot,
    loading,
    formatBlockCount,
  ]);

  const loadingSessionStatuses = useMemo(() => {
    if (typeof window === 'undefined') return [];
    const uniqueSlugs = loaderSessionSlugs;
    const statuses = uniqueSlugs
      .map((slug: any) => deriveSessionLoadingStatus(slug))
      .filter(Boolean)
      .map((status: any) => ({ ...status, slug: status.slugLabel }));
    const fallbackSlug = normalizeSessionSlug(listSlug || '');
    if (!statuses.length && fallbackSlug) {
      const fallback = deriveSessionLoadingStatus(fallbackSlug, { forceShow: true });
      if (fallback) statuses.push({ ...fallback, slug: fallback.slugLabel });
    }
    return statuses;
  }, [
    deriveSessionLoadingStatus,
    loaderSessionSlugs,
    listSlug,
  ]);

  const chipLoadingStatusBySlug = useMemo(() => {
    if (!allSessionsMode) return {};
    const out: Record<string, any> = {};
    const chipSlugs = dedupeNormalizedSlugs(displayedSessionUniverseSlugs);
    chipSlugs.forEach((slug: any) => {
      const normalizedSlug = normalizeSessionSlug(slug || '');
      if (
        isListModeScopeEnabled &&
        !selectedSessionUniverseSlugSet.has(normalizedSlug)
      ) {
        return;
      }
      const status = deriveSessionLoadingStatus(normalizedSlug, { alwaysShow: true });
      if (!status) return;
      out[normalizedSlug] = status;
    });
    return out;
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
    }) as SbtSessionChipStateBySlug;
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
    if (!allSessionsMode) return {};
    const out: Record<string, any> = {};
    Object.entries(chipLoadingStatusBySlug).forEach(([slugRaw, status]: any) => {
      const slug = normalizeSessionSlug(slugRaw || '');
      if (isSbtListSyntheticNoSessionSlug(slug) || !status) return;
      const chipState = sessionChipStateBySlug[slug];
      out[slug] = !!chipState?.isLoading;
    });
    return out;
  }, [allSessionsMode, chipLoadingStatusBySlug, sessionChipStateBySlug]);

  const commitChipProgressVisibility = useCallback((slugIn: any, visible: any, nowMs: any = Date.now()) => {
    const slug = normalizeSessionSlug(slugIn || '');
    if (isSbtListSyntheticNoSessionSlug(slug)) return;

    clearChipProgressVisibilityTimeout(slug);
    const previousMeta = chipProgressVisibilityMetaRef.current[slug] || {};
    chipProgressVisibilityMetaRef.current[slug] = {
      ...previousMeta,
      visible: !!visible,
      pendingVisible: !!visible,
      lastModeChangeAtMs: Math.max(0, Number(nowMs || Date.now()) || 0),
      timerId: null,
    };
    setChipProgressVisibilityBySlug((prev: any) => {
      const currentlyVisible = !!prev?.[slug];
      if (currentlyVisible === !!visible) {
        if (!!visible === false && !Object.prototype.hasOwnProperty.call(prev || {}, slug)) {
          return prev;
        }
        if (!!visible) return prev;
      }
      const next = { ...(prev || {}) };
      if (visible) next[slug] = true;
      else delete next[slug];
      return next;
    });
  }, [clearChipProgressVisibilityTimeout]);

  useEffect(() => {
    chipProgressDesiredBySlugRef.current = chipProgressDesiredVisibilityBySlug;
    const desiredSlugs: any = new Set(Object.keys(chipProgressDesiredVisibilityBySlug || {}));
    const knownSlugs: any = new Set([
      ...Object.keys(chipProgressVisibilityMetaRef.current || {}),
      ...desiredSlugs,
    ]);
    const nowMs = Date.now();

    knownSlugs.forEach((slug: any) => {
      const normalizedSlug = normalizeSessionSlug(slug || '');
      if (!desiredSlugs.has(normalizedSlug)) {
        clearChipProgressVisibilityTimeout(normalizedSlug);
        delete chipProgressVisibilityMetaRef.current[normalizedSlug];
        setChipProgressVisibilityBySlug((prev: any) => {
          if (!Object.prototype.hasOwnProperty.call(prev || {}, normalizedSlug)) return prev;
          const next = { ...(prev || {}) };
          delete next[normalizedSlug];
          return next;
        });
        return;
      }

      const desiredVisible = !!chipProgressDesiredVisibilityBySlug[normalizedSlug];
      const existingMeta = chipProgressVisibilityMetaRef.current[normalizedSlug];
      if (!existingMeta) {
        chipProgressVisibilityMetaRef.current[normalizedSlug] = {
          visible: desiredVisible,
          pendingVisible: desiredVisible,
          lastModeChangeAtMs: nowMs,
          timerId: null,
        };
        if (desiredVisible) {
          setChipProgressVisibilityBySlug((prev: any) => {
            if (prev?.[normalizedSlug]) return prev;
            return { ...(prev || {}), [normalizedSlug]: true };
          });
        }
        return;
      }

      if (!!existingMeta.visible === desiredVisible) {
        clearChipProgressVisibilityTimeout(normalizedSlug);
        chipProgressVisibilityMetaRef.current[normalizedSlug] = {
          ...existingMeta,
          pendingVisible: desiredVisible,
          timerId: null,
        };
        return;
      }

      const elapsedMs = nowMs - Number(existingMeta.lastModeChangeAtMs || 0);
      if (elapsedMs >= SBT_CHIP_PROGRESS_VISIBILITY_MIN_INTERVAL_MS) {
        commitChipProgressVisibility(normalizedSlug, desiredVisible, nowMs);
        return;
      }

      if (existingMeta.timerId && existingMeta.pendingVisible === desiredVisible) {
        return;
      }

      clearChipProgressVisibilityTimeout(normalizedSlug);
      const delayMs = Math.max(0, SBT_CHIP_PROGRESS_VISIBILITY_MIN_INTERVAL_MS - elapsedMs);
      const timerId = setTimeout(() => {
        const nextDesiredVisible = !!chipProgressDesiredBySlugRef.current?.[normalizedSlug];
        commitChipProgressVisibility(normalizedSlug, nextDesiredVisible, Date.now());
      }, delayMs);
      chipProgressVisibilityMetaRef.current[normalizedSlug] = {
        ...existingMeta,
        pendingVisible: desiredVisible,
        timerId,
      };
    });
  }, [
    chipProgressDesiredVisibilityBySlug,
    clearChipProgressVisibilityTimeout,
    commitChipProgressVisibility,
  ]);

  const sectionSessionDiscoveryPending = useMemo(() => {
    if (!sectionSessionSlugs.length) return false;
    return sectionSessionSlugs.some((slugRaw: any) => {
      const slug = normalizeSessionSlug(slugRaw || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) {
        const anySessionLoaded = Object.values(sessionHasLoadedOnceBySlug).some(Boolean);
        if (refreshing) return true;
        if (hasNoSessionCards) return false;
        if (!isSBTCacheReady) return true;
        if (sessionUniverseRegistryPending) return true;
        return !anySessionLoaded;
      }
      const hasLoadedOnce = !!sessionHasLoadedOnceBySlug[slug];
      const hasCards = Array.isArray(sbtListBySlug[slug]) && sbtListBySlug[slug].length > 0;
      const loadState = sessionLoadStateBySlug[slug] || 'idle';
      const snapshot = getSessionProgressSnapshot(slug);
      const scanInProgress = !!snapshot?.scanInProgress;
      const deferred = !!snapshot?.deferred;
      const hasKnownLatest = !!snapshot?.hasLatest;
      const blocksRemaining = Number(snapshot?.remainingBlocks || 0);
      if (loadState === 'loading') return true;
      if (refreshing) return true;
      if (!hasCards && !isSBTCacheReady) return true;
      if (!hasCards && hasKnownLatest && blocksRemaining > 0 && (
        !isSBTCacheReady || scanInProgress || deferred || revisionSyncPending
      )) return true;
      if (!hasCards && sessionUniverseRegistryPending) return true;
      return !hasLoadedOnce && !hasCards;
    });
  }, [
    isSBTCacheReady,
    getSessionProgressSnapshot,
    revisionSyncPending,
    refreshing,
    hasNoSessionCards,
    sectionSessionSlugs,
    sbtListBySlug,
    sessionHasLoadedOnceBySlug,
    sessionLoadStateBySlug,
    sessionUniverseRegistryPending,
  ]);

  const sectionSessionSearchFlag = useMemo(() => (
    sectionSessionSlugs.some((slugRaw: any) => {
      const slug = normalizeSessionSlug(slugRaw || '');
      const snapshot = getSessionProgressSnapshot(slug);
      return !!(snapshot?.scanInProgress || snapshot?.deferred);
    })
  ), [sectionSessionSlugs, getSessionProgressSnapshot]);

  const shouldKeepSectionSpinnersOn = (
    loading ||
    refreshing ||
    revisionSyncPending ||
    sectionSessionDiscoveryPending ||
    sectionSessionSearchFlag
  );
  const refreshButtonBusy = (
    refreshing ||
    sectionSessionDiscoveryPending ||
    sectionSessionSearchFlag
  );
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
        setEmptySectionSpinnerActive((prev: any) => (prev ? false : prev));
      }
    }, SECTION_SPINNER_HIDE_DELAY_MS);
  }, [
    clearEmptySectionSpinnerTimeout,
    emptySectionSpinnerActive,
    shouldKeepSectionSpinnersOn,
  ]);

  const primeSbtCardsFromSyncCache = useCallback((slugList: any = []) => {
    const targets = dedupeNormalizedSlugs(slugList);
    let primed = false;

    targets.forEach((slug: any) => {
      if (isSyntheticNoSessionSlug(slug)) return;
      const netKey = deriveCacheNetKeyForSlug(slug);
      if (!netKey) return;

      let cache: any = null;
      try {
        cache = peekCacheSync('sbtCache', slug, { clone: false });
      } catch (_) {
        cache = null;
      }
      if (!isRecord(cache)) return;

      const netCache = isRecord(cache[netKey]) ? cache[netKey] : {};

      const hydrated = normalizeSbtListItems(Object.values(isRecord(netCache.sbtList) ? netCache.sbtList : {}));
      if (!hydrated.length) return;

      updateSessionCacheMeta(slug, {
        lastBlock: Number(netCache?.lastBlock || 0),
        sbtCount: hydrated.length,
      });

      primed = true;
      setSbtListBySlug((prev: any) => {
        const existing = Array.isArray(prev[slug]) ? prev[slug] : [];
        if (areSbtListArraysEqual(existing, hydrated)) return prev;
        return { ...prev, [slug]: hydrated };
      });
      setSessionHasLoadedOnceBySlug((prev: any) => (
        prev[slug] ? prev : { ...prev, [slug]: true }
      ));
      setSessionLoadStateBySlug((prev: any) => {
        if (prev[slug] === 'loading') return prev;
        if (prev[slug] === 'loaded') return prev;
        return { ...prev, [slug]: 'loaded' };
      });
    });

    return primed;
  }, [deriveCacheNetKeyForSlug, updateSessionCacheMeta]);

  // Effect: initial data fetch + polling setup / teardown
  useEffect(() => {
    isMounted.current = true;
    const universeSignature = Array.isArray(displayedSessionUniverseSlugs)
      ? displayedSessionUniverseSlugs.join('|')
      : '';
    const selectedSessionSignature = Array.isArray(fetchSessionSlugs)
      ? fetchSessionSlugs.join('|')
      : '';
    const prevInitDeps = lastInitDepsRef.current || {};
    const prevRevision = Number(prevInitDeps.sbtCacheRevision || 0);
    const nextRevision = Number(sbtCacheRevision || 0);
    const slugChanged = prevInitDeps.listSlug !== listSlug;
    const modeChanged = prevInitDeps.allSessionsMode !== allSessionsMode;
    const selectionChanged = prevInitDeps.selectedSessionSignature !== selectedSessionSignature;
    const universeChanged = prevInitDeps.universeSignature !== universeSignature;
    const registryPendingChanged = (
      prevInitDeps.sessionUniverseRegistryPending !== sessionUniverseRegistryPending
    );
    const revisionOnlyTick = (
      initialLoadCompletedRef.current &&
      !slugChanged &&
      !modeChanged &&
      !selectionChanged &&
      !universeChanged &&
      !registryPendingChanged &&
      prevRevision !== nextRevision
    );
    const shouldShowBlockingLoader = !revisionOnlyTick;
    if (!revisionOnlyTick) {
      setRevisionSyncPending((prev: any) => (prev ? false : prev));
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
          // Let MainSite own tokenURI hydration during light discovery
          const runLightDiscovery = ensureLightSbtDiscoveryRef.current;
          if (shouldShowLoaderForThisRun && typeof runLightDiscovery === 'function') {
            await Promise.all(targets.map(async (slug: string) => {
              try {
                await runLightDiscovery(
                  slug,
                  allSessionsMode ? { force: true, forceScopeSlug: slug } : undefined
                );
              } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
            }));
          }
          const runFetchSBTs = fetchSBTsRef.current;
          if (typeof runFetchSBTs === 'function') {
            await Promise.all(targets.map((slug: string) => runFetchSBTs(false, false, slug)));
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
    primeSbtCardsFromSyncCache,
    sessionUniverseRegistryPending,
  ]);

  useEffect(() => {
    if (!loading) return;
    const targets = dedupeNormalizedSbtListSlugs(fetchSessionSlugs);
    if (!targets.length) return;
    const liveProgressBySlug = (
      sbtScanProgressBySlug &&
      typeof sbtScanProgressBySlug === 'object'
    ) ? sbtScanProgressBySlug : {};
    const hasRelevantScan = targets.some((slug: any) => (
      !isSyntheticNoSessionSlug(slug) && !!liveProgressBySlug[slug]
    ));
    if (!hasRelevantScan) return;

    // Keep consuming sync-cache writes while MainSite discovery is still running
    // so the first hydrated cards can paint before the final read-cache pass.
    const hasPrimedCachedCards = primeSbtCardsFromSyncCache(targets);
    if (!hasPrimedCachedCards) return;

    initialLoadCompletedRef.current = true;
    if (isMounted.current) {
      setLoading(false);
    }
  }, [
    fetchSessionSlugs,
    loading,
    primeSbtCardsFromSyncCache,
    sbtScanProgressBySlug,
  ]);


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
  const ensureGroupPasswordFlags = useCallback(async (items: any) => {
    if (!Array.isArray(items) || items.length === 0) return;
    // Only check unknown ones to minimize RPC calls
    const toCheck = items.filter(
      (s: any) =>
        s &&
        s.sbtAddress &&
        groupPasswordMap[s.sbtAddress.toLowerCase()] === undefined
    );
    if (toCheck.length === 0) return;

    try {
      const results = await Promise.all(
        toCheck.map(async (s: any) => {
          try {
            // Per-item slug awareness
            const sSlug = (s && s.slug != null) ? s.slug : listSlug;
            const gph = await sbtGroupPasswordHashReader.getGroupPasswordHash('none', sbtAddress, sSlug);
            const isLocked = !!gph && gph !== ethers.constants.HashZero;
            return [sbtAddressLower, isLocked];
          } catch {
            return [sbtAddressLower, false];
          }
        })
      );
      if (!isMounted.current) return;
      const updates: Record<string, any> = {};
      results.forEach(([k, v]: any) => {
        updates[k] = v;
      });
      setGroupPasswordMap((prev: any) => ({ ...prev, ...updates }));
    } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
  }, [groupPasswordMap, listSlug]);

  // Helper: fetchSBTs (reads cache) - single-group mode
  const fetchSBTs = useCallback(async (forceRefresh: any = false, showLoadingIndicator: any = true, slugOverride: any = null) => {
    const targetSlug = normalizeSessionSlug(slugOverride != null ? slugOverride : listSlug);
    if (isSbtListSyntheticNoSessionSlug(targetSlug)) return;
    if (!isMounted.current) return;

    if (forceRefresh && onRequestSbtCacheRefresh) {
      if (showLoadingIndicator) setLoading(true);
      // Reset group-password map when forcing a hard refresh (network-scoped)
      setGroupPasswordMap({});
      onRequestSbtCacheRefresh();
      return;
    }

    const runId = Number(sessionFetchRunBySlugRef.current[targetSlug] || 0) + 1;
    sessionFetchRunBySlugRef.current[targetSlug] = runId;
    setSessionLoadStateBySlug((prev: any) => {
      if (prev[targetSlug] === 'loading') return prev;
      return { ...prev, [targetSlug]: 'loading' };
    });

    try {
      // Use group chain ID for cache lookups (not wallet network)
      const netKey = deriveCacheNetKeyForSlug(targetSlug);

      if (!netKey) {
        if (sessionFetchRunBySlugRef.current[targetSlug] === runId) {
          setSessionLoadStateBySlug((prev: any) => ({ ...prev, [targetSlug]: 'error' }));
          setSessionHasLoadedOnceBySlug((prev: any) => (
            prev[targetSlug] ? prev : { ...prev, [targetSlug]: true }
          ));
        }
        return;
      }

      const currentGlobalCacheRaw = await readCache('sbtCache', targetSlug);
      const currentGlobalCache =
        (currentGlobalCacheRaw && typeof currentGlobalCacheRaw === 'object')
          ? currentGlobalCacheRaw
          : {};
      const hasNetworkCacheEntry = currentGlobalCache[netKey] != null;
      const cachedNetworkData = hasNetworkCacheEntry
        ? currentGlobalCache[netKey]
        : { sbtList: {}, lastBlock: 0 };
      const sbtMapFromCache = { ...(cachedNetworkData.sbtList || {}) };
      const hydrated = normalizeSbtListItems(Object.values(sbtMapFromCache));
      updateSessionCacheMeta(targetSlug, {
        lastBlock: Number(cachedNetworkData?.lastBlock || 0),
        sbtCount: hydrated.length,
      });
      const hasLoadedBefore = !!sessionHasLoadedOnceRef.current[targetSlug];
      const currentForSlug = Array.isArray(sbtListBySlugRef.current[targetSlug])
        ? sbtListBySlugRef.current[targetSlug]
        : [];
      const shouldKeepExistingCards = (
        hydrated.length === 0 &&
        !forceRefresh &&
        hasLoadedBefore &&
        currentForSlug.length > 0
      );

      if (sessionFetchRunBySlugRef.current[targetSlug] !== runId || !isMounted.current) {
        return;
      }

      if (!shouldKeepExistingCards) {
        setSbtListBySlug((prev: any) => {
          const existing = Array.isArray(prev[targetSlug]) ? prev[targetSlug] : [];
          if (areSbtListArraysEqual(existing, hydrated)) return prev;
          return { ...prev, [targetSlug]: hydrated };
        });
      }

      if (hydrated.length > 0) {
        // PASSWORD-LOCK FLAGS WITH CORRECT SLUG CONTEXT
        await ensureGroupPasswordFlags(
          hydrated.map((x: any) => (x && x.slug == null ? { ...x, slug: targetSlug } : x))
        );
      }
      setSessionLoadStateBySlug((prev: any) => ({ ...prev, [targetSlug]: 'loaded' }));
      setSessionHasLoadedOnceBySlug((prev: any) => (
        prev[targetSlug] ? prev : { ...prev, [targetSlug]: true }
      ));
    } catch (error) {
      sbtLog.error("Error reading SBTs from cache:", error);
      if (sessionFetchRunBySlugRef.current[targetSlug] === runId) {
        setSessionLoadStateBySlug((prev: any) => ({ ...prev, [targetSlug]: 'error' }));
        setSessionHasLoadedOnceBySlug((prev: any) => (
          prev[targetSlug] ? prev : { ...prev, [targetSlug]: true }
        ));
      }
    } finally {
      if (!forceRefresh) {
        // Initial-load state should complete after a finished attempt,
        // even when the cache is empty or the slug has no chain config.
        initialLoadCompletedRef.current = true;
      }
      if (showLoadingIndicator && isMounted.current && forceRefresh) setLoading(false);
    }
  }, [
    deriveCacheNetKeyForSlug,
    ensureGroupPasswordFlags,
    listSlug,
    onRequestSbtCacheRefresh,
    updateSessionCacheMeta,
  ]);
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

  const singleSessionProgressSnapshot = useMemo(() => (
    allSessionsMode ? null : getSessionProgressSnapshot(listSlug)
  ), [allSessionsMode, getSessionProgressSnapshot, listSlug]);

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
  const isMintingLive = useCallback((sbt: any) => {
    const endSec = coerceMintEndSeconds(sbt?.sbtInfo?.mintingEndTime);
    const nowSec = Math.floor(Date.now() / 1000);
    if (endSec === 0) return true;
    return endSec > nowSec;
  }, []);

  const ignoredSBTAddressesLower_single = useMemo(
    () => ignored_SBTs_LIST.map((addr: any) => addr.toLowerCase()),
    [ignored_SBTs_LIST]
  );

  /** unified predicate for “password-locked” (commit-reveal OR unlimited) */
  const isPasswordLocked = useCallback(
    (sbt: any) => {
      if (!sbt || !sbt.sbtAddress || !sbt.sbtInfo) return false;
      const addrLower = sbt.sbtAddress.toLowerCase();
      return !!(sbt.sbtInfo.hasPasswordMint || groupPasswordMap[addrLower]);
    },
    [groupPasswordMap]
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
        const targetSlug = nextSlugs.includes(listSlug) ? listSlug : (nextSlugs[0] || listSlug);
        if (isMounted.current) setAvailableSessionUniverse(nextUniverse);
        if (targetSlug && targetSlug !== normalizeSessionSlug(activeSessionSlug)) {
          setActiveGroupSlug(targetSlug);
        }
        if (isListModeScopeEnabled) {
          refreshSlugs = dedupeNormalizedSbtListSlugs(
            actionableSectionSessionSlugs.length > 0
              ? actionableSectionSessionSlugs
              : (actionableUniverseSessionSlugs.length > 0 ? actionableUniverseSessionSlugs : [targetSlug])
          );
          if (typeof ensureLightSbtDiscovery === 'function') {
            await Promise.all(refreshSlugs.map((slug: any) => (
              ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug }).catch((e: any) => { sbtLog.warn('SBTsList: fallback', e); })
            )));
          }
          await Promise.all(refreshSlugs.map((slug: any) => fetchSBTs(false, false, slug)));
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
        ? (actionableSectionSessionSlugs.length > 0 ? actionableSectionSessionSlugs : actionableUniverseSessionSlugs)
        : (isSbtListSyntheticNoSessionSlug(listSlug) ? actionableUniverseSessionSlugs : [listSlug])
    );
    await Promise.all(clearTargetSlugs.map((slug: any) => removeCache('sbtCache', slug)));
    if (isMounted.current) {
      setSessionCacheMetaBySlug((prev: any) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug: any) => {
          next[normalizeSessionSlug(slug || '')] = { lastBlock: 0, sbtCount: 0 };
        });
        return next;
      });
      setSbtListBySlug((prev: any) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug: any) => {
          next[slug] = [];
        });
        return next;
      });
      setSessionLoadStateBySlug((prev: any) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug: any) => {
          next[slug] = 'idle';
        });
        return next;
      });
      setSessionHasLoadedOnceBySlug((prev: any) => {
        const next = { ...prev };
        clearTargetSlugs.forEach((slug: any) => {
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
        const targetSlug = nextSlugs.includes(listSlug) ? listSlug : (nextSlugs[0] || listSlug);
        if (isMounted.current) setAvailableSessionUniverse(nextUniverse);
        if (isListModeScopeEnabled) {
          const targetSlugs = dedupeNormalizedSbtListSlugs(
            actionableSectionSessionSlugs.length > 0
              ? actionableSectionSessionSlugs
              : (actionableUniverseSessionSlugs.length > 0 ? actionableUniverseSessionSlugs : [targetSlug])
          );
          if (typeof ensureLightSbtDiscovery === 'function') {
            await Promise.all(targetSlugs.map((slug: any) => (
              ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug }).catch((e: any) => { sbtLog.warn('SBTsList: fallback', e); })
            )));
          }
          await Promise.all(targetSlugs.map((slug: any) => fetchSBTs(false, false, slug)));
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
    const extraRegistrySlugs = dedupeNormalizedSlugs(remainingHiddenRegistrySessionSlugs);
    const configuredSet: any = new Set(
      dedupeNormalizedSlugs(listModeConfiguredSessionSlugs).map((slug: any) => normalizeSessionSlug(slug))
    );
    const triggerUniverseDiscovery = (slugsIn: any = []) => {
      const slugs = dedupeNormalizedSlugs(slugsIn);
      if (typeof ensureLightSbtUniverse !== 'function' || !slugs.length) return;
      void ensureLightSbtUniverse(slugs, { force: true }).catch((e: any) => { sbtLog.warn('SBTsList: fallback', e); });
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
        Array.isArray(nextUniverse?.slugs) ? nextUniverse.slugs : []
      ).filter((slug: any) => !configuredSet.has(normalizeSessionSlug(slug)));
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

  const handleSessionChipClick = useCallback((slugRaw: any) => {
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
              await Promise.all(targets.map((slug: any) => (
                ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug }).catch((e: any) => { sbtLog.warn('SBTsList: fallback', e); })
              )));
            }
            await Promise.all(targets.map((slug: any) => fetchSBTs(false, false, slug)));
          } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
        })();
      }
      return;
    }

    const wasSelected = selectedSessionUniverseSlugSet.has(normalized);
    setSelectedSessionSlugs((prev: any) => {
      const displayedSet: any = new Set(displayedSessionUniverseSlugsNormalized);
      const normalizedPrev = dedupeNormalizedSlugs(prev).filter((slug: any) => displayedSet.has(slug));
      const effectivePrev = normalizedPrev.length > 0 ? normalizedPrev : defaultListModeSelectedSessionSlugs;
      if (wasSelected) {
        const next = effectivePrev.filter((slug: any) => slug !== normalized);
        const clamped = next.length > 0 ? next : [normalized];
        return sortSlugsByUniverseOrder(clamped, displayedSessionUniverseSlugsNormalized);
      }
      return sortSlugsByUniverseOrder(
        [...effectivePrev, normalized],
        displayedSessionUniverseSlugsNormalized
      );
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
              await Promise.all(targets.map((slug: any) => (
                ensureLightSbtDiscovery(slug, { force: true, forceScopeSlug: slug }).catch((e: any) => { sbtLog.warn('SBTsList: fallback', e); })
              )));
            }
            await Promise.all(targets.map((slug: any) => fetchSBTs(false, false, slug)));
            return;
          }
          if (typeof ensureLightSbtDiscovery === 'function') {
            await ensureLightSbtDiscovery(normalized, { force: true, forceScopeSlug: normalized });
          }
          await fetchSBTs(false, false, normalized);
        } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
      })();
    }
  }, [
    activeSessionSlug,
    actionableUniverseSessionSlugs,
    allSessionsMode,
    defaultListModeSelectedSessionSlugs,
    displayedSessionUniverseSlugsNormalized,
    ensureLightSbtDiscovery,
    fetchSBTs,
    isListModeScopeEnabled,
    selectedSessionUniverseSlugSet,
  ]);

  const {
    mintingLiveList,
    expiredList,
    displayedFeatured,
    featuredItemKeySet,
  } = useMemo(() => {
    const base: any[] = [];
    const live: any[] = [];
    const expired: any[] = [];
    const featuredSet: any = new Set();
    const baseKeySet: any = new Set();
    const byAddrSingle: any = new Map();
    const featuredLowerSingle: any = new Set((featured_SBTs_LIST || []).map((addr: any) => String(addr || '').toLowerCase()));
    const featuredAllGroups: any[] = [];
    const activeSessionSlug = normalizeSessionSlug(listSlug || '');
    const selectedSessionSet: any = new Set(sectionSessionSlugs.map((slug: any) => normalizeSessionSlug(slug || '')));

    const buildItemKey = (sbt: any) => {
      const addrLower = String(sbt?.sbtAddress || '').toLowerCase();
      const slugForKey = allSessionsMode
        ? String(resolveSbtSessionSlug(sbt) || '')
        : String(listSlug || '');
      return `${slugForKey}|${addrLower}`;
    };

    for (const sbt of sbtList) {
      if (!sbt?.sbtInfo || !sbt?.sbtAddress) continue;
      const addrLower = String(sbt.sbtAddress || '').toLowerCase();
      if (!addrLower) continue;
      if (!byAddrSingle.has(addrLower)) byAddrSingle.set(addrLower, sbt);

      let isFeaturedForItem = false;
      if (!allSessionsMode) {
        if (ignoredSBTAddressesLower_single.includes(addrLower)) continue;
        isFeaturedForItem = featuredLowerSingle.has(addrLower);
        if (sbt.sbtInfo.unlisted && !isFeaturedForItem) continue;
      } else {
        const itemSlug = resolveSbtSessionSlug(sbt);
        if (isListModeScopeEnabled) {
          if (selectedSessionSet.size > 0 && !selectedSessionSet.has(itemSlug)) continue;
        } else if (itemSlug !== activeSessionSlug) {
          continue;
        }
        const lists = isSyntheticNoSessionSlug(itemSlug)
          ? { featured_SBTs_LIST: [], ignored_SBTs_LIST: [] }
          : getSessionLists(itemSlug);
        const ignoredSet: any = new Set((lists.ignored_SBTs_LIST || []).map((a: any) => String(a || '').toLowerCase()));
        if (ignoredSet.has(addrLower)) continue;
        isFeaturedForItem = (lists.featured_SBTs_LIST || []).some(
          (f: any) => String(f || '').toLowerCase() === addrLower
        );
        if (sbt.sbtInfo.unlisted && !isFeaturedForItem) continue;
      }

      if (excludePasswordLocked && isPasswordLocked(sbt)) continue;

      const itemKey = buildItemKey(sbt);
      base.push(sbt);
      baseKeySet.add(itemKey);
      if (isMintingLive(sbt)) live.push(sbt);
      else expired.push(sbt);

      if (isFeaturedForItem) {
        featuredSet.add(itemKey);
        if (allSessionsMode) featuredAllGroups.push(sbt);
      }
    }

    let featured: any[] = [];
    if (allSessionsMode) {
      featured = featuredAllGroups;
    } else {
      const seen: any = new Set();
      featured = (featured_SBTs_LIST || [])
        .map((addr: any) => {
          const addrLower = String(addr || '').toLowerCase();
          if (!addrLower) return null;
          if (seen.has(addrLower)) return null;
          seen.add(addrLower);
          return byAddrSingle.get(addrLower) || null;
        })
        .filter((sbt: any) => {
          if (!sbt) return false;
          const itemKey = buildItemKey(sbt);
          if (!baseKeySet.has(itemKey)) return false;
          featuredSet.add(itemKey);
          return true;
        });
    }

    return {
      baseFilteredList: base,
      mintingLiveList: live,
      expiredList: expired,
      displayedFeatured: featured,
      featuredItemKeySet: featuredSet,
    };
  }, [
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
  ]);

  const buildSbtItemKey = useCallback((sbt: any) => {
    const addrLower = String(sbt?.sbtAddress || '').toLowerCase();
    const slugForKey = allSessionsMode
      ? String(resolveSbtSessionSlug(sbt) || '')
      : String(listSlug || '');
    return `${slugForKey}|${addrLower}`;
  }, [allSessionsMode, listSlug, resolveSbtSessionSlug]);

  const mintingLiveListWithoutFeatured = useMemo(() => (
    mintingLiveList.filter((sbt: any) => !featuredItemKeySet.has(buildSbtItemKey(sbt)))
  ), [buildSbtItemKey, featuredItemKeySet, mintingLiveList]);

  const expiredListWithoutFeatured = useMemo(() => (
    expiredList.filter((sbt: any) => !featuredItemKeySet.has(buildSbtItemKey(sbt)))
  ), [buildSbtItemKey, expiredList, featuredItemKeySet]);

  const sectionHeaderSpinnerVisible = emptySectionSpinnerActive;
  const initialLoadingActive = allSessionsMode
    ? (!initialLoadCompletedRef.current)
    : (!initialLoadCompletedRef.current && !isSBTCacheReady);
  const sectionReadinessPending = !isSBTCacheReady;
  const showSectionBodyLoadingHint = (
    sectionHeaderSpinnerVisible ||
    sectionSessionDiscoveryPending ||
    sectionSessionSearchFlag ||
    initialLoadingActive ||
    sectionReadinessPending ||
    revisionSyncPending
  );
  const canShowSectionEmptyState = (
    !showSectionBodyLoadingHint &&
    initialLoadCompletedRef.current &&
    isSBTCacheReady
  );
  const showFeaturedSectionLoadingHint = displayedFeatured.length === 0 && !canShowSectionEmptyState;
  const showLiveSectionLoadingHint = mintingLiveListWithoutFeatured.length === 0 && !canShowSectionEmptyState;
  const showExpiredSectionLoadingHint = expiredListWithoutFeatured.length === 0 && !canShowSectionEmptyState;

  useEffect(() => {
    const researchStep = readSbtSyncBarResearchBlockStep();
    const loadingTargets = Object.entries(chipLoadingStatusBySlug || {}).reduce((acc: any, [slugRaw, status]: any) => {
      const slug = normalizeSessionSlug(slugRaw || '');
      if (isSbtListSyntheticNoSessionSlug(slug)) return acc;
      if (!status) return acc;
      const chipState = sessionChipStateBySlug[slug];
      if (!chipState?.isLoading) return acc;
      const snapshot = getSessionProgressSnapshot(slug);
      if (!snapshot) return acc;
      if (Number(snapshot.liveLatestBlock || 0) > 0) return acc;
      if (!!sbtRealtimeCoverageBySlug?.[slug]) return acc;
      acc[slug] = Math.max(
        0,
        Number(snapshot.displayCurrentBlock || 0),
        Number(snapshot.liveCurrentBlock || 0),
        Number(snapshot.lastBlock || 0)
      );
      return acc;
    }, {});

    const loadingSlugs: any = new Set(Object.keys(loadingTargets));
    Object.keys(passiveLatestLookupStateBySlugRef.current || {}).forEach((slug: any) => {
      if (loadingSlugs.has(slug)) return;
      delete passiveLatestLookupStateBySlugRef.current[slug];
      delete passiveLatestLookupInFlightBySlugRef.current[slug];
    });

    Object.entries(loadingTargets).forEach(([slug, currentWatermark]: any) => {
      const lookupState = passiveLatestLookupStateBySlugRef.current[slug] || null;
      const lastRequestedAtBlock = Number(lookupState?.lastRequestedAtBlock || 0);
      const needsInitialLookup = lookupState == null;
      const crossedResearchThreshold = (
        lookupState != null &&
        Number(currentWatermark || 0) >= (lastRequestedAtBlock + researchStep)
      );
      if (!needsInitialLookup && !crossedResearchThreshold) return;
      if (passiveLatestLookupInFlightBySlugRef.current[slug]) return;

      passiveLatestLookupStateBySlugRef.current[slug] = {
        lastRequestedAtBlock: Number(currentWatermark || 0),
      };
      passiveLatestLookupInFlightBySlugRef.current[slug] = true;
      Promise.resolve(refreshLatestBlocks([slug], false))
        .catch((e: any) => { sbtLog.warn('SBTsList: fallback', e); })
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

  // Initial full-page loader logic
  const shouldDeferInitialLoaderForUniverse =
    allSessionsMode &&
    displayedSessionUniverseSlugs.length > 0;
  const showInitialLoader = initialLoadingActive && !shouldDeferInitialLoaderForUniverse;

  if (showInitialLoader) {
    return (
      <div className={styles.initialLoader}>
        <div className={styles.loadingHeader}>
          <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingSpinner} />
          <div className={styles.loadingTitle}>{`Loading ${t('sbts')}`}</div>
        </div>
        {loadingSessionStatuses.length > 0 && (
          <div className={styles.loadingGroupList}>
            {loadingSessionStatuses.map((group: any) => (
              <div key={group.slug} className={styles.loadingGroupRow}>
                <div className={styles.loadingGroupHeader}>
                  <span className={styles.loadingGroupName}>{group.displayName}</span>
                  <span
                    className={`${styles.loadingGroupStatus} ${
                      group.scanInProgress ? styles.loadingStatusActive : styles.loadingStatusPending
                    }`}
                  >
                    {group.statusLabel}
                  </span>
                </div>
                <div className={styles.loadingGroupMeta}>
                  {group.progressText}
                  {!group.hasLatest && (
                    <FontAwesomeIcon icon={faSpinner} spin className={styles.loadingGroupSpinner} />
                  )}
                </div>
                <div
                  className={styles.loadingProgressBar}
                  role="progressbar"
                  aria-valuenow={group.hasLatest ? group.progressPct : 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className={`${styles.loadingProgressFill} ${
                      group.hasLatest ? '' : styles.loadingProgressIndeterminate
                    }`}
                    style={{ width: group.hasLatest ? `${group.progressPct}%` : undefined }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const buildSbtHref = (sbtAddress: any, sessionSlug: any = '') => (
    buildSbtDetailPath(
      sbtAddress,
      isSyntheticNoSessionSlug(sessionSlug) ? '' : sessionSlug
    )
  );

  const isModifiedPointerNavigation = (event: any) => (
    !!(event && (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button === 1))
  );

  const handleSbtLinkClick = (event: any, sbtAddress: any, sessionSlug: any = '') => {
    if (!sbtAddress || event?.defaultPrevented) return;
    if (typeof onNavigateToSbt !== 'function') return;
    if (isModifiedSbtListPointerNavigation(event)) return;
    event.preventDefault?.();
    const address = String(sbtAddress || '');
    onNavigateToSbt(address, buildSbtHref(address, sessionSlug));
  };

  const handleFeaturedCardClick = (event: any, sbtAddress: any, sessionSlug: any = '') => {
    if (!sbtAddress) return;
    if (event?.defaultPrevented) return;
    const target = event?.target;
    const targetWithClosest = target as { closest?: (selector: string) => Element | null } | null | undefined;
    const interactiveAncestor = typeof targetWithClosest?.closest === 'function'
      ? targetWithClosest.closest(FEATURED_CARD_INTERACTIVE_SELECTOR)
      : null;
    if (
      interactiveAncestor &&
      interactiveAncestor !== event?.currentTarget
    ) {
      const interactiveTag = String(interactiveAncestor?.tagName || '').toLowerCase();
      if (interactiveTag !== 'a' && typeof event?.preventDefault === 'function') {
        event.preventDefault();
      }
      return;
    }
    handleSbtLinkClick(event, sbtAddress, sessionSlug);
  };

  const toggleExpandedSbt = (sbtAddress: any) => {
    const normalized = String(sbtAddress || '').trim().toLowerCase();
    if (!normalized) return;
    setExpandedSbtAddresses((prev: any) => {
      const next: any = new Set(prev);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return next;
    });
  };

  const renderSbtDetailsPanel = (
    details: SbtCardDetails | null | undefined,
    detailsId: string
  ): React.ReactNode => (
    <SbtListDetailsPanel
      details={details}
      detailsId={detailsId}
      styles={styles}
    />
  );

  const handleTagChipClick = (
    event: SbtListPointerEventLike,
    tag: unknown
  ): void => {
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
    buttonLabel: unknown
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

  const renderSbtDetailsToggle = (sbt: any, details: any, detailsId: any, buttonLabel: any) => {
    if (miniaturized || !details?.hasDetails) return null;
    const sbtAddressLower = String(sbt?.sbtAddress || '').toLowerCase();
    const isExpanded = expandedSbtAddresses.has(sbtAddressLower);
    return (
      <div className={styles.sbtDetailsFooter}>
        <button
          type="button"
          className={styles.sbtDetailsToggle}
          aria-controls={detailsId}
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? 'Hide' : 'Show'} details for ${buttonLabel}`}
          onClick={() => toggleExpandedSbt(sbt?.sbtAddress)}
        >
          <FontAwesomeIcon icon={isExpanded ? faChevronUp : faChevronDown} />
        </button>
      </div>
    );
  };

  const renderCompactSbtLinkCard = (sbt: any, keyPrefix: any = 'sbt') => {
    if (!sbt || !sbt.sbtAddress || !sbt.sbtInfo) return null;
    const { image } = sbt.sbtInfo;
    const name = getSbtDisplayName(sbt.sbtInfo) || `Unnamed ${t('sbt')}`;
    const description = getSbtDescriptionText(sbt.sbtInfo);
    const locked = isPasswordLocked(sbt);
    const sbtAddressLower = String(sbt.sbtAddress || '').toLowerCase();
    const compactCardClassName = [
      styles.sbtItem,
      miniaturized && viewMode === 'modal' ? styles.modalMiniSbtItem : '',
    ].filter(Boolean).join(' ');

    return (
      <SbtListCompactLinkCard
        key={model.key}
        className={compactCardClassName}
        href={buildSbtHref(sbt.sbtAddress, resolveSbtSessionSlug(sbt))}
        onClick={(event: any) => handleSbtLinkClick(event, sbt.sbtAddress, resolveSbtSessionSlug(sbt))}
      >
        <div className={styles.sbtImage} style={{ position: 'relative' }}>
          {/* {locked && <FontAwesomeIcon icon={faLock} className={styles.inlineLock} />} */}
          {image && <img src={normalizeTokenUri(image) || undefined} alt={`${t('sbt')} Thumbnail`} />}
        </div>
        <div className={styles.sbtInfo}>
          <p className={styles.sbtName}>
            {name}
            {locked && <FontAwesomeIcon icon={faLock} className={styles.lockIcon} />}
          </p>
          <p className={styles.sbtDescription}>{description || 'No description.'}</p>
        </div>
      </a>
    );
  };

  const renderInteractiveMiniSbtCard = (sbt: any, keyPrefix: any = 'sbt') => {
    if (!sbt || !sbt.sbtAddress) return null;
    const sessionSlug = resolveSbtSessionSlug(sbt);
    const sbtAddress = String(sbt.sbtAddress || '').trim();
    const sbtAddressLower = sbtAddress.toLowerCase();
    if (!sbtAddressLower) return null;

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

  const renderFeaturedSBTCard = (sbt: any) => {
    if (!sbt || !sbt.sbtAddress) return null;
    const sbtAddress = sbt.sbtAddress;
    const sessionSlug = resolveSbtSessionSlug(sbt);
    const sbtAddressLower = String(sbtAddress || '').toLowerCase();
    const linkLabel = String(getSbtDisplayName(sbt?.sbtInfo) || sbtAddress || t('sbt'));
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
        onClick={(event: any) => handleFeaturedCardClick(event, sbtAddress, sessionSlug)}
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
    if (displayedFeatured.length === 0) {
      if (showFeaturedSectionLoadingHint) return renderSectionLoadingHint();
      return <div className={styles.sectionEmptyHint}>{`No featured ${t('sbtsLower')}.`}</div>;
    }
    return (
      <div id={styles.featuredSBTsContainer}>
        {displayedFeatured.map(renderFeaturedSBTCard)}
      </div>
    );
  };

  const renderSectionTitle = (label: React.ReactNode, spinnerId: string): React.ReactNode => (
    <SbtListSectionTitle
      label={label}
      showSpinner={sectionHeaderSpinnerVisible}
      spinnerId={spinnerId}
    />
  );

  const renderSectionLoadingHint = () => (
    <SbtListSectionLoadingHint
      allSessionsMode={allSessionsMode}
      blocksLeft={typeof blocksLeft === 'number' ? blocksLeft : null}
    />
  );

  const renderSBTButton = (sbt: any) => {
    if (!sbt || !sbt.sbtAddress || !sbt.sbtInfo) return null;
    const { image } = sbt.sbtInfo;
    const name = getSbtDisplayName(sbt.sbtInfo) || `Unnamed ${t('sbt')}`;
    const description = getSbtDescriptionText(sbt.sbtInfo);
    const locked = isPasswordLocked(sbt);
    const sbtAddressLower = String(sbt.sbtAddress || '').toLowerCase();
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
      <article
        key={`${resolveSbtSessionSlug(sbt)}|${sbt.sbtAddress}`}
        className={`${styles.standardCardShell} ${isExpanded ? styles.standardCardShellExpanded : ''}`}
      >
        <a
          className={styles.standardCardBodyLink}
          href={buildSbtHref(sbt.sbtAddress, resolveSbtSessionSlug(sbt))}
          onClick={(event: any) => handleSbtLinkClick(event, sbt.sbtAddress, resolveSbtSessionSlug(sbt))}
        >
          <div className={styles.standardCardImage} style={{ position: 'relative' }}>
            {/* {locked && <FontAwesomeIcon icon={faLock} className={styles.inlineLock} />} */}
            {image && <img src={normalizeTokenUri(image) || undefined} alt={`${t('sbt')} Thumbnail`} />}
          </div>
          <div className={styles.standardCardInfo}>
            <p className={styles.standardCardName}>
              {name}
              {locked && <FontAwesomeIcon icon={faLock} className={styles.lockIcon} />}
            </p>
            <p className={styles.standardCardDescription}>{description || 'No description.'}</p>
          </div>
        </a>
        {renderSbtDetailsToggle(sbt, details, detailsId, name || sbt.sbtAddress || t('sbt'))}
        {isExpanded && renderSbtDetailsPanel(details, detailsId)}
      </article>
    );
  };

  const renderSessionUniverseSelector = () => {
    if (!allSessionsMode) return null;
    const publicBasePath = readPublicUrlBasePath();
    const withPublicBasePath = (pathIn: any) => {
      const normalizedPath = String(pathIn || '').trim();
      if (!normalizedPath) return publicBasePath || '/';
      return `${publicBasePath}${normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`}` || normalizedPath;
    };
    const buildSessionRouteHref = (slugRaw: any) => {
      const normalized = normalizeSessionSlug(slugRaw || '');
      if (isSbtListSyntheticNoSessionSlug(normalized)) return '';
      const cfg = getDisplaySessionConfig(normalized);
      const routeToken = String(
        cfg?.__registry?.sessionId ||
        cfg?.__registry?.sessionIdHex ||
        cfg?.sessionId ||
        cfg?.sessionIdHex ||
        ''
      ).trim();
      if (routeToken) return withPublicBasePath(`/session/${encodeURIComponent(routeToken)}`);
      if (!normalized) return withPublicBasePath('/session');
      return withPublicBasePath(`/session/${encodeURIComponent(normalized)}`);
    };

    const handleOpenSessionChip = (slugRaw: any, optionOrEvent: any = null, maybeEvent: any = null) => {
      const event = maybeEvent && typeof maybeEvent === 'object'
        ? maybeEvent
        : optionOrEvent;
      if (event?.stopPropagation) event.stopPropagation();
      if (event?.preventDefault) event.preventDefault();
      const href = buildSessionRouteHref(slugRaw);
      if (!href) return;
      try {
        window.open(href, '_blank', 'noopener,noreferrer');
      } catch (e) { sbtLog.warn('SBTsList: fallback', e); }
    };

    const showUniverseSpinner =
      loading ||
      refreshing ||
      sectionSessionDiscoveryPending ||
      sectionSessionSearchFlag ||
      !isSBTCacheReady ||
      sessionUniverseRegistryPending ||
      availableSessionSlugs.length === 0;
    const canShowMoreSessions =
      isListModeScopeEnabled &&
      !showMoreSessions &&
      remainingHiddenRegistrySessionSlugs.length > 0;
    const collapsedSummarySlugs = isListModeScopeEnabled
      ? selectedSessionUniverseSlugs
      : [normalizeSessionSlug(listSlug || '')];
    const renderCollapsedSummary = (testId: string): React.ReactNode => (
      <SbtListSessionUniverseSummary
        testId={testId}
        summarySlugs={collapsedSummarySlugs}
        chipProgressVisibilityBySlug={chipProgressVisibilityBySlug}
        chipLoadingStatusBySlug={chipLoadingStatusBySlug}
        labelForSessionSlug={labelForSessionSlug}
        buildSessionRouteHref={buildSessionRouteHref}
        onOpenSessionChip={handleOpenSessionChip}
      />
    );

    const renderHeaderActions = ({ isOpen }: any) => (
      <div className={styles.sessionUniverseHeaderActions}>
        {showUniverseSpinner && (
          <FontAwesomeIcon
            icon={faSpinner}
            spin
            className={styles.sessionUniverseSpinner}
            data-testid="session-universe-spinner"
          />
        )}
        {usesFallbackSessionSettingsToggle && (
          <button
            type="button"
            className={styles.sessionUniverseSettingsButton}
            aria-label={isOpen ? 'Hide session selector' : 'Show session selector'}
            aria-controls={sessionSelectorPanelId}
            aria-expanded={isOpen}
            data-testid="session-selector-toggle"
            onClick={() => setShowLocalSessionSettings((prev: any) => !prev)}
          >
            <FontAwesomeIcon icon={faCog} />
          </button>
        )}
        {isOpen && (
          <button
            type="button"
            className={styles.sessionUniverseToggle}
            aria-label={isUniverseCollapsed ? 'Expand session universe' : 'Collapse session universe'}
            aria-expanded={!isUniverseCollapsed}
            onClick={() => setIsUniverseCollapsed((prev: any) => !prev)}
          >
            <FontAwesomeIcon icon={isUniverseCollapsed ? faChevronDown : faChevronUp} />
            <span>{isUniverseCollapsed ? 'Expand' : 'Collapse'}</span>
          </button>
        )}
      </div>
    );

    if (!isSessionSelectorOpen) {
      return (
        <div className={`${styles.sessionUniversePanel} ${styles.sessionUniversePanelClosed}`}>
          <div className={styles.sessionUniverseHeader}>
            <span>Sessions</span>
            {renderHeaderActions({ isOpen: false })}
          </div>
          {!hideSessionUniverseSummary && renderCollapsedSummary('session-selector-summary')}
        </div>
      );
    }

    return (
      <div
        className={styles.sessionUniversePanel}
        data-testid="session-selector-panel"
        id={sessionSelectorPanelId}
      >
        <div className={styles.sessionUniverseHeader}>
          <span>Sessions</span>
          {renderHeaderActions({ isOpen: true })}
        </div>
        {!hideSessionUniverseSummary && isUniverseCollapsed && renderCollapsedSummary('session-universe-collapsed-summary')}
        {!isUniverseCollapsed && (
          <div className={styles.sessionUniverseChips}>
            <SessionChipSelector
              options={displayedSessionUniverseSlugs.map((s: any) => {
                const normalized = normalizeSessionSlug(s);
                const isSelected = isListModeScopeEnabled
                  ? selectedSessionUniverseSlugSet.has(normalized)
                  : (normalized === normalizeSessionSlug(activeSessionSlug));
                const chipState = sessionChipStateBySlug[normalized];
                const isLoaded = !!chipState?.isLoaded;
                const isLoading = !!chipProgressVisibilityBySlug[normalized];
                const chipLoadingStatus = chipLoadingStatusBySlug[normalized] || null;
                const showChipProgress = chipLoadingStatus != null && isLoading;
                const progressWidth = showChipProgress
                  ? (chipLoadingStatus.hasLatest
                    ? `${Math.max(6, chipLoadingStatus.progressPct)}%`
                    : '35%')
                  : '0%';
                const chipProgressStyle = showChipProgress
                  ? {
                    '--ce-chip-progress-width': progressWidth,
                    background: `linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.62) ${progressWidth}, rgba(0,0,0,0.22) ${progressWidth}, rgba(0,0,0,0.22) 100%)`,
                  }
                  : undefined;
                const sessionRouteHref = buildSessionRouteHref(normalized);
                return {
                  key: s || 'general',
                  slug: normalized,
                  label: labelForSessionSlug(s),
                  selected: isSelected,
                  active: !isListModeScopeEnabled && isSelected,
                  loaded: isLoaded,
                  general: normalized === '',
                  href: sessionRouteHref,
                  showOpen: !!sessionRouteHref,
                  openTitle: `Open session ${labelForSessionSlug(s)} in new tab`,
                  showProgress: showChipProgress,
                  progressText: chipLoadingStatus?.chipRemainingText || '',
                  indeterminate: !(chipLoadingStatus?.hasLatest),
                  style: chipProgressStyle,
                  rowTestId: `session-chip-row-${normalized || 'general'}`,
                  chipTestId: `session-chip-${normalized || 'general'}`,
                  checkTestId: `session-chip-check-${normalized || 'general'}`,
                  openTestId: `session-chip-open-${normalized || 'general'}`,
                  progressWrapTestId: `session-chip-progress-wrap-${normalized || 'general'}`,
                  progressTrackTestId: `session-chip-progress-track-${normalized || 'general'}`,
                  progressFillTestId: `session-chip-progress-fill-${normalized || 'general'}`,
                  progressTextTestId: `session-chip-progress-text-${normalized || 'general'}`,
                };
              })}
              onToggle={handleSessionChipClick}
              onOpen={handleOpenSessionChip}
            />
          </div>
        )}
        {!isUniverseCollapsed && canShowMoreSessions && (
          <div className={styles.sessionUniverseShowMoreRow}>
            <button
              type="button"
              className={styles.sessionUniverseShowMoreButton}
              onClick={handleShowMoreSessions}
              disabled={showMoreSessionsLoading}
            >
              {showMoreSessionsLoading && (
                <FontAwesomeIcon icon={faSpinner} spin className={styles.sessionUniverseShowMoreSpinner} />
              )}
              Show More Sessions ({remainingHiddenRegistrySessionSlugs.length})
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderCreateGroupControl = (className: any = styles.createGroupButton) => (
    <Button
      className={className}
      onClick={() => setShowCreateGroup(!showCreateGroup)}
    >
      <FontAwesomeIcon icon={faPlus} />{' '}
      {showCreateGroup ? `Exit ${t('sbt')} Creation` : `Create ${t('sbt')}`}
    </Button>
  );

  const showEmbeddedCreateGroupControl = embeddedMode && allSessionsMode;
  const shouldRenderCreateGroupPanel = showCreateGroup && (!embeddedMode || showEmbeddedCreateGroupControl);

  const rootClassName =
    viewMode === 'modal' ? styles.modalViewContainer : styles.standardViewContainer;

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
        {isModal && (
          showCommunityTabCompactSettings ? (
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
                    className={`${styles.filterLabel} ${styles.filterLabelToggle} ${
                      excludePasswordLocked ? styles.filterLabelActive : ''
                    }`}
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
          )
        )}
        {allSessionsMode && !showCommunityTabCompactSettings && !isModal && renderSessionUniverseSelector()}
        {allSessionsMode && showCommunityTabCompactSettings && !showAdminButtons && renderSessionUniverseSelector()}

        {renderSectionTitle(`Featured ${t('sbts')}`, 'section-spinner-featured')}
        {miniFeatured.length > 0 ? (
          <div className={styles.sbtGrid}>
            {miniFeatured.map(renderFeaturedSBTCard)}
          </div>
        ) : showFeaturedSectionLoadingHint ? (
          renderSectionLoadingHint()
        ) : (
          <div className={styles.sectionEmptyHint}>{`No featured ${t('sbtsLower')}.`}</div>
        )}

        {renderSectionTitle(`${t('minting')} Live`, 'section-spinner-live')}
        {miniMintingLive.length > 0 ? (
          <div className={styles.sbtGrid}>{miniMintingLive.map(renderSBTButton)}</div>
        ) : showLiveSectionLoadingHint ? (
          renderSectionLoadingHint()
        ) : (
          <div className={styles.sectionEmptyHint}>{`No live ${t('sbtsLower')}.`}</div>
        )}

        {renderSectionTitle(`${t('minting')} Expired`, 'section-spinner-expired')}
        {miniExpired.length > 0 ? (
          <div className={styles.sbtGrid}>{miniExpired.map(renderSBTButton)}</div>
        ) : showExpiredSectionLoadingHint ? (
          renderSectionLoadingHint()
        ) : (
          <div className={styles.sectionEmptyHint}>{`No expired ${t('sbtsLower')}.`}</div>
        )}
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
              <FontAwesomeIcon
                icon={faSpinner}
                spin
                className={styles.headerSpinner}
              />
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
            lockGateSessionSources={showEmbeddedCreateGroupControl && isListModeScopeEnabled
              ? embeddedCreateGroupLockGateSources
              : undefined}
            lockGatePreferredSessionSlug={showEmbeddedCreateGroupControl && isListModeScopeEnabled
              ? listSlug
              : undefined}
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
            <Button
              className={styles.refreshButton}
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <FontAwesomeIcon icon={faSync} spin={refreshing} />
              {' '}Refresh
              {refreshButtonBusy && (
                <>
                  {' '}
                  <FontAwesomeIcon
                    icon={faSpinner}
                    spin
                    data-testid="sbt-refresh-busy-spinner"
                  />
                </>
              )}
            </Button>
            <Button
              className={styles.clearCacheButton}
              onClick={handleClearCache}
              disabled={refreshing || loading}
            >
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
      {mintingLiveListWithoutFeatured.length > 0 ? (
        mintingLiveListWithoutFeatured.map(renderSBTButton)
      ) : showLiveSectionLoadingHint ? (
        renderSectionLoadingHint()
      ) : (
        <div className={styles.sectionEmptyHint}>{`No live ${t('sbtsLower')}.`}</div>
      )}

      {renderSectionTitle(`${t('minting')} Expired`, 'section-spinner-expired')}
      {expiredListWithoutFeatured.length > 0 ? (
        expiredListWithoutFeatured.map(renderSBTButton)
      ) : showExpiredSectionLoadingHint ? (
        renderSectionLoadingHint()
      ) : (
        <div className={styles.sectionEmptyHint}>{`No expired ${t('sbtsLower')}.`}</div>
      )}
      <TagModal
        isOpen={!!activeTag}
        toggle={() => setActiveTag('')}
        activeTag={activeTag || null}
      />
    </div>
  );
};

export default SBTsList;
