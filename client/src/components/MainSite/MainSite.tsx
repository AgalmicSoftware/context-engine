/** @file MainSite.tsx */

import React, { Component, Suspense } from "react";
import { connect } from 'react-redux';
import { fetchAccount } from '../../actions/accountActions.js';
import {
  fetchSessionState,
  changeFocusedTab,
  toggleLoginModal,
  updateLoginInfo,
  toggleDemoMode,
  changeActiveSessionSlug,
} from '../../actions/sessionStateActions.js';
import type { MainSiteProps, MainSiteState, AnyRecord } from './MainSiteTypes';



// Styles
import "assets/css/contextEngine.scss";
import stylesRaw from "./MainSite.module.scss";

// Smart contract events / interactions
import contractScriptsRaw, {
  getAllSessionSlugs,
  getDemoSessionConfigBySlug,
  getSessionConfigBySlug,
  getSessionConfigBySlugOrDefault,
  getSessionSlugByName,
  normalizeSessionSlug,
} from '../../utilities/web3/contractScripts.js';
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
import {
  loadGroupRegistryCache,
  SESSION_REGISTRY_CACHE_UPDATED_EVENT,
  sessionRegistryStore,
  sessionRegistryUtils,
} from '../../utilities/web3/sessionRegistry.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import {
  getAllowedSessionSlugs,
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import { derivePrimarySessionSlugFromList } from '../../utilities/session/globalSessionState.js';
import {
  refreshSessionInfoForSlug,
  refreshSessionMetaFieldsForSlug,
} from '../../utilities/session/sessionMetaController.js';
import { createSessionScanPolicy } from '../../utilities/session/mainSiteSessionScanPolicy.js';
import { createSessionProfileScanController } from '../../utilities/session/sessionProfileScanController.js';
import { createSessionSbtCacheController } from '../../utilities/sbt/sessionSbtCacheController.js';
import { createSessionSurveyCacheController } from 'utilities/survey/sessionSurveyCacheController';
import { createSessionQuestionCacheController } from 'utilities/survey/sessionQuestionCacheController';
import { createSessionResponseHydrationController } from 'utilities/survey/sessionResponseHydrationController';
import { resolveSessionRegistryBootstrapChainIds } from '../../utilities/session/registryBootstrapChainIds.js';
import { t } from '../../utilities/ui/terminology.js';
import {
  initCacheManager,
  subscribeCacheUpdates,
} from '../../utilities/cache/cacheScripts.js';
import { createMainSiteDgStorage } from '../../utilities/cache/mainSiteDgStorage.js';
import { createSessionCachePersistenceController } from '../../utilities/cache/sessionCachePersistenceController.js';
import { createSessionCacheReadinessController } from '../../utilities/cache/sessionCacheReadinessController.js';
import {
  ensureQuestionArweaveCacheBranches,
  mergeQuestionArweaveCacheBranches,
} from '../../utilities/arweave/arweaveRetryHelpers.js';
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
import FooterRaw from "../Footer/Footer";
import LazyFallbackRaw from "../Shared/LazyFallback";
import DevE2eNavRaw from "../E2E/DevE2eNav";
import RouteErrorBoundaryRaw from '../ErrorBoundary/RouteErrorBoundary';

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
} from '../../utilities/session/mainSiteSessionConfig.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  resolveMainSiteQuestionRouteSessionContext,
  resolveMainSiteRenderActiveSessionSlug,
  resolveMainSiteRouteSessionIdHint,
  resolveMainSiteRouteSessionSlugHint,
  resolveMainSiteSessionRouteContext,
  resolveMainSiteSessionSlugFromPathToken,
} from './routeSessionResolution.js';
import { resolveMainSiteLitSessionConfig } from './litSessionConfig.js';
import {
  buildMetadataSessionCacheEnvelope as buildMetadataSessionCacheEnvelopeFn,
  resolveMetadataSessionBinding as resolveMetadataSessionBindingFn,
  resolveMetadataSessionSlug as resolveMetadataSessionSlugFn,
  resolveScopedMetadataSessionSlug as resolveScopedMetadataSessionSlugFn,
} from './metadataSessionBinding.js';
import {
  prepareSurveyMetadataCacheEntry as prepareSurveyMetadataCacheEntryFn,
  prepareQuestionMetadataCacheEntry as prepareQuestionMetadataCacheEntryFn,
} from './metadataCacheEntryBuilders.js';
import {
  DG_PRIMARY_ROUTE_CACHE_NAMES,
  SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX,
} from './cacheConstants.js';
import {
  isRouteResponderAddress,
} from './mainSiteUtils.js';
import {
  ExperimentalStub as ExperimentalStubRaw,
  NotFoundRoute as NotFoundRouteRaw,
  readHashQueryParam,
  SessionLoadingSkeleton as SessionLoadingSkeletonRaw,
} from './routeStatusViews';
import {
  KNOWN_ROUTE_PREFIXES,
  isStaticNonCacheRoute,
  QUESTION_RESULTS_RE,
  SURVEY_RESULTS_RE,
  VALID_SURVEY_ID_RE,
} from './routeConfig.js';
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
} from './progressHelpers.js';

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
} from './progressHelpers.js';

const mainSiteLog = createLogger('mainSite');

const PROFILE_SCAN_REPORT_EVENT = 'ce:profile-scan-report';
const styles: any = stylesRaw;
const contractScripts: any = contractScriptsRaw as any;
const WagmiHooksHOC: any = WagmiHooksHOCRaw;
const Navbar: any = NavbarRaw;
const MainAreaTabs: any = MainAreaTabsRaw;
const RightSide: any = RightSideRaw;
const OnboardingOverlay: any = OnboardingOverlayRaw;
const Footer: any = FooterRaw;
const LazyFallback: any = LazyFallbackRaw;
const DevE2eNav: any = DevE2eNavRaw;
const RouteErrorBoundary: any = RouteErrorBoundaryRaw;
const ExperimentalStub: any = ExperimentalStubRaw;
const NotFoundRoute: any = NotFoundRouteRaw;
const SessionLoadingSkeleton: any = SessionLoadingSkeletonRaw;
const AboutPage: any = AboutPageRaw;
const AdminPage: any = AdminPageRaw;
const AgentPage: any = AgentPageRaw;
const DebateMap: any = DebateMapRaw;
const BookmarksPage: any = BookmarksPageRaw;
const CompareAddresses: any = CompareAddressesRaw;
const ContractPage: any = ContractPageRaw;
const DemosIndex: any = DemosIndexRaw;
const OnePageSession: any = OnePageSessionRaw;
const RiskMatrixDemo: any = RiskMatrixDemoRaw;
const SBTPage: any = SBTPageRaw;
const SBTsPage: any = SBTsPageRaw;
const SessionDocumentsPage: any = SessionDocumentsPageRaw;
const SessionWizard: any = SessionWizardRaw;
const SimulatedUserPage: any = SimulatedUserPageRaw;
const SponsorPage: any = SponsorPageRaw;
const SurveyPage: any = SurveyPageRaw;
const SurveyTool: any = SurveyToolRaw;
const TagPage: any = TagPageRaw;
const UserPage: any = UserPageRaw;


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

  _cacheReadinessController: any = createSessionCacheReadinessController({
    getState: () => this.state,
    setState: (updater: any, cb: any) => (this.setState as any)(updater, cb),
    isMounted: () => this._mounted,
    resolveActiveSlug: () => this.resolveActiveSlugForCacheUpdates(),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    syncCacheHasLoadedFlagFromPersistent: (slug: any, opts: any) => this.syncCacheHasLoadedFlagFromPersistent(slug, opts),
    readFlag: (name: any, slug: any) => this.readFlag(name, slug),
    isInitInFlight: (slug: any) => ({
      question: !!this._questionCacheController?.isInitInFlight?.(slug),
      survey: !!this._surveyCacheController?.isInitInFlight?.(slug),
      response: !!this._responseHydrationController?.isInitInFlight?.(slug),
    }),
  });

  _cachePersistenceController: any = createSessionCachePersistenceController({
    dgRead: (name: any, slug: any) => this.DG.read(name, slug),
    dgWrite: (name: any, slug: any, obj: any) => this.DG.write(name, slug, obj),
    isMounted: () => this._mounted,
    getActiveSlug: () => this.getSessionSlugFromState(),
    setState: (updater: any, cb: any) => (this.setState as any)(updater, cb),
  });

  _queuedSurveyGroupScanId: any = null;
  _queuedSurveyGroupScanHintedSlug = '';
  _queuedSurveyGroupScanTimer: any = null;
  _surveyGroupScanInFlight = new Set<any>();
  _scanPolicy: any = createSessionScanPolicy({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getCurrentPath: () => this.getCurrentPathname(),
    getSessionSlugHintFromSearch: (search: any) => this.getSessionSlugHintFromSearch(search),
    getSessionTokenFromPath: (path: any) => this.getSessionTokenFromPath(path),
    isSbtListRoutePath: (path: any) => this.isSbtListRoutePath(path),
  });
  _profileScanController: any = createSessionProfileScanController({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionSlugFromState: () => this.getSessionSlugFromState(),
    getSessionChainId: (slug: any) => this.getSessionChainId(slug),
    getSessionCfg: (slug: any) => this.getSessionCfg(slug),
    getSessionScanScopeContext: (scope: any = undefined) => this.getSessionScanScopeContext(scope),
    getScopedSessionSlugs: (scope: any) => this.getScopedSessionSlugs(scope),
    isSessionSlugAllowedForScan: (slug: any, ctx: any) => this.isSessionSlugAllowedForScan(slug, ctx),
    getScopeFilteredSlugs: (slugs: any, scope: any) => this.getScopeFilteredSlugs(slugs, scope),
    getAccount: () => this.props.account,
    getProvider: () => this.props.provider,
    getNetworkId: () => Number(this.props?.network?.id || this.props?.network?.chainId || 0) || null,
    isMounted: () => this._mounted !== false,
    scanSpecificUserProfile: (address: any) => this.scanSpecificUserProfile(address),
  });
  _sbtCacheController: any = createSessionSbtCacheController({
    setState: (...args: any[]) => (this.setState as any)(...args),
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (...args: any[]) => (this.DG.read as any)(...args),
    dgWrite: (...args: any[]) => (this.DG.write as any)(...args),
    dgKey: (...args: any[]) => (this.DG.key as any)(...args),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (s: any) => this.getSessionCfg(s),
    getSessionChainId: (s: any) => this.getSessionChainId(s),
    getSessionScanScope: () => this.getSessionScanScope(),
    getSessionScanScopeContext: (s: any) => this.getSessionScanScopeContext(s),
    getAccount: () => (this.props?.account || ''),
    getCurrentPath: () => (this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
    getEffectiveRoutePath: (...args: any[]) => (this.getEffectiveRoutePath as any)(...args),
    getScopeFilteredSlugs: (...args: any[]) => (this.getScopeFilteredSlugs as any)(...args),
    getScopedSessionSlugs: (...args: any[]) => (this.getScopedSessionSlugs as any)(...args),
    shouldSkipSessionScanForSlug: (...args: any[]) => (this.shouldSkipSessionScanForSlug as any)(...args),
    scanScopeNoop: (...args: any[]) => (this.scanScopeNoop as any)(...args),
    logScopeSkipOnce: (...args: any[]) => (this.logScopeSkipOnce as any)(...args),
    isSbtInstanceListenerEnabledForGroup: (...args: any[]) => (this.isSbtInstanceListenerEnabledForGroup as any)(...args),
    shouldAutoRunFullSbtScan: (...args: any[]) => (this.shouldAutoRunFullSbtScan as any)(...args),
    isSbtHistoryScanEnabled: () => this.isSbtHistoryScanEnabled(),
    shouldAttachSbtDetailInstanceListener: () => this.shouldAttachSbtDetailInstanceListener(),
    setReadinessStateIfChanged: (...args: any[]) => (this.setReadinessStateIfChanged as any)(...args),
    checkAllCachesReady: (...args: any[]) => (this.checkAllCachesReady as any)(...args),
    queueLocalRevisionUpdate: (...args: any[]) => (this.queueLocalRevisionUpdate as any)(...args),
    readFlag: (...args: any[]) => (this.readFlag as any)(...args),
    writeFlag: (...args: any[]) => (this.writeFlag as any)(...args),
    refreshEncryptedQuestionPayloadsForGroup: (...args: any[]) => (this.refreshEncryptedQuestionPayloadsForGroup as any)(...args),
    initializeSurveyCacheForGroup: (...args: any[]) => (this.initializeSurveyCacheForGroup as any)(...args),
    runWithGeneralSessionBackfill: (...args: any[]) => (this.runWithGeneralSessionBackfill as any)(...args),
    mergeLegacyNumericNetworkKey: (...args: any[]) => (this.mergeLegacyNumericNetworkKey as any)(...args),
  });
  _surveyCacheController: any = createSessionSurveyCacheController({
    setState: (...a: any[]) => (this.setState as any)(...a),
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (...a: any[]) => (this.DG.read as any)(...a),
    dgWrite: (...a: any[]) => (this.DG.write as any)(...a),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (...a: any[]) => (this.getSessionCfg as any)(...a),
    getSessionChainId: (...a: any[]) => (this.getSessionChainId as any)(...a),
    getAccount: () => this.props.account,
    getCurrentPath: () => this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    shouldSkipSessionScanForSlug: (...a: any[]) => (this.shouldSkipSessionScanForSlug as any)(...a),
    scanScopeNoop: (...a: any[]) => (this.scanScopeNoop as any)(...a),
    logScopeSkipOnce: (...a: any[]) => (this.logScopeSkipOnce as any)(...a),
    setReadinessStateIfChanged: (...a: any[]) => (this.setReadinessStateIfChanged as any)(...a),
    checkAllCachesReady: (...a: any[]) => (this.checkAllCachesReady as any)(...a),
    readFlag: (...a: any[]) => (this.readFlag as any)(...a),
    writeFlag: (...a: any[]) => (this.writeFlag as any)(...a),
    mergeLegacyNumericNetworkKey: (...a: any[]) => (this.mergeLegacyNumericNetworkKey as any)(...a),
    initializeQuestionCacheForGroup: (...a: any[]) => (this.initializeQuestionCacheForGroup as any)(...a),
    writeSurveyMetadataToCache: (...a: any[]) => (this.writeSurveyMetadataToCache as any)(...a),
    queueLocalRevisionUpdate: (...a: any[]) => (this.queueLocalRevisionUpdate as any)(...a),
    getSessionScanScope: () => this.getSessionScanScope(),
  });
  _questionCacheController: any = createSessionQuestionCacheController({
    setState: (...a: any[]) => (this.setState as any)(...a),
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (...a: any[]) => (this.DG.read as any)(...a),
    dgWrite: (...a: any[]) => (this.DG.write as any)(...a),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (...a: any[]) => (this.getSessionCfg as any)(...a),
    getSessionChainId: (...a: any[]) => (this.getSessionChainId as any)(...a),
    getSessionScanScope: () => this.getSessionScanScope(),
    getAccount: () => this.props.account,
    getProviderLike: () => this.props.provider,
    getNetwork: () => this.props?.network || null,
    scanScopeNoop: (...a: any[]) => (this.scanScopeNoop as any)(...a),
    setReadinessStateIfChanged: (...a: any[]) => (this.setReadinessStateIfChanged as any)(...a),
    checkAllCachesReady: (...a: any[]) => (this.checkAllCachesReady as any)(...a),
    mergeLegacyNumericNetworkKey: (...a: any[]) => (this.mergeLegacyNumericNetworkKey as any)(...a),
    buildMetadataSessionCacheEnvelope: (...a: any[]) => (this.buildMetadataSessionCacheEnvelope as any)(...a),
    writeQuestionMetadataToCache: (...a: any[]) => (this.writeQuestionMetadataToCache as any)(...a),
    queueLocalRevisionUpdate: (...a: any[]) => (this.queueLocalRevisionUpdate as any)(...a),
  });
  _responseHydrationController: any = createSessionResponseHydrationController({
    setState: (...a: any[]) => (this.setState as any)(...a),
    isMounted: () => this._mounted,
    dgRead: (...a: any[]) => (this.DG.read as any)(...a),
    dgWrite: (...a: any[]) => (this.DG.write as any)(...a),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionChainId: (...a: any[]) => (this.getSessionChainId as any)(...a),
    getAccount: () => this.props.account,
    scanScopeNoop: (...a: any[]) => (this.scanScopeNoop as any)(...a),
    setReadinessStateIfChanged: (...a: any[]) => (this.setReadinessStateIfChanged as any)(...a),
    checkAllCachesReady: (...a: any[]) => (this.checkAllCachesReady as any)(...a),
    mergeLegacyNumericNetworkKey: (...a: any[]) => (this.mergeLegacyNumericNetworkKey as any)(...a),
    queueLocalRevisionUpdate: (...a: any[]) => (this.queueLocalRevisionUpdate as any)(...a),
  });
  _scanSpecificUserProfileInFlight = new Map<any, any>();
  _profileScanTelemetrySeq = 0;
  _cacheReinitRunSeq = 0;
  _activeCacheReinitRunToken = 0;
  _sessionRouteLightDiscoveryInFlight: AnyRecord = {};
  _mounted = false;
  _pendingSessionPathIdResolves = new Set<any>();
  _sessionPathIdResolveAttempts: Record<string, any> = {};
  _sessionPathResolveErrorCounts: Record<string, any> = {};
  _sessionPathResolveLastErrors: Record<string, any> = {};
  _sessionPathResolveRetryTimers: Record<string, any> = {};
  _pendingSessionPathSlugResolves = new Set<any>();
  _sessionPathSlugResolveAttempts: Record<string, any> = {};
  _sessionMetaAttempts: Record<string, any> = {};
  _lastSessionInfoAttempt = '';
  _lastGroupChainId: number | null = null;
  _cacheUpdateUnsubscribe: (() => void) | null = null;
  _userPriorityPromise: Promise<any> | null = null;
  _userPriorityTarget: string | null = null;
  _sessionFallbackRedirectPath = '';
  _lastProcessedQuestionIdFromPath = '';
  _lastProcessedQuestionSlugFromPath: string | null = null;

  get _registryBootstrapPromise() {
    return (this._profileScanController as any)?._registryBootstrapPromise ?? null;
  }

  set _registryBootstrapPromise(value: any) {
    if (this._profileScanController) {
      (this._profileScanController as any)._registryBootstrapPromise = value;
    }
  }

  get _registryBootstrapScopeKey() {
    return (this._profileScanController as any)?._registryBootstrapScopeKey || '';
  }

  set _registryBootstrapScopeKey(value: any) {
    if (this._profileScanController) {
      (this._profileScanController as any)._registryBootstrapScopeKey = value;
    }
  }

  beginSbtLiveProgress = (...args: any[]) => this._sbtCacheController.beginSbtLiveProgress(...args);

  updateSbtLiveProgress = (...args: any[]) => this._sbtCacheController.updateSbtLiveProgress(...args);

  clearSbtLiveProgress = (...args: any[]) => this._sbtCacheController.clearSbtLiveProgress(...args);

  setSbtRealtimeCoverageForGroup = (...args: any[]) => this._sbtCacheController.setSbtRealtimeCoverageForGroup(...args);

  clearSbtRealtimeCoverageForGroup = (...args: any[]) => this._sbtCacheController.clearSbtRealtimeCoverageForGroup(...args);

  normalizeSbtRealtimeEventCursor = (...args: any[]) => this._sbtCacheController.normalizeSbtRealtimeEventCursor(...args);

  compareSbtRealtimeEventCursor = (...args: any[]) => this._sbtCacheController.compareSbtRealtimeEventCursor(...args);

  removeSbtRealtimeListenersForGroup = (...args: any[]) => this._sbtCacheController.removeSbtRealtimeListenersForGroup(...args);
  normalizeRoutePath = normalizeRoutePathFn;

  isGeneralRoutePath = isGeneralRoutePathFn;

  getEffectiveRoutePath = (pathIn: any = '') => getEffectiveRoutePathFn(pathIn, {
    windowPathIn: typeof window !== 'undefined'
      ? window.location.pathname
      : '',
    redirectPathIn: this._sessionFallbackRedirectPath,
  });

  getSessionFallbackScopeSlugs = () => {
    const scope = String(readSessionScanScope() || '').trim().toLowerCase();
    if (scope !== 'list') return [];

    const dedupeNormalized = (values: any[] = []) => {
      const out: string[] = [];
      const seen = new Set<string>();
      values.forEach((value: any) => {
        const normalized = normalizeSessionSlug(value || '');
        if (seen.has(normalized)) return;
        seen.add(normalized);
        out.push(normalized);
      });
      return out;
    };

    // Reuse the session-scope reader so list-mode redirect behavior stays aligned with
    // URL/localStorage/globalThis precedence and demo-session alias resolution.
    const runtimeScopeSlugs = dedupeNormalized(readSessionScanSlugs());
    if (runtimeScopeSlugs.length) return runtimeScopeSlugs;

    try {
      const entries = sessionRegistryStore.getAllSessionEntries();
      if (!Array.isArray(entries) || !entries.length) return [];
      return dedupeNormalized(
        (entries as any[]).map((entry: any) => {
          const cfg = (Array.isArray(entry) ? entry[1] : entry) as AnyRecord;
          return cfg?.slug || cfg?.sessionSlug || '';
        })
      );
    } catch (_) {
      return [];
    }
  };

  getSessionFallbackPreferredTarget = () => {
    const scopeSlugs = this.getSessionFallbackScopeSlugs();
    if (!scopeSlugs.length) return null;

    const generalInScope = scopeSlugs.some((slug: any) => slug === '' || slug === DEFAULT_SESSION_SLUG_ALIAS);
    if (generalInScope) return null;

    const firstScopedSlug = scopeSlugs.find((slug: any) => slug && slug !== DEFAULT_SESSION_SLUG_ALIAS);
    if (!firstScopedSlug) return null;

    return {
      slug: firstScopedSlug,
      path: `/session/${firstScopedSlug}`,
    };
  };

  isFirstVisitRootRedirectEnabled = () => {
    try {
      const runtimeGlobals = globalThis as AnyRecord;
      if (typeof globalThis !== 'undefined' && typeof runtimeGlobals.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED !== 'undefined') {
        return this.readBoolishRuntimeFlag(
          runtimeGlobals.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED,
          !!CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED
        );
      }
    } catch (_) {}
    return !!CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED;
  };

  getFirstVisitRootRedirectTarget = () => {
    if (!this.isFirstVisitRootRedirectEnabled()) return null;

    if (String(readSessionScanScope() || '').trim().toLowerCase() === 'list') {
      // Root boot redirects should follow the saved list ordering, but unlike
      // general-page fallback routing they should still auto-open the first
      // concrete session even when the default/general session is also in scope.
      const firstScopedSlug = derivePrimarySessionSlugFromList(this.getSessionFallbackScopeSlugs());
      if (firstScopedSlug) {
        return {
          slug: firstScopedSlug,
          path: `/session/${firstScopedSlug}`,
        };
      }
    }

    return {
      slug: 'demo',
      path: '/session/demo',
    };
  };

  getSessionFallbackRedirectStorageKey = (slugIn: any = '') => {
    const normalizedSlug = normalizeSessionSlug(slugIn || '');
    const storageSlug = normalizedSlug || DEFAULT_SESSION_SLUG_ALIAS;
    return `${SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX}${storageSlug}`;
  };

  hasConsumedSessionFallbackRedirect = (target: any = null) => {
    if (typeof window === 'undefined' || !window.sessionStorage || !target?.path) return false;
    try {
      return sessionStorage.getItem(this.getSessionFallbackRedirectStorageKey(target.slug)) === 'true';
    } catch (e) {
      mainSiteLog.warn('[MainSite] session fallback redirect read failed', e);
      return false;
    }
  };

  consumeSessionFallbackRedirect = (target: any = null) => {
    if (typeof window === 'undefined' || !window.sessionStorage || !target?.path) return false;
    try {
      sessionStorage.setItem(this.getSessionFallbackRedirectStorageKey(target.slug), 'true');
      return true;
    } catch (e) {
      mainSiteLog.warn('[MainSite] session fallback redirect write failed', e);
      return false;
    }
  };

  isOnOrWithinRoutePath = isOnOrWithinRoutePathFn;

  syncSessionFallbackRedirectConsumption = ({ pathIn = '' }: AnyRecord = {}) => {
    const target = this.getSessionFallbackPreferredTarget();
    if (!target) return null;
    const currentPath = this.getEffectiveRoutePath(pathIn);
    if (this.isOnOrWithinRoutePath(currentPath, target.path)) {
      this.consumeSessionFallbackRedirect(target);
    }
    return target;
  };

  getSessionFallbackRedirectTarget = ({ pathIn = '' }: AnyRecord = {}) => {
    const currentPath = this.getEffectiveRoutePath(pathIn);
    if (!currentPath || currentPath === '/') return null;
    if (!this.isGeneralRoutePath(currentPath)) return null;
    return this.getSessionFallbackPreferredTarget();
  };

  applySessionFallbackRedirect = ({ pathIn = '' }: AnyRecord = {}) => {
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

  mergeLegacyNumericNetworkKey = (cacheObj: any, canonicalNetworkKey: any) => {
    if (!cacheObj || typeof cacheObj !== 'object') return false;
    const networkKey = String(canonicalNetworkKey || '');
    if (!networkKey) return false;
    const altKey = Object.keys(cacheObj).find(
      (k: any) => k !== networkKey && Number(k) === Number(networkKey)
    );
    if (!altKey) return false;
    cacheObj[networkKey] = {
      ...(cacheObj[networkKey] || {}),
      ...(cacheObj[altKey] || {}),
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

  isCacheReinitRunActive = (token: any) => (
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

  setReadinessStateIfChanged = (...args: any[]) => this._cacheReadinessController.setReadinessStateIfChanged(...args);

  syncCacheHasLoadedFlagOnTransition = (...args: any[]) => this._cacheReadinessController.syncCacheHasLoadedFlagOnTransition(...args);

  scheduleCacheUpdateFlush = (...args: any[]) => this._cacheReadinessController.scheduleCacheUpdateFlush(...args);

  queueCacheUpdateFlush = (...args: any[]) => this._cacheReadinessController.queueCacheUpdateFlush(...args);

  flushQueuedCacheUpdates = (...args: any[]) => this._cacheReadinessController.flushQueuedCacheUpdates(...args);

  queueLocalRevisionUpdate = (...args: any[]) => this._cacheReadinessController.queueLocalRevisionUpdate(...args);

  flushLocalRevisionUpdate = (...args: any[]) => this._cacheReadinessController.flushLocalRevisionUpdate(...args);

  handleCrossTabCacheUpdateEvent = (...args: any[]) => this._cacheReadinessController.handleCrossTabCacheUpdateEvent(...args);

  queueSurveyGroupScan = (surveyID: any, opts: any = {}) => {
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

  pruneMaskedQuestionDecryptBackoff = (...args: any[]) => this._questionCacheController.pruneMaskedQuestionDecryptBackoff(...args);

  // Group slug parser
  getSessionTokenFromPath = (pathIn: any = '') => {
    const p = String(this.getEffectiveRoutePath(pathIn) || '').trim();
    if (!p.startsWith('/session/')) return '';
    return (p.split('/').filter(Boolean)[1] || '').trim();
  };

  resolveSessionSlugFromPathToken = (rawToken: any, { allowAsyncResolve = false }: AnyRecord = {}) => {
    const result = resolveMainSiteSessionSlugFromPathToken({
      rawToken,
      formatSessionId: sessionRegistryUtils.formatSessionId,
      resolveSessionConfigById: sessionRegistryStore.getSessionConfigById,
      resolveSessionConfigBySlug: (slug: any) => sessionRegistryStore.getSessionConfig(slug) || getSessionConfigBySlug(slug),
    });
    if (!result && allowAsyncResolve) {
      const sessionId = sessionRegistryUtils.formatSessionId(String(rawToken || '').trim());
      if (sessionId) this.resolveSessionPathId(sessionId);
    }
    return result;
  };

	  resolveSessionPathId = (sessionIdIn: any) => {
	    const sessionId = sessionRegistryUtils.formatSessionId(sessionIdIn);
	    if (!sessionId) return;

	    this._pendingSessionPathIdResolves = (this._pendingSessionPathIdResolves || new Set()) as any;
	    this._sessionPathIdResolveAttempts = this._sessionPathIdResolveAttempts || {};
	    this._sessionPathResolveErrorCounts = this._sessionPathResolveErrorCounts || { id: {}, slug: {} };
	    this._sessionPathResolveLastErrors = this._sessionPathResolveLastErrors || { id: {}, slug: {} };
	    this._sessionPathResolveRetryTimers = this._sessionPathResolveRetryTimers || { id: {}, slug: {} };

	    if ((this._pendingSessionPathIdResolves as any).has(sessionId)) return;
	    const now = Date.now();
	    const lastAttempt = Number(this._sessionPathIdResolveAttempts[sessionId] || 0);
	    if (now - lastAttempt < 3000) return;

    this._sessionPathIdResolveAttempts[sessionId] = now;
    (this._pendingSessionPathIdResolves as any).add(sessionId);

		    (async () => {
		      try {
		        const lit = getGlobalLitHooks();
		        const chainIds = getSessionRegistryChainIds();
		        let resolved = false;
		        let lastErr: any = null;
		        for (const chainId of chainIds) {
		          try {
		            // eslint-disable-next-line no-await-in-loop
		            const cfg = await sessionRegistryUtils.fetchSessionFromRegistry({
		              chainId,
		              sessionId,
		              providerLike: this.props.provider,
		              account: this.props.account,
		              lit,
		              bootstrapRpc: true,
		            });
		            if (!cfg) continue;
		            sessionRegistryUtils.upsertSessionRegistryCache({ config: cfg });
		            resolved = true;
		            lastErr = null;
		            break;
		          } catch (err) {
		            lastErr = err;
		          }
		        }

		        if (resolved) {
		          try {
		            if (this._sessionPathResolveErrorCounts?.id) delete this._sessionPathResolveErrorCounts.id[sessionId];
		            if (this._sessionPathResolveLastErrors?.id) delete this._sessionPathResolveLastErrors.id[sessionId];
		            const timers = this._sessionPathResolveRetryTimers?.id;
		            if (timers && timers[sessionId]) {
		              clearTimeout(timers[sessionId]);
		              delete timers[sessionId];
		            }
		          } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
		        } else if (lastErr) {
		          // Record transient failure and retry with exponential backoff (cap 30s).
		          try {
		            const counts = this._sessionPathResolveErrorCounts.id || {};
		            const nextCount = (Number(counts[sessionId] || 0) + 1);
		            counts[sessionId] = nextCount;
		            this._sessionPathResolveErrorCounts.id = counts;

		            const code = lastErr?.code ?? lastErr?.error?.code ?? null;
		            const message = lastErr?.message || lastErr?.error?.message || String(lastErr);
		            this._sessionPathResolveLastErrors.id = this._sessionPathResolveLastErrors.id || {};
		            this._sessionPathResolveLastErrors.id[sessionId] = { ts: Date.now(), code, message };

		            const n = Math.max(0, Math.min(6, nextCount - 1));
			            const delayMs = Math.max(3200, Math.min(30000, Math.round(1500 * Math.pow(2, n))));
			            const timers = this._sessionPathResolveRetryTimers.id || {};
			            if (timers[sessionId]) clearTimeout(timers[sessionId]);
			            timers[sessionId] = setTimeout(() => {
			              try { if (this._mounted) this.resolveSessionPathId(sessionId); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
			            }, delayMs);
			            this._sessionPathResolveRetryTimers.id = timers;
			          } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
			        }

		        const resolvedCfg = sessionRegistryStore.getSessionConfigById(sessionId);
		        if (!resolvedCfg || typeof window === 'undefined') return;

	        const currentPath = window.location.pathname || '';
	        const normalizedCurrentPath = this.normalizeRoutePath(currentPath);
	        const currentToken = this.getSessionTokenFromPath(currentPath);
        const currentSessionId = sessionRegistryUtils.formatSessionId(currentToken);
        if (!currentSessionId || currentSessionId !== sessionId) return;

        // Special-case docs: keep sessionId URLs stable (do not rewrite to slug).
        const currentParts = String(normalizedCurrentPath || '').split('/').filter(Boolean);
        const isDocsSubroute = currentParts.length >= 3 && currentParts[0] === 'session' && currentParts[2] === 'docs';
        if (isDocsSubroute) return;

        const resolvedSlug = normalizeSessionSlug(resolvedCfg.slug || '');
        const canonicalToken = resolvedSlug || DEFAULT_SESSION_SLUG_ALIAS;
        const nextPath = `/session/${canonicalToken}`;
        if (normalizedCurrentPath === nextPath) return;
        const nextUrl = buildPublicUrl(nextPath, window.location.search || '', window.location.hash || '');
        window.history.replaceState({}, '', nextUrl);
	      } catch (err) {
	        mainSiteLog.warn('[SessionRegistry] Failed resolving /session/:sessionId path:', err);
	      } finally {
	        (this._pendingSessionPathIdResolves as any).delete(sessionId);
	        if (this._mounted) {
	          this.setState((prev: any) => ({
	            sessionPathResolutionNonce: Number(prev.sessionPathResolutionNonce || 0) + 1,
	          }));
	        }
	      }
	    })();
	  };

		  resolveSessionPathSlug = (slugIn: any) => {
		    const slug = normalizeSessionSlug(slugIn);
		    if (!slug) return;

	    this._pendingSessionPathSlugResolves = (this._pendingSessionPathSlugResolves || new Set()) as any;
	    this._sessionPathSlugResolveAttempts = this._sessionPathSlugResolveAttempts || {};
	    this._sessionPathResolveErrorCounts = this._sessionPathResolveErrorCounts || { id: {}, slug: {} };
	    this._sessionPathResolveLastErrors = this._sessionPathResolveLastErrors || { id: {}, slug: {} };
	    this._sessionPathResolveRetryTimers = this._sessionPathResolveRetryTimers || { id: {}, slug: {} };

	    if ((this._pendingSessionPathSlugResolves as any).has(slug)) return;
	    const now = Date.now();
	    const lastAttempt = Number(this._sessionPathSlugResolveAttempts[slug] || 0);
	    if (now - lastAttempt < 3000) return;

    this._sessionPathSlugResolveAttempts[slug] = now;
    (this._pendingSessionPathSlugResolves as any).add(slug);

		    (async () => {
		      try {
		        const lit = getGlobalLitHooks();
		        const chainIds = getSessionRegistryChainIds();
		        let resolved = false;
		        let lastErr: any = null;
		        for (const chainId of chainIds) {
		          try {
		            // eslint-disable-next-line no-await-in-loop
		            const cfg = await sessionRegistryUtils.fetchSessionFromRegistry({
		              chainId,
		              slug,
		              providerLike: this.props.provider,
		              account: this.props.account,
		              lit,
		              bootstrapRpc: true,
		            });
		            if (!cfg) continue;
		            sessionRegistryUtils.upsertSessionRegistryCache({ config: cfg });
		            resolved = true;
		            lastErr = null;
		            break;
		          } catch (err) {
		            lastErr = err;
		          }
		        }

		        if (resolved) {
		          try {
		            if (this._sessionPathResolveErrorCounts?.slug) delete this._sessionPathResolveErrorCounts.slug[slug];
		            if (this._sessionPathResolveLastErrors?.slug) delete this._sessionPathResolveLastErrors.slug[slug];
		            const timers = this._sessionPathResolveRetryTimers?.slug;
		            if (timers && timers[slug]) {
		              clearTimeout(timers[slug]);
		              delete timers[slug];
		            }
		          } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
		        } else if (lastErr) {
		          // Record transient failure and retry with exponential backoff (cap 30s).
		          try {
		            const counts = this._sessionPathResolveErrorCounts.slug || {};
		            const nextCount = (Number(counts[slug] || 0) + 1);
		            counts[slug] = nextCount;
		            this._sessionPathResolveErrorCounts.slug = counts;

		            const code = lastErr?.code ?? lastErr?.error?.code ?? null;
		            const message = lastErr?.message || lastErr?.error?.message || String(lastErr);
		            this._sessionPathResolveLastErrors.slug = this._sessionPathResolveLastErrors.slug || {};
		            this._sessionPathResolveLastErrors.slug[slug] = { ts: Date.now(), code, message };

		            const n = Math.max(0, Math.min(6, nextCount - 1));
			            const delayMs = Math.max(3200, Math.min(30000, Math.round(1500 * Math.pow(2, n))));
			            const timers = this._sessionPathResolveRetryTimers.slug || {};
			            if (timers[slug]) clearTimeout(timers[slug]);
			            timers[slug] = setTimeout(() => {
			              try { if (this._mounted) this.resolveSessionPathSlug(slug); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
			            }, delayMs);
			            this._sessionPathResolveRetryTimers.slug = timers;
			          } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
			        }
			      } catch (err) {
		        mainSiteLog.warn('[SessionRegistry] Failed resolving /session/:slug path:', err);
			      } finally {
				        (this._pendingSessionPathSlugResolves as any).delete(slug);
			        if (this._mounted) {
			          this.setState((prev: any) => ({
			            sessionPathResolutionNonce: Number(prev.sessionPathResolutionNonce || 0) + 1,
			          }));
			        }
	      }
	    })();
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

  getExplicitSessionSlugFromProps = (props: any = this.props, { allowAsyncResolve = true }: AnyRecord = {}) => {
    const path = props === this.props
      ? this.getEffectiveRoutePath(
        props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
      )
      : this.normalizeRoutePath(props?.path || '');
    const parts = String(path || '').split('/').filter(Boolean);
    const sessionToken = parts[0] === 'session' && parts[1]
      ? String(parts[1] || '').trim()
      : '';
    if (!sessionToken) {
      return { hasExplicitSessionSlug: false, sessionSlug: '' };
    }
    if (sessionToken.toLowerCase() === 'new') {
      return { hasExplicitSessionSlug: true, sessionSlug: '' };
    }

    const resolvedSessionSlug = this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve });
    if (resolvedSessionSlug) {
      return { hasExplicitSessionSlug: true, sessionSlug: resolvedSessionSlug };
    }

    if (normalizeSessionSlug(sessionToken) === '') {
      return { hasExplicitSessionSlug: true, sessionSlug: '' };
    }

    return { hasExplicitSessionSlug: false, sessionSlug: '' };
  };

  getGlobalPrimarySessionSlugFromProps = (props: any = this.props) => {
    const primarySessionSlug = normalizeSessionSlug(props?.sessionState?.primarySessionSlug || '');
    const primarySessionExplicit = props?.sessionState?.primarySessionExplicit === true;
    const selectedSessionScope = String(props?.sessionState?.selectedSessionScope || '').trim().toLowerCase();
    const selectedSessionSlugs = Array.isArray(props?.sessionState?.selectedSessionSlugs)
      ? props.sessionState.selectedSessionSlugs
      : [];
    const listIncludesGeneral = selectedSessionSlugs.some((slug: any) => normalizeSessionSlug(slug || '') === '');
    if (primarySessionSlug) return primarySessionSlug;
    if (primarySessionExplicit) {
      if (selectedSessionScope === 'list' && !listIncludesGeneral) {
        return derivePrimarySessionSlugFromList(selectedSessionSlugs);
      }
      return primarySessionSlug;
    }
    if (selectedSessionScope === 'list') {
      return derivePrimarySessionSlugFromList(selectedSessionSlugs);
    }
    return '';
  };

  getSessionSlugFromProps = (props: any = this.props) => {
    const routeSession = this.getExplicitSessionSlugFromProps(props, { allowAsyncResolve: true });
    if (routeSession.hasExplicitSessionSlug) return routeSession.sessionSlug;
    const activeSessionSlug = props.activeSessionSlug || '';
    const primarySessionExplicit = props?.sessionState?.primarySessionExplicit === true;
    const selectedSessionScope = String(props?.sessionState?.selectedSessionScope || '').trim().toLowerCase();
    const selectedSessionSlugs = Array.isArray(props?.sessionState?.selectedSessionSlugs)
      ? props.sessionState.selectedSessionSlugs
      : [];
    const listIncludesGeneral = selectedSessionSlugs.some((slug: any) => normalizeSessionSlug(slug || '') === '');
    if (activeSessionSlug) return activeSessionSlug;
    if (primarySessionExplicit) {
      if (selectedSessionScope === 'list' && !listIncludesGeneral) {
        return derivePrimarySessionSlugFromList(selectedSessionSlugs);
      }
      return activeSessionSlug;
    }
    if (selectedSessionScope === 'list') {
      return derivePrimarySessionSlugFromList(selectedSessionSlugs);
    }
    return '';
  };

  getDisplaySessionCfg = (slugIn: any) => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    const strictCfg = this.getSessionCfg(normalized);
    if (strictCfg) return strictCfg;
    return getDemoSessionConfigBySlug(normalized, { allowDemoFallback: true }) || null;
  };

  getDisplaySessionChainId = (slugIn: any) => {
    const strictChainId = this.getSessionChainId(slugIn);
    if (strictChainId) return strictChainId;
    const cfg = this.getDisplaySessionCfg(slugIn);
    const chainId = Number(cfg?.networkChainId || 0);
    return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
  };

  getDisplaySessionNetwork = (slugIn: any) => {
    const strictNetwork = this.getSessionNetwork(slugIn);
    if (strictNetwork?.id) return strictNetwork;
    const chainId = this.getDisplaySessionChainId(slugIn);
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

  handleSessionRegistryCacheUpdated = () => {
    if (!this._mounted) return;
    this.setState((prev: any) => ({
      sessionRegistryRevision: Number(prev?.sessionRegistryRevision || 0) + 1,
    }), () => {
      if (!this._mounted) return;
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

  getBootstrapActiveSessionSlug = (pathIn: any = '', searchIn: any = '') => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    const search = typeof searchIn === 'string'
      ? searchIn
      : ((typeof window !== 'undefined' ? window.location.search : '') || '');
    return this.getRenderActiveSessionSlug(path, search);
  };

  getRenderActiveSessionSlug = (pathIn: any = '', searchIn: any = '') => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    return resolveMainSiteRenderActiveSessionSlug({
      path,
      search: searchIn,
      activeSessionSlug: this.getGlobalPrimarySessionSlugFromProps(this.props),
      isCacheManagerReady: this.state.isCacheManagerReady,
      getSessionConfigBySlug,
      resolveDisplaySessionConfigBySlug: (slug: any) => (
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
      ),
      resolveSessionConfigById: (sessionId: any) => sessionRegistryStore.getSessionConfigById(sessionId),
      resolveSessionSlugFromPathToken: (sessionToken: any) => (
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true })
      ),
    });
  };

  resolveTrustedSbtRouteSessionSlug = (searchIn: any = '') => {
    const hintedSlug = resolveMainSiteRouteSessionSlugHint({
      search: searchIn,
      allowSessionIdLookup: true,
      resolveSessionConfigById: (sessionId: any) => (
        sessionRegistryStore.getSessionConfigById(
        sessionRegistryUtils.formatSessionId(sessionId) || sessionId
        )
      ),
    });
    if (hintedSlug == null) return null;

    const normalizedHint = normalizeSessionSlug(hintedSlug || '');
    if (isKnownOrGeneralSessionSlug(normalizedHint, getSessionConfigBySlug)) {
      return normalizedHint;
    }
    if (sessionRegistryStore.getSessionConfig(normalizedHint)) {
      return normalizedHint;
    }
    if (getDemoSessionConfigBySlug(normalizedHint, { allowDemoFallback: true })) {
      return normalizedHint;
    }
    return null;
  };

  resolvePinnedSbtDetailRouteSlug = async (sbtAddress: any, opts: any = {}) => {
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

  getSbtAddressFromPath = (pathIn: any) => {
    const p = pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const clean = String(p || '').split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    if (!['sbt', 'group'].includes(parts[0]) || !parts[1]) return null;
    const addr = parts[1];
    return ethers.utils.isAddress(addr) ? addr : null;
  };

  isSbtListRoutePath = (pathIn: any = '') => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    const clean = String(path || '').split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const root = String(parts[0] || '').trim().toLowerCase();
    if (root !== 'sbts' && root !== 'groups') return false;
    const slugOrMode = String(parts[1] || '').trim().toLowerCase();
    if (!slugOrMode) return true;
    return slugOrMode !== 'new';
  };

  getSbtListRouteSessionSlug = (pathIn: any = '') => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    const clean = String(path || '').split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    const root = String(parts[0] || '').trim().toLowerCase();
    if (root !== 'sbts' && root !== 'groups') return '';
    const slugOrMode = String(parts[1] || '').trim();
    if (!slugOrMode || slugOrMode.toLowerCase() === 'new') return '';
    return normalizeSessionSlug(slugOrMode);
  };

  getUserAddressFromPath = (pathIn: any) => {
    const p = pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const clean = String(p || '').split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    if (!parts.length) return null;
    if (parts[0] === 'u' && parts[1]) {
      const addr = parts[1];
      return ethers.utils.isAddress(addr) ? addr : null;
    }
    const addr = parts[0];
    return ethers.utils.isAddress(addr) ? addr : null;
  };

  redirectLegacyDemoPath = () => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname || this.props.path || '';
    const strippedPath = stripConfiguredPublicBasePath(path);
    if (!/^\/demo(?:\/|$)/i.test(strippedPath)) return false;
    const nextPath = this.normalizeRoutePath(strippedPath);
    const search = window.location.search || '';
    const hash = window.location.hash || '';
    window.history.replaceState({}, '', buildPublicUrl(nextPath, search, hash));
    return true;
  };

  syncLitHooks = () => {
    if (typeof window === 'undefined') return;
    const slug = this.getActiveSessionSlug();
    const cfg = getSessionConfigBySlugOrDefault(slug) || {};
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
    this.setState({ litHooks: hooks });
  };

  getSessionInfoForGroup = (sessionConfig: any = {}, slug: any = '') => {
    const overrides = (this.state.sessionInfoOverrides || {}) as AnyRecord;
    const resolvedSlug = normalizeSessionSlug(sessionConfig?.slug || slug || '');
    const override = overrides[String(resolvedSlug || '')];
    if (override !== undefined && override !== null) return override;
    if (this.hasEncryptedSessionField(sessionConfig, 'sessionInfo')) return 'Encrypted';
    const fallbackCfg = getDemoSessionConfigBySlug(resolvedSlug, { allowDemoFallback: true }) || {};
    return (
      sessionConfig?.sessionInfo ||
      sessionConfig?.info ||
      sessionConfig?.description ||
      fallbackCfg?.sessionInfo ||
      fallbackCfg?.info ||
      fallbackCfg?.description ||
      ''
    );
  };

  getSessionNameForGroup = (sessionConfig: any = {}, slug: any = '') => {
    const overrides = (this.state.sessionNameOverrides || {}) as AnyRecord;
    const resolvedSlug = normalizeSessionSlug(sessionConfig?.slug || slug || '');
    const override = overrides[String(resolvedSlug || '')];
    if (override !== undefined && override !== null) return override;
    if (this.hasEncryptedSessionField(sessionConfig, 'sessionName')) return 'Encrypted';
    const fallbackCfg = getDemoSessionConfigBySlug(resolvedSlug, { allowDemoFallback: true }) || {};
    return (
      sessionConfig?.sessionName ||
      sessionConfig?.name ||
      sessionConfig?.title ||
      fallbackCfg?.sessionName ||
      fallbackCfg?.name ||
      fallbackCfg?.title ||
      ''
    );
  };

  hasEncryptedSessionField = (sessionConfig: any = {}, field: any = '') => {
    const encryptedFields = (
      sessionConfig?.encryptedFields && typeof sessionConfig.encryptedFields === 'object'
    ) ? sessionConfig.encryptedFields : null;
    if (field === 'sessionName') {
      return !!(
        encryptedFields?.sessionName ||
        sessionConfig?.sessionNameEncrypted ||
        sessionConfig?.encryptedSessionName
      );
    }
    if (field === 'sessionInfo') {
      return !!(
        encryptedFields?.sessionInfo ||
        sessionConfig?.sessionInfoEncrypted ||
        sessionConfig?.encryptedSessionInfo
      );
    }
    return false;
  };

  getSessionHeaderForGroup = (sessionConfig: any = {}, slug: any = '') => {
    const overrides = (this.state.sessionHeaderOverrides || {}) as AnyRecord;
    const resolvedSlug = normalizeSessionSlug(sessionConfig?.slug || slug || '');
    const override = overrides[String(resolvedSlug || '')];
    if (override !== undefined && override !== null) {
      return normalizeArweaveUrl(override, { contextLabel: 'session_header_image' });
    }
    const headerValue =
      sessionConfig?.sessionHeaderImg ||
      sessionConfig?.sessionHeader ||
      sessionConfig?.headerImage ||
      sessionConfig?.header ||
      '';
    if (headerValue) {
      return normalizeArweaveUrl(headerValue, {
        contextLabel: 'session_header_image',
      });
    }
    const fallbackCfg = getDemoSessionConfigBySlug(resolvedSlug, { allowDemoFallback: true }) || {};
    return normalizeArweaveUrl(
      fallbackCfg?.sessionHeaderImg ||
      fallbackCfg?.sessionHeader ||
      fallbackCfg?.headerImage ||
      fallbackCfg?.header ||
      '',
      {
      contextLabel: 'session_header_image',
      }
    );
  };

  refreshSessionInfo = async () => {
    const slug = this.getActiveSessionSlug();
    const cfg = getSessionConfigBySlugOrDefault(slug) || {};
    const litHooks = getGlobalLitHooks();
    try {
      const result = await refreshSessionInfoForSlug({
        slug,
        cfg,
        account: this.props.account || '',
        providerLike: this.props.provider,
        getKey: litHooks?.getKey,
        lastAttemptKey: this._lastSessionInfoAttempt,
        decryptEnvelopeValue: cryptoUtils.decryptEnvelopeValue,
      });
      this._lastSessionInfoAttempt = result.attemptKey || this._lastSessionInfoAttempt;
      if (!result.shouldUpdate) return;
      this.setState((prev: any) => ({
        sessionInfoOverrides: {
          ...(prev.sessionInfoOverrides || {}),
          [slug]: result.nextValue,
        },
      }));
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
  };

  refreshSessionMetaFields = async () => {
    const slug = this.getActiveSessionSlug();
    const cfg = getSessionConfigBySlugOrDefault(slug) || {};
    const litHooks = getGlobalLitHooks();
    try {
      const result = await refreshSessionMetaFieldsForSlug({
        slug,
        cfg,
        account: this.props.account || '',
        providerLike: this.props.provider,
        getKey: litHooks?.getKey,
        attempts: this._sessionMetaAttempts,
        decryptEnvelopeValue: cryptoUtils.decryptEnvelopeValue,
      });

      this._sessionMetaAttempts = result.attempts;
      result.errors.forEach(({ error }: any) => {
        mainSiteLog.warn('MainSite: fallback', error);
      });

      if (!Object.keys(result.patches || {}).length) return;
      this.setState((prev: any) => {
        const nextState: Record<string, any> = {};
        Object.entries(result.patches).forEach(([stateKey, patch]: any) => {
          nextState[stateKey] = {
            ...(prev[stateKey] || {}),
            ...patch,
          };
        });
        return nextState;
      });
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
  };

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
        const fromWindow = Number((window as any).CE_SURVEY_DEEPLINK_RPC_TIMEOUT_MS);
        if (Number.isFinite(fromWindow) && fromWindow > 0) return Math.floor(fromWindow);
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    return 12000;
  };

  resolveMetadataSessionBinding = (metadata: any, fallbackSlug: any = '') => (
    resolveMetadataSessionBindingFn(metadata, fallbackSlug)
  );

  resolveMetadataSessionSlug = (metadata: any, fallbackSlug: any = '') => (
    resolveMetadataSessionSlugFn(metadata, fallbackSlug)
  );

  resolveScopedMetadataSessionSlug = (metadata: any, fallbackSlug: any = '') => (
    resolveScopedMetadataSessionSlugFn(metadata, fallbackSlug)
  );

  buildMetadataSessionCacheEnvelope = (metadata: any, fallbackSlug: any = '', options: any = {}) => (
    buildMetadataSessionCacheEnvelopeFn(metadata, fallbackSlug, options)
  );

  writeSurveyMetadataToCache = (slugIn: any, surveyId: any, surveyData: any, creationBlock: any = null, netKeyIn: any = null, options: any = {}) => {
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

    let groupCache = this.DG.read('surveysCache', slug) || {};
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
    if (!groupCache[netKey].surveys || typeof groupCache[netKey].surveys !== 'object') {
      groupCache[netKey].surveys = {};
    }
    if (!groupCache[netKey].pendingSurveyMetadata || typeof groupCache[netKey].pendingSurveyMetadata !== 'object') {
      groupCache[netKey].pendingSurveyMetadata = {};
    }

    groupCache[netKey].surveys[sid] = normalizedSurveyData;
    if (groupCache[netKey].pendingSurveyMetadata[sid]) {
      try { delete groupCache[netKey].pendingSurveyMetadata[sid]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    }
    this.DG.write('surveysCache', slug, groupCache);
    return true;
  };

  writeQuestionMetadataToCache = (slugIn: any, questionId: any, questionData: any, netKeyIn: any = null, options: any = {}) => {
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

    let questionsCache = this.DG.read('questionsCache', slug) || {};
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
    if (!questionsCache[netKey].questions || typeof questionsCache[netKey].questions !== 'object') {
      questionsCache[netKey].questions = {};
    }
    if (!questionsCache[netKey].pendingQuestionMetadata || typeof questionsCache[netKey].pendingQuestionMetadata !== 'object') {
      questionsCache[netKey].pendingQuestionMetadata = {};
    }
    ensureQuestionArweaveCacheBranches(questionsCache[netKey]);

    questionsCache[netKey].questions[qid] = normalizedQuestionData;
    if (questionsCache[netKey].pendingQuestionMetadata[qid]) {
      try { delete questionsCache[netKey].pendingQuestionMetadata[qid]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    }
    this.DG.write('questionsCache', slug, questionsCache);
    return true;
  };

  findGroupSlugForSurvey = (surveyID: any) => {
    if (!surveyID) return this.getSessionSlugFromState();
    const sid = String(surveyID).toLowerCase();

    const currentSlug = this.getSessionSlugFromState();
    const queryHintSlug = this.getSurveyRouteSessionSlugHint();

    // Helper: Check if a specific slug/group knows this survey
    const getCachedSurveySlug = (slug: any) => {
      const cfg = this.getSessionCfg(slug);
      // 1. Config list
      if (Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
          cfg.HIGHLIGHTED_SURVEY_IDS.some((id: any) => String(id).toLowerCase() === sid)) {
        return slug;
      }
      // 2. Cached data
      const cache = this.DG.read('surveysCache', slug, { clone: false });
      if (cache) {
        // cache is keyed by networkID (string or number)
        for (const netKey in cache) {
          const cachedSurvey = cache[netKey]?.surveys?.[sid];
          if (cachedSurvey) {
            return this.resolveMetadataSessionSlug(cachedSurvey, slug);
          }
        }
      }
      return null;
    };

    if (queryHintSlug !== null) {
      const hintedCachedSlug = getCachedSurveySlug(queryHintSlug);
      if (hintedCachedSlug !== null) return hintedCachedSlug;
      const cfg = this.getSessionCfg(queryHintSlug);
      const isKnown = !!(cfg && !cfg.__unresolved);
      if (isKnown || !this.state.isCacheManagerReady) {
        return queryHintSlug;
      }
    }

    // 1. Check current active group
    const currentCachedSlug = getCachedSurveySlug(currentSlug);
    if (currentCachedSlug !== null) return currentCachedSlug;

    // 2. Check Referrer (prioritize if valid group)
    let refSlug = null;
    let refSlugCandidate = null;
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const match = document.referrer.match(/\/session\/([^/?#]+)/);
        if (match && match[1]) {
          let s = normalizeSessionSlug(match[1].trim());
          refSlugCandidate = s;
          // Keep strict fallback behavior, but still allow cached referrer reads below.
          if (this.getSessionCfg(s)) refSlug = s;
        }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    }
    if (refSlugCandidate != null) {
      const refCachedSlug = getCachedSurveySlug(refSlugCandidate);
      if (refCachedSlug !== null) return refCachedSlug;
    }

    // 3. Fast scan of other groups' CACHES
    for (const s of getAllSessionSlugs()) {
      if (s === currentSlug || s === refSlugCandidate) continue;
      const cachedSlug = getCachedSurveySlug(s);
      if (cachedSlug !== null) return cachedSlug;
    }

    // 4. Fallback: prefer referrer if it was a valid group, else current
    return refSlug !== null ? refSlug : currentSlug;
  }

  getSessionSlugHintFromSearch = (search: any = '') => {
    try {
      return resolveMainSiteRouteSessionSlugHint({
        search,
        allowSessionIdLookup: true,
        resolveSessionConfigById: (sessionId: any) => sessionRegistryStore.getSessionConfigById(sessionId),
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

  getQuestionRouteSessionIdHint = ({ requireResolved = false }: any = {}) => {
    try {
      if (typeof window === 'undefined') return null;
      return resolveMainSiteRouteSessionIdHint({
        search: window.location.search || '',
        requireResolved,
        formatSessionId: sessionRegistryUtils.formatSessionId,
        resolveSessionConfigById: (sessionId: any) => sessionRegistryStore.getSessionConfigById(sessionId),
      });
    } catch (_) {
      return null;
    }
  };

  findGroupSlugForQuestion = (questionID: any) => {
    if (!questionID) return this.getSessionSlugFromState();
    const qid = String(questionID).toLowerCase();
    const currentSlug = this.getSessionSlugFromState();
    const querySlug = this.getQuestionRouteSessionSlugHint();
    const getCachedQuestionSlug = (slug: any) => {
      const qCache = this.DG.read('questionsCache', slug, { clone: false });
      if (qCache) {
        for (const netKey in qCache) {
          const cachedQuestion = qCache[netKey]?.questions?.[qid];
          if (cachedQuestion) {
            return this.resolveMetadataSessionSlug(cachedQuestion, slug);
          }
        }
      }

      const sCache = this.DG.read('surveysCache', slug, { clone: false });
      if (sCache) {
        for (const netKey in sCache) {
          const surveys = sCache[netKey]?.surveys || {};
          for (const sv of Object.values(surveys as Record<string, any>)) {
            const survey: any = sv;
            if (!Array.isArray(survey?.questionIDs)) continue;
            for (let i = 0; i < survey.questionIDs.length; i += 1) {
              if (String(survey.questionIDs[i] || '').toLowerCase() === qid) {
                return this.resolveMetadataSessionSlug(survey, slug);
              }
            }
          }
        }
      }
      return null;
    };

    const querySlugKnown = querySlug !== null && isKnownOrGeneralSessionSlug(querySlug, getSessionConfigBySlug);
    // Preserve explicit query slug while cache/registry state is still bootstrapping.
    // Once hydrated, only keep it pinned if it resolves to a known (or general) session.
    if (querySlug !== null) {
      const hintedCachedSlug = getCachedQuestionSlug(querySlug);
      if (hintedCachedSlug !== null) return hintedCachedSlug;
      if (querySlugKnown || !this.state.isCacheManagerReady) return querySlug;
    }

    const currentCachedSlug = getCachedQuestionSlug(currentSlug);
    if (currentCachedSlug !== null) return currentCachedSlug;

    let refSlug = null;
    let refSlugCandidate = null;
    if (typeof document !== 'undefined' && document.referrer) {
      try {
        const match = document.referrer.match(/\/session\/([^/?#]+)/);
        if (match && match[1]) {
          let s = normalizeSessionSlug(match[1].trim());
          refSlugCandidate = s;
          if (this.getSessionCfg(s)) refSlug = s;
        }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    }
    if (refSlugCandidate != null) {
      const refCachedSlug = getCachedQuestionSlug(refSlugCandidate);
      if (refCachedSlug !== null) return refCachedSlug;
    }

    for (const s of getAllSessionSlugs()) {
      if (s === currentSlug || s === refSlugCandidate) continue;
      const cachedSlug = getCachedQuestionSlug(s);
      if (cachedSlug !== null) return cachedSlug;
    }

    return refSlug !== null ? refSlug : currentSlug;
  }

  resolveGroupSlugForSbtAddress = async (sbtAddress: any, opts: any = {}) => {
    const fallbackSlug = typeof opts.fallbackSlug === 'string'
      ? opts.fallbackSlug
      : (this.getActiveSessionSlug() || '');

    if (!sbtAddress || !ethers.utils.isAddress(sbtAddress)) return fallbackSlug;
    const addrLower = sbtAddress.toLowerCase();
    const scanScope = this.getSessionScanScope();
    const scopedSlugs = scanScope === 'all' ? getAllSessionSlugs() : this.getScopedSessionSlugs(scanScope);

    // 1) Cache scan across groups
    try {
      for (const s of scopedSlugs) {
        const cache = this.DG.read('sbtCache', s, { clone: false });
        if (!cache || typeof cache !== 'object') continue;
        for (const netKey of Object.keys(cache || {})) {
          const entry = cache?.[netKey]?.sbtList?.[addrLower];
          if (entry) return entry.slug != null ? entry.slug : s;
        }
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }

    // 2) Metadata group name
    try {
      const meta = await contractScripts.getSbtMetadata('none', sbtAddress, fallbackSlug);
      const hasExplicitSessionSlug =
        !!(meta &&
          Object.prototype.hasOwnProperty.call(meta, 'sessionSlug') &&
          meta.sessionSlugExplicit === true);
      if (hasExplicitSessionSlug) {
        return normalizeSessionSlug(meta.sessionSlug || '');
      }
      const slugFromName = getSessionSlugByName(meta?.sessionName);
      if (slugFromName != null) return slugFromName;
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }

    if (scanScope !== 'all') {
      // Honor CE_SESSION_SCAN_SCOPE semantics before short-circuiting:
      // - "general" => slug === "" regardless of active/fallback
      // - "active"  => active slug only
      const scoped = scopedSlugs;
      if (!Array.isArray(scoped) || !scoped.length) return fallbackSlug;
      if (scanScope !== 'list') return scoped[0];

      // In list mode, probe every configured slug before falling back.
      for (const scopedSlug of scoped) {
        try {
          const creationBlock = await contractScripts.getSbtCreationBlockByAddress(
            'none',
            sbtAddress,
            scopedSlug
          );
          if (Number.isFinite(creationBlock)) return scopedSlug;
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      }
      return scoped[0];
    }

    // 3) Factory scan across groups (prefer newer block ranges first)
    try {
      const sorted = getAllSessionSlugs()
        .map((s: any) => {
          const cfg = getSessionConfigBySlugOrDefault(s) || {};
          const startRaw = Number(cfg?.blockLimits?.start);
          const start = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : -1;
          return { slug: s, start };
        })
        .sort((a: any, b: any) => (Number(b.start) || 0) - (Number(a.start) || 0));

      for (const { slug } of sorted) {
        const creationBlock = await contractScripts.getSbtCreationBlockByAddress(
          'none',
          sbtAddress,
          slug
        );
        if (Number.isFinite(creationBlock)) return slug;
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }

    return fallbackSlug;
  };

  // NOTE on general-group key suffix:
  // If you keep general.slug === "", DG keys end with a trailing ":" (e.g., "dg:sbtCache:").
  // You indicated keys will NOT end with ":", so if you change general.slug to "general",
  // DG keys become "dg:sbtCache:general" without special-casing here.
  // Per-group localStorage helper (Data by Group = DG)
  DG: any = createMainSiteDgStorage();

  // Session config accessors (extracted to mainSiteSessionConfig.js)
  getSessionCfg = _getSessionCfg;
  getSessionChainId = _getSessionChainId;
  getSessionNetwork = _getSessionNetwork;

  isSbtInstanceListenerEnabledForGroup = (slugIn: any) => this._scanPolicy.isSbtInstanceListenerEnabledForGroup(slugIn);
  isSbtHistoryScanEnabled = () => this._scanPolicy.isSbtHistoryScanEnabled();
  getSessionScanScope = () => this._scanPolicy.getSessionScanScope();
  getSessionScanScopeContext = (scopeIn: any = undefined) => this._scanPolicy.getSessionScanScopeContext(scopeIn);
  hasExplicitProfileScanScopeOverride = (...args: any[]) => this._profileScanController.hasExplicitProfileScanScopeOverride(...args);
  getProfileScanScopeContext = (...args: any[]) => this._profileScanController.getProfileScanScopeContext(...args);

  isSessionSlugAllowedForScan = (slugIn: any, scopeContextIn: any = null) => (
    this._scanPolicy.isSessionSlugAllowedForScan(slugIn, scopeContextIn)
  );
  logScopeSkipOnce = (operation: any, slugIn: any, scopeContextIn: any = null) => (
    this._scanPolicy.logScopeSkipOnce(operation, slugIn, scopeContextIn)
  );
  shouldAutoRunFullSbtScan = (opts: any) => this._scanPolicy.shouldAutoRunFullSbtScan(opts);
  shouldAttachSbtDetailInstanceListener = () => this._scanPolicy.shouldAttachSbtDetailInstanceListener();
  getScopedSessionSlugs = (scopeIn: any) => this._scanPolicy.getScopedSessionSlugs(scopeIn);
  readBoolishRuntimeFlag = (...args: any[]) => this._profileScanController.readBoolishRuntimeFlag(...args);
  isProfileScanTelemetryEnabled = (...args: any[]) => this._profileScanController.isProfileScanTelemetryEnabled(...args);
  emitProfileScanTelemetry = (...args: any[]) => this._profileScanController.emitProfileScanTelemetry(...args);
  isProfileScanColdDiagEnabled = (...args: any[]) => this._profileScanController.isProfileScanColdDiagEnabled(...args);
  emitProfileScanColdDiag = (...args: any[]) => this._profileScanController.emitProfileScanColdDiag(...args);
  readProfileScanStepTimeoutMs = (...args: any[]) => this._profileScanController.readProfileScanStepTimeoutMs(...args);
  readProfileScanSbtBurstSize = (...args: any[]) => this._profileScanController.readProfileScanSbtBurstSize(...args);
  readProfileScanActivityLookbackBlocks = (...args: any[]) => this._profileScanController.readProfileScanActivityLookbackBlocks(...args);
  readUserProfileAllSessionsFlag = (...args: any[]) => this._profileScanController.readUserProfileAllSessionsFlag(...args);
  getUserProfileAllSessionsScanMode = (...args: any[]) => this._profileScanController.getUserProfileAllSessionsScanMode(...args);
  isUserProfileAllSessionsScanEnabled = (...args: any[]) => this._profileScanController.isUserProfileAllSessionsScanEnabled(...args);
  getActiveProfileScanChainId = (...args: any[]) => this._profileScanController.getActiveProfileScanChainId(...args);
  getRegistrySessionEntryCount = (...args: any[]) => this._profileScanController.getRegistrySessionEntryCount(...args);
  getRegistrySessionCoverageCountForChain = (...args: any[]) => this._profileScanController.getRegistrySessionCoverageCountForChain(...args);
  getRegistryBootstrapScopeKey = (...args: any[]) => this._profileScanController.getRegistryBootstrapScopeKey(...args);
  readProfileScanRegistryLookupTimeoutMs = (...args: any[]) => this._profileScanController.readProfileScanRegistryLookupTimeoutMs(...args);
  getProfileScanListScopeSessionConfigCacheKey = (...args: any[]) => this._profileScanController.getProfileScanListScopeSessionConfigCacheKey(...args);
  resolveListScopeSessionConfigFromRegistry = (...args: any[]) => this._profileScanController.resolveListScopeSessionConfigFromRegistry(...args);
  ensureRegistryHydratedForProfileScan = (...args: any[]) => this._profileScanController.ensureRegistryHydratedForProfileScan(...args);
  isOnchainSessionRegistryEnabled = (...args: any[]) => this._profileScanController.isOnchainSessionRegistryEnabled(...args);
  refreshSessionUniverseRegistryCache = (...args: any[]) => this._profileScanController.refreshSessionUniverseRegistryCache(...args);
  resolveProfileDeepScanPlan = (...args: any[]) => this._profileScanController.resolveProfileDeepScanPlan(...args);
  scheduleProfileScanRetryAfterRegistryHydration = (...args: any[]) => this._profileScanController.scheduleProfileScanRetryAfterRegistryHydration(...args);
  getProfileDeepScanSlugs = (...args: any[]) => this._profileScanController.getProfileDeepScanSlugs(...args);

  shouldSkipSessionScanForSlug = (slugIn: any, operation: any, scopeContextIn: any = null) => (
    this._scanPolicy.shouldSkipSessionScanForSlug(slugIn, operation, scopeContextIn)
  );
  scanScopeNoop = (slugIn: any, operation: any, onSkipped: any) => this._scanPolicy.scanScopeNoop(slugIn, operation, onSkipped);
  getScopeFilteredSlugs = (slugs: any[] = [], scopeIn: any = null) => this._scanPolicy.getScopeFilteredSlugs(slugs, scopeIn);
  shouldBackfillGeneralSession = (...args: any[]) => this._profileScanController.shouldBackfillGeneralSession(...args);
  enqueueGeneralSessionBackfill = (...args: any[]) => this._profileScanController.enqueueGeneralSessionBackfill(...args);
  runWithGeneralSessionBackfill = (...args: any[]) => this._profileScanController.runWithGeneralSessionBackfill(...args);

  scanForSurveyGroup = async (surveyID: any, opts: any = {}) => {
    const sid = String(surveyID || '').toLowerCase();

    // 1. Guard: Validate ID and prevent concurrent scans for the same ID
    if (!sid) return;
    if (this.state.isScanningForGroup === sid || this.state.scanFailedFor === sid) return;
    if (this._surveyGroupScanInFlight.has(sid)) return;

    // 2. Check if already exists in CURRENT active cache (optimization)
    const currentSlug = this.getSessionSlugFromState();
    const currentChainId = String(this.getSessionChainId(currentSlug));
    const currentCache = this.DG.read('surveysCache', currentSlug, { clone: false });

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
          .map((slug: any) => normalizeSessionSlug(slug || ''));
        allSlugs = Array.from(new Set(prioritized));
      }
    }

    const rpcTimeoutMs = this.getSurveyDeepLinkRpcTimeoutMs();
    const runWithTimeout = async (promiseFactory: any, label: any, slug: any) => {
      let timeoutId = null;
      try {
        return await Promise.race([
          Promise.resolve().then(() => promiseFactory()),
          new Promise((_: any, reject: any) => {
            timeoutId = setTimeout(() => {
              const err: any = new Error(
                `[MainSite] DeepLink: ${label} timed out after ${rpcTimeoutMs}ms for slug "${String(slug || '')}".`
              );
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
      let scanLoadError: any = null;
      // 3. Iterate known sessions (clamped by CE_SESSION_SCAN_SCOPE when set)
      for (const slug of allSlugs) {
        // Note: current slug was only cache-checked above; still probe RPC here.

        const chainId = this.getSessionChainId(slug);
        if (!chainId) continue;
        const netKey = String(chainId);

        try {
          // A. Scan: Check existence cheaply using hash
          const hash = await runWithTimeout(
            () => contractScripts.getSurveyHash('none', sid, slug),
            'getSurveyHash',
            slug
          );

          if (hash && hash !== ethers.constants.HashZero) {
            mainSiteLog.log(`[MainSite] DeepLink: Match found in session '${slug}'. Fetching full data...`);

            // B. Fetch: Get full JSON data immediately
            const surveyData = await runWithTimeout(
              () => contractScripts.getSurveyDataById('none', sid, slug, {
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

            scanLoadError = new Error(`Survey metadata fetch returned no data for session "${slug}".`) as any;
            scanLoadError.code = 'SURVEY_METADATA_EMPTY';
            scanLoadError.slug = slug;
          }
        } catch (innerErr) {
          mainSiteLog.warn(`[MainSite] Error scanning group '${slug}' for survey ${sid}:`, innerErr);
          scanLoadError = innerErr;
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
        scanErrorMessage: String((err as any)?.message || 'Survey resolution failed unexpectedly.'),
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
  scanSpecificUserProfilePriority = async (targetAddress: any) => {
    if (!targetAddress || !ethers.utils.isAddress(targetAddress)) return;

    const targetLower = targetAddress.toLowerCase();
    if (this._userPriorityPromise && this._userPriorityTarget === targetLower) {
      return this._userPriorityPromise;
    }

    const scanPromise = this.scanSpecificUserProfile(targetAddress);
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

  scanSpecificUserProfile = async (targetAddress: any) => {
    if (!targetAddress || !ethers.utils.isAddress(targetAddress)) return null;

    const targetLower = targetAddress.toLowerCase();
    if (this._scanSpecificUserProfileInFlight.has(targetLower)) {
      return this._scanSpecificUserProfileInFlight.get(targetLower);
    }

    const run = (async () => {
      const allSessionsMode = this.getUserProfileAllSessionsScanMode();
      const scopeContext = this.getProfileScanScopeContext();
      const isListScope = scopeContext.scope === 'list';
      const allowListScopeSbtFanout = (
        isListScope &&
        !allSessionsMode.legacyAllSessions &&
        allSessionsMode.useAllSessionsSbtScan === true
      );
      const allowListScopeSurveyActivityFanout = (
        isListScope &&
        !allSessionsMode.legacyAllSessions &&
        allSessionsMode.useAllSessionsSurveyActivityScan === true
      );
      const allowListScopeQuestionActivityFanout = (
        isListScope &&
        !allSessionsMode.legacyAllSessions &&
        allSessionsMode.useAllSessionsQuestionActivityScan === true
      );
      const allowListScopeAnyFanout = (
        allowListScopeSbtFanout ||
        allowListScopeSurveyActivityFanout ||
        allowListScopeQuestionActivityFanout
      );
      const useAllSessionsScan = isListScope
        ? allowListScopeAnyFanout
        : allSessionsMode.useAllSessionsScan;
      const shouldHydrateRegistry = (
        allSessionsMode.useAllSessionsScan ||
        isListScope
      );
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
      const listScopeCoverageSlugs = isListScope
        ? Array.from(new Set(
            getAllowedSessionSlugs('list', scopeContext.list, scopeContext.activeSlug)
              .map((slug: any) => normalizeSessionSlug(slug || ''))
          ))
        : [];
      const attemptedCoverageSlugs = (
        allowListScopeAnyFanout &&
        listScopeCoverageSlugs.length > 0
      )
        ? listScopeCoverageSlugs
        : [...allSlugs];
      const attemptedCoverageSlugSet = new Set(
        attemptedCoverageSlugs.map((slug: any) => normalizeSessionSlug(slug || ''))
      );
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
      const report = {
        targetAddress: targetLower,
        usedAllSessions: !!profileScanPlan.usedAllSessions,
        useAllSessionsSbtScan: !!(profileScanPlan.usedAllSessions && allSessionsMode.useAllSessionsSbtScan),
        useAllSessionsSurveyActivityScan: !!(profileScanPlan.usedAllSessions && allSessionsMode.useAllSessionsSurveyActivityScan),
        useAllSessionsQuestionActivityScan: !!(profileScanPlan.usedAllSessions && allSessionsMode.useAllSessionsQuestionActivityScan),
        useAllSessionsActivityScan: !!(profileScanPlan.usedAllSessions && allSessionsMode.useAllSessionsActivityScan),
        listScopeSbtFanout: allowListScopeSbtFanout,
        listScopeSurveyActivityFanout: allowListScopeSurveyActivityFanout,
        listScopeQuestionActivityFanout: allowListScopeQuestionActivityFanout,
        attemptedSlugs: [...attemptedCoverageSlugs],
        scannedSlugs: [],
        skippedSlugs: [],
        skippedSlugReasons: {},
        failedSlugs: [],
        failedActivitySlugs: [],
        allActivityFailed: false,
        allSbtFailed: false,
        hadRpcErrors: profileScanPlan.coverageComplete === false,
        anyNewData: false,
        coverageComplete: profileScanPlan.coverageComplete !== false,
        coverageReason: profileScanPlan.coverageReason || '',
        registryEntryCount: Number(profileScanPlan.registryEntryCount || 0),
        hadLoadErrors: !!profileScanPlan.hadLoadErrors,
        rawAllSlugCount: Number(profileScanPlan.rawAllSlugCount || 0),
        activeChainSlugCount: Number(profileScanPlan.activeChainSlugCount || 0),
        scopedFallbackSlugCount: Number(profileScanPlan.scopedFallbackSlugCount || 0),
        relevantSlugs: Array.isArray(profileScanPlan.relevantSlugs)
          ? [...profileScanPlan.relevantSlugs]
          : [],
        prioritizedGeneralFirst: !!profileScanPlan.prioritizedGeneralFirst,
        scanOrdering: String(profileScanPlan.scanOrdering || ''),
        slugFetchTimeoutMs: Number(slugFetchTimeoutMs || 0),
        sbtFetchTimeoutMs: Number(sbtFetchTimeoutMs || 0),
        activityFetchTimeoutMs: Number(activityFetchTimeoutMs || 0),
        activityLookbackBlocks: Number(activityLookbackBlocks || 0),
        sbtBurstSize: Number(sbtBurstSize || 1),
        totalSbtContractsFound: 0,
        totalCreatedSurveysFound: 0,
        totalCreatedQuestionsFound: 0,
        totalSurveyResponsesFound: 0,
        totalQuestionResponsesFound: 0,
        sampleSbtAddresses: [],
        sampleCreatedSurveyIds: [],
        sampleCreatedQuestionIds: [],
        sampleSurveyResponseIds: [],
        sampleQuestionResponseIds: [],
      };
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
        this.scheduleProfileScanRetryAfterRegistryHydration(targetAddress, report.coverageReason);
      }

      const pushUnique = (list: any, value: any) => {
        if (!Array.isArray(list)) return;
        const token = String(value || '');
        if (!token) return;
        if (!list.includes(token)) list.push(token);
      };
      const pushUniqueSample = (list: any, value: any, max: any = 12) => {
        if (!Array.isArray(list)) return;
        const token = String(value || '').trim().toLowerCase();
        if (!token || list.includes(token)) return;
        if (list.length >= Math.max(1, Number(max) || 1)) return;
        list.push(token);
      };
      const normalizeEventIdentifier = (raw: any) => String(raw || '').trim().toLowerCase();
      const readCreatedSurveyId = (item: any = {}) => normalizeEventIdentifier(
        item?.id || item?.surveyId || item?.surveyID
      );
      const readCreatedQuestionId = (item: any = {}) => normalizeEventIdentifier(
        item?.id || item?.questionId || item?.questionID
      );
      const readSurveyResponseId = (item: any = {}) => normalizeEventIdentifier(
        item?.surveyId || item?.surveyID || item?.id
      );
      const readQuestionResponseId = (item: any = {}) => normalizeEventIdentifier(
        item?.questionId || item?.questionID || item?.id
      );
      const skippedSlugReasons: Record<string, any> = {};

      const markSlugSkipped = (slug: any, reason: any, extra: any = {}) => {
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

      const normalizeActivityPayload = (raw: any) => {
        const payload = (raw && typeof raw === 'object') ? raw : {};
        return {
          createdSurveys: Array.isArray(payload.createdSurveys) ? payload.createdSurveys : [],
          createdQuestions: Array.isArray(payload.createdQuestions) ? payload.createdQuestions : [],
          surveyResponses: Array.isArray(payload.surveyResponses) ? payload.surveyResponses : [],
          questionResponses: Array.isArray(payload.questionResponses) ? payload.questionResponses : [],
        };
      };

      mainSiteLog.log(
        `[DeepSearch] Starting cross-group scan for user: ${targetLower}`,
        { usedAllSessions: report.usedAllSessions, slugCount: allSlugs.length }
      );

      let anyNewData = false; // track whether anything new was written to caches

      const scanOneSlug = async (slug: any) => {
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
            sessionCfg = resolvedRegistrySessionCfg;
          }
          if (!sessionCfg || typeof sessionCfg !== 'object') {
            markSlugSkipped(slug, 'missing-session-config', {
              fallbackAttempted: !!resolvedRegistrySessionCfg,
              durationMs: Math.max(0, Date.now() - slugStartedAt),
            });
            return;
          }
          const currentBlock = await contractScripts.getLatestBlockNumber('none', slug);
          let startBlockRaw = Number(sessionCfg?.blockLimits?.start);
          if (!Number.isFinite(startBlockRaw) || startBlockRaw <= 0) {
            const windowRef = (() => {
              const baseCfg = { ...sessionCfg };
              if (!baseCfg.slug) baseCfg.slug = slug;
              if (report.usedAllSessions) baseCfg.__ignoreSessionScanScope = true;
              return baseCfg;
            })();
            try {
              const fallbackWindow = await contractScripts.getRelevantBlockWindowForFilter(windowRef);
              startBlockRaw = Number(fallbackWindow?.fromBlock);
            } catch (fallbackError) {
              mainSiteLog.warn('[DeepSearch] Failed to recover missing blockLimits.start from SessionRegistry fallback.', {
                slug,
                error: (fallbackError as any)?.message || String(fallbackError),
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
          let userCache = this.DG.read('userCache', slug) || {};

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

          let chainEntry = userCache[targetLower][netKey];
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

          const resolveActivityWindow = (lastBlockValue: any, incompleteFlag: any) => {
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
          const activityWindows = [surveyActivityWindow, questionActivityWindow].filter(Boolean);
          const shouldForceActivityBackfill = activityWindows.some((window: any) => window.shouldForceBackfill);
          let activityFromBlock = activityWindows.length > 0
            ? Math.min(...activityWindows.map((window: any) => window.fromBlock))
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
            baseTimeoutMs: any,
            shouldForceBackfill: any,
            allowAdaptiveBackfill: any,
            opts: any = {}
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
          let sbts = [];
          let activity = {
            createdSurveys: [],
            createdQuestions: [],
            surveyResponses: [],
            questionResponses: []
          };
          let sbtHadRpcError = false;
          let activityHadRpcError = false;

          const runWithTimeout = async (promise: any, kind: any, fromBlock: any, timeoutMs: any) => {
            let timeoutId = null;
            const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs))
              ? Math.max(5000, Math.floor(Number(timeoutMs)))
              : Math.max(5000, Math.floor(Number(slugFetchTimeoutMs || 12000)));
            try {
              const outcome: any = await Promise.race([
                Promise.resolve(promise)
                  .then((value: any) => ({ timedOut: false, value }))
                  .catch((error: any) => ({ timedOut: false, error })),
                new Promise((resolve: any) => {
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
              contractScripts.getSBTsForUser(targetAddress, slug, sbtFromBlock, {
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
                error: String(sbtResult?.error?.message || sbtResult?.error || ''),
              });
            } else {
              const sbtRaw = sbtResult?.value;
              const sbtMeta =
                sbtRaw && typeof sbtRaw === 'object' && (
                  Object.prototype.hasOwnProperty.call(sbtRaw, 'hadError') ||
                  Object.prototype.hasOwnProperty.call(sbtRaw, 'data')
                )
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
              contractScripts.getUserActivity(targetAddress, slug, activityFromBlock, {
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
                error: String(activityResult?.error?.message || activityResult?.error || ''),
              });
            } else {
              const activityRaw = activityResult?.value;
              const activityMeta =
                activityRaw && typeof activityRaw === 'object' && (
                  Object.prototype.hasOwnProperty.call(activityRaw, 'hadError') ||
                  Object.prototype.hasOwnProperty.call(activityRaw, 'data')
                )
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
            .map((item: any) => normalizeEventIdentifier(item?.sbtAddress || ''))
            .filter(Boolean);
          const createdSurveyIds = activity.createdSurveys
            .map((item: any) => readCreatedSurveyId(item))
            .filter(Boolean);
          const createdQuestionIds = activity.createdQuestions
            .map((item: any) => readCreatedQuestionId(item))
            .filter(Boolean);
          const surveyResponseIds = activity.surveyResponses
            .map((item: any) => readSurveyResponseId(item))
            .filter(Boolean);
          const questionResponseIds = activity.questionResponses
            .map((item: any) => readQuestionResponseId(item))
            .filter(Boolean);
          report.totalSbtContractsFound += sbtAddressSamples.length;
          report.totalCreatedSurveysFound += createdSurveyIds.length;
          report.totalCreatedQuestionsFound += createdQuestionIds.length;
          report.totalSurveyResponsesFound += surveyResponseIds.length;
          report.totalQuestionResponsesFound += questionResponseIds.length;
          sbtAddressSamples.forEach((value: any) => pushUniqueSample(report.sampleSbtAddresses, value));
          createdSurveyIds.forEach((value: any) => pushUniqueSample(report.sampleCreatedSurveyIds, value));
          createdQuestionIds.forEach((value: any) => pushUniqueSample(report.sampleCreatedQuestionIds, value));
          surveyResponseIds.forEach((value: any) => pushUniqueSample(report.sampleSurveyResponseIds, value));
          questionResponseIds.forEach((value: any) => pushUniqueSample(report.sampleQuestionResponseIds, value));

          this.emitProfileScanTelemetry('slug-result', {
            targetAddress: targetLower,
            slug,
            fromBlock: sbtFromBlock,
            sbtFromBlock,
            activityFromBlock,
            currentBlock,
            sbtCount: sbts.length,
            sbtAddresses: sbts
              .map((item: any) => String(item?.sbtAddress || '').toLowerCase())
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
            anyNewData = true;
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
            const existingSbtMap = new Map();
            (chainEntry.data.sbts || []).forEach((item: any) => {
              if (item.sbtAddress) existingSbtMap.set(item.sbtAddress.toLowerCase(), item);
            });

            // Merge new SBTs
            sbts.forEach((newItem: any) => {
              if (newItem.sbtAddress) {
                // Overwrite or add. If getSBTsForUser returns current state, this keeps it fresh.
                existingSbtMap.set(newItem.sbtAddress.toLowerCase(), newItem);
              }
            });

            chainEntry.data.sbts = Array.from(existingSbtMap.values());

            // Append other activity arrays with dedupe.
            const dedupById = (oldArr: any, newArr: any) => {
              const map = new Map();
              (oldArr || []).forEach((i: any) => map.set(i.id || JSON.stringify(i), i));
              (newArr || []).forEach((i: any) => map.set(i.id || JSON.stringify(i), i));
              return Array.from(map.values());
            };

            const buildFallbackMergeKey = (item: any) => {
              try {
                return `__fallback__${JSON.stringify(item)}`;
              } catch (_) {
                return `__fallback__${String(item || '')}`;
              }
            };
            const readResponseRecency = (item: any) => {
              const row = (item && typeof item === 'object') ? item : {};
              return {
                bn: Number(row.blockNumber ?? row.bn ?? 0) || 0,
                txi: Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0) || 0,
                li: Number(row.logIndex ?? row.li ?? 0) || 0,
                ts: Number(row.timestamp ?? row.ts ?? 0) || 0,
              };
            };
            const compareResponseRecency = (incoming: any, existing: any) => {
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
            const upsertByStableResponseKey = (oldArr: any, newArr: any, buildKey: any, opts: any = {}) => {
              const preferNewerByRecency = !!(opts && opts.preferNewerByRecency);
              const map = new Map();
              const mergeOne = (item: any, preferIncomingOnTie: any = false) => {
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
                const cmp = compareResponseRecency(
                  readResponseRecency(item),
                  readResponseRecency(existing)
                );
                if (cmp > 0 || (cmp === 0 && preferIncomingOnTie)) {
                  map.set(key, item);
                }
              };
              (oldArr || []).forEach((item: any) => mergeOne(item, false));
              // Latest scan rows can replace equal-recency rows to preserve fresh payload fields.
              (newArr || []).forEach((item: any) => mergeOne(item, true));
              return Array.from(map.values());
            };
            const buildSurveyResponseKey = (item: any) => {
              const surveyId = String(item?.surveyId || item?.surveyID || item?.id || '').trim().toLowerCase();
              const responder = String(item?.responder || '').trim().toLowerCase();
              if (!surveyId || !responder) return '';
              return `${surveyId}|${responder}`;
            };
            const buildQuestionResponseKey = (item: any) => {
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
            let sbtCache = this.DG.read('sbtCache', slug) || {};
            if (!sbtCache[netKey]) sbtCache[netKey] = { sbtList: {}, lastBlock: 0 };

            sbts.forEach((item: any) => {
              const addrLower = item.sbtAddress.toLowerCase();
              const existing = sbtCache[netKey].sbtList[addrLower] || {};

              sbtCache[netKey].sbtList[addrLower] = {
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
            let survCache = this.DG.read('surveysCache', slug) || {};
            if (!survCache[netKey]) survCache[netKey] = { surveys: {}, surveyResponses: {} };
            if (!survCache[netKey].surveys || typeof survCache[netKey].surveys !== 'object') {
              survCache[netKey].surveys = {};
            }
            if (!survCache[netKey].surveyResponses || typeof survCache[netKey].surveyResponses !== 'object') {
              survCache[netKey].surveyResponses = {};
            }

            // Merge Created Surveys
            activity.createdSurveys.forEach(({ id, data }: any) => {
              const idLower = id.toLowerCase();
              if (data) {
                data.surveyID = idLower;
                survCache[netKey].surveys[idLower] = data;
              }
            });

            // Merge Responses
            activity.surveyResponses.forEach(({ surveyId, response, responder }: any) => {
              const sIdLower = surveyId.toLowerCase();
              const rLower = responder.toLowerCase();
              if (!survCache[netKey].surveyResponses[sIdLower]) {
                survCache[netKey].surveyResponses[sIdLower] = {};
              }
              survCache[netKey].surveyResponses[sIdLower][rLower] = response;
            });

            // Backfill response-linked survey metadata for cold user-profile loads.
            const missingSurveyIds = new Set();
            activity.surveyResponses.forEach(({ surveyId }: any) => {
              const surveyIdLower = String(surveyId || '').toLowerCase();
              if (!surveyIdLower) return;
              if (!survCache[netKey].surveys[surveyIdLower]) {
                missingSurveyIds.add(surveyIdLower);
              }
            });
            if (missingSurveyIds.size > 0) {
              const rows = await Promise.all(
                Array.from(missingSurveyIds).map(async (surveyIdLower: any) => {
                  try {
                    const surveyData = await contractScripts.getSurveyDataById(
                      'none',
                      surveyIdLower,
                      metadataGroupRef,
                      { skipDecrypt: true }
                    );
                    return { surveyIdLower, surveyData };
                  } catch (_) {
                    return { surveyIdLower, surveyData: null };
                  }
                })
              );
              rows.forEach(({ surveyIdLower, surveyData }: any) => {
                if (!surveyData || typeof surveyData !== 'object') return;
                surveyData.id = surveyIdLower;
                surveyData.surveyID = surveyIdLower;
                if (!surveyData.sessionSlug) surveyData.sessionSlug = slug;
                if (!surveyData.slug) surveyData.slug = slug;
                survCache[netKey].surveys[surveyIdLower] = surveyData;
              });
            }
            this.emitProfileScanColdDiag('survey-backfill', {
              targetAddress: targetLower,
              slug,
              missingSurveyCount: missingSurveyIds.size,
              missingSurveyIds: Array.from(missingSurveyIds).slice(0, 6),
              surveyCacheKeys: Object.keys(survCache[netKey].surveys || {}).length,
              surveyResponseKeys: Object.keys(survCache[netKey].surveyResponses || {}).length,
            });
            this.DG.write('surveysCache', slug, survCache);
          }

          // 3. Update Questions Cache
          if (
            activity.createdQuestions.length > 0 ||
            activity.questionResponses.length > 0
          ) {
            let qCache = this.DG.read('questionsCache', slug) || {};
            if (!qCache[netKey]) {
              qCache[netKey] = {
                questions: {},
                questionResponses: {},
                questionResponsesMeta: {},
                arweaveTxCache: {},
                arweaveTxFailureCache: {},
              };
            }
            ensureQuestionArweaveCacheBranches(qCache[netKey]);
            if (!qCache[netKey].questions || typeof qCache[netKey].questions !== 'object') {
              qCache[netKey].questions = {};
            }
            if (!qCache[netKey].questionResponses || typeof qCache[netKey].questionResponses !== 'object') {
              qCache[netKey].questionResponses = {};
            }
            if (!qCache[netKey].questionResponsesMeta || typeof qCache[netKey].questionResponsesMeta !== 'object') {
              qCache[netKey].questionResponsesMeta = {};
            }

            // Merge Created Questions
            activity.createdQuestions.forEach(({ id, data }: any) => {
              const idLower = id.toLowerCase();
              if (data) {
                data.id = idLower;
                qCache[netKey].questions[idLower] = data;
              }
            });

            // Merge Responses
            activity.questionResponses.forEach(
              ({ questionId, response, responder, blockNumber, transactionIndex, logIndex, timestamp }: any) => {
                const qIdLower = questionId.toLowerCase();
                const rLower = responder.toLowerCase();
                if (!qCache[netKey].questionResponses[qIdLower]) {
                  qCache[netKey].questionResponses[qIdLower] = {};
                }
                if (!qCache[netKey].questionResponsesMeta[qIdLower]) {
                  qCache[netKey].questionResponsesMeta[qIdLower] = {};
                }
                const prevMeta = qCache[netKey].questionResponsesMeta[qIdLower][rLower] || {};
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
                qCache[netKey].questionResponses[qIdLower][rLower] = response;
                qCache[netKey].questionResponsesMeta[qIdLower][rLower] = incomingMeta;
              }
            );

            // Backfill response-linked question metadata for cold user-profile loads.
            const missingQuestionIds = new Set();
            activity.questionResponses.forEach(({ questionId }: any) => {
              const questionIdLower = String(questionId || '').toLowerCase();
              if (!questionIdLower) return;
              if (!qCache[netKey].questions[questionIdLower]) {
                missingQuestionIds.add(questionIdLower);
              }
            });
            if (missingQuestionIds.size > 0) {
              const decryptContext = this.buildQuestionDecryptContext(slug);
              const rows = await Promise.all(
                Array.from(missingQuestionIds).map(async (questionIdLower: any) => {
                  try {
                    const questionData = await contractScripts.getQuestionData(
                      'none',
                      questionIdLower,
                      metadataGroupRef,
                      {
                        decryptContext,
                        skipDecrypt: true,
                      }
                    );
                    return { questionIdLower, questionData };
                  } catch (_) {
                    return { questionIdLower, questionData: null };
                  }
                })
              );
              rows.forEach(({ questionIdLower, questionData }: any) => {
                if (!questionData || typeof questionData !== 'object') return;
                questionData.id = questionIdLower;
                qCache[netKey].questions[questionIdLower] = questionData;
              });
            }
            try {
              const freshQuestionsCache = this.DG.read('questionsCache', slug) || {};
              const freshNet = freshQuestionsCache?.[netKey];
              if (freshNet && typeof freshNet === 'object') {
                mergeQuestionArweaveCacheBranches(qCache[netKey], freshNet);
              }
            } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
            this.emitProfileScanColdDiag('question-backfill', {
              targetAddress: targetLower,
              slug,
              missingQuestionCount: missingQuestionIds.size,
              missingQuestionIds: Array.from(missingQuestionIds).slice(0, 6),
              questionCacheKeys: Object.keys(qCache[netKey].questions || {}).length,
              questionResponseKeys: Object.keys(qCache[netKey].questionResponses || {}).length,
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
            error: String((err as any)?.message || err),
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
          await Promise.all(batch.map((slug: any) => scanOneSlug(slug)));
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

      report.anyNewData = anyNewData;
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
        this.scheduleProfileScanRetryAfterRegistryHydration(targetAddress, report.coverageReason);
      }
      const unresolvedListScopeChainIds = (
        isListScope &&
        totalSkippedScan &&
        report.attemptedSlugs.length > 0 &&
        report.attemptedSlugs.every((slug: any) => (
          String(((report.skippedSlugReasons as Record<string, any>)?.[String(slug || '')]) || '') === 'missing-chain-id'
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
          this.scheduleProfileScanRetryAfterRegistryHydration(targetAddress, report.coverageReason);
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
          (globalThis as any).__CE_PROFILE_SCAN_LAST_EVENT_SUMMARY__ = {
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
        this.setState((prev: any) => ({
          sbtCacheRevision: anyNewData
            ? prev.sbtCacheRevision + 1
            : prev.sbtCacheRevision,
          questionResponsesNonce: anyNewData
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
  readFlag(name: any, slug: any) { return this._cachePersistenceController.readFlag(name, slug); }
  writeFlag(name: any, slug: any, val: any) { this._cachePersistenceController.writeFlag(name, slug, val); }
  hasPersistedManagedCacheData = (...args: any[]) => this._cachePersistenceController.hasPersistedManagedCacheData(...args);
  syncCacheHasLoadedFlagFromPersistent = (...args: any[]) => this._cachePersistenceController.syncCacheHasLoadedFlagFromPersistent(...args);
  reloadWindowLocation = () => {
    if (typeof window === 'undefined') return;
    reloadWindowLocationFn(window);
  };

  async componentDidMount() {
    if (shouldAutoStartCeRuntimeStats()) {
      startCeRuntimeStats();
    }
    this.redirectLegacyDemoPath();
    let didRedirectFirstVisitRoot = false;
    if (this.props.firstVisit && typeof window !== 'undefined') {
      const currentPath = window.location.pathname || this.props.path || '';
      const firstVisitRedirectTarget = this.getFirstVisitRootRedirectTarget();
      if (
        firstVisitRedirectTarget?.path &&
        this.isGeneralRoutePath(currentPath) &&
        this.normalizeRoutePath(currentPath) === '/'
      ) {
        window.history.replaceState(
          {},
          '',
          buildPublicUrl(
            firstVisitRedirectTarget.path,
            window.location.search || '',
            window.location.hash || ''
          )
        );
        didRedirectFirstVisitRoot = true;
      }
    }
    this._mounted = true;
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener(
        SESSION_REGISTRY_CACHE_UPDATED_EVENT,
        this.handleSessionRegistryCacheUpdated
      );
    }
    const mountPathRaw = (
      didRedirectFirstVisitRoot && typeof window !== 'undefined'
        ? window.location.pathname
        : this.getCurrentPathname()
    ) || '';
    const mountFallbackTarget = this.applySessionFallbackRedirect({ pathIn: mountPathRaw });
    this.syncSessionFallbackRedirectConsumption({ pathIn: mountPathRaw });
    const currentPath = this.getEffectiveRoutePath(mountPathRaw);

    // Handle auto-hash persistence (restore)
    this.manageAutoHashPersistence();

    const CACHE_MANAGER_INIT_TIMEOUT_MS = 15000;
    let cacheManagerInitTimeoutId = null;
    try {
      await Promise.race([
        initCacheManager(),
        new Promise((_: any, reject: any) => {
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
        this.setState({ isCacheManagerReady: true });
      }
    }

    // Determine active group from URL and persist locally in state
    const currentSearch = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const slug = this.getBootstrapActiveSessionSlug(currentPath, currentSearch);
    this.props.changeActiveSessionSlug(slug);
    if (slug && !this.getDisplaySessionChainId(slug)) {
      this.resolveSessionPathSlug(slug);
    }
    // Track the active group chain id to detect changes without wallet involvement
    const _net = this.getDisplaySessionNetwork(slug);
    this._lastGroupChainId = _net?.id;
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
      const run = loadGroupRegistryCache({
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
        .catch((err: any) => {
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
      // The Arweave reliability rollout changed precheck/cooldown semantics. Force a one-time
      // refresh of derived caches so stale display-blocking failure entries cannot survive.
      const CURRENT_CACHE_VERSION = '2026-04-30-client-refresh-cache-bust-v2';
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
            DG_PRIMARY_ROUTE_CACHE_NAMES.map((namespace: any) => this.DG.remove(namespace, s))
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
    const targetUser = this.getUserAddressFromPath(currentPath);
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
    const isDemoPath = pathname.startsWith('/session/');
    const sbtAddressFromPath = this.getSbtAddressFromPath(pathname);
    const isSbtDetailRoute = !!sbtAddressFromPath;
    const isSbtRoute = this.isSbtListRoutePath(pathname) || isSbtDetailRoute;
    const isQuestionsRoute =
      pathname === '/questions' ||
      pathname === '/questions/' ||
      pathname.startsWith('/question/') ||
      pathname.startsWith('/questions/results');
    mainSiteLog.log(isDemoPath ? "Initializing caches (demo prioritized order)..." : "Initializing caches sequentially...");


    const sessionNet = this.getSessionNetwork(slug);
    mainSiteLog.log("session network (derived):", sessionNet);
    if (sessionNet && sessionNet.id) {
      if (isSbtDetailRoute) {
        // SBT detail: load only this SBT first, defer everything else
        try {
          const detailSlug = await this.resolvePinnedSbtDetailRouteSlug(sbtAddressFromPath, {
            search: currentSearch,
            fallbackSlug: slug,
          });
          this.setState({ sbtDetailGroupSlug: detailSlug, sbtDetailAddress: sbtAddressFromPath });

          // Ensure we don't keep background listeners for other SBTs on a detail page
          this.removeSbtRealtimeListenersForGroup(slug);
          this.removeSbtRealtimeListenersForGroup(detailSlug);

          await this.refreshSbtData(sbtAddressFromPath, detailSlug, { forceCounts: true });
          this.setReadinessStateIfChanged({ isSBTCacheReady: true });

          // Attach instance listener for this SBT only (optional, lightweight)
          if (this.shouldAttachSbtDetailInstanceListener()) {
            contractScripts.listenForSBTInstanceEvents(
              'none',
              [sbtAddressFromPath],
              (e: any) => this.onNewSbtEventDetectedForGroup(detailSlug, e),
              detailSlug
            );
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
              await new Promise((resolve: any) => setTimeout(resolve, 250));
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
        await this.initializeQuestionCache();
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
        new Set([activeSlug, questionSlug].filter((s: any) => s !== null && s !== undefined))
      );
      slugsToRefresh.forEach((slug: any) => {
        if (!this.hasMaskedQuestionPayloadInCache(slug)) return;
        this.refreshEncryptedQuestionPayloadsForGroup(slug).catch((err: any) => {
          mainSiteLog.warn('refreshEncryptedQuestionPayloadsForGroup failed during mount:', {
            slug,
            error: err?.message || err,
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
    try {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener(
          SESSION_REGISTRY_CACHE_UPDATED_EVENT,
          this.handleSessionRegistryCacheUpdated
        );
      }
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
      if (this._queuedSurveyGroupScanTimer) clearTimeout(this._queuedSurveyGroupScanTimer);
      this._queuedSurveyGroupScanTimer = null;
      this._queuedSurveyGroupScanId = null;
      this._queuedSurveyGroupScanHintedSlug = '';
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

    // Cancel pending /session/:token resolve retries to avoid setState after unmount.
    try {
      const timers = this._sessionPathResolveRetryTimers;
      if (timers && typeof timers === 'object') {
        ['id', 'slug'].forEach((kind: any) => {
          const bucket = timers[kind];
          if (!bucket || typeof bucket !== 'object') return;
          Object.values(bucket).forEach((t: any) => {
            try { clearTimeout(t); } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
          });
        });
      }
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

    contractScripts.removeSBTEventListener('none', this.getSessionSlugFromState());
    contractScripts.removeSurveyEventsListener('none', this.getSessionSlugFromState());
    // Also remove any per-instance SBT listeners to avoid leaks across navigation:
    contractScripts.removeSBTInstanceEventsListener('none', [], this.getSessionSlugFromState());
  }

  componentDidUpdate(prevProps: any, prevState: any) {
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
          new Set([activeSlug, questionSlug].filter((s: any) => s !== null && s !== undefined))
        );

        slugsToCheck.forEach((slug: any) => {
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
          this.refreshEncryptedQuestionPayloadsForGroup(slug).catch((err: any) => {
            mainSiteLog.warn('refreshEncryptedQuestionPayloadsForGroup failed after readiness change:', {
              slug,
              error: err?.message || err,
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
      if ((window as any).ENABLE_RPC_DEBUG_LOGGING === true) {
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
      if ((window as any).ENABLE_RPC_DEBUG_LOGGING === true) {
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
          contractScripts.removeSurveyEventsListener('none', prevActiveSlug || '');
          if (!isCacheReinitRunActive()) return;

          const isSbtRoute =
            this.isSbtListRoutePath(currPath) ||
            currPath.startsWith('/sbt/') ||
            currPath.startsWith('/group/');

          const sessionNet = this.getSessionNetwork(nextActiveSlug);
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
              await this.initializeQuestionCacheWithGeneralBackfill(nextActiveSlug);
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
      }).then((detailSlug: any) => {
        this.setState({ sbtDetailGroupSlug: detailSlug, sbtDetailAddress: currSbtAddr });
      }).catch((e: any) => { mainSiteLog.warn('MainSite: fallback', e); });
    } else if (!currSbtAddr && prevSbtAddr) {
      this.setState({ sbtDetailGroupSlug: null, sbtDetailAddress: null });
    }

    // Check for deep link scan if path changed
    if (currPath !== prevPath) {
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
    const cache = this.DG.read('surveysCache', currentSlug, { clone: false });
    const netKey = String(this.getSessionChainId(currentSlug));

    // Check Cache
    const inCache = !!cache?.[netKey]?.surveys?.[surveyID];

    // Check Config (Highlighted list)
    const cfg = this.getSessionCfg(currentSlug);
    const inConfig = Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
                     cfg.HIGHLIGHTED_SURVEY_IDS.some((id: any) => String(id).toLowerCase() === surveyID);

    // 3. If missing in current context, trigger the cross-group scan
    if (!inCache && !inConfig) {
      this.scanForSurveyGroup(surveyID, { hintedSlug: this.getSurveyRouteSessionSlugHint() });
    }
  };

  // Centralized auto-query persistence.
  // Saves URL query to sessionStorage if it contains auto intent, or restores it if missing but saved.
  // This ensures auto-join parameters survive OAuth redirects handled by the app shell.
  manageAutoHashPersistence = () => {
    try {
      if (typeof window === 'undefined') return;

      const slug = this.getActiveSessionSlug() || '';
      // Note: MainSite uses this.DG helper usually, but raw sessionStorage is fine here for migration/compat
      // We stick to the naming convention: dg:autoHash:<slug>
      const key = `dg:autoHash:${slug}`;
      const currentSearch = window.location.search || '';

      const hasAutoFlag = (raw: any) => {
        const cleaned = String(raw || '').replace(/^[?#]/, '');
        if (!cleaned) return false;
        const params = new URLSearchParams(cleaned);
        if (params.get('auto') === '1') return true;
        for (const k of params.keys()) {
          if (/^auto\d+$/.test(k) && params.get(k) === '1') return true;
        }
        return false;
      };

      // 1. Save: If current query has auto-mint intent, persist it.
      if (hasAutoFlag(currentSearch)) {
        sessionStorage.setItem(key, currentSearch.replace(/^\?/, ''));
      }
      // 2. Restore: If query is empty but we have a saved one, restore it.
      // This typically happens when returning from an OAuth redirect that strips the query.
      else if (!currentSearch && sessionStorage.getItem(key)) {
        const saved = sessionStorage.getItem(key) || '';
        if (hasAutoFlag(saved)) {
          const clean = saved.replace(/^[?#]/, '');
          mainSiteLog.log('[MainSite] Restoring persisted auto-query:', clean);
          // Use replaceState to avoid adding a history entry for the restoration
          window.history.replaceState(null, '', window.location.pathname + (clean ? `?${clean}` : ''));
        }
      }
    } catch (e) {
      mainSiteLog.warn('[MainSite] manageAutoHashPersistence error:', e);
    }
  }


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
    const sessionNet = this.getSessionNetwork(slug);
    if (!isCacheReinitRunActive()) return;

    const pathname = this.getCurrentPathname();
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
          this.setState({ sbtDetailGroupSlug: detailSlug, sbtDetailAddress: sbtAddressFromPath });
          this.setReadinessStateIfChanged({ isSBTCacheReady: true });

          if (this.shouldAttachSbtDetailInstanceListener()) {
            contractScripts.listenForSBTInstanceEvents(
              'none',
              [sbtAddressFromPath],
              (e: any) => this.onNewSbtEventDetectedForGroup(detailSlug, e),
              detailSlug
            );
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

  checkAllCachesReady = () => {
    const { isSBTCacheReady, isSurveyCacheReady, isQuestionCacheReady } = this.state;
    const nextIsAllReady = !!(isSBTCacheReady && isSurveyCacheReady && isQuestionCacheReady);

    const slug = this.getSessionSlugFromState();

    this.setState((prev: any) => {
      const updates: Record<string, any> = {};
      let changed = false;

      if (prev.isAllCachesReady !== nextIsAllReady) {
        updates.isAllCachesReady = nextIsAllReady;
        changed = true;
      }
      return changed ? updates : null;
    });
    void this.syncCacheHasLoadedFlagOnTransition(slug, { isAllReady: nextIsAllReady });

    // Deferred full SBT scan trigger (demo-only)
    const pathname = this.getCurrentPathname();
    const onDemo = pathname.startsWith('/session/');
    if (!onDemo) return;

    const shouldKickOff =
      isSBTCacheReady && isSurveyCacheReady && isQuestionCacheReady &&
      this.readFlag('sbt:deferredFullScanNeeded', slug) &&
      !this.readFlag('sbt:fullScanInProgress', slug);

    if (shouldKickOff) {
      (async () => {
        try {
          if (!this.shouldAutoRunFullSbtScan({ pathname })) return;
          mainSiteLog.log('[SBT Deferred] Kicking off full scan after questions & surveys are ready...');
          await this.initializeSbtCache({ mode: 'full' });
          this.startSbtEventListener();
          mainSiteLog.log('[SBT Deferred] Full scan complete; listener started.');
        } catch (e) {
          mainSiteLog.error('[SBT Deferred] Full scan failed:', e);
        }
      })();
    }
  };

  ensureSessionRouteSbtDiscovery = (...args: any[]) => this._sbtCacheController.ensureSessionRouteSbtDiscovery(...args);

  sendMessageToServer = () => {
  };

  ensureLightSbtDiscovery = (...args: any[]) => this._sbtCacheController.ensureLightSbtDiscovery(...args);

  ensureLightSbtUniverse = (...args: any[]) => this._sbtCacheController.ensureLightSbtUniverse(...args);

  mergeSbtCountMaps = (...args: any[]) => this._sbtCacheController.mergeSbtCountMaps(...args);

  mergeSbtCountsPayload = (...args: any[]) => this._sbtCacheController.mergeSbtCountsPayload(...args);

  normalizeSbtHistorySummary = (...args: any[]) => this._sbtCacheController.normalizeSbtHistorySummary(...args);

  normalizeSbtCountMap = (...args: any[]) => this._sbtCacheController.normalizeSbtCountMap(...args);

  sumSbtCountMap = (...args: any[]) => this._sbtCacheController.sumSbtCountMap(...args);

  seedSbtCountMapFromLegacyAddresses = (...args: any[]) => this._sbtCacheController.seedSbtCountMapFromLegacyAddresses(...args);

  hydrateLegacySbtCountState = (...args: any[]) => this._sbtCacheController.hydrateLegacySbtCountState(...args);

  buildSbtHistorySummaryFromCounts = (...args: any[]) => this._sbtCacheController.buildSbtHistorySummaryFromCounts(...args);

  getCurrentHolderAddressesFromCounts = (...args: any[]) => this._sbtCacheController.getCurrentHolderAddressesFromCounts(...args);

  initializeSbtCache = (...args: any[]) => this._sbtCacheController.initializeSbtCache(...args);

  initializeSbtCacheWithGeneralBackfill = (...args: any[]) => this._sbtCacheController.initializeSbtCacheWithGeneralBackfill(...args);

  initializeSbtCacheForGroup = (...args: any[]) => this._sbtCacheController.initializeSbtCacheForGroup(...args);

  refreshSbtData = (...args: any[]) => this._sbtCacheController.refreshSbtData(...args);

  refreshSbtDataForGroup = (...args: any[]) => this._sbtCacheController.refreshSbtDataForGroup(...args);

  startSbtEventListener = (...args: any[]) => this._sbtCacheController.startSbtEventListener(...args);

  startSbtEventListenerForGroup = (...args: any[]) => this._sbtCacheController.startSbtEventListenerForGroup(...args);

  onNewSbtEventDetected = (...args: any[]) => this._sbtCacheController.onNewSbtEventDetected(...args);

  onNewSbtEventDetectedForGroup = (...args: any[]) => this._sbtCacheController.onNewSbtEventDetectedForGroup(...args);

  onSbtCreatedDetected = (...args: any[]) => this._sbtCacheController.onSbtCreatedDetected(...args);

  onSbtCreatedDetectedForGroup = (...args: any[]) => this._sbtCacheController.onSbtCreatedDetectedForGroup(...args);

  onSbtIssuedDetected = (...args: any[]) => this._sbtCacheController.onSbtIssuedDetected(...args);

  onSbtIssuedDetectedForGroup = (...args: any[]) => this._sbtCacheController.onSbtIssuedDetectedForGroup(...args);

  onSbtActivityDetected = (...args: any[]) => this._sbtCacheController.onSbtActivityDetected(...args);

  onSbtActivityDetectedForGroup = (...args: any[]) => this._sbtCacheController.onSbtActivityDetectedForGroup(...args);

  onSbtTransferDetected = (...args: any[]) => this._sbtCacheController.onSbtTransferDetected(...args);

  onSbtTransferDetectedForGroup = (...args: any[]) => this._sbtCacheController.onSbtTransferDetectedForGroup(...args);

  initializeSurveyCache = async () => {
    return this.initializeSurveyCacheWithGeneralBackfill(this.getActiveSessionSlug());
  };

  initializeSurveyCacheWithGeneralBackfill = async (slugIn: any) => {
    return this.runWithGeneralSessionBackfill({
      slugIn,
      operation: 'initializeSurveyCache',
      runPrimary: (slug: any) => this.initializeSurveyCacheForGroup(slug, { background: false }),
      runGeneral: (slug: any) => this.initializeSurveyCacheForGroup(slug, { background: true }),
    });
  };

  initializeSurveyCacheForGroup = (...args: any[]) => this._surveyCacheController.initializeSurveyCacheForGroup(...args);


  initializeQuestionCache = async () => {
    return this.initializeQuestionCacheWithGeneralBackfill(this.getActiveSessionSlug());
  };

  initializeQuestionCacheWithGeneralBackfill = async (slugIn: any) => {
    return this.runWithGeneralSessionBackfill({
      slugIn,
      operation: 'initializeQuestionCache',
      runPrimary: (slug: any) => this.initializeQuestionCacheForGroup(slug, { background: false }),
      runGeneral: (slug: any) => this.initializeQuestionCacheForGroup(slug, { background: true }),
    });
  };

  initializeQuestionCacheForGroup = (...args: any[]) => this._questionCacheController.initializeQuestionCacheForGroup(...args);

  fetchQuestionResponsesChunked = async () => {
    return this.fetchQuestionResponsesChunkedWithGeneralBackfill(this.getActiveSessionSlug());
  };

  fetchQuestionResponsesChunkedWithGeneralBackfill = async (slugIn: any) => {
    return this.runWithGeneralSessionBackfill({
      slugIn,
      operation: 'fetchQuestionResponsesChunked',
      runPrimary: (slug: any) => this.fetchQuestionResponsesChunkedForGroup(slug, { background: false }),
      runGeneral: (slug: any) => this.fetchQuestionResponsesChunkedForGroup(slug, { background: true }),
    });
  };

  fetchQuestionResponsesChunkedForGroup = (...args: any[]) => (
    this._responseHydrationController.fetchQuestionResponsesChunkedForGroup(...args)
  );

  startSurveyAndQuestionEventListener = async () => this.startSurveyAndQuestionEventListenerForGroup(this.getActiveSessionSlug());

  startSurveyAndQuestionEventListenerForGroup = async (slugIn: any) => {
    const slug = normalizeSessionSlug(slugIn || '');
    mainSiteLog.log("startSurveyAndQuestionEventListenerForGroup() – Setting up survey & question events listener", { slug });
    contractScripts.removeSurveyEventsListener('none', slug); // Ensure clean state
    if (this.shouldSkipSessionScanForSlug(slug, 'startSurveyAndQuestionEventListenerForGroup')) return;
    contractScripts.listenForSurveyEvents('none', (e: any) => this.onNewSurveyEventDetectedForGroup(slug, e), slug);
    mainSiteLog.log("Survey & Question event listener started");
  };


  onNewSurveyEventDetected = async (event: any) => this.onNewSurveyEventDetectedForGroup(this.getActiveSessionSlug(), event);

  onNewSurveyEventDetectedForGroup = async (slug: any, event: any) => { // event: { type, ..., blockNumber }
    if ((window as any).ENABLE_RPC_DEBUG_LOGGING === true) mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: onNewSurveyEventDetectedForGroup invoked', { event, slug });
    mainSiteLog.log("onNewSurveyEventDetectedForGroup() – invoked with event:", event);

    const networkID = String(this.getSessionChainId(slug) || '');
    if (!networkID) {
      mainSiteLog.error('Network ID undefined in onNewSurveyEventDetectedForGroup');
      return;
    }
    const { fromBlock: baseFrom } = await contractScripts.getRelevantBlockWindowForFilter(slug);
    const initialLastBlockDefault = Math.max(0, baseFrom - 1);

    let eventBlockNumber = event.blockNumber;
    if (!eventBlockNumber && event.transactionHash) {
        let readProvider = null;
        try {
          if (typeof contractScripts.getReadProviderForSession === 'function') {
            readProvider = contractScripts.getReadProviderForSession(slug);
          }
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }

        if (readProvider && typeof readProvider.getTransactionReceipt === 'function') {
          try {
              const receipt = await readProvider.getTransactionReceipt(event.transactionHash);
              eventBlockNumber = receipt?.blockNumber;
          } catch (e) {
              mainSiteLog.error("Failed to get block number from transaction hash for survey event", e);
              const { toBlock: baseToFallback } = await contractScripts.getRelevantBlockWindowForFilter(slug);
              eventBlockNumber = baseToFallback;
          }
        } else {
          const { toBlock: baseToFallback } = await contractScripts.getRelevantBlockWindowForFilter(slug);
          eventBlockNumber = baseToFallback;
        }
    } else if (!eventBlockNumber) {
        const { toBlock: baseToFallback } = await contractScripts.getRelevantBlockWindowForFilter(slug);
        eventBlockNumber = baseToFallback;
    }

    let surveysCache = this.DG.read('surveysCache', slug) || {};
    this.mergeLegacyNumericNetworkKey(surveysCache, networkID);
    if (!surveysCache[networkID]) {
      surveysCache[networkID] = {
        surveysLatestBlock: initialLastBlockDefault,
        surveys: {}, surveyResponses: {}, surveyResponsesLatestBlock: {}
      };
    }
    let currentSurveyNetworkCache = surveysCache[networkID];
    if (typeof currentSurveyNetworkCache.surveyResponsesLatestBlock !== 'object' || currentSurveyNetworkCache.surveyResponsesLatestBlock === null) {
        currentSurveyNetworkCache.surveyResponsesLatestBlock = {};
    }
    if (!currentSurveyNetworkCache.surveys) currentSurveyNetworkCache.surveys = {};


    let questionsCache = this.DG.read('questionsCache', slug) || {};
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
    let currentQuestionNetworkCache = questionsCache[networkID];
    if (!currentQuestionNetworkCache.questions) currentQuestionNetworkCache.questions = {};
    if (!currentQuestionNetworkCache.questionResponses) currentQuestionNetworkCache.questionResponses = {};
    if (typeof currentQuestionNetworkCache.questionResponsesMeta !== 'object' || currentQuestionNetworkCache.questionResponsesMeta === null) {
      currentQuestionNetworkCache.questionResponsesMeta = {};
    }
    ensureQuestionArweaveCacheBranches(currentQuestionNetworkCache);
    const mergeFreshQuestionArweaveBranches = () => {
      try {
        const freshCache = this.DG.read('questionsCache', slug) || {};
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
          const surveyData = await contractScripts.getSurveyDataById('none', surveyID, slug);

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
                .map((q: any) => q.toLowerCase())
                .filter((qid: any) => !currentQuestionNetworkCache.questions[qid]);

              if (missingIds.length > 0) {
                const results = await Promise.all(
                  missingIds.map(async (qid: any) => {
                    try {
                      const questionData = await contractScripts.getQuestionData('none', qid, slug, {
                        decryptContext: this.buildQuestionDecryptContext(slug),
                        skipDecrypt: true,
                      });
                      return { qid, questionData };
                    } catch (err) {
                      mainSiteLog.error(`Error fetching question data for ${qid}:`, err);
                      return { qid, questionData: null };
                    }
                  })
                );

                results.forEach(({ qid, questionData }: any) => {
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
          const idsLower = event.questionIds.map((hex: any) => hex.toLowerCase());
          const missing = idsLower.filter((qid: any) => !currentQuestionNetworkCache.questions[qid]);

          let allNewQuestionsFetchedSuccessfully = true;
          if (missing.length > 0) {
            const results = await Promise.all(
              missing.map(async (qid: any) => {
                try {
                  const questionData = await contractScripts.getQuestionData('none', qid, slug, {
                    decryptContext: this.buildQuestionDecryptContext(slug),
                    skipDecrypt: true,
                  });
                  return { qid, questionData };
                } catch (e) {
                  mainSiteLog.warn(`Error fetching new question ${qid} in QuestionsAdded:`, e);
                  return { qid, questionData: null };
                }
              })
            );
            results.forEach(({ qid, questionData }: any) => {
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
      const questionIdsFromEvent = event.questionIds.map((q: any) => q.toLowerCase());
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
            const surveyResponseData = await contractScripts.getSurveyResponse('none', responderAddressLower, surveyIdFromEvent, slug);
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
      questionIdsFromEvent.forEach((qId: any) => {
        if (!currentQuestionNetworkCache.questionResponses[qId]) {
          currentQuestionNetworkCache.questionResponses[qId] = {};
        }
        if (!currentQuestionNetworkCache.questionResponsesMeta[qId]) {
          currentQuestionNetworkCache.questionResponsesMeta[qId] = {};
        }
      });

      const bn = Number(eventBlockNumber || 0);
      const qIdsToFetch: any[] = [];
      questionIdsFromEvent.forEach((qId: any) => {
        const prev = currentQuestionNetworkCache.questionResponsesMeta[qId][responderAddressLower] || {};
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
          qIdsToFetch.map(async (qId: any) => {
            const data = await contractScripts.getResponse('none', responderAddressLower, qId, slug, {
              forceArweaveFetch: true,
            });
            if (!data) shouldForceResponseBackfill = true;
            return { qId, data };
          })
        );

        let acceptedAny = false;
        results.forEach(({ qId, data }: any) => {
          if (!data) return;
          currentQuestionNetworkCache.questionResponses[qId][responderAddressLower] = data;
          currentQuestionNetworkCache.questionResponsesMeta[qId][responderAddressLower] = {
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
          }).catch((backfillErr: any) => {
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

  _renderDebateRoute = (fullPath: any) => (
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

  _renderSimUserRoute = (fullPath: any, defaultSessionNetwork: any) => {
    const simUsername = fullPath.slice(4);
    return (
      <Suspense fallback={<LazyFallback label="Loading profile..." minHeight="40vh" />}>
        <SimulatedUserPage simUsername={simUsername} provider={this.props.provider} network={defaultSessionNetwork} />
      </Suspense>
    );
  };

  _renderAtlasRoute = (ctx: any) => {
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

  _renderTagRoute = (ctx: any) => {
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

  _renderCompareRoute = (ctx: any) => {
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

  _renderContractsRoute = (ctx: any) => {
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

  _renderAdminRoute = (ctx: any) => {
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

  _renderSponsorRoute = (ctx: any) => {
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

  _renderSbtsListRoute = (ctx: any) => {
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

  _renderSbtDetailRoute = (ctx: any) => {
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

  _renderUserProfileRoute = (ctx: any) => {
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

  _renderHomeRoute = (ctx: any) => {
    const { defaultSlug, defaultSessionNetwork, cacheInitializationError } = ctx;
    return (
      <div id={styles.main} data-testid={E2E_TESTIDS.PAGE_HOME_ROOT}>
        <MainAreaTabs
          changeFocusedTab={this.props.changeFocusedTab}
          toggleLoginModal={this.props.toggleLoginModal}
          toggleDemoMode={this.props.toggleDemoMode}
          account={this.props.account}
          provider={this.props.provider}
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

  _renderSurveyIdRoute = (ctx: any) => {
    const {
      surveyIDFromPath,
      fullPath,
      searchStr,
      searchParams,
      autoOpenResults,
      parsedFilterStateFromUrl,
      cacheInitializationError,
    } = ctx;
    const sidLower = surveyIDFromPath.toLowerCase();

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
    const cache = this.DG.read('surveysCache', effectiveSlug, { clone: false });
    const netKey = String(this.getSessionChainId(effectiveSlug));

    const inCache = !!cache?.[netKey]?.surveys?.[sidLower];
    const inConfig = Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
      cfg.HIGHLIGHTED_SURVEY_IDS.some((id: any) => id.toLowerCase() === sidLower);

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
            toggleLoginModal={this.props.toggleLoginModal}
            account={this.props.account}
            provider={this.props.provider}
            loginComplete={this.props.loginComplete}
            loginInProgress={this.props.loginInProgress}
            network={effectiveNetwork}
            activeSessionSlug={effectiveSlug}
            isSurveyCacheReady={this.state.isSurveyCacheReady}
            isQuestionCacheReady={this.state.isQuestionCacheReady}
            isResponsesCacheReady={this.state.isResponsesCacheReady}
            isSBTCacheReady={this.state.isSBTCacheReady}
            cacheHasLoaded={this.state.cacheHasLoaded}
            sbtCacheRevision={this.state.sbtCacheRevision}
            questionResponsesNonce={this.state.questionResponsesNonce}
            questionScanProgress={this.state.questionScanProgress}
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

  _renderSurveysOrQuestionsListRoute = (ctx: any) => {
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
    const shouldWaitForInheritedSessionNetwork = (
      !!defaultSlug &&
      !defaultSessionChainId &&
      !defaultSessionCfg?.networkChainId &&
      (
        !this._sessionPathSlugResolveAttempts?.[defaultSlug] ||
        this._pendingSessionPathSlugResolves?.has(defaultSlug)
      )
    );
    if (shouldWaitForInheritedSessionNetwork) {
      this.resolveSessionPathSlug(defaultSlug);
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
    const isQuestionsListRoute = fullPath.startsWith('/questions');
    const questionRouteSession = isQuestionsListRoute
      ? resolveMainSiteQuestionRouteSessionContext({
        search: searchStr,
        isCacheManagerReady: this.state.isCacheManagerReady,
        getSessionConfigBySlug,
        formatSessionId: sessionRegistryUtils.formatSessionId,
        resolveSessionConfigById: (sessionId: any) => sessionRegistryStore.getSessionConfigById(sessionId),
      })
      : {
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
    const pageRefreshSurveyResponsesByID = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((id: any) => this.refreshSurveyResponsesByIDForGroup(effectivePageSlug, id))
        : this.refreshSurveyResponsesByID
    );
    const pageRefreshQuestionMetadata = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? (() => this.refreshQuestionMetadataForGroup(effectivePageSlug))
        : this.refreshQuestionMetadata
    );
    const pageRefreshQuestionResponses = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((questionIds: any, opts: any = {}) => (
          this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: effectivePageSlug })
        ))
        : this.refreshQuestionResponses
    );
    const pageRefreshSbtData = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((addr: any, slug: any) => this.refreshSbtData(addr, slug || effectivePageSlug))
        : this.refreshSbtData
    );

    return (
      <Suspense fallback={<LazyFallback label="Loading..." />}>
        <RouteErrorBoundary resetKey={fullPath}>
          <div data-testid={pageRootTestId}>
            <SurveyPage
              surveyID={surveyID}
              displayAnswerMode={displayAnswerMode}
              viewAddress={viewResponseAddress}
              toggleLoginModal={this.props.toggleLoginModal}
              account={this.props.account}
              provider={this.props.provider}
              loginComplete={this.props.loginComplete}
              loginInProgress={this.props.loginInProgress}
              network={effectivePageNetwork}
              networkChainId={effectivePageChainId}
              activeSessionSlug={effectivePageSlug}
              sessionSlug={isQuestionsListRoute ? effectivePageSlug : undefined}
              sessionSlugPinned={questionRouteSession.sessionSlugPinned}
              sessionConfig={effectivePageSessionCfg}
              isSurveyCacheReady={this.state.isSurveyCacheReady}
              isQuestionCacheReady={this.state.isQuestionCacheReady}
              isResponsesCacheReady={this.state.isResponsesCacheReady}
              isSBTCacheReady={this.state.isSBTCacheReady}
              cacheHasLoaded={this.state.cacheHasLoaded}
              sbtCacheRevision={this.state.sbtCacheRevision}
              questionResponsesNonce={this.state.questionResponsesNonce}
              questionScanProgress={this.state.questionScanProgress}
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

  _renderQuestionDetailRoute = (ctx: any) => {
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
      getSessionConfigBySlug,
      formatSessionId: sessionRegistryUtils.formatSessionId,
      resolveSessionConfigById: (sessionId: any) => sessionRegistryStore.getSessionConfigById(sessionId),
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
    return (
      <Suspense fallback={<LazyFallback label="Loading Question..." />}>
        <div data-testid={E2E_TESTIDS.PAGE_QUESTIONS_ROOT}>
          <SurveyTool
            key={`${effectiveQuestionSlug}-${String(questionID || '').toLowerCase()}-${String(responderAddress || '').toLowerCase()}`}
            questionID={questionID}
            responderAddress={responderAddress}
            singleQuestionMode={true}
            toggleLoginModal={this.props.toggleLoginModal}
            account={this.props.account}
            provider={this.props.provider}
            loginComplete={this.props.loginComplete}
            loginInProgress={this.props.loginInProgress}
            network={effectiveQuestionNetwork}
            networkChainId={effectiveQuestionNetwork?.id || this.props.network?.id || null}
            activeSessionSlug={effectiveQuestionSlug}
            sessionSlug={effectiveQuestionSlug}
            sessionSlugPinned={questionSlugPinned}
            isQuestionCacheReady={this.state.isQuestionCacheReady}
            isResponsesCacheReady={this.state.isResponsesCacheReady}
            isSBTCacheReady={this.state.isSBTCacheReady}
            sbtCacheRevision={this.state.sbtCacheRevision}
            questionResponsesNonce={this.state.questionResponsesNonce}
            questionScanProgress={this.state.questionScanProgress}
            refreshSurveyResponsesByID={(id: any) => this.refreshSurveyResponsesByIDForGroup(effectiveQuestionSlug, id)}
            refreshQuestionMetadata={() => this.refreshQuestionMetadataForGroup(effectiveQuestionSlug)}
            refreshQuestionResponses={(questionIds: any, opts: any = {}) =>
              this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: effectiveQuestionSlug })
            }
            refreshSbtData={(addr: any, slug: any) => this.refreshSbtData(addr, slug || effectiveQuestionSlug)}
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

  _renderSessionRoute = (ctx: any) => {
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
      formatSessionId: sessionRegistryUtils.formatSessionId,
      resolveSessionConfigById: (sessionId: any) => sessionRegistryStore.getSessionConfigById(sessionId),
      resolveSessionConfigBySlug: (slug: any) => getSessionConfigBySlug(slug),
      resolveDisplaySessionConfigBySlug: (slug: any) => (
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
      ),
      resolveSessionSlugFromPathToken: (sessionToken: any) => (
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
      const attempts = this._sessionPathIdResolveAttempts || {};
      const pending = this._pendingSessionPathIdResolves || new Set();
      const hasAttempted = !!attempts[unresolvedSessionId];
      const isPending = pending.has(unresolvedSessionId);
      const lastErr = this._sessionPathResolveLastErrors?.id?.[unresolvedSessionId] || null;
      const retryCount = Number(this._sessionPathResolveErrorCounts?.id?.[unresolvedSessionId] || 0);
      const recentError = !!(lastErr && lastErr.ts && (Date.now() - Number(lastErr.ts || 0)) < 2 * 60 * 1000);
      const keepResolving = recentError && retryCount > 0;
      this.resolveSessionPathId(unresolvedSessionId);
      if (!hasAttempted || isPending || keepResolving) {
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
    const hasAutoFlag = (() => {
      if (qp.get('auto') === '1') return true;
      for (const key of qp.keys()) {
        if (/^auto\d+$/.test(key) && qp.get(key) === '1') return true;
      }
      return false;
    })();

    if (!isDocsRoute && (qp.has('password') || qp.has('gp')) && !hasAutoFlag) {
      const base = `/session/${canonicalSessionToken}`;
      if (typeof window !== 'undefined') window.location.replace(buildPublicRoute(base));
      return <div />;
    }
    const sessionConfig = sessionRoute.sessionConfig;

    if (!sessionConfig) {
      if (slug) {
        const attempts = this._sessionPathSlugResolveAttempts || {};
        const pending = this._pendingSessionPathSlugResolves || new Set();
        const hasAttempted = !!attempts[slug];
        const isPending = pending.has(slug);
        const lastErr = this._sessionPathResolveLastErrors?.slug?.[slug] || null;
        const retryCount = Number(this._sessionPathResolveErrorCounts?.slug?.[slug] || 0);
        const recentError = !!(lastErr && lastErr.ts && (Date.now() - Number(lastErr.ts || 0)) < 2 * 60 * 1000);
        const keepResolving = recentError && retryCount > 0;
        this.resolveSessionPathSlug(slug);
        if (!hasAttempted || isPending || keepResolving) {
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
              toggleLoginModal={(loginModalIsOpen: any) => this.props.toggleLoginModal(loginModalIsOpen)}
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

    const resolvedSessionInfo = this.getSessionInfoForGroup(sessionConfig, sessionConfig?.slug || slug);
    const resolvedSessionName = this.getSessionNameForGroup(sessionConfig, sessionConfig?.slug || slug);
    const resolvedSessionHeader = this.getSessionHeaderForGroup(sessionConfig, sessionConfig?.slug || slug);

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
              account={this.props.account}
              provider={this.props.provider}
              network={defaultSessionNetwork}
              toggleLoginModal={this.props.toggleLoginModal}
              loginComplete={this.props.loginComplete}
              isSBTCacheReady={this.state.isSBTCacheReady}
              isSurveyCacheReady={this.state.isSurveyCacheReady}
              isQuestionCacheReady={this.state.isQuestionCacheReady}
              isResponsesCacheReady={this.state.isResponsesCacheReady}
              sbtCacheRevision={this.state.sbtCacheRevision}
              cacheHasLoaded={this.state.cacheHasLoaded}
              questionResponsesNonce={this.state.questionResponsesNonce}
              questionScanProgress={this.state.questionScanProgress}
              refreshSurveyResponsesByID={this.refreshSurveyResponsesByID}
              refreshQuestionMetadata={this.refreshQuestionMetadata}
              refreshQuestionResponses={this.refreshQuestionResponses}
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
            />
          </div>
        </RouteErrorBoundary>
      </Suspense>
    );
  };


  getMainView = (relevantMatch: any) => {
    // Variable initialization
    let surveyIDFromPath = null;
    let parsedFilterStateFromUrl = {};
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
    const isSbtsListRoute = this.isSbtListRoutePath(pathWithoutQuery);
    const isSbtDetailRoute =
      pathWithoutQuery.startsWith('/sbt/') ||
      pathWithoutQuery.startsWith('/group/');
    const pathSegments = pathWithoutQuery.split('/').filter(Boolean);
    const firstPathSegment = String(pathSegments[0] || '').trim().toLowerCase();
    const isExperimentalStubRoute =
      pathWithoutQuery === '/debate' ||
      pathWithoutQuery === '/debate/' ||
      pathWithoutQuery.startsWith('/tag/');
    const isKnownRoutePrefix =
      pathWithoutQuery === '/' ||
      pathWithoutQuery === '' ||
      KNOWN_ROUTE_PREFIXES.has(firstPathSegment) ||
      pathWithoutQuery.includes('0x');

    // Robust results routing (/survey/:id/results or /questions/results)
    const surveyMatch = fullPath.match(SURVEY_RESULTS_RE);
    const questionMatch = fullPath.match(QUESTION_RESULTS_RE);

    // Default slug/network for non-survey routes
    const defaultSlug = sessionFallbackTarget?.slug || this.getRenderActiveSessionSlug(fullPath, searchStr);
    const defaultSessionCfg = this.getDisplaySessionCfg(defaultSlug);
    const defaultSessionChainId = this.getDisplaySessionChainId(defaultSlug);
    const defaultSessionNetwork = this.getDisplaySessionNetwork(defaultSlug);

    const isWizardRoute = fullPath === '/session/new' || fullPath === '/new';
    const shouldBypassCacheHydrationWait =
      isExperimentalStubRoute ||
      isStaticNonCacheRoute(fullPath);
    if (isWizardRoute) {
      if (fullPath === '/new' && typeof window !== 'undefined') {
        window.history.replaceState({}, '', `${buildPublicRoute('/session/new')}${searchStr}${hashStr}`);
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

    const ctx = {
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

    if (surveyIDFromPath) {
      return this._renderSurveyIdRoute(ctx);
    }

    if (fullPath === "/" || fullPath === "") {
      return this._renderHomeRoute(ctx);
    }
    if (fullPath === '/debate' || fullPath === '/debate/') {
      return this._renderDebateRoute(fullPath);
    }
    if (fullPath.startsWith("/atlas")) {
      return this._renderAtlasRoute(ctx);
    }
    if (fullPath.startsWith('/tag/')) {
      return this._renderTagRoute(ctx);
    }
    if (fullPath === "/bookmarks" || fullPath === "/bookmarks/") {
      return this._renderBookmarksRoute();
    }
    if (fullPath === "/compare" || fullPath === "/compare/" || fullPath.startsWith("/compare/")) {
      return this._renderCompareRoute(ctx);
    }
    if (
      fullPath.startsWith("/surveys") ||
      fullPath.startsWith("/survey/") ||
      fullPath.startsWith("/questions")
    ) {
      return this._renderSurveysOrQuestionsListRoute(ctx);
    }
    if (fullPath.includes("/question/")) {
      return this._renderQuestionDetailRoute(ctx);
    }
    if (isSbtsListRoute) {
      return this._renderSbtsListRoute(ctx);
    }
    if (isSbtDetailRoute) {
      return this._renderSbtDetailRoute(ctx);
    }
    if (fullPath.includes("/su/")) {
      return this._renderSimUserRoute(fullPath, defaultSessionNetwork);
    }
    if (fullPath.includes("0x")) {
      return this._renderUserProfileRoute(ctx);
    }
    if (fullPath === "/about") {
      return this._renderAboutRoute();
    }
    if (fullPath === "/demos" || fullPath === "/demos/") {
      return this._renderDemosRoute();
    }
    if (fullPath === "/matrix") {
      return this._renderMatrixRoute();
    }
    if (fullPath === "/contracts" || fullPath.startsWith("/contracts/")) {
      return this._renderContractsRoute(ctx);
    }
    if (fullPath === "/admin") {
      return this._renderAdminRoute(ctx);
    }
    if (fullPath === "/sponsor" || fullPath === "/sponsor/") {
      return this._renderSponsorRoute(ctx);
    }
    if (fullPath === "/agent" || fullPath === "/agent/") {
      return this._renderAgentRoute();
    }
    if (fullPath.startsWith("/session")) {
      return this._renderSessionRoute(ctx);
    }
    return <NotFoundRoute path={fullPath} />;
  };


  // Used by Navbar faucet button
  getUserTestETH = async () => {
    try { await contractScripts.sendTestnetFunds(this.props.account); }
    catch (e) { mainSiteLog.error('Faucet error:', e); }
  };

  refreshSurveyResponsesByID = async (surveyID: any) => this.refreshSurveyResponsesByIDForGroup(this.getActiveSessionSlug(), surveyID);

  refreshSurveyResponsesByIDForGroup = (...args: any[]) => this._surveyCacheController.refreshSurveyResponsesByIDForGroup(...args);

  refreshQuestionMetadata = async () => this.refreshQuestionMetadataForGroup(this.getActiveSessionSlug());

  hasMaskedQuestionPayloadInCache = (...args: any[]) => this._questionCacheController.hasMaskedQuestionPayloadInCache(...args);

  buildQuestionDecryptContext = (...args: any[]) => this._questionCacheController.buildQuestionDecryptContext(...args);

  refreshEncryptedQuestionPayloadsForGroup = (...args: any[]) => this._questionCacheController.refreshEncryptedQuestionPayloadsForGroup(...args);

  refreshQuestionMetadataForGroup = (...args: any[]) => this._questionCacheController.refreshQuestionMetadataForGroup(...args);

  refreshQuestionResponses = (...args: any[]) => this._responseHydrationController.refreshQuestionResponses(...args);

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
const mapStateToProps = (state: any) => ({
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

export default connect(mapStateToProps, {
  fetchAccount,
  fetchSessionState,
  changeFocusedTab,
  toggleLoginModal,
  updateLoginInfo,
  toggleDemoMode,
  changeActiveSessionSlug
})(MainSiteWithWagmiHooks) as unknown as React.ComponentType<Record<string, any>>;
