import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import {
  isPlainAnalysisObject,
  toAnalysisRecord,
  type UserPageUnknownRecord,
} from './userPageCoreHelpers';
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
  readUserPageNetworkCache,
  readUserPageOwnershipCount,
  upsertUserPageResponseByRecency,
  writeUserPageResponseSourceSlug,
  writeUserPageSourceSlug,
} from './userPageCacheHelpers';
export type {
  UpsertUserPageResponseByRecencyArgs,
  UserPageCacheNetworkBucket,
  UserPageOwnershipCountMaps,
  UserPageOwnershipSignalAggregate,
  UserPagePrioritizedCacheNode,
  UserPagePrioritizedUserChainNode,
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
export type UserPageAnalysisFingerprintInput = {
  address?: unknown;
  model?: unknown;
  networkId?: unknown;
  provider?: unknown;
  sessionSlug?: unknown;
  userData: unknown;
  version?: unknown;
};
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
type UserPageLengthLike = {
  length: number;
};
type ResolveUserPageAnalysisModalDisplayStateArgs = {
  analysisDetails?: unknown;
  analysisError?: unknown;
  analysisHistoricalFigure?: unknown;
  analysisHistoricalReasoning?: unknown;
  analyzing?: unknown;
};
type ResolveUserPageAnalysisCacheStatusStateArgs = {
  analysisCachedAt?: unknown;
  analysisServedFromCache?: unknown;
};
type UserPageAnalysisCacheStatusState = {
  analysisCacheAge: string;
  shouldRenderAnalysisCacheStatus: boolean;
};
type UserPageAnalysisModalDisplayState = {
  shouldRenderAnalysisBody: boolean;
  shouldRenderAnalyzing: boolean;
  shouldRenderDetails: boolean;
  shouldRenderError: boolean;
  shouldRenderHistoricalAlignment: boolean;
  shouldRenderHistoricalFigure: boolean;
  shouldRenderHistoricalReasoning: boolean;
};
type ResolveUserPageFullProfileModalDisplayStateArgs = {
  account?: unknown;
  explorerUrl?: unknown;
  minimized?: unknown;
  propViewAddress?: unknown;
  surveyResponseInfo?: unknown;
  surveyResponsesLoadingEmpty?: unknown;
};
type UserPageFullProfileModalDisplayState = {
  shouldRenderBookmarksLink: boolean;
  shouldRenderModalActions: boolean;
  shouldRenderSurveyEmptyText: boolean;
  shouldRenderSurveyList: boolean;
  shouldRenderSurveySpinner: boolean;
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
type BuildUserPageAnalysisCreatedSurveysArgs = {
  networkID?: unknown;
  questionsCache?: unknown;
  surveyCreationInfo?: unknown;
  surveysCache?: unknown;
};
type UserPageSbtDisplayNameReader = (sbtInfo: unknown) => unknown;
type BuildUserPageAnalysisSbtsArgs = {
  getSbtDisplayName?: UserPageSbtDisplayNameReader | null;
  sbtList?: unknown;
};
type UserPageShortAddressReader = (address: unknown, compact?: boolean) => unknown;
type UserPageTranslateReader = (key: string) => unknown;
type BuildUserPageSbtSectionArgs = {
  aggregate?: unknown;
  getSbtDisplayName?: UserPageSbtDisplayNameReader | null;
  getShortenedAddress?: UserPageShortAddressReader | null;
  translate?: UserPageTranslateReader | null;
  viewAddressLower?: unknown;
};
type BuildUserPageAnalysisQuestionsArgs = {
  detailedQuestionResponses?: unknown;
  questionResponseInfo?: unknown;
};
type BuildUserPageAnalysisSurveysArgs = {
  detailedSurveyResponses?: unknown;
  surveyResponseInfo?: unknown;
};
type UserPageAnalysisQuestionRecord = UserPageUnknownRecord & {
  id?: string;
  prompt?: unknown;
  type?: unknown;
};
type UserPageAnalysisSbtEntry = UserPageUnknownRecord & {
  name?: unknown;
  sbtInfo?: UserPageUnknownRecord;
};
type UserPageDerivedSbtListItem = {
  sbtInfo: UserPageUnknownRecord;
  slug?: unknown;
};
type UserPageSbtSectionResult = {
  badgesReceived: number;
  sbtList: UserPageDerivedSbtListItem[];
  telemetry: {
    payload: UserPageUnknownRecord;
    signature: string;
  } | null;
};
type UserPageAnalysisSurveyRecord = UserPageUnknownRecord & {
  id?: string;
  questionsCount?: unknown;
  title?: unknown;
};
type UserPageAnalysisSurveyResponseItem = UserPageUnknownRecord & {
  questionData?: unknown;
  responseData?: unknown;
};
type BuildUserPageAnalysisResultStatePatchArgs = {
  cachedAt?: unknown;
  includeElapsed?: unknown;
  includeError?: unknown;
  includeModal?: unknown;
  result?: unknown;
  servedFromCache?: unknown;
};
type BuildUserPageAnalysisResetStatePatchArgs = {
  analyzing?: unknown;
};
type BuildUserPageAnalysisAiOptionsArgs = {
  analysisSession?: unknown;
  defaultReason?: unknown;
};
type BuildUserPageAnalysisErrorStatePatchArgs = {
  message?: unknown;
};
type BuildUserPageAnalysisElapsedStatePatchArgs = {
  nowMs?: unknown;
  startedAt?: unknown;
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
type BuildUserPageDeriveTelemetrySnapshotArgs = {
  aggregate?: unknown;
  questionSection?: unknown;
  sbtSection?: unknown;
  surveySection?: unknown;
};
type BuildUserPageNoSbtVisibleTelemetryStateArgs = {
  hasUncertainGateAccess?: unknown;
  hasUncertainSbtData?: unknown;
  hasUncertainUserData?: unknown;
  isDeepScanning?: unknown;
  isSBTReady?: unknown;
  latestRefreshTelemetry?: unknown;
  loadingSBTs?: unknown;
  networkID?: unknown;
  sbtList?: unknown;
  viewAddress?: unknown;
};
type UserPageNoSbtVisibleTelemetryState = {
  payload: UserPageUnknownRecord | null;
  shouldEmit: boolean;
  signature: string;
};
type BuildUserPageRefreshTelemetrySnapshotArgs = {
  aggregate?: unknown;
  bypassSignature?: unknown;
  deepScanTooltipLines?: unknown;
  force?: unknown;
  hasSbtSources?: unknown;
  hasUncertainGateAccess?: unknown;
  hasUncertainUserData?: unknown;
  holdSbtLoading?: unknown;
  isDeepScanning?: unknown;
  markLoading?: unknown;
  networkID?: unknown;
  sbtReady?: unknown;
  sbtSection?: unknown;
  sourcePresence?: unknown;
  viewAddressLower?: unknown;
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
type UserPageErrorLike = {
  message?: unknown;
};
export type UserPageTooltipTargetIds = {
  addrFragment: string;
  analyzeBtnWrapId: string;
  compareBtnWrapId: string;
  questionSpinnerId: string;
  questionsCreatedSpinnerId: string;
  sbtSpinnerId: string;
  surveySpinnerId: string;
  surveysCreatedSpinnerId: string;
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

export const getUserPageErrorMessage = (error: unknown, fallback = 'Unknown error'): string => {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as UserPageErrorLike).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
};

export const isUserPageGateAccessContext = (value: unknown): boolean => {
  const record = toAnalysisRecord(value);
  return record.pendingKeys instanceof Set && record.uncertainResources instanceof Set;
};

export const isUserPageSbtAggregateEntry = (value: unknown): boolean => {
  const record = toAnalysisRecord(value);
  return record.mintedSet instanceof Set && record.burnedSet instanceof Set;
};

export const sortUserAnalysisKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortUserAnalysisKeys(item));
  }
  if (!isPlainAnalysisObject(value)) return value;
  return Object.keys(value)
    .sort()
    .reduce<UserPageUnknownRecord>((acc, key) => {
      acc[key] = sortUserAnalysisKeys(value[key]);
      return acc;
    }, {});
};

export const digestUserPageAnalysisCanonicalString = async (canonical: string): Promise<string> => {
  const subtle = globalThis?.crypto?.subtle;
  if (subtle && typeof subtle.digest === 'function' && typeof TextEncoder !== 'undefined') {
    const buffer = await subtle.digest('SHA-256', new TextEncoder().encode(canonical));
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a:${hash.toString(16).padStart(8, '0')}`;
};

export const buildUserPageAnalysisFingerprint = async ({
  userData,
  address,
  networkId,
  sessionSlug,
  provider,
  model,
  version = 1,
}: UserPageAnalysisFingerprintInput): Promise<string> => {
  const canonical = JSON.stringify(sortUserAnalysisKeys({
    version,
    userData,
    address: String(address || '').trim().toLowerCase(),
    networkId: String(networkId || ''),
    sessionSlug: String(sessionSlug || ''),
    provider: String(provider || '').trim().toLowerCase(),
    model: String(model || '').trim(),
  }));
  return digestUserPageAnalysisCanonicalString(canonical);
};

export const formatAnalysisCacheAge = (cachedAt: unknown): string => {
  const ts = Number(cachedAt || 0);
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const ageMs = Math.max(0, Date.now() - ts);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (ageMs < minute) return 'just now';
  if (ageMs < hour) return `${Math.max(1, Math.floor(ageMs / minute))}m ago`;
  if (ageMs < day) return `${Math.max(1, Math.floor(ageMs / hour))}h ago`;
  return `${Math.max(1, Math.floor(ageMs / day))}d ago`;
};

export const resolveUserPageAnalysisCacheStatusState = ({
  analysisCachedAt = null,
  analysisServedFromCache = false,
}: ResolveUserPageAnalysisCacheStatusStateArgs = {}): UserPageAnalysisCacheStatusState => {
  const analysisCacheAge = analysisServedFromCache
    ? formatAnalysisCacheAge(analysisCachedAt)
    : '';
  return {
    analysisCacheAge,
    shouldRenderAnalysisCacheStatus: !!analysisCacheAge,
  };
};

export const resolveUserPageAnalysisModalDisplayState = ({
  analysisDetails = '',
  analysisError = '',
  analysisHistoricalFigure = '',
  analysisHistoricalReasoning = '',
  analyzing = false,
}: ResolveUserPageAnalysisModalDisplayStateArgs = {}): UserPageAnalysisModalDisplayState => {
  const shouldRenderAnalyzing = !!analyzing;
  const shouldRenderError = !shouldRenderAnalyzing && !!analysisError;
  const shouldRenderAnalysisBody = !shouldRenderAnalyzing && !shouldRenderError;
  const shouldRenderHistoricalFigure = shouldRenderAnalysisBody && !!analysisHistoricalFigure;
  const shouldRenderHistoricalReasoning = shouldRenderAnalysisBody && !!analysisHistoricalReasoning;
  return {
    shouldRenderAnalysisBody,
    shouldRenderAnalyzing,
    shouldRenderDetails: shouldRenderAnalysisBody && !!analysisDetails,
    shouldRenderError,
    shouldRenderHistoricalAlignment: shouldRenderHistoricalFigure || shouldRenderHistoricalReasoning,
    shouldRenderHistoricalFigure,
    shouldRenderHistoricalReasoning,
  };
};

export const resolveUserPageFullProfileModalDisplayState = ({
  account = '',
  explorerUrl = '',
  minimized = false,
  propViewAddress = '',
  surveyResponseInfo = [],
  surveyResponsesLoadingEmpty = false,
}: ResolveUserPageFullProfileModalDisplayStateArgs = {}): UserPageFullProfileModalDisplayState => {
  const surveyResponseCount = Number((surveyResponseInfo as { length?: unknown })?.length || 0);
  const shouldRenderSurveySpinner = !!surveyResponsesLoadingEmpty;
  const shouldRenderModalActions = !minimized && !!propViewAddress && !!explorerUrl;
  const accountLower = String(account || '').toLowerCase();
  const propViewAddressLower = String(propViewAddress || '').toLowerCase();
  return {
    shouldRenderBookmarksLink: shouldRenderModalActions && !!accountLower && accountLower === propViewAddressLower,
    shouldRenderModalActions,
    shouldRenderSurveyEmptyText: !shouldRenderSurveySpinner && surveyResponseCount === 0,
    shouldRenderSurveyList: !shouldRenderSurveySpinner && surveyResponseCount > 0,
    shouldRenderSurveySpinner,
  };
};

export const buildUserPageTooltipTargetIds = (viewAddress: unknown = ''): UserPageTooltipTargetIds => {
  const rawAddrSeed = String(viewAddress || 'addr');
  const sanitizedAddrSeed = rawAddrSeed.replace(/[^A-Za-z0-9_-]/g, '');
  const normalizedAddrSeed = sanitizedAddrSeed.toLowerCase();
  const addrFragment = (
    normalizedAddrSeed.startsWith('0x')
      ? normalizedAddrSeed.slice(2)
      : normalizedAddrSeed
  ).slice(0, 6) || 'addr';
  return {
    addrFragment,
    analyzeBtnWrapId: `analyzeBtnWrap_${addrFragment}`,
    compareBtnWrapId: `compareBtnWrap_${addrFragment}`,
    questionSpinnerId: `questionSpinner_${addrFragment}`,
    questionsCreatedSpinnerId: `questionsCreatedSpinner_${addrFragment}`,
    sbtSpinnerId: `sbtSpinner_${addrFragment}`,
    surveySpinnerId: `surveySpinner_${addrFragment}`,
    surveysCreatedSpinnerId: `surveysCreatedSpinner_${addrFragment}`,
  };
};

export const readBoolishUserPageTelemetryFlag = (raw: unknown, fallback: unknown = false): boolean => {
  if (typeof raw === 'boolean') return raw;
  const val = (raw == null ? '' : String(raw)).trim().toLowerCase();
  if (val === '1' || val === 'true' || val === 'yes' || val === 'on') return true;
  if (val === '0' || val === 'false' || val === 'no' || val === 'off') return false;
  return !!fallback;
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

export const buildUserPageAnalysisCreatedQuestions = (
  questionCreationInfo: unknown = []
): UserPageUnknownRecord[] => (
  (Array.isArray(questionCreationInfo) ? questionCreationInfo as UserPageAnalysisQuestionRecord[] : []).map((q) => ({
    id: q.id,
    type: q.type,
    prompt: q.prompt,
  }))
);

export const buildUserPageAnalysisSbts = ({
  getSbtDisplayName = null,
  sbtList = [],
}: BuildUserPageAnalysisSbtsArgs = {}): UserPageUnknownRecord[] => (
  (Array.isArray(sbtList) ? sbtList : [])
    .map((item: UserPageAnalysisSbtEntry) => ({
      name: (
        typeof getSbtDisplayName === 'function'
          ? getSbtDisplayName(item?.sbtInfo)
          : ''
      ) || item?.name || '',
      address: item?.sbtInfo?.sbtAddress,
    }))
    .filter((s: UserPageUnknownRecord) => s && s.name && s.address)
);

export const buildUserPageSbtSection = ({
  aggregate = null,
  getSbtDisplayName = null,
  getShortenedAddress = null,
  translate = null,
  viewAddressLower = '',
}: BuildUserPageSbtSectionArgs = {}): UserPageSbtSectionResult => {
  const userSBTs: UserPageDerivedSbtListItem[] = [];
  const viewAddressKey = String(viewAddressLower || '').toLowerCase();
  const sbtAggregate = toAnalysisRecord(toAnalysisRecord(aggregate).sbtAggregate);
  const aggregateKeys = Object.keys(sbtAggregate);
  const translateSbt = (): unknown => (
    typeof translate === 'function' ? translate('sbt') : 'SBT'
  );

  aggregateKeys.forEach((key: string) => {
    const entryRecord = toAnalysisRecord(sbtAggregate[key]);
    if (!isUserPageSbtAggregateEntry(entryRecord)) return;
    const sbtInfo = isPlainAnalysisObject(entryRecord.sbtInfo)
      ? entryRecord.sbtInfo
      : {};
    if (sbtInfo.unlisted === true) return;
    const mintedSet = entryRecord.mintedSet as Set<string>;
    const burnedSet = entryRecord.burnedSet as Set<string>;
    if (mintedSet.has(viewAddressKey) && !burnedSet.has(viewAddressKey)) {
      const sbtAddress = String(entryRecord.sbtAddress || key || sbtInfo.sbtAddress || '');
      const preferredName = String((
        typeof getSbtDisplayName === 'function' ? getSbtDisplayName(sbtInfo) : ''
      ) || '').trim();
      const shortenedAddress = (sbtAddress && sbtAddress.length > 10)
        ? (
          typeof getShortenedAddress === 'function'
            ? getShortenedAddress(sbtAddress, false)
            : sbtAddress
        )
        : sbtAddress;
      const fallbackName = shortenedAddress ? `${translateSbt()} ${shortenedAddress}` : translateSbt();
      userSBTs.push({
        sbtInfo: {
          ...sbtInfo,
          name: preferredName || fallbackName,
          sbtAddress: sbtAddress || key,
        },
        slug: entryRecord.slug,
      });
    }
  });

  if (!aggregateKeys.length) {
    return {
      sbtList: userSBTs,
      badgesReceived: userSBTs.length,
      telemetry: null,
    };
  }

  const heldCandidateCount = aggregateKeys.filter((key: string) => {
    const entryRecord = toAnalysisRecord(sbtAggregate[key]);
    if (!isUserPageSbtAggregateEntry(entryRecord)) return false;
    const mintedSet = entryRecord.mintedSet as Set<string>;
    const burnedSet = entryRecord.burnedSet as Set<string>;
    return mintedSet.has(viewAddressKey) && !burnedSet.has(viewAddressKey);
  }).length;
  const signature = [
    viewAddressKey,
    String(aggregateKeys.length),
    String(heldCandidateCount),
    String(userSBTs.length),
  ].join('|');

  return {
    sbtList: userSBTs,
    badgesReceived: userSBTs.length,
    telemetry: {
      signature,
      payload: {
        viewAddress: viewAddressKey,
        aggregateSbtAddresses: aggregateKeys.length,
        heldAggregateSbtCount: heldCandidateCount,
        derivedSbtCount: userSBTs.length,
        derivedSbtSample: userSBTs
          .map((item) => String(item.sbtInfo.sbtAddress || '').toLowerCase())
          .filter(Boolean)
          .slice(0, 12),
      },
    },
  };
};

export const buildUserPageAnalysisQuestions = ({
  detailedQuestionResponses = {},
  questionResponseInfo = [],
}: BuildUserPageAnalysisQuestionsArgs = {}): UserPageUnknownRecord[] => (
  (Array.isArray(questionResponseInfo) ? questionResponseInfo : [])
    .map((q: UserPageAnalysisQuestionRecord) => {
      const resp = (detailedQuestionResponses as Record<string, UserPageUnknownRecord> | null | undefined)?.[q.id as string] || {};
      const ans = toAnalysisRecord(resp.answer).value;
      if (ans === '*' || ans === '' || ans == null) return null;
      return {
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        answer: Array.isArray(ans) ? ans : ans,
        importance: extractUserPageAnalysisImportance(resp),
        additionalComment: extractUserPageAnalysisAdditionalComment(resp) || undefined,
      };
    })
    .filter(Boolean) as UserPageUnknownRecord[]
);

export const buildUserPageAnalysisSurveys = ({
  detailedSurveyResponses = {},
  surveyResponseInfo = [],
}: BuildUserPageAnalysisSurveysArgs = {}): UserPageUnknownRecord[] => (
  (Array.isArray(surveyResponseInfo) ? surveyResponseInfo as UserPageAnalysisSurveyRecord[] : []).map((s) => {
    const arr = (detailedSurveyResponses as Record<string, unknown> | null | undefined)?.[s.id as string] || [];
    const answered = (Array.isArray(arr) ? arr as UserPageAnalysisSurveyResponseItem[] : []).filter((it) => {
      const responseData = toAnalysisRecord(it?.responseData);
      const v = toAnalysisRecord(responseData.answer).value;
      return v && v !== '*';
    });

    const sample = answered.slice(0, 3).map((it) => {
      const questionData = toAnalysisRecord(it?.questionData);
      const responseData = toAnalysisRecord(it?.responseData);
      const v = toAnalysisRecord(responseData.answer).value;
      return {
        prompt: questionData.prompt,
        type: questionData.type || responseData.type || 'unknown',
        answer: Array.isArray(v) ? v : v,
        importance: extractUserPageAnalysisImportance(responseData),
        additionalComment: extractUserPageAnalysisAdditionalComment(responseData) || undefined,
      };
    });

    const additionalCommentsSample = answered
      .map((it) => extractUserPageAnalysisAdditionalComment(it?.responseData))
      .filter(Boolean)
      .slice(0, 3);

    return {
      surveyId: s.id,
      title: s.title,
      answeredCount: answered.length,
      sample,
      additionalCommentsSample: additionalCommentsSample.length > 0 ? additionalCommentsSample : undefined,
    };
  })
);

export const readUserPageDirectNetworkCacheBucket = (
  cacheObj: unknown,
  netKey: unknown
): UserPageUnknownRecord => {
  if (!isPlainAnalysisObject(cacheObj) || !netKey) return {};
  const bucket = cacheObj[String(netKey)];
  return isPlainAnalysisObject(bucket) ? bucket : {};
};

export const buildUserPageAnalysisCreatedSurveys = ({
  networkID = '',
  questionsCache = {},
  surveyCreationInfo = [],
  surveysCache = {},
}: BuildUserPageAnalysisCreatedSurveysArgs = {}): UserPageUnknownRecord[] => {
  const netSurv = readUserPageDirectNetworkCacheBucket(surveysCache, networkID);
  const netQs = readUserPageDirectNetworkCacheBucket(questionsCache, networkID);
  const surveyBucket = netSurv.surveys && typeof netSurv.surveys === 'object'
    ? netSurv.surveys as UserPageUnknownRecord
    : {};
  const questionBucket = netQs.questions && typeof netQs.questions === 'object'
    ? netQs.questions as UserPageUnknownRecord
    : {};
  return (Array.isArray(surveyCreationInfo) ? surveyCreationInfo as UserPageAnalysisSurveyRecord[] : []).map((sv) => {
    const sData = toAnalysisRecord(surveyBucket[sv.id as string]);
    const qIds = Array.isArray(sData.questionIDs) ? sData.questionIDs : [];
    const sampleQuestions = (qIds.slice(0, 5) as string[]).map((qid) => {
      const qidLower = qid.toLowerCase();
      const qRaw = questionBucket[qidLower];
      const q = toAnalysisRecord(qRaw);
      return qRaw
        ? { id: (q.id || qidLower), type: q.type, prompt: q.prompt }
        : { id: qidLower };
    });
    return {
      surveyId: sv.id,
      title: sv.title,
      questionsCount: sv.questionsCount,
      sampleQuestions,
    };
  });
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

export const normalizeUserAnalysisResult = (result: unknown = {}) => {
  const resultRecord = toAnalysisRecord(result);
  const historicalAlignment = toAnalysisRecord(resultRecord.historicalAlignment);
  return {
    name: resultRecord.name || 'User Analysis',
    summary: resultRecord.summary || '',
    details: resultRecord.details || '',
    historicalAlignment: {
      figure: historicalAlignment.figure || '',
      reasoning: historicalAlignment.reasoning || '',
    },
  };
};

export const buildUserPageAnalysisResultStatePatch = ({
  cachedAt = null,
  includeElapsed = false,
  includeError = false,
  includeModal = false,
  result = {},
  servedFromCache = false,
}: BuildUserPageAnalysisResultStatePatchArgs = {}): UserPageUnknownRecord => {
  const normalizedResult = normalizeUserAnalysisResult(result);
  return {
    ...(includeModal ? { showAnalysisModal: true } : {}),
    aiAnalysis: normalizedResult.summary,
    analysisDetails: normalizedResult.details,
    analysisName: normalizedResult.name,
    analysisHistoricalFigure: normalizedResult.historicalAlignment.figure,
    analysisHistoricalReasoning: normalizedResult.historicalAlignment.reasoning,
    ...(includeElapsed ? { analysisElapsedMs: 0 } : {}),
    ...(includeError ? { analysisError: '' } : {}),
    analyzing: false,
    analysisServedFromCache: servedFromCache === true,
    analysisCachedAt: Number(cachedAt || 0) || null,
  };
};

export const buildUserPageAnalysisResetStatePatch = ({
  analyzing = false,
}: BuildUserPageAnalysisResetStatePatchArgs = {}): UserPageUnknownRecord => ({
  showAnalysisModal: true,
  analyzing: analyzing === true,
  analysisError: '',
  aiAnalysis: '',
  analysisDetails: '',
  analysisName: '',
  analysisElapsedMs: 0,
  analysisHistoricalFigure: '',
  analysisHistoricalReasoning: '',
  analysisServedFromCache: false,
  analysisCachedAt: null,
});

export const buildUserPageAnalysisElapsedStatePatch = ({
  nowMs = Date.now(),
  startedAt = 0,
}: BuildUserPageAnalysisElapsedStatePatchArgs = {}): UserPageUnknownRecord => ({
  analysisElapsedMs: Number(nowMs) - Number(startedAt),
});

export const buildUserPageAnalysisAiOptions = ({
  analysisSession = {},
  defaultReason = 'unknown',
}: BuildUserPageAnalysisAiOptionsArgs = {}): UserPageUnknownRecord => {
  const session = toAnalysisRecord(analysisSession);
  return {
    sessionSlug: String(session.slug || ''),
    sessionConfig: session.sessionConfig,
    sessionSelection: {
      gateStatus: String(session.status || 'unknown'),
      reason: String(session.reason || defaultReason || 'unknown'),
    },
  };
};

export const buildUserPageAnalysisErrorStatePatch = ({
  message = 'Unable to generate analysis right now. Please try again later.',
}: BuildUserPageAnalysisErrorStatePatchArgs = {}): UserPageUnknownRecord => ({
  analyzing: false,
  analysisError: String(message || 'Unable to generate analysis right now. Please try again later.'),
  showAnalysisModal: true,
  analysisServedFromCache: false,
  analysisCachedAt: null,
});

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

export const buildUserPageDeriveTelemetrySnapshot = ({
  aggregate = null,
  questionSection = null,
  sbtSection = null,
  surveySection = null,
}: BuildUserPageDeriveTelemetrySnapshotArgs = {}): UserPageUnknownRecord => {
  const aggregateRecord = aggregate as UserPageUnknownRecord | null | undefined;
  const questionRecord = questionSection as UserPageUnknownRecord | null | undefined;
  const sbtRecord = sbtSection as UserPageUnknownRecord | null | undefined;
  const surveyRecord = surveySection as UserPageUnknownRecord | null | undefined;
  return {
    aggregateBuilt: !!aggregate,
    combinedSurveys: aggregate ? Object.keys((aggregateRecord?.combinedSurveys || {}) as object).length : 0,
    combinedQuestions: aggregate ? Object.keys((aggregateRecord?.combinedQuestions || {}) as object).length : 0,
    combinedSurveyResponses: aggregate
      ? Object.keys((aggregateRecord?.combinedSurveyResponses || {}) as object).length
      : 0,
    combinedQuestionResponses: aggregate
      ? Object.keys((aggregateRecord?.combinedQuestionResponses || {}) as object).length
      : 0,
    sbtAggregateKeys: aggregate ? Object.keys((aggregateRecord?.sbtAggregate || {}) as object).length : 0,
    surveySection: surveySection ? {
      responseCount: (surveyRecord?.surveyResponseInfo as UserPageLengthLike | null | undefined)?.length,
      createdCount: (surveyRecord?.surveyCreationInfo as UserPageLengthLike | null | undefined)?.length,
    } : null,
    questionSection: questionSection ? {
      responseCount: (questionRecord?.questionResponseInfo as UserPageLengthLike | null | undefined)?.length,
      createdCount: (questionRecord?.questionCreationInfo as UserPageLengthLike | null | undefined)?.length,
    } : null,
    sbtSection: sbtSection ? {
      sbtCount: (sbtRecord?.sbtList as UserPageLengthLike | null | undefined)?.length,
    } : null,
  };
};

export const buildUserPageNoSbtVisibleTelemetryState = ({
  hasUncertainGateAccess = false,
  hasUncertainSbtData = false,
  hasUncertainUserData = false,
  isDeepScanning = false,
  isSBTReady = false,
  latestRefreshTelemetry = null,
  loadingSBTs = false,
  networkID = '',
  sbtList = [],
  viewAddress = '',
}: BuildUserPageNoSbtVisibleTelemetryStateArgs = {}): UserPageNoSbtVisibleTelemetryState => {
  const viewAddressLower = String(viewAddress || '').toLowerCase();
  const resolvedIsSBTReady = !!isSBTReady;
  const resolvedLoadingSBTs = !!loadingSBTs;
  const resolvedIsDeepScanning = !!isDeepScanning;
  const isSbtLoadingAny = !!(resolvedLoadingSBTs || !resolvedIsSBTReady || resolvedIsDeepScanning);
  const sbtListCount = Array.isArray(sbtList) ? sbtList.length : 0;
  if (isSbtLoadingAny || sbtListCount > 0) {
    return {
      payload: null,
      shouldEmit: false,
      signature: '',
    };
  }

  const latestRefresh = toAnalysisRecord(latestRefreshTelemetry);
  const signature = [
    viewAddressLower,
    String(networkID || ''),
    String(resolvedLoadingSBTs ? 1 : 0),
    String(resolvedIsSBTReady ? 1 : 0),
    String(resolvedIsDeepScanning ? 1 : 0),
    String(hasUncertainUserData ? 1 : 0),
    String(hasUncertainSbtData ? 1 : 0),
    String(hasUncertainGateAccess ? 1 : 0),
    String(sbtListCount),
    String(latestRefresh.aggregateSbtAddresses || 0),
    String(latestRefresh.heldAggregateSbtCount || 0),
    String(latestRefresh.derivedSbtCount ?? ''),
  ].join('|');

  return {
    payload: {
      viewAddress: viewAddressLower,
      networkID: String(networkID || ''),
      loadingSBTs: resolvedLoadingSBTs,
      isSBTReady: resolvedIsSBTReady,
      isDeepScanning: resolvedIsDeepScanning,
      hasUncertainUserData: !!hasUncertainUserData,
      hasUncertainSbtData: !!hasUncertainSbtData,
      hasUncertainGateAccess: !!hasUncertainGateAccess,
      sbtListCount,
      refreshSnapshot: latestRefresh,
    },
    shouldEmit: true,
    signature,
  };
};

export const buildUserPageRefreshTelemetrySnapshot = ({
  aggregate = null,
  bypassSignature = false,
  deepScanTooltipLines = null,
  force = false,
  hasSbtSources = false,
  hasUncertainGateAccess = false,
  hasUncertainUserData = false,
  holdSbtLoading = false,
  isDeepScanning = false,
  markLoading = false,
  networkID = '',
  sbtReady = false,
  sbtSection = null,
  sourcePresence = {},
  viewAddressLower = '',
}: BuildUserPageRefreshTelemetrySnapshotArgs = {}): UserPageUnknownRecord => {
  const aggregateRecord = aggregate as UserPageUnknownRecord | null | undefined;
  const sbtSectionRecord = sbtSection as UserPageUnknownRecord | null | undefined;
  const aggregateSbt = aggregateRecord?.sbtAggregate || {};
  const aggregateSbtKeys = Object.keys(aggregateSbt as object);
  const heldAggregateSbtKeys = aggregateSbtKeys.filter((key: string) => {
    const entry = (aggregateSbt as UserPageUnknownRecord)[key] as UserPageUnknownRecord | null | undefined;
    return !!(
      entry &&
      (entry.mintedSet as { has?: (value: unknown) => boolean } | null | undefined)?.has?.(viewAddressLower) &&
      !(entry.burnedSet as { has?: (value: unknown) => boolean } | null | undefined)?.has?.(viewAddressLower)
    );
  });
  const aggregateSurveyMap = aggregateRecord?.combinedSurveys || {};
  const aggregateQuestionMap = aggregateRecord?.combinedQuestions || {};
  const aggregateSurveyResponseMap = aggregateRecord?.combinedSurveyResponses || {};
  const aggregateQuestionResponseMap = aggregateRecord?.combinedQuestionResponses || {};
  const aggregateSurveyResponseIds = Object.keys(aggregateSurveyResponseMap as object).filter((sidRaw: string) => {
    const sid = String(sidRaw || '').toLowerCase();
    if (!sid) return false;
    const row = (
      (aggregateSurveyResponseMap as UserPageUnknownRecord)[sidRaw] ||
      (aggregateSurveyResponseMap as UserPageUnknownRecord)[sid] ||
      {}
    );
    return !!(row && Object.prototype.hasOwnProperty.call(row, viewAddressLower as PropertyKey));
  });
  const aggregateQuestionResponseIds = Object.keys(aggregateQuestionResponseMap as object).filter((qidRaw: string) => {
    const qid = String(qidRaw || '').toLowerCase();
    if (!qid) return false;
    const row = (
      (aggregateQuestionResponseMap as UserPageUnknownRecord)[qidRaw] ||
      (aggregateQuestionResponseMap as UserPageUnknownRecord)[qid] ||
      {}
    );
    return !!(row && Object.prototype.hasOwnProperty.call(row, viewAddressLower as PropertyKey));
  });

  return {
    viewAddress: viewAddressLower,
    networkID: String(networkID || ''),
    force: !!force,
    markLoading: !!markLoading,
    bypassSignature: !!bypassSignature,
    isDeepScanning: !!isDeepScanning,
    hasUncertainUserData: !!hasUncertainUserData,
    hasUncertainGateAccess: !!hasUncertainGateAccess,
    sbtReady: !!sbtReady,
    holdSbtLoading: !!holdSbtLoading,
    hasSbtSources: !!hasSbtSources,
    aggregateSbtAddresses: aggregateSbtKeys.length,
    heldAggregateSbtCount: heldAggregateSbtKeys.length,
    heldAggregateSbtSample: heldAggregateSbtKeys.slice(0, 12),
    aggregateSurveyCount: Object.keys(aggregateSurveyMap as object).length,
    aggregateQuestionCount: Object.keys(aggregateQuestionMap as object).length,
    aggregateSurveyResponseCount: aggregateSurveyResponseIds.length,
    aggregateQuestionResponseCount: aggregateQuestionResponseIds.length,
    aggregateSurveyResponseSample: aggregateSurveyResponseIds.slice(0, 12),
    aggregateQuestionResponseSample: aggregateQuestionResponseIds.slice(0, 12),
    derivedSbtCount: Array.isArray(sbtSectionRecord?.sbtList)
      ? sbtSectionRecord.sbtList.length
      : null,
    sourcePresence,
    deepScanTooltipLines: Array.isArray(deepScanTooltipLines)
      ? deepScanTooltipLines.slice(0, 8)
      : [],
  };
};

export const buildUserPageRefreshTelemetrySignature = (
  refreshTelemetry: unknown = {}
): string => {
  const telemetry = refreshTelemetry as UserPageUnknownRecord;
  const deepScanTooltipLines = Array.isArray(telemetry.deepScanTooltipLines)
    ? telemetry.deepScanTooltipLines
    : [];
  return [
    telemetry.viewAddress,
    telemetry.networkID,
    String(telemetry.isDeepScanning ? 1 : 0),
    String(telemetry.hasUncertainUserData ? 1 : 0),
    String(telemetry.sbtReady ? 1 : 0),
    String(telemetry.holdSbtLoading ? 1 : 0),
    String(telemetry.hasSbtSources ? 1 : 0),
    String(telemetry.aggregateSbtAddresses),
    String(telemetry.heldAggregateSbtCount),
    String(telemetry.aggregateSurveyCount || 0),
    String(telemetry.aggregateQuestionCount || 0),
    String(telemetry.aggregateSurveyResponseCount || 0),
    String(telemetry.aggregateQuestionResponseCount || 0),
    String(telemetry.derivedSbtCount ?? ''),
    deepScanTooltipLines.join('|'),
  ].join('|');
};

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

export const extractUserPageAnalysisAdditionalComment = (value: unknown): string | null => {
  const record = toAnalysisRecord(value);
  if (!Object.keys(record).length) return null;
  const candidates = [
    record.additionalComment,
    record.additionalComments,
    record.comment,
    record.comments,
  ];
  for (const candidate of candidates) {
    if (candidate == null) continue;
    const candidateRecord = toAnalysisRecord(candidate);
    const val = typeof candidate === 'string'
      ? candidate
      : (candidateRecord.value ?? candidateRecord.text ?? null);
    const encrypted = typeof candidate === 'object' && candidateRecord.encrypted === true;
    if (val && val !== '*' && !encrypted && String(val).trim() !== '*') return String(val);
  }
  return null;
};

export const extractUserPageAnalysisImportance = (value: unknown): unknown => {
  const record = toAnalysisRecord(value);
  const meta = toAnalysisRecord(record.meta);
  const answer = toAnalysisRecord(record.answer);
  const candidate =
    record.conviction ??
    record.importance ??
    meta.conviction ??
    meta.importance ??
    answer.conviction ??
    answer.importance;
  const candidateRecord = toAnalysisRecord(candidate);
  return (
    candidate === '*' ||
    (candidate && typeof candidate === 'object' && candidateRecord.encrypted === true)
  ) ? undefined : candidate;
};
