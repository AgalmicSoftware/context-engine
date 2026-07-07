import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import {
  asSelectedSbtEntry,
  buildSbtFilterStateSignature,
  normalizeIncomingFilterState,
} from './sbtFilterSelectionHelpers';
import type { SbtFilterSelectedSbtEntry, SbtFilterSelectionState } from './sbtFilterSelectionHelpers';
import { buildHolderUnionSet } from './sbtFilterHolderHelpers';
import type { SbtHolderSetMap } from './sbtFilterHolderHelpers';
export {
  buildHolderUnionSet,
  buildHistorySummaryFromCounts,
  buildNetHoldersSet,
  buildNetHoldersSetFromCounts,
  buildSbtFilterFetchedHolderCacheEntryPatch,
  buildSbtFilterFetchedHolderRevisionKey,
  buildSbtFilterHolderFetchResult,
  buildSbtFilterHolderRequestKey,
  buildSbtFilterHolderRevisionKey,
  buildSbtFilterHolderSelectionSets,
  computeHolderListFingerprint,
  countMapFingerprint,
  normalizeAddressCountMap,
  resolveSbtFilterCreationBlock,
  resolveSbtFilterEntryCountMapUsage,
  resolveSbtFilterHolderScanFromBlock,
  setBoundedSbtHolderMemoEntry,
} from './sbtFilterHolderHelpers';
export type { AddressCountMap, SbtFilterHolderFetchResult, SbtHolderSetMap } from './sbtFilterHolderHelpers';
export {
  appendSbtFilterOption,
  asSelectedSbtEntry,
  buildSbtEntrySignature,
  buildSbtFilterQuickChipSelectedAddressSet,
  buildSbtFilterSelectionAddPatch,
  buildSbtFilterSelectionRemovePatch,
  buildSbtFilterSelectionStateFromState,
  buildSbtFilterSnapshot,
  buildSbtFilterStateSignature,
  buildSbtListSignature,
  hasActiveSbtFilterState,
  hasMatchingSbtOptionAddress,
  normalizeIncomingFilterState,
  readSbtOptionAddress,
  removeMatchingSbtOptionAddress,
  resolveSbtFilterChainId,
  resolveSbtFilterGroupSlug,
  shouldAppendSbtFilterSelection,
} from './sbtFilterSelectionHelpers';
export type {
  ResolveSbtFilterChainIdArgs,
  ResolveSbtFilterGroupSlugArgs,
  SbtFilterSbtOption,
  SbtFilterSelectedSbtEntry,
  SbtFilterSelectionPatchArgs,
  SbtFilterSelectionState,
  SbtFilterSnapshotArgs,
} from './sbtFilterSelectionHelpers';
export {
  buildSbtFilterBooleanTogglePatch,
  buildSbtFilterQuickChipClassName,
  buildSbtFilterQuickChipDisplayState,
  buildSbtFilterSurfaceClassNames,
  formatSbtFilterQuickChipAddress,
  hasSbtFilterFeaturedOptions,
  resolveSbtFilterButtonText,
  resolveSbtFilterLayoutDisplayState,
  resolveSbtFilterModeSectionsState,
  resolveSbtFilterOptionsVisibilityState,
  resolveSbtFilterPanelDisplayState,
  resolveSbtFilterSurfaceDisplayState,
} from './sbtFilterDisplayHelpers';

export type UnknownRecord = Record<string, unknown>;

export type SbtFilterInitialState = {
  selectedSBTGroupsCreator: unknown;
  excludedSBTGroupsCreator: unknown;
  selectedSBTGroupsResponder: unknown;
  excludedSBTGroupsResponder: unknown;
  selectedSBTGroups: unknown;
  excludedSBTGroups: unknown;
  onlyVerifiedHumans: unknown;
  showFilterOptions: unknown;
  loading: boolean;
  showAllSBTs: boolean;
  lastAppliedFilterSnapshot: null;
};

type SbtFilterDataReadyArgs = {
  isQuestionCacheReady?: unknown;
  isSBTCacheReady?: unknown;
  mode?: unknown;
};
type HasRelevantSbtFilterStateChangedArgs = {
  fields?: readonly string[];
  nextState?: unknown;
  prevState?: unknown;
};
type ShouldApplySbtFilterOnDataReadyArgs = {
  hasActiveFilter?: unknown;
  isDataReady?: unknown;
  wasDataReady?: unknown;
};
type ResolveSbtFilterLoadingUpdateArgs = {
  currentLoading?: unknown;
  isMounted?: unknown;
  loading?: unknown;
  setFilterLoading?: unknown;
};
type BuildSbtFilterLoadingPatchArgs = {
  loading?: unknown;
};
type BuildSbtFilterLastAppliedSnapshotPatchArgs = {
  snapshot?: unknown;
};
type IsLatestSbtFilterApplyRunArgs = {
  activeApplyFilterRunId?: unknown;
  runId?: unknown;
};
type ResolveSbtFilterExternalStateSyncArgs = {
  currentExternalState?: unknown;
  currentLocalSignature?: unknown;
  lastExternalSignature?: unknown;
  prevExternalState?: unknown;
};
type BuildSbtFilterExternalStateSyncPatchArgs = {
  incomingStateNormalized?: unknown;
};
type SbtFilterLoadingUpdateDecision = {
  nextLoading: boolean;
  shouldNotifyParent: boolean;
  shouldSetLocalLoading: boolean;
};
type ShouldReapplySbtFilterAfterUpdateArgs = {
  nextProps?: unknown;
  nextState?: unknown;
  prevProps?: unknown;
  prevState?: unknown;
};
type SbtFilterExternalStateSyncDecision = {
  hasExternalChanged: boolean;
  incomingStateNormalized: SbtFilterSelectionState;
  nextExternalSig: string;
  shouldSyncLocalState: boolean;
};

type BuildSbtFilterSbtEntryCachePatchArgs = {
  entryPatch?: unknown;
  netKey?: unknown;
  rawCache?: unknown;
  sbtAddress?: unknown;
};
type ReadMemoizedSbtFilterSbtCacheBySlugArgs = {
  cacheBySlug?: Map<string, UnknownRecord> | null;
  readSbtCacheBySlug?: ((slug: unknown) => unknown) | null;
  slugForCache?: unknown;
};
type ReadMemoizedSbtFilterSbtNetBucketBySlugArgs = ReadMemoizedSbtFilterSbtCacheBySlugArgs & {
  netKeyForCache?: unknown;
};
type DoesSbtFilterAddressPassSelectionArgs = {
  address?: unknown;
  excludedAddressHolderSet?: Set<string>;
  excludedCreatorHolderSet?: Set<string>;
  excludedResponderHolderSet?: Set<string>;
  excludedSBTGroups?: unknown;
  excludedSBTGroupsCreator?: unknown;
  excludedSBTGroupsResponder?: unknown;
  excludedSBTs?: unknown;
  sbtHoldersMap?: SbtHolderSetMap;
  selectedAddressHolderSet?: Set<string>;
  selectedCreatorHolderSet?: Set<string>;
  selectedResponderHolderSet?: Set<string>;
  selectedSBTGroups?: unknown;
  selectedSBTGroupsCreator?: unknown;
  selectedSBTGroupsResponder?: unknown;
  selectedSBTs?: unknown;
};
type BuildSbtFilterSelectedEntryListArgs = {
  excludedSBTGroups?: unknown[];
  excludedSBTGroupsCreator?: unknown[];
  excludedSBTGroupsResponder?: unknown[];
  selectedSBTGroups?: unknown[];
  selectedSBTGroupsCreator?: unknown[];
  selectedSBTGroupsResponder?: unknown[];
};
type ResolveSbtFilterEmptyResponderShortCircuitArgs = {
  items?: unknown;
  mode?: unknown;
  selectedResponderHolderSet?: Set<string> | null;
  selectedSBTGroupsResponder?: unknown;
};
type ResolveSbtFilterAddressItemsToFilterArgs = {
  items?: unknown;
  selectedAddressHolderSet?: Set<string> | null;
  shouldExpandAddresses?: unknown;
};
type ResolveSbtFilterAddressItemDecisionArgs = {
  excludedAddressHolderSet?: Set<string> | null;
  hasSelectedGroups?: unknown;
  item?: unknown;
  selectedAddressHolderSet?: Set<string> | null;
};
type SbtFilterEmptyResponderShortCircuitResult = {
  logMessage: string;
  result: unknown;
  shouldShortCircuit: boolean;
};
type SbtFilterAddressItemDecision = {
  address: string;
  passes: boolean;
  shouldLogInvalidType: boolean;
};
type SbtFilterItemParticipantAddresses = {
  creator: string | null;
  responder: string | null;
};

export type SbtFilterQuestionNetBucket = UnknownRecord & {
  questions?: Record<string, UnknownRecord>;
  questionResponses?: Record<string, Record<string, unknown>>;
};

export type SbtFilterSbtNetBucket = UnknownRecord & {
  sbtList?: Record<string, UnknownRecord>;
};

export type SbtFilterQuestionEntry = UnknownRecord & {
  creator?: unknown;
  id?: unknown;
};

export type SbtFilterResponseEntry = UnknownRecord & {
  questionId?: unknown;
  responder?: unknown;
  response?: unknown;
};

export type SbtFilterResponseByQuestion = Record<string, SbtFilterResponseEntry[]>;

type SbtFilterItemPredicate = (item: unknown) => boolean;

export type SbtFilterNetworkLike = UnknownRecord & {
  chainId?: unknown;
  id?: unknown;
  networkChainId?: unknown;
};

export type SbtFilterCacheReader = (namespace: string, slug: string, options?: { clone?: boolean }) => unknown;

export const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

export const SBT_FILTER_REAPPLY_STATE_FIELDS = [
  'selectedSBTGroupsCreator',
  'excludedSBTGroupsCreator',
  'selectedSBTGroupsResponder',
  'excludedSBTGroupsResponder',
  'selectedSBTGroups',
  'excludedSBTGroups',
  'onlyVerifiedHumans',
] as const;

export const asCacheObject = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' ? (value as UnknownRecord) : {};

export const buildSbtFilterInitialState = ({
  autoExpand = false,
  externalSBTFilterState = {},
}: {
  autoExpand?: unknown;
  externalSBTFilterState?: unknown;
} = {}): SbtFilterInitialState => {
  const externalState = asCacheObject(externalSBTFilterState);
  return {
    selectedSBTGroupsCreator: externalState.selectedSBTGroupsCreator || [],
    excludedSBTGroupsCreator: externalState.excludedSBTGroupsCreator || [],
    selectedSBTGroupsResponder: externalState.selectedSBTGroupsResponder || [],
    excludedSBTGroupsResponder: externalState.excludedSBTGroupsResponder || [],
    selectedSBTGroups: externalState.selectedSBTGroups || [],
    excludedSBTGroups: externalState.excludedSBTGroups || [],
    onlyVerifiedHumans: externalState.onlyVerifiedHumans || false,
    showFilterOptions: autoExpand || false,
    loading: false,
    showAllSBTs: false,
    lastAppliedFilterSnapshot: null,
  };
};

export const asQuestionNetBucket = (value: unknown): SbtFilterQuestionNetBucket =>
  asCacheObject(value) as SbtFilterQuestionNetBucket;

export const asSbtNetBucket = (value: unknown): SbtFilterSbtNetBucket => asCacheObject(value) as SbtFilterSbtNetBucket;

export const asQuestionEntry = (value: unknown): SbtFilterQuestionEntry | null =>
  isRecord(value) ? (value as SbtFilterQuestionEntry) : null;

export const asResponseEntry = (value: unknown): SbtFilterResponseEntry =>
  isRecord(value) ? (value as SbtFilterResponseEntry) : { response: value };

export const normalizeAggregatorResponseEntries = (value: unknown): SbtFilterResponseEntry[] => {
  if (Array.isArray(value)) return value.map(asResponseEntry);
  const responseMap = asCacheObject(value);
  return Object.keys(responseMap).map((respAddr) => {
    const potentialObj = responseMap[respAddr];
    const entry = asResponseEntry(potentialObj);
    if (entry.responder) return entry;
    return {
      responder: respAddr,
      response: potentialObj,
    };
  });
};

export const filterSbtFilterObjectItems = (
  items: unknown,
  filterItem: SbtFilterItemPredicate,
): Record<string, unknown> => {
  const filteredItems: Record<string, unknown> = {};
  Object.entries(asCacheObject(items)).forEach(([key, val]) => {
    if (Array.isArray(val)) {
      const filteredArr = val.filter((subItem: unknown) => filterItem(subItem));
      if (filteredArr.length > 0) filteredItems[key] = filteredArr;
      return;
    }
    const filteredPairs = Object.entries(asCacheObject(val)).filter(([, respVal]) => filterItem(respVal));
    if (filteredPairs.length > 0) {
      filteredItems[key] = Object.fromEntries(filteredPairs);
    }
  });
  return filteredItems;
};

export function mergeKnownQuestionsIntoFilterItems<T>(baseItems: T, questionNetCache: unknown, mode: unknown): T {
  const questionNetBucket = asQuestionNetBucket(questionNetCache);
  if (!questionNetBucket.questions) {
    return baseItems;
  }

  const questionsById = asCacheObject(questionNetBucket.questions);
  const allKnownQIDs = Object.keys(questionsById);

  if (
    mode === 'creatorAndResponder' ||
    mode === 'creator' ||
    mode === 'questions' ||
    mode === 'questionResponses' ||
    mode === 'responder'
  ) {
    if (Array.isArray(baseItems)) {
      const existingIDs = new Set(baseItems.map((q) => String(isRecord(q) ? q.id || '' : '').toLowerCase()));
      const newArray = [...baseItems];
      allKnownQIDs.forEach((qIdLower) => {
        if (!existingIDs.has(qIdLower)) {
          const qObj = questionsById[qIdLower];
          if (qObj) newArray.push({ ...(qObj as UnknownRecord) });
        }
      });
      return newArray as T;
    }
    if (isRecord(baseItems)) {
      const newObj: UnknownRecord = { ...baseItems };
      allKnownQIDs.forEach((qIdLower) => {
        if (!newObj[qIdLower]) {
          newObj[qIdLower] = [];
        }
      });
      return newObj as T;
    }
  }

  return baseItems;
}

const readSbtFilterCacheBySlug = (
  namespace: string,
  slug: unknown,
  readCache: SbtFilterCacheReader = peekCacheSync,
): UnknownRecord => asCacheObject(readCache(namespace, String(slug || ''), { clone: false }));

export const readSbtFilterQuestionsCacheBySlug = (slug: unknown, readCache?: SbtFilterCacheReader): UnknownRecord =>
  readSbtFilterCacheBySlug('questionsCache', slug, readCache);

export const readSbtFilterSbtCacheBySlug = (slug: unknown, readCache?: SbtFilterCacheReader): UnknownRecord =>
  readSbtFilterCacheBySlug('sbtCache', slug, readCache);

export const buildSbtFilterSbtCacheMemoKey = (slugForCache: unknown = ''): string =>
  `dg:sbtCache:${slugForCache || ''}`;

export const readMemoizedSbtFilterSbtCacheBySlug = ({
  cacheBySlug = null,
  readSbtCacheBySlug: readSbtCacheBySlugFn = readSbtFilterSbtCacheBySlug,
  slugForCache = '',
}: ReadMemoizedSbtFilterSbtCacheBySlugArgs = {}): UnknownRecord => {
  const cacheKey = buildSbtFilterSbtCacheMemoKey(slugForCache);
  if (cacheBySlug?.has(cacheKey)) return cacheBySlug.get(cacheKey) || {};
  const readCacheForSlug = readSbtCacheBySlugFn || readSbtFilterSbtCacheBySlug;
  const parsed = asCacheObject(readCacheForSlug(String(slugForCache || '')));
  cacheBySlug?.set(cacheKey, parsed);
  return parsed;
};

export const readMemoizedSbtFilterSbtNetBucketBySlug = ({
  cacheBySlug = null,
  netKeyForCache = '',
  readSbtCacheBySlug: readSbtCacheBySlugFn = readSbtFilterSbtCacheBySlug,
  slugForCache = '',
}: ReadMemoizedSbtFilterSbtNetBucketBySlugArgs = {}): SbtFilterSbtNetBucket =>
  asSbtNetBucket(
    asCacheObject(
      readMemoizedSbtFilterSbtCacheBySlug({
        cacheBySlug,
        readSbtCacheBySlug: readSbtCacheBySlugFn,
        slugForCache,
      }),
    )[String(netKeyForCache || '')],
  );

export const buildSbtFilterSbtEntryCachePatch = ({
  entryPatch = {},
  netKey: netKeyRaw = '',
  rawCache = {},
  sbtAddress = '',
}: BuildSbtFilterSbtEntryCachePatchArgs = {}): UnknownRecord | null => {
  const netKey = String(netKeyRaw || '');
  if (!netKey) return null;
  const cacheRecord = asCacheObject(rawCache);
  const netCache = asCacheObject(cacheRecord[netKey]);
  const sbtList = asCacheObject(netCache.sbtList);
  const addressKey = String(sbtAddress || '');
  const currentEntry = asCacheObject(sbtList[addressKey]);
  return {
    ...cacheRecord,
    [netKey]: {
      ...netCache,
      sbtList: {
        ...sbtList,
        [addressKey]: {
          ...currentEntry,
          ...asCacheObject(entryPatch),
        },
      },
    },
  };
};

export const readSbtFilterQuestionsNetBucketBySlug = (
  slug: unknown,
  netKey: unknown,
  readCache?: SbtFilterCacheReader,
): SbtFilterQuestionNetBucket =>
  asQuestionNetBucket(asCacheObject(readSbtFilterQuestionsCacheBySlug(slug, readCache))[String(netKey || '')]);

export const getCachedSbtFilterQuestionEntry = (
  questionNetCache: SbtFilterQuestionNetBucket,
  qId: unknown,
): SbtFilterQuestionEntry | null => asQuestionEntry(asCacheObject(questionNetCache.questions)[String(qId || '')]);

export const getCachedSbtFilterQuestionResponseMap = (
  questionNetCache: SbtFilterQuestionNetBucket,
  qId: unknown,
): UnknownRecord => asCacheObject(asCacheObject(questionNetCache.questionResponses)[String(qId)]);

export function unifySbtFilterAggregatorWithAllLocalQuestions<T>(
  baseItems: T,
  networkID: unknown,
  mode: unknown,
  slug: unknown,
  readCache?: SbtFilterCacheReader,
): T {
  const netKey = String(networkID || '');
  if (!netKey) return baseItems;

  const questionNetCache = readSbtFilterQuestionsNetBucketBySlug(slug, netKey, readCache);
  return mergeKnownQuestionsIntoFilterItems(baseItems, questionNetCache, mode);
}

export const scheduleMicrotask = (cb: unknown): void => {
  if (typeof cb !== 'function') return;
  const callback = cb as () => void;
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(callback);
    return;
  }
  Promise.resolve().then(callback);
};

export const doesSbtFilterModeNeedQuestionCache = (mode: unknown): boolean =>
  mode === 'creator' || mode === 'creatorAndResponder' || mode === 'questions';

export const isSbtFilterDataReady = ({
  mode,
  isSBTCacheReady,
  isQuestionCacheReady,
}: SbtFilterDataReadyArgs = {}): boolean => {
  if (mode === 'addresses') return true;
  if (isSBTCacheReady !== true) return false;
  return doesSbtFilterModeNeedQuestionCache(mode) ? isQuestionCacheReady === true : true;
};

export const shouldApplySbtFilterOnDataReady = ({
  hasActiveFilter = false,
  isDataReady = false,
  wasDataReady = false,
}: ShouldApplySbtFilterOnDataReadyArgs = {}): boolean => !!isDataReady && !wasDataReady && !!hasActiveFilter;

export const resolveSbtFilterLoadingUpdate = ({
  currentLoading = false,
  isMounted = false,
  loading = false,
  setFilterLoading = null,
}: ResolveSbtFilterLoadingUpdateArgs = {}): SbtFilterLoadingUpdateDecision => {
  const nextLoading = !!loading;
  return {
    nextLoading,
    shouldNotifyParent: typeof setFilterLoading === 'function',
    shouldSetLocalLoading: !!isMounted && currentLoading !== nextLoading,
  };
};

export const buildSbtFilterLoadingPatch = ({ loading = false }: BuildSbtFilterLoadingPatchArgs = {}): Record<
  string,
  boolean
> => ({
  loading: loading === true,
});

export const buildSbtFilterLastAppliedSnapshotPatch = ({
  snapshot = null,
}: BuildSbtFilterLastAppliedSnapshotPatchArgs = {}): Record<string, unknown> => ({
  lastAppliedFilterSnapshot: snapshot,
});

export const isLatestSbtFilterApplyRun = ({
  activeApplyFilterRunId = 0,
  runId = 0,
}: IsLatestSbtFilterApplyRunArgs = {}): boolean => Number(runId || 0) === Number(activeApplyFilterRunId || 0);

export const hasRelevantSbtFilterStateChanged = ({
  fields = SBT_FILTER_REAPPLY_STATE_FIELDS,
  nextState = {},
  prevState = {},
}: HasRelevantSbtFilterStateChangedArgs = {}): boolean => {
  const prev = asCacheObject(prevState);
  const next = asCacheObject(nextState);
  return (Array.isArray(fields) ? fields : SBT_FILTER_REAPPLY_STATE_FIELDS).some(
    (field) => prev[field] !== next[field],
  );
};

export const resolveSbtFilterExternalStateSync = ({
  currentExternalState = {},
  currentLocalSignature = '',
  lastExternalSignature = undefined,
  prevExternalState = {},
}: ResolveSbtFilterExternalStateSyncArgs = {}): SbtFilterExternalStateSyncDecision => {
  const nextExternalSig = buildSbtFilterStateSignature(currentExternalState || {});
  const prevExternalSig =
    typeof lastExternalSignature === 'string'
      ? lastExternalSignature
      : buildSbtFilterStateSignature(prevExternalState || {});
  const incomingStateNormalized = normalizeIncomingFilterState(currentExternalState || {});
  const incomingSig = buildSbtFilterStateSignature(incomingStateNormalized);
  const hasExternalChanged = prevExternalSig !== nextExternalSig;
  return {
    hasExternalChanged,
    incomingStateNormalized,
    nextExternalSig,
    shouldSyncLocalState: hasExternalChanged && incomingSig !== String(currentLocalSignature || ''),
  };
};

export const buildSbtFilterExternalStateSyncPatch = ({
  incomingStateNormalized = {},
}: BuildSbtFilterExternalStateSyncPatchArgs = {}): UnknownRecord => ({
  ...asCacheObject(incomingStateNormalized),
  lastAppliedFilterSnapshot: null,
});

export const shouldReapplySbtFilterAfterUpdate = ({
  nextProps = {},
  nextState = {},
  prevProps = {},
  prevState = {},
}: ShouldReapplySbtFilterAfterUpdateArgs = {}): boolean => {
  if (hasRelevantSbtFilterStateChanged({ nextState, prevState })) return true;
  const prev = asCacheObject(prevProps);
  const next = asCacheObject(nextProps);
  return prev.items !== next.items || prev.mode !== next.mode || prev.sbtCacheRevision !== next.sbtCacheRevision;
};

export const resolveEffectiveSbtFilterNetwork = ({
  network,
  readSessionChainId,
  sessionSlug,
}: {
  network?: unknown;
  readSessionChainId?: (slug: unknown) => unknown;
  sessionSlug?: unknown;
} = {}): SbtFilterNetworkLike | null => {
  const raw = isRecord(network) ? (network as SbtFilterNetworkLike) : null;
  const sessionChainId =
    Number(typeof readSessionChainId === 'function' ? readSessionChainId(sessionSlug || '') : 0) || null;
  const chainId = Number(raw?.id || raw?.chainId || raw?.networkChainId || sessionChainId || 0) || null;
  if (raw && chainId && Number(raw.id || 0) !== chainId) {
    return { ...raw, id: chainId };
  }
  if (raw) return raw;
  if (!chainId) return null;
  return { id: chainId, chainId };
};

export const getSbtFilterItemCount = (items: unknown): number =>
  Array.isArray(items)
    ? items.length
    : items && typeof items === 'object'
      ? Object.keys(items).length
      : Number(items || 0);

export const shouldExpandMissingAddressItemsForSbtFilter = ({
  expandToSbtHolders,
  mode,
  selectedSBTGroups,
}: {
  expandToSbtHolders?: unknown;
  mode?: unknown;
  selectedSBTGroups?: unknown;
} = {}): boolean =>
  mode === 'addresses' &&
  expandToSbtHolders === true &&
  Array.isArray(selectedSBTGroups) &&
  selectedSBTGroups.length > 0;

export const shouldPassThroughSbtFilter = ({
  hasActiveFilter,
  items,
  shouldExpandMissingAddressItems,
}: {
  hasActiveFilter?: unknown;
  items?: unknown;
  shouldExpandMissingAddressItems?: unknown;
} = {}): boolean => !hasActiveFilter || (!items && !shouldExpandMissingAddressItems);

export const resolveSbtFilterAddressItemsToFilter = ({
  items = null,
  selectedAddressHolderSet = null,
  shouldExpandAddresses = false,
}: ResolveSbtFilterAddressItemsToFilterArgs = {}): unknown => {
  if (shouldExpandAddresses !== true) return items;

  const expanded = new Set<string>();
  (Array.isArray(items) ? items : []).forEach((addr: unknown) => {
    if (typeof addr === 'string' && addr.trim()) {
      expanded.add(addr.toLowerCase());
    }
  });
  if (selectedAddressHolderSet instanceof Set) {
    selectedAddressHolderSet.forEach((holder) => expanded.add(holder));
  }
  return Array.from(expanded);
};

const ITEMS_SOURCE_SIG_MAX_DEPTH = 2;
const ITEMS_SOURCE_SIG_HASH_SEED = 2166136261;
const ITEMS_SOURCE_OBJECT_MAX_DEPTH = 4;

const hashIdentityPart = (seed: unknown, value: unknown): number => {
  const input = String(value || '');
  let hash = Number(seed) >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

const normalizeIdentityPrimitive = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nan';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (Array.isArray(value)) return `arr:${value.length}`;
  if (typeof value === 'object') return `obj:${Object.keys(value).length}`;
  return String(value);
};

const normalizeCappedIdentityValue = (value: unknown, trail: WeakSet<object> = new WeakSet()): unknown => {
  if (value === undefined) return '__undefined__';
  if (value === null) return null;
  if (typeof value === 'string') return String(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : 'nan';
  if (typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return `__bigint:${value.toString(10)}`;
  if (typeof value !== 'object') return String(value);
  const objectValue = value as object;
  if (trail.has(objectValue)) return '__circular__';
  trail.add(objectValue);
  if (Array.isArray(value)) {
    const normalizedArray = value.map((entry) => normalizeCappedIdentityValue(entry, trail));
    trail.delete(objectValue);
    return normalizedArray;
  }
  const normalizedObject: UnknownRecord = {};
  const entries = Object.entries(value as UnknownRecord)
    .map(
      ([key, nextValue]) =>
        [
          String(key || '')
            .trim()
            .toLowerCase(),
          nextValue,
        ] as [string, unknown],
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  entries.forEach(([key, nextValue]) => {
    normalizedObject[key] = normalizeCappedIdentityValue(nextValue, trail);
  });
  trail.delete(objectValue);
  return normalizedObject;
};

const buildCappedNestedHash = (value: unknown): number => {
  try {
    const normalized = normalizeCappedIdentityValue(value);
    return hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, JSON.stringify(normalized) || '');
  } catch (_) {
    return hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, String(value || ''));
  }
};

const buildNestedIdentitySignature = (value: unknown, depth = 0): string => {
  if (value == null || typeof value !== 'object') {
    return `p:${normalizeIdentityPrimitive(value)}`;
  }

  if (depth >= ITEMS_SOURCE_OBJECT_MAX_DEPTH) {
    if (Array.isArray(value)) {
      return `a:${value.length}:${buildCappedNestedHash(value) >>> 0}`;
    }
    return `o:${Object.keys(value).length}:${buildCappedNestedHash(value) >>> 0}`;
  }

  if (Array.isArray(value)) {
    let hash = hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, `a:${value.length}`);
    value.forEach((entry, index) => {
      hash = hashIdentityPart(hash, String(index));
      hash = hashIdentityPart(hash, buildNestedIdentitySignature(entry, depth + 1));
    });
    return `a:${value.length}:${hash >>> 0}`;
  }

  const entries = Object.entries(value as UnknownRecord)
    .map(
      ([key, nextValue]) =>
        [
          String(key || '')
            .trim()
            .toLowerCase(),
          nextValue,
        ] as [string, unknown],
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  let hash = hashIdentityPart(ITEMS_SOURCE_SIG_HASH_SEED, `o:${entries.length}`);
  entries.forEach(([key, nextValue]) => {
    hash = hashIdentityPart(hash, key);
    hash = hashIdentityPart(hash, buildNestedIdentitySignature(nextValue, depth + 1));
  });
  return `o:${entries.length}:${hash >>> 0}`;
};

const buildEntryResponseIdentityPayload = (entry: unknown): unknown => {
  if (!isRecord(entry)) return null;
  if (Object.prototype.hasOwnProperty.call(entry, 'response')) {
    return entry.response;
  }

  const hasAnswerLikeFields =
    Object.prototype.hasOwnProperty.call(entry, 'answer') ||
    Object.prototype.hasOwnProperty.call(entry, 'additional') ||
    Object.prototype.hasOwnProperty.call(entry, 'additionalComment') ||
    Object.prototype.hasOwnProperty.call(entry, 'additionalComments') ||
    Object.prototype.hasOwnProperty.call(entry, 'importance') ||
    Object.prototype.hasOwnProperty.call(entry, 'conviction');
  if (hasAnswerLikeFields) {
    return {
      answer: Object.prototype.hasOwnProperty.call(entry, 'answer') ? entry.answer : null,
      additional: Object.prototype.hasOwnProperty.call(entry, 'additional')
        ? entry.additional
        : Object.prototype.hasOwnProperty.call(entry, 'additionalComment')
          ? entry.additionalComment
          : Object.prototype.hasOwnProperty.call(entry, 'additionalComments')
            ? entry.additionalComments
            : null,
      importance: Object.prototype.hasOwnProperty.call(entry, 'importance') ? entry.importance : null,
      conviction: Object.prototype.hasOwnProperty.call(entry, 'conviction') ? entry.conviction : null,
    };
  }

  if (Object.prototype.hasOwnProperty.call(entry, 'value')) {
    return entry.value;
  }
  if (Object.prototype.hasOwnProperty.call(entry, 'responses')) {
    return entry.responses;
  }
  return null;
};

const buildEntryIdentityToken = (entry: unknown): string => {
  if (!isRecord(entry)) return normalizeIdentityPrimitive(entry);
  const id = normalizeIdentityPrimitive(entry.id || entry.questionId || entry.questionID);
  const responder = normalizeIdentityPrimitive(entry.responder);
  const creator = normalizeIdentityPrimitive(entry.creator);
  const address = normalizeIdentityPrimitive(entry.address || entry.sbtAddress);
  const slug = normalizeIdentityPrimitive(entry.sessionSlug || entry.slug || entry.group);
  const chain = normalizeIdentityPrimitive(entry.chainId || entry.chainID);
  const timestamp = normalizeIdentityPrimitive(entry.timestamp ?? entry.timeStamp ?? '');
  const responseLike = buildEntryResponseIdentityPayload(entry);
  const responseSig = buildNestedIdentitySignature(responseLike);
  const dense = [id, responder, creator, address, slug, chain, timestamp].filter(Boolean).join('|');
  if (dense) return `${dense}|${responseSig}`;

  const keys = Object.keys(entry).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const preview = keys
    .slice(0, 6)
    .map((key) => `${key}:${buildNestedIdentitySignature(entry[key])}`)
    .join(',');
  return `obj:${keys.length}:${preview}|${responseSig}`;
};

const buildAllIndexes = (size: unknown): number[] => {
  const total = Math.max(0, Number(size) || 0);
  return Array.from({ length: total }, (_, i) => i);
};

const buildValueIdentitySignature = (value: unknown, depth = 0): string => {
  if (value == null || typeof value !== 'object') {
    return `p:${normalizeIdentityPrimitive(value)}`;
  }

  if (depth >= ITEMS_SOURCE_SIG_MAX_DEPTH) {
    return `d:${buildEntryIdentityToken(value)}`;
  }

  if (Array.isArray(value)) {
    const indexes = buildAllIndexes(value.length);
    let hash = ITEMS_SOURCE_SIG_HASH_SEED;
    indexes.forEach((index) => {
      hash = hashIdentityPart(hash, String(index));
      hash = hashIdentityPart(hash, buildValueIdentitySignature(value[index], depth + 1));
    });
    return `a:${value.length}:${indexes.length}:${hash >>> 0}`;
  }

  const entries = Object.entries(value as UnknownRecord)
    .map(
      ([key, nextValue]) =>
        [
          String(key || '')
            .trim()
            .toLowerCase(),
          nextValue,
        ] as [string, unknown],
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const indexes = buildAllIndexes(entries.length);
  let hash = ITEMS_SOURCE_SIG_HASH_SEED;
  indexes.forEach((idx) => {
    const [key, nextValue] = entries[idx];
    hash = hashIdentityPart(hash, key);
    hash = hashIdentityPart(hash, buildValueIdentitySignature(nextValue, depth + 1));
  });
  return `o:${entries.length}:${indexes.length}:${hash >>> 0}:${buildEntryIdentityToken(value)}`;
};

export const buildItemsSourceSignature = (items: unknown): string => buildValueIdentitySignature(items, 0);

export const buildSbtFilterSelectedEntryList = ({
  excludedSBTGroups = [],
  excludedSBTGroupsCreator = [],
  excludedSBTGroupsResponder = [],
  selectedSBTGroups = [],
  selectedSBTGroupsCreator = [],
  selectedSBTGroupsResponder = [],
}: BuildSbtFilterSelectedEntryListArgs = {}): unknown[] =>
  [
    ...selectedSBTGroupsCreator,
    ...excludedSBTGroupsCreator,
    ...selectedSBTGroupsResponder,
    ...excludedSBTGroupsResponder,
    ...selectedSBTGroups,
    ...excludedSBTGroups,
  ].filter(Boolean);

export const buildUniqueSbtEntries = (sbtEntries: unknown = []): Map<string, SbtFilterSelectedSbtEntry> => {
  const uniqueSbtEntries: Map<string, SbtFilterSelectedSbtEntry> = new Map();
  (Array.isArray(sbtEntries) ? sbtEntries : []).forEach((sbtInput) => {
    const sbt = asSelectedSbtEntry(sbtInput);
    const addr = String(sbt.address || '').toLowerCase();
    if (!addr) return;
    const existing = uniqueSbtEntries.get(addr);
    if (!existing) {
      uniqueSbtEntries.set(addr, sbt);
      return;
    }
    if (!existing.sessionSlug && (sbt.sessionSlug || sbt.slug || sbt.sessionName)) {
      uniqueSbtEntries.set(addr, {
        ...existing,
        sessionSlug: sbt.sessionSlug || sbt.slug || existing.sessionSlug,
        sessionName: sbt.sessionName || existing.sessionName,
        chainId: sbt.chainId || sbt.chainID || existing.chainId,
      });
    }
  });
  return uniqueSbtEntries;
};

export const doesAddressPassHolderSets = (
  address: unknown,
  includeSet: Set<string>,
  hasIncludeGroups: boolean,
  excludeSet: Set<string>,
): boolean => {
  if (!address) return true;
  const lowerAddr = String(address || '').toLowerCase();
  if (excludeSet && excludeSet.size > 0 && excludeSet.has(lowerAddr)) {
    return false;
  }
  if (hasIncludeGroups && (!includeSet || !includeSet.has(lowerAddr))) {
    return false;
  }
  return true;
};

export const resolveSbtFilterAddressItemDecision = ({
  excludedAddressHolderSet = null,
  hasSelectedGroups = false,
  item = null,
  selectedAddressHolderSet = null,
}: ResolveSbtFilterAddressItemDecisionArgs = {}): SbtFilterAddressItemDecision => {
  if (!item) {
    return {
      address: '',
      passes: false,
      shouldLogInvalidType: false,
    };
  }
  if (typeof item !== 'string') {
    return {
      address: '',
      passes: false,
      shouldLogInvalidType: true,
    };
  }
  const address = item.toLowerCase();
  return {
    address,
    passes: doesAddressPassHolderSets(
      address,
      selectedAddressHolderSet instanceof Set ? selectedAddressHolderSet : new Set<string>(),
      !!hasSelectedGroups,
      excludedAddressHolderSet instanceof Set ? excludedAddressHolderSet : new Set<string>(),
    ),
    shouldLogInvalidType: false,
  };
};

export const resolveSbtFilterItemParticipantAddresses = (item: unknown): SbtFilterItemParticipantAddresses => {
  const itemRecord = asCacheObject(item);
  return {
    creator: itemRecord.creator ? String(itemRecord.creator).toLowerCase() : null,
    responder: itemRecord.responder ? String(itemRecord.responder).toLowerCase() : null,
  };
};

export const doesSbtFilterAddressPassSelection = ({
  address = '',
  excludedAddressHolderSet = new Set<string>(),
  excludedCreatorHolderSet = new Set<string>(),
  excludedResponderHolderSet = new Set<string>(),
  excludedSBTGroups = [],
  excludedSBTGroupsCreator = [],
  excludedSBTGroupsResponder = [],
  excludedSBTs = [],
  sbtHoldersMap = {},
  selectedAddressHolderSet = new Set<string>(),
  selectedCreatorHolderSet = new Set<string>(),
  selectedResponderHolderSet = new Set<string>(),
  selectedSBTGroups = [],
  selectedSBTGroupsCreator = [],
  selectedSBTGroupsResponder = [],
  selectedSBTs = [],
}: DoesSbtFilterAddressPassSelectionArgs = {}): boolean => {
  if (selectedSBTs === selectedSBTGroupsCreator && excludedSBTs === excludedSBTGroupsCreator) {
    return doesAddressPassHolderSets(
      address,
      selectedCreatorHolderSet,
      Array.isArray(selectedSBTGroupsCreator) && selectedSBTGroupsCreator.length > 0,
      excludedCreatorHolderSet,
    );
  }
  if (selectedSBTs === selectedSBTGroupsResponder && excludedSBTs === excludedSBTGroupsResponder) {
    return doesAddressPassHolderSets(
      address,
      selectedResponderHolderSet,
      Array.isArray(selectedSBTGroupsResponder) && selectedSBTGroupsResponder.length > 0,
      excludedResponderHolderSet,
    );
  }
  if (selectedSBTs === selectedSBTGroups && excludedSBTs === excludedSBTGroups) {
    return doesAddressPassHolderSets(
      address,
      selectedAddressHolderSet,
      Array.isArray(selectedSBTGroups) && selectedSBTGroups.length > 0,
      excludedAddressHolderSet,
    );
  }
  return doesAddressPassHolderSets(
    address,
    buildHolderUnionSet(selectedSBTs, sbtHoldersMap),
    Array.isArray(selectedSBTs) && selectedSBTs.length > 0,
    buildHolderUnionSet(excludedSBTs, sbtHoldersMap),
  );
};

export const resolveSbtFilterEmptyResponderShortCircuit = ({
  items = null,
  mode = '',
  selectedResponderHolderSet = null,
  selectedSBTGroupsResponder = [],
}: ResolveSbtFilterEmptyResponderShortCircuitArgs = {}): SbtFilterEmptyResponderShortCircuitResult => {
  const hasResponderInclude = Array.isArray(selectedSBTGroupsResponder) && selectedSBTGroupsResponder.length > 0;
  const responderHolderCount = selectedResponderHolderSet instanceof Set ? selectedResponderHolderSet.size : 0;
  if (!hasResponderInclude || responderHolderCount > 0) {
    return {
      shouldShortCircuit: false,
      result: null,
      logMessage: '',
    };
  }

  if (mode === 'responder' || mode === 'questionResponses') {
    return {
      shouldShortCircuit: true,
      result: Array.isArray(items) ? [] : {},
      logMessage: '[SBTFilter] Responder include list has no holders. Returning empty result.',
    };
  }

  if (mode === 'creatorAndResponder') {
    let result: unknown = [];
    if (Array.isArray(items)) {
      result = { filteredQuestions: [], filteredResponsesByQuestion: {} };
    } else if (items && typeof items === 'object') {
      result = {};
    }
    return {
      shouldShortCircuit: true,
      result,
      logMessage: '[SBTFilter] (creatorAndResponder) Responder include has 0 holders -> return empty.',
    };
  }

  return {
    shouldShortCircuit: false,
    result: null,
    logMessage: '',
  };
};
