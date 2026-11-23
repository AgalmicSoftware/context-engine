import type { ResponseValuesEqual } from './responseValueEquality';
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
    resolveDiffBaselineSlice,
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
    valuesEqual: (...args: Parameters<ResponseValuesEqual>) => valuesEqual(...args),
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
      if (afterUpdate) afterUpdate();
      return;
    }

    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) => {
        const baseState: SurveyQuestionsLegacyValue = prev || stateRef.current;
        const newSurveysResponseState: SurveyQuestionsLegacyValue = [...(baseState.surveysResponseState || [])];
        const slice: SurveyQuestionsLegacyValue = {
          ...(newSurveysResponseState[surveyIndex] || {
            answers: {},
            importance: {},
            conviction: {},
            additionalComments: {},
          }),
        };
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
        return buildSurveyUserEditResponseStatePatch(
          newSurveysResponseState,
          updateSubmittedSinceLastEdit(baseState.submittedSinceLastEdit, 'user_edit'),
        );
      },
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
    const plan: SurveyQuestionsLegacyValue = buildAdditionalUpdatePlan(
      questionId,
      additionalComments,
      sourceSlice,
      buildUpdatePlanDeps(),
    );
    if (!plan.changed) {
      if (afterUpdate) afterUpdate();
      return;
    }

    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) => {
        const baseState: SurveyQuestionsLegacyValue = prev || stateRef.current;
        const newSurveysResponseState: SurveyQuestionsLegacyValue = [...(baseState.surveysResponseState || [])];
        const slice: SurveyQuestionsLegacyValue = {
          ...(newSurveysResponseState[surveyIndex] || {
            answers: {},
            importance: {},
            conviction: {},
            additionalComments: {},
          }),
        };
        slice.additionalComments = {
          ...(slice.additionalComments || {}),
          [questionId]: plan.nextAdditionalState,
        };

        newSurveysResponseState[surveyIndex] = slice;
        return buildSurveyUserEditResponseStatePatch(
          newSurveysResponseState,
          updateSubmittedSinceLastEdit(baseState.submittedSinceLastEdit, 'user_edit'),
        );
      },
      () => {
        scheduleJsonPreviewUpdate();
        if (shouldPersistDraft) persistDraftSafely();
        if (afterUpdate) afterUpdate();
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
    if (priorValue === conviction) {
      if (afterUpdate) afterUpdate();
      return;
    }
    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) => {
        const baseState: SurveyQuestionsLegacyValue = prev || stateRef.current;
        const newSurveysResponseState: SurveyQuestionsLegacyValue = [...(baseState.surveysResponseState || [])];
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
        return buildSurveyUserEditResponseStatePatch(
          newSurveysResponseState,
          updateSubmittedSinceLastEdit(baseState.submittedSinceLastEdit, 'user_edit'),
        );
      },
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
    if (priorValue === importance) {
      if (afterUpdate) afterUpdate();
      return;
    }
    if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
    invalidateDiffCaches();

    setState(
      (prev: SurveyQuestionsLegacyValue) => {
        const baseState: SurveyQuestionsLegacyValue = prev || stateRef.current;
        const newSurveysResponseState: SurveyQuestionsLegacyValue = [...(baseState.surveysResponseState || [])];
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
        return buildSurveyUserEditResponseStatePatch(
          newSurveysResponseState,
          updateSubmittedSinceLastEdit(baseState.submittedSinceLastEdit, 'user_edit'),
        );
      },
      () => {
        scheduleJsonPreviewUpdate();
        if (shouldPersistDraft) persistDraftSafely();
        if (afterUpdate) afterUpdate();
      },
    );
  };

  // The slider's X undoes it: the slider closes and both ratings return to their submitted
  // values, so a question never submitted holds none. A saved rating is restored, not removed:
  // the draft cannot record a removed rating, and locked or encrypted answers resend the saved one.
  const clearConvictionImportance = (
    surveyIndex: SurveyQuestionsLegacyValue,
    rawQuestionId: SurveyQuestionsLegacyValue,
  ) => {
    surveyIndex = propsRef.current.isStandalone || propsRef.current.singleQuestionMode ? 0 : surveyIndex;
    const questionId: SurveyQuestionsLegacyValue = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId) return;
    // Maps may key the question in another case or spacing.
    const keysFor = (map: SurveyQuestionsLegacyValue): string[] =>
      Object.keys(map || {}).filter((key) => normalizeQuestionIdKey(key) === questionId);
    const without = (map: SurveyQuestionsLegacyValue) => {
      const next = { ...(map || {}) };
      keysFor(map).forEach((key) => delete next[key]);
      return next;
    };
    const ratingIn = (map: SurveyQuestionsLegacyValue): number | null => {
      const value = [questionId, ...keysFor(map)]
        .map((key) => map?.[key])
        .find((candidate) => candidate !== undefined && candidate !== null && !Number.isNaN(Number(candidate)));
      return value === undefined ? null : Number(value);
    };
    const RATINGS = ['conviction', 'importance'] as const;
    const baseline: SurveyQuestionsLegacyValue = resolveDiffBaselineSlice(true);
    const saved = Object.fromEntries(RATINGS.map((field) => [field, ratingIn(baseline?.[field])]));
    const slice: SurveyQuestionsLegacyValue = stateRef.current.surveysResponseState?.[surveyIndex];
    const changes = RATINGS.some((field) => ratingIn(slice?.[field]) !== saved[field]);
    if (changes) {
      if (inst._draftDirtyQids) inst._draftDirtyQids.add(questionId);
      invalidateDiffCaches();
    }

    setState(
      (prev: SurveyQuestionsLegacyValue) => {
        const baseState: SurveyQuestionsLegacyValue = prev || stateRef.current;
        const closed = {
          sliderModeByQuestion: without(baseState.sliderModeByQuestion),
          sliderToggleExpandedByQuestion: without(baseState.sliderToggleExpandedByQuestion),
        };
        if (!changes) return closed;
        const newSurveysResponseState: SurveyQuestionsLegacyValue = [...(baseState.surveysResponseState || [])];
        const current: SurveyQuestionsLegacyValue = newSurveysResponseState[surveyIndex] || {};
        const restored = (field: (typeof RATINGS)[number]) => ({
          ...without(current[field]),
          ...(saved[field] === null ? null : { [questionId]: saved[field] }),
        });
        newSurveysResponseState[surveyIndex] = {
          ...current,
          conviction: restored('conviction'),
          importance: restored('importance'),
        };
        return {
          ...closed,
          ...buildSurveyUserEditResponseStatePatch(
            newSurveysResponseState,
            updateSubmittedSinceLastEdit(baseState.submittedSinceLastEdit, 'user_edit'),
          ),
        };
      },
      () => {
        if (!changes) return;
        scheduleJsonPreviewUpdate();
        persistDraftSafely(0);
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
    clearConvictionImportance,
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
