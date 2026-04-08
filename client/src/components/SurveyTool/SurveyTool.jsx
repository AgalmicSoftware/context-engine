/** @file SurveyTool.jsx */

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
  InputGroupAddon,
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
import { faBookmark, faLock, faUnlock, faPlus, faMinus, faCaretDown, faCaretUp, faCheck, faTimes, faArrowLeft, faArrowRight, faSpinner, faExpand, faExternalLinkAlt, faFilter, faExclamationCircle, faMicrophone, faChevronLeft, faChevronRight, faComment, faQuestionCircle, faBullhorn, faRobot } from '@fortawesome/free-solid-svg-icons';

import AudioInput from '../Shared/AudioInput/AudioInput.jsx';
import CreateSurvey from './CreateSurvey';
import SurveyResults from './SurveyResults';
import QuestionFilter from './QuestionFilter';
import PileHologramAssistant from './PileHologramAssistant.jsx';
import QuestionTagDropdown, {
  getQuestionTagDisplayList,
} from './QuestionTagDropdown.jsx';
import SingleQuestionResponse from './SingleQuestionResponse';
import { JsonButtonRow, JsonIconButton, JsonPanel, JsonToggleButton } from '../Shared/Json/JsonControls';

// Crypto and contract utilities
import contractScripts, {
  getAllSessionSlugs,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
  getSessionSlugByName
} from '../../utilities/web3/contractScripts.js';
import { ethers, utils } from 'ethers';
import CESlider from '../Shared/CESlider';
import proposalScripts from 'utilities/proposalScripts.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { serializeFilterState, deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { ENABLE_IMPORTANCE_SLIDER_TOGGLE } from '../../variables/appConfig.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createLogger } from 'utilities/logging.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
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

import { SurveySelector, QuestionsDashboard } from './SurveySelector.jsx';

export {
  SurveySelector,
  QuestionsDashboard,
};

export {
  areEnvelopesEquivalent,
  buildQuestionScanProgressDisplay,
  buildSurveyDraftSemanticSignature,
  computeSubmitLabel,
  doesQuestionProgressMatchSlug,
  getPendingStatsSnapshotFromState,
  hasConvictionOrImportanceValueForQuestion,
  hasMeaningfulFieldValue,
  normalizeQuestionProgressSlug,
  normalizeSurveyToolFilterState,
  resolveEffectiveSlug,
  resolveSlugForIds,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  shouldRenderInlineSubmitButton,
  shouldRenderSubmittedIndicator,
  shouldShowPileFullLoadingState,
  shouldShowSingleQuestionResponseLookupSpinner,
  updateSubmittedSinceLastEdit,
} from './surveyToolUtils.js';

export class DeferredCommitSlider extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      liveValue: this.normalizeValue(props.value),
      isInteracting: false,
    };
  }

  componentDidUpdate(prevProps) {
    const prevValue = this.normalizeValue(prevProps.value);
    const nextValue = this.normalizeValue(this.props.value);
    if (prevValue === nextValue) return;
    if (this.state.isInteracting) return;
    if (this.state.liveValue === nextValue) return;
    this.setState({ liveValue: nextValue });
  }

  normalizeValue = (value) => clampSliderValue(value, this.props.min, this.props.max);

  handleChangeStart = () => {
    if (this.state.isInteracting) return;
    this.setState({ isInteracting: true });
  };

  commitValue = (value = this.state.liveValue) => {
    const committedValue = this.normalizeValue(value);
    const propValue = this.normalizeValue(this.props.value);
    if (this.state.isInteracting) {
      this.setState({ isInteracting: false });
    }
    if (committedValue === propValue) return;
    if (typeof this.props.onCommit === 'function') {
      this.props.onCommit(committedValue);
    }
  };

  handleChange = (nextValue, event) => {
    const normalizedValue = this.normalizeValue(nextValue);
    const isKeyboardEvent = event?.type === 'keydown';
    const nextState = {};

    if (this.state.liveValue !== normalizedValue) {
      nextState.liveValue = normalizedValue;
    }
    if (!isKeyboardEvent && !this.state.isInteracting) {
      nextState.isInteracting = true;
    }

    const hasStateChange = Object.keys(nextState).length > 0;
    if (hasStateChange) {
      this.setState(nextState, () => {
        if (isKeyboardEvent) this.commitValue(normalizedValue);
      });
      return;
    }

    if (isKeyboardEvent) {
      this.commitValue(normalizedValue);
    }
  };

  handleChangeComplete = () => {
    this.commitValue(this.state.liveValue);
  };

  render() {
    const {
      children,
      min,
      max,
      step = 1,
      disabled = false,
      tooltip = false,
      className,
      style,
    } = this.props;
    const sliderProps = {
      min,
      max,
      step,
      disabled,
      tooltip,
      className,
      style,
      value: this.state.liveValue,
      onChangeStart: this.handleChangeStart,
      onChange: this.handleChange,
      onChangeComplete: this.handleChangeComplete,
    };

    return children({
      value: this.state.liveValue,
      sliderProps,
    });
  }
}

class SurveyTool extends Component {

  constructor(props) {
    super(props);

    // Hydrate filter from URL for full mode (consume and clear)
    let urlFilterState = null;
    // Only run if not in Pile mode (Pile handles its own) and no prop provided
    const isPile = props.minifiedMode === 'pile';
    const hasPropFilter = isSurveyToolFilterStateActive(props.filterState);

    if (!isPile && !hasPropFilter && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const filterParam = url.searchParams.get('filter');
        if (filterParam) {
          urlFilterState = normalizeSurveyToolFilterState(deserializeFilterState(filterParam));
          // Clear from URL immediately to prevent re-parsing or pollution
          url.searchParams.delete('filter');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        surveyLog.error("SurveyTool: Error hydrating filter state from URL", e);
      }
    }
    this.state = {
      cache: {
        surveyIDs: [],
        questionIDs: [],
        questionResponses: {},
        arweaveContent: {},
      },
      latestBlockNumber: 0,
      events: [],
      showResultsModal: this.props.autoOpenResults || false,
      pubKey: '',
      questionsCacheNonce: 0,
      loading: false,
      hydratedFilterState: urlFilterState, // Store the consumed state
    };

    this.surveyQuestionsRef = React.createRef();

    // updateCache (group-aware; per-group surveysCache; numeric to string migration)
    this.updateCache = (updater, cb) => {
      if (typeof updater !== 'function') {
        surveyLog.error('updateCache expects a function; got:', updater);
        return;
      }
      const resolvedProps = this.getResolvedSurveyToolProps();
      const slug = resolveEffectiveSlug(resolvedProps);
      const updateCacheContext = resolveUpdateCacheContext(resolvedProps, slug);
      const effectiveSlug = updateCacheContext.sessionSlug || slug;
      const netIdStr = updateCacheContext.networkIdStr;

      this.setState(
        prev => {
          // Merge draft into component state
          const newCache = updater(prev.cache || {});
          // Merge draft into canonical cache
          if (netIdStr) {
            try {
              const global = ensureSurveysNet(readSurveysCache(effectiveSlug), netIdStr);
              const net = global[netIdStr];

            // Selectively merge recognised sub-objects
            if (newCache.surveys) {
              net.surveys = { ...net.surveys, ...newCache.surveys };
            }
            if (newCache.surveyResponses) {
              net.surveyResponses = {
                ...net.surveyResponses,
                ...newCache.surveyResponses,
              };
            }
            if (newCache.surveyResponsesLatestBlock) {
              net.surveyResponsesLatestBlock = {
                ...net.surveyResponsesLatestBlock,
                ...newCache.surveyResponsesLatestBlock,
              };
            }
            writeSurveysCache(effectiveSlug, global);
          } catch (err) {
            surveyLog.warn('[SurveyTool] updateCache merge failed:', err);
          }
        }
        return { cache: newCache };
      },
      cb,
    );
  };

  }

  getSurveyToolSessionProp = () => {
    if (typeof this.props.sessionSlug === 'string') return normalizeSessionSlugValue(this.props.sessionSlug);
    return undefined;
  };

  getResolvedSurveyToolProps = () => {
    const sessionSlug = this.getSurveyToolSessionProp();
    if (typeof sessionSlug === 'undefined') return this.props;
    return {
      ...this.props,
      sessionSlug,
    };
  };

  handleHeaderSubmitClick = () => {
    const target = this.surveyQuestionsRef?.current;
    if (!target || typeof target.handlePrimarySubmitClick !== 'function') return;
    if (target.state?.isSubmitting) return;
    target.handlePrimarySubmitClick();
  };

  updatePubKey = (newPubKey) => {
    this.setState({ pubKey: newPubKey });
  };

  getNormalizedSurveyIdFromProps = () => {
    const { surveyId, surveyID } = this.props;
    const rawId = surveyId || surveyID;
    return rawId ? String(rawId).trim().toLowerCase() : null;
  };

  handleTopLevelFilterStateUrlUpdate = (newFilterState) => {
    if (typeof window === 'undefined') return;
    const serializedState = serializeSurveyToolFilterState(newFilterState);
    const normalizedSurveyId = this.getNormalizedSurveyIdFromProps();
    const slug = resolveEffectiveSlug(this.getResolvedSurveyToolProps()) || '';
    let newPath = normalizedSurveyId
      ? `/survey/${normalizedSurveyId}/results`
      : `/questions/results`;

    if (serializedState) {
      newPath += `?filter=${serializedState}`;
    }
    newPath = appendExplicitSessionHintToPath(newPath, slug);
    newPath = applyExistingGroupPrefix(newPath);

    if (!this.props.preventUrlChange) {
      const currentUrl = `${window.location.pathname}${window.location.search || ''}`;
      if (currentUrl !== newPath) {
        window.history.replaceState({}, '', newPath);
      }
    }
  };

  findSurveyInAllCaches = (surveyID) => {
    if (!surveyID) return null;
    const sid = String(surveyID).toLowerCase();

    const entries = listNamespaceEntriesSync('surveysCache', { cloneValues: false });
    for (const entry of entries) {
      const slug = String(entry?.slug || '');
      const cache = (entry?.value && typeof entry.value === 'object') ? entry.value : {};
      for (const netKey in cache) {
        if (cache[netKey]?.surveys?.[sid]) {
          const foundData = cache[netKey].surveys[sid];
          return { data: foundData, foundSlug: slug };
        }
      }
    }
    return null;
  };


  async componentDidMount() {
    if (
      !window.location.pathname.includes('/survey/') &&
      !window.location.pathname.includes('/question/') &&
      !window.location.pathname.includes('/questions') &&
      !window.location.pathname.includes('/surveys')
    ) {
      if (this.props.minifiedMode !== 'pile' && !this.props.preventUrlChange && !this.props.miniMode) {
        window.history.pushState({}, '', '/questions');
      }
    }

    // Initial call to fetch survey list from cache.
    this.fetchSurveys();
  }

  componentDidUpdate(prevProps, prevState) {
    if (
        prevProps.network?.id !== this.props.network?.id ||
        (prevProps.isSurveyCacheReady !== this.props.isSurveyCacheReady && this.props.isSurveyCacheReady)
    ) {
        this.fetchSurveys();
    }

    if (this.props.autoOpenResults && !prevProps.autoOpenResults && !this.state.showResultsModal) {
      this.setState({ showResultsModal: true });
    }

    const questionCacheReadyChanged =
      prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady;
    const responsesCacheReadyChanged =
      prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady;
    const questionResponsesNonceChanged =
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;
    const networkChanged = prevProps.network?.id !== this.props.network?.id;

    if (
      (questionCacheReadyChanged && this.props.isQuestionCacheReady) ||
      (responsesCacheReadyChanged && this.props.isResponsesCacheReady) ||
      questionResponsesNonceChanged ||
      networkChanged
    ) {
      this.setState(prev => ({ questionsCacheNonce: prev.questionsCacheNonce + 1 }));
    }
  }


  componentWillUnmount() {
  }

    closeResultsModal = () => {
      const hasExternalCloseHandler = typeof this.props.onResultsModalClose === 'function';
      let oldPath = window.location.pathname;
      if (oldPath.endsWith('/results') && !hasExternalCloseHandler) {
        const trimmed = oldPath.slice(0, oldPath.length - '/results'.length);
        window.history.pushState({}, '', trimmed);
      }
      this.setState({ showResultsModal: false });
      if (hasExternalCloseHandler) {
        this.props.onResultsModalClose();
      }
    };

  getSurveyData = async (surveyID) => {
    if (this.props.singleQuestionMode) {
      return null;
    }

    // 1. Resolve Context
    // MainSite has already done the heavy lifting. We trust the resolved session slug
    // (via resolveEffectiveSlug) is the correct context for this surveyID.
    const resolvedProps = this.getResolvedSurveyToolProps();
    const slug = resolveEffectiveSlug(resolvedProps);
    const surveyReadContext = resolveSurveyReadContext(resolvedProps, slug);
    const effectiveSlug = surveyReadContext.sessionSlug || slug;
    const netIdStr = surveyReadContext.networkIdStr;
    const loweredSurveyID = String(surveyID).toLowerCase();

    surveyLog.log(`[SurveyTool] Getting data for ${loweredSurveyID} in context: ${effectiveSlug} (Chain: ${netIdStr})`);

    let surveyData = null;

    // 2. Check Local Cache (Primary Strategy)
    if (netIdStr) {
      const surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);

      if (surveysCache[netIdStr]?.surveys?.[loweredSurveyID]) {
        surveyData = surveysCache[netIdStr].surveys[loweredSurveyID];
      }
    }

    // 3. Fallback: Check All Caches (Cross-Group Strategy)
    // If missing in current group, it might be cached in another group (e.g. user navigated back/forth)
    if (!surveyData) {
        const found = this.findSurveyInAllCaches(loweredSurveyID);
        if (found) {
          surveyLog.log(`[SurveyTool] Found survey ${loweredSurveyID} cached in different group: '${found.foundSlug}'. Using cached data.`);
          surveyData = found.data;
        }
    }

    // 4. Fallback: Fetch from Chain (Active Context Only)
    // If MainSite let us render, it implies the survey SHOULD be here, or we need to fetch it fresh.
    if (!surveyData && netIdStr) {
      surveyLog.log(`[SurveyTool] Cache miss. Fetching from chain for ${effectiveSlug}...`);
      try {
          surveyData = await contractScripts.getSurveyDataById(resolvedProps.provider, loweredSurveyID, effectiveSlug);

          if (surveyData) {
            // Normalize
            surveyData.surveyID = loweredSurveyID;
            if (!surveyData.questionIDs) surveyData.questionIDs = [];
            if (!surveyData.creator) surveyData.creator = "";
            surveyData.id = surveyData.surveyID;

            // Write back to cache immediately to prevent refetch
            const cacheToUpdate = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
            if (!cacheToUpdate[netIdStr]) cacheToUpdate[netIdStr] = { surveys: {}, surveysLatestBlock: 0, surveyResponses: {} };
            if (!cacheToUpdate[netIdStr].surveys) cacheToUpdate[netIdStr].surveys = {};

            cacheToUpdate[netIdStr].surveys[loweredSurveyID] = surveyData;
            await writeSurveysCache(effectiveSlug, cacheToUpdate);
          }
      } catch (e) {
          surveyLog.error("[SurveyTool] Chain fetch failed:", e);
      }
    }

    return surveyData;
  };


    loadInitialData = async () => {
      surveyLog.log('SurveyTool: loadInitialData - This method is deprecated for initial broad survey fetching.');
    };


		  async fetchSurveys() {
	      const requestEpoch = (Number(this._surveyToolFetchEpoch || 0) + 1);
	      this._surveyToolFetchEpoch = requestEpoch;
      if (!this.state.loading) {
		    this.setState({ loading: true });
      }

	    const resolvedProps = this.getResolvedSurveyToolProps();
	    const slug = resolveEffectiveSlug(resolvedProps);
	    const surveyReadContext = resolveSurveyReadContext(resolvedProps, slug);
	    const effectiveSlug = surveyReadContext.sessionSlug || slug;
	    const netIdStr = surveyReadContext.networkIdStr;
      if (!netIdStr) {
        if (requestEpoch !== this._surveyToolFetchEpoch) return;
        surveyLog.error('SurveySelector: Network ID is undefined in fetchSurveys.');
        this.setState({ surveys: [], loading: false });
        return;
      }

      // Track the last good context (not React state; no re-render)
      const prevCtx = this._lastSurveysCtx || {};
      const ctxChanged = (prevCtx.slug !== effectiveSlug) || (prevCtx.netIdStr !== netIdStr);

	    const prevList = Array.isArray(this.state.surveys) ? this.state.surveys : [];
	    const prevCount = prevList.length;

	    // Read caches (group-aware; ensure string network key)
	    let surveysCache = ensureSurveysNet(await readSurveysCacheAsync(effectiveSlug), netIdStr);
      // Read path only: avoid write-on-read feedback loops via questionsCacheNonce.
      if (requestEpoch !== this._surveyToolFetchEpoch) return;

	    const surveyBag = surveysCache?.[netIdStr]?.surveys || {};

	    // If backing map is empty, don't clobber an existing non-empty UI unless ctx changed
	    if (!surveyBag || Object.keys(surveyBag).length === 0) {
	      if (prevCount > 0 && !ctxChanged) {
          if (requestEpoch !== this._surveyToolFetchEpoch) return;
          this.setState({ loading: false }, this.updateSelectedSurvey);
          return;
        }
        if (requestEpoch !== this._surveyToolFetchEpoch) return;
        this.setState({ surveys: [], loading: false }, this.updateSelectedSurvey);
        this._lastSurveysCtx = { slug: effectiveSlug, netIdStr };
        return;
      }

      // Build list from cache; do NOT exclude surveys for blocked question IDs.
      const next = [];
      const seen = new Set();

      for (const sid of Object.keys(surveyBag)) {
        const sData = surveyBag[sid];
        if (!sData || !sData.title || !Array.isArray(sData.questionIDs)) continue;

        const qids = (sData.questionIDs || []).map(q => String(q || '').toLowerCase());
        if (qids.length === 0) continue;

	      // no survey-level blocklist; blocked questions are filtered at the question level elsewhere

	      if (!sData.id) sData.id = sData.surveyID || sid;
	      const lowered = String(sData.id || sid).toLowerCase();
	      if (!seen.has(lowered)) {
	        seen.add(lowered);
          next.push(sData);
        }
      }

      // Strong “don’t clobber” guards:
      // 1) Never drop to empty unless slug/network context changed.
      if (next.length === 0 && prevCount > 0 && !ctxChanged) {
        if (requestEpoch !== this._surveyToolFetchEpoch) return;
        this.setState({ loading: false }, this.updateSelectedSurvey);
        return;
      }

      // 2) If the recomputed list shrank while caches may still be warming, keep previous.
      const warming = (!this.props.isSurveyCacheReady || !this.props.isQuestionCacheReady);
      if (next.length < prevCount && !ctxChanged && warming) {
        if (requestEpoch !== this._surveyToolFetchEpoch) return;
        this.setState({ loading: false }, this.updateSelectedSurvey);
        return;
      }

      if (requestEpoch !== this._surveyToolFetchEpoch) return;
      this.setState({ surveys: next, loading: false }, this.updateSelectedSurvey);
      this._lastSurveysCtx = { slug: effectiveSlug, netIdStr };
    }


  // CRITICAL: Preserves single-item fetching if not in cache. (group-aware)
  ensureQuestionCached = async (questionId, ctx = {}) => {
    const resolvedProps = this.getResolvedSurveyToolProps();
    const currentSlug = resolveEffectiveSlug(resolvedProps); // We must write to the CURRENT view's cache to unblock UI
    const currentCacheContext = resolveEnsureQuestionCachedContext(resolvedProps, currentSlug);
    const netIdStr = currentCacheContext.networkIdStr || '';
    if (!netIdStr) {
      surveyLog.error('SurveyTool: Network ID undefined in ensureQuestionCached');
      return;
    }
    let questionsCache = ensureQuestionsNet(await readQuestionsCacheAsync(currentSlug), netIdStr);

    const qIdLower = String(questionId).toLowerCase();
    if (!questionsCache[netIdStr].questions[qIdLower]) {
      // Not in cache, determine where to fetch from
      let fetchSlug = currentSlug;

      // 1. Prefer explicit session name if provided
      const sessionNameHint = ctx.sessionName;
      if (sessionNameHint) {
        const mapped = getSessionSlugByName(sessionNameHint);
        if (mapped !== null) fetchSlug = mapped;
      } else {
        // 2. Resolve based on ID/context
        fetchSlug = resolveSlugForIds({
           questionId: qIdLower,
           props: resolvedProps,
           network: resolvedProps.network
        });
      }

      surveyLog.log(`SurveyTool: Question ${qIdLower} not in ${currentSlug} cache. Fetching from: '${fetchSlug}'...`);

      const litHooks =
        resolvedProps.lit ||
        resolvedProps.litHooks ||
        (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
      const decryptContext = {
        account: resolvedProps.account || '',
        providerLike: resolvedProps.provider || '',
        chainId: currentCacheContext.networkId || null,
        litHooks,
        litOpts: litHooks && typeof litHooks.getKey === 'function'
          ? { getKey: litHooks.getKey }
          : null,
      };

      let questionData = await contractScripts.getQuestionData(
        resolvedProps.provider,
        qIdLower,
        fetchSlug,
        { decryptContext }
      );

      // Optional legacy fallback for truly general views only.
      const allowGeneralFallback = !currentSlug;
      if (!questionData && fetchSlug !== '' && allowGeneralFallback) {
         surveyLog.log(`SurveyTool: Question ${qIdLower} not found in '${fetchSlug}', trying general fallback...`);
         questionData = await contractScripts.getQuestionData(
           resolvedProps.provider,
           qIdLower,
           '',
           { decryptContext: { ...decryptContext, chainId: Number(resolvedProps.network?.id || 0) || decryptContext.chainId } }
         );
      }

      if (questionData) {
        questionData.id = qIdLower; // Ensure id is lowercase
        if (!questionData.creator) questionData.creator = ""; // Ensure creator string exists
        if (!questionData.tags) questionData.tags = []; // Ensure tags array exists

        // Write to the CURRENT effective cache so SurveySelector sees it loaded.
        // Use an atomic merge because direct /survey/:id loads fetch many question ids in parallel.
        const persistedCache = await updateCacheAtomic('questionsCache', currentSlug, (current) => {
          const nextCache = ensureQuestionsNet(
            (current && typeof current === 'object') ? current : {},
            netIdStr
          );
          nextCache[netIdStr].questions[qIdLower] = questionData;
          return nextCache;
        });
        const persisted = !!persistedCache;
        surveyLog.log(`SurveyTool: Question ${qIdLower} fetched and cached in ${currentSlug}.`);

        // cacheHasLoaded is owned by MainSite persistent-state verification.
        if (!persisted) {
          surveyLog.warn('SurveyTool: question cache persist failed while ensuring question cached', {
            slug: currentSlug,
            questionId: qIdLower,
          });
        }
        // Force a nonce update so children (like QuestionsDashboard) re-read the cache
        this.setState(prevState => ({ questionsCacheNonce: prevState.questionsCacheNonce + 1 }));
      } else {
        surveyLog.warn(`SurveyTool: Question data not found on chain for ID: ${qIdLower}`);
      }
    }
  };


  render() {
    const activeSessionSlug = getActiveSessionSlugFromProps(this.props);
    const toolSessionSlug = this.getSurveyToolSessionProp();
    if (this.props.minifiedMode === 'pile') {
      return (
        <PileViewMode
          {...this.props}
          isStandalone={true}
          surveyIndex={0}
          onFilterChange={this.props.onFilterChange}
          questionsCacheNonce={this.state.questionsCacheNonce}
          ensureQuestionCached={this.ensureQuestionCached}
          pubKey={this.state.pubKey}
          updatePubKey={this.updatePubKey}
          computeSubmitLabel={computeSubmitLabel}
          // Canonical session slug.
          activeSessionSlug={activeSessionSlug}
          sessionSlug={toolSessionSlug}
        />
      );
    }

    // If singleQuestionMode is true, we skip the SurveySelector and render just the single question flow.
    if (this.props.singleQuestionMode) {
      return (
        <div id={styles.surveySelectorRow}>
          <SurveyQuestions
            questionID={this.props.questionID}
            responderAddress={this.props.responderAddress}
            singleQuestionMode={true}
            toggleLoginModal={this.props.toggleLoginModal}
            account={this.props.account}
            provider={this.props.provider}
            loginComplete={this.props.loginComplete}
            loginInProgress={this.props.loginInProgress}
            network={this.props.network}
            cache={this.state.cache}
            updateCache={this.updateCache}
            pubKey={this.state.pubKey}
            updatePubKey={this.updatePubKey}
            refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
            refreshQuestionMetadata={this.props.refreshQuestionMetadata}
            refreshQuestionResponses={this.props.refreshQuestionResponses}
            defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
            isQuestionCacheReady={this.props.isQuestionCacheReady}
            isResponsesCacheReady={this.props.isResponsesCacheReady}
            isSurveyCacheReady={this.props.isSurveyCacheReady}
            isSBTCacheReady={this.props.isSBTCacheReady}
            questionResponsesNonce={this.props.questionResponsesNonce}
            questionsCacheNonce={this.state.questionsCacheNonce}
            ensureQuestionCached={this.ensureQuestionCached}
            computeSubmitLabel={computeSubmitLabel}
            activeSessionSlug={activeSessionSlug}
            sessionSlug={toolSessionSlug}
            sessionSlugPinned={this.props.sessionSlugPinned}
            hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
          />
        </div>
      );
    }

    const { surveyId, surveyID } = this.props;
    if (
      surveyId &&
      surveyID &&
      String(surveyId).trim().toLowerCase() !== String(surveyID).trim().toLowerCase()
    ) {
      if (process.env.NODE_ENV !== 'production') {
        surveyLog.warn(
          `[SurveyTool] Both surveyId and surveyID props were provided with different values. Preferring surveyId: "${surveyId}" over surveyID: "${surveyID}"`
        );
      }
    }
    const rawId = surveyId || surveyID;
    const normalizedSurveyId = rawId ? String(rawId).trim().toLowerCase() : null;

    // 1. Determine Effective Filter State
    // If props.filterState is missing/empty, use the state hydrated in constructor (which cleared the URL).
    let effectiveFilterState = normalizeSurveyToolFilterState(this.props.filterState);
    if (!serializeSurveyToolFilterState(effectiveFilterState)) {
      effectiveFilterState = normalizeSurveyToolFilterState(this.state.hydratedFilterState || {});
    }

    return (
      <div id={styles.surveySelectorRow}>
        <SurveySelector
          SurveyQuestionsComponent={SurveyQuestions}
          // Normalize surveyId prop casing.
          surveyId={normalizedSurveyId}
          displayAnswerMode={this.props.displayAnswerMode}
          viewAddress={this.props.viewAddress}
          toggleLoginModal={this.props.toggleLoginModal}
          account={this.props.account}
          provider={this.props.provider}
          loginComplete={this.props.loginComplete}
          loginInProgress={this.props.loginInProgress}
          network={this.props.network}
          cache={this.state.cache}
          updateCache={this.updateCache}
          questionID={this.props.questionID}
          responderAddress={this.props.responderAddress}
          singleQuestionMode={false}
          defaultTags={this.props.defaultTags}
          defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
          defaultFilterState={this.props.defaultFilterState}
          refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
          refreshQuestionMetadata={this.props.refreshQuestionMetadata}
          refreshQuestionResponses={this.props.refreshQuestionResponses}
          // Regression guard: SurveyTool owns route/embed auto-open results.
          // Forwarding autoOpenResults here creates a second SurveyResults owner
          // and brings back the double-close bug on embedded/result routes.
          autoOpenResults={false}
          filterState={effectiveFilterState}
          isQuestionCacheReady={this.props.isQuestionCacheReady}
          isResponsesCacheReady={this.props.isResponsesCacheReady}
          isSurveyCacheReady={this.props.isSurveyCacheReady}
          isSBTCacheReady={this.props.isSBTCacheReady}
          networkLatestBlock={this.props.networkLatestBlock}
          questionScanProgress={this.props.questionScanProgress}
          questionResponsesNonce={this.props.questionResponsesNonce}
          questionsCacheNonce={this.state.questionsCacheNonce}
          ensureQuestionCached={this.ensureQuestionCached}
          onFilterChange={this.props.onFilterChange}
          preventUrlChange={this.props.preventUrlChange}
          computeSubmitLabel={computeSubmitLabel}
          activeSessionSlug={activeSessionSlug}
          sessionSlug={toolSessionSlug}
          sessionSlugPinned={this.props.sessionSlugPinned}
          hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
        />
        <SurveyResults
          isOpen={this.state.showResultsModal}
          onClose={this.closeResultsModal}
          provider={this.props.provider}
          network={this.props.network}
          networkChainId={this.props.networkChainId}
          sbtCacheRevision={this.props.sbtCacheRevision}
          surveyId={normalizedSurveyId}
          filterState={effectiveFilterState}
          questionResponsesNonce={this.props.questionResponsesNonce}
          questionsCacheNonce={this.state.questionsCacheNonce}
          refreshSurveyResponsesByID={this.props.refreshSurveyResponsesByID}
          refreshQuestionMetadata={this.props.refreshQuestionMetadata}
          refreshQuestionResponses={this.props.refreshQuestionResponses}
          defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
          defaultTags={this.props.defaultTags}
          sessionInfo={this.props.sessionInfo}
          sessionName={this.props.sessionName}
          isQuestionCacheReady={this.props.isQuestionCacheReady}
          isResponsesCacheReady={this.props.isResponsesCacheReady}
          isSurveyCacheReady={this.props.isSurveyCacheReady}
          isSBTCacheReady={this.props.isSBTCacheReady}
          questionScanProgress={this.props.questionScanProgress}
          onFilterChange={this.props.onFilterChange}
          currentViewModeForUrl={normalizedSurveyId ? 'survey' : 'questions'}
          currentSurveyIdForUrl={normalizedSurveyId || null}
          onFilterStateChangeForUrlUpdate={this.handleTopLevelFilterStateUrlUpdate}
          preventUrlChange={this.props.preventUrlChange}
          sessionSlug={toolSessionSlug}
          activeSessionSlug={activeSessionSlug}
          // Keep this aligned with SurveyPage/OnePageSession. Embedded session pages
          // rely on the pin so results open session-local scope by default.
          sessionSlugPinned={this.props.sessionSlugPinned}
          hideEmbeddedDebugUi={this.props.hideEmbeddedDebugUi}
          />
      </div>
    );
  }
}


export class SurveyQuestions extends Component {
  constructor(props) {
    super(props);
    this.state = {
      surveysResponseState: [],
      displayAnswerMode: this.props.displayAnswerMode,
      viewAddressAnswers: '',
      noResponse: false,
      responseLookupWarning: '',
      userHasResponse: false,
      userResponseEncrypted: false,
      startFresh: false,
      userAnswers: null,
      isDecrypting: false,
      jsonPreview: '',
      isEditing: false,
      isSubmitting: false,
      submitProgress: 0,
      submissionComplete: false,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(false, 'reset'),
      responseUrl: '',
      submissionError: '',
      currentStep: 0,
      questionPool: this.props.isStandalone || this.props.singleQuestionMode ? this.props.questionPool || [] : [],
      questionPoolExpectedIds: [],
      questionPoolPendingIds: [],
      showJson: false,
      showQuestionsJson: false,
      showResponseJson: false,
      copiedQuestionsJson: false,
      copiedResponseJson: false,
      isLoadingResponse: false,
      parsedViewAddressAnswers: null,
      decryptionNonce: 0,
      bookmarkedQuestions: new Set(),
      // JSON view state
      showSurveyJson: false,
      copiedSurveyJson: false,
      // Edit/submit tracking
      modifiedCount: 0,
      pileDiscardedEdits: false,
      encryptedModifiedCount: 0,
      isDirty: false,
      hasEncryptedChanges: false,
      // Auto-decrypt toggle and attempt ledger
      autoDecryptEnabled: false,
      autoDecryptAttempted: {},
      showComments: {},
      lockAudienceMenuByQuestion: {},
      lockAudienceGateDetailsByQuestion: {},
      sliderModeByQuestion: {},
      sliderToggleExpandedByQuestion: {},
      // Defer prefill when login happens before caches are ready
      prefillQueuedAfterCache: false,
      // Visual indicator for account-specific prior-response hydration
      isHydratingPriorResponses: false,
      // Per-field decrypting map (key = `${qid}:${field}`)
      decryptingByKey: {},
      bulkPromptReloading: false,
      lockedGateDetailsExpanded: false,
      gateSbtNameRevision: 0,
      // ZK hasher (injected)
      hasher: null,
      // Allow decrypting viewed (non-own) responses only when viewer satisfies the response gate
      canDecryptOtherResponses: false,
      canDecryptOtherResponsesStatus: 'unknown',
    };
    this.bottomRef = React.createRef();
    this.topRef = React.createRef();
    this._submitGuard = false;
    this._lastPendingStats = null;
    this._priorResponseBackfillAttempted = new Set();
    this._priorResponseBackfillInFlight = null;
    this._priorResponseHydrationContextSig = '';
    // Auto-decrypt queue internals (non-state)
    this._autoDecQueue = [];
    this._autoDecProcessing = false;
    this._autoDecryptMaskedAttemptSignature = {};
    this._decryptFieldTaskInFlight = new Map();
    this._transientTimeouts = new Set();
    this.handleDecryptEdit = this.handleDecryptEdit.bind(this);
  }

  // Auto-decrypt sweep control: blocks automatic decryption for providers that require
  // user-facing signature popups (MetaMask, Porto passkey dialogs). Each decrypt operation
  // triggers a wallet interaction, which is disruptive when done automatically.
  //
  // Per-provider rationale:
  // - wagmi (MetaMask): Blocked - each decrypt requires a MetaMask popup. Keep blocked.
  // - porto: Blocked - passkey prompts still interrupt flow. Consider enabling when
  //   session keys or account abstraction (AA) allow frictionless auto-signing.
  // - web3auth: Allowed (not blocked) - server-side key custody typically avoids popups,
  //   though prompts may still occur on session expiry or certain config changes.
  //
  // Future: When session keys / AA are available for wagmi/porto, this can be relaxed
  // to allow auto-decrypt without popups. Keep this path and comments for that transition.
  isAutoDecryptBlocked = () => {
    try {
      const kind = cryptoUtils.getProviderKind(this.props.provider);
      return kind === 'wagmi' || kind === 'porto';
    } catch (_) {
      return false;
    }
  };


  _persistTimer = null;
  _lastDraftKey = '';
  _lastDraftJSON = null;
  _lastDraftSemanticSignature = null;
  _responseGatePolicyCache = { key: '', cfgSignature: '', cfg: null, value: null, ts: 0 };
  _changedQidsAndFieldsCache = null;
  _pendingEditStatsCache = null;
  _normalizedQuestionEntryKeyCache = new WeakMap();
  _questionByIdLookupCache = {
    stateQuestionPool: null,
    statePileQuestions: null,
    propsQuestionPool: null,
    value: null,
  };
  _currentRenderedQuestionIdsCache = null;
  _currentRenderedQuestionIdsCacheQuestionPool = null;
  _currentRenderedQuestionIdsCacheQuestionPoolLength = 0;
  _currentRenderedQuestionIdsCachePileQuestions = null;
  _currentRenderedQuestionIdsCachePileQuestionsLength = 0;
  _currentRenderedQuestionIdsCacheSingleQuestionMode = false;
  _currentRenderedQuestionIdsCacheQuestionId = '';
  _localCacheSliceMemo = { key: '', value: null, hasValue: false };
  _rehydrateLocalCacheLastSig = '';
  _autoDecryptVisibleSweepCache = null;
  _userAnswersSliceCache = { source: null, value: null };
  _jsonPreviewTimer = null;
  _surveyJsonMetaCache = { key: '', source: null, value: null };
  _lockedQuestionGateDetailsMemo = { key: '', poolRef: null, poolVersion: 0, value: [] };
  _maskedQuestionVisibilityMemoByPool = new WeakMap();
  _canDecryptOtherResponsesKey = '';
  _canDecryptOtherResponsesInFlight = null;
  _canDecryptOtherResponsesSig = '';
  _canDecryptOtherResponsesRunId = 0;
  _fetchSingleQuestionRunId = 0;
  _singleQuestionBootstrapRetryTimer = null;
  _singleQuestionBootstrapRetrySig = '';
  _isMounted = false;
  _autoDecProcessTimer = null;
  _autoDecryptSweepMicrotaskScheduled = false;
  _autoDecryptSweepFrameRequestId = null;
  _queuedAutoDecryptSweepReasons = new Set();
  _gateSbtHydrationSig = '';
  _gateSbtHydrationRetryTimer = null;

  setManagedTimeout = (fn, delayMs = 0) => {
    const timeoutId = setTimeout(() => {
      this._transientTimeouts.delete(timeoutId);
      if (!this._isMounted) return;
      try { fn(); } catch (e) { surveyLog.warn('SurveyTool: callback', e); }
    }, Math.max(0, Number(delayMs) || 0));
    this._transientTimeouts.add(timeoutId);
    return timeoutId;
  };

  clearManagedTimeouts = () => {
    if (!this._transientTimeouts || this._transientTimeouts.size === 0) return;
    this._transientTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this._transientTimeouts.clear();
  };

  clearSingleQuestionBootstrapRetry = () => {
    if (this._singleQuestionBootstrapRetryTimer) {
      clearTimeout(this._singleQuestionBootstrapRetryTimer);
      this._singleQuestionBootstrapRetryTimer = null;
    }
    this._singleQuestionBootstrapRetrySig = '';
  };

  getPendingSingleQuestionBootstrapRetryAttempt = (questionId = '') => {
    const qid = String(questionId || this.props.questionID || '').trim().toLowerCase();
    if (!qid) return 0;
    const currentRetrySig = String(this._singleQuestionBootstrapRetrySig || '').trim().toLowerCase();
    if (!currentRetrySig) return 0;
    const [currentQid = '', currentAttemptToken = '0'] = currentRetrySig.split(':');
    if (currentQid !== qid) return 0;
    const currentAttempt = Number(currentAttemptToken || 0);
    return Number.isFinite(currentAttempt) && currentAttempt > 0 ? currentAttempt : 0;
  };

  updateSingleQuestionDebug = (patch = {}) => {
    if (typeof window === 'undefined') return;
    try {
      const prev =
        (window.__CE_SINGLE_Q_DEBUG__ && typeof window.__CE_SINGLE_Q_DEBUG__ === 'object')
          ? window.__CE_SINGLE_Q_DEBUG__
          : {};
      window.__CE_SINGLE_Q_DEBUG__ = {
        ...prev,
        ...patch,
        updatedAt: Date.now(),
      };
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };

  scheduleSingleQuestionBootstrapRetry = ({ questionId = '', attempt = 0, reason = '' } = {}) => {
    const qid = String(questionId || this.props.questionID || '').trim().toLowerCase();
    if (!qid || !this._isMounted) return false;

    const maxAttempts = 6;
    const nextAttempt = Math.max(1, Number(attempt || 0) + 1);
    if (nextAttempt > maxAttempts) return false;

    const currentRetrySig = String(this._singleQuestionBootstrapRetrySig || '').trim().toLowerCase();
    if (currentRetrySig) {
      const [currentQid = '', currentAttemptToken = '0'] = currentRetrySig.split(':');
      const currentAttempt = Number(currentAttemptToken || 0);
      if (currentQid === qid && Number.isFinite(currentAttempt) && currentAttempt >= nextAttempt) {
        return true;
      }
    }

    const retrySig = `${qid}:${nextAttempt}`;
    if (this._singleQuestionBootstrapRetrySig === retrySig) return true;

    this.clearSingleQuestionBootstrapRetry();
    this._singleQuestionBootstrapRetrySig = retrySig;
    const delayMs = Math.min(25000, 4000 * nextAttempt);

    this._singleQuestionBootstrapRetryTimer = setTimeout(() => {
      this._singleQuestionBootstrapRetryTimer = null;
      this._singleQuestionBootstrapRetrySig = '';
      if (!this._isMounted) return;
      this.fetchSingleQuestionData({
        forceQuestionMetadataRefetch: true,
        bootstrapRetryAttempt: nextAttempt,
      }).catch((error) => {
        surveyLog.error('SurveyQuestions: bootstrap retry failed', {
          questionId: qid,
          attempt: nextAttempt,
          reason,
          error: error?.message || String(error),
        });
      });
    }, delayMs);

    return true;
  };

  shouldUseAnimationFrameForAutoDecryptSweep = () => {
    if (typeof window === 'undefined') return false;
    if (typeof window.requestAnimationFrame !== 'function') return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/jsdom/i.test(ua)) return false;
    return true;
  };

  clearAutoDecryptSweepScheduling = () => {
    this._autoDecryptSweepMicrotaskScheduled = false;
    this._queuedAutoDecryptSweepReasons.clear();
    if (this._autoDecryptSweepFrameRequestId != null && typeof window !== 'undefined') {
      try { window.cancelAnimationFrame(this._autoDecryptSweepFrameRequestId); } catch (e) { surveyLog.warn('SurveyTool: cleanup', e); }
    }
    this._autoDecryptSweepFrameRequestId = null;
  };

  flushQueuedAutoDecryptVisibleSweep = () => {
    this._autoDecryptSweepFrameRequestId = null;
    this._queuedAutoDecryptSweepReasons.clear();
    if (!this._isMounted) return;
    if (!this.state.autoDecryptEnabled || this.isAutoDecryptBlocked()) return;
    this.maybeAutoDecryptVisibleFields();
  };

  queueAutoDecryptVisibleSweep = (reason = 'unknown') => {
    if (!this._isMounted) return;
    if (reason) this._queuedAutoDecryptSweepReasons.add(String(reason));
    if (this._autoDecryptSweepMicrotaskScheduled) return;
    this._autoDecryptSweepMicrotaskScheduled = true;
    scheduleMicrotask(() => {
      this._autoDecryptSweepMicrotaskScheduled = false;
      if (!this._isMounted) return;
      if (this._autoDecryptSweepFrameRequestId != null) return;
      const flush = () => this.flushQueuedAutoDecryptVisibleSweep();
      if (this.shouldUseAnimationFrameForAutoDecryptSweep()) {
        this._autoDecryptSweepFrameRequestId = window.requestAnimationFrame(flush);
        return;
      }
      flush();
    });
  };

  buildAutoDecryptMaskedFieldSignature = (field = null) => {
    if (!field || typeof field !== 'object') return '';
    return [
      String(field.value ?? ''),
      field.encrypted ? '1' : '0',
      String(field.encryptedPortion || ''),
      String(field.hash || ''),
      String(field.encryptionAudience || ''),
    ].join('|');
  };

  buildDecryptTaskKey = (mode, questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    const qid = String(questionId || '').trim().toLowerCase();
    const field = String(fieldToDecrypt || 'both').trim().toLowerCase();
    const responder = String(
      responseOverride?.responder ||
      responseOverride?.responderAddress ||
      this.props?.responderAddress ||
      this.props?.viewAddress ||
      ''
    ).trim().toLowerCase();
    const answerSig = this.buildAutoDecryptMaskedFieldSignature(responseOverride?.answer);
    const additionalSig = this.buildAutoDecryptMaskedFieldSignature(responseOverride?.additional);
    return [String(mode || 'self'), qid, field, responder, answerSig, additionalSig].join('|');
  };

  normalizeSingleQuestionViewedResponse = (rawResponse = null) => {
    if (rawResponse == null) return null;

    if (typeof rawResponse !== 'object' || Array.isArray(rawResponse)) {
      return {
        answer: { value: rawResponse },
        additional: { value: '' },
      };
    }

    const nestedResponse = (
      rawResponse.response &&
      typeof rawResponse.response === 'object' &&
      !Array.isArray(rawResponse.response)
    ) ? rawResponse.response : null;
    const base = nestedResponse
      ? { ...rawResponse, ...nestedResponse }
      : { ...rawResponse };

    const firstDefined = (...values) => {
      for (let i = 0; i < values.length; i += 1) {
        if (values[i] !== undefined) return values[i];
      }
      return undefined;
    };

    const normalizeField = (field, fallbackValue) => {
      const nextField = (
        field && typeof field === 'object' && !Array.isArray(field)
      ) ? { ...field } : {};
      const scalar = (
        field != null &&
        typeof field !== 'object'
      ) ? field : undefined;
      const value = firstDefined(nextField.value, scalar, fallbackValue);
      if (value !== undefined) nextField.value = value;
      return nextField;
    };

    const answerFallback = firstDefined(
      base.answerValue,
      base.value,
      base.responseValue,
      base.answerText,
      base.responseText,
      (
        base.answer == null &&
        (typeof base.response === 'string' || typeof base.response === 'number' || typeof base.response === 'boolean')
      ) ? base.response : undefined
    );
    const additionalFallback = firstDefined(
      base.additionalComment,
      base.additionalComments,
      base.comment,
      base.comments,
      base.additionalText
    );

    const normalized = {
      ...base,
      answer: normalizeField(base.answer, answerFallback),
      additional: normalizeField(base.additional, additionalFallback),
    };
    const hasShapeHints = !!(
      base.answer !== undefined ||
      base.additional !== undefined ||
      answerFallback !== undefined ||
      additionalFallback !== undefined ||
      base.importance !== undefined ||
      base.conviction !== undefined ||
      base.arweaveTxId ||
      base.transactionHash ||
      base.txHash ||
      base.blockNumber !== undefined ||
      base.transactionIndex !== undefined ||
      base.logIndex !== undefined ||
      base.timestamp !== undefined
    );
    return hasShapeHints ? normalized : null;
  };

  runDedupedDecryptTask = (taskKey, runner) => {
    const key = String(taskKey || '');
    if (!key || typeof runner !== 'function') {
      return Promise.resolve(false);
    }
    const existing = this._decryptFieldTaskInFlight.get(key);
    if (existing) return existing;
    const task = Promise.resolve()
      .then(() => runner())
      .finally(() => {
        if (this._decryptFieldTaskInFlight.get(key) === task) {
          this._decryptFieldTaskInFlight.delete(key);
        }
      });
    this._decryptFieldTaskInFlight.set(key, task);
    return task;
  };

  clearGateSbtHydrationRetry = () => {
    if (!this._gateSbtHydrationRetryTimer) return;
    clearTimeout(this._gateSbtHydrationRetryTimer);
    this._transientTimeouts.delete(this._gateSbtHydrationRetryTimer);
    this._gateSbtHydrationRetryTimer = null;
  };

  scheduleGateSbtHydrationRetry = () => {
    if (!this._isMounted) return;
    if (this._gateSbtHydrationRetryTimer) return;
    this._gateSbtHydrationRetryTimer = this.setManagedTimeout(() => {
      this._gateSbtHydrationRetryTimer = null;
      this.hydrateGateSbtLabels({ force: true });
    }, GATE_SBT_HYDRATION_RETRY_MS);
  };

  isResponseJsonPreviewVisible = (stateIn = this.state) => (
    !!(stateIn && stateIn.showResponseJson)
  );

  scheduleJsonPreviewUpdate = (delayMs = 120, force = false) => {
    if (!force && !this.isResponseJsonPreviewVisible()) return;
    if (this._jsonPreviewTimer) clearTimeout(this._jsonPreviewTimer);
    this._jsonPreviewTimer = setTimeout(() => {
      this._jsonPreviewTimer = null;
      this.updateJsonPreview(force);
    }, Math.max(0, Number(delayMs) || 0));
  };

  resolveEffectiveResponseGateConfig = (slugIn = '') => {
    const slug = String(slugIn || '').trim().toLowerCase();
    const resolved = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: slug,
      sessionConfig: (this.props.sessionConfig && typeof this.props.sessionConfig === 'object')
        ? this.props.sessionConfig
        : null,
      resolveBySlug: getStrictSessionConfigBySlug,
    });
    return resolved.effectiveSessionConfig || {};
  };

  resolveSessionChainId = (slugIn = '', cfgIn = null) => {
    const slug = String(
      slugIn || (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : resolveEffectiveSlug(this.props)) || ''
    ).trim().toLowerCase();
    const cfg =
      cfgIn && typeof cfgIn === 'object'
        ? cfgIn
        : this.resolveEffectiveResponseGateConfig(slug);
    return Number(
      cfg?.networkChainId ||
      cfg?.contracts?.surveys?.chainId ||
      cfg?.contracts?.sbtFactory?.chainId ||
      cfg?.__registry?.chainId ||
      cfg?.__registry?.registryChainId ||
      this.props.networkChainId ||
      this.props.network?.id ||
      this.props.network?.chainId ||
      0
    ) || null;
  };

  buildResponseGateConfigSignature = (cfg = {}) => {
    const normText = (value) => String(value == null ? '' : value).trim().toLowerCase();
    const normChain = (value) => {
      const n = Number(value || 0);
      return Number.isFinite(n) && n > 0 ? String(n) : '';
    };
    const normAddresses = (...sources) => Array.from(new Set(
      sources
        .flat()
        .map((addr) => String(addr || '').trim().toLowerCase())
        .filter(Boolean)
    )).sort().join(',');
    const readObj = (value) => (value && typeof value === 'object' ? value : {});
    const stablePairs = (obj, mapper) => Object.keys(readObj(obj))
      .sort()
      .map((key) => `${key}:${mapper(readObj(obj)[key], key)}`)
      .join('|');
    const gateSnapshot = (gate = {}) => {
      const g = readObj(gate);
      return [
        normText(g.gateId || g.id),
        normText(g.label || g.name || g.title),
        normChain(g.chainId),
        normText(g.litChain || g.chain),
        normText(g.mode || g.operator || g.gateMode || g.requireAll),
        normAddresses(g.sbtAddress, g.sbtAddresses),
        normText(g.lookupStatus),
      ].join(',');
    };
    const resourceSnapshot = (resource = {}) => {
      const r = readObj(resource);
      return [
        normText(r.status),
        normText(r.gateId || r.id),
        normText(r.mode || r.operator),
        normText(r.allowFallback),
        gateSnapshot(r.gate),
      ].join(',');
    };

    const sponsoredGates = (cfg?.sponsored?.gates && typeof cfg.sponsored.gates === 'object')
      ? cfg.sponsored.gates
      : {};
    const sponsoredResources = (cfg?.sponsored?.resources && typeof cfg.sponsored.resources === 'object')
      ? cfg.sponsored.resources
      : {};
    const registryGates = (cfg?.__registry?.gatesByResource && typeof cfg.__registry.gatesByResource === 'object')
      ? cfg.__registry.gatesByResource
      : {};

    const sponsoredGatesSig = stablePairs(sponsoredGates, (gate) => gateSnapshot(gate));
    const sponsoredResourcesSig = stablePairs(sponsoredResources, (resource) => resourceSnapshot(resource));
    const registryGatesSig = stablePairs(registryGates, (gate) => gateSnapshot(gate));

    return [
      Number(cfg?.networkChainId || 0) || 0,
      String(cfg?.sponsored?.defaultGateId || ''),
      String(cfg?.__registry?.updatedAt || ''),
      String(cfg?.__registry?.gateAuthority || ''),
      sponsoredGatesSig,
      sponsoredResourcesSig,
      registryGatesSig,
    ].join('|');
  };

  refreshCanDecryptOtherResponses = async () => {
    try {
      const account = String(this.props?.account || '').trim();
      const loggedIn = !!(this.props?.loginComplete && account);
      if (!loggedIn) {
        // Invalidate any in-flight checks so they can't race and re-enable decrypt UI after logout.
        this._canDecryptOtherResponsesRunId += 1;
        this._canDecryptOtherResponsesKey = '';
        this._canDecryptOtherResponsesInFlight = null;
        if (this.state.canDecryptOtherResponses || this.state.canDecryptOtherResponsesStatus !== 'needs-wallet') {
          this.setState({ canDecryptOtherResponses: false, canDecryptOtherResponsesStatus: 'needs-wallet' });
        }
        return false;
      }

      const policy = this.getResponseGatePolicy();
      const recipients = Array.isArray(policy?.recipients) ? policy.recipients : [];
      // If there is no gate recipient policy, the response is not decryptable-by-gate (others should not see decrypt buttons).
      if (recipients.length === 0) {
        // Invalidate any in-flight checks so they can't race and re-enable decrypt UI.
        this._canDecryptOtherResponsesRunId += 1;
        this._canDecryptOtherResponsesKey = '';
        this._canDecryptOtherResponsesInFlight = null;
        if (this.state.canDecryptOtherResponses || this.state.canDecryptOtherResponsesStatus !== 'no-gate') {
          this.setState({ canDecryptOtherResponses: false, canDecryptOtherResponsesStatus: 'no-gate' });
        }
        return false;
      }

      const resourceKey = String(
        policy?.primaryResource ||
          ((this.props.singleQuestionMode || this.props.isStandalone) ? 'questionResponses' : 'surveyResponses')
      ).trim() || 'default';
      // Encryption can include multiple Lit recipients (primary resource gate + fallback default gate).
      // Treat satisfying either as sufficient to show decrypt buttons for viewed (non-own) responses.
      const resourceKeysToCheck = Array.from(new Set([resourceKey, 'default'].filter(Boolean)));
      const resourceKeysSig = resourceKeysToCheck.join(',');
      const slug = this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props);
      const cfg = this.resolveEffectiveResponseGateConfig(slug);

      const key = [
        account.toLowerCase(),
        String(slug || ''),
        resourceKeysSig,
        String(this.props?.sbtCacheRevision || 0),
        String(cfg?.__registry?.updatedAt || ''),
        String(cfg?.__registry?.gateAuthority || ''),
        String(recipients.length),
      ].join('|');
      if (key === this._canDecryptOtherResponsesKey && this._canDecryptOtherResponsesInFlight) {
        return await this._canDecryptOtherResponsesInFlight;
      }
      this._canDecryptOtherResponsesKey = key;
      const runId = (Number(this._canDecryptOtherResponsesRunId) || 0) + 1;
      this._canDecryptOtherResponsesRunId = runId;

      const run = (async () => {
        if (this.state.canDecryptOtherResponsesStatus !== 'checking' &&
          this._canDecryptOtherResponsesRunId === runId &&
          this._canDecryptOtherResponsesKey === key
        ) {
          // Clear any previously granted permission while we verify against the current gate/session/wallet.
          this.setState({ canDecryptOtherResponses: false, canDecryptOtherResponsesStatus: 'checking' });
        }
        const verdicts = [];
        for (const rk of resourceKeysToCheck) {
          verdicts.push(await checkSponsoredAccess({
            sessionConfig: cfg,
            sessionSlug: slug,
            account,
            resourceKey: rk,
          }));
        }
        const statuses = verdicts.map((v) => String(v?.status || 'unknown'));
        const canDecrypt = statuses.includes('granted');
        const status = canDecrypt
          ? 'granted'
          : (statuses.includes('unknown') || statuses.includes('error'))
            ? 'unknown'
            : statuses.includes('denied')
              ? 'denied'
              : statuses.includes('invalid-gate')
                ? 'invalid-gate'
                : statuses.includes('no-gate')
                ? 'no-gate'
                  : (statuses[0] || 'unknown');
        if (this._canDecryptOtherResponsesRunId === runId && this._canDecryptOtherResponsesKey === key) {
          this.setState({
            canDecryptOtherResponses: canDecrypt,
            canDecryptOtherResponsesStatus: status,
          });
        }
        return canDecrypt;
      })();

      let tracked = null;
      tracked = run
        .catch(() => {
          if (this._canDecryptOtherResponsesRunId === runId && this._canDecryptOtherResponsesKey === key) {
            this.setState({ canDecryptOtherResponses: false, canDecryptOtherResponsesStatus: 'unknown' });
          }
          return false;
        })
        .finally(() => {
          // Only clear the pointer if we're still tracking this exact promise.
          if (this._canDecryptOtherResponsesInFlight === tracked) {
            this._canDecryptOtherResponsesInFlight = null;
          }
        });
      this._canDecryptOtherResponsesInFlight = tracked;

      return await this._canDecryptOtherResponsesInFlight;
    } catch (_) {
      try {
        this.setState({ canDecryptOtherResponses: false, canDecryptOtherResponsesStatus: 'unknown' });
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      return false;
    }
  };

  buildCanDecryptOtherResponsesSignature = () => {
    try {
      const account = String(this.props?.account || '').trim().toLowerCase();
      const loggedIn = !!(this.props?.loginComplete && account);

      const policy = this.getResponseGatePolicy();
      const recipients = Array.isArray(policy?.recipients) ? policy.recipients : [];
      const resourceKey = String(
        policy?.primaryResource ||
          ((this.props.singleQuestionMode || this.props.isStandalone) ? 'questionResponses' : 'surveyResponses')
      ).trim() || 'default';
      const resourceKeysToCheck = Array.from(new Set([resourceKey, 'default'].filter(Boolean)));
      const resourceKeysSig = resourceKeysToCheck.join(',');

      const slug = this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props);
      const cfg = this.resolveEffectiveResponseGateConfig(slug);
      const updatedAt = cfg?.__registry?.updatedAt || '';
      const gateAuthority = cfg?.__registry?.gateAuthority || '';

      return [
        loggedIn ? account : '<anon>',
        String(slug || ''),
        resourceKeysSig,
        String(this.props?.sbtCacheRevision || 0),
        String(updatedAt),
        String(gateAuthority),
        String(recipients.length),
      ].join('|');
    } catch (_) {
      return '';
    }
  };

  maybeRefreshCanDecryptOtherResponses = () => {
    try {
      const sig = this.buildCanDecryptOtherResponsesSignature();
      if (sig === this._canDecryptOtherResponsesSig) return;
      this._canDecryptOtherResponsesSig = sig;
      this.refreshCanDecryptOtherResponses();
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };

  emitPendingStats = (stats) => {
    if (typeof this.props.onPendingStatsChange !== 'function') return;
    const total = Number(stats?.total || 0);
    const encrypted = Number(stats?.encrypted || 0);
    const submittedSinceLastEdit = !!this.state.submittedSinceLastEdit;
    const isSubmitting = !!this.state.isSubmitting;
    const last = this._lastPendingStats || {};
    if (
      last.total === total &&
      last.encrypted === encrypted &&
      !!last.submittedSinceLastEdit === submittedSinceLastEdit &&
      !!last.isSubmitting === isSubmitting
    ) return;
    this._lastPendingStats = { total, encrypted, submittedSinceLastEdit, isSubmitting };
    this.props.onPendingStatsChange({ total, encrypted, submittedSinceLastEdit, isSubmitting });
  };

  getPendingStatsSnapshot = () => getPendingStatsSnapshotFromState(this.state);

  getActiveSurveyIndex = (surveyIndexParam) => (
    this.props.isStandalone || this.props.singleQuestionMode
      ? 0
      : (surveyIndexParam ?? this.props.surveyIndex ?? 0)
  );

  didEditDiffInputsChange = (prevProps, prevState) => {
    if (!prevProps || !prevState) return true;
    const prevSessionSlugHint = getSessionSlugHintFromProps(prevProps);
    const nextSessionSlugHint = getSessionSlugHintFromProps(this.props);
    const prevSessionSlugPinned = getSessionSlugPinnedFromProps(prevProps);
    const nextSessionSlugPinned = getSessionSlugPinnedFromProps(this.props);
    const prevStateQuestionPoolSig = buildQuestionIdScopeSignature(prevState.questionPool);
    const nextStateQuestionPoolSig = buildQuestionIdScopeSignature(this.state.questionPool);
    const prevStatePileQuestionsSig = buildQuestionIdScopeSignature(prevState.pileQuestions);
    const nextStatePileQuestionsSig = buildQuestionIdScopeSignature(this.state.pileQuestions);
    const prevPropsQuestionPoolSig = buildQuestionIdScopeSignature(prevProps.questionPool);
    const nextPropsQuestionPoolSig = buildQuestionIdScopeSignature(this.props.questionPool);
    if (prevState.surveysResponseState !== this.state.surveysResponseState) return true;
    if (prevState.editBaseline !== this.state.editBaseline) return true;
    if (prevState.userAnswers !== this.state.userAnswers) return true;
    if (prevState.isLoadingResponse !== this.state.isLoadingResponse) return true;
    if (prevStateQuestionPoolSig !== nextStateQuestionPoolSig) return true;
    if (prevStatePileQuestionsSig !== nextStatePileQuestionsSig) return true;
    if (prevPropsQuestionPoolSig !== nextPropsQuestionPoolSig) return true;
    if (prevProps.isStandalone !== this.props.isStandalone) return true;
    if (prevProps.minifiedMode !== this.props.minifiedMode) return true;
    if (prevProps.surveyIndex !== this.props.surveyIndex) return true;
    if (prevProps.surveyId !== this.props.surveyId) return true;
    if (prevProps.viewAddress !== this.props.viewAddress) return true;
    if (prevProps.account !== this.props.account) return true;
    if (prevProps.loginComplete !== this.props.loginComplete) return true;
    if (prevProps.singleQuestionMode !== this.props.singleQuestionMode) return true;
    if (prevProps.questionID !== this.props.questionID) return true;
    if (prevProps.responderAddress !== this.props.responderAddress) return true;
    if (prevProps.network?.id !== this.props.network?.id) return true;
    if (prevProps.networkChainId !== this.props.networkChainId) return true;
    if (prevSessionSlugHint !== nextSessionSlugHint) return true;
    if (prevSessionSlugPinned !== nextSessionSlugPinned) return true;
    return false;
  };

  invalidateDiffCaches = () => {
    this._changedQidsAndFieldsCache = null;
    this._pendingEditStatsCache = null;
  };

  componentDidMount() {
    // Force-disable auto-decrypt on wagmi/porto at mount; also clear any in-flight state
    if (this.isAutoDecryptBlocked()) {
      this._autoDecQueue = [];
      this._autoDecProcessing = false;
      this._autoDecryptMaskedAttemptSignature = {};
      this.clearAutoDecryptSweepScheduling();
      this.setState({ autoDecryptEnabled: false, decryptingByKey: {} });
    }

    // Lazy load ZK-compatible Poseidon hasher (poseidon-lite)
    this._isMounted = true;
    const loadHasher = async () => {
      try {
        const { poseidon } = await import('poseidon-lite');
        if (typeof poseidon === 'function' && this._isMounted) {
          this.setState({ hasher: poseidon });
          surveyLog.log("✅ ZK-Compatible Poseidon Hasher Loaded (poseidon-lite)");
        }
      } catch (e) {
        surveyLog.warn("⚠️ Failed to load Real Poseidon. Falling back to Keccak (Non-ZK).", e);
      }
    };
    loadHasher();

    this.loadBookmarks();
    this.hydrateGateSbtLabels();
    try {
      const slugSig = normalizeSessionSlugValue(this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props));
      const acctSig = String(this.props.account || '').trim().toLowerCase();
      this._priorResponseHydrationContextSig = `${slugSig}|${acctSig}`;
      this._priorResponseBackfillAttempted = new Set();
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    // Determine whether the connected wallet satisfies the response gate; used to show/hide decrypt buttons
    // when viewing another wallet's encrypted response.
    try { this.maybeRefreshCanDecryptOtherResponses(); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    if (this.props.singleQuestionMode) {
      (async () => {
        await this.fetchSingleQuestionData();
        this.updateJsonPreview();
        // Quick local-cache rehydrate for non-encrypted prior answers (single Q)
        this.rehydrateLocalCacheAnswersForRenderedIds();

        if (this.props.responderAddress) {
          this.setState({
            displayAnswerMode: true,
            isEditing: false
          }, async () => {
            if (this.props.account && this.props.account.toLowerCase() === this.props.responderAddress.toLowerCase()) {
              if (this.state.userHasResponse) {
                // UI will show decrypt/edit or start fresh buttons
              }
            }
          });
        } else {
          this.setState({
            displayAnswerMode: this.props.displayAnswerMode
          });
        }
      })();
    } else if (!this.props.isStandalone) { // Survey mode (multiple questions)
      (async () => {
        await this.fetchQuestionPool();
        const initialStates = this.initializeSurveyResponseState();
        this.setState(
          {
            surveysResponseState: initialStates,
            editBaseline: this.deepClone(initialStates[this.props.surveyIndex || 0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          },
          async () => {
            this.rehydrateDraftForRenderedIds();
            // Quick local-cache rehydrate for non-encrypted prior answers (survey)
            this.rehydrateLocalCacheAnswersForRenderedIds();

            // Defer prefill if caches/IDs not ready yet; avoid double-prefill
            if (this.props.isQuestionCacheReady ||
                (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)) {
              await this.fetchSurveyResponse();
              this.checkAndHandleStartFresh();
            } else {
              this.setState({ prefillQueuedAfterCache: true });
            }
          }
        );
      })();
    } else { // Standalone mode (question pool passed as prop)
      const initialSlice = this.initializeSurveyResponseState();
      this.setState(
        {
          surveysResponseState: initialSlice,
          editBaseline: this.deepClone(initialSlice[0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          jsonPreview: this.prepareJsonAndHash(0),
        },
        () => {
          this.rehydrateDraftForRenderedIds();
          // Quick local-cache rehydrate for non-encrypted prior answers (standalone list)
          this.rehydrateLocalCacheAnswersForRenderedIds();
        }
      );
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    const diffInputsChanged = this.didEditDiffInputsChange(prevProps, prevState);
    if (diffInputsChanged) {
      this.invalidateDiffCaches();
    }
    if (prevState.userAnswers !== this.state.userAnswers) {
      this._userAnswersSliceCache = { source: null, value: null };
    }
    if (
      diffInputsChanged ||
      prevProps.questionsCacheNonce !== this.props.questionsCacheNonce ||
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce
    ) {
      this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
      this._rehydrateLocalCacheLastSig = '';
      this._autoDecryptVisibleSweepCache = null;
    }
    if (
      prevState.questionPool !== this.state.questionPool ||
      prevState.pileQuestions !== this.state.pileQuestions ||
      prevProps.singleQuestionMode !== this.props.singleQuestionMode ||
      prevProps.questionID !== this.props.questionID
    ) {
      this._currentRenderedQuestionIdsCache = null;
    }

    const pendingStats = diffInputsChanged
      ? ((typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) || this.getPendingStatsSnapshot())
      : this.getPendingStatsSnapshot();
    this.emitPendingStats(pendingStats);
    if (diffInputsChanged && typeof this.recalculateEditStats === 'function') {
      this.recalculateEditStats(pendingStats);
    }

    try {
      const slugSig = normalizeSessionSlugValue(this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props));
      const acctSig = String(this.props.account || '').trim().toLowerCase();
      const nextSig = `${slugSig}|${acctSig}`;
      if (nextSig !== this._priorResponseHydrationContextSig) {
        this._priorResponseHydrationContextSig = nextSig;
        this._priorResponseBackfillAttempted = new Set();
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    // Force-disable auto-decrypt whenever provider/account changes to wagmi/porto
    if (
      (prevProps.provider !== this.props.provider || prevProps.account !== this.props.account) &&
      this.isAutoDecryptBlocked()
    ) {
      this._autoDecQueue = [];
      this._autoDecProcessing = false;
      this._autoDecryptMaskedAttemptSignature = {};
      this.clearAutoDecryptSweepScheduling();
      if (this.state.autoDecryptEnabled || (this.state.decryptingByKey && Object.keys(this.state.decryptingByKey).length > 0)) {
        this.setState({ autoDecryptEnabled: false, decryptingByKey: {} });
      }
    }

    // Keep the "can decrypt viewed responses" capability in sync with wallet/session/gate changes.
    try { this.maybeRefreshCanDecryptOtherResponses(); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    // Re-trigger auto-decrypt sweep when cache data arrives after initial render.
    // Without this, an early sweep with empty cache never re-fires, leaving "Decrypt"
    // buttons visible even though the user has permission.
    const cacheJustBecameReady = !prevProps.isResponsesCacheReady && this.props.isResponsesCacheReady;

    const shouldShortCircuitUpdate =
      !diffInputsChanged &&
      prevProps.provider === this.props.provider &&
      prevProps.account === this.props.account &&
      prevProps.loginComplete === this.props.loginComplete &&
      prevProps.lit === this.props.lit &&
      prevProps.litHooks === this.props.litHooks &&
      prevProps.questionID === this.props.questionID &&
      prevProps.responderAddress === this.props.responderAddress &&
      prevProps.surveyId === this.props.surveyId &&
      prevProps.viewAddress === this.props.viewAddress &&
      getSessionSlugHintFromProps(prevProps) === getSessionSlugHintFromProps(this.props) &&
      getSessionSlugPinnedFromProps(prevProps) === getSessionSlugPinnedFromProps(this.props) &&
      prevProps.questionPool === this.props.questionPool &&
      prevProps.isQuestionCacheReady === this.props.isQuestionCacheReady &&
      prevProps.isResponsesCacheReady === this.props.isResponsesCacheReady &&
      prevProps.questionsCacheNonce === this.props.questionsCacheNonce &&
      prevProps.questionResponsesNonce === this.props.questionResponsesNonce &&
      prevProps.sbtCacheRevision === this.props.sbtCacheRevision &&
      prevProps.network?.id === this.props.network?.id &&
      prevProps.networkChainId === this.props.networkChainId &&
      prevState.questionPool === this.state.questionPool &&
      prevState.pileQuestions === this.state.pileQuestions &&
      prevState.autoDecryptEnabled === this.state.autoDecryptEnabled &&
      prevState.showComments === this.state.showComments &&
      prevState.prefillQueuedAfterCache === this.state.prefillQueuedAfterCache;
    if (shouldShortCircuitUpdate) {
      bumpSurveyPerfCounter('noopSkipCount');
      return;
    }

    // Single question mode logic
    if (this.props.singleQuestionMode) {
      const identityChanged =
        prevProps.questionID !== this.props.questionID ||
        prevProps.responderAddress !== this.props.responderAddress;
      const groupContextChanged =
        getSessionSlugHintFromProps(prevProps) !== getSessionSlugHintFromProps(this.props) ||
        getSessionSlugPinnedFromProps(prevProps) !== getSessionSlugPinnedFromProps(this.props);

      // Treat responses-cache-ready as a trigger too
      const cacheTick =
        (prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
          this.props.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
          this.props.isResponsesCacheReady) ||
        (this.props.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== this.props.questionsCacheNonce) ||
        (this.props.isResponsesCacheReady &&
          prevProps.questionResponsesNonce !== this.props.questionResponsesNonce);
      const prevNetId = String(prevProps.network?.id ?? prevProps.networkChainId ?? '');
      const currNetId = String(this.props.network?.id ?? this.props.networkChainId ?? '');
      const authOrProviderBecameReady =
        (!prevProps.loginComplete && !!this.props.loginComplete) ||
        (!prevProps.account && !!this.props.account) ||
        (!prevProps.provider && !!this.props.provider);
      const networkBecameReady = prevNetId !== currNetId && !!currNetId;
      const waitingForViewedResponseBootstrap =
        !!this.props.responderAddress &&
        !this.state.parsedViewAddressAnswers &&
        this.state.noResponse !== true;
      const singleQuestionBootstrapPending =
        waitingForViewedResponseBootstrap || (
          !this.state.displayAnswerMode &&
          !this.state.parsedViewAddressAnswers &&
          (!Array.isArray(this.state.questionPool) || this.state.questionPool.length === 0)
        );
      const shouldRetrySingleQuestionBootstrap =
        singleQuestionBootstrapPending && (authOrProviderBecameReady || networkBecameReady);
      const retryMaskedOnReadiness = shouldRetryMaskedQuestionRefresh({
        masked: this.hasMaskedCurrentQuestionPayload(),
        prev: {
          account: prevProps.account,
          provider: prevProps.provider,
          loginComplete: prevProps.loginComplete,
          litHooks: prevProps.litHooks || null,
          sbtCacheRevision: prevProps.sbtCacheRevision || 0,
        },
        next: {
          account: this.props.account,
          provider: this.props.provider,
          loginComplete: this.props.loginComplete,
          litHooks: this.props.litHooks || null,
          sbtCacheRevision: this.props.sbtCacheRevision || 0,
        },
      });

      if (identityChanged) {
        // Reset submissionComplete when switching questions so fetch logic isn't blocked
        this.setState({
          isLoadingResponse: true,
          submissionError: '',
          submissionComplete: false,
          submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
        });
        await this.fetchSingleQuestionData(); // merge-safe
      } else if (cacheTick || groupContextChanged || retryMaskedOnReadiness || shouldRetrySingleQuestionBootstrap) {
        // Don’t rebuild while user has pending edits; keeps “Submit (X)” stable
        if (this.state.isDirty || (this.state.modifiedCount || 0) > 0) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          return;
        }
        const pendingBootstrapRetryAttempt = this.getPendingSingleQuestionBootstrapRetryAttempt(this.props.questionID);
        await this.fetchSingleQuestionData(
          pendingBootstrapRetryAttempt > 0
            ? { bootstrapRetryAttempt: pendingBootstrapRetryAttempt }
            : undefined
        ); // merge-safe
      }

      if (this.props.account !== prevProps.account) {
        // Clear live form state before fetching for new account.
        // We use a callback to ensure rehydration happens on the reset (empty) state,
        // followed by the fetch which merges on-chain data into the draft.
        this.resetFormStateForAccountChange(async () => {
            this.setState({
              isLoadingResponse: true,
              submissionError: '',
              submissionComplete: false,
              submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
            });

            // 1. Apply Draft (Anon answers) onto Empty
            this.rehydrateDraftForRenderedIds();

            // 2. Fetch Chain (Merges Chain into Draft)
            const pendingBootstrapRetryAttempt = this.props.singleQuestionMode
              ? this.getPendingSingleQuestionBootstrapRetryAttempt(this.props.questionID)
              : 0;
            await this.fetchSingleQuestionData(
              pendingBootstrapRetryAttempt > 0
                ? { bootstrapRetryAttempt: pendingBootstrapRetryAttempt }
                : undefined
            );

            const isViewingOwnResponse =
              this.props.account &&
              this.props.responderAddress &&
              this.props.account.toLowerCase() === this.props.responderAddress.toLowerCase();
            const isViewingNoSpecificResponder =
              this.props.account && !this.props.responderAddress;

            if (
              this.state.userHasResponse &&
              (isViewingOwnResponse || isViewingNoSpecificResponder)
            ) {
              this.setState({
                displayAnswerMode: false,
                isEditing: true,
              });
            }
        });
      }

      if (prevState.questionPool !== this.state.questionPool) {
        this.setState(
          (prevStateInner) => ({
            surveysResponseState: this.mergeSurveyResponseState(
              prevStateInner.surveysResponseState,
              this.state.questionPool || [],
              0
            ),
            editBaseline: this.mergeSurveyResponseState(
              [prevStateInner.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
              this.state.questionPool || [],
              0
            )[0],
          }),
          () => {
            this.updateJsonPreview();
            this.rehydrateDraftForRenderedIds();
          }
        );
      }
    }

    // Survey mode logic (not standalone and not minified)
    else if (!this.props.isStandalone && !this.props.minifiedMode) {
      const surveyChanged = this.props.surveyId !== prevProps.surveyId;
      const cacheInvalidated =
        (prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
          this.props.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
          this.props.isResponsesCacheReady) ||
        (this.props.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== this.props.questionsCacheNonce);

      if (surveyChanged) {
        this.setState({
          userHasResponse: false,
          userAnswers: null,
          parsedViewAddressAnswers: null,
          noResponse: false,
          questionPool: [],
          questionPoolExpectedIds: [],
          questionPoolPendingIds: [],
          isEditing: false,
          surveysResponseState: [],
          jsonPreview: '',
          submissionError: '',
          submissionComplete: false,
          submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
        });
        await this.fetchQuestionPool();
        this.setState(
          { surveysResponseState: this.initializeSurveyResponseState() },
          async () => {
            await this.fetchSurveyResponse();
            this.checkAndHandleStartFresh();
          }
        );
      } else if (cacheInvalidated) {
        // Don’t rebuild while user has pending edits; keeps “Submit (X)” stable
        const hasPendingQuestionPoolHydration = this.getSurveyQuestionPoolLoadState().isIncomplete;
        if ((this.state.isDirty || (this.state.modifiedCount || 0) > 0) && !hasPendingQuestionPoolHydration) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          // do nothing
        } else {
          await this.fetchQuestionPool();
          this.setState(
            (prev) => ({
              surveysResponseState: this.mergeSurveyResponseState(
                prev.surveysResponseState,
                this.state.questionPool || [],
                this.props.surveyIndex
              ),
            }),
            async () => {
              await this.fetchSurveyResponse();
              if (!this.state.suppressPrefill) {
                this.rehydrateDraftForRenderedIds();
              }
            }
          );
        }
      }

      if (
        this.props.account !== prevProps.account ||
        this.props.viewAddress !== prevProps.viewAddress
      ) {
        // Clear live form state before reacting to new account/viewAddress
        this.resetFormStateForAccountChange(async () => {
            this.setState({
              isLoadingResponse: true,
              userHasResponse: false,
              userAnswers: null,
              isEditing: false,
              parsedViewAddressAnswers:
                this.props.viewAddress !== prevProps.viewAddress
                  ? null
                  : this.state.parsedViewAddressAnswers,
              noResponse:
                this.props.viewAddress !== prevProps.viewAddress
                  ? false
                  : this.state.noResponse,
              submissionError: '',
              submissionComplete: false,
              submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
            });

            // 1. Rehydrate draft immediately so it exists before fetch returns
            if (this.props.account && this.props.account !== prevProps.account) {
               this.rehydrateDraftForRenderedIds();
            }

            // 2. Fetch Chain (Merges Chain into Draft)
            await this.fetchSurveyResponse();

            const isViewingOwnSurveyResponse =
              this.props.account &&
              this.props.viewAddress &&
              this.props.account.toLowerCase() === this.props.viewAddress.toLowerCase();
            const isViewingNoSpecificSurvey =
              this.props.account && !this.props.viewAddress;

            if (
              this.state.userHasResponse &&
              (isViewingOwnSurveyResponse || isViewingNoSpecificSurvey)
            ) {
              this.setState({
                displayAnswerMode: false,
                isEditing: true,
              });
            }
        });
      }
    }

    // Standalone mode (QuestionsDashboard)
    else {
      if (prevProps.questionPool !== this.props.questionPool) {
        this.setState(
          (prevStateInner) => ({
            questionPool: this.props.questionPool || [],
            surveysResponseState: this.mergeSurveyResponseState(
              prevStateInner.surveysResponseState,
              this.props.questionPool || [],
              0
            ),
            editBaseline: this.mergeSurveyResponseState(
              [prevStateInner.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
              this.props.questionPool || [],
              0
            )[0],
          }),
          () => {
            this.updateJsonPreview();
            this.rehydrateDraftForRenderedIds();
            this.rehydrateLocalCacheAnswersForRenderedIds();
          }
        );
      }

      if (
        (prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
          this.props.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
          this.props.isResponsesCacheReady) ||
        (this.props.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== this.props.questionsCacheNonce)
      ) {
        this.rehydrateLocalCacheAnswersForRenderedIds();
      }

      const standaloneAuthBecameReady =
        (!prevProps.loginComplete && !!this.props.loginComplete) ||
        (!prevProps.account && !!this.props.account) ||
        (!prevProps.provider && !!this.props.provider);

      if (this.props.account !== prevProps.account || standaloneAuthBecameReady) {
        // Clear live form state before reacting to new account
        this.resetFormStateForAccountChange(() => {
             this.setState({
              isEditing: false,
              submissionError: '',
              submissionComplete: false,
              submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
            });
            // Standalone mode typically relies on local cache or props,
            // but we should also rerun cache/prior-response hydration when auth becomes ready.
            this.rehydrateDraftForRenderedIds();
            this.rehydrateLocalCacheAnswersForRenderedIds();
        });
      }
    }

    // Auto-decrypt sweep when enabled and inputs change
    if (
      this.state.autoDecryptEnabled &&
      (
        prevState.surveysResponseState !== this.state.surveysResponseState ||
        prevState.autoDecryptEnabled !== this.state.autoDecryptEnabled ||
        prevState.questionPool !== this.state.questionPool ||
        prevProps.account !== this.props.account ||
        cacheJustBecameReady
      ) &&
      !this.isAutoDecryptBlocked()
    ) {
      this.queueAutoDecryptVisibleSweep('state-change');
    }

    // Trigger sweep when auto-decrypt gets enabled
    if (!prevState.autoDecryptEnabled && this.state.autoDecryptEnabled && !this.isAutoDecryptBlocked()) {
      this.queueAutoDecryptVisibleSweep('enabled');
    }

    // Trigger when the comments panel toggles (user reveals additional comments)
    if (this.state.autoDecryptEnabled && prevState.showComments !== this.state.showComments && !this.isAutoDecryptBlocked()) {
      this.queueAutoDecryptVisibleSweep('comments-toggle');
    }

    // Consume queued prefill once caches flip ready — but NEVER while user has edits
    if (
      this.state.prefillQueuedAfterCache &&
      !this.state.isDirty &&
      (this.props.isQuestionCacheReady || this.props.isResponsesCacheReady)
    ) {
      await this.fetchSurveyResponse();
      this.setState({ prefillQueuedAfterCache: false });
    }

    if (
      prevProps.sbtCacheRevision !== this.props.sbtCacheRevision ||
      prevProps.network?.id !== this.props.network?.id ||
      prevProps.networkChainId !== this.props.networkChainId ||
      prevState.questionPool !== this.state.questionPool ||
      prevState.pileQuestions !== this.state.pileQuestions ||
      prevProps.questionPool !== this.props.questionPool ||
      prevProps.questionsCacheNonce !== this.props.questionsCacheNonce ||
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce
    ) {
      this.hydrateGateSbtLabels();
    }
  }


  componentWillUnmount() {
    if (this._emptySubmitTimer) {
      clearTimeout(this._emptySubmitTimer);
      this._emptySubmitTimer = null;
    }
    const hasPendingDraftChanges =
      !!this._persistTimer ||
      !!(this._draftDirtyQids && this._draftDirtyQids.size > 0) ||
      !!(this.state && (this.state.isDirty || Number(this.state.modifiedCount || 0) > 0));
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    if (hasPendingDraftChanges) {
      try { this.persistDraft(); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    }
    if (this._jsonPreviewTimer) {
      clearTimeout(this._jsonPreviewTimer);
      this._jsonPreviewTimer = null;
    }
    if (this._autoDecProcessTimer) {
      clearTimeout(this._autoDecProcessTimer);
      this._autoDecProcessTimer = null;
    }
    this.clearAutoDecryptSweepScheduling();
    this.clearGateSbtHydrationRetry();
    this.clearManagedTimeouts();
    this._changedQidsAndFieldsCache = null;
    this._pendingEditStatsCache = null;
    this._questionByIdLookupCache = {
      stateQuestionPool: null,
      statePileQuestions: null,
      propsQuestionPool: null,
      value: null,
    };
    this._currentRenderedQuestionIdsCache = null;
    this._currentRenderedQuestionIdsCacheQuestionPool = null;
    this._currentRenderedQuestionIdsCachePileQuestions = null;
    this._maskedQuestionVisibilityMemoByPool = new WeakMap();
    this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
    this._rehydrateLocalCacheLastSig = '';
    this._autoDecryptVisibleSweepCache = null;
    this._autoDecryptMaskedAttemptSignature = {};
    this._decryptFieldTaskInFlight.clear();
    this._userAnswersSliceCache = { source: null, value: null };
    this._priorResponseBackfillInFlight = null;
    this.clearSingleQuestionBootstrapRetry();
    this._isMounted = false;
    this._fetchSingleQuestionRunId += 1;
  }



  // Compute the draft scope string with per-QID namespacing in singleQuestionMode
  _getDraftScope = () => {
    return this.props.singleQuestionMode
      ? 'questions' // Align primary scope with spec; per-QID isolation stays in answers
      : String(this.props?.surveyId || 'questions').toLowerCase();
  };


  // inside class SurveyQuestions
  _getEffectiveDraftSlug = () => {
    return this.props.singleQuestionMode
      ? resolveSlugForIds({
          questionId: this.props.questionID,
          props: this.props,
          network: this.props.network,
        })
      : resolveSlugForIds({
          surveyId: this.props.surveyId || null,
          props: this.props,
          network: this.props.network,
        });
  };

  getAudioInputWorkerProps = () => {
    // Prefer the explicit route/session slug to avoid cross-cache slug drift on /question routes.
    const explicitSessionSlug = resolveEffectiveSlug(this.props);
    const resolvedSession = explicitSessionSlug
      ? resolveExplicitSessionContext(explicitSessionSlug)
      : resolveDraftSessionContext(this.props, this._getEffectiveDraftSlug());
    const sessionSlug = resolvedSession.sessionSlug || '';
    const sessionConfig = resolvedSession.sessionConfig || null;
    const providerLike = typeof this.props.providerLike === 'string'
      ? this.props.providerLike
      : (typeof this.props.provider === 'string' ? this.props.provider : '');
    const chainId = this.resolveSessionChainId(sessionSlug, sessionConfig);
    return {
      sessionSlug,
      sessionConfig,
      context: {
        account: this.props.account || '',
        providerLike,
        chainId,
      },
    };
  };

  buildQuestionDecryptContext = (slugIn) => {
    const slug = String(slugIn ?? '').trim().toLowerCase();
    const cfg = resolveExplicitSessionContext(slug).sessionConfig || null;
    const chainId = this.resolveSessionChainId(slug, cfg);
    const litHooks =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return {
      account: this.props.account || '',
      providerLike: this.props.provider || '',
      chainId,
      litHooks,
      litOpts: litHooks && typeof litHooks.getKey === 'function'
        ? { getKey: litHooks.getKey }
        : null,
    };
  };

  hasMaskedCurrentQuestionPayload = () => {
    if (!this.props.singleQuestionMode) return false;
    const q = Array.isArray(this.state.questionPool) ? this.state.questionPool[0] : null;
    if (isMaskedQuestionPayload(q)) return true;
    const qid = String(this.props.questionID || '').toLowerCase();
    if (!qid) return false;
    const slug = this._getEffectiveDraftSlug();
    const cfg = resolveExplicitSessionContext(slug).sessionConfig || null;
    const netIdStr = String(
      this.props.network?.id ?? this.props.networkChainId ?? cfg?.networkChainId ?? ''
    );
    if (!netIdStr) return false;
    const cache = readQuestionsCache(slug) || {};
    const cached = cache?.[netIdStr]?.questions?.[qid];
    return isMaskedQuestionPayload(cached);
  };

  isMaskedPromptText = (prompt) => String(prompt || '').trim() === '[encrypted]';

  getQuestionFetchCandidateSlugs = (questionId, preferredSlug = '', opts = {}) => {
    const sanitize = (s) => (
      s == null
        ? ''
        : String(s).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    );

    const qid = String(questionId || '').trim().toLowerCase();
    const slugPinned = getSessionSlugPinnedFromProps(this.props);
    const explicitSlug = sanitize(getSessionSlugHintFromProps(this.props));
    const resolvedSlug = sanitize(
      resolveSlugForIds({
        sessionName:
          this.props.sessionName ||
          this.props.sessionName ||
          (this.state.questionPool?.[0]?.sessionName) ||
          (this.state.questionPool?.[0]?.sessionName),
        questionId: qid || this.props.questionID || null,
        surveyId: this.props.singleQuestionMode ? null : (this.props.surveyId || null),
        props: this.props,
        network: this.props.network,
      })
    );
    const preferred = sanitize(preferredSlug);
    const effective = preferred || explicitSlug || resolvedSlug || sanitize(resolveEffectiveSlug(this.props));
    const explicitSlugKnown = explicitSlug === '' || !!resolveExplicitSessionContext(explicitSlug).sessionConfig;
    // Default behavior preserves strict session pinning; callers can opt into fallback explicitly.
    const allowPinnedFallback =
      opts?.allowPinnedFallback === true ||
      (slugPinned && !!explicitSlug && !explicitSlugKnown);

    const out = [];
    const seen = new Set();
    const pushSlug = (slugIn) => {
      const slug = sanitize(slugIn);
      if (seen.has(slug)) return;
      seen.add(slug);
      out.push(slug);
    };

    pushSlug(effective);
    pushSlug(explicitSlug);
    pushSlug(resolvedSlug);
    pushSlug(resolveEffectiveSlug(this.props));

    if (!slugPinned || allowPinnedFallback) {
      getAllSessionSlugs().forEach((s) => pushSlug(s));
      pushSlug('');
    }

    return out;
  };

  cacheQuestionPayloadForSlug = (slugIn, questionId, questionPayload) => {
    const slug = String(slugIn ?? '').trim().toLowerCase();
    const qid = String(questionId || '').trim().toLowerCase();
    if (!qid || !questionPayload) return;

    const cacheWriteContext = resolveQuestionPayloadCacheWriteContext(this.props, slug);
    const netIdStr = cacheWriteContext.networkIdStr || '';
    if (!netIdStr) return;

    const questionsCache = ensureQuestionsNet(readQuestionsCache(slug), netIdStr);
    const existing = questionsCache?.[netIdStr]?.questions?.[qid] || null;
    const picked = pickBetterQuestionPayload(existing, questionPayload) || questionPayload;
    const nextPayload = { ...picked, id: qid };
    if (areQuestionPayloadsEquivalent(existing, nextPayload)) return;
    questionsCache[netIdStr].questions[qid] = nextPayload;
    void writeQuestionsCache(slug, questionsCache);
  };

  applyQuestionPayloadToRenderedPools = (questionId, questionPayload) => {
    const qid = String(questionId || '').trim().toLowerCase();
    if (!qid || !questionPayload) return;

    this.setState((prev) => {
      let didChange = false;
      const patchList = (list) => {
        if (!Array.isArray(list) || list.length === 0) return list;
        return list.map((item) => {
          const itemId = String(item?.id || '').toLowerCase();
          if (itemId !== qid) return item;
          const picked = pickBetterQuestionPayload(item, questionPayload) || questionPayload;
          const merged = { ...item, ...picked, id: qid };
          if (areQuestionPayloadsEquivalent(item, merged)) {
            return item;
          }
          didChange = true;
          return merged;
        });
      };

      const nextQuestionPool = patchList(prev.questionPool);
      const nextPileQuestions = patchList(prev.pileQuestions);
      const nextAllQuestionsForFilter = patchList(prev.allQuestionsForFilter);
      if (!didChange) return null;
      return {
        questionPool: nextQuestionPool,
        pileQuestions: nextPileQuestions,
        allQuestionsForFilter: nextAllQuestionsForFilter,
      };
    });
  };

  fetchQuestionPayloadWithDeterministicContext = async (questionId, opts = {}) => {
    const qid = String(questionId || '').trim().toLowerCase();
    if (!qid) return { promptReady: false, bestQuestionData: null, bestSlug: '' };

    const currentQuestion =
      (Array.isArray(this.state.questionPool)
        ? this.state.questionPool.find((q) => String(q?.id || '').toLowerCase() === qid)
        : null) ||
      (Array.isArray(this.state.pileQuestions)
        ? this.state.pileQuestions.find((q) => String(q?.id || '').toLowerCase() === qid)
        : null) ||
      null;

    let bestQuestionData = currentQuestion ? { ...currentQuestion, id: qid } : null;
    let bestSlug = String(opts.preferredSlug ?? this._getEffectiveDraftSlug() ?? '').toLowerCase();
    const candidateSlugs = this.getQuestionFetchCandidateSlugs(qid, bestSlug);
    let fetchedAny = false;

    for (const candidateSlug of candidateSlugs) {
      const decryptContext = this.buildQuestionDecryptContext(candidateSlug);
      const litReady = !!(decryptContext?.litHooks && typeof decryptContext.litHooks.getKey === 'function');
      try {
        const fetched = await contractScripts.getQuestionData(
          this.props.provider,
          qid,
          candidateSlug,
          { decryptContext }
        );
        if (!fetched) continue;
        fetchedAny = true;
        const normalized = { ...fetched, id: qid };
        const picked = pickBetterQuestionPayload(bestQuestionData, normalized) || normalized;
        bestQuestionData = picked;
        bestSlug = candidateSlug;
        this.cacheQuestionPayloadForSlug(candidateSlug, qid, picked);
        const promptReady = !this.isMaskedPromptText(picked?.prompt);
        if (promptReady || !isMaskedQuestionPayload(picked)) break;
      } catch (error) {
        surveyLog.debug('[question-prompt-reload] getQuestionData failed', {
          questionId: qid,
          slug: candidateSlug,
          chainId: decryptContext?.chainId || null,
          hasProvider: !!this.props.provider,
          hasAccount: !!this.props.account,
          loginComplete: !!this.props.loginComplete,
          litReady,
          error: error?.message || String(error || ''),
        });
      }
    }

    if (bestQuestionData) {
      this.applyQuestionPayloadToRenderedPools(qid, bestQuestionData);
      if (bestSlug || bestSlug === '') {
        this.cacheQuestionPayloadForSlug(bestSlug, qid, bestQuestionData);
      }
    }

    const promptReady = !!bestQuestionData && !this.isMaskedPromptText(bestQuestionData?.prompt);
    if (!promptReady) {
      const litHooks =
        this.props.lit ||
        this.props.litHooks ||
        (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
      const litReady = !!(litHooks && typeof litHooks.getKey === 'function');
      const chainId = Number(this.props.network?.id ?? this.props.networkChainId ?? 0) || null;
      const reason =
        !this.props.loginComplete || !this.props.account
          ? 'not_logged_in'
          : !this.props.provider
            ? 'provider_missing'
            : !chainId
              ? 'missing_or_wrong_chain'
              : !litReady
                ? 'lit_hooks_unready'
                : !fetchedAny
                  ? 'question_fetch_unavailable'
                  : 'acc_failed_or_entitlement_missing';
      surveyLog.debug('[question-prompt-reload] prompt remains masked', {
        questionId: qid,
        slug: bestSlug,
        reason,
        fetchedAny,
        hasProvider: !!this.props.provider,
        hasAccount: !!this.props.account,
        loginComplete: !!this.props.loginComplete,
        chainId,
        litReady,
      });
    }

    return { promptReady, bestQuestionData, bestSlug };
  };

  handleReloadMaskedPrompt = async (questionId) => {
    const qid = String(questionId || '').trim().toLowerCase();
    if (!qid) return false;
    const key = `${qid}:prompt`;

    this.setState((prev) => ({
      decryptingByKey: {
        ...(prev.decryptingByKey || {}),
        [key]: true,
      },
    }));

    try {
      const preferredSlug = this._getEffectiveDraftSlug();
      const result = await this.fetchQuestionPayloadWithDeterministicContext(qid, { preferredSlug });

      if (this.props.singleQuestionMode && qid === String(this.props.questionID || '').toLowerCase()) {
        await this.fetchSingleQuestionData({ forceQuestionMetadataRefetch: true });
      }

      // Pile view keeps gated/masked questions in allQuestionsForFilter as source-of-truth.
      // After a successful decrypt, refresh the visible pile cards from that source without
      // triggering a full filter/apply cycle that could wipe in-progress edits.
      if (result?.promptReady) {
        this.setState((prev) => {
          const source = Array.isArray(prev.allQuestionsForFilter) ? prev.allQuestionsForFilter : null;
          if (!source || !source.length) return null;
          const isFilterActive = !!prev.isFilterActive || isSurveyToolFilterStateActive(prev.filterState);
          if (isFilterActive) return null;

          const visible = source.filter(
            (q) => !(q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted)
          );
          const hasHidden = source.some(
            (q) => q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted
          );

          const prevPile = Array.isArray(prev.pileQuestions) ? prev.pileQuestions : [];
          const currentActiveId = (
            prevPile.length > 0 && prevPile[prev.activePileIndex]
              ? String(prevPile[prev.activePileIndex]?.id || '').toLowerCase()
              : ''
          );
          const activeIdxFromId = currentActiveId
            ? visible.findIndex((q) => String(q?.id || '').toLowerCase() === currentActiveId)
            : -1;
          const nextActiveIndex = activeIdxFromId >= 0
            ? activeIdxFromId
            : Math.min(Number(prev.activePileIndex || 0), Math.max(visible.length - 1, 0));

          const sameOrder = (
            prevPile.length === visible.length &&
            prevPile.every((q, idx) => (
              String(q?.id || '').toLowerCase() === String(visible[idx]?.id || '').toLowerCase()
            ))
          );
          if (
            sameOrder &&
            prev.hasHiddenGatedQuestions === hasHidden &&
            Number(prev.activePileIndex || 0) === nextActiveIndex
          ) {
            return null;
          }

          return {
            pileQuestions: visible,
            hasHiddenGatedQuestions: hasHidden,
            activePileIndex: nextActiveIndex,
          };
        });
      }

      const activePrompt = (() => {
        const q = Array.isArray(this.state.questionPool)
          ? this.state.questionPool.find((item) => String(item?.id || '').toLowerCase() === qid)
          : null;
        return q?.prompt;
      })();
      return !this.isMaskedPromptText(activePrompt) || !!result.promptReady;
    } catch (error) {
      surveyLog.debug('[question-prompt-reload] manual reload failed', {
        questionId: qid,
        error: error?.message || String(error || ''),
      });
      return false;
    } finally {
      this.setState((prev) => {
        const next = { ...(prev.decryptingByKey || {}) };
        next[key] = false;
        return { decryptingByKey: next };
      });
    }
  };

  reloadMaskedQuestionBatch = async (questionIds = []) => {
    const ids = Array.from(new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((qid) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    ));
    if (!ids.length) return;

    this.setState({ bulkPromptReloading: true });
    try {
      for (const qid of ids) {
        // eslint-disable-next-line no-await-in-loop
        await this.handleReloadMaskedPrompt(qid);
      }
    } finally {
      this.setState({ bulkPromptReloading: false });
    }
  };

  renderPromptWithManualDecrypt = (question) => {
    const qid = String(question?.id || '').trim().toLowerCase();
    const promptText = question?.prompt || 'Question';
    const promptMasked = this.isMaskedPromptText(promptText);
    const promptKey = `${qid}:prompt`;
    const promptReloading = !!(this.state.decryptingByKey && this.state.decryptingByKey[promptKey]);
    const promptTitle =
      !this.props.loginComplete || !this.props.account
        ? 'Login required to decrypt gated prompts.'
        : 'Decrypt gated prompt';

    return (
      <div className={styles.promptTitleBlock}>
        <h4 id={styles.questionTitle}>
          {promptMasked && qid ? (
            <button
              type="button"
              className={styles.maskedPromptActionButton}
              data-testid={E2E_TESTIDS.SURVEY_DECRYPT_PROMPT}
              data-ce-question-id={qid}
              onClick={() => this.handleReloadMaskedPrompt(qid)}
              disabled={promptReloading}
              aria-busy={promptReloading}
              title={promptTitle}
            >
              {promptReloading ? (
                <span className={styles.maskedPromptLoading}>
                  <FontAwesomeIcon icon={faSpinner} spin className={styles.maskedPromptLoadingSpinner} />
                  <span>Decrypting...</span>
                </span>
              ) : (
                promptText
              )}
            </button>
          ) : (
            promptText
          )}
        </h4>
      </div>
    );
  };

  renderQuestionTagDropdown = (question) => {
    if (!getQuestionTagDisplayList(question?.tags).length) return null;

    return (
      <QuestionTagDropdown
        tags={question.tags}
        sessionSlug={resolveCurrentTagSessionSlug({
          props: this.props,
          state: this.state,
          getEffectiveDraftSlug: this._getEffectiveDraftSlug,
        })}
      />
    );
  };

  renderQuestionTagDropdownRow = (question) => {
    const dropdown = this.renderQuestionTagDropdown(question);
    if (!dropdown) return null;

    return (
      <div style={QUESTION_TAG_DROPDOWN_ROW_STYLE}>
        {dropdown}
      </div>
    );
  };

  getSliderMode = (questionId) => {
    const mode = this.state.sliderModeByQuestion?.[questionId];
    if (mode === 'importance' || mode === 'conviction') return mode;

    const idx = this.props.isStandalone || this.props.singleQuestionMode
      ? 0
      : (this.props.surveyIndex || 0);
    const slice = this.state.surveysResponseState?.[idx];
    if (slice?.importance && Object.prototype.hasOwnProperty.call(slice.importance, questionId)) {
      return 'importance';
    }

    return 'conviction';
  };

  setSliderMode = (questionId, mode) => {
    const nextMode = mode === 'importance' ? 'importance' : 'conviction';
    this.setState((prev) => ({
      sliderModeByQuestion: {
        ...(prev.sliderModeByQuestion || {}),
        [questionId]: nextMode,
      },
      // Track whether the conviction/importance control has been "opened" for this question.
      sliderToggleExpandedByQuestion: {
        ...(prev.sliderToggleExpandedByQuestion || {}),
        [questionId]: true,
      },
    }));
  };

  getConvictionValueForSlice = (slice, questionId) => {
    const value = getConvictionFromSliceStrict(slice, questionId);
    return typeof value === 'number' ? value : 0;
  };

  getImportanceValueForSlice = (slice, questionId) => {
    const value = getImportanceFromSlice(slice, questionId);
    return typeof value === 'number' ? value : 0;
  };

  renderBullhornToggleButton = ({
    onClick,
    disabled = false,
    title = 'Conviction / importance',
    ariaLabel = 'Conviction / importance',
    active = false,
  } = {}) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${styles.iconButton} ${styles.commentButton} ${styles.bullhornButton} ${active ? styles.iconButtonActive : ''}`}
      title={title}
      aria-label={ariaLabel}
    >
      <FontAwesomeIcon icon={faBullhorn} className={active ? styles.iconGlow : undefined} />
    </button>
  );

  renderConvictionImportanceLabel = (questionId, convictionValue, importanceValue) => {
    if (!ENABLE_IMPORTANCE_SLIDER_TOGGLE) {
      return (
        <h6 id={styles.importanceText} className={styles.convictionValueRow}>
          <span className={styles.convictionToggleLabel}>Conviction</span>
          <span className={styles.convictionToggleValue}>{convictionValue}</span>
        </h6>
      );
    }
    const mode = this.getSliderMode(questionId);
    const isConviction = mode === 'conviction';
    const isExpanded =
      !!this.state.sliderToggleExpandedByQuestion?.[questionId] || !isConviction;
    return (
      <h6 id={styles.importanceText} className={styles.convictionToggleText}>
        <span className={styles.convictionToggleStack}>
          <button
            type="button"
            className={`${styles.convictionToggleLine} ${isConviction ? styles.convictionToggleButtonActive : ''}`}
            onClick={() => this.setSliderMode(questionId, 'conviction')}
          >
            <span className={styles.convictionToggleLabel}>Conviction</span>
            <span className={styles.convictionToggleValue}>{convictionValue}</span>
          </button>
          {isExpanded ? (
            <button
              type="button"
              className={`${styles.convictionToggleLine} ${!isConviction ? styles.convictionToggleButtonActive : ''}`}
              onClick={() => this.setSliderMode(questionId, 'importance')}
            >
              <span className={styles.convictionToggleLabel}>Importance</span>
              <span className={styles.convictionToggleValue}>{importanceValue}</span>
            </button>
          ) : null}
        </span>
      </h6>
    );
  };

  flushDraftPersistAfterSliderChange = () => {
    this.persistDraftSafely && this.persistDraftSafely(0);
  };

  // Keyboard changes persist during onChange so draft edits are not lost.
  getSliderPersistOptions = (event) => ({
    persistDraft: event?.type === 'keydown',
  });

  handleConvictionImportanceChange = (surveyIndex, questionId, mode, value, options = {}) => {
    if (mode === 'importance') {
      this.handleImportance(surveyIndex, questionId, value, options);
    } else {
      this.handleConviction(surveyIndex, questionId, value, options);
    }
  };

  renderSingleQuestionDeferredRatingSlider = ({ surveyIndex, questionId, ratingValue }) => (
    <DeferredCommitSlider
      value={ratingValue}
      min={RATING_MIN}
      max={RATING_MAX}
      step={1}
      tooltip={false}
      disabled={this.state.isSubmitting}
      className={styles.ratingSlider}
      style={{ width: '200px' }}
      onCommit={(committedRating) => this.handleAnswer(
        surveyIndex,
        questionId,
        committedRating,
        {
          persistDraft: false,
          afterUpdate: this.flushDraftPersistAfterSliderChange,
        }
      )}
    >
      {({ value, sliderProps }) => (
        <>
          <div className={styles.importanceSlider}>
            <CESlider {...sliderProps} />
          </div>
          <FormText className={styles.ratingLabelText}>
            {value}
          </FormText>
        </>
      )}
    </DeferredCommitSlider>
  );

  renderSingleQuestionDeferredConvictionSlider = ({
    surveyIndex,
    questionId,
    sliderMode,
    activeSliderValue,
    convictionValue,
    importanceValue,
  }) => (
    <DeferredCommitSlider
      value={activeSliderValue}
      min={RATING_MIN}
      max={RATING_MAX}
      step={1}
      tooltip={false}
      disabled={this.state.isSubmitting}
      onCommit={(committedValue) => this.handleConvictionImportanceChange(
        surveyIndex,
        questionId,
        sliderMode,
        committedValue,
        {
          persistDraft: false,
          afterUpdate: this.flushDraftPersistAfterSliderChange,
        }
      )}
    >
      {({ value, sliderProps }) => (
        <>
          {this.renderConvictionImportanceLabel(
            questionId,
            sliderMode === 'conviction' ? value : convictionValue,
            sliderMode === 'importance' ? value : importanceValue
          )}
          <CESlider
            {...sliderProps}
            className={[sliderProps.className, styles.convictionSlider].filter(Boolean).join(' ')}
          />
        </>
      )}
    </DeferredCommitSlider>
  );

/**
   * Checks if the incoming 'latest' data from chain/cache matches the
   * current 'editBaseline' (what we just submitted).
   * used to determine if we can safely turn off 'submissionComplete' flag.
   */
  areResponsesConsistent = (latest, surveyIndex) => {
    if (!latest || !this.state.editBaseline) return false;

    // We only care about the rendered questions
    const renderedIds = this.getCurrentRenderedQuestionIds();
    const baseline = this.state.editBaseline;

    // Convert latest (server format) to a slice-like structure for comparison
    // or simply compare values directly using helper
    const latestSlice = this.buildSliceFromUserAnswers(latest);

    // Map latest response objects by qid so we can detect rating envelopes (importanceEncrypted/convictionEncrypted).
    const latestByQid = new Map();
    try {
      const add = (respObj) => {
        const id = String(respObj?.questionID || respObj?.questionId || respObj?.questionIDHash || '').trim().toLowerCase();
        if (!id) return;
        latestByQid.set(id, respObj);
      };
      if (latest && typeof latest === 'object') {
        if (Array.isArray(latest.responses)) latest.responses.forEach(add);
        else add(latest);
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    for (const qid of renderedIds) {
      const qLower = String(qid || '').trim().toLowerCase();
      const baseAns = baseline.answers?.[qid];
      const chainAns = latestSlice.answers?.[qid];

      const baseAdd = baseline.additionalComments?.[qid];
      const chainAdd = latestSlice.additionalComments?.[qid];
      const baselineAnswerEncrypted = !!(baseAns && (baseAns.encrypted || baseAns.encryptedPortion || baseAns.value === '*'));
      const baselineAdditionalEncrypted = !!(baseAdd && (baseAdd.encrypted || baseAdd.encryptedPortion || baseAdd.value === '*'));
      const baselineResponseEncrypted = baselineAnswerEncrypted || baselineAdditionalEncrypted;

      // Rating envelopes can also suppress importance/conviction plaintext even when answer/additional are not encrypted.
      const latestRespObj = qLower ? (latestByQid.get(qLower) || null) : null;
      const latestRatingEncrypted = !!(
        latestRespObj && (
          (typeof latestRespObj.importanceEncrypted === 'string' && latestRespObj.importanceEncrypted) ||
          (typeof latestRespObj.convictionEncrypted === 'string' && latestRespObj.convictionEncrypted)
        )
      );

      // If baseline has a value, chain MUST have that value (or newer)
      // We use valuesEqual to handle arrays/numbers normalization
      if (!this.valuesEqual(baseAns?.value, chainAns?.value)) return false;
      if (!this.valuesEqual(baseAdd?.value, chainAdd?.value)) return false;

      // Check importance equality if it exists in baseline
      if (baseline.importance && Object.prototype.hasOwnProperty.call(baseline.importance, qid)) {
        const baseImp = Number(baseline.importance[qid]);
        const chainImp = latestSlice.importance && Object.prototype.hasOwnProperty.call(latestSlice.importance, qid)
          ? Number(latestSlice.importance[qid])
          : null;
        if (chainImp === null) {
          // Encrypted responses no longer surface importance/conviction in plaintext on-chain.
          if (!baselineResponseEncrypted && !latestRatingEncrypted) return false;
        } else if (baseImp !== chainImp) {
          return false;
        }
      }

      if (baseline.conviction && Object.prototype.hasOwnProperty.call(baseline.conviction, qid)) {
        const baseConv = Number(baseline.conviction[qid]);
        const chainConv = latestSlice.conviction && Object.prototype.hasOwnProperty.call(latestSlice.conviction, qid)
          ? Number(latestSlice.conviction[qid])
          : null;
        if (chainConv === null) {
          if (!baselineResponseEncrypted && !latestRatingEncrypted) return false;
        } else if (baseConv !== chainConv) {
          return false;
        }
      }
    }

    return true;
  };


  /**
   * Compute the changed qIDs (and which fields changed) vs. the edit baseline.
   * Baseline preference:
   *   1) explicit editBaseline (session)
   *   2) userAnswers (on-chain snapshot)
   *   3) local non-encrypted cache (if present)
   *   4) empty slice
   *
   * Decrypt/prefill-only transitions do not count as edits because those paths
   * rebuild the baseline right after hydration.
   *
   * @param {number} [surveyIndexParam]
   * @returns {{ changedQids: Set<string>, changedMap: Record<string,{answer?:1,additional?:1,importance?:1,conviction?:1,encryptedAnswer?:1,encryptedAdditional?:1}> }}
   */
  getEditTrackingQuestionIds = (surveyIndexParam = null) => {
    const ids = new Set();
    const add = (rawId) => {
      const normalized = normalizeQuestionIdKey(rawId);
      if (normalized) ids.add(normalized);
    };
    const addSliceIds = (slice) => {
      if (!slice || typeof slice !== 'object') return;
      const addKeys = (map) => {
        if (!map || typeof map !== 'object') return;
        Object.keys(map).forEach((rawKey) => add(rawKey));
      };
      addKeys(slice.answers);
      addKeys(slice.additionalComments);
      addKeys(slice.importance);
      addKeys(slice.conviction);
    };
    try {
      const surveyIndex = this.getActiveSurveyIndex(surveyIndexParam);
      const currentSlice = this.state?.surveysResponseState?.[surveyIndex] || null;
      addSliceIds(currentSlice);
      if (this.props.singleQuestionMode && this.props.questionID) {
        add(this.props.questionID);
      }
      if (typeof this.getCurrentRenderedQuestionIds === 'function') {
        const renderedIds = this.getCurrentRenderedQuestionIds();
        if (Array.isArray(renderedIds)) renderedIds.forEach((id) => add(id));
      }
      if (ids.size > 0) return ids;

      if (Array.isArray(this.state?.questionPool)) this.state.questionPool.forEach((q) => add(q?.id));
      if (Array.isArray(this.state?.pileQuestions)) this.state.pileQuestions.forEach((q) => add(q?.id));
      if (Array.isArray(this.props?.questionPool)) this.props.questionPool.forEach((q) => add(q?.id));
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    return ids;
  };

  getIndexedQuestionEntryKeys = (source) => {
    if (!source || typeof source !== 'object') return null;
    try {
      const cached = this._normalizedQuestionEntryKeyCache.get(source);
      if (cached) return cached;
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    const byNormalizedQid = new Map();
    Object.keys(source).forEach((rawKey) => {
      const normalizedKey = normalizeQuestionIdKey(rawKey);
      if (!normalizedKey) return;
      const existing = byNormalizedQid.get(normalizedKey);
      if (existing) existing.push(rawKey);
      else byNormalizedQid.set(normalizedKey, [rawKey]);
    });

    try {
      this._normalizedQuestionEntryKeyCache.set(source, byNormalizedQid);
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    return byNormalizedQid;
  };

  getChangedQidsAndFields = (surveyIndexParam) => measureSync('ce.surveyQuestions.getChangedQidsAndFields', () => {
    bumpSurveyPerfCounter('getChangedQidsAndFieldsCount');
    const surveyIndex =
      this.getActiveSurveyIndex(surveyIndexParam);

    const currentSlice =
      (this.state.surveysResponseState && this.state.surveysResponseState[surveyIndex]) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

    // Baseline precedence (anon→empty; logged-in→on-chain snapshot; never drafts)
    // Do not fall back to local cache if we are currently loading,
    // OR if we are logged in (authoritative source is chain, not cache).
    // This prevents "Submit (X)" ghost counts from stale cache data appearing on login.
    const isLoggedIn = !!(this.props.account && this.props.loginComplete);
    const allowLocalCache = !this.state.isLoadingResponse && !isLoggedIn;

    const getUserAnswerBaseline = () => {
      if (!this.state.userAnswers) return null;
      if (
        this._userAnswersSliceCache &&
        this._userAnswersSliceCache.source === this.state.userAnswers &&
        this._userAnswersSliceCache.value
      ) {
        return this._userAnswersSliceCache.value;
      }
      const built = this.buildSliceFromUserAnswers(this.state.userAnswers);
      this._userAnswersSliceCache = { source: this.state.userAnswers, value: built };
      return built;
    };

    let baselineSlice =
      this.state.editBaseline ||
      getUserAnswerBaseline() ||
      (allowLocalCache ? this.buildSliceFromLocalCache() : null) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

    const scopedIds = this.getEditTrackingQuestionIds(surveyIndex);
    const hasScopedIds = scopedIds.size > 0;
    let ids = scopedIds;
    let idsScopeKey = '';
    let idsScopeMode = hasScopedIds ? 'scope' : 'slice';
    if (hasScopedIds) {
      idsScopeKey = `scope:${Array.from(scopedIds).sort().join('|')}`;
    }

    const diffCache = this._changedQidsAndFieldsCache;
    let signatureMemo = null;
    const getSliceSignatures = (normalizedIdFilter = null) => {
      if (signatureMemo && signatureMemo.filter === normalizedIdFilter) {
        return signatureMemo.value;
      }
      const value = {
        currentSliceSignature: buildSurveyResponseSliceSignature(currentSlice, { normalizedIdFilter }),
        baselineSliceSignature: buildSurveyResponseSliceSignature(baselineSlice, { normalizedIdFilter }),
      };
      signatureMemo = { filter: normalizedIdFilter, value };
      return value;
    };

    if (
      hasScopedIds &&
      diffCache &&
      diffCache.surveyIndex === surveyIndex &&
      diffCache.allowLocalCache === allowLocalCache &&
      diffCache.idsScopeMode === 'scope' &&
      diffCache.idsScopeKey === idsScopeKey &&
      diffCache.result
    ) {
      if (
        diffCache.currentSlice === currentSlice &&
        diffCache.baselineSlice === baselineSlice
      ) {
        bumpSurveyPerfCounter('noopSkipCount');
        return diffCache.result;
      }
      const {
        currentSliceSignature,
        baselineSliceSignature,
      } = getSliceSignatures(scopedIds);
      if (
        diffCache.currentSliceSignature === currentSliceSignature &&
        diffCache.baselineSliceSignature === baselineSliceSignature
      ) {
        bumpSurveyPerfCounter('noopSkipCount');
        return diffCache.result;
      }
    } else if (
      !hasScopedIds &&
      diffCache &&
      diffCache.surveyIndex === surveyIndex &&
      diffCache.allowLocalCache === allowLocalCache &&
      diffCache.idsScopeMode === 'slice' &&
      diffCache.result &&
      diffCache.currentSlice === currentSlice &&
      diffCache.baselineSlice === baselineSlice
    ) {
      bumpSurveyPerfCounter('noopSkipCount');
      return diffCache.result;
    }

    if (!hasScopedIds) {
      const idsFromSlices = new Set();
      const addNormalizedIds = (source) => {
        const indexed = this.getIndexedQuestionEntryKeys(source);
        if (!indexed) return;
        indexed.forEach((_keys, normalizedQid) => {
          if (normalizedQid) idsFromSlices.add(normalizedQid);
        });
      };
      addNormalizedIds(baselineSlice.answers);
      addNormalizedIds(currentSlice.answers);
      addNormalizedIds(baselineSlice.additionalComments);
      addNormalizedIds(currentSlice.additionalComments);
      addNormalizedIds(baselineSlice.importance);
      addNormalizedIds(currentSlice.importance);
      addNormalizedIds(baselineSlice.conviction);
      addNormalizedIds(currentSlice.conviction);
      ids = idsFromSlices;
      idsScopeKey = `slice:${Array.from(idsFromSlices).sort().join('|')}`;
      idsScopeMode = 'slice';
      if (
        diffCache &&
        diffCache.surveyIndex === surveyIndex &&
        diffCache.allowLocalCache === allowLocalCache &&
        diffCache.idsScopeMode === idsScopeMode &&
        diffCache.idsScopeKey === idsScopeKey &&
        diffCache.result
      ) {
        if (
          diffCache.currentSlice === currentSlice &&
          diffCache.baselineSlice === baselineSlice
        ) {
          bumpSurveyPerfCounter('noopSkipCount');
          return diffCache.result;
        }
        const normalizedIdFilter = ids.size > 0 ? ids : null;
        const {
          currentSliceSignature,
          baselineSliceSignature,
        } = getSliceSignatures(normalizedIdFilter);
        if (
          diffCache.currentSliceSignature === currentSliceSignature &&
          diffCache.baselineSliceSignature === baselineSliceSignature
        ) {
          bumpSurveyPerfCounter('noopSkipCount');
          return diffCache.result;
        }
      }
    }

    const changedQids = new Set();
    const changedMap = {};
    const ratingEnvelopeQids = buildRatingEnvelopeQidSetFromUserAnswers(this.state.userAnswers);
    const baselineAnswerKeysByQid = this.getIndexedQuestionEntryKeys(baselineSlice.answers);
    const currentAnswerKeysByQid = this.getIndexedQuestionEntryKeys(currentSlice.answers);
    const baselineAdditionalKeysByQid = this.getIndexedQuestionEntryKeys(baselineSlice.additionalComments);
    const currentAdditionalKeysByQid = this.getIndexedQuestionEntryKeys(currentSlice.additionalComments);
    const baselineImportanceKeysByQid = this.getIndexedQuestionEntryKeys(baselineSlice.importance);
    const currentImportanceKeysByQid = this.getIndexedQuestionEntryKeys(currentSlice.importance);
    const baselineConvictionKeysByQid = this.getIndexedQuestionEntryKeys(baselineSlice.conviction);
    const currentConvictionKeysByQid = this.getIndexedQuestionEntryKeys(currentSlice.conviction);

    const getMatchingKeys = (source, indexed, qidLower) => {
      if (!source || typeof source !== 'object' || !indexed) return [];
      return indexed.get(qidLower) || [];
    };

    const pickBestField = (source, indexed, qidLower) => {
      const matchingKeys = getMatchingKeys(source, indexed, qidLower);
      if (matchingKeys.length === 0) return {};

      let exactValue;
      let firstMeaningfulValue;
      let firstEncryptedValue;
      let lastValue = {};
      for (let i = 0; i < matchingKeys.length; i += 1) {
        const key = matchingKeys[i];
        const value = source[key];
        const normalizedValue = value || {};
        lastValue = normalizedValue;
        if (key === qidLower && hasMeaningfulFieldValue(value)) return normalizedValue;
        if (typeof firstMeaningfulValue === 'undefined' && hasMeaningfulFieldValue(value)) {
          firstMeaningfulValue = normalizedValue;
        }
        if (typeof exactValue === 'undefined' && key === qidLower) {
          exactValue = normalizedValue;
        }
        if (
          typeof firstEncryptedValue === 'undefined' &&
          value &&
          (value.encrypted || value.encryptedPortion)
        ) {
          firstEncryptedValue = normalizedValue;
        }
      }
      if (typeof firstMeaningfulValue !== 'undefined') return firstMeaningfulValue;
      if (typeof exactValue !== 'undefined') return exactValue;
      if (typeof firstEncryptedValue !== 'undefined') return firstEncryptedValue;
      return lastValue;
    };

    const pickBestNumber = (source, indexed, qidLower) => {
      const matchingKeys = getMatchingKeys(source, indexed, qidLower);
      if (matchingKeys.length === 0) return null;
      const toNum = (v) => (v === undefined || v === null || Number.isNaN(Number(v)) ? null : Number(v));
      const exactKey = matchingKeys.find((key) => key === qidLower);
      const exactNum = toNum(exactKey ? source[exactKey] : undefined);
      if (exactNum !== null) return exactNum;
      for (let i = 0; i < matchingKeys.length; i += 1) {
        const nextNum = toNum(source[matchingKeys[i]]);
        if (nextNum !== null) return nextNum;
      }
      return null;
    };

    const defaultAudience = this.getDefaultResponseEncryptionAudience();
    const resolveAudienceFast = (field = {}, qid = null) => {
      if (field && typeof field === 'object' && field.encryptionAudience) {
        return this.normalizeResponseEncryptionAudience(field.encryptionAudience, qid);
      }
      return qid ? this.getDefaultResponseEncryptionAudienceForQid(qid) : defaultAudience;
    };
    const resolveGateIdFast = (field = {}, qid = null, fieldKey = 'answer') => (
      this.resolveFieldEncryptionGateId(field, qid, fieldKey)
    );
    const resolveAudienceModeFast = (field = {}, fieldKey = 'answer') => (
      this.normalizeFieldAudienceMode(field?.audienceMode, fieldKey, field)
    );

    ids.forEach((qId) => {
      const bAns = pickBestField(baselineSlice.answers, baselineAnswerKeysByQid, qId);
      const cAns = pickBestField(currentSlice.answers, currentAnswerKeysByQid, qId);
      const bAdd = pickBestField(baselineSlice.additionalComments, baselineAdditionalKeysByQid, qId);
      const cAdd = pickBestField(currentSlice.additionalComments, currentAdditionalKeysByQid, qId);
      const bImpN = pickBestNumber(baselineSlice.importance, baselineImportanceKeysByQid, qId);
      const cImpN = pickBestNumber(currentSlice.importance, currentImportanceKeysByQid, qId);
      const bConvN = pickBestNumber(baselineSlice.conviction, baselineConvictionKeysByQid, qId);
      const cConvN = pickBestNumber(currentSlice.conviction, currentConvictionKeysByQid, qId);

      // valuesEqual('*','*') → unchanged; arrays/nums handled
      const ansChanged = !this.valuesEqual(bAns.value, cAns.value);
      const addChanged = !this.valuesEqual(bAdd.value, cAdd.value);

      const qLower = String(qId || '').trim().toLowerCase();
      const baselineAnswerEncrypted = !!(bAns && (bAns.encrypted || bAns.encryptedPortion || bAns.value === '*'));
      const baselineAdditionalEncrypted = !!(bAdd && (bAdd.encrypted || bAdd.encryptedPortion || bAdd.value === '*'));
      const currentAnswerEncrypted = !!(cAns && (cAns.encrypted || cAns.encryptedPortion || cAns.value === '*'));
      const currentAdditionalEncrypted = !!(cAdd && (cAdd.encrypted || cAdd.encryptedPortion || cAdd.value === '*'));
      const responseEncrypted =
        baselineAnswerEncrypted ||
        baselineAdditionalEncrypted ||
        currentAnswerEncrypted ||
        currentAdditionalEncrypted;
      const ratingEncrypted = qLower ? ratingEnvelopeQids.has(qLower) : false;
      const allowMissingRatings = responseEncrypted || ratingEncrypted;
      const missingCurrentImportance = cImpN === null && bImpN !== null;
      const missingCurrentConviction = cConvN === null && bConvN !== null;

      const impChanged = (bImpN !== cImpN) && !(allowMissingRatings && missingCurrentImportance);
      const convChanged = (bConvN !== cConvN) && !(allowMissingRatings && missingCurrentConviction);

      const ansHasContent = hasMeaningfulFieldValue(bAns) || hasMeaningfulFieldValue(cAns);
      const addHasContent = hasMeaningfulFieldValue(bAdd) || hasMeaningfulFieldValue(cAdd);

      // include encryption-flag deltas only when a field actually has content
      const encAnsChanged = ansHasContent && (!!bAns.encrypted !== !!cAns.encrypted);
      const encAddChanged = addHasContent && (!!bAdd.encrypted !== !!cAdd.encrypted);

      const bAnsAudience = resolveAudienceFast(bAns, qId);
      const cAnsAudience = resolveAudienceFast(cAns, qId);
      const bAddAudience = resolveAudienceFast(bAdd, qId);
      const cAddAudience = resolveAudienceFast(cAdd, qId);
      const bAnsGateId = resolveGateIdFast(bAns, qId, 'answer');
      const cAnsGateId = resolveGateIdFast(cAns, qId, 'answer');
      const bAddGateId = resolveGateIdFast(bAdd, qId, 'additional');
      const cAddGateId = resolveGateIdFast(cAdd, qId, 'additional');
      const bAddAudienceMode = resolveAudienceModeFast(bAdd, 'additional');
      const cAddAudienceMode = resolveAudienceModeFast(cAdd, 'additional');
      const ansAudienceChanged = ansHasContent && !!cAns.encrypted && bAnsAudience !== cAnsAudience;
      const addAudienceChanged = addHasContent && !!cAdd.encrypted && bAddAudience !== cAddAudience;
      const ansGateChanged = ansHasContent && !!cAns.encrypted && String(bAnsGateId || '') !== String(cAnsGateId || '');
      const addGateChanged = addHasContent && !!cAdd.encrypted && String(bAddGateId || '') !== String(cAddGateId || '');
      const addAudienceModeChanged = addHasContent && bAddAudienceMode !== cAddAudienceMode;

      if (
        ansChanged ||
        addChanged ||
        impChanged ||
        convChanged ||
        encAnsChanged ||
        encAddChanged ||
        ansAudienceChanged ||
        addAudienceChanged ||
        ansGateChanged ||
        addGateChanged ||
        addAudienceModeChanged
      ) {
        changedQids.add(qId);
        changedMap[qId] = {
          ...(ansChanged ? { answer: 1 } : null),
          ...(addChanged ? { additional: 1 } : null),
          ...(impChanged ? { importance: 1 } : null),
          ...(convChanged ? { conviction: 1 } : null),
          ...((encAnsChanged || ansAudienceChanged || ansGateChanged) ? { encryptedAnswer: 1 } : null),
          ...((encAddChanged || addAudienceChanged || addGateChanged || addAudienceModeChanged) ? { encryptedAdditional: 1 } : null),
        };
      }
    });

    const result = { changedQids, changedMap };
    const normalizedIdFilter = ids.size > 0 ? ids : null;
    const {
      currentSliceSignature,
      baselineSliceSignature,
    } = getSliceSignatures(normalizedIdFilter);
    this._changedQidsAndFieldsCache = {
      surveyIndex,
      currentSlice,
      baselineSlice,
      currentSliceSignature,
      baselineSliceSignature,
      allowLocalCache,
      idsScopeKey,
      idsScopeMode,
      result,
    };
    this._pendingEditStatsCache = null;
    return result;
  });


  maybeAutoDecryptVisibleFields = () => {
    try {
      // Guard: do not run decrypt sweeps while an error is present (avoid clobber after failed submit)
      if (this.state && this.state.submissionError) {
        this._autoDecryptVisibleSweepCache = null;
        this._autoDecQueue = [];
        this._autoDecProcessing = false;
        this._autoDecryptMaskedAttemptSignature = {};
        this.clearAutoDecryptSweepScheduling();
        return;
      }

      // Auto-decrypt now runs in all views (survey, questions, pile).
      // Guard: when logged out, do nothing so we can retry cleanly after login.
      if (!this.props || !this.props.loginComplete || !this.props.account) {
        this._autoDecryptVisibleSweepCache = null;
        this._autoDecQueue = [];
        this._autoDecProcessing = false;
        this._autoDecryptMaskedAttemptSignature = {};
        this.clearAutoDecryptSweepScheduling();
        return;
      }

      if (!this.state.autoDecryptEnabled) {
        this._autoDecryptVisibleSweepCache = null;
        this._autoDecQueue = [];
        this._autoDecProcessing = false;
        this._autoDecryptMaskedAttemptSignature = {};
        this.clearAutoDecryptSweepScheduling();
        return;
      }

      const surveyIndex =
        this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
      const slice = this.state.surveysResponseState?.[surveyIndex];
      if (!slice) {
        this._autoDecryptVisibleSweepCache = null;
        return;
      }

      // Include both questionPool and pileQuestions
      const ids = this.getCurrentRenderedQuestionIds();
      if (!Array.isArray(ids) || ids.length === 0) {
        this._autoDecryptVisibleSweepCache = null;
        return;
      }

      const accountLower = String(this.props.account || '').trim().toLowerCase();
      const idsKey = buildRenderedIdsSignature(ids);
      const attempted = { ...(this.state.autoDecryptAttempted || {}) };
      const inflight = { ...(this.state.decryptingByKey || {}) };
      const maskedAttemptSignature = this._autoDecryptMaskedAttemptSignature || {};
      const queuedSet = new Set(
        Array.isArray(this._autoDecQueue)
          ? this._autoDecQueue.map((it) => `${it.qid}:${it.field}`)
          : []
      );
      let visibleSignature = `${idsKey}|${accountLower}|${this.state.autoDecryptEnabled ? 1 : 0}`;
      const toQueue = [];

      ids.forEach((qidRaw) => {
        const qidSource = String(qidRaw || '').trim();
        const qid = qidSource.toLowerCase();
        if (!qid) return;
        const ans = slice.answers?.[qidSource] ?? slice.answers?.[qid];
        const add = slice.additionalComments?.[qidSource] ?? slice.additionalComments?.[qid];

        const kA = `${qid}:answer`;
        const kD = `${qid}:additional`;
        const answerSig = this.buildAutoDecryptMaskedFieldSignature(ans);
        const additionalSig = this.buildAutoDecryptMaskedFieldSignature(add);
        visibleSignature += `|${qid}|a:${answerSig}|d:${additionalSig}`;

        if (
          ans && ans.value === '*' && (ans.encryptedPortion || ans.encrypted) &&
          !attempted[kA] && !queuedSet.has(kA) && !inflight[kA] &&
          (!maskedAttemptSignature[kA] || maskedAttemptSignature[kA] !== answerSig)
        ) {
          toQueue.push({ qid, field: 'answer', maskedSig: answerSig });
        }
        if (
          add && add.value === '*' && (add.encryptedPortion || add.encrypted) &&
          !attempted[kD] && !queuedSet.has(kD) && !inflight[kD] &&
          (!maskedAttemptSignature[kD] || maskedAttemptSignature[kD] !== additionalSig)
        ) {
          toQueue.push({ qid, field: 'additional', maskedSig: additionalSig });
        }
      });

      const sweepCache = this._autoDecryptVisibleSweepCache;
      if (
        sweepCache &&
        sweepCache.sliceRef === slice &&
        sweepCache.idsKey === idsKey &&
        sweepCache.accountLower === accountLower &&
        sweepCache.autoDecryptEnabled === !!this.state.autoDecryptEnabled &&
        sweepCache.attemptedRef === this.state.autoDecryptAttempted &&
        sweepCache.decryptingRef === this.state.decryptingByKey &&
        sweepCache.showCommentsRef === this.state.showComments &&
        sweepCache.maskedAttemptRef === maskedAttemptSignature &&
        sweepCache.visibleSignature === visibleSignature
      ) {
        bumpSurveyPerfCounter('noopSkipCount');
        return;
      }
      this._autoDecryptVisibleSweepCache = {
        sliceRef: slice,
        idsKey,
        accountLower,
        autoDecryptEnabled: !!this.state.autoDecryptEnabled,
        attemptedRef: this.state.autoDecryptAttempted,
        decryptingRef: this.state.decryptingByKey,
        showCommentsRef: this.state.showComments,
        maskedAttemptRef: maskedAttemptSignature,
        visibleSignature,
      };

      if (toQueue.length === 0) return;
      this._autoDecQueue.push(...toQueue);
      this.processAutoDecryptQueue();
    } catch (_) {
      this._autoDecryptVisibleSweepCache = null;
    }
  };



  processAutoDecryptQueue = async () => {
    if (!this.state.autoDecryptEnabled) {
      this._autoDecQueue = [];
      this._autoDecProcessing = false;
      this._autoDecryptMaskedAttemptSignature = {};
      if (this._autoDecProcessTimer) {
        clearTimeout(this._autoDecProcessTimer);
        this._transientTimeouts.delete(this._autoDecProcessTimer);
        this._autoDecProcessTimer = null;
      }
      this.clearAutoDecryptSweepScheduling();
      return;
    }
    if (this._autoDecProcessing) return;
    const item = this._autoDecQueue.shift();
    if (!item) return;

    this._autoDecProcessing = true;
    const k = `${item.qid}:${item.field}`;
    const maskedSig = String(item?.maskedSig || '');
    try {
      const did = await this.handleDecryptQuestionAnswer(item.qid, item.field);
      if (did) {
        // Mark as attempted ONLY when we actually produced a decrypted value
        if (!this.state.autoDecryptAttempted?.[k]) {
          this.setState((prev) => ({
            autoDecryptAttempted: { ...(prev.autoDecryptAttempted || {}), [k]: true },
          }));
        }
        if (this._autoDecryptMaskedAttemptSignature?.[k]) {
          const nextAttemptSig = { ...(this._autoDecryptMaskedAttemptSignature || {}) };
          delete nextAttemptSig[k];
          this._autoDecryptMaskedAttemptSignature = nextAttemptSig;
        }
      } else if (maskedSig) {
        this._autoDecryptMaskedAttemptSignature = {
          ...(this._autoDecryptMaskedAttemptSignature || {}),
          [k]: maskedSig,
        };
      }
    } catch (_) {
      if (maskedSig) {
        this._autoDecryptMaskedAttemptSignature = {
          ...(this._autoDecryptMaskedAttemptSignature || {}),
          [k]: maskedSig,
        };
      }
    } finally {
      this._autoDecProcessing = false;
      // Deferred re-sweep: let setState callbacks settle before re-scanning
      Promise.resolve().then(() => {
        try { this.queueAutoDecryptVisibleSweep('post-item'); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      });
      if (this._autoDecQueue.length > 0) {
        if (this._autoDecProcessTimer) {
          clearTimeout(this._autoDecProcessTimer);
          this._transientTimeouts.delete(this._autoDecProcessTimer);
        }
        this._autoDecProcessTimer = this.setManagedTimeout(() => {
          this._autoDecProcessTimer = null;
          this.processAutoDecryptQueue();
        }, 50);
      }
    }
  };


  getDraftKey = () => {
    try {
      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const networkIdStr = draftContext.networkIdStr;
      const surveyScope = this._getDraftScope();
      const accountOrAnon = (this.props?.account || '').toLowerCase() || 'anon';

      // Early-boot sentinel so drafts persist before network is known
      if (!networkIdStr) {
        return `dg:surveyDraft:${slug}:__pending__:${accountOrAnon}:${surveyScope}`;
      }
      return `dg:surveyDraft:${slug}:${networkIdStr}:${accountOrAnon}:${surveyScope}`;
    } catch (_) {
      return null;
    }
  };

  loadDraft = () => {
    try {
      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const networkIdStr = draftContext.networkIdStr;

      const surveyScope = this._getDraftScope();
      const accountLower = (this.props?.account || '').toLowerCase();
      const compatScope = surveyScope.replace(/^questions:q:[^:]+$/, 'questions');

      const readAndParse = (key) => {
        if (!key) return null;
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) return null;
          let parsed = null;
          try { parsed = JSON.parse(raw); }
          catch { try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }; return null; }
          if (!parsed || typeof parsed !== 'object' || !parsed.answers) {
            try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
            return null;
          }
          return { raw, obj: parsed };
        } catch (_) { return null; }
      };

      // Base net: supports early-boot '__pending__'
      const baseNet = networkIdStr || '__pending__';

      // Primary + compat keys
      const anonKey       = `dg:surveyDraft:${slug}:${baseNet}:anon:${surveyScope}`;
      const acctKey       = `dg:surveyDraft:${slug}:${baseNet}:${accountLower || 'anon'}:${surveyScope}`;
      const anonCompatKey = `dg:surveyDraft:${slug}:${baseNet}:anon:${compatScope}`;
      const acctCompatKey = `dg:surveyDraft:${slug}:${baseNet}:${accountLower || 'anon'}:${compatScope}`;

      // Pending sentinel (migrate once network/account state stabilizes)
      const pendingKey = `dg:surveyDraft:${slug}:__pending__:${accountLower || 'anon'}:${surveyScope}`;
      const pend = readAndParse(pendingKey);

      // Legacy per-QID scope migration (from 'questions:q:<qid>' → 'questions')
      const qidLower = this.props.singleQuestionMode && this.props.questionID
        ? String(this.props.questionID).toLowerCase() : null;
      const perQidScope = qidLower ? `questions:q:${qidLower}` : null;
      const anonPerQidKey = perQidScope ? `dg:surveyDraft:${slug}:${baseNet}:anon:${perQidScope}` : null;
      const acctPerQidKey = perQidScope ? `dg:surveyDraft:${slug}:${baseNet}:${accountLower || 'anon'}:${perQidScope}` : null;
      const perQidAnon = anonPerQidKey ? readAndParse(anonPerQidKey) : null;
      const perQidAcct = acctPerQidKey ? readAndParse(acctPerQidKey) : null;

      if (accountLower) {
        // 1) Exact primary
        const acc = readAndParse(acctKey);
        if (acc) return acc.obj;

        // 2) Compat primary
        const accCompat = readAndParse(acctCompatKey);
        if (accCompat) {
          try { sessionStorage.setItem(acctKey, accCompat.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          try { sessionStorage.removeItem(acctCompatKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          return accCompat.obj;
        }

        // 3) Pending → account
        if (pend) {
          try { sessionStorage.setItem(acctKey, pend.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          try { sessionStorage.removeItem(pendingKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          return pend.obj;
        }

        // 4) Per-QID → account
        if (perQidAcct) {
          try { sessionStorage.setItem(acctKey, perQidAcct.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          try { sessionStorage.removeItem(acctPerQidKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          return perQidAcct.obj;
        }

        // 5) Anon → account
        const an = readAndParse(anonKey);
        if (an) {
          try { sessionStorage.setItem(acctKey, an.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          try { sessionStorage.removeItem(anonKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          return an.obj;
        }

        // 6) Compat anon → account
        const anCompat = readAndParse(anonCompatKey);
        if (anCompat) {
          try { sessionStorage.setItem(acctKey, anCompat.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          try { sessionStorage.removeItem(anonCompatKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          return anCompat.obj;
        }

        // 7) Per-QID anon → account
        if (perQidAnon) {
          try { sessionStorage.setItem(acctKey, perQidAnon.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          try { sessionStorage.removeItem(anonPerQidKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          return perQidAnon.obj;
        }

        return null;
      }

      // Anonymous path
      // 1) Exact primary
      const an = readAndParse(anonKey);
      if (an) return an.obj;

      // 2) Compat primary
      const anCompat = readAndParse(anonCompatKey);
      if (anCompat) {
        try { sessionStorage.setItem(anonKey, anCompat.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        try { sessionStorage.removeItem(anonCompatKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        return anCompat.obj;
      }

      // 3) Pending → anon
      if (pend) {
        try { sessionStorage.setItem(anonKey, pend.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        try { sessionStorage.removeItem(pendingKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        return pend.obj;
      }

      // 4) Per-QID anon → anon
      if (perQidAnon) {
        try { sessionStorage.setItem(anonKey, perQidAnon.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        try { sessionStorage.removeItem(anonPerQidKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        return perQidAnon.obj;
      }

      return null;
    } catch (_) {
      return null;
    }
  };




  _draftDirtyQids = new Set();

  persistDraftSafely = (delayMs = 150) => {
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(this.persistDraft, delayMs);
  };

  persistDraft = () => measureSync('ce.surveyQuestions.persistDraft', () => {
    try {
      const key = this.getDraftKey();

      // Guard null key and clean up malformed JSON
      if (!key) return;
      if (key !== this._lastDraftKey) {
        this._lastDraftKey = key;
        this._lastDraftJSON = null;
        this._lastDraftSemanticSignature = null;
      }

      // Preload prior persisted answers so we don't prune non-rendered QIDs
      let prevAnswers = {};
      let prevBaseline = {};
      let prevDraftRaw = '';
      let prevSemanticSignature = null;
      const cachedDraftRaw =
        this._draftParseCache && typeof this._draftParseCache.raw === 'string'
          ? this._draftParseCache.raw
          : null;
      const canUseCachedPrevDraft =
        this._lastDraftKey === key &&
        this._draftParseCache &&
        this._draftParseCache.key === key &&
        cachedDraftRaw !== null &&
        cachedDraftRaw === String(this._lastDraftJSON ?? '') &&
        this._draftParseCache.parsed &&
        typeof this._draftParseCache.parsed === 'object';
      if (canUseCachedPrevDraft) {
        const parsed = this._draftParseCache.parsed;
        prevDraftRaw = String(this._draftParseCache.raw || '');
        prevAnswers = (parsed && typeof parsed === 'object' ? parsed.answers : {}) || {};
        prevBaseline = (parsed && typeof parsed === 'object' ? parsed.baseline : {}) || {};
        prevSemanticSignature =
          this._lastDraftSemanticSignature ||
          buildSurveyDraftSemanticSignature(parsed);
      } else {
        try {
          const raw = sessionStorage.getItem(key) || '';
          prevDraftRaw = raw;
          if (raw) {
            const cacheHit =
              this._draftParseCache &&
              this._draftParseCache.key === key &&
              this._draftParseCache.raw === raw &&
              this._draftParseCache.parsed &&
              typeof this._draftParseCache.parsed === 'object';
            const parsed = cacheHit
              ? this._draftParseCache.parsed
              : JSON.parse(raw);
            prevAnswers = (parsed && typeof parsed === 'object' ? parsed.answers : {}) || {};
            prevBaseline = (parsed && typeof parsed === 'object' ? parsed.baseline : {}) || {};
            prevSemanticSignature = buildSurveyDraftSemanticSignature(parsed);
            if (!cacheHit) {
              this._draftParseCache = { key, raw, parsed };
            }
          }
        } catch {
          try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          this._draftParseCache = null;
          this._lastDraftJSON = null;
          this._lastDraftSemanticSignature = null;
        }
      }

      const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
      const slice = (this.state.surveysResponseState && this.state.surveysResponseState[surveyIndex]) || {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {}
      };

      // Only persist rendered (or all if none rendered)
      const renderedIds = this.getHydrationQuestionIds();
      const dirtyQids = this._draftDirtyQids ? [...this._draftDirtyQids] : [];
      const allowed = new Set(
        renderedIds.length
          ? [...renderedIds, ...dirtyQids]
          : [
              ...Object.keys(slice.answers || {}),
              ...Object.keys(slice.additionalComments || {}),
              ...Object.keys(slice.importance || {}),
              ...Object.keys(slice.conviction || {})
            ]
      );

      // Start from previous draft answers (to keep non-rendered entries)
      const answersObj = { ...(prevAnswers || {}) };
      // Regression guard: persist baseline alongside answers so refresh keeps
      // editBaseline and live state semantically aligned after decrypt-only flows.
      const baselineObj = { ...(prevBaseline || {}) };
      const baselineSlice = this.state.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

      // Overwrite with currently rendered fields
      allowed.forEach((qid) => {
        const ans = (slice.answers && slice.answers[qid]) || {};
        const add = (slice.additionalComments && slice.additionalComments[qid]) || {};
        const imp = (slice.importance && Object.prototype.hasOwnProperty.call(slice.importance, qid))
          ? slice.importance[qid]
          : null;
        const conv = (slice.conviction && Object.prototype.hasOwnProperty.call(slice.conviction, qid))
          ? slice.conviction[qid]
          : null;

        const hasVal =
          ans.value !== undefined && ans.value !== null &&
          (Array.isArray(ans.value) ? ans.value.length > 0 : String(ans.value).length > 0);
        const hasAdd =
          add.value !== undefined && add.value !== null && String(add.value).length > 0;
        const hasImp = imp !== null;
        const hasConv = conv !== null;

        if (hasVal || hasAdd || hasImp || hasConv) {
          answersObj[qid] = {
            value: ans.value,
            answerEncrypted: ans.encrypted,
            answerEncryptionAudience: this.resolveFieldEncryptionAudience(ans, qid),
            answerEncryptionGateId: this.resolveFieldEncryptionGateId(ans, qid, 'answer'),
            answerAudienceMode: this.normalizeFieldAudienceMode(ans?.audienceMode, 'answer', ans),
            ...(ans.encryptedPortion ? { answerEncryptedPortion: ans.encryptedPortion } : {}),
            additional: add.value,
            additionalEncrypted: add.encrypted,
            additionalEncryptionAudience: this.resolveFieldEncryptionAudience(add, qid, 'additional'),
            additionalEncryptionGateId: this.resolveFieldEncryptionGateId(add, qid, 'additional'),
            additionalAudienceMode: this.normalizeFieldAudienceMode(add?.audienceMode, 'additional', add),
            ...(add.encryptedPortion ? { additionalEncryptedPortion: add.encryptedPortion } : {}),
            importance: imp,
            conviction: conv,
          };
        } else {
          if (answersObj[qid]) delete answersObj[qid];
        }

        const bAns = (baselineSlice.answers && baselineSlice.answers[qid]) || {};
        const bAdd = (baselineSlice.additionalComments && baselineSlice.additionalComments[qid]) || {};
        const bImp = (baselineSlice.importance && Object.prototype.hasOwnProperty.call(baselineSlice.importance, qid))
          ? baselineSlice.importance[qid]
          : null;
        const bConv = (baselineSlice.conviction && Object.prototype.hasOwnProperty.call(baselineSlice.conviction, qid))
          ? baselineSlice.conviction[qid]
          : null;
        const bHasVal =
          bAns.value !== undefined && bAns.value !== null &&
          (Array.isArray(bAns.value) ? bAns.value.length > 0 : String(bAns.value).length > 0);
        const bHasAdd =
          bAdd.value !== undefined && bAdd.value !== null && String(bAdd.value).length > 0;
        const bHasImp = bImp !== null;
        const bHasConv = bConv !== null;

        if (bHasVal || bHasAdd || bHasImp || bHasConv) {
          baselineObj[qid] = {
            value: bAns.value,
            answerEncrypted: bAns.encrypted,
            answerEncryptionAudience: this.resolveFieldEncryptionAudience(bAns, qid),
            answerEncryptionGateId: this.resolveFieldEncryptionGateId(bAns, qid, 'answer'),
            answerAudienceMode: this.normalizeFieldAudienceMode(bAns?.audienceMode, 'answer', bAns),
            ...(bAns.encryptedPortion ? { answerEncryptedPortion: bAns.encryptedPortion } : {}),
            additional: bAdd.value,
            additionalEncrypted: bAdd.encrypted,
            additionalEncryptionAudience: this.resolveFieldEncryptionAudience(bAdd, qid, 'additional'),
            additionalEncryptionGateId: this.resolveFieldEncryptionGateId(bAdd, qid, 'additional'),
            additionalAudienceMode: this.normalizeFieldAudienceMode(bAdd?.audienceMode, 'additional', bAdd),
            ...(bAdd.encryptedPortion ? { additionalEncryptedPortion: bAdd.encryptedPortion } : {}),
            importance: bImp,
            conviction: bConv,
          };
        } else {
          if (baselineObj[qid]) delete baselineObj[qid];
        }
      });

      if (Object.keys(answersObj).length === 0) {
        // No meaningful draft → clear both scoped variants (and SQM compat)
        this.clearDraft();
        return;
      }

      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const payload = {
        meta: {
          networkId: draftContext.networkId,
          surveyId: this.props.singleQuestionMode ? (this.props.questionID || 'questions') : (this.props.surveyId || 'questions'),
          ts: Date.now()
        },
        answers: answersObj,
        // Keep baseline in storage; prefill/merge logic depends on it to avoid false dirty diffs.
        baseline: baselineObj
      };

      const nextSemanticSignature = buildSurveyDraftSemanticSignature(payload);
      if (nextSemanticSignature && nextSemanticSignature === prevSemanticSignature) {
        this._lastDraftJSON = prevDraftRaw || this._lastDraftJSON;
        this._lastDraftSemanticSignature = nextSemanticSignature;
        if (this._draftDirtyQids) this._draftDirtyQids.clear();
        return;
      }

      const nextJson = JSON.stringify(payload);
      if (nextJson === this._lastDraftJSON) return;
      try {
        sessionStorage.setItem(key, nextJson);
      } catch (e) {
        surveyLog.warn('SurveyTool: draft persistence failed', e);
        return;
      }

      // SQM compat mirror under :questions (without :q:<qid>) for tooling/tests
      if (this.props.singleQuestionMode) {
        try {
          const compatKey = key.replace(/:questions:q:[^:]+$/, ':questions');
          if (compatKey !== key) sessionStorage.setItem(compatKey, nextJson);
        } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }

      this._draftParseCache = { key, raw: nextJson, parsed: payload };
      this._lastDraftJSON = nextJson;
      this._lastDraftSemanticSignature = nextSemanticSignature;
      if (this._draftDirtyQids) this._draftDirtyQids.clear();

      // If logged in, proactively remove stale anon variants (exact + compat)
      const accountLower = (this.props?.account || '').toLowerCase();
      if (accountLower) {
        const baseNet = draftContext.networkIdStr || '__pending__';
        const surveyScope = this._getDraftScope();
        const anonKey = `dg:surveyDraft:${slug}:${baseNet}:anon:${surveyScope}`;
        const anonCompatKey = anonKey.replace(/:questions:q:[^:]+$/, ':questions');
        try { sessionStorage.removeItem(anonKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        try { sessionStorage.removeItem(anonCompatKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  });

  clearDraft = () => {
    try {
      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const networkIdStr = draftContext.networkIdStr;

      const surveyScope = this._getDraftScope();
      const compatScope = surveyScope.replace(/^questions:q:[^:]+$/, 'questions');
      const accountLower = (this.props?.account || '').toLowerCase() || 'anon';

      // Build all variants to purge: current network (if known) + __pending__, both user and anon, both scopes.
      const nets = new Set(['__pending__']);
      if (networkIdStr) nets.add(networkIdStr);

      const who = new Set([accountLower, 'anon']);
      const scopes = new Set([surveyScope, compatScope]);

      const keys = [];
      nets.forEach(n => who.forEach(w => scopes.forEach(sc => {
        keys.push(`dg:surveyDraft:${slug}:${n}:${w}:${sc}`);
      })));

      keys.forEach(k => { try { sessionStorage.removeItem(k); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); } });

      this._draftParseCache = null;
      this._lastDraftKey = '';
      this._lastDraftJSON = null;
      this._lastDraftSemanticSignature = null;
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };


  clearDraftFor = (qid) => {
    try {
      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const networkIdStr = draftContext.networkIdStr;

      const surveyScope = this._getDraftScope();
      const compatScope = surveyScope.replace(/^questions:q:[^:]+$/, 'questions');
      const accountLower = (this.props?.account || '').toLowerCase() || 'anon';

      // Optionally include legacy per-QID scope to be extra thorough
      const qidLower = (qid || '').toLowerCase();
      const perQidScope = this.props.singleQuestionMode && qidLower ? `questions:q:${qidLower}` : null;

      const nets = new Set(['__pending__']);
      if (networkIdStr) nets.add(networkIdStr);

      const who = new Set([accountLower, 'anon']);
      const scopes = new Set([surveyScope, compatScope]);
      if (perQidScope) scopes.add(perQidScope);

      const keys = [];
      nets.forEach(n => who.forEach(w => scopes.forEach(sc => {
        keys.push(`dg:surveyDraft:${slug}:${n}:${w}:${sc}`);
      })));

      keys.forEach((key) => {
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) return;
          let parsed = null;
          try { parsed = JSON.parse(raw); }
          catch (_) {
            try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
            if (this._draftParseCache && this._draftParseCache.key === key) {
              this._draftParseCache = null;
            }
            if (this._lastDraftKey === key) {
              this._lastDraftJSON = null;
              this._lastDraftSemanticSignature = null;
            }
            return;
          }

          if (!parsed || typeof parsed !== 'object' || !parsed.answers) {
            try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
            if (this._draftParseCache && this._draftParseCache.key === key) {
              this._draftParseCache = null;
            }
            if (this._lastDraftKey === key) {
              this._lastDraftJSON = null;
              this._lastDraftSemanticSignature = null;
            }
            return;
          }
          const answerKeys = Object.keys(parsed.answers || {});
          let removed = false;
          answerKeys.forEach((answerKey) => {
            if (String(answerKey || '').toLowerCase() !== qidLower) return;
            delete parsed.answers[answerKey];
            if (parsed.baseline && parsed.baseline[answerKey]) {
              delete parsed.baseline[answerKey];
            }
            removed = true;
          });
          if (removed) {
            if (Object.keys(parsed.answers).length === 0) {
              try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
              if (this._draftParseCache && this._draftParseCache.key === key) {
                this._draftParseCache = null;
              }
              if (this._lastDraftKey === key) {
                this._lastDraftJSON = null;
                this._lastDraftSemanticSignature = null;
              }
            } else {
              const nextJson = JSON.stringify(parsed);
              sessionStorage.setItem(key, nextJson);
              this._draftParseCache = { key, raw: nextJson, parsed };
              this._lastDraftKey = key;
              this._lastDraftJSON = nextJson;
              this._lastDraftSemanticSignature = buildSurveyDraftSemanticSignature(parsed);
            }
          }
        } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      });
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };



  getCurrentRenderedQuestionIds = () => {
    const questionPool = Array.isArray(this.state?.questionPool) ? this.state.questionPool : [];
    const pileQuestions = Array.isArray(this.state?.pileQuestions) ? this.state.pileQuestions : [];
    const singleQuestionMode = !!this.props.singleQuestionMode;
    const questionId = String(this.props.questionID || '');
    if (
      this._currentRenderedQuestionIdsCache &&
      this._currentRenderedQuestionIdsCacheQuestionPool === questionPool &&
      this._currentRenderedQuestionIdsCacheQuestionPoolLength === questionPool.length &&
      this._currentRenderedQuestionIdsCachePileQuestions === pileQuestions &&
      this._currentRenderedQuestionIdsCachePileQuestionsLength === pileQuestions.length &&
      this._currentRenderedQuestionIdsCacheSingleQuestionMode === singleQuestionMode &&
      this._currentRenderedQuestionIdsCacheQuestionId === questionId
    ) {
      return this._currentRenderedQuestionIdsCache;
    }

    const ids = new Set();
    try {
      questionPool.forEach(q => q?.id && ids.add(q.id));
      pileQuestions.forEach(q => q?.id && ids.add(q.id));
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    const renderedIds = Array.from(ids);
    this._currentRenderedQuestionIdsCache = renderedIds;
    this._currentRenderedQuestionIdsCacheQuestionPool = questionPool;
    this._currentRenderedQuestionIdsCacheQuestionPoolLength = questionPool.length;
    this._currentRenderedQuestionIdsCachePileQuestions = pileQuestions;
    this._currentRenderedQuestionIdsCachePileQuestionsLength = pileQuestions.length;
    this._currentRenderedQuestionIdsCacheSingleQuestionMode = singleQuestionMode;
    this._currentRenderedQuestionIdsCacheQuestionId = questionId;
    return renderedIds;
  };

  getHydrationQuestionIds = () => {
    const renderedIds = Array.isArray(this.getCurrentRenderedQuestionIds?.())
      ? this.getCurrentRenderedQuestionIds()
      : [];
    return Array.from(
      new Set(renderedIds.map((id) => normalizeQuestionIdKey(id)).filter(Boolean))
    );
  };

  buildLocalCacheHydrationSignature = (surveyIndex, renderedIds = []) => {
    try {
      const context = resolveResponseHydrationContext(this.props, this._getEffectiveDraftSlug());
      const slug = normalizeSessionSlugValue(context.sessionSlug);
      const extraSlugs = this.props?.minifiedMode === 'pile'
        ? getExtraQuestionReadSlugs(this.props, slug)
        : [];
      const scopeSignature = [slug, ...extraSlugs].join(',');
      const netId = context.networkIdStr;
      const accountLower = String(this.props?.account || '').trim().toLowerCase();
      const renderedSignature = buildRenderedIdsSignature(renderedIds);
      return [
        String(surveyIndex),
        scopeSignature,
        netId,
        accountLower,
        renderedSignature,
        Number(this.props.questionsCacheNonce || 0),
        Number(this.props.questionResponsesNonce || 0),
        this.state?.suppressPrefill ? 1 : 0,
        this.state?.submissionError ? 1 : 0,
        this.state?.submissionComplete ? 1 : 0,
      ].join('|');
    } catch (_) {
      return '';
    }
  };

  getRenderedQuestionIdsForResponseHydration = () => {
    return Array.from(
      new Set(
        this.getCurrentRenderedQuestionIds()
          .map((id) => normalizeQuestionIdKey(id))
          .filter(Boolean)
      )
    );
  };

  resolveQuestionSlugMapForIds = (questionIds = [], opts = {}) => {
    const normalizedIds = Array.isArray(questionIds)
      ? Array.from(new Set(questionIds.map((id) => normalizeQuestionIdKey(id)).filter(Boolean)))
      : [];
    const slugByQuestionId = new Map();
    if (normalizedIds.length === 0) return slugByQuestionId;

    const poolCombined = []
      .concat(Array.isArray(this.state.questionPool) ? this.state.questionPool : [])
      .concat(Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : []);
    const poolQuestionById = new Map();
    poolCombined.forEach((question) => {
      const questionId = normalizeQuestionIdKey(question?.id);
      if (!questionId || poolQuestionById.has(questionId)) return;
      poolQuestionById.set(questionId, question);
    });

    const fallbackSurveyId = Object.prototype.hasOwnProperty.call(opts || {}, 'surveyId')
      ? opts.surveyId
      : (
        this.props.singleQuestionMode
          ? null
          : (this.props.surveyId || null)
      );

    normalizedIds.forEach((questionId) => {
      const question = poolQuestionById.get(questionId) || null;
      let resolvedSlug = '';
      let hasExplicitQuestionSlug = false;

      if (question && Object.prototype.hasOwnProperty.call(question, 'sessionSlug')) {
        resolvedSlug = normalizeSessionSlugValue(question.sessionSlug);
        hasExplicitQuestionSlug = question.sessionSlug !== null && question.sessionSlug !== undefined;
      }

      if (!hasExplicitQuestionSlug && typeof question?.sessionName === 'string') {
        const mapped = getSessionSlugByName(question.sessionName);
        if (mapped !== null && mapped !== undefined) {
          resolvedSlug = normalizeSessionSlugValue(mapped);
          hasExplicitQuestionSlug = true;
        }
      }

      if (!hasExplicitQuestionSlug) {
        resolvedSlug = normalizeSessionSlugValue(resolveSlugForIds({
          sessionName: null,
          questionId,
          surveyId: fallbackSurveyId,
          props: this.props,
          network: this.props.network,
        }));
      }

      slugByQuestionId.set(questionId, resolvedSlug);
    });

    return slugByQuestionId;
  };

  resolveSubmissionGroupContext = ({ questionIds = [], surveyId = null } = {}) => {
    const normalizedIds = Array.isArray(questionIds)
      ? Array.from(new Set(questionIds.map((id) => normalizeQuestionIdKey(id)).filter(Boolean)))
      : [];
    if (normalizedIds.length === 0) {
      return {
        ok: true,
        submissionGroupKey: normalizeSessionSlugValue(resolveEffectiveSlug(this.props)),
        sessionSlugs: [],
        slugByQuestionId: new Map(),
      };
    }

    const slugByQuestionId = this.resolveQuestionSlugMapForIds(normalizedIds, { surveyId });
    const sessionSlugs = dedupeQuestionReadSlugs(
      normalizedIds.map((questionId) => slugByQuestionId.get(questionId))
    );
    if (sessionSlugs.length > 1) {
      return {
        ok: false,
        submissionGroupKey: '',
        sessionSlugs,
        slugByQuestionId,
        error: 'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.',
      };
    }

    return {
      ok: true,
      submissionGroupKey: sessionSlugs[0] ?? normalizeSessionSlugValue(resolveEffectiveSlug(this.props)),
      sessionSlugs,
      slugByQuestionId,
    };
  };

  getMissingRenderedResponseIdsForAccount = async (opts = {}) => {
    const responderLower = String(opts?.responder || this.props.account || '').trim().toLowerCase();
    if (!responderLower) return { missingIds: [], slug: '', netId: '' };

    const fallbackSlug = resolveEffectiveSlug(this.props);
    const rawSlug = opts?.slug ?? this._getEffectiveDraftSlug() ?? fallbackSlug;
    const context = resolveResponseHydrationContext(this.props, rawSlug);
    const slug = normalizeSessionSlugValue(context.sessionSlug);
    const netId = context.networkIdStr;
    if (!netId) return { missingIds: [], slug, netId: '' };

    const renderedIds = this.getRenderedQuestionIdsForResponseHydration();
    if (renderedIds.length === 0) return { missingIds: [], slug, netId };
    const extraSlugs = this.props?.minifiedMode === 'pile'
      ? getExtraQuestionReadSlugs(this.props, slug)
      : [];
    if (this.props?.minifiedMode === 'pile' && extraSlugs.length > 0) {
      const slugByQuestionId = this.resolveQuestionSlugMapForIds(renderedIds, { surveyId: this.props.surveyId || null });
      const cachedQuestionResponsesByScope = new Map();
      const requestsBySlug = new Map();

      for (const questionId of renderedIds) {
        const resolvedSlug = normalizeSessionSlugValue(slugByQuestionId.get(questionId) ?? slug);
        const resolvedContext = resolveResponseHydrationContext(this.props, resolvedSlug);
        const resolvedNetId = resolvedContext.networkIdStr || netId;
        if (!resolvedNetId) continue;

        const scopeKey = `${resolvedSlug}|${resolvedNetId}`;
        let questionResponses = cachedQuestionResponsesByScope.get(scopeKey);
        if (!questionResponses) {
          const questionsCache = ensureQuestionsNet(await readQuestionsCacheAsync(resolvedSlug), resolvedNetId);
          questionResponses = questionsCache?.[resolvedNetId]?.questionResponses || {};
          cachedQuestionResponsesByScope.set(scopeKey, questionResponses);
        }

        const perQuestion = questionResponses?.[questionId];
        if (perQuestion && typeof perQuestion === 'object' && perQuestion[responderLower]) continue;

        if (!requestsBySlug.has(scopeKey)) {
          requestsBySlug.set(scopeKey, {
            slug: resolvedSlug,
            netId: resolvedNetId,
            missingIds: [],
          });
        }
        requestsBySlug.get(scopeKey).missingIds.push(questionId);
      }

      const requests = Array.from(requestsBySlug.values()).filter((entry) => entry.missingIds.length > 0);
      if (requests.length === 0) {
        return { missingIds: [], slug, netId, requests: [] };
      }
      if (requests.length === 1) {
        return {
          ...requests[0],
          requests,
        };
      }
      return { missingIds: [], slug, netId, requests };
    }

    const questionsCache = ensureQuestionsNet(await readQuestionsCacheAsync(slug), netId);
    const questionResponses = questionsCache?.[netId]?.questionResponses || {};

    const missingIds = renderedIds.filter((qid) => {
      const perQuestion = questionResponses?.[qid];
      if (!perQuestion || typeof perQuestion !== 'object') return true;
      return !perQuestion[responderLower];
    });

    return { missingIds, slug, netId };
  };

  ensurePriorResponsesForRenderedIds = async (opts = {}) => {
    const accountLower = String(this.props.account || '').trim().toLowerCase();
    const viewingOtherSurveyResponder =
      !!this.props.displayAnswerMode &&
      !!this.props.viewAddress &&
      String(this.props.viewAddress || '').trim().toLowerCase() !== accountLower;
    const viewingOtherQuestionResponder =
      !!this.props.singleQuestionMode &&
      !!this.props.responderAddress &&
      String(this.props.responderAddress || '').trim().toLowerCase() !== accountLower;

    const canBackfill =
      !!this.props.loginComplete &&
      !!accountLower &&
      !viewingOtherSurveyResponder &&
      !viewingOtherQuestionResponder &&
      typeof this.props.refreshQuestionResponses === 'function';
    if (!canBackfill) return false;
    if (this.state.submissionComplete || this.state.isSubmitting) return false;

    if (this._priorResponseBackfillInFlight) {
      return this._priorResponseBackfillInFlight;
    }

    const run = (async () => {
      let fetched = false;
      let slug = '';
      const attemptedKeys = [];
      try {
        const responderLower = String(this.props.account || '').trim().toLowerCase();
        const missingInfo = await this.getMissingRenderedResponseIdsForAccount({
          responder: responderLower,
          slug: opts?.slug,
        });
        const groupedRequests = Array.isArray(missingInfo?.requests) && missingInfo.requests.length > 0
          ? missingInfo.requests
          : [{
            slug: String(missingInfo?.slug || ''),
            netId: String(missingInfo?.netId || ''),
            missingIds: Array.isArray(missingInfo?.missingIds) ? missingInfo.missingIds : [],
          }];
        const requestsToFetch = groupedRequests
          .map((entry) => {
            const requestSlug = String(entry?.slug || '');
            const requestIds = Array.isArray(entry?.missingIds) ? entry.missingIds : [];
            const idsToFetch = requestIds.filter((qid) => {
              const key = `${requestSlug}|${responderLower}|${qid}`;
              return !this._priorResponseBackfillAttempted.has(key);
            });
            return {
              slug: requestSlug,
              idsToFetch,
            };
          })
          .filter((entry) => entry.idsToFetch.length > 0);
        if (requestsToFetch.length === 0) return false;

        requestsToFetch.forEach((entry) => {
          entry.idsToFetch.forEach((qid) => {
            const key = `${entry.slug}|${responderLower}|${qid}`;
            this._priorResponseBackfillAttempted.add(key);
            attemptedKeys.push(key);
          });
        });

        if (this._isMounted) {
          this.setState({ isHydratingPriorResponses: true });
        }

        for (const entry of requestsToFetch) {
          slug = entry.slug;
          // eslint-disable-next-line no-await-in-loop
          await this.props.refreshQuestionResponses(entry.idsToFetch, {
            slug: entry.slug,
            responder: responderLower,
          });
          // eslint-disable-next-line no-await-in-loop
          await readQuestionsCacheAsync(entry.slug);
          fetched = true;
        }
      } catch (error) {
        // Allow retries after transient fetch failures.
        attemptedKeys.forEach((key) => this._priorResponseBackfillAttempted.delete(key));
        surveyLog.warn('[SurveyQuestions] Prior-response backfill failed:', error);
      } finally {
        if (this._isMounted) {
          this.setState({ isHydratingPriorResponses: false });
        }
      }

      if (fetched && this._isMounted) {
        // Force the immediate follow-up pass to read the freshly written cache
        // even before parent cache nonces propagate down as props.
        this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
        this._rehydrateLocalCacheLastSig = '';
        this.rehydrateLocalCacheAnswersForRenderedIds();
      }
      return fetched;
    })();

    this._priorResponseBackfillInFlight = run.finally(() => {
      if (this._priorResponseBackfillInFlight) {
        this._priorResponseBackfillInFlight = null;
      }
    });
    return this._priorResponseBackfillInFlight;
  };

  rehydrateDraftForRenderedIds = (forceOverwrite = false) => {
    try {
      // Bail when Start Fresh suppresses prefill or when a submit error is present
      if (this.state && (this.state.suppressPrefill || this.state.submissionError)) return;

      const draft = this.loadDraft();
      if (!draft || (!draft.answers && !draft.baseline)) return;

      const surveyIndex =
        this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;

      const prevSlice =
        (this.state.surveysResponseState && this.state.surveysResponseState[surveyIndex]) || {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {}
        };

      const rendered = new Set(this.getHydrationQuestionIds());
      if (forceOverwrite) {
        const knownPileIds = Array.isArray(this.state?.pileQuestions)
          ? this.state.pileQuestions
          : [];
        knownPileIds.forEach((q) => {
          const qid = normalizeQuestionIdKey(q?.id);
          if (qid) rendered.add(qid);
        });
      }
      if (rendered.size === 0) return;

      const pendingStats =
        (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) ||
        { total: this.state.modifiedCount || 0 };
      const submittedStateActive = !!(
        this.state.submittedSinceLastEdit || this.state.submissionComplete
      );
      const allowOverwrite = shouldForceOverwriteDraftValues({
        forceOverwrite,
        isDirty: this.state.isDirty || (this.state.modifiedCount || 0) > 0,
        pendingTotal: pendingStats.total,
        submittedStateActive,
      });

      const nextSlice = {
        answers: { ...(prevSlice.answers || {}) },
        importance: { ...(prevSlice.importance || {}) },
        conviction: { ...(prevSlice.conviction || {}) },
        additionalComments: { ...(prevSlice.additionalComments || {}) }
      };
      const nextBaseline = this.state.editBaseline
        ? this.deepClone(this.state.editBaseline)
        : { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

      let changed = false;
      let baselineChanged = false;
      rendered.forEach((qid) => {
        const d = draft.answers?.[qid];
        if (d) {
          const currAnswer = nextSlice.answers[qid]?.value;
          const currAdd = nextSlice.additionalComments[qid]?.value;
          const hasCurrAnswer =
            currAnswer !== undefined && currAnswer !== null &&
            (Array.isArray(currAnswer) ? currAnswer.length > 0 : String(currAnswer).length > 0);
          const hasCurrAdd =
            currAdd !== undefined && currAdd !== null && String(currAdd).length > 0;
          const hasCurrImp = Object.prototype.hasOwnProperty.call(nextSlice.importance, qid);
          const hasCurrConv = Object.prototype.hasOwnProperty.call(nextSlice.conviction, qid);

          if ((!hasCurrAnswer || allowOverwrite) && d.value !== undefined) {
            nextSlice.answers[qid] = {
              ...(nextSlice.answers[qid] || {}),
              value: d.value,
              encrypted: !!d.answerEncrypted,
              encryptionAudience: this.normalizeResponseEncryptionAudience(d.answerEncryptionAudience),
              encryptionGateId: d.answerEncryptionGateId || null,
              audienceMode: this.normalizeFieldAudienceMode(d.answerAudienceMode, 'answer', d),
              ...(d.answerEncryptedPortion ? { encryptedPortion: d.answerEncryptedPortion } : {}),
            };
            changed = true;
          }
          if ((!hasCurrAdd || allowOverwrite) && d.additional !== undefined) {
            nextSlice.additionalComments[qid] = {
              ...(nextSlice.additionalComments[qid] || {}),
              value: d.additional,
              encrypted: !!d.additionalEncrypted,
              encryptionAudience: this.normalizeResponseEncryptionAudience(d.additionalEncryptionAudience),
              encryptionGateId: d.additionalEncryptionGateId || null,
              audienceMode: this.normalizeFieldAudienceMode(d.additionalAudienceMode, 'additional', d),
              ...(d.additionalEncryptedPortion ? { encryptedPortion: d.additionalEncryptedPortion } : {}),
            };
            if (this.normalizeFieldAudienceMode(d.additionalAudienceMode, 'additional', d) === 'inherit') {
              nextSlice.additionalComments[qid] = this.buildInheritedAdditionalFieldState(
                nextSlice.additionalComments[qid],
                nextSlice.answers[qid] || this.buildEmptyResponseFieldState(qid),
                qid
              );
            }
            changed = true;
          }
          if ((!hasCurrImp || allowOverwrite) && (d.importance !== undefined && d.importance !== null)) {
            nextSlice.importance[qid] = Number(d.importance);
            changed = true;
          }
          if ((!hasCurrConv || allowOverwrite) && (d.conviction !== undefined && d.conviction !== null)) {
            nextSlice.conviction[qid] = Number(d.conviction);
            changed = true;
          }
        }

        // Regression guard: restore baseline from draft independently of answer hydration.
        // Refresh often sees masked chain payload first; losing baseline here reintroduces Submit(1) ghosts.
        const b = draft.baseline?.[qid];
        if (b) {
          const currBaselineAnswer = nextBaseline.answers[qid]?.value;
          const currBaselineAdditional = nextBaseline.additionalComments[qid]?.value;
          const hasCurrBaselineAnswer =
            currBaselineAnswer !== undefined && currBaselineAnswer !== null &&
            (Array.isArray(currBaselineAnswer) ? currBaselineAnswer.length > 0 : String(currBaselineAnswer).length > 0);
          const hasCurrBaselineAdditional =
            currBaselineAdditional !== undefined && currBaselineAdditional !== null && String(currBaselineAdditional).length > 0;
          const hasCurrBaselineImp = Object.prototype.hasOwnProperty.call(nextBaseline.importance, qid);
          const hasCurrBaselineConv = Object.prototype.hasOwnProperty.call(nextBaseline.conviction, qid);

          if ((!hasCurrBaselineAnswer || allowOverwrite) && b.value !== undefined) {
            nextBaseline.answers[qid] = {
              ...(nextBaseline.answers[qid] || {}),
              value: b.value,
              encrypted: !!b.answerEncrypted,
              encryptionAudience: this.normalizeResponseEncryptionAudience(b.answerEncryptionAudience),
              encryptionGateId: b.answerEncryptionGateId || null,
              audienceMode: this.normalizeFieldAudienceMode(b.answerAudienceMode, 'answer', b),
              ...(b.answerEncryptedPortion ? { encryptedPortion: b.answerEncryptedPortion } : {}),
            };
            baselineChanged = true;
          }
          if ((!hasCurrBaselineAdditional || allowOverwrite) && b.additional !== undefined) {
            nextBaseline.additionalComments[qid] = {
              ...(nextBaseline.additionalComments[qid] || {}),
              value: b.additional,
              encrypted: !!b.additionalEncrypted,
              encryptionAudience: this.normalizeResponseEncryptionAudience(b.additionalEncryptionAudience),
              encryptionGateId: b.additionalEncryptionGateId || null,
              audienceMode: this.normalizeFieldAudienceMode(b.additionalAudienceMode, 'additional', b),
              ...(b.additionalEncryptedPortion ? { encryptedPortion: b.additionalEncryptedPortion } : {}),
            };
            if (this.normalizeFieldAudienceMode(b.additionalAudienceMode, 'additional', b) === 'inherit') {
              nextBaseline.additionalComments[qid] = this.buildInheritedAdditionalFieldState(
                nextBaseline.additionalComments[qid],
                nextBaseline.answers[qid] || this.buildEmptyResponseFieldState(qid),
                qid
              );
            }
            baselineChanged = true;
          }
          if ((!hasCurrBaselineImp || allowOverwrite) && (b.importance !== undefined && b.importance !== null)) {
            nextBaseline.importance[qid] = Number(b.importance);
            baselineChanged = true;
          }
          if ((!hasCurrBaselineConv || allowOverwrite) && (b.conviction !== undefined && b.conviction !== null)) {
            nextBaseline.conviction[qid] = Number(b.conviction);
            baselineChanged = true;
          }
        }
      });

      const updates = {};

      if (changed) {
        const arr = Array.isArray(this.state.surveysResponseState)
          ? [...this.state.surveysResponseState]
          : [];
        while (arr.length <= surveyIndex) {
          arr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });
        }
        arr[surveyIndex] = nextSlice;
        updates.surveysResponseState = arr;
      }
      if (baselineChanged) {
        updates.editBaseline = nextBaseline;
      }
      if (Object.keys(updates).length === 0) return;

      this.setState(updates, () => {
        this.updateJsonPreview && this.updateJsonPreview();
      });
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };


  // Reset live form state on account changes (before loading new account data)
  resetFormStateForAccountChange = (callback) => {
    try {
      // persist current draft for anon→account migration paths
      // SYNC CALL ensures draft is saved before state is cleared
      this.persistDraft();
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    try {
      if (this._persistTimer) {
        clearTimeout(this._persistTimer);
        this._persistTimer = null;
      }
    } catch (e) { surveyLog.warn('SurveyTool: cleanup', e); }

    const initial = this.initializeSurveyResponseState();

    this.setState({
      surveysResponseState: Array.isArray(initial) ? initial : [],
      isEditing: false,
      submissionError: '',
      submissionComplete: false,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
      submitProgress: 0,
      userHasResponse: false,
      userAnswers: null,
      isDirty: false,
      modifiedCount: 0,
      hasEncryptedChanges: false,
      editBaseline: this.deepClone(initial[this.props.surveyIndex || 0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
      isLoadingResponse: true,
    }, () => {
      if (callback) callback();
    });
  };


  // Edit tracking helpers
  deepClone = (obj) => {
    try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
  };

  valuesEqual = (a, b) => {
    // Normalize empties
    const norm = (v) => (v === undefined || v === '') ? null : v;

    // Arrays: compare order-sensitive (checkbox order is stable)
    if (Array.isArray(a) || Array.isArray(b)) {
      const aa = Array.isArray(a) ? a : [];
      const bb = Array.isArray(b) ? b : [];
      if (aa.length !== bb.length) return false;
      return JSON.stringify(aa) === JSON.stringify(bb);
    }

    // Numbers vs strings: compare numerically if either is a number-like
    const an = Number(a); const bn = Number(b);
    const aNumLike = !Number.isNaN(an) && a !== null && a !== '' && typeof a !== 'object';
    const bNumLike = !Number.isNaN(bn) && b !== null && b !== '' && typeof b !== 'object';
    if (aNumLike || bNumLike) return Number(a) === Number(b);

    return String(norm(a)) === String(norm(b));
  };

  computeModifiedQuestionsCount = (baselineSlice, currentSlice) => {
    if (!baselineSlice || !currentSlice) return 0;

    const addNormalizedIds = (idsSet, source) => {
      Object.keys(source || {}).forEach((rawKey) => {
        const normalized = normalizeQuestionIdKey(rawKey);
        if (normalized) idsSet.add(normalized);
      });
    };
    const pickField = (source, qid) => {
      if (!source || typeof source !== 'object') return {};
      if (source[qid] && typeof source[qid] === 'object') return source[qid];
      const rawKey = Object.keys(source).find((k) => normalizeQuestionIdKey(k) === qid);
      return (rawKey && source[rawKey] && typeof source[rawKey] === 'object') ? source[rawKey] : {};
    };
    const pickNumber = (source, qid) => {
      if (!source || typeof source !== 'object') return null;
      if (Object.prototype.hasOwnProperty.call(source, qid)) {
        const n = Number(source[qid]);
        return Number.isFinite(n) ? n : null;
      }
      const rawKey = Object.keys(source).find((k) => normalizeQuestionIdKey(k) === qid);
      if (!rawKey) return null;
      const n = Number(source[rawKey]);
      return Number.isFinite(n) ? n : null;
    };

    const idsFromSlices = new Set();
    addNormalizedIds(idsFromSlices, baselineSlice.answers);
    addNormalizedIds(idsFromSlices, currentSlice.answers);
    addNormalizedIds(idsFromSlices, baselineSlice.additionalComments);
    addNormalizedIds(idsFromSlices, currentSlice.additionalComments);
    addNormalizedIds(idsFromSlices, baselineSlice.importance);
    addNormalizedIds(idsFromSlices, currentSlice.importance);
    addNormalizedIds(idsFromSlices, baselineSlice.conviction);
    addNormalizedIds(idsFromSlices, currentSlice.conviction);

    const scopedIds = this.getEditTrackingQuestionIds();
    const ids = scopedIds.size > 0 ? new Set(scopedIds) : idsFromSlices;

    let count = 0;
    ids.forEach((qId) => {
      const bAns = pickField(baselineSlice.answers, qId);
      const cAns = pickField(currentSlice.answers, qId);
      const bAdd = pickField(baselineSlice.additionalComments, qId);
      const cAdd = pickField(currentSlice.additionalComments, qId);
      const bImp = pickNumber(baselineSlice.importance, qId);
      const cImp = pickNumber(currentSlice.importance, qId);
      const bConv = pickNumber(baselineSlice.conviction, qId);
      const cConv = pickNumber(currentSlice.conviction, qId);

      let changed = false;
      if (!this.valuesEqual(bAns.value, cAns.value)) changed = true;
      if (!this.valuesEqual(bAdd.value, cAdd.value)) changed = true;
      if (bImp !== cImp) changed = true;
      if (bConv !== cConv) changed = true;
      if (!!bAns.encrypted !== !!cAns.encrypted) changed = true;
      if (!!bAdd.encrypted !== !!cAdd.encrypted) changed = true;

      if (changed) count++;
    });
    return count;
  };

  /**
     * Clear pending edits (the “X”).
     * Logged-in  → revert to latest on-chain snapshot from local caches (or userAnswers if present).
     * Anonymous  → revert to empty slice for the rendered questions.
     * Does NOT replace editBaseline; it only resets the live slice so pending → 0.
     */
  handleRevertPendingChanges = () => {
    try {
      const surveyIndex =
        this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
      const isLoggedIn = !!(this.props.loginComplete && this.props.account);

      // 1) Build the baseline we want to revert to
      let baselineSlice = this.state.editBaseline;

      if (!baselineSlice && isLoggedIn) {
        if (this.state.userAnswers) {
          baselineSlice = this.buildSliceFromUserAnswers(this.state.userAnswers);
        } else {
          baselineSlice = this.buildSliceFromLocalCache();
        }
      }

      if (!baselineSlice) {
        baselineSlice = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      }

      // 2) Restore all questions from baseline to prevent phantom deletes
      const nextSlice = {
        answers: this.deepClone(baselineSlice.answers || {}),
        importance: { ...(baselineSlice.importance || {}) },
        conviction: { ...(baselineSlice.conviction || {}) },
        additionalComments: this.deepClone(baselineSlice.additionalComments || {})
      };

      // Ensure rendered IDs have at least empty state structures to prevent UI crashes
      const renderedIds = this.getCurrentRenderedQuestionIds();
      renderedIds.forEach((qid) => {
        if (!nextSlice.answers[qid]) {
          nextSlice.answers[qid] = this.buildEmptyResponseFieldState(qid);
        }
        if (!nextSlice.additionalComments[qid]) {
          nextSlice.additionalComments[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
        }
      });

      // 3) Apply slice; do not overwrite editBaseline; reset pending flags
      const arr = Array.isArray(this.state.surveysResponseState) ? [...this.state.surveysResponseState] : [];
      while (arr.length <= surveyIndex) arr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });
      arr[surveyIndex] = nextSlice;

      this.setState(
        {
          surveysResponseState: arr,
          isEditing: true,
          displayAnswerMode: false,
          startFresh: !isLoggedIn,
          isDirty: false,
          modifiedCount: 0,
          hasEncryptedChanges: false,
          submissionError: '',
        },
        () => {
          if (typeof this.clearDraft === 'function') this.clearDraft();
          this.recalculateEditStats && this.recalculateEditStats();
          this.updateJsonPreview && this.updateJsonPreview();
        }
      );
    } catch (e) {
      surveyLog.warn('[SurveyQuestions] handleRevertPendingChanges failed:', e);
    }
  };


  // Build baseline/live slice from server response.
  // Sets encrypted: true for any field with prior encryption.
  // Intelligently merges decrypted values from prevSlice if envelope matches.
  buildSliceFromUserAnswers = (userAnswers, prevSlice = null) => {
    const slice = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    if (!userAnswers) return slice;

    const parseVal = (v) => {
      try {
        if (typeof v === 'string' && (v.startsWith('[') || v.startsWith('{'))) return JSON.parse(v);
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      return v;
    };

    const list = Array.isArray(userAnswers.responses) ? userAnswers.responses : [userAnswers];
    list.forEach((r) => {
      const qid = normalizeQuestionIdKey(r?.questionID || r?.questionId);
      if (!qid) return;

      const ans = r.answer || {};
      const add = r.additional || {};

      const prevAns = prevSlice?.answers?.[qid];
      const ansIsMasked = ans.value === '*' && (ans.encrypted || ans.encryptedPortion);
      const ansPrevDecrypted = prevAns && prevAns.value !== '*' && prevAns.value !== undefined && prevAns.value !== null;
      const ansEnvMatches = prevAns && areEnvelopesEquivalent(
        ans.encryptedPortion,
        prevAns.encryptedPortion,
        ans.encrypted,
        prevAns.encrypted
      );

      const answerAudience = this.normalizeResponseEncryptionAudience(
        ans.encryptionAudience || (
          (ans.encrypted || ans.encryptedPortion)
            ? this.getDefaultResponseEncryptionAudienceForQid(qid)
            : 'self'
        ),
        qid
      );
      slice.answers[qid] = {
        value: (ansIsMasked && ansPrevDecrypted && ansEnvMatches) ? prevAns.value : parseVal(ans.value),
        encrypted: !!(ans.encrypted || ans.encryptedPortion),
        encryptionAudience: answerAudience,
        encryptionGateId: answerAudience === 'gate'
          ? this.resolveFieldEncryptionGateId({ ...ans, encryptionAudience: answerAudience }, qid, 'answer')
          : null,
        audienceMode: 'explicit',
        hash: ans.hash || '',
        encryptedPortion: ans.encryptedPortion || '',
        ...(ansEnvMatches && prevAns.zkSalt ? { zkSalt: prevAns.zkSalt } : {})
      };

      const convictionValue = getConvictionFromResponse(r);
      if (convictionValue !== null) {
        slice.conviction[qid] = convictionValue;
      }
      const importanceValue = getImportanceFromResponse(r);
      if (importanceValue !== null) {
        slice.importance[qid] = importanceValue;
      }

      const prevAdd = prevSlice?.additionalComments?.[qid];
      const addIsMasked = add.value === '*' && (add.encrypted || add.encryptedPortion);
      const addPrevDecrypted = prevAdd && prevAdd.value !== '*' && prevAdd.value !== undefined && prevAdd.value !== null;
      const addEnvMatches = prevAdd && areEnvelopesEquivalent(
        add.encryptedPortion,
        prevAdd.encryptedPortion,
        add.encrypted,
        prevAdd.encrypted
      );

      const additionalAudienceMode = this.normalizeFieldAudienceMode(add.audienceMode, 'additional', add);
      const additionalAudience = this.normalizeResponseEncryptionAudience(
        add.encryptionAudience || (
          (add.encrypted || add.encryptedPortion)
            ? this.getDefaultResponseEncryptionAudienceForQid(qid)
            : 'self'
        ),
        qid
      );
      let nextAdditional = {
        value: (addIsMasked && addPrevDecrypted && addEnvMatches) ? prevAdd.value : parseVal(add.value),
        encrypted: !!(add.encrypted || add.encryptedPortion),
        encryptionAudience: additionalAudience,
        encryptionGateId: additionalAudience === 'gate'
          ? this.resolveFieldEncryptionGateId({ ...add, encryptionAudience: additionalAudience }, qid, 'additional')
          : null,
        audienceMode: additionalAudienceMode,
        hash: add.hash || '',
        encryptedPortion: add.encryptedPortion || '',
        ...(addEnvMatches && prevAdd.zkSalt ? { zkSalt: prevAdd.zkSalt } : {})
      };
      if (additionalAudienceMode === 'inherit') {
        nextAdditional = this.buildInheritedAdditionalFieldState(nextAdditional, slice.answers[qid], qid);
      }
      slice.additionalComments[qid] = nextAdditional;
    });

    return slice;
  };

  // Check if a slice is effectively empty
  isSliceEmpty = (slice) => {
    if (!slice) return true;
    const hasVal = (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).length > 0);
    if (Object.values(slice.answers || {}).some(a => hasVal(a?.value))) return false;
    if (Object.values(slice.additionalComments || {}).some(a => hasVal(a?.value))) return false;
    if (Object.keys(slice.importance || {}).length > 0) return false;
    if (Object.keys(slice.conviction || {}).length > 0) return false;
    return true;
  };


  // Prefill multi-question draft from prior survey response.
  // Hydrates encrypted: true for any previously encrypted field.
  // Synchronizes state and baseline cleanly to prevent ghost edits.
  prefillSurveyResponses = (userAnswers) => {
    if (!userAnswers || !Array.isArray(userAnswers.responses)) return;

    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);

    this.setState((prev) => {
      const curr =
        prev.surveysResponseState?.[surveyIndex] ||
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      const hasVal = (v) =>
        v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).length > 0);

      const allowOverwrite = !prev.isDirty && !prev.submissionComplete;

      const nextStateArr = Array.isArray(prev.surveysResponseState) ? [...prev.surveysResponseState] : [];
      while (nextStateArr.length <= surveyIndex) {
        nextStateArr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });
      }

      const nextSlice = {
        answers: { ...(nextStateArr[surveyIndex]?.answers || {}) },
        importance: { ...(nextStateArr[surveyIndex]?.importance || {}) },
        conviction: { ...(nextStateArr[surveyIndex]?.conviction || {}) },
        additionalComments: { ...(nextStateArr[surveyIndex]?.additionalComments || {}) },
      };

      userAnswers.responses.forEach((r) => {
        const qid = normalizeQuestionIdKey(r?.questionID || r?.questionId);
        if (!qid) return;
        const ans = r.answer || {};
        const add = r.additional || {};

        const prevAns = curr.answers?.[qid];
        const ansIsMasked = ans.value === '*' && (ans.encrypted || ans.encryptedPortion);
        const ansPrevDecrypted = prevAns && prevAns.value !== '*' && prevAns.value !== undefined && prevAns.value !== null;
        const ansEnvMatches = prevAns && areEnvelopesEquivalent(
          ans.encryptedPortion,
          prevAns.encryptedPortion,
          ans.encrypted,
          prevAns.encrypted
        );

        if (!hasVal(prevAns?.value) || allowOverwrite) {
          const answerAudience = this.normalizeResponseEncryptionAudience(
            ans.encryptionAudience || (
              (ans.encrypted || ans.encryptedPortion)
                ? this.getDefaultResponseEncryptionAudienceForQid(qid)
                : 'self'
            ),
            qid
          );
          nextSlice.answers[qid] = {
            value: (ansIsMasked && ansPrevDecrypted && ansEnvMatches) ? prevAns.value : this.parseAnswerValue(ans.value),
            encrypted: !!(ans.encrypted || ans.encryptedPortion),
            encryptionAudience: answerAudience,
            encryptionGateId: answerAudience === 'gate'
              ? this.resolveFieldEncryptionGateId({ ...ans, encryptionAudience: answerAudience }, qid, 'answer')
              : null,
            audienceMode: 'explicit',
            hash: ans.hash || '',
            encryptedPortion: ans.encryptedPortion || '',
            ...(ansEnvMatches && prevAns?.zkSalt ? { zkSalt: prevAns.zkSalt } : {})
          };
        }

        const convictionValue = getConvictionFromResponse(r);
        if ((!(qid in curr.conviction) || allowOverwrite) && convictionValue !== null) {
          nextSlice.conviction[qid] = convictionValue;
        }
        const importanceValue = getImportanceFromResponse(r);
        if ((!(qid in curr.importance) || allowOverwrite) && importanceValue !== null) {
          nextSlice.importance[qid] = importanceValue;
        }

        const prevAdd = curr.additionalComments?.[qid];
        const addIsMasked = add.value === '*' && (add.encrypted || add.encryptedPortion);
        const addPrevDecrypted = prevAdd && prevAdd.value !== '*' && prevAdd.value !== undefined && prevAdd.value !== null;
        const addEnvMatches = prevAdd && areEnvelopesEquivalent(
          add.encryptedPortion,
          prevAdd.encryptedPortion,
          add.encrypted,
          prevAdd.encrypted
        );

        if (!hasVal(prevAdd?.value) || allowOverwrite) {
          const additionalAudienceMode = this.normalizeFieldAudienceMode(add.audienceMode, 'additional', add);
          const additionalAudience = this.normalizeResponseEncryptionAudience(
            add.encryptionAudience || (
              (add.encrypted || add.encryptedPortion)
                ? this.getDefaultResponseEncryptionAudienceForQid(qid)
                : 'self'
            ),
            qid
          );
          let nextAdditional = {
            value: (addIsMasked && addPrevDecrypted && addEnvMatches) ? prevAdd.value : this.parseAnswerValue(add.value),
            encrypted: !!(add.encrypted || add.encryptedPortion),
            encryptionAudience: additionalAudience,
            encryptionGateId: additionalAudience === 'gate'
              ? this.resolveFieldEncryptionGateId({ ...add, encryptionAudience: additionalAudience }, qid, 'additional')
              : null,
            audienceMode: additionalAudienceMode,
            hash: add.hash || '',
            encryptedPortion: add.encryptedPortion || '',
            ...(addEnvMatches && prevAdd?.zkSalt ? { zkSalt: prevAdd.zkSalt } : {})
          };
          if (additionalAudienceMode === 'inherit') {
            nextAdditional = this.buildInheritedAdditionalFieldState(nextAdditional, nextSlice.answers[qid], qid);
          }
          nextSlice.additionalComments[qid] = nextAdditional;
        }
      });

      nextStateArr[surveyIndex] = nextSlice;

      const baseline = this.buildSliceFromUserAnswers(userAnswers, prev.editBaseline || curr);

      return {
        surveysResponseState: nextStateArr,
        ...(!prev.submissionComplete ? { editBaseline: baseline } : {})
      };
    }, () => {
      this.updateJsonPreview();
      this.recalculateEditStats();
    });
  };


  buildSliceFromLocalCache = () => {
    try {
      // Use the same slug resolution as drafts/decrypt (single-Q aware)
      const context = resolveResponseHydrationContext(this.props, this._getEffectiveDraftSlug());
      const slug = context.sessionSlug || '';
      const extraSlugs = this.props?.minifiedMode === 'pile'
        ? getExtraQuestionReadSlugs(this.props, slug)
        : [];
      const scopeSlugs = [slug, ...extraSlugs];
      const netId = context.networkIdStr;
      const acct = (this.props?.account || '').toLowerCase();
      const rendered = this.getCurrentRenderedQuestionIds();
      const renderedSignature = buildRenderedIdsSignature(rendered);
      const memoKey = [
        scopeSlugs.map((value) => normalizeSessionSlugValue(value)).join(','),
        netId,
        acct,
        renderedSignature,
        Number(this.props.questionsCacheNonce || 0),
        Number(this.props.questionResponsesNonce || 0),
      ].join('|');
      if (
        this._localCacheSliceMemo &&
        this._localCacheSliceMemo.hasValue === true &&
        this._localCacheSliceMemo.key === memoKey
      ) {
        return this._localCacheSliceMemo.value;
      }

      const memoize = (value) => {
        this._localCacheSliceMemo = { key: memoKey, value, hasValue: true };
        return value;
      };

      if (!netId || !acct) return memoize(null);

      const mergedQuestionResponses = {};
      scopeSlugs.forEach((scopeSlug) => {
        let qc = readQuestionsCache(scopeSlug);
        if (!qc || typeof qc !== 'object') qc = {};
        const net = qc?.[netId];
        mergeQuestionResponses(mergedQuestionResponses, net?.questionResponses || {});
      });
      if (Object.keys(mergedQuestionResponses).length === 0) return memoize(null);

      const slice = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      DEBUG_PREFILL && surveyLog.log('[Survey][buildSlice] Building for rendered IDs:', rendered);

      rendered.forEach((qid) => {
        const map = mergedQuestionResponses?.[qid];
        if (!map) return;
        const raw = map[acct];
        if (!raw) return;

        let resp = raw;
        try {
          if (typeof resp === 'string') { resp = JSON.parse(resp); }
        } catch { resp = null; }
        if (!resp || !resp.answer || !resp.additional) {
          DEBUG_PREFILL && surveyLog.log(`[Survey][buildSlice] skipping qid=${qid}, malformed response`, { raw });
          return;
        }

        const answerEncrypted = !!(resp.answer.encrypted || resp.answer.encryptedPortion);
        const additionalEncrypted = !!(resp.additional.encrypted || resp.additional.encryptedPortion);

        // Keep masked '*' when encrypted; otherwise prefill plaintext
        slice.answers[qid] = {
          value: answerEncrypted ? '*' : this.parseAnswerValue(resp.answer.value),
          encrypted: !!answerEncrypted,
          encryptionAudience: this.normalizeResponseEncryptionAudience(
            resp.answer.encryptionAudience || (answerEncrypted ? 'gate' : 'self'),
            qid
          ),
          encryptionGateId: answerEncrypted
            ? this.resolveFieldEncryptionGateId(resp.answer || {}, qid, 'answer')
            : null,
          audienceMode: 'explicit',
          hash: resp.answer.hash || '',
          encryptedPortion: resp.answer.encryptedPortion || ''
        };

        const convictionValue = getConvictionFromResponse(resp);
        if (convictionValue !== null) {
          slice.conviction[qid] = convictionValue;
        }
        const importanceValue = getImportanceFromResponse(resp);
        if (importanceValue !== null) {
          slice.importance[qid] = importanceValue;
        }

        let additionalState = {
          value: additionalEncrypted ? '*' : this.parseAnswerValue(resp.additional.value),
          encrypted: !!additionalEncrypted,
          encryptionAudience: this.normalizeResponseEncryptionAudience(
            resp.additional.encryptionAudience || (additionalEncrypted ? 'gate' : 'self'),
            qid
          ),
          encryptionGateId: additionalEncrypted
            ? this.resolveFieldEncryptionGateId(resp.additional || {}, qid, 'additional')
            : null,
          audienceMode: this.normalizeFieldAudienceMode(
            resp.additional?.audienceMode,
            'additional',
            resp.additional || {}
          ),
          hash: resp.additional.hash || '',
          encryptedPortion: resp.additional.encryptedPortion || ''
        };
        if (
          this.normalizeFieldAudienceMode(
            resp.additional?.audienceMode,
            'additional',
            resp.additional || {}
          ) === 'inherit'
        ) {
          additionalState = this.buildInheritedAdditionalFieldState(additionalState, slice.answers[qid], qid);
        }
        slice.additionalComments[qid] = additionalState;
        DEBUG_PREFILL && surveyLog.log(`[Survey][buildSlice] qid=${qid}`, {
          answer: slice.answers[qid],
          additional: slice.additionalComments[qid],
          conviction: slice.conviction[qid],
          importance: slice.importance[qid],
        });
      });

      return memoize(slice);
    } catch (e) {
      this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
      DEBUG_PREFILL && surveyLog.error('[Survey][buildSlice] Error:', e);
      return null;
    }
  };


  rehydrateLocalCacheAnswersForRenderedIds = async (callback) => {
    try {
      // Bail when Start Fresh suppresses prefill, when a submit error is present,
      // OR when we have a completed submission (optimistic state) to prevent stale cache overwrite.
      if (this.state && (this.state.suppressPrefill || this.state.submissionError || this.state.submissionComplete)) {
        if (callback) callback();
        return;
      }

      const surveyIndex =
        this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
      const renderedIds = this.getHydrationQuestionIds();
      const hydrationSig = this.buildLocalCacheHydrationSignature(surveyIndex, renderedIds);
      if (hydrationSig && this._rehydrateLocalCacheLastSig === hydrationSig) {
        bumpSurveyPerfCounter('noopSkipCount');
        if (callback) callback();
        return;
      }

      const baseSlice =
        (this.state.surveysResponseState && this.state.surveysResponseState[surveyIndex]) ||
        { answers:{}, importance:{}, conviction:{}, additionalComments:{} };

      const cacheSlice = await this.buildSliceFromLocalCache();
      DEBUG_PREFILL && surveyLog.log('[Survey][rehydrateLocal] built cache slice:', { cacheSlice });
      if (!cacheSlice) {
        // Keep retries available when backfill fails transiently under the same signature.
        this._rehydrateLocalCacheLastSig = '';
        void this.ensurePriorResponsesForRenderedIds();
        if (callback) callback();
        return;
      }
      this._rehydrateLocalCacheLastSig = hydrationSig;

      const next = {
        answers: { ...(baseSlice.answers || {}) },
        importance: { ...(baseSlice.importance || {}) },
        conviction: { ...(baseSlice.conviction || {}) },
        additionalComments: { ...(baseSlice.additionalComments || {}) },
      };

      // Keep draft envelope context in play so cache hydration can avoid re-masking
      // decrypted-empty values during rapid pile navigation.
      const draftAnswersByQid = {};
      try {
        const draft = this.loadDraft();
        const rawAnswers = (draft && typeof draft.answers === 'object') ? draft.answers : {};
        Object.keys(rawAnswers || {}).forEach((rawQid) => {
          const qid = normalizeQuestionIdKey(rawQid);
          if (!qid || draftAnswersByQid[qid]) return;
          const entry = rawAnswers[rawQid];
          if (entry && typeof entry === 'object') draftAnswersByQid[qid] = entry;
        });
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      // Also build/update baseline so cached answers don't count as pending edits
      let nextBaseline = this.state.editBaseline
        ? this.deepClone(this.state.editBaseline)
        : { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

      let changed = false;
      let baselineChanged = false;

      renderedIds.forEach((qid) => {
        const cAns = cacheSlice.answers?.[qid];
        const cAdd = cacheSlice.additionalComments?.[qid];
        const cImp = cacheSlice.importance?.[qid];
        const cConv = cacheSlice.conviction?.[qid];
        const draftForQid = draftAnswersByQid[qid] || {};
        const draftAnswerEnv = String(draftForQid.answerEncryptedPortion || '');
        const draftAdditionalEnv = String(draftForQid.additionalEncryptedPortion || '');
        const cacheAnswerEnv = String(cAns?.encryptedPortion || '');
        const cacheAdditionalEnv = String(cAdd?.encryptedPortion || '');
        const cAnsEffective = (
          cAns &&
          cAns.value === '*' &&
          draftForQid.value === '' &&
          areEnvelopesEquivalent(draftAnswerEnv, cacheAnswerEnv, draftForQid.answerEncrypted, cAns.encrypted)
        ) ? { ...cAns, value: '' } : cAns;
        const cAddEffective = (
          cAdd &&
          cAdd.value === '*' &&
          draftForQid.additional === '' &&
          areEnvelopesEquivalent(draftAdditionalEnv, cacheAdditionalEnv, draftForQid.additionalEncrypted, cAdd.encrypted)
        ) ? { ...cAdd, value: '' } : cAdd;
        const canReplaceMaskedAnswerWithDraftEmpty =
          cAnsEffective &&
          cAnsEffective.value === '' &&
          next.answers[qid]?.value === '*' &&
          areEnvelopesEquivalent(
            next.answers[qid]?.encryptedPortion,
            cAnsEffective.encryptedPortion,
            next.answers[qid]?.encrypted,
            cAnsEffective.encrypted
          );
        const canReplaceMaskedAdditionalWithDraftEmpty =
          cAddEffective &&
          cAddEffective.value === '' &&
          next.additionalComments[qid]?.value === '*' &&
          areEnvelopesEquivalent(
            next.additionalComments[qid]?.encryptedPortion,
            cAddEffective.encryptedPortion,
            next.additionalComments[qid]?.encrypted,
            cAddEffective.encrypted
          );
        const canReplaceMaskedBaselineAnswerWithDraftEmpty =
          cAnsEffective &&
          cAnsEffective.value === '' &&
          nextBaseline.answers[qid]?.value === '*' &&
          areEnvelopesEquivalent(
            nextBaseline.answers[qid]?.encryptedPortion,
            cAnsEffective.encryptedPortion,
            nextBaseline.answers[qid]?.encrypted,
            cAnsEffective.encrypted
          );
        const canReplaceMaskedBaselineAdditionalWithDraftEmpty =
          cAddEffective &&
          cAddEffective.value === '' &&
          nextBaseline.additionalComments[qid]?.value === '*' &&
          areEnvelopesEquivalent(
            nextBaseline.additionalComments[qid]?.encryptedPortion,
            cAddEffective.encryptedPortion,
            nextBaseline.additionalComments[qid]?.encrypted,
            cAddEffective.encrypted
          );

        // Hydrate state (fill empty)
        if (cAnsEffective && (canReplaceMaskedAnswerWithDraftEmpty || next.answers[qid]?.value === undefined || (next.answers[qid]?.value === '' && !next.answers[qid]?.encryptedPortion))) {
          next.answers[qid] = { ...(next.answers[qid] || {}), ...cAnsEffective };
          changed = true;
          DEBUG_PREFILL && surveyLog.log(`[Survey][rehydrateLocal] Hydrated answer for qid=${qid}`, { fromCache: cAnsEffective });
        }
        if (cAddEffective && (canReplaceMaskedAdditionalWithDraftEmpty || next.additionalComments[qid]?.value === undefined || (next.additionalComments[qid]?.value === '' && !next.additionalComments[qid]?.encryptedPortion))) {
          next.additionalComments[qid] = { ...(next.additionalComments[qid] || {}), ...cAddEffective };
          changed = true;
          DEBUG_PREFILL && surveyLog.log(`[Survey][rehydrateLocal] Hydrated additional for qid=${qid}`, { fromCache: cAddEffective });
        }
        if (cImp !== undefined && cImp !== null &&
            !Object.prototype.hasOwnProperty.call(next.importance, qid)) {
          next.importance[qid] = Number(cImp);
          changed = true;
          DEBUG_PREFILL && surveyLog.log(`[Survey][rehydrateLocal] Hydrated importance for qid=${qid}`, { fromCache: cImp });
        }
        if (cConv !== undefined && cConv !== null &&
            !Object.prototype.hasOwnProperty.call(next.conviction, qid)) {
          next.conviction[qid] = Number(cConv);
          changed = true;
          DEBUG_PREFILL && surveyLog.log(`[Survey][rehydrateLocal] Hydrated conviction for qid=${qid}`, { fromCache: cConv });
        }

        // Hydrate baseline (fill empty)
        // This ensures that if we just loaded these answers from cache, they are considered "baseline" (not dirty)
        if (cAnsEffective && (canReplaceMaskedBaselineAnswerWithDraftEmpty || nextBaseline.answers[qid]?.value === undefined || (nextBaseline.answers[qid]?.value === '' && !nextBaseline.answers[qid]?.encryptedPortion))) {
          nextBaseline.answers[qid] = { ...(nextBaseline.answers[qid] || {}), ...cAnsEffective };
          baselineChanged = true;
        }
        if (cAddEffective && (canReplaceMaskedBaselineAdditionalWithDraftEmpty || nextBaseline.additionalComments[qid]?.value === undefined || (nextBaseline.additionalComments[qid]?.value === '' && !nextBaseline.additionalComments[qid]?.encryptedPortion))) {
          nextBaseline.additionalComments[qid] = { ...(nextBaseline.additionalComments[qid] || {}), ...cAddEffective };
          baselineChanged = true;
        }
        if (cImp !== undefined && cImp !== null &&
            !Object.prototype.hasOwnProperty.call(nextBaseline.importance, qid)) {
          nextBaseline.importance[qid] = Number(cImp);
          baselineChanged = true;
        }
        if (cConv !== undefined && cConv !== null &&
            !Object.prototype.hasOwnProperty.call(nextBaseline.conviction, qid)) {
          nextBaseline.conviction[qid] = Number(cConv);
          baselineChanged = true;
        }
      });

      if (!changed && !baselineChanged) {
        DEBUG_PREFILL && surveyLog.log('[Survey][rehydrateLocal] No changes to apply.');
        void this.ensurePriorResponsesForRenderedIds();
        if (callback) callback();
        return;
      }

      const arr = Array.isArray(this.state.surveysResponseState)
        ? [...this.state.surveysResponseState]
        : [];
      while (arr.length <= surveyIndex) {
        arr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });
      }
      if (changed) arr[surveyIndex] = next;

      const updates = {};
      if (changed) updates.surveysResponseState = arr;
      if (baselineChanged) updates.editBaseline = nextBaseline;

      this.setState(updates, () => {
        this.updateJsonPreview && this.updateJsonPreview();
        // Recalculate immediately to ensure 'Submit (X)' is accurate immediately
        this.recalculateEditStats && this.recalculateEditStats();
        void this.ensurePriorResponsesForRenderedIds();
        if (callback) callback();
      });
    } catch (e) {
      this._rehydrateLocalCacheLastSig = '';
      DEBUG_PREFILL && surveyLog.error('[Survey][rehydrateLocal] Error:', e);
      if (callback) callback();
    }
  };


  toggleAutoDecrypt = () => {
    // Guard: auto-decrypt is disabled for wagmi/porto providers
    if (this.isAutoDecryptBlocked()) {
      this._autoDecQueue = [];
      this._autoDecProcessing = false;
      this._autoDecryptMaskedAttemptSignature = {};
      this.clearAutoDecryptSweepScheduling();
      this.setState({ autoDecryptEnabled: false, decryptingByKey: {} });
      return;
    }
    this.setState(
      (prev) => ({ autoDecryptEnabled: !prev.autoDecryptEnabled }),
      () => {
        if (!this.state.autoDecryptEnabled) {
          this._autoDecQueue = [];
          this._autoDecProcessing = false;
          this._autoDecryptMaskedAttemptSignature = {};
          this.clearAutoDecryptSweepScheduling();
          if (Object.keys(this.state.decryptingByKey || {}).length > 0) {
            this.setState({ decryptingByKey: {} });
          }
          return;
        }
        this.queueAutoDecryptVisibleSweep('toggle-enabled');
      }
    );
  };

  tryAutoDecryptOnce = (questionId, field) => {
    const key = `${questionId}:${field}`;

    // simple in-memory dedupe; do not mark as "attempted" until we actually decrypt successfully
    if (this._autoDecQueueDedup?.has(key)) return;
    if (!this._autoDecQueueDedup) this._autoDecQueueDedup = new Set();
    this._autoDecQueueDedup.add(key);

    this.setManagedTimeout(() => {
      (async () => {
        try {
          if (this.props.loginComplete && this.props.account) {
            await this.handleDecryptQuestionAnswer(questionId, field);
            // success will be marked by the existing success path in maybeAutoDecryptVisibleFields()
          }
        } finally {
          this._autoDecQueueDedup?.delete(key);
        }
      })();
    }, 0);
  };


  getLatestQuestionResponse = async (responder, questionId, networkID, questionsCache) => {
    const slug = this._getEffectiveDraftSlug();
    const strNet = String(networkID || '');

    let latest = null;
    try {
      latest = await contractScripts.getResponse(this.props.provider, responder, questionId, slug);
      if (latest) {
        const addrLower = String(responder || '').toLowerCase();

        // Re-read after await to avoid overwriting concurrent cache writes.
        let freshCache = ensureQuestionsNet(await readQuestionsCacheAsync(slug), strNet);

        // ensure scaffolding
        freshCache[strNet] = freshCache[strNet] || {};
        freshCache[strNet].questionResponses = freshCache[strNet].questionResponses || {};
        freshCache[strNet].questionResponses[questionId] =
          freshCache[strNet].questionResponses[questionId] || {};
        freshCache[strNet].questionResponsesMeta = freshCache[strNet].questionResponsesMeta || {};
        freshCache[strNet].questionResponsesMeta[questionId] =
          freshCache[strNet].questionResponsesMeta[questionId] || {};

        // Recency guard (only replace if strictly newer by (bn, li))
        const prev = freshCache[strNet].questionResponsesMeta[questionId][addrLower] || { bn: 0, li: 0 };
        const bn = latest?.blockNumber ?? 0;
        const li = latest?.logIndex ?? 0;
        const isStale = (bn < prev.bn) || (bn === prev.bn && li <= prev.li);
        if (!isStale) {
          freshCache[strNet].questionResponses[questionId][addrLower] = latest;
          freshCache[strNet].questionResponsesMeta[questionId][addrLower] = { bn, li };
          await writeQuestionsCache(slug, freshCache);
        }
        return latest;
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    return latest;
  };



  /** Prefer the latest survey response from chain. */
  getLatestSurveyResponse = async (responder, surveyId) => {
    try {
      const latest = await this.getSurveyResponse(responder, surveyId);
      return latest || null;
    } catch (e) {
      return null;
    }
  };


  loadBookmarks = async () => {
    try {
      const slug = resolveEffectiveSlug(this.props);
      let obj = peekCacheSync('bookmarksCache', slug);
      if (obj == null) {
        obj = await readCache('bookmarksCache', slug);
      }
      if (!obj || typeof obj !== 'object') {
        this.setState({ bookmarkedQuestions: new Set() });
        return;
      }
      const list = Array.isArray(obj?.questions) ? obj.questions : [];
      this.setState({ bookmarkedQuestions: new Set(list) });
    } catch (error) {
      surveyLog.error('[SurveyQuestions] Error reading bookmarksCache:', error);
      this.setState({ bookmarkedQuestions: new Set() });
    }
  };



  handleBookmarkToggle = (questionId) => {
    if (!questionId) return;

    const slug = resolveEffectiveSlug(this.props);
    let obj = peekCacheSync('bookmarksCache', slug);
    if (!obj || typeof obj !== 'object') obj = {};

    if (typeof obj !== 'object' || obj === null) obj = {};
    if (!Array.isArray(obj.questions)) obj.questions = [];

    const set = new Set(obj.questions.map(String));
    const q = String(questionId);
    if (set.has(q)) set.delete(q);
    else set.add(q);

    obj.questions = Array.from(set);

    // Update state first for immediate UI feedback
    this.setState({ bookmarkedQuestions: new Set(obj.questions) });

    void writeCacheOptimistic('bookmarksCache', slug, obj).catch((error) => {
      surveyLog.error('[SurveyQuestions] Error saving bookmarksCache:', error);
    });
  };


  /**
   * Return the number of questions changed this session (vs. baseline),
   * not the total number of historical answers. Used by Pile mode for the
   * badge count and to gate submission.
   */
  getAnsweredQuestionsCount = () => {
    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);

    if (!this.state.surveysResponseState || !this.state.surveysResponseState[surveyIndex]) {
      return 0;
    }

    const currentSlice =
      this.state.surveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

    // Prefer explicit session baseline; else derive from last saved answers; else derive from local cache; else empty
    let baselineSlice = this.state.editBaseline;
    if (!baselineSlice && this.state.userAnswers) {
      baselineSlice = this.buildSliceFromUserAnswers(this.state.userAnswers);
    }
    if (!baselineSlice) {
      baselineSlice = this.buildSliceFromLocalCache();
    }
    if (!baselineSlice) {
      baselineSlice = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    }

    // Compute how many questions actually changed vs. the baseline
    return this.computeModifiedQuestionsCount(baselineSlice, currentSlice);
  };

  // Centralized recomputation for modifiedCount / hasEncryptedChanges
  recalculateEditStats = (pendingStatsOverride = null) => {
    try {
      const stats =
        (pendingStatsOverride && typeof pendingStatsOverride === 'object'
          ? pendingStatsOverride
          : null) ||
        (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) ||
        { total: this.state.modifiedCount || 0, encrypted: this.state.encryptedModifiedCount || 0 };
      const modifiedCount = Number(stats.total || 0);
      const encryptedModifiedCount = Number(stats.encrypted || 0);

      const hasEncryptedChanges = encryptedModifiedCount > 0;
      const isDirty = modifiedCount > 0;

      const shouldResetSubmitted = this.state.submissionComplete && modifiedCount > 0;
      const shouldRelatchSubmitted =
        modifiedCount === 0 &&
        !this.state.submittedSinceLastEdit &&
        !!this.state.userHasResponse &&
        !this.state.isSubmitting &&
        !this.state.pileDiscardedEdits;

      if (
        this.state.modifiedCount !== modifiedCount ||
        this.state.encryptedModifiedCount !== encryptedModifiedCount ||
        this.state.hasEncryptedChanges !== hasEncryptedChanges ||
        this.state.isDirty !== isDirty ||
        shouldResetSubmitted ||
        shouldRelatchSubmitted
      ) {
        const updates = { modifiedCount, encryptedModifiedCount, hasEncryptedChanges, isDirty };
        if (shouldResetSubmitted) updates.submissionComplete = false;
        if (shouldRelatchSubmitted) updates.submittedSinceLastEdit = true;
        this.setState(updates);
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };



  initializeSurveyResponseState = () => {
    if (this.props.singleQuestionMode) {
      const questionId = this.props.questionID;
      let initialAnswers = {};
      let initialAdditionalThoughts = {};

      if (this.props.questionPool && this.props.questionPool.length > 0) {
        this.props.questionPool.forEach((question) => {
          initialAnswers[question.id] = this.buildEmptyResponseFieldState(question.id);
          initialAdditionalThoughts[question.id] = this.buildEmptyResponseFieldState(question.id, 'additional');
        });
      } else if (questionId) {
        initialAnswers[questionId] = this.buildEmptyResponseFieldState(questionId);
        initialAdditionalThoughts[questionId] = this.buildEmptyResponseFieldState(questionId, 'additional');
      }

      return [
        {
          answers: initialAnswers,
          importance: {},
          conviction: {},
          additionalComments: initialAdditionalThoughts,
        },
      ];
    } else if (this.props.isStandalone) {
      let initialAnswers = {};
      let initialAdditionalThoughts = {};
      // Seed from currently rendered ids (covers pile or standard pool)
      const ids =
        (Array.isArray(this.props.questionPool) && this.props.questionPool.length > 0)
          ? this.props.questionPool.map(q => q.id)
          : this.getCurrentRenderedQuestionIds();

      ids.forEach((qid) => {
        initialAnswers[qid] = this.buildEmptyResponseFieldState(qid);
        initialAdditionalThoughts[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
      });

      return [
        {
          answers: initialAnswers,
          importance: {},
          conviction: {},
          additionalComments: initialAdditionalThoughts,
        },
      ];
    } else { // Survey mode (multiple questions)
      const surveyIndex = this.props.surveyIndex;
      let initialAnswers = {};
      let initialAdditionalThoughts = {};

      // Prefer rendered ids; fall back to questionPool
      const ids = this.getCurrentRenderedQuestionIds().length > 0
        ? this.getCurrentRenderedQuestionIds()
        : (Array.isArray(this.state.questionPool) ? this.state.questionPool.map(q => q.id) : []);

      ids.forEach((qid) => {
        initialAnswers[qid] = this.buildEmptyResponseFieldState(qid);
        initialAdditionalThoughts[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
      });

      const newSurveysResponseState = [...this.state.surveysResponseState || []];
      // Ensure the array is long enough for the current surveyIndex
      while (newSurveysResponseState.length <= surveyIndex) {
        newSurveysResponseState.push(null);
      }
      newSurveysResponseState[surveyIndex] = {
        answers: initialAnswers,
        importance: {},
        conviction: {},
        additionalComments: initialAdditionalThoughts,
      };
      return newSurveysResponseState;
    }
  };


  checkAndHandleStartFresh = () => {
    const idx = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
    const slice = (this.state.surveysResponseState && this.state.surveysResponseState[idx]) || {answers:{},additionalComments:{},importance:{},conviction:{}};
    const hasAny = this.getCurrentRenderedQuestionIds().some(qid =>
      (slice.answers?.[qid]?.value ?? '') !== '' ||
      (slice.additionalComments?.[qid]?.value ?? '') !== '' ||
      Object.prototype.hasOwnProperty.call(slice.importance || {}, qid) ||
      Object.prototype.hasOwnProperty.call(slice.conviction || {}, qid)
    );
    if (!this.props.viewAddress && !this.state.userHasResponse && !this.state.editBaseline && !this.state.isDirty && !hasAny) {
      this.handleStartFresh();
    }
  };

  getSurveyQuestionPoolLoadState = () => {
    if (this.props.isStandalone || this.props.singleQuestionMode) {
      return {
        expectedIds: [],
        pendingIds: [],
        pendingCount: 0,
        isIncomplete: false,
      };
    }

    const expectedIds = Array.isArray(this.state.questionPoolExpectedIds)
      ? this.state.questionPoolExpectedIds
      : [];
    const pendingIds = Array.isArray(this.state.questionPoolPendingIds)
      ? this.state.questionPoolPendingIds
      : [];
    const pendingCount = pendingIds.length;

    return {
      expectedIds,
      pendingIds,
      pendingCount,
      isIncomplete: expectedIds.length > 0 && pendingCount > 0,
    };
  };

  showTransientSubmitFeedback = (message = '', durationMs = 2000) => {
    const nextMessage = String(message || '').trim();
    if (this._emptySubmitTimer) {
      clearTimeout(this._emptySubmitTimer);
      this._emptySubmitTimer = null;
    }
    if (this._pileSubmitTimer) {
      clearTimeout(this._pileSubmitTimer);
      this._pileSubmitTimer = null;
    }
    const update = { submissionError: nextMessage };
    if (Object.prototype.hasOwnProperty.call(this.state || {}, 'pileSubmitTempText')) {
      update.pileSubmitTempText = nextMessage || null;
    }
    this.setState(update);
    if (!nextMessage) return;
    this._emptySubmitTimer = setTimeout(() => {
      if (!this._isMounted) return;
      const clearUpdate = { submissionError: '' };
      if (Object.prototype.hasOwnProperty.call(this.state || {}, 'pileSubmitTempText')) {
        clearUpdate.pileSubmitTempText = null;
      }
      this.setState(clearUpdate);
      this._emptySubmitTimer = null;
    }, Math.max(1000, Number(durationMs) || 2000));
  };

  maybeBlockSubmitUntilQuestionPoolComplete = () => {
    const { isIncomplete, pendingCount } = this.getSurveyQuestionPoolLoadState();
    if (!isIncomplete) return false;

    const questionLabel = pendingCount === 1 ? 'question' : 'questions';
    this.showTransientSubmitFeedback(`Loading ${pendingCount} more ${questionLabel}...`);
    void this.fetchQuestionPool().catch((error) => {
      surveyLog.warn('SurveyQuestions: submit-triggered question pool refresh failed.', error);
    });
    return true;
  };


  async fetchQuestionPool() {
    if (this.props.isStandalone || this.props.singleQuestionMode) return;
    if (!this.props.surveyId) {
      surveyLog.warn("SurveyQuestions: fetchQuestionPool – no surveyID supplied");
      this.setState({ questionPool: [], questionPoolExpectedIds: [], questionPoolPendingIds: [] });
      return;
    }

    // Prefer ID-aware resolver for /survey/:id routes (no /session/:slug)
    const slug = this.props.surveyId
      ? resolveSlugForIds({ surveyId: this.props.surveyId, props: this.props, network: this.props.network })
      : resolveEffectiveSlug(this.props);
    const questionReadContext = resolveQuestionReadCacheContext(this.props, slug);
    const effectiveSlug = questionReadContext.sessionSlug || slug;
    const netIdStr = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error("SurveyQuestions: fetchQuestionPool – network.id undefined");
      this.setState({ questionPool: [], questionPoolExpectedIds: [], questionPoolPendingIds: [] });
      return;
    }

    const surveyIdLower = this.props.surveyId.toLowerCase();

    // surveys cache via safe reader (already purges)
    let surveysCache = readSurveysCache(effectiveSlug);
    if (!surveysCache || typeof surveysCache !== 'object') surveysCache = {};
    const surveysNet = surveysCache[netIdStr] || {
      surveysLatestBlock: 0,
      surveys: {},
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };
    let surveyDataFromCache = surveysNet.surveys?.[surveyIdLower];

    let surveyData = null;
    if (this.props.surveys && this.props.surveyIndex !== null && this.props.surveys[this.props.surveyIndex]) {
      const surveyFromProp = this.props.surveys[this.props.surveyIndex];
      if (surveyFromProp.id && surveyFromProp.id.toLowerCase() === surveyIdLower) {
        surveyData = surveyFromProp;
      }
    }
    if (!surveyData) { surveyData = surveyDataFromCache; }

    if (!surveyData || !Array.isArray(surveyData.questionIDs) || surveyData.questionIDs.length === 0) {
      try {
        surveyData = await contractScripts.getSurveyDataById(this.props.provider, surveyIdLower, effectiveSlug);
        if (surveyData) {
          if (!Array.isArray(surveyData.questionIDs))
            surveyData.questionIDs = [];
          surveyData.surveyID = surveyIdLower;
          surveyData.id       = surveyIdLower;

          let currentGlobalSurveysCache = readSurveysCache(effectiveSlug);
          if (!currentGlobalSurveysCache || typeof currentGlobalSurveysCache !== 'object') {
            currentGlobalSurveysCache = {};
          }
          if (!currentGlobalSurveysCache[netIdStr]) {
            currentGlobalSurveysCache[netIdStr] = { surveys: {}, surveysLatestBlock:0, surveyResponses:{}, surveyResponsesLatestBlock:{} };
          }
          if (!currentGlobalSurveysCache[netIdStr].surveys) {
            currentGlobalSurveysCache[netIdStr].surveys = {};
          }
          currentGlobalSurveysCache[netIdStr].surveys[surveyIdLower] = surveyData;
          await writeSurveysCache(effectiveSlug, currentGlobalSurveysCache);
        }
      } catch (e) {
        surveyLog.error("SurveyQuestions: failed to fetch survey from chain:", e);
        surveyData = null;
      }
    }

    if (!surveyData || !Array.isArray(surveyData.questionIDs) || surveyData.questionIDs.length === 0) {
      surveyLog.warn(`SurveyQuestions: survey ${surveyIdLower} still has no questionIDs – aborting pool build`);
      this.setState({ questionPool: [], questionPoolExpectedIds: [], questionPoolPendingIds: [] });
      return;
    }

    const blockedQuestionIds = getBlockedQuestionIdsSet(effectiveSlug);
    const expectedQuestionIds = surveyData.questionIDs
      .map((qid) => normalizeQuestionIdKey(qid))
      .filter((qid) => qid && !blockedQuestionIds.has(qid));

    // Pass sessionName context to ensureQuestionCached so it knows where to look.
    // Do not let one failed question fetch abort the entire direct /survey/:id pool load.
    const cacheHydrationResults = await Promise.allSettled(
      surveyData.questionIDs.map(async (qid) => {
        await this.props.ensureQuestionCached(qid, { sessionName: surveyData.sessionName });
        return qid;
      })
    );
    const failedQuestionHydrations = cacheHydrationResults.filter((result) => result.status === 'rejected');
    if (failedQuestionHydrations.length > 0) {
      surveyLog.warn(
        `SurveyQuestions: ${failedQuestionHydrations.length} question cache hydration request(s) failed for survey ${surveyIdLower}.`,
        failedQuestionHydrations.map((result) => result.reason?.message || result.reason || 'unknown error')
      );
    }

    let questionsCacheFromStorage = readQuestionsCache(effectiveSlug) || {};
    const questionsNet = questionsCacheFromStorage[netIdStr] || {
      questionsLatestBlock: 0,
      questions: {},
      questionResponses: {},
      questionResponsesLatestBlock: 0,
    };
    const networkQuestions = questionsNet.questions || {};

    const questionPool = expectedQuestionIds
      .map((qid) => {
        const qData = networkQuestions[qid];
        if (qData) return { ...qData, id: qData.id.toLowerCase() };
        surveyLog.warn(`SurveyQuestions: Question data for ID ${qid} not found in cache after ensureQuestionCached.`);
        return null;
      })
      .filter(Boolean);
    const loadedQuestionIds = new Set(
      questionPool
        .map((question) => normalizeQuestionIdKey(question?.id))
        .filter(Boolean)
    );
    const pendingQuestionIds = expectedQuestionIds.filter((qid) => !loadedQuestionIds.has(qid));

    const nextQuestionPoolSig = buildQuestionIdScopeSignature(questionPool);
    this.setState((prev) => {
      const prevQuestionPool = Array.isArray(prev?.questionPool) ? prev.questionPool : [];
      const prevExpectedQuestionIds = Array.isArray(prev?.questionPoolExpectedIds)
        ? prev.questionPoolExpectedIds
        : [];
      const prevPendingQuestionIds = Array.isArray(prev?.questionPoolPendingIds)
        ? prev.questionPoolPendingIds
        : [];
      const prevQuestionPoolById = new Map();
      prevQuestionPool.forEach((entry) => {
        const key = normalizeQuestionIdKey(entry?.id);
        if (!key || prevQuestionPoolById.has(key)) return;
        prevQuestionPoolById.set(key, entry);
      });

      const mergedQuestionPool = questionPool.map((entry) => {
        const key = normalizeQuestionIdKey(entry?.id);
        if (!key) return entry;
        const existing = prevQuestionPoolById.get(key);
        if (!existing) return entry;
        const picked = pickBetterQuestionPayload(existing, entry) || entry;
        if (picked === existing) return existing;
        const normalized = { ...picked, id: key };
        return areQuestionPayloadsEquivalent(existing, normalized) ? existing : normalized;
      });

      const prevQuestionPoolSig = buildQuestionIdScopeSignature(prevQuestionPool);
      const expectedIdsUnchanged =
        prevExpectedQuestionIds.length === expectedQuestionIds.length &&
        prevExpectedQuestionIds.every((qid, index) => qid === expectedQuestionIds[index]);
      const pendingIdsUnchanged =
        prevPendingQuestionIds.length === pendingQuestionIds.length &&
        prevPendingQuestionIds.every((qid, index) => qid === pendingQuestionIds[index]);
      if (prevQuestionPoolSig === nextQuestionPoolSig) {
        const hasSemanticChange =
          prevQuestionPool.length !== mergedQuestionPool.length ||
          prevQuestionPool.some((entry, idx) => entry !== mergedQuestionPool[idx]);
        if (!hasSemanticChange && expectedIdsUnchanged && pendingIdsUnchanged) {
          bumpSurveyPerfCounter('noopSkipCount');
          return null;
        }
      }
      return {
        questionPool: mergedQuestionPool,
        questionPoolExpectedIds: expectedQuestionIds,
        questionPoolPendingIds: pendingQuestionIds,
      };
    });
	  }


  loadQuestionFromCache = async (questionId) => {
    const slug = resolveEffectiveSlug(this.props);
    const questionReadContext = resolveQuestionReadCacheContext(this.props, slug);
    const effectiveSlug = questionReadContext.sessionSlug || slug;
    const netIdStr = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error('SurveyQuestions: Network ID undefined in loadQuestionFromCache');
      return null;
    }
    let questionsCache = readQuestionsCache(effectiveSlug) || {};
    if (!questionsCache[netIdStr] || !questionsCache[netIdStr].questions) return null;
    const qIdLower = questionId.toLowerCase();
    return questionsCache[netIdStr].questions[qIdLower] || null;
  };


  mergeSurveyResponseState = (currentState, newQuestionPool, surveyIndex = 0) => {
    const pool = (Array.isArray(newQuestionPool) && newQuestionPool.length > 0)
      ? newQuestionPool
      : this.getCurrentRenderedQuestionIds().map(id => ({ id }));
    const next = Array.isArray(currentState) ? [...currentState] : [];

    while (next.length <= surveyIndex) {
      next.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });
    }

    const prevSlice =
      next[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

    const allowedIds = new Set(
      pool.map((q) => (q && q.id ? String(q.id) : null)).filter(Boolean)
    );

    const mergedAnswers = {};
    const mergedAdditional = {};
    const mergedImportance = {};
    const mergedConviction = {};

    allowedIds.forEach((qid) => {
      if (prevSlice.answers && prevSlice.answers[qid]) {
        mergedAnswers[qid] = { ...prevSlice.answers[qid] };
      } else {
        mergedAnswers[qid] = this.buildEmptyResponseFieldState(qid);
      }
      if (prevSlice.additionalComments && prevSlice.additionalComments[qid]) {
        mergedAdditional[qid] = { ...prevSlice.additionalComments[qid] };
      } else {
        mergedAdditional[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
      }
      if (
        prevSlice.importance &&
        Object.prototype.hasOwnProperty.call(prevSlice.importance, qid)
      ) {
        mergedImportance[qid] = prevSlice.importance[qid];
      }
      if (
        prevSlice.conviction &&
        Object.prototype.hasOwnProperty.call(prevSlice.conviction, qid)
      ) {
        mergedConviction[qid] = prevSlice.conviction[qid];
      }
    });

    next[surveyIndex] = {
      answers: mergedAnswers,
      importance: mergedImportance,
      conviction: mergedConviction,
      additionalComments: mergedAdditional,
    };

    return next;
  };


  async fetchSurveyResponse() {
    if (!this._isMounted) return;
    const runId = (Number(this._fetchSurveyResponseRunId || 0) + 1);
    this._fetchSurveyResponseRunId = runId;
    const isStale = () => !this._isMounted || this._fetchSurveyResponseRunId !== runId;
    const safe = (...args) => { if (!isStale()) this.setState(...args); };

    safe({ isLoadingResponse: true, responseLookupWarning: '' });

    // 1. View Mode (Address lookup) - Unaffected by submission state
    if (this.props.displayAnswerMode && this.props.viewAddress) {
      try {
        const viewAnswers = await this.getLatestSurveyResponse(
          this.props.viewAddress,
          this.props.surveyId
        );
        if (isStale()) return;
        if (viewAnswers) {
          safe((prev) => {
            const merged = mergeDecryptedViewedResponse(prev.parsedViewAddressAnswers, viewAnswers);
            return {
              viewAddressAnswers: JSON.stringify(merged),
              parsedViewAddressAnswers: merged,
              noResponse: false,
              responseLookupWarning: '',
            };
          });
        } else {
          safe({
            viewAddressAnswers: '',
            parsedViewAddressAnswers: null,
            noResponse: true,
            responseLookupWarning: '',
          });
        }
      } catch (error) {
        surveyLog.error('Error fetching survey response:', error);
        if (isStale()) return;
        safe({
          viewAddressAnswers: '',
          parsedViewAddressAnswers: null,
          noResponse: true,
          responseLookupWarning: '',
        });
      }
    } else {
      safe({
        viewAddressAnswers: '',
        parsedViewAddressAnswers: null,
        noResponse: false,
        responseLookupWarning: '',
      });
    }

    // 2. User Account Mode
    if (this.props.account) {
      try {
        const userAnswers = await this.getLatestSurveyResponse(
          this.props.account,
          this.props.surveyId
        );
        if (isStale()) return;

        // Consistency check logic
        if (this.state.submissionComplete) {
          const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
          surveyLog.log("Comparing incoming chain data vs optimistic baseline");

          // Only switch off optimistic mode if chain data matches our submitted baseline
          if (userAnswers && this.areResponsesConsistent(userAnswers, surveyIndex)) {
             surveyLog.log("Result: New. Chain data consistent with submission. Exiting optimistic mode.");
             const hasEncrypted = userAnswers.responses?.some(
                (r) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion
             );
             safe({
               userHasResponse: true,
               userResponseEncrypted: !!hasEncrypted,
               startFresh: false,
               userAnswers: userAnswers,
               submissionComplete: false // <--- The key reset
             });
             // We do NOT call prefillSurveyResponses here to avoid rebuilding baseline unnecessarily
          } else {
             // Chain is stale or null. Keep optimistic state.
             surveyLog.log("Result: Stale. Chain data older than optimistic baseline. Ignoring fetch.");
          }
        }
        // Normal Path (Not in optimistic mode)
        else if (userAnswers) {
          const hasEncrypted = userAnswers.responses?.some(
            (r) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion
          );
          safe({
            userHasResponse: true,
            userResponseEncrypted: !!hasEncrypted,
            startFresh: false,
            userAnswers: userAnswers,
          });
          if (!isStale()) this.prefillSurveyResponses(userAnswers);
        } else {
          // Only reset to "no response" if we aren't holding an optimistic submission
          if (!this.state.submissionComplete) {
            safe({
              userHasResponse: false,
              userResponseEncrypted: false,
              userAnswers: null,
            });
          }
        }
      } catch (error) {
        surveyLog.error("Error fetching user's survey response:", error);
        if (isStale()) return;
        // On error, if we are optimistic, we just stay optimistic.
        if (!this.state.submissionComplete) {
            safe({
              userHasResponse: false,
              userResponseEncrypted: false,
              userAnswers: null,
            });
        }
      }
    }

    safe({ isLoadingResponse: false });
  }

  getQuestionResponse = async (responderAddress, questionId) => {
    surveyLog.log(
      "SurveyQuestions: getQuestionResponse() - invoked with questionId:",
      questionId
    );
    // Use the same slug resolution as drafts/decrypt in single-question flows
    const slug = this._getEffectiveDraftSlug();
    const questionAnswer = await contractScripts.getResponse(
      this.props.provider,
      responderAddress,
      questionId,
      slug
    );
    surveyLog.log("SurveyQuestions: questionAnswer: ", questionAnswer);
    return questionAnswer;
  };



  // Prefill single-question draft from prior response.
  // Hydrates encrypted: true for previously encrypted fields.
  // Intelligently merges baseline and preserves un-edited responses cleanly.
  prefillSingleQuestionResponse = (userAnswer) => {
    const surveyIndex = 0; // single-question context uses index 0
    const questionId = normalizeQuestionIdKey(this.props.questionID);

    if (!userAnswer || !questionId) return;

    this.setState((prev) => {
      const curr =
        prev.surveysResponseState?.[surveyIndex] ||
        { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      const hasVal = (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).length > 0);

      const allowOverwrite = !prev.isDirty && !prev.submissionComplete;

      const nextStateArr = Array.isArray(prev.surveysResponseState)
        ? [...prev.surveysResponseState]
        : [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }];

      while (nextStateArr.length <= surveyIndex) {
        nextStateArr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });
      }

      const nextSlice = {
        answers: { ...(nextStateArr[surveyIndex]?.answers || {}) },
        importance: { ...(nextStateArr[surveyIndex]?.importance || {}) },
        conviction: { ...(nextStateArr[surveyIndex]?.conviction || {}) },
        additionalComments: { ...(nextStateArr[surveyIndex]?.additionalComments || {}) },
      };

      const ans = userAnswer.answer || {};
      const add = userAnswer.additional || {};

      const prevAns = curr.answers?.[questionId];
      const ansIsMasked = ans.value === '*' && (ans.encrypted || ans.encryptedPortion);
      const ansPrevDecrypted = prevAns && prevAns.value !== '*' && prevAns.value !== undefined && prevAns.value !== null;
      const ansEnvMatches = prevAns && areEnvelopesEquivalent(
        ans.encryptedPortion,
        prevAns.encryptedPortion,
        ans.encrypted,
        prevAns.encrypted
      );

      if (!hasVal(prevAns?.value) || allowOverwrite) {
        const answerAudience = this.normalizeResponseEncryptionAudience(
          ans.encryptionAudience || (
            (ans.encrypted || ans.encryptedPortion)
              ? this.getDefaultResponseEncryptionAudienceForQid(questionId)
              : 'self'
          ),
          questionId
        );
        nextSlice.answers[questionId] = {
          value: (ansIsMasked && ansPrevDecrypted && ansEnvMatches) ? prevAns.value : this.parseAnswerValue(ans.value),
          encrypted: !!(ans.encrypted || ans.encryptedPortion),
          encryptionAudience: answerAudience,
          encryptionGateId: answerAudience === 'gate'
            ? this.resolveFieldEncryptionGateId({ ...ans, encryptionAudience: answerAudience }, questionId, 'answer')
            : null,
          audienceMode: 'explicit',
          hash: ans.hash || '',
          encryptedPortion: ans.encryptedPortion || '',
          ...(ansEnvMatches && prevAns?.zkSalt ? { zkSalt: prevAns.zkSalt } : {})
        };
      }

      const convictionValue = getConvictionFromResponse(userAnswer);
      if ((!(questionId in curr.conviction) || allowOverwrite) && convictionValue !== null) {
        nextSlice.conviction[questionId] = convictionValue;
      }
      const importanceValue = getImportanceFromResponse(userAnswer);
      if ((!(questionId in curr.importance) || allowOverwrite) && importanceValue !== null) {
        nextSlice.importance[questionId] = importanceValue;
      }

      const prevAdd = curr.additionalComments?.[questionId];
      const addIsMasked = add.value === '*' && (add.encrypted || add.encryptedPortion);
      const addPrevDecrypted = prevAdd && prevAdd.value !== '*' && prevAdd.value !== undefined && prevAdd.value !== null;
      const addEnvMatches = prevAdd && areEnvelopesEquivalent(
        add.encryptedPortion,
        prevAdd.encryptedPortion,
        add.encrypted,
        prevAdd.encrypted
      );

      if (!hasVal(prevAdd?.value) || allowOverwrite) {
        const additionalAudienceMode = this.normalizeFieldAudienceMode(add.audienceMode, 'additional', add);
        const additionalAudience = this.normalizeResponseEncryptionAudience(
          add.encryptionAudience || (
            (add.encrypted || add.encryptedPortion)
              ? this.getDefaultResponseEncryptionAudienceForQid(questionId)
              : 'self'
          ),
          questionId
        );
        let nextAdditional = {
          value: (addIsMasked && addPrevDecrypted && addEnvMatches) ? prevAdd.value : this.parseAnswerValue(add.value),
          encrypted: !!(add.encrypted || add.encryptedPortion),
          encryptionAudience: additionalAudience,
          encryptionGateId: additionalAudience === 'gate'
            ? this.resolveFieldEncryptionGateId({ ...add, encryptionAudience: additionalAudience }, questionId, 'additional')
            : null,
          audienceMode: additionalAudienceMode,
          hash: add.hash || '',
          encryptedPortion: add.encryptedPortion || '',
          ...(addEnvMatches && prevAdd?.zkSalt ? { zkSalt: prevAdd.zkSalt } : {})
        };
        if (additionalAudienceMode === 'inherit') {
          nextAdditional = this.buildInheritedAdditionalFieldState(nextAdditional, nextSlice.answers[questionId], questionId);
        }
        nextSlice.additionalComments[questionId] = nextAdditional;
      }

      nextStateArr[surveyIndex] = nextSlice;

      const baseline = this.buildSliceFromUserAnswers(userAnswer, prev.editBaseline || curr);

      return {
        surveysResponseState: nextStateArr,
        ...(!prev.submissionComplete ? { editBaseline: baseline } : {})
      };
    }, () => {
      this.updateJsonPreview();
      this.recalculateEditStats();
    });
  };
  parseAnswerValue = (value) => {
    try {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        return JSON.parse(value);
      }
    } catch (e) {
      return value;
    }
    return value;
  };

  handleStartFresh = () => {
    const surveyIndex =
      this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);

    // Build empty slice for rendered IDs
    const emptySlice = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const renderedIds = this.getCurrentRenderedQuestionIds();

    renderedIds.forEach((qid) => {
      emptySlice.answers[qid] = this.buildEmptyResponseFieldState(qid);
      emptySlice.additionalComments[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
      // importance deliberately omitted
    });

    const nextArr = Array.isArray(this.state.surveysResponseState)
      ? [...this.state.surveysResponseState]
      : [];
    while (nextArr.length <= surveyIndex) nextArr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });
    nextArr[surveyIndex] = emptySlice;

    this.setState({
      suppressPrefill: true,
      startFresh: true,
      surveysResponseState: nextArr,
      editBaseline: this.deepClone(emptySlice), // pending → 0 immediately
      modifiedCount: 0,
      hasEncryptedChanges: false,
      isDirty: false,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
    }, () => {
      // clear per-q drafts so they don’t reappear
      renderedIds.forEach((qid) => { this.clearDraftFor && this.clearDraftFor(qid); });
      this.recalculateEditStats && this.recalculateEditStats();
      this.persistDraftSafely && this.persistDraftSafely(0);
    });
  };


  async fetchSingleQuestionData(opts = {}) {
    const runId = (Number(this._fetchSingleQuestionRunId) || 0) + 1;
    this._fetchSingleQuestionRunId = runId;
    const isStaleRun = () => !this._isMounted || this._fetchSingleQuestionRunId !== runId;
    const safeSetState = (...args) => {
      if (!isStaleRun()) this.setState(...args);
    };
    const bootstrapRetryAttempt = Number(opts?.bootstrapRetryAttempt || 0);
    const configuredFetchTimeoutMs = Number(opts?.questionFetchTimeoutMs);
    const fetchTimeoutMs = Number.isFinite(configuredFetchTimeoutMs) && configuredFetchTimeoutMs > 0
      ? Math.max(3000, configuredFetchTimeoutMs)
      : 8000;
    const configuredFetchRecoveryMs = Number(opts?.questionFetchTimeoutRecoveryMs);
    const fetchTimeoutRecoveryMs = Number.isFinite(configuredFetchRecoveryMs) && configuredFetchRecoveryMs > 0
      ? Math.max(fetchTimeoutMs, configuredFetchRecoveryMs)
      : Math.max(fetchTimeoutMs, 20000);
    const maxCandidateSlugs = Math.max(2, Number(opts?.maxCandidateSlugs || 8));

    let questionId = this.props.questionID;
    if (!questionId) {
      this.updateSingleQuestionDebug({
        phase: 'missing-question-id',
        runId,
        bootstrapRetryAttempt,
      });
      surveyLog.warn('SurveyQuestions: No questionID provided in singleQuestionMode.');
      safeSetState({ isLoadingResponse: false });
      return;
    }
    questionId = questionId.toLowerCase();
    const preserveCurrentSingleQuestionPool = (extraState = {}) => {
      const existingPool = Array.isArray(this.state.questionPool) ? this.state.questionPool : [];
      const existingCurrentQuestion = existingPool.find((item) => (
        String(item?.id || item?.questionID || '').trim().toLowerCase() === questionId
      ));
      if (!existingCurrentQuestion) return false;
      safeSetState({
        questionPool: [{ ...existingCurrentQuestion, id: questionId }],
        ...(extraState && typeof extraState === 'object' ? extraState : {}),
      });
      return true;
    };

    // Keep retry timers stable across cache-tick refreshes for the same question.
    // Otherwise we can repeatedly cancel the delayed retry before it executes.
    const pendingRetrySig = String(this._singleQuestionBootstrapRetrySig || '').trim().toLowerCase();
    const pendingRetryQuestionId = pendingRetrySig ? pendingRetrySig.split(':')[0] : '';
    const hasPendingRetryForQuestion = !!(pendingRetryQuestionId && pendingRetryQuestionId === questionId);
    if (bootstrapRetryAttempt > 0) {
      this.clearSingleQuestionBootstrapRetry();
    } else if (pendingRetryQuestionId && pendingRetryQuestionId !== questionId) {
      this.clearSingleQuestionBootstrapRetry();
    }
    this.updateSingleQuestionDebug({
      phase: 'start',
      runId,
      questionId,
      responderAddress: String(this.props.responderAddress || '').toLowerCase(),
      bootstrapRetryAttempt,
      pendingRetrySig: pendingRetrySig || null,
      hasPendingRetryForQuestion,
      questionResponsesNonce: Number(this.props.questionResponsesNonce || 0),
      questionsCacheNonce: Number(this.props.questionsCacheNonce || 0),
    });

    // Resolve slug for this single-question view (scoped)
    const slugPinned = getSessionSlugPinnedFromProps(this.props);
    const explicitSingleSlug = normalizeSessionSlugValue(getSessionSlugHintFromProps(this.props));
    const explicitSingleSlugKnown = explicitSingleSlug === '' || !!resolveExplicitSessionContext(explicitSingleSlug).sessionConfig;
    const resolvedSingleSlug = resolveSlugForIds({
      sessionName:
        this.props.sessionName ||
        this.props.sessionName ||
        (this.state.questionPool?.[0]?.sessionName) ||
        (this.state.questionPool?.[0]?.sessionName),
      questionId: this.props.questionID,
      surveyId: null,
      props: this.props,
      network: this.props.network
    });
    let effectiveSingleSlug = explicitSingleSlug || resolvedSingleSlug || resolveEffectiveSlug(this.props);
    const fetchCandidateSlugs = this.getQuestionFetchCandidateSlugs(
      questionId,
      effectiveSingleSlug,
      { allowPinnedFallback: !slugPinned || bootstrapRetryAttempt > 0 || !explicitSingleSlugKnown }
    ).slice(0, maxCandidateSlugs);

    const BLOCKED_QUESTION_IDS_SET = getBlockedQuestionIdsSet(effectiveSingleSlug);
    if (BLOCKED_QUESTION_IDS_SET.has(questionId)) {
      this.updateSingleQuestionDebug({
        phase: 'blocked-question',
        runId,
        questionId,
        effectiveSingleSlug: String(effectiveSingleSlug || ''),
      });
      surveyLog.warn(`SurveyQuestions: Question ${questionId} is blocked; skipping.`);
      safeSetState({
        questionPool: [],
        isLoadingResponse: false,
        noResponse: true,
        responseLookupWarning: '',
        displayAnswerMode: true,
      });
      return;
    }

    const responderAddress = this.props.responderAddress;

    const getCacheStateForSlug = async (slug) => {
      const context = resolveQuestionBootstrapContext(this.props, slug);
      let netIdStr = context.networkIdStr;
      const rawCache = await readQuestionsCacheAsync(slug);
      if (!rawCache || typeof rawCache !== 'object') return null;
      if (!netIdStr) {
        const preferredNet = Object.keys(rawCache).find((key) => {
          const bucket = rawCache?.[key];
          return !!(bucket && bucket.questions && bucket.questions[questionId]);
        });
        const fallbackNet = preferredNet || Object.keys(rawCache).find((key) => (
          rawCache?.[key] && typeof rawCache[key] === 'object'
        ));
        if (!fallbackNet) return null;
        netIdStr = String(fallbackNet || '').trim();
      }
      if (!netIdStr) return null;
      const questionsCache = ensureQuestionsNet(rawCache, netIdStr);
      if (!questionsCache[netIdStr]) {
        questionsCache[netIdStr] = {
          questionsLatestBlock: 0,
          questions: {},
          questionResponses: {},
          questionResponsesLatestBlock: 0
        };
      }
      if (!questionsCache[netIdStr].questions) questionsCache[netIdStr].questions = {};
      return { netIdStr, questionsCache };
    };

    let qData = null;
    const recentPayload = readRecentQuestionPayload(questionId);
    const recentPayloadForAccount = canUseRecentQuestionPayloadForAccount(
      recentPayload,
      this.props.account
    )
      ? { ...recentPayload, id: questionId }
      : null;
    let cacheState = await getCacheStateForSlug(effectiveSingleSlug);
    if (!cacheState) {
      if (recentPayloadForAccount) {
        const shouldBootstrapViewedResponse = !!responderAddress;
        qData = { ...recentPayloadForAccount, id: questionId };
        if (!qData.creator) qData.creator = '';
        if (!Array.isArray(qData.tags)) qData.tags = [];
        const fallbackNetId = resolveQuestionBootstrapContext(
          this.props,
          effectiveSingleSlug
        ).networkIdStr;
        if (fallbackNetId) {
          const bootstrapCache = await updateCacheAtomic('questionsCache', effectiveSingleSlug, (current) => {
            const nextCache = ensureQuestionsNet(
              (current && typeof current === 'object') ? current : {},
              fallbackNetId
            );
            nextCache[fallbackNetId].questions[questionId] = {
              ...(nextCache[fallbackNetId].questions[questionId] || {}),
              ...qData,
              id: questionId,
            };
            return nextCache;
          });
          cacheState = {
            netIdStr: fallbackNetId,
            questionsCache: ensureQuestionsNet(bootstrapCache || {}, fallbackNetId),
          };
        }
        if (isStaleRun()) return;
        this.setState(
          (prev) => ({
            questionPool: [{ ...qData, id: qData.id }],
            surveysResponseState: this.mergeSurveyResponseState(
              prev.surveysResponseState ||
                [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
              [{ ...qData, id: qData.id }],
              0
            ),
            viewAddressAnswers: '',
            parsedViewAddressAnswers: null,
            noResponse: false,
            isLoadingResponse: shouldBootstrapViewedResponse,
          }),
          () => {
            this.updateJsonPreview();
            this.rehydrateDraftForRenderedIds();
          }
        );
        if (shouldBootstrapViewedResponse) {
          const didScheduleRetry = this.scheduleSingleQuestionBootstrapRetry({
            questionId,
            attempt: bootstrapRetryAttempt,
            reason: 'recent-payload-waiting-for-response-bootstrap',
          });
          this.updateSingleQuestionDebug({
            phase: didScheduleRetry
              ? 'recent-payload-response-bootstrap-retrying'
              : 'recent-payload-response-bootstrap-exhausted',
            runId,
            questionId,
            effectiveSingleSlug: String(effectiveSingleSlug || ''),
            responderAddress: String(responderAddress || '').toLowerCase(),
            retryAttempt: bootstrapRetryAttempt,
            didScheduleRetry: !!didScheduleRetry,
          });
          if (!didScheduleRetry) {
            this.clearSingleQuestionBootstrapRetry();
            safeSetState({
              viewAddressAnswers: '',
              parsedViewAddressAnswers: null,
              noResponse: true,
              responseLookupWarning: '',
              isLoadingResponse: false,
            });
          }
          return;
        }
        if (!fallbackNetId) {
          this.updateSingleQuestionDebug({
            phase: 'recent-payload-missing-network',
            runId,
            questionId,
            effectiveSingleSlug: String(effectiveSingleSlug || ''),
            retryAttempt: bootstrapRetryAttempt,
          });
          safeSetState({ isLoadingResponse: false });
          return;
        }
      }
      if (!cacheState) {
        this.updateSingleQuestionDebug({
          phase: 'missing-cache-state',
          runId,
          questionId,
          effectiveSingleSlug: String(effectiveSingleSlug || ''),
        });
        surveyLog.error('SurveyQuestions: Network ID undefined in fetchSingleQuestionData');
        if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
          return;
        }
        safeSetState({ isLoadingResponse: false });
        return;
      }
    }
    let { netIdStr, questionsCache } = cacheState;

    // Load or fetch question metadata under the resolved slug
    qData = questionsCache[netIdStr].questions?.[questionId];
    if (!qData) {
      if (recentPayloadForAccount) {
        qData = { ...recentPayloadForAccount, id: questionId };
        questionsCache[netIdStr].questions[questionId] = {
          ...(questionsCache[netIdStr].questions[questionId] || {}),
          ...qData,
        };
        if (!isStaleRun()) {
          void writeQuestionsCache(effectiveSingleSlug, questionsCache);
        }
      }
    }
    if (qData && recentPayloadForAccount) {
      const pickedFromRecent = pickBetterQuestionPayload(qData, recentPayloadForAccount) || qData;
      const normalizedPicked = { ...pickedFromRecent, id: questionId };
      const shouldWriteRecentUpgrade = !areQuestionPayloadsEquivalent(qData, normalizedPicked);
      qData = normalizedPicked;
      if (shouldWriteRecentUpgrade) {
        questionsCache[netIdStr].questions[questionId] = normalizedPicked;
        if (!isStaleRun()) {
          void writeQuestionsCache(effectiveSingleSlug, questionsCache);
        }
      }
    }
    const shouldRefetchMasked =
      !!qData &&
      isMaskedQuestionPayload(qData) &&
      !!this.props.loginComplete &&
      !!this.props.account;

    const fetchQuestionDataWithTimeout = (candidateSlug) => {
      const pending = Promise.resolve(
        contractScripts.getQuestionData(
          this.props.provider,
          questionId,
          candidateSlug,
          { decryptContext: this.buildQuestionDecryptContext(candidateSlug) }
        )
      ).catch(() => null);

      return new Promise((resolve) => {
        let settled = false;
        const finalize = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(result);
        };
        const timeoutId = setTimeout(
          () => finalize({ value: null, timedOut: true, pending }),
          fetchTimeoutMs
        );
        pending
          .then((value) => finalize({ value, timedOut: false, pending: null }))
          .catch(() => finalize({ value: null, timedOut: false, pending: null }));
      });
    };

    const waitForTimedOutFetchRecovery = async (timedOutFetches = []) => {
      if (!Array.isArray(timedOutFetches) || timedOutFetches.length === 0) return null;
      return new Promise((resolve) => {
        let settled = false;
        let pendingCount = timedOutFetches.length;
        const finalize = (result) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          resolve(result);
        };
        const timeoutId = setTimeout(() => finalize(null), fetchTimeoutRecoveryMs);
        timedOutFetches.forEach(({ slug: candidateSlug, pending }) => {
          Promise.resolve(pending)
            .then((value) => {
              if (settled) return;
              if (value) {
                finalize({ slug: candidateSlug, payload: value });
                return;
              }
              pendingCount -= 1;
              if (pendingCount <= 0) finalize(null);
            })
            .catch(() => {
              pendingCount -= 1;
              if (!settled && pendingCount <= 0) finalize(null);
            });
        });
      });
    };

    const forceQuestionMetadataRefetch = !!opts.forceQuestionMetadataRefetch;
    if (!qData || shouldRefetchMasked || forceQuestionMetadataRefetch) {
      let bestQuestionData = qData || null;
      let bestSlug = effectiveSingleSlug;
      let fetchedAny = false;
      const timedOutFetches = [];

      for (const candidateSlug of fetchCandidateSlugs) {
        const attemptResult = await fetchQuestionDataWithTimeout(candidateSlug);
        if (attemptResult?.timedOut && attemptResult?.pending) {
          timedOutFetches.push({ slug: candidateSlug, pending: attemptResult.pending });
        }
        const fetched = attemptResult?.value || null;
        if (!fetched) continue;
        fetchedAny = true;
        const picked = pickBetterQuestionPayload(bestQuestionData, fetched);
        if (picked) {
          bestQuestionData = picked;
          bestSlug = candidateSlug;
        }
        const decrypted = !!(picked && (picked.promptDecrypted || picked.optionsDecrypted || picked.tagsDecrypted));
        if (decrypted || (picked && !isMaskedQuestionPayload(picked))) break;
      }

      if (!bestQuestionData && timedOutFetches.length > 0) {
        const recovered = await waitForTimedOutFetchRecovery(timedOutFetches);
        if (recovered?.payload) {
          fetchedAny = true;
          const picked = pickBetterQuestionPayload(bestQuestionData, recovered.payload);
          if (picked) {
            bestQuestionData = picked;
            bestSlug = recovered.slug || bestSlug;
          }
        }
      }

      qData = bestQuestionData;
      effectiveSingleSlug = bestSlug;
      cacheState = await getCacheStateForSlug(effectiveSingleSlug);
      if (!cacheState) {
        if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
          return;
        }
        safeSetState({ isLoadingResponse: false, questionPool: [] });
        return;
      }
      ({ netIdStr, questionsCache } = cacheState);
      try {
        if (qData && qData.id !== questionId) qData.id = questionId;
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      if (!qData && !questionsCache[netIdStr].questions?.[questionId]) {
        surveyLog.warn(
          `SurveyQuestions: No question data for ${questionId} (slug='${effectiveSingleSlug}').`
        );
        const didScheduleRetry = this.scheduleSingleQuestionBootstrapRetry({
          questionId,
          attempt: bootstrapRetryAttempt,
          reason: fetchedAny
            ? 'no-question-data-yet'
            : (timedOutFetches.length > 0 ? 'question-fetch-timeout' : 'question-fetch-unavailable'),
        });
        this.updateSingleQuestionDebug({
          phase: 'question-data-unavailable',
          runId,
          questionId,
          effectiveSingleSlug: String(effectiveSingleSlug || ''),
          fetchedAny: !!fetchedAny,
          timedOutFetchCount: Number(timedOutFetches.length || 0),
          didScheduleRetry: !!didScheduleRetry,
          retryAttempt: bootstrapRetryAttempt,
        });
        if (didScheduleRetry) {
          safeSetState({ isLoadingResponse: true });
          return;
        }
        if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
          return;
        }
        safeSetState({ isLoadingResponse: false, questionPool: [] });
        return;
      }
      if (!qData) {
        qData = questionsCache[netIdStr].questions?.[questionId];
      }
      qData.id = questionId;
      if (!qData.creator) qData.creator = '';
      if (!Array.isArray(qData.tags)) qData.tags = [];
      const existingCached = questionsCache[netIdStr].questions?.[questionId] || null;
      const selectedForCache = pickBetterQuestionPayload(existingCached, qData) || qData;
      const normalizedForCache = { ...selectedForCache, id: questionId };
      const shouldWriteQuestionPayload = !areQuestionPayloadsEquivalent(existingCached, normalizedForCache);
      if (shouldWriteQuestionPayload) {
        questionsCache[netIdStr].questions[questionId] = normalizedForCache;
        if (!isStaleRun()) {
          void writeQuestionsCache(effectiveSingleSlug, questionsCache);
        }
      }
      qData = normalizedForCache;
    }

    if (!hasPendingRetryForQuestion || bootstrapRetryAttempt > 0) {
      this.clearSingleQuestionBootstrapRetry();
    }

    // Build pool and merge state before fetching responses
    if (isStaleRun()) return;
    this.setState(
      (prev) => ({
        questionPool: [{ ...qData, id: qData.id }],
        surveysResponseState: this.mergeSurveyResponseState(
          prev.surveysResponseState ||
            [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
          [{ ...qData, id: qData.id }],
          0
        ),
      }),
      async () => {
        if (isStaleRun()) return;
        // Helper to write-through response into cache
        const writeRespToCache = async (responder, respObj) => {
          if (!responder || !respObj) return;
          const addr = String(responder).toLowerCase();

          // Re-read after await boundaries to avoid stale cache overwrite.
          let currentCache = ensureQuestionsNet(
            await readQuestionsCacheAsync(effectiveSingleSlug),
            netIdStr
          );

          // ensure scaffolding
          currentCache[netIdStr] = currentCache[netIdStr] || {};
          currentCache[netIdStr].questionResponses = currentCache[netIdStr].questionResponses || {};
          currentCache[netIdStr].questionResponses[questionId] =
            currentCache[netIdStr].questionResponses[questionId] || {};
          currentCache[netIdStr].questionResponsesMeta = currentCache[netIdStr].questionResponsesMeta || {};
          currentCache[netIdStr].questionResponsesMeta[questionId] =
            currentCache[netIdStr].questionResponsesMeta[questionId] || {};

          // Recency guard
          const prev = currentCache[netIdStr].questionResponsesMeta[questionId][addr] || { bn: 0, txi: 0, li: 0, ts: 0 };
          const prevBn = Number(prev?.bn ?? prev?.blockNumber ?? 0) || 0;
          const prevTxi = Number(prev?.txi ?? prev?.transactionIndex ?? prev?.txIndex ?? 0) || 0;
          const prevLi = Number(prev?.li ?? prev?.logIndex ?? 0) || 0;
          const prevTs = Number(prev?.ts ?? prev?.timestamp ?? 0) || 0;
          const bn = Number(respObj?.blockNumber ?? respObj?.bn ?? 0) || 0;
          const txi = Number(respObj?.transactionIndex ?? respObj?.txIndex ?? respObj?.txi ?? 0) || 0;
          const li = Number(respObj?.logIndex ?? respObj?.li ?? 0) || 0;
          const ts = Number(respObj?.timestamp ?? respObj?.ts ?? 0) || 0;
          const isStaleResponse =
            bn < prevBn ||
            (
              bn === prevBn &&
              (
                txi < prevTxi ||
                (
                  txi === prevTxi &&
                  (
                    li < prevLi ||
                    (
                      li === prevLi &&
                      ts <= prevTs
                    )
                  )
                )
              )
            );
          if (isStaleResponse) return;

          currentCache[netIdStr].questionResponses[questionId][addr] = respObj;
          currentCache[netIdStr].questionResponsesMeta[questionId][addr] = { bn, txi, li, ts };

          await writeQuestionsCache(effectiveSingleSlug, currentCache);
        };

        const readCachedResponderResponse = (responder) => {
          const addr = String(responder || '').toLowerCase();
          if (!addr) return null;
          const cached =
            questionsCache?.[netIdStr]?.questionResponses?.[questionId]?.[addr] || null;
          if (!cached || typeof cached !== 'object') return null;
          return this.deepClone(cached);
        };

        // Fetch latest response for the appropriate address, scoped to this slug
        if (responderAddress) {
          this.updateSingleQuestionDebug({
            phase: 'responder-fetch-start',
            runId,
            questionId,
            effectiveSingleSlug: String(effectiveSingleSlug || ''),
            responderAddress: String(responderAddress || '').toLowerCase(),
            bootstrapRetryAttempt,
          });
          safeSetState({ isLoadingResponse: true, responseLookupWarning: '' });
          let latest = null;
          let latestFromCache = false;
          let responseHash = null;
          let responseFetchFailed = false;
          try {
            latest = await contractScripts.getResponse(
              this.props.provider,
              responderAddress,
              questionId,
              effectiveSingleSlug,
              { forceArweaveFetch: bootstrapRetryAttempt > 0 }
            );
          } catch (_) {
            latest = null;
            responseFetchFailed = true;
          }
          if (!latest) {
            const cachedLatest = readCachedResponderResponse(responderAddress);
            if (cachedLatest) {
              latest = cachedLatest;
              latestFromCache = true;
            }
          }
          if (!latest) {
            try {
              responseHash = await contractScripts.getResponseHash(
                this.props.provider,
                responderAddress,
                questionId,
                effectiveSingleSlug
              );
            } catch (_) {
              responseHash = null;
              responseFetchFailed = true;
            }
          }
          if (isStaleRun()) return;

          if (latest) {
            const normalizedLatest = this.normalizeSingleQuestionViewedResponse(latest);
            if (!normalizedLatest) {
              this.clearSingleQuestionBootstrapRetry();
              const malformedWarning = `Response payload for this question could not be rendered for ${String(responderAddress || '').toLowerCase()}.`;
              this.updateSingleQuestionDebug({
                phase: 'responder-malformed-response',
                runId,
                questionId,
                effectiveSingleSlug: String(effectiveSingleSlug || ''),
                responderAddress: String(responderAddress || '').toLowerCase(),
                latestFromCache,
              });
              safeSetState({
                viewAddressAnswers: '',
                parsedViewAddressAnswers: null,
                noResponse: true,
                responseLookupWarning: malformedWarning,
                isLoadingResponse: false,
              });
              return;
            }
            latest = normalizedLatest;
            this.clearSingleQuestionBootstrapRetry();
            if (!latestFromCache) {
              await writeRespToCache(responderAddress, latest);
            }
            this.updateSingleQuestionDebug({
              phase: 'responder-response-loaded',
              runId,
              questionId,
              effectiveSingleSlug: String(effectiveSingleSlug || ''),
              responderAddress: String(responderAddress || '').toLowerCase(),
              latestFromCache,
              responseHash: String(latest?.arweaveTxId || responseHash || ''),
            });
            safeSetState((prev) => {
              const merged = mergeDecryptedViewedResponse(prev.parsedViewAddressAnswers, latest);
              return {
                viewAddressAnswers: JSON.stringify(merged),
                parsedViewAddressAnswers: merged,
                noResponse: false,
                responseLookupWarning: '',
              };
            });
          } else if (responseHash) {
            const didScheduleRetry = this.scheduleSingleQuestionBootstrapRetry({
              questionId,
              attempt: bootstrapRetryAttempt,
              reason: responseFetchFailed
                ? 'response-payload-fetch-failed'
                : 'response-payload-pending',
            });
            this.updateSingleQuestionDebug({
              phase: didScheduleRetry
                ? 'responder-hash-no-payload-retrying'
                : 'responder-hash-no-payload-exhausted',
              runId,
              questionId,
              effectiveSingleSlug: String(effectiveSingleSlug || ''),
              responderAddress: String(responderAddress || '').toLowerCase(),
              responseHash: String(responseHash || ''),
              responseFetchFailed,
              retryAttempt: bootstrapRetryAttempt,
              didScheduleRetry: !!didScheduleRetry,
            });
            safeSetState({
              viewAddressAnswers: '',
              parsedViewAddressAnswers: null,
              noResponse: false,
              responseLookupWarning: '',
            });
            if (didScheduleRetry) {
              safeSetState({ isLoadingResponse: true });
              return;
            }
            this.clearSingleQuestionBootstrapRetry();
            safeSetState({
              viewAddressAnswers: '',
              parsedViewAddressAnswers: null,
              noResponse: true,
              responseLookupWarning: '',
            });
          } else {
            this.clearSingleQuestionBootstrapRetry();
            this.updateSingleQuestionDebug({
              phase: 'responder-no-response',
              runId,
              questionId,
              effectiveSingleSlug: String(effectiveSingleSlug || ''),
              responderAddress: String(responderAddress || '').toLowerCase(),
              responseFetchFailed,
            });
            safeSetState({
              viewAddressAnswers: '',
              parsedViewAddressAnswers: null,
              noResponse: true,
              responseLookupWarning: '',
            });
          }

          const isOwn =
            this.props.account &&
            this.props.responderAddress &&
            this.props.account.toLowerCase() === this.props.responderAddress.toLowerCase();

          if (isOwn && latest && !this.state.startFresh && !this.state.suppressPrefill) {
            const hasEncrypted =
              !!latest.answer?.encryptedPortion || !!latest.additional?.encryptedPortion ||
              !!latest.answer?.encrypted || !!latest.additional?.encrypted;
            safeSetState({
              userHasResponse: true,
              userResponseEncrypted: !!hasEncrypted,
              userAnswers: latest,
            });
            if (isStaleRun()) return;
            this.prefillSingleQuestionResponse(latest);
            if (!hasEncrypted) {
              safeSetState({ displayAnswerMode: false, isEditing: true });
            }
          } else if (isOwn && !latest && !this.state.startFresh) {
            safeSetState({ userHasResponse: false, userResponseEncrypted: false, userAnswers: null });
          }
          this.updateSingleQuestionDebug({
            phase: 'responder-fetch-complete',
            runId,
            questionId,
            effectiveSingleSlug: String(effectiveSingleSlug || ''),
            responderAddress: String(responderAddress || '').toLowerCase(),
            isLoadingResponse: false,
            noResponse: !!(this.state && this.state.noResponse),
          });
          safeSetState({ isLoadingResponse: false });
        } else {
          safeSetState({ responseLookupWarning: '' });
          if (this.props.account) {
            let latest = null;
            try {
              latest = await contractScripts.getResponse(
                this.props.provider,
                this.props.account,
                questionId,
                effectiveSingleSlug
              );
            } catch (_) { latest = null; }
            if (isStaleRun()) return;

            // Consistency check logic for single question
            if (this.state.submissionComplete) {
               surveyLog.log("Comparing incoming chain data vs optimistic baseline (Single Q)");
               // Only switch off optimistic mode if chain data matches our submitted baseline
               if (latest && this.areResponsesConsistent(latest, 0)) {
                  surveyLog.log("Result: New. Chain data consistent. Exiting optimistic mode.");
                  const hasEncrypted =
                    !!latest.answer?.encryptedPortion || !!latest.additional?.encryptedPortion ||
                    !!latest.answer?.encrypted || !!latest.additional?.encrypted;

                  safeSetState({
                    userHasResponse: true,
                    userResponseEncrypted: !!hasEncrypted,
                    userAnswers: latest,
                    submissionComplete: false // <--- Reset
                  });
                  writeRespToCache(this.props.account, latest);
               } else {
                  surveyLog.log("Result: Stale. Chain data stale. Staying optimistic.");
               }
            }
            // Normal Path
            else if (latest && !this.state.startFresh && !this.state.suppressPrefill) {
              const hasEncrypted =
                !!latest.answer?.encryptedPortion || !!latest.additional?.encryptedPortion ||
                !!latest.answer?.encrypted || !!latest.additional?.encrypted;
              safeSetState({
                userHasResponse: true,
                userResponseEncrypted: !!hasEncrypted,
                userAnswers: latest,
              });
              writeRespToCache(this.props.account, latest);
              if (!hasEncrypted) {
                if (isStaleRun()) return;
                this.prefillSingleQuestionResponse(latest);
                safeSetState({ displayAnswerMode: false, isEditing: true });
              }
            } else if (!this.state.startFresh) {
              // Only reset to "no response" if we aren't holding an optimistic submission
              if (!this.state.submissionComplete) {
                safeSetState({ userHasResponse: false, userResponseEncrypted: false, userAnswers: null });
              }
            }
          }
          safeSetState({ isLoadingResponse: false });
        }

        // Maintain existing preview + local prefill behaviors
        if (isStaleRun()) return;
        this.updateJsonPreview();
        this.rehydrateDraftForRenderedIds();
        this.rehydrateLocalCacheAnswersForRenderedIds();
      }
    );
  }


  resolveDecryptSurveyId = (baselineForDecrypt, questionId = null) => {
    const propSurveyId = this.props.surveyId || this.props.surveyID;
    if (propSurveyId) return propSurveyId;

    const getEnvelopeSurveyId = (field) => {
      const encryptedPortion = field?.encryptedPortion;
      if (!encryptedPortion) return null;
      try {
        const env = JSON.parse(
          typeof encryptedPortion === 'string'
            ? encryptedPortion
            : JSON.stringify(encryptedPortion)
        );
        return env?.aad?.surveyId || null;
      } catch (_) {
        return null;
      }
    };

    const normalizedQuestionId =
      questionId == null ? '' : String(questionId).trim().toLowerCase();

    if (normalizedQuestionId) {
      const scopedSurveyId =
        getEnvelopeSurveyId(baselineForDecrypt?.answers?.[normalizedQuestionId]) ||
        getEnvelopeSurveyId(baselineForDecrypt?.additionalComments?.[normalizedQuestionId]);
      if (scopedSurveyId) return scopedSurveyId;
    }

    const containers = [
      baselineForDecrypt?.answers,
      baselineForDecrypt?.additionalComments,
    ];

    for (const container of containers) {
      if (!container || typeof container !== 'object') continue;
      for (const key of Object.keys(container)) {
        const surveyId = getEnvelopeSurveyId(container[key]);
        if (surveyId) return surveyId;
      }
    }

    return ethers.constants.HashZero;
  };


  async handleDecryptEdit() {
    this.setState({ isDecrypting: true, submissionError: '', suppressPrefill: true });
    const surveyIndex =
      this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;

    // Align decrypt slug with draft slug (single-Q aware)
    const slug = this._getEffectiveDraftSlug();

    try {
      let latest;
      if (this.props.singleQuestionMode) {
        const qid = this.props.questionID?.toLowerCase();
        latest = qid && this.props.account
          ? await contractScripts.getResponse(this.props.provider, this.props.account, qid, slug)
          : null;
      } else {
        latest = this.props.account
          ? await this.getSurveyResponse(this.props.account, this.props.surveyId)
          : null;
      }
      if (!latest) latest = this.state.userAnswers || null;

      const sourceSlice = latest
        ? this.buildSliceFromUserAnswers(latest)
        : (this.state.surveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} });

      // Capture encrypted rating envelopes (if present) so we can decrypt them alongside answers.
      const ratingEnvelopesByQid = {};
      try {
        const addFromRespObj = (respObj) => {
          if (!respObj || typeof respObj !== 'object') return;
          const id = String(respObj?.questionID || respObj?.questionId || respObj?.questionIDHash || '').trim().toLowerCase();
          if (!id) return;
          const impEnv = typeof respObj?.importanceEncrypted === 'string' ? respObj.importanceEncrypted : '';
          const convEnv = typeof respObj?.convictionEncrypted === 'string' ? respObj.convictionEncrypted : '';
          if (!impEnv && !convEnv) return;
          ratingEnvelopesByQid[id] = { importanceEncrypted: impEnv, convictionEncrypted: convEnv };
        };
        if (latest && typeof latest === 'object') {
          if (Array.isArray(latest.responses)) {
            latest.responses.forEach(addFromRespObj);
          } else {
            addFromRespObj(latest);
          }
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      // carry forward importance if missing
      const prevSlice = this.state.surveysResponseState?.[surveyIndex] || {};
      Object.keys(prevSlice.importance || {}).forEach((qId) => {
        if (sourceSlice.importance[qId] === undefined || sourceSlice.importance[qId] === null) {
          sourceSlice.importance[qId] = prevSlice.importance[qId];
        }
      });
      Object.keys(prevSlice.conviction || {}).forEach((qId) => {
        if (sourceSlice.conviction[qId] === undefined || sourceSlice.conviction[qId] === null) {
          sourceSlice.conviction[qId] = prevSlice.conviction[qId];
        }
      });

      const providerKind = cryptoUtils.getProviderKind(this.props.provider);
      const chainId = this.props.network?.id;
      const surveyId = this.resolveDecryptSurveyId(sourceSlice, this.props.questionID);

      const litHooks =
        this.props.lit ||
        this.props.litHooks ||
        (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
      const lit = litHooks && litHooks.getKey ? { getKey: litHooks.getKey } : undefined;

      const opts = {
        providerKind,
        provider: this.props.provider,
        account: this.props.account,
        chainId,
        surveyId,
        ...(lit ? { lit } : {}),
        hasher: this.state.hasher, // INJECT HASHER
        throwOnError: true,
      };

      // Use whichever set is actually rendered (pile or standard pool)
      const poolForDecrypt =
        (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)
          ? this.state.questionPool
          : (Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : []);

      // decrypt visible answers
      const decryptedSlice = await cryptoUtils.decryptMultipleAnswers(
        sourceSlice,
        poolForDecrypt,
        opts
      );

      // Also decrypt rating envelopes (importance/conviction) when present.
      const decryptedImportanceFromEnv = {};
      const decryptedConvictionFromEnv = {};
      try {
        const litOpts = lit ? lit : undefined;
        const toNum = (v) => {
          if (v === undefined || v === null) return null;
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        };
        const qids = Object.keys(ratingEnvelopesByQid || {});
        for (const qId of qids) {
          const envs = ratingEnvelopesByQid[qId] || {};
          if (envs.importanceEncrypted) {
            try {
              const v = await cryptoUtils.decryptEnvelopeValue(envs.importanceEncrypted, {
                account: this.props.account,
                chainId,
                providerLike: this.props.provider,
                ...(litOpts ? { litOpts } : {}),
              });
              const n = toNum(v);
              if (n !== null) decryptedImportanceFromEnv[qId] = n;
            } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          }
          if (envs.convictionEncrypted) {
            try {
              const v = await cryptoUtils.decryptEnvelopeValue(envs.convictionEncrypted, {
                account: this.props.account,
                chainId,
                providerLike: this.props.provider,
                ...(litOpts ? { litOpts } : {}),
              });
              const n = toNum(v);
              if (n !== null) decryptedConvictionFromEnv[qId] = n;
            } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          }
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      // Preserve user intent for encryption toggles & store zkSalt when present
      Object.keys(decryptedSlice.answers || {}).forEach(qId => {
        const prevEnc = this.state.surveysResponseState?.[surveyIndex]?.answers?.[qId]?.encrypted;
        if (typeof prevEnc === 'boolean') decryptedSlice.answers[qId].encrypted = prevEnc;
        else if (sourceSlice.answers?.[qId]?.value === '*' &&
                (sourceSlice.answers?.[qId]?.encryptedPortion || sourceSlice.answers?.[qId]?.encrypted)) {
          decryptedSlice.answers[qId].encrypted = true;
        }
      });
      Object.keys(decryptedSlice.additionalComments || {}).forEach(qId => {
        const prevEnc = this.state.surveysResponseState?.[surveyIndex]?.additionalComments?.[qId]?.encrypted;
        if (typeof prevEnc === 'boolean') decryptedSlice.additionalComments[qId].encrypted = prevEnc;
        else if (sourceSlice.additionalComments?.[qId]?.value === '*' &&
                (sourceSlice.additionalComments?.[qId]?.encryptedPortion || sourceSlice.additionalComments?.[qId]?.encrypted)) {
          decryptedSlice.additionalComments[qId].encrypted = true;
        }
      });

      this.setState(prevState => {
        const surveysResponseStateCopy = [...(prevState.surveysResponseState || [])];
        const nextSlice = {
          answers: { ...(prevState.surveysResponseState?.[surveyIndex]?.answers || {}), ...(decryptedSlice.answers || {}) },
          importance: {
            ...(prevState.surveysResponseState?.[surveyIndex]?.importance || {}),
            ...(decryptedSlice.importance || {}),
            ...(decryptedImportanceFromEnv || {}),
          },
          conviction: {
            ...(prevState.surveysResponseState?.[surveyIndex]?.conviction || {}),
            ...(decryptedConvictionFromEnv || {}),
          },
          additionalComments: { ...(prevState.surveysResponseState?.[surveyIndex]?.additionalComments || {}), ...(decryptedSlice.additionalComments || {}) },
        };

        Object.keys(decryptedSlice.answers || {}).forEach(qId => {
          const s = decryptedSlice.answers[qId];
          if (s && s.zkSalt) {
            nextSlice.answers[qId] = { ...(nextSlice.answers[qId] || {}), zkSalt: s.zkSalt };
          }
        });
        Object.keys(decryptedSlice.additionalComments || {}).forEach(qId => {
          const s = decryptedSlice.additionalComments[qId];
          if (s && s.zkSalt) {
            nextSlice.additionalComments[qId] = { ...(nextSlice.additionalComments[qId] || {}), zkSalt: s.zkSalt };
          }
        });

        surveysResponseStateCopy[surveyIndex] = nextSlice;

        // Always reset baseline to decrypted state so diffs are zeroed
        const updates = {
          surveysResponseState: surveysResponseStateCopy,
          startFresh: false,
          displayAnswerMode: false,
          isEditing: true,
          isDecrypting: false,
          suppressPrefill: true,
          editBaseline: this.deepClone(nextSlice),
          isDirty: false,
          modifiedCount: 0,
        };
        return updates;
      }, () => {
        const jsonPreview = this.prepareJsonAndHash(surveyIndex);
        this.setState({ jsonPreview });
        this.persistDraftSafely && this.persistDraftSafely(0);
      });
    } catch (error) {
      surveyLog.error('Error decrypting answers:', error);
      this.setState({ isDecrypting: false, submissionError: error.message || 'Decryption failed.' });
    }
  }


  handleDecryptViewedResponseField = async (questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    const taskKey = this.buildDecryptTaskKey('viewed', questionId, fieldToDecrypt, responseOverride);
    return this.runDedupedDecryptTask(
      taskKey,
      () => this.handleDecryptViewedResponseFieldInternal(questionId, fieldToDecrypt, responseOverride)
    );
  };

  getViewedResponseOverrideForQuestion = (questionId, responseContainer = this.state?.parsedViewAddressAnswers) => {
    const qid = String(questionId || '').trim().toLowerCase();
    if (!qid || !responseContainer || typeof responseContainer !== 'object') return null;

    const viewedResponder = String(
      this.props.responderAddress || this.props.viewAddress || ''
    ).trim().toLowerCase();

    const decorateResponse = (rawResponse) => {
      if (!rawResponse || typeof rawResponse !== 'object') return null;
      const next = { ...rawResponse };
      const rawId = String(next.questionID || next.questionId || '').trim().toLowerCase();
      if (rawId && rawId !== qid) return null;
      if (!next.questionID && !next.questionId) next.questionID = qid;
      if (viewedResponder) {
        if (!next.responder) next.responder = viewedResponder;
        if (!next.responderAddress) next.responderAddress = viewedResponder;
      }
      return next;
    };

    if (Array.isArray(responseContainer.responses)) {
      for (const response of responseContainer.responses) {
        const decorated = decorateResponse(response);
        if (decorated) return decorated;
      }
      return null;
    }

    return decorateResponse(responseContainer);
  };

  handleDecryptViewedResponseFieldInternal = async (questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    // Require wallet login (viewer). Decryption is enforced by Lit access control conditions.
    if (!this.props || !this.props.loginComplete || !this.props.account) {
      return false;
    }

    const qid = String(questionId || '').trim().toLowerCase();
    if (!qid || !responseOverride || typeof responseOverride !== 'object') {
      return false;
    }

    try {
      // Build baseline slice directly from the viewed response payload so decrypt does not depend on local draft state.
      const shaped = { ...responseOverride };
      if (!shaped.questionID && shaped.questionId) shaped.questionID = shaped.questionId;
      if (!shaped.questionID) shaped.questionID = qid;

      let baselineForDecrypt = null;
      try {
        baselineForDecrypt = this.buildSliceFromUserAnswers(shaped);
      } catch (_) {
        baselineForDecrypt = null;
      }
      if (!baselineForDecrypt || typeof baselineForDecrypt !== 'object') {
        baselineForDecrypt = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      }
      if (!baselineForDecrypt.answers) baselineForDecrypt.answers = {};
      if (!baselineForDecrypt.additionalComments) baselineForDecrypt.additionalComments = {};

      const maskedAns =
        (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') &&
        baselineForDecrypt?.answers?.[qid]?.value === '*' &&
        (baselineForDecrypt?.answers?.[qid]?.encryptedPortion ||
          baselineForDecrypt?.answers?.[qid]?.encrypted);

      const maskedAdd =
        (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') &&
        baselineForDecrypt?.additionalComments?.[qid]?.value === '*' &&
        (baselineForDecrypt?.additionalComments?.[qid]?.encryptedPortion ||
          baselineForDecrypt?.additionalComments?.[qid]?.encrypted);

      if ((maskedAns || maskedAdd) && this.props.account) {
        try {
          const context = resolveDecryptHydrationContext(this.props, this._getEffectiveDraftSlug());
          const slug = context.sessionSlug || '';
          const networkID = context.networkIdStr;
          const responderForLatest = String(
            responseOverride?.responder ||
            responseOverride?.responderAddress ||
            this.props.responderAddress ||
            this.props.viewAddress ||
            ''
          ).trim();

          if (networkID && responderForLatest) {
            const questionsCache = readQuestionsCache(slug) || {};
            const latest = await this.getLatestQuestionResponse(
              responderForLatest,
              qid,
              networkID,
              questionsCache
            );

            if (latest) {
              if (maskedAns && latest.answer?.encryptedPortion) {
                baselineForDecrypt.answers = { ...(baselineForDecrypt.answers || {}) };
                baselineForDecrypt.answers[qid] = {
                  ...(baselineForDecrypt.answers[qid] || { value: '*', encrypted: true, hash: '' }),
                  encrypted: !!(latest.answer.encrypted || baselineForDecrypt.answers?.[qid]?.encrypted),
                  hash: latest.answer.hash || baselineForDecrypt.answers?.[qid]?.hash || '',
                  encryptedPortion: latest.answer.encryptedPortion,
                };
              }
              if (maskedAdd && latest.additional?.encryptedPortion) {
                baselineForDecrypt.additionalComments = { ...(baselineForDecrypt.additionalComments || {}) };
                baselineForDecrypt.additionalComments[qid] = {
                  ...(baselineForDecrypt.additionalComments[qid] || { value: '*', encrypted: true, hash: '' }),
                  encrypted: !!(latest.additional.encrypted || baselineForDecrypt.additionalComments?.[qid]?.encrypted),
                  hash: latest.additional.hash || baselineForDecrypt.additionalComments?.[qid]?.hash || '',
                  encryptedPortion: latest.additional.encryptedPortion,
                };
              }
            }
          }
        } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }

      if (!maskedAns && !maskedAdd) {
        return false;
      }

      const keysToMark = [];
      if (maskedAns) keysToMark.push(`${qid}:answer`);
      if (maskedAdd) keysToMark.push(`${qid}:additional`);

      this.setState((prev) => ({
        isDecrypting: true,
        submissionError: '',
        suppressPrefill: true,
        decryptingByKey: {
          ...(prev.decryptingByKey || {}),
          ...(keysToMark.reduce((acc, k) => { acc[k] = true; return acc; }, {})),
        },
      }));

      const providerKind = cryptoUtils.getProviderKind(this.props.provider);
      const chainId = this.props.network?.id;
      const surveyId = this.resolveDecryptSurveyId(baselineForDecrypt, qid);

      const poolForDecrypt =
        (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)
          ? this.state.questionPool
          : (Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : []);

      const litHooks =
        this.props.lit ||
        this.props.litHooks ||
        (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
      const lit = litHooks && litHooks.getKey ? { getKey: litHooks.getKey } : undefined;

      const opts = {
        providerKind,
        provider: this.props.provider,
        account: this.props.account,
        chainId,
        surveyId,
        questionPool: poolForDecrypt,
        ...(lit ? { lit } : {}),
        hasher: this.state.hasher,
        throwOnError: true,
      };

      const decryptedStateSlice = await cryptoUtils.decryptSingleField(
        baselineForDecrypt,
        qid,
        fieldToDecrypt,
        opts
      );

      const producedAnswer = !!(decryptedStateSlice.answers && decryptedStateSlice.answers[qid]);
      const producedAdditional = !!(
        decryptedStateSlice.additionalComments &&
        decryptedStateSlice.additionalComments[qid]
      );
      const didUpdate = producedAnswer || producedAdditional;

      // Also decrypt encrypted rating envelopes when present (so conviction/importance stays private by default).
      let decryptedImportance = null;
      let decryptedConviction = null;
      try {
        const toNum = (v) => {
          if (v === undefined || v === null) return null;
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        };
        const litOpts = lit ? lit : undefined;
        const impEnv = typeof responseOverride?.importanceEncrypted === 'string' ? responseOverride.importanceEncrypted : '';
        const convEnv = typeof responseOverride?.convictionEncrypted === 'string' ? responseOverride.convictionEncrypted : '';
        if (impEnv) {
          try {
            const v = await cryptoUtils.decryptEnvelopeValue(impEnv, {
              account: this.props.account,
              chainId,
              providerLike: this.props.provider,
              ...(litOpts ? { litOpts } : {}),
            });
            decryptedImportance = toNum(v);
          } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        }
        if (convEnv) {
          try {
            const v = await cryptoUtils.decryptEnvelopeValue(convEnv, {
              account: this.props.account,
              chainId,
              providerLike: this.props.provider,
              ...(litOpts ? { litOpts } : {}),
            });
            decryptedConviction = toNum(v);
          } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      this.setState((prev) => {
        const cleared = { ...(prev.decryptingByKey || {}) };
        keysToMark.forEach((k) => { cleared[k] = false; });

        const applyToResponse = (resp) => {
          if (!resp || typeof resp !== 'object') return resp;
          const next = { ...resp };

          if (producedAnswer) {
            const incoming = decryptedStateSlice.answers[qid];
            next.answer = {
              ...(next.answer || {}),
              value: incoming?.value,
            };
          }
          if (producedAdditional) {
            const incoming = decryptedStateSlice.additionalComments[qid];
            next.additional = {
              ...(next.additional || {}),
              value: incoming?.value,
            };
          }
          if (decryptedImportance !== null && decryptedImportance !== undefined) {
            next.importance = decryptedImportance;
          }
          if (decryptedConviction !== null && decryptedConviction !== undefined) {
            next.conviction = decryptedConviction;
          }
          return next;
        };

        const prevViewed = prev.parsedViewAddressAnswers;
        let nextViewed = prevViewed;
        if (prevViewed && typeof prevViewed === 'object') {
          if (Array.isArray(prevViewed.responses)) {
            const nextResponses = prevViewed.responses.map((r) => {
              const rid = String(r?.questionID || r?.questionId || '').trim().toLowerCase();
              if (rid !== qid) return r;
              return applyToResponse(r);
            });
            nextViewed = { ...prevViewed, responses: nextResponses };
          } else {
            nextViewed = applyToResponse(prevViewed);
          }
        }

        return {
          parsedViewAddressAnswers: nextViewed,
          viewAddressAnswers: nextViewed ? JSON.stringify(nextViewed) : prev.viewAddressAnswers,
          isDecrypting: false,
          decryptingByKey: cleared,
          ...(didUpdate ? {} : { submissionError: 'Decryption failed.' }),
        };
      });

      return didUpdate;
    } catch (error) {
      surveyLog.error(`Error decrypting viewed response ${fieldToDecrypt} for ${questionId}`, error);
      this.setState((prev) => {
        const cleared = { ...(prev.decryptingByKey || {}) };
        if (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') cleared[`${qid}:answer`] = false;
        if (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') cleared[`${qid}:additional`] = false;
        return {
          isDecrypting: false,
          submissionError: error.message || 'Decryption failed.',
          decryptingByKey: cleared,
        };
      });
      return false;
    }
  };

  handleDecryptQuestionAnswer = async (questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    const taskKey = this.buildDecryptTaskKey('self', questionId, fieldToDecrypt, responseOverride);
    return this.runDedupedDecryptTask(
      taskKey,
      () => this.handleDecryptQuestionAnswerInternal(questionId, fieldToDecrypt, responseOverride)
    );
  };

  handleDecryptQuestionAnswerInternal = async (questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    // Require wallet login
    if (!this.props || !this.props.loginComplete || !this.props.account) {
      return false;
    }

    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;

    try {
      // If we're viewing someone else's response (via /question/:id/:responder or /survey/:id?address=),
      // decrypt in-place against the viewed response object (do NOT switch to edit mode).
      const viewerLower = String(this.props.account || '').toLowerCase();
      const viewedResponderLower = String(
        this.props.responderAddress || this.props.viewAddress || ''
      ).trim().toLowerCase();
      const effectiveResponseOverride =
        responseOverride && typeof responseOverride === 'object'
          ? responseOverride
          : this.getViewedResponseOverrideForQuestion(questionId);
      const hasResponseOverride = !!(effectiveResponseOverride && typeof effectiveResponseOverride === 'object');
      const responderLower = String(
        hasResponseOverride
          ? (
              effectiveResponseOverride.responder ||
              effectiveResponseOverride.responderAddress ||
              viewedResponderLower ||
              ''
            )
          : ''
      ).toLowerCase();
      const isViewedResponseMode = !!viewedResponderLower && viewedResponderLower !== viewerLower;
      if (isViewedResponseMode) {
        if (!hasResponseOverride) return false;
        return await this.handleDecryptViewedResponseField(
          questionId,
          fieldToDecrypt,
          effectiveResponseOverride
        );
      }

      // Build a working baseline to decrypt from (current slice → userAnswers → empty)
      let baselineSlice = this.state.surveysResponseState?.[surveyIndex];
      if (!baselineSlice && this.state.userAnswers) {
        baselineSlice = this.buildSliceFromUserAnswers(this.state.userAnswers);
      }
      let baselineForDecrypt = this.deepClone(
        baselineSlice || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }
      );

      // If we have a concrete response payload (e.g. decrypt clicked in view mode), merge its envelope into the baseline.
      if (effectiveResponseOverride && typeof effectiveResponseOverride === 'object') {
        try {
          const ans = effectiveResponseOverride.answer || {};
          const add = effectiveResponseOverride.additional || {};
          baselineForDecrypt.answers = { ...(baselineForDecrypt.answers || {}) };
          baselineForDecrypt.additionalComments = { ...(baselineForDecrypt.additionalComments || {}) };
          baselineForDecrypt.answers[questionId] = {
            ...(baselineForDecrypt.answers[questionId] || {}),
            ...(Object.prototype.hasOwnProperty.call(ans, 'value') ? { value: ans.value } : {}),
            encrypted: !!(ans.encrypted || ans.encryptedPortion || baselineForDecrypt.answers?.[questionId]?.encrypted),
            ...(ans.hash ? { hash: ans.hash } : {}),
            ...(ans.encryptedPortion ? { encryptedPortion: ans.encryptedPortion } : {}),
          };
          baselineForDecrypt.additionalComments[questionId] = {
            ...(baselineForDecrypt.additionalComments[questionId] || {}),
            ...(Object.prototype.hasOwnProperty.call(add, 'value') ? { value: add.value } : {}),
            encrypted: !!(add.encrypted || add.encryptedPortion || baselineForDecrypt.additionalComments?.[questionId]?.encrypted),
            ...(add.hash ? { hash: add.hash } : {}),
            ...(add.encryptedPortion ? { encryptedPortion: add.encryptedPortion } : {}),
          };
        } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }

      // If masked but envelope missing, hydrate the latest encryptedPortion from cache/chain first.
      // Also capture rating envelopes so we can decrypt conviction/importance alongside the answer.
      const qidLower = String(questionId || '').trim().toLowerCase();
      const extractRatingEnvs = (obj) => {
        if (!obj || typeof obj !== 'object') return null;
        const impEnv = typeof obj.importanceEncrypted === 'string' ? obj.importanceEncrypted : '';
        const convEnv = typeof obj.convictionEncrypted === 'string' ? obj.convictionEncrypted : '';
        if (!impEnv && !convEnv) return null;
        return { importanceEncrypted: impEnv, convictionEncrypted: convEnv };
      };
      const findResponseObjWithRatingEnvs = (container) => {
        if (!container || typeof container !== 'object') return null;
        if (Array.isArray(container.responses)) {
          return (
            container.responses.find(
              (r) =>
                String(r?.questionID || r?.questionId || '').trim().toLowerCase() === qidLower
            ) || null
          );
        }
        // Single-question payload
        const id = String(container.questionID || container.questionId || '').trim().toLowerCase();
        if (id && id !== qidLower) return null;
        return container;
      };
      const mergeRatingEnvs = (prev, nextObj) => {
        const p = prev && typeof prev === 'object' ? prev : null;
        const n = extractRatingEnvs(nextObj);
        if (!p) return n;
        if (!n) return p;
        return {
          importanceEncrypted: n.importanceEncrypted || p.importanceEncrypted || '',
          convictionEncrypted: n.convictionEncrypted || p.convictionEncrypted || '',
        };
      };

      // Seed from the best available payloads so rating decrypt works even when we skip hydration.
      let latestRatingEnvs = mergeRatingEnvs(null, effectiveResponseOverride);
      latestRatingEnvs = mergeRatingEnvs(
        latestRatingEnvs,
        findResponseObjWithRatingEnvs(this.state.userAnswers)
      );
      try {
        const maskedAnsForHydrate =
          (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') &&
          baselineForDecrypt?.answers?.[questionId]?.value === '*' &&
          (baselineForDecrypt?.answers?.[questionId]?.encryptedPortion ||
            baselineForDecrypt?.answers?.[questionId]?.encrypted);

        const maskedAddForHydrate =
          (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') &&
          baselineForDecrypt?.additionalComments?.[questionId]?.value === '*' &&
          (baselineForDecrypt?.additionalComments?.[questionId]?.encryptedPortion ||
            baselineForDecrypt?.additionalComments?.[questionId]?.encrypted);

        if ((maskedAnsForHydrate || maskedAddForHydrate) && this.props.account) {
          const context = resolveDecryptHydrationContext(this.props, this._getEffectiveDraftSlug());
          const slug = context.sessionSlug || '';
          const networkID = context.networkIdStr;

          if (networkID) {
            const questionsCache = readQuestionsCache(slug) || {};

            const fetchQid = String(questionId || '').toLowerCase();
            const latest = await this.getLatestQuestionResponse(
              this.props.account,
              fetchQid,
              networkID,
              questionsCache
            );

            if (latest) {
              // Prefer non-empty envelope values from the latest chain payload, but never clobber
              // previously discovered envelopes with empties.
              latestRatingEnvs = mergeRatingEnvs(latestRatingEnvs, latest);
              if (maskedAnsForHydrate && latest.answer?.encryptedPortion) {
                baselineForDecrypt.answers = { ...(baselineForDecrypt.answers || {}) };
                baselineForDecrypt.answers[questionId] = {
                  ...(baselineForDecrypt.answers[questionId] || {
                    value: '*', encrypted: true, hash: ''
                  }),
                  encrypted: !!(latest.answer.encrypted || baselineForDecrypt.answers?.[questionId]?.encrypted),
                  hash: latest.answer.hash || baselineForDecrypt.answers?.[questionId]?.hash || '',
                  encryptedPortion: latest.answer.encryptedPortion,
                };
              }
              if (maskedAddForHydrate && latest.additional?.encryptedPortion) {
                baselineForDecrypt.additionalComments = { ...(baselineForDecrypt.additionalComments || {}) };
                baselineForDecrypt.additionalComments[questionId] = {
                  ...(baselineForDecrypt.additionalComments[questionId] || {
                    value: '*', encrypted: true, hash: ''
                  }),
                  encrypted: !!(latest.additional.encrypted || baselineForDecrypt.additionalComments?.[questionId]?.encrypted),
                  hash: latest.additional.hash || baselineForDecrypt.additionalComments?.[questionId]?.hash || '',
                  encryptedPortion: latest.additional.encryptedPortion,
                };
              }
            }
          }
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      const providerKind = cryptoUtils.getProviderKind(this.props.provider);
      const chainId = this.props.network?.id;
      const surveyId = this.resolveDecryptSurveyId(baselineForDecrypt, questionId);

      const maskedAns =
        (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') &&
        baselineForDecrypt?.answers?.[questionId]?.value === '*' &&
        (baselineForDecrypt?.answers?.[questionId]?.encryptedPortion ||
        baselineForDecrypt?.answers?.[questionId]?.encrypted);

      const maskedAdd =
        (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') &&
        baselineForDecrypt?.additionalComments?.[questionId]?.value === '*' &&
        (baselineForDecrypt?.additionalComments?.[questionId]?.encryptedPortion ||
        baselineForDecrypt?.additionalComments?.[questionId]?.encrypted);

      if (!maskedAns && !maskedAdd) {
        return false;
      }

      const keysToMark = [];
      if (maskedAns) keysToMark.push(`${questionId}:answer`);
      if (maskedAdd) keysToMark.push(`${questionId}:additional`);

      this.setState(prev => ({
        isDecrypting: true,
        submissionError: '',
        suppressPrefill: true,
        decryptingByKey: {
          ...(prev.decryptingByKey || {}),
          ...(keysToMark.reduce((acc, k) => { acc[k] = true; return acc; }, {}))
        }
      }));

      const poolForDecrypt =
        (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)
          ? this.state.questionPool
          : (Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : []);

      const litHooks =
        this.props.lit ||
        this.props.litHooks ||
        (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
      const lit = litHooks && litHooks.getKey ? { getKey: litHooks.getKey } : undefined;

      const opts = {
        providerKind,
        provider: this.props.provider,
        account: this.props.account,
        chainId,
        surveyId,
        questionPool: poolForDecrypt,
        ...(lit ? { lit } : {}),
        hasher: this.state.hasher, // INJECT HASHER
        throwOnError: true,
      };

      const decryptedStateSlice = await cryptoUtils.decryptSingleField(
        baselineForDecrypt,
        questionId,
        fieldToDecrypt,
        opts
      );

      const producedAnswer = !!(decryptedStateSlice.answers && decryptedStateSlice.answers[questionId]);
      const producedAdditional = !!(decryptedStateSlice.additionalComments && decryptedStateSlice.additionalComments[questionId]);
      const didUpdate = producedAnswer || producedAdditional;

      // Attempt to decrypt encrypted rating envelopes too, if present on the latest chain payload.
      let decryptedImportance = null;
      let decryptedConviction = null;
      try {
        const toNum = (v) => {
          if (v === undefined || v === null) return null;
          const n = Number(v);
          return Number.isNaN(n) ? null : n;
        };

        const litOpts = lit ? lit : undefined;
        if (latestRatingEnvs?.importanceEncrypted) {
          try {
            const v = await cryptoUtils.decryptEnvelopeValue(latestRatingEnvs.importanceEncrypted, {
              account: this.props.account,
              chainId,
              providerLike: this.props.provider,
              ...(litOpts ? { litOpts } : {}),
            });
            decryptedImportance = toNum(v);
          } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        }
        if (latestRatingEnvs?.convictionEncrypted) {
          try {
            const v = await cryptoUtils.decryptEnvelopeValue(latestRatingEnvs.convictionEncrypted, {
              account: this.props.account,
              chainId,
              providerLike: this.props.provider,
              ...(litOpts ? { litOpts } : {}),
            });
            decryptedConviction = toNum(v);
          } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      this.setState(prevState => {
        const surveysResponseStateCopy = [...(prevState.surveysResponseState || [])];
        const targetStateSlice = {
          ...(surveysResponseStateCopy[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} })
        };

        if (producedAnswer) {
          const prevEncrypted = targetStateSlice.answers?.[questionId]?.encrypted;
          const incoming = decryptedStateSlice.answers[questionId];
          targetStateSlice.answers[questionId] = {
            ...(targetStateSlice.answers[questionId] || {}),
            value: incoming.value,
            encrypted: (typeof prevEncrypted === 'boolean')
              ? prevEncrypted
              : !!(baselineSlice?.answers?.[questionId]?.value === '*' &&
                  (baselineSlice?.answers?.[questionId]?.encryptedPortion || baselineSlice?.answers?.[questionId]?.encrypted)),
            ...(incoming.zkSalt ? { zkSalt: incoming.zkSalt } : {}),
          };
        }

        if (producedAdditional) {
          const prevEncrypted = targetStateSlice.additionalComments?.[questionId]?.encrypted;
          const incoming = decryptedStateSlice.additionalComments[questionId];
          targetStateSlice.additionalComments[questionId] = {
            ...(targetStateSlice.additionalComments[questionId] || {}),
            value: incoming.value,
            encrypted: (typeof prevEncrypted === 'boolean')
              ? prevEncrypted
              : !!(baselineSlice?.additionalComments?.[questionId]?.value === '*' &&
                  (baselineSlice?.additionalComments?.[questionId]?.encryptedPortion ||
                    baselineSlice?.additionalComments?.[questionId]?.encrypted)),
            ...(incoming.zkSalt ? { zkSalt: incoming.zkSalt } : {}),
          };
        }

        if (decryptedImportance !== null && decryptedImportance !== undefined) {
          targetStateSlice.importance = targetStateSlice.importance || {};
          targetStateSlice.importance[questionId] = decryptedImportance;
        }
        if (decryptedConviction !== null && decryptedConviction !== undefined) {
          targetStateSlice.conviction = targetStateSlice.conviction || {};
          targetStateSlice.conviction[questionId] = decryptedConviction;
        }

        surveysResponseStateCopy[surveyIndex] = targetStateSlice;

        const cleared = { ...(prevState.decryptingByKey || {}) };
        keysToMark.forEach(k => { cleared[k] = false; });

        // Update baseline for the specific decrypted fields so diffs remain 0
        let nextBaseline = prevState.editBaseline
            ? this.deepClone(prevState.editBaseline)
            : this.deepClone(baselineSlice || { answers: {}, importance: {}, conviction: {}, additionalComments: {} });

        // Ensure structure
        if (!nextBaseline.answers) nextBaseline.answers = {};
        if (!nextBaseline.additionalComments) nextBaseline.additionalComments = {};

        if (producedAnswer) {
             nextBaseline.answers[questionId] = this.deepClone(targetStateSlice.answers[questionId]);
        }
        if (producedAdditional) {
             nextBaseline.additionalComments[questionId] = this.deepClone(targetStateSlice.additionalComments[questionId]);
        }
        if (decryptedImportance !== null && decryptedImportance !== undefined) {
          nextBaseline.importance = nextBaseline.importance || {};
          nextBaseline.importance[questionId] = decryptedImportance;
        }
        if (decryptedConviction !== null && decryptedConviction !== undefined) {
          nextBaseline.conviction = nextBaseline.conviction || {};
          nextBaseline.conviction[questionId] = decryptedConviction;
        }

        const updates = {
          surveysResponseState: surveysResponseStateCopy,
          isEditing: true,
          displayAnswerMode: false,
          isDecrypting: false,
          suppressPrefill: true,
          decryptingByKey: cleared,
          editBaseline: nextBaseline, // Sync baseline for this field
          ...(didUpdate ? {} : { submissionError: 'Decryption failed.' }),
        };
        return updates;
      }, () => {
        this.updateJsonPreview && this.updateJsonPreview();
        this.persistDraftSafely && this.persistDraftSafely(0);
      });

      return didUpdate;
    } catch (error) {
      surveyLog.error(`Error decrypting ${fieldToDecrypt} for ${questionId}`, error);
      this.setState(prev => {
        const cleared = { ...(prev.decryptingByKey || {}) };
        if (fieldToDecrypt === 'answer' || fieldToDecrypt === 'both') cleared[`${questionId}:answer`] = false;
        if (fieldToDecrypt === 'additional' || fieldToDecrypt === 'both') cleared[`${questionId}:additional`] = false;
        return {
          isDecrypting: false,
          submissionError: error.message || 'Decryption failed.',
          decryptingByKey: cleared
        };
      });
      return false;
    }
  };



  handleAnswer = (surveyIndex, questionId, answer, options = {}) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft = options?.persistDraft !== false;
    const afterUpdate = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;

    const sourceSlice =
      this.state.surveysResponseState?.[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const prevAnswerState = sourceSlice.answers?.[questionId] || this.buildEmptyResponseFieldState(questionId);
    const question = this.getQuestionById(questionId);
    const isBinaryQuestion = !!(question && question.type === 'binary');
    const currentAnswer = prevAnswerState.value;

    let finalAnswer = answer;
    if (isBinaryQuestion && this.valuesEqual(currentAnswer, answer)) {
      finalAnswer = '';
    }

    const questionLocked = this.isQuestionLockedForResponse(questionId);
    const previousAudience = this.resolveFieldEncryptionAudience(prevAnswerState, questionId);
    const hasExistingEncryptionState =
      typeof prevAnswerState.encrypted === 'boolean' && !!previousAudience;
    const autoEncryptAnswers = questionLocked || (
      hasExistingEncryptionState
        ? false
        : this.getEffectiveRecipientsForQid(questionId).length > 0
    );
    const defaultAudience = autoEncryptAnswers ? 'gate' : 'self';
    const resolvedAudience = questionLocked
      ? 'gate'
      : (previousAudience || defaultAudience);
    const resolvedGateId = (questionLocked || resolvedAudience === 'gate')
      ? this.resolveFieldEncryptionGateId(prevAnswerState, questionId, 'answer')
      : null;
    const nextEncrypted = questionLocked
      ? true
      : (typeof prevAnswerState.encrypted === 'boolean'
        ? prevAnswerState.encrypted
        : autoEncryptAnswers);

    const shouldHash = !(Array.isArray(finalAnswer)) && typeof finalAnswer !== 'number' && !isBinaryQuestion;
    const hasExistingHash = typeof prevAnswerState.hash === 'string' && prevAnswerState.hash.length > 0;
    const unchangedValue = this.valuesEqual(currentAnswer, finalAnswer);
    const unchangedEncryption =
      !!prevAnswerState.encrypted === !!nextEncrypted &&
      (previousAudience || '') === (resolvedAudience || '') &&
      String(prevAnswerState.encryptionGateId || '') === String(resolvedGateId || '');

    if (unchangedValue && unchangedEncryption && (!shouldHash || hasExistingHash)) {
      return;
    }

    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState = [...this.state.surveysResponseState];
    const slice = { ...sourceSlice };
    const answerStr = (Array.isArray(finalAnswer) || typeof finalAnswer === 'number')
      ? JSON.stringify(finalAnswer)
      : String(finalAnswer ?? '');
    const newAnswerHash = shouldHash
      ? utils.keccak256(utils.toUtf8Bytes(answerStr))
      : '';

    slice.answers = {
      ...(slice.answers || {}),
      [questionId]: {
        ...prevAnswerState,
        value: finalAnswer,
        encrypted: nextEncrypted,
        encryptionAudience: resolvedAudience,
        encryptionGateId: resolvedGateId,
        audienceMode: 'explicit',
        hash: newAnswerHash,
      },
    };

    const prevAdditionalState =
      slice.additionalComments?.[questionId] ||
      this.buildEmptyResponseFieldState(questionId, 'additional');
    if (this.normalizeFieldAudienceMode(prevAdditionalState.audienceMode, 'additional', prevAdditionalState) !== 'explicit') {
      slice.additionalComments = {
        ...(slice.additionalComments || {}),
        [questionId]: this.buildInheritedAdditionalFieldState(
          prevAdditionalState,
          slice.answers[questionId],
          questionId
        ),
      };
    }

    newSurveysResponseState[surveyIndex] = slice;

    this.setState({
      surveysResponseState: newSurveysResponseState,
      isEditing: true,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit'),
    }, () => {
      this.scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) this.persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

  handleAdditional = (surveyIndex, questionId, additionalComments) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;

    const sourceSlice =
      this.state.surveysResponseState?.[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const inheritedAnswerState =
      sourceSlice.answers?.[questionId] ||
      this.buildEmptyResponseFieldState(questionId);
    const baseAdditionalState =
      sourceSlice.additionalComments?.[questionId] ||
      this.buildEmptyResponseFieldState(questionId, 'additional');
    const additionalAudienceMode = this.normalizeFieldAudienceMode(
      baseAdditionalState.audienceMode,
      'additional',
      baseAdditionalState
    );
    const prevAdditionalState = additionalAudienceMode === 'inherit'
      ? this.buildInheritedAdditionalFieldState(baseAdditionalState, inheritedAnswerState, questionId)
      : baseAdditionalState;
    const currentValue = prevAdditionalState.value;
    const normalizedAdditional = String(additionalComments ?? '');
    const newSurveysResponseState = [...this.state.surveysResponseState];
    const slice = { ...sourceSlice };

    const questionLocked = this.isQuestionLockedForResponse(questionId);
    const previousAudience = this.resolveFieldEncryptionAudience(prevAdditionalState, questionId, 'additional');
    const hasExistingEncryptionState =
      typeof prevAdditionalState.encrypted === 'boolean' && !!previousAudience;
    const autoEncryptAnswers = questionLocked || (
      hasExistingEncryptionState
        ? false
        : this.getEffectiveRecipientsForQid(questionId).length > 0
    );
    const defaultAudience = autoEncryptAnswers ? 'gate' : 'self';
    const resolvedAudience = questionLocked
      ? 'gate'
      : (previousAudience || defaultAudience);
    const resolvedGateId = (questionLocked || resolvedAudience === 'gate')
      ? this.resolveFieldEncryptionGateId(prevAdditionalState, questionId, 'additional')
      : null;
    const nextEncrypted = questionLocked
      ? true
      : (typeof prevAdditionalState.encrypted === 'boolean'
        ? prevAdditionalState.encrypted
        : autoEncryptAnswers);

    const unchangedValue = this.valuesEqual(currentValue, normalizedAdditional);
    const unchangedEncryption =
      !!prevAdditionalState.encrypted === !!nextEncrypted &&
      (previousAudience || '') === (resolvedAudience || '') &&
      String(prevAdditionalState.encryptionGateId || '') === String(resolvedGateId || '') &&
      this.normalizeFieldAudienceMode(prevAdditionalState.audienceMode, 'additional', prevAdditionalState) === additionalAudienceMode;
    const hasExistingHash = typeof prevAdditionalState.hash === 'string' && prevAdditionalState.hash.length > 0;
    if (unchangedValue && unchangedEncryption && hasExistingHash) {
      return;
    }

    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newAnswerHash = utils.keccak256(utils.toUtf8Bytes(normalizedAdditional));

    slice.additionalComments = {
      ...(slice.additionalComments || {}),
      [questionId]: {
        ...prevAdditionalState,
        value: normalizedAdditional,
        encrypted: nextEncrypted,
        encryptionAudience: resolvedAudience,
        encryptionGateId: resolvedGateId,
        audienceMode: additionalAudienceMode,
        hash: newAnswerHash
      }
    };

    newSurveysResponseState[surveyIndex] = slice;

    this.setState({
      surveysResponseState: newSurveysResponseState,
      isEditing: true,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit'),
    }, () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely();
    });
  };

  handleConviction = (surveyIndex, questionId, conviction, options = {}) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft = options?.persistDraft !== false;
    const afterUpdate = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue = this.state.surveysResponseState?.[surveyIndex]?.conviction?.[questionId];
    if (priorValue === conviction) return;
    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState = [...this.state.surveysResponseState];
    const slice = { ...(newSurveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
    slice.conviction = { ...(slice.conviction || {}), [questionId]: conviction };
    newSurveysResponseState[surveyIndex] = slice;

    this.setState({
      surveysResponseState: newSurveysResponseState,
      isEditing: true,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit'),
    }, () => {
      this.scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) this.persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

  handleImportance = (surveyIndex, questionId, importance, options = {}) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft = options?.persistDraft !== false;
    const afterUpdate = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue = this.state.surveysResponseState?.[surveyIndex]?.importance?.[questionId];
    if (priorValue === importance) return;
    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState = [...this.state.surveysResponseState];
    const slice = { ...(newSurveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
    slice.importance = { ...(slice.importance || {}), [questionId]: importance };
    newSurveysResponseState[surveyIndex] = slice;

    this.setState({
      surveysResponseState: newSurveysResponseState,
      isEditing: true,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit'),
    }, () => {
      this.scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) this.persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

  getQuadraticVoteCost = (votes) => {
    const value = Number(votes) || 0;
    return value * value;
  };

  getQuadraticVoteWeight = (credits) => {
    const value = Number(credits) || 0;
    return Math.sqrt(Math.max(0, value));
  };

  /**
   * Toggle encryption for the main answer field.
   * Signature must remain: (surveyIndex, questionId, newEncryptedState)
   */
  toggleAnswerEncryption = (surveyIndex, questionId, newEncryptedState) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    this.invalidateDiffCaches();

    this.setState(prev => {
      const arr = Array.isArray(prev.surveysResponseState) ? [...prev.surveysResponseState] : [];
      while (arr.length <= idx) arr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });

      const slice = { ...(arr[idx] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
      const locked = this.isQuestionLockedForResponse(qid);
      const effectiveEncrypted = locked ? true : !!newEncryptedState;
      const curr = { ...(slice.answers?.[qid] || this.buildEmptyResponseFieldState(qid)) };
      curr.encrypted = effectiveEncrypted;
      curr.encryptionAudience = locked
        ? 'gate'
        : (effectiveEncrypted ? this.resolveFieldEncryptionAudience(curr, qid, 'answer') : 'self');
      curr.encryptionGateId = effectiveEncrypted && curr.encryptionAudience === 'gate'
        ? this.resolveFieldEncryptionGateId(curr, qid, 'answer')
        : null;
      curr.audienceMode = 'explicit';

      slice.answers = { ...(slice.answers || {}), [qid]: curr };
      const nextAdditional = {
        ...(slice.additionalComments?.[qid] || this.buildEmptyResponseFieldState(qid, 'additional')),
      };
      if (this.normalizeFieldAudienceMode(nextAdditional.audienceMode, 'additional', nextAdditional) !== 'explicit') {
        slice.additionalComments = {
          ...(slice.additionalComments || {}),
          [qid]: this.buildInheritedAdditionalFieldState(nextAdditional, curr, qid),
        };
      }
      arr[idx] = slice;

      return {
        surveysResponseState: arr,
        lockAudienceMenuByQuestion: effectiveEncrypted
          ? prev.lockAudienceMenuByQuestion
          : {},
        lockAudienceGateDetailsByQuestion: effectiveEncrypted
          ? prev.lockAudienceGateDetailsByQuestion
          : {},
        submittedSinceLastEdit: updateSubmittedSinceLastEdit(prev.submittedSinceLastEdit, 'user_edit'),
      };
    }, () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };



  /**
   * Toggle encryption for the additional comments field.
   * Signature must remain: (surveyIndex, questionId, newEncryptedState)
   */
  toggleAdditionalCommentsEncryption = (surveyIndex, questionId, newEncryptedState) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    this.invalidateDiffCaches();

    this.setState(prev => {
      const arr = Array.isArray(prev.surveysResponseState) ? [...prev.surveysResponseState] : [];
      while (arr.length <= idx) arr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });

      const slice = { ...(arr[idx] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
      const locked = this.isQuestionLockedForResponse(qid);
      const effectiveEncrypted = locked ? true : !!newEncryptedState;
      const curr = { ...(slice.additionalComments?.[qid] || this.buildEmptyResponseFieldState(qid, 'additional')) };
      curr.encrypted = effectiveEncrypted;
      curr.encryptionAudience = locked
        ? 'gate'
        : (effectiveEncrypted ? this.resolveFieldEncryptionAudience(curr, qid, 'additional') : 'self');
      curr.encryptionGateId = effectiveEncrypted && curr.encryptionAudience === 'gate'
        ? this.resolveFieldEncryptionGateId(curr, qid, 'additional')
        : null;
      curr.audienceMode = 'explicit';

      slice.additionalComments = { ...(slice.additionalComments || {}), [qid]: curr };
      arr[idx] = slice;

      return {
        surveysResponseState: arr,
        lockAudienceMenuByQuestion: effectiveEncrypted
          ? prev.lockAudienceMenuByQuestion
          : {},
        lockAudienceGateDetailsByQuestion: effectiveEncrypted
          ? prev.lockAudienceGateDetailsByQuestion
          : {},
        submittedSinceLastEdit: updateSubmittedSinceLastEdit(prev.submittedSinceLastEdit, 'user_edit'),
      };
    }, () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };



  toggleShowJson = () => {
    this.setState(prevState => ({ showJson: !prevState.showJson }));
  };

  toggleDisplayAnswerMode = () => {
    this.setState(
      prevState => ({
        displayAnswerMode: !prevState.displayAnswerMode,
        isEditing: !prevState.displayAnswerMode,
      }),
      async () => {
        if (this.state.displayAnswerMode) {
          if (this.props.singleQuestionMode && this.props.responderAddress) {
            await this.fetchSingleQuestionData();
          } else if (this.props.viewAddress) {
            await this.fetchSurveyResponse();
          }
        } else {
          this.setState({ parsedViewAddressAnswers: null });
        }
        this.updateJsonPreview();
      }
    );
  };

  handleUpdateResponse = async () => {
    if (this.state.isEditing) {
      await this.encryptAndUpload();
      this.setState({ isEditing: false, userHasResponse: true, userResponseEncrypted: true });
    } else {
      this.handleDecryptEdit();
    }
  };

  handleShowJsonAtBottom = () => {
    if (!this.state.showJson) {
      this.setState({ showJson: true }, () => {
        if (this.bottomRef.current) {
          this.bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } else {
      if (this.bottomRef.current) {
        this.bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  handleScrollToTop = () => {
    if (!this.state.showJson) {
      this.setState({ showJson: true }, () => {
        if (this.topRef.current) {
          this.topRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } else {
      if (this.topRef.current) {
        this.topRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  getSurveyResponse = async (responderAddress, surveyID) => {
    // Prefer id-aware group resolution so /survey/:id outside /session still resolves
    const slug = resolveSlugForIds({
      surveyId: surveyID,
      props: this.props,
      network: this.props.network,
    });
    const surveyAnswers = await contractScripts.getSurveyResponse(
      this.props.provider,
      responderAddress,
      surveyID,
      slug
    );
    return surveyAnswers;
  };

  getSurveyMetadataForJson = (surveyHash) => {
    if (!surveyHash) return { surveyTitle: null, sessionName: '' };

    try {
      const slug = resolveSlugForIds({
        surveyId: surveyHash,
        props: this.props,
        network: this.props.network,
      });
      const context = resolveResponseJsonContext(this.props, slug);
      const netIdStr = context.networkIdStr;
      const surveyIdLower = String(surveyHash || '').toLowerCase();
      const cacheKey = `${String(slug || '')}|${String(netIdStr || '')}|${surveyIdLower}`;
      const surveysCache = readSurveysCacheRef(slug) || {};
      if (
        this._surveyJsonMetaCache.key === cacheKey &&
        this._surveyJsonMetaCache.source === surveysCache &&
        this._surveyJsonMetaCache.value
      ) {
        return this._surveyJsonMetaCache.value;
      }

      let surveyTitle = null;
      let sessionName = '';
      const netBucket = netIdStr ? (surveysCache?.[netIdStr] || null) : null;
      const s = netBucket?.surveys?.[surveyIdLower];
      if (s?.title) surveyTitle = s.title;
      if (s?.sessionName) sessionName = s.sessionName;
      else if (context.sessionConfig?.sessionName) sessionName = context.sessionConfig.sessionName;

      const value = { surveyTitle, sessionName };
      this._surveyJsonMetaCache = { key: cacheKey, source: surveysCache, value };
      return value;
    } catch {
      return { surveyTitle: null, sessionName: '' };
    }
  };


  prepareJsonAndHash = (surveyIndex, responderAddress, overrideState = null) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;

    const surveyHash =
      this.props.isStandalone || this.props.singleQuestionMode ? undefined : this.props.surveyId;

    const surveyResponseState = overrideState || this.state.surveysResponseState[surveyIndex];
    const poolFromState = Array.isArray(this.state.questionPool) ? this.state.questionPool : [];
    const pilePool = Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [];

    if (!surveyResponseState) return {};

    let candidateQuestions = [];
    if (poolFromState.length > 0) {
      candidateQuestions = poolFromState;
    } else if (pilePool.length > 0) {
      candidateQuestions = pilePool;
    } else {
      const ids = new Set([
        ...Object.keys(surveyResponseState.answers || {}),
        ...Object.keys(surveyResponseState.additionalComments || {}),
        ...Object.keys(surveyResponseState.importance || {}),
        ...Object.keys(surveyResponseState.conviction || {}),
      ]);
      candidateQuestions = Array.from(ids).map((id) => ({ id, type: 'freeform', prompt: '' }));
    }

    const hasMainAnswer = (ans) =>
      ans !== undefined &&
      ans !== null &&
      ans !== '' &&
      (!Array.isArray(ans) || ans.length > 0);

    const hasAdditional = (val) => val !== undefined && val !== null && val !== '';
    const hasConviction = (qid) =>
      getConvictionFromSlice(surveyResponseState, qid) !== null;

    const shouldFilterByAnswered =
      this.props.isStandalone || this.props.singleQuestionMode || poolFromState.length === 0;

    const answeredQuestions = shouldFilterByAnswered
      ? candidateQuestions.filter((q) => {
          const a = surveyResponseState.answers?.[q.id]?.value;
          const add = surveyResponseState.additionalComments?.[q.id]?.value;
          return hasMainAnswer(a) || hasAdditional(add) || hasConviction(q.id);
        })
      : candidateQuestions;

    const responses = answeredQuestions.map((q) => {
      const answer = surveyResponseState.answers?.[q.id] || {};
      const additional = surveyResponseState.additionalComments?.[q.id] || {};
      const answerAudience = this.resolveFieldEncryptionAudience(answer, q.id, 'answer');
      const additionalAudience = this.resolveFieldEncryptionAudience(additional, q.id, 'additional');
      const conviction = getConvictionFromSlice(surveyResponseState, q.id);
      const importance = getImportanceFromSlice(surveyResponseState, q.id);
      const importanceForPayload = importance !== null ? importance : conviction;

      return {
        questionID: q.id,
        responder: responderAddress || this.props.account,
        type: q.type,
        prompt: q.prompt,
        conviction: conviction !== null ? conviction : null,
        importance: importanceForPayload !== null ? importanceForPayload : null,
        answer: {
          value: answer.value !== undefined ? answer.value : '',
          encrypted: !!answer.encrypted,
          encryptionAudience: answerAudience,
          encryptionGateId: answer.encrypted ? this.resolveFieldEncryptionGateId(answer, q.id, 'answer') : null,
          audienceMode: 'explicit',
          hash: answer.hash || '',
          encryptedPortion: answer.encrypted ? (answer.encryptedPortion || '') : '',
        },
        additional: {
          value: additional.value !== undefined ? additional.value : '',
          encrypted: !!additional.encrypted,
          encryptionAudience: additionalAudience,
          encryptionGateId: additional.encrypted ? this.resolveFieldEncryptionGateId(additional, q.id, 'additional') : null,
          audienceMode: this.normalizeFieldAudienceMode(additional?.audienceMode, 'additional', additional),
          hash: additional.hash || '',
          encryptedPortion: additional.encrypted ? (additional.encryptedPortion || '') : '',
        },
      };
    });

    if (this.props.singleQuestionMode) {
      // Resolve session name for single question context:
      // 1. Prefer metadata from the question object itself (most accurate)
      // 2. Fallback to current effective context
      let sessionName = '';
      const qInPool = (this.state.questionPool && this.state.questionPool[0]);
      if (qInPool?.sessionName) {
        sessionName = qInPool.sessionName;
      } else {
        const context = resolveResponseJsonContext(this.props, resolveEffectiveSlug(this.props));
        sessionName = context.sessionConfig?.sessionName || '';
      }

      if (responses.length > 0) {
        return {
          timeStamp: Date.now(),
          sessionName,
          ...(sessionName ? { sessionName: sessionName } : {}),
          ...responses[0],
        };
      }
      const q = candidateQuestions[0];
      if (q) {
        return {
          timeStamp: Date.now(),
          sessionName,
          ...(sessionName ? { sessionName: sessionName } : {}),
          questionID: q.id,
          type: q.type,
          prompt: q.prompt,
          conviction: null,
          importance: null,
          answer: { value: '', encrypted: false, hash: '', encryptedPortion: '' },
          additional: { value: '', encrypted: false, hash: '', encryptedPortion: '' },
        };
      }
      return {};
    }

    let surveyTitle = null;
    let sessionName = '';

    if (surveyHash) {
      const meta = this.getSurveyMetadataForJson(surveyHash);
      surveyTitle = meta?.surveyTitle || null;
      sessionName = meta?.sessionName || '';
    } else {
      // Fallback for standalone/general mode
      const context = resolveResponseJsonContext(this.props, resolveEffectiveSlug(this.props));
      if (context.sessionConfig?.sessionName) sessionName = context.sessionConfig.sessionName;
    }

    return {
      ...(surveyTitle ? { surveyTitle } : {}),
      ...(surveyHash !== undefined && { surveyID: surveyHash }),
      responder: responderAddress || this.props.account,
      timeStamp: Date.now(),
      sessionName,
      ...(sessionName ? { sessionName: sessionName } : {}),
      responses,
    };
  };


  updateJsonPreview = (force = false) => {
    if (!force && !this.isResponseJsonPreviewVisible()) return;
    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    this.setState({
      jsonPreview: this.prepareJsonAndHash(surveyIndex)
    });
  };

  processJsonToTree = (json, level = 0) => {
    let output = [];
    if (json === null || json === undefined) {
      return output;
    }

    if (Array.isArray(json)) {
      json.forEach((item, index) => {
        if (item !== null && typeof item === 'object') {
          output.push({ type: 'arrayItem', key: index, level });
          output = [...output, ...this.processJsonToTree(item, level + 1)];
        } else {
          output.push({ type: 'arrayItemValue', key: index, value: item, level });
        }
      });
    } else if (typeof json === 'object') {
      Object.keys(json).forEach((key) => {
        if (json[key] !== null && typeof json[key] === 'object') {
          output.push({ type: 'objectKey', key, level });
          output = [...output, ...this.processJsonToTree(json[key], level + 1)];
        } else {
          output.push({ type: 'objectKeyValue', key, value: json[key], level });
        }
      });
    }
    return output;
  };

  jsonTreeDisplay = (jsonInput) => {
    let jsonObject;
    if (jsonInput === null || jsonInput === undefined) {
      jsonObject = {};
    } else if (typeof jsonInput === 'string') {
      try {
        jsonObject = JSON.parse(jsonInput);
      } catch (e) {
        surveyLog.error("Invalid JSON string for display:", e, "Input:", jsonInput);
        jsonObject = { error: "Invalid JSON input", original: jsonInput };
      }
    } else if (typeof jsonInput === 'object') {
      jsonObject = jsonInput;
    } else {
      surveyLog.error("Invalid input for jsonTreeDisplay: Expected string or object, got", typeof jsonInput);
      jsonObject = { error: "Invalid input type", original: String(jsonInput) };
    }

    if (!jsonObject) {
      jsonObject = { error: "JSON became null after processing" };
    }

    const treeData = this.processJsonToTree(jsonObject);

    if (treeData.length === 0) {
      return (
        <ul className={styles.tree}>
          <li className={styles.treeItem}>{'{}'}</li>
        </ul>
      );
    }

    return (
      <ul className={styles.tree}>
        {treeData.map((node, index) => (
          <li
            key={index}
            className={styles.treeItem}
            style={{ marginLeft: `${node.level * 20}px` }}
          >
            <span className={styles.keyValueContainer}>
              {node.type === 'arrayItemValue' && (
                <span>[{node.key}]: {String(node.value)}</span>
              )}
              {node.type === 'objectKeyValue' && (
                <span>{node.key}: {String(node.value)}</span>
              )}
              {node.type === 'arrayItem' && <span>[{node.key}]</span>}
              {node.type === 'objectKey' && <span>{node.key}:</span>}
              {node.type === 'value' && <span>{String(node.value)}</span>}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  handlePrimarySubmitClick = () => {
    if (this.state.isSubmitting || this._submitGuard) return;
    const pendingStats =
      (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) ||
      { total: this.state.modifiedCount || 0 };
    const hasPendingEdits = Number(pendingStats.total || 0) > 0;
    const submittedStateActive = !!(this.state.submittedSinceLastEdit || this.state.submissionComplete);
    if (submittedStateActive && !this.state.submissionComplete && !hasPendingEdits) return;
    if (this.state.submissionComplete && !hasPendingEdits) {
      const accountLower = (this.props.account || '').toLowerCase();
      if (!accountLower) return;
      if (this.props.singleQuestionMode) {
        const qLower = (this.props.questionID || '').toLowerCase();
        if (!qLower) return;
        const url = buildQuestionRoutePath(qLower, {
          responderAddress: accountLower,
          sessionSlug: this._getEffectiveDraftSlug(),
        });
        window.history.pushState({}, '', url);
      } else if (!this.props.isStandalone) {
        const sLower = (this.props.surveyId || '').toLowerCase();
        if (!sLower) return;
        const draftSlug = this._getEffectiveDraftSlug() || '';
        const url = `/survey/${sLower}/${accountLower}${draftSlug ? `?session=${encodeURIComponent(draftSlug)}` : ''}`;
        window.history.pushState({}, '', url);
      }
      return;
    }
    this._submitGuard = true;
    this.encryptAndUpload();
  };

  getQuestionsJson = () => {
    if (this.props.singleQuestionMode) {
        return this.state.questionPool[0] || {};
    }
    return this.state.questionPool || [];
  };

  getResponseJson = () => {
    const isViewingSubmitted =
      ((this.props.viewAddress || this.props.responderAddress) && this.state.parsedViewAddressAnswers) ||
      (!this.state.isEditing && this.state.userAnswers);

    if (isViewingSubmitted) {
        const rawResponse = this.state.parsedViewAddressAnswers || this.state.userAnswers;

        if (!rawResponse) return {};

        if (this.props.singleQuestionMode) {
            if (typeof rawResponse === 'object' && rawResponse !== null && !Array.isArray(rawResponse)) {
                const convictionValue = getConvictionFromResponse(rawResponse);
                const importanceValue = getImportanceFromResponse(rawResponse);
                return {
                    ...rawResponse,
                    conviction: convictionValue !== null ? convictionValue : null,
                    importance: importanceValue !== null ? importanceValue : null
                };
            }
            return rawResponse;
        }

        if (rawResponse && Array.isArray(rawResponse.responses)) {
            const baseConviction = getConvictionFromResponse(rawResponse);
            const baseImportance = getImportanceFromResponse(rawResponse);
            const processed = {
                ...rawResponse,
                responses: rawResponse.responses.map(resp => ({
                    ...resp,
                    conviction: getConvictionFromResponse(resp) !== null ? getConvictionFromResponse(resp) : null,
                    importance: getImportanceFromResponse(resp) !== null ? getImportanceFromResponse(resp) : null
                }))
            };
            if (baseConviction !== null && processed.conviction === undefined) {
                processed.conviction = baseConviction;
            }
            if (baseImportance !== null && processed.importance === undefined) {
                processed.importance = baseImportance;
            }
            return processed;
        }

        return rawResponse;
    }

    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    return this.prepareJsonAndHash(surveyIndex);
  };

  getSurveyJson = () => {
    if (this.props.isStandalone || this.props.singleQuestionMode || !this.props.surveys || this.props.surveyIndex === null) {
        return {};
    }

    const currentSurvey = this.props.surveys[this.props.surveyIndex];
    if (!currentSurvey) {
        return {};
    }

    const surveyDetails = { ...currentSurvey };

    if (Array.isArray(surveyDetails.questionIDs) && Array.isArray(this.state.questionPool)) {
        const questionMap = new Map(this.state.questionPool.map(q => [q.id.toLowerCase(), q]));

        surveyDetails.questions = surveyDetails.questionIDs.map(id => {
            const questionData = questionMap.get(id.toLowerCase());
            return questionData || { id: id, error: "Question details not found in pool" };
        });

        delete surveyDetails.questionIDs;
    }

    return surveyDetails;
  };

  copyJsonToClipboard = (json, type) => {
    let jsonToUse = json;

    if (!jsonToUse || (typeof jsonToUse === 'object' && Object.keys(jsonToUse).length === 0)) {
      if (this.props.singleQuestionMode) {
        jsonToUse = this.getResponseJson();
      }
    }

    if (!jsonToUse || (typeof jsonToUse === 'object' && Object.keys(jsonToUse).length === 0 && type !== 'questions' && type !== 'survey')) {
      surveyLog.warn('No valid JSON data to copy for type:', type);
      return;
    }

    const jsonString =
      typeof jsonToUse === 'string'
        ? jsonToUse
        : JSON.stringify(jsonToUse, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      notify.success('Copied to clipboard');
      if (type === 'questions') {
        this.setState({ copiedQuestionsJson: true });
        this.setManagedTimeout(() => {
          this.setState({ copiedQuestionsJson: false });
        }, 2000);
      } else if (type === 'response') {
        this.setState({ copiedResponseJson: true });
        this.setManagedTimeout(() => {
          this.setState({ copiedResponseJson: false });
        }, 2000);
      } else if (type === 'survey') {
        this.setState({ copiedSurveyJson: true });
        this.setManagedTimeout(() => {
          this.setState({ copiedSurveyJson: false });
        }, 2000);
      }
    }).catch(error => {
      surveyLog.error('Failed to copy JSON to clipboard:', error);
    });
  };


  toggleShowQuestionsJson = () => {
    this.setState((prevState) => ({ showQuestionsJson: !prevState.showQuestionsJson }));
  };

  toggleShowResponseJson = () => {
    this.setState((prevState) => ({ showResponseJson: !prevState.showResponseJson }), () => {
      if (this.state.showResponseJson) {
        this.updateJsonPreview(true);
        return;
      }
      if (this._jsonPreviewTimer) {
        clearTimeout(this._jsonPreviewTimer);
        this._jsonPreviewTimer = null;
      }
    });
  };

  toggleShowSurveyJson = () => {
    this.setState((prevState) => ({ showSurveyJson: !prevState.showSurveyJson }));
  };

  getCommentsOpen = (questionId, defaultOpen = false) => {
    const current = this.state?.showComments?.[questionId];
    return typeof current === 'boolean' ? current : !!defaultOpen;
  };

  toggleComments = (questionId, defaultOpen = false) => {
    this.setState((prev) => {
      const current = typeof prev?.showComments?.[questionId] === 'boolean'
        ? prev.showComments[questionId]
        : !!defaultOpen;
      return {
        showComments: {
          ...prev.showComments,
          [questionId]: !current,
        },
      };
    });
  };

  renderAnswerLockControl = ({
    surveyIndex,
    questionId,
    answer,
    fieldKey = 'answer',
    field = null,
    lockDisabled,
    lockTitle,
    glowAnswer,
    forceAudienceMenu = false,
    selfAudienceLabel = 'for me',
    showPlaintextOption = false,
    showFollowOption = false,
    visualContext = 'default',
  }) => {
    const qid = String(questionId || '').toLowerCase();
    const effectiveFieldKey = String(fieldKey || '').trim().toLowerCase() === 'additional'
      ? 'additional'
      : 'answer';
    const isPileVisualContext = String(visualContext || '').trim().toLowerCase() === 'pile';
    const fieldState = (field && typeof field === 'object') ? field : (answer || {});
    const forcedGate = this.isQuestionLockedForResponse(qid);
    const gateOption = this.resolveQuestionGateOption(qid);
    const gateOptions = Array.isArray(gateOption?.gateDetails) ? gateOption.gateDetails : [];
    const hasGateOption = forcedGate || gateOptions.length > 0 || !!gateOption;
    const hasAudienceMenu = !forcedGate && (
      forceAudienceMenu ||
      effectiveFieldKey === 'additional' ||
      hasGateOption
    );
    const menuOpen = hasAudienceMenu && this.isLockAudienceMenuOpen(qid, effectiveFieldKey);
    const currentAudience = this.resolveFieldEncryptionAudience(fieldState, qid, effectiveFieldKey);
    const currentGateId = this.resolveFieldEncryptionGateId(fieldState, qid, effectiveFieldKey);
    const currentAudienceMode = this.normalizeFieldAudienceMode(
      fieldState?.audienceMode,
      effectiveFieldKey,
      fieldState
    );
    const gateActive = (!!fieldState?.encrypted || forcedGate) && currentAudience === 'gate' && hasGateOption;
    const selfActive = !!fieldState?.encrypted && currentAudience === 'self' && currentAudienceMode !== 'inherit';
    const plaintextActive = !fieldState?.encrypted && currentAudienceMode !== 'inherit';
    const followActive = effectiveFieldKey === 'additional' && currentAudienceMode === 'inherit';
    const lockActive = !!fieldState?.encrypted || !!forcedGate || !!glowAnswer;
    const lockVisualActive = lockActive || menuOpen;
    const pileMenuPressed = isPileVisualContext && menuOpen && !lockActive;
    const showBrightLockState = lockActive || (!isPileVisualContext && menuOpen);
    const isLockDisabled = lockDisabled || forcedGate;
    const allowPlaintextOption = showPlaintextOption && effectiveFieldKey !== 'additional';
    const lockButtonStyle = !isLockDisabled
      ? { opacity: lockVisualActive ? 1 : 0.35 }
      : undefined;
    const normalizedSelfAudienceLabel = this.normalizeGateLabelText(selfAudienceLabel) || 'for me';
    const handleAudienceSelect = (audience, gateId = '') => {
      if (effectiveFieldKey === 'additional') {
        this.applyAdditionalEncryptionAudience(surveyIndex, qid, audience, { gateId });
        return;
      }
      this.applyAnswerEncryptionAudience(surveyIndex, qid, audience, { gateId });
    };
    const menuStateKey = hasAudienceMenu ? this.getLockAudienceMenuStateKey(qid, effectiveFieldKey) : '';
    const expandedGateId = this.normalizeGateLabelText(
      this.state.lockAudienceGateDetailsByQuestion?.[menuStateKey] || ''
    );

    const handleLockClick = () => {
      if (lockDisabled || forcedGate) return;
      if (!hasAudienceMenu) {
        if (effectiveFieldKey === 'additional') {
          this.toggleAdditionalCommentsEncryption(surveyIndex, qid, !Boolean(fieldState?.encrypted));
        } else {
          this.toggleAnswerEncryption(surveyIndex, qid, !Boolean(fieldState?.encrypted));
        }
        return;
      }
      if (menuOpen && effectiveFieldKey === 'answer' && fieldState?.encrypted) {
        this.toggleAnswerEncryption(surveyIndex, qid, false);
        this.toggleLockAudienceMenu(qid, false, effectiveFieldKey);
        return;
      }
      if (menuOpen && effectiveFieldKey === 'additional' && fieldState?.encrypted) {
        this.toggleAdditionalCommentsEncryption(surveyIndex, qid, false);
        this.toggleLockAudienceMenu(qid, false, effectiveFieldKey);
        return;
      }
      if (!menuOpen && !fieldState?.encrypted) {
        if (effectiveFieldKey === 'answer' && !hasGateOption) {
          this.toggleAnswerEncryption(surveyIndex, qid, true);
        }
        this.toggleLockAudienceMenu(qid, true, effectiveFieldKey);
        return;
      }
      this.toggleLockAudienceMenu(qid, !menuOpen, effectiveFieldKey);
    };

    return (
      <div className={styles.lockAudienceContainer}>
        <button
          type="button"
          className={[
            styles.iconButton,
            styles.lockButton,
            showBrightLockState ? styles.iconButtonActive : '',
            isPileVisualContext ? styles.pileLockButton : '',
            pileMenuPressed ? styles.pileLockButtonMenuOpen : '',
          ].filter(Boolean).join(' ')}
          onClick={handleLockClick}
          disabled={isLockDisabled}
          title={forcedGate ? 'Locked by question gate' : (hasAudienceMenu ? 'Choose encryption audience' : lockTitle)}
          aria-label={forcedGate ? 'Locked by question gate' : (hasAudienceMenu ? 'Choose encryption audience' : lockTitle)}
          aria-expanded={hasAudienceMenu ? menuOpen : undefined}
          aria-haspopup={hasAudienceMenu ? 'dialog' : undefined}
          style={lockButtonStyle}
          data-testid={effectiveFieldKey === 'additional' ? E2E_TESTIDS.SURVEY_ADDITIONAL_LOCK : E2E_TESTIDS.SURVEY_ANSWER_LOCK}
        >
          <FontAwesomeIcon
            icon={(fieldState?.encrypted || forcedGate) ? faLock : faUnlock}
            className={showBrightLockState ? styles.iconGlow : undefined}
          />
        </button>

        {hasAudienceMenu && menuOpen && !lockDisabled && (
          <div className={`${styles.lockAudiencePopover} ${isPileVisualContext ? styles.pileLockAudiencePopover : ''}`}>
            {allowPlaintextOption && (
              <button
                type="button"
                className={`${styles.convictionToggleLine} ${plaintextActive ? styles.convictionToggleButtonActive : ''}`}
                onClick={() => handleAudienceSelect('none')}
                data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_NONE}
              >
                <span className={styles.convictionToggleLabel}>Not encrypted</span>
              </button>
            )}
            <button
              type="button"
              className={`${styles.convictionToggleLine} ${selfActive ? styles.convictionToggleButtonActive : ''}`}
              onClick={() => handleAudienceSelect('self')}
              data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_SELF}
            >
              <span className={styles.convictionToggleLabel}>{normalizedSelfAudienceLabel}</span>
            </button>
            {gateOptions.map((option) => {
              const showGateDetails = expandedGateId === option.gateId;
              const sbtItems = Array.isArray(option.sbtItems) ? option.sbtItems : [];
              return (
                <React.Fragment key={`${qid}:${effectiveFieldKey}:${option.gateId}`}>
                  <div className={styles.lockAudienceGateRow}>
                    <button
                      type="button"
                      className={`${styles.convictionToggleLine} ${styles.lockAudienceGateButton} ${gateActive && currentGateId === option.gateId ? styles.convictionToggleButtonActive : ''}`}
                      onClick={() => handleAudienceSelect('gate', option.gateId)}
                      data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_GATE}
                      data-ce-gate-id={option.gateId}
                    >
                      <span className={styles.convictionToggleLabel}>{option.label}</span>
                    </button>
                    {sbtItems.length > 0 && (
                      <button
                        type="button"
                        className={styles.lockAudienceCaretButton}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          this.toggleLockAudienceGateDetails(
                            qid,
                            showGateDetails ? '' : option.gateId,
                            effectiveFieldKey,
                          );
                        }}
                        aria-expanded={showGateDetails}
                        aria-label={showGateDetails ? `Hide ${option.label} ${t('sbts')}` : `Show ${option.label} ${t('sbts')}`}
                      >
                        <FontAwesomeIcon icon={showGateDetails ? faCaretUp : faCaretDown} />
                      </button>
                    )}
                  </div>
                  {showGateDetails && (
                    <div className={styles.lockAudienceGateDetails}>
                      {sbtItems.map((item) => (
                        <a
                          key={`${option.gateId}:${item.address}`}
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.lockAudienceGateDetailItem}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <span className={styles.lockAudienceGateDetailName}>{item.label}</span>
                          <span className={styles.lockAudienceGateDetailSbts}>{item.meta}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              );
            })}
            {showFollowOption && (
              <button
                type="button"
                className={`${styles.convictionToggleLine} ${followActive ? styles.convictionToggleButtonActive : ''}`}
                onClick={() => handleAudienceSelect('follow')}
                data-testid={E2E_TESTIDS.SURVEY_LOCK_AUDIENCE_FOLLOW}
              >
                <span className={styles.convictionToggleLabel}>Match Answer</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  renderQuestion = (question, qIndex, currentSurveyResponseState) => {
    if (!currentSurveyResponseState || !currentSurveyResponseState.answers) {
      surveyLog.warn('renderQuestion: currentSurveyResponseState or its answers property is undefined/null. Question ID:', question?.id);
      return null;
    }

    if (!question || !question.id || !question.type) {
      surveyLog.error('Invalid question data at index:', qIndex, question);
      return null;
    }

    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    const answer = currentSurveyResponseState.answers[question.id] || this.buildEmptyResponseFieldState(question.id);
    const additional = currentSurveyResponseState.additionalComments?.[question.id] || this.buildEmptyResponseFieldState(question.id, 'additional');
    const convictionValue = this.getConvictionValueForSlice(currentSurveyResponseState, question.id);
    const importanceValue = this.getImportanceValueForSlice(currentSurveyResponseState, question.id);
    const hasConvictionImportanceValue = hasConvictionOrImportanceValueForQuestion(currentSurveyResponseState, question.id);
    const sliderMode = ENABLE_IMPORTANCE_SLIDER_TOGGLE ? this.getSliderMode(question.id) : 'conviction';
    const activeSliderValue = sliderMode === 'importance' ? importanceValue : convictionValue;
    const sliderOpen = !!this.state.sliderToggleExpandedByQuestion?.[question.id];

    const cardKey = `${question.id}-${this.state.decryptionNonce}`;
    const showResponseLookupSpinner = shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: this.props.singleQuestionMode,
      isLoadingResponse: this.state.isLoadingResponse,
      account: this.props.account,
      viewAddress: this.props.viewAddress,
      responderAddress: this.props.responderAddress,
    });
    const isQuestionBookmarked = this.state.bookmarkedQuestions.has(question.id);

    const cardIcons = (
      <div className={styles.cardLinksContainer}>
        {showResponseLookupSpinner && (
          <span
            className={styles.cardLinkSpinner}
            title="Checking for existing response..."
            aria-label="Checking for existing response"
          >
            <FontAwesomeIcon icon={faSpinner} spin />
          </span>
        )}
        <button
          onClick={() => this.handleBookmarkToggle(question.id)}
          className={`${styles.cardLinkButton} ${styles.fullQuestionBookmarkButton} ${isQuestionBookmarked ? styles.fullQuestionBookmarkButtonActive : ''}`}
          title={isQuestionBookmarked ? 'Remove Bookmark' : 'Bookmark Question'}
        >
          <FontAwesomeIcon
            icon={faBookmark}
            style={{ color: isQuestionBookmarked ? '#ffc107' : 'white' }}
          />
        </button>
        {question.arweaveTxId && (
          <a
            href={normalizeArweaveUrl(question.arweaveTxId, { contextLabel: 'survey_tool_question_link' })}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cardLinkButton}
            title="View on Arweave"
          >
            <FontAwesomeIcon icon={faExternalLinkAlt} />
          </a>
        )}
        {question.id && (
          <a
            href={buildQuestionRoutePath(question.id, { sessionSlug: this._getEffectiveDraftSlug() })}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cardLinkButton}
            title="View question page"
          >
            <FontAwesomeIcon icon={faExpand} />
          </a>
        )}
      </div>
    );

    // If the prompt is still masked, do not allow answering (prevents nonsense submits).
    // This primarily affects direct-link `/question/:id?...` flows; list views filter these out.
    const promptMasked = this.isMaskedPromptText(question?.prompt) && !question?.promptDecrypted;
    if (promptMasked) {
      const gateNames = this.resolveGatedPromptGateNames(question);
      const tooltipIdBase = String(question?.id || cardKey || 'gated').trim().toLowerCase();
      const tooltipId = `ce-gated-prompt-tip-${tooltipIdBase.replace(/[^a-z0-9_-]/g, '-')}-full`;
      const tooltipText = gateNames.length
        ? `Required ${t('sbt')} ${gateNames.length > 1 ? t('gates') : t('gate')}: ${gateNames.join(', ')}`
        : `${t('sbt')} ${t('gate')} required`;
      return (
        <Card key={cardKey} className={styles.fullQuestionCard}>
          <CardBody id={styles.questionTitleBody} className={styles.fullQuestionBody}>
            <div className={styles.fullQuestionHeader}>
              {this.renderPromptWithManualDecrypt(question)}
              {cardIcons}
            </div>
            <div
              className={styles.gatedPromptNotice}
              role="note"
              data-testid={E2E_TESTIDS.SURVEY_GATED_PROMPT_NOTICE}
              data-ce-question-id={String(question.id || '').trim().toLowerCase()}
            >
              <FontAwesomeIcon icon={faLock} style={{ marginRight: 8 }} />
              <span>
                This question is{' '}
                <span
                  id={tooltipId}
                  data-testid={`ce-gated-prompt-tooltip-${question?.id}`}
                  className={styles.gatedPromptTooltipTrigger}
                  onClick={(e) => e.stopPropagation()}
                >
                  gated
                  <FontAwesomeIcon
                    icon={faQuestionCircle}
                    className={`${styles.tooltip} ${styles.gatedPromptTooltipIcon}`}
                  />
                </span>{'. Decrypt the prompt to answer.'}
              </span>
            <CETooltip
              placement="right"
              trigger="hover focus click"
              target={tooltipId}
              className={styles.tooltipBubble}
              container="body"
            >
              {tooltipText}
            </CETooltip>
            </div>
            {this.renderQuestionTagDropdownRow(question)}
          </CardBody>
        </Card>
      );
    }

    // Parse envelopes (v2 only)
    const getEnvelope = (item) => {
      try { return item?.encryptedPortion ? JSON.parse(item.encryptedPortion) : null; } catch { return null; }
    };
    const isV1Envelope = (env) => !!env && Number(env.v) === 1 && String(env.cipher) === 'aes-gcm-256';

    const answerEnvelope = getEnvelope(answer);
    const additionalEnvelope = getEnvelope(additional);

    // Masked detection (respect legacy 'encrypted' flag if envelope missing)
    const maskedAnswer = (answer?.value === '*' && (answer?.encryptedPortion || answer?.encrypted));
    const maskedAdditional = (additional?.value === '*' && (additional?.encryptedPortion || additional?.encrypted));

    // Version-agnostic: enable manual decrypt whenever masked.
    // If no envelope is present yet, require login so we can hydrate latest response before decrypt.
    const allowDecryptAnswer =
      maskedAnswer && ( !!answerEnvelope || (!!this.props.loginComplete && !!this.props.account) );
    const allowDecryptAdditional =
      maskedAdditional && ( !!additionalEnvelope || (!!this.props.loginComplete && !!this.props.account) );

    const decryptTooltip = 'Login to decrypt this encrypted field.';

    // Field-specific glow rules
    const hasAdditionalContent = hasMeaningfulFieldValue(additional);

    const glowAnswer = !!answer?.encrypted;
    const glowAdditional = !!(additional?.encrypted && hasAdditionalContent);

    // Field-specific decrypting flags for button text
    const isAnswerDecrypting = !!(this.state.decryptingByKey && this.state.decryptingByKey[`${question.id}:answer`]);
    const isAdditionalDecrypting = !!(this.state.decryptingByKey && this.state.decryptingByKey[`${question.id}:additional`]);

    const commentsOpen = this.getCommentsOpen(question.id, hasAdditionalContent);
    const handleToggleComments = () => this.toggleComments(question.id, hasAdditionalContent);
    const lockDisabled = this.state.isSubmitting || maskedAnswer;
    const lockTitle = maskedAnswer ? 'Encrypted answer' : (answer.encrypted ? 'Encrypted' : 'Not encrypted');

    const footerIcons = (
      <div className={styles.fullQuestionIcons}>
        <button
          type="button"
          className={`${styles.iconButton} ${styles.commentButton} ${hasAdditionalContent ? styles.iconButtonActive : ''}`}
          onClick={handleToggleComments}
          aria-pressed={commentsOpen}
          title="Additional comments"
          data-testid={E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE}
          data-ce-question-id={String(question.id || '').trim().toLowerCase()}
        >
          <FontAwesomeIcon icon={faComment} className={hasAdditionalContent ? styles.iconGlow : undefined} />
        </button>
        {this.renderAnswerLockControl({
          surveyIndex,
          questionId: question.id,
          answer,
          lockDisabled,
          lockTitle,
          glowAnswer,
          forceAudienceMenu: true,
          selfAudienceLabel: 'only me',
        })}
        {this.renderQuestionTagDropdown(question)}
      </div>
    );

    if (maskedAnswer) {
      const additionalStillEncrypted = maskedAdditional;

      return (
        <Card key={cardKey} className={styles.fullQuestionCard}>
          <CardBody id={styles.questionTitleBody} className={styles.fullQuestionBody}>
            <div className={styles.fullQuestionHeader}>
              {this.renderPromptWithManualDecrypt(question)}
              {cardIcons}
            </div>

            <div className={styles.fullQuestionMain}>
              {/* Manual decrypt chip hidden when auto-decrypt is enabled */}
              {!this.state.autoDecryptEnabled && (
                <div className={styles.decryptChip}>
                  <Button
                    onClick={() => this.handleDecryptQuestionAnswer(question.id, 'answer')}
                    id={styles.decryptQuestionButton}
                    disabled={this.state.isDecrypting || !allowDecryptAnswer}
                    title={!allowDecryptAnswer ? decryptTooltip : undefined}
                  >
                    {isAnswerDecrypting ? 'Decrypting...' : 'Decrypt Answer'}
                  </Button>
                </div>
              )}
            </div>

            <div className={styles.fullQuestionFooter}>
              <div className={styles.importanceSlider}>
                {sliderOpen ? (
                  this.props.singleQuestionMode
                    ? this.renderSingleQuestionDeferredConvictionSlider({
                        surveyIndex,
                        questionId: question.id,
                        sliderMode,
                        activeSliderValue,
                        convictionValue,
                        importanceValue,
                      })
                    : (
                      <>
                        {this.renderConvictionImportanceLabel(question.id, convictionValue, importanceValue)}
                        <CESlider
                          min={0}
                          max={10}
                          step={1}
                          value={activeSliderValue}
                          className={styles.convictionSlider}
                          tooltip={false}
                          onChange={(value, event) =>
                            this.handleConvictionImportanceChange(
                              surveyIndex,
                              question.id,
                              sliderMode,
                              value,
                              this.getSliderPersistOptions(event)
                            )}
                          onChangeComplete={this.flushDraftPersistAfterSliderChange}
                          disabled={this.state.isSubmitting}
                        />
                      </>
                    )
                ) : ENABLE_IMPORTANCE_SLIDER_TOGGLE ? (
	                  this.renderBullhornToggleButton({
	                    onClick: () => this.setSliderMode(question.id, 'conviction'),
	                    disabled: this.state.isSubmitting,
                      active: hasConvictionImportanceValue,
	                  })
	                ) : (
	                  this.renderBullhornToggleButton({
	                    onClick: () => this.setSliderMode(question.id, sliderMode),
	                    disabled: this.state.isSubmitting,
                      active: hasConvictionImportanceValue,
	                  })
	                )}
              </div>
              {footerIcons}
            </div>

            {commentsOpen && (
              <div className={styles.fullQuestionComments}>
                {additionalStillEncrypted ? (
                  <>
                    {/* Manual decrypt chip hidden when auto-decrypt is enabled */}
                    {!this.state.autoDecryptEnabled && (
                      <div className={styles.decryptChip}>
                        <Button
                          onClick={() => this.handleDecryptQuestionAnswer(question.id, 'additional')}
                          id={styles.decryptQuestionButton}
                          disabled={this.state.isDecrypting || !allowDecryptAdditional}
                          title={!allowDecryptAdditional ? decryptTooltip : undefined}
                        >
                          {isAdditionalDecrypting ? 'Decrypting...' : 'Decrypt Comments'}
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <AudioInput
                    qIndex={qIndex}
                    {...this.getAudioInputWorkerProps()}
                    updateFunction={(additionalCommentsValue) =>
                      this.handleAdditional(surveyIndex, question.id, additionalCommentsValue)
                    }
                    toggleEncryption={(newEncryptedState) =>
                      this.toggleAdditionalCommentsEncryption(surveyIndex, question.id, newEncryptedState)
                    }
                    placeholder={'related thoughts or URLs (optional)'}
                    placeholderOpacity={0.5}
                    value={additional?.value || ''}
                    encrypted={additional?.encrypted || false}
                    dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
                    dataCeQuestionId={String(question.id || '').trim().toLowerCase()}
                    smallEncryptToggle={true}
                    disabled={this.state.isSubmitting}
                    /* Additional glows only when additional has content and is encrypted */
                    forceGlow={glowAdditional}
                  />
                )}
              </div>
            )}
          </CardBody>
        </Card>
      );
    } else if (maskedAdditional) {
      let questionComponent;
      switch (question.type) {
        case 'multichoice': {
          const options = Array.isArray(question.options) ? question.options : [];
          const isSingleSelect = isSingleSelectMultichoice(question);
          const selectedValues = normalizeMultichoiceValue(answer.value);
          questionComponent = (
            <FormGroup id={styles.multiChoice}>
              {options.map((option, oIndex) => (
                <Label check key={oIndex} className={`${styles.checkboxOptionText} ${selectedValues.includes(option) ? styles.selected : ''}`}>
                  <Input
                    type="checkbox"
                    name={`question-${question.id}`}
                    value={option}
                    onChange={(e) => {
                      const currentAnswerValue = normalizeMultichoiceValue(
                        currentSurveyResponseState.answers?.[question.id]?.value
                      );
                      let newAnswer = [];
                      if (isSingleSelect) {
                        newAnswer = e.target.checked ? [option] : [];
                      } else {
                        newAnswer = [...currentAnswerValue];
                        if (e.target.checked) {
                          if (!newAnswer.includes(option)) newAnswer.push(option);
                        } else {
                          const index = newAnswer.indexOf(option);
                          if (index > -1) {
                            newAnswer.splice(index, 1);
                          }
                        }
                      }
                      this.handleAnswer(surveyIndex, question.id, newAnswer);
                    }}
                    checked={selectedValues.includes(option)}
                    disabled={this.state.isSubmitting}
                  />
                  {option}
                </Label>
              ))}
            </FormGroup>
          );
          break;
        }
        case 'rating': {
          const ratingValue = getNormalizedUiRatingValue(answer.value);
          questionComponent = (
            this.props.singleQuestionMode
              ? this.renderSingleQuestionDeferredRatingSlider({
                  surveyIndex,
                  questionId: question.id,
                  ratingValue,
                })
              : (
                <>
                  <div className={styles.importanceSlider}>
                    <CESlider
                      min={RATING_MIN}
                      max={RATING_MAX}
                      step={1}
                      value={ratingValue}
                      tooltip={false}
                      onChange={(ratingAnswer, event) => this.handleAnswer(
                        surveyIndex,
                        question.id,
                        ratingAnswer,
                        this.getSliderPersistOptions(event)
                      )}
                      onChangeComplete={this.flushDraftPersistAfterSliderChange}
                      className={styles.ratingSlider}
                      style={{ width: '200px' }}
                      disabled={this.state.isSubmitting}
                    />
                  </div>
                  <FormText className={styles.ratingLabelText}>
                    {ratingValue}
                  </FormText>
                </>
              )
          );
          break;
        }
        case 'binary':
          questionComponent = (
            <FormGroup id={styles.binaryChoice}>
              {['Agree', 'Unsure', 'Disagree'].map((option, oIndex) => (
                <Label check key={oIndex} className={`${styles.radioOptionText} ${styles[option.toLowerCase()]} ${answer.value === option ? styles.selected : ''}`}>
                  <Input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option}
                    checked={answer.value === option}
                    onChange={() => this.handleAnswer(surveyIndex, question.id, option)}
                    onClick={() => {
                      if (answer.value === option) this.handleAnswer(surveyIndex, question.id, option);
                    }}
                    disabled={this.state.isSubmitting}
                  />
                  {option === 'Agree' && <FontAwesomeIcon icon={faCheck} className={styles.optionIcon} />}
                  {option === 'Disagree' && <FontAwesomeIcon icon={faTimes} className={styles.optionIcon} />}
                  {option}
                </Label>
              ))}
            </FormGroup>
          );
          break;
        default: // 'freeform'
          questionComponent = (
            <AudioInput
              qIndex={qIndex}
              {...this.getAudioInputWorkerProps()}
              placeholder={'response (optional)'}
              placeholderOpacity={0.5}
              updateFunction={(answerValue) => this.handleAnswer(surveyIndex, question.id, answerValue)}
              toggleEncryption={(newEncryptedState) => this.toggleAnswerEncryption(surveyIndex, question.id, newEncryptedState)}
              value={answer.value || ''}
              encrypted={answer.encrypted || false}
              dataTestId={E2E_TESTIDS.SURVEY_ANSWER_INPUT}
              dataCeQuestionId={String(question.id || '').trim().toLowerCase()}
              smallEncryptToggle={true}
              disabled={this.state.isSubmitting}
              /* Main glows only when main answer is encrypted */
              forceGlow={glowAnswer}
              /* Keep lock control in the footer for full mode */
              disableEncryption={true}
            />
          );
          break;
      }

      return (
        <Card key={cardKey} className={styles.fullQuestionCard}>
          <CardBody id={styles.questionTitleBody} className={styles.fullQuestionBody}>
            <div className={styles.fullQuestionHeader}>
              {this.renderPromptWithManualDecrypt(question)}
              {cardIcons}
            </div>
            <div className={styles.fullQuestionMain}>
              <InputGroup id={styles.responseInputSection}>
                {questionComponent}
              </InputGroup>
            </div>
            <div className={styles.fullQuestionFooter}>
              <div className={styles.importanceSlider}>
                {sliderOpen ? (
                  this.props.singleQuestionMode
                    ? this.renderSingleQuestionDeferredConvictionSlider({
                        surveyIndex,
                        questionId: question.id,
                        sliderMode,
                        activeSliderValue,
                        convictionValue,
                        importanceValue,
                      })
                    : (
                      <>
                        {this.renderConvictionImportanceLabel(question.id, convictionValue, importanceValue)}
                        <CESlider
                          min={0}
                          max={10}
                          step={1}
                          value={activeSliderValue}
                          className={styles.convictionSlider}
                          tooltip={false}
                          onChange={(value, event) =>
                            this.handleConvictionImportanceChange(
                              surveyIndex,
                              question.id,
                              sliderMode,
                              value,
                              this.getSliderPersistOptions(event)
                            )}
                          onChangeComplete={this.flushDraftPersistAfterSliderChange}
                          disabled={this.state.isSubmitting}
                        />
                      </>
                    )
                ) : ENABLE_IMPORTANCE_SLIDER_TOGGLE ? (
	                  this.renderBullhornToggleButton({
	                    onClick: () => this.setSliderMode(question.id, 'conviction'),
	                    disabled: this.state.isSubmitting,
                      active: hasConvictionImportanceValue,
	                  })
	                ) : (
	                  this.renderBullhornToggleButton({
	                    onClick: () => this.setSliderMode(question.id, sliderMode),
	                    disabled: this.state.isSubmitting,
                      active: hasConvictionImportanceValue,
	                  })
	                )}
              </div>
              {footerIcons}
            </div>
            {commentsOpen && (
              <div className={styles.fullQuestionComments}>
                {/* Manual decrypt chip hidden when auto-decrypt is enabled */}
                {!this.state.autoDecryptEnabled && (
                  <div className={styles.decryptChip}>
                    <Button
                      onClick={() => this.handleDecryptQuestionAnswer(question.id, 'additional')}
                      id={styles.decryptQuestionButton}
                      disabled={this.state.isDecrypting || !allowDecryptAdditional}
                      title={!allowDecryptAdditional ? decryptTooltip : undefined}
                    >
                      {isAdditionalDecrypting ? 'Decrypting...' : 'Decrypt Comments'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      );
    } else {
      let questionComponent;
      switch (question.type) {
        case 'multichoice': {
          const options = Array.isArray(question.options) ? question.options : [];
          const isSingleSelect = isSingleSelectMultichoice(question);
          const selectedValues = normalizeMultichoiceValue(answer.value);
          questionComponent = (
            <FormGroup id={styles.multiChoice}>
              {options.map((option, oIndex) => (
                <Label check key={oIndex} className={`${styles.checkboxOptionText} ${selectedValues.includes(option) ? styles.selected : ''}`}>
                  <Input
                    type="checkbox"
                    name={`question-${question.id}`}
                    value={option}
                    onChange={(e) => {
                      const currentAnswerValue = normalizeMultichoiceValue(
                        currentSurveyResponseState.answers?.[question.id]?.value
                      );
                      let newAnswer = [];
                      if (isSingleSelect) {
                        newAnswer = e.target.checked ? [option] : [];
                      } else {
                        newAnswer = [...currentAnswerValue];
                        if (e.target.checked) {
                          if (!newAnswer.includes(option)) newAnswer.push(option);
                        } else {
                          const index = newAnswer.indexOf(option);
                          if (index > -1) {
                            newAnswer.splice(index, 1);
                          }
                        }
                      }
                      this.handleAnswer(surveyIndex, question.id, newAnswer);
                    }}
                    checked={selectedValues.includes(option)}
                    disabled={this.state.isSubmitting}
                  />
                  {option}
                </Label>
              ))}
            </FormGroup>
          );
          break;
        }
        case 'rating': {
          const ratingValue = getNormalizedUiRatingValue(answer.value);
          questionComponent = (
            this.props.singleQuestionMode
              ? this.renderSingleQuestionDeferredRatingSlider({
                  surveyIndex,
                  questionId: question.id,
                  ratingValue,
                })
              : (
                <>
                  <div className={styles.importanceSlider}>
                    <CESlider
                      min={RATING_MIN}
                      max={RATING_MAX}
                      step={1}
                      value={ratingValue}
                      tooltip={false}
                      onChange={(ratingAnswer, event) => this.handleAnswer(
                        surveyIndex,
                        question.id,
                        ratingAnswer,
                        this.getSliderPersistOptions(event)
                      )}
                      onChangeComplete={this.flushDraftPersistAfterSliderChange}
                      className={styles.ratingSlider}
                      style={{ width: '200px' }}
                      disabled={this.state.isSubmitting}
                    />
                  </div>
                  <FormText className={styles.ratingLabelText}>
                    {ratingValue}
                  </FormText>
                </>
              )
          );
          break;
        }
        case 'binary':
          questionComponent = (
            <FormGroup id={styles.binaryChoice}>
              {['Agree', 'Unsure', 'Disagree'].map((option, oIndex) => (
                <Label check key={oIndex} className={`${styles.radioOptionText} ${styles[option.toLowerCase()]} ${answer.value === option ? styles.selected : ''}`}>
                  <Input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option}
                    checked={answer.value === option}
                    onChange={() => this.handleAnswer(surveyIndex, question.id, option)}
                    onClick={() => {
                      if (answer.value === option) this.handleAnswer(surveyIndex, question.id, option);
                    }}
                    disabled={this.state.isSubmitting}
                  />
                  {option === 'Agree' && <FontAwesomeIcon icon={faCheck} className={styles.optionIcon} />}
                  {option === 'Disagree' && <FontAwesomeIcon icon={faTimes} className={styles.optionIcon} />}
                  {option}
                </Label>
              ))}
            </FormGroup>
          );
          break;
        default: // 'freeform'
          questionComponent = (
            <AudioInput
              qIndex={qIndex}
              {...this.getAudioInputWorkerProps()}
              placeholder={'response (optional)'}
              placeholderOpacity={0.5}
              updateFunction={(answerValue) => this.handleAnswer(surveyIndex, question.id, answerValue)}
              toggleEncryption={(newEncryptedState) => this.toggleAnswerEncryption(surveyIndex, question.id, newEncryptedState)}
              value={answer.value || ''}
              encrypted={answer.encrypted || false}
              dataTestId={E2E_TESTIDS.SURVEY_ANSWER_INPUT}
              dataCeQuestionId={String(question.id || '').trim().toLowerCase()}
              smallEncryptToggle={true}
              disabled={this.state.isSubmitting}
              /* Main glows only when main answer is encrypted */
              forceGlow={glowAnswer}
              /* Keep lock control in the footer for full mode */
              disableEncryption={true}
            />
          );
          break;
      }

      return (
        <Card key={cardKey} className={styles.fullQuestionCard}>
          <CardBody id={styles.questionTitleBody} className={styles.fullQuestionBody}>
            <div className={styles.fullQuestionHeader}>
              {this.renderPromptWithManualDecrypt(question)}
              {cardIcons}
            </div>
            <div className={styles.fullQuestionMain}>
              <InputGroup id={styles.responseInputSection}>
                {questionComponent}
              </InputGroup>
            </div>
            <div className={styles.fullQuestionFooter}>
              <div className={styles.importanceSlider}>
                {sliderOpen ? (
                  this.props.singleQuestionMode
                    ? this.renderSingleQuestionDeferredConvictionSlider({
                        surveyIndex,
                        questionId: question.id,
                        sliderMode,
                        activeSliderValue,
                        convictionValue,
                        importanceValue,
                      })
                    : (
                      <>
                        {this.renderConvictionImportanceLabel(question.id, convictionValue, importanceValue)}
                        <CESlider
                          min={0}
                          max={10}
                          step={1}
                          value={activeSliderValue}
                          className={styles.convictionSlider}
                          tooltip={false}
                          onChange={(value, event) =>
                            this.handleConvictionImportanceChange(
                              surveyIndex,
                              question.id,
                              sliderMode,
                              value,
                              this.getSliderPersistOptions(event)
                            )}
                          onChangeComplete={this.flushDraftPersistAfterSliderChange}
                          disabled={this.state.isSubmitting}
                        />
                      </>
                    )
                ) : ENABLE_IMPORTANCE_SLIDER_TOGGLE ? (
	                  this.renderBullhornToggleButton({
	                    onClick: () => this.setSliderMode(question.id, 'conviction'),
	                    disabled: this.state.isSubmitting,
                      active: hasConvictionImportanceValue,
	                  })
	                ) : (
	                  this.renderBullhornToggleButton({
	                    onClick: () => this.setSliderMode(question.id, sliderMode),
	                    disabled: this.state.isSubmitting,
                      active: hasConvictionImportanceValue,
	                  })
	                )}
              </div>
              {footerIcons}
            </div>
            {commentsOpen && (
              <div className={styles.fullQuestionComments}>
                <div className={styles.additionalCommentsInlineRow}>
                  <div className={styles.additionalCommentsInputWrap}>
                    <AudioInput
                      qIndex={qIndex}
                      {...this.getAudioInputWorkerProps()}
                      updateFunction={(additionalCommentsValue) => this.handleAdditional(surveyIndex, question.id, additionalCommentsValue)}
                      toggleEncryption={(newEncryptedState) =>
                        this.toggleAdditionalCommentsEncryption(surveyIndex, question.id, newEncryptedState)}
                      placeholder={'related thoughts or URLs (optional)'}
                      placeholderOpacity={0.5}
                      value={additional.value || ''}
                      encrypted={additional.encrypted || false}
                      dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
                      dataCeQuestionId={String(question.id || '').trim().toLowerCase()}
                      smallEncryptToggle={true}
                      disabled={this.state.isSubmitting}
                      /* Additional glows only when additional has content and is encrypted */
                      forceGlow={glowAdditional}
                      disableEncryption={true}
                    />
                  </div>
                  <div className={styles.additionalCommentsLockSlot}>
                    {this.renderAnswerLockControl({
                      surveyIndex,
                      questionId: question.id,
                      answer: additional,
                      field: additional,
                      fieldKey: 'additional',
                      lockDisabled: this.state.isSubmitting,
                      lockTitle: additional.encrypted ? 'Encrypted comments' : 'Comments encryption audience',
                      glowAnswer: glowAdditional,
                      forceAudienceMenu: true,
                      selfAudienceLabel: 'only me',
                      showPlaintextOption: true,
                      showFollowOption: true,
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      );
    }
  };


  encryptData = async (pubKeyOrOpts, extraOpts = {}) => {
    surveyLog.log("encryptData() - invoked");
    if (!this.props.loginComplete) {
      this.props.toggleLoginModal(true);
      return;
    }

    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    const currentSurveyResponseState = this.state.surveysResponseState[surveyIndex];

    if (!currentSurveyResponseState) {
      surveyLog.error("Cannot encrypt: Survey response state is not available.");
      return;
    }

    // Narrow down to changed qIDs and changed encrypted fields only
    const { changedQids } = this.getChangedQidsAndFields(surveyIndex);
    if (!changedQids || changedQids.size === 0) {
      // Nothing changed → nothing to encrypt
      return;
    }

    const {
      groups: workGroups,
      missingRecipients,
    } = this.buildFieldEncryptionWorkGroups(currentSurveyResponseState, changedQids);
    const hasWork = workGroups.some((group) => (
      Object.keys(group?.slice?.answers || {}).length > 0 ||
      Object.keys(group?.slice?.additionalComments || {}).length > 0
    ));

    if (!hasWork) {
      // Either no encrypted fields changed or they are masked '*' (unchanged) → skip.
      return;
    }
    if (missingRecipients.length > 0) {
      this.setState({ submissionError: `Missing Lit recipients for gated field(s): ${missingRecipients.join(', ')}` });
      return;
    }

    try {
      const baseOptions =
        typeof pubKeyOrOpts === 'object'
          ? { ...(pubKeyOrOpts || {}), ...(extraOpts || {}) }
          : { ...(extraOpts || {}) };
      const modifiedSlice = await this.encryptFieldWorkGroups({
        workGroups,
        baseOpts: baseOptions,
      });

      // Merge encrypted results back into the full slice, touching ONLY changed qIDs/fields.
      const updatedSurveysResponseState = [...this.state.surveysResponseState];
      const base = { ...(updatedSurveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };

      Object.keys(modifiedSlice.answers || {}).forEach((qid) => {
        base.answers = { ...(base.answers || {}) };
        base.answers[qid] = { ...(base.answers[qid] || {}), ...(modifiedSlice.answers[qid] || {}) };
      });
      Object.keys(modifiedSlice.additionalComments || {}).forEach((qid) => {
        base.additionalComments = { ...(base.additionalComments || {}) };
        base.additionalComments[qid] = { ...(base.additionalComments[qid] || {}), ...(modifiedSlice.additionalComments[qid] || {}) };
      });

      updatedSurveysResponseState[surveyIndex] = base;

      this.setState({ surveysResponseState: updatedSurveysResponseState }, () => {
        const jsonData = this.prepareJsonAndHash(surveyIndex);
        this.setState({ jsonPreview: jsonData });
      });
    } catch (error) {
      surveyLog.error("Encryption error:", error);
      this.setState({ submissionError: error.message || 'Encryption failed.' });
    }
  };

  buildResponseGatePolicyCacheKey = () => {
    const isQuestionResponseFlow = !!(this.props.singleQuestionMode || this.props.isStandalone);
    const questionId = isQuestionResponseFlow ? String(this.props.questionID || '').toLowerCase() : '';
    const surveyId = isQuestionResponseFlow ? '' : String(this.props.surveyId || '').toLowerCase();
    const hintedSessionSlug = getSessionSlugHintFromProps(this.props);
    const effectiveSessionSlug = resolveEffectiveSlug(this.props);
    const networkId = String(this.props.network?.id ?? this.props.networkChainId ?? '');
    return [
      isQuestionResponseFlow ? 'question' : 'survey',
      questionId,
      surveyId,
      hintedSessionSlug,
      effectiveSessionSlug,
      networkId,
    ].join('|');
  };

  getResponseGatePolicy = () => {
    const cacheKey = this.buildResponseGatePolicyCacheKey();
    const isQuestionResponseFlow = !!(this.props.singleQuestionMode || this.props.isStandalone);
    const cached = this._responseGatePolicyCache;
    const now = Date.now();

    let slug = '';
    let cfg = {};
    let cfgSignature = '';

    try {
      const hintedSessionSlug = getSessionSlugHintFromProps(this.props);
      if (hintedSessionSlug) {
        slug = hintedSessionSlug;
      } else {
        slug = isQuestionResponseFlow
          ? (
              this.props.singleQuestionMode && this.props.questionID
                ? resolveSlugForIds({
                    questionId: this.props.questionID,
                    props: this.props,
                    network: this.props.network,
                  })
                : resolveEffectiveSlug(this.props)
            )
          : resolveSlugForIds({
              surveyId: this.props.surveyId,
              props: this.props,
              network: this.props.network,
            });
      }
      cfg = this.resolveEffectiveResponseGateConfig(slug);
      cfgSignature = this.buildResponseGateConfigSignature(cfg);
    } catch (_) {
      cfg = {};
      cfgSignature = '';
    }

    if (
      cached &&
      cached.key === cacheKey &&
      cached.cfgSignature === cfgSignature &&
      cached.value
    ) {
      if ((now - Number(cached.ts || 0)) < 1500) return cached.value;
      this._responseGatePolicyCache = { ...cached, cfg, ts: now };
      return cached.value;
    }

    let policy = null;
    try {
      const fallbackChainId = this.resolveSessionChainId(slug, cfg);
      policy = buildResponseGatePolicy({
        cfg,
        isQuestionResponseFlow,
        fallbackChainId,
      });
    } catch (_) {
      policy = {
        recipients: [],
        allowFallbackConditions: true,
      };
    }

    this._responseGatePolicyCache = { key: cacheKey, cfgSignature, cfg, value: policy, ts: now };
    return policy;
  };

  getResponseGateRecipientSpecs = () => this.getResponseGatePolicy().recipients;

  getQuestionLookupMap = () => {
    const stateQuestionPool = Array.isArray(this.state.questionPool) ? this.state.questionPool : null;
    const statePileQuestions = Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : null;
    const propsQuestionPool = Array.isArray(this.props.questionPool) ? this.props.questionPool : null;
    const cache = this._questionByIdLookupCache;

    if (
      cache &&
      cache.stateQuestionPool === stateQuestionPool &&
      cache.statePileQuestions === statePileQuestions &&
      cache.propsQuestionPool === propsQuestionPool &&
      cache.value
    ) {
      return cache.value;
    }

    const next = new Map();
    const addPool = (pool) => {
      if (!Array.isArray(pool)) return;
      pool.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid || next.has(qid)) return;
        next.set(qid, question);
      });
    };
    addPool(stateQuestionPool);
    addPool(statePileQuestions);
    addPool(propsQuestionPool);

    this._questionByIdLookupCache = {
      stateQuestionPool,
      statePileQuestions,
      propsQuestionPool,
      value: next,
    };
    return next;
  };

  getQuestionById = (questionId) => {
    const qid = normalizeQuestionIdKey(questionId);
    if (!qid) return null;
    return this.getQuestionLookupMap().get(qid) || null;
  };

  buildGateAudienceSbtItems = (sbtAddresses = [], sessionSlug = '') => (
    Array.from(new Set(
      (Array.isArray(sbtAddresses) ? sbtAddresses : [])
        .map((addr) => String(addr || '').trim())
        .filter(Boolean)
    )).map((address) => ({
      address,
      label: this.resolveSbtGateLabel(address) || proposalScripts.getShortenedAddress(address, false),
      meta: proposalScripts.getShortenedAddress(address, false),
      href: buildSbtDetailPath(address, sessionSlug),
    }))
  );

  getQuestionEncryptionGates = (question) => {
    const enc = question?.encryption;
    if (!enc || typeof enc !== 'object') return [];
    if (enc.enabled === false) return [];
    const gates = Array.isArray(enc.gates)
      ? enc.gates
      : (enc.gate && typeof enc.gate === 'object' ? [enc.gate] : []);
    return gates.filter((gate) => gate && typeof gate === 'object');
  };

  normalizeFieldAudienceMode = (value, fieldKey = 'answer', field = {}) => {
    const normalizedFieldKey = String(fieldKey || '').trim().toLowerCase() === 'additional'
      ? 'additional'
      : 'answer';
    if (normalizedFieldKey !== 'additional') return 'explicit';

    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'inherit' || raw === 'follow' || raw === 'follow-answer') return 'inherit';
    if (raw === 'explicit') return 'explicit';

    const hasPersistedState =
      hasMeaningfulFieldValue(field) ||
      !!field?.encrypted ||
      !!field?.encryptedPortion ||
      !!field?.hash;
    return hasPersistedState ? 'explicit' : 'inherit';
  };

  getQuestionGateOptions = (questionId) => {
    const qid = normalizeQuestionIdKey(questionId);
    if (!qid) return [];
    const question = this.getQuestionById(qid);
    const gates = this.getQuestionEncryptionGates(question);
    if (!gates.length) return [];

    const out = [];
    const dedupe = new Set();
    gates.forEach((gate, gateIndex) => {
      const recipients = this.buildRecipientsFromGates([gate]);
      if (!Array.isArray(recipients) || recipients.length === 0) return;

      const sbtAddresses = Array.from(new Set(
        [
          ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
          gate?.sbtAddress,
        ]
          .map((addr) => String(addr || '').trim())
          .filter(Boolean)
      ));
      const gateId = this.normalizeGateLabelText(gate?.gateId || gate?.id || '') || `question-gate-${gateIndex}`;
      const dedupeKey = JSON.stringify({
        gateId,
        recipients,
      });
      if (dedupe.has(dedupeKey)) return;
      dedupe.add(dedupeKey);

      const label = this.resolveConfiguredGateLabel({
        gate,
        resourceKey: gate?.resourceKey || '',
        sbtAddresses,
      }) || this.resolveGateDisplayLabel(gate, sbtAddresses[0] || '');
      out.push({
        gateId,
        label: label || `Question gate ${gateIndex + 1}`,
        sbtAddresses,
        sbtItems: this.buildGateAudienceSbtItems(sbtAddresses, question?.sessionSlug || ''),
        sbtSummary: sbtAddresses.length > 0
          ? sbtAddresses
            .map((addr) => this.resolveSbtGateLabel(addr) || proposalScripts.getShortenedAddress(addr, false))
            .join(', ')
          : 'none',
        recipients,
      });
    });
    return out;
  };

  getResponseGateOptions = (questionId = null) => {
    const qid = normalizeQuestionIdKey(questionId);
    if (qid && this.isQuestionLockedForResponse(qid)) {
      return this.getQuestionGateOptions(qid);
    }

    const policy = this.getResponseGatePolicy();
    const gates = Array.isArray(policy?.gates) ? policy.gates : [];
    const recipients = Array.isArray(policy?.recipients) ? policy.recipients : [];
    if (!gates.length) return [];
    const sessionLabel = this.resolveLockAudienceSessionName();

    const responseGateSessionSlug = this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : resolveEffectiveSlug(this.props);
    const out = [];
    const dedupe = new Set();
    gates.forEach((gate, gateIndex) => {
      const gateRecipients = recipients[gateIndex]
        ? [recipients[gateIndex]]
        : this.buildRecipientsFromGates([gate]);
      if (!Array.isArray(gateRecipients) || gateRecipients.length === 0) return;

      const sbtAddresses = Array.from(new Set(
        [
          ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
          gate?.sbtAddress,
        ]
          .map((addr) => String(addr || '').trim())
          .filter(Boolean)
      ));
      const gateId = this.normalizeGateLabelText(gate?.gateId || gate?.id || gate?.resourceKey) || `gate-${gateIndex}`;
      const dedupeKey = JSON.stringify({
        gateId,
        recipients: gateRecipients,
      });
      if (dedupe.has(dedupeKey)) return;
      dedupe.add(dedupeKey);

      const configuredLabel = this.resolveConfiguredGateLabel({
        gate,
        resourceKey: gate?.resourceKey || '',
        sbtAddresses,
      }) || this.resolveGateDisplayLabel(gate, sbtAddresses[0] || '');
      const label = sessionLabel || configuredLabel;

      out.push({
        gateId,
        label: label || `${t('gate')} ${gateIndex + 1}`,
        sbtAddresses,
        sbtItems: this.buildGateAudienceSbtItems(sbtAddresses, responseGateSessionSlug || ''),
        sbtSummary: sbtAddresses.length > 0
          ? sbtAddresses
            .map((addr) => this.resolveSbtGateLabel(addr) || proposalScripts.getShortenedAddress(addr, false))
            .join(', ')
          : 'none',
        recipients: gateRecipients,
      });
    });

    return out;
  };

  getResponseGateOptionById = (questionId = null, gateId = '') => {
    const normalizedGateId = this.normalizeGateLabelText(gateId);
    const options = this.getResponseGateOptions(questionId);
    if (!options.length) return null;
    if (!normalizedGateId) return options[0];
    return options.find((option) => option.gateId === normalizedGateId) || options[0];
  };

  resolveFieldEncryptionGateId = (field = {}, questionId = null, fieldKey = 'answer') => {
    const qid = questionId ? String(questionId).toLowerCase() : '';
    const audience = this.resolveFieldEncryptionAudience(field, qid || null, fieldKey);
    if (audience !== 'gate') return null;

    const explicitGateId = this.normalizeGateLabelText(field?.encryptionGateId || '');
    const matchingOption = this.getResponseGateOptionById(qid || null, explicitGateId);
    return matchingOption?.gateId || null;
  };

  buildInheritedAdditionalFieldState = (additionalField = {}, answerField = {}, questionId = null) => ({
    ...(additionalField && typeof additionalField === 'object' ? additionalField : {}),
    encrypted: !!answerField?.encrypted,
    encryptionAudience: this.resolveFieldEncryptionAudience(answerField || {}, questionId, 'answer'),
    encryptionGateId: this.resolveFieldEncryptionGateId(answerField || {}, questionId, 'answer'),
    audienceMode: 'inherit',
  });

  getEffectiveRecipientsForField = ({ questionId, fieldKey = 'answer', field = null } = {}) => {
    const qid = normalizeQuestionIdKey(questionId);
    if (!qid) return [];
    if (this.isQuestionLockedForResponse(qid)) {
      return this.getEffectiveRecipientsForQid(qid);
    }

    const audience = this.resolveFieldEncryptionAudience(field || {}, qid, fieldKey);
    if (audience !== 'gate') return [];

    const gateId = this.resolveFieldEncryptionGateId(field || {}, qid, fieldKey);
    const gateOption = this.getResponseGateOptionById(qid, gateId);
    if (gateOption?.recipients?.length) return gateOption.recipients;

    return this.getEffectiveRecipientsForQid(qid);
  };

  resolveGatedPromptGateNames = (question) => {
    const normalize = (value) => this.normalizeGateLabelText(value);
    const readGateNames = (gateList) => {
      const names = Array.from(new Set(
        (Array.isArray(gateList) ? gateList : [])
          .map((gate) => {
            if (!gate || typeof gate !== 'object') return '';
            const sbtAddresses = Array.from(new Set(
              [
                ...(Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : []),
                gate.sbtAddress,
              ]
                .map((addr) => String(addr || '').trim())
                .filter(Boolean)
            ));
            const label = this.resolveGateDisplayLabel(gate, sbtAddresses[0] || '');
            return normalize(label);
          })
          .filter((label) => label && label !== 'default gate')
      ));
      return names;
    };

    const fromQuestion = readGateNames(this.getQuestionEncryptionGates(question));
    if (fromQuestion.length) return fromQuestion;

    const slug = this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : resolveEffectiveSlug(this.props);
    const cfg = this.resolveEffectiveResponseGateConfig(slug);

    const defaultGateSBTs = Array.isArray(cfg?.defaultGateSBTs) ? cfg.defaultGateSBTs : [];
    const fromDefaultGateSBTs = Array.from(new Set(
      defaultGateSBTs
        .map((entry) => {
          if (typeof entry === 'string') return normalize(entry);
          if (!entry || typeof entry !== 'object') return '';
          return normalize(entry.name || entry.label || entry.title || entry.address);
        })
        .filter(Boolean)
    ));
    if (fromDefaultGateSBTs.length) return fromDefaultGateSBTs;

    const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
    const encryptionGateMap = isPlainObject(cfg?.encryption?.gates) ? cfg.encryption.gates : null;
    const sponsoredGateMap = isPlainObject(cfg?.sponsored?.gates) ? cfg.sponsored.gates : null;
    const gateMap = (encryptionGateMap && Object.keys(encryptionGateMap).length)
      ? encryptionGateMap
      : (sponsoredGateMap && Object.keys(sponsoredGateMap).length ? sponsoredGateMap : null);
    const gateIds = gateMap ? Object.keys(gateMap).filter(Boolean).sort() : [];

    const candidateDefaults = [
      cfg?.lit?.defaultGateId,
      cfg?.encryption?.defaultGateId,
      cfg?.encryption?.primaryGateId,
      cfg?.sponsored?.defaultGateId,
      gateIds[0],
    ]
      .map((val) => (typeof val === 'string' ? val.trim() : ''))
      .filter(Boolean);
    const defaultGateId = candidateDefaults.find((gateId) => gateIds.includes(gateId)) || (gateIds[0] || '');

    if (defaultGateId && gateMap?.[defaultGateId] && typeof gateMap[defaultGateId] === 'object') {
      const gate = gateMap[defaultGateId];
      const fallbackLabel = normalize(gate?.label || gate?.name || gate?.title || defaultGateId);
      const resolvedLabel = normalize(this.resolveGateDisplayLabel({ ...gate, gateId: defaultGateId }, ''));
      const best = resolvedLabel && resolvedLabel !== 'default gate' ? resolvedLabel : fallbackLabel;
      if (best && best !== 'default gate') return [best];
    }

    const legacyGate = cfg?.encryption?.gate;
    const fromLegacy = readGateNames(
      legacyGate && typeof legacyGate === 'object' && !Array.isArray(legacyGate) ? [legacyGate] : []
    );
    if (fromLegacy.length) return fromLegacy;

    return [];
  };

  buildRecipientsFromGates = (gates = []) => {
    const list = Array.isArray(gates) ? gates : [];
    const out = [];
    const dedupe = new Set();
    list.forEach((gate) => {
      if (!gate || typeof gate !== 'object') return;
      const chainId = Number(
        gate.chainId ||
        this.resolveSessionChainId()
      ) || null;
      const chain = resolveLitChain({ chainId, litChain: gate.litChain, chain: gate.chain });
      const sbtAddresses = Array.from(new Set(
        [
          ...(Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : []),
          gate.sbtAddress,
        ]
          .map((addr) => String(addr || '').trim())
          .filter(Boolean)
      ));
      if (!sbtAddresses.length) return;

      const accessControlConditions = buildSbtAccessControlConditions({
        sbtAddresses,
        chainId,
        litChain: chain,
        mode: gate.mode || 'any',
      });
      if (!accessControlConditions) return;

      const recipient = { accessControlConditions, chain };
      const sig = JSON.stringify(recipient);
      if (dedupe.has(sig)) return;
      dedupe.add(sig);
      out.push(recipient);
    });
    return out;
  };

  isQuestionLockedForResponse = (questionId) => {
    const q = this.getQuestionById(questionId);
    return this.getQuestionEncryptionGates(q).length > 0;
  };

  getEffectiveRecipientsForQid = (questionId) => {
    const q = this.getQuestionById(questionId);
    const gates = this.getQuestionEncryptionGates(q);
    if (gates.length) return this.buildRecipientsFromGates(gates);
    const policy = this.getResponseGatePolicy();
    return Array.isArray(policy?.recipients) ? policy.recipients : [];
  };

  hasDefaultResponseGateRecipients = () => this.getResponseGateRecipientSpecs().length > 0;

  getDefaultResponseEncryptionAudience = () => (
    this.hasDefaultResponseGateRecipients() ? 'gate' : 'self'
  );

  getDefaultResponseEncryptionAudienceForQid = (questionId) => (
    this.isQuestionLockedForResponse(questionId) || this.getEffectiveRecipientsForQid(questionId).length > 0
      ? 'gate'
      : 'self'
  );

  normalizeResponseEncryptionAudience = (value, questionId = null) => {
    const qid = questionId ? String(questionId).toLowerCase() : '';
    if (qid && this.isQuestionLockedForResponse(qid)) return 'gate';

    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'gate') {
      if (qid) {
        return this.getEffectiveRecipientsForQid(qid).length ? 'gate' : 'self';
      }
      return this.hasDefaultResponseGateRecipients() ? 'gate' : 'self';
    }
    return 'self';
  };

  getDefaultResponseEncryptionEnabled = () => this.getDefaultResponseEncryptionAudience() === 'gate';

  buildEmptyResponseFieldState = (questionId = null, fieldKey = 'answer') => {
    const qid = questionId ? String(questionId).toLowerCase() : '';
    const audience = qid
      ? this.getDefaultResponseEncryptionAudienceForQid(qid)
      : this.getDefaultResponseEncryptionAudience();
    const gateId = audience === 'gate'
      ? this.resolveFieldEncryptionGateId({ encryptionAudience: audience }, qid || null, fieldKey)
      : null;
    return {
      value: '',
      encrypted: audience === 'gate',
      encryptionAudience: audience,
      encryptionGateId: gateId,
      audienceMode: this.normalizeFieldAudienceMode('', fieldKey, {}),
      encryptedPortion: '',
      hash: '',
    };
  };

  resolveFieldEncryptionAudience = (field = {}, questionId = null, fieldKey = 'answer') => {
    const qid = questionId ? String(questionId).toLowerCase() : '';
    if (field && typeof field === 'object' && field.encryptionAudience) {
      return this.normalizeResponseEncryptionAudience(field.encryptionAudience, qid || null);
    }
    return qid
      ? this.getDefaultResponseEncryptionAudienceForQid(qid)
      : this.getDefaultResponseEncryptionAudience();
  };

  normalizeGateLabelText = (value) => {
    const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
    if (!raw) return '';
    if (/^\[object\s+object\]$/i.test(raw)) return '';
    return raw;
  };

  resolveSbtGateLabel = (address, preferredSlug = '') => {
    const normalizedAddress = String(address || '').trim();
    if (!normalizedAddress) return '';
    const slug = String(
      preferredSlug ||
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    ).trim().toLowerCase();
    return resolveSbtDisplayLabel({
      address: normalizedAddress,
      preferredSlug: slug,
      fallback: 'short',
    });
  };

  collectGateSbtAddressesForHydration = () => {
    const addresses = new Set();
    const addAddress = (value) => {
      const raw = String(value || '').trim();
      if (!raw || !ethers.utils.isAddress(raw)) return;
      addresses.add(ethers.utils.getAddress(raw));
    };
    const addGateAddresses = (gate) => {
      if (!gate || typeof gate !== 'object') return;
      [
        ...(Array.isArray(gate.sbtAddresses) ? gate.sbtAddresses : []),
        gate.sbtAddress,
      ].forEach(addAddress);
    };

    const policy = this.getResponseGatePolicy();
    const gates = Array.isArray(policy?.gates) ? policy.gates : [];
    gates.forEach(addGateAddresses);

    const questionPools = [
      Array.isArray(this.state.questionPool) ? this.state.questionPool : [],
      Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [],
      Array.isArray(this.props.questionPool) ? this.props.questionPool : [],
    ];
    questionPools.forEach((pool) => {
      pool.forEach((question) => {
        this.getQuestionEncryptionGates(question).forEach(addGateAddresses);
      });
    });

    return Array.from(addresses);
  };

  hydrateGateSbtLabels = async ({ force = false } = {}) => {
    const addresses = this.collectGateSbtAddressesForHydration();
    const slug = String(
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    ).trim().toLowerCase();
    const cfg = this.resolveEffectiveResponseGateConfig(slug);
    const chainId = this.resolveSessionChainId(slug, cfg);
    const signature = `${slug}|${Number(chainId || 0)}|${addresses.join(',')}`;
    if (!force && signature === this._gateSbtHydrationSig) return;
    this._gateSbtHydrationSig = signature;
    if (!addresses.length) {
      this.clearGateSbtHydrationRetry();
      return;
    }

    try {
      const hits = await warmSbtDisplayNamesTargeted({
        addresses,
        preferredSlug: slug,
        metadataLookupConfig: cfg,
        chainId,
        writeBack: true,
      });
      const targetedLookupEnabled = isTargetedSbtMetadataLookupEnabled();
      if (!this._isMounted) return;
      const resolvedAddresses = new Set(
        (Array.isArray(hits) ? hits : [])
          .map((entry) => String(entry?.address || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const hasUnresolvedAddresses = addresses.some(
        (address) => !resolvedAddresses.has(String(address || '').trim().toLowerCase())
      );
      if (!Array.isArray(hits) || hits.length === 0) {
        if (!targetedLookupEnabled) {
          this.clearGateSbtHydrationRetry();
          return;
        }
        this._gateSbtHydrationSig = '';
        this.scheduleGateSbtHydrationRetry();
        return;
      }
      if (hasUnresolvedAddresses) {
        if (targetedLookupEnabled) {
          this._gateSbtHydrationSig = '';
          this.scheduleGateSbtHydrationRetry();
        } else {
          this.clearGateSbtHydrationRetry();
        }
      } else {
        this.clearGateSbtHydrationRetry();
      }
      this.setState((prev) => ({
        gateSbtNameRevision: Number(prev.gateSbtNameRevision || 0) + 1,
      }));
    } catch (_) {
      if (!isTargetedSbtMetadataLookupEnabled()) {
        this.clearGateSbtHydrationRetry();
        return;
      }
      this._gateSbtHydrationSig = '';
      this.scheduleGateSbtHydrationRetry();
    }
  };

  buildLockedQuestionGateDetails = (hiddenMaskedQuestionIds = []) => {
    const hiddenIds = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (hiddenIds.size === 0) return [];

    const pool = this.getLockedQuestionGateSourcePool(hiddenMaskedQuestionIds);
    const slug = String(
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    ).trim().toLowerCase();
    const detailsByKey = new Map();
    const isGenericResourceGateLabel = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (!normalized) return true;
      return [
        'questionresponses',
        'surveyresponses',
        'responses',
        'questionresponse',
        'surveyresponse',
        'default',
        'default gate',
      ].includes(normalized);
    };

    pool.forEach((question) => {
      const questionId = String(question?.id || '').trim().toLowerCase();
      if (!hiddenIds.has(questionId)) return;
      const gates = this.getQuestionEncryptionGates(question);
      const questionSessionSlug = normalizeSessionSlugValue(question?.sessionSlug || slug);
      gates.forEach((gate, gateIndex) => {
        const sbtAddresses = Array.from(new Set(
          [
            ...(Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : []),
            gate?.sbtAddress,
          ]
            .map((addr) => String(addr || '').trim())
            .filter(Boolean)
        ));
        const configuredLabel = this.normalizeGateLabelText(
          this.resolveConfiguredGateLabel({
            gate,
            resourceKey: gate?.resourceKey || '',
            sbtAddresses,
          })
        );
        const explicitLabel = this.normalizeGateLabelText(
          gate?.label || gate?.name || gate?.title || ''
        );
        const maybeGateId = this.normalizeGateLabelText(gate?.gateId || gate?.id || '');
        const sbtLabelFallback = sbtAddresses.length > 0
          ? `${this.resolveSbtGateLabel(sbtAddresses[0], slug) || proposalScripts.getShortenedAddress(sbtAddresses[0], false)} gate`
          : 'Question gate';
        const label = !isGenericResourceGateLabel(configuredLabel)
          ? configuredLabel
          : !isGenericResourceGateLabel(explicitLabel)
            ? explicitLabel
          : (!isGenericResourceGateLabel(maybeGateId) ? maybeGateId : sbtLabelFallback);
        const key = `${String(label || `gate-${gateIndex}`).toLowerCase()}|${sbtAddresses
          .map((addr) => String(addr).toLowerCase())
          .sort()
          .join('|')}`;
        if (!detailsByKey.has(key)) {
          detailsByKey.set(key, {
            id: key || `${questionId}:${gateIndex}`,
            label: label || t('gate'),
            sbtAddresses: [],
            questionIds: new Set(),
            sessionSlug: questionSessionSlug,
          });
        }
        const detail = detailsByKey.get(key);
        detail.questionIds.add(questionId);
        if (!detail.sessionSlug && questionSessionSlug) detail.sessionSlug = questionSessionSlug;
        sbtAddresses.forEach((address) => {
          const checksum = ethers.utils.isAddress(address) ? ethers.utils.getAddress(address) : address;
          if (!detail.sbtAddresses.includes(checksum)) detail.sbtAddresses.push(checksum);
        });
      });
    });

    return Array.from(detailsByKey.values()).map((detail) => ({
      ...detail,
      questionCount: detail.questionIds.size,
      sbts: detail.sbtAddresses.map((address) => ({
        address,
        label: this.resolveSbtGateLabel(address, detail.sessionSlug || slug) || proposalScripts.getShortenedAddress(address, false),
        href: buildSbtDetailPath(address, detail.sessionSlug || slug),
      })),
    }));
  };

  getLockedQuestionGateSourcePool = (hiddenMaskedQuestionIds = []) => {
    const hiddenIds = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const candidates = [
      Array.isArray(this.state.allQuestionsForFilter) ? this.state.allQuestionsForFilter : [],
      Array.isArray(this.state.questionPool) ? this.state.questionPool : [],
      Array.isArray(this.props.questionPool) ? this.props.questionPool : [],
    ].filter((pool) => Array.isArray(pool) && pool.length > 0);

    if (!candidates.length) return [];
    if (hiddenIds.size === 0) return candidates[0];

    const scored = candidates.map((pool, index) => {
      let matchedCount = 0;
      let gateCount = 0;
      pool.forEach((question) => {
        const questionId = String(question?.id || '').trim().toLowerCase();
        if (!hiddenIds.has(questionId)) return;
        matchedCount += 1;
        gateCount += this.getQuestionEncryptionGates(question).length;
      });
      return { pool, index, matchedCount, gateCount };
    });

    const matchingPools = scored.filter((entry) => entry.matchedCount > 0);
    if (!matchingPools.length) return candidates[0];

    matchingPools.sort((a, b) => (
      (b.gateCount - a.gateCount) ||
      (b.matchedCount - a.matchedCount) ||
      (a.index - b.index)
    ));
    return matchingPools[0].pool;
  };

  getMemoizedLockedQuestionGateDetails = (hiddenMaskedQuestionIds = []) => {
    const hiddenIds = (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
      .map((qid) => String(qid || '').trim().toLowerCase())
      .filter(Boolean);
    const hiddenSignature = hiddenIds.join('|');
    const pool = this.getLockedQuestionGateSourcePool(hiddenIds);
    const memo = this._lockedQuestionGateDetailsMemo || {};
    let poolVersion = Number(memo.poolVersion || 0);
    if (memo.poolRef !== pool) {
      poolVersion += 1;
      this._lockedQuestionGateDetailsMemo = {
        ...memo,
        poolRef: pool,
        poolVersion,
      };
    }
    const memoKey = [
      hiddenSignature,
      `pool:${poolVersion}`,
      `gateRev:${Number(this.state.gateSbtNameRevision || 0)}`,
    ].join('|');
    if (this._lockedQuestionGateDetailsMemo?.key === memoKey) {
      return this._lockedQuestionGateDetailsMemo.value;
    }
    const nextValue = this.buildLockedQuestionGateDetails(hiddenIds);
    this._lockedQuestionGateDetailsMemo = {
      ...this._lockedQuestionGateDetailsMemo,
      key: memoKey,
      value: nextValue,
    };
    return nextValue;
  };

  renderLockedQuestionsDecryptButton = (questionIds = []) => (
    <button
      type="button"
      className={styles.lockedQuestionsDecryptButton}
      onClick={() => this.reloadMaskedQuestionBatch(questionIds)}
      disabled={!!this.state.bulkPromptReloading}
      data-testid={E2E_TESTIDS.SURVEY_LOCKED_DECRYPT}
    >
      {this.state.bulkPromptReloading ? (
        <span className={styles.lockedQuestionsDecryptLoading}>
          <FontAwesomeIcon icon={faSpinner} spin />
          <span>Decrypting...</span>
        </span>
      ) : (
        'Decrypt'
      )}
    </button>
  );

  renderLockedQuestionGateCards = (lockedGateDetails = []) => {
    if (lockedGateDetails.length > 0) {
      return (
        <div className={styles.lockedQuestionsDetails}>
          {lockedGateDetails.map((gate) => (
            <div key={gate.id} className={styles.lockedGateDetailCard}>
              <div className={styles.lockedGateDetailHeader}>
                <span className={styles.lockedGateDetailName}>{gate.label || t('gate')}</span>
                <span className={styles.lockedGateDetailCount}>
                  {gate.questionCount} question{gate.questionCount === 1 ? '' : 's'}
                </span>
              </div>
              <div className={styles.lockedGateSbtList}>
                {gate.sbts.map((sbt) => (
                  <a
                    key={`${gate.id}:${sbt.address}`}
                    href={sbt.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.lockedSbtCard}
                  >
                    <span className={styles.lockedSbtName}>{sbt.label}</span>
                    <span className={styles.lockedSbtMeta}>required to view</span>
                    <FontAwesomeIcon icon={faExternalLinkAlt} className={styles.lockedSbtLinkIcon} />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  renderLockedQuestionsPanel = ({
    hiddenMaskedQuestionIds = [],
    lockedGateDetails = [],
    title = '',
    subtitle = '',
    forceExpanded = false,
    surface = 'light',
    showCaret = true,
  } = {}) => {
    const hiddenCount = Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds.length : 0;
    if (hiddenCount <= 0) return null;

    const resolvedTitle = title || `${hiddenCount} Locked Question${hiddenCount === 1 ? '' : 's'}`;
    const canToggleLockedDetails = lockedGateDetails.length > 0 && showCaret;
    const showLockedGateDetails = forceExpanded || (!!this.state.lockedGateDetailsExpanded && canToggleLockedDetails);
    const bannerClassName = [
      styles.lockedQuestionsBanner,
      surface === 'dark' ? styles.lockedQuestionsBannerOnDark : '',
    ].filter(Boolean).join(' ') || undefined;

    return (
      <div className={bannerClassName} role="status" data-testid={E2E_TESTIDS.SURVEY_LOCKED_BANNER}>
        <div className={styles.lockedQuestionsBackdrop}>
          <FontAwesomeIcon icon={faLock} />
        </div>
        <div className={styles.lockedQuestionsHeader}>
          <div className={styles.lockedQuestionsCopy}>
            <div className={styles.lockedQuestionsTitle}>
              {resolvedTitle}
            </div>
            {subtitle ? (
              <div className={styles.lockedQuestionsSubtext}>
                {subtitle}
              </div>
            ) : null}
          </div>
          <div className={styles.lockedQuestionsAction}>
            {this.renderLockedQuestionsDecryptButton(hiddenMaskedQuestionIds)}
          </div>
        </div>
        {showLockedGateDetails
          ? this.renderLockedQuestionGateCards(lockedGateDetails)
          : null}
        {canToggleLockedDetails ? (
          <button
            type="button"
            className={styles.lockedQuestionsCaretButton}
            onClick={() => this.setState((prev) => ({ lockedGateDetailsExpanded: !prev.lockedGateDetailsExpanded }))}
            aria-expanded={showLockedGateDetails}
            aria-label={showLockedGateDetails ? `Hide ${t('gateLower')} details` : `Show ${t('gateLower')} details`}
            data-testid={E2E_TESTIDS.SURVEY_LOCKED_BANNER_CARET}
          >
            <FontAwesomeIcon icon={showLockedGateDetails ? faCaretUp : faCaretDown} />
          </button>
        ) : null}
      </div>
    );
  };

  resolveGateDisplayLabel = (gate = {}, fallbackSbt = '') => {
    const readText = (value) => this.normalizeGateLabelText(value);
    const readAny = (value) => {
      if (typeof value === 'string') return readText(value);
      if (!value || typeof value !== 'object') return '';
      return (
        readText(value.label) ||
        readText(value.name) ||
        readText(value.title) ||
        readText(value.value) ||
        readText(value.text) ||
        readText(value.id) ||
        readText(value.gateId)
      );
    };

    const label = (
      readAny(gate?.label) ||
      readAny(gate?.name) ||
      readAny(gate?.title) ||
      readText(gate?.gateId) ||
      readText(gate?.id)
    );
    if (label) return label;
    if (fallbackSbt) {
      const sbtName = this.resolveSbtGateLabel(fallbackSbt);
      return `${t('sbt')} ${sbtName || proposalScripts.getShortenedAddress(fallbackSbt, false)}`;
    }
    return `default ${t('gateLower')}`;
  };

  resolveConfiguredGateLabel = ({ gate = {}, resourceKey = '', sbtAddresses = [] } = {}) => {
    const cfg = this._responseGatePolicyCache?.cfg || {};
    const sponsored = (cfg?.sponsored && typeof cfg.sponsored === 'object') ? cfg.sponsored : {};
    const resources = (sponsored?.resources && typeof sponsored.resources === 'object') ? sponsored.resources : {};
    const gatesById = (sponsored?.gates && typeof sponsored.gates === 'object') ? sponsored.gates : {};

    const selectedResource = (resources?.[resourceKey] && typeof resources[resourceKey] === 'object')
      ? resources[resourceKey]
      : null;
    const defaultResource = (resources?.default && typeof resources.default === 'object')
      ? resources.default
      : null;

    const resourceGateIds = Array.isArray(selectedResource?.gateIds)
      ? selectedResource.gateIds.map((value) => this.normalizeGateLabelText(value)).filter(Boolean)
      : [];
    if (resourceGateIds.length > 1) {
      const labels = resourceGateIds
        .map((gateId) => {
          const configuredGate = gatesById?.[gateId];
          if (!configuredGate || typeof configuredGate !== 'object') return '';
          return this.resolveGateDisplayLabel(configuredGate, sbtAddresses[0] || '');
        })
        .map((label) => this.normalizeGateLabelText(label))
        .filter((label) => label && label !== 'default gate');
      if (labels.length) return labels.join(' + ');
      return resourceGateIds.join(' + ');
    }

    const candidateGateIds = [
      selectedResource?.gateId,
      gate?.gateId,
      gate?.id,
      sponsored?.defaultGateId,
      defaultResource?.gateId,
    ].map((value) => this.normalizeGateLabelText(value)).filter(Boolean);

    for (const gateId of candidateGateIds) {
      const configuredGate = gatesById?.[gateId];
      if (!configuredGate || typeof configuredGate !== 'object') continue;
      const label = this.resolveGateDisplayLabel(configuredGate, sbtAddresses[0] || '');
      if (label && label !== 'default gate') return label;
    }

    const targetSbtKey = Array.from(new Set(
      (Array.isArray(sbtAddresses) ? sbtAddresses : [])
        .map((addr) => String(addr || '').toLowerCase())
        .filter(Boolean)
    )).sort().join('|');

    if (targetSbtKey) {
      const configuredGates = Object.values(gatesById || {});
      for (const configuredGate of configuredGates) {
        if (!configuredGate || typeof configuredGate !== 'object') continue;
        const configuredSbtKey = Array.from(new Set(
          [
            ...(Array.isArray(configuredGate.sbtAddresses) ? configuredGate.sbtAddresses : []),
            configuredGate.sbtAddress,
          ]
            .map((addr) => String(addr || '').toLowerCase())
            .filter(Boolean)
        )).sort().join('|');
        if (!configuredSbtKey || configuredSbtKey !== targetSbtKey) continue;
        const label = this.resolveGateDisplayLabel(configuredGate, sbtAddresses[0] || '');
        if (label && label !== 'default gate') return label;
      }
    }

    return '';
  };

  resolveLockAudienceSessionName = () => {
    const fromProps = this.normalizeGateLabelText(this.props.sessionName);
    if (fromProps) return fromProps;

    const fromPolicyCfg = this.normalizeGateLabelText(this._responseGatePolicyCache?.cfg?.sessionName);
    if (fromPolicyCfg) return fromPolicyCfg;

    try {
      const isQuestionResponseFlow = !!(this.props.singleQuestionMode || this.props.isStandalone);
      const slug = isQuestionResponseFlow
        ? resolveSlugForIds({
            questionId: this.props.singleQuestionMode ? this.props.questionID : null,
            props: this.props,
            network: this.props.network,
          })
        : resolveSlugForIds({
            surveyId: this.props.surveyId,
            props: this.props,
            network: this.props.network,
          });
      const lockAudienceContext = resolveLockAudienceSessionNameContext(slug);
      const fromCfg = this.normalizeGateLabelText(lockAudienceContext.sessionName);
      if (fromCfg) return fromCfg;
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    return 'session';
  };

  resolveQuestionGateOption = (questionId = null) => {
    const gateDetails = this.getResponseGateOptions(questionId);
    if (!gateDetails.length) return null;

    const gateNames = Array.from(new Set(gateDetails.map((entry) => entry.label).filter(Boolean)));
    const allSbtAddresses = Array.from(new Set(gateDetails.flatMap((entry) => entry.sbtAddresses || [])));
    const sbtSummary = allSbtAddresses.length > 0
      ? allSbtAddresses
        .map((addr) => this.resolveSbtGateLabel(addr) || proposalScripts.getShortenedAddress(addr, false))
        .join(', ')
      : 'none';

    return {
      label: gateNames.join(', ') || gateDetails[0]?.label || 'gate',
      gateNames,
      gateDetails,
      sbtSummary,
      resourceKey: this.getResponseGatePolicy()?.primaryResource || 'default',
    };
  };

  getLockAudienceMenuStateKey = (questionId, fieldKey = 'answer') => {
    const qid = String(questionId || '').toLowerCase();
    if (!qid) return '';
    return String(fieldKey || '').trim().toLowerCase() === 'additional'
      ? `${qid}:additional`
      : qid;
  };

  isLockAudienceMenuOpen = (questionId, fieldKey = 'answer') => {
    const key = this.getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return false;
    return !!(this.state.lockAudienceMenuByQuestion && this.state.lockAudienceMenuByQuestion[key]);
  };

  toggleLockAudienceGateDetails = (questionId, forceOpen = null, fieldKey = 'answer') => {
    const key = this.getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    const normalizedGateId = this.normalizeGateLabelText(
      typeof forceOpen === 'string' ? forceOpen : ''
    );
    this.setState((prev) => {
      const current = this.normalizeGateLabelText(prev.lockAudienceGateDetailsByQuestion?.[key] || '');
      const nextValue = typeof forceOpen === 'string'
        ? (current === normalizedGateId ? '' : normalizedGateId)
        : (forceOpen ? current : '');
      return {
        lockAudienceGateDetailsByQuestion: nextValue ? { [key]: nextValue } : {},
      };
    });
  };

  toggleLockAudienceMenu = (questionId, forceOpen = null, fieldKey = 'answer') => {
    const key = this.getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    this.setState((prev) => {
      const current = !!prev.lockAudienceMenuByQuestion?.[key];
      const nextValue = forceOpen === null ? !current : !!forceOpen;
      return {
        lockAudienceMenuByQuestion: nextValue ? { [key]: true } : {},
        lockAudienceGateDetailsByQuestion: nextValue ? prev.lockAudienceGateDetailsByQuestion : {},
      };
    });
  };

  applyAnswerEncryptionAudience = (surveyIndex, questionId, audience, options = {}) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    if (!qid) return;
    this.invalidateDiffCaches();

    const normalizedAudience = this.normalizeResponseEncryptionAudience(audience, qid);
    const normalizedGateId = normalizedAudience === 'gate'
      ? this.resolveFieldEncryptionGateId({
          encryptionAudience: normalizedAudience,
          encryptionGateId: options?.gateId || '',
        }, qid, 'answer')
      : null;

    this.setState((prev) => {
      const arr = Array.isArray(prev.surveysResponseState) ? [...prev.surveysResponseState] : [];
      while (arr.length <= idx) arr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });

      const slice = { ...(arr[idx] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
      const nextAnswer = { ...(slice.answers?.[qid] || this.buildEmptyResponseFieldState(qid)) };
      const nextAdditional = { ...(slice.additionalComments?.[qid] || this.buildEmptyResponseFieldState(qid, 'additional')) };
      const nextAdditionalMode = this.normalizeFieldAudienceMode(nextAdditional.audienceMode, 'additional', nextAdditional);

      nextAnswer.encrypted = true;
      nextAnswer.encryptionAudience = normalizedAudience;
      nextAnswer.encryptionGateId = normalizedGateId;
      nextAnswer.audienceMode = 'explicit';

      if (nextAdditionalMode !== 'explicit') {
        slice.additionalComments = {
          ...(slice.additionalComments || {}),
          [qid]: this.buildInheritedAdditionalFieldState(nextAdditional, nextAnswer, qid),
        };
      } else {
        slice.additionalComments = { ...(slice.additionalComments || {}), [qid]: nextAdditional };
      }

      slice.answers = { ...(slice.answers || {}), [qid]: nextAnswer };
      arr[idx] = slice;

      return {
        surveysResponseState: arr,
        lockAudienceMenuByQuestion: {},
        lockAudienceGateDetailsByQuestion: {},
        submittedSinceLastEdit: updateSubmittedSinceLastEdit(prev.submittedSinceLastEdit, 'user_edit'),
      };
    }, () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };

  applyAdditionalEncryptionAudience = (surveyIndex, questionId, audience, options = {}) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    if (!qid) return;
    this.invalidateDiffCaches();

    this.setState((prev) => {
      const arr = Array.isArray(prev.surveysResponseState) ? [...prev.surveysResponseState] : [];
      while (arr.length <= idx) arr.push({ answers: {}, importance: {}, conviction: {}, additionalComments: {} });

      const slice = { ...(arr[idx] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
      const nextAnswer = { ...(slice.answers?.[qid] || this.buildEmptyResponseFieldState(qid)) };
      const nextAdditional = { ...(slice.additionalComments?.[qid] || this.buildEmptyResponseFieldState(qid, 'additional')) };
      const rawAudience = String(audience || '').trim().toLowerCase();

      if (rawAudience === 'inherit' || rawAudience === 'follow' || rawAudience === 'follow-answer') {
        slice.additionalComments = {
          ...(slice.additionalComments || {}),
          [qid]: this.buildInheritedAdditionalFieldState(nextAdditional, nextAnswer, qid),
        };
      } else if (rawAudience === 'none' || rawAudience === 'plaintext' || rawAudience === 'not-encrypted') {
        slice.additionalComments = {
          ...(slice.additionalComments || {}),
          [qid]: {
            ...nextAdditional,
            encrypted: false,
            encryptionAudience: 'self',
            encryptionGateId: null,
            audienceMode: 'explicit',
          },
        };
      } else {
        const normalizedAudience = this.normalizeResponseEncryptionAudience(rawAudience, qid);
        slice.additionalComments = {
          ...(slice.additionalComments || {}),
          [qid]: {
            ...nextAdditional,
            encrypted: true,
            encryptionAudience: normalizedAudience,
            encryptionGateId: normalizedAudience === 'gate'
              ? this.resolveFieldEncryptionGateId({
                  encryptionAudience: normalizedAudience,
                  encryptionGateId: options?.gateId || '',
                }, qid, 'additional')
              : null,
            audienceMode: 'explicit',
          },
        };
      }

      arr[idx] = slice;
      return {
        surveysResponseState: arr,
        lockAudienceMenuByQuestion: {},
        lockAudienceGateDetailsByQuestion: {},
        submittedSinceLastEdit: updateSubmittedSinceLastEdit(prev.submittedSinceLastEdit, 'user_edit'),
      };
    }, () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };

  buildLitEncryptionOptions = (audience = 'default') => {
    const audienceRaw = String(audience || 'default').trim().toLowerCase();
    if (audienceRaw === 'self') {
      return undefined;
    }

    const litHooks =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    if (!litHooks || (!litHooks.saveKey && !litHooks.getKey && !litHooks.accessControlConditions)) {
      return undefined;
    }

    const gatePolicy = this.getResponseGatePolicy();
    const gateRecipients = Array.isArray(gatePolicy?.recipients) ? gatePolicy.recipients : [];
    const base = {
      saveKey: litHooks.saveKey,
      getKey: litHooks.getKey,
      ...(gatePolicy?.allowFallbackConditions && litHooks.accessControlConditions
        ? { accessControlConditions: litHooks.accessControlConditions }
        : {}),
      ...(litHooks.chain ? { chain: litHooks.chain } : {}),
    };

    if (gateRecipients.length) {
      return {
        ...base,
        accessControlConditions: gateRecipients[0].accessControlConditions,
        chain: gateRecipients[0].chain,
        recipients: gateRecipients,
      };
    }

    if (audienceRaw === 'gate') {
      return undefined;
    }

    // If the resource gate resolves open on-chain, do not apply default/global Lit ACLs.
    if (!gatePolicy?.allowFallbackConditions) {
      return undefined;
    }

    if (!base.saveKey && !base.getKey && !base.accessControlConditions) {
      return undefined;
    }

    return base;
  };

  buildLitEncryptionOptionsForRecipients = (recipients = []) => {
    const list = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
    if (!list.length) return undefined;

    const litHooks =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    if (!litHooks || typeof litHooks.saveKey !== 'function') {
      return undefined;
    }

    const first = list[0] || {};
    if (!first.accessControlConditions || !first.chain) return undefined;

    const out = {
      saveKey: litHooks.saveKey,
      getKey: litHooks.getKey,
      accessControlConditions: first.accessControlConditions,
      chain: first.chain,
      recipients: list,
    };

    if (litHooks.litNetwork) out.litNetwork = litHooks.litNetwork;
    if (litHooks.connectTimeout) out.connectTimeout = litHooks.connectTimeout;
    if (litHooks.providerLike) out.providerLike = litHooks.providerLike;
    else if (this.props.provider) out.providerLike = this.props.provider;
    if (litHooks.resourceAbilityRequests) out.resourceAbilityRequests = litHooks.resourceAbilityRequests;

    return out;
  };

  buildFieldEncryptionWorkGroups = (slice = {}, changedQids = new Set()) => {
    const groups = new Map();
    const missingRecipients = [];

    const ensureGroup = (recipients = []) => {
      const normalizedRecipients = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
      const groupKey = normalizedRecipients.length > 0
        ? `gate:${JSON.stringify(normalizedRecipients)}`
        : 'self';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          recipients: normalizedRecipients,
          qids: new Set(),
          slice: {
            answers: {},
            additionalComments: {},
            importance: {},
            conviction: {},
          },
        });
      }
      return groups.get(groupKey);
    };

    Array.from(changedQids || []).forEach((qidRaw) => {
      const qid = normalizeQuestionIdKey(qidRaw);
      if (!qid) return;
      const questionLocked = this.isQuestionLockedForResponse(qid);
      const applyLock = (field, fieldKey = 'answer') => {
        if (!questionLocked || !field || typeof field !== 'object') return field;
        return {
          ...field,
          encrypted: true,
          encryptionAudience: 'gate',
          encryptionGateId: this.resolveFieldEncryptionGateId(field, qid, fieldKey),
        };
      };

      const fieldSpecs = [
        { fieldKey: 'answer', bucketKey: 'answers', value: applyLock(slice.answers?.[qid], 'answer') },
        { fieldKey: 'additional', bucketKey: 'additionalComments', value: applyLock(slice.additionalComments?.[qid], 'additional') },
      ];

      fieldSpecs.forEach(({ fieldKey, bucketKey, value }) => {
        if (!shouldEncryptResponseFieldForSubmit(value)) return;
        const audience = this.resolveFieldEncryptionAudience(value, qid, fieldKey);
        const recipients = audience === 'gate'
          ? this.getEffectiveRecipientsForField({ questionId: qid, fieldKey, field: value })
          : [];
        if (audience === 'gate' && (!Array.isArray(recipients) || recipients.length === 0)) {
          missingRecipients.push(`${fieldKey}:${qid}`);
          return;
        }
        const group = ensureGroup(recipients);
        group.qids.add(qid);
        group.slice[bucketKey][qid] = { ...value };
      });
    });

    return {
      groups: Array.from(groups.values()).map((group) => ({
        ...group,
        qids: Array.from(group.qids || []),
      })),
      missingRecipients,
    };
  };

  encryptFieldWorkGroups = async ({ workGroups = [], baseOpts = {} } = {}) => {
    const encState = { answers: {}, additionalComments: {} };
    const list = Array.isArray(workGroups) ? workGroups : [];

    for (const group of list) {
      const hasSliceWork =
        Object.keys(group?.slice?.answers || {}).length > 0 ||
        Object.keys(group?.slice?.additionalComments || {}).length > 0;
      if (!hasSliceWork || !Array.isArray(group?.qids) || group.qids.length === 0) {
        continue;
      }

      let partial = null;
      if (Array.isArray(group.recipients) && group.recipients.length > 0) {
        const lit = this.buildLitEncryptionOptionsForRecipients(group.recipients);
        if (!lit) {
          throw new Error('Lit hooks unavailable; cannot encrypt gated responses.');
        }
        // eslint-disable-next-line no-await-in-loop
        partial = await cryptoUtils.encryptMultipleAnswers(group.slice, {
          ...baseOpts,
          onlyTheseQids: group.qids,
          lit,
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        partial = await cryptoUtils.encryptMultipleAnswers(group.slice, {
          ...baseOpts,
          onlyTheseQids: group.qids,
        });
      }

      Object.assign(encState.answers, partial?.answers || {});
      Object.assign(encState.additionalComments, partial?.additionalComments || {});
    }

    return encState;
  };


  encryptAndUpload = async () => {
    try {
      if (!this.props.loginComplete) {
        this._submitGuard = false;
        this.props.toggleLoginModal(true);
        return;
      }

      const answeredCount = this.getAnsweredQuestionsCount();
      if (answeredCount === 0) {
        this._submitGuard = false;
        this.setState({ submissionError: 'No responses to submit.' });
        if (this._emptySubmitTimer) {
          clearTimeout(this._emptySubmitTimer);
        }
        this._emptySubmitTimer = setTimeout(() => {
          this.setState({ submissionError: '' });
          this._emptySubmitTimer = null;
        }, 2000);
        return;
      }

      if (this.maybeBlockSubmitUntilQuestionPoolComplete()) {
        this._submitGuard = false;
        return;
      }

      this.setState({ isSubmitting: true, submitProgress: 0, currentStep: 1, submissionError: '' });

      const providerKind = cryptoUtils.getProviderKind(this.props.provider);

      // Compute changed set once (used for encrypt + submit)
      const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
      const { changedQids } = this.getChangedQidsAndFields(surveyIndex);

      // Local state tracker to ensure baseline syncs with encrypted data even if React is slow
      let activeSlice = this.state.surveysResponseState?.[surveyIndex] || { answers: {}, additionalComments: {}, importance: {}, conviction: {} };

      // Only encrypt when there are changed encrypted fields
      const pendingStats =
        (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) ||
        { total: this.state.modifiedCount || 0, encrypted: this.state.hasEncryptedChanges ? 1 : 0 };
      const shouldEncrypt = Number(pendingStats.encrypted || 0) > 0 && changedQids.size > 0;

      if (shouldEncrypt) {
        const {
          groups: workGroups,
          missingRecipients,
        } = this.buildFieldEncryptionWorkGroups(activeSlice, changedQids);
        const hasWork = workGroups.some((group) => (
          Object.keys(group?.slice?.answers || {}).length > 0 ||
          Object.keys(group?.slice?.additionalComments || {}).length > 0
        ));

        if (hasWork) {
        if (missingRecipients.length > 0) {
          throw new Error(`Missing Lit recipients for gated field(s): ${missingRecipients.join(', ')}`);
        }
          const chainId = this.resolveSessionChainId();
          const surveyId = this.props.singleQuestionMode ? ethers.constants.HashZero : this.props.surveyId;
          const poolForCommit =
            (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)
              ? this.state.questionPool
              : (Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : []);
          const encState = await this.encryptFieldWorkGroups({
            workGroups,
            baseOpts: {
              providerKind,
              provider: this.props.provider,
              account: this.props.account,
              chainId,
              surveyId,
              questionPool: poolForCommit,
              hasher: this.state.hasher,
            },
          });

          // Merge back (overrides hash with salted Keccak; carries envelope v1 + recipients)
          const newArr = [...this.state.surveysResponseState];
          const base = { ...(newArr[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };

          Object.keys(encState.answers || {}).forEach((qid) => {
            base.answers = { ...(base.answers || {}) };
            base.answers[qid] = { ...(base.answers[qid] || {}), ...(encState.answers[qid] || {}) };
          });
          Object.keys(encState.additionalComments || {}).forEach((qid) => {
            base.additionalComments = { ...(base.additionalComments || {}) };
            base.additionalComments[qid] = { ...(base.additionalComments[qid] || {}), ...(encState.additionalComments[qid] || {}) };
          });

          // Update local tracker AND React state
          activeSlice = base;
          newArr[surveyIndex] = base;
          this.setState({ surveysResponseState: newArr });

          // Verify only the changed set
          await this.verifyEncryption(changedQids);
        }
      }

      this.setState({ currentStep: 2 });

      // Await the receipt to ensure transaction is confirmed before optimistic update
      const receipt = await this.submitSurveyResponse();
      surveyLog.log("Submission receipt received", receipt?.blockNumber || 'unknown block');

      // Success path

      // 1. STOP any pending draft saves immediately
      if (this._persistTimer) {
        clearTimeout(this._persistTimer);
        this._persistTimer = null;
      }

      // 2. Clear drafts for changed QIDs
      surveyLog.log("Clearing drafts for QIDs:", Array.from(changedQids));
      try {
        Array.from(changedQids).forEach((qid) => this.clearDraftFor && this.clearDraftFor(String(qid)));
      } catch (_) {
        if (this.props.singleQuestionMode && this.props.questionID) {
          this.clearDraftFor(this.props.questionID.toLowerCase());
        } else {
          this.clearDraft();
        }
      }

      // 3. Compute responder URL for post-submit UI
      let responseUrl;
      const submittedCacheSlug = normalizeSessionSlugValue(
        receipt?.__ceSubmissionGroupKey != null
          ? receipt.__ceSubmissionGroupKey
          : this._getEffectiveDraftSlug()
      );
      try {
        const accountLower = (this.props.account || '').toLowerCase();
        if (accountLower) {
          if (this.props.singleQuestionMode) {
            const qLower = (this.props.questionID || '').toLowerCase();
            if (qLower) {
              responseUrl = buildQuestionRoutePath(qLower, {
                responderAddress: accountLower,
                sessionSlug: submittedCacheSlug,
              });
            }
          } else if (!this.props.isStandalone) {
            const sLower = (this.props.surveyId || '').toLowerCase();
            if (sLower) responseUrl = `/survey/${sLower}/${accountLower}${submittedCacheSlug ? `?session=${encodeURIComponent(submittedCacheSlug)}` : ''}`;
          }
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      responseUrl = responseUrl || window.location.pathname;

      // 4. UPDATE BASELINE & OPTIMISTIC STATE
      surveyLog.log("Setting new Baseline");

      // Ensure surveysResponseState and editBaseline are mathematically identical
      // We clone activeSlice (which holds the final encrypted/plaintext state)
      const finalSlice = this.deepClone(activeSlice);
      const nextBaseline = this.deepClone(finalSlice);

      // Construct the explicit new state array to prevent any diff artifacts
      const nextSurveysResponseState = [...this.state.surveysResponseState];
      nextSurveysResponseState[surveyIndex] = finalSlice;

      const optimisticUserAnswers = this.prepareJsonAndHash(surveyIndex);

      // Check encryption status from the new baseline
      const hasEncrypted = Object.values(nextBaseline.answers || {}).some(a => !!a.encrypted) ||
                           Object.values(nextBaseline.additionalComments || {}).some(a => !!a.encrypted);
      this.invalidateDiffCaches();
      this._userAnswersSliceCache = { source: null, value: null };

      this._submitGuard = false;
      this.setState({
        isSubmitting: false,
        submitProgress: 100,
        submissionComplete: true, // Locks fetchers from overwriting
        submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'submit_success'),
        currentStep: 3,
        suppressPrefill: false,
        responseUrl,

        // Force UI state and baseline to match exactly
        surveysResponseState: nextSurveysResponseState,
        editBaseline: nextBaseline,

        userAnswers: optimisticUserAnswers,
        userHasResponse: true,
        userResponseEncrypted: hasEncrypted,
        isDirty: false,
        modifiedCount: 0,
        pileDiscardedEdits: false,
        hasEncryptedChanges: false,
      }, async () => {
        try {
          const cacheWriteResult = await this.writeSubmittedResponsesToLocalCaches({
            receipt,
            questionResponses: receipt?.__ceQuestionResponses,
            surveyResponse: receipt?.__ceSurveyResponse,
            surveyId: receipt?.__ceSurveyId,
            submissionSlug: submittedCacheSlug,
          }).catch((error) => {
            surveyLog.warn('[SurveyQuestions] Local submit cache write-through failed:', error);
            return { questionCacheWritten: false, surveyCacheWritten: false };
          });

          if (
            !cacheWriteResult?.questionCacheWritten &&
            typeof this.props.refreshQuestionResponses === 'function'
          ) {
            const ids = Array.from(changedQids).map((id) => normalizeQuestionIdKey(id)).filter(Boolean);
            if (ids.length > 0) {
              await this.props.refreshQuestionResponses(ids, {
                slug: submittedCacheSlug,
                responder: this.props.account || '',
              });
            }
          }
          if (
            !cacheWriteResult?.surveyCacheWritten &&
            !this.props.singleQuestionMode &&
            typeof this.props.refreshSurveyResponsesByID === 'function' &&
            this.props.surveyId
          ) {
            await this.props.refreshSurveyResponsesByID(this.props.surveyId);
          }
        } catch (e) { surveyLog.warn('SurveyTool: callback', e); }
      });
    } catch (error) {
      surveyLog.error('Failed to submit survey:', error);
      this._submitGuard = false;
      this.setState({
        isSubmitting: false,
        submitProgress: 0,
        submissionComplete: false,
        submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'submit_error'),
        submissionError: error.message || 'Submission failed.'
      });
    }
  };


  /**
   * Single source of truth for pending edit stats (Full Mode).
   * total  = # qIDs with any changed field vs. baseline
   * encrypted = # of those qIDs where a changed field is currently encrypted
   */
  computePendingEditStatsAtIndex = (idx) => {
    const currentSlice =
      (this.state.surveysResponseState && this.state.surveysResponseState[idx]) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

    const pendingCache = this._pendingEditStatsCache;
    if (
      pendingCache &&
      pendingCache.idx === idx &&
      pendingCache.diffCacheRef === this._changedQidsAndFieldsCache &&
      pendingCache.currentSlice === currentSlice &&
      pendingCache.userAnswers === this.state.userAnswers &&
      pendingCache.questionPool === this.state.questionPool &&
      pendingCache.pileQuestions === this.state.pileQuestions &&
      pendingCache.questionId === this.props.questionID &&
      pendingCache.result
    ) {
      return pendingCache.result;
    }

    const { changedQids, changedMap } = this.getChangedQidsAndFields(idx);
    const total = changedQids.size;

    const ratingEnvelopeQids =
      total > 0 ? buildRatingEnvelopeQidSetFromUserAnswers(this.state.userAnswers) : new Set();

    let encrypted = 0;
    if (total > 0) {
      for (const qId of changedQids) {
        const qLower = String(qId || '').trim().toLowerCase();
        const fields = changedMap[qId] || {};
        const aEnc = (fields.answer || fields.encryptedAnswer) && !!(currentSlice.answers?.[qId]?.encrypted);
        const dEnc = (fields.additional || fields.encryptedAdditional) && !!(currentSlice.additionalComments?.[qId]?.encrypted);
        const questionLocked = this.isQuestionLockedForResponse(qId);
        const baselineRatingEncrypted = qLower ? ratingEnvelopeQids.has(qLower) : false;
        const ratingEnc =
          (fields.importance || fields.conviction) &&
          (baselineRatingEncrypted || questionLocked ||
            !!(currentSlice.answers?.[qId]?.encrypted) ||
            !!(currentSlice.additionalComments?.[qId]?.encrypted));
        if (aEnc || dEnc || ratingEnc) encrypted += 1;
      }
    }
    const result = { total, encrypted };
    this._pendingEditStatsCache = {
      idx,
      diffCacheRef: this._changedQidsAndFieldsCache,
      currentSlice,
      userAnswers: this.state.userAnswers,
      questionPool: this.state.questionPool,
      pileQuestions: this.state.pileQuestions,
      questionId: this.props.questionID,
      result,
    };
    return result;
  };

  getPendingEditStats = (surveyIndexParam) => (
    this.computePendingEditStatsAtIndex(this.getActiveSurveyIndex(surveyIndexParam))
  );




  /**
   * Exit editing and return to the pre-existing answer (if available).
   * - Does NOT change the URL.
   * - Prefers the original response source:
   *   • If viewing someone else via responderAddress → use parsedViewAddressAnswers
   *   • Else if user has their own saved response → use userAnswers
   *   • Else fall back to local (non-encrypted) cache slice for rendered IDs
   * - Rebuilds the edit baseline and live slice so diffs go to 0 immediately.
   * - Clears any draft so future rehydrate doesn’t re-apply edits.
   */
  handleExitEditing = () => {
    try {
      const surveyIndex =
        this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);

      // 1) Choose the correct original response to display
      const sourceAnswers = this.props.responderAddress
        ? this.state.parsedViewAddressAnswers
        : this.state.userAnswers;

      // 2) Build a baseline from the chosen source (or local cache as fallback)
      let baselineSlice = sourceAnswers
        ? this.buildSliceFromUserAnswers(sourceAnswers)
        : (this.buildSliceFromLocalCache() || { answers:{}, importance:{}, conviction:{}, additionalComments:{} });

      // 3) Fully restore the baseline so no off-screen edits are retained
      const nextSlice = {
        answers: this.deepClone(baselineSlice.answers || {}),
        importance: { ...(baselineSlice.importance || {}) },
        conviction: { ...(baselineSlice.conviction || {}) },
        additionalComments: this.deepClone(baselineSlice.additionalComments || {})
      };

      const renderedIds = this.getCurrentRenderedQuestionIds();
      renderedIds.forEach((qid) => {
        if (!nextSlice.answers[qid]) nextSlice.answers[qid] = this.buildEmptyResponseFieldState(qid);
        if (!nextSlice.additionalComments[qid]) nextSlice.additionalComments[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
      });

      const arr = Array.isArray(this.state.surveysResponseState) ? [...this.state.surveysResponseState] : [];
      while (arr.length <= surveyIndex) arr.push({ answers:{}, importance:{}, conviction:{}, additionalComments:{} });
      arr[surveyIndex] = nextSlice;

      // 4) Flip to view mode, set new baseline to the restored slice, and recompute stats
      this.setState(
        {
          surveysResponseState: arr,
          isEditing: false,
          displayAnswerMode: true,
          startFresh: false,
          editBaseline: this.deepClone(nextSlice),
          isDirty: false,
          modifiedCount: 0,
          hasEncryptedChanges: false,
          submissionError: '',
          submissionComplete: false,
          submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
        },
        () => {
          this.recalculateEditStats && this.recalculateEditStats();
          this.persistDraftSafely && this.persistDraftSafely();
          this.updateJsonPreview && this.updateJsonPreview();
        }
      );

      // 5) Clear draft so it doesn’t rehydrate back over the view
      this.clearDraft && this.clearDraft();
    } catch (e) {
      surveyLog.warn('[SurveyQuestions] handleExitEditing failed:', e);
      // Minimal fallback
      this.setState({
        isEditing: false,
        displayAnswerMode: true,
        submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
      }, () => {
        this.recalculateEditStats && this.recalculateEditStats();
      });
    }
  };



  verifyEncryption = async (onlyTheseQids = null) => {
    surveyLog.log("Verifying encryption...");
    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    const stateToCheck = this.state.surveysResponseState[surveyIndex];
    let verificationPassed = true;

    const limitSet = onlyTheseQids ? new Set(Array.from(onlyTheseQids)) : null;

    if (stateToCheck && stateToCheck.answers) {
      for (const qId in stateToCheck.answers) {
        if (limitSet && !limitSet.has(qId)) continue; // verify only changed set when provided
        const answer = stateToCheck.answers[qId];
        const additional = stateToCheck.additionalComments ? stateToCheck.additionalComments[qId] : null;

        if (answer && answer.encrypted && !answer.encryptedPortion && answer.value !== '*') {
          surveyLog.error(`Verification failed: Answer for ${qId} marked encrypted but has no encryptedPortion.`);
          verificationPassed = false;
        }
        if (additional && additional.encrypted && !additional.encryptedPortion && additional.value !== '*') {
          surveyLog.error(`Verification failed: Additional for ${qId} marked encrypted but has no encryptedPortion.`);
          verificationPassed = false;
        }
      }
    }

    if (!verificationPassed) {
      throw new Error("Encryption verification failed. Some data marked for encryption was not processed correctly.");
    }
    surveyLog.log("Encryption verification successful.");
    return true;
  };

  submitSurveyResponse = async (overrideState = null, overrideChangedQids = null) => {
    if (!this.props.loginComplete) {
      this.props.toggleLoginModal(true);
      return;
    }

    // Use correct survey index for payload + diff gating
    const idx = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);

    const data = this.prepareJsonAndHash(idx, undefined, overrideState);

    // Build full JSON snapshot first (unchanged behavior) then filter by changed set
    let changedSet;
    let changedMapForSubmit = {};
    try {
      const { changedQids, changedMap } = this.getChangedQidsAndFields(idx);
      changedMapForSubmit = changedMap || {};
      changedSet = overrideChangedQids ? overrideChangedQids : (changedQids || new Set());
    } catch (_) {
      changedMapForSubmit = {};
      changedSet = overrideChangedQids ? overrideChangedQids : new Set();
    }

    // If nothing actually changed, stop early (and throw so callers don't mark success)
    if (changedSet.size === 0) {
      this._submitGuard = false;
      this.setState({
        isSubmitting: false,
        submitProgress: 0,
        submissionError: 'No new or changed responses to submit.',
      });
      throw new Error('No new or changed responses to submit.');
    }

    let questionIds, questionResponses, surveyId, surveyResponse;

    if (this.props.singleQuestionMode) {
      const qid = data && data.questionID;
      if (!qid || !changedSet.has(qid)) {
        this._submitGuard = false;
        this.setState({
          isSubmitting: false,
          submitProgress: 0,
          submissionError: 'No new or changed responses to submit.',
        });
        throw new Error('No new or changed responses to submit.');
      }
      questionIds = [qid];
      questionResponses = [data];
      surveyId = ethers.constants.HashZero;
      surveyResponse = null;
    } else {
      const all = (data && Array.isArray(data.responses)) ? data.responses : [];
      // Filter down to changed qIDs only
      const filtered = all.filter((r) => r && r.questionID && changedSet.has(r.questionID));

      if (filtered.length === 0) {
        this._submitGuard = false;
        this.setState({
          isSubmitting: false,
          submitProgress: 0,
          submissionError: 'No new or changed responses to submit.',
        });
        throw new Error('No new or changed responses to submit.');
      }

      questionIds = filtered.map((r) => r.questionID);
      questionResponses = filtered;
      surveyId = this.props.isStandalone ? ethers.constants.HashZero : this.props.surveyId;
      // Keep surveyResponse semantics identical but with filtered responses
      surveyResponse = this.props.isStandalone ? null : { ...data, responses: filtered };
    }

    const submissionContext = this.resolveSubmissionGroupContext({
      questionIds,
      surveyId: this.props.singleQuestionMode ? null : (this.props.surveyId || null),
    });
    if (!submissionContext.ok) {
      throw new Error(submissionContext.error);
    }
    const submissionGroupKey = submissionContext.submissionGroupKey;

    // Rating encryption (importance/conviction):
    // - Preserve existing rating envelopes on non-rating edits (prevents wiping encrypted ratings).
    // - When the response is encrypted (or rating already encrypted), ensure ratings are stored in envelopes
    //   and remove plaintext copies from the uploaded payload.
    try {
      const sliceForSubmit =
        (overrideState && typeof overrideState === 'object')
          ? overrideState
          : (this.state.surveysResponseState && this.state.surveysResponseState[idx]) ||
            { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

      const encChainId = this.resolveSessionChainId(submissionGroupKey);
      const encSurveyId =
        (this.props.singleQuestionMode || this.props.isStandalone)
          ? ethers.constants.HashZero
          : this.props.surveyId;

      const pickAudienceForQid = (qid) => {
        const qLower = String(qid || '').trim().toLowerCase();
        if (!qLower) return { audience: 'self', recipients: [] };
        if (this.isQuestionLockedForResponse(qLower)) {
          return {
            audience: 'gate',
            recipients: this.getEffectiveRecipientsForQid(qLower),
          };
        }

        const ans = sliceForSubmit.answers?.[qLower] || {};
        const add = sliceForSubmit.additionalComments?.[qLower] || {};

        if (ans?.encrypted) {
          const aAud = this.resolveFieldEncryptionAudience(ans, qLower, 'answer');
          if (aAud === 'gate') {
            return {
              audience: 'gate',
              recipients: this.getEffectiveRecipientsForField({
                questionId: qLower,
                fieldKey: 'answer',
                field: ans,
              }),
            };
          }
          if (aAud === 'self') return { audience: 'self', recipients: [] };
        }

        if (add?.encrypted) {
          const dAud = this.resolveFieldEncryptionAudience(add, qLower, 'additional');
          if (dAud === 'gate') {
            return {
              audience: 'gate',
              recipients: this.getEffectiveRecipientsForField({
                questionId: qLower,
                fieldKey: 'additional',
                field: add,
              }),
            };
          }
          if (dAud === 'self') return { audience: 'self', recipients: [] };
        }

        const defaultAudience = this.getDefaultResponseEncryptionAudienceForQid(qLower);
        return {
          audience: defaultAudience,
          recipients: defaultAudience === 'gate' ? this.getEffectiveRecipientsForQid(qLower) : [],
        };
      };

      const shouldEncryptRatingForQid = (qid, respObj) => {
        const locked = this.isQuestionLockedForResponse(qid);
        const ansState = sliceForSubmit.answers?.[qid];
        const addState = sliceForSubmit.additionalComments?.[qid];
        const encryptedState = !!locked || !!ansState?.encrypted || !!addState?.encrypted;
        const encryptedPayload = !!respObj?.answer?.encrypted || !!respObj?.additional?.encrypted;
        return encryptedState || encryptedPayload;
      };

      const baseOpts = {
        provider: this.props.provider,
        account: this.props.account,
        chainId: encChainId,
        surveyId: encSurveyId,
        kind: 'rating',
        hasher: this.state.hasher,
      };
      const ratingFieldSpecs = [
        { fieldKey: 'importance', envelopeKey: 'importanceEncrypted' },
        { fieldKey: 'conviction', envelopeKey: 'convictionEncrypted' },
      ];

      // Snapshot latest on-chain rating values/envelopes so non-rating edits don't wipe them.
      const ratingBaselineByQid = new Map();
      try {
        const source = this.state.userAnswers;
        const list =
          source && typeof source === 'object'
            ? (Array.isArray(source.responses) ? source.responses : [source])
            : [];
        list.forEach((r) => {
          const id = String(r?.questionID || r?.questionId || '').trim().toLowerCase();
          if (!id) return;
          const impEnv = (typeof r?.importanceEncrypted === 'string') ? r.importanceEncrypted : '';
          const convEnv = (typeof r?.convictionEncrypted === 'string') ? r.convictionEncrypted : '';
          const impPlain = getImportanceFromResponse(r);
          const convPlain = getConvictionFromResponse(r);
          if (!impEnv && !convEnv && impPlain === null && convPlain === null) return;
          ratingBaselineByQid.set(id, {
            importanceEncrypted: impEnv,
            convictionEncrypted: convEnv,
            importance: impPlain,
            conviction: convPlain,
          });
        });
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

      // Serialize envelope creation to avoid concurrent wallet signature prompts (eth_signTypedData_v4).
      for (const respObj of (questionResponses || [])) {
        const qidRaw = String(respObj?.questionID || respObj?.questionId || '').trim();
        const qid = qidRaw.toLowerCase();
        if (!qid) continue;

        const fields =
          (changedMapForSubmit && (changedMapForSubmit[qidRaw] || changedMapForSubmit[qid])) ||
          {};
        const baseline = ratingBaselineByQid.get(qid) || null;
        const changedByField = {};

        ratingFieldSpecs.forEach(({ fieldKey, envelopeKey }) => {
          const fieldChanged = !!fields[fieldKey];
          changedByField[fieldKey] = fieldChanged;

          const baselineEnvelope = baseline?.[envelopeKey] || '';
          const baselinePlain = baseline?.[fieldKey];

          // Always carry forward existing envelopes so a non-rating edit can't wipe them.
          if (!respObj[envelopeKey] && baselineEnvelope) respObj[envelopeKey] = baselineEnvelope;

          // Preserve plaintext rating values for non-rating edits when the baseline is plaintext.
          // (When encryption is active, we migrate plaintext into envelopes below.)
          if (!fieldChanged && (respObj[fieldKey] === null || respObj[fieldKey] === undefined) && baselinePlain !== null && baselinePlain !== undefined) {
            respObj[fieldKey] = baselinePlain;
          }
        });

        const hasAnyExistingEnvelope = ratingFieldSpecs.some(({ envelopeKey }) => {
          const env = typeof respObj[envelopeKey] === 'string' ? respObj[envelopeKey] : '';
          return !!env;
        });

        // Rating encryption is active when the response is encrypted, or when rating is already encrypted.
        const shouldEncryptRating = hasAnyExistingEnvelope || shouldEncryptRatingForQid(qid, respObj);
        if (!shouldEncryptRating) {
          // Rating stays plaintext; clear any stale envelopes for changed fields.
          ratingFieldSpecs.forEach(({ fieldKey, envelopeKey }) => {
            if (changedByField[fieldKey]) respObj[envelopeKey] = '';
          });
          continue;
        }

        const fieldsNeedingEncryption = ratingFieldSpecs.filter(({ fieldKey, envelopeKey }) => {
          const value = respObj?.[fieldKey];
          const existingEnvelope = (typeof respObj[envelopeKey] === 'string') ? respObj[envelopeKey] : '';
          return (
            value !== undefined &&
            value !== null &&
            (changedByField[fieldKey] || !existingEnvelope)
          );
        });

        // Only resolve Lit recipients when we actually need to encrypt a value.
        let lit = undefined;
        if (fieldsNeedingEncryption.length > 0) {
          const audienceSelection = pickAudienceForQid(qid);
          if (audienceSelection.audience === 'gate') {
            const recipients = audienceSelection.recipients;
            if (!Array.isArray(recipients) || recipients.length === 0) {
              throw new Error(`Missing Lit recipients for gated rating encryption (${qid}).`);
            }
            lit = this.buildLitEncryptionOptionsForRecipients(recipients);
            if (!lit) {
              throw new Error('Lit hooks unavailable; cannot encrypt gated rating.');
            }
          }
        }

        for (const { fieldKey, envelopeKey } of ratingFieldSpecs) {
          const value = respObj?.[fieldKey];
          const existingEnvelope = (typeof respObj[envelopeKey] === 'string') ? respObj[envelopeKey] : '';
          const shouldEncryptField =
            (value !== undefined && value !== null) &&
            (changedByField[fieldKey] || !existingEnvelope);

          if (shouldEncryptField) {
            // eslint-disable-next-line no-await-in-loop
            respObj[envelopeKey] = await cryptoUtils.encryptEnvelopeValue(value, {
              ...baseOpts,
              ...(lit ? { lit } : {}),
              qId: `${fieldKey}:${qid}`,
            });
          } else if (changedByField[fieldKey]) {
            // Explicit clear on changed plaintext.
            respObj[envelopeKey] = '';
          }
        }

        // Rating is stored in envelopes only when encryption is active.
        ratingFieldSpecs.forEach(({ fieldKey }) => {
          respObj[fieldKey] = null;
        });
      }
    } catch (e) {
      surveyLog.error('Failed to encrypt response rating:', e);
      throw e;
    }

    // Centralized identifier hashing right before contract call
    const ensureHash = (v) => {
      try {
        if (cryptoUtils && typeof cryptoUtils.hashIdentifier === 'function') {
          return cryptoUtils.hashIdentifier(v);
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      try { if (utils.isHexString(v, 32)) return String(v).toLowerCase(); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      const s = (v === null || v === undefined) ? '' : String(v);
      return s.trim() === '' ? ethers.constants.HashZero : utils.id(s);
    };

    const hashedQuestionIds = Array.isArray(questionIds) ? questionIds.map(ensureHash) : [];
    const hashedSurveyId = ensureHash(surveyId);

    // Submit tx (must actually send or we throw)
    const tx = await contractScripts.submitResponses(
      this.props.provider,
      hashedQuestionIds,
      questionResponses,
      hashedSurveyId,
      surveyResponse,
      submissionGroupKey
    );

    // Normalize success:
    // - ethers.js TransactionResponse → await .wait()
    // - string hash or object with hash/transactionHash → accept
    // - otherwise → throw (prevents premature "Submitted" UI)
    const submittedPayloadMeta = {
      __ceQuestionResponses: this.deepClone(questionResponses || []),
      __ceSurveyResponse: surveyResponse ? this.deepClone(surveyResponse) : null,
      __ceSurveyId: surveyId || null,
      __ceSubmissionGroupKey: submissionGroupKey,
    };

    if (tx && typeof tx.wait === 'function') {
      const receipt = await tx.wait();
      if (!receipt || (receipt.status !== undefined && receipt.status !== 1)) {
        throw new Error('Submission failed on-chain.');
      }
      return { ...receipt, ...submittedPayloadMeta };
    }

    if (typeof tx === 'string' && tx.startsWith('0x') && tx.length >= 66) {
      return { transactionHash: tx, ...submittedPayloadMeta };
    }
    if (tx && (tx.transactionHash || tx.hash)) {
      return { ...tx, ...submittedPayloadMeta };
    }

    throw new Error('No transaction was sent.');
  };

  writeSubmittedResponsesToLocalCaches = async ({
    receipt = null,
    questionResponses = [],
    surveyResponse = null,
    surveyId = null,
    submissionSlug = null,
  } = {}) => {
    const responderLower = String(this.props.account || '').trim().toLowerCase();
    if (!responderLower) {
      return { questionCacheWritten: false, surveyCacheWritten: false };
    }

    const slug = normalizeSessionSlugValue(
      submissionSlug != null
        ? submissionSlug
        : this._getEffectiveDraftSlug()
    );
    const cacheWriteContext = resolveSubmittedCacheWriteContext(this.props, slug);
    const netIdStr = cacheWriteContext.networkIdStr || '';
    if (!netIdStr) {
      return { questionCacheWritten: false, surveyCacheWritten: false };
    }

    const recencyMeta = toResponseRecencyMeta(receipt);
    let questionCacheWritten = false;
    let surveyCacheWritten = false;

    const submittedQuestionResponses = Array.isArray(questionResponses) ? questionResponses : [];
    if (submittedQuestionResponses.length > 0) {
      await updateCacheAtomic('questionsCache', slug, (current) => {
        const nextCache = ensureQuestionsNet(current, netIdStr);
        const net = nextCache[netIdStr];
        if (!net.questions || typeof net.questions !== 'object') net.questions = {};
        if (!net.questionResponses || typeof net.questionResponses !== 'object') net.questionResponses = {};
        if (!net.questionResponsesMeta || typeof net.questionResponsesMeta !== 'object') net.questionResponsesMeta = {};
        let didWrite = false;

        submittedQuestionResponses.forEach((rawResponse) => {
          const questionId = normalizeQuestionIdKey(rawResponse?.questionID || rawResponse?.questionId);
          if (!questionId) return;
          if (!net.questionResponses[questionId] || typeof net.questionResponses[questionId] !== 'object') {
            net.questionResponses[questionId] = {};
          }
          if (!net.questionResponsesMeta[questionId] || typeof net.questionResponsesMeta[questionId] !== 'object') {
            net.questionResponsesMeta[questionId] = {};
          }
          if (!isIncomingResponseMetaNewer(recencyMeta, net.questionResponsesMeta[questionId][responderLower])) {
            return;
          }

          const nextResponse = stampResponsePayloadWithMeta(
            this.deepClone(rawResponse || {}),
            recencyMeta
          );
          net.questionResponses[questionId][responderLower] = nextResponse;
          net.questionResponsesMeta[questionId][responderLower] = {
            bn: recencyMeta.bn,
            txi: recencyMeta.txi,
            li: recencyMeta.li,
            ts: recencyMeta.ts,
          };

          const prevQuestion = (net.questions[questionId] && typeof net.questions[questionId] === 'object')
            ? net.questions[questionId]
            : {};
          net.questions[questionId] = {
            ...prevQuestion,
            id: questionId,
            ...(rawResponse?.type ? { type: rawResponse.type } : {}),
            ...(typeof rawResponse?.prompt === 'string' ? { prompt: rawResponse.prompt } : {}),
            ...(typeof rawResponse?.sessionName === 'string' && rawResponse.sessionName.trim()
              ? { sessionName: rawResponse.sessionName }
              : {}),
          };
          didWrite = true;
        });

        if (didWrite) questionCacheWritten = true;
        return nextCache;
      });
    }

    const surveyIdLower = normalizeQuestionIdKey(surveyId || surveyResponse?.surveyID || surveyResponse?.surveyId);
    const shouldWriteSurveyCache = (
      !this.props.singleQuestionMode &&
      !this.props.isStandalone &&
      surveyResponse &&
      surveyIdLower &&
      surveyIdLower !== normalizeQuestionIdKey(ethers.constants.HashZero)
    );

    if (shouldWriteSurveyCache) {
      await updateCacheAtomic('surveysCache', slug, (current) => {
        const nextCache = ensureSurveysNet(current, netIdStr);
        const net = nextCache[netIdStr];
        if (!net.surveys || typeof net.surveys !== 'object') net.surveys = {};
        if (!net.surveyResponses || typeof net.surveyResponses !== 'object') net.surveyResponses = {};
        if (!net.surveyResponses[surveyIdLower] || typeof net.surveyResponses[surveyIdLower] !== 'object') {
          net.surveyResponses[surveyIdLower] = {};
        }
        const existingResponse = net.surveyResponses[surveyIdLower][responderLower] || null;
        if (!isIncomingResponseMetaNewer(recencyMeta, existingResponse)) {
          return nextCache;
        }

        const mergedResponse = mergeSurveyResponsePayloads(
          existingResponse,
          this.deepClone(surveyResponse)
        );
        net.surveyResponses[surveyIdLower][responderLower] = stampResponsePayloadWithMeta(
          mergedResponse,
          recencyMeta
        );

        const prevSurvey = (net.surveys[surveyIdLower] && typeof net.surveys[surveyIdLower] === 'object')
          ? net.surveys[surveyIdLower]
          : {};
        const mergedResponses = Array.isArray(net.surveyResponses[surveyIdLower][responderLower]?.responses)
          ? net.surveyResponses[surveyIdLower][responderLower].responses
          : [];
        const mergedQuestionIds = mergedResponses
          .map((row) => normalizeQuestionIdKey(row?.questionID || row?.questionId))
          .filter(Boolean);
        net.surveys[surveyIdLower] = {
          ...prevSurvey,
          id: surveyIdLower,
          surveyID: surveyIdLower,
          ...(typeof surveyResponse?.surveyTitle === 'string' && surveyResponse.surveyTitle.trim()
            ? { title: surveyResponse.surveyTitle }
            : {}),
          ...(typeof surveyResponse?.sessionName === 'string' && surveyResponse.sessionName.trim()
            ? { sessionName: surveyResponse.sessionName }
            : {}),
          ...(mergedQuestionIds.length > 0 ? { questionIDs: mergedQuestionIds } : {}),
        };
        surveyCacheWritten = true;
        return nextCache;
      });
    }

    return { questionCacheWritten, surveyCacheWritten };
  };


  renderQuestionAnswer = (question, response, index, isOwnResponse) => {
    if (!question || !response) {
      surveyLog.warn('renderQuestionAnswer: question or response is undefined');
      return null;
    }
    const promptReloading = !!(this.state.decryptingByKey && this.state.decryptingByKey[`${question.id}:prompt`]);
    return (
      <SingleQuestionResponse
        key={`fullQ-${question.id}-${index}`}
        question={question}
        response={response}
        isOwnResponse={isOwnResponse}
        canDecryptOtherResponses={this.state.canDecryptOtherResponses}
        mode="fullscreen"
        sessionSlug={this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props)}
        activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
        onDecryptQuestion={(qId, fieldToDecrypt, resp) => this.handleDecryptQuestionAnswer(qId, fieldToDecrypt, resp)}
        onReloadQuestionPrompt={(qId) => this.handleReloadMaskedPrompt(qId)}
        promptReloading={promptReloading}
        showImportance={true}
        provider={this.props.provider}
        questionResponsesNonce={this.props.questionResponsesNonce}
        questionsCacheNonce={this.props.questionsCacheNonce || this.state.questionsCacheNonce}
        sbtCacheRevision={this.props.sbtCacheRevision}
      />
    );
  };

  renderSingleQuestionAnswer = (question, response, isOwnResponse) => {
    if (!question || !response) {
      surveyLog.warn('renderSingleQuestionAnswer: question or response is undefined');
      return null;
    }
    const promptReloading = !!(this.state.decryptingByKey && this.state.decryptingByKey[`${question.id}:prompt`]);
    return (
      <SingleQuestionResponse
        question={question}
        response={response}
        isOwnResponse={isOwnResponse}
        canDecryptOtherResponses={this.state.canDecryptOtherResponses}
        mode="fullscreen"
        sessionSlug={this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props)}
        activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
        onDecryptQuestion={(qId, fieldToDecrypt, resp) => this.handleDecryptQuestionAnswer(qId, fieldToDecrypt, resp)}
        onReloadQuestionPrompt={(qId) => this.handleReloadMaskedPrompt(qId)}
        promptReloading={promptReloading}
        showImportance={true}
        provider={this.props.provider}
        questionResponsesNonce={this.props.questionResponsesNonce}
        questionsCacheNonce={this.props.questionsCacheNonce || this.state.questionsCacheNonce}
        sbtCacheRevision={this.props.sbtCacheRevision}
      />
    );
  };


  hasEncryptedAnswers = () => {
    const stats =
      (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats())
      || null;
    if (stats) return Number(stats.encrypted || 0) > 0;

    // Fallback (should rarely run): preserve old behavior if stats unavailable
    const idx = 0;
    const slice = this.state.surveysResponseState?.[idx];
    if (!slice) return false;
    const anyEncAnswer = !!Object.values(slice.answers || {}).some(a => a && a.encrypted);
    const anyEncAdditional = !!Object.values(slice.additionalComments || {}).some(a => a && a.encrypted);
    return anyEncAnswer || anyEncAdditional;
  };



  renderSurveyAnswers = (responses, isOwnResponse) => {
    if (!this.state.questionPool || !Array.isArray(responses)) {
      surveyLog.warn('renderSurveyAnswers: questionPool or responses not ready.', this.state.questionPool, responses);
      return <div>Loading answers...</div>;
    }

    const questionMap = {};
    this.state.questionPool.forEach(q => {
       if (q && q.id) {
           questionMap[q.id] = q;
       } else {
            surveyLog.warn("Invalid question object found in questionPool:", q);
       }
    });

    return (
      <>
        {responses.map((response, index) => {
          if (!response || !response.questionID) {
              surveyLog.warn("Invalid response object at index:", index, response);
              return null;
          }

          const question = questionMap[response.questionID];
          if (question) {
            return this.renderQuestionAnswer(question, response, index, isOwnResponse);
          } else {
            surveyLog.warn(`Question not found in pool for response ID: ${response.questionID}`);
             return null;
          }
        })}
      </>
    );
  };

  getMemoizedMaskedQuestionVisibility = (questionPoolInput, singleQuestionMode) => {
    const fullQuestionPool = Array.isArray(questionPoolInput) ? questionPoolInput : EMPTY_QUESTION_POOL;
    const isSingleQuestionMode = !!singleQuestionMode;
    const modeKey = isSingleQuestionMode ? 'single' : 'multi';
    let memoByMode = null;
    try {
      memoByMode = this._maskedQuestionVisibilityMemoByPool.get(fullQuestionPool) || null;
    } catch (_) {
      memoByMode = null;
    }
    if (memoByMode && memoByMode[modeKey]) {
      bumpSurveyPerfCounter('maskedVisibilityMemoHitCount');
      return memoByMode[modeKey];
    }
    bumpSurveyPerfCounter('maskedVisibilityMemoMissCount');
    bumpSurveyPerfCounter('maskedVisibilityPoolSizeOnMiss', fullQuestionPool.length);

    let visibleQuestionPool = fullQuestionPool;
    let hiddenMaskedQuestionIds = [];
    if (!isSingleQuestionMode) {
      visibleQuestionPool = [];
      hiddenMaskedQuestionIds = [];
      fullQuestionPool.forEach((question) => {
        const masked = this.isMaskedPromptText(question?.prompt) && !question?.promptDecrypted;
        if (!masked) {
          visibleQuestionPool.push(question);
          return;
        }
        const qid = String(question?.id || '').trim().toLowerCase();
        if (qid) hiddenMaskedQuestionIds.push(qid);
      });
    }
    bumpSurveyPerfCounter('maskedVisibilityVisibleCountOnMiss', visibleQuestionPool.length);
    bumpSurveyPerfCounter('maskedVisibilityHiddenCountOnMiss', hiddenMaskedQuestionIds.length);

    const value = {
      fullQuestionPool,
      visibleQuestionPool,
      hiddenMaskedQuestionIds,
    };
    const nextMemoByMode = memoByMode
      ? { ...memoByMode, [modeKey]: value }
      : { [modeKey]: value };
    try {
      this._maskedQuestionVisibilityMemoByPool.set(fullQuestionPool, nextMemoByMode);
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    return value;
  };

  render() {
    bumpSurveyPerfCounter('renderCount');
    const surveyIndex =
      this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
    const currentSurveyResponseState =
      this.state.surveysResponseState && this.state.surveysResponseState.length > surveyIndex
        ? this.state.surveysResponseState[surveyIndex]
        : null;
    const questionPoolReady =
      this.state.questionPool &&
      Array.isArray(this.state.questionPool) &&
      this.state.questionPool.length > 0;
    const {
      fullQuestionPool,
      visibleQuestionPool,
      hiddenMaskedQuestionIds,
    } = this.getMemoizedMaskedQuestionVisibility(this.state.questionPool, this.props.singleQuestionMode);
    const gatedEmptyStateReady =
      !this.props.singleQuestionMode &&
      fullQuestionPool.length > 0 &&
      visibleQuestionPool.length === 0 &&
      !!this.props.isQuestionCacheReady;
    const hasHiddenMaskedQuestions = hiddenMaskedQuestionIds.length > 0;
    const progressSlug = normalizeQuestionProgressSlug(
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    );
    const questionScanProgress =
      this.props.questionScanProgress &&
      doesQuestionProgressMatchSlug(this.props.questionScanProgress.slug, progressSlug)
        ? this.props.questionScanProgress
        : null;
    const scanProgressDisplay = buildQuestionScanProgressDisplay(questionScanProgress);
    const scanTotalBlocks = scanProgressDisplay.totalBlocks;
    const scanRemainingBlocks = scanProgressDisplay.remainingBlocks;
    const scanPercent = scanProgressDisplay.percentComplete;
    const hydrateDiscovered = Math.max(0, Number(questionScanProgress?.discoveredQuestions || 0));
    const hydrateDone = Math.max(0, Number(questionScanProgress?.hydratedQuestions || 0));
    const isHydrating = questionScanProgress?.phase === 'hydrate';
    const hasFullLoadingProgress = (scanProgressDisplay.requestedTotalBlocks > 0) || isHydrating;

    if (
      !currentSurveyResponseState ||
      (this.props.singleQuestionMode && !questionPoolReady && !this.state.displayAnswerMode) ||
      (!this.props.singleQuestionMode && !this.props.isStandalone && !questionPoolReady && !this.state.displayAnswerMode)
    ) {
      if (this.state.displayAnswerMode && this.state.parsedViewAddressAnswers) {
        // fall-through to render below
      } else {
        return (
          <div className={styles.loadingContainer}>
            <FontAwesomeIcon icon={faSpinner} spin />
            <div className={styles.fullLoadingHeadline}>Loading questions...</div>
            {hasFullLoadingProgress && (
              <div className={styles.fullLoadingProgressWrap}>
                <div className={styles.fullLoadingProgressMeta}>
                  <span>
                    {isHydrating
                      ? `${Math.max(0, hydrateDiscovered - Math.min(hydrateDone, hydrateDiscovered))} items left`
                      : scanProgressDisplay.metaLeftText}
                  </span>
                  <span>
                    {isHydrating
                      ? `${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered}`
                      : scanProgressDisplay.metaRightText}
                  </span>
                </div>
                <div className={styles.fullLoadingProgressBar}>
                  <div
                    className={styles.fullLoadingProgressFill}
                    style={{
                      width: `${isHydrating
                        ? (hydrateDiscovered > 0 ? Math.round((Math.min(hydrateDone, hydrateDiscovered) / hydrateDiscovered) * 100) : 0)
                        : scanPercent}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        );
      }
    }

    const viewingAnswers = this.state.displayAnswerMode;
    const canBuildJsonPreview =
      !viewingAnswers ||
      (viewingAnswers && this.state.questionPool && Array.isArray(this.state.questionPool));
    const jsonPreview = canBuildJsonPreview ? (this.state.jsonPreview || {}) : null;

    const notClickable = false;
    const viewedAddressRaw = String(this.props.viewAddress || this.props.responderAddress || '').trim();
    const viewedAddressLower = viewedAddressRaw.toLowerCase();
    const shortenedViewAddress =
      viewedAddressRaw
        ? proposalScripts.getShortenedAddress(
            viewedAddressRaw,
            notClickable
          )
        : '';
    const isOwnResponse =
      (this.props.viewAddress &&
        this.props.account &&
        this.props.viewAddress.toLowerCase() === this.props.account.toLowerCase()) ||
      (this.props.responderAddress &&
        this.props.account &&
        this.props.responderAddress.toLowerCase() === this.props.account.toLowerCase()) ||
      (!this.props.viewAddress && !this.props.responderAddress && this.props.account && this.state.userHasResponse);

    const isSingleQuestionView =
      this.props.singleQuestionMode ||
      (this.props.isStandalone && Array.isArray(this.state.questionPool) && this.state.questionPool.length === 1);

    // Submit button label block (centralized)
    const _pendingStats = this.getPendingStatsSnapshot();
    const _isOwnEdit = !!(this.state.userHasResponse && this.state.isEditing);
    const _suffix = _pendingStats.total === 1 ? 'Response' : 'Responses';

    const submitButtonText = isSingleQuestionView
      ? 'SUBMIT'
      : (this.props.computeSubmitLabel || computeSubmitLabel)(this, {
          suffix: _suffix,
          pendingStats: _pendingStats,
        });
    const submittedStateActive = !!(this.state.submittedSinceLastEdit || this.state.submissionComplete);
    const submittedIndicatorActive = shouldRenderSubmittedIndicator({
      submittedStateActive,
      isLoadingResponse: this.state.isLoadingResponse,
    });

    const userResponseNotice =
      this.state.userHasResponse &&
      isOwnResponse &&
      !isSingleQuestionView &&
      this.state.displayAnswerMode ? (
        <div className={styles.userResponseNotice} data-testid={E2E_TESTIDS.SURVEY_EXISTING_RESPONSE_NOTICE}>
          <p className={styles.userResponseNoticeTitle}>
            Existing survey response detected
          </p>
          <div className={styles.userResponseNoticeActions}>
            <Button
              onClick={this.handleStartFresh}
              id={styles.startFreshButton}
              data-testid={E2E_TESTIDS.SURVEY_START_FRESH}
              disabled={this.state.isSubmitting || this.state.isDecrypting}
            >
              Start Fresh
            </Button>
            <Button
              onClick={this.handleDecryptEdit}
              id={styles.decryptEditButton}
              data-testid={E2E_TESTIDS.SURVEY_DECRYPT_EDIT_ALL}
              disabled={this.state.isDecrypting || this.state.isSubmitting || !this.state.userResponseEncrypted}
            >
              {this.state.isDecrypting ? 'Decrypting...' : 'Decrypt / Edit All'}
            </Button>
            {submittedStateActive && this.state.responseUrl && (
              <a
                href={this.state.responseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.userResponseNoticeLink}
                title="View submitted response"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            )}
            {this.state.isEditing && (
              <Button
                onClick={this.handleExitEditing}
                id={styles.exitEditingButton}
                data-testid={E2E_TESTIDS.SURVEY_EXIT_EDITING}
                disabled={this.state.isSubmitting}
              >
                Exit Editing
              </Button>
            )}
          </div>
        </div>
      ) : null;

    const submitFooterClassName = [
      styles.footer,
      isSingleQuestionView ? styles.singleQuestionSubmitFooter : '',
    ].filter(Boolean).join(' ') || undefined;
    const singleQuestionSubmittedIndicatorActive = !isSingleQuestionView && submittedIndicatorActive;
    const submitButtonClassName = [
      isSingleQuestionView ? styles.singleQuestionSubmitButton : '',
      _pendingStats.total > 0 ? styles.submitGlow : '',
      singleQuestionSubmittedIndicatorActive ? styles.submittedButtonNoIcon : '',
    ].filter(Boolean).join(' ') || undefined;
    const submitAuxClassName = [
      styles.submitAux,
      isSingleQuestionView ? styles.singleQuestionSubmitAux : '',
    ].filter(Boolean).join(' ') || undefined;
    const submitLinkClassName = isSingleQuestionView ? styles.singleQuestionSubmitLink : undefined;
    const showSubmitAux =
      !isSingleQuestionView && (
        (_pendingStats.total > 0 && !this.state.isSubmitting && !singleQuestionSubmittedIndicatorActive) ||
        (singleQuestionSubmittedIndicatorActive && this.state.responseUrl)
      );

    const submitResponseButton = (
      <div className={submitFooterClassName} id={styles.surveyFooter}>
        <Button
          id={styles.submitSurveyButton}
          data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
          onClick={this.handlePrimarySubmitClick}
          className={submitButtonClassName}
          disabled={this.state.isSubmitting || (this.props.singleQuestionMode && this.hasMaskedCurrentQuestionPayload())}
        >
          {this.state.isSubmitting ? (
            <div id={styles.uploadingEncryptingText}>
              <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: '10px' }} />
              {this.state.currentStep === 1 && this.hasEncryptedAnswers()
                ? 'Encrypting...'
                : 'Uploading...'}
            </div>
          ) : singleQuestionSubmittedIndicatorActive ? (
            <div
              className={styles.submittedIndicatorText}
              data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}
            >
              Submitted
            </div>
          ) : this.state.submissionError ? (
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'red' }}
            >
              <FontAwesomeIcon icon={faExclamationCircle} style={{ marginRight: '10px' }} />
              {this.state.submissionError.length > 50 ? this.state.submissionError.substring(0, 47) + '...' : this.state.submissionError}
            </div>
          ) : isSingleQuestionView ? (
            <div className={styles.singleQuestionSubmitButtonContent}>
              <span className={styles.singleQuestionSubmitButtonLabel}>{submitButtonText}</span>
              <FontAwesomeIcon icon={faArrowRight} className={styles.singleQuestionSubmitButtonIcon} />
            </div>
          ) : (
            submitButtonText
          )}
        </Button>

        {showSubmitAux && (
          <div className={submitAuxClassName}>
            {_pendingStats.total > 0 && !this.state.isSubmitting && !singleQuestionSubmittedIndicatorActive && (
              <button
                type="button"
                className={`${styles.iconButton} ${isSingleQuestionView ? styles.singleQuestionSubmitIconButton : ''}`.trim() || undefined}
                onClick={this.handleRevertPendingChanges}
                title="Clear changes"
                aria-label="Clear pending changes"
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            )}

            {singleQuestionSubmittedIndicatorActive && this.state.responseUrl && (
              <a
                href={this.state.responseUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={submitLinkClassName}
                title="View submitted response"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} />
              </a>
            )}
          </div>
        )}
      </div>
    );
    const responseLink = this.state.responseUrl;

    const viewAnswersButton =
      (this.props.viewAddress || this.props.responderAddress) && (!isOwnResponse || !this.state.isEditing) ? (
        <Button onClick={this.toggleDisplayAnswerMode} id={styles.answerSurveyButton}>
          <FontAwesomeIcon icon={faArrowLeft} id={styles.encryptIcon} />
          <div id={styles.surveyButtonText}>
            {viewingAnswers
              ? ` Fill out ${this.props.singleQuestionMode ? 'question' : 'survey'}`
              : ` View ${shortenedViewAddress} ${
                  this.props.singleQuestionMode ? 'answer' : 'answers'
                }`}
          </div>
        </Button>
      ) : null;

    const exitEditingButton = this.state.isEditing ? (
      <Button onClick={this.handleExitEditing} id={styles.exitEditingButton} data-testid={E2E_TESTIDS.SURVEY_EXIT_EDITING}>
        Exit Editing
      </Button>
    ) : null;

    let jsonForDisplay;
    if (viewingAnswers) {
      if (this.state.noResponse) {
        jsonForDisplay = {
          message: `No response found for ${this.props.singleQuestionMode ? 'question' : 'survey'} from address: ${
            this.props.viewAddress || this.props.responderAddress || 'N/A'
          }`
        };
      } else {
        jsonForDisplay = isOwnResponse ? (this.state.userAnswers || jsonPreview) : (this.state.parsedViewAddressAnswers || { info: "Loading viewed response..."});
      }
    } else {
      jsonForDisplay = jsonPreview;
    }

    const hideEmbeddedDebugUi = !!this.props.hideEmbeddedDebugUi;
    const showQuestionJsonControls = !!(this.props.singleQuestionMode || this.props.isStandalone);
    const showSurveyJsonPanel =
      this.state.showSurveyJson && !this.props.isStandalone && !this.props.singleQuestionMode;
    const showQuestionsJsonPanel = this.state.showQuestionsJson && showQuestionJsonControls;
    const showResponseJsonPanel = this.state.showResponseJson;
    const surveyJson = showSurveyJsonPanel ? this.getSurveyJson() : null;
    const questionsJson = showQuestionsJsonPanel ? this.getQuestionsJson() : null;
    const responseJson = showResponseJsonPanel ? this.getResponseJson() : null;
    const canEditQuestions = !this.state.userHasResponse || this.state.startFresh || this.state.isEditing;
    const hasPendingEdits = !!this.state.isDirty || Number(_pendingStats.total || 0) > 0;
    const genericShowInlineSubmit = shouldRenderInlineSubmitButton({
      useHeaderSubmit: this.props.useHeaderSubmit,
      canEditQuestions,
      hasPendingEdits,
      submittedStateActive,
      isLoadingResponse: this.state.isLoadingResponse,
    });
    const showInlineSubmit = isSingleQuestionView
      ? hasPendingEdits
      : genericShowInlineSubmit;
    const showTopInlineSubmit = showInlineSubmit && !isSingleQuestionView;
    const showBottomInlineSubmit = showInlineSubmit;
    const surveyPageClassName = [
      isSingleQuestionView ? styles.singleQuestionPage : '',
      isSingleQuestionView && viewingAnswers ? styles.singleQuestionReadPage : '',
    ].filter(Boolean).join(' ') || undefined;
    const topSectionClassName = isSingleQuestionView ? styles.singleQuestionTopBar : undefined;
    const responseViewClassName = isSingleQuestionView ? styles.singleQuestionResponseView : undefined;
    const surveyJsonRowClassName = [
      styles.surveyJsonRow,
      isSingleQuestionView ? styles.singleQuestionJsonRow : '',
    ].filter(Boolean).join(' ') || undefined;
    const surveyJsonToggleClassName = isSingleQuestionView ? styles.singleQuestionJsonToggle : undefined;
    const questionJsonToggleClassName = [
      surveyJsonToggleClassName,
      isSingleQuestionView ? styles.singleQuestionJsonToggleQuestion : '',
    ].filter(Boolean).join(' ') || undefined;
    const responseJsonToggleClassName = [
      surveyJsonToggleClassName,
      isSingleQuestionView ? styles.singleQuestionJsonToggleResponse : '',
    ].filter(Boolean).join(' ') || undefined;
    const surveyJsonPanelClassName = isSingleQuestionView ? styles.singleQuestionJsonPanel : undefined;
    const hasRenderedEditableQuestions =
      canEditQuestions &&
      questionPoolReady &&
      !!currentSurveyResponseState &&
      !gatedEmptyStateReady &&
      Array.isArray(visibleQuestionPool) &&
      visibleQuestionPool.length > 0;
    const renderedEditableQuestions = hasRenderedEditableQuestions
      ? visibleQuestionPool.map((question, qIndex) =>
          this.renderQuestion(question, qIndex, currentSurveyResponseState)
        )
      : null;
    const lockedGateDetails = this.getMemoizedLockedQuestionGateDetails(hiddenMaskedQuestionIds);
    const lockedQuestionsBanner = this.renderLockedQuestionsPanel({
      hiddenMaskedQuestionIds,
      lockedGateDetails,
    });

    return (
      <div className={surveyPageClassName}>
        <div ref={this.topRef} className={topSectionClassName}>
            {viewAnswersButton}
            {userResponseNotice}
        </div>

        {viewingAnswers ? (
          this.state.isLoadingResponse ? (
            <div className={styles.loadingContainer}>
              <FontAwesomeIcon icon={faSpinner} spin /> Loading...
            </div>
          ) : this.state.noResponse ? (
            <div>
              {this.state.responseLookupWarning || (
                <>
                  No response for this{' '}
                  {this.props.singleQuestionMode ? 'question' : 'survey'} from address:{' '}
                  {this.props.viewAddress || this.props.responderAddress}
                </>
              )}
            </div>
          ) : (
              <div className={responseViewClassName}>
                  {viewedAddressRaw && (
                      <h2 className={styles.viewAddressHeading}>
                        <a href={`/u/${viewedAddressLower}`} className={styles.viewAddressLink}>
                          {shortenedViewAddress}
                        </a>
                        <span className={styles.viewAddressHeadingSuffix}>Response:</span>
                      </h2>
                  )}
                  {(this.props.singleQuestionMode && questionPoolReady && this.state.questionPool[0] && (isOwnResponse || this.state.parsedViewAddressAnswers)) || (!this.props.singleQuestionMode && questionPoolReady) || (!this.props.singleQuestionMode && this.state.parsedViewAddressAnswers) ? (
                      this.props.singleQuestionMode ? (
                        this.renderQuestionAnswer(
                            this.state.questionPool[0],
                            isOwnResponse ? (this.state.userAnswers || {}) : (this.state.parsedViewAddressAnswers || {}),
                            0,
                            isOwnResponse
                        )
                      ) : (
                          this.renderSurveyAnswers(
                              isOwnResponse
                              ? (this.state.userAnswers?.responses || [])
                              : (this.state.parsedViewAddressAnswers?.responses || []),
                              isOwnResponse
                          )
                      )
                  ) : (
                      !this.state.noResponse && <div className={styles.loadingContainer}><FontAwesomeIcon icon={faSpinner} spin /> Loading answer data...</div>
                  )}
              </div>
          )
        ) : (
            <>
              {showTopInlineSubmit && submitResponseButton}
              {/* Hidden in embedded full mode and single-question route mode */}
              {!hideEmbeddedDebugUi && canEditQuestions && !this.props.singleQuestionMode && (
                  <JsonIconButton
                    label=".json"
                    onClick={this.handleShowJsonAtBottom}
                    title="View JSON"
                  />
              )}
              {/* Locked/decrypt banner is hidden only in embedded full mode */}
              {!hideEmbeddedDebugUi && canEditQuestions && questionPoolReady && currentSurveyResponseState && lockedQuestionsBanner}
              {renderedEditableQuestions}
              {showBottomInlineSubmit && submitResponseButton}
              {canEditQuestions && !this.props.singleQuestionMode && (
                  <JsonIconButton
                    label="Back to top"
                    icon={faCaretUp}
                    onClick={this.handleScrollToTop}
                    title="Back to top"
                  />
                )}
              {this.state.userHasResponse && !this.state.startFresh && !this.state.isEditing && (
                    <div>
                        {questionPoolReady && this.state.userAnswers ? (
                            this.props.singleQuestionMode ? (
                                this.state.questionPool[0] ? (
                                    this.renderQuestionAnswer(
                                        this.state.questionPool[0],
                                        this.state.userAnswers,
                                        0,
                                        isOwnResponse
                                    )
                                ) : (<div>Loading question...</div>)
                            ) : (
                                  this.state.userAnswers.responses ? (
                                    this.renderSurveyAnswers(this.state.userAnswers.responses, isOwnResponse)
                                  ) : (<div>Loading answers...</div>)
                            )
                        ) : (
                              <div className={styles.loadingContainer}><FontAwesomeIcon icon={faSpinner} spin /> Loading submitted response...</div>
                        )}
                    </div>
                )}
            </>
        )}

        {/* Bottom JSON controls, gated by hideEmbeddedDebugUi for OnePageSession embedded full mode */}
        {!hideEmbeddedDebugUi && (
        <div ref={this.bottomRef}>
            <JsonButtonRow className={surveyJsonRowClassName}>
                {showQuestionJsonControls && (
                    <>
                        <JsonToggleButton
                            label="question .json"
                            active={this.state.showQuestionsJson}
                            onClick={this.toggleShowQuestionsJson}
                            className={questionJsonToggleClassName}
                        />
                        <JsonToggleButton
                            label="response .json"
                            active={this.state.showResponseJson}
                            onClick={this.toggleShowResponseJson}
                            className={responseJsonToggleClassName}
                        />
                    </>
                )}
                {!this.props.isStandalone && !this.props.singleQuestionMode && (
                    <>
                        <JsonToggleButton
                            label={this.state.showSurveyJson ? 'Hide Survey .json' : 'View Survey .json'}
                            active={this.state.showSurveyJson}
                            onClick={this.toggleShowSurveyJson}
                            className={surveyJsonToggleClassName}
                        />
                        <JsonToggleButton
                            label={this.state.showResponseJson ? 'Hide Response .json' : 'View Response .json'}
                            active={this.state.showResponseJson}
                            onClick={this.toggleShowResponseJson}
                            className={surveyJsonToggleClassName}
                        />
                    </>
                )}
            </JsonButtonRow>

            {showSurveyJsonPanel && (
                <JsonPanel
                    onCopy={() => this.copyJsonToClipboard(surveyJson, 'survey')}
                    copied={this.state.copiedSurveyJson}
                    copyTitle="Copy Survey Definition JSON"
                    className={surveyJsonPanelClassName}
                >
                    {this.jsonTreeDisplay(surveyJson)}
                </JsonPanel>
            )}
            {showQuestionsJsonPanel && (
                <JsonPanel
                    onCopy={() => this.copyJsonToClipboard(questionsJson, 'questions')}
                    copied={this.state.copiedQuestionsJson}
                    copyTitle="Copy Question Definition JSON"
                    className={surveyJsonPanelClassName}
                >
                    {this.jsonTreeDisplay(questionsJson)}
                </JsonPanel>
            )}
            {showResponseJsonPanel && (
                <JsonPanel
                    onCopy={() => this.copyJsonToClipboard(responseJson, 'response')}
                    copied={this.state.copiedResponseJson}
                    copyTitle="Copy Response JSON"
                    className={surveyJsonPanelClassName}
                >
                    {this.jsonTreeDisplay(responseJson)}
                </JsonPanel>
            )}
        </div>
        )}
      </div>
    );
  }
}

// Preserve direct QuestionsDashboard/SurveySelector consumers without reviving the import cycle.
SurveySelector.SurveyQuestionsComponent = SurveyQuestions;
QuestionsDashboard.SurveyQuestionsComponent = SurveyQuestions;


class PileViewMode extends SurveyQuestions {
  constructor(props) {
    super(props);

    // 1. Hydrate filter state from props or URL (Consume & Clear)
    let initialFilterState = normalizeSurveyToolFilterState(props.filterState);
    if (Object.keys(initialFilterState).length === 0 && typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        const f = url.searchParams.get('filter');
        if (f) {
          initialFilterState = normalizeSurveyToolFilterState(deserializeFilterState(f));
          // Clear from URL immediately
          url.searchParams.delete('filter');
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        surveyLog.error("PileViewMode: Error hydrating filter state", e);
      }
    }

    const nextState = {
      ...this.state,
      pileQuestions: [],
      allQuestionsForFilter: [],
      activePileIndex: 0,
      loading: true,
      showCreate: false,
      showComments: {},
      showConviction: {},
      filterModalOpen: false,
      surveysResponseState: [
        {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        },
      ],
      isSubmitting: false,
      submissionError: '',
      filterState: initialFilterState, // Set initial state
      isFilterActive: isSurveyToolFilterStateActive(initialFilterState),
      pileSubmitTempText: null,
      navCounterVisible: false, // Ensure this is initialized
      showLongLoading: false,
      hasHiddenGatedQuestions: false,
      loadingElapsedSec: 0,
      showHologramAssistant: false,
    };
    const warmSeedState = this.buildWarmPileSeedState(props);
    if (warmSeedState) {
      Object.assign(nextState, warmSeedState);
    }
    this.state = nextState;

    this._pileSubmitTimer = null;
    this._navFadeTimer = null;
    this.loadingTimeout = null;
    this._loadingElapsedTimer = null;
    this._loadingStartedAtMs = this.state.loading ? Date.now() : null;
    this._loadAndSortDebounceTimer = null;
    this._lastLoadAndSortResultSignature = '';
    this._lastInitializeResponseSig = '';

    // Ref for auto-scrolling to Create section
    this.createSectionRef = React.createRef();
  }

  buildWarmPileSeedState(propsIn = this.props) {
    try {
      if (!propsIn?.isQuestionCacheReady) return null;
      const slug = resolveEffectiveSlug(propsIn);
      const extraSlugs = getExtraQuestionReadSlugs(propsIn, slug);
      const context = resolvePileWarmSeedContext(propsIn, slug);
      const networkID = context.networkIdStr || '';
      if (!networkID) return null;

      const scopeSlugs = [slug, ...extraSlugs];
      const seenQuestionIds = new Set();
      const hlSet = new Set();
      const allQuestions = [];
      const allResponses = {};
      scopeSlugs.forEach((scopeSlug) => {
        const questionsCache = readQuestionsCacheRef(scopeSlug) || {};
        const networkCache = questionsCache?.[networkID] || {};
        const blockedQuestionIds = getBlockedQuestionIdsSet(scopeSlug);
        getHighlightedQuestionIdsSet(scopeSlug).forEach((questionId) => {
          hlSet.add(String(questionId || '').toLowerCase());
        });
        mergeQuestionResponses(allResponses, networkCache.questionResponses || {});
        Object.keys(networkCache.questions || {}).forEach((questionId) => {
          const question = networkCache.questions?.[questionId];
          const normalizedQuestionId = normalizeQuestionIdKey(question?.id || questionId);
          if (!normalizedQuestionId || blockedQuestionIds.has(normalizedQuestionId)) return;
          if (seenQuestionIds.has(normalizedQuestionId)) return;
          seenQuestionIds.add(normalizedQuestionId);
          allQuestions.push({
            id: normalizedQuestionId,
            creator: question?.creator || '',
            tags: question?.tags || [],
            ...(question || {}),
            sessionSlug: scopeSlug,
          });
        });
      });

      const responseCounts = {};
      for (const qId in allResponses) {
        responseCounts[qId] = Object.keys(allResponses[qId] || {}).length;
      }
      const byCountDesc = (a, b) => {
        const aCount = responseCounts[a.id?.toLowerCase?.()] || 0;
        const bCount = responseCounts[b.id?.toLowerCase?.()] || 0;
        return bCount - aCount;
      };

      const acctLower = (propsIn.account || '').toLowerCase();
      const isLoggedIn = !!acctLower;
      const highlighted = [];
      const unanswered = [];
      const answered = [];

      for (const q of allQuestions) {
        const idL = q.id?.toLowerCase?.();
        if (!idL) continue;
        if (hlSet.has(idL)) {
          highlighted.push(q);
          continue;
        }
        if (isLoggedIn) {
          const map = allResponses[idL] || {};
          if (map[acctLower]) answered.push(q);
          else unanswered.push(q);
        } else {
          unanswered.push(q);
        }
      }

      highlighted.sort(byCountDesc);
      unanswered.sort(byCountDesc);
      answered.sort(byCountDesc);
      const sorted = isLoggedIn
        ? [...highlighted, ...unanswered, ...answered]
        : [...highlighted, ...unanswered];
      const hiddenGated = sorted.filter(
        (q) => q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted
      );
      const sortedVisible = sorted.filter(
        (q) => !(q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted)
      );
      return {
        pileQuestions: sortedVisible,
        allQuestionsForFilter: sorted,
        hasHiddenGatedQuestions: hiddenGated.length > 0,
        activePileIndex: 0,
        loading: false,
      };
    } catch (_) {
      return null;
    }
  }

  _pileQuestionsGeneration = 0;
  _currentRenderedQuestionIdsCache = null;
  _currentRenderedQuestionIdsCacheKey = '';
  _questionObjectSignatureCache = new WeakMap();
  _questionListSignatureCache = new WeakMap();
  _currentPileQuestionsSignature = '0:0';
  _currentPileQuestionsSignatureListRef = null;
  _responseCountsCacheKey = '';
  _responseCountsCacheValue = null;
  _emptyReadyProbeStartedAtMs = 0;
  _pileScanDisplayBaselineKey = '';
  _pileScanDisplayBaselineRemaining = 0;

  buildQuestionOptionsDigest = (options) => {
    if (!Array.isArray(options) || options.length === 0) return '0:0';
    let hash = 2166136261;
    options.forEach((option) => {
      const normalized = (
        typeof option === 'string'
          ? option
          : (option && typeof option === 'object')
            ? (
              (typeof option.value === 'string' && option.value) ||
              (typeof option.label === 'string' && option.label) ||
              ''
            )
            : String(option ?? '')
      );
      hash = this.mixQuestionListHash(hash, normalized);
    });
    return `${options.length}:${hash >>> 0}`;
  };

  getPileLoadingScanDisplay = (questionScanProgress, scanProgressDisplay) => {
    const baseDisplay = scanProgressDisplay && typeof scanProgressDisplay === 'object'
      ? scanProgressDisplay
      : buildQuestionScanProgressDisplay(questionScanProgress);
    const phase = String(questionScanProgress?.phase || '').toLowerCase();
    if (phase !== 'scan') {
      this._pileScanDisplayBaselineKey = '';
      this._pileScanDisplayBaselineRemaining = 0;
      return baseDisplay;
    }

    const remainingBlocks = Math.max(0, Number(baseDisplay?.remainingBlocks || 0));
    const baselineKey = [
      normalizeQuestionProgressSlug(questionScanProgress?.slug || resolveEffectiveSlug(this.props)),
      String(questionScanProgress?.phase || ''),
      Number(questionScanProgress?.startedAtMs || 0),
      Number(questionScanProgress?.fromBlock || 0),
      Number(questionScanProgress?.requestedTotalBlocks || questionScanProgress?.totalBlocks || 0),
    ].join('|');

    if (
      this._pileScanDisplayBaselineKey !== baselineKey ||
      !Number.isFinite(Number(this._pileScanDisplayBaselineRemaining)) ||
      Number(this._pileScanDisplayBaselineRemaining) <= 0
    ) {
      this._pileScanDisplayBaselineKey = baselineKey;
      this._pileScanDisplayBaselineRemaining = remainingBlocks;
    }

    const baselineRemaining = Math.max(
      remainingBlocks,
      Math.max(0, Number(this._pileScanDisplayBaselineRemaining || 0))
    );
    const scannedThisRefresh = Math.max(0, baselineRemaining - remainingBlocks);
    const percentComplete = baselineRemaining > 0
      ? Math.max(0, Math.min(100, Math.round((scannedThisRefresh / baselineRemaining) * 100)))
      : 0;

    return {
      ...baseDisplay,
      percentComplete,
      metaRightText: `${formatQuestionScanBlockCount(scannedThisRefresh)} / ${formatQuestionScanBlockCount(baselineRemaining)}`,
    };
  };

  getQuestionObjectSignature = (question) => {
    if (!question || typeof question !== 'object') return String(question ?? '');
    try {
      const cached = this._questionObjectSignatureCache.get(question);
      if (cached) return cached;
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    const sig = [
      String(question.id || '').trim().toLowerCase(),
      String(question.type || '').trim().toLowerCase(),
      String(question.prompt || ''),
      question.promptDecrypted ? '1' : '0',
      String(question.arweaveTxId || ''),
      this.buildQuestionOptionsDigest(Array.isArray(question.options) ? question.options : []),
    ].join('|');
    try {
      this._questionObjectSignatureCache.set(question, sig);
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    return sig;
  };

  mixQuestionListHash = (seed, text) => {
    let h = Number(seed) >>> 0;
    const str = String(text || '');
    for (let i = 0; i < str.length; i += 1) {
      h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
    }
    return h >>> 0;
  };

  buildQuestionListSignature = (list = []) => {
    if (!Array.isArray(list) || list.length === 0) return '0:0';
    try {
      const cached = this._questionListSignatureCache.get(list);
      if (cached) return cached;
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    let hash = 2166136261;
    list.forEach((question) => {
      hash = this.mixQuestionListHash(hash, this.getQuestionObjectSignature(question));
    });
    const signature = `${list.length}:${hash >>> 0}`;
    try {
      this._questionListSignatureCache.set(list, signature);
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    return signature;
  };

  getPileVisibleQuestionIds = (listIn = [], activeIndexIn = 0) => {
    const list = Array.isArray(listIn) ? listIn : [];
    if (list.length === 0) return [];
    const activeIndex = Math.max(0, Number(activeIndexIn || 0));
    const startIdx = Math.max(0, activeIndex - 2);
    const endIdx = Math.min(list.length, activeIndex + 3);
    const ids = [];
    for (let idx = startIdx; idx < endIdx; idx += 1) {
      const qid = normalizeQuestionIdKey(list[idx]?.id);
      if (!qid) continue;
      ids.push(qid);
    }
    return Array.from(new Set(ids));
  };

  buildPileVisibleResponseSignature = (
    questionResponses = {},
    visibleIds = [],
    accountIn = this.props?.account
  ) => {
    const responderLower = String(accountIn || '').trim().toLowerCase();
    const ids = Array.isArray(visibleIds)
      ? visibleIds.map((id) => normalizeQuestionIdKey(id)).filter(Boolean)
      : [];
    if (!responderLower || ids.length === 0) {
      return `${responderLower ? 'acct' : 'anon'}:${ids.length}:0`;
    }
    const responsesMap = (questionResponses && typeof questionResponses === 'object')
      ? questionResponses
      : {};
    let hash = 2166136261;
    let filled = 0;
    ids.forEach((qid) => {
      hash = this.mixQuestionListHash(hash, `q:${qid}`);
      const byResponder = responsesMap[qid];
      const rawResponse = (byResponder && typeof byResponder === 'object')
        ? byResponder[responderLower]
        : undefined;
      if (rawResponse === undefined) {
        hash = this.mixQuestionListHash(hash, 'r:__none__');
        return;
      }
      filled += 1;
      if (typeof rawResponse === 'string') {
        hash = this.mixQuestionListHash(hash, `s:${rawResponse.length}:${rawResponse}`);
        return;
      }
      hash = this.mixQuestionListHash(hash, `o:${buildSliceToken(rawResponse)}`);
    });
    return `${ids.length}:${filled}:${hash >>> 0}`;
  };

  syncCurrentPileQuestionsSignature = (listIn = this.state?.pileQuestions) => {
    const list = Array.isArray(listIn) ? listIn : [];
    if (
      this._currentPileQuestionsSignatureListRef === list &&
      typeof this._currentPileQuestionsSignature === 'string' &&
      this._currentPileQuestionsSignature
    ) {
      return this._currentPileQuestionsSignature;
    }
    const signature = this.buildQuestionListSignature(list);
    this._currentPileQuestionsSignatureListRef = list;
    this._currentPileQuestionsSignature = signature;
    return signature;
  };

  areQuestionListsEquivalent = (left = [], right = []) => {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i += 1) {
      const leftId = String(left[i]?.id || '').trim().toLowerCase();
      const rightId = String(right[i]?.id || '').trim().toLowerCase();
      if (leftId !== rightId) return false;
      const leftSig = this.getQuestionObjectSignature(left[i]);
      const rightSig = this.getQuestionObjectSignature(right[i]);
      if (leftSig !== rightSig) return false;
    }
    return true;
  };

  getCurrentRenderedQuestionIds = () => {
    const pileQuestions = Array.isArray(this.state?.pileQuestions) ? this.state.pileQuestions : [];
    const activePileIndex = Number(this.state?.activePileIndex || 0);
    const key = `${activePileIndex}|${pileQuestions.length}|${Number(this._pileQuestionsGeneration || 0)}`;

    if (this._currentRenderedQuestionIdsCache && this._currentRenderedQuestionIdsCacheKey === key) {
      return this._currentRenderedQuestionIdsCache;
    }

    const startIdx = Math.max(0, activePileIndex - 2);
    const endIdx = Math.min(pileQuestions.length, activePileIndex + 3);

    const ids = [];
    for (let idx = startIdx; idx < endIdx; idx += 1) {
      const id = pileQuestions[idx]?.id;
      if (id) ids.push(id);
    }

    this._currentRenderedQuestionIdsCache = ids;
    this._currentRenderedQuestionIdsCacheKey = key;
    return ids;
  };

  isRecentRateLimit = () => {
    try {
      const info = (typeof window !== 'undefined') ? window.__LAST_RPC_RATE_LIMIT_ERROR__ : null;
      if (!info || !info.ts) return false;
      return (Date.now() - info.ts) < 2 * 60 * 1000;
    } catch (_) {
      return false;
    }
  };

  isPileLoadingVisible = () => {
    const slug = resolveEffectiveSlug(this.props);
    const progressSlug = normalizeQuestionProgressSlug(slug);
    const questionScanProgress =
      this.props.questionScanProgress &&
      doesQuestionProgressMatchSlug(this.props.questionScanProgress.slug, progressSlug)
        ? this.props.questionScanProgress
        : null;
    const scanRemainingBlocks = Math.max(0, Number(questionScanProgress?.remainingBlocks || 0));
    const hydrateDiscovered = Math.max(0, Number(questionScanProgress?.discoveredQuestions || 0));
    const hydrateDone = Math.max(0, Number(questionScanProgress?.hydratedQuestions || 0));
    const pendingMetadataCount = Math.max(0, Number(questionScanProgress?.pendingMetadataCount || 0));
    const hasPendingMetadataRetries = pendingMetadataCount > 0;
    const hasScanOrHydrationWork = !!questionScanProgress && (
      (questionScanProgress?.phase === 'scan' && scanRemainingBlocks > 0) ||
      (questionScanProgress?.phase === 'hydrate' && (
        hydrateDone < hydrateDiscovered ||
        hasPendingMetadataRetries
      ))
    );
    const hydrationProgressSettled = !!questionScanProgress && (
      questionScanProgress?.phase === 'hydrate' &&
      hydrateDone >= hydrateDiscovered
    );
    const hasTerminalScanError = !!questionScanProgress && questionScanProgress?.phase === 'error';
    const firstBoot = !hasCacheHydratedFlag(this.props);
    const hasVisibleQuestions = Array.isArray(this.state?.pileQuestions) && this.state.pileQuestions.length > 0;
    const isFilterActive = (
      !!this.state?.isFilterActive ||
      isSurveyToolFilterStateActive(this.state?.filterState)
    );
    const hasFilterBaseQuestions = Array.isArray(this.state?.allQuestionsForFilter) &&
      this.state.allQuestionsForFilter.length > 0;
    const recentRateLimit = this.isRecentRateLimit();
    const preferGatedEmptyState = this.shouldPreferGatedEmptyState({
      hasConcreteHiddenQuestions: !!this.state.hasHiddenGatedQuestions,
      hasVisibleQuestions,
      firstBoot,
      recentRateLimit,
      hasPendingMetadataRetries,
    });
    const allowUnreadyEmptySettlement = (
      !hasVisibleQuestions &&
      !firstBoot &&
      this.props.cacheHasLoaded !== false &&
      !this.props.isQuestionCacheReady &&
      !recentRateLimit &&
      !hasScanOrHydrationWork &&
      !hasPendingMetadataRetries &&
      hydrationProgressSettled
    ) || preferGatedEmptyState;
    const allowFilteredEmptySettlement = (
      !hasVisibleQuestions &&
      isFilterActive &&
      hasFilterBaseQuestions &&
      !this.state?.hasHiddenGatedQuestions
    );
    return shouldShowPileFullLoadingState({
      loading: !!this.state.loading,
      hasVisibleQuestions,
      firstBoot,
      isQuestionCacheReady: !!this.props.isQuestionCacheReady,
      recentRateLimit,
      hasScanOrHydrationWork,
      allowUnreadyEmptySettlement,
      allowFilteredEmptySettlement,
      hasTerminalScanError,
    });
  };

  shouldPreferGatedEmptyState = ({
    hasConcreteHiddenQuestions = false,
    hasVisibleQuestions = false,
    firstBoot = false,
    recentRateLimit = false,
    hasPendingMetadataRetries = false,
  } = {}) => {
    if (!hasConcreteHiddenQuestions) return false;
    if (hasVisibleQuestions) return false;
    if (firstBoot) return false;
    if (this.props.cacheHasLoaded === false) return false;
    if (recentRateLimit) return false;
    if (hasPendingMetadataRetries) return false;
    return true;
  };

  syncLoadingElapsedTimer = () => {
    const shouldRun = this.isPileLoadingVisible();
    if (shouldRun) {
      if (!this._loadingStartedAtMs) this._loadingStartedAtMs = Date.now();
      if (!this._loadingElapsedTimer) {
        this._loadingElapsedTimer = setInterval(() => {
          const started = Number(this._loadingStartedAtMs || Date.now());
          const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
          if (elapsed !== Number(this.state.loadingElapsedSec || 0)) {
            this.setState({ loadingElapsedSec: elapsed });
          }
        }, 1000);
      }
      return;
    }

    if (this._loadingElapsedTimer) {
      clearInterval(this._loadingElapsedTimer);
      this._loadingElapsedTimer = null;
    }
    this._loadingStartedAtMs = null;
    if (this.state.loadingElapsedSec !== 0) {
      this.setState({ loadingElapsedSec: 0 });
    }
  };

  scheduleLoadAndSortQuestions = (delayMs = 80) => {
    if (this._loadAndSortDebounceTimer) {
      clearTimeout(this._loadAndSortDebounceTimer);
      this._loadAndSortDebounceTimer = null;
    }
    this._loadAndSortDebounceTimer = setTimeout(() => {
      this._loadAndSortDebounceTimer = null;
      this.loadAndSortQuestions();
    }, Math.max(0, Number(delayMs) || 0));
  };

  componentDidMount() {
    this._isMounted = true;
    this.syncCurrentPileQuestionsSignature(this.state.pileQuestions);
    this.loadAndSortQuestions();
    this.syncLoadingElapsedTimer();
    // Start long-loading timer
    this.loadingTimeout = setTimeout(() => {
      if (this.state.loading || !this.props.isQuestionCacheReady) {
        this.setState({ showLongLoading: true });
      }
    }, 10000);
  }


  componentDidUpdate(prevProps, prevState) {
    const diffInputsChanged = this.didEditDiffInputsChange(prevProps, prevState);
    if (diffInputsChanged) {
      this.invalidateDiffCaches();
    }
    if (prevState.userAnswers !== this.state.userAnswers) {
      this._userAnswersSliceCache = { source: null, value: null };
    }

    const pendingStats = diffInputsChanged
      ? ((typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) || this.getPendingStatsSnapshot())
      : this.getPendingStatsSnapshot();
    this.emitPendingStats(pendingStats);
    if (diffInputsChanged) {
      this.recalculateEditStats && this.recalculateEditStats(pendingStats);
    }
    if (prevState.pileQuestions !== this.state.pileQuestions) {
      this.syncCurrentPileQuestionsSignature(this.state.pileQuestions);
    }

    // Rebuild guard: never rebuild lists/slices while user has pending edits
    const hasLiveEdits = Number(pendingStats.total || 0) > 0 || this.state.isDirty || (this.state.modifiedCount || 0) > 0;
    const isOptimistic = this.state.submissionComplete;

    // 1. Handle Account/Network changes (Reset context)
    const networkChanged = prevProps.network?.id !== this.props.network?.id;
    const accountChanged = (prevProps.account || '').toLowerCase() !== (this.props.account || '').toLowerCase();

    if (networkChanged || accountChanged) {
      // Persist draft before reset so it survives the login transition
      try { this.persistDraft(); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      this._lastLoadAndSortResultSignature = '';
      this._lastInitializeResponseSig = '';
      this._emptyReadyProbeStartedAtMs = 0;

      // If context changes, we must reset optimistic flags and reload immediately
      // We do this regardless of edits because the context (wallet/chain) invalidates the current session
      this.setState(
        {
          loading: true,
          pileQuestions: [],
          activePileIndex: 0,
          submissionComplete: false, // Reset on context change
          submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
          editBaseline: null,
          // Clear response state to prevent stale data leaks across accounts
          surveysResponseState: [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }]
        },
        () => {
            if (this._loadAndSortDebounceTimer) {
              clearTimeout(this._loadAndSortDebounceTimer);
              this._loadAndSortDebounceTimer = null;
            }
            this.loadAndSortQuestions();
        }
      );

      // Always reset auto-decrypt on context change
      this._autoDecQueue = [];
      this._autoDecProcessing = false;
      this._autoDecryptMaskedAttemptSignature = {};
      this.clearAutoDecryptSweepScheduling();
      if (this.state.autoDecryptEnabled) {
        this.setState({ autoDecryptEnabled: false, decryptingByKey: {} });
      }
      this.syncLoadingElapsedTimer();
      return;
    }

    // 2. Handle Cache Updates
    const cacheReadyTick =
      (prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady && this.props.isQuestionCacheReady) ||
      (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady && this.props.isResponsesCacheReady);
    const cacheJustBecameReady = !prevProps.isResponsesCacheReady && this.props.isResponsesCacheReady;

    const nonceTick = prevProps.questionsCacheNonce !== this.props.questionsCacheNonce;
    const responseNonceTick =
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;
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

    if (cacheReadyTick || nonceTick || responseNonceTick || progressHydrationTick || progressCompletedTick) {
      if (isOptimistic) {
        // Optimistic guard: do not reload/wipe state yet. Check if cache has caught up.
        this.checkCacheAgainstBaseline();
      } else {
        // Normal mode: Reload if safe (no pending edits)
        if (!hasLiveEdits) {
          this.scheduleLoadAndSortQuestions(80);
        } else {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('PileViewMode: skipped rebuild due to pending edits');
        }
      }
    } else if (this.state.pileQuestions.length === 0 && !hasLiveEdits && !this.props.isQuestionCacheReady && !this.state.loading) {
      // Initial load spinner (guarded against loop)
      this.setState({ loading: true });
    }

    // Clear long-loading if loaded
    if (!this.state.loading && this.props.isQuestionCacheReady && this.state.showLongLoading) {
      this.setState({ showLongLoading: false });
    }

    // 3. Auto-Decrypt Logic
    if (
      (prevProps.provider !== this.props.provider || prevProps.account !== this.props.account) &&
      this.isAutoDecryptBlocked()
    ) {
      this._autoDecQueue = [];
      this._autoDecProcessing = false;
      this._autoDecryptMaskedAttemptSignature = {};
      this.clearAutoDecryptSweepScheduling();
      if (this.state.autoDecryptEnabled || (this.state.decryptingByKey && Object.keys(this.state.decryptingByKey).length > 0)) {
        this.setState({ autoDecryptEnabled: false, decryptingByKey: {} });
      }
    }

    if (
      this.state.autoDecryptEnabled &&
      (
        nonceTick ||
        responseNonceTick ||
        prevState.pileQuestions !== this.state.pileQuestions ||
        prevState.surveysResponseState !== this.state.surveysResponseState ||
        cacheJustBecameReady
      ) &&
      !this.isAutoDecryptBlocked()
    ) {
      this.queueAutoDecryptVisibleSweep('pile-state-change');
    }

    if (!prevState.autoDecryptEnabled && this.state.autoDecryptEnabled && !this.isAutoDecryptBlocked()) {
      this.queueAutoDecryptVisibleSweep('pile-enabled');
    }

    if (this.state.autoDecryptEnabled && prevState.showComments !== this.state.showComments && !this.isAutoDecryptBlocked()) {
      this.queueAutoDecryptVisibleSweep('pile-comments-toggle');
    }

    this.syncLoadingElapsedTimer();
  }


  componentWillUnmount() {
    if (this._pileSubmitTimer) {
      clearTimeout(this._pileSubmitTimer);
      this._pileSubmitTimer = null;
    }
    if (this._navFadeTimer) {
      clearTimeout(this._navFadeTimer);
      this._navFadeTimer = null;
    }
    if (this.loadingTimeout) {
      clearTimeout(this.loadingTimeout);
    }
    if (this._loadingElapsedTimer) {
      clearInterval(this._loadingElapsedTimer);
      this._loadingElapsedTimer = null;
    }
    if (this._loadAndSortDebounceTimer) {
      clearTimeout(this._loadAndSortDebounceTimer);
      this._loadAndSortDebounceTimer = null;
    }
    this._lastLoadAndSortResultSignature = '';
    this._lastInitializeResponseSig = '';
    this._emptyReadyProbeStartedAtMs = 0;
    this._currentPileQuestionsSignature = '0:0';
    this._currentPileQuestionsSignatureListRef = null;
    this._questionListSignatureCache = new WeakMap();
    super.componentWillUnmount();
  }

  // Wrapper helpers so we don't shadow parent methods
  handleAnswerPile = (questionId, answer, options = {}) => {
    this.handleAnswer(0, questionId, answer, options);
  };

  handleAdditionalPile = (questionId, comments) => {
    this.handleAdditional(0, questionId, comments);
  };

  handleViewAllFromPile = () => {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    try { this.persistDraft(); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    if (typeof this.props.onViewAllClick === 'function') {
      this.props.onViewAllClick();
    }
  };


  triggerNavFade = () => {
    // Clear any existing timer so we always get a fresh 2s window
    if (this._navFadeTimer) {
      clearTimeout(this._navFadeTimer);
      this._navFadeTimer = null;
    }

    // Show the counter immediately
    this.setState({ navCounterVisible: true });

    // Schedule fade-out after 2 seconds
    this._navFadeTimer = setTimeout(() => {
      this.setState({ navCounterVisible: false });
      this._navFadeTimer = null;
    }, 2000);
  };


  handleNext = () => {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
      this.persistDraft();
    }
    this.setState((prev) => ({
      activePileIndex: Math.min(
        prev.activePileIndex + 1,
        prev.pileQuestions.length - 1
      ),
    }), () => {
      this.ensureVisiblePileResponseState();
    });
    this.triggerNavFade();
  };


  handlePrev = () => {
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
      this.persistDraft();
    }
    this.setState((prev) => ({
      activePileIndex: Math.max(prev.activePileIndex - 1, 0),
    }), () => {
      this.ensureVisiblePileResponseState();
    });
    this.triggerNavFade();
  };


  toggleCreate = () => {
    this.setState((prev) => ({ showCreate: !prev.showCreate }), () => {
      // Auto-scroll to the create section if it was just opened
      if (this.state.showCreate && this.createSectionRef.current) {
        try {
          this.createSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }
    });
  }

  toggleComments = (questionId) =>
    this.setState((prev) => ({
      showComments: {
        ...prev.showComments,
        [questionId]: !prev.showComments[questionId],
      },
    }));

  toggleHologramAssistant = () =>
    this.setState((prev) => ({
      showHologramAssistant: !prev.showHologramAssistant,
    }));

  toggleConviction = (questionId) =>
    this.setState((prev) => ({
      showConviction: {
        ...prev.showConviction,
        [questionId]: !prev.showConviction[questionId],
      },
    }));

  openConvictionSlider = (questionId, mode) => {
    const nextMode = (mode === 'importance' || mode === 'conviction')
      ? mode
      : this.getSliderMode(questionId);
    this.setSliderMode(questionId, nextMode);
    this.setState((prev) => ({
      showConviction: {
        ...prev.showConviction,
        [questionId]: true,
      },
    }));
  };

  // Keep this tiny wrapper only if other code calls it
  getSubmitCount = () => (this.getPendingEditStats?.() || { total: 0 }).total | 0;

  // Keep semantics aligned with baseline-aware changed-set
  getAnsweredQuestionsCount = () => this.getSubmitCount();


  checkCacheAgainstBaseline = () => {
    if (!this.state.submissionComplete || !this.state.editBaseline) return;

    const slug = resolveEffectiveSlug(this.props);
    const pileResponseReadContext = resolvePileResponseReadContext(this.props, slug);
    const effectiveSlug = pileResponseReadContext.sessionSlug || slug;
    const networkID = pileResponseReadContext.networkIdStr;
    const acctLower = (this.props.account || '').toLowerCase();
    const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(this.props, effectiveSlug)];

    if (!networkID) return;

    const qRespMap = {};
    scopeSlugs.forEach((scopeSlug) => {
      const parsed = readQuestionsCache(scopeSlug) || {};
      const net = parsed?.[networkID];
      mergeQuestionResponses(qRespMap, net?.questionResponses || {});
    });

    const baseline = this.state.editBaseline;
    const renderedIds = this.state.pileQuestions.map(q => q.id);
    let isConsistent = true;

    for (const qid of renderedIds) {
      const qidLower = (qid || '').toLowerCase();
      const raw = qRespMap[qidLower]?.[acctLower];

      // Parse cache entry
      let cacheEntry = null;
      try { cacheEntry = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { cacheEntry = null; }

      const baseAns = baseline.answers?.[qid];
      const baseAdd = baseline.additionalComments?.[qid];
      const baselineAnswerEncrypted =
        !!(baseAns && (baseAns.encrypted || baseAns.encryptedPortion || baseAns.value === '*'));
      const baselineAdditionalEncrypted =
        !!(baseAdd && (baseAdd.encrypted || baseAdd.encryptedPortion || baseAdd.value === '*'));
      const baselineResponseEncrypted = baselineAnswerEncrypted || baselineAdditionalEncrypted;

      const cacheRatingEncrypted = !!(
        cacheEntry && (
          (typeof cacheEntry.importanceEncrypted === 'string' && cacheEntry.importanceEncrypted) ||
          (typeof cacheEntry.convictionEncrypted === 'string' && cacheEntry.convictionEncrypted)
        )
      );

      // 1. Check Answer Consistency
      if (baseAns && baseAns.value !== undefined) {
         // If baseline has value, cache MUST have value (equality check)
         const cacheVal = cacheEntry?.answer?.value;
         // Use parent's valuesEqual for robust comparison (arrays, numbers)
         if (!this.valuesEqual(baseAns.value, cacheVal)) {
           isConsistent = false;
           break;
         }
      }

      // 2. Check Additional Consistency
      if (baseAdd && baseAdd.value !== undefined) {
         const cacheAdd = cacheEntry?.additional?.value;
         if (!this.valuesEqual(baseAdd.value, cacheAdd)) {
           isConsistent = false;
           break;
         }
      }

      // 3. Check Conviction Consistency
      if (baseline.conviction && Object.prototype.hasOwnProperty.call(baseline.conviction, qid)) {
        const baseConv = toNumberOrNull(baseline.conviction[qid]);
        const cacheConvRaw =
          cacheEntry?.conviction !== undefined && cacheEntry?.conviction !== null
            ? cacheEntry.conviction
            : cacheEntry?.importance;
        const cacheConv = toNumberOrNull(cacheConvRaw);
        if (cacheConv === null) {
          if (!baselineResponseEncrypted && !cacheRatingEncrypted) {
            isConsistent = false;
            break;
          }
        } else if (baseConv !== cacheConv) {
          isConsistent = false;
          break;
        }
      }

      // 4. Check Importance Consistency
      if (baseline.importance && Object.prototype.hasOwnProperty.call(baseline.importance, qid)) {
        const baseImp = toNumberOrNull(baseline.importance[qid]);
        const cacheImpRaw =
          cacheEntry?.importance !== undefined && cacheEntry?.importance !== null
            ? cacheEntry.importance
            : cacheEntry?.conviction;
        const cacheImp = toNumberOrNull(cacheImpRaw);
        if (cacheImp === null) {
          if (!baselineResponseEncrypted && !cacheRatingEncrypted) {
            isConsistent = false;
            break;
          }
        } else if (baseImp !== cacheImp) {
          isConsistent = false;
          break;
        }
      }
    }

    if (isConsistent) {
      surveyLog.log("PileViewMode: Cache caught up with baseline. Syncing.");
      this.setState({ submissionComplete: false }, () => {
        // Now it is safe to reload and wipe/rebuild state, as cache matches our optimistic view
        this.loadAndSortQuestions();
      });
    } else {
      surveyLog.log("PileViewMode: Ignoring stale cache. Maintaining optimistic state.");
    }
  };

  prefillUserAnswersFromCache = () => {
    // Strict baseline policy:
    // - Never baseline from local cache when anon
    // - Never touch baseline while there are pending edits
    if (!this.props.account) return;
    if (this.state.isDirty || (this.state.modifiedCount || 0) > 0) {
      bumpSurveyPerfCounter('noopSkipCount');
      surveyLog.debug('baseline-guard: skipped rebuild');
      return;
    }

    const slug = resolveEffectiveSlug(this.props);
    const pileResponseReadContext = resolvePileResponseReadContext(this.props, slug);
    const effectiveSlug = pileResponseReadContext.sessionSlug || slug;
    const networkID = pileResponseReadContext.networkIdStr;
    const acctLower = (this.props.account || '').toLowerCase();
    const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(this.props, effectiveSlug)];

    if (!networkID || !Array.isArray(this.state.pileQuestions) || this.state.pileQuestions.length === 0) {
      return;
    }

    const qRespMap = {};
    scopeSlugs.forEach((scopeSlug) => {
      const parsed = readQuestionsCache(scopeSlug) || {};
      const net = parsed?.[networkID];
      mergeQuestionResponses(qRespMap, net?.questionResponses || {});
    });

    const currentSlice = this.state.surveysResponseState?.[0] || {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const nextSlice = {
      answers: { ...(currentSlice.answers || {}) },
      importance: { ...(currentSlice.importance || {}) },
      conviction: { ...(currentSlice.conviction || {}) },
      additionalComments: { ...(currentSlice.additionalComments || {}) },
    };

    const toArray = (v) => (Array.isArray(v) ? v : (typeof v === 'string' && v ? [v] : []));
    const toNumber = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const toBinaryCanonical = (v) => {
      if (typeof v !== 'string') return v;
      const low = v.toLowerCase();
      if (low === 'agree') return 'Agree';
      if (low === 'unsure') return 'Unsure';
      if (low === 'disagree') return 'Disagree';
      return v;
    };

    let changed = false;

    this.state.pileQuestions.forEach((q) => {
      const qid = q?.id;
      const qidLower = (qid || '').toLowerCase();
      if (!qid) return;

      const raw = qRespMap[qidLower]?.[acctLower];
      if (!raw) return;

      let respObj = null;
      try { respObj = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { respObj = null; }
      if (!respObj) return;

      // Prefill answer
      if (respObj.answer) {
        let val = this.parseAnswerValue(respObj.answer.value);
        if (!respObj.answer.encrypted) {
          if (q.type === 'multichoice') val = toArray(val);
          if (q.type === 'rating') val = toNumber(val);
          if (q.type === 'binary') val = toBinaryCanonical(val);
        }

        nextSlice.answers[qid] = {
          ...(nextSlice.answers[qid] || {}),
          value: val,
          encrypted: !!respObj.answer.encrypted,
          encryptionAudience: this.resolveFieldEncryptionAudience(nextSlice.answers[qid] || {}, qid, 'answer'),
          encryptionGateId: respObj.answer.encrypted
            ? this.resolveFieldEncryptionGateId(respObj.answer || {}, qid, 'answer')
            : null,
          audienceMode: 'explicit',
          hash: respObj.answer.hash || '',
          encryptedPortion: respObj.answer.encryptedPortion || '',
        };
        changed = true;
      }

      // Prefill conviction/importance
      const convictionValue = getConvictionFromResponse(respObj);
      if (convictionValue !== null) {
        nextSlice.conviction[qid] = convictionValue;
        changed = true;
      }
      const importanceValue = getImportanceFromResponse(respObj);
      if (importanceValue !== null) {
        nextSlice.importance[qid] = importanceValue;
        changed = true;
      }

      // Prefill additional comments
      if (respObj.additional) {
        const addVal = this.parseAnswerValue(respObj.additional.value);
        let nextAdditional = {
          ...(nextSlice.additionalComments[qid] || {}),
          value: addVal,
          encrypted: !!respObj.additional.encrypted,
          encryptionAudience: this.resolveFieldEncryptionAudience(nextSlice.additionalComments[qid] || {}, qid, 'additional'),
          encryptionGateId: respObj.additional.encrypted
            ? this.resolveFieldEncryptionGateId(respObj.additional || {}, qid, 'additional')
            : null,
          audienceMode: this.normalizeFieldAudienceMode(
            respObj.additional?.audienceMode,
            'additional',
            respObj.additional || {}
          ),
          hash: respObj.additional.hash || '',
          encryptedPortion: respObj.additional.encryptedPortion || '',
        };
        if (
          this.normalizeFieldAudienceMode(
            respObj.additional?.audienceMode,
            'additional',
            respObj.additional || {}
          ) === 'inherit'
        ) {
          nextAdditional = this.buildInheritedAdditionalFieldState(nextAdditional, nextSlice.answers[qid] || {}, qid);
        }
        nextSlice.additionalComments[qid] = nextAdditional;
        changed = true;
      }
    });

    const setBaselineFrom = (slice) => {
      this.setState(
        {
          surveysResponseState: [slice],
          baselineResponses: this.deepClone(slice),
          editBaseline: this.deepClone(slice),
          modifiedCount: 0,
          isDirty: false,
        },
        () => this.updateJsonPreview()
      );
    };

    // Do not clobber an existing edit baseline if the user already started editing.
    const hadAnyBaseInput = (() => {
      const hasVal = (v) => v !== undefined && v !== null && (Array.isArray(v) ? v.length > 0 : String(v).length > 0);
      for (const qid in (currentSlice.answers || {})) { if (hasVal(currentSlice.answers[qid]?.value)) return true; }
      for (const qid in (currentSlice.additionalComments || {})) { if (hasVal(currentSlice.additionalComments[qid]?.value)) return true; }
      for (const qid in (currentSlice.importance || {})) { if (Object.prototype.hasOwnProperty.call(currentSlice.importance, qid)) return true; }
      for (const qid in (currentSlice.conviction || {})) { if (Object.prototype.hasOwnProperty.call(currentSlice.conviction, qid)) return true; }
      return false;
    })();
    const pendingStats = (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) || { total: this.state.modifiedCount || 0 };

    if (this.state.editBaseline || hadAnyBaseInput || (pendingStats.total > 0)) {
      this.setState({ surveysResponseState: [nextSlice] }, () => this.updateJsonPreview());
    } else {
      setBaselineFrom(nextSlice);
    }
  };


  loadAndSortQuestions = async () => {
    bumpSurveyPerfCounter('loadAndSortQuestionsCount');
    const requestEpoch = (Number(this._loadAndSortQuestionsEpoch || 0) + 1);
    this._loadAndSortQuestionsEpoch = requestEpoch;
    const slug = resolveEffectiveSlug(this.props);
    const extraSlugs = getExtraQuestionReadSlugs(this.props, slug);
    const scopeSlugs = [slug, ...extraSlugs];
    const scopeSignature = scopeSlugs.map((value) => normalizeSessionSlugValue(value)).join(',');
    const pileLoadContext = resolvePileLoadContext(this.props, slug);
    const networkID = pileLoadContext.networkIdStr || '';
    const progressSlug = normalizeQuestionProgressSlug(slug);
    const scopedProgress =
      this.props.questionScanProgress &&
      doesQuestionProgressMatchSlug(this.props.questionScanProgress.slug, progressSlug)
        ? this.props.questionScanProgress
        : null;
    const scopedScanTotalBlocks = Math.max(0, Number(scopedProgress?.totalBlocks || 0));
    const scopedScanRemainingBlocks = Math.max(0, Number(scopedProgress?.remainingBlocks || 0));
    const scopedHydrateDiscovered = Math.max(0, Number(scopedProgress?.discoveredQuestions || 0));
    const scopedHydrateDone = Math.max(0, Number(scopedProgress?.hydratedQuestions || 0));
    const hasScanOrHydrationWork = !!scopedProgress && (
      (scopedProgress?.phase === 'scan' && scopedScanRemainingBlocks > 0) ||
      (scopedProgress?.phase === 'hydrate' && scopedHydrateDone < scopedHydrateDiscovered)
    );

    // Recent rate-limit detector (wired to withRetry)
    const recentRateLimit = (() => {
      try {
        const info = (typeof window !== 'undefined') ? window.__LAST_RPC_RATE_LIMIT_ERROR__ : null;
        if (!info || !info.ts) return false;
        const ageMs = Date.now() - info.ts;
        // Treat the last 2 minutes as "warming/retrying" for UI purposes.
        return ageMs < 2 * 60 * 1000;
      } catch (_) {
        return false;
      }
    })();
    const hydrationProgressSettled = !!scopedProgress && (
      scopedProgress?.phase === 'hydrate' &&
      scopedHydrateDone >= scopedHydrateDiscovered
    );
    const canSettleUnreadyEmpty = (
      this.props.cacheHasLoaded !== false &&
      !this.props.isQuestionCacheReady &&
      !recentRateLimit &&
      !hasScanOrHydrationWork &&
      hydrationProgressSettled
    );

    // If no network ID, we can't load specific data, but we shouldn't hang if we can't determine it yet.
    if (!networkID) {
      // Optimistic Loading: If we have no ID, we are likely still initializing.
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      this._lastLoadAndSortResultSignature = '';
      const nextLoading = !this.props.isQuestionCacheReady || recentRateLimit;
      if (this.state.loading === nextLoading) {
        bumpSurveyPerfCounter('noopSkipCount');
        return;
      }
      this.setState({ loading: nextLoading });
      return;
    }

    try {
      const allResponses = {};
      const allQuestions = [];
      const seenQuestionIds = new Set();
      const hlSet = new Set();
      let pendingMetadataCount = 0;
      for (const scopeSlug of scopeSlugs) {
        const questionsCache = ensureQuestionsNet(await readQuestionsCacheAsync(scopeSlug), networkID);
        const networkCache = questionsCache[networkID] || { questions: {}, questionResponses: {} };
        pendingMetadataCount += Object.keys(networkCache?.pendingQuestionMetadata || {}).length;
        getHighlightedQuestionIdsSet(scopeSlug).forEach((questionId) => {
          hlSet.add(String(questionId || '').toLowerCase());
        });
        mergeQuestionResponses(allResponses, networkCache.questionResponses || {});
        const blockedQuestionIds = getBlockedQuestionIdsSet(scopeSlug);
        Object.keys(networkCache.questions || {}).forEach((questionId) => {
          const question = networkCache.questions?.[questionId];
          const normalizedQuestionId = normalizeQuestionIdKey(question?.id || questionId);
          if (!normalizedQuestionId || blockedQuestionIds.has(normalizedQuestionId)) return;
          if (seenQuestionIds.has(normalizedQuestionId)) return;
          seenQuestionIds.add(normalizedQuestionId);
          allQuestions.push({
            id: normalizedQuestionId,
            creator: question?.creator || '',
            tags: question?.tags || [],
            ...(question || {}),
            sessionSlug: scopeSlug,
          });
        });
      }
      // Read path only: avoid write-on-read feedback loops via questionsCacheNonce.
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      const hasPendingMetadataRetries = pendingMetadataCount > 0;
      const responseCountsCacheKey = `${scopeSignature}|${networkID}|${Number(this.props.questionResponsesNonce || 0)}`;
      let responseCounts = {};
      if (
        this._responseCountsCacheKey === responseCountsCacheKey &&
        this._responseCountsCacheValue &&
        typeof this._responseCountsCacheValue === 'object'
      ) {
        responseCounts = this._responseCountsCacheValue;
      } else {
        const nextResponseCounts = {};
        for (const qId in allResponses) {
          nextResponseCounts[qId] = Object.keys(allResponses[qId]).length;
        }
        responseCounts = nextResponseCounts;
        this._responseCountsCacheKey = responseCountsCacheKey;
        this._responseCountsCacheValue = nextResponseCounts;
      }

      // No defaultTags gating: sessions handle scoping; tags are for organization and user filtering.

      if (allQuestions.length > 0) {
        this._emptyReadyProbeStartedAtMs = 0;
      }

      // Empty-settlement probe: on early refresh, cache can report ready before
      // question metadata lands. Keep loading and periodically re-check before
      // showing a definitive empty state.
      if (allQuestions.length === 0) {
        const coldBootInProgress = this.props.cacheHasLoaded === false;
        const progressIndicatesDefinitiveEmpty = !hasPendingMetadataRetries && !!scopedProgress && (
          (
            scopedProgress?.phase === 'scan' &&
            scopedScanTotalBlocks === 0 &&
            scopedScanRemainingBlocks === 0 &&
            scopedHydrateDiscovered === 0 &&
            scopedHydrateDone === 0
          ) ||
          (
            scopedProgress?.phase !== 'scan' &&
            scopedProgress?.phase !== 'hydrate' &&
            scopedScanRemainingBlocks === 0 &&
            scopedHydrateDiscovered === 0
          ) ||
          hydrationProgressSettled
        );
        const shouldKeepLoadingImmediately =
          coldBootInProgress ||
          recentRateLimit ||
          hasPendingMetadataRetries ||
          hasScanOrHydrationWork ||
          (!this.props.isQuestionCacheReady && !canSettleUnreadyEmpty);

        if (shouldKeepLoadingImmediately) {
          this._emptyReadyProbeStartedAtMs = 0;
          if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
          this._lastLoadAndSortResultSignature = '';
          this.setState((prev) => {
            const samePile = this.areQuestionListsEquivalent(prev.pileQuestions, []);
            const sameAll = this.areQuestionListsEquivalent(prev.allQuestionsForFilter, []);
            const sameLoading = prev.loading === true;
            if (samePile && sameAll && sameLoading) {
              bumpSurveyPerfCounter('noopSkipCount');
              return null;
            }
            this._pileQuestionsGeneration += 1;
            return { pileQuestions: [], allQuestionsForFilter: [], loading: true };
          });
          return;
        }

        const nowMs = Date.now();
        if (!this._emptyReadyProbeStartedAtMs) {
          this._emptyReadyProbeStartedAtMs = nowMs;
        }
        const emptyProbeWindowMs = progressIndicatesDefinitiveEmpty ? 0 : 20000;
        const probeAgeMs = Math.max(0, nowMs - Number(this._emptyReadyProbeStartedAtMs || 0));
        if (probeAgeMs < emptyProbeWindowMs) {
          if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
          this._lastLoadAndSortResultSignature = '';
          if (!this.state.loading) {
            this.setState({ loading: true });
          }
          const nextProbeDelayMs = Math.min(
            900,
            Math.max(160, emptyProbeWindowMs - probeAgeMs)
          );
          this.scheduleLoadAndSortQuestions(nextProbeDelayMs);
          return;
        }

        this._emptyReadyProbeStartedAtMs = 0;
      }

      const byCountDesc = (a, b) => {
        const aCount = responseCounts[a.id?.toLowerCase?.()] || 0;
        const bCount = responseCounts[b.id?.toLowerCase?.()] || 0;
        return bCount - aCount;
      };

      const acctLower = (this.props.account || '').toLowerCase();
      const isLoggedIn = !!acctLower;

      const highlighted = [];
      const unanswered = [];
      const answered = [];

      for (const q of allQuestions) {
        const idL = q.id?.toLowerCase?.();
        if (!idL) continue;

        if (hlSet.has(idL)) {
          highlighted.push(q);
          continue;
        }

        if (isLoggedIn) {
          const map = allResponses[idL] || {};
          const has = !!map[acctLower];
          if (has) answered.push(q);
          else unanswered.push(q);
        } else {
          unanswered.push(q);
        }
      }

      highlighted.sort(byCountDesc);
      unanswered.sort(byCountDesc);
      answered.sort(byCountDesc);

      const sorted = isLoggedIn
        ? [...highlighted, ...unanswered, ...answered]
        : [...highlighted, ...unanswered];

      const hiddenGated = sorted.filter(
        (q) => q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted
      );
      const sortedVisible = sorted.filter(
        (q) => !(q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted)
      );
      const filterSig = serializeSurveyToolFilterState(this.state.filterState);
      const isFilterActive = !!this.state.isFilterActive || !!filterSig;
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      const settleUnreadyEmpty = canSettleUnreadyEmpty && sortedVisible.length === 0;
      // Regression guard: only short-circuit to the gated empty state once
      // masked questions are actually present in cache. A gate hint alone is
      // not enough because mixed sessions can still hydrate public questions.
      const nextHidden = hiddenGated.length > 0;
      const nextLoading = sortedVisible.length > 0
        ? false
        : (nextHidden ? false : (settleUnreadyEmpty ? false : (!this.props.isQuestionCacheReady || recentRateLimit)));
      const nextState = {
        // Only update allQuestionsForFilter; pileQuestions is driven by filter
        allQuestionsForFilter: sorted,
        hasHiddenGatedQuestions: nextHidden,
        // If we have data, stop loading; if we don't, keep spinner up while cache is
        // not ready OR we recently hit a rate-limit / quota condition.
        loading: nextLoading,
      };
      const prev = this.state;
      let shouldUpdateState =
        !this.areQuestionListsEquivalent(prev.allQuestionsForFilter, sorted) ||
        prev.hasHiddenGatedQuestions !== nextHidden ||
        prev.loading !== nextLoading;
      let nextVisibleForHydration = Array.isArray(prev.pileQuestions) ? prev.pileQuestions : [];
      let nextActiveIndexForHydration = Number(prev.activePileIndex || 0);

      if (!isFilterActive) {
        const clampedIndex = Math.min(
          Number(prev.activePileIndex || 0),
          Math.max(sortedVisible.length - 1, 0)
        );
        const pileChanged = !this.areQuestionListsEquivalent(prev.pileQuestions, sortedVisible);
        const indexChanged = Number(prev.activePileIndex || 0) !== clampedIndex;
        nextVisibleForHydration = pileChanged
          ? sortedVisible
          : (Array.isArray(prev.pileQuestions) ? prev.pileQuestions : []);
        nextActiveIndexForHydration = (pileChanged || indexChanged)
          ? clampedIndex
          : Number(prev.activePileIndex || 0);
        if (pileChanged) {
          this._pileQuestionsGeneration += 1;
          nextState.pileQuestions = sortedVisible;
        }
        if (pileChanged || indexChanged) {
          nextState.activePileIndex = clampedIndex;
        }
        shouldUpdateState = shouldUpdateState || pileChanged || indexChanged;
      }
      const visibleWindowIds = this.getPileVisibleQuestionIds(
        nextVisibleForHydration,
        nextActiveIndexForHydration
      );
      const visibleResponseSignature = this.buildPileVisibleResponseSignature(
        allResponses,
        visibleWindowIds,
        acctLower
      );
      const resultSignature = [
        isFilterActive ? 'f1' : 'f0',
        String(filterSig || ''),
        this.buildQuestionListSignature(sorted),
        this.buildQuestionListSignature(sortedVisible),
        hiddenGated.length > 0 ? 1 : 0,
        visibleResponseSignature,
      ].join('::');

      const runHydration = () => {
        if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
        if (resultSignature === this._lastLoadAndSortResultSignature) {
          bumpSurveyPerfCounter('noopSkipCount');
          return;
        }
        this._lastLoadAndSortResultSignature = resultSignature;

        const continueHydration = () => {
          this.rehydrateLocalCacheAnswersForRenderedIds(() => {
            if (typeof this.rehydrateDraftForRenderedIds === 'function') {
              this.rehydrateDraftForRenderedIds(true);
            }
            this._autoDecQueue = [];
            this._autoDecProcessing = false;
            const hasAutoDecryptLedger =
              Object.keys(this.state.autoDecryptAttempted || {}).length > 0 ||
              Object.keys(this.state.decryptingByKey || {}).length > 0;
            if (!hasAutoDecryptLedger) {
              if (this.state.autoDecryptEnabled) {
                try { this.queueAutoDecryptVisibleSweep('pile-hydration'); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
              }
              return;
            }
            this.setState(
              { autoDecryptAttempted: {}, decryptingByKey: {} },
              () => {
                this._autoDecryptMaskedAttemptSignature = {};
                if (this.state.autoDecryptEnabled) {
                  try { this.queueAutoDecryptVisibleSweep('pile-hydration-reset'); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
                }
              }
            );
          });
        };

        if (this.state.submissionComplete) {
          continueHydration();
        } else {
          this.initializeResponseState(continueHydration);
        }
      };

      if (!shouldUpdateState) {
        bumpSurveyPerfCounter('noopSkipCount');
        runHydration();
        return;
      }

      this.setState(nextState, runHydration);
    } catch (e) {
      surveyLog.error('Failed to load/sort questions:', e);
      // Treat unexpected errors as warming state if we recently saw rate-limits
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      this._lastLoadAndSortResultSignature = '';
      this.setState({ loading: !this.props.isQuestionCacheReady || recentRateLimit });
    }
  };



  initializeResponseState = (cb) => {
    // Rebuild guard: keep user's pending edits baseline intact
    if (this.state.isDirty || (this.state.modifiedCount || 0) > 0) {
      bumpSurveyPerfCounter('noopSkipCount');
      if (typeof cb === 'function') cb();
      return;
    }

    const pileQuestions = Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [];
    const activePileIndex = Number(this.state.activePileIndex || 0);
    const startIdx = Math.max(0, activePileIndex - 2);
    const endIdx = Math.min(pileQuestions.length, activePileIndex + 3);
    const visibleIdsSignature = pileQuestions
      .slice(startIdx, endIdx)
      .map((q) => String(q?.id || '').trim().toLowerCase())
      .filter(Boolean)
      .join('|');
    const initializeResponseSig = [
      visibleIdsSignature,
    ].join('::');
    if (initializeResponseSig === this._lastInitializeResponseSig) {
      bumpSurveyPerfCounter('noopSkipCount');
      if (typeof cb === 'function') cb();
      return;
    }
    this._lastInitializeResponseSig = initializeResponseSig;

    const initial = { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    pileQuestions.slice(startIdx, endIdx).forEach((q) => {
      if (!q?.id) return;
      initial.answers[q.id] = this.buildEmptyResponseFieldState(q.id);
      initial.additionalComments[q.id] = this.buildEmptyResponseFieldState(q.id, 'additional');
    });
    this.setState({
      surveysResponseState: [initial],
      editBaseline: this.deepClone(initial)
    }, () => {
      if (typeof cb === 'function') cb();
    });
  };

  ensureVisiblePileResponseState = () => {
    try {
      const pileQuestions = Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [];
      if (pileQuestions.length === 0) return;

      const activePileIndex = Number(this.state.activePileIndex || 0);
      const startIdx = Math.max(0, activePileIndex - 2);
      const endIdx = Math.min(pileQuestions.length, activePileIndex + 3);

      const visible = pileQuestions.slice(startIdx, endIdx);
      if (visible.length === 0) return;

      const slice = this.state.surveysResponseState?.[0] || {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      };

      let needsInit = false;
      for (const q of visible) {
        const qid = q?.id;
        if (!qid) continue;
        if (!slice.answers?.[qid] || !slice.additionalComments?.[qid]) {
          needsInit = true;
          break;
        }
      }
      if (!needsInit) return;

      this.setState(
        (prev) => {
          const prevSlice = prev.surveysResponseState?.[0] || {
            answers: {},
            importance: {},
            conviction: {},
            additionalComments: {},
          };

          const nextSlice = {
            answers: { ...(prevSlice.answers || {}) },
            importance: { ...(prevSlice.importance || {}) },
            conviction: { ...(prevSlice.conviction || {}) },
            additionalComments: { ...(prevSlice.additionalComments || {}) },
          };

          const prevBaseline = prev.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
          const nextBaseline = {
            answers: { ...prevBaseline.answers },
            importance: { ...prevBaseline.importance },
            conviction: { ...prevBaseline.conviction },
            additionalComments: { ...prevBaseline.additionalComments }
          };

          let changed = false;
          let baselineChanged = false;
          visible.forEach((q) => {
            const qid = q?.id;
            if (!qid) return;
            if (!nextSlice.answers[qid]) {
              nextSlice.answers[qid] = this.buildEmptyResponseFieldState(qid);
              changed = true;
            }
            if (!nextBaseline.answers[qid]) {
              nextBaseline.answers[qid] = this.buildEmptyResponseFieldState(qid);
              baselineChanged = true;
            }
            if (!nextSlice.additionalComments[qid]) {
              nextSlice.additionalComments[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
              changed = true;
            }
            if (!nextBaseline.additionalComments[qid]) {
              nextBaseline.additionalComments[qid] = this.buildEmptyResponseFieldState(qid, 'additional');
              baselineChanged = true;
            }
          });

          const updates = {};
          if (changed) updates.surveysResponseState = [nextSlice];
          if (baselineChanged) updates.editBaseline = nextBaseline;

          return (changed || baselineChanged) ? updates : null;
        },
        () => {
          this.rehydrateLocalCacheAnswersForRenderedIds(() => {
            this.rehydrateDraftForRenderedIds(false);
          });
        }
      );
    } catch (_) {
      surveyLog.error('ensureVisiblePileResponseState failed:', _);
    }
  };


  // Wrapper helpers so we don't shadow parent methods
  handleAnswerPile = (questionId, answer, options = {}) => {
    this.handleAnswer(0, questionId, answer, options);
  };

  handleAdditionalPile = (questionId, comments) => {
    this.handleAdditional(0, questionId, comments);
  };

  getSubmitCount = () => {
    const stats = (this.getPendingEditStats?.() || { total: 0 });
    return Number(stats.total || 0);
  };


  getPendingEditStats = () => {
    return this.computePendingEditStatsAtIndex(0);
  };

  getPileFilterQuestionResponses = () => {
    const slug = resolveEffectiveSlug(this.props);
    const pileFilterContext = resolvePileFilterContext(this.props, slug);
    const effectiveSlug = pileFilterContext.sessionSlug || slug;
    const networkID = pileFilterContext.networkIdStr;
    const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(this.props, effectiveSlug)];

    if (!networkID) return {};

    try {
      const mergedResponses = {};
      scopeSlugs.forEach((scopeSlug) => {
        const questionsCache = readQuestionsCacheRef(scopeSlug) || {};
        mergeQuestionResponses(mergedResponses, questionsCache?.[networkID]?.questionResponses || {});
      });
      return mergedResponses;
    } catch (e) {
      surveyLog.warn('SurveyTool: fallback', e);
      return {};
    }
  };



  toggleFilterModal = () =>
    this.setState((prev) => ({ filterModalOpen: !prev.filterModalOpen }));

  handlePileFilterActivityChange = (isActive) => {
    if (!!this.state.isFilterActive === !!isActive) return;
    this.setState({ isFilterActive: !!isActive });
  };


  handleFilter = (filteredQsOrCombined, newFilterState) => {
    let filteredArray = [];
    if (Array.isArray(filteredQsOrCombined)) {
      filteredArray = filteredQsOrCombined;
    } else if (
      filteredQsOrCombined &&
      Array.isArray(filteredQsOrCombined.filteredQuestions)
    ) {
      filteredArray = filteredQsOrCombined.filteredQuestions;
    } else {
      filteredArray = this.state.allQuestionsForFilter;
    }

    // Remove blocked (per-group)
    const slug = resolveEffectiveSlug(this.props);
    const pileFilterContext = resolvePileFilterContext(this.props, slug);
    const effectiveSlug = pileFilterContext.sessionSlug || slug;
    const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(this.props, effectiveSlug)];
    const BLOCKED_QUESTION_IDS_SET = new Set();
    scopeSlugs.forEach((scopeSlug) => {
      getBlockedQuestionIdsSet(scopeSlug).forEach((questionId) => {
        BLOCKED_QUESTION_IDS_SET.add(String(questionId || '').toLowerCase());
      });
    });
    filteredArray = (filteredArray || []).filter(
      (q) => q && q.id && !BLOCKED_QUESTION_IDS_SET.has(String(q.id).toLowerCase())
    );

    // Re-apply grouping/sorting for the filtered set
    const networkID = pileFilterContext.networkIdStr;

    let allResponses = {};
    let responseCounts = {};
    const scopeSignature = scopeSlugs.map((value) => normalizeSessionSlugValue(value)).join(',');
    const responseCountsCacheKey = `${scopeSignature}|${networkID}|${Number(this.props.questionResponsesNonce || 0)}`;
    try {
      if (networkID) {
        scopeSlugs.forEach((scopeSlug) => {
          const qObj = readQuestionsCacheRef(scopeSlug) || {};
          const qNet = qObj?.[networkID] || {};
          mergeQuestionResponses(allResponses, qNet?.questionResponses || {});
        });
        if (
          this._responseCountsCacheKey === responseCountsCacheKey &&
          this._responseCountsCacheValue &&
          typeof this._responseCountsCacheValue === 'object'
        ) {
          responseCounts = this._responseCountsCacheValue;
        } else {
          const nextResponseCounts = {};
          Object.keys(allResponses).forEach((qid) => {
            nextResponseCounts[qid] = Object.keys(allResponses[qid] || {}).length;
          });
          responseCounts = nextResponseCounts;
          this._responseCountsCacheKey = responseCountsCacheKey;
          this._responseCountsCacheValue = nextResponseCounts;
        }
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    const hlSet = new Set();
    scopeSlugs.forEach((scopeSlug) => {
      getHighlightedQuestionIdsSet(scopeSlug).forEach((questionId) => {
        hlSet.add(String(questionId || '').toLowerCase());
      });
    });
    const acctLower = (this.props.account || '').toLowerCase();
    const isLoggedIn = !!acctLower;

    const byCountDesc = (a, b) => {
      const aCount = responseCounts[a.id?.toLowerCase?.()] || 0;
      const bCount = responseCounts[b.id?.toLowerCase?.()] || 0;
      return bCount - aCount;
    };

    const highlighted = [];
    const unanswered = [];
    const answered = [];

    for (const q of filteredArray) {
      const idL = q.id?.toLowerCase?.();
      if (!idL) continue;

      if (hlSet.has(idL)) {
        highlighted.push(q);
        continue;
      }

      if (isLoggedIn) {
        const map = allResponses[idL] || {};
        const has = !!map[acctLower];
        if (has) answered.push(q);
        else unanswered.push(q);
      } else {
        unanswered.push(q);
      }
    }

    highlighted.sort(byCountDesc);
    unanswered.sort(byCountDesc);
    answered.sort(byCountDesc);

    const sortedFiltered = isLoggedIn
      ? [...highlighted, ...unanswered, ...answered]
      : [...highlighted, ...unanswered];

    const hiddenGated = sortedFiltered.filter(
      (q) => q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted
    );
    const sortedFilteredVisible = sortedFiltered.filter(
      (q) => !(q && this.isMaskedPromptText(q?.prompt) && !q?.promptDecrypted)
    );
    const nextFilterState = normalizeSurveyToolFilterState(newFilterState || this.state.filterState);
    const nextFilterSig = serializeSurveyToolFilterState(nextFilterState);
    const currentFilterSig = serializeSurveyToolFilterState(this.state.filterState);
    const nextVisibleSig = this.buildQuestionListSignature(sortedFilteredVisible);
    const currentVisibleSig = this.syncCurrentPileQuestionsSignature(this.state.pileQuestions || []);
    const nextHiddenGated = hiddenGated.length > 0;

    if (
      nextVisibleSig === currentVisibleSig &&
      nextHiddenGated === !!this.state.hasHiddenGatedQuestions &&
      nextFilterSig === currentFilterSig
    ) {
      bumpSurveyPerfCounter('noopSkipCount');
      return;
    }

    this._pileQuestionsGeneration += 1;
    this.setState({
      pileQuestions: sortedFilteredVisible,
      activePileIndex: 0,
      filterState: nextFilterState,
      hasHiddenGatedQuestions: nextHiddenGated,
    }, () => {
        if (typeof this.props.onFilterChange === 'function') {
          try { this.props.onFilterChange(this.state.filterState); } catch (e) { surveyLog.warn('SurveyTool: callback', e); }
        }
        // Ensure state is initialized and hydrated for the new set of filtered questions.
        // This ensures 'editBaseline' is established (preventing ghost counts)
        // and answers are prefilled (fixing the "does not prefill" issue).
        this.initializeResponseState(() => {
            this.rehydrateLocalCacheAnswersForRenderedIds(() => {
               this.rehydrateDraftForRenderedIds(true);
               // Trigger auto-decrypt if enabled
               this._autoDecQueue = [];
               this._autoDecProcessing = false;
               this.setState(
                { autoDecryptAttempted: {}, decryptingByKey: {} },
                () => {
                  this._autoDecryptMaskedAttemptSignature = {};
                  if (this.state.autoDecryptEnabled) {
                    try { this.queueAutoDecryptVisibleSweep('pile-filter-reset'); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
                  }
                }
              );
            });
        });
    });
  };


  renderActiveQuestion = (question) => {
    const { surveysResponseState, showComments, showConviction } = this.state;
    const slice = surveysResponseState[0] || {
      answers: {},
      additionalComments: {},
      importance: {},
      conviction: {},
    };
    const answer = slice.answers[question.id] || this.buildEmptyResponseFieldState(question.id);
    const additional = slice.additionalComments[question.id] || this.buildEmptyResponseFieldState(question.id, 'additional');
    const convictionValue = this.getConvictionValueForSlice(slice, question.id);
    const importanceValue = this.getImportanceValueForSlice(slice, question.id);
    const hasConvictionImportanceValue = hasConvictionOrImportanceValueForQuestion(slice, question.id);
    const sliderMode = ENABLE_IMPORTANCE_SLIDER_TOGGLE ? this.getSliderMode(question.id) : 'conviction';
    const activeSliderValue = sliderMode === 'importance' ? importanceValue : convictionValue;

    const promptMasked = this.isMaskedPromptText(question?.prompt) && !question?.promptDecrypted;
    if (promptMasked) {
      const gateNames = this.resolveGatedPromptGateNames(question);
      const tooltipIdBase = String(question?.id || 'gated').trim().toLowerCase();
      const tooltipId = `ce-gated-prompt-tip-${tooltipIdBase.replace(/[^a-z0-9_-]/g, '-')}-pile`;
      const tooltipText = gateNames.length
        ? `Required ${t('sbt')} ${gateNames.length > 1 ? t('gates') : t('gate')}: ${gateNames.join(', ')}`
        : `${t('sbt')} ${t('gate')} required`;
      return (
        <Card className={styles.pileCardInner}>
          <CardBody className={styles.pileCardBody}>
            <div className={styles.pileCardHeader}>
              {this.renderPromptWithManualDecrypt(question)}
            </div>
            <div
              className={styles.gatedPromptNotice}
              role="note"
              data-testid={E2E_TESTIDS.SURVEY_GATED_PROMPT_NOTICE}
              data-ce-question-id={String(question.id || '').trim().toLowerCase()}
            >
              <FontAwesomeIcon icon={faLock} style={{ marginRight: 8 }} />
              <span>
                This question is{' '}
                <span
                  id={tooltipId}
                  data-testid={`ce-gated-prompt-tooltip-${question?.id}`}
                  className={styles.gatedPromptTooltipTrigger}
                  onClick={(e) => e.stopPropagation()}
                >
                  gated
                  <FontAwesomeIcon
                    icon={faQuestionCircle}
                    className={`${styles.tooltip} ${styles.gatedPromptTooltipIcon}`}
                  />
                </span>{'. Decrypt the prompt to answer.'}
              </span>
            <CETooltip
              placement="right"
              trigger="hover focus click"
              target={tooltipId}
              className={styles.tooltipBubble}
              container="body"
            >
              {tooltipText}
            </CETooltip>
            </div>
          </CardBody>
        </Card>
      );
    }

    // Parse envelopes (v2 only)
    const getEnvelope = (item) => {
      try { return item?.encryptedPortion ? JSON.parse(item.encryptedPortion) : null; } catch { return null; }
    };
    const isV1Envelope = (env) => !!env && Number(env.v) === 1 && String(env.cipher) === 'aes-gcm-256';

    const answerEnvelope = getEnvelope(answer);
    const additionalEnvelope = getEnvelope(additional);

    // Masked detection (respect legacy 'encrypted' flag if envelope missing)
    const isAnswerEncrypted = !!(answer?.value === '*' && (answer?.encryptedPortion || answer?.encrypted));
    const isAdditionalEncrypted = !!(additional?.value === '*' && (additional?.encryptedPortion || additional?.encrypted));

    // Version-agnostic gating
    const allowDecryptAnswer =
      isAnswerEncrypted && ( !!answerEnvelope || (!!this.props.loginComplete && !!this.props.account) );
    const allowDecryptAdditional =
      isAdditionalEncrypted && ( !!additionalEnvelope || (!!this.props.loginComplete && !!this.props.account) );

    const decryptTooltip = 'Login to decrypt this encrypted field.';

    // Specific glows
    const hasAdditionalContent = hasMeaningfulFieldValue(additional);

    const glowAnswer = !!answer?.encrypted;
    const glowAdditional = !!(additional?.encrypted && hasAdditionalContent);

    // Per-field decrypting flags (spinner only while in-flight for this field)
    const isAnswerDecrypting = !!(this.state.decryptingByKey && this.state.decryptingByKey[`${question.id}:answer`]);
    const isAdditionalDecrypting = !!(this.state.decryptingByKey && this.state.decryptingByKey[`${question.id}:additional`]);

    let questionComponent;
    if (isAnswerEncrypted) {
      questionComponent = (
        <div style={{ marginBottom: 8 }}>
          {/* Manual decrypt chip hidden when auto-decrypt is enabled */}
          {this.state.autoDecryptEnabled ? (
            isAnswerDecrypting ? (
              <div className={styles.decryptChip}>
                <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
                <span>Decrypting...</span>
              </div>
            ) : null
          ) : (
            <div className={styles.decryptChip}>
              <Button
                onClick={() => this.handleDecryptQuestionAnswer(question.id, 'answer')}
                id={styles.decryptQuestionButton}
                disabled={this.state.isDecrypting || !allowDecryptAnswer}
                title={!allowDecryptAnswer ? decryptTooltip : undefined}
              >
                {isAnswerDecrypting ? 'Decrypting...' : 'Decrypt Answer'}
              </Button>
            </div>
          )}
        </div>
      );
    } else {
      switch (question.type) {
        case 'binary':
          questionComponent = (
            <FormGroup id={styles.binaryChoice}>
              {['Agree', 'Unsure', 'Disagree'].map((option) => (
                <Label
                  key={option}
                  check
                  className={`${styles.radioOptionText} ${styles[option.toLowerCase()]} ${
                    answer.value === option ? styles.selected : ''
                  }`}
                >
                  <Input
                    type="radio"
                    name={`q-${question.id}`}
                    value={option}
                    checked={answer.value === option}
                    onChange={() => this.handleAnswerPile(question.id, option)}
                    onClick={() => {
                      if (answer.value === option) this.handleAnswerPile(question.id, option);
                    }}
                    disabled={this.state.isSubmitting}
                  />
                  {option}
                </Label>
              ))}
            </FormGroup>
          );
          break;

        case 'multichoice': {
          const options = Array.isArray(question.options) ? question.options : [];
          const isSingleSelect = isSingleSelectMultichoice(question);
          const selectedValues = normalizeMultichoiceValue(answer.value);
          questionComponent = (
            <FormGroup id={styles.multiChoice}>
              {options.map((opt, i) => (
                <Label check key={i} className={`${styles.checkboxOptionText} ${selectedValues.includes(opt) ? styles.selected : ''}`}>
                  <Input
                    type="checkbox"
                    name={`question-${question.id}`}
                    value={opt}
                    onChange={(e) => {
                      const currentAnswerValue = normalizeMultichoiceValue(
                        slice.answers?.[question.id]?.value
                      );
                      let next = [];
                      if (isSingleSelect) {
                        next = e.target.checked ? [opt] : [];
                      } else {
                        next = [...currentAnswerValue];
                        if (e.target.checked) {
                          if (!next.includes(opt)) next.push(opt);
                        } else {
                          const idx = next.indexOf(opt);
                          if (idx > -1) next.splice(idx, 1);
                        }
                      }
                      this.handleAnswerPile(question.id, next);
                    }}
                    checked={selectedValues.includes(opt)}
                    disabled={this.state.isSubmitting}
                  />
                  {opt}
                </Label>
              ))}
            </FormGroup>
          );
          break;
        }

        case 'rating': {
          const ratingValue = getNormalizedUiRatingValue(answer.value);
          questionComponent = (
            <div className={styles.ratingContainer}>
              <CESlider
                min={RATING_MIN}
                max={RATING_MAX}
                step={1}
                value={ratingValue}
                onChange={(val, event) =>
                  this.handleAnswerPile(question.id, val, this.getSliderPersistOptions(event))}
                onChangeComplete={this.flushDraftPersistAfterSliderChange}
                disabled={this.state.isSubmitting}
                className={styles.ratingSlider}
              />
              <span className={styles.ratingValueDisplay}>
                {ratingValue}
              </span>
            </div>
          );
          break;
        }

        case 'freeform':
        default:
          questionComponent = (
            <AudioInput
              {...this.getAudioInputWorkerProps()}
              placeholder={'Your response...'}
              placeholderOpacity={0.5}
              value={answer.value || ''}
              updateFunction={(val) => this.handleAnswerPile(question.id, val)}
              toggleEncryption={(newState) =>
                this.toggleAnswerEncryption(0, question.id, newState)
              }
              smallEncryptToggle={true}
              disabled={this.state.isSubmitting}
              /* Main glows only when main answer is encrypted */
              forceGlow={glowAnswer}
              /* Hide field-level lock in PileViewMode for main answer input; lock is in footer */
              disableEncryption={true}
              /* Hide transcript/audio downloads in pile view inputs */
              enableDownloads={false}
            />
          );
          break;
      }
    }

    const questionContainerClass = styles[`${question.type}QuestionContainer`] || '';

    return (
      <Card className={styles.pileCardInner}>
        <CardBody className={styles.pileCardBody}>
          <div className={styles.pileCardHeader}>
            {this.renderPromptWithManualDecrypt(question)}
          </div>

          <div className={styles.pileCardMainContent}>
            <div className={questionContainerClass}>
              {questionComponent}
            </div>
          </div>

          <div className={styles.pileCardFooter}>
            <div className={styles.pileControlsRow}>
              <div className={styles.importanceSlider}>
                {showConviction[question.id] ? (
                  <>
                    {this.renderConvictionImportanceLabel(question.id, convictionValue, importanceValue)}
                    <CESlider
                      min={0}
                      max={10}
                      step={1}
                      value={activeSliderValue}
                      className={styles.convictionSlider}
                      tooltip={false}
                      onChange={(value, event) =>
                        this.handleConvictionImportanceChange(
                          0,
                          question.id,
                          sliderMode,
                          value,
                          this.getSliderPersistOptions(event)
                        )}
                      onChangeComplete={this.flushDraftPersistAfterSliderChange}
                      disabled={this.state.isSubmitting}
                    />
                  </>
                ) : (
	                  ENABLE_IMPORTANCE_SLIDER_TOGGLE ? (
	                    this.renderBullhornToggleButton({
	                      onClick: () => this.openConvictionSlider(question.id),
	                      disabled: this.state.isSubmitting,
                        active: hasConvictionImportanceValue,
	                    })
	                  ) : (
	                    this.renderBullhornToggleButton({
	                      onClick: () => this.toggleConviction(question.id),
	                      disabled: this.state.isSubmitting,
                        active: hasConvictionImportanceValue,
	                    })
	                  )
	                )}
	              </div>
	              <div className={styles.pileCardIcons}>
	                <button
	                  className={`${styles.iconButton} ${styles.commentButton} ${hasAdditionalContent ? styles.iconButtonActive : ''}`}
	                  onClick={() => this.toggleComments(question.id)}
	                  data-testid={E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE}
	                  data-ce-question-id={String(question.id || '').trim().toLowerCase()}
                >
                  <FontAwesomeIcon icon={faComment} className={hasAdditionalContent ? styles.iconGlow : undefined} />
                </button>

                {this.renderAnswerLockControl({
                  surveyIndex: 0,
                  questionId: question.id,
                  answer,
                  lockDisabled: this.state.isSubmitting || isAnswerEncrypted,
                  lockTitle: isAnswerEncrypted ? 'Encrypted answer' : (answer.encrypted ? 'Encrypted' : 'Not encrypted'),
                  glowAnswer,
                  forceAudienceMenu: true,
                  selfAudienceLabel: 'only me',
                  visualContext: 'pile',
                })}
              </div>
            </div>

            {/* Additional comments */}
            {showComments[question.id] && (
              <div className={styles.pileCommentsRow}>
                {isAdditionalEncrypted ? (
                  this.state.autoDecryptEnabled ? (
                    isAdditionalDecrypting ? (
                      <div className={styles.decryptChip}>
                        <FontAwesomeIcon icon={faSpinner} spin style={{ marginRight: 8 }} />
                        <span>Decrypting...</span>
                      </div>
                    ) : null
                  ) : (
                    <div className={styles.decryptChip}>
                      <Button
                        onClick={() =>
                          this.handleDecryptQuestionAnswer(question.id, 'additional')
                        }
                        id={styles.decryptQuestionButton}
                        disabled={this.state.isDecrypting || !allowDecryptAdditional}
                        title={!allowDecryptAdditional ? decryptTooltip : undefined}
                      >
                        {isAdditionalDecrypting ? 'Decrypting...' : 'Decrypt Comments'}
                      </Button>
                    </div>
                  )
                ) : (
                  <div className={styles.pileAdditionalEditor}>
                    <div className={styles.additionalCommentsInlineRow}>
                      <div className={styles.additionalCommentsInputWrap}>
                        <AudioInput
                          {...this.getAudioInputWorkerProps()}
                          placeholder="Additional comments..."
                          placeholderOpacity={0.5}
                          value={additional.value || ''}
                          updateFunction={(val) => this.handleAdditionalPile(question.id, val)}
                          toggleEncryption={(newState) =>
                            this.toggleAdditionalCommentsEncryption(0, question.id, newState)
                          }
                          dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
                          dataCeQuestionId={String(question.id || '').trim().toLowerCase()}
                          smallEncryptToggle={true}
                          disabled={this.state.isSubmitting}
                          /* Additional glows only when additional has content and is encrypted */
                          forceGlow={glowAdditional}
                          encrypted={additional.encrypted || false}
                          disableEncryption={true}
                          /* Hide transcript/audio downloads in pile view inputs */
                          enableDownloads={false}
                        />
                      </div>
                      <div className={styles.additionalCommentsLockSlot}>
                        {this.renderAnswerLockControl({
                          surveyIndex: 0,
                          questionId: question.id,
                          answer: additional,
                          field: additional,
                          fieldKey: 'additional',
                          lockDisabled: this.state.isSubmitting,
                          lockTitle: additional.encrypted ? 'Encrypted comments' : 'Comments encryption audience',
                          glowAnswer: glowAdditional,
                          forceAudienceMenu: true,
                          selfAudienceLabel: 'only me',
                          showPlaintextOption: true,
                          showFollowOption: true,
                          visualContext: 'pile',
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    );
  };


  render() {
    bumpSurveyPerfCounter('renderCount');
    const {
      pileQuestions,
      activePileIndex,
      loading,
      showCreate,
      filterModalOpen,
      showLongLoading,
      navCounterVisible,
      showHologramAssistant
    } = this.state;

    const activeQuestion =
      Array.isArray(pileQuestions) && pileQuestions.length > 0
        ? (pileQuestions[activePileIndex] || pileQuestions[0] || null)
        : null;
    const activePromptMasked = !!(
      activeQuestion &&
      this.isMaskedPromptText(activeQuestion?.prompt) &&
      !activeQuestion?.promptDecrypted
    );
    const hiddenMaskSource = (
      Array.isArray(this.state.allQuestionsForFilter) && this.state.allQuestionsForFilter.length > 0
    )
      ? this.state.allQuestionsForFilter
      : (Array.isArray(this.state.questionPool) ? this.state.questionPool : []);
    const { hiddenMaskedQuestionIds } = this.getMemoizedMaskedQuestionVisibility(hiddenMaskSource, false);

    const slug = resolveEffectiveSlug(this.props);
    const firstBoot = !hasCacheHydratedFlag(this.props);
    const recentRateLimit = this.isRecentRateLimit();
    const hasVisibleQuestions = Array.isArray(pileQuestions) && pileQuestions.length > 0;
    const hasError = !!this.props.cacheInitializationError;
    const progressSlug = normalizeQuestionProgressSlug(slug);
    const questionScanProgress =
      this.props.questionScanProgress &&
      doesQuestionProgressMatchSlug(this.props.questionScanProgress.slug, progressSlug)
        ? this.props.questionScanProgress
        : null;
    const scanProgressDisplay = buildQuestionScanProgressDisplay(questionScanProgress);
    const pileScanDisplay = this.getPileLoadingScanDisplay(questionScanProgress, scanProgressDisplay);
    const scanTotalBlocks = scanProgressDisplay.totalBlocks;
    const scanRemainingBlocks = scanProgressDisplay.remainingBlocks;
    const scanPercent = pileScanDisplay.percentComplete;
    const hydrateDiscovered = Math.max(0, Number(questionScanProgress?.discoveredQuestions || 0));
    const hydrateDone = Math.max(0, Number(questionScanProgress?.hydratedQuestions || 0));
    const pendingMetadataCount = Math.max(0, Number(questionScanProgress?.pendingMetadataCount || 0));
    const hasPendingMetadataRetries = pendingMetadataCount > 0;
    const isHydrating = questionScanProgress?.phase === 'hydrate';
    const hasTerminalScanError = !!questionScanProgress && questionScanProgress?.phase === 'error';
    const scanErrorMessage = hasTerminalScanError
      ? String(questionScanProgress?.errorMessage || 'Unable to load questions for this session.')
      : '';
    const hydrationProgressSettled = !!questionScanProgress && (
      questionScanProgress?.phase === 'hydrate' &&
      hydrateDone >= hydrateDiscovered
    );
    const priorResponsesHydrating = !!this.state.isHydratingPriorResponses;
    const hasScanOrHydrationWork = !!questionScanProgress && (
      (questionScanProgress?.phase === 'scan' && scanRemainingBlocks > 0) ||
      (questionScanProgress?.phase === 'hydrate' && (
        hydrateDone < hydrateDiscovered ||
        hasPendingMetadataRetries
      ))
    );
    const hasConcreteHiddenQuestions = (
      !!this.state.hasHiddenGatedQuestions ||
      hiddenMaskedQuestionIds.length > 0
    );
    const preferGatedEmptyState = this.shouldPreferGatedEmptyState({
      hasConcreteHiddenQuestions,
      hasVisibleQuestions,
      firstBoot,
      recentRateLimit,
      hasPendingMetadataRetries,
    });
    const isFilterActive =
      !!this.state.isFilterActive ||
      isSurveyToolFilterStateActive(this.state.filterState);
    const hasFilterBaseQuestions = Array.isArray(this.state.allQuestionsForFilter) &&
      this.state.allQuestionsForFilter.length > 0;
    const showGatedEmptyState = hasConcreteHiddenQuestions || preferGatedEmptyState;
    const lockedGateDetails = this.getMemoizedLockedQuestionGateDetails(hiddenMaskedQuestionIds);
    const showFilteredEmptyState = (
      !hasVisibleQuestions &&
      isFilterActive &&
      hasFilterBaseQuestions &&
      !showGatedEmptyState
    );
    const allowUnreadyEmptySettlement = (
      !hasVisibleQuestions &&
      !firstBoot &&
      this.props.cacheHasLoaded !== false &&
      !this.props.isQuestionCacheReady &&
      !recentRateLimit &&
      !hasScanOrHydrationWork &&
      !hasPendingMetadataRetries &&
      hydrationProgressSettled
    ) || preferGatedEmptyState;
    const isStillLoading = shouldShowPileFullLoadingState({
      loading,
      hasVisibleQuestions,
      firstBoot,
      isQuestionCacheReady: !!this.props.isQuestionCacheReady,
      recentRateLimit,
      hasScanOrHydrationWork,
      allowUnreadyEmptySettlement,
      allowFilteredEmptySettlement: showFilteredEmptyState,
      hasTerminalScanError,
    });
    const showMiniBackgroundSpinner = hasVisibleQuestions && (
      priorResponsesHydrating || loading || hasScanOrHydrationWork || recentRateLimit
    );

    /**
     * PILE MODE — Submit button label (central helper)
     */
    const _pileStats = this.getPendingStatsSnapshot();
    const pileSubmitLabel = (this.props.computeSubmitLabel || computeSubmitLabel)(this, {
      pendingStats: _pileStats,
    });
    const pileSubmittedStateActive = !!(this.state.submittedSinceLastEdit || this.state.submissionComplete);
    const finalSubmitText = pileSubmittedStateActive
      ? 'Submitted'
      : (this.state.pileSubmitTempText || pileSubmitLabel);

    const handleSubmitClick = async () => {
      if (!this.props.loginComplete) {
        await this.encryptAndUpload();
        return;
      }
      if (pileSubmittedStateActive) return;
      const currentPending = this.getSubmitCount();
      if (currentPending === 0) {
        if (this._pileSubmitTimer) {
          clearTimeout(this._pileSubmitTimer);
          this._pileSubmitTimer = null;
        }
        this.setState({ pileSubmitTempText: 'No new or changed responses' });
        this._pileSubmitTimer = setTimeout(() => {
          this.setState({ pileSubmitTempText: pileSubmitLabel });
          this._pileSubmitTimer = setTimeout(() => {
            this.setState({ pileSubmitTempText: null });
            this._pileSubmitTimer = null;
          }, 1500);
        }, 2000);
        return;
      }
      await this.encryptAndUpload();
    };

    const accountLower = (this.props.account || '').toLowerCase();

    const activeGreen = '#4cd964';
    const filterButtonStyle = isFilterActive
      ? { color: activeGreen, borderColor: activeGreen, opacity: 0.75 }
      : {};
    const filterIconStyle = isFilterActive ? { color: activeGreen } : {};
    const gatedEmptyHasDetails = lockedGateDetails.length > 0;
    const gatedEmptyPanel = hiddenMaskedQuestionIds.length > 0
      ? (
        <div className={styles.gatedEmptyPanelShell}>
          {this.renderLockedQuestionsPanel({
            hiddenMaskedQuestionIds,
            lockedGateDetails,
            title: `This session's questions are ${t('gatedLower')}`,
            subtitle: gatedEmptyHasDetails
              ? `Connect an eligible ${t('walletLower')} that satisfies the ${t('gateLower')} requirements below, then decrypt to view the questions.`
              : `Connect an eligible ${t('walletLower')} and decrypt to view the questions.`,
            forceExpanded: false,
            surface: 'dark',
            showCaret: true,
          })}
        </div>
      )
      : (
        <>
          <div className={styles.gatedEmptyHeadline}>{`This session's questions are ${t('gatedLower')}.`}</div>
          <div className={styles.gatedEmptyCopy}>
            {`These questions are ${t('gatedLower')} by a ${t('sbt')}. Connect an eligible ${t('walletLower')} to decrypt.`}
          </div>
        </>
      );

    // JSX segments

    const navControls = (
      <div className={styles.pileNav}>
        <button
          onClick={this.handlePrev}
          disabled={pileQuestions.length === 0 || activePileIndex === 0}
          className={styles.pileNavArrow}
          aria-label="Previous Question"
        >
          <FontAwesomeIcon icon={faChevronLeft} />
        </button>
        <span
          className={styles.pileNavCounterText}
          style={{
            opacity: navCounterVisible ? 0.8 : 0, // Slight visibility tweak for neumorphism
            transition: 'opacity 0.5s ease-in-out',
          }}
        >
          {pileQuestions.length === 0 ? 0 : activePileIndex + 1} / {pileQuestions.length}
        </span>
        <button
          onClick={this.handleNext}
          disabled={
            pileQuestions.length === 0 ||
            activePileIndex === pileQuestions.length - 1
          }
          className={styles.pileNavArrow}
          aria-label="Next Question"
        >
          <FontAwesomeIcon icon={faChevronRight} />
        </button>
      </div>
    );

    const actionControls = (
      <div className={styles.pileActions}>
        {/* 1. Filter */}
        <button
          onClick={this.toggleFilterModal}
          className={`${styles.actionButton} ${isFilterActive ? styles.actionButtonActive : ''}`.trim()}
          style={filterButtonStyle}
          title="Filter Questions"
          data-testid={E2E_TESTIDS.SURVEY_FILTER_TOGGLE}
        >
          <FontAwesomeIcon icon={faFilter} style={filterIconStyle} />
        </button>

        {/* 2. Create/Add */}
        <button
          onClick={this.toggleCreate}
          className={`${styles.actionButton}`}
          title={showCreate ? "Close Create Interface" : "Create New Question"}
          data-testid={E2E_TESTIDS.SURVEY_CREATE_TOGGLE_PILE}
        >
          <FontAwesomeIcon icon={showCreate ? faMinus : faPlus} />
        </button>

        {/* 3. View All (Caret) - Moved to bottom (desktop) / right (mobile) */}
        {this.props.onViewAllClick && (
          <button
            onClick={this.handleViewAllFromPile}
            className={`${styles.actionButton}`}
            title="View All Questions"
            data-testid={E2E_TESTIDS.SURVEY_VIEW_ALL}
          >
            <FontAwesomeIcon icon={faCaretDown} />
          </button>
        )}
      </div>
    );

    const footerControls = (
      <div className={styles.pileFooter}>
        <Button
          onClick={handleSubmitClick}
          data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
          className={`${styles.pileSubmitButton}${_pileStats.total > 0 ? ` ${styles.submitGlow}` : ''}${_pileStats.total === 0 ? ` ${styles.pileSubmitButtonInactive}` : ''}`}
          disabled={this.state.isSubmitting || activePromptMasked}
        >
          {this.state.isSubmitting ? (
            <FontAwesomeIcon icon={faSpinner} spin />
          ) : (
            finalSubmitText
          )}
        </Button>

        {_pileStats.total > 0 && !this.state.isSubmitting && !pileSubmittedStateActive && (
          <button
            type="button"
            className={styles.pileIconButton}
            onClick={this.handleRevertPendingChanges}
            title="Clear changes"
            aria-label="Clear pending changes"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        )}

        {pileSubmittedStateActive && accountLower && (
          <a
            href={`/u/${accountLower}`}
            className={styles.pileSubmitLink}
            title="Open your profile"
          >
            <FontAwesomeIcon icon={faCheck} />
          </a>
        )}
      </div>
    );

    return (
      <div className={styles.pileViewContainer}>
        <div className={styles.pileWrapper}>
          <div className={styles.pileInteractionUnit}>
            {SHOW_PILE_HOLOGRAM_TOGGLE && (
              <button
                type="button"
                className={`${styles.pileHologramToggle}${showHologramAssistant ? ` ${styles.pileHologramToggleActive}` : ''}`}
                onClick={this.toggleHologramAssistant}
                aria-label={showHologramAssistant ? 'Hide holographic guide' : 'Show holographic guide'}
                aria-pressed={showHologramAssistant}
                title={showHologramAssistant ? 'Hide holographic guide' : 'Show holographic guide'}
                data-testid={E2E_TESTIDS.SURVEY_PILE_HOLOGRAM_TOGGLE}
              >
                <FontAwesomeIcon icon={faRobot} />
              </button>
            )}

            {showMiniBackgroundSpinner && !showHologramAssistant && (
              <div className={styles.miniSpinnerWrapper}>
                <FontAwesomeIcon
                  icon={faSpinner}
                  spin
                  className={styles.miniLoaderIcon}
                  style={{ opacity: priorResponsesHydrating ? 0.5 : 1 }}
                  title={
                    priorResponsesHydrating
                      ? 'Loading your previous responses...'
                      : (showLongLoading ? 'Still scanning... checking network' : 'Background refresh active')
                  }
                />
              </div>
            )}

            {/* Main Card Area */}
            <div className={styles.pileCardContainer}>
              {showHologramAssistant ? (
                <PileHologramAssistant />
              ) : pileQuestions.length === 0 ? (
                // Empty / Loading State
                <div className={styles.pileEmptyState}>
                  {hasTerminalScanError ? (
                    <>
                      <div>{scanErrorMessage}</div>
                    </>
                  ) : hasError ? (
                    <>
                      <div>Cache initialization error (RPC or metadata fetch failed).</div>
                      <div style={{ opacity: 0.8, marginTop: 8 }}>
                        Try refreshing questions/responses or reloading the page.
                      </div>
                    </>
                  ) : isStillLoading ? (
                    <>
                      <div style={{fontSize: '2.5rem', display: 'flex', alignItems: 'center', gap: '15px'}}>
                        <FontAwesomeIcon icon={faSpinner} spin size="1x" />
                      </div>
                      <div className={styles.pileLoadingHeadline}>
                        Loading... {Math.max(0, Number(this.state.loadingElapsedSec || 0))}s
                      </div>
                      <div className={styles.pileLoadingSubhead}>
                        {isHydrating
                          ? `Loading Metadata (${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered})`
                          : (showLongLoading ? '' : '')}

                      </div>
                      {(scanTotalBlocks > 0 || isHydrating) && (
                        <div className={styles.pileLoadingProgressWrap}>
                          <div className={styles.pileLoadingProgressMeta}>
                            <span>
                              {isHydrating
                                ? `${Math.max(0, hydrateDiscovered - Math.min(hydrateDone, hydrateDiscovered))} items left`
                                : pileScanDisplay.metaLeftText}
                            </span>
                            <span>
                              {isHydrating
                                ? `${Math.min(hydrateDone, hydrateDiscovered)} / ${hydrateDiscovered}`
                                : pileScanDisplay.metaRightText}
                            </span>
                          </div>
                          <div className={styles.pileLoadingProgressBar}>
                            <div
                              className={styles.pileLoadingProgressFill}
                              style={{
                                width: `${isHydrating
                                  ? (hydrateDiscovered > 0 ? Math.round((Math.min(hydrateDone, hydrateDiscovered) / hydrateDiscovered) * 100) : 0)
                                  : scanPercent}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : showFilteredEmptyState ? (
                    'No questions match current filters.'
                  ) : (
                    showGatedEmptyState ? (
                      gatedEmptyPanel
                    ) : (
                      'No questions available.'
                    )
                  )}
                </div>
              ) : (
                // Card Rendering
                (() => {
                  const startIdx = Math.max(0, activePileIndex - 2);
                  const endIdx = Math.min(pileQuestions.length, activePileIndex + 3);
                  return pileQuestions.slice(startIdx, endIdx).map((q, sliceIdx) => {
                    const idx = startIdx + sliceIdx;
                    const offset = idx - activePileIndex;

                    let status = '';
                    if (offset === 0) status = styles.pileCardActive;
                    else if (offset === 1) status = styles.pileCardNext;
                    else if (offset === -1) status = styles.pileCardPrev;
                    else if (offset > 1) status = styles.pileCardAfter;
                    else status = styles.pileCardBefore;

                    return (
                      <div key={q.id} className={`${styles.pileCard} ${status}`}>
                        {offset === 0 ? (
                          this.renderActiveQuestion(q)
                        ) : (
                          <div className={styles.pileCardInner}></div>
                        )}
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {!showHologramAssistant && (
              <div className={styles.pileControls}>
                {actionControls}
                {footerControls}
                {navControls}
              </div>
            )}

          </div>
        </div>

        {!showHologramAssistant && showCreate && (
          <div className={styles.pileFullControls} ref={this.createSectionRef}>
            <CreateSurvey
              {...this.props}
              hideSurveyQuestionToggleUntilAuthoring={true}
            />
          </div>
        )}

        <QuestionFilter
          filterModalOpen={filterModalOpen}
          toggleFilterModal={this.toggleFilterModal}
          questions={this.state.allQuestionsForFilter}
          questionResponses={this.getPileFilterQuestionResponses()}
          onFilter={this.handleFilter}
          onFilterActivityChange={this.handlePileFilterActivityChange}
          filterState={this.state.filterState}
          enableLocalStorage={true}
          currentViewModeForUrl={'questions'}
          currentSurveyIdForUrl={null}
          provider={this.props.provider}
          network={this.props.network}
          activeSessionSlug={getActiveSessionSlugFromProps(this.props)}
          defaultFilterState={this.props.defaultFilterState}
          defaultTags={this.props.defaultTags}
          defaultFeaturedSBTs={this.props.defaultFeaturedSBTs}
          isQuestionCacheReady={this.props.isQuestionCacheReady}
          isSurveyCacheReady={this.props.isSurveyCacheReady}
          isSBTCacheReady={this.props.isSBTCacheReady}
          questionResponsesNonce={this.props.questionResponsesNonce}
          questionsCacheNonce={this.props.questionsCacheNonce}
          storageKeyPrefix={buildQuestionFilterStorageKeyPrefix(this.props, resolveEffectiveSlug(this.props))}
        />
      </div>
    );
  }
}

export default SurveyTool;
