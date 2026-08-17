import type {
  SBTsPageFeaturedProgressLike,
  SBTsPageFeaturedSbtLike,
  SBTsPageFeaturedSbtMetadataLike,
  SBTsPageSessionConfigLike,
  SBTsPageUnknownRecord,
} from './sbtOverviewPageHelpers';

export type FeaturedProgressLike = SBTsPageFeaturedProgressLike;
export type FeaturedSbtLike = SBTsPageFeaturedSbtLike;
export type FeaturedSbtMetadataLike = SBTsPageFeaturedSbtMetadataLike;
export type SBTSessionConfigLike = SBTsPageSessionConfigLike;
export type UnknownRecord = SBTsPageUnknownRecord;

export type FeaturedEntry = {
  address: string;
  sessionSlug: string;
};

export type CacheBackedFeaturedCard = {
  address: string;
  sessionSlug: string;
  sbt: FeaturedSbtLike & { sbtInfo: FeaturedSbtMetadataLike };
};

export type FeaturedRenderEntry =
  { kind: 'cache'; entry: CacheBackedFeaturedCard } | { kind: 'fallback'; entry: FeaturedEntry };

export type MemoBucket<T> = {
  key: string;
  result: T[];
};

export type FeaturedListArgs = {
  baseFeaturedList?: unknown;
  effectiveSessionSlug?: unknown;
  autoFeature?: unknown;
  baseFeaturedListIsConfigured?: unknown;
  requireExplicitSessionSlug?: unknown;
  isSBTCacheReady?: unknown;
  isAllSessionsMode?: boolean;
  progressBySlug?: Record<string, FeaturedProgressLike | unknown>;
};

export type FeaturedEntriesArgs = {
  baseFeaturedList?: unknown;
  effectiveSessionSlug?: unknown;
  effectiveSessionAutoFeature?: unknown;
  requireExplicitAutoFeatureSessionSlug?: unknown;
  isSBTCacheReady?: unknown;
  isAllSessionsMode?: boolean;
  includeListScopeSessions?: boolean;
  listScopeSessionSlugs?: unknown;
  progressBySlug?: Record<string, FeaturedProgressLike | unknown>;
};

export type FeaturedCacheCardsArgs = {
  featuredEntries?: unknown;
  isSBTCacheReady?: unknown;
  progressBySlug?: Record<string, FeaturedProgressLike | unknown>;
};

export type SBTsPageProps = UnknownRecord & {
  sessionSlug?: string | null;
  sessionConfig?: SBTSessionConfigLike | null;
  activeSessionSlug?: string | null;
  sessionName?: string;
  sessionInfo?: string;
  workerGroupId?: string;
  provider?: unknown;
  network?: unknown;
  account?: unknown;
  litHooks?: unknown;
  loginComplete?: boolean;
  toggleLoginModal?: unknown;
  isSBTCacheReady?: boolean;
  sbtCacheRevision?: number | string | null;
  defaultSbtTags?: unknown;
  defaultFeaturedSBTs?: unknown[];
  onCreateGroupToggleExternal?: () => void;
  showCreateGroupExternal?: boolean;
  hideMiniActionRow?: boolean;
  embeddedWorkerGroups?: boolean;
  showCreateGroupAboveFeatured?: boolean;
  preferCacheBackedFeaturedCards?: boolean;
  requireExplicitAutoFeatureSessionSlug?: boolean;
  miniaturized?: boolean;
  refreshSbtData?: unknown;
  onRequestSbtCacheRefresh?: unknown;
  latestBlockNumber?: unknown;
  sbtScanProgressBySlug?: Record<string, FeaturedProgressLike | unknown>;
  sbtRealtimeCoverageBySlug?: unknown;
  ensureLightSbtDiscovery?: unknown;
  ensureLightSbtUniverse?: unknown;
  refreshSessionUniverseRegistryCache?: unknown;
};

export type SBTsPageState = {
  showSBTsList: boolean;
  showCreateGroup: boolean;
};
