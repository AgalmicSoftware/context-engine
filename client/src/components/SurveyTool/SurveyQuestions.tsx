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
import { writeSubmittedResponsesToLocalCaches as writeSubmittedResponsesToLocalCachesHelper } from './surveyToolPostSubmitCacheController';
import {
  ensureIdentifierHash,
  filterChangedResponsesForSubmit,
  normalizeSubmitReceipt,
  resolveSurveySubmitSessionTarget,
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
import {
  getAllSessionSlugs,
  getSessionConfigBySlug as getStrictSessionConfigBySlug,
  getSessionSlugByName,
} from '../../domains/sessions/sessionConfig.js';
import { surveyQuestionReadsPort } from '../../domains/surveys/surveyQuestionReadsPort.js';
import { surveyResponseSubmitPort } from '../../domains/surveys/surveyResponseSubmitPort.js';
import { sessionRegistryReadsPort } from '../../domains/sessions/registry/sessionRegistryReadPorts.js';
import * as passkeyWallet from '../../wallet/passkeyWallet.js';
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
import { checkSponsoredAccess } from '../../domains/sessions/sponsoredAccess.js';
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

import { surveyResponseStoragePort } from '../../domains/storage/surveyResponseStoragePort.js';
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
} from './surveyToolUtils';
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
  publishSurveyQuestionPoolIfCurrent,
  type SurveyQuestionsAuthoringPanelDisplayState,
  type SurveyQuestionsAuthoringRouteReadinessDescriptor,
  type SurveyQuestionsFullLoadingProgressState,
  type SurveyQuestionsJsonPanelDisplayState,
  type SurveyQuestionsLegacyValue,
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
import { createSurveyQuestionsRuntimeMethods } from './surveyQuestionsRuntimeMethods';

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
  const engine = inst as SurveyQuestionsLegacyValue;
  engine.props = propsRef.current;
  engine.state = stateRef.current;
  engine.setState = setState;
  engine.bottomRef = bottomRef;
  engine.topRef = topRef;

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
    if (patch.interviewProvenanceState) {
      const targetProvenance = (targetSlice.interviewProvenance || {}) as Record<string, unknown>;
      targetProvenance[questionId] = patch.interviewProvenanceState;
      targetSlice.interviewProvenance = targetProvenance;
    }
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
        areEnvelopesEquivalent: areEnvelopesEquivalent as SurveyQuestionsLegacyValue,
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
      const responseRecord = response && typeof response === 'object' ? (response as Record<string, unknown>) : {};
      return normalizeQuestionIdKey(responseRecord.questionID || responseRecord.questionId);
    },
  }: SurveyQuestionsResponseHydrationListArgs = {}) => {
    if (!targetSlice) return false;
    const list = Array.isArray(responses) ? responses : [responses];
    let changed = false;
    list.forEach((response: unknown) => {
      const qid = (questionIdResolver as SurveyQuestionsQuestionIdResolver)(response);
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
      (allowMaskedAnswerDraftEmpty ||
        targetAnswers?.[questionId]?.value === undefined ||
        (targetAnswers?.[questionId]?.value === '' && !targetAnswers?.[questionId]?.encryptedPortion))
    ) {
      targetAnswers[questionId] = {
        ...(targetAnswers[questionId] || {}),
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
      targetAdditional[questionId] = {
        ...(targetAdditional[questionId] || {}),
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
      !Object.prototype.hasOwnProperty.call(targetImportance || {}, questionId)
    ) {
      targetImportance[questionId] = Number(cachedImportance);
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
      !Object.prototype.hasOwnProperty.call(targetConviction || {}, questionId)
    ) {
      targetConviction[questionId] = Number(cachedConviction);
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
        const errorRecord = error && typeof error === 'object' ? (error as { message?: unknown }) : null;
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
    QUESTION_TAG_DROPDOWN_ROW_STYLE,
    QuestionCardLinks,
    QuestionDecryptControl,
    QuestionFilter,
    QuestionsDashboard,
    React,
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
    resolveSurveySubmitSessionTarget,
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

  const {
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
    resolveResponseGateConfigBySlug,
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
    loadQuestionFromCache,
    mergeSurveyResponseState,
    prefillSingleQuestionResponse,
    parseAnswerValue,
    handleStartFresh,
    resolveDecryptSurveyId,
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
    getQuestionRouteSessionSlug,
    getExplicitResponseGateSessionSlug,
    isResponseGateQuestionFlow,
    resolveResponseGateSessionSlug,
    getResponseGatePolicy,
    getQuestionLookupMap,
    getQuestionById,
    buildGateAudienceSbtItems,
    getQuestionEncryptionGates,
    normalizeFieldAudienceMode,
    getQuestionGateOptions,
    buildFallbackResponseGateOptions,
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
    fetchQuestionPool,
    fetchSurveyResponse,
    fetchSingleQuestionData,
    handleDecryptEdit,
  } = surveyQuestionsRuntimeMethods;

  async function runComponentDidUpdate(
    prevProps: SurveyQuestionsProps,
    prevState: SurveyQuestionsState,
  ): Promise<unknown> {
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

  const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
  if (typeof runtimeStrategy?.render === 'function') {
    return runtimeStrategy.render(engine);
  }
  return renderDefaultSurveyQuestionsRoute();
};

// Preserve direct QuestionsDashboard/SurveySelector consumers without reviving the import cycle.
(SurveySelector as SurveyQuestionsLegacyValue).SurveyQuestionsComponent = SurveyQuestions;
(QuestionsDashboard as SurveyQuestionsLegacyValue).SurveyQuestionsComponent = SurveyQuestions;

export default SurveyQuestions;
