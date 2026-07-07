/** @file SurveyPileViewMode.tsx */

import React from 'react';
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  DropdownItem,
  FormGroup,
  Label,
  Input,
  InputGroup,
  InputGroupText,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { Link } from 'react-router-dom';
// Styles
import '../../assets/css/contextEngine.scss';
import styles from './SurveyTool.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLock,
  faUnlock,
  faCaretUp,
  faArrowLeft,
  faArrowRight,
  faExternalLinkAlt,
  faExclamationCircle,
  faMicrophone,
} from '@fortawesome/free-solid-svg-icons';

import QuestionFilter from './QuestionFilter';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import SingleQuestionResponse from './SingleQuestionResponse';
import TagModal from '../TagPage/TagModal';
import LazyFallback from '../Shared/LazyFallback';
import BinaryChoiceInput from './BinaryChoiceInput';
import DeferredRatingSlider from './DeferredRatingSlider';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import FullQuestionHeader from './FullQuestionHeader';
import FullQuestionRatingInput from './FullQuestionRatingInput';
import GatedPromptNotice from './GatedPromptNotice';
import MultichoiceQuestionInput from './MultichoiceQuestionInput';
import QuestionDecryptControl from './QuestionDecryptControl';
import QuestionCardLinks from './QuestionCardLinks';
import { extractSingleQuestionOptionsFromCandidate } from './singleQuestionResponseHelpers.js';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';
import {
  buildNoPendingPileSubmitFeedbackPlan,
  buildPileSubmitRailViewState,
  buildPileSubmitViewState,
  buildPileWorkspaceViewState,
  buildPileFilterActivePatch,
  buildPileLoadingElapsedPatch,
  buildPileLoadingPatch,
  buildPileNavCounterVisiblePatch,
  buildPileShowLongLoadingPatch,
  buildPileSubmissionCompletePatch,
  buildPileSubmitTempTextPatch,
  resolveEarlyVisiblePileQuestions,
  shouldPreferPileGatedEmptyState,
  type EarlyVisiblePileQuestion,
} from './surveyPileViewState.js';
import {
  renderPileActiveQuestionCard,
  renderPileCardShell as renderPileCardShellView,
  renderPileGatedPromptCard as renderPileGatedPromptCardView,
} from './surveyPileActiveQuestionCard';
import {
  renderPileAdditionalEditorRow as renderPileAdditionalEditorRowView,
  renderPileCommentsSection as renderPileCommentsSectionView,
  renderPileQuestionIcons as renderPileQuestionIconsView,
  renderPileFooterSection as renderPileFooterSectionView,
} from './surveyPileQuestionSections';
import { renderPileInteractionSurface } from './surveyPileInteractionSurface';
import {
  buildPileBaselineCheckPlan,
  buildPileBaselineConsistencyPlan,
  buildPilePrefillReadPlan,
  readPileScopedQuestionResponses,
} from './surveyPileBaselineSync';
import {
  buildPileComponentUpdatePlan,
  buildPileContextResetState,
  buildPileQuestionProgressSignals,
  pickScopedPileQuestionProgress,
} from './surveyPileLifecycle';
import {
  buildPileEmptyProbeStatePlan,
  buildPileNoNetworkLoadPlan,
  buildPileResponseCountsCachePlan,
} from './surveyPileLoadController';
import {
  buildPileEmptyProbePlan,
  buildPileLoadFailureState,
  buildPileLoadProgressState,
} from './surveyPileLoadPlanner';
import { loadPileScopeCacheSnapshot } from './surveyPileScopeCacheData';
import { isPendingQuestionMetadataPlaceholder } from './surveyQuestionMetadataPlaceholders.js';
import {
  buildPileFilterResultPlan,
  buildPileLoadResultPlan,
  buildPileQuestionPipelineState,
} from './surveyPileQuestionFlow';
import { arePileQuestionListsEquivalent } from './surveyPileQuestionListEquivalence';
import { buildPileVisibleResponseSignature as buildPileVisibleResponseSignatureHelper } from './surveyPileResponseSignature';
import { buildPileVisibleQuestionIds } from './surveyPileVisibleQuestionIds';
import {
  buildPileCachePrefillStatePlan,
  executeEnsureVisiblePileResponseState,
  executePileInitializeResponseState,
  executePileQuestionSetHydration,
} from './surveyPileResponseController';
import type { PileResponseSlice } from './surveyPileResponseWindow';
import {
  buildClearedTransientSubmitFeedbackState,
  buildTransientSubmitFeedbackState,
  normalizeTransientSubmitFeedbackDurationMs,
} from './surveyQuestionSubmitFeedback.js';
import { buildRenderedQuestionIdsFromPileWindow } from './surveyQuestionScope.js';
import { buildListeningModeSearch, isListeningModeQueryEnabled } from '../../utilities/audio/rollingTranscription';
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
  getSessionSlugByName,
} from '../../utilities/web3/chainGateway.js';
import { ethers, utils } from 'ethers';
import CESlider from '../Shared/CESlider';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { serializeFilterState, deserializeFilterState } from '../../utilities/survey/filterStateUtils.js';
import { ENABLE_IMPORTANCE_SLIDER_TOGGLE } from '../../variables/appConfig.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createLogger } from 'utilities/logging.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import {
  SPONSORED_GATE_STATES,
  checkSponsoredAccess,
  getGateSbtAddresses,
  resolveSponsoredGateStateForResource,
} from '../../utilities/web3/sponsoredAccess.js';
import { resolveEncryptionGate } from '../../utilities/crypto/encryptionGates.js';
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
} from './surveyToolViewState.js';
import {
  buildCanDecryptOtherResponsesSnapshot,
  buildResponseGateConfigSignature,
  resolveCanDecryptOtherResponsesVerdict,
} from './surveyToolResponseAccess';
import { readSessionScanScope, readSessionScanSlugs } from '../../utilities/session/sessionScanScope.js';
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
import { resolvePayloadStorageRef } from '../../utilities/storage/storageRefs.js';
import { normalizeRatingValue, RATING_MAX, RATING_MIN } from '../../utilities/survey/ratingValue.js';

import {
  EMPTY_QUESTION_POOL,
  DEBUG_PREFILL,
  GATE_SBT_HYDRATION_RETRY_MS,
  QUESTION_TAG_DROPDOWN_ROW_STYLE,
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
  getConvictionFromSlice,
  getConvictionFromSliceStrict,
  getExtraQuestionReadSlugs,
  getHighlightedQuestionIdsSet,
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
  writeQuestionsCache,
  writeSurveysCache,
  bumpSurveyPerfCounter,
} from './surveyToolUtils';

import { SurveySelector, QuestionsDashboard } from './SurveySelector';
import {
  buildAutoDecryptDisabledState,
  buildBookmarkedQuestionsState,
  buildCanDecryptOtherResponsesState,
  buildClearedSurveyQuestionPoolState,
  buildInitialSurveyQuestionsState,
  buildSurveyQuestionPoolLoadState,
  isSurveyQuestionsMaskedPromptText,
  type SurveyQuestionsRuntimeEngine,
  type SurveyQuestionsRuntimeStrategy,
  type SurveyQuestionsProps,
  type SurveyQuestionsState,
} from './surveyQuestionsTypes.js';
import {
  appendMissingAuthoritativePoolQuestions,
  filterQuestionsByAuthoritativePool,
  resolveAuthoritativeQuestionPoolScope,
} from './surveyAuthoritativeQuestionPool';

import { SurveyQuestions } from './SurveyQuestions';

export const LazyPileCreateQuestionsAndSurveys = React.lazy(() => import('./CreateQuestionsAndSurveys'));
export const LazySessionListeningPanel = React.lazy(() => import('./SessionListeningPanel'));

export const buildPileRuntimeInitialState = (engine: SurveyQuestionsRuntimeEngine) => {
  const props = engine.props || {};
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
      surveyLog.error('PileViewMode: Error hydrating filter state', e);
    }
  }

  const nextState = {
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
    showListeningPanel:
      typeof window !== 'undefined' ? isListeningModeQueryEnabled(window.location.search || '') : false,
  };
  const warmSeedState = engine.buildWarmPileSeedState(props);
  if (warmSeedState) {
    Object.assign(nextState, warmSeedState);
  }

  engine._pileSubmitTimer = null;
  engine._navFadeTimer = null;
  engine.loadingTimeout = null;
  engine._loadingElapsedTimer = null;
  engine._loadingStartedAtMs = nextState.loading ? Date.now() : null;
  engine._loadAndSortDebounceTimer = null;
  engine._lastLoadAndSortResultSignature = '';
  engine._lastInitializeResponseSig = '';
  engine._lastNotifiedPileSubmitRailVisible = null;

  // Refs for auto-scrolling to newly opened sections
  engine.createSectionRef = React.createRef();
  engine.listeningPanelRef = React.createRef();

  return nextState;
};

export const createPileViewRuntimeStrategy = (): SurveyQuestionsRuntimeStrategy => ({
  buildInitialState: (engine) => buildPileRuntimeInitialState(attachPileViewRuntimeEngine(engine)),

  componentDidMount: (engine) => attachPileViewRuntimeEngine(engine).runPileComponentDidMount(),

  componentDidUpdate: (engine, prevProps, prevState) =>
    attachPileViewRuntimeEngine(engine).runPileComponentDidUpdate(prevProps, prevState),

  componentWillUnmount: (engine) => attachPileViewRuntimeEngine(engine).runPileComponentWillUnmount(),

  render: (engine) => attachPileViewRuntimeEngine(engine).renderPileViewMode(),

  getCurrentRenderedQuestionIds: (engine) => {
    engine = attachPileViewRuntimeEngine(engine);
    const pileQuestions = Array.isArray(engine.state?.pileQuestions) ? engine.state.pileQuestions : [];
    const activePileIndex = Number(engine.state?.activePileIndex || 0);
    const key = `${activePileIndex}|${pileQuestions.length}|${Number(engine._pileQuestionsGeneration || 0)}`;

    if (engine._currentRenderedQuestionIdsCache && engine._currentRenderedQuestionIdsCacheKey === key) {
      return engine._currentRenderedQuestionIdsCache;
    }

    const ids = buildRenderedQuestionIdsFromPileWindow({
      pileQuestions,
      activePileIndex,
    });

    engine._currentRenderedQuestionIdsCache = ids;
    engine._currentRenderedQuestionIdsCacheKey = key;
    return ids;
  },

  toggleComments: (engine, questionId) => {
    const normalizedQuestionId = String(questionId ?? '');
    return attachPileViewRuntimeEngine(engine).setState((prev: SurveyQuestionsState) => ({
      showComments: {
        ...prev.showComments,
        [normalizedQuestionId]: !prev.showComments[normalizedQuestionId],
      },
    }));
  },

  getAnsweredQuestionsCount: (engine) => attachPileViewRuntimeEngine(engine).getSubmitCount(),

  getPendingEditStats: (engine) => attachPileViewRuntimeEngine(engine).computePendingEditStatsAtIndex(0),

  showTransientSubmitFeedback: (engine, message = '', durationMs = 2000) => {
    engine = attachPileViewRuntimeEngine(engine);
    if (engine._emptySubmitTimer) {
      clearTimeout(engine._emptySubmitTimer);
      engine._emptySubmitTimer = null;
    }
    if (engine._pileSubmitTimer) {
      clearTimeout(engine._pileSubmitTimer);
      engine._pileSubmitTimer = null;
    }
    const update = buildTransientSubmitFeedbackState({
      message,
      mirrorToPileSubmitText: true,
    });
    engine.setState(update);
    if (!update.submissionError) return;
    engine._emptySubmitTimer = setTimeout(() => {
      if (!engine._isMounted) return;
      const clearUpdate = buildClearedTransientSubmitFeedbackState({
        mirrorToPileSubmitText: true,
      });
      engine.setState(clearUpdate);
      engine._emptySubmitTimer = null;
    }, normalizeTransientSubmitFeedbackDurationMs(durationMs));
  },
});

type PileViewModeEngine = SurveyQuestionsRuntimeEngine;
type PileQuestionRecord = {
  id?: string;
  creator?: unknown;
  tags?: unknown;
  type?: unknown;
  prompt?: unknown;
  promptDecrypted?: boolean;
  arweaveTxId?: unknown;
  singleSelect?: unknown;
  singleChoice?: unknown;
  options?: unknown;
  [key: string]: unknown;
};
type PileQuestionResponsesMap = Record<string, Record<string, unknown>>;
type PileControllerStateLike = Record<string, unknown> & {
  pileQuestions?: unknown;
  activePileIndex?: unknown;
  surveysResponseState?: Array<Partial<PileResponseSlice> | null | undefined>;
  editBaseline?: Partial<PileResponseSlice> | null;
};

const mergeQuestionResponsesForPile = mergeQuestionResponses as unknown as (
  target?: PileQuestionResponsesMap,
  source?: unknown,
) => PileQuestionResponsesMap;

const doesQuestionProgressMatchSlugForPile = doesQuestionProgressMatchSlug as unknown as (
  progressSlugValue: unknown,
  currentSlug: string,
) => boolean;

const createPileViewInstanceFields = () => ({
  _pileQuestionsGeneration: 0,
  _currentRenderedQuestionIdsCacheKey: '',
  _questionObjectSignatureCache: new WeakMap(),
  _questionListSignatureCache: new WeakMap(),
  _currentPileQuestionsSignature: '0:0',
  _currentPileQuestionsSignatureListRef: null,
  _responseCountsCacheKey: '',
  _responseCountsCacheValue: null,
  _emptyReadyProbeStartedAtMs: 0,
  _pileScanDisplayBaselineKey: '',
  _pileScanDisplayBaselineRemaining: 0,
  _lastGatedEmptyRecoveryKey: '',
});

const bindPileEngineMethod =
  <Args extends unknown[], Result>(
    engine: PileViewModeEngine,
    method: (engine: PileViewModeEngine, ...args: Args) => Result,
  ) =>
  (...args: Args): Result =>
    method(engine, ...args);

const bindPileMethod =
  <Args extends unknown[], Result>(method: (...args: Args) => Result) =>
  (...args: Args): Result =>
    method(...args);

const attachPileViewRuntimeEngine = (engine: PileViewModeEngine): PileViewModeEngine => {
  if (!engine || typeof engine !== 'object') return engine;
  if (!engine.__pileViewRuntimeFieldsInitialized) {
    Object.assign(engine, createPileViewInstanceFields());
    engine.__pileViewRuntimeFieldsInitialized = true;
  }
  Object.assign(engine, {
    buildWarmPileSeedState: bindPileEngineMethod(engine, buildWarmPileSeedState),
    getQuestionOptionsForInput: bindPileMethod(getQuestionOptionsForInput),
    buildQuestionOptionsDigest: bindPileEngineMethod(engine, buildQuestionOptionsDigest),
    getPileLoadingScanDisplay: bindPileEngineMethod(engine, getPileLoadingScanDisplay),
    getQuestionObjectSignature: bindPileEngineMethod(engine, getQuestionObjectSignature),
    mixQuestionListHash: bindPileEngineMethod(engine, mixQuestionListHash),
    buildQuestionListSignature: bindPileEngineMethod(engine, buildQuestionListSignature),
    getPileVisibleQuestionIds: bindPileEngineMethod(engine, getPileVisibleQuestionIds),
    buildPileVisibleResponseSignature: bindPileEngineMethod(engine, buildPileVisibleResponseSignature),
    syncCurrentPileQuestionsSignature: bindPileEngineMethod(engine, syncCurrentPileQuestionsSignature),
    areQuestionListsEquivalent: bindPileEngineMethod(engine, areQuestionListsEquivalent),
    isRecentRateLimit: bindPileEngineMethod(engine, isRecentRateLimit),
    getEffectivePileSessionConfig: bindPileEngineMethod(engine, getEffectivePileSessionConfig),
    hasRestrictedSessionQuestionGate: bindPileEngineMethod(engine, hasRestrictedSessionQuestionGate),
    maybeRecoverUnhydratedGatedPile: bindPileEngineMethod(engine, maybeRecoverUnhydratedGatedPile),
    isPileLoadingVisible: bindPileEngineMethod(engine, isPileLoadingVisible),
    shouldPreferGatedEmptyState: bindPileEngineMethod(engine, shouldPreferGatedEmptyState),
    syncLoadingElapsedTimer: bindPileEngineMethod(engine, syncLoadingElapsedTimer),
    scheduleLoadAndSortQuestions: bindPileEngineMethod(engine, scheduleLoadAndSortQuestions),
    runPileComponentDidMount: bindPileEngineMethod(engine, runPileComponentDidMount),
    runPileComponentDidUpdate: bindPileEngineMethod(engine, runPileComponentDidUpdate),
    runPileComponentWillUnmount: bindPileEngineMethod(engine, runPileComponentWillUnmount),
    handleViewAllFromPile: bindPileEngineMethod(engine, handleViewAllFromPile),
    triggerNavFade: bindPileEngineMethod(engine, triggerNavFade),
    handleNext: bindPileEngineMethod(engine, handleNext),
    handlePrev: bindPileEngineMethod(engine, handlePrev),
    toggleCreate: bindPileEngineMethod(engine, toggleCreate),
    syncListeningModeQuery: bindPileEngineMethod(engine, syncListeningModeQuery),
    shouldUseMobileListeningScroll: bindPileEngineMethod(engine, shouldUseMobileListeningScroll),
    scrollListeningPanelIntoViewIfNeeded: bindPileEngineMethod(engine, scrollListeningPanelIntoViewIfNeeded),
    toggleListeningPanel: bindPileEngineMethod(engine, toggleListeningPanel),
    closeListeningPanel: bindPileEngineMethod(engine, closeListeningPanel),
    toggleHologramAssistant: bindPileEngineMethod(engine, toggleHologramAssistant),
    toggleConviction: bindPileEngineMethod(engine, toggleConviction),
    openConvictionSlider: bindPileEngineMethod(engine, openConvictionSlider),
    checkCacheAgainstBaseline: bindPileEngineMethod(engine, checkCacheAgainstBaseline),
    prefillUserAnswersFromCache: bindPileEngineMethod(engine, prefillUserAnswersFromCache),
    loadAndSortQuestions: bindPileEngineMethod(engine, loadAndSortQuestions),
    shouldAbortPileHydrationRequest: bindPileEngineMethod(engine, shouldAbortPileHydrationRequest),
    resetPileAutoDecryptLedger: bindPileEngineMethod(engine, resetPileAutoDecryptLedger),
    rehydrateVisiblePileWindow: bindPileEngineMethod(engine, rehydrateVisiblePileWindow),
    runPileQuestionSetHydration: bindPileEngineMethod(engine, runPileQuestionSetHydration),
    initializeResponseState: bindPileEngineMethod(engine, initializeResponseState),
    ensureVisiblePileResponseState: bindPileEngineMethod(engine, ensureVisiblePileResponseState),
    handleAnswerPile: bindPileEngineMethod(engine, handleAnswerPile),
    handleAdditionalPile: bindPileEngineMethod(engine, handleAdditionalPile),
    getSubmitCount: bindPileEngineMethod(engine, getSubmitCount),
    showNoPendingPileSubmitFeedback: bindPileEngineMethod(engine, showNoPendingPileSubmitFeedback),
    handlePileSubmitClick: bindPileEngineMethod(engine, handlePileSubmitClick),
    getPileFilterQuestionResponses: bindPileEngineMethod(engine, getPileFilterQuestionResponses),
    toggleFilterModal: bindPileEngineMethod(engine, toggleFilterModal),
    handlePileFilterActivityChange: bindPileEngineMethod(engine, handlePileFilterActivityChange),
    handleFilter: bindPileEngineMethod(engine, handleFilter),
    getIsPileSubmitRailVisible: bindPileEngineMethod(engine, getIsPileSubmitRailVisible),
    notifyPileSubmitRailVisibility: bindPileEngineMethod(engine, notifyPileSubmitRailVisibility),
    renderPileResponseInput: bindPileEngineMethod(engine, renderPileResponseInput),
    renderPileSliderSection: bindPileEngineMethod(engine, renderPileSliderSection),
    renderPileAdditionalInput: bindPileEngineMethod(engine, renderPileAdditionalInput),
    renderPileAdditionalEditorRow: bindPileEngineMethod(engine, renderPileAdditionalEditorRow),
    renderPileCommentsSection: bindPileEngineMethod(engine, renderPileCommentsSection),
    renderPileQuestionIcons: bindPileEngineMethod(engine, renderPileQuestionIcons),
    renderPileFooterSection: bindPileEngineMethod(engine, renderPileFooterSection),
    renderPileCardShell: bindPileEngineMethod(engine, renderPileCardShell),
    renderPileGatedPromptCard: bindPileEngineMethod(engine, renderPileGatedPromptCard),
    renderActiveQuestion: bindPileEngineMethod(engine, renderActiveQuestion),
    renderPileViewMode: bindPileEngineMethod(engine, renderPileViewMode),
  });
  engine.__pileViewRuntimeMethodsAttached = true;
  return engine;
};

function buildWarmPileSeedState(engine: PileViewModeEngine, propsIn: any = engine.props) {
  try {
    if (!propsIn?.isQuestionCacheReady) return null;
    const slug = resolveEffectiveSlug(propsIn);
    const extraSlugs = getExtraQuestionReadSlugs(propsIn, slug);
    const context = resolvePileWarmSeedContext(propsIn, slug);
    const networkID = context.networkIdStr || '';
    if (!networkID) return null;

    const scopeSlugs = [slug, ...extraSlugs];
    const seenQuestionIds = new Set<string>();
    const hlSet = new Set<string>();
    const allQuestions: PileQuestionRecord[] = [];
    const allResponses: PileQuestionResponsesMap = {};
    scopeSlugs.forEach((scopeSlug: any) => {
      const questionsCache = readQuestionsCacheRef(scopeSlug) || {};
      const networkCache = questionsCache?.[networkID] || {};
      const blockedQuestionIds = getBlockedQuestionIdsSet(scopeSlug);
      getHighlightedQuestionIdsSet(scopeSlug).forEach((questionId: any) => {
        hlSet.add(String(questionId || '').toLowerCase());
      });
      mergeQuestionResponsesForPile(allResponses, networkCache.questionResponses || {});
      Object.keys(networkCache.questions || {}).forEach((questionId: any) => {
        const question = networkCache.questions?.[questionId];
        if (isPendingQuestionMetadataPlaceholder(question)) return;
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
    const authoritativeQuestionPoolScope = resolveAuthoritativeQuestionPoolScope(propsIn.questionPool, slug);
    const scopedQuestions = authoritativeQuestionPoolScope
      ? appendMissingAuthoritativePoolQuestions(
          filterQuestionsByAuthoritativePool(allQuestions, authoritativeQuestionPoolScope),
          authoritativeQuestionPoolScope,
          getBlockedQuestionIdsSet(slug),
        )
      : allQuestions;

    const responseCounts: Record<string, number> = {};
    for (const qId in allResponses) {
      responseCounts[qId] = Object.keys(allResponses[qId] || {}).length;
    }
    const byCountDesc = (a: any, b: any) => {
      const aCount = responseCounts[a.id?.toLowerCase?.()] || 0;
      const bCount = responseCounts[b.id?.toLowerCase?.()] || 0;
      return bCount - aCount;
    };

    const acctLower = (propsIn.account || '').toLowerCase();
    const isLoggedIn = !!acctLower;
    const highlighted: PileQuestionRecord[] = [];
    const unanswered: PileQuestionRecord[] = [];
    const answered: PileQuestionRecord[] = [];

    for (const q of scopedQuestions) {
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
    const sorted = isLoggedIn ? [...highlighted, ...unanswered, ...answered] : [...highlighted, ...unanswered];
    const hiddenGated = sorted.filter(
      (q: any) => q && isSurveyQuestionsMaskedPromptText(q?.prompt) && !q?.promptDecrypted,
    );
    const sortedVisible = sorted.filter(
      (q: any) => !(q && isSurveyQuestionsMaskedPromptText(q?.prompt) && !q?.promptDecrypted),
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

const getQuestionOptionsForInput = (question: any): string[] => {
  const labels = extractSingleQuestionOptionsFromCandidate(question);
  if (labels.length > 0) return labels;
  return Array.isArray(question?.options) ? question.options.map((option: any) => String(option)) : [];
};

const normalizePileQuestionInputType = (question: any): string => {
  const type = String(question?.type || '')
    .trim()
    .toLowerCase();
  if (type === 'poll' && getQuestionOptionsForInput(question).length > 0) return 'multichoice';
  return type;
};

const isPollSingleSelectQuestion = (question: any): boolean => {
  if (
    String(question?.type || '')
      .trim()
      .toLowerCase() !== 'poll'
  )
    return false;
  return question?.singleSelect !== false && question?.singleChoice !== false;
};

const buildQuestionOptionsDigest = (engine: PileViewModeEngine, options: any) => {
  if (!Array.isArray(options) || options.length === 0) return '0:0';
  let hash = 2166136261;
  options.forEach((option: any) => {
    const normalized =
      typeof option === 'string'
        ? option
        : option && typeof option === 'object'
          ? (typeof option.value === 'string' && option.value) ||
            (typeof option.label === 'string' && option.label) ||
            ''
          : String(option ?? '');
    hash = engine.mixQuestionListHash(hash, normalized);
  });
  return `${options.length}:${hash >>> 0}`;
};

const getPileLoadingScanDisplay = (engine: PileViewModeEngine, questionScanProgress: any, scanProgressDisplay: any) => {
  const baseDisplay =
    scanProgressDisplay && typeof scanProgressDisplay === 'object'
      ? scanProgressDisplay
      : buildQuestionScanProgressDisplay(questionScanProgress);
  const phase = String(questionScanProgress?.phase || '').toLowerCase();
  if (phase !== 'scan') {
    engine._pileScanDisplayBaselineKey = '';
    engine._pileScanDisplayBaselineRemaining = 0;
    return baseDisplay;
  }

  const remainingBlocks = Math.max(0, Number(baseDisplay?.remainingBlocks || 0));
  const baselineKey = [
    normalizeQuestionProgressSlug(questionScanProgress?.slug || resolveEffectiveSlug(engine.props)),
    String(questionScanProgress?.phase || ''),
    Number(questionScanProgress?.startedAtMs || 0),
    Number(questionScanProgress?.fromBlock || 0),
    Number(questionScanProgress?.requestedTotalBlocks || questionScanProgress?.totalBlocks || 0),
  ].join('|');

  if (
    engine._pileScanDisplayBaselineKey !== baselineKey ||
    !Number.isFinite(Number(engine._pileScanDisplayBaselineRemaining)) ||
    Number(engine._pileScanDisplayBaselineRemaining) <= 0
  ) {
    engine._pileScanDisplayBaselineKey = baselineKey;
    engine._pileScanDisplayBaselineRemaining = remainingBlocks;
  }

  const baselineRemaining = Math.max(
    remainingBlocks,
    Math.max(0, Number(engine._pileScanDisplayBaselineRemaining || 0)),
  );
  const scannedThisRefresh = Math.max(0, baselineRemaining - remainingBlocks);
  const percentComplete =
    baselineRemaining > 0 ? Math.max(0, Math.min(100, Math.round((scannedThisRefresh / baselineRemaining) * 100))) : 0;

  return {
    ...baseDisplay,
    percentComplete,
    metaRightText: `${formatQuestionScanBlockCount(scannedThisRefresh)} / ${formatQuestionScanBlockCount(baselineRemaining)}`,
  };
};

const getQuestionObjectSignature = (engine: PileViewModeEngine, question: any) => {
  if (!question || typeof question !== 'object') return String(question ?? '');
  try {
    const cached = engine._questionObjectSignatureCache.get(question);
    if (cached) return cached;
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  const sig = [
    String(question.id || '')
      .trim()
      .toLowerCase(),
    String(question.type || '')
      .trim()
      .toLowerCase(),
    String(question.prompt || ''),
    question.promptDecrypted ? '1' : '0',
    String(resolvePayloadStorageRef(question)?.id || question.arweaveTxId || ''),
    engine.buildQuestionOptionsDigest(engine.getQuestionOptionsForInput(question)),
  ].join('|');
  try {
    engine._questionObjectSignatureCache.set(question, sig);
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  return sig;
};

const mixQuestionListHash = (engine: PileViewModeEngine, seed: any, text: any) => {
  let h = Number(seed) >>> 0;
  const str = String(text || '');
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  }
  return h >>> 0;
};

const buildQuestionListSignature = (engine: PileViewModeEngine, list: any = []) => {
  if (!Array.isArray(list) || list.length === 0) return '0:0';
  try {
    const cached = engine._questionListSignatureCache.get(list);
    if (cached) return cached;
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  let hash = 2166136261;
  list.forEach((question: any) => {
    hash = engine.mixQuestionListHash(hash, engine.getQuestionObjectSignature(question));
  });
  const signature = `${list.length}:${hash >>> 0}`;
  try {
    engine._questionListSignatureCache.set(list, signature);
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  return signature;
};

const getPileVisibleQuestionIds = (_engine: PileViewModeEngine, listIn: any = [], activeIndexIn: any = 0) =>
  buildPileVisibleQuestionIds({
    activePileIndex: activeIndexIn,
    normalizeQuestionIdKey,
    pileQuestions: listIn,
  });

const buildPileVisibleResponseSignature = (
  engine: PileViewModeEngine,
  questionResponses: any = {},
  visibleIds: any = [],
  accountIn: any = engine.props?.account,
) =>
  buildPileVisibleResponseSignatureHelper({
    account: accountIn,
    deps: {
      buildSliceToken,
      mixQuestionListHash: engine.mixQuestionListHash,
      normalizeQuestionIdKey,
    },
    questionResponses,
    visibleIds,
  });

const syncCurrentPileQuestionsSignature = (engine: PileViewModeEngine, listIn: any = engine.state?.pileQuestions) => {
  const list = Array.isArray(listIn) ? listIn : [];
  if (
    engine._currentPileQuestionsSignatureListRef === list &&
    typeof engine._currentPileQuestionsSignature === 'string' &&
    engine._currentPileQuestionsSignature
  ) {
    return engine._currentPileQuestionsSignature;
  }
  const signature = engine.buildQuestionListSignature(list);
  engine._currentPileQuestionsSignatureListRef = list;
  engine._currentPileQuestionsSignature = signature;
  return signature;
};

const areQuestionListsEquivalent = (engine: PileViewModeEngine, left: any = [], right: any = []) =>
  arePileQuestionListsEquivalent({
    getQuestionObjectSignature: engine.getQuestionObjectSignature,
    left,
    right,
  });

const isRecentRateLimit = (engine: PileViewModeEngine) => {
  try {
    const info = typeof window !== 'undefined' ? window.__LAST_RPC_RATE_LIMIT_ERROR__ : null;
    if (!info || !info.ts) return false;
    return Date.now() - info.ts < 2 * 60 * 1000;
  } catch (_) {
    return false;
  }
};

const getEffectivePileSessionConfig = (engine: PileViewModeEngine, propsIn: any = engine.props) => {
  const slug = resolveEffectiveSlug(propsIn);
  const context = resolvePileLoadContext(propsIn, slug);
  const resolvedConfig =
    context?.sessionConfig && typeof context.sessionConfig === 'object' ? context.sessionConfig : {};
  const propConfig = propsIn?.sessionConfig && typeof propsIn.sessionConfig === 'object' ? propsIn.sessionConfig : {};
  return {
    ...resolvedConfig,
    ...propConfig,
    __registry: {
      ...(resolvedConfig.__registry && typeof resolvedConfig.__registry === 'object' ? resolvedConfig.__registry : {}),
      ...(propConfig.__registry && typeof propConfig.__registry === 'object' ? propConfig.__registry : {}),
      gatesByResource: {
        ...(resolvedConfig.__registry &&
        typeof resolvedConfig.__registry === 'object' &&
        resolvedConfig.__registry.gatesByResource &&
        typeof resolvedConfig.__registry.gatesByResource === 'object'
          ? resolvedConfig.__registry.gatesByResource
          : {}),
        ...(propConfig.__registry &&
        typeof propConfig.__registry === 'object' &&
        propConfig.__registry.gatesByResource &&
        typeof propConfig.__registry.gatesByResource === 'object'
          ? propConfig.__registry.gatesByResource
          : {}),
      },
    },
  };
};

const hasRestrictedSessionQuestionGate = (engine: PileViewModeEngine, propsIn: any = engine.props) => {
  const cfg = engine.getEffectivePileSessionConfig(propsIn);
  const primaryState = resolveSponsoredGateStateForResource(cfg, 'questionResponses');
  if (primaryState?.status === SPONSORED_GATE_STATES.OPEN) return false;
  if (primaryState?.status === SPONSORED_GATE_STATES.RESTRICTED && primaryState.gate) return true;

  const defaultState = resolveSponsoredGateStateForResource(cfg, 'default');
  if (defaultState?.status === SPONSORED_GATE_STATES.RESTRICTED && defaultState.gate) return true;

  const legacyGate = resolveEncryptionGate(cfg);
  return getGateSbtAddresses(legacyGate).length > 0;
};

const buildPileSessionGateDetails = (engine: PileViewModeEngine, questionCount: any = 1) => {
  const cfg = engine.getEffectivePileSessionConfig(engine.props);
  const primaryState = resolveSponsoredGateStateForResource(cfg, 'questionResponses');
  const defaultState = resolveSponsoredGateStateForResource(cfg, 'default');
  const restrictedState = [primaryState, defaultState].find(
    (state: any) => state?.status === SPONSORED_GATE_STATES.RESTRICTED && state.gate,
  );
  const gate = restrictedState?.gate || resolveEncryptionGate(cfg);
  const sbtAddresses = getGateSbtAddresses(gate);
  if (!sbtAddresses.length) return [];

  const sessionSlug = normalizeSessionSlugValue(
    resolveEffectiveSlug(engine.props) ||
      (typeof engine._getEffectiveDraftSlug === 'function' ? engine._getEffectiveDraftSlug() : ''),
  );
  const count = Math.max(1, Number(questionCount || 0) || 1);
  const gateId = String(gate?.gateId || restrictedState?.resourceKey || 'session-gate').trim();
  const label = String(gate?.label || t('gate')).trim() || t('gate');
  const id = `session:${gateId}:${sbtAddresses
    .map((address: any) => address.toLowerCase())
    .sort()
    .join('|')}`;

  return [
    {
      id,
      label,
      sbtAddresses,
      questionIds: new Set(),
      questionCount: count,
      sessionSlug,
      sbts: sbtAddresses.map((address: any) => ({
        address,
        label: engine.resolveSbtGateLabel?.(address) || getShortenedAddress(address, false),
        href: buildSbtDetailPath(address, sessionSlug),
      })),
    },
  ];
};

const maybeRecoverUnhydratedGatedPile = (engine: PileViewModeEngine) => {
  if (typeof engine.props.refreshQuestionMetadata !== 'function') return false;
  if (!engine.hasRestrictedSessionQuestionGate(engine.props)) return false;
  if (Array.isArray(engine.state?.pileQuestions) && engine.state.pileQuestions.length > 0) return false;
  if (engine.state?.hasHiddenGatedQuestions) return false;

  const slug = resolveEffectiveSlug(engine.props);
  const progressSlug = normalizeQuestionProgressSlug(slug);
  const questionScanProgress =
    engine.props.questionScanProgress &&
    doesQuestionProgressMatchSlug(engine.props.questionScanProgress.slug, progressSlug)
      ? engine.props.questionScanProgress
      : null;
  const hydrateDiscovered = Math.max(0, Number(questionScanProgress?.discoveredQuestions || 0));
  const pendingMetadataCount = Math.max(0, Number(questionScanProgress?.pendingMetadataCount || 0));
  const shouldRecover = !!engine.props.isQuestionCacheReady || hydrateDiscovered > 0 || pendingMetadataCount > 0;
  if (!shouldRecover) return false;

  const forceDiscoveryRescan = !!engine.props.isQuestionCacheReady && !questionScanProgress;
  const recoveryKey = [
    normalizeSessionSlugValue(slug),
    String(engine.props.account || '')
      .trim()
      .toLowerCase(),
    Number(engine.props.questionsCacheNonce || 0),
    Number(engine.props.questionResponsesNonce || 0),
    forceDiscoveryRescan ? 'force' : 'retry',
    String(questionScanProgress?.phase || ''),
    hydrateDiscovered,
    pendingMetadataCount,
  ].join('|');
  if (engine._lastGatedEmptyRecoveryKey === recoveryKey) return false;
  engine._lastGatedEmptyRecoveryKey = recoveryKey;

  try {
    const maybePromise = engine.props.refreshQuestionMetadata({
      forceDiscoveryRescan,
    });
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch((err: any) => {
        surveyLog.warn('[pile] gated empty metadata recovery failed', err);
      });
    }
  } catch (err) {
    surveyLog.warn('[pile] gated empty metadata recovery failed', err);
    return false;
  }
  return true;
};

const isPileLoadingVisible = (engine: PileViewModeEngine) => {
  const slug = resolveEffectiveSlug(engine.props);
  const progressSlug = normalizeQuestionProgressSlug(slug);
  const questionScanProgress =
    engine.props.questionScanProgress &&
    doesQuestionProgressMatchSlug(engine.props.questionScanProgress.slug, progressSlug)
      ? engine.props.questionScanProgress
      : null;
  const scanRemainingBlocks = Math.max(0, Number(questionScanProgress?.remainingBlocks || 0));
  const hydrateDiscovered = Math.max(0, Number(questionScanProgress?.discoveredQuestions || 0));
  const hydrateDone = Math.max(0, Number(questionScanProgress?.hydratedQuestions || 0));
  const pendingMetadataCount = Math.max(0, Number(questionScanProgress?.pendingMetadataCount || 0));
  const hasPendingMetadataRetries = pendingMetadataCount > 0;
  const hasScanOrHydrationWork =
    !!questionScanProgress &&
    ((questionScanProgress?.phase === 'scan' && scanRemainingBlocks > 0) ||
      (questionScanProgress?.phase === 'hydrate' && (hydrateDone < hydrateDiscovered || hasPendingMetadataRetries)));
  const hydrationProgressSettled =
    !!questionScanProgress && questionScanProgress?.phase === 'hydrate' && hydrateDone >= hydrateDiscovered;
  const hasTerminalScanError = !!questionScanProgress && questionScanProgress?.phase === 'error';
  const firstBoot = !hasCacheHydratedFlag(engine.props);
  const hasVisibleQuestions = Array.isArray(engine.state?.pileQuestions) && engine.state.pileQuestions.length > 0;
  const isFilterActive = !!engine.state?.isFilterActive || isSurveyToolFilterStateActive(engine.state?.filterState);
  const hasFilterBaseQuestions =
    Array.isArray(engine.state?.allQuestionsForFilter) && engine.state.allQuestionsForFilter.length > 0;
  const recentRateLimit = engine.isRecentRateLimit();
  const hasSessionQuestionGate = engine.hasRestrictedSessionQuestionGate(engine.props);
  const hasUnhydratedGatedQuestions =
    hasSessionQuestionGate &&
    !hasVisibleQuestions &&
    !engine.state?.hasHiddenGatedQuestions &&
    (hydrateDiscovered > 0 || pendingMetadataCount > 0 || !!engine.props.isQuestionCacheReady);
  const preferGatedEmptyState = engine.shouldPreferGatedEmptyState({
    hasConcreteHiddenQuestions: !!engine.state.hasHiddenGatedQuestions,
    hasVisibleQuestions,
    firstBoot,
    recentRateLimit,
    hasPendingMetadataRetries,
  });
  const allowUnreadyEmptySettlement =
    (!hasVisibleQuestions &&
      !firstBoot &&
      engine.props.cacheHasLoaded !== false &&
      !engine.props.isQuestionCacheReady &&
      !recentRateLimit &&
      !hasScanOrHydrationWork &&
      !hasPendingMetadataRetries &&
      hydrationProgressSettled) ||
    preferGatedEmptyState ||
    hasUnhydratedGatedQuestions;
  const allowFilteredEmptySettlement =
    !hasVisibleQuestions && isFilterActive && hasFilterBaseQuestions && !engine.state?.hasHiddenGatedQuestions;
  return shouldShowPileFullLoadingState({
    loading: !!engine.state.loading,
    hasVisibleQuestions,
    firstBoot,
    isQuestionCacheReady: !!engine.props.isQuestionCacheReady,
    recentRateLimit,
    hasScanOrHydrationWork,
    allowUnreadyEmptySettlement,
    allowFilteredEmptySettlement,
    hasTerminalScanError,
  });
};

const shouldPreferGatedEmptyState = (
  engine: PileViewModeEngine,
  {
    hasConcreteHiddenQuestions = false,
    hasVisibleQuestions = false,
    firstBoot = false,
    recentRateLimit = false,
    hasPendingMetadataRetries = false,
  }: any = {},
) => {
  return shouldPreferPileGatedEmptyState({
    hasConcreteHiddenQuestions,
    hasVisibleQuestions,
    firstBoot,
    cacheHasLoaded: engine.props.cacheHasLoaded,
    recentRateLimit,
    hasPendingMetadataRetries,
  });
};

const syncLoadingElapsedTimer = (engine: PileViewModeEngine) => {
  const shouldRun = engine.isPileLoadingVisible();
  if (shouldRun) {
    if (!engine._loadingStartedAtMs) engine._loadingStartedAtMs = Date.now();
    if (!engine._loadingElapsedTimer) {
      engine._loadingElapsedTimer = setInterval(() => {
        const started = Number(engine._loadingStartedAtMs || Date.now());
        const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
        if (elapsed !== Number(engine.state.loadingElapsedSec || 0)) {
          engine.setState(buildPileLoadingElapsedPatch(elapsed));
        }
      }, 1000);
    }
    return;
  }

  if (engine._loadingElapsedTimer) {
    clearInterval(engine._loadingElapsedTimer);
    engine._loadingElapsedTimer = null;
  }
  engine._loadingStartedAtMs = null;
  if (engine.state.loadingElapsedSec !== 0) {
    engine.setState(buildPileLoadingElapsedPatch(0));
  }
};

const scheduleLoadAndSortQuestions = (engine: PileViewModeEngine, delayMs: any = 80) => {
  if (engine._loadAndSortDebounceTimer) {
    clearTimeout(engine._loadAndSortDebounceTimer);
    engine._loadAndSortDebounceTimer = null;
  }
  engine._loadAndSortDebounceTimer = setTimeout(
    () => {
      engine._loadAndSortDebounceTimer = null;
      engine.loadAndSortQuestions();
    },
    Math.max(0, Number(delayMs) || 0),
  );
};

const runPileComponentDidMount = (engine: PileViewModeEngine) => {
  engine._isMounted = true;
  engine.syncCurrentPileQuestionsSignature(engine.state.pileQuestions);
  engine.loadAndSortQuestions();
  engine.maybeRecoverUnhydratedGatedPile();
  engine.syncLoadingElapsedTimer();
  engine.notifyPileSubmitRailVisibility();
  if (engine.state.showListeningPanel) {
    engine.scrollListeningPanelIntoViewIfNeeded('auto');
  }
  // Start long-loading timer
  engine.loadingTimeout = setTimeout(() => {
    if (engine.state.loading || !engine.props.isQuestionCacheReady) {
      engine.setState(buildPileShowLongLoadingPatch(true));
    }
  }, 10000);
};

const runPileComponentDidUpdate = (engine: PileViewModeEngine, prevProps: any, prevState: any) => {
  const diffInputsChanged = engine.didEditDiffInputsChange(prevProps, prevState);
  if (diffInputsChanged) {
    engine.invalidateDiffCaches();
  }
  if (prevState.userAnswers !== engine.state.userAnswers) {
    engine._userAnswersSliceCache = { source: null, value: null };
  }

  const pendingStats = diffInputsChanged
    ? (typeof engine.getPendingEditStats === 'function' && engine.getPendingEditStats()) ||
      engine.getPendingStatsSnapshot()
    : engine.getPendingStatsSnapshot();
  engine.notifyPileSubmitRailVisibility();
  engine.emitPendingStats(pendingStats);
  if (diffInputsChanged) {
    engine.recalculateEditStats && engine.recalculateEditStats(pendingStats);
  }
  if (prevState.pileQuestions !== engine.state.pileQuestions) {
    engine.syncCurrentPileQuestionsSignature(engine.state.pileQuestions);
  }

  // Rebuild guard: never rebuild lists/slices while user has pending edits
  const hasLiveEdits =
    Number(pendingStats.total || 0) > 0 || engine.state.isDirty || (engine.state.modifiedCount || 0) > 0;
  const isOptimistic = engine.state.submissionComplete;

  // 1. Handle Account/Network changes (Reset context)
  const networkChanged = prevProps.network?.id !== engine.props.network?.id;
  const accountChanged = (prevProps.account || '').toLowerCase() !== (engine.props.account || '').toLowerCase();
  const providerChanged = prevProps.provider !== engine.props.provider;

  const cacheReadyTick =
    (prevProps.isQuestionCacheReady !== engine.props.isQuestionCacheReady && engine.props.isQuestionCacheReady) ||
    (prevProps.isResponsesCacheReady !== engine.props.isResponsesCacheReady && engine.props.isResponsesCacheReady);
  const cacheJustBecameReady = !prevProps.isResponsesCacheReady && engine.props.isResponsesCacheReady;
  const nonceTick = prevProps.questionsCacheNonce !== engine.props.questionsCacheNonce;
  const responseNonceTick = prevProps.questionResponsesNonce !== engine.props.questionResponsesNonce;
  const progressSlug = normalizeQuestionProgressSlug(resolveEffectiveSlug(engine.props));
  const previousQuestionProgress = pickScopedPileQuestionProgress({
    progress: prevProps.questionScanProgress,
    progressSlug,
    doesQuestionProgressMatchSlug: doesQuestionProgressMatchSlugForPile,
  });
  const nextQuestionProgress = pickScopedPileQuestionProgress({
    progress: engine.props.questionScanProgress,
    progressSlug,
    doesQuestionProgressMatchSlug: doesQuestionProgressMatchSlugForPile,
  });
  const progressSignals = buildPileQuestionProgressSignals({
    previousProgress: previousQuestionProgress,
    nextProgress: nextQuestionProgress,
  });
  const pileQuestionsChanged = prevState.pileQuestions !== engine.state.pileQuestions;
  const surveysResponseStateChanged = prevState.surveysResponseState !== engine.state.surveysResponseState;
  const commentsChanged = prevState.showComments !== engine.state.showComments;
  const autoDecryptBlocked = engine.isAutoDecryptBlocked();
  const autoDecryptJustEnabled = !prevState.autoDecryptEnabled && engine.state.autoDecryptEnabled;

  const updatePlan = buildPileComponentUpdatePlan({
    networkChanged,
    accountChanged,
    cacheReadyTick,
    nonceTick,
    responseNonceTick,
    progressHydrationTick: progressSignals.progressHydrationTick,
    progressCompletedTick: progressSignals.progressCompletedTick,
    isOptimistic,
    hasLiveEdits,
    pileQuestionsLength: engine.state.pileQuestions.length,
    isQuestionCacheReady: engine.props.isQuestionCacheReady,
    loading: engine.state.loading,
    showLongLoading: engine.state.showLongLoading,
    providerChanged,
    autoDecryptBlocked,
    autoDecryptEnabled: engine.state.autoDecryptEnabled,
    pileQuestionsChanged,
    surveysResponseStateChanged,
    cacheJustBecameReady,
    autoDecryptJustEnabled,
    commentsChanged,
  });

  if (updatePlan.shouldResetContext) {
    // Persist draft before reset so it survives the login transition
    try {
      engine.persistDraft();
    } catch (e) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    engine._lastLoadAndSortResultSignature = '';
    engine._lastInitializeResponseSig = '';
    engine._emptyReadyProbeStartedAtMs = 0;

    // If context changes, we must reset optimistic flags and reload immediately
    // We do engine regardless of edits because the context (wallet/chain) invalidates the current session
    engine.setState(
      buildPileContextResetState({
        submittedSinceLastEdit: engine.state.submittedSinceLastEdit,
      }),
      () => {
        if (engine._loadAndSortDebounceTimer) {
          clearTimeout(engine._loadAndSortDebounceTimer);
          engine._loadAndSortDebounceTimer = null;
        }
        engine.loadAndSortQuestions();
      },
    );

    // Always reset auto-decrypt on context change
    engine._autoDecQueue = [];
    engine._autoDecProcessing = false;
    engine._autoDecryptMaskedAttemptSignature = {};
    engine.clearAutoDecryptSweepScheduling();
    if (engine.state.autoDecryptEnabled) {
      engine.setState(buildAutoDecryptDisabledState());
    }
    engine.syncLoadingElapsedTimer();
    return;
  }

  if (updatePlan.cacheUpdatePlan.action === 'check-optimistic-baseline') {
    // Optimistic guard: do not reload/wipe state yet. Check if cache has caught up.
    engine.checkCacheAgainstBaseline();
  } else if (updatePlan.cacheUpdatePlan.action === 'reload') {
    engine.scheduleLoadAndSortQuestions(updatePlan.cacheUpdatePlan.delayMs);
  } else if (updatePlan.cacheUpdatePlan.action === 'skip-live-edits') {
    bumpSurveyPerfCounter('noopSkipCount');
    surveyLog.debug('PileViewMode: skipped rebuild due to pending edits');
  } else if (updatePlan.cacheUpdatePlan.action === 'show-loading') {
    // Initial load spinner (guarded against loop)
    engine.setState(buildPileLoadingPatch(true));
  }

  // Clear long-loading if loaded
  if (updatePlan.shouldClearLongLoading) {
    engine.setState(buildPileShowLongLoadingPatch(false));
  }

  // 3. Auto-Decrypt Logic
  if (updatePlan.shouldDisableBlockedAutoDecrypt) {
    engine.resetBlockedAutoDecryptSweepInternals();
    if (
      engine.state.autoDecryptEnabled ||
      (engine.state.decryptingByKey && Object.keys(engine.state.decryptingByKey).length > 0)
    ) {
      engine.setState(buildAutoDecryptDisabledState());
    }
  }

  updatePlan.queueAutoDecryptReasons.forEach((reason: any) => {
    engine.queueAutoDecryptVisibleSweep(reason);
  });

  engine.maybeRecoverUnhydratedGatedPile();
  engine.syncLoadingElapsedTimer();
};

const runPileComponentWillUnmount = (engine: PileViewModeEngine) => {
  try {
    if (typeof engine.props.onPileSubmitRailVisibilityChange === 'function') {
      engine.props.onPileSubmitRailVisibilityChange(false);
    }
  } catch (e) {
    surveyLog.warn('SurveyTool: callback', e);
  }
  if (engine._pileSubmitTimer) {
    clearTimeout(engine._pileSubmitTimer);
    engine._pileSubmitTimer = null;
  }
  if (engine._navFadeTimer) {
    clearTimeout(engine._navFadeTimer);
    engine._navFadeTimer = null;
  }
  if (engine.loadingTimeout) {
    clearTimeout(engine.loadingTimeout);
  }
  if (engine._loadingElapsedTimer) {
    clearInterval(engine._loadingElapsedTimer);
    engine._loadingElapsedTimer = null;
  }
  if (engine._loadAndSortDebounceTimer) {
    clearTimeout(engine._loadAndSortDebounceTimer);
    engine._loadAndSortDebounceTimer = null;
  }
  engine._lastLoadAndSortResultSignature = '';
  engine._lastInitializeResponseSig = '';
  engine._emptyReadyProbeStartedAtMs = 0;
  engine._currentPileQuestionsSignature = '0:0';
  engine._currentPileQuestionsSignatureListRef = null;
  engine._questionListSignatureCache = new WeakMap();
  engine.runDefaultComponentWillUnmount();
};

const handleViewAllFromPile = (engine: PileViewModeEngine) => {
  if (engine._persistTimer) {
    clearTimeout(engine._persistTimer);
    engine._persistTimer = null;
  }
  try {
    engine.persistDraft();
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  if (typeof engine.props.onViewAllClick === 'function') {
    engine.props.onViewAllClick();
  }
};

const triggerNavFade = (engine: PileViewModeEngine) => {
  // Clear any existing timer so we always get a fresh 2s window
  if (engine._navFadeTimer) {
    clearTimeout(engine._navFadeTimer);
    engine._navFadeTimer = null;
  }

  // Show the counter immediately
  engine.setState(buildPileNavCounterVisiblePatch(true));

  // Schedule fade-out after 2 seconds
  engine._navFadeTimer = setTimeout(() => {
    engine.setState(buildPileNavCounterVisiblePatch(false));
    engine._navFadeTimer = null;
  }, 2000);
};

const handleNext = (engine: PileViewModeEngine) => {
  if (engine._persistTimer) {
    clearTimeout(engine._persistTimer);
    engine._persistTimer = null;
    engine.persistDraft();
  }
  engine.setState(
    (prev: any, props: any = engine.props) => {
      const fallbackQuestionPool =
        Array.isArray(prev.questionPool) && prev.questionPool.length > 0
          ? prev.questionPool
          : Array.isArray(props.questionPool)
            ? props.questionPool
            : [];
      const isFilterActive = !!prev.isFilterActive || isSurveyToolFilterStateActive(prev.filterState);
      const navigableQuestions = resolveEarlyVisiblePileQuestions({
        pileQuestions: prev.pileQuestions,
        questionPool: fallbackQuestionPool,
        isFilterActive,
      });
      return {
        activePileIndex: Math.min(Number(prev.activePileIndex || 0) + 1, Math.max(navigableQuestions.length - 1, 0)),
      };
    },
    () => {
      engine.ensureVisiblePileResponseState();
    },
  );
  engine.triggerNavFade();
};

const handlePrev = (engine: PileViewModeEngine) => {
  if (engine._persistTimer) {
    clearTimeout(engine._persistTimer);
    engine._persistTimer = null;
    engine.persistDraft();
  }
  engine.setState(
    (prev: any) => ({
      activePileIndex: Math.max(prev.activePileIndex - 1, 0),
    }),
    () => {
      engine.ensureVisiblePileResponseState();
    },
  );
  engine.triggerNavFade();
};

const toggleCreate = (engine: PileViewModeEngine) => {
  engine.setState(
    (prev: any) => ({ showCreate: !prev.showCreate }),
    () => {
      // Auto-scroll to the create section if it was just opened
      if (engine.state.showCreate && engine.createSectionRef.current) {
        try {
          engine.createSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
      }
    },
  );
};

const syncListeningModeQuery = (engine: PileViewModeEngine, enabled: any) => {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const nextSearch = buildListeningModeSearch(window.location.search || '', enabled);
    const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash || ''}`;
    window.history.replaceState({}, '', nextUrl);
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
};

const shouldUseMobileListeningScroll = (engine: PileViewModeEngine) => {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia('(max-width: 1100px)').matches;
    }
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  return Number(window.innerWidth || 0) > 0 && Number(window.innerWidth || 0) <= 1100;
};

const scrollListeningPanelIntoViewIfNeeded = (engine: PileViewModeEngine, behavior: any = 'smooth') => {
  if (!engine.state.showListeningPanel || !engine.shouldUseMobileListeningScroll()) return;
  const target = engine.listeningPanelRef?.current;
  if (!target || typeof target.scrollIntoView !== 'function') return;
  try {
    target.scrollIntoView({ behavior, block: 'start' });
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
};

const toggleListeningPanel = (engine: PileViewModeEngine) => {
  engine.setState(
    (prev: any) => ({ showListeningPanel: !prev.showListeningPanel }),
    () => {
      engine.syncListeningModeQuery(!!engine.state.showListeningPanel);
      engine.scrollListeningPanelIntoViewIfNeeded('smooth');
    },
  );
};

const closeListeningPanel = (engine: PileViewModeEngine) => {
  if (!engine.state.showListeningPanel) return;
  engine.setState({ showListeningPanel: false }, () => {
    engine.syncListeningModeQuery(false);
  });
};

const toggleHologramAssistant = (engine: PileViewModeEngine) => {
  return engine.setState((prev: any) => ({
    showHologramAssistant: !prev.showHologramAssistant,
  }));
};

const toggleConviction = (engine: PileViewModeEngine, questionId: any) => {
  return engine.setState((prev: any) => ({
    showConviction: {
      ...prev.showConviction,
      [questionId]: !prev.showConviction[questionId],
    },
  }));
};

const openConvictionSlider = (engine: PileViewModeEngine, questionId: any, mode: any) => {
  const nextMode = mode === 'importance' || mode === 'conviction' ? mode : engine.getSliderMode(questionId);
  engine.setSliderMode(questionId, nextMode);
  engine.setState((prev: any) => ({
    showConviction: {
      ...prev.showConviction,
      [questionId]: true,
    },
  }));
};

const checkCacheAgainstBaseline = (engine: PileViewModeEngine) => {
  const slug = resolveEffectiveSlug(engine.props);
  const pileResponseReadContext = resolvePileResponseReadContext(engine.props, slug);
  const effectiveSlug = pileResponseReadContext.sessionSlug || slug;
  const networkID = pileResponseReadContext.networkIdStr;
  const baselineCheckPlan = buildPileBaselineCheckPlan({
    submissionComplete: engine.state.submissionComplete,
    editBaseline: engine.state.editBaseline,
    networkIdStr: networkID,
    pileQuestions: engine.state.pileQuestions,
  });
  if (baselineCheckPlan.shouldSkip) return;

  const acctLower = (engine.props.account || '').toLowerCase();
  const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(engine.props, effectiveSlug)];
  const qRespMap = readPileScopedQuestionResponses({
    scopeSlugs,
    networkIdStr: networkID,
    readQuestionsCache,
    mergeQuestionResponses: mergeQuestionResponsesForPile,
  });
  const baselineConsistencyPlan = buildPileBaselineConsistencyPlan({
    baseline: engine.state.editBaseline,
    renderedIds: baselineCheckPlan.renderedIds,
    questionResponses: qRespMap,
    account: acctLower,
    valuesEqual: engine.valuesEqual,
  });

  if (baselineConsistencyPlan.action === 'sync-cache-caught-up') {
    surveyLog.log('PileViewMode: Cache caught up with baseline. Syncing.');
    engine.setState(buildPileSubmissionCompletePatch(false), () => {
      // Now it is safe to reload and wipe/rebuild state, as cache matches our optimistic view
      engine.loadAndSortQuestions();
    });
  } else {
    surveyLog.log('PileViewMode: Ignoring stale cache. Maintaining optimistic state.');
  }
};

const prefillUserAnswersFromCache = (engine: PileViewModeEngine) => {
  const slug = resolveEffectiveSlug(engine.props);
  const pileResponseReadContext = resolvePileResponseReadContext(engine.props, slug);
  const effectiveSlug = pileResponseReadContext.sessionSlug || slug;
  const networkID = pileResponseReadContext.networkIdStr;
  const prefillReadPlan = buildPilePrefillReadPlan({
    account: engine.props.account,
    isDirty: engine.state.isDirty,
    modifiedCount: engine.state.modifiedCount,
    networkIdStr: networkID,
    pileQuestions: engine.state.pileQuestions,
  });
  if (prefillReadPlan.shouldSkip) {
    if (prefillReadPlan.shouldBumpNoop) {
      bumpSurveyPerfCounter('noopSkipCount');
      surveyLog.debug('baseline-guard: skipped rebuild');
    }
    return;
  }

  const acctLower = (engine.props.account || '').toLowerCase();
  const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(engine.props, effectiveSlug)];
  const qRespMap = readPileScopedQuestionResponses({
    scopeSlugs,
    networkIdStr: networkID,
    readQuestionsCache,
    mergeQuestionResponses: mergeQuestionResponsesForPile,
  });

  const pendingStats = (typeof engine.getPendingEditStats === 'function' && engine.getPendingEditStats()) || {
    total: engine.state.modifiedCount || 0,
  };
  const prefillPlan = buildPileCachePrefillStatePlan({
    pileQuestions: engine.state.pileQuestions,
    questionResponsesByQuestionId: qRespMap,
    account: acctLower,
    currentSlice: engine.state.surveysResponseState?.[0] as Partial<PileResponseSlice> | null | undefined,
    editBaseline: engine.state.editBaseline,
    pendingTotal: pendingStats.total,
    cloneValue: engine.deepClone,
    applyCachedResponseEntryToSlice: ({
      targetSlice,
      questionId,
      response,
    }: {
      targetSlice: PileResponseSlice;
      questionId: string;
      response: Record<string, unknown>;
    }) =>
      engine._applyCachedResponseEntryToSlice({
        targetSlice,
        questionId,
        response,
        parseValue: engine.parseAnswerValue,
      }),
  });

  engine.setState(prefillPlan.nextState, () => engine.updateJsonPreview());
};

const loadAndSortQuestions = async (engine: PileViewModeEngine) => {
  bumpSurveyPerfCounter('loadAndSortQuestionsCount');
  const requestEpoch = Number(engine._loadAndSortQuestionsEpoch || 0) + 1;
  engine._loadAndSortQuestionsEpoch = requestEpoch;
  const slug = resolveEffectiveSlug(engine.props);
  const extraSlugs = getExtraQuestionReadSlugs(engine.props, slug);
  const scopeSlugs = [slug, ...extraSlugs];
  const scopeSignature = scopeSlugs.map((value: any) => normalizeSessionSlugValue(value)).join(',');
  const pileLoadContext = resolvePileLoadContext(engine.props, slug);
  const networkID = pileLoadContext.networkIdStr || '';
  const progressSlug = normalizeQuestionProgressSlug(slug);
  const scopedProgress =
    engine.props.questionScanProgress &&
    doesQuestionProgressMatchSlug(engine.props.questionScanProgress.slug, progressSlug)
      ? engine.props.questionScanProgress
      : null;
  const recentRateLimit = engine.isRecentRateLimit();
  const {
    scanTotalBlocks: scopedScanTotalBlocks,
    scanRemainingBlocks: scopedScanRemainingBlocks,
    hydrateDiscovered: scopedHydrateDiscovered,
    hydrateDone: scopedHydrateDone,
    hasScanOrHydrationWork,
    hydrationProgressSettled,
    canSettleUnreadyEmpty,
  } = buildPileLoadProgressState({
    scopedProgress,
    cacheHasLoaded: engine.props.cacheHasLoaded,
    isQuestionCacheReady: !!engine.props.isQuestionCacheReady,
    recentRateLimit,
  });

  // If no network ID, we can't load specific data, but we shouldn't hang if we can't determine it yet.
  if (!networkID) {
    // Optimistic Loading: If we have no ID, we are likely still initializing.
    if (requestEpoch !== engine._loadAndSortQuestionsEpoch) return;
    const noNetworkLoadPlan = buildPileNoNetworkLoadPlan({
      currentLoading: engine.state.loading,
      isQuestionCacheReady: !!engine.props.isQuestionCacheReady,
      recentRateLimit,
    });
    if (noNetworkLoadPlan.shouldClearLastResultSignature) {
      engine._lastLoadAndSortResultSignature = '';
    }
    if (noNetworkLoadPlan.shouldSkipStateUpdate) {
      bumpSurveyPerfCounter('noopSkipCount');
      return;
    }
    engine.setState(noNetworkLoadPlan.nextState);
    return;
  }

  try {
    const {
      allResponses: rawAllResponses,
      allQuestions: rawAllQuestions,
      highlightedQuestionIds: hlSet,
      pendingMetadataCount,
    } = await loadPileScopeCacheSnapshot({
      scopeSlugs,
      networkIdStr: networkID,
      readQuestionsCacheAsync,
      ensureQuestionsNet,
      getHighlightedQuestionIdsSet,
      mergeQuestionResponses: mergeQuestionResponsesForPile as any,
      getBlockedQuestionIdsSet,
      normalizeQuestionIdKey,
    });
    const allResponses = rawAllResponses as PileQuestionResponsesMap;
    const authoritativeQuestionPoolScope = resolveAuthoritativeQuestionPoolScope(engine.props.questionPool, slug);
    const allQuestions = authoritativeQuestionPoolScope
      ? appendMissingAuthoritativePoolQuestions(
          filterQuestionsByAuthoritativePool(rawAllQuestions, authoritativeQuestionPoolScope),
          authoritativeQuestionPoolScope,
          getBlockedQuestionIdsSet(slug),
        )
      : rawAllQuestions;
    // Read path only: avoid write-on-read feedback loops via questionsCacheNonce.
    if (requestEpoch !== engine._loadAndSortQuestionsEpoch) return;
    const hasPendingMetadataRetries = pendingMetadataCount > 0;
    const responseCountsCacheKey = `${scopeSignature}|${networkID}|${Number(engine.props.questionResponsesNonce || 0)}`;
    const responseCountsPlan = buildPileResponseCountsCachePlan({
      cacheKey: responseCountsCacheKey,
      previousCacheKey: engine._responseCountsCacheKey,
      previousCacheValue: engine._responseCountsCacheValue,
      questionResponses: allResponses,
    });
    const responseCounts = responseCountsPlan.responseCounts;
    engine._responseCountsCacheKey = responseCountsPlan.nextCacheKey;
    engine._responseCountsCacheValue = responseCountsPlan.nextCacheValue;

    // No defaultTags gating: sessions handle scoping; tags are for organization and user filtering.

    if (allQuestions.length > 0) {
      engine._emptyReadyProbeStartedAtMs = 0;
    }

    // Empty-settlement probe: on early refresh, cache can report ready before
    // question metadata lands. Keep loading and periodically re-check before
    // showing a definitive empty state.
    if (allQuestions.length === 0) {
      const emptyProbePlan = buildPileEmptyProbePlan({
        cacheHasLoaded: engine.props.cacheHasLoaded,
        isQuestionCacheReady: !!engine.props.isQuestionCacheReady,
        recentRateLimit,
        hasPendingMetadataRetries,
        hasScanOrHydrationWork,
        canSettleUnreadyEmpty,
        hydrationProgressSettled,
        scopedProgress,
        scanTotalBlocks: scopedScanTotalBlocks,
        scanRemainingBlocks: scopedScanRemainingBlocks,
        hydrateDiscovered: scopedHydrateDiscovered,
        hydrateDone: scopedHydrateDone,
        emptyReadyProbeStartedAtMs: engine._emptyReadyProbeStartedAtMs,
        nowMs: Date.now(),
      });
      const emptyProbeStatePlan = buildPileEmptyProbeStatePlan({
        action: emptyProbePlan.action,
        nextProbeStartedAtMs: emptyProbePlan.nextProbeStartedAtMs,
        nextProbeDelayMs: emptyProbePlan.nextProbeDelayMs,
        previousPileQuestions: engine.state.pileQuestions,
        previousAllQuestionsForFilter: engine.state.allQuestionsForFilter,
        previousLoading: engine.state.loading,
        areQuestionListsEquivalent: engine.areQuestionListsEquivalent,
      });
      engine._emptyReadyProbeStartedAtMs = emptyProbeStatePlan.nextProbeStartedAtMs;

      if (emptyProbeStatePlan.action !== 'settle-empty') {
        if (requestEpoch !== engine._loadAndSortQuestionsEpoch) return;
        if (emptyProbeStatePlan.shouldClearLastResultSignature) {
          engine._lastLoadAndSortResultSignature = '';
        }
        if (emptyProbeStatePlan.shouldBumpNoop) {
          bumpSurveyPerfCounter('noopSkipCount');
        } else if (emptyProbeStatePlan.shouldIncrementPileQuestionsGeneration) {
          engine._pileQuestionsGeneration += 1;
        }
        if (emptyProbeStatePlan.nextState) {
          engine.setState(emptyProbeStatePlan.nextState);
        }
        if (emptyProbeStatePlan.action === 'probe-loading') {
          engine.scheduleLoadAndSortQuestions(emptyProbeStatePlan.nextProbeDelayMs);
        }
        return;
      }
    }

    const acctLower = (engine.props.account || '').toLowerCase();
    const {
      sortedQuestions: sorted,
      visibleQuestions: sortedVisible,
      hiddenQuestions: hiddenGated,
      hasHiddenGatedQuestions: nextHidden,
    } = buildPileQuestionPipelineState({
      questions: allQuestions,
      questionResponses: allResponses,
      responseCounts,
      highlightedQuestionIds: hlSet,
      account: acctLower,
    });
    const filterSig = serializeSurveyToolFilterState(engine.state.filterState);
    const isFilterActive = !!engine.state.isFilterActive || !!filterSig;
    if (requestEpoch !== engine._loadAndSortQuestionsEpoch) return;
    const settleUnreadyEmpty = canSettleUnreadyEmpty && sortedVisible.length === 0;
    const loadResultPlan = buildPileLoadResultPlan({
      previousAllQuestionsForFilter: engine.state.allQuestionsForFilter,
      previousPileQuestions: engine.state.pileQuestions,
      previousActivePileIndex: engine.state.activePileIndex,
      previousHasHiddenGatedQuestions: engine.state.hasHiddenGatedQuestions,
      previousLoading: engine.state.loading,
      sortedQuestions: sorted,
      sortedVisibleQuestions: sortedVisible,
      hiddenQuestions: hiddenGated,
      hasHiddenGatedQuestions: nextHidden,
      isFilterActive,
      filterSig,
      questionResponses: allResponses,
      account: acctLower,
      settleUnreadyEmpty,
      isQuestionCacheReady: !!engine.props.isQuestionCacheReady,
      recentRateLimit,
      areQuestionListsEquivalent: engine.areQuestionListsEquivalent,
      buildQuestionListSignature: engine.buildQuestionListSignature,
      getPileVisibleQuestionIds: engine.getPileVisibleQuestionIds,
      buildPileVisibleResponseSignature: engine.buildPileVisibleResponseSignature,
    });
    if (loadResultPlan.shouldIncrementPileQuestionsGeneration) {
      engine._pileQuestionsGeneration += 1;
    }

    const runHydration = () => {
      engine.runPileQuestionSetHydration({
        requestEpoch,
        resultSignature: loadResultPlan.resultSignature,
        initializeResponses: !engine.state.submissionComplete,
        forceOverwriteDraft: true,
        resetAutoDecryptLedger: true,
        autoDecryptReason: 'pile-hydration',
        autoDecryptResetReason: 'pile-hydration-reset',
      });
    };

    if (!loadResultPlan.shouldUpdateState) {
      bumpSurveyPerfCounter('noopSkipCount');
      runHydration();
      return;
    }

    engine.setState(loadResultPlan.nextState, runHydration);
  } catch (e) {
    surveyLog.error('Failed to load/sort questions:', e);
    // Treat unexpected errors as warming state if we recently saw rate-limits
    if (requestEpoch !== engine._loadAndSortQuestionsEpoch) return;
    engine._lastLoadAndSortResultSignature = '';
    engine.setState(
      buildPileLoadFailureState({
        isQuestionCacheReady: !!engine.props.isQuestionCacheReady,
        recentRateLimit,
      }),
    );
  }
};

const shouldAbortPileHydrationRequest = (engine: PileViewModeEngine, requestEpoch: any = null) => {
  return requestEpoch !== null && requestEpoch !== undefined && requestEpoch !== engine._loadAndSortQuestionsEpoch;
};

const resetPileAutoDecryptLedger = (
  engine: PileViewModeEngine,
  { requestEpoch = null, queueReason = 'pile-hydration', resetQueueReason = 'pile-hydration-reset' }: any = {},
) => {
  if (engine.shouldAbortPileHydrationRequest(requestEpoch)) return;
  engine._autoDecQueue = [];
  engine._autoDecProcessing = false;

  const hasAutoDecryptLedger =
    Object.keys(engine.state.autoDecryptAttempted || {}).length > 0 ||
    Object.keys(engine.state.decryptingByKey || {}).length > 0;

  if (!hasAutoDecryptLedger) {
    if (engine.state.autoDecryptEnabled) {
      try {
        engine.queueAutoDecryptVisibleSweep(queueReason);
      } catch (e) {
        surveyLog.warn('SurveyTool: fallback', e);
      }
    }
    return;
  }

  engine.setState({ autoDecryptAttempted: {}, decryptingByKey: {} }, () => {
    if (engine.shouldAbortPileHydrationRequest(requestEpoch)) return;
    engine._autoDecryptMaskedAttemptSignature = {};
    if (engine.state.autoDecryptEnabled) {
      try {
        engine.queueAutoDecryptVisibleSweep(resetQueueReason);
      } catch (e) {
        surveyLog.warn('SurveyTool: fallback', e);
      }
    }
  });
};

const rehydrateVisiblePileWindow = (
  engine: PileViewModeEngine,
  {
    requestEpoch = null,
    forceOverwriteDraft = false,
    resetAutoDecryptLedger = false,
    autoDecryptReason = 'pile-hydration',
    autoDecryptResetReason = 'pile-hydration-reset',
  }: any = {},
) => {
  if (engine.shouldAbortPileHydrationRequest(requestEpoch)) return;
  engine.rehydrateLocalCacheAnswersForRenderedIds(() => {
    if (engine.shouldAbortPileHydrationRequest(requestEpoch)) return;
    if (typeof engine.rehydrateDraftForRenderedIds === 'function') {
      engine.rehydrateDraftForRenderedIds(forceOverwriteDraft);
    }
    if (!resetAutoDecryptLedger) return;
    engine.resetPileAutoDecryptLedger({
      requestEpoch,
      queueReason: autoDecryptReason,
      resetQueueReason: autoDecryptResetReason,
    });
  });
};

const runPileQuestionSetHydration = (
  engine: PileViewModeEngine,
  {
    requestEpoch = null,
    resultSignature = '',
    initializeResponses = true,
    forceOverwriteDraft = false,
    resetAutoDecryptLedger = false,
    autoDecryptReason = 'pile-hydration',
    autoDecryptResetReason = 'pile-hydration-reset',
  }: any = {},
) => {
  executePileQuestionSetHydration({
    requestEpoch,
    resultSignature,
    lastResultSignature: engine._lastLoadAndSortResultSignature,
    initializeResponses,
    forceOverwriteDraft,
    resetAutoDecryptLedger,
    autoDecryptReason,
    autoDecryptResetReason,
    shouldAbortRequest: (nextRequestEpoch: any) => engine.shouldAbortPileHydrationRequest(nextRequestEpoch),
    setLastResultSignature: (nextResultSignature: any) => {
      engine._lastLoadAndSortResultSignature = nextResultSignature;
    },
    initializeResponseState: (callback: any) => engine.initializeResponseState(callback),
    rehydrateVisiblePileWindow: (options: any) => engine.rehydrateVisiblePileWindow(options),
    onNoop: () => {
      bumpSurveyPerfCounter('noopSkipCount');
    },
  });
};

const initializeResponseState = (engine: PileViewModeEngine, cb: any) => {
  executePileInitializeResponseState({
    isDirty: engine.state.isDirty,
    modifiedCount: engine.state.modifiedCount,
    pileQuestions: engine.state.pileQuestions,
    activePileIndex: engine.state.activePileIndex,
    lastInitializeResponseSig: engine._lastInitializeResponseSig,
    buildEmptyResponseFieldState: engine.buildEmptyResponseFieldState,
    setLastInitializeResponseSig: (nextInitializeResponseSig: string) => {
      engine._lastInitializeResponseSig = nextInitializeResponseSig;
    },
    cloneValue: engine.deepClone,
    setState: engine.setState.bind(engine),
    onComplete: () => {
      if (typeof cb === 'function') cb();
    },
    onNoop: () => {
      bumpSurveyPerfCounter('noopSkipCount');
    },
  });
};

const ensureVisiblePileResponseState = (engine: PileViewModeEngine) => {
  executeEnsureVisiblePileResponseState({
    getState: () => engine.state as PileControllerStateLike,
    buildEmptyResponseFieldState: engine.buildEmptyResponseFieldState,
    setState: engine.setState.bind(engine),
    onRehydrateVisibleWindow: () => {
      engine.rehydrateVisiblePileWindow({
        forceOverwriteDraft: false,
        resetAutoDecryptLedger: false,
      });
    },
    onError: (error: unknown) => {
      surveyLog.error('ensureVisiblePileResponseState failed:', error);
    },
  });
};

const handleAnswerPile = (engine: PileViewModeEngine, questionId: any, answer: any, options: any = {}) => {
  engine.handleAnswer(0, questionId, answer, options);
};

const handleAdditionalPile = (engine: PileViewModeEngine, questionId: any, comments: any) => {
  engine.handleAdditional(0, questionId, comments);
};

const getSubmitCount = (engine: PileViewModeEngine) => {
  const stats = engine.getPendingEditStats?.() || engine.computePendingEditStatsAtIndex?.(0) || { total: 0 };
  return Number(stats.total || 0);
};

const showNoPendingPileSubmitFeedback = (engine: PileViewModeEngine, pileSubmitLabel: any = '') => {
  if (engine._pileSubmitTimer) {
    clearTimeout(engine._pileSubmitTimer);
    engine._pileSubmitTimer = null;
  }

  const feedbackPlan = buildNoPendingPileSubmitFeedbackPlan({
    submitLabel: pileSubmitLabel,
  });

  engine.setState(buildPileSubmitTempTextPatch(feedbackPlan.initialText));
  engine._pileSubmitTimer = setTimeout(() => {
    engine.setState(buildPileSubmitTempTextPatch(feedbackPlan.restoreText));
    engine._pileSubmitTimer = setTimeout(() => {
      engine.setState(buildPileSubmitTempTextPatch(feedbackPlan.clearText));
      engine._pileSubmitTimer = null;
    }, feedbackPlan.clearDelayMs);
  }, feedbackPlan.initialDelayMs);
};

const handlePileSubmitClick = async (engine: PileViewModeEngine) => {
  const pendingStats = engine.getPendingStatsSnapshot();
  const pileSubmitLabel = (engine.props.computeSubmitLabel || computeSubmitLabel)(engine, {
    pendingStats,
  });
  const { pileSubmittedStateActive } = buildPileSubmitViewState({
    pendingStats,
    isSubmitting: engine.state.isSubmitting,
    submittedSinceLastEdit: engine.state.submittedSinceLastEdit,
    submissionComplete: engine.state.submissionComplete,
    pileSubmitTempText: engine.state.pileSubmitTempText,
    pileSubmitLabel,
    account: engine.props.account,
    isAddress: utils.isAddress,
  });

  if (!engine.props.loginComplete) {
    await engine.encryptAndUpload();
    return;
  }
  if (pileSubmittedStateActive) return;
  const currentPending = engine.getSubmitCount();
  if (currentPending === 0) {
    engine.showNoPendingPileSubmitFeedback(pileSubmitLabel);
    return;
  }
  await engine.encryptAndUpload();
};

const getPileFilterQuestionResponses = (engine: PileViewModeEngine) => {
  const slug = resolveEffectiveSlug(engine.props);
  const pileFilterContext = resolvePileFilterContext(engine.props, slug);
  const effectiveSlug = pileFilterContext.sessionSlug || slug;
  const networkID = pileFilterContext.networkIdStr;
  const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(engine.props, effectiveSlug)];

  if (!networkID) return {};

  try {
    const mergedResponses: PileQuestionResponsesMap = {};
    scopeSlugs.forEach((scopeSlug: any) => {
      const questionsCache = readQuestionsCacheRef(scopeSlug) || {};
      mergeQuestionResponsesForPile(mergedResponses, questionsCache?.[networkID]?.questionResponses || {});
    });
    return mergedResponses;
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
    return {};
  }
};

const toggleFilterModal = (engine: PileViewModeEngine) => {
  return engine.setState((prev: any) => ({ filterModalOpen: !prev.filterModalOpen }));
};

const handlePileFilterActivityChange = (engine: PileViewModeEngine, isActive: any) => {
  if (!!engine.state.isFilterActive === !!isActive) return;
  engine.setState(buildPileFilterActivePatch(isActive));
};

const handleFilter = (engine: PileViewModeEngine, filteredQsOrCombined: any, newFilterState: any) => {
  let filteredArray = [];
  if (Array.isArray(filteredQsOrCombined)) {
    filteredArray = filteredQsOrCombined;
  } else if (filteredQsOrCombined && Array.isArray(filteredQsOrCombined.filteredQuestions)) {
    filteredArray = filteredQsOrCombined.filteredQuestions;
  } else {
    filteredArray = engine.state.allQuestionsForFilter;
  }

  // Remove blocked (per-group)
  const slug = resolveEffectiveSlug(engine.props);
  const pileFilterContext = resolvePileFilterContext(engine.props, slug);
  const effectiveSlug = pileFilterContext.sessionSlug || slug;
  const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(engine.props, effectiveSlug)];
  const BLOCKED_QUESTION_IDS_SET = new Set<string>();
  scopeSlugs.forEach((scopeSlug: any) => {
    getBlockedQuestionIdsSet(scopeSlug).forEach((questionId: any) => {
      BLOCKED_QUESTION_IDS_SET.add(String(questionId || '').toLowerCase());
    });
  });
  filteredArray = (filteredArray || []).filter(
    (q: any) => q && q.id && !BLOCKED_QUESTION_IDS_SET.has(String(q.id).toLowerCase()),
  );

  // Re-apply grouping/sorting for the filtered set
  const networkID = pileFilterContext.networkIdStr;

  let allResponses: PileQuestionResponsesMap = {};
  let responseCounts: Record<string, number> = {};
  const scopeSignature = scopeSlugs.map((value: any) => normalizeSessionSlugValue(value)).join(',');
  const responseCountsCacheKey = `${scopeSignature}|${networkID}|${Number(engine.props.questionResponsesNonce || 0)}`;
  try {
    if (networkID) {
      scopeSlugs.forEach((scopeSlug: any) => {
        const qObj = readQuestionsCacheRef(scopeSlug) || {};
        const qNet = qObj?.[networkID] || {};
        mergeQuestionResponsesForPile(allResponses, qNet?.questionResponses || {});
      });
      const responseCountsPlan = buildPileResponseCountsCachePlan({
        cacheKey: responseCountsCacheKey,
        previousCacheKey: engine._responseCountsCacheKey,
        previousCacheValue: engine._responseCountsCacheValue,
        questionResponses: allResponses,
      });
      responseCounts = responseCountsPlan.responseCounts;
      engine._responseCountsCacheKey = responseCountsPlan.nextCacheKey;
      engine._responseCountsCacheValue = responseCountsPlan.nextCacheValue;
    }
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }

  const hlSet = new Set<string>();
  scopeSlugs.forEach((scopeSlug: any) => {
    getHighlightedQuestionIdsSet(scopeSlug).forEach((questionId: any) => {
      hlSet.add(String(questionId || '').toLowerCase());
    });
  });
  const acctLower = (engine.props.account || '').toLowerCase();
  const { visibleQuestions: sortedFilteredVisible, hasHiddenGatedQuestions: nextHiddenGated } =
    buildPileQuestionPipelineState({
      questions: filteredArray,
      questionResponses: allResponses,
      responseCounts,
      highlightedQuestionIds: hlSet,
      account: acctLower,
    });
  const nextFilterState = normalizeSurveyToolFilterState(newFilterState || engine.state.filterState);
  const filterResultPlan = buildPileFilterResultPlan({
    currentVisibleSignature: engine.syncCurrentPileQuestionsSignature(engine.state.pileQuestions || []),
    nextVisibleQuestions: sortedFilteredVisible,
    currentFilterState: engine.state.filterState,
    nextFilterState,
    nextHiddenGated,
    currentHiddenGated: !!engine.state.hasHiddenGatedQuestions,
    buildQuestionListSignature: engine.buildQuestionListSignature,
    serializeFilterState: serializeSurveyToolFilterState,
  });

  if (filterResultPlan.shouldSkipStateUpdate) {
    bumpSurveyPerfCounter('noopSkipCount');
    return;
  }

  if (filterResultPlan.shouldIncrementPileQuestionsGeneration) {
    engine._pileQuestionsGeneration += 1;
  }
  engine.setState(filterResultPlan.nextState, () => {
    if (typeof engine.props.onFilterChange === 'function') {
      try {
        engine.props.onFilterChange(engine.state.filterState);
      } catch (e) {
        surveyLog.warn('SurveyTool: callback', e);
      }
    }
    // Ensure state is initialized and hydrated for the new set of filtered questions.
    // This keeps edit baselines and prefilled answers aligned with the active pile window.
    engine.runPileQuestionSetHydration({
      initializeResponses: true,
      forceOverwriteDraft: true,
      resetAutoDecryptLedger: true,
      autoDecryptReason: 'pile-filter-reset',
      autoDecryptResetReason: 'pile-filter-reset',
    });
  });
};

const getIsPileSubmitRailVisible = (engine: PileViewModeEngine) => {
  const pendingStats = engine.getPendingStatsSnapshot?.() || { total: 0 };
  return !!(
    engine.state.isSubmitting ||
    Number(pendingStats.total || 0) > 0 ||
    engine.state.submittedSinceLastEdit ||
    engine.state.submissionComplete
  );
};

const notifyPileSubmitRailVisibility = (engine: PileViewModeEngine) => {
  const nextVisible = engine.getIsPileSubmitRailVisible();
  if (engine._lastNotifiedPileSubmitRailVisible === nextVisible) return;
  engine._lastNotifiedPileSubmitRailVisible = nextVisible;
  try {
    if (typeof engine.props.onPileSubmitRailVisibilityChange === 'function') {
      engine.props.onPileSubmitRailVisibilityChange(nextVisible);
    }
  } catch (e) {
    surveyLog.warn('SurveyTool: callback', e);
  }
};

const renderPileResponseInput = (
  engine: PileViewModeEngine,
  { question, answer, glowAnswer, maskedAnswer, allowDecryptAnswer, decryptTooltip, isAnswerDecrypting }: any,
) => {
  if (maskedAnswer) {
    return engine.renderQuestionFieldDecryptControl({
      questionId: question.id,
      fieldKey: 'answer',
      allowDecrypt: allowDecryptAnswer,
      decryptTooltip,
      actionLabel: 'Decrypt Answer',
      busy: isAnswerDecrypting,
      showBusySpinnerWhenAutoDecryptEnabled: true,
      wrapperStyle: { marginBottom: 8 },
    });
  }

  switch (normalizePileQuestionInputType(question)) {
    case 'binary':
      return (
        <BinaryChoiceInput
          questionId={question.id}
          value={answer.value}
          inputNamePrefix="q"
          onChange={(option: any) => engine.handleAnswerPile(question.id, option)}
          disabled={engine.state.isSubmitting}
        />
      );

    case 'multichoice': {
      const options = engine.getQuestionOptionsForInput(question);
      const isSingleSelect = isSingleSelectMultichoice(question) || isPollSingleSelectQuestion(question);
      const selectedValues = normalizeMultichoiceValue(answer.value);
      return (
        <MultichoiceQuestionInput
          questionId={question.id}
          options={options}
          selectedValues={selectedValues}
          isSingleSelect={isSingleSelect}
          disabled={engine.state.isSubmitting}
          onChange={(nextValues: any) => engine.handleAnswerPile(question.id, nextValues)}
        />
      );
    }

    case 'rating': {
      const ratingValue = getNormalizedUiRatingValue(answer.value);
      return (
        <div className={styles.ratingContainer}>
          <CESlider
            min={RATING_MIN}
            max={RATING_MAX}
            step={1}
            value={ratingValue}
            onChange={(val: any, event: any) =>
              engine.handleAnswerPile(question.id, val, engine.getSliderPersistOptions(event))
            }
            onChangeComplete={engine.flushDraftPersistAfterSliderChange}
            disabled={engine.state.isSubmitting}
            className={styles.ratingSlider}
          />
          <span className={styles.ratingValueDisplay}>{ratingValue}</span>
        </div>
      );
    }

    case 'freeform':
    default:
      return (
        <SurveyAudioFieldInput
          {...engine.getAudioInputWorkerProps()}
          placeholder={'Your response...'}
          value={answer.value || ''}
          updateFunction={(val: any) => engine.handleAnswerPile(question.id, val)}
          toggleEncryption={(newState: any) => engine.toggleAnswerEncryption(0, question.id, newState)}
          disabled={engine.state.isSubmitting}
          forceGlow={glowAnswer}
          disableEncryption={true}
          enableDownloads={false}
        />
      );
  }
};

const renderPileSliderSection = (
  engine: PileViewModeEngine,
  {
    questionId,
    showSlider,
    convictionValue,
    importanceValue,
    activeSliderValue,
    sliderMode,
    hasConvictionImportanceValue,
  }: any,
) => {
  return (
    <SurveyQuestionsFullQuestionSliderSection
      activeSliderValue={activeSliderValue}
      collapsedSliderMode={sliderMode}
      convictionValue={convictionValue}
      hasConvictionImportanceValue={hasConvictionImportanceValue}
      importanceToggleEnabled={ENABLE_IMPORTANCE_SLIDER_TOGGLE}
      importanceValue={importanceValue}
      isSubmitting={engine.state.isSubmitting}
      onChange={(value: any, event: any) =>
        engine.handleConvictionImportanceChange(0, questionId, sliderMode, value, engine.getSliderPersistOptions(event))
      }
      onChangeComplete={engine.flushDraftPersistAfterSliderChange}
      onSelectMode={(nextMode: any) => {
        if (ENABLE_IMPORTANCE_SLIDER_TOGGLE) {
          engine.openConvictionSlider(questionId, nextMode);
          return;
        }
        engine.toggleConviction(questionId);
      }}
      questionId={questionId}
      sliderMode={sliderMode}
      sliderOpen={showSlider}
      sliderToggleExpandedByQuestion={engine.state.sliderToggleExpandedByQuestion}
    />
  );
};

const renderPileAdditionalInput = (engine: PileViewModeEngine, { questionId, additional, glowAdditional }: any) => {
  return (
    <SurveyAudioFieldInput
      {...engine.getAudioInputWorkerProps()}
      placeholder="Additional comments..."
      value={additional.value || ''}
      updateFunction={(val: any) => engine.handleAdditionalPile(questionId, val)}
      toggleEncryption={(newState: any) => engine.toggleAdditionalCommentsEncryption(0, questionId, newState)}
      dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
      dataCeQuestionId={String(questionId || '')
        .trim()
        .toLowerCase()}
      disabled={engine.state.isSubmitting}
      forceGlow={glowAdditional}
      encrypted={additional.encrypted || false}
      disableEncryption={true}
      enableDownloads={false}
    />
  );
};

const renderPileAdditionalEditorRow = (engine: PileViewModeEngine, { questionId, additional, glowAdditional }: any) => {
  return renderPileAdditionalEditorRowView({
    input: engine.renderPileAdditionalInput({
      questionId,
      additional,
      glowAdditional,
    }),
    lockControl: engine.renderQuestionAdditionalLockControl({
      surveyIndex: 0,
      questionId,
      additional,
      glowAdditional,
      visualContext: 'pile',
    }),
  });
};

const renderPileCommentsSection = (
  engine: PileViewModeEngine,
  {
    questionId,
    showComments,
    additional,
    glowAdditional,
    maskedAdditional,
    allowDecryptAdditional,
    decryptTooltip,
    isAdditionalDecrypting,
  }: any,
) => {
  return renderPileCommentsSectionView({
    showComments,
    maskedAdditional,
    decryptAdditionalControl: engine.renderQuestionFieldDecryptControl({
      questionId,
      fieldKey: 'additional',
      allowDecrypt: allowDecryptAdditional,
      decryptTooltip,
      actionLabel: 'Decrypt Comments',
      busy: isAdditionalDecrypting,
      showBusySpinnerWhenAutoDecryptEnabled: true,
    }),
    additionalEditorRow: engine.renderPileAdditionalEditorRow({
      questionId,
      additional,
      glowAdditional,
    }),
  });
};

const renderPileQuestionIcons = (
  engine: PileViewModeEngine,
  { questionId, answer, glowAnswer, maskedAnswer, hasAdditionalContent }: any,
) => {
  return renderPileQuestionIconsView({
    questionId,
    hasAdditionalContent,
    onToggleComments: () => engine.toggleComments(questionId),
    answerLockControl: engine.renderQuestionAnswerLockControl({
      surveyIndex: 0,
      questionId,
      answer,
      glowAnswer,
      ...engine.getAnswerLockDisplayState({
        field: answer,
        masked: maskedAnswer,
      }),
      visualContext: 'pile',
    }),
  });
};

const renderPileFooterSection = (
  engine: PileViewModeEngine,
  {
    question,
    answer,
    glowAnswer,
    maskedAnswer,
    hasAdditionalContent,
    showSlider,
    convictionValue,
    importanceValue,
    activeSliderValue,
    sliderMode,
    hasConvictionImportanceValue,
    showComments,
    additional,
    glowAdditional,
    maskedAdditional,
    allowDecryptAdditional,
    decryptTooltip,
    isAdditionalDecrypting,
  }: any,
) => {
  return renderPileFooterSectionView({
    sliderSection: engine.renderPileSliderSection({
      questionId: question.id,
      showSlider,
      convictionValue,
      importanceValue,
      activeSliderValue,
      sliderMode,
      hasConvictionImportanceValue,
    }),
    questionIcons: engine.renderPileQuestionIcons({
      questionId: question.id,
      answer,
      glowAnswer,
      maskedAnswer,
      hasAdditionalContent,
    }),
    commentsSection: engine.renderPileCommentsSection({
      questionId: question.id,
      showComments,
      additional,
      glowAdditional,
      maskedAdditional,
      allowDecryptAdditional,
      decryptTooltip,
      isAdditionalDecrypting,
    }),
  });
};

const renderPileCardShell = (
  engine: PileViewModeEngine,
  { question, questionComponent, questionContainerClass, footerSection }: any,
) => {
  return renderPileCardShellView({
    promptHeader: engine.renderPromptWithManualDecrypt(question),
    questionComponent,
    questionContainerClass,
    footerSection,
  });
};

const renderPileGatedPromptCard = (engine: PileViewModeEngine, { question }: any) => {
  return renderPileGatedPromptCardView({
    promptHeader: engine.renderPromptWithManualDecrypt(question),
    gatedPromptNotice: engine.renderGatedPromptNotice({
      question,
      tooltipIdSuffix: 'pile',
    }),
  });
};

const renderActiveQuestion = (engine: PileViewModeEngine, question: any) => {
  const { surveysResponseState, showComments, showConviction } = engine.state;
  const slice = surveysResponseState[0] || {
    answers: {},
    additionalComments: {},
    importance: {},
    conviction: {},
  };
  const {
    answer,
    additional,
    convictionValue,
    importanceValue,
    hasConvictionImportanceValue,
    sliderMode,
    activeSliderValue,
    hasAdditionalContent,
    glowAnswer,
    glowAdditional,
    decryptTooltip,
    maskedAnswer,
    maskedAdditional,
    allowDecryptAnswer,
    allowDecryptAdditional,
    isAnswerDecrypting,
    isAdditionalDecrypting,
  } = engine.getQuestionRenderDisplayState({
    questionId: question.id,
    responseSlice: slice,
  });

  const questionComponent = engine.renderPileResponseInput({
    question,
    answer,
    glowAnswer,
    maskedAnswer,
    allowDecryptAnswer,
    decryptTooltip,
    isAnswerDecrypting,
  });

  const questionContainerClass = styles[`${question.type}QuestionContainer`] || '';
  const promptMasked = engine.isQuestionPromptMasked(question);

  return renderPileActiveQuestionCard({
    question,
    promptMasked,
    renderQuestionMaskedPromptCard: engine.renderQuestionMaskedPromptCard,
    promptHeader: engine.renderPromptWithManualDecrypt(question),
    questionComponent,
    questionContainerClass,
    footerSection: engine.renderPileFooterSection({
      question,
      answer,
      glowAnswer,
      maskedAnswer,
      hasAdditionalContent,
      showSlider: !!showConviction[question.id],
      convictionValue,
      importanceValue,
      activeSliderValue,
      sliderMode,
      hasConvictionImportanceValue,
      showComments: !!showComments[question.id],
      additional,
      glowAdditional,
      maskedAdditional,
      allowDecryptAdditional,
      decryptTooltip,
      isAdditionalDecrypting,
    }),
  });
};

const renderPileViewMode = (engine: PileViewModeEngine) => {
  bumpSurveyPerfCounter('renderCount');
  const {
    pileQuestions: statePileQuestions,
    activePileIndex,
    loading,
    showCreate,
    filterModalOpen,
    showLongLoading,
    navCounterVisible,
    showHologramAssistant,
    showListeningPanel,
  } = engine.state;
  const fallbackQuestionPool: EarlyVisiblePileQuestion[] =
    Array.isArray(engine.state.questionPool) && engine.state.questionPool.length > 0
      ? (engine.state.questionPool as EarlyVisiblePileQuestion[])
      : Array.isArray(engine.props.questionPool)
        ? (engine.props.questionPool as EarlyVisiblePileQuestion[])
        : [];

  const hiddenMaskSource =
    Array.isArray(engine.state.allQuestionsForFilter) && engine.state.allQuestionsForFilter.length > 0
      ? engine.state.allQuestionsForFilter
      : fallbackQuestionPool;
  const { hiddenMaskedQuestionIds } = engine.getMemoizedMaskedQuestionVisibility(hiddenMaskSource, false);

  const slug = resolveEffectiveSlug(engine.props);
  const firstBoot = !hasCacheHydratedFlag(engine.props);
  const recentRateLimit = engine.isRecentRateLimit();
  const hasError = !!engine.props.cacheInitializationError;
  const progressSlug = normalizeQuestionProgressSlug(slug);
  const questionScanProgress =
    engine.props.questionScanProgress &&
    doesQuestionProgressMatchSlug(engine.props.questionScanProgress.slug, progressSlug)
      ? engine.props.questionScanProgress
      : null;
  const scanProgressDisplay = buildQuestionScanProgressDisplay(questionScanProgress);
  const pileScanDisplay = engine.getPileLoadingScanDisplay(questionScanProgress, scanProgressDisplay);
  const scanTotalBlocks = scanProgressDisplay.totalBlocks;
  const scanPercent = pileScanDisplay.percentComplete;
  const isFilterActive = !!engine.state.isFilterActive || isSurveyToolFilterStateActive(engine.state.filterState);
  const pileQuestions = resolveEarlyVisiblePileQuestions({
    pileQuestions: Array.isArray(statePileQuestions) ? (statePileQuestions as EarlyVisiblePileQuestion[]) : [],
    questionPool: fallbackQuestionPool,
    isFilterActive,
  });
  const effectiveActivePileIndex = Math.min(
    Math.max(0, Number(activePileIndex || 0)),
    Math.max(pileQuestions.length - 1, 0),
  );
  const hasFilterBaseQuestions =
    (Array.isArray(engine.state.allQuestionsForFilter) && engine.state.allQuestionsForFilter.length > 0) ||
    fallbackQuestionPool.length > 0;
  const hasSessionQuestionGate = engine.hasRestrictedSessionQuestionGate(engine.props);
  const pileWorkspaceViewState = buildPileWorkspaceViewState({
    pileQuestions,
    activePileIndex: effectiveActivePileIndex,
    loading,
    hiddenMaskedQuestionIds,
    hasHiddenGatedQuestions: !!engine.state.hasHiddenGatedQuestions,
    firstBoot,
    cacheHasLoaded: engine.props.cacheHasLoaded,
    isQuestionCacheReady: !!engine.props.isQuestionCacheReady,
    recentRateLimit,
    scanRemainingBlocks: scanProgressDisplay.remainingBlocks,
    hydrateDiscovered: questionScanProgress?.discoveredQuestions,
    hydrateDone: questionScanProgress?.hydratedQuestions,
    pendingMetadataCount: questionScanProgress?.pendingMetadataCount,
    questionScanPhase: questionScanProgress?.phase,
    questionScanErrorMessage: questionScanProgress?.errorMessage,
    isHydratingPriorResponses: engine.state.isHydratingPriorResponses,
    isFilterActive,
    hasFilterBaseQuestions,
    hasSessionQuestionGate,
  });
  const {
    activeQuestion,
    activePromptMasked,
    hydrateDiscovered,
    hydrateDone,
    hasPendingMetadataRetries,
    isHydrating,
    hasTerminalScanError,
    scanErrorMessage,
    showGatedEmptyState,
    showFilteredEmptyState,
    priorResponsesHydrating,
    showMiniBackgroundSpinner,
  } = pileWorkspaceViewState;
  const lockedGateDetails = engine.getMemoizedLockedQuestionGateDetails(hiddenMaskedQuestionIds);
  const isStillLoading = pileWorkspaceViewState.isStillLoading;

  /**
   * PILE MODE — Submit button label (central helper)
   */
  const _pileStats = engine.getPendingStatsSnapshot();
  const pileSubmitLabel = (engine.props.computeSubmitLabel || computeSubmitLabel)(engine, {
    pendingStats: _pileStats,
  });
  const {
    hasPendingPileChanges,
    shouldHidePileSubmitButton,
    finalSubmitText,
    pileSubmitResponderHref,
    pileTopRailVisible,
    showSubmitButton,
    showSuccessBadgeLink,
    showSuccessBadgeStatus,
    showClearPendingButton,
  } = buildPileSubmitRailViewState({
    pendingStats: _pileStats,
    isSubmitting: engine.state.isSubmitting,
    submittedSinceLastEdit: engine.state.submittedSinceLastEdit,
    submissionComplete: engine.state.submissionComplete,
    pileSubmitTempText: engine.state.pileSubmitTempText,
    pileSubmitLabel,
    account: engine.props.account,
    isAddress: utils.isAddress,
  });

  const gatedEmptyHasDetails = lockedGateDetails.length > 0;
  const gatedEmptyRequirementSentence = engine.getLockedGateRequirementSentence(lockedGateDetails);
  const inheritedSessionGateDetails = gatedEmptyHasDetails
    ? lockedGateDetails
    : engine.buildSessionQuestionGateDetails(1);
  const sessionGateDetails =
    inheritedSessionGateDetails.length > 0 ? inheritedSessionGateDetails : buildPileSessionGateDetails(engine, 1);
  const sessionGateRequirementSentence = engine.getLockedGateRequirementSentence(sessionGateDetails);
  const gatedEmptyPanel =
    hiddenMaskedQuestionIds.length > 0 ? (
      <div className={styles.gatedEmptyPanelShell}>
        {engine.renderLockedQuestionsPanel({
          hiddenMaskedQuestionIds,
          lockedGateDetails,
          title: `This session's questions are ${t('gatedLower')}`,
          subtitle: gatedEmptyHasDetails
            ? `${gatedEmptyRequirementSentence ? `${gatedEmptyRequirementSentence} ` : ''}Connect an eligible ${t('walletLower')} that satisfies the ${t('gateLower')} requirements below, then decrypt to view the questions.`
            : `Connect an eligible ${t('walletLower')} and decrypt to view the questions.`,
          forceExpanded: false,
          surface: 'dark',
          showCaret: true,
        })}
      </div>
    ) : (
      <>
        <div className={styles.gatedEmptyHeadline}>{`This session's questions are ${t('gatedLower')}.`}</div>
        <div className={styles.gatedEmptyCopy}>
          {sessionGateRequirementSentence
            ? `${sessionGateRequirementSentence} Connect an eligible ${t('walletLower')} to decrypt.`
            : `These questions are ${t('gatedLower')} by a ${t('sbt')}. Connect an eligible ${t('walletLower')} to decrypt.`}
        </div>
      </>
    );

  const showListeningAside = showListeningPanel && !showHologramAssistant;

  return (
    <div className={styles.pileViewContainer}>
      <div className={showListeningAside ? styles.pileListeningLayout : undefined}>
        <div className={styles.pileWrapper}>
          {renderPileInteractionSurface({
            showHologramAssistant,
            toggleHologramAssistant: engine.toggleHologramAssistant,
            showMiniBackgroundSpinner,
            priorResponsesHydrating,
            showLongLoading,
            loadingElapsedSec: engine.state.loadingElapsedSec,
            pileQuestions,
            activePileIndex: effectiveActivePileIndex,
            renderActiveQuestion: engine.renderActiveQuestion,
            hasTerminalScanError,
            scanErrorMessage,
            hasError,
            isStillLoading,
            hydrateDone,
            hydrateDiscovered,
            isHydrating,
            scanTotalBlocks,
            pileScanDisplay,
            scanPercent,
            showFilteredEmptyState,
            showGatedEmptyState,
            gatedEmptyPanel,
            isFilterActive,
            toggleFilterModal: engine.toggleFilterModal,
            showCreate,
            toggleCreate: engine.toggleCreate,
            showListeningPanel,
            toggleListeningPanel: engine.toggleListeningPanel,
            onViewAllClick: engine.props.onViewAllClick,
            handleViewAllFromPile: engine.handleViewAllFromPile,
            pileTopRailVisible,
            showSuccessBadgeLink,
            pileSubmitResponderHref,
            showSuccessBadgeStatus,
            showSubmitButton,
            handlePileSubmitClick: engine.handlePileSubmitClick,
            hasPendingPileChanges,
            shouldHidePileSubmitButton,
            isSubmitting: engine.state.isSubmitting,
            activePromptMasked,
            finalSubmitText,
            showClearPendingButton,
            handleRevertPendingChanges: engine.handleRevertPendingChanges,
            navCounterVisible,
            handlePrev: engine.handlePrev,
            handleNext: engine.handleNext,
          })}
        </div>
        {showListeningAside && (
          <div className={styles.sessionListeningPanelAnchor} ref={engine.listeningPanelRef}>
            <React.Suspense fallback={<LazyFallback label="Loading Listening Panel..." minHeight="160px" />}>
              <LazySessionListeningPanel
                {...engine.props}
                {...engine.getAudioInputWorkerProps()}
                onClose={engine.closeListeningPanel}
              />
            </React.Suspense>
          </div>
        )}
      </div>

      {!showHologramAssistant && showCreate && (
        <div className={styles.pileFullControls} ref={engine.createSectionRef}>
          <React.Suspense fallback={<LazyFallback label="Loading Question Authoring..." minHeight="160px" />}>
            <LazyPileCreateQuestionsAndSurveys {...engine.props} hideSurveyQuestionToggleUntilAuthoring={true} />
          </React.Suspense>
        </div>
      )}

      <QuestionFilter
        filterModalOpen={filterModalOpen}
        toggleFilterModal={engine.toggleFilterModal}
        questions={
          Array.isArray(engine.state.allQuestionsForFilter) && engine.state.allQuestionsForFilter.length > 0
            ? engine.state.allQuestionsForFilter
            : fallbackQuestionPool
        }
        questionResponses={engine.getPileFilterQuestionResponses()}
        onFilter={engine.handleFilter}
        onFilterActivityChange={engine.handlePileFilterActivityChange}
        filterState={engine.state.filterState}
        enableLocalStorage={true}
        currentViewModeForUrl={'questions'}
        currentSurveyIdForUrl={null}
        provider={engine.props.provider}
        network={engine.props.network}
        sessionSlug={resolveEffectiveSlug(engine.props)}
        activeSessionSlug={getActiveSessionSlugFromProps(engine.props)}
        sessionConfig={engine.props.sessionConfig}
        ensureLightSbtUniverse={engine.props.ensureLightSbtUniverse}
        defaultFilterState={engine.props.defaultFilterState}
        defaultTags={engine.props.defaultTags}
        defaultFeaturedSBTs={engine.props.defaultFeaturedSBTs}
        isQuestionCacheReady={engine.props.isQuestionCacheReady}
        isSurveyCacheReady={engine.props.isSurveyCacheReady}
        isSBTCacheReady={engine.props.isSBTCacheReady}
        questionResponsesNonce={engine.props.questionResponsesNonce}
        questionsCacheNonce={engine.props.questionsCacheNonce}
        storageKeyPrefix={buildQuestionFilterStorageKeyPrefix(engine.props, resolveEffectiveSlug(engine.props))}
      />
    </div>
  );
};

export function PileViewMode(props: any): React.ReactElement {
  return <SurveyQuestions {...props} runtimeStrategy={props?.runtimeStrategy || createPileViewRuntimeStrategy()} />;
}

export default PileViewMode;
