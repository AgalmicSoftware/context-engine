import { isPlainAnalysisObject, toAnalysisRecord, type UserPageUnknownRecord } from './userPageCoreHelpers';
import { normalizeUserAnalysisResult } from './userPageAnalysisStateHelpers';
import { normalizeUserPageSourceSlugForSignature } from './userPageGateHelpers';

export { isPlainAnalysisObject, toAnalysisRecord } from './userPageCoreHelpers';
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
export type { UserPageDeepScanProgressRow } from './userPageDeepScanHelpers';
export {
  applyUserPageDecryptedPatchToResponseField,
  buildUserPageDecryptableResponseField,
  buildUserPageDecryptedResponseStatePatch,
  buildUserPageDecryptedResponsePatch,
  buildUserPageEncryptedVisibilityDisplayState,
  buildUserPageEncryptedVisibilityStatusRequestPlan,
  buildUserPageGateAccessCheckPlan,
  buildUserPageGateAccessCacheKey,
  buildUserPageGateAccessRequestDescriptor,
  buildUserPageGateAccessSettlementPlan,
  buildUserPageGatePendingKey,
  buildUserPageGateRetryTimerPlan,
  buildUserPageQuestionResponseSourceDescriptor,
  buildUserPageResponseDecryptRequestPlan,
  buildUserPageResponseDecryptSurveyBindings,
  buildUserPageSurveyResponseSourceDescriptor,
  dispatchUserPageGateAccessCheckThroughPort,
  getUserPageGateResourceKeysToCheck,
  inferUserPageResponseEncryptionAudience,
  inferUserPageResponseFieldEncryptionAudience,
  isUserPageAdditionalFieldEncrypted,
  isUserPageAnswerFieldEncrypted,
  isUserPageEncryptedResponseField,
  isUserPageQuestionPayloadEncrypted,
  isUserPageResponsePayloadEncrypted,
  normalizeUserPageGateResourceKey,
  normalizeUserPageGateSlug,
  normalizeUserPageSourceSlugForSignature,
} from './userPageGateHelpers';
export type {
  UserPageDecryptableResponseField,
  UserPageDecryptedResponseStatePatchResult,
  UserPageEncryptedVisibilityDisplayState,
  UserPageEncryptedVisibilityStatusRequestPlan,
  UserPageGateAccessCheckPort,
  UserPageGateAccessCheckPortRequest,
  UserPageGateAccessDispatchResult,
  UserPageGateAccessRequestDescriptor,
  UserPageGateAccessSettlementPlan,
  UserPageGateAccessStatusByResource,
  UserPageGateRetryTimerPlan,
  UserPageGatedResponseSourceDescriptor,
  UserPageResponseDecryptRequestPlan,
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
type UserPageDeepScanCacheReader = (namespace: string, slug: string, options?: { clone?: boolean }) => unknown;
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
type BuildUserPageAnalysisCacheReadDescriptorArgs = {
  addressLower?: unknown;
  fingerprint?: unknown;
  forceRefresh?: unknown;
  networkId?: unknown;
  sessionSlug?: unknown;
};
type ReadUserPageAnalysisCacheThroughPortArgs = {
  cacheVersion?: unknown;
  descriptor?: UserPageAnalysisCacheReadDescriptor | null;
  now?: unknown;
  peekCache?: UserPageAnalysisCacheReadPort | null;
};
type WriteUserPageAnalysisCacheThroughPortArgs = BuildUserPageAnalysisCacheEntryArgs & {
  peekCache?: UserPageAnalysisCacheReadPort | null;
  writeCache?: UserPageAnalysisCacheWritePort | null;
};
type ReadUserPageAnalysisCreatedSurveyCachesThroughPortArgs = {
  networkID?: unknown;
  peekCache?: UserPageAnalysisCacheReadPort | null;
  sessionSlug?: unknown;
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
type BuildUserPageCacheRefreshRequestDescriptorArgs = BuildUserPageCacheRefreshInputSignatureArgs & {
  bypassSignature?: unknown;
  currentInputSignature?: unknown;
  force?: unknown;
  markLoading?: unknown;
  sourceSnapshot?: unknown;
  viewAddress?: unknown;
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
export type UserPageCacheRefreshRequestDescriptor = {
  action: 'missing-address' | 'skip-same-signature' | 'refresh';
  force: boolean;
  markLoading: boolean;
  bypassSignature: boolean;
  networkID: string;
  refreshInputSignature: string;
  sourcePresence: UserPageCacheSourcePresence;
  viewAddressLower: string;
} & UserPageCacheLoadingHoldFlags & {
    hasQuestionSources: boolean;
    hasSbtSources: boolean;
    hasSurveySources: boolean;
  };
export type UserPageUnifiedCacheAggregateMemoPlan = {
  aggregateMemoKey: string;
  aggregate: unknown;
  canReuseAggregate: boolean;
};
export type UserPageSectionDeriveMemoPlan = {
  canReuseMemo: boolean;
  gateSnapshot: unknown;
  result: unknown;
  signature: string;
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
type BuildUserPageUnifiedCacheAggregateMemoPlanArgs = BuildUserPageUnifiedCacheAggregateMemoKeyArgs & {
  currentAggregateMemo?: unknown;
  currentAggregateMemoKey?: unknown;
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
type BuildUserPageResponseSectionDeriveMemoPlanArgs = BuildUserPageResponseSectionDeriveSignatureArgs & {
  currentMemo?: unknown;
  force?: unknown;
};
type BuildUserPageSbtSectionDeriveSignatureArgs = {
  networkID?: unknown;
  sbtCacheRevision?: unknown;
  sourceSignature?: unknown;
  viewAddressLower?: unknown;
};
type BuildUserPageSbtSectionDeriveMemoPlanArgs = BuildUserPageSbtSectionDeriveSignatureArgs & {
  currentMemo?: unknown;
  force?: unknown;
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
export type UserPageAnalysisCacheReadDescriptor = {
  action: 'read' | 'skip-force-refresh';
  addressLower: string;
  fingerprint: string;
  networkId: string;
  sessionSlug: string;
};
export type UserPageAnalysisCacheReadPort = (
  namespace: string,
  slug?: string,
  options?: { clone?: boolean },
) => unknown;
export type UserPageAnalysisCacheWritePort = (namespace: string, slug?: string, value?: unknown) => Promise<unknown>;
export type UserPageAnalysisCacheReadPortResult = {
  descriptor: UserPageAnalysisCacheReadDescriptor;
  entry: UserPageAnalysisCacheEntry | null;
  error?: unknown;
  status: 'hit' | 'miss' | 'skipped' | 'error';
};
export type UserPageAnalysisCacheWritePortResult = {
  entry: UserPageAnalysisCacheEntry | null;
  error?: unknown;
  payload: UserPageUnknownRecord | null;
  status: 'written' | 'skipped' | 'error';
};
export type UserPageAnalysisCreatedSurveyCacheReadResult = {
  error?: unknown;
  networkID: string;
  questionsCache: unknown;
  sessionSlug: string;
  status: 'read' | 'skipped' | 'error';
  surveysCache: unknown;
};

export const toAnalysisCacheBucket = (value: unknown): UserPageUnknownRecord =>
  value != null && typeof value === 'object' ? (value as UserPageUnknownRecord) : {};

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

export const buildUserPageAnalysisCacheReadDescriptor = ({
  addressLower = '',
  fingerprint = '',
  forceRefresh = false,
  networkId = '',
  sessionSlug = '',
}: BuildUserPageAnalysisCacheReadDescriptorArgs = {}): UserPageAnalysisCacheReadDescriptor => ({
  action: forceRefresh ? 'skip-force-refresh' : 'read',
  addressLower: String(addressLower || '')
    .trim()
    .toLowerCase(),
  fingerprint: String(fingerprint || ''),
  networkId: String(networkId || ''),
  sessionSlug: String(sessionSlug || ''),
});

export const readUserPageAnalysisCacheThroughPort = ({
  cacheVersion = 1,
  descriptor = null,
  now = Date.now(),
  peekCache = null,
}: ReadUserPageAnalysisCacheThroughPortArgs = {}): UserPageAnalysisCacheReadPortResult => {
  const readDescriptor = descriptor || buildUserPageAnalysisCacheReadDescriptor();
  const baseResult = {
    descriptor: readDescriptor,
    entry: null,
  };
  if (
    readDescriptor.action !== 'read' ||
    !readDescriptor.sessionSlug ||
    !readDescriptor.networkId ||
    !readDescriptor.addressLower ||
    !readDescriptor.fingerprint ||
    typeof peekCache !== 'function'
  ) {
    return {
      ...baseResult,
      status: 'skipped',
    };
  }
  try {
    const cacheObj = toAnalysisCacheBucket(peekCache('analysisCache', readDescriptor.sessionSlug, { clone: false }));
    const entry = readUserPageAnalysisCacheEntry({
      addressLower: readDescriptor.addressLower,
      cacheObj,
      cacheVersion,
      fingerprint: readDescriptor.fingerprint,
      networkId: readDescriptor.networkId,
      now,
    });
    return {
      ...baseResult,
      entry,
      status: entry ? 'hit' : 'miss',
    };
  } catch (error) {
    return {
      ...baseResult,
      error,
      status: 'error',
    };
  }
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
  const networkBucket: UserPageUnknownRecord =
    networkBucketSource && typeof networkBucketSource === 'object'
      ? { ...(networkBucketSource as UserPageUnknownRecord) }
      : {};
  const addressBucketRaw = networkBucket[addressKey];
  const addressBucketSource: UserPageUnknownRecord =
    addressBucketRaw && typeof addressBucketRaw === 'object' ? (addressBucketRaw as UserPageUnknownRecord) : {};
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

export const writeUserPageAnalysisCacheThroughPort = async ({
  addressLower = '',
  aiContext = {},
  cachedAt = Date.now(),
  cacheVersion = 1,
  fingerprint = '',
  networkId = '',
  peekCache = null,
  result = {},
  sessionSlug = '',
  ttlMs = 24 * 60 * 60 * 1000,
  writeCache = null,
}: WriteUserPageAnalysisCacheThroughPortArgs = {}): Promise<UserPageAnalysisCacheWritePortResult> => {
  let entry: UserPageAnalysisCacheEntry | null = null;
  let payload: UserPageUnknownRecord | null = null;
  if (
    !String(sessionSlug || '') ||
    !String(networkId || '') ||
    !String(addressLower || '') ||
    !String(fingerprint || '') ||
    typeof peekCache !== 'function' ||
    typeof writeCache !== 'function'
  ) {
    return {
      entry,
      payload,
      status: 'skipped',
    };
  }
  try {
    entry = buildUserPageAnalysisCacheEntry({
      addressLower,
      aiContext,
      cachedAt,
      cacheVersion,
      fingerprint,
      networkId,
      result,
      sessionSlug,
      ttlMs,
    });
    const current = peekCache('analysisCache', String(sessionSlug || ''), { clone: false });
    payload = buildUserPageAnalysisCacheWritePayload({
      addressLower,
      cachedAt,
      currentCache: current,
      entry,
      fingerprint,
      networkId,
    });
    await writeCache('analysisCache', String(sessionSlug || ''), payload);
    return {
      entry,
      payload,
      status: 'written',
    };
  } catch (error) {
    return {
      entry,
      error,
      payload,
      status: 'error',
    };
  }
};

export const readUserPageAnalysisCreatedSurveyCachesThroughPort = ({
  networkID = '',
  peekCache = null,
  sessionSlug = '',
}: ReadUserPageAnalysisCreatedSurveyCachesThroughPortArgs = {}): UserPageAnalysisCreatedSurveyCacheReadResult => {
  const resolvedNetworkID = String(networkID || '');
  const resolvedSessionSlug = String(sessionSlug || '');
  const baseResult = {
    networkID: resolvedNetworkID,
    questionsCache: {},
    sessionSlug: resolvedSessionSlug,
    surveysCache: {},
  };
  if (!resolvedNetworkID || typeof peekCache !== 'function') {
    return {
      ...baseResult,
      status: 'skipped',
    };
  }
  try {
    const surveysCache = peekCache('surveysCache', resolvedSessionSlug, { clone: false }) || {};
    const questionsCache = peekCache('questionsCache', resolvedSessionSlug, { clone: false }) || {};
    return {
      ...baseResult,
      questionsCache,
      status: 'read',
      surveysCache,
    };
  } catch (error) {
    return {
      ...baseResult,
      error,
      status: 'error',
    };
  }
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
} = {}): UserPageCacheSourcePresence =>
  buildUserPageCacheSourcePresence({
    hasSurveysCache: hasNamespaceEntries('surveysCache'),
    hasQuestionsCache: hasNamespaceEntries('questionsCache'),
    hasSbtCache: hasNamespaceEntries('sbtCache'),
    hasUserCache: hasNamespaceEntries('userCache'),
  });

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
    surveySourcesSignature: [surveysNamespaceSignature, questionsNamespaceSignature, userNamespaceSignature].join('|'),
    questionSourcesSignature: [questionsNamespaceSignature, userNamespaceSignature].join('|'),
    sbtSourcesSignature: [sbtNamespaceSignature, userNamespaceSignature].join('|'),
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
}: BuildUserPageUnifiedCacheAggregateMemoKeyArgs = {}): string =>
  [
    String(viewAddressLower || ''),
    String(networkID || ''),
    String(questionResponsesNonce || 0),
    String(sbtCacheRevision || 0),
    String(sourceMembershipSignature || ''),
  ].join('|');

export const buildUserPageUnifiedCacheAggregateMemoPlan = ({
  currentAggregateMemo = null,
  currentAggregateMemoKey = '',
  networkID = '',
  questionResponsesNonce = 0,
  sbtCacheRevision = 0,
  sourceMembershipSignature = '',
  viewAddressLower = '',
}: BuildUserPageUnifiedCacheAggregateMemoPlanArgs = {}): UserPageUnifiedCacheAggregateMemoPlan => {
  const aggregateMemoKey = buildUserPageUnifiedCacheAggregateMemoKey({
    networkID,
    questionResponsesNonce,
    sbtCacheRevision,
    sourceMembershipSignature,
    viewAddressLower,
  });
  const canReuseAggregate = !!(currentAggregateMemo && String(currentAggregateMemoKey || '') === aggregateMemoKey);
  return {
    aggregate: canReuseAggregate ? currentAggregateMemo : null,
    aggregateMemoKey,
    canReuseAggregate,
  };
};

export const buildUserPageResponseSectionDeriveSignature = ({
  viewAddressLower = '',
  networkID = '',
  sourceSignature = '',
  questionResponsesNonce = 0,
  account = '',
  responseGateAccessGeneration = 0,
  responseGateAccessStatusVersion = 0,
}: BuildUserPageResponseSectionDeriveSignatureArgs = {}): string =>
  [
    String(viewAddressLower || ''),
    String(networkID || ''),
    String(sourceSignature || ''),
    String(questionResponsesNonce || 0),
    String(account || '')
      .trim()
      .toLowerCase(),
    String(responseGateAccessGeneration || 0),
    String(responseGateAccessStatusVersion || 0),
  ].join('|');

export const buildUserPageResponseSectionDeriveMemoPlan = ({
  account = '',
  currentMemo = null,
  force = false,
  networkID = '',
  questionResponsesNonce = 0,
  responseGateAccessGeneration = 0,
  responseGateAccessStatusVersion = 0,
  sourceSignature = '',
  viewAddressLower = '',
}: BuildUserPageResponseSectionDeriveMemoPlanArgs = {}): UserPageSectionDeriveMemoPlan => {
  const signature = buildUserPageResponseSectionDeriveSignature({
    account,
    networkID,
    questionResponsesNonce,
    responseGateAccessGeneration,
    responseGateAccessStatusVersion,
    sourceSignature,
    viewAddressLower,
  });
  const memo = toAnalysisRecord(currentMemo);
  const canReuseMemo = !!(!force && currentMemo && memo.signature === signature);
  return {
    canReuseMemo,
    gateSnapshot: canReuseMemo ? memo.gateSnapshot : null,
    result: canReuseMemo ? memo.result : null,
    signature,
  };
};

export const buildUserPageSbtSectionDeriveSignature = ({
  viewAddressLower = '',
  networkID = '',
  sourceSignature = '',
  sbtCacheRevision = 0,
}: BuildUserPageSbtSectionDeriveSignatureArgs = {}): string =>
  [
    String(viewAddressLower || ''),
    String(networkID || ''),
    String(sourceSignature || ''),
    String(sbtCacheRevision || 0),
  ].join('|');

export const buildUserPageSbtSectionDeriveMemoPlan = ({
  currentMemo = null,
  force = false,
  networkID = '',
  sbtCacheRevision = 0,
  sourceSignature = '',
  viewAddressLower = '',
}: BuildUserPageSbtSectionDeriveMemoPlanArgs = {}): UserPageSectionDeriveMemoPlan => {
  const signature = buildUserPageSbtSectionDeriveSignature({
    networkID,
    sbtCacheRevision,
    sourceSignature,
    viewAddressLower,
  });
  const memo = toAnalysisRecord(currentMemo);
  const canReuseMemo = !!(!force && currentMemo && memo.signature === signature);
  return {
    canReuseMemo,
    gateSnapshot: null,
    result: canReuseMemo ? memo.result : null,
    signature,
  };
};

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
  const isOwnProfile = !!(viewAddressLower && connectedAddressLower && viewAddressLower === connectedAddressLower);
  return {
    isOwnProfile,
    options: isOwnProfile ? { force: true, markLoading: false, bypassSignature: true } : { markLoading: false },
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
    return String(slug || '') === String(bookmarksSlug || '') ? { action: 'bookmarks' } : { action: 'ignore' };
  }
  return ['surveysCache', 'questionsCache', 'sbtCache', 'userCache'].includes(resolvedNamespace)
    ? { action: 'refresh' }
    : { action: 'ignore' };
};

const readOptionalUserPageNetworkId = (network: unknown): unknown =>
  network != null && (typeof network === 'object' || typeof network === 'function')
    ? (network as { id?: unknown }).id
    : undefined;

export const resolveUserPageAddressContextChange = ({
  nextNetwork = null,
  nextViewAddress = undefined,
  prevNetwork = null,
  prevViewAddress = undefined,
}: ResolveUserPageAddressContextChangeArgs = {}): UserPageAddressContextChangeDecision => ({
  nextViewAddress,
  shouldReset:
    prevViewAddress !== nextViewAddress ||
    readOptionalUserPageNetworkId(prevNetwork) !== readOptionalUserPageNetworkId(nextNetwork),
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
    String(account || '')
      .trim()
      .toLowerCase(),
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

export const buildUserPageCacheRefreshRequestDescriptor = ({
  account = '',
  bypassSignature = false,
  currentInputSignature = '',
  force = false,
  gateRecheckEpoch = 0,
  hasUncertainGateAccess = false,
  hasUncertainUserData = false,
  isQuestionCacheReady = false,
  isResponsesCacheReady = false,
  isSBTCacheReady = false,
  isSurveyCacheReady = false,
  markLoading = false,
  networkID = '',
  questionResponsesNonce = 0,
  responseGateAccessGeneration = 0,
  responseGateAccessStatusVersion = 0,
  sbtCacheRevision = 0,
  sourceSnapshot = null,
  viewAddress = '',
}: BuildUserPageCacheRefreshRequestDescriptorArgs = {}): UserPageCacheRefreshRequestDescriptor => {
  const resolvedForce = !!force;
  const resolvedMarkLoading = !!markLoading;
  const resolvedBypassSignature = !!bypassSignature;
  const viewAddressLower = String(viewAddress || '').toLowerCase();
  const snapshot = toAnalysisRecord(sourceSnapshot);
  const sourcePresence = buildUserPageCacheSourcePresence(snapshot);
  const hasSurveySources = !!snapshot.hasSurveySources;
  const hasQuestionSources = !!snapshot.hasQuestionSources;
  const hasSbtSources = !!snapshot.hasSbtSources;
  const refreshInputSignature = viewAddressLower
    ? buildUserPageCacheRefreshInputSignature({
        account,
        gateRecheckEpoch,
        hasQuestionSources,
        hasSbtSources,
        hasSurveySources,
        hasUncertainGateAccess,
        hasUncertainUserData,
        isQuestionCacheReady,
        isResponsesCacheReady,
        isSBTCacheReady,
        isSurveyCacheReady,
        networkID,
        questionResponsesNonce,
        responseGateAccessGeneration,
        responseGateAccessStatusVersion,
        sbtCacheRevision,
        sourceMembershipSignature: snapshot.membershipSignature,
        viewAddressLower,
      })
    : '';
  const holdFlags = buildUserPageCacheLoadingHoldFlags({
    force: resolvedForce,
    hasQuestionSources,
    hasSbtSources,
    hasSurveySources,
    questionsReady: isQuestionCacheReady,
    responsesReady: isResponsesCacheReady,
    sbtReady: isSBTCacheReady,
    surveysReady: isSurveyCacheReady,
  });
  const shouldSkipSameSignature =
    !resolvedForce &&
    !resolvedMarkLoading &&
    !resolvedBypassSignature &&
    refreshInputSignature === String(currentInputSignature || '');
  return {
    action: !viewAddressLower ? 'missing-address' : shouldSkipSameSignature ? 'skip-same-signature' : 'refresh',
    bypassSignature: resolvedBypassSignature,
    force: resolvedForce,
    hasQuestionSources,
    hasSbtSources,
    hasSurveySources,
    ...holdFlags,
    markLoading: resolvedMarkLoading,
    networkID: String(networkID || ''),
    refreshInputSignature,
    sourcePresence,
    viewAddressLower,
  };
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
  holdSurveyLoading: !force && (!surveysReady || !responsesReady) && !hasSurveySources,
  holdQuestionLoading: !force && (!questionsReady || !responsesReady) && !hasQuestionSources,
  holdSbtLoading: !force && !sbtReady && !hasSbtSources,
});

export const buildUserPageMissingAddressCacheStatePatch = (): UserPageUnknownRecord => ({
  loadingSurveys: false,
  loadingQuestions: false,
  loadingSBTs: false,
  hasUncertainGateAccess: false,
  deepScanTooltipLines: null,
  deepScanProgressRows: null,
});

export const buildUserPageMissingAddressCacheStateUpdate = (prevState: unknown = {}): UserPageUnknownRecord | null => {
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
