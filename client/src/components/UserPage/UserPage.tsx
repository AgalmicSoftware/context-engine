/** @file UserPage.tsx */
import React, { Component } from 'react';
import styles from './UserPage.module.scss';
import {
  buildUserPageAnalysisAiOptions,
  buildUserPageAnalysisErrorStatePatch,
  buildUserPageAnalysisCacheReadDescriptor,
  buildUserPageAnalysisFingerprint,
  applyUserPageBookmarkToggle,
  applyUserPageBookmarkNicknameSave,
  buildUserPageCacheRefreshOptions,
  buildUserPageCacheRefreshRequestDescriptor,
  buildUserPageRefreshTelemetrySignature,
  buildUserPageRefreshTelemetrySnapshot,
  buildUserPageAnalysisCreatedQuestions,
  buildUserPageAnalysisCreatedSurveys,
  buildUserPageAnalysisCandidateLogRows,
  buildUserPageAnalysisExcludeSlugSet,
  buildUserPageAnalysisElapsedStatePatch,
  buildUserPageAnalysisModalStatePatch,
  buildUserPageAnalysisQuestions,
  buildUserPageAnalysisResetStatePatch,
  buildUserPageAnalysisResultStatePatch,
  buildUserPageAnalysisSbts,
  buildUserPageAnalysisSurveys,
  buildUserPageAddressContextResetStatePatch,
  buildUserPageAiAvailabilityStatePatch,
  buildUserPageAiSessionSlugCandidates,
  buildUserPageBookmarkStatusStateUpdate,
  buildUserPageBookmarkToggleStatePatch,
  buildUserPageAiSessionScopeContext,
  buildUserPageBooleanTogglePatch,
  buildUserPageCacheRefreshStatePatch,
  buildUserPageCopiedStatePatch,
  buildUserPageDeepScanReportSignature,
  buildUserPageDeepScanReportStatus,
  buildUserPageDeepScanReportStatePatch,
  buildUserPageDeepScanReportTelemetryPayloads,
  buildUserPageDeepScanTooltipDisplayState,
  buildUserPageDeepScanProgressStatePatch,
  buildUserPageDeepScanPrioritySlugs,
  buildUserPageDeepScanRequestStatePatch,
  buildUserPageDeepScanTooltipInputSignature,
  buildUserPageDeriveTelemetrySnapshot,
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
  buildUserPageFullProfileModalStatePatch,
  buildUserPageMissingAddressCacheStatePatch,
  buildUserPageMissingAddressCacheStateUpdate,
  buildUserPageNicknameEditCancelStatePatch,
  buildUserPageNicknameEditOpenStatePatch,
  buildUserPageNicknameInputStatePatch,
  buildUserPageNicknameSaveStatePatch,
  buildUserPageNoSbtVisibleTelemetryState,
  buildUserPageResponseDecryptRequestPlan,
  buildUserPageResponseSectionDeriveMemoPlan,
  buildUserPageCacheRefreshDisplayState,
  buildUserPageSurveyResponseSourceDescriptor,
  buildUserPageCreatedQuestionWrapperClassName,
  buildUserPageHeaderBookmarkClassName,
  buildUserPageSbtSection,
  buildUserPageSbtSectionDeriveMemoPlan,
  buildUserPageSelectedTabStatePatch,
  buildUserPageSurveyExpansionTogglePatch,
  buildUserPageTooltipTargetIds,
  buildUserPageUnifiedCacheAggregateMemoPlan,
  buildUserPageUsernameChangeStatePatch,
  buildUserPageUsernameEditCancelStatePatch,
  buildUserPageUsernameEditOpenStatePatch,
  buildUserPageUsernameErrorStatePatch,
  buildUserPageUsernameLoadedStatePatch,
  buildUserPageUsernameSaveStatePatch,
  buildUserPageViewAddressStatePatch,
  deriveUserPageDeepScanProgressRows,
  extractUserPageResponseRecency,
  formatUserPageDeepScanBlockCount,
  formatUserPageDeepScanTooltipLinesFromRows,
  getActiveUserPageChainNode,
  getPrioritizedUserPageChainNodes,
  getPrioritizedUserPageNetworkCacheNodes,
  getUserPageErrorMessage,
  hasDisplayableUserPageResponsePayload,
  hasUserPageResponseSubmissionHints,
  inferUserPageResponseFieldEncryptionAudience,
  isPlainAnalysisObject,
  isUserPageAdditionalFieldEncrypted,
  isUserPageAnswerFieldEncrypted,
  isUserPageGateAccessContext,
  isUserPageQuestionPayloadEncrypted,
  isUserPageResponsePayloadEncrypted,
  mergeUserPageQuestionCacheSource,
  mergeUserPageSbtCacheEntryIntoAggregate,
  mergeUserPageSurveyCacheSource,
  mergeUserPageUserCacheSbtIntoAggregate,
  buildUserPageRootClassName,
  normalizeUserPageDeepScanProgressRows,
  normalizeUserPageDeepScanTooltipLines,
  normalizeUserAnalysisResult,
  normalizeUserPageBookmarksCache,
  normalizeUserPageGateSlug,
  normalizeUserPageQuestionResponseInfoOrder,
  normalizeUserPageSingleQuestionResponsePayload,
  mergeUserPageQueuedCacheRefreshFlags,
  parseUserPageCachedResponsePayload,
  readUserPageCacheSourceSnapshot,
  readUserPageNamespaceSourceEntries,
  readBoolishUserPageTelemetryFlag,
  readUserPageAnalysisCreatedSurveyCachesThroughPort,
  readUserPageAnalysisCacheThroughPort,
  dispatchUserPageGateAccessCheckThroughPort,
  resolveUserPageAnalysisAiContext,
  resolveUserPageAnalysisCacheStatusState,
  resolveUserPageAnalysisModalDisplayState,
  resolveUserPageAnalysisSessionConfigForSlug,
  resolveUserPageAnalysisSessionFallback,
  resolveUserPageAddressDisplayState,
  resolveUserPageAiAvailabilityRefresh,
  resolveUserPageAvatarDisplayState,
  resolveUserPageBlockieSeed,
  resolveUserPageBookmarkButtonDisplayState,
  resolveUserPageBookmarkNickname,
  resolveUserPageBookmarkStatus,
  resolveUserPageBookmarksLinkDisplayState,
  resolveUserPageCopyIconDisplayState,
  resolveUserPageInlineEnteredIndicatorDisplayState,
  resolveUserPageFullProfileModalDisplayState,
  resolveUserPageHeaderPassiveDisplayState,
  resolveUserPageQuestionSectionDisplayState,
  resolveUserPageSbtDisplayState,
  resolveUserPageSurveySectionDisplayState,
  resolveUserPageDeepScanSessionDisplayConfig,
  resolveUserPageDeepScanProgressStateUpdate,
  resolveUserPageAddressContextChange,
  resolveUserPageCacheUpdateRefresh,
  resolveUserPageManagedCacheUpdate,
  resolveUserPageQuestionPromptText,
  resolveUserPageQuestionSourceSessionSlug,
  resolveUserPageResponseNonceRefresh,
  resolveUserPageSectionToggleDisplayState,
  resolveUserPageUsernameErrorDisplayState,
  shouldApplyUserPageDeepScanResponse,
  shouldRetryUserPageQuestionData,
  toAnalysisRecord,
  upsertUserPageResponseByRecency,
  writeUserPageAnalysisCacheThroughPort,
  writeUserPageSourceSlug,
  type UserPageAnalysisCacheReadDescriptor,
  type UserPageAnalysisFingerprintInput,
  type UserPageAiSessionScopeContext,
  type UserPageBookmarksCache,
  type UserPageEffectiveAiConfigRequest,
  type UserPageEffectiveAiConfigResult,
  type UserPageSourceSlugMap,
} from './userPageHelpers';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import UserPageAnalysisModal from './UserPageAnalysisModal';
import UserPageComparePanel from './UserPageComparePanel';
import UserPageDeepScanStatusIndicator from './UserPageDeepScanStatusIndicator';
import UserPageFullProfileModal from './UserPageFullProfileModal';
import UserPageHeader from './UserPageHeader';
import { renderUserPageMembershipSections } from './UserPageMembershipSections';
import UserPageQuestionSection from './UserPageQuestionSection';
import UserPageSimulatedActions from './UserPageSimulatedActions';
import UserPageSurveySection from './UserPageSurveySection';
import {
  runUserPageAnalyzeActionController,
  runUserPageBookmarkActionController,
  runUserPageCacheRefreshActionController,
} from './userPageActionController';

import { analyzeUserOpinions } from 'utilities/ai/aiClient.js';
import { getEffectiveAiConfig } from 'utilities/ai/aiSettings.js';

import { generateBlockieDataUrl } from 'utilities/ui/blockieAvatars.js';
import { createLogger } from 'utilities/logging.js';
import { checkSponsoredAccess } from '../../domains/sessions/sponsoredAccess.js';
import {
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import {
  getAllowedSessionSlugs,
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import { resolveActiveSessionSlug } from '../../utilities/session/sessionNaming.js';
import { resolveSessionCapabilityProjection } from '../../utilities/session/sessionCapabilityProjection.js';
import {
  hasNamespaceEntriesSync,
  listNamespaceSlugsSync,
  peekCacheSync,
  subscribeCacheUpdates,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { getGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildPublicRoute } from '../../utilities/ui/publicUrl.js';
import { t } from '../../utilities/ui/terminology.js';
import { buildExplorerAddressUrl } from '../../variables/chains.js';
import { ethers } from 'ethers';

const accountLog = createLogger('account');
const CompareAddressSection = React.lazy(() => import('./CompareAddresses'));
const USERPAGE_GATE_UNKNOWN_RETRY_MS = 30 * 1000;
const USERPAGE_GATE_TERMINAL_RECHECK_MS = 60 * 1000;
const USERPAGE_RESPONSE_PARSE_MEMO_LIMIT = 300;
const PROFILE_SCAN_REPORT_EVENT = 'ce:profile-scan-report';
const USER_ANALYSIS_CACHE_VERSION = 1;
const USER_ANALYSIS_TTL_MS = 24 * 60 * 60 * 1000;

type UnknownRecord = Record<string, unknown>;
type UserPagePreviousProps = UnknownRecord & {
  network?: {
    id?: unknown;
  } | null;
};

type UserPageGlobalState = typeof globalThis & {
  CE_USER_PROFILE_DEEP_SCAN_LOADING?: unknown;
  CE_PROFILE_SCAN_TELEMETRY?: unknown;
  CE_PROFILE_SCAN_COLD_DIAG?: unknown;
  CE_SESSION_SCAN_SCOPE?: unknown;
  CE_SESSION_SCAN_SLUGS?: unknown;
  [key: string]: unknown;
};

type UserCacheSourceEntry = {
  slug?: unknown;
  data?: UnknownRecord;
  [key: string]: unknown;
};

type NamespaceCacheSourceEntry = {
  slug: string;
  data: UnknownRecord;
};

type CacheSourcePresence = {
  hasSurveysCache: boolean;
  hasQuestionsCache: boolean;
  hasSbtCache: boolean;
  hasUserCache: boolean;
};

type CacheSourceSnapshot = CacheSourcePresence & {
  hasSurveySources: boolean;
  hasQuestionSources: boolean;
  hasSbtSources: boolean;
  surveySourcesSignature: string;
  questionSourcesSignature: string;
  sbtSourcesSignature: string;
  membershipSignature: string;
};

type UserPageTimeoutHandle = ReturnType<typeof setTimeout>;
type UserPageIntervalHandle = ReturnType<typeof setInterval>;

type QueuedCacheRefreshOptions = {
  force?: unknown;
  markLoading?: unknown;
  bypassSignature?: unknown;
};

type CacheRefreshOptions = {
  force: boolean;
  markLoading: boolean;
  bypassSignature?: boolean;
};

type UnifiedCacheAggregateInput = {
  networkID?: unknown;
  viewAddressLower?: unknown;
};

type CacheNetworkBucket = UnknownRecord & {
  surveys?: unknown;
  surveyResponses?: unknown;
  questions?: unknown;
  questionResponses?: unknown;
  questionResponsesMeta?: unknown;
  sbtList?: unknown;
};

type PrioritizedCacheNode = {
  key: string;
  value: CacheNetworkBucket;
};

type UserCachePayload = UnknownRecord & {
  sbts?: unknown;
  createdSurveys?: unknown;
  createdQuestions?: unknown;
  surveyResponses?: unknown;
  questionResponses?: unknown;
};

type UserChainNode = UnknownRecord & {
  data?: unknown;
};

type PrioritizedUserChainNode = {
  chainKey: string;
  node: UserChainNode;
};

type GateAccessKeyInput = {
  slug?: unknown;
  resourceKey?: unknown;
};

type GateAccessStatusEntry = {
  status: string;
  ts: number;
};

type SponsoredAccessResult = {
  status?: unknown;
  [key: string]: unknown;
};

type ResponseGateAccessCheckPromise = Promise<void>;

type GateAccessContext = {
  pendingKeys: Set<string>;
  uncertainResources: Set<string>;
};

type GateAccessContextSnapshot = {
  pendingKeys: string[];
  uncertainResources: string[];
};

type SourceSlugMap = UserPageSourceSlugMap;

type EntityCacheMap = Record<string, UnknownRecord>;

type ResponseByResponderMap = Record<string, unknown>;

type ResponseBucketMap = Record<string, ResponseByResponderMap>;

type ResponseRecencyWithHints = ResponseRecency & {
  hasHints: boolean;
};

type ResponseRecencyBucketMap = Record<string, Record<string, ResponseRecencyWithHints>>;

type SbtAggregateEntry = UnknownRecord & {
  sbtAddress?: unknown;
  sbtInfo?: unknown;
  mintedSet: Set<string>;
  burnedSet: Set<string>;
  viewerCountsAuthoritative?: boolean;
  blockNumber: number;
  slug?: unknown;
};

type SbtAggregateMap = Record<string, SbtAggregateEntry>;

type DerivedSbtListItem = {
  sbtInfo: UnknownRecord;
  slug?: unknown;
};

type UserPageRenderSurveyEntry = UnknownRecord & {
  id: string;
  title: React.ReactNode;
  questionsCount: React.ReactNode;
  slug?: string;
  tags: React.ReactNode[];
  documentURLs: string[];
};

type UserPageRenderQuestionEntry = UnknownRecord & {
  id: string;
  canDecryptOtherResponses?: unknown;
  sessionSlug?: unknown;
  slug?: unknown;
};

type SbtSectionResult = {
  sbtList: DerivedSbtListItem[];
  badgesReceived: number;
};

type ResponseEncryptionSummary = {
  answerEncrypted: boolean;
  additionalEncrypted: boolean;
};

type SurveyQuestionResponseDetail = {
  questionData: UnknownRecord;
  responseData: NormalizedQuestionResponsePayload;
  canDecryptOtherResponses: boolean;
  responseEncryption: ResponseEncryptionSummary;
};

type SurveySectionResult = {
  surveyResponseInfo: UnknownRecord[];
  surveyCreationInfo: UnknownRecord[];
  detailedSurveyResponses: Record<string, SurveyQuestionResponseDetail[]>;
  surveysResponded: number;
  surveysCreated: number;
};

type QuestionResponseInfoEntry = UnknownRecord & {
  _responseRecency?: ResponseRecency;
};

type QuestionSectionResult = {
  questionCreationInfo: UnknownRecord[];
  questionResponseInfo: UnknownRecord[];
  detailedQuestionResponses: Record<string, NormalizedQuestionResponsePayload>;
  questionsCreated: number;
  questionsResponded: number;
};

type SurveyResponseRecencyUpsertInput = {
  sid?: unknown;
  responder?: unknown;
  responseValue?: unknown;
  metaValue?: unknown;
  slug?: unknown;
};

type QuestionResponseRecencyUpsertInput = {
  qid?: unknown;
  responder?: unknown;
  responseValue?: unknown;
  metaValue?: unknown;
  slug?: unknown;
};

type EncryptedVisibilityInput = {
  resourceKey?: unknown;
  slug?: unknown;
  viewAddressLower?: unknown;
  encryptionAudience?: unknown;
  gateContext?: GateAccessContext | null;
};

type EncryptedVisibilityResult = {
  visible: boolean;
  canDecryptOtherResponses: boolean;
  uncertain?: boolean;
};

type DecryptSingleFieldOptions = UnknownRecord & {
  account: string;
  provider?: unknown;
  providerKind?: unknown;
  chainId: number;
  surveyId: string;
  acceptedSurveyIds: string[];
  lit: unknown;
  throwOnError: boolean;
};

type CryptoUtilsWithSingleField = {
  decryptSingleField: (
    responseSlice: unknown,
    questionId: string,
    fieldToDecrypt: unknown,
    options: DecryptSingleFieldOptions,
  ) => Promise<unknown>;
};

type SectionDeriveMemoEntry = {
  signature: string;
  result: unknown;
  gateSnapshot?: GateAccessContextSnapshot;
} | null;

type SectionDeriveMemo = {
  survey: SectionDeriveMemoEntry;
  question: SectionDeriveMemoEntry;
  sbt: SectionDeriveMemoEntry;
};

type DeepScanSessionDisplayConfig = UnknownRecord & {
  sessionName?: unknown;
  blockLimits?: UnknownRecord & {
    start?: unknown;
  };
};

type DeepScanProgressRow = {
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

type DeepScanProgressSnapshot = {
  rows: DeepScanProgressRow[] | null;
  lines: string[] | null;
};

type NormalizedResponseField = UnknownRecord & {
  value?: unknown;
};

type NormalizedQuestionResponsePayload = UnknownRecord & {
  answer: NormalizedResponseField;
  additional: NormalizedResponseField;
  __ceMalformedPayload?: boolean;
};

type ResponseRecency = {
  bn: number;
  txi: number;
  li: number;
  ts: number;
};

type ManagedCacheUpdateEvent =
  | {
      namespace?: unknown;
      slug?: unknown;
      [key: string]: unknown;
    }
  | null
  | undefined;

type StoppableEvent =
  | {
      stopPropagation?: () => void;
    }
  | null
  | undefined;

type BookmarkToggleMeta = UnknownRecord & {
  nickname?: unknown;
  username?: unknown;
};

type AiSessionCandidate = {
  slug: string;
  sessionConfig: UnknownRecord;
  status: string;
};

type AiSessionResolution = AiSessionCandidate & {
  reason: string;
};

type UserAnalysisAiContext = {
  sessionSlug: string;
  provider: string;
  model: string;
};

type UserAnalysisCacheContextArgs = {
  userData: unknown;
  analysisSession: AiSessionResolution;
  addressLower: string;
  networkId: string;
};

type UserAnalysisCacheContext = {
  sessionSlug: string;
  aiContext: UserAnalysisAiContext;
  fingerprint: string;
};

type UserAnalysisCacheEntry = UnknownRecord & {
  version?: unknown;
  fingerprint?: unknown;
  cachedAt?: unknown;
  expiresAt?: unknown;
  address?: unknown;
  networkId?: unknown;
  result?: unknown;
};

type UserAnalysisCacheWriteArgs = {
  sessionSlug: string;
  networkId: string;
  addressLower: string;
  fingerprint: string;
  aiContext: UserAnalysisAiContext;
  result: unknown;
};

type ProfileTelemetryEntry = UnknownRecord & {
  ts: string;
  seq: number;
  source: 'UserPage';
  event: string;
};

type ProfileDeepScanReport = UnknownRecord & {
  targetAddress?: unknown;
  attemptedSlugs?: unknown;
  scannedSlugs?: unknown;
  skippedSlugs?: unknown;
  failedSlugs?: unknown;
  failedActivitySlugs?: unknown;
  hadRpcErrors?: unknown;
  coverageComplete?: unknown;
  coverageReason?: unknown;
  anyNewData?: unknown;
  usedAllSessions?: unknown;
};

type ProfileScanReportEvent =
  | Event
  | {
      detail?: unknown;
    }
  | null
  | undefined;

type NicknameKeyEvent = {
  key?: unknown;
};

type NicknameChangeEvent = {
  target?: {
    value?: unknown;
  };
};

const globalState = globalThis as UserPageGlobalState;
const getEffectiveAiConfigTyped = getEffectiveAiConfig as (
  request: UserPageEffectiveAiConfigRequest,
) => Promise<UserPageEffectiveAiConfigResult | null | undefined>;
const writeCacheTyped = writeCache as (namespace: string, slug?: string, value?: unknown) => Promise<unknown>;

const isGateAccessContext = (value: unknown): value is GateAccessContext => isUserPageGateAccessContext(value);

const createGateAccessContext = (): GateAccessContext => ({
  pendingKeys: new Set(),
  uncertainResources: new Set(),
});

const captureGateContextSnapshot = (gateContext: GateAccessContext | null = null): GateAccessContextSnapshot => ({
  pendingKeys: isGateAccessContext(gateContext) ? Array.from(gateContext.pendingKeys) : [],
  uncertainResources: isGateAccessContext(gateContext) ? Array.from(gateContext.uncertainResources) : [],
});

const mergeGateContextSnapshot = (
  targetContext: GateAccessContext | null,
  snapshot: GateAccessContextSnapshot | null = null,
): void => {
  if (!isGateAccessContext(targetContext) || !snapshot) return;
  (Array.isArray(snapshot.pendingKeys) ? snapshot.pendingKeys : []).forEach((item: string) => {
    targetContext.pendingKeys.add(String(item || ''));
  });
  (Array.isArray(snapshot.uncertainResources) ? snapshot.uncertainResources : []).forEach((item: string) => {
    targetContext.uncertainResources.add(String(item || ''));
  });
};

const buildUserAnalysisFingerprint = async (input: Omit<UserPageAnalysisFingerprintInput, 'version'>) =>
  buildUserPageAnalysisFingerprint({
    ...input,
    version: USER_ANALYSIS_CACHE_VERSION,
  });

const resolveUserAnalysisAiContext = (sessionSlug: unknown, sessionConfig: UnknownRecord = {}) =>
  resolveUserPageAnalysisAiContext({
    getEffectiveAiConfig: getEffectiveAiConfigTyped,
    logger: accountLog,
    sessionConfig,
    sessionSlug,
  });

class UserPage extends Component<any, any> {
  _isMounted: boolean = false;
  analysisTimer: UserPageIntervalHandle | null = null;
  _profileScanRequestSeq: number = 0;
  _queuedCacheRefreshTimer: UserPageTimeoutHandle | null = null;
  _queuedCacheRefreshForce: boolean = false;
  _queuedCacheRefreshLoading: boolean = false;
  _queuedCacheRefreshBypassSignature: boolean = false;
  _responseGateRetryTimer: UserPageTimeoutHandle | null = null;
  _responseGateRetryDueAt: number = 0;
  _responseGateAccessStatusByKey: Map<string, GateAccessStatusEntry> = new Map();
  _responseGateAccessInFlightByKey: Map<string, ResponseGateAccessCheckPromise> = new Map();
  _responseGateAccessGeneration: number = 0;
  _responseGateAccessStatusVersion: number = 0;
  _lastCacheRefreshInputSignature: string = '';
  _responsePayloadParseMemo: Map<string, unknown> = new Map();
  _deepScanTooltipInputSignature: string | null = null;
  _deepScanTooltipOutputSignature: string = '';
  _profileTelemetrySeq: number = 0;
  _lastProfileRefreshTelemetrySignature: string = '';
  _lastProfileDeriveTelemetrySignature: string = '';
  _lastNoSbtVisibleTelemetrySignature: string = '';
  _lastProfileRefreshTelemetry: unknown = null;
  _lastBackgroundDeepScanReportSignature: string = '';
  _unifiedCacheAggregateMemoKey: string = '';
  _unifiedCacheAggregateMemo: unknown = null;
  _unsubscribeCacheUpdates: (() => void) | null = null;
  _sectionDeriveMemo: SectionDeriveMemo = {
    survey: null,
    question: null,
    sbt: null,
  };
  constructor(props: unknown) {
    super(props);
    this.state = {
      viewAddress: '', // Set from props
      surveyResponseInfo: [], // Basic info about responded-to surveys
      surveyCreationInfo: [], // Basic info about created surveys
      questionCreationInfo: [], // Basic info about created questions
      questionResponseInfo: [], // Basic info about responded-to questions

      detailedSurveyResponses: {}, // { [surveyId]: [ array of { questionData, responseData } ] }
      detailedQuestionResponses: {}, // { [questionId]: responseObject }

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
      copied: false,
      collapseOpen: false,
      username: '',
      usernameError: '',
      isEditingUsername: false, // NEW: state for username edit mode
      bookmarked: false,
      sbtList: [],
      loadingSBTs: true,
      loadingSurveys: true,
      loadingQuestions: true,
      showAnalysisModal: false,
      aiAnalysis: '',
      analysisName: '',
      analysisDetails: '',
      analysisError: '',
      analyzing: false,
      aiAvailable: null, // null = unchecked, true = available, false = unavailable
      // Added for elapsed timer + historical alignment
      analysisElapsedMs: 0,
      analysisHistoricalFigure: '',
      analysisHistoricalReasoning: '',
      analysisServedFromCache: false,
      analysisCachedAt: null,
      showFullProfileModal: false,
      isSimulated: false,
      // Default: Questions tab
      selectedTab: 'questions',
      expandedSurveyResponses: {},
      expandedSurveysCreated: {},

      // NEW: section collapsibles
      showSectionSurveyResponsesOpen: true,
      showSectionSurveysCreatedOpen: true,
      showSectionQuestionResponsesOpen: true,
      showSectionQuestionsCreatedOpen: true,

      // NEW: nickname (inline, header actions; visible on any user page)
      nicknameInput: '',
      // NEW: inline edit toggle for nickname
      isEditingNickname: false,

      // NEW: Track deep search status to prevent "No Data" flash
      isDeepScanning: false,
      hasUncertainUserData: false,
      hasUncertainSbtData: false,
      hasUncertainGateAccess: false,
      deepScanProgressTick: 0,
      deepScanTooltipLines: null,
      deepScanProgressRows: null,
    };
    this._queuedCacheRefreshTimer = null;
    this._queuedCacheRefreshForce = false;
    this._queuedCacheRefreshLoading = false;
    this._queuedCacheRefreshBypassSignature = false;
    this._responseGateRetryTimer = null;
    this._responseGateRetryDueAt = 0;
    this._responseGateAccessStatusByKey = new Map();
    this._responseGateAccessInFlightByKey = new Map();
    this._responseGateAccessGeneration = 0;
    this._responseGateAccessStatusVersion = 0;
    this._lastCacheRefreshInputSignature = '';
    this._responsePayloadParseMemo = new Map();
    this._deepScanTooltipInputSignature = null;
    this._deepScanTooltipOutputSignature = '';
    this._profileTelemetrySeq = 0;
    this._lastProfileRefreshTelemetrySignature = '';
    this._lastProfileDeriveTelemetrySignature = '';
    this._lastNoSbtVisibleTelemetrySignature = '';
    this._lastProfileRefreshTelemetry = null;
    this._lastBackgroundDeepScanReportSignature = '';
    this._unifiedCacheAggregateMemoKey = '';
    this._unifiedCacheAggregateMemo = null;
    this._unsubscribeCacheUpdates = null;
    this._sectionDeriveMemo = {
      survey: null,
      question: null,
      sbt: null,
    };
  }

  getActiveSessionSlug = (): string =>
    resolveActiveSessionSlug({
      activeSessionSlug: this.props.activeSessionSlug,
      sessionSlug: this.props.sessionSlug,
    }) || '';

  getBookmarksCache = (): UserPageBookmarksCache => {
    try {
      const slug = this.getActiveSessionSlug();
      const parsed = peekCacheSync('bookmarksCache', slug, { clone: false });
      return normalizeUserPageBookmarksCache(parsed);
    } catch (_) {
      return normalizeUserPageBookmarksCache(null);
    }
  };

  persistBookmarksCache = (cacheObj: unknown, source: unknown = ''): void => {
    const slug = this.getActiveSessionSlug();
    void (writeCache as (namespace: string, slug?: string, value?: unknown) => Promise<boolean>)(
      'bookmarksCache',
      slug,
      cacheObj || {},
    ).catch((error: unknown) => {
      accountLog.error('UserPage: Error saving bookmarksCache:', error);
    });
    try {
      window.dispatchEvent(new CustomEvent('bookmarksCacheUpdated', { detail: { source: source || 'userpage' } }));
    } catch (e) {
      accountLog.warn('UserPage: telemetry', e);
    }
  };

  stopSpinnerEventPropagation = (event: StoppableEvent): void => {
    event?.stopPropagation?.();
  };

  dispatchSbtDataRefresh = (addr: unknown, slug?: unknown): void => {
    runUserPageCacheRefreshActionController({
      cacheRefreshArgs: [addr, slug],
      plan: {
        blockedReason: 'none',
        disabled: false,
        shouldRenderCacheRefreshAction: true,
      },
      ports: { dispatchCacheRefresh: this.props.refreshSbtData },
    });
  };

  handleManagedCacheUpdate = (event: ManagedCacheUpdateEvent = null): void => {
    if (!this._isMounted) return;
    const cacheUpdate = resolveUserPageManagedCacheUpdate({
      bookmarksSlug: this.getActiveSessionSlug(),
      namespace: event?.namespace,
      slug: event?.slug,
    });

    if (cacheUpdate.action === 'bookmarks') {
      this.checkIfBookmarked();
      this.loadNicknameFromCache();
      return;
    }

    if (cacheUpdate.action !== 'refresh') {
      return;
    }

    this._clearUnifiedCacheAggregateMemo();
    this._clearSectionDeriveMemo();
    this.queueCacheRefresh({ markLoading: false, bypassSignature: true });
  };

  _deepScanProgressTimer: ReturnType<typeof setInterval> | null = null;

  _buildDeepScanTooltipInputSignature = (): string => {
    return buildUserPageDeepScanTooltipInputSignature({
      latestBlockNumber: this.props.latestBlockNumber,
      listNamespaceSlugs: listNamespaceSlugsSync,
      network: this.props.network,
      peekCache: peekCacheSync,
      viewAddress: this.props.viewAddress,
    });
  };

  startDeepScanProgressTimer = (): void => {
    if (this._deepScanProgressTimer) return;
    this._deepScanTooltipInputSignature = null;
    this._deepScanTooltipOutputSignature = '';
    this._deepScanProgressTimer = setInterval(() => {
      if (!this._isMounted || !this.state.isDeepScanning) return;
      const nextInputSig = this._buildDeepScanTooltipInputSignature();
      if (nextInputSig === this._deepScanTooltipInputSignature) return;
      this._deepScanTooltipInputSignature = nextInputSig;
      const nextProgressSnapshot = this.computeDeepScanProgressSnapshot();
      const nextTooltipLines = nextProgressSnapshot?.lines || null;
      const nextProgressRows = nextProgressSnapshot?.rows || null;
      const progressUpdate = resolveUserPageDeepScanProgressStateUpdate({
        currentDeepScanProgressRows: this.state.deepScanProgressRows,
        currentDeepScanTooltipLines: this.state.deepScanTooltipLines,
        nextDeepScanProgressRows: nextProgressRows,
        nextDeepScanTooltipLines: nextTooltipLines,
      });
      if (!progressUpdate.shouldUpdate) {
        this._deepScanTooltipOutputSignature = progressUpdate.nextOutputSignature;
        return;
      }
      this._deepScanTooltipOutputSignature = progressUpdate.nextOutputSignature;
      this.setState(
        buildUserPageDeepScanProgressStatePatch({
          deepScanProgressRows: nextProgressRows,
          deepScanTooltipLines: nextTooltipLines,
        }),
      );
    }, 2000);
  };

  stopDeepScanProgressTimer = (): void => {
    if (this._deepScanProgressTimer) {
      clearInterval(this._deepScanProgressTimer);
      this._deepScanProgressTimer = null;
    }
    this._deepScanTooltipInputSignature = null;
    this._deepScanTooltipOutputSignature = '';
  };

  buildDeepScanProgressTooltip = (): string[] | null => {
    return normalizeUserPageDeepScanTooltipLines(this.state.deepScanTooltipLines);
  };

  buildDeepScanProgressRows = (): DeepScanProgressRow[] | null => {
    return normalizeUserPageDeepScanProgressRows(this.state.deepScanProgressRows) as DeepScanProgressRow[] | null;
  };

  computeDeepScanProgressSnapshot = (): DeepScanProgressSnapshot => {
    const rows = this.computeDeepScanProgressRows();
    return {
      rows,
      lines: formatUserPageDeepScanTooltipLinesFromRows(rows, formatUserPageDeepScanBlockCount),
    };
  };

  computeDeepScanProgressRows = (): DeepScanProgressRow[] | null => {
    const viewLower = String(this.props.viewAddress || '').toLowerCase();
    if (!viewLower) return null;
    const latestBlockRaw = this.props.latestBlockNumber;
    const latestBlockNum = Number.isFinite(Number(latestBlockRaw)) ? Number(latestBlockRaw) : null;
    const currentChainId = this.props.network?.id != null ? Number(this.props.network.id) : null;
    const userCaches = this._dgReadAll('userCache') as UserCacheSourceEntry[];
    return this._deriveDeepScanProgressRows(userCaches, viewLower, currentChainId, latestBlockNum);
  };

  _getDeepScanSessionDisplayConfig = (slugIn: unknown = ''): DeepScanSessionDisplayConfig | null => {
    return resolveUserPageDeepScanSessionDisplayConfig({
      getDemoSessionConfigBySlug,
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn,
    }) as DeepScanSessionDisplayConfig | null;
  };

  _getDeepScanPrioritySlugs = (): string[] => {
    return buildUserPageDeepScanPrioritySlugs({
      activeSessionSlug: this.props.activeSessionSlug,
      getAllowedSessionSlugs,
      readSessionScanScope,
      readSessionScanSlugs,
    });
  };

  _deriveDeepScanProgressRows = (
    userCaches: UserCacheSourceEntry[] | null | undefined,
    viewLower: string,
    currentChainId: number | null,
    latestBlockNum: number | null,
  ): DeepScanProgressRow[] | null =>
    measureSync('ce.userPage.deepScanTooltipRows', () => {
      return deriveUserPageDeepScanProgressRows({
        currentChainId,
        getSessionDisplayConfig: (slug: string) => this._getDeepScanSessionDisplayConfig(slug),
        latestBlockNum,
        prioritySlugs: this._getDeepScanPrioritySlugs(),
        userCaches,
        viewLower,
      }) as DeepScanProgressRow[] | null;
    }) || null;

  _deriveDeepScanProgressTooltipFromCaches = (
    userCaches: UserCacheSourceEntry[] | null | undefined,
    viewLower: string,
    currentChainId: number | null,
    latestBlockNum: number | null,
  ): string[] | null =>
    measureSync('ce.userPage.deepScanTooltip', () => {
      const rows = this._deriveDeepScanProgressRows(userCaches, viewLower, currentChainId, latestBlockNum);
      return formatUserPageDeepScanTooltipLinesFromRows(rows, formatUserPageDeepScanBlockCount);
    }) || null;

  renderDeepScanStatusIndicator = (
    targetId: string,
    tooltipLines: string[] | null | undefined,
    progressRows: DeepScanProgressRow[] | null | undefined,
    titleText: string,
  ): React.ReactNode => (
    <UserPageDeepScanStatusIndicator
      onSpinnerEvent={this.stopSpinnerEventPropagation}
      progressRows={progressRows}
      targetId={targetId}
      titleText={titleText}
      tooltipLines={tooltipLines}
    />
  );

  parseCachedResponsePayload = (rawValue: unknown): unknown => {
    return parseUserPageCachedResponsePayload(
      rawValue,
      this._responsePayloadParseMemo,
      USERPAGE_RESPONSE_PARSE_MEMO_LIMIT,
    );
  };

  isDeepScanLoadingEnabledForSection = (_section?: unknown): boolean => {
    try {
      if (typeof globalThis === 'undefined') return true;
      if (typeof globalState.CE_USER_PROFILE_DEEP_SCAN_LOADING !== 'undefined') {
        const enabled = readBoolishUserPageTelemetryFlag(globalState.CE_USER_PROFILE_DEEP_SCAN_LOADING, true);
        if (!enabled) return false;
      }
    } catch (e) {
      accountLog.warn('UserPage: telemetry', e);
    }
    return true;
  };

  isProfileTelemetryEnabled = (): boolean => {
    try {
      if (typeof globalThis === 'undefined') return false;
      if (typeof globalState.CE_PROFILE_SCAN_TELEMETRY !== 'undefined') {
        return readBoolishUserPageTelemetryFlag(globalState.CE_PROFILE_SCAN_TELEMETRY, true);
      }
      const pathname = String(globalState.location?.pathname || '');
      return pathname.startsWith('/u/');
    } catch (_) {
      return false;
    }
  };

  emitProfileTelemetry = (event: unknown, payload: unknown = {}): void => {
    if (!this.isProfileTelemetryEnabled()) return;
    try {
      const safeEvent = String(event || '').trim() || 'unknown';
      const safePayload: UnknownRecord = isPlainAnalysisObject(payload) ? payload : { value: payload };
      const seq = Number(this._profileTelemetrySeq || 0) + 1;
      this._profileTelemetrySeq = seq;
      const entry: ProfileTelemetryEntry = {
        ts: new Date().toISOString(),
        seq,
        source: 'UserPage',
        event: safeEvent,
        ...safePayload,
      };
      const key = '__CE_PROFILE_SCAN_TELEMETRY__';
      const bucket = Array.isArray(globalState[key]) ? (globalState[key] as ProfileTelemetryEntry[]) : [];
      bucket.push(entry);
      if (bucket.length > 800) bucket.splice(0, bucket.length - 800);
      globalState[key] = bucket;
      console.info(`[CE_PROFILE_SCAN][UserPage] ${safeEvent}`, entry);
    } catch (e) {
      accountLog.warn('UserPage: telemetry', e);
    }
  };

  isProfileColdDiagEnabled = (): boolean => {
    try {
      if (typeof globalThis === 'undefined') return false;
      if (typeof globalState.CE_PROFILE_SCAN_COLD_DIAG !== 'undefined') {
        return readBoolishUserPageTelemetryFlag(globalState.CE_PROFILE_SCAN_COLD_DIAG, false);
      }
    } catch (e) {
      accountLog.warn('UserPage: telemetry', e);
    }
    return false;
  };

  emitProfileColdDiag = (event: unknown, payload: unknown = {}): void => {
    if (!this.isProfileColdDiagEnabled()) return;
    const name =
      String(event || '')
        .trim()
        .toLowerCase() || 'unknown';
    this.emitProfileTelemetry(`cold-diag:${name}`, payload);
  };

  emitNoSbtVisibleTelemetry = (): void => {
    if (!this.isProfileTelemetryEnabled()) return;
    const telemetryState = buildUserPageNoSbtVisibleTelemetryState({
      hasUncertainGateAccess: this.state.hasUncertainGateAccess,
      hasUncertainSbtData: this.state.hasUncertainSbtData,
      hasUncertainUserData: this.state.hasUncertainUserData,
      isDeepScanning: this.state.isDeepScanning,
      isSBTReady: this.props.isSBTCacheReady,
      latestRefreshTelemetry: this._lastProfileRefreshTelemetry,
      loadingSBTs: this.state.loadingSBTs,
      networkID: this.props.network?.id,
      sbtList: this.state.sbtList,
      viewAddress: this.props.viewAddress,
    });
    if (!telemetryState.shouldEmit || !telemetryState.payload) return;
    if (telemetryState.signature === this._lastNoSbtVisibleTelemetrySignature) return;
    this._lastNoSbtVisibleTelemetrySignature = telemetryState.signature;

    this.emitProfileTelemetry('no-sbt-visible', telemetryState.payload);
  };

  applyDeepScanReport = (scanReport: unknown): void => {
    if (!this._isMounted) return;
    const report = toAnalysisRecord(scanReport) as ProfileDeepScanReport;
    const viewAddressLower = String(this.props.viewAddress || '').toLowerCase();
    const reportTargetLower = String(report.targetAddress || '').toLowerCase();
    if (reportTargetLower && viewAddressLower && reportTargetLower !== viewAddressLower) return;
    const {
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
    } = buildUserPageDeepScanReportStatus({ report });
    const reportTelemetryPayloads = buildUserPageDeepScanReportTelemetryPayloads({
      report,
      status: {
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
      },
      viewAddress: this.props.viewAddress,
    });
    this.emitProfileColdDiag('scan-report', reportTelemetryPayloads.coldDiagPayload);
    this.emitProfileTelemetry('deep-scan-report', reportTelemetryPayloads.telemetryPayload);
    this.setState(
      buildUserPageDeepScanReportStatePatch({
        hasUncertainUserData,
        hasUncertainSbtData,
      }),
      () => {
        this.loadDataFromCache();
      },
    );
  };

  startProfileDeepScan = (phase: unknown = 'mount'): void => {
    const targetAddress = String(this.props.viewAddress || '').trim();
    if (
      !this._isMounted ||
      this.props.onChainProfileEnabled === false ||
      !this.props.scanSpecificUserProfile ||
      !targetAddress
    )
      return;

    const requestSeq = Number(this._profileScanRequestSeq || 0) + 1;
    this._profileScanRequestSeq = requestSeq;
    const targetLower = targetAddress.toLowerCase();

    this.emitProfileTelemetry('deep-scan-request', {
      viewAddress: targetLower,
      phase,
    });
    this.setState(buildUserPageDeepScanRequestStatePatch());

    this.props
      .scanSpecificUserProfile(targetAddress)
      .then((scanReport: unknown) => {
        if (
          !shouldApplyUserPageDeepScanResponse({
            activeRequestSeq: this._profileScanRequestSeq,
            currentViewAddress: this.props.viewAddress,
            isMounted: this._isMounted,
            requestSeq,
            targetLower,
          })
        )
          return;
        const safeReport: ProfileDeepScanReport = isPlainAnalysisObject(scanReport) ? { ...scanReport } : {};
        if (!safeReport.targetAddress) safeReport.targetAddress = targetAddress;
        this.applyDeepScanReport(safeReport);
      })
      .catch((err: unknown) => {
        accountLog.error(`[UserPage] Deep search failed${phase === 'update' ? ' on update' : ''}:`, err);
        if (
          !shouldApplyUserPageDeepScanResponse({
            activeRequestSeq: this._profileScanRequestSeq,
            currentViewAddress: this.props.viewAddress,
            isMounted: this._isMounted,
            requestSeq,
            targetLower,
          })
        )
          return;
        this.emitProfileTelemetry('deep-scan-failed', {
          viewAddress: targetLower,
          phase,
          error: getUserPageErrorMessage(err, String(err)),
        });
        this.applyDeepScanReport({
          targetAddress,
          hadRpcErrors: true,
          coverageComplete: false,
          coverageReason: 'scan-exception',
        });
      });
  };

  handleBackgroundProfileScanReport = (event: ProfileScanReportEvent): void => {
    if (!this._isMounted) return;
    const detailSource = event && typeof event === 'object' && 'detail' in event ? event.detail : null;
    const detail = toAnalysisRecord(detailSource);
    const scanReport = toAnalysisRecord(detail.scanReport) as ProfileDeepScanReport;
    if (!Object.keys(scanReport).length) return;
    const viewAddressLower = String(this.props.viewAddress || '').toLowerCase();
    const reportTargetLower = String(scanReport.targetAddress || '').toLowerCase();
    if (!viewAddressLower || !reportTargetLower || reportTargetLower !== viewAddressLower) return;

    const signature = buildUserPageDeepScanReportSignature({
      report: scanReport,
      reportTargetLower,
    });
    if (signature === this._lastBackgroundDeepScanReportSignature) return;
    this._lastBackgroundDeepScanReportSignature = signature;

    this.applyDeepScanReport(scanReport);
  };

  componentDidMount() {
    this._isMounted = true;
    try {
      if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener(PROFILE_SCAN_REPORT_EVENT, this.handleBackgroundProfileScanReport);
      }
    } catch (e) {
      accountLog.warn('UserPage: fallback', e);
    }
    try {
      this._unsubscribeCacheUpdates = subscribeCacheUpdates(this.handleManagedCacheUpdate);
    } catch (e) {
      accountLog.warn('UserPage: fallback', e);
    }
    this.setState(buildUserPageViewAddressStatePatch({ viewAddress: this.props.viewAddress }), () => {
      // Honor optional defaultTab prop (e.g., 'surveys')
      try {
        const dt = String(this.props.defaultTab || '').toLowerCase();
        if (dt === 'surveys' || dt === 'questions') {
          this.setState(buildUserPageSelectedTabStatePatch({ selectedTab: dt }));
        }
      } catch (e) {
        accountLog.warn('UserPage: fallback', e);
      }

      this.loadPersistedUsername();
      this.loadDataFromCache();
      this.checkIfBookmarked();
      this.loadNicknameFromCache(); // NEW: prefill nickname if present in bookmarksCache (object-shaped)

      // Phase 2 Task: Trigger global light discovery to populate caches for all groups
      // This ensures the "universe" of known SBT addresses is populated, which is
      // a prerequisite for the deep scan to find what the user owns.
      if (this.props.onChainProfileEnabled !== false && this.props.ensureLightSbtUniverse) {
        accountLog.log('[UserPage] Triggering ensureLightSbtUniverse...');
        this.props.ensureLightSbtUniverse();
      }

      // ---------------------------------------------------------
      // NEW: Trigger "Fast Lane" Deep Search for this user
      // This populates local caches with this user's data from ALL groups
      // ---------------------------------------------------------
      this.startProfileDeepScan('mount');
    });
  }

  componentWillUnmount() {
    this._isMounted = false;
    this._profileScanRequestSeq += 1;
    try {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener(PROFILE_SCAN_REPORT_EVENT, this.handleBackgroundProfileScanReport);
      }
    } catch (e) {
      accountLog.warn('UserPage: cleanup', e);
    }
    try {
      if (typeof this._unsubscribeCacheUpdates === 'function') {
        this._unsubscribeCacheUpdates();
      }
    } catch (e) {
      accountLog.warn('UserPage: cleanup', e);
    }
    this._unsubscribeCacheUpdates = null;
    this.clearAnalysisTimer();
    this.stopDeepScanProgressTimer();
    this.clearQueuedCacheRefresh();
    this.clearResponseGateRetryTimer();
    this._resetResponseGateAccess();
    this._clearUnifiedCacheAggregateMemo();
    this._clearSectionDeriveMemo();
  }

  componentDidUpdate(prevProps: UserPagePreviousProps, prevState: UnknownRecord) {
    // Fast-path: nonce changed → force immediate cache re-read (bypasses signature dedup)
    const responseNonceRefresh = resolveUserPageResponseNonceRefresh({
      account: this.props.account,
      connectedAddress: this.props.connectedAddress,
      nextNonce: this.props.questionResponsesNonce,
      prevNonce: prevProps.questionResponsesNonce,
      viewAddress: this.props.viewAddress,
    });
    if (responseNonceRefresh) {
      if (responseNonceRefresh.isOwnProfile) {
        // eslint-disable-next-line no-console
        console.debug('[UserPage] questionResponsesNonce changed, forcing cache refresh for own profile');
      }
      this.queueCacheRefresh(responseNonceRefresh.options);
    }

    // React to address or network changes
    const addressContextChange = resolveUserPageAddressContextChange({
      prevViewAddress: prevProps.viewAddress,
      nextViewAddress: this.props.viewAddress,
      prevNetwork: prevProps.network,
      nextNetwork: this.props.network,
    });
    if (addressContextChange.shouldReset) {
      if (this._isMounted) {
        this._lastBackgroundDeepScanReportSignature = '';
        this._responsePayloadParseMemo.clear();
        this._resetResponseGateAccess();
        this._lastCacheRefreshInputSignature = '';
        this._clearUnifiedCacheAggregateMemo();
        this._clearSectionDeriveMemo();
        this._deepScanTooltipInputSignature = null;
        this._deepScanTooltipOutputSignature = '';
        this.setState(
          buildUserPageAddressContextResetStatePatch({
            viewAddress: addressContextChange.nextViewAddress,
          }),
          () => {
            this.loadPersistedUsername(); // Load username for the new context
            this.loadDataFromCache(); // Load all data from cache for the new context
            this.checkIfBookmarked(); // Check bookmark status for the new context
            this.loadNicknameFromCache(); // NEW: prefill nickname for the new context

            // ---------------------------------------------------------
            // NEW: Trigger Deep Search if address changed
            // ---------------------------------------------------------
            this.startProfileDeepScan('update');
          },
        );
      }
    }

    if (prevState.isDeepScanning !== this.state.isDeepScanning) {
      if (this.state.isDeepScanning) {
        this.startDeepScanProgressTimer();
      } else {
        this.stopDeepScanProgressTimer();
      }
    }

    // NEW: Reactivity to MainSite cache updates (no contract calls here)
    const cacheUpdateRefresh = resolveUserPageCacheUpdateRefresh({
      prevSbtCacheRevision: prevProps.sbtCacheRevision,
      nextSbtCacheRevision: this.props.sbtCacheRevision,
      prevAccount: prevProps.account,
      nextAccount: this.props.account,
    });
    if (cacheUpdateRefresh.shouldResetGateAccess) {
      this._resetResponseGateAccess();
    }
    if (cacheUpdateRefresh.shouldQueueCacheRefresh) {
      this.queueCacheRefresh({ markLoading: false });
    }

    const aiAvailabilityRefresh = resolveUserPageAiAvailabilityRefresh({
      nextAccount: this.props.account,
      nextIsQuestionCacheReady: this.props.isQuestionCacheReady,
      nextIsResponsesCacheReady: this.props.isResponsesCacheReady,
      nextIsSBTCacheReady: this.props.isSBTCacheReady,
      nextIsSurveyCacheReady: this.props.isSurveyCacheReady,
      nextNetworkId: this.props.network?.id,
      nextViewAddress: this.props.viewAddress,
      prevAccount: prevProps.account,
      prevIsQuestionCacheReady: prevProps.isQuestionCacheReady,
      prevIsResponsesCacheReady: prevProps.isResponsesCacheReady,
      prevIsSBTCacheReady: prevProps.isSBTCacheReady,
      prevIsSurveyCacheReady: prevProps.isSurveyCacheReady,
      prevNetworkId: prevProps.network?.id,
      prevViewAddress: prevProps.viewAddress,
    });
    if (aiAvailabilityRefresh.contextChanged) {
      // Reset and immediately re-check if caches are ready
      this.setState(buildUserPageAiAvailabilityStatePatch(), () => {
        if (aiAvailabilityRefresh.shouldCheckAfterReset) this._checkAiAvailability();
      });
    } else if (aiAvailabilityRefresh.shouldCheckNow) {
      // Caches just became ready — initial check
      this._checkAiAvailability();
    }

    this.emitNoSbtVisibleTelemetry();
  }

  handleNicknameKeyDown = (event: NicknameKeyEvent): void => {
    if (event.key === 'Enter') {
      this.saveNickname();
    } else if (event.key === 'Escape') {
      this.cancelNicknameEdit();
    }
  };

  onPenClick = (): void => {
    if (!this._isMounted) return;
    this.setState(buildUserPageNicknameEditOpenStatePatch(), () => {
      // focus the input when it shows (best-effort via microtask)
      setTimeout(() => {
        try {
          const el = document.querySelector('input[aria-label="Set nickname"]') as HTMLInputElement | null;
          if (el) {
            el.focus();
            el.select();
          }
        } catch (e) {
          accountLog.warn('UserPage: fallback', e);
        }
      }, 0);
    });
  };

  cancelNicknameEdit = (): void => {
    if (!this._isMounted) return;
    const rawAddr = this.props.viewAddress;
    let cachedNick = '';
    try {
      const parsed = this.getBookmarksCache();
      cachedNick = resolveUserPageBookmarkNickname({
        address: rawAddr,
        trim: true,
        users: parsed?.users,
      });
    } catch (e) {
      accountLog.warn('UserPage: fallback', e);
    }
    this.setState(buildUserPageNicknameEditCancelStatePatch({ nicknameInput: cachedNick }));
  };

  handleNicknameChange = (event: NicknameChangeEvent): void => {
    if (this._isMounted) {
      this.setState(buildUserPageNicknameInputStatePatch({ nicknameInput: event.target?.value }));
    }
  };

  getOnchainUsername = (_address: unknown, _network: unknown): string | null => {
    return null;
    // should go in the chain gateway when enabled
  };

  saveNickname = (): void => {
    const rawAddr = this.props.viewAddress;
    if (!rawAddr || !this._isMounted) return;

    const nickname = (this.state.nicknameInput || '').trim();
    const onchainUsername = this.getOnchainUsername(rawAddr, this.props.network); // returns null for now

    let bookmarksCache = this.getBookmarksCache();
    const saveResult = applyUserPageBookmarkNicknameSave({
      address: rawAddr,
      bookmarksCache,
      networkId: this.props.network?.id,
      nickname,
      onchainUsername,
    });
    bookmarksCache = saveResult.bookmarksCache;

    this.persistBookmarksCache(bookmarksCache, 'saveNickname');
    if (this._isMounted) {
      this.setState(
        buildUserPageNicknameSaveStatePatch({
          nickname: saveResult.nickname,
          bookmarked: saveResult.stillBookmarked,
        }),
      );
    }
  };

  loadNicknameFromCache = (): void => {
    const rawAddr = this.props.viewAddress;
    if (!rawAddr || !this._isMounted) return;

    const bookmarksCache = this.getBookmarksCache();
    const nicknameInput = resolveUserPageBookmarkNickname({
      address: rawAddr,
      users: bookmarksCache.users,
    });

    if (this._isMounted) {
      this.setState(buildUserPageNicknameInputStatePatch({ nicknameInput }));
    }
  };

  loadPersistedUsername = (): void => {
    const { viewAddress, account, network } = this.props;
    if (account && viewAddress && network?.id && account.toLowerCase() === viewAddress.toLowerCase()) {
      const networkID = network.id.toString();
      try {
        const storedUsername = localStorage.getItem(`userPageUsername_${networkID}_${viewAddress.toLowerCase()}`);
        if (storedUsername && this._isMounted) {
          this.setState(buildUserPageUsernameLoadedStatePatch({ username: storedUsername }));
        }
      } catch (error) {
        accountLog.error('Error loading username from localStorage:', error);
      }
    }
  };

  loadDataFromCache = (): void => {
    if (!this._isMounted) return;
    const currentViewAddress = this.props.viewAddress;
    if (!currentViewAddress) {
      accountLog.warn('UserPage: viewAddress is not set, cannot load data from cache.');
      if (this._isMounted) {
        this.setState(buildUserPageMissingAddressCacheStatePatch());
      }
      return;
    }
    this.queueCacheRefresh({ markLoading: true });
  };

  // --- helpers: group-aware multi-cache reads (union across all groups) ---
  _dgReadAll = (name: unknown): NamespaceCacheSourceEntry[] => {
    return readUserPageNamespaceSourceEntries({
      listNamespaceSlugs: listNamespaceSlugsSync,
      namespace: name,
      peekCache: peekCacheSync,
    }) as NamespaceCacheSourceEntry[];
  };

  _dgHasAny = (name: unknown): boolean => hasNamespaceEntriesSync(String(name || ''));

  _readCacheSourceSnapshot = (): CacheSourceSnapshot => {
    return readUserPageCacheSourceSnapshot({
      hasNamespaceEntries: this._dgHasAny,
      listNamespaceSlugs: listNamespaceSlugsSync,
    }) as CacheSourceSnapshot;
  };

  _clearUnifiedCacheAggregateMemo = (): void => {
    this._unifiedCacheAggregateMemoKey = '';
    this._unifiedCacheAggregateMemo = null;
  };

  _clearSectionDeriveMemo = (): void => {
    this._sectionDeriveMemo = {
      survey: null,
      question: null,
      sbt: null,
    };
  };

  clearQueuedCacheRefresh = (): void => {
    if (this._queuedCacheRefreshTimer) {
      clearTimeout(this._queuedCacheRefreshTimer);
      this._queuedCacheRefreshTimer = null;
    }
    this._queuedCacheRefreshForce = false;
    this._queuedCacheRefreshLoading = false;
    this._queuedCacheRefreshBypassSignature = false;
  };

  clearResponseGateRetryTimer = (): void => {
    if (this._responseGateRetryTimer) {
      clearTimeout(this._responseGateRetryTimer);
      this._responseGateRetryTimer = null;
    }
    this._responseGateRetryDueAt = 0;
  };

  scheduleResponseGateRetry = (delayMs: unknown = USERPAGE_GATE_UNKNOWN_RETRY_MS): void => {
    const retryTimerPlan = buildUserPageGateRetryTimerPlan({
      currentDueAt: this._responseGateRetryDueAt,
      delayMs,
      fallbackDelayMs: USERPAGE_GATE_UNKNOWN_RETRY_MS,
      hasCurrentTimer: !!this._responseGateRetryTimer,
      isMounted: this._isMounted,
      nowMs: Date.now(),
    });
    if (!retryTimerPlan.shouldScheduleTimer) return;
    if (retryTimerPlan.shouldClearExistingTimer) {
      this.clearResponseGateRetryTimer();
    }
    this._responseGateRetryDueAt = retryTimerPlan.nextDueAt;
    this._responseGateRetryTimer = setTimeout(() => {
      this._responseGateRetryTimer = null;
      this._responseGateRetryDueAt = 0;
      if (!this._isMounted) return;
      this.queueCacheRefresh({ markLoading: false, bypassSignature: true });
    }, retryTimerPlan.safeDelayMs);
  };

  queueCacheRefresh = ({
    force = false,
    markLoading = false,
    bypassSignature = false,
  }: QueuedCacheRefreshOptions = {}): void => {
    if (!this._isMounted) return;
    const nextFlags = mergeUserPageQueuedCacheRefreshFlags({
      bypassSignature,
      currentBypassSignature: this._queuedCacheRefreshBypassSignature,
      currentForce: this._queuedCacheRefreshForce,
      currentMarkLoading: this._queuedCacheRefreshLoading,
      force,
      markLoading,
    });
    this._queuedCacheRefreshForce = nextFlags.force;
    this._queuedCacheRefreshLoading = nextFlags.markLoading;
    this._queuedCacheRefreshBypassSignature = nextFlags.bypassSignature;
    if (this._queuedCacheRefreshTimer) return;
    this._queuedCacheRefreshTimer = setTimeout(() => {
      this._queuedCacheRefreshTimer = null;
      this.flushQueuedCacheRefresh();
    }, 16);
  };

  flushQueuedCacheRefresh = (): void => {
    if (!this._isMounted) return;
    const force = !!this._queuedCacheRefreshForce;
    const markLoading = !!this._queuedCacheRefreshLoading;
    const bypassSignature = !!this._queuedCacheRefreshBypassSignature;
    this._queuedCacheRefreshForce = false;
    this._queuedCacheRefreshLoading = false;
    this._queuedCacheRefreshBypassSignature = false;
    const refreshOpts = buildUserPageCacheRefreshOptions({
      bypassSignature,
      force,
      markLoading,
    }) as CacheRefreshOptions;
    this._refreshAllDataFromCache(refreshOpts);
  };

  _setResponseGateAccessStatus = (cacheKey: unknown, status: unknown, ts: unknown = Date.now()): void => {
    const key = String(cacheKey || '').trim();
    if (!key) return;
    const nextStatus = String(status || 'missing');
    const nowTs = Number.isFinite(Number(ts)) ? Number(ts) : Date.now();
    const prev = this._responseGateAccessStatusByKey.get(key);
    if (!prev || String(prev.status || '') !== nextStatus) {
      this._responseGateAccessStatusVersion += 1;
    }
    this._responseGateAccessStatusByKey.set(key, { status: nextStatus, ts: nowTs });
  };

  _resetResponseGateAccess = (): void => {
    this._responseGateAccessGeneration += 1;
    this._responseGateAccessStatusVersion += 1;
    this._responseGateAccessStatusByKey.clear();
    this._responseGateAccessInFlightByKey.clear();
    this.clearResponseGateRetryTimer();
  };

  _getResponseGateAccessStatus = ({ slug = '', resourceKey = '' }: GateAccessKeyInput = {}): string => {
    const account = String(this.props.account || '').trim();
    if (!account) return 'needs-wallet';
    const key = buildUserPageGateAccessCacheKey({
      account: this.props.account,
      networkID: this.props.network?.id,
      resourceKey,
      sbtCacheRevision: this.props.sbtCacheRevision,
      slug,
    });
    const cached = this._responseGateAccessStatusByKey.get(key);
    return cached?.status || 'missing';
  };

  _queueResponseGateAccessChecks = (pendingKeys: Set<unknown> | null = new Set()): void => {
    const account = String(this.props.account || '').trim();
    if (!account || !pendingKeys || pendingKeys.size === 0) return;
    const generation = this._responseGateAccessGeneration;
    const now = Date.now();

    pendingKeys.forEach((pendingKey: unknown) => {
      const requestDescriptor = buildUserPageGateAccessRequestDescriptor({
        account,
        networkID: this.props.network?.id,
        pendingKey,
        sbtCacheRevision: this.props.sbtCacheRevision,
      });
      const { cacheKey } = requestDescriptor;
      const cached = this._responseGateAccessStatusByKey.get(cacheKey);
      const checkPlan = buildUserPageGateAccessCheckPlan({
        cachedStatus: cached?.status,
        cachedTs: cached?.ts,
        hasCachedEntry: !!cached,
        hasInFlight: this._responseGateAccessInFlightByKey.has(cacheKey),
        nowMs: now,
        terminalRecheckMs: USERPAGE_GATE_TERMINAL_RECHECK_MS,
        unknownRetryMs: USERPAGE_GATE_UNKNOWN_RETRY_MS,
      });
      if (checkPlan.action === 'skip' || checkPlan.action === 'in-flight') {
        return;
      }
      if (checkPlan.action === 'schedule-retry') {
        this.scheduleResponseGateRetry(checkPlan.retryDelayMs);
        return;
      }

      const previousStatus = checkPlan.previousStatus;
      const shouldPreserveStatusWhileRevalidating = checkPlan.shouldPreserveStatusWhileRevalidating;
      if (checkPlan.shouldSetCheckingStatus) {
        this._setResponseGateAccessStatus(cacheKey, 'checking', now);
      }
      const cfg = getSessionConfigBySlugOrDefault(requestDescriptor.sessionSlug) || {};
      let tracked: ResponseGateAccessCheckPromise | null = null;
      const settleGateAccessStatus = (resultStatus: unknown = 'unknown'): void => {
        const settlementPlan = buildUserPageGateAccessSettlementPlan({
          previousStatus,
          resultStatus,
          shouldPreserveStatusWhileRevalidating,
        });
        this._setResponseGateAccessStatus(cacheKey, settlementPlan.nextStatus, Date.now());
        if (settlementPlan.shouldScheduleRetry) {
          this.scheduleResponseGateRetry(USERPAGE_GATE_UNKNOWN_RETRY_MS);
        }
        if (settlementPlan.shouldQueueCacheRefresh) {
          this.queueCacheRefresh({ markLoading: false });
        }
      };
      const dispatchResult = dispatchUserPageGateAccessCheckThroughPort({
        checkGateAccess: checkSponsoredAccess,
        requestDescriptor,
        sessionConfig: cfg,
      });
      if (dispatchResult.action !== 'dispatch') return;
      tracked = (dispatchResult.promise as Promise<SponsoredAccessResult>)
        .then((result: SponsoredAccessResult) => {
          if (!this._isMounted || generation !== this._responseGateAccessGeneration) return;
          settleGateAccessStatus(result?.status);
        })
        .catch(() => {
          if (!this._isMounted || generation !== this._responseGateAccessGeneration) return;
          settleGateAccessStatus();
        })
        .finally(() => {
          if (this._responseGateAccessInFlightByKey.get(cacheKey) === tracked) {
            this._responseGateAccessInFlightByKey.delete(cacheKey);
          }
        });

      this._responseGateAccessInFlightByKey.set(cacheKey, tracked);
    });
  };

  handleDecryptQuestionAnswer = async (
    questionId: unknown,
    fieldToDecrypt: unknown = 'both',
    responseOverride: unknown = null,
  ): Promise<boolean> => {
    const decryptRequestPlan = buildUserPageResponseDecryptRequestPlan({
      account: this.props.account,
      detailedSurveyResponses: this.state.detailedSurveyResponses,
      hashZero: ethers.constants.HashZero,
      litHooks: getGlobalLitHooks(),
      networkId: this.props.network?.id ?? this.props.networkChainId ?? 0,
      provider: this.props.provider,
      questionId,
      questionResponseInfo: this.state.questionResponseInfo,
      responseOverride,
    });
    if (
      decryptRequestPlan.status !== 'ready' ||
      !decryptRequestPlan.responseSlice ||
      !decryptRequestPlan.cryptoOptions
    ) {
      return false;
    }
    const qid = decryptRequestPlan.questionId;

    let decryptedResult: unknown = null;
    try {
      decryptedResult = await (cryptoUtils as CryptoUtilsWithSingleField).decryptSingleField(
        decryptRequestPlan.responseSlice,
        qid,
        fieldToDecrypt,
        decryptRequestPlan.cryptoOptions,
      );
    } catch (error) {
      accountLog.warn('[UserPage] Failed to decrypt viewed response:', error);
      return false;
    }

    const patchedResponse = buildUserPageDecryptedResponsePatch({
      responseObj: responseOverride,
      questionId: qid,
      fieldToDecrypt,
      decryptedResult,
    });
    if (!patchedResponse) return false;

    let didUpdate = false;
    this.setState((prevState: UnknownRecord) => {
      const patchResult = buildUserPageDecryptedResponseStatePatch({
        patchedResponse,
        previousState: prevState,
        questionId: qid,
        responseOverride,
      });
      didUpdate = patchResult.didUpdate;
      return patchResult.statePatch;
    });

    return didUpdate;
  };

  _evaluateEncryptedVisibility = ({
    resourceKey = 'default',
    slug = '',
    viewAddressLower = '',
    encryptionAudience = 'gate',
    gateContext = null,
  }: EncryptedVisibilityInput = {}): EncryptedVisibilityResult => {
    const statusRequestPlan = buildUserPageEncryptedVisibilityStatusRequestPlan({
      encryptionAudience,
      resourceKey,
      viewAddressLower,
      viewerAccount: this.props.account,
    });
    const displayState =
      statusRequestPlan.action === 'terminal'
        ? statusRequestPlan.displayState
        : buildUserPageEncryptedVisibilityDisplayState({
            encryptionAudience,
            resourceKey,
            statusByResource: statusRequestPlan.resourceKeysToCheck.map((key: string) => ({
              resourceKey: key,
              status: this._getResponseGateAccessStatus({ slug, resourceKey: key }),
            })),
            viewAddressLower,
            viewerAccount: this.props.account,
          });
    if (isGateAccessContext(gateContext)) {
      displayState.pendingResourceKeys.forEach((pendingResourceKey) => {
        gateContext.pendingKeys.add(buildUserPageGatePendingKey({ slug, resourceKey: pendingResourceKey }));
      });
      if (displayState.uncertainResourceKey) {
        gateContext.uncertainResources.add(displayState.uncertainResourceKey);
      }
    }
    return {
      visible: displayState.visible,
      canDecryptOtherResponses: displayState.canDecryptOtherResponses,
      ...(displayState.uncertain ? { uncertain: true } : {}),
    };
  };

  _collectUnifiedCacheData = ({ networkID, viewAddressLower }: UnifiedCacheAggregateInput): unknown =>
    measureSync('ce.userPage.aggregateCacheData', () => {
      const surveysCaches = this._dgReadAll('surveysCache');
      const questionsCaches = this._dgReadAll('questionsCache');
      const sbtCaches = this._dgReadAll('sbtCache');
      const userCaches = this._dgReadAll('userCache');
      const viewAddressKey = String(viewAddressLower || '').toLowerCase();

      const combinedSurveys: EntityCacheMap = {};
      const combinedSurveyResponses: ResponseBucketMap = {};
      const combinedSurveyResponsesMeta: ResponseRecencyBucketMap = {};
      const combinedQuestions: EntityCacheMap = {};
      const combinedQuestionResponses: ResponseBucketMap = {};
      const combinedQuestionResponsesMeta: ResponseRecencyBucketMap = {};
      const sbtAggregate: SbtAggregateMap = {};
      const surveySourceSlugById: SourceSlugMap = {};
      const surveyResponseSourceSlugById: SourceSlugMap = {};
      const surveyResponseSourceSlugByKey: SourceSlugMap = {};
      const questionSourceSlugById: SourceSlugMap = {};
      const questionResponseSourceSlugById: SourceSlugMap = {};
      const questionResponseSourceSlugByKey: SourceSlugMap = {};

      const upsertSurveyResponseByRecency = ({
        sid,
        responder,
        responseValue,
        metaValue = null,
        slug = '',
      }: SurveyResponseRecencyUpsertInput): void => {
        upsertUserPageResponseByRecency({
          id: sid,
          responder,
          responseRecencyMeta: combinedSurveyResponsesMeta,
          responses: combinedSurveyResponses,
          responseSourceSlugByKey: surveyResponseSourceSlugByKey,
          responseValue,
          sourceSlugById: surveyResponseSourceSlugById,
          metaValue,
          slug,
        });
      };

      const upsertQuestionResponseByRecency = ({
        qid,
        responder,
        responseValue,
        metaValue = null,
        slug = '',
      }: QuestionResponseRecencyUpsertInput): void => {
        upsertUserPageResponseByRecency({
          id: qid,
          responder,
          responseRecencyMeta: combinedQuestionResponsesMeta,
          responses: combinedQuestionResponses,
          responseSourceSlugByKey: questionResponseSourceSlugByKey,
          responseValue,
          sourceSlugById: questionResponseSourceSlugById,
          metaValue,
          slug,
        });
      };

      surveysCaches.forEach(({ slug, data: cacheObj }: NamespaceCacheSourceEntry) => {
        mergeUserPageSurveyCacheSource({
          cacheObj,
          combinedSurveyResponses,
          combinedSurveyResponsesMeta,
          combinedSurveys,
          networkID,
          slug,
          surveyResponseSourceSlugById,
          surveyResponseSourceSlugByKey,
          surveySourceSlugById,
        });
      });

      questionsCaches.forEach(({ slug, data: cacheObj }: NamespaceCacheSourceEntry) => {
        mergeUserPageQuestionCacheSource({
          cacheObj,
          combinedQuestionResponses,
          combinedQuestionResponsesMeta,
          combinedQuestions,
          networkID,
          questionResponseSourceSlugById,
          questionResponseSourceSlugByKey,
          questionSourceSlugById,
          slug,
        });
      });

      sbtCaches.forEach(({ slug, data: cacheObj }: NamespaceCacheSourceEntry) => {
        const netEntries = getPrioritizedUserPageNetworkCacheNodes(cacheObj, networkID) as PrioritizedCacheNode[];
        netEntries.forEach(({ value: netObj }) => {
          const sbtList = toAnalysisRecord(netObj.sbtList);
          Object.keys(sbtList).forEach((addrLowerKey: string) => {
            mergeUserPageSbtCacheEntryIntoAggregate({
              sbtAggregate,
              entry: sbtList[addrLowerKey],
              key: addrLowerKey,
              slug,
              viewAddressKey,
            });
          });
        });
      });

      userCaches.forEach(({ slug, data: userCacheObj }: NamespaceCacheSourceEntry) => {
        const userNode = toAnalysisRecord(userCacheObj)[viewAddressKey];
        if (!isPlainAnalysisObject(userNode)) return;
        const chainNode = getActiveUserPageChainNode(userNode, networkID) as UserChainNode | null;
        const payload = isPlainAnalysisObject(chainNode?.data) ? (chainNode.data as UserCachePayload) : null;
        if (!payload) return;

        (Array.isArray(payload.createdSurveys) ? payload.createdSurveys : []).forEach((item: unknown) => {
          const itemRecord = toAnalysisRecord(item);
          if (!itemRecord.id || !itemRecord.data) return;
          const sid = String(itemRecord.id || '').toLowerCase();
          if (!sid) return;
          if (!combinedSurveys[sid]) combinedSurveys[sid] = { ...toAnalysisRecord(itemRecord.data) };
          if (!combinedSurveys[sid].creator) combinedSurveys[sid].creator = viewAddressKey;
          writeUserPageSourceSlug(surveySourceSlugById, sid, slug);
        });

        (Array.isArray(payload.surveyResponses) ? payload.surveyResponses : []).forEach((item: unknown) => {
          const itemRecord = toAnalysisRecord(item);
          if (!itemRecord.surveyId || !itemRecord.response) return;
          const sid = String(itemRecord.surveyId || '').toLowerCase();
          if (!sid) return;
          upsertSurveyResponseByRecency({
            sid,
            responder: String(itemRecord.responder || viewAddressKey).toLowerCase(),
            responseValue: itemRecord.response,
            metaValue: {
              bn: Number(itemRecord.blockNumber ?? itemRecord.bn ?? 0) || 0,
              txi: Number(itemRecord.transactionIndex ?? itemRecord.txIndex ?? itemRecord.txi ?? 0) || 0,
              li: Number(itemRecord.logIndex ?? itemRecord.li ?? 0) || 0,
              ts: Number(itemRecord.timestamp ?? itemRecord.ts ?? 0) || 0,
            },
            slug,
          });
        });

        (Array.isArray(payload.createdQuestions) ? payload.createdQuestions : []).forEach((item: unknown) => {
          const itemRecord = toAnalysisRecord(item);
          if (!itemRecord.id || !itemRecord.data) return;
          const qid = String(itemRecord.id || '').toLowerCase();
          if (!qid) return;
          if (!combinedQuestions[qid]) combinedQuestions[qid] = { ...toAnalysisRecord(itemRecord.data) };
          if (!combinedQuestions[qid].creator) combinedQuestions[qid].creator = viewAddressKey;
          writeUserPageSourceSlug(questionSourceSlugById, qid, slug);
        });

        (Array.isArray(payload.questionResponses) ? payload.questionResponses : []).forEach((item: unknown) => {
          const itemRecord = toAnalysisRecord(item);
          if (!itemRecord.questionId || !itemRecord.response) return;
          const qid = String(itemRecord.questionId || '').toLowerCase();
          if (!qid) return;
          upsertQuestionResponseByRecency({
            qid,
            responder: String(itemRecord.responder || viewAddressKey).toLowerCase(),
            responseValue: itemRecord.response,
            metaValue: {
              bn: Number(itemRecord.blockNumber ?? itemRecord.bn ?? 0) || 0,
              txi: Number(itemRecord.transactionIndex ?? itemRecord.txIndex ?? itemRecord.txi ?? 0) || 0,
              li: Number(itemRecord.logIndex ?? itemRecord.li ?? 0) || 0,
              ts: Number(itemRecord.timestamp ?? itemRecord.ts ?? 0) || 0,
            },
            slug,
          });
        });

        (getPrioritizedUserPageChainNodes(userNode, networkID) as PrioritizedUserChainNode[]).forEach(({ node }) => {
          const chainPayload = isPlainAnalysisObject(node.data) ? (node.data as UserCachePayload) : null;
          if (!chainPayload) return;
          (Array.isArray(chainPayload.sbts) ? chainPayload.sbts : []).forEach((item: unknown) => {
            mergeUserPageUserCacheSbtIntoAggregate({
              sbtAggregate,
              item,
              slug,
              viewAddressKey,
            });
          });
        });
      });

      return {
        combinedSurveys,
        combinedSurveyResponses,
        combinedSurveyResponsesMeta,
        combinedQuestions,
        combinedQuestionResponses,
        combinedQuestionResponsesMeta,
        surveySourceSlugById,
        surveyResponseSourceSlugById,
        surveyResponseSourceSlugByKey,
        questionSourceSlugById,
        questionResponseSourceSlugById,
        questionResponseSourceSlugByKey,
        sbtAggregate,
        userCaches,
      };
    });

  _deriveSurveySection = (
    aggregate: unknown,
    viewAddressLower: unknown,
    gateContext: GateAccessContext | null = null,
  ): unknown =>
    measureSync('ce.userPage.deriveSurveySection', () => {
      const userSurveyResponses: UnknownRecord[] = [];
      const userCreatedSurveys: UnknownRecord[] = [];
      const detailedResponses: Record<string, SurveyQuestionResponseDetail[]> = {};
      const viewAddressKey = String(viewAddressLower || '').toLowerCase();
      const aggregateRecord = toAnalysisRecord(aggregate);
      const combinedSurveys = toAnalysisRecord(aggregateRecord.combinedSurveys);
      const combinedSurveyResponses = toAnalysisRecord(aggregateRecord.combinedSurveyResponses);
      const combinedQuestions = toAnalysisRecord(aggregateRecord.combinedQuestions);
      const surveySourceSlugById = toAnalysisRecord(aggregateRecord.surveySourceSlugById);
      const surveyResponseSourceSlugById = toAnalysisRecord(aggregateRecord.surveyResponseSourceSlugById);
      const surveyResponseSourceSlugByKey = toAnalysisRecord(aggregateRecord.surveyResponseSourceSlugByKey);

      Object.keys(combinedSurveyResponses).forEach((surveyIdLower: string) => {
        const surveyResponsesForThisSurvey = toAnalysisRecord(combinedSurveyResponses[surveyIdLower]);
        const raw = surveyResponsesForThisSurvey[viewAddressKey];
        if (!raw) return;

        const userFullResponseObject = toAnalysisRecord(this.parseCachedResponsePayload(raw));
        const surveyResponses = Array.isArray(userFullResponseObject.responses)
          ? userFullResponseObject.responses
          : null;
        if (!surveyResponses) return;
        const surveyData = toAnalysisRecord(combinedSurveys[surveyIdLower]);
        const sourceDescriptor = buildUserPageSurveyResponseSourceDescriptor({
          surveyId: surveyIdLower,
          surveyResponseSourceSlugById,
          surveyResponseSourceSlugByKey,
          surveySourceSlugById,
          viewAddressLower: viewAddressKey,
        });
        const sourceSlug = sourceDescriptor.sourceSlug;

        const detailedQuestionArray: SurveyQuestionResponseDetail[] = [];
        let hasNonBlank = false;
        surveyResponses.forEach((resp: unknown) => {
          const normalizedResponse = normalizeUserPageSingleQuestionResponsePayload(resp);
          if (!normalizedResponse) return;
          const questionIDLower = normalizedResponse.questionID
            ? String(normalizedResponse.questionID).toLowerCase()
            : 'unknown_question_id';
          const qData = toAnalysisRecord(
            combinedQuestions[questionIDLower] || {
              id: normalizedResponse.questionID || 'unknown_question_id',
              type: normalizedResponse.type || 'unknown',
              prompt: normalizedResponse.prompt || 'Unknown Question',
            },
          );
          const questionEncrypted = isUserPageQuestionPayloadEncrypted(qData);
          const answerEncrypted = isUserPageAnswerFieldEncrypted(normalizedResponse);
          const additionalEncrypted = isUserPageAdditionalFieldEncrypted(normalizedResponse);
          const responseEncrypted = isUserPageResponsePayloadEncrypted(normalizedResponse);
          let canDecryptOtherResponses = false;

          if (questionEncrypted || answerEncrypted) {
            const visibility = this._evaluateEncryptedVisibility({
              resourceKey: 'surveyResponses',
              slug: sourceSlug,
              viewAddressLower,
              encryptionAudience: answerEncrypted
                ? inferUserPageResponseFieldEncryptionAudience(normalizedResponse, 'answer', 'gate')
                : 'gate',
              gateContext,
            });
            if (!visibility.visible) return;
            canDecryptOtherResponses = !!visibility.canDecryptOtherResponses;
          } else if (additionalEncrypted) {
            const visibility = this._evaluateEncryptedVisibility({
              resourceKey: 'surveyResponses',
              slug: sourceSlug,
              viewAddressLower,
              encryptionAudience: inferUserPageResponseFieldEncryptionAudience(
                normalizedResponse,
                'additional',
                'gate',
              ),
              gateContext,
            });
            canDecryptOtherResponses = !!(visibility.visible && visibility.canDecryptOtherResponses);
          }

          const nonBlank = hasDisplayableUserPageResponsePayload(normalizedResponse);
          if (nonBlank || responseEncrypted) hasNonBlank = true;

          detailedQuestionArray.push({
            questionData: qData,
            responseData: normalizedResponse,
            canDecryptOtherResponses,
            responseEncryption: {
              answerEncrypted,
              additionalEncrypted,
            },
          });
        });

        if (!hasNonBlank) return;
        const fallbackQuestionCount = detailedQuestionArray.length;
        const surveyQuestionCount = Array.isArray(surveyData?.questionIDs) ? surveyData.questionIDs.length : 0;
        userSurveyResponses.push({
          title: surveyData.title || 'Untitled Survey',
          questionsCount: surveyQuestionCount > 0 ? surveyQuestionCount : fallbackQuestionCount,
          id: surveyIdLower,
          tags: Array.isArray(surveyData?.tags) ? surveyData.tags : [],
          documentURLs: Array.isArray(surveyData?.documentURLs) ? surveyData.documentURLs : [],
          slug: sourceSlug,
        });
        detailedResponses[surveyIdLower] = detailedQuestionArray;
      });

      Object.keys(combinedSurveys).forEach((surveyIdLower: string) => {
        const surveyData = toAnalysisRecord(combinedSurveys[surveyIdLower]);
        if (surveyData.creator && String(surveyData.creator).toLowerCase() === viewAddressKey) {
          const questionIDs = Array.isArray(surveyData?.questionIDs) ? surveyData.questionIDs : [];
          const questionPreviews = questionIDs.map((qidRaw: unknown) => {
            const fullQuestionId = String(qidRaw || '');
            const qData = toAnalysisRecord(combinedQuestions[fullQuestionId.toLowerCase()]);
            return {
              id: fullQuestionId,
              text: resolveUserPageQuestionPromptText(qData),
            };
          });
          userCreatedSurveys.push({
            title: surveyData.title || 'Untitled Survey',
            questionsCount: questionIDs.length,
            id: surveyIdLower,
            tags: Array.isArray(surveyData?.tags) ? surveyData.tags : [],
            documentURLs: Array.isArray(surveyData?.documentURLs) ? surveyData.documentURLs : [],
            questionIDs,
            questionPreviews,
            slug: surveySourceSlugById[surveyIdLower] || '',
          });
        }
      });

      return {
        surveyResponseInfo: userSurveyResponses,
        surveyCreationInfo: userCreatedSurveys,
        detailedSurveyResponses: detailedResponses,
        surveysResponded: userSurveyResponses.length,
        surveysCreated: userCreatedSurveys.length,
      } satisfies SurveySectionResult;
    });

  _deriveQuestionSection = (
    aggregate: unknown,
    viewAddressLower: unknown,
    gateContext: GateAccessContext | null = null,
  ): unknown =>
    measureSync('ce.userPage.deriveQuestionSection', () => {
      const userCreatedQuestions: UnknownRecord[] = [];
      const userQuestionResponsesInfo: QuestionResponseInfoEntry[] = [];
      const detailedSingleQuestionResponses: Record<string, NormalizedQuestionResponsePayload> = {};
      const viewAddressKey = String(viewAddressLower || '').toLowerCase();
      const aggregateRecord = toAnalysisRecord(aggregate);
      const combinedQuestions = toAnalysisRecord(aggregateRecord.combinedQuestions);
      const combinedQuestionResponses = toAnalysisRecord(aggregateRecord.combinedQuestionResponses);
      const combinedQuestionResponsesMeta = toAnalysisRecord(aggregateRecord.combinedQuestionResponsesMeta);
      const questionSourceSlugById = toAnalysisRecord(aggregateRecord.questionSourceSlugById);
      const questionResponseSourceSlugById = toAnalysisRecord(aggregateRecord.questionResponseSourceSlugById);
      const questionResponseSourceSlugByKey = toAnalysisRecord(aggregateRecord.questionResponseSourceSlugByKey);

      Object.keys(combinedQuestions).forEach((qid: string) => {
        const qData = toAnalysisRecord(combinedQuestions[qid]);
        const sourceSlug = resolveUserPageQuestionSourceSessionSlug({
          fallbackSlug: questionSourceSlugById[qid] || questionResponseSourceSlugById[qid] || '',
          getSessionSlugByName,
          questionData: qData,
        });
        if (qData.creator && String(qData.creator).toLowerCase() === viewAddressKey) {
          if (isUserPageQuestionPayloadEncrypted(qData)) {
            const visibility = this._evaluateEncryptedVisibility({
              resourceKey: 'questionResponses',
              slug: sourceSlug,
              viewAddressLower: viewAddressKey,
              encryptionAudience: 'gate',
              gateContext,
            });
            if (!visibility.visible) return;
          }
          userCreatedQuestions.push({
            prompt: qData.prompt || 'Unknown Prompt',
            type: qData.type || 'unknown',
            id: qid,
            slug: sourceSlug,
            sessionSlug: sourceSlug,
          });
        }
      });

      Object.keys(combinedQuestionResponses).forEach((qid: string) => {
        const perQ = toAnalysisRecord(combinedQuestionResponses[qid]);
        const candidate = perQ[viewAddressKey];
        if (!candidate) return;
        const responseMeta = toAnalysisRecord(toAnalysisRecord(combinedQuestionResponsesMeta[qid])[viewAddressKey]);

        const parsedResponse = this.parseCachedResponsePayload(candidate);
        const parsedResponseRecord = toAnalysisRecord(parsedResponse);
        const responseMetaRecord = toAnalysisRecord(responseMeta);
        const normalizedInput = isPlainAnalysisObject(parsedResponse)
          ? {
              ...parsedResponseRecord,
              ...(Object.keys(responseMetaRecord).length > 0
                ? {
                    blockNumber:
                      Number(
                        parsedResponseRecord.blockNumber ??
                          responseMetaRecord.bn ??
                          responseMetaRecord.blockNumber ??
                          0,
                      ) || 0,
                    transactionIndex:
                      Number(
                        parsedResponseRecord.transactionIndex ??
                          parsedResponseRecord.txIndex ??
                          responseMetaRecord.txi ??
                          responseMetaRecord.transactionIndex ??
                          responseMetaRecord.txIndex ??
                          0,
                      ) || 0,
                    logIndex:
                      Number(
                        parsedResponseRecord.logIndex ?? responseMetaRecord.li ?? responseMetaRecord.logIndex ?? 0,
                      ) || 0,
                    timestamp:
                      Number(
                        parsedResponseRecord.timestamp ?? responseMetaRecord.ts ?? responseMetaRecord.timestamp ?? 0,
                      ) || 0,
                  }
                : {}),
            }
          : parsedResponse;
        const userResponseObject = normalizeUserPageSingleQuestionResponsePayload(normalizedInput);
        if (!userResponseObject) return;

        const qData = toAnalysisRecord(
          combinedQuestions[qid] || {
            id: qid,
            type: userResponseObject?.type || 'unknown',
            prompt: userResponseObject?.prompt || 'Unknown Prompt',
          },
        );

        const sourceDescriptor = buildUserPageQuestionResponseSourceDescriptor({
          getSessionSlugByName,
          questionData: qData,
          questionId: qid,
          questionResponseSourceSlugById,
          questionResponseSourceSlugByKey,
          questionSourceSlugById,
          viewAddressLower: viewAddressKey,
        });
        const sourceSlug = sourceDescriptor.sourceSlug;
        const questionEncrypted = isUserPageQuestionPayloadEncrypted(qData);
        const answerEncrypted = isUserPageAnswerFieldEncrypted(userResponseObject);
        const additionalEncrypted = isUserPageAdditionalFieldEncrypted(userResponseObject);
        const responseEncrypted = isUserPageResponsePayloadEncrypted(userResponseObject);
        let canDecryptOtherResponses = false;
        if (questionEncrypted || answerEncrypted) {
          const visibility = this._evaluateEncryptedVisibility({
            resourceKey: 'questionResponses',
            slug: sourceSlug,
            viewAddressLower: viewAddressKey,
            encryptionAudience: answerEncrypted
              ? inferUserPageResponseFieldEncryptionAudience(userResponseObject, 'answer', 'gate')
              : 'gate',
            gateContext,
          });
          if (!visibility.visible) return;
          canDecryptOtherResponses = !!visibility.canDecryptOtherResponses;
        } else if (additionalEncrypted) {
          const visibility = this._evaluateEncryptedVisibility({
            resourceKey: 'questionResponses',
            slug: sourceSlug,
            viewAddressLower: viewAddressKey,
            encryptionAudience: inferUserPageResponseFieldEncryptionAudience(userResponseObject, 'additional', 'gate'),
            gateContext,
          });
          canDecryptOtherResponses = !!(visibility.visible && visibility.canDecryptOtherResponses);
        }

        const nonBlank = hasDisplayableUserPageResponsePayload(userResponseObject);
        const hasSubmissionHints =
          hasUserPageResponseSubmissionHints(userResponseObject) ||
          hasUserPageResponseSubmissionHints(parsedResponse) ||
          hasUserPageResponseSubmissionHints(candidate);
        const hasDisplayableResponse = nonBlank || responseEncrypted || hasSubmissionHints;
        if (!hasDisplayableResponse) return;
        const responseRecency = extractUserPageResponseRecency(userResponseObject, responseMeta);

        userQuestionResponsesInfo.push({
          prompt: qData.prompt || 'Unknown Prompt',
          type: qData.type || 'unknown',
          id: qid,
          slug: sourceSlug,
          sessionSlug: sourceSlug,
          canDecryptOtherResponses,
          responseEncryption: {
            answerEncrypted,
            additionalEncrypted,
          },
          _responseRecency: responseRecency,
        });
        detailedSingleQuestionResponses[qid] = userResponseObject;
      });

      const normalizedQuestionResponseInfo = normalizeUserPageQuestionResponseInfoOrder(userQuestionResponsesInfo);

      return {
        questionCreationInfo: userCreatedQuestions,
        questionResponseInfo: normalizedQuestionResponseInfo,
        detailedQuestionResponses: detailedSingleQuestionResponses,
        questionsCreated: userCreatedQuestions.length,
        questionsResponded: normalizedQuestionResponseInfo.length,
      } satisfies QuestionSectionResult;
    });

  _deriveSbtSection = (aggregate: unknown, viewAddressLower: unknown): unknown =>
    measureSync('ce.userPage.deriveSbtSection', () => {
      const sbtSection = buildUserPageSbtSection({
        aggregate,
        viewAddressLower,
        getSbtDisplayName,
        getShortenedAddress,
        translate: t,
      });
      if (sbtSection.telemetry) {
        if (sbtSection.telemetry.signature !== this._lastProfileDeriveTelemetrySignature) {
          this._lastProfileDeriveTelemetrySignature = sbtSection.telemetry.signature;
          this.emitProfileTelemetry('derive-sbt-section', sbtSection.telemetry.payload);
        }
      }
      return {
        sbtList: sbtSection.sbtList,
        badgesReceived: sbtSection.badgesReceived,
      } satisfies SbtSectionResult;
    });

  _refreshAllDataFromCache = ({
    force = false,
    markLoading = false,
    bypassSignature = false,
  }: Partial<CacheRefreshOptions> = {}): void => {
    if (!this._isMounted) return;
    const viewAddress = this.props.viewAddress;
    const networkID = this.props.network?.id != null ? this.props.network.id.toString() : '';

    if (!viewAddress) {
      this._lastCacheRefreshInputSignature = '';
      this._clearUnifiedCacheAggregateMemo();
      this._clearSectionDeriveMemo();
      this.setState((prevState: UnknownRecord) => buildUserPageMissingAddressCacheStateUpdate(prevState));
      return;
    }

    const surveysReady = !!this.props.isSurveyCacheReady;
    const questionsReady = !!this.props.isQuestionCacheReady;
    const responsesReady = !!this.props.isResponsesCacheReady;
    const sbtReady = !!this.props.isSBTCacheReady;

    const sourceSnapshot = this._readCacheSourceSnapshot();
    const gateRecheckEpoch =
      this._responseGateAccessStatusByKey.size > 0 ? Math.floor(Date.now() / USERPAGE_GATE_UNKNOWN_RETRY_MS) : 0;
    const cacheRefreshDescriptor = buildUserPageCacheRefreshRequestDescriptor({
      account: this.props.account,
      bypassSignature,
      currentInputSignature: this._lastCacheRefreshInputSignature,
      force,
      gateRecheckEpoch,
      hasUncertainGateAccess: this.state.hasUncertainGateAccess,
      hasUncertainUserData: this.state.hasUncertainUserData,
      isQuestionCacheReady: this.props.isQuestionCacheReady,
      isResponsesCacheReady: this.props.isResponsesCacheReady,
      isSBTCacheReady: this.props.isSBTCacheReady,
      isSurveyCacheReady: this.props.isSurveyCacheReady,
      markLoading,
      networkID,
      questionResponsesNonce: this.props.questionResponsesNonce,
      responseGateAccessGeneration: this._responseGateAccessGeneration,
      responseGateAccessStatusVersion: this._responseGateAccessStatusVersion,
      sbtCacheRevision: this.props.sbtCacheRevision,
      sourceSnapshot,
      viewAddress,
    });
    if (cacheRefreshDescriptor.action === 'skip-same-signature') {
      return;
    }
    this._lastCacheRefreshInputSignature = cacheRefreshDescriptor.refreshInputSignature;

    const {
      hasQuestionSources,
      hasSbtSources,
      hasSurveySources,
      holdQuestionLoading,
      holdSbtLoading,
      holdSurveyLoading,
      sourcePresence,
      viewAddressLower,
    } = cacheRefreshDescriptor;

    this.emitProfileColdDiag('refresh', {
      viewAddress: viewAddressLower,
      force,
      markLoading,
      bypassSignature,
      surveysReady,
      questionsReady,
      responsesReady,
      sbtReady,
      hasSurveySources,
      hasQuestionSources,
      hasSbtSources,
      holdSurveyLoading,
      holdQuestionLoading,
      holdSbtLoading,
      isDeepScanning: this.state.isDeepScanning,
      hasUncertainUserData: this.state.hasUncertainUserData,
      questionResponsesNonce: this.props.questionResponsesNonce,
      sbtCacheRevision: this.props.sbtCacheRevision,
      sourceMembership: sourceSnapshot.membershipSignature,
    });

    let aggregate: UnknownRecord | null = null;
    let surveySection: SurveySectionResult | null = null;
    let questionSection: QuestionSectionResult | null = null;
    let sbtSection: SbtSectionResult | null = null;
    let deepScanTooltipLines: string[] | null = null;
    let deepScanProgressRows: DeepScanProgressRow[] | null = null;
    const gateContext = createGateAccessContext();

    try {
      const aggregateMemoPlan = buildUserPageUnifiedCacheAggregateMemoPlan({
        currentAggregateMemo: this._unifiedCacheAggregateMemo,
        currentAggregateMemoKey: this._unifiedCacheAggregateMemoKey,
        viewAddressLower,
        networkID,
        questionResponsesNonce: this.props.questionResponsesNonce,
        sbtCacheRevision: this.props.sbtCacheRevision,
        sourceMembershipSignature: sourceSnapshot.membershipSignature,
      });
      if (aggregateMemoPlan.canReuseAggregate) {
        aggregate = aggregateMemoPlan.aggregate as UnknownRecord;
      } else {
        aggregate = this._collectUnifiedCacheData({ networkID, viewAddressLower }) as UnknownRecord;
        this._unifiedCacheAggregateMemo = aggregate;
        this._unifiedCacheAggregateMemoKey = aggregateMemoPlan.aggregateMemoKey;
      }
      const latestBlockRaw = this.props.latestBlockNumber;
      const latestBlockNum = Number.isFinite(Number(latestBlockRaw)) ? Number(latestBlockRaw) : null;
      const currentChainId = this.props.network?.id != null ? Number(this.props.network.id) : null;
      deepScanProgressRows = this._deriveDeepScanProgressRows(
        aggregate.userCaches as UserCacheSourceEntry[] | null | undefined,
        viewAddressLower,
        currentChainId,
        latestBlockNum,
      );
      deepScanTooltipLines = formatUserPageDeepScanTooltipLinesFromRows(
        deepScanProgressRows,
        formatUserPageDeepScanBlockCount,
      );

      if (!holdSurveyLoading) {
        const surveyMemoPlan = buildUserPageResponseSectionDeriveMemoPlan({
          account: this.props.account,
          currentMemo: this._sectionDeriveMemo?.survey,
          force,
          viewAddressLower,
          networkID,
          questionResponsesNonce: this.props.questionResponsesNonce,
          responseGateAccessGeneration: this._responseGateAccessGeneration,
          responseGateAccessStatusVersion: this._responseGateAccessStatusVersion,
          sourceSignature: sourceSnapshot.surveySourcesSignature,
        });
        if (surveyMemoPlan.canReuseMemo) {
          surveySection = surveyMemoPlan.result as SurveySectionResult;
          mergeGateContextSnapshot(gateContext, surveyMemoPlan.gateSnapshot as GateAccessContextSnapshot | null);
        } else {
          const surveyGateContext = createGateAccessContext();
          surveySection = this._deriveSurveySection(
            aggregate,
            viewAddressLower,
            surveyGateContext,
          ) as SurveySectionResult;
          const surveyGateSnapshot = captureGateContextSnapshot(surveyGateContext);
          mergeGateContextSnapshot(gateContext, surveyGateSnapshot);
          this._sectionDeriveMemo.survey = {
            signature: surveyMemoPlan.signature,
            result: surveySection,
            gateSnapshot: surveyGateSnapshot,
          };
        }
      }
      if (!holdQuestionLoading) {
        const questionMemoPlan = buildUserPageResponseSectionDeriveMemoPlan({
          account: this.props.account,
          currentMemo: this._sectionDeriveMemo?.question,
          force,
          viewAddressLower,
          networkID,
          questionResponsesNonce: this.props.questionResponsesNonce,
          responseGateAccessGeneration: this._responseGateAccessGeneration,
          responseGateAccessStatusVersion: this._responseGateAccessStatusVersion,
          sourceSignature: sourceSnapshot.questionSourcesSignature,
        });
        if (questionMemoPlan.canReuseMemo) {
          questionSection = questionMemoPlan.result as QuestionSectionResult;
          mergeGateContextSnapshot(gateContext, questionMemoPlan.gateSnapshot as GateAccessContextSnapshot | null);
        } else {
          const questionGateContext = createGateAccessContext();
          questionSection = this._deriveQuestionSection(
            aggregate,
            viewAddressLower,
            questionGateContext,
          ) as QuestionSectionResult;
          const questionGateSnapshot = captureGateContextSnapshot(questionGateContext);
          mergeGateContextSnapshot(gateContext, questionGateSnapshot);
          this._sectionDeriveMemo.question = {
            signature: questionMemoPlan.signature,
            result: questionSection,
            gateSnapshot: questionGateSnapshot,
          };
        }
      }
      if (!holdSbtLoading) {
        const sbtMemoPlan = buildUserPageSbtSectionDeriveMemoPlan({
          currentMemo: this._sectionDeriveMemo?.sbt,
          force,
          viewAddressLower,
          networkID,
          sbtCacheRevision: this.props.sbtCacheRevision,
          sourceSignature: sourceSnapshot.sbtSourcesSignature,
        });
        if (sbtMemoPlan.canReuseMemo) {
          sbtSection = sbtMemoPlan.result as SbtSectionResult;
        } else {
          sbtSection = this._deriveSbtSection(aggregate, viewAddressLower) as SbtSectionResult;
          this._sectionDeriveMemo.sbt = {
            signature: sbtMemoPlan.signature,
            result: sbtSection,
          };
        }
      }
    } catch (error) {
      accountLog.error('Error processing user data from cache:', error);
    }

    this.emitProfileColdDiag(
      'derive',
      buildUserPageDeriveTelemetrySnapshot({
        aggregate,
        questionSection,
        sbtSection,
        surveySection,
      }),
    );

    const refreshTelemetry = buildUserPageRefreshTelemetrySnapshot({
      aggregate,
      bypassSignature,
      deepScanTooltipLines,
      force,
      hasSbtSources,
      hasUncertainGateAccess: this.state.hasUncertainGateAccess,
      hasUncertainUserData: this.state.hasUncertainUserData,
      holdSbtLoading,
      isDeepScanning: this.state.isDeepScanning,
      markLoading,
      networkID,
      sbtReady,
      sbtSection,
      sourcePresence,
      viewAddressLower,
    });
    const refreshSig = buildUserPageRefreshTelemetrySignature(refreshTelemetry);
    if (refreshSig !== this._lastProfileRefreshTelemetrySignature) {
      this._lastProfileRefreshTelemetrySignature = refreshSig;
      this._lastProfileRefreshTelemetry = refreshTelemetry;
      this.emitProfileTelemetry('refresh-cache-snapshot', refreshTelemetry);
    }

    const shouldRetryQuestionData = shouldRetryUserPageQuestionData({
      hasUncertainUserData: this.state.hasUncertainUserData,
      holdQuestionLoading,
      questionSection,
    });
    this._queueResponseGateAccessChecks(gateContext.pendingKeys);
    if (gateContext.uncertainResources.size > 0 || shouldRetryQuestionData) {
      this.scheduleResponseGateRetry(USERPAGE_GATE_UNKNOWN_RETRY_MS);
    } else {
      this.clearResponseGateRetryTimer();
    }

    this.setState((prevState: UnknownRecord) => {
      const cacheRefreshStatePatchPlan = buildUserPageCacheRefreshStatePatch({
        aggregatePresent: !!aggregate,
        deepScanProgressRows,
        deepScanTooltipLines,
        hasQuestionSources,
        hasSbtSources,
        hasSurveySources,
        holdQuestionLoading,
        holdSbtLoading,
        holdSurveyLoading,
        isDeepScanLoadingEnabledForSection: this.isDeepScanLoadingEnabledForSection,
        markLoading,
        prevState,
        questionSection,
        sbtSection,
        surveySection,
        uncertainResources: gateContext.uncertainResources,
      });

      this.emitProfileColdDiag('loading-flags', cacheRefreshStatePatchPlan.loadingDiag);

      return cacheRefreshStatePatchPlan.statePatch;
    });
  };

  // -----------------------------------------------------------
  //        COPY / BOOKMARK / COLLAPSE / USERNAME
  // -----------------------------------------------------------

  copyToClipboard = async (): Promise<void> => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard write is unavailable');
      await navigator.clipboard.writeText(this.props.viewAddress);
      notify.success('Copied to clipboard');
      if (this._isMounted) {
        this.setState(buildUserPageCopiedStatePatch({ copied: true }), () => {
          setTimeout(() => {
            if (this._isMounted) {
              this.setState(buildUserPageCopiedStatePatch());
            }
          }, 2500);
        });
      }
    } catch (error: unknown) {
      accountLog.warn('UserPage address clipboard write failed:', error);
      notify.error('Could not copy address');
    }
  };

  toggleCollapse = (): void => {
    if (this._isMounted) {
      this.setState((prevState: UnknownRecord) =>
        buildUserPageBooleanTogglePatch({
          state: prevState,
          stateKey: 'collapseOpen',
        }),
      );
    }
  };

  openFullPage = (): void => {
    window.open(buildPublicRoute(`/u/${this.props.viewAddress}`));
  };

  handleUsernameChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    if (this._isMounted) {
      this.setState(buildUserPageUsernameChangeStatePatch({ username: event.target.value }));
    }
  };

  onUsernamePenClick = (): void => {
    if (!this._isMounted) return;
    this.setState(buildUserPageUsernameEditOpenStatePatch(), () => {
      // focus the input when it shows (best-effort via microtask)
      setTimeout(() => {
        try {
          const el = document.querySelector('input[aria-label="Set username"]') as HTMLInputElement | null;
          if (el) {
            el.focus();
            el.select();
          }
        } catch (e) {
          accountLog.warn('UserPage: fallback', e);
        }
      }, 0);
    });
  };

  cancelUsernameEdit = (): void => {
    if (!this._isMounted) return;
    this.setState(buildUserPageUsernameEditCancelStatePatch());
    this.loadPersistedUsername(); // Revert to saved value
  };

  handleUsernameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      this.setUsername();
    } else if (e.key === 'Escape') {
      this.cancelUsernameEdit();
    }
  };

  setUsername = (): void => {
    const newUsernameToSet = this.state.username;
    const { account, viewAddress, network } = this.props;

    if (account && viewAddress && account.toLowerCase() === viewAddress.toLowerCase()) {
      if (!this._isMounted) return;
      if (!network?.id) {
        this.setState({
          ...buildUserPageUsernameErrorStatePatch({
            usernameError: 'Cannot persist username: network information is missing.',
          }),
          isEditingUsername: true,
        });
        return;
      }
      const networkID = network.id.toString();
      try {
        localStorage.setItem(`userPageUsername_${networkID}_${viewAddress.toLowerCase()}`, newUsernameToSet);
      } catch (error) {
        accountLog.error('Error saving username to localStorage:', error);
        if (this._isMounted) {
          this.setState({
            ...buildUserPageUsernameErrorStatePatch({ usernameError: 'Failed to save username locally.' }),
            isEditingUsername: true,
          });
        }
        return;
      }
      if (this._isMounted) {
        this.setState(buildUserPageUsernameSaveStatePatch({ username: newUsernameToSet }));
      }
    } else {
      if (this._isMounted) {
        this.setState(
          buildUserPageUsernameErrorStatePatch({ usernameError: 'Can only set username for your own account.' }),
        );
      }
    }
  };

  toggleBookmark = (optionalMeta: BookmarkToggleMeta | React.MouseEvent<HTMLElement> = {}): void => {
    if (!this.props.viewAddress) return;
    const bookmarkMeta = optionalMeta as BookmarkToggleMeta;
    let bookmarksCache = this.getBookmarksCache();
    const toggleResult = applyUserPageBookmarkToggle({
      address: this.props.viewAddress,
      bookmarkMeta,
      bookmarksCache,
      currentNickname: this.state.nicknameInput,
      networkId: this.props.network?.id,
      onchainUsername: this.getOnchainUsername(this.props.viewAddress, this.props.network),
    });
    bookmarksCache = toggleResult.bookmarksCache;

    this.persistBookmarksCache(bookmarksCache, 'toggleBookmark');
    if (this._isMounted) {
      this.setState(buildUserPageBookmarkToggleStatePatch(toggleResult));
    }
  };

  checkIfBookmarked = (): void => {
    if (!this.props.viewAddress) return;
    const bookmarksCache = this.getBookmarksCache();

    const { bookmarked: found, nickname: objNickname } = resolveUserPageBookmarkStatus({
      address: this.props.viewAddress,
      users: bookmarksCache.users,
    });

    if (this._isMounted) {
      const nextState = buildUserPageBookmarkStatusStateUpdate({
        bookmarked: found,
        nickname: objNickname,
        state: this.state,
      });
      if (nextState) {
        this.setState(nextState);
      }
    }
  };

  // ---- Analyze helpers (timer management) ----
  startAnalysisTimer = (): void => {
    this.clearAnalysisTimer();
    const startedAt = Date.now();
    this.analysisTimer = setInterval(() => {
      if (!this._isMounted) return;
      this.setState(
        buildUserPageAnalysisElapsedStatePatch({
          nowMs: Date.now(),
          startedAt,
        }),
      );
    }, 250);
  };

  clearAnalysisTimer = (): void => {
    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }
  };

  _getAiSessionScopeContext = (): UserPageAiSessionScopeContext => {
    return buildUserPageAiSessionScopeContext({
      activeSessionSlug: this.props.activeSessionSlug,
      scanScope: globalState?.CE_SESSION_SCAN_SCOPE,
      scanSlugs: globalState?.CE_SESSION_SCAN_SLUGS,
    });
  };

  _getAiSessionSlugCandidates = (): string[] => {
    return buildUserPageAiSessionSlugCandidates({
      activeSessionSlug: this.props.activeSessionSlug,
      listNamespaceSlugs: listNamespaceSlugsSync,
      sbtList: this.state.sbtList,
      scopeContext: this._getAiSessionScopeContext(),
    });
  };

  _getSessionConfigForSlugExact = (slugIn: unknown = ''): UnknownRecord | null => {
    const slug = normalizeSessionSlug(slugIn || '');
    const propConfig =
      this.props.sessionConfig &&
      typeof this.props.sessionConfig === 'object' &&
      !Array.isArray(this.props.sessionConfig)
        ? (this.props.sessionConfig as UnknownRecord)
        : null;
    const propSlug = normalizeSessionSlug(
      resolveActiveSessionSlug(propConfig || {}) || this.props.activeSessionSlug || this.props.sessionSlug || '',
    );
    // Profile routes already resolve their explicit session (including a pinned
    // Worker-backed demo) before rendering. Preserve that authoritative config
    // instead of dropping it because it is not duplicated in the strict registry.
    if (propConfig && propSlug === slug) return propConfig;
    return resolveUserPageAnalysisSessionConfigForSlug({
      getSessionConfigBySlug,
      getSessionConfigBySlugOrDefault,
      slugIn: slug,
    });
  };

  resolveAnalysisSessionContext = async (excludeSlugs: unknown = []): Promise<AiSessionResolution | null> => {
    const excludeSet = buildUserPageAnalysisExcludeSlugSet({ excludeSlugs });
    const activeSlug = normalizeSessionSlug(this.props.activeSessionSlug || '');
    const account = String(this.props.account || '').trim();
    const candidates = this._getAiSessionSlugCandidates();
    const scopeContext = this._getAiSessionScopeContext();
    const checked: AiSessionCandidate[] = [];
    let activeCandidate: AiSessionCandidate | null = null;
    let firstUsable: AiSessionCandidate | null = null;

    for (const slug of candidates) {
      if (excludeSet.has(slug)) continue;
      const sessionConfig = this._getSessionConfigForSlugExact(slug);
      if (!sessionConfig) continue;

      let status = 'unknown';
      try {
        const access = await checkSponsoredAccess({
          sessionConfig,
          sessionSlug: slug,
          account,
          resourceKey: 'ai',
        });
        status =
          String(access?.status || 'unknown')
            .trim()
            .toLowerCase() || 'unknown';
      } catch (_) {
        status = 'unknown';
      }

      const row = { slug, sessionConfig, status };
      checked.push(row);
      if (slug === activeSlug) activeCandidate = row;
      if (!firstUsable && status !== 'denied' && status !== 'invalid-gate') {
        firstUsable = row;
      }
      if (status === 'no-gate' || status === 'granted') {
        const reason = 'open-ai-gate';
        accountLog.log('[UserPage] analyze session selected', {
          activeSlug,
          selectedSlug: slug,
          status,
          reason,
          scopeMode: scopeContext.mode,
          candidates: buildUserPageAnalysisCandidateLogRows(checked),
        });
        return { ...row, reason };
      }
    }

    const fallbackSelection = resolveUserPageAnalysisSessionFallback({
      activeCandidate,
      checked,
      firstUsable,
    });
    if (fallbackSelection) {
      const { candidate: fallbackRaw, reason } = fallbackSelection;
      const fallback = fallbackRaw as AiSessionCandidate;
      accountLog.log('[UserPage] analyze session fallback', {
        activeSlug,
        selectedSlug: fallback.slug,
        status: fallback.status,
        reason,
        scopeMode: scopeContext.mode,
        candidates: buildUserPageAnalysisCandidateLogRows(checked),
      });
      return { ...fallback, reason };
    }
    accountLog.warn('[UserPage] analyze session unavailable', {
      activeSlug,
      scopeMode: scopeContext.mode,
      candidateCount: candidates.length,
    });
    return null;
  };

  _aiCheckSeq: number = 0;

  _checkAiAvailability = async (): Promise<void> => {
    if (!this._isMounted) return;
    const seq = ++this._aiCheckSeq;
    try {
      const session = await this.resolveAnalysisSessionContext();
      if (this._isMounted && seq === this._aiCheckSeq) {
        this.setState(buildUserPageAiAvailabilityStatePatch({ available: session !== null }));
      }
    } catch (_) {
      if (this._isMounted && seq === this._aiCheckSeq) {
        this.setState(buildUserPageAiAvailabilityStatePatch({ available: false }));
      }
    }
  };

  _buildAnalysisCacheContext = async ({
    userData,
    analysisSession,
    addressLower,
    networkId,
  }: UserAnalysisCacheContextArgs): Promise<UserAnalysisCacheContext> => {
    const sessionSlug = String(analysisSession?.slug || '');
    const aiContext = await resolveUserAnalysisAiContext(sessionSlug, analysisSession?.sessionConfig || {});
    const fingerprint = await buildUserAnalysisFingerprint({
      userData,
      address: addressLower,
      networkId,
      sessionSlug,
      provider: aiContext.provider,
      model: aiContext.model,
    });
    return {
      sessionSlug,
      aiContext,
      fingerprint,
    };
  };

  _readAnalysisCacheEntry = (descriptor: UserPageAnalysisCacheReadDescriptor): UserAnalysisCacheEntry | null => {
    const cacheRead = readUserPageAnalysisCacheThroughPort({
      cacheVersion: USER_ANALYSIS_CACHE_VERSION,
      now: Date.now(),
      descriptor,
      peekCache: peekCacheSync,
    });
    if (cacheRead.status === 'error') {
      accountLog.warn('[UserPage] analysis cache read failed:', cacheRead.error);
    }
    return cacheRead.entry as UserAnalysisCacheEntry | null;
  };

  _hydrateAnalysisFromCache = (entry: UserAnalysisCacheEntry): void => {
    this.clearAnalysisTimer();
    this.setState(
      buildUserPageAnalysisResultStatePatch({
        cachedAt: entry?.cachedAt,
        includeElapsed: true,
        includeError: true,
        includeModal: true,
        result: entry?.result || {},
        servedFromCache: true,
      }),
    );
  };

  _writeAnalysisCacheEntry = async ({
    sessionSlug,
    networkId,
    addressLower,
    fingerprint,
    aiContext,
    result,
  }: UserAnalysisCacheWriteArgs): Promise<UserAnalysisCacheEntry> => {
    const cacheWrite = await writeUserPageAnalysisCacheThroughPort({
      addressLower,
      aiContext,
      cacheVersion: USER_ANALYSIS_CACHE_VERSION,
      cachedAt: Date.now(),
      fingerprint,
      networkId,
      peekCache: peekCacheSync,
      result,
      sessionSlug,
      ttlMs: USER_ANALYSIS_TTL_MS,
      writeCache: writeCacheTyped,
    });
    if (cacheWrite.status === 'error') {
      throw cacheWrite.error;
    }
    return cacheWrite.entry as UserAnalysisCacheEntry;
  };

  analyzeUser = async (forceRefresh: unknown = false): Promise<void> => {
    if (!this._isMounted) return;

    // --- Assemble inputs strictly from current state (already hydrated from other caches) ---
    const sbts = buildUserPageAnalysisSbts({
      getSbtDisplayName,
      sbtList: this.state.sbtList,
    });

    // Question-level responses (all types; only visible)
    const questions = buildUserPageAnalysisQuestions({
      detailedQuestionResponses: this.state.detailedQuestionResponses,
      questionResponseInfo: this.state.questionResponseInfo,
    });

    // Survey-level summaries + samples of answered items (with types & additional comments)
    const surveys = buildUserPageAnalysisSurveys({
      detailedSurveyResponses: this.state.detailedSurveyResponses,
      surveyResponseInfo: this.state.surveyResponseInfo,
    });

    // Created content (counts + actual items)
    const questionsCreated = buildUserPageAnalysisCreatedQuestions(this.state.questionCreationInfo);

    // For surveys the user created, include title + a small sample of question prompts/types
    let surveysCreated: unknown[] = [];
    try {
      const networkID = this.props.network?.id?.toString();
      const slug = this.props.activeSessionSlug == null ? '' : this.props.activeSessionSlug;
      const createdSurveyCacheRead = readUserPageAnalysisCreatedSurveyCachesThroughPort({
        networkID,
        peekCache: peekCacheSync,
        sessionSlug: slug,
      });
      if (createdSurveyCacheRead.status === 'error') {
        throw createdSurveyCacheRead.error;
      }
      surveysCreated = buildUserPageAnalysisCreatedSurveys({
        networkID: createdSurveyCacheRead.networkID,
        questionsCache: createdSurveyCacheRead.questionsCache,
        surveyCreationInfo: this.state.surveyCreationInfo,
        surveysCache: createdSurveyCacheRead.surveysCache,
      });
    } catch (e) {
      accountLog.warn('UserPage: fallback', e);
    }

    const createdCounts = {
      questionsCreated: questionsCreated.length,
      surveysCreated: surveysCreated.length,
    };

    const userData = {
      address: this.props.viewAddress,
      username: this.state.username || null,
      sbts,
      questions,
      surveys,
      // NEW: created content + explicit counts
      questionsCreated,
      surveysCreated,
      createdCounts,
    };
    const addressLower = String(this.props.viewAddress || '')
      .trim()
      .toLowerCase();
    const networkId = String(this.props.network?.id ?? this.props.network?.chainId ?? '');
    const hydrateAnalysisCacheIfPresent = (cacheContextToRead: UserAnalysisCacheContext): boolean => {
      const cacheReadDescriptor = buildUserPageAnalysisCacheReadDescriptor({
        sessionSlug: cacheContextToRead.sessionSlug,
        networkId,
        addressLower,
        fingerprint: cacheContextToRead.fingerprint,
        forceRefresh,
      });
      if (cacheReadDescriptor.action !== 'read') return false;
      const cachedEntry = this._readAnalysisCacheEntry(cacheReadDescriptor);
      if (!cachedEntry) return false;
      if (!this._isMounted) return true;
      this._hydrateAnalysisFromCache(cachedEntry);
      return true;
    };

    try {
      this.setState(buildUserPageAnalysisResetStatePatch());

      const analysisSession = await this.resolveAnalysisSessionContext();
      if (!analysisSession?.sessionConfig) {
        throw new Error('No valid AI session configuration available for this profile context.');
      }
      let cacheContext = await this._buildAnalysisCacheContext({
        userData,
        analysisSession,
        addressLower,
        networkId,
      });
      if (hydrateAnalysisCacheIfPresent(cacheContext)) return;

      if (!this._isMounted) return;
      this.setState(buildUserPageAnalysisResetStatePatch({ analyzing: true }));
      this.startAnalysisTimer();

      const analysisAiContext = {
        account: String(this.props.account || ''),
        providerLike: this.props.provider,
        chainId: this.props.network?.id ?? this.props.networkChainId ?? null,
        lit: getGlobalLitHooks(),
      };
      const aiOptions = buildUserPageAnalysisAiOptions({
        analysisSession,
        context: analysisAiContext,
      });
      let result;
      try {
        result = await analyzeUserOpinions(userData, aiOptions);
      } catch (err: unknown) {
        const isGateUnavailable = /on-chain gate data unavailable/i.test(getUserPageErrorMessage(err, ''));
        if (!isGateUnavailable) throw err;
        accountLog.warn('[UserPage] gate data unavailable for session, trying fallback', {
          failedSlug: analysisSession.slug,
          gateStatus: analysisSession.status,
        });
        const fallbackSession = await this.resolveAnalysisSessionContext([analysisSession.slug]);
        if (!fallbackSession?.sessionConfig) throw err;
        cacheContext = await this._buildAnalysisCacheContext({
          userData,
          analysisSession: fallbackSession,
          addressLower,
          networkId,
        });
        if (hydrateAnalysisCacheIfPresent(cacheContext)) return;
        const fallbackOpts = buildUserPageAnalysisAiOptions({
          analysisSession: fallbackSession,
          context: analysisAiContext,
          defaultReason: 'fallback-gate-unavailable',
        });
        result = await analyzeUserOpinions(userData, fallbackOpts);
      }
      if (!this._isMounted) return;

      // Update UI
      const normalizedResult = normalizeUserAnalysisResult(result);
      this.setState(
        buildUserPageAnalysisResultStatePatch({
          result: normalizedResult,
          servedFromCache: false,
        }),
      );
      this.clearAnalysisTimer();
      try {
        await this._writeAnalysisCacheEntry({
          sessionSlug: cacheContext.sessionSlug,
          networkId,
          addressLower,
          fingerprint: cacheContext.fingerprint,
          aiContext: cacheContext.aiContext,
          result: normalizedResult,
        });
      } catch (cacheError) {
        accountLog.warn('[UserPage] analysis cache write failed:', cacheError);
      }
    } catch (e) {
      accountLog.error('[UserPage] analyzeUser failed:', e);
      if (!this._isMounted) return;
      this.setState(
        buildUserPageAnalysisErrorStatePatch({
          message: getUserPageErrorMessage(
            e,
            'Unable to generate analysis right now. Please try again later.',
          ),
        }),
      );
      this.clearAnalysisTimer();
    }
  };

  getExplorerChainId = (): number | null => {
    const network = this.props.network;
    const sessionConfigProp =
      this.props.sessionConfig &&
      typeof this.props.sessionConfig === 'object' &&
      !Array.isArray(this.props.sessionConfig)
        ? (this.props.sessionConfig as UnknownRecord)
        : null;
    const rawSessionSlug = this.props.sessionSlug ?? this.props.activeSessionSlug ?? '';
    const sessionSlug = normalizeSessionSlug(rawSessionSlug || '');
    const hasSessionContext = !!sessionSlug || !!(sessionConfigProp && Object.keys(sessionConfigProp).length);
    const sessionConfig =
      sessionConfigProp || (hasSessionContext ? this._getSessionConfigForSlugExact(sessionSlug) : null);
    if (hasSessionContext) {
      const capabilities = resolveSessionCapabilityProjection(sessionConfig);
      return capabilities.showNetworkControls && capabilities.chainId ? Number(capabilities.chainId) : null;
    }
    return Number(network?.chainId ?? network?.id ?? this.props.networkChainId ?? 0) || null;
  };

  getExplorerUrl = (): string | null => {
    const address = String(this.props.viewAddress || '').trim();
    if (!address) return null;
    const chainIdForLink = this.getExplorerChainId();
    const explorerUrl = buildExplorerAddressUrl(chainIdForLink, address);
    if (!explorerUrl && chainIdForLink) {
      accountLog.warn(`UserPage: Unknown chain ID (${chainIdForLink}) for explorer link.`);
    }
    return explorerUrl;
  };

  toggleSurveyResponses = (surveyId: unknown): void => {
    if (this._isMounted) {
      this.setState((prevState: UnknownRecord) =>
        buildUserPageSurveyExpansionTogglePatch({
          state: prevState,
          stateKey: 'expandedSurveyResponses',
          surveyId,
        }),
      );
    }
  };

  toggleSurveyCreated = (surveyId: unknown): void => {
    this.setState((prevState: UnknownRecord) =>
      buildUserPageSurveyExpansionTogglePatch({
        state: prevState,
        stateKey: 'expandedSurveysCreated',
        surveyId,
      }),
    );
  };

  toggleSurveyResponsesSection = (): void => {
    this.setState((prevState: UnknownRecord) =>
      buildUserPageBooleanTogglePatch({
        state: prevState,
        stateKey: 'showSectionSurveyResponsesOpen',
      }),
    );
  };

  toggleSurveysCreatedSection = (): void => {
    this.setState((prevState: UnknownRecord) =>
      buildUserPageBooleanTogglePatch({
        state: prevState,
        stateKey: 'showSectionSurveysCreatedOpen',
      }),
    );
  };

  toggleQuestionResponsesSection = (): void => {
    this.setState((prevState: UnknownRecord) =>
      buildUserPageBooleanTogglePatch({
        state: prevState,
        stateKey: 'showSectionQuestionResponsesOpen',
      }),
    );
  };

  toggleQuestionsCreatedSection = (): void => {
    this.setState((prevState: UnknownRecord) =>
      buildUserPageBooleanTogglePatch({
        state: prevState,
        stateKey: 'showSectionQuestionsCreatedOpen',
      }),
    );
  };

  render() {
    const {
      surveyResponseInfo,
      surveyCreationInfo,
      questionCreationInfo,
      questionResponseInfo,
      userStats,
      copied,
      collapseOpen,
      username,
      usernameError,
      bookmarked,
      sbtList,
      loadingSBTs,
      loadingSurveys,
      loadingQuestions,
      showAnalysisModal,
      aiAnalysis,
      analysisDetails,
      analysisName,
      analysisError,
      analyzing,
      analysisElapsedMs,
      analysisHistoricalFigure,
      analysisHistoricalReasoning,
      analysisServedFromCache,
      analysisCachedAt,
      showFullProfileModal,
      isSimulated,
      selectedTab,
      expandedSurveyResponses,
      expandedSurveysCreated,
      detailedSurveyResponses,
      detailedQuestionResponses,

      // NEW: section toggles
      showSectionSurveyResponsesOpen,
      showSectionSurveysCreatedOpen,
      showSectionQuestionResponsesOpen,
      showSectionQuestionsCreatedOpen,

      // NEW: Deep scan flag
      isDeepScanning,
    } = this.state;

    const { minimized, account, viewAddress: propViewAddress, provider, network, loginComplete } = this.props;
    const surveyResponseEntries = surveyResponseInfo as UserPageRenderSurveyEntry[];
    const surveyCreationEntries = surveyCreationInfo as UserPageRenderSurveyEntry[];
    const questionResponseEntries = questionResponseInfo as UserPageRenderQuestionEntry[];
    const questionCreationEntries = questionCreationInfo as UserPageRenderQuestionEntry[];
    const sbtEntries = sbtList as DerivedSbtListItem[];
    const expandedSurveyResponseMap = expandedSurveyResponses as Record<string, boolean | undefined>;
    const expandedSurveyCreatedMap = expandedSurveysCreated as Record<string, boolean | undefined>;
    const detailedSurveyResponseMap = detailedSurveyResponses as Record<
      string,
      SurveyQuestionResponseDetail[] | undefined
    >;
    const detailedQuestionResponseMap = detailedQuestionResponses as Record<
      string,
      NormalizedQuestionResponsePayload | null | undefined
    >;

    // === Compute display label with nickname priority (scoped strictly to current viewAddress) ===
    let cachedNicknameForThis = '';
    try {
      const parsed = this.getBookmarksCache();
      cachedNicknameForThis = resolveUserPageBookmarkNickname({
        address: propViewAddress,
        trim: true,
        users: parsed?.users,
      });
    } catch (e) {
      accountLog.warn('UserPage: fallback', e);
    }

    const explorerUrl = this.getExplorerUrl();
    const {
      addressHref,
      addressLabel,
      pendingNicknameForThis: pendingForThis,
      shouldLinkAddressLabel,
    } = resolveUserPageAddressDisplayState({
      bookmarked,
      cachedNickname: cachedNicknameForThis,
      explorerUrl,
      getShortenedAddress,
      isEditingNickname: this.state.isEditingNickname,
      isSimulated,
      minimized,
      nicknameInput: this.state.nicknameInput,
      propViewAddress,
      stateViewAddress: this.state.viewAddress,
      username,
    });
    const renderedAddressHref = String(addressHref || '').startsWith('/')
      ? buildPublicRoute(String(addressHref || ''))
      : addressHref;
    const addressDisplay = shouldLinkAddressLabel ? (
      <a
        href={renderedAddressHref}
        {...(!minimized
          ? {
              target: '_blank',
              rel: 'noopener noreferrer',
            }
          : {})}
        className={styles.addressLink}
      >
        {addressLabel}
      </a>
    ) : (
      addressLabel
    );

    // === Blockie seed & URL (deterministic across minimized/maximized) ===
    const blockieSeed = resolveUserPageBlockieSeed({ propViewAddress, username });
    const blockieUrl = generateBlockieDataUrl(blockieSeed, 8, 4);

    // --------- NEW: Readiness & spinner glue (defensive) ----------
    const cacheRefreshDisplayState = buildUserPageCacheRefreshDisplayState({
      aiAvailable: this.state.aiAvailable,
      analyzing,
      collapseOpen,
      hasUncertainGateAccess: this.state.hasUncertainGateAccess,
      hasUncertainSbtData: this.state.hasUncertainSbtData,
      hasUncertainUserData: this.state.hasUncertainUserData,
      isDeepScanLoadingEnabledForSection: this.isDeepScanLoadingEnabledForSection,
      isDeepScanning,
      isQuestionCacheReady: this.props.isQuestionCacheReady,
      isResponsesCacheReady: this.props.isResponsesCacheReady,
      isSBTCacheReady: this.props.isSBTCacheReady,
      isSurveyCacheReady: this.props.isSurveyCacheReady,
      loadingQuestions,
      loadingSBTs,
      loadingSurveys,
      questionCreationInfo,
      questionResponseInfo,
      sbtLabel: t('sbt'),
      sbtList,
      sbtsLowerLabel: t('sbtsLower'),
      surveyCreationInfo,
      surveyResponseInfo,
      walletLabel: t('walletLower'),
    });
    const { isQuestionLoadingAny, isSbtLoadingAny, isSurveyLoadingAny } = cacheRefreshDisplayState.loadingState;
    const aiActionPlan = cacheRefreshDisplayState.aiActionPlan;
    const { analyzeButtonDisplayState, compareButtonDisplayState } = aiActionPlan;
    const analyzeActionPlan = {
      blockedReason: 'none',
      disabled: analyzeButtonDisplayState.disabled,
      shouldRenderAnalyzeAction: !minimized,
    };
    const analysisCacheStatusState = resolveUserPageAnalysisCacheStatusState({
      analysisCachedAt,
      analysisServedFromCache,
    });
    const analysisModalDisplayState = resolveUserPageAnalysisModalDisplayState({
      analysisDetails,
      analysisError,
      analysisHistoricalFigure,
      analysisHistoricalReasoning,
      analyzing,
    });

    // --- Loading States Logic ---
    // 2. "Empty" flags: Used to determine if we show the "No items" message.
    // NOTE: We suppress the large white body spinner in favor of the green corner spinner.
    const {
      sbtSectionLoadingEmpty,
      surveyResponsesLoadingEmpty,
      surveysCreatedLoadingEmpty,
      questionResponsesLoadingEmpty,
      questionsCreatedLoadingEmpty,
    } = cacheRefreshDisplayState.sectionLoadingEmptyState;
    const { questionResponsesEmptyText, sbtEmptyText } = cacheRefreshDisplayState.uncertainEmptyText;
    const questionSectionDisplayState = resolveUserPageQuestionSectionDisplayState({
      questionCreationInfo,
      questionResponseInfo,
      questionResponsesLoadingEmpty,
      questionsCreatedLoadingEmpty,
    });
    const surveySectionDisplayState = resolveUserPageSurveySectionDisplayState({
      isDeepScanning: this.state.isDeepScanning,
      surveyCreationInfo,
      surveyResponseInfo,
      surveyResponsesLoadingEmpty,
      surveysCreatedLoadingEmpty,
    });
    const sbtDisplayState = resolveUserPageSbtDisplayState({
      isSBTCacheReady: this.props.isSBTCacheReady,
      loadingSBTs,
      sbtList,
      sbtSectionLoadingEmpty,
    });

    // Unique tooltip targets (wrapping spans) for disabled buttons.
    // Sanitize route-derived values to avoid invalid selector chars (e.g. "/")
    // in reactstrap tooltip `target` selectors.
    const {
      analyzeBtnWrapId,
      compareBtnWrapId,
      questionSpinnerId,
      questionsCreatedSpinnerId,
      sbtSpinnerId,
      surveySpinnerId,
      surveysCreatedSpinnerId,
    } = buildUserPageTooltipTargetIds(propViewAddress);
    const deepScanTooltipLines = this.buildDeepScanProgressTooltip();
    const deepScanProgressRows = this.buildDeepScanProgressRows();
    const { deepScanTooltipContent, deepScanTooltipTitle } = buildUserPageDeepScanTooltipDisplayState({
      deepScanProgressRows,
      deepScanTooltipLines,
      isDeepScanning,
    });
    const renderDeepScanIndicator = (isLoading: boolean, spinnerId: string) =>
      isLoading
        ? this.renderDeepScanStatusIndicator(
            spinnerId,
            deepScanTooltipContent,
            deepScanProgressRows,
            deepScanTooltipTitle,
          )
        : null;

    const headerPassiveDisplayState = resolveUserPageHeaderPassiveDisplayState({
      account,
      cachedNickname: cachedNicknameForThis,
      explorerUrl,
      isEditingNickname: this.state.isEditingNickname,
      isEditingUsername: this.state.isEditingUsername,
      isSimulated,
      minimized,
      pendingNickname: pendingForThis,
      propViewAddress,
      viewAddress: propViewAddress,
    });
    const { isOwner, showPen, showUsernamePen } = headerPassiveDisplayState.profileEditVisibility;
    const headerActionVisibility = headerPassiveDisplayState.headerActionVisibility;
    const bookmarkActionPlan = {
      blockedReason: 'none',
      disabled: false,
      shouldRenderBookmarkAction: headerActionVisibility.showBookmarkButton,
    };
    const copyIconDisplayState = resolveUserPageCopyIconDisplayState({ copied });
    const bookmarkButtonDisplayState = resolveUserPageBookmarkButtonDisplayState({ bookmarked });
    const nicknameEnteredIndicatorDisplayState = resolveUserPageInlineEnteredIndicatorDisplayState({
      value: this.state.nicknameInput,
    });
    const usernameEnteredIndicatorDisplayState = resolveUserPageInlineEnteredIndicatorDisplayState({
      value: this.state.username,
    });
    const usernameErrorDisplayState = resolveUserPageUsernameErrorDisplayState({
      usernameError,
    });
    const surveyResponsesSectionToggleState = resolveUserPageSectionToggleDisplayState({
      open: showSectionSurveyResponsesOpen,
    });
    const surveysCreatedSectionToggleState = resolveUserPageSectionToggleDisplayState({
      open: showSectionSurveysCreatedOpen,
    });
    const questionResponsesSectionToggleState = resolveUserPageSectionToggleDisplayState({
      open: showSectionQuestionResponsesOpen,
    });
    const questionsCreatedSectionToggleState = resolveUserPageSectionToggleDisplayState({
      open: showSectionQuestionsCreatedOpen,
    });
    const fullProfileModalDisplayState = resolveUserPageFullProfileModalDisplayState({
      account,
      explorerUrl,
      minimized,
      propViewAddress,
      surveyResponseInfo,
      surveyResponsesLoadingEmpty,
    });
    const rootClassName = buildUserPageRootClassName({
      baseClassName: styles.userPage,
      minimized,
      minimizedClassName: styles.minimized,
    });
    const headerBookmarkClassName = buildUserPageHeaderBookmarkClassName({
      baseClassName: styles.bookmarkButton,
      headerClassName: styles.headerBookmark,
    });
    const avatarDisplayState = resolveUserPageAvatarDisplayState({
      blockieUrl,
    });
    const bookmarksLinkDisplayState = resolveUserPageBookmarksLinkDisplayState({
      baseClassName: styles.bookmarksLink,
      inlineClassName: styles.bookmarksLinkInline,
    });
    const createdQuestionWrapperClassName = buildUserPageCreatedQuestionWrapperClassName({
      baseClassName: styles.createdQuestionWrapper,
      bolderClassName: styles.createdQuestionBolder,
    });

    return (
      <div className={rootClassName}>
        <UserPageHeader
          addressDisplay={addressDisplay}
          analyzeButtonDisplayState={analyzeButtonDisplayState}
          avatarDisplayState={avatarDisplayState}
          bookmarkButtonDisplayState={bookmarkButtonDisplayState}
          bookmarksHref={buildPublicRoute('/bookmarks')}
          bookmarksLinkDisplayState={bookmarksLinkDisplayState}
          compareButtonDisplayState={compareButtonDisplayState}
          copyIconDisplayState={copyIconDisplayState}
          explorerUrl={explorerUrl}
          headerActionVisibility={headerActionVisibility}
          headerBookmarkClassName={headerBookmarkClassName}
          isEditingUsername={this.state.isEditingUsername}
          isOwner={isOwner}
          minimized={minimized}
          nicknameEnteredIndicatorDisplayState={nicknameEnteredIndicatorDisplayState}
          nicknameInput={this.state.nicknameInput || ''}
          onAnalyzeUser={(event) =>
            runUserPageAnalyzeActionController({
              analyzeArgs: [event],
              event,
              plan: analyzeActionPlan,
              ports: { dispatchAnalyze: this.analyzeUser },
            })
          }
          onBookmark={(event) =>
            runUserPageBookmarkActionController({
              bookmarkArgs: [event],
              event,
              plan: bookmarkActionPlan,
              ports: { dispatchBookmark: this.toggleBookmark },
            })
          }
          onCollapseToggle={this.toggleCollapse}
          onCopyAddress={this.copyToClipboard}
          onNicknameBlur={this.saveNickname}
          onNicknameChange={this.handleNicknameChange}
          onNicknameEdit={this.onPenClick}
          onNicknameKeyDown={this.handleNicknameKeyDown}
          onUsernameBlur={this.setUsername}
          onUsernameChange={this.handleUsernameChange}
          onUsernameEdit={this.onUsernamePenClick}
          onUsernameKeyDown={this.handleUsernameKeyDown}
          showPen={showPen}
          showUsernamePen={showUsernamePen}
          username={this.state.username}
          usernameEnteredIndicatorDisplayState={usernameEnteredIndicatorDisplayState}
          usernameErrorDisplayState={usernameErrorDisplayState}
        />

        <UserPageComparePanel collapseOpen={collapseOpen} minimized={minimized}>
          <CompareAddressSection
            activeSessionSlug={this.props.activeSessionSlug ?? this.props.sessionSlug ?? ''}
            firstAddress={propViewAddress}
            account={account}
            sessionCachesReady={this.props.isAllCachesReady}
            scanSpecificUserProfile={this.props.scanSpecificUserProfile}
          />
        </UserPageComparePanel>

        {!minimized && (
          <div className={styles.content}>
            {selectedTab === 'surveys' && (
              <UserPageSurveySection
                detailedSurveyResponseMap={detailedSurveyResponseMap}
                expandedSurveyCreatedMap={expandedSurveyCreatedMap}
                expandedSurveyResponseMap={expandedSurveyResponseMap}
                getSurveyCreatedHref={(survey, surveyLinkSlug) =>
                  buildPublicRoute(
                    `/survey/${encodeURIComponent(String(survey.id))}${surveyLinkSlug ? `?session=${encodeURIComponent(String(surveyLinkSlug))}` : ''}`,
                  )
                }
                isSurveyLoadingAny={isSurveyLoadingAny}
                onDecryptQuestion={this.handleDecryptQuestionAnswer}
                onOpenSurveyResponse={(survey, e: React.MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  const surveyUrlParams = new URLSearchParams();
                  if (survey.slug) {
                    surveyUrlParams.set('session', survey.slug);
                  }
                  surveyUrlParams.set('responder', String(propViewAddress));
                  window.open(
                    buildPublicRoute(
                      `/survey/${encodeURIComponent(String(survey.id))}${surveyUrlParams.toString() ? `?${surveyUrlParams.toString()}` : ''}`,
                    ),
                    '_blank',
                    'noopener,noreferrer',
                  );
                }}
                onShowQuestionsTab={(e: React.MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  if (this._isMounted) this.setState(buildUserPageSelectedTabStatePatch({ selectedTab: 'questions' }));
                }}
                onSurveyCreatedToggle={this.toggleSurveyCreated}
                onSurveyResponsesSectionToggle={this.toggleSurveyResponsesSection}
                onSurveyResponseToggle={this.toggleSurveyResponses}
                onSurveysCreatedSectionToggle={this.toggleSurveysCreatedSection}
                questionResponsesNonce={this.props.questionResponsesNonce}
                responderAddress={propViewAddress}
                sbtCacheRevision={this.props.sbtCacheRevision}
                surveyCreationEntries={surveyCreationEntries}
                surveyResponseEntries={surveyResponseEntries}
                surveyResponsesLoadingIndicator={renderDeepScanIndicator(isSurveyLoadingAny, surveySpinnerId)}
                surveyResponsesSectionToggleState={surveyResponsesSectionToggleState}
                surveySectionDisplayState={surveySectionDisplayState}
                surveysCreatedLoadingIndicator={renderDeepScanIndicator(isSurveyLoadingAny, surveysCreatedSpinnerId)}
                surveysCreatedSectionToggleState={surveysCreatedSectionToggleState}
              />
            )}

            {selectedTab === 'questions' && (
              <UserPageQuestionSection
                activeSessionSlug={this.props.activeSessionSlug}
                createdQuestionWrapperClassName={createdQuestionWrapperClassName}
                detailedQuestionResponseMap={detailedQuestionResponseMap}
                isQuestionLoadingAny={isQuestionLoadingAny}
                network={network}
                onDecryptQuestion={this.handleDecryptQuestionAnswer}
                onQuestionResponsesSectionToggle={this.toggleQuestionResponsesSection}
                onQuestionsCreatedSectionToggle={this.toggleQuestionsCreatedSection}
                onShowSurveysTab={(e: React.MouseEvent<HTMLElement>) => {
                  e.stopPropagation();
                  if (this._isMounted) this.setState(buildUserPageSelectedTabStatePatch({ selectedTab: 'surveys' }));
                }}
                questionCreationEntries={questionCreationEntries}
                questionResponsesEmptyText={questionResponsesEmptyText}
                questionResponsesLoadingIndicator={renderDeepScanIndicator(isQuestionLoadingAny, questionSpinnerId)}
                questionResponsesNonce={this.props.questionResponsesNonce}
                questionResponseEntries={questionResponseEntries}
                questionResponsesSectionToggleState={questionResponsesSectionToggleState}
                questionSectionDisplayState={questionSectionDisplayState}
                questionsCreatedLoadingIndicator={renderDeepScanIndicator(
                  isQuestionLoadingAny,
                  questionsCreatedSpinnerId,
                )}
                questionsCreatedSectionToggleState={questionsCreatedSectionToggleState}
                responderAddress={propViewAddress}
                sbtCacheRevision={this.props.sbtCacheRevision}
              />
            )}

            {renderUserPageMembershipSections({
              account,
              activeSessionSlug: this.getActiveSessionSlug(),
              isOwner,
              isSimulated,
              onChainProfileEnabled: this.props.onChainProfileEnabled,
              provider,
              sessionConfig: this.props.sessionConfig,
              sbtSectionProps: {
                heading: `${t('minted')} ${t('sbts')}:`,
                isLoading: isSbtLoadingAny,
                isSBTCacheReady: this.props.isSBTCacheReady,
                loadingIndicator: renderDeepScanIndicator(isSbtLoadingAny, sbtSpinnerId),
                loginComplete,
                network,
                onRefreshSbtData: this.dispatchSbtDataRefresh,
                sbtDisplayState,
                sbtEmptyText,
                sbtEntries,
              },
            })}
          </div>
        )}

        <UserPageSimulatedActions
          isSimulated={isSimulated}
          onViewResponses={() => {
            if (this._isMounted) this.setState(buildUserPageFullProfileModalStatePatch({ open: true }));
          }}
        />

        <UserPageAnalysisModal
          aiAnalysis={aiAnalysis}
          analysisCacheStatusState={analysisCacheStatusState}
          analysisDetails={analysisDetails}
          analysisElapsedMs={analysisElapsedMs}
          analysisError={analysisError}
          analysisHistoricalFigure={analysisHistoricalFigure}
          analysisHistoricalReasoning={analysisHistoricalReasoning}
          analysisModalDisplayState={analysisModalDisplayState}
          analysisName={analysisName}
          analyzing={analyzing}
          isOpen={showAnalysisModal}
          onRefreshAnalysis={() => this.analyzeUser(true)}
          onToggle={() => {
            if (this._isMounted) {
              this.setState(buildUserPageAnalysisModalStatePatch());
              this.clearAnalysisTimer();
            }
          }}
        />

        <UserPageFullProfileModal
          aiAnalysis={aiAnalysis}
          bookmarksHref={buildPublicRoute('/bookmarks')}
          collapseOpen={collapseOpen}
          explorerUrl={explorerUrl}
          fullProfileModalDisplayState={fullProfileModalDisplayState}
          isOpen={showFullProfileModal}
          isSBTCacheReady={this.props.isSBTCacheReady}
          loginComplete={loginComplete}
          mintedSbtsHeading={`${t('minted')} ${t('sbts')}`}
          network={network}
          onRefreshSbtData={this.dispatchSbtDataRefresh}
          onStatsCollapseToggle={this.toggleCollapse}
          onToggle={() => {
            if (this._isMounted) this.setState(buildUserPageFullProfileModalStatePatch());
          }}
          provider={provider}
          sbtDisplayState={sbtDisplayState}
          sbtEmptyText={sbtEmptyText}
          sbtEntries={sbtEntries}
          surveyResponseEntries={surveyResponseEntries}
          userStats={userStats}
        />
      </div>
    );
  }
}

export default UserPage;
