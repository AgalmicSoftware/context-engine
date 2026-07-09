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

export type {
  SbtListChipProgressBooleanBySlug,
  SbtCacheMetaSnapshot,
  SbtCardDetails,
  SbtPassiveLatestLookupInFlightBySlug,
  SbtPassiveLatestLookupStateBySlug,
  SbtListScopedEntryOptions,
};

export type UnknownRecord = Record<string, unknown>;

export type SbtListMetadata = UnknownRecord & {
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

export type SbtListItem = SbtListHelperItem & {
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

export type SbtListPointerEventLike = {
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

export type SbtSessionUniverseSnapshot = SbtListSessionUniverseSnapshot;
export type SbtListLiveProgress = SbtListRealtimeProgressRecord;
export type SbtListBySlug = Record<string, SbtListItem[] | undefined>;
export type SbtListLiveProgressBySlug = SbtListRealtimeProgressBySlug;
export type SbtListBooleanBySlug = Record<string, boolean | undefined>;
export type SbtListLoadState = 'idle' | 'loading' | 'loaded' | 'error';
export type SbtListLoadStateBySlug = Record<string, SbtListLoadState | undefined>;
export type SbtListFetchRunBySlug = Record<string, number | undefined>;

export type SbtSessionDisplayConfig = UnknownRecord & {
  blockLimits?: UnknownRecord & {
    start?: unknown;
  };
  sessionName?: string;
};

export type SbtSessionProgressSnapshot = SbtListSessionProgressSnapshot;
export type SbtSessionLoadingOptions = SbtListSessionLoadingStatusOptions;
export type SbtSessionLoadingStatus = SbtListSessionLoadingStatus;
export type SbtSessionLoadingStatusBySlug = SbtListSessionLoadingStatusBySlug;
export type SbtSessionChipStateBySlug = SbtListSessionChipStateBySlug;

export type SbtListInitDeps = {
  listSlug: string;
  allSessionsMode: boolean;
  selectedSessionSignature: string;
  universeSignature: string;
  sessionUniverseRegistryPending: boolean;
  sbtCacheRevision: number;
};

export type SbtListFetchSBTs = (
  forceRefresh?: boolean,
  showLoadingIndicator?: boolean,
  slugOverride?: unknown,
  options?: {
    markSessionLoading?: boolean;
  },
) => Promise<boolean>;

export type SbtListChipProgressMeta = SbtListChipProgressVisibilityMeta;
export type SbtListChipProgressMetaBySlug = Record<string, SbtListChipProgressMeta | undefined>;
export type SbtListGroupPasswordMap = Record<string, boolean | undefined>;
export type SbtListPasswordFlagResult = [string, boolean];

export type SbtListNetwork = UnknownRecord & {
  id?: unknown;
};

export type SbtLightDiscoveryOptions = {
  force?: boolean;
  forceScopeSlug?: string;
};

export type SbtUniverseDiscoveryOptions = {
  force?: boolean;
};

export type SBTsListProps = {
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
