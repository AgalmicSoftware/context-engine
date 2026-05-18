// @ts-nocheck
/** @file SurveyPileViewMode.tsx */

import React, { Component } from 'react';
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
import "../../assets/css/contextEngine.scss";
import styles from './SurveyTool.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUnlock, faCaretUp, faArrowLeft, faArrowRight, faExternalLinkAlt, faExclamationCircle, faMicrophone } from '@fortawesome/free-solid-svg-icons';

import QuestionFilter from './QuestionFilter';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import SingleQuestionResponse from './SingleQuestionResponse';
import TagModal from '../TagPage/TagModal';
import LazyFallback from '../Shared/LazyFallback';
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
  shouldPreferPileGatedEmptyState,
} from './surveyPileViewState.js';
import {
  renderPileActiveQuestionCard,
  renderPileCardShell,
  renderPileGatedPromptCard,
} from './surveyPileActiveQuestionCard';
import {
  renderPileAdditionalEditorRow,
  renderPileCommentsSection,
  renderPileQuestionIcons,
  renderPileFooterSection,
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
import {
  loadPileScopeCacheSnapshot,
} from './surveyPileScopeCacheData';
import {
  buildPileFilterResultPlan,
  buildPileLoadResultPlan,
  buildPileQuestionPipelineState,
} from './surveyPileQuestionFlow';
import {
  buildPileCachePrefillStatePlan,
  executeEnsureVisiblePileResponseState,
  executePileInitializeResponseState,
  executePileQuestionSetHydration,
} from './surveyPileResponseController';
import {
  buildClearedTransientSubmitFeedbackState,
  buildTransientSubmitFeedbackState,
  normalizeTransientSubmitFeedbackDurationMs,
} from './surveyQuestionSubmitFeedback.js';
import { buildRenderedQuestionIdsFromPileWindow } from './surveyQuestionScope.js';
import {
  buildListeningModeSearch,
  isListeningModeQueryEnabled,
} from '../../utilities/audio/rollingTranscription';
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
import { resolvePayloadStorageRef } from '../../utilities/storage/storageRefs.js';
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
  writeQuestionsCache,
  writeSurveysCache,
  bumpSurveyPerfCounter,
} from './surveyToolUtils.js';

import { SurveySelector, QuestionsDashboard } from './SurveySelector';
import {
  buildAutoDecryptDisabledState,
  buildBookmarkedQuestionsState,
  buildCanDecryptOtherResponsesState,
  buildClearedSurveyQuestionPoolState,
  buildInitialSurveyQuestionsState,
  buildSurveyQuestionPoolLoadState,
  type SurveyQuestionsProps,
  type SurveyQuestionsState,
} from './surveyQuestionsTypes.js';

import { SurveyQuestions } from './SurveyQuestions';

export const LazyPileCreateQuestionsAndSurveys = React.lazy(() => import('./CreateQuestionsAndSurveys'));
export const LazySessionListeningPanel = React.lazy(() => import('./SessionListeningPanel'));

export class PileViewMode extends SurveyQuestions {
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
      showListeningPanel: typeof window !== 'undefined'
        ? isListeningModeQueryEnabled(window.location.search || '')
        : false,
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
    this._lastNotifiedPileSubmitRailVisible = null;

    // Refs for auto-scrolling to newly opened sections
    this.createSectionRef = React.createRef();
    this.listeningPanelRef = React.createRef();
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
  _lastGatedEmptyRecoveryKey = '';

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
      String(resolvePayloadStorageRef(question)?.id || question.arweaveTxId || ''),
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

    const ids = buildRenderedQuestionIdsFromPileWindow({
      pileQuestions,
      activePileIndex,
    });

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

  getEffectivePileSessionConfig = (propsIn = this.props) => {
    const slug = resolveEffectiveSlug(propsIn);
    const context = resolvePileLoadContext(propsIn, slug);
    const resolvedConfig = (context?.sessionConfig && typeof context.sessionConfig === 'object')
      ? context.sessionConfig
      : {};
    const propConfig = (propsIn?.sessionConfig && typeof propsIn.sessionConfig === 'object')
      ? propsIn.sessionConfig
      : {};
    return {
      ...resolvedConfig,
      ...propConfig,
      __registry: {
        ...((resolvedConfig.__registry && typeof resolvedConfig.__registry === 'object') ? resolvedConfig.__registry : {}),
        ...((propConfig.__registry && typeof propConfig.__registry === 'object') ? propConfig.__registry : {}),
        gatesByResource: {
          ...(
            resolvedConfig.__registry &&
            typeof resolvedConfig.__registry === 'object' &&
            resolvedConfig.__registry.gatesByResource &&
            typeof resolvedConfig.__registry.gatesByResource === 'object'
              ? resolvedConfig.__registry.gatesByResource
              : {}
          ),
          ...(
            propConfig.__registry &&
            typeof propConfig.__registry === 'object' &&
            propConfig.__registry.gatesByResource &&
            typeof propConfig.__registry.gatesByResource === 'object'
              ? propConfig.__registry.gatesByResource
              : {}
          ),
        },
      },
    };
  };

  hasRestrictedSessionQuestionGate = (propsIn = this.props) => {
    const cfg = this.getEffectivePileSessionConfig(propsIn);
    const primaryState = resolveSponsoredGateStateForResource(cfg, 'questionResponses');
    if (primaryState?.status === SPONSORED_GATE_STATES.OPEN) return false;
    if (primaryState?.status === SPONSORED_GATE_STATES.RESTRICTED && primaryState.gate) return true;

    const defaultState = resolveSponsoredGateStateForResource(cfg, 'default');
    if (defaultState?.status === SPONSORED_GATE_STATES.RESTRICTED && defaultState.gate) return true;

    const legacyGate = resolveEncryptionGate(cfg);
    return getGateSbtAddresses(legacyGate).length > 0;
  };

  maybeRecoverUnhydratedGatedPile = () => {
    if (typeof this.props.refreshQuestionMetadata !== 'function') return false;
    if (!this.hasRestrictedSessionQuestionGate(this.props)) return false;
    if (Array.isArray(this.state?.pileQuestions) && this.state.pileQuestions.length > 0) return false;
    if (this.state?.hasHiddenGatedQuestions) return false;

    const slug = resolveEffectiveSlug(this.props);
    const progressSlug = normalizeQuestionProgressSlug(slug);
    const questionScanProgress =
      this.props.questionScanProgress &&
      doesQuestionProgressMatchSlug(this.props.questionScanProgress.slug, progressSlug)
        ? this.props.questionScanProgress
        : null;
    const hydrateDiscovered = Math.max(0, Number(questionScanProgress?.discoveredQuestions || 0));
    const pendingMetadataCount = Math.max(0, Number(questionScanProgress?.pendingMetadataCount || 0));
    const shouldRecover = (
      !!this.props.isQuestionCacheReady ||
      hydrateDiscovered > 0 ||
      pendingMetadataCount > 0
    );
    if (!shouldRecover) return false;

    const forceDiscoveryRescan = !!this.props.isQuestionCacheReady && !questionScanProgress;
    const recoveryKey = [
      normalizeSessionSlugValue(slug),
      String(this.props.account || '').trim().toLowerCase(),
      Number(this.props.questionsCacheNonce || 0),
      Number(this.props.questionResponsesNonce || 0),
      forceDiscoveryRescan ? 'force' : 'retry',
      String(questionScanProgress?.phase || ''),
      hydrateDiscovered,
      pendingMetadataCount,
    ].join('|');
    if (this._lastGatedEmptyRecoveryKey === recoveryKey) return false;
    this._lastGatedEmptyRecoveryKey = recoveryKey;

    try {
      const maybePromise = this.props.refreshQuestionMetadata({
        forceDiscoveryRescan,
      });
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch((err) => {
          surveyLog.warn('[pile] gated empty metadata recovery failed', err);
        });
      }
    } catch (err) {
      surveyLog.warn('[pile] gated empty metadata recovery failed', err);
      return false;
    }
    return true;
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
    const hasSessionQuestionGate = this.hasRestrictedSessionQuestionGate(this.props);
    const hasUnhydratedGatedQuestions = (
      hasSessionQuestionGate &&
      !hasVisibleQuestions &&
      !this.state?.hasHiddenGatedQuestions &&
      (
        hydrateDiscovered > 0 ||
        pendingMetadataCount > 0 ||
        !!this.props.isQuestionCacheReady
      )
    );
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
    ) || preferGatedEmptyState || hasUnhydratedGatedQuestions;
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
  } = {}) => shouldPreferPileGatedEmptyState({
    hasConcreteHiddenQuestions,
    hasVisibleQuestions,
    firstBoot,
    cacheHasLoaded: this.props.cacheHasLoaded,
    recentRateLimit,
    hasPendingMetadataRetries,
  });

  syncLoadingElapsedTimer = () => {
    const shouldRun = this.isPileLoadingVisible();
    if (shouldRun) {
      if (!this._loadingStartedAtMs) this._loadingStartedAtMs = Date.now();
      if (!this._loadingElapsedTimer) {
        this._loadingElapsedTimer = setInterval(() => {
          const started = Number(this._loadingStartedAtMs || Date.now());
          const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
          if (elapsed !== Number(this.state.loadingElapsedSec || 0)) {
            this.setState(buildPileLoadingElapsedPatch(elapsed));
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
      this.setState(buildPileLoadingElapsedPatch(0));
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
    this.maybeRecoverUnhydratedGatedPile();
    this.syncLoadingElapsedTimer();
    this.notifyPileSubmitRailVisibility();
    if (this.state.showListeningPanel) {
      this.scrollListeningPanelIntoViewIfNeeded('auto');
    }
    // Start long-loading timer
    this.loadingTimeout = setTimeout(() => {
      if (this.state.loading || !this.props.isQuestionCacheReady) {
        this.setState(buildPileShowLongLoadingPatch(true));
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
    this.notifyPileSubmitRailVisibility();
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
    const providerChanged = prevProps.provider !== this.props.provider;

    const cacheReadyTick =
      (prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady && this.props.isQuestionCacheReady) ||
      (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady && this.props.isResponsesCacheReady);
    const cacheJustBecameReady = !prevProps.isResponsesCacheReady && this.props.isResponsesCacheReady;
    const nonceTick = prevProps.questionsCacheNonce !== this.props.questionsCacheNonce;
    const responseNonceTick =
      prevProps.questionResponsesNonce !== this.props.questionResponsesNonce;
    const progressSlug = normalizeQuestionProgressSlug(resolveEffectiveSlug(this.props));
    const previousQuestionProgress = pickScopedPileQuestionProgress({
      progress: prevProps.questionScanProgress,
      progressSlug,
      doesQuestionProgressMatchSlug,
    });
    const nextQuestionProgress = pickScopedPileQuestionProgress({
      progress: this.props.questionScanProgress,
      progressSlug,
      doesQuestionProgressMatchSlug,
    });
    const progressSignals = buildPileQuestionProgressSignals({
      previousProgress: previousQuestionProgress,
      nextProgress: nextQuestionProgress,
    });
    const pileQuestionsChanged = prevState.pileQuestions !== this.state.pileQuestions;
    const surveysResponseStateChanged = prevState.surveysResponseState !== this.state.surveysResponseState;
    const commentsChanged = prevState.showComments !== this.state.showComments;
    const autoDecryptBlocked = this.isAutoDecryptBlocked();
    const autoDecryptJustEnabled = !prevState.autoDecryptEnabled && this.state.autoDecryptEnabled;

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
      pileQuestionsLength: this.state.pileQuestions.length,
      isQuestionCacheReady: this.props.isQuestionCacheReady,
      loading: this.state.loading,
      showLongLoading: this.state.showLongLoading,
      providerChanged,
      autoDecryptBlocked,
      autoDecryptEnabled: this.state.autoDecryptEnabled,
      pileQuestionsChanged,
      surveysResponseStateChanged,
      cacheJustBecameReady,
      autoDecryptJustEnabled,
      commentsChanged,
    });

    if (updatePlan.shouldResetContext) {
      // Persist draft before reset so it survives the login transition
      try { this.persistDraft(); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      this._lastLoadAndSortResultSignature = '';
      this._lastInitializeResponseSig = '';
      this._emptyReadyProbeStartedAtMs = 0;

      // If context changes, we must reset optimistic flags and reload immediately
      // We do this regardless of edits because the context (wallet/chain) invalidates the current session
      this.setState(
        buildPileContextResetState({
          submittedSinceLastEdit: this.state.submittedSinceLastEdit,
        }),
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
        this.setState(buildAutoDecryptDisabledState());
      }
      this.syncLoadingElapsedTimer();
      return;
    }

    if (updatePlan.cacheUpdatePlan.action === 'check-optimistic-baseline') {
      // Optimistic guard: do not reload/wipe state yet. Check if cache has caught up.
      this.checkCacheAgainstBaseline();
    } else if (updatePlan.cacheUpdatePlan.action === 'reload') {
      this.scheduleLoadAndSortQuestions(updatePlan.cacheUpdatePlan.delayMs);
    } else if (updatePlan.cacheUpdatePlan.action === 'skip-live-edits') {
      bumpSurveyPerfCounter('noopSkipCount');
      surveyLog.debug('PileViewMode: skipped rebuild due to pending edits');
    } else if (updatePlan.cacheUpdatePlan.action === 'show-loading') {
      // Initial load spinner (guarded against loop)
      this.setState(buildPileLoadingPatch(true));
    }

    // Clear long-loading if loaded
    if (updatePlan.shouldClearLongLoading) {
      this.setState(buildPileShowLongLoadingPatch(false));
    }

    // 3. Auto-Decrypt Logic
    if (updatePlan.shouldDisableBlockedAutoDecrypt) {
      this.resetBlockedAutoDecryptSweepInternals();
      if (this.state.autoDecryptEnabled || (this.state.decryptingByKey && Object.keys(this.state.decryptingByKey).length > 0)) {
        this.setState(buildAutoDecryptDisabledState());
      }
    }

    updatePlan.queueAutoDecryptReasons.forEach((reason) => {
      this.queueAutoDecryptVisibleSweep(reason);
    });

    this.maybeRecoverUnhydratedGatedPile();
    this.syncLoadingElapsedTimer();
  }


  componentWillUnmount() {
    try {
      if (typeof this.props.onPileSubmitRailVisibilityChange === 'function') {
        this.props.onPileSubmitRailVisibilityChange(false);
      }
    } catch (e) { surveyLog.warn('SurveyTool: callback', e); }
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
    this.setState(buildPileNavCounterVisiblePatch(true));

    // Schedule fade-out after 2 seconds
    this._navFadeTimer = setTimeout(() => {
      this.setState(buildPileNavCounterVisiblePatch(false));
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

  syncListeningModeQuery = (enabled) => {
    if (typeof window === 'undefined' || !window.history?.replaceState) return;
    try {
      const nextSearch = buildListeningModeSearch(window.location.search || '', enabled);
      const nextUrl = `${window.location.pathname}${nextSearch}${window.location.hash || ''}`;
      window.history.replaceState({}, '', nextUrl);
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  }

  shouldUseMobileListeningScroll = () => {
    if (typeof window === 'undefined') return false;
    try {
      if (typeof window.matchMedia === 'function') {
        return window.matchMedia('(max-width: 1100px)').matches;
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    return Number(window.innerWidth || 0) > 0 && Number(window.innerWidth || 0) <= 1100;
  }

  scrollListeningPanelIntoViewIfNeeded = (behavior = 'smooth') => {
    if (!this.state.showListeningPanel || !this.shouldUseMobileListeningScroll()) return;
    const target = this.listeningPanelRef?.current;
    if (!target || typeof target.scrollIntoView !== 'function') return;
    try {
      target.scrollIntoView({ behavior, block: 'start' });
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  }

  toggleListeningPanel = () => {
    this.setState((prev) => ({ showListeningPanel: !prev.showListeningPanel }), () => {
      this.syncListeningModeQuery(!!this.state.showListeningPanel);
      this.scrollListeningPanelIntoViewIfNeeded('smooth');
    });
  }

  closeListeningPanel = () => {
    if (!this.state.showListeningPanel) return;
    this.setState({ showListeningPanel: false }, () => {
      this.syncListeningModeQuery(false);
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

  // Keep semantics aligned with baseline-aware changed-set
  getAnsweredQuestionsCount = () => this.getSubmitCount();


  checkCacheAgainstBaseline = () => {
    const slug = resolveEffectiveSlug(this.props);
    const pileResponseReadContext = resolvePileResponseReadContext(this.props, slug);
    const effectiveSlug = pileResponseReadContext.sessionSlug || slug;
    const networkID = pileResponseReadContext.networkIdStr;
    const baselineCheckPlan = buildPileBaselineCheckPlan({
      submissionComplete: this.state.submissionComplete,
      editBaseline: this.state.editBaseline,
      networkIdStr: networkID,
      pileQuestions: this.state.pileQuestions,
    });
    if (baselineCheckPlan.shouldSkip) return;

    const acctLower = (this.props.account || '').toLowerCase();
    const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(this.props, effectiveSlug)];
    const qRespMap = readPileScopedQuestionResponses({
      scopeSlugs,
      networkIdStr: networkID,
      readQuestionsCache,
      mergeQuestionResponses,
    });
    const baselineConsistencyPlan = buildPileBaselineConsistencyPlan({
      baseline: this.state.editBaseline,
      renderedIds: baselineCheckPlan.renderedIds,
      questionResponses: qRespMap,
      account: acctLower,
      valuesEqual: this.valuesEqual,
    });

    if (baselineConsistencyPlan.action === 'sync-cache-caught-up') {
      surveyLog.log("PileViewMode: Cache caught up with baseline. Syncing.");
      this.setState(buildPileSubmissionCompletePatch(false), () => {
        // Now it is safe to reload and wipe/rebuild state, as cache matches our optimistic view
        this.loadAndSortQuestions();
      });
    } else {
      surveyLog.log("PileViewMode: Ignoring stale cache. Maintaining optimistic state.");
    }
  };

  prefillUserAnswersFromCache = () => {
    const slug = resolveEffectiveSlug(this.props);
    const pileResponseReadContext = resolvePileResponseReadContext(this.props, slug);
    const effectiveSlug = pileResponseReadContext.sessionSlug || slug;
    const networkID = pileResponseReadContext.networkIdStr;
    const prefillReadPlan = buildPilePrefillReadPlan({
      account: this.props.account,
      isDirty: this.state.isDirty,
      modifiedCount: this.state.modifiedCount,
      networkIdStr: networkID,
      pileQuestions: this.state.pileQuestions,
    });
    if (prefillReadPlan.shouldSkip) {
      if (prefillReadPlan.shouldBumpNoop) {
        bumpSurveyPerfCounter('noopSkipCount');
        surveyLog.debug('baseline-guard: skipped rebuild');
      }
      return;
    }

    const acctLower = (this.props.account || '').toLowerCase();
    const scopeSlugs = [effectiveSlug, ...getExtraQuestionReadSlugs(this.props, effectiveSlug)];
    const qRespMap = readPileScopedQuestionResponses({
      scopeSlugs,
      networkIdStr: networkID,
      readQuestionsCache,
      mergeQuestionResponses,
    });

    const pendingStats = (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) || { total: this.state.modifiedCount || 0 };
    const prefillPlan = buildPileCachePrefillStatePlan({
      pileQuestions: this.state.pileQuestions,
      questionResponsesByQuestionId: qRespMap,
      account: acctLower,
      currentSlice: this.state.surveysResponseState?.[0],
      editBaseline: this.state.editBaseline,
      pendingTotal: pendingStats.total,
      cloneValue: this.deepClone,
      applyCachedResponseEntryToSlice: ({ targetSlice, questionId, response }) => (
        this._applyCachedResponseEntryToSlice({
          targetSlice,
          questionId,
          response,
          parseValue: this.parseAnswerValue,
        })
      ),
    });

    this.setState(prefillPlan.nextState, () => this.updateJsonPreview());
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
    const recentRateLimit = this.isRecentRateLimit();
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
      cacheHasLoaded: this.props.cacheHasLoaded,
      isQuestionCacheReady: !!this.props.isQuestionCacheReady,
      recentRateLimit,
    });

    // If no network ID, we can't load specific data, but we shouldn't hang if we can't determine it yet.
    if (!networkID) {
      // Optimistic Loading: If we have no ID, we are likely still initializing.
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      const noNetworkLoadPlan = buildPileNoNetworkLoadPlan({
        currentLoading: this.state.loading,
        isQuestionCacheReady: !!this.props.isQuestionCacheReady,
        recentRateLimit,
      });
      if (noNetworkLoadPlan.shouldClearLastResultSignature) {
        this._lastLoadAndSortResultSignature = '';
      }
      if (noNetworkLoadPlan.shouldSkipStateUpdate) {
        bumpSurveyPerfCounter('noopSkipCount');
        return;
      }
      this.setState(noNetworkLoadPlan.nextState);
      return;
    }

    try {
      const {
        allResponses,
        allQuestions,
        highlightedQuestionIds: hlSet,
        pendingMetadataCount,
      } = await loadPileScopeCacheSnapshot({
        scopeSlugs,
        networkIdStr: networkID,
        readQuestionsCacheAsync,
        ensureQuestionsNet,
        getHighlightedQuestionIdsSet,
        mergeQuestionResponses,
        getBlockedQuestionIdsSet,
        normalizeQuestionIdKey,
      });
      // Read path only: avoid write-on-read feedback loops via questionsCacheNonce.
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      const hasPendingMetadataRetries = pendingMetadataCount > 0;
      const responseCountsCacheKey = `${scopeSignature}|${networkID}|${Number(this.props.questionResponsesNonce || 0)}`;
      const responseCountsPlan = buildPileResponseCountsCachePlan({
        cacheKey: responseCountsCacheKey,
        previousCacheKey: this._responseCountsCacheKey,
        previousCacheValue: this._responseCountsCacheValue,
        questionResponses: allResponses,
      });
      const responseCounts = responseCountsPlan.responseCounts;
      this._responseCountsCacheKey = responseCountsPlan.nextCacheKey;
      this._responseCountsCacheValue = responseCountsPlan.nextCacheValue;

      // No defaultTags gating: sessions handle scoping; tags are for organization and user filtering.

      if (allQuestions.length > 0) {
        this._emptyReadyProbeStartedAtMs = 0;
      }

      // Empty-settlement probe: on early refresh, cache can report ready before
      // question metadata lands. Keep loading and periodically re-check before
      // showing a definitive empty state.
      if (allQuestions.length === 0) {
        const emptyProbePlan = buildPileEmptyProbePlan({
          cacheHasLoaded: this.props.cacheHasLoaded,
          isQuestionCacheReady: !!this.props.isQuestionCacheReady,
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
          emptyReadyProbeStartedAtMs: this._emptyReadyProbeStartedAtMs,
          nowMs: Date.now(),
        });
        const emptyProbeStatePlan = buildPileEmptyProbeStatePlan({
          action: emptyProbePlan.action,
          nextProbeStartedAtMs: emptyProbePlan.nextProbeStartedAtMs,
          nextProbeDelayMs: emptyProbePlan.nextProbeDelayMs,
          previousPileQuestions: this.state.pileQuestions,
          previousAllQuestionsForFilter: this.state.allQuestionsForFilter,
          previousLoading: this.state.loading,
          areQuestionListsEquivalent: this.areQuestionListsEquivalent,
        });
        this._emptyReadyProbeStartedAtMs = emptyProbeStatePlan.nextProbeStartedAtMs;

        if (emptyProbeStatePlan.action !== 'settle-empty') {
          if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
          if (emptyProbeStatePlan.shouldClearLastResultSignature) {
            this._lastLoadAndSortResultSignature = '';
          }
          if (emptyProbeStatePlan.shouldBumpNoop) {
            bumpSurveyPerfCounter('noopSkipCount');
          } else if (emptyProbeStatePlan.shouldIncrementPileQuestionsGeneration) {
            this._pileQuestionsGeneration += 1;
          }
          if (emptyProbeStatePlan.nextState) {
            this.setState(emptyProbeStatePlan.nextState);
          }
          if (emptyProbeStatePlan.action === 'probe-loading') {
            this.scheduleLoadAndSortQuestions(emptyProbeStatePlan.nextProbeDelayMs);
          }
          return;
        }
      }

      const acctLower = (this.props.account || '').toLowerCase();
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
      const filterSig = serializeSurveyToolFilterState(this.state.filterState);
      const isFilterActive = !!this.state.isFilterActive || !!filterSig;
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      const settleUnreadyEmpty = canSettleUnreadyEmpty && sortedVisible.length === 0;
      const loadResultPlan = buildPileLoadResultPlan({
        previousAllQuestionsForFilter: this.state.allQuestionsForFilter,
        previousPileQuestions: this.state.pileQuestions,
        previousActivePileIndex: this.state.activePileIndex,
        previousHasHiddenGatedQuestions: this.state.hasHiddenGatedQuestions,
        previousLoading: this.state.loading,
        sortedQuestions: sorted,
        sortedVisibleQuestions: sortedVisible,
        hiddenQuestions: hiddenGated,
        hasHiddenGatedQuestions: nextHidden,
        isFilterActive,
        filterSig,
        questionResponses: allResponses,
        account: acctLower,
        settleUnreadyEmpty,
        isQuestionCacheReady: !!this.props.isQuestionCacheReady,
        recentRateLimit,
        areQuestionListsEquivalent: this.areQuestionListsEquivalent,
        buildQuestionListSignature: this.buildQuestionListSignature,
        getPileVisibleQuestionIds: this.getPileVisibleQuestionIds,
        buildPileVisibleResponseSignature: this.buildPileVisibleResponseSignature,
      });
      if (loadResultPlan.shouldIncrementPileQuestionsGeneration) {
        this._pileQuestionsGeneration += 1;
      }

      const runHydration = () => {
        this.runPileQuestionSetHydration({
          requestEpoch,
          resultSignature: loadResultPlan.resultSignature,
          initializeResponses: !this.state.submissionComplete,
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

      this.setState(loadResultPlan.nextState, runHydration);
    } catch (e) {
      surveyLog.error('Failed to load/sort questions:', e);
      // Treat unexpected errors as warming state if we recently saw rate-limits
      if (requestEpoch !== this._loadAndSortQuestionsEpoch) return;
      this._lastLoadAndSortResultSignature = '';
      this.setState(buildPileLoadFailureState({
        isQuestionCacheReady: !!this.props.isQuestionCacheReady,
        recentRateLimit,
      }));
    }
  };

  shouldAbortPileHydrationRequest = (requestEpoch = null) => (
    requestEpoch !== null && requestEpoch !== undefined && requestEpoch !== this._loadAndSortQuestionsEpoch
  );

  resetPileAutoDecryptLedger = ({
    requestEpoch = null,
    queueReason = 'pile-hydration',
    resetQueueReason = 'pile-hydration-reset',
  } = {}) => {
    if (this.shouldAbortPileHydrationRequest(requestEpoch)) return;
    this._autoDecQueue = [];
    this._autoDecProcessing = false;

    const hasAutoDecryptLedger =
      Object.keys(this.state.autoDecryptAttempted || {}).length > 0 ||
      Object.keys(this.state.decryptingByKey || {}).length > 0;

    if (!hasAutoDecryptLedger) {
      if (this.state.autoDecryptEnabled) {
        try { this.queueAutoDecryptVisibleSweep(queueReason); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }
      return;
    }

    this.setState(
      { autoDecryptAttempted: {}, decryptingByKey: {} },
      () => {
        if (this.shouldAbortPileHydrationRequest(requestEpoch)) return;
        this._autoDecryptMaskedAttemptSignature = {};
        if (this.state.autoDecryptEnabled) {
          try { this.queueAutoDecryptVisibleSweep(resetQueueReason); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        }
      }
    );
  };

  rehydrateVisiblePileWindow = ({
    requestEpoch = null,
    forceOverwriteDraft = false,
    resetAutoDecryptLedger = false,
    autoDecryptReason = 'pile-hydration',
    autoDecryptResetReason = 'pile-hydration-reset',
  } = {}) => {
    if (this.shouldAbortPileHydrationRequest(requestEpoch)) return;
    this.rehydrateLocalCacheAnswersForRenderedIds(() => {
      if (this.shouldAbortPileHydrationRequest(requestEpoch)) return;
      if (typeof this.rehydrateDraftForRenderedIds === 'function') {
        this.rehydrateDraftForRenderedIds(forceOverwriteDraft);
      }
      if (!resetAutoDecryptLedger) return;
      this.resetPileAutoDecryptLedger({
        requestEpoch,
        queueReason: autoDecryptReason,
        resetQueueReason: autoDecryptResetReason,
      });
    });
  };

  runPileQuestionSetHydration = ({
    requestEpoch = null,
    resultSignature = '',
    initializeResponses = true,
    forceOverwriteDraft = false,
    resetAutoDecryptLedger = false,
    autoDecryptReason = 'pile-hydration',
    autoDecryptResetReason = 'pile-hydration-reset',
  } = {}) => {
    executePileQuestionSetHydration({
      requestEpoch,
      resultSignature,
      lastResultSignature: this._lastLoadAndSortResultSignature,
      initializeResponses,
      forceOverwriteDraft,
      resetAutoDecryptLedger,
      autoDecryptReason,
      autoDecryptResetReason,
      shouldAbortRequest: (nextRequestEpoch) => this.shouldAbortPileHydrationRequest(nextRequestEpoch),
      setLastResultSignature: (nextResultSignature) => {
        this._lastLoadAndSortResultSignature = nextResultSignature;
      },
      initializeResponseState: (callback) => this.initializeResponseState(callback),
      rehydrateVisiblePileWindow: (options) => this.rehydrateVisiblePileWindow(options),
      onNoop: () => {
        bumpSurveyPerfCounter('noopSkipCount');
      },
    });
  };



  initializeResponseState = (cb) => {
    executePileInitializeResponseState({
      isDirty: this.state.isDirty,
      modifiedCount: this.state.modifiedCount,
      pileQuestions: this.state.pileQuestions,
      activePileIndex: this.state.activePileIndex,
      lastInitializeResponseSig: this._lastInitializeResponseSig,
      buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      setLastInitializeResponseSig: (nextInitializeResponseSig) => {
        this._lastInitializeResponseSig = nextInitializeResponseSig;
      },
      cloneValue: this.deepClone,
      setState: this.setState.bind(this),
      onComplete: () => {
        if (typeof cb === 'function') cb();
      },
      onNoop: () => {
        bumpSurveyPerfCounter('noopSkipCount');
      },
    });
  };

  ensureVisiblePileResponseState = () => {
    executeEnsureVisiblePileResponseState({
      getState: () => this.state,
      buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      setState: this.setState.bind(this),
      onRehydrateVisibleWindow: () => {
        this.rehydrateVisiblePileWindow({
          forceOverwriteDraft: false,
          resetAutoDecryptLedger: false,
        });
      },
      onError: (error) => {
        surveyLog.error('ensureVisiblePileResponseState failed:', error);
      },
    });
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

  showNoPendingPileSubmitFeedback = (pileSubmitLabel = '') => {
    if (this._pileSubmitTimer) {
      clearTimeout(this._pileSubmitTimer);
      this._pileSubmitTimer = null;
    }

    const feedbackPlan = buildNoPendingPileSubmitFeedbackPlan({
      submitLabel: pileSubmitLabel,
    });

    this.setState(buildPileSubmitTempTextPatch(feedbackPlan.initialText));
    this._pileSubmitTimer = setTimeout(() => {
      this.setState(buildPileSubmitTempTextPatch(feedbackPlan.restoreText));
      this._pileSubmitTimer = setTimeout(() => {
        this.setState(buildPileSubmitTempTextPatch(feedbackPlan.clearText));
        this._pileSubmitTimer = null;
      }, feedbackPlan.clearDelayMs);
    }, feedbackPlan.initialDelayMs);
  };

  showTransientSubmitFeedback = (message = '', durationMs = 2000) => {
    if (this._emptySubmitTimer) {
      clearTimeout(this._emptySubmitTimer);
      this._emptySubmitTimer = null;
    }
    if (this._pileSubmitTimer) {
      clearTimeout(this._pileSubmitTimer);
      this._pileSubmitTimer = null;
    }
    const update = buildTransientSubmitFeedbackState({
      message,
      mirrorToPileSubmitText: true,
    });
    this.setState(update);
    if (!update.submissionError) return;
    this._emptySubmitTimer = setTimeout(() => {
      if (!this._isMounted) return;
      const clearUpdate = buildClearedTransientSubmitFeedbackState({
        mirrorToPileSubmitText: true,
      });
      this.setState(clearUpdate);
      this._emptySubmitTimer = null;
    }, normalizeTransientSubmitFeedbackDurationMs(durationMs));
  };

  handlePileSubmitClick = async () => {
    const pendingStats = this.getPendingStatsSnapshot();
    const pileSubmitLabel = (this.props.computeSubmitLabel || computeSubmitLabel)(this, {
      pendingStats,
    });
    const { pileSubmittedStateActive } = buildPileSubmitViewState({
      pendingStats,
      isSubmitting: this.state.isSubmitting,
      submittedSinceLastEdit: this.state.submittedSinceLastEdit,
      submissionComplete: this.state.submissionComplete,
      pileSubmitTempText: this.state.pileSubmitTempText,
      pileSubmitLabel,
      account: this.props.account,
      isAddress: utils.isAddress,
    });

    if (!this.props.loginComplete) {
      await this.encryptAndUpload();
      return;
    }
    if (pileSubmittedStateActive) return;
    const currentPending = this.getSubmitCount();
    if (currentPending === 0) {
      this.showNoPendingPileSubmitFeedback(pileSubmitLabel);
      return;
    }
    await this.encryptAndUpload();
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
    this.setState(buildPileFilterActivePatch(isActive));
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
        const responseCountsPlan = buildPileResponseCountsCachePlan({
          cacheKey: responseCountsCacheKey,
          previousCacheKey: this._responseCountsCacheKey,
          previousCacheValue: this._responseCountsCacheValue,
          questionResponses: allResponses,
        });
        responseCounts = responseCountsPlan.responseCounts;
        this._responseCountsCacheKey = responseCountsPlan.nextCacheKey;
        this._responseCountsCacheValue = responseCountsPlan.nextCacheValue;
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }

    const hlSet = new Set();
    scopeSlugs.forEach((scopeSlug) => {
      getHighlightedQuestionIdsSet(scopeSlug).forEach((questionId) => {
        hlSet.add(String(questionId || '').toLowerCase());
      });
    });
    const acctLower = (this.props.account || '').toLowerCase();
    const {
      visibleQuestions: sortedFilteredVisible,
      hasHiddenGatedQuestions: nextHiddenGated,
    } = buildPileQuestionPipelineState({
      questions: filteredArray,
      questionResponses: allResponses,
      responseCounts,
      highlightedQuestionIds: hlSet,
      account: acctLower,
    });
    const nextFilterState = normalizeSurveyToolFilterState(newFilterState || this.state.filterState);
    const filterResultPlan = buildPileFilterResultPlan({
      currentVisibleSignature: this.syncCurrentPileQuestionsSignature(this.state.pileQuestions || []),
      nextVisibleQuestions: sortedFilteredVisible,
      currentFilterState: this.state.filterState,
      nextFilterState,
      nextHiddenGated,
      currentHiddenGated: !!this.state.hasHiddenGatedQuestions,
      buildQuestionListSignature: this.buildQuestionListSignature,
      serializeFilterState: serializeSurveyToolFilterState,
    });

    if (filterResultPlan.shouldSkipStateUpdate) {
      bumpSurveyPerfCounter('noopSkipCount');
      return;
    }

    if (filterResultPlan.shouldIncrementPileQuestionsGeneration) {
      this._pileQuestionsGeneration += 1;
    }
    this.setState(filterResultPlan.nextState, () => {
        if (typeof this.props.onFilterChange === 'function') {
          try { this.props.onFilterChange(this.state.filterState); } catch (e) { surveyLog.warn('SurveyTool: callback', e); }
        }
        // Ensure state is initialized and hydrated for the new set of filtered questions.
        // This keeps edit baselines and prefilled answers aligned with the active pile window.
        this.runPileQuestionSetHydration({
          initializeResponses: true,
          forceOverwriteDraft: true,
          resetAutoDecryptLedger: true,
          autoDecryptReason: 'pile-filter-reset',
          autoDecryptResetReason: 'pile-filter-reset',
        });
    });
  };

  getIsPileSubmitRailVisible = () => {
    const pendingStats = this.getPendingStatsSnapshot?.() || { total: 0 };
    return !!(
      this.state.isSubmitting ||
      Number(pendingStats.total || 0) > 0 ||
      this.state.submittedSinceLastEdit ||
      this.state.submissionComplete
    );
  };

  notifyPileSubmitRailVisibility = () => {
    const nextVisible = this.getIsPileSubmitRailVisible();
    if (this._lastNotifiedPileSubmitRailVisible === nextVisible) return;
    this._lastNotifiedPileSubmitRailVisible = nextVisible;
    try {
      if (typeof this.props.onPileSubmitRailVisibilityChange === 'function') {
        this.props.onPileSubmitRailVisibilityChange(nextVisible);
      }
    } catch (e) { surveyLog.warn('SurveyTool: callback', e); }
  };

  renderPileResponseInput = ({
    question,
    answer,
    glowAnswer,
    maskedAnswer,
    allowDecryptAnswer,
    decryptTooltip,
    isAnswerDecrypting,
  }) => {
    if (maskedAnswer) {
      return (
        this.renderQuestionFieldDecryptControl({
          questionId: question.id,
          fieldKey: 'answer',
          allowDecrypt: allowDecryptAnswer,
          decryptTooltip,
          actionLabel: 'Decrypt Answer',
          busy: isAnswerDecrypting,
          showBusySpinnerWhenAutoDecryptEnabled: true,
          wrapperStyle: { marginBottom: 8 },
        })
      );
    }

    switch (question.type) {
      case 'binary':
        return (
          <BinaryChoiceInput
            questionId={question.id}
            value={answer.value}
            inputNamePrefix="q"
            onChange={(option) => this.handleAnswerPile(question.id, option)}
            disabled={this.state.isSubmitting}
          />
        );

      case 'multichoice': {
        const options = Array.isArray(question.options) ? question.options : [];
        const isSingleSelect = isSingleSelectMultichoice(question);
        const selectedValues = normalizeMultichoiceValue(answer.value);
        return (
          <MultichoiceQuestionInput
            questionId={question.id}
            options={options}
            selectedValues={selectedValues}
            isSingleSelect={isSingleSelect}
            disabled={this.state.isSubmitting}
            onChange={(nextValues) => this.handleAnswerPile(question.id, nextValues)}
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
      }

      case 'freeform':
      default:
        return (
          <SurveyAudioFieldInput
            {...this.getAudioInputWorkerProps()}
            placeholder={'Your response...'}
            value={answer.value || ''}
            updateFunction={(val) => this.handleAnswerPile(question.id, val)}
            toggleEncryption={(newState) =>
              this.toggleAnswerEncryption(0, question.id, newState)
            }
            disabled={this.state.isSubmitting}
            forceGlow={glowAnswer}
            disableEncryption={true}
            enableDownloads={false}
          />
        );
    }
  };

  renderPileSliderSection = ({
    questionId,
    showSlider,
    convictionValue,
    importanceValue,
    activeSliderValue,
    sliderMode,
    hasConvictionImportanceValue,
  }) => (
    <div className={styles.importanceSlider}>
      {showSlider ? (
        <ConvictionImportanceSliderControl
          label={this.renderConvictionImportanceLabel(questionId, convictionValue, importanceValue)}
          value={activeSliderValue}
          disabled={this.state.isSubmitting}
          onChange={(value, event) =>
            this.handleConvictionImportanceChange(
              0,
              questionId,
              sliderMode,
              value,
              this.getSliderPersistOptions(event)
            )}
          onChangeComplete={this.flushDraftPersistAfterSliderChange}
        />
      ) : (
        ENABLE_IMPORTANCE_SLIDER_TOGGLE ? (
          this.renderBullhornToggleButton({
            onClick: () => this.openConvictionSlider(questionId),
            disabled: this.state.isSubmitting,
            active: hasConvictionImportanceValue,
          })
        ) : (
          this.renderBullhornToggleButton({
            onClick: () => this.toggleConviction(questionId),
            disabled: this.state.isSubmitting,
            active: hasConvictionImportanceValue,
          })
        )
      )}
    </div>
  );

  renderPileAdditionalInput = ({
    questionId,
    additional,
    glowAdditional,
  }) => (
    <SurveyAudioFieldInput
      {...this.getAudioInputWorkerProps()}
      placeholder="Additional comments..."
      value={additional.value || ''}
      updateFunction={(val) => this.handleAdditionalPile(questionId, val)}
      toggleEncryption={(newState) =>
        this.toggleAdditionalCommentsEncryption(0, questionId, newState)
      }
      dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
      dataCeQuestionId={String(questionId || '').trim().toLowerCase()}
      disabled={this.state.isSubmitting}
      forceGlow={glowAdditional}
      encrypted={additional.encrypted || false}
      disableEncryption={true}
      enableDownloads={false}
    />
  );

  renderPileAdditionalEditorRow = ({
    questionId,
    additional,
    glowAdditional,
  }) => renderPileAdditionalEditorRow({
    input: this.renderPileAdditionalInput({
      questionId,
      additional,
      glowAdditional,
    }),
    lockControl: this.renderQuestionAdditionalLockControl({
      surveyIndex: 0,
      questionId,
      additional,
      glowAdditional,
      visualContext: 'pile',
    }),
  });

  renderPileCommentsSection = ({
    questionId,
    showComments,
    additional,
    glowAdditional,
    maskedAdditional,
    allowDecryptAdditional,
    decryptTooltip,
    isAdditionalDecrypting,
  }) => renderPileCommentsSection({
    showComments,
    maskedAdditional,
    decryptAdditionalControl: this.renderQuestionFieldDecryptControl({
      questionId,
      fieldKey: 'additional',
      allowDecrypt: allowDecryptAdditional,
      decryptTooltip,
      actionLabel: 'Decrypt Comments',
      busy: isAdditionalDecrypting,
      showBusySpinnerWhenAutoDecryptEnabled: true,
    }),
    additionalEditorRow: this.renderPileAdditionalEditorRow({
      questionId,
      additional,
      glowAdditional,
    }),
  });

  renderPileQuestionIcons = ({
    questionId,
    answer,
    glowAnswer,
    maskedAnswer,
    hasAdditionalContent,
  }) => renderPileQuestionIcons({
    questionId,
    hasAdditionalContent,
    onToggleComments: () => this.toggleComments(questionId),
    answerLockControl: this.renderQuestionAnswerLockControl({
      surveyIndex: 0,
      questionId,
      answer,
      glowAnswer,
      ...this.getAnswerLockDisplayState({
        field: answer,
        masked: maskedAnswer,
      }),
      visualContext: 'pile',
    }),
  });

  renderPileFooterSection = ({
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
  }) => renderPileFooterSection({
    sliderSection: this.renderPileSliderSection({
      questionId: question.id,
      showSlider,
      convictionValue,
      importanceValue,
      activeSliderValue,
      sliderMode,
      hasConvictionImportanceValue,
    }),
    questionIcons: this.renderPileQuestionIcons({
      questionId: question.id,
      answer,
      glowAnswer,
      maskedAnswer,
      hasAdditionalContent,
    }),
    commentsSection: this.renderPileCommentsSection({
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

  renderPileCardShell = ({
    question,
    questionComponent,
    questionContainerClass,
    footerSection,
  }) => renderPileCardShell({
    promptHeader: this.renderPromptWithManualDecrypt(question),
    questionComponent,
    questionContainerClass,
    footerSection,
  });

  renderPileGatedPromptCard = ({
    question,
  }) => renderPileGatedPromptCard({
    promptHeader: this.renderPromptWithManualDecrypt(question),
    gatedPromptNotice: this.renderGatedPromptNotice({
      question,
      tooltipIdSuffix: 'pile',
    }),
  });

  renderActiveQuestion = (question) => {
    const { surveysResponseState, showComments, showConviction } = this.state;
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
    } = this.getQuestionRenderDisplayState({
      questionId: question.id,
      responseSlice: slice,
    });

    const questionComponent = this.renderPileResponseInput({
      question,
      answer,
      glowAnswer,
      maskedAnswer,
      allowDecryptAnswer,
      decryptTooltip,
      isAnswerDecrypting,
    });

    const questionContainerClass = styles[`${question.type}QuestionContainer`] || '';
    const promptMasked = this.isQuestionPromptMasked(question);

    return renderPileActiveQuestionCard({
      question,
      promptMasked,
      renderQuestionMaskedPromptCard: this.renderQuestionMaskedPromptCard,
      promptHeader: this.renderPromptWithManualDecrypt(question),
      questionComponent,
      questionContainerClass,
      footerSection: this.renderPileFooterSection({
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
      showHologramAssistant,
      showListeningPanel,
    } = this.state;

    const hiddenMaskSource = (
      Array.isArray(this.state.allQuestionsForFilter) && this.state.allQuestionsForFilter.length > 0
    )
      ? this.state.allQuestionsForFilter
      : (Array.isArray(this.state.questionPool) ? this.state.questionPool : []);
    const { hiddenMaskedQuestionIds } = this.getMemoizedMaskedQuestionVisibility(hiddenMaskSource, false);

    const slug = resolveEffectiveSlug(this.props);
    const firstBoot = !hasCacheHydratedFlag(this.props);
    const recentRateLimit = this.isRecentRateLimit();
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
    const scanPercent = pileScanDisplay.percentComplete;
    const isFilterActive =
      !!this.state.isFilterActive ||
      isSurveyToolFilterStateActive(this.state.filterState);
    const hasFilterBaseQuestions = Array.isArray(this.state.allQuestionsForFilter) &&
      this.state.allQuestionsForFilter.length > 0;
    const hasSessionQuestionGate = this.hasRestrictedSessionQuestionGate(this.props);
    const pileWorkspaceViewState = buildPileWorkspaceViewState({
      pileQuestions,
      activePileIndex,
      loading,
      hiddenMaskedQuestionIds,
      hasHiddenGatedQuestions: !!this.state.hasHiddenGatedQuestions,
      firstBoot,
      cacheHasLoaded: this.props.cacheHasLoaded,
      isQuestionCacheReady: !!this.props.isQuestionCacheReady,
      recentRateLimit,
      scanRemainingBlocks: scanProgressDisplay.remainingBlocks,
      hydrateDiscovered: questionScanProgress?.discoveredQuestions,
      hydrateDone: questionScanProgress?.hydratedQuestions,
      pendingMetadataCount: questionScanProgress?.pendingMetadataCount,
      questionScanPhase: questionScanProgress?.phase,
      questionScanErrorMessage: questionScanProgress?.errorMessage,
      isHydratingPriorResponses: this.state.isHydratingPriorResponses,
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
    const lockedGateDetails = this.getMemoizedLockedQuestionGateDetails(hiddenMaskedQuestionIds);
    const isStillLoading = pileWorkspaceViewState.isStillLoading;

    /**
     * PILE MODE — Submit button label (central helper)
     */
    const _pileStats = this.getPendingStatsSnapshot();
    const pileSubmitLabel = (this.props.computeSubmitLabel || computeSubmitLabel)(this, {
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
      isSubmitting: this.state.isSubmitting,
      submittedSinceLastEdit: this.state.submittedSinceLastEdit,
      submissionComplete: this.state.submissionComplete,
      pileSubmitTempText: this.state.pileSubmitTempText,
      pileSubmitLabel,
      account: this.props.account,
      isAddress: utils.isAddress,
    });

    const gatedEmptyHasDetails = lockedGateDetails.length > 0;
    const gatedEmptyRequirementSentence = this.getLockedGateRequirementSentence(lockedGateDetails);
    const sessionGateDetails = gatedEmptyHasDetails
      ? lockedGateDetails
      : this.buildSessionQuestionGateDetails(1);
    const sessionGateRequirementSentence = this.getLockedGateRequirementSentence(sessionGateDetails);
    const gatedEmptyPanel = hiddenMaskedQuestionIds.length > 0
      ? (
        <div className={styles.gatedEmptyPanelShell}>
          {this.renderLockedQuestionsPanel({
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
      )
      : (
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
              toggleHologramAssistant: this.toggleHologramAssistant,
              showMiniBackgroundSpinner,
              priorResponsesHydrating,
              showLongLoading,
              loadingElapsedSec: this.state.loadingElapsedSec,
              pileQuestions,
              activePileIndex,
              renderActiveQuestion: this.renderActiveQuestion,
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
              toggleFilterModal: this.toggleFilterModal,
              showCreate,
              toggleCreate: this.toggleCreate,
              showListeningPanel,
              toggleListeningPanel: this.toggleListeningPanel,
              onViewAllClick: this.props.onViewAllClick,
              handleViewAllFromPile: this.handleViewAllFromPile,
              pileTopRailVisible,
              showSuccessBadgeLink,
              pileSubmitResponderHref,
              showSuccessBadgeStatus,
              showSubmitButton,
              handlePileSubmitClick: this.handlePileSubmitClick,
              hasPendingPileChanges,
              shouldHidePileSubmitButton,
              isSubmitting: this.state.isSubmitting,
              activePromptMasked,
              finalSubmitText,
              showClearPendingButton,
              handleRevertPendingChanges: this.handleRevertPendingChanges,
              navCounterVisible,
              handlePrev: this.handlePrev,
              handleNext: this.handleNext,
            })}
          </div>
          {showListeningAside && (
            <div className={styles.sessionListeningPanelAnchor} ref={this.listeningPanelRef}>
              <React.Suspense fallback={<LazyFallback label="Loading Listening Panel..." minHeight="160px" />}>
                <LazySessionListeningPanel
                  {...this.props}
                  {...this.getAudioInputWorkerProps()}
                  onClose={this.closeListeningPanel}
                />
              </React.Suspense>
            </div>
          )}
        </div>

        {!showHologramAssistant && showCreate && (
          <div className={styles.pileFullControls} ref={this.createSectionRef}>
            <React.Suspense fallback={<LazyFallback label="Loading Question Authoring..." minHeight="160px" />}>
              <LazyPileCreateQuestionsAndSurveys
                {...this.props}
                hideSurveyQuestionToggleUntilAuthoring={true}
              />
            </React.Suspense>
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

export default PileViewMode;
