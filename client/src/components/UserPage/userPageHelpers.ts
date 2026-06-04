import {
  isPlainAnalysisObject,
  toAnalysisRecord,
  type UserPageUnknownRecord,
} from './userPageCoreHelpers';
import {
  normalizeUserAnalysisResult,
} from './userPageAnalysisStateHelpers';
import { normalizeUserPageSourceSlugForSignature } from './userPageGateHelpers';

export {
  isPlainAnalysisObject,
  toAnalysisRecord,
} from './userPageCoreHelpers';
export type { UserPageUnknownRecord } from './userPageCoreHelpers';
export {
  applyUserPageBookmarkNicknameSave,
  applyUserPageBookmarkToggle,
  buildDefaultUserPageBookmarksCache,
  buildUserPageBookmarkStatusStateUpdate,
  buildUserPageBookmarkToggleStatePatch,
  buildUserPageHeaderBookmarkClassName,
  isBookmarkUserEntry,
  isBookmarkUserObjectForAddress,
  isBookmarkValueForAddress,
  normalizeUserPageBookmarksCache,
  resolveUserPageBookmarkButtonDisplayState,
  resolveUserPageBookmarkNickname,
  resolveUserPageBookmarkStatus,
  resolveUserPageBookmarksLinkDisplayState,
} from './userPageBookmarkHelpers';
export type {
  UserPageBookmarkStatus,
  UserPageBookmarksCache,
  UserPageBookmarkUserEntry,
  UserPageBookmarkUserValue,
} from './userPageBookmarkHelpers';
export {
  buildUserPageAnalysisModalStatePatch,
  buildUserPageBooleanTogglePatch,
  buildUserPageCopiedStatePatch,
  buildUserPageCreatedQuestionWrapperClassName,
  buildUserPageFullProfileModalStatePatch,
  buildUserPageNicknameEditCancelStatePatch,
  buildUserPageNicknameEditOpenStatePatch,
  buildUserPageNicknameInputStatePatch,
  buildUserPageNicknameSaveStatePatch,
  buildUserPageRootClassName,
  buildUserPageSelectedTabStatePatch,
  buildUserPageSurveyExpansionTogglePatch,
  buildUserPageUsernameChangeStatePatch,
  buildUserPageUsernameEditCancelStatePatch,
  buildUserPageUsernameEditOpenStatePatch,
  buildUserPageUsernameErrorStatePatch,
  buildUserPageUsernameLoadedStatePatch,
  buildUserPageUsernameSaveStatePatch,
  buildUserPageViewAddressStatePatch,
  resolveUserPageAvatarDisplayState,
  resolveUserPageCopyIconDisplayState,
  resolveUserPageInlineEnteredIndicatorDisplayState,
  resolveUserPageUsernameErrorDisplayState,
} from './userPageDisplayStateHelpers';
export {
  cloneUserPageParsedResponsePayload,
  compareUserPageResponseRecency,
  extractUserPageFirstDefinedValue,
  extractUserPageResponseRecency,
  extractUserPageResponseRecencyWithHints,
  hasDisplayableUserPageResponsePayload,
  hasUserPageResponseSubmissionHints,
  isDisplayableUserPageResponseValue,
  normalizeUserPageQuestionResponseInfoOrder,
  normalizeUserPageResponseField,
  normalizeUserPageSingleQuestionResponsePayload,
  parseUserPageCachedResponsePayload,
} from './userPageResponseHelpers';
export type {
  UserPageNormalizedQuestionResponsePayload,
  UserPageNormalizedResponseField,
  UserPageResponseBucketMap,
  UserPageResponseByResponderMap,
  UserPageResponseRecency,
  UserPageResponseRecencyBucketMap,
  UserPageResponseRecencyWithHints,
} from './userPageResponseHelpers';
export {
  applyUserPageOwnershipSignal,
  getActiveUserPageChainNode,
  getPrioritizedUserPageChainNodes,
  getPrioritizedUserPageNetworkCacheNodes,
  getUserPageOwnershipCountMaps,
  hasMeaningfulUserPageOwnershipCounts,
  mergeUserPageQuestionCacheSource,
  mergeUserPageSbtCacheEntryIntoAggregate,
  mergeUserPageSurveyCacheSource,
  mergeUserPageUserCacheSbtIntoAggregate,
  readUserPageNetworkCache,
  readUserPageOwnershipCount,
  upsertUserPageResponseByRecency,
  writeUserPageResponseSourceSlug,
  writeUserPageSourceSlug,
} from './userPageCacheHelpers';
export type {
  UpsertUserPageResponseByRecencyArgs,
  MergeUserPageQuestionCacheSourceArgs,
  MergeUserPageSurveyCacheSourceArgs,
  UserPageCacheNetworkBucket,
  UserPageOwnershipCountMaps,
  UserPageOwnershipSignalAggregate,
  UserPagePrioritizedCacheNode,
  UserPagePrioritizedUserChainNode,
  UserPageSbtAggregateEntry,
  UserPageSbtAggregateMap,
  UserPageSourceSlugMap,
  UserPageSourceSlugWriteOptions,
  UserPageUserCachePayload,
  UserPageUserChainNode,
} from './userPageCacheHelpers';
export {
  buildUserPageDeepScanProgressRow,
  buildUserPageDeepScanProgressRowDisplayState,
  buildUserPageDeepScanProgressRowsSignature,
  buildUserPageDeepScanProgressStatePatch,
  buildUserPageDeepScanPrioritySlugs,
  buildUserPageDeepScanRefreshCarryPatch,
  buildUserPageDeepScanReportSamples,
  buildUserPageDeepScanReportSignature,
  buildUserPageDeepScanReportStatePatch,
  buildUserPageDeepScanReportStatus,
  buildUserPageDeepScanReportTelemetryPayloads,
  buildUserPageDeepScanRequestStatePatch,
  buildUserPageDeepScanTooltipDisplayState,
  buildUserPageDeepScanTooltipInputSignature,
  buildUserPageDeepScanTooltipOutputSignature,
  deriveUserPageDeepScanProgressRows,
  formatUserPageDeepScanBlockCount,
  formatUserPageDeepScanTooltipLinesFromRows,
  normalizeUserPageDeepScanProgressRows,
  normalizeUserPageDeepScanTooltipLines,
  resolveUserPageDeepScanProgressStateUpdate,
  resolveUserPageDeepScanSessionDisplayConfig,
  shouldApplyUserPageDeepScanResponse,
  sortUserPageDeepScanProgressRows,
} from './userPageDeepScanHelpers';
export type {
  UserPageDeepScanProgressRow,
} from './userPageDeepScanHelpers';
export {
  applyUserPageDecryptedPatchToResponseField,
  buildUserPageDecryptableResponseField,
  buildUserPageDecryptedResponsePatch,
  buildUserPageEncryptedVisibilityDisplayState,
  buildUserPageGateAccessCacheKey,
  buildUserPageGatePendingKey,
  buildUserPageResponseDecryptSurveyBindings,
  getUserPageGateResourceKeysToCheck,
  inferUserPageResponseEncryptionAudience,
  inferUserPageResponseFieldEncryptionAudience,
  isUserPageAdditionalFieldEncrypted,
  isUserPageAnswerFieldEncrypted,
  isUserPageEncryptedResponseField,
  isUserPageResponsePayloadEncrypted,
  normalizeUserPageGateResourceKey,
  normalizeUserPageGateSlug,
  normalizeUserPageSourceSlugForSignature,
} from './userPageGateHelpers';
export type {
  UserPageDecryptableResponseField,
  UserPageEncryptedVisibilityDisplayState,
  UserPageGateAccessStatusByResource,
  UserPageResponseDecryptSurveyBindings,
} from './userPageGateHelpers';
export {
  buildUserPageProfileEditVisibility,
  resolveUserPageAddressDisplayState,
  resolveUserPageBlockieSeed,
  resolveUserPageHeaderActionVisibility,
  resolveUserPageHeaderPassiveDisplayState,
} from './userPageProfileDisplayHelpers';
export type {
  BuildUserPageProfileEditVisibilityArgs,
  ResolveUserPageAddressDisplayStateArgs,
  ResolveUserPageBlockieSeedArgs,
  ResolveUserPageHeaderActionVisibilityArgs,
  ResolveUserPageHeaderPassiveDisplayStateArgs,
  UserPageAddressDisplayState,
  UserPageHeaderActionVisibility,
  UserPageHeaderPassiveDisplayState,
  UserPageProfileEditVisibility,
} from './userPageProfileDisplayHelpers';
export {
  buildUserPageCacheRefreshDisplayState,
  buildUserPageCacheRefreshStatePatch,
  buildUserPageRenderLoadingState,
  buildUserPageSectionLoadingEmptyState,
  buildUserPageUncertainEmptyText,
  buildUserPageUncertaintyLoadingFlags,
  buildUserPageUserStatsMergePatch,
  resolveUserPageAiActionAvailability,
  resolveUserPageAiActionPlan,
  resolveUserPageAnalyzeButtonDisplayState,
  resolveUserPageCompareButtonDisplayState,
  resolveUserPageSectionToggleDisplayState,
  shouldRetryUserPageQuestionData,
} from './userPageLoadingStateHelpers';
export type {
  BuildUserPageCacheRefreshDisplayStateArgs,
  BuildUserPageRenderLoadingStateArgs,
  BuildUserPageSectionLoadingEmptyStateArgs,
  BuildUserPageUncertainEmptyTextArgs,
  BuildUserPageUncertaintyLoadingFlagsArgs,
  BuildUserPageUserStatsMergePatchArgs,
  ResolveUserPageAiActionAvailabilityArgs,
  ResolveUserPageAiActionPlanArgs,
  ResolveUserPageAnalyzeButtonDisplayStateArgs,
  ResolveUserPageCompareButtonDisplayStateArgs,
  ResolveUserPageSectionToggleDisplayStateArgs,
  ShouldRetryUserPageQuestionDataArgs,
  UserPageAiActionAvailability,
  UserPageAiActionPlan,
  UserPageAnalyzeButtonDisplayState,
  UserPageCacheRefreshDisplayState,
  UserPageCompareButtonDisplayState,
  UserPageRenderLoadingState,
  UserPageSectionLoadingEmptyState,
  UserPageSectionToggleDisplayState,
  UserPageUncertainEmptyText,
  UserPageUncertaintyLoadingFlags,
} from './userPageLoadingStateHelpers';
export {
  resolveUserPageQuestionPromptText,
  resolveUserPageQuestionSectionDisplayState,
  resolveUserPageSbtDisplayState,
  resolveUserPageSurveyCountDisplayState,
  resolveUserPageSurveyCreatedCardState,
  resolveUserPageSurveyPreviewDisplayState,
  resolveUserPageSurveyResponseCardState,
  resolveUserPageSurveySectionDisplayState,
  shortenUserPageQuestionId,
} from './userPageSectionDisplayHelpers';
export type {
  ResolveUserPageQuestionSectionDisplayStateArgs,
  ResolveUserPageSbtDisplayStateArgs,
  ResolveUserPageSurveyCountDisplayStateArgs,
  ResolveUserPageSurveyCreatedCardStateArgs,
  ResolveUserPageSurveyPreviewDisplayStateArgs,
  ResolveUserPageSurveyResponseCardStateArgs,
  ResolveUserPageSurveySectionDisplayStateArgs,
  UserPageQuestionSectionDisplayState,
  UserPageSbtDisplayState,
  UserPageSurveyCountDisplayState,
  UserPageSurveyCreatedCardState,
  UserPageSurveyPreviewDisplayState,
  UserPageSurveyResponseCardState,
  UserPageSurveySectionDisplayState,
} from './userPageSectionDisplayHelpers';
export {
  buildUserPageAnalysisAiOptions,
  buildUserPageAnalysisElapsedStatePatch,
  buildUserPageAnalysisErrorStatePatch,
  buildUserPageAnalysisFingerprint,
  buildUserPageAnalysisResetStatePatch,
  buildUserPageAnalysisResultStatePatch,
  buildUserPageTooltipTargetIds,
  digestUserPageAnalysisCanonicalString,
  extractUserPageAnalysisAdditionalComment,
  extractUserPageAnalysisImportance,
  formatAnalysisCacheAge,
  getUserPageErrorMessage,
  normalizeUserAnalysisResult,
  resolveUserPageAnalysisCacheStatusState,
  resolveUserPageAnalysisModalDisplayState,
  resolveUserPageFullProfileModalDisplayState,
  sortUserAnalysisKeys,
} from './userPageAnalysisStateHelpers';
export type {
  BuildUserPageAnalysisAiOptionsArgs,
  BuildUserPageAnalysisElapsedStatePatchArgs,
  BuildUserPageAnalysisErrorStatePatchArgs,
  BuildUserPageAnalysisResultStatePatchArgs,
  BuildUserPageAnalysisResetStatePatchArgs,
  ResolveUserPageAnalysisCacheStatusStateArgs,
  ResolveUserPageAnalysisModalDisplayStateArgs,
  ResolveUserPageFullProfileModalDisplayStateArgs,
  UserPageAnalysisCacheStatusState,
  UserPageAnalysisFingerprintInput,
  UserPageAnalysisModalDisplayState,
  UserPageFullProfileModalDisplayState,
  UserPageTooltipTargetIds,
} from './userPageAnalysisStateHelpers';
export {
  buildUserPageAnalysisCreatedQuestions,
  buildUserPageAnalysisCreatedSurveys,
  buildUserPageAnalysisQuestions,
  buildUserPageAnalysisSbts,
  buildUserPageAnalysisSurveys,
  buildUserPageSbtSection,
  isUserPageSbtAggregateEntry,
  readUserPageDirectNetworkCacheBucket,
} from './userPageAnalysisContentHelpers';
export type {
  BuildUserPageAnalysisCreatedSurveysArgs,
  BuildUserPageAnalysisQuestionsArgs,
  BuildUserPageAnalysisSbtsArgs,
  BuildUserPageAnalysisSurveysArgs,
  BuildUserPageSbtSectionArgs,
  UserPageSbtSectionResult,
} from './userPageAnalysisContentHelpers';
export {
  buildUserPageDeriveTelemetrySnapshot,
  buildUserPageNoSbtVisibleTelemetryState,
  buildUserPageRefreshTelemetrySignature,
  buildUserPageRefreshTelemetrySnapshot,
  readBoolishUserPageTelemetryFlag,
} from './userPageTelemetryHelpers';
export type {
  BuildUserPageDeriveTelemetrySnapshotArgs,
  BuildUserPageNoSbtVisibleTelemetryStateArgs,
  BuildUserPageRefreshTelemetrySnapshotArgs,
  UserPageNoSbtVisibleTelemetryState,
} from './userPageTelemetryHelpers';
export {
  buildUserPageAiSessionScopeContext,
  buildUserPageAiSessionSlugCandidates,
  buildUserPageAnalysisCandidateLogRows,
  buildUserPageAnalysisExcludeSlugSet,
  deriveAnalysisAiContextFromSessionConfig,
  resolveUserPageAnalysisAiContext,
  resolveUserPageAnalysisSessionConfigForSlug,
  resolveUserPageAnalysisSessionFallback,
  resolveUserPageQuestionSourceSessionSlug,
} from './userPageAnalysisSessionHelpers';
export type {
  BuildUserPageAiSessionScopeContextArgs,
  BuildUserPageAiSessionSlugCandidatesArgs,
  BuildUserPageAnalysisExcludeSlugSetArgs,
  ResolveUserPageAnalysisAiContextArgs,
  ResolveUserPageAnalysisSessionConfigForSlugArgs,
  ResolveUserPageAnalysisSessionFallbackArgs,
  ResolveUserPageQuestionSourceSessionSlugArgs,
  UserPageAiSessionScopeContext,
  UserPageAnalysisAiContextLogger,
  UserPageAnalysisCandidateLogRow,
  UserPageAnalysisSessionFallback,
  UserPageEffectiveAiConfigGetter,
  UserPageEffectiveAiConfigRequest,
  UserPageEffectiveAiConfigResult,
} from './userPageAnalysisSessionHelpers';
export {
  buildUserPageAiAvailabilityStatePatch,
  resolveUserPageAiAvailabilityRefresh,
} from './userPageAiAvailabilityHelpers';
export type {
  BuildUserPageAiAvailabilityStatePatchArgs,
  ResolveUserPageAiAvailabilityRefreshArgs,
  UserPageAiAvailabilityRefreshDecision,
  UserPageAiAvailabilityStatePatch,
} from './userPageAiAvailabilityHelpers';
type UserPageNamespaceSlugReader = (namespace: unknown) => unknown;
type UserPageNamespacePresenceReader = (namespace: unknown) => boolean;
type UserPageDeepScanCacheReader = (
  namespace: string,
  slug: string,
  options?: { clone?: boolean }
) => unknown;
export type UserPageNamespaceSourceEntry = {
  slug: string;
  data: UserPageUnknownRecord;
};
export type UserPageCacheSourcePresence = {
  hasSurveysCache: boolean;
  hasQuestionsCache: boolean;
  hasSbtCache: boolean;
  hasUserCache: boolean;
};
export type UserPageCacheSourceSnapshot = UserPageCacheSourcePresence & {
  hasSurveySources: boolean;
  hasQuestionSources: boolean;
  hasSbtSources: boolean;
  surveySourcesSignature: string;
  questionSourcesSignature: string;
  sbtSourcesSignature: string;
  membershipSignature: string;
};
type ReadUserPageAnalysisCacheEntryArgs = {
  addressLower?: unknown;
  cacheObj?: unknown;
  cacheVersion?: unknown;
  fingerprint?: unknown;
  networkId?: unknown;
  now?: unknown;
};
type BuildUserPageAnalysisCacheEntryArgs = {
  addressLower?: unknown;
  aiContext?: unknown;
  cachedAt?: unknown;
  cacheVersion?: unknown;
  fingerprint?: unknown;
  networkId?: unknown;
  result?: unknown;
  sessionSlug?: unknown;
  ttlMs?: unknown;
};
type BuildUserPageAnalysisCacheWritePayloadArgs = {
  addressLower?: unknown;
  cachedAt?: unknown;
  currentCache?: unknown;
  entry?: UserPageAnalysisCacheEntry | null;
  fingerprint?: unknown;
  networkId?: unknown;
};
type ResolveUserPageResponseNonceRefreshArgs = {
  account?: unknown;
  connectedAddress?: unknown;
  nextNonce?: unknown;
  prevNonce?: unknown;
  viewAddress?: unknown;
};
type ResolveUserPageManagedCacheUpdateArgs = {
  bookmarksSlug?: unknown;
  namespace?: unknown;
  slug?: unknown;
};
type ResolveUserPageAddressContextChangeArgs = {
  nextNetwork?: unknown;
  nextViewAddress?: unknown;
  prevNetwork?: unknown;
  prevViewAddress?: unknown;
};
type ResolveUserPageCacheUpdateRefreshArgs = {
  nextAccount?: unknown;
  nextSbtCacheRevision?: unknown;
  prevAccount?: unknown;
  prevSbtCacheRevision?: unknown;
};
type BuildUserPageAddressContextResetStatePatchArgs = {
  viewAddress?: unknown;
};
type UserPageResponseNonceRefreshOptions = {
  bypassSignature?: boolean;
  force?: boolean;
  markLoading?: boolean;
};
type UserPageCacheLoadingHoldFlags = {
  holdQuestionLoading: boolean;
  holdSbtLoading: boolean;
  holdSurveyLoading: boolean;
};
type MergeUserPageQueuedCacheRefreshFlagsArgs = {
  bypassSignature?: unknown;
  currentBypassSignature?: unknown;
  currentForce?: unknown;
  currentMarkLoading?: unknown;
  force?: unknown;
  markLoading?: unknown;
};
type BuildUserPageCacheRefreshOptionsArgs = {
  bypassSignature?: unknown;
  force?: unknown;
  markLoading?: unknown;
};
type BuildUserPageCacheRefreshInputSignatureArgs = {
  account?: unknown;
  gateRecheckEpoch?: unknown;
  hasQuestionSources?: unknown;
  hasSbtSources?: unknown;
  hasSurveySources?: unknown;
  hasUncertainGateAccess?: unknown;
  hasUncertainUserData?: unknown;
  isQuestionCacheReady?: unknown;
  isResponsesCacheReady?: unknown;
  isSBTCacheReady?: unknown;
  isSurveyCacheReady?: unknown;
  networkID?: unknown;
  questionResponsesNonce?: unknown;
  responseGateAccessGeneration?: unknown;
  responseGateAccessStatusVersion?: unknown;
  sbtCacheRevision?: unknown;
  sourceMembershipSignature?: unknown;
  viewAddressLower?: unknown;
};
type BuildUserPageCacheLoadingHoldFlagsArgs = {
  force?: unknown;
  hasQuestionSources?: unknown;
  hasSbtSources?: unknown;
  hasSurveySources?: unknown;
  questionsReady?: unknown;
  responsesReady?: unknown;
  sbtReady?: unknown;
  surveysReady?: unknown;
};
type UserPageQueuedCacheRefreshFlags = {
  bypassSignature: boolean;
  force: boolean;
  markLoading: boolean;
};
type UserPageResponseNonceRefreshDecision = {
  isOwnProfile: boolean;
  options: UserPageResponseNonceRefreshOptions;
} | null;
type UserPageManagedCacheUpdateDecision = {
  action: 'bookmarks' | 'refresh' | 'ignore';
};
type UserPageAddressContextChangeDecision = {
  nextViewAddress: unknown;
  shouldReset: boolean;
};
type UserPageCacheUpdateRefreshDecision = {
  accountChanged: boolean;
  sbtRevisionChanged: boolean;
  shouldQueueCacheRefresh: boolean;
  shouldResetGateAccess: boolean;
};
type BuildUserPageNamespaceSourceMembershipSignatureArgs = {
  listNamespaceSlugs?: UserPageNamespaceSlugReader;
  namespace?: unknown;
};
type BuildUserPageCacheSourceSnapshotArgs = {
  hasQuestionsCache?: unknown;
  hasSbtCache?: unknown;
  hasSurveysCache?: unknown;
  hasUserCache?: unknown;
  questionsNamespaceSignature?: unknown;
  sbtNamespaceSignature?: unknown;
  surveysNamespaceSignature?: unknown;
  userNamespaceSignature?: unknown;
};
type BuildUserPageUnifiedCacheAggregateMemoKeyArgs = {
  networkID?: unknown;
  questionResponsesNonce?: unknown;
  sbtCacheRevision?: unknown;
  sourceMembershipSignature?: unknown;
  viewAddressLower?: unknown;
};
type BuildUserPageResponseSectionDeriveSignatureArgs = {
  account?: unknown;
  networkID?: unknown;
  questionResponsesNonce?: unknown;
  responseGateAccessGeneration?: unknown;
  responseGateAccessStatusVersion?: unknown;
  sourceSignature?: unknown;
  viewAddressLower?: unknown;
};
type BuildUserPageSbtSectionDeriveSignatureArgs = {
  networkID?: unknown;
  sbtCacheRevision?: unknown;
  sourceSignature?: unknown;
  viewAddressLower?: unknown;
};
export type UserPageAnalysisCacheEntry = UserPageUnknownRecord & {
  version?: unknown;
  fingerprint?: unknown;
  cachedAt?: unknown;
  expiresAt?: unknown;
  address?: unknown;
  networkId?: unknown;
  result?: unknown;
};

export const toAnalysisCacheBucket = (value: unknown): UserPageUnknownRecord => (
  value != null && typeof value === 'object' ? value as UserPageUnknownRecord : {}
);

export const isUserPageGateAccessContext = (value: unknown): boolean => {
  const record = toAnalysisRecord(value);
  return record.pendingKeys instanceof Set && record.uncertainResources instanceof Set;
};

export const readUserPageAnalysisCacheEntry = ({
  addressLower = '',
  cacheObj = {},
  cacheVersion = 1,
  fingerprint = '',
  networkId = '',
  now = Date.now(),
}: ReadUserPageAnalysisCacheEntryArgs = {}): UserPageAnalysisCacheEntry | null => {
  const cacheBucket = toAnalysisCacheBucket(cacheObj);
  const networkBucket = toAnalysisCacheBucket(cacheBucket[String(networkId || '')]);
  const resolvedAddressLower = String(addressLower || '').toLowerCase();
  const addressBucket = toAnalysisCacheBucket(networkBucket[resolvedAddressLower]);
  const resolvedFingerprint = String(fingerprint || '');
  const entry = addressBucket[resolvedFingerprint];
  if (!entry || typeof entry !== 'object') return null;
  const entryRecord = entry as UserPageAnalysisCacheEntry;
  if (entryRecord.version !== cacheVersion) return null;
  if (entryRecord.fingerprint !== resolvedFingerprint) return null;
  if (String(entryRecord.networkId || '') !== String(networkId || '')) return null;
  if (String(entryRecord.address || '').toLowerCase() !== resolvedAddressLower) return null;
  if (Number(now || 0) >= Number(entryRecord.expiresAt || 0)) return null;
  return entryRecord;
};

export const buildUserPageAnalysisCacheEntry = ({
  addressLower = '',
  aiContext = {},
  cachedAt = Date.now(),
  cacheVersion = 1,
  fingerprint = '',
  networkId = '',
  result = {},
  sessionSlug = '',
  ttlMs = 24 * 60 * 60 * 1000,
}: BuildUserPageAnalysisCacheEntryArgs = {}): UserPageAnalysisCacheEntry => {
  const aiContextRecord = toAnalysisRecord(aiContext);
  const resolvedCachedAt = Number(cachedAt || 0) || 0;
  return {
    version: cacheVersion,
    fingerprint,
    cachedAt: resolvedCachedAt,
    expiresAt: resolvedCachedAt + (Number(ttlMs || 0) || 0),
    address: addressLower,
    networkId,
    aiContext: {
      sessionSlug,
      provider: aiContextRecord.provider,
      model: aiContextRecord.model,
    },
    result: normalizeUserAnalysisResult(result),
  };
};

export const buildUserPageAnalysisCacheWritePayload = ({
  addressLower = '',
  cachedAt = Date.now(),
  currentCache = {},
  entry = null,
  fingerprint = '',
  networkId = '',
}: BuildUserPageAnalysisCacheWritePayloadArgs = {}): UserPageUnknownRecord => {
  const currentBucket = toAnalysisCacheBucket(currentCache);
  const next: UserPageUnknownRecord = { ...currentBucket };
  const networkKey = String(networkId || '');
  const addressKey = String(addressLower || '');
  const networkBucketSource = next[networkKey];
  const networkBucket: UserPageUnknownRecord = (
    networkBucketSource &&
    typeof networkBucketSource === 'object'
  )
    ? { ...(networkBucketSource as UserPageUnknownRecord) }
    : {};
  const addressBucketRaw = networkBucket[addressKey];
  const addressBucketSource: UserPageUnknownRecord = (
    addressBucketRaw &&
    typeof addressBucketRaw === 'object'
  )
    ? addressBucketRaw as UserPageUnknownRecord
    : {};
  const addressBucket: Record<string, UserPageAnalysisCacheEntry> = {};
  Object.entries(addressBucketSource).forEach(([key, sibling]) => {
    const siblingRecord = sibling as UserPageAnalysisCacheEntry;
    if (sibling && Number(siblingRecord.expiresAt || 0) > Number(cachedAt || 0)) {
      addressBucket[key] = siblingRecord;
    }
  });
  if (entry) {
    addressBucket[String(fingerprint || '')] = entry;
  }
  networkBucket[addressKey] = addressBucket;
  next[networkKey] = networkBucket;
  return next;
};

export const buildUserPageNamespaceSourceMembershipSignature = ({
  namespace = '',
  listNamespaceSlugs = () => [],
}: BuildUserPageNamespaceSourceMembershipSignatureArgs = {}): string => {
  const rawSlugs = listNamespaceSlugs(namespace);
  const slugs = (Array.isArray(rawSlugs) ? rawSlugs : [])
    .map((slug: unknown) => normalizeUserPageSourceSlugForSignature(slug))
    .sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0));
  return slugs.join(',');
};

export const readUserPageNamespaceSourceEntries = ({
  namespace = '',
  listNamespaceSlugs = () => [],
  peekCache = () => null,
}: {
  namespace?: unknown;
  listNamespaceSlugs?: UserPageNamespaceSlugReader;
  peekCache?: UserPageDeepScanCacheReader;
} = {}): UserPageNamespaceSourceEntry[] => {
  const namespaceKey = String(namespace || '');
  const rawSlugs = listNamespaceSlugs(namespaceKey);
  return (Array.isArray(rawSlugs) ? rawSlugs : [])
    .map((slug: unknown) => String(slug || ''))
    .map((slug) => ({
      slug,
      data: peekCache(namespaceKey, slug, { clone: false }),
    }))
    .filter((entry): entry is UserPageNamespaceSourceEntry => isPlainAnalysisObject(entry.data));
};

export const buildUserPageCacheSourcePresence = ({
  hasQuestionsCache = false,
  hasSbtCache = false,
  hasSurveysCache = false,
  hasUserCache = false,
}: Partial<UserPageCacheSourcePresence> = {}): UserPageCacheSourcePresence => ({
  hasSurveysCache: !!hasSurveysCache,
  hasQuestionsCache: !!hasQuestionsCache,
  hasSbtCache: !!hasSbtCache,
  hasUserCache: !!hasUserCache,
});

export const readUserPageCacheSourcePresence = ({
  hasNamespaceEntries = () => false,
}: {
  hasNamespaceEntries?: UserPageNamespacePresenceReader;
} = {}): UserPageCacheSourcePresence => (
  buildUserPageCacheSourcePresence({
    hasSurveysCache: hasNamespaceEntries('surveysCache'),
    hasQuestionsCache: hasNamespaceEntries('questionsCache'),
    hasSbtCache: hasNamespaceEntries('sbtCache'),
    hasUserCache: hasNamespaceEntries('userCache'),
  })
);

export const readUserPageCacheSourceSnapshot = ({
  hasNamespaceEntries = () => false,
  listNamespaceSlugs = () => [],
}: {
  hasNamespaceEntries?: UserPageNamespacePresenceReader;
  listNamespaceSlugs?: UserPageNamespaceSlugReader;
} = {}): UserPageCacheSourceSnapshot => {
  const presence = readUserPageCacheSourcePresence({ hasNamespaceEntries });
  const surveysNamespaceSignature = buildUserPageNamespaceSourceMembershipSignature({
    listNamespaceSlugs,
    namespace: 'surveysCache',
  });
  const questionsNamespaceSignature = buildUserPageNamespaceSourceMembershipSignature({
    listNamespaceSlugs,
    namespace: 'questionsCache',
  });
  const sbtNamespaceSignature = buildUserPageNamespaceSourceMembershipSignature({
    listNamespaceSlugs,
    namespace: 'sbtCache',
  });
  const userNamespaceSignature = buildUserPageNamespaceSourceMembershipSignature({
    listNamespaceSlugs,
    namespace: 'userCache',
  });
  return buildUserPageCacheSourceSnapshot({
    ...presence,
    questionsNamespaceSignature,
    sbtNamespaceSignature,
    surveysNamespaceSignature,
    userNamespaceSignature,
  }) as UserPageCacheSourceSnapshot;
};

export const buildUserPageCacheSourceSnapshot = ({
  hasQuestionsCache = false,
  hasSbtCache = false,
  hasSurveysCache = false,
  hasUserCache = false,
  questionsNamespaceSignature = '',
  sbtNamespaceSignature = '',
  surveysNamespaceSignature = '',
  userNamespaceSignature = '',
}: BuildUserPageCacheSourceSnapshotArgs = {}): UserPageUnknownRecord => {
  const hasSurveySources = !!hasSurveysCache || !!hasQuestionsCache || !!hasUserCache;
  const hasQuestionSources = !!hasQuestionsCache || !!hasUserCache;
  const hasSbtSources = !!hasSbtCache || !!hasUserCache;
  return {
    hasSurveysCache: !!hasSurveysCache,
    hasQuestionsCache: !!hasQuestionsCache,
    hasSbtCache: !!hasSbtCache,
    hasUserCache: !!hasUserCache,
    hasSurveySources,
    hasQuestionSources,
    hasSbtSources,
    surveySourcesSignature: [
      surveysNamespaceSignature,
      questionsNamespaceSignature,
      userNamespaceSignature,
    ].join('|'),
    questionSourcesSignature: [
      questionsNamespaceSignature,
      userNamespaceSignature,
    ].join('|'),
    sbtSourcesSignature: [
      sbtNamespaceSignature,
      userNamespaceSignature,
    ].join('|'),
    membershipSignature: [
      surveysNamespaceSignature,
      questionsNamespaceSignature,
      sbtNamespaceSignature,
      userNamespaceSignature,
    ].join('||'),
  };
};

export const buildUserPageUnifiedCacheAggregateMemoKey = ({
  viewAddressLower = '',
  networkID = '',
  questionResponsesNonce = 0,
  sbtCacheRevision = 0,
  sourceMembershipSignature = '',
}: BuildUserPageUnifiedCacheAggregateMemoKeyArgs = {}): string => (
  [
    String(viewAddressLower || ''),
    String(networkID || ''),
    String(questionResponsesNonce || 0),
    String(sbtCacheRevision || 0),
    String(sourceMembershipSignature || ''),
  ].join('|')
);

export const buildUserPageResponseSectionDeriveSignature = ({
  viewAddressLower = '',
  networkID = '',
  sourceSignature = '',
  questionResponsesNonce = 0,
  account = '',
  responseGateAccessGeneration = 0,
  responseGateAccessStatusVersion = 0,
}: BuildUserPageResponseSectionDeriveSignatureArgs = {}): string => (
  [
    String(viewAddressLower || ''),
    String(networkID || ''),
    String(sourceSignature || ''),
    String(questionResponsesNonce || 0),
    String(account || '').trim().toLowerCase(),
    String(responseGateAccessGeneration || 0),
    String(responseGateAccessStatusVersion || 0),
  ].join('|')
);

export const buildUserPageSbtSectionDeriveSignature = ({
  viewAddressLower = '',
  networkID = '',
  sourceSignature = '',
  sbtCacheRevision = 0,
}: BuildUserPageSbtSectionDeriveSignatureArgs = {}): string => (
  [
    String(viewAddressLower || ''),
    String(networkID || ''),
    String(sourceSignature || ''),
    String(sbtCacheRevision || 0),
  ].join('|')
);

export const resolveUserPageResponseNonceRefresh = ({
  account = '',
  connectedAddress = '',
  nextNonce = null,
  prevNonce = null,
  viewAddress = '',
}: ResolveUserPageResponseNonceRefreshArgs = {}): UserPageResponseNonceRefreshDecision => {
  if (prevNonce === nextNonce) return null;
  const viewAddressLower = String(viewAddress || '').toLowerCase();
  const connectedAddressLower = String(connectedAddress || account || '').toLowerCase();
  const isOwnProfile = !!(
    viewAddressLower &&
    connectedAddressLower &&
    viewAddressLower === connectedAddressLower
  );
  return {
    isOwnProfile,
    options: isOwnProfile
      ? { force: true, markLoading: false, bypassSignature: true }
      : { markLoading: false },
  };
};

export const resolveUserPageManagedCacheUpdate = ({
  bookmarksSlug = '',
  namespace = '',
  slug = '',
}: ResolveUserPageManagedCacheUpdateArgs = {}): UserPageManagedCacheUpdateDecision => {
  const resolvedNamespace = String(namespace || '').trim();
  if (!resolvedNamespace) return { action: 'ignore' };
  if (resolvedNamespace === 'bookmarksCache') {
    return String(slug || '') === String(bookmarksSlug || '')
      ? { action: 'bookmarks' }
      : { action: 'ignore' };
  }
  return ['surveysCache', 'questionsCache', 'sbtCache', 'userCache'].includes(resolvedNamespace)
    ? { action: 'refresh' }
    : { action: 'ignore' };
};

const readOptionalUserPageNetworkId = (network: unknown): unknown => (
  network != null && (typeof network === 'object' || typeof network === 'function')
    ? (network as { id?: unknown }).id
    : undefined
);

export const resolveUserPageAddressContextChange = ({
  nextNetwork = null,
  nextViewAddress = undefined,
  prevNetwork = null,
  prevViewAddress = undefined,
}: ResolveUserPageAddressContextChangeArgs = {}): UserPageAddressContextChangeDecision => ({
  nextViewAddress,
  shouldReset: (
    prevViewAddress !== nextViewAddress ||
    readOptionalUserPageNetworkId(prevNetwork) !== readOptionalUserPageNetworkId(nextNetwork)
  ),
});

export const resolveUserPageCacheUpdateRefresh = ({
  nextAccount = undefined,
  nextSbtCacheRevision = undefined,
  prevAccount = undefined,
  prevSbtCacheRevision = undefined,
}: ResolveUserPageCacheUpdateRefreshArgs = {}): UserPageCacheUpdateRefreshDecision => {
  const sbtRevisionChanged = prevSbtCacheRevision !== nextSbtCacheRevision;
  const accountChanged = prevAccount !== nextAccount;
  const shouldRefresh = sbtRevisionChanged || accountChanged;
  return {
    accountChanged,
    sbtRevisionChanged,
    shouldQueueCacheRefresh: shouldRefresh,
    shouldResetGateAccess: shouldRefresh,
  };
};

export const mergeUserPageQueuedCacheRefreshFlags = ({
  bypassSignature = false,
  currentBypassSignature = false,
  currentForce = false,
  currentMarkLoading = false,
  force = false,
  markLoading = false,
}: MergeUserPageQueuedCacheRefreshFlagsArgs = {}): UserPageQueuedCacheRefreshFlags => ({
  bypassSignature: !!currentBypassSignature || !!bypassSignature,
  force: !!currentForce || !!force,
  markLoading: !!currentMarkLoading || !!markLoading,
});

export const buildUserPageCacheRefreshOptions = ({
  bypassSignature = false,
  force = false,
  markLoading = false,
}: BuildUserPageCacheRefreshOptionsArgs = {}): UserPageResponseNonceRefreshOptions => {
  const refreshOpts: UserPageResponseNonceRefreshOptions = {
    force: !!force,
    markLoading: !!markLoading,
  };
  if (bypassSignature) refreshOpts.bypassSignature = true;
  return refreshOpts;
};

export const buildUserPageCacheRefreshInputSignature = ({
  account = '',
  gateRecheckEpoch = 0,
  hasQuestionSources = false,
  hasSbtSources = false,
  hasSurveySources = false,
  hasUncertainGateAccess = false,
  hasUncertainUserData = false,
  isQuestionCacheReady = false,
  isResponsesCacheReady = false,
  isSBTCacheReady = false,
  isSurveyCacheReady = false,
  networkID = '',
  questionResponsesNonce = 0,
  responseGateAccessGeneration = 0,
  responseGateAccessStatusVersion = 0,
  sbtCacheRevision = 0,
  sourceMembershipSignature = '',
  viewAddressLower = '',
}: BuildUserPageCacheRefreshInputSignatureArgs = {}): string => {
  const readinessSignature = [
    isSurveyCacheReady ? '1' : '0',
    isQuestionCacheReady ? '1' : '0',
    isResponsesCacheReady ? '1' : '0',
    isSBTCacheReady ? '1' : '0',
  ].join('');
  const sourceSignature = [
    hasSurveySources ? '1' : '0',
    hasQuestionSources ? '1' : '0',
    hasSbtSources ? '1' : '0',
  ].join('');
  return [
    String(viewAddressLower || ''),
    String(networkID || ''),
    String(account || '').trim().toLowerCase(),
    readinessSignature,
    sourceSignature,
    String(sourceMembershipSignature || ''),
    String(questionResponsesNonce || 0),
    String(sbtCacheRevision || 0),
    hasUncertainUserData ? '1' : '0',
    hasUncertainGateAccess ? '1' : '0',
    String(responseGateAccessGeneration || 0),
    String(responseGateAccessStatusVersion || 0),
    String(gateRecheckEpoch || 0),
  ].join('|');
};

export const buildUserPageCacheLoadingHoldFlags = ({
  force = false,
  hasQuestionSources = false,
  hasSbtSources = false,
  hasSurveySources = false,
  questionsReady = false,
  responsesReady = false,
  sbtReady = false,
  surveysReady = false,
}: BuildUserPageCacheLoadingHoldFlagsArgs = {}): UserPageCacheLoadingHoldFlags => ({
  holdSurveyLoading: !force && ((!surveysReady || !responsesReady) && !hasSurveySources),
  holdQuestionLoading: !force && ((!questionsReady || !responsesReady) && !hasQuestionSources),
  holdSbtLoading: !force && (!sbtReady && !hasSbtSources),
});

export const buildUserPageMissingAddressCacheStatePatch = (): UserPageUnknownRecord => ({
  loadingSurveys: false,
  loadingQuestions: false,
  loadingSBTs: false,
  hasUncertainGateAccess: false,
  deepScanTooltipLines: null,
  deepScanProgressRows: null,
});

export const buildUserPageMissingAddressCacheStateUpdate = (
  prevState: unknown = {}
): UserPageUnknownRecord | null => {
  const prev = toAnalysisRecord(prevState);
  if (
    prev.loadingSurveys === false &&
    prev.loadingQuestions === false &&
    prev.loadingSBTs === false &&
    prev.hasUncertainGateAccess === false &&
    prev.deepScanTooltipLines == null &&
    prev.deepScanProgressRows == null
  ) {
    return null;
  }
  return buildUserPageMissingAddressCacheStatePatch();
};

export const buildUserPageAddressContextResetStatePatch = ({
  viewAddress = '',
}: BuildUserPageAddressContextResetStatePatchArgs = {}): UserPageUnknownRecord => ({
  surveyResponseInfo: [],
  surveyCreationInfo: [],
  questionCreationInfo: [],
  questionResponseInfo: [],
  detailedSurveyResponses: {},
  detailedQuestionResponses: {},
  sbtList: [],
  userStats: {
    surveysResponded: 0,
    surveysCreated: 0,
    questionsResponded: 0,
    questionsCreated: 0,
    mostUniqueIdea: ' ... ',
    badgesReceived: 0,
    worryScore: 'x%',
    enthusiasmScore: 'y%',
    topTags: ['#cybersecurity', '#ubi', '#mechinterp'],
  },
  loadingSurveys: true,
  loadingQuestions: true,
  loadingSBTs: true,
  username: '',
  usernameError: '',
  isEditingUsername: false,
  bookmarked: false,
  expandedSurveyResponses: {},
  expandedSurveysCreated: {},
  viewAddress,
  nicknameInput: '',
  isEditingNickname: false,
  isDeepScanning: false,
  hasUncertainUserData: false,
  hasUncertainSbtData: false,
  hasUncertainGateAccess: false,
  deepScanTooltipLines: null,
  deepScanProgressRows: null,
});
