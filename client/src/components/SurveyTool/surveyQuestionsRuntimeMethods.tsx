import type * as React from 'react';
import type {
  SurveyQuestionsAuthoringPanelDisplayState,
  SurveyQuestionsAuthoringRouteReadinessDescriptor,
  SurveyQuestionsFullLoadingProgressState,
  SurveyQuestionsJsonPanelDisplayState,
  SurveyQuestionsLegacyRecord,
  SurveyQuestionsLegacyValue,
  SurveyQuestionsMaskedQuestionVisibilityState,
  SurveyQuestionsProps,
  SurveyQuestionsPrimarySubmitPlan,
  SurveyQuestionsRenderReadinessDescriptor,
  SurveyQuestionsRouteViewDisplayState,
  SurveyQuestionsState,
  SurveyQuestionsSubmitFooterDisplayState,
  SurveyQuestionsSubmitReadinessDescriptor,
  SurveySubmitFailureStatePatch,
  SurveySubmitStartStatePatch,
  SurveySubmitSuccessStatePatch,
} from './surveyQuestionsTypes.js';
import type {
  SurveyQuestionsCacheQuestion,
  SurveyQuestionsPendingStatsInput,
  SurveyQuestionsRecord,
} from './surveyQuestionsInstanceFields';
import type {
  SurveyQuestionsSubmitPendingStats,
  SurveyQuestionsSubmitStaleStatePatch,
  SurveyQuestionsSubmitStartControllerResult,
} from './surveyQuestionsSubmitController';
import { createSurveyQuestionsDataRuntime } from './surveyQuestionsDataRuntime.js';
import { createSurveyQuestionsDraftPersistenceRuntime } from './surveyQuestionsDraftPersistenceRuntime.js';
import { createSurveyQuestionsDecryptRuntime } from './surveyQuestionsDecryptRuntime.js';
import { createSurveyQuestionsEditDiffRuntime } from './surveyQuestionsEditDiffRuntime.js';
import { createSurveyQuestionsGateAudienceRuntime } from './surveyQuestionsGateAudienceRuntime.js';
import { createSurveyQuestionsJsonRuntime } from './surveyQuestionsJsonRuntime.js';
import { createSurveyQuestionsLockAudienceRuntime } from './surveyQuestionsLockAudienceRuntime.js';
import { createSurveyQuestionsLockedGateRuntime } from './surveyQuestionsLockedGateRuntime.js';
import { createSurveyQuestionsProgressRuntime } from './surveyQuestionsProgressRuntime.js';
import { createSurveyQuestionsPromptMetadataRuntime } from './surveyQuestionsPromptMetadataRuntime.js';
import { createSurveyQuestionsQuestionDisplayRuntime } from './surveyQuestionsQuestionDisplayRuntime.js';
import { createSurveyQuestionsResponseEditingRuntime } from './surveyQuestionsResponseEditingRuntime.js';
import { createSurveyQuestionsResponseGatePolicyRuntime } from './surveyQuestionsResponseGatePolicyRuntime.js';
import { createSurveyQuestionsResponseStateRuntime } from './surveyQuestionsResponseStateRuntime.js';
import { createSurveyQuestionsRenderRuntime } from './surveyQuestionsRenderRuntime.js';
import { createSurveyQuestionsRenderedHydrationRuntime } from './surveyQuestionsRenderedHydrationRuntime.js';
import { createSurveyQuestionsRouteRuntime } from './surveyQuestionsRouteRuntime.js';
import { createSurveyQuestionsSubmitRuntime } from './surveyQuestionsSubmitRuntime.js';
import { createSurveyQuestionsRuntimeStateRuntime } from './surveyQuestionsRuntimeStateRuntime.js';

export type SurveyQuestionsRuntimeMethods = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsRuntimeMethods = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsRuntimeMethods => {
  const {
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
  } = context;

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
  } = createSurveyQuestionsDecryptRuntime({
    ...context,
    buildSliceFromUserAnswers: (
      userAnswers: SurveyQuestionsLegacyValue,
      prevSlice: SurveyQuestionsLegacyValue = null,
    ) => buildSliceFromUserAnswers(userAnswers, prevSlice),
    getLatestQuestionResponse: (
      responder: SurveyQuestionsLegacyValue,
      questionId: SurveyQuestionsLegacyValue,
      networkID: SurveyQuestionsLegacyValue,
      questionsCache: SurveyQuestionsLegacyValue,
    ) => getLatestQuestionResponse(responder, questionId, networkID, questionsCache),
    getSurveyResponse: (responderAddress: SurveyQuestionsLegacyValue, surveyID: SurveyQuestionsLegacyValue) =>
      getSurveyResponse(responderAddress, surveyID),
    getViewedResponseOverrideForQuestion: (questionId: SurveyQuestionsLegacyValue) =>
      getViewedResponseOverrideForQuestion(questionId),
    maybeAutoDecryptVisibleFields: () => maybeAutoDecryptVisibleFields(),
    resolveDecryptSurveyId: (
      baselineForDecrypt: SurveyQuestionsLegacyValue,
      questionId: SurveyQuestionsLegacyValue = null,
    ) => resolveDecryptSurveyId(baselineForDecrypt, questionId),
  });

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

  const isResponseJsonPreviewVisible = (stateIn: SurveyQuestionsLegacyValue = stateRef.current) =>
    !!(stateIn && stateIn.showResponseJson);

  const scheduleJsonPreviewUpdate = (
    delayMs: SurveyQuestionsLegacyValue = 120,
    force: SurveyQuestionsLegacyValue = false,
  ) => {
    if (!force && !isResponseJsonPreviewVisible()) return;
    if (inst._jsonPreviewTimer) clearTimeout(inst._jsonPreviewTimer);
    inst._jsonPreviewTimer = setTimeout(
      () => {
        inst._jsonPreviewTimer = null;
        updateJsonPreview(force);
      },
      Math.max(0, Number(delayMs) || 0),
    );
  };

  const resolveResponseGateConfigBySlug = (slugIn: SurveyQuestionsLegacyValue) => {
    const slug: SurveyQuestionsLegacyValue = String(slugIn || '')
      .trim()
      .toLowerCase();
    return sessionRegistryReadsPort.getSessionConfig(slug) || getStrictSessionConfigBySlug(slug);
  };

  const resolveEffectiveResponseGateConfig = (
    slugIn: SurveyQuestionsLegacyValue = '',
    propsSnapshot: SurveyQuestionsLegacyValue = propsRef.current,
  ) => {
    const slug: SurveyQuestionsLegacyValue = String(slugIn || '')
      .trim()
      .toLowerCase();
    const resolved: SurveyQuestionsLegacyValue = resolveSurveyToolResponseGateSessionContext({
      sessionSlug: slug,
      sessionConfig:
        propsSnapshot?.sessionConfig && typeof propsSnapshot.sessionConfig === 'object'
          ? propsSnapshot.sessionConfig
          : null,
      resolveBySlug: resolveResponseGateConfigBySlug,
    });
    return resolved.effectiveSessionConfig || {};
  };

  const resolveSessionChainId = (
    slugIn: SurveyQuestionsLegacyValue = '',
    cfgIn: SurveyQuestionsLegacyValue = null,
    propsSnapshot: SurveyQuestionsLegacyValue = propsRef.current,
  ) => {
    const slug: SurveyQuestionsLegacyValue = String(
      slugIn ||
        (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : resolveEffectiveSlug(propsSnapshot)) ||
        '',
    )
      .trim()
      .toLowerCase();
    const cfg: SurveyQuestionsLegacyValue =
      cfgIn && typeof cfgIn === 'object' ? cfgIn : resolveEffectiveResponseGateConfig(slug, propsSnapshot);
    return (
      Number(
        cfg?.networkChainId ||
          cfg?.contracts?.surveys?.chainId ||
          cfg?.contracts?.sbtFactory?.chainId ||
          cfg?.__registry?.chainId ||
          cfg?.__registry?.registryChainId ||
          propsSnapshot?.networkChainId ||
          propsSnapshot?.network?.id ||
          propsSnapshot?.network?.chainId ||
          0,
      ) || null
    );
  };

  const {
    buildResponseGateConfigSignature,
    buildResponseGatePolicyCacheKey,
    getExplicitResponseGateSessionSlug,
    getQuestionRouteSessionSlug,
    getResponseGatePolicy,
    isResponseGateQuestionFlow,
    resolveResponseGateSessionSlug,
  } = createSurveyQuestionsResponseGatePolicyRuntime({
    ...context,
    resolveEffectiveResponseGateConfig,
    resolveEffectiveSlug,
    resolveSessionChainId,
    resolveSlugForIds,
  });

  const {
    buildEmptyResponseFieldState,
    buildFallbackResponseGateOptions,
    buildGateAudienceSbtItems,
    buildInheritedAdditionalFieldState,
    buildRecipientsFromGates,
    getDefaultResponseEncryptionAudience,
    getDefaultResponseEncryptionAudienceForQid,
    getEffectiveRecipientsForField,
    getEffectiveRecipientsForQid,
    getQuestionById,
    getQuestionEncryptionGates,
    getQuestionGateOptions,
    getQuestionLookupMap,
    getResponseGateOptionById,
    getResponseGateOptions,
    hasDefaultResponseGateRecipients,
    isQuestionLockedForResponse,
    normalizeFieldAudienceMode,
    normalizeGateLabelText,
    normalizeResponseEncryptionAudience,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveGatedPromptGateNames,
  } = createSurveyQuestionsGateAudienceRuntime({
    ...context,
    getResponseGatePolicy,
    isResponseGateQuestionFlow,
    resolveConfiguredGateLabel: (opts: SurveyQuestionsLegacyValue = {}) => resolveConfiguredGateLabel(opts),
    resolveEffectiveResponseGateConfig,
    resolveEffectiveSlug,
    resolveGateDisplayLabel: (gate: SurveyQuestionsLegacyValue = {}, fallbackSbt: SurveyQuestionsLegacyValue = '') =>
      resolveGateDisplayLabel(gate, fallbackSbt),
    resolveLockAudienceSessionName: () => resolveLockAudienceSessionName(),
    resolveResponseGateSessionSlug,
    resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue, preferredSlug: SurveyQuestionsLegacyValue = '') =>
      resolveSbtGateLabel(address, preferredSlug),
    resolveSessionChainId,
  });

  const {
    applyAdditionalEncryptionAudience,
    applyAnswerEncryptionAudience,
    applyLockAudienceSelection,
    getLockAudienceDisplayState,
    getLockAudienceMenuStateKey,
    handleLockAudienceButtonClick,
    isLockAudienceMenuOpen,
    renderAnswerLockControl,
    toggleLockAudienceGateDetails,
    toggleLockAudienceMenu,
    toggleQuestionFieldEncryptionEnabled,
  } = createSurveyQuestionsLockAudienceRuntime({
    ...context,
    buildEmptyResponseFieldState,
    buildInheritedAdditionalFieldState,
    invalidateDiffCaches: () => invalidateDiffCaches(),
    isQuestionLockedForResponse,
    normalizeFieldAudienceMode,
    normalizeGateLabelText,
    normalizeResponseEncryptionAudience,
    persistDraftSafely: () => persistDraftSafely(),
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveQuestionGateOption: (questionId: SurveyQuestionsLegacyValue = null) => resolveQuestionGateOption(questionId),
    scheduleJsonPreviewUpdate: () => scheduleJsonPreviewUpdate(),
    toggleAdditionalCommentsEncryption: (
      surveyIndex: SurveyQuestionsLegacyValue,
      questionId: SurveyQuestionsLegacyValue,
      nextEncrypted: SurveyQuestionsLegacyValue,
    ) => toggleAdditionalCommentsEncryption(surveyIndex, questionId, nextEncrypted),
    toggleAnswerEncryption: (
      surveyIndex: SurveyQuestionsLegacyValue,
      questionId: SurveyQuestionsLegacyValue,
      nextEncrypted: SurveyQuestionsLegacyValue,
    ) => toggleAnswerEncryption(surveyIndex, questionId, nextEncrypted),
  });

  const {
    copyJsonToClipboard,
    getCommentsOpen,
    getQuestionsJson,
    getResponseJson,
    getSurveyJson,
    getSurveyMetadataForJson,
    getSurveyResponse,
    handlePrimarySubmitClick,
    jsonTreeDisplay,
    prepareJsonAndHash,
    toggleComments,
    toggleShowQuestionsJson,
    toggleShowResponseJson,
    toggleShowSurveyJson,
    updateJsonPreview,
  } = createSurveyQuestionsJsonRuntime({
    ...context,
    encryptAndUpload: () => encryptAndUpload(),
    getPendingEditStats: () => getPendingEditStats(),
    getQuestionEncryptionGates,
    isResponseJsonPreviewVisible,
    normalizeFieldAudienceMode,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
  });

  const {
    handleAdditional,
    handleAnswer,
    handleConviction,
    handleImportance,
    handleScrollToTop,
    handleShowJsonAtBottom,
    toggleAdditionalCommentsEncryption,
    toggleAnswerEncryption,
    toggleDisplayAnswerMode,
  } = createSurveyQuestionsResponseEditingRuntime({
    ...context,
    buildEmptyResponseFieldState,
    buildInheritedAdditionalFieldState,
    fetchSingleQuestionData: () => fetchSingleQuestionData(),
    fetchSurveyResponse: () => fetchSurveyResponse(),
    getEffectiveRecipientsForQid,
    getQuestionById,
    invalidateDiffCaches: () => invalidateDiffCaches(),
    isQuestionLockedForResponse,
    normalizeFieldAudienceMode,
    normalizeResponseEncryptionAudience,
    persistDraftSafely: (delayMs?: SurveyQuestionsLegacyValue) => persistDraftSafely(delayMs),
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    scheduleJsonPreviewUpdate: () => scheduleJsonPreviewUpdate(),
    updateJsonPreview: () => updateJsonPreview(),
    valuesEqual: (a: SurveyQuestionsLegacyValue, b: SurveyQuestionsLegacyValue) => valuesEqual(a, b),
  });

  const {
    clearDraft,
    clearDraftFor,
    getDraftKey,
    loadDraft,
    migratePersistedDraftForActiveAccount,
    persistDraft,
    persistDraftSafely,
  } = createSurveyQuestionsDraftPersistenceRuntime({
    ...context,
    getHydrationQuestionIds: () => getHydrationQuestionIds(),
    normalizeFieldAudienceMode,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
  });

  const {
    buildLocalCacheHydrationSignature,
    ensurePriorResponsesForRenderedIds,
    getCurrentRenderedQuestionIds,
    getHydrationQuestionIds,
    getMissingRenderedResponseIdsForAccount,
    getRenderedQuestionIdsForResponseHydration,
    rehydrateDraftForRenderedIds,
    resolveQuestionSlugMapForIds,
    resolveSubmissionGroupContext,
  } = createSurveyQuestionsRenderedHydrationRuntime({
    ...context,
    deepClone: (value: SurveyQuestionsLegacyValue) => deepClone(value),
    getPendingEditStats: () => getPendingEditStats?.() || null,
    loadDraft: () => loadDraft(),
    rehydrateLocalCacheAnswersForRenderedIds: () => rehydrateLocalCacheAnswersForRenderedIds(),
  });

  const {
    buildSliceFromLocalCache,
    buildSliceFromUserAnswers,
    computeModifiedQuestionsCount,
    deepClone,
    handleRevertPendingChanges,
    prefillSurveyResponses,
    rehydrateLocalCacheAnswersForRenderedIds,
    resetFormStateForAccountChange,
    resolveDiffBaselineSlice,
    valuesEqual,
  } = createSurveyQuestionsResponseStateRuntime({
    ...context,
    buildLocalCacheHydrationSignature,
    clearDraft,
    ensurePriorResponsesForRenderedIds,
    getCurrentRenderedQuestionIds,
    getEditTrackingQuestionIds: () => getEditTrackingQuestionIds(),
    getHydrationQuestionIds: () => getHydrationQuestionIds(),
    initializeSurveyResponseState: () => initializeSurveyResponseState(),
    loadDraft: () => loadDraft(),
    persistDraft: () => persistDraft(),
    recalculateEditStats: () => recalculateEditStats(),
  });

  const {
    _getDraftScope,
    _getEffectiveDraftSlug,
    applyQuestionPayloadToRenderedPools,
    buildAutomaticQuestionMetadataFetchOptions,
    buildQuestionDecryptContext,
    cacheQuestionPayloadForSlug,
    closeQuestionTagModal,
    fetchQuestionPayloadWithDeterministicContext,
    getAudioInputWorkerProps,
    getQuestionFetchCandidateSlugs,
    handleQuestionTagSelect,
    handleReloadMaskedPrompt,
    hasMaskedCurrentQuestionPayload,
    isMaskedPromptText,
    reloadMaskedQuestionBatch,
    renderPromptWithManualDecrypt,
    renderQuestionTagControl,
    renderQuestionTagDropdown,
    renderQuestionTagDropdownRow,
  } = createSurveyQuestionsPromptMetadataRuntime({
    ...context,
    fetchSingleQuestionData: (opts: SurveyQuestionsLegacyValue = {}) => fetchSingleQuestionData(opts),
    getQuestionPayloadDisplayState: (question: SurveyQuestionsLegacyValue) => getQuestionPayloadDisplayState(question),
    isQuestionFieldBusy,
    resolveSessionChainId,
  });

  const {
    flushDraftPersistAfterSliderChange,
    getAnswerLockDisplayState,
    getConvictionValueForSlice,
    getFieldDecryptState,
    getGatedPromptNoticeState,
    getImportanceValueForSlice,
    getQuestionFieldDisplayState,
    getQuestionPayloadDisplayState,
    getQuestionRenderDisplayState,
    getQuestionResponseDisplayState,
    getSliderMode,
    handleConvictionImportanceChange,
    isQuestionPromptMasked,
    parseEncryptedEnvelope,
    renderFullQuestionAdditionalInput,
    renderFullQuestionCardIcons,
    renderFullQuestionCardShell,
    renderFullQuestionFooterIcons,
    renderFullQuestionGatedPromptCard,
    renderFullQuestionResponseInput,
    renderFullQuestionSliderSection,
    renderGatedPromptNotice,
    renderQuestionAdditionalLockControl,
    renderQuestionAnswerLockControl,
    renderQuestionFieldDecryptControl,
    renderQuestionMaskedPromptCard,
    setSliderMode,
  } = createSurveyQuestionsQuestionDisplayRuntime({
    ...context,
    buildEmptyResponseFieldState,
    getAudioInputWorkerProps,
    handleAdditional,
    handleAnswer,
    handleConviction,
    handleImportance,
    handleReloadMaskedPrompt,
    isQuestionFieldBusy,
    isMaskedPromptText,
    persistDraftSafely,
    renderAnswerLockControl,
    renderPromptWithManualDecrypt,
    renderQuestionTagDropdown,
    renderQuestionTagDropdownRow,
    toggleAdditionalCommentsEncryption,
    toggleAnswerEncryption,
  });

  const { areResponsesConsistent, getChangedQidsAndFields, getEditTrackingQuestionIds, getIndexedQuestionEntryKeys } =
    createSurveyQuestionsEditDiffRuntime({
      ...context,
      buildSliceFromUserAnswers,
      getActiveSurveyIndex: (surveyIndexParam?: number | null) => getActiveSurveyIndex(surveyIndexParam),
      getCurrentRenderedQuestionIds,
      getDefaultResponseEncryptionAudience,
      getDefaultResponseEncryptionAudienceForQid,
      hasMeaningfulFieldValue,
      normalizeFieldAudienceMode,
      normalizeResponseEncryptionAudience,
      resolveDiffBaselineSlice,
      resolveFieldEncryptionGateId,
      valuesEqual,
    });

  const {
    checkAndHandleStartFresh,
    getAnsweredQuestionsCount,
    getSurveyQuestionPoolLoadState,
    handleBookmarkToggle,
    initializeSurveyResponseState,
    loadBookmarks,
    maybeBlockSubmitUntilQuestionPoolComplete,
    recalculateEditStats,
    showTransientSubmitFeedback,
  } = createSurveyQuestionsProgressRuntime({
    ...context,
    buildEmptyResponseFieldState,
    computeModifiedQuestionsCount,
    fetchQuestionPool: () => fetchQuestionPool(),
    getCurrentRenderedQuestionIds,
    getPendingEditStats: () => getPendingEditStats(),
    handleStartFresh: () => handleStartFresh(),
    resolveDiffBaselineSlice,
  });

  const { renderQuestion, renderQuestionAnswer, renderSurveyAnswers } = createSurveyQuestionsRenderRuntime({
    ...context,
    getCommentsOpen,
    getQuestionRenderDisplayState,
    handleDecryptQuestionAnswer: (
      questionId: SurveyQuestionsLegacyValue,
      fieldToDecrypt?: SurveyQuestionsLegacyValue,
      responseOverride?: SurveyQuestionsLegacyValue,
    ) => handleDecryptQuestionAnswer(questionId, fieldToDecrypt, responseOverride),
    handleReloadMaskedPrompt,
    isQuestionFieldBusy,
    isQuestionPromptMasked,
    renderFullQuestionAdditionalInput,
    renderFullQuestionCardIcons,
    renderFullQuestionCardShell,
    renderFullQuestionFooterIcons,
    renderFullQuestionResponseInput,
    renderFullQuestionSliderSection,
    renderQuestionAdditionalLockControl,
    renderQuestionAnswerLockControl,
    renderQuestionFieldDecryptControl,
    renderQuestionMaskedPromptCard,
    toggleComments,
  });

  const {
    buildLockedQuestionGateDetails,
    buildSessionQuestionGateDetails,
    collectGateSbtAddressesForHydration,
    getLockedGateRequirementSentence,
    getLockedQuestionGateSourcePool,
    getMemoizedLockedQuestionGateDetails,
    hydrateGateSbtLabels,
    renderLockedQuestionsPanel,
    resolveConfiguredGateLabel,
    resolveGateDisplayLabel,
    resolveLockAudienceSessionName,
    resolveQuestionGateOption,
    resolveSbtGateLabel,
  } = createSurveyQuestionsLockedGateRuntime({
    ...context,
    clearGateSbtHydrationRetry: () => clearGateSbtHydrationRetry(),
    getQuestionEncryptionGates,
    getResponseGateOptions,
    getResponseGatePolicy,
    normalizeGateLabelText,
    reloadMaskedQuestionBatch,
    resolveEffectiveResponseGateConfig,
    resolveSessionChainId,
    resolveSlugForIds,
    scheduleGateSbtHydrationRetry: () => scheduleGateSbtHydrationRetry(),
  });

  const {
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
  } = createSurveyQuestionsRuntimeStateRuntime({
    ...context,
    clearAutoDecryptSweepScheduling: () => clearAutoDecryptSweepScheduling(),
    getResponseGatePolicy: () => getResponseGatePolicy(),
    isResponseGateQuestionFlow: () => isResponseGateQuestionFlow(),
    resolveEffectiveResponseGateConfig: (slug: SurveyQuestionsLegacyValue) => resolveEffectiveResponseGateConfig(slug),
    resolveResponseGateSessionSlug: () => resolveResponseGateSessionSlug(),
  });

  const runDefaultComponentDidMount = () => {
    // Force-disable auto-decrypt on wagmi/passkey while no signer session is ready.
    if (isAutoDecryptBlocked()) {
      resetBlockedAutoDecryptSweepInternals();
      setState(buildAutoDecryptDisabledState());
    }

    // Lazy load ZK-compatible Poseidon hasher (poseidon-lite)
    inst._isMounted = true;
    inst._hasMounted = true;
    const loadHasher: SurveyQuestionsLegacyValue = async () => {
      try {
        const { poseidon }: SurveyQuestionsLegacyValue = await import('poseidon-lite');
        if (typeof poseidon === 'function' && inst._isMounted) {
          setState(buildHasherState(poseidon));
          surveyLog.log('✅ ZK-Compatible Poseidon Hasher Loaded (poseidon-lite)');
        }
      } catch (e: any) {
        surveyLog.warn('⚠️ Failed to load Real Poseidon. Falling back to Keccak (Non-ZK).', e);
      }
    };
    loadHasher();

    loadBookmarks();
    hydrateGateSbtLabels();
    try {
      const slugSig: SurveyQuestionsLegacyValue = normalizeSessionSlugValue(
        inst._getEffectiveDraftSlug() || resolveEffectiveSlug(propsRef.current),
      );
      const acctSig: SurveyQuestionsLegacyValue = String(propsRef.current.account || '')
        .trim()
        .toLowerCase();
      inst._priorResponseHydrationContextSig = `${slugSig}|${acctSig}`;
      inst._priorResponseBackfillAttempted = new Set();
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    // Determine whether the connected wallet satisfies the response gate; used to show/hide decrypt buttons
    // when viewing another wallet's encrypted response.
    try {
      maybeRefreshCanDecryptOtherResponses();
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    if (propsRef.current.singleQuestionMode) {
      (async () => {
        await fetchSingleQuestionData();
        updateJsonPreview();
        // Quick local-cache rehydrate for non-encrypted prior answers (single Q)
        rehydrateLocalCacheAnswersForRenderedIds();

        if (propsRef.current.responderAddress) {
          setState(buildViewingResponseModeState(), async () => {
            if (
              propsRef.current.account &&
              propsRef.current.account.toLowerCase() === propsRef.current.responderAddress.toLowerCase()
            ) {
              if (stateRef.current.userHasResponse) {
                // UI will show decrypt/edit or start fresh buttons
              }
            }
          });
        } else {
          setState(buildDisplayAnswerModeState(propsRef.current.displayAnswerMode));
        }
      })();
    } else if (!propsRef.current.isStandalone) {
      // Survey mode (multiple questions)
      (async () => {
        await fetchQuestionPool();
        const initialStates: SurveyQuestionsLegacyValue = initializeSurveyResponseState();
        setState(
          buildInitialSurveyResponseState({
            surveysResponseState: initialStates,
            editBaseline: deepClone(
              initialStates[propsRef.current.surveyIndex || 0] || {
                answers: {},
                importance: {},
                conviction: {},
                additionalComments: {},
              },
            ),
          }),
          async () => {
            rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
            // Quick local-cache rehydrate for non-encrypted prior answers (survey)
            await rehydrateLocalCacheAnswersForRenderedIds(null, { responseHydrationOwned: true });

            // Defer prefill if caches/IDs not ready yet; avoid double-prefill
            if (
              propsRef.current.isQuestionCacheReady ||
              (Array.isArray(stateRef.current.questionPool) && stateRef.current.questionPool.length > 0)
            ) {
              await fetchSurveyResponse();
              checkAndHandleStartFresh();
            } else {
              setState(buildPrefillQueuedAfterCacheState(true));
            }
          },
        );
      })();
    } else {
      // Standalone mode (question pool passed as prop)
      const initialSlice: SurveyQuestionsLegacyValue = initializeSurveyResponseState();
      setState(
        buildInitialStandaloneResponseState({
          surveysResponseState: initialSlice,
          editBaseline: deepClone(
            initialSlice[0] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
          ),
          jsonPreview: prepareJsonAndHash(0),
        }),
        () => {
          rehydrateDraftForRenderedIds();
          // Quick local-cache rehydrate for non-encrypted prior answers (standalone list)
          rehydrateLocalCacheAnswersForRenderedIds();
        },
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
        buildQuestionIdScopeSignature(prevProps.questionPool) !==
          buildQuestionIdScopeSignature(propsRef.current.questionPool);
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
      ? (typeof getPendingEditStats === 'function' && getPendingEditStats()) || getPendingStatsSnapshot()
      : getPendingStatsSnapshot();
    emitPendingStats(pendingStats);
    if (diffInputsChanged && typeof recalculateEditStats === 'function') {
      recalculateEditStats(pendingStats);
    }

    try {
      const slugSig = normalizeSessionSlugValue(
        inst._getEffectiveDraftSlug() || resolveEffectiveSlug(propsRef.current),
      );
      const acctSig = String(propsRef.current.account || '')
        .trim()
        .toLowerCase();
      const nextSig = `${slugSig}|${acctSig}`;
      if (nextSig !== inst._priorResponseHydrationContextSig) {
        inst._priorResponseHydrationContextSig = nextSig;
        inst._priorResponseBackfillAttempted = new Set();
      }
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }

    // Force-disable auto-decrypt whenever provider/account changes to wagmi/passkey without a signer session.
    if (
      (prevProps.provider !== propsRef.current.provider || prevProps.account !== propsRef.current.account) &&
      isAutoDecryptBlocked()
    ) {
      resetBlockedAutoDecryptSweepInternals();
      if (
        stateRef.current.autoDecryptEnabled ||
        (stateRef.current.decryptingByKey && Object.keys(stateRef.current.decryptingByKey).length > 0)
      ) {
        setState(buildAutoDecryptDisabledState());
      }
    }

    // Keep the "can decrypt viewed responses" capability in sync with wallet/session/gate changes.
    try {
      maybeRefreshCanDecryptOtherResponses();
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
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
        waitingForViewedResponseBootstrap ||
        (!stateRef.current.displayAnswerMode &&
          !stateRef.current.parsedViewAddressAnswers &&
          (!Array.isArray(stateRef.current.questionPool) || stateRef.current.questionPool.length === 0));
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
        setState(
          buildResponseLoadingResetState(
            updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset'),
          ),
        );
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
          pendingBootstrapRetryAttempt > 0 ? { bootstrapRetryAttempt: pendingBootstrapRetryAttempt } : undefined,
        ); // merge-safe
      }

      if (propsRef.current.account !== prevProps.account) {
        // Clear live form state before fetching for new account.
        // We use a callback to ensure rehydration happens on the reset (empty) state,
        // followed by the fetch which merges on-chain data into the draft.
        resetFormStateForAccountChange(async () => {
          setState(
            buildResponseLoadingResetState(
              updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset'),
            ),
          );

          // 1. Apply Draft (Anon answers) onto Empty
          rehydrateDraftForRenderedIds({ responseHydrationOwned: true });

          // 2. Fetch Chain (Merges Chain into Draft)
          const pendingBootstrapRetryAttempt = propsRef.current.singleQuestionMode
            ? getPendingSingleQuestionBootstrapRetryAttempt(propsRef.current.questionID)
            : 0;
          await fetchSingleQuestionData(
            pendingBootstrapRetryAttempt > 0 ? { bootstrapRetryAttempt: pendingBootstrapRetryAttempt } : undefined,
          );

          const isViewingOwnResponse =
            propsRef.current.account &&
            propsRef.current.responderAddress &&
            propsRef.current.account.toLowerCase() === propsRef.current.responderAddress.toLowerCase();
          const isViewingNoSpecificResponder = propsRef.current.account && !propsRef.current.responderAddress;

          if (stateRef.current.userHasResponse && (isViewingOwnResponse || isViewingNoSpecificResponder)) {
            setState(buildEditingResponseModeState());
          }
        });
      }

      if (prevState.questionPool !== stateRef.current.questionPool) {
        setState(
          (prevStateInner: SurveyQuestionsLegacyValue) =>
            buildQuestionPoolResponseMergeState(prevStateInner, {
              mergeSurveyResponseState: mergeSurveyResponseState,
              questionPool: stateRef.current.questionPool || [],
              surveyIndex: 0,
            }),
          () => {
            updateJsonPreview();
            rehydrateDraftForRenderedIds();
          },
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
        setState(
          buildSurveyChangedResetState(updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset')),
        );
        await fetchQuestionPool();
        setState(buildSurveysResponseStatePatch(initializeSurveyResponseState()), async () => {
          await fetchSurveyResponse();
          checkAndHandleStartFresh();
        });
      } else if (cacheInvalidated) {
        // Don’t rebuild while user has pending edits; keeps “Submit (X)” stable
        const hasPendingQuestionPoolHydration = getSurveyQuestionPoolLoadState().isIncomplete;
        if (
          (stateRef.current.isDirty || (stateRef.current.modifiedCount || 0) > 0) &&
          !hasPendingQuestionPoolHydration
        ) {
          bumpSurveyPerfCounter('noopSkipCount');
          surveyLog.debug('baseline-guard: skipped rebuild');
          // do nothing
        } else {
          await fetchQuestionPool();
          setState(
            (prev: SurveyQuestionsLegacyValue) =>
              buildSurveyResponseMergeState(prev, {
                mergeSurveyResponseState: mergeSurveyResponseState,
                questionPool: stateRef.current.questionPool || [],
                surveyIndex: propsRef.current.surveyIndex,
              }),
            async () => {
              await fetchSurveyResponse();
              if (!stateRef.current.suppressPrefill) {
                rehydrateDraftForRenderedIds();
              }
            },
          );
        }
      }

      if (propsRef.current.account !== prevProps.account || propsRef.current.viewAddress !== prevProps.viewAddress) {
        // Clear live form state before reacting to new account/viewAddress
        resetFormStateForAccountChange(async () => {
          setState(
            buildSurveyAccountViewResetState({
              parsedViewAddressAnswers:
                propsRef.current.viewAddress !== prevProps.viewAddress
                  ? null
                  : stateRef.current.parsedViewAddressAnswers,
              noResponse: propsRef.current.viewAddress !== prevProps.viewAddress ? false : stateRef.current.noResponse,
              submittedSinceLastEdit: updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset'),
            }),
          );

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
          const isViewingNoSpecificSurvey = propsRef.current.account && !propsRef.current.viewAddress;

          if (stateRef.current.userHasResponse && (isViewingOwnSurveyResponse || isViewingNoSpecificSurvey)) {
            setState(buildEditingResponseModeState());
          }
        });
      }
    }

    // Standalone mode (QuestionsDashboard)
    else {
      if (prevProps.questionPool !== propsRef.current.questionPool) {
        setState(
          (prevStateInner: SurveyQuestionsLegacyValue) =>
            buildQuestionPoolResponseMergeState(prevStateInner, {
              includeQuestionPool: true,
              mergeSurveyResponseState: mergeSurveyResponseState,
              questionPool: propsRef.current.questionPool || [],
              surveyIndex: 0,
            }),
          () => {
            updateJsonPreview();
            rehydrateDraftForRenderedIds();
            rehydrateLocalCacheAnswersForRenderedIds();
          },
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
          setState(
            buildStandaloneAuthResetState(
              updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'reset'),
            ),
          );
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
      (prevState.surveysResponseState !== stateRef.current.surveysResponseState ||
        prevState.autoDecryptEnabled !== stateRef.current.autoDecryptEnabled ||
        prevState.questionPool !== stateRef.current.questionPool ||
        prevProps.account !== propsRef.current.account ||
        cacheJustBecameReady) &&
      !isAutoDecryptBlocked()
    ) {
      queueAutoDecryptVisibleSweep('state-change');
    }

    // Trigger sweep when auto-decrypt gets enabled
    if (!prevState.autoDecryptEnabled && stateRef.current.autoDecryptEnabled && !isAutoDecryptBlocked()) {
      queueAutoDecryptVisibleSweep('enabled');
    }

    // Trigger when the comments panel toggles (user reveals additional comments)
    if (
      stateRef.current.autoDecryptEnabled &&
      prevState.showComments !== stateRef.current.showComments &&
      !isAutoDecryptBlocked()
    ) {
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
    const hasPendingDraftChanges: SurveyQuestionsLegacyValue =
      !!inst._persistTimer ||
      !!(inst._draftDirtyQids && inst._draftDirtyQids.size > 0) ||
      !!(stateRef.current && (stateRef.current.isDirty || Number(stateRef.current.modifiedCount || 0) > 0));
    if (inst._persistTimer) {
      clearTimeout(inst._persistTimer);
      inst._persistTimer = null;
    }
    if (hasPendingDraftChanges) {
      try {
        persistDraft();
      } catch (e: any) {
        surveyLog.warn('SurveyTool: fallback', e);
      }
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

      const surveyIndex: SurveyQuestionsLegacyValue =
        propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex || 0;
      const slice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState?.[surveyIndex];
      if (!slice) {
        inst._autoDecryptVisibleSweepCache = null;
        return;
      }

      // Include both questionPool and pileQuestions
      const ids: SurveyQuestionsLegacyValue = getCurrentRenderedQuestionIds();
      if (!Array.isArray(ids) || ids.length === 0) {
        inst._autoDecryptVisibleSweepCache = null;
        return;
      }

      const accountLower: SurveyQuestionsLegacyValue = String(propsRef.current.account || '')
        .trim()
        .toLowerCase();
      const idsKey: SurveyQuestionsLegacyValue = buildRenderedIdsSignature(ids);
      const attempted: SurveyQuestionsLegacyValue = { ...(stateRef.current.autoDecryptAttempted || {}) };
      const inflight: SurveyQuestionsLegacyValue = { ...(stateRef.current.decryptingByKey || {}) };
      const maskedAttemptSignature: SurveyQuestionsLegacyValue = inst._autoDecryptMaskedAttemptSignature || {};
      const queuedSet: SurveyQuestionsLegacyValue = new Set(
        Array.isArray(inst._autoDecQueue)
          ? inst._autoDecQueue.map((it: SurveyQuestionsLegacyValue) => `${it.qid}:${it.field}`)
          : [],
      );
      let visibleSignature: SurveyQuestionsLegacyValue = `${idsKey}|${accountLower}|${stateRef.current.autoDecryptEnabled ? 1 : 0}`;
      const toQueue: SurveyQuestionsLegacyValue = [];

      ids.forEach((qidRaw: SurveyQuestionsLegacyValue) => {
        const qidSource: SurveyQuestionsLegacyValue = String(qidRaw || '').trim();
        const qid: SurveyQuestionsLegacyValue = qidSource.toLowerCase();
        if (!qid) return;
        const ans: SurveyQuestionsLegacyValue = slice.answers?.[qidSource] ?? slice.answers?.[qid];
        const add: SurveyQuestionsLegacyValue =
          slice.additionalComments?.[qidSource] ?? slice.additionalComments?.[qid];

        const kA: SurveyQuestionsLegacyValue = getQuestionFieldTaskKey(qid, 'answer');
        const kD: SurveyQuestionsLegacyValue = getQuestionFieldTaskKey(qid, 'additional');
        const answerSig: SurveyQuestionsLegacyValue = buildAutoDecryptMaskedFieldSignature(ans);
        const additionalSig: SurveyQuestionsLegacyValue = buildAutoDecryptMaskedFieldSignature(add);
        visibleSignature += `|${qid}|a:${answerSig}|d:${additionalSig}`;

        if (
          ans &&
          ans.value === '*' &&
          (ans.encryptedPortion || ans.encrypted) &&
          !attempted[kA] &&
          !queuedSet.has(kA) &&
          !inflight[kA] &&
          (!maskedAttemptSignature[kA] || maskedAttemptSignature[kA] !== answerSig)
        ) {
          toQueue.push({ qid, field: 'answer', maskedSig: answerSig });
        }
        if (
          add &&
          add.value === '*' &&
          (add.encryptedPortion || add.encrypted) &&
          !attempted[kD] &&
          !queuedSet.has(kD) &&
          !inflight[kD] &&
          (!maskedAttemptSignature[kD] || maskedAttemptSignature[kD] !== additionalSig)
        ) {
          toQueue.push({ qid, field: 'additional', maskedSig: additionalSig });
        }
      });

      const sweepCache: SurveyQuestionsLegacyValue = inst._autoDecryptVisibleSweepCache;
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
    const item: SurveyQuestionsLegacyValue = inst._autoDecQueue.shift();
    if (!item) return;

    inst._autoDecProcessing = true;
    const k: SurveyQuestionsLegacyValue = `${item.qid}:${item.field}`;
    const maskedSig: SurveyQuestionsLegacyValue = String(item?.maskedSig || '');
    try {
      const did: SurveyQuestionsLegacyValue = await handleDecryptQuestionAnswer(item.qid, item.field);
      if (did) {
        // Mark as attempted ONLY when we actually produced a decrypted value
        if (!stateRef.current.autoDecryptAttempted?.[k]) {
          setState((prev: SurveyQuestionsLegacyValue) => buildAutoDecryptAttemptedState(prev, k));
        }
        if (inst._autoDecryptMaskedAttemptSignature?.[k]) {
          const nextAttemptSig: SurveyQuestionsLegacyValue = { ...(inst._autoDecryptMaskedAttemptSignature || {}) };
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
        try {
          queueAutoDecryptVisibleSweep('post-item');
        } catch (e: any) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
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

  const toggleAutoDecrypt = () => {
    // Guard: auto-decrypt is disabled for wagmi/passkey providers unless auto-sign is ready.
    if (isAutoDecryptBlocked()) {
      resetBlockedAutoDecryptSweepInternals();
      setState(buildAutoDecryptDisabledState());
      return;
    }
    setState(buildAutoDecryptToggleState, () => {
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
    });
  };

  const {
    getLatestQuestionResponse,
    getLatestSurveyResponse,
    fetchQuestionPool,
    loadQuestionFromCache,
    mergeSurveyResponseState,
    fetchSurveyResponse,
    prefillSingleQuestionResponse,
    parseAnswerValue,
    handleStartFresh,
    fetchSingleQuestionData,
  } = createSurveyQuestionsDataRuntime({
    ...context,
    areResponsesConsistent,
    buildAutomaticQuestionMetadataFetchOptions,
    buildEmptyResponseFieldState,
    buildSliceFromUserAnswers,
    clearDraftFor,
    getCurrentRenderedQuestionIds,
    getQuestionFetchCandidateSlugs,
    getSurveyResponse,
    normalizeSingleQuestionViewedResponse,
    persistDraftSafely,
    prefillSurveyResponses,
    recalculateEditStats,
    rehydrateDraftForRenderedIds,
    rehydrateLocalCacheAnswersForRenderedIds,
    updateJsonPreview,
  });

  const resolveDecryptSurveyId = (
    baselineForDecrypt: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue = null,
  ) => {
    return (resolveDecryptSurveyIdHelper as SurveyQuestionsLegacyValue)(baselineForDecrypt, {
      propSurveyId: propsRef.current.surveyId || propsRef.current.surveyID,
      questionId,
      defaultSurveyId: ethers.constants.HashZero,
    });
  };

  async function handleDecryptEdit() {
    const decryptContext: SurveyQuestionsLegacyValue = buildDecryptContextSnapshot();
    const decryptAttemptId: SurveyQuestionsLegacyValue = startSurveyDecryptAttempt();
    setState(buildDecryptEditStartState());
    const {
      surveyIndex,
      slug,
      fallbackUserAnswers,
      fallbackSourceSlice,
      previousStateSlice,
    }: SurveyQuestionsLegacyValue = (buildSurveyDecryptAttemptSourceInputsHelper as SurveyQuestionsLegacyValue)({
      decryptContext,
      state: stateRef.current,
      getEffectiveDraftSlug: () => inst._getEffectiveDraftSlug(),
    });

    try {
      const { sourceSlice, ratingEnvelopesByQid, chainId, lit, opts, poolForDecrypt }: SurveyQuestionsLegacyValue =
        await prepareSurveyDecryptAttempt({
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
      if (
        (applySurveyDecryptStaleStatusHelper as SurveyQuestionsLegacyValue)({
          host: engine,
          context: decryptContext,
          attemptId: decryptAttemptId,
        }).shouldReturn
      )
        return;
      const {
        normalizedDecryptedSlice,
        decryptedImportanceFromEnv,
        decryptedConvictionFromEnv,
      }: SurveyQuestionsLegacyValue = await finalizeSurveyDecryptAttempt({
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
      if (
        (applySurveyDecryptStaleStatusHelper as SurveyQuestionsLegacyValue)({
          host: engine,
          context: decryptContext,
          attemptId: decryptAttemptId,
        }).shouldReturn
      )
        return;

      finishSurveyDecryptAttempt(decryptAttemptId);
      setState(
        (prevState: SurveyQuestionsLegacyValue) =>
          buildSurveyDecryptSuccessState(prevState, {
            surveyIndex,
            decryptedSlice: normalizedDecryptedSlice,
            decryptedImportanceFromEnv,
            decryptedConvictionFromEnv,
          }),
        () => {
          const jsonPreview: SurveyQuestionsLegacyValue = prepareJsonAndHash(surveyIndex);
          setState(buildJsonPreviewState(jsonPreview));
          persistDraftSafely && persistDraftSafely(0);
        },
      );
    } catch (error: any) {
      surveyLog.error('Error decrypting answers:', error);
      if (
        (applySurveyDecryptStaleStatusHelper as SurveyQuestionsLegacyValue)({
          host: engine,
          context: decryptContext,
          attemptId: decryptAttemptId,
        }).shouldReturn
      )
        return;
      finishSurveyDecryptAttempt(decryptAttemptId);
      setState(buildDecryptEditFailureState(error.message));
    }
  }

  const handleDecryptViewedResponseField = async (
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    responseOverride: SurveyQuestionsLegacyValue = null,
  ) => {
    const decryptContext: SurveyQuestionsLegacyValue = buildDecryptContextSnapshot();
    const taskKey: SurveyQuestionsLegacyValue = buildDecryptTaskKey(
      'viewed',
      questionId,
      fieldToDecrypt,
      responseOverride,
      decryptContext,
    );
    return runDedupedDecryptTask(taskKey, () =>
      handleDecryptViewedResponseFieldInternal(questionId, fieldToDecrypt, responseOverride, decryptContext),
    );
  };

  const getViewedResponseOverrideForQuestion = (
    questionId: SurveyQuestionsLegacyValue,
    responseContainer: SurveyQuestionsLegacyValue = stateRef.current?.parsedViewAddressAnswers,
  ) => {
    return (getViewedResponseOverrideForQuestionHelper as SurveyQuestionsLegacyValue)(
      questionId,
      responseContainer,
      propsRef.current.responderAddress || propsRef.current.viewAddress || '',
    );
  };

  const handleDecryptViewedResponseFieldInternal = async (
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    responseOverride: SurveyQuestionsLegacyValue = null,
    decryptContext: SurveyQuestionsLegacyValue = null,
  ) => {
    const context: SurveyQuestionsLegacyValue = decryptContext || buildDecryptContextSnapshot();
    let decryptAttemptToken: SurveyQuestionsLegacyValue = null;
    // Require wallet login (viewer). Decryption is enforced by Lit access control conditions.
    if (!context.loginComplete || !context.account) {
      return false;
    }

    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid || !responseOverride || typeof responseOverride !== 'object') {
      return false;
    }

    try {
      const responderForLatest: SurveyQuestionsLegacyValue = String(
        responseOverride?.responder || responseOverride?.responderAddress || context.responder || '',
      ).trim();
      const { baselineForDecrypt, ratingEnvelopes }: SurveyQuestionsLegacyValue =
        await prepareViewedQuestionDecryptState({
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

      const attemptStatus: SurveyQuestionsLegacyValue = (
        startQuestionDecryptAttemptStatusHelper as SurveyQuestionsLegacyValue
      )({
        host: engine,
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
      });
      if (attemptStatus.shouldReturn) return attemptStatus.result;
      decryptAttemptToken = attemptStatus.decryptAttemptToken;

      const { decryptedStateSlice, didUpdate, decryptedImportance, decryptedConviction }: SurveyQuestionsLegacyValue =
        await finalizeQuestionDecryptAttempt({
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
      const completionStatus: SurveyQuestionsLegacyValue = (
        applyQuestionDecryptCompletionStatusHelper as SurveyQuestionsLegacyValue
      )({
        host: engine,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        keysToMark: attemptStatus.keysToMark,
        successStateKind: 'viewed',
        successStateOptions: {
          questionId: qid,
          clearMode: attemptStatus.clearMode,
          didUpdate,
          decryptedStateSlice,
          decryptedImportance,
          decryptedConviction,
        },
      });
      if (completionStatus.shouldReturn) return completionStatus.result;

      return didUpdate;
    } catch (error: any) {
      surveyLog.error(`Error decrypting viewed response ${fieldToDecrypt} for ${questionId}`, error);
      return (applyQuestionDecryptFailureStatusHelper as SurveyQuestionsLegacyValue)({
        host: engine,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        error,
      });
    }
  };

  const handleDecryptQuestionAnswer = async (
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    responseOverride: SurveyQuestionsLegacyValue = null,
  ) => {
    const decryptContext: SurveyQuestionsLegacyValue = buildDecryptContextSnapshot();
    const taskKey: SurveyQuestionsLegacyValue = buildDecryptTaskKey(
      'self',
      questionId,
      fieldToDecrypt,
      responseOverride,
      decryptContext,
    );
    return runDedupedDecryptTask(taskKey, () =>
      handleDecryptQuestionAnswerInternal(questionId, fieldToDecrypt, responseOverride, decryptContext),
    );
  };

  const handleDecryptQuestionAnswerInternal = async (
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    responseOverride: SurveyQuestionsLegacyValue = null,
    decryptContext: SurveyQuestionsLegacyValue = null,
  ) => {
    const context: SurveyQuestionsLegacyValue = decryptContext || buildDecryptContextSnapshot();
    let decryptAttemptToken: SurveyQuestionsLegacyValue = null;
    // Require wallet login
    if (!context.loginComplete || !context.account) {
      return false;
    }

    const surveyIndex: SurveyQuestionsLegacyValue = context.surveyIndex;
    const qid = normalizeQuestionIdKey(questionId);
    if (!qid) return false;

    try {
      // If we're viewing someone else's response (via /question/:id/:responder or /survey/:id?address=),
      // decrypt in-place against the viewed response object (do NOT switch to edit mode).
      const { effectiveResponseOverride, hasResponseOverride, isViewedResponseMode }: SurveyQuestionsLegacyValue =
        resolveQuestionDecryptHandlingMode({
          questionId: qid,
          responseOverride,
          viewerAccount: context.account,
          viewedResponder: context.responder || '',
        });
      if (isViewedResponseMode) {
        if (!hasResponseOverride) return false;
        return await handleDecryptViewedResponseField(qid, fieldToDecrypt, effectiveResponseOverride);
      }

      const {
        baselineSlice,
        baselineForDecrypt,
        ratingEnvelopes: latestRatingEnvs,
      }: SurveyQuestionsLegacyValue = await prepareSelfQuestionDecryptState({
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

      const attemptStatus: SurveyQuestionsLegacyValue = (
        startQuestionDecryptAttemptStatusHelper as SurveyQuestionsLegacyValue
      )({
        host: engine,
        questionId: qid,
        fieldToDecrypt,
        baselineForDecrypt,
      });
      if (attemptStatus.shouldReturn) return attemptStatus.result;
      decryptAttemptToken = attemptStatus.decryptAttemptToken;

      const { decryptedStateSlice, didUpdate, decryptedImportance, decryptedConviction }: SurveyQuestionsLegacyValue =
        await finalizeQuestionDecryptAttempt({
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
      const completionStatus: SurveyQuestionsLegacyValue = (
        applyQuestionDecryptCompletionStatusHelper as SurveyQuestionsLegacyValue
      )({
        host: engine,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        keysToMark: attemptStatus.keysToMark,
        successStateKind: 'self',
        successStateOptions: {
          surveyIndex,
          questionId: qid,
          clearMode: attemptStatus.clearMode,
          didUpdate,
          baselineSlice,
          decryptedStateSlice,
          decryptedImportance,
          decryptedConviction,
        },
        onSuccessStateApplied: () => {
          updateJsonPreview && updateJsonPreview();
          persistDraftSafely && persistDraftSafely(0);
        },
      });
      if (completionStatus.shouldReturn) return completionStatus.result;

      return didUpdate;
    } catch (error: any) {
      surveyLog.error(`Error decrypting ${fieldToDecrypt} for ${questionId}`, error);
      return (applyQuestionDecryptFailureStatusHelper as SurveyQuestionsLegacyValue)({
        host: engine,
        context,
        questionId: qid,
        fieldToDecrypt,
        decryptAttemptToken,
        error,
      });
    }
  };

  const {
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
  } = createSurveyQuestionsSubmitRuntime({
    ...context,
    canUpdateStateForAsyncSnapshot,
    clearDraft,
    clearDraftFor,
    deepClone: (value: SurveyQuestionsLegacyValue) => deepClone(value),
    getAnsweredQuestionsCount,
    getChangedQidsAndFields,
    getDefaultResponseEncryptionAudienceForQid,
    getEffectiveRecipientsForField,
    getEffectiveRecipientsForQid,
    getPendingEditStats: (surveyIndexParam?: SurveyQuestionsLegacyValue) => getPendingEditStats(surveyIndexParam),
    invalidateDiffCaches,
    isQuestionLockedForResponse,
    maybeBlockSubmitUntilQuestionPoolComplete,
    prepareJsonAndHash,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    resolveSessionChainId,
    submitSurveyResponse: (
      overrideState: SurveyQuestionsLegacyValue = null,
      overrideChangedQids: SurveyQuestionsLegacyValue = null,
      submitContext: SurveyQuestionsLegacyValue = null,
    ) => submitSurveyResponse(overrideState, overrideChangedQids, submitContext),
    verifyEncryption: (
      onlyTheseQids: SurveyQuestionsLegacyValue = null,
      sliceOverride: SurveyQuestionsLegacyValue = null,
    ) => verifyEncryption(onlyTheseQids, sliceOverride),
    writeSubmittedResponsesToLocalCaches: (
      params: SurveyQuestionsLegacyValue = {},
      submitContext: SurveyQuestionsLegacyValue = null,
    ) => writeSubmittedResponsesToLocalCaches(params, submitContext),
  });

  const computePendingEditStatsAtIndex = (idx: SurveyQuestionsLegacyValue) => {
    const currentSlice: SurveyQuestionsLegacyValue = (stateRef.current.surveysResponseState &&
      stateRef.current.surveysResponseState[idx]) || {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const { result, newCache }: SurveyQuestionsLegacyValue = computePendingEditStats(
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
        getChangedQidsAndFields: (i: SurveyQuestionsLegacyValue) => getChangedQidsAndFields(i),
        isQuestionLockedForResponse: (qid: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(qid),
        buildRatingEnvelopeQidSetFromUserAnswers,
      },
    );
    if (newCache !== inst._pendingEditStatsCache) {
      newCache.diffCacheRef = inst._changedQidsAndFieldsCache;
      inst._pendingEditStatsCache = newCache;
    }
    return result;
  };

  const getPendingEditStats = (surveyIndexParam?: SurveyQuestionsLegacyValue) => {
    const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
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
      onFailure: (error: SurveyQuestionsLegacyValue) => {
        surveyLog.warn('[SurveyQuestions] handleExitEditing failed:', error);
      },
    });
  };

  const verifyEncryption = async (
    onlyTheseQids: SurveyQuestionsLegacyValue = null,
    sliceOverride: SurveyQuestionsLegacyValue = null,
  ) => {
    surveyLog.log('Verifying encryption...');
    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    const stateToCheck: SurveyQuestionsLegacyValue =
      sliceOverride || stateRef.current.surveysResponseState[surveyIndex];
    const { passed, failures }: SurveyQuestionsLegacyValue = verifyEncryptionIntegrity(stateToCheck, onlyTheseQids);

    failures.forEach((msg: SurveyQuestionsLegacyValue) => surveyLog.error(msg));

    if (!passed) {
      throw new Error('Encryption verification failed. Some data marked for encryption was not processed correctly.');
    }
    surveyLog.log('Encryption verification successful.');
    return true;
  };

  const submitSurveyResponse = async (
    overrideState: SurveyQuestionsLegacyValue = null,
    overrideChangedQids: SurveyQuestionsLegacyValue = null,
    submitContext: SurveyQuestionsLegacyValue = null,
  ) => {
    const context: SurveyQuestionsLegacyValue =
      submitContext && typeof submitContext === 'object' ? submitContext : buildSubmitContextSnapshot();
    if (!context.loginComplete) {
      propsRef.current.toggleLoginModal(true);
      return;
    }

    // Use correct survey index for payload + diff gating
    const idx: SurveyQuestionsLegacyValue = context.surveyIndex;

    const data: SurveyQuestionsLegacyValue = prepareJsonAndHash(idx, undefined, overrideState);

    // Build full JSON snapshot first (unchanged behavior) then filter by changed set
    let changedSet: SurveyQuestionsLegacyValue;
    let changedMapForSubmit: SurveyQuestionsLegacyValue = {};
    try {
      const { changedQids, changedMap }: SurveyQuestionsLegacyValue = getChangedQidsAndFields(idx);
      changedMapForSubmit = changedMap || {};
      changedSet = overrideChangedQids ? overrideChangedQids : changedQids || new Set();
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

    let filtered: SurveyQuestionsLegacyValue;
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
      setState(buildSubmitPreparationErrorState(e.message || 'No new or changed responses to submit.'));
      throw e;
    }

    const { questionIds, questionResponses, surveyId, surveyResponse }: SurveyQuestionsLegacyValue = filtered;

    const submissionContext: SurveyQuestionsLegacyValue = resolveSubmissionGroupContext({
      questionIds,
      surveyId: context.singleQuestionMode ? null : context.surveyId || null,
      fallbackSlug: context.effectiveDraftSlug,
    });
    if (!submissionContext.ok) {
      throw new Error(submissionContext.error);
    }
    const submissionGroupKey: SurveyQuestionsLegacyValue = submissionContext.submissionGroupKey;

    // Rating encryption (importance/conviction):
    // - Preserve existing rating envelopes on non-rating edits (prevents wiping encrypted ratings).
    // - When the response is encrypted (or rating already encrypted), ensure ratings are stored in envelopes
    //   and remove plaintext copies from the uploaded payload.
    try {
      await processRatingEnvelopesForSubmit(
        {
          sliceForSubmit:
            overrideState && typeof overrideState === 'object'
              ? overrideState
              : (stateRef.current.surveysResponseState && stateRef.current.surveysResponseState[idx]) || {
                  answers: {},
                  importance: {},
                  conviction: {},
                  additionalComments: {},
                },
          userAnswersSource: stateRef.current.userAnswers,
          questionResponses,
          changedMapForSubmit,
          encryptionBaseOpts: {
            provider: context.provider,
            account: context.account,
            chainId:
              resolveSessionChainId(submissionGroupKey, null, context.props || propsRef.current) || context.chainId,
            surveyId: context.singleQuestionMode || context.isStandalone ? ethers.constants.HashZero : context.surveyId,
            kind: 'rating',
            hasher: stateRef.current.hasher,
          },
        },
        {
          isQuestionLockedForResponse: (qid: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(qid),
          resolveFieldEncryptionAudience: (
            field: SurveyQuestionsLegacyValue,
            qid: SurveyQuestionsLegacyValue,
            fk: SurveyQuestionsLegacyValue,
          ) => resolveFieldEncryptionAudience(field, qid, fk),
          getEffectiveRecipientsForQid: (qid: SurveyQuestionsLegacyValue) => getEffectiveRecipientsForQid(qid),
          getEffectiveRecipientsForField: ((opts: SurveyQuestionsLegacyValue) =>
            getEffectiveRecipientsForField(opts)) as SurveyQuestionsLegacyValue,
          getDefaultResponseEncryptionAudienceForQid: (qid: SurveyQuestionsLegacyValue) =>
            getDefaultResponseEncryptionAudienceForQid(qid),
          buildLitEncryptionOptionsForRecipients: (r: SurveyQuestionsLegacyValue) =>
            buildLitEncryptionOptionsForRecipients(r),
          encryptEnvelopeValue: (value: SurveyQuestionsLegacyValue, opts: SurveyQuestionsLegacyValue) =>
            (cryptoUtils as SurveyQuestionsLegacyValue).encryptEnvelopeValue(value, opts),
          getImportanceFromResponse,
          getConvictionFromResponse,
          warn: (msg: SurveyQuestionsLegacyValue, err: SurveyQuestionsLegacyValue) => surveyLog.warn(msg, err),
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

    const hashDeps: SurveyQuestionsLegacyValue = {
      hashIdentifier: cryptoUtils?.hashIdentifier?.bind(cryptoUtils),
      isHexString: utils.isHexString,
      id: utils.id,
      HashZero: ethers.constants.HashZero,
      warn: (msg: SurveyQuestionsLegacyValue, err: SurveyQuestionsLegacyValue) => surveyLog.warn(msg, err),
    };
    const hashedQuestionIds: SurveyQuestionsLegacyValue = Array.isArray(questionIds)
      ? questionIds.map((value: SurveyQuestionsLegacyValue) => ensureIdentifierHash(value, hashDeps))
      : [];
    const hashedSurveyId: SurveyQuestionsLegacyValue = ensureIdentifierHash(surveyId, hashDeps);

    // Submit tx (must actually send or we throw)
    const tx: SurveyQuestionsLegacyValue = await surveyResponseSubmitPort.submitResponses(
      context.provider,
      hashedQuestionIds,
      questionResponses,
      hashedSurveyId,
      surveyResponse,
      submissionGroupKey,
    );

    return normalizeSubmitReceipt(tx, {
      questionResponses,
      surveyResponse,
      surveyId,
      submissionGroupKey,
      deepClone: (obj: SurveyQuestionsLegacyValue) => deepClone(obj),
    });
  };

  const writeSubmittedResponsesToLocalCaches = async (
    params: SurveyQuestionsLegacyValue = {},
    submitContext: SurveyQuestionsLegacyValue = null,
  ) => {
    const context: SurveyQuestionsLegacyValue =
      submitContext && typeof submitContext === 'object' ? submitContext : null;
    const contextProps: SurveyQuestionsLegacyValue = context?.props || propsRef.current;
    return (writeSubmittedResponsesToLocalCachesHelper as SurveyQuestionsLegacyValue)(params, {
      account: context?.account || propsRef.current.account || '',
      effectiveDraftSlug: context?.effectiveDraftSlug || inst._getEffectiveDraftSlug() || '',
      singleQuestionMode: context ? !!context.singleQuestionMode : !!propsRef.current.singleQuestionMode,
      isStandalone: context ? !!context.isStandalone : !!propsRef.current.isStandalone,
      deepClone: (obj: SurveyQuestionsLegacyValue) => deepClone(obj),
      resolveSubmittedCacheWriteContext: (slug: SurveyQuestionsLegacyValue) =>
        resolveSubmittedCacheWriteContext(contextProps, slug),
    });
  };

  const { getMemoizedMaskedQuestionVisibility, renderDefaultSurveyQuestionsRoute } = createSurveyQuestionsRouteRuntime({
    ...context,
    closeQuestionTagModal,
    copyJsonToClipboard,
    getMemoizedLockedQuestionGateDetails,
    getPendingStatsSnapshot,
    getQuestionsJson,
    getResponseJson,
    getSurveyJson,
    handleDecryptEdit,
    handleExitEditing,
    handlePrimarySubmitClick,
    handleRevertPendingChanges,
    handleScrollToTop,
    handleShowJsonAtBottom,
    handleStartFresh,
    hasMaskedCurrentQuestionPayload,
    isMaskedPromptText,
    jsonTreeDisplay,
    renderLockedQuestionsPanel,
    renderQuestion,
    renderQuestionAnswer,
    renderSurveyAnswers,
    toggleDisplayAnswerMode,
    toggleShowQuestionsJson,
    toggleShowResponseJson,
    toggleShowSurveyJson,
  });

  return {
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
  };
};
