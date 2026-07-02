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
} from '@fortawesome/free-solid-svg-icons';
import { Alert } from 'reactstrap';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { createLitHooks } from '../../utilities/crypto/litProtocol.js';
import { ethers } from 'ethers';



import styles from './OnePageSession.module.scss';

import LazyFallback from '../Shared/LazyFallback';

import {
  getLegacyEthBalance,
  getNativeBalance,
  hasLegacyEthBalanceReader,
  hasNativeBalanceReader,
  type SessionBalance,
} from '../../domains/sessions/sessionBalanceReaders.js';
import { getAllSessionSlugs } from '../../domains/sessions/sessionConfig.js';
import { sbtGroupMintAuthorizationPort } from '../../domains/sbts/contractScriptsSbtGroupMintAuthorizationPort.js';
import { sbtMetadataReadsPort } from '../../domains/sbts/contractScriptsSbtMetadataReadsPort.js';
import { sbtMintExecutionPort } from '../../domains/sbts/contractScriptsSbtMintExecutionPort.js';

import { resolveEffectiveSlug, normalizeSurveyToolFilterState } from '../SurveyTool/surveyToolUtils.js';
import { resolvePolisDemoQuestionPool } from '../SurveyTool/surveyPolisDemoQuestionPool.js';
import {
  isQuestionAllowedByAuthoritativePool,
  normalizeAuthoritativeQuestionPoolId,
  resolveAuthoritativeQuestionPoolScope,
} from '../SurveyTool/surveyAuthoritativeQuestionPool';
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
import { lazyWithRetry } from '../../utilities/ui/lazyImportRetry.js';
import { hasCachedCreateSbtForm as hasCachedCreateSbtFormCache } from '../../utilities/sbt/sbtCreateFormCache.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { getSbtDisplayName } from '../../utilities/sbt/sbtDisplayNames.js';
import { isDemoSessionSlug } from '../../utilities/session/demoSessionSlugs.js';
import { isCryptoMode, sbtsListPath, t } from '../../utilities/ui/terminology.js';
import { PUBLIC_AI_DISCOURSE_CORPUS_URL } from '../../variables/publicRepoMetadata.js';
import { resolveMainSiteLitSessionConfig } from '../MainSite/litSessionConfig.js';
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
const CorpusViewer = lazyWithRetry(() => import('../DemoViews/CorpusViewer'));
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
const DebateMapAny: any = DebateMap;

const getErrorMessage = (error: any, fallback = 'Unknown error') => (
  error && typeof error === 'object' && typeof error.message === 'string'
    ? error.message
    : fallback
);

const resolveAutoFeatureBySessionSlug = (metadata: any) => (
  metadata?.autoFeatureSBTsBySessionSlug !== undefined
    ? metadata.autoFeatureSBTsBySessionSlug
    : metadata?.autoFeatureSBTsWithFeaturedSbtTags
);

const isTelegramOnlySessionConfig = (metadata: unknown) => {
  const config = toUnknownRecord(metadata);
  const telegramConfig = toUnknownRecord(config.telegram);
  return (
    config.telegramOnly === true ||
    config.telegram_only === true ||
    config.sessionMode === 'telegram_only' ||
    config.telegramMode === 'telegram_only' ||
    telegramConfig.only === true ||
    telegramConfig.mode === 'telegram_only'
  );
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

const hasOwn = (value: any, key: string) => (
  !!value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, key)
);

const resolveOnePageSessionSurveySlug = (props: any = '') => {
  if (hasOwn(props, 'questionSessionSlug')) {
    return normalizeOnePageSessionSlug(props.questionSessionSlug);
  }
  if (hasOwn(props.sessionConfig, 'slug')) {
    return normalizeOnePageSessionSlug(props.sessionConfig.slug);
  }
  return normalizeOnePageSessionSlug(props.slug || '');
};

const getUniqueAggregatorCandidateSlugs = (...slugs: any[]) => {
  const seen = new Set<string>();
  return slugs
    .map((value) => normalizeOnePageSessionSlug(value))
    .filter((value) => {
      const key = value || '__general__';
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const shouldUseBuiltInDemoAggregatorFallback = (displaySlug: any = '', questionSourceSlug: any = '') => {
  const normalizedDisplaySlug = normalizeOnePageSessionSlug(displaySlug);
  const normalizedQuestionSourceSlug = normalizeOnePageSessionSlug(questionSourceSlug);
  return normalizedDisplaySlug === 'demo' && (
    normalizedQuestionSourceSlug === '' ||
    normalizedQuestionSourceSlug === 'demo'
  );
};

const buildAggregatorFallbackQuestions = (questionPool: any[] = [], sessionSlug: any = '') => {
  const out: Record<string, any> = {};
  const normalizedSessionSlug = normalizeOnePageSessionSlug(sessionSlug);
  (Array.isArray(questionPool) ? questionPool : []).forEach((entry: any) => {
    const questionId = String(entry?.id || '').trim();
    if (!questionId) return;
    out[questionId.toLowerCase()] = {
      creator: '',
      tags: [],
      ...entry,
      id: questionId,
      sessionSlug: normalizedSessionSlug,
      sessionSlugExplicit: true,
    };
  });
  return out;
};

const scopeAggregatorNetworkNodeToQuestionPool = (
  networkNode: any = {},
  fallbackQuestions: Record<string, any> = {},
  sessionSlug: any = '',
) => {
  const fallbackQuestionPool = Object.values(fallbackQuestions || {});
  const scope = resolveAuthoritativeQuestionPoolScope(fallbackQuestionPool, sessionSlug);
  if (!scope) return networkNode;

  const nextQuestions: Record<string, any> = {};
  const sourceQuestions = networkNode?.questions || {};
  Object.keys(sourceQuestions).forEach((qid) => {
    const question = sourceQuestions[qid];
    if (!isQuestionAllowedByAuthoritativePool(question, qid, scope)) return;
    const questionId = String(question?.id || qid || '').trim();
    if (!questionId) return;
    nextQuestions[questionId.toLowerCase()] = {
      ...question,
      id: questionId,
    };
  });
  Object.keys(fallbackQuestions || {}).forEach((qid) => {
    const questionId = normalizeAuthoritativeQuestionPoolId(qid);
    if (!questionId || nextQuestions[questionId]) return;
    nextQuestions[questionId] = fallbackQuestions[qid];
  });

  const nextQuestionResponses: Record<string, any> = {};
  const sourceQuestionResponses = networkNode?.questionResponses || {};
  Object.keys(sourceQuestionResponses).forEach((qid) => {
    const questionId = normalizeAuthoritativeQuestionPoolId(qid);
    if (!questionId || !nextQuestions[questionId]) return;
    nextQuestionResponses[qid] = sourceQuestionResponses[qid];
  });

  return {
    ...networkNode,
    questions: nextQuestions,
    questionResponses: nextQuestionResponses,
  };
};

const mergeAggregatorResultRows = (target: Record<string, any[]> = {}, source: any = {}) => {
  const nextTarget = target && typeof target === 'object' ? target : {};
  if (!source || typeof source !== 'object') return nextTarget;

  Object.keys(source).forEach((qid) => {
    const rows = Array.isArray(source[qid]) ? source[qid] : [];
    if (rows.length === 0) {
      if (!nextTarget[qid]) nextTarget[qid] = [];
      return;
    }
    nextTarget[qid] = Array.isArray(nextTarget[qid]) ? nextTarget[qid] : [];
    const seenRows = new Set(
      nextTarget[qid].map((row: any) => `${row?.responder || ''}|${row?.response || ''}`)
    );
    rows.forEach((row: any) => {
      const key = `${row?.responder || ''}|${row?.response || ''}`;
      if (seenRows.has(key)) return;
      seenRows.add(key);
      nextTarget[qid].push(row);
    });
  });

  return nextTarget;
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

const buildOnePageSessionRawResultsRoute = (props: any = {}) => {
  const slug = resolveEffectiveSlug(props);
  const path = slug
    ? `/session/${slug}/questions/results`
    : '/questions/results';
  return buildOnePageSessionPublicRoute(path);
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
  }



  componentWillUnmount() {
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
    const netId = props.network?.id ?? props.networkChainId ?? '';
    return [
      String(displaySlug || ''),
      String(questionCacheSlug || ''),
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
      ((this.props.network?.id ?? null) !== (prevProps.network?.id ?? null)) ||
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

    const displaySlug = resolveEffectiveSlug(this.props);
    const questionSourceSlug = resolveOnePageSessionSurveySlug(this.props);
    const netIdVal = this.props.network?.id ?? this.props.networkChainId ?? 0;
    const useBuiltInDemoFallback = shouldUseBuiltInDemoAggregatorFallback(displaySlug, questionSourceSlug);
    const canBuildFromLocalCache = (
      netIdVal != null &&
      (this.props.isQuestionCacheReady || useBuiltInDemoFallback)
    );

    if (canBuildFromLocalCache) {
      const netIdStr = String(netIdVal);
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

          if (!qCache[netIdStr]) {
            sourceSigParts.push(`${slug || '__general__'}:missing-net`);
            continue;
          }
          sawNetworkCache = true;

          const fallbackQuestions = buildAggregatorFallbackQuestions(demoQuestionPool, slug);
          const networkNode = qCache[netIdStr] || {};
          const networkNodeForAggregation = useBuiltInDemoFallback
            ? scopeAggregatorNetworkNodeToQuestionPool(networkNode, fallbackQuestions, slug)
            : networkNode;

          sourceSigParts.push([
            slug || '__general__',
            computeAggregatorSourceSnapshotSignature(networkNodeForAggregation.questionResponses || {}),
            computeAggregatorQuestionMetadataSignature(networkNodeForAggregation.questions || {}),
          ].join(':'));

          const { map, dirty } = buildAggregatorFromLocalCache(networkNodeForAggregation, {
            parseMemo: this._aggregatorResponseParseMemo,
            sessionSlug: slug,
          });
          mergeAggregatorResultRows(aggregateMap, map);
          if (dirty) { void writeCache('questionsCache', slug, qCache); }
        }

        if (!sawCandidateCache) {
          applyAggregatorData({}, '0:0:0', `${displaySlug}|${questionSourceSlug}|${netIdStr}|empty-cache`);
          return;
        }

        if (!sawNetworkCache) {
          applyAggregatorData({}, '0:0:0', `${displaySlug}|${questionSourceSlug}|${netIdStr}|missing-net`);
          return;
        }

        const sourceSigKey = `${displaySlug}|${questionSourceSlug}|${netIdStr}|${sourceSigParts.join('|')}`;
        if (sourceSigKey === this._aggregatorSourceSigKey) {
          bumpPerfCounter('aggregatorSourceSkips');
          return;
        }
        applyAggregatorData(aggregateMap, computeAggregatorDataSignature(aggregateMap), sourceSigKey);
      } catch (err) {
        demoLog.error("Error building aggregator in OnePageSession:", err);
        applyAggregatorData({}, '0:0:0', `${displaySlug}|${questionSourceSlug}|${netIdStr}|error`);
      }
    } else {
      const netIdStr = String(netIdVal || '');
      applyAggregatorData({}, '0:0:0', `${displaySlug}|${questionSourceSlug}|${netIdStr}|not-ready`);
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
            info = await sbtMetadataReadsPort.getSbtMetadata('none', addr, slug);
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
      const onchainGph = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbtAddress, slug);
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
        (hasNativeBalanceReader() && getNativeBalance)
        || (hasLegacyEthBalanceReader() && getLegacyEthBalance)
        || null;
      if (!readBalance) {
        return false;
      }

      // Group-aware read: rely on the session balance domain (no ad-hoc provider instantiation)
      const slug = resolveEffectiveSlug(this.props);
      const getBalance = async (): Promise<SessionBalance> => {
        try { return await readBalance(address, slug) || ethers.BigNumber.from(0); }
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
           sbtInfo = await sbtMetadataReadsPort.getSbtMetadata('none', sbtAddr, currentSlug);
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
          await sbtMintExecutionPort.claim(this.props.provider, sbtAddr);
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
                groupPasswordHash: onchainHash
              });
              const localHash = walletScopeSbtAddress === null
                ? null
                : sbtGroupMintAuthorizationPort.computeGroupPasswordHash({
                    password,
                    sbtAddress: walletScopeSbtAddress
                  });
              demoLog.log('[INVITE_DEBUG v4] auto-mint local groupPasswordHash:', localHash);
              demoLog.log('[INVITE_DEBUG v4] auto-mint on-chain groupPasswordHash:', onchainHash);
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
                walletScopeSbtAddress
              });
              payload = invites && invites[0];
              if (!payload) throw new Error('Failed to generate invite');

              try {
                await sbtMintExecutionPort.claimWithInvite(
                  this.props.provider,
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
            await sbtMintExecutionPort.claimWithInvite(
              this.props.provider,
              sbtAddr,
              String(payload.nonce),
              String(payload.signature),
            );
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

    const onchain = await sbtMetadataReadsPort.getGroupPasswordHash('none', sbtAddress, resolveEffectiveSlug(this.props));
    if (!onchain || onchain === ethers.constants.HashZero) throw new Error('No group password set on-chain');

    const walletScopeSbtAddress = cryptoUtils.resolveGroupPasswordWalletScopeAddress({
      password: pw,
      sbtAddress,
      groupPasswordHash: onchain
    });
    const local = walletScopeSbtAddress === null
      ? null
      : sbtGroupMintAuthorizationPort.computeGroupPasswordHash({
          password: pw,
          sbtAddress: walletScopeSbtAddress
        });
    if (!local || local.toLowerCase() !== onchain.toLowerCase()) {
      throw new Error('Password mismatch');
    }

    this.setState({ mintingStatus: 'pending', lastTransactionType: 'mint' });

    const sig = await sbtGroupMintAuthorizationPort.signGroupMintAuthorization({
      password: pw,
      sbtAddress,
      userAddress: String(this.props.account || ''),
      walletScopeSbtAddress
    });

    const tx = await sbtMintExecutionPort.mintWithGroupSignature(this.props.provider, sbtAddress, String(sig || ''));

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
    const scopedDemoQuestionPool = demoQuestionPool.length > 0
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
    const telegramOnlySession = isTelegramOnlySessionConfig(resolvedSessionConfig);

    if (telegramOnlySession) {
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
                This session is configured for Telegram bot and Mini App participation. Open it from the Telegram bot to answer questions or view Telegram-only results.
              </span>
            </Alert>
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

          {this.state.showQuestions ? (
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
                account={this.props.account}
                provider={this.props.provider}
                network={this.props.network}
                toggleLoginModal={this.props.toggleLoginModal}
                loginComplete={this.props.loginComplete}
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
                sessionSlug={embeddedQuestionSessionSlug}
                questionPool={sharedQuestionPool}
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
        {this.state.showQuestions && (
          <div className={styles.sectionContainer} ref={this.questionsSectionRef}>
            <div className={`${styles.miniSectionContent} ${styles.miniSectionContentNoHeader}`}>

            <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
              <MemoSurveyPage
                miniMode={true}
                hideEmbeddedDebugUi={true}
                account={this.props.account}
                provider={this.props.provider}
                network={this.props.network}
                toggleLoginModal={this.props.toggleLoginModal}
                loginComplete={this.props.loginComplete}
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
                sessionSlug={embeddedQuestionSessionSlug}
                questionPool={sharedQuestionPool}
                sessionConfig={resolvedSessionConfig}
                contracts={contracts}
                blockLimits={blockLimits}
                networkChainId={networkChainId}
                litHooks={scopedLitHooks}
              />
            </Suspense>

            </div>
          </div>
        )}

        <div className={sectionsGridClassName}>
          {/* Groups section */}
          <div className={`${styles.sectionContainer} ${this.state.showGroups ? styles.sectionExpanded : ''}`}>
            <div className={styles.sectionHeaderRow}>
              <h2 onClick={this.toggleGroups} className={styles.sectionHeader}>
                {this.state.showGroups ? (
                  <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
                ) : (
                  <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
                )}
                {renderSectionHeading(t('sbts'), 'Join or Create')}
                {this.state.showGroups && (
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

              {this.state.showGroups && (
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

            {this.state.showGroups && (
              <div className={styles.miniSectionContent}>
                <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
                  <SBTsPage
                    key={`sbtspage:${embeddedGroupsSessionSlug || 'general'}`}
                    provider={this.props.provider}
                    network={this.props.network}
                    account={this.props.account}
                    loginComplete={this.props.loginComplete}
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
                    requireExplicitAutoFeatureSessionSlug={true}
                    refreshSbtData={this.props.refreshSbtData}
                    /* per-demo passthroughs */
                    sessionSlug={embeddedGroupsSessionSlug}
                    contracts={contracts}
                    blockLimits={blockLimits}
                    networkChainId={networkChainId}
                    /* Pass sessionConfig including the autoFeature flag so SBTsPage can read it */
                    sessionConfig={embeddedGroupsSessionConfig}
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
                {this.state.showDocuments ? (
                  <FontAwesomeIcon icon={faCaretUp} className={styles.sectionToggleIcon} />
                ) : (
                  <FontAwesomeIcon icon={faCaretDown} className={styles.sectionToggleIcon} />
                )}
                {renderSectionHeading('Context', 'View')}
                {this.state.showDocuments && (
                  <div
                    className={`${styles.tooltip} ${styles.sectionHeaderTooltip}`}
                    onClick={(e: any) => e.stopPropagation()}
                  >
                    <FontAwesomeIcon icon={faQuestionCircle} />
                    <span className={styles.tooltiptext}>
                      {documentsSectionTooltip}
                    </span>
                  </div>
                )}
              </h2>
              {this.state.showDocuments && (
                <div className={styles.sectionHeaderActionsScroller}>
                  <div className={styles.sectionHeaderActions}>
                    <a
                      href={DEMO_CORPUS_GITHUB_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.sectionHeaderActionButton}
                      onClick={(e: any) => e.stopPropagation()}
                    >
                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                      <span>GitHub</span>
                    </a>
                    <button
                      type="button"
                      className={styles.sectionHeaderActionButton}
                      onClick={this.handleLoadFullCorpusClick}
                      disabled={disableLoadFullCorpusButton}
                      data-testid='ce-demo-documents-load-full-corpus'
                    >
                      <FontAwesomeIcon icon={faDownload} />
                      <span>{loadFullCorpusButtonLabel}</span>
                    </button>
                  </div>
                </div>
              )}
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
                  {resultsViewMode === 'polis' && (
                    <Suspense fallback={<LazyFallback label="Loading..." minHeight="20vh" />}>
                      <PolisReport
                        onePageDemo={true}
                        miniMode={true}
                        account={this.props.account}
                        provider={this.props.provider}
                        network={this.props.network}
                        loginComplete={this.props.loginComplete}
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
                        sessionSlug={displaySessionSlug}
                        demoDataFirstLoad={isDemoSlug}
                        demoDataBySlug={resolvedPolisDemoDataBySlug}
                        contracts={contracts}
                        blockLimits={blockLimits}
                        networkChainId={networkChainId}
                      />
                    </Suspense>
                  )}
                  {isDemoSlug && resultsViewMode === 'analysis' && (
                    <Suspense fallback={<LazyFallback label="Loading Analysis..." minHeight="30vh" />}>
                      <DemoAnalysisWorkspace sessionSlug={slug} />
                    </Suspense>
                  )}
                  {isDemoSlug && resultsViewMode === 'debateAtlas' && (
                    <Suspense fallback={<LazyFallback label="Loading Debate Atlas..." minHeight="30vh" />}>
                      <div style={{ maxHeight: '80vh', overflowY: 'auto' }}>
	                        <DebateMapAny
	                          account={this.props.account}
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
