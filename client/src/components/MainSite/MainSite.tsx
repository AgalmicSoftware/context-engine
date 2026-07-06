/** @file MainSite.tsx */

import React, { Component, Suspense } from "react";
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
import "assets/css/contextEngine.scss";
import stylesRaw from "./MainSite.module.scss";

// Smart contract events / interactions
import {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../domains/sessions/sessionConfig.js';
import { chainScanReadsPort } from '../../domains/chain/contractScriptsChainScanReadsPort.js';
import { profileScanPort } from '../../domains/profiles/contractScriptsProfileScanPort.js';
import { sbtEventStreamsPort } from '../../domains/sbts/contractScriptsSbtEventStreamsPort.js';
import { sbtMetadataReadsPort } from '../../domains/sbts/contractScriptsSbtMetadataReadsPort.js';
import { surveyReadsPort } from '../../domains/surveys/contractScriptsSurveyReadsPort.js';
import { faucetFundingPort } from '../../domains/worker/contractScriptsFaucetFundingPort.js';
import { deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import {
  createLitHooks,
  attachLitDevTools,
  getGlobalLitHooks,
  setGlobalLitHooks,
} from '../../utilities/crypto/litProtocol.js';
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
import {
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import { getPrimaryDemoSessionSlug, isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
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
import { createSessionScanPolicy, type SessionScanPolicy } from '../../utilities/session/mainSiteSessionScanPolicy.js';
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
import { resolveSessionRegistryBootstrapChainIds } from '../../utilities/session/registryBootstrapChainIds.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  initCacheManager,
  subscribeCacheUpdates,
} from '../../utilities/cache/cacheScripts.js';
import {
  createMainSiteDgStorage,
  type MainSiteDgStorage,
} from '../../utilities/cache/mainSiteDgStorage.js';
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
import {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
} from '../../domains/surveys/questionArweaveCacheBranches.js';
import {
  shouldAutoStartCeRuntimeStats,
  startCeRuntimeStats,
  stopCeRuntimeStats,
} from '../../utilities/ui/uiRuntimeStats.js';

// withWagmiBridge is a function component (allowed to use hooks from wagmi and RainbowKit).
// It passes props to this class-component so that this component can use React hooks.
import { WagmiHooksHOC as WagmiHooksHOCRaw } from '../HooksHOC/withWagmiBridge'

// Components
import NavbarRaw from "../Navbar/Navbar";
import MainAreaTabsRaw from "../MainContent/MainAreaTabs";
import RightSideRaw from '../RightSidebar/RightSide';
import OnboardingOverlayRaw from '../Onboarding/OnboardingOverlay';
import { FIRST_VISIT_STORAGE_KEY } from '../Onboarding/onboardingConfig.js';
import FooterRaw from "../Footer/Footer";
import LazyFallbackRaw from "../Shared/LazyFallback";
import DevE2eNavRaw from "../E2E/DevE2eNav";
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
import type { SessionConfigLike } from '../shellTypes';
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
import {
  resolveMainSiteLitSessionConfig,
  resolveMainSiteLitSessionConfigSource,
} from './litSessionConfig.js';
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
  buildMainSiteLitHooksStatePatch,
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
  readHashQueryParam,
  SessionLoadingSkeleton as SessionLoadingSkeletonRaw,
} from './routeStatusViews';
import {
  QUESTION_RESULTS_RE,
  SURVEY_RESULTS_RE,
  VALID_SURVEY_ID_RE,
} from './routeConfig.js';
import { resolveMainSiteRouteMatch } from './routeTable.js';
import { renderMainSiteRouteView } from './mainSiteRouteViewMap.js';
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
const asMainSiteRouteComponent = (component: unknown): MainSiteRouteComponent => (
  component as MainSiteRouteComponent
);
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

const isMainSiteProfileMetaResult = <T,>(value: unknown): value is MainSiteProfileMetaResult<T> => (
  !!value &&
  typeof value === 'object' &&
  (
    Object.prototype.hasOwnProperty.call(value, 'hadError') ||
    Object.prototype.hasOwnProperty.call(value, 'data')
  )
);
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
  requestedSponsoredBundleKey: string;
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
  opts?: RefreshQuestionResponsesOptions
) => Promise<void>;
type RefreshSbtDataFn = SessionSbtCacheController['refreshSbtData'];
type RefreshSbtDataForGroupFn = SessionSbtCacheController['refreshSbtDataForGroup'];
type RefreshSurveyResponsesByIDForGroupFn = SessionSurveyCacheController['refreshSurveyResponsesByIDForGroup'];
type HasMaskedQuestionPayloadInCacheFn = SessionQuestionCacheController['hasMaskedQuestionPayloadInCache'];
type BuildQuestionDecryptContextFn = SessionQuestionCacheController['buildQuestionDecryptContext'];
type RefreshEncryptedQuestionPayloadsForGroupFn = SessionQuestionCacheController['refreshEncryptedQuestionPayloadsForGroup'];
type RefreshQuestionMetadataForGroupFn = SessionQuestionCacheController['refreshQuestionMetadataForGroup'];
type MainSiteStateRecordUpdater = (prev: Record<string, unknown>) => Record<string, unknown> | null;
type MainSiteCacheControllerStateArg =
  | Record<string, unknown>
  | ((prev: Record<string, unknown>) => Record<string, unknown> | null)
  | null;
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

const isMainSiteRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object'
);

const hasMainSiteRegistryIdentity = (
  sessionConfig: MainSiteSessionConfigLike | null | undefined
): boolean => {
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

const isMainSitePresent = <T,>(value: T | null | undefined): value is T => (
  value !== null && value !== undefined
);

const readMainSiteErrorMessage = (error: unknown): unknown => (
  error instanceof Error ? error.message : error
);

const toMainSiteScanScopeContext = (ctx: unknown): MainSiteScanScopeContext | null => {
  if (!isMainSiteRecord(ctx)) return null;
  return {
    scope: String(ctx.scope || ''),
    list: Array.isArray(ctx.list) ? ctx.list.map((slug) => String(slug || '')) : [],
    activeSlug: String(ctx.activeSlug || ''),
    activeSlugFromRoute: ctx.activeSlugFromRoute === true,
  };
};

const getMainSiteRuntimeGlobal = (): typeof globalThis & MainSiteRuntimeFlags => (
  globalThis as typeof globalThis & MainSiteRuntimeFlags
);

const getMainSiteRuntimeWindow = (): (Window & MainSiteRuntimeFlags) | null => (
  typeof window === 'undefined' ? null : window as Window & MainSiteRuntimeFlags
);

export class MainSite extends Component<MainSiteProps, MainSiteState> {
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
    scanFailedFor: null,      // ID confirmed not found in any group
    scanErrorFor: null,       // ID found or attempted, but failed to load reliably
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

  setRecordStateFromController = (
    updater: MainSiteStateRecordUpdater,
    cb?: () => void
  ): void => {
    this.setState((prevState) => updater(prevState) as MainSiteStatePatch, cb);
  };

  setCacheControllerState = (
    updater: MainSiteCacheControllerStateArg,
    cb?: () => void
  ): void => {
    this.setState((prevState) => (
      typeof updater === 'function'
        ? updater(prevState) as MainSiteStatePatch
        : updater as MainSiteStatePatch
    ), cb);
  };

  readDgRecord = (
    name: string,
    slug: string,
    opts?: Record<string, unknown>
  ): Record<string, unknown> | null => {
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
      opts: Parameters<NonNullable<SessionCacheReadinessHost['syncCacheHasLoadedFlagFromPersistent']>>[1]
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
  _scanPolicy: SessionScanPolicy = createSessionScanPolicy({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getCurrentPath: () => this.getCurrentPathname(),
    getSessionSlugHintFromSearch: (search: string) => this.getSessionSlugHintFromSearch(search),
    getSessionTokenFromPath: (path: string) => this.getSessionTokenFromPath(path),
    isSbtListRoutePath: (path: string) => this.isSbtListRoutePath(path),
  });
  _profileScanController: SessionProfileScanController = createSessionProfileScanController({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionSlugFromState: () => this.getSessionSlugFromState(),
    getSessionChainId: (slug?: string) => this.getSessionChainId(slug),
    getSessionCfg: (slug?: string) => this.getSessionCfg(slug),
    getSessionScanScopeContext: (scope?: unknown) => ({
      ...this.getSessionScanScopeContext(typeof scope === 'string' ? scope : undefined),
    }),
    getScopedSessionSlugs: (scope: string) => this.getScopedSessionSlugs(scope),
    isSessionSlugAllowedForScan: (slug: string, ctx) => this.isSessionSlugAllowedForScan(
      slug,
      toMainSiteScanScopeContext(ctx)
    ),
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
    dgRead: (name: unknown, slug: unknown, opts?: unknown) => (
      this.DG.read(name as string, slug as string, isMainSiteRecord(opts) ? opts : undefined)
    ),
    dgWrite: (name: unknown, slug: unknown, value: unknown) => (
      this.DG.write(name as string, slug as string, value)
    ),
    dgKey: (name: unknown, slug: unknown) => this.DG.key(name as string, slug as string),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (slug: string) => this.getCacheSessionCfg(slug),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getSessionScanScope: () => this.getSessionScanScope(),
    getSessionScanScopeContext: (scope?: string) => this.getSessionScanScopeContext(scope),
    getAccount: () => (this.props?.account || ''),
    getCurrentPath: () => (this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
    getEffectiveRoutePath: (pathIn?: string) => this.getEffectiveRoutePath(pathIn || ''),
    getScopeFilteredSlugs: (slugs: string[], scope?: string) => this.getScopeFilteredSlugs(slugs, scope),
    getScopedSessionSlugs: (scope?: string) => this.getScopedSessionSlugs(scope),
    shouldSkipSessionScanForSlug: (slug: string, op: string, scopeCtx?: unknown) => (
      this.shouldSkipSessionScanForSlug(slug, op, toMainSiteScanScopeContext(scopeCtx))
    ),
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    logScopeSkipOnce: (op: string, slug: string, scopeCtx?: unknown) => (
      this.logScopeSkipOnce(op, slug, toMainSiteScanScopeContext(scopeCtx))
    ),
    isSbtInstanceListenerEnabledForGroup: (slug: string) => this.isSbtInstanceListenerEnabledForGroup(slug),
    shouldAutoRunFullSbtScan: (opts?: Record<string, unknown>) => this.shouldAutoRunFullSbtScan({
      pathname: typeof opts?.pathname === 'string' ? opts.pathname : undefined,
    }),
    isSbtHistoryScanEnabled: () => this.isSbtHistoryScanEnabled(),
    shouldAttachSbtDetailInstanceListener: () => this.shouldAttachSbtDetailInstanceListener(),
    setReadinessStateIfChanged: (patch: Record<string, unknown>, cb?: () => void) => (
      this.setReadinessStateIfChanged(patch, cb)
    ),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    queueLocalRevisionUpdate: (opts?: Record<string, unknown>) => this.queueLocalRevisionUpdate({
      needsSbtRevision: opts?.needsSbtRevision === true,
      needsQuestionResponsesNonce: opts?.needsQuestionResponsesNonce === true,
      checkAllCachesReady: opts?.checkAllCachesReady === true,
    }),
    readFlag: (flag: string, slug: string) => this.readFlag(flag, slug),
    writeFlag: (flag: string, slug: string, value: unknown) => this.writeFlag(flag, slug, value),
    refreshEncryptedQuestionPayloadsForGroup: (slug: string, opts?: Record<string, unknown>) => (
      this.refreshEncryptedQuestionPayloadsForGroup(slug, opts)
    ),
    initializeSurveyCacheForGroup: (slugIn?: unknown, opts?: unknown) => (
      this.initializeSurveyCacheForGroup(String(slugIn || ''), isMainSiteRecord(opts) ? opts : {})
    ),
    runWithGeneralSessionBackfill: (opts: Record<string, unknown>) => this.runWithGeneralSessionBackfill(opts),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) => (
      this.mergeLegacyNumericNetworkKey(cache, networkID)
    ),
  } satisfies SessionSbtCacheHost);
  _surveyCacheController: SessionSurveyCacheController = createSessionSurveyCacheController({
    setState: this.setCacheControllerState,
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (name: string, slug: string) => this.readDgRecord(name, slug),
    dgWrite: (name: string, slug: string, value: Record<string, unknown>) => this.DG.write(name, slug, value),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (slug: string) => this.getCacheSessionCfg(slug),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getAccount: () => this.props.account,
    getCurrentPath: () => this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    shouldSkipSessionScanForSlug: (slug: string, op: string, scopeCtx?: unknown) => (
      this.shouldSkipSessionScanForSlug(slug, op, toMainSiteScanScopeContext(scopeCtx))
    ),
    onSurveyEventDetectedForGroup: (slug: string, event: unknown) => (
      this.onNewSurveyEventDetectedForGroup(slug, event as MainSiteSurveyEventLike)
    ),
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    logScopeSkipOnce: (op: string, slug: string, scopeCtx?: unknown) => (
      this.logScopeSkipOnce(op, slug, toMainSiteScanScopeContext(scopeCtx))
    ),
    setReadinessStateIfChanged: (nextState: Record<string, unknown> | null | undefined, cb?: () => void) => (
      this.setReadinessStateIfChanged(nextState, cb)
    ),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    readFlag: (name: string, slug: string) => this.readFlag(name, slug),
    writeFlag: (name: string, slug: string, val: unknown) => this.writeFlag(name, slug, val),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) => (
      this.mergeLegacyNumericNetworkKey(cache, networkID)
    ),
    initializeQuestionCacheForGroup: (slug: string, opts?: Record<string, unknown>) => this.initializeQuestionCacheForGroup(slug, opts),
    writeSurveyMetadataToCache: (
      slug: string,
      surveyID: string,
      surveyData: Record<string, unknown>,
      creationBlock: unknown,
      networkID: string,
      opts?: Record<string, unknown>
    ) => this.writeSurveyMetadataToCache(slug, surveyID, surveyData, creationBlock as number | string | null, networkID, {
      enforceScopedIsolation: opts?.enforceScopedIsolation === true,
    }),
    queueLocalRevisionUpdate: (opts?: Parameters<SessionCacheReadinessController['queueLocalRevisionUpdate']>[0]) => (
      this.queueLocalRevisionUpdate(opts)
    ),
    getSessionScanScope: () => this.getSessionScanScope(),
  } satisfies SessionSurveyCacheHost);
  _questionCacheController: SessionQuestionCacheController = createSessionQuestionCacheController({
    setState: this.setCacheControllerState,
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (name: string, slug: string, opts?: Record<string, unknown>) => this.readDgRecord(name, slug, opts),
    dgWrite: (name: string, slug: string, value: Record<string, unknown>) => this.DG.write(name, slug, value),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (slug: string) => this.getCacheSessionCfg(slug),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getSessionScanScope: () => this.getSessionScanScope(),
    getAccount: () => this.props.account,
    getProviderLike: () => this.props.provider,
    getNetwork: () => this.props?.network || null,
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    setReadinessStateIfChanged: (nextState: Record<string, unknown> | null | undefined, cb?: () => void) => (
      this.setReadinessStateIfChanged(nextState, cb)
    ),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) => (
      this.mergeLegacyNumericNetworkKey(cache, networkID)
    ),
    buildMetadataSessionCacheEnvelope: (
      questionData: Record<string, unknown>,
      slug: string,
      opts?: Record<string, unknown>
    ) => this.buildMetadataSessionCacheEnvelope(questionData, slug, {
      scoped: opts?.scoped === true,
      includeSlugField: opts?.includeSlugField === true,
    }),
    writeQuestionMetadataToCache: (
      slug: string,
      questionID: string,
      questionData: Record<string, unknown>,
      networkID: string,
      opts?: Record<string, unknown>
    ) => this.writeQuestionMetadataToCache(slug, questionID, questionData, networkID, {
      enforceScopedIsolation: opts?.enforceScopedIsolation === true,
    }),
    queueLocalRevisionUpdate: (opts?: Parameters<SessionCacheReadinessController['queueLocalRevisionUpdate']>[0]) => (
      this.queueLocalRevisionUpdate(opts)
    ),
  } satisfies SessionQuestionCacheHost);
  _responseHydrationController: SessionResponseHydrationController = createSessionResponseHydrationController({
    setState: this.setCacheControllerState,
    isMounted: () => this._mounted,
    dgRead: (name: string, slug: string) => this.readDgRecord(name, slug),
    dgWrite: (name: string, slug: string, value: Record<string, unknown>) => this.DG.write(name, slug, value),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionChainId: (slug: string) => this.getCacheSessionChainId(slug),
    getAccount: () => this.props.account,
    scanScopeNoop: (slug: string, op: string, onSkipped?: () => void) => this.scanScopeNoop(slug, op, onSkipped),
    setReadinessStateIfChanged: (nextState: Record<string, unknown> | null | undefined, cb?: () => void) => (
      this.setReadinessStateIfChanged(nextState, cb)
    ),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    mergeLegacyNumericNetworkKey: (cache: Record<string, unknown>, networkID: string) => (
      this.mergeLegacyNumericNetworkKey(cache, networkID)
    ),
    queueLocalRevisionUpdate: (opts?: Parameters<SessionCacheReadinessController['queueLocalRevisionUpdate']>[0]) => (
      this.queueLocalRevisionUpdate(opts)
    ),
  } satisfies SessionResponseHydrationHost);
  _scanSpecificUserProfileInFlight = new Map<string, Promise<MainSiteProfileScanReport | null>>();
  _profileScanTelemetrySeq = 0;
  _cacheReinitRunSeq = 0;
  _activeCacheReinitRunToken = 0;
  _sessionRouteLightDiscoveryInFlight: Record<string, unknown> = {};
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
    getSessionConfigBySlugOrDefault: (slug: string) => getSessionConfigBySlugOrDefault(slug) as Record<string, unknown> | null | undefined,
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

  beginSbtLiveProgress: SessionSbtCacheController['beginSbtLiveProgress'] =
    (...args) => this._sbtCacheController.beginSbtLiveProgress(...args);

  updateSbtLiveProgress: SessionSbtCacheController['updateSbtLiveProgress'] =
    (...args) => this._sbtCacheController.updateSbtLiveProgress(...args);

  clearSbtLiveProgress: SessionSbtCacheController['clearSbtLiveProgress'] =
    (...args) => this._sbtCacheController.clearSbtLiveProgress(...args);

  setSbtRealtimeCoverageForGroup: SessionSbtCacheController['setSbtRealtimeCoverageForGroup'] =
    (...args) => this._sbtCacheController.setSbtRealtimeCoverageForGroup(...args);

  clearSbtRealtimeCoverageForGroup: SessionSbtCacheController['clearSbtRealtimeCoverageForGroup'] =
    (...args) => this._sbtCacheController.clearSbtRealtimeCoverageForGroup(...args);

  normalizeSbtRealtimeEventCursor: SessionSbtCacheController['normalizeSbtRealtimeEventCursor'] =
    (...args) => this._sbtCacheController.normalizeSbtRealtimeEventCursor(...args);

  compareSbtRealtimeEventCursor: SessionSbtCacheController['compareSbtRealtimeEventCursor'] =
    (...args) => this._sbtCacheController.compareSbtRealtimeEventCursor(...args);

  removeSbtRealtimeListenersForGroup: SessionSbtCacheController['removeSbtRealtimeListenersForGroup'] =
    (...args) => this._sbtCacheController.removeSbtRealtimeListenersForGroup(...args);
  normalizeRoutePath = normalizeRoutePathFn;

  isGeneralRoutePath = isGeneralRoutePathFn;

  getEffectiveRoutePath = (pathIn = '') => getEffectiveRoutePathFn(pathIn, {
    windowPathIn: typeof window !== 'undefined'
      ? window.location.pathname
      : '',
    redirectPathIn: this._sessionFallbackRedirectPath,
  });

  getSessionFallbackScopeSlugs = () => getSessionFallbackScopeSlugsFn({
    readSessionScanScope,
    readSessionScanSlugs,
    sessionRegistryStore: {
      getAllSessionEntries: sessionRegistryReadsPort.getAllSessionEntries,
    },
    normalizeSessionSlug,
  });

  getSessionFallbackPreferredTarget = () => getSessionFallbackPreferredTargetFn(
    this.getSessionFallbackScopeSlugs(),
    { DEFAULT_SESSION_SLUG_ALIAS }
  );

  isFirstVisitRootRedirectEnabled = () => isFirstVisitRootRedirectEnabledFn({
    readBoolishRuntimeFlag: this.readBoolishRuntimeFlag,
    CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED,
  });

  getTemporaryInitialLoadAboutRedirectTarget = (pathIn: unknown = '') => (
    getTemporaryInitialLoadAboutRedirectTargetFn({
      isFirstVisitRootRedirectEnabled: this.isFirstVisitRootRedirectEnabled,
      isTemporaryInitialLoadAboutRedirectSessionSlug: (slug: string) => isDemoSessionSlug(slug),
      normalizeRoutePath: (value: unknown) => this.normalizeRoutePath(String(value || '')),
      normalizeSessionSlug,
      pathIn,
    })
  );

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

  shouldForceOneTimeFirstVisitRootRedirect = () => shouldForceOneTimeFirstVisitRootRedirectFn(
    this.getFirstVisitRootRedirectStorage()
  );

  consumeOneTimeFirstVisitRootRedirect = () => consumeOneTimeFirstVisitRootRedirectFn(
    this.getFirstVisitRootRedirectStorage(),
    { firstVisitStorageKey: FIRST_VISIT_STORAGE_KEY }
  );

  getSessionFallbackRedirectStorageKey = (slugIn: unknown = '') => (
    getSessionFallbackRedirectStorageKeyFn(slugIn, {
      normalizeSessionSlug,
      DEFAULT_SESSION_SLUG_ALIAS,
      SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX,
    })
  );

  hasConsumedSessionFallbackRedirect = (target: SessionFallbackRedirectTarget | null = null) => (
    hasConsumedSessionFallbackRedirectFn(target, {
      getStorageKey: this.getSessionFallbackRedirectStorageKey,
    })
  );

  consumeSessionFallbackRedirect = (target: SessionFallbackRedirectTarget | null = null) => (
    consumeSessionFallbackRedirectFn(target, {
      getStorageKey: this.getSessionFallbackRedirectStorageKey,
    })
  );

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
    canonicalNetworkKey: unknown
  ): boolean => {
    if (!cacheObj || typeof cacheObj !== 'object') return false;
    const networkKey = String(canonicalNetworkKey || '');
    if (!networkKey) return false;
    const altKey = Object.keys(cacheObj).find(
      (k) => k !== networkKey && Number(k) === Number(networkKey)
    );
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

  isCacheReinitRunActive = (token: unknown) => (
    !!this._mounted && Number(token || 0) === Number(this._activeCacheReinitRunToken || 0)
  );

  getCurrentPathname = () => (
    (typeof window !== 'undefined' ? window.location.pathname : '') || this.props.path || ''
  );

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

  setReadinessStateIfChanged: SessionCacheReadinessController['setReadinessStateIfChanged'] =
    (...args) => this._cacheReadinessController.setReadinessStateIfChanged(...args);

  syncCacheHasLoadedFlagOnTransition: SessionCacheReadinessController['syncCacheHasLoadedFlagOnTransition'] =
    (...args) => this._cacheReadinessController.syncCacheHasLoadedFlagOnTransition(...args);

  scheduleCacheUpdateFlush: SessionCacheReadinessController['scheduleCacheUpdateFlush'] =
    (...args) => this._cacheReadinessController.scheduleCacheUpdateFlush(...args);

  queueCacheUpdateFlush: SessionCacheReadinessController['queueCacheUpdateFlush'] =
    (...args) => this._cacheReadinessController.queueCacheUpdateFlush(...args);

  flushQueuedCacheUpdates: SessionCacheReadinessController['flushQueuedCacheUpdates'] =
    (...args) => this._cacheReadinessController.flushQueuedCacheUpdates(...args);

  queueLocalRevisionUpdate: SessionCacheReadinessController['queueLocalRevisionUpdate'] =
    (...args) => this._cacheReadinessController.queueLocalRevisionUpdate(...args);

  flushLocalRevisionUpdate: SessionCacheReadinessController['flushLocalRevisionUpdate'] =
    (...args) => this._cacheReadinessController.flushLocalRevisionUpdate(...args);

  handleCrossTabCacheUpdateEvent: SessionCacheReadinessController['handleCrossTabCacheUpdateEvent'] =
    (...args) => this._cacheReadinessController.handleCrossTabCacheUpdateEvent(...args);

  queueSurveyGroupScan = (surveyID: unknown, opts: SurveyGroupScanQueueOptions = {}) => {
    const sid = String(surveyID || '').toLowerCase();
    if (!sid) return;
    const hintedSlug = normalizeSessionSlug(String(opts?.hintedSlug || ''));
    if (this._queuedSurveyGroupScanId === sid && this._queuedSurveyGroupScanHintedSlug === hintedSlug) return;

    this._queuedSurveyGroupScanId = sid;
    this._queuedSurveyGroupScanHintedSlug = hintedSlug;
    try {
      if (this._queuedSurveyGroupScanTimer) clearTimeout(this._queuedSurveyGroupScanTimer);
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

    this._queuedSurveyGroupScanTimer = setTimeout(() => {
      const hintedSlugForRun = this._queuedSurveyGroupScanHintedSlug || '';
      this._queuedSurveyGroupScanTimer = null;
      this._queuedSurveyGroupScanId = null;
      this._queuedSurveyGroupScanHintedSlug = '';
      this.scanForSurveyGroup(sid, { hintedSlug: hintedSlugForRun });
    }, 0);
  };

  pruneMaskedQuestionDecryptBackoff: SessionQuestionCacheController['pruneMaskedQuestionDecryptBackoff'] =
    (...args) => this._questionCacheController.pruneMaskedQuestionDecryptBackoff(...args);

  // Group slug parser
  getSessionTokenFromPath = (pathIn = ''): string => {
    const p = String(this.getEffectiveRoutePath(pathIn) || '').trim();
    if (!p.startsWith('/session/')) return '';
    return (p.split('/').filter(Boolean)[1] || '').trim();
  };

  resolveSessionSlugFromPathToken = (
    rawToken: unknown,
    { allowAsyncResolve = false }: MainSiteSessionPathTokenOptions = {}
  ): string => {
    const sessionToken = String(rawToken || '').trim();
    const result = resolveMainSiteSessionSlugFromPathToken({
      rawToken: sessionToken,
      formatSessionId: sessionRegistryReadsPort.formatSessionId,
      resolveSessionConfigById: sessionRegistryReadsPort.getSessionConfigById,
      resolveSessionConfigBySlug: (slug: string) => sessionRegistryReadsPort.getSessionConfig(slug) || getSessionConfigBySlug(slug),
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
      (typeof window !== 'undefined' ? window.location.pathname : '') || this.props.path || ''
    );
    const token = this.getSessionTokenFromPath(p);
    if (token) {
      return this.resolveSessionSlugFromPathToken(token, { allowAsyncResolve: true });
    }
    return DEFAULT_SESSION_SLUG; // canonical default slug in client state
  }

  getExplicitSessionSlugFromProps = (
    props: MainSiteProps = this.props,
    { allowAsyncResolve = true }: MainSiteSessionPathTokenOptions = {}
  ): MainSiteExplicitSessionSlug => {
    const path = props === this.props
      ? this.getEffectiveRoutePath(
        props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
      )
      : this.normalizeRoutePath(props?.path || '');
    return resolveMainSiteExplicitSessionSlugFromPath({
      path,
      resolveSessionSlugFromPathToken: (sessionToken: string) => (
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve })
      ),
    });
  };

  getGlobalPrimarySessionSlugFromProps = (props: MainSiteProps = this.props): string => {
    return resolveMainSiteGlobalPrimarySessionSlug({
      sessionState: props?.sessionState || {},
      derivePrimarySessionSlugFromList,
    });
  };

  getSessionSlugFromProps = (props: MainSiteProps = this.props): string => {
    const path = props === this.props
      ? this.getEffectiveRoutePath(
        props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
      )
      : this.normalizeRoutePath(props?.path || '');
    return resolveMainSiteSessionSlugFromProps({
      path,
      activeSessionSlug: props.activeSessionSlug || '',
      sessionState: props?.sessionState || {},
      resolveSessionSlugFromPathToken: (sessionToken: string) => (
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true })
      ),
      derivePrimarySessionSlugFromList,
    });
  };

  getDisplaySessionCfg = (slugIn: unknown): MainSiteSessionConfigLike | null => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    const strictCfg = this.getSessionCfg(normalized);
    if (strictCfg) return strictCfg;
    const demoCfg = (
      getDemoSessionConfigBySlug(normalized, { allowDemoFallback: true }) as MainSiteSessionConfigLike | null
    ) || null;
    if (demoCfg) return demoCfg;
    if (normalized === 'demo') {
      return (
        getDemoSessionConfigBySlug('', { allowDemoFallback: true }) as MainSiteSessionConfigLike | null
      ) || null;
    }
    return null;
  };

  getDisplaySessionChainId = (slugIn: unknown): number | null => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    const strictChainId = this.getSessionChainId(normalized);
    if (strictChainId) return strictChainId;
    const cfg = this.getDisplaySessionCfg(normalized);
    const chainId = Number(cfg?.networkChainId || 0);
    return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
  };

  getCacheSessionCfg = (slugIn: unknown): MainSiteSessionConfigLike | null => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    return this.getSessionCfg(normalized) || this.getDisplaySessionCfg(normalized);
  };

  getCacheSessionChainId = (slugIn: unknown): number | null => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    return this.getSessionChainId(normalized) || this.getDisplaySessionChainId(normalized);
  };

  getDisplaySessionNetwork = (slugIn: unknown) => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    const strictNetwork = this.getSessionNetwork(normalized);
    if (strictNetwork?.id) return strictNetwork;
    const chainId = this.getDisplaySessionChainId(normalized);
    if (!chainId) return null;
    const chain = getChainById(chainId);
    if (chain) return chain;
    return {
      id: chainId,
      name: `Chain ${chainId}`,
      network: String(chainId),
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: { default: { http: [] }, public: { http: [] } },
      blockExplorers: { default: { name: '', url: '' } },
      unsupported: false,
    };
  };

  getInitializableSessionNetwork = (slugIn: unknown, pathIn: unknown = '') => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    const strictNetwork = this.getSessionNetwork(normalized);
    if (strictNetwork?.id) return strictNetwork;
    const path = this.getEffectiveRoutePath(
      String(pathIn || '') ||
      (typeof window !== 'undefined' ? window.location.pathname : '') ||
      this.props.path ||
      ''
    );
    if (!path.startsWith('/session/')) return strictNetwork;
    return this.getDisplaySessionNetwork(normalized);
  };

  isAboutRoutePath = (pathIn: unknown = ''): boolean => {
    const path = this.getEffectiveRoutePath(
      String(pathIn || '') ||
      (typeof window !== 'undefined' ? window.location.pathname : '') ||
      this.props.path ||
      ''
    );
    return path === '/about' || path === '/about/';
  };

  preloadAboutDemoSessionData = (pathIn: unknown = ''): Promise<void> | null => {
    if (!this.isAboutRoutePath(pathIn)) return null;

    const slug = normalizeSessionSlug(getPrimaryDemoSessionSlug());
    if (!slug) return null;

    const sessionNet = this.getDisplaySessionNetwork(slug);
    if (!sessionNet?.id) return null;

    if (
      this._aboutDemoSessionPreloadSlug === slug &&
      this._aboutDemoSessionPreloadPromise
    ) {
      return this._aboutDemoSessionPreloadPromise;
    }

    const run = (async () => {
      mainSiteLog.log('[About] Preloading public demo session data', { slug });
      const questionPreload = this.initializeQuestionCacheForGroup(slug, { background: true });
      const responsePreload = questionPreload.then(() => (
        this.fetchQuestionResponsesChunkedForGroup(slug, { background: true })
      ));
      const preloadResults = await Promise.allSettled([
        questionPreload,
        responsePreload,
        this.initializeSurveyCacheForGroup(slug, { background: true }),
        this.initializeSbtCacheForGroup(slug, { mode: 'partial', background: true }),
      ]);
      const firstRejected = preloadResults.find((result) => result.status === 'rejected');
      if (firstRejected?.status === 'rejected') {
        throw firstRejected.reason;
      }
    })().catch((err: unknown) => {
      mainSiteLog.warn('[About] Demo session preload failed', {
        slug,
        error: readMainSiteErrorMessage(err),
      });
    }).finally(() => {
      if (this._aboutDemoSessionPreloadPromise === run) {
        this._aboutDemoSessionPreloadPromise = null;
      }
    });

    this._aboutDemoSessionPreloadSlug = slug;
    this._aboutDemoSessionPreloadPromise = run;
    return run;
  };

  handleSessionRegistryCacheUpdated = () => {
    if (!this._mounted) return;
    this.setState((prev) => ({
      sessionRegistryRevision: Number(prev?.sessionRegistryRevision || 0) + 1,
    }), () => {
      if (!this._mounted) return;
      this.syncLitHooks();
      const activeSlug = normalizeSessionSlug(this.getActiveSessionSlug() || '');
      if (activeSlug) {
        void this.ensureSessionRouteSbtDiscovery(activeSlug);
      }
      this.handleDeepLinkScan();
    });
  };

  getSessionSlugFromState = () => this.getSessionSlugFromProps(this.props);

  getActiveSessionSlug = () => (
    this.getSessionSlugFromState() || this.getInitialGroupSlugFromPath()
  );

  getActiveSessionSourceSlug = () => {
    const path = this.getEffectiveRoutePath(
      (typeof window !== 'undefined' ? window.location.pathname : '') || this.props.path || ''
    );
    const sessionTokenRaw = this.getSessionTokenFromPath(path);
    if (!sessionTokenRaw) return this.getActiveSessionSlug();

    const sessionSlug = this.resolveSessionSlugFromPathToken(sessionTokenRaw, { allowAsyncResolve: false }) || '';
    const strictConfig = (
      sessionRegistryReadsPort.getSessionConfig(sessionSlug) ||
      getSessionConfigBySlug(sessionSlug)
    );
    const displayConfig = strictConfig || getDemoSessionConfigBySlug(sessionSlug, { allowDemoFallback: true });
    return resolveMainSiteSessionRouteSourceSlug({
      sessionTokenRaw,
      sessionSlug,
      sessionConfig: displayConfig,
    });
  };

  getBootstrapActiveSessionSlug = (pathIn = '', searchIn = ''): string => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    const search = typeof searchIn === 'string'
      ? searchIn
      : ((typeof window !== 'undefined' ? window.location.search : '') || '');
    return this.getRenderActiveSessionSlug(path, search);
  };

  getRenderActiveSessionSlug = (pathIn = '', searchIn = ''): string => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    return resolveMainSiteRenderActiveSessionSlug({
      path,
      search: searchIn,
      activeSessionSlug: this.getGlobalPrimarySessionSlugFromProps(this.props),
      isCacheManagerReady: this.state.isCacheManagerReady,
      getSessionConfigBySlug,
      resolveDisplaySessionConfigBySlug: (slug: string) => (
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
      ),
      resolveSessionConfigById: (sessionId: string | number) => sessionRegistryReadsPort.getSessionConfigById(sessionId),
      resolveSessionSlugFromPathToken: (sessionToken: string) => (
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true })
      ),
    });
  };

  resolveTrustedSbtRouteSessionSlug = (searchIn = ''): string | null => {
    const hintedSlug = resolveMainSiteRouteSessionSlugHint({
      search: searchIn,
      allowSessionIdLookup: true,
      resolveSessionConfigById: (sessionId: string | number) => (
        sessionRegistryReadsPort.getSessionConfigById(
        sessionRegistryReadsPort.formatSessionId(String(sessionId)) || sessionId
        )
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
    opts: MainSiteSbtDetailRouteOptions = {}
  ): Promise<string> => {
    const search = typeof opts.search === 'string' ? opts.search : '';
    const fallbackSlug = typeof opts.fallbackSlug === 'string'
      ? opts.fallbackSlug
      : (this.getActiveSessionSlug() || '');
    const hintedDetailSlug = this.resolveTrustedSbtRouteSessionSlug(search);
    if (hintedDetailSlug != null) return hintedDetailSlug;

    const requestedAddress = String(sbtAddress || '').trim().toLowerCase();
    const pinnedAddress = String(this.state.sbtDetailAddress || '').trim().toLowerCase();
    if (
      requestedAddress &&
      pinnedAddress === requestedAddress &&
      this.state.sbtDetailGroupSlug != null
    ) {
      return this.state.sbtDetailGroupSlug;
    }

    return this.resolveGroupSlugForSbtAddress(sbtAddress, { fallbackSlug });
  };

  getSbtAddressFromPath = (pathIn = '') =>
    getSbtAddressFromPathFn(
      this.getEffectiveRoutePath(pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
      { isAddress: ethers.utils.isAddress }
    );

  isSbtListRoutePath = (pathIn = '') =>
    isSbtListRoutePathFn(
      this.getEffectiveRoutePath(pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '')
    );

  getSbtListRouteSessionSlug = (pathIn = '') =>
    getSbtListRouteSessionSlugFn(
      this.getEffectiveRoutePath(pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
      { normalizeSessionSlug }
    );

  getUserAddressFromPath = (pathIn = '') =>
    getUserAddressFromPathFn(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
      { isAddress: ethers.utils.isAddress }
    );

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

  syncLitHooks = () => {
    if (typeof window === 'undefined') return;
    const slug = this.getActiveSessionSlug();
    const cfg = resolveMainSiteLitSessionConfigSource({
      slug,
      resolveRegistryConfigBySlug: (sessionSlug: string) => sessionRegistryReadsPort.getSessionConfig(sessionSlug),
      resolveStaticConfigBySlug: (sessionSlug: string) => getSessionConfigBySlugOrDefault(sessionSlug),
    });
    const { chainId, litNetwork, litChain, accessControlConditions, userMaxPrice, chipotle } = resolveMainSiteLitSessionConfig({
      sessionConfig: cfg,
      networkChainIdFallback: this.props.network?.id || null,
    });

    const hooks = chipotle ? createLitHooks({
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
    }) : null;

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

  refreshSessionInfo: SessionMetaRefreshController['refreshSessionInfo'] =
    (...args) => this._sessionMetaRefreshController.refreshSessionInfo(...args);

  refreshSessionMetaFields: SessionMetaRefreshController['refreshSessionMetaFields'] =
    (...args) => this._sessionMetaRefreshController.refreshSessionMetaFields(...args);

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
        const fromWindow = Number(
          getMainSiteRuntimeWindow()?.CE_SURVEY_DEEPLINK_RPC_TIMEOUT_MS
        );
        if (Number.isFinite(fromWindow) && fromWindow > 0) return Math.floor(fromWindow);
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    return 12000;
  };

  resolveMetadataSessionBinding = (metadata: unknown, fallbackSlug = '') => (
    resolveMetadataSessionBindingFn(metadata, fallbackSlug)
  );

  resolveMetadataSessionSlug = (metadata: unknown, fallbackSlug = '') => (
    resolveMetadataSessionSlugFn(metadata, fallbackSlug)
  );

  resolveScopedMetadataSessionSlug = (metadata: unknown, fallbackSlug = '') => (
    resolveScopedMetadataSessionSlugFn(metadata, fallbackSlug)
  );

  buildMetadataSessionCacheEnvelope = (
    metadata: unknown,
    fallbackSlug = '',
    options: BuildEnvelopeOptions = {}
  ) => (
    buildMetadataSessionCacheEnvelopeFn(metadata, fallbackSlug, options)
  );

  writeSurveyMetadataToCache = (
    slugIn: unknown,
    surveyId: unknown,
    surveyData: MetadataRecord | null | undefined,
    creationBlock: number | string | null = null,
    netKeyIn: unknown = null,
    options: MainSiteMetadataWriterOptions = {}
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

    const groupCache = (
      this.readDgRecord('surveysCache', slug) || {}
    ) as MainSiteSurveyMetadataCache;
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
      try { delete networkCache.pendingSurveyMetadata[sid]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    }
    this.DG.write('surveysCache', slug, groupCache);
    return true;
  };

  writeQuestionMetadataToCache = (
    slugIn: unknown,
    questionId: unknown,
    questionData: MetadataRecord | null | undefined,
    netKeyIn: unknown = null,
    options: MainSiteMetadataWriterOptions = {}
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

    const questionsCache = (
      this.readDgRecord('questionsCache', slug) || {}
    ) as MainSiteQuestionMetadataCache;
    this.mergeLegacyNumericNetworkKey(questionsCache, netKey);
    if (!questionsCache[netKey]) {
      questionsCache[netKey] = {
        questionsLatestBlock: 0,
        questionsDiscoveryCheckpointBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},
        pendingQuestionMetadata: {},
        questionResponsesLatestBlock: 0,
        arweaveTxCache: {},
        arweaveTxFailureCache: {},
        questionHydrationMeta: {},
      };
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
      try { delete networkCache.pendingQuestionMetadata[qid]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    }
    this.DG.write('questionsCache', slug, questionsCache);
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
      ''
    );
    if (!networkID) return false;

    const targetSlugs = ['', 'demo'];
    let wroteAny = false;
    targetSlugs.forEach((slug) => {
      questionPool.forEach((question) => {
        const questionId = String(question?.id || '').trim().toLowerCase();
        if (!questionId) return;
        const didWrite = this.writeQuestionMetadataToCache(
          slug,
          questionId,
          question as MetadataRecord,
          networkID,
          { enforceScopedIsolation: false }
        );
        wroteAny = wroteAny || didWrite;
      });
    });

    if (wroteAny) {
      this.setReadinessStateIfChanged({
        isQuestionCacheReady: true,
        questionScanProgress: null,
      }, this.checkAllCachesReady);
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
      resolveMetadataSessionSlug: (metadata: unknown, fallbackSlug: string) => (
        this.resolveMetadataSessionSlug(metadata, fallbackSlug)
      ),
      getAllSessionSlugs,
      normalizeSessionSlug,
      warn: (error: unknown) => { mainSiteLog.warn('MainSite: fallback', error); },
    });
  }

  getSessionSlugHintFromSearch = (search: string = ''): string | null => {
    try {
      return resolveMainSiteRouteSessionSlugHint({
        search,
        allowSessionIdLookup: true,
        resolveSessionConfigById: (sessionId: string | number) => sessionRegistryReadsPort.getSessionConfigById(sessionId),
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

  getQuestionRouteSessionIdHint = ({
    requireResolved = false,
  }: QuestionRouteSessionIdHintOptions = {}): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      return resolveMainSiteRouteSessionIdHint({
        search: window.location.search || '',
        requireResolved,
        formatSessionId: sessionRegistryReadsPort.formatSessionId,
        resolveSessionConfigById: (sessionId: string | number) => sessionRegistryReadsPort.getSessionConfigById(sessionId),
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
      resolveMetadataSessionSlug: (metadata: unknown, fallbackSlug: string) => (
        this.resolveMetadataSessionSlug(metadata, fallbackSlug)
      ),
      getAllSessionSlugs,
      normalizeSessionSlug,
      isKnownOrGeneralSessionSlug: (slug: string) => (
        isKnownOrGeneralSessionSlug(slug, getSessionConfigBySlug)
      ),
      warn: (error: unknown) => { mainSiteLog.warn('MainSite: fallback', error); },
    });
  }

  resolveGroupSlugForSbtAddress = async (
    sbtAddress: string | null | undefined,
    opts: MainSiteSbtDetailRouteOptions = {}
  ): Promise<string> => {
    const fallbackSlug = typeof opts.fallbackSlug === 'string'
      ? opts.fallbackSlug
      : (this.getActiveSessionSlug() || '');
    return resolveGroupSlugForSbtAddressFn(sbtAddress, {
      fallbackSlug,
      isValidAddress: (addr: string) => ethers.utils.isAddress(addr),
      getSessionScanScope: () => this.getSessionScanScope(),
      getScopedSessionSlugs: (scope: string) => this.getScopedSessionSlugs(scope),
      getAllSessionSlugs,
      dgRead: (collection: string, slug: string) => this.readDgRecord(collection, slug, { clone: false }),
      getSbtMetadata: (provider: string, address: string, slug: string) => (
        sbtMetadataReadsPort.getSbtMetadata(provider, address, slug)
      ),
      getSbtCreationBlockByAddress: (provider: string, address: string, slug: string) => (
        sbtMetadataReadsPort.getSbtCreationBlockByAddress(provider, address, slug)
      ),
      normalizeSessionSlug,
      getSessionSlugByName,
      getSessionConfigBySlugOrDefault,
      resolveMetadataSessionSlug: (metadata: unknown, slug: string) => (
        this.resolveMetadataSessionSlug(metadata, slug)
      ),
      warn: (error: unknown) => { mainSiteLog.warn('MainSite: fallback', error); },
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
  getSessionChainId = _getSessionChainId;
  getSessionNetwork = _getSessionNetwork;

  isSbtInstanceListenerEnabledForGroup: SessionScanPolicy['isSbtInstanceListenerEnabledForGroup'] =
    (slugIn) => this._scanPolicy.isSbtInstanceListenerEnabledForGroup(slugIn);

  isSbtHistoryScanEnabled: SessionScanPolicy['isSbtHistoryScanEnabled'] =
    () => this._scanPolicy.isSbtHistoryScanEnabled();

  getSessionScanScope: SessionScanPolicy['getSessionScanScope'] =
    () => this._scanPolicy.getSessionScanScope();

  getSessionScanScopeContext: SessionScanPolicy['getSessionScanScopeContext'] =
    (scopeIn) => this._scanPolicy.getSessionScanScopeContext(scopeIn);
  hasExplicitProfileScanScopeOverride: SessionProfileScanController['hasExplicitProfileScanScopeOverride'] =
    (...args) => this._profileScanController.hasExplicitProfileScanScopeOverride(...args);

  getProfileScanScopeContext: SessionProfileScanController['getProfileScanScopeContext'] =
    (...args) => this._profileScanController.getProfileScanScopeContext(...args);

  isSessionSlugAllowedForScan: SessionScanPolicy['isSessionSlugAllowedForScan'] =
    (slugIn, scopeContextIn = null) => this._scanPolicy.isSessionSlugAllowedForScan(slugIn, scopeContextIn);

  logScopeSkipOnce: SessionScanPolicy['logScopeSkipOnce'] =
    (operation, slugIn, scopeContextIn = null) => this._scanPolicy.logScopeSkipOnce(operation, slugIn, scopeContextIn);

  shouldAutoRunFullSbtScan: SessionScanPolicy['shouldAutoRunFullSbtScan'] =
    (opts) => this._scanPolicy.shouldAutoRunFullSbtScan(opts);

  shouldAttachSbtDetailInstanceListener: SessionScanPolicy['shouldAttachSbtDetailInstanceListener'] =
    () => this._scanPolicy.shouldAttachSbtDetailInstanceListener();

  getScopedSessionSlugs: SessionScanPolicy['getScopedSessionSlugs'] =
    (scopeIn) => this._scanPolicy.getScopedSessionSlugs(scopeIn);
  readBoolishRuntimeFlag: SessionProfileScanController['readBoolishRuntimeFlag'] =
    (...args) => this._profileScanController.readBoolishRuntimeFlag(...args);

  isProfileScanTelemetryEnabled: SessionProfileScanController['isProfileScanTelemetryEnabled'] =
    (...args) => this._profileScanController.isProfileScanTelemetryEnabled(...args);

  emitProfileScanTelemetry: SessionProfileScanController['emitProfileScanTelemetry'] =
    (...args) => this._profileScanController.emitProfileScanTelemetry(...args);

  isProfileScanColdDiagEnabled: SessionProfileScanController['isProfileScanColdDiagEnabled'] =
    (...args) => this._profileScanController.isProfileScanColdDiagEnabled(...args);

  emitProfileScanColdDiag: SessionProfileScanController['emitProfileScanColdDiag'] =
    (...args) => this._profileScanController.emitProfileScanColdDiag(...args);

  readProfileScanStepTimeoutMs: SessionProfileScanController['readProfileScanStepTimeoutMs'] =
    (...args) => this._profileScanController.readProfileScanStepTimeoutMs(...args);

  readProfileScanSbtBurstSize: SessionProfileScanController['readProfileScanSbtBurstSize'] =
    (...args) => this._profileScanController.readProfileScanSbtBurstSize(...args);

  readProfileScanActivityLookbackBlocks: SessionProfileScanController['readProfileScanActivityLookbackBlocks'] =
    (...args) => this._profileScanController.readProfileScanActivityLookbackBlocks(...args);

  readUserProfileAllSessionsFlag: SessionProfileScanController['readUserProfileAllSessionsFlag'] =
    (...args) => this._profileScanController.readUserProfileAllSessionsFlag(...args);

  getUserProfileAllSessionsScanMode: SessionProfileScanController['getUserProfileAllSessionsScanMode'] =
    (...args) => this._profileScanController.getUserProfileAllSessionsScanMode(...args);

  isUserProfileAllSessionsScanEnabled: SessionProfileScanController['isUserProfileAllSessionsScanEnabled'] =
    (...args) => this._profileScanController.isUserProfileAllSessionsScanEnabled(...args);

  getActiveProfileScanChainId: SessionProfileScanController['getActiveProfileScanChainId'] =
    (...args) => this._profileScanController.getActiveProfileScanChainId(...args);

  getRegistrySessionEntryCount: SessionProfileScanController['getRegistrySessionEntryCount'] =
    (...args) => this._profileScanController.getRegistrySessionEntryCount(...args);

  getRegistrySessionCoverageCountForChain: SessionProfileScanController['getRegistrySessionCoverageCountForChain'] =
    (...args) => this._profileScanController.getRegistrySessionCoverageCountForChain(...args);

  getRegistryBootstrapScopeKey: SessionProfileScanController['getRegistryBootstrapScopeKey'] =
    (...args) => this._profileScanController.getRegistryBootstrapScopeKey(...args);

  readProfileScanRegistryLookupTimeoutMs: SessionProfileScanController['readProfileScanRegistryLookupTimeoutMs'] =
    (...args) => this._profileScanController.readProfileScanRegistryLookupTimeoutMs(...args);

  getProfileScanListScopeSessionConfigCacheKey: SessionProfileScanController['getProfileScanListScopeSessionConfigCacheKey'] =
    (...args) => this._profileScanController.getProfileScanListScopeSessionConfigCacheKey(...args);

  resolveListScopeSessionConfigFromRegistry: SessionProfileScanController['resolveListScopeSessionConfigFromRegistry'] =
    (...args) => this._profileScanController.resolveListScopeSessionConfigFromRegistry(...args);

  ensureRegistryHydratedForProfileScan: SessionProfileScanController['ensureRegistryHydratedForProfileScan'] =
    (...args) => this._profileScanController.ensureRegistryHydratedForProfileScan(...args);

  isOnchainSessionRegistryEnabled: SessionProfileScanController['isOnchainSessionRegistryEnabled'] =
    (...args) => this._profileScanController.isOnchainSessionRegistryEnabled(...args);

  refreshSessionUniverseRegistryCache: SessionProfileScanController['refreshSessionUniverseRegistryCache'] =
    (...args) => this._profileScanController.refreshSessionUniverseRegistryCache(...args);

  resolveProfileDeepScanPlan: SessionProfileScanController['resolveProfileDeepScanPlan'] =
    (...args) => this._profileScanController.resolveProfileDeepScanPlan(...args);

  scheduleProfileScanRetryAfterRegistryHydration: SessionProfileScanController['scheduleProfileScanRetryAfterRegistryHydration'] =
    (...args) => this._profileScanController.scheduleProfileScanRetryAfterRegistryHydration(...args);

  getProfileDeepScanSlugs: SessionProfileScanController['getProfileDeepScanSlugs'] =
    (...args) => this._profileScanController.getProfileDeepScanSlugs(...args);

  shouldSkipSessionScanForSlug: SessionScanPolicy['shouldSkipSessionScanForSlug'] =
    (slugIn, operation, scopeContextIn = null) => (
      this._scanPolicy.shouldSkipSessionScanForSlug(slugIn, operation, scopeContextIn)
    );

  scanScopeNoop: SessionScanPolicy['scanScopeNoop'] =
    (slugIn, operation, onSkipped) => this._scanPolicy.scanScopeNoop(slugIn, operation, onSkipped);

  getScopeFilteredSlugs: SessionScanPolicy['getScopeFilteredSlugs'] =
    (slugs = [], scopeIn = null) => this._scanPolicy.getScopeFilteredSlugs(slugs, scopeIn);
  shouldBackfillGeneralSession: SessionProfileScanController['shouldBackfillGeneralSession'] =
    (...args) => this._profileScanController.shouldBackfillGeneralSession(...args);

  enqueueGeneralSessionBackfill: SessionProfileScanController['enqueueGeneralSessionBackfill'] =
    (...args) => this._profileScanController.enqueueGeneralSessionBackfill(...args);

  runWithGeneralSessionBackfill: SessionProfileScanController['runWithGeneralSessionBackfill'] =
    (...args) => this._profileScanController.runWithGeneralSessionBackfill(...args);

  scanForSurveyGroup = async (surveyID: unknown, opts: SurveyGroupScanQueueOptions = {}) => {
    const sid = String(surveyID || '').toLowerCase();

    // 1. Guard: Validate ID and prevent concurrent scans for the same ID
    if (!sid) return;
    if (this.state.isScanningForGroup === sid || this.state.scanFailedFor === sid) return;
    if (this._surveyGroupScanInFlight.has(sid)) return;

    // 2. Check if already exists in CURRENT active cache (optimization)
    const currentSlug = this.getSessionSlugFromState();
    const currentChainId = String(this.getSessionChainId(currentSlug));
    const currentCache = this.readDgRecord(
      'surveysCache',
      currentSlug,
      { clone: false }
    ) as MainSiteSurveyMetadataCache | null;

    if (currentCache?.[currentChainId]?.surveys?.[sid]) {
      mainSiteLog.log(`[MainSite] Survey ${sid} already exists in current group (${currentSlug}).`);
      return;
    }

    this._surveyGroupScanInFlight.add(sid);

    const scanScope = this.getSessionScanScope();
    const hintedSlug = normalizeSessionSlug(
      String(opts?.hintedSlug || this.getSurveyRouteSessionSlugHint() || '')
    );
    let allSlugs = scanScope === 'all'
      ? this.getScopeFilteredSlugs(getAllSessionSlugs(), scanScope)
      : this.getScopedSessionSlugs(scanScope);
    // Query-hinted survey URLs should resolve in that exact session context first.
    // This avoids long cross-session scans and matches shared-link intent.
    if (hintedSlug) {
      if (!this.getSessionChainId(hintedSlug) && this.isOnchainSessionRegistryEnabled()) {
        try {
          await this.ensureRegistryHydratedForProfileScan();
          allSlugs = scanScope === 'all'
            ? this.getScopeFilteredSlugs(getAllSessionSlugs(), scanScope)
            : this.getScopedSessionSlugs(scanScope);
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      }
      if (this.getSessionChainId(hintedSlug)) {
        const prioritized = [hintedSlug, ...(Array.isArray(allSlugs) ? allSlugs : [])]
          .map((slug) => normalizeSessionSlug(slug || ''));
        allSlugs = Array.from(new Set(prioritized));
      }
    }

    const rpcTimeoutMs = this.getSurveyDeepLinkRpcTimeoutMs();
    const runWithTimeout = async <T,>(
      promiseFactory: () => Promise<T> | T,
      label: string,
      slug: string
    ): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          Promise.resolve().then(() => promiseFactory()),
          new Promise<never>((_, reject) => {
            timeoutId = setTimeout(() => {
              const err = new Error(
                `[MainSite] DeepLink: ${label} timed out after ${rpcTimeoutMs}ms for slug "${String(slug || '')}".`
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
      (scanScope === 'all' ? 'Scanning all sessions...' : `Scanning scoped sessions (scope=${scanScope})...`)
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
            slug
          );

          if (hash && hash !== ethers.constants.HashZero) {
            mainSiteLog.log(`[MainSite] DeepLink: Match found in session '${slug}'. Fetching full data...`);

            // B. Fetch: Get full JSON data immediately
            const surveyData = await runWithTimeout<MainSiteMutableMetadata | null>(
              () => surveyReadsPort.getSurveyDataById('none', sid, slug, {
                throwOnFailure: true,
                forceArweaveFetch: true,
              }),
              'getSurveyDataById',
              slug
            );

            if (surveyData) {
              // Normalize data structure
              surveyData.surveyID = sid;
              surveyData.id = sid;
              if (!surveyData.questionIDs) surveyData.questionIDs = [];
              if (!surveyData.creator) surveyData.creator = "";
              const targetSlug = this.resolveMetadataSessionSlug(surveyData, slug);
              if (!surveyData.sessionSlug) surveyData.sessionSlug = targetSlug;
              if (!surveyData.slug) surveyData.slug = targetSlug;
              const targetNetKey = String(this.getSessionChainId(targetSlug) || netKey);

              // C. Cache: Write directly to the target group's localStorage
              this.writeSurveyMetadataToCache(targetSlug, sid, surveyData, null, targetNetKey);

              mainSiteLog.log(`[MainSite] DeepLink: Data fetched and cached for survey ${sid} in group ${targetSlug}. Switching context.`);

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
              `Survey metadata fetch returned no data for session "${slug}".`
            ) as MainSiteProfileScanError;
            scanLoadError.code = 'SURVEY_METADATA_EMPTY';
            scanLoadError.slug = slug;
          }
        } catch (innerErr) {
          mainSiteLog.warn(`[MainSite] Error scanning group '${slug}' for survey ${sid}:`, innerErr);
          scanLoadError = innerErr instanceof Error
            ? innerErr as MainSiteProfileScanError
            : new Error(String(innerErr || 'Unknown survey scan error')) as MainSiteProfileScanError;
          // Continue to next group
        }
      }

      if (scanLoadError) {
        const message =
          String(
            scanLoadError?.arweaveFailure?.message ||
            scanLoadError?.message ||
            'Survey metadata was found but could not be loaded.'
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
      mainSiteLog.error("[MainSite] DeepLink: Critical error during scan:", err);
      this.setState({
        isScanningForGroup: null,
        scanFailedFor: null,
        scanErrorFor: sid,
        scanErrorMessage: String(
          readMainSiteErrorMessage(err) || 'Survey resolution failed unexpectedly.'
        ),
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
    targetAddress: unknown
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

  scanSpecificUserProfile = async (
    targetAddress: unknown
  ): Promise<MainSiteProfileScanReport | null> => {
    const target = String(targetAddress || '');
    if (!target || !ethers.utils.isAddress(target)) return null;

    const targetLower = target.toLowerCase();
    if (this._scanSpecificUserProfileInFlight.has(targetLower)) {
      return this._scanSpecificUserProfileInFlight.get(targetLower) || null;
    }

    const run = (async () => {
      const allSessionsMode = this.getUserProfileAllSessionsScanMode();
      const scopeContext = this.getProfileScanScopeContext();
      const fanoutPlan = createProfileScanFanoutPlan({
        scopeContext,
        allSessionsMode,
      });
      const {
        isListScope,
        allowListScopeSbtFanout,
        allowListScopeSurveyActivityFanout,
        allowListScopeQuestionActivityFanout,
        useAllSessionsScan,
        shouldHydrateRegistry,
      } = fanoutPlan;
      const registryStatus = shouldHydrateRegistry
        ? await this.ensureRegistryHydratedForProfileScan({
          forceAllChains: isListScope,
        })
        : null;
      const profileScanPlan = this.resolveProfileDeepScanPlan({
        registryStatus,
        useAllSessionsScan,
      });
      const allSlugs = profileScanPlan.slugs;
      const {
        attemptedCoverageSlugs,
        attemptedCoverageSlugSet,
      } = resolveProfileScanAttemptedCoverageSlugs({
        fanoutPlan,
        scopeContext,
        allSlugs,
      });
      this.emitProfileScanColdDiag('plan', {
        targetAddress: targetLower,
        scope: scopeContext.scope,
        scopeList: scopeContext.list,
        isListScope,
        allowListScopeSbtFanout,
        allowListScopeSurveyActivityFanout,
        allowListScopeQuestionActivityFanout,
        useAllSessionsScan,
        shouldHydrateRegistry,
        registryStatus,
        slugCount: allSlugs.length,
        slugs: allSlugs.slice(0, 10),
        coverageComplete: profileScanPlan.coverageComplete,
        coverageReason: profileScanPlan.coverageReason,
        scanOrdering: profileScanPlan.scanOrdering,
      });
      const sbtFetchTimeoutMs = this.readProfileScanStepTimeoutMs('sbt');
      const activityFetchTimeoutMs = this.readProfileScanStepTimeoutMs('activity');
      const slugFetchTimeoutMs = Math.max(sbtFetchTimeoutMs, activityFetchTimeoutMs);
      const sbtBurstSize = this.readProfileScanSbtBurstSize();
      const activityLookbackBlocks = this.readProfileScanActivityLookbackBlocks({
        useAllSessions: !!allSessionsMode.useAllSessionsActivityScan,
      });
      const report = createInitialProfileScanReport({
        targetLower,
        profileScanPlan,
        allSessionsMode,
        fanoutPlan,
        attemptedCoverageSlugs,
        slugFetchTimeoutMs,
        sbtFetchTimeoutMs,
        activityFetchTimeoutMs,
        activityLookbackBlocks,
        sbtBurstSize,
      }) as MainSiteProfileScanReport;
      this.emitProfileScanTelemetry('scan-start', {
        targetAddress: targetLower,
        usedAllSessions: report.usedAllSessions,
        useAllSessionsSbtScan: report.useAllSessionsSbtScan,
        useAllSessionsSurveyActivityScan: report.useAllSessionsSurveyActivityScan,
        useAllSessionsQuestionActivityScan: report.useAllSessionsQuestionActivityScan,
        useAllSessionsActivityScan: report.useAllSessionsActivityScan,
        listScopeSbtFanout: report.listScopeSbtFanout,
        listScopeSurveyActivityFanout: report.listScopeSurveyActivityFanout,
        listScopeQuestionActivityFanout: report.listScopeQuestionActivityFanout,
        coverageComplete: report.coverageComplete,
        coverageReason: report.coverageReason,
        hadLoadErrors: report.hadLoadErrors,
        registryStatus: registryStatus || null,
        attemptedSlugs: [...report.attemptedSlugs],
        rawAllSlugCount: report.rawAllSlugCount,
        activeChainSlugCount: report.activeChainSlugCount,
        scopedFallbackSlugCount: report.scopedFallbackSlugCount,
        relevantSlugs: [...report.relevantSlugs],
        prioritizedGeneralFirst: report.prioritizedGeneralFirst,
        scanOrdering: report.scanOrdering,
        slugFetchTimeoutMs: report.slugFetchTimeoutMs,
        sbtFetchTimeoutMs: report.sbtFetchTimeoutMs,
        activityFetchTimeoutMs: report.activityFetchTimeoutMs,
        activityLookbackBlocks: report.activityLookbackBlocks,
        sbtBurstSize: report.sbtBurstSize,
      });
      if (report.coverageComplete === false) {
        this.scheduleProfileScanRetryAfterRegistryHydration(target, report.coverageReason);
      }

      const pushUnique = (list: string[], value: unknown) => {
        if (!Array.isArray(list)) return;
        const token = String(value || '');
        if (!token) return;
        if (!list.includes(token)) list.push(token);
      };
      const pushUniqueSample = (list: string[], value: unknown, max = 12) => {
        if (!Array.isArray(list)) return;
        const token = String(value || '').trim().toLowerCase();
        if (!token || list.includes(token)) return;
        if (list.length >= Math.max(1, Number(max) || 1)) return;
        list.push(token);
      };
      const normalizeEventIdentifier = (raw: unknown) => String(raw || '').trim().toLowerCase();
      const readCreatedSurveyId = (item: MainSiteProfileActivityEntry = {}) => normalizeEventIdentifier(
        item?.id || item?.surveyId || item?.surveyID
      );
      const readCreatedQuestionId = (item: MainSiteProfileActivityEntry = {}) => normalizeEventIdentifier(
        item?.id || item?.questionId || item?.questionID
      );
      const readSurveyResponseId = (item: MainSiteProfileActivityEntry = {}) => normalizeEventIdentifier(
        item?.surveyId || item?.surveyID || item?.id
      );
      const readQuestionResponseId = (item: MainSiteProfileActivityEntry = {}) => normalizeEventIdentifier(
        item?.questionId || item?.questionID || item?.id
      );
      const skippedSlugReasons: Record<string, string> = {};

      const markSlugSkipped = (
        slug: string,
        reason: string,
        extra: Record<string, unknown> = {}
      ) => {
        pushUnique(report.skippedSlugs, slug);
        skippedSlugReasons[String(slug || '')] = String(reason || 'invalid-config');
        report.skippedSlugReasons = { ...skippedSlugReasons };
        this.emitProfileScanTelemetry('slug-skip-invalid-config', {
          targetAddress: targetLower,
          slug,
          reason: String(reason || 'invalid-config'),
          ...(extra && typeof extra === 'object' ? extra : {}),
        });
      };

      const normalizeActivityPayload = (raw: unknown): MainSiteProfileActivityPayload => {
        const payload = (raw && typeof raw === 'object') ? raw : {};
        return {
          createdSurveys: Array.isArray((payload as MainSiteProfileActivityPayload).createdSurveys)
            ? (payload as MainSiteProfileActivityPayload).createdSurveys
            : [],
          createdQuestions: Array.isArray((payload as MainSiteProfileActivityPayload).createdQuestions)
            ? (payload as MainSiteProfileActivityPayload).createdQuestions
            : [],
          surveyResponses: Array.isArray((payload as MainSiteProfileActivityPayload).surveyResponses)
            ? (payload as MainSiteProfileActivityPayload).surveyResponses
            : [],
          questionResponses: Array.isArray((payload as MainSiteProfileActivityPayload).questionResponses)
            ? (payload as MainSiteProfileActivityPayload).questionResponses
            : [],
        };
      };

      mainSiteLog.log(
        `[DeepSearch] Starting cross-group scan for user: ${targetLower}`,
        { usedAllSessions: report.usedAllSessions, slugCount: allSlugs.length }
      );

      let newDataWritten = false; // track whether anything new was written to caches

      const scanOneSlug = async (slug: string) => {
        const slugStartedAt = Date.now();
        try {
          let resolvedRegistrySessionCfg = null;
          let chainId = this.getSessionChainId(slug);
          if (!chainId && isListScope) {
            resolvedRegistrySessionCfg = await this.resolveListScopeSessionConfigFromRegistry(slug, {
              targetAddress: targetLower,
            });
            chainId = Number(
              resolvedRegistrySessionCfg?.networkChainId ||
              resolvedRegistrySessionCfg?.contracts?.surveys?.chainId ||
              resolvedRegistrySessionCfg?.contracts?.sbtFactory?.chainId ||
              0
            ) || 0;
          }
          if (!chainId) {
            markSlugSkipped(slug, 'missing-chain-id', {
              fallbackAttempted: !!isListScope,
              durationMs: Math.max(0, Date.now() - slugStartedAt),
            });
            this.emitProfileScanTelemetry('slug-skip-no-chain-id', {
              targetAddress: targetLower,
              slug,
            });
            return;
          }
          const netKey = String(chainId); // e.g. "84532"

          // A. Prepare block range and read user cache
          let sessionCfg = this.getSessionCfg(slug);
          if ((!sessionCfg || typeof sessionCfg !== 'object') && resolvedRegistrySessionCfg) {
            sessionCfg = resolvedRegistrySessionCfg as MainSiteMutableMetadata;
          }
          if (!sessionCfg || typeof sessionCfg !== 'object') {
            markSlugSkipped(slug, 'missing-session-config', {
              fallbackAttempted: !!resolvedRegistrySessionCfg,
              durationMs: Math.max(0, Date.now() - slugStartedAt),
            });
            return;
          }
          const currentBlock = await chainScanReadsPort.getLatestBlockNumber('none', slug);
          let startBlockRaw = Number(sessionCfg?.blockLimits?.start);
          if (!Number.isFinite(startBlockRaw) || startBlockRaw <= 0) {
            const windowRef = (() => {
              const baseCfg = { ...sessionCfg };
              if (!baseCfg.slug) baseCfg.slug = slug;
              if (report.usedAllSessions) baseCfg.__ignoreSessionScanScope = true;
              return baseCfg;
            })();
            try {
              const fallbackWindow = await chainScanReadsPort.getRelevantBlockWindowForFilter(windowRef);
              startBlockRaw = Number(fallbackWindow?.fromBlock);
            } catch (fallbackError) {
              mainSiteLog.warn('[DeepSearch] Failed to recover missing blockLimits.start from SessionRegistry fallback.', {
                slug,
                error: readMainSiteErrorMessage(fallbackError) || String(fallbackError),
              });
            }
          }
          if (!Number.isFinite(startBlockRaw) || startBlockRaw <= 0) {
            markSlugSkipped(slug, 'missing-start-block', {
              sessionSlug: String(slug || ''),
              durationMs: Math.max(0, Date.now() - slugStartedAt),
            });
            return;
          }
          const startBlock = Math.floor(startBlockRaw);

          // Read Cache: dg:userCache:<slug>
          let userCache = (this.DG.read('userCache', slug) || {}) as MainSiteProfileUserCache;

          // Ensure User Node exists
          if (!userCache[targetLower]) {
            userCache[targetLower] = {};
          }

          // Ensure Chain Node exists
          if (!userCache[targetLower][netKey]) {
            userCache[targetLower][netKey] = {
              lastBlockScanned: startBlock - 1,
              lastScanTimestamp: 0,
              scanIncomplete: false,
              surveyActivityLastBlockScanned: startBlock - 1,
              surveyActivityScanIncomplete: false,
              questionActivityLastBlockScanned: startBlock - 1,
              questionActivityScanIncomplete: false,
              sbtLastBlockScanned: startBlock - 1,
              sbtScanIncomplete: false,
              sbtBackfillComplete: false,
              data: {
                sbts: [],
                createdSurveys: [],
                createdQuestions: [],
                surveyResponses: [],
                questionResponses: []
              }
            };
          }

          let chainEntry: MainSiteProfileUserChainEntry = userCache[targetLower][netKey];
          if (!chainEntry || typeof chainEntry !== 'object') {
            chainEntry = {};
          }
          if (!chainEntry.data || typeof chainEntry.data !== 'object') {
            chainEntry.data = {
              sbts: [],
              createdSurveys: [],
              createdQuestions: [],
              surveyResponses: [],
              questionResponses: [],
            };
          }
          if (!Array.isArray(chainEntry.data.sbts)) chainEntry.data.sbts = [];
          if (!Array.isArray(chainEntry.data.createdSurveys)) chainEntry.data.createdSurveys = [];
          if (!Array.isArray(chainEntry.data.createdQuestions)) chainEntry.data.createdQuestions = [];
          if (!Array.isArray(chainEntry.data.surveyResponses)) chainEntry.data.surveyResponses = [];
          if (!Array.isArray(chainEntry.data.questionResponses)) chainEntry.data.questionResponses = [];
          if (!Number.isFinite(Number(chainEntry.lastBlockScanned))) {
            chainEntry.lastBlockScanned = startBlock - 1;
          }
          if (!Number.isFinite(Number(chainEntry.sbtLastBlockScanned))) {
            chainEntry.sbtLastBlockScanned = Number(chainEntry.lastBlockScanned || (startBlock - 1));
          }
          if (typeof chainEntry.scanIncomplete !== 'boolean') chainEntry.scanIncomplete = false;
          if (typeof chainEntry.sbtScanIncomplete !== 'boolean') chainEntry.sbtScanIncomplete = false;
          if (typeof chainEntry.sbtBackfillComplete !== 'boolean') chainEntry.sbtBackfillComplete = false;
          const legacyActivityLastBlock = Number(chainEntry.lastBlockScanned || (startBlock - 1));
          if (!Number.isFinite(Number(chainEntry.surveyActivityLastBlockScanned))) {
            chainEntry.surveyActivityLastBlockScanned = legacyActivityLastBlock;
          }
          if (!Number.isFinite(Number(chainEntry.questionActivityLastBlockScanned))) {
            chainEntry.questionActivityLastBlockScanned = legacyActivityLastBlock;
          }
          if (typeof chainEntry.surveyActivityScanIncomplete !== 'boolean') {
            chainEntry.surveyActivityScanIncomplete = chainEntry.scanIncomplete === true;
          }
          if (typeof chainEntry.questionActivityScanIncomplete !== 'boolean') {
            chainEntry.questionActivityScanIncomplete = chainEntry.scanIncomplete === true;
          }

          const normalizedSlug = normalizeSessionSlug(slug || '');
          const inAttemptedCoverage = attemptedCoverageSlugSet.has(normalizedSlug);
          const shouldRunSbtForSlug = (
            inAttemptedCoverage ||
            report.useAllSessionsSbtScan === true
          );
          const shouldIncludeSurveyActivity = (
            inAttemptedCoverage ||
            report.useAllSessionsSurveyActivityScan === true
          );
          const shouldIncludeQuestionActivity = (
            inAttemptedCoverage ||
            report.useAllSessionsQuestionActivityScan === true
          );
          const shouldRunActivityForSlug = (
            shouldIncludeSurveyActivity ||
            shouldIncludeQuestionActivity
          );
          const ranFullActivityCoverage = (
            shouldIncludeSurveyActivity &&
            shouldIncludeQuestionActivity
          );

          // Detect whether we've *ever* stored any data for this user+chain.
          const d = chainEntry.data || {};
          const neverHadData =
            (!Array.isArray(d.sbts) || d.sbts.length === 0) &&
            (!Array.isArray(d.createdSurveys) || d.createdSurveys.length === 0) &&
            (!Array.isArray(d.createdQuestions) || d.createdQuestions.length === 0) &&
            (!Array.isArray(d.surveyResponses) || d.surveyResponses.length === 0) &&
            (!Array.isArray(d.questionResponses) || d.questionResponses.length === 0);
          const shouldForceSbtBackfill = chainEntry.sbtScanIncomplete === true || chainEntry.sbtBackfillComplete !== true;

          // Keep an independent SBT watermark so we can backfill SBT history even when
          // activity scans were previously incremental.
          let sbtFromBlock;
          if (shouldForceSbtBackfill) {
            sbtFromBlock = startBlock;
          } else {
            sbtFromBlock = Number(chainEntry.sbtLastBlockScanned || 0) + 1;
          }
          if (sbtFromBlock > currentBlock) sbtFromBlock = currentBlock;

          const resolveActivityWindow = (
            lastBlockValue: unknown,
            incompleteFlag: unknown
          ): MainSiteProfileActivityWindow => {
            const normalizedLastBlock = Number(lastBlockValue || 0);
            const shouldForceBackfill = incompleteFlag === true || normalizedLastBlock < startBlock;
            if (shouldForceBackfill) {
              return { fromBlock: startBlock, shouldForceBackfill: true };
            }
            return {
              fromBlock: Math.max(
                startBlock,
                normalizedLastBlock + 1 - Math.max(0, Number(activityLookbackBlocks || 0))
              ),
              shouldForceBackfill: false,
            };
          };
          const surveyActivityWindow = shouldIncludeSurveyActivity
            ? resolveActivityWindow(
                chainEntry.surveyActivityLastBlockScanned,
                chainEntry.surveyActivityScanIncomplete
              )
            : null;
          const questionActivityWindow = shouldIncludeQuestionActivity
            ? resolveActivityWindow(
                chainEntry.questionActivityLastBlockScanned,
                chainEntry.questionActivityScanIncomplete
              )
            : null;
          const activityWindows = [surveyActivityWindow, questionActivityWindow].filter(
            isMainSitePresent
          );
          const shouldForceActivityBackfill = activityWindows.some((window) => window.shouldForceBackfill);
          let activityFromBlock = activityWindows.length > 0
            ? Math.min(...activityWindows.map((window) => window.fromBlock))
            : currentBlock;
          if (activityFromBlock > currentBlock) activityFromBlock = currentBlock;

          this.emitProfileScanColdDiag('slug-window', {
            targetAddress: targetLower,
            slug,
            chainId,
            netKey,
            currentBlock,
            startBlock,
            sbtFromBlock,
            activityFromBlock,
            neverHadData,
            shouldForceActivityBackfill,
            shouldForceSbtBackfill,
            lastBlockScanned: chainEntry.lastBlockScanned,
            surveyActivityLastBlockScanned: chainEntry.surveyActivityLastBlockScanned,
            questionActivityLastBlockScanned: chainEntry.questionActivityLastBlockScanned,
            sbtLastBlockScanned: chainEntry.sbtLastBlockScanned,
            blockLimitsStart: sessionCfg?.blockLimits?.start,
            sessionCfgSlug: sessionCfg?.slug,
          });

          const resolveBackfillTimeoutMs = (
            baseTimeoutMs: unknown,
            shouldForceBackfill: boolean,
            allowAdaptiveBackfill: boolean,
            opts: MainSiteProfileBackfillTimeoutOptions = {}
          ) => {
            const base = Number.isFinite(Number(baseTimeoutMs))
              ? Math.max(5000, Math.floor(Number(baseTimeoutMs)))
              : 5000;
            if (!allowAdaptiveBackfill || shouldForceBackfill !== true) return base;
            const blockSpan = Math.max(0, Number(currentBlock || 0) - Number(startBlock || 0));
            const spanStepBlocks = Number.isFinite(Number(opts.spanStepBlocks))
              ? Math.max(5000, Math.floor(Number(opts.spanStepBlocks)))
              : 250000;
            const spanMultiplier = 1 + Math.min(6, Math.floor(blockSpan / spanStepBlocks));
            const floorOverride = Number.isFinite(Number(opts.floorTimeoutMs))
              ? Math.max(5000, Math.floor(Number(opts.floorTimeoutMs)))
              : base;
            const floor = Math.max(base, floorOverride);
            const boosted = floor * spanMultiplier;
            const timeoutCapMs = Number.isFinite(Number(opts.timeoutCapMs))
              ? Math.max(5000, Math.floor(Number(opts.timeoutCapMs)))
              : 180000;
            return Math.min(timeoutCapMs, Math.max(floor, boosted));
          };
          const allowAdaptiveSbtTimeout = (
            report.useAllSessionsSbtScan === true ||
            isListScope
          );
          const allowAdaptiveActivityTimeout = (
            report.useAllSessionsActivityScan === true ||
            isListScope
          );
          const sbtTimeoutForSlugMs = resolveBackfillTimeoutMs(
            sbtFetchTimeoutMs,
            shouldForceSbtBackfill,
            allowAdaptiveSbtTimeout,
            {
              floorTimeoutMs: sbtFetchTimeoutMs,
              spanStepBlocks: isListScope ? 40000 : 250000,
              timeoutCapMs: 180000,
            }
          );
          const activityTimeoutForSlugMs = resolveBackfillTimeoutMs(
            activityFetchTimeoutMs,
            shouldForceActivityBackfill,
            allowAdaptiveActivityTimeout,
            {
              floorTimeoutMs: activityFetchTimeoutMs,
              spanStepBlocks: isListScope ? 20000 : 250000,
              timeoutCapMs: isListScope ? 120000 : 180000,
            }
          );
          this.emitProfileScanTelemetry('slug-start', {
            targetAddress: targetLower,
            slug,
            chainId: Number(chainId || 0),
            startBlock,
            currentBlock,
            fromBlock: sbtFromBlock,
            sbtFromBlock,
            activityFromBlock,
            shouldForceBackfill: shouldForceSbtBackfill,
            shouldForceSbtBackfill,
            shouldForceActivityBackfill,
            activityLookbackBlocks: Number(activityLookbackBlocks || 0),
            priorScanIncomplete: chainEntry.scanIncomplete === true,
            priorSbtScanIncomplete: chainEntry.sbtScanIncomplete === true,
            priorSbtBackfillComplete: chainEntry.sbtBackfillComplete === true,
            sbtFetchTimeoutMs: Number(sbtTimeoutForSlugMs || 0),
            activityFetchTimeoutMs: Number(activityTimeoutForSlugMs || 0),
          });

          mainSiteLog.log(
            `[DeepSearch] Group '${slug}': Scanning for ${targetLower} ` +
            `(SBT from ${sbtFromBlock}, activity from ${activityFromBlock}) to ${currentBlock}`
          );

          // B. Fetch incremental data (delta)
          let sbts: MainSiteProfileScanSbt[] = [];
          let activity: MainSiteProfileActivityPayload = {
            createdSurveys: [],
            createdQuestions: [],
            surveyResponses: [],
            questionResponses: []
          };
          let sbtHadRpcError = false;
          let activityHadRpcError = false;

          const runWithTimeout = async <T,>(
            promise: Promise<T> | T,
            kind: string,
            fromBlock: number,
            timeoutMs: unknown
          ): Promise<MainSiteProfileTimeoutOutcome<T>> => {
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs))
              ? Math.max(5000, Math.floor(Number(timeoutMs)))
              : Math.max(5000, Math.floor(Number(slugFetchTimeoutMs || 12000)));
            try {
              const outcome = await Promise.race<MainSiteProfileTimeoutOutcome<T>>([
                Promise.resolve(promise)
                  .then((value) => ({ timedOut: false, value }))
                  .catch((error) => ({ timedOut: false, error })),
                new Promise<MainSiteProfileTimeoutOutcome<T>>((resolve) => {
                  timeoutId = setTimeout(() => {
                    resolve({ timedOut: true });
                  }, effectiveTimeoutMs);
                }),
              ]);
              if (outcome?.timedOut) {
                this.emitProfileScanTelemetry('slug-timeout', {
                  targetAddress: targetLower,
                  slug,
                  kind,
                  fromBlock,
                  currentBlock,
                  timeoutMs: effectiveTimeoutMs,
                });
              }
              return outcome || { timedOut: false, value: null };
            } finally {
              if (timeoutId) clearTimeout(timeoutId);
            }
          };

          if (sbtFromBlock <= currentBlock && shouldRunSbtForSlug) {
            const sbtResult = await runWithTimeout(
              profileScanPort.getSBTsForUser(target, slug, sbtFromBlock, {
                returnMeta: true,
                ignoreScope: report.useAllSessionsSbtScan === true,
              }),
              'sbt',
              sbtFromBlock,
              sbtTimeoutForSlugMs
            );
            if (sbtResult?.timedOut) {
              sbtHadRpcError = true;
            } else if (sbtResult?.error) {
              sbtHadRpcError = true;
              this.emitProfileScanTelemetry('slug-step-error', {
                targetAddress: targetLower,
                slug,
                kind: 'sbt',
                error: String(readMainSiteErrorMessage(sbtResult.error) || ''),
              });
            } else {
              const sbtRaw = sbtResult?.value;
              const sbtMeta = isMainSiteProfileMetaResult<MainSiteProfileScanSbt[]>(sbtRaw)
                ? sbtRaw
                : { data: sbtRaw, hadError: false };
              sbts = Array.isArray(sbtMeta.data) ? sbtMeta.data : [];
              sbtHadRpcError = !!sbtMeta.hadError;
            }
          } else if (sbtFromBlock <= currentBlock && !shouldRunSbtForSlug) {
            this.emitProfileScanTelemetry('slug-step-skipped', {
              targetAddress: targetLower,
              slug,
              kind: 'sbt',
              reason: 'list-scope-activity-fanout',
            });
          }

          if (activityFromBlock <= currentBlock && shouldRunActivityForSlug) {
            const activityResult = await runWithTimeout(
              profileScanPort.getUserActivity(target, slug, activityFromBlock, {
                returnMeta: true,
                ignoreScope: report.useAllSessionsActivityScan === true,
                includeSurveyActivity: shouldIncludeSurveyActivity,
                includeQuestionActivity: shouldIncludeQuestionActivity,
                forceArweaveFetch: true,
              }),
              'activity',
              activityFromBlock,
              activityTimeoutForSlugMs
            );
            if (activityResult?.timedOut) {
              activityHadRpcError = true;
            } else if (activityResult?.error) {
              activityHadRpcError = true;
              this.emitProfileScanTelemetry('slug-step-error', {
                targetAddress: targetLower,
                slug,
                kind: 'activity',
                error: String(readMainSiteErrorMessage(activityResult.error) || ''),
              });
            } else {
              const activityRaw = activityResult?.value;
              const activityMeta = isMainSiteProfileMetaResult<MainSiteProfileActivityPayload>(activityRaw)
                ? activityRaw
                : { data: activityRaw, hadError: false };
              activity = normalizeActivityPayload(activityMeta.data);
              activityHadRpcError = !!activityMeta.hadError;
            }
          } else if (activityFromBlock <= currentBlock && !shouldRunActivityForSlug) {
            this.emitProfileScanTelemetry('slug-step-skipped', {
              targetAddress: targetLower,
              slug,
              kind: 'activity',
              reason: 'list-scope-sbt-fanout',
            });
          }

          const slugHadRpcError = !!(sbtHadRpcError || activityHadRpcError);
          const sbtAddressSamples = sbts
            .map((item) => normalizeEventIdentifier(item?.sbtAddress || ''))
            .filter(Boolean);
          const createdSurveyIds = activity.createdSurveys
            .map((item) => readCreatedSurveyId(item))
            .filter(Boolean);
          const createdQuestionIds = activity.createdQuestions
            .map((item) => readCreatedQuestionId(item))
            .filter(Boolean);
          const surveyResponseIds = activity.surveyResponses
            .map((item) => readSurveyResponseId(item))
            .filter(Boolean);
          const questionResponseIds = activity.questionResponses
            .map((item) => readQuestionResponseId(item))
            .filter(Boolean);
          report.totalSbtContractsFound += sbtAddressSamples.length;
          report.totalCreatedSurveysFound += createdSurveyIds.length;
          report.totalCreatedQuestionsFound += createdQuestionIds.length;
          report.totalSurveyResponsesFound += surveyResponseIds.length;
          report.totalQuestionResponsesFound += questionResponseIds.length;
          sbtAddressSamples.forEach((value) => pushUniqueSample(report.sampleSbtAddresses, value));
          createdSurveyIds.forEach((value) => pushUniqueSample(report.sampleCreatedSurveyIds, value));
          createdQuestionIds.forEach((value) => pushUniqueSample(report.sampleCreatedQuestionIds, value));
          surveyResponseIds.forEach((value) => pushUniqueSample(report.sampleSurveyResponseIds, value));
          questionResponseIds.forEach((value) => pushUniqueSample(report.sampleQuestionResponseIds, value));

          this.emitProfileScanTelemetry('slug-result', {
            targetAddress: targetLower,
            slug,
            fromBlock: sbtFromBlock,
            sbtFromBlock,
            activityFromBlock,
            currentBlock,
            sbtCount: sbts.length,
            sbtAddresses: sbts
              .map((item) => String(item?.sbtAddress || '').toLowerCase())
              .filter(Boolean)
              .slice(0, 12),
            createdSurveys: activity.createdSurveys.length,
            createdQuestions: activity.createdQuestions.length,
            surveyResponses: activity.surveyResponses.length,
            questionResponses: activity.questionResponses.length,
            slugHadRpcError,
            sbtHadRpcError,
            activityHadRpcError,
            durationMs: Math.max(0, Date.now() - slugStartedAt),
          });
          this.emitProfileScanTelemetry('slug-event-discovery', {
            targetAddress: targetLower,
            slug,
            chainId: Number(chainId || 0),
            sbtCount: sbtAddressSamples.length,
            createdSurveyCount: createdSurveyIds.length,
            createdQuestionCount: createdQuestionIds.length,
            surveyResponseCount: surveyResponseIds.length,
            questionResponseCount: questionResponseIds.length,
            sbtAddresses: sbtAddressSamples.slice(0, 12),
            createdSurveyIds: createdSurveyIds.slice(0, 12),
            createdQuestionIds: createdQuestionIds.slice(0, 12),
            surveyResponseIds: surveyResponseIds.slice(0, 12),
            questionResponseIds: questionResponseIds.slice(0, 12),
            slugHadRpcError,
            durationMs: Math.max(0, Date.now() - slugStartedAt),
          });

          this.emitProfileScanColdDiag('rpc', {
            targetAddress: targetLower,
            slug,
            sbtCount: sbts.length,
            createdSurveys: activity.createdSurveys.length,
            createdQuestions: activity.createdQuestions.length,
            surveyResponses: activity.surveyResponses.length,
            questionResponses: activity.questionResponses.length,
            sbtHadRpcError,
            activityHadRpcError,
            durationMs: Math.max(0, Date.now() - slugStartedAt),
          });

          mainSiteLog.log(
            `[DeepSearch] Group '${slug}': Found ${sbts.length} SBTs, ${activity.createdSurveys.length} Surveys.`
          );

          const hasNewData =
            sbts.length > 0 ||
            activity.createdSurveys.length > 0 ||
            activity.createdQuestions.length > 0 ||
            activity.surveyResponses.length > 0 ||
            activity.questionResponses.length > 0;

          if (hasNewData) {
            newDataWritten = true;
          }

          // C. Update user cache (append delta with dedup)
          if (hasNewData) {
            // Ensure data object exists
            if (!chainEntry.data) {
              chainEntry.data = {
                sbts: [],
                createdSurveys: [],
                createdQuestions: [],
                surveyResponses: [],
                questionResponses: []
              };
            }

            // Dedup SBTs by address so retries do not duplicate entries.
            const existingSbtMap = new Map<string, MainSiteProfileScanSbt>();
            (chainEntry.data.sbts || []).forEach((item) => {
              if (item.sbtAddress) existingSbtMap.set(item.sbtAddress.toLowerCase(), item);
            });

            // Merge new SBTs
            sbts.forEach((newItem) => {
              if (newItem.sbtAddress) {
                // Overwrite or add. If getSBTsForUser returns current state, this keeps it fresh.
                existingSbtMap.set(newItem.sbtAddress.toLowerCase(), newItem);
              }
            });

            chainEntry.data.sbts = Array.from(existingSbtMap.values());

            // Append other activity arrays with dedupe.
            const dedupById = (
              oldArr: MainSiteProfileActivityEntry[] = [],
              newArr: MainSiteProfileActivityEntry[] = []
            ): MainSiteProfileActivityEntry[] => {
              const map = new Map<string, MainSiteProfileActivityEntry>();
              oldArr.forEach((i) => map.set(String(i.id || JSON.stringify(i)), i));
              newArr.forEach((i) => map.set(String(i.id || JSON.stringify(i)), i));
              return Array.from(map.values());
            };

            const buildFallbackMergeKey = (item: MainSiteProfileActivityEntry) => {
              try {
                return `__fallback__${JSON.stringify(item)}`;
              } catch (_) {
                return `__fallback__${String(item || '')}`;
              }
            };
            const readResponseRecency = (item: MainSiteProfileActivityEntry): MainSiteProfileResponseRecency => {
              const row = (item && typeof item === 'object') ? item : {};
              return {
                bn: Number(row.blockNumber ?? row.bn ?? 0) || 0,
                txi: Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0) || 0,
                li: Number(row.logIndex ?? row.li ?? 0) || 0,
                ts: Number(row.timestamp ?? row.ts ?? 0) || 0,
              };
            };
            const compareResponseRecency = (
              incoming: MainSiteProfileResponseRecency,
              existing: MainSiteProfileResponseRecency
            ) => {
              if (incoming.bn > existing.bn) return 1;
              if (incoming.bn < existing.bn) return -1;
              if (incoming.txi > existing.txi) return 1;
              if (incoming.txi < existing.txi) return -1;
              if (incoming.li > existing.li) return 1;
              if (incoming.li < existing.li) return -1;
              if (incoming.ts > existing.ts) return 1;
              if (incoming.ts < existing.ts) return -1;
              return 0;
            };
            const upsertByStableResponseKey = (
              oldArr: MainSiteProfileActivityEntry[] = [],
              newArr: MainSiteProfileActivityEntry[] = [],
              buildKey: (item: MainSiteProfileActivityEntry) => string,
              opts: Record<string, unknown> = {}
            ): MainSiteProfileActivityEntry[] => {
              const preferNewerByRecency = !!(opts && opts.preferNewerByRecency);
              const map = new Map<string, MainSiteProfileActivityEntry>();
              const mergeOne = (item: MainSiteProfileActivityEntry, preferIncomingOnTie = false) => {
                if (item == null) return;
                const key = buildKey(item) || buildFallbackMergeKey(item);
                if (!map.has(key)) {
                  map.set(key, item);
                  return;
                }
                if (!preferNewerByRecency) {
                  if (preferIncomingOnTie) map.set(key, item);
                  return;
                }
                const existing = map.get(key);
                if (!existing) {
                  map.set(key, item);
                  return;
                }
                const cmp = compareResponseRecency(
                  readResponseRecency(item),
                  readResponseRecency(existing)
                );
                if (cmp > 0 || (cmp === 0 && preferIncomingOnTie)) {
                  map.set(key, item);
                }
              };
              oldArr.forEach((item) => mergeOne(item, false));
              // Latest scan rows can replace equal-recency rows to preserve fresh payload fields.
              newArr.forEach((item) => mergeOne(item, true));
              return Array.from(map.values());
            };
            const buildSurveyResponseKey = (item: MainSiteProfileActivityEntry) => {
              const surveyId = String(item?.surveyId || item?.surveyID || item?.id || '').trim().toLowerCase();
              const responder = String(item?.responder || '').trim().toLowerCase();
              if (!surveyId || !responder) return '';
              return `${surveyId}|${responder}`;
            };
            const buildQuestionResponseKey = (item: MainSiteProfileActivityEntry) => {
              const questionId = String(item?.questionId || item?.id || '').trim().toLowerCase();
              const responder = String(item?.responder || '').trim().toLowerCase();
              if (!questionId || !responder) return '';
              return `${questionId}|${responder}`;
            };

            chainEntry.data.createdSurveys = dedupById(chainEntry.data.createdSurveys, activity.createdSurveys);
            chainEntry.data.createdQuestions = dedupById(chainEntry.data.createdQuestions, activity.createdQuestions);

            chainEntry.data.surveyResponses = upsertByStableResponseKey(
              chainEntry.data.surveyResponses,
              activity.surveyResponses,
              buildSurveyResponseKey,
              { preferNewerByRecency: true }
            );
            chainEntry.data.questionResponses = upsertByStableResponseKey(
              chainEntry.data.questionResponses,
              activity.questionResponses,
              buildQuestionResponseKey,
              { preferNewerByRecency: true }
            );
          }

          if (sbtHadRpcError || activityHadRpcError) {
            report.hadRpcErrors = true;
          }
          if (sbtHadRpcError && inAttemptedCoverage) {
            pushUnique(report.failedSlugs, slug);
          }
          if (activityHadRpcError && inAttemptedCoverage) {
            pushUnique(report.failedActivitySlugs, slug);
          }

          if (sbtHadRpcError) {
            chainEntry.sbtScanIncomplete = true;
          } else {
            chainEntry.sbtLastBlockScanned = currentBlock;
            chainEntry.sbtScanIncomplete = false;
            if (sbtFromBlock <= startBlock) {
              chainEntry.sbtBackfillComplete = true;
            }
          }

          if (activityHadRpcError) {
            if (shouldIncludeSurveyActivity) chainEntry.surveyActivityScanIncomplete = true;
            if (shouldIncludeQuestionActivity) chainEntry.questionActivityScanIncomplete = true;
            if (ranFullActivityCoverage) {
              chainEntry.scanIncomplete = true;
            }
          } else {
            if (shouldIncludeSurveyActivity) {
              chainEntry.surveyActivityLastBlockScanned = currentBlock;
              chainEntry.surveyActivityScanIncomplete = false;
            }
            if (shouldIncludeQuestionActivity) {
              chainEntry.questionActivityLastBlockScanned = currentBlock;
              chainEntry.questionActivityScanIncomplete = false;
            }
            if (ranFullActivityCoverage) {
              // Regression guard: partial off-list survey/question fanout can append
              // one activity type, but it must not advance the shared full-activity watermark.
              chainEntry.lastBlockScanned = currentBlock;
              chainEntry.lastScanTimestamp = Math.floor(Date.now() / 1000);
              chainEntry.scanIncomplete = false;
            }
          }

          if (
            !sbtHadRpcError &&
            !activityHadRpcError &&
            attemptedCoverageSlugSet.has(normalizedSlug)
          ) {
            pushUnique(report.scannedSlugs, slug);
          }

          // Write back to persistent storage (User -> Chain -> Data)
          userCache[targetLower][netKey] = chainEntry;
          this.DG.write('userCache', slug, userCache);

          if (!hasNewData) return;

          // D. Sync global caches (update UI)
          const metadataGroupRef = report.useAllSessionsActivityScan
            ? { ...(sessionCfg || {}), slug, __ignoreSessionScanScope: true }
            : slug;

          // 1. Update SBT Cache
          if (sbts.length > 0) {
            // Re-read cache immediately before merge to avoid race with ensureLightSbtUniverse
            let sbtCache = (this.DG.read('sbtCache', slug) || {}) as MainSiteSbtMetadataCache;
            if (!sbtCache[netKey]) sbtCache[netKey] = { sbtList: {}, lastBlock: 0 };
            const sbtNet = sbtCache[netKey] as MainSiteSbtNetworkCache;

            sbts.forEach((item) => {
              const addrLower = String(item.sbtAddress || '').toLowerCase();
              if (!addrLower) return;
              const existing = sbtNet.sbtList[addrLower] || {};

              sbtNet.sbtList[addrLower] = {
                ...existing,
                sbtAddress: item.sbtAddress,
                sbtInfo: { ...(existing.sbtInfo || {}), ...(item.sbtInfo || {}) },
                mintedAddresses: [
                  ...new Set([...(existing.mintedAddresses || []), targetLower])
                ],
                slug: slug,
                blockNumber: currentBlock
              };
            });
            this.DG.write('sbtCache', slug, sbtCache);
          }

          // 2. Update Surveys Cache
          if (
            activity.createdSurveys.length > 0 ||
            activity.surveyResponses.length > 0
          ) {
            let survCache = (this.DG.read('surveysCache', slug) || {}) as MainSiteSurveyMetadataCache;
            if (!survCache[netKey]) {
              survCache[netKey] = {
                surveys: {},
                surveyResponses: {},
                surveyResponsesLatestBlock: {},
              };
            }
            const surveyNet = survCache[netKey] as MainSiteSurveyNetworkCache;
            if (!surveyNet.surveys || typeof surveyNet.surveys !== 'object') {
              surveyNet.surveys = {};
            }
            if (!surveyNet.surveyResponses || typeof surveyNet.surveyResponses !== 'object') {
              surveyNet.surveyResponses = {};
            }

            // Merge Created Surveys
            activity.createdSurveys.forEach(({ id, data }) => {
              const idLower = String(id || '').toLowerCase();
              if (!idLower) return;
              if (data) {
                data.surveyID = idLower;
                surveyNet.surveys[idLower] = data;
              }
            });

            // Merge Responses
            activity.surveyResponses.forEach(({ surveyId, response, responder }) => {
              const sIdLower = String(surveyId || '').toLowerCase();
              const rLower = String(responder || '').toLowerCase();
              if (!sIdLower || !rLower) return;
              if (!surveyNet.surveyResponses[sIdLower]) {
                surveyNet.surveyResponses[sIdLower] = {};
              }
              surveyNet.surveyResponses[sIdLower][rLower] = response as Record<string, unknown>;
            });

            // Backfill response-linked survey metadata for cold user-profile loads.
            const missingSurveyIds = new Set<string>();
            activity.surveyResponses.forEach(({ surveyId }) => {
              const surveyIdLower = String(surveyId || '').toLowerCase();
              if (!surveyIdLower) return;
              if (!surveyNet.surveys[surveyIdLower]) {
                missingSurveyIds.add(surveyIdLower);
              }
            });
            if (missingSurveyIds.size > 0) {
              const rows = await Promise.all(
                Array.from(missingSurveyIds).map(async (surveyIdLower) => {
                  try {
                    const surveyData = await surveyReadsPort.getSurveyDataById(
                      'none',
                      surveyIdLower,
                      metadataGroupRef,
                      { skipDecrypt: true }
                    ) as MainSiteMutableMetadata | null;
                    return { surveyIdLower, surveyData };
                  } catch (_) {
                    return { surveyIdLower, surveyData: null };
                  }
                })
              );
              rows.forEach(({ surveyIdLower, surveyData }) => {
                if (!surveyData || typeof surveyData !== 'object') return;
                surveyData.id = surveyIdLower;
                surveyData.surveyID = surveyIdLower;
                if (!surveyData.sessionSlug) surveyData.sessionSlug = slug;
                if (!surveyData.slug) surveyData.slug = slug;
                surveyNet.surveys[surveyIdLower] = surveyData;
              });
            }
            this.emitProfileScanColdDiag('survey-backfill', {
              targetAddress: targetLower,
              slug,
              missingSurveyCount: missingSurveyIds.size,
              missingSurveyIds: Array.from(missingSurveyIds).slice(0, 6),
              surveyCacheKeys: Object.keys(surveyNet.surveys || {}).length,
              surveyResponseKeys: Object.keys(surveyNet.surveyResponses || {}).length,
            });
            this.DG.write('surveysCache', slug, survCache);
          }

          // 3. Update Questions Cache
          if (
            activity.createdQuestions.length > 0 ||
            activity.questionResponses.length > 0
          ) {
            let qCache = (this.DG.read('questionsCache', slug) || {}) as MainSiteQuestionMetadataCache;
            if (!qCache[netKey]) {
              qCache[netKey] = {
                questions: {},
                questionResponses: {},
                questionResponsesMeta: {},
                arweaveTxCache: {},
                arweaveTxFailureCache: {},
              };
            }
            const questionNet = qCache[netKey] as MainSiteQuestionNetworkCache;
            ensureQuestionArweaveCacheBranches(questionNet);
            if (!questionNet.questions || typeof questionNet.questions !== 'object') {
              questionNet.questions = {};
            }
            if (!questionNet.questionResponses || typeof questionNet.questionResponses !== 'object') {
              questionNet.questionResponses = {};
            }
            if (!questionNet.questionResponsesMeta || typeof questionNet.questionResponsesMeta !== 'object') {
              questionNet.questionResponsesMeta = {};
            }

            // Merge Created Questions
            activity.createdQuestions.forEach(({ id, data }) => {
              const idLower = String(id || '').toLowerCase();
              if (!idLower) return;
              if (data) {
                data.id = idLower;
                questionNet.questions[idLower] = data;
              }
            });

            // Merge Responses
            activity.questionResponses.forEach(
              ({ questionId, response, responder, blockNumber, transactionIndex, logIndex, timestamp }) => {
                const qIdLower = String(questionId || '').toLowerCase();
                const rLower = String(responder || '').toLowerCase();
                if (!qIdLower || !rLower) return;
                if (!questionNet.questionResponses[qIdLower]) {
                  questionNet.questionResponses[qIdLower] = {};
                }
                if (!questionNet.questionResponsesMeta[qIdLower]) {
                  questionNet.questionResponsesMeta[qIdLower] = {};
                }
                const questionResponseMeta = questionNet.questionResponsesMeta[qIdLower] || {};
                const prevMeta = questionResponseMeta[rLower] || {};
                const incomingMeta = {
                  bn: Number(blockNumber ?? currentBlock ?? 0) || 0,
                  txi: Number(transactionIndex ?? 0) || 0,
                  li: Number(logIndex ?? 0) || 0,
                  ts: Number(timestamp ?? 0) || 0,
                };
                const prevRecency = {
                  bn: Number(prevMeta.bn ?? prevMeta.blockNumber ?? 0) || 0,
                  txi: Number(prevMeta.txi ?? prevMeta.transactionIndex ?? prevMeta.txIndex ?? 0) || 0,
                  li: Number(prevMeta.li ?? prevMeta.logIndex ?? 0) || 0,
                  ts: Number(prevMeta.ts ?? prevMeta.timestamp ?? 0) || 0,
                };
                const isNewer =
                  incomingMeta.bn > prevRecency.bn ||
                  (
                    incomingMeta.bn === prevRecency.bn &&
                    (
                      incomingMeta.txi > prevRecency.txi ||
                      (
                        incomingMeta.txi === prevRecency.txi &&
                        (
                          incomingMeta.li > prevRecency.li ||
                          (
                            incomingMeta.li === prevRecency.li &&
                            incomingMeta.ts >= prevRecency.ts
                          )
                        )
                      )
                    )
                );
                if (!isNewer) return;
                questionNet.questionResponses[qIdLower][rLower] = response as Record<string, unknown>;
                questionResponseMeta[rLower] = incomingMeta;
              }
            );

            // Backfill response-linked question metadata for cold user-profile loads.
            const missingQuestionIds = new Set<string>();
            activity.questionResponses.forEach(({ questionId }) => {
              const questionIdLower = String(questionId || '').toLowerCase();
              if (!questionIdLower) return;
              if (!questionNet.questions[questionIdLower]) {
                missingQuestionIds.add(questionIdLower);
              }
            });
            if (missingQuestionIds.size > 0) {
              const decryptContext = this.buildQuestionDecryptContext(slug);
              const rows = await Promise.all(
                Array.from(missingQuestionIds).map(async (questionIdLower) => {
                  try {
                    const questionData = await surveyReadsPort.getQuestionData(
                      'none',
                      questionIdLower,
                      metadataGroupRef,
                      {
                        decryptContext,
                        skipDecrypt: true,
                      }
                    ) as MainSiteMutableMetadata | null;
                    return { questionIdLower, questionData };
                  } catch (_) {
                    return { questionIdLower, questionData: null };
                  }
                })
              );
              rows.forEach(({ questionIdLower, questionData }) => {
                if (!questionData || typeof questionData !== 'object') return;
                questionData.id = questionIdLower;
                questionNet.questions[questionIdLower] = questionData;
              });
            }
            try {
              const freshQuestionsCache = (this.DG.read('questionsCache', slug) || {}) as MainSiteQuestionMetadataCache;
              const freshNet = freshQuestionsCache?.[netKey];
              if (freshNet && typeof freshNet === 'object') {
                mergeQuestionArweaveCacheBranches(questionNet, freshNet);
              }
            } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
            this.emitProfileScanColdDiag('question-backfill', {
              targetAddress: targetLower,
              slug,
              missingQuestionCount: missingQuestionIds.size,
              missingQuestionIds: Array.from(missingQuestionIds).slice(0, 6),
              questionCacheKeys: Object.keys(questionNet.questions || {}).length,
              questionResponseKeys: Object.keys(questionNet.questionResponses || {}).length,
            });
            this.DG.write('questionsCache', slug, qCache);
          }

          // Stream updates into UI as each slug finishes so profile sections can populate incrementally.
          this.queueLocalRevisionUpdate({
            needsSbtRevision: sbts.length > 0,
            needsQuestionResponsesNonce: (
              activity.createdSurveys.length > 0 ||
              activity.surveyResponses.length > 0 ||
              activity.createdQuestions.length > 0 ||
              activity.questionResponses.length > 0
            ),
          });
          } catch (err) {
            report.hadRpcErrors = true;
            pushUnique(report.failedSlugs, slug);
            pushUnique(report.failedActivitySlugs, slug);
            this.emitProfileScanTelemetry('slug-error', {
              targetAddress: targetLower,
              slug,
              error: String(readMainSiteErrorMessage(err) || err),
              durationMs: Math.max(0, Date.now() - slugStartedAt),
            });
          mainSiteLog.warn(`[DeepSearch] Error scanning slug ${slug}:`, err);
          // Continue to next group - do not crash entire scan
        }
      };

      if (report.sbtBurstSize > 1 && allSlugs.length > 1) {
        this.emitProfileScanTelemetry('scan-mode', {
          targetAddress: targetLower,
          mode: 'burst',
          sbtBurstSize: report.sbtBurstSize,
          slugCount: allSlugs.length,
        });
        for (let i = 0; i < allSlugs.length; i += report.sbtBurstSize) {
          const batch = allSlugs.slice(i, i + report.sbtBurstSize);
          await Promise.all(batch.map((slug) => scanOneSlug(slug)));
        }
      } else {
        this.emitProfileScanTelemetry('scan-mode', {
          targetAddress: targetLower,
          mode: 'sequential',
          sbtBurstSize: 1,
          slugCount: allSlugs.length,
        });
        for (const slug of allSlugs) {
          await scanOneSlug(slug);
        }
      }

      report.anyNewData = newDataWritten;
      const totalSkippedScan = (
        report.attemptedSlugs.length > 0 &&
        report.scannedSlugs.length === 0 &&
        report.skippedSlugs.length >= report.attemptedSlugs.length
      );
      const totalActivityFailure = (
        report.attemptedSlugs.length > 0 &&
        report.scannedSlugs.length === 0 &&
        report.failedActivitySlugs.length >= report.attemptedSlugs.length
      );
      const totalSbtFailure = (
        report.attemptedSlugs.length > 0 &&
        report.scannedSlugs.length === 0 &&
        report.failedSlugs.length >= report.attemptedSlugs.length
      );
      report.allActivityFailed = totalActivityFailure;
      report.allSbtFailed = totalSbtFailure;
      if (totalActivityFailure || totalSbtFailure) {
        report.coverageComplete = false;
        report.coverageReason = (
          totalActivityFailure && totalSbtFailure
            ? 'activity-sbt-failure-all-slugs'
            : totalActivityFailure
              ? 'activity-failure-all-slugs'
              : 'sbt-failure-all-slugs'
        );
        report.hadRpcErrors = true;
        this.scheduleProfileScanRetryAfterRegistryHydration(target, report.coverageReason);
      }
      const unresolvedListScopeChainIds = (
        isListScope &&
        totalSkippedScan &&
        report.attemptedSlugs.length > 0 &&
        report.attemptedSlugs.every((slug) => (
          String(report.skippedSlugReasons[String(slug || '')] || '') === 'missing-chain-id'
        ))
      );
      if (unresolvedListScopeChainIds) {
        const registryRecoverableFailure = !!(
          registryStatus?.timedOut ||
          registryStatus?.hadLoadErrors ||
          registryStatus?.hasEntries === false
        );
        if (registryRecoverableFailure) {
          report.coverageComplete = false;
          report.coverageReason = 'list-scope-chain-id-unresolved';
          report.hadRpcErrors = true;
          this.scheduleProfileScanRetryAfterRegistryHydration(target, report.coverageReason);
        }
      }
      this.emitProfileScanTelemetry('scan-event-discovery-summary', {
        targetAddress: targetLower,
        attemptedSlugs: [...report.attemptedSlugs],
        scannedSlugs: [...report.scannedSlugs],
        totalSbtContractsFound: Number(report.totalSbtContractsFound || 0),
        totalCreatedSurveysFound: Number(report.totalCreatedSurveysFound || 0),
        totalCreatedQuestionsFound: Number(report.totalCreatedQuestionsFound || 0),
        totalSurveyResponsesFound: Number(report.totalSurveyResponsesFound || 0),
        totalQuestionResponsesFound: Number(report.totalQuestionResponsesFound || 0),
        sampleSbtAddresses: Array.isArray(report.sampleSbtAddresses) ? report.sampleSbtAddresses.slice(0, 12) : [],
        sampleCreatedSurveyIds: Array.isArray(report.sampleCreatedSurveyIds) ? report.sampleCreatedSurveyIds.slice(0, 12) : [],
        sampleCreatedQuestionIds: Array.isArray(report.sampleCreatedQuestionIds) ? report.sampleCreatedQuestionIds.slice(0, 12) : [],
        sampleSurveyResponseIds: Array.isArray(report.sampleSurveyResponseIds) ? report.sampleSurveyResponseIds.slice(0, 12) : [],
        sampleQuestionResponseIds: Array.isArray(report.sampleQuestionResponseIds) ? report.sampleQuestionResponseIds.slice(0, 12) : [],
      });
      try {
        if (typeof globalThis !== 'undefined') {
          getMainSiteRuntimeGlobal().__CE_PROFILE_SCAN_LAST_EVENT_SUMMARY__ = {
            ts: new Date().toISOString(),
            targetAddress: targetLower,
            attemptedSlugs: [...report.attemptedSlugs],
            scannedSlugs: [...report.scannedSlugs],
            totalSbtContractsFound: Number(report.totalSbtContractsFound || 0),
            totalCreatedSurveysFound: Number(report.totalCreatedSurveysFound || 0),
            totalCreatedQuestionsFound: Number(report.totalCreatedQuestionsFound || 0),
            totalSurveyResponsesFound: Number(report.totalSurveyResponsesFound || 0),
            totalQuestionResponsesFound: Number(report.totalQuestionResponsesFound || 0),
            sampleSbtAddresses: Array.isArray(report.sampleSbtAddresses) ? report.sampleSbtAddresses.slice(0, 12) : [],
            sampleCreatedSurveyIds: Array.isArray(report.sampleCreatedSurveyIds) ? report.sampleCreatedSurveyIds.slice(0, 12) : [],
            sampleCreatedQuestionIds: Array.isArray(report.sampleCreatedQuestionIds) ? report.sampleCreatedQuestionIds.slice(0, 12) : [],
            sampleSurveyResponseIds: Array.isArray(report.sampleSurveyResponseIds) ? report.sampleSurveyResponseIds.slice(0, 12) : [],
            sampleQuestionResponseIds: Array.isArray(report.sampleQuestionResponseIds) ? report.sampleQuestionResponseIds.slice(0, 12) : [],
          };
        }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      this.emitProfileScanTelemetry('scan-complete', {
        ...report,
      });
      mainSiteLog.log(`[DeepSearch] Completed. Triggering UI update.`, report);

      // Force UI update by bumping revisions ONLY if something actually changed
      if (this._mounted) {
        this.setState((prev: MainSiteState) => ({
          sbtCacheRevision: newDataWritten
            ? prev.sbtCacheRevision + 1
            : prev.sbtCacheRevision,
          questionResponsesNonce: newDataWritten
            ? prev.questionResponsesNonce + 1
            : prev.questionResponsesNonce,
          isSBTCacheReady: true,
          isSurveyCacheReady: true,
          isQuestionCacheReady: true,
          isResponsesCacheReady: true
        }));
      }
      return report;
    })();

    this._scanSpecificUserProfileInFlight.set(targetLower, run);
    try {
      return await run;
    } finally {
      if (this._scanSpecificUserProfileInFlight.get(targetLower) === run) {
        this._scanSpecificUserProfileInFlight.delete(targetLower);
      }
    }
  }


  // Tiny flag helpers (boolean-only)
  readFlag: SessionCachePersistenceController['readFlag'] =
    (name, slug) => this._cachePersistenceController.readFlag(name, slug);

  writeFlag: SessionCachePersistenceController['writeFlag'] =
    (name, slug, val) => this._cachePersistenceController.writeFlag(name, slug, val);

  hasPersistedManagedCacheData: SessionCachePersistenceController['hasPersistedManagedCacheData'] =
    (...args) => this._cachePersistenceController.hasPersistedManagedCacheData(...args);

  syncCacheHasLoadedFlagFromPersistent: SessionCachePersistenceController['syncCacheHasLoadedFlagFromPersistent'] =
    (...args) => this._cachePersistenceController.syncCacheHasLoadedFlagFromPersistent(...args);
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
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname || this.props.path || '';
      const aboutRedirectTarget = this.getTemporaryInitialLoadAboutRedirectTarget(currentPath);
      const shouldRedirectForPersistedCache = aboutRedirectTarget?.requiresPersistedCache
        ? !!(
          aboutRedirectTarget.cacheSlug &&
          await this.hasPersistedManagedCacheData(aboutRedirectTarget.cacheSlug)
        )
        : true;
      if (
        aboutRedirectTarget?.path &&
        shouldRedirectForPersistedCache &&
        this.normalizeRoutePath(currentPath) !== aboutRedirectTarget.path
      ) {
        window.history.replaceState(
          {},
          '',
          buildPublicUrl(
            aboutRedirectTarget.path,
            window.location.search || '',
            window.location.hash || ''
          )
        );
        didRedirectInitialLoadToAbout = true;
      }
    }
    this._mounted = true;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      this._sessionRegistryCacheUpdateUnsubscribe = sessionRegistryReadsPort.subscribeToCacheUpdates(
        window,
        this.handleSessionRegistryCacheUpdated
      );
    }
    const mountPathRaw = (
      didRedirectInitialLoadToAbout && typeof window !== 'undefined'
        ? window.location.pathname
        : this.getCurrentPathname()
    ) || '';
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
    if (slug && !this.getDisplaySessionChainId(slug)) {
      this.resolveSessionPathSlug(slug);
    }
    // Track the canonical active group chain id to detect changes without wallet involvement.
    this._lastGroupChainId = this.getSessionChainId(slug);
    this.syncLitHooks();
    this.refreshSessionInfo();
    this.refreshSessionMetaFields();
    this.refreshGroupCredentials();
    try {
      const lit = getGlobalLitHooks();
      const bootstrapChainIds = resolveSessionRegistryBootstrapChainIds({
        scope: this.getSessionScanScope(),
        list: readSessionScanSlugs(),
        activeChainId: (
          Number(this.getDisplaySessionChainId(slug) || 0) ||
          Number(this.props?.network?.id || this.props?.network?.chainId || 0) ||
          0
        ),
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

    // Cache busting (versioned; slug-scoped)
    try {
      // Demo question data and OP Sepolia SBT log-provider inputs both changed.
      // Force a one-time refresh so stale derived caches cannot survive the sync.
      const CURRENT_CACHE_VERSION = '2026-06-19-demo-session-and-sbt-cache-sync-v1';
      const VERSION_KEY = 'appCacheVersion';
      const storedVersion = localStorage.getItem(VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) {
        const cacheRefreshSlugs = [...new Set([
          ...getAllSessionSlugs(),
          slug,
        ].filter(Boolean))];
        let hadPersistedManagedCache = false;
        // Only bust derived/rehydratable caches; preserve user-authored caches.
        for (const s of cacheRefreshSlugs) {
          hadPersistedManagedCache = (await this.hasPersistedManagedCacheData(s)) || hadPersistedManagedCache;
          await Promise.all(
            DG_PRIMARY_ROUTE_CACHE_NAMES.map((namespace: string) => this.DG.remove(namespace, s))
          );
          await this.syncCacheHasLoadedFlagFromPersistent(s, { force: true });
        }
        localStorage.setItem(VERSION_KEY, CURRENT_CACHE_VERSION);
        mainSiteLog.log('[CacheBust] Cleared caches for all groups due to version change:', {
          from: storedVersion, to: CURRENT_CACHE_VERSION
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

    mainSiteLog.log("this.props.urlExtension:", this.props.urlExtension);

    // Prioritize user load (deep search) if on a user profile
    const targetUser = this.getUserAddressFromPath(bootstrapPath);
    if (targetUser) {
      mainSiteLog.log(`[MainSite] User Profile detected (${targetUser}). Prioritizing Deep Search.`);
      // Best effort: warm active-chain registry cache without adding another blocking wait.
      try {
        void Promise.resolve(this.ensureRegistryHydratedForProfileScan()).catch(() => null);
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      // Hold other RPC-heavy initialization until the user scan completes.
      try {
        await this.scanSpecificUserProfilePriority(targetUser);
      } catch (err) {
        mainSiteLog.warn("[MainSite] Initial deep search failed:", err);
      }
    }

    // Cross-tab cache sync for IDB-backed caches.
    try {
      this._cacheUpdateUnsubscribe = subscribeCacheUpdates(this.handleCrossTabCacheUpdateEvent);
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

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
    mainSiteLog.log(isDemoPath ? "Initializing caches (demo prioritized order)..." : "Initializing caches sequentially...");


    const sessionNet = this.getInitializableSessionNetwork(slug, pathname);
    mainSiteLog.log("session network (derived):", sessionNet);
    if (sessionNet && sessionNet.id) {
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
          mainSiteLog.log("Initialization complete (SBT-detail path).");

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
          mainSiteLog.log("Initialization complete (SBT-first path).");
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
          mainSiteLog.log("Question cache initialized (questions-first path).");

          // Lightweight SBT metadata so gate labels/icons can render without a full scan.
          await this.initializeSbtCache({ mode: 'partial' });
          mainSiteLog.log("SBT cache partial metadata ready (questions-first path).");

          // Keep caches fresh while deferred work continues.
          this.startSbtEventListener();
          this.startSurveyAndQuestionEventListener();

          await this.fetchQuestionResponsesChunked(); // depends on question cache
          mainSiteLog.log("Question responses fetched (questions-first path).");

          // Surveys are not needed to render the questions tool, so load after responses.
          await this.initializeSurveyCache();
          this.setReadinessStateIfChanged({ isSurveyCacheReady: true });
          mainSiteLog.log("Survey cache initialized (after questions/responses).");

          // Defer full SBT scan so /questions feels snappy even in non-demo mode.
          (async () => {
            try {
              if (!this.shouldAutoRunFullSbtScan({ pathname })) return;
              await new Promise<void>((resolve) => setTimeout(resolve, 250));
              await this.initializeSbtCache({ mode: 'full' });
              this.setReadinessStateIfChanged({ isSBTCacheReady: true });
              this.startSbtEventListener();
              mainSiteLog.log("SBT cache initialized (deferred full scan, questions-first path).");
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
        mainSiteLog.log("Question cache initialized (demo priority).");

        // Very light partial pass so group names/icons render fast
        await this.initializeSbtCache({ mode: 'partial' });
        // partial pass sets isSBTCacheReady internally to unblock UI
        mainSiteLog.log("SBT cache partial metadata ready (demo priority).");

        // Keep minted counts and membership-sensitive UI fresh on first demo load.
        this.startSbtEventListener();
        this.startSurveyAndQuestionEventListener();

        await this.fetchQuestionResponsesChunked(); // Depends on question cache
        mainSiteLog.log("Question responses fetched (demo priority).");

        await this.initializeSurveyCache();
        this.setReadinessStateIfChanged({ isSurveyCacheReady: true });
        mainSiteLog.log("Survey cache initialized (after questions/responses).");

        // Do NOT run full SBT here; checkAllCachesReady() will trigger deferred full scan.
      } else {
        // Original order preserved for non-demo, non-/sbts paths
        await this.initializeSurveyCache();
        this.setReadinessStateIfChanged({ isSurveyCacheReady: true });
        mainSiteLog.log("Survey cache initialized.");

        await this.initializeQuestionCache();
        mainSiteLog.log("Question cache initialized.");

        this.startSurveyAndQuestionEventListener();

        await this.fetchQuestionResponsesChunked(); // Depends on question cache
        mainSiteLog.log("Question responses fetched.");

        if (this.shouldAutoRunFullSbtScan({ pathname })) {
          await this.initializeSbtCache({ mode: 'full' }); // explicit full to keep behavior identical
        } else {
          await this.initializeSbtCache({ mode: 'partial' });
        }
        this.setReadinessStateIfChanged({ isSBTCacheReady: true });
        this.startSbtEventListener();
        mainSiteLog.log("SBT cache initialized.");
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
      const slugsToRefresh = Array.from(
        new Set([activeSlug, questionSlug].filter(isMainSitePresent))
      );
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
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    if (this.props.socket !== undefined) {
    }

    try {
      if (typeof this._cacheUpdateUnsubscribe === 'function') {
        this._cacheUpdateUnsubscribe();
      }
      this._cacheUpdateUnsubscribe = null;
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._cachePersistenceController.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._cacheReadinessController.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._scanPolicy?.destroy?.();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._profileScanController.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._sbtCacheController.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._surveyCacheController?.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._questionCacheController?.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._responseHydrationController?.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
    try {
      this._sessionMetaRefreshController?.destroy();
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

    try {
      if (this._queuedSurveyGroupScanTimer) clearTimeout(this._queuedSurveyGroupScanTimer);
      this._queuedSurveyGroupScanTimer = null;
      this._queuedSurveyGroupScanId = null;
      this._queuedSurveyGroupScanHintedSlug = '';
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

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
    if (sessionContextChanged) {
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
    const readinessSignalsChanged =
      authOrProviderChanged ||
      litReadyChanged ||
      entitlementChanged;
    const authBecameUnavailable =
      !!(prevProps.loginComplete && prevProps.account) &&
      !(this.props.loginComplete && this.props.account);

    if (authBecameUnavailable) {
      this._lastProcessedQuestionIdFromPath = '';
      this._lastProcessedQuestionSlugFromPath = null;
    }

    if (this.props.loginComplete && this.props.account) {
      const prevPath = this.getEffectiveRoutePath(
        prevProps.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
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
        const slugsToCheck = Array.from(
          new Set([activeSlug, questionSlug].filter(isMainSitePresent))
        );

        slugsToCheck.forEach((slug: string) => {
          const masked = this.hasMaskedQuestionPayloadInCache(slug);
          const shouldRetry = shouldRetryMaskedQuestionRefresh({
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
          }) || (masked && (authOrProviderChanged || litReadyChanged || entitlementChanged));

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
        mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: group chain change detected', { old: this._lastGroupChainId, new: currChainId });
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
    const sessionSlugNeedsSync =
      !!currSessionToken &&
      ((this.getSessionSlugFromState()) !== currSlugFromPath);

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
            this.isSbtListRoutePath(currPath) ||
            currPath.startsWith('/sbt/') ||
            currPath.startsWith('/group/');
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
            this.checkAllCachesReady
          );
        }
      })();
    }

    const nextDerivedActiveSlug = this.getBootstrapActiveSessionSlug(currPath, currSearch);
    if (
      !currPath.startsWith('/session/') &&
      this.props.activeSessionSlug !== nextDerivedActiveSlug
    ) {
      this.props.changeActiveSessionSlug(nextDerivedActiveSlug);
    }

    const prevSbtAddr = this.getSbtAddressFromPath(prevPath);
    const currSbtAddr = this.getSbtAddressFromPath(currPath);
    if (currSbtAddr && currSbtAddr !== prevSbtAddr) {
      this.resolvePinnedSbtDetailRouteSlug(currSbtAddr, {
        search: currSearch,
        fallbackSlug: nextDerivedActiveSlug,
      }).then((detailSlug: string) => {
        this.setState(buildSbtDetailRouteStatePatch({ detailSlug, address: currSbtAddr }));
      }).catch((e: unknown) => { mainSiteLog.warn('MainSite: fallback', e); });
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

    const parts = fullPath.split("?")[0].split("/").filter(Boolean);
    // Check for ["survey", "0x..."]
    if (parts[0] === "survey" && parts[1] && validSurveyIdRe.test(parts[1])) {
      surveyID = parts[1].toLowerCase();
    }

    if (!surveyID) return;

    // 1. Check if we are already scanning or have failed for this ID to prevent loops
    if (this.state.isScanningForGroup === surveyID || this.state.scanFailedFor === surveyID) {
      return;
    }

    // 2. Check if data exists in CURRENT context (Cache or Config)
    const currentSlug = this.getSessionSlugFromState();
    const cache = this.readDgRecord(
      'surveysCache',
      currentSlug,
      { clone: false }
    ) as MainSiteSurveyMetadataCache | null;
    const netKey = String(this.getSessionChainId(currentSlug));

    // Check Cache
    const inCache = !!cache?.[netKey]?.surveys?.[surveyID];

    // Check Config (Highlighted list)
    const cfg = this.getSessionCfg(currentSlug);
    const inConfig = Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
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
    mainSiteLog.log("handleNetworkChange() - re-initializing caches for new network");
    const cacheReinitRunToken = this.startCacheReinitRun();
    const isCacheReinitRunActive = () => this.isCacheReinitRunActive(cacheReinitRunToken);
    this.setReadinessStateIfChanged({
      isSBTCacheReady: false,
      isSurveyCacheReady: false,
      isQuestionCacheReady: false,
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

  checkAllCachesReady: SessionCacheReadinessController['checkAllCachesReady'] =
    (...args) => this._cacheReadinessController.checkAllCachesReady(...args);

  ensureSessionRouteSbtDiscovery: SessionSbtCacheController['ensureSessionRouteSbtDiscovery'] =
    (...args) => this._sbtCacheController.ensureSessionRouteSbtDiscovery(...args);

  sendMessageToServer = () => {
  };

  ensureLightSbtDiscovery: SessionSbtCacheController['ensureLightSbtDiscovery'] =
    (...args) => this._sbtCacheController.ensureLightSbtDiscovery(...args);

  ensureLightSbtUniverse: SessionSbtCacheController['ensureLightSbtUniverse'] =
    (...args) => this._sbtCacheController.ensureLightSbtUniverse(...args);

  mergeSbtCountMaps: SessionSbtCacheController['mergeSbtCountMaps'] =
    (...args) => this._sbtCacheController.mergeSbtCountMaps(...args);

  mergeSbtCountsPayload: SessionSbtCacheController['mergeSbtCountsPayload'] =
    (...args) => this._sbtCacheController.mergeSbtCountsPayload(...args);

  normalizeSbtHistorySummary: SessionSbtCacheController['normalizeSbtHistorySummary'] =
    (...args) => this._sbtCacheController.normalizeSbtHistorySummary(...args);

  normalizeSbtCountMap: SessionSbtCacheController['normalizeSbtCountMap'] =
    (...args) => this._sbtCacheController.normalizeSbtCountMap(...args);

  sumSbtCountMap: SessionSbtCacheController['sumSbtCountMap'] =
    (...args) => this._sbtCacheController.sumSbtCountMap(...args);

  seedSbtCountMapFromLegacyAddresses: SessionSbtCacheController['seedSbtCountMapFromLegacyAddresses'] =
    (...args) => this._sbtCacheController.seedSbtCountMapFromLegacyAddresses(...args);

  hydrateLegacySbtCountState: SessionSbtCacheController['hydrateLegacySbtCountState'] =
    (...args) => this._sbtCacheController.hydrateLegacySbtCountState(...args);

  buildSbtHistorySummaryFromCounts: SessionSbtCacheController['buildSbtHistorySummaryFromCounts'] =
    (...args) => this._sbtCacheController.buildSbtHistorySummaryFromCounts(...args);

  getCurrentHolderAddressesFromCounts: SessionSbtCacheController['getCurrentHolderAddressesFromCounts'] =
    (...args) => this._sbtCacheController.getCurrentHolderAddressesFromCounts(...args);

  initializeSbtCache: SessionSbtCacheController['initializeSbtCache'] =
    (...args) => this._sbtCacheController.initializeSbtCache(...args);

  initializeSbtCacheWithGeneralBackfill: SessionSbtCacheController['initializeSbtCacheWithGeneralBackfill'] =
    (...args) => this._sbtCacheController.initializeSbtCacheWithGeneralBackfill(...args);

  initializeSbtCacheForGroup: SessionSbtCacheController['initializeSbtCacheForGroup'] =
    (...args) => this._sbtCacheController.initializeSbtCacheForGroup(...args);

  refreshSbtData: RefreshSbtDataFn = (sbtAddress, slug, options) =>
    this._sbtCacheController.refreshSbtData(sbtAddress, slug, options);

  refreshSbtDataForGroup: RefreshSbtDataForGroupFn = (slug, sbtAddress, options) =>
    this._sbtCacheController.refreshSbtDataForGroup(slug, sbtAddress, options);

  startSbtEventListener: SessionSbtCacheController['startSbtEventListener'] =
    (...args) => this._sbtCacheController.startSbtEventListener(...args);

  startSbtEventListenerForGroup: SessionSbtCacheController['startSbtEventListenerForGroup'] =
    (...args) => this._sbtCacheController.startSbtEventListenerForGroup(...args);

  startSbtDetailInstanceListenerForGroup: SessionSbtCacheController['startSbtDetailInstanceListenerForGroup'] =
    (...args) => this._sbtCacheController.startSbtDetailInstanceListenerForGroup(...args);

  onNewSbtEventDetected: SessionSbtCacheController['onNewSbtEventDetected'] =
    (...args) => this._sbtCacheController.onNewSbtEventDetected(...args);

  onNewSbtEventDetectedForGroup: SessionSbtCacheController['onNewSbtEventDetectedForGroup'] =
    (...args) => this._sbtCacheController.onNewSbtEventDetectedForGroup(...args);

  onSbtCreatedDetected: SessionSbtCacheController['onSbtCreatedDetected'] =
    (...args) => this._sbtCacheController.onSbtCreatedDetected(...args);

  onSbtCreatedDetectedForGroup: SessionSbtCacheController['onSbtCreatedDetectedForGroup'] =
    (...args) => this._sbtCacheController.onSbtCreatedDetectedForGroup(...args);

  onSbtIssuedDetected: SessionSbtCacheController['onSbtIssuedDetected'] =
    (...args) => this._sbtCacheController.onSbtIssuedDetected(...args);

  onSbtIssuedDetectedForGroup: SessionSbtCacheController['onSbtIssuedDetectedForGroup'] =
    (...args) => this._sbtCacheController.onSbtIssuedDetectedForGroup(...args);

  onSbtActivityDetected: SessionSbtCacheController['onSbtActivityDetected'] =
    (...args) => this._sbtCacheController.onSbtActivityDetected(...args);

  onSbtActivityDetectedForGroup: SessionSbtCacheController['onSbtActivityDetectedForGroup'] =
    (...args) => this._sbtCacheController.onSbtActivityDetectedForGroup(...args);

  onSbtTransferDetected: SessionSbtCacheController['onSbtTransferDetected'] =
    (...args) => this._sbtCacheController.onSbtTransferDetected(...args);

  onSbtTransferDetectedForGroup: SessionSbtCacheController['onSbtTransferDetectedForGroup'] =
    (...args) => this._sbtCacheController.onSbtTransferDetectedForGroup(...args);

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

  initializeSurveyCacheForGroup: SessionSurveyCacheController['initializeSurveyCacheForGroup'] =
    (...args) => this._surveyCacheController.initializeSurveyCacheForGroup(...args);


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

  initializeQuestionCacheForGroup: SessionQuestionCacheController['initializeQuestionCacheForGroup'] =
    async (slug, opts) => {
      const normalizedSlug = normalizeSessionSlug(slug || '');
      if (
        this.isBuiltInDemoSessionRoutePath() &&
        (normalizedSlug === 'demo' || normalizedSlug === '')
      ) {
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

  fetchQuestionResponsesChunkedForGroup: SessionResponseHydrationController['fetchQuestionResponsesChunkedForGroup'] =
    (...args) => this._responseHydrationController.fetchQuestionResponsesChunkedForGroup(...args);

  startSurveyAndQuestionEventListener: SessionSurveyCacheController['startSurveyAndQuestionEventListener'] =
    (...args) => this._surveyCacheController.startSurveyAndQuestionEventListener(...args);

  startSurveyAndQuestionEventListenerForGroup: SessionSurveyCacheController['startSurveyAndQuestionEventListenerForGroup'] =
    (...args) => this._surveyCacheController.startSurveyAndQuestionEventListenerForGroup(...args);


  onNewSurveyEventDetected = async (event: MainSiteSurveyEventLike) => this.onNewSurveyEventDetectedForGroup(this.getActiveSessionSlug(), event);

  onNewSurveyEventDetectedForGroup = async (slug: string, event: MainSiteSurveyEventLike) => { // event: { type, ..., blockNumber }
    if (getMainSiteRuntimeWindow()?.ENABLE_RPC_DEBUG_LOGGING === true) mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: onNewSurveyEventDetectedForGroup invoked', { event, slug });
    mainSiteLog.log("onNewSurveyEventDetectedForGroup() – invoked with event:", event);

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
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }

        if (readProvider && typeof readProvider.getTransactionReceipt === 'function') {
          try {
              const receipt = await readProvider.getTransactionReceipt(event.transactionHash);
              eventBlockNumber = receipt?.blockNumber as number;
          } catch (e) {
              mainSiteLog.error("Failed to get block number from transaction hash for survey event", e);
              eventBlockNumber = eventBlockWindow.toBlock;
          }
        } else {
          eventBlockNumber = eventBlockWindow.toBlock;
        }
    } else if (!eventBlockNumber) {
        eventBlockNumber = eventBlockWindow.toBlock;
    }

    let surveysCache = (
      this.readDgRecord('surveysCache', slug) || {}
    ) as Record<string, MainSiteSurveyNetworkCache | undefined>;
    this.mergeLegacyNumericNetworkKey(surveysCache, networkID);
    if (!surveysCache[networkID]) {
      surveysCache[networkID] = {
        surveysLatestBlock: initialLastBlockDefault,
        surveys: {}, surveyResponses: {}, surveyResponsesLatestBlock: {}
      };
    }
    let currentSurveyNetworkCache = surveysCache[networkID] as MainSiteSurveyNetworkCache;
    if (typeof currentSurveyNetworkCache.surveyResponsesLatestBlock !== 'object' || currentSurveyNetworkCache.surveyResponsesLatestBlock === null) {
        currentSurveyNetworkCache.surveyResponsesLatestBlock = {};
    }
    if (!currentSurveyNetworkCache.surveys) currentSurveyNetworkCache.surveys = {};


    let questionsCache = (
      this.readDgRecord('questionsCache', slug) || {}
    ) as Record<string, MainSiteQuestionNetworkCache | undefined>;
    this.mergeLegacyNumericNetworkKey(questionsCache, networkID);
    if (!questionsCache[networkID]) {
      questionsCache[networkID] = {
        questionsLatestBlock: initialLastBlockDefault,
        questionsDiscoveryCheckpointBlock: initialLastBlockDefault,
        questions: {}, questionResponses: {},
        questionResponsesMeta: {},                              // ensure meta map exists
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
    if (typeof currentQuestionNetworkCache.questionResponsesMeta !== 'object' || currentQuestionNetworkCache.questionResponsesMeta === null) {
      currentQuestionNetworkCache.questionResponsesMeta = {};
    }
    ensureQuestionArweaveCacheBranches(currentQuestionNetworkCache);
    const mergeFreshQuestionArweaveBranches = () => {
      try {
        const freshCache = (
          this.readDgRecord('questionsCache', slug) || {}
        ) as Record<string, MainSiteQuestionNetworkCache | undefined>;
        this.mergeLegacyNumericNetworkKey(freshCache, networkID);
        const freshNet = freshCache[networkID];
        if (!freshNet || typeof freshNet !== 'object') return;
        mergeQuestionArweaveCacheBranches(currentQuestionNetworkCache, freshNet);
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    };

    if (event.type === 'SurveyAdded') {
      if (eventBlockNumber > (currentSurveyNetworkCache.surveysLatestBlock || 0) ) {
        this.setReadinessStateIfChanged({ isSurveyCacheReady: false, isQuestionCacheReady: false });

        const surveyID = event.surveyId.toLowerCase();
        mainSiteLog.log(`Processing SurveyAdded event for surveyID: ${surveyID}`);

        try {
          const surveyData = await surveyReadsPort.getSurveyDataById('none', surveyID, slug) as MainSiteMutableMetadata | null;

          if (surveyData) {
            surveyData.surveyID = surveyID; // Ensure surveyID is present and lowercase
            if (!surveyData.questionIDs) surveyData.questionIDs = [];
            if (!surveyData.creator) surveyData.creator = "";
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
              try { delete currentSurveyNetworkCache.surveys[surveyID]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
              this.writeSurveyMetadataToCache(targetSurveySlug, surveyID, preparedSurveyData, eventBlockNumber, networkID, {
                enforceScopedIsolation: true,
              });
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
                      const questionData = await surveyReadsPort.getQuestionData('none', qid, slug, {
                        decryptContext: this.buildQuestionDecryptContext(slug),
                        skipDecrypt: true,
                      }) as MainSiteMutableMetadata | null;
                      return { qid, questionData };
                    } catch (err) {
                      mainSiteLog.error(`Error fetching question data for ${qid}:`, err);
                      return { qid, questionData: null };
                    }
                  })
                );

                results.forEach(({ qid, questionData }: MainSiteQuestionFetchResult) => {
                  if (questionData) {
                    questionData.id = qid;
                    const preparedQuestion = this.buildMetadataSessionCacheEnvelope(questionData, targetSurveySlug || slug, {
                      scoped: true,
                    });
                    const preparedQuestionData = {
                      ...questionData,
                      ...preparedQuestion.metadata,
                    };
                    const targetQuestionSlug = preparedQuestion.targetSlug;
                    if (targetQuestionSlug === slug) {
                      currentQuestionNetworkCache.questions[qid] = preparedQuestionData;
                    } else {
                      try { delete currentQuestionNetworkCache.questions[qid]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
                      this.writeQuestionMetadataToCache(targetQuestionSlug, qid, preparedQuestionData, networkID, {
                        enforceScopedIsolation: true,
                      });
                    }
                    mainSiteLog.log(`Question ${qid} data fetched and added to local cache object.`);
                  } else {
                    allQuestionsFetchedSuccessfully = false;
                  }
                });
              }
            } else {
              mainSiteLog.log(`Survey ${surveyID} has no associated question IDs.`);
            }

            currentSurveyNetworkCache.surveysLatestBlock = eventBlockNumber;
            this.DG.write('surveysCache', slug, surveysCache);

            if (surveyData.questionIDs && surveyData.questionIDs.length > 0) {
                currentQuestionNetworkCache.questionsLatestBlock = Math.max(currentQuestionNetworkCache.questionsLatestBlock || 0, eventBlockNumber);
            }
            mergeFreshQuestionArweaveBranches();
            this.DG.write('questionsCache', slug, questionsCache);

            mainSiteLog.log(`SurveyAdded event fully processed for ${surveyID}. Caches updated. surveysLatestBlock: ${eventBlockNumber}, questionsLatestBlock: ${currentQuestionNetworkCache.questionsLatestBlock}.`);

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
                mainSiteLog.warn(`SurveyAdded: could not fetch all questions for survey ${surveyID} during this event. The questionsCache reflects what was obtainable.`);
            }

          } else {
            mainSiteLog.warn(`Failed to fetch survey data for ${surveyID} during SurveyAdded event. Survey data is null.`);
            this.setReadinessStateIfChanged({ isSurveyCacheReady: true, isQuestionCacheReady: true }, this.checkAllCachesReady);
          }
        } catch (error) {
          mainSiteLog.error(`Error processing SurveyAdded event for ${surveyID}:`, error);
          this.setReadinessStateIfChanged({ isSurveyCacheReady: true, isQuestionCacheReady: true }, this.checkAllCachesReady);
        }
      } else {
        mainSiteLog.log(`SurveyAdded event for surveyID ${event.surveyId} is old or already processed. Skipping loading state changes.`);
      }
    } else if (event.type === 'QuestionsAdded') {
      if (eventBlockNumber > (currentQuestionNetworkCache.questionsLatestBlock || 0) ) {
        this.setReadinessStateIfChanged({ isQuestionCacheReady: false });
        mainSiteLog.log(`Processing QuestionsAdded event with ${event.questionIds.length} questions.`);

        try {
          const idsLower = event.questionIds.map((hex: string) => hex.toLowerCase());
          const missing = idsLower.filter((qid: string) => !currentQuestionNetworkCache.questions[qid]);

          let allNewQuestionsFetchedSuccessfully = true;
          if (missing.length > 0) {
            const results = await Promise.all(
              missing.map(async (qid: string): Promise<MainSiteQuestionFetchResult> => {
                try {
                  const questionData = await surveyReadsPort.getQuestionData('none', qid, slug, {
                    decryptContext: this.buildQuestionDecryptContext(slug),
                    skipDecrypt: true,
                  }) as MainSiteMutableMetadata | null;
                  return { qid, questionData };
                } catch (e) {
                  mainSiteLog.warn(`Error fetching new question ${qid} in QuestionsAdded:`, e);
                  return { qid, questionData: null };
                }
              })
            );
            results.forEach(({ qid, questionData }: MainSiteQuestionFetchResult) => {
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
                } else {
                  try { delete currentQuestionNetworkCache.questions[qid]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
                  this.writeQuestionMetadataToCache(targetQuestionSlug, qid, preparedQuestionData, networkID, {
                    enforceScopedIsolation: true,
                  });
                }
                mainSiteLog.log(`New question ${qid} data fetched and added to local cache object.`);
              } else {
                allNewQuestionsFetchedSuccessfully = false;
              }
            });
          }

          currentQuestionNetworkCache.questionsLatestBlock = eventBlockNumber;
          mergeFreshQuestionArweaveBranches();
          this.DG.write('questionsCache', slug, questionsCache);
          mainSiteLog.log(`QuestionsAdded event processed. questionsLatestBlock updated to ${eventBlockNumber}.`);

          // Increment nonce so downstream components (PileModeView, OnePageSession) detect the new questions
          this.setReadinessStateIfChanged({ isQuestionCacheReady: true });
          this.queueLocalRevisionUpdate({
            needsQuestionResponsesNonce: true,
            checkAllCachesReady: true,
          });
          if (!allNewQuestionsFetchedSuccessfully) {
            mainSiteLog.warn("QuestionsAdded: Not all *newly specified* questions in this event were fetched successfully and added to cache.");
          }

        } catch (error) {
          mainSiteLog.error(`Error processing QuestionsAdded event:`, error);
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
            mainSiteLog.log(`Fetching survey response for survey ${surveyIdFromEvent}, responder ${responderAddressLower} due to ResponsesSubmitted event.`);
            const surveyResponseData = await surveyReadsPort.getSurveyResponse('none', responderAddressLower, surveyIdFromEvent, slug);
            if (surveyResponseData) {
                if (!currentSurveyNetworkCache.surveyResponses[surveyIdFromEvent]) {
                  currentSurveyNetworkCache.surveyResponses[surveyIdFromEvent] = {};
                }
                currentSurveyNetworkCache.surveyResponses[surveyIdFromEvent][responderAddressLower] = surveyResponseData;
                currentSurveyNetworkCache.surveyResponsesLatestBlock[surveyIdFromEvent] = eventBlockNumber;
                surveyCacheUpdated = true;
                mainSiteLog.log(`Survey response for ${surveyIdFromEvent} by ${responderAddressLower} updated in cache.`);
            } else {
                mainSiteLog.log(`No survey response data found for survey ${surveyIdFromEvent}, responder ${responderAddressLower}.`);
            }
        } else {
            mainSiteLog.log(`ResponsesSubmitted event for survey ${surveyIdFromEvent} (block ${eventBlockNumber}) is not newer than last processed block (${currentSurveyNetworkCache.surveyResponsesLatestBlock[surveyIdFromEvent] || 0}). Skipping survey response update.`);
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
          (
            bn === prevBn &&
            (
              eventTransactionIndex > prevTxi ||
              (
                eventTransactionIndex === prevTxi &&
                (
                  eventLogIndex > prevLi ||
                  (
                    eventLogIndex === prevLi &&
                    eventTimestamp >= prevTs
                  )
                )
              )
            )
          );
        if (isNewer) {
          qIdsToFetch.push(qId);
        } else {
          mainSiteLog.log(`[ResponsesSubmitted][recency-guard] STALE ignored for qId=${qId}, responder=${responderAddressLower} (prev bn/tx/li/ts=${prevBn}/${prevTxi}/${prevLi}/${prevTs}, incoming bn/tx/li/ts=${bn}/${eventTransactionIndex}/${eventLogIndex}/${eventTimestamp})`);
        }
      });

      if (qIdsToFetch.length > 0) {
        let shouldForceResponseBackfill = false;
        const results = await Promise.all(
          qIdsToFetch.map(async (qId: string): Promise<MainSiteResponseFetchResult> => {
            const data = await surveyReadsPort.getResponse('none', responderAddressLower, qId, slug, {
              forceArweaveFetch: true,
            }) as Record<string, unknown> | null;
            if (!data) shouldForceResponseBackfill = true;
            return { qId, data };
          })
        );

        let acceptedAny = false;
        results.forEach(({ qId, data }: MainSiteResponseFetchResult) => {
          if (!data) return;
          const responseByResponder = currentQuestionNetworkCache.questionResponses[qId] || {};
          currentQuestionNetworkCache.questionResponses[qId] = responseByResponder;
          responseByResponder[responderAddressLower] = data;
          const responseMetaByResponder = currentQuestionNetworkCache.questionResponsesMeta[qId] || {};
          currentQuestionNetworkCache.questionResponsesMeta[qId] = responseMetaByResponder;
          responseMetaByResponder[responderAddressLower] = {
            bn,
            txi: eventTransactionIndex,
            li: eventLogIndex,
            ts: eventTimestamp,
          };
          acceptedAny = true;
          mainSiteLog.log(`[ResponsesSubmitted][recency-guard] ACCEPTED for qId=${qId}, responder=${responderAddressLower} (bn/tx/li/ts=${bn}/${eventTransactionIndex}/${eventLogIndex}/${eventTimestamp}).`);
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

      if (surveyCacheUpdated) this.DG.write('surveysCache', slug, surveysCache);
      if (questionCacheUpdated) {
        mergeFreshQuestionArweaveBranches();
        this.DG.write('questionsCache', slug, questionsCache);
      }
      if (surveyCacheUpdated || questionCacheUpdated) {
        mainSiteLog.log("ResponsesSubmitted event processed; caches updated (survey and/or questions).");
        this.queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
      }
    }
  };






  // React routing

  _renderDebateRoute = (fullPath: string) => (
    <ExperimentalStub
      featureName="Debate view"
      path={fullPath}
    />
  );

  _renderBookmarksRoute = () => (
    <Suspense fallback={<LazyFallback label="Loading Bookmarks..." />}>
      <div data-testid={E2E_TESTIDS.PAGE_BOOKMARKS_ROOT}>
        <BookmarksPage />
      </div>
    </Suspense>
  );

  _renderAboutRoute = () => (
    <Suspense fallback={<LazyFallback label="Loading..." />}>
      <div data-testid={E2E_TESTIDS.PAGE_ABOUT_ROOT}>
        <AboutPage />
      </div>
    </Suspense>
  );

  _renderDemosRoute = () => (
    <Suspense fallback={<div />}>
      <DemosIndex />
    </Suspense>
  );

  _renderMatrixRoute = () => (
    <Suspense fallback={<LazyFallback label="Loading..." />}>
      <div data-testid={E2E_TESTIDS.PAGE_MATRIX_ROOT}>
        <RiskMatrixDemo />
      </div>
    </Suspense>
  );

  _renderAgentRoute = () => {
    if (process.env.NODE_ENV === 'production') {
      return <div>Page not found or invalid path.</div>;
    }
    return (
      <Suspense fallback={<LazyFallback label="Loading Agent..." />}>
        <div data-testid={E2E_TESTIDS.PAGE_AGENT_ROOT}>
          <AgentPage />
        </div>
      </Suspense>
    );
  };

  _renderSimUserRoute = (fullPath: string, defaultSessionNetwork: ReturnType<typeof _getSessionNetwork>) => {
    const simUsername = fullPath.slice(4);
    return (
      <Suspense fallback={<LazyFallback label="Loading profile..." minHeight="40vh" />}>
        <SimulatedUserPage simUsername={simUsername} provider={this.props.provider} network={defaultSessionNetwork} />
      </Suspense>
    );
  };

  _renderAtlasRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug, defaultSessionNetwork, routeDemoMode } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Atlas..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_ATLAS_ROOT}>
            <DebateMap
              // Pass necessary context props
              account={this.props.account}
              provider={this.props.provider}
              network={defaultSessionNetwork}
              litHooks={this.state.litHooks}
              toggleLoginModal={this.props.toggleLoginModal}
              loginComplete={this.props.loginComplete}
              activeSessionSlug={defaultSlug}

              // Pass Cache props
              isSBTCacheReady={this.state.isSBTCacheReady}
              isSurveyCacheReady={this.state.isSurveyCacheReady}
              isQuestionCacheReady={this.state.isQuestionCacheReady}
              sbtCacheRevision={this.state.sbtCacheRevision}
              questionResponsesNonce={this.state.questionResponsesNonce}
              questionScanProgress={this.state.questionScanProgress}

              // Pass Data Refresh functions
              refreshSbtData={this.refreshSbtData}
              refreshQuestionMetadata={this.refreshQuestionMetadata}
              refreshQuestionResponses={this.refreshQuestionResponses}

              // Demo/Config props
              demoMode={routeDemoMode}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderTagRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug, defaultSessionNetwork } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Tags..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <TagPage
            path={fullPath}
            activeSessionSlug={defaultSlug}
            network={defaultSessionNetwork}
            isQuestionCacheReady={this.state.isQuestionCacheReady}
            questionResponsesNonce={this.state.questionResponsesNonce}
          />
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderCompareRoute = (ctx: RouteRenderCtx) => {
    const { fullPath } = ctx;
    const comparePath = String(fullPath || '').split('?')[0];
    const firstAddress = comparePath.replace(/^\/compare\/?/, '').split('&').filter(Boolean)[0] || '';
    return (
      <Suspense fallback={<LazyFallback label="Loading..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_COMPARE_ROOT}>
            <CompareAddresses
              firstAddress={firstAddress}
              account={this.props.account}
              scanSpecificUserProfile={this.scanSpecificUserProfile}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderContractsRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Contracts..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_CONTRACTS_ROOT}>
            <ContractPage activeSessionSlug={defaultSlug} />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderAdminRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, requestedSessionId, requestedChainId } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Admin..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_ADMIN_ROOT}>
            <AdminPage
              account={this.props.account}
              provider={this.props.provider}
              network={this.props.network}
              toggleLoginModal={this.props.toggleLoginModal}
              loginComplete={this.props.loginComplete}
              ensureLightSbtUniverse={this.ensureLightSbtUniverse}
              initialSessionId={requestedSessionId}
              initialRegistryChainId={requestedChainId}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderSponsorRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, requestedSessionId, requestedChainId } = ctx;
    return (
      <Suspense fallback={<LazyFallback label="Loading Sponsor..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_SPONSOR_ROOT}>
            <SponsorPage
              account={this.props.account}
              provider={this.props.provider}
              network={this.props.network}
              toggleLoginModal={this.props.toggleLoginModal}
              loginComplete={this.props.loginComplete}
              initialSessionId={requestedSessionId}
              initialRegistryChainId={requestedChainId}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderSbtsListRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSessionNetwork } = ctx;
    const routeSessionSlug = this.getSbtListRouteSessionSlug(fullPath);
    const allSessionsMode = !routeSessionSlug;
    return (
      <Suspense fallback={<LazyFallback label={`Loading ${t('sbts')}...`} />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_SBTS_ROOT}>
            <SBTsPage
              provider={this.props.provider}
              account={this.props.account}
              litHooks={this.state.litHooks}
              network={defaultSessionNetwork}
              modalView={true}
              loginComplete={this.props.loginComplete}
              toggleLoginModal={this.props.toggleLoginModal}
              miniaturized={false}
              sessionSlug={routeSessionSlug || undefined}
              allSessionsMode={allSessionsMode}
              isSBTCacheReady={this.state.isSBTCacheReady}
              sbtCacheRevision={this.state.sbtCacheRevision}
              refreshSbtData={this.refreshSbtData}
              latestBlockNumber={this.state.latestBlockNumber}
              sbtScanProgressBySlug={this.state.sbtScanProgressBySlug}
              sbtRealtimeCoverageBySlug={this.state.sbtRealtimeCoverageBySlug}
              ensureLightSbtDiscovery={this.ensureLightSbtDiscovery}
              ensureLightSbtUniverse={this.ensureLightSbtUniverse}
              refreshSessionUniverseRegistryCache={this.refreshSessionUniverseRegistryCache}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderSbtDetailRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, searchStr, defaultSlug, defaultSessionNetwork } = ctx;
    const pathParts = fullPath.split('/');
    const sbtAddress = pathParts[2];
    const sbtPassword = pathParts.length > 3 ? pathParts[3] : null;
    const sbtLower = (sbtAddress || '').toLowerCase();
    const detailRouteHintSlug = this.resolveTrustedSbtRouteSessionSlug(searchStr) || '';
    const initialDetailSlug = detailRouteHintSlug || defaultSlug;
    const resolvedDetailSlug =
      (this.state.sbtDetailAddress && this.state.sbtDetailAddress.toLowerCase() === sbtLower && this.state.sbtDetailGroupSlug != null)
        ? this.state.sbtDetailGroupSlug
        : initialDetailSlug;
    const resolvedDetailNetwork = this.getSessionNetwork(resolvedDetailSlug) || defaultSessionNetwork;
    return (
      <Suspense fallback={<LazyFallback label={`Loading ${t('sbt')}...`} />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={E2E_TESTIDS.PAGE_SBT_ROOT}>
            <SBTPage
              SBTAddress={sbtAddress}
              sbtMintPassword={sbtPassword}
              toggleLoginModal={this.props.toggleLoginModal}
              account={this.props.account}
              provider={this.props.provider}
              litHooks={this.state.litHooks}
              loginComplete={this.props.loginComplete}
              loginInProgress={this.props.loginInProgress}
              network={resolvedDetailNetwork}
              chains={this.props.wagmiChainOptions}
              blockNumber={this.props.wagmiBlocknumber}
              isSBTCacheReady={this.state.isSBTCacheReady}
              sbtCacheRevision={this.state.sbtCacheRevision}
              sessionSlug={resolvedDetailSlug}
              refreshSbtData={this.refreshSbtData}
              sbtScanInProgress={this.readFlag('sbt:fullScanInProgress', resolvedDetailSlug)}
              sbtScanPending={this.readFlag('sbt:deferredFullScanNeeded', resolvedDetailSlug)}
              sbtScanProgress={this.state.sbtScanProgressBySlug?.[resolvedDetailSlug] || null}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderUserProfileRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSlug, defaultSessionNetwork } = ctx;
    const profilePath = fullPath;
    const profileSearchStr = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const profileSearchParams = new URLSearchParams(profileSearchStr);

    const viewAddress = profilePath.slice(1).replace("u/", "");
    const defaultTab = profileSearchParams.get('tab');

    return (
      <Suspense fallback={<LazyFallback label="Loading Profile..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <UserPage
            viewAddress={viewAddress}
            account={this.props.account}
            address={this.props.address}
            provider={this.props.provider}
            network={defaultSessionNetwork}
            activeSessionSlug={defaultSlug}
            sbtCacheRevision={this.state.sbtCacheRevision}
            questionResponsesNonce={this.state.questionResponsesNonce}
            defaultTab={defaultTab}
            isSBTCacheReady={!!this.state.isSBTCacheReady}
            isSurveyCacheReady={!!this.state.isSurveyCacheReady}
            isQuestionCacheReady={!!this.state.isQuestionCacheReady}
            isResponsesCacheReady={!!this.state.isResponsesCacheReady}
            isAllCachesReady={!!this.state.isAllCachesReady}
            cacheHasLoaded={!!this.state.cacheHasLoaded}
            latestBlockNumber={this.state.latestBlockNumber}
            scanSpecificUserProfile={this.scanSpecificUserProfilePriority}
          />
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderHomeRoute = (ctx: RouteRenderCtx) => {
    const { defaultSlug, defaultSessionNetwork, cacheInitializationError } = ctx;
    return (
      <div className={styles.main} data-testid={E2E_TESTIDS.PAGE_HOME_ROOT}>
        <MainAreaTabs
          changeFocusedTab={this.props.changeFocusedTab}
          toggleLoginModal={this.props.toggleLoginModal}
          toggleDemoMode={this.props.toggleDemoMode}
          account={this.props.account}
          provider={this.props.provider}
          litHooks={this.state.litHooks}
          focusedTab={this.props.focusedTab}
          loginComplete={this.props.loginComplete}
          loginInProgress={this.props.loginInProgress}
          demoMode={this.props.demoMode}
          demoSurfaceMode={this.props.demoSurfaceMode}
          activeSessionSlug={defaultSlug}
          network={defaultSessionNetwork}
          isAllCachesReady={this.state.isAllCachesReady}
          cacheHasLoaded={this.state.cacheHasLoaded}
          sbtCacheRevision={this.state.sbtCacheRevision}
          isSurveyCacheReady={this.state.isSurveyCacheReady}
          isQuestionCacheReady={this.state.isQuestionCacheReady}
          isSBTCacheReady={this.state.isSBTCacheReady}
          sbtRealtimeCoverageBySlug={this.state.sbtRealtimeCoverageBySlug}
          ensureLightSbtDiscovery={this.ensureLightSbtDiscovery}
          ensureLightSbtUniverse={this.ensureLightSbtUniverse}
          cacheInitializationError={cacheInitializationError}
        />
        <RightSide />
      </div>
    );
  };

  _renderSurveyIdRoute = (ctx: RouteRenderCtx) => {
    const {
      surveyIDFromPath,
      fullPath,
      searchStr,
      searchParams,
      autoOpenResults,
      parsedFilterStateFromUrl,
      cacheInitializationError,
    } = ctx;
    const sidLower = surveyIDFromPath!.toLowerCase();

    // 0. LOADING GATE: If caches haven't loaded yet, don't attempt to resolve or scan.
    // This prevents "Survey Not Found" from flashing during initial hydration.
    if (!this.state.cacheHasLoaded && !this.state.isAllCachesReady) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'white' }}>
          <h3>Loading...</h3>
          <div style={{ marginTop: '1rem' }} className="spinner-border text-light" role="status" />
        </div>
      );
    }

    // 1. Determine the "Best Guess" Slug
    const effectiveSlug = this.findGroupSlugForSurvey(sidLower);

    // 2. Check if the data actually exists in this resolved context
    const cfg = this.getSessionCfg(effectiveSlug);
    const cache = this.readDgRecord(
      'surveysCache',
      effectiveSlug,
      { clone: false }
    ) as MainSiteSurveyMetadataCache | null;
    const netKey = String(this.getSessionChainId(effectiveSlug));

    const inCache = !!cache?.[netKey]?.surveys?.[sidLower];
    const inConfig = Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
      cfg.HIGHLIGHTED_SURVEY_IDS.some((id: string) => id.toLowerCase() === sidLower);

    // 3. Check Scan State
    const isScanning = this.state.isScanningForGroup === sidLower;
    const hasFailed = this.state.scanFailedFor === sidLower;
    const hasError = this.state.scanErrorFor === sidLower;

    // 4. BLOCKING LOGIC: If missing, not scanning, and not failed -> Start Scan
    if (!inCache && !inConfig && !hasFailed && !hasError && !isScanning) {
      this.queueSurveyGroupScan(sidLower, { hintedSlug: this.getSurveyRouteSessionSlugHint() });
    }

    // 5. RENDER SPINNER (Block SurveyPage from mounting if scanning or missing)
    if ((!inCache && !inConfig && !hasFailed && !hasError) || isScanning) {
      const routeHintSlug = this.getSurveyRouteSessionSlugHint();
      const scanTargetLabel = routeHintSlug
        ? `session "${routeHintSlug}" first, then other sessions`
        : 'demo sessions';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'white' }}>
          <h3>Resolving Survey Context...</h3>
          <p>Scanning {scanTargetLabel} for ID: {sidLower.substring(0, 6)}...</p>
          <div style={{ marginTop: '1rem' }} className="spinner-border text-light" role="status" />
        </div>
      );
    }

    if (hasError) {
      const loadErrorMessage = String(this.state.scanErrorMessage || '').trim() || 'Survey metadata was found but could not be loaded.';
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'white' }}>
          <h3>Survey Load Error</h3>
          <p>{loadErrorMessage}</p>
          <button
            className="btn btn-outline-light"
            onClick={() => this.setState(
              { scanErrorFor: null, scanErrorMessage: '', scanFailedFor: null },
              () => this.queueSurveyGroupScan(sidLower, { hintedSlug: this.getSurveyRouteSessionSlugHint() })
            )}
          >
            Retry
          </button>
        </div>
      );
    }

    // 6. If Scan Failed (Survey truly doesn't exist in any known group)
    if (hasFailed) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'white' }}>
          <h3>Survey Not Found</h3>
          <p>This survey ID does not exist in any known session.</p>
          <button className="btn btn-outline-light" onClick={() => window.history.back()}>Go Back</button>
        </div>
      );
    }

    // 7. Success: We have the data (or config) and the correct slug. Render the Page immediately.
    const effectiveNetwork = this.getSessionNetwork(effectiveSlug);
    const authViewProps = composeMainSiteAuthViewProps(this.props);
    const surveyCacheViewProps = composeMainSiteSurveyCacheViewProps(this.state);
    const surveyPathParts = fullPath.split('/');
    let responderParam = searchParams.get('responder') || null;
    const legacySurveyResponder = surveyPathParts.length > 3 ? surveyPathParts[3] : null;
    const isSurveyResultsRoute = fullPath.includes('/results');
    if (!isSurveyResultsRoute && !responderParam && isRouteResponderAddress(legacySurveyResponder)) {
      responderParam = legacySurveyResponder;
      replaceRouteResponderQueryParam(`/survey/${surveyIDFromPath}`, responderParam, searchStr);
    }

    return (
      <Suspense fallback={<LazyFallback label="Loading..." />}>
        <div data-testid={E2E_TESTIDS.PAGE_SURVEYS_ROOT}>
          <SurveyPage
            key={`${effectiveSlug}-${sidLower}`} // Force remount if slug changes
            surveyID={sidLower}
            autoOpenResults={autoOpenResults}
            filterState={parsedFilterStateFromUrl}
            displayAnswerMode={isSurveyResultsRoute ? false : !!responderParam}
            viewAddress={isSurveyResultsRoute ? null : responderParam}
            {...authViewProps}
            network={effectiveNetwork}
            activeSessionSlug={effectiveSlug}
            {...surveyCacheViewProps}
            refreshSurveyResponsesByID={this.refreshSurveyResponsesByID}
            refreshQuestionMetadata={this.refreshQuestionMetadata}
            refreshQuestionResponses={this.refreshQuestionResponses}
            refreshSbtData={this.refreshSbtData}
            scanForSurveyGroup={this.scanForSurveyGroup}
            cacheInitializationError={cacheInitializationError}
            defaultTags={cfg?.defaultTags}
            defaultSbtTags={cfg?.defaultSbtTags}
            defaultFilterState={cfg?.defaultFilterState}
            defaultFeaturedSBTs={cfg?.defaultFeaturedSBTs || []}
          />
        </div>
      </Suspense>
    );
  };

  _renderSurveysOrQuestionsListRoute = (ctx: RouteRenderCtx) => {
    const {
      fullPath,
      searchStr,
      searchParams,
      defaultSlug,
      defaultSessionCfg,
      defaultSessionChainId,
      defaultSessionNetwork,
      autoOpenResults,
      parsedFilterStateFromUrl,
      cacheInitializationError,
    } = ctx;

    // Note: Specific survey ID routes are intercepted above.
    // This block now primarily handles /surveys (list) and /questions (list).
    const isQuestionsListRoute = fullPath.startsWith('/questions');
    const initialQuestionRouteSession = isQuestionsListRoute
      ? resolveMainSiteQuestionRouteSessionContext({
        search: searchStr,
        isCacheManagerReady: this.state.isCacheManagerReady,
        getSessionConfigBySlug: (slug: string) => this.getDisplaySessionCfg(slug) as SessionConfigLike | null,
        formatSessionId: sessionRegistryReadsPort.formatSessionId,
        resolveSessionConfigById: (sessionId: string | number) => sessionRegistryReadsPort.getSessionConfigById(sessionId),
      })
      : null;
    const inheritedNetworkWaitSlug = (
      isQuestionsListRoute &&
      initialQuestionRouteSession?.sessionSlugPinned
        ? initialQuestionRouteSession.sessionSlug
        : defaultSlug
    );
    const inheritedNetworkWaitCfg = inheritedNetworkWaitSlug === defaultSlug
      ? defaultSessionCfg
      : this.getDisplaySessionCfg(inheritedNetworkWaitSlug);
    const inheritedNetworkWaitChainId = inheritedNetworkWaitSlug === defaultSlug
      ? defaultSessionChainId
      : this.getDisplaySessionChainId(inheritedNetworkWaitSlug);
    const slugStatus = this._sessionPathResolver.getSlugStatus(String(inheritedNetworkWaitSlug || ''));
    const shouldWaitForInheritedSessionNetwork = (
      !!inheritedNetworkWaitSlug &&
      !inheritedNetworkWaitChainId &&
      !inheritedNetworkWaitCfg?.networkChainId &&
      (!slugStatus.hasAttempted || slugStatus.isPending)
    );
    if (shouldWaitForInheritedSessionNetwork) {
      this.resolveSessionPathSlug(inheritedNetworkWaitSlug);
      return (
        <LazyFallback label={fullPath.startsWith('/questions') ? 'Loading Questions...' : 'Loading Surveys...'} />
      );
    }

    const parts = fullPath.split("?")[0].split("/").filter(Boolean);
    let surveyID = null;
    let displayAnswerMode = false;
    let viewResponseAddress = null;

    // Fallback extraction if regex above didn't catch it (unlikely given logic order, but safe)
    if (parts[0] === "survey" && parts[1] && VALID_SURVEY_ID_RE.test(parts[1])) {
      surveyID = parts[1];
      let responderParam = searchParams.get('responder') || null;
      const legacySurveyResponder = parts[2] || null;
      if (!responderParam && isRouteResponderAddress(legacySurveyResponder)) {
        responderParam = legacySurveyResponder;
        replaceRouteResponderQueryParam(`/survey/${surveyID}`, responderParam, searchStr);
      }
      if (responderParam) {
        displayAnswerMode = true;
        viewResponseAddress = responderParam;
      }
    }

    const pageRootTestId = fullPath.startsWith('/questions')
      ? E2E_TESTIDS.PAGE_QUESTIONS_ROOT
      : E2E_TESTIDS.PAGE_SURVEYS_ROOT;
    const questionRouteSession = initialQuestionRouteSession || {
        sessionSlug: null,
        sessionId: null,
        sessionSlugKnown: false,
        sessionSlugPinned: false,
        shouldBlockDuringBootstrap: false,
      };
    if (questionRouteSession.shouldBlockDuringBootstrap) {
      return <LazyFallback label="Loading Questions..." />;
    }
    const effectivePageSlug = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? questionRouteSession.sessionSlug
        : defaultSlug
    );
    const effectivePageSessionCfg = isQuestionsListRoute
      ? this.getDisplaySessionCfg(effectivePageSlug)
      : defaultSessionCfg;
    const effectivePageChainId = isQuestionsListRoute
      ? this.getDisplaySessionChainId(effectivePageSlug)
      : defaultSessionChainId;
    const effectivePageNetwork = isQuestionsListRoute
      ? this.getDisplaySessionNetwork(effectivePageSlug)
      : defaultSessionNetwork;
    const strictQuestionRouteSessionCfg = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned && effectivePageSlug
        ? this.getSessionCfg(effectivePageSlug)
        : null
    );
    const strictQuestionRouteChainId = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned && effectivePageSlug
        ? this.getSessionChainId(effectivePageSlug)
        : null
    );
    const shouldResolvePinnedQuestionRouteSession = !!(
      isQuestionsListRoute &&
      questionRouteSession.sessionSlugPinned &&
      effectivePageSlug &&
      effectivePageSessionCfg &&
      (!strictQuestionRouteSessionCfg || !strictQuestionRouteChainId) &&
      !hasMainSiteRegistryIdentity(effectivePageSessionCfg)
    );
    if (shouldResolvePinnedQuestionRouteSession) {
      const slugStatus = this._sessionPathResolver.getSlugStatus(String(effectivePageSlug || ''));
      const recentError = !!(
        slugStatus.lastErrorTs &&
        (Date.now() - slugStatus.lastErrorTs) < 2 * 60 * 1000
      );
      const keepResolving = recentError && slugStatus.retryCount > 0;
      this.resolveSessionPathSlug(effectivePageSlug!);
      if (!slugStatus.hasAttempted || slugStatus.isPending || keepResolving) {
        return <LazyFallback label="Loading Questions..." />;
      }
    }
    const shouldRefreshBuiltInDemoQuestionSources = (
      isQuestionsListRoute &&
      questionRouteSession.sessionSlugPinned &&
      normalizeSessionSlug(effectivePageSlug || '') === 'demo'
    );
    const pageRefreshSurveyResponsesByID = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((id: string) => {
          const primary = this.refreshSurveyResponsesByIDForGroup(effectivePageSlug!, id);
          if (!shouldRefreshBuiltInDemoQuestionSources) return primary;
          return Promise.all([
            Promise.resolve(primary),
            Promise.resolve(this.refreshSurveyResponsesByIDForGroup('', id)),
          ]).then(() => undefined);
        })
        : this.refreshSurveyResponsesByID
    );
    const pageRefreshQuestionMetadata = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((opts = {}) => {
          const primary = this.refreshQuestionMetadataForGroup(effectivePageSlug!, opts);
          if (!shouldRefreshBuiltInDemoQuestionSources) return primary;
          return Promise.all([
            Promise.resolve(primary),
            Promise.resolve(this.refreshQuestionMetadataForGroup('', opts)),
          ]).then(() => undefined);
        })
        : this.refreshQuestionMetadata
    );
    const pageRefreshQuestionResponses = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((questionIds?: string[] | null, opts: RefreshQuestionResponsesOptions = {}) => {
          const primary = this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: effectivePageSlug ?? undefined });
          if (!shouldRefreshBuiltInDemoQuestionSources) return primary;
          return Promise.all([
            Promise.resolve(primary),
            Promise.resolve(this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: '' })),
          ]).then(() => undefined);
        })
        : this.refreshQuestionResponses
    );
    const pageRefreshSbtData = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((addr: string, slug?: string) => this.refreshSbtData(addr, slug || effectivePageSlug!))
        : this.refreshSbtData
    );
    const authViewProps = composeMainSiteAuthViewProps(this.props);
    const surveyCacheViewProps = composeMainSiteSurveyCacheViewProps(this.state);

    return (
      <Suspense fallback={<LazyFallback label="Loading..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={pageRootTestId}>
            <SurveyPage
              surveyID={surveyID}
              displayAnswerMode={displayAnswerMode}
              viewAddress={viewResponseAddress}
              {...authViewProps}
              network={effectivePageNetwork}
              networkChainId={effectivePageChainId}
              activeSessionSlug={effectivePageSlug}
              sessionSlug={isQuestionsListRoute ? effectivePageSlug : undefined}
              sessionSlugPinned={questionRouteSession.sessionSlugPinned}
              sessionConfig={effectivePageSessionCfg}
              ensureLightSbtUniverse={this.ensureLightSbtUniverse}
              {...surveyCacheViewProps}
              refreshSurveyResponsesByID={pageRefreshSurveyResponsesByID}
              refreshQuestionMetadata={pageRefreshQuestionMetadata}
              refreshQuestionResponses={pageRefreshQuestionResponses}
              autoOpenResults={autoOpenResults}
              filterState={parsedFilterStateFromUrl}
              refreshSbtData={pageRefreshSbtData}
              scanForSurveyGroup={this.scanForSurveyGroup}
              cacheInitializationError={cacheInitializationError}
              litHooks={this.state.litHooks}
              defaultTags={effectivePageSessionCfg?.defaultTags}
              defaultSbtTags={effectivePageSessionCfg?.defaultSbtTags}
              defaultFilterState={effectivePageSessionCfg?.defaultFilterState}
              defaultFeaturedSBTs={effectivePageSessionCfg?.defaultFeaturedSBTs || []}
              contracts={effectivePageSessionCfg?.contracts || {}}
              blockLimits={effectivePageSessionCfg?.blockLimits || { start: null, end: null }}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };

  _renderQuestionDetailRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, searchStr, defaultSessionNetwork, cacheInitializationError } = ctx;
    const pathParts = fullPath.split('/');
    const questionIndex = pathParts.indexOf('question');
    const questionID = pathParts[questionIndex + 1];
    const urlParams = new URLSearchParams(searchStr);
    let responderAddress = urlParams.get('responder') || null;
    const legacyResponderAddress = pathParts[questionIndex + 2] || null;
    if (!responderAddress && isRouteResponderAddress(legacyResponderAddress)) {
      responderAddress = legacyResponderAddress;
      replaceRouteResponderQueryParam(`/question/${String(questionID || '').trim().toLowerCase()}`, responderAddress, searchStr);
    }
    const questionRouteSession = resolveMainSiteQuestionRouteSessionContext({
      search: searchStr,
      isCacheManagerReady: this.state.isCacheManagerReady,
      getSessionConfigBySlug: (slug: string) => this.getDisplaySessionCfg(slug) as SessionConfigLike | null,
      formatSessionId: sessionRegistryReadsPort.formatSessionId,
      resolveSessionConfigById: (sessionId: string | number) => sessionRegistryReadsPort.getSessionConfigById(sessionId),
    });
    const queryQuestionSlug = questionRouteSession.sessionSlug;
    const queryQuestionSessionId = questionRouteSession.sessionId;
    const questionSlugPinned = questionRouteSession.sessionSlugPinned;
    if (questionRouteSession.shouldBlockDuringBootstrap) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh', color: 'white' }}>
          <h3>Loading Question...</h3>
          <div style={{ marginTop: '1rem' }} className="spinner-border text-light" role="status" />
        </div>
      );
    }
    const effectiveQuestionSlug =
      questionSlugPinned
        ? queryQuestionSlug
        : this.findGroupSlugForQuestion(questionID);
    if (effectiveQuestionSlug != null && typeof window !== 'undefined') {
      const canonicalQuestionPath = buildQuestionRoutePath(questionID, {
        responderAddress,
        sessionSlug: effectiveQuestionSlug,
        sessionId: queryQuestionSessionId || undefined,
      });
      const currentPath = `${window.location.pathname || ''}${window.location.search || ''}`;
      const canonicalQuestionPublicPath = buildPublicRoute(canonicalQuestionPath);
      if (canonicalQuestionPublicPath !== currentPath) {
        const withHash = `${canonicalQuestionPublicPath}${window.location.hash || ''}`;
        window.history.replaceState({}, '', withHash);
      }
    }
    const walletNetwork = (this.props.network && typeof this.props.network === 'object')
      ? this.props.network
      : null;
    const effectiveQuestionNetwork =
      this.getSessionNetwork(effectiveQuestionSlug) ||
      defaultSessionNetwork ||
      walletNetwork ||
      this.getSessionNetwork('') ||
      null;
    const questionSessionCfg = this.getSessionCfg(effectiveQuestionSlug);
    const authViewProps = composeMainSiteAuthViewProps(this.props);
    const questionCacheViewProps = composeMainSiteQuestionCacheViewProps(this.state);
    return (
      <Suspense fallback={<LazyFallback label="Loading Question..." />}>
        <div data-testid={E2E_TESTIDS.PAGE_QUESTIONS_ROOT}>
          <SurveyTool
            key={`${effectiveQuestionSlug}-${String(questionID || '').toLowerCase()}-${String(responderAddress || '').toLowerCase()}`}
            questionID={questionID}
            responderAddress={responderAddress}
            singleQuestionMode={true}
            {...authViewProps}
            network={effectiveQuestionNetwork}
            networkChainId={effectiveQuestionNetwork?.id || this.props.network?.id || null}
            activeSessionSlug={effectiveQuestionSlug}
            sessionSlug={effectiveQuestionSlug}
            sessionSlugPinned={questionSlugPinned}
            sessionConfig={questionSessionCfg}
            ensureLightSbtUniverse={this.ensureLightSbtUniverse}
            {...questionCacheViewProps}
            refreshSurveyResponsesByID={(id: string) => this.refreshSurveyResponsesByIDForGroup(effectiveQuestionSlug!, id)}
            refreshQuestionMetadata={() => this.refreshQuestionMetadataForGroup(effectiveQuestionSlug!)}
            refreshQuestionResponses={(questionIds?: string[] | null, opts: RefreshQuestionResponsesOptions = {}) =>
              this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: effectiveQuestionSlug ?? undefined })
            }
            refreshSbtData={(addr: string, slug?: string) => this.refreshSbtData(addr, slug || effectiveQuestionSlug!)}
            scanForSurveyGroup={this.scanForSurveyGroup}
            cacheInitializationError={cacheInitializationError}
            litHooks={this.state.litHooks}
            defaultTags={questionSessionCfg?.defaultTags}
            defaultSbtTags={questionSessionCfg?.defaultSbtTags}
            defaultFilterState={questionSessionCfg?.defaultFilterState}
            defaultFeaturedSBTs={questionSessionCfg?.defaultFeaturedSBTs || []}
          />
        </div>
      </Suspense>
    );
  };

  _renderSessionRoute = (ctx: RouteRenderCtx) => {
    const { fullPath, defaultSessionNetwork, cacheInitializationError } = ctx;
    const parts = fullPath.split('/').filter(Boolean);
    const sessionTokenRaw = (parts[1] || '').trim();
    const subroute = (parts[2] || '').trim().toLowerCase();
    const isDocsRoute = subroute === 'docs';
    const nextSubroute = (parts[3] || '').trim().toLowerCase();
    const isQuestionsRoute = subroute === 'questions' && (!nextSubroute || nextSubroute === 'results');
    const isQuestionResultsRoute = isQuestionsRoute && nextSubroute === 'results' && !parts[4];
    const hasUnsupportedSessionSubroute = (
      !!parts[2] &&
      !isDocsRoute &&
      !isQuestionsRoute
    ) || (
      subroute === 'questions' &&
      !!nextSubroute &&
      nextSubroute !== 'results'
    ) || (
      subroute === 'questions' &&
      nextSubroute === 'results' &&
      !!parts[4]
    );
    const sessionRoute = resolveMainSiteSessionRouteContext({
      sessionTokenRaw,
      formatSessionId: sessionRegistryReadsPort.formatSessionId,
      resolveSessionConfigById: (sessionId: string | number) => sessionRegistryReadsPort.getSessionConfigById(sessionId),
      resolveSessionConfigBySlug: (slug: string) => (
        sessionRegistryReadsPort.getSessionConfig(slug) || getSessionConfigBySlug(slug)
      ),
      resolveDisplaySessionConfigBySlug: (slug: string) => (
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true }) || (
          normalizeSessionSlug(slug) === 'demo'
            ? getDemoSessionConfigBySlug('', { allowDemoFallback: true })
            : null
        )
      ),
      resolveSessionSlugFromPathToken: (sessionToken: string) => (
        sessionToken
          ? this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true })
          : DEFAULT_SESSION_SLUG
      ),
    });
    const sessionIdFromPath = sessionRoute.sessionIdFromPath;
    const configBySessionId = sessionRoute.configBySessionId;
    let slug = sessionRoute.sessionSlug;

    if (!isDocsRoute && sessionIdFromPath && configBySessionId && typeof window !== 'undefined') {
      const resolvedSlug = normalizeSessionSlug(configBySessionId.slug || '');
      const canonicalToken = resolvedSlug || DEFAULT_SESSION_SLUG_ALIAS;
      if (sessionTokenRaw.toLowerCase() !== canonicalToken.toLowerCase()) {
        const nextPath = `/session/${canonicalToken}${
          isQuestionResultsRoute
            ? '/questions/results'
            : (isQuestionsRoute ? '/questions' : '')
        }`;
        const nextUrl = buildPublicUrl(nextPath, window.location.search || '', window.location.hash || '');
        window.history.replaceState({}, '', nextUrl);
      }
    }

    if (sessionRoute.hasUnresolvedSessionId) {
      const unresolvedSessionId = sessionIdFromPath!;
      const idStatus = this._sessionPathResolver.getIdStatus(unresolvedSessionId);
      const recentError = !!(
        idStatus.lastErrorTs &&
        (Date.now() - idStatus.lastErrorTs) < 2 * 60 * 1000
      );
      const keepResolving = recentError && idStatus.retryCount > 0;
      this.resolveSessionPathId(unresolvedSessionId);
      if (!idStatus.hasAttempted || idStatus.isPending || keepResolving) {
        return (
          <SessionLoadingSkeleton
            statusTitle={`Resolving ${unresolvedSessionId} Session...`}
          />
        );
      }
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '50vh',
            color: 'rgba(244,247,255,0.65)',
          }}
        >
          <h3>Session Not Found</h3>
          <p>No session metadata was found for {sessionIdFromPath}.</p>
        </div>
      );
    }

    slug = normalizeSessionSlug(slug);
    const canonicalSessionToken = slug || sessionTokenRaw || DEFAULT_SESSION_SLUG_ALIAS;

    const searchStr = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const qp = new URLSearchParams(searchStr);
    const hasAutoFlag = hasAutoFlagFn(searchStr);

    if (!isDocsRoute && (qp.has('password') || qp.has('gp')) && !hasAutoFlag) {
      const base = `/session/${canonicalSessionToken}`;
      if (typeof window !== 'undefined') window.location.replace(buildPublicRoute(base));
      return <div />;
    }
    const sessionConfig = sessionRoute.sessionConfig;

    if (!sessionConfig) {
      if (slug) {
        const slugStatus = this._sessionPathResolver.getSlugStatus(slug);
        const recentError = !!(
          slugStatus.lastErrorTs &&
          (Date.now() - slugStatus.lastErrorTs) < 2 * 60 * 1000
        );
        const keepResolving = recentError && slugStatus.retryCount > 0;
        this.resolveSessionPathSlug(slug);
        if (!slugStatus.hasAttempted || slugStatus.isPending || keepResolving) {
          return (
            <SessionLoadingSkeleton
              statusTitle={`Resolving ${slug} Session...`}
            />
          );
        }
        return (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '50vh',
              color: 'rgba(244,247,255,0.65)',
            }}
          >
            <h3>Session Not Found</h3>
            <p>No session metadata was found for {slug}.</p>
          </div>
        );
      }
      return <div>Session not found.</div>;
    }

    const sessionConfigSlug = normalizeSessionSlug(sessionConfig.slug || '');
    const sessionRegistryInfo = (
      sessionConfig.__registry &&
      typeof sessionConfig.__registry === 'object'
        ? sessionConfig.__registry
        : {}
    );
    const sessionConfigHasRegistryIdentity = !!(
      sessionConfig.sessionId ||
      sessionConfig.sessionIdHex ||
      sessionConfig.metadataURI ||
      sessionRegistryInfo.sessionId ||
      sessionRegistryInfo.sessionIdHex ||
      sessionRegistryInfo.metadataURI
    );
    if (slug && sessionConfigSlug !== slug && !sessionConfigHasRegistryIdentity) {
      this.resolveSessionPathSlug(slug);
    }

    if (isDocsRoute) {
      const resolvedSlug = normalizeSessionSlug(sessionConfig.slug || slug);
      const sessionNetwork = this.getSessionNetwork(resolvedSlug) || defaultSessionNetwork;
      return (
        <Suspense fallback={<LazyFallback label="Loading Docs..." />}>
          <div data-testid={E2E_TESTIDS.PAGE_SESSION_DOCS_ROOT}>
            <SessionDocumentsPage
              provider={this.props.provider}
              account={this.props.account}
              network={sessionNetwork}
              litHooks={this.state.litHooks}
              toggleLoginModal={(loginModalIsOpen?: boolean) => this.props.toggleLoginModal(loginModalIsOpen)}
              loginComplete={this.props.loginComplete}
              sessionToken={sessionTokenRaw}
              sessionSlug={resolvedSlug}
              sessionConfig={sessionConfig}
              sessionIdHex={sessionConfig?.__registry?.sessionIdHex || null}
            />
          </div>
        </Suspense>
      );
    }

    if (hasUnsupportedSessionSubroute) {
      const base = `/session/${canonicalSessionToken}`;
      if (typeof window !== 'undefined') window.location.replace(buildPublicRoute(base));
      return <div />;
    }

    const sessionRouteSourceSlug = resolveMainSiteSessionRouteSourceSlug({
      sessionTokenRaw,
      sessionSlug: slug,
      sessionConfig,
    });
    const sessionRouteDisplaySlug = normalizeSessionSlug(sessionConfig.slug || slug);
    const shouldRefreshBuiltInDemoLiveBucket = (
      normalizeSessionSlug(sessionTokenRaw) === 'demo' &&
      sessionRouteDisplaySlug === 'demo' &&
      sessionRouteSourceSlug === ''
    );
    const refreshSessionRouteSurveyResponsesByID = (id: string) => {
      const primary = this.refreshSurveyResponsesByIDForGroup(sessionRouteSourceSlug, id);
      if (!shouldRefreshBuiltInDemoLiveBucket) return primary;
      return Promise.all([
        Promise.resolve(primary),
        Promise.resolve(this.refreshSurveyResponsesByIDForGroup('demo', id)),
      ]).then(() => undefined);
    };
    const refreshSessionRouteQuestionMetadata = (opts = {}) => {
      const primary = this.refreshQuestionMetadataForGroup(sessionRouteSourceSlug, opts);
      if (!shouldRefreshBuiltInDemoLiveBucket) return primary;
      return Promise.all([
        Promise.resolve(primary),
        Promise.resolve(this.refreshQuestionMetadataForGroup('demo', opts)),
      ]).then(() => undefined);
    };
    const refreshSessionRouteQuestionResponses = (
      questionIds?: string[] | null,
      opts: RefreshQuestionResponsesOptions = {}
    ) => {
      const primary = this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: sessionRouteSourceSlug });
      if (!shouldRefreshBuiltInDemoLiveBucket) return primary;
      return Promise.all([
        Promise.resolve(primary),
        Promise.resolve(this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: 'demo' })),
      ]).then(() => undefined);
    };
    const resolvedSessionInfo = this.getSessionInfoForGroup(sessionConfig, sessionConfig?.slug || slug);
    const resolvedSessionName = this.getSessionNameForGroup(sessionConfig, sessionConfig?.slug || slug);
    const resolvedSessionHeader = this.getSessionHeaderForGroup(sessionConfig, sessionConfig?.slug || slug);
    const walletViewProps = composeMainSiteWalletViewProps(this.props);
    const loginViewProps = composeMainSiteLoginViewProps(this.props);
    const sessionCacheViewProps = composeMainSiteSessionCacheViewProps(this.state);

    return (
      <Suspense fallback={<LazyFallback label="Loading Session..." />}>
        <RouteErrorBoundary resetKey={this.props.path}>
          <div data-testid={E2E_TESTIDS.PAGE_SESSION_ROOT}>
            <OnePageSession
              slug={sessionConfig.slug || slug}
              sessionName={resolvedSessionName}
              sessionHeader={resolvedSessionHeader}
              sessionInfo={resolvedSessionInfo}
              sessionConfig={sessionConfig}
              defaultTags={sessionConfig.defaultTags}
              defaultSbtTags={sessionConfig.defaultSbtTags}
              defaultFilterState={sessionConfig.defaultFilterState}
              defaultFeaturedSBTs={sessionConfig.defaultFeaturedSBTs || []}
              contracts={sessionConfig.contracts || {}}
              blockLimits={sessionConfig.blockLimits || { start: null, end: null }}
              networkChainId={sessionConfig.networkChainId}
              questionsGenPrompt={sessionConfig.questionsGenPrompt}
              {...walletViewProps}
              network={defaultSessionNetwork}
              {...loginViewProps}
              {...sessionCacheViewProps}
              refreshSurveyResponsesByID={refreshSessionRouteSurveyResponsesByID}
              refreshQuestionMetadata={refreshSessionRouteQuestionMetadata}
              refreshQuestionResponses={refreshSessionRouteQuestionResponses}
              questionSessionSlug={sessionRouteSourceSlug}
              refreshSbtData={this.refreshSbtData}
              ensureLightSbtDiscovery={this.ensureLightSbtDiscovery}
              ensureLightSbtUniverse={this.ensureLightSbtUniverse}
              sbtScanProgressBySlug={this.state.sbtScanProgressBySlug}
              sbtRealtimeCoverageBySlug={this.state.sbtRealtimeCoverageBySlug}
              cacheInitializationError={cacheInitializationError}
              autoFeatureSBTsBySessionSlug={
                sessionConfig?.autoFeatureSBTsBySessionSlug !== undefined
                  ? sessionConfig.autoFeatureSBTsBySessionSlug
                  : sessionConfig?.autoFeatureSBTsWithFeaturedSbtTags
              }
              routeQuestionsOpen={isQuestionsRoute}
              routeAutoOpenResults={isQuestionResultsRoute}
              litHooks={this.state.litHooks}
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };


  getMainView = (relevantMatch: RegExpMatchArray | null | undefined) => {
    // Variable initialization
    let surveyIDFromPath: string | null = null;
    let parsedFilterStateFromUrl: Record<string, unknown> = {};
    let autoOpenResults = false;
    let isResultsRoute = false;
    const cacheInitializationError = !!(
      this.state.surveyCacheInitializationError || this.state.questionCacheInitializationError
    );

    let fullPath = this.getEffectiveRoutePath(this.getCurrentPathname());
    const searchStr = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const hashStr = (typeof window !== 'undefined' ? window.location.hash : '') || '';
    const searchParams = new URLSearchParams(searchStr);
    const routeDemoMode = this.props.demoSurfaceMode !== false || searchParams.get('demo') === '1';
    const requestedSessionId = searchParams.get('sessionId') || searchParams.get('sessionID') || '';
    const requestedChainIdRaw = searchParams.get('chainId') || searchParams.get('chainID') || '';
    const requestedSponsoredBundleId = searchParams.get('sponsored') || '';
    const requestedSponsoredBundleKey = readHashQueryParam(hashStr, 'k');
    const requestedChainIdTokens = requestedChainIdRaw ? requestedChainIdRaw.match(/\d+/g) : null;
    const requestedChainId = requestedChainIdTokens && requestedChainIdTokens.length
      ? Number(requestedChainIdTokens[requestedChainIdTokens.length - 1])
      : null;
    const sessionFallbackTarget = this.applySessionFallbackRedirect({ pathIn: fullPath });
    if (sessionFallbackTarget) {
      fullPath = sessionFallbackTarget.path;
    }
    const pathWithoutQuery = String(fullPath || '').split('?')[0] || '';
    const pathSegments = pathWithoutQuery.split('/').filter(Boolean);
    const firstPathSegment = String(pathSegments[0] || '').trim().toLowerCase();

    // Robust results routing (/survey/:id/results or /questions/results)
    const surveyMatch = fullPath.match(SURVEY_RESULTS_RE);
    const questionMatch = fullPath.match(QUESTION_RESULTS_RE);

    // Default slug/network for non-survey routes
    const defaultSlug = sessionFallbackTarget?.slug || this.getRenderActiveSessionSlug(fullPath, searchStr);
    const defaultSessionCfg = this.getDisplaySessionCfg(defaultSlug);
    const defaultSessionChainId = this.getDisplaySessionChainId(defaultSlug);
    const defaultSessionNetwork = this.getDisplaySessionNetwork(defaultSlug);

    const routeMatch = resolveMainSiteRouteMatch({
      fullPath,
      isAddress: ethers.utils.isAddress,
      surveyIDFromPath,
    });
    const isWizardRoute = routeMatch.key === 'wizard';
    const shouldBypassCacheHydrationWait = routeMatch.shouldBypassCacheHydrationWait;
    const isKnownRoutePrefix = routeMatch.isKnownRoutePrefix;
    if (isWizardRoute) {
      if (routeMatch.canonicalPath && typeof window !== 'undefined') {
        window.history.replaceState({}, '', `${buildPublicRoute(routeMatch.canonicalPath)}${searchStr}${hashStr}`);
      }
      return (
        <Suspense fallback={<LazyFallback label="Loading Session Wizard..." />}>
          <RouteErrorBoundary resetKey={fullPath}>
            <div data-testid={E2E_TESTIDS.PAGE_SESSION_WIZARD_ROOT}>
              <SessionWizard
                account={this.props.account}
                provider={this.props.provider}
                network={defaultSessionNetwork}
                activeSessionSlug={defaultSlug}
                ensureLightSbtUniverse={this.ensureLightSbtUniverse}
                sbtCacheRevision={this.state.sbtCacheRevision}
                toggleLoginModal={this.props.toggleLoginModal}
                loginComplete={this.props.loginComplete}
                loginInProgress={this.props.loginInProgress}
                initialSessionId={requestedSessionId}
                initialRegistryChainId={requestedChainId}
                initialSponsoredBundleId={requestedSponsoredBundleId}
                initialSponsoredBundleKey={requestedSponsoredBundleKey}
              />
            </div>
          </RouteErrorBoundary>
        </Suspense>
      );
    }

    // Prevent cache-backed views from mounting before cache mirror hydration completes.
    if (!this.state.isCacheManagerReady && !shouldBypassCacheHydrationWait && isKnownRoutePrefix) {
      return <LazyFallback label="Initializing Cache..." />;
    }

    if (surveyMatch) {
      isResultsRoute = true;
      surveyIDFromPath = surveyMatch[1];
      autoOpenResults = true;

      const seg = surveyMatch[2];
      const q = searchParams.get('filter');
      if (seg) {
        parsedFilterStateFromUrl = deserializeFilterState(seg) || {};
      } else if (q) {
        parsedFilterStateFromUrl = deserializeFilterState(q) || {};
      }
    } else if (questionMatch) {
      isResultsRoute = true;
      autoOpenResults = true;
      const seg = questionMatch[1]; // <-- index 1, not 2
      const q = searchParams.get('filter');
      if (seg) {
        parsedFilterStateFromUrl = deserializeFilterState(seg) || {};
      } else if (q) {
        parsedFilterStateFromUrl = deserializeFilterState(q) || {};
      }
    }

    // Extract ID if not already extracted (for non-results view)
    if (!surveyIDFromPath && fullPath.startsWith("/survey/")) {
      const parts = fullPath.split("?")[0].split("/").filter(Boolean);
      if (parts[1] && VALID_SURVEY_ID_RE.test(parts[1])) {
        surveyIDFromPath = parts[1];
      }
    }

    const ctx: RouteRenderCtx = {
      fullPath,
      searchStr,
      hashStr,
      searchParams,
      pathWithoutQuery,
      pathSegments,
      firstPathSegment,
      routeDemoMode,
      requestedSessionId,
      requestedChainId,
      requestedSponsoredBundleId,
      requestedSponsoredBundleKey,
      defaultSlug,
      defaultSessionCfg,
      defaultSessionChainId,
      defaultSessionNetwork,
      cacheInitializationError,
      surveyIDFromPath,
      autoOpenResults,
      parsedFilterStateFromUrl,
      isResultsRoute,
    };

    return renderMainSiteRouteView({
      routeKey: routeMatch.key,
      fullPath,
      renderers: {
        surveyId: () => this._renderSurveyIdRoute(ctx),
        home: () => this._renderHomeRoute(ctx),
        debate: () => this._renderDebateRoute(fullPath),
        atlas: () => this._renderAtlasRoute(ctx),
        tag: () => this._renderTagRoute(ctx),
        bookmarks: () => this._renderBookmarksRoute(),
        compare: () => this._renderCompareRoute(ctx),
        surveysOrQuestionsList: () => this._renderSurveysOrQuestionsListRoute(ctx),
        questionDetail: () => this._renderQuestionDetailRoute(ctx),
        sbtsList: () => this._renderSbtsListRoute(ctx),
        sbtDetail: () => this._renderSbtDetailRoute(ctx),
        simUser: () => this._renderSimUserRoute(fullPath, defaultSessionNetwork),
        userProfile: () => this._renderUserProfileRoute(ctx),
        about: () => this._renderAboutRoute(),
        demos: () => this._renderDemosRoute(),
        matrix: () => this._renderMatrixRoute(),
        contracts: () => this._renderContractsRoute(ctx),
        admin: () => this._renderAdminRoute(ctx),
        sponsor: () => this._renderSponsorRoute(ctx),
        agent: () => this._renderAgentRoute(),
        session: () => this._renderSessionRoute(ctx),
      },
      renderNotFound: (path) => <NotFoundRoute path={path} />,
    });
  };


  // Used by Navbar faucet button
  getUserTestETH = async () => {
    try { await faucetFundingPort.sendTestnetFunds(this.props.account as string); }
    catch (e) { mainSiteLog.error('Faucet error:', e); }
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
    if (
      this.isBuiltInDemoSessionRoutePath() &&
      (normalizedSlug === 'demo' || normalizedSlug === '')
    ) {
      this.seedBuiltInDemoQuestionCache();
      return;
    }
    return this._questionCacheController.refreshQuestionMetadataForGroup(slug, opts);
  };

  refreshQuestionResponses: RefreshQuestionResponsesFn = (questionIds, opts) =>
    this._responseHydrationController.refreshQuestionResponses(questionIds, opts);

  render() {
    const mainViewDisplay = this.getMainView(null);

    return (
      <>
        <OnboardingOverlay />

        <Navbar
          toggleLoginModal={this.props.toggleLoginModal}
          updateLoginInfo={this.props.updateLoginInfo}
          toggleDemoMode={this.props.toggleDemoMode}
          demoMode={this.props.demoMode}
          account={this.props.account}
          provider={this.props.provider}  // <--- provider is a string name; pass through unchanged
          focusedTab={this.props.focusedTab}
          loginComplete={this.props.loginComplete}
          loginInProgress={this.props.loginInProgress}
          sendTestETH={this.getUserTestETH}
        />

        <DevE2eNav />

        {mainViewDisplay}

        <Footer
          toggleLoginModal={this.props.toggleLoginModal}
        />
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

const MainSiteWithWagmiHooks = WagmiHooksHOC(MainSite);

export const mainSiteDispatchActions = {
  fetchAccount,
  changeAccount,
  fetchSessionState,
  changeFocusedTab,
  toggleLoginModal,
  updateLoginInfo,
  toggleDemoMode,
  changeActiveSessionSlug
};

export default connect(mapStateToProps, mainSiteDispatchActions)(MainSiteWithWagmiHooks) as React.ComponentType<Record<string, unknown>>;
