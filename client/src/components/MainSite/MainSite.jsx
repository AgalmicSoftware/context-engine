/** @file MainSite.jsx */

import React, { Component, Suspense } from "react";
import PropTypes from 'prop-types';
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



// Styles
import "assets/css/contextEngine.scss";
import styles from "./MainSite.module.scss";

// Smart contract events / interactions
import contractScripts, {
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
  DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE,
  getAllowedSessionSlugs,
  readSessionScanMaxBlockRange,
  readSessionScanScope,
  readSessionScanSlugs,
  resolveValidatedSessionScanWindow,
} from '../../utilities/session/sessionScanScope.js';
import { derivePrimarySessionSlugFromList } from '../../utilities/session/globalSessionState.js';
import {
  refreshSessionInfoForSlug,
  refreshSessionMetaFieldsForSlug,
} from '../../utilities/session/sessionMetaController.js';
import {
  buildQuestionDecryptContextForSession,
  hasMaskedQuestionPayloadImproved,
} from '../../utilities/session/sessionQuestionDecryption.js';
import { createSessionScanPolicy } from '../../utilities/session/mainSiteSessionScanPolicy.js';
import { createSessionProfileScanController } from '../../utilities/session/sessionProfileScanController.js';
import { createSessionSbtCacheController } from '../../utilities/sbt/sessionSbtCacheController.js';
import { createSessionSurveyCacheController } from 'utilities/survey/sessionSurveyCacheController';
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
  normalizeArweaveFailureMeta,
  shouldStopPendingMetadataRetry,
} from '../../utilities/arweave/arweaveRetryHelpers.js';
import { resolvePersistedQuestionResponsesWatermark } from '../../utilities/survey/questionResponsesWatermark.js';
import {
  shouldAutoStartCeRuntimeStats,
  startCeRuntimeStats,
  stopCeRuntimeStats,
} from '../../utilities/ui/uiRuntimeStats.js';

// withWagmiBridge is a function component (allowed to use hooks from wagmi and RainbowKit).
// It passes props to this class-component so that this component can use React hooks.
import { WagmiHooksHOC } from '../HooksHOC/withWagmiBridge'

// Components
import Navbar from "../Navbar/Navbar";
import MainAreaTabs from "../MainContent/MainAreaTabs";
import RightSide from '../RightSidebar/RightSide';
import OnboardingOverlay from '../Onboarding/OnboardingOverlay';
import Footer from "../Footer/Footer";
import LazyFallback from "../Shared/LazyFallback";
import DevE2eNav from "../E2E/DevE2eNav";
import RouteErrorBoundary from '../ErrorBoundary/RouteErrorBoundary';

import { createLogger } from 'utilities/logging.js';
import {
  buildQuestionRoutePath,
  isKnownOrGeneralSessionSlug,
  isMaskedQuestionPayload,
  pickBetterQuestionPayload,
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
  MASKED_Q_DECRYPT_BACKOFF_MAX,
  MASKED_Q_DECRYPT_BACKOFF_TTL_MS,
  SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX,
} from './cacheConstants.js';
import {
  isRouteResponderAddress,
} from './mainSiteUtils.js';
import {
  ExperimentalStub,
  NotFoundRoute,
  readHashQueryParam,
  SessionLoadingSkeleton,
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
import {
  AboutPage,
  AdminPage,
  AgentPage,
  DebateMap,
  BookmarksPage,
  CompareAddresses,
  ContractPage,
  DemosIndex,
  OnePageSession,
  RiskMatrixDemo,
  SBTPage,
  SBTsPage,
  SessionDocumentsPage,
  SessionWizard,
  SimulatedUserPage,
  SponsorPage,
  SurveyPage,
  SurveyTool,
  TagPage,
  UserPage,
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


export class MainSite extends Component {
  state = {
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

  _cacheReadinessController = createSessionCacheReadinessController({
    getState: () => this.state,
    setState: (updater, cb) => this.setState(updater, cb),
    isMounted: () => this._mounted,
    resolveActiveSlug: () => this.resolveActiveSlugForCacheUpdates(),
    checkAllCachesReady: () => this.checkAllCachesReady(),
    syncCacheHasLoadedFlagFromPersistent: (slug, opts) => this.syncCacheHasLoadedFlagFromPersistent(slug, opts),
    readFlag: (name, slug) => this.readFlag(name, slug),
    isInitInFlight: (slug) => ({
      question: !!this._questionInitInFlight?.[slug],
      survey: !!this._surveyCacheController?.isInitInFlight?.(slug),
      response: !!this._responseInitInFlight?.[slug],
    }),
  });

  _cachePersistenceController = createSessionCachePersistenceController({
    dgRead: (name, slug) => this.DG.read(name, slug),
    dgWrite: (name, slug, obj) => this.DG.write(name, slug, obj),
    isMounted: () => this._mounted,
    getActiveSlug: () => this.getSessionSlugFromState(),
    setState: (updater, cb) => this.setState(updater, cb),
  });

  _queuedSurveyGroupScanId = null;
  _queuedSurveyGroupScanHintedSlug = '';
  _queuedSurveyGroupScanTimer = null;
  _surveyGroupScanInFlight = new Set();
  _questionInitInFlight = {};
  _responseInitInFlight = {};
  _questionInitPending = {};
  _responseInitPending = {};
  _scanPolicy = createSessionScanPolicy({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getCurrentPath: () => this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    getSessionSlugHintFromSearch: (search) => this.getSessionSlugHintFromSearch(search),
    getSessionTokenFromPath: (path) => this.getSessionTokenFromPath(path),
    isSbtListRoutePath: (path) => this.isSbtListRoutePath(path),
  });
  _profileScanController = createSessionProfileScanController({
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionSlugFromState: () => this.getSessionSlugFromState(),
    getSessionChainId: (slug) => this.getSessionChainId(slug),
    getSessionCfg: (slug) => this.getSessionCfg(slug),
    getSessionScanScopeContext: () => this.getSessionScanScopeContext(),
    getScopedSessionSlugs: (scope) => this.getScopedSessionSlugs(scope),
    isSessionSlugAllowedForScan: (slug, ctx) => this.isSessionSlugAllowedForScan(slug, ctx),
    getScopeFilteredSlugs: (slugs, scope) => this.getScopeFilteredSlugs(slugs, scope),
    getAccount: () => this.props.account,
    getProvider: () => this.props.provider,
    getNetworkId: () => Number(this.props?.network?.id || this.props?.network?.chainId || 0) || null,
    isMounted: () => this._mounted !== false,
    scanSpecificUserProfile: (address) => this.scanSpecificUserProfile(address),
  });
  _sbtCacheController = createSessionSbtCacheController({
    setState: (...args) => this.setState(...args),
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (...args) => this.DG.read(...args),
    dgWrite: (...args) => this.DG.write(...args),
    dgKey: (...args) => this.DG.key(...args),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (s) => this.getSessionCfg(s),
    getSessionChainId: (s) => this.getSessionChainId(s),
    getSessionScanScope: () => this.getSessionScanScope(),
    getSessionScanScopeContext: (s) => this.getSessionScanScopeContext(s),
    getAccount: () => (this.props?.account || ''),
    getCurrentPath: () => (this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''),
    getEffectiveRoutePath: (...args) => this.getEffectiveRoutePath(...args),
    getScopeFilteredSlugs: (...args) => this.getScopeFilteredSlugs(...args),
    getScopedSessionSlugs: (...args) => this.getScopedSessionSlugs(...args),
    shouldSkipSessionScanForSlug: (...args) => this.shouldSkipSessionScanForSlug(...args),
    scanScopeNoop: (...args) => this.scanScopeNoop(...args),
    logScopeSkipOnce: (...args) => this.logScopeSkipOnce(...args),
    isSbtInstanceListenerEnabledForGroup: (...args) => this.isSbtInstanceListenerEnabledForGroup(...args),
    shouldAutoRunFullSbtScan: (...args) => this.shouldAutoRunFullSbtScan(...args),
    isSbtHistoryScanEnabled: () => this.isSbtHistoryScanEnabled(),
    shouldAttachSbtDetailInstanceListener: () => this.shouldAttachSbtDetailInstanceListener(),
    setReadinessStateIfChanged: (...args) => this.setReadinessStateIfChanged(...args),
    checkAllCachesReady: (...args) => this.checkAllCachesReady(...args),
    queueLocalRevisionUpdate: (...args) => this.queueLocalRevisionUpdate(...args),
    readFlag: (...args) => this.readFlag(...args),
    writeFlag: (...args) => this.writeFlag(...args),
    refreshEncryptedQuestionPayloadsForGroup: (...args) => this.refreshEncryptedQuestionPayloadsForGroup(...args),
    initializeSurveyCacheForGroup: (...args) => this.initializeSurveyCacheForGroup(...args),
    runWithGeneralSessionBackfill: (...args) => this.runWithGeneralSessionBackfill(...args),
    mergeLegacyNumericNetworkKey: (...args) => this.mergeLegacyNumericNetworkKey(...args),
  });
  _surveyCacheController = createSessionSurveyCacheController({
    setState: (...a) => this.setState(...a),
    getState: () => this.state,
    isMounted: () => this._mounted,
    dgRead: (...a) => this.DG.read(...a),
    dgWrite: (...a) => this.DG.write(...a),
    getActiveSessionSlug: () => this.getActiveSessionSlug(),
    getSessionCfg: (...a) => this.getSessionCfg(...a),
    getSessionChainId: (...a) => this.getSessionChainId(...a),
    getAccount: () => this.props.account,
    getCurrentPath: () => this.props?.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '',
    shouldSkipSessionScanForSlug: (...a) => this.shouldSkipSessionScanForSlug(...a),
    scanScopeNoop: (...a) => this.scanScopeNoop(...a),
    logScopeSkipOnce: (...a) => this.logScopeSkipOnce(...a),
    setReadinessStateIfChanged: (...a) => this.setReadinessStateIfChanged(...a),
    checkAllCachesReady: (...a) => this.checkAllCachesReady(...a),
    readFlag: (...a) => this.readFlag(...a),
    writeFlag: (...a) => this.writeFlag(...a),
    mergeLegacyNumericNetworkKey: (...a) => this.mergeLegacyNumericNetworkKey(...a),
    initializeQuestionCacheForGroup: (...a) => this.initializeQuestionCacheForGroup(...a),
    writeSurveyMetadataToCache: (...a) => this.writeSurveyMetadataToCache(...a),
    queueLocalRevisionUpdate: (...a) => this.queueLocalRevisionUpdate(...a),
    getSessionScanScope: () => this.getSessionScanScope(),
  });
  _scanSpecificUserProfileInFlight = new Map();
  _profileScanTelemetrySeq = 0;
  _cacheReinitRunSeq = 0;
  _activeCacheReinitRunToken = 0;
  _sessionRouteLightDiscoveryInFlight = {};
  _mounted = false;
  _sessionFallbackRedirectPath = '';
  _lastProcessedQuestionIdFromPath = '';
  _lastProcessedQuestionSlugFromPath = null;

  get _registryBootstrapPromise() {
    return this._profileScanController?._registryBootstrapPromise ?? null;
  }

  set _registryBootstrapPromise(value) {
    if (this._profileScanController) {
      this._profileScanController._registryBootstrapPromise = value;
    }
  }

  get _registryBootstrapScopeKey() {
    return this._profileScanController?._registryBootstrapScopeKey || '';
  }

  set _registryBootstrapScopeKey(value) {
    if (this._profileScanController) {
      this._profileScanController._registryBootstrapScopeKey = value;
    }
  }

  beginSbtLiveProgress = (...args) => this._sbtCacheController.beginSbtLiveProgress(...args);

  updateSbtLiveProgress = (...args) => this._sbtCacheController.updateSbtLiveProgress(...args);

  clearSbtLiveProgress = (...args) => this._sbtCacheController.clearSbtLiveProgress(...args);

  setSbtRealtimeCoverageForGroup = (...args) => this._sbtCacheController.setSbtRealtimeCoverageForGroup(...args);

  clearSbtRealtimeCoverageForGroup = (...args) => this._sbtCacheController.clearSbtRealtimeCoverageForGroup(...args);

  normalizeSbtRealtimeEventCursor = (...args) => this._sbtCacheController.normalizeSbtRealtimeEventCursor(...args);

  compareSbtRealtimeEventCursor = (...args) => this._sbtCacheController.compareSbtRealtimeEventCursor(...args);

  removeSbtRealtimeListenersForGroup = (...args) => this._sbtCacheController.removeSbtRealtimeListenersForGroup(...args);
  normalizeRoutePath = normalizeRoutePathFn;

  isGeneralRoutePath = isGeneralRoutePathFn;

  getEffectiveRoutePath = (pathIn = '') => getEffectiveRoutePathFn(pathIn, {
    windowPathIn: typeof window !== 'undefined'
      ? window.location.pathname
      : '',
    redirectPathIn: this._sessionFallbackRedirectPath,
  });

  getSessionFallbackScopeSlugs = () => {
    const scope = String(readSessionScanScope() || '').trim().toLowerCase();
    if (scope !== 'list') return [];

    const dedupeNormalized = (values = []) => {
      const out = [];
      const seen = new Set();
      values.forEach((value) => {
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
        entries.map((entry) => {
          const cfg = Array.isArray(entry) ? entry[1] : entry;
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

    const generalInScope = scopeSlugs.some((slug) => slug === '' || slug === DEFAULT_SESSION_SLUG_ALIAS);
    if (generalInScope) return null;

    const firstScopedSlug = scopeSlugs.find((slug) => slug && slug !== DEFAULT_SESSION_SLUG_ALIAS);
    if (!firstScopedSlug) return null;

    return {
      slug: firstScopedSlug,
      path: `/session/${firstScopedSlug}`,
    };
  };

  isFirstVisitRootRedirectEnabled = () => {
    try {
      if (typeof globalThis !== 'undefined' && typeof globalThis.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED !== 'undefined') {
        return this.readBoolishRuntimeFlag(
          globalThis.CE_FIRST_VISIT_ROOT_REDIRECT_ENABLED,
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

  getSessionFallbackRedirectStorageKey = (slugIn = '') => {
    const normalizedSlug = normalizeSessionSlug(slugIn || '');
    const storageSlug = normalizedSlug || DEFAULT_SESSION_SLUG_ALIAS;
    return `${SESSION_FALLBACK_REDIRECT_STORAGE_KEY_PREFIX}${storageSlug}`;
  };

  hasConsumedSessionFallbackRedirect = (target = null) => {
    if (typeof window === 'undefined' || !window.sessionStorage || !target?.path) return false;
    try {
      return sessionStorage.getItem(this.getSessionFallbackRedirectStorageKey(target.slug)) === 'true';
    } catch (e) {
      mainSiteLog.warn('[MainSite] session fallback redirect read failed', e);
      return false;
    }
  };

  consumeSessionFallbackRedirect = (target = null) => {
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

  syncSessionFallbackRedirectConsumption = ({ pathIn = '' } = {}) => {
    const target = this.getSessionFallbackPreferredTarget();
    if (!target) return null;
    const currentPath = this.getEffectiveRoutePath(pathIn);
    if (this.isOnOrWithinRoutePath(currentPath, target.path)) {
      this.consumeSessionFallbackRedirect(target);
    }
    return target;
  };

  getSessionFallbackRedirectTarget = ({ pathIn = '' } = {}) => {
    const currentPath = this.getEffectiveRoutePath(pathIn);
    if (!currentPath || currentPath === '/') return null;
    if (!this.isGeneralRoutePath(currentPath)) return null;
    return this.getSessionFallbackPreferredTarget();
  };

  applySessionFallbackRedirect = ({ pathIn = '' } = {}) => {
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

  mergeLegacyNumericNetworkKey = (cacheObj, canonicalNetworkKey) => {
    if (!cacheObj || typeof cacheObj !== 'object') return false;
    const networkKey = String(canonicalNetworkKey || '');
    if (!networkKey) return false;
    const altKey = Object.keys(cacheObj).find(
      (k) => k !== networkKey && Number(k) === Number(networkKey)
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

  isCacheReinitRunActive = (token) => (
    !!this._mounted && Number(token || 0) === Number(this._activeCacheReinitRunToken || 0)
  );

  resolveActiveSlugForCacheUpdates = () => {
    const stateSlugRaw = this.getSessionSlugFromState() || '';
    const stateSlug = String(normalizeSessionSlug(stateSlugRaw) || stateSlugRaw || '')
      .trim()
      .toLowerCase();
    if (stateSlug) return stateSlug;

    const path = this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const token = this.getSessionTokenFromPath(path);
    if (!token) return '';

    const resolvedFromPathRaw = this.resolveSessionSlugFromPathToken(token, { allowAsyncResolve: false }) || '';
    return String(normalizeSessionSlug(resolvedFromPathRaw) || resolvedFromPathRaw || '')
      .trim()
      .toLowerCase();
  };

  setReadinessStateIfChanged = (...args) => this._cacheReadinessController.setReadinessStateIfChanged(...args);

  syncCacheHasLoadedFlagOnTransition = (...args) => this._cacheReadinessController.syncCacheHasLoadedFlagOnTransition(...args);

  scheduleCacheUpdateFlush = (...args) => this._cacheReadinessController.scheduleCacheUpdateFlush(...args);

  queueCacheUpdateFlush = (...args) => this._cacheReadinessController.queueCacheUpdateFlush(...args);

  flushQueuedCacheUpdates = (...args) => this._cacheReadinessController.flushQueuedCacheUpdates(...args);

  queueLocalRevisionUpdate = (...args) => this._cacheReadinessController.queueLocalRevisionUpdate(...args);

  flushLocalRevisionUpdate = (...args) => this._cacheReadinessController.flushLocalRevisionUpdate(...args);

  handleCrossTabCacheUpdateEvent = (...args) => this._cacheReadinessController.handleCrossTabCacheUpdateEvent(...args);

  queueSurveyGroupScan = (surveyID, opts = {}) => {
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

  pruneMaskedQuestionDecryptBackoff = (nowIn = Date.now()) => {
    const memo = this._maskedQuestionDecryptBackoff;
    if (!(memo instanceof Map) || memo.size === 0) return;
    const now = Number(nowIn || Date.now());
    const staleBefore = now - MASKED_Q_DECRYPT_BACKOFF_TTL_MS;
    memo.forEach((entry, key) => {
      const ts = Number(entry?.ts || 0);
      if (!Number.isFinite(ts) || ts <= 0 || ts <= staleBefore) {
        memo.delete(key);
      }
    });
    while (memo.size > MASKED_Q_DECRYPT_BACKOFF_MAX) {
      const oldest = memo.keys().next().value;
      if (!oldest) break;
      memo.delete(oldest);
    }
  };

  // Group slug parser
  getSessionTokenFromPath = (pathIn = '') => {
    const p = String(this.getEffectiveRoutePath(pathIn) || '').trim();
    if (!p.startsWith('/session/')) return '';
    return (p.split('/').filter(Boolean)[1] || '').trim();
  };

  resolveSessionSlugFromPathToken = (rawToken, { allowAsyncResolve = false } = {}) => {
    const result = resolveMainSiteSessionSlugFromPathToken({
      rawToken,
      formatSessionId: sessionRegistryUtils.formatSessionId,
      resolveSessionConfigById: sessionRegistryStore.getSessionConfigById,
      resolveSessionConfigBySlug: (slug) => sessionRegistryStore.getSessionConfig(slug) || getSessionConfigBySlug(slug),
    });
    if (!result && allowAsyncResolve) {
      const sessionId = sessionRegistryUtils.formatSessionId(String(rawToken || '').trim());
      if (sessionId) this.resolveSessionPathId(sessionId);
    }
    return result;
  };

	  resolveSessionPathId = (sessionIdIn) => {
	    const sessionId = sessionRegistryUtils.formatSessionId(sessionIdIn);
	    if (!sessionId) return;

	    this._pendingSessionPathIdResolves = this._pendingSessionPathIdResolves || new Set();
	    this._sessionPathIdResolveAttempts = this._sessionPathIdResolveAttempts || {};
	    this._sessionPathResolveErrorCounts = this._sessionPathResolveErrorCounts || { id: {}, slug: {} };
	    this._sessionPathResolveLastErrors = this._sessionPathResolveLastErrors || { id: {}, slug: {} };
	    this._sessionPathResolveRetryTimers = this._sessionPathResolveRetryTimers || { id: {}, slug: {} };

	    if (this._pendingSessionPathIdResolves.has(sessionId)) return;
	    const now = Date.now();
	    const lastAttempt = Number(this._sessionPathIdResolveAttempts[sessionId] || 0);
	    if (now - lastAttempt < 3000) return;

    this._sessionPathIdResolveAttempts[sessionId] = now;
    this._pendingSessionPathIdResolves.add(sessionId);

		    (async () => {
		      try {
		        const lit = getGlobalLitHooks();
		        const chainIds = getSessionRegistryChainIds();
		        let resolved = false;
		        let lastErr = null;
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
	        this._pendingSessionPathIdResolves.delete(sessionId);
	        if (this._mounted) {
	          this.setState((prev) => ({
	            sessionPathResolutionNonce: Number(prev.sessionPathResolutionNonce || 0) + 1,
	          }));
	        }
	      }
	    })();
	  };

		  resolveSessionPathSlug = (slugIn) => {
		    const slug = normalizeSessionSlug(slugIn);
		    if (!slug) return;

	    this._pendingSessionPathSlugResolves = this._pendingSessionPathSlugResolves || new Set();
	    this._sessionPathSlugResolveAttempts = this._sessionPathSlugResolveAttempts || {};
	    this._sessionPathResolveErrorCounts = this._sessionPathResolveErrorCounts || { id: {}, slug: {} };
	    this._sessionPathResolveLastErrors = this._sessionPathResolveLastErrors || { id: {}, slug: {} };
	    this._sessionPathResolveRetryTimers = this._sessionPathResolveRetryTimers || { id: {}, slug: {} };

	    if (this._pendingSessionPathSlugResolves.has(slug)) return;
	    const now = Date.now();
	    const lastAttempt = Number(this._sessionPathSlugResolveAttempts[slug] || 0);
	    if (now - lastAttempt < 3000) return;

    this._sessionPathSlugResolveAttempts[slug] = now;
    this._pendingSessionPathSlugResolves.add(slug);

		    (async () => {
		      try {
		        const lit = getGlobalLitHooks();
		        const chainIds = getSessionRegistryChainIds();
		        let resolved = false;
		        let lastErr = null;
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
			        this._pendingSessionPathSlugResolves.delete(slug);
			        if (this._mounted) {
			          this.setState((prev) => ({
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

  getExplicitSessionSlugFromProps = (props = this.props, { allowAsyncResolve = true } = {}) => {
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

  getGlobalPrimarySessionSlugFromProps = (props = this.props) => {
    const primarySessionSlug = normalizeSessionSlug(props?.sessionState?.primarySessionSlug || '');
    const primarySessionExplicit = props?.sessionState?.primarySessionExplicit === true;
    const selectedSessionScope = String(props?.sessionState?.selectedSessionScope || '').trim().toLowerCase();
    const selectedSessionSlugs = Array.isArray(props?.sessionState?.selectedSessionSlugs)
      ? props.sessionState.selectedSessionSlugs
      : [];
    const listIncludesGeneral = selectedSessionSlugs.some((slug) => normalizeSessionSlug(slug || '') === '');
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

  getSessionSlugFromProps = (props = this.props) => {
    const routeSession = this.getExplicitSessionSlugFromProps(props, { allowAsyncResolve: true });
    if (routeSession.hasExplicitSessionSlug) return routeSession.sessionSlug;
    const activeSessionSlug = props.activeSessionSlug || '';
    const primarySessionExplicit = props?.sessionState?.primarySessionExplicit === true;
    const selectedSessionScope = String(props?.sessionState?.selectedSessionScope || '').trim().toLowerCase();
    const selectedSessionSlugs = Array.isArray(props?.sessionState?.selectedSessionSlugs)
      ? props.sessionState.selectedSessionSlugs
      : [];
    const listIncludesGeneral = selectedSessionSlugs.some((slug) => normalizeSessionSlug(slug || '') === '');
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

  getDisplaySessionCfg = (slugIn) => {
    const normalized = normalizeSessionSlug(slugIn ?? '');
    const strictCfg = this.getSessionCfg(normalized);
    if (strictCfg) return strictCfg;
    return getDemoSessionConfigBySlug(normalized, { allowDemoFallback: true }) || null;
  };

  getDisplaySessionChainId = (slugIn) => {
    const strictChainId = this.getSessionChainId(slugIn);
    if (strictChainId) return strictChainId;
    const cfg = this.getDisplaySessionCfg(slugIn);
    const chainId = Number(cfg?.networkChainId || 0);
    return Number.isFinite(chainId) && chainId > 0 ? chainId : null;
  };

  getDisplaySessionNetwork = (slugIn) => {
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
    this.setState((prev) => ({
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

  getBootstrapActiveSessionSlug = (pathIn = '', searchIn = '') => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    const search = typeof searchIn === 'string'
      ? searchIn
      : ((typeof window !== 'undefined' ? window.location.search : '') || '');
    return this.getRenderActiveSessionSlug(path, search);
  };

  getRenderActiveSessionSlug = (pathIn = '', searchIn = '') => {
    const path = this.getEffectiveRoutePath(
      pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
    return resolveMainSiteRenderActiveSessionSlug({
      path,
      search: searchIn,
      activeSessionSlug: this.getGlobalPrimarySessionSlugFromProps(this.props),
      isCacheManagerReady: this.state.isCacheManagerReady,
      getSessionConfigBySlug,
      resolveDisplaySessionConfigBySlug: (slug) => (
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
      ),
      resolveSessionConfigById: (sessionId) => sessionRegistryStore.getSessionConfigById(sessionId),
      resolveSessionSlugFromPathToken: (sessionToken) => (
        this.resolveSessionSlugFromPathToken(sessionToken, { allowAsyncResolve: true })
      ),
    });
  };

  resolveTrustedSbtRouteSessionSlug = (searchIn = '') => {
    const hintedSlug = resolveMainSiteRouteSessionSlugHint({
      search: searchIn,
      allowSessionIdLookup: true,
      resolveSessionConfigById: (sessionId) => (
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

  resolvePinnedSbtDetailRouteSlug = async (sbtAddress, opts = {}) => {
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

  getSbtAddressFromPath = (pathIn) => {
    const p = pathIn || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const clean = String(p || '').split('?')[0].split('#')[0];
    const parts = clean.split('/').filter(Boolean);
    if (!['sbt', 'group'].includes(parts[0]) || !parts[1]) return null;
    const addr = parts[1];
    return ethers.utils.isAddress(addr) ? addr : null;
  };

  isSbtListRoutePath = (pathIn = '') => {
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

  getSbtListRouteSessionSlug = (pathIn = '') => {
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

  getUserAddressFromPath = (pathIn) => {
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
    const { chainId, litNetwork, litChain, accessControlConditions, userMaxPrice } = resolveMainSiteLitSessionConfig({
      sessionConfig: cfg,
      networkChainIdFallback: this.props.network?.id || null,
    });

    const hooks = createLitHooks({
      providerLike: this.props.provider,
      account: this.props.account,
      chainId,
      litChain,
      litNetwork,
      userMaxPrice,
      paymentDelegation: {
        enabled: cfg?.sponsoredKeys?.lit === true,
        sessionSlug: slug,
        sessionConfig: cfg,
        workerUrl: cfg?.corsWorkerUrl || '',
      },
      accessControlConditions: accessControlConditions || undefined,
    });

    setGlobalLitHooks(hooks);
    attachLitDevTools({
      providerLike: this.props.provider,
      account: this.props.account,
      chainId,
      litChain,
    });
    this.setState({ litHooks: hooks });
  };

  getSessionInfoForGroup = (sessionConfig = {}, slug = '') => {
    const overrides = this.state.sessionInfoOverrides || {};
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

  getSessionNameForGroup = (sessionConfig = {}, slug = '') => {
    const overrides = this.state.sessionNameOverrides || {};
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

  hasEncryptedSessionField = (sessionConfig = {}, field = '') => {
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

  getSessionHeaderForGroup = (sessionConfig = {}, slug = '') => {
    const overrides = this.state.sessionHeaderOverrides || {};
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
      this.setState((prev) => ({
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
      result.errors.forEach(({ error }) => {
        mainSiteLog.warn('MainSite: fallback', error);
      });

      if (!Object.keys(result.patches || {}).length) return;
      this.setState((prev) => {
        const nextState = {};
        Object.entries(result.patches).forEach(([stateKey, patch]) => {
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
        const fromWindow = Number(window.CE_SURVEY_DEEPLINK_RPC_TIMEOUT_MS);
        if (Number.isFinite(fromWindow) && fromWindow > 0) return Math.floor(fromWindow);
      }
    } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    return 12000;
  };

  resolveMetadataSessionBinding = (metadata, fallbackSlug = '') => (
    resolveMetadataSessionBindingFn(metadata, fallbackSlug)
  );

  resolveMetadataSessionSlug = (metadata, fallbackSlug = '') => (
    resolveMetadataSessionSlugFn(metadata, fallbackSlug)
  );

  resolveScopedMetadataSessionSlug = (metadata, fallbackSlug = '') => (
    resolveScopedMetadataSessionSlugFn(metadata, fallbackSlug)
  );

  buildMetadataSessionCacheEnvelope = (metadata, fallbackSlug = '', options = {}) => (
    buildMetadataSessionCacheEnvelopeFn(metadata, fallbackSlug, options)
  );

  writeSurveyMetadataToCache = (slugIn, surveyId, surveyData, creationBlock = null, netKeyIn = null, options = {}) => {
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

  writeQuestionMetadataToCache = (slugIn, questionId, questionData, netKeyIn = null, options = {}) => {
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

  findGroupSlugForSurvey = (surveyID) => {
    if (!surveyID) return this.getSessionSlugFromState();
    const sid = String(surveyID).toLowerCase();

    const currentSlug = this.getSessionSlugFromState();
    const queryHintSlug = this.getSurveyRouteSessionSlugHint();

    // Helper: Check if a specific slug/group knows this survey
    const getCachedSurveySlug = (slug) => {
      const cfg = this.getSessionCfg(slug);
      // 1. Config list
      if (Array.isArray(cfg?.HIGHLIGHTED_SURVEY_IDS) &&
          cfg.HIGHLIGHTED_SURVEY_IDS.some(id => String(id).toLowerCase() === sid)) {
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

  getSessionSlugHintFromSearch = (search = '') => {
    try {
      return resolveMainSiteRouteSessionSlugHint({
        search,
        allowSessionIdLookup: true,
        resolveSessionConfigById: (sessionId) => sessionRegistryStore.getSessionConfigById(sessionId),
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

  getQuestionRouteSessionIdHint = ({ requireResolved = false } = {}) => {
    try {
      if (typeof window === 'undefined') return null;
      return resolveMainSiteRouteSessionIdHint({
        search: window.location.search || '',
        requireResolved,
        formatSessionId: sessionRegistryUtils.formatSessionId,
        resolveSessionConfigById: (sessionId) => sessionRegistryStore.getSessionConfigById(sessionId),
      });
    } catch (_) {
      return null;
    }
  };

  findGroupSlugForQuestion = (questionID) => {
    if (!questionID) return this.getSessionSlugFromState();
    const qid = String(questionID).toLowerCase();
    const currentSlug = this.getSessionSlugFromState();
    const querySlug = this.getQuestionRouteSessionSlugHint();
    const getCachedQuestionSlug = (slug) => {
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
          for (const sv of Object.values(surveys)) {
            if (!Array.isArray(sv?.questionIDs)) continue;
            for (let i = 0; i < sv.questionIDs.length; i += 1) {
              if (String(sv.questionIDs[i] || '').toLowerCase() === qid) {
                return this.resolveMetadataSessionSlug(sv, slug);
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

  resolveGroupSlugForSbtAddress = async (sbtAddress, opts = {}) => {
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
        .map((s) => {
          const cfg = getSessionConfigBySlugOrDefault(s) || {};
          const startRaw = Number(cfg?.blockLimits?.start);
          const start = Number.isFinite(startRaw) && startRaw > 0 ? startRaw : -1;
          return { slug: s, start };
        })
        .sort((a, b) => (Number(b.start) || 0) - (Number(a.start) || 0));

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
  DG = createMainSiteDgStorage();

  // Session config accessors (extracted to mainSiteSessionConfig.js)
  getSessionCfg = _getSessionCfg;
  getSessionChainId = _getSessionChainId;
  getSessionNetwork = _getSessionNetwork;

  isSbtInstanceListenerEnabledForGroup = (slugIn) => this._scanPolicy.isSbtInstanceListenerEnabledForGroup(slugIn);
  isSbtHistoryScanEnabled = () => this._scanPolicy.isSbtHistoryScanEnabled();
  getSessionScanScope = () => this._scanPolicy.getSessionScanScope();
  getSessionScanScopeContext = (scopeIn) => this._scanPolicy.getSessionScanScopeContext(scopeIn);
  hasExplicitProfileScanScopeOverride = (...args) => this._profileScanController.hasExplicitProfileScanScopeOverride(...args);
  getProfileScanScopeContext = (...args) => this._profileScanController.getProfileScanScopeContext(...args);

  isSessionSlugAllowedForScan = (slugIn, scopeContextIn = null) => (
    this._scanPolicy.isSessionSlugAllowedForScan(slugIn, scopeContextIn)
  );
  logScopeSkipOnce = (operation, slugIn, scopeContextIn = null) => (
    this._scanPolicy.logScopeSkipOnce(operation, slugIn, scopeContextIn)
  );
  shouldAutoRunFullSbtScan = (opts) => this._scanPolicy.shouldAutoRunFullSbtScan(opts);
  shouldAttachSbtDetailInstanceListener = () => this._scanPolicy.shouldAttachSbtDetailInstanceListener();
  getScopedSessionSlugs = (scopeIn) => this._scanPolicy.getScopedSessionSlugs(scopeIn);
  readBoolishRuntimeFlag = (...args) => this._profileScanController.readBoolishRuntimeFlag(...args);
  isProfileScanTelemetryEnabled = (...args) => this._profileScanController.isProfileScanTelemetryEnabled(...args);
  emitProfileScanTelemetry = (...args) => this._profileScanController.emitProfileScanTelemetry(...args);
  isProfileScanColdDiagEnabled = (...args) => this._profileScanController.isProfileScanColdDiagEnabled(...args);
  emitProfileScanColdDiag = (...args) => this._profileScanController.emitProfileScanColdDiag(...args);
  readProfileScanStepTimeoutMs = (...args) => this._profileScanController.readProfileScanStepTimeoutMs(...args);
  readProfileScanSbtBurstSize = (...args) => this._profileScanController.readProfileScanSbtBurstSize(...args);
  readProfileScanActivityLookbackBlocks = (...args) => this._profileScanController.readProfileScanActivityLookbackBlocks(...args);
  readUserProfileAllSessionsFlag = (...args) => this._profileScanController.readUserProfileAllSessionsFlag(...args);
  getUserProfileAllSessionsScanMode = (...args) => this._profileScanController.getUserProfileAllSessionsScanMode(...args);
  isUserProfileAllSessionsScanEnabled = (...args) => this._profileScanController.isUserProfileAllSessionsScanEnabled(...args);
  getActiveProfileScanChainId = (...args) => this._profileScanController.getActiveProfileScanChainId(...args);
  getRegistrySessionEntryCount = (...args) => this._profileScanController.getRegistrySessionEntryCount(...args);
  getRegistrySessionCoverageCountForChain = (...args) => this._profileScanController.getRegistrySessionCoverageCountForChain(...args);
  getRegistryBootstrapScopeKey = (...args) => this._profileScanController.getRegistryBootstrapScopeKey(...args);
  readProfileScanRegistryLookupTimeoutMs = (...args) => this._profileScanController.readProfileScanRegistryLookupTimeoutMs(...args);
  getProfileScanListScopeSessionConfigCacheKey = (...args) => this._profileScanController.getProfileScanListScopeSessionConfigCacheKey(...args);
  resolveListScopeSessionConfigFromRegistry = (...args) => this._profileScanController.resolveListScopeSessionConfigFromRegistry(...args);
  ensureRegistryHydratedForProfileScan = (...args) => this._profileScanController.ensureRegistryHydratedForProfileScan(...args);
  isOnchainSessionRegistryEnabled = (...args) => this._profileScanController.isOnchainSessionRegistryEnabled(...args);
  refreshSessionUniverseRegistryCache = (...args) => this._profileScanController.refreshSessionUniverseRegistryCache(...args);
  resolveProfileDeepScanPlan = (...args) => this._profileScanController.resolveProfileDeepScanPlan(...args);
  scheduleProfileScanRetryAfterRegistryHydration = (...args) => this._profileScanController.scheduleProfileScanRetryAfterRegistryHydration(...args);
  getProfileDeepScanSlugs = (...args) => this._profileScanController.getProfileDeepScanSlugs(...args);

  shouldSkipSessionScanForSlug = (slugIn, operation, scopeContextIn = null) => (
    this._scanPolicy.shouldSkipSessionScanForSlug(slugIn, operation, scopeContextIn)
  );
  scanScopeNoop = (slugIn, operation, onSkipped) => this._scanPolicy.scanScopeNoop(slugIn, operation, onSkipped);
  getScopeFilteredSlugs = (slugs = [], scopeIn = null) => this._scanPolicy.getScopeFilteredSlugs(slugs, scopeIn);
  shouldBackfillGeneralSession = (...args) => this._profileScanController.shouldBackfillGeneralSession(...args);
  enqueueGeneralSessionBackfill = (...args) => this._profileScanController.enqueueGeneralSessionBackfill(...args);
  runWithGeneralSessionBackfill = (...args) => this._profileScanController.runWithGeneralSessionBackfill(...args);

  scanForSurveyGroup = async (surveyID, opts = {}) => {
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
          .map((slug) => normalizeSessionSlug(slug || ''));
        allSlugs = Array.from(new Set(prioritized));
      }
    }

    const rpcTimeoutMs = this.getSurveyDeepLinkRpcTimeoutMs();
    const runWithTimeout = async (promiseFactory, label, slug) => {
      let timeoutId = null;
      try {
        return await Promise.race([
          Promise.resolve().then(() => promiseFactory()),
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => {
              const err = new Error(
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
      let scanLoadError = null;
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

            scanLoadError = new Error(`Survey metadata fetch returned no data for session "${slug}".`);
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
        scanErrorMessage: String(err?.message || 'Survey resolution failed unexpectedly.'),
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
  scanSpecificUserProfilePriority = async (targetAddress) => {
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

  scanSpecificUserProfile = async (targetAddress) => {
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
              .map((slug) => normalizeSessionSlug(slug || ''))
          ))
        : [];
      const attemptedCoverageSlugs = (
        allowListScopeAnyFanout &&
        listScopeCoverageSlugs.length > 0
      )
        ? listScopeCoverageSlugs
        : [...allSlugs];
      const attemptedCoverageSlugSet = new Set(
        attemptedCoverageSlugs.map((slug) => normalizeSessionSlug(slug || ''))
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

      const pushUnique = (list, value) => {
        if (!Array.isArray(list)) return;
        const token = String(value || '');
        if (!token) return;
        if (!list.includes(token)) list.push(token);
      };
      const pushUniqueSample = (list, value, max = 12) => {
        if (!Array.isArray(list)) return;
        const token = String(value || '').trim().toLowerCase();
        if (!token || list.includes(token)) return;
        if (list.length >= Math.max(1, Number(max) || 1)) return;
        list.push(token);
      };
      const normalizeEventIdentifier = (raw) => String(raw || '').trim().toLowerCase();
      const readCreatedSurveyId = (item = {}) => normalizeEventIdentifier(
        item?.id || item?.surveyId || item?.surveyID
      );
      const readCreatedQuestionId = (item = {}) => normalizeEventIdentifier(
        item?.id || item?.questionId || item?.questionID
      );
      const readSurveyResponseId = (item = {}) => normalizeEventIdentifier(
        item?.surveyId || item?.surveyID || item?.id
      );
      const readQuestionResponseId = (item = {}) => normalizeEventIdentifier(
        item?.questionId || item?.questionID || item?.id
      );
      const skippedSlugReasons = {};

      const markSlugSkipped = (slug, reason, extra = {}) => {
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

      const normalizeActivityPayload = (raw) => {
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

      const scanOneSlug = async (slug) => {
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
                error: fallbackError?.message || String(fallbackError),
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

          const resolveActivityWindow = (lastBlockValue, incompleteFlag) => {
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
            baseTimeoutMs,
            shouldForceBackfill,
            allowAdaptiveBackfill,
            opts = {}
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

          const runWithTimeout = async (promise, kind, fromBlock, timeoutMs) => {
            let timeoutId = null;
            const effectiveTimeoutMs = Number.isFinite(Number(timeoutMs))
              ? Math.max(5000, Math.floor(Number(timeoutMs)))
              : Math.max(5000, Math.floor(Number(slugFetchTimeoutMs || 12000)));
            try {
              const outcome = await Promise.race([
                Promise.resolve(promise)
                  .then((value) => ({ timedOut: false, value }))
                  .catch((error) => ({ timedOut: false, error })),
                new Promise((resolve) => {
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
            (chainEntry.data.sbts || []).forEach(item => {
              if (item.sbtAddress) existingSbtMap.set(item.sbtAddress.toLowerCase(), item);
            });

            // Merge new SBTs
            sbts.forEach(newItem => {
              if (newItem.sbtAddress) {
                // Overwrite or add. If getSBTsForUser returns current state, this keeps it fresh.
                existingSbtMap.set(newItem.sbtAddress.toLowerCase(), newItem);
              }
            });

            chainEntry.data.sbts = Array.from(existingSbtMap.values());

            // Append other activity arrays with dedupe.
            const dedupById = (oldArr, newArr) => {
              const map = new Map();
              (oldArr || []).forEach(i => map.set(i.id || JSON.stringify(i), i));
              (newArr || []).forEach(i => map.set(i.id || JSON.stringify(i), i));
              return Array.from(map.values());
            };

            const buildFallbackMergeKey = (item) => {
              try {
                return `__fallback__${JSON.stringify(item)}`;
              } catch (_) {
                return `__fallback__${String(item || '')}`;
              }
            };
            const readResponseRecency = (item) => {
              const row = (item && typeof item === 'object') ? item : {};
              return {
                bn: Number(row.blockNumber ?? row.bn ?? 0) || 0,
                txi: Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0) || 0,
                li: Number(row.logIndex ?? row.li ?? 0) || 0,
                ts: Number(row.timestamp ?? row.ts ?? 0) || 0,
              };
            };
            const compareResponseRecency = (incoming, existing) => {
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
            const upsertByStableResponseKey = (oldArr, newArr, buildKey, opts = {}) => {
              const preferNewerByRecency = !!(opts && opts.preferNewerByRecency);
              const map = new Map();
              const mergeOne = (item, preferIncomingOnTie = false) => {
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
              (oldArr || []).forEach((item) => mergeOne(item, false));
              // Latest scan rows can replace equal-recency rows to preserve fresh payload fields.
              (newArr || []).forEach((item) => mergeOne(item, true));
              return Array.from(map.values());
            };
            const buildSurveyResponseKey = (item) => {
              const surveyId = String(item?.surveyId || item?.surveyID || item?.id || '').trim().toLowerCase();
              const responder = String(item?.responder || '').trim().toLowerCase();
              if (!surveyId || !responder) return '';
              return `${surveyId}|${responder}`;
            };
            const buildQuestionResponseKey = (item) => {
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

            sbts.forEach((item) => {
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
            activity.createdSurveys.forEach(({ id, data }) => {
              const idLower = id.toLowerCase();
              if (data) {
                data.surveyID = idLower;
                survCache[netKey].surveys[idLower] = data;
              }
            });

            // Merge Responses
            activity.surveyResponses.forEach(({ surveyId, response, responder }) => {
              const sIdLower = surveyId.toLowerCase();
              const rLower = responder.toLowerCase();
              if (!survCache[netKey].surveyResponses[sIdLower]) {
                survCache[netKey].surveyResponses[sIdLower] = {};
              }
              survCache[netKey].surveyResponses[sIdLower][rLower] = response;
            });

            // Backfill response-linked survey metadata for cold user-profile loads.
            const missingSurveyIds = new Set();
            activity.surveyResponses.forEach(({ surveyId }) => {
              const surveyIdLower = String(surveyId || '').toLowerCase();
              if (!surveyIdLower) return;
              if (!survCache[netKey].surveys[surveyIdLower]) {
                missingSurveyIds.add(surveyIdLower);
              }
            });
            if (missingSurveyIds.size > 0) {
              const rows = await Promise.all(
                Array.from(missingSurveyIds).map(async (surveyIdLower) => {
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
              rows.forEach(({ surveyIdLower, surveyData }) => {
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
            activity.createdQuestions.forEach(({ id, data }) => {
              const idLower = id.toLowerCase();
              if (data) {
                data.id = idLower;
                qCache[netKey].questions[idLower] = data;
              }
            });

            // Merge Responses
            activity.questionResponses.forEach(
              ({ questionId, response, responder, blockNumber, transactionIndex, logIndex, timestamp }) => {
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
            activity.questionResponses.forEach(({ questionId }) => {
              const questionIdLower = String(questionId || '').toLowerCase();
              if (!questionIdLower) return;
              if (!qCache[netKey].questions[questionIdLower]) {
                missingQuestionIds.add(questionIdLower);
              }
            });
            if (missingQuestionIds.size > 0) {
              const decryptContext = this.buildQuestionDecryptContext(slug);
              const rows = await Promise.all(
                Array.from(missingQuestionIds).map(async (questionIdLower) => {
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
              rows.forEach(({ questionIdLower, questionData }) => {
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
            error: String(err?.message || err),
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
        report.attemptedSlugs.every((slug) => (
          String(report.skippedSlugReasons?.[String(slug || '')] || '') === 'missing-chain-id'
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
          globalThis.__CE_PROFILE_SCAN_LAST_EVENT_SUMMARY__ = {
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
        this.setState((prev) => ({
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
  readFlag(name, slug) { return this._cachePersistenceController.readFlag(name, slug); }
  writeFlag(name, slug, val) { this._cachePersistenceController.writeFlag(name, slug, val); }
  hasPersistedManagedCacheData = (...args) => this._cachePersistenceController.hasPersistedManagedCacheData(...args);
  syncCacheHasLoadedFlagFromPersistent = (...args) => this._cachePersistenceController.syncCacheHasLoadedFlagFromPersistent(...args);

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
        : this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '')
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
        new Promise((_, reject) => {
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
        .catch((err) => {
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
      const CURRENT_CACHE_VERSION = '2026-04-06-arweave-reliability-v1';
      const VERSION_KEY = 'appCacheVersion';
      const storedVersion = localStorage.getItem(VERSION_KEY);
      if (storedVersion !== CURRENT_CACHE_VERSION) {
        // Only bust derived/rehydratable caches; preserve user-authored caches.
        for (const s of getAllSessionSlugs()) {
          await Promise.all(
            DG_PRIMARY_ROUTE_CACHE_NAMES.map((namespace) => this.DG.remove(namespace, s))
          );
          await this.syncCacheHasLoadedFlagFromPersistent(s, { force: true });
        }
        localStorage.setItem(VERSION_KEY, CURRENT_CACHE_VERSION);
        mainSiteLog.log('[CacheBust] Cleared caches for all groups due to version change:', {
          from: storedVersion, to: CURRENT_CACHE_VERSION
        });
        if (typeof window !== 'undefined' && window.location && typeof window.location.reload === 'function') {
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

    const pathname = this.getEffectiveRoutePath(
      this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
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
              (e) => this.onNewSbtEventDetectedForGroup(detailSlug, e),
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
              await new Promise((resolve) => setTimeout(resolve, 250));
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
      const path = this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      const questionIdFromPath = (() => {
        const match = path.match(/\/question\/([^/?#]+)/i);
        return match && match[1] ? String(match[1]).toLowerCase() : '';
      })();
      const activeSlug = this.getActiveSessionSlug();
      const questionSlug = questionIdFromPath ? this.findGroupSlugForQuestion(questionIdFromPath) : null;
      this._lastProcessedQuestionIdFromPath = questionIdFromPath;
      this._lastProcessedQuestionSlugFromPath = questionSlug;
      const slugsToRefresh = Array.from(
        new Set([activeSlug, questionSlug].filter((s) => s !== null && s !== undefined))
      );
      slugsToRefresh.forEach((slug) => {
        if (!this.hasMaskedQuestionPayloadInCache(slug)) return;
        this.refreshEncryptedQuestionPayloadsForGroup(slug).catch((err) => {
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
      if (this._queuedSurveyGroupScanTimer) clearTimeout(this._queuedSurveyGroupScanTimer);
      this._queuedSurveyGroupScanTimer = null;
      this._queuedSurveyGroupScanId = null;
      this._queuedSurveyGroupScanHintedSlug = '';
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

    // Cancel pending off-chain metadata retries to avoid background work after unmount.
    try {
      const buckets = [
        this._pendingQuestionMetadataRetryTimers,
      ];
      buckets.forEach((bucket) => {
        if (!bucket || typeof bucket !== 'object') return;
        Object.values(bucket).forEach((t) => {
          try { clearTimeout(t); } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
        });
      });
      this._pendingQuestionMetadataRetryTimers = null;
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

    // Cancel pending /session/:token resolve retries to avoid setState after unmount.
    try {
      const timers = this._sessionPathResolveRetryTimers;
      if (timers && typeof timers === 'object') {
        ['id', 'slug'].forEach((kind) => {
          const bucket = timers[kind];
          if (!bucket || typeof bucket !== 'object') return;
          Object.values(bucket).forEach((t) => {
            try { clearTimeout(t); } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
          });
        });
      }
    } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }

    this._questionInitInFlight = {};
    this._responseInitInFlight = {};
    this._questionInitPending = {};
    this._responseInitPending = {};
    if (this._maskedQuestionDecryptBackoff instanceof Map) {
      this._maskedQuestionDecryptBackoff.clear();
    }
    this._maskedQuestionDecryptBackoff = this._maskedQuestionDecryptBackoff || new Map();

    contractScripts.removeSBTEventListener('none', this.getSessionSlugFromState());
    contractScripts.removeSurveyEventsListener('none', this.getSessionSlugFromState());
    // Also remove any per-instance SBT listeners to avoid leaks across navigation:
    contractScripts.removeSBTInstanceEventsListener('none', [], this.getSessionSlugFromState());
  }

  componentDidUpdate(prevProps, prevState) {
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
      if (this._maskedQuestionDecryptBackoff instanceof Map) {
        this._maskedQuestionDecryptBackoff.clear();
      }
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
      const path = this.getEffectiveRoutePath(
        this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
      );
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
          new Set([activeSlug, questionSlug].filter((s) => s !== null && s !== undefined))
        );

        slugsToCheck.forEach((slug) => {
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
          this.refreshEncryptedQuestionPayloadsForGroup(slug).catch((err) => {
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
      if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
        mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: group chain change detected', { old: this._lastGroupChainId, new: currChainId });
      }
      this._lastGroupChainId = currChainId;
      this.handleNetworkChange();
    }

    const prevPathRaw = prevProps.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
    const currPathRaw = this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '';
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
      if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
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
      }).then((detailSlug) => {
        this.setState({ sbtDetailGroupSlug: detailSlug, sbtDetailAddress: currSbtAddr });
      }).catch((e) => { mainSiteLog.warn('MainSite: fallback', e); });
    } else if (!currSbtAddr && prevSbtAddr) {
      this.setState({ sbtDetailGroupSlug: null, sbtDetailAddress: null });
    }

    // Check for deep link scan if path changed
    if (currPath !== prevPath) {
      this.handleDeepLinkScan();
    }
  }

  handleDeepLinkScan = () => {
    const fullPath = this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '';

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
                     cfg.HIGHLIGHTED_SURVEY_IDS.some(id => String(id).toLowerCase() === surveyID);

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

      const hasAutoFlag = (raw) => {
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

    const pathname = (this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
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
              (e) => this.onNewSbtEventDetectedForGroup(detailSlug, e),
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
              const pathname = (this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
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
            const pathname = (this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
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

    this.setState((prev) => {
      const updates = {};
      let changed = false;

      if (prev.isAllCachesReady !== nextIsAllReady) {
        updates.isAllCachesReady = nextIsAllReady;
        changed = true;
      }
      return changed ? updates : null;
    });
    void this.syncCacheHasLoadedFlagOnTransition(slug, { isAllReady: nextIsAllReady });

    // Deferred full SBT scan trigger (demo-only)
    const pathname = (this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || '');
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

  ensureSessionRouteSbtDiscovery = (...args) => this._sbtCacheController.ensureSessionRouteSbtDiscovery(...args);

  sendMessageToServer = () => {
  };

  ensureLightSbtDiscovery = (...args) => this._sbtCacheController.ensureLightSbtDiscovery(...args);

  ensureLightSbtUniverse = (...args) => this._sbtCacheController.ensureLightSbtUniverse(...args);

  mergeSbtCountMaps = (...args) => this._sbtCacheController.mergeSbtCountMaps(...args);

  mergeSbtCountsPayload = (...args) => this._sbtCacheController.mergeSbtCountsPayload(...args);

  normalizeSbtHistorySummary = (...args) => this._sbtCacheController.normalizeSbtHistorySummary(...args);

  normalizeSbtCountMap = (...args) => this._sbtCacheController.normalizeSbtCountMap(...args);

  sumSbtCountMap = (...args) => this._sbtCacheController.sumSbtCountMap(...args);

  seedSbtCountMapFromLegacyAddresses = (...args) => this._sbtCacheController.seedSbtCountMapFromLegacyAddresses(...args);

  hydrateLegacySbtCountState = (...args) => this._sbtCacheController.hydrateLegacySbtCountState(...args);

  buildSbtHistorySummaryFromCounts = (...args) => this._sbtCacheController.buildSbtHistorySummaryFromCounts(...args);

  getCurrentHolderAddressesFromCounts = (...args) => this._sbtCacheController.getCurrentHolderAddressesFromCounts(...args);

  initializeSbtCache = (...args) => this._sbtCacheController.initializeSbtCache(...args);

  initializeSbtCacheWithGeneralBackfill = (...args) => this._sbtCacheController.initializeSbtCacheWithGeneralBackfill(...args);

  initializeSbtCacheForGroup = (...args) => this._sbtCacheController.initializeSbtCacheForGroup(...args);

  refreshSbtData = (...args) => this._sbtCacheController.refreshSbtData(...args);

  refreshSbtDataForGroup = (...args) => this._sbtCacheController.refreshSbtDataForGroup(...args);

  startSbtEventListener = (...args) => this._sbtCacheController.startSbtEventListener(...args);

  startSbtEventListenerForGroup = (...args) => this._sbtCacheController.startSbtEventListenerForGroup(...args);

  onNewSbtEventDetected = (...args) => this._sbtCacheController.onNewSbtEventDetected(...args);

  onNewSbtEventDetectedForGroup = (...args) => this._sbtCacheController.onNewSbtEventDetectedForGroup(...args);

  onSbtCreatedDetected = (...args) => this._sbtCacheController.onSbtCreatedDetected(...args);

  onSbtCreatedDetectedForGroup = (...args) => this._sbtCacheController.onSbtCreatedDetectedForGroup(...args);

  onSbtIssuedDetected = (...args) => this._sbtCacheController.onSbtIssuedDetected(...args);

  onSbtIssuedDetectedForGroup = (...args) => this._sbtCacheController.onSbtIssuedDetectedForGroup(...args);

  onSbtActivityDetected = (...args) => this._sbtCacheController.onSbtActivityDetected(...args);

  onSbtActivityDetectedForGroup = (...args) => this._sbtCacheController.onSbtActivityDetectedForGroup(...args);

  onSbtTransferDetected = (...args) => this._sbtCacheController.onSbtTransferDetected(...args);

  onSbtTransferDetectedForGroup = (...args) => this._sbtCacheController.onSbtTransferDetectedForGroup(...args);

  initializeSurveyCache = async () => {
    return this.initializeSurveyCacheWithGeneralBackfill(this.getActiveSessionSlug());
  };

  initializeSurveyCacheWithGeneralBackfill = async (slugIn) => {
    return this.runWithGeneralSessionBackfill({
      slugIn,
      operation: 'initializeSurveyCache',
      runPrimary: (slug) => this.initializeSurveyCacheForGroup(slug, { background: false }),
      runGeneral: (slug) => this.initializeSurveyCacheForGroup(slug, { background: true }),
    });
  };

  initializeSurveyCacheForGroup = (...args) => this._surveyCacheController.initializeSurveyCacheForGroup(...args);


  initializeQuestionCache = async () => {
    return this.initializeQuestionCacheWithGeneralBackfill(this.getActiveSessionSlug());
  };

  initializeQuestionCacheWithGeneralBackfill = async (slugIn) => {
    return this.runWithGeneralSessionBackfill({
      slugIn,
      operation: 'initializeQuestionCache',
      runPrimary: (slug) => this.initializeQuestionCacheForGroup(slug, { background: false }),
      runGeneral: (slug) => this.initializeQuestionCacheForGroup(slug, { background: true }),
    });
  };

  async initializeQuestionCacheForGroup(slugIn, opts = {}) {
    const slug = normalizeSessionSlug(slugIn || '');
    const suppressUiState = !!(opts && opts.background === true);
    const skipDiscoveryScan = !!(opts && opts.skipDiscoveryScan === true);
    const QUESTION_METADATA_BULK_ARWEAVE_RETRIES = 0;
    const QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS = 4500;
    const initRunKey = slug;
    const rerunOpts = {
      ...(opts && typeof opts === 'object' ? opts : {}),
      background: suppressUiState,
      skipDiscoveryScan,
    };
    const mergePendingQuestionInitOpts = (prevOpts, nextOpts) => {
      const nextBackground = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.background === true);
      const nextSkipDiscoveryScan = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.skipDiscoveryScan === true);
      if (!prevOpts || typeof prevOpts !== 'object') {
        return {
          background: nextBackground,
          skipDiscoveryScan: nextSkipDiscoveryScan,
        };
      }
      const prevBackground = !!(prevOpts.background === true);
      const prevSkipDiscoveryScan = !!(prevOpts.skipDiscoveryScan === true);
      return {
        background: prevBackground && nextBackground,
        // If any queued caller needs a real discovery pass, do not keep skip mode.
        skipDiscoveryScan: prevSkipDiscoveryScan && nextSkipDiscoveryScan,
      };
    };
    const setQuestionState = (nextState, cb) => {
      if (suppressUiState || !this._mounted) return;
      this.setState(nextState, cb);
    };
    const maybeCheckAllCachesReady = () => {
      if (suppressUiState) return;
      this.checkAllCachesReady();
    };
    if (this.scanScopeNoop(slug, 'initializeQuestionCacheForGroup', () => {
      setQuestionState({ isQuestionCacheReady: true }, this.checkAllCachesReady);
    })) {
      return;
    }
    this._questionInitInFlight = this._questionInitInFlight || {};
    this._questionInitPending = this._questionInitPending || {};
    if (this._questionInitInFlight[initRunKey]) {
      this._questionInitPending[initRunKey] = mergePendingQuestionInitOpts(this._questionInitPending[initRunKey], rerunOpts);
      return this._questionInitInFlight[initRunKey];
    }

    const run = (async () => {
    mainSiteLog.log("initializeQuestionCacheForGroup() - invoked with Infura chunked scanning", { slug });
    setQuestionState((prev) =>
      prev.questionCacheInitializationError ? { questionCacheInitializationError: false } : null
    );

    const networkID = String(this.getSessionChainId(slug) || '');
    const scopedSlug = normalizeSessionSlug(slug || '');
    const QUESTION_SCAN_MAX_BLOCK_RANGE = readSessionScanMaxBlockRange(
      DEFAULT_SESSION_SCAN_MAX_BLOCK_RANGE
    );
    const abortQuestionScan = ({ code = 'scan_aborted', message = 'Question scan aborted.' } = {}) => {
      const nowMs = Date.now();
      mainSiteLog.warn('[QuestionScan] Aborting question scan', {
        slug: scopedSlug || 'general',
        code,
        message,
      });
      setQuestionState((prev) => ({
        isQuestionCacheReady: true,
        questionScanProgress: {
          ...(prev?.questionScanProgress || {}),
          slug: scopedSlug,
          phase: 'error',
          errorCode: String(code || 'scan_aborted'),
          errorMessage: String(message || 'Question scan aborted.'),
          finishedAtMs: nowMs,
          totalBlocks: 0,
          scannedBlocks: 0,
          remainingBlocks: 0,
        },
      }), this.checkAllCachesReady);
    };
    const sessionCfgForScan = this.getSessionCfg(slug);
    const shouldRequireRegistryGeneral = slug === '';
    if (shouldRequireRegistryGeneral && !sessionCfgForScan) {
        abortQuestionScan({
          code: 'session_not_found',
          message: 'No session found for "general".',
        });
        return;
    }
    let resolvedWindow = null;
    try {
      resolvedWindow = await contractScripts.getRelevantBlockWindowForFilter(slug);
    } catch (windowErr) {
      abortQuestionScan({
        code: 'block_window_unavailable',
        message: windowErr?.message || 'Failed to resolve session block window.',
      });
      return;
    }
    const scanWindow = resolveValidatedSessionScanWindow({
      slug,
      blockLimits: sessionCfgForScan?.blockLimits || null,
      resolvedWindow,
      maxBlockRange: QUESTION_SCAN_MAX_BLOCK_RANGE,
    });
    if (!scanWindow.ok) {
      abortQuestionScan({
        code: scanWindow.code || 'invalid_block_window',
        message: scanWindow.message || 'Invalid session block window.',
      });
      return;
    }
    const baseFrom = Number(scanWindow.fromBlock || 0);
    const baseTo = Number(scanWindow.toBlock || 0);
    const requestedToBlockRaw = Number(scanWindow.requestedToBlock);
    const scanRequestedToBlock = Number.isFinite(requestedToBlockRaw)
      ? Math.max(baseTo, Math.floor(requestedToBlockRaw))
      : baseTo;
    const scanMaxBlockRange = Math.max(
      1,
      Number(scanWindow.maxBlockRange || QUESTION_SCAN_MAX_BLOCK_RANGE)
    );
    const didCapScanRange = scanWindow.wasCapped === true;
    if (didCapScanRange) {
      mainSiteLog.warn('[QuestionScan] Capped question scan range to safety max.', {
        slug: scopedSlug || 'general',
        fromBlock: baseFrom,
        requestedToBlock: scanRequestedToBlock,
        cappedToBlock: baseTo,
        maxBlockRange: scanMaxBlockRange,
      });
    }
    if (baseFrom > baseTo) {
      setQuestionState({ isQuestionCacheReady: true }, this.checkAllCachesReady);
      return;
    }
    const initialLastBlockQuestion = Math.max(0, baseFrom - 1);
    let questionsCache = this.DG.read("questionsCache", slug) || {};
    // Migration: merge legacy numeric key into string key once
    if (questionsCache && networkID) {
      this.mergeLegacyNumericNetworkKey(questionsCache, networkID);
    }

    // Create structure if missing
    if (!questionsCache[networkID]) {
      questionsCache[networkID] = {
        questionsLatestBlock: initialLastBlockQuestion,
        questionsDiscoveryCheckpointBlock: initialLastBlockQuestion,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},                 // Recency guard map
        pendingQuestionMetadata: {},               // Retry map for off-chain question metadata fetches
        questionResponsesLatestBlock: initialLastBlockQuestion,
        arweaveTxCache: {},
        arweaveTxFailureCache: {},
        questionHydrationMeta: {},
      };
    }
    if (typeof questionsCache[networkID].pendingQuestionMetadata !== 'object' || !questionsCache[networkID].pendingQuestionMetadata) {
      questionsCache[networkID].pendingQuestionMetadata = {};
    }
    ensureQuestionArweaveCacheBranches(questionsCache[networkID]);
    if (!Number.isFinite(Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock))) {
      questionsCache[networkID].questionsDiscoveryCheckpointBlock = Number(questionsCache[networkID].questionsLatestBlock) || initialLastBlockQuestion;
    }
    const rebucketedQuestionIds = new Set();

    // Merge helper to avoid stomping concurrent responses writes
    const mergeFreshIntoLocalCopy = () => {
      try {
        const fresh = this.DG.read("questionsCache", slug) || {};
        const freshNet = fresh[networkID];
        if (!freshNet) return;

        // Merge questionResponses + recency metadata (qId -> responder -> {bn/txi/li/ts})
        const localNet = questionsCache[networkID];
        ensureQuestionArweaveCacheBranches(localNet);
        if (!localNet.questionResponses || typeof localNet.questionResponses !== 'object') {
          localNet.questionResponses = {};
        }
        if (!localNet.questionResponsesMeta || typeof localNet.questionResponsesMeta !== 'object') {
          localNet.questionResponsesMeta = {};
        }
        const freshQR = (freshNet && typeof freshNet.questionResponses === 'object')
          ? freshNet.questionResponses
          : {};
        const freshQRMeta = (freshNet && typeof freshNet.questionResponsesMeta === 'object')
          ? freshNet.questionResponsesMeta
          : {};
        const toResponseRecencyPair = (value, responseValue = null) => {
          const src = (value && typeof value === 'object') ? value : {};
          const responseObj = (responseValue && typeof responseValue === 'object') ? responseValue : {};
          return {
            bn: Number(src.bn ?? src.blockNumber ?? responseObj.blockNumber ?? responseObj.bn ?? 0) || 0,
            txi: Number(
              src.txi ??
              src.transactionIndex ??
              src.txIndex ??
              responseObj.transactionIndex ??
              responseObj.txIndex ??
              0
            ) || 0,
            li: Number(src.li ?? src.logIndex ?? responseObj.logIndex ?? responseObj.li ?? 0) || 0,
            ts: Number(src.ts ?? src.timestamp ?? responseObj.timestamp ?? 0) || 0,
          };
        };
        const compareResponseRecency = (incomingRecency, existingRecency) => {
          if (incomingRecency.bn > existingRecency.bn) return 1;
          if (incomingRecency.bn < existingRecency.bn) return -1;
          if (incomingRecency.txi > existingRecency.txi) return 1;
          if (incomingRecency.txi < existingRecency.txi) return -1;
          if (incomingRecency.li > existingRecency.li) return 1;
          if (incomingRecency.li < existingRecency.li) return -1;
          if (incomingRecency.ts > existingRecency.ts) return 1;
          if (incomingRecency.ts < existingRecency.ts) return -1;
          return 0;
        };
        const shouldApplyIncomingResponse = ({ existingMeta, incomingMeta, hasExistingResponse }) => {
          if (!hasExistingResponse) return true;
          const existing = toResponseRecencyPair(existingMeta);
          const incoming = toResponseRecencyPair(incomingMeta);
          return compareResponseRecency(incoming, existing) >= 0;
        };
        const freshQuestionIds = new Set([
          ...Object.keys(freshQR || {}),
          ...Object.keys(freshQRMeta || {}),
        ]);
        freshQuestionIds.forEach((qIdRaw) => {
          const qId = String(qIdRaw || '').trim().toLowerCase();
          if (!qId) return;
          const freshResponsesByResponder = (
            (freshQR[qIdRaw] && typeof freshQR[qIdRaw] === 'object')
              ? freshQR[qIdRaw]
              : (freshQR[qId] && typeof freshQR[qId] === 'object')
                ? freshQR[qId]
                : {}
          );
          const freshMetaByResponder = (
            (freshQRMeta[qIdRaw] && typeof freshQRMeta[qIdRaw] === 'object')
              ? freshQRMeta[qIdRaw]
              : (freshQRMeta[qId] && typeof freshQRMeta[qId] === 'object')
                ? freshQRMeta[qId]
                : {}
          );
          if (!localNet.questionResponses[qId] || typeof localNet.questionResponses[qId] !== 'object') {
            localNet.questionResponses[qId] = {};
          }
          if (!localNet.questionResponsesMeta[qId] || typeof localNet.questionResponsesMeta[qId] !== 'object') {
            localNet.questionResponsesMeta[qId] = {};
          }
          const localResponsesByResponder = localNet.questionResponses[qId];
          const localMetaByResponder = localNet.questionResponsesMeta[qId];
          const responderSet = new Set([
            ...Object.keys(freshResponsesByResponder || {}),
            ...Object.keys(freshMetaByResponder || {}),
          ]);
          responderSet.forEach((responderRaw) => {
            const responder = String(responderRaw || '').trim().toLowerCase();
            if (!responder) return;

            const hasIncomingResponse = (
              Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responderRaw) ||
              Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responder)
            );
            const incomingResponse = hasIncomingResponse
              ? (
                Object.prototype.hasOwnProperty.call(freshResponsesByResponder, responderRaw)
                  ? freshResponsesByResponder[responderRaw]
                  : freshResponsesByResponder[responder]
              )
              : undefined;
            const incomingMeta = (
              freshMetaByResponder[responderRaw] ??
              freshMetaByResponder[responder] ??
              null
            );
            const hasExistingResponse = Object.prototype.hasOwnProperty.call(localResponsesByResponder, responder);
            if (!shouldApplyIncomingResponse({
              existingMeta: localMetaByResponder[responder],
              incomingMeta: toResponseRecencyPair(incomingMeta, incomingResponse),
              hasExistingResponse,
            })) {
              return;
            }
            if (hasIncomingResponse) {
              localResponsesByResponder[responder] = incomingResponse;
            }
            if (incomingMeta && typeof incomingMeta === 'object') {
              localMetaByResponder[responder] = toResponseRecencyPair(incomingMeta, incomingResponse);
            } else if (!Object.prototype.hasOwnProperty.call(localMetaByResponder, responder)) {
              localMetaByResponder[responder] = toResponseRecencyPair(null, incomingResponse);
            }
          });
        });

        // Watermark: take max
        const localWM = Number(localNet.questionResponsesLatestBlock) || 0;
        const freshWM = Number(freshNet.questionResponsesLatestBlock) || 0;
        localNet.questionResponsesLatestBlock = Math.max(localWM, freshWM);

        // Also merge any questions discovered by listeners meanwhile (do not overwrite ours)
        const freshQs = freshNet.questions || {};
        if (!localNet.questions) localNet.questions = {};
        Object.keys(freshQs).forEach((qid) => {
          const qidLower = String(qid || '').toLowerCase();
          if (qidLower && rebucketedQuestionIds.has(qidLower)) return;
          if (!localNet.questions[qid]) {
            localNet.questions[qid] = freshQs[qid];
          }
        });

        // Make sure questionsLatestBlock never goes backwards
        const localQBlk = Number(localNet.questionsLatestBlock) || 0;
        const freshQBlk = Number(freshNet.questionsLatestBlock) || 0;
        localNet.questionsLatestBlock = Math.max(localQBlk, freshQBlk);
        const localCheckpointBlk = Number(localNet.questionsDiscoveryCheckpointBlock) || 0;
        const freshCheckpointBlk = Number(freshNet.questionsDiscoveryCheckpointBlock) || 0;
        const mergedCheckpointBlk = Math.max(localCheckpointBlk, freshCheckpointBlk);
        if (mergedCheckpointBlk > 0) {
          localNet.questionsDiscoveryCheckpointBlock = mergedCheckpointBlk;
        } else if (Object.prototype.hasOwnProperty.call(localNet, 'questionsDiscoveryCheckpointBlock')) {
          delete localNet.questionsDiscoveryCheckpointBlock;
        }

        // Preserve immutable Arweave payload and failure caches across stale whole-object writes.
        mergeQuestionArweaveCacheBranches(localNet, freshNet);

        // Merge pending off-chain metadata retries (never resurrect entries for questions we already have)
        if (typeof localNet.pendingQuestionMetadata !== 'object' || !localNet.pendingQuestionMetadata) {
          localNet.pendingQuestionMetadata = {};
        }
        const localPending = localNet.pendingQuestionMetadata;
        const freshPending = (freshNet && typeof freshNet.pendingQuestionMetadata === 'object')
          ? freshNet.pendingQuestionMetadata
          : {};
        Object.keys(freshPending || {}).forEach((qidRaw) => {
          const qid = String(qidRaw || '').toLowerCase();
          if (!qid) return;

          // If the question already exists in cache, any pending entry is stale; do not merge it.
          if (localNet.questions && localNet.questions[qid]) {
            if (localPending[qid]) delete localPending[qid];
            return;
          }

          const a = localPending[qid];
          const b = freshPending[qidRaw];
          if (!b || typeof b !== 'object') return;
          if (!a || typeof a !== 'object') {
            localPending[qid] = { ...b };
            return;
          }
          localPending[qid] = {
            attempts: Math.max(Number(a.attempts || 0), Number(b.attempts || 0)),
            nextRetryAtMs: Math.max(Number(a.nextRetryAtMs || 0), Number(b.nextRetryAtMs || 0)),
          };
        });

        // Cleanup: if the question exists, it should never remain in the pending set.
        try {
          const stale = Object.keys(localPending || {}).filter((qidRaw) => {
            const qid = String(qidRaw || '').toLowerCase();
            return qid && localNet.questions && localNet.questions[qid];
          });
          stale.forEach((qidRaw) => {
            try { delete localPending[qidRaw]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
          });
        } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    };

    const QUESTION_CACHE_WRITE_MIN_INTERVAL_MS = 1000;
    const QUESTION_CACHE_WRITE_MAX_PENDING_OPS = 4;
    let lastQuestionCacheWriteMs = 0;
    let pendingQuestionCacheWriteOps = 0;
    let hasPendingQuestionCacheWrite = false;
    const flushQuestionCacheWrite = ({ force = false } = {}) => {
      const nowMs = Date.now();
      if (!shouldFlushCoalescedRun({
        force,
        dirty: hasPendingQuestionCacheWrite,
        nowMs,
        lastFlushMs: lastQuestionCacheWriteMs,
        minIntervalMs: QUESTION_CACHE_WRITE_MIN_INTERVAL_MS,
        pendingOps: pendingQuestionCacheWriteOps,
        maxPendingOps: QUESTION_CACHE_WRITE_MAX_PENDING_OPS,
      })) {
        return false;
      }
      mergeFreshIntoLocalCopy();
      this.DG.write("questionsCache", slug, questionsCache);
      hasPendingQuestionCacheWrite = false;
      pendingQuestionCacheWriteOps = 0;
      lastQuestionCacheWriteMs = nowMs;
      return true;
    };
    const queueQuestionCacheWrite = ({ force = false, opCount = 1 } = {}) => {
      hasPendingQuestionCacheWrite = true;
      pendingQuestionCacheWriteOps += Math.max(1, Number(opCount || 1));
      return flushQuestionCacheWrite({ force });
    };

    // Floor resume checkpoints to the group’s known start and keep watermarks monotonic.
    const floorBlock = initialLastBlockQuestion;
    let stableDiscoveryBlock = Number(questionsCache[networkID].questionsLatestBlock) || 0;
    if (stableDiscoveryBlock < floorBlock) stableDiscoveryBlock = floorBlock;
    questionsCache[networkID].questionsLatestBlock = stableDiscoveryBlock;

    let checkpointDiscoveryBlock = Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || 0;
    if (checkpointDiscoveryBlock < floorBlock) checkpointDiscoveryBlock = floorBlock;
    questionsCache[networkID].questionsDiscoveryCheckpointBlock = checkpointDiscoveryBlock;

    const resumeDiscoveryBlock = Math.max(stableDiscoveryBlock, checkpointDiscoveryBlock);

    // Off-chain metadata retry queue (prevents log rescans when Arweave fetch fails)
    const MAX_PENDING_QUESTION_METADATA_ATTEMPTS = 12;
    const MAX_PENDING_QUESTION_COOLDOWN_MS = 5 * 60 * 1000;
    const computeBackoffMs = (attempts) => {
      const n = Math.max(0, Math.min(6, Number(attempts || 0) - 1));
      return Math.min(60000, Math.round(1000 * Math.pow(2, n)));
    };
    const markPendingQuestion = (qidLower, { bumpAttempts = true, error = null } = {}) => {
      if (!qidLower) return;
      if (typeof questionsCache[networkID].pendingQuestionMetadata !== 'object' || !questionsCache[networkID].pendingQuestionMetadata) {
        questionsCache[networkID].pendingQuestionMetadata = {};
      }
      const slot = questionsCache[networkID].pendingQuestionMetadata;
      const prev = slot[qidLower] && typeof slot[qidLower] === 'object' ? slot[qidLower] : { attempts: 0, nextRetryAtMs: 0 };
      const attempts = bumpAttempts ? (Number(prev.attempts || 0) + 1) : Number(prev.attempts || 0);
      const stopDecision = shouldStopPendingMetadataRetry({
        pendingEntry: { ...prev, attempts },
        error,
        maxAttempts: MAX_PENDING_QUESTION_METADATA_ATTEMPTS,
      });
      const failureMeta = normalizeArweaveFailureMeta(error);
      const terminalRetryAtMs = Number(failureMeta.nextRetryAtMs || 0);
      if (stopDecision.stop) {
        if (
          stopDecision.terminal &&
          Number.isFinite(terminalRetryAtMs) &&
          terminalRetryAtMs > Date.now()
        ) {
          slot[qidLower] = {
            attempts,
            nextRetryAtMs: terminalRetryAtMs,
            state: failureMeta.state || 'terminal_not_found',
            lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
            message: String(failureMeta.message || ''),
          };
          return;
        }
        if (stopDecision.reachedMaxAttempts && !stopDecision.terminal) {
          const cooldownRetryAtMs = Date.now() + MAX_PENDING_QUESTION_COOLDOWN_MS;
          const externalNextRetryAt = Number(failureMeta.nextRetryAtMs || 0);
          slot[qidLower] = {
            attempts,
            nextRetryAtMs: Number.isFinite(externalNextRetryAt) && externalNextRetryAt > cooldownRetryAtMs
              ? externalNextRetryAt
              : cooldownRetryAtMs,
            state: failureMeta.state || 'transient',
            lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
            message: String(failureMeta.message || ''),
          };
          mainSiteLog.warn('[MainSite] Pending question metadata reached max attempts; applying cooldown', {
            group: slug,
            questionId: qidLower,
            attempts,
            nextRetryAtMs: slot[qidLower].nextRetryAtMs,
          });
          return;
        }
        try { delete slot[qidLower]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        mainSiteLog.warn('[MainSite] Stopping pending question metadata retry', {
          group: slug,
          questionId: qidLower,
          terminal: stopDecision.terminal,
          reachedMaxAttempts: stopDecision.reachedMaxAttempts,
          attempts,
          state: failureMeta.state || null,
          status: failureMeta.status,
        });
        return;
      }
      const externalNextRetryAt = Number(failureMeta.nextRetryAtMs || 0);
      const computedNextRetryAt = Date.now() + computeBackoffMs(attempts);
      slot[qidLower] = {
        attempts,
        nextRetryAtMs: Number.isFinite(externalNextRetryAt) && externalNextRetryAt > computedNextRetryAt
          ? externalNextRetryAt
          : computedNextRetryAt,
        state: failureMeta.state || 'transient',
        lastStatus: Number.isFinite(Number(failureMeta.status)) ? Number(failureMeta.status) : null,
        message: String(failureMeta.message || ''),
      };
    };
    const clearPendingQuestion = (qidLower) => {
      try {
        if (questionsCache?.[networkID]?.pendingQuestionMetadata?.[qidLower]) {
          delete questionsCache[networkID].pendingQuestionMetadata[qidLower];
        }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    };
	    const pruneLoadedPendingQuestionMetadata = () => {
	      try {
	        const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
	        if (!pending || typeof pending !== 'object') return 0;
	        const cachedQuestions = (
	          questionsCache?.[networkID]?.questions &&
	          typeof questionsCache[networkID].questions === 'object'
	        ) ? questionsCache[networkID].questions : {};
	        let removed = 0;
	        Object.keys(pending).forEach((qidRaw) => {
	          const qid = String(qidRaw || '').toLowerCase();
	          if (!qid || !cachedQuestions[qid]) return;
	          try {
	            delete pending[qidRaw];
	            removed += 1;
	          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
	        });
	        return removed;
	      } catch (_) {
	        return 0;
	      }
	    };
	    const retryPendingQuestionMetadata = async ({ maxToProcess = 15, batchSize = 5 } = {}) => {
	      try {
        let recoveredCount = 0;
        const removedStalePending = pruneLoadedPendingQuestionMetadata();
        if (removedStalePending > 0) {
          queueQuestionCacheWrite({ force: true });
        }
		        const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
		        if (!pending || typeof pending !== 'object') return 0;
        const now = Date.now();
        const due = Object.keys(pending)
          .map((qid) => ({ qid, entry: pending[qid] }))
          .filter((row) => (
            row &&
            row.qid &&
            !questionsCache?.[networkID]?.questions?.[String(row.qid || '').toLowerCase()] &&
            Number(row.entry?.nextRetryAtMs || 0) <= now
          ))
          .sort((a, b) => (Number(a.entry?.nextRetryAtMs || 0) - Number(b.entry?.nextRetryAtMs || 0)))
          .slice(0, Math.max(0, Number(maxToProcess || 0)));
        if (!due.length) return 0;

        mainSiteLog.log(`[MainSite] Retrying ${due.length} pending question metadata fetch(es) (group=${slug}).`);

        for (let i = 0; i < due.length; i += batchSize) {
          const batch = due.slice(i, i + batchSize);
          // eslint-disable-next-line no-await-in-loop
          const results = await Promise.all(batch.map(async ({ qid }) => {
            const lowered = String(qid || '').toLowerCase();
            if (!lowered) return { qid: lowered, questionData: null };
            if (questionsCache?.[networkID]?.questions?.[lowered]) {
              return {
                qid: lowered,
                questionData: questionsCache[networkID].questions[lowered],
                skippedCached: true,
              };
            }
            try {
              const questionData = await contractScripts.getQuestionData('none', lowered, slug, {
                decryptContext: this.buildQuestionDecryptContext(slug),
                skipDecrypt: true,
                throwOnFailure: true,
                arweaveRetries: QUESTION_METADATA_BULK_ARWEAVE_RETRIES,
                arweaveGatewayTimeoutMs: QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS,
              });
              return { qid: lowered, questionData };
            } catch (err) {
              return { qid: lowered, questionData: null, err };
            }
          }));

          for (const item of results) {
            const lowered = String(item.qid || '').toLowerCase();
            if (!lowered) continue;
            if (item.questionData) {
              item.questionData.id = lowered;
              const preparedQuestion = this.buildMetadataSessionCacheEnvelope(item.questionData, slug, {
                scoped: true,
              });
              const preparedQuestionData = {
                ...item.questionData,
                ...preparedQuestion.metadata,
              };
              if (preparedQuestion.targetSlug === slug) {
                questionsCache[networkID].questions[lowered] = preparedQuestionData;
              } else {
                rebucketedQuestionIds.add(lowered);
                try { delete questionsCache[networkID].questions[lowered]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
                this.writeQuestionMetadataToCache(
                  preparedQuestion.targetSlug,
                  lowered,
                  preparedQuestionData,
                  networkID,
                  { enforceScopedIsolation: true }
                );
              }
              clearPendingQuestion(lowered);
              if (!item.skippedCached) recoveredCount += 1;
            } else {
              markPendingQuestion(lowered, { error: item.err });
            }
          }

          // Persist in coalesced chunks without wiping concurrent response writes.
          queueQuestionCacheWrite();
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        flushQuestionCacheWrite({ force: true });
        return recoveredCount;
      } catch (_) {
        return 0;
	      }
	    };

	    // If we discovered question IDs but couldn't fetch their off-chain metadata (often due to
	    // RPC rate limits), keep the cache "not ready" and retry using the pending backoff queue.
	    const schedulePendingQuestionMetadataRetry = () => {
	      try {
	        const pending = questionsCache?.[networkID]?.pendingQuestionMetadata;
	        if (!pending || typeof pending !== 'object') return;

	        const entries = Object.values(pending).filter((v) => v && typeof v === 'object');
	        if (!entries.length) return;

	        let nextAtMs = Infinity;
	        entries.forEach((entry) => {
	          const at = Number(entry.nextRetryAtMs || 0);
	          if (at > 0 && at < nextAtMs) nextAtMs = at;
	        });
	        if (!Number.isFinite(nextAtMs)) nextAtMs = Date.now() + 1500;
	        const delayMs = Math.max(500, nextAtMs - Date.now());

	        this._pendingQuestionMetadataRetryTimers = this._pendingQuestionMetadataRetryTimers || {};
	        if (this._pendingQuestionMetadataRetryTimers[slug]) {
	          clearTimeout(this._pendingQuestionMetadataRetryTimers[slug]);
	        }
		        this._pendingQuestionMetadataRetryTimers[slug] = setTimeout(() => {
		          try {
		            if (this._pendingQuestionMetadataRetryTimers) {
		              delete this._pendingQuestionMetadataRetryTimers[slug];
		            }
		            if (!this._mounted) return;
		            // Avoid background churn if the user navigated away, except for explicit
		            // general-scope backfill retries (slug === '').
		            if (typeof this.getActiveSessionSlug === 'function') {
		              const activeSlug = normalizeSessionSlug(this.getActiveSessionSlug() || '');
		              const allowGeneralBackfillRetry = slug === '' && this.getSessionScanScope() === 'general';
		              if (!allowGeneralBackfillRetry && activeSlug !== slug) return;
		            }
		            this.initializeQuestionCacheForGroup(slug, {
		              background: suppressUiState,
		              skipDiscoveryScan: true,
		            });
		          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
		        }, delayMs);
	      } catch (e) { mainSiteLog.warn('MainSite: cleanup', e); }
	    };

    const fromBlockForDiscovery = skipDiscoveryScan ? (baseTo + 1) : (resumeDiscoveryBlock + 1);
    const latestBlock = (!skipDiscoveryScan && didCapScanRange)
      ? Math.max(
        floorBlock,
        Math.min(
          scanRequestedToBlock,
          fromBlockForDiscovery + scanMaxBlockRange - 1
        )
      )
      : baseTo;
    const shouldContinueCappedDiscoveryScan = (
      !skipDiscoveryScan &&
      didCapScanRange &&
      scanRequestedToBlock > latestBlock
    );
    const queueCappedDiscoveryRerun = () => {
      if (!shouldContinueCappedDiscoveryScan) return false;
      this._questionInitPending[initRunKey] = mergePendingQuestionInitOpts(
        this._questionInitPending[initRunKey],
        {
          ...rerunOpts,
          background: suppressUiState,
          skipDiscoveryScan: false,
        }
      );
      return true;
    };
    const totalScanBlocks = fromBlockForDiscovery <= latestBlock
      ? Math.max(0, latestBlock - fromBlockForDiscovery + 1)
      : 0;
    const requestedTotalScanBlocks = Math.max(
      totalScanBlocks,
      Number(scanWindow.requestedRangeBlocks || totalScanBlocks || 0)
    );
    const buildQuestionScanProgressCounts = (batchScannedIn = 0) => {
      const batchScanned = Math.max(0, Math.min(totalScanBlocks, Number(batchScannedIn || 0)));
      if (!didCapScanRange) {
        return {
          scannedBlocks: batchScanned,
          remainingBlocks: Math.max(0, totalScanBlocks - batchScanned),
        };
      }
      // Preserve overall discovery progress across capped reruns so the UI
      // doesn't appear stuck at the current 50k safety window.
      const completedBeforeCurrentWindow = Math.max(0, fromBlockForDiscovery - baseFrom);
      const scannedBlocks = Math.max(
        0,
        Math.min(requestedTotalScanBlocks, completedBeforeCurrentWindow + batchScanned)
      );
      return {
        scannedBlocks,
        remainingBlocks: Math.max(0, requestedTotalScanBlocks - scannedBlocks),
      };
    };
    const QUESTION_PROGRESS_MIN_INTERVAL_MS = 250;
    let lastQuestionProgressCommitMs = 0;
    let pendingQuestionProgressPatch = null;
    let pendingQuestionReadySignal = false;
    const clearQueuedQuestionProgress = () => {
      pendingQuestionProgressPatch = null;
      pendingQuestionReadySignal = false;
    };
    const flushQueuedQuestionProgress = ({ force = false } = {}) => {
      if (!pendingQuestionProgressPatch && !pendingQuestionReadySignal) return false;
      const nowMs = Date.now();
      if (!shouldCommitThrottledProgress({
        force,
        nowMs,
        lastCommitMs: lastQuestionProgressCommitMs,
        minIntervalMs: QUESTION_PROGRESS_MIN_INTERVAL_MS,
      })) {
        return false;
      }
      const patch = pendingQuestionProgressPatch;
      const shouldMarkReady = pendingQuestionReadySignal;
      clearQueuedQuestionProgress();
      lastQuestionProgressCommitMs = nowMs;
      setQuestionState((prev) => {
        const next = {};
        if (shouldMarkReady && !prev.isQuestionCacheReady) {
          next.isQuestionCacheReady = true;
        }
        if (patch && typeof patch === 'object') {
          next.questionScanProgress = {
            ...(prev.questionScanProgress || {}),
            ...patch,
          };
        }
        return Object.keys(next).length ? next : null;
      });
      return true;
    };
    const queueQuestionProgressPatch = (patch, { force = false, markReady = false } = {}) => {
      if (patch && typeof patch === 'object') {
        pendingQuestionProgressPatch = {
          ...(pendingQuestionProgressPatch || {}),
          ...patch,
        };
      }
      if (markReady) pendingQuestionReadySignal = true;
      flushQueuedQuestionProgress({ force });
    };
    const DISCOVERY_CHECKPOINT_WRITE_MIN_INTERVAL_MS = 1200;
    const DISCOVERY_CHECKPOINT_WRITE_MIN_BLOCK_DELTA = 512;
    let lastDiscoveryCheckpointWriteMs = 0;
    let lastPersistedDiscoveryCheckpoint = Number(questionsCache?.[networkID]?.questionsDiscoveryCheckpointBlock) || 0;
    if (lastPersistedDiscoveryCheckpoint < stableDiscoveryBlock) {
      lastPersistedDiscoveryCheckpoint = stableDiscoveryBlock;
    }
    let contiguousDiscoveryFrontier = resumeDiscoveryBlock;
    const pendingDiscoveryRanges = [];

    const normalizeDiscoveryRange = (fromIn, toIn) => {
      const fromNum = Number(fromIn);
      const toNum = Number(toIn);
      if (!Number.isFinite(fromNum) || !Number.isFinite(toNum)) return null;
      const from = Math.max(fromBlockForDiscovery, Math.floor(Math.min(fromNum, toNum)));
      const to = Math.min(latestBlock, Math.floor(Math.max(fromNum, toNum)));
      if (from > to) return null;
      return [from, to];
    };

    const enqueueCompletedDiscoveryRange = (fromIn, toIn) => {
      const normalized = normalizeDiscoveryRange(fromIn, toIn);
      if (!normalized) return;
      pendingDiscoveryRanges.push(normalized);
      pendingDiscoveryRanges.sort((a, b) => a[0] - b[0]);
      const merged = [];
      pendingDiscoveryRanges.forEach((range) => {
        if (!merged.length) {
          merged.push([...range]);
          return;
        }
        const last = merged[merged.length - 1];
        if (range[0] <= last[1] + 1) {
          last[1] = Math.max(last[1], range[1]);
          return;
        }
        merged.push([...range]);
      });
      pendingDiscoveryRanges.length = 0;
      merged.forEach((range) => pendingDiscoveryRanges.push(range));
    };

    const advanceContiguousDiscoveryFrontier = () => {
      while (pendingDiscoveryRanges.length && pendingDiscoveryRanges[0][0] <= contiguousDiscoveryFrontier + 1) {
        const [, end] = pendingDiscoveryRanges.shift();
        contiguousDiscoveryFrontier = Math.max(contiguousDiscoveryFrontier, end);
      }
      return contiguousDiscoveryFrontier;
    };

    const markDiscoveryRangeComplete = (fromIn, toIn) => {
      enqueueCompletedDiscoveryRange(fromIn, toIn);
      return advanceContiguousDiscoveryFrontier();
    };

    const persistDiscoveryCheckpoint = (blockIn, { force = false } = {}) => {
      const blockNum = Number(blockIn);
      if (!Number.isFinite(blockNum)) return false;
      const nextCheckpoint = Math.max(floorBlock, Math.min(latestBlock, Math.floor(blockNum)));
      if (nextCheckpoint <= lastPersistedDiscoveryCheckpoint) return false;
      const now = Date.now();
      if (
        !force &&
        (now - lastDiscoveryCheckpointWriteMs) < DISCOVERY_CHECKPOINT_WRITE_MIN_INTERVAL_MS &&
        (nextCheckpoint - lastPersistedDiscoveryCheckpoint) < DISCOVERY_CHECKPOINT_WRITE_MIN_BLOCK_DELTA
      ) {
        return false;
      }

      questionsCache[networkID].questionsDiscoveryCheckpointBlock = Math.max(
        Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || floorBlock,
        nextCheckpoint
      );
      queueQuestionCacheWrite({ force: true, opCount: 0 });

      lastPersistedDiscoveryCheckpoint = Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || nextCheckpoint;
      lastDiscoveryCheckpointWriteMs = now;
      return true;
    };

    const finalizeDiscoveryWatermark = (finalBlockIn) => {
      const finalBlockNum = Number(finalBlockIn);
      const finalBlock = Number.isFinite(finalBlockNum)
        ? Math.max(floorBlock, Math.min(latestBlock, Math.floor(finalBlockNum)))
        : floorBlock;

      const checkpointBlock = Number(questionsCache[networkID].questionsDiscoveryCheckpointBlock) || floorBlock;
      questionsCache[networkID].questionsLatestBlock = Math.max(
        Number(questionsCache[networkID].questionsLatestBlock) || floorBlock,
        checkpointBlock,
        finalBlock
      );
      try { delete questionsCache[networkID].questionsDiscoveryCheckpointBlock; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      queueQuestionCacheWrite({ force: true, opCount: 0 });

      lastPersistedDiscoveryCheckpoint = Number(questionsCache[networkID].questionsLatestBlock) || finalBlock;
      lastDiscoveryCheckpointWriteMs = Date.now();
    };

    if (!suppressUiState && totalScanBlocks > 0) {
      const progressCounts = buildQuestionScanProgressCounts(0);
      queueQuestionProgressPatch({
        slug,
        phase: 'scan',
        fromBlock: fromBlockForDiscovery,
        toBlock: latestBlock,
        totalBlocks: totalScanBlocks,
        requestedTotalBlocks: requestedTotalScanBlocks,
        wasCapped: didCapScanRange,
        scannedBlocks: progressCounts.scannedBlocks,
        remainingBlocks: progressCounts.remainingBlocks,
        discoveredQuestions: 0,
        hydratedQuestions: 0,
        startedAtMs: Date.now(),
      }, { force: true });
    }
    if (fromBlockForDiscovery > latestBlock) {
      if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
        mainSiteLog.log(
          `[MainSite] Question cache up-to-date: fromBlock(${fromBlockForDiscovery}) > latestBlock(${latestBlock}). Skipping scan.`
        );
      }
			      // Even when logs are up-to-date, retry any pending off-chain metadata fetches.
			      const recoveredPendingCount = await retryPendingQuestionMetadata().catch(() => 0);
			      // Retry-only mode must not advance discovery watermark without a real log scan.
			      if (!skipDiscoveryScan) finalizeDiscoveryWatermark(latestBlock);
			      const cachedCount = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
			      const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
			      const ready = cachedCount > 0 || pendingCount === 0;
            flushQuestionCacheWrite({ force: true });
            clearQueuedQuestionProgress();
			      setQuestionState((prev) => buildQuestionReadyStatePatch({
              prevState: prev,
              ready,
              incrementNonce: recoveredPendingCount > 0,
            }));
			      if (pendingCount > 0) schedulePendingQuestionMetadataRetry();
			      return;
			    }

    // Proactive user cache population
    let userCache = this.DG.read('userCache', slug) || {};
    let userCacheModified = false;

    const ensureUserNode = (addr, block) => {
      const lower = addr.toLowerCase();
      if (!userCache[lower]) userCache[lower] = {};
      if (!userCache[lower][networkID]) {
        userCache[lower][networkID] = {
          lastBlockScanned: block,
          lastScanTimestamp: Math.floor(Date.now() / 1000),
          data: { sbts: [], createdSurveys: [], createdQuestions: [], surveyResponses: [], questionResponses: [] }
        };
      }
      if (block > userCache[lower][networkID].lastBlockScanned) {
        userCache[lower][networkID].lastBlockScanned = block;
        userCache[lower][networkID].lastScanTimestamp = Math.floor(Date.now() / 1000);
      }
      return userCache[lower][networkID].data;
    };

    /********************************************
    * 1. Fetch new question IDs via chunked scan (group-aware)
    ********************************************/
    mainSiteLog.log(
      `initializeQuestionCacheForGroup: scanning for new question IDs from block ${fromBlockForDiscovery} to ${latestBlock} (group=${slug})...`
    );
    let allDiscoveredQIDs;
    try {
      allDiscoveredQIDs = await contractScripts.getAllQuestionIDsChunkedWithCallback(
        'none', // ensure read-only provider path
        fromBlockForDiscovery,
        latestBlock,
        (progressInfo) => {
          const totalBlocks = Math.max(1, Number(progressInfo?.totalRangeBlocks || totalScanBlocks || 1));
          const batchScannedBlocks = Math.max(0, Number(progressInfo?.doneSoFarBlocks || 0));
          const progressCounts = buildQuestionScanProgressCounts(batchScannedBlocks);
          const chunkFrom = Number(progressInfo?.chunkFrom);
          const chunkTo = Number(progressInfo?.chunkTo);
          if (Number.isFinite(chunkFrom) && Number.isFinite(chunkTo)) {
            const contiguousCheckpoint = markDiscoveryRangeComplete(chunkFrom, chunkTo);
            persistDiscoveryCheckpoint(contiguousCheckpoint);
          }
          queueQuestionProgressPatch({
            slug,
            phase: 'scan',
            fromBlock: fromBlockForDiscovery,
            toBlock: latestBlock,
            totalBlocks,
            requestedTotalBlocks: requestedTotalScanBlocks,
            wasCapped: didCapScanRange,
            scannedBlocks: progressCounts.scannedBlocks,
            remainingBlocks: progressCounts.remainingBlocks,
          });
          // onChunkProgress callback
          if (window.ENABLE_RPC_DEBUG_LOGGING === true) {
            mainSiteLog.debug(
              `Question ID chunk: [${progressInfo.chunkFrom}..${progressInfo.chunkTo}] => ${progressInfo.chunkEventCount} events.`
            );
          }
        },
        (partialQIDs, chunkToBlock) => {
          // onPartialData callback
          // optional: could save intermediate progress here if desired
        },
        slug,
        {
          rpcDebugContext: {
            fnTag: 'initialize-question-cache',
            scopeTag: 'question-discovery',
          },
        }
      );
    } catch (chunkErr) {
      mainSiteLog.error("Error fetching chunked question IDs:", chunkErr);
      persistDiscoveryCheckpoint(contiguousDiscoveryFrontier, { force: true });
      const cachedCount = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
      // If we have cached data, allow UI to proceed with it; otherwise keep the "ready" gate closed.
      flushQuestionCacheWrite({ force: true });
      clearQueuedQuestionProgress();
      setQuestionState({ isQuestionCacheReady: cachedCount > 0, questionCacheInitializationError: true });
      return;
    }

    // Advance discovery watermark immediately once logs scan succeeds (even if Arweave metadata fetch fails).
    // This prevents repeated eth_getLogs rescans due to transient off-chain errors.
    finalizeDiscoveryWatermark(latestBlock);

    // We might get duplicates if question IDs were repeated in multiple events
    // so we’ll unify them here. Also ensure all are lowercased:
    let newQIDsSet = new Set();
    (allDiscoveredQIDs || []).forEach((q) => {
      if (q) newQIDsSet.add(q.toLowerCase());
    });
    const newQIDsForDiscovery = Array.from(newQIDsSet);
    const cachedQuestionRefreshIds = (
      slug
        ? Object.values(questionsCache?.[networkID]?.questions || {})
          .map((question) => String(question?.id || '').toLowerCase())
          .filter((qid) => (
            !!qid &&
            !Object.prototype.hasOwnProperty.call(
              questionsCache?.[networkID]?.questions?.[qid] || {},
              'sessionSlugExplicit'
            )
          ))
        : []
    );
    const hydrateTargetQIDs = Array.from(new Set([
      ...newQIDsForDiscovery,
      ...cachedQuestionRefreshIds,
    ]));

    if (newQIDsForDiscovery.length > 0) {
      mainSiteLog.log(
        `initializeQuestionCacheForGroup: discovered ${newQIDsForDiscovery.length} unique question IDs total.`
      );
    }
    queueQuestionProgressPatch({
      slug,
      phase: 'hydrate',
      discoveredQuestions: hydrateTargetQIDs.length,
      hydratedQuestions: 0,
      failedQuestions: 0,
      pendingMetadataCount: Object.keys(
        questionsCache?.[networkID]?.pendingQuestionMetadata || {}
      ).length,
      requestedTotalBlocks: requestedTotalScanBlocks,
      wasCapped: didCapScanRange,
      ...buildQuestionScanProgressCounts(totalScanBlocks),
    }, { force: true });

	    /**********************************************************************
	    * 2) Filter out those we already have in the cache. We only load new ones
	    **********************************************************************/
		    const existingQIDs = Object.keys(questionsCache[networkID].questions).map((id) => id.toLowerCase());
		    let finalNewQIDs = newQIDsForDiscovery.filter((id) => !existingQIDs.includes(id));
      finalNewQIDs = Array.from(new Set([
        ...finalNewQIDs,
        ...cachedQuestionRefreshIds,
      ]));
      const totalCachedQuestionsBeforeHydration = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
      const pendingQuestionMetadataCountBeforeHydration = Object.keys(
        questionsCache?.[networkID]?.pendingQuestionMetadata || {}
      ).length;
      // Regression guard: only raise this terminal error after the final capped window.
      // Interim empty windows must fall through so queued reruns keep scanning later blocks.
      const shouldRaiseRangeLimitError = (
        didCapScanRange &&
        scanRequestedToBlock === latestBlock &&
        totalCachedQuestionsBeforeHydration === 0 &&
        finalNewQIDs.length === 0 &&
        pendingQuestionMetadataCountBeforeHydration === 0
      );
      if (shouldRaiseRangeLimitError) {
        clearQueuedQuestionProgress();
        setQuestionState((prev) => ({
          isQuestionCacheReady: true,
          questionScanProgress: {
            ...(prev?.questionScanProgress || {}),
            slug: scopedSlug,
            phase: 'error',
            errorCode: 'scan_range_exceeded',
            errorMessage: `Scanned ${requestedTotalScanBlocks.toLocaleString()} blocks from session start without finding questions. Loading continued in ${QUESTION_SCAN_MAX_BLOCK_RANGE.toLocaleString()}-block safety windows.`,
            finishedAtMs: Date.now(),
            totalBlocks: totalScanBlocks,
            requestedTotalBlocks: requestedTotalScanBlocks,
            wasCapped: didCapScanRange,
            ...buildQuestionScanProgressCounts(totalScanBlocks),
            discoveredQuestions: 0,
            hydratedQuestions: 0,
          },
        }));
        maybeCheckAllCachesReady();
        return;
      }
			    if (finalNewQIDs.length === 0) {
				      // No brand-new question IDs, just mark the block updated
				      const recoveredPendingCount = await retryPendingQuestionMetadata().catch(() => 0);
              queueCappedDiscoveryRerun();
				      mergeFreshIntoLocalCopy(); // <-- prevent wiping concurrent responses
				      questionsCache[networkID].questionsLatestBlock = latestBlock;
				      queueQuestionCacheWrite({ force: true });
				      mainSiteLog.log("No new question IDs to fetch. question cache up-to-date.");
			      const cachedCount = Object.keys(questionsCache?.[networkID]?.questions || {}).length;
			      const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
			      const ready = cachedCount > 0 || pendingCount === 0;
            clearQueuedQuestionProgress();
			      setQuestionState((prev) => buildQuestionReadyStatePatch({
              prevState: prev,
              ready,
              incrementNonce: recoveredPendingCount > 0,
            }));
			      if (pendingCount > 0) schedulePendingQuestionMetadataRetry();
			      return;
			    }
	    mainSiteLog.log(`We have ${finalNewQIDs.length} question IDs that are brand-new to the cache.`);

    /*******************************************
	    * 3) For each new question ID, fetch the data
	    *******************************************/
	    const BATCH_SIZE = 10;
    let hydratedSuccessCount = 0;
    let hasHydrationDataNonceSignal = false;
	    const getPendingMetadataCount = () => (
      Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length
    );
	    const updateHydrationProgress = ({ hydratedCount = 0, failedCount = 0 } = {}) => {
      const hasAnyQuestions = Object.keys(questionsCache?.[networkID]?.questions || {}).length > 0;
      queueQuestionProgressPatch({
        slug,
        phase: 'hydrate',
        discoveredQuestions: finalNewQIDs.length,
        hydratedQuestions: Math.min(finalNewQIDs.length, Math.max(0, Number(hydratedCount || 0))),
        failedQuestions: Math.max(0, Number(failedCount || 0)),
        pendingMetadataCount: getPendingMetadataCount(),
        requestedTotalBlocks: requestedTotalScanBlocks,
        wasCapped: didCapScanRange,
        ...buildQuestionScanProgressCounts(totalScanBlocks),
      }, { markReady: hasAnyQuestions });
      if (hasAnyQuestions && !hasHydrationDataNonceSignal) {
        hasHydrationDataNonceSignal = true;
        setQuestionState((prev) => ({
          isQuestionCacheReady: true,
          questionResponsesNonce: Number(prev.questionResponsesNonce || 0) + 1,
        }));
      }
	    };
	    let failedFetchCount = 0;
    for (let i = 0; i < finalNewQIDs.length; i += BATCH_SIZE) {
      const batch = finalNewQIDs.slice(i, i + BATCH_SIZE);

      // Parallel fetch each question's data from Arweave (group-aware)
      // eslint-disable-next-line no-loop-func
      const results = await Promise.all(
        batch.map(async (qId) => {
          try {
            const questionData = await contractScripts.getQuestionData('none', qId, slug, {
              decryptContext: this.buildQuestionDecryptContext(slug),
              // Decrypting every encrypted prompt/options/tags during bulk cache hydration is very expensive.
              // We decrypt lazily in small batches via refreshEncryptedQuestionPayloadsForGroup().
              skipDecrypt: true,
              throwOnFailure: true,
              arweaveRetries: QUESTION_METADATA_BULK_ARWEAVE_RETRIES,
              arweaveGatewayTimeoutMs: QUESTION_METADATA_BULK_ARWEAVE_TIMEOUT_MS,
            });
            return { qId, questionData };
          } catch (err) {
            mainSiteLog.warn(`Error fetching question data for ID ${qId}:`, err);
            return { qId, questionData: null, err };
          }
        })
      );

      // Store successfully fetched question data in questionsCache
      for (const item of results) {
        const lowered = String(item.qId || '').toLowerCase();
        if (item.questionData) {
          // Force ID to lowerCase. Also do item.questionData.id = qId
          item.questionData.id = lowered;
          const preparedQuestion = this.buildMetadataSessionCacheEnvelope(item.questionData, slug, {
            scoped: true,
          });
          const preparedQuestionData = {
            ...item.questionData,
            ...preparedQuestion.metadata,
          };
          const targetSlug = preparedQuestion.targetSlug;
          if (targetSlug === slug) {
            // Insert into our local structure
            questionsCache[networkID].questions[lowered] = preparedQuestionData;
          } else {
            rebucketedQuestionIds.add(lowered);
            try { delete questionsCache[networkID].questions[lowered]; } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
            this.writeQuestionMetadataToCache(targetSlug, lowered, preparedQuestionData, networkID, {
              enforceScopedIsolation: true,
            });
          }
          clearPendingQuestion(lowered);
          hydratedSuccessCount += 1;

          // Update user cache (creator)
          if (targetSlug === slug && preparedQuestionData.creator) {
            const uData = ensureUserNode(preparedQuestionData.creator, latestBlock);
            if (!uData.createdQuestions) uData.createdQuestions = [];
            if (!uData.createdQuestions.some((q) => q.id === lowered)) {
              uData.createdQuestions.push({ id: lowered, data: preparedQuestionData });
              userCacheModified = true;
            }
          }
        } else {
          failedFetchCount++;
          markPendingQuestion(lowered, { error: item.err });
        }
      }

	      // Save partial progress to localStorage after each batch (merge to keep responses)
      queueQuestionCacheWrite();
	      updateHydrationProgress({
          hydratedCount: hydratedSuccessCount,
          failedCount: failedFetchCount,
        });
	      // small sleep to avoid rate-limits
	      await new Promise((resolve) => setTimeout(resolve, 200));
	    }

	    // 4) Mark the main "questionsLatestBlock" as fully updated (merge first)
	    mergeFreshIntoLocalCopy();
	    if (failedFetchCount > 0) {
      mainSiteLog.warn(
        `initializeQuestionCacheForGroup: ${failedFetchCount}/${finalNewQIDs.length} question metadata fetches failed. ` +
        `Queued pending metadata retries; discovery watermark stays advanced.`
      );
    }
	    questionsCache[networkID].questionsLatestBlock = Math.max(
	      Number(questionsCache[networkID].questionsLatestBlock) || 0,
	      latestBlock
	    );
    // Persist the final hydrated question batch before publishing the terminal
    // hydrate-progress snapshot. Embedded survey views reload off the cache when
    // they observe hydratedQuestions advance, so the cache must already reflect
    // that final count or cold loads can freeze on the first 10-question batch.
    queueQuestionCacheWrite({ force: true });
    flushQueuedQuestionProgress({ force: true });

	    // Write user cache
	    if (userCacheModified) {
	      this.DG.write("userCache", slug, userCache);
    }

    const totalCachedQuestions = Object.keys(questionsCache[networkID].questions).length;
    mainSiteLog.log(
      `initializeQuestionCacheForGroup: completed. We now have ${
        totalCachedQuestions
      } total questions in local cache for network ${networkID}, up to block ${latestBlock}.`
    );
		    if (totalCachedQuestions === 0 && fromBlockForDiscovery <= latestBlock) {
		      mainSiteLog.warn(
		        `initializeQuestionCacheForGroup: cache is EMPTY after scanning valid block range ` +
		        `[${fromBlockForDiscovery}..${latestBlock}] for group '${slug}'. ` +
		        `This may indicate a contract/config issue or all fetches failed.`
		      );
		    }
				    // If we have pending metadata but still no cached questions, keep the UI in a loading state
					    // and retry using the pending backoff schedule.
					    const pendingCount = Object.keys(questionsCache?.[networkID]?.pendingQuestionMetadata || {}).length;
            queueCappedDiscoveryRerun();
				    const ready = totalCachedQuestions > 0 || pendingCount === 0;
          clearQueuedQuestionProgress();
				    setQuestionState((prev) => ({
            isQuestionCacheReady: ready,
            questionResponsesNonce: hydratedSuccessCount > 0 && !hasHydrationDataNonceSignal
              ? (Number(prev.questionResponsesNonce || 0) + 1)
              : Number(prev.questionResponsesNonce || 0),
          }));
			    if (pendingCount > 0) schedulePendingQuestionMetadataRetry();
			    // Also re-check the “all caches ready” in case we were the last piece
			    maybeCheckAllCachesReady();
		  })();

    this._questionInitInFlight[initRunKey] = run;
    try {
      return await run;
    } finally {
      delete this._questionInitInFlight[initRunKey];
      const hasPendingRerun = !!this._questionInitPending[initRunKey];
      if (this._mounted && !hasPendingRerun) {
        setQuestionState((prev) => (
          shouldClearQuestionProgressInFinalize({
            hasPendingRerun,
            isQuestionCacheReady: !!prev?.isQuestionCacheReady,
            questionScanProgress: prev?.questionScanProgress || null,
          })
            ? { questionScanProgress: null }
            : null
        ));
      }
      if (hasPendingRerun) {
        const pendingOpts = this._questionInitPending[initRunKey];
        delete this._questionInitPending[initRunKey];
        setTimeout(() => {
          try {
            if (!this._mounted) return;
            this.initializeQuestionCacheForGroup(slug, pendingOpts || rerunOpts);
          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        }, 0);
      }
    }
	  }

  fetchQuestionResponsesChunked = async () => {
    return this.fetchQuestionResponsesChunkedWithGeneralBackfill(this.getActiveSessionSlug());
  };

  fetchQuestionResponsesChunkedWithGeneralBackfill = async (slugIn) => {
    return this.runWithGeneralSessionBackfill({
      slugIn,
      operation: 'fetchQuestionResponsesChunked',
      runPrimary: (slug) => this.fetchQuestionResponsesChunkedForGroup(slug, { background: false }),
      runGeneral: (slug) => this.fetchQuestionResponsesChunkedForGroup(slug, { background: true }),
    });
  };

  async fetchQuestionResponsesChunkedForGroup(slugIn, opts = {}) {
    const slug = normalizeSessionSlug(slugIn || '');
    const suppressUiState = !!(opts && opts.background === true);
    const forceArweaveFetch = !!(opts && opts.forceArweaveFetch === true);
    const notifyOnCompletion = !!(opts && opts.notifyOnCompletion === true);
    const initRunKey = slug;
    const rerunOpts = {
      ...(opts && typeof opts === 'object' ? opts : {}),
      background: suppressUiState,
      forceArweaveFetch,
      notifyOnCompletion,
    };
    const mergePendingResponseInitOpts = (prevOpts, nextOpts) => {
      const nextBackground = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.background === true);
      const nextForceArweaveFetch = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.forceArweaveFetch === true);
      const nextNotifyOnCompletion = !!(nextOpts && typeof nextOpts === 'object' && nextOpts.notifyOnCompletion === true);
      if (!prevOpts || typeof prevOpts !== 'object') {
        return {
          background: nextBackground,
          forceArweaveFetch: nextForceArweaveFetch,
          notifyOnCompletion: nextNotifyOnCompletion,
        };
      }
      const prevBackground = !!(prevOpts.background === true);
      const prevForceArweaveFetch = !!(prevOpts.forceArweaveFetch === true);
      const prevNotifyOnCompletion = !!(prevOpts.notifyOnCompletion === true);
      return {
        background: prevBackground && nextBackground,
        forceArweaveFetch: prevForceArweaveFetch || nextForceArweaveFetch,
        notifyOnCompletion: prevNotifyOnCompletion || nextNotifyOnCompletion,
      };
    };
    const setResponseState = (nextState, cb) => {
      if (suppressUiState || !this._mounted) return;
      this.setState(nextState, cb);
    };
    const notifyBackgroundCompletion = () => {
      if (!suppressUiState || !notifyOnCompletion) return;
      this.queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
    };
    const maybeCheckAllCachesReady = () => {
      if (suppressUiState) return;
      this.checkAllCachesReady();
    };
    if (this.scanScopeNoop(slug, 'fetchQuestionResponsesChunkedForGroup', () => {
      setResponseState((prev) => ({
        isResponsesCacheReady: true,
        questionResponsesNonce: prev.questionResponsesNonce + 1
      }), this.checkAllCachesReady);
      notifyBackgroundCompletion();
    })) {
      return;
    }
    this._responseInitInFlight = this._responseInitInFlight || {};
    this._responseInitPending = this._responseInitPending || {};
    if (this._responseInitInFlight[initRunKey]) {
      this._responseInitPending[initRunKey] = mergePendingResponseInitOpts(this._responseInitPending[initRunKey], rerunOpts);
      return this._responseInitInFlight[initRunKey];
    }

    const run = (async () => {
    mainSiteLog.log("fetchQuestionResponsesChunkedForGroup() - invoked for new question responses", { slug });
    setResponseState({ isResponsesCacheReady: false });

    const chainId = this.getSessionChainId(slug);
    if (!chainId) {
      mainSiteLog.warn("No group chainId for fetchQuestionResponsesChunkedForGroup; aborting.");
      setResponseState((prev) => ({ isResponsesCacheReady: true, questionResponsesNonce: prev.questionResponsesNonce + 1 }), this.checkAllCachesReady);
      notifyBackgroundCompletion();
      return;
    }

    const networkID = String(this.getSessionChainId(slug) || '');
    const { fromBlock: baseFrom, toBlock: baseTo } = await contractScripts.getRelevantBlockWindowForFilter(slug);
    if (baseFrom > baseTo) {
      setResponseState((prev) => ({
        isResponsesCacheReady: true,
        questionResponsesNonce: prev.questionResponsesNonce + 1
      }), this.checkAllCachesReady);
      notifyBackgroundCompletion();
      return;
    }
    const initialLastBlockQR = Math.max(0, baseFrom - 1);

    let questionsCache = this.DG.read("questionsCache", slug) || {};
    // Migration: numeric -> string key
    if (questionsCache && networkID) {
      this.mergeLegacyNumericNetworkKey(questionsCache, networkID);
    }
    if (!questionsCache[networkID]) {
      questionsCache[networkID] = {
        questionsLatestBlock: initialLastBlockQR,
        questionsDiscoveryCheckpointBlock: initialLastBlockQR,
        questions: {},
        questionResponses: {},
        questionResponsesMeta: {},              // ensure exists
        questionResponsesLatestBlock: initialLastBlockQR,
        pendingQuestionMetadata: {},
        arweaveTxCache: {},
        arweaveTxFailureCache: {},
        questionHydrationMeta: {},
      };
    }
    ensureQuestionArweaveCacheBranches(questionsCache[networkID]);
    const mergeFreshArweaveBranches = () => {
      try {
        const freshCache = this.DG.read("questionsCache", slug) || {};
        const freshNet = freshCache?.[networkID];
        if (!freshNet || typeof freshNet !== 'object') return;
        ensureQuestionArweaveCacheBranches(questionsCache[networkID]);
        mergeQuestionArweaveCacheBranches(questionsCache[networkID], freshNet);
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
    };

    let lastProcessedQRBlock = Number(questionsCache[networkID].questionResponsesLatestBlock) || 0;
    const floorBlock = initialLastBlockQR;
    if (lastProcessedQRBlock < floorBlock) lastProcessedQRBlock = floorBlock;

    const latestBlock = baseTo;

    if (lastProcessedQRBlock >= latestBlock) {
      mainSiteLog.log("No new question responses to fetch: already up-to-date.");
      setResponseState(prev => ({
        isResponsesCacheReady: true,
        questionResponsesNonce: prev.questionResponsesNonce + 1
      }), maybeCheckAllCachesReady);
      notifyBackgroundCompletion();
      return;
    }

	    // Track what we really persisted this run
	    let processedToBlock = lastProcessedQRBlock;
	    const pendingPersistenceWrites = [];
	    let persistenceFailureCount = 0;

	    const settleManagedWrite = (key, writePromise) => {
	      return Promise.resolve(writePromise)
	        .then((ok) => {
	          if (!ok) {
	            persistenceFailureCount += 1;
	            mainSiteLog.warn('[MainSite] managed cache write returned false', { slug, key });
	          }
	          return !!ok;
	        })
	        .catch((error) => {
	          persistenceFailureCount += 1;
	          mainSiteLog.warn('[MainSite] managed cache write threw', {
	            slug,
	            key,
	            error: error?.message || error,
	          });
	          return false;
	        });
	    };

	    const trackManagedWrite = (key, writePromise) => {
	      const tracked = settleManagedWrite(key, writePromise);
	      pendingPersistenceWrites.push(tracked);
	      return tracked;
	    };

	    const awaitManagedWrite = (key, writePromise) => (
	      settleManagedWrite(key, writePromise)
	    );

    const RESPONSE_CACHE_WRITE_MIN_INTERVAL_MS = 1000;
    const RESPONSE_CACHE_WRITE_MAX_PENDING_CHUNKS = 4;
    let lastResponseCacheWriteMs = 0;
    let pendingResponseChunkCount = 0;
    let hasPendingQuestionsCacheWrite = false;
    let pendingQuestionsCacheSnapshot = null;
    let pendingQuestionsCacheWatermark = 0;
    let hasPendingUserCacheWrite = false;
    let pendingUserCacheSnapshot = null;
    let responseUserCache = this.DG.read('userCache', slug) || {};
    const RESPONSE_USER_CACHE_DATA_KEYS = [
      'sbts',
      'createdSurveys',
      'createdQuestions',
      'surveyResponses',
      'questionResponses',
    ];
    const normalizeResponseCacheNetworkKey = (cacheObj) => {
      this.mergeLegacyNumericNetworkKey(cacheObj, networkID);
    };
    const ensureResponseQuestionCacheBucket = (cacheObj) => {
      const cacheRef = (cacheObj && typeof cacheObj === 'object') ? cacheObj : {};
      normalizeResponseCacheNetworkKey(cacheRef);
      if (!cacheRef[networkID]) {
        cacheRef[networkID] = {
          questionsLatestBlock: initialLastBlockQR,
          questionsDiscoveryCheckpointBlock: initialLastBlockQR,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},
          questionResponsesLatestBlock: initialLastBlockQR,
          pendingQuestionMetadata: {},
          arweaveTxCache: {},
          arweaveTxFailureCache: {},
          questionHydrationMeta: {},
        };
      }
      const net = cacheRef[networkID];
      if (!net.questions || typeof net.questions !== 'object') net.questions = {};
      if (!net.questionResponses || typeof net.questionResponses !== 'object') net.questionResponses = {};
      if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') net.questionResponsesMeta = {};
      if (!net.pendingQuestionMetadata || typeof net.pendingQuestionMetadata !== 'object') {
        net.pendingQuestionMetadata = {};
      }
      if (!net.questionHydrationMeta || typeof net.questionHydrationMeta !== 'object') {
        net.questionHydrationMeta = {};
      }
      ensureQuestionArweaveCacheBranches(net);
      return cacheRef;
    };
    const toResponseRecencyPair = (value, responseValue = null) => {
      const src = (value && typeof value === 'object') ? value : {};
      const responseObj = (responseValue && typeof responseValue === 'object') ? responseValue : {};
      return {
        bn: Number(src.bn ?? src.blockNumber ?? responseObj.blockNumber ?? responseObj.bn ?? 0) || 0,
        txi: Number(
          src.txi ??
          src.transactionIndex ??
          src.txIndex ??
          responseObj.transactionIndex ??
          responseObj.txIndex ??
          0
        ) || 0,
        li: Number(src.li ?? src.logIndex ?? responseObj.logIndex ?? responseObj.li ?? 0) || 0,
        ts: Number(src.ts ?? src.timestamp ?? responseObj.timestamp ?? 0) || 0,
      };
    };
    const compareResponseRecency = (incomingRecency, existingRecency) => {
      if (incomingRecency.bn > existingRecency.bn) return 1;
      if (incomingRecency.bn < existingRecency.bn) return -1;
      if (incomingRecency.txi > existingRecency.txi) return 1;
      if (incomingRecency.txi < existingRecency.txi) return -1;
      if (incomingRecency.li > existingRecency.li) return 1;
      if (incomingRecency.li < existingRecency.li) return -1;
      if (incomingRecency.ts > existingRecency.ts) return 1;
      if (incomingRecency.ts < existingRecency.ts) return -1;
      return 0;
    };
    const shouldApplyIncomingResponse = ({ existingMeta, incomingMeta, hasExistingResponse }) => {
      if (!hasExistingResponse) return true;
      const existing = toResponseRecencyPair(existingMeta);
      const incoming = toResponseRecencyPair(incomingMeta);
      return compareResponseRecency(incoming, existing) >= 0;
    };
    const mergeResponseMapsByRecency = (targetNet, sourceNet) => {
      const targetResponses = targetNet.questionResponses || {};
      const targetMeta = targetNet.questionResponsesMeta || {};
      const sourceResponses = (sourceNet && typeof sourceNet === 'object' && sourceNet.questionResponses && typeof sourceNet.questionResponses === 'object')
        ? sourceNet.questionResponses
        : {};
      const sourceMeta = (sourceNet && typeof sourceNet === 'object' && sourceNet.questionResponsesMeta && typeof sourceNet.questionResponsesMeta === 'object')
        ? sourceNet.questionResponsesMeta
        : {};
      Object.keys(sourceResponses).forEach((qidRaw) => {
        const sourceByResponder = sourceResponses[qidRaw];
        if (!sourceByResponder || typeof sourceByResponder !== 'object') return;
        const qid = String(qidRaw || '').trim().toLowerCase();
        if (!qid) return;
        if (!targetResponses[qid] || typeof targetResponses[qid] !== 'object') targetResponses[qid] = {};
        if (!targetMeta[qid] || typeof targetMeta[qid] !== 'object') targetMeta[qid] = {};
        Object.keys(sourceByResponder).forEach((responderRaw) => {
          const responder = String(responderRaw || '').trim().toLowerCase();
          if (!responder) return;
          const incomingResponse = (
            Object.prototype.hasOwnProperty.call(sourceByResponder, responderRaw)
              ? sourceByResponder[responderRaw]
              : sourceByResponder[responder]
          );
          const hasExistingResponse = Object.prototype.hasOwnProperty.call(targetResponses[qid], responder);
          const existingMeta = targetMeta[qid][responder];
          const incomingMeta = (
            sourceMeta?.[qidRaw]?.[responderRaw] ||
            sourceMeta?.[qidRaw]?.[responder] ||
            sourceMeta?.[qid]?.[responderRaw] ||
            sourceMeta?.[qid]?.[responder] ||
            null
          );
          if (!shouldApplyIncomingResponse({
            existingMeta,
            incomingMeta: toResponseRecencyPair(incomingMeta, incomingResponse),
            hasExistingResponse,
          })) return;
          targetResponses[qid][responder] = incomingResponse;
          targetMeta[qid][responder] = toResponseRecencyPair(incomingMeta, incomingResponse);
        });
      });
      targetNet.questionResponses = targetResponses;
      targetNet.questionResponsesMeta = targetMeta;
    };
    const mergeFreshQuestionsCacheIntoPendingSnapshot = (pendingCache, freshCache) => {
      const targetCache = ensureResponseQuestionCacheBucket(pendingCache);
      const sourceCache = ensureResponseQuestionCacheBucket(freshCache);
      const targetNet = targetCache[networkID];
      const sourceNet = sourceCache[networkID];
      targetNet.questionsLatestBlock = Math.max(
        Number(targetNet.questionsLatestBlock || 0),
        Number(sourceNet?.questionsLatestBlock || 0)
      );
      targetNet.questionsDiscoveryCheckpointBlock = Math.max(
        Number(targetNet.questionsDiscoveryCheckpointBlock || 0),
        Number(sourceNet?.questionsDiscoveryCheckpointBlock || 0)
      );
      targetNet.questions = {
        ...(targetNet.questions || {}),
        ...(sourceNet?.questions || {}),
      };
      targetNet.pendingQuestionMetadata = {
        ...(targetNet.pendingQuestionMetadata || {}),
        ...(sourceNet?.pendingQuestionMetadata || {}),
      };
      targetNet.questionHydrationMeta = {
        ...(targetNet.questionHydrationMeta || {}),
        ...(sourceNet?.questionHydrationMeta || {}),
      };
      mergeQuestionArweaveCacheBranches(targetNet, sourceNet);
      mergeResponseMapsByRecency(targetNet, sourceNet);
      targetNet.questionResponsesLatestBlock = Math.max(
        Number(targetNet.questionResponsesLatestBlock || 0),
        Number(sourceNet?.questionResponsesLatestBlock || 0)
      );
      return targetCache;
    };
    const buildUserCacheEntryKey = (listKey, entry) => {
      const item = (entry && typeof entry === 'object') ? entry : {};
      if (listKey === 'questionResponses') {
        const qid = String(item.questionId || item.id || '').trim().toLowerCase();
        const responder = String(item.responder || '').trim().toLowerCase();
        return qid ? `${qid}|${responder}` : '';
      }
      if (listKey === 'createdQuestions') {
        const qid = String(item.id || item.questionId || '').trim().toLowerCase();
        return qid;
      }
      if (listKey === 'createdSurveys') {
        const sid = String(item.id || item.surveyID || item.surveyId || '').trim().toLowerCase();
        return sid;
      }
      if (listKey === 'surveyResponses') {
        const sid = String(item.id || item.surveyID || item.surveyId || '').trim().toLowerCase();
        const responder = String(item.responder || '').trim().toLowerCase();
        return sid ? `${sid}|${responder}` : '';
      }
      if (listKey === 'sbts') {
        const addr = String(item.address || item.sbtAddress || '').trim().toLowerCase();
        const token = String(item.tokenId || item.id || '').trim().toLowerCase();
        return addr || token ? `${addr}|${token}` : '';
      }
      return '';
    };
    const readUserCacheRowRecency = (entry) => {
      const row = (entry && typeof entry === 'object') ? entry : {};
      const bn = Number(row.blockNumber ?? row.bn ?? 0);
      const txi = Number(row.transactionIndex ?? row.txIndex ?? row.txi ?? 0);
      const li = Number(row.logIndex ?? row.li ?? 0);
      const ts = Number(row.timestamp ?? row.ts ?? 0);
      return {
        bn: Number.isFinite(bn) ? bn : 0,
        txi: Number.isFinite(txi) ? txi : 0,
        li: Number.isFinite(li) ? li : 0,
        ts: Number.isFinite(ts) ? ts : 0,
      };
    };
    const hasUserCacheRowRecencyHints = (entry) => {
      const recency = readUserCacheRowRecency(entry);
      return recency.bn > 0 || recency.txi > 0 || recency.li > 0 || recency.ts > 0;
    };
    const compareUserCacheRowsByRecency = (incomingRow, existingRow) => {
      const incoming = readUserCacheRowRecency(incomingRow);
      const existing = readUserCacheRowRecency(existingRow);
      const hasBlockHints = (
        incoming.bn > 0 ||
        existing.bn > 0 ||
        incoming.txi > 0 ||
        existing.txi > 0 ||
        incoming.li > 0 ||
        existing.li > 0 ||
        incoming.ts > 0 ||
        existing.ts > 0
      );
      if (!hasBlockHints) return 0;
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
    const mergeUserDataArray = (targetData, sourceData, listKey) => {
      const sourceArr = Array.isArray(sourceData?.[listKey]) ? sourceData[listKey] : [];
      if (!sourceArr.length) return;
      const targetArr = Array.isArray(targetData?.[listKey]) ? targetData[listKey] : [];
      if (!targetArr.length) {
        targetData[listKey] = [...sourceArr];
        return;
      }
      const merged = [];
      const keyedIndex = new Map();
      const upsert = (entry, { allowReplace = true } = {}) => {
        const key = buildUserCacheEntryKey(listKey, entry);
        if (!key) {
          merged.push(entry);
          return;
        }
        if (!keyedIndex.has(key)) {
          keyedIndex.set(key, merged.length);
          merged.push(entry);
          return;
        }
        if (!allowReplace) return;
        const idx = keyedIndex.get(key);
        if (
          listKey === 'questionResponses' ||
          listKey === 'surveyResponses'
        ) {
          const existing = merged[idx];
          const cmp = compareUserCacheRowsByRecency(entry, existing);
          if (cmp > 0) {
            merged[idx] = entry;
            return;
          }
          if (cmp === 0 && existing && typeof existing === 'object' && entry && typeof entry === 'object') {
            const hasIncomingHints = hasUserCacheRowRecencyHints(entry);
            const hasExistingHints = hasUserCacheRowRecencyHints(existing);
            if (!hasIncomingHints && !hasExistingHints) {
              // If neither row has recency hints, preserve merge order and let source payload win.
              merged[idx] = {
                ...existing,
                ...entry,
              };
            } else {
              // Preserve existing payload values while backfilling any missing fields.
              merged[idx] = {
                ...entry,
                ...existing,
              };
            }
          }
          return;
        }
        merged[idx] = entry;
      };

      targetArr.forEach((entry) => upsert(entry, { allowReplace: true }));
      // Prefer fresher source rows when the dedupe key collides.
      sourceArr.forEach((entry) => upsert(entry, { allowReplace: true }));
      targetData[listKey] = merged;
    };
    const mergeUserNetworkBucket = (targetBucket, sourceBucket) => {
      const targetRef = (targetBucket && typeof targetBucket === 'object') ? targetBucket : {};
      const sourceRef = (sourceBucket && typeof sourceBucket === 'object') ? sourceBucket : {};
      targetRef.lastBlockScanned = Math.max(
        Number(targetRef.lastBlockScanned || 0),
        Number(sourceRef.lastBlockScanned || 0)
      );
      targetRef.lastScanTimestamp = Math.max(
        Number(targetRef.lastScanTimestamp || 0),
        Number(sourceRef.lastScanTimestamp || 0)
      );
      if (!targetRef.data || typeof targetRef.data !== 'object') targetRef.data = {};
      const sourceData = (sourceRef.data && typeof sourceRef.data === 'object') ? sourceRef.data : {};
      RESPONSE_USER_CACHE_DATA_KEYS.forEach((listKey) => {
        mergeUserDataArray(targetRef.data, sourceData, listKey);
      });
      return targetRef;
    };
    const mergeFreshUserCacheIntoPendingSnapshot = (pendingCache, freshCache) => {
      const targetCache = (pendingCache && typeof pendingCache === 'object') ? pendingCache : {};
      const sourceCache = (freshCache && typeof freshCache === 'object') ? freshCache : {};
      Object.keys(sourceCache).forEach((addrRaw) => {
        const sourceByNetwork = sourceCache[addrRaw];
        if (!sourceByNetwork || typeof sourceByNetwork !== 'object') return;
        const lowerAddr = String(addrRaw || '').trim().toLowerCase();
        if (!lowerAddr) return;
        if (!targetCache[lowerAddr] || typeof targetCache[lowerAddr] !== 'object') {
          targetCache[lowerAddr] = {};
        }
        const targetByNetwork = targetCache[lowerAddr];
        Object.keys(sourceByNetwork).forEach((netKey) => {
          const sourceBucket = sourceByNetwork[netKey];
          if (!sourceBucket || typeof sourceBucket !== 'object') return;
          if (!targetByNetwork[netKey] || typeof targetByNetwork[netKey] !== 'object') {
            targetByNetwork[netKey] = {};
          }
          targetByNetwork[netKey] = mergeUserNetworkBucket(targetByNetwork[netKey], sourceBucket);
        });
      });
      return targetCache;
    };
    const flushResponsePartialWrites = ({ force = false } = {}) => {
      const nowMs = Date.now();
      if (!shouldFlushCoalescedRun({
        force,
        dirty: hasPendingQuestionsCacheWrite || hasPendingUserCacheWrite,
        nowMs,
        lastFlushMs: lastResponseCacheWriteMs,
        minIntervalMs: RESPONSE_CACHE_WRITE_MIN_INTERVAL_MS,
        pendingOps: pendingResponseChunkCount,
        maxPendingOps: RESPONSE_CACHE_WRITE_MAX_PENDING_CHUNKS,
      })) {
        return false;
      }
      const questionsSnapshot = hasPendingQuestionsCacheWrite ? pendingQuestionsCacheSnapshot : null;
      const questionsWatermark = Number(pendingQuestionsCacheWatermark || 0);
      const userSnapshot = hasPendingUserCacheWrite ? pendingUserCacheSnapshot : null;

      hasPendingQuestionsCacheWrite = false;
      pendingQuestionsCacheSnapshot = null;
      pendingQuestionsCacheWatermark = 0;
      hasPendingUserCacheWrite = false;
      pendingUserCacheSnapshot = null;
      pendingResponseChunkCount = 0;
      lastResponseCacheWriteMs = nowMs;

      if (questionsSnapshot) {
        const latestQuestionsSnapshot = mergeFreshQuestionsCacheIntoPendingSnapshot(
          questionsSnapshot,
          this.DG.read("questionsCache", slug) || {}
        );
        questionsCache = latestQuestionsSnapshot;
        const questionsWrite = trackManagedWrite(
          'questionsCache',
          this.DG.write("questionsCache", slug, latestQuestionsSnapshot)
        );
        questionsWrite.then((ok) => {
          if (ok) {
            processedToBlock = Math.max(processedToBlock, questionsWatermark);
          }
        });
      }
      if (userSnapshot) {
        const latestUserSnapshot = mergeFreshUserCacheIntoPendingSnapshot(
          userSnapshot,
          this.DG.read('userCache', slug) || {}
        );
        responseUserCache = latestUserSnapshot;
        trackManagedWrite('userCache', this.DG.write("userCache", slug, latestUserSnapshot));
      }
      return true;
    };

    const handleProgress = (info) => {
      mainSiteLog.debug(`Chunk ${info.chunkFrom}-${info.chunkTo}, events=${info.chunkEventCount}, soFar=${info.overallEventCount}`);
    };

    const handlePartialData = (partialAgg, chunkToBlock, extra = {}) => {
      // Rebase the local pending snapshot onto fresh persisted state to avoid stale overwrites.
      const persistedQuestionsCache = this.DG.read("questionsCache", slug) || {};
      let fresh = mergeFreshQuestionsCacheIntoPendingSnapshot(
        pendingQuestionsCacheSnapshot || questionsCache || {},
        persistedQuestionsCache
      );
      ensureQuestionArweaveCacheBranches(fresh[networkID]);
      mergeQuestionArweaveCacheBranches(fresh[networkID], questionsCache?.[networkID]);

      const currentQR = fresh[networkID].questionResponses;
      const metaQR = fresh[networkID].questionResponsesMeta; // responder-level recency guards

      // Proactive user cache population
      let userCache = mergeFreshUserCacheIntoPendingSnapshot(
        pendingUserCacheSnapshot || responseUserCache || {},
        this.DG.read('userCache', slug) || {}
      );
      let userCacheModified = false;

      const ensureUserNode = (addr, block) => {
        const lower = addr.toLowerCase();
        if (!userCache[lower]) userCache[lower] = {};
        if (!userCache[lower][networkID]) {
          userCache[lower][networkID] = {
            lastBlockScanned: block,
            lastScanTimestamp: Math.floor(Date.now() / 1000),
            data: { sbts: [], createdSurveys: [], createdQuestions: [], surveyResponses: [], questionResponses: [] }
          };
        }
        if (block > userCache[lower][networkID].lastBlockScanned) {
          userCache[lower][networkID].lastBlockScanned = block;
          userCache[lower][networkID].lastScanTimestamp = Math.floor(Date.now() / 1000);
        }
        return userCache[lower][networkID].data;
      };

      // Merge partialAgg deterministically
      Object.keys(partialAgg).forEach((qId) => {
        if (!currentQR[qId]) currentQR[qId] = {};
        if (!metaQR[qId]) metaQR[qId] = {};

        partialAgg[qId].forEach((respObj) => {
          const responderKey = (respObj.responder || '').toLowerCase();

          const bn = Number(respObj.blockNumber ?? extra.chunkToBlock ?? chunkToBlock ?? 0);
          const txi = Number(respObj.transactionIndex ?? respObj.txIndex ?? respObj.txi ?? 0);
          const li = Number(respObj.logIndex ?? 0);
          const ts = Number(respObj.timestamp ?? 0);

          const prev = toResponseRecencyPair(metaQR[qId][responderKey]);
          const incoming = toResponseRecencyPair({ bn, txi, li, ts }, respObj?.response);
          const isNewer = compareResponseRecency(incoming, prev) > 0;

          if (isNewer) {
            currentQR[qId][responderKey] = respObj.response;   // keep the existing shape
            metaQR[qId][responderKey] = incoming;              // Remember recency to avoid stale overwrites

            // Update user cache (responder)
            const uData = ensureUserNode(responderKey, bn);
            if (!uData.questionResponses) uData.questionResponses = [];
            const existingIndex = uData.questionResponses.findIndex(
              (row) => String(row?.questionId || '').toLowerCase() === String(qId || '').toLowerCase()
            );
            const nextEntry = {
              questionId: qId,
              responder: responderKey,
              response: respObj.response,
              blockNumber: bn,
              transactionIndex: txi,
              logIndex: li,
              timestamp: ts,
            };
            if (existingIndex < 0) {
              uData.questionResponses.push(nextEntry);
              userCacheModified = true;
            } else {
              const prevEntry = uData.questionResponses[existingIndex];
              const mergedEntry = {
                ...(prevEntry && typeof prevEntry === 'object' ? prevEntry : {}),
                ...nextEntry,
              };
              const prevQuestionId = String(prevEntry?.questionId || '');
              const prevResponder = String(prevEntry?.responder || '');
              const prevResponse = prevEntry?.response;
              const prevBlockNumber = Number(prevEntry?.blockNumber ?? 0);
              const prevTransactionIndex = Number(prevEntry?.transactionIndex ?? prevEntry?.txIndex ?? prevEntry?.txi ?? 0);
              const prevLogIndex = Number(prevEntry?.logIndex ?? 0);
              const prevTimestamp = Number(prevEntry?.timestamp ?? prevEntry?.ts ?? 0);
              if (
                prevQuestionId !== String(mergedEntry.questionId || '') ||
                prevResponder !== String(mergedEntry.responder || '') ||
                prevResponse !== mergedEntry.response ||
                prevBlockNumber !== Number(mergedEntry.blockNumber ?? 0) ||
                prevTransactionIndex !== Number(mergedEntry.transactionIndex ?? mergedEntry.txIndex ?? mergedEntry.txi ?? 0) ||
                prevLogIndex !== Number(mergedEntry.logIndex ?? 0) ||
                prevTimestamp !== Number(mergedEntry.timestamp ?? mergedEntry.ts ?? 0)
              ) {
                uData.questionResponses[existingIndex] = mergedEntry;
                userCacheModified = true;
              }
            }
          }
        });
      });

      // Optimistically advance chunk watermark; final clamp uses processedToBlock.
      const prevWatermark = Number(fresh[networkID].questionResponsesLatestBlock) || 0;
      const thisChunkTo = Number(chunkToBlock) || 0;
      fresh[networkID].questionResponsesLatestBlock = Math.max(prevWatermark, thisChunkTo);

      pendingResponseChunkCount += 1;
      hasPendingQuestionsCacheWrite = true;
      pendingQuestionsCacheSnapshot = fresh;
      pendingQuestionsCacheWatermark = Math.max(
        Number(pendingQuestionsCacheWatermark || 0),
        thisChunkTo
      );

      // Write user cache
      if (userCacheModified) {
        hasPendingUserCacheWrite = true;
        pendingUserCacheSnapshot = userCache;
      }
      const didFlushPartialWrites = flushResponsePartialWrites();
      if (!didFlushPartialWrites) {
        responseUserCache = userCache;
        questionsCache = fresh; // keep outer ref in sync
      }
    };

    try {
      await contractScripts.getQuestionResponsesChunkedWithCallback(
        'none',
        lastProcessedQRBlock + 1,  // inclusive start
        latestBlock,               // inclusive end (the fetcher does clamping)
        handleProgress,
        handlePartialData,
        slug,
        { forceArweaveFetch }
      );
    } catch (chunkErr) {
      mainSiteLog.error("getQuestionResponsesChunkedWithCallback failed:", chunkErr);
      // DO NOT mark complete; we’ll leave the watermark where we truly got to (processedToBlock)
    }

    flushResponsePartialWrites({ force: true });
	    await Promise.allSettled(pendingPersistenceWrites);

	    // Clamp watermark to the last block that actually persisted
	    questionsCache[networkID].questionResponsesLatestBlock = resolvePersistedQuestionResponsesWatermark({
	      floorBlock,
	      processedToBlock,
	    });
	    mergeFreshArweaveBranches();
	    await awaitManagedWrite('questionsCache', this.DG.write("questionsCache", slug, questionsCache));

	    if (persistenceFailureCount > 0) {
	      mainSiteLog.warn(
	        '[MainSite] response-cache initialization finished with persistence failures; continuing with in-memory data',
	        { slug, persistenceFailureCount }
	      );
	    }

    mainSiteLog.log(`Finished responses. Watermark now ${questionsCache[networkID].questionResponsesLatestBlock} (latest=${latestBlock}).`);

    setResponseState((prev) => ({
      isResponsesCacheReady: true,
      questionResponsesNonce: prev.questionResponsesNonce + 1
    }));
    maybeCheckAllCachesReady();
    notifyBackgroundCompletion();
    })();

    this._responseInitInFlight[initRunKey] = run;
    try {
      return await run;
    } finally {
      delete this._responseInitInFlight[initRunKey];
      if (this._responseInitPending[initRunKey]) {
        const pendingOpts = this._responseInitPending[initRunKey];
        delete this._responseInitPending[initRunKey];
        setTimeout(() => {
          try {
            if (!this._mounted) return;
            this.fetchQuestionResponsesChunkedForGroup(slug, pendingOpts || rerunOpts);
          } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        }, 0);
      }
    }
  }

  startSurveyAndQuestionEventListener = async () => this.startSurveyAndQuestionEventListenerForGroup(this.getActiveSessionSlug());

  startSurveyAndQuestionEventListenerForGroup = async (slugIn) => {
    const slug = normalizeSessionSlug(slugIn || '');
    mainSiteLog.log("startSurveyAndQuestionEventListenerForGroup() – Setting up survey & question events listener", { slug });
    contractScripts.removeSurveyEventsListener('none', slug); // Ensure clean state
    if (this.shouldSkipSessionScanForSlug(slug, 'startSurveyAndQuestionEventListenerForGroup')) return;
    contractScripts.listenForSurveyEvents('none', (e) => this.onNewSurveyEventDetectedForGroup(slug, e), slug);
    mainSiteLog.log("Survey & Question event listener started");
  };


  onNewSurveyEventDetected = async (event) => this.onNewSurveyEventDetectedForGroup(this.getActiveSessionSlug(), event);

  onNewSurveyEventDetectedForGroup = async (slug, event) => { // event: { type, ..., blockNumber }
    if (window.ENABLE_RPC_DEBUG_LOGGING === true) mainSiteLog.log('[RPC_DEBUG_TRIGGER] MainSite: onNewSurveyEventDetectedForGroup invoked', { event, slug });
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
                .map((q) => q.toLowerCase())
                .filter((qid) => !currentQuestionNetworkCache.questions[qid]);

              if (missingIds.length > 0) {
                const results = await Promise.all(
                  missingIds.map(async (qid) => {
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

                results.forEach(({ qid, questionData }) => {
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
          const idsLower = event.questionIds.map((hex) => hex.toLowerCase());
          const missing = idsLower.filter((qid) => !currentQuestionNetworkCache.questions[qid]);

          let allNewQuestionsFetchedSuccessfully = true;
          if (missing.length > 0) {
            const results = await Promise.all(
              missing.map(async (qid) => {
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
            results.forEach(({ qid, questionData }) => {
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
      const questionIdsFromEvent = event.questionIds.map(q => q.toLowerCase());
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
      questionIdsFromEvent.forEach((qId) => {
        if (!currentQuestionNetworkCache.questionResponses[qId]) {
          currentQuestionNetworkCache.questionResponses[qId] = {};
        }
        if (!currentQuestionNetworkCache.questionResponsesMeta[qId]) {
          currentQuestionNetworkCache.questionResponsesMeta[qId] = {};
        }
      });

      const bn = Number(eventBlockNumber || 0);
      const qIdsToFetch = [];
      questionIdsFromEvent.forEach((qId) => {
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
          qIdsToFetch.map(async (qId) => {
            const data = await contractScripts.getResponse('none', responderAddressLower, qId, slug, {
              forceArweaveFetch: true,
            });
            if (!data) shouldForceResponseBackfill = true;
            return { qId, data };
          })
        );

        let acceptedAny = false;
        results.forEach(({ qId, data }) => {
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
          }).catch((backfillErr) => {
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

  _renderDebateRoute = (fullPath) => (
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

  _renderSimUserRoute = (fullPath, defaultSessionNetwork) => {
    const simUsername = fullPath.slice(4);
    return (
      <Suspense fallback={<LazyFallback label="Loading profile..." minHeight="40vh" />}>
        <SimulatedUserPage simUsername={simUsername} provider={this.props.provider} network={defaultSessionNetwork} />
      </Suspense>
    );
  };

  _renderAtlasRoute = (ctx) => {
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

  _renderTagRoute = (ctx) => {
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

  _renderCompareRoute = (ctx) => {
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

  _renderContractsRoute = (ctx) => {
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

  _renderAdminRoute = (ctx) => {
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

  _renderSponsorRoute = (ctx) => {
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

  _renderSbtsListRoute = (ctx) => {
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

  _renderSbtDetailRoute = (ctx) => {
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

  _renderUserProfileRoute = (ctx) => {
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

  _renderHomeRoute = (ctx) => {
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

  _renderSurveyIdRoute = (ctx) => {
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
      cfg.HIGHLIGHTED_SURVEY_IDS.some((id) => id.toLowerCase() === sidLower);

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

  _renderSurveysOrQuestionsListRoute = (ctx) => {
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
        resolveSessionConfigById: (sessionId) => sessionRegistryStore.getSessionConfigById(sessionId),
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
        ? ((id) => this.refreshSurveyResponsesByIDForGroup(effectivePageSlug, id))
        : this.refreshSurveyResponsesByID
    );
    const pageRefreshQuestionMetadata = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? (() => this.refreshQuestionMetadataForGroup(effectivePageSlug))
        : this.refreshQuestionMetadata
    );
    const pageRefreshQuestionResponses = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((questionIds, opts = {}) => (
          this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: effectivePageSlug })
        ))
        : this.refreshQuestionResponses
    );
    const pageRefreshSbtData = (
      isQuestionsListRoute && questionRouteSession.sessionSlugPinned
        ? ((addr, slug) => this.refreshSbtData(addr, slug || effectivePageSlug))
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

  _renderQuestionDetailRoute = (ctx) => {
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
      resolveSessionConfigById: (sessionId) => sessionRegistryStore.getSessionConfigById(sessionId),
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
            refreshSurveyResponsesByID={(id) => this.refreshSurveyResponsesByIDForGroup(effectiveQuestionSlug, id)}
            refreshQuestionMetadata={() => this.refreshQuestionMetadataForGroup(effectiveQuestionSlug)}
            refreshQuestionResponses={(questionIds, opts = {}) =>
              this.refreshQuestionResponses(questionIds, { ...(opts || {}), slug: effectiveQuestionSlug })
            }
            refreshSbtData={(addr, slug) => this.refreshSbtData(addr, slug || effectiveQuestionSlug)}
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

  _renderSessionRoute = (ctx) => {
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
      resolveSessionConfigById: (sessionId) => sessionRegistryStore.getSessionConfigById(sessionId),
      resolveSessionConfigBySlug: (slug) => getSessionConfigBySlug(slug),
      resolveDisplaySessionConfigBySlug: (slug) => (
        getDemoSessionConfigBySlug(slug, { allowDemoFallback: true })
      ),
      resolveSessionSlugFromPathToken: (sessionToken) => (
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
      const attempts = this._sessionPathIdResolveAttempts || {};
      const pending = this._pendingSessionPathIdResolves || new Set();
      const hasAttempted = !!attempts[sessionIdFromPath];
      const isPending = pending.has(sessionIdFromPath);
      const lastErr = this._sessionPathResolveLastErrors?.id?.[sessionIdFromPath] || null;
      const retryCount = Number(this._sessionPathResolveErrorCounts?.id?.[sessionIdFromPath] || 0);
      const recentError = !!(lastErr && lastErr.ts && (Date.now() - Number(lastErr.ts || 0)) < 2 * 60 * 1000);
      const keepResolving = recentError && retryCount > 0;
      this.resolveSessionPathId(sessionIdFromPath);
      if (!hasAttempted || isPending || keepResolving) {
        return (
          <SessionLoadingSkeleton
            statusTitle={`Resolving ${sessionIdFromPath} Session...`}
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
              toggleLoginModal={(loginModalIsOpen) => this.props.toggleLoginModal(loginModalIsOpen)}
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


  getMainView = (relevantMatch) => {
    // Variable initialization
    let surveyIDFromPath = null;
    let parsedFilterStateFromUrl = {};
    let autoOpenResults = false;
    let isResultsRoute = false;
    const cacheInitializationError = !!(
      this.state.surveyCacheInitializationError || this.state.questionCacheInitializationError
    );

    let fullPath = this.getEffectiveRoutePath(
      this.props.path || (typeof window !== 'undefined' ? window.location.pathname : '') || ''
    );
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

  refreshSurveyResponsesByID = async (surveyID) => this.refreshSurveyResponsesByIDForGroup(this.getActiveSessionSlug(), surveyID);

  refreshSurveyResponsesByIDForGroup = (...args) => this._surveyCacheController.refreshSurveyResponsesByIDForGroup(...args);

  refreshQuestionMetadata = async () => this.refreshQuestionMetadataForGroup(this.getActiveSessionSlug());

  hasMaskedQuestionPayloadInCache = (slug) => {
    const networkID = String(this.getSessionChainId(slug) || '');
    if (!networkID) return false;
    const questionsCache = this.DG.read('questionsCache', slug, { clone: false }) || {};
    const questionMap = questionsCache?.[networkID]?.questions;
    if (!questionMap || typeof questionMap !== 'object') return false;
    return Object.values(questionMap).some((q) => isMaskedQuestionPayload(q));
  };

  buildQuestionDecryptContext = (slug) => {
    const cfg = this.getSessionCfg(slug) || {};
    return buildQuestionDecryptContextForSession({
      cfg,
      account: this.props.account || '',
      providerLike: this.props.provider || '',
      litHooks: this.state.litHooks || getGlobalLitHooks() || null,
      fallbackChainId: this.props.network?.id || this.props.network?.chainId || null,
    });
  };

  refreshEncryptedQuestionPayloadsForGroup = async (slug, opts = {}) => {
    const force = !!opts?.force;
    const continuation = !!opts?.continuation;
    const now = Date.now();

    // Coalesce refreshes; this can be triggered by multiple signals (login, lit readiness, SBT events).
    this._maskedQuestionRefreshInFlight = this._maskedQuestionRefreshInFlight || {};
    this._maskedQuestionRefreshPending = this._maskedQuestionRefreshPending || {};
    this._maskedQuestionRefreshLastStart = this._maskedQuestionRefreshLastStart || {};
    this._maskedQuestionRefreshCursor = this._maskedQuestionRefreshCursor || {};
    this._maskedQuestionDecryptBackoff = this._maskedQuestionDecryptBackoff || new Map();
    this.pruneMaskedQuestionDecryptBackoff(now);

    const inFlight = this._maskedQuestionRefreshInFlight[slug];
    if (inFlight) {
      if (force) this._maskedQuestionRefreshPending[slug] = { force: true };
      return await inFlight;
    }

    const MIN_GAP_MS = 4000;
    const lastStart = Number(this._maskedQuestionRefreshLastStart[slug] || 0);
    if (!force && !continuation && lastStart && (now - lastStart) < MIN_GAP_MS) return;
    this._maskedQuestionRefreshLastStart[slug] = now;

    const run = (async () => {
      const networkID = String(this.getSessionChainId(slug) || '');
      if (!networkID) return;

      const questionsCache = this.DG.read('questionsCache', slug) || {};
      const networkCache = questionsCache?.[networkID];
      const questionMap = networkCache?.questions;
      if (!questionMap || typeof questionMap !== 'object') return;

      const encryptedQuestionIds = Object.keys(questionMap).filter((qid) => isMaskedQuestionPayload(questionMap[qid]));
      if (!encryptedQuestionIds.length) return;

      const decryptContext = this.buildQuestionDecryptContext(slug);
      const accountLower = String(decryptContext?.account || '').trim().toLowerCase();
      const hasProviderLike = !!String(decryptContext?.providerLike || '').trim();
      const hasLitKey = !!(decryptContext?.litOpts && typeof decryptContext.litOpts.getKey === 'function');
      if (!accountLower || (!hasProviderLike && !hasLitKey)) return;

      const backoffMs = force ? 0 : 30000;
      const backoffKey = (qid) => `${accountLower}|${slug}|${networkID}|${String(qid || '').toLowerCase()}`;

      // Time-slice: decrypt only a small number per invocation so we don't stall the app.
      const MAX_ATTEMPTS_PER_RUN = force ? 24 : 12;
      const BATCH_SIZE = 4;

      const total = encryptedQuestionIds.length;
      let cursor = Math.max(0, Number(this._maskedQuestionRefreshCursor[slug] || 0));
      if (total > 0) cursor = cursor % total;

      const toProcess = [];
      let scanned = 0;
      while (toProcess.length < MAX_ATTEMPTS_PER_RUN && scanned < total) {
        const idx = total > 0 ? ((cursor + scanned) % total) : 0;
        const id = String(encryptedQuestionIds[idx] || '').toLowerCase();
        scanned += 1;

        const prev = questionMap[id] || {};
        if (!isMaskedQuestionPayload(prev)) continue;

        const key = backoffKey(id);
        const lastAttempt = this._maskedQuestionDecryptBackoff.get(key);
        if (!force && lastAttempt && (now - Number(lastAttempt.ts || 0)) < backoffMs) {
          continue;
        }
        toProcess.push(id);
      }

      // Advance cursor even if many entries were skipped (fairness across runs).
      if (total > 0) {
        this._maskedQuestionRefreshCursor[slug] = (cursor + scanned) % total;
      }

      let changed = 0;
      for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        // eslint-disable-next-line no-loop-func
        const refreshedBatch = await Promise.all(
          batch.map(async (id) => {
            const prev = questionMap[id] || {};
            if (!isMaskedQuestionPayload(prev)) return { qid: id, next: null, improved: false };

            const key = backoffKey(id);
            const next = { ...(prev || {}), id };
            try {
              await contractScripts.decryptQuestionPayloadInPlace(next, slug, { decryptContext });
            } catch (err) {
              mainSiteLog.warn(`Failed to decrypt cached question payload for ${id}:`, err);
              const attemptTs = Date.now();
              this._maskedQuestionDecryptBackoff.set(key, { ts: attemptTs });
              this.pruneMaskedQuestionDecryptBackoff(attemptTs);
              return { qid: id, next: null, improved: false };
            }

            const improved = hasMaskedQuestionPayloadImproved(prev, next);
            if (!improved) {
              const attemptTs = Date.now();
              this._maskedQuestionDecryptBackoff.set(key, { ts: attemptTs });
              this.pruneMaskedQuestionDecryptBackoff(attemptTs);
              return { qid: id, next: null, improved: false };
            }

            // Success: clear backoff so future partial decrypts can run immediately.
            this._maskedQuestionDecryptBackoff.delete(key);
            return { qid: id, next, improved: true };
          })
        );

        for (const { qid, next, improved } of refreshedBatch) {
          if (!improved || !next) continue;
          const prev = questionMap[qid] || {};
          const picked = pickBetterQuestionPayload(prev, next);
          if (!picked) continue;
          questionMap[qid] = { ...prev, ...picked, id: qid };
          changed += 1;
        }
      }

      if (changed) {
        this.DG.write('questionsCache', slug, questionsCache);
        this.queueLocalRevisionUpdate({ needsQuestionResponsesNonce: true });
      }

      // If we hit our budget before scanning the full set, schedule a continuation.
      if (scanned < total && toProcess.length >= MAX_ATTEMPTS_PER_RUN) {
        const pending = this._maskedQuestionRefreshPending[slug] || {};
        this._maskedQuestionRefreshPending[slug] = {
          ...pending,
          continuation: true,
          // Yield to UI before the next batch.
          delayMs: Math.max(150, Number(pending.delayMs || 0) || 0),
        };
      }
    })();

    this._maskedQuestionRefreshInFlight[slug] = run;
    try {
      return await run;
    } finally {
      delete this._maskedQuestionRefreshInFlight[slug];
      const pending = this._maskedQuestionRefreshPending[slug];
      if (pending) {
        delete this._maskedQuestionRefreshPending[slug];
        const delayMs = Math.max(0, Number(pending.delayMs || 0));
        setTimeout(() => {
          try { this.refreshEncryptedQuestionPayloadsForGroup(slug, pending); } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
        }, delayMs);
      }
    }
  };

  refreshQuestionMetadataForGroup = async (slug) => {
    mainSiteLog.log("refreshQuestionMetadataForGroup() - invoked", { slug });
    if (!this.getSessionChainId(slug)) { mainSiteLog.warn("No group chainId for refreshQuestionMetadataForGroup"); return; }
    // Re-running initializeQuestionCacheForGroup will handle fetching new QIDs and their metadata
    // from the last known block.
    this.setReadinessStateIfChanged({ isQuestionCacheReady: false }); // Temporarily mark as not ready
    await this.initializeQuestionCacheForGroup(slug);
    this.checkAllCachesReady(); // Re-check global readiness
    mainSiteLog.log("refreshQuestionMetadataForGroup() - done");
  };

  refreshQuestionResponses = async (questionIds = null, opts = {}) => {
    const slug = normalizeSessionSlug((opts?.slug ?? this.getActiveSessionSlug()) || '');
    const forceFull = !!opts?.forceFull;
    const responderLower = String(opts?.responder || this.props.account || '').trim().toLowerCase();
    const migrateQuestionCacheNetworkKey = (cacheObj, netId) => {
      this.mergeLegacyNumericNetworkKey(cacheObj, netId);
    };
    const ensureQuestionCacheNetworkNode = (cacheObj, netId, initialLastBlockQR) => {
      if (!cacheObj[netId]) {
        cacheObj[netId] = {
          questionsLatestBlock: initialLastBlockQR,
          questionsDiscoveryCheckpointBlock: initialLastBlockQR,
          questions: {},
          questionResponses: {},
          questionResponsesMeta: {},
          questionResponsesLatestBlock: initialLastBlockQR,
          pendingQuestionMetadata: {},
          arweaveTxCache: {},
          arweaveTxFailureCache: {},
          questionHydrationMeta: {},
        };
      }
      const net = cacheObj[netId];
      if (!Number.isFinite(Number(net.questionsDiscoveryCheckpointBlock))) {
        net.questionsDiscoveryCheckpointBlock = Number(net.questionsLatestBlock) || initialLastBlockQR;
      }
      if (!net.questionResponses || typeof net.questionResponses !== 'object') net.questionResponses = {};
      if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') net.questionResponsesMeta = {};
      ensureQuestionArweaveCacheBranches(net);
      return net;
    };
    const ensureUserCacheNetworkNode = (cacheObj, responder, netId, initialLastBlockQR) => {
      const responderKey = String(responder || '').trim().toLowerCase();
      if (!responderKey) return null;
      if (!cacheObj[responderKey] || typeof cacheObj[responderKey] !== 'object') {
        cacheObj[responderKey] = {};
      }
      if (!cacheObj[responderKey][netId] || typeof cacheObj[responderKey][netId] !== 'object') {
        cacheObj[responderKey][netId] = {
          lastBlockScanned: initialLastBlockQR,
          lastScanTimestamp: Math.floor(Date.now() / 1000),
          data: {
            sbts: [],
            createdSurveys: [],
            createdQuestions: [],
            surveyResponses: [],
            questionResponses: [],
          },
        };
      }
      const node = cacheObj[responderKey][netId];
      if (!node.data || typeof node.data !== 'object') node.data = {};
      if (!Array.isArray(node.data.questionResponses)) node.data.questionResponses = [];
      return node;
    };
    const ensureHash = (value) => {
      try {
        if (ethers.utils.isHexString(value, 32)) return String(value || '').toLowerCase();
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      try {
        if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') {
          return String(cryptoUtils.hashIdentifier(value) || '').toLowerCase();
        }
      } catch (e) { mainSiteLog.warn('MainSite: fallback', e); }
      const raw = String(value || '').trim();
      if (!raw) return '';
      return String(ethers.utils.id(raw) || '').toLowerCase();
    };

    const normalizedQids = Array.from(
      new Set(
        (Array.isArray(questionIds) ? questionIds : [])
          .map((id) => ensureHash(id))
          .filter((id) => !!id && ethers.utils.isHexString(id, 32))
      )
    );

    const canTarget =
      !forceFull &&
      !!responderLower &&
      normalizedQids.length > 0 &&
      !!this.getSessionChainId(slug);

    if (canTarget) {
      mainSiteLog.log("refreshQuestionResponses() - targeted refresh", {
        slug,
        responder: responderLower,
        questionCount: normalizedQids.length,
      });
      this.setState({ isResponsesCacheReady: false });

      const networkID = String(this.getSessionChainId(slug) || '');
      const { fromBlock: baseFrom } = await contractScripts.getRelevantBlockWindowForFilter(slug);
      const initialLastBlockQR = Math.max(0, Number(baseFrom || 0) - 1);

      const results = await Promise.all(
        normalizedQids.map(async (qId) => {
          try {
            const response = await contractScripts.getResponse('none', responderLower, qId, slug);
            return { qId, response };
          } catch (err) {
            mainSiteLog.warn(`refreshQuestionResponses(targeted): failed qId=${qId}`, err);
            return { qId, response: null };
          }
        })
      );

      let updatedAny = false;
      const nextByQid = new Map();
      results.forEach(({ qId, response }) => {
        if (!response) return;
        nextByQid.set(qId, response);
      });

      if (nextByQid.size > 0) {
        // Re-read right before merge/write so concurrent listener hydrations are preserved.
        const freshCache = this.DG.read("questionsCache", slug) || {};
        const freshUserCache = this.DG.read("userCache", slug) || {};
        migrateQuestionCacheNetworkKey(freshCache, networkID);
        const net = ensureQuestionCacheNetworkNode(freshCache, networkID, initialLastBlockQR);
        const userNode = ensureUserCacheNetworkNode(
          freshUserCache,
          responderLower,
          networkID,
          initialLastBlockQR
        );
        let userCacheUpdated = false;

        nextByQid.forEach((response, qId) => {
          if (!net.questionResponses[qId] || typeof net.questionResponses[qId] !== 'object') {
            net.questionResponses[qId] = {};
          }
          if (!net.questionResponsesMeta[qId] || typeof net.questionResponsesMeta[qId] !== 'object') {
            net.questionResponsesMeta[qId] = {};
          }

          net.questionResponses[qId][responderLower] = response;

          // Targeted refresh is not event-ordered, so never stamp synthetic high logIndex values.
          // Clamp any legacy synthetic marker (li >= 1000) to 0 so same-block real events can win.
          const prevMeta = net.questionResponsesMeta[qId][responderLower] || {};
          const prevBn = Number(prevMeta?.bn);
          const prevTxi = Number(prevMeta?.txi ?? prevMeta?.transactionIndex ?? prevMeta?.txIndex);
          const prevLi = Number(prevMeta?.li);
          const prevTs = Number(prevMeta?.ts ?? prevMeta?.timestamp);
          const hadLegacySyntheticLi = Number.isFinite(prevLi) && prevLi >= 1000;
          net.questionResponsesMeta[qId][responderLower] = hadLegacySyntheticLi
            ? { bn: 0, txi: 0, li: 0, ts: 0 }
            : {
              bn: Number.isFinite(prevBn) && prevBn >= 0 ? prevBn : 0,
              txi: Number.isFinite(prevTxi) && prevTxi >= 0 ? prevTxi : 0,
              li: Number.isFinite(prevLi) && prevLi >= 0 ? prevLi : 0,
              ts: Number.isFinite(prevTs) && prevTs >= 0 ? prevTs : 0,
            };
          updatedAny = true;

          if (userNode) {
            const responseMeta = net.questionResponsesMeta[qId]?.[responderLower] || {};
            const responseMetaBn = Number(responseMeta.bn ?? responseMeta.blockNumber ?? 0);
            const responseMetaTxi = Number(
              responseMeta.txi ?? responseMeta.transactionIndex ?? responseMeta.txIndex ?? 0
            );
            const responseMetaLi = Number(responseMeta.li ?? responseMeta.logIndex ?? 0);
            const responseMetaTs = Number(responseMeta.ts ?? responseMeta.timestamp ?? 0);
            const hasResponseRecencyHint = (
              (Number.isFinite(responseMetaBn) && responseMetaBn > 0) ||
              (Number.isFinite(responseMetaTxi) && responseMetaTxi > 0) ||
              (Number.isFinite(responseMetaLi) && responseMetaLi > 0) ||
              (Number.isFinite(responseMetaTs) && responseMetaTs > 0)
            );
            const nextEntry = {
              questionId: qId,
              responder: responderLower,
              response,
            };
            if (hasResponseRecencyHint) {
              nextEntry.blockNumber = Math.max(0, responseMetaBn);
              nextEntry.transactionIndex = Math.max(0, responseMetaTxi);
              nextEntry.logIndex = Math.max(0, responseMetaLi);
              nextEntry.timestamp = Math.max(0, responseMetaTs);
            }
            const responses = userNode.data.questionResponses;
            const existingIdx = responses.findIndex(
              (item) => String(item?.questionId || '').toLowerCase() === qId
            );
            if (existingIdx === -1) {
              if (!hasResponseRecencyHint) {
                // Brand-new targeted rows may lack ordering metadata; store explicit neutral hints.
                nextEntry.blockNumber = 0;
                nextEntry.transactionIndex = 0;
                nextEntry.logIndex = 0;
                nextEntry.timestamp = 0;
              }
              responses.push(nextEntry);
            } else {
              responses[existingIdx] = { ...(responses[existingIdx] || {}), ...nextEntry };
            }
            userCacheUpdated = true;
          }
        });

        // Targeted refresh only touches selected (questionId,responder) pairs.
        // Never advance the global scan watermark here, or we can skip unscanned responders.
        if (updatedAny) {
          this.DG.write("questionsCache", slug, freshCache);
          if (userNode) {
            const prevLast = Number(userNode.lastBlockScanned) || 0;
            userNode.lastBlockScanned = Math.max(prevLast, initialLastBlockQR);
            userNode.lastScanTimestamp = Math.floor(Date.now() / 1000);
          }
          if (userCacheUpdated) {
            this.DG.write("userCache", slug, freshUserCache);
          }
        }
      }

      this.setState((prev) => ({
        isQuestionCacheReady: updatedAny ? true : prev.isQuestionCacheReady,
        isResponsesCacheReady: true,
      }));
      this.queueLocalRevisionUpdate({
        needsQuestionResponsesNonce: true,
        checkAllCachesReady: true,
      });
      mainSiteLog.log("refreshQuestionResponses() - targeted refresh complete", {
        slug,
        updatedAny,
      });
      return;
    }

    mainSiteLog.log("refreshQuestionResponses() - full refresh fallback", {
      slug,
      forceFull,
      responderLower,
      questionCount: normalizedQids.length,
    });
    // No wallet network required; we use group-aware read providers internally.
    this.setReadinessStateIfChanged({ isQuestionCacheReady: false, isResponsesCacheReady: false });
    await this.fetchQuestionResponsesChunkedForGroup(slug);
    this.checkAllCachesReady();
    mainSiteLog.log("refreshQuestionResponses() - done");
  };

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



MainSite.propTypes = {
  fetchSessionState: PropTypes.func.isRequired,
  fetchAccount: PropTypes.func.isRequired,
  changeFocusedTab: PropTypes.func.isRequired,
  toggleLoginModal: PropTypes.func.isRequired,
  updateLoginInfo: PropTypes.func.isRequired,
  toggleDemoMode: PropTypes.func.isRequired,
  changeActiveSessionSlug: PropTypes.func.isRequired,
  profile: PropTypes.object,
  account: PropTypes.string,
  provider: PropTypes.string,
  network: PropTypes.object,
  sessionState: PropTypes.object,
  focusedTab: PropTypes.number,
  loginComplete: PropTypes.bool,
  loginInProgress: PropTypes.bool,
  demoMode: PropTypes.object,
  demoSurfaceMode: PropTypes.oneOfType([PropTypes.bool, PropTypes.oneOf([null])]),
  activeSessionSlug: PropTypes.string,
  // From withWagmiBridge
  wagmiChainOptions: PropTypes.array,
  wagmiBlocknumber: PropTypes.number,
  urlExtension: PropTypes.object, // from react-router
  path: PropTypes.string, // from react-router via withWagmiBridge
};

const mapStateToProps = state => ({
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
})(MainSiteWithWagmiHooks);
