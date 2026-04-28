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
  InputGroup,
  InputGroupText,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { Link } from 'react-router-dom';
// Styles
import "../../assets/css/contextEngine.scss";
import styles from './SurveyTool.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUnlock, faPlus, faMinus, faCaretDown, faCaretUp, faCheck, faTimes, faArrowLeft, faArrowRight, faSpinner, faExternalLinkAlt, faFilter, faExclamationCircle, faMicrophone, faChevronLeft, faChevronRight, faComment, faRobot } from '@fortawesome/free-solid-svg-icons';

import CreateQuestionsAndSurveys from './CreateQuestionsAndSurveys';
import SurveyResults from './SurveyResults';
import QuestionFilter from './QuestionFilter';
import PileHologramAssistant from './PileHologramAssistant';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import SingleQuestionResponse from './SingleQuestionResponse';
import TagModal from '../TagPage/TagModal';
import BinaryChoiceInput from './BinaryChoiceInput';
import BullhornToggleButton from './BullhornToggleButton';
import ConvictionImportanceLabel from './ConvictionImportanceLabel';
import ConvictionImportanceSliderControl from './ConvictionImportanceSliderControl';
import DeferredConvictionImportanceSlider from './DeferredConvictionImportanceSlider';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import FullQuestionHeader from './FullQuestionHeader';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import GatedPromptNotice from './GatedPromptNotice';
import MultichoiceQuestionInput from './MultichoiceQuestionInput';
import QuestionDecryptControl from './QuestionDecryptControl';
import QuestionCardLinks from './QuestionCardLinks';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import {
  applyDecryptedQuestionResponseValues as applyDecryptedQuestionResponseValuesHelper,
  applyDecryptedQuestionResponseValuesToContainer as applyDecryptedQuestionResponseValuesToContainerHelper,
  applyDecryptedQuestionStateToSurveySlice as applyDecryptedQuestionStateToSurveySliceHelper,
  buildAutoDecryptMaskedFieldSignature as buildAutoDecryptMaskedFieldSignatureHelper,
  buildDecryptTaskKey as buildDecryptTaskKeyHelper,
  buildFieldDecryptState as buildFieldDecryptStateHelper,
  buildQuestionDecryptExecutionContext as buildQuestionDecryptExecutionContextHelper,
  buildQuestionDecryptFailureState as buildQuestionDecryptFailureStateHelper,
  buildQuestionFieldDisplayState as buildQuestionFieldDisplayStateHelper,
  buildQuestionDecryptStartState as buildQuestionDecryptStartStateHelper,
  buildQuestionResponseDisplayState as buildQuestionResponseDisplayStateHelper,
  buildQuestionRenderDisplayState as buildQuestionRenderDisplayStateHelper,
  buildSurveyDecryptExecutionContext as buildSurveyDecryptExecutionContextHelper,
  buildSurveyDecryptSourceState as buildSurveyDecryptSourceStateHelper,
  buildSurveyDecryptSuccessState as buildSurveyDecryptSuccessStateHelper,
  buildEmptyQuestionDecryptSlice as buildEmptyQuestionDecryptSliceHelper,
  buildSelfQuestionDecryptBaseline as buildSelfQuestionDecryptBaselineHelper,
  buildSelfQuestionDecryptSuccessState as buildSelfQuestionDecryptSuccessStateHelper,
  clearQuestionFieldBusyMap as clearQuestionFieldBusyMapHelper,
  collectQuestionRatingEnvelopesByQid as collectQuestionRatingEnvelopesByQidHelper,
  buildViewedResponseDecryptSuccessState as buildViewedResponseDecryptSuccessStateHelper,
  buildViewedResponseDecryptBaseline as buildViewedResponseDecryptBaselineHelper,
  decryptQuestionRatingEnvelopeMap as decryptQuestionRatingEnvelopeMapHelper,
  decryptQuestionRatingEnvelopes as decryptQuestionRatingEnvelopesHelper,
  ensureQuestionDecryptSliceShape as ensureQuestionDecryptSliceShapeHelper,
  finalizeSurveyDecryptAttempt as finalizeSurveyDecryptAttemptHelper,
  finalizeQuestionDecryptAttempt as finalizeQuestionDecryptAttemptHelper,
  getViewedResponseOverrideForQuestion as getViewedResponseOverrideForQuestionHelper,
  getQuestionFieldDecryptSelection as getQuestionFieldDecryptSelectionHelper,
  getQuestionFieldTaskKey as getQuestionFieldTaskKeyHelper,
  getQuestionFieldTaskKeys as getQuestionFieldTaskKeysHelper,
  getQuestionRatingEnvelopes as getQuestionRatingEnvelopesHelper,
  hydrateLatestQuestionDecryptState as hydrateLatestQuestionDecryptStateHelper,
  markQuestionFieldBusyMap as markQuestionFieldBusyMapHelper,
  mergeLatestEncryptedQuestionFields as mergeLatestEncryptedQuestionFieldsHelper,
  mergeQuestionRatingEnvelopeState as mergeQuestionRatingEnvelopeStateHelper,
  mergeQuestionResponseOverrideIntoDecryptSlice as mergeQuestionResponseOverrideIntoDecryptSliceHelper,
  carryForwardSurveyQuestionRatings as carryForwardSurveyQuestionRatingsHelper,
  normalizeBulkDecryptedSliceForSurveyState as normalizeBulkDecryptedSliceForSurveyStateHelper,
  normalizeSingleQuestionViewedResponse as normalizeSingleQuestionViewedResponseHelper,
  parseEncryptedEnvelope as parseEncryptedEnvelopeHelper,
  prepareQuestionDecryptAttempt as prepareQuestionDecryptAttemptHelper,
  prepareSurveyDecryptAttempt as prepareSurveyDecryptAttemptHelper,
  prepareSelfQuestionDecryptState as prepareSelfQuestionDecryptStateHelper,
  prepareViewedQuestionDecryptState as prepareViewedQuestionDecryptStateHelper,
  resolveQuestionDecryptHandlingMode as resolveQuestionDecryptHandlingModeHelper,
  resolveLatestSurveyDecryptResponse as resolveLatestSurveyDecryptResponseHelper,
  resolveDecryptSurveyId as resolveDecryptSurveyIdHelper,
  runDedupedDecryptTask as runDedupedDecryptTaskHelper,
  syncDecryptedQuestionIntoBaseline as syncDecryptedQuestionIntoBaselineHelper,
} from './surveyToolDecryptFlow.js';
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
import { buildQuestionDecryptContextForSession } from '../../utilities/session/sessionQuestionDecryption.js';
import {
  buildQuestionRoutePath,
  isMaskedQuestionPayload,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
  pickBetterQuestionPayload,
  shouldRetryMaskedQuestionRefresh,
} from '../../utilities/survey/questionRouting.js';
import {
  sanitizeQuestionPromptForResponsePayload,
  sanitizeSurveyTitleForResponsePayload,
} from '../../utilities/arweave/noLeakPayloads.js';
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
  buildAnswerLockDisplayState,
  buildGatedPromptNoticeState,
  buildLockAudienceButtonAction,
  buildLockAudienceDisplayState,
  isQuestionPromptMasked as isQuestionPromptMaskedHelper,
} from './surveyToolViewState.js';
import {
  buildCanDecryptOtherResponsesSnapshot,
  buildResponseGateConfigSignature,
  resolveCanDecryptOtherResponsesVerdict,
} from './surveyToolResponseAccess';
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
  buildDraftAnswersByQuestionId,
  loadDraftAnswersByQuestionIdSafely,
  buildDraftHydrationPatchForQuestion,
  shouldSkipDraftHydrationRun,
  buildDraftHydrationSeedContext,
  buildDraftHydrationRunPlan,
  resolveLocalCacheSliceLookup,
  buildCacheHydrationSlice,
  buildDraftHydrationUpdatePlan,
  buildDraftAwareCacheHydrationState,
  buildDraftHydrationState,
  buildExitEditingStatePatch,
  buildHydratedResponseSlice,
  buildInitializedSurveyResponseState,
  buildLocalCacheRehydrationUpdatePlan,
  loadLocalCacheHydrationSlice,
  prepareLocalCacheRehydrateRun,
  buildRevertPendingStatePatch,
  buildResetFormStatePatch,
  buildPrefilledSingleQuestionUpdatePlan,
  buildPrefilledSurveyUpdatePlan,
  applyPriorResponseFetchSuccessEffects,
  buildPriorResponseFetchPlan,
  clearPriorResponseAttemptedKeys,
  executePriorResponseFetchPlan,
  buildGroupedRenderedResponseScopePlan,
  resolveLocalCacheHydrationSignatureLookup,
  loadMissingResponseIdsForScope,
  loadGroupedMissingResponseRequests,
  trackPriorResponseAttemptedKeys,
  buildMissingRenderedResponseResult,
  loadMissingRenderedResponseInfo,
  resolveMissingRenderedResponseLookup,
  buildNormalizedRenderedQuestionIds,
  resolveQuestionSlugMapLookup,
  resolveExitEditingBaselineSlice,
  resolveRevertPendingBaselineSlice,
  shouldBackfillPriorResponses,
  buildStartFreshSurveyState,
  buildLocalCacheHydrationMemoKey,
  prepareLocalCacheSliceBuild,
  buildMergedSurveyResponseState,
  buildMergedHydrationQuestionResponses,
  buildLocalCacheRehydrationState,
  buildPrefilledSingleQuestionState,
  buildPrefilledSurveyState,
  buildQuestionSlugMapForIds,
  applyResetFormStateEffects,
  applyRevertPendingEffects,
  applyStartFreshEffects,
  applyDraftHydrationEffects,
  applyPrefillUpdatePlan,
  applyLocalCacheRehydrateUpdatePlan,
  applyLocalCacheRehydrateMissEffects,
  runPriorResponseBackfillAttempt,
  buildRevertedResponseSlice,
  buildSubmissionGroupContext,
  buildSurveyResponseStateArray,
  buildPersistedDraftQuestionRemovalPlan,
  buildPersistedDraftTrackingAfterLoad,
  buildPersistedDraftTrackingAfterScopedDelete,
  buildPersistedDraftTrackingAfterWrite,
  buildPersistedDraftTrackingClearedState,
  buildPersistedDraftTrackingOnKeyChange,
  buildPersistedDraftWritePlan,
  buildPersistDraftAllowedQuestionIds,
  buildQuestionCacheHydrationPatch,
  buildQuestionResponseHydrationPatch,
  loadPreviousPersistedDraftSnapshot,
  parsePersistedDraftStorageValue,
  buildPersistedDraftPayload,
  buildPersistedDraftMapsForAllowedIds,
  buildRatingEnvelopeQidSetFromUserAnswers,
  buildSurveyDraftLoadPlan,
  buildSurveyDraftCompatScope,
  buildSurveyDraftStorageKey,
  buildSurveyDraftStorageVariantKeys,
  buildSliderModeStatePatch,
  buildSliderPersistOptions,
  buildRenderedIdsSignature,
  buildPersistedDraftQuestionEntry,
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
  getExtraQuestionReadSlugs,
  getHighlightedQuestionIdsSet,
  getImportanceFromResponse,
  getImportanceFromSlice,
  getNormalizedUiRatingValue,
  getPendingStatsSnapshotFromState,
  getQuestionConvictionSliderValue,
  getQuestionImportanceSliderValue,
  getQuestionSliderMode,
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
  shouldExpandSliderToggle,
  shouldAutoEncryptAdditionalOnAudienceChange,
  shouldEncryptResponseFieldForSubmit,
  shouldForceOverwriteDraftValues,
  shouldHandleStartFresh,
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

import { SurveySelector, QuestionsDashboard } from './SurveySelector';

import { PileViewMode, SurveyQuestions } from './SurveyQuestions';

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
export { DeferredCommitSlider } from './DeferredCommitSlider';

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



export { SurveyQuestions } from './SurveyQuestions';

export default SurveyTool;
