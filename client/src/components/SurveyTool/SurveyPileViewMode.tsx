// @ts-nocheck
/** @file SurveyPileViewMode.tsx */

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
    this.notifyPileSubmitRailVisibility();
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
      this.resetBlockedAutoDecryptSweepInternals();
      if (this.state.autoDecryptEnabled || (this.state.decryptingByKey && Object.keys(this.state.decryptingByKey).length > 0)) {
        this.setState(buildAutoDecryptDisabledState());
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
  }) => (
    <div className={styles.pileAdditionalEditor}>
      <AdditionalCommentsInlineRow
        input={this.renderPileAdditionalInput({
          questionId,
          additional,
          glowAdditional,
        })}
        lockControl={this.renderQuestionAdditionalLockControl({
          surveyIndex: 0,
          questionId,
          additional,
          glowAdditional,
          visualContext: 'pile',
        })}
      />
    </div>
  );

  renderPileCommentsSection = ({
    questionId,
    showComments,
    additional,
    glowAdditional,
    maskedAdditional,
    allowDecryptAdditional,
    decryptTooltip,
    isAdditionalDecrypting,
  }) => {
    if (!showComments) return null;

    return (
      <div className={styles.pileCommentsRow}>
        {maskedAdditional ? (
          this.renderQuestionFieldDecryptControl({
            questionId,
            fieldKey: 'additional',
            allowDecrypt: allowDecryptAdditional,
            decryptTooltip,
            actionLabel: 'Decrypt Comments',
            busy: isAdditionalDecrypting,
            showBusySpinnerWhenAutoDecryptEnabled: true,
          })
        ) : (
          this.renderPileAdditionalEditorRow({
            questionId,
            additional,
            glowAdditional,
          })
        )}
      </div>
    );
  };

  renderPileQuestionIcons = ({
    questionId,
    answer,
    glowAnswer,
    maskedAnswer,
    hasAdditionalContent,
  }) => (
    <div className={styles.pileCardIcons}>
      <button
        className={`${styles.iconButton} ${styles.commentButton} ${hasAdditionalContent ? styles.iconButtonActive : ''}`}
        onClick={() => this.toggleComments(questionId)}
        data-testid={E2E_TESTIDS.SURVEY_ADDITIONAL_TOGGLE}
        data-ce-question-id={String(questionId || '').trim().toLowerCase()}
      >
        <FontAwesomeIcon icon={faComment} className={hasAdditionalContent ? styles.iconGlow : undefined} />
      </button>

      {this.renderQuestionAnswerLockControl({
        surveyIndex: 0,
        questionId,
        answer,
        glowAnswer,
        ...this.getAnswerLockDisplayState({
          field: answer,
          masked: maskedAnswer,
        }),
        visualContext: 'pile',
      })}
    </div>
  );

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
  }) => (
    <div className={styles.pileCardFooter}>
      <div className={styles.pileControlsRow}>
        {this.renderPileSliderSection({
          questionId: question.id,
          showSlider,
          convictionValue,
          importanceValue,
          activeSliderValue,
          sliderMode,
          hasConvictionImportanceValue,
        })}
        {this.renderPileQuestionIcons({
          questionId: question.id,
          answer,
          glowAnswer,
          maskedAnswer,
          hasAdditionalContent,
        })}
      </div>

      {this.renderPileCommentsSection({
        questionId: question.id,
        showComments,
        additional,
        glowAdditional,
        maskedAdditional,
        allowDecryptAdditional,
        decryptTooltip,
        isAdditionalDecrypting,
      })}
    </div>
  );

  renderPileCardShell = ({
    question,
    questionComponent,
    questionContainerClass,
    footerSection,
  }) => (
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

        {footerSection}
      </CardBody>
    </Card>
  );

  renderPileGatedPromptCard = ({
    question,
  }) => (
    <Card className={styles.pileCardInner}>
      <CardBody className={styles.pileCardBody}>
        <div className={styles.pileCardHeader}>
          {this.renderPromptWithManualDecrypt(question)}
        </div>
        {this.renderGatedPromptNotice({
          question,
          tooltipIdSuffix: 'pile',
        })}
      </CardBody>
    </Card>
  );

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

    const promptMasked = this.isQuestionPromptMasked(question);
    if (promptMasked) {
      return this.renderQuestionMaskedPromptCard({
        mode: 'pile',
        question,
      });
    }

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

    return this.renderPileCardShell({
      question,
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
    const hasPendingPileChanges = _pileStats.total > 0;
    const pileSubmittedStateActive = !!(this.state.submittedSinceLastEdit || this.state.submissionComplete);
    const showPileSubmitSuccessBadge = pileSubmittedStateActive && !this.state.isSubmitting;
    const shouldHidePileSubmitButton = (
      !hasPendingPileChanges &&
      !this.state.isSubmitting &&
      !pileSubmittedStateActive
    );
    const finalSubmitText = this.state.pileSubmitTempText || pileSubmitLabel;
    const pileSubmitResponderAddress = String(this.props.account || '').trim();
    const pileSubmitResponderAddressLower =
      pileSubmitResponderAddress && utils.isAddress(pileSubmitResponderAddress)
        ? pileSubmitResponderAddress.toLowerCase()
        : '';
    const pileSubmitResponderHref = pileSubmitResponderAddressLower
      ? `/u/${pileSubmitResponderAddressLower}`
      : '';

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

    const pileTopRailVisible = this.state.isSubmitting || _pileStats.total > 0 || pileSubmittedStateActive;

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
      <div className={`${styles.pileFooter}${pileTopRailVisible ? '' : ` ${styles.pileFooterHidden}`}`}>
        {showPileSubmitSuccessBadge ? (
          pileSubmitResponderHref ? (
            <a
              href={pileSubmitResponderHref}
              className={styles.pileSubmitSuccessBadge}
              data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}
              aria-label="View your submitted responses"
              title="View your submitted responses"
            >
              <FontAwesomeIcon icon={faCheck} className={styles.pileSubmitSuccessIcon} />
            </a>
          ) : (
            <div
              className={styles.pileSubmitSuccessBadge}
              data-testid={E2E_TESTIDS.SURVEY_SUBMITTED_INDICATOR}
              role="status"
              aria-label="Submitted"
              title="Submitted"
            >
              <FontAwesomeIcon icon={faCheck} className={styles.pileSubmitSuccessIcon} />
            </div>
          )
        ) : (
          <Button
            onClick={handleSubmitClick}
            data-testid={E2E_TESTIDS.SURVEY_SUBMIT}
            className={`${styles.pileSubmitButton}${hasPendingPileChanges ? ` ${styles.submitGlow}` : ''}${shouldHidePileSubmitButton ? ` ${styles.pileSubmitButtonInactive}` : ''}`}
            disabled={this.state.isSubmitting || activePromptMasked}
          >
            {this.state.isSubmitting ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <span className={styles.pileSubmitButtonContent}>
                <span className={styles.pileSubmitButtonLabel}>{finalSubmitText}</span>
                <span className={styles.pileSubmitButtonTrail} aria-hidden="true">
                  <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
                  <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
                  <FontAwesomeIcon icon={faChevronRight} className={styles.pileSubmitButtonTrailIcon} />
                </span>
              </span>
            )}
          </Button>
        )}

        {hasPendingPileChanges && !this.state.isSubmitting && !pileSubmittedStateActive && (
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
            <CreateQuestionsAndSurveys
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

export default PileViewMode;
