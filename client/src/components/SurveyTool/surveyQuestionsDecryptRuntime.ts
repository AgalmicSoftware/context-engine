import type { SurveyQuestionsLegacyRecord, SurveyQuestionsLegacyValue } from './surveyQuestionsTypes.js';

export type SurveyQuestionsDecryptRuntime = SurveyQuestionsLegacyRecord;

export const createSurveyQuestionsDecryptRuntime = (
  context: SurveyQuestionsLegacyRecord,
): SurveyQuestionsDecryptRuntime => {
  const {
    buildAutoDecryptMaskedFieldSignatureHelper,
    buildClearedQuestionDecryptBusyTokensHelper,
    buildDecryptContextKeyFromContext,
    buildDecryptTaskKeyHelper,
    buildQuestionDecryptBusyTokenRegistrationHelper,
    buildQuestionDecryptExecutionContextHelper,
    buildQuestionDecryptFailureStateHelper,
    buildQuestionDecryptOwnedClearStateHelper,
    buildQuestionDecryptStartStateHelper,
    buildSelfQuestionDecryptBaselineHelper,
    buildSelfQuestionDecryptSuccessStateHelper,
    buildSliceFromUserAnswers,
    buildSurveyDecryptExecutionContextHelper,
    buildSurveyDecryptSourceStateHelper,
    buildSurveyDecryptSuccessStateHelper,
    buildViewedResponseDecryptBaselineHelper,
    buildViewedResponseDecryptSuccessStateHelper,
    cryptoUtils,
    decryptQuestionRatingEnvelopeMapHelper,
    decryptQuestionRatingEnvelopesHelper,
    deepClone,
    finalizeQuestionDecryptAttemptHelper,
    finalizeSurveyDecryptAttemptHelper,
    getLatestQuestionResponse,
    getQuestionFieldDecryptSelectionHelper,
    getQuestionFieldTaskKeyHelper,
    getSurveyResponse,
    getViewedResponseOverrideForQuestion,
    hydrateLatestQuestionDecryptStateHelper,
    inst,
    isAutoDecryptBlocked,
    maybeAutoDecryptVisibleFields,
    mergeLatestEncryptedQuestionFieldsHelper,
    mergeQuestionRatingEnvelopeStateHelper,
    mergeQuestionResponseOverrideIntoDecryptSliceHelper,
    normalizeBulkDecryptedSliceForSurveyStateHelper,
    normalizeSessionSlugValue,
    normalizeSingleQuestionViewedResponseHelper,
    ownsQuestionDecryptBusyTokensHelper,
    prepareQuestionDecryptAttemptHelper,
    prepareSelfQuestionDecryptStateHelper,
    prepareSurveyDecryptAttemptHelper,
    prepareViewedQuestionDecryptStateHelper,
    propsRef,
    readQuestionsCache,
    resolveDecryptHydrationContext,
    resolveDecryptSurveyId,
    resolveEffectiveSlug,
    resolveLatestSurveyDecryptResponseHelper,
    resolveQuestionDecryptHandlingModeHelper,
    runDedupedDecryptTaskHelper,
    scheduleMicrotask,
    stateRef,
    surveyLog,
    surveyQuestionReadsPort,
    syncDecryptedQuestionIntoBaselineHelper,
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
  };
};
