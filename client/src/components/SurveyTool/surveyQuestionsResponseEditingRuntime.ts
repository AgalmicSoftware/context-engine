import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsResponseEditingRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsResponseEditingRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsResponseEditingRuntime => {
  const {
    bottomRef,
    buildAdditionalEncryptionToggleResponseState,
    buildAdditionalUpdatePlan,
    buildAnswerEncryptionToggleResponseState,
    buildAnswerUpdatePlan,
    buildDisplayAnswerModeToggleState,
    buildEmptyResponseFieldState,
    buildEncryptionTogglePlan,
    buildInheritedAdditionalFieldState,
    buildParsedViewAddressAnswersState,
    buildShowJsonState,
    buildSurveyUserEditResponseStatePatch,
    fetchSingleQuestionData,
    fetchSurveyResponse,
    getEffectiveRecipientsForQid,
    getQuestionById,
    inst,
    invalidateDiffCaches,
    isQuestionLockedForResponse,
    normalizeFieldAudienceMode,
    normalizeQuestionIdKey,
    normalizeResponseEncryptionAudience,
    persistDraftSafely,
    propsRef,
    resolveFieldEncryptionAudience,
    resolveFieldEncryptionGateId,
    scheduleJsonPreviewUpdate,
    setState,
    stateRef,
    topRef,
    updateJsonPreview,
    updateSubmittedSinceLastEdit,
    utils,
    valuesEqual,
  } = context;

  const buildUpdatePlanDeps = () => ({
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

  const buildEncryptionToggleDeps = () => ({
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
  });

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
    const plan: SurveyQuestionsLegacyValue = buildAnswerUpdatePlan(
      questionId,
      answer,
      sourceSlice,
      buildUpdatePlanDeps(),
    );
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
    const plan: SurveyQuestionsLegacyValue = buildAdditionalUpdatePlan(
      questionId,
      additionalComments,
      sourceSlice,
      buildUpdatePlanDeps(),
    );
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
          deps: buildEncryptionToggleDeps(),
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
          deps: buildEncryptionToggleDeps(),
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
    } else if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScrollToTop = () => {
    if (!stateRef.current.showJson) {
      setState(buildShowJsonState(true), () => {
        if (topRef.current) {
          topRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      });
    } else if (topRef.current) {
      topRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return {
    handleAdditional,
    handleAnswer,
    handleConviction,
    handleImportance,
    handleScrollToTop,
    handleShowJsonAtBottom,
    toggleAdditionalCommentsEncryption,
    toggleAnswerEncryption,
    toggleDisplayAnswerMode,
  };
};
