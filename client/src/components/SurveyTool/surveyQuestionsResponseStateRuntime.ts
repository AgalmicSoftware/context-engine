import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsResponseStateRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsResponseStateRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsResponseStateRuntime => {
  const {
    DEBUG_PREFILL,
    areEnvelopesEquivalent,
    buildDraftAnswersByQuestionId,
    buildDraftAwareCacheHydrationState,
    buildEmptyResponseFieldState,
    buildHydratedResponseSlice,
    buildLocalCacheHydrationSignature,
    buildSurveyLocalCacheSlice,
    bumpSurveyPerfCounter,
    clearDraft,
    engine,
    ensurePriorResponsesForRenderedIds,
    executeSurveyFormStateReset,
    executeSurveyLocalCacheRehydrate,
    executeSurveyPendingRevert,
    executeSurveyResponsePrefill,
    getCurrentRenderedQuestionIds,
    getEditTrackingQuestionIds,
    getExtraQuestionReadSlugs,
    getHydrationQuestionIds,
    initializeSurveyResponseState,
    inst,
    loadDraft,
    mergeQuestionResponses,
    normalizeQuestionIdKey,
    normalizeSessionSlugValue,
    persistDraft,
    propsRef,
    readQuestionsCache,
    recalculateEditStats,
    resolveResponseHydrationContext,
    resolveSurveyBaselineSourceSlice,
    setResponseHydrationState,
    setState,
    stateRef,
    surveyLog,
    updateJsonPreview,
    updateSubmittedSinceLastEdit,
  } = context;

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
        } catch (e: unknown) {
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

  return {
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
  };
};
