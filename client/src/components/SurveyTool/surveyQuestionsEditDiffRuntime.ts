import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsEditDiffRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsEditDiffRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsEditDiffRuntime => {
  const {
    areSurveyResponsesConsistent,
    buildIndexedQuestionEntryKeys,
    buildRatingEnvelopeQidSetFromUserAnswers,
    buildSliceFromUserAnswers,
    buildSurveyResponseSliceSignature,
    bumpSurveyPerfCounter,
    getActiveSurveyIndex,
    getCurrentRenderedQuestionIds,
    getDefaultResponseEncryptionAudience,
    getDefaultResponseEncryptionAudienceForQid,
    hasMeaningfulFieldValue,
    inst,
    measureSync,
    normalizeFieldAudienceMode,
    normalizeQuestionIdKey,
    normalizeResponseEncryptionAudience,
    orchestrateGetChangedQidsAndFields,
    propsRef,
    resolveDiffBaselineSlice,
    resolveFieldEncryptionGateId,
    stateRef,
    surveyLog,
    valuesEqual,
  } = context;

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
    } catch (e: unknown) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    return ids;
  };

  const getIndexedQuestionEntryKeys = (source: SurveyQuestionsLegacyValue) => {
    if (!source || typeof source !== 'object') return null;
    try {
      const cached: SurveyQuestionsLegacyValue = inst._normalizedQuestionEntryKeyCache.get(source);
      if (cached) return cached;
    } catch (e: unknown) {
      surveyLog.warn('SurveyTool: fallback', e);
    }
    const result: SurveyQuestionsLegacyValue = buildIndexedQuestionEntryKeys(source, normalizeQuestionIdKey);
    try {
      if (result) inst._normalizedQuestionEntryKeyCache.set(source, result);
    } catch (e: unknown) {
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

  return {
    areResponsesConsistent,
    getChangedQidsAndFields,
    getEditTrackingQuestionIds,
    getIndexedQuestionEntryKeys,
  };
};
