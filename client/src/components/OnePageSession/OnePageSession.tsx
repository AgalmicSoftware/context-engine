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
  faSignOutAlt,
} from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { createLitHooks } from '../../utilities/crypto/litProtocol.js';
import { ethers } from 'ethers';

import styles from './OnePageSession.module.scss';

import LazyFallback from '../Shared/LazyFallback';

import {
  getNativeBalance,
  hasNativeBalanceReader,
  type SessionBalance,
} from '../../domains/sessions/sessionBalanceReaders.js';
import { getAllSessionSlugs } from '../../domains/sessions/sessionConfig.js';
import { sbtGroupMintAuthorizationPort } from '../../domains/sbts/sbtGroupMintAuthorizationPort.js';
import { sbtMetadataReadsPort } from '../../domains/sbts/sbtMetadataReadsPort.js';
import { sbtMintExecutionPort } from '../../domains/sbts/sbtMintExecutionPort.js';


import styles from './OnePageSession.module.scss';

import LazyFallback from '../Shared/LazyFallback';

import contractScripts, { getAllSessionSlugs } from '../../utilities/web3/contractScripts.js';

import { resolveEffectiveSlug, normalizeSurveyToolFilterState } from '../SurveyTool/surveyToolUtils.js';
import { resolvePolisDemoQuestionPool } from '../SurveyTool/surveyPolisDemoQuestionPool.js';
import { serializeFilterState, deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { createLogger } from 'utilities/logging.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { listNamespaceEntriesSync, peekCacheSync, writeCache } from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import { readPublicUrlBasePath } from '../../utilities/ui/publicUrl.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import { isCryptoMode, sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { PUBLIC_AI_DISCOURSE_CORPUS_URL } from '../../variables/publicRepoMetadata.js';
import { resolveMainSiteLitSessionConfig } from '../MainSite/litSessionConfig.js';
import type { RiskMatrixRestoreState } from '../MainContent/RiskMatrix';
import { clearAgentClientLoginEnvelope, readAgentClientLoginEnvelope } from '../../utilities/session/agentClientLogin';
import {
  envelopeAllowsSubmit,
  loadGroups as loadTelegramGroups,
  loadQuestions as loadTelegramQuestions,
  loadResultsDataset as loadTelegramResultsDataset,
  submitAnswer as submitTelegramAnswer,
  type TelegramAnswerInput,
  type TelegramResultsDataset,
} from '../../utilities/session/telegramSessionBackend';
import {
  isTelegramAgentAuthFailure,
  type TelegramAgentQuestion,
} from '../../utilities/session/telegramAgentData';
import {
  buildAggregatorFromLocalCache,
  computeAggregatorDataSignature,
  computeAggregatorQuestionMetadataSignature,
  computeAggregatorSourceSnapshotSignature,
} from './onePageSessionAggregator';
import OnePageSessionAutoMintAlerts from './OnePageSessionAutoMintAlerts';
import OnePageSessionTelegramShell from './OnePageSessionTelegramShell';
import {
  buildCurrentSessionConfigRequest,
  getAgentClientLoginEnvelopeMemoryKey,
  isOnePageTelegramBackendMode,
  normalizeOnePageSessionSlug,
  resolveAgentClientLoginIdentityTarget,
  resolveCurrentSessionSlugForProps,
  resolveTelegramAgentBridgeUrl as resolveTelegramAgentBridgeUrlForSession,
  type OnePageSessionPropsLike,
} from './onePageSessionTelegramController';
import {
  buildInitialTelegramState,
  createOnePageSessionTelegramActions,
  type OnePageSessionTelegramState,
} from './onePageSessionTelegramActions';
import OnePageSessionStandardShell, { DEFAULT_CORPUS_VIEWER_LOAD_STATE } from './OnePageSessionStandardShell';
import {
  buildOnePageSessionCanonicalBaseUrl,
  buildOnePageSessionRawResultsRoute,
  resolveOnePageSessionAggregatorCacheScope,
  resolveOnePageSessionRouteUiState,
} from './onePageSessionRouteRuntime';
import {
  closeStaleSbtGroupEditor,
  hasCachedCreateSbtForm,
  hasCachedOnChainSbtGroup,
  sessionSupportsOnChainSbt,
  shouldKickoffSbtUniverseScan,
} from './onePageSessionSbtGroupRuntime';
import {
  buildSbtAutoMintCredentialCleanPath,
  clearUnsupportedSbtAutoMintState,
  hasSbtAutoMintCredential,
  initializeSbtAutoMintRuntime,
  sanitizeSbtAutoMintQueryForStorage,
} from './onePageSessionAutoMintRuntime';
import { resolveOnePageSessionNetworkRuntime, sessionAllowsLitRuntime } from './onePageSessionCapabilityRuntime';
import {
  workerCanonicalCacheIdentityMatches,
  withWorkerCanonicalCacheIdentity,
} from '../../utilities/survey/workerCanonicalCacheIdentity';
import {
  buildAggregatorFallbackQuestions,
  getUniqueAggregatorCandidateSlugs,
  mergeAggregatorResultRows,
  resolveOnePageSessionSurveySlug,
  resolveOnePageSessionWorkerCacheIdentity,
  scopeAggregatorNetworkNodeToQuestionPool,
  shouldUseBuiltInDemoAggregatorFallback,
} from './onePageSessionAggregatorCacheRuntime';

const demoLog = createLogger('demo');
const ONE_PAGE_DEMO_PERF_SCOPE = 'onePageDemo';
const SBT_TOOLTIP_LABEL = isCryptoMode() ? 'Soulbound tokens (SBTs)' : `${t('sbtFull')}s`;
const DEMO_CORPUS_GITHUB_URL = PUBLIC_AI_DISCOURSE_CORPUS_URL;
const DEFAULT_AGENT_BRIDGE_URL = 'https://ce-agent-bridge-worker.agalmic.workers.dev';
const DEFAULT_CORPUS_VIEWER_LOAD_STATE = Object.freeze({
  activeCorpusKey: 'cross_corpus',
  activeCorpusLabel: 'Cross-Corpus',
  loadStatus: 'idle',
  loadButtonLabel: 'Load full corpus',
  disableLoadButton: false,
  error: '',
});
const globalState: any = globalThis as any;
const contractScriptsAny: any = contractScripts as any;
const DebateMapAny: any = DebateMap;

const getErrorMessage = (error: unknown, fallback = 'Unknown error') =>
  error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
    ? (error as { message: string }).message
    : fallback;

const normalizeAutoMintAccount = (account: unknown): string =>
  String(account || '')
    .trim()
    .toLowerCase();

const resolveAutoFeatureBySessionSlug = (metadata: Record<string, unknown> | null | undefined) =>
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags;

const isPerfCountersEnabled = () => {
  try {
    return (
      typeof globalThis !== 'undefined' &&
      (globalState.ENABLE_CE_UI_PERF_STATS === true ||
        globalState.ENABLE_CE_DEBUG_COUNTERS === true ||
        globalState.__CE_DEBUG_COUNTERS__ === true)
    );
  } catch (_) {
    return false;
  }
};

const bumpPerfCounter = (key: string, inc: number = 1) => {
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
  } catch (e) {
    void e; /* fallback: perf counter update. */
  }
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

const normalizeOnePageSessionFilterState = (value: unknown = {}) => {
  const normalized = normalizeSurveyToolFilterState(value && typeof value === 'object' ? value : {});
  return Object.keys(normalized).length > 0 ? normalized : buildOnePageSessionEmptyFilterState();
};

const serializeOnePageSessionFilterState = (value: unknown = {}) =>
  serializeFilterState(normalizeOnePageSessionFilterState(value));

export { buildAggregatorFromLocalCache, computeAggregatorSourceSnapshotSignature, hasCachedCreateSbtForm };

class OnePageSession extends Component<any, any> {
  [key: string]: any;

  constructor(props: any) {
    super(props);
    const initialSlug = resolveEffectiveSlug(props);
    const initialAgentLoginTarget = resolveAgentClientLoginIdentityTarget({
      sessionConfig: props.sessionConfig,
      sessionSlug: initialSlug,
    });
    const showEmbeddedCreateGroup = hasCachedOnChainSbtGroup(props.sessionConfig, initialSlug);
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
      demoLog.error('Error hydrating filter state:', e);
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

      ...buildInitialTelegramState(initialAgentLoginTarget, readAgentClientLoginEnvelope),
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
      normalizeOnePageSessionFilterState(props.defaultFilterState || {}),
    );
    this._resolvedSessionConfigMemoInputs = null;
    this._resolvedSessionConfigMemoValue = null;
    this._autoMintLegacyCredentialQuery = '';
    this._autoMintParseSourceSig = '';
    this._autoMintCountdownTimer = null;
    this._autoMintParseCachedTargets = [];
    this._autoOpenResultsTimer = null;
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

    this.restoreTelegramEnvelopeFromStorage = this.restoreTelegramEnvelopeFromStorage.bind(this);
    this.loadTelegramSessionMeta = this.loadTelegramSessionMeta.bind(this);
    this.loadTelegramAgentQuestions = this.loadTelegramAgentQuestions.bind(this);
    this.loadTelegramAgentResults = this.loadTelegramAgentResults.bind(this);
    this.loadTelegramAgentData = this.loadTelegramAgentData.bind(this);
    this.handleTelegramQuestionSubmit = this.handleTelegramQuestionSubmit.bind(this);
    this.handleTelegramLogout = this.handleTelegramLogout.bind(this);
    this.handleTelegramAuthFailure = this.handleTelegramAuthFailure.bind(this);
    this.handleAgentClientLoginEvent = this.handleAgentClientLoginEvent.bind(this);
  }

  kickoffLightSbtUniverseScan(propsIn: any = this.props) {
    if (typeof propsIn?.ensureLightSbtUniverse !== 'function') return;
    if (!shouldKickoffSbtUniverseScan(this, propsIn, this.props)) return;
    const slug = resolveEffectiveSlug(propsIn);
    try {
      const result = propsIn.ensureLightSbtUniverse([slug], { forceScopeSlug: slug });
      if (result && typeof result.catch === 'function') {
        result.catch((e: any) => {
          demoLog.warn('OnePageSession: callback', e);
        });
      }
    } catch (e) {
      demoLog.warn('OnePageSession: callback', e);
    }
  }

  clearUnsupportedAutoMintState(updateState = true) {
    clearUnsupportedSbtAutoMintState(this, updateState, (error) => demoLog.warn('OnePageSession: fallback', error));
  }

  componentDidMount() {
    const routeUiState = resolveOnePageSessionRouteUiState(this.props);
    this.recordOriginalURL(routeUiState.showQuestions ? buildOnePageSessionCanonicalBaseUrl(this.props) : null);
    this.kickoffLightSbtUniverseScan(this.props);

    // Make redirect flag group-aware (avoid cross-group bleed)
    try {
      const slug = resolveEffectiveSlug(this.props);
      sessionStorage.setItem(`dg:hasRedirectedToDemo:${slug}`, 'true');
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }

    initializeSbtAutoMintRuntime(this, (error) => demoLog.warn('OnePageSession: fallback', error));

    initializeSbtAutoMintRuntime(this, (error) => demoLog.warn('OnePageSession: fallback', error));

    window.addEventListener('sbt-mint-success', this.onSbtMintSuccess);
    window.addEventListener('ce-agent-client-login', this.handleAgentClientLoginEvent as EventListener);

    // Auto-open Groups section if a Create-SBT cache exists (idempotent, group-aware)
    try {
      const slug = resolveEffectiveSlug(this.props);
      if (hasCachedOnChainSbtGroup(this.resolveCurrentSessionConfig(), slug) && !this._autoOpenedGroups) {
        this.setState({ showGroups: true });
        this._autoOpenedGroups = true;
      }
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }

    this._aggregatorInputSig = this.buildAggregatorInputSignature(this.props, this.state);

    if (this.isTelegramBackendMode(this.resolveCurrentSessionConfig())) {
      const envelope = this.restoreTelegramEnvelopeFromStorage();
      if (envelope) {
        this.loadTelegramAgentData(true);
      } else {
        this.loadTelegramSessionMeta();
      }
    }
  }

  componentWillUnmount() {
    this.disposeTelegramActions();
    this._autoMintLegacyCredentialQuery = '';
    window.removeEventListener('ce-agent-client-login', this.handleAgentClientLoginEvent as EventListener);
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
    const displaySlug = resolveEffectiveSlug(props);
    const questionCacheSlug = resolveOnePageSessionSurveySlug(props);
    const cacheScope = resolveOnePageSessionAggregatorCacheScope(props);
    const workerCacheIdentity = resolveOnePageSessionWorkerCacheIdentity(props, cacheScope);
    return [
      String(displaySlug || ''),
      String(questionCacheSlug || ''),
      cacheScope,
      cacheScope === 'worker' ? workerCacheIdentity?.key || 'invalid-worker-identity' : '',
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
    const baseSessionConfig =
      incomingSessionConfig && typeof incomingSessionConfig === 'object' ? incomingSessionConfig : {};

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

    const propAutoFeature =
      autoFeatureSBTsBySessionSlug !== undefined ? autoFeatureSBTsBySessionSlug : autoFeatureSBTsWithFeaturedSbtTags;
    const resolvedAutoFeature =
      propAutoFeature !== undefined ? propAutoFeature : resolveAutoFeatureBySessionSlug(baseSessionConfig);
    const resolvedSlug = slug || baseSessionConfig.slug || '';
    const resolved = {
      ...baseSessionConfig,
      slug: resolvedSlug,
      sessionName,
      questionsGenPrompt,
      contracts: contracts && typeof contracts === 'object' ? contracts : baseSessionConfig.contracts || {},
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
    if (!sessionAllowsLitRuntime(sessionConfig)) return null;
    if (this.props.litHooks && typeof this.props.litHooks === 'object') {
      return this.props.litHooks;
    }
    const { chainId, litNetwork, litChain, accessControlConditions, userMaxPrice, chipotle } =
      resolveMainSiteLitSessionConfig({
        sessionConfig,
        networkChainIdFallback:
          this.props.networkChainId || this.props.network?.id || this.props.network?.chainId || null,
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

  resolveCurrentSessionSlug(propsIn: any = this.props) {
    return normalizeOnePageSessionSlug(resolveEffectiveSlug(propsIn) || propsIn.sessionConfig?.slug || '');
  }

  resolveCurrentSessionConfig(propsIn: any = this.props) {
    const slug = this.resolveCurrentSessionSlug(propsIn);
    return this.getResolvedSessionConfig({
      slug,
      sessionName: propsIn.sessionName,
      questionsGenPrompt: propsIn.questionsGenPrompt,
      autoFeatureSBTsBySessionSlug: propsIn.autoFeatureSBTsBySessionSlug,
      autoFeatureSBTsWithFeaturedSbtTags: propsIn.autoFeatureSBTsWithFeaturedSbtTags,
      incomingSessionConfig: propsIn.sessionConfig,
      contracts: propsIn.contracts,
    });
  }

  resolveTelegramAgentBridgeUrl(sessionConfig: any = this.resolveCurrentSessionConfig()) {
    const cfg = sessionConfig && typeof sessionConfig === 'object' ? sessionConfig : {};
    const telegram = cfg.telegram && typeof cfg.telegram === 'object' ? cfg.telegram : {};
    return String(
      cfg.agentBridgeUrl ||
      cfg.agentBridgeWorkerUrl ||
      cfg.telegramAgentBridgeUrl ||
      telegram.agentBridgeUrl ||
      telegram.workerUrl ||
      DEFAULT_AGENT_BRIDGE_URL
    ).trim().replace(/\/+$/g, '');
  }

  isTelegramBackendMode(sessionConfig: any = this.resolveCurrentSessionConfig()) {
    return resolveSessionBackendKind({
      sessionConfig,
      probeResult: this.state.telegramSessionMeta,
    }) === 'telegram';
  }

  restoreTelegramEnvelopeFromStorage() {
    const sessionSlug = this.resolveCurrentSessionSlug();
    const envelope = readAgentClientLoginEnvelope(sessionSlug);
    const currentToken = this.state.telegramClientEnvelope?.credential?.token || '';
    const nextToken = envelope?.credential?.token || '';
    if (currentToken !== nextToken || this.state.telegramClientEnvelope?.sessionSlug !== envelope?.sessionSlug) {
      this.setState({ telegramClientEnvelope: envelope });
    }
    return envelope;
  }

  async loadTelegramSessionMeta() {
    const sessionSlug = this.resolveCurrentSessionSlug();
    const sessionConfig = this.resolveCurrentSessionConfig();
    const agentBridgeUrl = this.resolveTelegramAgentBridgeUrl(sessionConfig);
    if (!sessionSlug || !agentBridgeUrl) return null;
    this.setState({ telegramSessionMetaStatus: 'loading' });
    try {
      const url = new URL(`${agentBridgeUrl}/api/agent/session-meta`);
      url.searchParams.set('sessionSlug', sessionSlug);
      const response = await fetch(url.toString(), { method: 'GET', cache: 'no-store' });
      const body = await response.json().catch(() => null) as TelegramSessionMeta | null;
      if (!response.ok || !body || body.ok === false) {
        this.setState({ telegramSessionMetaStatus: 'error' });
        return null;
      }
      this.setState({
        telegramSessionMeta: body,
        telegramSessionMetaStatus: 'ready',
      });
      return body;
    } catch (_) {
      this.setState({ telegramSessionMetaStatus: 'error' });
      return null;
    }
  }

  handleTelegramAuthFailure(reason: any = '') {
    const sessionSlug = this.resolveCurrentSessionSlug();
    clearAgentClientLoginEnvelope(sessionSlug);
    this.clearTelegramEnvelopeMemoryCache(sessionSlug);
    this.setState({
      telegramClientEnvelope: null,
      telegramAgentQuestionsStatus: 'idle',
      telegramAgentQuestions: [],
      telegramAgentResultsStatus: 'idle',
      telegramAgentResults: null,
      telegramPolisDataset: null,
      telegramQuestionSubmitError: String(reason || 'Telegram session expired. Paste a fresh agent token.'),
    });
  }

  handleAgentClientLoginEvent(event: CustomEvent) {
    const detail = event?.detail || {};
    const envelope = detail.envelope as AgentClientLoginEnvelope | null;
    if (!envelope?.credential?.token) return;
    if (normalizeOnePageSessionSlug(envelope.sessionSlug) !== this.resolveCurrentSessionSlug()) return;
    this.setState({ telegramClientEnvelope: envelope }, () => this.loadTelegramAgentData(true));
  }

  clearTelegramEnvelopeMemoryCache(sessionSlug: any = this.resolveCurrentSessionSlug()) {
    try {
      const globalTarget = globalThis as any;
      const cache = globalTarget.__CE_AGENT_CLIENT_LOGIN_ENVELOPES__;
      if (cache && typeof cache === 'object') {
        delete cache[normalizeOnePageSessionSlug(sessionSlug) || 'general'];
      }
    } catch (_) {}
  }

  async loadTelegramAgentQuestions(force: any = false) {
    const sessionConfig = this.resolveCurrentSessionConfig();
    if (!this.isTelegramBackendMode(sessionConfig)) return null;
    const envelope = this.state.telegramClientEnvelope || this.restoreTelegramEnvelopeFromStorage();
    if (!envelope) return null;
    if (!force && this.state.telegramAgentQuestionsStatus === 'loading') return null;
    this.setState({ telegramAgentQuestionsStatus: 'loading', telegramQuestionSubmitError: '' });
    const result = await loadTelegramQuestions({
      envelope,
      agentBridgeUrl: this.resolveTelegramAgentBridgeUrl(sessionConfig),
    });
    if (!result.ok) {
      if (isTelegramAgentAuthFailure({ status: result.status, reason: result.reason })) {
        this.handleTelegramAuthFailure(result.reason);
      } else {
        this.setState({
          telegramAgentQuestionsStatus: 'error',
          telegramQuestionSubmitError: result.reason || 'Could not load Telegram questions.',
        });
      }
      return result;
    }
    this.setState({
      telegramAgentQuestionsStatus: 'ready',
      telegramAgentQuestions: result.questions || [],
      telegramAgentAnswerState: result.answerState || null,
      telegramQuestionPileIndex: 0,
    });
    return result;
  }

  async loadTelegramAgentResults(force: any = false) {
    const sessionConfig = this.resolveCurrentSessionConfig();
    if (!this.isTelegramBackendMode(sessionConfig)) return null;
    const envelope = this.state.telegramClientEnvelope || this.restoreTelegramEnvelopeFromStorage();
    if (!envelope) return null;
    if (!force && this.state.telegramAgentResultsStatus === 'loading') return null;
    this.setState({ telegramAgentResultsStatus: 'loading' });
    const result: TelegramResultsDataset = await loadTelegramResultsDataset({
      envelope,
      agentBridgeUrl: this.resolveTelegramAgentBridgeUrl(sessionConfig),
    });
    const authView = Object.values(result.views || {}).find((view: any) => view?.status === 'auth');
    if (authView) {
      this.handleTelegramAuthFailure((authView as any).reason);
      return result;
    }
    this.setState({
      telegramAgentResultsStatus: 'ready',
      telegramAgentResults: result,
      telegramPolisDataset: result.polisDataset,
    });
    return result;
  }

  loadTelegramAgentData(force: any = false) {
    this.loadTelegramSessionMeta();
    return Promise.all([
      this.loadTelegramAgentQuestions(force),
      this.loadTelegramAgentResults(force),
    ]);
  }

  async handleTelegramQuestionSubmit(question: TelegramAgentQuestion, answer: TelegramAnswerInput) {
    const envelope = this.state.telegramClientEnvelope;
    if (!envelopeAllowsSubmit(envelope, this.state.telegramSessionMeta)) {
      this.setState({ telegramQuestionSubmitError: 'Submitting from the client is not enabled for this deployment yet.' });
      return;
    }
    this.setState({ telegramSubmittingQuestionId: question.questionId, telegramQuestionSubmitError: '' });
    const result = await submitTelegramAnswer({
      envelope,
      agentBridgeUrl: this.resolveTelegramAgentBridgeUrl(),
      question,
      answer,
    });
    if (!result.ok) {
      if (isTelegramAgentAuthFailure({ status: result.status, reason: result.reason })) {
        this.handleTelegramAuthFailure(result.reason);
      } else {
        this.setState({
          telegramSubmittingQuestionId: '',
          telegramQuestionSubmitError: result.reason || 'Could not submit this answer.',
        });
      }
      return;
    }
    this.setState((prev: Readonly<OnePageSession['state']>) => ({
      telegramSubmittingQuestionId: '',
      telegramSubmittedQuestionIds: Array.from(new Set([
        ...(prev.telegramSubmittedQuestionIds || []),
        question.questionId,
      ])),
    }));
    this.loadTelegramAgentData(true);
  }

  handleTelegramLogout() {
    const sessionSlug = this.resolveCurrentSessionSlug();
    clearAgentClientLoginEnvelope(sessionSlug);
    this.clearTelegramEnvelopeMemoryCache(sessionSlug);
    this.setState({
      telegramClientEnvelope: null,
      telegramAgentQuestionsStatus: 'idle',
      telegramAgentQuestions: [],
      telegramAgentAnswerState: null,
      telegramQuestionPileIndex: 0,
      telegramSubmittingQuestionId: '',
      telegramSubmittedQuestionIds: [],
      telegramQuestionSubmitError: '',
      telegramAgentResultsStatus: 'idle',
      telegramAgentResults: null,
      telegramPolisDataset: null,
    });
  }

  componentDidUpdate(prevProps: any, prevState: any) {
    const prevSlug = normalizeOnePageSessionSlug(prevProps.slug || prevProps.sessionConfig?.slug || '');
    const nextSlug = normalizeOnePageSessionSlug(this.props.slug || this.props.sessionConfig?.slug || '');
    const slugChanged = prevSlug !== nextSlug;
    const telegramTargetChanged =
      getAgentClientLoginEnvelopeMemoryKey(
        resolveAgentClientLoginIdentityTarget({
          sessionConfig: this.resolveCurrentSessionConfig(prevProps),
          sessionSlug: prevSlug,
        }),
      ) !==
      getAgentClientLoginEnvelopeMemoryKey(
        resolveAgentClientLoginIdentityTarget({
          sessionConfig: this.resolveCurrentSessionConfig(this.props),
          sessionSlug: nextSlug,
        }),
      );
    const telegramIdentityChanged = slugChanged || telegramTargetChanged;
    if (telegramIdentityChanged) {
      this.handleTelegramComponentDidUpdate({
        slugChanged: true,
        loginJustCompleted: !prevProps.loginComplete && this.props.loginComplete,
      });
    }
    const prevRouteUiState = resolveOnePageSessionRouteUiState(prevProps);
    const nextRouteUiState = resolveOnePageSessionRouteUiState(this.props);
    const routeUiPatch: Record<string, any> = {};
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) {
      this.clearUnsupportedAutoMintState();
    }
    closeStaleSbtGroupEditor(
      routeUiPatch,
      slugChanged,
      this.state.showEmbeddedCreateGroup,
      this.resolveCurrentSessionConfig(),
    );
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
        : serializeOnePageSessionFilterState(normalizeOnePageSessionFilterState(prevProps.defaultFilterState || {}));
    const nextDefaultFilterState = normalizeOnePageSessionFilterState(this.props.defaultFilterState || {});
    const nextDefaultSig = serializeOnePageSessionFilterState(nextDefaultFilterState);
    const currentFilterSig = serializeOnePageSessionFilterState(this.state.filterState || {});
    const defaultFilterChanged = prevDefaultSig !== nextDefaultSig;
    const shouldResyncFromDefault =
      (slugChanged || defaultFilterChanged) &&
      (slugChanged || currentFilterSig === prevDefaultSig) &&
      currentFilterSig !== nextDefaultSig;
    if (
      slugChanged ||
      (typeof prevProps.ensureLightSbtUniverse !== 'function' &&
        typeof this.props.ensureLightSbtUniverse === 'function')
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
    if (slugChanged) this._autoMintLegacyCredentialQuery = '';
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
    const aggregatorInvalidated =
      slugChanged ||
      (this.props.isQuestionCacheReady && !prevProps.isQuestionCacheReady) ||
      resolveOnePageSessionAggregatorCacheScope(this.props) !== resolveOnePageSessionAggregatorCacheScope(prevProps) ||
      this.buildAggregatorInputSignature(this.props, this.state) !==
        this.buildAggregatorInputSignature(prevProps, prevState) ||
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce ||
      (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady && this.props.isResponsesCacheReady);

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
    if (!prevState.autoMintingMode && this.state.autoMintingMode && this.state.dismissedAutoMintingBanner) {
      bannerResetPatch.dismissedAutoMintingBanner = false;
    }
    if (!prevState.needsLoginForAutoMint && this.state.needsLoginForAutoMint && this.state.dismissedLoginBanner) {
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

    if (!telegramIdentityChanged) {
      this.handleTelegramComponentDidUpdate({
        slugChanged: false,
        loginJustCompleted: !prevProps.loginComplete && this.props.loginComplete,
      });
    }
  }

  scheduleBuildAggregator(
    delayMs: any = 100,
    inputSig: any = this.buildAggregatorInputSignature(this.props, this.state),
  ) {
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
        const safeLegacyValue = sanitizeSbtAutoMintQueryForStorage(legacyVal);
        if (safeLegacyValue) sessionStorage.setItem(newKey, safeLegacyValue);
        sessionStorage.removeItem(legacy);
      }
      const currentValue = sessionStorage.getItem(newKey);
      if (currentValue) {
        const safeCurrentValue = sanitizeSbtAutoMintQueryForStorage(currentValue);
        if (safeCurrentValue) {
          if (safeCurrentValue !== currentValue) sessionStorage.setItem(newKey, safeCurrentValue);
        } else {
          sessionStorage.removeItem(newKey);
        }
      }
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }
    return newKey;
  }

  getAutoMintAttemptStorageKey(sbtAddress: any, account: any = this.props.account) {
    const normalized = String(sbtAddress || '')
      .trim()
      .toLowerCase();
    const accountLower = String(account || '')
      .trim()
      .toLowerCase();
    const chainId =
      Number(
        this.props.sessionConfig?.networkChainId ||
          this.props.networkChainId ||
          this.props.network?.id ||
          this.props.network?.chainId ||
          0,
      ) || 0;
    return normalized && accountLower ? `autoMint:${accountLower}:${chainId || 'unknown'}:${normalized}` : '';
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
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }
  }

  filterUnconsumedAutoMintTargets(targets: any = [], account: any = this.props.account) {
    return (Array.isArray(targets) ? targets : []).filter(
      (target: any) => !this.hasConsumedAutoMintAttempt(target?.sbt, account),
    );
  }

  buildAggregator = () =>
    measureSync('ce.onePageDemo.buildAggregator', () => {
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

      const displaySlug = resolveEffectiveSlug(this.props);
      const questionSourceSlug = resolveOnePageSessionSurveySlug(this.props);
      const cacheScope = resolveOnePageSessionAggregatorCacheScope(this.props);
      const workerCacheIdentity = resolveOnePageSessionWorkerCacheIdentity(this.props, cacheScope);
      const useBuiltInDemoFallback = shouldUseBuiltInDemoAggregatorFallback(displaySlug, questionSourceSlug);
      const canBuildFromLocalCache = !!cacheScope && (this.props.isQuestionCacheReady || useBuiltInDemoFallback);

      if (canBuildFromLocalCache) {
        const netIdStr = cacheScope;
        if (netIdStr === 'worker' && !workerCacheIdentity) {
          applyAggregatorData({}, '0:0:0', `${displaySlug}|${questionSourceSlug}|${netIdStr}|invalid-worker-identity`);
          return;
        }
        try {
          const candidateSlugs = useBuiltInDemoFallback
            ? getUniqueAggregatorCandidateSlugs(displaySlug)
            : [normalizeOnePageSessionSlug(questionSourceSlug)];
          const demoQuestionPool = useBuiltInDemoFallback
            ? resolvePolisDemoQuestionPool({
                displaySlug,
                sourceSlug: questionSourceSlug,
              })
            : [];
          const aggregateMap: Record<string, any[]> = {};
          const sourceSigParts: string[] = [];
          let sawCandidateCache = false;
          let sawNetworkCache = false;

          for (const slug of candidateSlugs) {
            let qCache = peekCacheSync('questionsCache', slug, { clone: false }) || {};
            if (!qCache || typeof qCache !== 'object') qCache = {};
            if (Object.keys(qCache).length === 0) {
              sourceSigParts.push(`${slug || '__general__'}:empty-cache`);
              continue;
            }
            sawCandidateCache = true;

            const networkNode = qCache[netIdStr];
            if (!networkNode) {
              sourceSigParts.push(`${slug || '__general__'}:missing-net`);
              continue;
            }
            if (workerCacheIdentity && !workerCanonicalCacheIdentityMatches(networkNode, workerCacheIdentity)) {
              sourceSigParts.push(`${slug || '__general__'}:worker-identity-mismatch`);
              continue;
            }
            sawNetworkCache = true;

            const fallbackQuestions = buildAggregatorFallbackQuestions(demoQuestionPool, slug);
            const networkNodeForAggregation = useBuiltInDemoFallback
              ? scopeAggregatorNetworkNodeToQuestionPool(networkNode, fallbackQuestions, slug)
              : networkNode;

            sourceSigParts.push(
              [
                slug || '__general__',
                computeAggregatorSourceSnapshotSignature(networkNodeForAggregation.questionResponses || {}),
                computeAggregatorQuestionMetadataSignature(networkNodeForAggregation.questions || {}),
              ].join(':'),
            );

            const { map, dirty } = buildAggregatorFromLocalCache(networkNodeForAggregation, {
              parseMemo: this._aggregatorResponseParseMemo,
              sessionSlug: slug,
            });
            mergeAggregatorResultRows(aggregateMap, map);
            if (dirty) {
              if (workerCacheIdentity) {
                qCache[netIdStr] = withWorkerCanonicalCacheIdentity(
                  networkNode,
                  workerCacheIdentity,
                ) as typeof networkNode;
              }
              void writeCache('questionsCache', slug, qCache);
            }
          }

          if (!sawCandidateCache) {
            applyAggregatorData(
              {},
              '0:0:0',
              `${displaySlug}|${questionSourceSlug}|${netIdStr}|${workerCacheIdentity?.key || ''}|empty-cache`,
            );
            return;
          }

          if (!sawNetworkCache) {
            applyAggregatorData(
              {},
              '0:0:0',
              `${displaySlug}|${questionSourceSlug}|${netIdStr}|${
                workerCacheIdentity?.key || ''
              }|${sourceSigParts.join('|') || 'missing-net'}`,
            );
            return;
          }

          const sourceSigKey = `${displaySlug}|${questionSourceSlug}|${netIdStr}|${
            workerCacheIdentity?.key || ''
          }|${sourceSigParts.join('|')}`;
          if (sourceSigKey === this._aggregatorSourceSigKey) {
            bumpPerfCounter('aggregatorSourceSkips');
            return;
          }
          applyAggregatorData(aggregateMap, computeAggregatorDataSignature(aggregateMap), sourceSigKey);
        } catch (err) {
          demoLog.error('Error building aggregator in OnePageSession:', err);
          applyAggregatorData(
            {},
            '0:0:0',
            `${displaySlug}|${questionSourceSlug}|${netIdStr}|${workerCacheIdentity?.key || ''}|error`,
          );
        }
      } else {
        const netIdStr = cacheScope;
        applyAggregatorData(
          {},
          '0:0:0',
          `${displaySlug}|${questionSourceSlug}|${netIdStr}|${workerCacheIdentity?.key || ''}|not-ready`,
        );
      }
    });

  onSbtMintSuccess(eventOrSbtAddress: any = null) {
    const successfulSbtAddress =
      typeof eventOrSbtAddress === 'string' ? eventOrSbtAddress : eventOrSbtAddress?.detail?.sbtAddress;
    const successfulSbtKey = String(successfulSbtAddress || '')
      .trim()
      .toLowerCase();

    // Auto-close login modal and surface success state
    if (typeof this.props.toggleLoginModal === 'function') {
      try {
        this.props.toggleLoginModal(false);
      } catch (e) {
        demoLog.warn('OnePageSession: callback', e);
      }
    }
    this.setState(
      (prevState: Readonly<OnePageSession['state']>) => {
        const prevTargets = Array.isArray(prevState.autoMintTargets) ? prevState.autoMintTargets : [];
        const nextTargets = successfulSbtKey
          ? prevTargets.filter(
              (target: any) =>
                String(target?.sbt || '')
                  .trim()
                  .toLowerCase() !== successfulSbtKey,
            )
          : prevTargets;
        const autoMintComplete = nextTargets.length === 0;
        return {
          autoMintingMode: false,
          mintSuccess: autoMintComplete,
          autoMintTargets: nextTargets,
        };
      },
      () => {
        if ((this.state.autoMintTargets || []).length > 0) return;

        // Clear persisted auto-mint intent to prevent re-trigger on refresh
        try {
          sessionStorage.removeItem(this.getAutoHashStorageKey());
        } catch (e) {
          demoLog.warn('OnePageSession: fallback', e);
        }
        this._autoMintLegacyCredentialQuery = '';

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
        } catch (e) {
          demoLog.warn('OnePageSession: fallback', e);
        }
      },
    );
  }

  recordOriginalURL(urlIn: any = null) {
    if (this.originalURL || typeof window === 'undefined') return;
    const nextUrl =
      typeof urlIn === 'string' && urlIn
        ? urlIn
        : `${window.location.pathname || ''}${window.location.search || ''}${window.location.hash || ''}`;
    const cleanCredentialPath = buildSbtAutoMintCredentialCleanPath(
      new URL(nextUrl || '/', window.location.origin).href,
    );
    this.originalURL = cleanCredentialPath || nextUrl || '';
  }

  /* =======================
   * Helpers: prefetch names for banner
   * ======================= */
  async prefetchTargetNames(targets: any) {
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) return;
    const slug = resolveEffectiveSlug(this.props);

    // 1. Try to read from cache first to save RPC calls
    let cachedNames: Record<string, string> = {};
    let cachedImages: Record<string, unknown> = {};
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
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }

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
          info = await sbtMetadataReadsPort.getSbtMetadata('none', addr, slug);
        } catch (e) {
          demoLog.warn('OnePageSession: fallback', e);
        }
        const name = getSbtDisplayName(info) || `Group ${addr.slice(0, 6)}...`;
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
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }
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
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) {
      this.clearUnsupportedAutoMintState();
      return [];
    }
    // Preserve deliberate legacy credential-link compatibility in component memory only.
    let sourceQuery = '';
    try {
      const currentSearch = typeof window !== 'undefined' && window.location.search ? window.location.search : '';
      const saved = sessionStorage.getItem(this.getAutoHashStorageKey()) || '';
      const identityQuery = currentSearch || saved;
      const legacyCredentialQuery = String(this._autoMintLegacyCredentialQuery || '');
      if (hasSbtAutoMintCredential(currentSearch)) {
        this._autoMintLegacyCredentialQuery = currentSearch;
        sourceQuery = currentSearch;
      } else if (
        legacyCredentialQuery &&
        sanitizeSbtAutoMintQueryForStorage(legacyCredentialQuery) === sanitizeSbtAutoMintQueryForStorage(identityQuery)
      ) {
        sourceQuery = legacyCredentialQuery;
      } else {
        sourceQuery = identityQuery;
      }
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }

    const rawQuery = sourceQuery ? sourceQuery.replace(/^[?#]/, '') : '';
    const sourceSig = rawQuery;
    if (sourceSig === this._autoMintParseSourceSig) {
      const cachedTargets = Array.isArray(this._autoMintParseCachedTargets) ? this._autoMintParseCachedTargets : [];
      const filteredTargets = this.filterUnconsumedAutoMintTargets(cachedTargets);
      if (filteredTargets.length > 0 && !this.props.loginComplete && !this.state.needsLoginForAutoMint) {
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
    const seen = new Set<string>();

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
    const normalizedPairs = this.filterUnconsumedAutoMintTargets(pairs.map((target: any) => ({ ...target })));

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
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) {
      this.clearUnsupportedAutoMintState();
      return;
    }
    if (!Array.isArray(targets) || targets.length === 0) return;
    this.setState({ autoMintTargets: targets }, () => {
      // Prefetch group names so banner can include them before login
      this.prefetchTargetNames(this.state.autoMintTargets);
      this.kickoffAutoMintIfNeeded();
    });
  }

  hasAutoMintIntent() {
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) return false;
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
      if (hasAuto(this._autoMintLegacyCredentialQuery)) return true;
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
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) return false;
    const slug = resolveEffectiveSlug(this.props);
    try {
      // Read-only provider internally
      const onchainGph = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbtAddress, slug);
      const pw = cryptoUtils.normalizeGroupPasswordInput(password);
      if (!pw) return false;

      if (!onchainGph || onchainGph === ethers.constants.HashZero) {
        return false;
      }
      return (
        cryptoUtils.resolveGroupPasswordWalletScopeAddress({
          password: pw,
          sbtAddress,
          groupPasswordHash: onchainGph,
        }) !== null
      );
    } catch (err) {
      return false;
    }
  }

  kickoffAutoMintIfNeeded() {
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) {
      this.clearUnsupportedAutoMintState();
      return;
    }
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
    try {
      if (sessionStorage.getItem(cancelKey)) return;
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }

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
  async waitForSufficientBalance(
    providerIn: any,
    address: any,
    minimumBalanceWei: any,
    timeoutMs: any = 45000,
    pollIntervalMs: any = 2000,
  ) {
    try {
      const minBN = ethers.BigNumber.from(minimumBalanceWei || 0);
      if (!address || minBN.isZero()) {
        return true;
      }
      const readBalance = hasNativeBalanceReader() ? getNativeBalance : null;
      if (!readBalance) {
        return false;
      }

      // Group-aware read: rely on the session balance domain (no ad-hoc provider instantiation)
      const slug = resolveEffectiveSlug(this.props);
      const getBalance = async (): Promise<SessionBalance> => {
        try {
          return (await readBalance(address, slug)) || ethers.BigNumber.from(0);
        } catch {
          return ethers.BigNumber.from(0);
        }
      };

      const deadline = Date.now() + Number(timeoutMs || 0);
      let bal = await getBalance();
      if (bal.gte(minBN)) return true;

      while (Date.now() < deadline) {
        await new Promise((r: any) => setTimeout(r, pollIntervalMs || 0));
        try {
          bal = await getBalance();
        } catch (_) {
          continue;
        }
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
        result.catch((e: any) => {
          demoLog.warn('OnePageSession: fallback', e);
        });
      }
    } catch (e) {
      demoLog.warn('OnePageSession: callback', e);
    }
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
    if (!sessionSupportsOnChainSbt(this.resolveCurrentSessionConfig())) {
      this.clearUnsupportedAutoMintState();
      return;
    }
    const statuses = { ...(this.state.autoMintStatuses || {}) };
    const autoMintAccount = normalizeAutoMintAccount(this.props.account);
    const autoMintProvider = this.props.provider;
    const targets = this.filterUnconsumedAutoMintTargets(this.state.autoMintTargets || [], autoMintAccount).map(
      (target: any) => ({ ...target, autoMintAccount }),
    );
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
      Object.keys(queuedNameUpdates).forEach((k: any) => {
        delete queuedNameUpdates[k];
      });
      Object.keys(queuedImageUpdates).forEach((k: any) => {
        delete queuedImageUpdates[k];
      });

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
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }

    for (const t of targets) {
      const sbtAddr = t.sbt;
      const sbtKey = sbtAddr.toLowerCase();
      const queuedAccount = t.autoMintAccount;
      const queuedAccountIsCurrent = () =>
        !!queuedAccount && normalizeAutoMintAccount(this.props.account) === queuedAccount;

      if (this.hasConsumedAutoMintAttempt(sbtAddr, queuedAccount)) {
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
            const parsed = peekCacheSync<OnePageSbtCache>('sbtCache', s, { clone: false });
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
          } catch (e) {
            demoLog.warn('OnePageSession: fallback', e);
          }

          if (sbtInfo) break; // Found it, stop scanning slugs
        }

        // 2. NETWORK FALLBACK (Last Resort)
        if (!sbtInfo) {
          // 'none' provider = read-only RPC
          sbtInfo = await sbtMetadataReadsPort.getSbtMetadata('none', sbtAddr, currentSlug);
        }

        if (!queuedAccountIsCurrent()) {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (wallet changed)' });
          continue;
        }

        // 3. PREFLIGHT CHECKS
        sbtName = getSbtDisplayName(sbtInfo) || 'Group';
        // Queue banner visuals to flush with status updates (batched to reduce render bursts)
        queueSbtMetadata(sbtKey, sbtName, sbtInfo?.image);

        // Check if user already owns this SBT (from local cache; DG-scoped key)
        let alreadyOwned = false;
        try {
          const acctLower = queuedAccount;
          if (acctLower) {
            const normalizeAddressCountMap = (value: any = null) => {
              const out: Record<string, any> = {};
              Object.entries(value || {}).forEach(([addrRaw, countRaw]: any) => {
                const addr = String(addrRaw || '')
                  .toLowerCase()
                  .trim();
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
                  if (
                    !checkpointBackedPartialCounts &&
                    (Object.keys(mintedCountMap).length > 0 || Object.keys(burnedCountMap).length > 0)
                  ) {
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
        } catch (e) {
          demoLog.warn('OnePageSession: fallback', e);
        }

        if (alreadyOwned) {
          this.consumeAutoMintAttempt(sbtAddr, queuedAccount);
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
          const gph = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbtAddr, currentSlug);
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
                const onchainInfo = await sbtMetadataReadsPort.getSbtMetadata('none', sbtAddr, currentSlug);
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
      const userAddr = queuedAccount;
      try {
        if (!userAddr) throw new Error('Wallet not connected');
        if (!queuedAccountIsCurrent()) {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (wallet changed)' });
          continue;
        }

        // Gate before ANY gas-spending tx
        const hasFundsFirst = await this.waitForSufficientBalance(
          autoMintProvider,
          userAddr,
          MIN_BALANCE_WEI,
          WAIT_TIMEOUT_MS,
          WAIT_POLL_MS,
        );
        if (!hasFundsFirst) {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (no gas funds arrived in time)' });
          continue;
        }
        if (!queuedAccountIsCurrent()) {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (wallet changed)' });
          continue;
        }

        if (path === 'public') {
          await sbtMintExecutionPort.claim(autoMintProvider, sbtAddr);
          this.consumeAutoMintAttempt(sbtAddr, userAddr);
          updateStatus(sbtKey, { status: 'success', name: `Joined: ${sbtName || 'Group'}` });
          this.onSbtMintSuccess(sbtAddr);
        } else if (path === 'invite') {
          let payload = invitePayload;
          if (!payload) {
            const password = cryptoUtils.normalizeGroupPasswordInput(invitePassword);
            if (!password) throw new Error('Invalid group password');
            let walletScopeSbtAddress = sbtAddr;
            const onchainHash = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbtAddr, currentSlug);
            if (onchainHash && onchainHash !== ethers.constants.HashZero) {
              walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
                password,
                sbtAddress: sbtAddr,
                groupPasswordHash: onchainHash,
              });
              const localHash =
                walletScopeSbtAddress === null
                  ? null
                  : sbtGroupMintAuthorizationPort.computeGroupPasswordHash({
                      password,
                      sbtAddress: walletScopeSbtAddress,
                    });
              if (!localHash || String(localHash).toLowerCase() !== String(onchainHash).toLowerCase()) {
                throw new Error('Group password mismatch');
              }
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
                mintedTokens = await sbtMetadataReadsPort.getMintedTokens('none', sbtAddr, currentSlug);
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
              const invites = await sbtGroupMintAuthorizationPort.generateInvitePayloads({
                password,
                sbtAddress: sbtAddr,
                nonces: [nonce],
                walletScopeSbtAddress,
              });
              payload = invites && invites[0];
              if (!payload) throw new Error('Failed to generate invite');

              try {
                if (!queuedAccountIsCurrent()) throw new Error('Wallet changed during auto-join');
                await sbtMintExecutionPort.claimWithInvite(
                  autoMintProvider,
                  sbtAddr,
                  String(payload.nonce),
                  String(payload.signature),
                );
                lastError = null;
                break;
              } catch (err) {
                lastError = err;
              }

              let mintedAfter: any = null;
              try {
                mintedAfter = await sbtMetadataReadsPort.getMintedTokens('none', sbtAddr, currentSlug);
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
            if (!queuedAccountIsCurrent()) throw new Error('Wallet changed during auto-join');
            await sbtMintExecutionPort.claimWithInvite(
              autoMintProvider,
              sbtAddr,
              String(payload.nonce),
              String(payload.signature),
            );
          }
          this.consumeAutoMintAttempt(sbtAddr, userAddr);
          updateStatus(sbtKey, { status: 'success', name: `Joined: ${sbtName || 'Group'}` });
          this.onSbtMintSuccess(sbtAddr);
        } else if (path === 'unlimited') {
          await this.mintUnlimitedSBTWithGroupPassword(sbtAddr, t.gp, userAddr, autoMintProvider);
          this.consumeAutoMintAttempt(sbtAddr, userAddr);
          updateStatus(sbtKey, { status: 'success', name: `Joined: ${sbtName || 'Group'}` });
          this.onSbtMintSuccess(sbtAddr);
        } else {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (unknown path)' });
        }
      } catch (e: any) {
        const msg = (getErrorMessage(e, String(e || '')) || String(e || '')).toLowerCase();

        if (msg.includes('wallet changed during auto-join')) {
          updateStatus(sbtKey, { status: 'info', name: 'Skipped (wallet changed)' });
        } else if (msg.includes('already owns') || msg.includes('already joined') || msg.includes('user already has')) {
          // Graceful handling of "already owned" revert
          this.consumeAutoMintAttempt(sbtAddr, userAddr);
          updateStatus(sbtKey, { status: 'success', name: `Group Already Joined` });
          this.onSbtMintSuccess(sbtAddr);
        } else if (msg.includes('minting ended') || msg.includes('minting has ended')) {
          updateStatus(sbtKey, { status: 'failed', name: `Join Failed`, error: `${t('minting')} period has ended` });
        } else if (msg.includes('max tokens') || msg.includes('limit reached')) {
          updateStatus(sbtKey, { status: 'failed', name: `Join Failed`, error: 'Group limit reached' });
        } else {
          updateStatus(sbtKey, {
            status: 'failed',
            name: `Join Failed`,
            error: 'Join failed. Verify the credential and network, then retry.',
          });
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
  async mintUnlimitedSBTWithGroupPassword(
    sbtAddress: any,
    groupPassword: any,
    expectedAccount: any = this.props.account,
    provider: any = this.props.provider,
  ) {
    if (!this.props.loginComplete) {
      this.props.toggleLoginModal(true);
      throw new Error(`Please connect your ${t('walletLower')} first.`);
    }

    const pw = cryptoUtils.normalizeGroupPasswordInput(groupPassword);
    if (!pw) {
      throw new Error('Group password is required.');
    }
    const normalizedExpectedAccount = normalizeAutoMintAccount(expectedAccount);
    const assertExpectedAccountCurrent = () => {
      if (!normalizedExpectedAccount || normalizeAutoMintAccount(this.props.account) !== normalizedExpectedAccount) {
        throw new Error('Wallet changed during auto-join');
      }
    };
    assertExpectedAccountCurrent();

    const onchain = await sbtMetadataReadsPort.getGroupPasswordHash(
      'none',
      sbtAddress,
      resolveEffectiveSlug(this.props),
    );
    if (!onchain || onchain === ethers.constants.HashZero) throw new Error('No group password set on-chain');

    const walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
      password: pw,
      sbtAddress,
      groupPasswordHash: onchain,
    });
    const local =
      walletScopeSbtAddress === null
        ? null
        : sbtGroupMintAuthorizationPort.computeGroupPasswordHash({
            password: pw,
            sbtAddress: walletScopeSbtAddress,
          });
    if (!local || local.toLowerCase() !== onchain.toLowerCase()) {
      throw new Error('Password mismatch');
    }
    assertExpectedAccountCurrent();

    this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint' });

    const sig = await sbtGroupMintAuthorizationPort.signGroupMintAuthorization({
      password: pw,
      sbtAddress,
      userAddress: normalizedExpectedAccount,
      walletScopeSbtAddress,
    });

    assertExpectedAccountCurrent();
    const tx = await sbtMintExecutionPort.mintWithGroupSignature(provider, sbtAddress, String(sig || ''));

    this.setState({
      mintingStatus: 'success',
      transactionHash: tx.transactionHash,
      lastTransactionType: 'mint',
      lastMintTxHash: tx.transactionHash,
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
          try {
            window.scrollTo(0, el.offsetTop || 0);
          } catch (e) {
            demoLog.warn('OnePageSession: fallback', e);
          }
        }
      }
    };

    const slug = resolveEffectiveSlug(this.props); // keep group in URL

    this.setState({ showQuestions: true, autoOpenResults: false }, () => {
      scrollQuestionsIntoView();
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.pathname = buildOnePageSessionRawResultsRoute(this.props);
        nextUrl.searchParams.delete('sessionSlug');
        nextUrl.searchParams.delete('s');
        if (slug) {
          nextUrl.searchParams.set('session', slug);
        } else {
          nextUrl.searchParams.delete('session');
        }
        window.history.pushState({}, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
      } catch (e) {
        demoLog.warn('OnePageSession: fallback', e);
      }
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
        currentLoadState.activeCorpusKey === resolvedNextState.activeCorpusKey &&
        currentLoadState.activeCorpusLabel === resolvedNextState.activeCorpusLabel &&
        currentLoadState.loadStatus === resolvedNextState.loadStatus &&
        currentLoadState.loadButtonLabel === resolvedNextState.loadButtonLabel &&
        currentLoadState.disableLoadButton === resolvedNextState.disableLoadButton &&
        currentLoadState.error === resolvedNextState.error
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
        riskMatrixRestoreState:
          returnState?.resultsViewMode === 'riskMatrix' ? returnState?.riskMatrixRestoreState || null : null,
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

    try {
      window.history.replaceState({}, '', this.originalURL || fallbackURL);
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }
  }

  toggleQuestions() {
    this.setState(
      (prevState: Readonly<OnePageSession['state']>) => ({ showQuestions: !prevState.showQuestions }),
      () => {
        if (!this.state.showQuestions) {
          this.setState({ autoOpenResults: false });
        }
        this.resetDemoURL();
      },
    );
  }

  toggleGroups() {
    this.setState(
      (prevState: Readonly<OnePageSession['state']>) => ({ showGroups: !prevState.showGroups }),
      () => this.resetDemoURL(),
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
          const navEvent =
            typeof PopStateEvent === 'function'
              ? new PopStateEvent('popstate', { state: window.history.state })
              : new Event('popstate');
          window.dispatchEvent(navEvent);
        }
        return;
      } catch (e) {
        demoLog.warn('OnePageSession: fallback', e);
      }
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
    this.setState((prevState: Readonly<OnePageSession['state']>) =>
      prevState.pileSubmitRailVisible === nextVisible ? null : { pileSubmitRailVisible: nextVisible },
    );
  }

  toggleGroupsAbout() {
    this.setState((prevState: Readonly<OnePageSession['state']>) => ({ showGroupsAbout: !prevState.showGroupsAbout }));
  }

  toggleResults() {
    this.setState(
      (prevState: Readonly<OnePageSession['state']>) => ({ showResults: !prevState.showResults }),
      () => this.resetDemoURL(),
    );
  }

  toggleDocuments() {
    this.setState((prevState: Readonly<OnePageSession['state']>) => ({ showDocuments: !prevState.showDocuments }));
  }

  toggleResultsAbout() {
    this.setState((prevState: Readonly<OnePageSession['state']>) => ({
      showResultsAbout: !prevState.showResultsAbout,
    }));
  }

  /* =======================
   * Dismiss handlers (for “X” buttons)
   * ======================= */
  dismissLoginBanner() {
    this.setState({ dismissedLoginBanner: true });
  }
  dismissAutoMintingBanner() {
    this.setState({ dismissedAutoMintingBanner: true });
  }
  cancelAutoMintCountdown() {
    if (this._autoMintCountdownTimer) {
      clearInterval(this._autoMintCountdownTimer);
      this._autoMintCountdownTimer = null;
    }
    const cancelKey = 'ce:autoMintCancelled:' + (this.props.slug || 'general');
    try {
      sessionStorage.setItem(cancelKey, '1');
    } catch (e) {
      demoLog.warn('OnePageSession: fallback', e);
    }
    this.setState({ autoMintCountdown: null, autoMintingMode: false, dismissedAutoMintingBanner: true });
  }
  dismissStatusItem(addrKey: any) {
    const key = (addrKey || '').toLowerCase();
    this.setState((prev: Readonly<OnePageSession['state']>) => ({
      dismissedStatusItems: { ...(prev.dismissedStatusItems || {}), [key]: true },
    }));
  }

  toggleStatusImagePreview(addrKey: any) {
    const key = (addrKey || '').toLowerCase();
    this.setState((prev: Readonly<OnePageSession['state']>) => ({
      expandedImages: {
        ...prev.expandedImages,
        [key]: !prev.expandedImages[key],
      },
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
          try {
            window.scrollTo(0, el.offsetTop || 0);
          } catch (e) {
            demoLog.warn('OnePageSession: fallback', e);
          }
        }
      }
    });
  }

  renderTelegramQuestionsPanel() {
    return (
      <Suspense fallback={<LazyFallback label="Loading Telegram questions..." minHeight="20vh" />}>
        <TelegramQuestionPile
          activeIndex={this.state.telegramQuestionPileIndex}
          canSubmit={envelopeAllowsSubmit(this.state.telegramClientEnvelope, this.state.telegramSessionMeta)}
          disabledReason="Submitting from the client is not enabled for this deployment yet."
          questions={this.state.telegramAgentQuestions || []}
          status={this.state.telegramAgentQuestionsStatus}
          submittedQuestionIds={this.state.telegramSubmittedQuestionIds}
          submittingQuestionId={this.state.telegramSubmittingQuestionId}
          submitError={this.state.telegramQuestionSubmitError}
          onActiveIndexChange={(telegramQuestionPileIndex: number) => this.setState({ telegramQuestionPileIndex })}
          onSubmitAnswer={this.handleTelegramQuestionSubmit}
        />
      </Suspense>
    );
  }

  renderTelegramBucketsPanel() {
    return (
      <Suspense fallback={<LazyFallback label="Loading Telegram groups..." minHeight="20vh" />}>
        <TelegramBucketCards
          cards={loadTelegramGroups(this.state.telegramClientEnvelope)}
          onReconnect={() => this.props.toggleLoginModal?.(true)}
        />
      </Suspense>
    );
  }

  renderTelegramResultsPanel({
    sessionName,
    sessionHeader,
    sessionInfo,
    defaultTags,
    displaySessionSlug,
    contracts,
    blockLimits,
    networkChainId,
  }: any) {
    const resultsMode = this.state.resultsViewMode === 'debateAtlas' ? 'debateAtlas' : 'polis';
    const polisDataset = this.state.telegramPolisDataset;
    return (
      <section className={styles.telegramListPanel} data-testid="ce-session-telegram-results">
        <div className={styles.telegramListHeader}>
          <span>Results</span>
          <div className={styles.telegramTabs}>
            <button
              type="button"
              className={`${styles.telegramTabButton} ${resultsMode === 'polis' ? styles.telegramTabButtonActive : ''}`}
              aria-pressed={resultsMode === 'polis'}
              onClick={() => this.setState({ resultsViewMode: 'polis' })}
            >
              Report
            </button>
            <button
              type="button"
              className={`${styles.telegramTabButton} ${resultsMode === 'debateAtlas' ? styles.telegramTabButtonActive : ''}`}
              aria-pressed={resultsMode === 'debateAtlas'}
              onClick={() => this.setState({ resultsViewMode: 'debateAtlas' })}
            >
              Debate Map
            </button>
          </div>
        </div>
        {this.state.telegramAgentResultsStatus === 'loading' ? (
          <div className={styles.telegramListEmpty}>Loading results...</div>
        ) : null}
        {resultsMode === 'polis' && polisDataset ? (
          <>
            {polisDataset.synthesized ? (
              <p className={styles.telegramReportApprox} data-testid="ce-session-telegram-report-approx">
                Approximate report: raw participant vectors are not available yet, so this view synthesizes a deterministic aggregate dataset.
              </p>
            ) : null}
            <Suspense fallback={<LazyFallback label="Loading Polis report..." minHeight="20vh" />}>
              <PolisReport
                onePageDemo={true}
                miniMode={true}
                account={this.props.account}
                provider={this.props.provider}
                network={this.props.network}
                loginComplete={this.props.loginComplete}
                questionResponses={polisDataset.aggregator}
                disclaimersActive={this.state.disclaimersActive}
                filterState={this.state.filterState}
                sessionName={sessionName}
                sessionHeader={sessionHeader}
                sessionInfo={sessionInfo}
                defaultTags={defaultTags}
                isQuestionCacheReady={true}
                isResponsesCacheReady={true}
                questionScanProgress={this.props.questionScanProgress}
                questionResponsesNonce={this.props.questionResponsesNonce}
                sessionSlug={displaySessionSlug}
                demoDataFirstLoad={false}
                contracts={contracts}
                blockLimits={blockLimits}
                networkChainId={networkChainId}
              />
            </Suspense>
          </>
        ) : null}
        {resultsMode === 'polis' && !polisDataset && this.state.telegramAgentResultsStatus !== 'loading' ? (
          <div className={styles.telegramListEmpty}>No participant-visible results are available yet.</div>
        ) : null}
        {resultsMode === 'debateAtlas' ? (
          <Suspense fallback={<LazyFallback label="Loading debate map prompt..." minHeight="20vh" />}>
            <TelegramDebateMapPanel
              questions={this.state.telegramAgentQuestions || []}
              results={this.state.telegramAgentResults}
            />
          </Suspense>
        ) : null}
      </section>
    );
  }

  renderTelegramSessionShell({
    titleText,
    sessionInfo,
    sessionName,
    sessionHeader,
    defaultTags,
    displaySessionSlug,
    contracts,
    blockLimits,
    networkChainId,
  }: any) {
    const envelope = this.state.telegramClientEnvelope as AgentClientLoginEnvelope | null;
    if (!envelope) {
      return (
        <div className={styles.onePageDemoContainer}>
          <div className={styles.telegramOnlyShell}>
            <div className={styles.telegramHeaderText}>
              <h2 className={styles.telegramHeaderTitle}>{titleText}</h2>
              {sessionInfo ? <p className={styles.telegramHeaderSubtitle}>{sessionInfo}</p> : null}
            </div>
            <Alert
              color="info"
              className={styles.telegramOnlyNotice}
              data-testid={E2E_TESTIDS.SESSION_TELEGRAM_ONLY_NOTICE}
              fade={false}
            >
              <strong>Telegram-first session</strong>
              <span>
                Sign in with a Context Engine agent token to view questions, groups, and participant-visible results in the web client.
              </span>
              <button
                type="button"
                className={styles.telegramPrimaryButton}
                data-testid="ce-session-telegram-login-open"
                onClick={() => this.props.toggleLoginModal?.(true)}
              >
                Log in with agent token
              </button>
            </Alert>
          </div>
        </div>
      );
    }

    return (
      <div className={styles.onePageDemoContainer}>
        <div className={styles.telegramShell}>
          <header className={styles.telegramHeader}>
            <div className={styles.telegramHeaderText}>
              <h2 className={styles.telegramHeaderTitle}>{titleText}</h2>
              {sessionInfo ? <p className={styles.telegramHeaderSubtitle}>{sessionInfo}</p> : null}
            </div>
            <button
              type="button"
              className={styles.telegramSecondaryButton}
              onClick={() => this.loadTelegramAgentData(true)}
              data-testid="ce-session-telegram-refresh"
            >
              <FontAwesomeIcon icon={faSyncAlt} />
              <span>Refresh</span>
            </button>
          </header>
          <div className={styles.telegramAuthBar}>
            <span className={styles.telegramAuthIndicator}>Signed in from Telegram</span>
            <button
              type="button"
              className={styles.telegramLogoutButton}
              data-testid="ce-session-telegram-logout"
              onClick={this.handleTelegramLogout}
            >
              <FontAwesomeIcon icon={faSignOutAlt} />
              <span>Logout</span>
            </button>
          </div>
          <div className={styles.telegramGrid}>
            {this.renderTelegramQuestionsPanel()}
            {this.renderTelegramBucketsPanel()}
            {this.renderTelegramResultsPanel({
              sessionName,
              sessionHeader,
              sessionInfo,
              defaultTags,
              displaySessionSlug,
              contracts,
              blockLimits,
              networkChainId,
            })}
          </div>
        </div>
      </div>
    );
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
    const { network: routedNetwork, networkChainId: routedNetworkChainId } = resolveOnePageSessionNetworkRuntime(
      resolvedSessionConfig,
      this.props.network,
    );
    const scopedLitHooks = this.resolveScopedLitHooks(resolvedSessionConfig);
    const effectiveSlug = resolveEffectiveSlug(this.props) || slug;
    const surveySessionSlug = resolveOnePageSessionSurveySlug({
      ...this.props,
      sessionConfig: resolvedSessionConfig,
    });
    // Only show demo-specific result surfaces on configured public demo sessions.
    const isDemoSlug = isDemoSessionSlug(effectiveSlug);
    const displaySessionSlug = normalizeOnePageSessionSlug(effectiveSlug || slug);
    const demoQuestionPool = resolvePolisDemoQuestionPool({
      displaySlug: displaySessionSlug,
      sourceSlug: surveySessionSlug,
    });
    const scopedDemoQuestionPool =
      demoQuestionPool.length > 0
        ? demoQuestionPool.map((entry: any) => ({
            ...entry,
            sessionSlug: displaySessionSlug,
            sessionSlugExplicit: true,
          }))
        : [];
    const sharedQuestionPool = scopedDemoQuestionPool.length > 0 ? scopedDemoQuestionPool : undefined;
    const embeddedQuestionSessionSlug = sharedQuestionPool ? displaySessionSlug : surveySessionSlug;
    const embeddedGroupsSessionSlug = displaySessionSlug || surveySessionSlug;
    const embeddedGroupsSessionConfig = isDemoSlug
      ? {
          ...resolvedSessionConfig,
          slug: embeddedGroupsSessionSlug,
          autoFeatureSBTsBySessionSlug: true,
        }
      : resolvedSessionConfig;
    const resultsViewMode = isDemoSlug ? this.state.resultsViewMode : 'polis';
    const resultsViewOptions = [
      { key: 'polis', label: 'Report', icon: '🧾' },
      ...(isDemoSlug
        ? [
            { key: 'debateAtlas', label: 'Debate Map', icon: '🗺️' },
            { key: 'analysis', label: 'Breakdown', icon: '📊' },
            { key: 'riskMatrix', label: 'Risk Matrix', icon: '⚠️' },
          ]
        : []),
    ];
    const basePath = readPublicUrlBasePath();
    const sectionsGridClassName = [styles.sectionsGrid, !isDemoSlug ? styles.sectionsGridTwoUp : '']
      .filter(Boolean)
      .join(' ');

    const fallbackSessionLabel = slug && String(slug).trim() ? String(slug).trim() : 'Session';
    const titleText = sessionName ? `${sessionName}` : fallbackSessionLabel;
    const renderSectionHeading = (title: any, subtitle: any) => (
      <span className={styles.sectionHeaderText}>
        <span className={styles.sectionHeaderTitle}>{title}</span>
        <span className={styles.sectionHeaderSubtitle}>{subtitle}</span>
      </span>
    );
    const questionsSectionTitle = renderSectionHeading('Questions', 'Answer or Add');
    const questionsSectionTooltip =
      'Survey and question platform allowing detailed responses, advanced question formats, preference weighing, and group filtering.';
    const documentsSectionTooltip =
      'Allows the conversation to be enriched by data, and the formats can change per-session';
    const corpusViewerLoadState = this.state.corpusViewerLoadState || DEFAULT_CORPUS_VIEWER_LOAD_STATE;
    const loadFullCorpusButtonLabel =
      corpusViewerLoadState.loadButtonLabel || DEFAULT_CORPUS_VIEWER_LOAD_STATE.loadButtonLabel;
    const disableLoadFullCorpusButton = !!corpusViewerLoadState.disableLoadButton;
    const pileSubmitRailActive = !this.state.showQuestions && this.state.pileSubmitRailVisible;
    const brandingSectionClassName = [
      styles.brandingSection,
      pileSubmitRailActive ? styles.brandingSectionWithPileSubmitRail : '',
    ]
      .filter(Boolean)
      .join(' ');
    const titleContainerClassName = [
      styles.titleContainer,
      pileSubmitRailActive ? styles.titleContainerWithPileSubmitRail : '',
    ]
      .filter(Boolean)
      .join(' ');
    const isTelegramSession = isOnePageTelegramBackendMode({
      sessionConfig: resolvedSessionConfig,
      probeResult: this.state.telegramSessionMeta,
    });
    const telegramLoginTarget = resolveAgentClientLoginIdentityTarget({
      sessionConfig: resolvedSessionConfig,
      sessionSlug: displaySessionSlug,
    });

    if (isTelegramSession) {
      return (
        <OnePageSessionTelegramShell
          account={this.props.account}
          blockLimits={blockLimits}
          contracts={contracts}
          defaultTags={defaultTags}
          disclaimersActive={this.state.disclaimersActive}
          displaySessionSlug={displaySessionSlug}
          filterState={this.state.filterState}
          loginComplete={this.props.loginComplete}
          network={routedNetwork}
          networkChainId={routedNetworkChainId}
          provider={this.props.provider}
          questionResponsesNonce={this.props.questionResponsesNonce}
          questionScanProgress={this.props.questionScanProgress}
          resultsViewMode={this.state.resultsViewMode}
          sessionHeader={sessionHeader}
          sessionInfo={sessionInfo}
          sessionName={sessionName}
          telegramAgentQuestions={this.state.telegramAgentQuestions || []}
          telegramAgentQuestionsStatus={this.state.telegramAgentQuestionsStatus}
          telegramAgentResults={this.state.telegramAgentResults}
          telegramAgentResultsStatus={this.state.telegramAgentResultsStatus}
          telegramClientEnvelope={this.state.telegramClientEnvelope}
          telegramPolisDataset={this.state.telegramPolisDataset}
          telegramQuestionPileIndex={this.state.telegramQuestionPileIndex}
          telegramQuestionSubmitError={this.state.telegramQuestionSubmitError}
          telegramSessionMeta={this.state.telegramSessionMeta}
          telegramSubmittedQuestionIds={this.state.telegramSubmittedQuestionIds}
          telegramSubmittingQuestionId={this.state.telegramSubmittingQuestionId}
          workerGroupSessionId={String(telegramLoginTarget.sessionId || '')}
          workerGroupWorkerUrl={String(telegramLoginTarget.workerUrl || '')}
          titleText={titleText}
          onLogout={this.handleTelegramLogout}
          onOpenLoginModal={() => this.props.toggleLoginModal?.(true)}
          onQuestionPileIndexChange={(telegramQuestionPileIndex: number) =>
            this.setState({ telegramQuestionPileIndex })
          }
          onRefresh={() => this.loadTelegramAgentData(true)}
          onResultsModeChange={(resultsViewMode) => this.setState({ resultsViewMode })}
          onSubmitAnswer={this.handleTelegramQuestionSubmit}
        />
      );
    }

    return (
      <OnePageSessionStandardShell
        account={this.props.account}
        aggregatorData={this.state.aggregatorData}
        autoMintCountdown={this.state.autoMintCountdown}
        autoMintingMode={this.state.autoMintingMode}
        autoMintStatuses={this.state.autoMintStatuses || {}}
        autoMintTargets={this.state.autoMintTargets || []}
        autoOpenResults={this.state.autoOpenResults}
        blockLimits={blockLimits}
        cacheHasLoaded={this.props.cacheHasLoaded}
        contracts={contracts}
        corpusViewerLoadRequestNonce={this.state.corpusViewerLoadRequestNonce}
        corpusViewerLoadState={corpusViewerLoadState}
        defaultFeaturedSBTs={defaultFeaturedSBTs}
        defaultFilterState={defaultFilterState}
        defaultSbtTags={defaultSbtTags}
        defaultTags={defaultTags}
        disclaimersActive={this.state.disclaimersActive}
        displaySessionSlug={displaySessionSlug}
        dismissedLoginBanner={this.state.dismissedLoginBanner}
        dismissedStatusItems={this.state.dismissedStatusItems || {}}
        effectiveSlug={effectiveSlug}
        embeddedAtlasNodeId={this.state.embeddedAtlasNodeId}
        embeddedAtlasReturnState={this.state.embeddedAtlasReturnState}
        embeddedGroupsSessionConfig={embeddedGroupsSessionConfig}
        embeddedGroupsSessionSlug={embeddedGroupsSessionSlug}
        embeddedQuestionSessionSlug={embeddedQuestionSessionSlug}
        expandedImages={this.state.expandedImages || {}}
        filterState={this.state.filterState}
        isDemoSlug={isDemoSlug}
        isQuestionCacheReady={this.props.isQuestionCacheReady}
        isResponsesCacheReady={this.props.isResponsesCacheReady}
        isSBTCacheReady={this.props.isSBTCacheReady}
        isSurveyCacheReady={this.props.isSurveyCacheReady}
        litHooks={scopedLitHooks}
        loginComplete={this.props.loginComplete}
        needsLoginForAutoMint={this.state.needsLoginForAutoMint}
        network={routedNetwork}
        networkChainId={routedNetworkChainId}
        pileSubmitRailVisible={this.state.pileSubmitRailVisible}
        provider={this.props.provider}
        questionPool={sharedQuestionPool}
        questionResponsesNonce={this.props.questionResponsesNonce}
        questionScanProgress={this.props.questionScanProgress}
        questionsSectionRef={this.questionsSectionRef}
        refreshQuestionMetadata={this.props.refreshQuestionMetadata}
        refreshQuestionResponses={this.props.refreshQuestionResponses}
        refreshSbtData={this.props.refreshSbtData}
        refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
        resolvedPolisDemoDataBySlug={resolvedPolisDemoDataBySlug}
        resolvedSessionConfig={resolvedSessionConfig}
        resultsViewMode={this.state.resultsViewMode}
        riskMatrixRestoreState={this.state.riskMatrixRestoreState}
        sbtCacheRevision={this.props.sbtCacheRevision}
        sbtImages={this.state.sbtImages || {}}
        sbtNames={this.state.sbtNames || {}}
        sbtRealtimeCoverageBySlug={this.props.sbtRealtimeCoverageBySlug}
        sbtScanProgressBySlug={this.props.sbtScanProgressBySlug}
        sessionHeader={sessionHeader}
        sessionInfo={sessionInfo}
        sessionName={sessionName}
        sharedQuestionPool={sharedQuestionPool}
        showDocuments={this.state.showDocuments}
        showEmbeddedCreateGroup={this.state.showEmbeddedCreateGroup}
        showGroups={this.state.showGroups}
        showQuestions={this.state.showQuestions}
        showResults={this.state.showResults}
        slug={slug}
        titleText={titleText}
        toggleLoginModal={this.props.toggleLoginModal}
        ensureLightSbtDiscovery={this.props.ensureLightSbtDiscovery}
        ensureLightSbtUniverse={this.props.ensureLightSbtUniverse}
        onCancelAutoMintCountdown={this.cancelAutoMintCountdown}
        onCorpusAtlasIssueOpen={this.handleCorpusAtlasIssueOpen}
        onCorpusViewerLoadStateChange={this.handleCorpusViewerLoadStateChange}
        onDismissLoginBanner={this.dismissLoginBanner}
        onDismissStatusItem={this.dismissStatusItem}
        onEmbeddedAtlasModalClose={this.handleEmbeddedAtlasModalClose}
        onFilterChange={this.handleFilterChange}
        onGroupsViewAll={this.handleGroupsViewAll}
        onKickoffAutoMintIfNeeded={this.kickoffAutoMintIfNeeded}
        onLoadFullCorpusClick={this.handleLoadFullCorpusClick}
        onOpenResults={this.handleOpenResults}
        onPileSubmitRailVisibilityChange={this.handlePileSubmitRailVisibilityChange}
        onResultsModalClose={this.handleResultsModalClose}
        onResultsModeChange={(resultsViewMode) => this.setState({ resultsViewMode })}
        onRiskMatrixRestoreApplied={this.handleRiskMatrixRestoreApplied}
        onToggleDocuments={this.toggleDocuments}
        onToggleEmbeddedCreateGroup={this.toggleEmbeddedCreateGroup}
        onToggleGroups={this.toggleGroups}
        onToggleQuestions={this.toggleQuestions}
        onToggleResults={this.toggleResults}
        onToggleStatusImagePreview={this.toggleStatusImagePreview}
        onViewAllQuestionsClick={this.handleViewAllQuestionsClick}
      />
    );
  }
}

export default OnePageSession;
