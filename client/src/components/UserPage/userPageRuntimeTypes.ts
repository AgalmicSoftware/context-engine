import type React from 'react';
import type { UserPageSourceSlugMap } from './userPageHelpers';

export const USERPAGE_GATE_UNKNOWN_RETRY_MS = 30 * 1000;
export const USERPAGE_GATE_TERMINAL_RECHECK_MS = 60 * 1000;
export const USERPAGE_RESPONSE_PARSE_MEMO_LIMIT = 300;
export const PROFILE_SCAN_REPORT_EVENT = 'ce:profile-scan-report';
export const USER_ANALYSIS_CACHE_VERSION = 1;
export const USER_ANALYSIS_TTL_MS = 24 * 60 * 60 * 1000;

export type UnknownRecord = Record<string, unknown>;
export type UserPagePreviousProps = UnknownRecord & {
  network?: {
    id?: unknown;
  } | null;
};

export type UserPageGlobalState = typeof globalThis & {
  CE_USER_PROFILE_DEEP_SCAN_LOADING?: unknown;
  CE_PROFILE_SCAN_TELEMETRY?: unknown;
  CE_PROFILE_SCAN_COLD_DIAG?: unknown;
  CE_SESSION_SCAN_SCOPE?: unknown;
  CE_SESSION_SCAN_SLUGS?: unknown;
  [key: string]: unknown;
};

export type UserCacheSourceEntry = {
  slug?: unknown;
  data?: UnknownRecord;
  [key: string]: unknown;
};

export type NamespaceCacheSourceEntry = {
  slug: string;
  data: UnknownRecord;
};

export type CacheSourcePresence = {
  hasSurveysCache: boolean;
  hasQuestionsCache: boolean;
  hasSbtCache: boolean;
  hasUserCache: boolean;
};

export type CacheSourceSnapshot = CacheSourcePresence & {
  hasSurveySources: boolean;
  hasQuestionSources: boolean;
  hasSbtSources: boolean;
  surveySourcesSignature: string;
  questionSourcesSignature: string;
  sbtSourcesSignature: string;
  membershipSignature: string;
};

export type UserPageTimeoutHandle = ReturnType<typeof setTimeout>;
export type UserPageIntervalHandle = ReturnType<typeof setInterval>;

export type QueuedCacheRefreshOptions = {
  force?: unknown;
  markLoading?: unknown;
  bypassSignature?: unknown;
};

export type CacheRefreshOptions = {
  force: boolean;
  markLoading: boolean;
  bypassSignature?: boolean;
};

export type UnifiedCacheAggregateInput = {
  networkID?: unknown;
  viewAddressLower?: unknown;
};

export type CacheNetworkBucket = UnknownRecord & {
  surveys?: unknown;
  surveyResponses?: unknown;
  questions?: unknown;
  questionResponses?: unknown;
  questionResponsesMeta?: unknown;
  sbtList?: unknown;
};

export type PrioritizedCacheNode = {
  key: string;
  value: CacheNetworkBucket;
};

export type UserCachePayload = UnknownRecord & {
  sbts?: unknown;
  createdSurveys?: unknown;
  createdQuestions?: unknown;
  surveyResponses?: unknown;
  questionResponses?: unknown;
};

export type UserChainNode = UnknownRecord & {
  data?: unknown;
};

export type PrioritizedUserChainNode = {
  chainKey: string;
  node: UserChainNode;
};

export type GateAccessKeyInput = {
  slug?: unknown;
  resourceKey?: unknown;
};

export type GateAccessStatusEntry = {
  status: string;
  ts: number;
};

export type SponsoredAccessResult = {
  status?: unknown;
  [key: string]: unknown;
};

export type ResponseGateAccessCheckPromise = Promise<void>;

export type GateAccessContext = {
  pendingKeys: Set<string>;
  uncertainResources: Set<string>;
};

export type GateAccessContextSnapshot = {
  pendingKeys: string[];
  uncertainResources: string[];
};

export type SourceSlugMap = UserPageSourceSlugMap;

export type EntityCacheMap = Record<string, UnknownRecord>;

export type ResponseByResponderMap = Record<string, unknown>;

export type ResponseBucketMap = Record<string, ResponseByResponderMap>;

export type ResponseRecencyWithHints = ResponseRecency & {
  hasHints: boolean;
};

export type ResponseRecencyBucketMap = Record<string, Record<string, ResponseRecencyWithHints>>;

export type SbtAggregateEntry = UnknownRecord & {
  sbtAddress?: unknown;
  sbtInfo?: unknown;
  mintedSet: Set<string>;
  burnedSet: Set<string>;
  viewerCountsAuthoritative?: boolean;
  blockNumber: number;
  slug?: unknown;
};

export type SbtAggregateMap = Record<string, SbtAggregateEntry>;

export type DerivedSbtListItem = {
  sbtInfo: UnknownRecord;
  slug?: unknown;
};

export type UserPageRenderSurveyEntry = UnknownRecord & {
  id: string;
  title: React.ReactNode;
  questionsCount: React.ReactNode;
  slug?: string;
  tags: React.ReactNode[];
  documentURLs: string[];
};

export type UserPageRenderQuestionEntry = UnknownRecord & {
  id: string;
  canDecryptOtherResponses?: unknown;
  sessionSlug?: unknown;
  slug?: unknown;
};

export type SbtSectionResult = {
  sbtList: DerivedSbtListItem[];
  badgesReceived: number;
};

export type ResponseEncryptionSummary = {
  answerEncrypted: boolean;
  additionalEncrypted: boolean;
};

export type SurveyQuestionResponseDetail = {
  questionData: UnknownRecord;
  responseData: NormalizedQuestionResponsePayload;
  canDecryptOtherResponses: boolean;
  responseEncryption: ResponseEncryptionSummary;
};

export type SurveySectionResult = {
  surveyResponseInfo: UnknownRecord[];
  surveyCreationInfo: UnknownRecord[];
  detailedSurveyResponses: Record<string, SurveyQuestionResponseDetail[]>;
  surveysResponded: number;
  surveysCreated: number;
};

export type QuestionResponseInfoEntry = UnknownRecord & {
  _responseRecency?: ResponseRecency;
};

export type QuestionSectionResult = {
  questionCreationInfo: UnknownRecord[];
  questionResponseInfo: UnknownRecord[];
  detailedQuestionResponses: Record<string, NormalizedQuestionResponsePayload>;
  questionsCreated: number;
  questionsResponded: number;
};

export type SurveyResponseRecencyUpsertInput = {
  sid?: unknown;
  responder?: unknown;
  responseValue?: unknown;
  metaValue?: unknown;
  slug?: unknown;
};

export type QuestionResponseRecencyUpsertInput = {
  qid?: unknown;
  responder?: unknown;
  responseValue?: unknown;
  metaValue?: unknown;
  slug?: unknown;
};

export type EncryptedVisibilityInput = {
  resourceKey?: unknown;
  slug?: unknown;
  viewAddressLower?: unknown;
  encryptionAudience?: unknown;
  gateContext?: GateAccessContext | null;
};

export type EncryptedVisibilityResult = {
  visible: boolean;
  canDecryptOtherResponses: boolean;
  uncertain?: boolean;
};

export type DecryptSingleFieldOptions = UnknownRecord & {
  account: string;
  provider?: unknown;
  providerKind?: unknown;
  chainId: number;
  surveyId: string;
  acceptedSurveyIds: string[];
  lit: unknown;
  throwOnError: boolean;
};

export type CryptoUtilsWithSingleField = {
  decryptSingleField: (
    responseSlice: unknown,
    questionId: string,
    fieldToDecrypt: unknown,
    options: DecryptSingleFieldOptions,
  ) => Promise<unknown>;
};

export type SectionDeriveMemoEntry = {
  signature: string;
  result: unknown;
  gateSnapshot?: GateAccessContextSnapshot;
} | null;

export type SectionDeriveMemo = {
  survey: SectionDeriveMemoEntry;
  question: SectionDeriveMemoEntry;
  sbt: SectionDeriveMemoEntry;
};

export type DeepScanSessionDisplayConfig = UnknownRecord & {
  sessionName?: unknown;
  blockLimits?: UnknownRecord & {
    start?: unknown;
  };
};

export type DeepScanProgressRow = {
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

export type DeepScanProgressSnapshot = {
  rows: DeepScanProgressRow[] | null;
  lines: string[] | null;
};

export type NormalizedResponseField = UnknownRecord & {
  value?: unknown;
};

export type NormalizedQuestionResponsePayload = UnknownRecord & {
  answer: NormalizedResponseField;
  additional: NormalizedResponseField;
  __ceMalformedPayload?: boolean;
};

export type ResponseRecency = {
  bn: number;
  txi: number;
  li: number;
  ts: number;
};

export type ManagedCacheUpdateEvent =
  | {
      namespace?: unknown;
      slug?: unknown;
      [key: string]: unknown;
    }
  | null
  | undefined;

export type StoppableEvent =
  | {
      stopPropagation?: () => void;
    }
  | null
  | undefined;

export type BookmarkToggleMeta = UnknownRecord & {
  nickname?: unknown;
  username?: unknown;
};

export type AiSessionCandidate = {
  slug: string;
  sessionConfig: UnknownRecord;
  status: string;
};

export type AiSessionResolution = AiSessionCandidate & {
  reason: string;
};

export type UserAnalysisAiContext = {
  sessionSlug: string;
  provider: string;
  model: string;
};

export type UserAnalysisCacheContextArgs = {
  userData: unknown;
  analysisSession: AiSessionResolution;
  addressLower: string;
  networkId: string;
};

export type UserAnalysisCacheContext = {
  sessionSlug: string;
  aiContext: UserAnalysisAiContext;
  fingerprint: string;
};

export type UserAnalysisCacheEntry = UnknownRecord & {
  version?: unknown;
  fingerprint?: unknown;
  cachedAt?: unknown;
  expiresAt?: unknown;
  address?: unknown;
  networkId?: unknown;
  result?: unknown;
};

export type UserAnalysisCacheWriteArgs = {
  sessionSlug: string;
  networkId: string;
  addressLower: string;
  fingerprint: string;
  aiContext: UserAnalysisAiContext;
  result: unknown;
};

export type ProfileTelemetryEntry = UnknownRecord & {
  ts: string;
  seq: number;
  source: 'UserPage';
  event: string;
};

export type ProfileDeepScanReport = UnknownRecord & {
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

export type ProfileScanReportEvent =
  | Event
  | {
      detail?: unknown;
    }
  | null
  | undefined;

export type NicknameKeyEvent = {
  key?: unknown;
};

export type NicknameChangeEvent = {
  target?: {
    value?: unknown;
  };
};
