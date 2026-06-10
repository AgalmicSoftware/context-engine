// @ts-nocheck
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
  buildInitialSurveyQuestionsState,
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
  buildSubmitPreparationErrorState,
  buildStandaloneAuthResetState,
  buildSubmissionErrorState,
  buildSurveyJsonToggleState,
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
  isSurveyQuestionsMaskedPromptText,
  type SurveyQuestionsProps,
  type SurveyQuestionsState,
} from './surveyQuestionsTypes.js';


export class SurveyQuestions extends Component<SurveyQuestionsProps, SurveyQuestionsState> {
  constructor(props: SurveyQuestionsProps) {
    super(props);
    this.state = buildInitialSurveyQuestionsState(this.props);
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

  isPortoAutoSignReady = () => {
    try {
      return !!(
        typeof portoFunctions.isPortoAutoSignReady === 'function' &&
        portoFunctions.isPortoAutoSignReady()
      );
    } catch (_) {
      return false;
    }
  };

  // Auto-decrypt sweep control: blocks automatic decryption for providers that would
  // show a wallet/passkey prompt. Porto is allowed only after session-key mode has an
  // in-memory signer, so decrypt/sign calls can run silently on the current page.
  isAutoDecryptBlocked = () => {
    try {
      const kind = cryptoUtils.getProviderKind(this.props.provider);
      return decideAutoDecryptBlocked(kind, () => this.isPortoAutoSignReady());
    } catch (_) {
      return false;
    }
  };

  shouldAttemptAutomaticPromptDecrypt = () => {
    if (!this.props.loginComplete || !this.props.account || !this.props.provider) return false;
    try {
      const kind = cryptoUtils.getProviderKind(this.props.provider);
      return decideAutomaticPromptDecryptByKind(kind, () => this.isPortoAutoSignReady());
    } catch (_) {
      return false;
    }
  };


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

  _applyDraftTrackingState = (tracking = {}) => {
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

  setResponseHydrationState = (next, callback) => {
    this._responseHydrationStateUpdateDepth += 1;
    const release = () => {
      this._responseHydrationStateUpdateDepth = Math.max(
        0,
        (Number(this._responseHydrationStateUpdateDepth) || 0) - 1,
      );
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

  _applyDraftHydrationEntryToSlice = ({
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

  _applyResponseHydrationEntryToSlice = ({
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

  _applyResponseHydrationListToSlice = ({
    targetSlice = null,
    currentSlice = null,
    responses = [],
    allowOverwrite = false,
    parseValue = this.parseAnswerValue,
    questionIdResolver = (response) => normalizeQuestionIdKey(response?.questionID || response?.questionId),
  } = {}) => {
    if (!targetSlice) return false;
    const list = Array.isArray(responses) ? responses : [responses];
    let changed = false;
    list.forEach((response) => {
      const qid = questionIdResolver(response);
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
  } = {}) => {
    if (!targetSlice || !questionId) return false;
    let changed = false;

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

  buildAutoDecryptMaskedFieldSignature = (field = null) =>
    buildAutoDecryptMaskedFieldSignatureHelper(field);

  buildDecryptContextSnapshot = () => {
    const draftSlug = this._getEffectiveDraftSlug
      ? this._getEffectiveDraftSlug()
      : resolveEffectiveSlug(this.props);
    const hydrationContext = resolveDecryptHydrationContext(this.props, draftSlug);
    const singleQuestionMode = !!this.props.singleQuestionMode;
    const isStandalone = !!this.props.isStandalone;
    return {
      account: String(this.props?.account || '').trim().toLowerCase(),
      providerKind: String(cryptoUtils.getProviderKind(this.props?.provider) || '').trim().toLowerCase(),
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

  buildDecryptContextKey = (snapshot = null) =>
    buildDecryptContextKeyFromContext(snapshot || this.buildDecryptContextSnapshot());

  isDecryptContextCurrent = (snapshot = null) => (
    !!snapshot &&
    (!snapshot.mounted || this._isMounted) &&
    this.buildDecryptContextKey(snapshot) === this.buildDecryptContextKey()
  );

  canUpdateStateForAsyncSnapshot = (snapshot = null) => (
    !!snapshot &&
    (!snapshot.mounted || this._isMounted)
  );

  startSurveyDecryptAttempt = () => {
    const attemptId = (Number(this._surveyDecryptAttemptSeq) || 0) + 1;
    this._surveyDecryptAttemptSeq = attemptId;
    this._activeSurveyDecryptAttemptSeq = attemptId;
    return attemptId;
  };

  canUpdateSurveyDecryptAttempt = (snapshot = null, attemptId = null) => (
    this.canUpdateStateForAsyncSnapshot(snapshot) &&
    Number(attemptId || 0) > 0 &&
    this._activeSurveyDecryptAttemptSeq === attemptId
  );

  finishSurveyDecryptAttempt = (attemptId = null) => {
    if (Number(attemptId || 0) > 0 && this._activeSurveyDecryptAttemptSeq === attemptId) {
      this._activeSurveyDecryptAttemptSeq = 0;
    }
  };

  registerQuestionDecryptBusyTokens = (keysToMark = []) => {
    const result = buildQuestionDecryptBusyTokenRegistrationHelper({
      tokenSeq: this._questionDecryptBusyTokenSeq,
      busyTokens: this._questionDecryptBusyTokens,
      keysToMark,
    });
    this._questionDecryptBusyTokenSeq = result.token;
    this._questionDecryptBusyTokens = result.busyTokens;
    return result.token;
  };

  clearQuestionDecryptBusyTokens = (keysToClear = [], token = null) => {
    this._questionDecryptBusyTokens = buildClearedQuestionDecryptBusyTokensHelper({
      busyTokens: this._questionDecryptBusyTokens,
      keysToClear,
      token,
    });
  };

  ownsQuestionDecryptBusyTokens = (keysToCheck = [], token = null) =>
    ownsQuestionDecryptBusyTokensHelper({
      busyTokens: this._questionDecryptBusyTokens,
      keysToCheck,
      token,
    });

  buildQuestionDecryptOwnedClearState = (
    prev,
    questionId,
    fieldToDecrypt = 'both',
    token = null,
    extraPatch = {},
  ) => {
    const result = buildQuestionDecryptOwnedClearStateHelper({
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

  buildQuestionDecryptStaleState = (prev, questionId, fieldToDecrypt = 'both', token = null) => {
    // Regression guard: stale decrypt cleanup may only clear busy flags it owns.
    // A newer decrypt for the same field can start after this attempt's await.
    return this.buildQuestionDecryptOwnedClearState(prev, questionId, fieldToDecrypt, token);
  };

  buildQuestionDecryptFailureStateForAttempt = (prev, questionId, fieldToDecrypt = 'both', errorMessage = '', token = null) => {
    const patch = this.buildQuestionDecryptOwnedClearState(prev, questionId, fieldToDecrypt, token, {
      submissionError: errorMessage || 'Decryption failed.',
    });
    if (patch) return patch;
    return null;
  };

  buildDecryptTaskKey = (mode, questionId, fieldToDecrypt = 'both', responseOverride = null, decryptContext = null) => {
    const baseKey = buildDecryptTaskKeyHelper(
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

  getQuestionFieldTaskKey = (questionId, fieldKey = 'answer') => {
    return getQuestionFieldTaskKeyHelper(questionId, fieldKey);
  };

  isQuestionFieldBusy = (questionId, fieldKey = 'answer') => {
    const taskKey = this.getQuestionFieldTaskKey(questionId, fieldKey);
    if (!taskKey) return false;
    return !!(this.state.decryptingByKey && this.state.decryptingByKey[taskKey]);
  };

  getQuestionFieldDecryptSelection = (
    questionId,
    fieldToDecrypt = 'both',
    responseSlice = null,
  ) => getQuestionFieldDecryptSelectionHelper(questionId, fieldToDecrypt, responseSlice);

  decryptQuestionRatingEnvelopes = async (
    ratingEnvelopes = null,
    { chainId, lit, account, providerLike } = {},
  ) => decryptQuestionRatingEnvelopesHelper(
    ratingEnvelopes,
    { chainId, lit, account, providerLike },
    {
      decryptEnvelopeValue: cryptoUtils.decryptEnvelopeValue,
      logWarn: (error) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  decryptQuestionRatingEnvelopeMap = async (
    ratingEnvelopesByQid = {},
    { chainId, lit, account, providerLike } = {},
  ) => decryptQuestionRatingEnvelopeMapHelper(
    ratingEnvelopesByQid,
    { chainId, lit, account, providerLike },
    {
      decryptEnvelopeValue: cryptoUtils.decryptEnvelopeValue,
      logWarn: (error) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  buildQuestionDecryptExecutionContext = (baselineForDecrypt, questionId) => {
    const litHooks =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return buildQuestionDecryptExecutionContextHelper({
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
      getProviderKind: cryptoUtils.getProviderKind,
    });
  };

  buildSurveyDecryptExecutionContext = (sourceSlice, questionId = null) => {
    const litHooks =
      this.props.lit ||
      this.props.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return buildSurveyDecryptExecutionContextHelper({
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
      getProviderKind: cryptoUtils.getProviderKind,
    });
  };

  buildViewedResponseDecryptSuccessState = (
    prevState,
    options = {},
  ) => buildViewedResponseDecryptSuccessStateHelper(prevState, options);

  buildSelfQuestionDecryptSuccessState = (
    prevState,
    options = {},
  ) => buildSelfQuestionDecryptSuccessStateHelper(prevState, options, this.deepClone);

  buildSurveyDecryptSuccessState = (
    prevState,
    options = {},
  ) => buildSurveyDecryptSuccessStateHelper(prevState, options, this.deepClone);

  syncDecryptedQuestionIntoBaseline = (
    editBaseline,
    fallbackBaseline,
    nextTargetStateSlice,
    options = {},
  ) => syncDecryptedQuestionIntoBaselineHelper(
    editBaseline,
    fallbackBaseline,
    nextTargetStateSlice,
    options,
    this.deepClone,
  );

  mergeLatestEncryptedQuestionFields = (
    responseSlice,
    questionId,
    latestResponse,
    options = {},
  ) => mergeLatestEncryptedQuestionFieldsHelper(responseSlice, questionId, latestResponse, options);

  mergeQuestionResponseOverrideIntoDecryptSlice = (
    responseSlice,
    questionId,
    responseOverride,
  ) => mergeQuestionResponseOverrideIntoDecryptSliceHelper(responseSlice, questionId, responseOverride);

  buildSurveyDecryptSourceState = (
    latestResponse = null,
    fallbackSourceSlice = null,
    previousStateSlice = null,
  ) => buildSurveyDecryptSourceStateHelper(
    latestResponse,
    fallbackSourceSlice,
    previousStateSlice,
    this.buildSliceFromUserAnswers,
  );

  hydrateLatestQuestionDecryptState = async (
    options = {},
  ) => hydrateLatestQuestionDecryptStateHelper(
    options,
    {
      getQuestionFieldDecryptSelection: this.getQuestionFieldDecryptSelection,
      readQuestionsCache,
      getLatestQuestionResponse: this.getLatestQuestionResponse,
      mergeLatestEncryptedQuestionFields: this.mergeLatestEncryptedQuestionFields,
      mergeQuestionRatingEnvelopeState: this.mergeQuestionRatingEnvelopeState,
      logWarn: (error) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  prepareViewedQuestionDecryptState = async (
    options = {},
  ) => prepareViewedQuestionDecryptStateHelper(
    options,
    {
      buildViewedResponseDecryptBaseline: this.buildViewedResponseDecryptBaseline,
      hydrateLatestQuestionDecryptState: this.hydrateLatestQuestionDecryptState,
    },
  );

  prepareSelfQuestionDecryptState = async (
    options = {},
  ) => prepareSelfQuestionDecryptStateHelper(
    options,
    {
      buildSelfQuestionDecryptBaseline: this.buildSelfQuestionDecryptBaseline,
      mergeQuestionResponseOverrideIntoDecryptSlice: this.mergeQuestionResponseOverrideIntoDecryptSlice,
      mergeQuestionRatingEnvelopeState: this.mergeQuestionRatingEnvelopeState,
      hydrateLatestQuestionDecryptState: this.hydrateLatestQuestionDecryptState,
      logWarn: (error) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

  resolveLatestSurveyDecryptResponse = async (
    options = {},
  ) => resolveLatestSurveyDecryptResponseHelper(
    options,
    {
      getLatestQuestionResponse: contractScripts.getResponse,
      getLatestSurveyResponse: this.getSurveyResponse,
    },
  );

  prepareSurveyDecryptAttempt = async (
    options = {},
  ) => prepareSurveyDecryptAttemptHelper(
    options,
    {
      resolveLatestSurveyDecryptResponse: this.resolveLatestSurveyDecryptResponse,
      buildSurveyDecryptSourceState: this.buildSurveyDecryptSourceState,
      buildSurveyDecryptExecutionContext: this.buildSurveyDecryptExecutionContext,
    },
  );

  resolveQuestionDecryptHandlingMode = (
    options = {},
  ) => resolveQuestionDecryptHandlingModeHelper(
    options,
    {
      getViewedResponseOverrideForQuestion: this.getViewedResponseOverrideForQuestion,
    },
  );

  prepareQuestionDecryptAttempt = (
    options = {},
  ) => prepareQuestionDecryptAttemptHelper(
    options,
    {
      getQuestionFieldDecryptSelection: this.getQuestionFieldDecryptSelection,
      buildQuestionDecryptExecutionContext: this.buildQuestionDecryptExecutionContext,
    },
  );

  finalizeQuestionDecryptAttempt = async (
    options = {},
  ) => finalizeQuestionDecryptAttemptHelper(
    options,
    {
      decryptSingleField: cryptoUtils.decryptSingleField,
      decryptQuestionRatingEnvelopes: this.decryptQuestionRatingEnvelopes,
    },
  );

  finalizeSurveyDecryptAttempt = async (
    options = {},
  ) => finalizeSurveyDecryptAttemptHelper(
    options,
    {
      decryptMultipleAnswers: cryptoUtils.decryptMultipleAnswers,
      decryptQuestionRatingEnvelopeMap: this.decryptQuestionRatingEnvelopeMap,
      normalizeBulkDecryptedSliceForSurveyState: this.normalizeBulkDecryptedSliceForSurveyState,
    },
  );

  normalizeBulkDecryptedSliceForSurveyState = (
    decryptedSlice,
    options = {},
  ) => normalizeBulkDecryptedSliceForSurveyStateHelper(decryptedSlice, options);

  mergeQuestionRatingEnvelopeState = (previousState, nextSource, questionId = null) =>
    mergeQuestionRatingEnvelopeStateHelper(previousState, nextSource, questionId);

  buildQuestionDecryptStartState = (prevState, keysToMark = []) =>
    buildQuestionDecryptStartStateHelper(prevState, keysToMark);

  buildQuestionDecryptFailureState = (
    prevState,
    questionId,
    fieldToDecrypt = 'both',
    errorMessage = '',
  ) => buildQuestionDecryptFailureStateHelper(
    prevState,
    questionId,
    fieldToDecrypt,
    errorMessage,
  );

  buildViewedResponseDecryptBaseline = (responseOverride, questionId) =>
    buildViewedResponseDecryptBaselineHelper(
      responseOverride,
      questionId,
      this.buildSliceFromUserAnswers,
    );

  buildSelfQuestionDecryptBaseline = (surveyIndex) =>
    buildSelfQuestionDecryptBaselineHelper(
      surveyIndex,
      this.state.surveysResponseState,
      this.state.userAnswers,
      this.buildSliceFromUserAnswers,
      this.deepClone,
    );

  normalizeSingleQuestionViewedResponse = (rawResponse = null) =>
    normalizeSingleQuestionViewedResponseHelper(rawResponse);

  runDedupedDecryptTask = (taskKey, runner) =>
    runDedupedDecryptTaskHelper(this._decryptFieldTaskInFlight, taskKey, runner);

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

  resolveEffectiveResponseGateConfig = (slugIn = '', propsSnapshot = this.props) => {
    const slug = String(slugIn || '').trim().toLowerCase();
    const resolved = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: slug,
      sessionConfig: (propsSnapshot?.sessionConfig && typeof propsSnapshot.sessionConfig === 'object')
        ? propsSnapshot.sessionConfig
        : null,
      resolveBySlug: getStrictSessionConfigBySlug,
    });
    return resolved.effectiveSessionConfig || {};
  };

  resolveSessionChainId = (slugIn = '', cfgIn = null, propsSnapshot = this.props) => {
    const slug = String(
      slugIn || (this._getEffectiveDraftSlug ? this._getEffectiveDraftSlug() : resolveEffectiveSlug(propsSnapshot)) || ''
    ).trim().toLowerCase();
    const cfg =
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

  buildResponseGateConfigSignature = (cfg = {}) => {
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

  startCanDecryptOtherResponsesRun = (snapshotKey = '') => {
    this._canDecryptOtherResponsesKey = String(snapshotKey || '');
    const runId = (Number(this._canDecryptOtherResponsesRunId) || 0) + 1;
    this._canDecryptOtherResponsesRunId = runId;
    return runId;
  };

  isCurrentCanDecryptOtherResponsesRun = (runId, snapshotKey = '') => (
    this._canDecryptOtherResponsesRunId === runId &&
    this._canDecryptOtherResponsesKey === String(snapshotKey || '')
  );

  clearCanDecryptOtherResponsesInFlightIfTracked = (tracked = null) => {
    if (this._canDecryptOtherResponsesInFlight === tracked) {
      this._canDecryptOtherResponsesInFlight = null;
    }
  };

  refreshCanDecryptOtherResponses = async () => {
    try {
      const ctx = buildCanDecryptContext({
        getEffectiveDraftSlug: () => this._getEffectiveDraftSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(this.props),
        resolveEffectiveResponseGateConfig: (slug) => this.resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => this.getResponseGatePolicy(),
        account: this.props?.account || '',
        loginComplete: this.props?.loginComplete,
        singleQuestionMode: this.props.singleQuestionMode,
        isStandalone: this.props.isStandalone,
        sbtCacheRevision: this.props?.sbtCacheRevision || 0,
      });
      const { cfg, slug, snapshot } = ctx;
      const preCheck = evaluateCanDecryptPreCheck(snapshot);

      if (preCheck.earlyExit) {
        // Invalidate any in-flight checks so they can't race and re-enable decrypt UI.
        this.invalidateCanDecryptOtherResponsesTracking();
        if (this.state.canDecryptOtherResponses || this.state.canDecryptOtherResponsesStatus !== preCheck.status) {
          this.setState(buildCanDecryptOtherResponsesState({ status: preCheck.status }));
        }
        return false;
      }

      const snapshotKey = String(snapshot.key || '');
      if (snapshotKey === this._canDecryptOtherResponsesKey && this._canDecryptOtherResponsesInFlight) {
        return await this._canDecryptOtherResponsesInFlight;
      }
      const runId = this.startCanDecryptOtherResponsesRun(snapshotKey);

      const run = (async () => {
        if (this.state.canDecryptOtherResponsesStatus !== 'checking' &&
          this.isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)
        ) {
          // Clear any previously granted permission while we verify against the current gate/session/wallet.
          this.setState(buildCanDecryptOtherResponsesState({ status: 'checking' }));
        }
        const { canDecrypt, status } = await resolveCanDecryptGateAccess({
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

      let tracked = null;
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
    } catch (_) {
      try {
        this.setState(buildCanDecryptOtherResponsesState({ status: 'unknown' }));
      } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      return false;
    }
  };

  buildCanDecryptOtherResponsesSignature = () => {
    try {
      return buildCanDecryptContext({
        getEffectiveDraftSlug: () => this._getEffectiveDraftSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(this.props),
        resolveEffectiveResponseGateConfig: (slug) => this.resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => this.getResponseGatePolicy(),
        account: this.props?.account || '',
        loginComplete: this.props?.loginComplete,
        singleQuestionMode: this.props.singleQuestionMode,
        isStandalone: this.props.isStandalone,
        sbtCacheRevision: this.props?.sbtCacheRevision || 0,
      }).snapshot.signature;
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
      this.resetBlockedAutoDecryptSweepInternals();
      this.setState(buildAutoDecryptDisabledState());
    }

    // Lazy load ZK-compatible Poseidon hasher (poseidon-lite)
    this._isMounted = true;
    this._hasMounted = true;
    const loadHasher = async () => {
      try {
        const { poseidon } = await import('poseidon-lite');
        if (typeof poseidon === 'function' && this._isMounted) {
          this.setState(buildHasherState(poseidon));
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
        const initialStates = this.initializeSurveyResponseState();
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
      const initialSlice = this.initializeSurveyResponseState();
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
  }

  async componentDidUpdate(prevProps, prevState) {
    const diffInputsChanged = this.didEditDiffInputsChange(prevProps, prevState);
    if (diffInputsChanged) {
      const propsHydrationContextChanged =
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
      this.resetBlockedAutoDecryptSweepInternals();
      if (this.state.autoDecryptEnabled || (this.state.decryptingByKey && Object.keys(this.state.decryptingByKey).length > 0)) {
        this.setState(buildAutoDecryptDisabledState());
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
            this.setState(buildResponseLoadingResetState(
              updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'reset')
            ));

            // 1. Apply Draft (Anon answers) onto Empty
            this.rehydrateDraftForRenderedIds({ responseHydrationOwned: true });

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
              this.setState(buildEditingResponseModeState());
            }
        });
      }

      if (prevState.questionPool !== this.state.questionPool) {
        this.setState(
          (prevStateInner) => buildQuestionPoolResponseMergeState(prevStateInner, {
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
      const surveyChanged = this.props.surveyId !== prevProps.surveyId;
      const cacheInvalidated =
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
        const hasPendingQuestionPoolHydration = this.getSurveyQuestionPoolLoadState().isIncomplete;
        if ((this.state.isDirty || (this.state.modifiedCount || 0) > 0) && !hasPendingQuestionPoolHydration) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          // do nothing
        } else {
          await this.fetchQuestionPool();
          this.setState(
            (prev) => buildSurveyResponseMergeState(prev, {
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
              this.setState(buildEditingResponseModeState());
            }
        });
      }
    }

    // Standalone mode (QuestionsDashboard)
    else {
      if (prevProps.questionPool !== this.props.questionPool) {
        this.setState(
          (prevStateInner) => buildQuestionPoolResponseMergeState(prevStateInner, {
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

      const standaloneAuthBecameReady =
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

  buildAutomaticQuestionMetadataFetchOptions = (slugIn) => {
    const decryptContext = this.buildQuestionDecryptContext(slugIn);
    return this.shouldAttemptAutomaticPromptDecrypt()
      ? { decryptContext }
      : { decryptContext, skipDecrypt: true };
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

  isMaskedPromptText = (prompt) => isSurveyQuestionsMaskedPromptText(prompt);

  getQuestionFetchCandidateSlugs = (questionId, preferredSlug = '', opts = {}) => {
    const sanitize = (s) => (
      s == null
        ? ''
        : String(s).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    );

    const qid = String(questionId || '').trim().toLowerCase();
    const slugPinned = getSessionSlugPinnedFromProps(this.props);
    const explicitSlug = sanitize(getSessionSlugHintFromProps(this.props));
    const currentQuestionSessionName = this.state.questionPool?.[0]?.sessionName;
    const resolvedSlug = sanitize(
      resolveSlugForIds({
        sessionName: this.props.sessionName || currentQuestionSessionName,
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

    this.setState((prev) => buildRenderedQuestionPayloadPoolsState(prev, qid, questionPayload, {
      pickBetterQuestionPayload,
      areQuestionPayloadsEquivalent,
    }));
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

    this.setState((prev) => buildDecryptingByKeyState(prev, key, true));

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
        this.setState((prev) => buildVisiblePileQuestionsAfterPromptDecryptState(prev, {
          isFilterStateActive: isSurveyToolFilterStateActive,
          isMaskedPromptText: this.isMaskedPromptText,
        }));
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
      this.setState((prev) => buildDecryptingByKeyState(prev, key, false));
    }
  };

  reloadMaskedQuestionBatch = async (questionIds = []) => {
    const ids = Array.from(new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((qid) => String(qid || '').trim().toLowerCase())
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
    this.setState(buildActiveTagModalState(normalizedTag));
  };

  closeQuestionTagModal = () => {
    this.setState(buildActiveTagModalState());
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

  flushDraftPersistAfterSliderChange = () => {
    this.persistDraftSafely && this.persistDraftSafely(0);
  };

  handleConvictionImportanceChange = (surveyIndex, questionId, mode, value, options = {}) => {
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
  }) => (
    <SurveyQuestionsFullQuestionSliderSection
      activeSliderValue={activeSliderValue}
      convictionValue={convictionValue}
      hasConvictionImportanceValue={hasConvictionImportanceValue}
      importanceToggleEnabled={ENABLE_IMPORTANCE_SLIDER_TOGGLE}
      importanceValue={importanceValue}
      isSubmitting={this.state.isSubmitting}
      onChange={(value, event) =>
        this.handleConvictionImportanceChange(
          surveyIndex,
          questionId,
          sliderMode,
          value,
          buildSliderPersistOptions(event)
        )}
      onChangeComplete={this.flushDraftPersistAfterSliderChange}
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
      onSelectMode={(nextMode) => this.setSliderMode(questionId, nextMode)}
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
        buildSliderPersistOptions(event)
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

  isQuestionPromptMasked = (question) => isQuestionPromptMasked(question);

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
  }) => {
    const arweaveTxId = getLegacyArweaveTxId(question);
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
  }) => {
    const displayState = buildQuestionFieldDecryptControlDisplayStateHelper({
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
    const result = buildIndexedQuestionEntryKeys(source, normalizeQuestionIdKey);
    try {
      if (result) this._normalizedQuestionEntryKeyCache.set(source, result);
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
    return result;
  };

  getChangedQidsAndFields = (surveyIndexParam) => measureSync('ce.surveyQuestions.getChangedQidsAndFields', () => {
    const surveyIndex = this.getActiveSurveyIndex(surveyIndexParam);
    const currentSlice =
      (this.state.surveysResponseState && this.state.surveysResponseState[surveyIndex]) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const scopedIds = this.getEditTrackingQuestionIds(surveyIndex);
    const { result, newCache } = orchestrateGetChangedQidsAndFields(
      {
        surveyIndex,
        currentSlice,
        isLoggedIn: !!(this.props.account && this.props.loginComplete),
        isLoadingResponse: !!this.state.isLoadingResponse,
        scopedIds,
        userAnswers: this.state.userAnswers,
      },
      {
        resolveDiffBaselineSlice: (allowLocalCache) => this.resolveDiffBaselineSlice(allowLocalCache),
        getIndexedQuestionEntryKeys: (source) => this.getIndexedQuestionEntryKeys(source),
        getDefaultResponseEncryptionAudience: () => this.getDefaultResponseEncryptionAudience(),
        normalizeResponseEncryptionAudience: (audience, qid) => this.normalizeResponseEncryptionAudience(audience, qid),
        getDefaultResponseEncryptionAudienceForQid: (qid) => this.getDefaultResponseEncryptionAudienceForQid(qid),
        resolveFieldEncryptionGateId: (field, qid, fieldKey) => this.resolveFieldEncryptionGateId(field, qid, fieldKey),
        normalizeFieldAudienceMode: (mode, fieldKey, field) => this.normalizeFieldAudienceMode(mode, fieldKey, field),
        valuesEqual: this.valuesEqual,
        buildSurveyResponseSliceSignature,
        buildRatingEnvelopeQidSetFromUserAnswers,
        hasMeaningfulFieldValue,
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
          this.setState((prev) => buildAutoDecryptAttemptedState(prev, k));
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

      const draftHits = [];
      for (const step of loadPlan) {
        const hit = rawDraftByKey.get(step.readKey) || readAndParse(step.readKey);
        if (!hit) continue;
        draftHits.push({ ...step, ...hit });
      }

      if (draftHits.length === 0) return null;

      const mergedDraft = mergePersistedDraftPayloads({
        drafts: draftHits.map((hit) => hit.obj),
      });
      if (!mergedDraft) return null;

      const targetKey = accountLower ? acctKey : anonKey;
      const mergedRaw = JSON.stringify(mergedDraft);
      const targetHit = draftHits.find((hit) => hit.readKey === targetKey);
      const shouldWriteTarget =
        !!targetKey &&
        (
          !targetHit ||
          targetHit.raw !== mergedRaw ||
          draftHits.some((hit) => hit.readKey !== targetKey || hit.writeKey)
        );

      let wroteTarget = !shouldWriteTarget;
      if (shouldWriteTarget) {
        try {
          sessionStorage.setItem(targetKey, mergedRaw);
          wroteTarget = true;
        } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
      }

      if (wroteTarget && targetKey) {
        draftHits.forEach((hit) => {
          if (!hit.readKey || hit.readKey === targetKey) return;
          try { sessionStorage.removeItem(hit.readKey); } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
        });
      }

      if (targetKey && wroteTarget) {
        rawDraftByKey.set(targetKey, { raw: mergedRaw, obj: mergedDraft });
      }

      return mergedDraft;
    } catch (_) {
      return null;
    }
  };

  migratePersistedDraftForActiveAccount = () => {
    try {
      if (!this.props?.account) return null;
      return this.loadDraft();
    } catch (e) {
      surveyLog.warn('SurveyTool: fallback', e);
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

      this.migratePersistedDraftForActiveAccount();

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

    let renderedIds = [];
    try {
      renderedIds = buildRenderedQuestionIdsFromQuestionPools({
        questionPool,
        pileQuestions,
      });
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
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
    return readRenderedQuestionIds({
      getRenderedQuestionIds: () => this.getCurrentRenderedQuestionIds(),
      normalizeRenderedIds: buildNormalizedRenderedQuestionIds,
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
    return resolveSurveyMissingRenderedResponseLookup({
      props: this.props,
      responder: opts?.responder || this.props.account,
      slug: opts?.slug ?? this._getEffectiveDraftSlug() ?? fallbackSlug,
      fallbackSlug,
      renderedIds: this.getRenderedQuestionIdsForResponseHydration(),
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
    return executeSurveyPriorResponseBackfill({
      props: this.props,
      state: this.state,
      slug: opts?.slug,
      attemptedSet: this._priorResponseBackfillAttempted,
      getMissingRenderedResponseIdsForAccount: ({ responder, slug: nextSlug }) => this.getMissingRenderedResponseIdsForAccount({
        responder,
        slug: nextSlug,
      }),
      setHydratingState: (active) => this.setState(buildHydratingPriorResponsesState(active)),
      isMounted: this._isMounted,
      readQuestionsCacheAsync,
      resetLocalCacheMemo: () => {
        // Force the immediate follow-up pass to read the freshly written cache
        // even before parent cache nonces propagate down as props.
        this._localCacheSliceMemo = { key: '', value: null, hasValue: false };
        this._rehydrateLocalCacheLastSig = '';
      },
      triggerRehydrate: () => this.rehydrateLocalCacheAnswersForRenderedIds(),
      onFailure: (error) => {
        surveyLog.warn('[SurveyQuestions] Prior-response backfill failed:', error);
      },
      getCurrentInFlight: () => this._priorResponseBackfillInFlight,
      setCurrentInFlight: (value) => {
        this._priorResponseBackfillInFlight = value;
      },
    });
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
      }),
    });
  };


  // Reset live form state on account changes (before loading new account data)
  resetFormStateForAccountChange = (callback) => {
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
      onPersistError: (error) => { surveyLog.warn('SurveyTool: fallback', error); },
      onCleanupError: (error) => { surveyLog.warn('SurveyTool: cleanup', error); },
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
      onFailure: (error) => {
        surveyLog.warn('[SurveyQuestions] handleRevertPendingChanges failed:', error);
      },
    });
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

  resolveDiffBaselineSlice = (allowLocalCache = false) => {
    const {
      baselineSlice,
      nextUserAnswersSliceCache,
    } = resolveSurveyBaselineSourceSlice({
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
    const slice = buildSurveyLocalCacheSlice({
      props: this.props,
      rawSlug: this._getEffectiveDraftSlug(),
      renderedIds: this.getCurrentRenderedQuestionIds(),
      localCacheSliceMemo: this._localCacheSliceMemo,
      resolveResponseHydrationContext: (rawSlug) => resolveResponseHydrationContext(this.props, rawSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug) => getExtraQuestionReadSlugs(this.props, slug),
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
      setLocalCacheMemo: (nextMemo) => {
        this._localCacheSliceMemo = nextMemo;
      },
      onError: (error) => {
        DEBUG_PREFILL && surveyLog.error('[Survey][buildSlice] Error:', error);
      },
    });
    if (slice) {
      DEBUG_PREFILL && surveyLog.log('[Survey][buildSlice] Building for rendered IDs:', this.getCurrentRenderedQuestionIds());
    }
    return slice;
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
        this.setState(buildBookmarkedQuestionsState());
        return;
      }
      const list = Array.isArray(obj?.questions) ? obj.questions : [];
      this.setState(buildBookmarkedQuestionsState(list));
    } catch (error) {
      surveyLog.error('[SurveyQuestions] Error reading bookmarksCache:', error);
      this.setState(buildBookmarkedQuestionsState());
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
    this.setState(buildBookmarkedQuestionsState(obj.questions));

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
    const baselineSlice = this.resolveDiffBaselineSlice(true);

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
        this.setState(buildEditStatsState({
          modifiedCount,
          encryptedModifiedCount,
          hasEncryptedChanges,
          isDirty,
          shouldResetSubmitted,
          shouldRelatchSubmitted,
        }));
      }
    } catch (e) { surveyLog.warn('SurveyTool: fallback', e); }
  };



  initializeSurveyResponseState = () => {
    const questionPoolIds = Array.isArray(this.props.questionPool)
      ? this.props.questionPool.map((question) => question.id)
      : [];
    const renderedQuestionIds = buildInitialSurveyResponseQuestionIds({
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

  showTransientSubmitFeedback = (message = '', durationMs = 2000) => {
    if (this._emptySubmitTimer) {
      clearTimeout(this._emptySubmitTimer);
      this._emptySubmitTimer = null;
    }
    const update = buildTransientSubmitFeedbackState({
      message,
    });
    this.setState(update);
    if (!update.submissionError) return;
    this._emptySubmitTimer = setTimeout(() => {
      if (!this._isMounted) return;
      const clearUpdate = buildClearedTransientSubmitFeedbackState();
      this.setState(clearUpdate);
      this._emptySubmitTimer = null;
    }, normalizeTransientSubmitFeedbackDurationMs(durationMs));
  };

  maybeBlockSubmitUntilQuestionPoolComplete = () => {
    const { isIncomplete, pendingCount } = this.getSurveyQuestionPoolLoadState();
    if (!isIncomplete) return false;

    this.showTransientSubmitFeedback(buildQuestionPoolPendingSubmitFeedbackMessage({
      pendingCount,
    }));
    void this.fetchQuestionPool().catch((error) => {
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
    const slug = this.props.surveyId
      ? resolveSlugForIds({ surveyId: this.props.surveyId, props: this.props, network: this.props.network })
      : resolveEffectiveSlug(this.props);
    const questionReadContext = resolveQuestionReadCacheContext(this.props, slug);
    const effectiveSlug = questionReadContext.sessionSlug || slug;
    const netIdStr = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error("SurveyQuestions: fetchQuestionPool – network.id undefined");
      this.setState(buildClearedSurveyQuestionPoolState());
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
      this.setState(buildClearedSurveyQuestionPoolState());
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

    this.setState((prev) => buildFetchedQuestionPoolState(prev, {
      areQuestionPayloadsEquivalent,
      buildQuestionIdScopeSignature,
      expectedQuestionIds,
      normalizeQuestionIdKey,
      onNoop: () => bumpSurveyPerfCounter('noopSkipCount'),
      pendingQuestionIds,
      pickBetterQuestionPayload,
      questionPool,
    }));
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

  // Prefill single-question draft from prior response.
  // Hydrates encrypted: true for previously encrypted fields.
  // Intelligently merges baseline and preserves un-edited responses cleanly.
  prefillSingleQuestionResponse = (userAnswer) => {
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
      cloneValue: this.deepClone,
      setState: this.setState.bind(this),
      clearDraftFor: this.clearDraftFor,
      recalculateEditStats: this.recalculateEditStats,
      persistDraftSafely: this.persistDraftSafely,
      updateSubmittedSinceLastEdit,
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

    const sourceContextPlan = buildSingleQuestionSourceRestoreContextPlan({
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
    const questionId = sourceContextPlan.questionId;
    const preserveCurrentSingleQuestionPool = (extraState = {}) => {
      const plan = buildSingleQuestionPreservedPoolState({
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

    let effectiveSingleSlug = sourceContextPlan.effectiveSingleSlug;
    const fetchCandidateSlugs = sourceContextPlan.fetchCandidateSlugs;
    const hasPendingRetryForQuestion = sourceContextPlan.hasPendingRetryForQuestion;

    if (sourceContextPlan.status === 'blocked-question') {
      this.updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn(`SurveyQuestions: Question ${questionId} is blocked; skipping.`);
      safeSetState(sourceContextPlan.statePatch);
      return;
    }

    const responderAddress = this.props.responderAddress;

    const getCacheStateForSlug = async (slug) => resolveSingleQuestionCacheState({
      slug,
      questionId,
      resolveQuestionBootstrapContext: (nextSlug) => resolveQuestionBootstrapContext(this.props, nextSlug),
      readQuestionsCacheAsync,
      ensureQuestionsNet,
    });

    const cacheBootstrapResult = await resolveSingleQuestionCacheBootstrap({
      questionId,
      effectiveSingleSlug,
      responderAddress: String(responderAddress || ''),
      account: String(this.props.account || ''),
      resolveCacheState: getCacheStateForSlug,
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

    const cacheBootstrapPlan = resolveSingleQuestionCacheBootstrapFlowPlan({ cacheBootstrapResult });
    if (cacheBootstrapPlan.seededHydration) {
      const { questionData: seededQData, isLoadingResponse } = cacheBootstrapPlan.seededHydration;
      this.setResponseHydrationState(
        (prev) => buildSingleQuestionSeededHydrationState({
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
      const stopPlanContext = {
        bootstrapRetryAttempt,
        cacheBootstrapPlan,
        effectiveSingleSlug: cacheBootstrapResult.target.effectiveSingleSlug,
        questionId: cacheBootstrapResult.target.questionId,
        responderAddress: cacheBootstrapResult.target.responderAddress,
        runId,
      };
      const stopHandlingPlan = resolveSingleQuestionCacheBootstrapStopHandlingPlan(stopPlanContext);
      if (stopHandlingPlan.action === 'retry') {
        const didScheduleRetry = this.scheduleSingleQuestionBootstrapRetry(stopHandlingPlan.retryRequest);
        const retryOutcome = resolveSingleQuestionCacheBootstrapStopHandlingPlan({
          ...stopPlanContext,
          didScheduleRetry,
        }).retryOutcome;
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

    let qData = cacheBootstrapPlan.questionData;
    let cacheState = cacheBootstrapPlan.cacheState;
    let { netIdStr, questionsCache } = cacheState;
    const recentPayloadForAccount = cacheBootstrapPlan.recentPayloadForAccount;

    const metadataBootstrapResult = await resolveSingleQuestionMetadataBootstrap({
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
      fetchSingleQuestionMetadataCandidates: (args) => fetchSingleQuestionMetadataCandidates({
        ...args,
        getQuestionData: (candidateSlug) => contractScripts.getQuestionData(
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

    if (metadataBootstrapResult.status === 'missing-cache-state') {
      if (preserveCurrentSingleQuestionPool({ isLoadingResponse: false })) {
        return;
      }
      safeSetState({ isLoadingResponse: false, questionPool: [] });
      return;
    }

    if (metadataBootstrapResult.status === 'unavailable') {
      surveyLog.warn(
        `SurveyQuestions: No question data for ${questionId} (slug='${metadataBootstrapResult.effectiveSingleSlug}').`
      );
      const didScheduleRetry = this.scheduleSingleQuestionBootstrapRetry({
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
      const placeholderQuestion = buildSingleQuestionEncryptedMetadataPlaceholder({
        questionId,
        sessionSlug: metadataBootstrapResult.effectiveSingleSlug || effectiveSingleSlug,
        existingQuestionData: qData || recentPayloadForAccount || null,
      });
      if (placeholderQuestion) {
        safeSetState((prev) => ({
          questionPool: [placeholderQuestion],
          surveysResponseState: this.mergeSurveyResponseState(
            prev.surveysResponseState ||
              [{ answers: {}, importance: {}, conviction: {}, additionalComments: {} }],
            [placeholderQuestion],
            0
          ),
          isLoadingResponse: false,
          noResponse: false,
          responseLookupWarning: '',
        }));
        return;
      }
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
        const writeRespToCache = async (responder, respObj) => writeSingleQuestionResponseToCache({
          responder,
          respObj,
          questionId,
          effectiveSingleSlug,
          netIdStr,
          readQuestionsCacheAsync,
          ensureQuestionsNet,
          writeQuestionsCache,
        });

        const readCachedResponderResponse = (responder) => readSingleQuestionCachedResponderResponse({
          responder,
          questionId,
          netIdStr,
          questionsCache,
          cloneValue: this.deepClone,
        });

        const readFreshCachedResponderResponse = async (responder) => (
          readFreshSingleQuestionCachedResponderResponse({
            responder,
            questionId,
            netIdStr,
            effectiveSingleSlug,
            readQuestionsCacheAsync,
            ensureQuestionsNet,
            cloneValue: this.deepClone,
            updateQuestionsCache: (nextCache) => {
              questionsCache = nextCache;
            },
          })
        );

        // Fetch latest response for the appropriate address, scoped to this slug
        if (responderAddress) {
          const viewedBootstrapResult = await executeViewedSingleQuestionResponseBootstrap({
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
            mergeViewedResponse: mergeDecryptedViewedResponse,
            scheduleRetry: this.scheduleSingleQuestionBootstrapRetry,
            clearRetry: this.clearSingleQuestionBootstrapRetry,
            getResponse: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
              forceArweaveFetch = false,
            }) => contractScripts.getResponse(
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
            }) => contractScripts.getResponseHash(
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
          const ownBootstrapResult = await executeOwnSingleQuestionResponseBootstrap({
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
            }) => contractScripts.getResponse(
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
    const {
      surveyIndex,
      slug,
      fallbackUserAnswers,
      fallbackSourceSlice,
      previousStateSlice,
    } = buildSurveyDecryptAttemptSourceInputsHelper({
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
      if (applySurveyDecryptStaleStatusHelper({
        host: this,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;
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
      if (applySurveyDecryptStaleStatusHelper({
        host: this,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;

      this.finishSurveyDecryptAttempt(decryptAttemptId);
      this.setState((prevState) => this.buildSurveyDecryptSuccessState(prevState, {
        surveyIndex,
        decryptedSlice: normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      }), () => {
        const jsonPreview = this.prepareJsonAndHash(surveyIndex);
        this.setState(buildJsonPreviewState(jsonPreview));
        this.persistDraftSafely && this.persistDraftSafely(0);
      });
    } catch (error) {
      surveyLog.error('Error decrypting answers:', error);
      if (applySurveyDecryptStaleStatusHelper({
        host: this,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;
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

      const attemptStatus = startQuestionDecryptAttemptStatusHelper({
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
      } = await this.finalizeQuestionDecryptAttempt({
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
      const completionStatus = applyQuestionDecryptCompletionStatusHelper({
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
    } catch (error) {
      surveyLog.error(`Error decrypting viewed response ${fieldToDecrypt} for ${questionId}`, error);
      return applyQuestionDecryptFailureStatusHelper({
        host: this,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        error,
      });
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

    const surveyIndex = context.surveyIndex;

    try {
      // If we're viewing someone else's response (via /question/:id/:responder or /survey/:id?address=),
      // decrypt in-place against the viewed response object (do NOT switch to edit mode).
      const {
        effectiveResponseOverride,
        hasResponseOverride,
        isViewedResponseMode,
      } = this.resolveQuestionDecryptHandlingMode({
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
      } = await this.prepareSelfQuestionDecryptState({
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

      const attemptStatus = startQuestionDecryptAttemptStatusHelper({
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
      } = await this.finalizeQuestionDecryptAttempt({
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
      const completionStatus = applyQuestionDecryptCompletionStatusHelper({
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
    } catch (error) {
      surveyLog.error(`Error decrypting ${fieldToDecrypt} for ${questionId}`, error);
      return applyQuestionDecryptFailureStatusHelper({
        host: this,
        context,
        questionId,
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
    const plan = buildAnswerUpdatePlan(questionId, answer, sourceSlice, {
      buildEmptyResponseFieldState: (qid, fk) => this.buildEmptyResponseFieldState(qid, fk),
      resolveFieldEncryptionAudience: (field, qid, fk) => this.resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field, qid, fk) => this.resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid) => this.getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (val, fk, f) => this.normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: (af, ansf, qid) => this.buildInheritedAdditionalFieldState(af, ansf, qid),
      valuesEqual: (a, b) => this.valuesEqual(a, b),
      getQuestionById: (qid) => this.getQuestionById(qid),
      computeHash: (value) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState = [...(this.state.surveysResponseState || [])];
    const slice = { ...sourceSlice };
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

  handleAdditional = (surveyIndex, questionId, additionalComments) => {
    surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;

    const sourceSlice =
      this.state.surveysResponseState?.[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const plan = buildAdditionalUpdatePlan(questionId, additionalComments, sourceSlice, {
      buildEmptyResponseFieldState: (qid, fk) => this.buildEmptyResponseFieldState(qid, fk),
      resolveFieldEncryptionAudience: (field, qid, fk) => this.resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field, qid, fk) => this.resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid) => this.getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (val, fk, f) => this.normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: (af, ansf, qid) => this.buildInheritedAdditionalFieldState(af, ansf, qid),
      valuesEqual: (a, b) => this.valuesEqual(a, b),
      getQuestionById: (qid) => this.getQuestionById(qid),
      computeHash: (value) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (this._draftDirtyQids) this._draftDirtyQids.add(questionId);
    this.invalidateDiffCaches();

    const newSurveysResponseState = [...(this.state.surveysResponseState || [])];
    const slice = { ...sourceSlice };
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

    this.setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(this.state.submittedSinceLastEdit, 'user_edit')
    ), () => {
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
  toggleAnswerEncryption = (surveyIndex, questionId, newEncryptedState) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    this.invalidateDiffCaches();

    this.setState(prev => buildAnswerEncryptionToggleResponseState(prev, {
      buildEncryptionTogglePlan,
      deps: {
        isQuestionLockedForResponse: (q) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q, fk) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f, q, fk) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f, q, fk) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v, fk, f) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af, ans, q) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a, q) => this.normalizeResponseEncryptionAudience(a, q),
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
  toggleAdditionalCommentsEncryption = (surveyIndex, questionId, newEncryptedState) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    this.invalidateDiffCaches();

    this.setState(prev => buildAdditionalEncryptionToggleResponseState(prev, {
      buildEncryptionTogglePlan,
      deps: {
        isQuestionLockedForResponse: (q) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q, fk) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f, q, fk) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f, q, fk) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v, fk, f) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af, ans, q) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a, q) => this.normalizeResponseEncryptionAudience(a, q),
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
    const surveyResponseState = overrideState || this.state.surveysResponseState[surveyIndex];
    return buildResponsePayload({
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      surveyId: this.props.surveyId,
      account: responderAddress || this.props.account,
      surveyIndex,
      surveyResponseState,
      questionPool: Array.isArray(this.state.questionPool) ? this.state.questionPool : [],
      pileQuestions: Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [],
      resolveFieldEncryptionAudience: (field, qid, fieldKey) => this.resolveFieldEncryptionAudience(field, qid, fieldKey),
      getQuestionEncryptionGates: (q) => this.getQuestionEncryptionGates(q),
      resolveFieldEncryptionGateId: (field, qid, fieldKey) => this.resolveFieldEncryptionGateId(field, qid, fieldKey),
      normalizeFieldAudienceMode: (mode, fieldKey, field) => this.normalizeFieldAudienceMode(mode, fieldKey, field),
      getSurveyMetadataForJson: (hash) => this.getSurveyMetadataForJson(hash),
      resolveSessionContext: () => {
        const context = resolveResponseJsonContext(this.props, resolveEffectiveSlug(this.props));
        return { sessionName: context.sessionConfig?.sessionName || '' };
      },
      getConvictionFromSlice,
      getImportanceFromSlice,
      sanitizeQuestionPromptForResponsePayload,
    });
  };


  updateJsonPreview = (force = false) => {
    if (!force && !this.isResponseJsonPreviewVisible()) return;
    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    this.setState(buildJsonPreviewState(this.prepareJsonAndHash(surveyIndex)));
  };

  jsonTreeDisplay = (jsonInput) => (
    <SurveyQuestionsJsonTree
      jsonInput={jsonInput}
      onInvalidInput={(...args) => surveyLog.error(...args)}
    />
  );

  handlePrimarySubmitClick = () => {
    const inFlightPlan = buildSurveyQuestionsPrimarySubmitPlan({
      isSubmitting: this.state.isSubmitting,
      submitGuardActive: this._submitGuard,
    });
    if (inFlightPlan.action === 'inert') return;

    const pendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: typeof this.getPendingEditStats === 'function'
        ? () => this.getPendingEditStats()
        : undefined,
      fallbackTotal: this.state.modifiedCount || 0,
    });
    const pendingEditCount = pendingStats.total;
    const planBase = {
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
    let plan = buildSurveyQuestionsPrimarySubmitPlan(planBase);
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
          navigateToResponse: (path) => window.history.pushState({}, '', path),
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
    }).catch(error => {
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

  getCommentsOpen = (questionId, defaultOpen = false) => {
    const current = this.state?.showComments?.[questionId];
    return typeof current === 'boolean' ? current : !!defaultOpen;
  };

  toggleComments = (questionId, defaultOpen = false) => {
    this.setState((prev) => buildCommentsToggleState(prev, questionId, defaultOpen));
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
    const displayState = this.getQuestionRenderDisplayState({
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
    buildGateAudienceSbtItemsController(sbtAddresses, sessionSlug, {
      resolveSbtGateLabel: (address) => this.resolveSbtGateLabel(address),
      getShortenedAddress,
      buildSbtDetailPath,
    })
  );

  getQuestionEncryptionGates = (question) => getQuestionEncryptionGatesCore(question);

  normalizeFieldAudienceMode = (value, fieldKey = 'answer', field = {}) =>
    normalizeFieldAudienceModeCore(value, fieldKey, field, hasMeaningfulFieldValue);

  getQuestionGateOptions = (questionId) => (
    getQuestionGateOptionsController(questionId, {
      getQuestionById: (qid) => this.getQuestionById(qid),
      getQuestionEncryptionGates: (question) => this.getQuestionEncryptionGates(question),
      buildRecipientsFromGates: (gates) => this.buildRecipientsFromGates(gates),
      normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (opts = {}) => this.resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate = {}, fallbackSbt = '') => this.resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (sbtAddresses = [], sessionSlug = '') => this.buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address) => this.resolveSbtGateLabel(address),
      getShortenedAddress,
      normalizeQuestionIdKey,
    })
  );

  getResponseGateOptions = (questionId = null) => (
    getResponseGateOptionsController(questionId, {
      normalizeQuestionIdKey,
      isQuestionLockedForResponse: (qid) => this.isQuestionLockedForResponse(qid),
      getQuestionGateOptions: (qid = null) => this.getQuestionGateOptions(qid),
      getResponseGatePolicy: () => this.getResponseGatePolicy(),
      buildRecipientsFromGates: (gates) => this.buildRecipientsFromGates(gates),
      resolveLockAudienceSessionName: () => this.resolveLockAudienceSessionName(),
      resolveConfiguredGateLabel: (opts = {}) => this.resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate = {}, fallbackSbt = '') => this.resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (sbtAddresses = [], sessionSlug = '') => this.buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address) => this.resolveSbtGateLabel(address),
      getShortenedAddress,
      t,
      getEffectiveDraftSlug: typeof this._getEffectiveDraftSlug === 'function'
        ? () => this._getEffectiveDraftSlug()
        : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(this.props),
    })
  );

  getResponseGateOptionById = (questionId = null, gateId = '') => (
    getResponseGateOptionByIdController(questionId, gateId, {
      normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
      getResponseGateOptions: (qid = null) => this.getResponseGateOptions(qid),
    })
  );

  resolveFieldEncryptionGateId = (field = {}, questionId = null, fieldKey = 'answer') => (
    resolveFieldEncryptionGateIdController(field, questionId, fieldKey, {
      resolveFieldEncryptionAudience: (nextField, qid, fk) => this.resolveFieldEncryptionAudience(nextField, qid, fk),
      normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
      getResponseGateOptionById: (qid = null, gateId = '') => this.getResponseGateOptionById(qid, gateId),
    })
  );

  buildInheritedAdditionalFieldState = (additionalField = {}, answerField = {}, questionId = null) =>
    buildInheritedAdditionalFieldStateCore(additionalField, answerField, questionId, {
      resolveFieldEncryptionAudience: (field, qid, fk) => this.resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field, qid, fk) => this.resolveFieldEncryptionGateId(field, qid, fk),
    });

  getEffectiveRecipientsForField = ({ questionId, fieldKey = 'answer', field = null } = {}) => (
    getEffectiveRecipientsForFieldController({ questionId, fieldKey, field }, {
      normalizeQuestionIdKey,
      isQuestionLockedForResponse: (qid) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid) => this.getEffectiveRecipientsForQid(qid),
      resolveFieldEncryptionAudience: (nextField, qid, fk) => this.resolveFieldEncryptionAudience(nextField, qid, fk),
      resolveFieldEncryptionGateId: (nextField, qid, fk) => this.resolveFieldEncryptionGateId(nextField, qid, fk),
      getResponseGateOptionById: (qid = null, gateId = '') => this.getResponseGateOptionById(qid, gateId),
    })
  );

  resolveGatedPromptGateNames = (question) => (
    resolveGatedPromptGateNamesController(question, {
      normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
      resolveGateDisplayLabel: (gate = {}, fallbackSbt = '') => this.resolveGateDisplayLabel(gate, fallbackSbt),
      getQuestionEncryptionGates: (nextQuestion) => this.getQuestionEncryptionGates(nextQuestion),
      getEffectiveDraftSlug: typeof this._getEffectiveDraftSlug === 'function'
        ? () => this._getEffectiveDraftSlug()
        : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(this.props),
      resolveEffectiveResponseGateConfig: (slug) => this.resolveEffectiveResponseGateConfig(slug),
    })
  );

  buildRecipientsFromGates = (gates = []) => (
    buildRecipientsFromGatesController(gates, {
      resolveSessionChainId: () => this.resolveSessionChainId(),
    })
  );

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

  hasDefaultResponseGateRecipients = () => {
    const recipients = this.getResponseGatePolicy()?.recipients;
    return Array.isArray(recipients) && recipients.length > 0;
  };

  getDefaultResponseEncryptionAudience = () => (
    this.hasDefaultResponseGateRecipients() ? 'gate' : 'self'
  );

  getDefaultResponseEncryptionAudienceForQid = (questionId) => (
    this.isQuestionLockedForResponse(questionId) || this.getEffectiveRecipientsForQid(questionId).length > 0
      ? 'gate'
      : 'self'
  );

  normalizeResponseEncryptionAudience = (value, questionId = null) =>
    normalizeResponseEncryptionAudienceCore(value, questionId, {
      isQuestionLocked: (qid) => this.isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid) => this.getEffectiveRecipientsForQid(qid),
      hasDefaultGateRecipients: () => this.hasDefaultResponseGateRecipients(),
    });

  buildEmptyResponseFieldState = (questionId = null, fieldKey = 'answer') =>
    buildEmptyResponseFieldStateCore(questionId, fieldKey, {
      getDefaultAudienceForQid: (qid) => this.getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => this.getDefaultResponseEncryptionAudience(),
      resolveFieldEncryptionGateId: (field, qid, fk) => this.resolveFieldEncryptionGateId(field, qid, fk),
      normalizeFieldAudienceMode: (val, fk, f) => this.normalizeFieldAudienceMode(val, fk, f),
    });

  resolveFieldEncryptionAudience = (field = {}, questionId = null, fieldKey = 'answer') =>
    resolveFieldEncryptionAudienceCore(field, questionId, fieldKey, {
      normalizeAudience: (val, qid) => this.normalizeResponseEncryptionAudience(val, qid),
      getDefaultAudienceForQid: (qid) => this.getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => this.getDefaultResponseEncryptionAudience(),
    });

  normalizeGateLabelText = (value) => normalizeGateLabelTextCore(value);

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
    const policy = this.getResponseGatePolicy();
    const questionPools = [
      Array.isArray(this.state.questionPool) ? this.state.questionPool : [],
      Array.isArray(this.state.pileQuestions) ? this.state.pileQuestions : [],
      Array.isArray(this.props.questionPool) ? this.props.questionPool : [],
    ];

    return collectGateSbtAddressesForHydrationFromSources({
      policy,
      questionPools,
      getQuestionEncryptionGates: (question) => this.getQuestionEncryptionGates(question),
      isAddress: (value) => ethers.utils.isAddress(value),
      getAddress: (value) => ethers.utils.getAddress(value),
    });
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
      this.setState(buildGateSbtNameRevisionState);
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
      onToggleDetails={() => this.setState(buildLockedGateDetailsExpandedState)}
    />
  );

  resolveGateDisplayLabel = (gate = {}, fallbackSbt = '') => (
    resolveGateDisplayLabelController(gate, fallbackSbt, {
      normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
      resolveSbtGateLabel: (address) => this.resolveSbtGateLabel(address),
      getShortenedAddress,
      t,
    })
  );

  resolveConfiguredGateLabel = ({ gate = {}, resourceKey = '', sbtAddresses = [] } = {}) => (
    resolveConfiguredGateLabelController(
      { gate, resourceKey, sbtAddresses },
      this._responseGatePolicyCache?.cfg,
      {
        normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
        resolveGateDisplayLabel: (configuredGate = {}, fallbackSbt = '') => (
          this.resolveGateDisplayLabel(configuredGate, fallbackSbt)
        ),
      },
    )
  );

  resolveLockAudienceSessionName = () => (
    resolveLockAudienceSessionNameController({
      normalizeGateLabelText: (value) => this.normalizeGateLabelText(value),
      props: this.props,
      responseGatePolicyCacheCfg: this._responseGatePolicyCache?.cfg,
      resolveSlugForIds,
      resolveLockAudienceSessionNameContext,
    })
  );

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
    this.setState((prev) => buildLockAudienceGateDetailsState(
      prev,
      key,
      forceOpen,
      normalizedGateId,
      this.normalizeGateLabelText
    ));
  };

  toggleLockAudienceMenu = (questionId, forceOpen = null, fieldKey = 'answer') => {
    const key = this.getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    this.setState((prev) => buildLockAudienceMenuState(prev, key, forceOpen));
  };

  applyAnswerEncryptionAudience = (surveyIndex, questionId, audience, options = {}) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    if (!qid) return;
    this.invalidateDiffCaches();

    this.setState((prev) => buildAnswerEncryptionAudienceState(prev, {
      audience,
      buildAnswerAudienceSelectionPlan,
      buildSurveyResponseStateArray,
      deps: {
        isQuestionLockedForResponse: (q) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q, fk) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f, q, fk) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f, q, fk) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v, fk, f) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af, ans, q) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a, q) => this.normalizeResponseEncryptionAudience(a, q),
      },
      gateId: options?.gateId || '',
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
  };

  applyAdditionalEncryptionAudience = (surveyIndex, questionId, audience, options = {}) => {
    const idx = (this.props.isStandalone || this.props.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid = String(questionId || '').toLowerCase();
    if (!qid) return;
    this.invalidateDiffCaches();

    this.setState((prev) => buildAdditionalEncryptionAudienceState(prev, {
      audience,
      buildAdditionalAudienceSelectionPlan,
      buildSurveyResponseStateArray,
      deps: {
        isQuestionLockedForResponse: (q) => this.isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q, fk) => this.buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f, q, fk) => this.resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f, q, fk) => this.resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v, fk, f) => this.normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af, ans, q) => this.buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a, q) => this.normalizeResponseEncryptionAudience(a, q),
      },
      gateId: options?.gateId || '',
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      this.scheduleJsonPreviewUpdate();
      this.persistDraftSafely && this.persistDraftSafely();
    });
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
    return buildFieldEncryptionWorkGroupsCore(slice, changedQids, {
      isQuestionLockedForResponse: (q) => this.isQuestionLockedForResponse(q),
      resolveFieldEncryptionGateId: (f, q, fk) => this.resolveFieldEncryptionGateId(f, q, fk),
      resolveFieldEncryptionAudience: (f, q, fk) => this.resolveFieldEncryptionAudience(f, q, fk),
      getEffectiveRecipientsForField: (opts) => this.getEffectiveRecipientsForField(opts),
    });
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

  buildSubmitContextSnapshot = () => {
    const singleQuestionMode = !!this.props.singleQuestionMode;
    const isStandalone = !!this.props.isStandalone;
    const surveyIndex = singleQuestionMode || isStandalone ? 0 : (this.props.surveyIndex || 0);
    const effectiveDraftSlug = normalizeSessionSlugValue(
      this._getEffectiveDraftSlug
        ? this._getEffectiveDraftSlug()
        : resolveEffectiveSlug(this.props)
    );

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
    runSurveyQuestionsStaleSubmitController({
      snapshot,
      ports: {
        clearSubmitGuard: () => {
          this._submitGuard = false;
        },
        canUpdateSubmitState: (currentSnapshot) => this.canUpdateStateForAsyncSnapshot(currentSnapshot),
        isSubmitAttemptActive: (_submitAttemptId, currentSnapshot) => (
          this._activeSubmitAttemptSeq ===
          (currentSnapshot as { submitAttemptId?: unknown } | null | undefined)?.submitAttemptId
        ),
        finishSubmitAttempt: (submitAttemptId) => this.finishSubmitAttempt(submitAttemptId),
        setSubmitStaleState: (statePatch) => this.setState(statePatch),
      },
    });
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
      const startResult = runSurveyQuestionsSubmitStartController({
        ports: {
          startSubmitAttempt: () => this.startSubmitAttempt(),
          setSubmitStartState: (statePatch) => this.setState(statePatch),
        },
      });
      submitContext.submitAttemptId = startResult.submitAttemptId;

      const providerKind = cryptoUtils.getProviderKind(submitContext.provider);

      // Compute changed set once (used for encrypt + submit)
      const surveyIndex = submitContext.surveyIndex;
      const { changedQids } = this.getChangedQidsAndFields(surveyIndex);

      // Local state tracker to ensure baseline syncs with encrypted data even if React is slow
      let activeSlice = this.state.surveysResponseState?.[surveyIndex] || { answers: {}, additionalComments: {}, importance: {}, conviction: {} };

      // Only encrypt when there are changed encrypted fields
      const pendingStats = resolveSurveyQuestionsSubmitPendingStats({
        getPendingEditStats: typeof this.getPendingEditStats === 'function'
          ? () => this.getPendingEditStats()
          : undefined,
        fallbackTotal: this.state.modifiedCount || 0,
        fallbackEncrypted: this.state.hasEncryptedChanges ? 1 : 0,
      });
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
          this.setState(buildSurveysResponseStatePatch(newArr));

          // Verify against the freshly merged slice instead of immediately rereading
          // `this.state`, which can still hold the pre-encryption draft until React
          // flushes the async class-state update.
          await this.verifyEncryption(changedQids, base);
        }
      }

      this.setState(buildCurrentStepState(2));

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
      const submittedCacheSlug = normalizeSessionSlugValue(
        receipt?.__ceSubmissionGroupKey != null
          ? receipt.__ceSubmissionGroupKey
          : submitContext.effectiveDraftSlug
      );
      const responseUrl = resolveSurveyQuestionsSubmittedResponseUrl({
        account: submitContext.account,
        currentPathname: window.location.pathname,
        isStandalone: submitContext.isStandalone,
        logWarn: (message, error) => surveyLog.warn(message, error),
        questionID: submitContext.questionID,
        singleQuestionMode: submitContext.singleQuestionMode,
        submissionSlug: submittedCacheSlug,
        surveyId: submitContext.surveyId,
      });

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
    const { result, newCache } = computePendingEditStats(
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
        getChangedQidsAndFields: (i) => this.getChangedQidsAndFields(i),
        isQuestionLockedForResponse: (qid) => this.isQuestionLockedForResponse(qid),
        buildRatingEnvelopeQidSetFromUserAnswers,
      },
    );
    if (newCache !== this._pendingEditStatsCache) {
      newCache.diffCacheRef = this._changedQidsAndFieldsCache;
      this._pendingEditStatsCache = newCache;
    }
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
      onFailure: (error) => {
        surveyLog.warn('[SurveyQuestions] handleExitEditing failed:', error);
      },
    });
  };



  verifyEncryption = async (onlyTheseQids = null, sliceOverride = null) => {
    surveyLog.log("Verifying encryption...");
    const surveyIndex = this.props.isStandalone || this.props.singleQuestionMode ? 0 : this.props.surveyIndex;
    const stateToCheck = sliceOverride || this.state.surveysResponseState[surveyIndex];
    const { passed, failures } = verifyEncryptionIntegrity(stateToCheck, onlyTheseQids);

    failures.forEach((msg) => surveyLog.error(msg));

    if (!passed) {
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
      this.setState(buildSubmitPreparationErrorState());
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

    const { questionIds, questionResponses, surveyId, surveyResponse } = filtered;

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

    const hashDeps = {
      hashIdentifier: cryptoUtils?.hashIdentifier?.bind(cryptoUtils),
      isHexString: utils.isHexString,
      id: utils.id,
      HashZero: ethers.constants.HashZero,
      warn: (msg, err) => surveyLog.warn(msg, err),
    };
    const hashedQuestionIds = Array.isArray(questionIds)
      ? questionIds.map((value) => ensureIdentifierHash(value, hashDeps))
      : [];
    const hashedSurveyId = ensureIdentifierHash(surveyId, hashDeps);

    // Submit tx (must actually send or we throw)
    const tx = await contractScripts.submitResponses(
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
      deepClone: (obj) => this.deepClone(obj),
    });
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

    const value = buildSurveyQuestionsMaskedQuestionVisibility({
      isMaskedPromptText: this.isMaskedPromptText,
      questionPool: fullQuestionPool,
      singleQuestionMode: isSingleQuestionMode,
    });
    const { visibleQuestionPool, hiddenMaskedQuestionIds } = value;
    bumpSurveyPerfCounter('maskedVisibilityVisibleCountOnMiss', visibleQuestionPool.length);
    bumpSurveyPerfCounter('maskedVisibilityHiddenCountOnMiss', hiddenMaskedQuestionIds.length);

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
    const maskedQuestionVisibility = this.getMemoizedMaskedQuestionVisibility(
      this.state.questionPool,
      this.props.singleQuestionMode
    );
    const renderReadiness = buildSurveyQuestionsRenderReadinessDescriptor({
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
    } = renderReadiness;
    const fullLoadingProgress = buildSurveyQuestionsFullLoadingProgressState({
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

    const viewingAnswers = this.state.displayAnswerMode;
    const { jsonPreview } = buildSurveyQuestionsJsonPreviewDisplayState({
      jsonPreview: this.state.jsonPreview,
      questionPool: this.state.questionPool,
      viewingAnswers,
    });

    const routeViewDisplayState = buildSurveyQuestionsRouteViewDisplayState({
      account: this.props.account,
      isEditing: this.state.isEditing,
      isStandalone: this.props.isStandalone,
      questionPool: this.state.questionPool,
      responderAddress: this.props.responderAddress,
      shortenAddress: getShortenedAddress,
      singleQuestionMode: this.props.singleQuestionMode,
      userHasResponse: this.state.userHasResponse,
      viewAddress: this.props.viewAddress,
      viewingAnswers,
    });
    const {
      isOwnResponse,
      isSingleQuestionView,
    } = routeViewDisplayState;

    // Submit button label block (centralized)
    const _pendingStats = this.getPendingStatsSnapshot();
    const _suffix = _pendingStats.total === 1 ? 'Response' : 'Responses';

    const submitButtonText = isSingleQuestionView
      ? 'SUBMIT'
      : (this.props.computeSubmitLabel || computeSubmitLabel)(this, {
          suffix: _suffix,
          pendingStats: _pendingStats,
        });
    const submitReadiness = buildSurveyQuestionsSubmitReadinessDescriptor({
      currentStep: this.state.currentStep,
      isSubmitting: this.state.isSubmitting,
      pendingStats: _pendingStats,
      resolveMaskedCurrentQuestionPayload: this.hasMaskedCurrentQuestionPayload,
      singleQuestionMode: this.props.singleQuestionMode,
    });
    const submitFooterDisplayState = buildSurveyQuestionsSubmitFooterDisplayState({
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
    const canEditQuestions = submitFooterDisplayState.canEditQuestions;
    const authoringPanelDisplayState = buildSurveyQuestionsAuthoringPanelDisplayState({
      canEditQuestions,
      hasCurrentSurveyResponseState: !!currentSurveyResponseState,
      hideEmbeddedDebugUi,
      questionPoolReady,
      singleQuestionMode: this.props.singleQuestionMode,
    });
    const layoutDisplayState = buildSurveyQuestionsLayoutDisplayState({
      activeTagModalTag: this.state.activeTagModalTag,
      isSingleQuestionView,
      isStandalone: this.props.isStandalone,
      singleQuestionMode: this.props.singleQuestionMode,
      styleMap: styles,
      viewingAnswers,
    });
    const authoringRouteReadiness = buildSurveyQuestionsAuthoringRouteReadinessDescriptor({
      canEditQuestions,
      gatedEmptyStateReady,
      hasCurrentSurveyResponseState: !!currentSurveyResponseState,
      questionPoolReady,
      visibleQuestionPool,
    });
    const renderedEditableQuestions = authoringRouteReadiness.shouldRenderEditableQuestions
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
  }
}

// Preserve direct QuestionsDashboard/SurveySelector consumers without reviving the import cycle.
SurveySelector.SurveyQuestionsComponent = SurveyQuestions;
QuestionsDashboard.SurveyQuestionsComponent = SurveyQuestions;


export default SurveyQuestions;
