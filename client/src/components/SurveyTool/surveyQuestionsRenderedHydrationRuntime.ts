import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsRenderedHydrationRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsRenderedHydrationRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsRenderedHydrationRuntime => {
  const {
    buildDraftHydrationRunPlan,
    buildHydratingPriorResponsesState,
    buildNormalizedRenderedQuestionIds,
    buildRenderedQuestionIdsFromQuestionPools,
    buildSubmissionGroupContext,
    deepClone,
    engine,
    ensureQuestionsNet,
    executeSurveyDraftHydration,
    executeSurveyPriorResponseBackfill,
    getExtraQuestionReadSlugs,
    getPendingEditStats,
    getRuntimeStrategy,
    getSessionSlugByName,
    inst,
    loadDraft,
    normalizeSessionSlugValue,
    propsRef,
    readQuestionsCacheAsync,
    readRenderedQuestionIds,
    rehydrateLocalCacheAnswersForRenderedIds,
    resolveEffectiveSlug,
    resolveLocalCacheHydrationSignatureLookup,
    resolveQuestionSlugMapLookup,
    resolveResponseHydrationContext,
    resolveSlugForIds,
    resolveSurveyMissingRenderedResponseLookup,
    setResponseHydrationState,
    setState,
    stateRef,
    surveyLog,
    updateJsonPreview,
  } = context;

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
    } catch (e: unknown) {
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
    } catch (_: unknown) {
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

  return {
    buildLocalCacheHydrationSignature,
    ensurePriorResponsesForRenderedIds,
    getCurrentRenderedQuestionIds,
    getHydrationQuestionIds,
    getMissingRenderedResponseIdsForAccount,
    getRenderedQuestionIdsForResponseHydration,
    rehydrateDraftForRenderedIds,
    resolveQuestionSlugMapForIds,
    resolveSubmissionGroupContext,
  };
};
