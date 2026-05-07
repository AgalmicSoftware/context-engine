import { peekCacheSync } from '../../utilities/cache/cacheScripts.js';
import {
  asSelectedSbtEntry,
  buildSbtFilterStateSignature,
  normalizeIncomingFilterState,
} from './sbtFilterSelectionHelpers';
import type {
  SbtFilterSelectedSbtEntry,
  SbtFilterSelectionState,
} from './sbtFilterSelectionHelpers';
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

export type AddressCountMap = Record<string, number>;

type HistorySummaryCountArgs = {
  burnedCountByAddress?: unknown;
  burnedEventCount?: unknown;
  mintedCountByAddress?: unknown;
  mintedEventCount?: unknown;
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
type SbtFilterHolderRevisionKeyArgs = {
  burnedCountFingerprint?: unknown;
  burnedListFingerprint?: unknown;
  countsLoaded?: unknown;
  creationBlock?: unknown;
  mintedCountFingerprint?: unknown;
  mintedListFingerprint?: unknown;
  netKey?: unknown;
  sbtAddress?: unknown;
  sbtCacheRevision?: unknown;
  sbtSlug?: unknown;
  shouldUseEntryCountMaps?: unknown;
};
type ResolveSbtFilterCreationBlockArgs = {
  entry?: unknown;
  entrySbtInfo?: unknown;
  sbtInfoRecord?: unknown;
  sbtRecord?: unknown;
};
type ResolveSbtFilterEntryCountMapUsageArgs = {
  entry?: unknown;
  entryBurned?: unknown;
  entryBurnedCountMap?: unknown;
  entryMinted?: unknown;
  entryMintedCountMap?: unknown;
  rawEntryBurnedCounts?: unknown;
  rawEntryMintedCounts?: unknown;
};
type SbtFilterEntryCountMapUsage = {
  checkpointBackedPartialCounts: boolean;
  hasAuthoritativeEntryCountMaps: boolean;
  hasStructuredEntryCountMaps: boolean;
  shouldUseEntryCountMaps: boolean;
};
type SbtFilterHolderRequestKeyArgs = {
  fromBlock?: unknown;
  netKey?: unknown;
  sbtAddress?: unknown;
  sbtSlug?: unknown;
};
type BuildSbtFilterHolderFetchResultArgs = {
  counts?: unknown;
  resolveHoldersSet?: ((
    mintedCountByAddress: AddressCountMap,
    burnedCountByAddress: AddressCountMap
  ) => Set<string>) | null;
};
type BuildSbtFilterFetchedHolderCacheEntryPatchArgs = {
  fetched?: Partial<SbtFilterHolderFetchResult> | null;
};
type BuildSbtFilterFetchedHolderRevisionKeyArgs = {
  fetched?: Partial<SbtFilterHolderFetchResult> | null;
  fromBlock?: unknown;
  netKey?: unknown;
  sbtAddress?: unknown;
  sbtCacheRevision?: unknown;
  sbtSlug?: unknown;
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
type BuildSbtFilterHolderSelectionSetsArgs = {
  excludedSBTGroups?: unknown;
  excludedSBTGroupsCreator?: unknown;
  excludedSBTGroupsResponder?: unknown;
  sbtHoldersMap?: SbtHolderSetMap;
  selectedSBTGroups?: unknown;
  selectedSBTGroupsCreator?: unknown;
  selectedSBTGroupsResponder?: unknown;
};
type BuildSbtFilterSelectedEntryListArgs = {
  excludedSBTGroups?: unknown[];
  excludedSBTGroupsCreator?: unknown[];
  excludedSBTGroupsResponder?: unknown[];
  selectedSBTGroups?: unknown[];
  selectedSBTGroupsCreator?: unknown[];
  selectedSBTGroupsResponder?: unknown[];
};
type SbtFilterHolderSelectionSets = {
  excludedAddressHolderSet: Set<string>;
  excludedCreatorHolderSet: Set<string>;
  excludedResponderHolderSet: Set<string>;
  selectedAddressHolderSet: Set<string>;
  selectedCreatorHolderSet: Set<string>;
  selectedResponderHolderSet: Set<string>;
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

export type SbtFilterHolderFetchResult = {
  burnedAddresses: string[];
  burnedCountByAddress: AddressCountMap;
  burnedEventCount: number;
  holdersSet: Set<string>;
  mintedAddresses: string[];
  mintedCountByAddress: AddressCountMap;
  mintedEventCount: number;
  scannedToBlock: number | null;
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

export type SbtHolderSetMap = Record<string, Set<string>>;
type SbtFilterItemPredicate = (item: unknown) => boolean;

export type SbtFilterNetworkLike = UnknownRecord & {
  chainId?: unknown;
  id?: unknown;
  networkChainId?: unknown;
};

export type SbtFilterCacheReader = (
  namespace: string,
  slug: string,
  options?: { clone?: boolean }
) => unknown;

export const isRecord = (value: unknown): value is UnknownRecord => (
  !!value && typeof value === 'object'
);

export const SBT_FILTER_REAPPLY_STATE_FIELDS = [
  'selectedSBTGroupsCreator',
  'excludedSBTGroupsCreator',
  'selectedSBTGroupsResponder',
  'excludedSBTGroupsResponder',
  'selectedSBTGroups',
  'excludedSBTGroups',
  'onlyVerifiedHumans',
] as const;

export const asCacheObject = (value: unknown): UnknownRecord => (
  (value && typeof value === 'object') ? value as UnknownRecord : {}
);

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

export const asQuestionNetBucket = (value: unknown): SbtFilterQuestionNetBucket => (
  asCacheObject(value) as SbtFilterQuestionNetBucket
);

export const asSbtNetBucket = (value: unknown): SbtFilterSbtNetBucket => (
  asCacheObject(value) as SbtFilterSbtNetBucket
);

export const asQuestionEntry = (value: unknown): SbtFilterQuestionEntry | null => (
  isRecord(value) ? value as SbtFilterQuestionEntry : null
);

export const asResponseEntry = (value: unknown): SbtFilterResponseEntry => (
  isRecord(value) ? value as SbtFilterResponseEntry : { response: value }
);

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
  filterItem: SbtFilterItemPredicate
): Record<string, unknown> => {
  const filteredItems: Record<string, unknown> = {};
  Object.entries(asCacheObject(items)).forEach(([key, val]) => {
    if (Array.isArray(val)) {
      const filteredArr = val.filter((subItem: unknown) => filterItem(subItem));
      if (filteredArr.length > 0) filteredItems[key] = filteredArr;
      return;
    }
    const filteredPairs = Object.entries(asCacheObject(val))
      .filter(([, respVal]) => filterItem(respVal));
    if (filteredPairs.length > 0) {
      filteredItems[key] = Object.fromEntries(filteredPairs);
    }
  });
  return filteredItems;
};

export function mergeKnownQuestionsIntoFilterItems<T>(
  baseItems: T,
  questionNetCache: unknown,
  mode: unknown
): T {
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
      const existingIDs = new Set(baseItems.map((q) => (
        String(isRecord(q) ? q.id || '' : '').toLowerCase()
      )));
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
  readCache: SbtFilterCacheReader = peekCacheSync
): UnknownRecord => (
  asCacheObject(readCache(namespace, String(slug || ''), { clone: false }))
);

export const readSbtFilterQuestionsCacheBySlug = (
  slug: unknown,
  readCache?: SbtFilterCacheReader
): UnknownRecord => (
  readSbtFilterCacheBySlug('questionsCache', slug, readCache)
);

export const readSbtFilterSbtCacheBySlug = (
  slug: unknown,
  readCache?: SbtFilterCacheReader
): UnknownRecord => (
  readSbtFilterCacheBySlug('sbtCache', slug, readCache)
);

export const buildSbtFilterSbtCacheMemoKey = (slugForCache: unknown = ''): string => (
  `dg:sbtCache:${slugForCache || ''}`
);

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
}: ReadMemoizedSbtFilterSbtNetBucketBySlugArgs = {}): SbtFilterSbtNetBucket => (
  asSbtNetBucket(asCacheObject(readMemoizedSbtFilterSbtCacheBySlug({
    cacheBySlug,
    readSbtCacheBySlug: readSbtCacheBySlugFn,
    slugForCache,
  }))[String(netKeyForCache || '')])
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
  readCache?: SbtFilterCacheReader
): SbtFilterQuestionNetBucket => (
  asQuestionNetBucket(asCacheObject(readSbtFilterQuestionsCacheBySlug(slug, readCache))[String(netKey || '')])
);

export const getCachedSbtFilterQuestionEntry = (
  questionNetCache: SbtFilterQuestionNetBucket,
  qId: unknown
): SbtFilterQuestionEntry | null => (
  asQuestionEntry(asCacheObject(questionNetCache.questions)[String(qId || '')])
);

export const getCachedSbtFilterQuestionResponseMap = (
  questionNetCache: SbtFilterQuestionNetBucket,
  qId: unknown
): UnknownRecord => (
  asCacheObject(asCacheObject(questionNetCache.questionResponses)[String(qId)])
);

export function unifySbtFilterAggregatorWithAllLocalQuestions<T>(
  baseItems: T,
  networkID: unknown,
  mode: unknown,
  slug: unknown,
  readCache?: SbtFilterCacheReader
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

export const doesSbtFilterModeNeedQuestionCache = (mode: unknown): boolean => (
  mode === 'creator' ||
  mode === 'creatorAndResponder' ||
  mode === 'questions'
);

export const isSbtFilterDataReady = ({
  mode,
  isSBTCacheReady,
  isQuestionCacheReady,
}: SbtFilterDataReadyArgs = {}): boolean => {
  if (mode === 'addresses') return true;
  if (isSBTCacheReady !== true) return false;
  return doesSbtFilterModeNeedQuestionCache(mode)
    ? isQuestionCacheReady === true
    : true;
};

export const shouldApplySbtFilterOnDataReady = ({
  hasActiveFilter = false,
  isDataReady = false,
  wasDataReady = false,
}: ShouldApplySbtFilterOnDataReadyArgs = {}): boolean => (
  !!isDataReady && !wasDataReady && !!hasActiveFilter
);

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

export const buildSbtFilterLoadingPatch = ({
  loading = false,
}: BuildSbtFilterLoadingPatchArgs = {}): Record<string, boolean> => ({
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
}: IsLatestSbtFilterApplyRunArgs = {}): boolean => (
  Number(runId || 0) === Number(activeApplyFilterRunId || 0)
);

export const hasRelevantSbtFilterStateChanged = ({
  fields = SBT_FILTER_REAPPLY_STATE_FIELDS,
  nextState = {},
  prevState = {},
}: HasRelevantSbtFilterStateChangedArgs = {}): boolean => {
  const prev = asCacheObject(prevState);
  const next = asCacheObject(nextState);
  return (Array.isArray(fields) ? fields : SBT_FILTER_REAPPLY_STATE_FIELDS)
    .some((field) => prev[field] !== next[field]);
};

export const resolveSbtFilterExternalStateSync = ({
  currentExternalState = {},
  currentLocalSignature = '',
  lastExternalSignature = undefined,
  prevExternalState = {},
}: ResolveSbtFilterExternalStateSyncArgs = {}): SbtFilterExternalStateSyncDecision => {
  const nextExternalSig = buildSbtFilterStateSignature(currentExternalState || {});
  const prevExternalSig = typeof lastExternalSignature === 'string'
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
  return (
    prev.items !== next.items ||
    prev.mode !== next.mode ||
    prev.sbtCacheRevision !== next.sbtCacheRevision
  );
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
  const raw = isRecord(network) ? network as SbtFilterNetworkLike : null;
  const sessionChainId = Number(
    typeof readSessionChainId === 'function'
      ? readSessionChainId(sessionSlug || '')
      : 0
  ) || null;
  const chainId = Number(
    raw?.id ||
    raw?.chainId ||
    raw?.networkChainId ||
    sessionChainId ||
    0
  ) || null;
  if (raw && chainId && Number(raw.id || 0) !== chainId) {
    return { ...raw, id: chainId };
  }
  if (raw) return raw;
  if (!chainId) return null;
  return { id: chainId, chainId };
};

export const getSbtFilterItemCount = (items: unknown): number => (
  Array.isArray(items)
    ? items.length
    : (items && typeof items === 'object')
      ? Object.keys(items).length
      : Number(items || 0)
);

export const shouldExpandMissingAddressItemsForSbtFilter = ({
  expandToSbtHolders,
  mode,
  selectedSBTGroups,
}: {
  expandToSbtHolders?: unknown;
  mode?: unknown;
  selectedSBTGroups?: unknown;
} = {}): boolean => (
  mode === 'addresses' &&
  expandToSbtHolders === true &&
  Array.isArray(selectedSBTGroups) &&
  selectedSBTGroups.length > 0
);

export const shouldPassThroughSbtFilter = ({
  hasActiveFilter,
  items,
  shouldExpandMissingAddressItems,
}: {
  hasActiveFilter?: unknown;
  items?: unknown;
  shouldExpandMissingAddressItems?: unknown;
} = {}): boolean => (
  !hasActiveFilter ||
  (!items && !shouldExpandMissingAddressItems)
);

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
    .map(([key, nextValue]) => [String(key || '').trim().toLowerCase(), nextValue] as [string, unknown])
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
    .map(([key, nextValue]) => [String(key || '').trim().toLowerCase(), nextValue] as [string, unknown])
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

  const hasAnswerLikeFields = (
    Object.prototype.hasOwnProperty.call(entry, 'answer') ||
    Object.prototype.hasOwnProperty.call(entry, 'additional') ||
    Object.prototype.hasOwnProperty.call(entry, 'additionalComment') ||
    Object.prototype.hasOwnProperty.call(entry, 'additionalComments') ||
    Object.prototype.hasOwnProperty.call(entry, 'importance') ||
    Object.prototype.hasOwnProperty.call(entry, 'conviction')
  );
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
  const timestamp = normalizeIdentityPrimitive(
    entry.timestamp ?? entry.timeStamp ?? ''
  );
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
    .map(([key, nextValue]) => [String(key || '').trim().toLowerCase(), nextValue] as [string, unknown])
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

export const buildItemsSourceSignature = (items: unknown): string => (
  buildValueIdentitySignature(items, 0)
);

export const normalizeAddressCountMap = (value: unknown = null): AddressCountMap => {
  const out: AddressCountMap = {};
  Object.entries(isRecord(value) ? value : {}).forEach(([addrRaw, countRaw]) => {
    const addr = String(addrRaw || '').toLowerCase();
    if (!addr) return;
    const count = Math.max(0, Math.floor(Number(countRaw || 0)));
    if (count <= 0) return;
    out[addr] = count;
  });
  return out;
};

export const countMapFingerprint = (value: unknown = null): string => {
  const entries = Object.entries(normalizeAddressCountMap(value))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  if (!entries.length) return 'nil';
  let hash = 0;
  entries.forEach(([addr, count]) => {
    const token = `${addr}:${count}`;
    for (let i = 0; i < token.length; i += 1) {
      hash = ((hash * 31) + token.charCodeAt(i)) | 0;
    }
    hash = ((hash * 131) + 1) | 0;
  });
  return `${entries.length}:${hash}`;
};

export const resolveSbtFilterEntryCountMapUsage = ({
  entry = null,
  entryBurned = null,
  entryBurnedCountMap = {},
  entryMinted = null,
  entryMintedCountMap = {},
  rawEntryBurnedCounts = null,
  rawEntryMintedCounts = null,
}: ResolveSbtFilterEntryCountMapUsageArgs = {}): SbtFilterEntryCountMapUsage => {
  const entryRecord = asCacheObject(entry);
  const mintedCountMapRecord = asCacheObject(entryMintedCountMap);
  const burnedCountMapRecord = asCacheObject(entryBurnedCountMap);
  const checkpointBackedPartialCounts =
    entryRecord.countsLoaded !== true &&
    !!entryRecord.countsScanCheckpoint &&
    typeof entryRecord.countsScanCheckpoint === 'object';
  const hasStructuredEntryCountMaps =
    (
      !!rawEntryMintedCounts &&
      typeof rawEntryMintedCounts === 'object' &&
      !Array.isArray(rawEntryMintedCounts)
    ) || (
      !!rawEntryBurnedCounts &&
      typeof rawEntryBurnedCounts === 'object' &&
      !Array.isArray(rawEntryBurnedCounts)
    );
  const hasAuthoritativeEntryCountMaps =
    (
      Object.keys(mintedCountMapRecord).length > 0 ||
      Object.keys(burnedCountMapRecord).length > 0 ||
      (entryRecord.countsLoaded === true && hasStructuredEntryCountMaps && !entryMinted && !entryBurned)
    );
  return {
    checkpointBackedPartialCounts,
    hasAuthoritativeEntryCountMaps,
    hasStructuredEntryCountMaps,
    shouldUseEntryCountMaps: !checkpointBackedPartialCounts && hasAuthoritativeEntryCountMaps,
  };
};

export const computeHolderListFingerprint = (addresses: unknown): string => {
  if (!Array.isArray(addresses)) return 'nil';
  let hash = 0;
  for (let i = 0; i < addresses.length; i += 1) {
    const normalized = String(addresses[i] || '').toLowerCase();
    for (let j = 0; j < normalized.length; j += 1) {
      hash = ((hash * 31) + normalized.charCodeAt(j)) | 0;
    }
    hash = ((hash * 131) + 1) | 0;
  }
  return `${addresses.length}:${hash}`;
};

export const buildSbtFilterHolderRevisionKey = ({
  burnedCountFingerprint = '',
  burnedListFingerprint = '',
  countsLoaded = false,
  creationBlock = '',
  mintedCountFingerprint = '',
  mintedListFingerprint = '',
  netKey = '',
  sbtAddress = '',
  sbtCacheRevision = 0,
  sbtSlug = '',
  shouldUseEntryCountMaps = false,
}: SbtFilterHolderRevisionKeyArgs = {}): string => (
  [
    String(sbtSlug || ''),
    String(netKey || ''),
    String(sbtAddress || ''),
    String(sbtCacheRevision || 0),
    String(countsLoaded === true ? 1 : 0),
    String(shouldUseEntryCountMaps ? 1 : 0),
    String(mintedCountFingerprint),
    String(burnedCountFingerprint),
    String(mintedListFingerprint),
    String(burnedListFingerprint),
    String(creationBlock ?? ''),
  ].join('|')
);

export const resolveSbtFilterCreationBlock = ({
  entry = null,
  entrySbtInfo = null,
  sbtInfoRecord = null,
  sbtRecord = null,
}: ResolveSbtFilterCreationBlockArgs = {}): unknown => {
  const entryRecord = asCacheObject(entry);
  const entryInfoRecord = asCacheObject(entrySbtInfo);
  const selectedSbtRecord = asCacheObject(sbtRecord);
  const selectedSbtInfoRecord = asCacheObject(sbtInfoRecord);
  return (
    entryRecord.creationBlock ??
    entryInfoRecord.creationBlock ??
    selectedSbtRecord.creationBlock ??
    selectedSbtInfoRecord.creationBlock
  );
};

export const resolveSbtFilterHolderScanFromBlock = (rawCreationBlock: unknown): number => {
  const creationBlock = rawCreationBlock != null ? Number(rawCreationBlock) : NaN;
  return Number.isFinite(creationBlock) && creationBlock >= 0 ? Math.floor(creationBlock) : 0;
};

export const buildSbtFilterHolderRequestKey = ({
  fromBlock = 0,
  netKey = '',
  sbtAddress = '',
  sbtSlug = '',
}: SbtFilterHolderRequestKeyArgs = {}): string => (
  [
    String(sbtSlug || ''),
    String(netKey || ''),
    String(sbtAddress || ''),
    String(fromBlock || 0),
  ].join('|')
);

export const setBoundedSbtHolderMemoEntry = (
  memo: Map<string, Set<string>>,
  key: unknown,
  value: Set<string>,
  maxEntries: number
): void => {
  const memoKey = String(key || '');
  if (!memoKey) return;
  if (memo.has(memoKey)) {
    memo.delete(memoKey);
  }
  while (memo.size >= maxEntries) {
    const oldest = memo.keys().next();
    if (oldest.done) break;
    memo.delete(oldest.value);
  }
  memo.set(memoKey, value);
};

export const buildHistorySummaryFromCounts = ({
  mintedCountByAddress = {},
  burnedCountByAddress = {},
  mintedEventCount = 0,
  burnedEventCount = 0,
}: HistorySummaryCountArgs = {}) => {
  const mintedMap = normalizeAddressCountMap(mintedCountByAddress);
  const burnedMap = normalizeAddressCountMap(burnedCountByAddress);
  const sumCounts = (value: AddressCountMap = {}) => Object.values(value).reduce((sum, count) => (
    sum + Math.max(0, Math.floor(Number(count || 0)))
  ), 0);
  let activeSupply = 0;
  let currentHolderCount = 0;
  Object.keys(mintedMap).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedMap[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedMap[addr] || 0)));
    const net = Math.max(0, minted - burned);
    if (net > 0) currentHolderCount += 1;
    activeSupply += net;
  });
  return {
    totalMinted: String(Math.max(0, Math.floor(Number(mintedEventCount || 0))) || sumCounts(mintedMap)),
    totalBurned: String(Math.max(0, Math.floor(Number(burnedEventCount || 0))) || sumCounts(burnedMap)),
    activeSupply: String(activeSupply),
    currentHolderCount: String(currentHolderCount),
    historicalHolderCount: String(Object.keys(mintedMap).length),
  };
};

export const buildNetHoldersSet = (
  mintedAddresses: unknown = [],
  burnedAddresses: unknown = []
): Set<string> => {
  const burnedSet = new Set<string>(
    (Array.isArray(burnedAddresses) ? burnedAddresses : []).map((addr) => String(addr || '').toLowerCase())
  );
  const holders = new Set<string>();
  (Array.isArray(mintedAddresses) ? mintedAddresses : []).forEach((addr) => {
    const lower = String(addr || '').toLowerCase();
    if (!lower || burnedSet.has(lower)) return;
    holders.add(lower);
  });
  return holders;
};

export const buildNetHoldersSetFromCounts = (
  mintedCountByAddress: unknown = {},
  burnedCountByAddress: unknown = {}
): Set<string> => {
  const mintedMap = normalizeAddressCountMap(mintedCountByAddress);
  const burnedMap = normalizeAddressCountMap(burnedCountByAddress);
  const holders = new Set<string>();
  Object.keys(mintedMap).forEach((addr) => {
    const minted = Math.max(0, Math.floor(Number(mintedMap[addr] || 0)));
    const burned = Math.max(0, Math.floor(Number(burnedMap[addr] || 0)));
    if ((minted - burned) > 0) {
      holders.add(addr);
    }
  });
  return holders;
};

export const buildSbtFilterHolderFetchResult = ({
  counts = null,
  resolveHoldersSet = null,
}: BuildSbtFilterHolderFetchResultArgs = {}): SbtFilterHolderFetchResult => {
  const countsRecord = asCacheObject(counts);
  const mintedCountByAddress = normalizeAddressCountMap(countsRecord.mintedCountByAddress);
  const burnedCountByAddress = normalizeAddressCountMap(countsRecord.burnedCountByAddress);
  const holdersResolver = typeof resolveHoldersSet === 'function'
    ? resolveHoldersSet
    : buildNetHoldersSetFromCounts;

  return {
    mintedAddresses: Object.keys(mintedCountByAddress),
    burnedAddresses: Object.keys(burnedCountByAddress),
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount: Math.max(0, Math.floor(Number(countsRecord.mintedEventCount || 0))),
    burnedEventCount: Math.max(0, Math.floor(Number(countsRecord.burnedEventCount || 0))),
    scannedToBlock: Number.isFinite(Number(countsRecord.scannedToBlock))
      ? Math.floor(Number(countsRecord.scannedToBlock))
      : null,
    holdersSet: holdersResolver(mintedCountByAddress, burnedCountByAddress),
  };
};

export const buildSbtFilterFetchedHolderCacheEntryPatch = ({
  fetched = null,
}: BuildSbtFilterFetchedHolderCacheEntryPatchArgs = {}): UnknownRecord => {
  const mintedAddresses = fetched?.mintedAddresses || [];
  const burnedAddresses = fetched?.burnedAddresses || [];
  const mintedCountByAddress = fetched?.mintedCountByAddress || {};
  const burnedCountByAddress = fetched?.burnedCountByAddress || {};
  const mintedEventCount = fetched?.mintedEventCount || 0;
  const burnedEventCount = fetched?.burnedEventCount || 0;

  return {
    mintedAddresses,
    burnedAddresses,
    mintedCountByAddress,
    burnedCountByAddress,
    mintedEventCount,
    burnedEventCount,
    historySummary: buildHistorySummaryFromCounts({
      mintedCountByAddress,
      burnedCountByAddress,
      mintedEventCount,
      burnedEventCount,
    }),
    blockNumber: Number.isFinite(Number(fetched?.scannedToBlock))
      ? Math.floor(Number(fetched?.scannedToBlock))
      : undefined,
    countsLoaded: true,
    countsScanCheckpoint: null,
  };
};

export const buildSbtFilterFetchedHolderRevisionKey = ({
  fetched = null,
  fromBlock = 0,
  netKey = '',
  sbtAddress = '',
  sbtCacheRevision = 0,
  sbtSlug = '',
}: BuildSbtFilterFetchedHolderRevisionKeyArgs = {}): string => {
  const mintedAddresses = fetched?.mintedAddresses || [];
  const burnedAddresses = fetched?.burnedAddresses || [];
  const mintedCountByAddress = fetched?.mintedCountByAddress || {};
  const burnedCountByAddress = fetched?.burnedCountByAddress || {};

  return buildSbtFilterHolderRevisionKey({
    sbtSlug,
    netKey,
    sbtAddress,
    sbtCacheRevision,
    countsLoaded: true,
    shouldUseEntryCountMaps: true,
    mintedCountFingerprint: countMapFingerprint(mintedCountByAddress),
    burnedCountFingerprint: countMapFingerprint(burnedCountByAddress),
    mintedListFingerprint: computeHolderListFingerprint(mintedAddresses),
    burnedListFingerprint: computeHolderListFingerprint(burnedAddresses),
    creationBlock: fromBlock || 0,
  });
};

export const buildHolderUnionSet = (
  sbtEntries: unknown = [],
  sbtHoldersMap: SbtHolderSetMap = {}
): Set<string> => {
  const union = new Set<string>();
  (Array.isArray(sbtEntries) ? sbtEntries : []).forEach((sbtInput) => {
    const sbt = asSelectedSbtEntry(sbtInput);
    const sbtAddr = String(sbt.address || '').toLowerCase();
    if (!sbtAddr) return;
    const holders = sbtHoldersMap[sbtAddr];
    if (!holders || holders.size === 0) return;
    holders.forEach((holder) => union.add(holder));
  });
  return union;
};

export const buildSbtFilterHolderSelectionSets = ({
  excludedSBTGroups = [],
  excludedSBTGroupsCreator = [],
  excludedSBTGroupsResponder = [],
  sbtHoldersMap = {},
  selectedSBTGroups = [],
  selectedSBTGroupsCreator = [],
  selectedSBTGroupsResponder = [],
}: BuildSbtFilterHolderSelectionSetsArgs = {}): SbtFilterHolderSelectionSets => ({
  selectedCreatorHolderSet: buildHolderUnionSet(selectedSBTGroupsCreator, sbtHoldersMap),
  excludedCreatorHolderSet: buildHolderUnionSet(excludedSBTGroupsCreator, sbtHoldersMap),
  selectedResponderHolderSet: buildHolderUnionSet(selectedSBTGroupsResponder, sbtHoldersMap),
  excludedResponderHolderSet: buildHolderUnionSet(excludedSBTGroupsResponder, sbtHoldersMap),
  selectedAddressHolderSet: buildHolderUnionSet(selectedSBTGroups, sbtHoldersMap),
  excludedAddressHolderSet: buildHolderUnionSet(excludedSBTGroups, sbtHoldersMap),
});

export const buildSbtFilterSelectedEntryList = ({
  excludedSBTGroups = [],
  excludedSBTGroupsCreator = [],
  excludedSBTGroupsResponder = [],
  selectedSBTGroups = [],
  selectedSBTGroupsCreator = [],
  selectedSBTGroupsResponder = [],
}: BuildSbtFilterSelectedEntryListArgs = {}): unknown[] => ([
  ...selectedSBTGroupsCreator,
  ...excludedSBTGroupsCreator,
  ...selectedSBTGroupsResponder,
  ...excludedSBTGroupsResponder,
  ...selectedSBTGroups,
  ...excludedSBTGroups,
].filter(Boolean));

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
  excludeSet: Set<string>
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
      excludedAddressHolderSet instanceof Set ? excludedAddressHolderSet : new Set<string>()
    ),
    shouldLogInvalidType: false,
  };
};

export const resolveSbtFilterItemParticipantAddresses = (
  item: unknown
): SbtFilterItemParticipantAddresses => {
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
      excludedCreatorHolderSet
    );
  }
  if (selectedSBTs === selectedSBTGroupsResponder && excludedSBTs === excludedSBTGroupsResponder) {
    return doesAddressPassHolderSets(
      address,
      selectedResponderHolderSet,
      Array.isArray(selectedSBTGroupsResponder) && selectedSBTGroupsResponder.length > 0,
      excludedResponderHolderSet
    );
  }
  if (selectedSBTs === selectedSBTGroups && excludedSBTs === excludedSBTGroups) {
    return doesAddressPassHolderSets(
      address,
      selectedAddressHolderSet,
      Array.isArray(selectedSBTGroups) && selectedSBTGroups.length > 0,
      excludedAddressHolderSet
    );
  }
  return doesAddressPassHolderSets(
    address,
    buildHolderUnionSet(selectedSBTs, sbtHoldersMap),
    Array.isArray(selectedSBTs) && selectedSBTs.length > 0,
    buildHolderUnionSet(excludedSBTs, sbtHoldersMap)
  );
};

export const resolveSbtFilterEmptyResponderShortCircuit = ({
  items = null,
  mode = '',
  selectedResponderHolderSet = null,
  selectedSBTGroupsResponder = [],
}: ResolveSbtFilterEmptyResponderShortCircuitArgs = {}): SbtFilterEmptyResponderShortCircuitResult => {
  const hasResponderInclude = (
    Array.isArray(selectedSBTGroupsResponder) &&
    selectedSBTGroupsResponder.length > 0
  );
  const responderHolderCount = selectedResponderHolderSet instanceof Set
    ? selectedResponderHolderSet.size
    : 0;
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
