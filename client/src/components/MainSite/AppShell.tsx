/** @file AppShell.tsx */

import React, { Component, Suspense } from 'react';
import { connect } from 'react-redux';
import { changeAccount, fetchAccount } from '../../actions/accountActions.js';
import {
  fetchSessionState,
  changeFocusedTab,
  toggleLoginModal,
  updateLoginInfo,
  toggleDemoMode,
  changeActiveSessionSlug,
} from '../../actions/sessionStateActions.js';
import type { RootState } from '../../reducers/index.js';
import type { MainSiteProps, MainSiteState } from './MainSiteTypes';

// Styles
import 'assets/css/contextEngine.scss';
import stylesRaw from './AppShell.module.scss';

// Smart contract events / interactions
import {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import { chainScanReadsPort } from '../../domains/chain/chainScanReadsPort.js';
import { profileScanPort } from '../../domains/profiles/profileScanPort.js';
import { sbtEventStreamsPort } from '../../domains/sbts/sbtEventStreamsPort.js';
import { sbtMetadataReadsPort } from '../../domains/sbts/sbtMetadataReadsPort.js';
import { surveyReadsPort } from '../../domains/surveys/surveyChainReadsPort.js';
import { faucetFundingPort } from '../../domains/worker/faucetFundingPort.js';
import { deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { getGlobalLitHooks } from '../../utilities/crypto/litProtocol.js';
import { ethers } from 'ethers';
import {
  CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED,
  DEFAULT_CHAIN_ID,
  DEFAULT_SESSION_SLUG,
  DEFAULT_SESSION_SLUG_ALIAS,
} from '../../variables/appConfig.js';
import { getChainById, getSessionRegistryChainIds } from '../../variables/chains.js';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import { normalizeSessionMediaUrl } from '../../domains/sessions/sessionMediaUrls.js';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
import { derivePrimarySessionSlugFromList } from '../../utilities/session/globalSessionState.js';
import {
  createInitialProfileScanReport,
  createProfileScanFanoutPlan,
  resolveProfileScanAttemptedCoverageSlugs,
} from '../../utilities/session/profileScanReportHelpers.js';
import {
  createSessionMetaRefreshController,
  type SessionMetaRefreshController,
} from '../../utilities/session/sessionMetaController.js';
import { type SessionScanPolicy } from '../../utilities/session/mainSiteSessionScanPolicy.js';
import {
  claimsWorkerCanonicalAuthority,
  resolveSessionCapabilityProjection,
} from '../../utilities/session/sessionCapabilityProjection';
import {
  createSessionProfileScanController,
  type SessionProfileScanController,
  type SessionProfileScanHost,
} from '../../utilities/session/sessionProfileScanController.js';
import {
  createSessionSbtCacheController,
  type SessionSbtCacheController,
  type SessionSbtCacheHost,
} from '../../utilities/sbt/sessionSbtCacheController.js';
import {
  createSessionSurveyCacheController,
  type SessionSurveyCacheController,
  type SessionSurveyCacheHost,
} from 'utilities/survey/sessionSurveyCacheController';
import {
  createSessionQuestionCacheController,
  type SessionQuestionCacheController,
  type SessionQuestionCacheHost,
} from 'utilities/survey/sessionQuestionCacheController';
import {
  createSessionResponseHydrationController,
  type RefreshQuestionResponsesOptions,
  type SessionResponseHydrationController,
  type SessionResponseHydrationHost,
} from '../../utilities/survey/sessionResponseHydrationController.js';
import { isResponseRecencyAtLeast, toResponseRecencyPair } from '../../utilities/survey/responseRecency.js';
import { resolveSessionRegistryBootstrapChainIds } from '../../utilities/session/registryBootstrapChainIds.js';
import { t } from '../../utilities/ui/terminology.js';
import { initCacheManager, subscribeCacheUpdates } from '../../utilities/cache/cacheScripts.js';
import { createMainSiteDgStorage, type MainSiteDgStorage } from '../../utilities/cache/mainSiteDgStorage.js';
import {
  createSessionCachePersistenceController,
  type SessionCachePersistenceController,
  type SessionCachePersistenceHost,
} from '../../utilities/cache/sessionCachePersistenceController.js';
import {
  createSessionCacheReadinessController,
  type SessionCacheReadinessController,
  type SessionCacheReadinessHost,
} from '../../utilities/cache/sessionCacheReadinessController.js';
import { ensureQuestionArweaveCacheBranches } from '../../domains/surveys/questionArweaveCacheBranches.js';
import {
  shouldAutoStartCeRuntimeStats,
  startCeRuntimeStats,
  stopCeRuntimeStats,
} from '../../utilities/ui/uiRuntimeStats.js';

// withWagmiBridge is a function component (allowed to use hooks from wagmi and RainbowKit).
// It passes props to this class-component so that this component can use React hooks.
import { WagmiHooksHOC as WagmiHooksHOCRaw } from '../HooksHOC/withWagmiBridge';

// Components
import NavbarRaw from '../Navbar/Navbar';
import MainAreaTabsRaw from '../MainContent/MainAreaTabs';
import RightSideRaw from '../RightSidebar/RightSide';
import OnboardingOverlayRaw from '../Onboarding/OnboardingOverlay';
import { FIRST_VISIT_STORAGE_KEY } from '../Onboarding/onboardingConfig.js';
import FooterRaw from '../Footer/Footer';
import LazyFallbackRaw from '../Shared/LazyFallback';
import DevE2eNavRaw from '../E2E/DevE2eNav';
import RouteErrorBoundaryRaw from '../ErrorBoundary/RouteErrorBoundary';
import { getPolisDemoQuestionPool } from '../SurveyTool/surveyPolisDemoQuestionPool';

import { createLogger } from 'utilities/logging.js';
import {
  buildQuestionRoutePath,
  isKnownOrGeneralSessionSlug,
  shouldRetryMaskedQuestionRefresh,
} from '../../utilities/survey/questionRouting.js';
import {
  getSessionCfg as _getSessionCfg,
  getSessionChainId as _getSessionChainId,
  getSessionNetwork as _getSessionNetwork,
  type MainSiteSessionConfigLike,
} from '../../utilities/session/mainSiteSessionConfig.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  resolveMainSiteExplicitSessionSlugFromPath,
  resolveMainSiteGlobalPrimarySessionSlug,
  resolveMainSiteQuestionRouteSessionContext,
  resolveMainSiteRenderActiveSessionSlug,
  resolveMainSiteRouteSessionIdHint,
  resolveMainSiteRouteSessionSlugHint,
  resolveMainSiteSessionRouteContext,
  resolveMainSiteSessionRouteSourceSlug,
  resolveMainSiteSessionSlugFromProps,
  resolveMainSiteSessionSlugFromPathToken,
} from './routeSessionResolution.js';
import { resolveMainSiteLitSessionConfig, resolveMainSiteLitSessionConfigSource } from './litSessionConfig.js';
import {
  buildMetadataSessionCacheEnvelope as buildMetadataSessionCacheEnvelopeFn,
  resolveMetadataSessionBinding as resolveMetadataSessionBindingFn,
  resolveMetadataSessionSlug as resolveMetadataSessionSlugFn,
  resolveScopedMetadataSessionSlug as resolveScopedMetadataSessionSlugFn,
  type BuildEnvelopeOptions,
  type MetadataRecord,
} from '../../utilities/session/metadataSessionBinding.js';
import {
  findGroupSlugForQuestion as findGroupSlugForQuestionFn,
  findGroupSlugForSurvey as findGroupSlugForSurveyFn,
  resolveGroupSlugForSbtAddress as resolveGroupSlugForSbtAddressFn,
} from './groupSlugLookup.js';
import {
  hasAutoFlag as hasAutoFlagFn,
  manageAutoHashPersistence as manageAutoHashPersistenceFn,
} from './autoHashPersistence';
import {
  prepareSurveyMetadataCacheEntry as prepareSurveyMetadataCacheEntryFn,
  prepareQuestionMetadataCacheEntry as prepareQuestionMetadataCacheEntryFn,
  type QuestionMetadataCacheEntry,
  type SurveyMetadataCacheEntry,
} from '../../utilities/survey/metadataCacheEntryBuilders.js';
import {
  DG_PRIMARY_ROUTE_CACHE_NAMES,
  SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX,
} from '../../utilities/cache/sessionCacheConstants.js';
import {
  buildMainSiteCacheManagerReadyStatePatch,
  isRouteResponderAddress,
} from '../../utilities/session/mainSiteUtils.js';
import {
  composeMainSiteAuthViewProps,
  composeMainSiteLoginViewProps,
  composeMainSiteQuestionCacheViewProps,
  composeMainSiteSessionCacheViewProps,
  composeMainSiteSurveyCacheViewProps,
  composeMainSiteWalletViewProps,
} from './mainSiteViewProps.js';
import {
  ExperimentalStub as ExperimentalStubRaw,
  NotFoundRoute as NotFoundRouteRaw,
  SessionLoadingSkeleton as SessionLoadingSkeletonRaw,
} from './routeStatusViews';
import { QUESTION_RESULTS_RE, SURVEY_RESULTS_RE, VALID_SURVEY_ID_RE, isStaticNonCacheRoute } from './routeConfig.js';
import { resolveMainSiteRouteMatch } from './routeTable.js';
import { renderMainSiteRouteView } from './mainSiteRouteViewMap.js';
import { createMainSiteRouteRenderers } from './mainSiteRouteRenderers.js';
import { createMainSiteSessionScanPolicy } from './mainSiteSessionScanPolicyBinding.js';
import {
  initializeMainSiteWorkerCanonicalCachesForGroup,
  preloadMainSiteAboutDemoSessionData,
  resolveMainSiteDisplaySessionChainId,
  resolveMainSiteDisplaySessionConfig,
  resolveMainSiteDisplaySessionNetwork,
} from './mainSiteCapabilityHostRuntime';
import {
  buildPublicRoute,
  buildPublicUrl,
  replaceRouteResponderQueryParam,
  stripConfiguredPublicBasePath,
} from './urlUtils.js';
import {
  getEffectiveRoutePath as getEffectiveRoutePathFn,
  isGeneralRoutePath as isGeneralRoutePathFn,
  isOnOrWithinRoutePath as isOnOrWithinRoutePathFn,
  normalizeRoutePath as normalizeRoutePathFn,
} from './routePathHelpers.js';
import {
  createSessionPathResolverController,
  type SessionPathResolverController,
} from './sessionPathResolverController.js';
import {
  consumeOneTimeFirstVisitRootRedirect as consumeOneTimeFirstVisitRootRedirectFn,
  consumeSessionFallbackRedirect as consumeSessionFallbackRedirectFn,
  getSessionFallbackPreferredTarget as getSessionFallbackPreferredTargetFn,
  getSessionFallbackRedirectStorageKey as getSessionFallbackRedirectStorageKeyFn,
  getSessionFallbackScopeSlugs as getSessionFallbackScopeSlugsFn,
  getTemporaryInitialLoadAboutRedirectTarget as getTemporaryInitialLoadAboutRedirectTargetFn,
  hasConsumedSessionFallbackRedirect as hasConsumedSessionFallbackRedirectFn,
  isFirstVisitRootRedirectEnabled as isFirstVisitRootRedirectEnabledFn,
  shouldForceOneTimeFirstVisitRootRedirect as shouldForceOneTimeFirstVisitRootRedirectFn,
  type SessionFallbackRedirectTarget,
} from './sessionFallbackRedirect.js';
import {
  getSessionHeaderForGroup as getSessionHeaderForGroupFn,
  getSessionInfoForGroup as getSessionInfoForGroupFn,
  getSessionNameForGroup as getSessionNameForGroupFn,
  hasEncryptedSessionField as hasEncryptedSessionFieldFn,
} from './sessionDisplayHelpers.js';
import {
  buildSbtDetailRouteStatePatch,
  getSbtAddressFromPath as getSbtAddressFromPathFn,
  isSbtListRoutePath as isSbtListRoutePathFn,
  getSbtListRouteSessionSlug as getSbtListRouteSessionSlugFn,
  getUserAddressFromPath as getUserAddressFromPathFn,
} from './sbtRoutePathHelpers';
import { reloadWindowLocation as reloadWindowLocationFn } from './reloadWindowLocation.js';
import {
  AboutPage as AboutPageRaw,
  AdminPage as AdminPageRaw,
  AgentPage as AgentPageRaw,
  DebateMap as DebateMapRaw,
  BookmarksPage as BookmarksPageRaw,
  CompareAddresses as CompareAddressesRaw,
  ContractPage as ContractPageRaw,
  DemosIndex as DemosIndexRaw,
  OnePageSession as OnePageSessionRaw,
  RiskMatrixDemo as RiskMatrixDemoRaw,
  SBTPage as SBTPageRaw,
  SBTsPage as SBTsPageRaw,
  SessionDocumentsPage as SessionDocumentsPageRaw,
  SessionWizard as SessionWizardRaw,
  SimulatedUserPage as SimulatedUserPageRaw,
  SponsorPage as SponsorPageRaw,
  SurveyPage as SurveyPageRaw,
  SurveyTool as SurveyToolRaw,
  TagPage as TagPageRaw,
  UserPage as UserPageRaw,
} from './routeLazyComponents.js';
import {
  buildQuestionReadyStatePatch,
  shouldClearQuestionProgressInFinalize,
  shouldCommitThrottledProgress,
  shouldFlushCoalescedRun,
} from '../../utilities/session/mainSiteProgressHelpers.js';

type SurveyGroupScanQueueOptions = {
  hintedSlug?: unknown;
};

type QuestionRouteSessionIdHintOptions = {
  requireResolved?: boolean;
};

export {
  shouldFlushCoalescedRun,
  shouldCommitThrottledProgress,
  mapSbtWorkProgressToBlock,
  mergeSbtLiveProgressEntry,
  buildQuestionReadyStatePatch,
  shouldClearQuestionProgressInFinalize,
  shouldEnableSessionRegistryRefresh,
  SBT_PROGRESS_MIN_INTERVAL_MS,
  SBT_PROGRESS_FINAL_TAIL_BLOCKS,
  SBT_LIGHT_DISCOVERY_SCAN_UNITS,
  SBT_LIGHT_DISCOVERY_HYDRATION_UNITS,
  SBT_FULL_SCAN_DISCOVERY_UNITS,
  SBT_FULL_SCAN_PROCESS_UNITS,
} from '../../utilities/session/mainSiteProgressHelpers.js';

const mainSiteLog = createLogger('mainSite');

const PROFILE_SCAN_REPORT_EVENT = 'ce:profile-scan-report';
type MainSiteRouteComponent = React.ComponentType<Record<string, unknown>>;
type MainSiteProfileMetaResult<T> = {
  data: T;
  hadError: boolean;
  error?: string;
};
const styles = stylesRaw as Record<string, string>;
const WagmiHooksHOC = WagmiHooksHOCRaw;
const asMainSiteRouteComponent = (component: unknown): MainSiteRouteComponent => component as MainSiteRouteComponent;
const Navbar = asMainSiteRouteComponent(NavbarRaw);
const MainAreaTabs = asMainSiteRouteComponent(MainAreaTabsRaw);
const RightSide = asMainSiteRouteComponent(RightSideRaw);
const OnboardingOverlay = asMainSiteRouteComponent(OnboardingOverlayRaw);
const Footer = asMainSiteRouteComponent(FooterRaw);
const LazyFallback = asMainSiteRouteComponent(LazyFallbackRaw);
const DevE2eNav = asMainSiteRouteComponent(DevE2eNavRaw);
const RouteErrorBoundary = asMainSiteRouteComponent(RouteErrorBoundaryRaw);
const ExperimentalStub = asMainSiteRouteComponent(ExperimentalStubRaw);
const NotFoundRoute = asMainSiteRouteComponent(NotFoundRouteRaw);
const SessionLoadingSkeleton = asMainSiteRouteComponent(SessionLoadingSkeletonRaw);
const AboutPage = asMainSiteRouteComponent(AboutPageRaw);
const AdminPage = asMainSiteRouteComponent(AdminPageRaw);
const AgentPage = asMainSiteRouteComponent(AgentPageRaw);
const DebateMap = asMainSiteRouteComponent(DebateMapRaw);
const BookmarksPage = asMainSiteRouteComponent(BookmarksPageRaw);
const CompareAddresses = asMainSiteRouteComponent(CompareAddressesRaw);
const ContractPage = asMainSiteRouteComponent(ContractPageRaw);
const DemosIndex = asMainSiteRouteComponent(DemosIndexRaw);
const OnePageSession = asMainSiteRouteComponent(OnePageSessionRaw);
const RiskMatrixDemo = asMainSiteRouteComponent(RiskMatrixDemoRaw);

const isMainSiteProfileMetaResult = <T,>(value: unknown): value is MainSiteProfileMetaResult<T> =>
  !!value &&
  typeof value === 'object' &&
  (Object.prototype.hasOwnProperty.call(value, 'hadError') || Object.prototype.hasOwnProperty.call(value, 'data'));
const SBTPage = asMainSiteRouteComponent(SBTPageRaw);
const SBTsPage = asMainSiteRouteComponent(SBTsPageRaw);
const SessionDocumentsPage = asMainSiteRouteComponent(SessionDocumentsPageRaw);
const SessionWizard = asMainSiteRouteComponent(SessionWizardRaw);
const SimulatedUserPage = asMainSiteRouteComponent(SimulatedUserPageRaw);
const SponsorPage = asMainSiteRouteComponent(SponsorPageRaw);
const SurveyPage = asMainSiteRouteComponent(SurveyPageRaw);
const SurveyTool = asMainSiteRouteComponent(SurveyToolRaw);
const TagPage = asMainSiteRouteComponent(TagPageRaw);
const UserPage = asMainSiteRouteComponent(UserPageRaw);

interface RouteRenderCtx {
  fullPath: string;
  searchStr: string;
  hashStr: string;
  searchParams: URLSearchParams;
  pathWithoutQuery: string;
  pathSegments: string[];
  firstPathSegment: string;
  routeDemoMode: boolean;
  requestedSessionId: string;
  requestedChainId: number | null;
  requestedSponsoredBundleId: string;
  requestedSponsoredBundleKey: string | null;
  defaultSlug: string;
  defaultSessionCfg: MainSiteSessionConfigLike | null;
  defaultSessionChainId: number | null;
  defaultSessionNetwork: ReturnType<typeof _getSessionNetwork>;
  cacheInitializationError: boolean;
  surveyIDFromPath: string | null;
  autoOpenResults: boolean;
  parsedFilterStateFromUrl: Record<string, unknown>;
  isResultsRoute: boolean;
}

type RefreshSurveyResponsesByIDFn = (surveyID: string) => Promise<void>;
type RefreshQuestionResponsesFn = (
  questionIds?: string[] | null,
  opts?: RefreshQuestionResponsesOptions,
) => Promise<void>;
type RefreshSbtDataFn = SessionSbtCacheController['refreshSbtData'];
type RefreshSbtDataForGroupFn = SessionSbtCacheController['refreshSbtDataForGroup'];
type RefreshSurveyResponsesByIDForGroupFn = SessionSurveyCacheController['refreshSurveyResponsesByIDForGroup'];
type HasMaskedQuestionPayloadInCacheFn = SessionQuestionCacheController['hasMaskedQuestionPayloadInCache'];
type BuildQuestionDecryptContextFn = SessionQuestionCacheController['buildQuestionDecryptContext'];
type RefreshEncryptedQuestionPayloadsForGroupFn =
  SessionQuestionCacheController['refreshEncryptedQuestionPayloadsForGroup'];
type RefreshQuestionMetadataForGroupFn = SessionQuestionCacheController['refreshQuestionMetadataForGroup'];
type MainSiteStateRecordUpdater = (prev: Record<string, unknown>) => Record<string, unknown> | null;
type MainSiteCacheControllerStateArg =
  Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown> | null) | null;
type MainSiteStatePatch = Pick<MainSiteState, keyof MainSiteState> | MainSiteState | null;
type MainSiteFallbackRedirectOptions = { pathIn?: string };
type MainSiteSessionPathTokenOptions = { allowAsyncResolve?: boolean };
type MainSiteExplicitSessionSlug = {
  hasExplicitSessionSlug: boolean;
  sessionSlug: string;
};
type MainSiteSbtDetailRouteOptions = {
  search?: string;
  fallbackSlug?: string;
};
type MainSiteMetadataWriterOptions = {
  enforceScopedIsolation?: boolean;
};
type MainSiteSurveyResponseCache = Record<string, Record<string, unknown> | undefined>;
type MainSiteSurveyResponseBlockCache = Record<string, number | undefined>;
type MainSiteQuestionResponseCache = Record<string, Record<string, unknown> | undefined>;
type MainSiteQuestionResponseMeta = Record<string, unknown> & {
  bn?: number | string;
  blockNumber?: number | string;
  txi?: number | string;
  transactionIndex?: number | string;
  txIndex?: number | string;
  li?: number | string;
  logIndex?: number | string;
  ts?: number | string;
  timestamp?: number | string;
};
type MainSiteQuestionResponseMetaCache = Record<
  string,
  Record<string, MainSiteQuestionResponseMeta | undefined> | undefined
>;
type MainSiteMutableMetadata = MetadataRecord & {
  creator?: string;
  creationBlock?: number;
  id?: string;
  questionIDs?: string[];
  surveyID?: string;
};
type MainSiteQuestionFetchResult = {
  qid: string;
  questionData: MainSiteMutableMetadata | null;
};
type MainSiteResponseFetchResult = {
  qId: string;
  data: Record<string, unknown> | null;
};
type MainSiteProfileScanError = Error & {
  arweaveFailure?: { message?: unknown };
  code?: string;
  slug?: string;
};
type MainSiteProfileScanSbt = Record<string, unknown> & {
  sbtAddress?: string;
  sbtInfo?: Record<string, unknown>;
};
type MainSiteProfileActivityEntry = Record<string, unknown> & {
  id?: string;
  surveyId?: string;
  surveyID?: string;
  questionId?: string;
  questionID?: string;
  responder?: string;
  response?: unknown;
  data?: MainSiteMutableMetadata;
  blockNumber?: number | string;
  transactionIndex?: number | string;
  txIndex?: number | string;
  logIndex?: number | string;
  timestamp?: number | string;
};
type MainSiteProfileActivityPayload = {
  createdSurveys: MainSiteProfileActivityEntry[];
  createdQuestions: MainSiteProfileActivityEntry[];
  surveyResponses: MainSiteProfileActivityEntry[];
  questionResponses: MainSiteProfileActivityEntry[];
};
type MainSiteProfileUserData = MainSiteProfileActivityPayload & {
  sbts: MainSiteProfileScanSbt[];
};
type MainSiteProfileUserChainEntry = Record<string, unknown> & {
  lastBlockScanned?: number;
  lastScanTimestamp?: number;
  scanIncomplete?: boolean;
  surveyActivityLastBlockScanned?: number;
  surveyActivityScanIncomplete?: boolean;
  questionActivityLastBlockScanned?: number;
  questionActivityScanIncomplete?: boolean;
  sbtLastBlockScanned?: number;
  sbtScanIncomplete?: boolean;
  sbtBackfillComplete?: boolean;
  data?: MainSiteProfileUserData;
};
type MainSiteProfileUserCache = Record<string, Record<string, MainSiteProfileUserChainEntry>>;
type MainSiteProfileScanReport = {
  targetAddress: string;
  usedAllSessions: boolean;
  useAllSessionsSbtScan: boolean;
  useAllSessionsSurveyActivityScan: boolean;
  useAllSessionsQuestionActivityScan: boolean;
  useAllSessionsActivityScan: boolean;
  listScopeSbtFanout: boolean;
  listScopeSurveyActivityFanout: boolean;
  listScopeQuestionActivityFanout: boolean;
  attemptedSlugs: string[];
  scannedSlugs: string[];
  skippedSlugs: string[];
  skippedSlugReasons: Record<string, string>;
  failedSlugs: string[];
  failedActivitySlugs: string[];
  allActivityFailed: boolean;
  allSbtFailed: boolean;
  hadRpcErrors: boolean;
  anyNewData: boolean;
  coverageComplete: boolean;
  coverageReason: string;
  registryEntryCount: number;
  hadLoadErrors: boolean;
  rawAllSlugCount: number;
  activeChainSlugCount: number;
  scopedFallbackSlugCount: number;
  relevantSlugs: string[];
  prioritizedGeneralFirst: boolean;
  scanOrdering: string;
  slugFetchTimeoutMs: number;
  sbtFetchTimeoutMs: number;
  activityFetchTimeoutMs: number;
  activityLookbackBlocks: number;
  sbtBurstSize: number;
  totalSbtContractsFound: number;
  totalCreatedSurveysFound: number;
  totalCreatedQuestionsFound: number;
  totalSurveyResponsesFound: number;
  totalQuestionResponsesFound: number;
  sampleSbtAddresses: string[];
  sampleCreatedSurveyIds: string[];
  sampleCreatedQuestionIds: string[];
  sampleSurveyResponseIds: string[];
  sampleQuestionResponseIds: string[];
};
type MainSiteProfileActivityWindow = {
  fromBlock: number;
  shouldForceBackfill: boolean;
};
type MainSiteProfileTimeoutOutcome<T = unknown> = {
  timedOut: boolean;
  value?: T;
  error?: unknown;
};
type MainSiteProfileBackfillTimeoutOptions = Record<string, unknown> & {
  floorTimeoutMs?: number;
  spanStepBlocks?: number;
  timeoutCapMs?: number;
};
type MainSiteProfileResponseRecency = {
  bn: number;
  txi: number;
  li: number;
  ts: number;
};
type MainSiteRuntimeFlags = {
  CE_SURVEY_DEEPLINK_RPC_TIMEOUT_MS?: unknown;
  ENABLE_RPC_DEBUG_LOGGING?: unknown;
  __CE_PROFILE_SCAN_LAST_EVENT_SUMMARY__?: unknown;
};
type MainSiteSurveyEventLike = Record<string, unknown> & {
  blockNumber: number;
  logIndex?: number;
  questionIds: string[];
  responder: string;
  surveyId: string;
  timestamp?: number;
  transactionHash?: string;
  transactionIndex?: number;
  txIndex?: number;
  type?: string;
};
type MainSiteSurveyNetworkCache = Record<string, unknown> & {
  surveysLatestBlock?: number;
  surveys: Record<string, SurveyMetadataCacheEntry | unknown>;
  surveyResponses: MainSiteSurveyResponseCache;
  surveyResponsesLatestBlock: MainSiteSurveyResponseBlockCache;
  pendingSurveyMetadata?: Record<string, unknown>;
};
type MainSiteSbtProfileCacheEntry = Record<string, unknown> & {
  blockNumber?: number;
  mintedAddresses?: string[];
  sbtAddress?: string;
  sbtInfo?: Record<string, unknown>;
  slug?: string;
};
type MainSiteSbtNetworkCache = Record<string, unknown> & {
  lastBlock?: number;
  sbtList: Record<string, MainSiteSbtProfileCacheEntry | undefined>;
};
type MainSiteSbtMetadataCache = Record<string, MainSiteSbtNetworkCache | undefined>;
type MainSiteQuestionNetworkCache = Record<string, unknown> & {
  questionsLatestBlock?: number;
  questionResponsesLatestBlock?: number;
  questions: Record<string, QuestionMetadataCacheEntry | unknown>;
  questionResponses: MainSiteQuestionResponseCache;
  questionResponsesMeta: MainSiteQuestionResponseMetaCache;
  pendingQuestionMetadata?: Record<string, unknown>;
};
type MainSiteSurveyMetadataCache = Record<string, MainSiteSurveyNetworkCache | undefined>;
type MainSiteQuestionMetadataCache = Record<string, MainSiteQuestionNetworkCache | undefined>;
type MainSiteScanScopeContext = ReturnType<SessionScanPolicy['getSessionScanScopeContext']>;
type MainSiteProfileScanControllerBootstrap = SessionProfileScanController & {
  _registryBootstrapPromise?: Promise<unknown> | null;
  _registryBootstrapScopeKey?: string;
};

const isMainSiteRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object';

const hasMainSiteRegistryIdentity = (sessionConfig: MainSiteSessionConfigLike | null | undefined): boolean => {
  if (!isMainSiteRecord(sessionConfig)) return false;
  const registry = isMainSiteRecord(sessionConfig.__registry) ? sessionConfig.__registry : {};
  return !!(
    sessionConfig.sessionId ||
    sessionConfig.sessionIdHex ||
    sessionConfig.metadataURI ||
    registry.sessionId ||
    registry.sessionIdHex ||
    registry.metadataURI
  );
};

const isMainSitePresent = <T,>(value: T | null | undefined): value is T => value !== null && value !== undefined;

const readMainSiteErrorMessage = (error: unknown): unknown => (error instanceof Error ? error.message : error);

const toMainSiteScanScopeContext = (ctx: unknown): MainSiteScanScopeContext | null => {
  if (!isMainSiteRecord(ctx)) return null;
  return {
    scope: String(ctx.scope || ''),
    list: Array.isArray(ctx.list) ? ctx.list.map((slug) => String(slug || '')) : [],
    activeSlug: String(ctx.activeSlug || ''),
    activeSlugFromRoute: ctx.activeSlugFromRoute === true,
  };
};

const getMainSiteRuntimeGlobal = (): typeof globalThis & MainSiteRuntimeFlags =>
  globalThis as typeof globalThis & MainSiteRuntimeFlags;

const getMainSiteRuntimeWindow = (): (Window & MainSiteRuntimeFlags) | null =>
  typeof window === 'undefined' ? null : (window as Window & MainSiteRuntimeFlags);

export class AppShell extends Component<MainSiteProps, MainSiteState> {
  state: MainSiteState = {
    // Cache readiness flags
    isSBTCacheReady: false,
    isSurveyCacheReady: false,
    isQuestionCacheReady: false,
    isResponsesCacheReady: false,
    isAllCachesReady: false,

    // Non-fatal cache init errors (surface in UI, but allow cached data to render).
    surveyCacheInitializationError: false,
    questionCacheInitializationError: false,

    cacheHasLoaded: false,
    sbtCacheRevision: 0,
    sbtScanTick: 0,
    sbtScanProgressBySlug: {},
    sbtRealtimeCoverageBySlug: {},
    questionResponsesNonce: 0,
    sessionRegistryRevision: 0,
    questionScanProgress: null,

    // Scan state tracking
    isScanningForGroup: null, // ID currently being scanned
    scanFailedFor: null, // ID confirmed not found in any group
    scanErrorFor: null, // ID found or attempted, but failed to load reliably
    scanErrorMessage: '',
    sbtDetailGroupSlug: null,
    sbtDetailAddress: null,

    litHooks: null,
    sessionInfoOverrides: {},
    sessionNameOverrides: {},
    sessionHeaderOverrides: {},
    groupCredentials: {},
    sessionPathResolutionNonce: 0,
    isCacheManagerReady: false,
  };

  setRecordStateFromController = (updater: MainSiteStateRecordUpdater, cb?: () => void): void => {
    this.setState((prevState) => updater(prevState) as MainSiteStatePatch, cb);
  };

  setCacheControllerState = (updater: MainSiteCacheControllerStateArg, cb?: () => void): void => {
    this.setState(
      (prevState) =>
        typeof updater === 'function' ? (updater(prevState) as MainSiteStatePatch) : (updater as MainSiteStatePatch),
      cb,
    );
  };

  readDgRecord = (name: string, slug: string, opts?: Record<string, unknown>): Record<string, unknown> | null => {
    const value = this.DG.read(name, slug, opts);
    return isMainSiteRecord(value) ? value : null;
  };

  _cacheReadinessController: SessionCacheReadinessController = createSessionCacheReadinessController({
    getState: () => this.state,
    setState: this.setRecordStateFromController,
    isMounted: () => this._mounted,
    resolveActiveSlug: () => this.resolveActiveSlugForCacheUpdates(),
    getSessionSlugFromState: () => this.getSessionSlugFromState(),
    getCurrentPathname: () => this.getCurrentPathname(),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    syncCacheHasLoadedFlagFromPersistent: (
      slug: string,
      opts: Parameters<NonNullable<SessionCacheReadinessHost['syncCacheHasLoadedFlagFromPersistent']>>[1],
    ) => this.syncCacheHasLoadedFlagFromPersistent(slug, opts),
    readFlag: (name: string, slug: string) => this.readFlag(name, slug),
    isInitInFlight: (slug: string) => ({
      question: !!this._questionCacheController?.isInitInFlight?.(slug),
      survey: !!this._surveyCacheController?.isInitInFlight?.(slug),
      response: !!this._responseHydrationController?.isInitInFlight?.(slug),
    }),
    shouldAutoRunFullSbtScan: (opts: { pathname: string }) => this.shouldAutoRunFullSbtScan(opts),
    initializeSbtCache: (opts: { mode: 'auto' | 'partial' | 'full' }) => this.initializeSbtCache(opts),
    startSbtEventListener: () => this.startSbtEventListener(),
  });

  _cachePersistenceController: SessionCachePersistenceController = createSessionCachePersistenceController({
    dgRead: (name: string, slug: string) => this.DG.read(name, slug),
    dgWrite: (name: string, slug: string, obj: boolean) => this.DG.write(name, slug, obj),
    isMounted: () => this._mounted,
    getActiveSlug: () => this.getSessionSlugFromState(),
    setState: this.setRecordStateFromController,
  } satisfies SessionCachePersistenceHost);

  _queuedSurveyGroupScanId: string | null = null;
  _queuedSurveyGroupScanHintedSlug = '';
  _queuedSurveyGroupScanTimer: ReturnType<typeof setTimeout> | null = null;
  _surveyGroupScanInFlight = new Set<string>();
  _scanPolicy: SessionScanPolicy = createMainSiteSessionScanPolicy(this);
  _profileScanController: SessionProfileScanController = createSessionProfileScanController({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionSlugFromState: () => this.getSessionSlugFromState(),
    getSessionChainId: (slug?: string) => this.getSessionChainId(slug),
    getSessionCfg: (slug?: string) => this.getSessionCfg(slug),
    getSessionScanScopeContext: (scope?: unknown) => ({
      ...this.getSessionScanScopeContext(typeof scope === 'string' ? scope : undefined),
    }),
    getScopedSessionSlugs: (scope: string) => this.getScopedSessionSlugs(scope),
    isSessionSlugAllowedForScan: (slug: string, ctx) =>
      this.isSessionSlugAllowedForScan(slug, toMainSiteScanScopeContext(ctx)),
    getScopeFilteredSlugs: (slugs?: string[], scope?: string | null) => this.getScopeFilteredSlugs(slugs, scope),
    getAccount: () => this.props.account,
    getProvider: () => this.props.provider,
    getNetworkId: () => Number(this.props?.network?.id || this.props?.network?.chainId || 0) || null,
    isMounted: () => this._mounted !== false,
    scanSpecificUserProfile: (address: string) => this.scanSpecificUserProfile(address),
  } satisfies SessionProfileScanHost);
  _sbtCacheController: SessionSbtCacheController = createSessionSbtCacheController({
    setState: this.setCacheControllerState,
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (name: unknown, slug: unknown, opts?: unknown) =>
      this.DG.read(name as string, slug as string, isMainSiteRecord(opts) ? opts : undefined),
    dgWrite: (name: unknown, slug: unknown, value: unknown) => this.DG.write(name as string, slug as string, value),
    dgKey: (name: unknown, slug: unknown) => this.DG.key(name as string, slug as string),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (slug: string) => this.getCacheSessionCfg(slug),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getSessionScanScope: () => this.getSessionScanScope(),
    getSessionScanScopeContext: (scope?: string) => this.getSessionScanScopeContext(scope),
    getAccount: () => this.props?.account || '',
    getCurrentPath: () => this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    getEffectiveRoutePath: (pathIn?: string) => this.getEffectiveRoutePath(pathIn || ''),
    getScopeFilteredSlugs: (slugs: string[], scope?: string) => this.getScopeFilteredSlugs(slugs, scope),
    getScopedSessionSlugs: (scope?: string) => this.getScopedSessionSlugs(scope),
    shouldSkipSessionScanForSlug: (slug: string, op: string, scopeCtx?: unknown) =>
      this.shouldSkipSessionScanForSlug(slug, op, toMainSiteScanScopeContext(scopeCtx)),
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    logScopeSkipOnce: (op: string, slug: string, scopeCtx?: unknown) =>
      this.logScopeSkipOnce(op, slug, toMainSiteScanScopeContext(scopeCtx)),
    isSbtInstanceListenerEnabledForGroup: (slug: string) => this.isSbtInstanceListenerEnabledForGroup(slug),
    shouldAutoRunFullSbtScan: (opts?: Record<string, unknown>) =>
      this.shouldAutoRunFullSbtScan({
        pathname: typeof opts?.pathname === 'string' ? opts.pathname : undefined,
      }),
    isSbtHistoryScanEnabled: () => this.isSbtHistoryScanEnabled(),
    shouldAttachSbtDetailInstanceListener: () => this.shouldAttachSbtDetailInstanceListener(),
    setReadinessStateIfChanged: (patch: Record<string, unknown>, cb?: () => void) =>
      this.setReadinessStateIfChanged(patch, cb),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    queueLocalRevisionUpdate: (opts?: Record<string, unknown>) =>
      this.queueLocalRevisionUpdate({
        needsSbtRevision: opts?.needsSbtRevision === true,
        needsQuestionResponsesNonce: opts?.needsQuestionResponsesNonce === true,
        checkAllCachesReady: opts?.checkAllCachesReady === true,
      }),
    readFlag: (flag: string, slug: string) => this.readFlag(flag, slug),
    writeFlag: (flag: string, slug: string, value: unknown) => this.writeFlag(flag, slug, value),
    refreshEncryptedQuestionPayloadsForGroup: (slug: string, opts?: Record<string, unknown>) =>
      this.refreshEncryptedQuestionPayloadsForGroup(slug, opts),
    initializeSurveyCacheForGroup: (slugIn?: unknown, opts?: unknown) =>
      this.initializeSurveyCacheForGroup(String(slugIn || ''), isMainSiteRecord(opts) ? opts : {}),
    runWithGeneralSessionBackfill: (opts: Record<string, unknown>) => this.runWithGeneralSessionBackfill(opts),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) =>
      this.mergeLegacyNumericNetworkKey(cache, networkID),
  } satisfies SessionSbtCacheHost);
  _surveyCacheController: SessionSurveyCacheController = createSessionSurveyCacheController({
    setState: this.setCacheControllerState,
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (name: string, slug: string) => this.readDgRecord(name, slug),
    updateSurveysCacheAtomic: async (slug, updater) => {
      await updateMainSiteSurveyCacheAtomic(slug, updater);
      return true;
    },
    updateUserCacheAtomic: async (slug, updater) => {
      const updated = await updateCacheAtomic('userCache', slug, updater);
      return updated !== null;
    },
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (slug: string) => this.getCacheSessionCfg(slug),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getAccount: () => this.props.account,
    getProviderLike: () => this.props.provider,
    getCurrentPath: () => this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    shouldSkipSessionScanForSlug: (slug: string, op: string, scopeCtx?: unknown) =>
      this.shouldSkipSessionScanForSlug(slug, op, toMainSiteScanScopeContext(scopeCtx)),
    onSurveyEventDetectedForGroup: (slug: string, event: unknown) =>
      this.onNewSurveyEventDetectedForGroup(slug, event as MainSiteSurveyEventLike),
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    logScopeSkipOnce: (op: string, slug: string, scopeCtx?: unknown) =>
      this.logScopeSkipOnce(op, slug, toMainSiteScanScopeContext(scopeCtx)),
    setReadinessStateIfChanged: (nextState: Record<string, unknown> | null | undefined, cb?: () => void) =>
      this.setReadinessStateIfChanged(nextState, cb),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    readFlag: (name: string, slug: string) => this.readFlag(name, slug),
    writeFlag: (name: string, slug: string, val: unknown) => this.writeFlag(name, slug, val),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) =>
      this.mergeLegacyNumericNetworkKey(cache, networkID),
    initializeQuestionCacheForGroup: (slug: string, opts?: Record<string, unknown>) =>
      this.initializeQuestionCacheForGroup(slug, opts),
    writeSurveyMetadataToCache: (
      slug: string,
      surveyID: string,
      surveyData: Record<string, unknown>,
      creationBlock: unknown,
      networkID: string,
      opts?: Record<string, unknown>,
    ) =>
      this.writeSurveyMetadataToCache(slug, surveyID, surveyData, creationBlock as number | string | null, networkID, {
        enforceScopedIsolation: opts?.enforceScopedIsolation === true,
      }),
    queueLocalRevisionUpdate: (opts?: Parameters<SessionCacheReadinessController['queueLocalRevisionUpdate']>[0]) =>
      this.queueLocalRevisionUpdate(opts),
    getSessionScanScope: () => this.getSessionScanScope(),
  } satisfies SessionSurveyCacheHost);
  _questionCacheController: SessionQuestionCacheController = createSessionQuestionCacheController({
    setState: this.setCacheControllerState,
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (name: string, slug: string, opts?: Record<string, unknown>) => this.readDgRecord(name, slug, opts),
    updateQuestionsCacheAtomic: async (slug, updater) => {
      await updateMainSiteQuestionCacheAtomic(slug, updater);
      return true;
    },
    updateUserCacheAtomic: async (slug, updater) => {
      const updated = await updateCacheAtomic('userCache', slug, updater);
      return updated !== null;
    },
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (slug: string) => this.getCacheSessionCfg(slug),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getSessionScanScope: () => this.getSessionScanScope(),
    getAccount: () => this.props.account,
    getProviderLike: () => this.props.provider,
    getNetwork: () => this.props?.network || null,
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    setReadinessStateIfChanged: (nextState: Record<string, unknown> | null | undefined, cb?: () => void) =>
      this.setReadinessStateIfChanged(nextState, cb),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) =>
      this.mergeLegacyNumericNetworkKey(cache, networkID),
    buildMetadataSessionCacheEnvelope: (
      questionData: Record<string, unknown>,
      slug: string,
      opts?: Record<string, unknown>,
    ) =>
      this.buildMetadataSessionCacheEnvelope(questionData, slug, {
        scoped: opts?.scoped === true,
        includeSlugField: opts?.includeSlugField === true,
      }),
    writeQuestionMetadataToCache: (
      slug: string,
      questionID: string,
      questionData: Record<string, unknown>,
      networkID: string,
      opts?: Record<string, unknown>,
    ) =>
      this.writeQuestionMetadataToCache(slug, questionID, questionData, networkID, {
        enforceScopedIsolation: opts?.enforceScopedIsolation === true,
      }),
    queueLocalRevisionUpdate: (opts?: Parameters<SessionCacheReadinessController['queueLocalRevisionUpdate']>[0]) =>
      this.queueLocalRevisionUpdate(opts),
  } satisfies SessionQuestionCacheHost);
  _responseHydrationController: SessionResponseHydrationController = createSessionResponseHydrationController({
    setState: this.setCacheControllerState,
    isMounted: () => this._mounted,
    dgRead: (name: string, slug: string) => this.readDgRecord(name, slug),
    updateQuestionsCacheAtomic: async (slug, updater) => {
      await updateMainSiteQuestionCacheAtomic(slug, updater);
      return true;
    },
    updateUserCacheAtomic: async (slug, updater) => {
      const updated = await updateCacheAtomic('userCache', slug, updater);
      return updated !== null;
    },
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (slug: string) => this.getCacheSessionCfg(slug),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getAccount: () => this.props.account,
    getProviderLike: () => this.props.provider,
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    setReadinessStateIfChanged: (nextState: Record<string, unknown> | null | undefined, cb?: () => void) =>
      this.setReadinessStateIfChanged(nextState, cb),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) =>
      this.mergeLegacyNumericNetworkKey(cache, networkID),
    queueLocalRevisionUpdate: (opts?: Parameters<SessionCacheReadinessController['queueLocalRevisionUpdate']>[0]) =>
      this.queueLocalRevisionUpdate(opts),
  } satisfies SessionResponseHydrationHost);
  _scanSpecificUserProfileInFlight = new Map<string, Promise<MainSiteProfileScanReport | null>>();
  _profileScanTelemetrySeq = 0;
  _cacheReinitRunSeq = 0;
  _activeCacheReinitRunToken = 0;
  _mounted = false;
  _sessionPathResolver: SessionPathResolverController = createSessionPathResolverController({
    getProvider: () => this.props.provider,
    getAccount: () => this.props.account,
    isMounted: () => this._mounted,
    bumpResolutionNonce: () => {
      this.setState((prev: MainSiteState) => ({
        sessionPathResolutionNonce: Number(prev.sessionPathResolutionNonce || 0) + 1,
      }));
    },
    normalizeRoutePath: (path: string) => this.normalizeRoutePath(path),
    getSessionTokenFromPath: (path: string) => this.getSessionTokenFromPath(path),
    warn: (context: string, error: unknown) => mainSiteLog.warn(context, error),
  });
  _sessionMetaRefreshController: SessionMetaRefreshController = createSessionMetaRefreshController({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionConfigBySlugOrDefault: (slug: string) =>
      getSessionConfigBySlugOrDefault(slug) as Record<string, unknown> | null | undefined,
    getGlobalLitHooks: () => getGlobalLitHooks(),
    getAccount: () => this.props.account || '',
    getProviderLike: () => this.props.provider,
    decryptEnvelopeValue: cryptoUtils.decryptEnvelopeValue,
    setState: (updater) => this.setState((prev) => updater(prev) as MainSiteStatePatch),
    warn: (context: string, error: unknown) => mainSiteLog.warn(context, error),
  });
  _lastGroupChainId: number | null = null;
  _cacheUpdateUnsubscribe: (() => void) | null = null;
  _sessionRegistryCacheUpdateUnsubscribe: (() => void) | null = null;
  _userPriorityPromise: Promise<MainSiteProfileScanReport | null> | null = null;
  _userPriorityTarget: string | null = null;
  _aboutDemoSessionPreloadSlug = '';
  _aboutDemoSessionPreloadPromise: Promise<void> | null = null;
  _sessionFallbackRedirectPath = '';
  _lastProcessedQuestionIdFromPath = '';
  _lastProcessedQuestionSlugFromPath: string | null = null;
  _lastLitRouteContextKey = '';

  get _registryBootstrapPromise(): Promise<unknown> | null {
    const controller = this._profileScanController as MainSiteProfileScanControllerBootstrap;
    return controller._registryBootstrapPromise ?? null;
  }

  set _registryBootstrapPromise(value: Promise<unknown> | null) {
    const controller = this._profileScanController as MainSiteProfileScanControllerBootstrap;
    controller._registryBootstrapPromise = value;
  }

  get _registryBootstrapScopeKey(): string {
    const controller = this._profileScanController as MainSiteProfileScanControllerBootstrap;
    return controller._registryBootstrapScopeKey || '';
  }

  set _registryBootstrapScopeKey(value: string) {
    const controller = this._profileScanController as MainSiteProfileScanControllerBootstrap;
    controller._registryBootstrapScopeKey = value;
  }

  beginSbtLiveProgress: SessionSbtCacheController['beginSbtLiveProgress'] = (...args) =>
    this._sbtCacheController.beginSbtLiveProgress(...args);

  updateSbtLiveProgress: SessionSbtCacheController['updateSbtLiveProgress'] = (...args) =>
    this._sbtCacheController.updateSbtLiveProgress(...args);

  clearSbtLiveProgress: SessionSbtCacheController['clearSbtLiveProgress'] = (...args) =>
    this._sbtCacheController.clearSbtLiveProgress(...args);

  setSbtRealtimeCoverageForGroup: SessionSbtCacheController['setSbtRealtimeCoverageForGroup'] = (...args) =>
    this._sbtCacheController.setSbtRealtimeCoverageForGroup(...args);

  clearSbtRealtimeCoverageForGroup: SessionSbtCacheController['clearSbtRealtimeCoverageForGroup'] = (...args) =>
    this._sbtCacheController.clearSbtRealtimeCoverageForGroup(...args);

  normalizeSbtRealtimeEventCursor: SessionSbtCacheController['normalizeSbtRealtimeEventCursor'] = (...args) =>
    this._sbtCacheController.normalizeSbtRealtimeEventCursor(...args);

  compareSbtRealtimeEventCursor: SessionSbtCacheController['compareSbtRealtimeEventCursor'] = (...args) =>
    this._sbtCacheController.compareSbtRealtimeEventCursor(...args);

  removeSbtRealtimeListenersForGroup: SessionSbtCacheController['removeSbtRealtimeListenersForGroup'] = (...args) =>
    this._sbtCacheController.removeSbtRealtimeListenersForGroup(...args);
  normalizeRoutePath = normalizeRoutePathFn;

  isGeneralRoutePath = isGeneralRoutePathFn;

  getEffectiveRoutePath = (pathIn = '') =>
    getEffectiveRoutePathFn(pathIn, {
      windowPathIn: typeof window !== 'undefined' ? window.location.pathname : '',
      redirectPathIn: this._sessionFallbackRedirectPath,
    });

  getSessionFallbackScopeSlugs = () =>
    getSessionFallbackScopeSlugsFn({
      readSessionScanScope,
      readSessionScanSlugs,
      sessionRegistryStore: {
        getAllSessionEntries: sessionRegistryReadsPort.getAllSessionEntries,
      },
      normalizeSessionSlug,
    });

  getSessionFallbackPreferredTarget = () =>
    getSessionFallbackPreferredTargetFn(this.getSessionFallbackScopeSlugs(), { DEFAULT_SESSION_SLUG_ALIAS });

  isFirstVisitRootRedirectEnabled = () =>
    isFirstVisitRootRedirectEnabledFn({
      readBoolishRuntimeFlag: this.readBoolishRuntimeFlag,
      CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED,
    });

  getTemporaryInitialLoadAboutRedirectTarget = (pathIn: unknown = '') =>
    getTemporaryInitialLoadAboutRedirectTargetFn({
      isFirstVisitRootRedirectEnabled: this.isFirstVisitRootRedirectEnabled,
      normalizeRoutePath: (value: unknown) => this.normalizeRoutePath(String(value || '')),
      pathIn,
    });

  getFirstVisitRootRedirectStorage = (): Storage | null => {
    if (typeof window === 'undefined') return null;

    try {
      return window.localStorage;
    } catch (_) {
      try {
        return window.sessionStorage;
      } catch (__) {
        return null;
      }
    }
  };

  shouldForceOneTimeFirstVisitRootRedirect = () =>
    shouldForceOneTimeFirstVisitRootRedirectFn(this.getFirstVisitRootRedirectStorage());

  consumeOneTimeFirstVisitRootRedirect = () =>
    consumeOneTimeFirstVisitRootRedirectFn(this.getFirstVisitRootRedirectStorage(), {
      firstVisitStorageKey: FIRST_VISIT_STORAGE_KEY,
    });

  getSessionFallbackRedirectStorageKey = (slugIn: unknown = '') =>
    getSessionFallbackRedirectStorageKeyFn(slugIn, {
      normalizeSessionSlug,
      DEFAULT_SESSION_SLUG_ALIAS,
      SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX,
    });

  hasConsumedSessionFallbackRedirect = (target: SessionFallbackRedirectTarget | null = null) =>
    hasConsumedSessionFallbackRedirectFn(target, {
      getStorageKey: this.getSessionFallbackRedirectStorageKey,
    });

  consumeSessionFallbackRedirect = (target: SessionFallbackRedirectTarget | null = null) =>
    consumeSessionFallbackRedirectFn(target, {
      getStorageKey: this.getSessionFallbackRedirectStorageKey,
    });

  isOnOrWithinRoutePath = isOnOrWithinRoutePathFn;

  syncSessionFallbackRedirectConsumption = ({ pathIn = '' }: MainSiteFallbackRedirectOptions = {}) => {
    const target = this.getSessionFallbackPreferredTarget();
    if (!target) return null;
    const currentPath = this.getEffectiveRoutePath(pathIn);
    if (this.isOnOrWithinRoutePath(currentPath, target.path)) {
      this.consumeSessionFallbackRedirect(target);
    }
    return target;
  };

  getSessionFallbackRedirectTarget = ({ pathIn = '' }: MainSiteFallbackRedirectOptions = {}) => {
    const currentPath = this.getEffectiveRoutePath(pathIn);
    if (!currentPath || currentPath === '/') return null;
    if (!this.isGeneralRoutePath(currentPath)) return null;
    return this.getSessionFallbackPreferredTarget();
  };

  applySessionFallbackRedirect = ({ pathIn = '' }: MainSiteFallbackRedirectOptions = {}) => {
    if (typeof window === 'undefined') return null;
    const target = this.getSessionFallbackRedirectTarget({ pathIn });
    if (!target) return null;
    if (this.hasConsumedSessionFallbackRedirect(target)) return null;

    const nextUrl = buildPublicUrl(target.path, window.location.search || '', window.location.hash || '');
    const currentUrl = `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
    this._sessionFallbackRedirectPath = target.path;
    this.consumeSessionFallbackRedirect(target);
    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, '', nextUrl);
    }
    return target;
  };

  mergeLegacyNumericNetworkKey = (
    cacheObj: Record<string, unknown> | null | undefined,
    canonicalNetworkKey: unknown,
  ): boolean => {
    if (!cacheObj || typeof cacheObj !== 'object') return false;
    const networkKey = String(canonicalNetworkKey || '');
    if (!networkKey) return false;
    const altKey = Object.keys(cacheObj).find((k) => k !== networkKey && Number(k) === Number(networkKey));
    if (!altKey) return false;
    cacheObj[networkKey] = {
      ...((cacheObj[networkKey] || {}) as Record<string, unknown>),
      ...((cacheObj[altKey] || {}) as Record<string, unknown>),
    };
    delete cacheObj[altKey];
    return true;
  };

  startCacheReinitRun = () => {
    const token = (Number(this._cacheReinitRunSeq) || 0) + 1;
    this._cacheReinitRunSeq = token;
    this._activeCacheReinitRunToken = token;
    return token;
  };

  isCacheReinitRunActive = (token: unknown) =>
    !!this._mounted && Number(token || 0) === Number(this._activeCacheReinitRunToken || 0);

  getCurrentPathname = () => (typeof window !== 'undefined' ? window.location.pathname : '') || this.props.path || '';

  resolveActiveSlugForCacheUpdates = () => {
    const stateSlugRaw = this.getSessionSlugFromState() || '';
    const stateSlug = String(normalizeSessionSlug(stateSlugRaw) || stateSlugRaw || '')
      .trim()
      .toLowerCase();
    if (stateSlug) return stateSlug;

    const path = this.getCurrentPathname();
    const token = this.getSessionTokenFromPath(path);
    if (!token) return '';

    const resolvedFromPathRaw = this.resolveSessionSlugFromPathToken(token, { allowAsyncResolve: false }) || '';
    return String(normalizeSessionSlug(resolvedFromPathRaw) || resolvedFromPathRaw || '')
      .trim()
      .toLowerCase();
  };

  setReadinessStateIfChanged: SessionCacheReadinessController['setReadinessStateIfChanged'] = (...args) =>
    this._cacheReadinessController.setReadinessStateIfChanged(...args);

  syncCacheHasLoadedFlagOnTransition: SessionCacheReadinessController['syncCacheHasLoadedFlagOnTransition'] = (
    ...args
  ) => this._cacheReadinessController.syncCacheHasLoadedFlagOnTransition(...args);

  scheduleCacheUpdateFlush: SessionCacheReadinessController['scheduleCacheUpdateFlush'] = (...args) =>
    this._cacheReadinessController.scheduleCacheUpdateFlush(...args);

  queueCacheUpdateFlush: SessionCacheReadinessController['queueCacheUpdateFlush'] = (...args) =>
    this._cacheReadinessController.queueCacheUpdateFlush(...args);

  flushQueuedCacheUpdates: SessionCacheReadinessController['flushQueuedCacheUpdates'] = (...args) =>
    this._cacheReadinessController.flushQueuedCacheUpdates(...args);

  queueLocalRevisionUpdate: SessionCacheReadinessController['queueLocalRevisionUpdate'] = (...args) =>
    this._cacheReadinessController.queueLocalRevisionUpdate(...args);

  flushLocalRevisionUpdate: SessionCacheReadinessController['flushLocalRevisionUpdate'] = (...args) =>
    this._cacheReadinessController.flushLocalRevisionUpdate(...args);

  handleCrossTabCacheUpdateEvent: SessionCacheReadinessController['handleCrossTabCacheUpdateEvent'] = (...args) =>
    this._cacheReadinessController.handleCrossTabCacheUpdateEvent(...args);

  queueSurveyGroupScan = (surveyID: unknown, opts: SurveyGroupScanQueueOptions = {}) => {
    const sid = String(surveyID || '').toLowerCase();
    if (!sid) return;
    const hintedSlug = normalizeSessionSlug(String(opts?.hintedSlug || ''));
    if (this._queuedSurveyGroupScanId === sid && this._queuedSurveyGroupScanHintedSlug === hintedSlug) return;

    this._queuedSurveyGroupScanId = sid;
    this._queuedSurveyGroupScanHintedSlug = hintedSlug;
    try {
      if (this._queuedSurveyGroupScanTimer) clearTimeout(this._queuedSurveyGroupScanTimer);
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }

    this._queuedSurveyGroupScanTimer = setTimeout(() => {
      const hintedSlugForRun = this._queuedSurveyGroupScanHintedSlug || '';
      this._queuedSurveyGroupScanTimer = null;
      this._queuedSurveyGroupScanId = null;
      this._queuedSurveyGroupScanHintedSlug = '';
      this.scanForSurveyGroup(sid, { hintedSlug: hintedSlugForRun });
    }, 0);
  };

  pruneMaskedQuestionDecryptBackoff: SessionQuestionCacheController['pruneMaskedQuestionDecryptBackoff'] = (...args) =>
    this._questionCacheController.pruneMaskedQuestionDecryptBackoff(...args);

  // Group slug parser
  getSessionTokenFromPath = (pathIn = ''): string => {
    const p = String(this.getEffectiveRoutePath(pathIn) || '').trim();
    if (!p.startsWith('/session/')) return '';
    return (p.split('/').filter(Boolean)[1] || '').trim();
  };

  resolveSessionSlugFromPathToken = (
    rawToken: unknown,
    { allowAsyncResolve = false }: MainSiteSessionPathTokenOptions = {},
  ): string => {
    const sessionToken = String(rawToken || '').trim();
    const result = resolveMainSiteSessionSlugFromPathToken({
      rawToken: sessionToken,
      formatSessionId: sessionRegistryReadsPort.formatSessionId,
      resolveSessionConfigById: sessionRegistryReadsPort.getSessionConfigById,
      resolveSessionConfigBySlug: (slug: string) =>
        sessionRegistryReadsPort.getSessionConfig(slug) || getSessionConfigBySlug(slug),
    });
    if (!result && allowAsyncResolve) {
      const sessionId = sessionRegistryReadsPort.formatSessionId(sessionToken);
      if (sessionId) this.resolveSessionPathId(sessionId);
    }
    return result;
  };

  resolveSessionPathId = (sessionIdIn: string) => {
    this._sessionPathResolver.resolveId(sessionIdIn);
  };

  resolveSessionPathSlug = (slugIn: string) => {
    this._sessionPathResolver.resolveSlug(slugIn);
  };

  getInitialGroupSlugFromPath = () => {
    const p = this.getEffectiveRoutePath(
      (typeof window !== 'undefined' ? window.location.pathname : '') || this.props.path || '',
    );
    const token = this.getSessionTokenFromPath(p);
    if (token) {
      return this.resolveSessionSlugFromPathToken(token, { allowAsyncResolve: true });
    }
    return DEFAULT_SESSION_SLUG; // canonical default slug in client state
  };

  getExplicitSessionSlugFromProps = (
    props: MainSiteProps = this.props,
    { allowAsyncResolve = true }: MainSiteSessionPathTokenOptions = {},
  ): MainSiteExplicitSessionSlug => {
    const path =
      props === this.props
        ? this.getEffectiveRoutePath(
            props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
          )
        : this.normalizeRoutePath(props?.path || '');
    return resolveMainSiteExplicitSessionSlugFromPath({
      path,
      resolveSessionSlugFromPathToken: (sessionToken: string) =>
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve }),
    });
  };

  getGlobalPrimarySessionSlugFromProps = (props: MainSiteProps = this.props): string => {
    return resolveMainSiteGlobalPrimarySessionSlug({
      sessionState: props?.sessionState || {},
      derivePrimarySessionSlugFromList,
    });
  };

  getSessionSlugFromProps = (props: MainSiteProps = this.props): string => {
    const path =
      props === this.props
        ? this.getEffectiveRoutePath(
            props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
          )
        : this.normalizeRoutePath(props?.path || '');
    return resolveMainSiteSessionSlugFromProps({
      path,
      activeSessionSlug: props.activeSessionSlug || '',
      sessionState: props?.sessionState || {},
      resolveSessionSlugFromPathToken: (sessionToken: string) =>
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true }),
      derivePrimarySessionSlugFromList,
    });
  };

  getDisplaySessionCfg = (slugIn: unknown): MainSiteSessionConfigLike | null =>
    resolveMainSiteDisplaySessionConfig(this, slugIn);
  getDisplaySessionChainId = (slugIn: unknown): number | null => resolveMainSiteDisplaySessionChainId(this, slugIn);
  getCacheSessionCfg = (slugIn: unknown): MainSiteSessionConfigLike | null => this.getDisplaySessionCfg(slugIn);
  getCacheSessionChainId = (slugIn: unknown): number | null => this.getDisplaySessionChainId(slugIn);
  getDisplaySessionNetwork = (slugIn: unknown) => resolveMainSiteDisplaySessionNetwork(this, slugIn);
  getInitializableSessionNetwork = (slugIn: unknown, _pathIn: unknown = '') => this.getDisplaySessionNetwork(slugIn);
  initializeWorkerCanonicalCachesForGroup = (
    slugIn: unknown,
    options: { resetReadiness?: boolean } = {},
  ): Promise<boolean> =>
    initializeMainSiteWorkerCanonicalCachesForGroup(this, slugIn, options, (message, error) =>
      mainSiteLog.error(message, readMainSiteErrorMessage(error)),
    );

  isAboutRoutePath = (pathIn: unknown = ''): boolean => {
    const path = this.getEffectiveRoutePath(
      String(pathIn || '') || (typeof window !== 'undefined' ? window.location.pathname : '') || this.props.path || '',
    );
    return path === '/about' || path === '/about/';
  };

  preloadAboutDemoSessionData = (pathIn: unknown = ''): Promise<void> | null =>
    preloadMainSiteAboutDemoSessionData(this, pathIn, (message, details) =>
      mainSiteLog.warn(message, { ...details, error: readMainSiteErrorMessage(details.error) }),
    );

  handleSessionRegistryCacheUpdated = () => {
    if (!this._mounted) return;
    this.setState(
      (prev) => ({
        sessionRegistryRevision: Number(prev?.sessionRegistryRevision || 0) + 1,
      }),
      () => {
        if (!this._mounted) return;
        this.syncLitHooks();
        const activeSlug = normalizeSessionSlug(this.getActiveSessionSlug() || '');
        if (activeSlug) {
          void this.ensureSessionRouteSbtDiscovery(activeSlug);
        }
        this.handleDeepLinkScan();
      },
    );
  };

  getSessionSlugFromState = () => this.getSessionSlugFromProps(this.props);

  getActiveSessionSlug = () => this.getSessionSlugFromState() || this.getInitialGroupSlugFromPath();

  getActiveSessionSourceSlug = () => {
    const path = this.getEffectiveRoutePath(
      (typeof window !== 'undefined' ? window.location.pathname : '') || this.props.path || '',
    );
    const sessionTokenRaw = this.getSessionTokenFromPath(path);
    if (!sessionTokenRaw) return this.getActiveSessionSlug();

    const sessionSlug = this.resolveSessionSlugFromPathToken(sessionTokenRaw, { allowAsyncResolve: false }) || '';
    const strictConfig = sessionRegistryReadsPort.getSessionConfig(sessionSlug) || getSessionConfigBySlug(sessionSlug);
    const displayConfig = strictConfig || getDemoSessionConfigBySlug(sessionSlug, { allowDemoFallback: true });
    return resolveMainSiteSessionRouteSourceSlug({
      sessionTokenRaw,
      sessionSlug,
      sessionConfig: displayConfig,
    });
  };

  getBootstrapActiveSessionSlug = (pathIn = '', searchIn = ''): string => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    );
    const search =
      typeof searchIn === 'string' ? searchIn : (typeof window !== 'undefined' ? window.location.search : '') || '';
    return this.getRenderActiveSessionSlug(path, search);
  };

  getRenderActiveSessionSlug = (pathIn = '', searchIn = ''): string => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    );
    return resolveMainSiteRenderActiveSessionSlug({
      path,
      search: searchIn,
      activeSessionSlug: this.getGlobalPrimarySessionSlugFromProps(this.props),
      isCacheManagerReady: this.state.isCacheManagerReady,
      getSessionConfigBySlug,
      resolveDisplaySessionConfigBySlug: (slug: string) =>
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }),
      resolveSessionConfigById: (sessionId: string | number) =>
        sessionRegistryReadsPort.getSessionConfigById(sessionId),
      resolveSessionSlugFromPathToken: (sessionToken: string) =>
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true }),
    });
  };

  resolveTrustedSbtRouteSessionSlug = (searchIn = ''): string | null => {
    const hintedSlug = resolveMainSiteRouteSessionSlugHint({
      search: searchIn,
      allowSessionIdLookup: true,
      resolveSessionConfigById: (sessionId: string | number) =>
        sessionRegistryReadsPort.getSessionConfigById(
          sessionRegistryReadsPort.formatSessionId(String(sessionId)) || sessionId,
        ),
    });
    if (hintedSlug == null) return null;

    const normalizedHint = normalizeSessionSlug(hintedSlug || '');
    if (isKnownOrGeneralSessionSlug(normalizedHint, getSessionConfigBySlug)) {
      return normalizedHint;
    }
    if (sessionRegistryReadsPort.getSessionConfig(normalizedHint)) {
      return normalizedHint;
    }
    if (getDemoSessionConfigBySlug(normalizedHint, { allowDemoFallback: true })) {
      return normalizedHint;
    }
    return null;
  };

  resolvePinnedSbtDetailRouteSlug = async (
    sbtAddress: string,
    opts: MainSiteSbtDetailRouteOptions = {},
  ): Promise<string> => {
    const search = typeof opts.search === 'string' ? opts.search : '';
    const fallbackSlug = typeof opts.fallbackSlug === 'string' ? opts.fallbackSlug : this.getActiveSessionSlug() || '';
    const hintedDetailSlug = this.resolveTrustedSbtRouteSessionSlug(search);
    if (hintedDetailSlug != null) return hintedDetailSlug;

    const requestedAddress = String(sbtAddress || '')
      .trim()
      .toLowerCase();
    const pinnedAddress = String(this.state.sbtDetailAddress || '')
      .trim()
      .toLowerCase();
    if (requestedAddress && pinnedAddress === requestedAddress && this.state.sbtDetailGroupSlug != null) {
      return this.state.sbtDetailGroupSlug;
    }

    return this.resolveGroupSlugForSbtAddress(sbtAddress, { fallbackSlug });
  };

  getSbtAddressFromPath = (pathIn = '') =>
    getSbtAddressFromPathFn(
      this.getEffectiveRoutePath(pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
      { isAddress: ethers.utils.isAddress },
    );

  isSbtListRoutePath = (pathIn = '') =>
    isSbtListRoutePathFn(
      this.getEffectiveRoutePath(pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
    );

  getSbtListRouteSessionSlug = (pathIn = '', searchIn = '') =>
    getSbtListRouteSessionSlugFn(
      this.getEffectiveRoutePath(pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
      {
        normalizeSessionSlug,
        search: searchIn || (typeof window !== 'undefined' ? window.location.search : '') || '',
      },
    );

  getUserAddressFromPath = (pathIn = '') =>
    getUserAddressFromPathFn(pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '', {
      isAddress: ethers.utils.isAddress,
    });

  redirectLegacyDemoPath = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname || this.props.path || '';
    const strippedPath = stripConfiguredPublicBasePath(path);
    if (!/^\/demo(?:\/|$)/i.test(strippedPath)) return false;
    const nextPath = this.normalizeRoutePath(strippedPath);
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    const nextUrl = buildPublicUrl(nextPath, search, hash);
    if (/^\/demo\/dacc\/?$/i.test(strippedPath) && typeof window.location.replace === 'function') {
      window.location.replace(nextUrl);
      return true;
    }
    window.history.replaceState({}, '', nextUrl);
    return true;
  };

  getLitRouteContextKey = () => resolveMainSiteLitRouteContextKey(this);

  syncLitHooks = () => {
    if (typeof window === 'undefined') return;
    const slug = this.getActiveSessionSlug();
    const cfg = resolveMainSiteLitSessionConfigSource({
      slug,
      resolveRegistryConfigBySlug: (sessionSlug: string) => sessionRegistryReadsPort.getSessionConfig(sessionSlug),
      resolveStaticConfigBySlug: (sessionSlug: string) => getSessionConfigBySlugOrDefault(sessionSlug),
    });
    const { chainId, litNetwork, litChain, accessControlConditions, userMaxPrice, chipotle } =
      resolveMainSiteLitSessionConfig({
        sessionConfig: cfg,
        networkChainIdFallback: this.props.network?.id || null,
      });

    const hooks = chipotle
      ? createLitHooks({
          providerLike: this.props.provider,
          account: this.props.account,
          chainId,
          litChain,
          litNetwork,
          userMaxPrice,
          accessControlConditions: accessControlConditions || undefined,
          chipotle: {
            ...chipotle,
            sessionSlug: slug,
          },
        })
      : null;

    setGlobalLitHooks(hooks);
    attachLitDevTools({
      providerLike: this.props.provider,
      account: this.props.account,
      chainId,
      litChain,
    });
    this.setState(buildMainSiteLitHooksStatePatch(hooks));
  };

  getSessionInfoForGroup = (sessionConfig: unknown = {}, slug = '') => {
    return getSessionInfoForGroupFn(sessionConfig, slug, {
      overrides: this.state.sessionInfoOverrides || {},
      normalizeSessionSlug,
      getDemoSessionConfigBySlug,
      hasEncryptedSessionField: this.hasEncryptedSessionField,
    });
  };

  getSessionNameForGroup = (sessionConfig: unknown = {}, slug = '') => {
    return getSessionNameForGroupFn(sessionConfig, slug, {
      overrides: this.state.sessionNameOverrides || {},
      normalizeSessionSlug,
      getDemoSessionConfigBySlug,
      hasEncryptedSessionField: this.hasEncryptedSessionField,
    });
  };

  hasEncryptedSessionField = (sessionConfig: unknown = {}, field = '') => {
    return hasEncryptedSessionFieldFn(sessionConfig, field);
  };

  getSessionHeaderForGroup = (sessionConfig: unknown = {}, slug = '') => {
    return getSessionHeaderForGroupFn(sessionConfig, slug, {
      overrides: this.state.sessionHeaderOverrides || {},
      normalizeSessionSlug,
      getDemoSessionConfigBySlug,
      normalizeArweaveUrl: normalizeSessionMediaUrl,
    });
  };

  refreshSessionInfo: SessionMetaRefreshController['refreshSessionInfo'] = (...args) =>
    this._sessionMetaRefreshController.refreshSessionInfo(...args);

  refreshSessionMetaFields: SessionMetaRefreshController['refreshSessionMetaFields'] = (...args) =>
    this._sessionMetaRefreshController.refreshSessionMetaFields(...args);

  refreshGroupCredentials = async () => {
    // Legacy metadata-backed Lit credentials are intentionally disabled so
    // payer/delegation material cannot flow through public session metadata.
    return;
  };

  // Smart group resolver for deep-linked surveys
  getSurveyRouteSessionSlugHint = () => {
    try {
      if (typeof window === 'undefined') return null;
      return resolveMainSiteRouteSessionSlugHint({
        search: window.location.search || '',
        allowSessionIdLookup: false,
      });
    } catch (_) {
      return null;
    }
  };

  getSurveyDeepLinkRpcTimeoutMs = () => {
    try {
      if (typeof window !== 'undefined') {
        const fromWindow = Number(getMainSiteRuntimeWindow()?.CE_SURVEY_DEEPLINK_RPC_TIMEOUT_MS);
        if (Number.isFinite(fromWindow) && fromWindow > 0) return Math.floor(fromWindow);
      }
    } catch (e) {
      mainSiteLog.warn('MainSite: fallback', e);
    }
    return 12000;
  };

  resolveMetadataSessionBinding = (metadata: unknown, fallbackSlug = '') =>
    resolveMetadataSessionBindingFn(metadata, fallbackSlug);

  resolveMetadataSessionSlug = (metadata: unknown, fallbackSlug = '') =>
    resolveMetadataSessionSlugFn(metadata, fallbackSlug);

  resolveScopedMetadataSessionSlug = (metadata: unknown, fallbackSlug = '') =>
    resolveScopedMetadataSessionSlugFn(metadata, fallbackSlug);

  buildMetadataSessionCacheEnvelope = (metadata: unknown, fallbackSlug = '', options: BuildEnvelopeOptions = {}) =>
    buildMetadataSessionCacheEnvelopeFn(metadata, fallbackSlug, options);

  writeSurveyMetadataToCache = (
    slugIn: unknown,
    surveyId: unknown,
    surveyData: MetadataRecord | null | undefined,
    creationBlock: number | string | null = null,
    netKeyIn: unknown = null,
    options: MainSiteMetadataWriterOptions = {},
  ): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    const sid = String(surveyId || surveyData?.surveyID || surveyData?.id || '').toLowerCase();
    const netKey = String(netKeyIn || this.getSessionChainId(slug) || '');
    if (!sid || !netKey) return false;
    const enforceScopedIsolation = options.enforceScopedIsolation === true;

    const normalizedSurveyData = prepareSurveyMetadataCacheEntryFn({
      surveyId: sid,
      surveyData,
      slug,
      creationBlock,
      enforceScopedIsolation,
    });

    const groupCache = (this.readDgRecord('surveysCache', slug) || {}) as MainSiteSurveyMetadataCache;
    this.mergeLegacyNumericNetworkKey(groupCache, netKey);
    if (!groupCache[netKey]) {
      groupCache[netKey] = {
        surveysLatestBlock: 0,
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
        pendingSurveyMetadata: {},
      };
    }
    const networkCache = groupCache[netKey] as MainSiteSurveyNetworkCache;
    if (!isMainSiteRecord(networkCache.surveys)) {
      networkCache.surveys = {};
    }
    if (!isMainSiteRecord(networkCache.pendingSurveyMetadata)) {
      networkCache.pendingSurveyMetadata = {};
    }

    networkCache.surveys[sid] = normalizedSurveyData;
    if (networkCache.pendingSurveyMetadata[sid]) {
      try {
        delete networkCache.pendingSurveyMetadata[sid];
      } catch (e) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
    }
    this.DG.write('surveysCache', slug, groupCache);
    return true;
  };

  writeQuestionMetadataToCache = (
    slugIn: unknown,
    questionId: unknown,
    questionData: MetadataRecord | null | undefined,
    netKeyIn: unknown = null,
    options: MainSiteMetadataWriterOptions = {},
  ): boolean => {
    const slug = normalizeSessionSlug(slugIn || '');
    const qid = String(questionId || questionData?.id || '').toLowerCase();
    const netKey = String(netKeyIn || this.getSessionChainId(slug) || '');
    if (!qid || !netKey) return false;
    const enforceScopedIsolation = options.enforceScopedIsolation === true;

    const normalizedQuestionData = prepareQuestionMetadataCacheEntryFn({
      questionId: qid,
      questionData,
      slug,
      enforceScopedIsolation,
    });

    const questionsCache = (this.readDgRecord('questionsCache', slug) || {}) as MainSiteQuestionMetadataCache;
    this.mergeLegacyNumericNetworkKey(questionsCache, netKey);
    if (!questionsCache[netKey]) {
      questionsCache[netKey] = createMainSiteQuestionNetworkCache(0);
    }
    const networkCache = questionsCache[netKey] as MainSiteQuestionNetworkCache;
    if (!isMainSiteRecord(networkCache.questions)) {
      networkCache.questions = {};
    }
    if (!isMainSiteRecord(networkCache.pendingQuestionMetadata)) {
      networkCache.pendingQuestionMetadata = {};
    }
    ensureQuestionArweaveCacheBranches(networkCache);

    networkCache.questions[qid] = normalizedQuestionData;
    if (networkCache.pendingQuestionMetadata[qid]) {
      try {
        delete networkCache.pendingQuestionMetadata[qid];
      } catch (e) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
    }
    this.DG.write('questionsCache', slug, questionsCache);
    return true;
  };

  writeSurveyMetadataToCacheAtomic = async (
    slugIn: unknown,
    surveyId: unknown,
    surveyData: MetadataRecord | null | undefined,
    creationBlock: number | string | null = null,
    netKeyIn: unknown = null,
    options: MainSiteMetadataWriterOptions = {},
  ): Promise<boolean> => {
    const slug = normalizeSessionSlug(slugIn || '');
    const sid = String(surveyId || surveyData?.surveyID || surveyData?.id || '').toLowerCase();
    const netKey = String(netKeyIn || this.getSessionChainId(slug) || '');
    if (!sid || !netKey) return false;
    const normalizedSurveyData = prepareSurveyMetadataCacheEntryFn({
      surveyId: sid,
      surveyData,
      slug,
      creationBlock,
      enforceScopedIsolation: options.enforceScopedIsolation === true,
    });
    await updateMainSiteSurveyCacheAtomic(slug, (current) => {
      const next = (isMainSiteRecord(current) ? current : {}) as MainSiteSurveyMetadataCache;
      this.mergeLegacyNumericNetworkKey(next, netKey);
      const networkCache = next[netKey] || createMainSiteSurveyNetworkCache(0);
      if (!isMainSiteRecord(networkCache.surveys)) networkCache.surveys = {};
      if (!isMainSiteRecord(networkCache.pendingSurveyMetadata)) networkCache.pendingSurveyMetadata = {};
      const existing = networkCache.surveys[sid];
      const existingBlock = Number(isMainSiteRecord(existing) ? existing.creationBlock : 0);
      const incomingBlock = Number(normalizedSurveyData.creationBlock || 0);
      if (!existing || existingBlock <= incomingBlock) {
        networkCache.surveys[sid] = { ...(isMainSiteRecord(existing) ? existing : {}), ...normalizedSurveyData };
      }
      delete networkCache.pendingSurveyMetadata[sid];
      next[netKey] = networkCache;
      return next;
    });
    return true;
  };

  writeQuestionMetadataToCacheAtomic = async (
    slugIn: unknown,
    questionId: unknown,
    questionData: MetadataRecord | null | undefined,
    netKeyIn: unknown = null,
    options: MainSiteMetadataWriterOptions = {},
  ): Promise<boolean> => {
    const slug = normalizeSessionSlug(slugIn || '');
    const qid = String(questionId || questionData?.id || '').toLowerCase();
    const netKey = String(netKeyIn || this.getSessionChainId(slug) || '');
    if (!qid || !netKey) return false;
    const normalizedQuestionData = prepareQuestionMetadataCacheEntryFn({
      questionId: qid,
      questionData,
      slug,
      enforceScopedIsolation: options.enforceScopedIsolation === true,
    });
    await updateMainSiteQuestionCacheAtomic(slug, (current) => {
      const next = (isMainSiteRecord(current) ? current : {}) as MainSiteQuestionMetadataCache;
      this.mergeLegacyNumericNetworkKey(next, netKey);
      const networkCache = next[netKey] || createMainSiteQuestionNetworkCache(0);
      if (!isMainSiteRecord(networkCache.questions)) networkCache.questions = {};
      if (!isMainSiteRecord(networkCache.pendingQuestionMetadata)) networkCache.pendingQuestionMetadata = {};
      ensureQuestionArweaveCacheBranches(networkCache);
      const existing = networkCache.questions[qid];
      networkCache.questions[qid] = {
        ...(isMainSiteRecord(existing) ? existing : {}),
        ...normalizedQuestionData,
      };
      delete networkCache.pendingQuestionMetadata[qid];
      next[netKey] = networkCache;
      return next;
    });
    return true;
  };

  isBuiltInDemoSessionRoutePath = (pathIn: unknown = ''): boolean => {
    const routePath = this.getEffectiveRoutePath(String(pathIn || this.getCurrentPathname() || ''));
    return routePath === '/session/demo' || routePath.startsWith('/session/demo/');
  };

  seedBuiltInDemoQuestionCache = (): boolean => {
    const questionPool = getPolisDemoQuestionPool();
    if (!Array.isArray(questionPool) || questionPool.length === 0) return false;

    const networkID = String(
      this.getDisplaySessionChainId('demo') ||
        this.getSessionChainId('demo') ||
        this.getSessionChainId('') ||
        DEFAULT_CHAIN_ID ||
        '',
    );
    if (!networkID) return false;

    const targetSlugs = ['', 'demo'];
    let wroteAny = false;
    targetSlugs.forEach((slug) => {
      questionPool.forEach((question) => {
        const questionId = String(question?.id || '')
          .trim()
          .toLowerCase();
        if (!questionId) return;
        const didWrite = this.writeQuestionMetadataToCache(slug, questionId, question as MetadataRecord, networkID, {
          enforceScopedIsolation: false,
        });
        wroteAny = wroteAny || didWrite;
      });
    });

    if (wroteAny) {
      this.setReadinessStateIfChanged(
        {
          isQuestionCacheReady: true,
          questionScanProgress: null,
        },
        this.checkAllCachesReady,
      );
    }
    return wroteAny;
  };

  findGroupSlugForSurvey = (surveyID: string | null | undefined): string => {
    return findGroupSlugForSurveyFn(surveyID, {
      getCurrentSlug: () => this.getSessionSlugFromState(),
      getQueryHintSlug: () => this.getSurveyRouteSessionSlugHint(),
      isCacheManagerReady: this.state.isCacheManagerReady,
      getSessionCfg: (slug: string) => this.getSessionCfg(slug),
      dgRead: (collection: string, slug: string) => this.readDgRecord(collection, slug, { clone: false }),
      resolveMetadataSessionSlug: (metadata: unknown, fallbackSlug: string) =>
        this.resolveMetadataSessionSlug(metadata, fallbackSlug),
      getAllSessionSlugs,
      normalizeSessionSlug,
      warn: (error: unknown) => {
        mainSiteLog.warn('MainSite: fallback', error);
      },
    });
  };

  getSessionSlugHintFromSearch = (search: string = ''): string | null => {
    try {
      return resolveMainSiteRouteSessionSlugHint({
        search,
        allowSessionIdLookup: true,
        resolveSessionConfigById: (sessionId: string | number) =>
          sessionRegistryReadsPort.getSessionConfigById(sessionId),
      });
    } catch (_) {
      return null;
    }
  };

  getQuestionRouteSessionSlugHint = () => {
    try {
      if (typeof window === 'undefined') return null;
      return this.getSessionSlugHintFromSearch(window.location.search || '');
    } catch (_) {
      return null;
    }
  };

  getQuestionRouteSessionIdHint = ({ requireResolved = false }: QuestionRouteSessionIdHintOptions = {}):
    string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return resolveMainSiteRouteSessionIdHint({
        search: window.location.search || '',
        requireResolved,
        formatSessionId: sessionRegistryReadsPort.formatSessionId,
        resolveSessionConfigById: (sessionId: string | number) =>
          sessionRegistryReadsPort.getSessionConfigById(sessionId),
      });
    } catch (_) {
      return null;
    }
  };

  findGroupSlugForQuestion = (questionID: string | null | undefined): string => {
    return findGroupSlugForQuestionFn(questionID, {
      getCurrentSlug: () => this.getSessionSlugFromState(),
      getQueryHintSlug: () => this.getQuestionRouteSessionSlugHint(),
      isCacheManagerReady: this.state.isCacheManagerReady,
      getSessionCfg: (slug: string) => this.getSessionCfg(slug),
      dgRead: (collection: string, slug: string) => this.readDgRecord(collection, slug, { clone: false }),
      resolveMetadataSessionSlug: (metadata: unknown, fallbackSlug: string) =>
        this.resolveMetadataSessionSlug(metadata, fallbackSlug),
      getAllSessionSlugs,
      normalizeSessionSlug,
      isKnownOrGeneralSessionSlug: (slug: string) => isKnownOrGeneralSessionSlug(slug, getSessionConfigBySlug),
      warn: (error: unknown) => {
        mainSiteLog.warn('MainSite: fallback', error);
      },
    });
  };

  resolveGroupSlugForSbtAddress = async (
    sbtAddress: string | null | undefined,
    opts: MainSiteSbtDetailRouteOptions = {},
  ): Promise<string> => {
    const fallbackSlug = typeof opts.fallbackSlug === 'string' ? opts.fallbackSlug : this.getActiveSessionSlug() || '';
    return resolveGroupSlugForSbtAddressFn(sbtAddress, {
      fallbackSlug,
      isValidAddress: (addr: string) => ethers.utils.isAddress(addr),
      getSessionScanScope: () => this.getSessionScanScope(),
      getScopedSessionSlugs: (scope: string) => this.getScopedSessionSlugs(scope),
      getAllSessionSlugs,
      dgRead: (collection: string, slug: string) => this.readDgRecord(collection, slug, { clone: false }),
      getSbtMetadata: (provider: string, address: string, slug: string) =>
        sbtMetadataReadsPort.getSbtMetadata(provider, address, slug),
      getSbtCreationBlockByAddress: (provider: string, address: string, slug: string) =>
        sbtMetadataReadsPort.getSbtCreationBlockByAddress(provider, address, slug),
      normalizeSessionSlug,
      getSessionSlugByName,
      getSessionConfigBySlugOrDefault,
      resolveMetadataSessionSlug: (metadata: unknown, slug: string) => this.resolveMetadataSessionSlug(metadata, slug),
      warn: (error: unknown) => {
        mainSiteLog.warn('MainSite: fallback', error);
      },
    });
  };

  // NOTE on general-group key suffix:
  // If you keep general.slug === "", DG keys end with a trailing ":" (e.g., "dg:sbtCache:").
  // You indicated keys will NOT end with ":", so if you change general.slug to "general",
  // DG keys become "dg:sbtCache:general" without special-casing here.
  // Per-group localStorage helper (Data by Group = DG)
  DG: MainSiteDgStorage = createMainSiteDgStorage();

  // Session config accessors (extracted to mainSiteSessionConfig.js)
  getSessionCfg = _getSessionCfg;
  getSessionChainId = (slugIn: string | null | undefined): number | null => {
    const projection = resolveSessionCapabilityProjection(this.getDisplaySessionCfg(slugIn));
    if (projection.chainId) return projection.chainId;
    if (projection.source !== 'legacy_registry') return null;
    return _getSessionChainId(slugIn);
  };
  getSessionNetwork = (slugIn: string | null | undefined) => {
    const chainId = this.getSessionChainId(slugIn);
    if (!chainId) return null;
    const configured = _getSessionNetwork(slugIn);
    if (Number(configured?.id || configured?.chainId || 0) === chainId) return configured;
    return getChainById(chainId) || null;
  };

  isSbtInstanceListenerEnabledForGroup: SessionScanPolicy['isSbtInstanceListenerEnabledForGroup'] = (slugIn) =>
    this._scanPolicy.isSbtInstanceListenerEnabledForGroup(slugIn);

  isSbtHistoryScanEnabled: SessionScanPolicy['isSbtHistoryScanEnabled'] = () =>
    this._scanPolicy.isSbtHistoryScanEnabled();

  getSessionScanScope: SessionScanPolicy['getSessionScanScope'] = () => this._scanPolicy.getSessionScanScope();

  getSessionScanScopeContext: SessionScanPolicy['getSessionScanScopeContext'] = (scopeIn) =>
    this._scanPolicy.getSessionScanScopeContext(scopeIn);
  hasExplicitProfileScanScopeOverride: SessionProfileScanController['hasExplicitProfileScanScopeOverride'] = (
    ...args
  ) => this._profileScanController.hasExplicitProfileScanScopeOverride(...args);

  getProfileScanScopeContext: SessionProfileScanController['getProfileScanScopeContext'] = (...args) =>
    this._profileScanController.getProfileScanScopeContext(...args);

  isSessionSlugAllowedForScan: SessionScanPolicy['isSessionSlugAllowedForScan'] = (slugIn, scopeContextIn = null) =>
    this._scanPolicy.isSessionSlugAllowedForScan(slugIn, scopeContextIn);

  logScopeSkipOnce: SessionScanPolicy['logScopeSkipOnce'] = (operation, slugIn, scopeContextIn = null) =>
    this._scanPolicy.logScopeSkipOnce(operation, slugIn, scopeContextIn);

  shouldAutoRunFullSbtScan: SessionScanPolicy['shouldAutoRunFullSbtScan'] = (opts) =>
    this._scanPolicy.shouldAutoRunFullSbtScan(opts);

  shouldAttachSbtDetailInstanceListener: SessionScanPolicy['shouldAttachSbtDetailInstanceListener'] = () =>
    this._scanPolicy.shouldAttachSbtDetailInstanceListener();

  getScopedSessionSlugs: SessionScanPolicy['getScopedSessionSlugs'] = (scopeIn) =>
    this._scanPolicy.getScopedSessionSlugs(scopeIn);
  readBoolishRuntimeFlag: SessionProfileScanController['readBoolishRuntimeFlag'] = (...args) =>
    this._profileScanController.readBoolishRuntimeFlag(...args);

  isProfileScanTelemetryEnabled: SessionProfileScanController['isProfileScanTelemetryEnabled'] = (...args) =>
    this._profileScanController.isProfileScanTelemetryEnabled(...args);

  emitProfileScanTelemetry: SessionProfileScanController['emitProfileScanTelemetry'] = (...args) =>
    this._profileScanController.emitProfileScanTelemetry(...args);

  isProfileScanColdDiagEnabled: SessionProfileScanController['isProfileScanColdDiagEnabled'] = (...args) =>
    this._profileScanController.isProfileScanColdDiagEnabled(...args);

  emitProfileScanColdDiag: SessionProfileScanController['emitProfileScanColdDiag'] = (...args) =>
    this._profileScanController.emitProfileScanColdDiag(...args);

  readProfileScanStepTimeoutMs: SessionProfileScanController['readProfileScanStepTimeoutMs'] = (...args) =>
    this._profileScanController.readProfileScanStepTimeoutMs(...args);

  readProfileScanSbtBurstSize: SessionProfileScanController['readProfileScanSbtBurstSize'] = (...args) =>
    this._profileScanController.readProfileScanSbtBurstSize(...args);

  readProfileScanActivityLookbackBlocks: SessionProfileScanController['readProfileScanActivityLookbackBlocks'] = (
    ...args
  ) => this._profileScanController.readProfileScanActivityLookbackBlocks(...args);

  readUserProfileAllSessionsFlag: SessionProfileScanController['readUserProfileAllSessionsFlag'] = (...args) =>
    this._profileScanController.readUserProfileAllSessionsFlag(...args);

  getUserProfileAllSessionsScanMode: SessionProfileScanController['getUserProfileAllSessionsScanMode'] = (...args) =>
    this._profileScanController.getUserProfileAllSessionsScanMode(...args);

  isUserProfileAllSessionsScanEnabled: SessionProfileScanController['isUserProfileAllSessionsScanEnabled'] = (
    ...args
  ) => this._profileScanController.isUserProfileAllSessionsScanEnabled(...args);

  getActiveProfileScanChainId: SessionProfileScanController['getActiveProfileScanChainId'] = (...args) =>
    this._profileScanController.getActiveProfileScanChainId(...args);

  getRegistrySessionEntryCount: SessionProfileScanController['getRegistrySessionEntryCount'] = (...args) =>
    this._profileScanController.getRegistrySessionEntryCount(...args);

  getRegistrySessionCoverageCountForChain: SessionProfileScanController['getRegistrySessionCoverageCountForChain'] = (
    ...args
  ) => this._profileScanController.getRegistrySessionCoverageCountForChain(...args);

  getRegistryBootstrapScopeKey: SessionProfileScanController['getRegistryBootstrapScopeKey'] = (...args) =>
    this._profileScanController.getRegistryBootstrapScopeKey(...args);

  readProfileScanRegistryLookupTimeoutMs: SessionProfileScanController['readProfileScanRegistryLookupTimeoutMs'] = (
    ...args
  ) => this._profileScanController.readProfileScanRegistryLookupTimeoutMs(...args);

  getProfileScanListScopeSessionConfigCacheKey: SessionProfileScanController['getProfileScanListScopeSessionConfigCacheKey'] =
    (...args) => this._profileScanController.getProfileScanListScopeSessionConfigCacheKey(...args);

  resolveListScopeSessionConfigFromRegistry: SessionProfileScanController['resolveListScopeSessionConfigFromRegistry'] =
    (...args) => this._profileScanController.resolveListScopeSessionConfigFromRegistry(...args);

  ensureRegistryHydratedForProfileScan: SessionProfileScanController['ensureRegistryHydratedForProfileScan'] = (
    ...args
  ) => this._profileScanController.ensureRegistryHydratedForProfileScan(...args);

  isOnchainSessionRegistryEnabled: SessionProfileScanController['isOnchainSessionRegistryEnabled'] = (...args) =>
    this._profileScanController.isOnchainSessionRegistryEnabled(...args);

  refreshSessionUniverseRegistryCache: SessionProfileScanController['refreshSessionUniverseRegistryCache'] = (
    ...args
  ) => this._profileScanController.refreshSessionUniverseRegistryCache(...args);

  resolveProfileDeepScanPlan: SessionProfileScanController['resolveProfileDeepScanPlan'] = (...args) =>
    this._profileScanController.resolveProfileDeepScanPlan(...args);

  scheduleProfileScanRetryAfterRegistryHydration: SessionProfileScanController['scheduleProfileScanRetryAfterRegistryHydration'] =
    (...args) => this._profileScanController.scheduleProfileScanRetryAfterRegistryHydration(...args);

  getProfileDeepScanSlugs: SessionProfileScanController['getProfileDeepScanSlugs'] = (...args) =>
    this._profileScanController.getProfileDeepScanSlugs(...args);

  shouldSkipSessionScanForSlug: SessionScanPolicy['shouldSkipSessionScanForSlug'] = (
    slugIn,
    operation,
    scopeContextIn = null,
  ) => this._scanPolicy.shouldSkipSessionScanForSlug(slugIn, operation, scopeContextIn);

  scanScopeNoop: SessionScanPolicy['scanScopeNoop'] = (slugIn, operation, onSkipped) =>
    this._scanPolicy.scanScopeNoop(slugIn, operation, onSkipped);

  getScopeFilteredSlugs: SessionScanPolicy['getScopeFilteredSlugs'] = (slugs = [], scopeIn = null) =>
    this._scanPolicy.getScopeFilteredSlugs(slugs, scopeIn);
  shouldBackfillGeneralSession: SessionProfileScanController['shouldBackfillGeneralSession'] = (...args) =>
    this._profileScanController.shouldBackfillGeneralSession(...args);

  enqueueGeneralSessionBackfill: SessionProfileScanController['enqueueGeneralSessionBackfill'] = (...args) =>
    this._profileScanController.enqueueGeneralSessionBackfill(...args);

  runWithGeneralSessionBackfill: SessionProfileScanController['runWithGeneralSessionBackfill'] = (...args) =>
    this._profileScanController.runWithGeneralSessionBackfill(...args);

  scanForSurveyGroup = async (surveyID: unknown, opts: SurveyGroupScanQueueOptions = {}) => {
    const sid = String(surveyID || '').toLowerCase();

    // 1. Guard: Validate ID and prevent concurrent scans for the same ID
    if (!sid) return;
    if (this.state.isScanningForGroup === sid || this.state.scanFailedFor === sid) return;
    if (this._surveyGroupScanInFlight.has(sid)) return;

    // 2. Check if already exists in CURRENT active cache (optimization)
    const currentSlug = this.getSessionSlugFromState();
    const currentChainId = String(this.getSessionChainId(currentSlug));
    const currentCache = this.readDgRecord('surveysCache', currentSlug, {
      clone: false,
    }) as MainSiteSurveyMetadataCache | null;

    if (currentCache?.[currentChainId]?.surveys?.[sid]) {
      mainSiteLog.log(`[MainSite] Survey ${sid} already exists in current group (${currentSlug}).`);
      return;
    }

    this._surveyGroupScanInFlight.add(sid);

    const scanScope = this.getSessionScanScope();
    const hintedSlug = normalizeSessionSlug(String(opts?.hintedSlug || this.getSurveyRouteSessionSlugHint() || ''));
    let allSlugs =
      scanScope === 'all'
        ? this.getScopeFilteredSlugs(getAllSessionSlugs(), scanScope)
        : this.getScopedSessionSlugs(scanScope);
    // Query-hinted survey URLs should resolve in that exact session context first.
    // This avoids long cross-session scans and matches shared-link intent.
    if (hintedSlug) {
      if (!this.getSessionChainId(hintedSlug) && this.isOnchainSessionRegistryEnabled()) {
        try {
          await this.ensureRegistryHydratedForProfileScan();
          allSlugs =
            scanScope === 'all'
              ? this.getScopeFilteredSlugs(getAllSessionSlugs(), scanScope)
              : this.getScopedSessionSlugs(scanScope);
        } catch (e) {
          mainSiteLog.warn('MainSite: fallback', e);
        }
      }
      if (this.getSessionChainId(hintedSlug)) {
        const prioritized = [hintedSlug, ...(Array.isArray(allSlugs) ? allSlugs : [])].map((slug) =>
          normalizeSessionSlug(slug || ''),
        );
        allSlugs = Array.from(new Set(prioritized));
      }
    }

    const rpcTimeoutMs = this.getSurveyDeepLinkRpcTimeoutMs();
    const runWithTimeout = async <T,>(
      promiseFactory: () => Promise<T> | T,
      label: string,
      slug: string,
    ): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          Promise.resolve().then(() => promiseFactory()),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              const err = new Error(
                `[MainSite] DeepLink: ${label} timed out after ${rpcTimeoutMs}ms for slug "${String(slug || '')}".`,
              ) as MainSiteProfileScanError;
              err.code = 'DEEP_LINK_TIMEOUT';
              reject(err);
            }, rpcTimeoutMs);
          }),
        ]);
      } finally {
        if (timeoutId != null) clearTimeout(timeoutId);
      }
    };

    if (!allSlugs.length) {
      this._surveyGroupScanInFlight.delete(sid);
      mainSiteLog.info('[MainSite] DeepLink: scoped session list is empty; skipping scan.', {
        surveyId: sid,
        scope: scanScope,
      });
      this.setState({
        isScanningForGroup: null,
        scanFailedFor: null,
        scanErrorFor: sid,
        scanErrorMessage: 'No in-scope sessions are available for survey resolution.',
      });
      return;
    }

    mainSiteLog.log(
      `[MainSite] DeepLink: Survey ${sid} missing in ${currentSlug}. ` +
        (scanScope === 'all' ? 'Scanning all sessions...' : `Scanning scoped sessions (scope=${scanScope})...`),
    );
    this.setState({
      isScanningForGroup: sid,
      scanFailedFor: null,
      scanErrorFor: null,
      scanErrorMessage: '',
    });

    try {
      let scanLoadError: MainSiteProfileScanError | null = null;
      // 3. Iterate known sessions (clamped by CE_SESSION_SCAN_SCOPE when set)
      for (const slug of allSlugs) {
        // Note: current slug was only cache-checked above; still probe RPC here.

        const chainId = this.getSessionChainId(slug);
        if (!chainId) continue;
        const netKey = String(chainId);

        try {
          // A. Scan: Check existence cheaply using hash
          const hash = await runWithTimeout(
            () => surveyReadsPort.getSurveyHash('none', sid, slug),
            'getSurveyHash',
            slug,
          );

          if (hash && hash !== ethers.constants.HashZero) {
            mainSiteLog.log(`[MainSite] DeepLink: Match found in session '${slug}'. Fetching full data...`);

            // B. Fetch: Get full JSON data immediately
            const surveyData = await runWithTimeout<MainSiteMutableMetadata | null>(
              () =>
                surveyReadsPort.getSurveyDataById('none', sid, slug, {
                  throwOnFailure: true,
                  forceArweaveFetch: true,
                }),
              'getSurveyDataById',
              slug,
            );

            if (surveyData) {
              // Normalize data structure
              surveyData.surveyID = sid;
              surveyData.id = sid;
              if (!surveyData.questionIDs) surveyData.questionIDs = [];
              if (!surveyData.creator) surveyData.creator = '';
              const targetSlug = this.resolveMetadataSessionSlug(surveyData, slug);
              if (!surveyData.sessionSlug) surveyData.sessionSlug = targetSlug;
              if (!surveyData.slug) surveyData.slug = targetSlug;
              const targetNetKey = String(this.getSessionChainId(targetSlug) || netKey);

              // C. Cache: commit the resolved metadata against the latest managed snapshot.
              const persisted = await this.writeSurveyMetadataToCacheAtomic(
                targetSlug,
                sid,
                surveyData,
                null,
                targetNetKey,
              );
              if (!persisted) {
                throw new MainSiteCachePersistenceError(`Failed to persist surveys cache for ${targetSlug}`);
              }

              mainSiteLog.log(
                `[MainSite] DeepLink: Data fetched and cached for survey ${sid} in group ${targetSlug}. Switching context.`,
              );

              // D. Switch: Update Redux and Local State
              this.props.changeActiveSessionSlug(targetSlug);
              this.setState({
                isScanningForGroup: null,
                scanFailedFor: null,
                scanErrorFor: null,
                scanErrorMessage: '',
              });
              return; // Stop scanning, we found it
            }

            scanLoadError = new Error(
              `Survey metadata fetch returned no data for session "${slug}".`,
            ) as MainSiteProfileScanError;
            scanLoadError.code = 'SURVEY_METADATA_EMPTY';
            scanLoadError.slug = slug;
          }
        } catch (innerErr) {
          mainSiteLog.warn(`[MainSite] Error scanning group '${slug}' for survey ${sid}:`, innerErr);
          scanLoadError =
            innerErr instanceof Error
              ? (innerErr as MainSiteProfileScanError)
              : (new Error(String(innerErr || 'Unknown survey scan error')) as MainSiteProfileScanError);
          // Continue to next group
        }
      }

      if (scanLoadError) {
        const message =
          String(
            scanLoadError?.arweaveFailure?.message ||
              scanLoadError?.message ||
              'Survey metadata was found but could not be loaded.',
          ).trim() || 'Survey metadata was found but could not be loaded.';
        this.setState({
          isScanningForGroup: null,
          scanFailedFor: null,
          scanErrorFor: sid,
          scanErrorMessage: message,
        });
        return;
      }
    } catch (err) {
      mainSiteLog.error('[MainSite] DeepLink: Critical error during scan:', err);
      this.setState({
        isScanningForGroup: null,
        scanFailedFor: null,
        scanErrorFor: sid,
        scanErrorMessage: String(readMainSiteErrorMessage(err) || 'Survey resolution failed unexpectedly.'),
      });
      return;
    } finally {
      this._surveyGroupScanInFlight.delete(sid);
      if (this._queuedSurveyGroupScanId === sid) {
        this._queuedSurveyGroupScanId = null;
        this._queuedSurveyGroupScanHintedSlug = '';
      }
    }

    // 4. Failure: Not found in any group
    mainSiteLog.warn(`[MainSite] DeepLink: Survey ${sid} not found in any known group.`);
    this.setState({
      isScanningForGroup: null,
      scanFailedFor: sid,
      scanErrorFor: null,
      scanErrorMessage: '',
    });
  };

  // Per-user deep search orchestrator (fast lane)
  scanSpecificUserProfilePriority = async (
    targetAddress: unknown,
  ): Promise<MainSiteProfileScanReport | null | undefined> => {
    const target = String(targetAddress || '');
    if (!target || !ethers.utils.isAddress(target)) return undefined;

    const targetLower = target.toLowerCase();
    if (this._userPriorityPromise && this._userPriorityTarget === targetLower) {
      return this._userPriorityPromise;
    }

    const scanPromise = this.scanSpecificUserProfile(target);
    this._userPriorityPromise = scanPromise;
    this._userPriorityTarget = targetLower;

    try {
      return await scanPromise;
    } finally {
      if (this._userPriorityPromise === scanPromise) {
        this._userPriorityPromise = null;
        this._userPriorityTarget = null;
      }
    }
  };

  scanSpecificUserProfile = async (targetAddress: unknown): Promise<MainSiteProfileScanReport | null> => {
    const { runMainSiteScanSpecificUserProfile } = await import('./mainSiteProfileScanRuntime.js');
    return runMainSiteScanSpecificUserProfile(this, targetAddress);
  };
  // Tiny flag helpers (boolean-only)
  readFlag: SessionCachePersistenceController['readFlag'] = (name, slug) =>
    this._cachePersistenceController.readFlag(name, slug);

  writeFlag: SessionCachePersistenceController['writeFlag'] = (name, slug, val) =>
    this._cachePersistenceController.writeFlag(name, slug, val);

  hasPersistedManagedCacheData: SessionCachePersistenceController['hasPersistedManagedCacheData'] = (...args) =>
    this._cachePersistenceController.hasPersistedManagedCacheData(...args);

  syncCacheHasLoadedFlagFromPersistent: SessionCachePersistenceController['syncCacheHasLoadedFlagFromPersistent'] = (
    ...args
  ) => this._cachePersistenceController.syncCacheHasLoadedFlagFromPersistent(...args);
  reloadWindowLocation = () => {
    if (typeof window === 'undefined') return;
    reloadWindowLocationFn(window);
  };

  async componentDidMount() {
    if (shouldAutoStartCeRuntimeStats()) {
      startCeRuntimeStats();
    }
    this.redirectLegacyDemoPath();
    let didRedirectInitialLoadToAbout = false;
    if (typeof window !== 'undefined' && this.shouldForceOneTimeFirstVisitRootRedirect()) {
      const currentPath = window.location.pathname || this.props.path || '';
      const aboutRedirectTarget = this.getTemporaryInitialLoadAboutRedirectTarget(currentPath);
      if (
        aboutRedirectTarget?.path &&
        this.normalizeRoutePath(currentPath) !== aboutRedirectTarget.path
      ) {
        window.history.replaceState(
          {},
          '',
          buildPublicUrl(aboutRedirectTarget.path, window.location.search || '', window.location.hash || ''),
        );
        this.consumeOneTimeFirstVisitRootRedirect();
        didRedirectInitialLoadToAbout = true;
      }
    }
    this._mounted = true;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._sessionRegistryCacheUpdateUnsubscribe = sessionRegistryReadsPort.subscribeToCacheUpdates(
        window,
        this.handleSessionRegistryCacheUpdated,
      );
    }
    const mountPathRaw =
      (didRedirectInitialLoadToAbout && typeof window !== 'undefined'
        ? window.location.pathname
        : this.getCurrentPathname()) || '';
    const mountFallbackTarget = this.applySessionFallbackRedirect({ pathIn: mountPathRaw });
    this.syncSessionFallbackRedirectConsumption({ pathIn: mountPathRaw });
    const currentPath = this.getEffectiveRoutePath(mountPathRaw);
    const mountSearch = (typeof window !== 'undefined' ? window.location.search : '') || '';

    // Handle auto-hash persistence (restore)
    this.manageAutoHashPersistence();

    const CACHE_MANAGER_INIT_TIMEOUT_MS = 15000;
    let cacheManagerInitTimeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      await Promise.race([
        initCacheManager(),
        new Promise<never>((_, reject) => {
          cacheManagerInitTimeoutId = setTimeout(() => {
            reject(new Error(`cache manager init timed out after ${CACHE_MANAGER_INIT_TIMEOUT_MS}ms`));
          }, CACHE_MANAGER_INIT_TIMEOUT_MS);
        }),
      ]);
    } catch (e) {
      mainSiteLog.warn('[MainSite] cacheScripts init failed; continuing with fallback behavior', e);
    } finally {
      if (cacheManagerInitTimeoutId) {
        clearTimeout(cacheManagerInitTimeoutId);
        cacheManagerInitTimeoutId = null;
      }
      if (this._mounted) {
        this.setState(buildMainSiteCacheManagerReadyStatePatch());
      }
    }

    // Determine active group from URL and persist locally in state
    const postInitPathRaw = this.getCurrentPathname();
    const postInitPath = this.getEffectiveRoutePath(postInitPathRaw);
    const currentSearch = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const routeChangedDuringCacheInit = postInitPath !== currentPath || currentSearch !== mountSearch;
    const bootstrapPath = routeChangedDuringCacheInit ? postInitPath : currentPath;
    const slug = this.getBootstrapActiveSessionSlug(bootstrapPath, currentSearch);
    if (!routeChangedDuringCacheInit) {
      this.props.changeActiveSessionSlug(slug);
    }
    const bootstrapSessionConfig = this.getDisplaySessionCfg(slug);
    const bootstrapClaimsWorkerAuthority = claimsWorkerCanonicalAuthority(bootstrapSessionConfig);
    if (slug && !this.getDisplaySessionChainId(slug) && !bootstrapClaimsWorkerAuthority) {
      this.resolveSessionPathSlug(slug);
    }
    // Track the canonical active group chain id to detect changes without wallet involvement.
    this._lastGroupChainId = this.getSessionChainId(slug);
    this.syncLitHooks();
    this.refreshSessionInfo();
    this.refreshSessionMetaFields();
    this.refreshGroupCredentials();
    const activeProjection = resolveSessionCapabilityProjection(bootstrapSessionConfig);
    const hasExplicitSessionTarget =
      !!this.getSessionTokenFromPath(bootstrapPath) ||
      !!this.getSbtListRouteSessionSlug(bootstrapPath, currentSearch) ||
      resolveMainSiteRouteSessionSlugHint({
        search: currentSearch,
        allowSessionIdLookup: true,
        resolveSessionConfigById: (sessionId: string | number) =>
          sessionRegistryReadsPort.getSessionConfigById(sessionId),
      }) !== null;
    const shouldBootstrapRegistry =
      !hasExplicitSessionTarget || activeProjection.isRegistryCanonical || activeProjection.hasOnChainComponent;
    if (shouldBootstrapRegistry) {
      try {
        const lit = getGlobalLitHooks();
        const bootstrapChainIds = resolveSessionRegistryBootstrapChainIds({
          scope: this.getSessionScanScope(),
          list: readSessionScanSlugs(),
          activeChainId:
            Number(this.getDisplaySessionChainId(slug) || 0) ||
            Number(this.props?.network?.id || this.props?.network?.chainId || 0) ||
            0,
          defaultChainId: DEFAULT_CHAIN_ID,
        });
        const run = sessionRegistryReadsPort.loadGroupRegistryCache({
          chainIds: bootstrapChainIds,
          account: this.props.account,
          providerLike: this.props.provider,
          lit,
          force: true,
          bootstrapRpc: true,
        });
        this._registryBootstrapPromise = run;
        this._registryBootstrapScopeKey = this.getRegistryBootstrapScopeKey(bootstrapChainIds);
        run
          .catch((err: unknown) => {
            mainSiteLog.warn('[SessionRegistry] Failed to load on-chain registry cache:', err);
          })
          .finally(() => {
            if (this._registryBootstrapPromise === run) {
              this._registryBootstrapPromise = null;
              this._registryBootstrapScopeKey = '';
            }
          });
      } catch (err) {
        mainSiteLog.warn('[SessionRegistry] Failed to initialize registry cache:', err);
      }
    }

    // Cache busting (versioned; slug-scoped)
    try {
      // Demo question data and OP Sepolia SBT log-provider inputs both changed.
      // Force a one-time refresh so stale derived caches cannot survive the sync.
      const CURRENT_CACHE_VERSION = '2026-06-19-demo-session-and-sbt-cache-sync-v1';
      const VERSION_KEY = 'appCacheVersion';
      const storedVersion = localStorage.getItem(VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) {
        const cacheRefreshSlugs = [...new Set([...getAllSessionSlugs(), slug].filter(Boolean))];
        let hadPersistedManagedCache = false;
        // Only bust derived/rehydratable caches; preserve user-authored caches.
        for (const s of cacheRefreshSlugs) {
          hadPersistedManagedCache = (await this.hasPersistedManagedCacheData(s)) || hadPersistedManagedCache;
          await Promise.all(DG_PRIMARY_ROUTE_CACHE_NAMES.map((namespace: string) => this.DG.remove(namespace, s)));
          await this.syncCacheHasLoadedFlagFromPersistent(s, { force: true });
        }
        localStorage.setItem(VERSION_KEY, CURRENT_CACHE_VERSION);
        mainSiteLog.log('[CacheBust] Cleared caches for all groups due to version change:', {
          from: storedVersion,
          to: CURRENT_CACHE_VERSION,
        });
        if (
          hadPersistedManagedCache &&
          typeof window !== 'undefined' &&
          window.location &&
          typeof window.location.reload === 'function'
        ) {
          mainSiteLog.log('[CacheBust] Forcing one-time reload after cache version change');
          this.reloadWindowLocation();
          return;
        }
      }
    } catch (e) {
      mainSiteLog.warn('[CacheBust] Version check failed:', e);
    }

    // Initialize cacheHasLoaded from persisted storage (not mirror-only state).
    await this.syncCacheHasLoadedFlagOnTransition(slug, {
      force: true,
      isAllReady: this.state.isAllCachesReady,
    });

    this.props.fetchSessionState();

    mainSiteLog.log('this.props.urlExtension:', this.props.urlExtension);

    // Prioritize user load (deep search) if on a user profile
    const targetUser = this.getUserAddressFromPath(bootstrapPath);
    if (targetUser) {
      mainSiteLog.log(`[MainSite] User Profile detected (${targetUser}). Prioritizing Deep Search.`);
      // Best effort: warm active-chain registry cache without adding another blocking wait.
      try {
        void Promise.resolve(this.ensureRegistryHydratedForProfileScan()).catch(() => null);
      } catch (e) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
      // Hold other RPC-heavy initialization until the user scan completes.
      try {
        await this.scanSpecificUserProfilePriority(targetUser);
      } catch (err) {
        mainSiteLog.warn('[MainSite] Initial deep search failed:', err);
      }
    }

    // Cross-tab cache sync for IDB-backed caches.
    try {
      this._cacheUpdateUnsubscribe = subscribeCacheUpdates(this.handleCrossTabCacheUpdateEvent);
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }

    const pathname = this.getEffectiveRoutePath(this.getCurrentPathname());
    this.preloadAboutDemoSessionData(pathname);
    const isDemoPath = pathname.startsWith('/session/');
    const sbtAddressFromPath = this.getSbtAddressFromPath(pathname);
    const isSbtDetailRoute = !!sbtAddressFromPath;
    const isSbtRoute = this.isSbtListRoutePath(pathname) || isSbtDetailRoute;
    const isQuestionsRoute =
      pathname === '/questions' ||
      pathname === '/questions/' ||
      pathname.startsWith('/question/') ||
      pathname.startsWith('/questions/results');
    const isBuiltInDemoSessionRoute = this.isBuiltInDemoSessionRoutePath(pathname);
    const shouldInitializeActiveSessionCaches = !isStaticNonCacheRoute(pathname);
    mainSiteLog.log(
      shouldInitializeActiveSessionCaches
        ? isDemoPath
          ? 'Initializing caches (demo prioritized order)...'
          : 'Initializing caches sequentially...'
        : 'Skipping active session cache initialization for static route.',
    );

    const workerCanonicalCachesInitialized = shouldInitializeActiveSessionCaches
      ? await this.initializeWorkerCanonicalCachesForGroup(slug, {
          resetReadiness: true,
        })
      : false;
    const sessionNet = shouldInitializeActiveSessionCaches ? this.getInitializableSessionNetwork(slug, pathname) : null;
    mainSiteLog.log('session network (derived):', sessionNet);
    if (workerCanonicalCachesInitialized) {
      mainSiteLog.log('Worker-canonical caches initialized from the verified session authority.');
    } else if (shouldInitializeActiveSessionCaches && sessionNet && sessionNet.id) {
      if (isSbtDetailRoute) {
        // SBT detail: load only this SBT first, defer everything else
        try {
          const detailSlug = await this.resolvePinnedSbtDetailRouteSlug(sbtAddressFromPath, {
            search: currentSearch,
            fallbackSlug: slug,
          });
          this.setState(buildSbtDetailRouteStatePatch({ detailSlug, address: sbtAddressFromPath }));

          // Ensure we don't keep background listeners for other SBTs on a detail page
          this.removeSbtRealtimeListenersForGroup(slug);
          this.removeSbtRealtimeListenersForGroup(detailSlug);

          await this.refreshSbtData(sbtAddressFromPath, detailSlug, { forceCounts: true });
          this.setReadinessStateIfChanged({ isSBTCacheReady: true });

          // Attach instance listener for this SBT only (optional, lightweight)
          if (this.shouldAttachSbtDetailInstanceListener()) {
            this.startSbtDetailInstanceListenerForGroup(detailSlug, [sbtAddressFromPath]);
          }

          // Defer non-SBT caches until after the SBT has loaded
          await this.initializeSurveyCache();
          this.setReadinessStateIfChanged({ isSurveyCacheReady: true });

          await this.initializeQuestionCache();

          this.startSurveyAndQuestionEventListener();

          await this.fetchQuestionResponsesChunked();
          mainSiteLog.log('Initialization complete (SBT-detail path).');

          // Resume normal background SBT loading after detail data is ready.
          (async () => {
            try {
              if (!this.shouldAutoRunFullSbtScan({ pathname })) return;
              await this.initializeSbtCacheForGroup(detailSlug, { mode: 'full' });
              this.setReadinessStateIfChanged({ isSBTCacheReady: true });
              this.startSbtEventListenerForGroup(detailSlug);
            } catch (e) {
              mainSiteLog.error('[Init /sbt/:address] Deferred full scan failed:', e);
            }
          })();
        } catch (e) {
          mainSiteLog.error('[Init /sbt/:address] Error during SBT-detail initialization:', e);
          this.setReadinessStateIfChanged({
            isSBTCacheReady: true,
            isSurveyCacheReady: true,
            isQuestionCacheReady: true,
          });
        }
      } else if (isSbtRoute) {
        // SBT-first when user lands directly on /sbts
        try {
          // 1) Fast featured metadata so UI can render something useful immediately
          await this.initializeSbtCache({ mode: 'partial' });
          // Unblock SBT UI quickly; partial pass sets isSBTCacheReady internally, but ensure true
          this.setReadinessStateIfChanged({ isSBTCacheReady: true });
          // Start SBT listener early so new groups appear while full scan runs
          this.startSbtEventListener();

          // 2) Full on-chain discovery/merge since last processed block (comprehensive)
          if (this.shouldAutoRunFullSbtScan({ pathname })) {
            await this.initializeSbtCache({ mode: 'full' });
            this.setReadinessStateIfChanged({ isSBTCacheReady: true }); // keep flag true after full pass
          }

          // 3) Only after SBTs are ready, hydrate questions/surveys
          await this.initializeSurveyCache();
          this.setReadinessStateIfChanged({ isSurveyCacheReady: true });

          await this.initializeQuestionCache();

          this.startSurveyAndQuestionEventListener();

          await this.fetchQuestionResponsesChunked(); // depends on question cache
          mainSiteLog.log('Initialization complete (SBT-first path).');
        } catch (e) {
          mainSiteLog.error('[Init /sbts] Error during SBT-first initialization:', e);
          // Ensure UI is not blocked if something fails
          this.setReadinessStateIfChanged({
            isSBTCacheReady: true,
            isSurveyCacheReady: true,
            isQuestionCacheReady: true,
          });
        }
      } else if (isQuestionsRoute) {
        // Questions-first when user lands directly on /questions or /question/:id
        // Goal: render question flows ASAP; warm surveys + full SBT scan after.
        try {
          await this.initializeQuestionCache();
          mainSiteLog.log('Question cache initialized (questions-first path).');

          // Lightweight SBT metadata so gate labels/icons can render without a full scan.
          await this.initializeSbtCache({ mode: 'partial' });
          mainSiteLog.log('SBT cache partial metadata ready (questions-first path).');

          // Keep caches fresh while deferred work continues.
          this.startSbtEventListener();
          this.startSurveyAndQuestionEventListener();

          await this.fetchQuestionResponsesChunked(); // depends on question cache
          mainSiteLog.log('Question responses fetched (questions-first path).');

          // Surveys are not needed to render the questions tool, so load after responses.
          await this.initializeSurveyCache();
          this.setReadinessStateIfChanged({ isSurveyCacheReady: true });
          mainSiteLog.log('Survey cache initialized (after questions/responses).');

          // Defer full SBT scan so /questions feels snappy even in non-demo mode.
          (async () => {
            try {
              if (!this.shouldAutoRunFullSbtScan({ pathname })) return;
              await new Promise<void>((resolve) => setTimeout(resolve, 250));
              await this.initializeSbtCache({ mode: 'full' });
              this.setReadinessStateIfChanged({ isSBTCacheReady: true });
              this.startSbtEventListener();
              mainSiteLog.log('SBT cache initialized (deferred full scan, questions-first path).');
            } catch (e) {
              mainSiteLog.error('[Init /questions] Deferred full SBT scan failed:', e);
            }
          })();
        } catch (e) {
          mainSiteLog.error('[Init /questions] Error during questions-first initialization:', e);
          this.setReadinessStateIfChanged({
            isSBTCacheReady: true,
            isSurveyCacheReady: true,
            isQuestionCacheReady: true,
          });
        }
      } else if (isDemoPath) {
        // Demo prioritized: Questions -> (SBT partial) -> listeners -> Responses -> Surveys
        if (isBuiltInDemoSessionRoute) {
          this.seedBuiltInDemoQuestionCache();
        } else {
          await this.initializeQuestionCache();
        }
        mainSiteLog.log('Question cache initialized (demo priority).');

        // Very light partial pass so group names/icons render fast
        await this.initializeSbtCache({ mode: 'partial' });
        // partial pass sets isSBTCacheReady internally to unblock UI
        mainSiteLog.log('SBT cache partial metadata ready (demo priority).');

        // Keep minted counts and membership-sensitive UI fresh on first demo load.
        this.startSbtEventListener();
        this.startSurveyAndQuestionEventListener();

        await this.fetchQuestionResponsesChunked(); // Depends on question cache
        mainSiteLog.log('Question responses fetched (demo priority).');

        await this.initializeSurveyCache();
        this.setReadinessStateIfChanged({ isSurveyCacheReady: true });
        mainSiteLog.log('Survey cache initialized (after questions/responses).');

        // Do NOT run full SBT here; checkAllCachesReady() will trigger deferred full scan.
      } else {
        // Original order preserved for non-demo, non-/sbts paths
        await this.initializeSurveyCache();
        this.setReadinessStateIfChanged({ isSurveyCacheReady: true });
        mainSiteLog.log('Survey cache initialized.');

        await this.initializeQuestionCache();
        mainSiteLog.log('Question cache initialized.');

        this.startSurveyAndQuestionEventListener();

        await this.fetchQuestionResponsesChunked(); // Depends on question cache
        mainSiteLog.log('Question responses fetched.');

        if (this.shouldAutoRunFullSbtScan({ pathname })) {
          await this.initializeSbtCache({ mode: 'full' }); // explicit full to keep behavior identical
        } else {
          await this.initializeSbtCache({ mode: 'partial' });
        }
        this.setReadinessStateIfChanged({ isSBTCacheReady: true });
        this.startSbtEventListener();
        mainSiteLog.log('SBT cache initialized.');
      }
    } else {
      this.setReadinessStateIfChanged({ isQuestionCacheReady: true, isSurveyCacheReady: true });
    }

    this.checkAllCachesReady();

    if (this.props.loginComplete && this.props.account) {
      const path = this.getCurrentPathname();
      const questionIdFromPath = (() => {
        const match = path.match(/\/question\/([^/?#]+)/i);
        return match && match[1] ? String(match[1]).toLowerCase() : '';
      })();
      const activeSlug = this.getActiveSessionSlug();
      const questionSlug = questionIdFromPath ? this.findGroupSlugForQuestion(questionIdFromPath) : null;
      this._lastProcessedQuestionIdFromPath = questionIdFromPath;
      this._lastProcessedQuestionSlugFromPath = questionSlug;
      const slugsToRefresh = Array.from(new Set([activeSlug, questionSlug].filter(isMainSitePresent)));
      slugsToRefresh.forEach((slug: string) => {
        if (!this.hasMaskedQuestionPayloadInCache(slug)) return;
        this.refreshEncryptedQuestionPayloadsForGroup(slug).catch((err: unknown) => {
          mainSiteLog.warn('refreshEncryptedQuestionPayloadsForGroup failed during mount:', {
            slug,
            error: readMainSiteErrorMessage(err),
          });
        });
      });
    }

    // Trigger possible deep link scan after initial mount logic
    this.handleDeepLinkScan();
  }

  componentWillUnmount() {
    stopCeRuntimeStats();
    this._mounted = false;
    this._sessionPathResolver.destroy();
    try {
      if (typeof this._sessionRegistryCacheUpdateUnsubscribe === 'function') {
        this._sessionRegistryCacheUpdateUnsubscribe();
      }
      this._sessionRegistryCacheUpdateUnsubscribe = null;
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    if (this.props.socket !== undefined) {
    }

    try {
      if (typeof this._cacheUpdateUnsubscribe === 'function') {
        this._cacheUpdateUnsubscribe();
      }
      this._cacheUpdateUnsubscribe = null;
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._cachePersistenceController.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._cacheReadinessController.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._scanPolicy?.destroy?.();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._profileScanController.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._sbtCacheController.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._surveyCacheController?.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._questionCacheController?.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._responseHydrationController?.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }
    try {
      this._sessionMetaRefreshController?.destroy();
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }

    try {
      if (this._queuedSurveyGroupScanTimer) clearTimeout(this._queuedSurveyGroupScanTimer);
      this._queuedSurveyGroupScanTimer = null;
      this._queuedSurveyGroupScanId = null;
      this._queuedSurveyGroupScanHintedSlug = '';
    } catch (e) {
      mainSiteLog.warn('MainSite: cleanup', e);
    }

    sbtEventStreamsPort.removeSBTEventListener('none', this.getSessionSlugFromState());
    sbtEventStreamsPort.removeSurveyEventsListener('none', this.getSessionSlugFromState());
    // Also remove any per-instance SBT listeners to avoid leaks across navigation:
    sbtEventStreamsPort.removeSBTInstanceEventsListener('none', [], this.getSessionSlugFromState());
  }

  componentDidUpdate(prevProps: MainSiteProps, prevState: MainSiteState) {
    this.redirectLegacyDemoPath();

    // Handle auto-hash persistence (save on change)
    this.manageAutoHashPersistence();

    const sessionContextChanged =
      this.props.account !== prevProps.account ||
      this.props.provider !== prevProps.provider ||
      this.getSessionSlugFromProps(this.props) !== this.getSessionSlugFromProps(prevProps);
    const sessionPathResolutionChanged =
      Number(this.state.sessionPathResolutionNonce || 0) !== Number(prevState?.sessionPathResolutionNonce || 0);
    const litRouteContextChanged = this.getLitRouteContextKey() !== this._lastLitRouteContextKey;
    if (sessionContextChanged || sessionPathResolutionChanged || litRouteContextChanged) {
      this.syncLitHooks();
      this.refreshSessionInfo();
      this.refreshSessionMetaFields();
      this.refreshGroupCredentials();
      this._questionCacheController?.pruneMaskedQuestionDecryptBackoff?.(Number.MAX_SAFE_INTEGER);
    }
    const authOrProviderChanged =
      this.props.account !== prevProps.account ||
      this.props.provider !== prevProps.provider ||
      this.props.loginComplete !== prevProps.loginComplete;
    const litReadyBefore = !!(prevState?.litHooks && typeof prevState.litHooks.getKey === 'function');
    const litReadyAfter = !!(this.state.litHooks && typeof this.state.litHooks.getKey === 'function');
    const litReadyChanged = litReadyBefore !== litReadyAfter;
    const sbtCacheRevisionChanged =
      Number(this.state.sbtCacheRevision || 0) !== Number(prevState?.sbtCacheRevision || 0);
    const entitlementChanged = sbtCacheRevisionChanged;
    const readinessSignalsChanged = authOrProviderChanged || litReadyChanged || entitlementChanged;
    const authBecameUnavailable =
      !!(prevProps.loginComplete && prevProps.account) && !(this.props.loginComplete && this.props.account);

    if (authBecameUnavailable) {
      this._lastProcessedQuestionIdFromPath = '';
      this._lastProcessedQuestionSlugFromPath = null;
    }

    if (this.props.loginComplete && this.props.account) {
      const prevPath = this.getEffectiveRoutePath(
        prevProps.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
      );
      const path = this.getEffectiveRoutePath(this.getCurrentPathname());
      const activeSlug = this.getActiveSessionSlug();
      const questionIdFromPath = (() => {
        const match = path.match(/\/question\/([^/?#]+)/i);
        return match && match[1] ? String(match[1]).toLowerCase() : '';
      })();
      const questionSlug = questionIdFromPath ? this.findGroupSlugForQuestion(questionIdFromPath) : null;
      const questionSlugChanged = questionSlug !== this._lastProcessedQuestionSlugFromPath;
      // Regression guard: same-route readiness transitions and slug re-resolution
      // still need the masked-question refresh scan; only unrelated churn should skip it.
      const shouldScanQuestionPath =
        prevPath !== path ||
        questionIdFromPath !== this._lastProcessedQuestionIdFromPath ||
        questionSlugChanged ||
        readinessSignalsChanged;
      if (shouldScanQuestionPath) {
        this._lastProcessedQuestionIdFromPath = questionIdFromPath;
        this._lastProcessedQuestionSlugFromPath = questionSlug;
        const slugsToCheck = Array.from(new Set([activeSlug, questionSlug].filter(isMainSitePresent)));

        slugsToCheck.forEach((slug: string) => {
          const masked = this.hasMaskedQuestionPayloadInCache(slug);
          const shouldRetry =
            shouldRetryMaskedQuestionRefresh({
              masked,
              prev: {
                account: prevProps.account,
                provider: prevProps.provider,
                loginComplete: prevProps.loginComplete,
                litHooks: prevState?.litHooks || null,
                sbtCacheRevision: prevState?.sbtCacheRevision || 0,
              },
              next: {
                account: this.props.account,
                provider: this.props.provider,
                loginComplete: this.props.loginComplete,
                litHooks: this.state.litHooks || null,
                sbtCacheRevision: this.state.sbtCacheRevision || 0,
              },
            }) ||
            (masked && (authOrProviderChanged || litReadyChanged || entitlementChanged));

          if (!shouldRetry) return;
          this.refreshEncryptedQuestionPayloadsForGroup(slug).catch((err: unknown) => {
            mainSiteLog.warn('refreshEncryptedQuestionPayloadsForGroup failed after readiness change:', {
              slug,
              error: readMainSiteErrorMessage(err),
            });
          });
        });
      }
    }

    // Re-initialize if the *group* chain id changes (independent of wallet)
    const currSlug = this.getActiveSessionSlug();
    const currChainId = this.getSessionChainId(currSlug);
    const toolsDemoOn = typeof this.props.demoMode === 'object' ? !!this.props.demoMode?.tools : !!this.props.demoMode;
    if (this._lastGroupChainId !== currChainId && !toolsDemoOn) {
      if (getMainSiteRuntimeWindow()?.ENABLE_RPC_DEBUG_LOGGING === true) {
        mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: group chain change detected', {
          old: this._lastGroupChainId,
          new: currChainId,
        });
      }
      this._lastGroupChainId = currChainId;
      this.handleNetworkChange();
    }

    const prevPathRaw = prevProps.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const currPathRaw = this.getCurrentPathname();
    const prevPath = this.getEffectiveRoutePath(prevPathRaw);
    const currPath = this.getEffectiveRoutePath(currPathRaw);
    const currSearch = (typeof window !== 'undefined' ? window.location.search : '') || '';
    this.syncSessionFallbackRedirectConsumption({ pathIn: currPathRaw });
    const prevSessionToken = this.getSessionTokenFromPath(prevPath);
    const currSessionToken = this.getSessionTokenFromPath(currPath);
    const prevSlugFromPath = prevSessionToken
      ? this.resolveSessionSlugFromPathToken(prevSessionToken, { allowAsyncResolve: true })
      : '';
    const currSlugFromPath = currSessionToken
      ? this.resolveSessionSlugFromPathToken(currSessionToken, { allowAsyncResolve: true })
      : '';
    const sessionSlugChanged = prevSlugFromPath !== currSlugFromPath;
    const sessionSlugNeedsSync = !!currSessionToken && this.getSessionSlugFromState() !== currSlugFromPath;

    if (currPath.startsWith('/session/') && (sessionSlugChanged || sessionSlugNeedsSync)) {
      const prevActiveSlug = this.getSessionSlugFromProps(prevProps) || prevSlugFromPath;
      const nextActiveSlug = currSlugFromPath;
      const cacheReinitRunToken = this.startCacheReinitRun();
      const isCacheReinitRunActive = () => this.isCacheReinitRunActive(cacheReinitRunToken);
      if (getMainSiteRuntimeWindow()?.ENABLE_RPC_DEBUG_LOGGING === true) {
        mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: demo slug changed', {
          prevSlug: prevActiveSlug,
          nextSlug: nextActiveSlug,
          sessionSlugChanged,
          sessionSlugNeedsSync,
        });
      }

      // Reset readiness flags & update active session slug immediately.
      this.props.changeActiveSessionSlug(nextActiveSlug);
      this.setReadinessStateIfChanged({
        isSBTCacheReady: false,
        isSurveyCacheReady: false,
        isQuestionCacheReady: false,
        isResponsesCacheReady: false,
        isAllCachesReady: false,
        cacheHasLoaded: false,
        surveyCacheInitializationError: false,
        questionCacheInitializationError: false,
      });

      // Reset slug-scoped cacheHasLoaded and switch listeners/caches in the same order used for demo routes
      (async () => {
        try {
          if (!isCacheReinitRunActive()) return;
          // Stop listeners for the previous slug (safe even if none)
          this.removeSbtRealtimeListenersForGroup(prevActiveSlug || '', { removeInstance: false });
          sbtEventStreamsPort.removeSurveyEventsListener('none', prevActiveSlug || '');
          if (!isCacheReinitRunActive()) return;

          const isSbtRoute =
            this.isSbtListRoutePath(currPath) || currPath.startsWith('/sbt/') || currPath.startsWith('/group/');
          const isBuiltInDemoSessionRoute = this.isBuiltInDemoSessionRoutePath(currPath);

          const sessionNet = this.getInitializableSessionNetwork(nextActiveSlug, currPath);
          if (sessionNet && sessionNet.id) {
            if (isSbtRoute) {
              // SBT-first when landing on /sbts or /sbt/:address
              try {
                await this.initializeSbtCacheWithGeneralBackfill(nextActiveSlug, { mode: 'partial' });
                if (!isCacheReinitRunActive()) return;
                this.setReadinessStateIfChanged({ isSBTCacheReady: true });
                this.startSbtEventListenerForGroup(nextActiveSlug);

                if (this.shouldAutoRunFullSbtScan({ pathname: currPath })) {
                  await this.initializeSbtCacheWithGeneralBackfill(nextActiveSlug, { mode: 'full' });
                  if (!isCacheReinitRunActive()) return;
                  this.setReadinessStateIfChanged({ isSBTCacheReady: true });
                }

                await this.initializeSurveyCacheWithGeneralBackfill(nextActiveSlug);
                if (!isCacheReinitRunActive()) return;
                this.setReadinessStateIfChanged({ isSurveyCacheReady: true });

                await this.initializeQuestionCacheWithGeneralBackfill(nextActiveSlug);
                if (!isCacheReinitRunActive()) return;

                this.startSurveyAndQuestionEventListenerForGroup(nextActiveSlug);

                await this.fetchQuestionResponsesChunkedWithGeneralBackfill(nextActiveSlug);
                if (!isCacheReinitRunActive()) return;
              } catch (e) {
                if (!isCacheReinitRunActive()) return;
                mainSiteLog.error('[SlugChange /sbts] Error during SBT-first reinit:', e);
                this.setReadinessStateIfChanged({
                  isSBTCacheReady: true,
                  isSurveyCacheReady: true,
                  isQuestionCacheReady: true,
                });
              }
            } else {
              // Demo prioritized: Questions -> (SBT partial) -> listeners -> Responses -> Surveys
              if (isBuiltInDemoSessionRoute) {
                this.seedBuiltInDemoQuestionCache();
              } else {
                await this.initializeQuestionCacheWithGeneralBackfill(nextActiveSlug);
              }
              if (!isCacheReinitRunActive()) return;

              await this.initializeSbtCacheWithGeneralBackfill(nextActiveSlug, { mode: 'partial' });
              if (!isCacheReinitRunActive()) return;
              this.setReadinessStateIfChanged({ isSBTCacheReady: true });

              // Start listeners for the *new* slug
              this.startSurveyAndQuestionEventListenerForGroup(nextActiveSlug);
              this.startSbtEventListenerForGroup(nextActiveSlug);

              await this.fetchQuestionResponsesChunkedWithGeneralBackfill(nextActiveSlug);
              if (!isCacheReinitRunActive()) return;

              await this.initializeSurveyCacheWithGeneralBackfill(nextActiveSlug);
              if (!isCacheReinitRunActive()) return;
              this.setReadinessStateIfChanged({ isSurveyCacheReady: true });
            }
          } else {
            if (!isCacheReinitRunActive()) return;
            this.setReadinessStateIfChanged({ isQuestionCacheReady: true, isSurveyCacheReady: true });
          }

          if (!isCacheReinitRunActive()) return;
          this.checkAllCachesReady();
        } catch (err) {
          if (!isCacheReinitRunActive()) return;
          mainSiteLog.error('[SlugChange] Re-initialization failed:', err);
          this.setReadinessStateIfChanged(
            { isSBTCacheReady: true, isSurveyCacheReady: true, isQuestionCacheReady: true },
            this.checkAllCachesReady,
          );
        }
      })();
    }

    if (sessionPathResolutionChanged && !isStaticNonCacheRoute(currPath)) {
      const workerRouteSlug = this.getBootstrapActiveSessionSlug(currPath, currSearch);
      void this.initializeWorkerCanonicalCachesForGroup(workerRouteSlug, { resetReadiness: true });
    }

    const nextDerivedActiveSlug = this.getBootstrapActiveSessionSlug(currPath, currSearch);
    if (!currPath.startsWith('/session/') && this.props.activeSessionSlug !== nextDerivedActiveSlug) {
      this.props.changeActiveSessionSlug(nextDerivedActiveSlug);
    }

    const prevSbtAddr = this.getSbtAddressFromPath(prevPath);
    const currSbtAddr = this.getSbtAddressFromPath(currPath);
    if (currSbtAddr && currSbtAddr !== prevSbtAddr) {
      this.resolvePinnedSbtDetailRouteSlug(currSbtAddr, {
        search: currSearch,
        fallbackSlug: nextDerivedActiveSlug,
      })
        .then((detailSlug: string) => {
          this.setState(buildSbtDetailRouteStatePatch({ detailSlug, address: currSbtAddr }));
        })
        .catch((e: unknown) => {
          mainSiteLog.warn('MainSite: fallback', e);
        });
    } else if (!currSbtAddr && prevSbtAddr) {
      this.setState(buildSbtDetailRouteStatePatch());
    }

    // Check for deep link scan if path changed
    if (currPath !== prevPath) {
      this.preloadAboutDemoSessionData(currPath);
      this.handleDeepLinkScan();
    }
  }

  handleDeepLinkScan = () => {
    const fullPath = this.getCurrentPathname();

    // Extract Survey ID from /survey/:id or /survey/:id/results
    let surveyID = null;
    const validSurveyIdRe = /^0x[0-9a-fA-F]{64}$/;

    const parts = fullPath.split('?')[0].split('/').filter(Boolean);
    // Check for ["survey", "0x..."]
    if (parts[0] === 'survey' && parts[1] && validSurveyIdRe.test(parts[1])) {
      surveyID = parts[1].toLowerCase();
    }

    if (!surveyID) return;

    // 1. Check if we are already scanning or have failed for this ID to prevent loops
    if (this.state.isScanningForGroup === surveyID || this.state.scanFailedFor === surveyID) {
      return;
    }

    // 2. Check if data exists in CURRENT context (Cache or Config)
    const currentSlug = this.getSessionSlugFromState();
    const cache = this.readDgRecord('surveysCache', currentSlug, {
      clone: false,
    }) as MainSiteSurveyMetadataCache | null;
    const netKey = String(this.getSessionChainId(currentSlug));

    // Check Cache
    const inCache = !!cache?.[netKey]?.surveys?.[surveyID];

    // Check Config (Highlighted list)
    const cfg = this.getSessionCfg(currentSlug);
    const inConfig =
      Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
      cfg.HIGHLIGHTED_SURVEY_IDS.some((id: unknown) => String(id).toLowerCase() === surveyID);

    // 3. If missing in current context, trigger the cross-group scan
    if (!inCache && !inConfig) {
      this.scanForSurveyGroup(surveyID, { hintedSlug: this.getSurveyRouteSessionSlugHint() });
    }
  };

  // Centralized auto-query persistence.
  // Saves URL query to sessionStorage if it contains auto intent, or restores it if missing but saved.
  // This ensures auto-join parameters survive OAuth redirects handled by the app shell.
  manageAutoHashPersistence = () => {
    manageAutoHashPersistenceFn({
      getActiveSlug: () => this.getActiveSessionSlug() || '',
      getLocationSearch: () => window.location.search || '',
      getLocationPathname: () => window.location.pathname || '',
      sessionStorageGet: (key) => sessionStorage.getItem(key),
      sessionStorageSet: (key, value) => sessionStorage.setItem(key, value),
      replaceState: (url) => window.history.replaceState(null, '', url),
      log: (msg, ...args) => mainSiteLog.log(msg, ...args),
      warn: (msg, error) => mainSiteLog.warn(msg, error),
    });
  };

  handleNetworkChange = async () => {
    mainSiteLog.log('handleNetworkChange() - re-initializing caches for new network');
    const cacheReinitRunToken = this.startCacheReinitRun();
    const isCacheReinitRunActive = () => this.isCacheReinitRunActive(cacheReinitRunToken);
    this.setReadinessStateIfChanged({
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
      isResponsesCacheReady: false,
      isAllCachesReady: false,
      cacheHasLoaded: false,
      surveyCacheInitializationError: false,
      questionCacheInitializationError: false,
    });

    const slug = this.getActiveSessionSlug();
    const pathname = this.getCurrentPathname();
    const sessionNet = this.getInitializableSessionNetwork(slug, pathname);
    if (!isCacheReinitRunActive()) return;

    const search = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const sbtAddressFromPath = this.getSbtAddressFromPath(pathname);
    const isSbtDetailRoute = !!sbtAddressFromPath;
    const isSbtRoute = this.isSbtListRoutePath(pathname) || isSbtDetailRoute;

    if (sessionNet && sessionNet.id) {
      if (isSbtDetailRoute) {
        // SBT detail: load only this SBT first, defer everything else
        try {
          const detailSlug = await this.resolvePinnedSbtDetailRouteSlug(sbtAddressFromPath, {
            search,
            fallbackSlug: slug,
          });
          this.removeSbtRealtimeListenersForGroup(slug);
          this.removeSbtRealtimeListenersForGroup(detailSlug);
          if (!isCacheReinitRunActive()) return;

          await this.refreshSbtData(sbtAddressFromPath, detailSlug, { forceCounts: true });
          if (!isCacheReinitRunActive()) return;
          this.setState(buildSbtDetailRouteStatePatch({ detailSlug, address: sbtAddressFromPath }));
          this.setReadinessStateIfChanged({ isSBTCacheReady: true });

          if (this.shouldAttachSbtDetailInstanceListener()) {
            this.startSbtDetailInstanceListenerForGroup(detailSlug, [sbtAddressFromPath]);
          }

          await this.initializeSurveyCache();
          if (!isCacheReinitRunActive()) return;
          this.setReadinessStateIfChanged({ isSurveyCacheReady: true });

          await this.initializeQuestionCache();
          if (!isCacheReinitRunActive()) return;

          this.startSurveyAndQuestionEventListener();

          await this.fetchQuestionResponsesChunked();
          if (!isCacheReinitRunActive()) return;

          // Resume normal background SBT loading after detail data is ready.
          (async () => {
            try {
              if (!isCacheReinitRunActive()) return;
              const pathname = this.getCurrentPathname();
              if (!this.shouldAutoRunFullSbtScan({ pathname })) return;
              await this.initializeSbtCacheForGroup(detailSlug, { mode: 'full' });
              if (!isCacheReinitRunActive()) return;
              this.setReadinessStateIfChanged({ isSBTCacheReady: true });
              this.startSbtEventListenerForGroup(detailSlug);
            } catch (e) {
              if (!isCacheReinitRunActive()) return;
              mainSiteLog.error('[NetworkChange /sbt/:address] Deferred full scan failed:', e);
            }
          })();
        } catch (e) {
          if (!isCacheReinitRunActive()) return;
          mainSiteLog.error('[NetworkChange /sbt/:address] Error during SBT-detail reinit:', e);
          this.setReadinessStateIfChanged({
            isSBTCacheReady: true,
            isSurveyCacheReady: true,
            isQuestionCacheReady: true,
          });
        }
      } else if (isSbtRoute) {
        // Prioritize SBT cache on /sbts when network changes
        try {
          await this.initializeSbtCache({ mode: 'partial' });
          if (!isCacheReinitRunActive()) return;
          this.setReadinessStateIfChanged({ isSBTCacheReady: true });
          this.startSbtEventListener();

          {
            const pathname = this.getCurrentPathname();
            if (this.shouldAutoRunFullSbtScan({ pathname })) {
              await this.initializeSbtCache({ mode: 'full' });
              if (!isCacheReinitRunActive()) return;
              this.setReadinessStateIfChanged({ isSBTCacheReady: true });
            }
          }

          await this.initializeSurveyCache();
          if (!isCacheReinitRunActive()) return;
          this.setReadinessStateIfChanged({ isSurveyCacheReady: true });

          await this.initializeQuestionCache();
          if (!isCacheReinitRunActive()) return;

          // restart listeners appropriate for the new network
          this.startSurveyAndQuestionEventListener();

          await this.fetchQuestionResponsesChunked();
          if (!isCacheReinitRunActive()) return;
        } catch (e) {
          if (!isCacheReinitRunActive()) return;
          mainSiteLog.error('[NetworkChange /sbts] Error during SBT-first reinit:', e);
          this.setReadinessStateIfChanged({
            isSBTCacheReady: true,
            isSurveyCacheReady: true,
            isQuestionCacheReady: true,
          });
        }
      } else {
        await this.initializeQuestionCache();
        if (!isCacheReinitRunActive()) return;

        await this.fetchQuestionResponsesChunked();
        if (!isCacheReinitRunActive()) return;

        await this.initializeSurveyCache();
        if (!isCacheReinitRunActive()) return;
        this.setReadinessStateIfChanged({ isSurveyCacheReady: true });

        // Initialize all caches sequentially for the new network to avoid rate-limiting
        await this.initializeSbtCache();
        if (!isCacheReinitRunActive()) return;
        this.setReadinessStateIfChanged({ isSBTCacheReady: true });
        this.startSbtEventListener(); // Restart listener for new network

        // Also restart survey/question listener on network change
        this.startSurveyAndQuestionEventListener();
      }
    } else {
      if (!isCacheReinitRunActive()) return;
      this.setReadinessStateIfChanged({ isQuestionCacheReady: true, isSurveyCacheReady: true });
    }

    if (!isCacheReinitRunActive()) return;
    this.checkAllCachesReady();
  };

  checkAllCachesReady: SessionCacheReadinessController['checkAllCachesReady'] = (...args) =>
    this._cacheReadinessController.checkAllCachesReady(...args);

  ensureSessionRouteSbtDiscovery: SessionSbtCacheController['ensureSessionRouteSbtDiscovery'] = (...args) =>
    this._sbtCacheController.ensureSessionRouteSbtDiscovery(...args);

  sendMessageToServer = () => {};

  ensureLightSbtDiscovery: SessionSbtCacheController['ensureLightSbtDiscovery'] = (...args) =>
    this._sbtCacheController.ensureLightSbtDiscovery(...args);

  ensureLightSbtUniverse: SessionSbtCacheController['ensureLightSbtUniverse'] = (...args) =>
    this._sbtCacheController.ensureLightSbtUniverse(...args);

  mergeSbtCountMaps: SessionSbtCacheController['mergeSbtCountMaps'] = (...args) =>
    this._sbtCacheController.mergeSbtCountMaps(...args);

  mergeSbtCountsPayload: SessionSbtCacheController['mergeSbtCountsPayload'] = (...args) =>
    this._sbtCacheController.mergeSbtCountsPayload(...args);

  normalizeSbtHistorySummary: SessionSbtCacheController['normalizeSbtHistorySummary'] = (...args) =>
    this._sbtCacheController.normalizeSbtHistorySummary(...args);

  normalizeSbtCountMap: SessionSbtCacheController['normalizeSbtCountMap'] = (...args) =>
    this._sbtCacheController.normalizeSbtCountMap(...args);

  sumSbtCountMap: SessionSbtCacheController['sumSbtCountMap'] = (...args) =>
    this._sbtCacheController.sumSbtCountMap(...args);

  seedSbtCountMapFromLegacyAddresses: SessionSbtCacheController['seedSbtCountMapFromLegacyAddresses'] = (...args) =>
    this._sbtCacheController.seedSbtCountMapFromLegacyAddresses(...args);

  hydrateLegacySbtCountState: SessionSbtCacheController['hydrateLegacySbtCountState'] = (...args) =>
    this._sbtCacheController.hydrateLegacySbtCountState(...args);

  buildSbtHistorySummaryFromCounts: SessionSbtCacheController['buildSbtHistorySummaryFromCounts'] = (...args) =>
    this._sbtCacheController.buildSbtHistorySummaryFromCounts(...args);

  getCurrentHolderAddressesFromCounts: SessionSbtCacheController['getCurrentHolderAddressesFromCounts'] = (...args) =>
    this._sbtCacheController.getCurrentHolderAddressesFromCounts(...args);

  initializeSbtCache: SessionSbtCacheController['initializeSbtCache'] = (...args) =>
    this._sbtCacheController.initializeSbtCache(...args);

  initializeSbtCacheWithGeneralBackfill: SessionSbtCacheController['initializeSbtCacheWithGeneralBackfill'] = (
    ...args
  ) => this._sbtCacheController.initializeSbtCacheWithGeneralBackfill(...args);

  initializeSbtCacheForGroup: SessionSbtCacheController['initializeSbtCacheForGroup'] = (...args) =>
    this._sbtCacheController.initializeSbtCacheForGroup(...args);

  refreshSbtData: RefreshSbtDataFn = (sbtAddress, slug, options) =>
    this._sbtCacheController.refreshSbtData(sbtAddress, slug, options);

  refreshSbtDataForGroup: RefreshSbtDataForGroupFn = (slug, sbtAddress, options) =>
    this._sbtCacheController.refreshSbtDataForGroup(slug, sbtAddress, options);

  startSbtEventListener: SessionSbtCacheController['startSbtEventListener'] = (...args) =>
    this._sbtCacheController.startSbtEventListener(...args);

  startSbtEventListenerForGroup: SessionSbtCacheController['startSbtEventListenerForGroup'] = (...args) =>
    this._sbtCacheController.startSbtEventListenerForGroup(...args);

  startSbtDetailInstanceListenerForGroup: SessionSbtCacheController['startSbtDetailInstanceListenerForGroup'] = (
    ...args
  ) => this._sbtCacheController.startSbtDetailInstanceListenerForGroup(...args);

  onNewSbtEventDetected: SessionSbtCacheController['onNewSbtEventDetected'] = (...args) =>
    this._sbtCacheController.onNewSbtEventDetected(...args);

  onNewSbtEventDetectedForGroup: SessionSbtCacheController['onNewSbtEventDetectedForGroup'] = (...args) =>
    this._sbtCacheController.onNewSbtEventDetectedForGroup(...args);

  onSbtCreatedDetected: SessionSbtCacheController['onSbtCreatedDetected'] = (...args) =>
    this._sbtCacheController.onSbtCreatedDetected(...args);

  onSbtCreatedDetectedForGroup: SessionSbtCacheController['onSbtCreatedDetectedForGroup'] = (...args) =>
    this._sbtCacheController.onSbtCreatedDetectedForGroup(...args);

  onSbtIssuedDetected: SessionSbtCacheController['onSbtIssuedDetected'] = (...args) =>
    this._sbtCacheController.onSbtIssuedDetected(...args);

  onSbtIssuedDetectedForGroup: SessionSbtCacheController['onSbtIssuedDetectedForGroup'] = (...args) =>
    this._sbtCacheController.onSbtIssuedDetectedForGroup(...args);

  onSbtActivityDetected: SessionSbtCacheController['onSbtActivityDetected'] = (...args) =>
    this._sbtCacheController.onSbtActivityDetected(...args);

  onSbtActivityDetectedForGroup: SessionSbtCacheController['onSbtActivityDetectedForGroup'] = (...args) =>
    this._sbtCacheController.onSbtActivityDetectedForGroup(...args);

  onSbtTransferDetected: SessionSbtCacheController['onSbtTransferDetected'] = (...args) =>
    this._sbtCacheController.onSbtTransferDetected(...args);

  onSbtTransferDetectedForGroup: SessionSbtCacheController['onSbtTransferDetectedForGroup'] = (...args) =>
    this._sbtCacheController.onSbtTransferDetectedForGroup(...args);

  initializeSurveyCache = async () => {
    return this.initializeSurveyCacheWithGeneralBackfill(this.getActiveSessionSourceSlug());
  };

  initializeSurveyCacheWithGeneralBackfill = async (slugIn: unknown) => {
    return this.runWithGeneralSessionBackfill({
      slugIn: normalizeSessionSlug(slugIn || ''),
      operation: 'initializeSurveyCache',
      runPrimary: (slug: string) => this.initializeSurveyCacheForGroup(slug, { background: false }),
      runGeneral: (slug: string) => this.initializeSurveyCacheForGroup(slug, { background: true }),
    });
  };

  initializeSurveyCacheForGroup: SessionSurveyCacheController['initializeSurveyCacheForGroup'] = (...args) =>
    this._surveyCacheController.initializeSurveyCacheForGroup(...args);

  initializeQuestionCache = async () => {
    return this.initializeQuestionCacheWithGeneralBackfill(this.getActiveSessionSourceSlug());
  };

  initializeQuestionCacheWithGeneralBackfill = async (slugIn: unknown) => {
    return this.runWithGeneralSessionBackfill({
      slugIn: normalizeSessionSlug(slugIn || ''),
      operation: 'initializeQuestionCache',
      runPrimary: (slug: string) => this.initializeQuestionCacheForGroup(slug, { background: false }),
      runGeneral: (slug: string) => this.initializeQuestionCacheForGroup(slug, { background: true }),
    });
  };

  initializeQuestionCacheForGroup: SessionQuestionCacheController['initializeQuestionCacheForGroup'] = async (
    slug,
    opts,
  ) => {
    const normalizedSlug = normalizeSessionSlug(slug || '');
    if (this.isBuiltInDemoSessionRoutePath() && (normalizedSlug === 'demo' || normalizedSlug === '')) {
      this.seedBuiltInDemoQuestionCache();
      return;
    }
    return this._questionCacheController.initializeQuestionCacheForGroup(slug, opts);
  };

  fetchQuestionResponsesChunked = async () => {
    return this.fetchQuestionResponsesChunkedWithGeneralBackfill(this.getActiveSessionSourceSlug());
  };

  fetchQuestionResponsesChunkedWithGeneralBackfill = async (slugIn: unknown) => {
    return this.runWithGeneralSessionBackfill({
      slugIn: normalizeSessionSlug(slugIn || ''),
      operation: 'fetchQuestionResponsesChunked',
      runPrimary: (slug: string) => this.fetchQuestionResponsesChunkedForGroup(slug, { background: false }),
      runGeneral: (slug: string) => this.fetchQuestionResponsesChunkedForGroup(slug, { background: true }),
    });
  };

  fetchQuestionResponsesChunkedForGroup: SessionResponseHydrationController['fetchQuestionResponsesChunkedForGroup'] = (
    ...args
  ) => this._responseHydrationController.fetchQuestionResponsesChunkedForGroup(...args);

  startSurveyAndQuestionEventListener: SessionSurveyCacheController['startSurveyAndQuestionEventListener'] = (
    ...args
  ) => this._surveyCacheController.startSurveyAndQuestionEventListener(...args);

  startSurveyAndQuestionEventListenerForGroup: SessionSurveyCacheController['startSurveyAndQuestionEventListenerForGroup'] =
    (...args) => this._surveyCacheController.startSurveyAndQuestionEventListenerForGroup(...args);

  onNewSurveyEventDetected = async (event: MainSiteSurveyEventLike) =>
    this.onNewSurveyEventDetectedForGroup(this.getActiveSessionSlug(), event);

  onNewSurveyEventDetectedForGroup = async (slug: string, event: MainSiteSurveyEventLike) => {
    // event: { type, ..., blockNumber }
    if (getMainSiteRuntimeWindow()?.ENABLE_RPC_DEBUG_LOGGING === true)
      mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: onNewSurveyEventDetectedForGroup invoked', { event, slug });
    mainSiteLog.log('onNewSurveyEventDetectedForGroup() – invoked with event:', event);

    const networkID = String(this.getSessionChainId(slug) || '');
    if (!networkID) {
      mainSiteLog.error('Network ID undefined in onNewSurveyEventDetectedForGroup');
      return;
    }
    const eventBlockWindow = await chainScanReadsPort.getRelevantBlockWindowForFilter(slug);
    const { fromBlock: baseFrom } = eventBlockWindow;
    const initialLastBlockDefault = Math.max(0, baseFrom - 1);

    let eventBlockNumber = event.blockNumber;
    if (!eventBlockNumber && event.transactionHash) {
      let readProvider = null;
      try {
        readProvider = chainScanReadsPort.getReadProviderForSession(slug);
      } catch (e) {
        mainSiteLog.warn('MainSite: fallback', e);
      }

      if (readProvider && typeof readProvider.getTransactionReceipt === 'function') {
        try {
          const receipt = await readProvider.getTransactionReceipt(event.transactionHash);
          eventBlockNumber = receipt?.blockNumber as number;
        } catch (e) {
          mainSiteLog.error('Failed to get block number from transaction hash for survey event', e);
          eventBlockNumber = eventBlockWindow.toBlock;
        }
      } else {
        eventBlockNumber = eventBlockWindow.toBlock;
      }
    } else if (!eventBlockNumber) {
      eventBlockNumber = eventBlockWindow.toBlock;
    }

    let surveysCache = (this.readDgRecord('surveysCache', slug) || {}) as Record<
      string,
      MainSiteSurveyNetworkCache | undefined
    >;
    this.mergeLegacyNumericNetworkKey(surveysCache, networkID);
    if (!surveysCache[networkID]) {
      surveysCache[networkID] = {
        surveysLatestBlock: initialLastBlockDefault,
        surveys: {},
        surveyResponses: {},
        surveyResponsesLatestBlock: {},
      };
    }
    let currentSurveyNetworkCache = surveysCache[networkID] as MainSiteSurveyNetworkCache;
    if (
      typeof currentSurveyNetworkCache.surveyResponsesLatestBlock !== 'object' ||
      currentSurveyNetworkCache.surveyResponsesLatestBlock === null
    ) {
      currentSurveyNetworkCache.surveyResponsesLatestBlock = {};
    }
    if (!currentSurveyNetworkCache.surveys) currentSurveyNetworkCache.surveys = {};

    let questionsCache = (this.readDgRecord('questionsCache', slug) || {}) as Record<
      string,
      MainSiteQuestionNetworkCache | undefined
    >;
    this.mergeLegacyNumericNetworkKey(questionsCache, networkID);
    if (!questionsCache[networkID]) {
      questionsCache[networkID] = {
        questionsLatestBlock: initialLastBlockDefault,
        questionsDiscoveryCheckpointBlock: initialLastBlockDefault,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {}, // ensure meta map exists
        questionResponsesLatestBlock: initialLastBlockDefault,
        pendingQuestionMetadata: {},
        arweaveTxCache: {},
        arweaveTxFailureCache: {},
        questionHydrationMeta: {},
      };
    }
    let currentQuestionNetworkCache = questionsCache[networkID] as MainSiteQuestionNetworkCache;
    if (!currentQuestionNetworkCache.questions) currentQuestionNetworkCache.questions = {};
    if (!currentQuestionNetworkCache.questionResponses) currentQuestionNetworkCache.questionResponses = {};
    if (
      typeof currentQuestionNetworkCache.questionResponsesMeta !== 'object' ||
      currentQuestionNetworkCache.questionResponsesMeta === null
    ) {
      currentQuestionNetworkCache.questionResponsesMeta = {};
    }
    ensureQuestionArweaveCacheBranches(currentQuestionNetworkCache);
    const mergeFreshQuestionArweaveBranches = () => {
      try {
        const freshCache = (this.readDgRecord('questionsCache', slug) || {}) as Record<
          string,
          MainSiteQuestionNetworkCache | undefined
        >;
        this.mergeLegacyNumericNetworkKey(freshCache, networkID);
        const freshNet = freshCache[networkID];
        if (!freshNet || typeof freshNet !== 'object') return;
        mergeQuestionArweaveCacheBranches(currentQuestionNetworkCache, freshNet);
      } catch (e) {
        mainSiteLog.warn('MainSite: fallback', e);
      }
    };

    if (event.type === 'SurveyAdded') {
      if (eventBlockNumber > (currentSurveyNetworkCache.surveysLatestBlock || 0)) {
        this.setReadinessStateIfChanged({ isSurveyCacheReady: false, isQuestionCacheReady: false });

        const surveyID = event.surveyId.toLowerCase();
        mainSiteLog.log(`Processing SurveyAdded event for surveyID: ${surveyID}`);

        try {
          const surveyData = (await surveyReadsPort.getSurveyDataById(
            'none',
            surveyID,
            slug,
          )) as MainSiteMutableMetadata | null;

          if (surveyData) {
            const eventQuestionIds = new Set<string>();
            const rebucketedEventQuestionIds = new Set<string>();
            surveyData.surveyID = surveyID; // Ensure surveyID is present and lowercase
            if (!surveyData.questionIDs) surveyData.questionIDs = [];
            if (!surveyData.creator) surveyData.creator = '';
            // Store creationBlock from event
            surveyData.creationBlock = eventBlockNumber;
            const preparedSurvey = this.buildMetadataSessionCacheEnvelope(surveyData, slug, {
              scoped: true,
              includeSlugField: true,
            });
            const preparedSurveyData = {
              ...surveyData,
              ...preparedSurvey.metadata,
            };
            const targetSurveySlug = preparedSurvey.targetSlug;
            if (targetSurveySlug === slug) {
              currentSurveyNetworkCache.surveys[surveyID] = preparedSurveyData;
            } else {
              try {
                delete currentSurveyNetworkCache.surveys[surveyID];
              } catch (e) {
                mainSiteLog.warn('MainSite: fallback', e);
              }
              this.writeSurveyMetadataToCache(
                targetSurveySlug,
                surveyID,
                preparedSurveyData,
                eventBlockNumber,
                networkID,
                {
                  enforceScopedIsolation: true,
                },
              );
            }
            mainSiteLog.log(`Survey data for ${surveyID} fetched and added to local cache object.`);

            // Parallel-fetch any missing questions
            let allQuestionsFetchedSuccessfully = true;
            if (surveyData.questionIDs && surveyData.questionIDs.length > 0) {
              const missingIds = surveyData.questionIDs
                .map((q: string) => q.toLowerCase())
                .filter((qid: string) => !currentQuestionNetworkCache.questions[qid]);

              if (missingIds.length > 0) {
                const results = await Promise.all(
                  missingIds.map(async (qid: string): Promise<MainSiteQuestionFetchResult> => {
                    try {
                      const questionData = (await surveyReadsPort.getQuestionData('none', qid, slug, {
                        decryptContext: this.buildQuestionDecryptContext(slug),
                        skipDecrypt: true,
                      })) as MainSiteMutableMetadata | null;
                      return { qid, questionData };
                    } catch (err) {
                      mainSiteLog.error(`Error fetching question data for ${qid}:`, err);
                      return { qid, questionData: null };
                    }
                  }),
                );

                for (const { qid, questionData } of results) {
                  if (questionData) {
                    questionData.id = qid;
                    const preparedQuestion = this.buildMetadataSessionCacheEnvelope(
                      questionData,
                      targetSurveySlug || slug,
                      {
                        scoped: true,
                      },
                    );
                    const preparedQuestionData = {
                      ...questionData,
                      ...preparedQuestion.metadata,
                    };
                    const targetQuestionSlug = preparedQuestion.targetSlug;
                    if (targetQuestionSlug === slug) {
                      currentQuestionNetworkCache.questions[qid] = preparedQuestionData;
                      eventQuestionIds.add(qid);
                    } else {
                      try {
                        delete currentQuestionNetworkCache.questions[qid];
                      } catch (e) {
                        mainSiteLog.warn('MainSite: fallback', e);
                      }
                      this.writeQuestionMetadataToCache(targetQuestionSlug, qid, preparedQuestionData, networkID, {
                        enforceScopedIsolation: true,
                      });
                    }
                    mainSiteLog.log(`Question ${qid} data fetched and added to local cache object.`);
                  } else {
                    allQuestionsFetchedSuccessfully = false;
                  }
                }
              }
            } else {
              mainSiteLog.log(`Survey ${surveyID} has no associated question IDs.`);
            }

            currentSurveyNetworkCache.surveysLatestBlock = eventBlockNumber;
            await updateMainSiteSurveyCacheAtomic(slug, (current) => {
              const next = (isMainSiteRecord(current) ? current : {}) as MainSiteSurveyMetadataCache;
              this.mergeLegacyNumericNetworkKey(next, networkID);
              const targetNet = next[networkID] || createMainSiteSurveyNetworkCache(initialLastBlockDefault);
              if (!isMainSiteRecord(targetNet.surveys)) targetNet.surveys = {};
              if (!isMainSiteRecord(targetNet.pendingSurveyMetadata)) targetNet.pendingSurveyMetadata = {};
              if (targetSurveySlug === slug) {
                const existing = targetNet.surveys[surveyID];
                const existingBlock = Number(isMainSiteRecord(existing) ? existing.creationBlock : 0);
                if (!existing || existingBlock <= Number(eventBlockNumber || 0)) {
                  targetNet.surveys[surveyID] = {
                    ...(isMainSiteRecord(existing) ? existing : {}),
                    ...preparedSurveyData,
                  };
                }
                delete targetNet.pendingSurveyMetadata[surveyID];
              } else {
                delete targetNet.surveys[surveyID];
              }
              targetNet.surveysLatestBlock = Math.max(
                Number(targetNet.surveysLatestBlock) || initialLastBlockDefault,
                Number(eventBlockNumber) || 0,
              );
              next[networkID] = targetNet;
              return next;
            });

            if (surveyData.questionIDs && surveyData.questionIDs.length > 0) {
              currentQuestionNetworkCache.questionsLatestBlock = Math.max(
                currentQuestionNetworkCache.questionsLatestBlock || 0,
                eventBlockNumber,
              );
            }
            await updateMainSiteQuestionCacheAtomic(slug, (current) => {
              const next = (isMainSiteRecord(current) ? current : {}) as MainSiteQuestionMetadataCache;
              this.mergeLegacyNumericNetworkKey(next, networkID);
              const targetNet = next[networkID] || createMainSiteQuestionNetworkCache(initialLastBlockDefault);
              ensureQuestionArweaveCacheBranches(targetNet);
              eventQuestionIds.forEach((qid) => {
                const incoming = currentQuestionNetworkCache.questions[qid];
                if (incoming) {
                  targetNet.questions[qid] = {
                    ...(isMainSiteRecord(targetNet.questions[qid]) ? targetNet.questions[qid] : {}),
                    ...(isMainSiteRecord(incoming) ? incoming : {}),
                  };
                  if (targetNet.pendingQuestionMetadata) delete targetNet.pendingQuestionMetadata[qid];
                }
              });
              rebucketedEventQuestionIds.forEach((qid) => delete targetNet.questions[qid]);
              if (surveyData.questionIDs && surveyData.questionIDs.length > 0) {
                targetNet.questionsLatestBlock = Math.max(
                  Number(targetNet.questionsLatestBlock) || initialLastBlockDefault,
                  Number(eventBlockNumber) || 0,
                );
              }
              next[networkID] = targetNet;
              return next;
            });

            mainSiteLog.log(
              `SurveyAdded event fully processed for ${surveyID}. Caches updated. surveysLatestBlock: ${eventBlockNumber}, questionsLatestBlock: ${currentQuestionNetworkCache.questionsLatestBlock}.`,
            );

            // Increment nonce so downstream components (PileModeView, OnePageSession) detect new questions
            this.setReadinessStateIfChanged({
              isSurveyCacheReady: true,
              isQuestionCacheReady: true,
            });
            this.queueLocalRevisionUpdate({
              needsQuestionResponsesNonce: true,
              checkAllCachesReady: true,
            });

            if (!allQuestionsFetchedSuccessfully && surveyData.questionIDs && surveyData.questionIDs.length > 0) {
              mainSiteLog.warn(
                `SurveyAdded: could not fetch all questions for survey ${surveyID} during this event. The questionsCache reflects what was obtainable.`,
              );
            }
          } else {
            mainSiteLog.warn(
              `Failed to fetch survey data for ${surveyID} during SurveyAdded event. Survey data is null.`,
            );
            this.setReadinessStateIfChanged(
              { isSurveyCacheReady: true, isQuestionCacheReady: true },
              this.checkAllCachesReady,
            );
          }
        } catch (error) {
          mainSiteLog.error(`Error processing SurveyAdded event for ${surveyID}:`, error);
          this.setReadinessStateIfChanged(
            { isSurveyCacheReady: true, isQuestionCacheReady: true },
            this.checkAllCachesReady,
          );
        }
      } else {
        mainSiteLog.log(
          `SurveyAdded event for surveyID ${event.surveyId} is old or already processed. Skipping loading state changes.`,
        );
      }
    } else if (event.type === 'QuestionsAdded') {
      if (eventBlockNumber > (currentQuestionNetworkCache.questionsLatestBlock || 0)) {
        this.setReadinessStateIfChanged({ isQuestionCacheReady: false });
        mainSiteLog.log(`Processing QuestionsAdded event with ${event.questionIds.length} questions.`);

        try {
          const idsLower = event.questionIds.map((hex: string) => hex.toLowerCase());
          const missing = idsLower.filter((qid: string) => !currentQuestionNetworkCache.questions[qid]);
          const eventQuestionIds = new Set<string>();
          const rebucketedEventQuestionIds = new Set<string>();

          let allNewQuestionsFetchedSuccessfully = true;
          if (missing.length > 0) {
            const results = await Promise.all(
              missing.map(async (qid: string): Promise<MainSiteQuestionFetchResult> => {
                try {
                  const questionData = (await surveyReadsPort.getQuestionData('none', qid, slug, {
                    decryptContext: this.buildQuestionDecryptContext(slug),
                    skipDecrypt: true,
                  })) as MainSiteMutableMetadata | null;
                  return { qid, questionData };
                } catch (e) {
                  mainSiteLog.warn(`Error fetching new question ${qid} in QuestionsAdded:`, e);
                  return { qid, questionData: null };
                }
              }),
            );
            for (const { qid, questionData } of results) {
              if (questionData) {
                questionData.id = qid;
                const preparedQuestion = this.buildMetadataSessionCacheEnvelope(questionData, slug, {
                  scoped: true,
                });
                const preparedQuestionData = {
                  ...questionData,
                  ...preparedQuestion.metadata,
                };
                const targetQuestionSlug = preparedQuestion.targetSlug;
                if (targetQuestionSlug === slug) {
                  currentQuestionNetworkCache.questions[qid] = preparedQuestionData;
                  eventQuestionIds.add(qid);
                } else {
                  try {
                    delete currentQuestionNetworkCache.questions[qid];
                  } catch (e) {
                    mainSiteLog.warn('MainSite: fallback', e);
                  }
                  this.writeQuestionMetadataToCache(targetQuestionSlug, qid, preparedQuestionData, networkID, {
                    enforceScopedIsolation: true,
                  });
                }
                mainSiteLog.log(`New question ${qid} data fetched and added to local cache object.`);
              } else {
                allNewQuestionsFetchedSuccessfully = false;
              }
            }
          }

          currentQuestionNetworkCache.questionsLatestBlock = eventBlockNumber;
          await updateMainSiteQuestionCacheAtomic(slug, (current) => {
            const next = (isMainSiteRecord(current) ? current : {}) as MainSiteQuestionMetadataCache;
            this.mergeLegacyNumericNetworkKey(next, networkID);
            const targetNet = next[networkID] || createMainSiteQuestionNetworkCache(initialLastBlockDefault);
            ensureQuestionArweaveCacheBranches(targetNet);
            eventQuestionIds.forEach((qid) => {
              const incoming = currentQuestionNetworkCache.questions[qid];
              if (!incoming) return;
              targetNet.questions[qid] = {
                ...(isMainSiteRecord(targetNet.questions[qid]) ? targetNet.questions[qid] : {}),
                ...(isMainSiteRecord(incoming) ? incoming : {}),
              };
              if (targetNet.pendingQuestionMetadata) delete targetNet.pendingQuestionMetadata[qid];
            });
            rebucketedEventQuestionIds.forEach((qid) => delete targetNet.questions[qid]);
            targetNet.questionsLatestBlock = Math.max(
              Number(targetNet.questionsLatestBlock) || initialLastBlockDefault,
              Number(eventBlockNumber) || 0,
            );
            next[networkID] = targetNet;
            return next;
          });
          mainSiteLog.log(`QuestionsAdded event processed. questionsLatestBlock updated to ${eventBlockNumber}.`);

          // Increment nonce so downstream components (PileModeView, OnePageSession) detect the new questions
          this.setReadinessStateIfChanged({ isQuestionCacheReady: true });
          this.queueLocalRevisionUpdate({
            needsQuestionResponsesNonce: true,
            checkAllCachesReady: true,
          });
          if (!allNewQuestionsFetchedSuccessfully) {
            mainSiteLog.warn(
              'QuestionsAdded: Not all *newly specified* questions in this event were fetched successfully and added to cache.',
            );
          }
        } catch (error) {
          mainSiteLog.error(`Error processing QuestionsAdded event:`, error);
          if (error instanceof MainSiteCachePersistenceError) throw error;
          this.setReadinessStateIfChanged({ isQuestionCacheReady: true }, this.checkAllCachesReady);
        }
      } else {
        mainSiteLog.log(`QuestionsAdded event is old or already processed. Skipping loading state changes.`);
      }
    } else if (event.type === 'ResponsesSubmitted') {
      const surveyIdFromEvent = event.surveyId ? event.surveyId.toLowerCase() : null;
      const questionIdsFromEvent = event.questionIds.map((q: string) => q.toLowerCase());
      const responderAddressLower = event.responder.toLowerCase();
      const eventTransactionIndex = Number(event?.transactionIndex ?? event?.txIndex ?? 0);
      const eventLogIndex = Number(event?.logIndex || 0);
      const eventTimestamp = Number(event?.timestamp || 0);
      let surveyCacheUpdated = false;
      let questionCacheUpdated = false;

      // Survey-level responses (preserve watermark logic as-is)
      if (surveyIdFromEvent && surveyIdFromEvent !== ethers.constants.HashZero.toLowerCase()) {
        if (eventBlockNumber > (currentSurveyNetworkCache.surveyResponsesLatestBlock[surveyIdFromEvent] || 0)) {
          mainSiteLog.log(
            `Fetching survey response for survey ${surveyIdFromEvent}, responder ${responderAddressLower} due to ResponsesSubmitted event.`,
          );
          const surveyResponseData = await surveyReadsPort.getSurveyResponse(
            'none',
            responderAddressLower,
            surveyIdFromEvent,
            slug,
          );
          if (surveyResponseData) {
            if (!currentSurveyNetworkCache.surveyResponses[surveyIdFromEvent]) {
              currentSurveyNetworkCache.surveyResponses[surveyIdFromEvent] = {};
            }
            currentSurveyNetworkCache.surveyResponses[surveyIdFromEvent][responderAddressLower] = surveyResponseData;
            currentSurveyNetworkCache.surveyResponsesLatestBlock[surveyIdFromEvent] = eventBlockNumber;
            surveyCacheUpdated = true;
            mainSiteLog.log(`Survey response for ${surveyIdFromEvent} by ${responderAddressLower} updated in cache.`);
          } else {
            mainSiteLog.log(
              `No survey response data found for survey ${surveyIdFromEvent}, responder ${responderAddressLower}.`,
            );
          }
        } else {
          mainSiteLog.log(
            `ResponsesSubmitted event for survey ${surveyIdFromEvent} (block ${eventBlockNumber}) is not newer than last processed block (${currentSurveyNetworkCache.surveyResponsesLatestBlock[surveyIdFromEvent] || 0}). Skipping survey response update.`,
          );
        }
      }

      // Question-level responses with recency guard
      // Ensure per-question maps exist
      questionIdsFromEvent.forEach((qId: string) => {
        if (!currentQuestionNetworkCache.questionResponses[qId]) {
          currentQuestionNetworkCache.questionResponses[qId] = {};
        }
        if (!currentQuestionNetworkCache.questionResponsesMeta[qId]) {
          currentQuestionNetworkCache.questionResponsesMeta[qId] = {};
        }
      });

      const bn = Number(eventBlockNumber || 0);
      const incomingResponseRecency = {
        bn,
        txi: eventTransactionIndex,
        li: eventLogIndex,
        ts: eventTimestamp,
      };
      const qIdsToFetch: string[] = [];
      questionIdsFromEvent.forEach((qId: string) => {
        const responseMetaByResponder = currentQuestionNetworkCache.questionResponsesMeta[qId] || {};
        const prev = responseMetaByResponder[responderAddressLower] || {};
        const prevBn = Number(prev.bn ?? prev.blockNumber ?? 0);
        const prevTxi = Number(prev.txi ?? prev.transactionIndex ?? prev.txIndex ?? 0);
        const prevLi = Number(prev.li ?? prev.logIndex ?? 0);
        const prevTs = Number(prev.ts ?? prev.timestamp ?? 0);
        const isNewer =
          bn > prevBn ||
          (bn === prevBn &&
            (eventTransactionIndex > prevTxi ||
              (eventTransactionIndex === prevTxi &&
                (eventLogIndex > prevLi || (eventLogIndex === prevLi && eventTimestamp >= prevTs)))));
        if (isNewer) {
          qIdsToFetch.push(qId);
        } else {
          mainSiteLog.log(
            `[ResponsesSubmitted][recency-guard] STALE ignored for qId=${qId}, responder=${responderAddressLower} (prev bn/tx/li/ts=${prevBn}/${prevTxi}/${prevLi}/${prevTs}, incoming bn/tx/li/ts=${bn}/${eventTransactionIndex}/${eventLogIndex}/${eventTimestamp})`,
          );
        }
      });

      if (qIdsToFetch.length > 0) {
        let shouldForceResponseBackfill = false;
        const results = await Promise.all(
          qIdsToFetch.map(async (qId: string): Promise<MainSiteResponseFetchResult> => {
            const data = (await surveyReadsPort.getResponse('none', responderAddressLower, qId, slug, {
              forceArweaveFetch: true,
            })) as Record<string, unknown> | null;
            if (!data) shouldForceResponseBackfill = true;
            return { qId, data };
          }),
        );

        let acceptedAny = false;
        results.forEach(({ qId, data }: MainSiteResponseFetchResult) => {
          if (!data) return;
          const responseByResponder = currentQuestionNetworkCache.questionResponses[qId] || {};
          currentQuestionNetworkCache.questionResponses[qId] = responseByResponder;
          responseByResponder[responderAddressLower] = data;
          const responseMetaByResponder = currentQuestionNetworkCache.questionResponsesMeta[qId] || {};
          currentQuestionNetworkCache.questionResponsesMeta[qId] = responseMetaByResponder;
          responseMetaByResponder[responderAddressLower] = incomingResponseRecency;
          acceptedAny = true;
          mainSiteLog.log(
            `[ResponsesSubmitted][recency-guard] ACCEPTED for qId=${qId}, responder=${responderAddressLower} (bn/tx/li/ts=${bn}/${eventTransactionIndex}/${eventLogIndex}/${eventTimestamp}).`,
          );
        });

        if (acceptedAny) {
          // Advance watermark only if at least one response was accepted as newer
          if (bn > (currentQuestionNetworkCache.questionResponsesLatestBlock || 0)) {
            currentQuestionNetworkCache.questionResponsesLatestBlock = bn;
          }
          questionCacheUpdated = true;
        }
        if (shouldForceResponseBackfill) {
          this.fetchQuestionResponsesChunkedForGroup(slug, {
            background: true,
            forceArweaveFetch: true,
            notifyOnCompletion: true,
          }).catch((backfillErr: unknown) => {
            mainSiteLog.warn('[ResponsesSubmitted] Forced response backfill failed:', backfillErr);
          });
        }
      }

      let surveyResponsePersisted = false;
      if (surveyCacheUpdated && surveyIdFromEvent) {
        await updateMainSiteSurveyCacheAtomic(slug, (current) => {
          const next = (isMainSiteRecord(current) ? current : {}) as MainSiteSurveyMetadataCache;
          this.mergeLegacyNumericNetworkKey(next, networkID);
          const targetNet = next[networkID] || createMainSiteSurveyNetworkCache(initialLastBlockDefault);
          if (!isMainSiteRecord(targetNet.surveyResponses)) targetNet.surveyResponses = {};
          if (!isMainSiteRecord(targetNet.surveyResponsesLatestBlock)) targetNet.surveyResponsesLatestBlock = {};
          const currentWatermark = Number(targetNet.surveyResponsesLatestBlock[surveyIdFromEvent]) || 0;
          if (Number(eventBlockNumber) > currentWatermark) {
            if (!isMainSiteRecord(targetNet.surveyResponses[surveyIdFromEvent])) {
              targetNet.surveyResponses[surveyIdFromEvent] = {};
            }
            targetNet.surveyResponses[surveyIdFromEvent]![responderAddressLower] =
              currentSurveyNetworkCache.surveyResponses[surveyIdFromEvent]?.[responderAddressLower];
            targetNet.surveyResponsesLatestBlock[surveyIdFromEvent] = Math.max(
              currentWatermark,
              Number(eventBlockNumber) || 0,
            );
            surveyResponsePersisted = true;
          }
          next[networkID] = targetNet;
          return next;
        });
      }
      if (surveyCacheUpdated || questionCacheUpdated) {
        mainSiteLog.log('ResponsesSubmitted event processed; caches updated (survey and/or questions).');
        this.queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
      }
    }
  };

  // React routing

  // React routing
  _routeRenderers = createMainSiteRouteRenderers(this);
  _renderDebateRoute = this._routeRenderers._renderDebateRoute;
  _renderBookmarksRoute = this._routeRenderers._renderBookmarksRoute;
  _renderAboutRoute = this._routeRenderers._renderAboutRoute;
  _renderDemosRoute = this._routeRenderers._renderDemosRoute;
  _renderMatrixRoute = this._routeRenderers._renderMatrixRoute;
  _renderAgentRoute = this._routeRenderers._renderAgentRoute;
  _renderSimUserRoute = this._routeRenderers._renderSimUserRoute;
  _renderAtlasRoute = this._routeRenderers._renderAtlasRoute;
  _renderTagRoute = this._routeRenderers._renderTagRoute;
  _renderCompareRoute = this._routeRenderers._renderCompareRoute;
  _renderContractsRoute = this._routeRenderers._renderContractsRoute;
  _renderAdminRoute = this._routeRenderers._renderAdminRoute;
  _renderSponsorRoute = this._routeRenderers._renderSponsorRoute;
  _renderSbtCreateRoute = this._routeRenderers._renderSbtCreateRoute;
  _renderSbtsListRoute = this._routeRenderers._renderSbtsListRoute;
  _renderSbtDetailRoute = this._routeRenderers._renderSbtDetailRoute;
  _renderUserProfileRoute = this._routeRenderers._renderUserProfileRoute;
  _renderHomeRoute = this._routeRenderers._renderHomeRoute;
  _renderSurveyIdRoute = this._routeRenderers._renderSurveyIdRoute;
  _renderSurveysOrQuestionsListRoute = this._routeRenderers._renderSurveysOrQuestionsListRoute;
  _renderQuestionDetailRoute = this._routeRenderers._renderQuestionDetailRoute;
  _renderSessionRoute = this._routeRenderers._renderSessionRoute;
  getMainView = this._routeRenderers.getMainView;

  // Used by Navbar faucet button
  getUserTestETH = async () => {
    try {
      await faucetFundingPort.sendTestnetFunds(this.props.account as string);
    } catch (e) {
      mainSiteLog.error('Faucet error:', e);
    }
  };

  refreshSurveyResponsesByID: RefreshSurveyResponsesByIDFn = async (surveyID) =>
    this.refreshSurveyResponsesByIDForGroup(this.getActiveSessionSlug(), surveyID);

  refreshSurveyResponsesByIDForGroup: RefreshSurveyResponsesByIDForGroupFn = (slug, surveyID) =>
    this._surveyCacheController.refreshSurveyResponsesByIDForGroup(slug, surveyID);

  refreshQuestionMetadata = async (opts = {}): Promise<void> =>
    this.refreshQuestionMetadataForGroup(this.getActiveSessionSourceSlug(), opts);

  hasMaskedQuestionPayloadInCache: HasMaskedQuestionPayloadInCacheFn = (slug) =>
    this._questionCacheController.hasMaskedQuestionPayloadInCache(slug);

  buildQuestionDecryptContext: BuildQuestionDecryptContextFn = (slug) =>
    this._questionCacheController.buildQuestionDecryptContext(slug);

  refreshEncryptedQuestionPayloadsForGroup: RefreshEncryptedQuestionPayloadsForGroupFn = (slug, opts) =>
    this._questionCacheController.refreshEncryptedQuestionPayloadsForGroup(slug, opts);

  refreshQuestionMetadataForGroup: RefreshQuestionMetadataForGroupFn = async (slug, opts) => {
    const normalizedSlug = normalizeSessionSlug(slug || '');
    if (this.isBuiltInDemoSessionRoutePath() && (normalizedSlug === 'demo' || normalizedSlug === '')) {
      this.seedBuiltInDemoQuestionCache();
      return;
    }
    return this._questionCacheController.refreshQuestionMetadataForGroup(slug, opts);
  };

  refreshQuestionResponses: RefreshQuestionResponsesFn = (questionIds, opts) =>
    this._responseHydrationController.refreshQuestionResponses(questionIds, opts);

  render() {
    const mainViewDisplay = this.getMainView(null);
    const activeRouteSessionConfig = this.getDisplaySessionCfg(this.getSessionSlugFromProps());

    return (
      <>
        <OnboardingOverlay />

        <Navbar
          toggleLoginModal={this.props.toggleLoginModal}
          updateLoginInfo={this.props.updateLoginInfo}
          toggleDemoMode={this.props.toggleDemoMode}
          demoMode={this.props.demoMode}
          account={this.props.account}
          provider={this.props.provider} // <--- provider is a string name; pass through unchanged
          focusedTab={this.props.focusedTab}
          loginComplete={this.props.loginComplete}
          loginInProgress={this.props.loginInProgress}
          sendTestETH={this.getUserTestETH}
          sessionConfig={activeRouteSessionConfig}
        />

        <DevE2eNav />

        {mainViewDisplay}

        <Footer toggleLoginModal={this.props.toggleLoginModal} />
      </>
    );
  }
}
const mapStateToProps = (state: RootState) => ({
  profile: state.profile,
  account: state.profile.account,
  provider: state.profile.provider,
  network: state.profile.network,
  sessionState: state.sessionState,
  focusedTab: state.sessionState.focusedTab,
  loginComplete: state.sessionState.loginComplete,
  loginInProgress: state.sessionState.loginInProgress,
  demoMode: state.sessionState.demoMode,
  demoSurfaceMode: state.sessionState.demoSurfaceMode,
  activeSessionSlug: state.sessionState.activeSessionSlug,
});

const AppShellWithWagmiHooks = WagmiHooksHOC(AppShell);

export const appShellDispatchActions = {
  fetchAccount,
  changeAccount,
  fetchSessionState,
  changeFocusedTab,
  toggleLoginModal,
  updateLoginInfo,
  toggleDemoMode,
  changeActiveSessionSlug,
};

export default connect(mapStateToProps, appShellDispatchActions)(AppShellWithWagmiHooks) as React.ComponentType<
  Record<string, unknown>
>;
