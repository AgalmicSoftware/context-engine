// @ts-nocheck
/** @file SurveyQuestions.tsx */

import React, { Component } from 'react';
import {
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
import '../../assets/css/contextEngine.scss';
import styles from './SurveyTool.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faLock,
  faUnlock,
  faPlus,
  faMinus,
  faCaretDown,
  faCheck,
  faSpinner,
  faFilter,
  faMicrophone,
  faChevronLeft,
  faChevronRight,
  faComment,
  faRobot,
} from '@fortawesome/free-solid-svg-icons';

import QuestionFilter from './QuestionFilter';
import PileHologramAssistant from './PileHologramAssistant';
import AdditionalCommentsInlineRow from './AdditionalCommentsInlineRow';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import SingleQuestionResponse from './SingleQuestionResponse';
import TagModal from '../TagPage/TagModal';
import BullhornToggleButton from './BullhornToggleButton';
import ConvictionImportanceLabel from './ConvictionImportanceLabel';
import ConvictionImportanceSliderControl from './ConvictionImportanceSliderControl';
import DeferredConvictionImportanceSlider from './DeferredConvictionImportanceSlider';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import FullQuestionHeader from './FullQuestionHeader';
import GatedPromptNotice from './GatedPromptNotice';
import QuestionDecryptControl from './QuestionDecryptControl';
import QuestionCardLinks from './QuestionCardLinks';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import SurveyQuestionsFullQuestionCardShell from './SurveyQuestionsFullQuestionCardShell';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import SurveyQuestionsLockedQuestionsPanel from './SurveyQuestionsLockedQuestionsPanel';
import SurveyQuestionsAuthoringPanel from './SurveyQuestionsAuthoringPanel';
import SurveyQuestionsJsonControls from './SurveyQuestionsJsonControls';
import SurveyQuestionsJsonTree from './SurveyQuestionsJsonTree';
import SurveyQuestionsResponseView from './SurveyQuestionsResponseView';
import SurveyQuestionsSubmitFooter from './SurveyQuestionsSubmitFooter';
import SurveyQuestionsSurveyAnswersView from './SurveyQuestionsSurveyAnswersView';
import { isPendingQuestionMetadataPlaceholder } from './surveyQuestionMetadataPlaceholders.js';
import {
  processRatingEnvelopesForSubmit,
  type RatingEnvelopeDeps,
  type RatingEnvelopeContext,
} from './surveyToolRatingEnvelopeSubmitController';
import { writeSubmittedResponsesToLocalCaches as writeSubmittedResponsesToLocalCachesHelper } from './surveyToolPostSubmitCacheController';
import {
  ensureIdentifierHash,
  filterChangedResponsesForSubmit,
  normalizeSubmitReceipt,
} from './surveyToolSubmitTransactionController';
import {
  applyQuestionDecryptCompletionStatus as applyQuestionDecryptCompletionStatusHelper,
  applyQuestionDecryptFailureStatus as applyQuestionDecryptFailureStatusHelper,
  applySurveyDecryptStaleStatus as applySurveyDecryptStaleStatusHelper,
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
import { sessionRegistryStore } from '../../utilities/web3/sessionRegistry.js';
import * as passkeyWallet from '../../wallet/passkeyWallet.js';
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
import { getTemporaryDemoSessionQuestionFixtures } from '../../utilities/session/demoSessionQuestionFixtures.js';
import { buildQuestionDecryptContextForSession } from '../../utilities/session/sessionQuestionDecryption.js';
import {
  buildQuestionRoutePath,
  isMaskedQuestionPayload,
  parseQuestionSessionIdFromSearch,
  parseQuestionSessionSlugFromSearch,
  pickBetterQuestionPayload,
  resolveQuestionPayloadDisplayState,
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
  buildQuestionPromptDecryptDisplayState,
  isQuestionPromptMasked,
} from './surveyToolViewState.js';
import { buildResponseGateConfigSignature } from './surveyToolResponseAccess';
import { decideAutoDecryptBlocked, decideAutomaticPromptDecryptByKind } from './surveyQuestionsDecryptEligibility.js';
import {
  buildDecryptContextKeyFromContext,
  buildResponseGatePolicyCacheKeyFromInputs,
} from './surveyQuestionsCacheKeys.js';
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
  mergePersistedDraftPayloads,
  ensureQuestionsNet,
  ensureSurveysNet,
  getActiveSessionSlugFromProps,
  getBlockedQuestionIdsSet,
  getConvictionFromResponse,
  getConvictionFromSlice,
  getConvictionFromSliceStrict,
  getExtraQuestionReadSlugs,
  getHighlightedQuestionIdsSet,
  getImportanceFromResponse,
  getImportanceFromSlice,
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
  isSurveyToolFilterStateActive,
  mergeDecryptedViewedResponse,
  mergeQuestionResponses,
  mergeSurveyResponsePayloads,
  normalizeQuestionIdKey,
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
import {
  buildSurveyLocalCacheSlice,
  executeSurveyResponsePrefill,
  executeSurveySingleQuestionPrefill,
  executeSurveyDraftHydration,
  executeSurveyLocalCacheRehydrate,
  executeSurveyPriorResponseBackfill,
  resolveSurveyMissingRenderedResponseLookup,
} from './surveyToolHydrationController';
import {
  executeSurveyExitEditing,
  executeSurveyFormStateReset,
  executeSurveyPendingRevert,
  executeSurveyStartFresh,
  shouldSurveyAutoStartFresh,
} from './surveyToolResponseResetController';
import {
  executeOwnSingleQuestionResponseBootstrap,
  executeViewedSingleQuestionResponseBootstrap,
  readFreshSingleQuestionCachedResponderResponse,
  readSingleQuestionCachedResponderResponse,
  writeSingleQuestionResponseToCache,
} from './surveyToolSingleQuestionController';
import {
  resolveSingleQuestionCacheBootstrap,
} from './surveyToolSingleQuestionCacheBootstrapController';
import {
  buildSingleQuestionEncryptedMetadataPlaceholder,
  fetchSingleQuestionMetadataCandidates,
  normalizeSingleQuestionMetadataForCache,
  resolveSingleQuestionCacheState,
} from './surveyToolSingleQuestionMetadataController';
import { resolveSingleQuestionMetadataBootstrap } from './surveyToolSingleQuestionMetadataBootstrapController';
import {
  areSurveyResponsesConsistent,
  resolveSurveyBaselineSourceSlice,
  resolveSurveyUserAnswersSlice,
} from './surveyToolResponseSourceController';
import { buildAnswerUpdatePlan, buildAdditionalUpdatePlan } from './surveyToolResponseMutationController';
import { buildResponsePayload } from './surveyToolResponsePayloadController';
import {
  buildIndexedQuestionEntryKeys,
  computePendingEditStats,
  orchestrateGetChangedQidsAndFields,
} from './surveyToolChangedFieldsController';
import {
  getQuestionEncryptionGates as getQuestionEncryptionGatesCore,
  normalizeFieldAudienceMode as normalizeFieldAudienceModeCore,
  normalizeResponseEncryptionAudience as normalizeResponseEncryptionAudienceCore,
  resolveFieldEncryptionAudience as resolveFieldEncryptionAudienceCore,
  buildEmptyResponseFieldState as buildEmptyResponseFieldStateCore,
  buildInheritedAdditionalFieldState as buildInheritedAdditionalFieldStateCore,
  normalizeGateLabelText as normalizeGateLabelTextCore,
} from './surveyToolAudienceDerivationController';
import {
  buildRecipientsFromGates as buildRecipientsFromGatesController,
  buildGateAudienceSbtItems as buildGateAudienceSbtItemsController,
  getQuestionGateOptions as getQuestionGateOptionsController,
  getResponseGateOptions as getResponseGateOptionsController,
  getResponseGateOptionById as getResponseGateOptionByIdController,
  resolveFieldEncryptionGateId as resolveFieldEncryptionGateIdController,
  getEffectiveRecipientsForField as getEffectiveRecipientsForFieldController,
  resolveGatedPromptGateNames as resolveGatedPromptGateNamesController,
  resolveGateDisplayLabel as resolveGateDisplayLabelController,
  resolveConfiguredGateLabel as resolveConfiguredGateLabelController,
  resolveLockAudienceSessionName as resolveLockAudienceSessionNameController,
} from './surveyToolResponseGateController';
import {
  buildLockedGateRequirementSentence as buildLockedGateRequirementSentenceCore,
  buildLockedQuestionGateDetailsFromPool,
} from './surveyQuestionGateDetails';
import {
  buildEncryptionTogglePlan,
  buildAnswerAudienceSelectionPlan,
  buildAdditionalAudienceSelectionPlan,
} from './surveyToolFieldEncryptionController';
import {
  buildFieldEncryptionWorkGroups as buildFieldEncryptionWorkGroupsCore,
  verifyEncryptionIntegrity,
} from './surveyToolSubmitPrepController';
import {
  buildCanDecryptContext,
  evaluateCanDecryptPreCheck,
  resolveCanDecryptGateAccess,
} from './surveyToolCanDecryptController';

import { SurveySelector, QuestionsDashboard } from './SurveySelector';
import {
  buildInitialSurveyResponseQuestionIds,
  buildRenderedQuestionIdsFromQuestionPools,
  readRenderedQuestionIds,
} from './surveyQuestionScope.js';
import {
  buildSubmittedResponseJson,
  buildSurveyDefinitionJson,
  buildSurveyQuestionsJson,
  shouldUseSubmittedResponseJson,
} from './surveyQuestionsJsonDerivation.js';
import { buildSurveyQuestionsRouteJsonControlsProps } from './surveyQuestionsRouteJsonControlsProps.js';
import {
  buildClearedTransientSubmitFeedbackState,
  buildQuestionPoolPendingSubmitFeedbackMessage,
  buildTransientSubmitFeedbackState,
  normalizeTransientSubmitFeedbackDurationMs,
} from './surveyQuestionSubmitFeedback.js';
import {
  resolveSurveyQuestionsSubmitPendingStats,
  resolveSubmitEffectiveDraftSlug,
  runSurveyQuestionsSubmitController,
  runSurveyQuestionsSubmitFailureController,
  runSurveyQuestionsSubmitSuccessController,
} from './surveyQuestionsSubmitController.js';
import {
  buildActiveTagModalState,
  buildAutoDecryptDisabledState,
  buildBookmarkedQuestionsState,
  buildBulkPromptReloadingState,
  buildCanDecryptOtherResponsesState,
  buildClearedSurveyQuestionPoolState,
  buildCopiedQuestionsJsonState,
  buildCopiedResponseJsonState,
  buildCopiedSurveyJsonState,
  buildClearedDecryptingByKeyState,
  buildCurrentStepState,
  buildDecryptEditFailureState,
  buildDecryptEditStartState,
  buildDisplayAnswerModeState,
  buildEditingResponseModeState,
  buildHasherState,
  buildHydratingPriorResponsesState,
  buildInitialSurveyQuestionsState,
  buildJsonPreviewState,
  buildParsedViewAddressAnswersState,
  buildPrefillQueuedAfterCacheState,
  buildResponseEditCompleteState,
  buildResponseLoadingResetState,
  buildShowJsonState,
  buildSubmitPreparationErrorState,
  buildStandaloneAuthResetState,
  buildSubmissionErrorState,
  buildSubmitStartState,
  buildSurveysResponseStatePatch,
  buildSurveyAccountViewResetState,
  buildSurveyChangedResetState,
  buildSurveyQuestionsFullLoadingProgressState,
  buildSurveyQuestionsJsonForDisplayState,
  buildSurveyQuestionsJsonPanelDisplayState,
  buildSurveyQuestionsLayoutDisplayState,
  buildSurveyQuestionsRouteViewDisplayState,
  buildSurveyQuestionsSubmitFooterDisplayState,
  buildSurveyQuestionPoolLoadState,
  buildSurveyUserEditResponseStatePatch,
  buildViewingResponseModeState,
  toggleShowJsonState,
  type SurveyQuestionsProps,
  type SurveyQuestionsState,
} from './surveyQuestionsTypes.js';


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
      activeTagModalTag: '',
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

type SurveyQuestionsRecord = Record<string, any>;

export interface SurveyQuestions {
  setState: (...args: any[]) => any;
  _emptySubmitTimer: any;
}


  _persistTimer = null;
  _draftParseCache = null;
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
  _fetchSurveyResponseRunId = 0;
  _fetchSingleQuestionRunId = 0;
  _localCacheRehydrateRunId = 0;
  _responseHydrationStateUpdateDepth = 0;
  _surveyDecryptAttemptSeq = 0;
  _activeSurveyDecryptAttemptSeq = 0;
  _submitAttemptSeq = 0;
  _activeSubmitAttemptSeq = 0;
  _questionDecryptBusyTokenSeq = 0;
  _questionDecryptBusyTokens = {};
  _singleQuestionBootstrapRetryTimer = null;
  _singleQuestionBootstrapRetrySig = '';
  _isMounted = false;
  _hasMounted = false;
  _autoDecProcessTimer = null;
  _autoDecryptSweepMicrotaskScheduled = false;
  _autoDecryptSweepFrameRequestId = null;
  _queuedAutoDecryptSweepReasons = new Set();
  _gateSbtHydrationSig = '';
  _gateSbtHydrationRetryTimer = null;

  const getRuntimeStrategy = (): SurveyQuestionsRuntimeStrategy | null =>
    propsRef.current.runtimeStrategy && typeof propsRef.current.runtimeStrategy === 'object'
      ? propsRef.current.runtimeStrategy
      : null;

  const isPasskeyWalletAutoSignReady = () => {
    try {
      return !!(
        typeof passkeyWallet.isPasskeyWalletAutoSignReady === 'function' && passkeyWallet.isPasskeyWalletAutoSignReady()
      );
    } catch (_: any) {
      return false;
    }
  };

  const isAutoDecryptBlocked = () => {
    try {
      const kind: SurveyQuestionsLegacyValue = (cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind(
        propsRef.current.provider,
      );
      return decideAutoDecryptBlocked(kind, () => isPasskeyWalletAutoSignReady());
    } catch (_: any) {
      return false;
    }
  };

  const shouldAttemptAutomaticPromptDecrypt = () => {
    if (!propsRef.current.loginComplete || !propsRef.current.account || !propsRef.current.provider) return false;
    try {
      const kind: SurveyQuestionsLegacyValue = (cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind(
        propsRef.current.provider,
      );
      return decideAutomaticPromptDecryptByKind(kind, () => isPasskeyWalletAutoSignReady());
    } catch (_: any) {
      return false;
    }
  };

  const _applyDraftTrackingState = (tracking: SurveyQuestionsDraftTrackingState = {}) => {
    if (!tracking || typeof tracking !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(tracking, 'draftParseCache')) {
      this._draftParseCache = tracking.draftParseCache ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(tracking, 'lastDraftKey')) {
      this._lastDraftKey = String(tracking.lastDraftKey || '');
    }
    if (Object.prototype.hasOwnProperty.call(tracking, 'lastDraftJSON')) {
      this._lastDraftJSON = tracking.lastDraftJSON ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(tracking, 'lastDraftSemanticSignature')) {
      this._lastDraftSemanticSignature = tracking.lastDraftSemanticSignature ?? null;
    }
  };

  const invalidateResponseHydrationRuns = () => {
    inst._fetchSurveyResponseRunId = (Number(inst._fetchSurveyResponseRunId) || 0) + 1;
    inst._fetchSingleQuestionRunId = (Number(inst._fetchSingleQuestionRunId) || 0) + 1;
    inst._questionPoolHydrationRunId = (Number(inst._questionPoolHydrationRunId) || 0) + 1;
    inst._localCacheRehydrateRunId = (Number(inst._localCacheRehydrateRunId) || 0) + 1;
    if (inst._isMounted && stateRef.current.isLoadingResponse) {
      setState(buildResponseHydrationInvalidatedState());
    }
  };

  const setResponseHydrationState = (next: SurveyQuestionsStateUpdate, callback?: SurveyQuestionsSetStateCallback) => {
    inst._responseHydrationStateUpdateDepth += 1;
    const release = () => {
      inst._responseHydrationStateUpdateDepth = Math.max(0, (Number(inst._responseHydrationStateUpdateDepth) || 0) - 1);
    };

    try {
      return this.setState(next, (...args) => {
        try {
          return typeof callback === 'function' ? callback(...args) : undefined;
        } finally {
          release();
        }
      });
    } catch (error) {
      release();
      throw error;
    }
  };

  const _applyDraftHydrationEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    draftEntry = null,
    allowOverwrite = false,
  } = {}) => {
    if (!targetSlice || !draftEntry) return false;
    const patch = buildDraftHydrationPatchForQuestion({
      questionId,
      draftEntry,
      currentAnswer: targetSlice.answers?.[questionId],
      currentAdditional: targetSlice.additionalComments?.[questionId],
      hasCurrentImportance: Object.prototype.hasOwnProperty.call(targetSlice.importance || {}, questionId),
      hasCurrentConviction: Object.prototype.hasOwnProperty.call(targetSlice.conviction || {}, questionId),
      allowOverwrite,
      deps: {
        normalizeResponseEncryptionAudience: this.normalizeResponseEncryptionAudience,
        normalizeFieldAudienceMode: this.normalizeFieldAudienceMode,
        buildInheritedAdditionalFieldState: this.buildInheritedAdditionalFieldState,
        buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      },
    });
    if (patch.answerState) targetSlice.answers[questionId] = patch.answerState;
    if (patch.additionalState) targetSlice.additionalComments[questionId] = patch.additionalState;
    if (patch.importanceChanged) targetSlice.importance[questionId] = patch.importanceValue;
    if (patch.convictionChanged) targetSlice.conviction[questionId] = patch.convictionValue;
    return !!patch.changed;
  };

  const _applyResponseHydrationEntryToSlice = ({
    targetSlice = null,
    currentSlice = null,
    questionId = '',
    response = null,
    allowOverwrite = false,
    parseValue = this.parseAnswerValue,
  } = {}) => {
    if (!targetSlice || !response) return false;
    const sourceSlice = currentSlice || targetSlice;
    const patch = buildQuestionResponseHydrationPatch({
      questionId,
      response,
      currentAnswer: sourceSlice?.answers?.[questionId],
      currentAdditional: sourceSlice?.additionalComments?.[questionId],
      hasCurrentImportance: Object.prototype.hasOwnProperty.call(sourceSlice?.importance || {}, questionId),
      hasCurrentConviction: Object.prototype.hasOwnProperty.call(sourceSlice?.conviction || {}, questionId),
      allowOverwrite,
      deps: {
        parseValue,
        areEnvelopesEquivalent,
        normalizeResponseEncryptionAudience: this.normalizeResponseEncryptionAudience,
        getDefaultResponseEncryptionAudienceForQid: this.getDefaultResponseEncryptionAudienceForQid,
        resolveFieldEncryptionGateId: this.resolveFieldEncryptionGateId,
        normalizeFieldAudienceMode: this.normalizeFieldAudienceMode,
        buildInheritedAdditionalFieldState: this.buildInheritedAdditionalFieldState,
        buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      },
    });
    if (patch.answerState) targetSlice.answers[questionId] = patch.answerState;
    if (patch.additionalState) targetSlice.additionalComments[questionId] = patch.additionalState;
    if (patch.importanceChanged) targetSlice.importance[questionId] = patch.importanceValue;
    if (patch.convictionChanged) targetSlice.conviction[questionId] = patch.convictionValue;
    return !!patch.changed;
  };

  const _applyResponseHydrationListToSlice = ({
    targetSlice = null,
    currentSlice = null,
    responses = [],
    allowOverwrite = false,
    parseValue = parseAnswerValue,
    questionIdResolver = (response: unknown) => {
      const responseRecord = response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
      return normalizeQuestionIdKey(responseRecord.questionID || responseRecord.questionId);
    },
  }: SurveyQuestionsResponseHydrationListArgs = {}) => {
    if (!targetSlice) return false;
    const list = Array.isArray(responses) ? responses : [responses];
    let changed = false;
    list.forEach((response) => {
      const qid = questionIdResolver(response);
      if (!qid) return;
      if (
        inst._applyResponseHydrationEntryToSlice({
          targetSlice,
          currentSlice,
          questionId: qid,
          response,
          allowOverwrite,
          parseValue,
        })
      ) {
        changed = true;
      }
    });
    return changed;
  };

  const _applyCachedResponseEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    response = null,
    parseValue = this.parseAnswerValue,
  } = {}) => {
    if (!targetSlice || !response) return false;
    const patch = buildQuestionCacheHydrationPatch({
      questionId,
      response,
      deps: {
        parseValue,
        normalizeResponseEncryptionAudience: this.normalizeResponseEncryptionAudience,
        getDefaultResponseEncryptionAudienceForQid: this.getDefaultResponseEncryptionAudienceForQid,
        resolveFieldEncryptionGateId: this.resolveFieldEncryptionGateId,
        normalizeFieldAudienceMode: this.normalizeFieldAudienceMode,
        buildInheritedAdditionalFieldState: this.buildInheritedAdditionalFieldState,
        buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      },
    });
    if (patch.answerState) targetSlice.answers[questionId] = patch.answerState;
    if (patch.additionalState) targetSlice.additionalComments[questionId] = patch.additionalState;
    if (patch.importanceChanged) targetSlice.importance[questionId] = patch.importanceValue;
    if (patch.convictionChanged) targetSlice.conviction[questionId] = patch.convictionValue;
    return !!patch.changed;
  };

  const _applyLocalCacheHydrationEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    cachedAnswer = null,
    cachedAdditional = null,
    cachedImportance = undefined,
    cachedConviction = undefined,
    allowMaskedAnswerDraftEmpty = false,
    allowMaskedAdditionalDraftEmpty = false,
    debugLabel = '',
  } = {}) => {
    if (!targetSlice || !questionId) return false;
    let changed = false;

    if (
      cachedAnswer &&
      (allowMaskedAnswerDraftEmpty ||
        targetAnswers?.[questionId]?.value === undefined ||
        (targetAnswers?.[questionId]?.value === '' && !targetAnswers?.[questionId]?.encryptedPortion))
    ) {
      targetSlice.answers[questionId] = {
        ...(targetSlice.answers[questionId] || {}),
        ...cachedAnswer,
      };
      changed = true;
      if (debugLabel) {
        DEBUG_PREFILL &&
          surveyLog.log(`${debugLabel} Hydrated answer for qid=${questionId}`, {
            fromCache: cachedAnswer,
          });
      }
    }

    if (
      cachedAdditional &&
      (allowMaskedAdditionalDraftEmpty ||
        targetAdditional?.[questionId]?.value === undefined ||
        (targetAdditional?.[questionId]?.value === '' && !targetAdditional?.[questionId]?.encryptedPortion))
    ) {
      targetSlice.additionalComments[questionId] = {
        ...(targetSlice.additionalComments[questionId] || {}),
        ...cachedAdditional,
      };
      changed = true;
      if (debugLabel) {
        DEBUG_PREFILL &&
          surveyLog.log(`${debugLabel} Hydrated additional for qid=${questionId}`, {
            fromCache: cachedAdditional,
          });
      }
    }

    if (
      cachedImportance !== undefined &&
      cachedImportance !== null &&
      !Object.prototype.hasOwnProperty.call(targetSlice.importance || {}, questionId)
    ) {
      targetSlice.importance[questionId] = Number(cachedImportance);
      changed = true;
      if (debugLabel) {
        DEBUG_PREFILL &&
          surveyLog.log(`${debugLabel} Hydrated importance for qid=${questionId}`, {
            fromCache: cachedImportance,
          });
      }
    }

    if (
      cachedConviction !== undefined &&
      cachedConviction !== null &&
      !Object.prototype.hasOwnProperty.call(targetSlice.conviction || {}, questionId)
    ) {
      targetSlice.conviction[questionId] = Number(cachedConviction);
      changed = true;
      if (debugLabel) {
        DEBUG_PREFILL &&
          surveyLog.log(`${debugLabel} Hydrated conviction for qid=${questionId}`, {
            fromCache: cachedConviction,
          });
      }
    }

    return changed;
  };

  const setManagedTimeout = (fn: SurveyQuestionsTimeoutCallback, delayMs: unknown = 0) => {
    const timeoutId = setTimeout(
      () => {
        inst._transientTimeouts.delete(timeoutId);
        if (!inst._isMounted) return;
        try {
          fn();
        } catch (e: unknown) {
          surveyLog.warn('SurveyTool: callback', e);
        }
      },
      Math.max(0, Number(delayMs) || 0),
    );
    inst._transientTimeouts.add(timeoutId);
    return timeoutId;
  };

  const clearManagedTimeouts = () => {
    if (!inst._transientTimeouts || inst._transientTimeouts.size === 0) return;
    inst._transientTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this._transientTimeouts.clear();
  };

  const clearSingleQuestionBootstrapRetry = () => {
    if (inst._singleQuestionBootstrapRetryTimer) {
      clearTimeout(inst._singleQuestionBootstrapRetryTimer);
      inst._singleQuestionBootstrapRetryTimer = null;
    }
    this._singleQuestionBootstrapRetrySig = '';
  };

  const getPendingSingleQuestionBootstrapRetryAttempt = (questionId: unknown = '') => {
    const qid = String(questionId || propsRef.current.questionID || '')
      .trim()
      .toLowerCase();
    if (!qid) return 0;
    const currentRetrySig = String(inst._singleQuestionBootstrapRetrySig || '')
      .trim()
      .toLowerCase();
    if (!currentRetrySig) return 0;
    const [currentQid = '', currentAttemptToken = '0'] = currentRetrySig.split(':');
    if (currentQid !== qid) return 0;
    const currentAttempt = Number(currentAttemptToken || 0);
    return Number.isFinite(currentAttempt) && currentAttempt > 0 ? currentAttempt : 0;
  };

  const updateSingleQuestionDebug = (patch: Record<string, unknown> = {}) => {
    if (typeof window === 'undefined') return;
    try {
      const prev =
        window.__CE_SINGLE_Q_DEBUG__ && typeof window.__CE_SINGLE_Q_DEBUG__ === 'object'
          ? window.__CE_SINGLE_Q_DEBUG__
          : {};
      window.__CE_SINGLE_Q_DEBUG__ = {
        ...prev,
        ...patch,
        updatedAt: Date.now(),
      };
    } catch (e: unknown) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
  };

  const scheduleSingleQuestionBootstrapRetry = ({
    questionId = '',
    attempt = 0,
    reason = '',
  }: SurveyQuestionsBootstrapRetryArgs = {}) => {
    const qid = String(questionId || propsRef.current.questionID || '')
      .trim()
      .toLowerCase();
    if (!qid || !inst._isMounted) return false;

    const maxAttempts = 6;
    const nextAttempt = Math.max(1, Number(attempt || 0) + 1);
    if (nextAttempt > maxAttempts) return false;

    const currentRetrySig = String(inst._singleQuestionBootstrapRetrySig || '')
      .trim()
      .toLowerCase();
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
      }).catch((error: unknown) => {
        const errorRecord = error && typeof error === 'object' ? (error as { message?: unknown }) : null;
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

  const surveyQuestionsRuntimeMethods = createSurveyQuestionsRuntimeMethods({
    DEBUG_PREFILL,
    Dropdown,
    DropdownMenu,
    DropdownToggle,
    E2E_TESTIDS,
    EMPTY_QUESTION_POOL,
    ENABLE_IMPORTANCE_SLIDER_TOGGLE,
    FontAwesomeIcon,
    FormGroup,
    FullQuestionFooterIcons,
    GATE_SBT_HYDRATION_RETRY_MS,
    GatedPromptNotice,
    Input,
    Label,
    Link,
    ModalBody,
    ModalFooter,
    ModalHeader,
    PileHologramAssistant,
    QUESTION_TAG_DROPDOWN_ROW_STYLE,
    QuestionCardLinks,
    QuestionDecryptControl,
    QuestionFilter,
    QuestionsDashboard,
    React,
    SHOW_PILE_HOLOGRAM_TOGGLE,
    SingleQuestionResponse,
    SurveyAudioFieldInput,
    SurveyQuestionTagControl,
    SurveyQuestionsFullQuestionCardShell,
    SurveyQuestionsFullQuestionResponseInput,
    SurveyQuestionsFullQuestionSliderSection,
    SurveyQuestionsJsonTree,
    SurveyQuestionsLockAudienceControl,
    SurveyQuestionsLockedQuestionsPanel,
    SurveyQuestionsRouteSurface,
    SurveyQuestionsSurveyAnswersView,
    SurveySelector,
    _applyCachedResponseEntryToSlice,
    _applyDraftHydrationEntryToSlice,
    _applyDraftTrackingState,
    _applyLocalCacheHydrationEntryToSlice,
    _applyResponseHydrationEntryToSlice,
    _applyResponseHydrationListToSlice,
    appendExplicitSessionHintToPath,
    applyExistingGroupPrefix,
    applyPriorResponseFetchSuccessEffects,
    applyQuestionDecryptCompletionStatusHelper,
    applyQuestionDecryptFailureStatusHelper,
    applySurveyDecryptStaleStatusHelper,
    applySurveyQuestionsRuntimeInitialState,
    areEnvelopesEquivalent,
    areQuestionPayloadsEquivalent,
    areSurveyResponsesConsistent,
    bottomRef,
    buildActiveTagModalState,
    buildAdditionalAudienceSelectionPlan,
    buildAdditionalEncryptionAudienceState,
    buildAdditionalEncryptionToggleResponseState,
    buildAdditionalUpdatePlan,
    buildAnswerAudienceSelectionPlan,
    buildAnswerEncryptionAudienceState,
    buildAnswerEncryptionToggleResponseState,
    buildAnswerLockDisplayState,
    buildAnswerUpdatePlan,
    buildAutoDecryptAttemptedState,
    buildAutoDecryptDisabledState,
    buildAutoDecryptMaskedFieldSignatureHelper,
    buildAutoDecryptToggleState,
    buildBookmarkedQuestionsState,
    buildBulkPromptReloadingState,
    buildCanDecryptContext,
    buildCanDecryptOtherResponsesState,
    buildClearedDecryptingByKeyState,
    buildClearedQuestionDecryptBusyTokensHelper,
    buildClearedSurveyQuestionPoolState,
    buildClearedTransientSubmitFeedbackState,
    buildCommentsToggleState,
    buildCopiedQuestionsJsonState,
    buildCopiedResponseJsonState,
    buildCopiedSurveyJsonState,
    buildCurrentStepState,
    buildDecryptContextKeyFromContext,
    buildDecryptEditFailureState,
    buildDecryptEditStartState,
    buildDecryptTaskKeyHelper,
    buildDecryptingByKeyState,
    buildDisplayAnswerModeState,
    buildDisplayAnswerModeToggleState,
    buildDraftAnswersByQuestionId,
    buildDraftAwareCacheHydrationState,
    buildDraftHydrationPatchForQuestion,
    buildDraftHydrationRunPlan,
    buildEditStatsState,
    buildEditingResponseModeState,
    buildEmptyResponseFieldStateCore,
    buildEncryptionTogglePlan,
    buildFetchedQuestionPoolState,
    publishSurveyQuestionPoolIfCurrent,
    buildFieldDecryptStateHelper,
    buildFieldEncryptionWorkGroupsCore,
    buildGateAudienceSbtItemsController,
    buildGateSbtNameRevisionState,
    buildGatedPromptNoticeState,
    buildGroupedRenderedResponseScopePlan,
    buildHasherState,
    buildHydratedResponseSlice,
    buildHydratingPriorResponsesState,
    buildIndexedQuestionEntryKeys,
    buildInheritedAdditionalFieldStateCore,
    buildInitialStandaloneResponseState,
    buildInitialSurveyResponseQuestionIds,
    buildInitialSurveyResponseState,
    buildInitializedSurveyResponseState,
    buildJsonPreviewState,
    buildLockAudienceButtonAction,
    buildLockAudienceDisplayState,
    buildLockAudienceGateDetailsState,
    buildLockAudienceMenuState,
    buildLockedGateDetailsExpandedState,
    buildLockedGateRequirementSentenceCore,
    buildLockedQuestionGateDetailsFromPool,
    buildMergedSurveyResponseState,
    buildMissingRenderedResponseResult,
    buildNormalizedRenderedQuestionIds,
    buildParsedViewAddressAnswersState,
    buildPersistDraftAllowedQuestionIds,
    buildPersistedDraftMapsForAllowedIds,
    buildPersistedDraftPayload,
    buildPersistedDraftQuestionEntry,
    buildPersistedDraftQuestionRemovalPlan,
    buildPersistedDraftTrackingAfterLoad,
    buildPersistedDraftTrackingAfterScopedDelete,
    buildPersistedDraftTrackingAfterWrite,
    buildPersistedDraftTrackingClearedState,
    buildPersistedDraftTrackingOnKeyChange,
    buildPersistedDraftWritePlan,
    buildPrefillQueuedAfterCacheState,
    buildPriorResponseFetchPlan,
    buildQuestionCacheHydrationPatch,
    buildQuestionCountScopeContextKey,
    buildQuestionDashboardLoadContextSignature,
    buildQuestionDecryptBusyTokenRegistrationHelper,
    buildQuestionDecryptContextForSession,
    buildQuestionDecryptExecutionContextHelper,
    buildQuestionDecryptFailureStateHelper,
    buildQuestionDecryptOwnedClearStateHelper,
    buildQuestionDecryptStartStateHelper,
    buildQuestionFieldDecryptControlDisplayStateHelper,
    buildQuestionFieldDisplayStateHelper,
    buildQuestionFilterStorageKeyPrefix,
    buildQuestionIdScopeSignature,
    buildQuestionPoolPendingSubmitFeedbackMessage,
    buildQuestionPoolResponseMergeState,
    buildQuestionPromptDecryptDisplayState,
    buildQuestionRenderDisplayStateHelper,
    buildQuestionResponseDisplayStateHelper,
    buildQuestionResponseHydrationPatch,
    buildQuestionRoutePath,
    buildQuestionSlugMapForIds,
    buildQuestionsJsonToggleState,
    buildRatingEnvelopeQidSetFromUserAnswers,
    buildRecipientsFromGatesController,
    buildRenderedIdsSignature,
    buildRenderedQuestionIdsFromQuestionPools,
    buildRenderedQuestionPayloadPoolsState,
    buildResponseGatePolicy,
    buildResponseGatePolicyCacheKeyFromInputs,
    buildResponseHydrationInvalidatedState,
    buildResponseJsonToggleState,
    buildResponseLoadingResetState,
    buildResponsePayload,
    buildRevertedResponseSlice,
    buildSbtDetailPath,
    buildSelfQuestionDecryptBaselineHelper,
    buildSelfQuestionDecryptSuccessStateHelper,
    buildShowJsonState,
    buildSingleQuestionEncryptedMetadataPlaceholder,
    buildSingleQuestionPlaceholderHydrationState,
    buildSingleQuestionPoolFallbackState,
    buildSingleQuestionPreservedPoolState,
    buildSingleQuestionReadyHydrationState,
    buildSingleQuestionRetryLoadingState,
    buildSingleQuestionSeededHydrationState,
    buildSingleQuestionSourceRestoreContextPlan,
    buildSliceToken,
    buildSliderModeStatePatch,
    buildSliderPersistOptions,
    buildStandaloneAuthResetState,
    buildSubmissionErrorState,
    buildSubmissionGroupContext,
    buildSubmitPreparationErrorState,
    buildSubmittedResponseJson,
    buildSurveyAccountViewResetState,
    buildSurveyChangedResetState,
    buildSurveyDecryptAttemptSourceInputsHelper,
    buildSurveyDecryptExecutionContextHelper,
    buildSurveyDecryptSourceStateHelper,
    buildSurveyDecryptSuccessStateHelper,
    buildSurveyDefinitionJson,
    buildSurveyDraftCompatScope,
    buildSurveyDraftLoadPlan,
    buildSurveyDraftSemanticSignature,
    buildSurveyDraftStorageKey,
    buildSurveyDraftStorageVariantKeys,
    buildSurveyJsonToggleState,
    buildSurveyLocalCacheSlice,
    buildSurveyQuestionPoolLoadState,
    buildSurveyQuestionsAuthoringPanelDisplayState,
    buildSurveyQuestionsAuthoringRouteReadinessDescriptor,
    buildSurveyQuestionsFullLoadingProgressState,
    buildSurveyQuestionsJson,
    buildSurveyQuestionsJsonForDisplayState,
    buildSurveyQuestionsJsonPanelDisplayState,
    buildSurveyQuestionsJsonPreviewDisplayState,
    buildSurveyQuestionsLayoutDisplayState,
    buildSurveyQuestionsMaskedQuestionVisibility,
    buildSurveyQuestionsPrimarySubmitPlan,
    buildSurveyQuestionsRenderReadinessDescriptor,
    buildSurveyQuestionsRouteJsonControlsProps,
    buildSurveyQuestionsRouteViewDisplayState,
    buildSurveyQuestionsSubmitFooterDisplayState,
    buildSurveyQuestionsSubmitReadinessDescriptor,
    buildSurveyResponseFetchLoadingState,
    buildSurveyResponseMergeState,
    buildSurveyResponseSliceSignature,
    buildSurveyResponseStateArray,
    buildSurveyUserEditResponseStatePatch,
    buildSurveysResponseStatePatch,
    buildTransientSubmitFeedbackState,
    buildUserSurveyResponseFoundState,
    buildUserSurveyResponseMissingState,
    buildViewedResponseDecryptBaselineHelper,
    buildViewedResponseDecryptSuccessStateHelper,
    buildViewedSurveyNoResponseState,
    buildViewedSurveyResponseState,
    buildViewingResponseModeState,
    buildVisiblePileQuestionsAfterPromptDecryptState,
    bumpSurveyPerfCounter,
    canUseRecentQuestionPayloadForAccount,
    checkSponsoredAccess,
    clampSliderValue,
    clearManagedTimeouts,
    clearPriorResponseAttemptedKeys,
    clearSingleQuestionBootstrapRetry,
    collectGateSbtAddressesForHydrationFromSources,
    computePendingEditStats,
    computeSubmitLabel,
    createInitialSurveyQuestionsState,
    createLogger,
    createSurveyQuestionsInstanceFields,
    cryptoUtils,
    decideAutoDecryptBlocked,
    decideAutomaticPromptDecryptByKind,
    decryptQuestionRatingEnvelopeMapHelper,
    decryptQuestionRatingEnvelopesHelper,
    dispatch,
    engine,
    ensureIdentifierHash,
    ensureQuestionsNet,
    ensureSurveysNet,
    ethers,
    evaluateCanDecryptPreCheck,
    executeOwnSingleQuestionResponseBootstrap,
    executePriorResponseFetchPlan,
    executeSurveyDraftHydration,
    executeSurveyExitEditing,
    executeSurveyFormStateReset,
    executeSurveyLocalCacheRehydrate,
    executeSurveyPendingRevert,
    executeSurveyPriorResponseBackfill,
    executeSurveyResponsePrefill,
    executeSurveySingleQuestionPrefill,
    executeSurveyStartFresh,
    executeViewedSingleQuestionResponseBootstrap,
    faCaretDown,
    faCheck,
    faChevronLeft,
    faChevronRight,
    faComment,
    faFilter,
    faLock,
    faMicrophone,
    faMinus,
    faPlus,
    faRobot,
    faSpinner,
    faUnlock,
    fetchSingleQuestionMetadataCandidates,
    filterChangedResponsesForSubmit,
    finalizeQuestionDecryptAttemptHelper,
    finalizeSurveyDecryptAttemptHelper,
    getActiveSessionSlugFromProps,
    getAllSessionSlugs,
    getBlockedQuestionIdsSet,
    getConvictionFromResponse,
    getConvictionFromSlice,
    getConvictionFromSliceStrict,
    getEffectiveRecipientsForFieldController,
    getExtraQuestionReadSlugs,
    getHighlightedQuestionIdsSet,
    getImportanceFromResponse,
    getImportanceFromSlice,
    getPendingSingleQuestionBootstrapRetryAttempt,
    getPendingStatsSnapshotFromState,
    getQuestionConvictionSliderValue,
    getQuestionEncryptionGatesCore,
    getQuestionFieldDecryptSelectionHelper,
    getQuestionFieldTaskKeyHelper,
    getQuestionGateOptionsController,
    getQuestionImportanceSliderValue,
    getQuestionSliderMode,
    getResponseGateOptionByIdController,
    getResponseGateOptionsController,
    getRuntimeStrategy,
    getSessionSlugByName,
    getSessionSlugHintFromProps,
    getSessionSlugPinnedFromProps,
    getShortenedAddress,
    getStrictSessionConfigBySlug,
    getTemporaryDemoSessionQuestionFixtures,
    getViewedResponseOverrideForQuestionHelper,
    hasCacheHydratedFlag,
    hasConvictionOrImportanceValueForQuestion,
    hasMeaningfulFieldValue,
    hydrateLatestQuestionDecryptStateHelper,
    initEngineRef,
    inst,
    instRef,
    invalidateResponseHydrationRuns,
    isAutoDecryptBlocked,
    isIncomingResponseMetaNewer,
    isMaskedQuestionPayload,
    isPasskeyWalletAutoSignReady,
    isPendingQuestionMetadataPlaceholder,
    isQuestionPromptMaskedHelper,
    isSurveyQuestionsMaskedPromptText,
    isSurveyToolFilterStateActive,
    isTargetedSbtMetadataLookupEnabled,
    listNamespaceEntriesSync,
    loadGroupedMissingResponseRequests,
    loadMissingRenderedResponseInfo,
    loadMissingResponseIdsForScope,
    loadPreviousPersistedDraftSnapshot,
    measureSync,
    mergeDecryptedViewedResponse,
    mergeLatestEncryptedQuestionFieldsHelper,
    mergePersistedDraftPayloads,
    mergeQuestionRatingEnvelopeStateHelper,
    mergeQuestionResponseOverrideIntoDecryptSliceHelper,
    mergeQuestionResponses,
    mergeSurveyResponsePayloads,
    normalizeBulkDecryptedSliceForSurveyStateHelper,
    normalizeFieldAudienceModeCore,
    normalizeGateLabelTextCore,
    normalizeQuestionIdKey,
    normalizeResponseEncryptionAudienceCore,
    normalizeSessionSlug,
    normalizeSessionSlugValue,
    normalizeSingleQuestionMetadataForCache,
    normalizeSingleQuestionViewedResponseHelper,
    normalizeSubmitReceipt,
    normalizeSurveyToolFilterState,
    normalizeTransientSubmitFeedbackDurationMs,
    notify,
    orchestrateGetChangedQidsAndFields,
    ownsQuestionDecryptBusyTokensHelper,
    parseEncryptedEnvelopeHelper,
    parsePersistedDraftStorageValue,
    parseQuestionSessionIdFromSearch,
    parseQuestionSessionSlugFromSearch,
    passkeyWallet,
    peekCacheSync,
    pendingSetStateCallbacksRef,
    pickBetterQuestionPayload,
    prepareQuestionDecryptAttemptHelper,
    prepareSelfQuestionDecryptStateHelper,
    prepareSurveyDecryptAttemptHelper,
    prepareViewedQuestionDecryptStateHelper,
    processRatingEnvelopesForSubmit,
    propsRef,
    readCache,
    readFreshSingleQuestionCachedResponderResponse,
    readQuestionsCache,
    readQuestionsCacheAsync,
    readQuestionsCacheRef,
    readRecentQuestionPayload,
    readRenderedQuestionIds,
    readSessionScanScope,
    readSessionScanSlugs,
    readSingleQuestionCachedResponderResponse,
    readSurveysCache,
    readSurveysCacheAsync,
    readSurveysCacheRef,
    renderSurveyQuestionsFullQuestionDisplay,
    renderSurveyQuestionsFullQuestionGatedPromptCard,
    resolveCanDecryptGateAccess,
    resolveConfiguredGateLabelController,
    resolveCurrentTagSessionSlug,
    resolveDecryptHydrationContext,
    resolveDecryptSurveyIdHelper,
    resolveDraftSessionContext,
    resolveDraftStorageContext,
    resolveEffectiveSlug,
    resolveEnsureQuestionCachedContext,
    resolveExplicitSessionContext,
    resolveFieldEncryptionAudienceCore,
    resolveFieldEncryptionGateIdController,
    resolveGateDisplayLabelController,
    resolveGatedPromptGateNamesController,
    resolveLatestSurveyDecryptResponseHelper,
    resolveLocalCacheHydrationSignatureLookup,
    resolveLockAudienceSessionNameContext,
    resolveLockAudienceSessionNameController,
    resolvePileFilterContext,
    resolvePileLoadContext,
    resolvePileResponseReadContext,
    resolvePileWarmSeedContext,
    resolveQuestionBootstrapContext,
    resolveQuestionCountContext,
    resolveQuestionDecryptHandlingModeHelper,
    resolveQuestionPayloadCacheWriteContext,
    resolveQuestionPayloadDisplayState,
    resolveQuestionReadCacheContext,
    resolveQuestionSlugMapLookup,
    resolveQuestionsDashboardLoadContext,
    resolveResponseHydrationContext,
    resolveResponseJsonContext,
    resolveSbtDisplayLabel,
    resolveSessionAliases,
    resolveSessionSlugFromPathname,
    resolveSingleQuestionCacheBootstrap,
    resolveSingleQuestionCacheBootstrapFlowPlan,
    resolveSingleQuestionCacheBootstrapStopHandlingPlan,
    resolveSingleQuestionCacheState,
    resolveSingleQuestionMetadataBootstrap,
    resolveSlugForIds,
    resolveSubmitEffectiveDraftSlug,
    resolveSubmittedCacheWriteContext,
    resolveSurveyBaselineSourceSlice,
    resolveSurveyMissingRenderedResponseLookup,
    resolveSurveyQuestionsSubmitPendingStats,
    resolveSurveyQuestionsSubmittedResponseUrl,
    resolveSurveyReadContext,
    resolveSurveyToolDecryptHydrationContext,
    resolveSurveyToolDraftSessionContext,
    resolveSurveyToolDraftStorageContext,
    resolveSurveyToolEffectiveSlug,
    resolveSurveyToolEnsureQuestionCachedContext,
    resolveSurveyToolExplicitSessionContext,
    resolveSurveyToolIdLookupContext,
    resolveSurveyToolLockAudienceSessionNameContext,
    resolveSurveyToolPileFilterContext,
    resolveSurveyToolPileLoadContext,
    resolveSurveyToolPileResponseReadContext,
    resolveSurveyToolPileWarmSeedContext,
    resolveSurveyToolQuestionBootstrapContext,
    resolveSurveyToolQuestionConfigContext,
    resolveSurveyToolQuestionCountContext,
    resolveSurveyToolQuestionPayloadCacheWriteContext,
    resolveSurveyToolQuestionReadCacheContext,
    resolveSurveyToolQuestionsDashboardLoadContext,
    resolveSurveyToolResponseGateSessionContext,
    resolveSurveyToolResponseHydrationContext,
    resolveSurveyToolResponseJsonContext,
    resolveSurveyToolSubmittedCacheWriteContext,
    resolveSurveyToolSurveyReadContext,
    resolveSurveyToolUpdateCacheContext,
    resolveSurveyUserAnswersSlice,
    resolveUpdateCacheContext,
    runDedupedDecryptTaskHelper,
    runSurveyQuestionsStaleSubmitController,
    runSurveyQuestionsSubmitController,
    runSurveyQuestionsSubmitFailureController,
    runSurveyQuestionsSubmitStartController,
    runSurveyQuestionsSubmitSuccessController,
    scheduleMicrotask,
    scheduleSingleQuestionBootstrapRetry,
    serializeSurveyToolFilterState,
    sessionRegistryReadsPort,
    setManagedTimeout,
    setResponseHydrationState,
    setState,
    shouldAttemptAutomaticPromptDecrypt,
    shouldAutoEncryptAdditionalOnAudienceChange,
    shouldEncryptResponseFieldForSubmit,
    shouldForceOverwriteDraftValues,
    shouldRetryMaskedQuestionRefresh,
    shouldShowPileFullLoadingState,
    shouldShowSingleQuestionResponseLookupSpinner,
    shouldSurveyAutoStartFresh,
    shouldUseSubmittedResponseJson,
    stampResponsePayloadWithMeta,
    startQuestionDecryptAttemptStatusHelper,
    state,
    stateRef,
    styles,
    surveyLog,
    surveyQuestionReadsPort,
    surveyQuestionsReducer,
    surveyResponseStoragePort,
    surveyResponseSubmitPort,
    syncDecryptedQuestionIntoBaselineHelper,
    t,
    toNumberOrNull,
    toResponseRecencyMeta,
    topRef,
    trackPriorResponseAttemptedKeys,
    updateCacheAtomic,
    updateSingleQuestionDebug,
    updateSubmittedSinceLastEdit,
    useLayoutEffect,
    useReducer,
    useRef,
    utils,
    verifyEncryptionIntegrity,
    warmSbtDisplayNamesTargeted,
    writeCache,
    writeCacheOptimistic,
    writeQuestionsCache,
    writeSingleQuestionResponseToCache,
    writeSubmittedResponsesToLocalCachesHelper,
    writeSurveysCache,
  });

  getQuestionDecryptBusyKeys = (questionId, fieldToDecrypt = 'both') => (
    getQuestionFieldTaskKeysHelper(questionId, {
      includeAnswer: fieldToDecrypt === 'answer' || fieldToDecrypt === 'both',
      includeAdditional: fieldToDecrypt === 'additional' || fieldToDecrypt === 'both',
    })
  );

  async function runComponentDidUpdate(
    prevProps: SurveyQuestionsProps,
    prevState: SurveyQuestionsState,
  ): Promise<unknown> {
    const runtimeStrategy = getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentDidUpdate === 'function') {
      return runtimeStrategy.componentDidUpdate(engine, prevProps, prevState);
    }
  }

  function runComponentDidMount(): unknown {
    const runtimeStrategy = getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentDidMount === 'function') {
      return runtimeStrategy.componentDidMount(engine);
    }
  }

  function runComponentWillUnmount(): unknown {
    const runtimeStrategy = getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentWillUnmount === 'function') {
      return runtimeStrategy.componentWillUnmount(engine);
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
    this.invalidateResponseHydrationRuns();
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
    const litHooks =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return buildQuestionDecryptContextForSession({
      cfg,
      account: this.props.account || '',
      providerLike: this.props.provider || '',
      litHooks,
      fallbackChainId: this.resolveSessionChainId(slug, cfg),
    });
  };

  hasMaskedCurrentQuestionPayload = () => {
    if (!this.props.singleQuestionMode) return false;
    const q = Array.isArray(this.state.questionPool) ? this.state.questionPool[0] : null;
    if (q && typeof q === 'object') {
      if (isMaskedQuestionPayload(q)) return true;
      const prompt = String(q.prompt || '').trim();
      if (prompt || q.promptDecrypted) return false;
    }
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
    const key = this.getQuestionFieldTaskKey(qid, 'prompt');

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
    const payloadDisplay = this.getQuestionPayloadDisplayState(question);
    const promptReloading = this.isQuestionFieldBusy(qid, 'prompt');
    const promptDisplay = buildQuestionPromptDecryptDisplayState({
      questionId: qid,
      promptText,
      promptMasked,
      promptReloading,
      payloadDisplay,
      loginComplete: this.props.loginComplete,
      account: this.props.account,
      canReloadPrompt: promptMasked && qid,
    });

    return (
      <div className={styles.promptTitleBlock}>
        <h4 id={styles.questionTitle}>
          {promptDisplay.showPromptAction ? (
            <button
              type="button"
              className={styles.maskedPromptActionButton}
              data-testid={E2E_TESTIDS.SURVEY_DECRYPT_PROMPT}
              data-ce-question-id={promptDisplay.qid}
              onClick={() => this.handleReloadMaskedPrompt(promptDisplay.qid)}
              disabled={promptDisplay.noticeActionDisabled}
              aria-busy={promptDisplay.noticeActionBusy}
              title={promptDisplay.promptTitle}
            >
              {promptDisplay.noticeActionBusy ? (
                <span className={styles.maskedPromptLoading}>
                  <FontAwesomeIcon icon={faSpinner} spin className={styles.maskedPromptLoadingSpinner} />
                  <span>{promptDisplay.promptBusyLabel}</span>
                </span>
              ) : (
                promptDisplay.promptLabel
              )}
            </button>
          ) : (
            promptDisplay.promptText
          )}
        </h4>
      </div>
    );
  };

  renderQuestionTagControl = (question, options = {}) => {
    const { rowStyle } = options;
    return (
      <SurveyQuestionTagControl
        tags={question.tags}
        sessionSlug={resolveCurrentTagSessionSlug({
          props: this.props,
          state: this.state,
          getEffectiveDraftSlug: this._getEffectiveDraftSlug,
        })}
        useTagModal={!this.props.singleQuestionMode && !this.props.isStandalone}
        onTagSelect={this.handleQuestionTagSelect}
        rowStyle={rowStyle}
      />
    );
  };

  renderQuestionTagDropdown = (question) => (
    this.renderQuestionTagControl(question)
  );

  handleQuestionTagSelect = (tag) => {
    const normalizedTag = String(tag || '').trim();
    if (!normalizedTag) return;
    this.setState({ activeTagModalTag: normalizedTag });
  };

  closeQuestionTagModal = () => {
    this.setState({ activeTagModalTag: '' });
  };

  renderQuestionTagDropdownRow = (question) => (
    this.renderQuestionTagControl(question, {
      rowStyle: QUESTION_TAG_DROPDOWN_ROW_STYLE,
    })
  );

  getSliderMode = (questionId) => {
    return getQuestionSliderMode({
      explicitMode: this.state.sliderModeByQuestion?.[questionId],
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      surveyIndex: this.props.surveyIndex,
      surveysResponseState: this.state.surveysResponseState,
      questionId,
    });
  };

  setSliderMode = (questionId, mode) => {
    this.setState((prev) => (
      // Track whether the conviction/importance control has been "opened" for this question.
      buildSliderModeStatePatch(prev, questionId, mode)
    ));
  };

  getConvictionValueForSlice = (slice, questionId) => {
    return getQuestionConvictionSliderValue(slice, questionId);
  };

  getImportanceValueForSlice = (slice, questionId) => {
    return getQuestionImportanceSliderValue(slice, questionId);
  };

  renderBullhornToggleButton = ({
    onClick,
    disabled = false,
    title = 'Conviction / importance',
    ariaLabel = 'Conviction / importance',
    active = false,
  } = {}) => (
    <BullhornToggleButton
      onClick={onClick}
      disabled={disabled}
      title={title}
      ariaLabel={ariaLabel}
      active={active}
    />
  );

  renderConvictionImportanceLabel = (questionId, convictionValue, importanceValue) => {
    const mode = this.getSliderMode(questionId);
    const isExpanded = shouldExpandSliderToggle({
      sliderToggleExpandedByQuestion: this.state.sliderToggleExpandedByQuestion,
      questionId,
      sliderMode: mode,
    });
    return (
      <ConvictionImportanceLabel
        importanceToggleEnabled={ENABLE_IMPORTANCE_SLIDER_TOGGLE}
        sliderMode={mode}
        isExpanded={isExpanded}
        convictionValue={convictionValue}
        importanceValue={importanceValue}
        onSelectMode={(nextMode) => this.setSliderMode(questionId, nextMode)}
      />
    );
  };

  flushDraftPersistAfterSliderChange = () => {
    this.persistDraftSafely && this.persistDraftSafely(0);
  };

  // Keyboard changes persist during onChange so draft edits are not lost.
  getSliderPersistOptions = (event) => buildSliderPersistOptions(event);

  handleConvictionImportanceChange = (surveyIndex, questionId, mode, value, options = {}) => {
    if (mode === 'importance') {
      this.handleImportance(surveyIndex, questionId, value, options);
    } else {
      this.handleConviction(surveyIndex, questionId, value, options);
    }
  };

  renderSingleQuestionDeferredConvictionSlider = ({
    surveyIndex,
    questionId,
    sliderMode,
    activeSliderValue,
    convictionValue,
    importanceValue,
  }) => (
    <DeferredConvictionImportanceSlider
      value={activeSliderValue}
      disabled={this.state.isSubmitting}
      importanceToggleEnabled={ENABLE_IMPORTANCE_SLIDER_TOGGLE}
      sliderMode={sliderMode}
      isExpanded={shouldExpandSliderToggle({
        sliderToggleExpandedByQuestion: this.state.sliderToggleExpandedByQuestion,
        questionId,
        sliderMode,
      })}
      convictionValue={convictionValue}
      importanceValue={importanceValue}
      onSelectMode={(nextMode) => this.setSliderMode(questionId, nextMode)}
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
    />
  );

  renderFullQuestionSliderSection = ({
    surveyIndex,
    questionId,
    sliderMode,
    activeSliderValue,
    convictionValue,
    importanceValue,
    hasConvictionImportanceValue,
    sliderOpen,
  }) => (
    <div className={styles.importanceSlider}>
      {sliderOpen ? (
        this.props.singleQuestionMode
          ? this.renderSingleQuestionDeferredConvictionSlider({
              surveyIndex,
              questionId,
              sliderMode,
              activeSliderValue,
              convictionValue,
              importanceValue,
            })
          : (
            <ConvictionImportanceSliderControl
              label={this.renderConvictionImportanceLabel(questionId, convictionValue, importanceValue)}
              value={activeSliderValue}
              disabled={this.state.isSubmitting}
              onChange={(value, event) =>
                this.handleConvictionImportanceChange(
                  surveyIndex,
                  questionId,
                  sliderMode,
                  value,
                  this.getSliderPersistOptions(event)
                )}
              onChangeComplete={this.flushDraftPersistAfterSliderChange}
            />
          )
      ) : ENABLE_IMPORTANCE_SLIDER_TOGGLE ? (
        this.renderBullhornToggleButton({
          onClick: () => this.setSliderMode(questionId, 'conviction'),
          disabled: this.state.isSubmitting,
          active: hasConvictionImportanceValue,
        })
      ) : (
        this.renderBullhornToggleButton({
          onClick: () => this.setSliderMode(questionId, sliderMode),
          disabled: this.state.isSubmitting,
          active: hasConvictionImportanceValue,
        })
      )}
    </div>
  );

  renderFullQuestionResponseInput = ({
    question,
    qIndex,
    surveyIndex,
    answer,
    glowAnswer,
  }) => (
    <SurveyQuestionsFullQuestionResponseInput
      question={question}
      qIndex={qIndex}
      answer={answer}
      glowAnswer={glowAnswer}
      isSubmitting={this.state.isSubmitting}
      singleQuestionMode={this.props.singleQuestionMode}
      audioInputWorkerProps={this.getAudioInputWorkerProps()}
      onAnswerChange={(answerValue) => this.handleAnswer(surveyIndex, question.id, answerValue)}
      onDeferredRatingCommit={(committedRating) => this.handleAnswer(
        surveyIndex,
        question.id,
        committedRating,
        {
          persistDraft: false,
          afterUpdate: this.flushDraftPersistAfterSliderChange,
        }
      )}
      onRatingChange={(ratingAnswer, event) => this.handleAnswer(
        surveyIndex,
        question.id,
        ratingAnswer,
        this.getSliderPersistOptions(event)
      )}
      onRatingChangeComplete={this.flushDraftPersistAfterSliderChange}
      onToggleAnswerEncryption={(newEncryptedState) => this.toggleAnswerEncryption(
        surveyIndex,
        question.id,
        newEncryptedState
      )}
    />
  );

  renderFullQuestionAdditionalInput = ({
    qIndex,
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
  }) => (
    <SurveyAudioFieldInput
      qIndex={qIndex}
      {...this.getAudioInputWorkerProps()}
      placeholder={'related thoughts or URLs (optional)'}
      value={additional?.value || ''}
      encrypted={additional?.encrypted || false}
      dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
      dataCeQuestionId={String(questionId || '').trim().toLowerCase()}
      disabled={this.state.isSubmitting}
      forceGlow={glowAdditional}
      updateFunction={(additionalCommentsValue) => this.handleAdditional(surveyIndex, questionId, additionalCommentsValue)}
      toggleEncryption={(newEncryptedState) =>
        this.toggleAdditionalCommentsEncryption(surveyIndex, questionId, newEncryptedState)
      }
    />
  );

  renderFullQuestionAdditionalEditorRow = ({
    qIndex,
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
  }) => (
    <AdditionalCommentsInlineRow
      input={this.renderFullQuestionAdditionalInput({
        qIndex,
        surveyIndex,
        questionId,
        additional,
        glowAdditional,
      })}
      lockControl={this.renderQuestionAdditionalLockControl({
        surveyIndex,
        questionId,
        additional,
        glowAdditional,
      })}
    />
  );

  renderFullQuestionCommentsSection = (content) => {
    if (!content) return null;
    return (
      <div className={styles.fullQuestionComments}>
        {content}
      </div>
    );
  };

  parseEncryptedEnvelope = (field) => parseEncryptedEnvelopeHelper(field);

  getFieldDecryptState = ({
    questionId,
    fieldKey,
    field,
  }) => buildFieldDecryptStateHelper(field, {
    loginComplete: this.props.loginComplete,
    account: this.props.account,
    busy: this.isQuestionFieldBusy(questionId, fieldKey),
  });

  getQuestionFieldDisplayState = ({
    questionId,
    answer,
    additional,
  }) => {
    const answerDecryptState = this.getFieldDecryptState({
      questionId,
      fieldKey: 'answer',
      field: answer,
    });
    const additionalDecryptState = this.getFieldDecryptState({
      questionId,
      fieldKey: 'additional',
      field: additional,
    });
    return buildQuestionFieldDisplayStateHelper({
      answer,
      additional,
      answerDecryptState,
      additionalDecryptState,
      hasAdditionalContent: hasMeaningfulFieldValue(additional),
    });
  };

  getQuestionResponseDisplayState = ({
    questionId,
    responseSlice,
  }) => {
    const slice = responseSlice || {};
    const answer = slice.answers?.[questionId] || this.buildEmptyResponseFieldState(questionId);
    const additional = slice.additionalComments?.[questionId] || this.buildEmptyResponseFieldState(questionId, 'additional');
    const convictionValue = this.getConvictionValueForSlice(slice, questionId);
    const importanceValue = this.getImportanceValueForSlice(slice, questionId);
    const hasConvictionImportanceValue = hasConvictionOrImportanceValueForQuestion(slice, questionId);
    const sliderMode = ENABLE_IMPORTANCE_SLIDER_TOGGLE ? this.getSliderMode(questionId) : 'conviction';
    return buildQuestionResponseDisplayStateHelper({
      answer,
      additional,
      convictionValue,
      importanceValue,
      hasConvictionImportanceValue,
      sliderMode,
    });
  };

  getQuestionRenderDisplayState = ({
    questionId,
    responseSlice,
  }) => {
    const responseDisplayState = this.getQuestionResponseDisplayState({
      questionId,
      responseSlice,
    });
    const fieldDisplayState = this.getQuestionFieldDisplayState({
      questionId,
      answer: responseDisplayState.answer,
      additional: responseDisplayState.additional,
    });

    return buildQuestionRenderDisplayStateHelper({
      responseDisplayState,
      fieldDisplayState,
    });
  };

  isQuestionPromptMasked = (question) => isQuestionPromptMaskedHelper(question);

  getQuestionPayloadDisplayState = (question) => {
    const slug = normalizeSessionSlugValue(
      question?.sessionSlug ||
      question?.sessionName ||
      this._getEffectiveDraftSlug() ||
      resolveEffectiveSlug(this.props)
    );
    const sessionConfig = slug ? (resolveExplicitSessionContext(slug).sessionConfig || null) : null;
    return resolveQuestionPayloadDisplayState(question, sessionConfig);
  };

  getAnswerLockDisplayState = ({
    field,
    masked,
  }) => buildAnswerLockDisplayState({
    field,
    masked,
    isSubmitting: this.state.isSubmitting,
  });

  getGatedPromptNoticeState = ({
    question,
    tooltipIdSuffix,
    fallbackId = 'gated',
  }) => buildGatedPromptNoticeState({
    questionId: question?.id,
    tooltipIdSuffix,
    fallbackId,
    gateNames: this.resolveGatedPromptGateNames(question),
    sbtLabel: t('sbt'),
    gateLabel: t('gate'),
    gatesLabel: t('gates'),
  });

  renderGatedPromptNotice = ({
    question,
    tooltipIdSuffix,
    fallbackId,
  }) => {
    const { tooltipId, tooltipText } = this.getGatedPromptNoticeState({
      question,
      tooltipIdSuffix,
      fallbackId,
    });
    const qid = String(question?.id || '').trim().toLowerCase();
    const promptReloading = qid ? this.isQuestionFieldBusy(qid, 'prompt') : false;
    const canReloadPrompt = qid && this.isQuestionPromptMasked(question);
    const payloadDisplay = this.getQuestionPayloadDisplayState(question);
    const promptDisplay = buildQuestionPromptDecryptDisplayState({
      questionId: qid,
      promptText: question?.prompt || 'Question',
      promptMasked: this.isMaskedPromptText(question?.prompt || 'Question'),
      promptReloading,
      payloadDisplay,
      loginComplete: this.props.loginComplete,
      account: this.props.account,
      canReloadPrompt,
    });

    return (
      <GatedPromptNotice
        questionId={question.id}
        tooltipId={tooltipId}
        tooltipText={tooltipText}
        leadingText={promptDisplay.noticeLeadingText}
        statusText={promptDisplay.noticeStatusText}
        suffix={promptDisplay.noticeSuffix}
        actionBusy={promptDisplay.noticeActionBusy}
        actionDisabled={promptDisplay.noticeActionDisabled}
        actionLabel={promptDisplay.noticeActionLabel}
        actionTestId={E2E_TESTIDS.SURVEY_DECRYPT_PROMPT_NOTICE}
        actionTitle={promptDisplay.noticeActionTitle}
        onAction={promptDisplay.canReloadPrompt ? () => this.handleReloadMaskedPrompt(promptDisplay.qid) : undefined}
      />
    );
  };

  renderFullQuestionGatedPromptCard = ({
    cardKey,
    question,
    cardIcons,
  }) => (
    <Card key={cardKey} className={styles.fullQuestionCard}>
      <CardBody id={styles.questionTitleBody} className={styles.fullQuestionBody}>
        <FullQuestionHeader>
          {this.renderPromptWithManualDecrypt(question)}
          {cardIcons}
        </FullQuestionHeader>
        {this.renderGatedPromptNotice({
          question,
          tooltipIdSuffix: 'full',
          fallbackId: cardKey || 'gated',
        })}
        {this.renderQuestionTagDropdownRow(question)}
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

  renderQuestionMaskedPromptCard = ({
    mode,
    question,
    cardKey,
    cardIcons,
  }) => (
    mode === 'full'
      ? this.renderFullQuestionGatedPromptCard({
          cardKey,
          question,
          cardIcons,
        })
      : this.renderPileGatedPromptCard({ question })
  );

  renderQuestionAnswerLockControl = ({
    surveyIndex,
    questionId,
    answer,
    glowAnswer,
    lockDisabled,
    lockTitle,
    visualContext,
  }) => this.renderAnswerLockControl({
    surveyIndex,
    questionId,
    answer,
    lockDisabled,
    lockTitle,
    glowAnswer,
    forceAudienceMenu: true,
    selfAudienceLabel: 'only me',
    visualContext,
  });

  renderQuestionAdditionalLockControl = ({
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
    visualContext,
  }) => this.renderAnswerLockControl({
    surveyIndex,
    questionId,
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
    visualContext,
  });

  renderFullQuestionFooterIcons = ({
    surveyIndex,
    question,
    answer,
    glowAnswer,
    maskedAnswer,
    hasAdditionalContent,
    commentsOpen,
    onToggleComments,
  }) => {
    const { lockDisabled, lockTitle } = this.getAnswerLockDisplayState({
      field: answer,
      masked: maskedAnswer,
    });

    return (
      <FullQuestionFooterIcons
        hasAdditionalContent={hasAdditionalContent}
        commentsOpen={commentsOpen}
        onToggleComments={onToggleComments}
        questionId={question.id}
      >
        {this.renderQuestionAnswerLockControl({
          surveyIndex,
          questionId: question.id,
          answer,
          glowAnswer,
          lockDisabled,
          lockTitle,
        })}
        {this.renderQuestionTagDropdown(question)}
      </FullQuestionFooterIcons>
    );
  };

  renderFullQuestionCardIcons = ({
    question,
    showResponseLookupSpinner,
    isQuestionBookmarked,
  }) => (
    <QuestionCardLinks
      showResponseLookupSpinner={showResponseLookupSpinner}
      isQuestionBookmarked={isQuestionBookmarked}
      onBookmarkToggle={() => this.handleBookmarkToggle(question.id)}
      arweaveHref={question.arweaveTxId
        ? normalizeArweaveUrl(question.arweaveTxId, { contextLabel: 'survey_tool_question_link' })
        : ''}
      questionHref={question.id
        ? buildQuestionRoutePath(question.id, { sessionSlug: this._getEffectiveDraftSlug() })
        : ''}
    />
  );

  renderQuestionFieldDecryptControl = ({
    questionId,
    fieldKey,
    allowDecrypt,
    decryptTooltip,
    actionLabel,
    busy,
    showBusySpinnerWhenAutoDecryptEnabled = false,
    wrapperStyle,
  }) => (
    <QuestionDecryptControl
      autoDecryptEnabled={this.state.autoDecryptEnabled}
      showBusySpinnerWhenAutoDecryptEnabled={showBusySpinnerWhenAutoDecryptEnabled}
      onClick={() => this.handleDecryptQuestionAnswer(questionId, fieldKey)}
      disabled={this.state.isDecrypting || !allowDecrypt}
      title={!allowDecrypt ? decryptTooltip : undefined}
      actionLabel={actionLabel}
      busy={busy}
      wrapperStyle={wrapperStyle}
    />
  );

  renderFullQuestionMainContent = ({
    question,
    qIndex,
    surveyIndex,
    answer,
    glowAnswer,
    maskedAnswer,
    allowDecryptAnswer,
    decryptTooltip,
    isAnswerDecrypting,
  }) => {
    if (maskedAnswer) {
      return this.renderQuestionFieldDecryptControl({
        questionId: question.id,
        fieldKey: 'answer',
        allowDecrypt: allowDecryptAnswer,
        decryptTooltip,
        actionLabel: 'Decrypt Answer',
        busy: isAnswerDecrypting,
      });
    }

    const questionComponent = this.renderFullQuestionResponseInput({
      question,
      qIndex,
      surveyIndex,
      answer,
      glowAnswer,
    });

    return (
      <InputGroup id={styles.responseInputSection}>
        {questionComponent}
      </InputGroup>
    );
  };

  renderFullQuestionCommentsContent = ({
    commentsOpen,
    questionId,
    qIndex,
    surveyIndex,
    additional,
    glowAdditional,
    maskedAnswer,
    maskedAdditional,
    allowDecryptAdditional,
    decryptTooltip,
    isAdditionalDecrypting,
  }) => {
    if (!commentsOpen) return null;

    if (maskedAnswer && !maskedAdditional) {
      return this.renderFullQuestionCommentsSection(
        this.renderFullQuestionAdditionalInput({
          qIndex,
          surveyIndex,
          questionId,
          additional,
          glowAdditional,
        })
      );
    }

    if (maskedAnswer || maskedAdditional) {
      return this.renderFullQuestionCommentsSection(
        this.renderQuestionFieldDecryptControl({
          questionId,
          fieldKey: 'additional',
          allowDecrypt: allowDecryptAdditional,
          decryptTooltip,
          actionLabel: 'Decrypt Comments',
          busy: isAdditionalDecrypting,
        })
      );
    }

    return this.renderFullQuestionCommentsSection(
      this.renderFullQuestionAdditionalEditorRow({
        qIndex,
        surveyIndex,
        questionId,
        additional,
        glowAdditional,
      })
    );
  };

  renderFullQuestionCardShell = ({
    cardKey,
    question,
    cardIcons,
    mainContent,
    footerIcons,
    sliderSection,
    commentsSection,
  }) => (
    <SurveyQuestionsFullQuestionCardShell
      key={cardKey}
      cardKey={cardKey}
      promptContent={this.renderPromptWithManualDecrypt(question)}
      cardIcons={cardIcons}
      mainContent={mainContent}
      footerIcons={footerIcons}
      sliderSection={sliderSection}
      commentsSection={commentsSection}
    />
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

        const kA = this.getQuestionFieldTaskKey(qid, 'answer');
        const kD = this.getQuestionFieldTaskKey(qid, 'additional');
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
      return buildSurveyDraftStorageKey({
        sessionSlug: slug,
        networkIdStr: networkIdStr || '__pending__',
        account: this.props?.account,
        surveyScope,
      });
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
      const {
        primaryAnonKey: anonKey,
        primaryAccountKey: acctKey,
        compatAnonKey: anonCompatKey,
        compatAccountKey: acctCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAnonKey: anonPerQidKey,
        perQuestionAccountKey: acctPerQidKey,
      } = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: this.props.questionID,
        includePerQuestionScope: !!this.props.singleQuestionMode,
      });

      const readAndParse = (key) => {
        if (!key) return null;
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) return null;
          const parsedResult = parsePersistedDraftStorageValue({ raw });
          if (parsedResult.status !== 'valid') {
            try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
            return null;
          }
          return { raw: parsedResult.raw, obj: parsedResult.payload };
        } catch (_) { return null; }
      };
      const pend = readAndParse(pendingKey);
      const perQidAnon = anonPerQidKey ? readAndParse(anonPerQidKey) : null;
      const perQidAcct = acctPerQidKey ? readAndParse(acctPerQidKey) : null;
      const rawDraftByKey = new Map([
        ...(pend ? [[pendingKey, pend]] : []),
        ...(perQidAnon ? [[anonPerQidKey, perQidAnon]] : []),
        ...(perQidAcct ? [[acctPerQidKey, perQidAcct]] : []),
      ]);
      const loadPlan = buildSurveyDraftLoadPlan({
        hasAccount: !!accountLower,
        primaryAccountKey: acctKey,
        primaryAnonKey: anonKey,
        compatAccountKey: acctCompatKey,
        compatAnonKey: anonCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAccountKey: acctPerQidKey,
        perQuestionAnonKey: anonPerQidKey,
      });

      for (const step of loadPlan) {
        const hit = rawDraftByKey.get(step.readKey) || readAndParse(step.readKey);
        if (!hit) continue;
        if (step.writeKey) {
          try { sessionStorage.setItem(step.writeKey, hit.raw); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          try { sessionStorage.removeItem(step.readKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
          rawDraftByKey.set(step.writeKey, hit);
        }
        return hit.obj;
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
      const keyTracking = buildPersistedDraftTrackingOnKeyChange({
        nextDraftKey: key,
        lastDraftKey: this._lastDraftKey,
        lastDraftJSON: this._lastDraftJSON,
        lastDraftSemanticSignature: this._lastDraftSemanticSignature,
        draftParseCache: this._draftParseCache,
      });
      this._applyDraftTrackingState(keyTracking);

      // Preload prior persisted answers so we don't prune non-rendered QIDs
      const {
        prevAnswers,
        prevBaseline,
        prevDraftRaw,
        prevSemanticSignature,
        nextDraftParseCache,
        shouldResetDraftTracking,
      } = loadPreviousPersistedDraftSnapshot(
        {
          key,
          lastDraftKey: this._lastDraftKey,
          lastDraftJSON: this._lastDraftJSON,
          lastDraftSemanticSignature: this._lastDraftSemanticSignature,
          draftParseCache: this._draftParseCache,
        },
        {
          readDraftRaw: (draftKey) => sessionStorage.getItem(draftKey) || '',
          removeDraftRaw: (draftKey) => sessionStorage.removeItem(draftKey),
          buildSemanticSignature: buildSurveyDraftSemanticSignature,
        },
      );
      const loadTracking = buildPersistedDraftTrackingAfterLoad({
        lastDraftKey: this._lastDraftKey,
        lastDraftJSON: this._lastDraftJSON,
        lastDraftSemanticSignature: this._lastDraftSemanticSignature,
        draftParseCache: this._draftParseCache,
        nextDraftParseCache,
        shouldResetDraftTracking,
      });
      this._applyDraftTrackingState(loadTracking);

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
      const allowed = buildPersistDraftAllowedQuestionIds({
        renderedQuestionIds: renderedIds,
        dirtyQuestionIds: dirtyQids,
        slice,
      });

      const baselineSlice = this.state.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      // Start from previous draft answers/baseline so non-rendered QIDs survive,
      // then overwrite only the currently allowed question set.
      const { answersObj, baselineObj } = buildPersistedDraftMapsForAllowedIds({
        allowedQuestionIds: allowed,
        slice,
        baselineSlice,
        prevAnswers,
        prevBaseline,
        resolvers: {
          resolveFieldEncryptionAudience: this.resolveFieldEncryptionAudience,
          resolveFieldEncryptionGateId: this.resolveFieldEncryptionGateId,
          normalizeFieldAudienceMode: this.normalizeFieldAudienceMode,
        },
      });

      if (Object.keys(answersObj).length === 0) {
        // No meaningful draft → clear both scoped variants (and SQM compat)
        this.clearDraft();
        return;
      }

      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const persistWritePlan = buildPersistedDraftWritePlan({
        draftKey: key,
        sessionSlug: slug,
        networkIdStr: draftContext.networkIdStr,
        account: this.props?.account,
        surveyScope: this._getDraftScope(),
        singleQuestionMode: this.props.singleQuestionMode,
      });
      const payload = buildPersistedDraftPayload({
        draftContext,
        singleQuestionMode: this.props.singleQuestionMode,
        questionId: this.props.questionID,
        surveyId: this.props.surveyId,
        answersObj,
        // Keep baseline in storage; prefill/merge logic depends on it to avoid false dirty diffs.
        baselineObj,
      });

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
      if (persistWritePlan.compatWriteKey) {
        try {
          sessionStorage.setItem(persistWritePlan.compatWriteKey, nextJson);
        } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }

      const writeTracking = buildPersistedDraftTrackingAfterWrite({
        key,
        raw: nextJson,
        payload,
        semanticSignature: nextSemanticSignature,
      });
      this._applyDraftTrackingState(writeTracking);
      if (this._draftDirtyQids) this._draftDirtyQids.clear();

      persistWritePlan.staleAnonKeys.forEach((draftKey) => {
        try { sessionStorage.removeItem(draftKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      });
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  });

  clearDraft = () => {
    try {
      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const networkIdStr = draftContext.networkIdStr;

      const surveyScope = this._getDraftScope();
      const accountLower = (this.props?.account || '').toLowerCase() || 'anon';
      const { purgeKeys } = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
      });

      purgeKeys.forEach(k => { try { sessionStorage.removeItem(k); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); } });

      const clearedTracking = buildPersistedDraftTrackingClearedState();
      this._applyDraftTrackingState(clearedTracking);
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };


  clearDraftFor = (qid) => {
    try {
      const draftContext = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug = draftContext.sessionSlug || '';
      const networkIdStr = draftContext.networkIdStr;

      const surveyScope = this._getDraftScope();
      const accountLower = (this.props?.account || '').toLowerCase() || 'anon';
      const qidLower = (qid || '').toLowerCase();
      const { purgeKeys } = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: qidLower,
        includePerQuestionScope: !!this.props.singleQuestionMode,
      });

      purgeKeys.forEach((key) => {
        try {
          const raw = sessionStorage.getItem(key);
          if (!raw) return;
          const removalPlan = buildPersistedDraftQuestionRemovalPlan({
            raw,
            questionId: qidLower,
            buildSemanticSignature: buildSurveyDraftSemanticSignature,
          });
          if (removalPlan.action === 'delete-storage') {
            try { sessionStorage.removeItem(key); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
            const deleteTracking = buildPersistedDraftTrackingAfterScopedDelete({
              key,
              lastDraftKey: this._lastDraftKey,
              lastDraftJSON: this._lastDraftJSON,
              lastDraftSemanticSignature: this._lastDraftSemanticSignature,
              draftParseCache: this._draftParseCache,
            });
            this._applyDraftTrackingState(deleteTracking);
            return;
          }
          if (removalPlan.action === 'update-storage' && removalPlan.nextPayload && removalPlan.nextJson) {
              sessionStorage.setItem(key, removalPlan.nextJson);
              const writeTracking = buildPersistedDraftTrackingAfterWrite({
                key,
                raw: removalPlan.nextJson,
                payload: removalPlan.nextPayload,
                semanticSignature: removalPlan.nextSemanticSignature,
              });
              this._applyDraftTrackingState(writeTracking);
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
    return buildNormalizedRenderedQuestionIds({ renderedIds });
  };

  buildLocalCacheHydrationSignature = (surveyIndex, renderedIds = []) => {
    try {
      return resolveLocalCacheHydrationSignatureLookup({
        surveyIndex,
        renderedIds,
        rawSlug: this._getEffectiveDraftSlug(),
        account: this.props?.account,
        minifiedMode: this.props?.minifiedMode,
        questionsCacheNonce: this.props.questionsCacheNonce,
        questionResponsesNonce: this.props.questionResponsesNonce,
        suppressPrefill: this.state?.suppressPrefill,
        submissionError: this.state?.submissionError,
        submissionComplete: this.state?.submissionComplete,
        resolveResponseHydrationContext: (rawSlug) => resolveResponseHydrationContext(this.props, rawSlug),
        normalizeSessionSlugValue,
        getExtraScopeSlugs: (slug) => getExtraQuestionReadSlugs(this.props, slug),
      });
    } catch (_) {
      return '';
    }
  };

  getRenderedQuestionIdsForResponseHydration = () => {
    return buildNormalizedRenderedQuestionIds({
      renderedIds: this.getCurrentRenderedQuestionIds(),
    });
  };

  resolveQuestionSlugMapForIds = (questionIds = [], opts = {}) => {
    return resolveQuestionSlugMapLookup({
      questionIds,
      questionPool: this.state?.questionPool,
      pileQuestions: this.state?.pileQuestions,
      surveyId: Object.prototype.hasOwnProperty.call(opts || {}, 'surveyId') ? opts.surveyId : undefined,
      singleQuestionMode: this.props.singleQuestionMode,
      propsSurveyId: this.props.surveyId,
      props: this.props,
      network: this.props.network,
      normalizeSlug: normalizeSessionSlugValue,
      getSessionSlugByName,
      resolveSlugForIds,
    });
  };

  resolveSubmissionGroupContext = ({ questionIds = [], surveyId = null, fallbackSlug = null } = {}) => {
    return buildSubmissionGroupContext({
      questionIds,
      slugByQuestionId: this.resolveQuestionSlugMapForIds(questionIds, { surveyId }),
      fallbackSlug: fallbackSlug != null ? fallbackSlug : resolveEffectiveSlug(this.props),
      normalizeSlug: normalizeSessionSlugValue,
    });
  };

  getMissingRenderedResponseIdsForAccount = async (opts = {}) => {
    const fallbackSlug = resolveEffectiveSlug(this.props);
    return resolveMissingRenderedResponseLookup({
      responderLower: opts?.responder || this.props.account,
      rawSlug: opts?.slug ?? this._getEffectiveDraftSlug() ?? fallbackSlug,
      fallbackSlug,
      renderedIds: this.getRenderedQuestionIdsForResponseHydration(),
      minifiedMode: this.props?.minifiedMode,
      surveyId: this.props?.surveyId || null,
      resolveResponseHydrationContext: (nextSlug) => resolveResponseHydrationContext(this.props, nextSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug) => (
        this.props?.minifiedMode === 'pile'
          ? getExtraQuestionReadSlugs(this.props, slug)
          : []
      ),
      resolveQuestionSlugMapForIds: (questionIds, context) => this.resolveQuestionSlugMapForIds(
        questionIds,
        { surveyId: context?.surveyId || null }
      ),
      resolveScopeNetId: (resolvedSlug, entryNetId, fallbackNetId) => {
        const resolvedContext = resolveResponseHydrationContext(this.props, normalizeSessionSlugValue(resolvedSlug));
        return resolvedContext.networkIdStr || entryNetId || fallbackNetId;
      },
      readQuestionsCacheAsync,
      ensureQuestionsNet,
    });
  };

  ensurePriorResponsesForRenderedIds = async (opts = {}) => {
    const accountLower = String(this.props.account || '').trim().toLowerCase();
    if (!shouldBackfillPriorResponses({
      loginComplete: this.props.loginComplete,
      account: this.props.account,
      displayAnswerMode: this.props.displayAnswerMode,
      viewAddress: this.props.viewAddress,
      singleQuestionMode: this.props.singleQuestionMode,
      responderAddress: this.props.responderAddress,
      hasRefreshQuestionResponses: typeof this.props.refreshQuestionResponses === 'function',
      submissionComplete: this.state.submissionComplete,
      isSubmitting: this.state.isSubmitting,
    })) return false;

    if (this._priorResponseBackfillInFlight) {
      return this._priorResponseBackfillInFlight;
    }

    const responderLower = String(this.props.account || '').trim().toLowerCase();
    const run = (async () => {
      return runPriorResponseBackfillAttempt({
        responderLower,
        slug: opts?.slug,
        attemptedSet: this._priorResponseBackfillAttempted,
        loadMissingInfo: ({ responder, slug: nextSlug }) => this.getMissingRenderedResponseIdsForAccount({
          responder,
          slug: nextSlug,
        }),
        setHydratingState: (active) => this.setState({ isHydratingPriorResponses: !!active }),
        isMounted: this._isMounted,
        refreshQuestionResponses: this.props.refreshQuestionResponses,
        readQuestionsCacheAsync,
        onFailure: (error) => {
          surveyLog.warn('[SurveyQuestions] Prior-response backfill failed:', error);
        },
        resetLocalCacheMemo: () => {
          // Force the immediate follow-up pass to read the freshly written cache
          // even before parent cache nonces propagate down as props.
          this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
          this._rehydrateLocalCacheLastSig = '';
        },
        triggerRehydrate: () => this.rehydrateLocalCacheAnswersForRenderedIds(),
      });
    })();

    this._priorResponseBackfillInFlight = run.finally(() => {
      if (this._priorResponseBackfillInFlight) {
        this._priorResponseBackfillInFlight = null;
      }
    });
    return this._priorResponseBackfillInFlight;
  };

  rehydrateDraftForRenderedIds = (forceOverwriteOrOptions = false) => {
    const hasOptions = (
      forceOverwriteOrOptions &&
      typeof forceOverwriteOrOptions === 'object' &&
      !Array.isArray(forceOverwriteOrOptions)
    );
    const options = hasOptions ? forceOverwriteOrOptions : {};
    const forceOverwrite = hasOptions
      ? !!options.forceOverwrite
      : !!forceOverwriteOrOptions;
    const setState = options.responseHydrationOwned
      ? this.setResponseHydrationState.bind(this)
      : this.setState.bind(this);
    executeSurveyDraftHydration({
      props: this.props,
      state: this.state,
      loadDraft: () => this.loadDraft(),
      getPendingEditStats: () => this.getPendingEditStats?.() || null,
      getHydrationQuestionIds: () => this.getHydrationQuestionIds(),
      applyDraftHydrationEntryToSlice: this._applyDraftHydrationEntryToSlice,
      cloneBaseline: this.deepClone,
      setState,
      updateJsonPreview: this.updateJsonPreview,
      onError: (error) => { surveyLog.warn('SurveyTool: fallback', error); },
      buildDraftRunPlan: (args) => buildDraftHydrationRunPlan({
        ...args,
        forceOverwrite,
        isDirty: this.state.isDirty,
        modifiedCount: this.state.modifiedCount,
        pendingStats,
        submittedSinceLastEdit: this.state.submittedSinceLastEdit,
        submissionComplete: this.state.submissionComplete,
        prevSurveysResponseState: this.state.surveysResponseState,
        surveyIndex,
        draft,
        prevSlice,
        prevBaseline: this.state.editBaseline,
        cloneBaseline: this.deepClone,
        applyDraftEntryToSlice: this._applyDraftHydrationEntryToSlice,
      });

      if (renderedQuestionIds.length === 0) return;
      if (Object.keys(updates).length === 0) return;

      this.setState(updates, () => applyDraftHydrationEffects({
        updateJsonPreview: this.updateJsonPreview,
      }));
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
    const nextResetState = buildResetFormStatePatch({
      initialSurveysResponseState: Array.isArray(initial) ? initial : [],
      baselineIndex: this.props.surveyIndex || 0,
      nextSubmittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
      cloneValue: this.deepClone,
    });

    this.setState(nextResetState, () => applyResetFormStateEffects({ callback }));
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
      const baselineSlice = resolveRevertPendingBaselineSlice({
        editBaseline: this.state.editBaseline,
        isLoggedIn,
        userAnswers: this.state.userAnswers,
        buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
        buildSliceFromLocalCache: this.buildSliceFromLocalCache,
      });

      const renderedIds = this.getCurrentRenderedQuestionIds();
      const nextSlice = buildRevertedResponseSlice({
        baselineSlice,
        renderedQuestionIds: renderedIds,
        cloneFieldState: this.deepClone,
        buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      });

      this.setState(
        buildRevertPendingStatePatch({
          prevSurveysResponseState: this.state.surveysResponseState,
          surveyIndex,
          nextSlice,
          isLoggedIn,
        }),
        () => applyRevertPendingEffects({
          clearDraft: this.clearDraft,
          recalculateEditStats: this.recalculateEditStats,
          updateJsonPreview: this.updateJsonPreview,
        })
      );
    } catch (e) {
      surveyLog.warn('[SurveyQuestions] handleRevertPendingChanges failed:', e);
    }
  };


  // Build baseline/live slice from server response.
  // Sets encrypted: true for any field with prior encryption.
  // Intelligently merges decrypted values from prevSlice if envelope matches.
  buildSliceFromUserAnswers = (userAnswers, prevSlice = null) => buildHydratedResponseSlice({
    userAnswers,
    prevSlice,
    applyResponseHydrationListToSlice: this._applyResponseHydrationListToSlice,
    parseValue: (value) => {
      try {
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          return JSON.parse(value);
        }
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      return value;
    },
  });

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
  prefillSurveyResponses = (userAnswers, options = {}) => {
    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
    const setState = options?.responseHydrationOwned
      ? this.setResponseHydrationState.bind(this)
      : this.setState.bind(this);

    executeSurveyResponsePrefill({
      state: this.state,
      surveyIndex,
      userAnswers,
      buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
      applyResponseHydrationListToSlice: this._applyResponseHydrationListToSlice,
      setState,
      updateJsonPreview: this.updateJsonPreview,
      recalculateEditStats: this.recalculateEditStats,
    });
  };


  buildSliceFromLocalCache = () => {
    try {
      const {
        scopeSlugs,
        networkIdStr: netId,
        renderedIds: rendered,
        normalizedAccount: acct,
        memoKey,
        shouldUseMemo,
        memoizedValue,
      } = resolveLocalCacheSliceLookup({
        rawSlug: this._getEffectiveDraftSlug(),
        account: this.props?.account,
        renderedIds: this.getCurrentRenderedQuestionIds(),
        minifiedMode: this.props?.minifiedMode,
        questionsCacheNonce: this.props.questionsCacheNonce,
        questionResponsesNonce: this.props.questionResponsesNonce,
        existingMemo: this._localCacheSliceMemo,
        resolveResponseHydrationContext: (rawSlug) => resolveResponseHydrationContext(this.props, rawSlug),
        normalizeSessionSlugValue,
        getExtraScopeSlugs: (slug) => getExtraQuestionReadSlugs(this.props, slug),
      });
      if (shouldUseMemo) {
        return memoizedValue;
      }

      const memoize = (value) => {
        this._localCacheSliceMemo = { key: memoKey, value, hasValue: true };
        return value;
      };

      const slice = loadLocalCacheHydrationSlice({
        scopeSlugs,
        networkIdStr: netId,
        account: acct,
        renderedQuestionIds: rendered,
        readQuestionsCache,
        mergeQuestionResponses,
        parseResponse: (raw) => {
          let resp = raw;
          try {
            if (typeof resp === 'string') { resp = JSON.parse(resp); }
          } catch { resp = null; }
          return resp;
        },
        applyCachedResponseEntryToSlice: this._applyCachedResponseEntryToSlice,
      });
      if (!slice) return memoize(null);

      DEBUG_PREFILL && surveyLog.log('[Survey][buildSlice] Building for rendered IDs:', rendered);
      return memoize(slice);
    } catch (e) {
      this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
      DEBUG_PREFILL && surveyLog.error('[Survey][buildSlice] Error:', e);
      return null;
    }
  };


  rehydrateLocalCacheAnswersForRenderedIds = async (callback = null, options = {}) => {
    let finalCallback = callback;
    let finalOptions = options;
    if (
      callback &&
      typeof callback === 'object' &&
      !Array.isArray(callback)
    ) {
      finalOptions = callback;
      finalCallback = null;
    }
    const setState = finalOptions?.responseHydrationOwned
      ? this.setResponseHydrationState.bind(this)
      : this.setState.bind(this);
    const runId = (Number(this._localCacheRehydrateRunId) || 0) + 1;
    this._localCacheRehydrateRunId = runId;
    const isStaleRun = () => (
      (this._hasMounted && !this._isMounted) ||
      this._localCacheRehydrateRunId !== runId
    );
    await executeSurveyLocalCacheRehydrate({
      props: this.props,
      state: this.state,
      lastHydrationSig: this._rehydrateLocalCacheLastSig,
      getHydrationQuestionIds: () => this.getHydrationQuestionIds(),
      buildHydrationSignature: (idx, ids) => this.buildLocalCacheHydrationSignature(idx, ids),
      buildSliceFromLocalCache: () => this.buildSliceFromLocalCache(),
      setLastHydrationSig: (value) => {
        this._rehydrateLocalCacheLastSig = value;
      },
      loadDraft: () => this.loadDraft(),
      buildDraftAnswersByQuestionId,
      cloneBaseline: this.deepClone,
      buildDraftAwareCacheHydrationState: (args) => buildDraftAwareCacheHydrationState({
        ...args,
        areEnvelopesEquivalent,
      }),
      applyLocalCacheHydrationEntryToSlice: this._applyLocalCacheHydrationEntryToSlice,
      setState,
      updateJsonPreview: this.updateJsonPreview,
      recalculateEditStats: this.recalculateEditStats,
      ensurePriorResponses: () => { void this.ensurePriorResponsesForRenderedIds(); },
      callback: finalCallback,
      bumpNoop: () => bumpSurveyPerfCounter('noopSkipCount'),
      onNoChange: () => {
        DEBUG_PREFILL && surveyLog.log('[Survey][rehydrateLocal] No changes to apply.');
      },
      onError: (error) => {
        DEBUG_PREFILL && surveyLog.error('[Survey][rehydrateLocal] Error:', error);
      },
      isStaleRun,
    });
  };

const toggleAutoDecrypt = () => {
    // Guard: auto-decrypt is disabled for wagmi/passkey providers unless auto-sign is ready.
    if (isAutoDecryptBlocked()) {
      resetBlockedAutoDecryptSweepInternals();
      setState(buildAutoDecryptDisabledState());
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
    const questionPoolIds = Array.isArray(this.props.questionPool)
      ? this.props.questionPool.map((question) => question.id)
      : [];
    const renderedQuestionIds = this.props.singleQuestionMode
      ? (questionPoolIds.length > 0 ? questionPoolIds : [this.props.questionID])
      : (this.props.isStandalone
        ? (questionPoolIds.length > 0 ? questionPoolIds : this.getCurrentRenderedQuestionIds())
        : (this.getCurrentRenderedQuestionIds().length > 0
          ? this.getCurrentRenderedQuestionIds()
          : (Array.isArray(this.state.questionPool) ? this.state.questionPool.map((question) => question.id) : [])));

    return buildInitializedSurveyResponseState({
      singleQuestionMode: this.props.singleQuestionMode,
      isStandalone: this.props.isStandalone,
      surveyIndex: this.props.surveyIndex,
      renderedQuestionIds,
      questionPoolIds,
      prevSurveysResponseState: this.state.surveysResponseState,
      buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
    });
  };


  checkAndHandleStartFresh = () => {
    const idx = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
    const slice = (this.state.surveysResponseState && this.state.surveysResponseState[idx]) || {answers:{},additionalComments:{},importance:{},conviction:{}};
    if (shouldHandleStartFresh({
      viewAddress: this.props.viewAddress,
      userHasResponse: this.state.userHasResponse,
      editBaseline: this.state.editBaseline,
      isDirty: this.state.isDirty,
      currentSlice: slice,
      renderedQuestionIds: this.getCurrentRenderedQuestionIds(),
    })) {
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
    let effectiveSlug = questionReadContext.sessionSlug || slug;
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

    // Temporary demo-1 compatibility: render fixture questions synchronously while
    // the durable Cloudflare-backed demo session is still pending.
    const temporaryDemoSessionConfig = this.props.sessionConfig || {};
    const temporaryDemoSlugCandidates = [
      effectiveSlug,
      questionReadContext.sessionSlug,
      slug,
      this.props.sessionSlug,
      this.props.activeSessionSlug,
    ];
    let temporaryDemoFixtureSlug = '';
    let temporaryDemoFixtureQuestions = [];
    for (const candidateSlug of temporaryDemoSlugCandidates) {
      const candidateQuestions = getTemporaryDemoSessionQuestionFixtures(
        candidateSlug,
        temporaryDemoSessionConfig
      );
      if (!candidateQuestions.length) continue;
      temporaryDemoFixtureSlug = normalizeSessionSlugValue(candidateSlug);
      temporaryDemoFixtureQuestions = candidateQuestions;
      break;
    }
    const temporaryDemoQuestionIds = temporaryDemoFixtureQuestions
      .map((question) => normalizeQuestionIdKey(question?.id))
      .filter(Boolean);
    const shouldUseTemporaryDemoQuestionPool = temporaryDemoQuestionIds.length > 0;
    if (shouldUseTemporaryDemoQuestionPool) {
      if (temporaryDemoFixtureSlug) effectiveSlug = temporaryDemoFixtureSlug;
      const currentQuestionsCache = ensureQuestionsNet(
        readQuestionsCache(effectiveSlug) || {},
        netIdStr
      ) as SurveyQuestionsRecord;
      const questionsNet = currentQuestionsCache[netIdStr] as SurveyQuestionsRecord;
      if (!questionsNet.questions || typeof questionsNet.questions !== 'object') questionsNet.questions = {};
      temporaryDemoFixtureQuestions.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid) return;
        questionsNet.questions[qid] = {
          ...question,
          id: qid,
        };
        if (questionsNet.pendingQuestionMetadata && typeof questionsNet.pendingQuestionMetadata === 'object') {
          delete questionsNet.pendingQuestionMetadata[qid];
        }
      });
      writeQuestionsCache(effectiveSlug, currentQuestionsCache);

      surveyData = {
        ...(surveyData || surveyDataFromCache || {}),
        id: surveyIdLower,
        surveyID: surveyIdLower,
        title: surveyData?.title || surveyDataFromCache?.title || this.props.surveyTitle || 'Demo Session',
        sessionName: surveyData?.sessionName || surveyDataFromCache?.sessionName || this.props.sessionName || effectiveSlug,
        questionIDs: temporaryDemoQuestionIds,
        temporaryDemoSeed: true,
      };

      const currentSurveysCache = ensureSurveysNet(readSurveysCache(effectiveSlug) || {}, netIdStr);
      if (!currentSurveysCache[netIdStr].surveys || typeof currentSurveysCache[netIdStr].surveys !== 'object') {
        currentSurveysCache[netIdStr].surveys = {};
      }
      currentSurveysCache[netIdStr].surveys[surveyIdLower] = surveyData;
      writeSurveysCache(effectiveSlug, currentSurveysCache);
    }

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

    if (shouldUseTemporaryDemoQuestionPool) {
      const fixtureQuestionById = new Map();
      temporaryDemoFixtureQuestions.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid || fixtureQuestionById.has(qid)) return;
        fixtureQuestionById.set(qid, { ...question, id: qid });
      });
      const questionPool = expectedQuestionIds
        .map((qid) => fixtureQuestionById.get(qid))
        .filter(Boolean);
      this.setState({
        questionPool,
        questionPoolExpectedIds: expectedQuestionIds,
        questionPoolPendingIds: expectedQuestionIds.filter((qid) => !fixtureQuestionById.has(qid)),
      });
      return;
    }

    let lastPublishedQuestionPoolSnapshotSig = '';
    const publishQuestionPoolFromCache = ({ warnMissing = false } = {}) => {
      const questionsCacheFromStorage = readQuestionsCache(effectiveSlug) || {};
      const questionsNet = questionsCacheFromStorage[netIdStr] || {
        questionsLatestBlock: 0,
        questions: {},
        questionResponses: {},
        questionResponsesLatestBlock: 0,
      };
      const networkQuestions = (questionsNet.questions || {}) as SurveyQuestionsRecord;

      const questionPool = expectedQuestionIds
        .map((qid: string) => {
          const qData = networkQuestions[qid];
          if (isPendingQuestionMetadataPlaceholder(qData)) return null;
          if (qData) return { ...qData, id: qData.id.toLowerCase() };
          if (warnMissing) {
            surveyLog.warn(`SurveyQuestions: Question data for ID ${qid} not found in cache after ensureQuestionCached.`);
          }
          return null;
        })
        .filter(Boolean);
      const loadedQuestionIds = new Set(
        questionPool
          .map((question: any) => normalizeQuestionIdKey(question?.id))
          .filter(Boolean)
      );
      const pendingQuestionIds = expectedQuestionIds.filter((qid: string) => !loadedQuestionIds.has(qid));

      const nextQuestionPoolSig = buildQuestionIdScopeSignature(questionPool);
      const snapshotSig = JSON.stringify({
        expectedQuestionIds,
        pendingQuestionIds,
        questionPool,
      });
      if (snapshotSig === lastPublishedQuestionPoolSnapshotSig) return;
      lastPublishedQuestionPoolSnapshotSig = snapshotSig;
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
    };

    publishQuestionPoolFromCache();

    // Pass sessionName context to ensureQuestionCached so it knows where to look.
    // Publish after each settled hydration so a survey can render as soon as the
    // first question metadata lands instead of waiting for the full batch.
    const cacheHydrationResults = await Promise.allSettled(
      surveyData.questionIDs.map(async (qid) => {
        try {
          await this.props.ensureQuestionCached(qid, { sessionName: surveyData.sessionName });
          return qid;
        } finally {
          publishQuestionPoolFromCache();
        }
      })
    );
    const failedQuestionHydrations = cacheHydrationResults.filter((result) => result.status === 'rejected');
    if (failedQuestionHydrations.length > 0) {
      surveyLog.warn(
        `SurveyQuestions: ${failedQuestionHydrations.length} question cache hydration request(s) failed for survey ${surveyIdLower}.`,
        failedQuestionHydrations.map((result) => result.reason?.message || result.reason || 'unknown error')
      );
    }
    publishQuestionPoolFromCache({ warnMissing: true });
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
    return buildMergedSurveyResponseState({
      currentState,
      newQuestionPool,
      renderedQuestionIds: this.getCurrentRenderedQuestionIds(),
      surveyIndex,
      buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
    });
  };


  async fetchSurveyResponse() {
    if (!this._isMounted) return;
    const runId = (Number(this._fetchSurveyResponseRunId || 0) + 1);
    this._fetchSurveyResponseRunId = runId;
    const isStale = () => !this._isMounted || this._fetchSurveyResponseRunId !== runId;
    const safe = (...args) => { if (!isStale()) this.setResponseHydrationState(...args); };

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
          if (!isStale()) {
            this.prefillSurveyResponses(userAnswers, { responseHydrationOwned: true });
          }
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

    executeSurveySingleQuestionPrefill({
      state: this.state,
      questionId,
      userAnswer,
      buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
      applyResponseHydrationListToSlice: this._applyResponseHydrationListToSlice,
      setState: this.setResponseHydrationState.bind(this),
      updateJsonPreview: this.updateJsonPreview,
      recalculateEditStats: this.recalculateEditStats,
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
    this.invalidateResponseHydrationRuns();
    executeSurveyStartFresh({
      props: this.props,
      state: this.state,
      getRenderedQuestionIds: this.getCurrentRenderedQuestionIds,
      buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
    });

    this.setState({
      suppressPrefill: true,
      startFresh: true,
      surveysResponseState: nextSurveysResponseState,
      editBaseline: this.deepClone(emptySlice), // pending → 0 immediately
      modifiedCount: 0,
      hasEncryptedChanges: false,
      isDirty: false,
      submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
    }, () => {
      applyStartFreshEffects({
        renderedQuestionIds: renderedIds,
        clearDraftFor: this.clearDraftFor,
        recalculateEditStats: this.recalculateEditStats,
        persistDraftSafely: this.persistDraftSafely,
      });
    });
  };


  async fetchSingleQuestionData(opts = {}) {
    const runId = (Number(this._fetchSingleQuestionRunId) || 0) + 1;
    this._fetchSingleQuestionRunId = runId;
    const isStaleRun = () => !this._isMounted || this._fetchSingleQuestionRunId !== runId;
    const safeSetState = (...args) => {
      if (!isStaleRun()) this.setResponseHydrationState(...args);
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

    const cacheBootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId,
      effectiveSingleSlug,
      responderAddress: String(responderAddress || ''),
      account: String(this.props.account || ''),
      resolveCacheState: (slug) => resolveSingleQuestionCacheState({
        slug,
        questionId,
        resolveQuestionBootstrapContext: (nextSlug) => resolveQuestionBootstrapContext(this.props, nextSlug),
        readQuestionsCacheAsync,
        ensureQuestionsNet,
      }),
      readRecentPayload: readRecentQuestionPayload,
      canUseRecentPayload: canUseRecentQuestionPayloadForAccount,
      resolveBootstrapNetworkId: (slug) => resolveQuestionBootstrapContext(this.props, slug).networkIdStr || '',
      updateCacheAtomic,
      ensureQuestionsNet,
      pickBetterQuestionPayload,
      areQuestionPayloadsEquivalent,
      writeQuestionsCache,
    });
    if (isStaleRun()) return;

    if (cacheBootstrapResult.status === 'seeded-from-recent') {
      const {
        questionData: seededQData,
        shouldBootstrapViewedResponse,
        fallbackNetId,
        cacheState: seededCacheState,
      } = cacheBootstrapResult;
      if (isStaleRun()) return;
      this.setResponseHydrationState(
        (prev) => ({
          questionPool: [{ ...seededQData, id: seededQData.id }],
          surveysResponseState: this.mergeSurveyResponseState(
            prev.surveysResponseState ||
              [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
            [{ ...seededQData, id: seededQData.id }],
            0
          ),
          viewAddressAnswers: '',
          parsedViewAddressAnswers: null,
          noResponse: false,
          isLoadingResponse: shouldBootstrapViewedResponse,
        }),
        () => {
          this.updateJsonPreview();
          this.rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
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
          this.buildAutomaticQuestionMetadataFetchOptions(candidateSlug)
        ),
      }),
      pickBetterQuestionPayload,
      areQuestionPayloadsEquivalent,
      normalizeSingleQuestionMetadataForCache,
      resolveCacheState: getCacheStateForSlug,
      writeQuestionsCache,
    });
    if (isStaleRun()) return;

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

    if (isStaleRun()) return;
    if (!hasPendingRetryForQuestion || bootstrapRetryAttempt > 0) {
      this.clearSingleQuestionBootstrapRetry();
    }

    // Build pool and merge state before fetching responses
    if (isStaleRun()) return;
    this.setResponseHydrationState(
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

        const readFreshCachedResponderResponse = async (responder) => {
          const addr = String(responder || '').toLowerCase();
          if (!addr) return null;

          let freshCache = null;
          try {
            freshCache = await readQuestionsCacheAsync(effectiveSingleSlug);
          } catch (_) {
            freshCache = null;
          }
          if (!freshCache || typeof freshCache !== 'object') return null;

          const netCandidates = [];
          if (netIdStr) netCandidates.push(String(netIdStr));
          Object.keys(freshCache).forEach((candidateNetId) => {
            const normalizedNetId = String(candidateNetId || '').trim();
            if (!normalizedNetId || netCandidates.includes(normalizedNetId)) return;
            netCandidates.push(normalizedNetId);
          });

          for (const candidateNetId of netCandidates) {
            const cached =
              freshCache?.[candidateNetId]?.questionResponses?.[questionId]?.[addr] || null;
            if (!cached || typeof cached !== 'object') continue;
            questionsCache = ensureQuestionsNet(freshCache, netIdStr || candidateNetId);
            return this.deepClone(cached);
          }
          return null;
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
          let latestCacheSource = '';
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
              latestCacheSource = 'snapshot';
            }
          }
          if (!latest) {
            const freshCachedLatest = await readFreshCachedResponderResponse(responderAddress);
            if (freshCachedLatest) {
              latest = freshCachedLatest;
              latestFromCache = true;
              latestCacheSource = 'persistent';
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
                latestCacheSource: latestCacheSource || null,
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
    return resolveDecryptSurveyIdHelper(baselineForDecrypt, {
      propSurveyId: this.props.surveyId || this.props.surveyID,
      questionId,
      defaultSurveyId: ethers.constants.HashZero,
    });
  };


  async handleDecryptEdit() {
    const decryptContext = this.buildDecryptContextSnapshot();
    const decryptAttemptId = this.startSurveyDecryptAttempt();
    this.setState(buildDecryptEditStartState());
    const surveyIndex = decryptContext.surveyIndex;

    // Align decrypt slug with draft slug (single-Q aware)
    const slug = decryptContext.sessionSlug || this._getEffectiveDraftSlug();
    const fallbackUserAnswers = this.state.userAnswers;
    const fallbackSourceSlice =
      this.state.surveysResponseState[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const previousStateSlice = this.state.surveysResponseState?.[surveyIndex] || {};

    try {
      const {
        sourceSlice,
        ratingEnvelopesByQid,
        chainId,
        lit,
        opts,
        poolForDecrypt,
      } = await this.prepareSurveyDecryptAttempt({
        singleQuestionMode: decryptContext.singleQuestionMode,
        questionId: decryptContext.questionID,
        account: decryptContext.account,
        providerLike: decryptContext.provider,
        slug,
        surveyId: decryptContext.surveyId,
        fallbackUserAnswers,
        fallbackSourceSlice,
        previousStateSlice,
      });
      if (!this.isDecryptContextCurrent(decryptContext)) {
        if (this.canUpdateSurveyDecryptAttempt(decryptContext, decryptAttemptId)) {
          this.finishSurveyDecryptAttempt(decryptAttemptId);
          this.setState(this.buildSurveyDecryptStaleState());
        }
        return;
      }
      const {
        normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      } = await this.finalizeSurveyDecryptAttempt({
        sourceSlice,
        ratingEnvelopesByQid,
        account: decryptContext.account,
        providerLike: decryptContext.provider,
        chainId,
        lit,
        poolForDecrypt,
        opts,
        previousStateSlice,
      });
      if (!this.isDecryptContextCurrent(decryptContext)) {
        if (this.canUpdateSurveyDecryptAttempt(decryptContext, decryptAttemptId)) {
          this.finishSurveyDecryptAttempt(decryptAttemptId);
          this.setState(this.buildSurveyDecryptStaleState());
        }
        return;
      }

      this.finishSurveyDecryptAttempt(decryptAttemptId);
      this.setState((prevState) => this.buildSurveyDecryptSuccessState(prevState, {
        surveyIndex,
        decryptedSlice: normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      }), () => {
        const jsonPreview = this.prepareJsonAndHash(surveyIndex);
        this.setState({ jsonPreview });
        this.persistDraftSafely && this.persistDraftSafely(0);
      });
    } catch (error) {
      surveyLog.error('Error decrypting answers:', error);
      if (!this.isDecryptContextCurrent(decryptContext)) {
        if (this.canUpdateSurveyDecryptAttempt(decryptContext, decryptAttemptId)) {
          this.finishSurveyDecryptAttempt(decryptAttemptId);
          this.setState(this.buildSurveyDecryptStaleState());
        }
        return;
      }
      this.finishSurveyDecryptAttempt(decryptAttemptId);
      this.setState(buildDecryptEditFailureState(error.message));
    }
  }


  handleDecryptViewedResponseField = async (questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    const decryptContext = this.buildDecryptContextSnapshot();
    const taskKey = this.buildDecryptTaskKey('viewed', questionId, fieldToDecrypt, responseOverride, decryptContext);
    return this.runDedupedDecryptTask(
      taskKey,
      () => this.handleDecryptViewedResponseFieldInternal(questionId, fieldToDecrypt, responseOverride, decryptContext)
    );
  };

  getViewedResponseOverrideForQuestion = (questionId, responseContainer = this.state?.parsedViewAddressAnswers) => {
    return getViewedResponseOverrideForQuestionHelper(
      questionId,
      responseContainer,
      this.props.responderAddress || this.props.viewAddress || '',
    );
  };

  handleDecryptViewedResponseFieldInternal = async (questionId, fieldToDecrypt = 'both', responseOverride = null, decryptContext = null) => {
    const context = decryptContext || this.buildDecryptContextSnapshot();
    let decryptAttemptToken = null;
    // Require wallet login (viewer). Decryption is enforced by Lit access control conditions.
    if (!context.loginComplete || !context.account) {
      return false;
    }

    const qid = String(questionId || '').trim().toLowerCase();
    if (!qid || !responseOverride || typeof responseOverride !== 'object') {
      return false;
    }

    try {
      const responderForLatest = String(
        responseOverride?.responder ||
        responseOverride?.responderAddress ||
        context.responder ||
        ''
      ).trim();
      const {
        baselineForDecrypt,
        ratingEnvelopes,
      } = await this.prepareViewedQuestionDecryptState({
        questionId: qid,
        fieldToDecrypt,
        responseOverride,
        account: context.account,
        responderForLatest,
        sessionSlug: context.sessionSlug || '',
        networkID: context.networkID,
      });
      if (!this.isDecryptContextCurrent(context)) {
        return false;
      }

      const preparedAttempt = this.prepareQuestionDecryptAttempt({
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
      });

      if (!preparedAttempt.shouldDecrypt) {
        return false;
      }

      const {
        decryptSelection,
        chainId,
        lit,
        opts,
      } = preparedAttempt;
      const {
        keysToMark,
        clearMode,
      } = decryptSelection;

      decryptAttemptToken = this.registerQuestionDecryptBusyTokens(keysToMark);
      this.setState((prev) => this.buildQuestionDecryptStartState(prev, keysToMark));

      const {
        decryptedStateSlice,
        didUpdate,
        decryptedImportance,
        decryptedConviction,
      } = await this.finalizeQuestionDecryptAttempt({
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
        ratingEnvelopes,
        account: context.account,
        providerLike: context.provider,
        chainId,
        lit,
        opts,
      });
      if (!this.isDecryptContextCurrent(context)) {
        if (this.canUpdateStateForAsyncSnapshot(context)) {
          this.setState((prev) => this.buildQuestionDecryptStaleState(prev, qid, fieldToDecrypt, decryptAttemptToken));
        }
        return false;
      }
      if (!this.ownsQuestionDecryptBusyTokens(keysToMark, decryptAttemptToken)) {
        this.setState((prev) => this.buildQuestionDecryptStaleState(prev, qid, fieldToDecrypt, decryptAttemptToken));
        return false;
      }

      this.clearQuestionDecryptBusyTokens(keysToMark, decryptAttemptToken);
      this.setState((prev) => this.buildViewedResponseDecryptSuccessState(prev, {
        questionId: qid,
        clearMode,
        didUpdate,
        decryptedStateSlice,
        decryptedImportance,
        decryptedConviction,
      }));

      return didUpdate;
    } catch (error) {
      surveyLog.error(`Error decrypting viewed response ${fieldToDecrypt} for ${questionId}`, error);
      if (!this.isDecryptContextCurrent(context)) {
        if (decryptAttemptToken != null && this.canUpdateStateForAsyncSnapshot(context)) {
          this.setState((prev) => this.buildQuestionDecryptStaleState(prev, qid, fieldToDecrypt, decryptAttemptToken));
        }
        return false;
      }
      this.setState((prev) => {
        return this.buildQuestionDecryptFailureStateForAttempt(prev, qid, fieldToDecrypt, error.message, decryptAttemptToken);
      });
      return false;
    }
  };

  handleDecryptQuestionAnswer = async (questionId, fieldToDecrypt = 'both', responseOverride = null) => {
    const decryptContext = this.buildDecryptContextSnapshot();
    const taskKey = this.buildDecryptTaskKey('self', questionId, fieldToDecrypt, responseOverride, decryptContext);
    return this.runDedupedDecryptTask(
      taskKey,
      () => this.handleDecryptQuestionAnswerInternal(questionId, fieldToDecrypt, responseOverride, decryptContext)
    );
  };

  handleDecryptQuestionAnswerInternal = async (questionId, fieldToDecrypt = 'both', responseOverride = null, decryptContext = null) => {
    const context = decryptContext || this.buildDecryptContextSnapshot();
    let decryptAttemptToken = null;
    // Require wallet login
    if (!context.loginComplete || !context.account) {
      return false;
    }

    const surveyIndex: any = context.surveyIndex;
    const qid = normalizeQuestionIdKey(questionId);
    if (!qid) return false;

    try {
      // If we're viewing someone else's response (via /question/:id/:responder or /survey/:id?address=),
      // decrypt in-place against the viewed response object (do NOT switch to edit mode).
      const {
        effectiveResponseOverride,
        hasResponseOverride,
        isViewedResponseMode,
      }: any = resolveQuestionDecryptHandlingMode({
        questionId: qid,
        responseOverride,
        viewerAccount: context.account,
        viewedResponder: context.responder || '',
      });
      if (isViewedResponseMode) {
        if (!hasResponseOverride) return false;
        return await handleDecryptViewedResponseField(
          qid,
          fieldToDecrypt,
          effectiveResponseOverride
        );
      }

      const {
        baselineSlice,
        baselineForDecrypt,
        ratingEnvelopes: latestRatingEnvs,
      } = await this.prepareSelfQuestionDecryptState({
        surveyIndex,
        questionId: qid,
        fieldToDecrypt,
        responseOverride: effectiveResponseOverride,
        userAnswers: this.state.userAnswers,
        account: context.account,
        sessionSlug: context.sessionSlug || '',
        networkID: context.networkID,
      });
      if (!this.isDecryptContextCurrent(context)) {
        return false;
      }

      const attemptStatus: any = (startQuestionDecryptAttemptStatusHelper as any)({
        host: engine,
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
      });
      const {
        shouldDecrypt,
        decryptSelection,
        chainId,
        lit,
        opts,
      } = preparedAttempt;
      const {
        keysToMark,
        clearMode,
      } = decryptSelection;

      if (!shouldDecrypt) {
        return false;
      }

      decryptAttemptToken = this.registerQuestionDecryptBusyTokens(keysToMark);
      this.setState((prev) => this.buildQuestionDecryptStartState(prev, keysToMark));

      const {
        decryptedStateSlice,
        didUpdate,
        decryptedImportance,
        decryptedConviction,
      }: any = await finalizeQuestionDecryptAttempt({
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
        ratingEnvelopes: latestRatingEnvs,
        account: context.account,
        providerLike: context.provider,
        chainId,
        lit,
        opts,
      });
      const completionStatus: any = (applyQuestionDecryptCompletionStatusHelper as any)({
        host: engine,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        keysToMark: attemptStatus.keysToMark,
        successStateKind: 'self',
        successStateOptions: { surveyIndex, questionId: qid, clearMode: attemptStatus.clearMode, didUpdate, baselineSlice, decryptedStateSlice, decryptedImportance, decryptedConviction },
        onSuccessStateApplied: () => {
          updateJsonPreview && updateJsonPreview();
          persistDraftSafely && persistDraftSafely(0);
        },
      });

      return didUpdate;
    } catch (error) {
      surveyLog.error(`Error decrypting ${fieldToDecrypt} for ${questionId}`, error);
      return (applyQuestionDecryptFailureStatusHelper as any)({
        host: engine,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        error,
      });
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
      if (s?.title) surveyTitle = sanitizeSurveyTitleForResponsePayload(s);
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
        prompt: sanitizeQuestionPromptForResponsePayload(q, {
          isLocked: this.getQuestionEncryptionGates(q).length > 0,
        }),
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
          prompt: sanitizeQuestionPromptForResponsePayload(q, {
            isLocked: this.getQuestionEncryptionGates(q).length > 0,
          }),
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

  jsonTreeDisplay = (jsonInput) => (
    <SurveyQuestionsJsonTree
      jsonInput={jsonInput}
      onInvalidInput={(...args) => surveyLog.error(...args)}
    />
  );

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
    return buildSurveyQuestionsJson({
      singleQuestionMode: this.props.singleQuestionMode,
      questionPool: this.state.questionPool,
    });
  };

  getResponseJson = () => {
    const isViewingSubmitted = shouldUseSubmittedResponseJson({
      viewAddress: this.props.viewAddress,
      responderAddress: this.props.responderAddress,
      parsedViewAddressAnswers: this.state.parsedViewAddressAnswers,
      isEditing: this.state.isEditing,
      userAnswers: this.state.userAnswers,
    });

    if (isViewingSubmitted) {
      return buildSubmittedResponseJson({
        rawResponse: this.state.parsedViewAddressAnswers || this.state.userAnswers,
        singleQuestionMode: this.props.singleQuestionMode,
      });
    }

    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    return this.prepareJsonAndHash(surveyIndex);
  };

  getSurveyJson = () => {
    return buildSurveyDefinitionJson({
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      surveys: this.props.surveys,
      surveyIndex: this.props.surveyIndex,
      questionPool: this.state.questionPool,
    });
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

  getLockAudienceDisplayState = ({
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
    visualContext = 'default',
  }) => {
    const qid = String(questionId || '').toLowerCase();
    const resolvedFieldKey = String(fieldKey || '').trim().toLowerCase() === 'additional'
      ? 'additional'
      : 'answer';
    const fieldState = (field && typeof field === 'object') ? field : (answer || {});
    const forcedGate = this.isQuestionLockedForResponse(qid);
    const gateOption = this.resolveQuestionGateOption(qid);
    const gateOptions = Array.isArray(gateOption?.gateDetails) ? gateOption.gateDetails : [];
    const currentAudience = this.resolveFieldEncryptionAudience(fieldState, qid, resolvedFieldKey);
    const currentGateId = this.resolveFieldEncryptionGateId(fieldState, qid, resolvedFieldKey);
    const currentAudienceMode = this.normalizeFieldAudienceMode(
      fieldState?.audienceMode,
      resolvedFieldKey,
      fieldState
    );
    const displayState = buildLockAudienceDisplayState({
      questionId: qid,
      fieldKey: resolvedFieldKey,
      fieldState,
      lockDisabled,
      lockTitle,
      glowAnswer,
      forceAudienceMenu,
      selfAudienceLabel: this.normalizeGateLabelText(selfAudienceLabel) || 'for me',
      showPlaintextOption,
      visualContext,
      forcedGate,
      gateOptions,
      hasGateOption: !!gateOption,
      menuOpen: this.isLockAudienceMenuOpen(qid, resolvedFieldKey),
      currentAudience,
      currentGateId,
      currentAudienceMode,
    });
    const menuStateKey = displayState.hasAudienceMenu
      ? this.getLockAudienceMenuStateKey(qid, displayState.effectiveFieldKey)
      : '';
    const expandedGateId = this.normalizeGateLabelText(
      this.state.lockAudienceGateDetailsByQuestion?.[menuStateKey] || ''
    );

    return {
      ...displayState,
      expandedGateId,
    };
  };

  applyLockAudienceSelection = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    audience,
    gateId = '',
  }) => {
    if (effectiveFieldKey === 'additional') {
      this.applyAdditionalEncryptionAudience(surveyIndex, qid, audience, { gateId });
      return;
    }
    this.applyAnswerEncryptionAudience(surveyIndex, qid, audience, { gateId });
  };

  toggleQuestionFieldEncryptionEnabled = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    nextEncrypted,
  }) => {
    if (effectiveFieldKey === 'additional') {
      this.toggleAdditionalCommentsEncryption(surveyIndex, qid, nextEncrypted);
      return;
    }
    this.toggleAnswerEncryption(surveyIndex, qid, nextEncrypted);
  };

  handleLockAudienceButtonClick = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    fieldState,
    lockDisabled,
    forcedGate,
    hasAudienceMenu,
    menuOpen,
    hasGateOption,
  }) => {
    const action = buildLockAudienceButtonAction({
      effectiveFieldKey,
      fieldEncrypted: !!fieldState?.encrypted,
      lockDisabled,
      forcedGate,
      hasAudienceMenu,
      menuOpen,
      hasGateOption,
    });

    if (action.kind === 'noop') return;

    if (action.kind === 'toggle-field-encryption') {
      this.toggleQuestionFieldEncryptionEnabled({
        surveyIndex,
        qid,
        effectiveFieldKey,
        nextEncrypted: action.nextEncrypted,
      });
      return;
    }

    if (action.kind === 'disable-field-encryption-and-close-menu') {
      this.toggleQuestionFieldEncryptionEnabled({
        surveyIndex,
        qid,
        effectiveFieldKey,
        nextEncrypted: false,
      });
      this.toggleLockAudienceMenu(qid, false, effectiveFieldKey);
      return;
    }

    if (action.kind === 'enable-answer-and-open-menu') {
      this.toggleAnswerEncryption(surveyIndex, qid, true);
      this.toggleLockAudienceMenu(qid, true, effectiveFieldKey);
      return;
    }

    if (action.kind === 'set-menu-open') {
      this.toggleLockAudienceMenu(qid, action.nextOpen, effectiveFieldKey);
    }
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
    const {
      qid,
      effectiveFieldKey,
      isPileVisualContext,
      fieldState,
      forcedGate,
      gateOptions,
      hasGateOption,
      hasAudienceMenu,
      menuOpen,
      currentAudience,
      currentGateId,
      currentAudienceMode,
      gateActive,
      selfActive,
      plaintextActive,
      followActive,
      pileMenuPressed,
      showBrightLockState,
      isLockDisabled,
      allowPlaintextOption,
      lockButtonStyle,
      normalizedSelfAudienceLabel,
      expandedGateId,
      buttonTitle,
    } = this.getLockAudienceDisplayState({
      questionId,
      answer,
      fieldKey,
      field,
      lockDisabled,
      lockTitle,
      glowAnswer,
      forceAudienceMenu,
      selfAudienceLabel,
      showPlaintextOption,
      visualContext,
    });
    const handleAudienceSelect = (audience, gateId = '') => {
      this.applyLockAudienceSelection({
        surveyIndex,
        qid,
        effectiveFieldKey,
        audience,
        gateId,
      });
    };

    const handleLockClick = () => {
      this.handleLockAudienceButtonClick({
        surveyIndex,
        qid,
        effectiveFieldKey,
        fieldState,
        lockDisabled,
        forcedGate,
        hasAudienceMenu,
        menuOpen,
        hasGateOption,
      });
    };

    return (
      <SurveyQuestionsLockAudienceControl
        qid={qid}
        effectiveFieldKey={effectiveFieldKey}
        isPileVisualContext={isPileVisualContext}
        pileMenuPressed={pileMenuPressed}
        showBrightLockState={showBrightLockState}
        isLockDisabled={isLockDisabled}
        buttonTitle={buttonTitle}
        hasAudienceMenu={hasAudienceMenu}
        menuOpen={menuOpen}
        lockButtonStyle={lockButtonStyle}
        fieldState={fieldState}
        forcedGate={forcedGate}
        gateOptions={gateOptions}
        gateActive={gateActive}
        currentGateId={currentGateId}
        selfActive={selfActive}
        plaintextActive={plaintextActive}
        followActive={followActive}
        allowPlaintextOption={allowPlaintextOption}
        normalizedSelfAudienceLabel={normalizedSelfAudienceLabel}
        expandedGateId={expandedGateId}
        showFollowOption={showFollowOption}
        onLockClick={handleLockClick}
        onSelectAudience={handleAudienceSelect}
        onToggleGateDetails={(nextQid, gateId, nextFieldKey) => (
          this.toggleLockAudienceGateDetails(nextQid, gateId, nextFieldKey)
        )}
      />
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
      responseSlice: currentSurveyResponseState,
    });
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

    const cardIcons = this.renderFullQuestionCardIcons({
      question,
      showResponseLookupSpinner,
      isQuestionBookmarked,
    });

    // If the prompt is still masked, do not allow answering (prevents nonsense submits).
    // This primarily affects direct-link `/question/:id?...` flows; list views filter these out.
    const promptMasked = this.isQuestionPromptMasked(question);
    if (promptMasked) {
      return this.renderQuestionMaskedPromptCard({
        mode: 'full',
        cardKey,
        question,
        cardIcons,
      });
    }

    const commentsOpen = this.getCommentsOpen(question.id, hasAdditionalContent);
    const handleToggleComments = () => this.toggleComments(question.id, hasAdditionalContent);
    const footerIcons = this.renderFullQuestionFooterIcons({
      surveyIndex,
      question,
      answer,
      glowAnswer,
      maskedAnswer,
      hasAdditionalContent,
      commentsOpen,
      onToggleComments: handleToggleComments,
    });
    const sliderSection = this.renderFullQuestionSliderSection({
      surveyIndex,
      questionId: question.id,
      sliderMode,
      activeSliderValue,
      convictionValue,
      importanceValue,
      hasConvictionImportanceValue,
      sliderOpen,
    });

    return this.renderFullQuestionCardShell({
      cardKey,
      question,
      cardIcons,
      mainContent: this.renderFullQuestionMainContent({
        question,
        qIndex,
        surveyIndex,
        answer,
        glowAnswer,
        maskedAnswer,
        allowDecryptAnswer,
        decryptTooltip,
        isAnswerDecrypting,
      }),
      footerIcons,
      sliderSection,
      commentsSection: this.renderFullQuestionCommentsContent({
        commentsOpen,
        questionId: question.id,
        qIndex,
        surveyIndex,
        additional,
        glowAdditional,
        maskedAnswer,
        maskedAdditional,
        allowDecryptAdditional,
        decryptTooltip,
        isAdditionalDecrypting,
      }),
    });
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
      label: this.resolveSbtGateLabel(address) || getShortenedAddress(address, false),
      meta: getShortenedAddress(address, false),
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
            .map((addr) => this.resolveSbtGateLabel(addr) || getShortenedAddress(addr, false))
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
            .map((addr) => this.resolveSbtGateLabel(addr) || getShortenedAddress(addr, false))
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
    const questionGateDetails = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds,
      pool,
      slug,
      getQuestionEncryptionGates: (question) => this.getQuestionEncryptionGates(question),
      normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (args) => this.resolveConfiguredGateLabel(args),
      resolveSbtGateLabel: (address, preferredSlug = '') => this.resolveSbtGateLabel(address, preferredSlug),
      getShortenedAddress,
      buildSbtDetailPath,
      normalizeSessionSlug: normalizeSessionSlugValue,
      getChecksumAddress: (address) => (
        ethers.utils.isAddress(address) ? ethers.utils.getAddress(address) : address
      ),
      translate: t,
    });
    if (questionGateDetails.length > 0) return questionGateDetails;
    return this.buildSessionQuestionGateDetails(hiddenIds.size || 1);
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

  buildSessionQuestionGateDetails = (questionCount = 0) => {
    const count = Math.max(1, Number(questionCount || 0) || 1);
    const slug = String(
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    ).trim().toLowerCase();
    const options = this.getResponseGateOptions(null);
    return (Array.isArray(options) ? options : [])
      .map((option, index) => {
        const sbtAddresses = Array.from(new Set(
          (Array.isArray(option?.sbtAddresses) ? option.sbtAddresses : [])
            .map((address) => String(address || '').trim())
            .filter(Boolean)
        ));
        if (!sbtAddresses.length) return null;
        const id = `session:${option.gateId || index}:${sbtAddresses.map((address) => address.toLowerCase()).sort().join('|')}`;
        const sessionSlug = slug || normalizeSessionSlugValue(option?.sessionSlug || '');
        return {
          id,
          label: option.label || t('gate'),
          sbtAddresses,
          questionIds: new Set(),
          questionCount: count,
          sessionSlug,
          sbts: sbtAddresses.map((address) => ({
            address,
            label: this.resolveSbtGateLabel(address, sessionSlug) || getShortenedAddress(address, false),
            href: buildSbtDetailPath(address, sessionSlug),
          })),
        };
      })
      .filter(Boolean);
  };

  getLockedGateRequirementSentence = (lockedGateDetails = []) => (
    buildLockedGateRequirementSentenceCore(lockedGateDetails, { translate: t })
  );

  renderLockedQuestionsPanel = ({
    hiddenMaskedQuestionIds = [],
    lockedGateDetails = [],
    title = '',
    subtitle = '',
    forceExpanded = false,
    surface = 'light',
    showCaret = true,
  } = {}) => (
    <SurveyQuestionsLockedQuestionsPanel
      hiddenMaskedQuestionIds={hiddenMaskedQuestionIds}
      lockedGateDetails={lockedGateDetails}
      title={title}
      subtitle={subtitle}
      forceExpanded={forceExpanded}
      surface={surface}
      showCaret={showCaret}
      bulkPromptReloading={!!this.state.bulkPromptReloading}
      lockedGateDetailsExpanded={!!this.state.lockedGateDetailsExpanded}
      onDecrypt={(questionIds) => this.reloadMaskedQuestionBatch(questionIds)}
      onToggleDetails={() => this.setState((prev) => ({ lockedGateDetailsExpanded: !prev.lockedGateDetailsExpanded }))}
    />
  );

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
      return `${t('sbt')} ${sbtName || getShortenedAddress(fallbackSbt, false)}`;
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
        .map((addr) => this.resolveSbtGateLabel(addr) || getShortenedAddress(addr, false))
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
      const arr = buildSurveyResponseStateArray({
        prevSurveysResponseState: prev.surveysResponseState,
        surveyIndex: idx,
      });

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
      const arr = buildSurveyResponseStateArray({
        prevSurveysResponseState: prev.surveysResponseState,
        surveyIndex: idx,
      });

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

const buildSubmitContextSnapshot = () => {
    const singleQuestionMode: any = !!propsRef.current.singleQuestionMode;
    const isStandalone: any = !!propsRef.current.isStandalone;
    const surveyIndex: any = singleQuestionMode || isStandalone ? 0 : (propsRef.current.surveyIndex || 0);
    const effectiveDraftSlug: any = resolveSubmitEffectiveDraftSlug({
      draftSlug: inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '',
      routeSlug: resolveEffectiveSlug(propsRef.current),
      normalizeSlug: normalizeSessionSlugValue,
    });

    return {
      props: this.props,
      account: this.props.account || '',
      provider: this.props.provider,
      providerKind: String(cryptoUtils.getProviderKind(this.props.provider) || '').trim().toLowerCase(),
      loginComplete: !!this.props.loginComplete,
      singleQuestionMode,
      isStandalone,
      surveyIndex,
      surveyId: this.props.surveyId || '',
      questionID: this.props.questionID || '',
      effectiveDraftSlug,
      chainId: this.resolveSessionChainId(effectiveDraftSlug, null, this.props),
      mounted: !!this._isMounted,
    };
  };

  buildSubmitContextKey = (snapshot = null) => {
    const context = snapshot || this.buildSubmitContextSnapshot();
    return [
      String(context.account || '').trim().toLowerCase(),
      String(context.providerKind || '').trim().toLowerCase(),
      normalizeSessionSlugValue(context.effectiveDraftSlug || ''),
      String(context.chainId || '').trim(),
      context.singleQuestionMode ? 'single' : (context.isStandalone ? 'standalone' : 'survey'),
      String(context.surveyIndex ?? '').trim(),
      String(context.surveyId || '').trim().toLowerCase(),
      String(context.questionID || '').trim().toLowerCase(),
    ].join('|');
  };

  isSubmitContextCurrent = (snapshot = null) => (
    !!snapshot &&
    (!snapshot.mounted || this._isMounted) &&
    this.buildSubmitContextKey(snapshot) === this.buildSubmitContextKey()
  );

  buildSubmitStaleState = () => ({
    isSubmitting: false,
    submitProgress: 0,
    currentStep: 0,
  });

  startSubmitAttempt = () => {
    const attemptId = (Number(this._submitAttemptSeq) || 0) + 1;
    this._submitAttemptSeq = attemptId;
    this._activeSubmitAttemptSeq = attemptId;
    return attemptId;
  };

  finishSubmitAttempt = (attemptId = null) => {
    if (Number(attemptId || 0) > 0 && this._activeSubmitAttemptSeq === attemptId) {
      this._activeSubmitAttemptSeq = 0;
    }
  };

  handleStaleSubmitContext = (snapshot = null) => {
    this._submitGuard = false;
    if (
      this.canUpdateStateForAsyncSnapshot(snapshot) &&
      Number(snapshot?.submitAttemptId || 0) > 0 &&
      this._activeSubmitAttemptSeq === snapshot.submitAttemptId
    ) {
      this.finishSubmitAttempt(snapshot.submitAttemptId);
      this.setState(this.buildSubmitStaleState());
    }
  };

  encryptAndUpload = async () => {
    let submitContext = null;
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

      submitContext = this.buildSubmitContextSnapshot();
      submitContext.submitAttemptId = this.startSubmitAttempt();
      this.setState(buildSubmitStartState());

      const providerKind = cryptoUtils.getProviderKind(submitContext.provider);

      // Compute changed set once (used for encrypt + submit)
      const surveyIndex = submitContext.surveyIndex;
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
          const surveyId = submitContext.singleQuestionMode ? ethers.constants.HashZero : submitContext.surveyId;
          const poolForCommit =
            (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)
              ? this.state.questionPool
              : (Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : []);
          const encState = await this.encryptFieldWorkGroups({
            workGroups,
            baseOpts: {
              providerKind,
              provider: submitContext.provider,
              account: submitContext.account,
              chainId: submitContext.chainId,
              surveyId,
              questionPool: poolForCommit,
              hasher: this.state.hasher,
            },
          });
          if (!this.isSubmitContextCurrent(submitContext)) {
            this.handleStaleSubmitContext(submitContext);
            return;
          }

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

          // Verify against the freshly merged slice instead of immediately rereading
          // `this.state`, which can still hold the pre-encryption draft until React
          // flushes the async class-state update.
          await this.verifyEncryption(changedQids, base);
        }
      }

      this.setState({ currentStep: 2 });

      // Await the receipt to ensure transaction is confirmed before optimistic update
      const receipt = await this.submitSurveyResponse(activeSlice, changedQids, submitContext);
      if (!this.isSubmitContextCurrent(submitContext)) {
        this.handleStaleSubmitContext(submitContext);
        return;
      }
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
          : submitContext.effectiveDraftSlug
      );
      try {
        const accountLower = (submitContext.account || '').toLowerCase();
        if (accountLower) {
          if (submitContext.singleQuestionMode) {
            const qLower = (submitContext.questionID || '').toLowerCase();
            if (qLower) {
              responseUrl = buildQuestionRoutePath(qLower, {
                responderAddress: accountLower,
                sessionSlug: submittedCacheSlug,
              });
            }
          } else if (!submitContext.isStandalone) {
            const sLower = (submitContext.surveyId || '').toLowerCase();
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

      // Regression guard: the encrypted merge above is a class setState, so
      // build optimistic JSON from the known final slice instead of this.state.
      const optimisticUserAnswers = this.prepareJsonAndHash(surveyIndex, undefined, finalSlice);

      // Check encryption status from the new baseline
      const hasEncrypted = Object.values(nextBaseline.answers || {}).some(a => !!a.encrypted) ||
                           Object.values(nextBaseline.additionalComments || {}).some(a => !!a.encrypted);
      this.invalidateDiffCaches();
      this._userAnswersSliceCache = { source: null, value: null };

      runSurveyQuestionsSubmitSuccessController({
        editBaseline: nextBaseline,
        hasEncrypted,
        responseUrl,
        submittedSinceLastEdit: this.state.submittedSinceLastEdit,
        submitAttemptId: submitContext.submitAttemptId,
        surveysResponseState: nextSurveysResponseState,
        editBaseline: nextBaseline,

        userAnswers: optimisticUserAnswers,
        ports: {
          clearSubmitGuard: () => {
            this._submitGuard = false;
          },
          finishSubmitAttempt: (submitAttemptId) => this.finishSubmitAttempt(submitAttemptId),
          setSubmitSuccessState: (statePatch, afterStateApplied) => this.setState(statePatch, afterStateApplied),
        },
        afterStateApplied: async () => {
          try {
            if (!this.isSubmitContextCurrent(submitContext)) return;
            const cacheWriteResult = await this.writeSubmittedResponsesToLocalCaches({
              receipt,
              questionResponses: receipt?.__ceQuestionResponses,
              surveyResponse: receipt?.__ceSurveyResponse,
              surveyId: receipt?.__ceSurveyId,
              submissionSlug: submittedCacheSlug,
            }, submitContext).catch((error) => {
              surveyLog.warn('[SurveyQuestions] Local submit cache write-through failed:', error);
              return { questionCacheWritten: false, surveyCacheWritten: false };
            });
            if (!this.isSubmitContextCurrent(submitContext)) return;

            if (
              !cacheWriteResult?.questionCacheWritten &&
              typeof this.props.refreshQuestionResponses === 'function'
            ) {
              const ids = Array.from(changedQids).map((id) => normalizeQuestionIdKey(id)).filter(Boolean);
              if (ids.length > 0 && this.isSubmitContextCurrent(submitContext)) {
                await this.props.refreshQuestionResponses(ids, {
                  slug: submittedCacheSlug,
                  responder: submitContext.account || '',
                });
              }
            }
            if (
              !cacheWriteResult?.surveyCacheWritten &&
              !submitContext.singleQuestionMode &&
              typeof this.props.refreshSurveyResponsesByID === 'function' &&
              submitContext.surveyId
            ) {
              if (this.isSubmitContextCurrent(submitContext)) {
                await this.props.refreshSurveyResponsesByID(submitContext.surveyId);
              }
            }
          } catch (e) { surveyLog.warn('SurveyTool: callback', e); }
        },
      });
    } catch (error) {
      surveyLog.error('Failed to submit survey:', error);
      if (submitContext && !this.isSubmitContextCurrent(submitContext)) {
        this.handleStaleSubmitContext(submitContext);
        return;
      }
      runSurveyQuestionsSubmitFailureController({
        error,
        submittedSinceLastEdit: this.state.submittedSinceLastEdit,
        submitAttemptId: submitContext?.submitAttemptId,
        ports: {
          clearSubmitGuard: () => {
            this._submitGuard = false;
          },
          finishSubmitAttempt: (submitAttemptId) => this.finishSubmitAttempt(submitAttemptId),
          setSubmitFailureState: (statePatch) => this.setState(statePatch),
        },
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
      const baselineSlice = resolveExitEditingBaselineSlice({
        responderAddress: this.props.responderAddress,
        parsedViewAddressAnswers: this.state.parsedViewAddressAnswers,
        userAnswers: this.state.userAnswers,
        buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
        buildSliceFromLocalCache: this.buildSliceFromLocalCache,
      });

      this.setState(
        buildExitEditingStatePatch({
          prevSurveysResponseState: this.state.surveysResponseState,
          surveyIndex,
          baselineSlice,
          renderedQuestionIds: this.getCurrentRenderedQuestionIds(),
          buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
          cloneValue: this.deepClone,
          nextSubmittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
        }),
        () => {
          this.recalculateEditStats && this.recalculateEditStats();
          this.persistDraftSafely && this.persistDraftSafely();
          this.updateJsonPreview && this.updateJsonPreview();
        }
      );

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



  verifyEncryption = async (onlyTheseQids = null, sliceOverride = null) => {
    surveyLog.log("Verifying encryption...");
    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    const stateToCheck = sliceOverride || this.state.surveysResponseState[surveyIndex];
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

  submitSurveyResponse = async (overrideState = null, overrideChangedQids = null, submitContext = null) => {
    const context = submitContext && typeof submitContext === 'object'
      ? submitContext
      : this.buildSubmitContextSnapshot();
    if (!context.loginComplete) {
      this.props.toggleLoginModal(true);
      return;
    }

    // Use correct survey index for payload + diff gating
    const idx = context.surveyIndex;

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

    let filtered;
    try {
      filtered = filterChangedResponsesForSubmit({
        data,
        changedSet,
        singleQuestionMode: !!context.singleQuestionMode,
        isStandalone: !!context.isStandalone,
        surveyId: context.surveyId,
        HashZero: ethers.constants.HashZero,
      });
    } catch (e) {
      this._submitGuard = false;
      this.setState(buildSubmitPreparationErrorState(
        e.message || 'No new or changed responses to submit.'
      ));
      throw e;
    }

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
      surveyId: context.singleQuestionMode ? null : (context.surveyId || null),
      fallbackSlug: context.effectiveDraftSlug,
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
      await processRatingEnvelopesForSubmit(
        {
          sliceForSubmit:
            (overrideState && typeof overrideState === 'object')
              ? overrideState
              : (this.state.surveysResponseState && this.state.surveysResponseState[idx]) ||
                { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
          userAnswersSource: this.state.userAnswers,
          questionResponses,
          changedMapForSubmit,
          encryptionBaseOpts: {
            provider: context.provider,
            account: context.account,
            chainId: this.resolveSessionChainId(submissionGroupKey, null, context.props || this.props) || context.chainId,
            surveyId:
              (context.singleQuestionMode || context.isStandalone)
                ? ethers.constants.HashZero
                : context.surveyId,
            kind: 'rating',
            hasher: this.state.hasher,
          },
        },
        {
          isQuestionLockedForResponse: (qid) => this.isQuestionLockedForResponse(qid),
          resolveFieldEncryptionAudience: (field, qid, fk) => this.resolveFieldEncryptionAudience(field, qid, fk),
          getEffectiveRecipientsForQid: (qid) => this.getEffectiveRecipientsForQid(qid),
          getEffectiveRecipientsForField: (opts) => this.getEffectiveRecipientsForField(opts),
          getDefaultResponseEncryptionAudienceForQid: (qid) => this.getDefaultResponseEncryptionAudienceForQid(qid),
          buildLitEncryptionOptionsForRecipients: (r) => this.buildLitEncryptionOptionsForRecipients(r),
          encryptEnvelopeValue: (value, opts) => cryptoUtils.encryptEnvelopeValue(value, opts),
          getImportanceFromResponse,
          getConvictionFromResponse,
          warn: (msg, err) => surveyLog.warn(msg, err),
        },
      );
    } catch (e) {
      surveyLog.error('Failed to encrypt response rating:', e);
      throw e;
    }
    // Regression guard: rating envelope encryption can await Lit/provider work; do
    // not broadcast if the viewer/session changed while that was in flight.
    if (!this.isSubmitContextCurrent(context)) {
      throw new Error('Submission context changed before broadcast.');
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
      context.provider,
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

  writeSubmittedResponsesToLocalCaches = async (params = {}, submitContext = null) => {
    const context = submitContext && typeof submitContext === 'object' ? submitContext : null;
    const contextProps = context?.props || this.props;
    return writeSubmittedResponsesToLocalCachesHelper(params, {
      account: context?.account || this.props.account || '',
      effectiveDraftSlug: context?.effectiveDraftSlug || this._getEffectiveDraftSlug() || '',
      singleQuestionMode: context ? !!context.singleQuestionMode : !!this.props.singleQuestionMode,
      isStandalone: context ? !!context.isStandalone : !!this.props.isStandalone,
      deepClone: (obj) => this.deepClone(obj),
      resolveSubmittedCacheWriteContext: (slug) => resolveSubmittedCacheWriteContext(contextProps, slug),
    });
  };


  renderQuestionAnswer = (question, response, index, isOwnResponse) => {
    if (!question || !response) {
      surveyLog.warn('renderQuestionAnswer: question or response is undefined');
      return null;
    }
    const promptReloading = this.isQuestionFieldBusy(question.id, 'prompt');
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
    const promptReloading = this.isQuestionFieldBusy(question.id, 'prompt');
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
    return (
      <SurveyQuestionsSurveyAnswersView
        isOwnResponse={isOwnResponse}
        onWarning={(...args) => surveyLog.warn(...args)}
        questionPool={this.state.questionPool}
        renderQuestionAnswer={this.renderQuestionAnswer}
        responses={responses}
      />
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
    const fullLoadingProgress = buildSurveyQuestionsFullLoadingProgressState({
      questionScanProgress: this.props.questionScanProgress,
      progressSlug:
        (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(this.props) ||
        '',
    });

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
            {fullLoadingProgress.hasFullLoadingProgress && (
              <div className={styles.fullLoadingProgressWrap}>
                <div className={styles.fullLoadingProgressMeta}>
                  <span>{fullLoadingProgress.metaLeftText}</span>
                  <span>{fullLoadingProgress.metaRightText}</span>
                </div>
                <div className={styles.fullLoadingProgressBar}>
                  <div
                    className={styles.fullLoadingProgressFill}
                    style={fullLoadingProgress.fillStyle}
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
        ? getShortenedAddress(
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
    const _suffix = _pendingStats.total === 1 ? 'Response' : 'Responses';

    const submitButtonText = isSingleQuestionView
      ? 'SUBMIT'
      : (this.props.computeSubmitLabel || computeSubmitLabel)(this, {
          suffix: _suffix,
          pendingStats: _pendingStats,
        });
    const submitHasEncryptedAnswers =
      this.state.isSubmitting &&
      this.state.currentStep === 1
        ? this.hasEncryptedAnswers()
        : false;
    const submitHasMaskedCurrentQuestionPayload =
      !this.state.isSubmitting &&
      this.props.singleQuestionMode
        ? this.hasMaskedCurrentQuestionPayload()
        : false;
    const submitFooterDisplayState = buildSurveyQuestionsSubmitFooterDisplayState({
      currentStep: this.state.currentStep,
      hasEncryptedAnswers: submitHasEncryptedAnswers,
      hasMaskedCurrentQuestionPayload: submitHasMaskedCurrentQuestionPayload,
      isDirty: this.state.isDirty,
      isEditing: this.state.isEditing,
      isLoadingResponse: this.state.isLoadingResponse,
      isSingleQuestionView,
      isSubmitting: this.state.isSubmitting,
      pendingEditCount: _pendingStats.total,
      responseUrl: this.state.responseUrl,
      singleQuestionMode: this.props.singleQuestionMode,
      startFresh: this.state.startFresh,
      submissionComplete: this.state.submissionComplete,
      submittedSinceLastEdit: this.state.submittedSinceLastEdit,
      useHeaderSubmit: this.props.useHeaderSubmit,
      userHasResponse: this.state.userHasResponse,
    });

    const submitResponseButton = (
      <SurveyQuestionsSubmitFooter
        isSingleQuestionView={isSingleQuestionView}
        isSubmitting={this.state.isSubmitting}
        onPrimarySubmitClick={this.handlePrimarySubmitClick}
        onRevertPendingChanges={this.handleRevertPendingChanges}
        pendingEditCount={_pendingStats.total}
        responseUrl={this.state.responseUrl}
        showSubmitAux={submitFooterDisplayState.showSubmitAux}
        submitButtonText={submitButtonText}
        submitDisabled={submitFooterDisplayState.submitDisabled}
        submittedIndicatorActive={submitFooterDisplayState.submittedIndicatorActive}
        submissionError={this.state.submissionError}
        uploadStatusText={submitFooterDisplayState.uploadStatusText}
      />
    );
    const { jsonForDisplay } = buildSurveyQuestionsJsonForDisplayState({
      isOwnResponse,
      jsonPreview,
      noResponse: this.state.noResponse,
      parsedViewAddressAnswers: this.state.parsedViewAddressAnswers,
      responderAddress: this.props.responderAddress,
      singleQuestionMode: this.props.singleQuestionMode,
      userAnswers: this.state.userAnswers,
      viewAddress: this.props.viewAddress,
      viewingAnswers,
    });

    const hideEmbeddedDebugUi = !!this.props.hideEmbeddedDebugUi;
    const jsonPanelDisplayState = buildSurveyQuestionsJsonPanelDisplayState({
      isSingleQuestionView,
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      showQuestionsJson: this.state.showQuestionsJson,
      showResponseJson: this.state.showResponseJson,
      showSurveyJson: this.state.showSurveyJson,
      styleMap: styles,
    });
    const surveyJson = jsonPanelDisplayState.showSurveyJsonPanel ? this.getSurveyJson() : null;
    const questionsJson = jsonPanelDisplayState.showQuestionsJsonPanel ? this.getQuestionsJson() : null;
    const responseJson = jsonPanelDisplayState.showResponseJsonPanel
      ? (viewingAnswers ? jsonForDisplay : this.getResponseJson())
      : null;
    const submittedStateActive = submitFooterDisplayState.submittedStateActive;
    const canEditQuestions = submitFooterDisplayState.canEditQuestions;
    const hasPendingEdits = submitFooterDisplayState.hasPendingEdits;
    const showInlineSubmit = submitFooterDisplayState.showInlineSubmit;
    const showTopInlineSubmit = submitFooterDisplayState.showTopInlineSubmit;
    const layoutDisplayState = buildSurveyQuestionsLayoutDisplayState({
      activeTagModalTag: this.state.activeTagModalTag,
      isSingleQuestionView,
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      styleMap: styles,
      viewingAnswers,
    });
    const { activeTagModalTag, responseViewClassName, surveyPageClassName, topSectionClassName, useTagModal } = layoutDisplayState;
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
        <SurveyQuestionsTopStrip
          ref={this.topRef}
          className={topSectionClassName}
          isDecrypting={this.state.isDecrypting}
          isEditing={this.state.isEditing}
          isSubmitting={this.state.isSubmitting}
          onDecryptEdit={this.handleDecryptEdit}
          onExitEditing={this.handleExitEditing}
          onStartFresh={this.handleStartFresh}
          onToggleDisplayAnswerMode={this.toggleDisplayAnswerMode}
          responseUrl={this.state.responseUrl}
          showUserResponseNotice={
            this.state.userHasResponse &&
            isOwnResponse &&
            !isSingleQuestionView &&
            this.state.displayAnswerMode
          }
          showViewAnswersButton={showViewAnswersButton}
          submittedStateActive={submittedStateActive}
          userResponseEncrypted={this.state.userResponseEncrypted}
          viewAnswersButtonText={viewAnswersButtonText}
        />

        {viewingAnswers ? (
          <SurveyQuestionsResponseView
            isLoadingResponse={this.state.isLoadingResponse}
            isOwnResponse={isOwnResponse}
            noResponse={this.state.noResponse}
            parsedViewAddressAnswers={this.state.parsedViewAddressAnswers}
            questionPool={this.state.questionPool}
            questionPoolReady={questionPoolReady}
            renderQuestionAnswer={this.renderQuestionAnswer}
            renderSurveyAnswers={this.renderSurveyAnswers}
            responderAddress={this.props.responderAddress}
            responseLookupWarning={this.state.responseLookupWarning}
            responseViewClassName={responseViewClassName}
            shortenedViewAddress={shortenedViewAddress}
            singleQuestionMode={this.props.singleQuestionMode}
            userAnswers={this.state.userAnswers}
            viewAddress={this.props.viewAddress}
            viewedAddressLower={viewedAddressLower}
            viewedAddressRaw={viewedAddressRaw}
          />
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
        {useTagModal && (
          <TagModal
            isOpen={!!activeTagModalTag}
            toggle={this.closeQuestionTagModal}
            activeTag={activeTagModalTag || null}
          />
        )}
      </div>
    );
  }
}

// Preserve direct QuestionsDashboard/SurveySelector consumers without reviving the import cycle.
SurveySelector.SurveyQuestionsComponent = SurveyQuestions;
QuestionsDashboard.SurveyQuestionsComponent = SurveyQuestions;


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

  Object.assign(engine, {
    getRuntimeStrategy,
    isPasskeyWalletAutoSignReady,
    isAutoDecryptBlocked,
    shouldAttemptAutomaticPromptDecrypt,
    _applyDraftTrackingState,
    invalidateResponseHydrationRuns,
    setResponseHydrationState,
    _applyDraftHydrationEntryToSlice,
    _applyResponseHydrationEntryToSlice,
    _applyResponseHydrationListToSlice,
    _applyCachedResponseEntryToSlice,
    _applyLocalCacheHydrationEntryToSlice,
    setManagedTimeout,
    clearManagedTimeouts,
    clearSingleQuestionBootstrapRetry,
    getPendingSingleQuestionBootstrapRetryAttempt,
    updateSingleQuestionDebug,
    scheduleSingleQuestionBootstrapRetry,
    shouldUseAnimationFrameForAutoDecryptSweep,
    clearAutoDecryptSweepScheduling,
    flushQueuedAutoDecryptVisibleSweep,
    queueAutoDecryptVisibleSweep,
    buildAutoDecryptMaskedFieldSignature,
    buildDecryptContextSnapshot,
    buildDecryptContextKey,
    isDecryptContextCurrent,
    canUpdateStateForAsyncSnapshot,
    startSurveyDecryptAttempt,
    canUpdateSurveyDecryptAttempt,
    finishSurveyDecryptAttempt,
    registerQuestionDecryptBusyTokens,
    clearQuestionDecryptBusyTokens,
    ownsQuestionDecryptBusyTokens,
    buildQuestionDecryptOwnedClearState,
    buildQuestionDecryptStaleState,
    buildQuestionDecryptFailureStateForAttempt,
    buildDecryptTaskKey,
    getQuestionFieldTaskKey,
    isQuestionFieldBusy,
    getQuestionFieldDecryptSelection,
    decryptQuestionRatingEnvelopes,
    decryptQuestionRatingEnvelopeMap,
    buildQuestionDecryptExecutionContext,
    buildSurveyDecryptExecutionContext,
    buildViewedResponseDecryptSuccessState,
    buildSelfQuestionDecryptSuccessState,
    buildSurveyDecryptSuccessState,
    syncDecryptedQuestionIntoBaseline,
    mergeLatestEncryptedQuestionFields,
    mergeQuestionResponseOverrideIntoDecryptSlice,
    buildSurveyDecryptSourceState,
    hydrateLatestQuestionDecryptState,
    prepareViewedQuestionDecryptState,
    prepareSelfQuestionDecryptState,
    resolveLatestSurveyDecryptResponse,
    prepareSurveyDecryptAttempt,
    resolveQuestionDecryptHandlingMode,
    prepareQuestionDecryptAttempt,
    finalizeQuestionDecryptAttempt,
    finalizeSurveyDecryptAttempt,
    normalizeBulkDecryptedSliceForSurveyState,
    mergeQuestionRatingEnvelopeState,
    buildQuestionDecryptStartState,
    buildQuestionDecryptFailureState,
    buildViewedResponseDecryptBaseline,
    buildSelfQuestionDecryptBaseline,
    normalizeSingleQuestionViewedResponse,
    runDedupedDecryptTask,
    clearGateSbtHydrationRetry,
    scheduleGateSbtHydrationRetry,
    isResponseJsonPreviewVisible,
    scheduleJsonPreviewUpdate,
    resolveEffectiveResponseGateConfig,
    resolveSessionChainId,
    buildResponseGateConfigSignature,
    invalidateCanDecryptOtherResponsesTracking,
    resetBlockedAutoDecryptSweepInternals,
    resetVisibleAutoDecryptSweepState,
    startCanDecryptOtherResponsesRun,
    isCurrentCanDecryptOtherResponsesRun,
    clearCanDecryptOtherResponsesInFlightIfTracked,
    refreshCanDecryptOtherResponses,
    buildCanDecryptOtherResponsesSignature,
    maybeRefreshCanDecryptOtherResponses,
    emitPendingStats,
    getPendingStatsSnapshot,
    getActiveSurveyIndex,
    didEditDiffInputsChange,
    invalidateDiffCaches,
    runDefaultComponentDidMount,
    runDefaultComponentDidUpdate,
    runDefaultComponentWillUnmount,
    _getDraftScope,
    _getEffectiveDraftSlug,
    getAudioInputWorkerProps,
    buildQuestionDecryptContext,
    buildAutomaticQuestionMetadataFetchOptions,
    hasMaskedCurrentQuestionPayload,
    isMaskedPromptText,
    getQuestionFetchCandidateSlugs,
    cacheQuestionPayloadForSlug,
    applyQuestionPayloadToRenderedPools,
    fetchQuestionPayloadWithDeterministicContext,
    handleReloadMaskedPrompt,
    reloadMaskedQuestionBatch,
    renderPromptWithManualDecrypt,
    renderQuestionTagControl,
    renderQuestionTagDropdown,
    handleQuestionTagSelect,
    closeQuestionTagModal,
    renderQuestionTagDropdownRow,
    getSliderMode,
    setSliderMode,
    getConvictionValueForSlice,
    getImportanceValueForSlice,
    flushDraftPersistAfterSliderChange,
    handleConvictionImportanceChange,
    renderFullQuestionSliderSection,
    renderFullQuestionResponseInput,
    renderFullQuestionAdditionalInput,
    parseEncryptedEnvelope,
    getFieldDecryptState,
    getQuestionFieldDisplayState,
    getQuestionResponseDisplayState,
    getQuestionRenderDisplayState,
    isQuestionPromptMasked,
    getQuestionPayloadDisplayState,
    getAnswerLockDisplayState,
    getGatedPromptNoticeState,
    renderGatedPromptNotice,
    renderFullQuestionGatedPromptCard,
    renderQuestionMaskedPromptCard,
    renderQuestionAnswerLockControl,
    renderQuestionAdditionalLockControl,
    renderFullQuestionFooterIcons,
    renderFullQuestionCardIcons,
    renderQuestionFieldDecryptControl,
    renderFullQuestionCardShell,
    areResponsesConsistent,
    getEditTrackingQuestionIds,
    getIndexedQuestionEntryKeys,
    getChangedQidsAndFields,
    maybeAutoDecryptVisibleFields,
    processAutoDecryptQueue,
    getDraftKey,
    loadDraft,
    migratePersistedDraftForActiveAccount,
    persistDraftSafely,
    persistDraft,
    clearDraft,
    clearDraftFor,
    getCurrentRenderedQuestionIds,
    getHydrationQuestionIds,
    buildLocalCacheHydrationSignature,
    getRenderedQuestionIdsForResponseHydration,
    resolveQuestionSlugMapForIds,
    resolveSubmissionGroupContext,
    getMissingRenderedResponseIdsForAccount,
    ensurePriorResponsesForRenderedIds,
    rehydrateDraftForRenderedIds,
    resetFormStateForAccountChange,
    deepClone,
    valuesEqual,
    computeModifiedQuestionsCount,
    handleRevertPendingChanges,
    buildSliceFromUserAnswers,
    resolveDiffBaselineSlice,
    prefillSurveyResponses,
    buildSliceFromLocalCache,
    rehydrateLocalCacheAnswersForRenderedIds,
    toggleAutoDecrypt,
    getLatestQuestionResponse,
    getLatestSurveyResponse,
    loadBookmarks,
    handleBookmarkToggle,
    getAnsweredQuestionsCount,
    recalculateEditStats,
    initializeSurveyResponseState,
    checkAndHandleStartFresh,
    getSurveyQuestionPoolLoadState,
    showTransientSubmitFeedback,
    maybeBlockSubmitUntilQuestionPoolComplete,
    fetchQuestionPool,
    loadQuestionFromCache,
    mergeSurveyResponseState,
    fetchSurveyResponse,
    prefillSingleQuestionResponse,
    parseAnswerValue,
    handleStartFresh,
    fetchSingleQuestionData,
    resolveDecryptSurveyId,
    handleDecryptEdit,
    handleDecryptViewedResponseField,
    getViewedResponseOverrideForQuestion,
    handleDecryptViewedResponseFieldInternal,
    handleDecryptQuestionAnswer,
    handleDecryptQuestionAnswerInternal,
    handleAnswer,
    handleAdditional,
    handleConviction,
    handleImportance,
    toggleAnswerEncryption,
    toggleAdditionalCommentsEncryption,
    toggleDisplayAnswerMode,
    handleShowJsonAtBottom,
    handleScrollToTop,
    getSurveyResponse,
    getSurveyMetadataForJson,
    prepareJsonAndHash,
    updateJsonPreview,
    jsonTreeDisplay,
    handlePrimarySubmitClick,
    getQuestionsJson,
    getResponseJson,
    getSurveyJson,
    copyJsonToClipboard,
    toggleShowQuestionsJson,
    toggleShowResponseJson,
    toggleShowSurveyJson,
    getCommentsOpen,
    toggleComments,
    getLockAudienceDisplayState,
    applyLockAudienceSelection,
    toggleQuestionFieldEncryptionEnabled,
    handleLockAudienceButtonClick,
    renderAnswerLockControl,
    renderQuestion,
    buildResponseGatePolicyCacheKey,
    getResponseGatePolicy,
    getQuestionLookupMap,
    getQuestionById,
    buildGateAudienceSbtItems,
    getQuestionEncryptionGates,
    normalizeFieldAudienceMode,
    getQuestionGateOptions,
    getResponseGateOptions,
    getResponseGateOptionById,
    resolveFieldEncryptionGateId,
    buildInheritedAdditionalFieldState,
    getEffectiveRecipientsForField,
    resolveGatedPromptGateNames,
    buildRecipientsFromGates,
    isQuestionLockedForResponse,
    getEffectiveRecipientsForQid,
    hasDefaultResponseGateRecipients,
    getDefaultResponseEncryptionAudience,
    getDefaultResponseEncryptionAudienceForQid,
    normalizeResponseEncryptionAudience,
    buildEmptyResponseFieldState,
    resolveFieldEncryptionAudience,
    normalizeGateLabelText,
    resolveSbtGateLabel,
    collectGateSbtAddressesForHydration,
    hydrateGateSbtLabels,
    buildLockedQuestionGateDetails,
    getLockedQuestionGateSourcePool,
    getMemoizedLockedQuestionGateDetails,
    buildSessionQuestionGateDetails,
    getLockedGateRequirementSentence,
    renderLockedQuestionsPanel,
    resolveGateDisplayLabel,
    resolveConfiguredGateLabel,
    resolveLockAudienceSessionName,
    resolveQuestionGateOption,
    getLockAudienceMenuStateKey,
    isLockAudienceMenuOpen,
    toggleLockAudienceGateDetails,
    toggleLockAudienceMenu,
    applyAnswerEncryptionAudience,
    applyAdditionalEncryptionAudience,
    buildLitEncryptionOptionsForRecipients,
    buildFieldEncryptionWorkGroups,
    encryptFieldWorkGroups,
    buildSubmitContextSnapshot,
    buildSubmitContextKey,
    isSubmitContextCurrent,
    startSubmitAttempt,
    finishSubmitAttempt,
    handleStaleSubmitContext,
    encryptAndUpload,
    computePendingEditStatsAtIndex,
    getPendingEditStats,
    handleExitEditing,
    verifyEncryption,
    submitSurveyResponse,
    writeSubmittedResponsesToLocalCaches,
    renderQuestionAnswer,
    renderSurveyAnswers,
    getMemoizedMaskedQuestionVisibility,
    renderDefaultSurveyQuestionsRoute,
  });

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

  const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
  if (typeof runtimeStrategy?.render === 'function') {
    return runtimeStrategy.render(engine);
  }
  return renderDefaultSurveyQuestionsRoute();
};

    const questionContainerClass = styles[`${question.type}QuestionContainer`] || '';

export default SurveyQuestions;
