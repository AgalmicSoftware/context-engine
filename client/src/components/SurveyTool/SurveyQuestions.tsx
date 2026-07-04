/** @file SurveyQuestions.tsx */

import React, { useLayoutEffect, useReducer, useRef } from 'react';
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
import { isPendingQuestionMetadataPlaceholder } from './surveyQuestionMetadataPlaceholders.js';
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
import { sessionRegistryStore } from '../../utilities/web3/sessionRegistry.js';
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
  isQuestionPromptMasked as isQuestionPromptMaskedHelper,
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
  resolveSubmitEffectiveDraftSlug,
  runSurveyQuestionsSubmitController,
  runSurveyQuestionsSubmitFailureController,
  resolveSurveyQuestionsSubmittedResponseUrl,
  runSurveyQuestionsStaleSubmitController,
  runSurveyQuestionsSubmitStartController,
  runSurveyQuestionsSubmitSuccessController,
  type SurveyQuestionsSubmitPendingStats,
  type SurveyQuestionsSubmitStaleStatePatch,
  type SurveyQuestionsSubmitStartControllerResult,
} from './surveyQuestionsSubmitController.js';
import {
  applySurveyQuestionsRuntimeInitialState,
  createInitialSurveyQuestionsState,
  surveyQuestionsReducer,
  type SurveyQuestionsStateUpdate,
} from './surveyQuestionsState.js';
import {
  createSurveyQuestionsInstanceFields,
  type SurveyQuestionsBootstrapRetryArgs,
  type SurveyQuestionsCacheQuestion,
  type SurveyQuestionsCachedResponseEntryArgs,
  type SurveyQuestionsDraftHydrationEntryArgs,
  type SurveyQuestionsDraftTrackingState,
  type SurveyQuestionsHydrationPatch,
  type SurveyQuestionsInstanceFields,
  type SurveyQuestionsLocalCacheHydrationEntryArgs,
  type SurveyQuestionsPendingStatsInput,
  type SurveyQuestionsQuestionIdResolver,
  type SurveyQuestionsRecord,
  type SurveyQuestionsResponseFieldState,
  type SurveyQuestionsResponseHydrationEntryArgs,
  type SurveyQuestionsResponseHydrationListArgs,
  type SurveyQuestionsSetStateCallback,
  type SurveyQuestionsTimeoutCallback,
} from './surveyQuestionsInstanceFields.js';
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
  type SurveyQuestionsAuthoringPanelDisplayState,
  type SurveyQuestionsAuthoringRouteReadinessDescriptor,
  type SurveyQuestionsFullLoadingProgressState,
  type SurveyQuestionsJsonPanelDisplayState,
  type SurveyQuestionsProps,
  type SurveyQuestionsPrimarySubmitPlan,
  type SurveyQuestionsRenderReadinessDescriptor,
  type SurveyQuestionsRouteViewDisplayState,
  type SurveyQuestionsRuntimeStrategy,
  type SurveyQuestionsState,
  type SurveyQuestionsSubmitFooterDisplayState,
  type SurveyQuestionsSubmitReadinessDescriptor,
  type SurveyQuestionsMaskedQuestionVisibilityState,
  type SurveySubmitFailureStatePatch,
  type SurveySubmitStartStatePatch,
  type SurveySubmitSuccessStatePatch,
} from './surveyQuestionsTypes.js';

export const SurveyQuestions = (props: SurveyQuestionsProps): React.ReactElement => {
  const propsRef = useRef(props);
  propsRef.current = props;
  const bottomRef = useRef<any>(null);
  const topRef = useRef<any>(null);
  const instRef = useRef<SurveyQuestionsInstanceFields | null>(null);
  if (instRef.current === null) {
    instRef.current = createSurveyQuestionsInstanceFields();
  }
  const inst = instRef.current;
  const initEngineRef = useRef<any | null>(null);
  if (initEngineRef.current === null) {
    initEngineRef.current = inst;
  }
  const [state, dispatch] = useReducer(surveyQuestionsReducer, props, (initialProps: SurveyQuestionsProps) => {
    const initialState = createInitialSurveyQuestionsState(initialProps);
    const initialEngine = initEngineRef.current || inst;
    initialEngine.props = initialProps;
    initialEngine.state = initialState;
    initialEngine.bottomRef = bottomRef;
    initialEngine.topRef = topRef;
    return applySurveyQuestionsRuntimeInitialState(initialState, initialEngine);
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const pendingSetStateCallbacksRef = useRef<SurveyQuestionsSetStateCallback[]>([]);
  const setState = (update: SurveyQuestionsStateUpdate, callback?: SurveyQuestionsSetStateCallback): void => {
    if (callback) pendingSetStateCallbacksRef.current.push(callback);
    dispatch(update);
  };
  const engine = inst as any;
  engine.props = propsRef.current;
  engine.state = stateRef.current;
  engine.setState = setState;
  engine.bottomRef = bottomRef;
  engine.topRef = topRef;

const getRuntimeStrategy = (): SurveyQuestionsRuntimeStrategy | null => (
    propsRef.current.runtimeStrategy && typeof propsRef.current.runtimeStrategy === 'object'
      ? propsRef.current.runtimeStrategy
      : null
  );

const isPortoAutoSignReady = () => {
    try {
      return !!(
        typeof portoFunctions.isPortoAutoSignReady === 'function' &&
        portoFunctions.isPortoAutoSignReady()
      );
    } catch (_: any) {
      return false;
    }
  };

const isAutoDecryptBlocked = () => {
    try {
      const kind: any = (cryptoUtils as any).getProviderKind(propsRef.current.provider);
      return decideAutoDecryptBlocked(kind, () => isPortoAutoSignReady());
    } catch (_: any) {
      return false;
    }
  };

const shouldAttemptAutomaticPromptDecrypt = () => {
    if (!propsRef.current.loginComplete || !propsRef.current.account || !propsRef.current.provider) return false;
    try {
      const kind: any = (cryptoUtils as any).getProviderKind(propsRef.current.provider);
      return decideAutomaticPromptDecryptByKind(kind, () => isPortoAutoSignReady());
    } catch (_: any) {
      return false;
    }
  };

const _applyDraftTrackingState = (tracking: SurveyQuestionsDraftTrackingState = {}) => {
    if (!tracking || typeof tracking !== 'object') return;
    if (Object.prototype.hasOwnProperty.call(tracking, 'draftParseCache')) {
      inst._draftParseCache = tracking.draftParseCache ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(tracking, 'lastDraftKey')) {
      inst._lastDraftKey = String(tracking.lastDraftKey || '');
    }
    if (Object.prototype.hasOwnProperty.call(tracking, 'lastDraftJSON')) {
      inst._lastDraftJSON = tracking.lastDraftJSON ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(tracking, 'lastDraftSemanticSignature')) {
      inst._lastDraftSemanticSignature = tracking.lastDraftSemanticSignature ?? null;
    }
  };

const invalidateResponseHydrationRuns = () => {
    inst._fetchSurveyResponseRunId = (Number(inst._fetchSurveyResponseRunId) || 0) + 1;
    inst._fetchSingleQuestionRunId = (Number(inst._fetchSingleQuestionRunId) || 0) + 1;
    inst._localCacheRehydrateRunId = (Number(inst._localCacheRehydrateRunId) || 0) + 1;
    if (inst._isMounted && stateRef.current.isLoadingResponse) {
      setState(buildResponseHydrationInvalidatedState());
    }
  };

const setResponseHydrationState = (next: SurveyQuestionsStateUpdate, callback?: SurveyQuestionsSetStateCallback) => {
    inst._responseHydrationStateUpdateDepth += 1;
    const release = () => {
      inst._responseHydrationStateUpdateDepth = Math.max(
        0,
        (Number(inst._responseHydrationStateUpdateDepth) || 0) - 1,
      );
    };

    try {
      return setState(next, () => {
        try {
          return typeof callback === 'function' ? callback() : undefined;
        } finally {
          release();
        }
      });
    } catch (error: unknown) {
      release();
      throw error;
    }
  };

const _applyDraftHydrationEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    draftEntry = null,
    allowOverwrite = false,
  }: SurveyQuestionsDraftHydrationEntryArgs = {}) => {
    if (!targetSlice || !draftEntry) return false;
    const targetAnswers = targetSlice.answers as Record<string, SurveyQuestionsResponseFieldState>;
    const targetAdditional = targetSlice.additionalComments as Record<string, SurveyQuestionsResponseFieldState>;
    const targetImportance = targetSlice.importance as Record<string, unknown>;
    const targetConviction = targetSlice.conviction as Record<string, unknown>;
    const patch: SurveyQuestionsHydrationPatch = buildDraftHydrationPatchForQuestion({
      questionId,
      draftEntry,
      currentAnswer: targetAnswers?.[questionId],
      currentAdditional: targetAdditional?.[questionId],
      hasCurrentImportance: Object.prototype.hasOwnProperty.call(targetImportance || {}, questionId),
      hasCurrentConviction: Object.prototype.hasOwnProperty.call(targetConviction || {}, questionId),
      allowOverwrite,
      deps: {
        normalizeResponseEncryptionAudience: normalizeResponseEncryptionAudience,
        normalizeFieldAudienceMode: normalizeFieldAudienceMode,
        buildInheritedAdditionalFieldState: buildInheritedAdditionalFieldState,
        buildEmptyResponseFieldState: buildEmptyResponseFieldState,
      },
    });
    if (patch.answerState) targetAnswers[questionId] = patch.answerState;
    if (patch.additionalState) targetAdditional[questionId] = patch.additionalState;
    if (patch.importanceChanged) targetImportance[questionId] = patch.importanceValue;
    if (patch.convictionChanged) targetConviction[questionId] = patch.convictionValue;
    return !!patch.changed;
  };

const _applyResponseHydrationEntryToSlice = ({
    targetSlice = null,
    currentSlice = null,
    questionId = '',
    response = null,
    allowOverwrite = false,
    parseValue = parseAnswerValue,
  }: SurveyQuestionsResponseHydrationEntryArgs = {}) => {
    if (!targetSlice || !response) return false;
    const sourceSlice = currentSlice || targetSlice;
    const targetAnswers = targetSlice.answers as Record<string, SurveyQuestionsResponseFieldState>;
    const targetAdditional = targetSlice.additionalComments as Record<string, SurveyQuestionsResponseFieldState>;
    const targetImportance = targetSlice.importance as Record<string, unknown>;
    const targetConviction = targetSlice.conviction as Record<string, unknown>;
    const sourceAnswers = sourceSlice.answers as Record<string, SurveyQuestionsResponseFieldState>;
    const sourceAdditional = sourceSlice.additionalComments as Record<string, SurveyQuestionsResponseFieldState>;
    const sourceImportance = sourceSlice.importance as Record<string, unknown>;
    const sourceConviction = sourceSlice.conviction as Record<string, unknown>;
    const patch: SurveyQuestionsHydrationPatch = buildQuestionResponseHydrationPatch({
      questionId,
      response: response as Record<string, unknown>,
      currentAnswer: sourceAnswers?.[questionId],
      currentAdditional: sourceAdditional?.[questionId],
      hasCurrentImportance: Object.prototype.hasOwnProperty.call(sourceImportance || {}, questionId),
      hasCurrentConviction: Object.prototype.hasOwnProperty.call(sourceConviction || {}, questionId),
      allowOverwrite,
      deps: {
        parseValue,
        areEnvelopesEquivalent: areEnvelopesEquivalent as any,
        normalizeResponseEncryptionAudience: normalizeResponseEncryptionAudience,
        getDefaultResponseEncryptionAudienceForQid: getDefaultResponseEncryptionAudienceForQid,
        resolveFieldEncryptionGateId: resolveFieldEncryptionGateId,
        normalizeFieldAudienceMode: normalizeFieldAudienceMode,
        buildInheritedAdditionalFieldState: buildInheritedAdditionalFieldState,
        buildEmptyResponseFieldState: buildEmptyResponseFieldState,
      },
    });
    if (patch.answerState) targetAnswers[questionId] = patch.answerState;
    if (patch.additionalState) targetAdditional[questionId] = patch.additionalState;
    if (patch.importanceChanged) targetImportance[questionId] = patch.importanceValue;
    if (patch.convictionChanged) targetConviction[questionId] = patch.convictionValue;
    return !!patch.changed;
  };

const _applyResponseHydrationListToSlice = ({
    targetSlice = null,
    currentSlice = null,
    responses = [],
    allowOverwrite = false,
    parseValue = parseAnswerValue,
    questionIdResolver = (response: unknown) => {
      const responseRecord = response && typeof response === 'object'
        ? response as Record<string, unknown>
        : {};
      return normalizeQuestionIdKey(responseRecord.questionID || responseRecord.questionId);
    },
  }: SurveyQuestionsResponseHydrationListArgs = {}) => {
    if (!targetSlice) return false;
    const list = Array.isArray(responses) ? responses : [responses];
    let changed = false;
    list.forEach((response: unknown) => {
      const qid = (questionIdResolver as SurveyQuestionsQuestionIdResolver)(response);
      if (!qid) return;
      if (inst._applyResponseHydrationEntryToSlice({
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

const _applyCachedResponseEntryToSlice = ({
    targetSlice = null,
    questionId = '',
    response = null,
    parseValue = parseAnswerValue,
  }: SurveyQuestionsCachedResponseEntryArgs = {}) => {
    if (!targetSlice || !response) return false;
    const targetAnswers = targetSlice.answers as Record<string, SurveyQuestionsResponseFieldState>;
    const targetAdditional = targetSlice.additionalComments as Record<string, SurveyQuestionsResponseFieldState>;
    const targetImportance = targetSlice.importance as Record<string, unknown>;
    const targetConviction = targetSlice.conviction as Record<string, unknown>;
    const patch: SurveyQuestionsHydrationPatch = buildQuestionCacheHydrationPatch({
      questionId,
      response: response as Record<string, unknown>,
      deps: {
        parseValue,
        normalizeResponseEncryptionAudience: normalizeResponseEncryptionAudience,
        getDefaultResponseEncryptionAudienceForQid: getDefaultResponseEncryptionAudienceForQid,
        resolveFieldEncryptionGateId: resolveFieldEncryptionGateId,
        normalizeFieldAudienceMode: normalizeFieldAudienceMode,
        buildInheritedAdditionalFieldState: buildInheritedAdditionalFieldState,
        buildEmptyResponseFieldState: buildEmptyResponseFieldState,
      },
    });
    if (patch.answerState) targetAnswers[questionId] = patch.answerState;
    if (patch.additionalState) targetAdditional[questionId] = patch.additionalState;
    if (patch.importanceChanged) targetImportance[questionId] = patch.importanceValue;
    if (patch.convictionChanged) targetConviction[questionId] = patch.convictionValue;
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
  }: SurveyQuestionsLocalCacheHydrationEntryArgs = {}) => {
    if (!targetSlice || !questionId) return false;
    const targetAnswers = targetSlice.answers as Record<string, SurveyQuestionsResponseFieldState>;
    const targetAdditional = targetSlice.additionalComments as Record<string, SurveyQuestionsResponseFieldState>;
    const targetImportance = targetSlice.importance as Record<string, unknown>;
    const targetConviction = targetSlice.conviction as Record<string, unknown>;
    let changed = false;

    if (
      cachedAnswer &&
      (
        allowMaskedAnswerDraftEmpty ||
        targetAnswers?.[questionId]?.value === undefined ||
        (
          targetAnswers?.[questionId]?.value === '' &&
          !targetAnswers?.[questionId]?.encryptedPortion
        )
      )
    ) {
      targetAnswers[questionId] = {
        ...(targetAnswers[questionId] || {}),
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
        targetAdditional?.[questionId]?.value === undefined ||
        (
          targetAdditional?.[questionId]?.value === '' &&
          !targetAdditional?.[questionId]?.encryptedPortion
        )
      )
    ) {
      targetAdditional[questionId] = {
        ...(targetAdditional[questionId] || {}),
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
      !Object.prototype.hasOwnProperty.call(targetImportance || {}, questionId)
    ) {
      targetImportance[questionId] = Number(cachedImportance);
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
      !Object.prototype.hasOwnProperty.call(targetConviction || {}, questionId)
    ) {
      targetConviction[questionId] = Number(cachedConviction);
      changed = true;
      if (debugLabel) {
        DEBUG_PREFILL && surveyLog.log(`${debugLabel} Hydrated conviction for qid=${questionId}`, {
          fromCache: cachedConviction,
        });
      }
    }

    return changed;
  };

const setManagedTimeout = (fn: SurveyQuestionsTimeoutCallback, delayMs: unknown = 0) => {
    const timeoutId = setTimeout(() => {
      inst._transientTimeouts.delete(timeoutId);
      if (!inst._isMounted) return;
      try { fn(); } catch (e: unknown) { surveyLog.warn('SurveyTool: callback', e); }
    }, Math.max(0, Number(delayMs) || 0));
    inst._transientTimeouts.add(timeoutId);
    return timeoutId;
  };

const clearManagedTimeouts = () => {
    if (!inst._transientTimeouts || inst._transientTimeouts.size === 0) return;
    inst._transientTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    inst._transientTimeouts.clear();
  };

const clearSingleQuestionBootstrapRetry = () => {
    if (inst._singleQuestionBootstrapRetryTimer) {
      clearTimeout(inst._singleQuestionBootstrapRetryTimer);
      inst._singleQuestionBootstrapRetryTimer = null;
    }
    inst._singleQuestionBootstrapRetrySig = '';
  };

const getPendingSingleQuestionBootstrapRetryAttempt = (questionId: unknown = '') => {
    const qid = String(questionId || propsRef.current.questionID || '').trim().toLowerCase();
    if (!qid) return 0;
    const currentRetrySig = String(inst._singleQuestionBootstrapRetrySig || '').trim().toLowerCase();
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
        (window.__CE_SINGLE_Q_DEBUG__ && typeof window.__CE_SINGLE_Q_DEBUG__ === 'object')
          ? window.__CE_SINGLE_Q_DEBUG__
          : {};
      window.__CE_SINGLE_Q_DEBUG__ = {
        ...prev,
        ...patch,
        updatedAt: Date.now(),
      };
    } catch (e: unknown) { surveyLog.warn('SurveyTool: fallback', e); }
  };

const scheduleSingleQuestionBootstrapRetry = ({ questionId = '', attempt = 0, reason = '' }: SurveyQuestionsBootstrapRetryArgs = {}) => {
    const qid = String(questionId || propsRef.current.questionID || '').trim().toLowerCase();
    if (!qid || !inst._isMounted) return false;

    const maxAttempts = 6;
    const nextAttempt = Math.max(1, Number(attempt || 0) + 1);
    if (nextAttempt > maxAttempts) return false;

    const currentRetrySig = String(inst._singleQuestionBootstrapRetrySig || '').trim().toLowerCase();
    if (currentRetrySig) {
      const [currentQid = '', currentAttemptToken = '0'] = currentRetrySig.split(':');
      const currentAttempt = Number(currentAttemptToken || 0);
      if (currentQid === qid && Number.isFinite(currentAttempt) && currentAttempt >= nextAttempt) {
        return true;
      }
    }

    const retrySig = `${qid}:${nextAttempt}`;
    if (inst._singleQuestionBootstrapRetrySig === retrySig) return true;

    clearSingleQuestionBootstrapRetry();
    inst._singleQuestionBootstrapRetrySig = retrySig;
    const delayMs = Math.min(25000, 4000 * nextAttempt);

    inst._singleQuestionBootstrapRetryTimer = setTimeout(() => {
      inst._singleQuestionBootstrapRetryTimer = null;
      inst._singleQuestionBootstrapRetrySig = '';
      if (!inst._isMounted) return;
      fetchSingleQuestionData({
        forceQuestionMetadataRefetch: true,
        bootstrapRetryAttempt: nextAttempt,
      }).catch((error: unknown) => {
        const errorRecord = error && typeof error === 'object'
          ? error as { message?: unknown }
          : null;
        surveyLog.error('SurveyQuestions: bootstrap retry failed', {
          questionId: qid,
          attempt: nextAttempt,
          reason,
          error: errorRecord?.message || String(error),
        });
      });
    }, delayMs);

    return true;
  };

const shouldUseAnimationFrameForAutoDecryptSweep = () => {
    if (typeof window === 'undefined') return false;
    if (typeof window.requestAnimationFrame !== 'function') return false;
    if (typeof document !== 'undefined' && document.hidden) return false;
    const ua = String((typeof navigator !== 'undefined' && navigator.userAgent) || '');
    if (/jsdom/i.test(ua)) return false;
    return true;
  };

const clearAutoDecryptSweepScheduling = () => {
    inst._autoDecryptSweepMicrotaskScheduled = false;
    inst._queuedAutoDecryptSweepReasons.clear();
    if (inst._autoDecryptSweepFrameRequestId != null && typeof window !== 'undefined') {
      try { window.cancelAnimationFrame(inst._autoDecryptSweepFrameRequestId); } catch (e: unknown) { surveyLog.warn('SurveyTool: cleanup', e); }
    }
    inst._autoDecryptSweepFrameRequestId = null;
  };

const flushQueuedAutoDecryptVisibleSweep = () => {
    inst._autoDecryptSweepFrameRequestId = null;
    inst._queuedAutoDecryptSweepReasons.clear();
    if (!inst._isMounted) return;
    if (!stateRef.current.autoDecryptEnabled || isAutoDecryptBlocked()) return;
    maybeAutoDecryptVisibleFields();
  };

const queueAutoDecryptVisibleSweep = (reason: any = 'unknown') => {
    if (!inst._isMounted) return;
    if (reason) inst._queuedAutoDecryptSweepReasons.add(String(reason));
    if (inst._autoDecryptSweepMicrotaskScheduled) return;
    inst._autoDecryptSweepMicrotaskScheduled = true;
    scheduleMicrotask(() => {
      inst._autoDecryptSweepMicrotaskScheduled = false;
      if (!inst._isMounted) return;
      if (inst._autoDecryptSweepFrameRequestId != null) return;
      const flush: any = () => flushQueuedAutoDecryptVisibleSweep();
      if (shouldUseAnimationFrameForAutoDecryptSweep()) {
        inst._autoDecryptSweepFrameRequestId = window.requestAnimationFrame(flush);
        return;
      }
      flush();
    });
  };

const buildAutoDecryptMaskedFieldSignature = (field: any = null) =>
    (buildAutoDecryptMaskedFieldSignatureHelper as any)(field);

const buildDecryptContextSnapshot = () => {
    const draftSlug: any = inst._getEffectiveDraftSlug
      ? inst._getEffectiveDraftSlug()
      : resolveEffectiveSlug(propsRef.current);
    const hydrationContext: any = resolveDecryptHydrationContext(propsRef.current, draftSlug);
    const singleQuestionMode: any = !!propsRef.current.singleQuestionMode;
    const isStandalone: any = !!propsRef.current.isStandalone;
    return {
      account: String(propsRef.current?.account || '').trim().toLowerCase(),
      providerKind: String((cryptoUtils as any).getProviderKind(propsRef.current?.provider) || '').trim().toLowerCase(),
      sessionSlug: normalizeSessionSlugValue(hydrationContext.sessionSlug || draftSlug || ''),
      networkID: String(
        hydrationContext.networkIdStr ||
        propsRef.current?.networkID ||
        propsRef.current?.network?.id ||
        propsRef.current?.network?.chainId ||
        ''
      ).trim(),
      responder: String(
        propsRef.current?.responderAddress ||
        propsRef.current?.viewAddress ||
        ''
      ).trim().toLowerCase(),
      provider: propsRef.current?.provider,
      loginComplete: !!propsRef.current?.loginComplete,
      singleQuestionMode,
      isStandalone,
      surveyIndex: singleQuestionMode || isStandalone ? 0 : (propsRef.current?.surveyIndex || 0),
      surveyId: propsRef.current?.surveyId || propsRef.current?.surveyID || '',
      questionID: propsRef.current?.questionID || '',
      mounted: !!inst._isMounted,
    };
  };

const buildDecryptContextKey = (snapshot: any = null) =>
    buildDecryptContextKeyFromContext(snapshot || buildDecryptContextSnapshot());

const isDecryptContextCurrent = (snapshot: any = null) => (
    !!snapshot &&
    (!snapshot.mounted || inst._isMounted) &&
    buildDecryptContextKey(snapshot) === buildDecryptContextKey()
  );

const canUpdateStateForAsyncSnapshot = (snapshot: any = null) => (
    !!snapshot &&
    (!snapshot.mounted || inst._isMounted)
  );

const startSurveyDecryptAttempt = () => {
    const attemptId: any = (Number(inst._surveyDecryptAttemptSeq) || 0) + 1;
    inst._surveyDecryptAttemptSeq = attemptId;
    inst._activeSurveyDecryptAttemptSeq = attemptId;
    return attemptId;
  };

const canUpdateSurveyDecryptAttempt = (snapshot: any = null, attemptId: any = null) => (
    canUpdateStateForAsyncSnapshot(snapshot) &&
    Number(attemptId || 0) > 0 &&
    inst._activeSurveyDecryptAttemptSeq === attemptId
  );

const finishSurveyDecryptAttempt = (attemptId: any = null) => {
    if (Number(attemptId || 0) > 0 && inst._activeSurveyDecryptAttemptSeq === attemptId) {
      inst._activeSurveyDecryptAttemptSeq = 0;
    }
  };

const registerQuestionDecryptBusyTokens = (keysToMark: any = []) => {
    const result: any = (buildQuestionDecryptBusyTokenRegistrationHelper as any)({
      tokenSeq: inst._questionDecryptBusyTokenSeq,
      busyTokens: inst._questionDecryptBusyTokens,
      keysToMark,
    });
    inst._questionDecryptBusyTokenSeq = result.token;
    inst._questionDecryptBusyTokens = result.busyTokens;
    return result.token;
  };

const clearQuestionDecryptBusyTokens = (keysToClear: any = [], token: any = null) => {
    inst._questionDecryptBusyTokens = (buildClearedQuestionDecryptBusyTokensHelper as any)({
      busyTokens: inst._questionDecryptBusyTokens,
      keysToClear,
      token,
    });
  };

const ownsQuestionDecryptBusyTokens = (keysToCheck: any = [], token: any = null) =>
    (ownsQuestionDecryptBusyTokensHelper as any)({
      busyTokens: inst._questionDecryptBusyTokens,
      keysToCheck,
      token,
    });

const buildQuestionDecryptOwnedClearState = (
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
      busyTokens: inst._questionDecryptBusyTokens,
      activeSurveyDecryptAttemptSeq: inst._activeSurveyDecryptAttemptSeq,
      extraPatch,
    });
    inst._questionDecryptBusyTokens = result.busyTokens;
    return result.statePatch;
  };

const buildQuestionDecryptStaleState = (prev: any, questionId: any, fieldToDecrypt: any = 'both', token: any = null) => {
    // Regression guard: stale decrypt cleanup may only clear busy flags it owns.
    // A newer decrypt for the same field can start after engine attempt's await.
    return buildQuestionDecryptOwnedClearState(prev, questionId, fieldToDecrypt, token);
  };

const buildQuestionDecryptFailureStateForAttempt = (prev: any, questionId: any, fieldToDecrypt: any = 'both', errorMessage: any = '', token: any = null) => {
    const patch: any = buildQuestionDecryptOwnedClearState(prev, questionId, fieldToDecrypt, token, {
      submissionError: errorMessage || 'Decryption failed.',
    });
    if (patch) return patch;
    return null;
  };

const buildDecryptTaskKey = (mode: any, questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null, decryptContext: any = null) => {
    const baseKey: any = (buildDecryptTaskKeyHelper as any)(
      mode,
      questionId,
      fieldToDecrypt,
      responseOverride,
      String(
      propsRef.current?.responderAddress ||
      propsRef.current?.viewAddress ||
      ''
      ),
    );
    return `${baseKey}|${buildDecryptContextKey(decryptContext || buildDecryptContextSnapshot())}`;
  };

const getQuestionFieldTaskKey = (questionId: any, fieldKey: any = 'answer') => {
    return (getQuestionFieldTaskKeyHelper as any)(questionId, fieldKey);
  };

const isQuestionFieldBusy = (questionId: any, fieldKey: any = 'answer') => {
    const taskKey: any = getQuestionFieldTaskKey(questionId, fieldKey);
    if (!taskKey) return false;
    return !!(stateRef.current.decryptingByKey && stateRef.current.decryptingByKey[taskKey]);
  };

const getQuestionFieldDecryptSelection = (
    questionId: any,
    fieldToDecrypt: any = 'both',
    responseSlice: any = null,
  ) => (getQuestionFieldDecryptSelectionHelper as any)(questionId, fieldToDecrypt, responseSlice);

const decryptQuestionRatingEnvelopes = async (
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

const decryptQuestionRatingEnvelopeMap = async (
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

const buildQuestionDecryptExecutionContext = (baselineForDecrypt: any, questionId: any) => {
    const litHooks: any =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return (buildQuestionDecryptExecutionContextHelper as any)({
      baselineForDecrypt,
      questionId,
      provider: propsRef.current.provider,
      account: propsRef.current.account,
      network: propsRef.current.network,
      questionPool: stateRef.current.questionPool,
      pileQuestions: stateRef.current.pileQuestions,
      litHooks,
      hasher: stateRef.current.hasher,
      resolveDecryptSurveyId: resolveDecryptSurveyId,
      getProviderKind: (cryptoUtils as any).getProviderKind,
    });
  };

const buildSurveyDecryptExecutionContext = (sourceSlice: any, questionId: any = null) => {
    const litHooks: any =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return (buildSurveyDecryptExecutionContextHelper as any)({
      sourceSlice,
      questionId,
      provider: propsRef.current.provider,
      account: propsRef.current.account,
      network: propsRef.current.network,
      questionPool: stateRef.current.questionPool,
      pileQuestions: stateRef.current.pileQuestions,
      litHooks,
      hasher: stateRef.current.hasher,
      resolveDecryptSurveyId: resolveDecryptSurveyId,
      getProviderKind: (cryptoUtils as any).getProviderKind,
    });
  };

const buildViewedResponseDecryptSuccessState = (
    prevState: any,
    options: any = {},
  ) => (buildViewedResponseDecryptSuccessStateHelper as any)(prevState, options);

const buildSelfQuestionDecryptSuccessState = (
    prevState: any,
    options: any = {},
  ) => (buildSelfQuestionDecryptSuccessStateHelper as any)(prevState, options, deepClone);

const buildSurveyDecryptSuccessState = (
    prevState: any,
    options: any = {},
  ) => (buildSurveyDecryptSuccessStateHelper as any)(prevState, options, deepClone);

const syncDecryptedQuestionIntoBaseline = (
    editBaseline: any,
    fallbackBaseline: any,
    nextTargetStateSlice: any,
    options: any = {},
  ) => (syncDecryptedQuestionIntoBaselineHelper as any)(
    editBaseline,
    fallbackBaseline,
    nextTargetStateSlice,
    options,
    deepClone,
  );

const mergeLatestEncryptedQuestionFields = (
    responseSlice: any,
    questionId: any,
    latestResponse: any,
    options: any = {},
  ) => (mergeLatestEncryptedQuestionFieldsHelper as any)(responseSlice, questionId, latestResponse, options);

const mergeQuestionResponseOverrideIntoDecryptSlice = (
    responseSlice: any,
    questionId: any,
    responseOverride: any,
  ) => (mergeQuestionResponseOverrideIntoDecryptSliceHelper as any)(responseSlice, questionId, responseOverride);

const buildSurveyDecryptSourceState = (
    latestResponse: any = null,
    fallbackSourceSlice: any = null,
    previousStateSlice: any = null,
  ) => (buildSurveyDecryptSourceStateHelper as any)(
    latestResponse,
    fallbackSourceSlice,
    previousStateSlice,
    buildSliceFromUserAnswers,
  );

const hydrateLatestQuestionDecryptState = async (
    options: any = {},
  ) => (hydrateLatestQuestionDecryptStateHelper as any)(
    options,
    {
      getQuestionFieldDecryptSelection: getQuestionFieldDecryptSelection,
      readQuestionsCache,
      getLatestQuestionResponse: getLatestQuestionResponse,
      mergeLatestEncryptedQuestionFields: mergeLatestEncryptedQuestionFields,
      mergeQuestionRatingEnvelopeState: mergeQuestionRatingEnvelopeState,
      logWarn: (error: any) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

const prepareViewedQuestionDecryptState = async (
    options: any = {},
  ) => (prepareViewedQuestionDecryptStateHelper as any)(
    options,
    {
      buildViewedResponseDecryptBaseline: buildViewedResponseDecryptBaseline,
      hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptState,
    },
  );

const prepareSelfQuestionDecryptState = async (
    options: any = {},
  ) => (prepareSelfQuestionDecryptStateHelper as any)(
    options,
    {
      buildSelfQuestionDecryptBaseline: buildSelfQuestionDecryptBaseline,
      mergeQuestionResponseOverrideIntoDecryptSlice: mergeQuestionResponseOverrideIntoDecryptSlice,
      mergeQuestionRatingEnvelopeState: mergeQuestionRatingEnvelopeState,
      hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptState,
      logWarn: (error: any) => surveyLog.warn('SurveyTool: fallback', error),
    },
  );

const resolveLatestSurveyDecryptResponse = async (
    options: any = {},
  ) => (resolveLatestSurveyDecryptResponseHelper as any)(
    options,
    {
      getLatestQuestionResponse: (contractScripts as any).getResponse,
      getLatestSurveyResponse: getSurveyResponse,
    },
  );

const prepareSurveyDecryptAttempt = async (
    options: any = {},
  ) => (prepareSurveyDecryptAttemptHelper as any)(
    options,
    {
      resolveLatestSurveyDecryptResponse: resolveLatestSurveyDecryptResponse,
      buildSurveyDecryptSourceState: buildSurveyDecryptSourceState,
      buildSurveyDecryptExecutionContext: buildSurveyDecryptExecutionContext,
    },
  );

const resolveQuestionDecryptHandlingMode = (
    options: any = {},
  ) => (resolveQuestionDecryptHandlingModeHelper as any)(
    options,
    {
      getViewedResponseOverrideForQuestion: getViewedResponseOverrideForQuestion,
    },
  );

const prepareQuestionDecryptAttempt = (
    options: any = {},
  ) => (prepareQuestionDecryptAttemptHelper as any)(
    options,
    {
      getQuestionFieldDecryptSelection: getQuestionFieldDecryptSelection,
      buildQuestionDecryptExecutionContext: buildQuestionDecryptExecutionContext,
    },
  );

const finalizeQuestionDecryptAttempt = async (
    options: any = {},
  ) => (finalizeQuestionDecryptAttemptHelper as any)(
    options,
    {
      decryptSingleField: (cryptoUtils as any).decryptSingleField,
      decryptQuestionRatingEnvelopes: decryptQuestionRatingEnvelopes,
    },
  );

const finalizeSurveyDecryptAttempt = async (
    options: any = {},
  ) => (finalizeSurveyDecryptAttemptHelper as any)(
    options,
    {
      decryptMultipleAnswers: (cryptoUtils as any).decryptMultipleAnswers,
      decryptQuestionRatingEnvelopeMap: decryptQuestionRatingEnvelopeMap,
      normalizeBulkDecryptedSliceForSurveyState: normalizeBulkDecryptedSliceForSurveyState,
    },
  );

const normalizeBulkDecryptedSliceForSurveyState = (
    decryptedSlice: any,
    options: any = {},
  ) => (normalizeBulkDecryptedSliceForSurveyStateHelper as any)(decryptedSlice, options);

const mergeQuestionRatingEnvelopeState = (previousState: any, nextSource: any, questionId: any = null) =>
    (mergeQuestionRatingEnvelopeStateHelper as any)(previousState, nextSource, questionId);

const buildQuestionDecryptStartState = (prevState: any, keysToMark: any = []) =>
    (buildQuestionDecryptStartStateHelper as any)(prevState, keysToMark);

const buildQuestionDecryptFailureState = (
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

const buildViewedResponseDecryptBaseline = (responseOverride: any, questionId: any) =>
    (buildViewedResponseDecryptBaselineHelper as any)(
      responseOverride,
      questionId,
      buildSliceFromUserAnswers,
    );

const buildSelfQuestionDecryptBaseline = (surveyIndex: any) =>
    (buildSelfQuestionDecryptBaselineHelper as any)(
      surveyIndex,
      stateRef.current.surveysResponseState,
      stateRef.current.userAnswers,
      buildSliceFromUserAnswers,
      deepClone,
    );

const normalizeSingleQuestionViewedResponse = (rawResponse: any = null) =>
    (normalizeSingleQuestionViewedResponseHelper as any)(rawResponse);

const runDedupedDecryptTask = (taskKey: any, runner: any) =>
    (runDedupedDecryptTaskHelper as any)(inst._decryptFieldTaskInFlight, taskKey, runner);

const clearGateSbtHydrationRetry = () => {
    if (!inst._gateSbtHydrationRetryTimer) return;
    clearTimeout(inst._gateSbtHydrationRetryTimer);
    inst._transientTimeouts.delete(inst._gateSbtHydrationRetryTimer);
    inst._gateSbtHydrationRetryTimer = null;
  };

const scheduleGateSbtHydrationRetry = () => {
    if (!inst._isMounted) return;
    if (inst._gateSbtHydrationRetryTimer) return;
    inst._gateSbtHydrationRetryTimer = setManagedTimeout(() => {
      inst._gateSbtHydrationRetryTimer = null;
      hydrateGateSbtLabels({ force: true });
    }, GATE_SBT_HYDRATION_RETRY_MS);
  };

const isResponseJsonPreviewVisible = (stateIn: any = stateRef.current) => (
    !!(stateIn && stateIn.showResponseJson)
  );

const scheduleJsonPreviewUpdate = (delayMs: any = 120, force: any = false) => {
    if (!force && !isResponseJsonPreviewVisible()) return;
    if (inst._jsonPreviewTimer) clearTimeout(inst._jsonPreviewTimer);
    inst._jsonPreviewTimer = setTimeout(() => {
      inst._jsonPreviewTimer = null;
      updateJsonPreview(force);
    }, Math.max(0, Number(delayMs) || 0));
  };

const resolveResponseGateConfigBySlug = (slugIn: any) => {
    const slug: any = String(slugIn || '').trim().toLowerCase();
    return (
      sessionRegistryStore.getSessionConfig(slug) ||
      getStrictSessionConfigBySlug(slug)
    );
  };

const resolveEffectiveResponseGateConfig = (slugIn: any = '', propsSnapshot: any = propsRef.current) => {
    const slug: any = String(slugIn || '').trim().toLowerCase();
    const resolved: any = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: slug,
      sessionConfig: (propsSnapshot?.sessionConfig && typeof propsSnapshot.sessionConfig === 'object')
        ? propsSnapshot.sessionConfig
        : null,
      resolveBySlug: resolveResponseGateConfigBySlug,
    });
    return resolved.effectiveSessionConfig || {};
  };

const resolveSessionChainId = (slugIn: any = '', cfgIn: any = null, propsSnapshot: any = propsRef.current) => {
    const slug: any = String(
      slugIn || (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : resolveEffectiveSlug(propsSnapshot)) || ''
    ).trim().toLowerCase();
    const cfg: any =
      cfgIn && typeof cfgIn === 'object'
        ? cfgIn
        : resolveEffectiveResponseGateConfig(slug, propsSnapshot);
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

const buildResponseGateConfigSignature = (cfg: any = {}) => {
    return buildResponseGateConfigSignature(cfg);
  };

const invalidateCanDecryptOtherResponsesTracking = () => {
    inst._canDecryptOtherResponsesRunId += 1;
    inst._canDecryptOtherResponsesKey = '';
    inst._canDecryptOtherResponsesInFlight = null;
  };

const resetBlockedAutoDecryptSweepInternals = () => {
    inst._autoDecQueue = [];
    inst._autoDecProcessing = false;
    inst._autoDecryptMaskedAttemptSignature = {};
    clearAutoDecryptSweepScheduling();
  };

const resetVisibleAutoDecryptSweepState = () => {
    inst._autoDecryptVisibleSweepCache = null;
    resetBlockedAutoDecryptSweepInternals();
  };

const startCanDecryptOtherResponsesRun = (snapshotKey: any = '') => {
    inst._canDecryptOtherResponsesKey = String(snapshotKey || '');
    const runId: any = (Number(inst._canDecryptOtherResponsesRunId) || 0) + 1;
    inst._canDecryptOtherResponsesRunId = runId;
    return runId;
  };

const isCurrentCanDecryptOtherResponsesRun = (runId: any, snapshotKey: any = '') => (
    inst._canDecryptOtherResponsesRunId === runId &&
    inst._canDecryptOtherResponsesKey === String(snapshotKey || '')
  );

const clearCanDecryptOtherResponsesInFlightIfTracked = (tracked: any = null) => {
    if (inst._canDecryptOtherResponsesInFlight === tracked) {
      inst._canDecryptOtherResponsesInFlight = null;
    }
  };

const refreshCanDecryptOtherResponses = async () => {
    try {
      const ctx: any = buildCanDecryptContext({
        getEffectiveDraftSlug: () => resolveResponseGateSessionSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(propsRef.current),
        resolveEffectiveResponseGateConfig: (slug: any) => resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => getResponseGatePolicy(),
        account: propsRef.current?.account || '',
        loginComplete: propsRef.current?.loginComplete,
        singleQuestionMode: isResponseGateQuestionFlow() as any,
        isStandalone: propsRef.current.isStandalone as any,
        sbtCacheRevision: propsRef.current?.sbtCacheRevision || 0,
      });
      const { cfg, slug, snapshot }: any = ctx;
      const preCheck: any = evaluateCanDecryptPreCheck(snapshot);

      if (preCheck.earlyExit) {
        // Invalidate any in-flight checks so they can't race and re-enable decrypt UI.
        invalidateCanDecryptOtherResponsesTracking();
        if (stateRef.current.canDecryptOtherResponses || stateRef.current.canDecryptOtherResponsesStatus !== preCheck.status) {
          setState(buildCanDecryptOtherResponsesState({ status: preCheck.status }));
        }
        return false;
      }

      const snapshotKey: any = String(snapshot.key || '');
      if (snapshotKey === inst._canDecryptOtherResponsesKey && inst._canDecryptOtherResponsesInFlight) {
        return await inst._canDecryptOtherResponsesInFlight;
      }
      const runId: any = startCanDecryptOtherResponsesRun(snapshotKey);

      const run: any = (async () => {
        if (stateRef.current.canDecryptOtherResponsesStatus !== 'checking' &&
          isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)
        ) {
          // Clear any previously granted permission while we verify against the current gate/session/wallet.
          setState(buildCanDecryptOtherResponsesState({ status: 'checking' }));
        }
        const { canDecrypt, status }: any = await resolveCanDecryptGateAccess({
          cfg,
          slug,
          account: snapshot.account,
          resourceKeysToCheck: snapshot.resourceKeysToCheck,
        }, checkSponsoredAccess);
        if (isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)) {
          setState(buildCanDecryptOtherResponsesState({ canDecrypt, status }));
        }
        return canDecrypt;
      })();

      let tracked: any = null;
      tracked = run
        .catch(() => {
          if (isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)) {
            setState(buildCanDecryptOtherResponsesState({ status: 'unknown' }));
          }
          return false;
        })
        .finally(() => {
          // Only clear the pointer if we're still tracking engine exact promise.
          clearCanDecryptOtherResponsesInFlightIfTracked(tracked);
        });
      inst._canDecryptOtherResponsesInFlight = tracked;

      return await inst._canDecryptOtherResponsesInFlight;
    } catch (_: any) {
      try {
        setState(buildCanDecryptOtherResponsesState({ status: 'unknown' }));
      } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      return false;
    }
  };

const buildCanDecryptOtherResponsesSignature = () => {
    try {
      return buildCanDecryptContext({
        getEffectiveDraftSlug: () => resolveResponseGateSessionSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(propsRef.current),
        resolveEffectiveResponseGateConfig: (slug: any) => resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => getResponseGatePolicy(),
        account: propsRef.current?.account || '',
        loginComplete: propsRef.current?.loginComplete,
        singleQuestionMode: isResponseGateQuestionFlow() as any,
        isStandalone: propsRef.current.isStandalone as any,
        sbtCacheRevision: propsRef.current?.sbtCacheRevision || 0,
      }).snapshot.signature;
    } catch (_: any) {
      return '';
    }
  };

const maybeRefreshCanDecryptOtherResponses = () => {
    try {
      const sig: any = buildCanDecryptOtherResponsesSignature();
      if (sig === inst._canDecryptOtherResponsesSig) return;
      inst._canDecryptOtherResponsesSig = sig;
      refreshCanDecryptOtherResponses();
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };

const emitPendingStats = (stats: SurveyQuestionsPendingStatsInput) => {
    if (typeof propsRef.current.onPendingStatsChange !== 'function') return;
    const total = Number(stats?.total || 0);
    const encrypted = Number(stats?.encrypted || 0);
    const submittedSinceLastEdit = !!stateRef.current.submittedSinceLastEdit;
    const isSubmitting = !!stateRef.current.isSubmitting;
    const last = inst._lastPendingStats;
    if (
      last?.total === total &&
      last?.encrypted === encrypted &&
      !!last?.submittedSinceLastEdit === submittedSinceLastEdit &&
      !!last?.isSubmitting === isSubmitting
    ) return;
    inst._lastPendingStats = { total, encrypted, submittedSinceLastEdit, isSubmitting };
    propsRef.current.onPendingStatsChange({ total, encrypted, submittedSinceLastEdit, isSubmitting });
  };

const getPendingStatsSnapshot = () => getPendingStatsSnapshotFromState(stateRef.current);

const getActiveSurveyIndex = (surveyIndexParam?: number | null) => (
    propsRef.current.isStandalone || propsRef.current.singleQuestionMode
      ? 0
      : (surveyIndexParam ?? propsRef.current.surveyIndex ?? 0)
  );

const didEditDiffInputsChange = (prevProps?: SurveyQuestionsProps | null, prevState?: SurveyQuestionsState | null) => {
    if (!prevProps || !prevState) return true;
    const prevSessionSlugHint = getSessionSlugHintFromProps(prevProps);
    const nextSessionSlugHint = getSessionSlugHintFromProps(propsRef.current);
    const prevSessionSlugPinned = getSessionSlugPinnedFromProps(prevProps);
    const nextSessionSlugPinned = getSessionSlugPinnedFromProps(propsRef.current);
    const prevStateQuestionPoolSig = buildQuestionIdScopeSignature(prevState.questionPool);
    const nextStateQuestionPoolSig = buildQuestionIdScopeSignature(stateRef.current.questionPool);
    const prevStatePileQuestionsSig = buildQuestionIdScopeSignature(prevState.pileQuestions);
    const nextStatePileQuestionsSig = buildQuestionIdScopeSignature(stateRef.current.pileQuestions);
    const prevPropsQuestionPoolSig = buildQuestionIdScopeSignature(prevProps.questionPool);
    const nextPropsQuestionPoolSig = buildQuestionIdScopeSignature(propsRef.current.questionPool);
    if (prevState.surveysResponseState !== stateRef.current.surveysResponseState) return true;
    if (prevState.editBaseline !== stateRef.current.editBaseline) return true;
    if (prevState.userAnswers !== stateRef.current.userAnswers) return true;
    if (prevStateQuestionPoolSig !== nextStateQuestionPoolSig) return true;
    if (prevStatePileQuestionsSig !== nextStatePileQuestionsSig) return true;
    if (prevPropsQuestionPoolSig !== nextPropsQuestionPoolSig) return true;
    if (prevProps.isStandalone !== propsRef.current.isStandalone) return true;
    if (prevProps.minifiedMode !== propsRef.current.minifiedMode) return true;
    if (prevProps.surveyIndex !== propsRef.current.surveyIndex) return true;
    if (prevProps.surveyId !== propsRef.current.surveyId) return true;
    if (prevProps.viewAddress !== propsRef.current.viewAddress) return true;
    if (prevProps.account !== propsRef.current.account) return true;
    if (prevProps.loginComplete !== propsRef.current.loginComplete) return true;
    if (prevProps.singleQuestionMode !== propsRef.current.singleQuestionMode) return true;
    if (prevProps.questionID !== propsRef.current.questionID) return true;
    if (prevProps.responderAddress !== propsRef.current.responderAddress) return true;
    if (prevProps.network?.id !== propsRef.current.network?.id) return true;
    if (prevProps.networkChainId !== propsRef.current.networkChainId) return true;
    if (prevSessionSlugHint !== nextSessionSlugHint) return true;
    if (prevSessionSlugPinned !== nextSessionSlugPinned) return true;
    return false;
  };

const invalidateDiffCaches = () => {
    inst._changedQidsAndFieldsCache = null;
    inst._pendingEditStatsCache = null;
  };

const runDefaultComponentDidMount = () => {
    // Force-disable auto-decrypt on wagmi/porto at mount; also clear any in-flight state
    if (isAutoDecryptBlocked()) {
      resetBlockedAutoDecryptSweepInternals();
      setState(buildAutoDecryptDisabledState());
    }

    // Lazy load ZK-compatible Poseidon hasher (poseidon-lite)
    inst._isMounted = true;
    inst._hasMounted = true;
    const loadHasher: any = async () => {
      try {
        const { poseidon }: any = await import('poseidon-lite');
        if (typeof poseidon === 'function' && inst._isMounted) {
          setState(buildHasherState(poseidon));
          surveyLog.log("✅ ZK-Compatible Poseidon Hasher Loaded (poseidon-lite)");
        }
      } catch (e: any) {
        surveyLog.warn("⚠️ Failed to load Real Poseidon. Falling back to Keccak (Non-ZK).", e);
      }
    };
    loadHasher();

    loadBookmarks();
    hydrateGateSbtLabels();
    try {
      const slugSig: any = normalizeSessionSlugValue(inst._getEffectiveDraftSlug() || resolveEffectiveSlug(propsRef.current));
      const acctSig: any = String(propsRef.current.account || '').trim().toLowerCase();
      inst._priorResponseHydrationContextSig = `${slugSig}|${acctSig}`;
      inst._priorResponseBackfillAttempted = new Set();
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    // Determine whether the connected wallet satisfies the response gate; used to show/hide decrypt buttons
    // when viewing another wallet's encrypted response.
    try { maybeRefreshCanDecryptOtherResponses(); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    if (propsRef.current.singleQuestionMode) {
      (async () => {
        await fetchSingleQuestionData();
        updateJsonPreview();
        // Quick local-cache rehydrate for non-encrypted prior answers (single Q)
        rehydrateLocalCacheAnswersForRenderedIds();

        if (propsRef.current.responderAddress) {
          setState(buildViewingResponseModeState(), async () => {
            if (propsRef.current.account && propsRef.current.account.toLowerCase() === propsRef.current.responderAddress.toLowerCase()) {
              if (stateRef.current.userHasResponse) {
                // UI will show decrypt/edit or start fresh buttons
              }
            }
          });
        } else {
          setState(buildDisplayAnswerModeState(propsRef.current.displayAnswerMode));
        }
      })();
    } else if (!propsRef.current.isStandalone) { // Survey mode (multiple questions)
      (async () => {
        await fetchQuestionPool();
        const initialStates: any = initializeSurveyResponseState();
        setState(
          buildInitialSurveyResponseState({
            surveysResponseState: initialStates,
            editBaseline: deepClone(initialStates[propsRef.current.surveyIndex || 0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          }),
          async () => {
            rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
            // Quick local-cache rehydrate for non-encrypted prior answers (survey)
            await rehydrateLocalCacheAnswersForRenderedIds(null, { responseHydrationOwned: true });

            // Defer prefill if caches/IDs not ready yet; avoid double-prefill
            if (propsRef.current.isQuestionCacheReady ||
                (Array.isArray(stateRef.current.questionPool) && stateRef.current.questionPool.length > 0)) {
              await fetchSurveyResponse();
              checkAndHandleStartFresh();
            } else {
              setState(buildPrefillQueuedAfterCacheState(true));
            }
          }
        );
      })();
    } else { // Standalone mode (question pool passed as prop)
      const initialSlice: any = initializeSurveyResponseState();
      setState(
        buildInitialStandaloneResponseState({
          surveysResponseState: initialSlice,
          editBaseline: deepClone(initialSlice[0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          jsonPreview: prepareJsonAndHash(0),
        }),
        () => {
          rehydrateDraftForRenderedIds();
          // Quick local-cache rehydrate for non-encrypted prior answers (standalone list)
          rehydrateLocalCacheAnswersForRenderedIds();
        }
      );
    }
  };

const runDefaultComponentDidUpdate = async (prevProps: SurveyQuestionsProps, prevState: SurveyQuestionsState) => {
    const diffInputsChanged = didEditDiffInputsChange(prevProps, prevState);
    if (diffInputsChanged) {
      const propsHydrationContextChanged =
        prevProps.isStandalone !== propsRef.current.isStandalone ||
        prevProps.minifiedMode !== propsRef.current.minifiedMode ||
        prevProps.surveyIndex !== propsRef.current.surveyIndex ||
        prevProps.surveyId !== propsRef.current.surveyId ||
        prevProps.viewAddress !== propsRef.current.viewAddress ||
        prevProps.account !== propsRef.current.account ||
        prevProps.loginComplete !== propsRef.current.loginComplete ||
        prevProps.singleQuestionMode !== propsRef.current.singleQuestionMode ||
        prevProps.questionID !== propsRef.current.questionID ||
        prevProps.responderAddress !== propsRef.current.responderAddress ||
        prevProps.network?.id !== propsRef.current.network?.id ||
        prevProps.networkChainId !== propsRef.current.networkChainId ||
        getSessionSlugHintFromProps(prevProps) !== getSessionSlugHintFromProps(propsRef.current) ||
        getSessionSlugPinnedFromProps(prevProps) !== getSessionSlugPinnedFromProps(propsRef.current) ||
        buildQuestionIdScopeSignature(prevProps.questionPool) !== buildQuestionIdScopeSignature(propsRef.current.questionPool);
      if (propsHydrationContextChanged || !inst._responseHydrationStateUpdateDepth) {
        invalidateResponseHydrationRuns();
      }
      invalidateDiffCaches();
    }
    if (prevState.userAnswers !== stateRef.current.userAnswers) {
      inst._userAnswersSliceCache = { source: null, value: null };
      if (!diffInputsChanged) invalidateDiffCaches();
    }
    if (
      diffInputsChanged ||
      prevProps.questionsCacheNonce !== propsRef.current.questionsCacheNonce ||
      prevProps.questionResponsesNonce !== propsRef.current.questionResponsesNonce
    ) {
      inst._localCacheSliceMemo = { key: '', value: null, hasValue: false };
      inst._rehydrateLocalCacheLastSig = '';
      inst._autoDecryptVisibleSweepCache = null;
    }
    if (
      prevState.questionPool !== stateRef.current.questionPool ||
      prevState.pileQuestions !== stateRef.current.pileQuestions ||
      prevProps.singleQuestionMode !== propsRef.current.singleQuestionMode ||
      prevProps.questionID !== propsRef.current.questionID
    ) {
      inst._currentRenderedQuestionIdsCache = null;
    }

    const pendingStats = diffInputsChanged
        ? ((typeof getPendingEditStats === 'function' && getPendingEditStats()) || getPendingStatsSnapshot())
      : getPendingStatsSnapshot();
    emitPendingStats(pendingStats);
    if (diffInputsChanged && typeof recalculateEditStats === 'function') {
      recalculateEditStats(pendingStats);
    }

    try {
      const slugSig = normalizeSessionSlugValue(inst._getEffectiveDraftSlug() || resolveEffectiveSlug(propsRef.current));
      const acctSig = String(propsRef.current.account || '').trim().toLowerCase();
      const nextSig = `${slugSig}|${acctSig}`;
      if (nextSig !== inst._priorResponseHydrationContextSig) {
        inst._priorResponseHydrationContextSig = nextSig;
        inst._priorResponseBackfillAttempted = new Set();
      }
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }

    // Force-disable auto-decrypt whenever provider/account changes to wagmi/porto
    if (
      (prevProps.provider !== propsRef.current.provider || prevProps.account !== propsRef.current.account) &&
      isAutoDecryptBlocked()
    ) {
      resetBlockedAutoDecryptSweepInternals();
      if (stateRef.current.autoDecryptEnabled || (stateRef.current.decryptingByKey && Object.keys(stateRef.current.decryptingByKey).length > 0)) {
        setState(buildAutoDecryptDisabledState());
      }
    }

    // Keep the "can decrypt viewed responses" capability in sync with wallet/session/gate changes.
    try { maybeRefreshCanDecryptOtherResponses(); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    // Re-trigger auto-decrypt sweep when cache data arrives after initial render.
    // Without engine, an early sweep with empty cache never re-fires, leaving "Decrypt"
    // buttons visible even though the user has permission.
    const cacheJustBecameReady = !prevProps.isResponsesCacheReady && propsRef.current.isResponsesCacheReady;

    const shouldShortCircuitUpdate =
      !diffInputsChanged &&
      prevProps.provider === propsRef.current.provider &&
      prevProps.account === propsRef.current.account &&
      prevProps.loginComplete === propsRef.current.loginComplete &&
      prevProps.lit === propsRef.current.lit &&
      prevProps.litHooks === propsRef.current.litHooks &&
      prevProps.questionID === propsRef.current.questionID &&
      prevProps.responderAddress === propsRef.current.responderAddress &&
      prevProps.surveyId === propsRef.current.surveyId &&
      prevProps.viewAddress === propsRef.current.viewAddress &&
      getSessionSlugHintFromProps(prevProps) === getSessionSlugHintFromProps(propsRef.current) &&
      getSessionSlugPinnedFromProps(prevProps) === getSessionSlugPinnedFromProps(propsRef.current) &&
      prevProps.questionPool === propsRef.current.questionPool &&
      prevProps.isQuestionCacheReady === propsRef.current.isQuestionCacheReady &&
      prevProps.isResponsesCacheReady === propsRef.current.isResponsesCacheReady &&
      prevProps.questionsCacheNonce === propsRef.current.questionsCacheNonce &&
      prevProps.questionResponsesNonce === propsRef.current.questionResponsesNonce &&
      prevProps.sbtCacheRevision === propsRef.current.sbtCacheRevision &&
      prevProps.network?.id === propsRef.current.network?.id &&
      prevProps.networkChainId === propsRef.current.networkChainId &&
      prevState.questionPool === stateRef.current.questionPool &&
      prevState.pileQuestions === stateRef.current.pileQuestions &&
      prevState.autoDecryptEnabled === stateRef.current.autoDecryptEnabled &&
      prevState.showComments === stateRef.current.showComments &&
      prevState.prefillQueuedAfterCache === stateRef.current.prefillQueuedAfterCache;
    if (shouldShortCircuitUpdate) {
      bumpSurveyPerfCounter('noopSkipCount');
      return;
    }

    // Single question mode logic
    if (propsRef.current.singleQuestionMode) {
      const identityChanged =
        prevProps.questionID !== propsRef.current.questionID ||
        prevProps.responderAddress !== propsRef.current.responderAddress;
      const groupContextChanged =
        getSessionSlugHintFromProps(prevProps) !== getSessionSlugHintFromProps(propsRef.current) ||
        getSessionSlugPinnedFromProps(prevProps) !== getSessionSlugPinnedFromProps(propsRef.current);

      // Treat responses-cache-ready as a trigger too
      const cacheTick =
        (prevProps.isQuestionCacheReady !== propsRef.current.isQuestionCacheReady &&
          propsRef.current.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== propsRef.current.isResponsesCacheReady &&
          propsRef.current.isResponsesCacheReady) ||
        (propsRef.current.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== propsRef.current.questionsCacheNonce) ||
        (propsRef.current.isResponsesCacheReady &&
          prevProps.questionResponsesNonce !== propsRef.current.questionResponsesNonce);
      const prevNetId = String(prevProps.network?.id ?? prevProps.networkChainId ?? '');
      const currNetId = String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? '');
      const authOrProviderBecameReady =
        (!prevProps.loginComplete && !!propsRef.current.loginComplete) ||
        (!prevProps.account && !!propsRef.current.account) ||
        (!prevProps.provider && !!propsRef.current.provider);
      const networkBecameReady = prevNetId !== currNetId && !!currNetId;
      const waitingForViewedResponseBootstrap =
        !!propsRef.current.responderAddress &&
        !stateRef.current.parsedViewAddressAnswers &&
        stateRef.current.noResponse !== true;
      const singleQuestionBootstrapPending =
        waitingForViewedResponseBootstrap || (
          !stateRef.current.displayAnswerMode &&
          !stateRef.current.parsedViewAddressAnswers &&
          (!Array.isArray(stateRef.current.questionPool) || stateRef.current.questionPool.length === 0)
        );
      const shouldRetrySingleQuestionBootstrap =
        singleQuestionBootstrapPending && (authOrProviderBecameReady || networkBecameReady);
      const retryMaskedOnReadiness = shouldRetryMaskedQuestionRefresh({
        masked: hasMaskedCurrentQuestionPayload(),
        prev: {
          account: prevProps.account,
          provider: prevProps.provider,
          loginComplete: prevProps.loginComplete,
          litHooks: prevProps.litHooks || null,
          sbtCacheRevision: prevProps.sbtCacheRevision || 0,
        },
        next: {
          account: propsRef.current.account,
          provider: propsRef.current.provider,
          loginComplete: propsRef.current.loginComplete,
          litHooks: propsRef.current.litHooks || null,
          sbtCacheRevision: propsRef.current.sbtCacheRevision || 0,
        },
      });

      if (identityChanged) {
        // Reset submissionComplete when switching questions so fetch logic isn't blocked
        setState(buildResponseLoadingResetState(
          updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset')
        ));
        await fetchSingleQuestionData(); // merge-safe
      } else if (cacheTick || groupContextChanged || retryMaskedOnReadiness || shouldRetrySingleQuestionBootstrap) {
        // Don’t rebuild while user has pending edits; keeps “Submit (X)” stable
        if (stateRef.current.isDirty || (stateRef.current.modifiedCount || 0) > 0) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          return;
        }
        const pendingBootstrapRetryAttempt = getPendingSingleQuestionBootstrapRetryAttempt(propsRef.current.questionID);
        await fetchSingleQuestionData(
          pendingBootstrapRetryAttempt > 0
            ? { bootstrapRetryAttempt: pendingBootstrapRetryAttempt }
            : undefined
        ); // merge-safe
      }

      if (propsRef.current.account !== prevProps.account) {
        // Clear live form state before fetching for new account.
        // We use a callback to ensure rehydration happens on the reset (empty) state,
        // followed by the fetch which merges on-chain data into the draft.
        resetFormStateForAccountChange(async () => {
            setState(buildResponseLoadingResetState(
              updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset')
            ));

            // 1. Apply Draft (Anon answers) onto Empty
            rehydrateDraftForRenderedIds({ responseHydrationOwned: true });

            // 2. Fetch Chain (Merges Chain into Draft)
            const pendingBootstrapRetryAttempt = propsRef.current.singleQuestionMode
              ? getPendingSingleQuestionBootstrapRetryAttempt(propsRef.current.questionID)
              : 0;
            await fetchSingleQuestionData(
              pendingBootstrapRetryAttempt > 0
                ? { bootstrapRetryAttempt: pendingBootstrapRetryAttempt }
                : undefined
            );

            const isViewingOwnResponse =
              propsRef.current.account &&
              propsRef.current.responderAddress &&
              propsRef.current.account.toLowerCase() === propsRef.current.responderAddress.toLowerCase();
            const isViewingNoSpecificResponder =
              propsRef.current.account && !propsRef.current.responderAddress;

            if (
              stateRef.current.userHasResponse &&
              (isViewingOwnResponse || isViewingNoSpecificResponder)
            ) {
              setState(buildEditingResponseModeState());
            }
        });
      }

      if (prevState.questionPool !== stateRef.current.questionPool) {
        setState(
          (prevStateInner: any) => buildQuestionPoolResponseMergeState(prevStateInner, {
            mergeSurveyResponseState: mergeSurveyResponseState,
            questionPool: stateRef.current.questionPool || [],
            surveyIndex: 0,
          }),
          () => {
            updateJsonPreview();
            rehydrateDraftForRenderedIds();
          }
        );
      }
    }

    // Survey mode logic (not standalone and not minified)
    else if (!propsRef.current.isStandalone && !propsRef.current.minifiedMode) {
      const surveyChanged = propsRef.current.surveyId !== prevProps.surveyId;
      const cacheInvalidated =
        (prevProps.isQuestionCacheReady !== propsRef.current.isQuestionCacheReady &&
          propsRef.current.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== propsRef.current.isResponsesCacheReady &&
          propsRef.current.isResponsesCacheReady) ||
        (propsRef.current.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== propsRef.current.questionsCacheNonce) ||
        (propsRef.current.isResponsesCacheReady &&
          prevProps.questionResponsesNonce !== propsRef.current.questionResponsesNonce);

      if (surveyChanged) {
        setState(buildSurveyChangedResetState(
          updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset')
        ));
        await fetchQuestionPool();
        setState(
          buildSurveysResponseStatePatch(initializeSurveyResponseState()),
          async () => {
            await fetchSurveyResponse();
            checkAndHandleStartFresh();
          }
        );
      } else if (cacheInvalidated) {
        // Don’t rebuild while user has pending edits; keeps “Submit (X)” stable
        const hasPendingQuestionPoolHydration = getSurveyQuestionPoolLoadState().isIncomplete;
        if ((stateRef.current.isDirty || (stateRef.current.modifiedCount || 0) > 0) && !hasPendingQuestionPoolHydration) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          // do nothing
        } else {
          await fetchQuestionPool();
          setState(
            (prev: any) => buildSurveyResponseMergeState(prev, {
              mergeSurveyResponseState: mergeSurveyResponseState,
              questionPool: stateRef.current.questionPool || [],
              surveyIndex: propsRef.current.surveyIndex,
            }),
            async () => {
              await fetchSurveyResponse();
              if (!stateRef.current.suppressPrefill) {
                rehydrateDraftForRenderedIds();
              }
            }
          );
        }
      }

      if (
        propsRef.current.account !== prevProps.account ||
        propsRef.current.viewAddress !== prevProps.viewAddress
      ) {
        // Clear live form state before reacting to new account/viewAddress
        resetFormStateForAccountChange(async () => {
            setState(buildSurveyAccountViewResetState({
              parsedViewAddressAnswers:
                propsRef.current.viewAddress !== prevProps.viewAddress
                  ? null
                  : stateRef.current.parsedViewAddressAnswers,
              noResponse:
                propsRef.current.viewAddress !== prevProps.viewAddress
                  ? false
                  : stateRef.current.noResponse,
              submittedSinceLastEdit: updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset'),
            }));

            // 1. Rehydrate draft immediately so it exists before fetch returns
            if (propsRef.current.account && propsRef.current.account !== prevProps.account) {
               rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
            }

            // 2. Fetch Chain (Merges Chain into Draft)
            await fetchSurveyResponse();

            const isViewingOwnSurveyResponse =
              propsRef.current.account &&
              propsRef.current.viewAddress &&
              propsRef.current.account.toLowerCase() === propsRef.current.viewAddress.toLowerCase();
            const isViewingNoSpecificSurvey =
              propsRef.current.account && !propsRef.current.viewAddress;

            if (
              stateRef.current.userHasResponse &&
              (isViewingOwnSurveyResponse || isViewingNoSpecificSurvey)
            ) {
              setState(buildEditingResponseModeState());
            }
        });
      }
    }

    // Standalone mode (QuestionsDashboard)
    else {
      if (prevProps.questionPool !== propsRef.current.questionPool) {
        setState(
          (prevStateInner: any) => buildQuestionPoolResponseMergeState(prevStateInner, {
            includeQuestionPool: true,
            mergeSurveyResponseState: mergeSurveyResponseState,
            questionPool: propsRef.current.questionPool || [],
            surveyIndex: 0,
          }),
          () => {
            updateJsonPreview();
            rehydrateDraftForRenderedIds();
            rehydrateLocalCacheAnswersForRenderedIds();
          }
        );
      }

      if (
        (prevProps.isQuestionCacheReady !== propsRef.current.isQuestionCacheReady &&
          propsRef.current.isQuestionCacheReady) ||
        (prevProps.isResponsesCacheReady !== propsRef.current.isResponsesCacheReady &&
          propsRef.current.isResponsesCacheReady) ||
        (propsRef.current.isQuestionCacheReady &&
          prevProps.questionsCacheNonce !== propsRef.current.questionsCacheNonce) ||
        (propsRef.current.isResponsesCacheReady &&
          prevProps.questionResponsesNonce !== propsRef.current.questionResponsesNonce)
      ) {
        rehydrateLocalCacheAnswersForRenderedIds();
      }

      const standaloneAuthBecameReady =
        (!prevProps.loginComplete && !!propsRef.current.loginComplete) ||
        (!prevProps.account && !!propsRef.current.account) ||
        (!prevProps.provider && !!propsRef.current.provider);

      if (propsRef.current.account !== prevProps.account || standaloneAuthBecameReady) {
        // Clear live form state before reacting to new account
        resetFormStateForAccountChange(() => {
             setState(buildStandaloneAuthResetState(
              updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset')
            ));
            // Standalone mode typically relies on local cache or props,
            // but we should also rerun cache/prior-response hydration when auth becomes ready.
            rehydrateDraftForRenderedIds();
            rehydrateLocalCacheAnswersForRenderedIds();
        });
      }
    }

    // Auto-decrypt sweep when enabled and inputs change
    if (
      stateRef.current.autoDecryptEnabled &&
      (
        prevState.surveysResponseState !== stateRef.current.surveysResponseState ||
        prevState.autoDecryptEnabled !== stateRef.current.autoDecryptEnabled ||
        prevState.questionPool !== stateRef.current.questionPool ||
        prevProps.account !== propsRef.current.account ||
        cacheJustBecameReady
      ) &&
      !isAutoDecryptBlocked()
    ) {
      queueAutoDecryptVisibleSweep('state-change');
    }

    // Trigger sweep when auto-decrypt gets enabled
    if (!prevState.autoDecryptEnabled && stateRef.current.autoDecryptEnabled && !isAutoDecryptBlocked()) {
      queueAutoDecryptVisibleSweep('enabled');
    }

    // Trigger when the comments panel toggles (user reveals additional comments)
    if (stateRef.current.autoDecryptEnabled && prevState.showComments !== stateRef.current.showComments && !isAutoDecryptBlocked()) {
      queueAutoDecryptVisibleSweep('comments-toggle');
    }

    // Consume queued prefill once caches flip ready — but NEVER while user has edits
    if (
      stateRef.current.prefillQueuedAfterCache &&
      !stateRef.current.isDirty &&
      (propsRef.current.isQuestionCacheReady || propsRef.current.isResponsesCacheReady)
    ) {
      await fetchSurveyResponse();
      setState(buildPrefillQueuedAfterCacheState(false));
    }

    if (
      prevProps.sbtCacheRevision !== propsRef.current.sbtCacheRevision ||
      prevProps.network?.id !== propsRef.current.network?.id ||
      prevProps.networkChainId !== propsRef.current.networkChainId ||
      prevState.questionPool !== stateRef.current.questionPool ||
      prevState.pileQuestions !== stateRef.current.pileQuestions ||
      prevProps.questionPool !== propsRef.current.questionPool ||
      prevProps.questionsCacheNonce !== propsRef.current.questionsCacheNonce ||
      prevProps.questionResponsesNonce !== propsRef.current.questionResponsesNonce
    ) {
      hydrateGateSbtLabels();
    }
  };

const runDefaultComponentWillUnmount = () => {
    if (inst._emptySubmitTimer) {
      clearTimeout(inst._emptySubmitTimer);
      inst._emptySubmitTimer = null;
    }
    const hasPendingDraftChanges: any =
      !!inst._persistTimer ||
      !!(inst._draftDirtyQids && inst._draftDirtyQids.size > 0) ||
      !!(stateRef.current && (stateRef.current.isDirty || Number(stateRef.current.modifiedCount || 0) > 0));
    if (inst._persistTimer) {
      clearTimeout(inst._persistTimer);
      inst._persistTimer = null;
    }
    if (hasPendingDraftChanges) {
      try { persistDraft(); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    }
    if (inst._jsonPreviewTimer) {
      clearTimeout(inst._jsonPreviewTimer);
      inst._jsonPreviewTimer = null;
    }
    if (inst._autoDecProcessTimer) {
      clearTimeout(inst._autoDecProcessTimer);
      inst._autoDecProcessTimer = null;
    }
    clearAutoDecryptSweepScheduling();
    clearGateSbtHydrationRetry();
    clearManagedTimeouts();
    inst._changedQidsAndFieldsCache = null;
    inst._pendingEditStatsCache = null;
    inst._questionByIdLookupCache = {
      stateQuestionPool: null,
      statePileQuestions: null,
      propsQuestionPool: null,
      value: null,
    };
    inst._currentRenderedQuestionIdsCache = null;
    inst._currentRenderedQuestionIdsCacheQuestionPool = null;
    inst._currentRenderedQuestionIdsCachePileQuestions = null;
    inst._maskedQuestionVisibilityMemoByPool = new WeakMap();
    inst._localCacheSliceMemo = { key: '', value: null, hasValue: false };
    inst._rehydrateLocalCacheLastSig = '';
    inst._autoDecryptVisibleSweepCache = null;
    inst._autoDecryptMaskedAttemptSignature = {};
    inst._decryptFieldTaskInFlight.clear();
    inst._userAnswersSliceCache = { source: null, value: null };
    inst._priorResponseBackfillInFlight = null;
    clearSingleQuestionBootstrapRetry();
    inst._isMounted = false;
    invalidateResponseHydrationRuns();
  };

const _getDraftScope = () => {
    return propsRef.current.singleQuestionMode
      ? 'questions' // Align primary scope with spec; per-QID isolation stays in answers
      : String(propsRef.current?.surveyId || 'questions').toLowerCase();
  };

const _getEffectiveDraftSlug = () => {
    return propsRef.current.singleQuestionMode
      ? resolveSlugForIds({
          questionId: propsRef.current.questionID,
          props: propsRef.current,
          network: propsRef.current.network,
        })
      : resolveSlugForIds({
          surveyId: propsRef.current.surveyId || null,
          props: propsRef.current,
          network: propsRef.current.network,
        });
  };

const getAudioInputWorkerProps = () => {
    // Prefer the explicit route/session slug to avoid cross-cache slug drift on /question routes.
    const explicitSessionSlug: any = resolveEffectiveSlug(propsRef.current);
    const resolvedSession: any = explicitSessionSlug
      ? resolveExplicitSessionContext(explicitSessionSlug)
      : resolveDraftSessionContext(propsRef.current, inst._getEffectiveDraftSlug());
    const sessionSlug: any = resolvedSession.sessionSlug || '';
    const sessionConfig: any = resolvedSession.sessionConfig || null;
    const providerLike: any = typeof propsRef.current.providerLike === 'string'
      ? propsRef.current.providerLike
      : (typeof propsRef.current.provider === 'string' ? propsRef.current.provider : '');
    const chainId: any = resolveSessionChainId(sessionSlug, sessionConfig);
    return {
      sessionSlug,
      sessionConfig,
      context: {
        account: propsRef.current.account || '',
        providerLike,
        chainId,
      },
    };
  };

const buildQuestionDecryptContext = (slugIn: any) => {
    const slug: any = String(slugIn ?? '').trim().toLowerCase();
    const cfg: any = resolveExplicitSessionContext(slug).sessionConfig || null;
    const litHooks: any =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
    return buildQuestionDecryptContextForSession({
      cfg,
      account: propsRef.current.account || '',
      providerLike: propsRef.current.provider || '',
      litHooks,
      fallbackChainId: resolveSessionChainId(slug, cfg),
    });
  };

const buildAutomaticQuestionMetadataFetchOptions = (slugIn: any) => {
    const decryptContext: any = buildQuestionDecryptContext(slugIn);
    return shouldAttemptAutomaticPromptDecrypt()
      ? { decryptContext }
      : { decryptContext, skipDecrypt: true };
  };

const hasMaskedCurrentQuestionPayload = () => {
    if (!propsRef.current.singleQuestionMode) return false;
    const q: any = Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool[0] : null;
    if (q && typeof q === 'object') {
      if (isMaskedQuestionPayload(q)) return true;
      const prompt: any = String(q.prompt || '').trim();
      if (prompt || q.promptDecrypted) return false;
    }
    const qid: any = String(propsRef.current.questionID || '').toLowerCase();
    if (!qid) return false;
    const slug: any = inst._getEffectiveDraftSlug();
    const cfg: any = resolveExplicitSessionContext(slug).sessionConfig || null;
    const netIdStr: any = String(
      propsRef.current.network?.id ?? propsRef.current.networkChainId ?? cfg?.networkChainId ?? ''
    );
    if (!netIdStr) return false;
    const cache: any = readQuestionsCache(slug) || {};
    const cached: any = cache?.[netIdStr]?.questions?.[qid];
    return isMaskedQuestionPayload(cached);
  };

const isMaskedPromptText = (prompt: any) => isSurveyQuestionsMaskedPromptText(prompt);

const getQuestionFetchCandidateSlugs = (questionId: any, preferredSlug: any = '', opts: any = {}) => {
    const sanitize: any = (s: any) => (
      s == null
        ? ''
        : String(s).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    );

    const qid: any = String(questionId || '').trim().toLowerCase();
    const slugPinned: any = getSessionSlugPinnedFromProps(propsRef.current);
    const explicitSlug: any = sanitize(getSessionSlugHintFromProps(propsRef.current));
    const currentQuestionSessionName: any = (stateRef.current.questionPool?.[0] as any)?.sessionName;
    const resolvedSlug: any = sanitize(
      resolveSlugForIds({
        sessionName: propsRef.current.sessionName || currentQuestionSessionName,
        questionId: qid || propsRef.current.questionID || null,
        surveyId: propsRef.current.singleQuestionMode ? null : (propsRef.current.surveyId || null),
        props: propsRef.current,
        network: propsRef.current.network,
      })
    );
    const preferred: any = sanitize(preferredSlug);
    const effective: any = preferred || explicitSlug || resolvedSlug || sanitize(resolveEffectiveSlug(propsRef.current));
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
    pushSlug(resolveEffectiveSlug(propsRef.current));

    if (!slugPinned || allowPinnedFallback) {
      getAllSessionSlugs().forEach((s: any) => pushSlug(s));
      pushSlug('');
    }

    return out;
  };

const cacheQuestionPayloadForSlug = (slugIn: any, questionId: any, questionPayload: any) => {
    const slug: any = String(slugIn ?? '').trim().toLowerCase();
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid || !questionPayload) return;

    const cacheWriteContext: any = resolveQuestionPayloadCacheWriteContext(propsRef.current, slug);
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

const applyQuestionPayloadToRenderedPools = (questionId: any, questionPayload: any) => {
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid || !questionPayload) return;

    setState((prev: any) => buildRenderedQuestionPayloadPoolsState(prev, qid, questionPayload, {
      pickBetterQuestionPayload: pickBetterQuestionPayload as any,
      areQuestionPayloadsEquivalent,
    }));
  };

const fetchQuestionPayloadWithDeterministicContext = async (questionId: any, opts: any = {}) => {
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid) return { promptReady: false, bestQuestionData: null, bestSlug: '' };

    const currentQuestion: any =
      (Array.isArray(stateRef.current.questionPool)
        ? stateRef.current.questionPool.find((q: any) => String(q?.id || '').toLowerCase() === qid)
        : null) ||
      (Array.isArray(stateRef.current.pileQuestions)
        ? stateRef.current.pileQuestions.find((q: any) => String(q?.id || '').toLowerCase() === qid)
        : null) ||
      null;

    let bestQuestionData: any = currentQuestion ? { ...currentQuestion, id: qid } : null;
    let bestSlug: any = String(opts.preferredSlug ?? inst._getEffectiveDraftSlug() ?? '').toLowerCase();
    const candidateSlugs: any = getQuestionFetchCandidateSlugs(qid, bestSlug);
    let fetchedAny: any = false;

    for (const candidateSlug of candidateSlugs) {
      const decryptContext: any = buildQuestionDecryptContext(candidateSlug);
      const litReady: any = !!(decryptContext?.litHooks && typeof decryptContext.litHooks.getKey === 'function');
      try {
        const fetched: any = await (contractScripts as any).getQuestionData(
          propsRef.current.provider,
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
        cacheQuestionPayloadForSlug(candidateSlug, qid, picked);
        const promptReady: any = !isMaskedPromptText(picked?.prompt);
        if (promptReady || !isMaskedQuestionPayload(picked)) break;
      } catch (error: any) {
        surveyLog.debug('[question-prompt-reload] getQuestionData failed', {
          questionId: qid,
          slug: candidateSlug,
          chainId: decryptContext?.chainId || null,
          hasProvider: !!propsRef.current.provider,
          hasAccount: !!propsRef.current.account,
          loginComplete: !!propsRef.current.loginComplete,
          litReady,
          error: error?.message || String(error || ''),
        });
      }
    }

    if (bestQuestionData) {
      applyQuestionPayloadToRenderedPools(qid, bestQuestionData);
      if (bestSlug || bestSlug === '') {
        cacheQuestionPayloadForSlug(bestSlug, qid, bestQuestionData);
      }
    }

    const promptReady: any = !!bestQuestionData && !isMaskedPromptText(bestQuestionData?.prompt);
    if (!promptReady) {
      const litHooks: any =
        propsRef.current.lit ||
        propsRef.current.litHooks ||
        (typeof window !== 'undefined' ? (window.__litHooks || window.litHooks) : null);
      const litReady: any = !!(litHooks && typeof litHooks.getKey === 'function');
      const chainId: any = Number(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? 0) || null;
      const reason: any =
        !propsRef.current.loginComplete || !propsRef.current.account
          ? 'not_logged_in'
          : !propsRef.current.provider
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
        hasProvider: !!propsRef.current.provider,
        hasAccount: !!propsRef.current.account,
        loginComplete: !!propsRef.current.loginComplete,
        chainId,
        litReady,
      });
    }

    return { promptReady, bestQuestionData, bestSlug };
  };

const handleReloadMaskedPrompt = async (questionId: any) => {
    const qid: any = String(questionId || '').trim().toLowerCase();
    if (!qid) return false;
    const key: any = getQuestionFieldTaskKey(qid, 'prompt');

    setState((prev: any) => buildDecryptingByKeyState(prev, key, true));

    try {
      const preferredSlug: any = inst._getEffectiveDraftSlug();
      const result: any = await fetchQuestionPayloadWithDeterministicContext(qid, { preferredSlug });

      if (propsRef.current.singleQuestionMode && qid === String(propsRef.current.questionID || '').toLowerCase()) {
        await fetchSingleQuestionData({ forceQuestionMetadataRefetch: true });
      }

      // Pile view keeps gated/masked questions in allQuestionsForFilter as source-of-truth.
      // After a successful decrypt, refresh the visible pile cards from that source without
      // triggering a full filter/apply cycle that could wipe in-progress edits.
      if (result?.promptReady) {
        setState((prev: any) => buildVisiblePileQuestionsAfterPromptDecryptState(prev, {
          isFilterStateActive: isSurveyToolFilterStateActive,
          isMaskedPromptText: isMaskedPromptText,
        }));
      }

      const activePrompt: any = (() => {
        const q: any = Array.isArray(stateRef.current.questionPool)
          ? stateRef.current.questionPool.find((item: any) => String(item?.id || '').toLowerCase() === qid)
          : null;
        return q?.prompt;
      })();
      return !isMaskedPromptText(activePrompt) || !!result.promptReady;
    } catch (error: any) {
      surveyLog.debug('[question-prompt-reload] manual reload failed', {
        questionId: qid,
        error: error?.message || String(error || ''),
      });
      return false;
    } finally {
      setState((prev: any) => buildDecryptingByKeyState(prev, key, false));
    }
  };

const reloadMaskedQuestionBatch = async (questionIds: any = []) => {
    const ids: any = Array.from(new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((qid: any) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    ));
    if (!ids.length) return;

    setState(buildBulkPromptReloadingState(true));
    try {
      for (const qid of ids) {
        // eslint-disable-next-line no-await-in-loop
        await handleReloadMaskedPrompt(qid);
      }
    } finally {
      setState(buildBulkPromptReloadingState(false));
    }
  };

const renderPromptWithManualDecrypt = (question: any) => {
    const qid: any = String(question?.id || '').trim().toLowerCase();
    const promptText: any = question?.prompt || 'Question';
    const promptMasked: any = isMaskedPromptText(promptText);
    const payloadDisplay: any = getQuestionPayloadDisplayState(question);
    const promptReloading: any = isQuestionFieldBusy(qid, 'prompt');
    const promptDisplay: any = buildQuestionPromptDecryptDisplayState({
      questionId: qid,
      promptText,
      promptMasked,
      promptReloading,
      payloadDisplay,
      loginComplete: propsRef.current.loginComplete,
      account: propsRef.current.account,
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
              onClick={() => handleReloadMaskedPrompt(promptDisplay.qid)}
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

const renderQuestionTagControl = (question: any, options: any = {}) => {
    const { rowStyle }: any = options;
    return (
      <SurveyQuestionTagControl
        tags={question.tags}
        sessionSlug={resolveCurrentTagSessionSlug({
          props: propsRef.current,
          state: stateRef.current,
          getEffectiveDraftSlug: inst._getEffectiveDraftSlug,
        })}
        useTagModal={!propsRef.current.singleQuestionMode && !propsRef.current.isStandalone}
        onTagSelect={handleQuestionTagSelect}
        rowStyle={rowStyle}
      />
    );
  };

const renderQuestionTagDropdown = (question: any) => (
    renderQuestionTagControl(question)
  );

const handleQuestionTagSelect = (tag: any) => {
    const normalizedTag: any = String(tag || '').trim();
    if (!normalizedTag) return;
    setState(buildActiveTagModalState(normalizedTag));
  };

const closeQuestionTagModal = () => {
    setState(buildActiveTagModalState());
  };

const renderQuestionTagDropdownRow = (question: any) => (
    renderQuestionTagControl(question, {
      rowStyle: QUESTION_TAG_DROPDOWN_ROW_STYLE,
    })
  );

const getSliderMode = (questionId: any) => {
    return getQuestionSliderMode({
      explicitMode: stateRef.current.sliderModeByQuestion?.[questionId],
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      surveyIndex: propsRef.current.surveyIndex,
      surveysResponseState: stateRef.current.surveysResponseState,
      questionId,
    });
  };

const setSliderMode = (questionId: any, mode: any) => {
    setState((prev: any) => (
      // Track whether the conviction/importance control has been "opened" for engine question.
      buildSliderModeStatePatch(prev, questionId, mode)
    ));
  };

const getConvictionValueForSlice = (slice: any, questionId: any) => {
    return getQuestionConvictionSliderValue(slice, questionId);
  };

const getImportanceValueForSlice = (slice: any, questionId: any) => {
    return getQuestionImportanceSliderValue(slice, questionId);
  };

const flushDraftPersistAfterSliderChange = () => {
    persistDraftSafely && persistDraftSafely(0);
  };

const handleConvictionImportanceChange = (surveyIndex: any, questionId: any, mode: any, value: any, options: any = {}) => {
    if (mode === 'importance') {
      handleImportance(surveyIndex, questionId, value, options);
    } else {
      handleConviction(surveyIndex, questionId, value, options);
    }
  };

const renderFullQuestionSliderSection = ({
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
      isSubmitting={stateRef.current.isSubmitting}
      onChange={(value: any, event: any) =>
        handleConvictionImportanceChange(
          surveyIndex,
          questionId,
          sliderMode,
          value,
          buildSliderPersistOptions(event)
        )}
      onChangeComplete={flushDraftPersistAfterSliderChange}
      onCommit={(committedValue: any) => handleConvictionImportanceChange(
        surveyIndex,
        questionId,
        sliderMode,
        committedValue,
        {
          persistDraft: false,
          afterUpdate: flushDraftPersistAfterSliderChange,
        }
      )}
      onSelectMode={(nextMode: any) => setSliderMode(questionId, nextMode)}
      questionId={questionId}
      singleQuestionMode={propsRef.current.singleQuestionMode}
      sliderMode={sliderMode}
      sliderOpen={sliderOpen}
      sliderToggleExpandedByQuestion={stateRef.current.sliderToggleExpandedByQuestion}
    />
  );

const renderFullQuestionResponseInput = ({
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
      isSubmitting={stateRef.current.isSubmitting}
      singleQuestionMode={propsRef.current.singleQuestionMode}
      audioInputWorkerProps={getAudioInputWorkerProps()}
      onAnswerChange={(answerValue: any) => handleAnswer(surveyIndex, question.id, answerValue)}
      onDeferredRatingCommit={(committedRating: any) => handleAnswer(
        surveyIndex,
        question.id,
        committedRating,
        {
          persistDraft: false,
          afterUpdate: flushDraftPersistAfterSliderChange,
        }
      )}
      onRatingChange={(ratingAnswer: any, event: any) => handleAnswer(
        surveyIndex,
        question.id,
        ratingAnswer,
        buildSliderPersistOptions(event)
      )}
      onRatingChangeComplete={flushDraftPersistAfterSliderChange}
      onToggleAnswerEncryption={(newEncryptedState: any) => toggleAnswerEncryption(
        surveyIndex,
        question.id,
        newEncryptedState
      )}
    />
  );

const renderFullQuestionAdditionalInput = ({
    qIndex,
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
  }: any) => (
    <SurveyAudioFieldInput
      qIndex={qIndex}
      {...getAudioInputWorkerProps()}
      placeholder={'related thoughts or URLs (optional)'}
      value={additional?.value || ''}
      encrypted={additional?.encrypted || false}
      dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
      dataCeQuestionId={String(questionId || '').trim().toLowerCase()}
      disabled={stateRef.current.isSubmitting}
      forceGlow={glowAdditional}
      updateFunction={(additionalCommentsValue: any) => handleAdditional(surveyIndex, questionId, additionalCommentsValue)}
      toggleEncryption={(newEncryptedState: any) =>
        toggleAdditionalCommentsEncryption(surveyIndex, questionId, newEncryptedState)
      }
    />
  );

const parseEncryptedEnvelope = (field: any) => (parseEncryptedEnvelopeHelper as any)(field);

const getFieldDecryptState = ({
    questionId,
    fieldKey,
    field,
  }: any) => (buildFieldDecryptStateHelper as any)(field, {
    loginComplete: propsRef.current.loginComplete,
    account: propsRef.current.account,
    busy: isQuestionFieldBusy(questionId, fieldKey),
  });

const getQuestionFieldDisplayState = ({
    questionId,
    answer,
    additional,
  }: any) => {
    const answerDecryptState: any = getFieldDecryptState({
      questionId,
      fieldKey: 'answer',
      field: answer,
    });
    const additionalDecryptState: any = getFieldDecryptState({
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

const getQuestionResponseDisplayState = ({
    questionId,
    responseSlice,
  }: any) => {
    const slice: any = responseSlice || {};
    const answer: any = slice.answers?.[questionId] || buildEmptyResponseFieldState(questionId);
    const additional: any = slice.additionalComments?.[questionId] || buildEmptyResponseFieldState(questionId, 'additional');
    const convictionValue: any = getConvictionValueForSlice(slice, questionId);
    const importanceValue: any = getImportanceValueForSlice(slice, questionId);
    const hasConvictionImportanceValue: any = hasConvictionOrImportanceValueForQuestion(slice, questionId);
    const sliderMode: any = ENABLE_IMPORTANCE_SLIDER_TOGGLE ? getSliderMode(questionId) : 'conviction';
    return (buildQuestionResponseDisplayStateHelper as any)({
      answer,
      additional,
      convictionValue,
      importanceValue,
      hasConvictionImportanceValue,
      sliderMode,
    });
  };

const getQuestionRenderDisplayState = ({
    questionId,
    responseSlice,
  }: any) => {
    const responseDisplayState: any = getQuestionResponseDisplayState({
      questionId,
      responseSlice,
    });
    const fieldDisplayState: any = getQuestionFieldDisplayState({
      questionId,
      answer: responseDisplayState.answer,
      additional: responseDisplayState.additional,
    });

    return (buildQuestionRenderDisplayStateHelper as any)({
      responseDisplayState,
      fieldDisplayState,
    });
  };

const isQuestionPromptMasked = (question: any): boolean => isQuestionPromptMaskedHelper(question);

const getQuestionPayloadDisplayState = (question: any) => {
    const slug: any = normalizeSessionSlugValue(
      question?.sessionSlug ||
      question?.sessionName ||
      inst._getEffectiveDraftSlug() ||
      resolveEffectiveSlug(propsRef.current)
    );
    const sessionConfig: any = slug ? (resolveExplicitSessionContext(slug).sessionConfig || null) : null;
    return resolveQuestionPayloadDisplayState(question, sessionConfig);
  };

const getAnswerLockDisplayState = ({
    field,
    masked,
  }: any) => buildAnswerLockDisplayState({
    field,
    masked,
    isSubmitting: stateRef.current.isSubmitting,
  });

const getGatedPromptNoticeState = ({
    question,
    tooltipIdSuffix,
    fallbackId = 'gated',
  }: any) => buildGatedPromptNoticeState({
    questionId: question?.id,
    tooltipIdSuffix,
    fallbackId,
    gateNames: resolveGatedPromptGateNames(question),
    sbtLabel: t('sbt'),
    gateLabel: t('gate'),
    gatesLabel: t('gates'),
  });

const renderGatedPromptNotice = ({
    question,
    tooltipIdSuffix,
    fallbackId,
  }: any) => {
    const { tooltipId, tooltipText }: any = getGatedPromptNoticeState({
      question,
      tooltipIdSuffix,
      fallbackId,
    });
    const qid: any = String(question?.id || '').trim().toLowerCase();
    const promptReloading: any = qid ? isQuestionFieldBusy(qid, 'prompt') : false;
    const canReloadPrompt: any = qid && isQuestionPromptMasked(question);
    const payloadDisplay: any = getQuestionPayloadDisplayState(question);
    const promptDisplay: any = buildQuestionPromptDecryptDisplayState({
      questionId: qid,
      promptText: question?.prompt || 'Question',
      promptMasked: isMaskedPromptText(question?.prompt || 'Question'),
      promptReloading,
      payloadDisplay,
      loginComplete: propsRef.current.loginComplete,
      account: propsRef.current.account,
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
        onAction={promptDisplay.canReloadPrompt ? () => handleReloadMaskedPrompt(promptDisplay.qid) : undefined}
      />
    );
  };

const renderFullQuestionGatedPromptCard = ({
    cardKey,
    question,
    cardIcons,
  }: any) => (
    renderSurveyQuestionsFullQuestionGatedPromptCard({
      cardKey,
      promptContent: renderPromptWithManualDecrypt(question),
      cardIcons,
      gatedPromptNotice: renderGatedPromptNotice({
        question,
        tooltipIdSuffix: 'full',
        fallbackId: cardKey || 'gated',
      }),
      tagDropdownRow: renderQuestionTagDropdownRow(question),
    })
  );

const renderQuestionMaskedPromptCard = ({
    mode,
    question,
    cardKey,
    cardIcons,
  }: any) => (
    mode === 'full'
      ? renderFullQuestionGatedPromptCard({
          cardKey,
          question,
          cardIcons,
        })
      : (typeof engine.renderPileGatedPromptCard === 'function'
        ? engine.renderPileGatedPromptCard({ question })
        : null)
  );

const renderQuestionAnswerLockControl = ({
    surveyIndex,
    questionId,
    answer,
    glowAnswer,
    lockDisabled,
    lockTitle,
    visualContext,
  }: any) => renderAnswerLockControl({
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

const renderQuestionAdditionalLockControl = ({
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
    visualContext,
  }: any) => renderAnswerLockControl({
    surveyIndex,
    questionId,
    answer: additional,
    field: additional,
    fieldKey: 'additional',
    lockDisabled: stateRef.current.isSubmitting,
    lockTitle: additional.encrypted ? 'Encrypted comments' : 'Comments encryption audience',
    glowAnswer: glowAdditional,
    forceAudienceMenu: true,
    selfAudienceLabel: 'only me',
    showPlaintextOption: true,
    showFollowOption: true,
    visualContext,
  });

const renderFullQuestionFooterIcons = ({
    surveyIndex,
    question,
    answer,
    glowAnswer,
    maskedAnswer,
    hasAdditionalContent,
    commentsOpen,
    onToggleComments,
  }: any) => {
    const { lockDisabled, lockTitle }: any = getAnswerLockDisplayState({
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
        {renderQuestionAnswerLockControl({
          surveyIndex,
          questionId: question.id,
          answer,
          glowAnswer,
          lockDisabled,
          lockTitle,
        })}
        {renderQuestionTagDropdown(question)}
      </FullQuestionFooterIcons>
    );
  };

const renderFullQuestionCardIcons = ({
    question,
    showResponseLookupSpinner,
    isQuestionBookmarked,
  }: any) => {
    const arweaveTxId: any = getLegacyArweaveTxId(question);
    return (
      <QuestionCardLinks
        showResponseLookupSpinner={showResponseLookupSpinner}
        isQuestionBookmarked={isQuestionBookmarked}
        onBookmarkToggle={() => handleBookmarkToggle(question.id)}
        arweaveHref={arweaveTxId
          ? normalizeArweaveUrl(arweaveTxId, { contextLabel: 'survey_tool_question_link' })
          : ''}
        questionHref={question.id
          ? buildQuestionRoutePath(question.id, { sessionSlug: inst._getEffectiveDraftSlug() })
          : ''}
      />
    );
  };

const renderQuestionFieldDecryptControl = ({
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
      autoDecryptEnabled: stateRef.current.autoDecryptEnabled,
      busy,
      decryptTooltip,
      isDecrypting: stateRef.current.isDecrypting,
      showBusySpinnerWhenAutoDecryptEnabled,
      wrapperStyle,
    });

    return (
      <QuestionDecryptControl
        {...displayState}
        onClick={() => handleDecryptQuestionAnswer(questionId, fieldKey)}
      />
    );
  };

const renderFullQuestionCardShell = ({
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
      promptContent={renderPromptWithManualDecrypt(question)}
      cardIcons={cardIcons}
      mainContent={mainContent}
      footerIcons={footerIcons}
      sliderSection={sliderSection}
      commentsSection={commentsSection}
    />
  );

const areResponsesConsistent = (latest: any, surveyIndex: any) => {
    return areSurveyResponsesConsistent({
      latest,
      editBaseline: stateRef.current.editBaseline,
      renderedIds: getCurrentRenderedQuestionIds(),
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      valuesEqual: valuesEqual,
    });
  };

const getEditTrackingQuestionIds = (surveyIndexParam: any = null) => {
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
      const surveyIndex: any = getActiveSurveyIndex(surveyIndexParam);
      const currentSlice: any = stateRef.current?.surveysResponseState?.[surveyIndex] || null;
      addSliceIds(currentSlice);
      if (propsRef.current.singleQuestionMode && propsRef.current.questionID) {
        add(propsRef.current.questionID);
      }
      if (typeof getCurrentRenderedQuestionIds === 'function') {
        const renderedIds: any = getCurrentRenderedQuestionIds();
        if (Array.isArray(renderedIds)) renderedIds.forEach((id: any) => add(id));
      }
      if (ids.size > 0) return ids;

      if (Array.isArray(stateRef.current?.questionPool)) stateRef.current.questionPool.forEach((q: any) => add(q?.id));
      if (Array.isArray(stateRef.current?.pileQuestions)) stateRef.current.pileQuestions.forEach((q: any) => add(q?.id));
      if (Array.isArray(propsRef.current?.questionPool)) propsRef.current.questionPool.forEach((q: any) => add(q?.id));
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    return ids;
  };

const getIndexedQuestionEntryKeys = (source: any) => {
    if (!source || typeof source !== 'object') return null;
    try {
      const cached: any = inst._normalizedQuestionEntryKeyCache.get(source);
      if (cached) return cached;
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    const result: any = buildIndexedQuestionEntryKeys(source, normalizeQuestionIdKey);
    try {
      if (result) inst._normalizedQuestionEntryKeyCache.set(source, result);
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    return result;
  };

const getChangedQidsAndFields = (surveyIndexParam: any) => measureSync('ce.surveyQuestions.getChangedQidsAndFields', () => {
    const surveyIndex: any = getActiveSurveyIndex(surveyIndexParam);
    const currentSlice: any =
      (stateRef.current.surveysResponseState && stateRef.current.surveysResponseState[surveyIndex]) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const scopedIds: any = getEditTrackingQuestionIds(surveyIndex);
    const { result, newCache }: any = orchestrateGetChangedQidsAndFields(
      {
        surveyIndex,
        currentSlice,
        isLoggedIn: !!(propsRef.current.account && propsRef.current.loginComplete),
        isLoadingResponse: !!stateRef.current.isLoadingResponse,
        scopedIds,
        userAnswers: stateRef.current.userAnswers,
      },
      {
        resolveDiffBaselineSlice: (allowLocalCache: any) => resolveDiffBaselineSlice(allowLocalCache),
        getIndexedQuestionEntryKeys: (source: any) => getIndexedQuestionEntryKeys(source),
        getDefaultResponseEncryptionAudience: () => getDefaultResponseEncryptionAudience(),
        normalizeResponseEncryptionAudience: (audience: any, qid: any) => normalizeResponseEncryptionAudience(audience, qid),
        getDefaultResponseEncryptionAudienceForQid: (qid: any) => getDefaultResponseEncryptionAudienceForQid(qid),
        resolveFieldEncryptionGateId: (field: any, qid: any, fieldKey: any) => resolveFieldEncryptionGateId(field, qid, fieldKey),
        normalizeFieldAudienceMode: (mode: any, fieldKey: any, field: any) => normalizeFieldAudienceMode(mode, fieldKey, field),
        valuesEqual: valuesEqual,
        buildSurveyResponseSliceSignature,
        buildRatingEnvelopeQidSetFromUserAnswers,
        hasMeaningfulFieldValue: hasMeaningfulFieldValue as any,
        bumpPerfCounter: bumpSurveyPerfCounter,
      },
      inst._changedQidsAndFieldsCache,
    );
    if (newCache !== inst._changedQidsAndFieldsCache) {
      inst._changedQidsAndFieldsCache = newCache;
      inst._pendingEditStatsCache = null;
    }
    return result;
  });

const maybeAutoDecryptVisibleFields = () => {
    try {
      // Guard: do not run decrypt sweeps while an error is present (avoid clobber after failed submit)
      if (stateRef.current && stateRef.current.submissionError) {
        resetVisibleAutoDecryptSweepState();
        return;
      }

      // Auto-decrypt now runs in all views (survey, questions, pile).
      // Guard: when logged out, do nothing so we can retry cleanly after login.
      if (!propsRef.current || !propsRef.current.loginComplete || !propsRef.current.account) {
        resetVisibleAutoDecryptSweepState();
        return;
      }

      if (!stateRef.current.autoDecryptEnabled) {
        resetVisibleAutoDecryptSweepState();
        return;
      }

      const surveyIndex: any =
        propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : (propsRef.current.surveyIndex || 0);
      const slice: any = stateRef.current.surveysResponseState?.[surveyIndex];
      if (!slice) {
        inst._autoDecryptVisibleSweepCache = null;
        return;
      }

      // Include both questionPool and pileQuestions
      const ids: any = getCurrentRenderedQuestionIds();
      if (!Array.isArray(ids) || ids.length === 0) {
        inst._autoDecryptVisibleSweepCache = null;
        return;
      }

      const accountLower: any = String(propsRef.current.account || '').trim().toLowerCase();
      const idsKey: any = buildRenderedIdsSignature(ids);
      const attempted: any = { ...(stateRef.current.autoDecryptAttempted || {}) };
      const inflight: any = { ...(stateRef.current.decryptingByKey || {}) };
      const maskedAttemptSignature: any = inst._autoDecryptMaskedAttemptSignature || {};
      const queuedSet: any = new Set(
        Array.isArray(inst._autoDecQueue)
          ? inst._autoDecQueue.map((it: any) => `${it.qid}:${it.field}`)
          : []
      );
      let visibleSignature: any = `${idsKey}|${accountLower}|${stateRef.current.autoDecryptEnabled ? 1 : 0}`;
      const toQueue: any = [];

      ids.forEach((qidRaw: any) => {
        const qidSource: any = String(qidRaw || '').trim();
        const qid: any = qidSource.toLowerCase();
        if (!qid) return;
        const ans: any = slice.answers?.[qidSource] ?? slice.answers?.[qid];
        const add: any = slice.additionalComments?.[qidSource] ?? slice.additionalComments?.[qid];

        const kA: any = getQuestionFieldTaskKey(qid, 'answer');
        const kD: any = getQuestionFieldTaskKey(qid, 'additional');
        const answerSig: any = buildAutoDecryptMaskedFieldSignature(ans);
        const additionalSig: any = buildAutoDecryptMaskedFieldSignature(add);
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

      const sweepCache: any = inst._autoDecryptVisibleSweepCache;
      if (
        sweepCache &&
        sweepCache.sliceRef === slice &&
        sweepCache.idsKey === idsKey &&
        sweepCache.accountLower === accountLower &&
        sweepCache.autoDecryptEnabled === !!stateRef.current.autoDecryptEnabled &&
        sweepCache.attemptedRef === stateRef.current.autoDecryptAttempted &&
        sweepCache.decryptingRef === stateRef.current.decryptingByKey &&
        sweepCache.showCommentsRef === stateRef.current.showComments &&
        sweepCache.maskedAttemptRef === maskedAttemptSignature &&
        sweepCache.visibleSignature === visibleSignature
      ) {
        bumpSurveyPerfCounter('noopSkipCount');
        return;
      }
      inst._autoDecryptVisibleSweepCache = {
        sliceRef: slice,
        idsKey,
        accountLower,
        autoDecryptEnabled: !!stateRef.current.autoDecryptEnabled,
        attemptedRef: stateRef.current.autoDecryptAttempted,
        decryptingRef: stateRef.current.decryptingByKey,
        showCommentsRef: stateRef.current.showComments,
        maskedAttemptRef: maskedAttemptSignature,
        visibleSignature,
      };

      if (toQueue.length === 0) return;
      inst._autoDecQueue.push(...toQueue);
      processAutoDecryptQueue();
    } catch (_: any) {
      inst._autoDecryptVisibleSweepCache = null;
    }
  };

const processAutoDecryptQueue = async () => {
    if (!stateRef.current.autoDecryptEnabled) {
      inst._autoDecQueue = [];
      inst._autoDecProcessing = false;
      inst._autoDecryptMaskedAttemptSignature = {};
      if (inst._autoDecProcessTimer) {
        clearTimeout(inst._autoDecProcessTimer);
        inst._transientTimeouts.delete(inst._autoDecProcessTimer);
        inst._autoDecProcessTimer = null;
      }
      clearAutoDecryptSweepScheduling();
      return;
    }
    if (inst._autoDecProcessing) return;
    const item: any = inst._autoDecQueue.shift();
    if (!item) return;

    inst._autoDecProcessing = true;
    const k: any = `${item.qid}:${item.field}`;
    const maskedSig: any = String(item?.maskedSig || '');
    try {
      const did: any = await handleDecryptQuestionAnswer(item.qid, item.field);
      if (did) {
        // Mark as attempted ONLY when we actually produced a decrypted value
        if (!stateRef.current.autoDecryptAttempted?.[k]) {
          setState((prev: any) => buildAutoDecryptAttemptedState(prev, k));
        }
        if (inst._autoDecryptMaskedAttemptSignature?.[k]) {
          const nextAttemptSig: any = { ...(inst._autoDecryptMaskedAttemptSignature || {}) };
          delete nextAttemptSig[k];
          inst._autoDecryptMaskedAttemptSignature = nextAttemptSig;
        }
      } else if (maskedSig) {
        inst._autoDecryptMaskedAttemptSignature = {
          ...(inst._autoDecryptMaskedAttemptSignature || {}),
          [k]: maskedSig,
        };
      }
    } catch (_: any) {
      if (maskedSig) {
        inst._autoDecryptMaskedAttemptSignature = {
          ...(inst._autoDecryptMaskedAttemptSignature || {}),
          [k]: maskedSig,
        };
      }
    } finally {
      inst._autoDecProcessing = false;
      // Deferred re-sweep: let setState callbacks settle before re-scanning
      Promise.resolve().then(() => {
        try { queueAutoDecryptVisibleSweep('post-item'); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      });
      if (inst._autoDecQueue.length > 0) {
        if (inst._autoDecProcessTimer) {
          clearTimeout(inst._autoDecProcessTimer);
          inst._transientTimeouts.delete(inst._autoDecProcessTimer);
        }
        inst._autoDecProcessTimer = setManagedTimeout(() => {
          inst._autoDecProcessTimer = null;
          processAutoDecryptQueue();
        }, 50);
      }
    }
  };

const getDraftKey = () => {
    try {
      const draftContext: any = resolveDraftStorageContext(propsRef.current, inst._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;
      const surveyScope: any = inst._getDraftScope();
      return buildSurveyDraftStorageKey({
        sessionSlug: slug,
        networkIdStr: networkIdStr || '__pending__',
        account: propsRef.current?.account,
        surveyScope,
      });
    } catch (_: any) {
      return null;
    }
  };

const loadDraft = () => {
    try {
      const draftContext: any = resolveDraftStorageContext(propsRef.current, inst._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;

      const surveyScope: any = inst._getDraftScope();
      const accountLower: any = (propsRef.current?.account || '').toLowerCase();
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
        questionId: propsRef.current.questionID,
        includePerQuestionScope: !!propsRef.current.singleQuestionMode,
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

const migratePersistedDraftForActiveAccount = () => {
    try {
      if (!propsRef.current?.account) return null;
      return loadDraft();
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
      return null;
    }
  };

const persistDraftSafely = (delayMs: any = 150) => {
    if (inst._persistTimer) clearTimeout(inst._persistTimer);
    inst._persistTimer = setTimeout(persistDraft, delayMs);
  };

const persistDraft = () => measureSync('ce.surveyQuestions.persistDraft', () => {
    try {
      const key: any = getDraftKey();

      // Guard null key and clean up malformed JSON
      if (!key) return;
      const keyTracking: any = buildPersistedDraftTrackingOnKeyChange({
        nextDraftKey: key,
        lastDraftKey: inst._lastDraftKey,
        lastDraftJSON: inst._lastDraftJSON,
        lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
        draftParseCache: inst._draftParseCache,
      });
      inst._applyDraftTrackingState(keyTracking);

      migratePersistedDraftForActiveAccount();

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
          lastDraftKey: inst._lastDraftKey,
          lastDraftJSON: inst._lastDraftJSON,
          lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
          draftParseCache: inst._draftParseCache,
        },
        {
          readDraftRaw: (draftKey: any) => sessionStorage.getItem(draftKey) || '',
          removeDraftRaw: (draftKey: any) => sessionStorage.removeItem(draftKey),
          buildSemanticSignature: buildSurveyDraftSemanticSignature,
        },
      );
      const loadTracking: any = buildPersistedDraftTrackingAfterLoad({
        lastDraftKey: inst._lastDraftKey,
        lastDraftJSON: inst._lastDraftJSON,
        lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
        draftParseCache: inst._draftParseCache,
        nextDraftParseCache,
        shouldResetDraftTracking,
      });
      inst._applyDraftTrackingState(loadTracking);

      const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
      const slice: any = (stateRef.current.surveysResponseState && stateRef.current.surveysResponseState[surveyIndex]) || {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {}
      };

      // Only persist rendered (or all if none rendered)
      const renderedIds: any = getHydrationQuestionIds();
      const dirtyQids: any = inst._draftDirtyQids ? [...inst._draftDirtyQids] : [];
      const allowed: any = buildPersistDraftAllowedQuestionIds({
        renderedQuestionIds: renderedIds,
        dirtyQuestionIds: dirtyQids,
        slice,
      });

      const baselineSlice: any = stateRef.current.editBaseline || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
      // Start from previous draft answers/baseline so non-rendered QIDs survive,
      // then overwrite only the currently allowed question set.
      const { answersObj, baselineObj }: any = buildPersistedDraftMapsForAllowedIds({
        allowedQuestionIds: allowed,
        slice,
        baselineSlice,
        prevAnswers,
        prevBaseline,
        resolvers: {
          resolveFieldEncryptionAudience: resolveFieldEncryptionAudience,
          resolveFieldEncryptionGateId: resolveFieldEncryptionGateId,
          normalizeFieldAudienceMode: normalizeFieldAudienceMode,
        },
      });

      if (Object.keys(answersObj).length === 0) {
        // No meaningful draft → clear both scoped variants (and SQM compat)
        clearDraft();
        return;
      }

      const draftContext: any = resolveDraftStorageContext(propsRef.current, inst._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const persistWritePlan: any = buildPersistedDraftWritePlan({
        draftKey: key,
        sessionSlug: slug,
        networkIdStr: draftContext.networkIdStr,
        account: propsRef.current?.account,
        surveyScope: inst._getDraftScope(),
        singleQuestionMode: propsRef.current.singleQuestionMode,
      });
      const payload: any = buildPersistedDraftPayload({
        draftContext,
        singleQuestionMode: propsRef.current.singleQuestionMode,
        questionId: propsRef.current.questionID,
        surveyId: propsRef.current.surveyId,
        answersObj,
        // Keep baseline in storage; prefill/merge logic depends on it to avoid false dirty diffs.
        baselineObj,
      });

      const nextSemanticSignature: any = buildSurveyDraftSemanticSignature(payload);
      if (nextSemanticSignature && nextSemanticSignature === prevSemanticSignature) {
        inst._lastDraftJSON = prevDraftRaw || inst._lastDraftJSON;
        inst._lastDraftSemanticSignature = nextSemanticSignature;
        if (inst._draftDirtyQids) inst._draftDirtyQids.clear();
        return;
      }

      const nextJson: any = JSON.stringify(payload);
      if (nextJson === inst._lastDraftJSON) return;
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
      inst._applyDraftTrackingState(writeTracking);
      if (inst._draftDirtyQids) inst._draftDirtyQids.clear();

      persistWritePlan.staleAnonKeys.forEach((draftKey: any) => {
        try { sessionStorage.removeItem(draftKey); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      });
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  });

const clearDraft = () => {
    try {
      const draftContext: any = resolveDraftStorageContext(propsRef.current, inst._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;

      const surveyScope: any = inst._getDraftScope();
      const accountLower: any = (propsRef.current?.account || '').toLowerCase() || 'anon';
      const { purgeKeys }: any = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
      });

      purgeKeys.forEach((k: any) => { try { sessionStorage.removeItem(k); } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); } });

      const clearedTracking: any = buildPersistedDraftTrackingClearedState();
      inst._applyDraftTrackingState(clearedTracking);
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };

const clearDraftFor = (qid: any) => {
    try {
      const draftContext: any = resolveDraftStorageContext(propsRef.current, inst._getEffectiveDraftSlug());
      const slug: any = draftContext.sessionSlug || '';
      const networkIdStr: any = draftContext.networkIdStr;

      const surveyScope: any = inst._getDraftScope();
      const accountLower: any = (propsRef.current?.account || '').toLowerCase() || 'anon';
      const qidLower: any = (qid || '').toLowerCase();
      const { purgeKeys }: any = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: qidLower,
        includePerQuestionScope: !!propsRef.current.singleQuestionMode,
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
              lastDraftKey: inst._lastDraftKey,
              lastDraftJSON: inst._lastDraftJSON,
              lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
              draftParseCache: inst._draftParseCache,
            });
            inst._applyDraftTrackingState(deleteTracking);
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
              inst._applyDraftTrackingState(writeTracking);
          }
        } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      });
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
  };

const getCurrentRenderedQuestionIds = () => {
    const runtimeStrategy: any = getRuntimeStrategy();
    if (typeof runtimeStrategy?.getCurrentRenderedQuestionIds === 'function') {
      return runtimeStrategy.getCurrentRenderedQuestionIds(engine);
    }
    const questionPool: any = Array.isArray(stateRef.current?.questionPool) ? stateRef.current.questionPool : [];
    const pileQuestions: any = Array.isArray(stateRef.current?.pileQuestions) ? stateRef.current.pileQuestions : [];
    const singleQuestionMode: any = !!propsRef.current.singleQuestionMode;
    const questionId: any = String(propsRef.current.questionID || '');
    if (
      inst._currentRenderedQuestionIdsCache &&
      inst._currentRenderedQuestionIdsCacheQuestionPool === questionPool &&
      inst._currentRenderedQuestionIdsCacheQuestionPoolLength === questionPool.length &&
      inst._currentRenderedQuestionIdsCachePileQuestions === pileQuestions &&
      inst._currentRenderedQuestionIdsCachePileQuestionsLength === pileQuestions.length &&
      inst._currentRenderedQuestionIdsCacheSingleQuestionMode === singleQuestionMode &&
      inst._currentRenderedQuestionIdsCacheQuestionId === questionId
    ) {
      return inst._currentRenderedQuestionIdsCache;
    }

    let renderedIds: any = [];
    try {
      renderedIds = buildRenderedQuestionIdsFromQuestionPools({
        questionPool,
        pileQuestions,
      });
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    inst._currentRenderedQuestionIdsCache = renderedIds;
    inst._currentRenderedQuestionIdsCacheQuestionPool = questionPool;
    inst._currentRenderedQuestionIdsCacheQuestionPoolLength = questionPool.length;
    inst._currentRenderedQuestionIdsCachePileQuestions = pileQuestions;
    inst._currentRenderedQuestionIdsCachePileQuestionsLength = pileQuestions.length;
    inst._currentRenderedQuestionIdsCacheSingleQuestionMode = singleQuestionMode;
    inst._currentRenderedQuestionIdsCacheQuestionId = questionId;
    return renderedIds;
  };

const getHydrationQuestionIds = () => {
    return readRenderedQuestionIds({
      getRenderedQuestionIds: () => getCurrentRenderedQuestionIds(),
      normalizeRenderedIds: buildNormalizedRenderedQuestionIds,
    });
  };

const buildLocalCacheHydrationSignature = (surveyIndex: any, renderedIds: any = []) => {
    try {
      return resolveLocalCacheHydrationSignatureLookup({
        surveyIndex,
        renderedIds,
        rawSlug: inst._getEffectiveDraftSlug(),
        account: propsRef.current?.account,
        minifiedMode: propsRef.current?.minifiedMode,
        questionsCacheNonce: propsRef.current.questionsCacheNonce,
        questionResponsesNonce: propsRef.current.questionResponsesNonce,
        suppressPrefill: stateRef.current?.suppressPrefill,
        submissionError: stateRef.current?.submissionError,
        submissionComplete: stateRef.current?.submissionComplete,
        resolveResponseHydrationContext: (rawSlug: any) => resolveResponseHydrationContext(propsRef.current, rawSlug),
        normalizeSessionSlugValue,
        getExtraScopeSlugs: (slug: any) => getExtraQuestionReadSlugs(propsRef.current, slug),
      });
    } catch (_: any) {
      return '';
    }
  };

const getRenderedQuestionIdsForResponseHydration = () => {
    return readRenderedQuestionIds({
      getRenderedQuestionIds: () => getCurrentRenderedQuestionIds(),
      normalizeRenderedIds: buildNormalizedRenderedQuestionIds,
    });
  };

const resolveQuestionSlugMapForIds = (questionIds: any = [], opts: any = {}) => {
    return resolveQuestionSlugMapLookup({
      questionIds,
      questionPool: stateRef.current?.questionPool,
      pileQuestions: stateRef.current?.pileQuestions,
      surveyId: Object.prototype.hasOwnProperty.call(opts || {}, 'surveyId') ? opts.surveyId : undefined,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      propsSurveyId: propsRef.current.surveyId,
      props: propsRef.current,
      network: propsRef.current.network,
      normalizeSlug: normalizeSessionSlugValue,
      getSessionSlugByName,
      resolveSlugForIds,
    });
  };

const resolveSubmissionGroupContext = ({ questionIds = [], surveyId = null, fallbackSlug = null }: any = {}) => {
    return buildSubmissionGroupContext({
      questionIds,
      slugByQuestionId: resolveQuestionSlugMapForIds(questionIds, { surveyId }),
      fallbackSlug: fallbackSlug != null ? fallbackSlug : resolveEffectiveSlug(propsRef.current),
      normalizeSlug: normalizeSessionSlugValue,
    });
  };

const getMissingRenderedResponseIdsForAccount = async (opts: any = {}) => {
    const fallbackSlug: any = resolveEffectiveSlug(propsRef.current);
    return resolveSurveyMissingRenderedResponseLookup({
      props: propsRef.current,
      responder: opts?.responder || propsRef.current.account,
      slug: opts?.slug ?? inst._getEffectiveDraftSlug() ?? fallbackSlug,
      fallbackSlug,
      renderedIds: getRenderedQuestionIdsForResponseHydration(),
      resolveResponseHydrationContext: (nextSlug: any) => resolveResponseHydrationContext(propsRef.current, nextSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug: any) => (
        propsRef.current?.minifiedMode === 'pile'
          ? getExtraQuestionReadSlugs(propsRef.current, slug)
          : []
      ),
      resolveQuestionSlugMapForIds: (questionIds: any, context: any) => resolveQuestionSlugMapForIds(
        questionIds,
        { surveyId: context?.surveyId || null }
      ),
      resolveScopeNetId: (resolvedSlug: any, entryNetId: any, fallbackNetId: any) => {
        const resolvedContext: any = resolveResponseHydrationContext(propsRef.current, normalizeSessionSlugValue(resolvedSlug));
        return resolvedContext.networkIdStr || entryNetId || fallbackNetId;
      },
      readQuestionsCacheAsync,
      ensureQuestionsNet: ensureQuestionsNet as any,
    });
  };

const ensurePriorResponsesForRenderedIds = async (opts: any = {}) => {
    return executeSurveyPriorResponseBackfill({
      props: propsRef.current,
      state: stateRef.current,
      slug: opts?.slug,
      attemptedSet: inst._priorResponseBackfillAttempted,
      getMissingRenderedResponseIdsForAccount: ({ responder, slug: nextSlug }: any) => getMissingRenderedResponseIdsForAccount({
        responder,
        slug: nextSlug,
      }),
      setHydratingState: (active: any) => setState(buildHydratingPriorResponsesState(active)),
      isMounted: inst._isMounted,
      readQuestionsCacheAsync,
      resetLocalCacheMemo: () => {
        // Force the immediate follow-up pass to read the freshly written cache
        // even before parent cache nonces propagate down as props.
        inst._localCacheSliceMemo = { key: '', value: null, hasValue: false };
        inst._rehydrateLocalCacheLastSig = '';
      },
      triggerRehydrate: () => rehydrateLocalCacheAnswersForRenderedIds(),
      onFailure: (error: any) => {
        surveyLog.warn('[SurveyQuestions] Prior-response backfill failed:', error);
      },
      getCurrentInFlight: () => inst._priorResponseBackfillInFlight,
      setCurrentInFlight: (value: any) => {
        inst._priorResponseBackfillInFlight = value;
      },
    });
  };

const rehydrateDraftForRenderedIds = (forceOverwriteOrOptions: any = false) => {
    const hasOptions: any = (
      forceOverwriteOrOptions &&
      typeof forceOverwriteOrOptions === 'object' &&
      !Array.isArray(forceOverwriteOrOptions)
    );
    const options: any = hasOptions ? forceOverwriteOrOptions : {};
    const forceOverwrite: any = hasOptions
      ? !!options.forceOverwrite
      : !!forceOverwriteOrOptions;
    const setStateForHydration: any = options.responseHydrationOwned
      ? setResponseHydrationState.bind(engine)
      : setState.bind(engine);
    executeSurveyDraftHydration({
      props: propsRef.current,
      state: stateRef.current,
      loadDraft: () => loadDraft(),
      getPendingEditStats: () => getPendingEditStats?.() || null,
      getHydrationQuestionIds: () => getHydrationQuestionIds(),
      applyDraftHydrationEntryToSlice: inst._applyDraftHydrationEntryToSlice,
      cloneBaseline: deepClone,
      setState: setStateForHydration,
      updateJsonPreview: updateJsonPreview,
      onError: (error: any) => { surveyLog.warn('SurveyTool: fallback', error); },
      buildDraftRunPlan: (args: any) => buildDraftHydrationRunPlan({
        ...args,
        forceOverwrite,
      }),
    });
  };

const resetFormStateForAccountChange = (callback: any) => {
    executeSurveyFormStateReset({
      props: propsRef.current,
      state: stateRef.current,
      persistDraft: persistDraft,
      clearPersistTimer: () => {
        if (inst._persistTimer) {
          clearTimeout(inst._persistTimer);
          inst._persistTimer = null;
        }
      },
      initializeSurveyResponseState: initializeSurveyResponseState,
      cloneValue: deepClone,
      setState: setState.bind(engine),
      callback,
      updateSubmittedSinceLastEdit,
      onPersistError: (error: any) => { surveyLog.warn('SurveyTool: fallback', error); },
      onCleanupError: (error: any) => { surveyLog.warn('SurveyTool: cleanup', error); },
    });
  };

const deepClone = (obj: any) => {
    try { return JSON.parse(JSON.stringify(obj)); } catch { return obj; }
  };

const valuesEqual = (a: any, b: any) => {
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

const computeModifiedQuestionsCount = (baselineSlice: any, currentSlice: any) => {
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

    const scopedIds: any = getEditTrackingQuestionIds();
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
      if (!valuesEqual(bAns.value, cAns.value)) changed = true;
      if (!valuesEqual(bAdd.value, cAdd.value)) changed = true;
      if (bImp !== cImp) changed = true;
      if (bConv !== cConv) changed = true;
      if (!!bAns.encrypted !== !!cAns.encrypted) changed = true;
      if (!!bAdd.encrypted !== !!cAdd.encrypted) changed = true;

      if (changed) count++;
    });
    return count;
  };

const handleRevertPendingChanges = () => {
    executeSurveyPendingRevert({
      props: propsRef.current,
      state: stateRef.current,
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      buildSliceFromLocalCache: buildSliceFromLocalCache,
      getRenderedQuestionIds: getCurrentRenderedQuestionIds,
      cloneFieldState: deepClone,
      buildEmptyResponseFieldState: buildEmptyResponseFieldState,
      setState: setState.bind(engine),
      clearDraft: clearDraft,
      recalculateEditStats: recalculateEditStats,
      updateJsonPreview: updateJsonPreview,
      onFailure: (error: any) => {
        surveyLog.warn('[SurveyQuestions] handleRevertPendingChanges failed:', error);
      },
    });
  };

const buildSliceFromUserAnswers = (userAnswers: any, prevSlice: any = null) => buildHydratedResponseSlice({
    userAnswers,
    prevSlice,
    applyResponseHydrationListToSlice: inst._applyResponseHydrationListToSlice,
    parseValue: (value: any) => {
      try {
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          return JSON.parse(value);
        }
      } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
      return value;
    },
  });

const resolveDiffBaselineSlice = (allowLocalCache: any = false) => {
    const {
      baselineSlice,
      nextUserAnswersSliceCache,
    }: any = resolveSurveyBaselineSourceSlice({
      editBaseline: stateRef.current.editBaseline,
      allowLocalCache,
      userAnswers: stateRef.current.userAnswers,
      userAnswersSliceCache: inst._userAnswersSliceCache,
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      buildSliceFromLocalCache: buildSliceFromLocalCache,
    });
    inst._userAnswersSliceCache = nextUserAnswersSliceCache;
    return baselineSlice;
  };

const prefillSurveyResponses = (userAnswers: any, options: any = {}) => {
    const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : (propsRef.current.surveyIndex || 0);
    const setStateForPrefill: any = options?.responseHydrationOwned
      ? setResponseHydrationState.bind(engine)
      : setState.bind(engine);

    executeSurveyResponsePrefill({
      state: stateRef.current,
      surveyIndex,
      userAnswers,
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      applyResponseHydrationListToSlice: inst._applyResponseHydrationListToSlice,
      setState: setStateForPrefill,
      updateJsonPreview: updateJsonPreview,
      recalculateEditStats: recalculateEditStats,
    });
  };

const buildSliceFromLocalCache = () => {
    const slice: any = buildSurveyLocalCacheSlice({
      props: propsRef.current,
      rawSlug: inst._getEffectiveDraftSlug(),
      renderedIds: getCurrentRenderedQuestionIds(),
      localCacheSliceMemo: inst._localCacheSliceMemo,
      resolveResponseHydrationContext: (rawSlug: any) => resolveResponseHydrationContext(propsRef.current, rawSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug: any) => getExtraQuestionReadSlugs(propsRef.current, slug),
      readQuestionsCache,
      mergeQuestionResponses,
      parseResponse: (raw: any) => {
        let resp: any = raw;
        try {
          if (typeof resp === 'string') { resp = JSON.parse(resp); }
        } catch { resp = null; }
        return resp;
      },
      applyCachedResponseEntryToSlice: inst._applyCachedResponseEntryToSlice,
      setLocalCacheMemo: (nextMemo: any) => {
        inst._localCacheSliceMemo = nextMemo;
      },
      onError: (error: any) => {
        DEBUG_PREFILL && surveyLog.error('[Survey][buildSlice] Error:', error);
      },
    });
    if (slice) {
      DEBUG_PREFILL && surveyLog.log('[Survey][buildSlice] Building for rendered IDs:', getCurrentRenderedQuestionIds());
    }
    return slice;
  };

const rehydrateLocalCacheAnswersForRenderedIds = async (callback: any = null, options: any = {}) => {
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
    const setStateForLocalCache: any = finalOptions?.responseHydrationOwned
      ? setResponseHydrationState.bind(engine)
      : setState.bind(engine);
    const runId: any = (Number(inst._localCacheRehydrateRunId) || 0) + 1;
    inst._localCacheRehydrateRunId = runId;
    const isStaleRun: any = () => (
      (inst._hasMounted && !inst._isMounted) ||
      inst._localCacheRehydrateRunId !== runId
    );
    await executeSurveyLocalCacheRehydrate({
      props: propsRef.current,
      state: stateRef.current,
      lastHydrationSig: inst._rehydrateLocalCacheLastSig,
      getHydrationQuestionIds: () => getHydrationQuestionIds(),
      buildHydrationSignature: (idx: any, ids: any) => buildLocalCacheHydrationSignature(idx, ids),
      buildSliceFromLocalCache: () => buildSliceFromLocalCache(),
      setLastHydrationSig: (value: any) => {
        inst._rehydrateLocalCacheLastSig = value;
      },
      loadDraft: () => loadDraft(),
      buildDraftAnswersByQuestionId,
      cloneBaseline: deepClone,
      buildDraftAwareCacheHydrationState: (args: any) => buildDraftAwareCacheHydrationState({
        ...args,
        areEnvelopesEquivalent,
      }),
      applyLocalCacheHydrationEntryToSlice: inst._applyLocalCacheHydrationEntryToSlice,
      setState: setStateForLocalCache,
      updateJsonPreview: updateJsonPreview,
      recalculateEditStats: recalculateEditStats,
      ensurePriorResponses: () => { void ensurePriorResponsesForRenderedIds(); },
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

const toggleAutoDecrypt = () => {
    // Guard: auto-decrypt is disabled for wagmi/porto providers
    if (isAutoDecryptBlocked()) {
      resetBlockedAutoDecryptSweepInternals();
      setState(buildAutoDecryptDisabledState());
      return;
    }
    setState(
      buildAutoDecryptToggleState,
      () => {
        if (!stateRef.current.autoDecryptEnabled) {
          inst._autoDecQueue = [];
          inst._autoDecProcessing = false;
          inst._autoDecryptMaskedAttemptSignature = {};
          clearAutoDecryptSweepScheduling();
          if (Object.keys(stateRef.current.decryptingByKey || {}).length > 0) {
            setState(buildClearedDecryptingByKeyState());
          }
          return;
        }
        queueAutoDecryptVisibleSweep('toggle-enabled');
      }
    );
  };

const getLatestQuestionResponse = async (responder: any, questionId: any, networkID: any, questionsCache: any) => {
    const slug: any = inst._getEffectiveDraftSlug();
    const strNet: any = String(networkID || '');

    let latest: any = null;
    try {
      latest = await (contractScripts as any).getResponse(propsRef.current.provider, responder, questionId, slug);
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

const getLatestSurveyResponse = async (responder: any, surveyId: any) => {
    try {
      const latest: any = await getSurveyResponse(responder, surveyId);
      return latest || null;
    } catch (e: any) {
      return null;
    }
  };

const loadBookmarks = async () => {
    try {
      const slug: any = resolveEffectiveSlug(propsRef.current);
      let obj: any = peekCacheSync('bookmarksCache', slug);
      if (obj == null) {
        obj = await readCache('bookmarksCache', slug);
      }
      if (!obj || typeof obj !== 'object') {
        setState(buildBookmarkedQuestionsState());
        return;
      }
      const list: any = Array.isArray(obj?.questions) ? obj.questions : [];
      setState(buildBookmarkedQuestionsState(list));
    } catch (error: any) {
      surveyLog.error('[SurveyQuestions] Error reading bookmarksCache:', error);
      setState(buildBookmarkedQuestionsState());
    }
  };

const handleBookmarkToggle = (questionId: any) => {
    if (!questionId) return;

    const slug: any = resolveEffectiveSlug(propsRef.current);
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
    setState(buildBookmarkedQuestionsState(obj.questions));

    void writeCacheOptimistic('bookmarksCache', slug, obj).catch((error: any) => {
      surveyLog.error('[SurveyQuestions] Error saving bookmarksCache:', error);
    });
  };

const getAnsweredQuestionsCount = () => {
    const runtimeStrategy: any = getRuntimeStrategy();
    if (typeof runtimeStrategy?.getAnsweredQuestionsCount === 'function') {
      return runtimeStrategy.getAnsweredQuestionsCount(engine);
    }
    const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : (propsRef.current.surveyIndex || 0);

    if (!stateRef.current.surveysResponseState || !stateRef.current.surveysResponseState[surveyIndex]) {
      return 0;
    }

    const currentSlice: any =
      stateRef.current.surveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

    // Prefer explicit session baseline; else derive from last saved answers; else derive from local cache; else empty
    const baselineSlice: any = resolveDiffBaselineSlice(true);

    // Compute how many questions actually changed vs. the baseline
    return computeModifiedQuestionsCount(baselineSlice, currentSlice);
  };

const recalculateEditStats = (pendingStatsOverride: any = null) => {
    try {
      const stats: any =
        (pendingStatsOverride && typeof pendingStatsOverride === 'object'
          ? pendingStatsOverride
          : null) ||
        (typeof getPendingEditStats === 'function' && getPendingEditStats()) ||
        { total: stateRef.current.modifiedCount || 0, encrypted: stateRef.current.encryptedModifiedCount || 0 };
      const modifiedCount: any = Number(stats.total || 0);
      const encryptedModifiedCount: any = Number(stats.encrypted || 0);

      const hasEncryptedChanges: any = encryptedModifiedCount > 0;
      const isDirty: any = modifiedCount > 0;

      const shouldResetSubmitted: any = stateRef.current.submissionComplete && modifiedCount > 0;
      const shouldRelatchSubmitted: any =
        modifiedCount === 0 &&
        !stateRef.current.submittedSinceLastEdit &&
        !!stateRef.current.userHasResponse &&
        !stateRef.current.isSubmitting &&
        !stateRef.current.pileDiscardedEdits;

      if (
        stateRef.current.modifiedCount !== modifiedCount ||
        stateRef.current.encryptedModifiedCount !== encryptedModifiedCount ||
        stateRef.current.hasEncryptedChanges !== hasEncryptedChanges ||
        stateRef.current.isDirty !== isDirty ||
        shouldResetSubmitted ||
        shouldRelatchSubmitted
      ) {
        setState(buildEditStatsState({
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

const initializeSurveyResponseState = () => {
    const questionPoolIds: any = Array.isArray(propsRef.current.questionPool)
      ? propsRef.current.questionPool.map((question: any) => question.id)
      : [];
    const renderedQuestionIds: any = buildInitialSurveyResponseQuestionIds({
      singleQuestionMode: propsRef.current.singleQuestionMode,
      isStandalone: propsRef.current.isStandalone,
      questionPoolIds,
      questionId: propsRef.current.questionID,
      getRenderedQuestionIds: () => getCurrentRenderedQuestionIds(),
      stateQuestionPool: stateRef.current.questionPool,
    });

    return buildInitializedSurveyResponseState({
      singleQuestionMode: propsRef.current.singleQuestionMode,
      isStandalone: propsRef.current.isStandalone,
      surveyIndex: propsRef.current.surveyIndex,
      renderedQuestionIds,
      questionPoolIds,
      prevSurveysResponseState: stateRef.current.surveysResponseState,
      buildEmptyResponseFieldState: buildEmptyResponseFieldState,
    });
  };

const checkAndHandleStartFresh = () => {
    if (shouldSurveyAutoStartFresh({
      props: propsRef.current,
      state: stateRef.current,
      getRenderedQuestionIds: () => readRenderedQuestionIds({
        getRenderedQuestionIds: () => getCurrentRenderedQuestionIds(),
      }),
    })) {
      handleStartFresh();
    }
  };

const getSurveyQuestionPoolLoadState = () => {
    return buildSurveyQuestionPoolLoadState({
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      questionPoolExpectedIds: stateRef.current.questionPoolExpectedIds,
      questionPoolPendingIds: stateRef.current.questionPoolPendingIds,
    });
  };

const showTransientSubmitFeedback = (message: any = '', durationMs: any = 2000) => {
    const runtimeStrategy: any = getRuntimeStrategy();
    if (typeof runtimeStrategy?.showTransientSubmitFeedback === 'function') {
      return runtimeStrategy.showTransientSubmitFeedback(engine, message, durationMs);
    }
    if (inst._emptySubmitTimer) {
      clearTimeout(inst._emptySubmitTimer);
      inst._emptySubmitTimer = null;
    }
    const update: any = buildTransientSubmitFeedbackState({
      message,
    });
    setState(update);
    if (!update.submissionError) return;
    inst._emptySubmitTimer = setTimeout(() => {
      if (!inst._isMounted) return;
      const clearUpdate: any = buildClearedTransientSubmitFeedbackState();
      setState(clearUpdate);
      inst._emptySubmitTimer = null;
    }, normalizeTransientSubmitFeedbackDurationMs(durationMs));
  };

const maybeBlockSubmitUntilQuestionPoolComplete = () => {
    const { isIncomplete, pendingCount }: any = getSurveyQuestionPoolLoadState();
    if (!isIncomplete) return false;

    showTransientSubmitFeedback(buildQuestionPoolPendingSubmitFeedbackMessage({
      pendingCount,
    }));
    void fetchQuestionPool().catch((error: any) => {
      surveyLog.warn('SurveyQuestions: submit-triggered question pool refresh failed.', error);
    });
    return true;
  };

async function fetchQuestionPool() {
    if (propsRef.current.isStandalone || propsRef.current.singleQuestionMode) return;
    if (!propsRef.current.surveyId) {
      surveyLog.warn("SurveyQuestions: fetchQuestionPool – no surveyID supplied");
      setState(buildClearedSurveyQuestionPoolState());
      return;
    }

    // Prefer ID-aware resolver for /survey/:id routes (no /session/:slug)
    const slug: any = propsRef.current.surveyId
      ? resolveSlugForIds({ surveyId: propsRef.current.surveyId, props: propsRef.current, network: propsRef.current.network })
      : resolveEffectiveSlug(propsRef.current);
    const questionReadContext: any = resolveQuestionReadCacheContext(propsRef.current, slug);
    let effectiveSlug: any = questionReadContext.sessionSlug || slug;
    const netIdStr: any = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error("SurveyQuestions: fetchQuestionPool – network.id undefined");
      setState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const surveyIdLower: any = propsRef.current.surveyId.toLowerCase();

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
    if (propsRef.current.surveys && propsRef.current.surveyIndex !== null && propsRef.current.surveys[propsRef.current.surveyIndex]) {
      const surveyFromProp: any = propsRef.current.surveys[propsRef.current.surveyIndex];
      if (surveyFromProp.id && surveyFromProp.id.toLowerCase() === surveyIdLower) {
        surveyData = surveyFromProp;
      }
    }
    if (!surveyData) { surveyData = surveyDataFromCache; }

    // Temporary demo-1 compatibility: render fixture questions synchronously while
    // the durable Cloudflare-backed demo session is still pending.
    const temporaryDemoSessionConfig = propsRef.current.sessionConfig || {};
    const temporaryDemoSlugCandidates = [
      effectiveSlug,
      questionReadContext.sessionSlug,
      slug,
      propsRef.current.sessionSlug,
      propsRef.current.activeSessionSlug,
    ];
    let temporaryDemoFixtureSlug: any = '';
    let temporaryDemoFixtureQuestions: any[] = [];
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
      const questionMap = questionsNet.questions as SurveyQuestionsRecord;
      temporaryDemoFixtureQuestions.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid) return;
        questionMap[qid] = {
          ...question,
          id: qid,
        };
        if (questionsNet.pendingQuestionMetadata && typeof questionsNet.pendingQuestionMetadata === 'object') {
          const pendingQuestionMetadata = questionsNet.pendingQuestionMetadata as SurveyQuestionsRecord;
          delete pendingQuestionMetadata[qid];
        }
      });
      writeQuestionsCache(effectiveSlug, currentQuestionsCache);

      surveyData = {
        ...(surveyData || surveyDataFromCache || {}),
        id: surveyIdLower,
        surveyID: surveyIdLower,
        title: surveyData?.title || surveyDataFromCache?.title || propsRef.current.surveyTitle || 'Demo Session',
        sessionName: surveyData?.sessionName || surveyDataFromCache?.sessionName || propsRef.current.sessionName || effectiveSlug,
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
        surveyData = await (contractScripts as any).getSurveyDataById(propsRef.current.provider, surveyIdLower, effectiveSlug);
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
      setState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const blockedQuestionIds: any = getBlockedQuestionIdsSet(effectiveSlug);
    const expectedQuestionIds: any = surveyData.questionIDs
      .map((qid: any) => normalizeQuestionIdKey(qid))
      .filter((qid: any) => qid && !blockedQuestionIds.has(qid));

    if (shouldUseTemporaryDemoQuestionPool) {
      const fixtureQuestionById = new Map();
      temporaryDemoFixtureQuestions.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid || fixtureQuestionById.has(qid)) return;
        fixtureQuestionById.set(qid, { ...question, id: qid });
      });
      const questionPool = expectedQuestionIds
        .map((qid: any) => fixtureQuestionById.get(qid))
        .filter(Boolean);
      setState({
        questionPool,
        questionPoolExpectedIds: expectedQuestionIds,
        questionPoolPendingIds: expectedQuestionIds.filter((qid: any) => !fixtureQuestionById.has(qid)),
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
          const qData = networkQuestions[qid] as SurveyQuestionsCacheQuestion | undefined;
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
      setState((prev: any) => {
        const prevQuestionPool = Array.isArray(prev?.questionPool) ? prev.questionPool : [];
        const prevExpectedQuestionIds = Array.isArray(prev?.questionPoolExpectedIds)
          ? prev.questionPoolExpectedIds
          : [];
        const prevPendingQuestionIds = Array.isArray(prev?.questionPoolPendingIds)
          ? prev.questionPoolPendingIds
          : [];
        const prevQuestionPoolById = new Map();
        prevQuestionPool.forEach((entry: any) => {
          const key = normalizeQuestionIdKey(entry?.id);
          if (!key || prevQuestionPoolById.has(key)) return;
          prevQuestionPoolById.set(key, entry);
        });

        const mergedQuestionPool = questionPool.map((entry: any) => {
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
          prevExpectedQuestionIds.every((qid: any, index: any) => qid === expectedQuestionIds[index]);
        const pendingIdsUnchanged =
          prevPendingQuestionIds.length === pendingQuestionIds.length &&
          prevPendingQuestionIds.every((qid: any, index: any) => qid === pendingQuestionIds[index]);
        if (prevQuestionPoolSig === nextQuestionPoolSig) {
          const hasSemanticChange =
            prevQuestionPool.length !== mergedQuestionPool.length ||
            prevQuestionPool.some((entry: any, idx: any) => entry !== mergedQuestionPool[idx]);
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
    const cacheHydrationResults: any = await Promise.allSettled(
      surveyData.questionIDs.map(async (qid: any) => {
        try {
          await propsRef.current.ensureQuestionCached(qid, { sessionName: surveyData.sessionName });
          return qid;
        } finally {
          publishQuestionPoolFromCache();
        }
      })
    );
    const failedQuestionHydrations: any = cacheHydrationResults.filter((result: any) => result.status === 'rejected');
    if (failedQuestionHydrations.length > 0) {
      surveyLog.warn(
        `SurveyQuestions: ${failedQuestionHydrations.length} question cache hydration request(s) failed for survey ${surveyIdLower}.`,
        failedQuestionHydrations.map((result: any) => result.reason?.message || result.reason || 'unknown error')
      );
    }
    publishQuestionPoolFromCache({ warnMissing: true });
	  }

const loadQuestionFromCache = async (questionId: any) => {
    const slug: any = resolveEffectiveSlug(propsRef.current);
    const questionReadContext: any = resolveQuestionReadCacheContext(propsRef.current, slug);
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

const mergeSurveyResponseState = (currentState: any, newQuestionPool: any, surveyIndex: any = 0) => {
    return buildMergedSurveyResponseState({
      currentState,
      newQuestionPool,
      renderedQuestionIds: getCurrentRenderedQuestionIds(),
      surveyIndex,
      buildEmptyResponseFieldState: buildEmptyResponseFieldState,
    });
  };

async function fetchSurveyResponse() {
    if (!inst._isMounted) return;
    const runId: any = (Number(inst._fetchSurveyResponseRunId || 0) + 1);
    inst._fetchSurveyResponseRunId = runId;
    const isStale: any = () => !inst._isMounted || inst._fetchSurveyResponseRunId !== runId;
    const safe: any = (...args: any[]) => { if (!isStale()) (setResponseHydrationState as any)(...args); };

    safe(buildSurveyResponseFetchLoadingState());

    // 1. View Mode (Address lookup) - Unaffected by submission state
    if (propsRef.current.displayAnswerMode && propsRef.current.viewAddress) {
      try {
        const viewAnswers: any = await getLatestSurveyResponse(
          propsRef.current.viewAddress,
          propsRef.current.surveyId
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
    if (propsRef.current.account) {
      try {
        const userAnswers: any = await getLatestSurveyResponse(
          propsRef.current.account,
          propsRef.current.surveyId
        );
        if (isStale()) return;

        // Consistency check logic
        if (stateRef.current.submissionComplete) {
          const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : (propsRef.current.surveyIndex || 0);
          surveyLog.log("Comparing incoming chain data vs optimistic baseline");

          // Only switch off optimistic mode if chain data matches our submitted baseline
          if (userAnswers && areResponsesConsistent(userAnswers, surveyIndex)) {
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
            prefillSurveyResponses(userAnswers, { responseHydrationOwned: true });
          }
        } else {
          // Only reset to "no response" if we aren't holding an optimistic submission
          if (!stateRef.current.submissionComplete) {
            safe(buildUserSurveyResponseMissingState());
          }
        }
      } catch (error: any) {
        surveyLog.error("Error fetching user's survey response:", error);
        if (isStale()) return;
        // On error, if we are optimistic, we just stay optimistic.
        if (!stateRef.current.submissionComplete) {
          safe(buildUserSurveyResponseMissingState());
        }
      }
    }

    safe(buildResponseHydrationInvalidatedState());
  }

const prefillSingleQuestionResponse = (userAnswer: any) => {
    const questionId: any = normalizeQuestionIdKey(propsRef.current.questionID);

    executeSurveySingleQuestionPrefill({
      state: stateRef.current,
      questionId,
      userAnswer,
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      applyResponseHydrationListToSlice: inst._applyResponseHydrationListToSlice,
      setState: setResponseHydrationState.bind(engine),
      updateJsonPreview: updateJsonPreview,
      recalculateEditStats: recalculateEditStats,
    });
  };

const parseAnswerValue = (value: any) => {
    try {
      if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
        return JSON.parse(value);
      }
    } catch (e: any) {
      return value;
    }
    return value;
  };

const handleStartFresh = () => {
    invalidateResponseHydrationRuns();
    executeSurveyStartFresh({
      props: propsRef.current,
      state: stateRef.current,
      getRenderedQuestionIds: getCurrentRenderedQuestionIds,
      buildEmptyResponseFieldState: buildEmptyResponseFieldState,
      cloneValue: deepClone,
      setState: setState.bind(engine),
      clearDraftFor: clearDraftFor,
      recalculateEditStats: recalculateEditStats,
      persistDraftSafely: persistDraftSafely,
      updateSubmittedSinceLastEdit,
    });
  };

async function fetchSingleQuestionData(opts: any = {}) {
    const runId: any = (Number(inst._fetchSingleQuestionRunId) || 0) + 1;
    inst._fetchSingleQuestionRunId = runId;
    const isStaleRun: any = () => !inst._isMounted || inst._fetchSingleQuestionRunId !== runId;
    const safeSetState: any = (...args: any[]) => {
      if (!isStaleRun()) (setResponseHydrationState as any)(...args);
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
      getQuestionFetchCandidateSlugs: getQuestionFetchCandidateSlugs,
      maxCandidateSlugs,
      pendingRetrySig: inst._singleQuestionBootstrapRetrySig,
      props: propsRef.current,
      questionPool: stateRef.current.questionPool,
      runId,
    });
    if (sourceContextPlan.status === 'missing-question-id') {
      updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn('SurveyQuestions: No questionID provided in singleQuestionMode.');
      safeSetState(sourceContextPlan.statePatch);
      return;
    }
    const questionId: any = sourceContextPlan.questionId;
    const preserveCurrentSingleQuestionPool: any = (extraState: any = {}) => {
      const plan: any = buildSingleQuestionPreservedPoolState({
        questionId,
        questionPool: stateRef.current.questionPool,
        extraState,
      });
      if (plan.action !== 'preserve') return false;
      safeSetState(plan.statePatch);
      return true;
    };

    if (sourceContextPlan.retryCleanupAction !== 'none') {
      clearSingleQuestionBootstrapRetry();
    }
    updateSingleQuestionDebug(sourceContextPlan.startDebugPayload);

    let effectiveSingleSlug: any = sourceContextPlan.effectiveSingleSlug;
    const fetchCandidateSlugs: any = sourceContextPlan.fetchCandidateSlugs;
    const hasPendingRetryForQuestion: any = sourceContextPlan.hasPendingRetryForQuestion;

    if (sourceContextPlan.status === 'blocked-question') {
      updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn(`SurveyQuestions: Question ${questionId} is blocked; skipping.`);
      safeSetState(sourceContextPlan.statePatch);
      return;
    }

    const responderAddress: any = propsRef.current.responderAddress;

    const getCacheStateForSlug: any = async (slug: any) => resolveSingleQuestionCacheState({
      slug,
      questionId,
      resolveQuestionBootstrapContext: (nextSlug: any) => resolveQuestionBootstrapContext(propsRef.current, nextSlug),
      readQuestionsCacheAsync,
      ensureQuestionsNet: ensureQuestionsNet as any,
    });

    const cacheBootstrapResult: any = await resolveSingleQuestionCacheBootstrap({
      questionId,
      effectiveSingleSlug,
      responderAddress: String(responderAddress || ''),
      account: String(propsRef.current.account || ''),
      resolveCacheState: getCacheStateForSlug,
      readRecentPayload: readRecentQuestionPayload,
      canUseRecentPayload: canUseRecentQuestionPayloadForAccount,
      resolveBootstrapNetworkId: (slug: any) => resolveQuestionBootstrapContext(propsRef.current, slug).networkIdStr || '',
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
      setResponseHydrationState(
        (prev: any) => buildSingleQuestionSeededHydrationState({
          prevState: prev,
          questionData: seededQData,
          isLoadingResponse,
          mergeSurveyResponseState: mergeSurveyResponseState,
        }),
        () => {
          updateJsonPreview();
          rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
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
        const didScheduleRetry: any = scheduleSingleQuestionBootstrapRetry(stopHandlingPlan.retryRequest);
        const retryOutcome: any = (resolveSingleQuestionCacheBootstrapStopHandlingPlan({
          ...stopPlanContext,
          didScheduleRetry,
        } as any) as any).retryOutcome;
        if (retryOutcome?.debugPayload) {
          updateSingleQuestionDebug(retryOutcome.debugPayload);
        }
        if (retryOutcome?.shouldClearRetry) {
          clearSingleQuestionBootstrapRetry();
          safeSetState(retryOutcome.exhaustedStatePatch);
        }
        return;
      }

      if (stopHandlingPlan.action === 'fallback') {
        if (stopHandlingPlan.debugPayload) {
          updateSingleQuestionDebug(stopHandlingPlan.debugPayload);
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
      loginComplete: !!propsRef.current.loginComplete,
      hasAccount: !!propsRef.current.account,
      isMaskedQuestionPayload,
      fetchSingleQuestionMetadataCandidates: (args: any) => fetchSingleQuestionMetadataCandidates({
        ...args,
        getQuestionData: (candidateSlug: any) => (contractScripts as any).getQuestionData(
          propsRef.current.provider,
          questionId,
          candidateSlug,
          buildAutomaticQuestionMetadataFetchOptions(candidateSlug)
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
      const didScheduleRetry: any = scheduleSingleQuestionBootstrapRetry({
        questionId,
        attempt: bootstrapRetryAttempt,
        reason: metadataBootstrapResult.retryReason,
      });
      updateSingleQuestionDebug({
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
          mergeSurveyResponseState: mergeSurveyResponseState,
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
      clearSingleQuestionBootstrapRetry();
    }

    // Build pool and merge state before fetching responses
    if (isStaleRun()) return;
    setResponseHydrationState(
      (prev: any) => buildSingleQuestionReadyHydrationState(prev, {
        mergeSurveyResponseState: mergeSurveyResponseState,
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
          cloneValue: deepClone,
        });

        const readFreshCachedResponderResponse: any = async (responder: any) => (
          readFreshSingleQuestionCachedResponderResponse({
            responder,
            questionId,
            netIdStr,
            effectiveSingleSlug,
            readQuestionsCacheAsync,
            ensureQuestionsNet: ensureQuestionsNet as any,
            cloneValue: deepClone,
            updateQuestionsCache: (nextCache: any) => {
              questionsCache = nextCache;
            },
          })
        );

        // Fetch latest response for the appropriate address, scoped to engine slug
        if (responderAddress) {
          const viewedBootstrapResult: any = await executeViewedSingleQuestionResponseBootstrap({
            props: propsRef.current,
            state: stateRef.current,
            questionId,
            responderAddress,
            effectiveSingleSlug,
            bootstrapRetryAttempt,
            runId,
            isStaleRun,
            safeSetState,
            updateSingleQuestionDebug: updateSingleQuestionDebug,
            normalizeViewedResponse: normalizeSingleQuestionViewedResponse,
            mergeViewedResponse: mergeDecryptedViewedResponse as any,
            scheduleRetry: scheduleSingleQuestionBootstrapRetry,
            clearRetry: clearSingleQuestionBootstrapRetry,
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
            prefillSingleQuestionResponse: prefillSingleQuestionResponse,
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
            props: propsRef.current,
            state: stateRef.current,
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
            areResponsesConsistent: areResponsesConsistent,
            prefillSingleQuestionResponse: prefillSingleQuestionResponse,
          });
          if (ownBootstrapResult?.reason === 'stale') return;
        }

        // Maintain existing preview + local prefill behaviors
        if (isStaleRun()) return;
        updateJsonPreview();
        rehydrateDraftForRenderedIds();
        rehydrateLocalCacheAnswersForRenderedIds();
      }
    );
  }

const resolveDecryptSurveyId = (baselineForDecrypt: any, questionId: any = null) => {
    return (resolveDecryptSurveyIdHelper as any)(baselineForDecrypt, {
      propSurveyId: propsRef.current.surveyId || propsRef.current.surveyID,
      questionId,
      defaultSurveyId: ethers.constants.HashZero,
    });
  };

async function handleDecryptEdit() {
    const decryptContext: any = buildDecryptContextSnapshot();
    const decryptAttemptId: any = startSurveyDecryptAttempt();
    setState(buildDecryptEditStartState());
    const {
      surveyIndex,
      slug,
      fallbackUserAnswers,
      fallbackSourceSlice,
      previousStateSlice,
    }: any = (buildSurveyDecryptAttemptSourceInputsHelper as any)({
      decryptContext,
      state: stateRef.current,
      getEffectiveDraftSlug: () => inst._getEffectiveDraftSlug(),
    });

    try {
      const {
        sourceSlice,
        ratingEnvelopesByQid,
        chainId,
        lit,
        opts,
        poolForDecrypt,
      }: any = await prepareSurveyDecryptAttempt({
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
        host: engine,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;
      const {
        normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      }: any = await finalizeSurveyDecryptAttempt({
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
        host: engine,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;

      finishSurveyDecryptAttempt(decryptAttemptId);
      setState((prevState: any) => buildSurveyDecryptSuccessState(prevState, {
        surveyIndex,
        decryptedSlice: normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      }), () => {
        const jsonPreview: any = prepareJsonAndHash(surveyIndex);
        setState(buildJsonPreviewState(jsonPreview));
        persistDraftSafely && persistDraftSafely(0);
      });
    } catch (error: any) {
      surveyLog.error('Error decrypting answers:', error);
      if ((applySurveyDecryptStaleStatusHelper as any)({
        host: engine,
        context: decryptContext,
        attemptId: decryptAttemptId,
      }).shouldReturn) return;
      finishSurveyDecryptAttempt(decryptAttemptId);
      setState(buildDecryptEditFailureState(error.message));
    }
  }

const handleDecryptViewedResponseField = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null) => {
    const decryptContext: any = buildDecryptContextSnapshot();
    const taskKey: any = buildDecryptTaskKey('viewed', questionId, fieldToDecrypt, responseOverride, decryptContext);
    return runDedupedDecryptTask(
      taskKey,
      () => handleDecryptViewedResponseFieldInternal(questionId, fieldToDecrypt, responseOverride, decryptContext)
    );
  };

const getViewedResponseOverrideForQuestion = (questionId: any, responseContainer: any = stateRef.current?.parsedViewAddressAnswers) => {
    return (getViewedResponseOverrideForQuestionHelper as any)(
      questionId,
      responseContainer,
      propsRef.current.responderAddress || propsRef.current.viewAddress || '',
    );
  };

const handleDecryptViewedResponseFieldInternal = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null, decryptContext: any = null) => {
    const context: any = decryptContext || buildDecryptContextSnapshot();
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
      }: any = await prepareViewedQuestionDecryptState({
        questionId: qid,
        fieldToDecrypt,
        responseOverride,
        account: context.account,
        responderForLatest,
        sessionSlug: context.sessionSlug || '',
        networkID: context.networkID,
      });
      if (!isDecryptContextCurrent(context)) {
        return false;
      }

      const attemptStatus: any = (startQuestionDecryptAttemptStatusHelper as any)({
        host: engine,
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
      }: any = await finalizeQuestionDecryptAttempt({
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
        host: engine,
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
        host: engine,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        error,
      });
    }
  };

const handleDecryptQuestionAnswer = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null) => {
    const decryptContext: any = buildDecryptContextSnapshot();
    const taskKey: any = buildDecryptTaskKey('self', questionId, fieldToDecrypt, responseOverride, decryptContext);
    return runDedupedDecryptTask(
      taskKey,
      () => handleDecryptQuestionAnswerInternal(questionId, fieldToDecrypt, responseOverride, decryptContext)
    );
  };

const handleDecryptQuestionAnswerInternal = async (questionId: any, fieldToDecrypt: any = 'both', responseOverride: any = null, decryptContext: any = null) => {
    const context: any = decryptContext || buildDecryptContextSnapshot();
    let decryptAttemptToken: any = null;
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
      }: any = await prepareSelfQuestionDecryptState({
        surveyIndex,
        questionId: qid,
        fieldToDecrypt,
        responseOverride: effectiveResponseOverride,
        userAnswers: stateRef.current.userAnswers,
        account: context.account,
        sessionSlug: context.sessionSlug || '',
        networkID: context.networkID,
      });
      if (!isDecryptContextCurrent(context)) {
        return false;
      }

      const attemptStatus: any = (startQuestionDecryptAttemptStatusHelper as any)({
        host: engine,
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
      }: any = await finalizeQuestionDecryptAttempt({
        questionId: qid,
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
      if (completionStatus.shouldReturn) return completionStatus.result;

      return didUpdate;
    } catch (error: any) {
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

const handleAnswer = (surveyIndex: any, questionId: any, answer: any, options: any = {}) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: any = options?.persistDraft !== false;
    const afterUpdate: any = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;

    const sourceSlice: any =
      stateRef.current.surveysResponseState?.[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const plan: any = buildAnswerUpdatePlan(questionId, answer, sourceSlice, {
      buildEmptyResponseFieldState: ((qid: any, fk: any) => buildEmptyResponseFieldState(qid, fk)) as any,
      resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid: any) => isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (val: any, fk: any, f: any) => normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: ((af: any, ansf: any, qid: any) => buildInheritedAdditionalFieldState(af, ansf, qid)) as any,
      valuesEqual: (a: any, b: any) => valuesEqual(a, b),
      getQuestionById: (qid: any) => getQuestionById(qid),
      computeHash: (value: any) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: any = [...(stateRef.current.surveysResponseState || [])];
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

    setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit')
    ), () => {
      scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

const handleAdditional = (surveyIndex: any, questionId: any, additionalComments: any) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;

    const sourceSlice: any =
      stateRef.current.surveysResponseState?.[surveyIndex] ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const plan: any = buildAdditionalUpdatePlan(questionId, additionalComments, sourceSlice, {
      buildEmptyResponseFieldState: ((qid: any, fk: any) => buildEmptyResponseFieldState(qid, fk)) as any,
      resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid: any) => isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (val: any, fk: any, f: any) => normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: ((af: any, ansf: any, qid: any) => buildInheritedAdditionalFieldState(af, ansf, qid)) as any,
      valuesEqual: (a: any, b: any) => valuesEqual(a, b),
      getQuestionById: (qid: any) => getQuestionById(qid),
      computeHash: (value: any) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: any = [...(stateRef.current.surveysResponseState || [])];
    const slice: any = { ...sourceSlice };
    slice.additionalComments = {
      ...(slice.additionalComments || {}),
      [questionId]: plan.nextAdditionalState,
    };

    newSurveysResponseState[surveyIndex] = slice;

    setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit')
    ), () => {
      scheduleJsonPreviewUpdate();
      persistDraftSafely();
    });
  };

const handleConviction = (surveyIndex: any, questionId: any, conviction: any, options: any = {}) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: any = options?.persistDraft !== false;
    const afterUpdate: any = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue: any = stateRef.current.surveysResponseState?.[surveyIndex]?.conviction?.[questionId];
    if (priorValue === conviction) return;
    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: any = [...stateRef.current.surveysResponseState];
    const slice: any = { ...(newSurveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
    slice.conviction = { ...(slice.conviction || {}), [questionId]: conviction };
    newSurveysResponseState[surveyIndex] = slice;

    setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit')
    ), () => {
      scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

const handleImportance = (surveyIndex: any, questionId: any, importance: any, options: any = {}) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: any = options?.persistDraft !== false;
    const afterUpdate: any = typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue: any = stateRef.current.surveysResponseState?.[surveyIndex]?.importance?.[questionId];
    if (priorValue === importance) return;
    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: any = [...stateRef.current.surveysResponseState];
    const slice: any = { ...(newSurveysResponseState[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }) };
    slice.importance = { ...(slice.importance || {}), [questionId]: importance };
    newSurveysResponseState[surveyIndex] = slice;

    setState(buildSurveyUserEditResponseStatePatch(
      newSurveysResponseState,
      updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit')
    ), () => {
      scheduleJsonPreviewUpdate();
      if (shouldPersistDraft) persistDraftSafely();
      if (afterUpdate) afterUpdate();
    });
  };

const toggleAnswerEncryption = (surveyIndex: any, questionId: any, newEncryptedState: any) => {
    const idx: any = (propsRef.current.isStandalone || propsRef.current.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    invalidateDiffCaches();

    setState((prev: any) => buildAnswerEncryptionToggleResponseState(prev, {
      buildEncryptionTogglePlan: buildEncryptionTogglePlan as any,
      deps: {
        isQuestionLockedForResponse: (q: any) => isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => normalizeResponseEncryptionAudience(a, q),
      },
      newEncryptedState,
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      scheduleJsonPreviewUpdate();
      persistDraftSafely && persistDraftSafely();
    });
  };

const toggleAdditionalCommentsEncryption = (surveyIndex: any, questionId: any, newEncryptedState: any) => {
    const idx: any = (propsRef.current.isStandalone || propsRef.current.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    invalidateDiffCaches();

    setState((prev: any) => buildAdditionalEncryptionToggleResponseState(prev, {
      buildEncryptionTogglePlan: buildEncryptionTogglePlan as any,
      deps: {
        isQuestionLockedForResponse: (q: any) => isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => normalizeResponseEncryptionAudience(a, q),
      },
      newEncryptedState,
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      scheduleJsonPreviewUpdate();
      persistDraftSafely && persistDraftSafely();
    });
  };

const toggleDisplayAnswerMode = () => {
    setState(
      buildDisplayAnswerModeToggleState,
      async () => {
        if (stateRef.current.displayAnswerMode) {
          if (propsRef.current.singleQuestionMode && propsRef.current.responderAddress) {
            await fetchSingleQuestionData();
          } else if (propsRef.current.viewAddress) {
            await fetchSurveyResponse();
          }
        } else {
          setState(buildParsedViewAddressAnswersState());
        }
        updateJsonPreview();
      }
    );
  };

const handleShowJsonAtBottom = () => {
    if (!stateRef.current.showJson) {
      setState(buildShowJsonState(true), () => {
        if (bottomRef.current) {
          bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } else {
      if (bottomRef.current) {
        bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

const handleScrollToTop = () => {
    if (!stateRef.current.showJson) {
      setState(buildShowJsonState(true), () => {
        if (topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } else {
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

const getSurveyResponse = async (responderAddress: any, surveyID: any) => {
    // Prefer id-aware group resolution so /survey/:id outside /session still resolves
    const slug: any = resolveSlugForIds({
      surveyId: surveyID,
      props: propsRef.current,
      network: propsRef.current.network,
    });
    const surveyAnswers: any = await (contractScripts as any).getSurveyResponse(
      propsRef.current.provider,
      responderAddress,
      surveyID,
      slug
    );
    return surveyAnswers;
  };

const getSurveyMetadataForJson = (surveyHash: any) => {
    if (!surveyHash) return { surveyTitle: null, sessionName: '' };

    try {
      const slug: any = resolveSlugForIds({
        surveyId: surveyHash,
        props: propsRef.current,
        network: propsRef.current.network,
      });
      const context: any = resolveResponseJsonContext(propsRef.current, slug);
      const netIdStr: any = context.networkIdStr;
      const surveyIdLower: any = String(surveyHash || '').toLowerCase();
      const cacheKey: any = `${String(slug || '')}|${String(netIdStr || '')}|${surveyIdLower}`;
      const surveysCache: any = readSurveysCacheRef(slug) || {};
      if (
        inst._surveyJsonMetaCache.key === cacheKey &&
        inst._surveyJsonMetaCache.source === surveysCache &&
        inst._surveyJsonMetaCache.value
      ) {
        return inst._surveyJsonMetaCache.value;
      }

      let surveyTitle: any = null;
      let sessionName: any = '';
      const netBucket: any = netIdStr ? (surveysCache?.[netIdStr] || null) : null;
      const s: any = netBucket?.surveys?.[surveyIdLower];
      if (s?.title) surveyTitle = sanitizeSurveyTitleForResponsePayload(s);
      if (s?.sessionName) sessionName = s.sessionName;
      else if (context.sessionConfig?.sessionName) sessionName = context.sessionConfig.sessionName;

      const value: any = { surveyTitle, sessionName };
      inst._surveyJsonMetaCache = { key: cacheKey, source: surveysCache, value };
      return value;
    } catch {
      return { surveyTitle: null, sessionName: '' };
    }
  };

const prepareJsonAndHash = (surveyIndex: any, responderAddress?: any, overrideState: any = null) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    const surveyResponseState: any = overrideState || stateRef.current.surveysResponseState[surveyIndex];
    return buildResponsePayload({
      isStandalone: propsRef.current.isStandalone as any,
      singleQuestionMode: propsRef.current.singleQuestionMode as any,
      surveyId: propsRef.current.surveyId,
      account: responderAddress || propsRef.current.account,
      surveyIndex,
      surveyResponseState,
      questionPool: Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      pileQuestions: Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : [],
      resolveFieldEncryptionAudience: (field: any, qid: any, fieldKey: any) => resolveFieldEncryptionAudience(field, qid, fieldKey),
      getQuestionEncryptionGates: (q: any) => getQuestionEncryptionGates(q),
      resolveFieldEncryptionGateId: (field: any, qid: any, fieldKey: any) => resolveFieldEncryptionGateId(field, qid, fieldKey),
      normalizeFieldAudienceMode: (mode: any, fieldKey: any, field: any) => normalizeFieldAudienceMode(mode, fieldKey, field),
      getSurveyMetadataForJson: (hash: any) => getSurveyMetadataForJson(hash),
      resolveSessionContext: () => {
        const context: any = resolveResponseJsonContext(propsRef.current, resolveEffectiveSlug(propsRef.current));
        return { sessionName: context.sessionConfig?.sessionName || '' };
      },
      getConvictionFromSlice,
      getImportanceFromSlice,
      sanitizeQuestionPromptForResponsePayload: sanitizeQuestionPromptForResponsePayload as any,
    });
  };

const updateJsonPreview = (force: any = false) => {
    if (!force && !isResponseJsonPreviewVisible()) return;
    const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    setState(buildJsonPreviewState(prepareJsonAndHash(surveyIndex)));
  };

const jsonTreeDisplay = (jsonInput: any) => (
    <SurveyQuestionsJsonTree
      jsonInput={jsonInput}
      onInvalidInput={(...args: any[]) => surveyLog.error(...args)}
    />
  );

const handlePrimarySubmitClick = () => {
    const inFlightPlan: SurveyQuestionsPrimarySubmitPlan = buildSurveyQuestionsPrimarySubmitPlan({
      isSubmitting: stateRef.current.isSubmitting,
      submitGuardActive: inst._submitGuard,
    });
    if (inFlightPlan.action === 'inert') return;

    const pendingStats: SurveyQuestionsSubmitPendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: typeof getPendingEditStats === 'function'
        ? () => getPendingEditStats()
        : undefined,
      fallbackTotal: stateRef.current.modifiedCount || 0,
    });
    const pendingEditCount = pendingStats.total;
    const planBase: Parameters<typeof buildSurveyQuestionsPrimarySubmitPlan>[0] = {
      account: propsRef.current.account,
      draftSlug: '',
      isStandalone: propsRef.current.isStandalone,
      isSubmitting: stateRef.current.isSubmitting,
      pendingEditCount,
      questionID: propsRef.current.questionID,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      submissionComplete: stateRef.current.submissionComplete,
      submitGuardActive: inst._submitGuard,
      submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
      surveyId: propsRef.current.surveyId,
    };
    let plan: SurveyQuestionsPrimarySubmitPlan = buildSurveyQuestionsPrimarySubmitPlan(planBase);
    if (plan.action === 'navigate') {
      plan = buildSurveyQuestionsPrimarySubmitPlan({
        ...planBase,
        draftSlug: inst._getEffectiveDraftSlug(),
      });
    }
    if (plan.action === 'inert') return;
    if (plan.action === 'navigate') {
      runSurveyQuestionsSubmitController({
        plan,
        ports: {
          navigateToResponse: (path: string) => window.history.pushState({}, '', path),
        },
      });
      return;
    }
    runSurveyQuestionsSubmitController({
      plan,
      ports: {
        activateSubmitGuard: () => {
          inst._submitGuard = true;
        },
        dispatchSubmit: () => {
          encryptAndUpload();
        },
      },
    });
  };

const getQuestionsJson = () => {
    return buildSurveyQuestionsJson({
      singleQuestionMode: propsRef.current.singleQuestionMode,
      questionPool: stateRef.current.questionPool,
    });
  };

const getResponseJson = () => {
    const isViewingSubmitted: any = shouldUseSubmittedResponseJson({
      viewAddress: propsRef.current.viewAddress,
      responderAddress: propsRef.current.responderAddress,
      parsedViewAddressAnswers: stateRef.current.parsedViewAddressAnswers,
      isEditing: stateRef.current.isEditing,
      userAnswers: stateRef.current.userAnswers,
    });

    if (isViewingSubmitted) {
      return buildSubmittedResponseJson({
        rawResponse: stateRef.current.parsedViewAddressAnswers || stateRef.current.userAnswers,
        singleQuestionMode: propsRef.current.singleQuestionMode,
      });
    }

    const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    return prepareJsonAndHash(surveyIndex);
  };

const getSurveyJson = () => {
    return buildSurveyDefinitionJson({
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      surveys: propsRef.current.surveys,
      surveyIndex: propsRef.current.surveyIndex,
      questionPool: stateRef.current.questionPool,
    });
  };

const copyJsonToClipboard = (json: any, type: any) => {
    let jsonToUse: any = json;

    if (!jsonToUse || (typeof jsonToUse === 'object' && Object.keys(jsonToUse).length === 0)) {
      if (propsRef.current.singleQuestionMode) {
        jsonToUse = getResponseJson();
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
        setState(buildCopiedQuestionsJsonState(true));
        setManagedTimeout(() => {
          setState(buildCopiedQuestionsJsonState(false));
        }, 2000);
      } else if (type === 'response') {
        setState(buildCopiedResponseJsonState(true));
        setManagedTimeout(() => {
          setState(buildCopiedResponseJsonState(false));
        }, 2000);
      } else if (type === 'survey') {
        setState(buildCopiedSurveyJsonState(true));
        setManagedTimeout(() => {
          setState(buildCopiedSurveyJsonState(false));
        }, 2000);
      }
    }).catch((error: any) => {
      surveyLog.error('Failed to copy JSON to clipboard:', error);
    });
  };

const toggleShowQuestionsJson = () => {
    setState(buildQuestionsJsonToggleState);
  };

const toggleShowResponseJson = () => {
    setState(buildResponseJsonToggleState, () => {
      if (stateRef.current.showResponseJson) {
        updateJsonPreview(true);
        return;
      }
      if (inst._jsonPreviewTimer) {
        clearTimeout(inst._jsonPreviewTimer);
        inst._jsonPreviewTimer = null;
      }
    });
  };

const toggleShowSurveyJson = () => {
    setState(buildSurveyJsonToggleState);
  };

const getCommentsOpen = (questionId: any, defaultOpen: any = false) => {
    const current: any = stateRef.current?.showComments?.[questionId];
    return typeof current === 'boolean' ? current : !!defaultOpen;
  };

const toggleComments = (questionId: any, defaultOpen: any = false) => {
    const runtimeStrategy: any = getRuntimeStrategy();
    if (typeof runtimeStrategy?.toggleComments === 'function') {
      return runtimeStrategy.toggleComments(engine, questionId, defaultOpen);
    }
    setState((prev: any) => buildCommentsToggleState(prev, questionId, defaultOpen));
  };

const getLockAudienceDisplayState = ({
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
    const forcedGate: any = isQuestionLockedForResponse(qid);
    const gateOption: any = resolveQuestionGateOption(qid);
    const gateOptions: any = Array.isArray(gateOption?.gateDetails) ? gateOption.gateDetails : [];
    const currentAudience: any = resolveFieldEncryptionAudience(fieldState, qid, resolvedFieldKey);
    const currentGateId: any = resolveFieldEncryptionGateId(fieldState, qid, resolvedFieldKey);
    const currentAudienceMode: any = normalizeFieldAudienceMode(
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
      selfAudienceLabel: normalizeGateLabelText(selfAudienceLabel) || 'for me',
      showPlaintextOption,
      visualContext,
      forcedGate,
      gateOptions,
      hasGateOption: !!gateOption,
      menuOpen: isLockAudienceMenuOpen(qid, resolvedFieldKey),
      currentAudience,
      currentGateId,
      currentAudienceMode,
    });
    const menuStateKey: any = displayState.hasAudienceMenu
      ? getLockAudienceMenuStateKey(qid, displayState.effectiveFieldKey)
      : '';
    const expandedGateId: any = normalizeGateLabelText(
      stateRef.current.lockAudienceGateDetailsByQuestion?.[menuStateKey] || ''
    );

    return {
      ...displayState,
      expandedGateId,
    };
  };

const applyLockAudienceSelection = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    audience,
    gateId = '',
  }: any) => {
    if (effectiveFieldKey === 'additional') {
      applyAdditionalEncryptionAudience(surveyIndex, qid, audience, { gateId });
      return;
    }
    applyAnswerEncryptionAudience(surveyIndex, qid, audience, { gateId });
  };

const toggleQuestionFieldEncryptionEnabled = ({
    surveyIndex,
    qid,
    effectiveFieldKey,
    nextEncrypted,
  }: any) => {
    if (effectiveFieldKey === 'additional') {
      toggleAdditionalCommentsEncryption(surveyIndex, qid, nextEncrypted);
      return;
    }
    toggleAnswerEncryption(surveyIndex, qid, nextEncrypted);
  };

const handleLockAudienceButtonClick = ({
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
      toggleQuestionFieldEncryptionEnabled({
        surveyIndex,
        qid,
        effectiveFieldKey,
        nextEncrypted: action.nextEncrypted,
      });
      return;
    }

    if (action.kind === 'disable-field-encryption-and-close-menu') {
      toggleQuestionFieldEncryptionEnabled({
        surveyIndex,
        qid,
        effectiveFieldKey,
        nextEncrypted: false,
      });
      toggleLockAudienceMenu(qid, false, effectiveFieldKey);
      return;
    }

    if (action.kind === 'enable-answer-and-open-menu') {
      toggleAnswerEncryption(surveyIndex, qid, true);
      toggleLockAudienceMenu(qid, true, effectiveFieldKey);
      return;
    }

    if (action.kind === 'set-menu-open') {
      toggleLockAudienceMenu(qid, action.nextOpen, effectiveFieldKey);
    }
  };

const renderAnswerLockControl = ({
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
    }: any = getLockAudienceDisplayState({
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
      applyLockAudienceSelection({
        surveyIndex,
        qid,
        effectiveFieldKey,
        audience,
        gateId,
      });
    };

    const handleLockClick: any = () => {
      handleLockAudienceButtonClick({
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
          toggleLockAudienceGateDetails(nextQid, gateId, nextFieldKey)
        )}
      />
    );
  };

const renderQuestion = (question: any, qIndex: any, currentSurveyResponseState: any) => {
    if (!currentSurveyResponseState || !currentSurveyResponseState.answers) {
      surveyLog.warn('renderQuestion: currentSurveyResponseState or its answers property is undefined/null. Question ID:', question?.id);
      return null;
    }

    if (!question || !question.id || !question.type) {
      surveyLog.error('Invalid question data at index:', qIndex, question);
      return null;
    }

    const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    const displayState: any = getQuestionRenderDisplayState({
      questionId: question.id,
      responseSlice: currentSurveyResponseState,
    });
    const sliderOpen: any = !!stateRef.current.sliderToggleExpandedByQuestion?.[question.id];

    const cardKey: any = `${question.id}-${stateRef.current.decryptionNonce}`;
    const showResponseLookupSpinner: any = shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: propsRef.current.singleQuestionMode,
      isLoadingResponse: stateRef.current.isLoadingResponse,
      account: propsRef.current.account,
      viewAddress: propsRef.current.viewAddress,
      responderAddress: propsRef.current.responderAddress,
    });
    const isQuestionBookmarked: any = stateRef.current.bookmarkedQuestions.has(question.id);

    const cardIcons: any = renderFullQuestionCardIcons({
      question,
      showResponseLookupSpinner,
      isQuestionBookmarked,
    });

    // If the prompt is still masked, do not allow answering (prevents nonsense submits).
    // This primarily affects direct-link `/question/:id?...` flows; list views filter these out.
    const promptMasked: any = isQuestionPromptMasked(question);
    if (promptMasked) {
      return renderQuestionMaskedPromptCard({
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
      commentsOpen: getCommentsOpen(question.id, displayState.hasAdditionalContent),
      displayState,
      onToggleComments: toggleComments,
      qIndex,
      renderAdditionalDecryptControl: renderQuestionFieldDecryptControl,
      renderAdditionalInput: renderFullQuestionAdditionalInput,
      renderAdditionalLockControl: renderQuestionAdditionalLockControl,
      renderAnswerDecryptControl: renderQuestionFieldDecryptControl,
      renderFullQuestionCardShell: renderFullQuestionCardShell,
      renderFullQuestionFooterIcons: renderFullQuestionFooterIcons,
      renderFullQuestionSliderSection: renderFullQuestionSliderSection,
      renderResponseInput: renderFullQuestionResponseInput,
      sliderOpen,
      surveyIndex,
    });
  };

const buildResponseGatePolicyCacheKey = () =>
    buildResponseGatePolicyCacheKeyFromInputs({
      singleQuestionMode: isResponseGateQuestionFlow(),
      isStandalone: propsRef.current.isStandalone,
      questionID: propsRef.current.questionID,
      surveyId: propsRef.current.surveyId,
      hintedSessionSlug: getExplicitResponseGateSessionSlug(),
      effectiveSessionSlug: resolveResponseGateSessionSlug(),
      networkId: String(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? ''),
    });

const getQuestionRouteSessionSlug = () => {
    try {
      if (typeof window === 'undefined') return '';
      return normalizeSessionSlugValue(parseQuestionSessionSlugFromSearch(window.location?.search || '') || '');
    } catch (_: any) {
      return '';
    }
  };

const getExplicitResponseGateSessionSlug = () => (
    getQuestionRouteSessionSlug() ||
    normalizeSessionSlugValue(getSessionSlugHintFromProps(propsRef.current))
  );

const isResponseGateQuestionFlow = (questionId: any = propsRef.current.questionID) => !!(
    propsRef.current.singleQuestionMode ||
    propsRef.current.isStandalone ||
    questionId
  );

const resolveResponseGateSessionSlug = (questionId: any = propsRef.current.questionID) => {
    const explicitSlug: any = getExplicitResponseGateSessionSlug();
    if (explicitSlug) return explicitSlug;
    if (isResponseGateQuestionFlow(questionId)) {
      return questionId
        ? resolveSlugForIds({
            questionId,
            props: propsRef.current,
            network: propsRef.current.network,
          })
        : resolveEffectiveSlug(propsRef.current);
    }
    return resolveSlugForIds({
      surveyId: propsRef.current.surveyId || null,
      props: propsRef.current,
      network: propsRef.current.network,
    });
  };

const getResponseGatePolicy = () => {
    const cacheKey: any = buildResponseGatePolicyCacheKey();
    const isQuestionResponseFlow: any = isResponseGateQuestionFlow();
    const cached: any = inst._responseGatePolicyCache;
    const now: any = Date.now();

    let slug: any = '';
    let cfg: any = {};
    let cfgSignature: any = '';

    try {
      slug = resolveResponseGateSessionSlug();
      cfg = resolveEffectiveResponseGateConfig(slug);
      cfgSignature = buildResponseGateConfigSignature(cfg);
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
      inst._responseGatePolicyCache = { ...cached, cfg, ts: now };
      return cached.value;
    }

    let policy: any = null;
    try {
      const fallbackChainId: any = resolveSessionChainId(slug, cfg);
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

    inst._responseGatePolicyCache = { key: cacheKey, cfgSignature, cfg, value: policy, ts: now };
    return policy;
  };

const getQuestionLookupMap = () => {
    const stateQuestionPool: any = Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : null;
    const statePileQuestions: any = Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : null;
    const propsQuestionPool: any = Array.isArray(propsRef.current.questionPool) ? propsRef.current.questionPool : null;
    const cache: any = inst._questionByIdLookupCache;

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

    inst._questionByIdLookupCache = {
      stateQuestionPool,
      statePileQuestions,
      propsQuestionPool,
      value: next,
    };
    return next;
  };

const getQuestionById = (questionId: any) => {
    const qid: any = normalizeQuestionIdKey(questionId);
    if (!qid) return null;
    return getQuestionLookupMap().get(qid) || null;
  };

const buildGateAudienceSbtItems = (sbtAddresses: any = [], sessionSlug: any = '') => (
    buildGateAudienceSbtItemsController(sbtAddresses, sessionSlug, {
      resolveSbtGateLabel: (address: any) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      buildSbtDetailPath,
    })
  );

const getQuestionEncryptionGates = (question: any) => getQuestionEncryptionGatesCore(question);

const normalizeFieldAudienceMode = (value: any, fieldKey: any = 'answer', field: any = {}) =>
    normalizeFieldAudienceModeCore(value, fieldKey, field, hasMeaningfulFieldValue as any);

const getQuestionGateOptions = (questionId: any) => (
    getQuestionGateOptionsController(questionId, {
      getQuestionById: (qid: any) => getQuestionById(qid),
      getQuestionEncryptionGates: (question: any) => getQuestionEncryptionGates(question),
      buildRecipientsFromGates: (gates: any) => buildRecipientsFromGates(gates),
      normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (opts: any = {}) => resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate: any = {}, fallbackSbt: any = '') => resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (sbtAddresses: any = [], sessionSlug: any = '') => buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address: any) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      normalizeQuestionIdKey,
    })
  );

const buildFallbackResponseGateOptions = (questionId: any = null) => {
    const slug: any = normalizeSessionSlugValue(resolveResponseGateSessionSlug(questionId));
    const cfg: any = resolveEffectiveResponseGateConfig(slug);
    const isQuestionResponseFlow: any = isResponseGateQuestionFlow(questionId);
    const policy: any = buildResponseGatePolicy({
      cfg,
      isQuestionResponseFlow,
      fallbackChainId: resolveSessionChainId(slug, cfg),
    });
    const gates: any = Array.isArray(policy?.gates) ? policy.gates : [];
    const recipients: any = Array.isArray(policy?.recipients) ? policy.recipients : [];

    return gates
      .map((gate: any, gateIndex: any) => {
        const sbtAddresses: any = Array.from(new Set(
          (Array.isArray(gate?.sbtAddresses) ? gate.sbtAddresses : [])
            .map((address: any) => String(address || '').trim())
            .filter(Boolean)
        ));
        if (!sbtAddresses.length) return null;
        const gateId: any = normalizeGateLabelText(
          gate?.gateId || gate?.id || gate?.resourceKey || ''
        ) || `gate-${gateIndex}`;
        const label: any = resolveConfiguredGateLabel({
          gate,
          resourceKey: policy?.primaryResource || '',
          sbtAddresses,
        }) || resolveGateDisplayLabel(gate, sbtAddresses[0] || '') || gate?.label || `${t('gate')} ${gateIndex + 1}`;
        const gateRecipients: any = recipients[gateIndex]
          ? [recipients[gateIndex]]
          : buildRecipientsFromGates([gate]);
        return {
          gateId,
          label,
          sbtAddresses,
          sbtItems: buildGateAudienceSbtItems(sbtAddresses, slug),
          sbtSummary: sbtAddresses
            .map((address: any) => resolveSbtGateLabel(address) || getShortenedAddress(address, false))
            .join(', '),
          recipients: gateRecipients,
        };
      })
      .filter(Boolean);
  };

const getResponseGateOptions = (questionId: any = null) => {
    const options: any = getResponseGateOptionsController(questionId, {
      normalizeQuestionIdKey,
      isQuestionLockedForResponse: (qid: any) => isQuestionLockedForResponse(qid),
      getQuestionGateOptions: (qid: any = null) => getQuestionGateOptions(qid),
      getResponseGatePolicy: () => getResponseGatePolicy(),
      buildRecipientsFromGates: (gates: any) => buildRecipientsFromGates(gates),
      resolveLockAudienceSessionName: () => resolveLockAudienceSessionName(),
      resolveConfiguredGateLabel: (opts: any = {}) => resolveConfiguredGateLabel(opts),
      resolveGateDisplayLabel: (gate: any = {}, fallbackSbt: any = '') => resolveGateDisplayLabel(gate, fallbackSbt),
      buildGateAudienceSbtItems: (sbtAddresses: any = [], sessionSlug: any = '') => buildGateAudienceSbtItems(sbtAddresses, sessionSlug),
      resolveSbtGateLabel: (address: any) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      t,
      getEffectiveDraftSlug: typeof inst._getEffectiveDraftSlug === 'function'
        ? () => inst._getEffectiveDraftSlug()
        : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(propsRef.current),
    });
    return Array.isArray(options) && options.length > 0
      ? options
      : buildFallbackResponseGateOptions(questionId);
  };

const getResponseGateOptionById = (questionId: any = null, gateId: any = '') => (
    getResponseGateOptionByIdController(questionId, gateId, {
      normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
      getResponseGateOptions: (qid: any = null) => getResponseGateOptions(qid),
    })
  );

const resolveFieldEncryptionGateId = (field: any = {}, questionId: any = null, fieldKey: any = 'answer') => (
    resolveFieldEncryptionGateIdController(field, questionId, fieldKey, {
      resolveFieldEncryptionAudience: (nextField: any, qid: any, fk: any) => resolveFieldEncryptionAudience(nextField, qid, fk),
      normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
      getResponseGateOptionById: (qid: any = null, gateId: any = '') => getResponseGateOptionById(qid, gateId),
    })
  );

const buildInheritedAdditionalFieldState = (additionalField: any = {}, answerField: any = {}, questionId: any = null) =>
    buildInheritedAdditionalFieldStateCore(additionalField, answerField, questionId, {
      resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => resolveFieldEncryptionGateId(field, qid, fk),
    });

const getEffectiveRecipientsForField = ({ questionId, fieldKey = 'answer', field = null }: any = {}) => (
    getEffectiveRecipientsForFieldController({ questionId, fieldKey, field }, {
      normalizeQuestionIdKey,
      isQuestionLockedForResponse: (qid: any) => isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => getEffectiveRecipientsForQid(qid),
      resolveFieldEncryptionAudience: (nextField: any, qid: any, fk: any) => resolveFieldEncryptionAudience(nextField, qid, fk),
      resolveFieldEncryptionGateId: (nextField: any, qid: any, fk: any) => resolveFieldEncryptionGateId(nextField, qid, fk),
      getResponseGateOptionById: (qid: any = null, gateId: any = '') => getResponseGateOptionById(qid, gateId),
    })
  );

const resolveGatedPromptGateNames = (question: any) => (
    resolveGatedPromptGateNamesController(question, {
      normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
      resolveGateDisplayLabel: (gate: any = {}, fallbackSbt: any = '') => resolveGateDisplayLabel(gate, fallbackSbt),
      getQuestionEncryptionGates: (nextQuestion: any) => getQuestionEncryptionGates(nextQuestion),
      getEffectiveDraftSlug: typeof inst._getEffectiveDraftSlug === 'function'
        ? () => inst._getEffectiveDraftSlug()
        : null,
      resolveEffectiveSlug: () => resolveEffectiveSlug(propsRef.current),
      resolveEffectiveResponseGateConfig: (slug: any) => resolveEffectiveResponseGateConfig(slug),
    })
  );

const buildRecipientsFromGates = (gates: any = []) => (
    buildRecipientsFromGatesController(gates, {
      resolveSessionChainId: () => resolveSessionChainId(),
    })
  );

const isQuestionLockedForResponse = (questionId: any) => {
    const q: any = getQuestionById(questionId);
    return getQuestionEncryptionGates(q).length > 0;
  };

const getEffectiveRecipientsForQid = (questionId: any) => {
    const q: any = getQuestionById(questionId);
    const gates: any = getQuestionEncryptionGates(q);
    if (gates.length) return buildRecipientsFromGates(gates);
    const policy: any = getResponseGatePolicy();
    return Array.isArray(policy?.recipients) ? policy.recipients : [];
  };

const hasDefaultResponseGateRecipients = () => {
    const recipients: any = getResponseGatePolicy()?.recipients;
    return Array.isArray(recipients) && recipients.length > 0;
  };

const getDefaultResponseEncryptionAudience = () => (
    hasDefaultResponseGateRecipients() ? 'gate' : 'self'
  );

const getDefaultResponseEncryptionAudienceForQid = (questionId: any) => (
    isQuestionLockedForResponse(questionId) || getEffectiveRecipientsForQid(questionId).length > 0
      ? 'gate'
      : 'self'
  );

const normalizeResponseEncryptionAudience = (value: any, questionId: any = null) =>
    normalizeResponseEncryptionAudienceCore(value, questionId, {
      isQuestionLocked: (qid: any) => isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: any) => getEffectiveRecipientsForQid(qid),
      hasDefaultGateRecipients: () => hasDefaultResponseGateRecipients(),
    });

const buildEmptyResponseFieldState = (questionId: any = null, fieldKey: any = 'answer') =>
    buildEmptyResponseFieldStateCore(questionId, fieldKey, {
      getDefaultAudienceForQid: (qid: any) => getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => getDefaultResponseEncryptionAudience(),
      resolveFieldEncryptionGateId: (field: any, qid: any, fk: any) => resolveFieldEncryptionGateId(field, qid, fk),
      normalizeFieldAudienceMode: (val: any, fk: any, f: any) => normalizeFieldAudienceMode(val, fk, f),
    });

const resolveFieldEncryptionAudience = (field: any = {}, questionId: any = null, fieldKey: any = 'answer') =>
    resolveFieldEncryptionAudienceCore(field, questionId, fieldKey, {
      normalizeAudience: (val: any, qid: any) => normalizeResponseEncryptionAudience(val, qid),
      getDefaultAudienceForQid: (qid: any) => getDefaultResponseEncryptionAudienceForQid(qid),
      getDefaultAudience: () => getDefaultResponseEncryptionAudience(),
    });

const normalizeGateLabelText = (value: any) => normalizeGateLabelTextCore(value);

const resolveSbtGateLabel = (address: any, preferredSlug: any = '') => {
    const normalizedAddress: any = String(address || '').trim();
    if (!normalizedAddress) return '';
    const slug: any = String(
      preferredSlug ||
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(propsRef.current) ||
      ''
    ).trim().toLowerCase();
    return resolveSbtDisplayLabel({
      address: normalizedAddress,
      preferredSlug: slug,
      fallback: 'short',
    });
  };

const collectGateSbtAddressesForHydration = () => {
    const policy: any = getResponseGatePolicy();
    const questionPools: any = [
      Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : [],
      Array.isArray(propsRef.current.questionPool) ? propsRef.current.questionPool : [],
    ];

    return collectGateSbtAddressesForHydrationFromSources({
      policy,
      questionPools,
      getQuestionEncryptionGates: (question: any) => getQuestionEncryptionGates(question),
      isAddress: (value: any) => ethers.utils.isAddress(value),
      getAddress: (value: any) => ethers.utils.getAddress(value),
    });
  };

const hydrateGateSbtLabels = async ({ force = false }: any = {}) => {
    const addresses: any = collectGateSbtAddressesForHydration();
    const slug: any = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(propsRef.current) ||
      ''
    ).trim().toLowerCase();
    const cfg: any = resolveEffectiveResponseGateConfig(slug);
    const chainId: any = resolveSessionChainId(slug, cfg);
    const signature: any = `${slug}|${Number(chainId || 0)}|${addresses.join(',')}`;
    if (!force && signature === inst._gateSbtHydrationSig) return;
    inst._gateSbtHydrationSig = signature;
    if (!addresses.length) {
      clearGateSbtHydrationRetry();
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
      if (!inst._isMounted) return;
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
          clearGateSbtHydrationRetry();
          return;
        }
        inst._gateSbtHydrationSig = '';
        scheduleGateSbtHydrationRetry();
        return;
      }
      if (hasUnresolvedAddresses) {
        if (targetedLookupEnabled) {
          inst._gateSbtHydrationSig = '';
          scheduleGateSbtHydrationRetry();
        } else {
          clearGateSbtHydrationRetry();
        }
      } else {
        clearGateSbtHydrationRetry();
      }
      setState(buildGateSbtNameRevisionState);
    } catch (_: any) {
      if (!isTargetedSbtMetadataLookupEnabled()) {
        clearGateSbtHydrationRetry();
        return;
      }
      inst._gateSbtHydrationSig = '';
      scheduleGateSbtHydrationRetry();
    }
  };

const buildLockedQuestionGateDetails = (hiddenMaskedQuestionIds: any = []) => {
    const hiddenIds: any = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: any) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (hiddenIds.size === 0) return [];

    const pool: any = getLockedQuestionGateSourcePool(hiddenMaskedQuestionIds);
    const slug: any = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(propsRef.current) ||
      ''
    ).trim().toLowerCase();
    const questionGateDetails: any = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds,
      pool,
      slug,
      getQuestionEncryptionGates: (question: any) => getQuestionEncryptionGates(question),
      normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (args: any) => resolveConfiguredGateLabel(args),
      resolveSbtGateLabel: (address: any, preferredSlug: any = '') => resolveSbtGateLabel(address, preferredSlug),
      getShortenedAddress: getShortenedAddress as any,
      buildSbtDetailPath,
      normalizeSessionSlug: normalizeSessionSlugValue,
      getChecksumAddress: (address: any) => (
        ethers.utils.isAddress(address) ? ethers.utils.getAddress(address) : address
      ),
      translate: t,
    });
    if (questionGateDetails.length > 0) return questionGateDetails;
    return buildSessionQuestionGateDetails(hiddenIds.size || 1);
  };

const getLockedQuestionGateSourcePool = (hiddenMaskedQuestionIds: any = []) => {
    const hiddenIds: any = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: any) => String(qid || '').trim().toLowerCase())
        .filter(Boolean)
    );
    const candidates: any = [
      Array.isArray(stateRef.current.allQuestionsForFilter) ? stateRef.current.allQuestionsForFilter : [],
      Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      Array.isArray(propsRef.current.questionPool) ? propsRef.current.questionPool : [],
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
        gateCount += getQuestionEncryptionGates(question).length;
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

const getMemoizedLockedQuestionGateDetails = (hiddenMaskedQuestionIds: any = []) => {
    const hiddenIds: any = (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
      .map((qid: any) => String(qid || '').trim().toLowerCase())
      .filter(Boolean);
    const hiddenSignature: any = hiddenIds.join('|');
    const pool: any = getLockedQuestionGateSourcePool(hiddenIds);
    const memo: any = inst._lockedQuestionGateDetailsMemo || {};
    let poolVersion: any = Number(memo.poolVersion || 0);
    if (memo.poolRef !== pool) {
      poolVersion += 1;
      inst._lockedQuestionGateDetailsMemo = {
        ...memo,
        poolRef: pool,
        poolVersion,
      };
    }
    const memoKey: any = [
      hiddenSignature,
      `pool:${poolVersion}`,
      `gateRev:${Number(stateRef.current.gateSbtNameRevision || 0)}`,
    ].join('|');
    if (inst._lockedQuestionGateDetailsMemo?.key === memoKey) {
      return inst._lockedQuestionGateDetailsMemo.value;
    }
    const nextValue: any = buildLockedQuestionGateDetails(hiddenIds);
    inst._lockedQuestionGateDetailsMemo = {
      ...inst._lockedQuestionGateDetailsMemo,
      key: memoKey,
      value: nextValue,
    };
    return nextValue;
  };

const buildSessionQuestionGateDetails = (questionCount: any = 0) => {
    const count: any = Math.max(1, Number(questionCount || 0) || 1);
    const slug: any = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
      resolveEffectiveSlug(propsRef.current) ||
      ''
    ).trim().toLowerCase();
    const options: any = getResponseGateOptions(null);
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
            label: resolveSbtGateLabel(address, sessionSlug) || getShortenedAddress(address, false),
            href: buildSbtDetailPath(address, sessionSlug),
          })),
        };
      })
      .filter(Boolean);
  };

const getLockedGateRequirementSentence = (lockedGateDetails: any = []) => (
    buildLockedGateRequirementSentenceCore(lockedGateDetails, { translate: t })
  );

const renderLockedQuestionsPanel = ({
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
      bulkPromptReloading={!!stateRef.current.bulkPromptReloading}
      lockedGateDetailsExpanded={!!stateRef.current.lockedGateDetailsExpanded}
      onDecrypt={(questionIds: any) => reloadMaskedQuestionBatch(questionIds)}
      onToggleDetails={() => setState(buildLockedGateDetailsExpandedState)}
    />
  );

const resolveGateDisplayLabel = (gate: any = {}, fallbackSbt: any = '') => (
    resolveGateDisplayLabelController(gate, fallbackSbt, {
      normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
      resolveSbtGateLabel: (address: any) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as any,
      t,
    })
  );

const resolveConfiguredGateLabel = ({ gate = {}, resourceKey = '', sbtAddresses = [] }: any = {}) => (
    resolveConfiguredGateLabelController(
      { gate, resourceKey, sbtAddresses },
      inst._responseGatePolicyCache?.cfg,
      {
        normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
        resolveGateDisplayLabel: (configuredGate: any = {}, fallbackSbt: any = '') => (
          resolveGateDisplayLabel(configuredGate, fallbackSbt)
        ),
      },
    )
  );

const resolveLockAudienceSessionName = () => (
    resolveLockAudienceSessionNameController({
      normalizeGateLabelText: (value: any) => normalizeGateLabelText(value),
      props: propsRef.current,
      responseGatePolicyCacheCfg: inst._responseGatePolicyCache?.cfg as any,
      resolveSlugForIds,
      resolveLockAudienceSessionNameContext,
    })
  );

const resolveQuestionGateOption = (questionId: any = null) => {
    const gateDetails: any = getResponseGateOptions(questionId);
    if (!gateDetails.length) return null;

    const gateNames: any = Array.from(new Set(gateDetails.map((entry: any) => entry.label).filter(Boolean)));
    const allSbtAddresses: any = Array.from(new Set(gateDetails.flatMap((entry: any) => entry.sbtAddresses || [])));
    const sbtSummary: any = allSbtAddresses.length > 0
      ? allSbtAddresses
        .map((addr: any) => resolveSbtGateLabel(addr) || getShortenedAddress(addr, false))
        .join(', ')
      : 'none';

    return {
      label: gateNames.join(', ') || gateDetails[0]?.label || 'gate',
      gateNames,
      gateDetails,
      sbtSummary,
      resourceKey: getResponseGatePolicy()?.primaryResource || 'default',
    };
  };

const getLockAudienceMenuStateKey = (questionId: any, fieldKey: any = 'answer') => {
    const qid: any = String(questionId || '').toLowerCase();
    if (!qid) return '';
    return String(fieldKey || '').trim().toLowerCase() === 'additional'
      ? `${qid}:additional`
      : qid;
  };

const isLockAudienceMenuOpen = (questionId: any, fieldKey: any = 'answer') => {
    const key: any = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return false;
    return !!(stateRef.current.lockAudienceMenuByQuestion && stateRef.current.lockAudienceMenuByQuestion[key]);
  };

const toggleLockAudienceGateDetails = (questionId: any, forceOpen: any = null, fieldKey: any = 'answer') => {
    const key: any = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    const normalizedGateId: any = normalizeGateLabelText(
      typeof forceOpen === 'string' ? forceOpen : ''
    );
    setState((prev: any) => buildLockAudienceGateDetailsState(
      prev,
      key,
      forceOpen,
      normalizedGateId,
      normalizeGateLabelText
    ));
  };

const toggleLockAudienceMenu = (questionId: any, forceOpen: any = null, fieldKey: any = 'answer') => {
    const key: any = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    setState((prev: any) => buildLockAudienceMenuState(prev, key, forceOpen));
  };

const applyAnswerEncryptionAudience = (surveyIndex: any, questionId: any, audience: any, options: any = {}) => {
    const idx: any = (propsRef.current.isStandalone || propsRef.current.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    if (!qid) return;
    invalidateDiffCaches();

    setState((prev: any) => buildAnswerEncryptionAudienceState(prev, {
      audience,
      buildAnswerAudienceSelectionPlan: buildAnswerAudienceSelectionPlan as any,
      buildSurveyResponseStateArray,
      deps: {
        isQuestionLockedForResponse: (q: any) => isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => normalizeResponseEncryptionAudience(a, q),
      },
      gateId: options?.gateId || '',
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      scheduleJsonPreviewUpdate();
      persistDraftSafely && persistDraftSafely();
    });
  };

const applyAdditionalEncryptionAudience = (surveyIndex: any, questionId: any, audience: any, options: any = {}) => {
    const idx: any = (propsRef.current.isStandalone || propsRef.current.singleQuestionMode) ? 0 : (surveyIndex || 0);
    const qid: any = String(questionId || '').toLowerCase();
    if (!qid) return;
    invalidateDiffCaches();

    setState((prev: any) => buildAdditionalEncryptionAudienceState(prev, {
      audience,
      buildAdditionalAudienceSelectionPlan: buildAdditionalAudienceSelectionPlan as any,
      buildSurveyResponseStateArray,
      deps: {
        isQuestionLockedForResponse: (q: any) => isQuestionLockedForResponse(q),
        buildEmptyResponseFieldState: (q: any, fk: any) => buildEmptyResponseFieldState(q, fk),
        resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => resolveFieldEncryptionAudience(f, q, fk),
        resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => resolveFieldEncryptionGateId(f, q, fk),
        normalizeFieldAudienceMode: (v: any, fk: any, f: any) => normalizeFieldAudienceMode(v, fk, f),
        buildInheritedAdditionalFieldState: (af: any, ans: any, q: any) => buildInheritedAdditionalFieldState(af, ans, q),
        normalizeResponseEncryptionAudience: (a: any, q: any) => normalizeResponseEncryptionAudience(a, q),
      },
      gateId: options?.gateId || '',
      questionId: qid,
      surveyIndex: idx,
    }), () => {
      scheduleJsonPreviewUpdate();
      persistDraftSafely && persistDraftSafely();
    });
  };

const buildLitEncryptionOptionsForRecipients = (recipients: any = []) => {
    const list: any = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
    if (!list.length) return undefined;

    const litHooks: any =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
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
    else if (propsRef.current.provider) out.providerLike = propsRef.current.provider;
    if (litHooks.resourceAbilityRequests) out.resourceAbilityRequests = litHooks.resourceAbilityRequests;

    return out;
  };

const buildFieldEncryptionWorkGroups = (slice: any = {}, changedQids: any = new Set()) => {
    return buildFieldEncryptionWorkGroupsCore(slice, changedQids, {
      isQuestionLockedForResponse: (q: any) => isQuestionLockedForResponse(q),
      resolveFieldEncryptionGateId: (f: any, q: any, fk: any) => resolveFieldEncryptionGateId(f, q, fk),
      resolveFieldEncryptionAudience: (f: any, q: any, fk: any) => resolveFieldEncryptionAudience(f, q, fk),
      getEffectiveRecipientsForField: ((opts: any) => getEffectiveRecipientsForField(opts)) as any,
    });
  };

const encryptFieldWorkGroups = async ({ workGroups = [], baseOpts = {} }: any = {}) => {
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
        const lit: any = buildLitEncryptionOptionsForRecipients(group.recipients);
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
      props: propsRef.current,
      account: propsRef.current.account || '',
      provider: propsRef.current.provider,
      providerKind: String((cryptoUtils as any).getProviderKind(propsRef.current.provider) || '').trim().toLowerCase(),
      loginComplete: !!propsRef.current.loginComplete,
      singleQuestionMode,
      isStandalone,
      surveyIndex,
      surveyId: propsRef.current.surveyId || '',
      questionID: propsRef.current.questionID || '',
      effectiveDraftSlug,
      chainId: resolveSessionChainId(effectiveDraftSlug, null, propsRef.current),
      mounted: !!inst._isMounted,
    };
  };

const buildSubmitContextKey = (snapshot: any = null) => {
    const context: any = snapshot || buildSubmitContextSnapshot();
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

const isSubmitContextCurrent = (snapshot: any = null) => (
    !!snapshot &&
    (!snapshot.mounted || inst._isMounted) &&
    buildSubmitContextKey(snapshot) === buildSubmitContextKey()
  );

const startSubmitAttempt = (): number => {
    const attemptId = (Number(inst._submitAttemptSeq) || 0) + 1;
    inst._submitAttemptSeq = attemptId;
    inst._activeSubmitAttemptSeq = attemptId;
    return attemptId;
  };

const finishSubmitAttempt = (attemptId: unknown = null): void => {
    if (Number(attemptId || 0) > 0 && inst._activeSubmitAttemptSeq === attemptId) {
      inst._activeSubmitAttemptSeq = 0;
    }
  };

const handleStaleSubmitContext = (snapshot: any = null) => {
    runSurveyQuestionsStaleSubmitController({
      snapshot,
      ports: {
        clearSubmitGuard: () => {
          inst._submitGuard = false;
        },
        canUpdateSubmitState: (currentSnapshot: any) => canUpdateStateForAsyncSnapshot(currentSnapshot),
        isSubmitAttemptActive: (_submitAttemptId: any, currentSnapshot: any) => (
          inst._activeSubmitAttemptSeq ===
          (currentSnapshot as { submitAttemptId?: unknown } | null | undefined)?.submitAttemptId
        ),
        finishSubmitAttempt: (submitAttemptId: number) => finishSubmitAttempt(submitAttemptId),
        setSubmitStaleState: (statePatch: SurveyQuestionsSubmitStaleStatePatch) => setState(statePatch),
      },
    });
  };

const encryptAndUpload = async () => {
    let submitContext: any = null;
    try {
      if (!propsRef.current.loginComplete) {
        inst._submitGuard = false;
        propsRef.current.toggleLoginModal(true);
        return;
      }

      const answeredCount: any = getAnsweredQuestionsCount();
      if (answeredCount === 0) {
        inst._submitGuard = false;
        setState(buildSubmissionErrorState('No responses to submit.'));
        if (inst._emptySubmitTimer) {
          clearTimeout(inst._emptySubmitTimer);
        }
        inst._emptySubmitTimer = setTimeout(() => {
          setState(buildSubmissionErrorState(''));
          inst._emptySubmitTimer = null;
        }, 2000);
        return;
      }

      if (maybeBlockSubmitUntilQuestionPoolComplete()) {
        inst._submitGuard = false;
        return;
      }

      submitContext = buildSubmitContextSnapshot();
      const startResult: SurveyQuestionsSubmitStartControllerResult = runSurveyQuestionsSubmitStartController({
        ports: {
          startSubmitAttempt: () => startSubmitAttempt(),
          setSubmitStartState: (statePatch: SurveySubmitStartStatePatch) => setState(statePatch),
        },
      });
      submitContext.submitAttemptId = startResult.submitAttemptId;

      const providerKind: any = (cryptoUtils as any).getProviderKind(submitContext.provider);

      // Compute changed set once (used for encrypt + submit)
      const surveyIndex: any = submitContext.surveyIndex;
      const { changedQids }: any = getChangedQidsAndFields(surveyIndex);

      // Local state tracker to ensure baseline syncs with encrypted data even if React is slow
      let activeSlice: any = stateRef.current.surveysResponseState?.[surveyIndex] || { answers: {}, additionalComments: {}, importance: {}, conviction: {} };

      // Only encrypt when there are changed encrypted fields
      const pendingStats: SurveyQuestionsSubmitPendingStats = resolveSurveyQuestionsSubmitPendingStats({
        getPendingEditStats: typeof getPendingEditStats === 'function'
          ? () => getPendingEditStats()
          : undefined,
        fallbackTotal: stateRef.current.modifiedCount || 0,
        fallbackEncrypted: stateRef.current.hasEncryptedChanges ? 1 : 0,
      });
      const shouldEncrypt = Number(pendingStats.encrypted || 0) > 0 && changedQids.size > 0;

      if (shouldEncrypt) {
        const {
          groups: workGroups,
          missingRecipients,
        }: any = buildFieldEncryptionWorkGroups(activeSlice, changedQids);
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
            (Array.isArray(stateRef.current.questionPool) && stateRef.current.questionPool.length > 0)
              ? stateRef.current.questionPool
              : (Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : []);
          const encState: any = await encryptFieldWorkGroups({
            workGroups,
            baseOpts: {
              providerKind,
              provider: submitContext.provider,
              account: submitContext.account,
              chainId: submitContext.chainId,
              surveyId,
              questionPool: poolForCommit,
              hasher: stateRef.current.hasher,
            },
          });
          if (!isSubmitContextCurrent(submitContext)) {
            handleStaleSubmitContext(submitContext);
            return;
          }

          // Merge back (overrides hash with salted Keccak; carries envelope v1 + recipients)
          const newArr: any = [...stateRef.current.surveysResponseState];
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
          setState(buildSurveysResponseStatePatch(newArr));

          // Verify against the freshly merged slice instead of immediately rereading
          // `stateRef.current`, which can still hold the pre-encryption draft until React
          // flushes the async class-state update.
          await verifyEncryption(changedQids, base);
        }
      }

      setState(buildCurrentStepState(2));

      // Await the receipt to ensure transaction is confirmed before optimistic update
      const receipt: any = await submitSurveyResponse(activeSlice, changedQids, submitContext);
      if (!isSubmitContextCurrent(submitContext)) {
        handleStaleSubmitContext(submitContext);
        return;
      }
      surveyLog.log("Submission receipt received", receipt?.blockNumber || 'unknown block');

      // Success path

      // 1. STOP any pending draft saves immediately
      if (inst._persistTimer) {
        clearTimeout(inst._persistTimer);
        inst._persistTimer = null;
      }

      // 2. Clear drafts for changed QIDs
      surveyLog.log("Clearing drafts for QIDs:", Array.from(changedQids));
      try {
        Array.from(changedQids).forEach((qid: any) => clearDraftFor && clearDraftFor(String(qid)));
      } catch (_: any) {
        if (propsRef.current.singleQuestionMode && propsRef.current.questionID) {
          clearDraftFor(propsRef.current.questionID.toLowerCase());
        } else {
          clearDraft();
        }
      }

      // 3. Compute responder URL for post-submit UI
      const submittedCacheSlug: any = normalizeSessionSlugValue(
        receipt?.__ceSubmissionGroupKey != null
          ? receipt.__ceSubmissionGroupKey
          : submitContext.effectiveDraftSlug
      );
      const responseUrl = resolveSurveyQuestionsSubmittedResponseUrl({
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
      const finalSlice: any = deepClone(activeSlice);
      const nextBaseline: any = deepClone(finalSlice);

      // Construct the explicit new state array to prevent any diff artifacts
      const nextSurveysResponseState: any = [...stateRef.current.surveysResponseState];
      nextSurveysResponseState[surveyIndex] = finalSlice;

      // Regression guard: the encrypted merge above is a class setState, so
      // build optimistic JSON from the known final slice instead of stateRef.current.
      const optimisticUserAnswers: any = prepareJsonAndHash(surveyIndex, undefined, finalSlice);

      // Check encryption status from the new baseline
      const hasEncrypted = Object.values(nextBaseline.answers || {}).some((a: any) => !!a.encrypted) ||
                           Object.values(nextBaseline.additionalComments || {}).some((a: any) => !!a.encrypted);
      invalidateDiffCaches();
      inst._userAnswersSliceCache = { source: null, value: null };

      runSurveyQuestionsSubmitSuccessController({
        editBaseline: nextBaseline,
        hasEncrypted,
        responseUrl,
        submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
        submitAttemptId: submitContext.submitAttemptId,
        surveysResponseState: nextSurveysResponseState,
        userAnswers: optimisticUserAnswers,
        ports: {
          clearSubmitGuard: () => {
            inst._submitGuard = false;
          },
          finishSubmitAttempt: (submitAttemptId: number) => finishSubmitAttempt(submitAttemptId),
          setSubmitSuccessState: (
            statePatch: SurveySubmitSuccessStatePatch,
            afterStateApplied?: () => void
          ) => setState(statePatch, afterStateApplied),
        },
        afterStateApplied: async () => {
          try {
            if (!isSubmitContextCurrent(submitContext)) return;
            const cacheWriteResult: any = await writeSubmittedResponsesToLocalCaches({
              receipt,
              questionResponses: receipt?.__ceQuestionResponses,
              surveyResponse: receipt?.__ceSurveyResponse,
              surveyId: receipt?.__ceSurveyId,
              submissionSlug: submittedCacheSlug,
            }, submitContext).catch((error: any) => {
              surveyLog.warn('[SurveyQuestions] Local submit cache write-through failed:', error);
              return { questionCacheWritten: false, surveyCacheWritten: false };
            });
            if (!isSubmitContextCurrent(submitContext)) return;

            if (
              !cacheWriteResult?.questionCacheWritten &&
              typeof propsRef.current.refreshQuestionResponses === 'function'
            ) {
              const ids: any = Array.from(changedQids).map((id: any) => normalizeQuestionIdKey(id)).filter(Boolean);
              if (ids.length > 0 && isSubmitContextCurrent(submitContext)) {
                await propsRef.current.refreshQuestionResponses(ids, {
                  slug: submittedCacheSlug,
                  responder: submitContext.account || '',
                });
              }
            }
            if (
              !cacheWriteResult?.surveyCacheWritten &&
              !submitContext.singleQuestionMode &&
              typeof propsRef.current.refreshSurveyResponsesByID === 'function' &&
              submitContext.surveyId
            ) {
              if (isSubmitContextCurrent(submitContext)) {
                await propsRef.current.refreshSurveyResponsesByID(submitContext.surveyId);
              }
            }
          } catch (e: any) { surveyLog.warn('SurveyTool: callback', e); }
        },
      });
    } catch (error: any) {
      surveyLog.error('Failed to submit survey:', error);
      if (submitContext && !isSubmitContextCurrent(submitContext)) {
        handleStaleSubmitContext(submitContext);
        return;
      }
      runSurveyQuestionsSubmitFailureController({
        error,
        submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
        submitAttemptId: submitContext?.submitAttemptId,
        ports: {
          clearSubmitGuard: () => {
            inst._submitGuard = false;
          },
          finishSubmitAttempt: (submitAttemptId: number) => finishSubmitAttempt(submitAttemptId),
          setSubmitFailureState: (statePatch: SurveySubmitFailureStatePatch) => setState(statePatch),
        },
      });
    }
  };

const computePendingEditStatsAtIndex = (idx: any) => {
    const currentSlice: any =
      (stateRef.current.surveysResponseState && stateRef.current.surveysResponseState[idx]) ||
      { answers: {}, importance: {}, conviction: {}, additionalComments: {} };
    const { result, newCache }: any = computePendingEditStats(
      {
        idx,
        currentSlice,
        userAnswers: stateRef.current.userAnswers,
        existingCache: inst._pendingEditStatsCache,
        diffCacheRef: inst._changedQidsAndFieldsCache,
        questionPool: stateRef.current.questionPool,
        pileQuestions: stateRef.current.pileQuestions,
        questionId: propsRef.current.questionID,
      },
      {
        getChangedQidsAndFields: (i: any) => getChangedQidsAndFields(i),
        isQuestionLockedForResponse: (qid: any) => isQuestionLockedForResponse(qid),
        buildRatingEnvelopeQidSetFromUserAnswers,
      },
    );
    if (newCache !== inst._pendingEditStatsCache) {
      newCache.diffCacheRef = inst._changedQidsAndFieldsCache;
      inst._pendingEditStatsCache = newCache;
    }
    return result;
  };

const getPendingEditStats = (surveyIndexParam?: any) => {
    const runtimeStrategy: any = getRuntimeStrategy();
    if (typeof runtimeStrategy?.getPendingEditStats === 'function') {
      return runtimeStrategy.getPendingEditStats(engine, surveyIndexParam);
    }
    return computePendingEditStatsAtIndex(getActiveSurveyIndex(surveyIndexParam));
  };

const handleExitEditing = () => {
    executeSurveyExitEditing({
      props: propsRef.current,
      state: stateRef.current,
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      buildSliceFromLocalCache: buildSliceFromLocalCache,
      getRenderedQuestionIds: getCurrentRenderedQuestionIds,
      buildEmptyResponseFieldState: buildEmptyResponseFieldState,
      cloneValue: deepClone,
      setState: setState.bind(engine),
      recalculateEditStats: recalculateEditStats,
      persistDraftSafely: persistDraftSafely,
      updateJsonPreview: updateJsonPreview,
      clearDraft: clearDraft,
      updateSubmittedSinceLastEdit,
      onFailure: (error: any) => {
        surveyLog.warn('[SurveyQuestions] handleExitEditing failed:', error);
      },
    });
  };

const verifyEncryption = async (onlyTheseQids: any = null, sliceOverride: any = null) => {
    surveyLog.log("Verifying encryption...");
    const surveyIndex: any = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    const stateToCheck: any = sliceOverride || stateRef.current.surveysResponseState[surveyIndex];
    const { passed, failures }: any = verifyEncryptionIntegrity(stateToCheck, onlyTheseQids);

    failures.forEach((msg: any) => surveyLog.error(msg));

    if (!passed) {
      throw new Error("Encryption verification failed. Some data marked for encryption was not processed correctly.");
    }
    surveyLog.log("Encryption verification successful.");
    return true;
  };

const submitSurveyResponse = async (overrideState: any = null, overrideChangedQids: any = null, submitContext: any = null) => {
    const context: any = submitContext && typeof submitContext === 'object'
      ? submitContext
      : buildSubmitContextSnapshot();
    if (!context.loginComplete) {
      propsRef.current.toggleLoginModal(true);
      return;
    }

    // Use correct survey index for payload + diff gating
    const idx: any = context.surveyIndex;

    const data: any = prepareJsonAndHash(idx, undefined, overrideState);

    // Build full JSON snapshot first (unchanged behavior) then filter by changed set
    let changedSet: any;
    let changedMapForSubmit: any = {};
    try {
      const { changedQids, changedMap }: any = getChangedQidsAndFields(idx);
      changedMapForSubmit = changedMap || {};
      changedSet = overrideChangedQids ? overrideChangedQids : (changedQids || new Set());
    } catch (_: any) {
      changedMapForSubmit = {};
      changedSet = overrideChangedQids ? overrideChangedQids : new Set();
    }

    // If nothing actually changed, stop early (and throw so callers don't mark success)
    if (changedSet.size === 0) {
      inst._submitGuard = false;
      setState(buildSubmitPreparationErrorState());
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
      inst._submitGuard = false;
      setState(buildSubmitPreparationErrorState(
        e.message || 'No new or changed responses to submit.'
      ));
      throw e;
    }

    const { questionIds, questionResponses, surveyId, surveyResponse }: any = filtered;

    const submissionContext: any = resolveSubmissionGroupContext({
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
              : (stateRef.current.surveysResponseState && stateRef.current.surveysResponseState[idx]) ||
                { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
          userAnswersSource: stateRef.current.userAnswers,
          questionResponses,
          changedMapForSubmit,
          encryptionBaseOpts: {
            provider: context.provider,
            account: context.account,
            chainId: resolveSessionChainId(submissionGroupKey, null, context.props || propsRef.current) || context.chainId,
            surveyId:
              (context.singleQuestionMode || context.isStandalone)
                ? ethers.constants.HashZero
                : context.surveyId,
            kind: 'rating',
            hasher: stateRef.current.hasher,
          },
        },
        {
          isQuestionLockedForResponse: (qid: any) => isQuestionLockedForResponse(qid),
          resolveFieldEncryptionAudience: (field: any, qid: any, fk: any) => resolveFieldEncryptionAudience(field, qid, fk),
          getEffectiveRecipientsForQid: (qid: any) => getEffectiveRecipientsForQid(qid),
          getEffectiveRecipientsForField: ((opts: any) => getEffectiveRecipientsForField(opts)) as any,
          getDefaultResponseEncryptionAudienceForQid: (qid: any) => getDefaultResponseEncryptionAudienceForQid(qid),
          buildLitEncryptionOptionsForRecipients: (r: any) => buildLitEncryptionOptionsForRecipients(r),
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
    if (!isSubmitContextCurrent(context)) {
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
      deepClone: (obj: any) => deepClone(obj),
    });
  };

const writeSubmittedResponsesToLocalCaches = async (params: any = {}, submitContext: any = null) => {
    const context: any = submitContext && typeof submitContext === 'object' ? submitContext : null;
    const contextProps: any = context?.props || propsRef.current;
    return (writeSubmittedResponsesToLocalCachesHelper as any)(params, {
      account: context?.account || propsRef.current.account || '',
      effectiveDraftSlug: context?.effectiveDraftSlug || inst._getEffectiveDraftSlug() || '',
      singleQuestionMode: context ? !!context.singleQuestionMode : !!propsRef.current.singleQuestionMode,
      isStandalone: context ? !!context.isStandalone : !!propsRef.current.isStandalone,
      deepClone: (obj: any) => deepClone(obj),
      resolveSubmittedCacheWriteContext: (slug: any) => resolveSubmittedCacheWriteContext(contextProps, slug),
    });
  };

const renderQuestionAnswer = (question: any, response: any, index: any, isOwnResponse: any) => {
    if (!question || !response) {
      surveyLog.warn('renderQuestionAnswer: question or response is undefined');
      return null;
    }
    const promptReloading: any = isQuestionFieldBusy(question.id, 'prompt');
    return (
      <SingleQuestionResponse
        key={`fullQ-${question.id}-${index}`}
        question={question}
        response={response}
        isOwnResponse={isOwnResponse}
        canDecryptOtherResponses={stateRef.current.canDecryptOtherResponses}
        mode="fullscreen"
        sessionSlug={inst._getEffectiveDraftSlug() || resolveEffectiveSlug(propsRef.current)}
        activeSessionSlug={getActiveSessionSlugFromProps(propsRef.current)}
        onDecryptQuestion={handleDecryptQuestionAnswer}
        onReloadQuestionPrompt={handleReloadMaskedPrompt}
        promptReloading={promptReloading}
        showImportance={true}
        provider={propsRef.current.provider}
        questionResponsesNonce={propsRef.current.questionResponsesNonce}
        questionsCacheNonce={propsRef.current.questionsCacheNonce || stateRef.current.questionsCacheNonce}
        sbtCacheRevision={propsRef.current.sbtCacheRevision}
      />
    );
  };

const renderSurveyAnswers = (responses: any, isOwnResponse: any) => {
    return (
      <SurveyQuestionsSurveyAnswersView
        isOwnResponse={isOwnResponse}
        onWarning={(...args: any[]) => surveyLog.warn(...args)}
        questionPool={stateRef.current.questionPool}
        renderQuestionAnswer={renderQuestionAnswer}
        responses={responses}
      />
    );
  };

const getMemoizedMaskedQuestionVisibility = (
    questionPoolInput: unknown,
    singleQuestionMode: unknown
  ): SurveyQuestionsMaskedQuestionVisibilityState => {
    const fullQuestionPool = Array.isArray(questionPoolInput) ? questionPoolInput : EMPTY_QUESTION_POOL;
    const isSingleQuestionMode = !!singleQuestionMode;
    const modeKey = isSingleQuestionMode ? 'single' : 'multi';
    let memoByMode: any = null;
    try {
      memoByMode = inst._maskedQuestionVisibilityMemoByPool.get(fullQuestionPool) || null;
    } catch (_: any) {
      memoByMode = null;
    }
    if (memoByMode && memoByMode[modeKey]) {
      bumpSurveyPerfCounter('maskedVisibilityMemoHitCount');
      return memoByMode[modeKey];
    }
    bumpSurveyPerfCounter('maskedVisibilityMemoMissCount');
    bumpSurveyPerfCounter('maskedVisibilityPoolSizeOnMiss', fullQuestionPool.length);

    const value: SurveyQuestionsMaskedQuestionVisibilityState = buildSurveyQuestionsMaskedQuestionVisibility({
      isMaskedPromptText: isMaskedPromptText,
      questionPool: fullQuestionPool,
      singleQuestionMode: isSingleQuestionMode,
    });
    const { visibleQuestionPool, hiddenMaskedQuestionIds } = value;
    bumpSurveyPerfCounter('maskedVisibilityVisibleCountOnMiss', visibleQuestionPool.length);
    bumpSurveyPerfCounter('maskedVisibilityHiddenCountOnMiss', hiddenMaskedQuestionIds.length);

    const nextMemoByMode: any = memoByMode
      ? { ...memoByMode, [modeKey]: value }
      : { [modeKey]: value };
    try {
      inst._maskedQuestionVisibilityMemoByPool.set(fullQuestionPool, nextMemoByMode);
    } catch (e: any) { surveyLog.warn('SurveyTool: fallback', e); }
    return value;
  };

const renderDefaultSurveyQuestionsRoute = () => {
    bumpSurveyPerfCounter('renderCount');
    const maskedQuestionVisibility = getMemoizedMaskedQuestionVisibility(
      stateRef.current.questionPool,
      propsRef.current.singleQuestionMode
    );
    const renderReadiness: SurveyQuestionsRenderReadinessDescriptor = buildSurveyQuestionsRenderReadinessDescriptor({
      displayAnswerMode: stateRef.current.displayAnswerMode,
      fullQuestionPool: maskedQuestionVisibility.fullQuestionPool,
      hiddenMaskedQuestionIds: maskedQuestionVisibility.hiddenMaskedQuestionIds,
      isQuestionCacheReady: propsRef.current.isQuestionCacheReady,
      isStandalone: propsRef.current.isStandalone,
      parsedViewAddressAnswers: stateRef.current.parsedViewAddressAnswers,
      questionPool: stateRef.current.questionPool,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      surveyIndex: propsRef.current.surveyIndex,
      surveysResponseState: stateRef.current.surveysResponseState,
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
    const fullLoadingProgress: SurveyQuestionsFullLoadingProgressState = buildSurveyQuestionsFullLoadingProgressState({
      questionScanProgress: propsRef.current.questionScanProgress,
      progressSlug:
        (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
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

    const viewingAnswers = stateRef.current.displayAnswerMode;
    const { jsonPreview } = buildSurveyQuestionsJsonPreviewDisplayState({
      jsonPreview: stateRef.current.jsonPreview,
      questionPool: stateRef.current.questionPool,
      viewingAnswers,
    });

    const routeViewDisplayState: SurveyQuestionsRouteViewDisplayState = buildSurveyQuestionsRouteViewDisplayState({
      account: propsRef.current.account,
      isEditing: stateRef.current.isEditing,
      isStandalone: propsRef.current.isStandalone,
      questionPool: stateRef.current.questionPool,
      responderAddress: propsRef.current.responderAddress,
      shortenAddress: (address: string) => String(getShortenedAddress(address, false) || ''),
      singleQuestionMode: propsRef.current.singleQuestionMode,
      userHasResponse: stateRef.current.userHasResponse,
      viewAddress: propsRef.current.viewAddress,
      viewingAnswers,
    });
    const { isOwnResponse } = routeViewDisplayState;
    const isSingleQuestionView = !!routeViewDisplayState.isSingleQuestionView;

    // Submit button label block (centralized)
    const _pendingStats: SurveyQuestionsSubmitPendingStats = getPendingStatsSnapshot();
    const _suffix = _pendingStats.total === 1 ? 'Response' : 'Responses';

    const submitButtonText = isSingleQuestionView
      ? 'SUBMIT'
      : (propsRef.current.computeSubmitLabel || computeSubmitLabel)(engine, {
          suffix: _suffix,
          pendingStats: _pendingStats,
        });
    const submitReadiness: SurveyQuestionsSubmitReadinessDescriptor = buildSurveyQuestionsSubmitReadinessDescriptor({
      currentStep: stateRef.current.currentStep,
      isSubmitting: stateRef.current.isSubmitting,
      pendingStats: _pendingStats,
      resolveMaskedCurrentQuestionPayload: hasMaskedCurrentQuestionPayload,
      singleQuestionMode: propsRef.current.singleQuestionMode,
    });
    const submitFooterDisplayState: SurveyQuestionsSubmitFooterDisplayState = buildSurveyQuestionsSubmitFooterDisplayState({
      currentStep: stateRef.current.currentStep,
      hasEncryptedAnswers: submitReadiness.hasEncryptedAnswers,
      hasMaskedCurrentQuestionPayload: submitReadiness.hasMaskedCurrentQuestionPayload,
      isDirty: stateRef.current.isDirty,
      isEditing: stateRef.current.isEditing,
      isLoadingResponse: stateRef.current.isLoadingResponse,
      isSingleQuestionView,
      isSubmitting: stateRef.current.isSubmitting,
      pendingEditCount: submitReadiness.pendingEditCount,
      responseUrl: stateRef.current.responseUrl,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      startFresh: stateRef.current.startFresh,
      submissionComplete: stateRef.current.submissionComplete,
      submittedSinceLastEdit: stateRef.current.submittedSinceLastEdit,
      useHeaderSubmit: propsRef.current.useHeaderSubmit,
      userHasResponse: stateRef.current.userHasResponse,
    });

    const { jsonForDisplay } = buildSurveyQuestionsJsonForDisplayState({
      isOwnResponse,
      jsonPreview,
      noResponse: stateRef.current.noResponse,
      parsedViewAddressAnswers: stateRef.current.parsedViewAddressAnswers,
      responderAddress: propsRef.current.responderAddress,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      userAnswers: stateRef.current.userAnswers,
      viewAddress: propsRef.current.viewAddress,
      viewingAnswers,
    });

    const hideEmbeddedDebugUi = !!propsRef.current.hideEmbeddedDebugUi;
    const jsonPanelDisplayState: SurveyQuestionsJsonPanelDisplayState = buildSurveyQuestionsJsonPanelDisplayState({
      isSingleQuestionView,
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      showQuestionsJson: stateRef.current.showQuestionsJson,
      showResponseJson: stateRef.current.showResponseJson,
      showSurveyJson: stateRef.current.showSurveyJson,
      styleMap: styles,
    });
    const surveyJson = jsonPanelDisplayState.showSurveyJsonPanel ? getSurveyJson() : null;
    const questionsJson = jsonPanelDisplayState.showQuestionsJsonPanel ? getQuestionsJson() : null;
    const responseJson = jsonPanelDisplayState.showResponseJsonPanel
      ? (viewingAnswers ? jsonForDisplay : getResponseJson())
      : null;
    const canEditQuestions = submitFooterDisplayState.canEditQuestions;
    const authoringPanelDisplayState: SurveyQuestionsAuthoringPanelDisplayState = buildSurveyQuestionsAuthoringPanelDisplayState({
      canEditQuestions,
      hasCurrentSurveyResponseState: !!currentSurveyResponseState,
      hideEmbeddedDebugUi,
      questionPoolReady,
      singleQuestionMode: propsRef.current.singleQuestionMode,
    });
    const layoutDisplayState = buildSurveyQuestionsLayoutDisplayState({
      activeTagModalTag: stateRef.current.activeTagModalTag,
      isSingleQuestionView,
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      styleMap: styles,
      viewingAnswers,
    });
    const authoringRouteReadiness: SurveyQuestionsAuthoringRouteReadinessDescriptor = buildSurveyQuestionsAuthoringRouteReadinessDescriptor({
      canEditQuestions,
      gatedEmptyStateReady,
      hasCurrentSurveyResponseState: !!currentSurveyResponseState,
      questionPoolReady,
      visibleQuestionPool,
    });
    const renderedEditableQuestions: React.ReactNode = authoringRouteReadiness.shouldRenderEditableQuestions
      ? visibleQuestionPool.map((question: any, qIndex: any) =>
          renderQuestion(question, qIndex, currentSurveyResponseState)
        )
      : null;
    const lockedGateDetails = getMemoizedLockedQuestionGateDetails(hiddenMaskedQuestionIds);
    const lockedQuestionsBanner = renderLockedQuestionsPanel({
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
          topRef: topRef,
          displayAnswerMode: stateRef.current.displayAnswerMode,
          isDecrypting: stateRef.current.isDecrypting,
          isEditing: stateRef.current.isEditing,
          isSubmitting: stateRef.current.isSubmitting,
          onDecryptEdit: handleDecryptEdit,
          onExitEditing: handleExitEditing,
          onStartFresh: handleStartFresh,
          onToggleDisplayAnswerMode: toggleDisplayAnswerMode,
          responseUrl: stateRef.current.responseUrl,
          userHasResponse: stateRef.current.userHasResponse,
          userResponseEncrypted: stateRef.current.userResponseEncrypted,
        }}
        responseViewProps={{
          isLoadingResponse: stateRef.current.isLoadingResponse,
          noResponse: stateRef.current.noResponse,
          parsedViewAddressAnswers: stateRef.current.parsedViewAddressAnswers,
          questionPool: stateRef.current.questionPool,
          questionPoolReady,
          renderQuestionAnswer: renderQuestionAnswer,
          renderSurveyAnswers: renderSurveyAnswers,
          responderAddress: propsRef.current.responderAddress,
          responseLookupWarning: stateRef.current.responseLookupWarning,
          singleQuestionMode: propsRef.current.singleQuestionMode,
          userAnswers: stateRef.current.userAnswers,
          viewAddress: propsRef.current.viewAddress,
        }}
        authoringPanelProps={{
          displayState: authoringPanelDisplayState,
          lockedQuestionsBanner,
          onScrollToTop: handleScrollToTop,
          onShowJsonAtBottom: handleShowJsonAtBottom,
          renderedEditableQuestions,
        }}
        submittedResponseViewProps={{
          isOwnResponse,
          isVisible:
            !viewingAnswers &&
            stateRef.current.userHasResponse &&
            !stateRef.current.startFresh &&
            !stateRef.current.isEditing,
          questionPool: stateRef.current.questionPool,
          questionPoolReady,
          renderQuestionAnswer: renderQuestionAnswer,
          renderSurveyAnswers: renderSurveyAnswers,
          singleQuestionMode: propsRef.current.singleQuestionMode,
          userAnswers: stateRef.current.userAnswers,
        }}
        submitFooterProps={{
          isSingleQuestionView,
          isSubmitting: stateRef.current.isSubmitting,
          onPrimarySubmitClick: handlePrimarySubmitClick,
          onRevertPendingChanges: handleRevertPendingChanges,
          pendingEditCount: submitReadiness.pendingEditCount,
          responseUrl: stateRef.current.responseUrl,
          submitButtonText,
          submissionError: stateRef.current.submissionError,
        }}
        jsonControlsProps={buildSurveyQuestionsRouteJsonControlsProps({
          bottomRef: bottomRef,
          copiedQuestionsJson: stateRef.current.copiedQuestionsJson,
          copiedResponseJson: stateRef.current.copiedResponseJson,
          copiedSurveyJson: stateRef.current.copiedSurveyJson,
          copyJsonToClipboard: copyJsonToClipboard,
          hidden: hideEmbeddedDebugUi,
          jsonPanelDisplayState,
          onToggleQuestionsJson: toggleShowQuestionsJson,
          onToggleResponseJson: toggleShowResponseJson,
          onToggleSurveyJson: toggleShowSurveyJson,
          questionsJson,
          renderJsonTree: jsonTreeDisplay,
          responseJson,
          surveyJson,
        })}
        tagModalProps={{
          onClose: closeQuestionTagModal,
        }}
      />
    );
  };

async function runComponentDidUpdate(prevProps: SurveyQuestionsProps, prevState: SurveyQuestionsState): Promise<unknown> {
    const runtimeStrategy = getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentDidUpdate === 'function') {
      return runtimeStrategy.componentDidUpdate(engine, prevProps, prevState);
    }
    return runDefaultComponentDidUpdate(prevProps, prevState);
  }

function runComponentDidMount(): unknown {
    const runtimeStrategy = getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentDidMount === 'function') {
      return runtimeStrategy.componentDidMount(engine);
    }
    return runDefaultComponentDidMount();
  }

function runComponentWillUnmount(): unknown {
    const runtimeStrategy = getRuntimeStrategy();
    if (typeof runtimeStrategy?.componentWillUnmount === 'function') {
      return runtimeStrategy.componentWillUnmount(engine);
    }
    return runDefaultComponentWillUnmount();
  }

  Object.assign(engine, {
    getRuntimeStrategy,
    isPortoAutoSignReady,
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

  const lifecyclePrevRef = useRef<{ props: SurveyQuestionsProps; state: SurveyQuestionsState } | null>(null);
  useLayoutEffect(() => {
    const prev = lifecyclePrevRef.current;
    lifecyclePrevRef.current = { props, state };
    if (prev) {
      void runComponentDidUpdate(prev.props, prev.state);
    }
  });

  useLayoutEffect(() => {
    const callbacks = pendingSetStateCallbacksRef.current;
    if (callbacks.length === 0) return;
    pendingSetStateCallbacksRef.current = [];
    callbacks.forEach((callback) => callback());
  }, [state]);

  useLayoutEffect(() => {
    void runComponentDidMount();
    return () => {
      void runComponentWillUnmount();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


    const runtimeStrategy: any = getRuntimeStrategy();
    if (typeof runtimeStrategy?.render === 'function') {
      return runtimeStrategy.render(engine);
    }
    return renderDefaultSurveyQuestionsRoute();

};

// Preserve direct QuestionsDashboard/SurveySelector consumers without reviving the import cycle.
(SurveySelector as any).SurveyQuestionsComponent = SurveyQuestions;
(QuestionsDashboard as any).SurveyQuestionsComponent = SurveyQuestions;


export default SurveyQuestions;
