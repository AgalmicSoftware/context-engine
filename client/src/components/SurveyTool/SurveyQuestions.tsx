/** @file SurveyQuestions.tsx */

import React, { Component } from 'react';
import {
  Dropdown,
  DropdownToggle,
  DropdownMenu,
  FormGroup,
  Label,
  Input,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from 'reactstrap';
import { Link } from 'react-router-dom';
// Styles
import "../../assets/css/contextEngine.scss";
import styles from './SurveyTool.module.scss';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLock, faUnlock, faPlus, faMinus, faCaretDown, faCheck, faSpinner, faFilter, faMicrophone, faChevronLeft, faChevronRight, faComment, faRobot } from '@fortawesome/free-solid-svg-icons';

import QuestionFilter from './QuestionFilter';
import PileHologramAssistant from './PileHologramAssistant';
import SurveyQuestionTagControl from './SurveyQuestionTagControl';
import SingleQuestionResponse from './SingleQuestionResponse';
import FullQuestionFooterIcons from './FullQuestionFooterIcons';
import GatedPromptNotice from './GatedPromptNotice';
import QuestionDecryptControl from './QuestionDecryptControl';
import QuestionCardLinks from './QuestionCardLinks';
import SurveyAudioFieldInput from './SurveyAudioFieldInput';
import SurveyQuestionsFullQuestionResponseInput from './SurveyQuestionsFullQuestionResponseInput';
import SurveyQuestionsFullQuestionCardShell from './SurveyQuestionsFullQuestionCardShell';
import { renderSurveyQuestionsFullQuestionGatedPromptCard } from './SurveyQuestionsFullQuestionGatedPromptCard';
import { renderSurveyQuestionsFullQuestionDisplay } from './SurveyQuestionsFullQuestionDisplay';
import SurveyQuestionsFullQuestionSliderSection from './SurveyQuestionsFullQuestionSliderSection';
import SurveyQuestionsLockAudienceControl from './SurveyQuestionsLockAudienceControl';
import SurveyQuestionsLockedQuestionsPanel from './SurveyQuestionsLockedQuestionsPanel';
import SurveyQuestionsJsonTree from './SurveyQuestionsJsonTree';
import SurveyQuestionsRouteSurface from './SurveyQuestionsRouteSurface';
import SurveyQuestionsSurveyAnswersView from './SurveyQuestionsSurveyAnswersView';
import {
  processRatingEnvelopesForSubmit,
  type RatingEnvelopeDeps,
  type RatingEnvelopeContext,
} from './surveyToolRatingEnvelopeSubmitController';
import {
  writeSubmittedResponsesToLocalCaches as writeSubmittedResponsesToLocalCachesHelper,
} from './surveyToolPostSubmitCacheController';
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
  buildQuestionDecryptOwnedClearState as buildQuestionDecryptOwnedClearStateHelper,
  buildQuestionFieldDisplayState as buildQuestionFieldDisplayStateHelper,
  buildQuestionFieldDecryptControlDisplayState as buildQuestionFieldDecryptControlDisplayStateHelper,
  buildQuestionDecryptBusyTokenRegistration as buildQuestionDecryptBusyTokenRegistrationHelper,
  buildQuestionDecryptStartState as buildQuestionDecryptStartStateHelper,
  buildQuestionResponseDisplayState as buildQuestionResponseDisplayStateHelper,
  buildQuestionRenderDisplayState as buildQuestionRenderDisplayStateHelper,
  buildClearedQuestionDecryptBusyTokens as buildClearedQuestionDecryptBusyTokensHelper,
  buildSurveyDecryptAttemptSourceInputs as buildSurveyDecryptAttemptSourceInputsHelper,
  buildSurveyDecryptExecutionContext as buildSurveyDecryptExecutionContextHelper,
  buildSurveyDecryptSourceState as buildSurveyDecryptSourceStateHelper,
  buildSurveyDecryptSuccessState as buildSurveyDecryptSuccessStateHelper,
  buildSelfQuestionDecryptBaseline as buildSelfQuestionDecryptBaselineHelper,
  buildSelfQuestionDecryptSuccessState as buildSelfQuestionDecryptSuccessStateHelper,
  buildViewedResponseDecryptSuccessState as buildViewedResponseDecryptSuccessStateHelper,
  buildViewedResponseDecryptBaseline as buildViewedResponseDecryptBaselineHelper,
  decryptQuestionRatingEnvelopeMap as decryptQuestionRatingEnvelopeMapHelper,
  decryptQuestionRatingEnvelopes as decryptQuestionRatingEnvelopesHelper,
  finalizeSurveyDecryptAttempt as finalizeSurveyDecryptAttemptHelper,
  finalizeQuestionDecryptAttempt as finalizeQuestionDecryptAttemptHelper,
  getViewedResponseOverrideForQuestion as getViewedResponseOverrideForQuestionHelper,
  getQuestionFieldDecryptSelection as getQuestionFieldDecryptSelectionHelper,
  getQuestionFieldTaskKey as getQuestionFieldTaskKeyHelper,
  hydrateLatestQuestionDecryptState as hydrateLatestQuestionDecryptStateHelper,
  mergeLatestEncryptedQuestionFields as mergeLatestEncryptedQuestionFieldsHelper,
  mergeQuestionRatingEnvelopeState as mergeQuestionRatingEnvelopeStateHelper,
  mergeQuestionResponseOverrideIntoDecryptSlice as mergeQuestionResponseOverrideIntoDecryptSliceHelper,
  normalizeBulkDecryptedSliceForSurveyState as normalizeBulkDecryptedSliceForSurveyStateHelper,
  normalizeSingleQuestionViewedResponse as normalizeSingleQuestionViewedResponseHelper,
  ownsQuestionDecryptBusyTokens as ownsQuestionDecryptBusyTokensHelper,
  parseEncryptedEnvelope as parseEncryptedEnvelopeHelper,
  prepareQuestionDecryptAttempt as prepareQuestionDecryptAttemptHelper,
  prepareSurveyDecryptAttempt as prepareSurveyDecryptAttemptHelper,
  prepareSelfQuestionDecryptState as prepareSelfQuestionDecryptStateHelper,
  prepareViewedQuestionDecryptState as prepareViewedQuestionDecryptStateHelper,
  resolveQuestionDecryptHandlingMode as resolveQuestionDecryptHandlingModeHelper,
  resolveLatestSurveyDecryptResponse as resolveLatestSurveyDecryptResponseHelper,
  resolveDecryptSurveyId as resolveDecryptSurveyIdHelper,
  runDedupedDecryptTask as runDedupedDecryptTaskHelper,
  startQuestionDecryptAttemptStatus as startQuestionDecryptAttemptStatusHelper,
  syncDecryptedQuestionIntoBaseline as syncDecryptedQuestionIntoBaselineHelper,
} from './surveyToolDecryptFlow.js';

// Crypto and contract utilities
import contractScripts, {
  getAllSessionSlugs,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
  getSessionSlugByName
} from '../../utilities/web3/contractScripts.js';
import * as portoFunctions from '../../utilities/web3/portoFunctions.js';
import { ethers, utils } from 'ethers';
import { getShortenedAddress } from 'utilities/ui/displayHelpers.js';
import { cryptoUtils } from '../../utilities/crypto/cryptography.js';
import { ENABLE_IMPORTANCE_SLIDER_TOGGLE } from '../../variables/appConfig.js';
import { E2E_TESTIDS } from '../../utilities/e2eTestIds.js';
import { createLogger } from 'utilities/logging.js';
import { notify } from '../../utilities/ui/notify.js';
import { buildSbtDetailPath } from '../../utilities/sbt/sbtDetailPath.js';
import { t } from '../../utilities/ui/terminology.js';
import { buildResponseGatePolicy } from '../../utilities/crypto/litGatePolicy.js';
import { checkSponsoredAccess } from '../../utilities/web3/sponsoredAccess.js';
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
import {
  buildResponseGateConfigSignature,
} from './surveyToolResponseAccess';
import {
  decideAutoDecryptBlocked,
  decideAutomaticPromptDecryptByKind,
} from './surveyQuestionsDecryptEligibility.js';
import {
  buildDecryptContextKeyFromContext,
  buildResponseGatePolicyCacheKeyFromInputs,
} from './surveyQuestionsCacheKeys.js';
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
import { getLegacyArweaveTxId } from '../../utilities/storage/storageRefs.js';

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
  buildDraftHydrationPatchForQuestion,
  buildDraftHydrationRunPlan,
  buildDraftAwareCacheHydrationState,
  buildHydratedResponseSlice,
  buildInitializedSurveyResponseState,
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
  buildNormalizedRenderedQuestionIds,
  resolveQuestionSlugMapLookup,
  buildMergedSurveyResponseState,
  buildQuestionSlugMapForIds,
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
  buildSingleQuestionPreservedPoolState,
  buildSingleQuestionSourceRestoreContextPlan,
  buildSingleQuestionSeededHydrationState,
  resolveSingleQuestionCacheBootstrap,
  resolveSingleQuestionCacheBootstrapFlowPlan,
  resolveSingleQuestionCacheBootstrapStopHandlingPlan,
} from './surveyToolSingleQuestionCacheBootstrapController';
import {
  buildSingleQuestionEncryptedMetadataPlaceholder,
  fetchSingleQuestionMetadataCandidates,
  normalizeSingleQuestionMetadataForCache,
  resolveSingleQuestionCacheState,
} from './surveyToolSingleQuestionMetadataController';
import {
  resolveSingleQuestionMetadataBootstrap,
} from './surveyToolSingleQuestionMetadataBootstrapController';
import {
  areSurveyResponsesConsistent,
  resolveSurveyBaselineSourceSlice,
  resolveSurveyUserAnswersSlice,
} from './surveyToolResponseSourceController';
import {
  buildAnswerUpdatePlan,
  buildAdditionalUpdatePlan,
} from './surveyToolResponseMutationController';
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
  collectGateSbtAddressesForHydrationFromSources,
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
import {
  buildSurveyQuestionsRouteJsonControlsProps,
} from './surveyQuestionsRouteJsonControlsProps.js';
import {
  buildClearedTransientSubmitFeedbackState,
  buildQuestionPoolPendingSubmitFeedbackMessage,
  buildTransientSubmitFeedbackState,
  normalizeTransientSubmitFeedbackDurationMs,
} from './surveyQuestionSubmitFeedback.js';
import {
  resolveSurveyQuestionsSubmitPendingStats,
  runSurveyQuestionsSubmitController,
  runSurveyQuestionsSubmitFailureController,
  resolveSurveyQuestionsSubmittedResponseUrl,
  runSurveyQuestionsStaleSubmitController,
  runSurveyQuestionsSubmitStartController,
  runSurveyQuestionsSubmitSuccessController,
} from './surveyQuestionsSubmitController.js';
import {
  applySurveyQuestionsRuntimeInitialState,
  createInitialSurveyQuestionsState,
} from './surveyQuestionsState.js';
import {
  buildActiveTagModalState,
  buildAdditionalEncryptionAudienceState,
  buildAdditionalEncryptionToggleResponseState,
  buildAnswerEncryptionAudienceState,
  buildAnswerEncryptionToggleResponseState,
  buildAutoDecryptAttemptedState,
  buildAutoDecryptToggleState,
  buildAutoDecryptDisabledState,
  buildBookmarkedQuestionsState,
  buildBulkPromptReloadingState,
  buildCanDecryptOtherResponsesState,
  buildCommentsToggleState,
  buildClearedSurveyQuestionPoolState,
  buildCopiedQuestionsJsonState,
  buildCopiedResponseJsonState,
  buildCopiedSurveyJsonState,
  buildClearedDecryptingByKeyState,
  buildCurrentStepState,
  buildDecryptEditFailureState,
  buildDecryptEditStartState,
  buildDecryptingByKeyState,
  buildDisplayAnswerModeToggleState,
  buildDisplayAnswerModeState,
  buildEditStatsState,
  buildEditingResponseModeState,
  buildFetchedQuestionPoolState,
  buildGateSbtNameRevisionState,
  buildHasherState,
  buildHydratingPriorResponsesState,
  buildInitialStandaloneResponseState,
  buildInitialSurveyResponseState,
  buildJsonPreviewState,
  buildLockAudienceGateDetailsState,
  buildLockAudienceMenuState,
  buildLockedGateDetailsExpandedState,
  buildParsedViewAddressAnswersState,
  buildPrefillQueuedAfterCacheState,
  buildQuestionsJsonToggleState,
  buildQuestionPoolResponseMergeState,
  buildRenderedQuestionPayloadPoolsState,
  buildResponseHydrationInvalidatedState,
  buildResponseLoadingResetState,
  buildResponseJsonToggleState,
  buildShowJsonState,
  buildSingleQuestionPlaceholderHydrationState,
  buildSingleQuestionPoolFallbackState,
  buildSingleQuestionReadyHydrationState,
  buildSingleQuestionRetryLoadingState,
  buildSubmitPreparationErrorState,
  buildStandaloneAuthResetState,
  buildSubmissionErrorState,
  buildSurveyJsonToggleState,
  buildSurveyResponseFetchLoadingState,
  buildSurveyResponseMergeState,
  buildSurveysResponseStatePatch,
  buildSurveyAccountViewResetState,
  buildSurveyChangedResetState,
  buildSurveyQuestionsAuthoringRouteReadinessDescriptor,
  buildSurveyQuestionsAuthoringPanelDisplayState,
  buildSurveyQuestionsFullLoadingProgressState,
  buildSurveyQuestionsJsonForDisplayState,
  buildSurveyQuestionsJsonPanelDisplayState,
  buildSurveyQuestionsJsonPreviewDisplayState,
  buildSurveyQuestionsLayoutDisplayState,
  buildSurveyQuestionsMaskedQuestionVisibility,
  buildSurveyQuestionsPrimarySubmitPlan,
  buildSurveyQuestionsRenderReadinessDescriptor,
  buildSurveyQuestionsRouteViewDisplayState,
  buildSurveyQuestionsSubmitFooterDisplayState,
  buildSurveyQuestionsSubmitReadinessDescriptor,
  buildSurveyQuestionPoolLoadState,
  buildSurveyUserEditResponseStatePatch,
  buildVisiblePileQuestionsAfterPromptDecryptState,
  buildViewingResponseModeState,
  buildViewedSurveyNoResponseState,
  buildViewedSurveyResponseState,
  buildUserSurveyResponseFoundState,
  buildUserSurveyResponseMissingState,
  isSurveyQuestionsMaskedPromptText,
  type SurveyQuestionsProps,
  type SurveyQuestionsState,
} from './surveyQuestionsTypes.js';

declare global {
  interface Window {
    __CE_SINGLE_Q_DEBUG__?: Array<Record<string, unknown>>;
  }
}

export interface SurveyQuestions {
  setState: (...args: any[]) => any;
  _emptySubmitTimer: any;
}

export class SurveyQuestions extends Component<SurveyQuestionsProps, SurveyQuestionsState> {
  [key: string]: any;

  constructor(props: SurveyQuestionsProps) {
    super(props);
    this.state = createInitialSurveyQuestionsState(this.props);
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
    this.state = applySurveyQuestionsRuntimeInitialState(this.state, this);
  }

  getRuntimeStrategy = () => (
    this.props.runtimeStrategy && typeof this.props.runtimeStrategy === 'object'
      ? this.props.runtimeStrategy
      : null
  );

  isPortoAutoSignReady = () => {
    try {
      return !!(
        typeof portoFunctions.isPortoAutoSignReady === 'function' &&
        portoFunctions.isPortoAutoSignReady()
      );
    } catch (_: any) {
      return false;
    }
  };

  // Auto-decrypt sweep control: blocks automatic decryption for providers that would
  // show a wallet/passkey prompt. Porto is allowed only after session-key mode has an
  // in-memory signer, so decrypt/sign calls can run silently on the current page.
  isAutoDecryptBlocked = () => {
    try {
      const kind: any = (cryptoUtils as any).getProviderKind(this.props.provider);
      return decideAutoDecryptBlocked(kind, () => this.isPortoAutoSignReady());
    } catch (_: any) {
      return false;
    }
  };

  shouldAttemptAutomaticPromptDecrypt = () => {
    if (!this.props.loginComplete || !this.props.account || !this.props.provider) return false;
    try {
      const kind: any = (cryptoUtils as any).getProviderKind(this.props.provider);
      return decideAutomaticPromptDecryptByKind(kind, () => this.isPortoAutoSignReady());
    } catch (_: any) {
      return false;
    }
  };


  _persistTimer: any = null;
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
  _autoDecryptVisibleSweepCache: any = null;
  _userAnswersSliceCache = { source: null, value: null };
  _jsonPreviewTimer: any = null;
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
  _singleQuestionBootstrapRetryTimer: any = null;
  _singleQuestionBootstrapRetrySig = '';
  _isMounted = false;
  _hasMounted = false;
  _autoDecProcessTimer = null;
  _autoDecryptSweepMicrotaskScheduled = false;
  _autoDecryptSweepFrameRequestId: any = null;
  _queuedAutoDecryptSweepReasons = new Set();
  _gateSbtHydrationSig = '';
  _gateSbtHydrationRetryTimer = null;

  _applyDraftTrackingState = (tracking: any = {}) => {
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

  invalidateResponseHydrationRuns = () => {
    this._fetchSurveyResponseRunId = (Number(this._fetchSurveyResponseRunId) || 0) + 1;
    this._fetchSingleQuestionRunId = (Number(this._fetchSingleQuestionRunId) || 0) + 1;
    this._localCacheRehydrateRunId = (Number(this._localCacheRehydrateRunId) || 0) + 1;
    if (this._isMounted && this.state.isLoadingResponse) {
      this.setState(buildResponseHydrationInvalidatedState());
    }
  };

  setResponseHydrationState = (next: any, callback: any) => {
    this._responseHydrationStateUpdateDepth += 1;
    const release: any = () => {
      this._responseHydrationStateUpdateDepth = Math.max(
        0,
        (Number(this._responseHydrationStateUpdateDepth) || 0) - 1,
      );
    };

    try {
      return this.setState(next, (...args: any[]) => {
        try {
          return typeof callback === 'function' ? callback(...args) : undefined;
        } finally {
          release();
        }
      });
    } catch (error: any) {
      release();
      throw error;
    }
  };

  _applyDraftHydrationEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    draftEntry = null,
    allowOverwrite = false,
  }: any = {}) => {
    if (!targetSlice || !draftEntry) return false;
    const patch: any = buildDraftHydrationPatchForQuestion({
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

  _applyResponseHydrationEntryToSlice = ({
    targetSlice = null,
    currentSlice = null,
    questionId = '',
    response = null,
    allowOverwrite = false,
    parseValue = this.parseAnswerValue,
  }: any = {}) => {
    if (!targetSlice || !response) return false;
    const sourceSlice: any = currentSlice || targetSlice;
    const patch: any = buildQuestionResponseHydrationPatch({
      questionId,
      response,
      currentAnswer: sourceSlice?.answers?.[questionId],
      currentAdditional: sourceSlice?.additionalComments?.[questionId],
      hasCurrentImportance: Object.prototype.hasOwnProperty.call(sourceSlice?.importance || {}, questionId),
      hasCurrentConviction: Object.prototype.hasOwnProperty.call(sourceSlice?.conviction || {}, questionId),
      allowOverwrite,
      deps: {
        parseValue,
        areEnvelopesEquivalent: areEnvelopesEquivalent as any,
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

  _applyResponseHydrationListToSlice = ({
    targetSlice = null,
    currentSlice = null,
    responses = [],
    allowOverwrite = false,
    parseValue = this.parseAnswerValue,
    questionIdResolver = (response: any) => normalizeQuestionIdKey(response?.questionID || response?.questionId),
  }: any = {}) => {
    if (!targetSlice) return false;
    const list: any = Array.isArray(responses) ? responses : [responses];
    let changed: any = false;
    list.forEach((response: any) => {
      const qid: any = questionIdResolver(response);
      if (!qid) return;
      if (this._applyResponseHydrationEntryToSlice({
        targetSlice,
        currentSlice,
        questionId: qid,
        response,
        allowOverwrite,
        parseValue,
      })) {
        changed = true;
      }
    });
    return changed;
  };

  _applyCachedResponseEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    response = null,
    parseValue = this.parseAnswerValue,
  }: any = {}) => {
    if (!targetSlice || !response) return false;
    const patch: any = buildQuestionCacheHydrationPatch({
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

  _applyLocalCacheHydrationEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    cachedAnswer = null,
    cachedAdditional = null,
    cachedImportance = undefined,
    cachedConviction = undefined,
    allowMaskedAnswerDraftEmpty = false,
    allowMaskedAdditionalDraftEmpty = false,
    debugLabel = '',
  }: any = {}) => {
    if (!targetSlice || !questionId) return false;
    let changed: any = false;

    if (
      cachedAnswer &&
      (
        allowMaskedAnswerDraftEmpty ||
        targetSlice.answers?.[questionId]?.value === undefined ||
        (
          targetSlice.answers?.[questionId]?.value === '' &&
          !targetSlice.answers?.[questionId]?.encryptedPortion
        )
      )
    ) {
      targetSlice.answers[questionId] = {
        ...(targetSlice.answers[questionId] || {}),
        ...cachedAnswer,
      };
      changed = true;
      if (debugLabel) {
        DEBUG_PREFILL && surveyLog.log(`${debugLabel} Hydrated answer for qid=${questionId}`, {
          fromCache: cachedAnswer,
        });
      }
    }

    if (
      cachedAdditional &&
      (
        allowMaskedAdditionalDraftEmpty ||
        targetSlice.additionalComments?.[questionId]?.value === undefined ||
        (
          targetSlice.additionalComments?.[questionId]?.value === '' &&
          !targetSlice.additionalComments?.[questionId]?.encryptedPortion
        )
      )
    ) {
      targetSlice.additionalComments[questionId] = {
        ...(targetSlice.additionalComments[questionId] || {}),
        ...cachedAdditional,
      };
      changed = true;
      if (debugLabel) {
        DEBUG_PREFILL && surveyLog.log(`${debugLabel} Hydrated additional for qid=${questionId}`, {
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
        DEBUG_PREFILL && surveyLog.log(`${debugLabel} Hydrated importance for qid=${questionId}`, {
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
        DEBUG_PREFILL && surveyLog.log(`${debugLabel} Hydrated conviction for qid=${questionId}`, {
          fromCache: cachedConviction,
        });
      }
    }

    return changed;
  };

  setManagedTimeout = (fn: any, delayMs: any = 0) => {
    const timeoutId: any = setTimeout(() => {
      this._transientTimeouts.delete(timeoutId);
      if (!this._isMounted) return;
      try { fn(); } catch (e: any) { surveyLog.warn('SurveyTool: callback', e); }
    }, Math.max(0, Number(delayMs) || 0));
    this._transientTimeouts.add(timeoutId);
    return timeoutId;
  };

  clearManagedTimeouts = () => {
    if (!this._transientTimeouts || this._transientTimeouts.size === 0) return;
    this._transientTimeouts.forEach((timeoutId: any) => {
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

  getPendingSingleQuestionBootstrapRetryAttempt = (questionId: any = '') => {
    const qid: any = String(questionId || this.props.questionID || '').trim().toLowerCase();
    if (!qid) return 0;
    const currentRetrySig: any = String(this._singleQuestionBootstrapRetrySig || '').trim().toLowerCase();
    if (!currentRetrySig) return 0;
    const [currentQid = '', currentAttemptToken = '0']: any = currentRetrySig.split(':');
    if (currentQid !== qid) return 0;
    const currentAttempt: any = Number(currentAttemptToken || 0);
    return Number.isFinite(currentAttempt) && currentAttempt > 0 ? currentAttempt : 0;
  };

  updateSingleQuestionDebug = (patch: any = {}) => {
    if (typeof window === 'undefined') return;
    try {
      const prev: any =
        (window.__CE_SINGLE_Q_DEBUG__ && typeof window.__CE_SINGLE_Q_DEBUG__ === 'object')
          ? window.__CE_SINGLE_Q_DEBUG__
          : {};
      window.__CE_SINGLE_Q_DEBUG__ = {
        ...prev,
        ...patch,
        updatedAt: Date.now(),
      };
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };

  scheduleSingleQuestionBootstrapRetry = ({ questionId = '', attempt = 0, reason = '' }: any = {}) => {
    const qid: any = String(questionId || this.props.questionID || '').trim().toLowerCase();
    if (!qid || !this._isMounted) return false;

    const maxAttempts: any = 6;
    const nextAttempt: any = Math.max(1, Number(attempt || 0) + 1);
    if (nextAttempt > maxAttempts) return false;

    const currentRetrySig: any = String(this._singleQuestionBootstrapRetrySig || '').trim().toLowerCase();
    if (currentRetrySig) {
      const [currentQid = '', currentAttemptToken = '0']: any = currentRetrySig.split(':');
      const currentAttempt: any = Number(currentAttemptToken || 0);
      if (currentQid === qid && Number.isFinite(currentAttempt) && currentAttempt >= nextAttempt) {
        return true;
      }
    }

    const retrySig: any = `${qid}:${nextAttempt}`;
    if (this._singleQuestionBootstrapRetrySig === retrySig) return true;

    this.clearSingleQuestionBootstrapRetry();
    this._singleQuestionBootstrapRetrySig = retrySig;
    const delayMs: any = Math.min(25000, 4000 * nextAttempt);

    this._singleQuestionBootstrapRetryTimer = setTimeout(() => {
      this._singleQuestionBootstrapRetryTimer = null;
      this._singleQuestionBootstrapRetrySig = '';
      if (!this._isMounted) return;
      this.fetchSingleQuestionData({
        forceQuestionMetadataRefetch: true,
        bootstrapRetryAttempt: nextAttempt,
      }).catch((error: any) => {
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
    const ua: any = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/jsdom/i.test(ua)) return false;
    return true;
  };

  clearAutoDecryptSweepScheduling = () => {
    this._autoDecryptSweepMicrotaskScheduled = false;
    this._queuedAutoDecryptSweepReasons.clear();
    if (this._autoDecryptSweepFrameRequestId != null && typeof window !== 'undefined') {
      try { window.cancelAnimationFrame(this._autoDecryptSweepFrameRequestId); } catch (e: any) { surveyLog.warn('SurveyTool: cleanup', e); }
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

  queueAutoDecryptVisibleSweep = (reason: any = 'unknown') => {
    if (!this._isMounted) return;
    if (reason) this._queuedAutoDecryptSweepReasons.add(String(reason));
    if (this._autoDecryptSweepMicrotaskScheduled) return;
    this._autoDecryptSweepMicrotaskScheduled = true;
    scheduleMicrotask(() => {
      this._autoDecryptSweepMicrotaskScheduled = false;
      if (!this._isMounted) return;
      if (this._autoDecryptSweepFrameRequestId != null) return;
      const flush: any = () => this.flushQueuedAutoDecryptVisibleSweep();
      if (this.shouldUseAnimationFrameForAutoDecryptSweep()) {
        this._autoDecryptSweepFrameRequestId = window.requestAnimationFrame(flush);
        return;
      }
      flush();
    });
  };

  buildAutoDecryptMaskedFieldSignature = (field: any = null) =>
    (buildAutoDecryptMaskedFieldSignatureHelper as any)(field);

  buildDecryptContextSnapshot = () => {
    const draftSlug: any = this._getEffectiveDraftSlug
      ? this._getEffectiveDraftSlug()
      : resolveEffectiveSlug(this.props);
    const hydrationContext: any = resolveDecryptHydrationContext(this.props, draftSlug);
    const singleQuestionMode: any = !!this.props.singleQuestionMode;
    const isStandalone: any = !!this.props.isStandalone;
    return {
      account: String(this.props?.account || '').trim().toLowerCase(),
      providerKind: String((cryptoUtils as any).getProviderKind(this.props?.provider) || '').trim().toLowerCase(),
      sessionSlug: normalizeSessionSlugValue(hydrationContext.sessionSlug || draftSlug || ''),
      networkID: String(
        hydrationContext.networkIdStr ||
        this.props?.networkID ||
        this.props?.network?.id ||
        this.props?.network?.chainId ||
        ''
      ).trim(),
      responder: String(
        this.props?.responderAddress ||
        this.props?.viewAddress ||
        ''
      ).trim().toLowerCase(),
      provider: this.props?.provider,
      loginComplete: !!this.props?.loginComplete,
      singleQuestionMode,
      isStandalone,
      surveyIndex: singleQuestionMode || isStandalone ? 0 : (this.props?.surveyIndex || 0),
      surveyId: this.props?.surveyId || this.props?.surveyID || '',
      questionID: this.props?.questionID || '',
      mounted: !!this._isMounted,
    };
  };

  buildDecryptContextKey = (snapshot: any = null) =>
    buildDecryptContextKeyFromContext(snapshot || this.buildDecryptContextSnapshot());

  isDecryptContextCurrent = (snapshot: any = null) => (
    !!snapshot &&
    (!snapshot.mounted || this._isMounted) &&
    this.buildDecryptContextKey(snapshot) === this.buildDecryptContextKey()
  );

  canUpdateStateForAsyncSnapshot = (snapshot: any = null) => (
    !!snapshot &&
    (!snapshot.mounted || this._isMounted)
  );

  startSurveyDecryptAttempt = () => {
    const attemptId: any = (Number(this._surveyDecryptAttemptSeq) || 0) + 1;
    this._surveyDecryptAttemptSeq = attemptId;
    this._activeSurveyDecryptAttemptSeq = attemptId;
    return attemptId;
  };

  canUpdateSurveyDecryptAttempt = (snapshot: any = null, attemptId: any = null) => (
    this.canUpdateStateForAsyncSnapshot(snapshot) &&
    Number(attemptId || 0) > 0 &&
    this._activeSurveyDecryptAttemptSeq === attemptId
  );

  finishSurveyDecryptAttempt = (attemptId: any = null) => {
    if (Number(attemptId || 0) > 0 && this._activeSurveyDecryptAttemptSeq === attemptId) {
      this._activeSurveyDecryptAttemptSeq = 0;
    }
  };

  registerQuestionDecryptBusyTokens = (keysToMark: any = []) => {
    const result: any = (buildQuestionDecryptBusyTokenRegistrationHelper as any)({
      tokenSeq: this._questionDecryptBusyTokenSeq,
      busyTokens: this._questionDecryptBusyTokens,
      keysToMark,
    });
    this._questionDecryptBusyTokenSeq = result.token;
    this._questionDecryptBusyTokens = result.busyTokens;
    return result.token;
  };

  clearQuestionDecryptBusyTokens = (keysToClear: any = [], token: any = null) => {
    this._questionDecryptBusyTokens = (buildClearedQuestionDecryptBusyTokensHelper as any)({
      busyTokens: this._questionDecryptBusyTokens,
      keysToClear,
      token,
    });
  };

  ownsQuestionDecryptBusyTokens = (keysToCheck: any = [], token: any = null) =>
    (ownsQuestionDecryptBusyTokensHelper as any)({
      busyTokens: this._questionDecryptBusyTokens,
      keysToCheck,
      token,
    });

  buildQuestionDecryptOwnedClearState = (
    prev: any,
    questionId: any,
    fieldToDecrypt: any = 'both',
    token: any = null,
    extraPatch: any = {},
  ) => {
    const result: any = (buildQuestionDecryptOwnedClearStateHelper as any)({
      prevState: prev,
      questionId,
      fieldToDecrypt,
      token,
      busyTokens: this._questionDecryptBusyTokens,
      activeSurveyDecryptAttemptSeq: this._activeSurveyDecryptAttemptSeq,
      extraPatch,
    });
    this._questionDecryptBusyTokens = result.busyTokens;
    return result.statePatch;
  };

  buildQuestionDecryptStaleState = (prev: any, questionId: any, fieldToDecrypt: any = 'both', token: any = null) => {
    // Regression guard: stale decrypt cleanup may only clear busy flags it owns.
    // A newer decrypt for the same field can start after this attempt's await.
    return this.buildQuestionDecryptOwnedClearState(prev, questionId, fieldToDecrypt, token);
  };

  buildQuestionDecryptFailureStateForAttempt = (prev: any, questionId: any, fieldToDecrypt: any = 'both', errorMessage: any = '', token: any = null) => {
    const patch: any = this.buildQuestionDecryptOwnedClearState(prev, questionId, fieldToDecrypt, token, {
      submissionError: errorMessage || 'Decryption failed.',
    });
    if (patch) return patch;
    return null;
  };

  buildDecryptTaskKey = (mode: any, questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null, decryptContext: any = null) => {
    const baseKey: any = (buildDecryptTaskKeyHelper as any)(
      mode,
      questionId,
      fieldToDecrypt,
      responseOverride,
      String(
      this.props?.responderAddress ||
      this.props?.viewAddress ||
      ''
      ),
    );
    return `${baseKey}|${this.buildDecryptContextKey(decryptContext || this.buildDecryptContextSnapshot())}`;
  };

  getQuestionFieldTaskKey = (questionId: any, fieldKey: any = 'answer') => {
    return (getQuestionFieldTaskKeyHelper as any)(questionId, fieldKey);
  };

  isQuestionFieldBusy = (questionId: any, fieldKey: any = 'answer') => {
    const taskKey: any = this.getQuestionFieldTaskKey(questionId, fieldKey);
    if (!taskKey) return false;
    return !!(this.state.decryptingByKey && this.state.decryptingByKey[taskKey]);
  };

  getQuestionFieldDecryptSelection = (
    questionId: any,
    fieldToDecrypt: any = 'both',
    responseSlice: any = null,
  ) => (getQuestionFieldDecryptSelectionHelper as any)(questionId, fieldToDecrypt, responseSlice);

  decryptQuestionRatingEnvelopes = async (
    ratingEnvelopes: any = null,
    { chainId, lit, account, providerLike }: any = {},
  ) => (decryptQuestionRatingEnvelopesHelper as any)(
    ratingEnvelopes,
    { chainId, lit, account, providerLike },
    {
      decryptEnvelopeValue: (cryptoUtils as any).decryptEnvelopeValue,
      logWarn: (error: any) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  decryptQuestionRatingEnvelopeMap = async (
    ratingEnvelopesByQid: any = {},
    { chainId, lit, account, providerLike }: any = {},
  ) => (decryptQuestionRatingEnvelopeMapHelper as any)(
    ratingEnvelopesByQid,
    { chainId, lit, account, providerLike },
    {
      decryptEnvelopeValue: (cryptoUtils as any).decryptEnvelopeValue,
      logWarn: (error: any) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  buildQuestionDecryptExecutionContext = (baselineForDecrypt: any, questionId: any) => {
    const litHooks: any =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return (buildQuestionDecryptExecutionContextHelper as any)({
      baselineForDecrypt,
      questionId,
      provider: this.props.provider,
      account: this.props.account,
      network: this.props.network,
      questionPool: this.state.questionPool,
      pileQuestions: this.state.pileQuestions,
      litHooks,
      hasher: this.state.hasher,
      resolveDecryptSurveyId: this.resolveDecryptSurveyId,
      getProviderKind: (cryptoUtils as any).getProviderKind,
    });
  };

  buildSurveyDecryptExecutionContext = (sourceSlice: any, questionId: any = null) => {
    const litHooks: any =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return (buildSurveyDecryptExecutionContextHelper as any)({
      sourceSlice,
      questionId,
      provider: this.props.provider,
      account: this.props.account,
      network: this.props.network,
      questionPool: this.state.questionPool,
      pileQuestions: this.state.pileQuestions,
      litHooks,
      hasher: this.state.hasher,
      resolveDecryptSurveyId: this.resolveDecryptSurveyId,
      getProviderKind: (cryptoUtils as any).getProviderKind,
    });
  };

  buildViewedResponseDecryptSuccessState = (
    prevState: any,
    options: any = {},
  ) => (buildViewedResponseDecryptSuccessStateHelper as any)(prevState, options);

  buildSelfQuestionDecryptSuccessState = (
    prevState: any,
    options: any = {},
  ) => (buildSelfQuestionDecryptSuccessStateHelper as any)(prevState, options, this.deepClone);

  buildSurveyDecryptSuccessState = (
    prevState: any,
    options: any = {},
  ) => (buildSurveyDecryptSuccessStateHelper as any)(prevState, options, this.deepClone);

  syncDecryptedQuestionIntoBaseline = (
    editBaseline: any,
    fallbackBaseline: any,
    nextTargetStateSlice: any,
    options: any = {},
  ) => (syncDecryptedQuestionIntoBaselineHelper as any)(
    editBaseline,
    fallbackBaseline,
    nextTargetStateSlice,
    options,
    this.deepClone,
  );

  mergeLatestEncryptedQuestionFields = (
    responseSlice: any,
    questionId: any,
    latestResponse: any,
    options: any = {},
  ) => (mergeLatestEncryptedQuestionFieldsHelper as any)(responseSlice, questionId, latestResponse, options);

  mergeQuestionResponseOverrideIntoDecryptSlice = (
    responseSlice: any,
    questionId: any,
    responseOverride: any,
  ) => (mergeQuestionResponseOverrideIntoDecryptSliceHelper as any)(responseSlice, questionId, responseOverride);

  buildSurveyDecryptSourceState = (
    latestResponse: any = null,
    fallbackSourceSlice: any = null,
    previousStateSlice: any = null,
  ) => (buildSurveyDecryptSourceStateHelper as any)(
    latestResponse,
    fallbackSourceSlice,
    previousStateSlice,
    this.buildSliceFromUserAnswers,
  );

  hydrateLatestQuestionDecryptState = async (
    options: any = {},
  ) => (hydrateLatestQuestionDecryptStateHelper as any)(
    options,
    {
      getQuestionFieldDecryptSelection: this.getQuestionFieldDecryptSelection,
      readQuestionsCache,
      getLatestQuestionResponse: this.getLatestQuestionResponse,
      mergeLatestEncryptedQuestionFields: this.mergeLatestEncryptedQuestionFields,
      mergeQuestionRatingEnvelopeState: this.mergeQuestionRatingEnvelopeState,
      logWarn: (error: any) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  prepareViewedQuestionDecryptState = async (
    options: any = {},
  ) => (prepareViewedQuestionDecryptStateHelper as any)(
    options,
    {
      buildViewedResponseDecryptBaseline: this.buildViewedResponseDecryptBaseline,
      hydrateLatestQuestionDecryptState: this.hydrateLatestQuestionDecryptState,
    },
  );

  prepareSelfQuestionDecryptState = async (
    options: any = {},
  ) => (prepareSelfQuestionDecryptStateHelper as any)(
    options,
    {
      buildSelfQuestionDecryptBaseline: this.buildSelfQuestionDecryptBaseline,
      mergeQuestionResponseOverrideIntoDecryptSlice: this.mergeQuestionResponseOverrideIntoDecryptSlice,
      mergeQuestionRatingEnvelopeState: this.mergeQuestionRatingEnvelopeState,
      hydrateLatestQuestionDecryptState: this.hydrateLatestQuestionDecryptState,
      logWarn: (error: any) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  resolveLatestSurveyDecryptResponse = async (
    options: any = {},
  ) => (resolveLatestSurveyDecryptResponseHelper as any)(
    options,
    {
      getLatestQuestionResponse: (contractScripts as any).getResponse,
      getLatestSurveyResponse: this.getSurveyResponse,
    },
  );

  prepareSurveyDecryptAttempt = async (
    options: any = {},
  ) => (prepareSurveyDecryptAttemptHelper as any)(
    options,
    {
      resolveLatestSurveyDecryptResponse: this.resolveLatestSurveyDecryptResponse,
      buildSurveyDecryptSourceState: this.buildSurveyDecryptSourceState,
      buildSurveyDecryptExecutionContext: this.buildSurveyDecryptExecutionContext,
    },
  );

  resolveQuestionDecryptHandlingMode = (
    options: any = {},
  ) => (resolveQuestionDecryptHandlingModeHelper as any)(
    options,
    {
      getViewedResponseOverrideForQuestion: this.getViewedResponseOverrideForQuestion,
    },
  );

  prepareQuestionDecryptAttempt = (
    options: any = {},
  ) => (prepareQuestionDecryptAttemptHelper as any)(
    options,
    {
      getQuestionFieldDecryptSelection: this.getQuestionFieldDecryptSelection,
      buildQuestionDecryptExecutionContext: this.buildQuestionDecryptExecutionContext,
    },
  );

  finalizeQuestionDecryptAttempt = async (
    options: any = {},
  ) => (finalizeQuestionDecryptAttemptHelper as any)(
    options,
    {
      decryptSingleField: (cryptoUtils as any).decryptSingleField,
      decryptQuestionRatingEnvelopes: this.decryptQuestionRatingEnvelopes,
    },
  );

  finalizeSurveyDecryptAttempt = async (
    options: any = {},
  ) => (finalizeSurveyDecryptAttemptHelper as any)(
    options,
    {
      decryptMultipleAnswers: (cryptoUtils as any).decryptMultipleAnswers,
      decryptQuestionRatingEnvelopeMap: this.decryptQuestionRatingEnvelopeMap,
      normalizeBulkDecryptedSliceForSurveyState: this.normalizeBulkDecryptedSliceForSurveyState,
    },
  );

  normalizeBulkDecryptedSliceForSurveyState = (
    decryptedSlice: any,
    options: any = {},
  ) => (normalizeBulkDecryptedSliceForSurveyStateHelper as any)(decryptedSlice, options);

  mergeQuestionRatingEnvelopeState = (previousState: any, nextSource: any, questionId: any = null) =>
    (mergeQuestionRatingEnvelopeStateHelper as any)(previousState, nextSource, questionId);

  buildQuestionDecryptStartState = (prevState: any, keysToMark: any = []) =>
    (buildQuestionDecryptStartStateHelper as any)(prevState, keysToMark);

  buildQuestionDecryptFailureState = (
    prevState: any,
    questionId: any,
    fieldToDecrypt: any = 'both',
    errorMessage: any = '',
  ) => (buildQuestionDecryptFailureStateHelper as any)(
    prevState,
    questionId,
    fieldToDecrypt,
    errorMessage,
  );

  buildViewedResponseDecryptBaseline = (responseOverride: any, questionId: any) =>
    (buildViewedResponseDecryptBaselineHelper as any)(
      responseOverride,
      questionId,
      this.buildSliceFromUserAnswers,
    );

  buildSelfQuestionDecryptBaseline = (surveyIndex: any) =>
    (buildSelfQuestionDecryptBaselineHelper as any)(
      surveyIndex,
      this.state.surveysResponseState,
      this.state.userAnswers,
      this.buildSliceFromUserAnswers,
      this.deepClone,
    );

  normalizeSingleQuestionViewedResponse = (rawResponse: any = null) =>
    (normalizeSingleQuestionViewedResponseHelper as any)(rawResponse);

  runDedupedDecryptTask = (taskKey: any, runner: any) =>
    (runDedupedDecryptTaskHelper as any)(this._decryptFieldTaskInFlight, taskKey, runner);

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

  isResponseJsonPreviewVisible = (stateIn: any = this.state) => (
    !!(stateIn && stateIn.showResponseJson)
  );

  scheduleJsonPreviewUpdate = (delayMs: any = 120, force: any = false) => {
    if (!force && !this.isResponseJsonPreviewVisible()) return;
    if (this._jsonPreviewTimer) clearTimeout(this._jsonPreviewTimer);
    this._jsonPreviewTimer = setTimeout(() => {
      this._jsonPreviewTimer = null;
      this.updateJsonPreview(force);
    }, Math.max(0, Number(delayMs) || 0));
  };

  resolveEffectiveResponseGateConfig = (slugIn: any = '', propsSnapshot: any = this.props) => {
    const slug: any = String(slugIn || '').trim().toLowerCase();
    const resolved: any = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: slug,
      sessionConfig: (propsSnapshot?.sessionConfig && typeof propsSnapshot.sessionConfig === 'object')
        ? propsSnapshot.sessionConfig
        : null,
      resolveBySlug: getStrictSessionConfigBySlug,
    });
    return resolved.effectiveSessionConfig || {};
  };

  resolveSessionChainId = (slugIn: any = '', cfgIn: any = null, propsSnapshot: any = this.props) => {
    const slug: any = String(
      slugIn || (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : resolveEffectiveSlug(propsSnapshot)) || ''
    ).trim().toLowerCase();
    const cfg: any =
      cfgIn && typeof cfgIn === 'object'
        ? cfgIn
        : this.resolveEffectiveResponseGateConfig(slug, propsSnapshot);
    return Number(
      cfg?.networkChainId ||
      cfg?.contracts?.surveys?.chainId ||
      cfg?.contracts?.sbtFactory?.chainId ||
      cfg?.__registry?.chainId ||
      cfg?.__registry?.registryChainId ||
      propsSnapshot?.networkChainId ||
      propsSnapshot?.network?.id ||
      propsSnapshot?.network?.chainId ||
      0
    ) || null;
  };

  buildResponseGateConfigSignature = (cfg: any = {}) => {
    return buildResponseGateConfigSignature(cfg);
  };

  invalidateCanDecryptOtherResponsesTracking = () => {
    this._canDecryptOtherResponsesRunId += 1;
    this._canDecryptOtherResponsesKey = '';
    this._canDecryptOtherResponsesInFlight = null;
  };

  resetBlockedAutoDecryptSweepInternals = () => {
    this._autoDecQueue = [];
    this._autoDecProcessing = false;
    this._autoDecryptMaskedAttemptSignature = {};
    this.clearAutoDecryptSweepScheduling();
  };

  resetVisibleAutoDecryptSweepState = () => {
    this._autoDecryptVisibleSweepCache = null;
    this.resetBlockedAutoDecryptSweepInternals();
  };

  startCanDecryptOtherResponsesRun = (snapshotKey: any = '') => {
    this._canDecryptOtherResponsesKey = String(snapshotKey || '');
    const runId: any = (Number(this._canDecryptOtherResponsesRunId) || 0) + 1;
    this._canDecryptOtherResponsesRunId = runId;
    return runId;
  };

  isCurrentCanDecryptOtherResponsesRun = (runId: any, snapshotKey: any = '') => (
    this._canDecryptOtherResponsesRunId === runId &&
    this._canDecryptOtherResponsesKey === String(snapshotKey || '')
  );

  clearCanDecryptOtherResponsesInFlightIfTracked = (tracked: any = null) => {
    if (this._canDecryptOtherResponsesInFlight === tracked) {
      this._canDecryptOtherResponsesInFlight = null;
    }
  };

  refreshCanDecryptOtherResponses = async () => {
    try {
      const ctx: any = buildCanDecryptContext({
        getEffectiveDraftSlug: () => this._getEffectiveDraftSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(this.props),
        resolveEffectiveResponseGateConfig: (slug: any) => this.resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => this.getResponseGatePolicy(),
        account: this.props?.account || '',
        loginComplete: this.props?.loginComplete,
        singleQuestionMode: this.props.singleQuestionMode as any,
        isStandalone: this.props.isStandalone as any,
        sbtCacheRevision: this.props?.sbtCacheRevision || 0,
      });
      const { cfg, slug, snapshot }: any = ctx;
      const preCheck: any = evaluateCanDecryptPreCheck(snapshot);

      if (preCheck.earlyExit) {
        // Invalidate any in-flight checks so they can't race and re-enable decrypt UI.
        this.invalidateCanDecryptOtherResponsesTracking();
        if (this.state.canDecryptOtherResponses || this.state.canDecryptOtherResponsesStatus !== preCheck.status) {
          this.setState(buildCanDecryptOtherResponsesState({ status: preCheck.status }));
        }
        return false;
      }

      const snapshotKey: any = String(snapshot.key || '');
      if (snapshotKey === this._canDecryptOtherResponsesKey && this._canDecryptOtherResponsesInFlight) {
        return await this._canDecryptOtherResponsesInFlight;
      }
      const runId: any = this.startCanDecryptOtherResponsesRun(snapshotKey);

      const run: any = (async () => {
        if (this.state.canDecryptOtherResponsesStatus !== 'checking' &&
          this.isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)
        ) {
          // Clear any previously granted permission while we verify against the current gate/session/wallet.
          this.setState(buildCanDecryptOtherResponsesState({ status: 'checking' }));
        }
        const { canDecrypt, status }: any = await resolveCanDecryptGateAccess({
          cfg,
          slug,
          account: snapshot.account,
          resourceKeysToCheck: snapshot.resourceKeysToCheck,
        }, checkSponsoredAccess);
        if (this.isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)) {
          this.setState(buildCanDecryptOtherResponsesState({ canDecrypt, status }));
        }
        return canDecrypt;
      })();

      let tracked: any = null;
      tracked = run
        .catch(() => {
          if (this.isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)) {
            this.setState(buildCanDecryptOtherResponsesState({ status: 'unknown' }));
          }
          return false;
        })
        .finally(() => {
          // Only clear the pointer if we're still tracking this exact promise.
          this.clearCanDecryptOtherResponsesInFlightIfTracked(tracked);
        });
      this._canDecryptOtherResponsesInFlight = tracked;

      return await this._canDecryptOtherResponsesInFlight;
    } catch (_: any) {
      try {
        this.setState(buildCanDecryptOtherResponsesState({ status: 'unknown' }));
      } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      return false;
    }
  };

  buildCanDecryptOtherResponsesSignature = () => {
    try {
      return buildCanDecryptContext({
        getEffectiveDraftSlug: () => this._getEffectiveDraftSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(this.props),
        resolveEffectiveResponseGateConfig: (slug: any) => this.resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => this.getResponseGatePolicy(),
        account: this.props?.account || '',
        loginComplete: this.props?.loginComplete,
        singleQuestionMode: this.props.singleQuestionMode as any,
        isStandalone: this.props.isStandalone as any,
        sbtCacheRevision: this.props?.sbtCacheRevision || 0,
      }).snapshot.signature;
    } catch (_: any) {
      return '';
    }
  };

  maybeRefreshCanDecryptOtherResponses = () => {
    try {
      const sig: any = this.buildCanDecryptOtherResponsesSignature();
      if (sig === this._canDecryptOtherResponsesSig) return;
      this._canDecryptOtherResponsesSig = sig;
      this.refreshCanDecryptOtherResponses();
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };

  emitPendingStats = (stats: any) => {
    if (typeof this.props.onPendingStatsChange !== 'function') return;
    const total: any = Number(stats?.total || 0);
    const encrypted: any = Number(stats?.encrypted || 0);
    const submittedSinceLastEdit: any = !!this.state.submittedSinceLastEdit;
    const isSubmitting: any = !!this.state.isSubmitting;
    const last: any = this._lastPendingStats || {};
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

  getActiveSurveyIndex = (surveyIndexParam: any) => (
    this.props.isStandalone || this.props.singleQuestionMode
      ? 0
      : (surveyIndexParam ?? this.props.surveyIndex ?? 0)
  );

  didEditDiffInputsChange = (prevProps: any, prevState: any) => {
    if (!prevProps || !prevState) return true;
    const prevSessionSlugHint: any = getSessionSlugHintFromProps(prevProps);
    const nextSessionSlugHint: any = getSessionSlugHintFromProps(this.props);
    const prevSessionSlugPinned: any = getSessionSlugPinnedFromProps(prevProps);
    const nextSessionSlugPinned: any = getSessionSlugPinnedFromProps(this.props);
    const prevStateQuestionPoolSig: any = buildQuestionIdScopeSignature(prevState.questionPool);
    const nextStateQuestionPoolSig: any = buildQuestionIdScopeSignature(this.state.questionPool);
    const prevStatePileQuestionsSig: any = buildQuestionIdScopeSignature(prevState.pileQuestions);
    const nextStatePileQuestionsSig: any = buildQuestionIdScopeSignature(this.state.pileQuestions);
    const prevPropsQuestionPoolSig: any = buildQuestionIdScopeSignature(prevProps.questionPool);
    const nextPropsQuestionPoolSig: any = buildQuestionIdScopeSignature(this.props.questionPool);
    if (prevState.surveysResponseState !== this.state.surveysResponseState) return true;
    if (prevState.editBaseline !== this.state.editBaseline) return true;
    if (prevState.userAnswers !== this.state.userAnswers) return true;
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
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentDidMount === 'function') {
      return runtimeStrategy.componentDidMount(this);
    }
    return this.runDefaultComponentDidMount();
  }

  runDefaultComponentDidMount = () => {
    // Force-disable auto-decrypt on wagmi/porto at mount; also clear any in-flight state
    if (this.isAutoDecryptBlocked()) {
      this.resetBlockedAutoDecryptSweepInternals();
      this.setState(buildAutoDecryptDisabledState());
    }

    // Lazy load ZK-compatible Poseidon hasher (poseidon-lite)
    this._isMounted = true;
    this._hasMounted = true;
    const loadHasher: any = async () => {
      try {
        const { poseidon }: any = await import('poseidon-lite');
        if (typeof poseidon === 'function' && this._isMounted) {
          this.setState(buildHasherState(poseidon));
          surveyLog.log("✅ ZK-Compatible Poseidon Hasher Loaded (poseidon-lite)");
        }
      } catch (e: any) {
        surveyLog.warn("⚠️ Failed to load Real Poseidon. Falling back to Keccak (Non-ZK).", e);
      }
    };
    loadHasher();

    this.loadBookmarks();
    this.hydrateGateSbtLabels();
    try {
      const slugSig: any = normalizeSessionSlugValue(this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props));
      const acctSig: any = String(this.props.account || '').trim().toLowerCase();
      this._priorResponseHydrationContextSig = `${slugSig}|${acctSig}`;
      this._priorResponseBackfillAttempted = new Set();
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    // Determine whether the connected wallet satisfies the response gate; used to show/hide decrypt buttons
    // when viewing another wallet's encrypted response.
    try { this.maybeRefreshCanDecryptOtherResponses(); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    if (this.props.singleQuestionMode) {
      (async () => {
        await this.fetchSingleQuestionData();
        this.updateJsonPreview();
        // Quick local-cache rehydrate for non-encrypted prior answers (single Q)
        this.rehydrateLocalCacheAnswersForRenderedIds();

        if (this.props.responderAddress) {
          this.setState(buildViewingResponseModeState(), async () => {
            if (this.props.account && this.props.account.toLowerCase() === this.props.responderAddress.toLowerCase()) {
              if (this.state.userHasResponse) {
                // UI will show decrypt/edit or start fresh buttons
              }
            }
          });
        } else {
          this.setState(buildDisplayAnswerModeState(this.props.displayAnswerMode));
        }
      })();
    } else if (!this.props.isStandalone) { // Survey mode (multiple questions)
      (async () => {
        await this.fetchQuestionPool();
        const initialStates: any = this.initializeSurveyResponseState();
        this.setState(
          buildInitialSurveyResponseState({
            surveysResponseState: initialStates,
            editBaseline: this.deepClone(initialStates[this.props.surveyIndex || 0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          }),
          async () => {
            this.rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
            // Quick local-cache rehydrate for non-encrypted prior answers (survey)
            await this.rehydrateLocalCacheAnswersForRenderedIds(null, { responseHydrationOwned: true });

            // Defer prefill if caches/IDs not ready yet; avoid double-prefill
            if (this.props.isQuestionCacheReady ||
                (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)) {
              await this.fetchSurveyResponse();
              this.checkAndHandleStartFresh();
            } else {
              this.setState(buildPrefillQueuedAfterCacheState(true));
            }
          }
        );
      })();
    } else { // Standalone mode (question pool passed as prop)
      const initialSlice: any = this.initializeSurveyResponseState();
      this.setState(
        buildInitialStandaloneResponseState({
          surveysResponseState: initialSlice,
          editBaseline: this.deepClone(initialSlice[0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          jsonPreview: this.prepareJsonAndHash(0),
        }),
        () => {
          this.rehydrateDraftForRenderedIds();
          // Quick local-cache rehydrate for non-encrypted prior answers (standalone list)
          this.rehydrateLocalCacheAnswersForRenderedIds();
        }
      );
    }
  };

  async componentDidUpdate(prevProps: any, prevState: any) {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentDidUpdate === 'function') {
      return runtimeStrategy.componentDidUpdate(this, prevProps, prevState);
    }
    return this.runDefaultComponentDidUpdate(prevProps, prevState);
  }

  runDefaultComponentDidUpdate = async (prevProps: any, prevState: any) => {
    const diffInputsChanged: any = this.didEditDiffInputsChange(prevProps, prevState);
    if (diffInputsChanged) {
      const propsHydrationContextChanged: any =
        prevProps.isStandalone !== this.props.isStandalone ||
        prevProps.minifiedMode !== this.props.minifiedMode ||
        prevProps.surveyIndex !== this.props.surveyIndex ||
        prevProps.surveyId !== this.props.surveyId ||
        prevProps.viewAddress !== this.props.viewAddress ||
        prevProps.account !== this.props.account ||
        prevProps.loginComplete !== this.props.loginComplete ||
        prevProps.singleQuestionMode !== this.props.singleQuestionMode ||
        prevProps.questionID !== this.props.questionID ||
        prevProps.responderAddress !== this.props.responderAddress ||
        prevProps.network?.id !== this.props.network?.id ||
        prevProps.networkChainId !== this.props.networkChainId ||
        getSessionSlugHintFromProps(prevProps) !== getSessionSlugHintFromProps(this.props) ||
        getSessionSlugPinnedFromProps(prevProps) !== getSessionSlugPinnedFromProps(this.props) ||
        buildQuestionIdScopeSignature(prevProps.questionPool) !== buildQuestionIdScopeSignature(this.props.questionPool);
      if (propsHydrationContextChanged || !this._responseHydrationStateUpdateDepth) {
        this.invalidateResponseHydrationRuns();
      }
      this.invalidateDiffCaches();
    }
    if (prevState.userAnswers !== this.state.userAnswers) {
      this._userAnswersSliceCache = { source: null, value: null };
      if (!diffInputsChanged) this.invalidateDiffCaches();
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

    const pendingStats: any = diffInputsChanged
        ? ((typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) || this.getPendingStatsSnapshot())
      : this.getPendingStatsSnapshot();
    this.emitPendingStats(pendingStats);
    if (diffInputsChanged && typeof this.recalculateEditStats === 'function') {
      this.recalculateEditStats(pendingStats);
    }

    try {
      const slugSig: any = normalizeSessionSlugValue(this._getEffectiveDraftSlug() || resolveEffectiveSlug(this.props));
      const acctSig: any = String(this.props.account || '').trim().toLowerCase();
      const nextSig: any = `${slugSig}|${acctSig}`;
      if (nextSig !== this._priorResponseHydrationContextSig) {
        this._priorResponseHydrationContextSig = nextSig;
        this._priorResponseBackfillAttempted = new Set();
      }
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }

    // Force-disable auto-decrypt whenever provider/account changes to wagmi/porto
    if (
      (prevProps.provider !== this.props.provider || prevProps.account !== this.props.account) &&
      this.isAutoDecryptBlocked()
    ) {
      this.resetBlockedAutoDecryptSweepInternals();
      if (this.state.autoDecryptEnabled || (this.state.decryptingByKey && Object.keys(this.state.decryptingByKey).length > 0)) {
        this.setState(buildAutoDecryptDisabledState());
      }
    }

    // Keep the "can decrypt viewed responses" capability in sync with wallet/session/gate changes.
    try { this.maybeRefreshCanDecryptOtherResponses(); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    // Re-trigger auto-decrypt sweep when cache data arrives after initial render.
    // Without this, an early sweep with empty cache never re-fires, leaving "Decrypt"
    // buttons visible even though the user has permission.
    const cacheJustBecameReady: any = !prevProps.isResponsesCacheReady && this.props.isResponsesCacheReady;

    const shouldShortCircuitUpdate: any =
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
      const identityChanged: any =
        prevProps.questionID !== this.props.questionID ||
        prevProps.responderAddress !== this.props.responderAddress;
      const groupContextChanged: any =
        getSessionSlugHintFromProps(prevProps) !== getSessionSlugHintFromProps(this.props) ||
        getSessionSlugPinnedFromProps(prevProps) !== getSessionSlugPinnedFromProps(this.props);

      // Treat responses-cache-ready as a trigger too
      const cacheTick: any =
        (prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
          this.props.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
          this.props.isResponsesCacheReady) ||
        (this.props.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== this.props.questionsCacheNonce) ||
        (this.props.isResponsesCacheReady &&
          prevProps.questionResponsesNonce !== this.props.questionResponsesNonce);
      const prevNetId: any = String(prevProps.network?.id ?? prevProps.networkChainId ?? '');
      const currNetId: any = String(this.props.network?.id ?? this.props.networkChainId ?? '');
      const authOrProviderBecameReady: any =
        (!prevProps.loginComplete && !!this.props.loginComplete) ||
        (!prevProps.account && !!this.props.account) ||
        (!prevProps.provider && !!this.props.provider);
      const networkBecameReady: any = prevNetId !== currNetId && !!currNetId;
      const waitingForViewedResponseBootstrap: any =
        !!this.props.responderAddress &&
        !this.state.parsedViewAddressAnswers &&
        this.state.noResponse !== true;
      const singleQuestionBootstrapPending: any =
        waitingForViewedResponseBootstrap || (
          !this.state.displayAnswerMode &&
          !this.state.parsedViewAddressAnswers &&
          (!Array.isArray(this.state.questionPool) || this.state.questionPool.length === 0)
        );
      const shouldRetrySingleQuestionBootstrap: any =
        singleQuestionBootstrapPending && (authOrProviderBecameReady || networkBecameReady);
      const retryMaskedOnReadiness: any = shouldRetryMaskedQuestionRefresh({
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
        this.setState(buildResponseLoadingResetState(
          updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset')
        ));
        await this.fetchSingleQuestionData(); // merge-safe
      } else if (cacheTick || groupContextChanged || retryMaskedOnReadiness || shouldRetrySingleQuestionBootstrap) {
        // Don’t rebuild while user has pending edits; keeps “Submit (X)” stable
        if (this.state.isDirty || (this.state.modifiedCount || 0) > 0) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          return;
        }
        const pendingBootstrapRetryAttempt: any = this.getPendingSingleQuestionBootstrapRetryAttempt(this.props.questionID);
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
            this.setState(buildResponseLoadingResetState(
              updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset')
            ));

            // 1. Apply Draft (Anon answers) onto Empty
            this.rehydrateDraftForRenderedIds({ responseHydrationOwned: true });

            // 2. Fetch Chain (Merges Chain into Draft)
            const pendingBootstrapRetryAttempt: any = this.props.singleQuestionMode
              ? this.getPendingSingleQuestionBootstrapRetryAttempt(this.props.questionID)
              : 0;
            await this.fetchSingleQuestionData(
              pendingBootstrapRetryAttempt > 0
                ? { bootstrapRetryAttempt: pendingBootstrapRetryAttempt }
                : undefined
            );

            const isViewingOwnResponse: any =
              this.props.account &&
              this.props.responderAddress &&
              this.props.account.toLowerCase() === this.props.responderAddress.toLowerCase();
            const isViewingNoSpecificResponder: any =
              this.props.account && !this.props.responderAddress;

            if (
              this.state.userHasResponse &&
              (isViewingOwnResponse || isViewingNoSpecificResponder)
            ) {
              this.setState(buildEditingResponseModeState());
            }
        });
      }

      if (prevState.questionPool !== this.state.questionPool) {
        this.setState(
          (prevStateInner: any) => buildQuestionPoolResponseMergeState(prevStateInner, {
            mergeSurveyResponseState: this.mergeSurveyResponseState,
            questionPool: this.state.questionPool || [],
            surveyIndex: 0,
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
      const surveyChanged: any = this.props.surveyId !== prevProps.surveyId;
      const cacheInvalidated: any =
        (prevProps.isQuestionCacheReady !== this.props.isQuestionCacheReady &&
          this.props.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== this.props.isResponsesCacheReady &&
          this.props.isResponsesCacheReady) ||
        (this.props.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== this.props.questionsCacheNonce) ||
        (this.props.isResponsesCacheReady &&
          prevProps.questionResponsesNonce !== this.props.questionResponsesNonce);

      if (surveyChanged) {
        this.setState(buildSurveyChangedResetState(
          updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset')
        ));
        await this.fetchQuestionPool();
        this.setState(
          buildSurveysResponseStatePatch(this.initializeSurveyResponseState()),
          async () => {
            await this.fetchSurveyResponse();
            this.checkAndHandleStartFresh();
          }
        );
      } else if (cacheInvalidated) {
        // Don’t rebuild while user has pending edits; keeps “Submit (X)” stable
        const hasPendingQuestionPoolHydration: any = this.getSurveyQuestionPoolLoadState().isIncomplete;
        if ((this.state.isDirty || (this.state.modifiedCount || 0) > 0) && !hasPendingQuestionPoolHydration) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          // do nothing
        } else {
          await this.fetchQuestionPool();
          this.setState(
            (prev: any) => buildSurveyResponseMergeState(prev, {
              mergeSurveyResponseState: this.mergeSurveyResponseState,
              questionPool: this.state.questionPool || [],
              surveyIndex: this.props.surveyIndex,
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
            this.setState(buildSurveyAccountViewResetState({
              parsedViewAddressAnswers:
                this.props.viewAddress !== prevProps.viewAddress
                  ? null
                  : this.state.parsedViewAddressAnswers,
              noResponse:
                this.props.viewAddress !== prevProps.viewAddress
                  ? false
                  : this.state.noResponse,
              submittedSinceLastEdit: updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset'),
            }));

            // 1. Rehydrate draft immediately so it exists before fetch returns
            if (this.props.account && this.props.account !== prevProps.account) {
               this.rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
            }

            // 2. Fetch Chain (Merges Chain into Draft)
            await this.fetchSurveyResponse();

            const isViewingOwnSurveyResponse: any =
              this.props.account &&
              this.props.viewAddress &&
              this.props.account.toLowerCase() === this.props.viewAddress.toLowerCase();
            const isViewingNoSpecificSurvey: any =
              this.props.account && !this.props.viewAddress;

            if (
              this.state.userHasResponse &&
              (isViewingOwnSurveyResponse || isViewingNoSpecificSurvey)
            ) {
              this.setState(buildEditingResponseModeState());
            }
        });
      }
    }

    // Standalone mode (QuestionsDashboard)
    else {
      if (prevProps.questionPool !== this.props.questionPool) {
        this.setState(
          (prevStateInner: any) => buildQuestionPoolResponseMergeState(prevStateInner, {
            includeQuestionPool: true,
            mergeSurveyResponseState: this.mergeSurveyResponseState,
            questionPool: this.props.questionPool || [],
            surveyIndex: 0,
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
          prevProps.questionsCacheNonce !== this.props.questionsCacheNonce) ||
        (this.props.isResponsesCacheReady &&
          prevProps.questionResponsesNonce !== this.props.questionResponsesNonce)
      ) {
        this.rehydrateLocalCacheAnswersForRenderedIds();
      }

      const standaloneAuthBecameReady: any =
        (!prevProps.loginComplete && !!this.props.loginComplete) ||
        (!prevProps.account && !!this.props.account) ||
        (!prevProps.provider && !!this.props.provider);

      if (this.props.account !== prevProps.account || standaloneAuthBecameReady) {
        // Clear live form state before reacting to new account
        this.resetFormStateForAccountChange(() => {
             this.setState(buildStandaloneAuthResetState(
              updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset')
            ));
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
      this.setState(buildPrefillQueuedAfterCacheState(false));
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
  };


  componentWillUnmount() {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentWillUnmount === 'function') {
      return runtimeStrategy.componentWillUnmount(this);
    }
    return this.runDefaultComponentWillUnmount();
  }

  runDefaultComponentWillUnmount = () => {
    if (this._emptySubmitTimer) {
      clearTimeout(this._emptySubmitTimer);
      this._emptySubmitTimer = null;
    }
    const hasPendingDraftChanges: any =
      !!this._persistTimer ||
      !!(this._draftDirtyQids && this._draftDirtyQids.size > 0) ||
      !!(this.state && (this.state.isDirty || Number(this.state.modifiedCount || 0) > 0));
    if (this._persistTimer) {
      clearTimeout(this._persistTimer);
      this._persistTimer = null;
    }
    if (hasPendingDraftChanges) {
      try { this.persistDraft(); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
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
  };



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
    const explicitSessionSlug: any = resolveEffectiveSlug(this.props);
    const resolvedSession: any = explicitSessionSlug
      ? resolveExplicitSessionContext(explicitSessionSlug)
      : resolveDraftSessionContext(this.props, this._getEffectiveDraftSlug());
    const sessionSlug: any = resolvedSession.sessionSlug || '';
    const sessionConfig: any = resolvedSession.sessionConfig || null;
    const providerLike: any = typeof this.props.providerLike === 'string'
      ? this.props.providerLike
      : (typeof this.props.provider === 'string' ? this.props.provider : '');
    const chainId: any = this.resolveSessionChainId(sessionSlug, sessionConfig);
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

  buildQuestionDecryptContext = (slugIn: any) => {
    const slug: any = String(slugIn ?? '').trim().toLowerCase();
    const cfg: any = resolveExplicitSessionContext(slug).sessionConfig || null;
    const litHooks: any =
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

  buildAutomaticQuestionMetadataFetchOptions = (slugIn: any) => {
    const decryptContext: any = this.buildQuestionDecryptContext(slugIn);
    return this.shouldAttemptAutomaticPromptDecrypt()
      ? { decryptContext }
      : { decryptContext, skipDecrypt: true };
  };

  hasMaskedCurrentQuestionPayload = () => {
    if (!this.props.singleQuestionMode) return false;
    const q: any = Array.isArray(this.state.questionPool) ? this.state.questionPool[0] : null;
    if (q && typeof q === 'object') {
      if (isMaskedQuestionPayload(q)) return true;
      const prompt: any = String(q.prompt || '').trim();
      if (prompt || q.promptDecrypted) return false;
    }
    const qid: any = String(this.props.questionID || '').toLowerCase();
    if (!qid) return false;
    const slug: any = this._getEffectiveDraftSlug();
    const cfg: any = resolveExplicitSessionContext(slug).sessionConfig || null;
    const netIdStr: any = String(
      this.props.network?.id ?? this.props.networkChainId ?? cfg?.networkChainId ?? ''
    );
    if (!netIdStr) return false;
    const cache: any = readQuestionsCache(slug) || {};
    const cached: any = cache?.[netIdStr]?.questions?.[qid];
    return isMaskedQuestionPayload(cached);
  };

  isMaskedPromptText = (prompt: any) => isSurveyQuestionsMaskedPromptText(prompt);

  getQuestionFetchCandidateSlugs = (questionId: any, preferredSlug: any = '', opts: any = {}) => {
    const sanitize: any = (s: any) => (
      s == null
        ? ''
        : String(s).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    );

    const qid: any = String(questionId || '').trim().toLowerCase();
    const slugPinned: any = getSessionSlugPinnedFromProps(this.props);
    const explicitSlug: any = sanitize(getSessionSlugHintFromProps(this.props));
    const currentQuestionSessionName: any = (this.state.questionPool?.[0] as any)?.sessionName;
    const resolvedSlug: any = sanitize(
      resolveSlugForIds({
        sessionName: this.props.sessionName || currentQuestionSessionName,
        questionId: qid || this.props.questionID || null,
        surveyId: this.props.singleQuestionMode ? null : (this.props.surveyId || null),
        props: this.props,
        network: this.props.network,
      })
    );
    const preferred: any = sanitize(preferredSlug);
    const effective: any = preferred || explicitSlug || resolvedSlug || sanitize(resolveEffectiveSlug(this.props));
    const explicitSlugKnown: any = explicitSlug === '' || !!resolveExplicitSessionContext(explicitSlug).sessionConfig;
    // Default behavior preserves strict session pinning; callers can opt into fallback explicitly.
    const allowPinnedFallback: any =
      opts?.allowPinnedFallback === true ||
      (slugPinned && !!explicitSlug && !explicitSlugKnown);

    const out: any = [];
    const seen: any = new Set();
    const pushSlug: any = (slugIn: any) => {
      const slug: any = sanitize(slugIn);
      if (seen.has(slug)) return;
      seen.add(slug);
      out.push(slug);
    };

    pushSlug(effective);
    pushSlug(explicitSlug);
    pushSlug(resolvedSlug);
    pushSlug(resolveEffectiveSlug(this.props));

    if (!slugPinned || allowPinnedFallback) {
      getAllSessionSlugs().forEach((s: any) => pushSlug(s));
      pushSlug('');
    }

    return out;
  };

  cacheQuestionPayloadForSlug = (slugIn: any, questionId: any, questionPayload: any) => {
    const slug: any = String(slugIn ?? '').trim().toLowerCase();
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid || !questionPayload) return;

    const cacheWriteContext: any = resolveQuestionPayloadCacheWriteContext(this.props, slug);
    const netIdStr: any = cacheWriteContext.networkIdStr || '';
    if (!netIdStr) return;

    const questionsCache: any = ensureQuestionsNet(readQuestionsCache(slug), netIdStr);
    const existing: any = questionsCache?.[netIdStr]?.questions?.[qid] || null;
    const picked: any = pickBetterQuestionPayload(existing, questionPayload) || questionPayload;
    const nextPayload: any = { ...picked, id: qid };
    if (areQuestionPayloadsEquivalent(existing, nextPayload)) return;
    questionsCache[netIdStr].questions[qid] = nextPayload;
    void writeQuestionsCache(slug, questionsCache);
  };

  applyQuestionPayloadToRenderedPools = (questionId: any, questionPayload: any) => {
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid || !questionPayload) return;

    this.setState((prev: any) => buildRenderedQuestionPayloadPoolsState(prev, qid, questionPayload, {
      pickBetterQuestionPayload: pickBetterQuestionPayload as any,
      areQuestionPayloadsEquivalent,
    }));
  };

  fetchQuestionPayloadWithDeterministicContext = async (questionId: any, opts: any = {}) => {
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid) return { promptReady: false, bestQuestionData: null, bestSlug: '' };

    const currentQuestion: any =
      (Array.isArray(this.state.questionPool)
        ? this.state.questionPool.find((q: any) => String(q?.id || '').toLowerCase() === qid)
        : null) ||
      (Array.isArray(this.state.pileQuestions)
        ? this.state.pileQuestions.find((q: any) => String(q?.id || '').toLowerCase() === qid)
        : null) ||
      null;

    let bestQuestionData: any = currentQuestion ? { ...currentQuestion, id: qid } : null;
    let bestSlug: any = String(opts.preferredSlug ?? this._getEffectiveDraftSlug() ?? '').toLowerCase();
    const candidateSlugs: any = this.getQuestionFetchCandidateSlugs(qid, bestSlug);
    let fetchedAny: any = false;

    for (const candidateSlug of candidateSlugs) {
      const decryptContext: any = this.buildQuestionDecryptContext(candidateSlug);
      const litReady: any = !!(decryptContext?.litHooks && typeof decryptContext.litHooks.getKey === 'function');
      try {
        const fetched: any = await (contractScripts as any).getQuestionData(
          this.props.provider,
          qid,
          candidateSlug,
          { decryptContext }
        );
        if (!fetched) continue;
        fetchedAny = true;
        const normalized: any = { ...fetched, id: qid };
        const picked: any = pickBetterQuestionPayload(bestQuestionData, normalized) || normalized;
        bestQuestionData = picked;
        bestSlug = candidateSlug;
        this.cacheQuestionPayloadForSlug(candidateSlug, qid, picked);
        const promptReady: any = !this.isMaskedPromptText(picked?.prompt);
        if (promptReady || !isMaskedQuestionPayload(picked)) break;
      } catch (error: any) {
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

    const promptReady: any = !!bestQuestionData && !this.isMaskedPromptText(bestQuestionData?.prompt);
    if (!promptReady) {
      const litHooks: any =
        this.props.lit ||
        this.props.litHooks ||
        (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
      const litReady: any = !!(litHooks && typeof litHooks.getKey === 'function');
      const chainId: any = Number(this.props.network?.id ?? this.props.networkChainId ?? 0) || null;
      const reason: any =
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

  handleReloadMaskedPrompt = async (questionId: any) => {
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid) return false;
    const key: any = this.getQuestionFieldTaskKey(qid, 'prompt');

    this.setState((prev: any) => buildDecryptingByKeyState(prev, key, true));

    try {
      const preferredSlug: any = this._getEffectiveDraftSlug();
      const result: any = await this.fetchQuestionPayloadWithDeterministicContext(qid, { preferredSlug });

      if (this.props.singleQuestionMode && qid === String(this.props.questionID || '').toLowerCase()) {
        await this.fetchSingleQuestionData({ forceQuestionMetadataRefetch: true });
      }

      // Pile view keeps gated/masked questions in allQuestionsForFilter as source-of-truth.
      // After a successful decrypt, refresh the visible pile cards from that source without
      // triggering a full filter/apply cycle that could wipe in-progress edits.
      if (result?.promptReady) {
        this.setState((prev: any) => buildVisiblePileQuestionsAfterPromptDecryptState(prev, {
          isFilterStateActive: isSurveyToolFilterStateActive,
          isMaskedPromptText: this.isMaskedPromptText,
        }));
      }

      const activePrompt: any = (() => {
        const q: any = Array.isArray(this.state.questionPool)
          ? this.state.questionPool.find((item: any) => String(item?.id || '').toLowerCase() === qid)
          : null;
        return q?.prompt;
      })();
      return !this.isMaskedPromptText(activePrompt) || !!result.promptReady;
    } catch (error: any) {
      surveyLog.debug('[question-prompt-reload] manual reload failed', {
        questionId: qid,
        error: error?.message || String(error || ''),
      });
      return false;
    } finally {
      this.setState((prev: any) => buildDecryptingByKeyState(prev, key, false));
    }
  };

  reloadMaskedQuestionBatch = async (questionIds: any = []) => {
    const ids: any = Array.from(new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((qid: any) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    ));
    if (!ids.length) return;

    this.setState(buildBulkPromptReloadingState(true));
    try {
      for (const qid of ids) {
        // eslint-disable-next-line no-await-in-loop
        await this.handleReloadMaskedPrompt(qid);
      }
    } finally {
      this.setState(buildBulkPromptReloadingState(false));
    }
  };

  renderPromptWithManualDecrypt = (question: any) => {
    const qid: any = String(question?.id || '').trim().toLowerCase();
    const promptText: any = question?.prompt || 'Question';
    const promptMasked: any = this.isMaskedPromptText(promptText);
    const payloadDisplay: any = this.getQuestionPayloadDisplayState(question);
    const promptReloading: any = this.isQuestionFieldBusy(qid, 'prompt');
    const promptDisplay: any = buildQuestionPromptDecryptDisplayState({
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

  renderQuestionTagControl = (question: any, options: any = {}) => {
    const { rowStyle }: any = options;
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

  renderQuestionTagDropdown = (question: any) => (
    this.renderQuestionTagControl(question)
  );

  handleQuestionTagSelect = (tag: any) => {
    const normalizedTag: any = String(tag || '').trim();
    if (!normalizedTag) return;
    this.setState(buildActiveTagModalState(normalizedTag));
  };

  closeQuestionTagModal = () => {
    this.setState(buildActiveTagModalState());
  };

  renderQuestionTagDropdownRow = (question: any) => (
    this.renderQuestionTagControl(question, {
      rowStyle: QUESTION_TAG_DROPDOWN_ROW_STYLE,
    })
  );

  getSliderMode = (questionId: any) => {
    return getQuestionSliderMode({
      explicitMode: this.state.sliderModeByQuestion?.[questionId],
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      surveyIndex: this.props.surveyIndex,
      surveysResponseState: this.state.surveysResponseState,
      questionId,
    });
  };

  setSliderMode = (questionId: any, mode: any) => {
    this.setState((prev: any) => (
      // Track whether the conviction/importance control has been "opened" for this question.
      buildSliderModeStatePatch(prev, questionId, mode)
    ));
  };

  getConvictionValueForSlice = (slice: any, questionId: any) => {
    return getQuestionConvictionSliderValue(slice, questionId);
  };

  getImportanceValueForSlice = (slice: any, questionId: any) => {
    return getQuestionImportanceSliderValue(slice, questionId);
  };

  flushDraftPersistAfterSliderChange = () => {
    this.persistDraftSafely && this.persistDraftSafely(0);
  };

  handleConvictionImportanceChange = (surveyIndex: any, questionId: any, mode: any, value: any, options: any = {}) => {
    if (mode === 'importance') {
      this.handleImportance(surveyIndex, questionId, value, options);
    } else {
      this.handleConviction(surveyIndex, questionId, value, options);
    }
  };

  renderFullQuestionSliderSection = ({
    surveyIndex,
    questionId,
    sliderMode,
    activeSliderValue,
    convictionValue,
    importanceValue,
    hasConvictionImportanceValue,
    sliderOpen,
  }: any) => (
    <SurveyQuestionsFullQuestionSliderSection
      activeSliderValue={activeSliderValue}
      convictionValue={convictionValue}
      hasConvictionImportanceValue={hasConvictionImportanceValue}
      importanceToggleEnabled={ENABLE_IMPORTANCE_SLIDER_TOGGLE}
      importanceValue={importanceValue}
      isSubmitting={this.state.isSubmitting}
      onChange={(value: any, event: any) =>
        this.handleConvictionImportanceChange(
          surveyIndex,
          questionId,
          sliderMode,
          value,
          buildSliderPersistOptions(event)
        )}
      onChangeComplete={this.flushDraftPersistAfterSliderChange}
      onCommit={(committedValue: any) => this.handleConvictionImportanceChange(
        surveyIndex,
        questionId,
        sliderMode,
        committedValue,
        {
          persistDraft: false,
          afterUpdate: this.flushDraftPersistAfterSliderChange,
        }
      )}
      onSelectMode={(nextMode: any) => this.setSliderMode(questionId, nextMode)}
      questionId={questionId}
      singleQuestionMode={this.props.singleQuestionMode}
      sliderMode={sliderMode}
      sliderOpen={sliderOpen}
      sliderToggleExpandedByQuestion={this.state.sliderToggleExpandedByQuestion}
    />
  );

  renderFullQuestionResponseInput = ({
    question,
    qIndex,
    surveyIndex,
    answer,
    glowAnswer,
  }: any) => (
    <SurveyQuestionsFullQuestionResponseInput
      question={question}
      qIndex={qIndex}
      answer={answer}
      glowAnswer={glowAnswer}
      isSubmitting={this.state.isSubmitting}
      singleQuestionMode={this.props.singleQuestionMode}
      audioInputWorkerProps={this.getAudioInputWorkerProps()}
      onAnswerChange={(answerValue: any) => this.handleAnswer(surveyIndex, question.id, answerValue)}
      onDeferredRatingCommit={(committedRating: any) => this.handleAnswer(
        surveyIndex,
        question.id,
        committedRating,
        {
          persistDraft: false,
          afterUpdate: this.flushDraftPersistAfterSliderChange,
        }
      )}
      onRatingChange={(ratingAnswer: any, event: any) => this.handleAnswer(
        surveyIndex,
        question.id,
        ratingAnswer,
        buildSliderPersistOptions(event)
      )}
      onRatingChangeComplete={this.flushDraftPersistAfterSliderChange}
      onToggleAnswerEncryption={(newEncryptedState: any) => this.toggleAnswerEncryption(
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
  }: any) => (
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
      updateFunction={(additionalCommentsValue: any) => this.handleAdditional(surveyIndex, questionId, additionalCommentsValue)}
      toggleEncryption={(newEncryptedState: any) =>
        this.toggleAdditionalCommentsEncryption(surveyIndex, questionId, newEncryptedState)
      }
    />
  );

  parseEncryptedEnvelope = (field: any) => (parseEncryptedEnvelopeHelper as any)(field);

  getFieldDecryptState = ({
    questionId,
    fieldKey,
    field,
  }: any) => (buildFieldDecryptStateHelper as any)(field, {
    loginComplete: this.props.loginComplete,
    account: this.props.account,
    busy: this.isQuestionFieldBusy(questionId, fieldKey),
  });

  getQuestionFieldDisplayState = ({
    questionId,
    answer,
    additional,
  }: any) => {
    const answerDecryptState: any = this.getFieldDecryptState({
      questionId,
      fieldKey: 'answer',
      field: answer,
    });
    const additionalDecryptState: any = this.getFieldDecryptState({
      questionId,
      fieldKey: 'additional',
      field: additional,
    });
    return (buildQuestionFieldDisplayStateHelper as any)({
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
  }: any) => {
    const slice: any = responseSlice || {};
    const answer: any = slice.answers?.[questionId] || this.buildEmptyResponseFieldState(questionId);
    const additional: any = slice.additionalComments?.[questionId] || this.buildEmptyResponseFieldState(questionId, 'additional');
    const convictionValue: any = this.getConvictionValueForSlice(slice, questionId);
    const importanceValue: any = this.getImportanceValueForSlice(slice, questionId);
    const hasConvictionImportanceValue: any = hasConvictionOrImportanceValueForQuestion(slice, questionId);
    const sliderMode: any = ENABLE_IMPORTANCE_SLIDER_TOGGLE ? this.getSliderMode(questionId) : 'conviction';
    return (buildQuestionResponseDisplayStateHelper as any)({
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
  }: any) => {
    const responseDisplayState: any = this.getQuestionResponseDisplayState({
      questionId,
      responseSlice,
    });
    const fieldDisplayState: any = this.getQuestionFieldDisplayState({
      questionId,
      answer: responseDisplayState.answer,
      additional: responseDisplayState.additional,
    });

    return (buildQuestionRenderDisplayStateHelper as any)({
      responseDisplayState,
      fieldDisplayState,
    });
  };

  isQuestionPromptMasked = (question: any) => isQuestionPromptMasked(question);

  getQuestionPayloadDisplayState = (question: any) => {
    const slug: any = normalizeSessionSlugValue(
      question?.sessionSlug ||
      question?.sessionName ||
      this._getEffectiveDraftSlug() ||
      resolveEffectiveSlug(this.props)
    );
    const sessionConfig: any = slug ? (resolveExplicitSessionContext(slug).sessionConfig || null) : null;
    return resolveQuestionPayloadDisplayState(question, sessionConfig);
  };

  getAnswerLockDisplayState = ({
    field,
    masked,
  }: any) => buildAnswerLockDisplayState({
    field,
    masked,
    isSubmitting: this.state.isSubmitting,
  });

  getGatedPromptNoticeState = ({
    question,
    tooltipIdSuffix,
    fallbackId = 'gated',
  }: any) => buildGatedPromptNoticeState({
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
  }: any) => {
    const { tooltipId, tooltipText }: any = this.getGatedPromptNoticeState({
      question,
      tooltipIdSuffix,
      fallbackId,
    });
    const qid: any = String(question?.id || '').trim().toLowerCase();
    const promptReloading: any = qid ? this.isQuestionFieldBusy(qid, 'prompt') : false;
    const canReloadPrompt: any = qid && this.isQuestionPromptMasked(question);
    const payloadDisplay: any = this.getQuestionPayloadDisplayState(question);
    const promptDisplay: any = buildQuestionPromptDecryptDisplayState({
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
  }: any) => (
    renderSurveyQuestionsFullQuestionGatedPromptCard({
      cardKey,
      promptContent: this.renderPromptWithManualDecrypt(question),
      cardIcons,
      gatedPromptNotice: this.renderGatedPromptNotice({
        question,
        tooltipIdSuffix: 'full',
        fallbackId: cardKey || 'gated',
      }),
      tagDropdownRow: this.renderQuestionTagDropdownRow(question),
    })
  );

  renderQuestionMaskedPromptCard = ({
    mode,
    question,
    cardKey,
    cardIcons,
  }: any) => (
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
  }: any) => this.renderAnswerLockControl({
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
  }: any) => this.renderAnswerLockControl({
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
  }: any) => {
    const { lockDisabled, lockTitle }: any = this.getAnswerLockDisplayState({
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
  }: any) => {
    const arweaveTxId: any = getLegacyArweaveTxId(question);
    return (
      <QuestionCardLinks
        showResponseLookupSpinner={showResponseLookupSpinner}
        isQuestionBookmarked={isQuestionBookmarked}
        onBookmarkToggle={() => this.handleBookmarkToggle(question.id)}
        arweaveHref={arweaveTxId
          ? normalizeArweaveUrl(arweaveTxId, { contextLabel: 'survey_tool_question_link' })
          : ''}
        questionHref={question.id
          ? buildQuestionRoutePath(question.id, { sessionSlug: this._getEffectiveDraftSlug() })
          : ''}
      />
    );
  };

  renderQuestionFieldDecryptControl = ({
    questionId,
    fieldKey,
    allowDecrypt,
    decryptTooltip,
    actionLabel,
    busy,
    showBusySpinnerWhenAutoDecryptEnabled = false,
    wrapperStyle,
  }: any) => {
    const displayState: any = (buildQuestionFieldDecryptControlDisplayStateHelper as any)({
      actionLabel,
      allowDecrypt,
      autoDecryptEnabled: this.state.autoDecryptEnabled,
      busy,
      decryptTooltip,
      isDecrypting: this.state.isDecrypting,
      showBusySpinnerWhenAutoDecryptEnabled,
      wrapperStyle,
    });

    return (
      <QuestionDecryptControl
        {...displayState}
        onClick={() => this.handleDecryptQuestionAnswer(questionId, fieldKey)}
      />
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
  }: any) => (
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
  areResponsesConsistent = (latest: any, surveyIndex: any) => {
    return areSurveyResponsesConsistent({
      latest,
      editBaseline: this.state.editBaseline,
      renderedIds: this.getCurrentRenderedQuestionIds(),
      buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
      valuesEqual: this.valuesEqual,
    });
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
  getEditTrackingQuestionIds = (surveyIndexParam: any = null) => {
    const ids: any = new Set();
    const add: any = (rawId: any) => {
      const normalized: any = normalizeQuestionIdKey(rawId);
      if (normalized) ids.add(normalized);
    };
    const addSliceIds: any = (slice: any) => {
      if (!slice || typeof slice !== 'object') return;
      const addKeys: any = (map: any) => {
        if (!map || typeof map !== 'object') return;
        Object.keys(map).forEach((rawKey: any) => add(rawKey));
      };
      addKeys(slice.answers);
      addKeys(slice.additionalComments);
      addKeys(slice.importance);
      addKeys(slice.conviction);
    };
    try {
      const surveyIndex: any = this.getActiveSurveyIndex(surveyIndexParam);
      const currentSlice: any = this.state?.surveysResponseState?.[surveyIndex] || null;
      addSliceIds(currentSlice);
      if (this.props.singleQuestionMode && this.props.questionID) {
        add(this.props.questionID);
      }
      if (typeof this.getCurrentRenderedQuestionIds === 'function') {
        const renderedIds: any = this.getCurrentRenderedQuestionIds();
        if (Array.isArray(renderedIds)) renderedIds.forEach((id: any) => add(id));
      }
      if (ids.size > 0) return ids;

      if (Array.isArray(this.state?.questionPool)) this.state.questionPool.forEach((q: any) => add(q?.id));
      if (Array.isArray(this.state?.pileQuestions)) this.state.pileQuestions.forEach((q: any) => add(q?.id));
      if (Array.isArray(this.props?.questionPool)) this.props.questionPool.forEach((q: any) => add(q?.id));
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    return ids;
  };

  getIndexedQuestionEntryKeys = (source: any) => {
    if (!source || typeof source !== 'object') return null;
    try {
      const cached: any = this._normalizedQuestionEntryKeyCache.get(source);
      if (cached) return cached;
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    const result: any = buildIndexedQuestionEntryKeys(source, normalizeQuestionIdKey);
    try {
      if (result) this._normalizedQuestionEntryKeyCache.set(source, result);
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    return result;
  };

  getChangedQidsAndFields = (surveyIndexParam: any) => measureSync('ce.surveyQuestions.getChangedQidsAndFields', () => {
    const surveyIndex: any = this.getActiveSurveyIndex(surveyIndexParam);
    const currentSlice: any =
      (this.state.surveysResponseState && this.state.surveysResponseState[surveyIndex]) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const scopedIds: any = this.getEditTrackingQuestionIds(surveyIndex);
    const { result, newCache }: any = orchestrateGetChangedQidsAndFields(
      {
        surveyIndex,
        currentSlice,
        isLoggedIn: !!(this.props.account && this.props.loginComplete),
        isLoadingResponse: !!this.state.isLoadingResponse,
        scopedIds,
        userAnswers: this.state.userAnswers,
      },
      {
        resolveDiffBaselineSlice: (allowLocalCache: any) => this.resolveDiffBaselineSlice(allowLocalCache),
        getIndexedQuestionEntryKeys: (source: any) => this.getIndexedQuestionEntryKeys(source),
        getDefaultResponseEncryptionAudience: () => this.getDefaultResponseEncryptionAudience(),
        normalizeResponseEncryptionAudience: (audience: any, qid: any) => this.normalizeResponseEncryptionAudience(audience, qid),
        getDefaultResponseEncryptionAudienceForQid: (qid: any) => this.getDefaultResponseEncryptionAudienceForQid(qid),
        resolveFieldEncryptionGateId: (field: any, qid: any, fieldKey: any) => this.resolveFieldEncryptionGateId(field, qid, fieldKey),
        normalizeFieldAudienceMode: (mode: any, fieldKey: any, field: any) => this.normalizeFieldAudienceMode(mode, fieldKey, field),
        valuesEqual: this.valuesEqual,
        buildSurveyResponseSliceSignature,
        buildRatingEnvelopeQidSetFromUserAnswers,
        hasMeaningfulFieldValue: hasMeaningfulFieldValue as any,
        bumpPerfCounter: bumpSurveyPerfCounter,
      },
      this._changedQidsAndFieldsCache,
    );
    if (newCache !== this._changedQidsAndFieldsCache) {
      this._changedQidsAndFieldsCache = newCache;
      this._pendingEditStatsCache = null;
    }
    return result;
  });


  maybeAutoDecryptVisibleFields = () => {
    try {
      // Guard: do not run decrypt sweeps while an error is present (avoid clobber after failed submit)
      if (this.state && this.state.submissionError) {
        this.resetVisibleAutoDecryptSweepState();
        return;
      }

      // Auto-decrypt now runs in all views (survey, questions, pile).
      // Guard: when logged out, do nothing so we can retry cleanly after login.
      if (!this.props || !this.props.loginComplete || !this.props.account) {
        this.resetVisibleAutoDecryptSweepState();
        return;
      }

      if (!this.state.autoDecryptEnabled) {
        this.resetVisibleAutoDecryptSweepState();
        return;
      }

      const surveyIndex: any =
        this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
      const slice: any = this.state.surveysResponseState?.[surveyIndex];
      if (!slice) {
        this._autoDecryptVisibleSweepCache = null;
        return;
      }

      // Include both questionPool and pileQuestions
      const ids: any = this.getCurrentRenderedQuestionIds();
      if (!Array.isArray(ids) || ids.length === 0) {
        this._autoDecryptVisibleSweepCache = null;
        return;
      }

      const accountLower: any = String(this.props.account || '').trim().toLowerCase();
      const idsKey: any = buildRenderedIdsSignature(ids);
      const attempted: any = { ...(this.state.autoDecryptAttempted || {}) };
      const inflight: any = { ...(this.state.decryptingByKey || {}) };
      const maskedAttemptSignature: any = this._autoDecryptMaskedAttemptSignature || {};
      const queuedSet: any = new Set(
        Array.isArray(this._autoDecQueue)
          ? this._autoDecQueue.map((it: any) => `${it.qid}:${it.field}`)
          : []
      );
      let visibleSignature: any = `${idsKey}|${accountLower}|${this.state.autoDecryptEnabled ? 1 : 0}`;
      const toQueue: any = [];

      ids.forEach((qidRaw: any) => {
        const qidSource: any = String(qidRaw || '').trim();
        const qid: any = qidSource.toLowerCase();
        if (!qid) return;
        const ans: any = slice.answers?.[qidSource] ?? slice.answers?.[qid];
        const add: any = slice.additionalComments?.[qidSource] ?? slice.additionalComments?.[qid];

        const kA: any = this.getQuestionFieldTaskKey(qid, 'answer');
        const kD: any = this.getQuestionFieldTaskKey(qid, 'additional');
        const answerSig: any = this.buildAutoDecryptMaskedFieldSignature(ans);
        const additionalSig: any = this.buildAutoDecryptMaskedFieldSignature(add);
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

      const sweepCache: any = this._autoDecryptVisibleSweepCache;
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
    } catch (_: any) {
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
    const item: any = this._autoDecQueue.shift();
    if (!item) return;

    this._autoDecProcessing = true;
    const k: any = `${item.qid}:${item.field}`;
    const maskedSig: any = String(item?.maskedSig || '');
    try {
      const did: any = await this.handleDecryptQuestionAnswer(item.qid, item.field);
      if (did) {
        // Mark as attempted ONLY when we actually produced a decrypted value
        if (!this.state.autoDecryptAttempted?.[k]) {
          this.setState((prev: any) => buildAutoDecryptAttemptedState(prev, k));
        }
        if (this._autoDecryptMaskedAttemptSignature?.[k]) {
          const nextAttemptSig: any = { ...(this._autoDecryptMaskedAttemptSignature || {}) };
          delete nextAttemptSig[k];
          this._autoDecryptMaskedAttemptSignature = nextAttemptSig;
        }
      } else if (maskedSig) {
        this._autoDecryptMaskedAttemptSignature = {
          ...(this._autoDecryptMaskedAttemptSignature || {}),
          [k]: maskedSig,
        };
      }
    } catch (_: any) {
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
        try { this.queueAutoDecryptVisibleSweep('post-item'); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
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
      const draftContext: any = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;
      const surveyScope: any = this._getDraftScope();
      return buildSurveyDraftStorageKey({
        sessionSlug: slug,
        networkIdStr: networkIdStr || '__pending__',
        account: this.props?.account,
        surveyScope,
      });
    } catch (_: any) {
      return null;
    }
  };

  loadDraft = () => {
    try {
      const draftContext: any = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;

      const surveyScope: any = this._getDraftScope();
      const accountLower: any = (this.props?.account || '').toLowerCase();
      const {
        primaryAnonKey: anonKey,
        primaryAccountKey: acctKey,
        compatAnonKey: anonCompatKey,
        compatAccountKey: acctCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAnonKey: anonPerQidKey,
        perQuestionAccountKey: acctPerQidKey,
      }: any = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: this.props.questionID,
        includePerQuestionScope: !!this.props.singleQuestionMode,
      });

      const readAndParse: any = (key: any) => {
        if (!key) return null;
        try {
          const raw: any = sessionStorage.getItem(key);
          if (!raw) return null;
          const parsedResult: any = parsePersistedDraftStorageValue({ raw });
          if (parsedResult.status !== 'valid') {
            try { sessionStorage.removeItem(key); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
            return null;
          }
          return { raw: parsedResult.raw, obj: parsedResult.payload };
        } catch (_: any) { return null; }
      };
      const pend: any = readAndParse(pendingKey);
      const perQidAnon: any = anonPerQidKey ? readAndParse(anonPerQidKey) : null;
      const perQidAcct: any = acctPerQidKey ? readAndParse(acctPerQidKey) : null;
      const rawDraftByKey: any = new Map(([
        ...(pend ? [[pendingKey, pend]] : []),
        ...(perQidAnon ? [[anonPerQidKey, perQidAnon]] : []),
        ...(perQidAcct ? [[acctPerQidKey, perQidAcct]] : []),
      ] as any));
      const loadPlan: any = buildSurveyDraftLoadPlan({
        hasAccount: !!accountLower,
        primaryAccountKey: acctKey,
        primaryAnonKey: anonKey,
        compatAccountKey: acctCompatKey,
        compatAnonKey: anonCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAccountKey: acctPerQidKey,
        perQuestionAnonKey: anonPerQidKey,
      });

      const draftHits: any = [];
      for (const step of loadPlan) {
        const hit: any = rawDraftByKey.get(step.readKey) || readAndParse(step.readKey);
        if (!hit) continue;
        draftHits.push({ ...step, ...hit });
      }

      if (draftHits.length === 0) return null;

      const mergedDraft: any = mergePersistedDraftPayloads({
        drafts: draftHits.map((hit: any) => hit.obj),
      });
      if (!mergedDraft) return null;

      const targetKey: any = accountLower ? acctKey : anonKey;
      const mergedRaw: any = JSON.stringify(mergedDraft);
      const targetHit: any = draftHits.find((hit: any) => hit.readKey === targetKey);
      const shouldWriteTarget: any =
        !!targetKey &&
        (
          !targetHit ||
          targetHit.raw !== mergedRaw ||
          draftHits.some((hit: any) => hit.readKey !== targetKey || hit.writeKey)
        );

      let wroteTarget: any = !shouldWriteTarget;
      if (shouldWriteTarget) {
        try {
          sessionStorage.setItem(targetKey, mergedRaw);
          wroteTarget = true;
        } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      }

      if (wroteTarget && targetKey) {
        draftHits.forEach((hit: any) => {
          if (!hit.readKey || hit.readKey === targetKey) return;
          try { sessionStorage.removeItem(hit.readKey); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
        });
      }

      if (targetKey && wroteTarget) {
        rawDraftByKey.set(targetKey, { raw: mergedRaw, obj: mergedDraft });
      }

      return mergedDraft;
    } catch (_: any) {
      return null;
    }
  };

  migratePersistedDraftForActiveAccount = () => {
    try {
      if (!this.props?.account) return null;
      return this.loadDraft();
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
      return null;
    }
  };




  _draftDirtyQids = new Set();

  persistDraftSafely = (delayMs: any = 150) => {
    if (this._persistTimer) clearTimeout(this._persistTimer);
    this._persistTimer = setTimeout(this.persistDraft, delayMs);
  };

  persistDraft = () => measureSync('ce.surveyQuestions.persistDraft', () => {
    try {
      const key: any = this.getDraftKey();

      // Guard null key and clean up malformed JSON
      if (!key) return;
      const keyTracking: any = buildPersistedDraftTrackingOnKeyChange({
        nextDraftKey: key,
        lastDraftKey: this._lastDraftKey,
        lastDraftJSON: this._lastDraftJSON,
        lastDraftSemanticSignature: this._lastDraftSemanticSignature,
        draftParseCache: this._draftParseCache,
      });
      this._applyDraftTrackingState(keyTracking);

      this.migratePersistedDraftForActiveAccount();

      // Preload prior persisted answers so we don't prune non-rendered QIDs
      const {
        prevAnswers,
        prevBaseline,
        prevDraftRaw,
        prevSemanticSignature,
        nextDraftParseCache,
        shouldResetDraftTracking,
      }: any = loadPreviousPersistedDraftSnapshot(
        {
          key,
          lastDraftKey: this._lastDraftKey,
          lastDraftJSON: this._lastDraftJSON,
          lastDraftSemanticSignature: this._lastDraftSemanticSignature,
          draftParseCache: this._draftParseCache,
        },
        {
          readDraftRaw: (draftKey: any) => sessionStorage.getItem(draftKey) || '',
          removeDraftRaw: (draftKey: any) => sessionStorage.removeItem(draftKey),
          buildSemanticSignature: buildSurveyDraftSemanticSignature,
        },
      );
      const loadTracking: any = buildPersistedDraftTrackingAfterLoad({
        lastDraftKey: this._lastDraftKey,
        lastDraftJSON: this._lastDraftJSON,
        lastDraftSemanticSignature: this._lastDraftSemanticSignature,
        draftParseCache: this._draftParseCache,
        nextDraftParseCache,
        shouldResetDraftTracking,
      });
      this._applyDraftTrackingState(loadTracking);

      const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
      const slice: any = (this.state.surveysResponseState && this.state.surveysResponseState[surveyIndex]) || {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {}
      };

      // Only persist rendered (or all if none rendered)
      const renderedIds: any = this.getHydrationQuestionIds();
      const dirtyQids: any = this._draftDirtyQids ? [...this._draftDirtyQids] : [];
      const allowed: any = buildPersistDraftAllowedQuestionIds({
        renderedQuestionIds: renderedIds,
        dirtyQuestionIds: dirtyQids,
        slice,
      });

      const baselineSlice: any = this.state.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      // Start from previous draft answers/baseline so non-rendered QIDs survive,
      // then overwrite only the currently allowed question set.
      const { answersObj, baselineObj }: any = buildPersistedDraftMapsForAllowedIds({
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

      const draftContext: any = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const persistWritePlan: any = buildPersistedDraftWritePlan({
        draftKey: key,
        sessionSlug: slug,
        networkIdStr: draftContext.networkIdStr,
        account: this.props?.account,
        surveyScope: this._getDraftScope(),
        singleQuestionMode: this.props.singleQuestionMode,
      });
      const payload: any = buildPersistedDraftPayload({
        draftContext,
        singleQuestionMode: this.props.singleQuestionMode,
        questionId: this.props.questionID,
        surveyId: this.props.surveyId,
        answersObj,
        // Keep baseline in storage; prefill/merge logic depends on it to avoid false dirty diffs.
        baselineObj,
      });

      const nextSemanticSignature: any = buildSurveyDraftSemanticSignature(payload);
      if (nextSemanticSignature && nextSemanticSignature === prevSemanticSignature) {
        this._lastDraftJSON = prevDraftRaw || this._lastDraftJSON;
        this._lastDraftSemanticSignature = nextSemanticSignature;
        if (this._draftDirtyQids) this._draftDirtyQids.clear();
        return;
      }

      const nextJson: any = JSON.stringify(payload);
      if (nextJson === this._lastDraftJSON) return;
      try {
        sessionStorage.setItem(key, nextJson);
      } catch (e: any) {
        surveyLog.warn('SurveyTool: draft persistence failed', e);
        return;
      }

      // SQM compat mirror under :questions (without :q:<qid>) for tooling/tests
      if (persistWritePlan.compatWriteKey) {
        try {
          sessionStorage.setItem(persistWritePlan.compatWriteKey, nextJson);
        } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      }

      const writeTracking: any = buildPersistedDraftTrackingAfterWrite({
        key,
        raw: nextJson,
        payload,
        semanticSignature: nextSemanticSignature,
      });
      this._applyDraftTrackingState(writeTracking);
      if (this._draftDirtyQids) this._draftDirtyQids.clear();

      persistWritePlan.staleAnonKeys.forEach((draftKey: any) => {
        try { sessionStorage.removeItem(draftKey); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      });
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  });

  clearDraft = () => {
    try {
      const draftContext: any = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;

      const surveyScope: any = this._getDraftScope();
      const accountLower: any = (this.props?.account || '').toLowerCase() || 'anon';
      const { purgeKeys }: any = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
      });

      purgeKeys.forEach((k: any) => { try { sessionStorage.removeItem(k); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); } });

      const clearedTracking: any = buildPersistedDraftTrackingClearedState();
      this._applyDraftTrackingState(clearedTracking);
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };


  clearDraftFor = (qid: any) => {
    try {
      const draftContext: any = resolveDraftStorageContext(this.props, this._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;

      const surveyScope: any = this._getDraftScope();
      const accountLower: any = (this.props?.account || '').toLowerCase() || 'anon';
      const qidLower: any = (qid || '').toLowerCase();
      const { purgeKeys }: any = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: qidLower,
        includePerQuestionScope: !!this.props.singleQuestionMode,
      });

      purgeKeys.forEach((key: any) => {
        try {
          const raw: any = sessionStorage.getItem(key);
          if (!raw) return;
          const removalPlan: any = buildPersistedDraftQuestionRemovalPlan({
            raw,
            questionId: qidLower,
            buildSemanticSignature: buildSurveyDraftSemanticSignature,
          });
          if (removalPlan.action === 'delete-storage') {
            try { sessionStorage.removeItem(key); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
            const deleteTracking: any = buildPersistedDraftTrackingAfterScopedDelete({
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
              const writeTracking: any = buildPersistedDraftTrackingAfterWrite({
                key,
                raw: removalPlan.nextJson,
                payload: removalPlan.nextPayload,
                semanticSignature: removalPlan.nextSemanticSignature,
              });
              this._applyDraftTrackingState(writeTracking);
          }
        } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      });
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };



  getCurrentRenderedQuestionIds = () => {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.getCurrentRenderedQuestionIds === 'function') {
      return runtimeStrategy.getCurrentRenderedQuestionIds(this);
    }
    const questionPool: any = Array.isArray(this.state?.questionPool) ? this.state.questionPool : [];
    const pileQuestions: any = Array.isArray(this.state?.pileQuestions) ? this.state.pileQuestions : [];
    const singleQuestionMode: any = !!this.props.singleQuestionMode;
    const questionId: any = String(this.props.questionID || '');
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

    let renderedIds: any = [];
    try {
      renderedIds = buildRenderedQuestionIdsFromQuestionPools({
        questionPool,
        pileQuestions,
      });
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
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
    return readRenderedQuestionIds({
      getRenderedQuestionIds: () => this.getCurrentRenderedQuestionIds(),
      normalizeRenderedIds: buildNormalizedRenderedQuestionIds,
    });
  };

  buildLocalCacheHydrationSignature = (surveyIndex: any, renderedIds: any = []) => {
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
        resolveResponseHydrationContext: (rawSlug: any) => resolveResponseHydrationContext(this.props, rawSlug),
        normalizeSessionSlugValue,
        getExtraScopeSlugs: (slug: any) => getExtraQuestionReadSlugs(this.props, slug),
      });
    } catch (_: any) {
      return '';
    }
  };

  getRenderedQuestionIdsForResponseHydration = () => {
    return readRenderedQuestionIds({
      getRenderedQuestionIds: () => this.getCurrentRenderedQuestionIds(),
      normalizeRenderedIds: buildNormalizedRenderedQuestionIds,
    });
  };

  resolveQuestionSlugMapForIds = (questionIds: any = [], opts: any = {}) => {
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

  resolveSubmissionGroupContext = ({ questionIds = [], surveyId = null, fallbackSlug = null }: any = {}) => {
    return buildSubmissionGroupContext({
      questionIds,
      slugByQuestionId: this.resolveQuestionSlugMapForIds(questionIds, { surveyId }),
      fallbackSlug: fallbackSlug != null ? fallbackSlug : resolveEffectiveSlug(this.props),
      normalizeSlug: normalizeSessionSlugValue,
    });
  };

  getMissingRenderedResponseIdsForAccount = async (opts: any = {}) => {
    const fallbackSlug: any = resolveEffectiveSlug(this.props);
    return resolveSurveyMissingRenderedResponseLookup({
      props: this.props,
      responder: opts?.responder || this.props.account,
      slug: opts?.slug ?? this._getEffectiveDraftSlug() ?? fallbackSlug,
      fallbackSlug,
      renderedIds: this.getRenderedQuestionIdsForResponseHydration(),
      resolveResponseHydrationContext: (nextSlug: any) => resolveResponseHydrationContext(this.props, nextSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug: any) => (
        this.props?.minifiedMode === 'pile'
          ? getExtraQuestionReadSlugs(this.props, slug)
          : []
      ),
      resolveQuestionSlugMapForIds: (questionIds: any, context: any) => this.resolveQuestionSlugMapForIds(
        questionIds,
        { surveyId: context?.surveyId || null }
      ),
      resolveScopeNetId: (resolvedSlug: any, entryNetId: any, fallbackNetId: any) => {
        const resolvedContext: any = resolveResponseHydrationContext(this.props, normalizeSessionSlugValue(resolvedSlug));
        return resolvedContext.networkIdStr || entryNetId || fallbackNetId;
      },
      readQuestionsCacheAsync,
      ensureQuestionsNet: ensureQuestionsNet as any,
    });
  };

  ensurePriorResponsesForRenderedIds = async (opts: any = {}) => {
    return executeSurveyPriorResponseBackfill({
      props: this.props,
      state: this.state,
      slug: opts?.slug,
      attemptedSet: this._priorResponseBackfillAttempted,
      getMissingRenderedResponseIdsForAccount: ({ responder, slug: nextSlug }: any) => this.getMissingRenderedResponseIdsForAccount({
        responder,
        slug: nextSlug,
      }),
      setHydratingState: (active: any) => this.setState(buildHydratingPriorResponsesState(active)),
      isMounted: this._isMounted,
      readQuestionsCacheAsync,
      resetLocalCacheMemo: () => {
        // Force the immediate follow-up pass to read the freshly written cache
        // even before parent cache nonces propagate down as props.
        this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
        this._rehydrateLocalCacheLastSig = '';
      },
      triggerRehydrate: () => this.rehydrateLocalCacheAnswersForRenderedIds(),
      onFailure: (error: any) => {
        surveyLog.warn('[SurveyQuestions] Prior-response backfill failed:', error);
      },
      getCurrentInFlight: () => this._priorResponseBackfillInFlight,
      setCurrentInFlight: (value: any) => {
        this._priorResponseBackfillInFlight = value;
      },
    });
  };

  rehydrateDraftForRenderedIds = (forceOverwriteOrOptions: any = false) => {
    const hasOptions: any = (
      forceOverwriteOrOptions &&
      typeof forceOverwriteOrOptions === 'object' &&
      !Array.isArray(forceOverwriteOrOptions)
    );
    const options: any = hasOptions ? forceOverwriteOrOptions : {};
    const forceOverwrite: any = hasOptions
      ? !!options.forceOverwrite
      : !!forceOverwriteOrOptions;
    const setState: any = options.responseHydrationOwned
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
      onError: (error: any) => { surveyLog.warn('SurveyTool: fallback', error); },
      buildDraftRunPlan: (args: any) => buildDraftHydrationRunPlan({
        ...args,
        forceOverwrite,
      }),
    });
  };


  // Reset live form state on account changes (before loading new account data)
  resetFormStateForAccountChange = (callback: any) => {
    executeSurveyFormStateReset({
      props: this.props,
      state: this.state,
      persistDraft: this.persistDraft,
      clearPersistTimer: () => {
        if (this._persistTimer) {
          clearTimeout(this._persistTimer);
          this._persistTimer = null;
        }
      },
      initializeSurveyResponseState: this.initializeSurveyResponseState,
      cloneValue: this.deepClone,
      setState: this.setState.bind(this),
      callback,
      updateSubmittedSinceLastEdit,
      onPersistError: (error: any) => { surveyLog.warn('SurveyTool: fallback', error); },
      onCleanupError: (error: any) => { surveyLog.warn('SurveyTool: cleanup', error); },
    });
  };


  // Edit tracking helpers
  deepClone = (obj: any) => {
    try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
  };

  valuesEqual = (a: any, b: any) => {
    // Normalize empties
    const norm: any = (v: any) => (v === undefined || v === '') ? null : v;

    // Arrays: compare order-sensitive (checkbox order is stable)
    if (Array.isArray(a) || Array.isArray(b)) {
      const aa: any = Array.isArray(a) ? a : [];
      const bb: any = Array.isArray(b) ? b : [];
      if (aa.length !== bb.length) return false;
      return JSON.stringify(aa) === JSON.stringify(bb);
    }

    // Numbers vs strings: compare numerically if either is a number-like
    const an: any = Number(a); const bn: any = Number(b);
    const aNumLike: any = !Number.isNaN(an) && a !== null && a !== '' && typeof a !== 'object';
    const bNumLike: any = !Number.isNaN(bn) && b !== null && b !== '' && typeof b !== 'object';
    if (aNumLike || bNumLike) return Number(a) === Number(b);

    return String(norm(a)) === String(norm(b));
  };

  computeModifiedQuestionsCount = (baselineSlice: any, currentSlice: any) => {
    if (!baselineSlice || !currentSlice) return 0;

    const addNormalizedIds: any = (idsSet: any, source: any) => {
      Object.keys(source || {}).forEach((rawKey: any) => {
        const normalized: any = normalizeQuestionIdKey(rawKey);
        if (normalized) idsSet.add(normalized);
      });
    };
    const pickField: any = (source: any, qid: any) => {
      if (!source || typeof source !== 'object') return {};
      if (source[qid] && typeof source[qid] === 'object') return source[qid];
      const rawKey: any = Object.keys(source).find((k: any) => normalizeQuestionIdKey(k) === qid);
      return (rawKey && source[rawKey] && typeof source[rawKey] === 'object') ? source[rawKey] : {};
    };
    const pickNumber: any = (source: any, qid: any) => {
      if (!source || typeof source !== 'object') return null;
      if (Object.prototype.hasOwnProperty.call(source, qid)) {
        const n: any = Number(source[qid]);
        return Number.isFinite(n) ? n : null;
      }
      const rawKey: any = Object.keys(source).find((k: any) => normalizeQuestionIdKey(k) === qid);
      if (!rawKey) return null;
      const n: any = Number(source[rawKey]);
      return Number.isFinite(n) ? n : null;
    };

    const idsFromSlices: any = new Set();
    addNormalizedIds(idsFromSlices, baselineSlice.answers);
    addNormalizedIds(idsFromSlices, currentSlice.answers);
    addNormalizedIds(idsFromSlices, baselineSlice.additionalComments);
    addNormalizedIds(idsFromSlices, currentSlice.additionalComments);
    addNormalizedIds(idsFromSlices, baselineSlice.importance);
    addNormalizedIds(idsFromSlices, currentSlice.importance);
    addNormalizedIds(idsFromSlices, baselineSlice.conviction);
    addNormalizedIds(idsFromSlices, currentSlice.conviction);

    const scopedIds: any = this.getEditTrackingQuestionIds();
    const ids: any = scopedIds.size > 0 ? new Set(scopedIds) : idsFromSlices;

    let count: any = 0;
    ids.forEach((qId: any) => {
      const bAns: any = pickField(baselineSlice.answers, qId);
      const cAns: any = pickField(currentSlice.answers, qId);
      const bAdd: any = pickField(baselineSlice.additionalComments, qId);
      const cAdd: any = pickField(currentSlice.additionalComments, qId);
      const bImp: any = pickNumber(baselineSlice.importance, qId);
      const cImp: any = pickNumber(currentSlice.importance, qId);
      const bConv: any = pickNumber(baselineSlice.conviction, qId);
      const cConv: any = pickNumber(currentSlice.conviction, qId);

      let changed: any = false;
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
    executeSurveyPendingRevert({
      props: this.props,
      state: this.state,
      buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
      buildSliceFromLocalCache: this.buildSliceFromLocalCache,
      getRenderedQuestionIds: this.getCurrentRenderedQuestionIds,
      cloneFieldState: this.deepClone,
      buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      setState: this.setState.bind(this),
      clearDraft: this.clearDraft,
      recalculateEditStats: this.recalculateEditStats,
      updateJsonPreview: this.updateJsonPreview,
      onFailure: (error: any) => {
        surveyLog.warn('[SurveyQuestions] handleRevertPendingChanges failed:', error);
      },
    });
  };


  // Build baseline/live slice from server response.
  // Sets encrypted: true for any field with prior encryption.
  // Intelligently merges decrypted values from prevSlice if envelope matches.
  buildSliceFromUserAnswers = (userAnswers: any, prevSlice: any = null) => buildHydratedResponseSlice({
    userAnswers,
    prevSlice,
    applyResponseHydrationListToSlice: this._applyResponseHydrationListToSlice,
    parseValue: (value: any) => {
      try {
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          return JSON.parse(value);
        }
      } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      return value;
    },
  });

  resolveDiffBaselineSlice = (allowLocalCache: any = false) => {
    const {
      baselineSlice,
      nextUserAnswersSliceCache,
    }: any = resolveSurveyBaselineSourceSlice({
      editBaseline: this.state.editBaseline,
      allowLocalCache,
      userAnswers: this.state.userAnswers,
      userAnswersSliceCache: this._userAnswersSliceCache,
      buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
      buildSliceFromLocalCache: this.buildSliceFromLocalCache,
    });
    this._userAnswersSliceCache = nextUserAnswersSliceCache;
    return baselineSlice;
  };


  // Prefill multi-question draft from prior survey response.
  // Hydrates encrypted: true for any previously encrypted field.
  // Synchronizes state and baseline cleanly to prevent ghost edits.
  prefillSurveyResponses = (userAnswers: any, options: any = {}) => {
    const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
    const setState: any = options?.responseHydrationOwned
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
    const slice: any = buildSurveyLocalCacheSlice({
      props: this.props,
      rawSlug: this._getEffectiveDraftSlug(),
      renderedIds: this.getCurrentRenderedQuestionIds(),
      localCacheSliceMemo: this._localCacheSliceMemo,
      resolveResponseHydrationContext: (rawSlug: any) => resolveResponseHydrationContext(this.props, rawSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug: any) => getExtraQuestionReadSlugs(this.props, slug),
      readQuestionsCache,
      mergeQuestionResponses,
      parseResponse: (raw: any) => {
        let resp: any = raw;
        try {
          if (typeof resp === 'string') { resp = JSON.parse(resp); }
        } catch { resp = null; }
        return resp;
      },
      applyCachedResponseEntryToSlice: this._applyCachedResponseEntryToSlice,
      setLocalCacheMemo: (nextMemo: any) => {
        this._localCacheSliceMemo = nextMemo;
      },
      onError: (error: any) => {
        DEBUG_PREFILL && surveyLog.error('[Survey][buildSlice] Error:', error);
      },
    });
    if (slice) {
      DEBUG_PREFILL && surveyLog.log('[Survey][buildSlice] Building for rendered IDs:', this.getCurrentRenderedQuestionIds());
    }
    return slice;
  };


  rehydrateLocalCacheAnswersForRenderedIds = async (callback: any = null, options: any = {}) => {
    let finalCallback: any = callback;
    let finalOptions: any = options;
    if (
      callback &&
      typeof callback === 'object' &&
      !Array.isArray(callback)
    ) {
      finalOptions = callback;
      finalCallback = null;
    }
    const setState: any = finalOptions?.responseHydrationOwned
      ? this.setResponseHydrationState.bind(this)
      : this.setState.bind(this);
    const runId: any = (Number(this._localCacheRehydrateRunId) || 0) + 1;
    this._localCacheRehydrateRunId = runId;
    const isStaleRun: any = () => (
      (this._hasMounted && !this._isMounted) ||
      this._localCacheRehydrateRunId !== runId
    );
    await executeSurveyLocalCacheRehydrate({
      props: this.props,
      state: this.state,
      lastHydrationSig: this._rehydrateLocalCacheLastSig,
      getHydrationQuestionIds: () => this.getHydrationQuestionIds(),
      buildHydrationSignature: (idx: any, ids: any) => this.buildLocalCacheHydrationSignature(idx, ids),
      buildSliceFromLocalCache: () => this.buildSliceFromLocalCache(),
      setLastHydrationSig: (value: any) => {
        this._rehydrateLocalCacheLastSig = value;
      },
      loadDraft: () => this.loadDraft(),
      buildDraftAnswersByQuestionId,
      cloneBaseline: this.deepClone,
      buildDraftAwareCacheHydrationState: (args: any) => buildDraftAwareCacheHydrationState({
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
      onError: (error: any) => {
        DEBUG_PREFILL && surveyLog.error('[Survey][rehydrateLocal] Error:', error);
      },
      isStaleRun,
    });
  };


  toggleAutoDecrypt = () => {
    // Guard: auto-decrypt is disabled for wagmi/porto providers
    if (this.isAutoDecryptBlocked()) {
      this.resetBlockedAutoDecryptSweepInternals();
      this.setState(buildAutoDecryptDisabledState());
      return;
    }
    this.setState(
      buildAutoDecryptToggleState,
      () => {
        if (!this.state.autoDecryptEnabled) {
          this._autoDecQueue = [];
          this._autoDecProcessing = false;
          this._autoDecryptMaskedAttemptSignature = {};
          this.clearAutoDecryptSweepScheduling();
          if (Object.keys(this.state.decryptingByKey || {}).length > 0) {
            this.setState(buildClearedDecryptingByKeyState());
          }
          return;
        }
        this.queueAutoDecryptVisibleSweep('toggle-enabled');
      }
    );
  };

  getLatestQuestionResponse = async (responder: any, questionId: any, networkID: any, questionsCache: any) => {
    const slug: any = this._getEffectiveDraftSlug();
    const strNet: any = String(networkID || '');

    let latest: any = null;
    try {
      latest = await (contractScripts as any).getResponse(this.props.provider, responder, questionId, slug);
      if (latest) {
        const addrLower: any = String(responder || '').toLowerCase();

        // Re-read after await to avoid overwriting concurrent cache writes.
        let freshCache: any = ensureQuestionsNet(await readQuestionsCacheAsync(slug), strNet);

        // ensure scaffolding
        freshCache[strNet] = freshCache[strNet] || {};
        freshCache[strNet].questionResponses = freshCache[strNet].questionResponses || {};
        freshCache[strNet].questionResponses[questionId] =
          freshCache[strNet].questionResponses[questionId] || {};
        freshCache[strNet].questionResponsesMeta = freshCache[strNet].questionResponsesMeta || {};
        freshCache[strNet].questionResponsesMeta[questionId] =
          freshCache[strNet].questionResponsesMeta[questionId] || {};

        // Recency guard (only replace if strictly newer by (bn, li))
        const prev: any = freshCache[strNet].questionResponsesMeta[questionId][addrLower] || { bn: 0, li: 0 };
        const bn: any = latest?.blockNumber ?? 0;
        const li: any = latest?.logIndex ?? 0;
        const isStale: any = (bn < prev.bn) || (bn === prev.bn && li <= prev.li);
        if (!isStale) {
          freshCache[strNet].questionResponses[questionId][addrLower] = latest;
          freshCache[strNet].questionResponsesMeta[questionId][addrLower] = { bn, li };
          await writeQuestionsCache(slug, freshCache);
        }
        return latest;
      }
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }

    return latest;
  };



  /** Prefer the latest survey response from chain. */
  getLatestSurveyResponse = async (responder: any, surveyId: any) => {
    try {
      const latest: any = await this.getSurveyResponse(responder, surveyId);
      return latest || null;
    } catch (e: any) {
      return null;
    }
  };


  loadBookmarks = async () => {
    try {
      const slug: any = resolveEffectiveSlug(this.props);
      let obj: any = peekCacheSync('bookmarksCache', slug);
      if (obj == null) {
        obj = await readCache('bookmarksCache', slug);
      }
      if (!obj || typeof obj !== 'object') {
        this.setState(buildBookmarkedQuestionsState());
        return;
      }
      const list: any = Array.isArray(obj?.questions) ? obj.questions : [];
      this.setState(buildBookmarkedQuestionsState(list));
    } catch (error: any) {
      surveyLog.error('[SurveyQuestions] Error reading bookmarksCache:', error);
      this.setState(buildBookmarkedQuestionsState());
    }
  };



  handleBookmarkToggle = (questionId: any) => {
    if (!questionId) return;

    const slug: any = resolveEffectiveSlug(this.props);
    let obj: any = peekCacheSync('bookmarksCache', slug);
    if (!obj || typeof obj !== 'object') obj = {};

    if (typeof obj !== 'object' || obj === null) obj = {};
    if (!Array.isArray(obj.questions)) obj.questions = [];

    const set: any = new Set(obj.questions.map(String));
    const q: any = String(questionId);
    if (set.has(q)) set.delete(q);
    else set.add(q);

    obj.questions = Array.from(set);

    // Update state first for immediate UI feedback
    this.setState(buildBookmarkedQuestionsState(obj.questions));

    void writeCacheOptimistic('bookmarksCache', slug, obj).catch((error: any) => {
      surveyLog.error('[SurveyQuestions] Error saving bookmarksCache:', error);
    });
  };


  /**
   * Return the number of questions changed this session (vs. baseline),
   * not the total number of historical answers. Used by Pile mode for the
   * badge count and to gate submission.
   */
  getAnsweredQuestionsCount = () => {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.getAnsweredQuestionsCount === 'function') {
      return runtimeStrategy.getAnsweredQuestionsCount(this);
    }
    const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);

    if (!this.state.surveysResponseState || !this.state.surveysResponseState[surveyIndex]) {
      return 0;
    }

    const currentSlice: any =
      this.state.surveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

    // Prefer explicit session baseline; else derive from last saved answers; else derive from local cache; else empty
    const baselineSlice: any = this.resolveDiffBaselineSlice(true);

    // Compute how many questions actually changed vs. the baseline
    return this.computeModifiedQuestionsCount(baselineSlice, currentSlice);
  };

  // Centralized recomputation for modifiedCount / hasEncryptedChanges
  recalculateEditStats = (pendingStatsOverride: any = null) => {
    try {
      const stats: any =
        (pendingStatsOverride && typeof pendingStatsOverride === 'object'
          ? pendingStatsOverride
          : null) ||
        (typeof this.getPendingEditStats === 'function' && this.getPendingEditStats()) ||
        { total: this.state.modifiedCount || 0, encrypted: this.state.encryptedModifiedCount || 0 };
      const modifiedCount: any = Number(stats.total || 0);
      const encryptedModifiedCount: any = Number(stats.encrypted || 0);

      const hasEncryptedChanges: any = encryptedModifiedCount > 0;
      const isDirty: any = modifiedCount > 0;

      const shouldResetSubmitted: any = this.state.submissionComplete && modifiedCount > 0;
      const shouldRelatchSubmitted: any =
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
        this.setState(buildEditStatsState({
          modifiedCount,
          encryptedModifiedCount,
          hasEncryptedChanges,
          isDirty,
          shouldResetSubmitted,
          shouldRelatchSubmitted,
        }));
      }
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };



  initializeSurveyResponseState = () => {
    const questionPoolIds: any = Array.isArray(this.props.questionPool)
      ? this.props.questionPool.map((question: any) => question.id)
      : [];
    const renderedQuestionIds: any = buildInitialSurveyResponseQuestionIds({
      singleQuestionMode: this.props.singleQuestionMode,
      isStandalone: this.props.isStandalone,
      questionPoolIds,
      questionId: this.props.questionID,
      getRenderedQuestionIds: () => this.getCurrentRenderedQuestionIds(),
      stateQuestionPool: this.state.questionPool,
    });

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
    if (shouldSurveyAutoStartFresh({
      props: this.props,
      state: this.state,
      getRenderedQuestionIds: () => readRenderedQuestionIds({
        getRenderedQuestionIds: () => this.getCurrentRenderedQuestionIds(),
      }),
    })) {
      this.handleStartFresh();
    }
  };

  getSurveyQuestionPoolLoadState = () => {
    return buildSurveyQuestionPoolLoadState({
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      questionPoolExpectedIds: this.state.questionPoolExpectedIds,
      questionPoolPendingIds: this.state.questionPoolPendingIds,
    });
  };

  showTransientSubmitFeedback = (message: any = '', durationMs: any = 2000) => {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.showTransientSubmitFeedback === 'function') {
      return runtimeStrategy.showTransientSubmitFeedback(this, message, durationMs);
    }
    if (this._emptySubmitTimer) {
      clearTimeout(this._emptySubmitTimer);
      this._emptySubmitTimer = null;
    }
    const update: any = buildTransientSubmitFeedbackState({
      message,
    });
    this.setState(update);
    if (!update.submissionError) return;
    this._emptySubmitTimer = setTimeout(() => {
      if (!this._isMounted) return;
      const clearUpdate: any = buildClearedTransientSubmitFeedbackState();
      this.setState(clearUpdate);
      this._emptySubmitTimer = null;
    }, normalizeTransientSubmitFeedbackDurationMs(durationMs));
  };

  maybeBlockSubmitUntilQuestionPoolComplete = () => {
    const { isIncomplete, pendingCount }: any = this.getSurveyQuestionPoolLoadState();
    if (!isIncomplete) return false;

    this.showTransientSubmitFeedback(buildQuestionPoolPendingSubmitFeedbackMessage({
      pendingCount,
    }));
    void this.fetchQuestionPool().catch((error: any) => {
      surveyLog.warn('SurveyQuestions: submit-triggered question pool refresh failed.', error);
    });
    return true;
  };


  async fetchQuestionPool() {
    if (this.props.isStandalone || this.props.singleQuestionMode) return;
    if (!this.props.surveyId) {
      surveyLog.warn("SurveyQuestions: fetchQuestionPool – no surveyID supplied");
      this.setState(buildClearedSurveyQuestionPoolState());
      return;
    }

    // Prefer ID-aware resolver for /survey/:id routes (no /session/:slug)
    const slug: any = this.props.surveyId
      ? resolveSlugForIds({ surveyId: this.props.surveyId, props: this.props, network: this.props.network })
      : resolveEffectiveSlug(this.props);
    const questionReadContext: any = resolveQuestionReadCacheContext(this.props, slug);
    const effectiveSlug: any = questionReadContext.sessionSlug || slug;
    const netIdStr: any = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error("SurveyQuestions: fetchQuestionPool – network.id undefined");
      this.setState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const surveyIdLower: any = this.props.surveyId.toLowerCase();

    // surveys cache via safe reader (already purges)
    let surveysCache: any = readSurveysCache(effectiveSlug);
    if (!surveysCache || typeof surveysCache !== 'object') surveysCache = {};
    const surveysNet: any = surveysCache[netIdStr] || {
      surveysLatestBlock: 0,
      surveys: {},
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };
    let surveyDataFromCache: any = surveysNet.surveys?.[surveyIdLower];

    let surveyData: any = null;
    if (this.props.surveys && this.props.surveyIndex !== null && this.props.surveys[this.props.surveyIndex]) {
      const surveyFromProp: any = this.props.surveys[this.props.surveyIndex];
      if (surveyFromProp.id && surveyFromProp.id.toLowerCase() === surveyIdLower) {
        surveyData = surveyFromProp;
      }
    }
    if (!surveyData) { surveyData = surveyDataFromCache; }

    if (!surveyData || !Array.isArray(surveyData.questionIDs) || surveyData.questionIDs.length === 0) {
      try {
        surveyData = await (contractScripts as any).getSurveyDataById(this.props.provider, surveyIdLower, effectiveSlug);
        if (surveyData) {
          if (!Array.isArray(surveyData.questionIDs))
            surveyData.questionIDs = [];
          surveyData.surveyID = surveyIdLower;
          surveyData.id       = surveyIdLower;

          let currentGlobalSurveysCache: any = readSurveysCache(effectiveSlug);
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
      } catch (e: any) {
        surveyLog.error("SurveyQuestions: failed to fetch survey from chain:", e);
        surveyData = null;
      }
    }

    if (!surveyData || !Array.isArray(surveyData.questionIDs) || surveyData.questionIDs.length === 0) {
      surveyLog.warn(`SurveyQuestions: survey ${surveyIdLower} still has no questionIDs – aborting pool build`);
      this.setState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const blockedQuestionIds: any = getBlockedQuestionIdsSet(effectiveSlug);
    const expectedQuestionIds: any = surveyData.questionIDs
      .map((qid: any) => normalizeQuestionIdKey(qid))
      .filter((qid: any) => qid && !blockedQuestionIds.has(qid));

    // Pass sessionName context to ensureQuestionCached so it knows where to look.
    // Do not let one failed question fetch abort the entire direct /survey/:id pool load.
    const cacheHydrationResults: any = await Promise.allSettled(
      surveyData.questionIDs.map(async (qid: any) => {
        await this.props.ensureQuestionCached(qid, { sessionName: surveyData.sessionName });
        return qid;
      })
    );
    const failedQuestionHydrations: any = cacheHydrationResults.filter((result: any) => result.status === 'rejected');
    if (failedQuestionHydrations.length > 0) {
      surveyLog.warn(
        `SurveyQuestions: ${failedQuestionHydrations.length} question cache hydration request(s) failed for survey ${surveyIdLower}.`,
        failedQuestionHydrations.map((result: any) => result.reason?.message || result.reason || 'unknown error')
      );
    }

    let questionsCacheFromStorage: any = readQuestionsCache(effectiveSlug) || {};
    const questionsNet: any = questionsCacheFromStorage[netIdStr] || {
      questionsLatestBlock: 0,
      questions: {},
      questionResponses: {},
      questionResponsesLatestBlock: 0,
    };
    const networkQuestions: any = questionsNet.questions || {};

    const questionPool: any = expectedQuestionIds
      .map((qid: any) => {
        const qData: any = networkQuestions[qid];
        if (qData) return { ...qData, id: qData.id.toLowerCase() };
        surveyLog.warn(`SurveyQuestions: Question data for ID ${qid} not found in cache after ensureQuestionCached.`);
        return null;
      })
      .filter(Boolean);
    const loadedQuestionIds: any = new Set(
      questionPool
        .map((question: any) => normalizeQuestionIdKey(question?.id))
        .filter(Boolean)
    );
    const pendingQuestionIds: any = expectedQuestionIds.filter((qid: any) => !loadedQuestionIds.has(qid));

    this.setState((prev: any) => buildFetchedQuestionPoolState(prev, {
      areQuestionPayloadsEquivalent,
      buildQuestionIdScopeSignature,
      expectedQuestionIds,
      normalizeQuestionIdKey,
      onNoop: () => bumpSurveyPerfCounter('noopSkipCount'),
      pendingQuestionIds,
      pickBetterQuestionPayload: pickBetterQuestionPayload as any,
      questionPool,
    }));
	  }


  loadQuestionFromCache = async (questionId: any) => {
    const slug: any = resolveEffectiveSlug(this.props);
    const questionReadContext: any = resolveQuestionReadCacheContext(this.props, slug);
    const effectiveSlug: any = questionReadContext.sessionSlug || slug;
    const netIdStr: any = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error('SurveyQuestions: Network ID undefined in loadQuestionFromCache');
      return null;
    }
    let questionsCache: any = readQuestionsCache(effectiveSlug) || {};
    if (!questionsCache[netIdStr] || !questionsCache[netIdStr].questions) return null;
    const qIdLower: any = questionId.toLowerCase();
    return questionsCache[netIdStr].questions[qIdLower] || null;
  };


  mergeSurveyResponseState = (currentState: any, newQuestionPool: any, surveyIndex: any = 0) => {
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
    const runId: any = (Number(this._fetchSurveyResponseRunId || 0) + 1);
    this._fetchSurveyResponseRunId = runId;
    const isStale: any = () => !this._isMounted || this._fetchSurveyResponseRunId !== runId;
    const safe: any = (...args: any[]) => { if (!isStale()) (this.setResponseHydrationState as any)(...args); };

    safe(buildSurveyResponseFetchLoadingState());

    // 1. View Mode (Address lookup) - Unaffected by submission state
    if (this.props.displayAnswerMode && this.props.viewAddress) {
      try {
        const viewAnswers: any = await this.getLatestSurveyResponse(
          this.props.viewAddress,
          this.props.surveyId
        );
        if (isStale()) return;
        if (viewAnswers) {
          safe((prev: any) => buildViewedSurveyResponseState(
            prev,
            viewAnswers,
            mergeDecryptedViewedResponse as any
          ));
        } else {
          safe(buildViewedSurveyNoResponseState());
        }
      } catch (error: any) {
        surveyLog.error('Error fetching survey response:', error);
        if (isStale()) return;
        safe(buildViewedSurveyNoResponseState());
      }
    } else {
      safe(buildViewedSurveyNoResponseState(false));
    }

    // 2. User Account Mode
    if (this.props.account) {
      try {
        const userAnswers: any = await this.getLatestSurveyResponse(
          this.props.account,
          this.props.surveyId
        );
        if (isStale()) return;

        // Consistency check logic
        if (this.state.submissionComplete) {
          const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : (this.props.surveyIndex || 0);
          surveyLog.log("Comparing incoming chain data vs optimistic baseline");

          // Only switch off optimistic mode if chain data matches our submitted baseline
          if (userAnswers && this.areResponsesConsistent(userAnswers, surveyIndex)) {
            surveyLog.log("Result: New. Chain data consistent with submission. Exiting optimistic mode.");
            const hasEncrypted: any = userAnswers.responses?.some(
              (r: any) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion
            );
            safe(buildUserSurveyResponseFoundState({
              hasEncrypted,
              resetSubmissionComplete: true,
              userAnswers,
            }));
            // We do NOT call prefillSurveyResponses here to avoid rebuilding baseline unnecessarily
          } else {
            // Chain is stale or null. Keep optimistic state.
            surveyLog.log("Result: Stale. Chain data older than optimistic baseline. Ignoring fetch.");
          }
        }
        // Normal Path (Not in optimistic mode)
        else if (userAnswers) {
          const hasEncrypted: any = userAnswers.responses?.some(
            (r: any) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion
          );
          safe(buildUserSurveyResponseFoundState({
            hasEncrypted,
            userAnswers,
          }));
          if (!isStale()) {
            this.prefillSurveyResponses(userAnswers, { responseHydrationOwned: true });
          }
        } else {
          // Only reset to "no response" if we aren't holding an optimistic submission
          if (!this.state.submissionComplete) {
            safe(buildUserSurveyResponseMissingState());
          }
        }
      } catch (error: any) {
        surveyLog.error("Error fetching user's survey response:", error);
        if (isStale()) return;
        // On error, if we are optimistic, we just stay optimistic.
        if (!this.state.submissionComplete) {
          safe(buildUserSurveyResponseMissingState());
        }
      }
    }

    safe(buildResponseHydrationInvalidatedState());
  }

  // Prefill single-question draft from prior response.
  // Hydrates encrypted: true for previously encrypted fields.
  // Intelligently merges baseline and preserves un-edited responses cleanly.
  prefillSingleQuestionResponse = (userAnswer: any) => {
    const questionId: any = normalizeQuestionIdKey(this.props.questionID);

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
  parseAnswerValue = (value: any) => {
    try {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        return JSON.parse(value);
      }
    } catch (e: any) {
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
      cloneValue: this.deepClone,
      setState: this.setState.bind(this),
      clearDraftFor: this.clearDraftFor,
      recalculateEditStats: this.recalculateEditStats,
      persistDraftSafely: this.persistDraftSafely,
      updateSubmittedSinceLastEdit,
    });
  };


  async fetchSingleQuestionData(opts: any = {}) {
    const runId: any = (Number(this._fetchSingleQuestionRunId) || 0) + 1;
    this._fetchSingleQuestionRunId = runId;
    const isStaleRun: any = () => !this._isMounted || this._fetchSingleQuestionRunId !== runId;
    const safeSetState: any = (...args: any[]) => {
      if (!isStaleRun()) (this.setResponseHydrationState as any)(...args);
    };
    const bootstrapRetryAttempt: any = Number(opts?.bootstrapRetryAttempt || 0);
    const configuredFetchTimeoutMs: any = Number(opts?.questionFetchTimeoutMs);
    const fetchTimeoutMs: any = Number.isFinite(configuredFetchTimeoutMs) && configuredFetchTimeoutMs > 0
      ? Math.max(3000, configuredFetchTimeoutMs)
      : 8000;
    const configuredFetchRecoveryMs: any = Number(opts?.questionFetchTimeoutRecoveryMs);
    const fetchTimeoutRecoveryMs: any = Number.isFinite(configuredFetchRecoveryMs) && configuredFetchRecoveryMs > 0
      ? Math.max(fetchTimeoutMs, configuredFetchRecoveryMs)
      : Math.max(fetchTimeoutMs, 20000);
    const maxCandidateSlugs: any = Math.max(2, Number(opts?.maxCandidateSlugs || 8));

    const sourceContextPlan: any = buildSingleQuestionSourceRestoreContextPlan({
      bootstrapRetryAttempt,
      getQuestionFetchCandidateSlugs: this.getQuestionFetchCandidateSlugs,
      maxCandidateSlugs,
      pendingRetrySig: this._singleQuestionBootstrapRetrySig,
      props: this.props,
      questionPool: this.state.questionPool,
      runId,
    });
    if (sourceContextPlan.status === 'missing-question-id') {
      this.updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn('SurveyQuestions: No questionID provided in singleQuestionMode.');
      safeSetState(sourceContextPlan.statePatch);
      return;
    }
    const questionId: any = sourceContextPlan.questionId;
    const preserveCurrentSingleQuestionPool: any = (extraState: any = {}) => {
      const plan: any = buildSingleQuestionPreservedPoolState({
        questionId,
        questionPool: this.state.questionPool,
        extraState,
      });
      if (plan.action !== 'preserve') return false;
      safeSetState(plan.statePatch);
      return true;
    };

    if (sourceContextPlan.retryCleanupAction !== 'none') {
      this.clearSingleQuestionBootstrapRetry();
    }
    this.updateSingleQuestionDebug(sourceContextPlan.startDebugPayload);

    let effectiveSingleSlug: any = sourceContextPlan.effectiveSingleSlug;
    const fetchCandidateSlugs: any = sourceContextPlan.fetchCandidateSlugs;
    const hasPendingRetryForQuestion: any = sourceContextPlan.hasPendingRetryForQuestion;

    if (sourceContextPlan.status === 'blocked-question') {
      this.updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn(`SurveyQuestions: Question ${questionId} is blocked; skipping.`);
      safeSetState(sourceContextPlan.statePatch);
      return;
    }

    const responderAddress: any = this.props.responderAddress;

    const getCacheStateForSlug: any = async (slug: any) => resolveSingleQuestionCacheState({
      slug,
      questionId,
      resolveQuestionBootstrapContext: (nextSlug: any) => resolveQuestionBootstrapContext(this.props, nextSlug),
      readQuestionsCacheAsync,
      ensureQuestionsNet: ensureQuestionsNet as any,
    });

    const cacheBootstrapResult: any = await resolveSingleQuestionCacheBootstrap({
      questionId,
      effectiveSingleSlug,
      responderAddress: String(responderAddress || ''),
      account: String(this.props.account || ''),
      resolveCacheState: getCacheStateForSlug,
      readRecentPayload: readRecentQuestionPayload,
      canUseRecentPayload: canUseRecentQuestionPayloadForAccount,
      resolveBootstrapNetworkId: (slug: any) => resolveQuestionBootstrapContext(this.props, slug).networkIdStr || '',
      updateCacheAtomic,
      ensureQuestionsNet: ensureQuestionsNet as any,
      pickBetterQuestionPayload: pickBetterQuestionPayload as any,
      areQuestionPayloadsEquivalent,
      writeQuestionsCache: writeQuestionsCache as any,
    });
    if (isStaleRun()) return;

    const cacheBootstrapPlan: any = resolveSingleQuestionCacheBootstrapFlowPlan({ cacheBootstrapResult });
    if (cacheBootstrapPlan.seededHydration) {
      const { questionData: seededQData, isLoadingResponse }: any = cacheBootstrapPlan.seededHydration;
      this.setResponseHydrationState(
        (prev: any) => buildSingleQuestionSeededHydrationState({
          prevState: prev,
          questionData: seededQData,
          isLoadingResponse,
          mergeSurveyResponseState: this.mergeSurveyResponseState,
        }),
        () => {
          this.updateJsonPreview();
          this.rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
        }
      );
    }
    if (isStaleRun()) return;

    if (cacheBootstrapPlan.action === 'stop') {
      const stopPlanContext: any = {
        bootstrapRetryAttempt,
        cacheBootstrapPlan,
        effectiveSingleSlug: cacheBootstrapResult.target.effectiveSingleSlug,
        questionId: cacheBootstrapResult.target.questionId,
        responderAddress: cacheBootstrapResult.target.responderAddress,
        runId,
      };
      const stopHandlingPlan: any = resolveSingleQuestionCacheBootstrapStopHandlingPlan(stopPlanContext);
      if (stopHandlingPlan.action === 'retry') {
        const didScheduleRetry: any = this.scheduleSingleQuestionBootstrapRetry(stopHandlingPlan.retryRequest);
        const retryOutcome: any = (resolveSingleQuestionCacheBootstrapStopHandlingPlan({
          ...stopPlanContext,
          didScheduleRetry,
        } as any) as any).retryOutcome;
        if (retryOutcome?.debugPayload) {
          this.updateSingleQuestionDebug(retryOutcome.debugPayload);
        }
        if (retryOutcome?.shouldClearRetry) {
          this.clearSingleQuestionBootstrapRetry();
          safeSetState(retryOutcome.exhaustedStatePatch);
        }
        return;
      }

      if (stopHandlingPlan.action === 'fallback') {
        if (stopHandlingPlan.debugPayload) {
          this.updateSingleQuestionDebug(stopHandlingPlan.debugPayload);
        }
        if (stopHandlingPlan.logMissingCacheState) {
          surveyLog.error('SurveyQuestions: Network ID undefined in fetchSingleQuestionData');
        }
        if (stopHandlingPlan.preserveCurrentPoolPatch) {
          if (preserveCurrentSingleQuestionPool(stopHandlingPlan.preserveCurrentPoolPatch)) {
            return;
          }
        }
        if (stopHandlingPlan.shouldApplyFallbackStatePatch) {
          safeSetState(stopHandlingPlan.fallbackStatePatch);
        }
        return;
      }

      return;
    }

    let qData: any = cacheBootstrapPlan.questionData;
    let cacheState: any = cacheBootstrapPlan.cacheState;
    let { netIdStr, questionsCache }: any = cacheState;
    const recentPayloadForAccount: any = cacheBootstrapPlan.recentPayloadForAccount;

    const metadataBootstrapResult: any = await resolveSingleQuestionMetadataBootstrap({
      questionId,
      questionData: qData,
      effectiveSingleSlug,
      cacheState,
      fetchCandidateSlugs,
      fetchTimeoutMs,
      fetchTimeoutRecoveryMs,
      forceRefetch: !!opts.forceQuestionMetadataRefetch,
      loginComplete: !!this.props.loginComplete,
      hasAccount: !!this.props.account,
      isMaskedQuestionPayload,
      fetchSingleQuestionMetadataCandidates: (args: any) => fetchSingleQuestionMetadataCandidates({
        ...args,
        getQuestionData: (candidateSlug: any) => (contractScripts as any).getQuestionData(
          this.props.provider,
          questionId,
          candidateSlug,
          this.buildAutomaticQuestionMetadataFetchOptions(candidateSlug)
        ),
      }),
      pickBetterQuestionPayload: pickBetterQuestionPayload as any,
      areQuestionPayloadsEquivalent,
      normalizeSingleQuestionMetadataForCache,
      resolveCacheState: getCacheStateForSlug,
      writeQuestionsCache: writeQuestionsCache as any,
    });
    if (isStaleRun()) return;

    if (metadataBootstrapResult.status === 'missing-cache-state') {
      if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
        return;
      }
      safeSetState(buildSingleQuestionPoolFallbackState());
      return;
    }

    if (metadataBootstrapResult.status === 'unavailable') {
      surveyLog.warn(
        `SurveyQuestions: No question data for ${questionId} (slug='${metadataBootstrapResult.effectiveSingleSlug}').`
      );
      const didScheduleRetry: any = this.scheduleSingleQuestionBootstrapRetry({
        questionId,
        attempt: bootstrapRetryAttempt,
        reason: metadataBootstrapResult.retryReason,
      });
      this.updateSingleQuestionDebug({
        phase: 'question-data-unavailable',
        runId,
        questionId,
        effectiveSingleSlug: String(metadataBootstrapResult.effectiveSingleSlug || ''),
        fetchedAny: !!metadataBootstrapResult.fetchedAny,
        timedOutFetchCount: Number(metadataBootstrapResult.timedOutFetchCount || 0),
        didScheduleRetry: !!didScheduleRetry,
        retryAttempt: bootstrapRetryAttempt,
      });
      const placeholderQuestion: any = buildSingleQuestionEncryptedMetadataPlaceholder({
        questionId,
        sessionSlug: metadataBootstrapResult.effectiveSingleSlug || effectiveSingleSlug,
        existingQuestionData: qData || recentPayloadForAccount || null,
      });
      if (placeholderQuestion) {
        safeSetState((prev: any) => buildSingleQuestionPlaceholderHydrationState(prev, {
          mergeSurveyResponseState: this.mergeSurveyResponseState,
          placeholderQuestion,
        }));
        return;
      }
      if (didScheduleRetry) {
        safeSetState(buildSingleQuestionRetryLoadingState());
        return;
      }
      if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
        return;
      }
      safeSetState(buildSingleQuestionPoolFallbackState());
      return;
    }

    // 'ready' or 'skipped' — extract resolved data
    qData = metadataBootstrapResult.questionData;
    if (metadataBootstrapResult.status === 'ready') {
      effectiveSingleSlug = metadataBootstrapResult.effectiveSingleSlug;
      cacheState = metadataBootstrapResult.cacheState;
      ({ netIdStr, questionsCache } = cacheState);
    }

    if (isStaleRun()) return;
    if (!hasPendingRetryForQuestion || bootstrapRetryAttempt > 0) {
      this.clearSingleQuestionBootstrapRetry();
    }

    // Build pool and merge state before fetching responses
    if (isStaleRun()) return;
    this.setResponseHydrationState(
      (prev: any) => buildSingleQuestionReadyHydrationState(prev, {
        mergeSurveyResponseState: this.mergeSurveyResponseState,
        questionData: qData,
      }),
      async () => {
        if (isStaleRun()) return;
        const writeRespToCache: any = async (responder: any, respObj: any) => writeSingleQuestionResponseToCache({
          responder,
          respObj,
          questionId,
          effectiveSingleSlug,
          netIdStr,
          readQuestionsCacheAsync,
          ensureQuestionsNet: ensureQuestionsNet as any,
          writeQuestionsCache: writeQuestionsCache as any,
        });

        const readCachedResponderResponse: any = (responder: any) => readSingleQuestionCachedResponderResponse({
          responder,
          questionId,
          netIdStr,
          questionsCache,
          cloneValue: this.deepClone,
        });

        const readFreshCachedResponderResponse: any = async (responder: any) => (
          readFreshSingleQuestionCachedResponderResponse({
            responder,
            questionId,
            netIdStr,
            effectiveSingleSlug,
            readQuestionsCacheAsync,
            ensureQuestionsNet: ensureQuestionsNet as any,
            cloneValue: this.deepClone,
            updateQuestionsCache: (nextCache: any) => {
              questionsCache = nextCache;
            },
          })
        );

        // Fetch latest response for the appropriate address, scoped to this slug
        if (responderAddress) {
          const viewedBootstrapResult: any = await executeViewedSingleQuestionResponseBootstrap({
            props: this.props,
            state: this.state,
            questionId,
            responderAddress,
            effectiveSingleSlug,
            bootstrapRetryAttempt,
            runId,
            isStaleRun,
            safeSetState,
            updateSingleQuestionDebug: this.updateSingleQuestionDebug,
            normalizeViewedResponse: this.normalizeSingleQuestionViewedResponse,
            mergeViewedResponse: mergeDecryptedViewedResponse as any,
            scheduleRetry: this.scheduleSingleQuestionBootstrapRetry,
            clearRetry: this.clearSingleQuestionBootstrapRetry,
            getResponse: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
              forceArweaveFetch = false,
            }: any) => (contractScripts as any).getResponse(
              provider,
              nextResponderAddress,
              nextQuestionId,
              nextSingleSlug,
              { forceArweaveFetch }
            ),
            getResponseHash: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
            }: any) => (contractScripts as any).getResponseHash(
              provider,
              nextResponderAddress,
              nextQuestionId,
              nextSingleSlug
            ),
            writeResponseToCache: writeRespToCache,
            readCachedResponderResponse,
            readFreshCachedResponderResponse,
            prefillSingleQuestionResponse: this.prefillSingleQuestionResponse,
          });
          if (
            viewedBootstrapResult?.reason === 'stale'
            || viewedBootstrapResult?.reason === 'retrying'
            || viewedBootstrapResult?.reason === 'malformed'
          ) {
            return;
          }
        } else {
          const ownBootstrapResult: any = await executeOwnSingleQuestionResponseBootstrap({
            props: this.props,
            state: this.state,
            questionId,
            effectiveSingleSlug,
            isStaleRun,
            safeSetState,
            getResponse: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
            }: any) => (contractScripts as any).getResponse(
              provider,
              nextResponderAddress,
              nextQuestionId,
              nextSingleSlug
            ),
            writeResponseToCache: writeRespToCache,
            areResponsesConsistent: this.areResponsesConsistent,
            prefillSingleQuestionResponse: this.prefillSingleQuestionResponse,
          });
          if (ownBootstrapResult?.reason === 'stale') return;
        }

        // Maintain existing preview + local prefill behaviors
        if (isStaleRun()) return;
        this.updateJsonPreview();
        this.rehydrateDraftForRenderedIds();
        this.rehydrateLocalCacheAnswersForRenderedIds();
      }
    );
  }


  resolveDecryptSurveyId = (baselineForDecrypt: any, questionId: any = null) => {
    return (resolveDecryptSurveyIdHelper as any)(baselineForDecrypt, {
      propSurveyId: this.props.surveyId || this.props.surveyID,
      questionId,
      defaultSurveyId: ethers.constants.HashZero,
    });
  };


  async handleDecryptEdit() {
    const decryptContext: any = this.buildDecryptContextSnapshot();
    const decryptAttemptId: any = this.startSurveyDecryptAttempt();
    this.setState(buildDecryptEditStartState());
    const {
      surveyIndex,
      slug,
      fallbackUserAnswers,
      fallbackSourceSlice,
      previousStateSlice,
    }: any = (buildSurveyDecryptAttemptSourceInputsHelper as any)({
      decryptContext,
      state: this.state,
      getEffectiveDraftSlug: () => this._getEffectiveDraftSlug(),
    });

    try {
      const {
        sourceSlice,
        ratingEnvelopesByQid,
        chainId,
        lit,
        opts,
        poolForDecrypt,
      }: any = await this.prepareSurveyDecryptAttempt({
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
      if ((applySurveyDecryptStaleStatusHelper as any)({
        host: this,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;
      const {
        normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      }: any = await this.finalizeSurveyDecryptAttempt({
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
      if ((applySurveyDecryptStaleStatusHelper as any)({
        host: this,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;

      this.finishSurveyDecryptAttempt(decryptAttemptId);
      this.setState((prevState: any) => this.buildSurveyDecryptSuccessState(prevState, {
        surveyIndex,
        decryptedSlice: normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      }), () => {
        const jsonPreview: any = this.prepareJsonAndHash(surveyIndex);
        this.setState(buildJsonPreviewState(jsonPreview));
        this.persistDraftSafely && this.persistDraftSafely(0);
      });
    } catch (error: any) {
      surveyLog.error('Error decrypting answers:', error);
      if ((applySurveyDecryptStaleStatusHelper as any)({
        host: this,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;
      this.finishSurveyDecryptAttempt(decryptAttemptId);
      this.setState(buildDecryptEditFailureState(error.message));
    }
  }


  handleDecryptViewedResponseField = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null) => {
    const decryptContext: any = this.buildDecryptContextSnapshot();
    const taskKey: any = this.buildDecryptTaskKey('viewed', questionId, fieldToDecrypt, responseOverride, decryptContext);
    return this.runDedupedDecryptTask(
      taskKey,
      () => this.handleDecryptViewedResponseFieldInternal(questionId, fieldToDecrypt, responseOverride, decryptContext)
    );
  };

  getViewedResponseOverrideForQuestion = (questionId: any, responseContainer: any = this.state?.parsedViewAddressAnswers) => {
    return (getViewedResponseOverrideForQuestionHelper as any)(
      questionId,
      responseContainer,
      this.props.responderAddress || this.props.viewAddress || '',
    );
  };

  handleDecryptViewedResponseFieldInternal = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null, decryptContext: any = null) => {
    const context: any = decryptContext || this.buildDecryptContextSnapshot();
    let decryptAttemptToken: any = null;
    // Require wallet login (viewer). Decryption is enforced by Lit access control conditions.
    if (!context.loginComplete || !context.account) {
      return false;
    }

    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid || !responseOverride || typeof responseOverride !== 'object') {
      return false;
    }

    try {
      const responderForLatest: any = String(
        responseOverride?.responder ||
        responseOverride?.responderAddress ||
        context.responder ||
        ''
      ).trim();
      const {
        baselineForDecrypt,
        ratingEnvelopes,
      }: any = await this.prepareViewedQuestionDecryptState({
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

      const attemptStatus: any = (startQuestionDecryptAttemptStatusHelper as any)({
        host: this,
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
      });
      if (attemptStatus.shouldReturn) return attemptStatus.result;
      decryptAttemptToken = attemptStatus.decryptAttemptToken;

      const {
        decryptedStateSlice,
        didUpdate,
        decryptedImportance,
        decryptedConviction,
      }: any = await this.finalizeQuestionDecryptAttempt({
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
        ratingEnvelopes,
        account: context.account,
        providerLike: context.provider,
        chainId: attemptStatus.chainId,
        lit: attemptStatus.lit,
        opts: attemptStatus.opts,
      });
      const completionStatus: any = (applyQuestionDecryptCompletionStatusHelper as any)({
        host: this,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        keysToMark: attemptStatus.keysToMark,
        successStateKind: 'viewed',
        successStateOptions: { questionId: qid, clearMode: attemptStatus.clearMode, didUpdate, decryptedStateSlice, decryptedImportance, decryptedConviction },
      });
      if (completionStatus.shouldReturn) return completionStatus.result;

      return didUpdate;
    } catch (error: any) {
      surveyLog.error(`Error decrypting viewed response ${fieldToDecrypt} for ${questionId}`, error);
      return (applyQuestionDecryptFailureStatusHelper as any)({
        host: this,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        error,
      });
    }
  };

  handleDecryptQuestionAnswer = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null) => {
    const decryptContext: any = this.buildDecryptContextSnapshot();
    const taskKey: any = this.buildDecryptTaskKey('self', questionId, fieldToDecrypt, responseOverride, decryptContext);
    return this.runDedupedDecryptTask(
      taskKey,
      () => this.handleDecryptQuestionAnswerInternal(questionId, fieldToDecrypt, responseOverride, decryptContext)
    );
  };

  handleDecryptQuestionAnswerInternal = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null, decryptContext: any = null) => {
    const context: any = decryptContext || this.buildDecryptContextSnapshot();
    let decryptAttemptToken: any = null;
    // Require wallet login
    if (!context.loginComplete || !context.account) {
      return false;
    }

    const surveyIndex: any = context.surveyIndex;

    try {
      // If we're viewing someone else's response (via /question/:id/:responder or /survey/:id?address=),
      // decrypt in-place against the viewed response object (do NOT switch to edit mode).
      const {
        effectiveResponseOverride,
        hasResponseOverride,
        isViewedResponseMode,
      }: any = this.resolveQuestionDecryptHandlingMode({
        questionId,
        responseOverride,
        viewerAccount: context.account,
        viewedResponder: context.responder || '',
      });
      if (isViewedResponseMode) {
        if (!hasResponseOverride) return false;
        return await this.handleDecryptViewedResponseField(
          questionId,
          fieldToDecrypt,
          effectiveResponseOverride
        );
      }

      const {
        baselineSlice,
        baselineForDecrypt,
        ratingEnvelopes: latestRatingEnvs,
      }: any = await this.prepareSelfQuestionDecryptState({
        surveyIndex,
        questionId,
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
        host: this,
        questionId,
        fieldToDecrypt,
        baselineForDecrypt,
      });
      if (attemptStatus.shouldReturn) return attemptStatus.result;
      decryptAttemptToken = attemptStatus.decryptAttemptToken;

      const {
        decryptedStateSlice,
        didUpdate,
        decryptedImportance,
        decryptedConviction,
      }: any = await this.finalizeQuestionDecryptAttempt({
        questionId,
        fieldToDecrypt,
        baselineForDecrypt,
        ratingEnvelopes: latestRatingEnvs,
        account: context.account,
        providerLike: context.provider,
        chainId: attemptStatus.chainId,
        lit: attemptStatus.lit,
        opts: attemptStatus.opts,
      });
      const completionStatus: any = (applyQuestionDecryptCompletionStatusHelper as any)({
        host: this,
        context,
        questionId,
        fieldToDecrypt,
        decryptAttemptToken,
        keysToMark: attemptStatus.keysToMark,
        successStateKind: 'self',
        successStateOptions: { surveyIndex, questionId, clearMode: attemptStatus.clearMode, didUpdate, baselineSlice, decryptedStateSlice, decryptedImportance, decryptedConviction },
        onSuccessStateApplied: () => {
          this.updateJsonPreview && this.updateJsonPreview();
          this.persistDraftSafely && this.persistDraftSafely(0);
        },
      });
      if (completionStatus.shouldReturn) return completionStatus.result;

      return didUpdate;
    } catch (error: any) {
      surveyLog.error(`Error decrypting ${fieldToDecrypt} for ${questionId}`, error);
      return (applyQuestionDecryptFailureStatusHelper as any)({
        host: this,
        context,
        questionId,
        fieldToDecrypt,
        decryptAttemptToken,
        error,
      });
    }
  };



  handleAnswer = (surveyIndex: any, questionId: any, answer: any, options: any = {}) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: any = options?.persistDraft !== false;
    const afterUpdate: any = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;

    const sourceSlice: any =
      this.state.surveysResponseState?.[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const plan: any = buildAnswerUpdatePlan(questionId, answer, sourceSlice, {
      buildEmptyResponseFieldState: ((qid: any, fk: any) => this.buildEmptyResponseFieldState(qid, fk)) as any,
      resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid: any) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => this.getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (val: any, fk: any, f: any) => this.normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: ((af: any, ansf: any, qid: any) => this.buildInheritedAdditionalFieldState(af, ansf, qid)) as any,
      valuesEqual: (a: any, b: any) => this.valuesEqual(a, b),
      getQuestionById: (qid: any) => this.getQuestionById(qid),
      computeHash: (value: any) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState: any = [...(this.state.surveysResponseState || [])];
    const slice: any = { ...sourceSlice };
    slice.answers = {
      ...(slice.answers || {}),
      [questionId]: plan.nextAnswerState,
    };

    if (plan.nextAdditionalState) {
      slice.additionalComments = {
        ...(slice.additionalComments || {}),
        [questionId]: plan.nextAdditionalState,
      };
    }

    newSurveysResponseState[surveyIndex] = slice;

    this.setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit')
    ), () => {
      this.scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) this.persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

  handleAdditional = (surveyIndex: any, questionId: any, additionalComments: any) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;

    const sourceSlice: any =
      this.state.surveysResponseState?.[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const plan: any = buildAdditionalUpdatePlan(questionId, additionalComments, sourceSlice, {
      buildEmptyResponseFieldState: ((qid: any, fk: any) => this.buildEmptyResponseFieldState(qid, fk)) as any,
      resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid: any) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => this.getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (val: any, fk: any, f: any) => this.normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: ((af: any, ansf: any, qid: any) => this.buildInheritedAdditionalFieldState(af, ansf, qid)) as any,
      valuesEqual: (a: any, b: any) => this.valuesEqual(a, b),
      getQuestionById: (qid: any) => this.getQuestionById(qid),
      computeHash: (value: any) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState: any = [...(this.state.surveysResponseState || [])];
    const slice: any = { ...sourceSlice };
    slice.additionalComments = {
      ...(slice.additionalComments || {}),
      [questionId]: plan.nextAdditionalState,
    };

    newSurveysResponseState[surveyIndex] = slice;

    this.setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit')
    ), () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely();
    });
  };

  handleConviction = (surveyIndex: any, questionId: any, conviction: any, options: any = {}) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: any = options?.persistDraft !== false;
    const afterUpdate: any = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue: any = this.state.surveysResponseState?.[surveyIndex]?.conviction?.[questionId];
    if (priorValue === conviction) return;
    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState: any = [...this.state.surveysResponseState];
    const slice: any = { ...(newSurveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
    slice.conviction = { ...(slice.conviction || {}), [questionId]: conviction };
    newSurveysResponseState[surveyIndex] = slice;

    this.setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit')
    ), () => {
      this.scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) this.persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

  handleImportance = (surveyIndex: any, questionId: any, importance: any, options: any = {}) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: any = options?.persistDraft !== false;
    const afterUpdate: any = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue: any = this.state.surveysResponseState?.[surveyIndex]?.importance?.[questionId];
    if (priorValue === importance) return;
    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState: any = [...this.state.surveysResponseState];
    const slice: any = { ...(newSurveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
    slice.importance = { ...(slice.importance || {}), [questionId]: importance };
    newSurveysResponseState[surveyIndex] = slice;

    this.setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit')
    ), () => {
      this.scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) this.persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

  /**
   * Toggle encryption for the main answer field.
   * Signature must remain: (surveyIndex, questionId, newEncryptedState)
   */
  toggleAnswerEncryption = (surveyIndex: any, questionId: any, newEncryptedState: any) => {
    const idx: any = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    this.invalidateDiffCaches();

    this.setState((prev: any) => buildAnswerEncryptionToggleResponseState(prev, {
      buildEncryptionTogglePlan: buildEncryptionTogglePlan as any,
      deps: {
        isQuestionLockedForResponse: (q: any) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => this.normalizeResponseEncryptionAudience(a, q),
      },
      newEncryptedState,
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };



  /**
   * Toggle encryption for the additional comments field.
   * Signature must remain: (surveyIndex, questionId, newEncryptedState)
   */
  toggleAdditionalCommentsEncryption = (surveyIndex: any, questionId: any, newEncryptedState: any) => {
    const idx: any = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    this.invalidateDiffCaches();

    this.setState((prev: any) => buildAdditionalEncryptionToggleResponseState(prev, {
      buildEncryptionTogglePlan: buildEncryptionTogglePlan as any,
      deps: {
        isQuestionLockedForResponse: (q: any) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => this.normalizeResponseEncryptionAudience(a, q),
      },
      newEncryptedState,
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };


  toggleDisplayAnswerMode = () => {
    this.setState(
      buildDisplayAnswerModeToggleState,
      async () => {
        if (this.state.displayAnswerMode) {
          if (this.props.singleQuestionMode && this.props.responderAddress) {
            await this.fetchSingleQuestionData();
          } else if (this.props.viewAddress) {
            await this.fetchSurveyResponse();
          }
        } else {
          this.setState(buildParsedViewAddressAnswersState());
        }
        this.updateJsonPreview();
      }
    );
  };

  handleShowJsonAtBottom = () => {
    if (!this.state.showJson) {
      this.setState(buildShowJsonState(true), () => {
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
      this.setState(buildShowJsonState(true), () => {
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

  getSurveyResponse = async (responderAddress: any, surveyID: any) => {
    // Prefer id-aware group resolution so /survey/:id outside /session still resolves
    const slug: any = resolveSlugForIds({
      surveyId: surveyID,
      props: this.props,
      network: this.props.network,
    });
    const surveyAnswers: any = await (contractScripts as any).getSurveyResponse(
      this.props.provider,
      responderAddress,
      surveyID,
      slug
    );
    return surveyAnswers;
  };

  getSurveyMetadataForJson = (surveyHash: any) => {
    if (!surveyHash) return { surveyTitle: null, sessionName: '' };

    try {
      const slug: any = resolveSlugForIds({
        surveyId: surveyHash,
        props: this.props,
        network: this.props.network,
      });
      const context: any = resolveResponseJsonContext(this.props, slug);
      const netIdStr: any = context.networkIdStr;
      const surveyIdLower: any = String(surveyHash || '').toLowerCase();
      const cacheKey: any = `${String(slug || '')}|${String(netIdStr || '')}|${surveyIdLower}`;
      const surveysCache: any = readSurveysCacheRef(slug) || {};
      if (
        this._surveyJsonMetaCache.key === cacheKey &&
        this._surveyJsonMetaCache.source === surveysCache &&
        this._surveyJsonMetaCache.value
      ) {
        return this._surveyJsonMetaCache.value;
      }

      let surveyTitle: any = null;
      let sessionName: any = '';
      const netBucket: any = netIdStr ? (surveysCache?.[netIdStr] || null) : null;
      const s: any = netBucket?.surveys?.[surveyIdLower];
      if (s?.title) surveyTitle = sanitizeSurveyTitleForResponsePayload(s);
      if (s?.sessionName) sessionName = s.sessionName;
      else if (context.sessionConfig?.sessionName) sessionName = context.sessionConfig.sessionName;

      const value: any = { surveyTitle, sessionName };
      this._surveyJsonMetaCache = { key: cacheKey, source: surveysCache, value };
      return value;
    } catch {
      return { surveyTitle: null, sessionName: '' };
    }
  };


  prepareJsonAndHash = (surveyIndex: any, responderAddress?: any, overrideState: any = null) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    const surveyResponseState: any = overrideState || this.state.surveysResponseState[surveyIndex];
    return buildResponsePayload({
      isStandalone: this.props.isStandalone as any,
      singleQuestionMode: this.props.singleQuestionMode as any,
      surveyId: this.props.surveyId,
      account: responderAddress || this.props.account,
      surveyIndex,
      surveyResponseState,
      questionPool: Array.isArray(this.state.questionPool) ? this.state.questionPool : [],
      pileQuestions: Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [],
      resolveFieldEncryptionAudience: (field: any, qid: any, fieldKey: any) => this.resolveFieldEncryptionAudience(field, qid, fieldKey),
      getQuestionEncryptionGates: (q: any) => this.getQuestionEncryptionGates(q),
      resolveFieldEncryptionGateId: (field: any, qid: any, fieldKey: any) => this.resolveFieldEncryptionGateId(field, qid, fieldKey),
      normalizeFieldAudienceMode: (mode: any, fieldKey: any, field: any) => this.normalizeFieldAudienceMode(mode, fieldKey, field),
      getSurveyMetadataForJson: (hash: any) => this.getSurveyMetadataForJson(hash),
      resolveSessionContext: () => {
        const context: any = resolveResponseJsonContext(this.props, resolveEffectiveSlug(this.props));
        return { sessionName: context.sessionConfig?.sessionName || '' };
      },
      getConvictionFromSlice,
      getImportanceFromSlice,
      sanitizeQuestionPromptForResponsePayload: sanitizeQuestionPromptForResponsePayload as any,
    });
  };


  updateJsonPreview = (force: any = false) => {
    if (!force && !this.isResponseJsonPreviewVisible()) return;
    const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    this.setState(buildJsonPreviewState(this.prepareJsonAndHash(surveyIndex)));
  };

  jsonTreeDisplay = (jsonInput: any) => (
    <SurveyQuestionsJsonTree
      jsonInput={jsonInput}
      onInvalidInput={(...args: any[]) => surveyLog.error(...args)}
    />
  );

  handlePrimarySubmitClick = () => {
    const inFlightPlan: any = buildSurveyQuestionsPrimarySubmitPlan({
      isSubmitting: this.state.isSubmitting,
      submitGuardActive: this._submitGuard,
    });
    if (inFlightPlan.action === 'inert') return;

    const pendingStats: any = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: typeof this.getPendingEditStats === 'function'
        ? () => this.getPendingEditStats()
        : undefined,
      fallbackTotal: this.state.modifiedCount || 0,
    });
    const pendingEditCount: any = pendingStats.total;
    const planBase: any = {
      account: this.props.account,
      draftSlug: '',
      isStandalone: this.props.isStandalone,
      isSubmitting: this.state.isSubmitting,
      pendingEditCount,
      questionID: this.props.questionID,
      singleQuestionMode: this.props.singleQuestionMode,
      submissionComplete: this.state.submissionComplete,
      submitGuardActive: this._submitGuard,
      submittedSinceLastEdit: this.state.submittedSinceLastEdit,
      surveyId: this.props.surveyId,
    };
    let plan: any = buildSurveyQuestionsPrimarySubmitPlan(planBase);
    if (plan.action === 'navigate') {
      plan = buildSurveyQuestionsPrimarySubmitPlan({
        ...planBase,
        draftSlug: this._getEffectiveDraftSlug(),
      });
    }
    if (plan.action === 'inert') return;
    if (plan.action === 'navigate') {
      runSurveyQuestionsSubmitController({
        plan,
        ports: {
          navigateToResponse: (path: any) => window.history.pushState({}, '', path),
        },
      });
      return;
    }
    runSurveyQuestionsSubmitController({
      plan,
      ports: {
        activateSubmitGuard: () => {
          this._submitGuard = true;
        },
        dispatchSubmit: () => {
          this.encryptAndUpload();
        },
      },
    });
  };

  getQuestionsJson = () => {
    return buildSurveyQuestionsJson({
      singleQuestionMode: this.props.singleQuestionMode,
      questionPool: this.state.questionPool,
    });
  };

  getResponseJson = () => {
    const isViewingSubmitted: any = shouldUseSubmittedResponseJson({
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

    const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
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

  copyJsonToClipboard = (json: any, type: any) => {
    let jsonToUse: any = json;

    if (!jsonToUse || (typeof jsonToUse === 'object' && Object.keys(jsonToUse).length === 0)) {
      if (this.props.singleQuestionMode) {
        jsonToUse = this.getResponseJson();
      }
    }

    if (!jsonToUse || (typeof jsonToUse === 'object' && Object.keys(jsonToUse).length === 0 && type !== 'questions' && type !== 'survey')) {
      surveyLog.warn('No valid JSON data to copy for type:', type);
      return;
    }

    const jsonString: any =
      typeof jsonToUse === 'string'
        ? jsonToUse
        : JSON.stringify(jsonToUse, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      notify.success('Copied to clipboard');
      if (type === 'questions') {
        this.setState(buildCopiedQuestionsJsonState(true));
        this.setManagedTimeout(() => {
          this.setState(buildCopiedQuestionsJsonState(false));
        }, 2000);
      } else if (type === 'response') {
        this.setState(buildCopiedResponseJsonState(true));
        this.setManagedTimeout(() => {
          this.setState(buildCopiedResponseJsonState(false));
        }, 2000);
      } else if (type === 'survey') {
        this.setState(buildCopiedSurveyJsonState(true));
        this.setManagedTimeout(() => {
          this.setState(buildCopiedSurveyJsonState(false));
        }, 2000);
      }
    }).catch((error: any) => {
      surveyLog.error('Failed to copy JSON to clipboard:', error);
    });
  };


  toggleShowQuestionsJson = () => {
    this.setState(buildQuestionsJsonToggleState);
  };

  toggleShowResponseJson = () => {
    this.setState(buildResponseJsonToggleState, () => {
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
    this.setState(buildSurveyJsonToggleState);
  };

  getCommentsOpen = (questionId: any, defaultOpen: any = false) => {
    const current: any = this.state?.showComments?.[questionId];
    return typeof current === 'boolean' ? current : !!defaultOpen;
  };

  toggleComments = (questionId: any, defaultOpen: any = false) => {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.toggleComments === 'function') {
      return runtimeStrategy.toggleComments(this, questionId, defaultOpen);
    }
    this.setState((prev: any) => buildCommentsToggleState(prev, questionId, defaultOpen));
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
  }: any) => {
    const qid: any = String(questionId || '').toLowerCase();
    const resolvedFieldKey: any = String(fieldKey || '').trim().toLowerCase() === 'additional'
      ? 'additional'
      : 'answer';
    const fieldState: any = (field && typeof field === 'object') ? field : (answer || {});
    const forcedGate: any = this.isQuestionLockedForResponse(qid);
    const gateOption: any = this.resolveQuestionGateOption(qid);
    const gateOptions: any = Array.isArray(gateOption?.gateDetails) ? gateOption.gateDetails : [];
    const currentAudience: any = this.resolveFieldEncryptionAudience(fieldState, qid, resolvedFieldKey);
    const currentGateId: any = this.resolveFieldEncryptionGateId(fieldState, qid, resolvedFieldKey);
    const currentAudienceMode: any = this.normalizeFieldAudienceMode(
      fieldState?.audienceMode,
      resolvedFieldKey,
      fieldState
    );
    const displayState: any = buildLockAudienceDisplayState({
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
    const menuStateKey: any = displayState.hasAudienceMenu
      ? this.getLockAudienceMenuStateKey(qid, displayState.effectiveFieldKey)
      : '';
    const expandedGateId: any = this.normalizeGateLabelText(
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
  }: any) => {
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
  }: any) => {
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
  }: any) => {
    const action: any = buildLockAudienceButtonAction({
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
  }: any) => {
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
    }: any = this.getLockAudienceDisplayState({
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
    const handleAudienceSelect: any = (audience: any, gateId: any = '') => {
      this.applyLockAudienceSelection({
        surveyIndex,
        qid,
        effectiveFieldKey,
        audience,
        gateId,
      });
    };

    const handleLockClick: any = () => {
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
        onToggleGateDetails={(nextQid: any, gateId: any, nextFieldKey: any) => (
          this.toggleLockAudienceGateDetails(nextQid, gateId, nextFieldKey)
        )}
      />
    );
  };

  renderQuestion = (question: any, qIndex: any, currentSurveyResponseState: any) => {
    if (!currentSurveyResponseState || !currentSurveyResponseState.answers) {
      surveyLog.warn('renderQuestion: currentSurveyResponseState or its answers property is undefined/null. Question ID:', question?.id);
      return null;
    }

    if (!question || !question.id || !question.type) {
      surveyLog.error('Invalid question data at index:', qIndex, question);
      return null;
    }

    const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    const displayState: any = this.getQuestionRenderDisplayState({
      questionId: question.id,
      responseSlice: currentSurveyResponseState,
    });
    const sliderOpen: any = !!this.state.sliderToggleExpandedByQuestion?.[question.id];

    const cardKey: any = `${question.id}-${this.state.decryptionNonce}`;
    const showResponseLookupSpinner: any = shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: this.props.singleQuestionMode,
      isLoadingResponse: this.state.isLoadingResponse,
      account: this.props.account,
      viewAddress: this.props.viewAddress,
      responderAddress: this.props.responderAddress,
    });
    const isQuestionBookmarked: any = this.state.bookmarkedQuestions.has(question.id);

    const cardIcons: any = this.renderFullQuestionCardIcons({
      question,
      showResponseLookupSpinner,
      isQuestionBookmarked,
    });

    // If the prompt is still masked, do not allow answering (prevents nonsense submits).
    // This primarily affects direct-link `/question/:id?...` flows; list views filter these out.
    const promptMasked: any = this.isQuestionPromptMasked(question);
    if (promptMasked) {
      return this.renderQuestionMaskedPromptCard({
        mode: 'full',
        cardKey,
        question,
        cardIcons,
      });
    }

    return renderSurveyQuestionsFullQuestionDisplay({
      cardKey,
      question,
      cardIcons,
      commentsOpen: this.getCommentsOpen(question.id, displayState.hasAdditionalContent),
      displayState,
      onToggleComments: this.toggleComments,
      qIndex,
      renderAdditionalDecryptControl: this.renderQuestionFieldDecryptControl,
      renderAdditionalInput: this.renderFullQuestionAdditionalInput,
      renderAdditionalLockControl: this.renderQuestionAdditionalLockControl,
      renderAnswerDecryptControl: this.renderQuestionFieldDecryptControl,
      renderFullQuestionCardShell: this.renderFullQuestionCardShell,
      renderFullQuestionFooterIcons: this.renderFullQuestionFooterIcons,
      renderFullQuestionSliderSection: this.renderFullQuestionSliderSection,
      renderResponseInput: this.renderFullQuestionResponseInput,
      sliderOpen,
      surveyIndex,
    });
  };


  buildResponseGatePolicyCacheKey = () =>
    buildResponseGatePolicyCacheKeyFromInputs({
      singleQuestionMode: this.props.singleQuestionMode,
      isStandalone: this.props.isStandalone,
      questionID: this.props.questionID,
      surveyId: this.props.surveyId,
      hintedSessionSlug: getSessionSlugHintFromProps(this.props),
      effectiveSessionSlug: resolveEffectiveSlug(this.props),
      networkId: String(this.props.network?.id ?? this.props.networkChainId ?? ''),
    });

  getResponseGatePolicy = () => {
    const cacheKey: any = this.buildResponseGatePolicyCacheKey();
    const isQuestionResponseFlow: any = !!(this.props.singleQuestionMode || this.props.isStandalone);
    const cached: any = this._responseGatePolicyCache;
    const now: any = Date.now();

    let slug: any = '';
    let cfg: any = {};
    let cfgSignature: any = '';

    try {
      const hintedSessionSlug: any = getSessionSlugHintFromProps(this.props);
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
    } catch (_: any) {
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

    let policy: any = null;
    try {
      const fallbackChainId: any = this.resolveSessionChainId(slug, cfg);
      policy = buildResponseGatePolicy({
        cfg,
        isQuestionResponseFlow,
        fallbackChainId,
      });
    } catch (_: any) {
      policy = {
        recipients: [],
        allowFallbackConditions: true,
      };
    }

    this._responseGatePolicyCache = { key: cacheKey, cfgSignature, cfg, value: policy, ts: now };
    return policy;
  };

  getQuestionLookupMap = () => {
    const stateQuestionPool: any = Array.isArray(this.state.questionPool) ? this.state.questionPool : null;
    const statePileQuestions: any = Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : null;
    const propsQuestionPool: any = Array.isArray(this.props.questionPool) ? this.props.questionPool : null;
    const cache: any = this._questionByIdLookupCache;

    if (
      cache &&
      cache.stateQuestionPool === stateQuestionPool &&
      cache.statePileQuestions === statePileQuestions &&
      cache.propsQuestionPool === propsQuestionPool &&
      cache.value
    ) {
      return cache.value;
    }

    const next: any = new Map();
    const addPool: any = (pool: any) => {
      if (!Array.isArray(pool)) return;
      pool.forEach((question: any) => {
        const qid: any = normalizeQuestionIdKey(question?.id);
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

  getQuestionById = (questionId: any) => {
    const qid: any = normalizeQuestionIdKey(questionId);
    if (!qid) return null;
    return this.getQuestionLookupMap().get(qid) || null;
  };

  buildGateAudienceSbtItems = (sbtAddresses: any = [], sessionSlug: any = '') => (
    buildGateAudienceSbtItemsController(sbtAddresses, sessionSlug, {
      resolveSbtGateLabel: (address: any) => this.resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      buildSbtDetailPath,
    })
  );

  getQuestionEncryptionGates = (question: any) => getQuestionEncryptionGatesCore(question);

  normalizeFieldAudienceMode = (value: any, fieldKey: any = 'answer', field: any = {}) =>
    normalizeFieldAudienceModeCore(value, fieldKey, field, hasMeaningfulFieldValue as any);

  getQuestionGateOptions = (questionId: any) => (
    getQuestionGateOptionsController(questionId, {
      getQuestionById: (qid: any) => this.getQuestionById(qid),
      getQuestionEncryptionGates: (question: any) => this.getQuestionEncryptionGates(question),
      buildRecipientsFromGates: (gates: any) => this.buildRecipientsFromGates(gates),
      normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (opts: any = {}) => this.resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate: any = {}, fallbackSbt: any = '') => this.resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (sbtAddresses: any = [], sessionSlug: any = '') => this.buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address: any) => this.resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      normalizeQuestionIdKey,
    })
  );

  getResponseGateOptions = (questionId: any = null) => (
    getResponseGateOptionsController(questionId, {
      normalizeQuestionIdKey,
      isQuestionLockedForResponse: (qid: any) => this.isQuestionLockedForResponse(qid),
      getQuestionGateOptions: (qid: any = null) => this.getQuestionGateOptions(qid),
      getResponseGatePolicy: () => this.getResponseGatePolicy(),
      buildRecipientsFromGates: (gates: any) => this.buildRecipientsFromGates(gates),
      resolveLockAudienceSessionName: () => this.resolveLockAudienceSessionName(),
      resolveConfiguredGateLabel: (opts: any = {}) => this.resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate: any = {}, fallbackSbt: any = '') => this.resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (sbtAddresses: any = [], sessionSlug: any = '') => this.buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address: any) => this.resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      t,
      getEffectiveDraftSlug: typeof this._getEffectiveDraftSlug === 'function'
        ? () => this._getEffectiveDraftSlug()
        : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(this.props),
    })
  );

  getResponseGateOptionById = (questionId: any = null, gateId: any = '') => (
    getResponseGateOptionByIdController(questionId, gateId, {
      normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
      getResponseGateOptions: (qid: any = null) => this.getResponseGateOptions(qid),
    })
  );

  resolveFieldEncryptionGateId = (field: any = {}, questionId: any = null, fieldKey: any = 'answer') => (
    resolveFieldEncryptionGateIdController(field, questionId, fieldKey, {
      resolveFieldEncryptionAudience: (nextField: any, qid: any, fk: any) => this.resolveFieldEncryptionAudience(nextField, qid, fk),
      normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
      getResponseGateOptionById: (qid: any = null, gateId: any = '') => this.getResponseGateOptionById(qid, gateId),
    })
  );

  buildInheritedAdditionalFieldState = (additionalField: any = {}, answerField: any = {}, questionId: any = null) =>
    buildInheritedAdditionalFieldStateCore(additionalField, answerField, questionId, {
      resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionGateId(field, qid, fk),
    });

  getEffectiveRecipientsForField = ({ questionId, fieldKey = 'answer', field = null }: any = {}) => (
    getEffectiveRecipientsForFieldController({ questionId, fieldKey, field }, {
      normalizeQuestionIdKey,
      isQuestionLockedForResponse: (qid: any) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => this.getEffectiveRecipientsForQid(qid),
      resolveFieldEncryptionAudience: (nextField: any, qid: any, fk: any) => this.resolveFieldEncryptionAudience(nextField, qid, fk),
      resolveFieldEncryptionGateId: (nextField: any, qid: any, fk: any) => this.resolveFieldEncryptionGateId(nextField, qid, fk),
      getResponseGateOptionById: (qid: any = null, gateId: any = '') => this.getResponseGateOptionById(qid, gateId),
    })
  );

  resolveGatedPromptGateNames = (question: any) => (
    resolveGatedPromptGateNamesController(question, {
      normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
      resolveGateDisplayLabel: (gate: any = {}, fallbackSbt: any = '') => this.resolveGateDisplayLabel(gate, fallbackSbt),
      getQuestionEncryptionGates: (nextQuestion: any) => this.getQuestionEncryptionGates(nextQuestion),
      getEffectiveDraftSlug: typeof this._getEffectiveDraftSlug === 'function'
        ? () => this._getEffectiveDraftSlug()
        : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(this.props),
      resolveEffectiveResponseGateConfig: (slug: any) => this.resolveEffectiveResponseGateConfig(slug),
    })
  );

  buildRecipientsFromGates = (gates: any = []) => (
    buildRecipientsFromGatesController(gates, {
      resolveSessionChainId: () => this.resolveSessionChainId(),
    })
  );

  isQuestionLockedForResponse = (questionId: any) => {
    const q: any = this.getQuestionById(questionId);
    return this.getQuestionEncryptionGates(q).length > 0;
  };

  getEffectiveRecipientsForQid = (questionId: any) => {
    const q: any = this.getQuestionById(questionId);
    const gates: any = this.getQuestionEncryptionGates(q);
    if (gates.length) return this.buildRecipientsFromGates(gates);
    const policy: any = this.getResponseGatePolicy();
    return Array.isArray(policy?.recipients) ? policy.recipients : [];
  };

  hasDefaultResponseGateRecipients = () => {
    const recipients: any = this.getResponseGatePolicy()?.recipients;
    return Array.isArray(recipients) && recipients.length > 0;
  };

  getDefaultResponseEncryptionAudience = () => (
    this.hasDefaultResponseGateRecipients() ? 'gate' : 'self'
  );

  getDefaultResponseEncryptionAudienceForQid = (questionId: any) => (
    this.isQuestionLockedForResponse(questionId) || this.getEffectiveRecipientsForQid(questionId).length > 0
      ? 'gate'
      : 'self'
  );

  normalizeResponseEncryptionAudience = (value: any, questionId: any = null) =>
    normalizeResponseEncryptionAudienceCore(value, questionId, {
      isQuestionLocked: (qid: any) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => this.getEffectiveRecipientsForQid(qid),
      hasDefaultGateRecipients: () => this.hasDefaultResponseGateRecipients(),
    });

  buildEmptyResponseFieldState = (questionId: any = null, fieldKey: any = 'answer') =>
    buildEmptyResponseFieldStateCore(questionId, fieldKey, {
      getDefaultAudienceForQid: (qid: any) => this.getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => this.getDefaultResponseEncryptionAudience(),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionGateId(field, qid, fk),
      normalizeFieldAudienceMode: (val: any, fk: any, f: any) => this.normalizeFieldAudienceMode(val, fk, f),
    });

  resolveFieldEncryptionAudience = (field: any = {}, questionId: any = null, fieldKey: any = 'answer') =>
    resolveFieldEncryptionAudienceCore(field, questionId, fieldKey, {
      normalizeAudience: (val: any, qid: any) => this.normalizeResponseEncryptionAudience(val, qid),
      getDefaultAudienceForQid: (qid: any) => this.getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => this.getDefaultResponseEncryptionAudience(),
    });

  normalizeGateLabelText = (value: any) => normalizeGateLabelTextCore(value);

  resolveSbtGateLabel = (address: any, preferredSlug: any = '') => {
    const normalizedAddress: any = String(address || '').trim();
    if (!normalizedAddress) return '';
    const slug: any = String(
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
    const policy: any = this.getResponseGatePolicy();
    const questionPools: any = [
      Array.isArray(this.state.questionPool) ? this.state.questionPool : [],
      Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [],
      Array.isArray(this.props.questionPool) ? this.props.questionPool : [],
    ];

    return collectGateSbtAddressesForHydrationFromSources({
      policy,
      questionPools,
      getQuestionEncryptionGates: (question: any) => this.getQuestionEncryptionGates(question),
      isAddress: (value: any) => ethers.utils.isAddress(value),
      getAddress: (value: any) => ethers.utils.getAddress(value),
    });
  };

  hydrateGateSbtLabels = async ({ force = false }: any = {}) => {
    const addresses: any = this.collectGateSbtAddressesForHydration();
    const slug: any = String(
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    ).trim().toLowerCase();
    const cfg: any = this.resolveEffectiveResponseGateConfig(slug);
    const chainId: any = this.resolveSessionChainId(slug, cfg);
    const signature: any = `${slug}|${Number(chainId || 0)}|${addresses.join(',')}`;
    if (!force && signature === this._gateSbtHydrationSig) return;
    this._gateSbtHydrationSig = signature;
    if (!addresses.length) {
      this.clearGateSbtHydrationRetry();
      return;
    }

    try {
      const hits: any = await warmSbtDisplayNamesTargeted({
        addresses,
        preferredSlug: slug,
        metadataLookupConfig: cfg,
        chainId,
        writeBack: true,
      });
      const targetedLookupEnabled: any = isTargetedSbtMetadataLookupEnabled();
      if (!this._isMounted) return;
      const resolvedAddresses: any = new Set(
        (Array.isArray(hits) ? hits : [])
          .map((entry: any) => String(entry?.address || '').trim().toLowerCase())
          .filter(Boolean)
      );
      const hasUnresolvedAddresses: any = addresses.some(
        (address: any) => !resolvedAddresses.has(String(address || '').trim().toLowerCase())
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
      this.setState(buildGateSbtNameRevisionState);
    } catch (_: any) {
      if (!isTargetedSbtMetadataLookupEnabled()) {
        this.clearGateSbtHydrationRetry();
        return;
      }
      this._gateSbtHydrationSig = '';
      this.scheduleGateSbtHydrationRetry();
    }
  };

  buildLockedQuestionGateDetails = (hiddenMaskedQuestionIds: any = []) => {
    const hiddenIds: any = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: any) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (hiddenIds.size === 0) return [];

    const pool: any = this.getLockedQuestionGateSourcePool(hiddenMaskedQuestionIds);
    const slug: any = String(
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    ).trim().toLowerCase();
    const questionGateDetails: any = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds,
      pool,
      slug,
      getQuestionEncryptionGates: (question: any) => this.getQuestionEncryptionGates(question),
      normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (args: any) => this.resolveConfiguredGateLabel(args),
      resolveSbtGateLabel: (address: any, preferredSlug: any = '') => this.resolveSbtGateLabel(address, preferredSlug),
      getShortenedAddress: getShortenedAddress as any,
      buildSbtDetailPath,
      normalizeSessionSlug: normalizeSessionSlugValue,
      getChecksumAddress: (address: any) => (
        ethers.utils.isAddress(address) ? ethers.utils.getAddress(address) : address
      ),
      translate: t,
    });
    if (questionGateDetails.length > 0) return questionGateDetails;
    return this.buildSessionQuestionGateDetails(hiddenIds.size || 1);
  };

  getLockedQuestionGateSourcePool = (hiddenMaskedQuestionIds: any = []) => {
    const hiddenIds: any = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: any) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const candidates: any = [
      Array.isArray(this.state.allQuestionsForFilter) ? this.state.allQuestionsForFilter : [],
      Array.isArray(this.state.questionPool) ? this.state.questionPool : [],
      Array.isArray(this.props.questionPool) ? this.props.questionPool : [],
    ].filter((pool: any) => Array.isArray(pool) && pool.length > 0);

    if (!candidates.length) return [];
    if (hiddenIds.size === 0) return candidates[0];

    const scored: any = candidates.map((pool: any, index: any) => {
      let matchedCount: any = 0;
      let gateCount: any = 0;
      pool.forEach((question: any) => {
        const questionId: any = String(question?.id || '').trim().toLowerCase();
        if (!hiddenIds.has(questionId)) return;
        matchedCount += 1;
        gateCount += this.getQuestionEncryptionGates(question).length;
      });
      return { pool, index, matchedCount, gateCount };
    });

    const matchingPools: any = scored.filter((entry: any) => entry.matchedCount > 0);
    if (!matchingPools.length) return candidates[0];

    matchingPools.sort((a: any, b: any) => (
      (b.gateCount - a.gateCount) ||
      (b.matchedCount - a.matchedCount) ||
      (a.index - b.index)
    ));
    return matchingPools[0].pool;
  };

  getMemoizedLockedQuestionGateDetails = (hiddenMaskedQuestionIds: any = []) => {
    const hiddenIds: any = (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
      .map((qid: any) => String(qid || '').trim().toLowerCase())
      .filter(Boolean);
    const hiddenSignature: any = hiddenIds.join('|');
    const pool: any = this.getLockedQuestionGateSourcePool(hiddenIds);
    const memo: any = this._lockedQuestionGateDetailsMemo || {};
    let poolVersion: any = Number(memo.poolVersion || 0);
    if (memo.poolRef !== pool) {
      poolVersion += 1;
      this._lockedQuestionGateDetailsMemo = {
        ...memo,
        poolRef: pool,
        poolVersion,
      };
    }
    const memoKey: any = [
      hiddenSignature,
      `pool:${poolVersion}`,
      `gateRev:${Number(this.state.gateSbtNameRevision || 0)}`,
    ].join('|');
    if (this._lockedQuestionGateDetailsMemo?.key === memoKey) {
      return this._lockedQuestionGateDetailsMemo.value;
    }
    const nextValue: any = this.buildLockedQuestionGateDetails(hiddenIds);
    this._lockedQuestionGateDetailsMemo = {
      ...this._lockedQuestionGateDetailsMemo,
      key: memoKey,
      value: nextValue,
    };
    return nextValue;
  };

  buildSessionQuestionGateDetails = (questionCount: any = 0) => {
    const count: any = Math.max(1, Number(questionCount || 0) || 1);
    const slug: any = String(
      (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(this.props) ||
      ''
    ).trim().toLowerCase();
    const options: any = this.getResponseGateOptions(null);
    return (Array.isArray(options) ? options : [])
      .map((option: any, index: any) => {
        const sbtAddresses: any = Array.from(new Set(
          (Array.isArray(option?.sbtAddresses) ? option.sbtAddresses : [])
            .map((address: any) => String(address || '').trim())
            .filter(Boolean)
        ));
        if (!sbtAddresses.length) return null;
        const id: any = `session:${option.gateId || index}:${sbtAddresses.map((address: any) => address.toLowerCase()).sort().join('|')}`;
        const sessionSlug: any = slug || normalizeSessionSlugValue(option?.sessionSlug || '');
        return {
          id,
          label: option.label || t('gate'),
          sbtAddresses,
          questionIds: new Set(),
          questionCount: count,
          sessionSlug,
          sbts: sbtAddresses.map((address: any) => ({
            address,
            label: this.resolveSbtGateLabel(address, sessionSlug) || getShortenedAddress(address, false),
            href: buildSbtDetailPath(address, sessionSlug),
          })),
        };
      })
      .filter(Boolean);
  };

  getLockedGateRequirementSentence = (lockedGateDetails: any = []) => (
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
  }: any = {}) => (
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
      onDecrypt={(questionIds: any) => this.reloadMaskedQuestionBatch(questionIds)}
      onToggleDetails={() => this.setState(buildLockedGateDetailsExpandedState)}
    />
  );

  resolveGateDisplayLabel = (gate: any = {}, fallbackSbt: any = '') => (
    resolveGateDisplayLabelController(gate, fallbackSbt, {
      normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
      resolveSbtGateLabel: (address: any) => this.resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      t,
    })
  );

  resolveConfiguredGateLabel = ({ gate = {}, resourceKey = '', sbtAddresses = [] }: any = {}) => (
    resolveConfiguredGateLabelController(
      { gate, resourceKey, sbtAddresses },
      this._responseGatePolicyCache?.cfg,
      {
        normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
        resolveGateDisplayLabel: (configuredGate: any = {}, fallbackSbt: any = '') => (
          this.resolveGateDisplayLabel(configuredGate, fallbackSbt)
        ),
      },
    )
  );

  resolveLockAudienceSessionName = () => (
    resolveLockAudienceSessionNameController({
      normalizeGateLabelText: (value: any) => this.normalizeGateLabelText(value),
      props: this.props,
      responseGatePolicyCacheCfg: this._responseGatePolicyCache?.cfg as any,
      resolveSlugForIds,
      resolveLockAudienceSessionNameContext,
    })
  );

  resolveQuestionGateOption = (questionId: any = null) => {
    const gateDetails: any = this.getResponseGateOptions(questionId);
    if (!gateDetails.length) return null;

    const gateNames: any = Array.from(new Set(gateDetails.map((entry: any) => entry.label).filter(Boolean)));
    const allSbtAddresses: any = Array.from(new Set(gateDetails.flatMap((entry: any) => entry.sbtAddresses || [])));
    const sbtSummary: any = allSbtAddresses.length > 0
      ? allSbtAddresses
        .map((addr: any) => this.resolveSbtGateLabel(addr) || getShortenedAddress(addr, false))
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

  getLockAudienceMenuStateKey = (questionId: any, fieldKey: any = 'answer') => {
    const qid: any = String(questionId || '').toLowerCase();
    if (!qid) return '';
    return String(fieldKey || '').trim().toLowerCase() === 'additional'
      ? `${qid}:additional`
      : qid;
  };

  isLockAudienceMenuOpen = (questionId: any, fieldKey: any = 'answer') => {
    const key: any = this.getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return false;
    return !!(this.state.lockAudienceMenuByQuestion && this.state.lockAudienceMenuByQuestion[key]);
  };

  toggleLockAudienceGateDetails = (questionId: any, forceOpen: any = null, fieldKey: any = 'answer') => {
    const key: any = this.getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    const normalizedGateId: any = this.normalizeGateLabelText(
      typeof forceOpen === 'string' ? forceOpen : ''
    );
    this.setState((prev: any) => buildLockAudienceGateDetailsState(
      prev,
      key,
      forceOpen,
      normalizedGateId,
      this.normalizeGateLabelText
    ));
  };

  toggleLockAudienceMenu = (questionId: any, forceOpen: any = null, fieldKey: any = 'answer') => {
    const key: any = this.getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    this.setState((prev: any) => buildLockAudienceMenuState(prev, key, forceOpen));
  };

  applyAnswerEncryptionAudience = (surveyIndex: any, questionId: any, audience: any, options: any = {}) => {
    const idx: any = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    if (!qid) return;
    this.invalidateDiffCaches();

    this.setState((prev: any) => buildAnswerEncryptionAudienceState(prev, {
      audience,
      buildAnswerAudienceSelectionPlan: buildAnswerAudienceSelectionPlan as any,
      buildSurveyResponseStateArray,
      deps: {
        isQuestionLockedForResponse: (q: any) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => this.normalizeResponseEncryptionAudience(a, q),
      },
      gateId: options?.gateId || '',
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };

  applyAdditionalEncryptionAudience = (surveyIndex: any, questionId: any, audience: any, options: any = {}) => {
    const idx: any = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    if (!qid) return;
    this.invalidateDiffCaches();

    this.setState((prev: any) => buildAdditionalEncryptionAudienceState(prev, {
      audience,
      buildAdditionalAudienceSelectionPlan: buildAdditionalAudienceSelectionPlan as any,
      buildSurveyResponseStateArray,
      deps: {
        isQuestionLockedForResponse: (q: any) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => this.normalizeResponseEncryptionAudience(a, q),
      },
      gateId: options?.gateId || '',
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };

  buildLitEncryptionOptionsForRecipients = (recipients: any = []) => {
    const list: any = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
    if (!list.length) return undefined;

    const litHooks: any =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    if (!litHooks || typeof litHooks.saveKey !== 'function') {
      return undefined;
    }

    const first: any = list[0] || {};
    if (!first.accessControlConditions || !first.chain) return undefined;

    const out: any = {
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

  buildFieldEncryptionWorkGroups = (slice: any = {}, changedQids: any = new Set()) => {
    return buildFieldEncryptionWorkGroupsCore(slice, changedQids, {
      isQuestionLockedForResponse: (q: any) => this.isQuestionLockedForResponse(q),
      resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => this.resolveFieldEncryptionGateId(f, q, fk),
      resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => this.resolveFieldEncryptionAudience(f, q, fk),
      getEffectiveRecipientsForField: ((opts: any) => this.getEffectiveRecipientsForField(opts)) as any,
    });
  };

  encryptFieldWorkGroups = async ({ workGroups = [], baseOpts = {} }: any = {}) => {
    const encState: any = { answers: {}, additionalComments: {} };
    const list: any = Array.isArray(workGroups) ? workGroups : [];

    for (const group of list) {
      const hasSliceWork: any =
        Object.keys(group?.slice?.answers || {}).length > 0 ||
        Object.keys(group?.slice?.additionalComments || {}).length > 0;
      if (!hasSliceWork || !Array.isArray(group?.qids) || group.qids.length === 0) {
        continue;
      }

      let partial: any = null;
      if (Array.isArray(group.recipients) && group.recipients.length > 0) {
        const lit: any = this.buildLitEncryptionOptionsForRecipients(group.recipients);
        if (!lit) {
          throw new Error('Lit hooks unavailable; cannot encrypt gated responses.');
        }
        // eslint-disable-next-line no-await-in-loop
        partial = await (cryptoUtils as any).encryptMultipleAnswers(group.slice, {
          ...baseOpts,
          onlyTheseQids: group.qids,
          lit,
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        partial = await (cryptoUtils as any).encryptMultipleAnswers(group.slice, {
          ...baseOpts,
          onlyTheseQids: group.qids,
        });
      }

      Object.assign(encState.answers, partial?.answers || {});
      Object.assign(encState.additionalComments, partial?.additionalComments || {});
    }

    return encState;
  };

  buildSubmitContextSnapshot = () => {
    const singleQuestionMode: any = !!this.props.singleQuestionMode;
    const isStandalone: any = !!this.props.isStandalone;
    const surveyIndex: any = singleQuestionMode || isStandalone ? 0 : (this.props.surveyIndex || 0);
    const effectiveDraftSlug: any = normalizeSessionSlugValue(
      this._getEffectiveDraftSlug
        ? this._getEffectiveDraftSlug()
        : resolveEffectiveSlug(this.props)
    );

    return {
      props: this.props,
      account: this.props.account || '',
      provider: this.props.provider,
      providerKind: String((cryptoUtils as any).getProviderKind(this.props.provider) || '').trim().toLowerCase(),
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

  buildSubmitContextKey = (snapshot: any = null) => {
    const context: any = snapshot || this.buildSubmitContextSnapshot();
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

  isSubmitContextCurrent = (snapshot: any = null) => (
    !!snapshot &&
    (!snapshot.mounted || this._isMounted) &&
    this.buildSubmitContextKey(snapshot) === this.buildSubmitContextKey()
  );

  startSubmitAttempt = () => {
    const attemptId: any = (Number(this._submitAttemptSeq) || 0) + 1;
    this._submitAttemptSeq = attemptId;
    this._activeSubmitAttemptSeq = attemptId;
    return attemptId;
  };

  finishSubmitAttempt = (attemptId: any = null) => {
    if (Number(attemptId || 0) > 0 && this._activeSubmitAttemptSeq === attemptId) {
      this._activeSubmitAttemptSeq = 0;
    }
  };

  handleStaleSubmitContext = (snapshot: any = null) => {
    runSurveyQuestionsStaleSubmitController({
      snapshot,
      ports: {
        clearSubmitGuard: () => {
          this._submitGuard = false;
        },
        canUpdateSubmitState: (currentSnapshot: any) => this.canUpdateStateForAsyncSnapshot(currentSnapshot),
        isSubmitAttemptActive: (_submitAttemptId: any, currentSnapshot: any) => (
          this._activeSubmitAttemptSeq ===
          (currentSnapshot as { submitAttemptId?: unknown } | null | undefined)?.submitAttemptId
        ),
        finishSubmitAttempt: (submitAttemptId: any) => this.finishSubmitAttempt(submitAttemptId),
        setSubmitStaleState: (statePatch: any) => this.setState(statePatch),
      },
    });
  };

  encryptAndUpload = async () => {
    let submitContext: any = null;
    try {
      if (!this.props.loginComplete) {
        this._submitGuard = false;
        this.props.toggleLoginModal(true);
        return;
      }

      const answeredCount: any = this.getAnsweredQuestionsCount();
      if (answeredCount === 0) {
        this._submitGuard = false;
        this.setState(buildSubmissionErrorState('No responses to submit.'));
        if (this._emptySubmitTimer) {
          clearTimeout(this._emptySubmitTimer);
        }
        this._emptySubmitTimer = setTimeout(() => {
          this.setState(buildSubmissionErrorState(''));
          this._emptySubmitTimer = null;
        }, 2000);
        return;
      }

      if (this.maybeBlockSubmitUntilQuestionPoolComplete()) {
        this._submitGuard = false;
        return;
      }

      submitContext = this.buildSubmitContextSnapshot();
      const startResult: any = runSurveyQuestionsSubmitStartController({
        ports: {
          startSubmitAttempt: () => this.startSubmitAttempt(),
          setSubmitStartState: (statePatch: any) => this.setState(statePatch),
        },
      });
      submitContext.submitAttemptId = startResult.submitAttemptId;

      const providerKind: any = (cryptoUtils as any).getProviderKind(submitContext.provider);

      // Compute changed set once (used for encrypt + submit)
      const surveyIndex: any = submitContext.surveyIndex;
      const { changedQids }: any = this.getChangedQidsAndFields(surveyIndex);

      // Local state tracker to ensure baseline syncs with encrypted data even if React is slow
      let activeSlice: any = this.state.surveysResponseState?.[surveyIndex] || { answers: {}, additionalComments: {}, importance: {}, conviction: {} };

      // Only encrypt when there are changed encrypted fields
      const pendingStats: any = resolveSurveyQuestionsSubmitPendingStats({
        getPendingEditStats: typeof this.getPendingEditStats === 'function'
          ? () => this.getPendingEditStats()
          : undefined,
        fallbackTotal: this.state.modifiedCount || 0,
        fallbackEncrypted: this.state.hasEncryptedChanges ? 1 : 0,
      });
      const shouldEncrypt: any = Number(pendingStats.encrypted || 0) > 0 && changedQids.size > 0;

      if (shouldEncrypt) {
        const {
          groups: workGroups,
          missingRecipients,
        }: any = this.buildFieldEncryptionWorkGroups(activeSlice, changedQids);
        const hasWork: any = workGroups.some((group: any) => (
          Object.keys(group?.slice?.answers || {}).length > 0 ||
          Object.keys(group?.slice?.additionalComments || {}).length > 0
        ));

        if (hasWork) {
        if (missingRecipients.length > 0) {
          throw new Error(`Missing Lit recipients for gated field(s): ${missingRecipients.join(', ')}`);
        }
          const surveyId: any = submitContext.singleQuestionMode ? ethers.constants.HashZero : submitContext.surveyId;
          const poolForCommit: any =
            (Array.isArray(this.state.questionPool) && this.state.questionPool.length > 0)
              ? this.state.questionPool
              : (Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : []);
          const encState: any = await this.encryptFieldWorkGroups({
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
          const newArr: any = [...this.state.surveysResponseState];
          const base: any = { ...(newArr[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };

          Object.keys(encState.answers || {}).forEach((qid: any) => {
            base.answers = { ...(base.answers || {}) };
            base.answers[qid] = { ...(base.answers[qid] || {}), ...(encState.answers[qid] || {}) };
          });
          Object.keys(encState.additionalComments || {}).forEach((qid: any) => {
            base.additionalComments = { ...(base.additionalComments || {}) };
            base.additionalComments[qid] = { ...(base.additionalComments[qid] || {}), ...(encState.additionalComments[qid] || {}) };
          });

          // Update local tracker AND React state
          activeSlice = base;
          newArr[surveyIndex] = base;
          this.setState(buildSurveysResponseStatePatch(newArr));

          // Verify against the freshly merged slice instead of immediately rereading
          // `this.state`, which can still hold the pre-encryption draft until React
          // flushes the async class-state update.
          await this.verifyEncryption(changedQids, base);
        }
      }

      this.setState(buildCurrentStepState(2));

      // Await the receipt to ensure transaction is confirmed before optimistic update
      const receipt: any = await this.submitSurveyResponse(activeSlice, changedQids, submitContext);
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
        Array.from(changedQids).forEach((qid: any) => this.clearDraftFor && this.clearDraftFor(String(qid)));
      } catch (_: any) {
        if (this.props.singleQuestionMode && this.props.questionID) {
          this.clearDraftFor(this.props.questionID.toLowerCase());
        } else {
          this.clearDraft();
        }
      }

      // 3. Compute responder URL for post-submit UI
      const submittedCacheSlug: any = normalizeSessionSlugValue(
        receipt?.__ceSubmissionGroupKey != null
          ? receipt.__ceSubmissionGroupKey
          : submitContext.effectiveDraftSlug
      );
      const responseUrl: any = resolveSurveyQuestionsSubmittedResponseUrl({
        account: submitContext.account,
        currentPathname: window.location.pathname,
        isStandalone: submitContext.isStandalone,
        logWarn: (message: any, error: any) => surveyLog.warn(message, error),
        questionID: submitContext.questionID,
        singleQuestionMode: submitContext.singleQuestionMode,
        submissionSlug: submittedCacheSlug,
        surveyId: submitContext.surveyId,
      });

      // 4. UPDATE BASELINE & OPTIMISTIC STATE
      surveyLog.log("Setting new Baseline");

      // Ensure surveysResponseState and editBaseline are mathematically identical
      // We clone activeSlice (which holds the final encrypted/plaintext state)
      const finalSlice: any = this.deepClone(activeSlice);
      const nextBaseline: any = this.deepClone(finalSlice);

      // Construct the explicit new state array to prevent any diff artifacts
      const nextSurveysResponseState: any = [...this.state.surveysResponseState];
      nextSurveysResponseState[surveyIndex] = finalSlice;

      // Regression guard: the encrypted merge above is a class setState, so
      // build optimistic JSON from the known final slice instead of this.state.
      const optimisticUserAnswers: any = this.prepareJsonAndHash(surveyIndex, undefined, finalSlice);

      // Check encryption status from the new baseline
      const hasEncrypted: any = Object.values(nextBaseline.answers || {}).some((a: any) => !!a.encrypted) ||
                           Object.values(nextBaseline.additionalComments || {}).some((a: any) => !!a.encrypted);
      this.invalidateDiffCaches();
      this._userAnswersSliceCache = { source: null, value: null };

      runSurveyQuestionsSubmitSuccessController({
        editBaseline: nextBaseline,
        hasEncrypted,
        responseUrl,
        submittedSinceLastEdit: this.state.submittedSinceLastEdit,
        submitAttemptId: submitContext.submitAttemptId,
        surveysResponseState: nextSurveysResponseState,
        userAnswers: optimisticUserAnswers,
        ports: {
          clearSubmitGuard: () => {
            this._submitGuard = false;
          },
          finishSubmitAttempt: (submitAttemptId: any) => this.finishSubmitAttempt(submitAttemptId),
          setSubmitSuccessState: (statePatch: any, afterStateApplied: any) => this.setState(statePatch, afterStateApplied),
        },
        afterStateApplied: async () => {
          try {
            if (!this.isSubmitContextCurrent(submitContext)) return;
            const cacheWriteResult: any = await this.writeSubmittedResponsesToLocalCaches({
              receipt,
              questionResponses: receipt?.__ceQuestionResponses,
              surveyResponse: receipt?.__ceSurveyResponse,
              surveyId: receipt?.__ceSurveyId,
              submissionSlug: submittedCacheSlug,
            }, submitContext).catch((error: any) => {
              surveyLog.warn('[SurveyQuestions] Local submit cache write-through failed:', error);
              return { questionCacheWritten: false, surveyCacheWritten: false };
            });
            if (!this.isSubmitContextCurrent(submitContext)) return;

            if (
              !cacheWriteResult?.questionCacheWritten &&
              typeof this.props.refreshQuestionResponses === 'function'
            ) {
              const ids: any = Array.from(changedQids).map((id: any) => normalizeQuestionIdKey(id)).filter(Boolean);
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
          } catch (e: any) { surveyLog.warn('SurveyTool: callback', e); }
        },
      });
    } catch (error: any) {
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
          finishSubmitAttempt: (submitAttemptId: any) => this.finishSubmitAttempt(submitAttemptId),
          setSubmitFailureState: (statePatch: any) => this.setState(statePatch),
        },
      });
    }
  };


  /**
   * Single source of truth for pending edit stats (Full Mode).
   * total  = # qIDs with any changed field vs. baseline
   * encrypted = # of those qIDs where a changed field is currently encrypted
   */
  computePendingEditStatsAtIndex = (idx: any) => {
    const currentSlice: any =
      (this.state.surveysResponseState && this.state.surveysResponseState[idx]) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const { result, newCache }: any = computePendingEditStats(
      {
        idx,
        currentSlice,
        userAnswers: this.state.userAnswers,
        existingCache: this._pendingEditStatsCache,
        diffCacheRef: this._changedQidsAndFieldsCache,
        questionPool: this.state.questionPool,
        pileQuestions: this.state.pileQuestions,
        questionId: this.props.questionID,
      },
      {
        getChangedQidsAndFields: (i: any) => this.getChangedQidsAndFields(i),
        isQuestionLockedForResponse: (qid: any) => this.isQuestionLockedForResponse(qid),
        buildRatingEnvelopeQidSetFromUserAnswers,
      },
    );
    if (newCache !== this._pendingEditStatsCache) {
      newCache.diffCacheRef = this._changedQidsAndFieldsCache;
      this._pendingEditStatsCache = newCache;
    }
    return result;
  };

  getPendingEditStats = (surveyIndexParam?: any) => {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.getPendingEditStats === 'function') {
      return runtimeStrategy.getPendingEditStats(this, surveyIndexParam);
    }
    return this.computePendingEditStatsAtIndex(this.getActiveSurveyIndex(surveyIndexParam));
  };




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
    executeSurveyExitEditing({
      props: this.props,
      state: this.state,
      buildSliceFromUserAnswers: this.buildSliceFromUserAnswers,
      buildSliceFromLocalCache: this.buildSliceFromLocalCache,
      getRenderedQuestionIds: this.getCurrentRenderedQuestionIds,
      buildEmptyResponseFieldState: this.buildEmptyResponseFieldState,
      cloneValue: this.deepClone,
      setState: this.setState.bind(this),
      recalculateEditStats: this.recalculateEditStats,
      persistDraftSafely: this.persistDraftSafely,
      updateJsonPreview: this.updateJsonPreview,
      clearDraft: this.clearDraft,
      updateSubmittedSinceLastEdit,
      onFailure: (error: any) => {
        surveyLog.warn('[SurveyQuestions] handleExitEditing failed:', error);
      },
    });
  };



  verifyEncryption = async (onlyTheseQids: any = null, sliceOverride: any = null) => {
    surveyLog.log("Verifying encryption...");
    const surveyIndex: any = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    const stateToCheck: any = sliceOverride || this.state.surveysResponseState[surveyIndex];
    const { passed, failures }: any = verifyEncryptionIntegrity(stateToCheck, onlyTheseQids);

    failures.forEach((msg: any) => surveyLog.error(msg));

    if (!passed) {
      throw new Error("Encryption verification failed. Some data marked for encryption was not processed correctly.");
    }
    surveyLog.log("Encryption verification successful.");
    return true;
  };

  submitSurveyResponse = async (overrideState: any = null, overrideChangedQids: any = null, submitContext: any = null) => {
    const context: any = submitContext && typeof submitContext === 'object'
      ? submitContext
      : this.buildSubmitContextSnapshot();
    if (!context.loginComplete) {
      this.props.toggleLoginModal(true);
      return;
    }

    // Use correct survey index for payload + diff gating
    const idx: any = context.surveyIndex;

    const data: any = this.prepareJsonAndHash(idx, undefined, overrideState);

    // Build full JSON snapshot first (unchanged behavior) then filter by changed set
    let changedSet: any;
    let changedMapForSubmit: any = {};
    try {
      const { changedQids, changedMap }: any = this.getChangedQidsAndFields(idx);
      changedMapForSubmit = changedMap || {};
      changedSet = overrideChangedQids ? overrideChangedQids : (changedQids || new Set());
    } catch (_: any) {
      changedMapForSubmit = {};
      changedSet = overrideChangedQids ? overrideChangedQids : new Set();
    }

    // If nothing actually changed, stop early (and throw so callers don't mark success)
    if (changedSet.size === 0) {
      this._submitGuard = false;
      this.setState(buildSubmitPreparationErrorState());
      throw new Error('No new or changed responses to submit.');
    }

    let filtered: any;
    try {
      filtered = filterChangedResponsesForSubmit({
        data,
        changedSet,
        singleQuestionMode: !!context.singleQuestionMode,
        isStandalone: !!context.isStandalone,
        surveyId: context.surveyId,
        HashZero: ethers.constants.HashZero,
      });
    } catch (e: any) {
      this._submitGuard = false;
      this.setState(buildSubmitPreparationErrorState(
        e.message || 'No new or changed responses to submit.'
      ));
      throw e;
    }

    const { questionIds, questionResponses, surveyId, surveyResponse }: any = filtered;

    const submissionContext: any = this.resolveSubmissionGroupContext({
      questionIds,
      surveyId: context.singleQuestionMode ? null : (context.surveyId || null),
      fallbackSlug: context.effectiveDraftSlug,
    });
    if (!submissionContext.ok) {
      throw new Error(submissionContext.error);
    }
    const submissionGroupKey: any = submissionContext.submissionGroupKey;

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
          isQuestionLockedForResponse: (qid: any) => this.isQuestionLockedForResponse(qid),
          resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => this.resolveFieldEncryptionAudience(field, qid, fk),
          getEffectiveRecipientsForQid: (qid: any) => this.getEffectiveRecipientsForQid(qid),
          getEffectiveRecipientsForField: ((opts: any) => this.getEffectiveRecipientsForField(opts)) as any,
          getDefaultResponseEncryptionAudienceForQid: (qid: any) => this.getDefaultResponseEncryptionAudienceForQid(qid),
          buildLitEncryptionOptionsForRecipients: (r: any) => this.buildLitEncryptionOptionsForRecipients(r),
          encryptEnvelopeValue: (value: any, opts: any) => (cryptoUtils as any).encryptEnvelopeValue(value, opts),
          getImportanceFromResponse,
          getConvictionFromResponse,
          warn: (msg: any, err: any) => surveyLog.warn(msg, err),
        },
      );
    } catch (e: any) {
      surveyLog.error('Failed to encrypt response rating:', e);
      throw e;
    }
    // Regression guard: rating envelope encryption can await Lit/provider work; do
    // not broadcast if the viewer/session changed while that was in flight.
    if (!this.isSubmitContextCurrent(context)) {
      throw new Error('Submission context changed before broadcast.');
    }

    const hashDeps: any = {
      hashIdentifier: cryptoUtils?.hashIdentifier?.bind(cryptoUtils),
      isHexString: utils.isHexString,
      id: utils.id,
      HashZero: ethers.constants.HashZero,
      warn: (msg: any, err: any) => surveyLog.warn(msg, err),
    };
    const hashedQuestionIds: any = Array.isArray(questionIds)
      ? questionIds.map((value: any) => ensureIdentifierHash(value, hashDeps))
      : [];
    const hashedSurveyId: any = ensureIdentifierHash(surveyId, hashDeps);

    // Submit tx (must actually send or we throw)
    const tx: any = await (contractScripts as any).submitResponses(
      context.provider,
      hashedQuestionIds,
      questionResponses,
      hashedSurveyId,
      surveyResponse,
      submissionGroupKey
    );

    return normalizeSubmitReceipt(tx, {
      questionResponses,
      surveyResponse,
      surveyId,
      submissionGroupKey,
      deepClone: (obj: any) => this.deepClone(obj),
    });
  };

  writeSubmittedResponsesToLocalCaches = async (params: any = {}, submitContext: any = null) => {
    const context: any = submitContext && typeof submitContext === 'object' ? submitContext : null;
    const contextProps: any = context?.props || this.props;
    return (writeSubmittedResponsesToLocalCachesHelper as any)(params, {
      account: context?.account || this.props.account || '',
      effectiveDraftSlug: context?.effectiveDraftSlug || this._getEffectiveDraftSlug() || '',
      singleQuestionMode: context ? !!context.singleQuestionMode : !!this.props.singleQuestionMode,
      isStandalone: context ? !!context.isStandalone : !!this.props.isStandalone,
      deepClone: (obj: any) => this.deepClone(obj),
      resolveSubmittedCacheWriteContext: (slug: any) => resolveSubmittedCacheWriteContext(contextProps, slug),
    });
  };


  renderQuestionAnswer = (question: any, response: any, index: any, isOwnResponse: any) => {
    if (!question || !response) {
      surveyLog.warn('renderQuestionAnswer: question or response is undefined');
      return null;
    }
    const promptReloading: any = this.isQuestionFieldBusy(question.id, 'prompt');
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
        onDecryptQuestion={this.handleDecryptQuestionAnswer}
        onReloadQuestionPrompt={this.handleReloadMaskedPrompt}
        promptReloading={promptReloading}
        showImportance={true}
        provider={this.props.provider}
        questionResponsesNonce={this.props.questionResponsesNonce}
        questionsCacheNonce={this.props.questionsCacheNonce || this.state.questionsCacheNonce}
        sbtCacheRevision={this.props.sbtCacheRevision}
      />
    );
  };

  renderSurveyAnswers = (responses: any, isOwnResponse: any) => {
    return (
      <SurveyQuestionsSurveyAnswersView
        isOwnResponse={isOwnResponse}
        onWarning={(...args: any[]) => surveyLog.warn(...args)}
        questionPool={this.state.questionPool}
        renderQuestionAnswer={this.renderQuestionAnswer}
        responses={responses}
      />
    );
  };

  getMemoizedMaskedQuestionVisibility = (questionPoolInput: any, singleQuestionMode: any) => {
    const fullQuestionPool: any = Array.isArray(questionPoolInput) ? questionPoolInput : EMPTY_QUESTION_POOL;
    const isSingleQuestionMode: any = !!singleQuestionMode;
    const modeKey: any = isSingleQuestionMode ? 'single' : 'multi';
    let memoByMode: any = null;
    try {
      memoByMode = this._maskedQuestionVisibilityMemoByPool.get(fullQuestionPool) || null;
    } catch (_: any) {
      memoByMode = null;
    }
    if (memoByMode && memoByMode[modeKey]) {
      bumpSurveyPerfCounter('maskedVisibilityMemoHitCount');
      return memoByMode[modeKey];
    }
    bumpSurveyPerfCounter('maskedVisibilityMemoMissCount');
    bumpSurveyPerfCounter('maskedVisibilityPoolSizeOnMiss', fullQuestionPool.length);

    const value: any = buildSurveyQuestionsMaskedQuestionVisibility({
      isMaskedPromptText: this.isMaskedPromptText,
      questionPool: fullQuestionPool,
      singleQuestionMode: isSingleQuestionMode,
    });
    const { visibleQuestionPool, hiddenMaskedQuestionIds }: any = value;
    bumpSurveyPerfCounter('maskedVisibilityVisibleCountOnMiss', visibleQuestionPool.length);
    bumpSurveyPerfCounter('maskedVisibilityHiddenCountOnMiss', hiddenMaskedQuestionIds.length);

    const nextMemoByMode: any = memoByMode
      ? { ...memoByMode, [modeKey]: value }
      : { [modeKey]: value };
    try {
      this._maskedQuestionVisibilityMemoByPool.set(fullQuestionPool, nextMemoByMode);
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    return value;
  };

  renderDefaultSurveyQuestionsRoute = () => {
    bumpSurveyPerfCounter('renderCount');
    const maskedQuestionVisibility: any = this.getMemoizedMaskedQuestionVisibility(
      this.state.questionPool,
      this.props.singleQuestionMode
    );
    const renderReadiness: any = buildSurveyQuestionsRenderReadinessDescriptor({
      displayAnswerMode: this.state.displayAnswerMode,
      fullQuestionPool: maskedQuestionVisibility.fullQuestionPool,
      hiddenMaskedQuestionIds: maskedQuestionVisibility.hiddenMaskedQuestionIds,
      isQuestionCacheReady: this.props.isQuestionCacheReady,
      isStandalone: this.props.isStandalone,
      parsedViewAddressAnswers: this.state.parsedViewAddressAnswers,
      questionPool: this.state.questionPool,
      singleQuestionMode: this.props.singleQuestionMode,
      surveyIndex: this.props.surveyIndex,
      surveysResponseState: this.state.surveysResponseState,
      visibleQuestionPool: maskedQuestionVisibility.visibleQuestionPool,
    });
    const {
      surveyIndex,
      currentSurveyResponseState,
      questionPoolReady,
      fullQuestionPool,
      visibleQuestionPool,
      hiddenMaskedQuestionIds,
      gatedEmptyStateReady,
      hasHiddenMaskedQuestions,
    }: any = renderReadiness;
    const fullLoadingProgress: any = buildSurveyQuestionsFullLoadingProgressState({
      questionScanProgress: this.props.questionScanProgress,
      progressSlug:
        (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(this.props) ||
        '',
    });

    if (renderReadiness.shouldShowLoadingState) {
      return (
        <SurveyQuestionsRouteSurface
          renderReadiness={renderReadiness}
          loadingProgressState={fullLoadingProgress}
        />
      );
    }

    const viewingAnswers: any = this.state.displayAnswerMode;
    const { jsonPreview }: any = buildSurveyQuestionsJsonPreviewDisplayState({
      jsonPreview: this.state.jsonPreview,
      questionPool: this.state.questionPool,
      viewingAnswers,
    });

    const routeViewDisplayState: any = buildSurveyQuestionsRouteViewDisplayState({
      account: this.props.account,
      isEditing: this.state.isEditing,
      isStandalone: this.props.isStandalone,
      questionPool: this.state.questionPool,
      responderAddress: this.props.responderAddress,
      shortenAddress: getShortenedAddress as any,
      singleQuestionMode: this.props.singleQuestionMode,
      userHasResponse: this.state.userHasResponse,
      viewAddress: this.props.viewAddress,
      viewingAnswers,
    });
    const {
      isOwnResponse,
      isSingleQuestionView,
    }: any = routeViewDisplayState;

    // Submit button label block (centralized)
    const _pendingStats: any = this.getPendingStatsSnapshot();
    const _suffix: any = _pendingStats.total === 1 ? 'Response' : 'Responses';

    const submitButtonText: any = isSingleQuestionView
      ? 'SUBMIT'
      : (this.props.computeSubmitLabel || computeSubmitLabel)(this, {
          suffix: _suffix,
          pendingStats: _pendingStats,
        });
    const submitReadiness: any = buildSurveyQuestionsSubmitReadinessDescriptor({
      currentStep: this.state.currentStep,
      isSubmitting: this.state.isSubmitting,
      pendingStats: _pendingStats,
      resolveMaskedCurrentQuestionPayload: this.hasMaskedCurrentQuestionPayload,
      singleQuestionMode: this.props.singleQuestionMode,
    });
    const submitFooterDisplayState: any = buildSurveyQuestionsSubmitFooterDisplayState({
      currentStep: this.state.currentStep,
      hasEncryptedAnswers: submitReadiness.hasEncryptedAnswers,
      hasMaskedCurrentQuestionPayload: submitReadiness.hasMaskedCurrentQuestionPayload,
      isDirty: this.state.isDirty,
      isEditing: this.state.isEditing,
      isLoadingResponse: this.state.isLoadingResponse,
      isSingleQuestionView,
      isSubmitting: this.state.isSubmitting,
      pendingEditCount: submitReadiness.pendingEditCount,
      responseUrl: this.state.responseUrl,
      singleQuestionMode: this.props.singleQuestionMode,
      startFresh: this.state.startFresh,
      submissionComplete: this.state.submissionComplete,
      submittedSinceLastEdit: this.state.submittedSinceLastEdit,
      useHeaderSubmit: this.props.useHeaderSubmit,
      userHasResponse: this.state.userHasResponse,
    });

    const { jsonForDisplay }: any = buildSurveyQuestionsJsonForDisplayState({
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

    const hideEmbeddedDebugUi: any = !!this.props.hideEmbeddedDebugUi;
    const jsonPanelDisplayState: any = buildSurveyQuestionsJsonPanelDisplayState({
      isSingleQuestionView,
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      showQuestionsJson: this.state.showQuestionsJson,
      showResponseJson: this.state.showResponseJson,
      showSurveyJson: this.state.showSurveyJson,
      styleMap: styles,
    });
    const surveyJson: any = jsonPanelDisplayState.showSurveyJsonPanel ? this.getSurveyJson() : null;
    const questionsJson: any = jsonPanelDisplayState.showQuestionsJsonPanel ? this.getQuestionsJson() : null;
    const responseJson: any = jsonPanelDisplayState.showResponseJsonPanel
      ? (viewingAnswers ? jsonForDisplay : this.getResponseJson())
      : null;
    const canEditQuestions: any = submitFooterDisplayState.canEditQuestions;
    const authoringPanelDisplayState: any = buildSurveyQuestionsAuthoringPanelDisplayState({
      canEditQuestions,
      hasCurrentSurveyResponseState: !!currentSurveyResponseState,
      hideEmbeddedDebugUi,
      questionPoolReady,
      singleQuestionMode: this.props.singleQuestionMode,
    });
    const layoutDisplayState: any = buildSurveyQuestionsLayoutDisplayState({
      activeTagModalTag: this.state.activeTagModalTag,
      isSingleQuestionView,
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      styleMap: styles,
      viewingAnswers,
    });
    const authoringRouteReadiness: any = buildSurveyQuestionsAuthoringRouteReadinessDescriptor({
      canEditQuestions,
      gatedEmptyStateReady,
      hasCurrentSurveyResponseState: !!currentSurveyResponseState,
      questionPoolReady,
      visibleQuestionPool,
    });
    const renderedEditableQuestions: any = authoringRouteReadiness.shouldRenderEditableQuestions
      ? visibleQuestionPool.map((question: any, qIndex: any) =>
          this.renderQuestion(question, qIndex, currentSurveyResponseState)
        )
      : null;
    const lockedGateDetails: any = this.getMemoizedLockedQuestionGateDetails(hiddenMaskedQuestionIds);
    const lockedQuestionsBanner: any = this.renderLockedQuestionsPanel({
      hiddenMaskedQuestionIds,
      lockedGateDetails,
    });

    return (
      <SurveyQuestionsRouteSurface
        renderReadiness={renderReadiness}
        loadingProgressState={fullLoadingProgress}
        layoutDisplayState={layoutDisplayState}
        routeViewDisplayState={routeViewDisplayState}
        submitDisplayState={submitFooterDisplayState}
        viewingAnswers={viewingAnswers}
        topStripProps={{
          topRef: this.topRef,
          displayAnswerMode: this.state.displayAnswerMode,
          isDecrypting: this.state.isDecrypting,
          isEditing: this.state.isEditing,
          isSubmitting: this.state.isSubmitting,
          onDecryptEdit: this.handleDecryptEdit,
          onExitEditing: this.handleExitEditing,
          onStartFresh: this.handleStartFresh,
          onToggleDisplayAnswerMode: this.toggleDisplayAnswerMode,
          responseUrl: this.state.responseUrl,
          userHasResponse: this.state.userHasResponse,
          userResponseEncrypted: this.state.userResponseEncrypted,
        }}
        responseViewProps={{
          isLoadingResponse: this.state.isLoadingResponse,
          noResponse: this.state.noResponse,
          parsedViewAddressAnswers: this.state.parsedViewAddressAnswers,
          questionPool: this.state.questionPool,
          questionPoolReady,
          renderQuestionAnswer: this.renderQuestionAnswer,
          renderSurveyAnswers: this.renderSurveyAnswers,
          responderAddress: this.props.responderAddress,
          responseLookupWarning: this.state.responseLookupWarning,
          singleQuestionMode: this.props.singleQuestionMode,
          userAnswers: this.state.userAnswers,
          viewAddress: this.props.viewAddress,
        }}
        authoringPanelProps={{
          displayState: authoringPanelDisplayState,
          lockedQuestionsBanner,
          onScrollToTop: this.handleScrollToTop,
          onShowJsonAtBottom: this.handleShowJsonAtBottom,
          renderedEditableQuestions,
        }}
        submittedResponseViewProps={{
          isOwnResponse,
          isVisible:
            !viewingAnswers &&
            this.state.userHasResponse &&
            !this.state.startFresh &&
            !this.state.isEditing,
          questionPool: this.state.questionPool,
          questionPoolReady,
          renderQuestionAnswer: this.renderQuestionAnswer,
          renderSurveyAnswers: this.renderSurveyAnswers,
          singleQuestionMode: this.props.singleQuestionMode,
          userAnswers: this.state.userAnswers,
        }}
        submitFooterProps={{
          isSingleQuestionView,
          isSubmitting: this.state.isSubmitting,
          onPrimarySubmitClick: this.handlePrimarySubmitClick,
          onRevertPendingChanges: this.handleRevertPendingChanges,
          pendingEditCount: submitReadiness.pendingEditCount,
          responseUrl: this.state.responseUrl,
          submitButtonText,
          submissionError: this.state.submissionError,
        }}
        jsonControlsProps={buildSurveyQuestionsRouteJsonControlsProps({
          bottomRef: this.bottomRef,
          copiedQuestionsJson: this.state.copiedQuestionsJson,
          copiedResponseJson: this.state.copiedResponseJson,
          copiedSurveyJson: this.state.copiedSurveyJson,
          copyJsonToClipboard: this.copyJsonToClipboard,
          hidden: hideEmbeddedDebugUi,
          jsonPanelDisplayState,
          onToggleQuestionsJson: this.toggleShowQuestionsJson,
          onToggleResponseJson: this.toggleShowResponseJson,
          onToggleSurveyJson: this.toggleShowSurveyJson,
          questionsJson,
          renderJsonTree: this.jsonTreeDisplay,
          responseJson,
          surveyJson,
        })}
        tagModalProps={{
          onClose: this.closeQuestionTagModal,
        }}
      />
    );
  };

  render() {
    const runtimeStrategy: any = this.getRuntimeStrategy();
    if (typeof runtimeStrategy?.render === 'function') {
      return runtimeStrategy.render(this);
    }
    return this.renderDefaultSurveyQuestionsRoute();
  }
}

// Preserve direct QuestionsDashboard/SurveySelector consumers without reviving the import cycle.
(SurveySelector as any).SurveyQuestionsComponent = SurveyQuestions;
(QuestionsDashboard as any).SurveyQuestionsComponent = SurveyQuestions;


export default SurveyQuestions;
