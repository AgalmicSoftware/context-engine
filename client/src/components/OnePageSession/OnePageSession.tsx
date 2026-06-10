/** @file OnePageSession.tsx */
import React, { Component, Suspense } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCaretDown,
  faCaretUp,
  faDownload,
  faExternalLinkAlt,
  faQuestionCircle,
  faSpinner,
  faCheck,
  faTimes,
  faImage,
  faArrowLeft,
  faExpand,
  faPlus,
  faSyncAlt,
} from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { createLitHooks } from '../../utilities/crypto/litProtocol.js';
import { ethers } from 'ethers';



import styles from './OnePageSession.module.scss';
// Telegram-only panels reuse the normal session card styling so the
// telegram/cloudflare page matches the on-chain look (duplicated on purpose
// for now; consolidate when the telegram path stabilizes).
import sbtListStyles from '../SBTs/SBTsList.module.scss';
import TelegramTopicMap from './TelegramTopicMap';
import TelegramQuestionPile from './telegram/TelegramQuestionPile';
import { SbtListStandardCard } from '../SBTs/SbtListDisplayCards';

import LazyFallback from '../Shared/LazyFallback';

import contractScripts, { getAllSessionSlugs } from '../../utilities/web3/contractScripts.js';

import { resolveEffectiveSlug, normalizeSurveyToolFilterState } from '../SurveyTool/surveyToolUtils.js';
import { serializeFilterState, deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { createLogger } from 'utilities/logging.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  writeCache,
} from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { hasCachedCreateSbtForm as hasCachedCreateSbtFormCache } from '../../utilities/sbt/sbtCreateFormCache.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { isCryptoMode, sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { PUBLIC_AI_DISCOURSE_CORPUS_URL } from '../../variables/publicRepoMetadata.js';
import { CE_TELEGRAM_AGENT_BRIDGE_URL } from '../../variables/appConfig.js';
import { resolveMainSiteLitSessionConfig } from '../MainSite/litSessionConfig.js';
import {
  fetchTelegramSessionMeta,
  isTelegramOnlySessionConfig,
} from '../../utilities/session/telegramSessionMeta.js';
import {
  buildTelegramPolisDataset,
  isTelegramAgentAuthFailure,
  normalizeTelegramBucketCards,
} from '../../utilities/session/telegramAgentData.js';
import {
  loadTelegramQuestions,
  loadTelegramResultsDataset,
  submitTelegramAnswer,
} from '../../utilities/session/telegramSessionBackend';
import { resolveSessionDataMode } from '../../utilities/session/sessionDataMode';
import {
  exchangeTelegramSessionToken,
  extractTelegramSessionToken,
  getTelegramAgentBridgeCredentials,
  readTelegramWorkerLogin,
} from '../../utilities/worker/workerAuth.js';
import type { RiskMatrixRestoreState } from '../MainContent/RiskMatrix';
import {
  buildAggregatorFromLocalCache,
  computeAggregatorDataSignature,
  computeAggregatorQuestionMetadataSignature,
  computeAggregatorSourceSnapshotSignature,
} from './onePageSessionAggregator';

const SurveyPage = React.lazy(() => import('../SurveyTool/SurveyPage'));
const MemoSurveyPage = React.memo((props: any) => <SurveyPage {...props} />);
const SBTsPage = React.lazy(() => import('../SBTs/SBTsPage'));
const PolisReport = React.lazy(() => import('../PolisReport/PolisReport'));
const DebateMap = React.lazy(() => import('../DebateMap/DebateMap'));
const CorpusViewer = React.lazy(() => import('../DemoViews/CorpusViewer'));
const RiskMatrix = React.lazy(() => import('../MainContent/RiskMatrix'));
const DemoAnalysisWorkspace = React.lazy(() => import('../DemoViews/DemoAnalysis/DemoAnalysisWorkspace'));

const demoLog = createLogger('demo');
const ONE_PAGE_DEMO_PERF_SCOPE = 'onePageDemo';
const SBT_TOOLTIP_LABEL = isCryptoMode() ? 'Soulbound tokens (SBTs)' : `${t('sbtFull')}s`;
const DEMO_CORPUS_GITHUB_URL = PUBLIC_AI_DISCOURSE_CORPUS_URL;
const DEFAULT_CORPUS_VIEWER_LOAD_STATE = Object.freeze({
  activeCorpusKey: 'cross_corpus',
  activeCorpusLabel: 'Cross-Corpus',
  loadStatus: 'idle',
  loadButtonLabel: 'Load full corpus',
  disableLoadButton: false,
  error: '',
});
type UnknownRecord = Record<string, unknown>;

const toUnknownRecord = (value: unknown): UnknownRecord => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : {}
);

const globalState: any = globalThis as any;
const contractScriptsAny: any = contractScripts as any;
const DebateMapAny: any = DebateMap;

const getErrorMessage = (error: any, fallback = 'Unknown error') => (
  error && typeof error === 'object' && typeof error.message === 'string'
    ? error.message
    : fallback
);
const TELEGRAM_TOKEN_EXPIRED_OR_REVOKED_MESSAGE = 'Your Telegram token expired or was revoked. Paste a fresh one from the Telegram bot (Onboard Agent → Copy New Agent Info).';
const isTelegramAgentTokenRefreshError = (error: any) => {
  const message = String(error?.message || '');
  return message.includes('agent_token_not_found') || message.includes('refresh_user_agent_token');
};

const resolveAutoFeatureBySessionSlug = (metadata: any) => (
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags
);

const TELEGRAM_LOGIN_QUERY_PARAMS = [
  'telegramToken',
  'ceTelegramToken',
  'ceagt',
  'agentToken',
  'token',
];
const TELEGRAM_CLIENT_AUTH_EXPIRY_SKEW_SECONDS = 60;

const normalizeAgentBridgeUrl = (value: any = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.pathname = url.pathname
      .replace(/\/telegram\/agent\/api\/client-login\/exchange\/?$/i, '')
      .replace(/\/telegram\/agent\/api\/?$/i, '')
      .replace(/\/+$/g, '');
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/g, '');
  } catch (_) {
    return '';
  }
};

const resolveTelegramAgentBridgeUrl = (sessionConfig: any = {}) => {
  const config = toUnknownRecord(sessionConfig);
  const telegram = toUnknownRecord(config.telegram);
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      const queryUrl = normalizeAgentBridgeUrl(url.searchParams.get('agentBridgeUrl') || url.searchParams.get('bridge'));
      if (queryUrl) return queryUrl;
    } catch (_) {}
    const globalUrl = normalizeAgentBridgeUrl((globalThis as any).CE_TELEGRAM_AGENT_BRIDGE_URL);
    if (globalUrl) return globalUrl;
  }
  return normalizeAgentBridgeUrl(
    config.agentBridgeWorkerUrl ||
    config.telegramAgentBridgeUrl ||
    config.agentBridgeUrl ||
    telegram.agentBridgeUrl ||
    telegram.worker ||
    CE_TELEGRAM_AGENT_BRIDGE_URL
  );
};

const resolveTrustedTelegramAgentBridgeUrl = (sessionConfig: any = {}) => {
  const config = toUnknownRecord(sessionConfig);
  const telegram = toUnknownRecord(config.telegram);
  return normalizeAgentBridgeUrl(
    config.agentBridgeWorkerUrl ||
    config.telegramAgentBridgeUrl ||
    config.agentBridgeUrl ||
    telegram.agentBridgeUrl ||
    telegram.worker ||
    CE_TELEGRAM_AGENT_BRIDGE_URL
  );
};

const readTelegramLoginInputFromUrl = () => {
  if (typeof window === 'undefined') return '';
  try {
    const url = new URL(window.location.href);
    for (const param of TELEGRAM_LOGIN_QUERY_PARAMS) {
      const value = url.searchParams.get(param);
      const token = extractTelegramSessionToken(value || '');
      if (token) return token;
    }
  } catch (_) {}
  return '';
};

const removeTelegramLoginInputFromUrl = () => {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    let changed = false;
    for (const param of TELEGRAM_LOGIN_QUERY_PARAMS) {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        changed = true;
      }
    }
    if (changed) {
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  } catch (_) {}
};

const isPerfCountersEnabled = () => {
  try {
    return typeof globalThis !== 'undefined' && (
      globalState.ENABLE_CE_UI_PERF_STATS === true ||
      globalState.ENABLE_CE_DEBUG_COUNTERS === true ||
      globalState.__CE_DEBUG_COUNTERS__ === true
    );
  } catch (_) {
    return false;
  }
};

const bumpPerfCounter = (key: any, inc: any = 1) => {
  if (!isPerfCountersEnabled()) return;
  try {
    if (!globalState.__CE_PERF_COUNTERS__ || typeof globalState.__CE_PERF_COUNTERS__ !== 'object') {
      globalState.__CE_PERF_COUNTERS__ = {};
    }
    if (
      !globalState.__CE_PERF_COUNTERS__[ONE_PAGE_DEMO_PERF_SCOPE] ||
      typeof globalState.__CE_PERF_COUNTERS__[ONE_PAGE_DEMO_PERF_SCOPE] !== 'object'
    ) {
      globalState.__CE_PERF_COUNTERS__[ONE_PAGE_DEMO_PERF_SCOPE] = {};
    }
    const scope = globalState.__CE_PERF_COUNTERS__[ONE_PAGE_DEMO_PERF_SCOPE];
    scope[key] = Number(scope[key] || 0) + Number(inc || 0);
  } catch (e) { void e; /* fallback: perf counter update. */ }
};

const buildOnePageSessionEmptyFilterState = () => ({
  topQuestions: null,
  questionTypes: [],
  sbtFilter: null,
  aiFilter: null,
  aiTopN: null,
  aiCombine: false,
  selectedTags: [],
});

const normalizeOnePageSessionFilterState = (value: any = {}) => {
  const normalized = normalizeSurveyToolFilterState(
    (value && typeof value === 'object')
      ? value
      : {}
  );
  return Object.keys(normalized).length > 0
    ? normalized
    : buildOnePageSessionEmptyFilterState();
};

const serializeOnePageSessionFilterState = (value: any = {}) => (
  serializeFilterState(normalizeOnePageSessionFilterState(value))
);

const normalizeOnePageSessionSlug = (value: any = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'general' ? '' : normalized;
};

const resolveOnePageSessionRouteUiState = (props: any = {}) => {
  const autoOpenResults = props.routeAutoOpenResults === true;
  const showQuestions = autoOpenResults || props.routeQuestionsOpen === true;
  return {
    showQuestions,
    autoOpenResults,
  };
};
const buildOnePageSessionPublicRoute = (pathname: any = '') => {
  const normalizedPath = String(pathname || '').trim();
  const basePath = readPublicUrlBasePath();
  if (!normalizedPath) return basePath || '/';
  return `${basePath}${normalizedPath}` || normalizedPath;
};

const buildOnePageSessionCanonicalBaseUrl = (props: any = {}) => {
  try {
    const slug = resolveEffectiveSlug(props);
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = buildOnePageSessionPublicRoute(`/session${slug ? `/${slug}` : ''}`);
    nextUrl.searchParams.delete('sessionSlug');
    nextUrl.searchParams.delete('s');
    if (slug) {
      nextUrl.searchParams.set('session', slug);
    } else {
      nextUrl.searchParams.delete('session');
    }
    return `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
  } catch (_) {
    const slug = resolveEffectiveSlug(props);
    return `${buildOnePageSessionPublicRoute(`/session${slug ? `/${slug}` : ''}`)}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`;
  }
};

// Group helpers (for cross-group cache lookups)

function hasCachedCreateSbtForm(slug: any = '') {
  return hasCachedCreateSbtFormCache({
    sessionSlug: slug,
    migrateLegacyToSessionKey: true,
    clearInvalid: true,
  } as any);
}

export {
  buildAggregatorFromLocalCache,
  computeAggregatorSourceSnapshotSignature,
  hasCachedCreateSbtForm,
};


class OnePageSession extends Component<any, any> {
  [key: string]: any;

  constructor(props: any) {
    super(props);
    const initialSlug = resolveEffectiveSlug(props);
    const showEmbeddedCreateGroup = hasCachedCreateSbtForm(initialSlug);
    const routeUiState = resolveOnePageSessionRouteUiState(props);

    // Hydrate filter state from URL if present (Consume)
    let initialFilterState = normalizeOnePageSessionFilterState(props.defaultFilterState);
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        const filterParam = url.searchParams.get('filter');
        if (filterParam) {
          initialFilterState = normalizeOnePageSessionFilterState(deserializeFilterState(filterParam));
          // Clear the filter param from the URL to keep it clean (Clear)
          url.searchParams.delete('filter');
          window.history.replaceState({}, '', url.toString());
        }
      }
    } catch (e) {
      demoLog.error("Error hydrating filter state:", e);
    }

    this.state = {
      // Core UI sections
      showQuestions: routeUiState.showQuestions,
      showGroups: false,
      showResults: false,
      showDocuments: false,
      resultsViewMode: 'polis',
      showEmbeddedCreateGroup,
      // Removed obsolete 'About' state variables
      autoOpenResults: routeUiState.autoOpenResults,
      embeddedAtlasNodeId: null,
      embeddedAtlasReturnState: null,
      riskMatrixRestoreState: null,
      aggregatorData: {},
      disclaimersActive: true,
      filterState: initialFilterState,
      pileSubmitRailVisible: false,
      corpusViewerLoadRequestNonce: 0,
      corpusViewerLoadState: DEFAULT_CORPUS_VIEWER_LOAD_STATE,
      telegramLoginInput: readTelegramLoginInputFromUrl(),
      telegramLoginStatus: 'idle',
      telegramLoginError: '',
      telegramClientAuth: null,
      telegramOnlyProbe: null,
      showTelegramTokenReentry: false,
      resultsRefreshing: false,
      telegramAgentQuestionsStatus: 'idle',
      telegramAgentQuestions: [],
      telegramAgentAnswerState: null,
      telegramQuestionPileIndex: 0,
      telegramSubmittingQuestionId: '',
      telegramSubmittedQuestionIds: [],
      telegramQuestionSubmitError: '',
      telegramAgentResultsStatus: 'idle',
      telegramAgentResults: null,
      telegramPolisNonce: 0,
      telegramBucketLocalSelections: {},
      telegramTopicMapPromptCopied: false,

      // Legacy (limited) group password flow state
      // Auto-mint
      autoMintingMode: false,
      autoMintTargets: [],
      autoMintStatuses: {},

      // Resolved names/images for targets
      sbtNames: {},
      sbtImages: {},
      expandedImages: {}, // Toggle state for banner previews

      // Auto-mint success state
      mintSuccess: false,

      // NEW: Banner dismissal controls
      needsLoginForAutoMint: false,
      dismissedLoginBanner: false,
      dismissedAutoMintingBanner: false,
      autoMintCountdown: null, // null = not counting, number = seconds remaining
      dismissedStatusItems: {},
    };

    // Ensure idempotent auto-open of Groups on mount (do not fight user toggles)
    this._autoOpenedGroups = false;
    this._aggregatorInputSig = '';
    this._scheduledAggregatorSig = '';
    this._lastBuiltAggregatorInputSig = '';
    this._aggregatorDataSig = '0:0:0';
    this._aggregatorSourceSigKey = '';
    this._aggregatorResponseParseMemo = new Map();
    this._lastDefaultFilterStateSignature = serializeOnePageSessionFilterState(
      normalizeOnePageSessionFilterState(props.defaultFilterState || {})
    );
    this._resolvedSessionConfigMemoInputs = null;
    this._resolvedSessionConfigMemoValue = null;
    this._autoMintParseSourceSig = '';
    this._autoMintCountdownTimer = null;
    this._autoMintParseCachedTargets = [];
    this._autoOpenResultsTimer = null;
    this._telegramMetaProbeSeq = 0;
    this._telegramOnlyProbeKey = '';
    this._telegramMetaProbeStartedKey = '';
    this._topicMapCopiedTimer = null;
    this._unmounted = false;
    this.originalURL = '';

    // refs
    this.questionsSectionRef = React.createRef();

    // binds
    this.handleOpenResults = this.handleOpenResults.bind(this);
    this.handleResultsModalClose = this.handleResultsModalClose.bind(this);
    this.handleCorpusAtlasIssueOpen = this.handleCorpusAtlasIssueOpen.bind(this);
    this.handleEmbeddedAtlasModalClose = this.handleEmbeddedAtlasModalClose.bind(this);
    this.handleRiskMatrixRestoreApplied = this.handleRiskMatrixRestoreApplied.bind(this);
    this.resetDemoURL = this.resetDemoURL.bind(this);
    this.toggleQuestions = this.toggleQuestions.bind(this);
    this.toggleGroups = this.toggleGroups.bind(this);
    this.toggleEmbeddedCreateGroup = this.toggleEmbeddedCreateGroup.bind(this);
    // Removed toggleGroupsAbout bind
    this.toggleResults = this.toggleResults.bind(this);
    this.toggleDocuments = this.toggleDocuments.bind(this);
    this.handleCorpusViewerLoadStateChange = this.handleCorpusViewerLoadStateChange.bind(this);
    this.handleLoadFullCorpusClick = this.handleLoadFullCorpusClick.bind(this);
    this.handleGroupsViewAll = this.handleGroupsViewAll.bind(this);
    this.handlePileSubmitRailVisibilityChange = this.handlePileSubmitRailVisibilityChange.bind(this);
    // Removed toggleResultsAbout bind
    this.buildAggregator = this.buildAggregator.bind(this);

    // unlimited flow helper
    this.mintUnlimitedSBTWithGroupPassword = this.mintUnlimitedSBTWithGroupPassword.bind(this);

    // auto-mint
    this.parseAutoMintFragment = this.parseAutoMintFragment.bind(this);
    this.kickoffAutoMintIfNeeded = this.kickoffAutoMintIfNeeded.bind(this);
    this.runAutoMintQueue = this.runAutoMintQueue.bind(this);
    this.verifyGroupPasswordBinding = this.verifyGroupPasswordBinding.bind(this);
    this.prefetchTargetNames = this.prefetchTargetNames.bind(this);
    this.normalizeInviteCode = this.normalizeInviteCode.bind(this);
    this.decodeInviteInput = this.decodeInviteInput.bind(this);
    this.primeAutoMintTargets = this.primeAutoMintTargets.bind(this);
    this.hasAutoMintIntent = this.hasAutoMintIntent.bind(this);

    // NEW: dismiss handlers
    this.dismissLoginBanner = this.dismissLoginBanner.bind(this);
    this.dismissAutoMintingBanner = this.dismissAutoMintingBanner.bind(this);
    this.cancelAutoMintCountdown = this.cancelAutoMintCountdown.bind(this);
    this.dismissStatusItem = this.dismissStatusItem.bind(this);
    this.toggleStatusImagePreview = this.toggleStatusImagePreview.bind(this);

    this.onSbtMintSuccess = this.onSbtMintSuccess.bind(this);
    this.scheduleBuildAggregator = this.scheduleBuildAggregator.bind(this);
    this.buildAggregatorInputSignature = this.buildAggregatorInputSignature.bind(this);
    this.kickoffLightSbtUniverseScan = this.kickoffLightSbtUniverseScan.bind(this);

    // view-all handler
    this.handleViewAllQuestionsClick = this.handleViewAllQuestionsClick.bind(this);
    this.handleTelegramLoginInputChange = this.handleTelegramLoginInputChange.bind(this);
    this.handleTelegramLoginSubmit = this.handleTelegramLoginSubmit.bind(this);
    this.tryTelegramTokenLogin = this.tryTelegramTokenLogin.bind(this);
    this.restoreTelegramClientAuthFromStorage = this.restoreTelegramClientAuthFromStorage.bind(this);
    this.probeTelegramSessionMeta = this.probeTelegramSessionMeta.bind(this);
    this.handleRefreshResultsClick = this.handleRefreshResultsClick.bind(this);
    this.loadTelegramAgentQuestions = this.loadTelegramAgentQuestions.bind(this);
    this.loadTelegramAgentResults = this.loadTelegramAgentResults.bind(this);
    this.handleTelegramQuestionSubmit = this.handleTelegramQuestionSubmit.bind(this);
    this.handleCopyTopicMapPrompt = this.handleCopyTopicMapPrompt.bind(this);
  }

  kickoffLightSbtUniverseScan(propsIn: any = this.props) {
    if (typeof propsIn?.ensureLightSbtUniverse !== 'function') return;
    const slug = resolveEffectiveSlug(propsIn);
    try {
      const result = propsIn.ensureLightSbtUniverse([slug], { forceScopeSlug: slug });
      if (result && typeof result.catch === 'function') {
        result.catch((e: any) => { demoLog.warn('OnePageSession: callback', e); });
      }
    } catch (e) { demoLog.warn('OnePageSession: callback', e); }
  }

  resolveCurrentSessionSlug() {
    return normalizeOnePageSessionSlug(
      resolveEffectiveSlug(this.props) ||
      (this.props.sessionConfig && this.props.sessionConfig.slug) ||
      this.props.sessionSlug
    );
  }

  resolveCurrentSessionConfig(sessionSlug: any = this.resolveCurrentSessionSlug()) {
    return this.getResolvedSessionConfig({
      slug: sessionSlug,
      sessionName: this.props.sessionName,
      questionsGenPrompt: this.props.questionsGenPrompt,
      autoFeatureSBTsBySessionSlug: this.props.autoFeatureSBTsBySessionSlug,
      autoFeatureSBTsWithFeaturedSbtTags: this.props.autoFeatureSBTsWithFeaturedSbtTags,
      incomingSessionConfig: this.props.sessionConfig,
      contracts: this.props.contracts,
    });
  }

  currentTelegramProbeKey(sessionConfig: any = this.resolveCurrentSessionConfig()) {
    const sessionSlug = this.resolveCurrentSessionSlug();
    if (!sessionSlug) return '';
    const trustedBridgeUrl = resolveTrustedTelegramAgentBridgeUrl(sessionConfig);
    return `${trustedBridgeUrl}|${sessionSlug}`;
  }

  hasTelegramClientAuth(sessionSlug: any = '') {
    const auth = this.state.telegramClientAuth || {};
    const slug = normalizeOnePageSessionSlug(sessionSlug || this.resolveCurrentSessionSlug());
    const authSlug = normalizeOnePageSessionSlug(auth.sessionSlug || '');
    const exp = Number(auth.exp || 0);
    if (Number.isFinite(exp) && exp > 0) {
      const expiresAtMs = exp * 1000;
      const skewMs = TELEGRAM_CLIENT_AUTH_EXPIRY_SKEW_SECONDS * 1000;
      if (expiresAtMs <= Date.now() + skewMs) return false;
    }
    return Boolean(auth.accountAddress && auth.workerToken && (!slug || !authSlug || slug === authSlug));
  }

  isTelegramOnlySession(sessionConfig: any = {}) {
    if (isTelegramOnlySessionConfig(sessionConfig)) return true;
    const currentProbeKey = this.currentTelegramProbeKey(sessionConfig);
    return (
      this.state.telegramOnlyProbe === true &&
      currentProbeKey &&
      this._telegramOnlyProbeKey === currentProbeKey
    );
  }

  async probeTelegramSessionMeta() {
    const sessionSlug = this.resolveCurrentSessionSlug();
    const sessionConfig = this.resolveCurrentSessionConfig(sessionSlug);
    if (!sessionSlug || isTelegramOnlySessionConfig(sessionConfig)) return null;
    const trustedBridgeUrl = resolveTrustedTelegramAgentBridgeUrl(sessionConfig);
    const probeKey = `${trustedBridgeUrl}|${sessionSlug}`;

    const probeSeq = this._telegramMetaProbeSeq + 1;
    this._telegramMetaProbeSeq = probeSeq;
    this._telegramMetaProbeStartedKey = probeKey;
    const meta = await fetchTelegramSessionMeta({
      sessionSlug,
      agentBridgeUrl: trustedBridgeUrl,
    });
    if (probeSeq !== this._telegramMetaProbeSeq) return null;

    const telegramOnlyProbe = meta?.telegramOnly === true;
    this._telegramOnlyProbeKey = probeKey;
    this.setState({ telegramOnlyProbe }, () => {
      if (telegramOnlyProbe && !this.hasTelegramClientAuth(sessionSlug)) {
        this.restoreTelegramClientAuthFromStorage();
      }
    });
    return meta;
  }

  handleTelegramLoginInputChange(event: any) {
    this.setState({
      telegramLoginInput: event?.target?.value || '',
      telegramLoginError: '',
    });
  }

  async tryTelegramTokenLogin(inputValue: any = this.state.telegramLoginInput) {
    const copiedToken = extractTelegramSessionToken(inputValue || '');
    if (!copiedToken) {
      this.setState({
        telegramLoginStatus: 'error',
        telegramLoginError: 'Paste the token or copied message from the Telegram bot.',
      });
      return null;
    }
    const sessionSlug = this.resolveCurrentSessionSlug();
    const sessionConfig = this.resolveCurrentSessionConfig(sessionSlug);
    this.setState({ telegramLoginStatus: 'loading', telegramLoginError: '' });
    try {
      const login = await exchangeTelegramSessionToken({
        token: copiedToken,
        sessionSlug,
        agentBridgeUrl: resolveTelegramAgentBridgeUrl(sessionConfig),
      });
      this.setState({
        telegramLoginStatus: 'ready',
        telegramLoginError: '',
        telegramLoginInput: '',
        telegramClientAuth: {
          accountAddress: login.accountAddress,
          workerToken: login.workerToken || login.token,
          sessionSlug: login.sessionSlug || sessionSlug,
          workerUrl: login.workerUrl,
          exp: login.exp,
          buckets: login.buckets || null,
        },
        showTelegramTokenReentry: false,
      });
      removeTelegramLoginInputFromUrl();
      return login;
    } catch (error: any) {
      this.setState({
        telegramLoginStatus: 'error',
        telegramLoginError: isTelegramAgentTokenRefreshError(error)
          ? TELEGRAM_TOKEN_EXPIRED_OR_REVOKED_MESSAGE
          : getErrorMessage(error, 'Telegram login failed.'),
      });
      return null;
    }
  }

  async restoreTelegramClientAuthFromStorage() {
    const sessionSlug = this.resolveCurrentSessionSlug();
    if (!sessionSlug) return null;
    const sessionConfig = this.resolveCurrentSessionConfig(sessionSlug);
    if (!this.isTelegramOnlySession(sessionConfig)) return null;

    const cachedLogin = readTelegramWorkerLogin({ slug: sessionSlug });
    if (cachedLogin?.token) {
      this.setState({
        telegramLoginStatus: 'ready',
        telegramLoginError: '',
        telegramClientAuth: {
          accountAddress: cachedLogin.address,
          workerToken: cachedLogin.token,
          sessionSlug: cachedLogin.sessionSlug || sessionSlug,
          workerUrl: cachedLogin.workerUrl,
          exp: cachedLogin.exp,
          buckets: cachedLogin.buckets || null,
        },
      });
      return cachedLogin;
    }

    const credentials = getTelegramAgentBridgeCredentials({
      slug: sessionSlug,
      agentBridgeUrl: resolveTelegramAgentBridgeUrl(sessionConfig),
    });
    if (!credentials?.token) return null;
    this.setState({ telegramLoginStatus: 'loading', telegramLoginError: '' });
    try {
      const login = await exchangeTelegramSessionToken({
        token: credentials.token,
        sessionSlug,
        agentBridgeUrl: credentials.agentBridgeUrl,
      });
      this.setState({
        telegramLoginStatus: 'ready',
        telegramLoginError: '',
        telegramClientAuth: {
          accountAddress: login.accountAddress,
          workerToken: login.workerToken || login.token,
          sessionSlug: login.sessionSlug || sessionSlug,
          workerUrl: login.workerUrl,
          exp: login.exp,
          buckets: login.buckets || null,
        },
      });
      return login;
    } catch (error: any) {
      if (isTelegramAgentTokenRefreshError(error)) {
        this.setState({
          telegramLoginStatus: 'error',
          telegramLoginError: TELEGRAM_TOKEN_EXPIRED_OR_REVOKED_MESSAGE,
        });
      } else {
        this.setState({ telegramLoginStatus: 'idle' });
      }
      return null;
    }
  }

  handleTelegramLoginSubmit(event: any) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    this.tryTelegramTokenLogin();
  }

  async handleRefreshResultsClick(event: any) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    if (this.state.resultsRefreshing) return;
    this.setState({ resultsRefreshing: true });
    try {
      // Future auto-poll/SSE live-results would hook in here; manual refresh is intentional for now.
      if (this.isTelegramDataMode()) {
        await Promise.all([
          this.loadTelegramAgentQuestions(true),
          this.loadTelegramAgentResults(true),
        ]);
      } else {
        await this.props.refreshQuestionResponses?.(null, {
          slug: this.resolveCurrentSessionSlug(),
          forceFull: true,
        });
      }
    } catch (error) {
      demoLog.warn('OnePageSession: refresh results failed', error);
    } finally {
      if (!this._unmounted) this.setState({ resultsRefreshing: false });
    }
  }

  isTelegramDataMode(sessionConfig: any = this.resolveCurrentSessionConfig()) {
    return this.isTelegramOnlySession(sessionConfig) && this.hasTelegramClientAuth();
  }

  handleTelegramAgentAuthFailure() {
    this.setState({
      telegramLoginStatus: 'error',
      telegramLoginError: TELEGRAM_TOKEN_EXPIRED_OR_REVOKED_MESSAGE,
      showTelegramTokenReentry: true,
    });
  }

  async loadTelegramAgentQuestions(force: any = false) {
    if (!this.isTelegramDataMode()) return null;
    if (!force && this.state.telegramAgentQuestionsStatus !== 'idle') return null;
    const sessionSlug = this.resolveCurrentSessionSlug();
    const sessionConfig = this.resolveCurrentSessionConfig(sessionSlug);
    this.setState({ telegramAgentQuestionsStatus: 'loading' });
    const result = await loadTelegramQuestions({
      sessionSlug,
      agentBridgeUrl: resolveTrustedTelegramAgentBridgeUrl(sessionConfig),
    });
    if (this._unmounted || sessionSlug !== this.resolveCurrentSessionSlug()) return null;
    if (!result.ok) {
      if (isTelegramAgentAuthFailure(result)) this.handleTelegramAgentAuthFailure();
      this.setState({ telegramAgentQuestionsStatus: 'error' });
      return null;
    }
    const questions = result.questions || [];
    this.setState((prevState: any) => ({
      telegramAgentQuestionsStatus: 'ready',
      telegramAgentQuestions: questions,
      telegramAgentAnswerState: result.answerState || null,
      telegramQuestionPileIndex: Math.min(
        Math.max(0, Number(prevState.telegramQuestionPileIndex || 0)),
        Math.max(0, questions.length - 1)
      ),
    }));
    return result;
  }

  async loadTelegramAgentResults(force: any = false) {
    if (!this.isTelegramDataMode()) return null;
    if (!force && this.state.telegramAgentResultsStatus !== 'idle') return null;
    const sessionSlug = this.resolveCurrentSessionSlug();
    const sessionConfig = this.resolveCurrentSessionConfig(sessionSlug);
    this.setState({ telegramAgentResultsStatus: 'loading' });
    const result = await loadTelegramResultsDataset({
      sessionSlug,
      agentBridgeUrl: resolveTrustedTelegramAgentBridgeUrl(sessionConfig),
    });
    if (this._unmounted || sessionSlug !== this.resolveCurrentSessionSlug()) return null;
    if (!result.ok || !result.views) {
      if (isTelegramAgentAuthFailure(result)) this.handleTelegramAgentAuthFailure();
      this.setState({ telegramAgentResultsStatus: 'error' });
      return null;
    }
    const viewStates = Object.values(result.views);
    if (viewStates.length > 0 && viewStates.every((view: any) => view?.status === 'auth')) {
      this.handleTelegramAgentAuthFailure();
      this.setState({ telegramAgentResultsStatus: 'error' });
      return null;
    }
    this.setState((prevState: any) => ({
      telegramAgentResultsStatus: 'ready',
      telegramAgentResults: result.views,
      // New nonce per load so PolisReport re-keys its analysis cache on refresh.
      telegramPolisNonce: Number(prevState.telegramPolisNonce || 0) + 1,
    }));
    return result;
  }

  async handleTelegramQuestionSubmit(question: any, answer: any) {
    if (!question?.questionId || !this.isTelegramDataMode()) return null;
    const sessionSlug = this.resolveCurrentSessionSlug();
    const sessionConfig = this.resolveCurrentSessionConfig(sessionSlug);
    this.setState({
      telegramSubmittingQuestionId: question.questionId,
      telegramQuestionSubmitError: '',
    });
    const result = await submitTelegramAnswer({
      sessionSlug,
      agentBridgeUrl: resolveTrustedTelegramAgentBridgeUrl(sessionConfig),
      question,
      answer,
    });
    if (this._unmounted || sessionSlug !== this.resolveCurrentSessionSlug()) return result;
    if (!result.ok) {
      if (isTelegramAgentAuthFailure(result)) this.handleTelegramAgentAuthFailure();
      this.setState({
        telegramSubmittingQuestionId: '',
        telegramQuestionSubmitError: result.reason || 'Could not submit this answer.',
      });
      return result;
    }
    this.setState((prevState: any) => {
      const submitted = new Set(prevState.telegramSubmittedQuestionIds || []);
      submitted.add(question.questionId);
      return {
        telegramSubmittingQuestionId: '',
        telegramQuestionSubmitError: '',
        telegramSubmittedQuestionIds: Array.from(submitted),
        telegramAgentQuestions: (prevState.telegramAgentQuestions || []).map((entry: any) => (
          entry.questionId === question.questionId ? { ...entry, answeredByUser: true } : entry
        )),
        telegramAgentAnswerState: prevState.telegramAgentAnswerState ? {
          ...prevState.telegramAgentAnswerState,
          answeredCount: Number(prevState.telegramAgentAnswerState.answeredCount || 0) + (
            question.answeredByUser ? 0 : 1
          ),
          unansweredCount: Math.max(0, Number(prevState.telegramAgentAnswerState.unansweredCount || 0) - (
            question.answeredByUser ? 0 : 1
          )),
        } : prevState.telegramAgentAnswerState,
      };
    });
    void this.loadTelegramAgentQuestions(true);
    void this.loadTelegramAgentResults(true);
    return result;
  }

  renderTelegramTokenForm() {
    return (
      <form
        className={styles.telegramTokenLoginForm}
        onSubmit={this.handleTelegramLoginSubmit}
        data-testid="ce-session-telegram-token-login"
      >
        <label className={styles.telegramTokenLoginLabel} htmlFor="ce-session-telegram-token-input">
          Telegram bot token
        </label>
        <textarea
          id="ce-session-telegram-token-input"
          className={styles.telegramTokenLoginInput}
          value={this.state.telegramLoginInput}
          onChange={this.handleTelegramLoginInputChange}
          placeholder="Paste the token or the full copied bot message"
          rows={4}
          autoComplete="off"
          data-testid="ce-session-telegram-token-input"
        />
        {this.state.telegramLoginError ? (
          <div className={styles.telegramTokenLoginError} role="alert">
            {this.state.telegramLoginError}
          </div>
        ) : null}
        <button
          type="submit"
          className={styles.telegramTokenLoginButton}
          disabled={this.state.telegramLoginStatus === 'loading'}
          data-testid="ce-session-telegram-token-submit"
        >
          {this.state.telegramLoginStatus === 'loading' ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin />
              <span>Logging in...</span>
            </>
          ) : (
            <span>Log in with Telegram Token</span>
          )}
        </button>
      </form>
    );
  }

  buildTelegramTopicMapCodexPrompt() {
    const sessionSlug = this.resolveCurrentSessionSlug();
    const questions = (this.state.telegramAgentQuestions || []).map((question: any) => ({
      questionId: question.questionId,
      prompt: question.prompt,
      questionType: question.questionType,
      tags: question.tags || [],
    }));
    const views: any = this.state.telegramAgentResults || {};
    const pickReady = (key: string) => (views?.[key]?.status === 'ready' ? views[key].data : null);
    const consensus: any = pickReady('consensus');
    const difference: any = pickReady('difference');
    const groups: any = pickReady('groups');
    const polis: any = buildTelegramPolisDataset(views);
    const vectors: any = {};
    if (polis?.hasData && polis?.aggregator) {
      Object.entries(polis.aggregator).forEach(([questionIdValue, rows]: any) => {
        vectors[questionIdValue] = (Array.isArray(rows) ? rows : [])
          .map((row: any) => {
            try {
              return { p: row.responder, v: JSON.parse(row.response)?.answer?.value || '' };
            } catch (_) {
              return null;
            }
          })
          .filter(Boolean);
      });
    }
    const dataset = {
      sessionSlug,
      questions,
      consensus: consensus?.questions || [],
      difference: difference?.questions || [],
      groups: groups?.groups || [],
      vectors,
    };
    return [
      'You are Codex running inside the Context Engine worktree at',
      '/Users/charlie/Desktop/xoCortex/projects/context-engine/.codex/scratch/edge-2026',
      '',
      'Task: turn the telegram session dataset below into an opinion/topic map for the web client.',
      '',
      '1. Use ONLY the JSON dataset at the end of this prompt. Do not fetch anything, run no network calls, and never print tokens or secrets.',
      '2. Cluster the questions/opinions into 3-8 coherent topics. Use tags, consensus/difference scores, group themes, and the per-participant vectors (vectors[questionId] = [{p: participantAlias, v: Agree|Disagree|Unsure}]) to judge which opinions belong together and how contested each topic is.',
      `3. Write EXACTLY one file (create the directory if needed): client/public/telegram-topic-map/${sessionSlug}.json`,
      '   Schema (valid JSON, no comments, nothing else in the file):',
      '   {',
      `     "sessionSlug": "${sessionSlug}",`,
      '     "generatedAt": "<ISO 8601 timestamp>",',
      '     "topics": [',
      '       {',
      '         "id": "kebab-case-id",',
      '         "label": "Short topic name (max 4 words)",',
      '         "summary": "1-2 sentence neutral summary of the opinion landscape for this topic",',
      '         "size": <number of related questions/responses; drives bubble size>,',
      '         "agreement": <0 to 1 rough agreement level across participants>,',
      '         "items": ["related question or opinion statement", "..."]',
      '       }',
      '     ]',
      '   }',
      '4. Do not modify any other files.',
      '5. Reply with the file path and the topic count when done.',
      '',
      'DATASET:',
      JSON.stringify(dataset, null, 2),
    ].join('\n');
  }

  async handleCopyTopicMapPrompt() {
    const prompt = this.buildTelegramTopicMapCodexPrompt();
    let copied = false;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
        copied = true;
      }
    } catch (e) { demoLog.warn('OnePageSession: clipboard', e); }
    if (!copied && typeof document !== 'undefined') {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = prompt;
        document.body.appendChild(textarea);
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e) { demoLog.warn('OnePageSession: clipboard fallback', e); }
    }
    if (copied && !this._unmounted) {
      this.setState({ telegramTopicMapPromptCopied: true });
      if (this._topicMapCopiedTimer) clearTimeout(this._topicMapCopiedTimer);
      this._topicMapCopiedTimer = setTimeout(() => {
        if (!this._unmounted) this.setState({ telegramTopicMapPromptCopied: false });
      }, 2500);
    }
  }

  renderTelegramTopicMapSection() {
    return (
      <div className={styles.telegramTopicMapSection} data-testid="ce-session-telegram-topicmap-section">
        <div className={styles.telegramListHeader}>
          <span>Topic map (local) — generate with Codex in this worktree, then reload.</span>
          <span className={styles.telegramListHeaderActions}>
            <button
              type="button"
              className={styles.sectionHeaderActionButton}
              onClick={this.handleCopyTopicMapPrompt}
              data-testid="ce-session-telegram-topicmap-copy"
            >
              {this.state.telegramTopicMapPromptCopied ? 'Copied!' : 'Copy Codex prompt'}
            </button>
          </span>
        </div>
        <TelegramTopicMap sessionSlug={this.resolveCurrentSessionSlug()} />
      </div>
    );
  }

  renderTelegramQuestionsPanel({ compact = false }: any = {}) {
    const status = this.state.telegramAgentQuestionsStatus;
    const questions = this.state.telegramAgentQuestions || [];
    const answerState = this.state.telegramAgentAnswerState;
    const activeIndex = Math.min(
      Math.max(0, Number(this.state.telegramQuestionPileIndex || 0)),
      Math.max(0, questions.length - 1)
    );
    const setActiveIndex = (nextIndex: number) => {
      this.setState({
        telegramQuestionPileIndex: Math.min(
          Math.max(0, nextIndex),
          Math.max(0, questions.length - 1)
        ),
      });
    };
    return (
      <TelegramQuestionPile
        answerState={answerState}
        compact={compact}
        questions={questions}
        activeIndex={activeIndex}
        status={status}
        submittedQuestionIds={new Set(this.state.telegramSubmittedQuestionIds || [])}
        submittingQuestionId={this.state.telegramSubmittingQuestionId}
        submitError={this.state.telegramQuestionSubmitError}
        onActiveIndexChange={setActiveIndex}
        onRefresh={() => { void this.loadTelegramAgentQuestions(true); }}
        onSubmitAnswer={this.handleTelegramQuestionSubmit}
        onViewAll={this.handleViewAllQuestionsClick}
      />
    );
  }

  renderTelegramBucketsPanel() {
    const cards = normalizeTelegramBucketCards(this.state.telegramClientAuth?.buckets);
    const localSelections: any = this.state.telegramBucketLocalSelections || {};
    return (
      <div className={styles.telegramListPanel} data-testid="ce-session-telegram-buckets">
        {cards.length === 0 ? (
          <div className={styles.telegramListEmpty}>No research buckets linked yet.</div>
        ) : (
          <div className={sbtListStyles.standardBase}>
            {cards.map((card: any) => {
              const selectedOptions = card.options.filter((option: any) => option.selected);
              const selectValue = localSelections[card.categoryId] ?? (selectedOptions[0]?.optionId || '');
              const selectedLabel = selectedOptions.map((option: any) => option.label).filter(Boolean).join(', ');
              const bucketModel = {
                description: selectedLabel || 'Optional research bucket for aggregate filtering.',
                imageSrc: null,
                key: `telegram-bucket-${card.categoryId}`,
                locked: false,
                name: card.categoryLabel,
                sbtAddress: `telegram-bucket-${card.categoryId}`,
                sbtAddressLower: `telegram-bucket-${card.categoryId}`.toLowerCase(),
                sessionSlug: this.resolveCurrentSessionSlug(),
              };
              const bucketDetails = (
                <div data-testid={`ce-session-telegram-bucket-${card.categoryId}`}>
                  {/* Local-only dropdown; bucket changes still happen via the Telegram bot. */}
                  <select
                    className={styles.telegramBucketSelect}
                    value={selectValue}
                    onChange={(event: any) => {
                      const nextValue = event?.target?.value || '';
                      this.setState((prevState: any) => ({
                        telegramBucketLocalSelections: {
                          ...(prevState.telegramBucketLocalSelections || {}),
                          [card.categoryId]: nextValue,
                        },
                      }));
                    }}
                    aria-label={`${card.categoryLabel} bucket option`}
                    data-testid="ce-session-telegram-bucket-select"
                  >
                    <option value="">Select an option</option>
                    {card.options.map((option: any) => (
                      <option key={option.optionId} value={option.optionId}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {selectedOptions.length > 0 ? (
                    <div className={styles.telegramChipRow}>
                      {selectedOptions.map((option: any) => (
                        <span
                          key={option.optionId}
                          className={`${styles.telegramChipDark} ${styles.telegramChipDarkSelected}`.trim()}
                        >
                          {option.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
              return (
                <SbtListStandardCard
                  key={bucketModel.key}
                  detailsPanel={bucketDetails}
                  href="#"
                  isExpanded={true}
                  model={bucketModel}
                  onClick={(event) => event.preventDefault()}
                  sbtLabel="research bucket"
                  shellClassName={`${sbtListStyles.standardCardShell} ${sbtListStyles.standardCardShellExpanded || ''}`.trim()}
                  styles={sbtListStyles}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  renderTelegramResultsSubsection(title: any, view: any, renderBody: any) {
    if (!view) return null;
    return (
      <div className={styles.telegramResultsSection}>
        <div className={styles.telegramResultsHeading}>{title}</div>
        {view.status === 'disabled' ? (
          <div className={styles.telegramPanelEmpty}>Not enabled for this session.</div>
        ) : view.status === 'error' || view.status === 'auth' ? (
          <div className={styles.telegramPanelEmpty}>Unavailable right now.</div>
        ) : renderBody(view.data || {})}
      </div>
    );
  }

  renderTelegramResultsPanel() {
    const status = this.state.telegramAgentResultsStatus;
    const views: any = this.state.telegramAgentResults || null;
    const polisData: any = views ? buildTelegramPolisDataset(views) : null;
    if (polisData?.hasData) {
      // Render the real PolisReport from worker vectors or aggregate-derived
      // approximations so telegram sessions get the same report UI as on-chain sessions.
      const auth: any = this.state.telegramClientAuth || {};
      return (
        <div data-testid="ce-session-telegram-results">
          {polisData.synthesized ? (
            <div
              className={styles.telegramReportApprox}
              data-testid="ce-session-telegram-report-approx"
            >
              Approximate view — rebuilt from aggregate results.
            </div>
          ) : null}
          <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
            <PolisReport
              onePageDemo={true}
              miniMode={true}
              account={auth.accountAddress || this.props.account}
              provider={this.props.provider}
              network={this.props.network}
              loginComplete={true}
              questionResponses={polisData.aggregator}
              disclaimersActive={this.state.disclaimersActive}
              filterState={this.state.filterState}
              sessionName={this.props.sessionName}
              sessionHeader={this.props.sessionHeader}
              sessionInfo={this.props.sessionInfo}
              defaultTags={this.props.defaultTags}
              isQuestionCacheReady={true}
              isResponsesCacheReady={true}
              questionScanProgress={null}
              questionResponsesNonce={this.state.telegramPolisNonce}
              sessionSlug={this.resolveCurrentSessionSlug()}
              demoDataBySlug={null}
              contracts={this.props.contracts || {}}
              blockLimits={this.props.blockLimits || { start: null, end: null }}
              networkChainId={this.props.networkChainId}
            />
          </Suspense>
        </div>
      );
    }
    const renderAggregateRows = (data: any) => (
      (data.questions || []).length === 0 ? (
        <div className={styles.telegramPanelEmpty}>Not enough responses yet.</div>
      ) : (
        <div>
          {(data.questions || []).slice(0, 6).map((row: any, index: number) => (
            <div key={`${row.prompt}-${index}`} className={styles.telegramResultRow}>
              <div className={styles.telegramQuestionPrompt}>{row.prompt}</div>
              <div className={styles.telegramQuestionMeta}>
                <span className={styles.telegramPanelMeta}>{row.total} responses</span>
                {(row.counts || []).slice(0, 4).map((count: any) => (
                  <span key={count.label} className={styles.telegramTagChip}>
                    {count.label}: {count.count}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )
    );
    return (
      <div className={styles.telegramPanel} data-testid="ce-session-telegram-results">
        {status === 'loading' && !views ? (
          <div className={styles.telegramPanelEmpty}>
            <FontAwesomeIcon icon={faSpinner} spin /> Loading results...
          </div>
        ) : null}
        {status === 'error' && !views ? (
          <div className={styles.telegramPanelError} role="alert">
            Could not load results from the session worker.
          </div>
        ) : null}
        {views ? (
          <>
            {views.consensus?.status === 'ready' ? (
              <div className={styles.telegramPanelMeta} data-testid="ce-session-telegram-results-summary">
                {(views.consensus.data || {}).questionCount || 0} questions · {(views.consensus.data || {}).responseCount || 0} responses
              </div>
            ) : null}
            {this.renderTelegramResultsSubsection('Consensus', views.consensus, renderAggregateRows)}
            {this.renderTelegramResultsSubsection('Differences', views.difference, renderAggregateRows)}
            {this.renderTelegramResultsSubsection('Groups', views.groups, (data: any) => (
              (data.groups || []).length === 0 ? (
                <div className={styles.telegramPanelEmpty}>No groups large enough to show yet.</div>
              ) : (
                <div className={styles.telegramGroupGrid}>
                  {(data.groups || []).map((group: any, index: number) => (
                    <div key={group.groupId || `${group.label}-${index}`} className={styles.telegramBucketCard}>
                      <div className={styles.telegramBucketCategory}>{group.label || 'Group'}</div>
                      {group.theme ? <div className={styles.telegramPanelMeta}>{group.theme}</div> : null}
                      <div className={styles.telegramPanelMeta}>{group.size} participants</div>
                      {(group.topStatements || []).slice(0, 3).map((statement: any, statementIndex: number) => (
                        <div key={`${statement.prompt}-${statementIndex}`} className={styles.telegramQuestionPrompt}>
                          {statement.prompt}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )
            ))}
            {this.renderTelegramResultsSubsection('Topic map', views.topicMap, (data: any) => (
              data.available !== true ? (
                <div className={styles.telegramPanelEmpty}>Topic map not available yet.</div>
              ) : (
                <div className={styles.telegramQuestionMeta}>
                  {Object.entries(data.counts || {}).map(([key, value]: any) => (
                    <span key={key} className={styles.telegramTagChip}>{key}: {value}</span>
                  ))}
                </div>
              )
            ))}
          </>
        ) : null}
      </div>
    );
  }



  componentDidMount() {
    const routeUiState = resolveOnePageSessionRouteUiState(this.props);
    this.recordOriginalURL(routeUiState.showQuestions
      ? buildOnePageSessionCanonicalBaseUrl(this.props)
      : null);
    this.kickoffLightSbtUniverseScan(this.props);

    // Make redirect flag group-aware (avoid cross-group bleed)
    try {
      const slug = resolveEffectiveSlug(this.props);
      sessionStorage.setItem(`dg:hasRedirectedToDemo:${slug}`, 'true');
    } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

    // Persist any incoming auto-mint params so they survive Web3Auth redirect cycles
    try {
      const currentSearch =
        typeof window !== 'undefined' ? (window.location.search || '') : '';
      const hasAutoFlag = () => {
        try {
          const raw = currentSearch.replace(/^\?/, '');
          const params = new URLSearchParams(raw);
          if (params.get('auto') === '1') return true;
          for (const key of params.keys()) {
            if (/^auto\d+$/.test(key) && params.get(key) === '1') return true;
          }
        } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
        return false;
      };
      if (currentSearch && hasAutoFlag()) {
        sessionStorage.setItem(this.getAutoHashStorageKey(), currentSearch.replace(/^\?/, ''));
      }
    } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

    // Fragment-driven auto mint (both limited/unlimited)
    const targets = this.parseAutoMintFragment();
    if (targets.length > 0) {
      this.primeAutoMintTargets(targets);
    }

    window.addEventListener('sbt-mint-success', this.onSbtMintSuccess);

    // Auto-open Groups section if a Create-SBT cache exists (idempotent, group-aware)
    try {
      const slug = resolveEffectiveSlug(this.props);
      if (hasCachedCreateSbtForm(slug) && !this._autoOpenedGroups) {
        this.setState({ showGroups: true });
        this._autoOpenedGroups = true;
      }
    } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

    this._aggregatorInputSig = this.buildAggregatorInputSignature(this.props, this.state);
    if (this.state.telegramLoginInput) {
      removeTelegramLoginInputFromUrl();
      this.tryTelegramTokenLogin(this.state.telegramLoginInput);
    } else {
      this.restoreTelegramClientAuthFromStorage();
    }
    this.probeTelegramSessionMeta();
  }



  componentWillUnmount() {
    this._unmounted = true;
    this._telegramMetaProbeSeq += 1;
    this._telegramOnlyProbeKey = '';
    this._telegramMetaProbeStartedKey = '';
    if (this._topicMapCopiedTimer) {
      clearTimeout(this._topicMapCopiedTimer);
      this._topicMapCopiedTimer = null;
    }
    if (this._autoOpenResultsTimer) {
      clearTimeout(this._autoOpenResultsTimer);
      this._autoOpenResultsTimer = null;
    }
    if (this._autoMintCountdownTimer) {
      clearInterval(this._autoMintCountdownTimer);
      this._autoMintCountdownTimer = null;
    }
    if (this._buildAggregatorTimer) {
      clearTimeout(this._buildAggregatorTimer);
      this._buildAggregatorTimer = null;
    }
    this._scheduledAggregatorSig = '';
    this._aggregatorSourceSigKey = '';
    if (this._aggregatorResponseParseMemo) this._aggregatorResponseParseMemo.clear();
    window.removeEventListener('sbt-mint-success', this.onSbtMintSuccess);
  }

  buildAggregatorInputSignature(propsIn: any = this.props, stateIn: any = this.state) {
    const props = propsIn || {};
    const state = stateIn || {};
    const slug = resolveEffectiveSlug(props);
    const netId = props.network?.id ?? props.networkChainId ?? '';
    return [
      String(slug || ''),
      String(netId || ''),
      state.showResults ? 1 : 0,
      props.isQuestionCacheReady ? 1 : 0,
      props.isResponsesCacheReady ? 1 : 0,
      Number(props.questionResponsesNonce || 0),
    ].join('|');
  }

  getResolvedSessionConfig({
    slug,
    sessionName,
    questionsGenPrompt,
    autoFeatureSBTsBySessionSlug,
    autoFeatureSBTsWithFeaturedSbtTags,
    incomingSessionConfig,
    contracts,
  }: any) {
    const baseSessionConfig = (
      incomingSessionConfig && typeof incomingSessionConfig === 'object'
    ) ? incomingSessionConfig : {};

    const prevInputs = this._resolvedSessionConfigMemoInputs;
    if (
      prevInputs &&
      prevInputs.slug === slug &&
      prevInputs.sessionName === sessionName &&
      prevInputs.questionsGenPrompt === questionsGenPrompt &&
      prevInputs.autoFeatureSBTsBySessionSlug === autoFeatureSBTsBySessionSlug &&
      prevInputs.autoFeatureSBTsWithFeaturedSbtTags === autoFeatureSBTsWithFeaturedSbtTags &&
      prevInputs.baseSessionConfig === baseSessionConfig &&
      prevInputs.contracts === contracts
    ) {
      return this._resolvedSessionConfigMemoValue;
    }

    const propAutoFeature = autoFeatureSBTsBySessionSlug !== undefined
      ? autoFeatureSBTsBySessionSlug
      : autoFeatureSBTsWithFeaturedSbtTags;
    const resolvedAutoFeature = propAutoFeature !== undefined
      ? propAutoFeature
      : resolveAutoFeatureBySessionSlug(baseSessionConfig);
    const resolvedSlug = slug || baseSessionConfig.slug || '';
    const resolved = {
      ...baseSessionConfig,
      slug: resolvedSlug,
      sessionName,
      questionsGenPrompt,
      contracts: (contracts && typeof contracts === 'object')
        ? contracts
        : (baseSessionConfig.contracts || {}),
    };
    if (resolvedAutoFeature !== undefined) {
      resolved.autoFeatureSBTsBySessionSlug = resolvedAutoFeature;
    }

    this._resolvedSessionConfigMemoInputs = {
      slug,
      sessionName,
      questionsGenPrompt,
      autoFeatureSBTsBySessionSlug,
      autoFeatureSBTsWithFeaturedSbtTags,
      baseSessionConfig,
      contracts,
    };
    this._resolvedSessionConfigMemoValue = resolved;
    return resolved;
  }

  resolveScopedLitHooks(sessionConfig: any = {}) {
    if (this.props.litHooks && typeof this.props.litHooks === 'object') {
      return this.props.litHooks;
    }
    const {
      chainId,
      litNetwork,
      litChain,
      accessControlConditions,
      userMaxPrice,
      chipotle,
    } = resolveMainSiteLitSessionConfig({
      sessionConfig,
      networkChainIdFallback: (
        this.props.networkChainId ||
        this.props.network?.id ||
        this.props.network?.chainId ||
        null
      ),
    });
    if (!chipotle) return null;
    const sessionSlug = normalizeOnePageSessionSlug(sessionConfig?.slug || this.props.slug || '');
    return createLitHooks({
      providerLike: this.props.provider,
      account: this.props.account,
      chainId,
      litChain,
      litNetwork,
      userMaxPrice,
      accessControlConditions: accessControlConditions || undefined,
      chipotle: {
        ...chipotle,
        sessionSlug,
      },
    });
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    const prevSlug = normalizeOnePageSessionSlug(prevProps.slug || prevProps.sessionConfig?.slug || '');
    const nextSlug = normalizeOnePageSessionSlug(this.props.slug || this.props.sessionConfig?.slug || '');
    const slugChanged = prevSlug !== nextSlug;
    if (slugChanged) {
      this._telegramMetaProbeSeq += 1;
      this._telegramOnlyProbeKey = '';
      this._telegramMetaProbeStartedKey = '';
      this.setState({
        telegramOnlyProbe: null,
        showTelegramTokenReentry: false,
        telegramAgentQuestionsStatus: 'idle',
        telegramAgentQuestions: [],
        telegramAgentAnswerState: null,
        telegramQuestionPileIndex: 0,
        telegramAgentResultsStatus: 'idle',
        telegramAgentResults: null,
      });
    }
    const currentSessionConfig = this.resolveCurrentSessionConfig();
    const currentProbeKey = this.currentTelegramProbeKey(currentSessionConfig);
    if (
      currentProbeKey &&
      !isTelegramOnlySessionConfig(currentSessionConfig) &&
      currentProbeKey !== this._telegramOnlyProbeKey &&
      currentProbeKey !== this._telegramMetaProbeStartedKey
    ) {
      this.probeTelegramSessionMeta();
    }
    if (!slugChanged && this.isTelegramDataMode(currentSessionConfig)) {
      if (this.state.telegramAgentQuestionsStatus === 'idle') {
        void this.loadTelegramAgentQuestions();
      }
      if (this.state.showResults && this.state.telegramAgentResultsStatus === 'idle') {
        void this.loadTelegramAgentResults();
      }
    }
    const prevRouteUiState = resolveOnePageSessionRouteUiState(prevProps);
    const nextRouteUiState = resolveOnePageSessionRouteUiState(this.props);
    const routeUiPatch: Record<string, any> = {};
    if (
      prevRouteUiState.showQuestions !== nextRouteUiState.showQuestions &&
      this.state.showQuestions !== nextRouteUiState.showQuestions
    ) {
      routeUiPatch.showQuestions = nextRouteUiState.showQuestions;
    }
    if (
      prevRouteUiState.autoOpenResults !== nextRouteUiState.autoOpenResults &&
      this.state.autoOpenResults !== nextRouteUiState.autoOpenResults
    ) {
      routeUiPatch.autoOpenResults = nextRouteUiState.autoOpenResults;
    }
    if (Object.keys(routeUiPatch).length > 0) {
      this.recordOriginalURL(buildOnePageSessionCanonicalBaseUrl(this.props));
      this.setState(routeUiPatch);
      return;
    }
    const prevDefaultSig =
      typeof this._lastDefaultFilterStateSignature === 'string'
        ? this._lastDefaultFilterStateSignature
        : serializeOnePageSessionFilterState(
          normalizeOnePageSessionFilterState(prevProps.defaultFilterState || {})
        );
    const nextDefaultFilterState = normalizeOnePageSessionFilterState(this.props.defaultFilterState || {});
    const nextDefaultSig = serializeOnePageSessionFilterState(nextDefaultFilterState);
    const currentFilterSig = serializeOnePageSessionFilterState(this.state.filterState || {});
    const defaultFilterChanged = prevDefaultSig !== nextDefaultSig;
    const shouldResyncFromDefault = (
      (slugChanged || defaultFilterChanged) &&
      (slugChanged || currentFilterSig === prevDefaultSig) &&
      currentFilterSig !== nextDefaultSig
    );
    if (
      slugChanged ||
      (
        typeof prevProps.ensureLightSbtUniverse !== 'function' &&
        typeof this.props.ensureLightSbtUniverse === 'function'
      )
    ) {
      this.kickoffLightSbtUniverseScan(this.props);
    }
    this._lastDefaultFilterStateSignature = nextDefaultSig;
    // Cancel any in-progress auto-mint countdown when session slug changes
    if (slugChanged && this._autoMintCountdownTimer) {
      clearInterval(this._autoMintCountdownTimer);
      this._autoMintCountdownTimer = null;
      this.setState({ autoMintCountdown: null, autoMintingMode: false });
    }
    const loginJustCompleted = !prevProps.loginComplete && this.props.loginComplete;
    const runLoginTransitionAutoMint = () => {
      if (!loginJustCompleted) return false;
      if ((this.state.autoMintTargets || []).length === 0 && this.hasAutoMintIntent()) {
        const retryTargets = this.parseAutoMintFragment();
        if (retryTargets.length > 0) {
          this.primeAutoMintTargets(retryTargets);
          return true;
        }
      }
      this.kickoffAutoMintIfNeeded();
      return false;
    };

    const showResultsOpened = !prevState.showResults && this.state.showResults;
    const showResultsVisible = !!this.state.showResults;
    const aggregatorInvalidated = (
      slugChanged ||
      (this.props.isQuestionCacheReady && !prevProps.isQuestionCacheReady) ||
      (this.props.network.id !== prevProps.network.id) ||
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce ||
      (
        prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
        this.props.isResponsesCacheReady
      )
    );

    const maybeScheduleAggregatorRebuild = () => {
      if (!(showResultsOpened || (showResultsVisible && aggregatorInvalidated))) return;
      const nextSig = this.buildAggregatorInputSignature(this.props, this.state);
      const shouldSchedule = showResultsOpened || this._aggregatorInputSig !== nextSig;
      if (shouldSchedule) {
        this._aggregatorInputSig = nextSig;
        this.scheduleBuildAggregator(100, nextSig);
      } else {
        bumpPerfCounter('noopSkips');
      }
    };

    if (shouldResyncFromDefault) {
      this.setState({ filterState: nextDefaultFilterState });
      maybeScheduleAggregatorRebuild();
      runLoginTransitionAutoMint();
      return;
    }

    maybeScheduleAggregatorRebuild();

    // Start automint right after login
    if (runLoginTransitionAutoMint()) {
      return;
    }

    // Reset dismissal flags when banners re-appear (batched)
    const bannerResetPatch: Record<string, any> = {};
    if (
      !prevState.autoMintingMode &&
      this.state.autoMintingMode &&
      this.state.dismissedAutoMintingBanner
    ) {
      bannerResetPatch.dismissedAutoMintingBanner = false;
    }
    if (
      !prevState.needsLoginForAutoMint &&
      this.state.needsLoginForAutoMint &&
      this.state.dismissedLoginBanner
    ) {
      bannerResetPatch.dismissedLoginBanner = false;
    }
    if (Object.keys(bannerResetPatch).length > 0) {
      this.setState(bannerResetPatch);
    }

    if ((this.state.autoMintTargets || []).length === 0 && this.hasAutoMintIntent()) {
      const retryTargets = this.parseAutoMintFragment();
      if (retryTargets.length > 0) {
        this.primeAutoMintTargets(retryTargets);
      }
    }
  }

  scheduleBuildAggregator(delayMs: any = 100, inputSig: any = this.buildAggregatorInputSignature(this.props, this.state)) {
    if (!this.state.showResults) return;
    const nextSig = String(inputSig || '');
    const waitMs = Math.max(0, Number(delayMs) || 0);
    if (this._buildAggregatorTimer) {
      if (this._scheduledAggregatorSig === nextSig) {
        bumpPerfCounter('noopSkips');
        return;
      }
      clearTimeout(this._buildAggregatorTimer);
    }
    this._scheduledAggregatorSig = nextSig;
    this._buildAggregatorTimer = setTimeout(() => {
      this._buildAggregatorTimer = null;
      const scheduledSig = this._scheduledAggregatorSig;
      this._scheduledAggregatorSig = '';
      if (scheduledSig && scheduledSig === this._lastBuiltAggregatorInputSig) {
        bumpPerfCounter('noopSkips');
        return;
      }
      if (!this.state.showResults) {
        bumpPerfCounter('noopSkips');
        return;
      }
      this._lastBuiltAggregatorInputSig = scheduledSig || '';
      this.buildAggregator();
    }, waitMs);
  }


  getAutoHashStorageKey() {
    const slug = resolveEffectiveSlug(this.props); // '' for general
    // migrate legacy → dg: prefix
    const newKey = `dg:autoHash:${slug}`;
    const legacy = `demo:autoHash:${slug}`;
    try {
      const legacyVal = sessionStorage.getItem(legacy);
      if (legacyVal && !sessionStorage.getItem(newKey)) {
        sessionStorage.setItem(newKey, legacyVal);
        sessionStorage.removeItem(legacy);
      }
    } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
    return newKey;
  }

  getAutoMintAttemptStorageKey(sbtAddress: any, account: any = this.props.account) {
    const normalized = String(sbtAddress || '').trim().toLowerCase();
    const accountLower = String(account || '').trim().toLowerCase();
    const chainId = Number(
      this.props.sessionConfig?.networkChainId ||
      this.props.networkChainId ||
      this.props.network?.id ||
      this.props.network?.chainId ||
      0
    ) || 0;
    return normalized && accountLower
      ? `autoMint:${accountLower}:${chainId || 'unknown'}:${normalized}`
      : '';
  }

  hasConsumedAutoMintAttempt(sbtAddress: any, account: any = this.props.account) {
    try {
      const key = this.getAutoMintAttemptStorageKey(sbtAddress, account);
      if (!key) return false;
      return sessionStorage.getItem(key) === 'done';
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
      return false;
    }
  }

  consumeAutoMintAttempt(sbtAddress: any, account: any = this.props.account) {
    try {
      const key = this.getAutoMintAttemptStorageKey(sbtAddress, account);
      if (!key) return;
      sessionStorage.setItem(key, 'done');
    } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
  }

  filterUnconsumedAutoMintTargets(targets: any = [], account: any = this.props.account) {
    return (Array.isArray(targets) ? targets : []).filter((target: any) => (
      !this.hasConsumedAutoMintAttempt(target?.sbt, account)
    ));
  }


  buildAggregator = () => measureSync('ce.onePageDemo.buildAggregator', () => {
    if (!this.state.showResults) return;
    bumpPerfCounter('aggregatorBuildCount');
    const applyAggregatorData = (nextMap: any, providedSig: any = '', sourceSigKey: any = '') => {
      const sig = providedSig || computeAggregatorDataSignature(nextMap);
      if (sourceSigKey) {
        this._aggregatorSourceSigKey = sourceSigKey;
      }
      if (sig === this._aggregatorDataSig) {
        bumpPerfCounter('noopSkips');
        return;
      }
      this._aggregatorDataSig = sig;
      this.setState({ aggregatorData: nextMap });
    };

    const slug = resolveEffectiveSlug(this.props);
    const netIdVal = this.props.network?.id ?? this.props.networkChainId ?? 0;

    if (this.props.isQuestionCacheReady && netIdVal != null) {
      const netIdStr = String(netIdVal);
      try {
        let qCache = peekCacheSync('questionsCache', slug, { clone: false }) || {};
        if (!qCache || typeof qCache !== 'object') qCache = {};
        if (Object.keys(qCache).length === 0) {
          applyAggregatorData({}, '0:0:0', `${slug}|${netIdStr}|empty-cache`);
          return;
        }

        if (!qCache[netIdStr]) {
          applyAggregatorData({}, '0:0:0', `${slug}|${netIdStr}|missing-net`);
          return;
        }

        const sourceSig = [
          computeAggregatorSourceSnapshotSignature(qCache[netIdStr]?.questionResponses || {}),
          computeAggregatorQuestionMetadataSignature(qCache[netIdStr]?.questions || {}),
        ].join('|');
        const sourceSigKey = `${slug}|${netIdStr}|${sourceSig}`;
        if (sourceSigKey === this._aggregatorSourceSigKey) {
          bumpPerfCounter('aggregatorSourceSkips');
          return;
        }

        const { map, dirty, signature } = buildAggregatorFromLocalCache(qCache[netIdStr], {
          parseMemo: this._aggregatorResponseParseMemo,
          sessionSlug: slug,
        });
        if (dirty) { void writeCache('questionsCache', slug, qCache); }
        applyAggregatorData(map, signature, sourceSigKey);
      } catch (err) {
        demoLog.error("Error building aggregator in OnePageSession:", err);
        applyAggregatorData({}, '0:0:0', `${slug}|${netIdStr}|error`);
      }
    } else {
      const netIdStr = String(netIdVal || '');
      applyAggregatorData({}, '0:0:0', `${slug}|${netIdStr}|not-ready`);
    }
  });


  onSbtMintSuccess(eventOrSbtAddress: any = null) {
    const successfulSbtAddress = (
      typeof eventOrSbtAddress === 'string'
        ? eventOrSbtAddress
        : eventOrSbtAddress?.detail?.sbtAddress
    );
    const successfulSbtKey = String(successfulSbtAddress || '').trim().toLowerCase();

    // Auto-close login modal and surface success state
    if (typeof this.props.toggleLoginModal === 'function') {
      try { this.props.toggleLoginModal(false); } catch (e) { demoLog.warn('OnePageSession: callback', e); }
    }
    this.setState((prevState: Readonly<OnePageSession['state']>) => {
      const prevTargets = Array.isArray(prevState.autoMintTargets) ? prevState.autoMintTargets : [];
      const nextTargets = successfulSbtKey
        ? prevTargets.filter((target: any) => String(target?.sbt || '').trim().toLowerCase() !== successfulSbtKey)
        : prevTargets;
      const autoMintComplete = nextTargets.length === 0;
      return {
        autoMintingMode: false,
        mintSuccess: autoMintComplete,
        autoMintTargets: nextTargets,
      };
    }, () => {
      if ((this.state.autoMintTargets || []).length > 0) return;

      // Clear persisted auto-mint intent to prevent re-trigger on refresh
      try { sessionStorage.removeItem(this.getAutoHashStorageKey()); } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

      // --- NEW: Clear URL hash to remove the 'intent' from the browser address bar ---
      try {
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          const url = new URL(window.location.href);
          const params = url.searchParams;
          url.hash = '';

          if (params.get('auto') === '1') {
            params.delete('auto');
            params.delete('sbt');
            params.delete('gp');
            params.delete('inv');
            Array.from(params.keys()).forEach((k: any) => {
              if (/^(sbt|gp|inv|auto)\d+$/.test(k)) params.delete(k);
            });
          }

          const qs = params.toString();
          const cleanUrl = url.pathname + (qs ? `?${qs}` : '');
          window.history.replaceState(null, '', cleanUrl);
        }
      } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
    });
  }

  recordOriginalURL(urlIn: any = null) {
    if (this.originalURL || typeof window === 'undefined') return;
    const nextUrl = (
      typeof urlIn === 'string' && urlIn
        ? urlIn
        : `${window.location.pathname || ''}${window.location.search || ''}`
    );
    this.originalURL = nextUrl || '';
  }


  /* =======================
      * Helpers: prefetch names for banner
      * ======================= */
    async prefetchTargetNames(targets: any) {
      const slug = resolveEffectiveSlug(this.props);

      // 1. Try to read from cache first to save RPC calls
      let cachedNames: Record<string, any> = {};
      let cachedImages: Record<string, any> = {};
      try {
        const parsed = peekCacheSync('sbtCache', slug, { clone: false });
        if (parsed && typeof parsed === 'object') {

          // Determine network key if available, else null
          const netId = this.props.network?.id || this.props.networkChainId;
          const netKey = netId ? String(netId) : null;

          // Helper to extract name from a specific network node
          const getNameFromNet = (nKey: any) => {
            const list = parsed[nKey]?.sbtList || {};
            for (const t of targets) {
              const addr = (t?.sbt || '').toLowerCase();
              if (!addr) continue;
              if (cachedNames[addr]) continue; // already found
              const entry = list[addr];
              const displayName = getSbtDisplayName(entry?.sbtInfo || null);
              if (displayName) {
                cachedNames[addr] = displayName;
              }
              if (entry?.sbtInfo?.image && !cachedImages[addr]) {
                cachedImages[addr] = entry.sbtInfo.image;
              }
            }
          };

          // A. If we know the network, check it first
          if (netKey && parsed[netKey]) {
            getNameFromNet(netKey);
          }

          // B. Iterate ALL keys to find any missing names.
          // This ensures we find the SBT name even if the wallet isn't connected yet
          // or if the cached data resides under a different chain ID key.
          Object.keys(parsed).forEach((k: any) => {
            if (k !== netKey) getNameFromNet(k);
          });
        }
      } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

      // Set immediate cache hits to UI
      if (Object.keys(cachedNames).length > 0 || Object.keys(cachedImages).length > 0) {
        this.setState((prev: Readonly<OnePageSession['state']>) => {
          const updates: Record<string, any> = {};
          if (Object.keys(cachedNames).length > 0) {
            updates.sbtNames = { ...(prev.sbtNames || {}), ...cachedNames };
          }
          if (Object.keys(cachedImages).length > 0) {
            updates.sbtImages = { ...(prev.sbtImages || {}), ...cachedImages };
          }
          return updates;
        });
      }

      // 2. Fetch missing names via RPC
      try {
        const existing = { ...(this.state.sbtNames || {}), ...cachedNames };
        const fetchedNames: Record<string, any> = {};
        const fetchedImages: Record<string, any> = {};
        for (const t of targets) {
          const addr = (t?.sbt || '').toLowerCase();
          if (!addr || existing[addr]) continue;
          let info: any = null;
          try {
            // Use internal read provider ('none' resolves to read-only)
            info = await contractScriptsAny.getSbtMetadata('none', addr, slug);
          } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
          const name = getSbtDisplayName(info) || `Group ${addr.slice(0,6)}...`;
          fetchedNames[addr] = name;
          if (info?.image) {
            fetchedImages[addr] = info.image;
          }
          existing[addr] = name;
        }

        if (Object.keys(fetchedNames).length > 0 || Object.keys(fetchedImages).length > 0) {
          this.setState((prev: Readonly<OnePageSession['state']>) => {
            const updates: Record<string, any> = {};
            if (Object.keys(fetchedNames).length > 0) {
              updates.sbtNames = { ...(prev.sbtNames || {}), ...fetchedNames };
            }
            if (Object.keys(fetchedImages).length > 0) {
              updates.sbtImages = { ...(prev.sbtImages || {}), ...fetchedImages };
            }
            return updates;
          });
        }
      } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
    }


  normalizeInviteCode(raw: any) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('inv:')) return trimmed.slice(4).trim();
    if (lower.startsWith('invite:')) return trimmed.slice(7).trim();
    return trimmed;
  }

  decodeInviteInput(raw: any) {
    const normalized = this.normalizeInviteCode(raw);
    if (!normalized) return null;
    const payload = cryptoUtils.decodeInvite(normalized);
    if (!payload) return null;
    return { ...payload, inviteCode: normalized };
  }



  /* =======================
   * Auto-mint logic
   * ======================= */

  parseAutoMintFragment() {
    // Prefer the current URL query; if missing/overwritten by auth, fall back to sessionStorage
    let sourceQuery = '';
    try {
      const currentSearch = (typeof window !== 'undefined' && window.location.search) ? window.location.search : '';
      sourceQuery = currentSearch || '';
      if (!sourceQuery || (!sourceQuery.includes('gp') && !sourceQuery.includes('inv') && !sourceQuery.includes('sbt'))) {
        const saved = sessionStorage.getItem(this.getAutoHashStorageKey()) || '';
        if (saved) sourceQuery = saved;
      }
    } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

    const rawQuery = sourceQuery ? sourceQuery.replace(/^[?#]/, '') : '';
    const sourceSig = rawQuery;
    if (sourceSig === this._autoMintParseSourceSig) {
      const cachedTargets = Array.isArray(this._autoMintParseCachedTargets)
        ? this._autoMintParseCachedTargets
        : [];
      const filteredTargets = this.filterUnconsumedAutoMintTargets(cachedTargets);
      if (
        filteredTargets.length > 0 &&
        !this.props.loginComplete &&
        !this.state.needsLoginForAutoMint
      ) {
        this.setState({ needsLoginForAutoMint: true });
      }
      return filteredTargets.map((target: any) => ({ ...target }));
    }
    if (!rawQuery) {
      this._autoMintParseSourceSig = sourceSig;
      this._autoMintParseCachedTargets = [];
      return [];
    }

    const sp = new URLSearchParams(rawQuery);
    const globalAuto = sp.get('auto') === '1';

    // --- NEW: Robust Multi-Pair Parsing with Per-Target Auto Flag ---
    const pairs: any[] = [];
    const seen: any = new Set();

    // Helper to add valid pair if it has an auto intent (global or local)
    const addIfAuto = (sbt: any, gp: any, inv: any, localAutoFlag: any) => {
      if (!sbt) return; // Only sbt is strictly required now
      if (!/^0x[0-9a-fA-F]{40}$/.test(sbt)) return;

      // If neither global 'auto=1' nor local 'autoN=1' is set,
      // we do NOT add it to the OnePageSession execution queue.
      // (It will still be picked up by SBTPage for pre-filling).
      if (!globalAuto && localAutoFlag !== '1') return;

      const safeGp = gp || ''; // Default to empty string
      const safeInv = inv || '';
      const key = `${sbt.toLowerCase()}__${safeGp}__${safeInv}`;
      if (seen.has(key)) return;
      seen.add(key);
      pairs.push({ sbt, gp: safeGp, inv: safeInv });
    };

    // 1. Check base pair (sbt/gp)
    addIfAuto(sp.get('sbt'), sp.get('gp'), sp.get('inv'), '0'); // '0' is dummy, relies on globalAuto check inside

    // 2. Check indexed pairs (sbt1/gp1/auto1, sbt2/gp2/auto2, etc.)
    for (const key of sp.keys()) {
      const match = key.match(/^sbt(\d+)$/);
      if (match) {
        const idx = match[1]; // e.g. "1"
        const sbtVal = sp.get(key);
        const gpVal = sp.get(`gp${idx}`);
        const invVal = sp.get(`inv${idx}`);
        const autoVal = sp.get(`auto${idx}`); // e.g. auto1=1
        addIfAuto(sbtVal, gpVal, invVal, autoVal);
      }
    }

    // If we have any *auto-minting* targets and not logged in, surface the login banner
    const normalizedPairs = this.filterUnconsumedAutoMintTargets(
      pairs.map((target: any) => ({ ...target }))
    );

    if (normalizedPairs.length > 0 && !this.props.loginComplete && !this.state.needsLoginForAutoMint) {
      this.setState({ needsLoginForAutoMint: true });
    }

    this._autoMintParseSourceSig = sourceSig;
    // Cache the raw parsed targets so a later wallet switch can re-evaluate consumption
    // against the new account instead of permanently inheriting the prior wallet's filter.
    this._autoMintParseCachedTargets = pairs.map((target: any) => ({ ...target }));
    return normalizedPairs;
  }

  primeAutoMintTargets(targets: any) {
    if (!Array.isArray(targets) || targets.length === 0) return;
    this.setState({ autoMintTargets: targets }, () => {
      // Prefetch group names so banner can include them before login
      this.prefetchTargetNames(this.state.autoMintTargets);
      this.kickoffAutoMintIfNeeded();
    });
  }

  hasAutoMintIntent() {
    try {
      if (typeof window === 'undefined') return false;
      const hasAuto = (raw: any) => {
        const cleaned = String(raw || '').replace(/^[?#]/, '');
        if (!cleaned) return false;
        const params = new URLSearchParams(cleaned);
        if (params.get('auto') === '1') return true;
        for (const key of params.keys()) {
          if (/^auto\d+$/.test(key) && params.get(key) === '1') return true;
        }
        return false;
      };
      const search = window.location.search || '';
      if (hasAuto(search)) return true;
      const saved = sessionStorage.getItem(this.getAutoHashStorageKey()) || '';
      return hasAuto(saved);
    } catch (_) {
      return false;
    }
  }

  /* =======================
   * Verify password ↔ SBT binding (unlimited path)
   * ======================= */
  async verifyGroupPasswordBinding(sbtAddress: any, password: any) {
    const slug = resolveEffectiveSlug(this.props);
    try {
      // Read-only provider internally
      const onchainGph = await contractScriptsAny.getGroupPasswordHash('none', sbtAddress, slug);
      const pw = cryptoUtils.normalizeGroupPasswordInput(password);
      if (!pw) return false;

      if (!onchainGph || onchainGph === ethers.constants.HashZero) {
        return false;
      }
      return cryptoUtils.resolveGroupPasswordWalletScopeAddress({
        password: pw,
        sbtAddress,
        groupPasswordHash: onchainGph
      }) !== null;
    } catch (err) {
      return false;
    }
  }


  kickoffAutoMintIfNeeded() {
    const hasTargets = this.filterUnconsumedAutoMintTargets(this.state.autoMintTargets || []).length > 0;
    if (!hasTargets) return;

    // Do NOT auto-open login modal; show non-intrusive banner and wait for user
    if (!this.props.loginComplete) {
      if (!this.state.needsLoginForAutoMint) {
        this.setState({ needsLoginForAutoMint: true, dismissedLoginBanner: false });
      }
      return;
    }

    // Check if user cancelled on this page visit
    const cancelKey = 'ce:autoMintCancelled:' + (this.props.slug || 'general');
    try { if (sessionStorage.getItem(cancelKey)) return; } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

    // Already counting down or minting - skip
    if (this._autoMintCountdownTimer || this.state.autoMintCountdown !== null || this.state.autoMintingMode) return;

    // Start countdown
    this.setState({ autoMintCountdown: 5, needsLoginForAutoMint: false, dismissedAutoMintingBanner: false });
    this._autoMintCountdownTimer = setInterval(() => {
      const next = (this.state.autoMintCountdown || 0) - 1;
      if (next <= 0) {
        clearInterval(this._autoMintCountdownTimer);
        this._autoMintCountdownTimer = null;
        this.setState({ autoMintCountdown: null, autoMintingMode: true }, () => {
          this.runAutoMintQueue();
        });
      } else {
        this.setState({ autoMintCountdown: next });
      }
    }, 1000);
  }

  // Await sufficient balance for gas if possible; otherwise skip (non-blocking UX)
  async waitForSufficientBalance(providerIn: any, address: any, minimumBalanceWei: any, timeoutMs: any = 45000, pollIntervalMs: any = 2000) {
    try {
      const minBN = ethers.BigNumber.from(minimumBalanceWei || 0);
      if (!address || minBN.isZero()) {
        return true;
      }
      const readBalance =
        (typeof contractScriptsAny.getNativeBalance === 'function' && contractScriptsAny.getNativeBalance.bind(contractScripts))
        || (typeof contractScriptsAny.getETHBalance === 'function' && contractScriptsAny.getETHBalance.bind(contractScripts))
        || null;
      if (!readBalance) {
        return false;
      }

      // Group-aware read: rely on contractScripts (no ad-hoc provider instantiation)
      const slug = resolveEffectiveSlug(this.props);
      const getBalance = async () => {
        try { return await readBalance(address, slug); }
        catch { return ethers.BigNumber.from(0); }
      };

      const deadline = Date.now() + Number(timeoutMs || 0);
      let bal = await getBalance();
      if (bal.gte(minBN)) return true;

      while (Date.now() < deadline) {
        await new Promise((r: any) => setTimeout(r, pollIntervalMs || 0));
        try { bal = await getBalance(); } catch (_) { continue; }
        if (bal.gte(minBN)) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  refreshSbtAfterMint(sbtAddress: any) {
    if (!sbtAddress) return;
    try {
      const slug = resolveEffectiveSlug(this.props);
      const result = this.props.refreshSbtData && this.props.refreshSbtData(sbtAddress, slug);
      if (result && typeof result.then === 'function') {
        result.catch((e: any) => { demoLog.warn('OnePageSession: fallback', e); });
      }
    } catch (e) { demoLog.warn('OnePageSession: callback', e); }
  }

  handleFilterChange = (newFilterState: any) => {
    // Requirement: Internal Updates: Update local state WITHOUT modifying the URL.
    const nextFilterState = normalizeOnePageSessionFilterState(newFilterState || {});
    const nextSig = serializeOnePageSessionFilterState(nextFilterState);
    const currentSig = serializeOnePageSessionFilterState(this.state.filterState || {});
    if (nextSig === currentSig) return;
    this.setState({ filterState: nextFilterState });
  };




/* =======================
  * Core auto-mint queue, generalized
  * ======================= */
  async runAutoMintQueue() {
    const statuses = { ...(this.state.autoMintStatuses || {}) };
    const autoMintAccount = String(this.props.account || '').trim().toLowerCase();
    const targets = this.filterUnconsumedAutoMintTargets(this.state.autoMintTargets || [], autoMintAccount)
      .map((target: any) => ({ ...target }));
    const currentSlug = resolveEffectiveSlug(this.props); // use effective slug ('' for general)
    const queuedNameUpdates: Record<string, any> = {};
    const queuedImageUpdates: Record<string, any> = {};
    let statusVersion = 0;
    let lastFlushedStatusVersion = -1;

    const flushUiState = (includeStatuses: any = false) => {
      const hasNameUpdates = Object.keys(queuedNameUpdates).length > 0;
      const hasImageUpdates = Object.keys(queuedImageUpdates).length > 0;
      const shouldFlushStatuses = includeStatuses && statusVersion !== lastFlushedStatusVersion;
      if (!shouldFlushStatuses && !hasNameUpdates && !hasImageUpdates) return;
      if (shouldFlushStatuses) {
        lastFlushedStatusVersion = statusVersion;
      }

      const namePatch = { ...queuedNameUpdates };
      const imagePatch = { ...queuedImageUpdates };
      Object.keys(queuedNameUpdates).forEach((k: any) => { delete queuedNameUpdates[k]; });
      Object.keys(queuedImageUpdates).forEach((k: any) => { delete queuedImageUpdates[k]; });

      this.setState((prev: Readonly<OnePageSession['state']>) => {
        const updates: Record<string, any> = {};
        if (shouldFlushStatuses) {
          updates.autoMintStatuses = { ...statuses };
        }
        if (hasNameUpdates) {
          updates.sbtNames = { ...(prev.sbtNames || {}), ...namePatch };
        }
        if (hasImageUpdates) {
          updates.sbtImages = { ...(prev.sbtImages || {}), ...imagePatch };
        }
        return Object.keys(updates).length > 0 ? updates : null;
      });
    };

    const queueSbtMetadata = (sbtKey: any, name: any, image: any) => {
      const safeKey = String(sbtKey || '').toLowerCase();
      if (!safeKey) return;
      if (name && !queuedNameUpdates[safeKey]) {
        queuedNameUpdates[safeKey] = name;
      }
      if (image && !queuedImageUpdates[safeKey]) {
        queuedImageUpdates[safeKey] = image;
      }
    };

    const updateStatus = (sbtKey: any, nextStatus: any) => {
      const safeKey = String(sbtKey || '').toLowerCase();
      if (!safeKey || !nextStatus) return;
      const prevStatus = statuses[safeKey] || {};
      if (
        prevStatus.status === nextStatus.status &&
        prevStatus.name === nextStatus.name &&
        String(prevStatus.error || '') === String(nextStatus.error || '')
      ) {
        return;
      }
      statuses[safeKey] = nextStatus;
      statusVersion += 1;
      flushUiState(true);
    };

    const MIN_BALANCE_WEI = ethers.utils.parseEther('0.00002');
    const WAIT_TIMEOUT_MS = 45000;
    const WAIT_POLL_MS = 2000;

    // Prepare list of caches to scan (Current -> General -> All Others)
    const slugsToCheck: any = new Set([currentSlug, '']);
    try {
      getAllSessionSlugs().forEach((s: any) => {
        if (s != null) slugsToCheck.add(s);
      });
    } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

    for (const t of targets) {
      const sbtAddr = t.sbt;
      const sbtKey = sbtAddr.toLowerCase();

      if (this.hasConsumedAutoMintAttempt(sbtAddr, autoMintAccount)) {
        continue;
      }

      // Default banner entry (pending)
      let sbtName = 'Group';
      let path = 'unknown';
      let invitePayload: any = null;
      let invitePassword: any = null;
      let sbtInfo: any = null;

      try {
        // 1. CACHE LOOKUP (Scan all groups)
        // We look for a cache entry that has 'sbtInfo' AND 'tokenURI' to ensure it's complete enough for minting.
        for (const s of slugsToCheck) {
          try {
            const parsed = peekCacheSync('sbtCache', s, { clone: false });
            if (!parsed || typeof parsed !== 'object') continue;
            // Iterate all networks in this cache (e.g. "84532", "1")
            for (const netKey of Object.keys(parsed)) {
              const entry = parsed[netKey]?.sbtList?.[sbtKey];
              // Must have tokenURI to be considered a valid hit for minting flows
              if (entry?.sbtInfo && entry.sbtInfo.tokenURI) {
                sbtInfo = entry.sbtInfo;
                break;
              }
            }
          } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

          if (sbtInfo) break; // Found it, stop scanning slugs
        }

        // 2. NETWORK FALLBACK (Last Resort)
        if (!sbtInfo) {
           // 'none' provider = read-only RPC
           sbtInfo = await contractScriptsAny.getSbtMetadata('none', sbtAddr, currentSlug);
        }

        // 3. PREFLIGHT CHECKS
        sbtName = getSbtDisplayName(sbtInfo) || 'Group';
        // Queue banner visuals to flush with status updates (batched to reduce render bursts)
        queueSbtMetadata(sbtKey, sbtName, sbtInfo?.image);

        // Check if user already owns this SBT (from local cache; DG-scoped key)
        let alreadyOwned = false;
        try {
          const acctLower = (this.props.account || '').toLowerCase();
          if (acctLower) {
             const normalizeAddressCountMap = (value: any = null) => {
               const out: Record<string, any> = {};
               Object.entries(value || {}).forEach(([addrRaw, countRaw]: any) => {
                 const addr = String(addrRaw || '').toLowerCase().trim();
                 if (!addr) return;
                 const count = Math.max(0, Math.floor(Number(countRaw || 0)));
                 if (count <= 0) return;
                 out[addr] = count;
               });
               return out;
             };
             for (const s of slugsToCheck) {
                const parsed = peekCacheSync('sbtCache', s, { clone: false });
                if (!parsed || typeof parsed !== 'object') continue;
                for (const netKey of Object.keys(parsed)) {
                   const entry = parsed[netKey]?.sbtList?.[sbtKey];
                   if (entry) {
                      const checkpointBackedPartialCounts =
                        entry?.countsLoaded !== true &&
                        !!entry?.countsScanCheckpoint &&
                        typeof entry.countsScanCheckpoint === 'object';
                      const mintedCountMap = normalizeAddressCountMap(entry.mintedCountByAddress);
                      const burnedCountMap = normalizeAddressCountMap(entry.burnedCountByAddress);
                      if (!checkpointBackedPartialCounts && (Object.keys(mintedCountMap).length > 0 || Object.keys(burnedCountMap).length > 0)) {
                        if (Number(mintedCountMap[acctLower] || 0) > Number(burnedCountMap[acctLower] || 0)) {
                          alreadyOwned = true;
                          break;
                        }
                        continue;
                      }
                      if (checkpointBackedPartialCounts) {
                        continue;
                      }
                      const minted = Array.isArray(entry.mintedAddresses) ? entry.mintedAddresses : [];
                      const burned = Array.isArray(entry.burnedAddresses) ? entry.burnedAddresses : [];
                      if (minted.includes(acctLower) && !burned.includes(acctLower)) {
                         alreadyOwned = true;
                         break;
                      }
                   }
                }
                if (alreadyOwned) break;
             }
          }
        } catch (e) { demoLog.warn('OnePageSession: fallback', e); }

        if (alreadyOwned) {
          this.consumeAutoMintAttempt(sbtAddr, autoMintAccount);
          updateStatus(sbtKey, { status: 'success', name: `Group Already Joined` });
          this.onSbtMintSuccess(sbtAddr);
          continue; // do not attempt to mint again
        }

        // Announce intent
        updateStatus(sbtKey, { status: 'pending', name: `Joining Group: ${sbtName}` });

        // Runtime detection: public vs unlimited vs limited vs invite
        if (t.inv) {
          invitePayload = this.decodeInviteInput(t.inv);
          if (!invitePayload) {
            invitePassword = t.inv;
          }
          path = 'invite';
        } else {
          const gph = await contractScriptsAny.getGroupPasswordHash('none', sbtAddr, currentSlug);
          const hasGroupPassword = !!gph && gph !== ethers.constants.HashZero;

          let isPublic = false;
          if (sbtInfo && typeof sbtInfo.hasPasswordMint === 'boolean') {
              isPublic = !sbtInfo.hasPasswordMint;
          } else {
              // Fallback: Use password presence as heuristic if metadata flag missing
              if (!t.gp) isPublic = true;
          }
          if (hasGroupPassword) isPublic = false;

          if (isPublic) {
              path = 'public';
          } else {
              // Password required paths
              if (!t.gp) throw new Error('Password required for this group');

              let maxTokensLimit: any = null;
              try {
                const rawMax = sbtInfo?.maxTokens;
                if (rawMax !== undefined && rawMax !== null && rawMax !== '' && rawMax !== '0') {
                  maxTokensLimit = ethers.BigNumber.from(rawMax);
                }
              } catch (_) {
                maxTokensLimit = null;
              }
              if (maxTokensLimit === null && hasGroupPassword) {
                try {
                  const onchainInfo = await contractScriptsAny.getSbtMetadata('none', sbtAddr, currentSlug);
                  const rawMax = onchainInfo?.maxTokens;
                  if (rawMax !== undefined && rawMax !== null && rawMax !== '' && rawMax !== '0') {
                    maxTokensLimit = ethers.BigNumber.from(rawMax);
                  }
                } catch (_) {
                  maxTokensLimit = null;
                }
              }
              const isLimitedByMax = !!maxTokensLimit && !maxTokensLimit.isZero();

              if (isLimitedByMax) {
                path = 'invite';
                if (!invitePayload && t.gp) {
                  invitePassword = t.gp;
                }
              } else if (hasGroupPassword) {
                path = 'unlimited';
                // Optional: verify binding pre-tx (kept); tx phase will re-check
                await this.verifyGroupPasswordBinding(sbtAddr, t.gp);
              } else {
                throw new Error('Invite code required for this group');
              }
          }
        }
	      } catch (e: any) {
	        // Preflight/read-only error: log diagnostic but do NOT mark as "failed" in UI
	        updateStatus(sbtKey, { status: 'info', name: `Skipped (read error)`, error: getErrorMessage(e, 'Read error') });
	        continue;
	      }

      // TX PHASE WITH BALANCE GATE
      const userAddr = this.props.account;
      try {
        if (!userAddr) throw new Error(`${t('wallet')} not connected`);

        // Gate before ANY gas-spending tx
        const hasFundsFirst = await this.waitForSufficientBalance(
          this.props.provider,
          userAddr,
          MIN_BALANCE_WEI,
          WAIT_TIMEOUT_MS,
          WAIT_POLL_MS
        );
        if (!hasFundsFirst) {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (no gas funds arrived in time)' });
          continue;
        }

        if (path === 'public') {
          await contractScripts.claim(this.props.provider, sbtAddr);
          this.consumeAutoMintAttempt(sbtAddr, userAddr);
          updateStatus(sbtKey, { status: 'success', name: `Joined: ${sbtName || 'Group'}` });
          this.onSbtMintSuccess(sbtAddr);
        } else if (path === 'invite') {
          let payload = invitePayload;
          if (!payload) {
            const password = cryptoUtils.normalizeGroupPasswordInput(invitePassword);
            if (!password) throw new Error('Invalid group password');
            let walletScopeSbtAddress = sbtAddr;
            try {
              const onchainHash = await contractScriptsAny.getGroupPasswordHash('none', sbtAddr, currentSlug);
              if (onchainHash && onchainHash !== ethers.constants.HashZero) {
                walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
                  password,
                  sbtAddress: sbtAddr,
                  groupPasswordHash: onchainHash
                });
                const localHash = walletScopeSbtAddress === null
                  ? null
                  : contractScriptsAny.computeGroupPasswordHash({
                      password,
                      sbtAddress: walletScopeSbtAddress
                    });
                demoLog.log('[INVITE_DEBUG v4] auto-mint local groupPasswordHash:', localHash);
                demoLog.log('[INVITE_DEBUG v4] auto-mint on-chain groupPasswordHash:', onchainHash);
                if (!localHash || String(localHash).toLowerCase() !== String(onchainHash).toLowerCase()) {
                  throw new Error('Group password mismatch');
                }
              }
            } catch (hashErr) {
              throw hashErr;
            }
            let maxTokens: any = null;
            try {
              const rawMax = sbtInfo?.maxTokens;
              if (rawMax !== undefined && rawMax !== null && rawMax !== '' && rawMax !== '0') {
                maxTokens = ethers.BigNumber.from(rawMax);
              }
            } catch (_) {
              maxTokens = null;
            }

            const maxAttempts = 3;
            let lastError: any = null;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
              let mintedTokens: any = null;
              try {
                mintedTokens = await contractScriptsAny.getMintedTokens('none', sbtAddr, currentSlug);
              } catch (_) {
                mintedTokens = null;
              }

              if (mintedTokens === null) {
                throw new Error('Unable to load minted count');
              }

              let mintedBig: any = null;
              try {
                mintedBig = ethers.BigNumber.from(mintedTokens);
              } catch (_) {
                mintedBig = null;
              }

              if (mintedBig === null) {
                throw new Error('Unable to parse minted count');
              }

              if (maxTokens && mintedBig.gte(maxTokens)) {
                throw new Error('Group limit reached');
              }

              const nonce = mintedBig.add(1).toString();
              const invites = await contractScripts.generateInvitePayloads({
                password,
                sbtAddress: sbtAddr,
                nonces: [nonce],
                walletScopeSbtAddress
              });
              payload = invites && invites[0];
              if (!payload) throw new Error('Failed to generate invite');

              try {
                await contractScripts.claimWithInvite(this.props.provider, sbtAddr, payload.nonce, payload.signature);
                lastError = null;
                break;
              } catch (err) {
                lastError = err;
              }

              let mintedAfter: any = null;
              try {
                mintedAfter = await contractScriptsAny.getMintedTokens('none', sbtAddr, currentSlug);
              } catch (_) {
                mintedAfter = null;
              }

              let mintedAfterBig: any = null;
              try {
                mintedAfterBig = mintedAfter !== null ? ethers.BigNumber.from(mintedAfter) : null;
              } catch (_) {
                mintedAfterBig = null;
              }

              if (mintedAfterBig === null || mintedAfterBig.lte(mintedBig)) {
                throw lastError || new Error('Invite claim failed');
              }
            }

            if (lastError) {
              throw lastError;
            }
          } else {
            await contractScripts.claimWithInvite(this.props.provider, sbtAddr, payload.nonce, payload.signature);
          }
          this.consumeAutoMintAttempt(sbtAddr, userAddr);
          updateStatus(sbtKey, { status: 'success', name: `Joined: ${sbtName || 'Group'}` });
          this.onSbtMintSuccess(sbtAddr);
        } else if (path === 'unlimited') {
          await this.mintUnlimitedSBTWithGroupPassword(sbtAddr, t.gp);
          this.consumeAutoMintAttempt(sbtAddr, userAddr);
          updateStatus(sbtKey, { status: 'success', name: `Joined: ${sbtName || 'Group'}` });
          this.onSbtMintSuccess(sbtAddr);
        } else {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (unknown path)' });
        }
	      } catch (e: any) {
	        const msg = (getErrorMessage(e, String(e || '')) || String(e || '')).toLowerCase();

        if (msg.includes("already owns") || msg.includes("already joined") || msg.includes("user already has")) {
           // Graceful handling of "already owned" revert
           this.consumeAutoMintAttempt(sbtAddr, userAddr);
           updateStatus(sbtKey, { status: 'success', name: `Group Already Joined` });
           this.onSbtMintSuccess(sbtAddr);
        } else if (msg.includes("minting ended") || msg.includes("minting has ended")) {
           updateStatus(sbtKey, { status: 'failed', name: `Join Failed`, error: `${t('minting')} period has ended` });
        } else if (msg.includes("max tokens") || msg.includes("limit reached")) {
           updateStatus(sbtKey, { status: 'failed', name: `Join Failed`, error: "Group limit reached" });
        } else {
	           updateStatus(sbtKey, { status: 'failed', name: `Join Failed`, error: getErrorMessage(e, 'Mint failed') });
	        }
	      }

      if (statuses[sbtKey]?.status === 'success') {
        this.refreshSbtAfterMint(sbtAddr);
      }
      flushUiState(true);
    }

    flushUiState(true);
    this.setState({ autoMintingMode: false });
  }


  /* =======================
   * Unlimited helper (used by queue and can be used manually)
   * ======================= */
  async mintUnlimitedSBTWithGroupPassword(sbtAddress: any, groupPassword: any) {
    if (!this.props.loginComplete) {
      this.props.toggleLoginModal(true);
      throw new Error(`Please connect your ${t('walletLower')} first.`);
    }

    const pw = cryptoUtils.normalizeGroupPasswordInput(groupPassword);
    if (!pw) {
      throw new Error('Group password is required.');
    }

    const onchain = await contractScriptsAny.getGroupPasswordHash('none', sbtAddress, resolveEffectiveSlug(this.props));
    if (!onchain || onchain === ethers.constants.HashZero) throw new Error('No group password set on-chain');

    const walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
      password: pw,
      sbtAddress,
      groupPasswordHash: onchain
    });
    const local = walletScopeSbtAddress === null
      ? null
      : contractScriptsAny.computeGroupPasswordHash({
          password: pw,
          sbtAddress: walletScopeSbtAddress
        });
    if (!local || local.toLowerCase() !== onchain.toLowerCase()) {
      throw new Error('Password mismatch');
    }

    this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint' });

    const sig = await contractScriptsAny.signGroupMintAuthorization({
      password: pw,
      sbtAddress,
      userAddress: this.props.account,
      walletScopeSbtAddress
    });

    const tx = await contractScriptsAny.mintWithGroupSignature(this.props.provider, sbtAddress, sig);

    this.setState({
      mintingStatus: 'success',
      transactionHash: tx.transactionHash,
      lastTransactionType: 'mint',
      lastMintTxHash: tx.transactionHash
    });
  }



  handleOpenResults() {
    this.recordOriginalURL();

    const scrollQuestionsIntoView = () => {
      const el = this.questionsSectionRef && this.questionsSectionRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {
          try { window.scrollTo(0, el.offsetTop || 0); } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
        }
      }
    };

    const slug = resolveEffectiveSlug(this.props); // keep group in URL
    const path = '/questions/results';

    this.setState({ showQuestions: true, autoOpenResults: false }, () => {
      scrollQuestionsIntoView();
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.pathname = buildOnePageSessionPublicRoute(path);
        nextUrl.searchParams.delete('sessionSlug');
        nextUrl.searchParams.delete('s');
        if (slug) {
          nextUrl.searchParams.set('session', slug);
        } else {
          nextUrl.searchParams.delete('session');
        }
        window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
      if (this._autoOpenResultsTimer) {
        clearTimeout(this._autoOpenResultsTimer);
      }
      this._autoOpenResultsTimer = setTimeout(() => {
        this._autoOpenResultsTimer = null;
        this.setState({ autoOpenResults: true });
      }, 0);
    });
  }

  handleResultsModalClose() {
    this.setState({ autoOpenResults: false }, () => this.resetDemoURL());
  }

  handleCorpusAtlasIssueOpen(nodeId: any, riskMatrixRestoreState: RiskMatrixRestoreState | null = null) {
    const normalizedNodeId = String(nodeId || '').trim();
    if (!normalizedNodeId) return;

    this.setState((prevState: Readonly<OnePageSession['state']>) => ({
      embeddedAtlasNodeId: normalizedNodeId,
      embeddedAtlasReturnState: prevState.embeddedAtlasReturnState || {
        showResults: prevState.showResults,
        resultsViewMode: prevState.resultsViewMode,
        riskMatrixRestoreState: riskMatrixRestoreState || null,
      },
      showResults: true,
      resultsViewMode: 'debateAtlas',
    }));
  }

  handleCorpusViewerLoadStateChange(nextLoadState: any = DEFAULT_CORPUS_VIEWER_LOAD_STATE) {
    this.setState((previousState: Readonly<OnePageSession['state']>) => {
      const currentLoadState = previousState.corpusViewerLoadState || DEFAULT_CORPUS_VIEWER_LOAD_STATE;
      const resolvedNextState = {
        ...DEFAULT_CORPUS_VIEWER_LOAD_STATE,
        ...(nextLoadState || {}),
      };

      if (
        currentLoadState.activeCorpusKey === resolvedNextState.activeCorpusKey
        && currentLoadState.activeCorpusLabel === resolvedNextState.activeCorpusLabel
        && currentLoadState.loadStatus === resolvedNextState.loadStatus
        && currentLoadState.loadButtonLabel === resolvedNextState.loadButtonLabel
        && currentLoadState.disableLoadButton === resolvedNextState.disableLoadButton
        && currentLoadState.error === resolvedNextState.error
      ) {
        return null;
      }

      return {
        corpusViewerLoadState: resolvedNextState,
      };
    });
  }

  handleLoadFullCorpusClick(event: any) {
    if (event?.stopPropagation) event.stopPropagation();
    this.setState((previousState: Readonly<OnePageSession['state']>) => ({
      corpusViewerLoadRequestNonce: Number(previousState.corpusViewerLoadRequestNonce || 0) + 1,
    }));
  }

  handleEmbeddedAtlasModalClose() {
    this.setState((prevState: Readonly<OnePageSession['state']>) => {
      const returnState = prevState.embeddedAtlasReturnState;
      return {
        embeddedAtlasNodeId: null,
        embeddedAtlasReturnState: null,
        riskMatrixRestoreState: returnState?.resultsViewMode === 'riskMatrix'
          ? (returnState?.riskMatrixRestoreState || null)
          : null,
        showResults: returnState ? returnState.showResults : prevState.showResults,
        resultsViewMode: returnState?.resultsViewMode || prevState.resultsViewMode,
      };
    });
  }

  handleRiskMatrixRestoreApplied() {
    if (!this.state.riskMatrixRestoreState) return;
    this.setState({ riskMatrixRestoreState: null });
  }



  resetDemoURL() {
    if (this.hasAutoMintIntent() && !this.state.mintSuccess) return;
    this.recordOriginalURL();

    const fallbackURL = buildOnePageSessionCanonicalBaseUrl(this.props);

    try { window.history.replaceState({}, '', this.originalURL || fallbackURL); } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
  }



  toggleQuestions() {
    this.setState(
      (prevState: Readonly<OnePageSession['state']>) => ({ showQuestions: !prevState.showQuestions }),
      () => {
        if (!this.state.showQuestions) {
          this.setState({ autoOpenResults: false });
        }
        this.resetDemoURL();
      }
    );
  }

  toggleGroups() {
    this.setState(
      (prevState: Readonly<OnePageSession['state']>) => ({ showGroups: !prevState.showGroups }),
      () => this.resetDemoURL()
    );
  }

  toggleEmbeddedCreateGroup(event: any) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.setState((prevState: Readonly<OnePageSession['state']>) => ({
      showEmbeddedCreateGroup: !prevState.showEmbeddedCreateGroup,
    }));
  }

  navigateToInternalPath(target: any) {
    const normalizedTarget = String(target || '').trim();
    if (!normalizedTarget) return;

    const basePath = readPublicUrlBasePath();
    const internalTarget = `${basePath}${normalizedTarget.startsWith('/') ? normalizedTarget : `/${normalizedTarget}`}`;

    if (typeof this.props.navigate === 'function') {
      this.props.navigate(internalTarget);
      return;
    }

    if (this.props.history && typeof this.props.history.push === 'function') {
      this.props.history.push(internalTarget);
      return;
    }

    if (typeof window !== 'undefined' && window.history && typeof window.history.pushState === 'function') {
      try {
        window.history.pushState({}, '', internalTarget);
        if (typeof window.dispatchEvent === 'function') {
          const navEvent = typeof PopStateEvent === 'function'
            ? new PopStateEvent('popstate', { state: window.history.state })
            : new Event('popstate');
          window.dispatchEvent(navEvent);
        }
        return;
      } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
    }

    if (typeof window !== 'undefined' && window.location) {
      window.location.assign(internalTarget);
    }
  }

  handleGroupsViewAll(event: any) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.navigateToInternalPath(sbtsListPath());
  }

  handlePileSubmitRailVisibilityChange(visible: any) {
    const nextVisible = !!visible;
    this.setState((prevState: Readonly<OnePageSession['state']>) => (
      prevState.pileSubmitRailVisible === nextVisible
        ? null
        : { pileSubmitRailVisible: nextVisible }
    ));
  }

  toggleGroupsAbout() {
    this.setState((prevState: Readonly<OnePageSession['state']>) => ({ showGroupsAbout: !prevState.showGroupsAbout }));
  }

  toggleResults() {
    this.setState(
      (prevState: Readonly<OnePageSession['state']>) => ({ showResults: !prevState.showResults }),
      () => this.resetDemoURL()
    );
  }

  toggleDocuments() {
    this.setState((prevState: Readonly<OnePageSession['state']>) => ({ showDocuments: !prevState.showDocuments }));
  }

  toggleResultsAbout() {
    this.setState((prevState: Readonly<OnePageSession['state']>) => ({ showResultsAbout: !prevState.showResultsAbout }));
  }

  /* =======================
   * Dismiss handlers (for “X” buttons)
   * ======================= */
  dismissLoginBanner() { this.setState({ dismissedLoginBanner: true }); }
  dismissAutoMintingBanner() { this.setState({ dismissedAutoMintingBanner: true }); }
  cancelAutoMintCountdown() {
    if (this._autoMintCountdownTimer) {
      clearInterval(this._autoMintCountdownTimer);
      this._autoMintCountdownTimer = null;
    }
    const cancelKey = 'ce:autoMintCancelled:' + (this.props.slug || 'general');
    try { sessionStorage.setItem(cancelKey, '1'); } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
    this.setState({ autoMintCountdown: null, autoMintingMode: false, dismissedAutoMintingBanner: true });
  }
  dismissStatusItem(addrKey: any) {
    const key = (addrKey || '').toLowerCase();
    this.setState((prev: Readonly<OnePageSession['state']>) => ({
      dismissedStatusItems: { ...(prev.dismissedStatusItems || {}), [key]: true }
    }));
  }

  toggleStatusImagePreview(addrKey: any) {
    const key = (addrKey || '').toLowerCase();
    this.setState((prev: Readonly<OnePageSession['state']>) => ({
      expandedImages: {
        ...prev.expandedImages,
        [key]: !prev.expandedImages[key]
      }
    }));
  }

  /* =======================
   * View All Questions handler + smooth scroll
   * ======================= */
  handleViewAllQuestionsClick() {
    this.setState({ showQuestions: true }, () => {
      const el = this.questionsSectionRef && this.questionsSectionRef.current;
      if (el && typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (_) {
          try { window.scrollTo(0, el.offsetTop || 0); } catch (e) { demoLog.warn('OnePageSession: fallback', e); }
        }
      }
    });
  }

  render() {
    bumpPerfCounter('renderCount');
    const {
      slug,
      sessionName,
      sessionHeader,
      sessionInfo,
      defaultTags,
      defaultSbtTags,
      defaultFilterState,
      defaultFeaturedSBTs,
      contracts,
      blockLimits,
      networkChainId,
      autoFeatureSBTsBySessionSlug,
      autoFeatureSBTsWithFeaturedSbtTags,
      questionsGenPrompt, // <-- Destructured
      sessionConfig: incomingSessionConfig,
      polisDemoDataBySlug,
    } = this.props;
    const resolvedSessionConfig = this.getResolvedSessionConfig({
      slug,
      sessionName,
      questionsGenPrompt,
      autoFeatureSBTsBySessionSlug,
      autoFeatureSBTsWithFeaturedSbtTags,
      incomingSessionConfig,
      contracts,
    });
    const resolvedPolisDemoDataBySlug =
      polisDemoDataBySlug ||
      incomingSessionConfig?.polisDemoDataBySlug ||
      resolvedSessionConfig?.polisDemoDataBySlug ||
      null;
    const scopedLitHooks = this.resolveScopedLitHooks(resolvedSessionConfig);
    const effectiveSlug = resolveEffectiveSlug(this.props) || slug;
    // Only show DebateHUD/CorpusViewer on the generic demo session.
    const isDemoSlug = effectiveSlug === 'demo';
    const basePath = readPublicUrlBasePath();
    const sectionsGridClassName = [
      styles.sectionsGrid,
      !isDemoSlug ? styles.sectionsGridTwoUp : '',
    ].filter(Boolean).join(' ');

    // Resolve first target group name (spinner if not ready)
    const firstTargetAddrLower =
      (this.state.autoMintTargets && this.state.autoMintTargets[0] && this.state.autoMintTargets[0].sbt)
        ? this.state.autoMintTargets[0].sbt.toLowerCase()
        : null;
    const firstTargetName = firstTargetAddrLower ? this.state.sbtNames[firstTargetAddrLower] : null;

    // Ensure close button is visible; prefer module class if present, else use existing global fallback
    const alertCloseClass = styles.alertCloseButton || 'sbt-alert-close-btn';

    const fallbackSessionLabel = (slug && String(slug).trim()) ? String(slug).trim() : 'Session';
    const titleText = sessionName ? `${sessionName}` : fallbackSessionLabel;
    const renderSectionHeading = (title: any, subtitle: any) => (
      <span className={styles.sectionHeaderText}>
        <span className={styles.sectionHeaderTitle}>{title}</span>
        <span className={styles.sectionHeaderSubtitle}>{subtitle}</span>
      </span>
    );
    const questionsSectionTitle = (
      renderSectionHeading('Questions', 'Answer or Add')
    );
    const questionsSectionTooltip = 'Survey and question platform allowing detailed responses, advanced question formats, preference weighing, and group filtering.';
    const documentsSectionTooltip = 'Allows the conversation to be enriched by data, and the formats can change per-session';
    const corpusViewerLoadState = this.state.corpusViewerLoadState || DEFAULT_CORPUS_VIEWER_LOAD_STATE;
    const loadFullCorpusButtonLabel = corpusViewerLoadState.loadButtonLabel || DEFAULT_CORPUS_VIEWER_LOAD_STATE.loadButtonLabel;
    const disableLoadFullCorpusButton = !!corpusViewerLoadState.disableLoadButton;
    const pileSubmitRailActive = !this.state.showQuestions && this.state.pileSubmitRailVisible;
    const brandingSectionClassName = [
      styles.brandingSection,
      pileSubmitRailActive ? styles.brandingSectionWithPileSubmitRail : '',
    ].filter(Boolean).join(' ');
    const titleContainerClassName = [
      styles.titleContainer,
      pileSubmitRailActive ? styles.titleContainerWithPileSubmitRail : '',
    ].filter(Boolean).join(' ');
    const telegramOnlySession = this.isTelegramOnlySession(resolvedSessionConfig);
    const telegramClientLoggedIn = telegramOnlySession && this.hasTelegramClientAuth(effectiveSlug);
    const telegramClientAuth = telegramClientLoggedIn ? (this.state.telegramClientAuth || {}) : {};
    const sessionDataMode = resolveSessionDataMode({
      sessionConfig: resolvedSessionConfig,
      probeResult: this.state.telegramOnlyProbe === true
        ? { telegramOnly: true, telegramBridgeEnabled: true }
        : null,
      telegramAuth: { loggedIn: telegramClientLoggedIn },
    });
    // Telegram/cloudflare combo: data lives in the worker, so questions/results/
    // groups render worker-backed panels instead of the on-chain surfaces.
    const telegramDataMode = sessionDataMode === 'telegram';
    const resultsViewMode = telegramDataMode
      ? this.state.resultsViewMode
      : (isDemoSlug ? this.state.resultsViewMode : 'polis');
    const resultsViewOptions = telegramDataMode
      ? [
          { key: 'polis', label: 'Report', icon: '🧾' },
          { key: 'debateMap', label: 'Debate Map', icon: '🗺️' },
        ]
      : [
          { key: 'polis', label: 'Report', icon: '🧾' },
          ...(isDemoSlug
            ? [
                { key: 'debateAtlas', label: 'Debate Map', icon: '🗺️' },
                { key: 'analysis', label: 'Breakdown', icon: '📊' },
                { key: 'riskMatrix', label: 'Risk Matrix', icon: '⚠️' },
              ]
            : []),
        ];
    const effectiveAccount = telegramClientAuth.accountAddress || this.props.account;
    const effectiveLoginComplete = telegramClientLoggedIn || this.props.loginComplete;

    if (telegramOnlySession && !telegramClientLoggedIn) {
      return (
        <div className={styles.onePageDemoContainer}>
          <div className={styles.telegramOnlyShell}>
            <div className={titleContainerClassName}>
              <h2 className={styles.brandingSectionTitle}>{titleText}</h2>
            </div>
            <Alert
              color="info"
              className={styles.telegramOnlyNotice}
              data-testid={E2E_TESTIDS.SESSION_TELEGRAM_ONLY_NOTICE}
              fade={false}
            >
              <strong>Telegram-only session</strong>
              <span>
                Paste the agent token from the Context Engine Telegram bot (Onboard Agent → Copy New Agent Info) to open the interactive report.
              </span>
            </Alert>
            {this.renderTelegramTokenForm()}
          </div>
        </div>
      );
    }

    return (
      <div className={styles.onePageDemoContainer}>
        {/* Sticky banners */}
        {this.state.needsLoginForAutoMint && (
          <Alert
            color="warning"
            className={styles.sbtMintStatusItem}
            data-testid={E2E_TESTIDS.SESSION_AUTO_MINT_LOGIN_BANNER}
            style={{
              position: 'sticky',
              top: 0,
              marginBottom: '12px',
              fontWeight: '600',
              fontSize: '1.5em'
            }}
            isOpen={!this.state.dismissedLoginBanner}
            fade={false}
            toggle={this.dismissLoginBanner}
            closeClassName={alertCloseClass}
          >
            {`Login to Join ${t('sbt')}:`}&nbsp;
            {firstTargetName
              ? firstTargetName
              : <FontAwesomeIcon icon={faSpinner} spin aria-label="loading group name" />}
          </Alert>
        )}

        {this.state.autoMintCountdown !== null && (
          <Alert
            color='info'
            className={styles.sbtMintStatusItem}
            isOpen={true}
            fade={false}
            data-testid={E2E_TESTIDS.SESSION_AUTO_MINT_COUNTDOWN}
            style={{ fontSize: '1.15rem', fontWeight: 600 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
                <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '8px' }} />
                Joining group in {this.state.autoMintCountdown}...
              </span>
              <button
                className='btn btn-outline-light'
                style={{ padding: '4px 16px', cursor: 'pointer', marginLeft: '12px', fontSize: '1rem' }}
                onClick={this.cancelAutoMintCountdown}
              >
                Cancel
              </button>
            </div>
          </Alert>
        )}

        {/* Per-SBT status sub-banners */}
        {this.state.autoMintStatuses && Object.keys(this.state.autoMintStatuses).length > 0 && (
          <div className={styles.sbtMintBannerContainer}>
            {Object.entries(this.state.autoMintStatuses).map(([addrKey, v]: any) => {
              const color =
                v.status === 'success'
                  ? 'success'
                  : v.status === 'failed'
                  ? 'danger'
                  : v.status === 'skipped'
                  ? 'secondary'
                  : 'info';
              const isOpen = !this.state.dismissedStatusItems[(addrKey || '').toLowerCase()];
              const isExpanded = !!this.state.expandedImages[(addrKey || '').toLowerCase()];
              const sbtImage = this.state.sbtImages[(addrKey || '').toLowerCase()];
              const isTerminalError = !!(
                v.error &&
                /max(imum)?\s*(tokens?\s*)?mint|supply\s*exhaust|mint.*expir|period.*end|group\s*limit/i.test(v.error)
              );

              // Map status to icon
              let statusIcon: any = null;
              if (v.status === 'pending') statusIcon = <FontAwesomeIcon icon={faSpinner} spin />;
              else if (v.status === 'success') statusIcon = <FontAwesomeIcon icon={faCheck} />;
              else if (v.status === 'failed') statusIcon = <FontAwesomeIcon icon={faTimes} />;
              else statusIcon = <FontAwesomeIcon icon={faQuestionCircle} />; // skipped/info

              return (
                <Alert
                  key={addrKey}
                  color={color}
                  className={styles.sbtMintStatusItem}
                  isOpen={isOpen}
                  fade={false}
                  data-testid={E2E_TESTIDS.SESSION_AUTO_MINT_STATUS}
                  data-ce-sbt-address={(addrKey || '').toLowerCase() || undefined}
                  data-ce-status={String(v.status || '').trim().toLowerCase() || undefined}
                  toggle={() => this.dismissStatusItem(addrKey)}
                  closeClassName={alertCloseClass}
                  style={{ fontSize: '1.15rem', fontWeight: 600 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {statusIcon}
                      <span>
                        <a
                          href={`${basePath}${buildSbtDetailPath(addrKey, effectiveSlug)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ textDecoration: 'underline', color: 'inherit' }}
                        >
                          {v.name || addrKey}
                        </a>
                      </span>
                      {sbtImage && (
                        <button
                          onClick={() => this.toggleStatusImagePreview(addrKey)}
                          style={{
                             background: 'none',
                             border: 'none',
                             cursor: 'pointer',
                             opacity: 0.7,
                             marginLeft: '5px',
                             padding: '0 5px'
                          }}
                          title={isExpanded ? "Hide Preview" : "Show Preview"}
                        >
                          {sbtImage ? (
                            <img
                              src={sbtImage}
                              alt={t('sbt')}
                              loading="lazy"
                              referrerPolicy="no-referrer"
                              style={{
                                height: '24px',
                                width: '24px',
                                borderRadius: '4px',
                                objectFit: 'cover',
                                verticalAlign: 'middle'
                              }}
                            />
                          ) : (
                            <FontAwesomeIcon icon={faImage} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {v.error && <div style={{ fontSize: '0.9em', marginTop: '4px', marginLeft: '26px', fontWeight: 400 }}>{v.error}</div>}

                  {v.status === 'failed' && !isTerminalError && (
                    <div style={{ marginTop: '6px', marginLeft: '26px' }}>
                      <button
                        className="btn btn-sm btn-outline-dark"
                        style={{ padding: '2px 10px', border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer' }}
                        onClick={() => this.kickoffAutoMintIfNeeded()}
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {isExpanded && sbtImage && (
                    <div style={{ marginTop: '10px', marginLeft: '26px' }}>
                      <img
                        src={sbtImage}
                        alt={`${t('sbt')} Preview`}
                        style={{ maxHeight: '100px', borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }}
                      />
                    </div>
                  )}
                </Alert>
              );
            })}
          </div>
        )}

        {telegramOnlySession && telegramClientLoggedIn && (
          <div className={styles.telegramTokenConnectedPanel}>
            <div className={styles.telegramTokenConnectedBar}>
              <span>Telegram session connected</span>
              <button
                type="button"
                className={styles.telegramTokenChangeButton}
                data-testid="ce-session-telegram-change-token"
                onClick={() => this.setState((prevState: any) => ({
                  showTelegramTokenReentry: !prevState.showTelegramTokenReentry,
                }))}
              >
                Change token
              </button>
            </div>
            {this.state.showTelegramTokenReentry ? this.renderTelegramTokenForm() : null}
          </div>
        )}

        {/* Branding/header */}
        <div className={brandingSectionClassName}>
          <div className={titleContainerClassName}>
            <h2 className={styles.brandingSectionTitle}>{titleText}</h2>
            <div className={styles.tooltip} tabIndex={0} aria-label="Session info">
              <FontAwesomeIcon icon={faQuestionCircle} />
              <span className={styles.tooltiptext}>
                {sessionInfo
                  ? <p><em>{sessionInfo}</em></p>
                  : <p>Share input; your responses help generate a collective intelligence map.</p>}
              </span>
            </div>
          </div>

          {telegramDataMode ? null : this.state.showQuestions ? (
            <div
              className={styles.pileHeaderRow}
              data-testid={E2E_TESTIDS.SESSION_QUESTIONS_FULL_HEADER}
            >
              <div className={styles.pileBackContainer}>
                <button
                  type="button"
                  onClick={this.toggleQuestions}
                  className={styles.pileBackButton}
                  data-testid={E2E_TESTIDS.SESSION_PILE_BACK}
                  aria-label="Back to pile view"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                  <span>Back</span>
                </button>
              </div>
              <div className={styles.pileHeaderTitleWrap}>
                <h2 className={styles.pileHeaderTitle}>{questionsSectionTitle}</h2>
                <div className={`${styles.tooltip} ${styles.pileHeaderTooltip}`} tabIndex={0} aria-label="Questions info">
                  <FontAwesomeIcon icon={faQuestionCircle} />
                  <span className={styles.tooltiptext}>
                    {questionsSectionTooltip}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
              <MemoSurveyPage
                minifiedMode="pile"
                account={effectiveAccount}
                provider={this.props.provider}
                network={this.props.network}
                toggleLoginModal={this.props.toggleLoginModal}
                loginComplete={effectiveLoginComplete}
                isSBTCacheReady={this.props.isSBTCacheReady}
                isSurveyCacheReady={this.props.isSurveyCacheReady}
                isQuestionCacheReady={this.props.isQuestionCacheReady}
                isResponsesCacheReady={this.props.isResponsesCacheReady}
                cacheHasLoaded={this.props.cacheHasLoaded}
                sbtCacheRevision={this.props.sbtCacheRevision}
                questionResponsesNonce={this.props.questionResponsesNonce}
                questionScanProgress={this.props.questionScanProgress}
                refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
                refreshQuestionMetadata={this.props.refreshQuestionMetadata}
                refreshQuestionResponses={this.props.refreshQuestionResponses}
                sessionInfo={sessionInfo}
                sessionName={sessionName}
                sessionHeader={sessionHeader}
                defaultTags={defaultTags}
                defaultFilterState={defaultFilterState}
                defaultFeaturedSBTs={defaultFeaturedSBTs}
                onFilterChange={this.handleFilterChange}
                onPileSubmitRailVisibilityChange={this.handlePileSubmitRailVisibilityChange}
                filterState={this.state.filterState}
                onViewAllClick={this.handleViewAllQuestionsClick}
                hideSessionSelector={true}
                // Keep "Raw Results" session-local when launched from a
                // specific OnePageSession; SurveyResults has its own scope selector.
                sessionSlugPinned={true}
                preventUrlChange={true}
                /* per-demo passthroughs */
                sessionSlug={slug}
                sessionConfig={resolvedSessionConfig}
                contracts={contracts}
                blockLimits={blockLimits}
                networkChainId={networkChainId}
                litHooks={scopedLitHooks}
              />
            </Suspense>
          )}

        </div>

        {/* Questions section */}
        {!telegramDataMode && this.state.showQuestions && (
          <div className={styles.sectionContainer} ref={this.questionsSectionRef}>
            <div className={`${styles.miniSectionContent} ${styles.miniSectionContentNoHeader}`}>

            {telegramDataMode ? (
              this.renderTelegramQuestionsPanel({ compact: false })
            ) : (
            <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
              <MemoSurveyPage
                miniMode={true}
                hideEmbeddedDebugUi={true}
                account={effectiveAccount}
                provider={this.props.provider}
                network={this.props.network}
                toggleLoginModal={this.props.toggleLoginModal}
                loginComplete={effectiveLoginComplete}
                sessionInfo={sessionInfo}
                sessionName={sessionName}
                sessionHeader={sessionHeader}
                defaultTags={defaultTags}
                defaultFilterState={defaultFilterState}
                defaultFeaturedSBTs={defaultFeaturedSBTs}
                autoOpenResults={this.state.autoOpenResults}
                questionResponsesNonce={this.props.questionResponsesNonce}
                questionScanProgress={this.props.questionScanProgress}
                refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
                refreshQuestionMetadata={this.props.refreshQuestionMetadata}
                refreshQuestionResponses={this.props.refreshQuestionResponses}
                isQuestionCacheReady={this.props.isQuestionCacheReady}
                isSBTCacheReady={this.props.isSBTCacheReady}
                isSurveyCacheReady={this.props.isSurveyCacheReady}
                isResponsesCacheReady={this.props.isResponsesCacheReady}
                cacheHasLoaded={this.props.cacheHasLoaded}
                onFilterChange={this.handleFilterChange}
                filterState={this.state.filterState}
                hideSessionSelector={true}
                // Same invariant in embedded full mode: start scoped to this session,
                // then let SurveyResults widen scope explicitly if the user wants to.
                sessionSlugPinned={true}
                preventUrlChange={true}
                onResultsModalClose={this.handleResultsModalClose}
                /* per-demo passthroughs */
                sessionSlug={slug}
                sessionConfig={resolvedSessionConfig}
                contracts={contracts}
                blockLimits={blockLimits}
                networkChainId={networkChainId}
                litHooks={scopedLitHooks}
              />
            </Suspense>
            )}

            </div>
          </div>
        )}

        <div className={sectionsGridClassName}>
          {/* Telegram Questions section */}
          {telegramDataMode && (
            <div
              className={`${styles.sectionContainer} ${this.state.showQuestions ? styles.sectionExpanded : ''}`}
              ref={this.questionsSectionRef}
            >
              <div className={styles.sectionHeaderRow}>
                <h2
                  onClick={this.toggleQuestions}
                  className={styles.sectionHeader}
                  data-testid="ce-session-telegram-questions-toggle"
                >
                  {this.state.showQuestions ? (
                    <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
                  ) : (
                    <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
                  )}
                  {renderSectionHeading('Questions', 'Answer')}
                  {this.state.showQuestions && (
                    <div
                      className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                      onClick={(e: any) => e.stopPropagation()}
                    >
                      <FontAwesomeIcon icon={faQuestionCircle} />
                      <span className={styles.tooltiptext}>
                        Questions are read-only here; answer through your Telegram agent or bot.
                      </span>
                    </div>
                  )}
                </h2>
              </div>
              {this.state.showQuestions && (
                <div className={styles.miniSectionContent}>
                  {this.renderTelegramQuestionsPanel({ compact: false })}
                </div>
              )}
            </div>
          )}

          {/* Groups section */}
          <div className={`${styles.sectionContainer} ${this.state.showGroups ? styles.sectionExpanded : ''}`}>
            <div className={styles.sectionHeaderRow}>
              <h2 onClick={this.toggleGroups} className={styles.sectionHeader}>
                {this.state.showGroups ? (
                  <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
                ) : (
                  <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
                )}
                {telegramDataMode
                  ? renderSectionHeading('Groups', 'Research Buckets')
                  : renderSectionHeading(t('sbts'), 'Join or Create')}
                {this.state.showGroups && !telegramDataMode && (
                  <div
                    className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                    onClick={(e: any) => e.stopPropagation()}
                  >
                    <FontAwesomeIcon icon={faQuestionCircle} />
                    <span className={styles.tooltiptext}>
                      {`${SBT_TOOLTIP_LABEL} enable groups to organize membership, roles, and permissions on-chain.`}
                      They unlock private coordination, community-governed tools, and shared AI training.
                    </span>
                  </div>
                )}
              </h2>

              {this.state.showGroups && !telegramDataMode && (
                <div className={styles.sectionHeaderActionsScroller}>
                  <div className={styles.sectionHeaderActions}>
                    <button
                      type="button"
                      onClick={this.handleGroupsViewAll}
                      className={styles.sectionHeaderActionButton}
                    >
                      <FontAwesomeIcon icon={faExpand} />
                      View All
                    </button>
                    <button
                      type="button"
                      onClick={this.toggleEmbeddedCreateGroup}
                      className={styles.sectionHeaderActionButton}
                      data-testid={E2E_TESTIDS.SBTS_CREATE_TOGGLE}
                    >
                      <FontAwesomeIcon icon={faPlus} />
                      {this.state.showEmbeddedCreateGroup ? 'Exit' : 'Create'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {this.state.showGroups && telegramDataMode && (
              <div className={styles.miniSectionContent}>
                {this.renderTelegramBucketsPanel()}
              </div>
            )}
            {this.state.showGroups && !telegramDataMode && (
              <div className={styles.miniSectionContent}>
                <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
                  <SBTsPage
                    key={`sbtspage:${slug || 'general'}`}
                    provider={this.props.provider}
                    network={this.props.network}
                    account={effectiveAccount}
                    loginComplete={effectiveLoginComplete}
                    toggleLoginModal={this.props.toggleLoginModal}
                    miniaturized={true}
                    hideMiniActionRow={true}
                    sessionName={sessionName}
                    sessionInfo={sessionInfo}
                    defaultFeaturedSBTs={defaultFeaturedSBTs}
                    defaultSbtTags={defaultSbtTags}
                    isSBTCacheReady={this.props.isSBTCacheReady}
                    autoMintingMode={this.state.autoMintingMode}
                    showCreateGroupAboveFeatured={true}
                    showCreateGroupExternal={this.state.showEmbeddedCreateGroup}
                    onCreateGroupToggleExternal={this.toggleEmbeddedCreateGroup}
                    preferCacheBackedFeaturedCards={true}
                    telegramBuckets={telegramClientAuth.buckets || null}
                    refreshSbtData={this.props.refreshSbtData}
                    /* per-demo passthroughs */
                    sessionSlug={slug}
                    contracts={contracts}
                    blockLimits={blockLimits}
                    networkChainId={networkChainId}
                    /* Pass sessionConfig including the autoFeature flag so SBTsPage can read it */
                    sessionConfig={resolvedSessionConfig}
                    sbtScanProgressBySlug={this.props.sbtScanProgressBySlug}
                    sbtRealtimeCoverageBySlug={this.props.sbtRealtimeCoverageBySlug}
                    ensureLightSbtDiscovery={this.props.ensureLightSbtDiscovery}
                    ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
                  />
                </Suspense>
              </div>
            )}
          </div>

          {/* Documents Section */}
          {isDemoSlug && (
            <div
              className={`${styles.sectionContainer} ${this.state.showDocuments ? styles.sectionExpanded : ''}`}
              data-testid='ce-demo-documents-section'
            >
            <div className={styles.sectionHeaderRow}>
              <h2
                onClick={this.toggleDocuments}
                className={`${styles.sectionHeader} ${styles.documentsSectionHeader}`.trim()}
                data-testid='ce-demo-documents-toggle'
              >
                <span className={styles.documentsSectionHeaderMain}>
                  {this.state.showDocuments ? (
                    <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
                  ) : (
                    <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
                  )}
                  <span className={`${styles.sectionHeaderText} ${styles.documentsSectionHeaderText}`.trim()}>
                    <span className={styles.documentsSectionHeaderTitleRow}>
                      <span className={styles.sectionHeaderTitle}>Context</span>
                      {this.state.showDocuments && (
                        <span className={`${styles.sectionHeaderMeta} ${styles.documentsSectionHeaderMeta}`.trim()}>
                          <div
                            className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                            onClick={(e: any) => e.stopPropagation()}
                          >
                            <FontAwesomeIcon icon={faQuestionCircle} />
                            <span className={styles.tooltiptext}>
                              {documentsSectionTooltip}
                            </span>
                          </div>
                          <a
                            href={DEMO_CORPUS_GITHUB_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.sectionHeaderLink}
                            onClick={(e: any) => e.stopPropagation()}
                          >
                            <FontAwesomeIcon icon={faExternalLinkAlt} />
                            <span>GitHub</span>
                          </a>
                          <button
                            type="button"
                            className={`${styles.sectionHeaderLink} ${styles.sectionHeaderLinkButton}`.trim()}
                            onClick={this.handleLoadFullCorpusClick}
                            disabled={disableLoadFullCorpusButton}
                            data-testid='ce-demo-documents-load-full-corpus'
                          >
                            <FontAwesomeIcon icon={faDownload} />
                            <span>{loadFullCorpusButtonLabel}</span>
                          </button>
                        </span>
                      )}
                    </span>
                    <span className={styles.sectionHeaderSubtitle}>View</span>
                  </span>
                </span>
              </h2>
            </div>
              {this.state.showDocuments && (
                <div className={styles.miniSectionContent}>
                  <Suspense fallback={<LazyFallback label="Loading Corpus..." minHeight="20vh" />}>
                    <CorpusViewer
                      onAtlasIssueOpen={this.handleCorpusAtlasIssueOpen}
                      showGithubLink={false}
                      externalLoadRequestNonce={this.state.corpusViewerLoadRequestNonce}
                      onExternalLoadStateChange={this.handleCorpusViewerLoadStateChange}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* Results section */}
          <div className={`${styles.sectionContainer} ${this.state.showResults ? styles.sectionExpanded : ''}`}>
            <div className={styles.sectionHeaderRow}>
              <h2
                onClick={this.toggleResults}
                className={styles.sectionHeader}
                data-testid={E2E_TESTIDS.SESSION_RESULTS_TOGGLE}
              >
                {this.state.showResults ? (
                  <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
                ) : (
                  <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
                )}
                {renderSectionHeading('Results', 'View')}
                {this.state.showResults && (
                  <div
                    className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                    onClick={(e: any) => e.stopPropagation()}
                  >
                    <FontAwesomeIcon icon={faQuestionCircle} />
                    <span className={styles.tooltiptext}>
                      Click “Raw Results” to explore detailed breakdowns, filter by group membership,
                      and export a pol.is report.
                    </span>
                  </div>
                )}
              </h2>

              {this.state.showResults && (
                <div className={`${styles.sectionHeaderActionsScroller} ${styles.resultsModeActionsScroller}`}>
                  <div
                    className={`${styles.sectionHeaderActions} ${styles.resultsModeActions}`}
                    data-testid="ce-session-results-view-nav"
                  >
                    {resultsViewOptions.map(({ key, label, icon }: any) => {
                      const isSelected = resultsViewMode === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => this.setState({ resultsViewMode: key })}
                          className={`${styles.sectionHeaderViewModeButton} ${isSelected ? styles.sectionHeaderViewModeButtonActive : ''}`}
                          title={label}
                          aria-pressed={isSelected}
                        >
                          <span className={styles.sectionHeaderViewModeIcon} aria-hidden="true">{icon}</span>
                          <span className={styles.sectionHeaderViewModeLabel}>{label}</span>
                        </button>
                      );
                    })}
                    {telegramOnlySession && telegramClientLoggedIn && (
                      <button
                        type="button"
                        onClick={this.handleRefreshResultsClick}
                        className={styles.sectionHeaderActionButton}
                        data-testid="ce-session-results-refresh"
                        disabled={this.state.resultsRefreshing}
                      >
                        {this.state.resultsRefreshing ? (
                          <FontAwesomeIcon icon={faSpinner} spin />
                        ) : (
                          <FontAwesomeIcon icon={faSyncAlt} />
                        )}
                        Refresh results
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e: any) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleOpenResults();
                      }}
                      className={styles.sectionHeaderViewModeButton}
                    >
                      <FontAwesomeIcon icon={faExpand} />
                      Raw Results
                    </button>
                  </div>
                </div>
              )}
            </div>
            {this.state.showResults && (
              <div className={styles.miniSectionContent}>
                <div>
                  {resultsViewMode === 'polis' && telegramDataMode && (
                    this.renderTelegramResultsPanel()
                  )}
                  {resultsViewMode === 'debateMap' && telegramDataMode && (
                    this.renderTelegramTopicMapSection()
                  )}
                  {resultsViewMode === 'polis' && !telegramDataMode && (
                    <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
                      <PolisReport
                        onePageDemo={true}
                        miniMode={true}
                        account={effectiveAccount}
                        provider={this.props.provider}
                        network={this.props.network}
                        loginComplete={effectiveLoginComplete}
                        questionResponses={this.state.aggregatorData}
                        disclaimersActive={this.state.disclaimersActive}
                        filterState={this.state.filterState}
                        sessionName={sessionName}
                        sessionHeader={sessionHeader}
                        sessionInfo={sessionInfo}
                        defaultTags={defaultTags}
                        isQuestionCacheReady={this.props.isQuestionCacheReady}
                        isResponsesCacheReady={this.props.isResponsesCacheReady}
                        questionScanProgress={this.props.questionScanProgress}
                        questionResponsesNonce={this.props.questionResponsesNonce}
                        /* per-demo passthroughs */
                        sessionSlug={slug}
                        demoDataBySlug={resolvedPolisDemoDataBySlug}
                        contracts={contracts}
                        blockLimits={blockLimits}
                        networkChainId={networkChainId}
                      />
                    </Suspense>
                  )}
                  {isDemoSlug && resultsViewMode === 'analysis' && (
                    <Suspense fallback={<LazyFallback label="Loading Analysis..." minHeight="30vh" />}>
                      <DemoAnalysisWorkspace />
                    </Suspense>
                  )}
                  {isDemoSlug && resultsViewMode === 'debateAtlas' && (
                    <Suspense fallback={<LazyFallback label="Loading Debate Atlas..." minHeight="30vh" />}>
                      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
	                        <DebateMapAny
	                          account={effectiveAccount}
	                          provider={this.props.provider}
	                          network={this.props.network}
                          activeSessionSlug={slug}
                          toggleLoginModal={this.props.toggleLoginModal}
                          demoMode={true}
                          embedded={true}
                          requestedModalNodeId={this.state.embeddedAtlasNodeId}
                          onModalClose={this.state.embeddedAtlasReturnState ? this.handleEmbeddedAtlasModalClose : null}
	                        />
                      </div>
                    </Suspense>
                  )}
                  {isDemoSlug && resultsViewMode === 'riskMatrix' && (
                    <Suspense fallback={<LazyFallback label="Loading Risk Matrix..." minHeight="30vh" />}>
                      <RiskMatrix
                        embedded={true}
                        onOpenAtlasNode={this.handleCorpusAtlasIssueOpen}
                        restoreState={this.state.riskMatrixRestoreState}
                        onRestoreApplied={this.handleRiskMatrixRestoreApplied}
                      />
                    </Suspense>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default OnePageSession;
