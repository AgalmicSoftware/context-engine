import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
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
  UserPageResponseDecryptSurveyBindings,
} from './userPageGateHelpers';
export {
  buildUserPageProfileEditVisibility,
  resolveUserPageAddressDisplayState,
  resolveUserPageBlockieSeed,
  resolveUserPageHeaderActionVisibility,
} from './userPageProfileDisplayHelpers';
export type {
  BuildUserPageProfileEditVisibilityArgs,
  ResolveUserPageAddressDisplayStateArgs,
  ResolveUserPageBlockieSeedArgs,
  ResolveUserPageHeaderActionVisibilityArgs,
  UserPageAddressDisplayState,
  UserPageHeaderActionVisibility,
  UserPageProfileEditVisibility,
} from './userPageProfileDisplayHelpers';
export {
  buildUserPageRenderLoadingState,
  buildUserPageSectionLoadingEmptyState,
  buildUserPageUncertainEmptyText,
  buildUserPageUncertaintyLoadingFlags,
  buildUserPageUserStatsMergePatch,
  resolveUserPageAiActionAvailability,
  resolveUserPageAnalyzeButtonDisplayState,
  resolveUserPageCompareButtonDisplayState,
  resolveUserPageSectionToggleDisplayState,
  shouldRetryUserPageQuestionData,
} from './userPageLoadingStateHelpers';
export type {
  BuildUserPageRenderLoadingStateArgs,
  BuildUserPageSectionLoadingEmptyStateArgs,
  BuildUserPageUncertainEmptyTextArgs,
  BuildUserPageUncertaintyLoadingFlagsArgs,
  BuildUserPageUserStatsMergePatchArgs,
  ResolveUserPageAiActionAvailabilityArgs,
  ResolveUserPageAnalyzeButtonDisplayStateArgs,
  ResolveUserPageCompareButtonDisplayStateArgs,
  ResolveUserPageSectionToggleDisplayStateArgs,
  ShouldRetryUserPageQuestionDataArgs,
  UserPageAiActionAvailability,
  UserPageAnalyzeButtonDisplayState,
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
export type UserPageEffectiveAiConfigRequest = {
  sessionSlug: string;
  thinking: boolean;
  resolveSecrets: boolean;
};
export type UserPageEffectiveAiConfigResult = {
  provider?: unknown;
  model?: unknown;
};
export type UserPageEffectiveAiConfigGetter = (
  request: UserPageEffectiveAiConfigRequest
) => Promise<UserPageEffectiveAiConfigResult | null | undefined>;
export type UserPageAnalysisAiContextLogger = {
  warn?: (...args: unknown[]) => void;
};
export type ResolveUserPageAnalysisAiContextArgs = {
  getEffectiveAiConfig?: UserPageEffectiveAiConfigGetter;
  logger?: UserPageAnalysisAiContextLogger;
  sessionConfig?: UserPageUnknownRecord;
  sessionSlug?: unknown;
};
type UserPageNamespaceSlugReader = (namespace: unknown) => unknown;
type UserPageNamespacePresenceReader = (namespace: unknown) => boolean;
type UserPageDeepScanSlugReader = (namespace: string) => unknown[];
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
type UserPageSessionConfigReader = (slug: string) => unknown;
type UserPageSessionSlugByNameReader = (sessionName: unknown) => unknown;
type ResolveUserPageAnalysisSessionConfigForSlugArgs = {
  getSessionConfigBySlug?: UserPageSessionConfigReader;
  getSessionConfigBySlugOrDefault?: UserPageSessionConfigReader;
  slugIn?: unknown;
};
type ResolveUserPageQuestionSourceSessionSlugArgs = {
  fallbackSlug?: unknown;
  getSessionSlugByName?: UserPageSessionSlugByNameReader;
  questionData?: unknown;
};
type BuildUserPageAiSessionScopeContextArgs = {
  activeSessionSlug?: unknown;
  scanScope?: unknown;
  scanSlugs?: unknown;
};
type BuildUserPageAiSessionSlugCandidatesArgs = {
  activeSessionSlug?: unknown;
  listNamespaceSlugs?: UserPageDeepScanSlugReader;
  namespaces?: string[];
  sbtList?: unknown;
  scopeContext?: UserPageAiSessionScopeContext | null;
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
type ResolveUserPageAiAvailabilityRefreshArgs = {
  nextAccount?: unknown;
  nextIsQuestionCacheReady?: unknown;
  nextIsResponsesCacheReady?: unknown;
  nextIsSBTCacheReady?: unknown;
  nextIsSurveyCacheReady?: unknown;
  nextNetworkId?: unknown;
  nextViewAddress?: unknown;
  prevAccount?: unknown;
  prevIsQuestionCacheReady?: unknown;
  prevIsResponsesCacheReady?: unknown;
  prevIsSBTCacheReady?: unknown;
  prevIsSurveyCacheReady?: unknown;
  prevNetworkId?: unknown;
  prevViewAddress?: unknown;
};
type BuildUserPageAiAvailabilityStatePatchArgs = {
  available?: unknown;
};
type UserPageAiAvailabilityStatePatch = {
  aiAvailable: boolean | null;
};
type UserPageAiAvailabilityRefreshDecision = {
  allCachesReady: boolean;
  contextChanged: boolean;
  shouldCheckAfterReset: boolean;
  shouldCheckNow: boolean;
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
type BuildUserPageAnalysisExcludeSlugSetArgs = {
  excludeSlugs?: unknown;
};
type UserPageAnalysisCandidateLogRow = {
  slug: unknown;
  status: unknown;
};
type ResolveUserPageAnalysisSessionFallbackArgs = {
  activeCandidate?: unknown;
  checked?: unknown;
  firstUsable?: unknown;
};
type UserPageAnalysisSessionFallback = {
  candidate: UserPageUnknownRecord;
  reason: string;
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
export type UserPageAiSessionScopeContext = {
  mode: string;
  strict: boolean;
  allowedSlugs: string[];
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

export const buildUserPageAiSessionScopeContext = ({
  activeSessionSlug = '',
  scanScope = '',
  scanSlugs = [],
}: BuildUserPageAiSessionScopeContextArgs = {}): UserPageAiSessionScopeContext => {
  const mode = String(scanScope || '').trim().toLowerCase();
  const activeSlug = normalizeSessionSlug(activeSessionSlug || '');
  const toList = (raw: unknown): string[] => (
    Array.isArray(raw)
      ? Array.from(new Set(raw.map((item: unknown) => normalizeSessionSlug(item || ''))))
      : []
  );
  if (mode === 'general') {
    return { mode, strict: true, allowedSlugs: [''] };
  }
  if (mode === 'active') {
    return { mode, strict: !!activeSlug, allowedSlugs: activeSlug ? [activeSlug] : [] };
  }
  if (mode === 'list') {
    const list = toList(scanSlugs);
    return { mode, strict: list.length > 0, allowedSlugs: list };
  }
  return { mode: mode || 'all', strict: false, allowedSlugs: [] };
};

export const buildUserPageAiSessionSlugCandidates = ({
  activeSessionSlug = '',
  listNamespaceSlugs = () => [],
  namespaces = ['userCache', 'surveysCache', 'questionsCache', 'sbtCache'],
  sbtList = [],
  scopeContext = null,
}: BuildUserPageAiSessionSlugCandidatesArgs = {}): string[] => {
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (rawSlug: unknown): void => {
    const slug = normalizeSessionSlug(rawSlug || '');
    if (seen.has(slug)) return;
    seen.add(slug);
    ordered.push(slug);
  };

  const activeSlug = normalizeSessionSlug(activeSessionSlug || '');
  const resolvedScopeContext = scopeContext || buildUserPageAiSessionScopeContext({ activeSessionSlug });
  const allowedSlugs = Array.isArray(resolvedScopeContext.allowedSlugs)
    ? resolvedScopeContext.allowedSlugs
    : [];

  // Keep the actively viewed session eligible even when strict scan scope is narrower.
  push(activeSlug);
  allowedSlugs.forEach((slug: unknown) => push(slug));
  namespaces.forEach((namespace: string) => {
    listNamespaceSlugs(namespace).forEach((slug: unknown) => push(slug));
  });
  if (Array.isArray(sbtList)) {
    sbtList.forEach((item: unknown) => {
      const record = toAnalysisRecord(item);
      push(record.slug);
    });
  }
  if (!ordered.length) push('');
  if (!resolvedScopeContext.strict) return ordered;

  const allowed = new Set<string>(allowedSlugs);
  if (activeSlug) allowed.add(activeSlug);
  const filtered = ordered.filter((slug: string) => allowed.has(slug));
  return filtered.length > 0 ? filtered : ordered;
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

export const resolveUserPageQuestionSourceSessionSlug = ({
  questionData = null,
  fallbackSlug = '',
  getSessionSlugByName = () => null,
}: ResolveUserPageQuestionSourceSessionSlugArgs = {}): string => {
  const record = toAnalysisRecord(questionData);
  const explicitSlug = normalizeSessionSlug(
    record.sessionSlug ??
    record._sessionSlug ??
    record.groupSlug ??
    record.session ??
    ''
  );
  if (explicitSlug) return explicitSlug;

  const mappedNameSlug = getSessionSlugByName(record.sessionName);
  if (mappedNameSlug != null) return normalizeSessionSlug(mappedNameSlug);

  const nameSlug = normalizeSessionSlug(record.sessionName);
  if (nameSlug && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(nameSlug)) return nameSlug;

  return normalizeSessionSlug(fallbackSlug);
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

export const resolveUserPageAnalysisSessionConfigForSlug = ({
  getSessionConfigBySlug: readSessionConfig = () => null,
  getSessionConfigBySlugOrDefault: readDefaultSessionConfig = () => null,
  slugIn = '',
}: ResolveUserPageAnalysisSessionConfigForSlugArgs = {}): UserPageUnknownRecord | null => {
  const slug = normalizeSessionSlug(slugIn || '');
  const cfg = slug ? readSessionConfig(slug) : readDefaultSessionConfig('');
  return isPlainAnalysisObject(cfg) ? cfg : null;
};

export const buildUserPageAnalysisExcludeSlugSet = ({
  excludeSlugs = [],
}: BuildUserPageAnalysisExcludeSlugSetArgs = {}): Set<string> => {
  const list = Array.isArray(excludeSlugs)
    ? excludeSlugs.filter((slug: unknown) => slug != null)
    : [];
  return new Set<string>(list.map((slug: unknown) => normalizeSessionSlug(slug || '')));
};

export const resolveUserPageAnalysisSessionFallback = ({
  activeCandidate = null,
  checked = [],
  firstUsable = null,
}: ResolveUserPageAnalysisSessionFallbackArgs = {}): UserPageAnalysisSessionFallback | null => {
  const active = isPlainAnalysisObject(activeCandidate) ? activeCandidate : null;
  const usable = isPlainAnalysisObject(firstUsable) ? firstUsable : null;
  const checkedList = Array.isArray(checked)
    ? checked.filter((entry): entry is UserPageUnknownRecord => isPlainAnalysisObject(entry))
    : [];
  const fallback = active || usable || checkedList[0] || null;
  if (!fallback) return null;
  const reason = fallback === active
    ? 'fallback-active-session'
    : fallback === usable
      ? 'fallback-first-usable-session'
      : 'fallback-first-checked-session';
  return { candidate: fallback, reason };
};

export const buildUserPageAnalysisCandidateLogRows = (
  checked: unknown = []
): UserPageAnalysisCandidateLogRow[] => (
  (Array.isArray(checked) ? checked : [])
    .map((entry: unknown) => {
      const record = toAnalysisRecord(entry);
      return {
        slug: record.slug || 'general',
        status: record.status,
      };
    })
);

export const deriveAnalysisAiContextFromSessionConfig = (
  sessionSlug: unknown,
  sessionConfig: UserPageUnknownRecord = {}
) => {
  const ai = toAnalysisRecord(sessionConfig.ai);
  const models = toAnalysisRecord(ai.models);
  const modelProviders = toAnalysisRecord(ai.modelProviders);
  const thinkingModel = models.thinking || models.reasoning || models.default;
  const thinkingModelRecord = toAnalysisRecord(thinkingModel);
  const fallbackProvider = String(ai.mode || ai.provider || 'openai').trim().toLowerCase() || 'openai';
  const provider = String(
    (isPlainAnalysisObject(thinkingModel) ? thinkingModelRecord.provider : '') ||
    modelProviders.thinking ||
    modelProviders.reasoning ||
    modelProviders.default ||
    fallbackProvider
  ).trim().toLowerCase() || 'openai';
  const model = String(
    (isPlainAnalysisObject(thinkingModel)
      ? (thinkingModelRecord.model || thinkingModelRecord.name || thinkingModelRecord.value)
      : thinkingModel) ||
    'gpt-5'
  ).trim() || 'gpt-5';
  return {
    sessionSlug: String(sessionSlug || ''),
    provider,
    model,
  };
};

export const resolveUserPageAnalysisAiContext = async ({
  getEffectiveAiConfig,
  logger,
  sessionConfig = {},
  sessionSlug,
}: ResolveUserPageAnalysisAiContextArgs = {}) => {
  const fallback = deriveAnalysisAiContextFromSessionConfig(sessionSlug, sessionConfig);
  try {
    if (typeof getEffectiveAiConfig !== 'function') return fallback;
    const effective = await getEffectiveAiConfig({
      sessionSlug: String(sessionSlug || ''),
      thinking: true,
      resolveSecrets: false,
    });
    return {
      sessionSlug: String(sessionSlug || ''),
      provider: String(effective?.provider || fallback.provider || 'openai').trim().toLowerCase() || 'openai',
      model: String(effective?.model || fallback.model || 'gpt-5').trim() || 'gpt-5',
    };
  } catch (error) {
    logger?.warn?.('[UserPage] analysis AI context fallback:', error);
    return fallback;
  }
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

export const buildUserPageAiAvailabilityStatePatch = ({
  available = null,
}: BuildUserPageAiAvailabilityStatePatchArgs = {}): UserPageAiAvailabilityStatePatch => ({
  aiAvailable: available === null ? null : Boolean(available),
});

export const resolveUserPageAiAvailabilityRefresh = ({
  nextAccount = '',
  nextIsQuestionCacheReady = false,
  nextIsResponsesCacheReady = false,
  nextIsSBTCacheReady = false,
  nextIsSurveyCacheReady = false,
  nextNetworkId = null,
  nextViewAddress = '',
  prevAccount = '',
  prevIsQuestionCacheReady = false,
  prevIsResponsesCacheReady = false,
  prevIsSBTCacheReady = false,
  prevIsSurveyCacheReady = false,
  prevNetworkId = null,
  prevViewAddress = '',
}: ResolveUserPageAiAvailabilityRefreshArgs = {}): UserPageAiAvailabilityRefreshDecision => {
  const allCachesReady = !!(
    nextIsSBTCacheReady &&
    nextIsSurveyCacheReady &&
    nextIsQuestionCacheReady &&
    nextIsResponsesCacheReady
  );
  const prevAllCachesReady = !!(
    prevIsSBTCacheReady &&
    prevIsSurveyCacheReady &&
    prevIsQuestionCacheReady &&
    prevIsResponsesCacheReady
  );
  const contextChanged = (
    prevAccount !== nextAccount ||
    prevViewAddress !== nextViewAddress ||
    prevNetworkId !== nextNetworkId
  );
  return {
    allCachesReady,
    contextChanged,
    shouldCheckAfterReset: contextChanged && allCachesReady,
    shouldCheckNow: !contextChanged && allCachesReady && !prevAllCachesReady,
  };
};
