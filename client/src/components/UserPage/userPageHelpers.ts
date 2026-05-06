import { normalizeSessionSlug } from '../../utilities/web3/contractScripts.js';
import {
  isPlainAnalysisObject,
  toAnalysisRecord,
  type UserPageUnknownRecord,
} from './userPageCoreHelpers';

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
type UserPageDeepScanSlugReader = (namespace: string) => unknown[];
type UserPageDeepScanCacheReader = (
  namespace: string,
  slug: string,
  options?: { clone?: boolean }
) => unknown;
type UserPageNamespaceSlugReader = (namespace: unknown) => unknown;
type UserPageNamespacePresenceReader = (namespace: unknown) => boolean;
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
type BuildUserPageDeepScanTooltipInputSignatureArgs = {
  latestBlockNumber?: unknown;
  listNamespaceSlugs?: UserPageDeepScanSlugReader;
  network?: unknown;
  peekCache?: UserPageDeepScanCacheReader;
  viewAddress?: unknown;
};
type BuildUserPageDeepScanTooltipDisplayStateArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: string[] | null;
  fallbackLine?: string;
  isDeepScanning?: unknown;
};
type BuildUserPageDeepScanTooltipOutputSignatureArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
};
type BuildUserPageDeepScanProgressStatePatchArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
  now?: unknown;
};
type ResolveUserPageDeepScanProgressStateUpdateArgs = {
  currentDeepScanProgressRows?: unknown;
  currentDeepScanTooltipLines?: unknown;
  nextDeepScanProgressRows?: unknown;
  nextDeepScanTooltipLines?: unknown;
};
type UserPageDeepScanProgressStateUpdate = {
  nextOutputSignature: string;
  shouldUpdate: boolean;
};
type UserPageDeepScanTooltipDisplayState = {
  deepScanTooltipContent: string[] | null;
  deepScanTooltipText: string;
  deepScanTooltipTitle: string;
};
type UserPageLengthLike = {
  length: number;
};
type BuildUserPageSectionLoadingEmptyStateArgs = {
  isQuestionLoadingAny?: unknown;
  isSbtLoadingAny?: unknown;
  isSurveyLoadingAny?: unknown;
  isSurveyReady?: unknown;
  isQuestionReady?: unknown;
  loadingQuestions?: unknown;
  loadingSurveys?: unknown;
  questionCreationInfo?: UserPageLengthLike;
  questionDeepScanLoadingActive?: unknown;
  questionResponseInfo?: UserPageLengthLike;
  sbtList?: UserPageLengthLike;
  surveyCreationInfo?: UserPageLengthLike;
  surveyDeepScanLoadingActive?: unknown;
  surveyResponseInfo?: UserPageLengthLike;
};
type BuildUserPageUncertainEmptyTextArgs = {
  hasUncertainSbtData?: unknown;
  hasUncertainUserData?: unknown;
  sbtLabel?: unknown;
  sbtsLowerLabel?: unknown;
};
type ShouldRetryUserPageQuestionDataArgs = {
  hasUncertainUserData?: unknown;
  holdQuestionLoading?: unknown;
  questionSection?: unknown;
};
type BuildUserPageUncertaintyLoadingFlagsArgs = {
  hasQuestionSources?: unknown;
  hasSbtSources?: unknown;
  hasSurveySources?: unknown;
  keepQuestionLoadingDuringDeepScan?: unknown;
  keepSurveyLoadingDuringDeepScan?: unknown;
  prevState?: unknown;
  uncertainResources?: unknown;
};
type UserPageUncertaintyLoadingFlags = {
  hasGateUncertainty: boolean;
  hasQuestionGateUncertainty: boolean;
  hasSurveyGateUncertainty: boolean;
  keepQuestionLoadingDuringDeepScan: boolean;
  keepQuestionLoadingFromUserUncertainty: boolean;
  keepSbtLoadingFromUserUncertainty: boolean;
  keepSurveyLoadingDuringDeepScan: boolean;
  keepSurveyLoadingFromUserUncertainty: boolean;
  preserveUserDataUncertainty: boolean;
};
type BuildUserPageDeepScanRefreshCarryPatchArgs = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
  prevState?: unknown;
};
type UserPageDeepScanRefreshCarryPatch = {
  deepScanProgressRows?: unknown;
  deepScanTooltipLines?: unknown;
};
type BuildUserPageUserStatsMergePatchArgs = {
  prevUserStats?: unknown;
  userStatsPatch?: unknown;
};
type BuildUserPageRenderLoadingStateArgs = {
  isDeepScanLoadingEnabledForSection?: ((section?: unknown) => unknown) | null;
  isDeepScanning?: unknown;
  isQuestionCacheReady?: unknown;
  isResponsesCacheReady?: unknown;
  isSBTCacheReady?: unknown;
  isSurveyCacheReady?: unknown;
  loadingQuestions?: unknown;
  loadingSBTs?: unknown;
  loadingSurveys?: unknown;
};
type ResolveUserPageAiActionAvailabilityArgs = {
  aiAvailable?: unknown;
  disabledByCache?: unknown;
  walletLabel?: unknown;
};
type ResolveUserPageAnalyzeButtonDisplayStateArgs = {
  aiActionAvailability?: Partial<UserPageAiActionAvailability> | null;
  analyzing?: unknown;
};
type ResolveUserPageCompareButtonDisplayStateArgs = {
  aiActionAvailability?: Partial<UserPageAiActionAvailability> | null;
  collapseOpen?: unknown;
};
type ResolveUserPageSectionToggleDisplayStateArgs = {
  open?: unknown;
};
type UserPageSectionLoadingEmptyState = {
  questionResponsesLoadingEmpty: boolean;
  questionsCreatedLoadingEmpty: boolean;
  sbtSectionLoadingEmpty: boolean;
  surveyResponsesLoadingEmpty: boolean;
  surveysCreatedLoadingEmpty: boolean;
};
type UserPageUncertainEmptyText = {
  questionResponsesEmptyText: string;
  sbtEmptyText: string;
};
type UserPageRenderLoadingState = {
  disabledByCache: boolean;
  isQuestionLoadingAny: boolean;
  isQuestionReady: boolean;
  isResponsesReady: boolean;
  isSBTReady: boolean;
  isSbtLoadingAny: boolean;
  isSurveyLoadingAny: boolean;
  isSurveyReady: boolean;
  questionDeepScanLoadingActive: boolean;
  surveyDeepScanLoadingActive: boolean;
};
type UserPageAiActionAvailability = {
  disabled: boolean;
  title?: string;
};
type UserPageAnalyzeButtonDisplayState = {
  ariaBusy: 'false' | 'true';
  disabled: boolean;
  label: string;
  shouldRenderAnalyzing: boolean;
  title?: string;
};
type UserPageCompareButtonDisplayState = {
  disabled: boolean;
  shouldRenderCollapseClosedIcon: boolean;
  shouldRenderCollapseOpenIcon: boolean;
  title?: string;
};
type UserPageSectionToggleDisplayState = {
  isOpen: boolean;
  shouldRenderClosedIcon: boolean;
  shouldRenderOpenIcon: boolean;
};
type BuildUserPageProfileEditVisibilityArgs = {
  account?: unknown;
  cachedNickname?: unknown;
  isEditingNickname?: unknown;
  isEditingUsername?: unknown;
  minimized?: unknown;
  pendingNickname?: unknown;
  viewAddress?: unknown;
};
type ResolveUserPageHeaderActionVisibilityArgs = {
  explorerUrl?: unknown;
  isEditingNickname?: unknown;
  isOwner?: unknown;
  isSimulated?: unknown;
  minimized?: unknown;
  notOwnPage?: unknown;
  propViewAddress?: unknown;
};
type ResolveUserPageSurveyCreatedCardStateArgs = {
  survey?: unknown;
};
type ResolveUserPageSurveyPreviewDisplayStateArgs = {
  actionsClassName?: unknown;
  baseClassName?: unknown;
  interactive?: unknown;
};
type ResolveUserPageSurveyCountDisplayStateArgs = {
  count?: unknown;
  countOnlyClassName?: unknown;
  infoClassName?: unknown;
};
type ResolveUserPageSurveyResponseCardStateArgs = {
  questionArray?: unknown;
  survey?: unknown;
};
type ResolveUserPageSurveySectionDisplayStateArgs = {
  isDeepScanning?: unknown;
  surveyCreationInfo?: unknown;
  surveyResponseInfo?: unknown;
  surveyResponsesLoadingEmpty?: unknown;
  surveysCreatedLoadingEmpty?: unknown;
};
type ResolveUserPageQuestionSectionDisplayStateArgs = {
  questionCreationInfo?: unknown;
  questionResponseInfo?: unknown;
  questionResponsesLoadingEmpty?: unknown;
  questionsCreatedLoadingEmpty?: unknown;
};
type ResolveUserPageSbtDisplayStateArgs = {
  isSBTCacheReady?: unknown;
  loadingSBTs?: unknown;
  sbtList?: unknown;
  sbtSectionLoadingEmpty?: unknown;
};
type ResolveUserPageAddressDisplayStateArgs = {
  bookmarked?: unknown;
  cachedNickname?: unknown;
  explorerUrl?: unknown;
  getShortenedAddress?: ((address: unknown, compact?: boolean) => unknown) | null;
  isEditingNickname?: unknown;
  isSimulated?: unknown;
  minimized?: unknown;
  nicknameInput?: unknown;
  propViewAddress?: unknown;
  stateViewAddress?: unknown;
  username?: unknown;
};
type ResolveUserPageBlockieSeedArgs = {
  propViewAddress?: unknown;
  username?: unknown;
};
type UserPageProfileEditVisibility = {
  hasNickForThis: boolean;
  isOwner: boolean;
  notOwnPage: boolean;
  showPen: boolean;
  showUsernamePen: boolean;
};
type UserPageHeaderActionVisibility = {
  showBookmarkButton: boolean;
  showBookmarksLink: boolean;
  showCopyAddressButton: boolean;
  showExplorerLink: boolean;
  showNicknameEditor: boolean;
  showSimulatedBadge: boolean;
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
type UserPageSurveyCreatedCardState = {
  hasDocURLs: boolean;
  hasExpandContent: boolean;
  hasQuestionIDs: boolean;
  hasTags: boolean;
  questionPreviewEntries: unknown[];
  surveyLinkSlug: string;
};
type UserPageSurveyPreviewDisplayState = {
  className: string;
  style: Record<string, string>;
};
type UserPageSurveyCountDisplayState = {
  ariaLabel: string;
  className: string;
  title: string;
};
type UserPageSurveyResponseCardState = {
  hasDocURLs: boolean;
  hasResponses: boolean;
  hasTags: boolean;
};
type UserPageSurveySectionDisplayState = {
  hasCreatedSurveys: boolean;
  hasSurveyResponses: boolean;
  shouldRenderSurveyResponsesEmptyText: boolean;
  shouldRenderSurveysCreatedEmptyText: boolean;
};
type UserPageQuestionSectionDisplayState = {
  hasCreatedQuestions: boolean;
  hasQuestionResponses: boolean;
  shouldRenderQuestionResponsesEmptyText: boolean;
  shouldRenderQuestionsCreatedEmptyText: boolean;
};
type UserPageSbtDisplayState = {
  hasSbts: boolean;
  shouldRenderMainEmptyText: boolean;
  shouldRenderModalEmptyText: boolean;
  shouldRenderModalSpinner: boolean;
};
type UserPageAddressDisplayState = {
  addressHref: string;
  addressLabel: string;
  nicknameToUse: string;
  pendingNicknameForThis: string;
  profileUrl: string;
  shouldLinkAddressLabel: boolean;
};
type UserPageSessionScanScopeReader = () => string;
type UserPageSessionScanSlugsReader = () => unknown[];
type UserPageAllowedSessionSlugsReader = (
  scope: string,
  slugs: unknown[],
  activeSlug: string
) => unknown[];
type BuildUserPageDeepScanPrioritySlugsArgs = {
  activeSessionSlug?: unknown;
  getAllowedSessionSlugs?: UserPageAllowedSessionSlugsReader;
  readSessionScanScope?: UserPageSessionScanScopeReader;
  readSessionScanSlugs?: UserPageSessionScanSlugsReader;
};
type UserPageSessionConfigReader = (slug: string) => unknown;
type UserPageDemoSessionConfigReader = (
  slug: string,
  options?: { allowDemoFallback?: boolean }
) => unknown;
type UserPageSessionSlugByNameReader = (sessionName: unknown) => unknown;
type ResolveUserPageAnalysisSessionConfigForSlugArgs = {
  getSessionConfigBySlug?: UserPageSessionConfigReader;
  getSessionConfigBySlugOrDefault?: UserPageSessionConfigReader;
  slugIn?: unknown;
};
type ResolveUserPageDeepScanSessionDisplayConfigArgs = {
  getDemoSessionConfigBySlug?: UserPageDemoSessionConfigReader;
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
type UserPageGateAccessCacheKeyArgs = {
  account?: unknown;
  networkID?: unknown;
  resourceKey?: unknown;
  sbtCacheRevision?: unknown;
  slug?: unknown;
};
type UserPageGatePendingKeyArgs = {
  resourceKey?: unknown;
  slug?: unknown;
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
type BuildUserPageDecryptedResponsePatchInput = {
  responseObj?: unknown;
  questionId?: unknown;
  fieldToDecrypt?: unknown;
  decryptedResult?: unknown;
};
type BuildUserPageResponseDecryptSurveyBindingsInput = {
  detailedSurveyResponses?: unknown;
  hashZero?: unknown;
  questionId?: unknown;
  questionResponseInfo?: unknown;
  responseOverride?: unknown;
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
export type UserPageDecryptableResponseField = UserPageUnknownRecord & {
  value: unknown;
  encrypted: boolean;
};
export type UserPageResponseDecryptSurveyBindings = {
  surveyId: string;
  acceptedSurveyIds: string[];
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

export const resolveUserPageQuestionPromptText = (questionData: unknown): string => {
  const record = toAnalysisRecord(questionData);
  if (!Object.keys(record).length) return '';
  const questionText = typeof record.question === 'string'
    ? record.question.trim()
    : '';
  if (questionText) return questionText;
  const promptText = typeof record.prompt === 'string'
    ? record.prompt.trim()
    : '';
  if (promptText) return promptText;
  return '';
};

export const shortenUserPageQuestionId = (questionId: unknown): string => {
  const fullId = String(questionId || '');
  if (fullId.length <= 20) return fullId;
  return `${fullId.slice(0, 8)}...${fullId.slice(-6)}`;
};

export const resolveUserPageSurveyCreatedCardState = ({
  survey = null,
}: ResolveUserPageSurveyCreatedCardStateArgs = {}): UserPageSurveyCreatedCardState => {
  const record = toAnalysisRecord(survey);
  const hasTags = Array.isArray(record.tags) && record.tags.length > 0;
  const hasDocURLs = Array.isArray(record.documentURLs) && record.documentURLs.length > 0;
  const hasQuestionIDs = Array.isArray(record.questionIDs) && record.questionIDs.length > 0;
  const questionPreviewEntries = (
    Array.isArray(record.questionPreviews) && record.questionPreviews.length > 0
  )
    ? record.questionPreviews
    : ((record.questionIDs || []) as unknown[]).map((qid: unknown) => ({
      id: String(qid || ''),
      text: '',
    }));

  return {
    hasDocURLs,
    hasExpandContent: hasTags || hasDocURLs || hasQuestionIDs,
    hasQuestionIDs,
    hasTags,
    questionPreviewEntries,
    surveyLinkSlug: normalizeSessionSlug(record.slug || ''),
  };
};

export const resolveUserPageSurveyPreviewDisplayState = ({
  actionsClassName = '',
  baseClassName = '',
  interactive = false,
}: ResolveUserPageSurveyPreviewDisplayStateArgs = {}): UserPageSurveyPreviewDisplayState => ({
  className: [
    String(baseClassName || ''),
    String(actionsClassName || ''),
  ].filter(Boolean).join(' '),
  style: { cursor: interactive ? 'pointer' : 'default' },
});

export const resolveUserPageSurveyCountDisplayState = ({
  count = 0,
  countOnlyClassName = '',
  infoClassName = '',
}: ResolveUserPageSurveyCountDisplayStateArgs = {}): UserPageSurveyCountDisplayState => {
  const label = `${String(count || 0)} questions`;
  return {
    ariaLabel: label,
    className: [
      String(infoClassName || ''),
      String(countOnlyClassName || ''),
    ].filter(Boolean).join(' '),
    title: label,
  };
};

export const resolveUserPageSurveyResponseCardState = ({
  questionArray = [],
  survey = null,
}: ResolveUserPageSurveyResponseCardStateArgs = {}): UserPageSurveyResponseCardState => {
  const record = toAnalysisRecord(survey);
  const questionCount = Number((questionArray as { length?: unknown })?.length || 0);
  return {
    hasDocURLs: Array.isArray(record.documentURLs) && record.documentURLs.length > 0,
    hasResponses: questionCount > 0,
    hasTags: Array.isArray(record.tags) && record.tags.length > 0,
  };
};

export const resolveUserPageSurveySectionDisplayState = ({
  isDeepScanning = false,
  surveyCreationInfo = [],
  surveyResponseInfo = [],
  surveyResponsesLoadingEmpty = false,
  surveysCreatedLoadingEmpty = false,
}: ResolveUserPageSurveySectionDisplayStateArgs = {}): UserPageSurveySectionDisplayState => {
  const createdSurveyCount = Number((surveyCreationInfo as { length?: unknown })?.length || 0);
  const surveyResponseCount = Number((surveyResponseInfo as { length?: unknown })?.length || 0);
  const hasCreatedSurveys = createdSurveyCount > 0;
  const hasSurveyResponses = surveyResponseCount > 0;
  const suppressSurveysCreatedEmptyText = !!surveysCreatedLoadingEmpty || (!!isDeepScanning && !hasCreatedSurveys);
  return {
    hasCreatedSurveys,
    hasSurveyResponses,
    shouldRenderSurveyResponsesEmptyText: !hasSurveyResponses && !surveyResponsesLoadingEmpty,
    shouldRenderSurveysCreatedEmptyText: !hasCreatedSurveys && !suppressSurveysCreatedEmptyText,
  };
};

export const resolveUserPageQuestionSectionDisplayState = ({
  questionCreationInfo = [],
  questionResponseInfo = [],
  questionResponsesLoadingEmpty = false,
  questionsCreatedLoadingEmpty = false,
}: ResolveUserPageQuestionSectionDisplayStateArgs = {}): UserPageQuestionSectionDisplayState => {
  const createdQuestionCount = Number((questionCreationInfo as { length?: unknown })?.length || 0);
  const questionResponseCount = Number((questionResponseInfo as { length?: unknown })?.length || 0);
  const hasCreatedQuestions = createdQuestionCount > 0;
  const hasQuestionResponses = questionResponseCount > 0;
  return {
    hasCreatedQuestions,
    hasQuestionResponses,
    shouldRenderQuestionResponsesEmptyText: !hasQuestionResponses && !questionResponsesLoadingEmpty,
    shouldRenderQuestionsCreatedEmptyText: !hasCreatedQuestions && !questionsCreatedLoadingEmpty,
  };
};

export const resolveUserPageSbtDisplayState = ({
  isSBTCacheReady = false,
  loadingSBTs = false,
  sbtList = [],
  sbtSectionLoadingEmpty = false,
}: ResolveUserPageSbtDisplayStateArgs = {}): UserPageSbtDisplayState => {
  const sbtCount = Number((sbtList as { length?: unknown })?.length || 0);
  const hasSbts = sbtCount > 0;
  const shouldRenderModalSpinner = !!loadingSBTs || isSBTCacheReady !== true;
  return {
    hasSbts,
    shouldRenderMainEmptyText: !hasSbts && !sbtSectionLoadingEmpty,
    shouldRenderModalEmptyText: !shouldRenderModalSpinner && !hasSbts,
    shouldRenderModalSpinner,
  };
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

export const normalizeUserPageGateSlug = (slug: unknown): string => {
  const raw = String(slug || '').trim().toLowerCase();
  return raw === 'general' ? '' : raw;
};

export const normalizeUserPageSourceSlugForSignature = (rawSlug: unknown): string => {
  const normalized = normalizeUserPageGateSlug(rawSlug || '');
  return normalized || 'general';
};

export const normalizeUserPageGateResourceKey = (resourceKey: unknown): string => (
  String(resourceKey || '').trim() || 'default'
);

export const buildUserPageGateAccessCacheKey = ({
  account = '',
  networkID = '',
  resourceKey = '',
  sbtCacheRevision = 0,
  slug = '',
}: UserPageGateAccessCacheKeyArgs = {}): string => {
  const accountLower = String(account || '').trim().toLowerCase();
  return [
    accountLower || 'anon',
    String(networkID || ''),
    String(sbtCacheRevision || 0),
    normalizeUserPageGateSlug(slug),
    normalizeUserPageGateResourceKey(resourceKey),
  ].join('|');
};

export const buildUserPageGatePendingKey = ({
  slug = '',
  resourceKey = '',
}: UserPageGatePendingKeyArgs = {}): string => (
  `${normalizeUserPageGateSlug(slug)}::${normalizeUserPageGateResourceKey(resourceKey)}`
);

export const getUserPageGateResourceKeysToCheck = (resourceKey: unknown = 'default'): string[] => {
  const normalized = normalizeUserPageGateResourceKey(resourceKey);
  if (normalized === 'default') return ['default'];
  return [normalized, 'default'];
};

export const isUserPageEncryptedResponseField = (fieldObj: unknown = null): boolean => {
  const fieldRecord = toAnalysisRecord(fieldObj);
  if (!Object.keys(fieldRecord).length) return false;
  return !!(
    fieldRecord.encrypted ||
    fieldRecord.encryptedPortion ||
    (
      fieldRecord.value === '*' &&
      (fieldRecord.encryptionAudience || fieldRecord.encrypted || fieldRecord.encryptedPortion)
    )
  );
};

export const isUserPageAnswerFieldEncrypted = (responseObj: unknown = null): boolean => {
  const responseRecord = toAnalysisRecord(responseObj);
  if (!Object.keys(responseRecord).length) return false;
  return isUserPageEncryptedResponseField(responseRecord.answer || {});
};

export const isUserPageAdditionalFieldEncrypted = (responseObj: unknown = null): boolean => {
  const responseRecord = toAnalysisRecord(responseObj);
  if (!Object.keys(responseRecord).length) return false;
  return isUserPageEncryptedResponseField(responseRecord.additional || {});
};

export const isUserPageResponsePayloadEncrypted = (responseObj: unknown = null): boolean => (
  isUserPageAnswerFieldEncrypted(responseObj) || isUserPageAdditionalFieldEncrypted(responseObj)
);

export const inferUserPageResponseFieldEncryptionAudience = (
  responseObj: unknown = null,
  fieldKey: unknown = 'answer',
  fallback: unknown = 'gate'
): string => {
  const responseRecord = toAnalysisRecord(responseObj);
  const fieldRecord = toAnalysisRecord(responseRecord[String(fieldKey || '')]);
  const rawAudience = String(fieldRecord.encryptionAudience || '').trim().toLowerCase();
  if (rawAudience === 'gate' || rawAudience === 'self') return rawAudience;
  return String(fallback || 'gate').trim().toLowerCase() || 'gate';
};

export const inferUserPageResponseEncryptionAudience = (
  responseObj: unknown = null,
  fallback: unknown = 'gate'
): string => {
  const answerAudience = inferUserPageResponseFieldEncryptionAudience(responseObj, 'answer', fallback);
  const additionalAudience = inferUserPageResponseFieldEncryptionAudience(responseObj, 'additional', fallback);
  if (answerAudience === 'self' && additionalAudience === 'self') return 'self';
  if (answerAudience === 'gate' || additionalAudience === 'gate') return 'gate';
  if (answerAudience === 'self' || additionalAudience === 'self') return 'self';
  return String(fallback || 'gate').trim().toLowerCase() || 'gate';
};

export const buildUserPageDecryptableResponseField = (
  field: unknown = null
): UserPageDecryptableResponseField => {
  const safeField = toAnalysisRecord(field);
  return {
    ...(safeField || {}),
    value: Object.prototype.hasOwnProperty.call(safeField, 'value')
      ? safeField.value
      : '',
    encrypted: !!(safeField.encrypted || safeField.encryptedPortion),
  };
};

export const applyUserPageDecryptedPatchToResponseField = (
  field: unknown = null,
  decryptedPatch: unknown = null
): unknown => {
  const patchRecord = toAnalysisRecord(decryptedPatch);
  if (!Object.prototype.hasOwnProperty.call(patchRecord, 'value')) {
    return field;
  }
  const nextField: UserPageUnknownRecord = {
    ...toAnalysisRecord(field),
    value: patchRecord.value,
    encrypted: false,
  };
  if (Object.prototype.hasOwnProperty.call(patchRecord, 'zkSalt')) {
    nextField.zkSalt = patchRecord.zkSalt;
  }
  delete nextField.encryptedPortion;
  return nextField;
};

export const buildUserPageDecryptedResponsePatch = ({
  responseObj = null,
  questionId = '',
  fieldToDecrypt = 'both',
  decryptedResult = null,
}: BuildUserPageDecryptedResponsePatchInput = {}): UserPageUnknownRecord | null => {
  const qid = String(questionId || '').trim().toLowerCase();
  const responseRecord = toAnalysisRecord(responseObj);
  if (!Object.keys(responseRecord).length || !qid) return null;
  const decryptedRecord = toAnalysisRecord(decryptedResult);
  const decryptedAnswers = toAnalysisRecord(decryptedRecord.answers);
  const decryptedAdditionalComments = toAnalysisRecord(decryptedRecord.additionalComments);
  const decryptedAnswer = toAnalysisRecord(decryptedAnswers[qid]);
  const decryptedAdditional = toAnalysisRecord(decryptedAdditionalComments[qid]);
  const shouldPatchAnswer =
    (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') &&
    Object.prototype.hasOwnProperty.call(decryptedAnswer, 'value');
  const shouldPatchAdditional =
    (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') &&
    Object.prototype.hasOwnProperty.call(decryptedAdditional, 'value');

  if (!shouldPatchAnswer && !shouldPatchAdditional) return null;

  const nextResponse: UserPageUnknownRecord = {
    ...responseRecord,
  };
  if (shouldPatchAnswer) {
    nextResponse.answer = applyUserPageDecryptedPatchToResponseField(
      responseRecord.answer,
      decryptedAnswer
    );
  }
  if (shouldPatchAdditional) {
    nextResponse.additional = applyUserPageDecryptedPatchToResponseField(
      responseRecord.additional,
      decryptedAdditional
    );
  }
  return nextResponse;
};

export const buildUserPageResponseDecryptSurveyBindings = ({
  detailedSurveyResponses = null,
  hashZero = '',
  questionId = '',
  questionResponseInfo = [],
  responseOverride = null,
}: BuildUserPageResponseDecryptSurveyBindingsInput = {}): UserPageResponseDecryptSurveyBindings => {
  const qid = String(questionId || '').trim().toLowerCase();
  const surveyIds: string[] = [];
  const seen = new Set<string>();
  const pushSurveyId = (value: unknown): void => {
    const normalized = String(value || '').trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    surveyIds.push(normalized);
  };
  const addFromEntry = (entry: unknown): void => {
    const entryRecord = toAnalysisRecord(entry);
    if (!Object.keys(entryRecord).length) return;
    pushSurveyId(entryRecord.associatedSurveyId);
    pushSurveyId(entryRecord.surveyId);
    pushSurveyId(entryRecord.surveyID);
  };

  addFromEntry(responseOverride);

  const responseInfoEntries = Array.isArray(questionResponseInfo)
    ? questionResponseInfo
    : [];
  responseInfoEntries.forEach((entry: unknown) => {
    const entryRecord = toAnalysisRecord(entry);
    if (String(entryRecord.id || '').trim().toLowerCase() !== qid) return;
    addFromEntry(entryRecord);
  });

  const detailedResponsesRecord = toAnalysisRecord(detailedSurveyResponses);
  Object.keys(detailedResponsesRecord).forEach((surveyId: string) => {
    const entries = Array.isArray(detailedResponsesRecord[surveyId])
      ? detailedResponsesRecord[surveyId]
      : [];
    entries.forEach((entry: unknown) => {
      const entryRecord = toAnalysisRecord(entry);
      const questionData = toAnalysisRecord(entryRecord.questionData);
      const responseData = entryRecord.responseData;
      const entryQid = String(questionData.id || questionData.questionID || '').trim().toLowerCase();
      if (responseData !== responseOverride && entryQid !== qid) return;
      pushSurveyId(surveyId);
      addFromEntry(questionData);
      addFromEntry(responseData);
    });
  });

  pushSurveyId(hashZero);
  return {
    surveyId: surveyIds[0] || String(hashZero || ''),
    acceptedSurveyIds: surveyIds,
  };
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

export const buildUserPageDeepScanTooltipInputSignature = ({
  latestBlockNumber,
  listNamespaceSlugs = () => [],
  network = null,
  peekCache = () => null,
  viewAddress = '',
}: BuildUserPageDeepScanTooltipInputSignatureArgs = {}): string => {
  const viewLower = String(viewAddress || '').toLowerCase();
  if (!viewLower) return '';
  const latestBlockNum = Number.isFinite(Number(latestBlockNumber))
    ? Number(latestBlockNumber)
    : '';
  const networkRecord = toAnalysisRecord(network);
  const currentChainId = networkRecord.id != null
    ? Number(networkRecord.id)
    : '';
  const slugs = listNamespaceSlugs('userCache')
    .map((slug: unknown) => String(slug || '').trim())
    .sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0));
  const slugProgress = slugs
    .map((slug) => {
      const cacheEntry = peekCache('userCache', slug, { clone: false });
      const userNode = toAnalysisRecord(toAnalysisRecord(cacheEntry)[viewLower]);
      if (!Object.keys(userNode).length) return `${slug}:`;
      const netParts = Object.keys(userNode)
        .sort((a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0))
        .map((netKey) => {
          const entry = toAnalysisRecord(userNode?.[netKey]);
          const lastBlock = Number(entry?.lastBlockScanned);
          const lastScanTs = Number(entry?.lastScanTimestamp);
          const blockToken = Number.isFinite(lastBlock) ? String(lastBlock) : '';
          const tsToken = Number.isFinite(lastScanTs) ? String(lastScanTs) : '';
          return `${netKey}:${blockToken}:${tsToken}`;
        })
        .join(',');
      return `${slug}:${netParts}`;
    })
    .join(';');
  return [
    viewLower,
    String(currentChainId),
    String(latestBlockNum),
    slugProgress,
  ].join('|');
};

export const buildUserPageDeepScanPrioritySlugs = ({
  activeSessionSlug = '',
  getAllowedSessionSlugs: readAllowedSessionSlugs = () => [],
  readSessionScanScope: readScope = () => '',
  readSessionScanSlugs: readScopeSlugs = () => [],
}: BuildUserPageDeepScanPrioritySlugsArgs = {}): string[] => {
  const activeSlug = normalizeSessionSlug(activeSessionSlug || '');
  const scope = readScope();
  const shouldUseScopedOrder = (
    scope === 'list' ||
    scope === 'general' ||
    (scope === 'active' && !!activeSlug)
  );
  const scopedSlugs = shouldUseScopedOrder
    ? readAllowedSessionSlugs(scope, readScopeSlugs(), activeSlug)
    : [];
  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (rawSlug: unknown) => {
    const slug = normalizeSessionSlug(rawSlug || '');
    if (seen.has(slug)) return;
    seen.add(slug);
    ordered.push(slug);
  };

  if (scope === 'list') {
    const normalizedScopeSlugs = scopedSlugs.map((slug: unknown) => normalizeSessionSlug(slug || ''));
    const activeInScope = !!(activeSlug && normalizedScopeSlugs.includes(activeSlug));
    if (activeSlug && !activeInScope) {
      push(activeSlug);
    }
    normalizedScopeSlugs.forEach((slug) => push(slug));
    return ordered;
  }

  if (activeSlug) {
    push(activeSlug);
  }
  scopedSlugs.forEach((slug: unknown) => push(slug));
  return ordered;
};

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

export const resolveUserPageDeepScanSessionDisplayConfig = ({
  getDemoSessionConfigBySlug: readDemoSessionConfig = () => null,
  getSessionConfigBySlug: readSessionConfig = () => null,
  getSessionConfigBySlugOrDefault: readDefaultSessionConfig = () => null,
  slugIn = '',
}: ResolveUserPageDeepScanSessionDisplayConfigArgs = {}): UserPageUnknownRecord | null => {
  const slug = normalizeSessionSlug(slugIn || '');
  if (!slug) {
    const cfg = readDefaultSessionConfig('')
      || readDemoSessionConfig('', { allowDemoFallback: true });
    return isPlainAnalysisObject(cfg) ? cfg : null;
  }
  const cfg = readSessionConfig(slug)
    || readDemoSessionConfig(slug, { allowDemoFallback: true });
  return isPlainAnalysisObject(cfg) ? cfg : null;
};

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

export type UserPageDeepScanProgressRow = {
  slug: string;
  chainId: number | null;
  lastBlockScanned: number;
  latestBlock: number | null;
  remainingBlocks: number | null;
  percentComplete: number | null;
  isDeterminate: boolean;
  label: string;
  startBlock: number | null;
  displayLastBlock: number;
};

type UserPageDeepScanProgressSortableRow = UserPageDeepScanProgressRow & {
  __sourceIndex: number;
};
type BuildUserPageDeepScanProgressRowArgs = {
  chainId?: number | null;
  lastBlock?: unknown;
  latestBlock?: number | null;
  sessionConfig?: unknown;
  slug?: unknown;
  slugHasMultipleNetworks?: unknown;
  startBlock?: number | null;
};
type BuildUserPageDeepScanProgressRowDisplayStateArgs = {
  formatBlockCount?: (value: unknown) => string;
  index?: unknown;
  row?: Partial<UserPageDeepScanProgressRow> | null;
  showScannedText?: unknown;
};
type UserPageDeepScanProgressRowDisplayState = {
  indeterminateText: string;
  progressFillStyle: Record<string, string>;
  progressWidth: string;
  remainingText: string;
  rowKey: string;
  scannedText: string;
  shouldRenderScannedText: boolean;
};
type BuildUserPageDeepScanReportSignatureArgs = {
  report?: unknown;
  reportTargetLower?: unknown;
};
type BuildUserPageDeepScanReportStatusArgs = {
  report?: unknown;
};
type BuildUserPageDeepScanReportTelemetryPayloadsArgs = {
  report?: unknown;
  status?: Partial<UserPageDeepScanReportStatus> | null;
  viewAddress?: unknown;
};
type BuildUserPageDeepScanReportStatePatchArgs = {
  hasUncertainSbtData?: unknown;
  hasUncertainUserData?: unknown;
};
type ShouldApplyUserPageDeepScanResponseArgs = {
  activeRequestSeq?: unknown;
  currentViewAddress?: unknown;
  isMounted?: unknown;
  requestSeq?: unknown;
  targetLower?: unknown;
};
type BuildUserPageDeepScanReportSamplesArgs = {
  limit?: unknown;
  report?: unknown;
};
type UserPageDeepScanReportSamples = {
  sampleCreatedQuestionIds: unknown[];
  sampleCreatedSurveyIds: unknown[];
  sampleQuestionResponseIds: unknown[];
  sampleSbtAddresses: unknown[];
  sampleSurveyResponseIds: unknown[];
};
type UserPageDeepScanReportStatus = {
  attemptedSlugs: unknown[];
  failedActivitySlugs: unknown[];
  failedSlugs: unknown[];
  hasCoverageGap: boolean;
  hasUncertainSbtData: boolean;
  hasUncertainUserData: boolean;
  rawHadRpcErrors: boolean;
  scannedSlugs: unknown[];
  skippedSlugs: unknown[];
  totalActivityFailure: boolean;
  totalSbtFailure: boolean;
  totalSkippedScan: boolean;
};
type UserPageDeepScanReportTelemetryPayloads = {
  coldDiagPayload: UserPageUnknownRecord;
  telemetryPayload: UserPageUnknownRecord;
};
type UserPageDeepScanProgressEntry = {
  slug: string;
  chainId: number | null;
  lastBlock: number;
  latestBlock: number | null;
  startBlock: number | null;
  sessionConfig: unknown | null;
};
type DeriveUserPageDeepScanProgressRowsArgs = {
  currentChainId?: unknown;
  getSessionDisplayConfig?: ((slug: string) => unknown) | null;
  latestBlockNum?: unknown;
  prioritySlugs?: unknown;
  userCaches?: unknown;
  viewLower?: unknown;
};

export const formatUserPageDeepScanBlockCount = (value: unknown): string => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '0';
  return Math.max(0, Math.floor(numericValue)).toLocaleString();
};

export const buildUserPageDeepScanProgressRowDisplayState = ({
  formatBlockCount = formatUserPageDeepScanBlockCount,
  index = 0,
  row = null,
  showScannedText = true,
}: BuildUserPageDeepScanProgressRowDisplayStateArgs = {}): UserPageDeepScanProgressRowDisplayState => {
  const rowValue = row || {};
  const progressWidth = Number.isFinite(Number(rowValue.percentComplete))
    ? `${Math.max(0, Math.min(100, Number(rowValue.percentComplete)))}%`
    : '0%';
  const remainingText = Number(rowValue.remainingBlocks || 0) <= 0
    ? 'Up to date'
    : `${formatBlockCount(rowValue.remainingBlocks)} blocks remaining`;
  const scannedText = rowValue.latestBlock != null
    ? `${formatBlockCount(rowValue.displayLastBlock)} / ${formatBlockCount(rowValue.latestBlock)} scanned`
    : '';
  const indeterminateText = showScannedText !== false
    ? `${formatBlockCount(rowValue.lastBlockScanned)} scanned`
    : 'Syncing... latest block pending';

  return {
    indeterminateText,
    progressFillStyle: { width: progressWidth },
    progressWidth,
    remainingText,
    rowKey: `${rowValue.slug || 'general'}_${rowValue.chainId || 'na'}_${index}`,
    scannedText,
    shouldRenderScannedText: showScannedText !== false && !!scannedText,
  };
};

export const buildUserPageDeepScanProgressRow = ({
  chainId = null,
  lastBlock = 0,
  latestBlock = null,
  sessionConfig = null,
  slug = 'general',
  slugHasMultipleNetworks = false,
  startBlock = null,
}: BuildUserPageDeepScanProgressRowArgs = {}): UserPageDeepScanProgressRow => {
  const slugValue = String(slug || 'general');
  const slugLabel = normalizeSessionSlug(slugValue || '') || 'general';
  const sessionRecord = toAnalysisRecord(sessionConfig);
  const sessionName = String(sessionRecord.sessionName || '').trim();
  const baseLabel = sessionName && sessionName.toLowerCase() !== slugLabel.toLowerCase()
    ? `${sessionName} (${slugLabel})`
    : (sessionName || slugValue || 'General');
  const label = slugHasMultipleNetworks && chainId != null
    ? `${baseLabel} (chain ${chainId})`
    : baseLabel;
  const normalizedLatestBlock = latestBlock != null
    ? Math.max(0, Math.floor(Number(latestBlock)))
    : null;
  const lastBlockScanned = Math.max(0, Math.floor(Number(lastBlock)));
  const displayLastBlock = startBlock != null
    ? Math.max(startBlock, lastBlockScanned)
    : lastBlockScanned;
  const remainingBlocks = normalizedLatestBlock != null
    ? Math.max(0, normalizedLatestBlock - displayLastBlock)
    : null;
  let percentComplete: number | null = null;
  let isDeterminate = false;

  if (normalizedLatestBlock != null && startBlock != null) {
    const totalSpan = Math.max(0, normalizedLatestBlock - startBlock);
    const completedSpan = Math.max(0, displayLastBlock - startBlock);
    percentComplete = totalSpan <= 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((completedSpan / totalSpan) * 100)));
    isDeterminate = true;
  }

  return {
    slug: slugValue,
    chainId,
    lastBlockScanned,
    latestBlock: normalizedLatestBlock,
    remainingBlocks,
    percentComplete,
    isDeterminate,
    label,
    startBlock,
    displayLastBlock,
  };
};

export const buildUserPageDeepScanReportSignature = ({
  report = {},
  reportTargetLower = '',
}: BuildUserPageDeepScanReportSignatureArgs = {}): string => {
  const scanReport = toAnalysisRecord(report);
  const readSlugList = (key: string): string => (
    Array.isArray(scanReport[key]) ? (scanReport[key] as unknown[]).join(',') : ''
  );
  const coverageComplete = Object.prototype.hasOwnProperty.call(scanReport, 'coverageComplete')
    ? String(scanReport.coverageComplete === true ? 1 : 0)
    : '';
  return [
    String(reportTargetLower || ''),
    String(scanReport.hadRpcErrors ? 1 : 0),
    String(scanReport.coverageReason || ''),
    coverageComplete,
    readSlugList('attemptedSlugs'),
    readSlugList('scannedSlugs'),
    readSlugList('skippedSlugs'),
    readSlugList('failedSlugs'),
    readSlugList('failedActivitySlugs'),
  ].join('|');
};

export const buildUserPageDeepScanReportStatus = ({
  report = {},
}: BuildUserPageDeepScanReportStatusArgs = {}): UserPageDeepScanReportStatus => {
  const reportRecord = toAnalysisRecord(report);
  const attemptedSlugs = Array.isArray(reportRecord.attemptedSlugs) ? [...reportRecord.attemptedSlugs] : [];
  const scannedSlugs = Array.isArray(reportRecord.scannedSlugs) ? [...reportRecord.scannedSlugs] : [];
  const skippedSlugs = Array.isArray(reportRecord.skippedSlugs) ? [...reportRecord.skippedSlugs] : [];
  const failedSlugs = Array.isArray(reportRecord.failedSlugs) ? [...reportRecord.failedSlugs] : [];
  const failedActivitySlugs = Array.isArray(reportRecord.failedActivitySlugs) ? [...reportRecord.failedActivitySlugs] : [];
  const rawHadRpcErrors = !!reportRecord.hadRpcErrors;
  const totalActivityFailure = (
    attemptedSlugs.length > 0 &&
    scannedSlugs.length === 0 &&
    failedActivitySlugs.length >= attemptedSlugs.length
  );
  const totalSbtFailure = (
    attemptedSlugs.length > 0 &&
    scannedSlugs.length === 0 &&
    failedSlugs.length >= attemptedSlugs.length
  );
  const totalSkippedScan = (
    attemptedSlugs.length > 0 &&
    scannedSlugs.length === 0 &&
    skippedSlugs.length >= attemptedSlugs.length
  );
  const hasCoverageGap = Object.prototype.hasOwnProperty.call(reportRecord, 'coverageComplete')
    ? reportRecord.coverageComplete === false
    : false;
  const hasPartialRpcFailureEvidence = !!(
    rawHadRpcErrors &&
    !totalActivityFailure &&
    !totalSbtFailure &&
    !totalSkippedScan &&
    (
      failedSlugs.length > 0 ||
      failedActivitySlugs.length > 0 ||
      (attemptedSlugs.length > 0 && scannedSlugs.length < attemptedSlugs.length)
    )
  );
  const hasPartialSbtFailureEvidence = !!(
    rawHadRpcErrors &&
    failedSlugs.length > 0 &&
    !totalSbtFailure &&
    !totalSkippedScan
  );
  const hasUncertainUserData = !!(
    hasCoverageGap ||
    totalActivityFailure ||
    totalSbtFailure ||
    totalSkippedScan ||
    hasPartialRpcFailureEvidence
  );
  const hasUncertainSbtData = !!(
    totalSbtFailure ||
    totalSkippedScan ||
    hasPartialSbtFailureEvidence ||
    (hasCoverageGap && !totalActivityFailure && !totalSbtFailure && !totalSkippedScan)
  );

  return {
    attemptedSlugs,
    scannedSlugs,
    skippedSlugs,
    failedSlugs,
    failedActivitySlugs,
    rawHadRpcErrors,
    totalActivityFailure,
    totalSbtFailure,
    totalSkippedScan,
    hasCoverageGap,
    hasUncertainUserData,
    hasUncertainSbtData,
  };
};

export const buildUserPageDeepScanReportTelemetryPayloads = ({
  report = {},
  status = null,
  viewAddress = '',
}: BuildUserPageDeepScanReportTelemetryPayloadsArgs = {}): UserPageDeepScanReportTelemetryPayloads => {
  const reportRecord = toAnalysisRecord(report);
  const reportStatus = (status && typeof status === 'object')
    ? status as Partial<UserPageDeepScanReportStatus>
    : buildUserPageDeepScanReportStatus({ report: reportRecord });
  const attemptedSlugs = Array.isArray(reportStatus.attemptedSlugs) ? reportStatus.attemptedSlugs : [];
  const scannedSlugs = Array.isArray(reportStatus.scannedSlugs) ? reportStatus.scannedSlugs : [];
  const skippedSlugs = Array.isArray(reportStatus.skippedSlugs) ? reportStatus.skippedSlugs : [];
  const failedSlugs = Array.isArray(reportStatus.failedSlugs) ? reportStatus.failedSlugs : [];
  const failedActivitySlugs = Array.isArray(reportStatus.failedActivitySlugs)
    ? reportStatus.failedActivitySlugs
    : [];
  const rawHadRpcErrors = !!reportStatus.rawHadRpcErrors;
  const totalActivityFailure = !!reportStatus.totalActivityFailure;
  const totalSbtFailure = !!reportStatus.totalSbtFailure;
  const totalSkippedScan = !!reportStatus.totalSkippedScan;
  const hasCoverageGap = !!reportStatus.hasCoverageGap;
  const hasUncertainUserData = !!reportStatus.hasUncertainUserData;
  const hasUncertainSbtData = !!reportStatus.hasUncertainSbtData;
  const viewAddressLower = String(viewAddress || '').toLowerCase();

  return {
    coldDiagPayload: {
      viewAddress: viewAddressLower,
      attemptedSlugs,
      scannedSlugs,
      skippedSlugs,
      failedSlugs,
      failedActivitySlugs,
      anyNewData: !!reportRecord.anyNewData,
      coverageComplete: reportRecord.coverageComplete,
      coverageReason: reportRecord.coverageReason,
      hasUncertainUserData,
      hasUncertainSbtData,
      totalActivityFailure,
      totalSbtFailure,
      totalSkippedScan,
      hasCoverageGap,
      totalSbtContractsFound: reportRecord.totalSbtContractsFound,
      totalCreatedSurveysFound: reportRecord.totalCreatedSurveysFound,
      totalCreatedQuestionsFound: reportRecord.totalCreatedQuestionsFound,
      totalSurveyResponsesFound: reportRecord.totalSurveyResponsesFound,
      totalQuestionResponsesFound: reportRecord.totalQuestionResponsesFound,
    },
    telemetryPayload: {
      viewAddress: viewAddressLower,
      hadRpcErrors: rawHadRpcErrors,
      hasUncertainUserData,
      hasUncertainSbtData,
      totalActivityFailure,
      totalSbtFailure,
      totalSkippedScan,
      usedAllSessions: !!reportRecord.usedAllSessions,
      coverageComplete: Object.prototype.hasOwnProperty.call(reportRecord, 'coverageComplete')
        ? !!reportRecord.coverageComplete
        : null,
      coverageReason: String(reportRecord.coverageReason || ''),
      attemptedSlugs,
      scannedSlugs,
      skippedSlugs,
      failedSlugs,
      failedActivitySlugs,
      registryEntryCount: Number(reportRecord.registryEntryCount || 0),
      anyNewData: !!reportRecord.anyNewData,
      totalSbtContractsFound: Number(reportRecord.totalSbtContractsFound || 0),
      totalCreatedSurveysFound: Number(reportRecord.totalCreatedSurveysFound || 0),
      totalCreatedQuestionsFound: Number(reportRecord.totalCreatedQuestionsFound || 0),
      totalSurveyResponsesFound: Number(reportRecord.totalSurveyResponsesFound || 0),
      totalQuestionResponsesFound: Number(reportRecord.totalQuestionResponsesFound || 0),
      ...buildUserPageDeepScanReportSamples({ report: reportRecord }),
    },
  };
};

export const buildUserPageDeepScanRequestStatePatch = (): UserPageUnknownRecord => ({
  isDeepScanning: true,
  hasUncertainUserData: false,
  hasUncertainSbtData: false,
  hasUncertainGateAccess: false,
});

export const buildUserPageDeepScanReportStatePatch = ({
  hasUncertainSbtData = false,
  hasUncertainUserData = false,
}: BuildUserPageDeepScanReportStatePatchArgs = {}): UserPageUnknownRecord => ({
  isDeepScanning: false,
  hasUncertainUserData: !!hasUncertainUserData,
  hasUncertainSbtData: !!hasUncertainSbtData,
  hasUncertainGateAccess: false,
});

export const shouldApplyUserPageDeepScanResponse = ({
  activeRequestSeq = null,
  currentViewAddress = '',
  isMounted = false,
  requestSeq = null,
  targetLower = '',
}: ShouldApplyUserPageDeepScanResponseArgs = {}): boolean => {
  if (!isMounted || requestSeq !== activeRequestSeq) return false;
  const currentViewLower = String(currentViewAddress || '').toLowerCase();
  if (!currentViewLower || currentViewLower !== String(targetLower || '')) return false;
  return true;
};

export const buildUserPageDeepScanReportSamples = ({
  limit = 12,
  report = {},
}: BuildUserPageDeepScanReportSamplesArgs = {}): UserPageDeepScanReportSamples => {
  const reportRecord = toAnalysisRecord(report);
  const sampleLimit = Math.max(0, Math.floor(Number(limit || 0)) || 0);
  const readSample = (key: string): unknown[] => (
    Array.isArray(reportRecord[key])
      ? (reportRecord[key] as unknown[]).slice(0, sampleLimit)
      : []
  );
  return {
    sampleSbtAddresses: readSample('sampleSbtAddresses'),
    sampleCreatedSurveyIds: readSample('sampleCreatedSurveyIds'),
    sampleCreatedQuestionIds: readSample('sampleCreatedQuestionIds'),
    sampleSurveyResponseIds: readSample('sampleSurveyResponseIds'),
    sampleQuestionResponseIds: readSample('sampleQuestionResponseIds'),
  };
};

export const sortUserPageDeepScanProgressRows = (
  rows: UserPageDeepScanProgressRow[] | null | undefined,
  prioritySlugs: unknown = []
): UserPageDeepScanProgressRow[] | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const priorityBySlug = new Map<string, number>();
  (Array.isArray(prioritySlugs) ? prioritySlugs : []).forEach((slug, index) => {
    priorityBySlug.set(normalizeSessionSlug(slug || ''), index);
  });

  return rows
    .map<UserPageDeepScanProgressSortableRow>((row, index) => ({ ...row, __sourceIndex: index }))
    .sort((left, right) => {
      const leftSlug = normalizeSessionSlug(left?.slug || '');
      const rightSlug = normalizeSessionSlug(right?.slug || '');
      const leftPriority = priorityBySlug.get(leftSlug) ?? Number.MAX_SAFE_INTEGER;
      const rightPriority = priorityBySlug.get(rightSlug) ?? Number.MAX_SAFE_INTEGER;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;

      const leftNeedsAttention = left?.latestBlock == null || Number(left?.remainingBlocks || 0) > 0;
      const rightNeedsAttention = right?.latestBlock == null || Number(right?.remainingBlocks || 0) > 0;
      if (leftNeedsAttention !== rightNeedsAttention) {
        return leftNeedsAttention ? -1 : 1;
      }

      const leftLastBlock = Number(left?.lastBlockScanned || 0);
      const rightLastBlock = Number(right?.lastBlockScanned || 0);
      if (rightLastBlock !== leftLastBlock) return rightLastBlock - leftLastBlock;

      const leftLabel = String(left?.label || leftSlug || '');
      const rightLabel = String(right?.label || rightSlug || '');
      const labelCmp = leftLabel.localeCompare(rightLabel);
      if (labelCmp !== 0) return labelCmp;

      const leftChain = Number(left?.chainId || 0);
      const rightChain = Number(right?.chainId || 0);
      if (leftChain !== rightChain) return leftChain - rightChain;

      return Number(left.__sourceIndex || 0) - Number(right.__sourceIndex || 0);
    })
    .map(({ __sourceIndex, ...row }) => row);
};

export const deriveUserPageDeepScanProgressRows = ({
  currentChainId = null,
  getSessionDisplayConfig = null,
  latestBlockNum = null,
  prioritySlugs = [],
  userCaches = [],
  viewLower = '',
}: DeriveUserPageDeepScanProgressRowsArgs = {}): UserPageDeepScanProgressRow[] | null => {
  const viewAddressLower = String(viewLower || '').toLowerCase();
  if (!Array.isArray(userCaches) || userCaches.length === 0 || !viewAddressLower) return null;

  const currentChainNumeric = currentChainId != null && Number.isFinite(Number(currentChainId))
    ? Number(currentChainId)
    : null;
  const latestBlockNumeric = latestBlockNum != null && Number.isFinite(Number(latestBlockNum))
    ? Number(latestBlockNum)
    : null;
  const readSessionDisplayConfig = typeof getSessionDisplayConfig === 'function'
    ? getSessionDisplayConfig
    : (() => null);
  const entries: UserPageDeepScanProgressEntry[] = [];
  const sessionConfigMemo = new Map<string, unknown | null>();

  userCaches.forEach((entry: unknown) => {
    const source = toAnalysisRecord(entry);
    const slug = source.slug;
    const data = toAnalysisRecord(source.data);
    const userNode = toAnalysisRecord(data[viewAddressLower]);
    if (!Object.keys(userNode).length) return;
    Object.keys(userNode).forEach((netKey) => {
      const chainEntry = toAnalysisRecord(userNode?.[netKey]);
      const lastBlock = Number(chainEntry?.lastBlockScanned);
      if (!Number.isFinite(lastBlock) || lastBlock <= 0) return;

      let latestForPct: number | null = null;
      if (
        latestBlockNumeric != null &&
        currentChainNumeric != null &&
        Number(netKey) === Number(currentChainNumeric) &&
        latestBlockNumeric > 0
      ) {
        latestForPct = latestBlockNumeric;
      }

      const normalizedSlug = normalizeSessionSlug(slug || '');
      const sessionMemoKey = normalizedSlug || '__general__';
      let sessionConfig: unknown | null = null;
      if (sessionConfigMemo.has(sessionMemoKey)) {
        sessionConfig = sessionConfigMemo.get(sessionMemoKey) || null;
      } else {
        sessionConfig = readSessionDisplayConfig(normalizedSlug);
        sessionConfigMemo.set(sessionMemoKey, sessionConfig);
      }

      const blockLimits = toAnalysisRecord(toAnalysisRecord(sessionConfig).blockLimits);
      const startRaw = Number(blockLimits.start);
      const startBlock = Number.isFinite(startRaw) && startRaw > 0
        ? Math.floor(startRaw)
        : null;

      entries.push({
        slug: String(slug || 'general'),
        chainId: Number.isFinite(Number(netKey)) ? Number(netKey) : null,
        lastBlock,
        latestBlock: latestForPct,
        startBlock,
        sessionConfig,
      });
    });
  });

  if (entries.length === 0) return null;
  entries.sort((a, b) => b.lastBlock - a.lastBlock);
  const slugCounts = entries.reduce<Map<string, number>>((counts, entry) => {
    counts.set(entry.slug, (counts.get(entry.slug) || 0) + 1);
    return counts;
  }, new Map());
  const rows = entries.map<UserPageDeepScanProgressRow>((entry) => {
    const slugHasMultipleNetworks = (slugCounts.get(entry.slug) || 0) > 1;
    return buildUserPageDeepScanProgressRow({
      slug: entry.slug,
      chainId: entry.chainId,
      lastBlock: entry.lastBlock,
      latestBlock: entry.latestBlock,
      sessionConfig: entry.sessionConfig,
      slugHasMultipleNetworks,
      startBlock: entry.startBlock,
    });
  });
  return sortUserPageDeepScanProgressRows(rows, prioritySlugs);
};

export const formatUserPageDeepScanTooltipLinesFromRows = (
  rows: UserPageDeepScanProgressRow[] | null | undefined,
  formatBlockCount: (value: unknown) => string = formatUserPageDeepScanBlockCount
): string[] | null => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const lines: string[] = [];
  rows.forEach((row, index) => {
    lines.push(`Session: ${row.label}`);
    if (row.latestBlock != null) {
      if (Number(row.remainingBlocks || 0) <= 100) {
        lines.push('Up to date');
      } else {
        lines.push(`${formatBlockCount(row.remainingBlocks)} blocks remaining`);
      }
    } else {
      lines.push(`${formatBlockCount(row.lastBlockScanned)} scanned`);
    }
    if (index < rows.length - 1) lines.push('');
  });
  return lines;
};

export const buildUserPageDeepScanTooltipDisplayState = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
  fallbackLine = 'Deep scan in progress...',
  isDeepScanning = false,
}: BuildUserPageDeepScanTooltipDisplayStateArgs = {}): UserPageDeepScanTooltipDisplayState => {
  const deepScanTooltipContent =
    isDeepScanning ||
    (Array.isArray(deepScanTooltipLines) && deepScanTooltipLines.length > 0) ||
    (Array.isArray(deepScanProgressRows) && deepScanProgressRows.length > 0)
      ? (deepScanTooltipLines || [fallbackLine])
      : null;
  const deepScanTooltipText = Array.isArray(deepScanTooltipContent)
    ? deepScanTooltipContent
      .filter((line: string) => line && line.trim().length > 0)
      .join(' | ')
    : '';
  const deepScanTooltipTitle = deepScanTooltipText
    ? `Deep scan: ${deepScanTooltipText}`
    : '';

  return {
    deepScanTooltipContent,
    deepScanTooltipText,
    deepScanTooltipTitle,
  };
};

export const buildUserPageRenderLoadingState = ({
  isDeepScanLoadingEnabledForSection = null,
  isDeepScanning = false,
  isQuestionCacheReady = false,
  isResponsesCacheReady = false,
  isSBTCacheReady = false,
  isSurveyCacheReady = false,
  loadingQuestions = false,
  loadingSBTs = false,
  loadingSurveys = false,
}: BuildUserPageRenderLoadingStateArgs = {}): UserPageRenderLoadingState => {
  const isSBTReady = !!isSBTCacheReady;
  const isSurveyReady = !!isSurveyCacheReady;
  const isQuestionReady = !!isQuestionCacheReady;
  const isResponsesReady = !!isResponsesCacheReady;
  const deepScanActive = !!isDeepScanning;
  const sectionEnabled = typeof isDeepScanLoadingEnabledForSection === 'function'
    ? isDeepScanLoadingEnabledForSection
    : () => false;
  const surveyDeepScanLoadingActive = !!(sectionEnabled('surveys') && deepScanActive);
  const questionDeepScanLoadingActive = !!(sectionEnabled('questions') && deepScanActive);
  return {
    disabledByCache: !(isSBTReady && isSurveyReady && isQuestionReady && isResponsesReady),
    isQuestionLoadingAny: !!loadingQuestions || !isQuestionReady || !isResponsesReady || questionDeepScanLoadingActive,
    isQuestionReady,
    isResponsesReady,
    isSBTReady,
    isSbtLoadingAny: !!loadingSBTs || !isSBTReady || deepScanActive,
    isSurveyLoadingAny: !!loadingSurveys || !isSurveyReady || !isResponsesReady || surveyDeepScanLoadingActive,
    isSurveyReady,
    questionDeepScanLoadingActive,
    surveyDeepScanLoadingActive,
  };
};

export const resolveUserPageAiActionAvailability = ({
  aiAvailable = null,
  disabledByCache = false,
  walletLabel = 'wallet',
}: ResolveUserPageAiActionAvailabilityArgs = {}): UserPageAiActionAvailability => {
  if (aiAvailable === false) {
    return {
      disabled: true,
      title: `AI not available — connect a ${String(walletLabel || 'wallet')} or use a session with sponsored AI`,
    };
  }
  if (disabledByCache) {
    return {
      disabled: true,
      title: 'Available when the user page fully loads.',
    };
  }
  return {
    disabled: false,
    title: undefined,
  };
};

export const resolveUserPageAnalyzeButtonDisplayState = ({
  aiActionAvailability = null,
  analyzing = false,
}: ResolveUserPageAnalyzeButtonDisplayStateArgs = {}): UserPageAnalyzeButtonDisplayState => {
  const shouldRenderAnalyzing = !!analyzing;
  return {
    ariaBusy: shouldRenderAnalyzing ? 'true' : 'false',
    disabled: shouldRenderAnalyzing || !!aiActionAvailability?.disabled,
    label: shouldRenderAnalyzing ? 'Analyzing' : 'Analyze',
    shouldRenderAnalyzing,
    title: aiActionAvailability?.title,
  };
};

export const resolveUserPageCompareButtonDisplayState = ({
  aiActionAvailability = null,
  collapseOpen = false,
}: ResolveUserPageCompareButtonDisplayStateArgs = {}): UserPageCompareButtonDisplayState => {
  const shouldRenderCollapseOpenIcon = !!collapseOpen;
  return {
    disabled: !!aiActionAvailability?.disabled,
    shouldRenderCollapseClosedIcon: !shouldRenderCollapseOpenIcon,
    shouldRenderCollapseOpenIcon,
    title: aiActionAvailability?.title,
  };
};

export const resolveUserPageSectionToggleDisplayState = ({
  open = false,
}: ResolveUserPageSectionToggleDisplayStateArgs = {}): UserPageSectionToggleDisplayState => {
  const isOpen = !!open;
  return {
    isOpen,
    shouldRenderClosedIcon: !isOpen,
    shouldRenderOpenIcon: isOpen,
  };
};

export const buildUserPageSectionLoadingEmptyState = ({
  isQuestionLoadingAny = false,
  isQuestionReady = false,
  isSbtLoadingAny = false,
  isSurveyLoadingAny = false,
  isSurveyReady = false,
  loadingQuestions = false,
  loadingSurveys = false,
  questionCreationInfo = [],
  questionDeepScanLoadingActive = false,
  questionResponseInfo = [],
  sbtList = [],
  surveyCreationInfo = [],
  surveyDeepScanLoadingActive = false,
  surveyResponseInfo = [],
}: BuildUserPageSectionLoadingEmptyStateArgs = {}): UserPageSectionLoadingEmptyState => ({
  sbtSectionLoadingEmpty: Boolean(isSbtLoadingAny && sbtList.length === 0),
  surveyResponsesLoadingEmpty: Boolean(isSurveyLoadingAny && surveyResponseInfo.length === 0),
  surveysCreatedLoadingEmpty: Boolean((
    loadingSurveys ||
    !isSurveyReady ||
    surveyDeepScanLoadingActive
  ) && surveyCreationInfo.length === 0),
  questionResponsesLoadingEmpty: Boolean(isQuestionLoadingAny && questionResponseInfo.length === 0),
  questionsCreatedLoadingEmpty: Boolean((
    loadingQuestions ||
    !isQuestionReady ||
    questionDeepScanLoadingActive
  ) && questionCreationInfo.length === 0),
});

export const buildUserPageUncertainEmptyText = ({
  hasUncertainSbtData = false,
  hasUncertainUserData = false,
  sbtLabel = 'SBT',
  sbtsLowerLabel = 'SBTs',
}: BuildUserPageUncertainEmptyTextArgs = {}): UserPageUncertainEmptyText => ({
  questionResponsesEmptyText: hasUncertainUserData
    ? 'Question responses may be incomplete due scan/RPC issues. Try refresh.'
    : 'No question responses found.',
  sbtEmptyText: hasUncertainSbtData
    ? `${String(sbtLabel)} results may be incomplete due scan/RPC issues. Try refresh.`
    : `No ${String(sbtsLowerLabel)} found.`,
});

export const shouldRetryUserPageQuestionData = ({
  hasUncertainUserData = false,
  holdQuestionLoading = false,
  questionSection = null,
}: ShouldRetryUserPageQuestionDataArgs = {}): boolean => {
  if (!hasUncertainUserData) return false;
  if (holdQuestionLoading || !questionSection) return true;
  const section = isPlainAnalysisObject(questionSection) ? questionSection : {};
  const questionResponseInfo = section.questionResponseInfo;
  return !Array.isArray(questionResponseInfo) || questionResponseInfo.length === 0;
};

export const buildUserPageUncertaintyLoadingFlags = ({
  hasQuestionSources = false,
  hasSbtSources = false,
  hasSurveySources = false,
  keepQuestionLoadingDuringDeepScan = false,
  keepSurveyLoadingDuringDeepScan = false,
  prevState = null,
  uncertainResources = null,
}: BuildUserPageUncertaintyLoadingFlagsArgs = {}): UserPageUncertaintyLoadingFlags => {
  const prev = isPlainAnalysisObject(prevState) ? prevState : {};
  const resources = uncertainResources instanceof Set ? uncertainResources : new Set<string>();
  const preserveUserDataUncertainty = !!prev.hasUncertainUserData;
  const hasSurveyGateUncertainty = resources.has('surveyResponses');
  const hasQuestionGateUncertainty = resources.has('questionResponses');
  return {
    hasGateUncertainty: hasSurveyGateUncertainty || hasQuestionGateUncertainty,
    hasQuestionGateUncertainty,
    hasSurveyGateUncertainty,
    keepQuestionLoadingDuringDeepScan: !!keepQuestionLoadingDuringDeepScan,
    keepQuestionLoadingFromUserUncertainty: preserveUserDataUncertainty && (
      !!prev.isDeepScanning ||
      !hasQuestionSources
    ),
    keepSbtLoadingFromUserUncertainty: preserveUserDataUncertainty && (
      !!prev.isDeepScanning ||
      !hasSbtSources
    ),
    keepSurveyLoadingDuringDeepScan: !!keepSurveyLoadingDuringDeepScan,
    keepSurveyLoadingFromUserUncertainty: preserveUserDataUncertainty && (
      !!prev.isDeepScanning ||
      !hasSurveySources
    ),
    preserveUserDataUncertainty,
  };
};

export const buildUserPageDeepScanRefreshCarryPatch = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
  prevState = null,
}: BuildUserPageDeepScanRefreshCarryPatchArgs = {}): UserPageDeepScanRefreshCarryPatch => {
  const prev = isPlainAnalysisObject(prevState) ? prevState : {};
  const patch: UserPageDeepScanRefreshCarryPatch = {};
  if (
    deepScanTooltipLines != null ||
    (Array.isArray(prev.deepScanTooltipLines) && prev.deepScanTooltipLines.length > 0)
  ) {
    patch.deepScanTooltipLines = deepScanTooltipLines;
  }
  if (
    deepScanProgressRows != null ||
    (Array.isArray(prev.deepScanProgressRows) && prev.deepScanProgressRows.length > 0)
  ) {
    patch.deepScanProgressRows = deepScanProgressRows;
  }
  return patch;
};

export const buildUserPageUserStatsMergePatch = ({
  prevUserStats = {},
  userStatsPatch = {},
}: BuildUserPageUserStatsMergePatchArgs = {}): UserPageUnknownRecord | null => {
  const patch = isPlainAnalysisObject(userStatsPatch) ? userStatsPatch : {};
  if (Object.keys(patch).length === 0) return null;
  const previous = isPlainAnalysisObject(prevUserStats) ? prevUserStats : {};
  return { ...previous, ...patch };
};

export const buildUserPageProfileEditVisibility = ({
  account = '',
  cachedNickname = '',
  isEditingNickname = false,
  isEditingUsername = false,
  minimized = false,
  pendingNickname = '',
  viewAddress = '',
}: BuildUserPageProfileEditVisibilityArgs = {}): UserPageProfileEditVisibility => {
  const accountLower = String(account || '').toLowerCase();
  const viewAddressLower = String(viewAddress || '').toLowerCase();
  const isOwner = !!(accountLower && viewAddressLower && accountLower === viewAddressLower);
  const notOwnPage = !isOwner;
  return {
    hasNickForThis: Boolean(cachedNickname || pendingNickname),
    isOwner,
    notOwnPage,
    showPen: !minimized && notOwnPage && !isEditingNickname,
    showUsernamePen: !minimized && isOwner && !isEditingUsername,
  };
};

export const resolveUserPageHeaderActionVisibility = ({
  explorerUrl = '',
  isEditingNickname = false,
  isOwner = false,
  isSimulated = false,
  minimized = false,
  notOwnPage = false,
  propViewAddress = '',
}: ResolveUserPageHeaderActionVisibilityArgs = {}): UserPageHeaderActionVisibility => ({
  showBookmarkButton: !isSimulated && !!propViewAddress && !isOwner,
  showBookmarksLink: !!isOwner && !minimized,
  showCopyAddressButton: !isSimulated && !!propViewAddress,
  showExplorerLink: !!minimized && !!explorerUrl,
  showNicknameEditor: !!notOwnPage && !!isEditingNickname,
  showSimulatedBadge: !!isSimulated,
});

export const resolveUserPageAddressDisplayState = ({
  bookmarked = false,
  cachedNickname = '',
  explorerUrl = '',
  getShortenedAddress = null,
  isEditingNickname = false,
  isSimulated = false,
  minimized = false,
  nicknameInput = '',
  propViewAddress = '',
  stateViewAddress = '',
  username = '',
}: ResolveUserPageAddressDisplayStateArgs = {}): UserPageAddressDisplayState => {
  const currentLower = String(propViewAddress || '').toLowerCase();
  const pendingNick = String(nicknameInput || '').trim();
  const stateViewLower = String(stateViewAddress || '').toLowerCase();
  const pendingNicknameForThis = (
    stateViewLower === currentLower &&
    (isEditingNickname || bookmarked)
  ) ? pendingNick : '';
  const nicknameToUse = String(cachedNickname || '') || pendingNicknameForThis;
  const profileUrl = propViewAddress ? `/u/${propViewAddress}` : '';
  const usernameText = String(username || '');
  const shortAddress = propViewAddress
    ? String(typeof getShortenedAddress === 'function'
      ? getShortenedAddress(propViewAddress, false)
      : propViewAddress)
    : '';
  const addressLabel = nicknameToUse ||
    (isSimulated && usernameText ? usernameText : '') ||
    (usernameText && !isSimulated ? usernameText : '') ||
    shortAddress;
  const addressHref = minimized ? profileUrl : String(explorerUrl || '');
  return {
    addressHref,
    addressLabel,
    nicknameToUse,
    pendingNicknameForThis,
    profileUrl,
    shouldLinkAddressLabel: !!addressHref,
  };
};

export const resolveUserPageBlockieSeed = ({
  propViewAddress = '',
  username = '',
}: ResolveUserPageBlockieSeedArgs = {}): string => (
  String(propViewAddress || '') || (username ? String(username) : 'contextengine-default-seed')
);

export const buildUserPageDeepScanProgressRowsSignature = (
  rows: UserPageDeepScanProgressRow[] | null | undefined
): string => {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  return rows
    .map((row) => [
      String(row?.slug || ''),
      String(row?.chainId ?? ''),
      String(row?.lastBlockScanned ?? ''),
      String(row?.latestBlock ?? ''),
      String(row?.remainingBlocks ?? ''),
      String(row?.percentComplete ?? ''),
      row?.isDeterminate ? '1' : '0',
      String(row?.label || ''),
    ].join(':'))
    .join('|');
};

export const buildUserPageDeepScanTooltipOutputSignature = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
}: BuildUserPageDeepScanTooltipOutputSignatureArgs = {}): string => (
  [
    Array.isArray(deepScanTooltipLines)
      ? deepScanTooltipLines.join('|')
      : '',
    buildUserPageDeepScanProgressRowsSignature(
      Array.isArray(deepScanProgressRows)
        ? deepScanProgressRows as UserPageDeepScanProgressRow[]
        : null
    ),
  ].join('||')
);

export const resolveUserPageDeepScanProgressStateUpdate = ({
  currentDeepScanProgressRows = null,
  currentDeepScanTooltipLines = null,
  nextDeepScanProgressRows = null,
  nextDeepScanTooltipLines = null,
}: ResolveUserPageDeepScanProgressStateUpdateArgs = {}): UserPageDeepScanProgressStateUpdate => {
  const previousSignature = buildUserPageDeepScanTooltipOutputSignature({
    deepScanProgressRows: currentDeepScanProgressRows,
    deepScanTooltipLines: currentDeepScanTooltipLines,
  });
  const nextOutputSignature = buildUserPageDeepScanTooltipOutputSignature({
    deepScanProgressRows: nextDeepScanProgressRows,
    deepScanTooltipLines: nextDeepScanTooltipLines,
  });
  return {
    nextOutputSignature,
    shouldUpdate: previousSignature !== nextOutputSignature,
  };
};

export const buildUserPageDeepScanProgressStatePatch = ({
  deepScanProgressRows = null,
  deepScanTooltipLines = null,
  now = Date.now(),
}: BuildUserPageDeepScanProgressStatePatchArgs = {}): UserPageUnknownRecord => ({
  deepScanProgressTick: Number(now || 0),
  deepScanTooltipLines: deepScanTooltipLines || null,
  deepScanProgressRows: deepScanProgressRows || null,
});

export const normalizeUserPageDeepScanTooltipLines = (lines: unknown): string[] | null => {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return lines.map((line: unknown) => String(line));
};

export const normalizeUserPageDeepScanProgressRows = (
  rows: unknown
): UserPageDeepScanProgressRow[] | null => (
  Array.isArray(rows) && rows.length > 0
    ? rows as UserPageDeepScanProgressRow[]
    : null
);
