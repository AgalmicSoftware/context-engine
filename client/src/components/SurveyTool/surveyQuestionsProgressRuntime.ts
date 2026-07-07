import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsProgressRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsProgressRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsProgressRuntime => {
  const {
    buildBookmarkedQuestionsState,
    buildClearedTransientSubmitFeedbackState,
    buildEditStatsState,
    buildEmptyResponseFieldState,
    buildInitialSurveyResponseQuestionIds,
    buildInitializedSurveyResponseState,
    buildQuestionPoolPendingSubmitFeedbackMessage,
    buildSurveyQuestionPoolLoadState,
    buildTransientSubmitFeedbackState,
    computeModifiedQuestionsCount,
    engine,
    fetchQuestionPool,
    getCurrentRenderedQuestionIds,
    getPendingEditStats,
    getRuntimeStrategy,
    handleStartFresh,
    inst,
    normalizeTransientSubmitFeedbackDurationMs,
    peekCacheSync,
    propsRef,
    readCache,
    readRenderedQuestionIds,
    resolveDiffBaselineSlice,
    resolveEffectiveSlug,
    setState,
    shouldSurveyAutoStartFresh,
    stateRef,
    surveyLog,
    writeCacheOptimistic,
  } = context;

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
    } catch (error: unknown) {
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

    // Update state first for immediate UI feedback.
    setState(buildBookmarkedQuestionsState(obj.questions));

    void writeCacheOptimistic('bookmarksCache', slug, obj).catch((error: unknown) => {
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

    // Prefer explicit session baseline; else derive from last saved answers; else derive from local cache; else empty.
    const baselineSlice: SurveyQuestionsLegacyValue = resolveDiffBaselineSlice(true);

    // Compute how many questions actually changed vs. the baseline.
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
    } catch (e: unknown) {
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
    void fetchQuestionPool().catch((error: unknown) => {
      surveyLog.warn('SurveyQuestions: submit-triggered question pool refresh failed.', error);
    });
    return true;
  };

  return {
    checkAndHandleStartFresh,
    getAnsweredQuestionsCount,
    getSurveyQuestionPoolLoadState,
    handleBookmarkToggle,
    initializeSurveyResponseState,
    loadBookmarks,
    maybeBlockSubmitUntilQuestionPoolComplete,
    recalculateEditStats,
    showTransientSubmitFeedback,
  };
};
