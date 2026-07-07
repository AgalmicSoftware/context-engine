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
import { createSurveyQuestionsGateAudienceRuntime } from './surveyQuestionsGateAudienceRuntime.js';
import { createSurveyQuestionsResponseGatePolicyRuntime } from './surveyQuestionsResponseGatePolicyRuntime.js';

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
      try {
        window.cancelAnimationFrame(inst._autoDecryptSweepFrameRequestId);
      } catch (e: unknown) {
        surveyLog.warn('SurveyTool: cleanup', e);
      }
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

  const queueAutoDecryptVisibleSweep = (reason: SurveyQuestionsLegacyValue = 'unknown') => {
    if (!inst._isMounted) return;
    if (reason) inst._queuedAutoDecryptSweepReasons.add(String(reason));
    if (inst._autoDecryptSweepMicrotaskScheduled) return;
    inst._autoDecryptSweepMicrotaskScheduled = true;
    scheduleMicrotask(() => {
      inst._autoDecryptSweepMicrotaskScheduled = false;
      if (!inst._isMounted) return;
      if (inst._autoDecryptSweepFrameRequestId != null) return;
      const flush: SurveyQuestionsLegacyValue = () => flushQueuedAutoDecryptVisibleSweep();
      if (shouldUseAnimationFrameForAutoDecryptSweep()) {
        inst._autoDecryptSweepFrameRequestId = window.requestAnimationFrame(flush);
        return;
      }
      flush();
    });
  };

  const buildAutoDecryptMaskedFieldSignature = (field: SurveyQuestionsLegacyValue = null) =>
    (buildAutoDecryptMaskedFieldSignatureHelper as SurveyQuestionsLegacyValue)(field);

  const buildDecryptContextSnapshot = () => {
    const draftSlug: SurveyQuestionsLegacyValue = inst._getEffectiveDraftSlug
      ? inst._getEffectiveDraftSlug()
      : resolveEffectiveSlug(propsRef.current);
    const hydrationContext: SurveyQuestionsLegacyValue = resolveDecryptHydrationContext(propsRef.current, draftSlug);
    const singleQuestionMode: SurveyQuestionsLegacyValue = !!propsRef.current.singleQuestionMode;
    const isStandalone: SurveyQuestionsLegacyValue = !!propsRef.current.isStandalone;
    return {
      account: String(propsRef.current?.account || '')
        .trim()
        .toLowerCase(),
      providerKind: String(
        (cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind(propsRef.current?.provider) || '',
      )
        .trim()
        .toLowerCase(),
      sessionSlug: normalizeSessionSlugValue(hydrationContext.sessionSlug || draftSlug || ''),
      networkID: String(
        hydrationContext.networkIdStr ||
          propsRef.current?.networkID ||
          propsRef.current?.network?.id ||
          propsRef.current?.network?.chainId ||
          '',
      ).trim(),
      responder: String(propsRef.current?.responderAddress || propsRef.current?.viewAddress || '')
        .trim()
        .toLowerCase(),
      provider: propsRef.current?.provider,
      loginComplete: !!propsRef.current?.loginComplete,
      singleQuestionMode,
      isStandalone,
      surveyIndex: singleQuestionMode || isStandalone ? 0 : propsRef.current?.surveyIndex || 0,
      surveyId: propsRef.current?.surveyId || propsRef.current?.surveyID || '',
      questionID: propsRef.current?.questionID || '',
      mounted: !!inst._isMounted,
    };
  };

  const buildDecryptContextKey = (snapshot: SurveyQuestionsLegacyValue = null) =>
    buildDecryptContextKeyFromContext(snapshot || buildDecryptContextSnapshot());

  const isDecryptContextCurrent = (snapshot: SurveyQuestionsLegacyValue = null) =>
    !!snapshot &&
    (!snapshot.mounted || inst._isMounted) &&
    buildDecryptContextKey(snapshot) === buildDecryptContextKey();

  const canUpdateStateForAsyncSnapshot = (snapshot: SurveyQuestionsLegacyValue = null) =>
    !!snapshot && (!snapshot.mounted || inst._isMounted);

  const startSurveyDecryptAttempt = () => {
    const attemptId: SurveyQuestionsLegacyValue = (Number(inst._surveyDecryptAttemptSeq) || 0) + 1;
    inst._surveyDecryptAttemptSeq = attemptId;
    inst._activeSurveyDecryptAttemptSeq = attemptId;
    return attemptId;
  };

  const canUpdateSurveyDecryptAttempt = (
    snapshot: SurveyQuestionsLegacyValue = null,
    attemptId: SurveyQuestionsLegacyValue = null,
  ) =>
    canUpdateStateForAsyncSnapshot(snapshot) &&
    Number(attemptId || 0) > 0 &&
    inst._activeSurveyDecryptAttemptSeq === attemptId;

  const finishSurveyDecryptAttempt = (attemptId: SurveyQuestionsLegacyValue = null) => {
    if (Number(attemptId || 0) > 0 && inst._activeSurveyDecryptAttemptSeq === attemptId) {
      inst._activeSurveyDecryptAttemptSeq = 0;
    }
  };

  const registerQuestionDecryptBusyTokens = (keysToMark: SurveyQuestionsLegacyValue = []) => {
    const result: SurveyQuestionsLegacyValue = (
      buildQuestionDecryptBusyTokenRegistrationHelper as SurveyQuestionsLegacyValue
    )({
      tokenSeq: inst._questionDecryptBusyTokenSeq,
      busyTokens: inst._questionDecryptBusyTokens,
      keysToMark,
    });
    inst._questionDecryptBusyTokenSeq = result.token;
    inst._questionDecryptBusyTokens = result.busyTokens;
    return result.token;
  };

  const clearQuestionDecryptBusyTokens = (
    keysToClear: SurveyQuestionsLegacyValue = [],
    token: SurveyQuestionsLegacyValue = null,
  ) => {
    inst._questionDecryptBusyTokens = (buildClearedQuestionDecryptBusyTokensHelper as SurveyQuestionsLegacyValue)({
      busyTokens: inst._questionDecryptBusyTokens,
      keysToClear,
      token,
    });
  };

  const ownsQuestionDecryptBusyTokens = (
    keysToCheck: SurveyQuestionsLegacyValue = [],
    token: SurveyQuestionsLegacyValue = null,
  ) =>
    (ownsQuestionDecryptBusyTokensHelper as SurveyQuestionsLegacyValue)({
      busyTokens: inst._questionDecryptBusyTokens,
      keysToCheck,
      token,
    });

  const buildQuestionDecryptOwnedClearState = (
    prev: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    token: SurveyQuestionsLegacyValue = null,
    extraPatch: SurveyQuestionsLegacyValue = {},
  ) => {
    const result: SurveyQuestionsLegacyValue = (
      buildQuestionDecryptOwnedClearStateHelper as SurveyQuestionsLegacyValue
    )({
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

  const buildQuestionDecryptStaleState = (
    prev: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    token: SurveyQuestionsLegacyValue = null,
  ) => {
    // Regression guard: stale decrypt cleanup may only clear busy flags it owns.
    // A newer decrypt for the same field can start after engine attempt's await.
    return buildQuestionDecryptOwnedClearState(prev, questionId, fieldToDecrypt, token);
  };

  const buildQuestionDecryptFailureStateForAttempt = (
    prev: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    errorMessage: SurveyQuestionsLegacyValue = '',
    token: SurveyQuestionsLegacyValue = null,
  ) => {
    const patch: SurveyQuestionsLegacyValue = buildQuestionDecryptOwnedClearState(
      prev,
      questionId,
      fieldToDecrypt,
      token,
      {
        submissionError: errorMessage || 'Decryption failed.',
      },
    );
    if (patch) return patch;
    return null;
  };

  const buildDecryptTaskKey = (
    mode: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    responseOverride: SurveyQuestionsLegacyValue = null,
    decryptContext: SurveyQuestionsLegacyValue = null,
  ) => {
    const baseKey: SurveyQuestionsLegacyValue = (buildDecryptTaskKeyHelper as SurveyQuestionsLegacyValue)(
      mode,
      questionId,
      fieldToDecrypt,
      responseOverride,
      String(propsRef.current?.responderAddress || propsRef.current?.viewAddress || ''),
    );
    return `${baseKey}|${buildDecryptContextKey(decryptContext || buildDecryptContextSnapshot())}`;
  };

  const getQuestionFieldTaskKey = (
    questionId: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    return (getQuestionFieldTaskKeyHelper as SurveyQuestionsLegacyValue)(questionId, fieldKey);
  };

  const isQuestionFieldBusy = (
    questionId: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const taskKey: SurveyQuestionsLegacyValue = getQuestionFieldTaskKey(questionId, fieldKey);
    if (!taskKey) return false;
    return !!(stateRef.current.decryptingByKey && stateRef.current.decryptingByKey[taskKey]);
  };

  const getQuestionFieldDecryptSelection = (
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    responseSlice: SurveyQuestionsLegacyValue = null,
  ) =>
    (getQuestionFieldDecryptSelectionHelper as SurveyQuestionsLegacyValue)(questionId, fieldToDecrypt, responseSlice);

  const decryptQuestionRatingEnvelopes = async (
    ratingEnvelopes: SurveyQuestionsLegacyValue = null,
    { chainId, lit, account, providerLike }: SurveyQuestionsLegacyValue = {},
  ) =>
    (decryptQuestionRatingEnvelopesHelper as SurveyQuestionsLegacyValue)(
      ratingEnvelopes,
      { chainId, lit, account, providerLike },
      {
        decryptEnvelopeValue: (cryptoUtils as SurveyQuestionsLegacyValue).decryptEnvelopeValue,
        logWarn: (error: SurveyQuestionsLegacyValue) => surveyLog.warn('SurveyTool: fallback', error),
      },
    );

  const decryptQuestionRatingEnvelopeMap = async (
    ratingEnvelopesByQid: SurveyQuestionsLegacyValue = {},
    { chainId, lit, account, providerLike }: SurveyQuestionsLegacyValue = {},
  ) =>
    (decryptQuestionRatingEnvelopeMapHelper as SurveyQuestionsLegacyValue)(
      ratingEnvelopesByQid,
      { chainId, lit, account, providerLike },
      {
        decryptEnvelopeValue: (cryptoUtils as SurveyQuestionsLegacyValue).decryptEnvelopeValue,
        logWarn: (error: SurveyQuestionsLegacyValue) => surveyLog.warn('SurveyTool: fallback', error),
      },
    );

  const buildQuestionDecryptExecutionContext = (
    baselineForDecrypt: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
  ) => {
    const litHooks: SurveyQuestionsLegacyValue =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
    return (buildQuestionDecryptExecutionContextHelper as SurveyQuestionsLegacyValue)({
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
      getProviderKind: (cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind,
    });
  };

  const buildSurveyDecryptExecutionContext = (
    sourceSlice: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue = null,
  ) => {
    const litHooks: SurveyQuestionsLegacyValue =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
    return (buildSurveyDecryptExecutionContextHelper as SurveyQuestionsLegacyValue)({
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
      getProviderKind: (cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind,
    });
  };

  const buildViewedResponseDecryptSuccessState = (
    prevState: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => (buildViewedResponseDecryptSuccessStateHelper as SurveyQuestionsLegacyValue)(prevState, options);

  const buildSelfQuestionDecryptSuccessState = (
    prevState: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => (buildSelfQuestionDecryptSuccessStateHelper as SurveyQuestionsLegacyValue)(prevState, options, deepClone);

  const buildSurveyDecryptSuccessState = (
    prevState: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => (buildSurveyDecryptSuccessStateHelper as SurveyQuestionsLegacyValue)(prevState, options, deepClone);

  const syncDecryptedQuestionIntoBaseline = (
    editBaseline: SurveyQuestionsLegacyValue,
    fallbackBaseline: SurveyQuestionsLegacyValue,
    nextTargetStateSlice: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) =>
    (syncDecryptedQuestionIntoBaselineHelper as SurveyQuestionsLegacyValue)(
      editBaseline,
      fallbackBaseline,
      nextTargetStateSlice,
      options,
      deepClone,
    );

  const mergeLatestEncryptedQuestionFields = (
    responseSlice: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    latestResponse: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) =>
    (mergeLatestEncryptedQuestionFieldsHelper as SurveyQuestionsLegacyValue)(
      responseSlice,
      questionId,
      latestResponse,
      options,
    );

  const mergeQuestionResponseOverrideIntoDecryptSlice = (
    responseSlice: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    responseOverride: SurveyQuestionsLegacyValue,
  ) =>
    (mergeQuestionResponseOverrideIntoDecryptSliceHelper as SurveyQuestionsLegacyValue)(
      responseSlice,
      questionId,
      responseOverride,
    );

  const buildSurveyDecryptSourceState = (
    latestResponse: SurveyQuestionsLegacyValue = null,
    fallbackSourceSlice: SurveyQuestionsLegacyValue = null,
    previousStateSlice: SurveyQuestionsLegacyValue = null,
  ) =>
    (buildSurveyDecryptSourceStateHelper as SurveyQuestionsLegacyValue)(
      latestResponse,
      fallbackSourceSlice,
      previousStateSlice,
      buildSliceFromUserAnswers,
    );

  const hydrateLatestQuestionDecryptState = async (options: SurveyQuestionsLegacyValue = {}) =>
    (hydrateLatestQuestionDecryptStateHelper as SurveyQuestionsLegacyValue)(options, {
      getQuestionFieldDecryptSelection: getQuestionFieldDecryptSelection,
      readQuestionsCache,
      getLatestQuestionResponse: getLatestQuestionResponse,
      mergeLatestEncryptedQuestionFields: mergeLatestEncryptedQuestionFields,
      mergeQuestionRatingEnvelopeState: mergeQuestionRatingEnvelopeState,
      logWarn: (error: SurveyQuestionsLegacyValue) => surveyLog.warn('SurveyTool: fallback', error),
    });

  const prepareViewedQuestionDecryptState = async (options: SurveyQuestionsLegacyValue = {}) =>
    (prepareViewedQuestionDecryptStateHelper as SurveyQuestionsLegacyValue)(options, {
      buildViewedResponseDecryptBaseline: buildViewedResponseDecryptBaseline,
      hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptState,
    });

  const prepareSelfQuestionDecryptState = async (options: SurveyQuestionsLegacyValue = {}) =>
    (prepareSelfQuestionDecryptStateHelper as SurveyQuestionsLegacyValue)(options, {
      buildSelfQuestionDecryptBaseline: buildSelfQuestionDecryptBaseline,
      mergeQuestionResponseOverrideIntoDecryptSlice: mergeQuestionResponseOverrideIntoDecryptSlice,
      mergeQuestionRatingEnvelopeState: mergeQuestionRatingEnvelopeState,
      hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptState,
      logWarn: (error: SurveyQuestionsLegacyValue) => surveyLog.warn('SurveyTool: fallback', error),
    });

  const resolveLatestSurveyDecryptResponse = async (options: SurveyQuestionsLegacyValue = {}) =>
    (resolveLatestSurveyDecryptResponseHelper as SurveyQuestionsLegacyValue)(options, {
      getLatestQuestionResponse: surveyQuestionReadsPort.getResponse,
      getLatestSurveyResponse: getSurveyResponse,
    });

  const prepareSurveyDecryptAttempt = async (options: SurveyQuestionsLegacyValue = {}) =>
    (prepareSurveyDecryptAttemptHelper as SurveyQuestionsLegacyValue)(options, {
      resolveLatestSurveyDecryptResponse: resolveLatestSurveyDecryptResponse,
      buildSurveyDecryptSourceState: buildSurveyDecryptSourceState,
      buildSurveyDecryptExecutionContext: buildSurveyDecryptExecutionContext,
    });

  const resolveQuestionDecryptHandlingMode = (options: SurveyQuestionsLegacyValue = {}) =>
    (resolveQuestionDecryptHandlingModeHelper as SurveyQuestionsLegacyValue)(options, {
      getViewedResponseOverrideForQuestion: getViewedResponseOverrideForQuestion,
    });

  const prepareQuestionDecryptAttempt = (options: SurveyQuestionsLegacyValue = {}) =>
    (prepareQuestionDecryptAttemptHelper as SurveyQuestionsLegacyValue)(options, {
      getQuestionFieldDecryptSelection: getQuestionFieldDecryptSelection,
      buildQuestionDecryptExecutionContext: buildQuestionDecryptExecutionContext,
    });

  const finalizeQuestionDecryptAttempt = async (options: SurveyQuestionsLegacyValue = {}) =>
    (finalizeQuestionDecryptAttemptHelper as SurveyQuestionsLegacyValue)(options, {
      decryptSingleField: (cryptoUtils as SurveyQuestionsLegacyValue).decryptSingleField,
      decryptQuestionRatingEnvelopes: decryptQuestionRatingEnvelopes,
    });

  const finalizeSurveyDecryptAttempt = async (options: SurveyQuestionsLegacyValue = {}) =>
    (finalizeSurveyDecryptAttemptHelper as SurveyQuestionsLegacyValue)(options, {
      decryptMultipleAnswers: (cryptoUtils as SurveyQuestionsLegacyValue).decryptMultipleAnswers,
      decryptQuestionRatingEnvelopeMap: decryptQuestionRatingEnvelopeMap,
      normalizeBulkDecryptedSliceForSurveyState: normalizeBulkDecryptedSliceForSurveyState,
    });

  const normalizeBulkDecryptedSliceForSurveyState = (
    decryptedSlice: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => (normalizeBulkDecryptedSliceForSurveyStateHelper as SurveyQuestionsLegacyValue)(decryptedSlice, options);

  const mergeQuestionRatingEnvelopeState = (
    previousState: SurveyQuestionsLegacyValue,
    nextSource: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue = null,
  ) => (mergeQuestionRatingEnvelopeStateHelper as SurveyQuestionsLegacyValue)(previousState, nextSource, questionId);

  const buildQuestionDecryptStartState = (
    prevState: SurveyQuestionsLegacyValue,
    keysToMark: SurveyQuestionsLegacyValue = [],
  ) => (buildQuestionDecryptStartStateHelper as SurveyQuestionsLegacyValue)(prevState, keysToMark);

  const buildQuestionDecryptFailureState = (
    prevState: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    fieldToDecrypt: SurveyQuestionsLegacyValue = 'both',
    errorMessage: SurveyQuestionsLegacyValue = '',
  ) =>
    (buildQuestionDecryptFailureStateHelper as SurveyQuestionsLegacyValue)(
      prevState,
      questionId,
      fieldToDecrypt,
      errorMessage,
    );

  const buildViewedResponseDecryptBaseline = (
    responseOverride: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
  ) =>
    (buildViewedResponseDecryptBaselineHelper as SurveyQuestionsLegacyValue)(
      responseOverride,
      questionId,
      buildSliceFromUserAnswers,
    );

  const buildSelfQuestionDecryptBaseline = (surveyIndex: SurveyQuestionsLegacyValue) =>
    (buildSelfQuestionDecryptBaselineHelper as SurveyQuestionsLegacyValue)(
      surveyIndex,
      stateRef.current.surveysResponseState,
      stateRef.current.userAnswers,
      buildSliceFromUserAnswers,
      deepClone,
    );

  const normalizeSingleQuestionViewedResponse = (rawResponse: SurveyQuestionsLegacyValue = null) =>
    (normalizeSingleQuestionViewedResponseHelper as SurveyQuestionsLegacyValue)(rawResponse);

  const runDedupedDecryptTask = (taskKey: SurveyQuestionsLegacyValue, runner: SurveyQuestionsLegacyValue) =>
    (runDedupedDecryptTaskHelper as SurveyQuestionsLegacyValue)(inst._decryptFieldTaskInFlight, taskKey, runner);

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

  const startCanDecryptOtherResponsesRun = (snapshotKey: SurveyQuestionsLegacyValue = '') => {
    inst._canDecryptOtherResponsesKey = String(snapshotKey || '');
    const runId: SurveyQuestionsLegacyValue = (Number(inst._canDecryptOtherResponsesRunId) || 0) + 1;
    inst._canDecryptOtherResponsesRunId = runId;
    return runId;
  };

  const isCurrentCanDecryptOtherResponsesRun = (
    runId: SurveyQuestionsLegacyValue,
    snapshotKey: SurveyQuestionsLegacyValue = '',
  ) => inst._canDecryptOtherResponsesRunId === runId && inst._canDecryptOtherResponsesKey === String(snapshotKey || '');

  const clearCanDecryptOtherResponsesInFlightIfTracked = (tracked: SurveyQuestionsLegacyValue = null) => {
    if (inst._canDecryptOtherResponsesInFlight === tracked) {
      inst._canDecryptOtherResponsesInFlight = null;
    }
  };

  const refreshCanDecryptOtherResponses = async () => {
    try {
      const ctx: SurveyQuestionsLegacyValue = buildCanDecryptContext({
        getEffectiveDraftSlug: () => resolveResponseGateSessionSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(propsRef.current),
        resolveEffectiveResponseGateConfig: (slug: SurveyQuestionsLegacyValue) =>
          resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => getResponseGatePolicy(),
        account: propsRef.current?.account || '',
        loginComplete: propsRef.current?.loginComplete,
        singleQuestionMode: isResponseGateQuestionFlow() as SurveyQuestionsLegacyValue,
        isStandalone: propsRef.current.isStandalone as SurveyQuestionsLegacyValue,
        sbtCacheRevision: propsRef.current?.sbtCacheRevision || 0,
      });
      const { cfg, slug, snapshot }: SurveyQuestionsLegacyValue = ctx;
      const preCheck: SurveyQuestionsLegacyValue = evaluateCanDecryptPreCheck(snapshot);

      if (preCheck.earlyExit) {
        // Invalidate any in-flight checks so they can't race and re-enable decrypt UI.
        invalidateCanDecryptOtherResponsesTracking();
        if (
          stateRef.current.canDecryptOtherResponses ||
          stateRef.current.canDecryptOtherResponsesStatus !== preCheck.status
        ) {
          setState(buildCanDecryptOtherResponsesState({ status: preCheck.status }));
        }
        return false;
      }

      const snapshotKey: SurveyQuestionsLegacyValue = String(snapshot.key || '');
      if (snapshotKey === inst._canDecryptOtherResponsesKey && inst._canDecryptOtherResponsesInFlight) {
        return await inst._canDecryptOtherResponsesInFlight;
      }
      const runId: SurveyQuestionsLegacyValue = startCanDecryptOtherResponsesRun(snapshotKey);

      const run: SurveyQuestionsLegacyValue = (async () => {
        if (
          stateRef.current.canDecryptOtherResponsesStatus !== 'checking' &&
          isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)
        ) {
          // Clear any previously granted permission while we verify against the current gate/session/wallet.
          setState(buildCanDecryptOtherResponsesState({ status: 'checking' }));
        }
        const { canDecrypt, status }: SurveyQuestionsLegacyValue = await resolveCanDecryptGateAccess(
          {
            cfg,
            slug,
            account: snapshot.account,
            resourceKeysToCheck: snapshot.resourceKeysToCheck,
          },
          checkSponsoredAccess,
        );
        if (isCurrentCanDecryptOtherResponsesRun(runId, snapshotKey)) {
          setState(buildCanDecryptOtherResponsesState({ canDecrypt, status }));
        }
        return canDecrypt;
      })();

      let tracked: SurveyQuestionsLegacyValue = null;
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
      } catch (e: any) {
        surveyLog.warn('SurveyTool: fallback', e);
      }
      return false;
    }
  };

  const buildCanDecryptOtherResponsesSignature = () => {
    try {
      return buildCanDecryptContext({
        getEffectiveDraftSlug: () => resolveResponseGateSessionSlug(),
        resolveEffectiveSlugFromProps: () => resolveEffectiveSlug(propsRef.current),
        resolveEffectiveResponseGateConfig: (slug: SurveyQuestionsLegacyValue) =>
          resolveEffectiveResponseGateConfig(slug),
        getResponseGatePolicy: () => getResponseGatePolicy(),
        account: propsRef.current?.account || '',
        loginComplete: propsRef.current?.loginComplete,
        singleQuestionMode: isResponseGateQuestionFlow() as SurveyQuestionsLegacyValue,
        isStandalone: propsRef.current.isStandalone as SurveyQuestionsLegacyValue,
        sbtCacheRevision: propsRef.current?.sbtCacheRevision || 0,
      }).snapshot.signature;
    } catch (_: any) {
      return '';
    }
  };

  const maybeRefreshCanDecryptOtherResponses = () => {
    try {
      const sig: SurveyQuestionsLegacyValue = buildCanDecryptOtherResponsesSignature();
      if (sig === inst._canDecryptOtherResponsesSig) return;
      inst._canDecryptOtherResponsesSig = sig;
      refreshCanDecryptOtherResponses();
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
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
    )
      return;
    inst._lastPendingStats = { total, encrypted, submittedSinceLastEdit, isSubmitting };
    propsRef.current.onPendingStatsChange({ total, encrypted, submittedSinceLastEdit, isSubmitting });
  };

  const getPendingStatsSnapshot = () => getPendingStatsSnapshotFromState(stateRef.current);

  const getActiveSurveyIndex = (surveyIndexParam?: number | null) =>
    propsRef.current.isStandalone || propsRef.current.singleQuestionMode
      ? 0
      : (surveyIndexParam ?? propsRef.current.surveyIndex ?? 0);

  const didEditDiffInputsChange = (
    prevProps?: SurveyQuestionsProps | null,
    prevState?: SurveyQuestionsState | null,
  ) => {
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
    const explicitSessionSlug: SurveyQuestionsLegacyValue = resolveEffectiveSlug(propsRef.current);
    const resolvedSession: SurveyQuestionsLegacyValue = explicitSessionSlug
      ? resolveExplicitSessionContext(explicitSessionSlug)
      : resolveDraftSessionContext(propsRef.current, inst._getEffectiveDraftSlug());
    const sessionSlug: SurveyQuestionsLegacyValue = resolvedSession.sessionSlug || '';
    const sessionConfig: SurveyQuestionsLegacyValue = resolvedSession.sessionConfig || null;
    const providerLike: SurveyQuestionsLegacyValue =
      typeof propsRef.current.providerLike === 'string'
        ? propsRef.current.providerLike
        : typeof propsRef.current.provider === 'string'
          ? propsRef.current.provider
          : '';
    const chainId: SurveyQuestionsLegacyValue = resolveSessionChainId(sessionSlug, sessionConfig);
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

  const buildQuestionDecryptContext = (slugIn: SurveyQuestionsLegacyValue) => {
    const slug: SurveyQuestionsLegacyValue = String(slugIn ?? '')
      .trim()
      .toLowerCase();
    const cfg: SurveyQuestionsLegacyValue = resolveExplicitSessionContext(slug).sessionConfig || null;
    const litHooks: SurveyQuestionsLegacyValue =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
    return buildQuestionDecryptContextForSession({
      cfg,
      account: propsRef.current.account || '',
      providerLike: propsRef.current.provider || '',
      litHooks,
      fallbackChainId: resolveSessionChainId(slug, cfg),
    });
  };

  const buildAutomaticQuestionMetadataFetchOptions = (slugIn: SurveyQuestionsLegacyValue) => {
    const decryptContext: SurveyQuestionsLegacyValue = buildQuestionDecryptContext(slugIn);
    return shouldAttemptAutomaticPromptDecrypt() ? { decryptContext } : { decryptContext, skipDecrypt: true };
  };

  const hasMaskedCurrentQuestionPayload = () => {
    if (!propsRef.current.singleQuestionMode) return false;
    const q: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current.questionPool)
      ? stateRef.current.questionPool[0]
      : null;
    if (q && typeof q === 'object') {
      if (isMaskedQuestionPayload(q)) return true;
      const prompt: SurveyQuestionsLegacyValue = String(q.prompt || '').trim();
      if (prompt || q.promptDecrypted) return false;
    }
    const qid: SurveyQuestionsLegacyValue = String(propsRef.current.questionID || '').toLowerCase();
    if (!qid) return false;
    const slug: SurveyQuestionsLegacyValue = inst._getEffectiveDraftSlug();
    const cfg: SurveyQuestionsLegacyValue = resolveExplicitSessionContext(slug).sessionConfig || null;
    const netIdStr: SurveyQuestionsLegacyValue = String(
      propsRef.current.network?.id ?? propsRef.current.networkChainId ?? cfg?.networkChainId ?? '',
    );
    if (!netIdStr) return false;
    const cache: SurveyQuestionsLegacyValue = readQuestionsCache(slug) || {};
    const cached: SurveyQuestionsLegacyValue = cache?.[netIdStr]?.questions?.[qid];
    return isMaskedQuestionPayload(cached);
  };

  const isMaskedPromptText = (prompt: SurveyQuestionsLegacyValue) => isSurveyQuestionsMaskedPromptText(prompt);

  const getQuestionFetchCandidateSlugs = (
    questionId: SurveyQuestionsLegacyValue,
    preferredSlug: SurveyQuestionsLegacyValue = '',
    opts: SurveyQuestionsLegacyValue = {},
  ) => {
    const sanitize: SurveyQuestionsLegacyValue = (s: SurveyQuestionsLegacyValue) =>
      s == null
        ? ''
        : String(s)
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '');

    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    const slugPinned: SurveyQuestionsLegacyValue = getSessionSlugPinnedFromProps(propsRef.current);
    const explicitSlug: SurveyQuestionsLegacyValue = sanitize(getSessionSlugHintFromProps(propsRef.current));
    const currentQuestionSessionName: SurveyQuestionsLegacyValue = (
      stateRef.current.questionPool?.[0] as SurveyQuestionsLegacyValue
    )?.sessionName;
    const resolvedSlug: SurveyQuestionsLegacyValue = sanitize(
      resolveSlugForIds({
        sessionName: propsRef.current.sessionName || currentQuestionSessionName,
        questionId: qid || propsRef.current.questionID || null,
        surveyId: propsRef.current.singleQuestionMode ? null : propsRef.current.surveyId || null,
        props: propsRef.current,
        network: propsRef.current.network,
      }),
    );
    const preferred: SurveyQuestionsLegacyValue = sanitize(preferredSlug);
    const effective: SurveyQuestionsLegacyValue =
      preferred || explicitSlug || resolvedSlug || sanitize(resolveEffectiveSlug(propsRef.current));
    const explicitSlugKnown: SurveyQuestionsLegacyValue =
      explicitSlug === '' || !!resolveExplicitSessionContext(explicitSlug).sessionConfig;
    // Default behavior preserves strict session pinning; callers can opt into fallback explicitly.
    const allowPinnedFallback: SurveyQuestionsLegacyValue =
      opts?.allowPinnedFallback === true || (slugPinned && !!explicitSlug && !explicitSlugKnown);

    const out: SurveyQuestionsLegacyValue = [];
    const seen: SurveyQuestionsLegacyValue = new Set();
    const pushSlug: SurveyQuestionsLegacyValue = (slugIn: SurveyQuestionsLegacyValue) => {
      const slug: SurveyQuestionsLegacyValue = sanitize(slugIn);
      if (seen.has(slug)) return;
      seen.add(slug);
      out.push(slug);
    };

    pushSlug(effective);
    pushSlug(explicitSlug);
    pushSlug(resolvedSlug);
    pushSlug(resolveEffectiveSlug(propsRef.current));

    if (!slugPinned || allowPinnedFallback) {
      getAllSessionSlugs().forEach((s: SurveyQuestionsLegacyValue) => pushSlug(s));
      pushSlug('');
    }

    return out;
  };

  const cacheQuestionPayloadForSlug = (
    slugIn: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    questionPayload: SurveyQuestionsLegacyValue,
  ) => {
    const slug: SurveyQuestionsLegacyValue = String(slugIn ?? '')
      .trim()
      .toLowerCase();
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid || !questionPayload) return;

    const cacheWriteContext: SurveyQuestionsLegacyValue = resolveQuestionPayloadCacheWriteContext(
      propsRef.current,
      slug,
    );
    const netIdStr: SurveyQuestionsLegacyValue = cacheWriteContext.networkIdStr || '';
    if (!netIdStr) return;

    const questionsCache: SurveyQuestionsLegacyValue = ensureQuestionsNet(readQuestionsCache(slug), netIdStr);
    const existing: SurveyQuestionsLegacyValue = questionsCache?.[netIdStr]?.questions?.[qid] || null;
    const picked: SurveyQuestionsLegacyValue = pickBetterQuestionPayload(existing, questionPayload) || questionPayload;
    const nextPayload: SurveyQuestionsLegacyValue = { ...picked, id: qid };
    if (areQuestionPayloadsEquivalent(existing, nextPayload)) return;
    questionsCache[netIdStr].questions[qid] = nextPayload;
    void writeQuestionsCache(slug, questionsCache);
  };

  const applyQuestionPayloadToRenderedPools = (
    questionId: SurveyQuestionsLegacyValue,
    questionPayload: SurveyQuestionsLegacyValue,
  ) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid || !questionPayload) return;

    setState((prev: SurveyQuestionsLegacyValue) =>
      buildRenderedQuestionPayloadPoolsState(prev, qid, questionPayload, {
        pickBetterQuestionPayload: pickBetterQuestionPayload as SurveyQuestionsLegacyValue,
        areQuestionPayloadsEquivalent,
      }),
    );
  };

  const fetchQuestionPayloadWithDeterministicContext = async (
    questionId: SurveyQuestionsLegacyValue,
    opts: SurveyQuestionsLegacyValue = {},
  ) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid) return { promptReady: false, bestQuestionData: null, bestSlug: '' };

    const currentQuestion: SurveyQuestionsLegacyValue =
      (Array.isArray(stateRef.current.questionPool)
        ? stateRef.current.questionPool.find(
            (q: SurveyQuestionsLegacyValue) => String(q?.id || '').toLowerCase() === qid,
          )
        : null) ||
      (Array.isArray(stateRef.current.pileQuestions)
        ? stateRef.current.pileQuestions.find(
            (q: SurveyQuestionsLegacyValue) => String(q?.id || '').toLowerCase() === qid,
          )
        : null) ||
      null;

    let bestQuestionData: SurveyQuestionsLegacyValue = currentQuestion ? { ...currentQuestion, id: qid } : null;
    let bestSlug: SurveyQuestionsLegacyValue = String(
      opts.preferredSlug ?? inst._getEffectiveDraftSlug() ?? '',
    ).toLowerCase();
    const candidateSlugs: SurveyQuestionsLegacyValue = getQuestionFetchCandidateSlugs(qid, bestSlug);
    let fetchedAny: SurveyQuestionsLegacyValue = false;

    for (const candidateSlug of candidateSlugs) {
      const decryptContext: SurveyQuestionsLegacyValue = buildQuestionDecryptContext(candidateSlug);
      const litReady: SurveyQuestionsLegacyValue = !!(
        decryptContext?.litHooks && typeof decryptContext.litHooks.getKey === 'function'
      );
      try {
        const fetched: SurveyQuestionsLegacyValue = await surveyQuestionReadsPort.getQuestionData(
          propsRef.current.provider,
          qid,
          candidateSlug,
          { decryptContext },
        );
        if (!fetched) continue;
        fetchedAny = true;
        const normalized: SurveyQuestionsLegacyValue = { ...fetched, id: qid };
        const picked: SurveyQuestionsLegacyValue =
          pickBetterQuestionPayload(bestQuestionData, normalized) || normalized;
        bestQuestionData = picked;
        bestSlug = candidateSlug;
        cacheQuestionPayloadForSlug(candidateSlug, qid, picked);
        const promptReady: SurveyQuestionsLegacyValue = !isMaskedPromptText(picked?.prompt);
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

    const promptReady: SurveyQuestionsLegacyValue = !!bestQuestionData && !isMaskedPromptText(bestQuestionData?.prompt);
    if (!promptReady) {
      const litHooks: SurveyQuestionsLegacyValue =
        propsRef.current.lit ||
        propsRef.current.litHooks ||
        (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
      const litReady: SurveyQuestionsLegacyValue = !!(litHooks && typeof litHooks.getKey === 'function');
      const chainId: SurveyQuestionsLegacyValue =
        Number(propsRef.current.network?.id ?? propsRef.current.networkChainId ?? 0) || null;
      const reason: SurveyQuestionsLegacyValue =
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

  const handleReloadMaskedPrompt = async (questionId: SurveyQuestionsLegacyValue) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '')
      .trim()
      .toLowerCase();
    if (!qid) return false;
    const key: SurveyQuestionsLegacyValue = getQuestionFieldTaskKey(qid, 'prompt');

    setState((prev: SurveyQuestionsLegacyValue) => buildDecryptingByKeyState(prev, key, true));

    try {
      const preferredSlug: SurveyQuestionsLegacyValue = inst._getEffectiveDraftSlug();
      const result: SurveyQuestionsLegacyValue = await fetchQuestionPayloadWithDeterministicContext(qid, {
        preferredSlug,
      });

      if (propsRef.current.singleQuestionMode && qid === String(propsRef.current.questionID || '').toLowerCase()) {
        await fetchSingleQuestionData({ forceQuestionMetadataRefetch: true });
      }

      // Pile view keeps gated/masked questions in allQuestionsForFilter as source-of-truth.
      // After a successful decrypt, refresh the visible pile cards from that source without
      // triggering a full filter/apply cycle that could wipe in-progress edits.
      if (result?.promptReady) {
        setState((prev: SurveyQuestionsLegacyValue) =>
          buildVisiblePileQuestionsAfterPromptDecryptState(prev, {
            isFilterStateActive: isSurveyToolFilterStateActive,
            isMaskedPromptText: isMaskedPromptText,
          }),
        );
      }

      const activePrompt: SurveyQuestionsLegacyValue = (() => {
        const q: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current.questionPool)
          ? stateRef.current.questionPool.find(
              (item: SurveyQuestionsLegacyValue) => String(item?.id || '').toLowerCase() === qid,
            )
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
      setState((prev: SurveyQuestionsLegacyValue) => buildDecryptingByKeyState(prev, key, false));
    }
  };

  const reloadMaskedQuestionBatch = async (questionIds: SurveyQuestionsLegacyValue = []) => {
    const ids: SurveyQuestionsLegacyValue = Array.from(
      new Set(
        (Array.isArray(questionIds) ? questionIds : [])
          .map((qid: SurveyQuestionsLegacyValue) =>
            String(qid || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );
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

  const renderPromptWithManualDecrypt = (question: SurveyQuestionsLegacyValue) => {
    const qid: SurveyQuestionsLegacyValue = String(question?.id || '')
      .trim()
      .toLowerCase();
    const promptText: SurveyQuestionsLegacyValue = question?.prompt || 'Question';
    const promptMasked: SurveyQuestionsLegacyValue = isMaskedPromptText(promptText);
    const payloadDisplay: SurveyQuestionsLegacyValue = getQuestionPayloadDisplayState(question);
    const promptReloading: SurveyQuestionsLegacyValue = isQuestionFieldBusy(qid, 'prompt');
    const promptDisplay: SurveyQuestionsLegacyValue = buildQuestionPromptDecryptDisplayState({
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

  const renderQuestionTagControl = (question: SurveyQuestionsLegacyValue, options: SurveyQuestionsLegacyValue = {}) => {
    const { rowStyle }: SurveyQuestionsLegacyValue = options;
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

  const renderQuestionTagDropdown = (question: SurveyQuestionsLegacyValue) => renderQuestionTagControl(question);

  const handleQuestionTagSelect = (tag: SurveyQuestionsLegacyValue) => {
    const normalizedTag: SurveyQuestionsLegacyValue = String(tag || '').trim();
    if (!normalizedTag) return;
    setState(buildActiveTagModalState(normalizedTag));
  };

  const closeQuestionTagModal = () => {
    setState(buildActiveTagModalState());
  };

  const renderQuestionTagDropdownRow = (question: SurveyQuestionsLegacyValue) =>
    renderQuestionTagControl(question, {
      rowStyle: QUESTION_TAG_DROPDOWN_ROW_STYLE,
    });

  const getSliderMode = (questionId: SurveyQuestionsLegacyValue) => {
    return getQuestionSliderMode({
      explicitMode: stateRef.current.sliderModeByQuestion?.[questionId],
      isStandalone: propsRef.current.isStandalone,
      singleQuestionMode: propsRef.current.singleQuestionMode,
      surveyIndex: propsRef.current.surveyIndex,
      surveysResponseState: stateRef.current.surveysResponseState,
      questionId,
    });
  };

  const setSliderMode = (questionId: SurveyQuestionsLegacyValue, mode: SurveyQuestionsLegacyValue) => {
    setState((prev: SurveyQuestionsLegacyValue) =>
      // Track whether the conviction/importance control has been "opened" for engine question.
      buildSliderModeStatePatch(prev, questionId, mode),
    );
  };

  const getConvictionValueForSlice = (slice: SurveyQuestionsLegacyValue, questionId: SurveyQuestionsLegacyValue) => {
    return getQuestionConvictionSliderValue(slice, questionId);
  };

  const getImportanceValueForSlice = (slice: SurveyQuestionsLegacyValue, questionId: SurveyQuestionsLegacyValue) => {
    return getQuestionImportanceSliderValue(slice, questionId);
  };

  const flushDraftPersistAfterSliderChange = () => {
    persistDraftSafely && persistDraftSafely(0);
  };

  const handleConvictionImportanceChange = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    mode: SurveyQuestionsLegacyValue,
    value: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
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
  }: SurveyQuestionsLegacyValue) => (
    <SurveyQuestionsFullQuestionSliderSection
      activeSliderValue={activeSliderValue}
      convictionValue={convictionValue}
      hasConvictionImportanceValue={hasConvictionImportanceValue}
      importanceToggleEnabled={ENABLE_IMPORTANCE_SLIDER_TOGGLE}
      importanceValue={importanceValue}
      isSubmitting={stateRef.current.isSubmitting}
      onChange={(value: SurveyQuestionsLegacyValue, event: SurveyQuestionsLegacyValue) =>
        handleConvictionImportanceChange(surveyIndex, questionId, sliderMode, value, buildSliderPersistOptions(event))
      }
      onChangeComplete={flushDraftPersistAfterSliderChange}
      onCommit={(committedValue: SurveyQuestionsLegacyValue) =>
        handleConvictionImportanceChange(surveyIndex, questionId, sliderMode, committedValue, {
          persistDraft: false,
          afterUpdate: flushDraftPersistAfterSliderChange,
        })
      }
      onSelectMode={(nextMode: SurveyQuestionsLegacyValue) => setSliderMode(questionId, nextMode)}
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
  }: SurveyQuestionsLegacyValue) => (
    <SurveyQuestionsFullQuestionResponseInput
      question={question}
      qIndex={qIndex}
      answer={answer}
      glowAnswer={glowAnswer}
      isSubmitting={stateRef.current.isSubmitting}
      singleQuestionMode={propsRef.current.singleQuestionMode}
      audioInputWorkerProps={getAudioInputWorkerProps()}
      onAnswerChange={(answerValue: SurveyQuestionsLegacyValue) => handleAnswer(surveyIndex, question.id, answerValue)}
      onDeferredRatingCommit={(committedRating: SurveyQuestionsLegacyValue) =>
        handleAnswer(surveyIndex, question.id, committedRating, {
          persistDraft: false,
          afterUpdate: flushDraftPersistAfterSliderChange,
        })
      }
      onRatingChange={(ratingAnswer: SurveyQuestionsLegacyValue, event: SurveyQuestionsLegacyValue) =>
        handleAnswer(surveyIndex, question.id, ratingAnswer, buildSliderPersistOptions(event))
      }
      onRatingChangeComplete={flushDraftPersistAfterSliderChange}
      onToggleAnswerEncryption={(newEncryptedState: SurveyQuestionsLegacyValue) =>
        toggleAnswerEncryption(surveyIndex, question.id, newEncryptedState)
      }
    />
  );

  const renderFullQuestionAdditionalInput = ({
    qIndex,
    surveyIndex,
    questionId,
    additional,
    glowAdditional,
  }: SurveyQuestionsLegacyValue) => (
    <SurveyAudioFieldInput
      qIndex={qIndex}
      {...getAudioInputWorkerProps()}
      placeholder={'related thoughts or URLs (optional)'}
      value={additional?.value || ''}
      encrypted={additional?.encrypted || false}
      dataTestId={E2E_TESTIDS.SURVEY_ADDITIONAL_INPUT}
      dataCeQuestionId={String(questionId || '')
        .trim()
        .toLowerCase()}
      disabled={stateRef.current.isSubmitting}
      forceGlow={glowAdditional}
      updateFunction={(additionalCommentsValue: SurveyQuestionsLegacyValue) =>
        handleAdditional(surveyIndex, questionId, additionalCommentsValue)
      }
      toggleEncryption={(newEncryptedState: SurveyQuestionsLegacyValue) =>
        toggleAdditionalCommentsEncryption(surveyIndex, questionId, newEncryptedState)
      }
    />
  );

  const parseEncryptedEnvelope = (field: SurveyQuestionsLegacyValue) =>
    (parseEncryptedEnvelopeHelper as SurveyQuestionsLegacyValue)(field);

  const getFieldDecryptState = ({ questionId, fieldKey, field }: SurveyQuestionsLegacyValue) =>
    (buildFieldDecryptStateHelper as SurveyQuestionsLegacyValue)(field, {
      loginComplete: propsRef.current.loginComplete,
      account: propsRef.current.account,
      busy: isQuestionFieldBusy(questionId, fieldKey),
    });

  const getQuestionFieldDisplayState = ({ questionId, answer, additional }: SurveyQuestionsLegacyValue) => {
    const answerDecryptState: SurveyQuestionsLegacyValue = getFieldDecryptState({
      questionId,
      fieldKey: 'answer',
      field: answer,
    });
    const additionalDecryptState: SurveyQuestionsLegacyValue = getFieldDecryptState({
      questionId,
      fieldKey: 'additional',
      field: additional,
    });
    return (buildQuestionFieldDisplayStateHelper as SurveyQuestionsLegacyValue)({
      answer,
      additional,
      answerDecryptState,
      additionalDecryptState,
      hasAdditionalContent: hasMeaningfulFieldValue(additional),
    });
  };

  const getQuestionResponseDisplayState = ({ questionId, responseSlice }: SurveyQuestionsLegacyValue) => {
    const slice: SurveyQuestionsLegacyValue = responseSlice || {};
    const answer: SurveyQuestionsLegacyValue = slice.answers?.[questionId] || buildEmptyResponseFieldState(questionId);
    const additional: SurveyQuestionsLegacyValue =
      slice.additionalComments?.[questionId] || buildEmptyResponseFieldState(questionId, 'additional');
    const convictionValue: SurveyQuestionsLegacyValue = getConvictionValueForSlice(slice, questionId);
    const importanceValue: SurveyQuestionsLegacyValue = getImportanceValueForSlice(slice, questionId);
    const hasConvictionImportanceValue: SurveyQuestionsLegacyValue = hasConvictionOrImportanceValueForQuestion(
      slice,
      questionId,
    );
    const sliderMode: SurveyQuestionsLegacyValue = ENABLE_IMPORTANCE_SLIDER_TOGGLE
      ? getSliderMode(questionId)
      : 'conviction';
    return (buildQuestionResponseDisplayStateHelper as SurveyQuestionsLegacyValue)({
      answer,
      additional,
      convictionValue,
      importanceValue,
      hasConvictionImportanceValue,
      sliderMode,
    });
  };

  const getQuestionRenderDisplayState = ({ questionId, responseSlice }: SurveyQuestionsLegacyValue) => {
    const responseDisplayState: SurveyQuestionsLegacyValue = getQuestionResponseDisplayState({
      questionId,
      responseSlice,
    });
    const fieldDisplayState: SurveyQuestionsLegacyValue = getQuestionFieldDisplayState({
      questionId,
      answer: responseDisplayState.answer,
      additional: responseDisplayState.additional,
    });

    return (buildQuestionRenderDisplayStateHelper as SurveyQuestionsLegacyValue)({
      responseDisplayState,
      fieldDisplayState,
    });
  };

  const isQuestionPromptMasked = (question: SurveyQuestionsLegacyValue): boolean =>
    isQuestionPromptMaskedHelper(question);

  const getQuestionPayloadDisplayState = (question: SurveyQuestionsLegacyValue) => {
    const slug: SurveyQuestionsLegacyValue = normalizeSessionSlugValue(
      question?.sessionSlug ||
        question?.sessionName ||
        inst._getEffectiveDraftSlug() ||
        resolveEffectiveSlug(propsRef.current),
    );
    const sessionConfig: SurveyQuestionsLegacyValue = slug
      ? resolveExplicitSessionContext(slug).sessionConfig || null
      : null;
    return resolveQuestionPayloadDisplayState(question, sessionConfig);
  };

  const getAnswerLockDisplayState = ({ field, masked }: SurveyQuestionsLegacyValue) =>
    buildAnswerLockDisplayState({
      field,
      masked,
      isSubmitting: stateRef.current.isSubmitting,
    });

  const getGatedPromptNoticeState = ({ question, tooltipIdSuffix, fallbackId = 'gated' }: SurveyQuestionsLegacyValue) =>
    buildGatedPromptNoticeState({
      questionId: question?.id,
      tooltipIdSuffix,
      fallbackId,
      gateNames: resolveGatedPromptGateNames(question),
      sbtLabel: t('sbt'),
      gateLabel: t('gate'),
      gatesLabel: t('gates'),
    });

  const renderGatedPromptNotice = ({ question, tooltipIdSuffix, fallbackId }: SurveyQuestionsLegacyValue) => {
    const { tooltipId, tooltipText }: SurveyQuestionsLegacyValue = getGatedPromptNoticeState({
      question,
      tooltipIdSuffix,
      fallbackId,
    });
    const qid: SurveyQuestionsLegacyValue = String(question?.id || '')
      .trim()
      .toLowerCase();
    const promptReloading: SurveyQuestionsLegacyValue = qid ? isQuestionFieldBusy(qid, 'prompt') : false;
    const canReloadPrompt: SurveyQuestionsLegacyValue = qid && isQuestionPromptMasked(question);
    const payloadDisplay: SurveyQuestionsLegacyValue = getQuestionPayloadDisplayState(question);
    const promptDisplay: SurveyQuestionsLegacyValue = buildQuestionPromptDecryptDisplayState({
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

  const renderFullQuestionGatedPromptCard = ({ cardKey, question, cardIcons }: SurveyQuestionsLegacyValue) =>
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
    });

  const renderQuestionMaskedPromptCard = ({ mode, question, cardKey, cardIcons }: SurveyQuestionsLegacyValue) =>
    mode === 'full'
      ? renderFullQuestionGatedPromptCard({
          cardKey,
          question,
          cardIcons,
        })
      : typeof engine.renderPileGatedPromptCard === 'function'
        ? engine.renderPileGatedPromptCard({ question })
        : null;

  const renderQuestionAnswerLockControl = ({
    surveyIndex,
    questionId,
    answer,
    glowAnswer,
    lockDisabled,
    lockTitle,
    visualContext,
  }: SurveyQuestionsLegacyValue) =>
    renderAnswerLockControl({
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
  }: SurveyQuestionsLegacyValue) =>
    renderAnswerLockControl({
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
  }: SurveyQuestionsLegacyValue) => {
    const { lockDisabled, lockTitle }: SurveyQuestionsLegacyValue = getAnswerLockDisplayState({
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
  }: SurveyQuestionsLegacyValue) => {
    return (
      <QuestionCardLinks
        showResponseLookupSpinner={showResponseLookupSpinner}
        isQuestionBookmarked={isQuestionBookmarked}
        onBookmarkToggle={() => handleBookmarkToggle(question.id)}
        arweaveHref={surveyResponseStoragePort.buildQuestionArweaveHref(question, {
          contextLabel: 'survey_tool_question_link',
        })}
        questionHref={
          question.id ? buildQuestionRoutePath(question.id, { sessionSlug: inst._getEffectiveDraftSlug() }) : ''
        }
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
  }: SurveyQuestionsLegacyValue) => {
    const displayState: SurveyQuestionsLegacyValue = (
      buildQuestionFieldDecryptControlDisplayStateHelper as SurveyQuestionsLegacyValue
    )({
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
      <QuestionDecryptControl {...displayState} onClick={() => handleDecryptQuestionAnswer(questionId, fieldKey)} />
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
  }: SurveyQuestionsLegacyValue) => (
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

  const areResponsesConsistent = (latest: SurveyQuestionsLegacyValue, surveyIndex: SurveyQuestionsLegacyValue) => {
    return areSurveyResponsesConsistent({
      latest,
      editBaseline: stateRef.current.editBaseline,
      renderedIds: getCurrentRenderedQuestionIds(),
      buildSliceFromUserAnswers: buildSliceFromUserAnswers,
      valuesEqual: valuesEqual,
    });
  };

  const getEditTrackingQuestionIds = (surveyIndexParam: SurveyQuestionsLegacyValue = null) => {
    const ids: SurveyQuestionsLegacyValue = new Set();
    const add: SurveyQuestionsLegacyValue = (rawId: SurveyQuestionsLegacyValue) => {
      const normalized: SurveyQuestionsLegacyValue = normalizeQuestionIdKey(rawId);
      if (normalized) ids.add(normalized);
    };
    const addSliceIds: SurveyQuestionsLegacyValue = (slice: SurveyQuestionsLegacyValue) => {
      if (!slice || typeof slice !== 'object') return;
      const addKeys: SurveyQuestionsLegacyValue = (map: SurveyQuestionsLegacyValue) => {
        if (!map || typeof map !== 'object') return;
        Object.keys(map).forEach((rawKey: SurveyQuestionsLegacyValue) => add(rawKey));
      };
      addKeys(slice.answers);
      addKeys(slice.additionalComments);
      addKeys(slice.importance);
      addKeys(slice.conviction);
    };
    try {
      const surveyIndex: SurveyQuestionsLegacyValue = getActiveSurveyIndex(surveyIndexParam);
      const currentSlice: SurveyQuestionsLegacyValue = stateRef.current?.surveysResponseState?.[surveyIndex] || null;
      addSliceIds(currentSlice);
      if (propsRef.current.singleQuestionMode && propsRef.current.questionID) {
        add(propsRef.current.questionID);
      }
      if (typeof getCurrentRenderedQuestionIds === 'function') {
        const renderedIds: SurveyQuestionsLegacyValue = getCurrentRenderedQuestionIds();
        if (Array.isArray(renderedIds)) renderedIds.forEach((id: SurveyQuestionsLegacyValue) => add(id));
      }
      if (ids.size > 0) return ids;

      if (Array.isArray(stateRef.current?.questionPool))
        stateRef.current.questionPool.forEach((q: SurveyQuestionsLegacyValue) => add(q?.id));
      if (Array.isArray(stateRef.current?.pileQuestions))
        stateRef.current.pileQuestions.forEach((q: SurveyQuestionsLegacyValue) => add(q?.id));
      if (Array.isArray(propsRef.current?.questionPool))
        propsRef.current.questionPool.forEach((q: SurveyQuestionsLegacyValue) => add(q?.id));
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    return ids;
  };

  const getIndexedQuestionEntryKeys = (source: SurveyQuestionsLegacyValue) => {
    if (!source || typeof source !== 'object') return null;
    try {
      const cached: SurveyQuestionsLegacyValue = inst._normalizedQuestionEntryKeyCache.get(source);
      if (cached) return cached;
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    const result: SurveyQuestionsLegacyValue = buildIndexedQuestionEntryKeys(source, normalizeQuestionIdKey);
    try {
      if (result) inst._normalizedQuestionEntryKeyCache.set(source, result);
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    return result;
  };

  const getChangedQidsAndFields = (surveyIndexParam: SurveyQuestionsLegacyValue) =>
    measureSync('ce.surveyQuestions.getChangedQidsAndFields', () => {
      const surveyIndex: SurveyQuestionsLegacyValue = getActiveSurveyIndex(surveyIndexParam);
      const currentSlice: SurveyQuestionsLegacyValue = (stateRef.current.surveysResponseState &&
        stateRef.current.surveysResponseState[surveyIndex]) || {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      };
      const scopedIds: SurveyQuestionsLegacyValue = getEditTrackingQuestionIds(surveyIndex);
      const { result, newCache }: SurveyQuestionsLegacyValue = orchestrateGetChangedQidsAndFields(
        {
          surveyIndex,
          currentSlice,
          isLoggedIn: !!(propsRef.current.account && propsRef.current.loginComplete),
          isLoadingResponse: !!stateRef.current.isLoadingResponse,
          scopedIds,
          userAnswers: stateRef.current.userAnswers,
        },
        {
          resolveDiffBaselineSlice: (allowLocalCache: SurveyQuestionsLegacyValue) =>
            resolveDiffBaselineSlice(allowLocalCache),
          getIndexedQuestionEntryKeys: (source: SurveyQuestionsLegacyValue) => getIndexedQuestionEntryKeys(source),
          getDefaultResponseEncryptionAudience: () => getDefaultResponseEncryptionAudience(),
          normalizeResponseEncryptionAudience: (
            audience: SurveyQuestionsLegacyValue,
            qid: SurveyQuestionsLegacyValue,
          ) => normalizeResponseEncryptionAudience(audience, qid),
          getDefaultResponseEncryptionAudienceForQid: (qid: SurveyQuestionsLegacyValue) =>
            getDefaultResponseEncryptionAudienceForQid(qid),
          resolveFieldEncryptionGateId: (
            field: SurveyQuestionsLegacyValue,
            qid: SurveyQuestionsLegacyValue,
            fieldKey: SurveyQuestionsLegacyValue,
          ) => resolveFieldEncryptionGateId(field, qid, fieldKey),
          normalizeFieldAudienceMode: (
            mode: SurveyQuestionsLegacyValue,
            fieldKey: SurveyQuestionsLegacyValue,
            field: SurveyQuestionsLegacyValue,
          ) => normalizeFieldAudienceMode(mode, fieldKey, field),
          valuesEqual: valuesEqual,
          buildSurveyResponseSliceSignature,
          buildRatingEnvelopeQidSetFromUserAnswers,
          hasMeaningfulFieldValue: hasMeaningfulFieldValue as SurveyQuestionsLegacyValue,
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

  const getDraftKey = () => {
    try {
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;
      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
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
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;

      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
      const accountLower: SurveyQuestionsLegacyValue = (propsRef.current?.account || '').toLowerCase();
      const {
        primaryAnonKey: anonKey,
        primaryAccountKey: acctKey,
        compatAnonKey: anonCompatKey,
        compatAccountKey: acctCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAnonKey: anonPerQidKey,
        perQuestionAccountKey: acctPerQidKey,
      }: SurveyQuestionsLegacyValue = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: propsRef.current.questionID,
        includePerQuestionScope: !!propsRef.current.singleQuestionMode,
      });

      const readAndParse: SurveyQuestionsLegacyValue = (key: SurveyQuestionsLegacyValue) => {
        if (!key) return null;
        try {
          const raw: SurveyQuestionsLegacyValue = sessionStorage.getItem(key);
          if (!raw) return null;
          const parsedResult: SurveyQuestionsLegacyValue = parsePersistedDraftStorageValue({ raw });
          if (parsedResult.status !== 'valid') {
            try {
              sessionStorage.removeItem(key);
            } catch (e: any) {
              surveyLog.warn('SurveyTool: fallback', e);
            }
            return null;
          }
          return { raw: parsedResult.raw, obj: parsedResult.payload };
        } catch (_: any) {
          return null;
        }
      };
      const pend: SurveyQuestionsLegacyValue = readAndParse(pendingKey);
      const perQidAnon: SurveyQuestionsLegacyValue = anonPerQidKey ? readAndParse(anonPerQidKey) : null;
      const perQidAcct: SurveyQuestionsLegacyValue = acctPerQidKey ? readAndParse(acctPerQidKey) : null;
      const rawDraftByKey: SurveyQuestionsLegacyValue = new Map([
        ...(pend ? [[pendingKey, pend]] : []),
        ...(perQidAnon ? [[anonPerQidKey, perQidAnon]] : []),
        ...(perQidAcct ? [[acctPerQidKey, perQidAcct]] : []),
      ] as SurveyQuestionsLegacyValue);
      const loadPlan: SurveyQuestionsLegacyValue = buildSurveyDraftLoadPlan({
        hasAccount: !!accountLower,
        primaryAccountKey: acctKey,
        primaryAnonKey: anonKey,
        compatAccountKey: acctCompatKey,
        compatAnonKey: anonCompatKey,
        pendingAccountKey: pendingKey,
        perQuestionAccountKey: acctPerQidKey,
        perQuestionAnonKey: anonPerQidKey,
      });

      const draftHits: SurveyQuestionsLegacyValue = [];
      for (const step of loadPlan) {
        const hit: SurveyQuestionsLegacyValue = rawDraftByKey.get(step.readKey) || readAndParse(step.readKey);
        if (!hit) continue;
        draftHits.push({ ...step, ...hit });
      }

      if (draftHits.length === 0) return null;

      const mergedDraft: SurveyQuestionsLegacyValue = mergePersistedDraftPayloads({
        drafts: draftHits.map((hit: SurveyQuestionsLegacyValue) => hit.obj),
      });
      if (!mergedDraft) return null;

      const targetKey: SurveyQuestionsLegacyValue = accountLower ? acctKey : anonKey;
      const mergedRaw: SurveyQuestionsLegacyValue = JSON.stringify(mergedDraft);
      const targetHit: SurveyQuestionsLegacyValue = draftHits.find(
        (hit: SurveyQuestionsLegacyValue) => hit.readKey === targetKey,
      );
      const shouldWriteTarget: SurveyQuestionsLegacyValue =
        !!targetKey &&
        (!targetHit ||
          targetHit.raw !== mergedRaw ||
          draftHits.some((hit: SurveyQuestionsLegacyValue) => hit.readKey !== targetKey || hit.writeKey));

      let wroteTarget: SurveyQuestionsLegacyValue = !shouldWriteTarget;
      if (shouldWriteTarget) {
        try {
          sessionStorage.setItem(targetKey, mergedRaw);
          wroteTarget = true;
        } catch (e: any) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
      }

      if (wroteTarget && targetKey) {
        draftHits.forEach((hit: SurveyQuestionsLegacyValue) => {
          if (!hit.readKey || hit.readKey === targetKey) return;
          try {
            sessionStorage.removeItem(hit.readKey);
          } catch (e: any) {
            surveyLog.warn('SurveyTool: fallback', e);
          }
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

  const persistDraftSafely = (delayMs: SurveyQuestionsLegacyValue = 150) => {
    if (inst._persistTimer) clearTimeout(inst._persistTimer);
    inst._persistTimer = setTimeout(persistDraft, delayMs);
  };

  const persistDraft = () =>
    measureSync('ce.surveyQuestions.persistDraft', () => {
      try {
        const key: SurveyQuestionsLegacyValue = getDraftKey();

        // Guard null key and clean up malformed JSON
        if (!key) return;
        const keyTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingOnKeyChange({
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
        }: SurveyQuestionsLegacyValue = loadPreviousPersistedDraftSnapshot(
          {
            key,
            lastDraftKey: inst._lastDraftKey,
            lastDraftJSON: inst._lastDraftJSON,
            lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
            draftParseCache: inst._draftParseCache,
          },
          {
            readDraftRaw: (draftKey: SurveyQuestionsLegacyValue) => sessionStorage.getItem(draftKey) || '',
            removeDraftRaw: (draftKey: SurveyQuestionsLegacyValue) => sessionStorage.removeItem(draftKey),
            buildSemanticSignature: buildSurveyDraftSemanticSignature,
          },
        );
        const loadTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterLoad({
          lastDraftKey: inst._lastDraftKey,
          lastDraftJSON: inst._lastDraftJSON,
          lastDraftSemanticSignature: inst._lastDraftSemanticSignature,
          draftParseCache: inst._draftParseCache,
          nextDraftParseCache,
          shouldResetDraftTracking,
        });
        inst._applyDraftTrackingState(loadTracking);

        const surveyIndex: SurveyQuestionsLegacyValue =
          propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
        const slice: SurveyQuestionsLegacyValue = (stateRef.current.surveysResponseState &&
          stateRef.current.surveysResponseState[surveyIndex]) || {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        };

        // Only persist rendered (or all if none rendered)
        const renderedIds: SurveyQuestionsLegacyValue = getHydrationQuestionIds();
        const dirtyQids: SurveyQuestionsLegacyValue = inst._draftDirtyQids ? [...inst._draftDirtyQids] : [];
        const allowed: SurveyQuestionsLegacyValue = buildPersistDraftAllowedQuestionIds({
          renderedQuestionIds: renderedIds,
          dirtyQuestionIds: dirtyQids,
          slice,
        });

        const baselineSlice: SurveyQuestionsLegacyValue = stateRef.current.editBaseline || {
          answers: {},
          importance: {},
          conviction: {},
          additionalComments: {},
        };
        // Start from previous draft answers/baseline so non-rendered QIDs survive,
        // then overwrite only the currently allowed question set.
        const { answersObj, baselineObj }: SurveyQuestionsLegacyValue = buildPersistedDraftMapsForAllowedIds({
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

        const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
          propsRef.current,
          inst._getEffectiveDraftSlug(),
        );
        const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
        const persistWritePlan: SurveyQuestionsLegacyValue = buildPersistedDraftWritePlan({
          draftKey: key,
          sessionSlug: slug,
          networkIdStr: draftContext.networkIdStr,
          account: propsRef.current?.account,
          surveyScope: inst._getDraftScope(),
          singleQuestionMode: propsRef.current.singleQuestionMode,
        });
        const payload: SurveyQuestionsLegacyValue = buildPersistedDraftPayload({
          draftContext,
          singleQuestionMode: propsRef.current.singleQuestionMode,
          questionId: propsRef.current.questionID,
          surveyId: propsRef.current.surveyId,
          answersObj,
          // Keep baseline in storage; prefill/merge logic depends on it to avoid false dirty diffs.
          baselineObj,
        });

        const nextSemanticSignature: SurveyQuestionsLegacyValue = buildSurveyDraftSemanticSignature(payload);
        if (nextSemanticSignature && nextSemanticSignature === prevSemanticSignature) {
          inst._lastDraftJSON = prevDraftRaw || inst._lastDraftJSON;
          inst._lastDraftSemanticSignature = nextSemanticSignature;
          if (inst._draftDirtyQids) inst._draftDirtyQids.clear();
          return;
        }

        const nextJson: SurveyQuestionsLegacyValue = JSON.stringify(payload);
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
          } catch (e: any) {
            surveyLog.warn('SurveyTool: fallback', e);
          }
        }

        const writeTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterWrite({
          key,
          raw: nextJson,
          payload,
          semanticSignature: nextSemanticSignature,
        });
        inst._applyDraftTrackingState(writeTracking);
        if (inst._draftDirtyQids) inst._draftDirtyQids.clear();

        persistWritePlan.staleAnonKeys.forEach((draftKey: SurveyQuestionsLegacyValue) => {
          try {
            sessionStorage.removeItem(draftKey);
          } catch (e: any) {
            surveyLog.warn('SurveyTool: fallback', e);
          }
        });
      } catch (e: any) {
        surveyLog.warn('SurveyTool: fallback', e);
      }
    });

  const clearDraft = () => {
    try {
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;

      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
      const accountLower: SurveyQuestionsLegacyValue = (propsRef.current?.account || '').toLowerCase() || 'anon';
      const { purgeKeys }: SurveyQuestionsLegacyValue = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
      });

      purgeKeys.forEach((k: any) => {
        try {
          sessionStorage.removeItem(k);
        } catch (e: any) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
      });

      const clearedTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingClearedState();
      inst._applyDraftTrackingState(clearedTracking);
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
  };

  const clearDraftFor = (qid: SurveyQuestionsLegacyValue) => {
    try {
      const draftContext: SurveyQuestionsLegacyValue = resolveDraftStorageContext(
        propsRef.current,
        inst._getEffectiveDraftSlug(),
      );
      const slug: SurveyQuestionsLegacyValue = draftContext.sessionSlug || '';
      const networkIdStr: SurveyQuestionsLegacyValue = draftContext.networkIdStr;

      const surveyScope: SurveyQuestionsLegacyValue = inst._getDraftScope();
      const accountLower: SurveyQuestionsLegacyValue = (propsRef.current?.account || '').toLowerCase() || 'anon';
      const qidLower: SurveyQuestionsLegacyValue = (qid || '').toLowerCase();
      const { purgeKeys }: SurveyQuestionsLegacyValue = buildSurveyDraftStorageVariantKeys({
        sessionSlug: slug,
        networkIdStr,
        account: accountLower,
        surveyScope,
        questionId: qidLower,
        includePerQuestionScope: !!propsRef.current.singleQuestionMode,
      });

      purgeKeys.forEach((key: SurveyQuestionsLegacyValue) => {
        try {
          const raw: SurveyQuestionsLegacyValue = sessionStorage.getItem(key);
          if (!raw) return;
          const removalPlan: SurveyQuestionsLegacyValue = buildPersistedDraftQuestionRemovalPlan({
            raw,
            questionId: qidLower,
            buildSemanticSignature: buildSurveyDraftSemanticSignature,
          });
          if (removalPlan.action === 'delete-storage') {
            try {
              sessionStorage.removeItem(key);
            } catch (e: any) {
              surveyLog.warn('SurveyTool: fallback', e);
            }
            const deleteTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterScopedDelete({
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
            const writeTracking: SurveyQuestionsLegacyValue = buildPersistedDraftTrackingAfterWrite({
              key,
              raw: removalPlan.nextJson,
              payload: removalPlan.nextPayload,
              semanticSignature: removalPlan.nextSemanticSignature,
            });
            inst._applyDraftTrackingState(writeTracking);
          }
        } catch (e: any) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
      });
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
  };

  const getCurrentRenderedQuestionIds = () => {
    const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
    if (typeof runtimeStrategy?.getCurrentRenderedQuestionIds === 'function') {
      return runtimeStrategy.getCurrentRenderedQuestionIds(engine);
    }
    const questionPool: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current?.questionPool)
      ? stateRef.current.questionPool
      : [];
    const pileQuestions: SurveyQuestionsLegacyValue = Array.isArray(stateRef.current?.pileQuestions)
      ? stateRef.current.pileQuestions
      : [];
    const singleQuestionMode: SurveyQuestionsLegacyValue = !!propsRef.current.singleQuestionMode;
    const questionId: SurveyQuestionsLegacyValue = String(propsRef.current.questionID || '');
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

    let renderedIds: SurveyQuestionsLegacyValue = [];
    try {
      renderedIds = buildRenderedQuestionIdsFromQuestionPools({
        questionPool,
        pileQuestions,
      });
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
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

  const buildLocalCacheHydrationSignature = (
    surveyIndex: SurveyQuestionsLegacyValue,
    renderedIds: SurveyQuestionsLegacyValue = [],
  ) => {
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
        resolveResponseHydrationContext: (rawSlug: SurveyQuestionsLegacyValue) =>
          resolveResponseHydrationContext(propsRef.current, rawSlug),
        normalizeSessionSlugValue,
        getExtraScopeSlugs: (slug: SurveyQuestionsLegacyValue) => getExtraQuestionReadSlugs(propsRef.current, slug),
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

  const resolveQuestionSlugMapForIds = (
    questionIds: SurveyQuestionsLegacyValue = [],
    opts: SurveyQuestionsLegacyValue = {},
  ) => {
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

  const resolveSubmissionGroupContext = ({
    questionIds = [],
    surveyId = null,
    fallbackSlug = null,
  }: SurveyQuestionsLegacyValue = {}) => {
    return buildSubmissionGroupContext({
      questionIds,
      slugByQuestionId: resolveQuestionSlugMapForIds(questionIds, { surveyId }),
      fallbackSlug: fallbackSlug != null ? fallbackSlug : resolveEffectiveSlug(propsRef.current),
      normalizeSlug: normalizeSessionSlugValue,
    });
  };

  const getMissingRenderedResponseIdsForAccount = async (opts: SurveyQuestionsLegacyValue = {}) => {
    const fallbackSlug: SurveyQuestionsLegacyValue = resolveEffectiveSlug(propsRef.current);
    return resolveSurveyMissingRenderedResponseLookup({
      props: propsRef.current,
      responder: opts?.responder || propsRef.current.account,
      slug: opts?.slug ?? inst._getEffectiveDraftSlug() ?? fallbackSlug,
      fallbackSlug,
      renderedIds: getRenderedQuestionIdsForResponseHydration(),
      resolveResponseHydrationContext: (nextSlug: SurveyQuestionsLegacyValue) =>
        resolveResponseHydrationContext(propsRef.current, nextSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug: SurveyQuestionsLegacyValue) =>
        propsRef.current?.minifiedMode === 'pile' ? getExtraQuestionReadSlugs(propsRef.current, slug) : [],
      resolveQuestionSlugMapForIds: (questionIds: SurveyQuestionsLegacyValue, context: SurveyQuestionsLegacyValue) =>
        resolveQuestionSlugMapForIds(questionIds, { surveyId: context?.surveyId || null }),
      resolveScopeNetId: (
        resolvedSlug: SurveyQuestionsLegacyValue,
        entryNetId: SurveyQuestionsLegacyValue,
        fallbackNetId: SurveyQuestionsLegacyValue,
      ) => {
        const resolvedContext: SurveyQuestionsLegacyValue = resolveResponseHydrationContext(
          propsRef.current,
          normalizeSessionSlugValue(resolvedSlug),
        );
        return resolvedContext.networkIdStr || entryNetId || fallbackNetId;
      },
      readQuestionsCacheAsync,
      ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
    });
  };

  const ensurePriorResponsesForRenderedIds = async (opts: SurveyQuestionsLegacyValue = {}) => {
    return executeSurveyPriorResponseBackfill({
      props: propsRef.current,
      state: stateRef.current,
      slug: opts?.slug,
      attemptedSet: inst._priorResponseBackfillAttempted,
      getMissingRenderedResponseIdsForAccount: ({ responder, slug: nextSlug }: SurveyQuestionsLegacyValue) =>
        getMissingRenderedResponseIdsForAccount({
          responder,
          slug: nextSlug,
        }),
      setHydratingState: (active: SurveyQuestionsLegacyValue) => setState(buildHydratingPriorResponsesState(active)),
      isMounted: inst._isMounted,
      readQuestionsCacheAsync,
      resetLocalCacheMemo: () => {
        // Force the immediate follow-up pass to read the freshly written cache
        // even before parent cache nonces propagate down as props.
        inst._localCacheSliceMemo = { key: '', value: null, hasValue: false };
        inst._rehydrateLocalCacheLastSig = '';
      },
      triggerRehydrate: () => rehydrateLocalCacheAnswersForRenderedIds(),
      onFailure: (error: SurveyQuestionsLegacyValue) => {
        surveyLog.warn('[SurveyQuestions] Prior-response backfill failed:', error);
      },
      getCurrentInFlight: () => inst._priorResponseBackfillInFlight,
      setCurrentInFlight: (value: SurveyQuestionsLegacyValue) => {
        inst._priorResponseBackfillInFlight = value;
      },
    });
  };

  const rehydrateDraftForRenderedIds = (forceOverwriteOrOptions: SurveyQuestionsLegacyValue = false) => {
    const hasOptions: SurveyQuestionsLegacyValue =
      forceOverwriteOrOptions && typeof forceOverwriteOrOptions === 'object' && !Array.isArray(forceOverwriteOrOptions);
    const options: SurveyQuestionsLegacyValue = hasOptions ? forceOverwriteOrOptions : {};
    const forceOverwrite: SurveyQuestionsLegacyValue = hasOptions
      ? !!options.forceOverwrite
      : !!forceOverwriteOrOptions;
    const setStateForHydration: SurveyQuestionsLegacyValue = options.responseHydrationOwned
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
      onError: (error: SurveyQuestionsLegacyValue) => {
        surveyLog.warn('SurveyTool: fallback', error);
      },
      buildDraftRunPlan: (args: SurveyQuestionsLegacyValue) =>
        buildDraftHydrationRunPlan({
          ...args,
          forceOverwrite,
        }),
    });
  };

  const resetFormStateForAccountChange = (callback: SurveyQuestionsLegacyValue) => {
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
      onPersistError: (error: SurveyQuestionsLegacyValue) => {
        surveyLog.warn('SurveyTool: fallback', error);
      },
      onCleanupError: (error: SurveyQuestionsLegacyValue) => {
        surveyLog.warn('SurveyTool: cleanup', error);
      },
    });
  };

  const deepClone = (obj: SurveyQuestionsLegacyValue) => {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch {
      return obj;
    }
  };

  const valuesEqual = (a: SurveyQuestionsLegacyValue, b: SurveyQuestionsLegacyValue) => {
    // Normalize empties
    const norm: SurveyQuestionsLegacyValue = (v: SurveyQuestionsLegacyValue) =>
      v === undefined || v === '' ? null : v;

    // Arrays: compare order-sensitive (checkbox order is stable)
    if (Array.isArray(a) || Array.isArray(b)) {
      const aa: SurveyQuestionsLegacyValue = Array.isArray(a) ? a : [];
      const bb: SurveyQuestionsLegacyValue = Array.isArray(b) ? b : [];
      if (aa.length !== bb.length) return false;
      return JSON.stringify(aa) === JSON.stringify(bb);
    }

    // Numbers vs strings: compare numerically if either is a number-like
    const an: SurveyQuestionsLegacyValue = Number(a);
    const bn: SurveyQuestionsLegacyValue = Number(b);
    const aNumLike: SurveyQuestionsLegacyValue = !Number.isNaN(an) && a !== null && a !== '' && typeof a !== 'object';
    const bNumLike: SurveyQuestionsLegacyValue = !Number.isNaN(bn) && b !== null && b !== '' && typeof b !== 'object';
    if (aNumLike || bNumLike) return Number(a) === Number(b);

    return String(norm(a)) === String(norm(b));
  };

  const computeModifiedQuestionsCount = (
    baselineSlice: SurveyQuestionsLegacyValue,
    currentSlice: SurveyQuestionsLegacyValue,
  ) => {
    if (!baselineSlice || !currentSlice) return 0;

    const addNormalizedIds: SurveyQuestionsLegacyValue = (
      idsSet: SurveyQuestionsLegacyValue,
      source: SurveyQuestionsLegacyValue,
    ) => {
      Object.keys(source || {}).forEach((rawKey: SurveyQuestionsLegacyValue) => {
        const normalized: SurveyQuestionsLegacyValue = normalizeQuestionIdKey(rawKey);
        if (normalized) idsSet.add(normalized);
      });
    };
    const pickField: SurveyQuestionsLegacyValue = (
      source: SurveyQuestionsLegacyValue,
      qid: SurveyQuestionsLegacyValue,
    ) => {
      if (!source || typeof source !== 'object') return {};
      if (source[qid] && typeof source[qid] === 'object') return source[qid];
      const rawKey: SurveyQuestionsLegacyValue = Object.keys(source).find(
        (k: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(k) === qid,
      );
      return rawKey && source[rawKey] && typeof source[rawKey] === 'object' ? source[rawKey] : {};
    };
    const pickNumber: SurveyQuestionsLegacyValue = (
      source: SurveyQuestionsLegacyValue,
      qid: SurveyQuestionsLegacyValue,
    ) => {
      if (!source || typeof source !== 'object') return null;
      if (Object.prototype.hasOwnProperty.call(source, qid)) {
        const n: SurveyQuestionsLegacyValue = Number(source[qid]);
        return Number.isFinite(n) ? n : null;
      }
      const rawKey: SurveyQuestionsLegacyValue = Object.keys(source).find(
        (k: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(k) === qid,
      );
      if (!rawKey) return null;
      const n: SurveyQuestionsLegacyValue = Number(source[rawKey]);
      return Number.isFinite(n) ? n : null;
    };

    const idsFromSlices: SurveyQuestionsLegacyValue = new Set();
    addNormalizedIds(idsFromSlices, baselineSlice.answers);
    addNormalizedIds(idsFromSlices, currentSlice.answers);
    addNormalizedIds(idsFromSlices, baselineSlice.additionalComments);
    addNormalizedIds(idsFromSlices, currentSlice.additionalComments);
    addNormalizedIds(idsFromSlices, baselineSlice.importance);
    addNormalizedIds(idsFromSlices, currentSlice.importance);
    addNormalizedIds(idsFromSlices, baselineSlice.conviction);
    addNormalizedIds(idsFromSlices, currentSlice.conviction);

    const scopedIds: SurveyQuestionsLegacyValue = getEditTrackingQuestionIds();
    const ids: SurveyQuestionsLegacyValue = scopedIds.size > 0 ? new Set(scopedIds) : idsFromSlices;

    let count: SurveyQuestionsLegacyValue = 0;
    ids.forEach((qId: SurveyQuestionsLegacyValue) => {
      const bAns: SurveyQuestionsLegacyValue = pickField(baselineSlice.answers, qId);
      const cAns: SurveyQuestionsLegacyValue = pickField(currentSlice.answers, qId);
      const bAdd: SurveyQuestionsLegacyValue = pickField(baselineSlice.additionalComments, qId);
      const cAdd: SurveyQuestionsLegacyValue = pickField(currentSlice.additionalComments, qId);
      const bImp: SurveyQuestionsLegacyValue = pickNumber(baselineSlice.importance, qId);
      const cImp: SurveyQuestionsLegacyValue = pickNumber(currentSlice.importance, qId);
      const bConv: SurveyQuestionsLegacyValue = pickNumber(baselineSlice.conviction, qId);
      const cConv: SurveyQuestionsLegacyValue = pickNumber(currentSlice.conviction, qId);

      let changed: SurveyQuestionsLegacyValue = false;
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
      onFailure: (error: SurveyQuestionsLegacyValue) => {
        surveyLog.warn('[SurveyQuestions] handleRevertPendingChanges failed:', error);
      },
    });
  };

  const buildSliceFromUserAnswers = (
    userAnswers: SurveyQuestionsLegacyValue,
    prevSlice: SurveyQuestionsLegacyValue = null,
  ) =>
    buildHydratedResponseSlice({
      userAnswers,
      prevSlice,
      applyResponseHydrationListToSlice: inst._applyResponseHydrationListToSlice,
      parseValue: (value: SurveyQuestionsLegacyValue) => {
        try {
          if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
            return JSON.parse(value);
          }
        } catch (e: any) {
          surveyLog.warn('SurveyTool: fallback', e);
        }
        return value;
      },
    });

  const resolveDiffBaselineSlice = (allowLocalCache: SurveyQuestionsLegacyValue = false) => {
    const { baselineSlice, nextUserAnswersSliceCache }: SurveyQuestionsLegacyValue = resolveSurveyBaselineSourceSlice({
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

  const prefillSurveyResponses = (
    userAnswers: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex || 0;
    const setStateForPrefill: SurveyQuestionsLegacyValue = options?.responseHydrationOwned
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
    const slice: SurveyQuestionsLegacyValue = buildSurveyLocalCacheSlice({
      props: propsRef.current,
      rawSlug: inst._getEffectiveDraftSlug(),
      renderedIds: getCurrentRenderedQuestionIds(),
      localCacheSliceMemo: inst._localCacheSliceMemo,
      resolveResponseHydrationContext: (rawSlug: SurveyQuestionsLegacyValue) =>
        resolveResponseHydrationContext(propsRef.current, rawSlug),
      normalizeSessionSlugValue,
      getExtraScopeSlugs: (slug: SurveyQuestionsLegacyValue) => getExtraQuestionReadSlugs(propsRef.current, slug),
      readQuestionsCache,
      mergeQuestionResponses,
      parseResponse: (raw: SurveyQuestionsLegacyValue) => {
        let resp: SurveyQuestionsLegacyValue = raw;
        try {
          if (typeof resp === 'string') {
            resp = JSON.parse(resp);
          }
        } catch {
          resp = null;
        }
        return resp;
      },
      applyCachedResponseEntryToSlice: inst._applyCachedResponseEntryToSlice,
      setLocalCacheMemo: (nextMemo: SurveyQuestionsLegacyValue) => {
        inst._localCacheSliceMemo = nextMemo;
      },
      onError: (error: SurveyQuestionsLegacyValue) => {
        DEBUG_PREFILL && surveyLog.error('[Survey][buildSlice] Error:', error);
      },
    });
    if (slice) {
      DEBUG_PREFILL &&
        surveyLog.log('[Survey][buildSlice] Building for rendered IDs:', getCurrentRenderedQuestionIds());
    }
    return slice;
  };

  const rehydrateLocalCacheAnswersForRenderedIds = async (
    callback: SurveyQuestionsLegacyValue = null,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    let finalCallback: SurveyQuestionsLegacyValue = callback;
    let finalOptions: SurveyQuestionsLegacyValue = options;
    if (callback && typeof callback === 'object' && !Array.isArray(callback)) {
      finalOptions = callback;
      finalCallback = null;
    }
    const setStateForLocalCache: SurveyQuestionsLegacyValue = finalOptions?.responseHydrationOwned
      ? setResponseHydrationState.bind(engine)
      : setState.bind(engine);
    const runId: SurveyQuestionsLegacyValue = (Number(inst._localCacheRehydrateRunId) || 0) + 1;
    inst._localCacheRehydrateRunId = runId;
    const isStaleRun: SurveyQuestionsLegacyValue = () =>
      (inst._hasMounted && !inst._isMounted) || inst._localCacheRehydrateRunId !== runId;
    await executeSurveyLocalCacheRehydrate({
      props: propsRef.current,
      state: stateRef.current,
      lastHydrationSig: inst._rehydrateLocalCacheLastSig,
      getHydrationQuestionIds: () => getHydrationQuestionIds(),
      buildHydrationSignature: (idx: SurveyQuestionsLegacyValue, ids: SurveyQuestionsLegacyValue) =>
        buildLocalCacheHydrationSignature(idx, ids),
      buildSliceFromLocalCache: () => buildSliceFromLocalCache(),
      setLastHydrationSig: (value: SurveyQuestionsLegacyValue) => {
        inst._rehydrateLocalCacheLastSig = value;
      },
      loadDraft: () => loadDraft(),
      buildDraftAnswersByQuestionId,
      cloneBaseline: deepClone,
      buildDraftAwareCacheHydrationState: (args: SurveyQuestionsLegacyValue) =>
        buildDraftAwareCacheHydrationState({
          ...args,
          areEnvelopesEquivalent,
        }),
      applyLocalCacheHydrationEntryToSlice: inst._applyLocalCacheHydrationEntryToSlice,
      setState: setStateForLocalCache,
      updateJsonPreview: updateJsonPreview,
      recalculateEditStats: recalculateEditStats,
      ensurePriorResponses: () => {
        void ensurePriorResponsesForRenderedIds();
      },
      callback: finalCallback,
      bumpNoop: () => bumpSurveyPerfCounter('noopSkipCount'),
      onNoChange: () => {
        DEBUG_PREFILL && surveyLog.log('[Survey][rehydrateLocal] No changes to apply.');
      },
      onError: (error: SurveyQuestionsLegacyValue) => {
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

  const getLatestQuestionResponse = async (
    responder: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    networkID: SurveyQuestionsLegacyValue,
    questionsCache: SurveyQuestionsLegacyValue,
  ) => {
    const slug: SurveyQuestionsLegacyValue = inst._getEffectiveDraftSlug();
    const strNet: SurveyQuestionsLegacyValue = String(networkID || '');

    let latest: SurveyQuestionsLegacyValue = null;
    try {
      latest = await surveyQuestionReadsPort.getResponse(propsRef.current.provider, responder, questionId, slug);
      if (latest) {
        const addrLower: SurveyQuestionsLegacyValue = String(responder || '').toLowerCase();

        // Re-read after await to avoid overwriting concurrent cache writes.
        let freshCache: SurveyQuestionsLegacyValue = ensureQuestionsNet(await readQuestionsCacheAsync(slug), strNet);

        // ensure scaffolding
        freshCache[strNet] = freshCache[strNet] || {};
        freshCache[strNet].questionResponses = freshCache[strNet].questionResponses || {};
        freshCache[strNet].questionResponses[questionId] = freshCache[strNet].questionResponses[questionId] || {};
        freshCache[strNet].questionResponsesMeta = freshCache[strNet].questionResponsesMeta || {};
        freshCache[strNet].questionResponsesMeta[questionId] =
          freshCache[strNet].questionResponsesMeta[questionId] || {};

        // Recency guard (only replace if strictly newer by (bn, li))
        const prev: SurveyQuestionsLegacyValue = freshCache[strNet].questionResponsesMeta[questionId][addrLower] || {
          bn: 0,
          li: 0,
        };
        const bn: SurveyQuestionsLegacyValue = latest?.blockNumber ?? 0;
        const li: SurveyQuestionsLegacyValue = latest?.logIndex ?? 0;
        const isStale: SurveyQuestionsLegacyValue = bn < prev.bn || (bn === prev.bn && li <= prev.li);
        if (!isStale) {
          freshCache[strNet].questionResponses[questionId][addrLower] = latest;
          freshCache[strNet].questionResponsesMeta[questionId][addrLower] = { bn, li };
          await writeQuestionsCache(slug, freshCache);
        }
        return latest;
      }
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }

    return latest;
  };

  const getLatestSurveyResponse = async (
    responder: SurveyQuestionsLegacyValue,
    surveyId: SurveyQuestionsLegacyValue,
  ) => {
    try {
      const latest: SurveyQuestionsLegacyValue = await getSurveyResponse(responder, surveyId);
      return latest || null;
    } catch (e: any) {
      return null;
    }
  };

  const loadBookmarks = async () => {
    try {
      const slug: SurveyQuestionsLegacyValue = resolveEffectiveSlug(propsRef.current);
      let obj: SurveyQuestionsLegacyValue = peekCacheSync('bookmarksCache', slug);
      if (obj == null) {
        obj = await readCache('bookmarksCache', slug);
      }
      if (!obj || typeof obj !== 'object') {
        setState(buildBookmarkedQuestionsState());
        return;
      }
      const list: SurveyQuestionsLegacyValue = Array.isArray(obj?.questions) ? obj.questions : [];
      setState(buildBookmarkedQuestionsState(list));
    } catch (error: any) {
      surveyLog.error('[SurveyQuestions] Error reading bookmarksCache:', error);
      setState(buildBookmarkedQuestionsState());
    }
  };

  const handleBookmarkToggle = (questionId: SurveyQuestionsLegacyValue) => {
    if (!questionId) return;

    const slug: SurveyQuestionsLegacyValue = resolveEffectiveSlug(propsRef.current);
    let obj: SurveyQuestionsLegacyValue = peekCacheSync('bookmarksCache', slug);
    if (!obj || typeof obj !== 'object') obj = {};

    if (typeof obj !== 'object' || obj === null) obj = {};
    if (!Array.isArray(obj.questions)) obj.questions = [];

    const set: SurveyQuestionsLegacyValue = new Set(obj.questions.map(String));
    const q: SurveyQuestionsLegacyValue = String(questionId);
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
    const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
    if (typeof runtimeStrategy?.getAnsweredQuestionsCount === 'function') {
      return runtimeStrategy.getAnsweredQuestionsCount(engine);
    }
    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex || 0;

    if (!stateRef.current.surveysResponseState || !stateRef.current.surveysResponseState[surveyIndex]) {
      return 0;
    }

    const currentSlice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState[surveyIndex] || {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };

    // Prefer explicit session baseline; else derive from last saved answers; else derive from local cache; else empty
    const baselineSlice: SurveyQuestionsLegacyValue = resolveDiffBaselineSlice(true);

    // Compute how many questions actually changed vs. the baseline
    return computeModifiedQuestionsCount(baselineSlice, currentSlice);
  };

  const recalculateEditStats = (pendingStatsOverride: SurveyQuestionsLegacyValue = null) => {
    try {
      const stats: SurveyQuestionsLegacyValue = (pendingStatsOverride && typeof pendingStatsOverride === 'object'
        ? pendingStatsOverride
        : null) ||
        (typeof getPendingEditStats === 'function' && getPendingEditStats()) || {
          total: stateRef.current.modifiedCount || 0,
          encrypted: stateRef.current.encryptedModifiedCount || 0,
        };
      const modifiedCount: SurveyQuestionsLegacyValue = Number(stats.total || 0);
      const encryptedModifiedCount: SurveyQuestionsLegacyValue = Number(stats.encrypted || 0);

      const hasEncryptedChanges: SurveyQuestionsLegacyValue = encryptedModifiedCount > 0;
      const isDirty: SurveyQuestionsLegacyValue = modifiedCount > 0;

      const shouldResetSubmitted: SurveyQuestionsLegacyValue = stateRef.current.submissionComplete && modifiedCount > 0;
      const shouldRelatchSubmitted: SurveyQuestionsLegacyValue =
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
        setState(
          buildEditStatsState({
            modifiedCount,
            encryptedModifiedCount,
            hasEncryptedChanges,
            isDirty,
            shouldResetSubmitted,
            shouldRelatchSubmitted,
          }),
        );
      }
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
  };

  const initializeSurveyResponseState = () => {
    const questionPoolIds: SurveyQuestionsLegacyValue = Array.isArray(propsRef.current.questionPool)
      ? propsRef.current.questionPool.map((question: SurveyQuestionsLegacyValue) => question.id)
      : [];
    const renderedQuestionIds: SurveyQuestionsLegacyValue = buildInitialSurveyResponseQuestionIds({
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
    if (
      shouldSurveyAutoStartFresh({
        props: propsRef.current,
        state: stateRef.current,
        getRenderedQuestionIds: () =>
          readRenderedQuestionIds({
            getRenderedQuestionIds: () => getCurrentRenderedQuestionIds(),
          }),
      })
    ) {
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

  const showTransientSubmitFeedback = (
    message: SurveyQuestionsLegacyValue = '',
    durationMs: SurveyQuestionsLegacyValue = 2000,
  ) => {
    const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
    if (typeof runtimeStrategy?.showTransientSubmitFeedback === 'function') {
      return runtimeStrategy.showTransientSubmitFeedback(engine, message, durationMs);
    }
    if (inst._emptySubmitTimer) {
      clearTimeout(inst._emptySubmitTimer);
      inst._emptySubmitTimer = null;
    }
    const update: SurveyQuestionsLegacyValue = buildTransientSubmitFeedbackState({
      message,
    });
    setState(update);
    if (!update.submissionError) return;
    inst._emptySubmitTimer = setTimeout(() => {
      if (!inst._isMounted) return;
      const clearUpdate: SurveyQuestionsLegacyValue = buildClearedTransientSubmitFeedbackState();
      setState(clearUpdate);
      inst._emptySubmitTimer = null;
    }, normalizeTransientSubmitFeedbackDurationMs(durationMs));
  };

  const maybeBlockSubmitUntilQuestionPoolComplete = () => {
    const { isIncomplete, pendingCount }: SurveyQuestionsLegacyValue = getSurveyQuestionPoolLoadState();
    if (!isIncomplete) return false;

    showTransientSubmitFeedback(
      buildQuestionPoolPendingSubmitFeedbackMessage({
        pendingCount,
      }),
    );
    void fetchQuestionPool().catch((error: any) => {
      surveyLog.warn('SurveyQuestions: submit-triggered question pool refresh failed.', error);
    });
    return true;
  };

  async function fetchQuestionPool() {
    if (propsRef.current.isStandalone || propsRef.current.singleQuestionMode) return;
    const runId: SurveyQuestionsLegacyValue = (Number(inst._questionPoolHydrationRunId) || 0) + 1;
    inst._questionPoolHydrationRunId = runId;
    const isStaleQuestionPoolRun: SurveyQuestionsLegacyValue = () =>
      !inst._isMounted || inst._questionPoolHydrationRunId !== runId;
    const setQuestionPoolState: SurveyQuestionsLegacyValue = (...args: SurveyQuestionsLegacyValue[]) => {
      if (!isStaleQuestionPoolRun()) {
        setState(...args);
      }
    };
    if (!propsRef.current.surveyId) {
      surveyLog.warn('SurveyQuestions: fetchQuestionPool – no surveyID supplied');
      setQuestionPoolState(buildClearedSurveyQuestionPoolState());
      return;
    }

    // Prefer ID-aware resolver for /survey/:id routes (no /session/:slug)
    const slug: SurveyQuestionsLegacyValue = propsRef.current.surveyId
      ? resolveSlugForIds({
          surveyId: propsRef.current.surveyId,
          props: propsRef.current,
          network: propsRef.current.network,
        })
      : resolveEffectiveSlug(propsRef.current);
    const questionReadContext: SurveyQuestionsLegacyValue = resolveQuestionReadCacheContext(propsRef.current, slug);
    let effectiveSlug: SurveyQuestionsLegacyValue = questionReadContext.sessionSlug || slug;
    const netIdStr: SurveyQuestionsLegacyValue = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error('SurveyQuestions: fetchQuestionPool – network.id undefined');
      setQuestionPoolState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const surveyIdLower: SurveyQuestionsLegacyValue = propsRef.current.surveyId.toLowerCase();

    // surveys cache via safe reader (already purges)
    let surveysCache: SurveyQuestionsLegacyValue = readSurveysCache(effectiveSlug);
    if (!surveysCache || typeof surveysCache !== 'object') surveysCache = {};
    const surveysNet: SurveyQuestionsLegacyValue = surveysCache[netIdStr] || {
      surveysLatestBlock: 0,
      surveys: {},
      surveyResponses: {},
      surveyResponsesLatestBlock: {},
    };
    let surveyDataFromCache: SurveyQuestionsLegacyValue = surveysNet.surveys?.[surveyIdLower];

    let surveyData: SurveyQuestionsLegacyValue = null;
    if (
      propsRef.current.surveys &&
      propsRef.current.surveyIndex !== null &&
      propsRef.current.surveys[propsRef.current.surveyIndex]
    ) {
      const surveyFromProp: SurveyQuestionsLegacyValue = propsRef.current.surveys[propsRef.current.surveyIndex];
      if (surveyFromProp.id && surveyFromProp.id.toLowerCase() === surveyIdLower) {
        surveyData = surveyFromProp;
      }
    }
    if (!surveyData) {
      surveyData = surveyDataFromCache;
    }

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
    let temporaryDemoFixtureSlug: SurveyQuestionsLegacyValue = '';
    let temporaryDemoFixtureQuestions: SurveyQuestionsLegacyValue[] = [];
    for (const candidateSlug of temporaryDemoSlugCandidates) {
      const candidateQuestions = getTemporaryDemoSessionQuestionFixtures(candidateSlug, temporaryDemoSessionConfig);
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
        netIdStr,
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
        sessionName:
          surveyData?.sessionName || surveyDataFromCache?.sessionName || propsRef.current.sessionName || effectiveSlug,
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
        surveyData = await surveyQuestionReadsPort.getSurveyDataById(
          propsRef.current.provider,
          surveyIdLower,
          effectiveSlug,
        );
        if (isStaleQuestionPoolRun()) return;
        if (surveyData) {
          if (!Array.isArray(surveyData.questionIDs)) surveyData.questionIDs = [];
          surveyData.surveyID = surveyIdLower;
          surveyData.id = surveyIdLower;

          let currentGlobalSurveysCache: SurveyQuestionsLegacyValue = readSurveysCache(effectiveSlug);
          if (!currentGlobalSurveysCache || typeof currentGlobalSurveysCache !== 'object') {
            currentGlobalSurveysCache = {};
          }
          if (!currentGlobalSurveysCache[netIdStr]) {
            currentGlobalSurveysCache[netIdStr] = {
              surveys: {},
              surveysLatestBlock: 0,
              surveyResponses: {},
              surveyResponsesLatestBlock: {},
            };
          }
          if (!currentGlobalSurveysCache[netIdStr].surveys) {
            currentGlobalSurveysCache[netIdStr].surveys = {};
          }
          currentGlobalSurveysCache[netIdStr].surveys[surveyIdLower] = surveyData;
          await writeSurveysCache(effectiveSlug, currentGlobalSurveysCache);
        }
      } catch (e: any) {
        surveyLog.error('SurveyQuestions: failed to fetch survey from chain:', e);
        surveyData = null;
      }
    }

    if (!surveyData || !Array.isArray(surveyData.questionIDs) || surveyData.questionIDs.length === 0) {
      surveyLog.warn(`SurveyQuestions: survey ${surveyIdLower} still has no questionIDs – aborting pool build`);
      setQuestionPoolState(buildClearedSurveyQuestionPoolState());
      return;
    }

    const blockedQuestionIds: SurveyQuestionsLegacyValue = getBlockedQuestionIdsSet(effectiveSlug);
    const expectedQuestionIds: SurveyQuestionsLegacyValue = surveyData.questionIDs
      .map((qid: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(qid))
      .filter((qid: SurveyQuestionsLegacyValue) => qid && !blockedQuestionIds.has(qid));

    if (shouldUseTemporaryDemoQuestionPool) {
      const fixtureQuestionById = new Map();
      temporaryDemoFixtureQuestions.forEach((question) => {
        const qid = normalizeQuestionIdKey(question?.id);
        if (!qid || fixtureQuestionById.has(qid)) return;
        fixtureQuestionById.set(qid, { ...question, id: qid });
      });
      const questionPool = expectedQuestionIds
        .map((qid: SurveyQuestionsLegacyValue) => fixtureQuestionById.get(qid))
        .filter(Boolean);
      setQuestionPoolState({
        questionPool,
        questionPoolExpectedIds: expectedQuestionIds,
        questionPoolPendingIds: expectedQuestionIds.filter(
          (qid: SurveyQuestionsLegacyValue) => !fixtureQuestionById.has(qid),
        ),
      });
      return;
    }

    let lastPublishedQuestionPoolSnapshotSig = '';
    const publishQuestionPoolFromCache = ({ warnMissing = false } = {}) => {
      return publishSurveyQuestionPoolIfCurrent({
        isStaleRun: isStaleQuestionPoolRun,
        warnMissing,
        publishQuestionPool: ({ warnMissing: shouldWarnMissing }: SurveyQuestionsLegacyValue = {}) => {
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
              if (shouldWarnMissing) {
                surveyLog.warn(
                  `SurveyQuestions: Question data for ID ${qid} not found in cache after ensureQuestionCached.`,
                );
              }
              return null;
            })
            .filter(Boolean);
          const loadedQuestionIds = new Set(
            questionPool
              .map((question: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(question?.id))
              .filter(Boolean),
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
          setQuestionPoolState((prev: SurveyQuestionsLegacyValue) => {
            const prevQuestionPool = Array.isArray(prev?.questionPool) ? prev.questionPool : [];
            const prevExpectedQuestionIds = Array.isArray(prev?.questionPoolExpectedIds)
              ? prev.questionPoolExpectedIds
              : [];
            const prevPendingQuestionIds = Array.isArray(prev?.questionPoolPendingIds)
              ? prev.questionPoolPendingIds
              : [];
            const prevQuestionPoolById = new Map();
            prevQuestionPool.forEach((entry: SurveyQuestionsLegacyValue) => {
              const key = normalizeQuestionIdKey(entry?.id);
              if (!key || prevQuestionPoolById.has(key)) return;
              prevQuestionPoolById.set(key, entry);
            });

            const mergedQuestionPool = questionPool.map((entry: SurveyQuestionsLegacyValue) => {
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
              prevExpectedQuestionIds.every(
                (qid: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) =>
                  qid === expectedQuestionIds[index],
              );
            const pendingIdsUnchanged =
              prevPendingQuestionIds.length === pendingQuestionIds.length &&
              prevPendingQuestionIds.every(
                (qid: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) =>
                  qid === pendingQuestionIds[index],
              );
            if (prevQuestionPoolSig === nextQuestionPoolSig) {
              const hasSemanticChange =
                prevQuestionPool.length !== mergedQuestionPool.length ||
                prevQuestionPool.some(
                  (entry: SurveyQuestionsLegacyValue, idx: SurveyQuestionsLegacyValue) =>
                    entry !== mergedQuestionPool[idx],
                );
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
        },
      });
    };

    publishQuestionPoolFromCache();

    // Pass sessionName context to ensureQuestionCached so it knows where to look.
    // Publish after each settled hydration so a survey can render as soon as the
    // first question metadata lands instead of waiting for the full batch.
    const cacheHydrationResults: SurveyQuestionsLegacyValue = await Promise.allSettled(
      surveyData.questionIDs.map(async (qid: SurveyQuestionsLegacyValue) => {
        try {
          await propsRef.current.ensureQuestionCached(qid, { sessionName: surveyData.sessionName });
          return qid;
        } finally {
          publishQuestionPoolFromCache();
        }
      }),
    );
    const failedQuestionHydrations: SurveyQuestionsLegacyValue = cacheHydrationResults.filter(
      (result: SurveyQuestionsLegacyValue) => result.status === 'rejected',
    );
    if (failedQuestionHydrations.length > 0) {
      surveyLog.warn(
        `SurveyQuestions: ${failedQuestionHydrations.length} question cache hydration request(s) failed for survey ${surveyIdLower}.`,
        failedQuestionHydrations.map(
          (result: SurveyQuestionsLegacyValue) => result.reason?.message || result.reason || 'unknown error',
        ),
      );
    }
    publishQuestionPoolFromCache({ warnMissing: true });
  }

  const loadQuestionFromCache = async (questionId: SurveyQuestionsLegacyValue) => {
    const slug: SurveyQuestionsLegacyValue = resolveEffectiveSlug(propsRef.current);
    const questionReadContext: SurveyQuestionsLegacyValue = resolveQuestionReadCacheContext(propsRef.current, slug);
    const effectiveSlug: SurveyQuestionsLegacyValue = questionReadContext.sessionSlug || slug;
    const netIdStr: SurveyQuestionsLegacyValue = questionReadContext.networkIdStr;
    if (!netIdStr) {
      surveyLog.error('SurveyQuestions: Network ID undefined in loadQuestionFromCache');
      return null;
    }
    let questionsCache: SurveyQuestionsLegacyValue = readQuestionsCache(effectiveSlug) || {};
    if (!questionsCache[netIdStr] || !questionsCache[netIdStr].questions) return null;
    const qIdLower: SurveyQuestionsLegacyValue = questionId.toLowerCase();
    return questionsCache[netIdStr].questions[qIdLower] || null;
  };

  const mergeSurveyResponseState = (
    currentState: SurveyQuestionsLegacyValue,
    newQuestionPool: SurveyQuestionsLegacyValue,
    surveyIndex: SurveyQuestionsLegacyValue = 0,
  ) => {
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
    const runId: SurveyQuestionsLegacyValue = Number(inst._fetchSurveyResponseRunId || 0) + 1;
    inst._fetchSurveyResponseRunId = runId;
    const isStale: SurveyQuestionsLegacyValue = () => !inst._isMounted || inst._fetchSurveyResponseRunId !== runId;
    const safe: SurveyQuestionsLegacyValue = (...args: SurveyQuestionsLegacyValue[]) => {
      if (!isStale()) (setResponseHydrationState as SurveyQuestionsLegacyValue)(...args);
    };

    safe(buildSurveyResponseFetchLoadingState());

    // 1. View Mode (Address lookup) - Unaffected by submission state
    if (propsRef.current.displayAnswerMode && propsRef.current.viewAddress) {
      try {
        const viewAnswers: SurveyQuestionsLegacyValue = await getLatestSurveyResponse(
          propsRef.current.viewAddress,
          propsRef.current.surveyId,
        );
        if (isStale()) return;
        if (viewAnswers) {
          safe((prev: SurveyQuestionsLegacyValue) =>
            buildViewedSurveyResponseState(
              prev,
              viewAnswers,
              mergeDecryptedViewedResponse as SurveyQuestionsLegacyValue,
            ),
          );
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
        const userAnswers: SurveyQuestionsLegacyValue = await getLatestSurveyResponse(
          propsRef.current.account,
          propsRef.current.surveyId,
        );
        if (isStale()) return;

        // Consistency check logic
        if (stateRef.current.submissionComplete) {
          const surveyIndex: SurveyQuestionsLegacyValue =
            propsRef.current.isStandalone || propsRef.current.singleQuestionMode
              ? 0
              : propsRef.current.surveyIndex || 0;
          surveyLog.log('Comparing incoming chain data vs optimistic baseline');

          // Only switch off optimistic mode if chain data matches our submitted baseline
          if (userAnswers && areResponsesConsistent(userAnswers, surveyIndex)) {
            surveyLog.log('Result: New. Chain data consistent with submission. Exiting optimistic mode.');
            const hasEncrypted: SurveyQuestionsLegacyValue = userAnswers.responses?.some(
              (r: SurveyQuestionsLegacyValue) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion,
            );
            safe(
              buildUserSurveyResponseFoundState({
                hasEncrypted,
                resetSubmissionComplete: true,
                userAnswers,
              }),
            );
            // We do NOT call prefillSurveyResponses here to avoid rebuilding baseline unnecessarily
          } else {
            // Chain is stale or null. Keep optimistic state.
            surveyLog.log('Result: Stale. Chain data older than optimistic baseline. Ignoring fetch.');
          }
        }
        // Normal Path (Not in optimistic mode)
        else if (userAnswers) {
          const hasEncrypted: SurveyQuestionsLegacyValue = userAnswers.responses?.some(
            (r: SurveyQuestionsLegacyValue) => !!r?.answer?.encryptedPortion || !!r?.additional?.encryptedPortion,
          );
          safe(
            buildUserSurveyResponseFoundState({
              hasEncrypted,
              userAnswers,
            }),
          );
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

  const prefillSingleQuestionResponse = (userAnswer: SurveyQuestionsLegacyValue) => {
    const questionId: SurveyQuestionsLegacyValue = normalizeQuestionIdKey(propsRef.current.questionID);

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

  const parseAnswerValue = (value: SurveyQuestionsLegacyValue) => {
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

  async function fetchSingleQuestionData(opts: SurveyQuestionsLegacyValue = {}) {
    const runId: SurveyQuestionsLegacyValue = (Number(inst._fetchSingleQuestionRunId) || 0) + 1;
    inst._fetchSingleQuestionRunId = runId;
    const isStaleRun: SurveyQuestionsLegacyValue = () => !inst._isMounted || inst._fetchSingleQuestionRunId !== runId;
    const safeSetState: SurveyQuestionsLegacyValue = (...args: SurveyQuestionsLegacyValue[]) => {
      if (!isStaleRun()) (setResponseHydrationState as SurveyQuestionsLegacyValue)(...args);
    };
    const bootstrapRetryAttempt: SurveyQuestionsLegacyValue = Number(opts?.bootstrapRetryAttempt || 0);
    const configuredFetchTimeoutMs: SurveyQuestionsLegacyValue = Number(opts?.questionFetchTimeoutMs);
    const fetchTimeoutMs: SurveyQuestionsLegacyValue =
      Number.isFinite(configuredFetchTimeoutMs) && configuredFetchTimeoutMs > 0
        ? Math.max(3000, configuredFetchTimeoutMs)
        : 8000;
    const configuredFetchRecoveryMs: SurveyQuestionsLegacyValue = Number(opts?.questionFetchTimeoutRecoveryMs);
    const fetchTimeoutRecoveryMs: SurveyQuestionsLegacyValue =
      Number.isFinite(configuredFetchRecoveryMs) && configuredFetchRecoveryMs > 0
        ? Math.max(fetchTimeoutMs, configuredFetchRecoveryMs)
        : Math.max(fetchTimeoutMs, 20000);
    const maxCandidateSlugs: SurveyQuestionsLegacyValue = Math.max(2, Number(opts?.maxCandidateSlugs || 8));

    const sourceContextPlan: SurveyQuestionsLegacyValue = buildSingleQuestionSourceRestoreContextPlan({
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
    const questionId: SurveyQuestionsLegacyValue = sourceContextPlan.questionId;
    const preserveCurrentSingleQuestionPool: SurveyQuestionsLegacyValue = (
      extraState: SurveyQuestionsLegacyValue = {},
    ) => {
      const plan: SurveyQuestionsLegacyValue = buildSingleQuestionPreservedPoolState({
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

    let effectiveSingleSlug: SurveyQuestionsLegacyValue = sourceContextPlan.effectiveSingleSlug;
    const fetchCandidateSlugs: SurveyQuestionsLegacyValue = sourceContextPlan.fetchCandidateSlugs;
    const hasPendingRetryForQuestion: SurveyQuestionsLegacyValue = sourceContextPlan.hasPendingRetryForQuestion;

    if (sourceContextPlan.status === 'blocked-question') {
      updateSingleQuestionDebug(sourceContextPlan.debugPayload);
      surveyLog.warn(`SurveyQuestions: Question ${questionId} is blocked; skipping.`);
      safeSetState(sourceContextPlan.statePatch);
      return;
    }

    const responderAddress: SurveyQuestionsLegacyValue = propsRef.current.responderAddress;

    const getCacheStateForSlug: SurveyQuestionsLegacyValue = async (slug: SurveyQuestionsLegacyValue) =>
      resolveSingleQuestionCacheState({
        slug,
        questionId,
        resolveQuestionBootstrapContext: (nextSlug: SurveyQuestionsLegacyValue) =>
          resolveQuestionBootstrapContext(propsRef.current, nextSlug),
        readQuestionsCacheAsync,
        ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
      });

    const cacheBootstrapResult: SurveyQuestionsLegacyValue = await resolveSingleQuestionCacheBootstrap({
      questionId,
      effectiveSingleSlug,
      responderAddress: String(responderAddress || ''),
      account: String(propsRef.current.account || ''),
      resolveCacheState: getCacheStateForSlug,
      readRecentPayload: readRecentQuestionPayload,
      canUseRecentPayload: canUseRecentQuestionPayloadForAccount,
      resolveBootstrapNetworkId: (slug: SurveyQuestionsLegacyValue) =>
        resolveQuestionBootstrapContext(propsRef.current, slug).networkIdStr || '',
      updateCacheAtomic,
      ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
      pickBetterQuestionPayload: pickBetterQuestionPayload as SurveyQuestionsLegacyValue,
      areQuestionPayloadsEquivalent,
      writeQuestionsCache: writeQuestionsCache as SurveyQuestionsLegacyValue,
    });
    if (isStaleRun()) return;

    const cacheBootstrapPlan: SurveyQuestionsLegacyValue = resolveSingleQuestionCacheBootstrapFlowPlan({
      cacheBootstrapResult,
    });
    if (cacheBootstrapPlan.seededHydration) {
      const { questionData: seededQData, isLoadingResponse }: SurveyQuestionsLegacyValue =
        cacheBootstrapPlan.seededHydration;
      setResponseHydrationState(
        (prev: SurveyQuestionsLegacyValue) =>
          buildSingleQuestionSeededHydrationState({
            prevState: prev,
            questionData: seededQData,
            isLoadingResponse,
            mergeSurveyResponseState: mergeSurveyResponseState,
          }),
        () => {
          updateJsonPreview();
          rehydrateDraftForRenderedIds({ responseHydrationOwned: true });
        },
      );
    }
    if (isStaleRun()) return;

    if (cacheBootstrapPlan.action === 'stop') {
      const stopPlanContext: SurveyQuestionsLegacyValue = {
        bootstrapRetryAttempt,
        cacheBootstrapPlan,
        effectiveSingleSlug: cacheBootstrapResult.target.effectiveSingleSlug,
        questionId: cacheBootstrapResult.target.questionId,
        responderAddress: cacheBootstrapResult.target.responderAddress,
        runId,
      };
      const stopHandlingPlan: SurveyQuestionsLegacyValue =
        resolveSingleQuestionCacheBootstrapStopHandlingPlan(stopPlanContext);
      if (stopHandlingPlan.action === 'retry') {
        const didScheduleRetry: SurveyQuestionsLegacyValue = scheduleSingleQuestionBootstrapRetry(
          stopHandlingPlan.retryRequest,
        );
        const retryOutcome: SurveyQuestionsLegacyValue = (
          resolveSingleQuestionCacheBootstrapStopHandlingPlan({
            ...stopPlanContext,
            didScheduleRetry,
          } as SurveyQuestionsLegacyValue) as SurveyQuestionsLegacyValue
        ).retryOutcome;
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

    let qData: SurveyQuestionsLegacyValue = cacheBootstrapPlan.questionData;
    let cacheState: SurveyQuestionsLegacyValue = cacheBootstrapPlan.cacheState;
    let { netIdStr, questionsCache }: SurveyQuestionsLegacyValue = cacheState;
    const recentPayloadForAccount: SurveyQuestionsLegacyValue = cacheBootstrapPlan.recentPayloadForAccount;

    const metadataBootstrapResult: SurveyQuestionsLegacyValue = await resolveSingleQuestionMetadataBootstrap({
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
      fetchSingleQuestionMetadataCandidates: (args: SurveyQuestionsLegacyValue) =>
        fetchSingleQuestionMetadataCandidates({
          ...args,
          getQuestionData: (candidateSlug: SurveyQuestionsLegacyValue) =>
            surveyQuestionReadsPort.getQuestionData(
              propsRef.current.provider,
              questionId,
              candidateSlug,
              buildAutomaticQuestionMetadataFetchOptions(candidateSlug),
            ),
        }),
      pickBetterQuestionPayload: pickBetterQuestionPayload as SurveyQuestionsLegacyValue,
      areQuestionPayloadsEquivalent,
      normalizeSingleQuestionMetadataForCache,
      resolveCacheState: getCacheStateForSlug,
      writeQuestionsCache: writeQuestionsCache as SurveyQuestionsLegacyValue,
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
        `SurveyQuestions: No question data for ${questionId} (slug='${metadataBootstrapResult.effectiveSingleSlug}').`,
      );
      const didScheduleRetry: SurveyQuestionsLegacyValue = scheduleSingleQuestionBootstrapRetry({
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
      const placeholderQuestion: SurveyQuestionsLegacyValue = buildSingleQuestionEncryptedMetadataPlaceholder({
        questionId,
        sessionSlug: metadataBootstrapResult.effectiveSingleSlug || effectiveSingleSlug,
        existingQuestionData: qData || recentPayloadForAccount || null,
      });
      if (placeholderQuestion) {
        safeSetState((prev: SurveyQuestionsLegacyValue) =>
          buildSingleQuestionPlaceholderHydrationState(prev, {
            mergeSurveyResponseState: mergeSurveyResponseState,
            placeholderQuestion,
          }),
        );
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
      (prev: SurveyQuestionsLegacyValue) =>
        buildSingleQuestionReadyHydrationState(prev, {
          mergeSurveyResponseState: mergeSurveyResponseState,
          questionData: qData,
        }),
      async () => {
        if (isStaleRun()) return;
        const writeRespToCache: SurveyQuestionsLegacyValue = async (
          responder: SurveyQuestionsLegacyValue,
          respObj: SurveyQuestionsLegacyValue,
        ) =>
          writeSingleQuestionResponseToCache({
            responder,
            respObj,
            questionId,
            effectiveSingleSlug,
            netIdStr,
            readQuestionsCacheAsync,
            ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
            writeQuestionsCache: writeQuestionsCache as SurveyQuestionsLegacyValue,
          });

        const readCachedResponderResponse: SurveyQuestionsLegacyValue = (responder: SurveyQuestionsLegacyValue) =>
          readSingleQuestionCachedResponderResponse({
            responder,
            questionId,
            netIdStr,
            questionsCache,
            cloneValue: deepClone,
          });

        const readFreshCachedResponderResponse: SurveyQuestionsLegacyValue = async (
          responder: SurveyQuestionsLegacyValue,
        ) =>
          readFreshSingleQuestionCachedResponderResponse({
            responder,
            questionId,
            netIdStr,
            effectiveSingleSlug,
            readQuestionsCacheAsync,
            ensureQuestionsNet: ensureQuestionsNet as SurveyQuestionsLegacyValue,
            cloneValue: deepClone,
            updateQuestionsCache: (nextCache: SurveyQuestionsLegacyValue) => {
              questionsCache = nextCache;
            },
          });

        // Fetch latest response for the appropriate address, scoped to engine slug
        if (responderAddress) {
          const viewedBootstrapResult: SurveyQuestionsLegacyValue = await executeViewedSingleQuestionResponseBootstrap({
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
            mergeViewedResponse: mergeDecryptedViewedResponse as SurveyQuestionsLegacyValue,
            scheduleRetry: scheduleSingleQuestionBootstrapRetry,
            clearRetry: clearSingleQuestionBootstrapRetry,
            getResponse: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
              forceArweaveFetch = false,
            }: SurveyQuestionsLegacyValue) =>
              surveyQuestionReadsPort.getResponse(provider, nextResponderAddress, nextQuestionId, nextSingleSlug, {
                forceArweaveFetch,
              }),
            getResponseHash: ({
              provider,
              responderAddress: nextResponderAddress,
              questionId: nextQuestionId,
              effectiveSingleSlug: nextSingleSlug,
            }: SurveyQuestionsLegacyValue) =>
              surveyQuestionReadsPort.getResponseHash(provider, nextResponderAddress, nextQuestionId, nextSingleSlug),
            writeResponseToCache: writeRespToCache,
            readCachedResponderResponse,
            readFreshCachedResponderResponse,
            prefillSingleQuestionResponse: prefillSingleQuestionResponse,
          });
          if (
            viewedBootstrapResult?.reason === 'stale' ||
            viewedBootstrapResult?.reason === 'retrying' ||
            viewedBootstrapResult?.reason === 'malformed'
          ) {
            return;
          }
        } else {
          const ownBootstrapResult: SurveyQuestionsLegacyValue = await executeOwnSingleQuestionResponseBootstrap({
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
            }: SurveyQuestionsLegacyValue) =>
              surveyQuestionReadsPort.getResponse(provider, nextResponderAddress, nextQuestionId, nextSingleSlug),
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
      },
    );
  }

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

  const handleAnswer = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    answer: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: SurveyQuestionsLegacyValue = options?.persistDraft !== false;
    const afterUpdate: SurveyQuestionsLegacyValue =
      typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;

    const sourceSlice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState?.[surveyIndex] || {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const plan: SurveyQuestionsLegacyValue = buildAnswerUpdatePlan(questionId, answer, sourceSlice, {
      buildEmptyResponseFieldState: ((qid: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
        buildEmptyResponseFieldState(qid, fk)) as SurveyQuestionsLegacyValue,
      resolveFieldEncryptionAudience: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: SurveyQuestionsLegacyValue) => getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (
        val: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
        f: SurveyQuestionsLegacyValue,
      ) => normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: ((
        af: SurveyQuestionsLegacyValue,
        ansf: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
      ) => buildInheritedAdditionalFieldState(af, ansf, qid)) as SurveyQuestionsLegacyValue,
      valuesEqual: (a: SurveyQuestionsLegacyValue, b: SurveyQuestionsLegacyValue) => valuesEqual(a, b),
      getQuestionById: (qid: SurveyQuestionsLegacyValue) => getQuestionById(qid),
      computeHash: (value: SurveyQuestionsLegacyValue) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: SurveyQuestionsLegacyValue = [...(stateRef.current.surveysResponseState || [])];
    const slice: SurveyQuestionsLegacyValue = { ...sourceSlice };
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

    setState(
      buildSurveyUserEditResponseStatePatch(
        newSurveysResponseState,
        updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit'),
      ),
      () => {
        scheduleJsonPreviewUpdate();
        if (shouldPersistDraft) persistDraftSafely();
        if (afterUpdate) afterUpdate();
      },
    );
  };

  const handleAdditional = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    additionalComments: SurveyQuestionsLegacyValue,
  ) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;

    const sourceSlice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState?.[surveyIndex] || {
      answers: {},
      importance: {},
      conviction: {},
      additionalComments: {},
    };
    const plan: SurveyQuestionsLegacyValue = buildAdditionalUpdatePlan(questionId, additionalComments, sourceSlice, {
      buildEmptyResponseFieldState: ((qid: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
        buildEmptyResponseFieldState(qid, fk)) as SurveyQuestionsLegacyValue,
      resolveFieldEncryptionAudience: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(field, qid, fk),
      resolveFieldEncryptionGateId: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(field, qid, fk),
      isQuestionLockedForResponse: (qid: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(qid),
      getEffectiveRecipientsForQid: (qid: SurveyQuestionsLegacyValue) => getEffectiveRecipientsForQid(qid),
      normalizeFieldAudienceMode: (
        val: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
        f: SurveyQuestionsLegacyValue,
      ) => normalizeFieldAudienceMode(val, fk, f),
      buildInheritedAdditionalFieldState: ((
        af: SurveyQuestionsLegacyValue,
        ansf: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
      ) => buildInheritedAdditionalFieldState(af, ansf, qid)) as SurveyQuestionsLegacyValue,
      valuesEqual: (a: SurveyQuestionsLegacyValue, b: SurveyQuestionsLegacyValue) => valuesEqual(a, b),
      getQuestionById: (qid: SurveyQuestionsLegacyValue) => getQuestionById(qid),
      computeHash: (value: SurveyQuestionsLegacyValue) => utils.keccak256(utils.toUtf8Bytes(value)),
    });
    if (!plan.changed) {
      return;
    }

    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: SurveyQuestionsLegacyValue = [...(stateRef.current.surveysResponseState || [])];
    const slice: SurveyQuestionsLegacyValue = { ...sourceSlice };
    slice.additionalComments = {
      ...(slice.additionalComments || {}),
      [questionId]: plan.nextAdditionalState,
    };

    newSurveysResponseState[surveyIndex] = slice;

    setState(
      buildSurveyUserEditResponseStatePatch(
        newSurveysResponseState,
        updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit'),
      ),
      () => {
        scheduleJsonPreviewUpdate();
        persistDraftSafely();
      },
    );
  };

  const handleConviction = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    conviction: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: SurveyQuestionsLegacyValue = options?.persistDraft !== false;
    const afterUpdate: SurveyQuestionsLegacyValue =
      typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue: SurveyQuestionsLegacyValue =
      stateRef.current.surveysResponseState?.[surveyIndex]?.conviction?.[questionId];
    if (priorValue === conviction) return;
    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
    const slice: SurveyQuestionsLegacyValue = {
      ...(newSurveysResponseState[surveyIndex] || {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }),
    };
    slice.conviction = { ...(slice.conviction || {}), [questionId]: conviction };
    newSurveysResponseState[surveyIndex] = slice;

    setState(
      buildSurveyUserEditResponseStatePatch(
        newSurveysResponseState,
        updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit'),
      ),
      () => {
        scheduleJsonPreviewUpdate();
        if (shouldPersistDraft) persistDraftSafely();
        if (afterUpdate) afterUpdate();
      },
    );
  };

  const handleImportance = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    importance: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    questionId = normalizeQuestionIdKey(questionId);
    if (!questionId) return;
    const shouldPersistDraft: SurveyQuestionsLegacyValue = options?.persistDraft !== false;
    const afterUpdate: SurveyQuestionsLegacyValue =
      typeof options?.afterUpdate === 'function' ? options.afterUpdate : null;
    const priorValue: SurveyQuestionsLegacyValue =
      stateRef.current.surveysResponseState?.[surveyIndex]?.importance?.[questionId];
    if (priorValue === importance) return;
    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    const newSurveysResponseState: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
    const slice: SurveyQuestionsLegacyValue = {
      ...(newSurveysResponseState[surveyIndex] || {
        answers: {},
        importance: {},
        conviction: {},
        additionalComments: {},
      }),
    };
    slice.importance = { ...(slice.importance || {}), [questionId]: importance };
    newSurveysResponseState[surveyIndex] = slice;

    setState(
      buildSurveyUserEditResponseStatePatch(
        newSurveysResponseState,
        updateSubmittedSinceLastEdit(stateRef.current.submittedSinceLastEdit, 'user_edit'),
      ),
      () => {
        scheduleJsonPreviewUpdate();
        if (shouldPersistDraft) persistDraftSafely();
        if (afterUpdate) afterUpdate();
      },
    );
  };

  const toggleAnswerEncryption = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    newEncryptedState: SurveyQuestionsLegacyValue,
  ) => {
    const idx: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex || 0;
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) =>
        buildAnswerEncryptionToggleResponseState(prev, {
          buildEncryptionTogglePlan: buildEncryptionTogglePlan as SurveyQuestionsLegacyValue,
          deps: {
            isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
            buildEmptyResponseFieldState: (q: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
              buildEmptyResponseFieldState(q, fk),
            resolveFieldEncryptionAudience: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionAudience(f, q, fk),
            resolveFieldEncryptionGateId: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionGateId(f, q, fk),
            normalizeFieldAudienceMode: (
              v: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
              f: SurveyQuestionsLegacyValue,
            ) => normalizeFieldAudienceMode(v, fk, f),
            buildInheritedAdditionalFieldState: (
              af: SurveyQuestionsLegacyValue,
              ans: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
            ) => buildInheritedAdditionalFieldState(af, ans, q),
            normalizeResponseEncryptionAudience: (a: SurveyQuestionsLegacyValue, q: SurveyQuestionsLegacyValue) =>
              normalizeResponseEncryptionAudience(a, q),
          },
          newEncryptedState,
          questionId: qid,
          surveyIndex: idx,
        }),
      () => {
        scheduleJsonPreviewUpdate();
        persistDraftSafely && persistDraftSafely();
      },
    );
  };

  const toggleAdditionalCommentsEncryption = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    newEncryptedState: SurveyQuestionsLegacyValue,
  ) => {
    const idx: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex || 0;
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) =>
        buildAdditionalEncryptionToggleResponseState(prev, {
          buildEncryptionTogglePlan: buildEncryptionTogglePlan as SurveyQuestionsLegacyValue,
          deps: {
            isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
            buildEmptyResponseFieldState: (q: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
              buildEmptyResponseFieldState(q, fk),
            resolveFieldEncryptionAudience: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionAudience(f, q, fk),
            resolveFieldEncryptionGateId: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionGateId(f, q, fk),
            normalizeFieldAudienceMode: (
              v: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
              f: SurveyQuestionsLegacyValue,
            ) => normalizeFieldAudienceMode(v, fk, f),
            buildInheritedAdditionalFieldState: (
              af: SurveyQuestionsLegacyValue,
              ans: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
            ) => buildInheritedAdditionalFieldState(af, ans, q),
            normalizeResponseEncryptionAudience: (a: SurveyQuestionsLegacyValue, q: SurveyQuestionsLegacyValue) =>
              normalizeResponseEncryptionAudience(a, q),
          },
          newEncryptedState,
          questionId: qid,
          surveyIndex: idx,
        }),
      () => {
        scheduleJsonPreviewUpdate();
        persistDraftSafely && persistDraftSafely();
      },
    );
  };

  const toggleDisplayAnswerMode = () => {
    setState(buildDisplayAnswerModeToggleState, async () => {
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
    });
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

  const getSurveyResponse = async (
    responderAddress: SurveyQuestionsLegacyValue,
    surveyID: SurveyQuestionsLegacyValue,
  ) => {
    // Prefer id-aware group resolution so /survey/:id outside /session still resolves
    const slug: SurveyQuestionsLegacyValue = resolveSlugForIds({
      surveyId: surveyID,
      props: propsRef.current,
      network: propsRef.current.network,
    });
    const surveyAnswers: SurveyQuestionsLegacyValue = await surveyQuestionReadsPort.getSurveyResponse(
      propsRef.current.provider,
      responderAddress,
      surveyID,
      slug,
    );
    return surveyAnswers;
  };

  const getSurveyMetadataForJson = (surveyHash: SurveyQuestionsLegacyValue) => {
    if (!surveyHash) return { surveyTitle: null, sessionName: '' };

    try {
      const slug: SurveyQuestionsLegacyValue = resolveSlugForIds({
        surveyId: surveyHash,
        props: propsRef.current,
        network: propsRef.current.network,
      });
      const context: SurveyQuestionsLegacyValue = resolveResponseJsonContext(propsRef.current, slug);
      const netIdStr: SurveyQuestionsLegacyValue = context.networkIdStr;
      const surveyIdLower: SurveyQuestionsLegacyValue = String(surveyHash || '').toLowerCase();
      const cacheKey: SurveyQuestionsLegacyValue = `${String(slug || '')}|${String(netIdStr || '')}|${surveyIdLower}`;
      const surveysCache: SurveyQuestionsLegacyValue = readSurveysCacheRef(slug) || {};
      if (
        inst._surveyJsonMetaCache.key === cacheKey &&
        inst._surveyJsonMetaCache.source === surveysCache &&
        inst._surveyJsonMetaCache.value
      ) {
        return inst._surveyJsonMetaCache.value;
      }

      let surveyTitle: SurveyQuestionsLegacyValue = null;
      let sessionName: SurveyQuestionsLegacyValue = '';
      const netBucket: SurveyQuestionsLegacyValue = netIdStr ? surveysCache?.[netIdStr] || null : null;
      const s: SurveyQuestionsLegacyValue = netBucket?.surveys?.[surveyIdLower];
      if (s?.title) surveyTitle = surveyResponseStoragePort.sanitizeSurveyTitleForResponsePayload(s);
      if (s?.sessionName) sessionName = s.sessionName;
      else if (context.sessionConfig?.sessionName) sessionName = context.sessionConfig.sessionName;

      const value: SurveyQuestionsLegacyValue = { surveyTitle, sessionName };
      inst._surveyJsonMetaCache = { key: cacheKey, source: surveysCache, value };
      return value;
    } catch {
      return { surveyTitle: null, sessionName: '' };
    }
  };

  const prepareJsonAndHash = (
    surveyIndex: SurveyQuestionsLegacyValue,
    responderAddress?: SurveyQuestionsLegacyValue,
    overrideState: SurveyQuestionsLegacyValue = null,
  ) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    const surveyResponseState: SurveyQuestionsLegacyValue =
      overrideState || stateRef.current.surveysResponseState[surveyIndex];
    return buildResponsePayload({
      isStandalone: propsRef.current.isStandalone as SurveyQuestionsLegacyValue,
      singleQuestionMode: propsRef.current.singleQuestionMode as SurveyQuestionsLegacyValue,
      surveyId: propsRef.current.surveyId,
      account: responderAddress || propsRef.current.account,
      surveyIndex,
      surveyResponseState,
      questionPool: Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      pileQuestions: Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : [],
      resolveFieldEncryptionAudience: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fieldKey: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(field, qid, fieldKey),
      getQuestionEncryptionGates: (q: SurveyQuestionsLegacyValue) => getQuestionEncryptionGates(q),
      resolveFieldEncryptionGateId: (
        field: SurveyQuestionsLegacyValue,
        qid: SurveyQuestionsLegacyValue,
        fieldKey: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(field, qid, fieldKey),
      normalizeFieldAudienceMode: (
        mode: SurveyQuestionsLegacyValue,
        fieldKey: SurveyQuestionsLegacyValue,
        field: SurveyQuestionsLegacyValue,
      ) => normalizeFieldAudienceMode(mode, fieldKey, field),
      getSurveyMetadataForJson: (hash: SurveyQuestionsLegacyValue) => getSurveyMetadataForJson(hash),
      resolveSessionContext: () => {
        const context: SurveyQuestionsLegacyValue = resolveResponseJsonContext(
          propsRef.current,
          resolveEffectiveSlug(propsRef.current),
        );
        return { sessionName: context.sessionConfig?.sessionName || '' };
      },
      getConvictionFromSlice,
      getImportanceFromSlice,
      sanitizeQuestionPromptForResponsePayload: surveyResponseStoragePort.sanitizeQuestionPromptForResponsePayload,
    });
  };

  const updateJsonPreview = (force: SurveyQuestionsLegacyValue = false) => {
    if (!force && !isResponseJsonPreviewVisible()) return;
    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    setState(buildJsonPreviewState(prepareJsonAndHash(surveyIndex)));
  };

  const jsonTreeDisplay = (jsonInput: SurveyQuestionsLegacyValue) => (
    <SurveyQuestionsJsonTree
      jsonInput={jsonInput}
      onInvalidInput={(...args: SurveyQuestionsLegacyValue[]) => surveyLog.error(...args)}
    />
  );

  const handlePrimarySubmitClick = () => {
    const inFlightPlan: SurveyQuestionsPrimarySubmitPlan = buildSurveyQuestionsPrimarySubmitPlan({
      isSubmitting: stateRef.current.isSubmitting,
      submitGuardActive: inst._submitGuard,
    });
    if (inFlightPlan.action === 'inert') return;

    const pendingStats: SurveyQuestionsSubmitPendingStats = resolveSurveyQuestionsSubmitPendingStats({
      getPendingEditStats: typeof getPendingEditStats === 'function' ? () => getPendingEditStats() : undefined,
      fallbackTotal: stateRef.current.modifiedCount || 0,
    });
    const pendingEditCount = pendingStats.total;
    const planBase: SurveyQuestionsLegacyRecord = {
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
    const isViewingSubmitted: SurveyQuestionsLegacyValue = shouldUseSubmittedResponseJson({
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

    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
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

  const copyJsonToClipboard = (json: SurveyQuestionsLegacyValue, type: SurveyQuestionsLegacyValue) => {
    let jsonToUse: SurveyQuestionsLegacyValue = json;

    if (!jsonToUse || (typeof jsonToUse === 'object' && Object.keys(jsonToUse).length === 0)) {
      if (propsRef.current.singleQuestionMode) {
        jsonToUse = getResponseJson();
      }
    }

    if (
      !jsonToUse ||
      (typeof jsonToUse === 'object' &&
        Object.keys(jsonToUse).length === 0 &&
        type !== 'questions' &&
        type !== 'survey')
    ) {
      surveyLog.warn('No valid JSON data to copy for type:', type);
      return;
    }

    const jsonString: SurveyQuestionsLegacyValue =
      typeof jsonToUse === 'string' ? jsonToUse : JSON.stringify(jsonToUse, null, 2);
    navigator.clipboard
      .writeText(jsonString)
      .then(() => {
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
      })
      .catch((error: any) => {
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

  const getCommentsOpen = (questionId: SurveyQuestionsLegacyValue, defaultOpen: SurveyQuestionsLegacyValue = false) => {
    const current: SurveyQuestionsLegacyValue = stateRef.current?.showComments?.[questionId];
    return typeof current === 'boolean' ? current : !!defaultOpen;
  };

  const toggleComments = (questionId: SurveyQuestionsLegacyValue, defaultOpen: SurveyQuestionsLegacyValue = false) => {
    const runtimeStrategy: SurveyQuestionsLegacyValue = getRuntimeStrategy();
    if (typeof runtimeStrategy?.toggleComments === 'function') {
      return runtimeStrategy.toggleComments(engine, questionId, defaultOpen);
    }
    setState((prev: SurveyQuestionsLegacyValue) => buildCommentsToggleState(prev, questionId, defaultOpen));
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
  }: SurveyQuestionsLegacyValue) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    const resolvedFieldKey: SurveyQuestionsLegacyValue =
      String(fieldKey || '')
        .trim()
        .toLowerCase() === 'additional'
        ? 'additional'
        : 'answer';
    const fieldState: SurveyQuestionsLegacyValue = field && typeof field === 'object' ? field : answer || {};
    const forcedGate: SurveyQuestionsLegacyValue = isQuestionLockedForResponse(qid);
    const gateOption: SurveyQuestionsLegacyValue = resolveQuestionGateOption(qid);
    const gateOptions: SurveyQuestionsLegacyValue = Array.isArray(gateOption?.gateDetails)
      ? gateOption.gateDetails
      : [];
    const currentAudience: SurveyQuestionsLegacyValue = resolveFieldEncryptionAudience(
      fieldState,
      qid,
      resolvedFieldKey,
    );
    const currentGateId: SurveyQuestionsLegacyValue = resolveFieldEncryptionGateId(fieldState, qid, resolvedFieldKey);
    const currentAudienceMode: SurveyQuestionsLegacyValue = normalizeFieldAudienceMode(
      fieldState?.audienceMode,
      resolvedFieldKey,
      fieldState,
    );
    const displayState: SurveyQuestionsLegacyValue = buildLockAudienceDisplayState({
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
    const menuStateKey: SurveyQuestionsLegacyValue = displayState.hasAudienceMenu
      ? getLockAudienceMenuStateKey(qid, displayState.effectiveFieldKey)
      : '';
    const expandedGateId: SurveyQuestionsLegacyValue = normalizeGateLabelText(
      stateRef.current.lockAudienceGateDetailsByQuestion?.[menuStateKey] || '',
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
  }: SurveyQuestionsLegacyValue) => {
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
  }: SurveyQuestionsLegacyValue) => {
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
  }: SurveyQuestionsLegacyValue) => {
    const action: SurveyQuestionsLegacyValue = buildLockAudienceButtonAction({
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
  }: SurveyQuestionsLegacyValue) => {
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
    }: SurveyQuestionsLegacyValue = getLockAudienceDisplayState({
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
    const handleAudienceSelect: SurveyQuestionsLegacyValue = (
      audience: SurveyQuestionsLegacyValue,
      gateId: SurveyQuestionsLegacyValue = '',
    ) => {
      applyLockAudienceSelection({
        surveyIndex,
        qid,
        effectiveFieldKey,
        audience,
        gateId,
      });
    };

    const handleLockClick: SurveyQuestionsLegacyValue = () => {
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
        onToggleGateDetails={(
          nextQid: SurveyQuestionsLegacyValue,
          gateId: SurveyQuestionsLegacyValue,
          nextFieldKey: SurveyQuestionsLegacyValue,
        ) => toggleLockAudienceGateDetails(nextQid, gateId, nextFieldKey)}
      />
    );
  };

  const renderQuestion = (
    question: SurveyQuestionsLegacyValue,
    qIndex: SurveyQuestionsLegacyValue,
    currentSurveyResponseState: SurveyQuestionsLegacyValue,
  ) => {
    if (!currentSurveyResponseState || !currentSurveyResponseState.answers) {
      surveyLog.warn(
        'renderQuestion: currentSurveyResponseState or its answers property is undefined/null. Question ID:',
        question?.id,
      );
      return null;
    }

    if (!question || !question.id || !question.type) {
      surveyLog.error('Invalid question data at index:', qIndex, question);
      return null;
    }

    const surveyIndex: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : propsRef.current.surveyIndex;
    const displayState: SurveyQuestionsLegacyValue = getQuestionRenderDisplayState({
      questionId: question.id,
      responseSlice: currentSurveyResponseState,
    });
    const sliderOpen: SurveyQuestionsLegacyValue = !!stateRef.current.sliderToggleExpandedByQuestion?.[question.id];

    const cardKey: SurveyQuestionsLegacyValue = String(question.id || '');
    const showResponseLookupSpinner: SurveyQuestionsLegacyValue = shouldShowSingleQuestionResponseLookupSpinner({
      singleQuestionMode: propsRef.current.singleQuestionMode,
      isLoadingResponse: stateRef.current.isLoadingResponse,
      account: propsRef.current.account,
      viewAddress: propsRef.current.viewAddress,
      responderAddress: propsRef.current.responderAddress,
    });
    const isQuestionBookmarked: SurveyQuestionsLegacyValue = stateRef.current.bookmarkedQuestions.has(question.id);

    const cardIcons: SurveyQuestionsLegacyValue = renderFullQuestionCardIcons({
      question,
      showResponseLookupSpinner,
      isQuestionBookmarked,
    });

    // If the prompt is still masked, do not allow answering (prevents nonsense submits).
    // This primarily affects direct-link `/question/:id?...` flows; list views filter these out.
    const promptMasked: SurveyQuestionsLegacyValue = isQuestionPromptMasked(question);
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

  const resolveSbtGateLabel = (address: SurveyQuestionsLegacyValue, preferredSlug: SurveyQuestionsLegacyValue = '') => {
    const normalizedAddress: SurveyQuestionsLegacyValue = String(address || '').trim();
    if (!normalizedAddress) return '';
    const slug: SurveyQuestionsLegacyValue = String(
      preferredSlug ||
        (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    return resolveSbtDisplayLabel({
      address: normalizedAddress,
      preferredSlug: slug,
      fallback: 'short',
    });
  };

  const collectGateSbtAddressesForHydration = () => {
    const policy: SurveyQuestionsLegacyValue = getResponseGatePolicy();
    const questionPools: SurveyQuestionsLegacyValue = [
      Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      Array.isArray(stateRef.current.pileQuestions) ? stateRef.current.pileQuestions : [],
      Array.isArray(propsRef.current.questionPool) ? propsRef.current.questionPool : [],
    ];

    return collectGateSbtAddressesForHydrationFromSources({
      policy,
      questionPools,
      getQuestionEncryptionGates: (question: SurveyQuestionsLegacyValue) => getQuestionEncryptionGates(question),
      isAddress: (value: SurveyQuestionsLegacyValue) => ethers.utils.isAddress(value),
      getAddress: (value: SurveyQuestionsLegacyValue) => ethers.utils.getAddress(value),
    });
  };

  const hydrateGateSbtLabels = async ({ force = false }: SurveyQuestionsLegacyValue = {}) => {
    const addresses: SurveyQuestionsLegacyValue = collectGateSbtAddressesForHydration();
    const slug: SurveyQuestionsLegacyValue = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    const cfg: SurveyQuestionsLegacyValue = resolveEffectiveResponseGateConfig(slug);
    const chainId: SurveyQuestionsLegacyValue = resolveSessionChainId(slug, cfg);
    const signature: SurveyQuestionsLegacyValue = `${slug}|${Number(chainId || 0)}|${addresses.join(',')}`;
    if (!force && signature === inst._gateSbtHydrationSig) return;
    inst._gateSbtHydrationSig = signature;
    if (!addresses.length) {
      clearGateSbtHydrationRetry();
      return;
    }

    try {
      const hits: SurveyQuestionsLegacyValue = await warmSbtDisplayNamesTargeted({
        addresses,
        preferredSlug: slug,
        metadataLookupConfig: cfg,
        chainId,
        writeBack: true,
      });
      const targetedLookupEnabled: SurveyQuestionsLegacyValue = isTargetedSbtMetadataLookupEnabled();
      if (!inst._isMounted) return;
      const resolvedAddresses: SurveyQuestionsLegacyValue = new Set(
        (Array.isArray(hits) ? hits : [])
          .map((entry: SurveyQuestionsLegacyValue) =>
            String(entry?.address || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      );
      const hasUnresolvedAddresses: SurveyQuestionsLegacyValue = addresses.some(
        (address: SurveyQuestionsLegacyValue) =>
          !resolvedAddresses.has(
            String(address || '')
              .trim()
              .toLowerCase(),
          ),
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

  const buildLockedQuestionGateDetails = (hiddenMaskedQuestionIds: SurveyQuestionsLegacyValue = []) => {
    const hiddenIds: SurveyQuestionsLegacyValue = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: SurveyQuestionsLegacyValue) =>
          String(qid || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    if (hiddenIds.size === 0) return [];

    const pool: SurveyQuestionsLegacyValue = getLockedQuestionGateSourcePool(hiddenMaskedQuestionIds);
    const slug: SurveyQuestionsLegacyValue = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    const questionGateDetails: SurveyQuestionsLegacyValue = buildLockedQuestionGateDetailsFromPool({
      hiddenMaskedQuestionIds,
      pool,
      slug,
      getQuestionEncryptionGates: (question: SurveyQuestionsLegacyValue) => getQuestionEncryptionGates(question),
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveConfiguredGateLabel: (args: SurveyQuestionsLegacyValue) => resolveConfiguredGateLabel(args),
      resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue, preferredSlug: SurveyQuestionsLegacyValue = '') =>
        resolveSbtGateLabel(address, preferredSlug),
      getShortenedAddress: getShortenedAddress as SurveyQuestionsLegacyValue,
      buildSbtDetailPath,
      normalizeSessionSlug: normalizeSessionSlugValue,
      getChecksumAddress: (address: SurveyQuestionsLegacyValue) =>
        ethers.utils.isAddress(address) ? ethers.utils.getAddress(address) : address,
      translate: t,
    });
    if (questionGateDetails.length > 0) return questionGateDetails;
    return buildSessionQuestionGateDetails(hiddenIds.size || 1);
  };

  const getLockedQuestionGateSourcePool = (hiddenMaskedQuestionIds: SurveyQuestionsLegacyValue = []) => {
    const hiddenIds: SurveyQuestionsLegacyValue = new Set(
      (Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : [])
        .map((qid: SurveyQuestionsLegacyValue) =>
          String(qid || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean),
    );
    const candidates: SurveyQuestionsLegacyValue = [
      Array.isArray(stateRef.current.allQuestionsForFilter) ? stateRef.current.allQuestionsForFilter : [],
      Array.isArray(stateRef.current.questionPool) ? stateRef.current.questionPool : [],
      Array.isArray(propsRef.current.questionPool) ? propsRef.current.questionPool : [],
    ].filter((pool: SurveyQuestionsLegacyValue) => Array.isArray(pool) && pool.length > 0);

    if (!candidates.length) return [];
    if (hiddenIds.size === 0) return candidates[0];

    const scored: SurveyQuestionsLegacyValue = candidates.map(
      (pool: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) => {
        let matchedCount: SurveyQuestionsLegacyValue = 0;
        let gateCount: SurveyQuestionsLegacyValue = 0;
        pool.forEach((question: SurveyQuestionsLegacyValue) => {
          const questionId: SurveyQuestionsLegacyValue = String(question?.id || '')
            .trim()
            .toLowerCase();
          if (!hiddenIds.has(questionId)) return;
          matchedCount += 1;
          gateCount += getQuestionEncryptionGates(question).length;
        });
        return { pool, index, matchedCount, gateCount };
      },
    );

    const matchingPools: SurveyQuestionsLegacyValue = scored.filter(
      (entry: SurveyQuestionsLegacyValue) => entry.matchedCount > 0,
    );
    if (!matchingPools.length) return candidates[0];

    matchingPools.sort(
      (a: SurveyQuestionsLegacyValue, b: SurveyQuestionsLegacyValue) =>
        b.gateCount - a.gateCount || b.matchedCount - a.matchedCount || a.index - b.index,
    );
    return matchingPools[0].pool;
  };

  const getMemoizedLockedQuestionGateDetails = (hiddenMaskedQuestionIds: SurveyQuestionsLegacyValue = []) => {
    const hiddenIds: SurveyQuestionsLegacyValue = (
      Array.isArray(hiddenMaskedQuestionIds) ? hiddenMaskedQuestionIds : []
    )
      .map((qid: SurveyQuestionsLegacyValue) =>
        String(qid || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    const hiddenSignature: SurveyQuestionsLegacyValue = hiddenIds.join('|');
    const pool: SurveyQuestionsLegacyValue = getLockedQuestionGateSourcePool(hiddenIds);
    const memo: SurveyQuestionsLegacyValue = inst._lockedQuestionGateDetailsMemo || {};
    let poolVersion: SurveyQuestionsLegacyValue = Number(memo.poolVersion || 0);
    if (memo.poolRef !== pool) {
      poolVersion += 1;
      inst._lockedQuestionGateDetailsMemo = {
        ...memo,
        poolRef: pool,
        poolVersion,
      };
    }
    const memoKey: SurveyQuestionsLegacyValue = [
      hiddenSignature,
      `pool:${poolVersion}`,
      `gateRev:${Number(stateRef.current.gateSbtNameRevision || 0)}`,
    ].join('|');
    if (inst._lockedQuestionGateDetailsMemo?.key === memoKey) {
      return inst._lockedQuestionGateDetailsMemo.value;
    }
    const nextValue: SurveyQuestionsLegacyValue = buildLockedQuestionGateDetails(hiddenIds);
    inst._lockedQuestionGateDetailsMemo = {
      ...inst._lockedQuestionGateDetailsMemo,
      key: memoKey,
      value: nextValue,
    };
    return nextValue;
  };

  const buildSessionQuestionGateDetails = (questionCount: SurveyQuestionsLegacyValue = 0) => {
    const count: SurveyQuestionsLegacyValue = Math.max(1, Number(questionCount || 0) || 1);
    const slug: SurveyQuestionsLegacyValue = String(
      (inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '') ||
        resolveEffectiveSlug(propsRef.current) ||
        '',
    )
      .trim()
      .toLowerCase();
    const options: SurveyQuestionsLegacyValue = getResponseGateOptions(null);
    return (Array.isArray(options) ? options : [])
      .map((option: SurveyQuestionsLegacyValue, index: SurveyQuestionsLegacyValue) => {
        const sbtAddresses: SurveyQuestionsLegacyValue = Array.from(
          new Set(
            (Array.isArray(option?.sbtAddresses) ? option.sbtAddresses : [])
              .map((address: SurveyQuestionsLegacyValue) => String(address || '').trim())
              .filter(Boolean),
          ),
        );
        if (!sbtAddresses.length) return null;
        const id: SurveyQuestionsLegacyValue = `session:${option.gateId || index}:${sbtAddresses
          .map((address: SurveyQuestionsLegacyValue) => address.toLowerCase())
          .sort()
          .join('|')}`;
        const sessionSlug: SurveyQuestionsLegacyValue = slug || normalizeSessionSlugValue(option?.sessionSlug || '');
        return {
          id,
          label: option.label || t('gate'),
          sbtAddresses,
          questionIds: new Set(),
          questionCount: count,
          sessionSlug,
          sbts: sbtAddresses.map((address: SurveyQuestionsLegacyValue) => ({
            address,
            label: resolveSbtGateLabel(address, sessionSlug) || getShortenedAddress(address, false),
            href: buildSbtDetailPath(address, sessionSlug),
          })),
        };
      })
      .filter(Boolean);
  };

  const getLockedGateRequirementSentence = (lockedGateDetails: SurveyQuestionsLegacyValue = []) =>
    buildLockedGateRequirementSentenceCore(lockedGateDetails, { translate: t });

  const renderLockedQuestionsPanel = ({
    hiddenMaskedQuestionIds = [],
    lockedGateDetails = [],
    title = '',
    subtitle = '',
    forceExpanded = false,
    surface = 'light',
    showCaret = true,
  }: SurveyQuestionsLegacyValue = {}) => (
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
      onDecrypt={(questionIds: SurveyQuestionsLegacyValue) => reloadMaskedQuestionBatch(questionIds)}
      onToggleDetails={() => setState(buildLockedGateDetailsExpandedState)}
    />
  );

  const resolveGateDisplayLabel = (
    gate: SurveyQuestionsLegacyValue = {},
    fallbackSbt: SurveyQuestionsLegacyValue = '',
  ) =>
    resolveGateDisplayLabelController(gate, fallbackSbt, {
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveSbtGateLabel: (address: SurveyQuestionsLegacyValue) => resolveSbtGateLabel(address),
      getShortenedAddress: getShortenedAddress as SurveyQuestionsLegacyValue,
      t,
    });

  const resolveConfiguredGateLabel = ({
    gate = {},
    resourceKey = '',
    sbtAddresses = [],
  }: SurveyQuestionsLegacyValue = {}) =>
    resolveConfiguredGateLabelController({ gate, resourceKey, sbtAddresses }, inst._responseGatePolicyCache?.cfg, {
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      resolveGateDisplayLabel: (
        configuredGate: SurveyQuestionsLegacyValue = {},
        fallbackSbt: SurveyQuestionsLegacyValue = '',
      ) => resolveGateDisplayLabel(configuredGate, fallbackSbt),
    });

  const resolveLockAudienceSessionName = () =>
    resolveLockAudienceSessionNameController({
      normalizeGateLabelText: (value: SurveyQuestionsLegacyValue) => normalizeGateLabelText(value),
      props: propsRef.current,
      responseGatePolicyCacheCfg: inst._responseGatePolicyCache?.cfg as SurveyQuestionsLegacyValue,
      resolveSlugForIds,
      resolveLockAudienceSessionNameContext,
    });

  const resolveQuestionGateOption = (questionId: SurveyQuestionsLegacyValue = null) => {
    const gateDetails: SurveyQuestionsLegacyValue = getResponseGateOptions(questionId);
    if (!gateDetails.length) return null;

    const gateNames: SurveyQuestionsLegacyValue = Array.from(
      new Set(gateDetails.map((entry: SurveyQuestionsLegacyValue) => entry.label).filter(Boolean)),
    );
    const allSbtAddresses: SurveyQuestionsLegacyValue = Array.from(
      new Set(gateDetails.flatMap((entry: SurveyQuestionsLegacyValue) => entry.sbtAddresses || [])),
    );
    const sbtSummary: SurveyQuestionsLegacyValue =
      allSbtAddresses.length > 0
        ? allSbtAddresses
            .map((addr: SurveyQuestionsLegacyValue) => resolveSbtGateLabel(addr) || getShortenedAddress(addr, false))
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

  const getLockAudienceMenuStateKey = (
    questionId: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    if (!qid) return '';
    return String(fieldKey || '')
      .trim()
      .toLowerCase() === 'additional'
      ? `${qid}:additional`
      : qid;
  };

  const isLockAudienceMenuOpen = (
    questionId: SurveyQuestionsLegacyValue,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const key: SurveyQuestionsLegacyValue = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return false;
    return !!(stateRef.current.lockAudienceMenuByQuestion && stateRef.current.lockAudienceMenuByQuestion[key]);
  };

  const toggleLockAudienceGateDetails = (
    questionId: SurveyQuestionsLegacyValue,
    forceOpen: SurveyQuestionsLegacyValue = null,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const key: SurveyQuestionsLegacyValue = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    const normalizedGateId: SurveyQuestionsLegacyValue = normalizeGateLabelText(
      typeof forceOpen === 'string' ? forceOpen : '',
    );
    setState((prev: SurveyQuestionsLegacyValue) =>
      buildLockAudienceGateDetailsState(prev, key, forceOpen, normalizedGateId, normalizeGateLabelText),
    );
  };

  const toggleLockAudienceMenu = (
    questionId: SurveyQuestionsLegacyValue,
    forceOpen: SurveyQuestionsLegacyValue = null,
    fieldKey: SurveyQuestionsLegacyValue = 'answer',
  ) => {
    const key: SurveyQuestionsLegacyValue = getLockAudienceMenuStateKey(questionId, fieldKey);
    if (!key) return;
    setState((prev: SurveyQuestionsLegacyValue) => buildLockAudienceMenuState(prev, key, forceOpen));
  };

  const applyAnswerEncryptionAudience = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    audience: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    const idx: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex || 0;
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    if (!qid) return;
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) =>
        buildAnswerEncryptionAudienceState(prev, {
          audience,
          buildAnswerAudienceSelectionPlan: buildAnswerAudienceSelectionPlan as SurveyQuestionsLegacyValue,
          buildSurveyResponseStateArray,
          deps: {
            isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
            buildEmptyResponseFieldState: (q: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
              buildEmptyResponseFieldState(q, fk),
            resolveFieldEncryptionAudience: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionAudience(f, q, fk),
            resolveFieldEncryptionGateId: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionGateId(f, q, fk),
            normalizeFieldAudienceMode: (
              v: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
              f: SurveyQuestionsLegacyValue,
            ) => normalizeFieldAudienceMode(v, fk, f),
            buildInheritedAdditionalFieldState: (
              af: SurveyQuestionsLegacyValue,
              ans: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
            ) => buildInheritedAdditionalFieldState(af, ans, q),
            normalizeResponseEncryptionAudience: (a: SurveyQuestionsLegacyValue, q: SurveyQuestionsLegacyValue) =>
              normalizeResponseEncryptionAudience(a, q),
          },
          gateId: options?.gateId || '',
          questionId: qid,
          surveyIndex: idx,
        }),
      () => {
        scheduleJsonPreviewUpdate();
        persistDraftSafely && persistDraftSafely();
      },
    );
  };

  const applyAdditionalEncryptionAudience = (
    surveyIndex: SurveyQuestionsLegacyValue,
    questionId: SurveyQuestionsLegacyValue,
    audience: SurveyQuestionsLegacyValue,
    options: SurveyQuestionsLegacyValue = {},
  ) => {
    const idx: SurveyQuestionsLegacyValue =
      propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex || 0;
    const qid: SurveyQuestionsLegacyValue = String(questionId || '').toLowerCase();
    if (!qid) return;
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) =>
        buildAdditionalEncryptionAudienceState(prev, {
          audience,
          buildAdditionalAudienceSelectionPlan: buildAdditionalAudienceSelectionPlan as SurveyQuestionsLegacyValue,
          buildSurveyResponseStateArray,
          deps: {
            isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
            buildEmptyResponseFieldState: (q: SurveyQuestionsLegacyValue, fk: SurveyQuestionsLegacyValue) =>
              buildEmptyResponseFieldState(q, fk),
            resolveFieldEncryptionAudience: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionAudience(f, q, fk),
            resolveFieldEncryptionGateId: (
              f: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
            ) => resolveFieldEncryptionGateId(f, q, fk),
            normalizeFieldAudienceMode: (
              v: SurveyQuestionsLegacyValue,
              fk: SurveyQuestionsLegacyValue,
              f: SurveyQuestionsLegacyValue,
            ) => normalizeFieldAudienceMode(v, fk, f),
            buildInheritedAdditionalFieldState: (
              af: SurveyQuestionsLegacyValue,
              ans: SurveyQuestionsLegacyValue,
              q: SurveyQuestionsLegacyValue,
            ) => buildInheritedAdditionalFieldState(af, ans, q),
            normalizeResponseEncryptionAudience: (a: SurveyQuestionsLegacyValue, q: SurveyQuestionsLegacyValue) =>
              normalizeResponseEncryptionAudience(a, q),
          },
          gateId: options?.gateId || '',
          questionId: qid,
          surveyIndex: idx,
        }),
      () => {
        scheduleJsonPreviewUpdate();
        persistDraftSafely && persistDraftSafely();
      },
    );
  };

  const buildLitEncryptionOptionsForRecipients = (recipients: SurveyQuestionsLegacyValue = []) => {
    const list: SurveyQuestionsLegacyValue = Array.isArray(recipients) ? recipients.filter(Boolean) : [];
    if (!list.length) return undefined;

    const litHooks: SurveyQuestionsLegacyValue =
      propsRef.current.lit ||
      propsRef.current.litHooks ||
      (typeof window !== 'undefined' ? window.__litHooks || window.litHooks : null);
    if (!litHooks || typeof litHooks.saveKey !== 'function') {
      return undefined;
    }

    const first: SurveyQuestionsLegacyValue = list[0] || {};
    if (!first.accessControlConditions || !first.chain) return undefined;

    const out: SurveyQuestionsLegacyValue = {
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

  const buildFieldEncryptionWorkGroups = (
    slice: SurveyQuestionsLegacyValue = {},
    changedQids: SurveyQuestionsLegacyValue = new Set(),
  ) => {
    return buildFieldEncryptionWorkGroupsCore(slice, changedQids, {
      isQuestionLockedForResponse: (q: SurveyQuestionsLegacyValue) => isQuestionLockedForResponse(q),
      resolveFieldEncryptionGateId: (
        f: SurveyQuestionsLegacyValue,
        q: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionGateId(f, q, fk),
      resolveFieldEncryptionAudience: (
        f: SurveyQuestionsLegacyValue,
        q: SurveyQuestionsLegacyValue,
        fk: SurveyQuestionsLegacyValue,
      ) => resolveFieldEncryptionAudience(f, q, fk),
      getEffectiveRecipientsForField: ((opts: SurveyQuestionsLegacyValue) =>
        getEffectiveRecipientsForField(opts)) as SurveyQuestionsLegacyValue,
    });
  };

  const encryptFieldWorkGroups = async ({ workGroups = [], baseOpts = {} }: SurveyQuestionsLegacyValue = {}) => {
    const encState: SurveyQuestionsLegacyValue = { answers: {}, additionalComments: {} };
    const list: SurveyQuestionsLegacyValue = Array.isArray(workGroups) ? workGroups : [];

    for (const group of list) {
      const hasSliceWork: SurveyQuestionsLegacyValue =
        Object.keys(group?.slice?.answers || {}).length > 0 ||
        Object.keys(group?.slice?.additionalComments || {}).length > 0;
      if (!hasSliceWork || !Array.isArray(group?.qids) || group.qids.length === 0) {
        continue;
      }

      let partial: SurveyQuestionsLegacyValue = null;
      if (Array.isArray(group.recipients) && group.recipients.length > 0) {
        const lit: SurveyQuestionsLegacyValue = buildLitEncryptionOptionsForRecipients(group.recipients);
        if (!lit) {
          throw new Error('Lit hooks unavailable; cannot encrypt gated responses.');
        }
        // eslint-disable-next-line no-await-in-loop
        partial = await (cryptoUtils as SurveyQuestionsLegacyValue).encryptMultipleAnswers(group.slice, {
          ...baseOpts,
          onlyTheseQids: group.qids,
          lit,
        });
      } else {
        // eslint-disable-next-line no-await-in-loop
        partial = await (cryptoUtils as SurveyQuestionsLegacyValue).encryptMultipleAnswers(group.slice, {
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
    const singleQuestionMode: SurveyQuestionsLegacyValue = !!propsRef.current.singleQuestionMode;
    const isStandalone: SurveyQuestionsLegacyValue = !!propsRef.current.isStandalone;
    const surveyIndex: SurveyQuestionsLegacyValue =
      singleQuestionMode || isStandalone ? 0 : propsRef.current.surveyIndex || 0;
    const effectiveDraftSlug: SurveyQuestionsLegacyValue = resolveSubmitEffectiveDraftSlug({
      draftSlug: inst._getEffectiveDraftSlug ? inst._getEffectiveDraftSlug() : '',
      routeSlug: resolveEffectiveSlug(propsRef.current),
      normalizeSlug: normalizeSessionSlugValue,
    });

    return {
      props: propsRef.current,
      account: propsRef.current.account || '',
      provider: propsRef.current.provider,
      providerKind: String((cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind(propsRef.current.provider) || '')
        .trim()
        .toLowerCase(),
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

  const buildSubmitContextKey = (snapshot: SurveyQuestionsLegacyValue = null) => {
    const context: SurveyQuestionsLegacyValue = snapshot || buildSubmitContextSnapshot();
    return [
      String(context.account || '')
        .trim()
        .toLowerCase(),
      String(context.providerKind || '')
        .trim()
        .toLowerCase(),
      normalizeSessionSlugValue(context.effectiveDraftSlug || ''),
      String(context.chainId || '').trim(),
      context.singleQuestionMode ? 'single' : context.isStandalone ? 'standalone' : 'survey',
      String(context.surveyIndex ?? '').trim(),
      String(context.surveyId || '')
        .trim()
        .toLowerCase(),
      String(context.questionID || '')
        .trim()
        .toLowerCase(),
    ].join('|');
  };

  const isSubmitContextCurrent = (snapshot: SurveyQuestionsLegacyValue = null) =>
    !!snapshot && (!snapshot.mounted || inst._isMounted) && buildSubmitContextKey(snapshot) === buildSubmitContextKey();

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

  const handleStaleSubmitContext = (snapshot: SurveyQuestionsLegacyValue = null) => {
    runSurveyQuestionsStaleSubmitController({
      snapshot,
      ports: {
        clearSubmitGuard: () => {
          inst._submitGuard = false;
        },
        canUpdateSubmitState: (currentSnapshot: SurveyQuestionsLegacyValue) =>
          canUpdateStateForAsyncSnapshot(currentSnapshot),
        isSubmitAttemptActive: (
          _submitAttemptId: SurveyQuestionsLegacyValue,
          currentSnapshot: SurveyQuestionsLegacyValue,
        ) =>
          inst._activeSubmitAttemptSeq ===
          (currentSnapshot as { submitAttemptId?: unknown } | null | undefined)?.submitAttemptId,
        finishSubmitAttempt: (submitAttemptId: number) => finishSubmitAttempt(submitAttemptId),
        setSubmitStaleState: (statePatch: SurveyQuestionsSubmitStaleStatePatch) => setState(statePatch),
      },
    });
  };

  const encryptAndUpload = async () => {
    let submitContext: SurveyQuestionsLegacyValue = null;
    try {
      if (!propsRef.current.loginComplete) {
        inst._submitGuard = false;
        propsRef.current.toggleLoginModal(true);
        return;
      }

      const answeredCount: SurveyQuestionsLegacyValue = getAnsweredQuestionsCount();
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

      const providerKind: SurveyQuestionsLegacyValue = (cryptoUtils as SurveyQuestionsLegacyValue).getProviderKind(
        submitContext.provider,
      );

      // Compute changed set once (used for encrypt + submit)
      const surveyIndex: SurveyQuestionsLegacyValue = submitContext.surveyIndex;
      const { changedQids }: SurveyQuestionsLegacyValue = getChangedQidsAndFields(surveyIndex);

      // Local state tracker to ensure baseline syncs with encrypted data even if React is slow
      let activeSlice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState?.[surveyIndex] || {
        answers: {},
        additionalComments: {},
        importance: {},
        conviction: {},
      };

      // Only encrypt when there are changed encrypted fields
      const pendingStats: SurveyQuestionsSubmitPendingStats = resolveSurveyQuestionsSubmitPendingStats({
        getPendingEditStats: typeof getPendingEditStats === 'function' ? () => getPendingEditStats() : undefined,
        fallbackTotal: stateRef.current.modifiedCount || 0,
        fallbackEncrypted: stateRef.current.hasEncryptedChanges ? 1 : 0,
      });
      const shouldEncrypt = Number(pendingStats.encrypted || 0) > 0 && changedQids.size > 0;

      if (shouldEncrypt) {
        const { groups: workGroups, missingRecipients }: SurveyQuestionsLegacyValue = buildFieldEncryptionWorkGroups(
          activeSlice,
          changedQids,
        );
        const hasWork: SurveyQuestionsLegacyValue = workGroups.some(
          (group: SurveyQuestionsLegacyValue) =>
            Object.keys(group?.slice?.answers || {}).length > 0 ||
            Object.keys(group?.slice?.additionalComments || {}).length > 0,
        );

        if (hasWork) {
          if (missingRecipients.length > 0) {
            throw new Error(`Missing Lit recipients for gated field(s): ${missingRecipients.join(', ')}`);
          }
          const surveyId: SurveyQuestionsLegacyValue = submitContext.singleQuestionMode
            ? ethers.constants.HashZero
            : submitContext.surveyId;
          const poolForCommit: SurveyQuestionsLegacyValue =
            Array.isArray(stateRef.current.questionPool) && stateRef.current.questionPool.length > 0
              ? stateRef.current.questionPool
              : Array.isArray(stateRef.current.pileQuestions)
                ? stateRef.current.pileQuestions
                : [];
          const encState: SurveyQuestionsLegacyValue = await encryptFieldWorkGroups({
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
          const newArr: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
          const base: SurveyQuestionsLegacyValue = {
            ...(newArr[surveyIndex] || { answers: {}, importance: {}, conviction: {}, additionalComments: {} }),
          };

          Object.keys(encState.answers || {}).forEach((qid: SurveyQuestionsLegacyValue) => {
            base.answers = { ...(base.answers || {}) };
            base.answers[qid] = { ...(base.answers[qid] || {}), ...(encState.answers[qid] || {}) };
          });
          Object.keys(encState.additionalComments || {}).forEach((qid: SurveyQuestionsLegacyValue) => {
            base.additionalComments = { ...(base.additionalComments || {}) };
            base.additionalComments[qid] = {
              ...(base.additionalComments[qid] || {}),
              ...(encState.additionalComments[qid] || {}),
            };
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
      const receipt: SurveyQuestionsLegacyValue = await submitSurveyResponse(activeSlice, changedQids, submitContext);
      if (!isSubmitContextCurrent(submitContext)) {
        handleStaleSubmitContext(submitContext);
        return;
      }
      surveyLog.log('Submission receipt received', receipt?.blockNumber || 'unknown block');

      // Success path

      // 1. STOP any pending draft saves immediately
      if (inst._persistTimer) {
        clearTimeout(inst._persistTimer);
        inst._persistTimer = null;
      }

      // 2. Clear drafts for changed QIDs
      surveyLog.log('Clearing drafts for QIDs:', Array.from(changedQids));
      try {
        Array.from(changedQids).forEach(
          (qid: SurveyQuestionsLegacyValue) => clearDraftFor && clearDraftFor(String(qid)),
        );
      } catch (_: any) {
        if (propsRef.current.singleQuestionMode && propsRef.current.questionID) {
          clearDraftFor(propsRef.current.questionID.toLowerCase());
        } else {
          clearDraft();
        }
      }

      // 3. Compute responder URL for post-submit UI
      const submittedCacheSlug: SurveyQuestionsLegacyValue = normalizeSessionSlugValue(
        receipt?.__ceSubmissionGroupKey != null ? receipt.__ceSubmissionGroupKey : submitContext.effectiveDraftSlug,
      );
      const responseUrl = resolveSurveyQuestionsSubmittedResponseUrl({
        account: submitContext.account,
        currentPathname: window.location.pathname,
        isStandalone: submitContext.isStandalone,
        logWarn: (message: SurveyQuestionsLegacyValue, error: SurveyQuestionsLegacyValue) =>
          surveyLog.warn(message, error),
        questionID: submitContext.questionID,
        singleQuestionMode: submitContext.singleQuestionMode,
        submissionSlug: submittedCacheSlug,
        surveyId: submitContext.surveyId,
      });

      // 4. UPDATE BASELINE & OPTIMISTIC STATE
      surveyLog.log('Setting new Baseline');

      // Ensure surveysResponseState and editBaseline are mathematically identical
      // We clone activeSlice (which holds the final encrypted/plaintext state)
      const finalSlice: SurveyQuestionsLegacyValue = deepClone(activeSlice);
      const nextBaseline: SurveyQuestionsLegacyValue = deepClone(finalSlice);

      // Construct the explicit new state array to prevent any diff artifacts
      const nextSurveysResponseState: SurveyQuestionsLegacyValue = [...stateRef.current.surveysResponseState];
      nextSurveysResponseState[surveyIndex] = finalSlice;

      // Regression guard: the encrypted merge above is a class setState, so
      // build optimistic JSON from the known final slice instead of stateRef.current.
      const optimisticUserAnswers: SurveyQuestionsLegacyValue = prepareJsonAndHash(surveyIndex, undefined, finalSlice);

      // Check encryption status from the new baseline
      const hasEncrypted =
        Object.values(nextBaseline.answers || {}).some((a: SurveyQuestionsLegacyValue) => !!a.encrypted) ||
        Object.values(nextBaseline.additionalComments || {}).some((a: SurveyQuestionsLegacyValue) => !!a.encrypted);
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
          setSubmitSuccessState: (statePatch: SurveySubmitSuccessStatePatch, afterStateApplied?: () => void) =>
            setState(statePatch, afterStateApplied),
        },
        afterStateApplied: async () => {
          try {
            if (!isSubmitContextCurrent(submitContext)) return;
            const cacheWriteResult: SurveyQuestionsLegacyValue = await writeSubmittedResponsesToLocalCaches(
              {
                receipt,
                questionResponses: receipt?.__ceQuestionResponses,
                surveyResponse: receipt?.__ceSurveyResponse,
                surveyId: receipt?.__ceSurveyId,
                submissionSlug: submittedCacheSlug,
              },
              submitContext,
            ).catch((error: any) => {
              surveyLog.warn('[SurveyQuestions] Local submit cache write-through failed:', error);
              return { questionCacheWritten: false, surveyCacheWritten: false };
            });
            if (!isSubmitContextCurrent(submitContext)) return;

            if (
              !cacheWriteResult?.questionCacheWritten &&
              typeof propsRef.current.refreshQuestionResponses === 'function'
            ) {
              const ids: SurveyQuestionsLegacyValue = Array.from(changedQids)
                .map((id: SurveyQuestionsLegacyValue) => normalizeQuestionIdKey(id))
                .filter(Boolean);
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
          } catch (e: any) {
            surveyLog.warn('SurveyTool: callback', e);
          }
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

  const renderQuestionAnswer = (
    question: SurveyQuestionsLegacyValue,
    response: SurveyQuestionsLegacyValue,
    index: SurveyQuestionsLegacyValue,
    isOwnResponse: SurveyQuestionsLegacyValue,
  ) => {
    if (!question || !response) {
      surveyLog.warn('renderQuestionAnswer: question or response is undefined');
      return null;
    }
    const promptReloading: SurveyQuestionsLegacyValue = isQuestionFieldBusy(question.id, 'prompt');
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

  const renderSurveyAnswers = (responses: SurveyQuestionsLegacyValue, isOwnResponse: SurveyQuestionsLegacyValue) => {
    return (
      <SurveyQuestionsSurveyAnswersView
        isOwnResponse={isOwnResponse}
        onWarning={(...args: SurveyQuestionsLegacyValue[]) => surveyLog.warn(...args)}
        questionPool={stateRef.current.questionPool}
        renderQuestionAnswer={renderQuestionAnswer}
        responses={responses}
      />
    );
  };

  const getMemoizedMaskedQuestionVisibility = (
    questionPoolInput: unknown,
    singleQuestionMode: unknown,
  ): SurveyQuestionsMaskedQuestionVisibilityState => {
    const fullQuestionPool = Array.isArray(questionPoolInput) ? questionPoolInput : EMPTY_QUESTION_POOL;
    const isSingleQuestionMode = !!singleQuestionMode;
    const modeKey = isSingleQuestionMode ? 'single' : 'multi';
    let memoByMode: SurveyQuestionsLegacyValue = null;
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

    const nextMemoByMode: SurveyQuestionsLegacyValue = memoByMode
      ? { ...memoByMode, [modeKey]: value }
      : { [modeKey]: value };
    try {
      inst._maskedQuestionVisibilityMemoByPool.set(fullQuestionPool, nextMemoByMode);
    } catch (e: any) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    return value;
  };

  const renderDefaultSurveyQuestionsRoute = () => {
    bumpSurveyPerfCounter('renderCount');
    const maskedQuestionVisibility = getMemoizedMaskedQuestionVisibility(
      stateRef.current.questionPool,
      propsRef.current.singleQuestionMode,
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
        <SurveyQuestionsRouteSurface renderReadiness={renderReadiness} loadingProgressState={fullLoadingProgress} />
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
    const submitFooterDisplayState: SurveyQuestionsSubmitFooterDisplayState =
      buildSurveyQuestionsSubmitFooterDisplayState({
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
      ? viewingAnswers
        ? jsonForDisplay
        : getResponseJson()
      : null;
    const canEditQuestions = submitFooterDisplayState.canEditQuestions;
    const authoringPanelDisplayState: SurveyQuestionsAuthoringPanelDisplayState =
      buildSurveyQuestionsAuthoringPanelDisplayState({
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
    const authoringRouteReadiness: SurveyQuestionsAuthoringRouteReadinessDescriptor =
      buildSurveyQuestionsAuthoringRouteReadinessDescriptor({
        canEditQuestions,
        gatedEmptyStateReady,
        hasCurrentSurveyResponseState: !!currentSurveyResponseState,
        questionPoolReady,
        visibleQuestionPool,
      });
    const renderedEditableQuestions: React.ReactNode = authoringRouteReadiness.shouldRenderEditableQuestions
      ? visibleQuestionPool.map((question: SurveyQuestionsLegacyValue, qIndex: SurveyQuestionsLegacyValue) =>
          renderQuestion(question, qIndex, currentSurveyResponseState),
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
