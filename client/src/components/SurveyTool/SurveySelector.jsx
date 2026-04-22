/** @file SurveySelector.jsx */

import React, { Component } from 'react';
import {
  Button,
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  FormGroup,
  Label,
  Input,
  Card,
  CardBody,
  FormText,
  InputGroup,
  InputGroupText,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { Link } from 'react-router-dom';
import CETooltip from '../Shared/CETooltip';




// Styles
import "../../assets/css/contextEngine.scss";
import styles from './SurveyTool.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBookmark, faLock, faUnlock, faPlus, faMinus, faCaretDown, faCaretUp, faCheck, faTimes, faArrowLeft, faArrowRight, faSpinner, faExpand, faExternalLinkAlt, faFilter, faExclamationCircle, faCog, faMicrophone, faChevronLeft, faChevronRight, faComment, faQuestionCircle, faBullhorn, faRobot } from '@fortawesome/free-solid-svg-icons';

import AudioInput from '../Shared/AudioInput/AudioInput.jsx';
import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import SurveyResults from './SurveyResults';
import QuestionFilter from './QuestionFilter';
import PileHologramAssistant from './PileHologramAssistant.jsx';
import QuestionTagDropdown from './QuestionTagDropdown.jsx';
import SingleQuestionResponse from './SingleQuestionResponse';
import { JsonButtonRow, JsonIconButton, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';
import SessionChipSelector from '../Shared/SessionChipSelector.jsx';
import { getQuestionTagDisplayList } from '../../utilities/survey/questionTags.js';

// Crypto and contract utilities
import contractScripts, {
  getAllSessionSlugs,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
  getSessionSlugByName
} from '../../utilities/web3/contractScripts.js';
import { ethers, utils } from 'ethers';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { serializeFilterState, deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { ENABLE_IMPORTANCE_SLIDER_TOGGLE } from '../../variables/appConfig.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createLogger } from 'utilities/logging.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
import { buildSbtAccessControlConditions, resolveLitChain } from '../../utilities/crypto/litProtocol.js';
import {
  buildQuestionRoutePath,
  isMaskedQuestionPayload,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
  pickBetterQuestionPayload,
  shouldRetryMaskedQuestionRefresh,
} from '../../utilities/survey/questionRouting.js';
import {
  normalizeSessionSlug,
  resolveSessionAliases,
  resolveSessionSlugFromPathname,
} from '../../utilities/session/sessionNaming.js';
import {
  resolveSurveyToolDecryptHydrationContext,
  resolveSurveyToolDraftSessionContext,
  resolveSurveyToolDraftStorageContext,
  resolveSurveyToolEffectiveSlug,
  resolveSurveyToolEnsureQuestionCachedContext,
  resolveSurveyToolExplicitSessionContext,
  resolveSurveyToolIdLookupContext,
  resolveSurveyToolLockAudienceSessionNameContext,
  resolveSurveyToolQuestionConfigContext,
  resolveSurveyToolQuestionCountContext,
  resolveSurveyToolQuestionPayloadCacheWriteContext,
  resolveSurveyToolQuestionsDashboardLoadContext,
  resolveSurveyToolPileFilterContext,
  resolveSurveyToolPileLoadContext,
  resolveSurveyToolPileWarmSeedContext,
  resolveSurveyToolPileResponseReadContext,
  resolveSurveyToolQuestionReadCacheContext,
  resolveSurveyToolQuestionBootstrapContext,
  resolveSurveyToolResponseJsonContext,
  resolveSurveyToolResponseHydrationContext,
  resolveSurveyToolResponseGateSessionContext,
  resolveSurveyToolSubmittedCacheWriteContext,
  resolveSurveyToolSurveyReadContext,
  resolveSurveyToolUpdateCacheContext,
} from './surveyToolSessionResolution.js';
import {
  readSessionScanScope,
  readSessionScanSlugs,
} from '../../utilities/session/sessionScanScope.js';
import {
  listNamespaceEntriesSync,
  peekCacheSync,
  readCache,
  updateCacheAtomic,
  writeCache,
  writeCacheOptimistic,
} from '../../utilities/cache/cacheScripts.js';
import { measureSync } from '../../utilities/ui/uiPerfStats.js';
import {
  isTargetedSbtMetadataLookupEnabled,
  resolveSbtDisplayLabel,
  warmSbtDisplayNamesTargeted,
} from '../../utilities/sbt/sbtDisplayNames.js';
import { normalizeArweaveUrl } from '../../utilities/arweave/arweaveUrls.js';
import {
  normalizeRatingValue,
  RATING_MAX,
  RATING_MIN,
} from '../../utilities/survey/ratingValue.js';

import {
  EMPTY_QUESTION_POOL,
  DEBUG_PREFILL,
  GATE_SBT_HYDRATION_RETRY_MS,
  QUESTION_TAG_DROPDOWN_ROW_STYLE,
  SHOW_PILE_HOLOGRAM_TOGGLE,
  appendExplicitSessionHintToPath,
  applyExistingGroupPrefix,
  areEnvelopesEquivalent,
  areQuestionPayloadsEquivalent,
  buildQuestionCountScopeContextKey,
  buildQuestionDashboardLoadContextSignature,
  buildQuestionFilterStorageKeyPrefix,
  buildQuestionIdScopeSignature,
  buildQuestionScanProgressDisplay,
  buildRatingEnvelopeQidSetFromUserAnswers,
  buildRenderedIdsSignature,
  buildSliceToken,
  buildSurveyDraftSemanticSignature,
  buildSurveyResponseSliceSignature,
  canUseRecentQuestionPayloadForAccount,
  clampSliderValue,
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  ensureQuestionsNet,
  ensureSurveysNet,
  formatQuestionScanBlockCount,
  getActiveSessionSlugFromProps,
  getBlockedQuestionIdsSet,
  getConvictionFromResponse,
  getConvictionFromSlice,
  getConvictionFromSliceStrict,
  dedupeQuestionReadSlugs,
  getExtraQuestionReadSlugs,
  getHighlightedQuestionIdsSet,
  getImportanceFromResponse,
  getImportanceFromSlice,
  getNormalizedUiRatingValue,
  getPendingStatsSnapshotFromState,
  getSessionSlugHintFromProps,
  getSessionSlugPinnedFromProps,
  hasCacheHydratedFlag,
  hasConvictionOrImportanceValueForQuestion,
  hasMeaningfulFieldValue,
  isIncomingResponseMetaNewer,
  isSingleSelectMultichoice,
  isSurveyToolFilterStateActive,
  mergeDecryptedViewedResponse,
  mergeQuestionResponses,
  mergeSurveyResponsePayloads,
  normalizeMultichoiceValue,
  normalizeQuestionIdKey,
  normalizeQuestionProgressSlug,
  normalizeSessionSlugValue,
  normalizeSurveyToolFilterState,
  readQuestionsCache,
  readQuestionsCacheAsync,
  readQuestionsCacheRef,
  readRecentQuestionPayload,
  readSurveysCache,
  readSurveysCacheAsync,
  readSurveysCacheRef,
  resolveCurrentTagSessionSlug,
  resolveDecryptHydrationContext,
  resolveDraftSessionContext,
  resolveDraftStorageContext,
  resolveEffectiveSlug,
  resolveEnsureQuestionCachedContext,
  resolveExplicitSessionContext,
  resolveLockAudienceSessionNameContext,
  resolvePileFilterContext,
  resolvePileLoadContext,
  resolvePileResponseReadContext,
  resolvePileWarmSeedContext,
  resolveQuestionBootstrapContext,
  resolveQuestionCountContext,
  resolveQuestionPayloadCacheWriteContext,
  resolveQuestionReadCacheContext,
  resolveQuestionsDashboardLoadContext,
  resolveResponseHydrationContext,
  resolveResponseJsonContext,
  resolveSlugForIds,
  resolveSubmittedCacheWriteContext,
  resolveSurveyReadContext,
  resolveUpdateCacheContext,
  scheduleMicrotask,
  serializeSurveyToolFilterState,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  shouldRenderInlineSubmitButton,
  shouldRenderSubmittedIndicator,
  shouldShowPileFullLoadingState,
  shouldShowSingleQuestionResponseLookupSpinner,
  stampResponsePayloadWithMeta,
  surveyLog,
  toNumberOrNull,
  toResponseRecencyMeta,
  updateSubmittedSinceLastEdit,
  writeQuestionsCache,
  writeSurveysCache,
  bumpSurveyPerfCounter,
} from './surveyToolUtils.js';

export class SurveySelector extends Component {
  constructor(props) {
    super(props);
    this.state = {
      surveys: [],
      selectedSurveyIndex: null,
      pubKey: '',
      createSurveyMode: false,
      demoMode: false,
      showResults: this.props.autoOpenResults || false,
      loading: true,
      filterModalOpen: false,
      viewMode: 'questions',
      selectedTypes: [],
      filteredQuestionCount: 0,
      encryptedQuestionCount: 0,
      currentPath: window.location.pathname,
      filterState: normalizeSurveyToolFilterState(this.props.filterState),
      copySurveyIdSuccess: false,
      isFilterActive: isSurveyToolFilterStateActive(this.props.filterState),
      showLongLoading: false,
      selectorDropdownOpen: false,
      pendingSubmitStats: { total: 0, encrypted: 0, submittedSinceLastEdit: false, isSubmitting: false },
    };
	    this.questionFilterRef = React.createRef();
	    this.surveyQuestionsRef = React.createRef();
	    this.loadingTimeout = null;
    this._copySurveyIdTimer = null;
    this._renderQuestionsCacheMemoKey = '';
    this._renderQuestionsCacheMemoValue = null;
    this._isMounted = false;
    this._questionCountStateContextKey = '';
    this._stickyQuestionCountSnapshot = {
      hasValue: false,
      contextKey: '',
      count: 0,
      encryptedCount: 0,
    };
    this._filterStateSig = serializeSurveyToolFilterState(this.state.filterState || {});
	  }

  getQuestionCountContext = (propsIn = this.props) => {
    const slug = resolveEffectiveSlug(propsIn);
    const context = resolveQuestionCountContext(propsIn, slug);
    const networkID = context.networkIdStr || '';
    const readSlugs = (
      Array.isArray(context.scopedSessionSlugs) && context.scopedSessionSlugs.length > 0
        ? context.scopedSessionSlugs
        : dedupeQuestionReadSlugs([
          slug,
          ...getExtraQuestionReadSlugs(propsIn, slug),
        ])
    );
    return {
      slug,
      networkID,
      readSlugs,
      contextKey: buildQuestionCountScopeContextKey(readSlugs, networkID),
    };
  };

  clearStickyQuestionCountSnapshot = () => {
    this._questionCountStateContextKey = '';
    this._stickyQuestionCountSnapshot = {
      hasValue: false,
      contextKey: '',
      count: 0,
      encryptedCount: 0,
    };
  };

  commitQuestionCountState = (
    count,
    encryptedCount,
    {
      propsIn = this.props,
      rememberStable = true,
      ignoreTransientZero = false,
    } = {}
  ) => {
    const numericCount = Math.max(0, Number(count || 0));
    const numericEncryptedCount = Number.isFinite(Number(encryptedCount))
      ? Math.max(0, Number(encryptedCount))
      : 0;
    const { contextKey } = this.getQuestionCountContext(propsIn);
    const liveContextMatches = this._questionCountStateContextKey === contextKey;

    if (
      ignoreTransientZero &&
      numericCount === 0 &&
      liveContextMatches &&
      this.state.filteredQuestionCount > 0
    ) {
      return false;
    }

    const snapshot = this._stickyQuestionCountSnapshot || {};
    const snapshotMatches = !!snapshot.hasValue &&
      snapshot.contextKey === contextKey &&
      snapshot.count === numericCount &&
      snapshot.encryptedCount === numericEncryptedCount;
    const liveCountsMatch = liveContextMatches &&
      numericCount === this.state.filteredQuestionCount &&
      numericEncryptedCount === this.state.encryptedQuestionCount;

    if (liveCountsMatch && (!rememberStable || snapshotMatches)) {
      return false;
    }

    this._questionCountStateContextKey = contextKey;
    if (rememberStable) {
      this._stickyQuestionCountSnapshot = {
        hasValue: true,
        contextKey,
        count: numericCount,
        encryptedCount: numericEncryptedCount,
      };
    }

    this.setState({
      filteredQuestionCount: numericCount,
      encryptedQuestionCount: numericEncryptedCount,
    });
    return true;
  };

  getDisplayedQuestionCounts = ({
    loadingActive = false,
    count = this.state.filteredQuestionCount,
    encryptedCount = this.state.encryptedQuestionCount,
    propsIn = this.props,
  } = {}) => {
    const liveCount = Math.max(0, Number(count || 0));
    const liveEncryptedCount = Number.isFinite(Number(encryptedCount))
      ? Math.max(0, Number(encryptedCount))
      : 0;
    const { contextKey } = this.getQuestionCountContext(propsIn);
    const liveContextMatches = this._questionCountStateContextKey === contextKey;
    const snapshot = this._stickyQuestionCountSnapshot || null;
    const hasMatchingSnapshot = !!snapshot?.hasValue && snapshot.contextKey === contextKey;

    if (liveContextMatches) {
      if (!loadingActive || liveCount > 0 || liveEncryptedCount > 0) {
        return { count: liveCount, encryptedCount: liveEncryptedCount };
      }
      if (hasMatchingSnapshot) {
        return { count: snapshot.count, encryptedCount: snapshot.encryptedCount };
      }
      return { count: liveCount, encryptedCount: liveEncryptedCount };
    }

    if (loadingActive && hasMatchingSnapshot) {
      return { count: snapshot.count, encryptedCount: snapshot.encryptedCount };
    }

    return { count: 0, encryptedCount: 0 };
  };

  componentDidMount() {
    this._isMounted = true;
    if (!this.props.singleQuestionMode) {
      this.handleUrlBasedView();
      this.fetchSurveys();
      this.computeFilteredQuestionCount();
      window.addEventListener('popstate', this.handleUrlChange);
    }
    // Start long-loading timer
    this.loadingTimeout = setTimeout(() => {
      const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      const isQuestionsPath = /^\/questions(\/|$)/.test(path);
      const requiredCacheReady = isQuestionsPath
        ? !!this.props.isQuestionCacheReady
        : !!this.props.isSurveyCacheReady;

      if (this.state.loading || !requiredCacheReady) {
        this.setState({ showLongLoading: true });
      }
    }, 10000);
  }

  componentWillUnmount() {
    this._isMounted = false;
    if (!this.props.singleQuestionMode) {
      window.removeEventListener('popstate', this.handleUrlChange);
    }
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    if (this._copySurveyIdTimer) {
      clearTimeout(this._copySurveyIdTimer);
      this._copySurveyIdTimer = null;
    }
  }

	  componentDidUpdate(prevProps, prevState) {
      const prevQuestionCountContext = this.getQuestionCountContext(prevProps);
      const nextQuestionCountContext = this.getQuestionCountContext(this.props);
      const sessionChanged =
        prevQuestionCountContext.slug !== nextQuestionCountContext.slug;
      const networkChanged =
        prevQuestionCountContext.networkID !== nextQuestionCountContext.networkID;
      const surveyCacheReadyTick =
        prevProps.isSurveyCacheReady !== this.props.isSurveyCacheReady &&
        this.props.isSurveyCacheReady;
      const questionCacheReadyTick =
        prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
        this.props.isQuestionCacheReady;
      const questionsNonceTick =
        prevProps.questionsCacheNonce !== this.props.questionsCacheNonce;
      const questionResponsesNonceTick =
        prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;

      const shouldRefreshSurveyList = networkChanged || surveyCacheReadyTick || sessionChanged;
      const shouldRecomputeQuestionCount =
        shouldRefreshSurveyList || questionCacheReadyTick || questionsNonceTick || questionResponsesNonceTick;

      if (sessionChanged || networkChanged) {
        this.clearStickyQuestionCountSnapshot();
      }

      if (!this.props.singleQuestionMode && shouldRefreshSurveyList) {
        this.fetchSurveys();
      }
      if (!this.props.singleQuestionMode && shouldRecomputeQuestionCount) {
        this.computeFilteredQuestionCount();
      }

    const statePatch = {};
    let hasStatePatch = false;

	    if (this.props.autoOpenResults && !prevProps.autoOpenResults && !this.state.showResults) {
      statePatch.showResults = true;
      hasStatePatch = true;
	    }
      const prevExternalFilterSig = serializeSurveyToolFilterState(
        normalizeSurveyToolFilterState(prevProps.filterState)
      );
      const nextFilterState = normalizeSurveyToolFilterState(this.props.filterState);
      const nextFilterSig = serializeSurveyToolFilterState(nextFilterState);
      if (
        nextFilterSig !== prevExternalFilterSig &&
        nextFilterSig !== this._filterStateSig
      ) {
        this._filterStateSig = nextFilterSig;
        statePatch.filterState = nextFilterState;
        hasStatePatch = true;
      }

      if ((sessionChanged || networkChanged) && this.state.viewMode === 'questions') {
        statePatch.filteredQuestionCount = 0;
        statePatch.encryptedQuestionCount = 0;
        hasStatePatch = true;
      }

    // Clear long-loading if loaded
    if (this.state.showLongLoading) {
      const path = (typeof window !== 'undefined' ? window.location.pathname : '') || '';
      const isQuestionsPath = /^\/questions(\/|$)/.test(path);
      const requiredCacheReady = isQuestionsPath
        ? !!this.props.isQuestionCacheReady
        : !!this.props.isSurveyCacheReady;

      if (!this.state.loading && requiredCacheReady) {
        statePatch.showLongLoading = false;
        hasStatePatch = true;
      }
    }

    if (hasStatePatch) {
      this.setState(statePatch);
    }
	  }

  handleClearFilters = (e) => {
    e.stopPropagation();
    if (this.questionFilterRef.current) {
      this.questionFilterRef.current.handleClearFilters();
    }
  };

  computeFilteredQuestionCount = async () => {

    // When in 'questions' mode, the QuestionFilter child component is active and
    // applying complex filters (tags, types, SBTs). It drives the count via callback.
    // We must NOT overwrite it with a basic total count here.
    if (this.state.viewMode === 'questions') return;
    const requestEpoch = (Number(this._filteredQuestionCountEpoch || 0) + 1);
    this._filteredQuestionCountEpoch = requestEpoch;

    const { slug, networkID: netIdStr, contextKey, readSlugs } = this.getQuestionCountContext();
    const hadPositive =
      this._questionCountStateContextKey === contextKey &&
      (this.state.filteredQuestionCount || 0) > 0;

    if (!netIdStr) {
      if (requestEpoch !== this._filteredQuestionCountEpoch) return;
      if (!hadPositive) {
        this.commitQuestionCountState(0, 0, { rememberStable: false });
      }
      return;
    }

    const scopedReadSlugs = dedupeQuestionReadSlugs(
      Array.isArray(readSlugs) && readSlugs.length > 0
        ? readSlugs
        : [slug]
    );
    const seenQuestionIds = new Set();
    let encryptedCount = 0;
    let nextCount = 0;

    for (const readSlug of scopedReadSlugs) {
      let localQuestionsCache = {};
      try {
        localQuestionsCache = ensureQuestionsNet(await readQuestionsCacheAsync(readSlug), netIdStr);
      } catch (e) {
        continue;
      }

      const networkCache = localQuestionsCache[netIdStr] || { questions: {} };
      const questionsData = networkCache.questions || {};
      const BLOCKED_QUESTION_IDS_SET = getBlockedQuestionIdsSet(readSlug);
      for (const q of Object.values(questionsData)) {
        if (!q || !q.id) continue;
        const questionIdLower = String(q.id).toLowerCase();
        if (BLOCKED_QUESTION_IDS_SET.has(questionIdLower)) continue;
        if (seenQuestionIds.has(questionIdLower)) continue;
        seenQuestionIds.add(questionIdLower);
        nextCount += 1;
        if (String(q?.prompt || '').trim() === '[encrypted]') {
          encryptedCount += 1;
        }
      }
    }

    // Ignore a transient zero if we already had a positive count (prevents “Questions (0)” flash).
    if (nextCount === 0 && hadPositive) return;

    if (requestEpoch !== this._filteredQuestionCountEpoch) return;
    this.commitQuestionCountState(nextCount, encryptedCount, {
      rememberStable: true,
      ignoreTransientZero: true,
    });
  };

  handleUrlChange = () => {
    this.handleUrlBasedView();
  };

  handleUrlBasedView = () => {
    const path = window.location.pathname || '';
    const params = new URLSearchParams(window.location.search || '');
    const urlRequestsResults = params.get('results') === 'true';
    const isQuestions = /^\/questions(\/|$)/.test(path);
    const isSurveysList = path === "/surveys";
    const isValidSurveyRoute = /^\/survey\/(0x[0-9a-fA-F]{64})(?:\/.*)?$/.test(path);
    let nextViewMode = null;
    if (isQuestions) {
      nextViewMode = "questions";
    } else if (isSurveysList || isValidSurveyRoute) {
      nextViewMode = "survey";
    } else if (path.startsWith("/survey/")) {
      nextViewMode = "questions";
    }
    const statePatch = {};
    if (nextViewMode && nextViewMode !== this.state.viewMode) {
      statePatch.viewMode = nextViewMode;
    }
    if (nextViewMode !== null && urlRequestsResults && !this.state.showResults) {
      statePatch.showResults = true;
    }
    if (Object.keys(statePatch).length > 0) {
      this.setState(statePatch);
    }
  };


	  handleFilteredQuestionsWithState = (filteredQuestions, filterState) => {
    const nextFilterState = normalizeSurveyToolFilterState(filterState);
    const serializedState = serializeSurveyToolFilterState(nextFilterState);
    if (serializedState !== this._filterStateSig) {
      this._filterStateSig = serializedState;
      this.setState({ filterState: nextFilterState });
    }

	    // Update URL query params strictly (without forcing /results path)
	    // This ensures list filtering preserves the current view mode in the URL.
	    const currentPath = window.location.pathname;
	    let newUrl = currentPath;

	    if (serializedState) {
	      newUrl += `?filter=${serializedState}`;
	    }

	    if (!this.props.preventUrlChange) {
        const currentUrl = `${window.location.pathname}${window.location.search || ''}`;
        if (currentUrl !== newUrl) {
	        window.history.replaceState({}, '', newUrl);
        }
	    }
	  };


		  async fetchSurveys() {
	      const requestEpoch = (Number(this._surveySelectorFetchEpoch || 0) + 1);
	      this._surveySelectorFetchEpoch = requestEpoch;
      if (!this.state.loading) {
		    this.setState({ loading: true });
      }

	    // 1. Resolve Context
	    const slug = resolveEffectiveSlug(this.props);
	    const surveyReadContext = resolveSurveyReadContext(this.props, slug);
	    const effectiveSlug = surveyReadContext.sessionSlug || slug;
	    const netIdStr = surveyReadContext.networkIdStr;

      if (!netIdStr) {
        if (requestEpoch !== this._surveySelectorFetchEpoch) return;
        surveyLog.error('SurveySelector: Network ID is undefined in fetchSurveys.');
        this.setState({ surveys: [], loading: false });
	      return;
	    }

	    // 2. Read Caches (Pure Read - No Fetching)
	    let surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
      // Read path only: avoid write-on-read feedback loops via questionsCacheNonce.
      if (requestEpoch !== this._surveySelectorFetchEpoch) return;

	    const surveyBag = surveysCache?.[netIdStr]?.surveys || {};

	    // 3. Build List from Cache
	    const userSubmittedSurveys = [];
	    const seen = new Set();

	    for (const sid of Object.keys(surveyBag)) {
	      const sData = surveyBag[sid];
        if (!sData || !sData.title || !Array.isArray(sData.questionIDs)) continue;

	      const qids = (sData.questionIDs || []).map(q => String(q || '').toLowerCase());
	      if (qids.length === 0) continue;

	      if (!sData.id) sData.id = sData.surveyID || sid;
	      const lowered = String(sData.id || sid).toLowerCase();
	      if (!seen.has(lowered)) {
	        seen.add(lowered);
	        userSubmittedSurveys.push(sData);
	      }
	    }

	    // 4. Handle Cache Warmup State (Prevent flashing empty during transient re-fetches)
	    // Keep previous list when re-fetch produces empty AND context (slug+network) hasn't changed.
	    // This prevents unmounting SurveyQuestions during login-triggered cache re-reads.
	    const shouldKeepExisting =
	      userSubmittedSurveys.length === 0 &&
	      (this.state.surveys && this.state.surveys.length > 0) &&
	      this._lastFetchSurveysSlug === effectiveSlug &&
	      this._lastFetchSurveysNetId === netIdStr;

      if (shouldKeepExisting) {
        if (requestEpoch !== this._surveySelectorFetchEpoch) return;
        this.setState({ loading: false }, this.updateSelectedSurvey);
        return;
      }

      if (requestEpoch !== this._surveySelectorFetchEpoch) return;
      // Track context unconditionally so session/network switches always clear stale data.
      this._lastFetchSurveysSlug = effectiveSlug;
      this._lastFetchSurveysNetId = netIdStr;
      this.setState(
        { surveys: userSubmittedSurveys, loading: false },
        this.updateSelectedSurvey
      );
    }

  updateSelectedSurvey = () => {
    // Skip if user just clicked a survey and URL push hasn't fired yet
    if (this._userSurveySelectionPending) return;
    this.setState(
      prevState => {
        const { surveys } = prevState;
        const path = window.location.pathname;

        if (path === '/surveys') {
          return { selectedSurveyIndex: null };
        }

        let surveyIdFromUrl = null;
        const match = path.match(/^\/survey\/(0x[0-9a-fA-F]{64})(?:\/.*)?$/);
        if (match && match[1]) {
          surveyIdFromUrl = match[1].toLowerCase();
        }

        const propId = this.props.surveyId ? this.props.surveyId.toLowerCase() : null;
        const targetId = surveyIdFromUrl || propId;

        if (!targetId) {
          return { selectedSurveyIndex: null };
        }

        const idx = surveys.findIndex(s => (s.id ? s.id.toLowerCase() : '') === targetId);
        if (idx !== -1) {
          return { selectedSurveyIndex: idx };
        }

        return { selectedSurveyIndex: prevState.selectedSurveyIndex };
      },
      () => {
        const { surveys, selectedSurveyIndex } = this.state;
        const path = window.location.pathname;
        if (path === '/surveys' && surveys.length > 0 && selectedSurveyIndex === 0 && surveys[0] && surveys[0].id) {
          this.updateURL(surveys[0].id);
        }
      }
    );
  };


  /**
   * Select a survey (by index) and (normally) push a URL like /survey/:id.
   * When preventUrlChange is true, we only update component state.
   */
  selectSurvey = (selectedSurveyIndex) => {
    const survey =
      this.state.surveys && this.state.surveys[selectedSurveyIndex]
        ? this.state.surveys[selectedSurveyIndex]
        : null;
    const sid = survey && (survey.id || survey.surveyID);

    // Guard: prevent updateSelectedSurvey from overriding this selection
    // before the URL push callback fires
    this._userSurveySelectionPending = true;

	    this.setState(
	      {
	        selectedSurveyIndex,
	        viewMode: 'survey',
        showResults: false,
        pendingSubmitStats: { total: 0, encrypted: 0, submittedSinceLastEdit: false, isSubmitting: false },
	      },
	      () => {
          if (this.props.preventUrlChange) {
            this._userSurveySelectionPending = false;
            return;
          }
          const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
	        let path = sid ? `/survey/${String(sid).toLowerCase()}` : '/surveys';
          if (sid && slug) path += `?session=${encodeURIComponent(slug)}`;
	        window.history.pushState({}, '', applyExistingGroupPrefix(path));
	        this._userSurveySelectionPending = false;
	      }
	    );
  };


  updateURL = (surveyId) => {
    const idL = String(surveyId).trim().toLowerCase();
    const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
    const query = slug ? `?session=${encodeURIComponent(slug)}` : '';
    if (this.props.displayAnswerMode && this.props.viewAddress) {
      window.history.pushState({}, '', `/survey/${idL}/${this.props.viewAddress}${query}`);
    } else {
      window.history.pushState({}, '', `/survey/${idL}${query}`);
    }
    if (this.props.onSurveyChange) {
      this.props.onSurveyChange(surveyId);
    }
  };


  /**
   * Switches between "questions" and "survey" views and (normally) updates the URL.
   * When preventUrlChange is true, we skip the pushState calls.
   */
  selectOption = (option) => {
    this.setState({ viewMode: option, pendingSubmitStats: { total: 0, encrypted: 0, submittedSinceLastEdit: false, isSubmitting: false } }, () => {
      if (this.props.preventUrlChange) return;

      let path = '/questions';
      if (option === 'survey') {
        const idx = this.state.selectedSurveyIndex;
        const current =
          idx != null && this.state.surveys && this.state.surveys[idx]
            ? this.state.surveys[idx]
            : null;
        const sid = current && (current.id || current.surveyID);
        const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
        path = sid ? `/survey/${String(sid).toLowerCase()}${slug ? `?session=${encodeURIComponent(slug)}` : ''}` : '/surveys';
      }
      window.history.pushState({}, '', applyExistingGroupPrefix(path));
    });
  };


  toggleFilterModal = () => {
    this.setState(prevState => ({ filterModalOpen: !prevState.filterModalOpen }));
  };

  toggleCreateMode = () => {
    this.setState(prevState => ({
      createSurveyMode: !prevState.createSurveyMode
    }));
  };

  toggleShowResults = () => {
    const newShowResults = !this.state.showResults;
    const selectedSurvey =
      this.state.selectedSurveyIndex !== null && this.state.surveys[this.state.selectedSurveyIndex]
        ? this.state.surveys[this.state.selectedSurveyIndex]
        : null;
    const surveyIdForUrl = selectedSurvey ? selectedSurvey.id : null;

    if (newShowResults) { // Opening
      const serializedState = serializeSurveyToolFilterState(this.state.filterState);
      let path;
      if (this.state.viewMode === 'questions') {
        path = '/questions/results';
      } else if (this.state.viewMode === 'survey' && surveyIdForUrl) {
        const idL = String(surveyIdForUrl).trim().toLowerCase();
        path = `/survey/${idL}/results`;
      } else {
        path = (window.location.pathname || '').replace(/(\?.*)?$/, '');
        if (!path.endsWith('/results')) path += (path.endsWith('/') ? 'results' : '/results');
      }

      if (serializedState) {
        path += `?filter=${serializedState}`;
      }
      const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
      path = appendExplicitSessionHintToPath(path, slug);
      path = applyExistingGroupPrefix(path);

      if (!this.props.preventUrlChange) {
        window.history.pushState({}, '', path);
      }
    } else { // Closing
      let basePath;
      if (this.state.viewMode === 'questions') {
        basePath = '/questions';
      } else if (this.state.viewMode === 'survey' && surveyIdForUrl) {
        const idL = String(surveyIdForUrl).trim().toLowerCase();
        const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
        basePath = `/survey/${idL}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`;
      } else {
        basePath = (window.location.pathname || '').replace(/(\/results)?\/?(\?.*)?$/, '');
        if (!basePath) basePath = '/questions';
      }
      const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
      basePath = appendExplicitSessionHintToPath(basePath, slug);
      if (!this.props.preventUrlChange) {
        window.history.pushState({}, '', applyExistingGroupPrefix(basePath));
      }
    }
    this.setState({ showResults: newShowResults });
  };

  closeShowResults = () => {
    if (!this.state.showResults) return;
    const selectedSurvey =
      this.state.selectedSurveyIndex !== null && this.state.surveys[this.state.selectedSurveyIndex]
        ? this.state.surveys[this.state.selectedSurveyIndex]
        : null;
    const surveyIdForUrl = selectedSurvey ? selectedSurvey.id : null;

    let basePath;
    if (this.state.viewMode === 'questions') {
      basePath = '/questions';
    } else if (this.state.viewMode === 'survey' && surveyIdForUrl) {
      const idL = String(surveyIdForUrl).trim().toLowerCase();
      const slug = normalizeSessionSlugValue(this.props.activeSessionSlug) || '';
      basePath = `/survey/${idL}${slug ? `?session=${encodeURIComponent(slug)}` : ''}`;
    } else {
      basePath = (window.location.pathname || '').replace(/(\/results)?\/?(\?.*)?$/, '');
      if (!basePath) basePath = '/questions';
    }
    const slug = normalizeSessionSlugValue(resolveEffectiveSlug(this.props)) || '';
    basePath = appendExplicitSessionHintToPath(basePath, slug);
    if (!this.props.preventUrlChange) {
      window.history.pushState({}, '', applyExistingGroupPrefix(basePath));
    }
    this.setState({ showResults: false });
  };

  handleHeaderSubmitClick = () => {
    const target = this.surveyQuestionsRef?.current;
    if (!target || typeof target.handlePrimarySubmitClick !== 'function') return;
    if (target.state?.isSubmitting) return;
    target.handlePrimarySubmitClick();
  };

  handlePendingStatsChange = (stats) => {
    if (!stats || typeof stats !== 'object') return;
    const total = Number(stats.total || 0);
    const encrypted = Number(stats.encrypted || 0);
    const submittedSinceLastEdit = !!stats.submittedSinceLastEdit;
    const isSubmitting = !!stats.isSubmitting;
    const prev = this.state.pendingSubmitStats || {};
    if (
      prev.total === total &&
      prev.encrypted === encrypted &&
      !!prev.submittedSinceLastEdit === submittedSinceLastEdit &&
      !!prev.isSubmitting === isSubmitting
    ) return;
    this.setState({ pendingSubmitStats: { total, encrypted, submittedSinceLastEdit, isSubmitting } });
  };

	  handleFilterChangeForUrl = (newFilterStateFromResults) => {
	    // Requirement: Internal Updates: Update local state WITHOUT modifying the URL.
	    const nextFilterState = normalizeSurveyToolFilterState(newFilterStateFromResults);
    const nextFilterSig = serializeSurveyToolFilterState(nextFilterState);
    if (nextFilterSig === this._filterStateSig) return;
	    this._filterStateSig = nextFilterSig;
		    this.setState({ filterState: nextFilterState });
		  };

  handleFilteredQuestionCountUpdate = (count, encryptedCount) => {
    // Keep UI stable while cache warms or if a transient 0 arrives.
    if (!this.props.isQuestionCacheReady) return;
    this.commitQuestionCountState(count, encryptedCount, {
      rememberStable: true,
      ignoreTransientZero: true,
    });
  };

  handleFilterActivityChange = (isActive) => {
    const nextActive = !!isActive;
    if (nextActive === !!this.state.isFilterActive) return;
    this.setState({ isFilterActive: nextActive });
  };

  toggleSelectorDropdown = () => {
    this.setState((prevState) => ({ selectorDropdownOpen: !prevState.selectorDropdownOpen }));
  };

  handlePubKeyUpdate = (pk) => {
    if (pk === this.state.pubKey) return;
    this.setState({ pubKey: pk });
  };

  handleUpdateSelectedTypes = (selectedTypes) => {
    this.setState({ selectedTypes });
  };

  copySurveyIdToClipboard = (surveyID = null) => {
    const { surveys, selectedSurveyIndex } = this.state;
    let idToCopy = surveyID;

    if (!idToCopy) {
      const urlParams = new URLSearchParams(window.location.search);
      idToCopy = urlParams.get('surveyID');
    }
    if (!idToCopy && selectedSurveyIndex !== null && surveys[selectedSurveyIndex]) {
      idToCopy = surveys[selectedSurveyIndex].id;
    }

    if (idToCopy) {
      navigator.clipboard
        .writeText(idToCopy)
        .then(() => {
          if (!this._isMounted) return;
          this.setState({ copySurveyIdSuccess: true });
          if (this._copySurveyIdTimer) {
            clearTimeout(this._copySurveyIdTimer);
          }
          this._copySurveyIdTimer = setTimeout(() => {
            if (!this._isMounted) return;
            this._copySurveyIdTimer = null;
            this.setState({ copySurveyIdSuccess: false });
          }, 2000);
        })
        .catch(err => {
          surveyLog.error('Could not copy survey ID:', err);
        });
    } else {
      surveyLog.error('No survey ID available to copy.');
    }
  };

  getParsedQuestionsCacheForRender = (slug, networkID) => {
    const nonce = Number(this.props.questionsCacheNonce || 0);
    const memoKey = `${String(slug || '')}|${String(networkID || '')}|${nonce}`;
    if (this._renderQuestionsCacheMemoKey === memoKey && this._renderQuestionsCacheMemoValue) {
      return this._renderQuestionsCacheMemoValue;
    }

    let parsedQuestionsCache = null;
    try {
      parsedQuestionsCache = readQuestionsCacheRef(slug) || {};
    } catch (e) {
      surveyLog.warn("Could not parse questionsCache in SurveySelector render", e);
    }

    this._renderQuestionsCacheMemoKey = memoKey;
    this._renderQuestionsCacheMemoValue = parsedQuestionsCache;
    return parsedQuestionsCache;
  };

  // Helper function to check if all questions for a specific survey are loaded in cache
  areSurveySpecificQuestionsLoaded = (survey, networkId, parsedQuestionsCache) => {
    if (!survey || !Array.isArray(survey.questionIDs) || survey.questionIDs.length === 0) {
      return true; // nothing to check
    }
    if (!networkId) {
      return true; // cannot verify; avoid spinner lock
    }

    try {
      const netKey = String(networkId);
      const netBucket = parsedQuestionsCache?.[netKey] || null;
      if (!netBucket || !netBucket.questions) return false;

      const cachedQuestionMap = netBucket.questions;
      for (const surveyQID of survey.questionIDs) {
        if (!cachedQuestionMap[String(surveyQID).toLowerCase()]) {
          return false; // at least one question missing in cache
        }
      }
      return true;
    } catch (error) {
      surveyLog.error("SurveySelector.areSurveySpecificQuestionsLoaded: error", error);
      return false;
    }
  };

  getSurveyDocumentUrls = (survey = null) => (
    (Array.isArray(survey?.documentURLs) ? survey.documentURLs : [])
      .map((value) => (typeof value === 'string' ? value.trim() : ''))
      .filter(Boolean)
  );

  getSurveyDocumentLinkTitle = (survey = null) => {
    const documentURLs = this.getSurveyDocumentUrls(survey);
    if (documentURLs.length <= 0) return '';
    return documentURLs.length > 1 ? `${documentURLs.length} documents` : documentURLs[0];
  };

  renderQuestionSelectorLabel = ({
    prefixLabel = 'Questions',
    count = 0,
    encryptedCount = 0,
    showEncryptedCount = true,
    showSpinner = false,
    showCacheError = false,
    encryptedCountTestId = '',
  } = {}) => {
    const encryptedBadgeProps = {};
    if (showEncryptedCount && encryptedCountTestId) {
      encryptedBadgeProps['data-testid'] = encryptedCountTestId;
      encryptedBadgeProps['data-ce-encrypted-question-count'] = String(Math.max(0, Number(encryptedCount || 0)));
    }

    return (
      <span className={styles.questionSelectorSummary}>
        <span className={styles.questionSelectorPrimary}>
          <span>{prefixLabel}</span>
          <span className={styles.questionSelectorCount}>({count})</span>
        </span>
        {showEncryptedCount && encryptedCount > 0 && (
          <span className={styles.questionSelectorEncryptedBadge} {...encryptedBadgeProps}>
            <FontAwesomeIcon icon={faLock} className={styles.questionSelectorEncryptedIcon} />
            <span className={styles.questionSelectorEncryptedValue}>{encryptedCount}</span>
          </span>
        )}
        {showCacheError ? (
          <span className={styles.questionSelectorMeta}>(cache error)</span>
        ) : null}
        {showSpinner ? (
          <span className={styles.questionSelectorSpinner}>
            <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        ) : null}
      </span>
    );
  };

  render() {
    const {
      surveys,
      selectedSurveyIndex,
      loading,
      viewMode,
      createSurveyMode,
      filterModalOpen,
      filteredQuestionCount,
      encryptedQuestionCount,
      showResults,
      isFilterActive,
      showLongLoading,
      selectorDropdownOpen,
    } = this.state;
    const sessionConfig = this.props.sessionConfig || null;
    const activeSessionSlug = getActiveSessionSlugFromProps(this.props);
    const hasCacheError = !!this.props.cacheInitializationError;
    const SurveyQuestionsComponent =
      this.props.SurveyQuestionsComponent || this.constructor.SurveyQuestionsComponent;

    const selectedSurvey =
      selectedSurveyIndex !== null && surveys[selectedSurveyIndex]
        ? surveys[selectedSurveyIndex]
        : null;

    // Read from cache mirror once per render (group-aware)
    const { slug, networkID } = this.getQuestionCountContext();
    const parsedQuestionsCache = this.getParsedQuestionsCacheForRender(slug, networkID);
    const questionSelectorLoading = !this.props.isQuestionCacheReady || loading;
    const questionSelectorCounts = this.getDisplayedQuestionCounts({
      loadingActive: questionSelectorLoading,
      count: filteredQuestionCount,
      encryptedCount: encryptedQuestionCount,
    });

    // Dropdown title
    let dropdownTitle;
    if (viewMode === 'questions') {
      // Spinner only reflects active loading. Errors are shown separately so we don't get stuck "loading" forever.
      if (hasCacheError) {
        dropdownTitle = this.renderQuestionSelectorLabel({
          count: questionSelectorCounts.count,
          encryptedCount: questionSelectorCounts.encryptedCount,
          showEncryptedCount: false,
          showCacheError: true,
        });
      } else if (questionSelectorLoading) {
        dropdownTitle = this.renderQuestionSelectorLabel({
          prefixLabel: 'Loading...',
          count: questionSelectorCounts.count,
          encryptedCount: questionSelectorCounts.encryptedCount,
          showEncryptedCount: false,
          showSpinner: true,
        });
      } else {
        dropdownTitle = this.renderQuestionSelectorLabel({
          count: questionSelectorCounts.count,
          encryptedCount: questionSelectorCounts.encryptedCount,
          showEncryptedCount: false,
        });
      }
    } else {
      const surveySpecificQuestionsLoaded = selectedSurvey ? this.areSurveySpecificQuestionsLoaded(selectedSurvey, networkID, parsedQuestionsCache) : true;

      if (selectedSurvey && !surveySpecificQuestionsLoaded) {
        dropdownTitle = (
          <span>
            {selectedSurvey.title}{' '}
            <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        );
      } else if (loading || !this.props.isSurveyCacheReady) {
        // Show spinner if internal loading OR cache flags are not ready.
        dropdownTitle = (
          <span>
            {showLongLoading ? 'Loading... ' : 'Surveys '} <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        );
      } else if (selectedSurvey) {
        const surveyDocumentURLs = this.getSurveyDocumentUrls(selectedSurvey);
        const hasDocUrls = surveyDocumentURLs.length > 0;
        dropdownTitle = (
          <span>
            {selectedSurvey.title}
            {hasDocUrls && (
              <a
                href={surveyDocumentURLs[0]}
                target='_blank'
                rel='noopener noreferrer'
                onClick={(e) => e.stopPropagation()}
                className={styles.selectedSurveyDocLink}
                title={this.getSurveyDocumentLinkTitle(selectedSurvey)}
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            )}
          </span>
        );
      } else if (this.props.surveyId && selectedSurveyIndex === null) {
        // If ID provided but not found yet (and not technically "loading" entire list), show explicit loading state
        dropdownTitle = (
          <span>
            Loading Survey... <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        );
      } else if (surveys.length === 0) {
        // Only show "No surveys found" if we are NOT loading AND cache IS ready.
        dropdownTitle = 'No surveys found';
      } else {
        dropdownTitle = 'Select survey';
      }
    }

    const allowDropdownMenu = (!loading && (this.props.isSurveyCacheReady || viewMode === 'questions'));

    const createSurveyIcon = createSurveyMode ? faMinus : faPlus;
    const surveyForUrl =
      this.state.selectedSurveyIndex !== null &&
      this.state.surveys[this.state.selectedSurveyIndex]
        ? this.state.surveys[this.state.selectedSurveyIndex].id
        : null;
    const pendingSubmitStats = this.state.pendingSubmitStats || { total: 0, encrypted: 0, submittedSinceLastEdit: false, isSubmitting: false };
    const headerSubmitLabel = (this.props.computeSubmitLabel || computeSubmitLabel)({
      getPendingEditStats: () => pendingSubmitStats,
    });
    const showHeaderSubmitButton =
      !this.props.displayAnswerMode &&
      pendingSubmitStats.total > 0 &&
      !pendingSubmitStats.submittedSinceLastEdit &&
      (viewMode === 'questions' || !!selectedSurvey);

    // Define green style for active filter
    const activeGreen = '#11c4dcff';
    const filterButtonStyle = isFilterActive ? { color: activeGreen, borderColor: activeGreen } : {};
    const filterIconStyle = isFilterActive ? { color: activeGreen } : {};
    const questionDashboardKey = this.getQuestionCountContext().contextKey;

    return (
      <div>
        <div id={styles.surveysRow}>
              <Dropdown
                id={styles.surveysDropdown}
                isOpen={selectorDropdownOpen}
                toggle={this.toggleSelectorDropdown}
              >
                  <DropdownToggle
                    id={styles.dropdownToggle}
                    data-testid={viewMode === 'questions' ? E2E_TESTIDS.SURVEY_QUESTIONS_TOGGLE : undefined}
                  >
                    {dropdownTitle}
                    {allowDropdownMenu && (
                      <FontAwesomeIcon
                        icon={faCaretDown}
                        id={styles.dropdownToggleCaret}
                      />
                    )}
                  </DropdownToggle>

                  {allowDropdownMenu && (
                    <DropdownMenu id={styles.dropdownMenu}>
                      <DropdownItem
                        className={`${styles.dropdownItem} ${styles.questionsItem}`}
                        onClick={() => this.selectOption('questions')}
                        active={viewMode === 'questions'}
                      >
                        {this.renderQuestionSelectorLabel({
                          count: questionSelectorCounts.count,
                          encryptedCount: questionSelectorCounts.encryptedCount,
                          showEncryptedCount: selectorDropdownOpen,
                          showSpinner: questionSelectorLoading,
                          encryptedCountTestId: selectorDropdownOpen ? E2E_TESTIDS.SURVEY_QUESTIONS_ENCRYPTED_COUNT : '',
                        })}
                      </DropdownItem>

                    {this.props.isSurveyCacheReady ? (
                      <>
                        {surveys.map((survey, index) => {
                          const surveyQuestionsLoaded = this.areSurveySpecificQuestionsLoaded(survey, networkID, parsedQuestionsCache);
                          const surveyDocumentURLs = this.getSurveyDocumentUrls(survey);
                          const hasDocUrls = surveyDocumentURLs.length > 0;
                          return (
                            <DropdownItem
                              className={`${styles.dropdownItem} ${styles.surveyItem}`}
                              key={index}
                              onClick={() => this.selectSurvey(index)}
                              active={viewMode === 'survey' && selectedSurveyIndex === index}
                            >
                              <span className={styles.surveyItemRow}>
                                <span className={styles.surveyItemTitle}>
                                  {survey.title}
                                </span>
                                <span className={styles.surveyItemMeta}>
                                  {viewMode === 'survey' && selectedSurveyIndex === index && !surveyQuestionsLoaded && (
                                    <FontAwesomeIcon icon={faSpinner} spin className={styles.surveyItemSpinner} />
                                  )}
                                  {hasDocUrls && (
                                    <a
                                      href={surveyDocumentURLs[0]}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                      className={styles.surveyItemDocLink}
                                      onClick={(e) => e.stopPropagation()}
                                      title={this.getSurveyDocumentLinkTitle(survey)}
                                    >
                                      <FontAwesomeIcon icon={faExternalLinkAlt} />
                                    </a>
                                  )}
                                </span>
                              </span>
                            </DropdownItem>
                          );
                        })}

                        {surveys.length === 0 && viewMode === 'survey' && (
                          <DropdownItem disabled className={styles.dropdownItem}>
                            No surveys found in cache.
                          </DropdownItem>
                        )}
                      </>
                    ) : (
                      <DropdownItem disabled className={styles.dropdownItem}>
                        Surveys are still loading...
                      </DropdownItem>
                    )}
              </DropdownMenu>
            )}
          </Dropdown>

          {viewMode === 'questions' && (
            <Button
              id={styles.filterButton}
              data-testid={E2E_TESTIDS.SURVEY_FILTER_TOGGLE}
              onClick={this.toggleFilterModal}
              style={filterButtonStyle}
              aria-label="Filter questions"
              title="Filter questions"
            >
              <FontAwesomeIcon icon={faFilter} id={styles.filterIcon} style={filterIconStyle} />
              {isFilterActive && (
                <span id={styles.clearFilterIconSpan} onClick={this.handleClearFilters}>
                  <FontAwesomeIcon icon={faTimes} id={styles.clearFilterIcon} />
                </span>
              )}
            </Button>
          )}

          <Button
            onClick={this.toggleShowResults}
            id={styles.showResultsButton}
          >
            Results
          </Button>

          <button
            id={styles.createSurveyButton}
            data-testid={E2E_TESTIDS.SURVEY_CREATE_TOGGLE}
            onClick={this.toggleCreateMode}
            style={{ marginLeft: '10px' }}
          >
            <FontAwesomeIcon icon={createSurveyIcon} />
          </button>

          {showHeaderSubmitButton && (
            <button
              type="button"
              className={`${styles.headerSubmitButton} ${styles.submitGlow}`}
              onClick={this.handleHeaderSubmitClick}
              title="Submit responses"
              data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
              disabled={!!pendingSubmitStats.isSubmitting}
            >
              {headerSubmitLabel}
              {pendingSubmitStats.isSubmitting && (
                <FontAwesomeIcon icon={faSpinner} spin style={{ marginLeft: 8 }} />
              )}
            </button>
          )}
        </div>

        {/* Create survey */}
        {createSurveyMode && (
          <CreateQuestionsAndSurveys
            {...this.props}
            toggleLoginModal={this.props.toggleLoginModal}
            expanded={createSurveyMode}
            surveys={surveys}
            surveyIndex={selectedSurveyIndex}
            cache={this.props.cache}
            updateCache={this.props.updateCache}
            sessionConfig={sessionConfig}
            sessionName={this.props.sessionName}
          />
        )}

        {/* Survey / questions views */}
        {viewMode !== 'questions' && selectedSurvey && SurveyQuestionsComponent && (
          <SurveyQuestionsComponent
            ref={this.surveyQuestionsRef}
            useHeaderSubmit={true}
            onPendingStatsChange={this.handlePendingStatsChange}
            displayAnswerMode={this.props.displayAnswerMode}
            viewAddress={this.props.viewAddress}
            account={this.props.account}
            network={this.props.network}
            provider={this.props.provider}
            toggleLoginModal={this.props.toggleLoginModal}
            surveys={surveys}
            loginComplete={this.props.loginComplete}
            pubKey={this.state.pubKey}
            updatePubKey={this.handlePubKeyUpdate}
            surveyIndex={this.state.selectedSurveyIndex}
            surveyId={selectedSurvey.id}
            cache={this.props.cache}
            updateCache={this.props.updateCache}
            refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
            refreshQuestionMetadata={this.props.refreshQuestionMetadata}
            refreshQuestionResponses={this.props.refreshQuestionResponses}
            defaultTags={this.props.defaultTags}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            questionsCacheNonce={this.props.questionsCacheNonce}
            questionResponsesNonce={this.props.questionResponsesNonce}
            ensureQuestionCached={this.props.ensureQuestionCached}
            computeSubmitLabel={this.props.computeSubmitLabel}
            cacheInitializationError={this.props.cacheInitializationError}
            questionScanProgress={this.props.questionScanProgress}
            hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
            sessionSlug={this.props.sessionSlug}
          />
        )}

        {showResults && (
          <SurveyResults
            isOpen={showResults}
            onClose={this.closeShowResults}
            provider={this.props.provider}
            network={this.props.network}
            networkChainId={this.props.networkChainId}
            sbtCacheRevision={this.props.sbtCacheRevision}
            surveyId={viewMode === 'questions' ? null : selectedSurvey?.id}
            cache={this.props.cache}
            updateCache={this.props.updateCache}
            viewMode={viewMode}
            filterState={this.state.filterState}
            questionResponsesNonce={this.props.questionResponsesNonce}
            questionsCacheNonce={this.props.questionsCacheNonce}
            refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
            refreshQuestionMetadata={this.props.refreshQuestionMetadata}
            refreshQuestionResponses={this.props.refreshQuestionResponses}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            defaultTags={this.props.defaultTags}
            sessionInfo={this.props.sessionInfo}
            sessionName={this.props.sessionName}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            isSBTCacheReady={this.props.isSBTCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            // Props for URL updates
	            currentSurveyIdForUrl={surveyForUrl}
	            currentViewModeForUrl={this.state.viewMode}
	            onFilterStateChangeForUrlUpdate={this.handleFilterChangeForUrl}
	            // Props for unified count
	            filteredQuestionsCount={this.state.filteredQuestionCount}
	            onCountUpdate={this.handleFilteredQuestionCountUpdate}
            onFilterChange={this.props.onFilterChange}
            preventUrlChange={this.props.preventUrlChange}
            sessionSlug={this.props.sessionSlug}
            activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
            // Do not drop the pin at the results layer; otherwise /session pages
            // silently fan out to broader scan scope when opening results.
            sessionSlugPinned={this.props.sessionSlugPinned}
          />
        )}


        {viewMode === 'questions' && (
          <QuestionsDashboard
            key={questionDashboardKey}
            account={this.props.account}
            provider={this.props.provider}
            network={this.props.network}
            toggleLoginModal={this.props.toggleLoginModal}
            loginComplete={this.props.loginComplete}
	            cache={this.props.cache}
	            updateCache={this.props.updateCache}

	            onFilteredQuestionCountUpdate={this.handleFilteredQuestionCountUpdate}

            filterModalOpen={filterModalOpen}
            toggleFilterModal={this.toggleFilterModal}
	            handleFilteredQuestionsWithState={
	              this.handleFilteredQuestionsWithState
	            }
	            pubKey={this.state.pubKey}
	            updatePubKey={this.handlePubKeyUpdate}
	            refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
	            refreshQuestionMetadata={this.props.refreshQuestionMetadata}
	            refreshQuestionResponses={this.props.refreshQuestionResponses}
            defaultTags={this.props.defaultTags}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            defaultFilterState={this.props.defaultFilterState}
            // Pass the active filter state down so QuestionFilter can sync
            filterState={this.state.filterState}
            questionsCacheNonce={this.props.questionsCacheNonce}
            questionResponsesNonce={this.props.questionResponsesNonce}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            isSBTCacheReady={this.props.isSBTCacheReady}
            // Ref and handler for clear button
	            questionFilterRef={this.questionFilterRef}
	            onFilterActivityChange={this.handleFilterActivityChange}
	            sessionSlug={this.props.sessionSlug}
	            activeSessionSlug={activeSessionSlug}
            ensureQuestionCached={this.props.ensureQuestionCached}
            computeSubmitLabel={this.props.computeSubmitLabel}
            cacheInitializationError={this.props.cacheInitializationError}
            onPendingStatsChange={this.handlePendingStatsChange}
            surveyQuestionsRef={this.surveyQuestionsRef}
            SurveyQuestionsComponent={this.props.SurveyQuestionsComponent}
            useHeaderSubmit={true}
            questionScanProgress={this.props.questionScanProgress}
            hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
          />
        )}
      </div>
    );
  }
}


export class QuestionsDashboard extends Component {
  constructor(props) {
    super(props);
    this.state = {
      questions: [],
      filteredQuestions: [],
      filterLoading: false,
      initialLoadComplete: false,
      questionResponses: {},
    };
    this._lastLoadContextSignature = '';
  }

  _lastExtraSlugsQuestionsMemo = { key: '', extraQuestions: [], extraQuestionResponses: {} };

  componentDidMount() {
    this.loadQuestions({ resetFilteredQuestions: true });
  }

  componentDidUpdate(prevProps) {
    const sessionChanged =
      prevProps.activeSessionSlug !== this.props.activeSessionSlug ||
      prevProps.sessionSlug !== this.props.sessionSlug;
    const networkChanged = prevProps.network?.id !== this.props.network?.id;
    const cacheReadyTick =
      prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
      this.props.isQuestionCacheReady;
    const nonceTick = prevProps.questionsCacheNonce !== this.props.questionsCacheNonce;
    const responsesNonceTick = prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;
    const progressSlug = normalizeQuestionProgressSlug(resolveEffectiveSlug(this.props));
    const pickScopedQuestionProgress = (progressIn) => {
      if (!progressIn || typeof progressIn !== 'object') return null;
      if (!doesQuestionProgressMatchSlug(progressIn.slug, progressSlug)) return null;
      return progressIn;
    };
    const prevQuestionProgress = pickScopedQuestionProgress(prevProps.questionScanProgress);
    const nextQuestionProgress = pickScopedQuestionProgress(this.props.questionScanProgress);
    const prevDiscoveredQuestions = Math.max(0, Number(prevQuestionProgress?.discoveredQuestions || 0));
    const nextDiscoveredQuestions = Math.max(0, Number(nextQuestionProgress?.discoveredQuestions || 0));
    const prevHydratedQuestions = Math.max(0, Number(prevQuestionProgress?.hydratedQuestions || 0));
    const nextHydratedQuestions = Math.max(0, Number(nextQuestionProgress?.hydratedQuestions || 0));
    const prevPendingMetadataCount = Math.max(0, Number(prevQuestionProgress?.pendingMetadataCount || 0));
    const nextPendingMetadataCount = Math.max(0, Number(nextQuestionProgress?.pendingMetadataCount || 0));
    const progressHydrationTick = (
      (nextDiscoveredQuestions !== prevDiscoveredQuestions ||
        nextHydratedQuestions !== prevHydratedQuestions ||
        nextPendingMetadataCount !== prevPendingMetadataCount) &&
      (nextDiscoveredQuestions > 0 || nextHydratedQuestions > 0 || nextPendingMetadataCount > 0)
    );
    const progressCompletedTick = (
      prevQuestionProgress?.phase === 'hydrate' &&
      nextQuestionProgress?.phase !== 'hydrate'
    );
    if (
      sessionChanged ||
      networkChanged ||
      cacheReadyTick ||
      nonceTick ||
      responsesNonceTick ||
      progressHydrationTick ||
      progressCompletedTick
    ) {
      this.loadQuestions({
        resetFilteredQuestions: sessionChanged || networkChanged,
      });
    }
  }

  applyDefaultTagsFilter = (list) => {
    // Sessions handle scoping. Tags are for organization and user-driven filtering.
    return Array.isArray(list) ? list : [];
  };

  loadQuestions = ({
    resetFilteredQuestions = false,
  } = {}) => {
    surveyLog.log('QuestionsDashboard: loadQuestions - Reading from cache mirror');
    const slug = resolveEffectiveSlug(this.props);
    const loadContext = resolveQuestionsDashboardLoadContext(this.props, slug);
    const effectiveSlug = loadContext.sessionSlug || slug;
    const netIdStr = loadContext.networkIdStr;
    const loadContextSignature = buildQuestionDashboardLoadContextSignature({
      effectiveSlug,
      scopedSessionSlugs: loadContext.scopedSessionSlugs,
      networkID: netIdStr,
    });
    const contextChanged = this._lastLoadContextSignature !== loadContextSignature;
    this._lastLoadContextSignature = loadContextSignature;
    const shouldResetFilteredQuestions =
      resetFilteredQuestions ||
      !this.state.initialLoadComplete ||
      contextChanged;
    if (!netIdStr) {
      surveyLog.error('QuestionsDashboard: Network ID is undefined in loadQuestions.');
      this.setState({
        questions: [],
        ...(shouldResetFilteredQuestions ? { filteredQuestions: [] } : {}),
        questionResponses: {},
      }, () => {
        if (this.props.onFilteredQuestionCountUpdate && shouldResetFilteredQuestions) {
          this.props.onFilteredQuestionCountUpdate(0, 0);
        }
      });
      return;
    }

    let localQuestionsCache = {};
    try { localQuestionsCache = readQuestionsCacheRef(effectiveSlug) || {}; }
    catch (e) {
      surveyLog.error('QuestionsDashboard: Error reading questionsCache from mirror:', e);
      localQuestionsCache = {};
    }

    const networkCache = localQuestionsCache?.[netIdStr] || { questions: {}, questionResponses: {} };
    const questionsData = networkCache.questions || {};
    const questionResponses = mergeQuestionResponses({}, networkCache.questionResponses || {});
    let questions = Object.keys(questionsData).map((qId) => {
      const q = questionsData[qId];
      return {
        id: qId,
        creator: q?.creator || '',
        tags: q?.tags || [],
        ...(q || {}),
        sessionSlug: effectiveSlug,
      };
    });

    const seenQuestionIds = new Set();
    const BLOCKED_QUESTION_IDS_SET = getBlockedQuestionIdsSet(effectiveSlug);
    questions = questions.filter((q) => {
      if (!q || !q.id) return false;
      const questionIdLower = String(q.id).toLowerCase();
      if (BLOCKED_QUESTION_IDS_SET.has(questionIdLower)) return false;
      if (seenQuestionIds.has(questionIdLower)) return false;
      seenQuestionIds.add(questionIdLower);
      return true;
    });

    const extraSlugs = (
      Array.isArray(loadContext.scopedSessionSlugs) && loadContext.scopedSessionSlugs.length > 0
        ? loadContext.scopedSessionSlugs.filter(
          (extraSlug) => normalizeSessionSlugValue(extraSlug) !== normalizeSessionSlugValue(effectiveSlug)
        )
        : getExtraQuestionReadSlugs(this.props, effectiveSlug)
    );

    const extraSlugsMemoKey = extraSlugs.length > 0
      ? [...extraSlugs].sort().join(',') + '|' + netIdStr + '|' + String(this.props.questionsCacheNonce || 0) + '|' + String(this.props.questionResponsesNonce || 0) + '|' + String(this.props.sbtCacheRevision || 0)
      : '';

    let extraQuestions = [];
    let extraQuestionResponses = {};
    if (extraSlugsMemoKey && this._lastExtraSlugsQuestionsMemo.key === extraSlugsMemoKey) {
      extraQuestions = this._lastExtraSlugsQuestionsMemo.extraQuestions;
      extraQuestionResponses = this._lastExtraSlugsQuestionsMemo.extraQuestionResponses || {};
    } else if (extraSlugs.length > 0) {
      const extraDedup = new Set();
      const nextExtraQuestionResponses = {};
      for (const extraSlug of extraSlugs) {
        let extraQuestionsCache = {};
        try { extraQuestionsCache = readQuestionsCacheRef(extraSlug) || {}; }
        catch (e) {
          surveyLog.error('QuestionsDashboard: Error reading questionsCache from mirror for slug "' + extraSlug + '":', e);
          extraQuestionsCache = {};
        }
        const extraNetworkCache = extraQuestionsCache?.[netIdStr] || { questions: {}, questionResponses: {} };
        const extraQuestionsData = extraNetworkCache.questions || {};
        mergeQuestionResponses(nextExtraQuestionResponses, extraNetworkCache.questionResponses || {});
        const BLOCKED_EXTRA_QUESTION_IDS_SET = getBlockedQuestionIdsSet(extraSlug);
        Object.keys(extraQuestionsData).forEach((qId) => {
          const q = extraQuestionsData[qId];
          const questionIdRaw = (q && q.id != null && String(q.id) !== '') ? q.id : qId;
          if (!questionIdRaw) return;
          const questionIdLower = String(questionIdRaw).toLowerCase();
          if (BLOCKED_EXTRA_QUESTION_IDS_SET.has(questionIdLower)) return;
          if (extraDedup.has(questionIdLower)) return;
          extraDedup.add(questionIdLower);
          extraQuestions.push({
            id: questionIdRaw,
            creator: q?.creator || '',
            tags: q?.tags || [],
            ...(q || {}),
            sessionSlug: extraSlug,
          });
        });
      }
      extraQuestionResponses = nextExtraQuestionResponses;
      this._lastExtraSlugsQuestionsMemo = { key: extraSlugsMemoKey, extraQuestions, extraQuestionResponses };
    }
    for (const eq of extraQuestions) {
      const eqIdLower = String(eq.id).toLowerCase();
      if (!seenQuestionIds.has(eqIdLower)) {
        seenQuestionIds.add(eqIdLower);
        questions.push(eq);
      }
    }
    mergeQuestionResponses(questionResponses, extraQuestionResponses);

    questions = this.applyDefaultTagsFilter(questions);
    const encryptedQuestionCount = questions.filter(
      (question) => String(question?.prompt || '').trim() === '[encrypted]'
    ).length;
    const nextState = {
      questions,
      initialLoadComplete: true,
      questionResponses,
    };
    if (shouldResetFilteredQuestions) {
      nextState.filteredQuestions = questions;
    }
    this.setState(nextState, () => {
      if (this.props.onFilteredQuestionCountUpdate && shouldResetFilteredQuestions) {
        this.props.onFilteredQuestionCountUpdate(questions.length, encryptedQuestionCount);
      }
    });
  };

  handleFilteredQuestions = (filteredQuestions, filterState) => {
    const next = this.applyDefaultTagsFilter(filteredQuestions);

    this.setState({ filteredQuestions: next }, () => {
      if (this.props.handleFilteredQuestionsWithState) {
        this.props.handleFilteredQuestionsWithState(next, filterState);
      }
    });
  };

  setFilterLoading = (loading) => {
    this.setState({ filterLoading: loading });
  };

  render() {
    const { filteredQuestions, filterLoading } = this.state;
    const SurveyQuestionsComponent =
      this.props.SurveyQuestionsComponent || this.constructor.SurveyQuestionsComponent;

    return (
      <div className={styles.questionsDashboard}>
        <div className={styles.questionsHeader}></div>

      <QuestionFilter
        ref={this.props.questionFilterRef}
        onFilterActivityChange={this.props.onFilterActivityChange}
        filterModalOpen={this.props.filterModalOpen}
        toggleFilterModal={this.props.toggleFilterModal}
        questions={this.state.questions}
        questionResponses={this.state.questionResponses}
        provider={this.props.provider}
        network={this.props.network}
        onFilter={this.handleFilteredQuestions}
        onCountUpdate={this.props.onFilteredQuestionCountUpdate}
        setFilterLoading={this.setFilterLoading}
        defaultFilterState={this.props.defaultFilterState}
        // Pass the active filterState so the component can initialize correctly from URL
        filterState={this.props.filterState}
        defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
        activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
        sessionSlug={this.props.sessionSlug}
        isQuestionCacheReady={this.props.isQuestionCacheReady}
        isSurveyCacheReady={this.props.isSurveyCacheReady}
        isSBTCacheReady={this.props.isSBTCacheReady}
        currentViewModeForUrl={'questions'}
        currentSurveyIdForUrl={null}
        questionResponsesNonce={this.props.questionResponsesNonce}
        questionsCacheNonce={this.props.questionsCacheNonce}
        defaultTags={this.props.defaultTags}
        /* Ensure per-group storage for filter prefs */
        storageKeyPrefix={buildQuestionFilterStorageKeyPrefix(this.props, resolveEffectiveSlug(this.props))}
      />

        {filterLoading ? (
          <div className={styles.loadingContainer}>
            <FontAwesomeIcon icon={faSpinner} spin size="2x" />
            <p>Applying filter...</p>
          </div>
        ) : SurveyQuestionsComponent ? (
          <SurveyQuestionsComponent
            ref={this.props.surveyQuestionsRef}
            account={this.props.account}
            provider={this.props.provider}
            toggleLoginModal={this.props.toggleLoginModal}
            loginComplete={this.props.loginComplete}
            cache={this.props.cache}
            updateCache={this.props.updateCache}
            questionPool={filteredQuestions}
            isStandalone={true}
            useHeaderSubmit={this.props.useHeaderSubmit}
            pubKey={this.props.pubKey}
            updatePubKey={this.props.updatePubKey}
            network={this.props.network}
            activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
            sessionSlug={this.props.sessionSlug}
            refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
            refreshQuestionMetadata={this.props.refreshQuestionMetadata}
            refreshQuestionResponses={this.props.refreshQuestionResponses}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            isSBTCacheReady={this.props.isSBTCacheReady}
            ensureQuestionCached={this.props.ensureQuestionCached}
            computeSubmitLabel={this.props.computeSubmitLabel}
            onPendingStatsChange={this.props.onPendingStatsChange}
            questionScanProgress={this.props.questionScanProgress}
            hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
          />
        ) : null}
      </div>
    );
  }
}
