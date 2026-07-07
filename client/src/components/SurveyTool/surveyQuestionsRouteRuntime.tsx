import type * as React from 'react';
import type {
  SurveyQuestionsAuthoringPanelDisplayState,
  SurveyQuestionsAuthoringRouteReadinessDescriptor,
  SurveyQuestionsFullLoadingProgressState,
  SurveyQuestionsJsonPanelDisplayState,
  SurveyQuestionsLegacyRecord,
  SurveyQuestionsLegacyValue,
  SurveyQuestionsMaskedQuestionVisibilityState,
  SurveyQuestionsRenderReadinessDescriptor,
  SurveyQuestionsRouteViewDisplayState,
  SurveyQuestionsSubmitFooterDisplayState,
  SurveyQuestionsSubmitReadinessDescriptor,
} from './surveyQuestionsTypes.js';
import type { SurveyQuestionsSubmitPendingStats } from './surveyQuestionsSubmitController.js';

export type SurveyQuestionsRouteRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsRouteRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsRouteRuntime => {
  const {
    EMPTY_QUESTION_POOL,
    SurveyQuestionsRouteSurface,
    bottomRef,
    beginQuestionDisplayRender,
    buildSurveyQuestionsAuthoringPanelDisplayState,
    buildSurveyQuestionsAuthoringRouteReadinessDescriptor,
    buildSurveyQuestionsFullLoadingProgressState,
    buildSurveyQuestionsJsonForDisplayState,
    buildSurveyQuestionsJsonPanelDisplayState,
    buildSurveyQuestionsJsonPreviewDisplayState,
    buildSurveyQuestionsLayoutDisplayState,
    buildSurveyQuestionsMaskedQuestionVisibility,
    buildSurveyQuestionsRenderReadinessDescriptor,
    buildSurveyQuestionsRouteJsonControlsProps,
    buildSurveyQuestionsRouteViewDisplayState,
    buildSurveyQuestionsSubmitFooterDisplayState,
    buildSurveyQuestionsSubmitReadinessDescriptor,
    bumpSurveyPerfCounter,
    closeQuestionTagModal,
    computeSubmitLabel,
    copyJsonToClipboard,
    engine,
    getMemoizedLockedQuestionGateDetails,
    getPendingStatsSnapshot,
    getQuestionsJson,
    getResponseJson,
    getShortenedAddress,
    getSurveyJson,
    handleDecryptEdit,
    handleExitEditing,
    handlePrimarySubmitClick,
    handleRevertPendingChanges,
    handleScrollToTop,
    handleShowJsonAtBottom,
    handleStartFresh,
    hasMaskedCurrentQuestionPayload,
    inst,
    isMaskedPromptText,
    jsonTreeDisplay,
    propsRef,
    renderLockedQuestionsPanel,
    renderQuestion,
    renderQuestionAnswer,
    renderSurveyAnswers,
    resolveEffectiveSlug,
    stateRef,
    styles,
    surveyLog,
    toggleDisplayAnswerMode,
    toggleShowQuestionsJson,
    toggleShowResponseJson,
    toggleShowSurveyJson,
    topRef,
  } = context;

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
    } catch (_: unknown) {
      memoByMode = null;
    }
    if (memoByMode && memoByMode[modeKey]) {
      bumpSurveyPerfCounter('maskedVisibilityMemoHitCount');
      return memoByMode[modeKey];
    }
    bumpSurveyPerfCounter('maskedVisibilityMemoMissCount');
    bumpSurveyPerfCounter('maskedVisibilityPoolSizeOnMiss', fullQuestionPool.length);

    const value: SurveyQuestionsMaskedQuestionVisibilityState = buildSurveyQuestionsMaskedQuestionVisibility({
      isMaskedPromptText,
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
    } catch (e: unknown) {
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

    const pendingStats: SurveyQuestionsSubmitPendingStats = getPendingStatsSnapshot();
    const suffix = pendingStats.total === 1 ? 'Response' : 'Responses';

    const submitButtonText = isSingleQuestionView
      ? 'SUBMIT'
      : (propsRef.current.computeSubmitLabel || computeSubmitLabel)(engine, {
          suffix,
          pendingStats,
        });
    const submitReadiness: SurveyQuestionsSubmitReadinessDescriptor = buildSurveyQuestionsSubmitReadinessDescriptor({
      currentStep: stateRef.current.currentStep,
      isSubmitting: stateRef.current.isSubmitting,
      pendingStats,
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
    beginQuestionDisplayRender?.();
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
          topRef,
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
          renderQuestionAnswer,
          renderSurveyAnswers,
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
          renderQuestionAnswer,
          renderSurveyAnswers,
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
          bottomRef,
          copiedQuestionsJson: stateRef.current.copiedQuestionsJson,
          copiedResponseJson: stateRef.current.copiedResponseJson,
          copiedSurveyJson: stateRef.current.copiedSurveyJson,
          copyJsonToClipboard,
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
    getMemoizedMaskedQuestionVisibility,
    renderDefaultSurveyQuestionsRoute,
  };
};
