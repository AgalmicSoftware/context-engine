import { normalizeQuestionIdKey } from './surveyToolSignatures.js';

type UnknownRecord = Record<string, unknown>;

type ResponseSlice = {
  answers?: Record<string, unknown> | null;
  importance?: Record<string, unknown> | null;
  conviction?: Record<string, unknown> | null;
  additionalComments?: Record<string, unknown> | null;
} & UnknownRecord;

type DraftPayload = {
  answers?: Record<string, unknown> | null;
  baseline?: Record<string, unknown> | null;
} & UnknownRecord;

type DraftHydrationApplyArgs = {
  targetSlice?: ResponseSlice | null;
  questionId?: string;
  draftEntry?: unknown;
  allowOverwrite?: boolean;
};

type BuildDraftHydrationStateArgs = {
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  draft?: DraftPayload | null;
  prevSlice?: ResponseSlice | null;
  prevBaseline?: ResponseSlice | null;
  allowOverwrite?: boolean;
  cloneBaseline?: ((baseline: ResponseSlice | null | undefined) => ResponseSlice) | null;
  applyDraftEntryToSlice?: ((args: DraftHydrationApplyArgs) => boolean) | null;
};

type CachedQuestionResponseMap = Record<string, unknown>;

type CachedQuestionResponses = Record<string, CachedQuestionResponseMap>;

type ParsedCachedResponse = {
  answer?: unknown;
  additional?: unknown;
} & UnknownRecord;

type CachedResponseApplyArgs = {
  targetSlice?: ResponseSlice | null;
  questionId?: string;
  response?: unknown;
  parseValue?: ((value: unknown) => unknown) | null;
};

type ResponseHydrationApplyArgs = {
  targetSlice?: ResponseSlice | null;
  currentSlice?: ResponseSlice | null;
  responses?: unknown[];
  allowOverwrite?: boolean;
  parseValue?: ((value: unknown) => unknown) | null;
  questionIdResolver?: ((response: unknown) => string | null | undefined) | null;
};

type ApplyResponseHydrationListToSlice = ((args: ResponseHydrationApplyArgs) => boolean) | null;

type BuildCacheHydrationSliceArgs = {
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  mergedQuestionResponses?: CachedQuestionResponses | null;
  account?: unknown;
  parseResponse?: ((raw: unknown) => unknown) | null;
  applyCachedResponseEntryToSlice?: ((args: CachedResponseApplyArgs) => boolean) | null;
  parseValue?: ((value: unknown) => unknown) | null;
};

type BuildPrefilledSurveyStateArgs = {
  surveyIndex?: unknown;
  prevSurveysResponseState?: unknown[] | null;
  prevEditBaseline?: ResponseSlice | null;
  isDirty?: boolean;
  submissionComplete?: boolean;
  responses?: unknown[];
  applyResponseHydrationListToSlice?: ApplyResponseHydrationListToSlice;
  buildSliceFromUserAnswers?: ((userAnswers: unknown, prevSlice?: ResponseSlice | null) => ResponseSlice | null) | null;
};

type BuildHydratedResponseSliceArgs = {
  userAnswers?: unknown;
  prevSlice?: ResponseSlice | null;
  applyResponseHydrationListToSlice?: ApplyResponseHydrationListToSlice;
  parseValue?: ((value: unknown) => unknown) | null;
  questionIdResolver?: ((response: unknown) => string | null | undefined) | null;
};

type BuildSurveyResponseStateArrayArgs = {
  prevSurveysResponseState?: unknown[] | null;
  surveyIndex?: unknown;
  nextSlice?: ResponseSlice | null;
};

type BuildPrefilledSingleQuestionStateArgs = {
  surveyIndex?: unknown;
  questionId?: unknown;
  prevSurveysResponseState?: unknown[] | null;
  prevEditBaseline?: ResponseSlice | null;
  isDirty?: boolean;
  submissionComplete?: boolean;
  userAnswer?: unknown;
  applyResponseHydrationListToSlice?: ApplyResponseHydrationListToSlice;
  buildSliceFromUserAnswers?: ((userAnswers: unknown, prevSlice?: ResponseSlice | null) => ResponseSlice | null) | null;
};

type BuildLocalCacheHydrationMemoKeyArgs = {
  scopeSlugs?: unknown[];
  networkIdStr?: unknown;
  account?: unknown;
  renderedSignature?: unknown;
  questionsCacheNonce?: unknown;
  questionResponsesNonce?: unknown;
  normalizeSessionSlugValue?: ((value: unknown) => string) | null;
};

type BuildMergedHydrationQuestionResponsesArgs = {
  scopeSlugs?: unknown[];
  networkIdStr?: unknown;
  readQuestionsCache?: ((slug: string) => unknown) | null;
  mergeQuestionResponses?: ((target: CachedQuestionResponses, source: CachedQuestionResponses) => void) | null;
};

type BuildRevertedResponseSliceArgs = {
  baselineSlice?: ResponseSlice | null;
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  cloneFieldState?: ((value: unknown) => unknown) | null;
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
};

type DraftAwareCacheHydrationStateArgs = {
  cachedAnswer?: unknown;
  cachedAdditional?: unknown;
  draftEntry?: unknown;
  currentAnswer?: unknown;
  currentAdditional?: unknown;
  baselineAnswer?: unknown;
  baselineAdditional?: unknown;
  areEnvelopesEquivalent?: ((incomingEnvelope: unknown, currentEnvelope: unknown, incomingEncrypted?: unknown, currentEncrypted?: unknown) => boolean) | null;
};

type LocalCacheHydrationApplyArgs = {
  targetSlice?: ResponseSlice | null;
  questionId?: string;
  cachedAnswer?: unknown;
  cachedAdditional?: unknown;
  cachedImportance?: unknown;
  cachedConviction?: unknown;
  allowMaskedAnswerDraftEmpty?: boolean;
  allowMaskedAdditionalDraftEmpty?: boolean;
  debugLabel?: string;
};

type BuildLocalCacheRehydrationStateArgs = {
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  baseSlice?: ResponseSlice | null;
  prevBaseline?: ResponseSlice | null;
  cacheSlice?: ResponseSlice | null;
  draftAnswersByQuestionId?: Record<string, unknown> | null;
  cloneBaseline?: ((baseline: ResponseSlice | null | undefined) => ResponseSlice) | null;
  buildDraftAwareCacheHydrationState?: ((args: DraftAwareCacheHydrationStateArgs) => {
    effectiveAnswerState?: unknown;
    effectiveAdditionalState?: unknown;
    canReplaceMaskedAnswerWithDraftEmpty?: boolean;
    canReplaceMaskedAdditionalWithDraftEmpty?: boolean;
    canReplaceMaskedBaselineAnswerWithDraftEmpty?: boolean;
    canReplaceMaskedBaselineAdditionalWithDraftEmpty?: boolean;
  }) | null;
  applyLocalCacheHydrationEntryToSlice?: ((args: LocalCacheHydrationApplyArgs) => boolean) | null;
  debugLabel?: string;
};

const buildEmptyResponseSlice = (): ResponseSlice => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

const isRecord = (value: unknown): value is UnknownRecord => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

const resolveDraftAwareCachedField = ({
  cachedField = null,
  draftValue = undefined,
  draftEncrypted = undefined,
  draftEnvelope = '',
  areEnvelopesEquivalent = null,
}: {
  cachedField?: unknown;
  draftValue?: unknown;
  draftEncrypted?: unknown;
  draftEnvelope?: unknown;
  areEnvelopesEquivalent?: ((incomingEnvelope: unknown, currentEnvelope: unknown, incomingEncrypted?: unknown, currentEncrypted?: unknown) => boolean) | null;
}) => {
  const nextCachedField = isRecord(cachedField) ? cachedField : null;
  if (
    nextCachedField &&
    nextCachedField.value === '*' &&
    draftValue === '' &&
    typeof areEnvelopesEquivalent === 'function' &&
    areEnvelopesEquivalent(
      String(draftEnvelope || ''),
      String(nextCachedField.encryptedPortion || ''),
      draftEncrypted,
      nextCachedField.encrypted,
    )
  ) {
    return { ...nextCachedField, value: '' };
  }
  return nextCachedField;
};

const canReplaceMaskedFieldWithDraftEmpty = ({
  currentField = null,
  effectiveCachedField = null,
  areEnvelopesEquivalent = null,
}: {
  currentField?: unknown;
  effectiveCachedField?: unknown;
  areEnvelopesEquivalent?: ((incomingEnvelope: unknown, currentEnvelope: unknown, incomingEncrypted?: unknown, currentEncrypted?: unknown) => boolean) | null;
}) => {
  const nextCurrentField = isRecord(currentField) ? currentField : null;
  const nextEffectiveField = isRecord(effectiveCachedField) ? effectiveCachedField : null;
  return !!(
    nextEffectiveField &&
    nextEffectiveField.value === '' &&
    nextCurrentField?.value === '*' &&
    typeof areEnvelopesEquivalent === 'function' &&
    areEnvelopesEquivalent(
      nextCurrentField.encryptedPortion,
      nextEffectiveField.encryptedPortion,
      nextCurrentField.encrypted,
      nextEffectiveField.encrypted,
    )
  );
};

export const buildDraftHydrationState = ({
  renderedQuestionIds = [],
  draft = null,
  prevSlice = null,
  prevBaseline = null,
  allowOverwrite = false,
  cloneBaseline = null,
  applyDraftEntryToSlice = null,
}: BuildDraftHydrationStateArgs = {}) => {
  const normalizedPrevSlice = prevSlice && typeof prevSlice === 'object' ? prevSlice : buildEmptyResponseSlice();
  const nextSlice: ResponseSlice = {
    answers: { ...((normalizedPrevSlice.answers as Record<string, unknown>) || {}) },
    importance: { ...((normalizedPrevSlice.importance as Record<string, unknown>) || {}) },
    conviction: { ...((normalizedPrevSlice.conviction as Record<string, unknown>) || {}) },
    additionalComments: { ...((normalizedPrevSlice.additionalComments as Record<string, unknown>) || {}) },
  };
  const nextBaseline: ResponseSlice = typeof cloneBaseline === 'function'
    ? cloneBaseline(prevBaseline && typeof prevBaseline === 'object' ? prevBaseline : buildEmptyResponseSlice())
    : buildEmptyResponseSlice();

  let changed = false;
  let baselineChanged = false;
  const answers = draft && typeof draft === 'object' ? draft.answers || {} : {};
  const baseline = draft && typeof draft === 'object' ? draft.baseline || {} : {};

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || typeof applyDraftEntryToSlice !== 'function') return;

    const answerEntry = (answers && typeof answers === 'object') ? answers[questionId] : null;
    if (answerEntry && applyDraftEntryToSlice({
      targetSlice: nextSlice,
      questionId,
      draftEntry: answerEntry,
      allowOverwrite,
    })) {
      changed = true;
    }

    const baselineEntry = (baseline && typeof baseline === 'object') ? baseline[questionId] : null;
    if (baselineEntry && applyDraftEntryToSlice({
      targetSlice: nextBaseline,
      questionId,
      draftEntry: baselineEntry,
      allowOverwrite,
    })) {
      baselineChanged = true;
    }
  });

  return {
    nextSlice,
    nextBaseline,
    changed,
    baselineChanged,
  };
};

export const buildCacheHydrationSlice = ({
  renderedQuestionIds = [],
  mergedQuestionResponses = null,
  account = '',
  parseResponse = null,
  applyCachedResponseEntryToSlice = null,
  parseValue = null,
}: BuildCacheHydrationSliceArgs = {}) => {
  const slice = buildEmptyResponseSlice();
  const normalizedAccount = String(account || '').toLowerCase();
  const responses: CachedQuestionResponses = mergedQuestionResponses && typeof mergedQuestionResponses === 'object'
    ? mergedQuestionResponses as CachedQuestionResponses
    : {};
  let changed = false;

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || typeof applyCachedResponseEntryToSlice !== 'function') return;

    const questionMap = responses[questionId];
    if (!questionMap || typeof questionMap !== 'object') return;

    const rawResponse = normalizedAccount ? questionMap[normalizedAccount] : null;
    if (!rawResponse) return;

    const parsedResponse = typeof parseResponse === 'function'
      ? parseResponse(rawResponse)
      : rawResponse;
    if (!isRecord(parsedResponse)) return;
    const hydratedResponse = parsedResponse as ParsedCachedResponse;
    if (!hydratedResponse.answer || !hydratedResponse.additional) return;

    if (applyCachedResponseEntryToSlice({
      targetSlice: slice,
      questionId,
      response: hydratedResponse,
      parseValue,
    })) {
      changed = true;
    }
  });

  return { slice, changed };
};

export const buildHydratedResponseSlice = ({
  userAnswers = null,
  prevSlice = null,
  applyResponseHydrationListToSlice = null,
  parseValue = null,
  questionIdResolver = null,
}: BuildHydratedResponseSliceArgs = {}) => {
  const slice = buildEmptyResponseSlice();
  if (!userAnswers) return slice;

  const normalizedAnswers = isRecord(userAnswers) ? userAnswers : null;
  const responses = Array.isArray(normalizedAnswers?.responses)
    ? normalizedAnswers.responses
    : [userAnswers];

  if (typeof applyResponseHydrationListToSlice === 'function') {
    const hydrationArgs: ResponseHydrationApplyArgs = {
      targetSlice: slice,
      currentSlice: prevSlice,
      responses,
      allowOverwrite: true,
      parseValue,
    };
    if (typeof questionIdResolver === 'function') {
      hydrationArgs.questionIdResolver = questionIdResolver;
    }
    applyResponseHydrationListToSlice(hydrationArgs);
  }

  return slice;
};

export const buildLocalCacheHydrationMemoKey = ({
  scopeSlugs = [],
  networkIdStr = '',
  account = '',
  renderedSignature = '',
  questionsCacheNonce = 0,
  questionResponsesNonce = 0,
  normalizeSessionSlugValue = null,
}: BuildLocalCacheHydrationMemoKeyArgs = {}) => [
  Array.isArray(scopeSlugs)
    ? scopeSlugs
      .map((value) => (typeof normalizeSessionSlugValue === 'function'
        ? normalizeSessionSlugValue(value)
        : String(value || '')))
      .join(',')
    : '',
  String(networkIdStr || ''),
  String(account || ''),
  String(renderedSignature || ''),
  Number(questionsCacheNonce || 0),
  Number(questionResponsesNonce || 0),
].join('|');

export const buildMergedHydrationQuestionResponses = ({
  scopeSlugs = [],
  networkIdStr = '',
  readQuestionsCache = null,
  mergeQuestionResponses = null,
}: BuildMergedHydrationQuestionResponsesArgs = {}) => {
  const mergedQuestionResponses: CachedQuestionResponses = {};
  const networkId = String(networkIdStr || '');
  if (!networkId || !Array.isArray(scopeSlugs) || typeof readQuestionsCache !== 'function' || typeof mergeQuestionResponses !== 'function') {
    return mergedQuestionResponses;
  }

  scopeSlugs.forEach((rawScopeSlug) => {
    const scopeSlug = String(rawScopeSlug || '');
    if (!scopeSlug) return;
    let questionsCache = readQuestionsCache(scopeSlug);
    if (!questionsCache || typeof questionsCache !== 'object') questionsCache = {};
    const networkCache = isRecord(questionsCache) ? questionsCache[networkId] : null;
    const questionResponses = isRecord(networkCache) && isRecord(networkCache.questionResponses)
      ? networkCache.questionResponses as CachedQuestionResponses
      : {};
    mergeQuestionResponses(mergedQuestionResponses, questionResponses);
  });

  return mergedQuestionResponses;
};

export const buildSurveyResponseStateArray = ({
  prevSurveysResponseState = null,
  surveyIndex = 0,
  nextSlice = null,
}: BuildSurveyResponseStateArrayArgs = {}) => {
  const normalizedSurveyIndex = Math.max(0, Number(surveyIndex) || 0);
  const nextSurveysResponseState = Array.isArray(prevSurveysResponseState)
    ? [...prevSurveysResponseState]
    : [];

  while (nextSurveysResponseState.length <= normalizedSurveyIndex) {
    nextSurveysResponseState.push(buildEmptyResponseSlice());
  }

  if (nextSlice && typeof nextSlice === 'object') {
    nextSurveysResponseState[normalizedSurveyIndex] = nextSlice;
  }

  return nextSurveysResponseState;
};

export const buildPrefilledSurveyState = ({
  surveyIndex = 0,
  prevSurveysResponseState = null,
  prevEditBaseline = null,
  isDirty = false,
  submissionComplete = false,
  responses = [],
  applyResponseHydrationListToSlice = null,
  buildSliceFromUserAnswers = null,
}: BuildPrefilledSurveyStateArgs = {}) => {
  const normalizedSurveyIndex = Math.max(0, Number(surveyIndex) || 0);
  const currentStateArr = Array.isArray(prevSurveysResponseState) ? prevSurveysResponseState : [];
  const currentSlice = currentStateArr[normalizedSurveyIndex] && typeof currentStateArr[normalizedSurveyIndex] === 'object'
    ? currentStateArr[normalizedSurveyIndex] as ResponseSlice
    : buildEmptyResponseSlice();
  const allowOverwrite = !isDirty && !submissionComplete;

  const nextSurveysResponseState = buildSurveyResponseStateArray({
    prevSurveysResponseState: currentStateArr,
    surveyIndex: normalizedSurveyIndex,
  });
  const targetSeed = nextSurveysResponseState[normalizedSurveyIndex] && typeof nextSurveysResponseState[normalizedSurveyIndex] === 'object'
    ? nextSurveysResponseState[normalizedSurveyIndex] as ResponseSlice
    : buildEmptyResponseSlice();
  const nextSlice: ResponseSlice = {
    answers: { ...((targetSeed.answers as Record<string, unknown>) || {}) },
    importance: { ...((targetSeed.importance as Record<string, unknown>) || {}) },
    conviction: { ...((targetSeed.conviction as Record<string, unknown>) || {}) },
    additionalComments: { ...((targetSeed.additionalComments as Record<string, unknown>) || {}) },
  };

  if (typeof applyResponseHydrationListToSlice === 'function') {
    applyResponseHydrationListToSlice({
      targetSlice: nextSlice,
      currentSlice,
      responses,
      allowOverwrite,
    });
  }

  nextSurveysResponseState[normalizedSurveyIndex] = nextSlice;
  const baseline = typeof buildSliceFromUserAnswers === 'function'
    ? buildSliceFromUserAnswers({ responses }, prevEditBaseline || currentSlice)
    : null;

  return {
    nextSurveysResponseState,
    nextBaseline: baseline,
    shouldWriteBaseline: !submissionComplete,
  };
};

export const buildPrefilledSingleQuestionState = ({
  surveyIndex = 0,
  questionId = '',
  prevSurveysResponseState = null,
  prevEditBaseline = null,
  isDirty = false,
  submissionComplete = false,
  userAnswer = null,
  applyResponseHydrationListToSlice = null,
  buildSliceFromUserAnswers = null,
}: BuildPrefilledSingleQuestionStateArgs = {}) => {
  const normalizedQuestionId = normalizeQuestionIdKey(questionId);
  const normalizedSurveyIndex = Math.max(0, Number(surveyIndex) || 0);
  const currentStateArr = Array.isArray(prevSurveysResponseState) ? prevSurveysResponseState : [];
  const currentSlice = currentStateArr[normalizedSurveyIndex] && typeof currentStateArr[normalizedSurveyIndex] === 'object'
    ? currentStateArr[normalizedSurveyIndex] as ResponseSlice
    : buildEmptyResponseSlice();
  const allowOverwrite = !isDirty && !submissionComplete;

  const nextSurveysResponseState = buildSurveyResponseStateArray({
    prevSurveysResponseState: currentStateArr,
    surveyIndex: normalizedSurveyIndex,
  });
  const targetSeed = nextSurveysResponseState[normalizedSurveyIndex] && typeof nextSurveysResponseState[normalizedSurveyIndex] === 'object'
    ? nextSurveysResponseState[normalizedSurveyIndex] as ResponseSlice
    : buildEmptyResponseSlice();
  const nextSlice: ResponseSlice = {
    answers: { ...((targetSeed.answers as Record<string, unknown>) || {}) },
    importance: { ...((targetSeed.importance as Record<string, unknown>) || {}) },
    conviction: { ...((targetSeed.conviction as Record<string, unknown>) || {}) },
    additionalComments: { ...((targetSeed.additionalComments as Record<string, unknown>) || {}) },
  };

  if (normalizedQuestionId && userAnswer && typeof applyResponseHydrationListToSlice === 'function') {
    applyResponseHydrationListToSlice({
      targetSlice: nextSlice,
      currentSlice,
      responses: [userAnswer],
      allowOverwrite,
      questionIdResolver: () => normalizedQuestionId,
    });
  }

  nextSurveysResponseState[normalizedSurveyIndex] = nextSlice;
  const baseline = typeof buildSliceFromUserAnswers === 'function'
    ? buildSliceFromUserAnswers(userAnswer, prevEditBaseline || currentSlice)
    : null;

  return {
    nextSurveysResponseState,
    nextBaseline: baseline,
    shouldWriteBaseline: !submissionComplete,
  };
};

export const buildRevertedResponseSlice = ({
  baselineSlice = null,
  renderedQuestionIds = [],
  cloneFieldState = null,
  buildEmptyResponseFieldState = null,
}: BuildRevertedResponseSliceArgs = {}) => {
  const baseline = baselineSlice && typeof baselineSlice === 'object' ? baselineSlice : buildEmptyResponseSlice();
  const clone = typeof cloneFieldState === 'function'
    ? cloneFieldState
    : ((value: unknown) => value);

  const nextSlice: ResponseSlice = {
    answers: clone(baseline.answers || {}) as Record<string, unknown>,
    importance: { ...((baseline.importance as Record<string, unknown>) || {}) },
    conviction: { ...((baseline.conviction as Record<string, unknown>) || {}) },
    additionalComments: clone(baseline.additionalComments || {}) as Record<string, unknown>,
  };

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId) return;
    const nextAnswers = (nextSlice.answers || {}) as Record<string, unknown>;
    if (!nextSlice.answers) nextSlice.answers = nextAnswers;
    const nextAdditionalComments = (nextSlice.additionalComments || {}) as Record<string, unknown>;
    if (!nextSlice.additionalComments) nextSlice.additionalComments = nextAdditionalComments;
    if (!nextAnswers[questionId] && typeof buildEmptyResponseFieldState === 'function') {
      nextAnswers[questionId] = buildEmptyResponseFieldState(questionId, 'answer');
    }
    if (!nextAdditionalComments[questionId] && typeof buildEmptyResponseFieldState === 'function') {
      nextAdditionalComments[questionId] = buildEmptyResponseFieldState(questionId, 'additional');
    }
  });

  return nextSlice;
};

export const buildDraftAwareCacheHydrationState = ({
  cachedAnswer = null,
  cachedAdditional = null,
  draftEntry = null,
  currentAnswer = null,
  currentAdditional = null,
  baselineAnswer = null,
  baselineAdditional = null,
  areEnvelopesEquivalent = null,
}: DraftAwareCacheHydrationStateArgs = {}) => {
  const nextDraftEntry = isRecord(draftEntry) ? draftEntry : {};
  const effectiveAnswerState = resolveDraftAwareCachedField({
    cachedField: cachedAnswer,
    draftValue: nextDraftEntry.value,
    draftEncrypted: nextDraftEntry.answerEncrypted,
    draftEnvelope: nextDraftEntry.answerEncryptedPortion,
    areEnvelopesEquivalent,
  });
  const effectiveAdditionalState = resolveDraftAwareCachedField({
    cachedField: cachedAdditional,
    draftValue: nextDraftEntry.additional,
    draftEncrypted: nextDraftEntry.additionalEncrypted,
    draftEnvelope: nextDraftEntry.additionalEncryptedPortion,
    areEnvelopesEquivalent,
  });

  return {
    effectiveAnswerState,
    effectiveAdditionalState,
    canReplaceMaskedAnswerWithDraftEmpty: canReplaceMaskedFieldWithDraftEmpty({
      currentField: currentAnswer,
      effectiveCachedField: effectiveAnswerState,
      areEnvelopesEquivalent,
    }),
    canReplaceMaskedAdditionalWithDraftEmpty: canReplaceMaskedFieldWithDraftEmpty({
      currentField: currentAdditional,
      effectiveCachedField: effectiveAdditionalState,
      areEnvelopesEquivalent,
    }),
    canReplaceMaskedBaselineAnswerWithDraftEmpty: canReplaceMaskedFieldWithDraftEmpty({
      currentField: baselineAnswer,
      effectiveCachedField: effectiveAnswerState,
      areEnvelopesEquivalent,
    }),
    canReplaceMaskedBaselineAdditionalWithDraftEmpty: canReplaceMaskedFieldWithDraftEmpty({
      currentField: baselineAdditional,
      effectiveCachedField: effectiveAdditionalState,
      areEnvelopesEquivalent,
    }),
  };
};

export const buildLocalCacheRehydrationState = ({
  renderedQuestionIds = [],
  baseSlice = null,
  prevBaseline = null,
  cacheSlice = null,
  draftAnswersByQuestionId = null,
  cloneBaseline = null,
  buildDraftAwareCacheHydrationState: buildDraftAwareState = null,
  applyLocalCacheHydrationEntryToSlice = null,
  debugLabel = '',
}: BuildLocalCacheRehydrationStateArgs = {}) => {
  const normalizedBaseSlice = baseSlice && typeof baseSlice === 'object' ? baseSlice : buildEmptyResponseSlice();
  const nextSlice: ResponseSlice = {
    answers: { ...((normalizedBaseSlice.answers as Record<string, unknown>) || {}) },
    importance: { ...((normalizedBaseSlice.importance as Record<string, unknown>) || {}) },
    conviction: { ...((normalizedBaseSlice.conviction as Record<string, unknown>) || {}) },
    additionalComments: { ...((normalizedBaseSlice.additionalComments as Record<string, unknown>) || {}) },
  };
  const nextBaseline: ResponseSlice = typeof cloneBaseline === 'function'
    ? cloneBaseline(prevBaseline && typeof prevBaseline === 'object' ? prevBaseline : buildEmptyResponseSlice())
    : buildEmptyResponseSlice();
  const cache = cacheSlice && typeof cacheSlice === 'object' ? cacheSlice : buildEmptyResponseSlice();
  const draftMap = draftAnswersByQuestionId && typeof draftAnswersByQuestionId === 'object'
    ? draftAnswersByQuestionId
    : {};

  let changed = false;
  let baselineChanged = false;

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId || typeof buildDraftAwareState !== 'function' || typeof applyLocalCacheHydrationEntryToSlice !== 'function') return;

    const cachedAnswer = (cache.answers && typeof cache.answers === 'object') ? cache.answers[questionId] : null;
    const cachedAdditional = (cache.additionalComments && typeof cache.additionalComments === 'object')
      ? cache.additionalComments[questionId]
      : null;
    const cachedImportance = (cache.importance && typeof cache.importance === 'object') ? cache.importance[questionId] : undefined;
    const cachedConviction = (cache.conviction && typeof cache.conviction === 'object') ? cache.conviction[questionId] : undefined;

    const {
      effectiveAnswerState,
      effectiveAdditionalState,
      canReplaceMaskedAnswerWithDraftEmpty = false,
      canReplaceMaskedAdditionalWithDraftEmpty = false,
      canReplaceMaskedBaselineAnswerWithDraftEmpty = false,
      canReplaceMaskedBaselineAdditionalWithDraftEmpty = false,
    } = buildDraftAwareState({
      cachedAnswer,
      cachedAdditional,
      draftEntry: draftMap[questionId],
      currentAnswer: nextSlice.answers?.[questionId],
      currentAdditional: nextSlice.additionalComments?.[questionId],
      baselineAnswer: nextBaseline.answers?.[questionId],
      baselineAdditional: nextBaseline.additionalComments?.[questionId],
    });

    if (applyLocalCacheHydrationEntryToSlice({
      targetSlice: nextSlice,
      questionId,
      cachedAnswer: effectiveAnswerState,
      cachedAdditional: effectiveAdditionalState,
      cachedImportance,
      cachedConviction,
      allowMaskedAnswerDraftEmpty: canReplaceMaskedAnswerWithDraftEmpty,
      allowMaskedAdditionalDraftEmpty: canReplaceMaskedAdditionalWithDraftEmpty,
      debugLabel,
    })) {
      changed = true;
    }

    if (applyLocalCacheHydrationEntryToSlice({
      targetSlice: nextBaseline,
      questionId,
      cachedAnswer: effectiveAnswerState,
      cachedAdditional: effectiveAdditionalState,
      cachedImportance,
      cachedConviction,
      allowMaskedAnswerDraftEmpty: canReplaceMaskedBaselineAnswerWithDraftEmpty,
      allowMaskedAdditionalDraftEmpty: canReplaceMaskedBaselineAdditionalWithDraftEmpty,
    })) {
      baselineChanged = true;
    }
  });

  return {
    nextSlice,
    nextBaseline,
    changed,
    baselineChanged,
  };
};
