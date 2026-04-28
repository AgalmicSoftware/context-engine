import {
  buildRenderedIdsSignature,
  normalizeQuestionIdKey,
} from './surveyToolSignatures.js';

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

type LoadLocalCacheHydrationSliceArgs = {
  scopeSlugs?: unknown[] | null;
  networkIdStr?: unknown;
  account?: unknown;
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  readQuestionsCache?: ((slug: string) => unknown) | null;
  mergeQuestionResponses?: ((target: CachedQuestionResponses, source: CachedQuestionResponses) => void) | null;
  parseResponse?: ((raw: unknown) => unknown) | null;
  applyCachedResponseEntryToSlice?: ((args: CachedResponseApplyArgs) => boolean) | null;
};

type BuildMergedSurveyResponseStateArgs = {
  currentState?: unknown[] | null;
  newQuestionPool?: unknown[] | null;
  renderedQuestionIds?: unknown[] | null;
  surveyIndex?: unknown;
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
};

type BuildInitializedSurveyResponseStateArgs = {
  singleQuestionMode?: boolean;
  isStandalone?: boolean;
  surveyIndex?: unknown;
  renderedQuestionIds?: unknown[] | null;
  questionPoolIds?: unknown[] | null;
  prevSurveysResponseState?: unknown[] | null;
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
};

type ShouldHandleStartFreshArgs = {
  viewAddress?: unknown;
  userHasResponse?: boolean;
  editBaseline?: unknown;
  isDirty?: boolean;
  currentSlice?: ResponseSlice | null;
  renderedQuestionIds?: Iterable<unknown> | unknown[];
};

type BuildStartFreshSurveyStateArgs = {
  surveyIndex?: unknown;
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  prevSurveysResponseState?: unknown[] | null;
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
};

type BuildResetFormStatePatchArgs = {
  initialSurveysResponseState?: unknown[] | null;
  baselineIndex?: unknown;
  nextSubmittedSinceLastEdit?: boolean;
  cloneValue?: ((value: unknown) => unknown) | null;
};

type PrepareLocalCacheRehydrateRunArgs = {
  state?: UnknownRecord | null;
  surveyIndex?: unknown;
  renderedIds?: Iterable<unknown> | unknown[];
  lastHydrationSig?: unknown;
  buildHydrationSignature?: ((surveyIndex: number, renderedIds: unknown[]) => string) | null;
};

type ResolveRevertPendingBaselineSliceArgs = {
  editBaseline?: ResponseSlice | null;
  isLoggedIn?: boolean;
  userAnswers?: unknown;
  buildSliceFromUserAnswers?: ((userAnswers: unknown) => ResponseSlice | null | undefined) | null;
  buildSliceFromLocalCache?: (() => ResponseSlice | null | undefined) | null;
};

type BuildRevertPendingStatePatchArgs = {
  prevSurveysResponseState?: unknown[] | null;
  surveyIndex?: unknown;
  nextSlice?: ResponseSlice | null;
  isLoggedIn?: boolean;
};

type ResolveExitEditingBaselineSliceArgs = {
  responderAddress?: unknown;
  parsedViewAddressAnswers?: unknown;
  userAnswers?: unknown;
  buildSliceFromUserAnswers?: ((sourceAnswers: unknown) => ResponseSlice | null | undefined) | null;
  buildSliceFromLocalCache?: (() => ResponseSlice | null | undefined) | null;
};

type BuildExitEditingStatePatchArgs = {
  prevSurveysResponseState?: unknown[] | null;
  surveyIndex?: unknown;
  baselineSlice?: ResponseSlice | null;
  renderedQuestionIds?: Iterable<unknown> | unknown[];
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => unknown) | null;
  cloneValue?: ((value: unknown) => unknown) | null;
  nextSubmittedSinceLastEdit?: boolean;
};

type BuildLocalCacheRehydrationUpdatePlanArgs = BuildLocalCacheRehydrationStateArgs & {
  prevSurveysResponseState?: unknown[] | null;
  surveyIndex?: unknown;
};

type BuildDraftHydrationUpdatePlanArgs = BuildDraftHydrationStateArgs & {
  prevSurveysResponseState?: unknown[] | null;
  surveyIndex?: unknown;
};

type BuildPrefilledSurveyUpdatePlanArgs = BuildPrefilledSurveyStateArgs;

type BuildPrefilledSingleQuestionUpdatePlanArgs = BuildPrefilledSingleQuestionStateArgs;

type ShouldBackfillPriorResponsesArgs = {
  loginComplete?: boolean;
  account?: unknown;
  displayAnswerMode?: boolean;
  viewAddress?: unknown;
  singleQuestionMode?: boolean;
  responderAddress?: unknown;
  hasRefreshQuestionResponses?: boolean;
  submissionComplete?: boolean;
  isSubmitting?: boolean;
};

type MissingRenderedResponseRequest = {
  slug?: unknown;
  netId?: unknown;
  missingIds?: unknown[] | null;
};

type MissingRenderedResponseInfo = {
  requests?: MissingRenderedResponseRequest[] | null;
  slug?: unknown;
  netId?: unknown;
  missingIds?: unknown[] | null;
};

type BuildPriorResponseFetchPlanArgs = {
  missingInfo?: MissingRenderedResponseInfo | null;
  responderLower?: string;
  attemptedKeys?: Set<string> | null;
};

type PriorResponseFetchRequest = {
  slug?: unknown;
  idsToFetch?: unknown[] | null;
};

type ExecutePriorResponseFetchPlanArgs = {
  requestsToFetch?: PriorResponseFetchRequest[] | null;
  responderLower?: string;
  refreshQuestionResponses?: ((idsToFetch: string[], opts: { slug: string; responder: string }) => Promise<unknown>) | null;
  readQuestionsCacheAsync?: ((slug: string) => Promise<unknown>) | null;
};

type TrackPriorResponseAttemptedKeysArgs = {
  attemptedSet?: Set<string> | null;
  attemptedKeysToMark?: unknown[] | null;
};

type ClearPriorResponseAttemptedKeysArgs = {
  attemptedSet?: Set<string> | null;
  attemptedKeys?: unknown[] | null;
};

type ApplyPriorResponseFetchSuccessEffectsArgs = {
  fetched?: boolean;
  isMounted?: boolean;
  resetLocalCacheMemo?: (() => void) | null;
  triggerRehydrate?: (() => void) | null;
};

type ApplyLocalCacheRehydrateMissEffectsArgs = {
  clearHydrationSignature?: (() => void) | null;
  ensurePriorResponses?: (() => void) | null;
  callback?: (() => void) | null;
};

type ApplyLocalCacheRehydrateNoChangeEffectsArgs = {
  ensurePriorResponses?: (() => void) | null;
  callback?: (() => void) | null;
};

type ApplyLocalCacheRehydrateSuccessEffectsArgs = {
  updates?: UnknownRecord | null;
  applyStateUpdates?: ((updates: UnknownRecord, callback?: () => void) => void) | null;
  afterStateApplied?: (() => void) | null;
};

type BuildGroupedRenderedResponseScopePlanArgs = {
  renderedIds?: Iterable<unknown> | unknown[];
  slugByQuestionId?: Map<string, unknown> | null;
  fallbackSlug?: unknown;
  fallbackNetId?: unknown;
};

type GroupedRenderedResponseScopePlanEntry = {
  slug: string;
  netId: string;
  questionIds: string[];
};

type LoadGroupedMissingResponseRequestsArgs = {
  scopePlan?: GroupedRenderedResponseScopePlanEntry[] | null;
  fallbackNetId?: unknown;
  responderLower?: string;
  resolveScopeNetId?: ((slug: string, entryNetId: string) => string | null | undefined) | null;
  readQuestionsCacheAsync?: ((slug: string) => Promise<unknown>) | null;
  ensureQuestionsNet?: ((cache: unknown, netId: string) => unknown) | null;
};

type LoadMissingResponseIdsForScopeArgs = {
  slug?: unknown;
  netId?: unknown;
  renderedIds?: Iterable<unknown> | unknown[];
  responderLower?: string;
  readQuestionsCacheAsync?: ((slug: string) => Promise<unknown>) | null;
  ensureQuestionsNet?: ((cache: unknown, netId: string) => unknown) | null;
};

type BuildMissingResponseIdsForRenderedQuestionsArgs = {
  renderedIds?: Iterable<unknown> | unknown[];
  questionResponses?: Record<string, unknown> | null;
  responderLower?: string;
};

type BuildMissingRenderedResponseResultArgs = {
  requests?: MissingRenderedResponseRequest[] | null;
  fallbackSlug?: unknown;
  fallbackNetId?: unknown;
};

type BuildNormalizedRenderedQuestionIdsArgs = {
  renderedIds?: Iterable<unknown> | unknown[];
};

type BuildLocalCacheHydrationSignatureArgs = {
  surveyIndex?: unknown;
  scopeSlugs?: unknown[];
  networkIdStr?: unknown;
  account?: unknown;
  renderedIds?: Iterable<unknown> | unknown[];
  questionsCacheNonce?: unknown;
  questionResponsesNonce?: unknown;
  suppressPrefill?: boolean;
  submissionError?: unknown;
  submissionComplete?: boolean;
};

type BuildQuestionSlugMapForIdsArgs = {
  questionIds?: Iterable<unknown> | unknown[];
  poolQuestions?: unknown[] | null;
  normalizeSlug?: ((value: unknown) => string) | null;
  resolveQuestionSlug?: ((args: {
    questionId: string;
    question?: unknown;
  }) => unknown) | null;
};

type BuildSubmissionGroupContextArgs = {
  questionIds?: Iterable<unknown> | unknown[];
  slugByQuestionId?: Map<string, unknown> | null;
  fallbackSlug?: unknown;
  normalizeSlug?: ((value: unknown) => string) | null;
  multiSessionError?: string;
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

export const loadLocalCacheHydrationSlice = ({
  scopeSlugs = null,
  networkIdStr = '',
  account = '',
  renderedQuestionIds = [],
  readQuestionsCache = null,
  mergeQuestionResponses = null,
  parseResponse = null,
  applyCachedResponseEntryToSlice = null,
}: LoadLocalCacheHydrationSliceArgs = {}): ResponseSlice | null => {
  const netId = String(networkIdStr || '');
  const acct = String(account || '').trim().toLowerCase();
  if (!netId || !acct) return null;

  const mergedQuestionResponses = buildMergedHydrationQuestionResponses({
    scopeSlugs: Array.isArray(scopeSlugs) ? scopeSlugs : [],
    networkIdStr: netId,
    readQuestionsCache,
    mergeQuestionResponses,
  });
  if (Object.keys(mergedQuestionResponses).length === 0) return null;

  return buildCacheHydrationSlice({
    renderedQuestionIds,
    mergedQuestionResponses,
    account: acct,
    parseResponse,
    applyCachedResponseEntryToSlice,
  }).slice;
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

export const buildMergedSurveyResponseState = ({
  currentState = null,
  newQuestionPool = null,
  renderedQuestionIds = null,
  surveyIndex = 0,
  buildEmptyResponseFieldState = null,
}: BuildMergedSurveyResponseStateArgs = {}) => {
  const normalizedSurveyIndex = Math.max(0, Number(surveyIndex) || 0);
  const pool = Array.isArray(newQuestionPool) && newQuestionPool.length > 0
    ? newQuestionPool
    : (Array.isArray(renderedQuestionIds) ? renderedQuestionIds.map((id) => ({ id })) : []);
  const nextSurveysResponseState = buildSurveyResponseStateArray({
    prevSurveysResponseState: currentState,
    surveyIndex: normalizedSurveyIndex,
  });
  const prevSlice =
    nextSurveysResponseState[normalizedSurveyIndex] && typeof nextSurveysResponseState[normalizedSurveyIndex] === 'object'
      ? nextSurveysResponseState[normalizedSurveyIndex] as ResponseSlice
      : buildEmptyResponseSlice();

  const allowedIds = new Set(
    pool.map((question) => (question && typeof question === 'object' && 'id' in question ? String((question as UnknownRecord).id || '') : ''))
      .filter(Boolean)
  );

  const mergedAnswers: Record<string, unknown> = {};
  const mergedAdditional: Record<string, unknown> = {};
  const mergedImportance: Record<string, unknown> = {};
  const mergedConviction: Record<string, unknown> = {};

  allowedIds.forEach((questionId) => {
    if (prevSlice.answers && prevSlice.answers[questionId]) {
      mergedAnswers[questionId] = { ...((prevSlice.answers[questionId] as Record<string, unknown>) || {}) };
    } else if (typeof buildEmptyResponseFieldState === 'function') {
      mergedAnswers[questionId] = buildEmptyResponseFieldState(questionId);
    }

    if (prevSlice.additionalComments && prevSlice.additionalComments[questionId]) {
      mergedAdditional[questionId] = { ...((prevSlice.additionalComments[questionId] as Record<string, unknown>) || {}) };
    } else if (typeof buildEmptyResponseFieldState === 'function') {
      mergedAdditional[questionId] = buildEmptyResponseFieldState(questionId, 'additional');
    }

    if (
      prevSlice.importance &&
      Object.prototype.hasOwnProperty.call(prevSlice.importance, questionId)
    ) {
      mergedImportance[questionId] = prevSlice.importance[questionId];
    }
    if (
      prevSlice.conviction &&
      Object.prototype.hasOwnProperty.call(prevSlice.conviction, questionId)
    ) {
      mergedConviction[questionId] = prevSlice.conviction[questionId];
    }
  });

  nextSurveysResponseState[normalizedSurveyIndex] = {
    answers: mergedAnswers,
    importance: mergedImportance,
    conviction: mergedConviction,
    additionalComments: mergedAdditional,
  };

  return nextSurveysResponseState;
};

export const buildInitializedSurveyResponseState = ({
  singleQuestionMode = false,
  isStandalone = false,
  surveyIndex = 0,
  renderedQuestionIds = null,
  questionPoolIds = null,
  prevSurveysResponseState = null,
  buildEmptyResponseFieldState = null,
}: BuildInitializedSurveyResponseStateArgs = {}) => {
  const preferredIds = Array.isArray(renderedQuestionIds) && renderedQuestionIds.length > 0
    ? renderedQuestionIds
    : (Array.isArray(questionPoolIds) ? questionPoolIds : []);

  const initialAnswers: Record<string, unknown> = {};
  const initialAdditionalThoughts: Record<string, unknown> = {};

  preferredIds.forEach((rawQuestionId) => {
    const questionId = String(rawQuestionId || '');
    if (!questionId) return;
    if (typeof buildEmptyResponseFieldState === 'function') {
      initialAnswers[questionId] = buildEmptyResponseFieldState(questionId);
      initialAdditionalThoughts[questionId] = buildEmptyResponseFieldState(questionId, 'additional');
    }
  });

  const initialSlice = {
    answers: initialAnswers,
    importance: {},
    conviction: {},
    additionalComments: initialAdditionalThoughts,
  };

  if (singleQuestionMode || isStandalone) {
    return [initialSlice];
  }

  const normalizedSurveyIndex = Math.max(0, Number(surveyIndex) || 0);
  const nextSurveysResponseState = Array.isArray(prevSurveysResponseState)
    ? [...prevSurveysResponseState]
    : [];
  while (nextSurveysResponseState.length <= normalizedSurveyIndex) {
    nextSurveysResponseState.push(null);
  }
  nextSurveysResponseState[normalizedSurveyIndex] = initialSlice;
  return nextSurveysResponseState;
};

const getQuestionFieldValue = (
  fieldMap: Record<string, unknown> | null | undefined,
  questionId: string,
) => {
  if (!fieldMap || typeof fieldMap !== 'object') return undefined;
  const field = fieldMap[questionId];
  if (!field || typeof field !== 'object') return undefined;
  return (field as UnknownRecord).value;
};

export const shouldHandleStartFresh = ({
  viewAddress = '',
  userHasResponse = false,
  editBaseline = null,
  isDirty = false,
  currentSlice = null,
  renderedQuestionIds = [],
}: ShouldHandleStartFreshArgs = {}) => {
  if (viewAddress || userHasResponse || editBaseline || isDirty) return false;

  const slice = currentSlice && typeof currentSlice === 'object'
    ? currentSlice
    : buildEmptyResponseSlice();

  const hasAny = Array.from(renderedQuestionIds || []).some((rawQuestionId) => {
    const questionId = String(rawQuestionId || '');
    if (!questionId) return false;
    return (
      (getQuestionFieldValue(slice.answers as Record<string, unknown>, questionId) ?? '') !== '' ||
      (getQuestionFieldValue(slice.additionalComments as Record<string, unknown>, questionId) ?? '') !== '' ||
      Object.prototype.hasOwnProperty.call(slice.importance || {}, questionId) ||
      Object.prototype.hasOwnProperty.call(slice.conviction || {}, questionId)
    );
  });

  return !hasAny;
};

export const buildStartFreshSurveyState = ({
  surveyIndex = 0,
  renderedQuestionIds = [],
  prevSurveysResponseState = null,
  buildEmptyResponseFieldState = null,
}: BuildStartFreshSurveyStateArgs = {}) => {
  const emptySlice: ResponseSlice = {
    answers: {},
    importance: {},
    conviction: {},
    additionalComments: {},
  };

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = String(rawQuestionId || '');
    if (!questionId || typeof buildEmptyResponseFieldState !== 'function') return;
    emptySlice.answers![questionId] = buildEmptyResponseFieldState(questionId);
    emptySlice.additionalComments![questionId] = buildEmptyResponseFieldState(questionId, 'additional');
  });

  return {
    emptySlice,
    nextSurveysResponseState: buildSurveyResponseStateArray({
      prevSurveysResponseState,
      surveyIndex,
      nextSlice: emptySlice,
    }),
  };
};

export const buildResetFormStatePatch = ({
  initialSurveysResponseState = null,
  baselineIndex = 0,
  nextSubmittedSinceLastEdit = false,
  cloneValue = null,
}: BuildResetFormStatePatchArgs = {}) => {
  const surveysResponseState = Array.isArray(initialSurveysResponseState)
    ? initialSurveysResponseState
    : [];
  const normalizedBaselineIndex = Math.max(0, Number(baselineIndex) || 0);
  const baselineSource =
    surveysResponseState[normalizedBaselineIndex] &&
    typeof surveysResponseState[normalizedBaselineIndex] === 'object'
      ? surveysResponseState[normalizedBaselineIndex]
      : buildEmptyResponseSlice();

  return {
    surveysResponseState,
    isEditing: false,
    submissionError: '',
    submissionComplete: false,
    submittedSinceLastEdit: !!nextSubmittedSinceLastEdit,
    submitProgress: 0,
    userHasResponse: false,
    userAnswers: null,
    isDirty: false,
    modifiedCount: 0,
    hasEncryptedChanges: false,
    editBaseline: typeof cloneValue === 'function' ? cloneValue(baselineSource) : baselineSource,
    isLoadingResponse: true,
  };
};

export const prepareLocalCacheRehydrateRun = ({
  state = null,
  surveyIndex = 0,
  renderedIds = [],
  lastHydrationSig = '',
  buildHydrationSignature = null,
}: PrepareLocalCacheRehydrateRunArgs = {}) => {
  const currentState = state && typeof state === 'object' ? state : {};
  if (currentState.suppressPrefill || currentState.submissionError || currentState.submissionComplete) {
    return {
      shouldSkip: true,
      shouldBumpNoop: false,
      hydrationSig: '',
      baseSlice: null,
    };
  }

  const normalizedSurveyIndex = Math.max(0, Number(surveyIndex) || 0);
  const normalizedRenderedIds = Array.from(renderedIds || []);
  const hydrationSig = typeof buildHydrationSignature === 'function'
    ? String(buildHydrationSignature(normalizedSurveyIndex, normalizedRenderedIds) || '')
    : '';

  if (hydrationSig && String(lastHydrationSig || '') === hydrationSig) {
    return {
      shouldSkip: true,
      shouldBumpNoop: true,
      hydrationSig,
      baseSlice: null,
    };
  }

  const surveysResponseState = Array.isArray(currentState.surveysResponseState)
    ? currentState.surveysResponseState
    : [];
  const baseSlice =
    (surveysResponseState[normalizedSurveyIndex] && typeof surveysResponseState[normalizedSurveyIndex] === 'object'
      ? surveysResponseState[normalizedSurveyIndex]
      : null) || { answers: {}, importance: {}, conviction: {}, additionalComments: {} };

  return {
    shouldSkip: false,
    shouldBumpNoop: false,
    hydrationSig,
    baseSlice,
  };
};

export const resolveRevertPendingBaselineSlice = ({
  editBaseline = null,
  isLoggedIn = false,
  userAnswers = null,
  buildSliceFromUserAnswers = null,
  buildSliceFromLocalCache = null,
}: ResolveRevertPendingBaselineSliceArgs = {}): ResponseSlice => {
  if (editBaseline && typeof editBaseline === 'object') {
    return editBaseline;
  }

  if (isLoggedIn) {
    if (userAnswers && typeof buildSliceFromUserAnswers === 'function') {
      const nextSlice = buildSliceFromUserAnswers(userAnswers);
      if (nextSlice && typeof nextSlice === 'object') return nextSlice;
    }
    if (typeof buildSliceFromLocalCache === 'function') {
      const cachedSlice = buildSliceFromLocalCache();
      if (cachedSlice && typeof cachedSlice === 'object') return cachedSlice;
    }
  }

  return buildEmptyResponseSlice();
};

export const buildRevertPendingStatePatch = ({
  prevSurveysResponseState = null,
  surveyIndex = 0,
  nextSlice = null,
  isLoggedIn = false,
}: BuildRevertPendingStatePatchArgs = {}) => ({
  surveysResponseState: buildSurveyResponseStateArray({
    prevSurveysResponseState,
    surveyIndex,
    nextSlice: nextSlice && typeof nextSlice === 'object' ? nextSlice : buildEmptyResponseSlice(),
  }),
  isEditing: true,
  displayAnswerMode: false,
  startFresh: !isLoggedIn,
  isDirty: false,
  modifiedCount: 0,
  hasEncryptedChanges: false,
  submissionError: '',
});

export const resolveExitEditingBaselineSlice = ({
  responderAddress = '',
  parsedViewAddressAnswers = null,
  userAnswers = null,
  buildSliceFromUserAnswers = null,
  buildSliceFromLocalCache = null,
}: ResolveExitEditingBaselineSliceArgs = {}): ResponseSlice => {
  const sourceAnswers = responderAddress ? parsedViewAddressAnswers : userAnswers;
  if (sourceAnswers && typeof buildSliceFromUserAnswers === 'function') {
    const nextSlice = buildSliceFromUserAnswers(sourceAnswers);
    if (nextSlice && typeof nextSlice === 'object') return nextSlice;
  }
  if (typeof buildSliceFromLocalCache === 'function') {
    const cachedSlice = buildSliceFromLocalCache();
    if (cachedSlice && typeof cachedSlice === 'object') return cachedSlice;
  }
  return buildEmptyResponseSlice();
};

export const buildExitEditingStatePatch = ({
  prevSurveysResponseState = null,
  surveyIndex = 0,
  baselineSlice = null,
  renderedQuestionIds = [],
  buildEmptyResponseFieldState = null,
  cloneValue = null,
  nextSubmittedSinceLastEdit = false,
}: BuildExitEditingStatePatchArgs = {}) => {
  const normalizedBaselineSlice = baselineSlice && typeof baselineSlice === 'object'
    ? baselineSlice
    : buildEmptyResponseSlice();
  const clone = typeof cloneValue === 'function'
    ? cloneValue
    : ((value: unknown) => value);

  const nextSlice: ResponseSlice = {
    answers: clone(normalizedBaselineSlice.answers || {}) as Record<string, unknown>,
    importance: { ...((normalizedBaselineSlice.importance as Record<string, unknown>) || {}) },
    conviction: { ...((normalizedBaselineSlice.conviction as Record<string, unknown>) || {}) },
    additionalComments: clone(normalizedBaselineSlice.additionalComments || {}) as Record<string, unknown>,
  };

  Array.from(renderedQuestionIds || []).forEach((rawQuestionId) => {
    const questionId = String(rawQuestionId || '');
    if (!questionId) return;
    if (!nextSlice.answers?.[questionId] && typeof buildEmptyResponseFieldState === 'function') {
      nextSlice.answers![questionId] = buildEmptyResponseFieldState(questionId);
    }
    if (!nextSlice.additionalComments?.[questionId] && typeof buildEmptyResponseFieldState === 'function') {
      nextSlice.additionalComments![questionId] = buildEmptyResponseFieldState(questionId, 'additional');
    }
  });

  return {
    surveysResponseState: buildSurveyResponseStateArray({
      prevSurveysResponseState,
      surveyIndex,
      nextSlice,
    }),
    isEditing: false,
    displayAnswerMode: true,
    startFresh: false,
    editBaseline: clone(nextSlice),
    isDirty: false,
    modifiedCount: 0,
    hasEncryptedChanges: false,
    submissionError: '',
    submissionComplete: false,
    submittedSinceLastEdit: !!nextSubmittedSinceLastEdit,
  };
};

export const buildLocalCacheRehydrationUpdatePlan = ({
  prevSurveysResponseState = null,
  surveyIndex = 0,
  ...rehydrationArgs
}: BuildLocalCacheRehydrationUpdatePlanArgs = {}) => {
  const {
    nextSlice,
    nextBaseline,
    changed,
    baselineChanged,
  } = buildLocalCacheRehydrationState(rehydrationArgs);

  const updates: UnknownRecord = {};
  if (changed) {
    updates.surveysResponseState = buildSurveyResponseStateArray({
      prevSurveysResponseState,
      surveyIndex,
      nextSlice,
    });
  }
  if (baselineChanged) {
    updates.editBaseline = nextBaseline;
  }

  return {
    nextSlice,
    nextBaseline,
    changed,
    baselineChanged,
    updates,
  };
};

export const buildDraftHydrationUpdatePlan = ({
  prevSurveysResponseState = null,
  surveyIndex = 0,
  ...draftArgs
}: BuildDraftHydrationUpdatePlanArgs = {}) => {
  const {
    nextSlice,
    nextBaseline,
    changed,
    baselineChanged,
  } = buildDraftHydrationState(draftArgs);

  const updates: UnknownRecord = {};
  if (changed) {
    updates.surveysResponseState = buildSurveyResponseStateArray({
      prevSurveysResponseState,
      surveyIndex,
      nextSlice,
    });
  }
  if (baselineChanged) {
    updates.editBaseline = nextBaseline;
  }

  return {
    nextSlice,
    nextBaseline,
    changed,
    baselineChanged,
    updates,
  };
};

export const buildPrefilledSurveyUpdatePlan = ({
  ...args
}: BuildPrefilledSurveyUpdatePlanArgs = {}) => {
  const {
    nextSurveysResponseState,
    nextBaseline,
    shouldWriteBaseline,
  } = buildPrefilledSurveyState(args);

  return {
    nextSurveysResponseState,
    nextBaseline,
    shouldWriteBaseline,
    updates: {
      surveysResponseState: nextSurveysResponseState,
      ...(shouldWriteBaseline ? { editBaseline: nextBaseline } : {}),
    },
  };
};

export const buildPrefilledSingleQuestionUpdatePlan = ({
  ...args
}: BuildPrefilledSingleQuestionUpdatePlanArgs = {}) => {
  const {
    nextSurveysResponseState,
    nextBaseline,
    shouldWriteBaseline,
  } = buildPrefilledSingleQuestionState(args);

  return {
    nextSurveysResponseState,
    nextBaseline,
    shouldWriteBaseline,
    updates: {
      surveysResponseState: nextSurveysResponseState,
      ...(shouldWriteBaseline ? { editBaseline: nextBaseline } : {}),
    },
  };
};

export const shouldBackfillPriorResponses = ({
  loginComplete = false,
  account = '',
  displayAnswerMode = false,
  viewAddress = '',
  singleQuestionMode = false,
  responderAddress = '',
  hasRefreshQuestionResponses = false,
  submissionComplete = false,
  isSubmitting = false,
}: ShouldBackfillPriorResponsesArgs = {}): boolean => {
  const accountLower = String(account || '').trim().toLowerCase();
  const viewingOtherSurveyResponder =
    !!displayAnswerMode &&
    !!viewAddress &&
    String(viewAddress || '').trim().toLowerCase() !== accountLower;
  const viewingOtherQuestionResponder =
    !!singleQuestionMode &&
    !!responderAddress &&
    String(responderAddress || '').trim().toLowerCase() !== accountLower;

  return !!(
    loginComplete &&
    accountLower &&
    !viewingOtherSurveyResponder &&
    !viewingOtherQuestionResponder &&
    hasRefreshQuestionResponses &&
    !submissionComplete &&
    !isSubmitting
  );
};

export const buildPriorResponseFetchPlan = ({
  missingInfo = null,
  responderLower = '',
  attemptedKeys = null,
}: BuildPriorResponseFetchPlanArgs = {}) => {
  const groupedRequests = Array.isArray(missingInfo?.requests) && missingInfo.requests.length > 0
    ? missingInfo.requests
    : [{
      slug: String(missingInfo?.slug || ''),
      netId: String(missingInfo?.netId || ''),
      missingIds: Array.isArray(missingInfo?.missingIds) ? missingInfo.missingIds : [],
    }];

  const normalizedResponder = String(responderLower || '').trim().toLowerCase();
  const attempted = attemptedKeys instanceof Set ? attemptedKeys : new Set<string>();
  const requestsToFetch = groupedRequests
    .map((entry) => {
      const requestSlug = String(entry?.slug || '');
      const requestIds = Array.isArray(entry?.missingIds) ? entry.missingIds : [];
      const idsToFetch = requestIds
        .map((qid) => normalizeQuestionIdKey(qid))
        .filter((qid) => qid && !attempted.has(`${requestSlug}|${normalizedResponder}|${qid}`));
      return {
        slug: requestSlug,
        idsToFetch,
      };
    })
    .filter((entry) => entry.idsToFetch.length > 0);

  return {
    requestsToFetch,
    attemptedKeysToMark: requestsToFetch.flatMap((entry) => (
      entry.idsToFetch.map((qid) => `${entry.slug}|${normalizedResponder}|${qid}`)
    )),
  };
};

export const trackPriorResponseAttemptedKeys = ({
  attemptedSet = null,
  attemptedKeysToMark = null,
}: TrackPriorResponseAttemptedKeysArgs = {}): string[] => {
  const attempted = attemptedSet instanceof Set ? attemptedSet : new Set<string>();
  const trackedKeys: string[] = [];

  (Array.isArray(attemptedKeysToMark) ? attemptedKeysToMark : []).forEach((rawKey) => {
    const key = String(rawKey || '');
    if (!key) return;
    attempted.add(key);
    trackedKeys.push(key);
  });

  return trackedKeys;
};

export const clearPriorResponseAttemptedKeys = ({
  attemptedSet = null,
  attemptedKeys = null,
}: ClearPriorResponseAttemptedKeysArgs = {}) => {
  if (!(attemptedSet instanceof Set)) return;
  (Array.isArray(attemptedKeys) ? attemptedKeys : []).forEach((rawKey) => {
    const key = String(rawKey || '');
    if (!key) return;
    attemptedSet.delete(key);
  });
};

export const applyPriorResponseFetchSuccessEffects = ({
  fetched = false,
  isMounted = false,
  resetLocalCacheMemo = null,
  triggerRehydrate = null,
} : ApplyPriorResponseFetchSuccessEffectsArgs = {}) => {
  if (!fetched || !isMounted) return false;
  if (typeof resetLocalCacheMemo === 'function') {
    resetLocalCacheMemo();
  }
  if (typeof triggerRehydrate === 'function') {
    triggerRehydrate();
  }
  return true;
};

export const applyLocalCacheRehydrateMissEffects = ({
  clearHydrationSignature = null,
  ensurePriorResponses = null,
  callback = null,
}: ApplyLocalCacheRehydrateMissEffectsArgs = {}) => {
  if (typeof clearHydrationSignature === 'function') {
    clearHydrationSignature();
  }
  if (typeof ensurePriorResponses === 'function') {
    ensurePriorResponses();
  }
  if (typeof callback === 'function') {
    callback();
  }
};

export const applyLocalCacheRehydrateNoChangeEffects = ({
  ensurePriorResponses = null,
  callback = null,
}: ApplyLocalCacheRehydrateNoChangeEffectsArgs = {}) => {
  if (typeof ensurePriorResponses === 'function') {
    ensurePriorResponses();
  }
  if (typeof callback === 'function') {
    callback();
  }
};

export const applyLocalCacheRehydrateSuccessEffects = ({
  updates = null,
  applyStateUpdates = null,
  afterStateApplied = null,
}: ApplyLocalCacheRehydrateSuccessEffectsArgs = {}) => {
  if (!updates || typeof updates !== 'object' || typeof applyStateUpdates !== 'function') {
    return false;
  }

  applyStateUpdates(updates, () => {
    if (typeof afterStateApplied === 'function') {
      afterStateApplied();
    }
  });
  return true;
};

export const executePriorResponseFetchPlan = async ({
  requestsToFetch = null,
  responderLower = '',
  refreshQuestionResponses = null,
  readQuestionsCacheAsync = null,
}: ExecutePriorResponseFetchPlanArgs = {}) => {
  const normalizedResponder = String(responderLower || '').trim().toLowerCase();
  const requests = Array.isArray(requestsToFetch) ? requestsToFetch : [];
  let fetched = false;
  let slug = '';

  for (const entry of requests) {
    const resolvedSlug = String(entry?.slug || '');
    const idsToFetch = buildNormalizedRenderedQuestionIds({
      renderedIds: Array.isArray(entry?.idsToFetch) ? entry.idsToFetch : [],
    });
    if (!resolvedSlug || idsToFetch.length === 0) continue;

    slug = resolvedSlug;
    if (typeof refreshQuestionResponses === 'function') {
      // eslint-disable-next-line no-await-in-loop
      await refreshQuestionResponses(idsToFetch, {
        slug: resolvedSlug,
        responder: normalizedResponder,
      });
    }
    if (typeof readQuestionsCacheAsync === 'function') {
      // eslint-disable-next-line no-await-in-loop
      await readQuestionsCacheAsync(resolvedSlug);
    }
    fetched = true;
  }

  return {
    fetched,
    slug,
  };
};

export const loadMissingResponseIdsForScope = async ({
  slug = '',
  netId = '',
  renderedIds = [],
  responderLower = '',
  readQuestionsCacheAsync = null,
  ensureQuestionsNet = null,
}: LoadMissingResponseIdsForScopeArgs = {}) => {
  const resolvedSlug = String(slug || '');
  const resolvedNetId = String(netId || '');
  if (!resolvedNetId) return [];

  const rawCache = typeof readQuestionsCacheAsync === 'function'
    ? await readQuestionsCacheAsync(resolvedSlug)
    : {};
  const questionsCache = typeof ensureQuestionsNet === 'function'
    ? ensureQuestionsNet(rawCache, resolvedNetId)
    : rawCache;
  const questionResponses =
    isRecord(questionsCache) &&
    isRecord(questionsCache[resolvedNetId]) &&
    isRecord((questionsCache[resolvedNetId] as UnknownRecord).questionResponses)
      ? ((questionsCache[resolvedNetId] as UnknownRecord).questionResponses as Record<string, unknown>)
      : {};

  return buildMissingResponseIdsForRenderedQuestions({
    renderedIds,
    questionResponses,
    responderLower,
  });
};

export const loadGroupedMissingResponseRequests = async ({
  scopePlan = null,
  fallbackNetId = '',
  responderLower = '',
  resolveScopeNetId = null,
  readQuestionsCacheAsync = null,
  ensureQuestionsNet = null,
}: LoadGroupedMissingResponseRequestsArgs = {}) => {
  const requests = [];
  const cachedMissingIdsByScope = new Map<string, string[]>();

  for (const entry of (Array.isArray(scopePlan) ? scopePlan : [])) {
    const resolvedSlug = String(entry?.slug || '');
    const resolvedNetId = String(
      typeof resolveScopeNetId === 'function'
        ? (resolveScopeNetId(resolvedSlug, String(entry?.netId || '')) || '')
        : (entry?.netId || fallbackNetId || '')
    );
    if (!resolvedNetId) {
      requests.push({ slug: resolvedSlug, netId: '', missingIds: [] });
      continue;
    }

    const scopeKey = `${resolvedSlug}|${resolvedNetId}`;
    let missingIds = cachedMissingIdsByScope.get(scopeKey);
    if (!missingIds) {
      missingIds = await loadMissingResponseIdsForScope({
        slug: resolvedSlug,
        netId: resolvedNetId,
        renderedIds: entry?.questionIds || [],
        responderLower,
        readQuestionsCacheAsync,
        ensureQuestionsNet,
      });
      cachedMissingIdsByScope.set(scopeKey, missingIds);
    }

    requests.push({
      slug: resolvedSlug,
      netId: resolvedNetId,
      missingIds,
    });
  }

  return requests;
};

export const buildGroupedRenderedResponseScopePlan = ({
  renderedIds = [],
  slugByQuestionId = null,
  fallbackSlug = '',
  fallbackNetId = '',
}: BuildGroupedRenderedResponseScopePlanArgs = {}): GroupedRenderedResponseScopePlanEntry[] => {
  const groupedByScope = new Map<string, GroupedRenderedResponseScopePlanEntry>();

  Array.from(renderedIds || []).forEach((rawQuestionId) => {
    const questionId = normalizeQuestionIdKey(rawQuestionId);
    if (!questionId) return;
    const resolvedSlug = String(
      (slugByQuestionId instanceof Map ? slugByQuestionId.get(questionId) : null) ?? fallbackSlug ?? ''
    );
    const resolvedNetId = String(fallbackNetId || '');
    if (!resolvedNetId) return;
    const scopeKey = `${resolvedSlug}|${resolvedNetId}`;
    if (!groupedByScope.has(scopeKey)) {
      groupedByScope.set(scopeKey, {
        slug: resolvedSlug,
        netId: resolvedNetId,
        questionIds: [],
      });
    }
    groupedByScope.get(scopeKey)?.questionIds.push(questionId);
  });

  return Array.from(groupedByScope.values()).filter((entry) => entry.questionIds.length > 0);
};

export const buildMissingResponseIdsForRenderedQuestions = ({
  renderedIds = [],
  questionResponses = null,
  responderLower = '',
}: BuildMissingResponseIdsForRenderedQuestionsArgs = {}): string[] => {
  const normalizedResponder = String(responderLower || '').trim().toLowerCase();
  return Array.from(renderedIds || [])
    .map((qid) => normalizeQuestionIdKey(qid))
    .filter(Boolean)
    .filter((questionId) => {
      const perQuestion = questionResponses && typeof questionResponses === 'object'
        ? questionResponses[questionId]
        : null;
      if (!perQuestion || typeof perQuestion !== 'object') return true;
      return !(perQuestion as UnknownRecord)[normalizedResponder];
    });
};

export const buildMissingRenderedResponseResult = ({
  requests = null,
  fallbackSlug = '',
  fallbackNetId = '',
}: BuildMissingRenderedResponseResultArgs = {}) => {
  const normalizedRequests = (Array.isArray(requests) ? requests : [])
    .map((entry) => ({
      slug: String(entry?.slug || ''),
      netId: String(entry?.netId || ''),
      missingIds: buildNormalizedRenderedQuestionIds({
        renderedIds: Array.isArray(entry?.missingIds) ? entry.missingIds : [],
      }),
    }));
  const nonEmptyRequests = normalizedRequests.filter((entry) => entry.missingIds.length > 0);

  if (nonEmptyRequests.length === 0) {
    return {
      missingIds: [] as string[],
      slug: String(fallbackSlug || ''),
      netId: String(fallbackNetId || ''),
      requests: [],
    };
  }

  if (nonEmptyRequests.length === 1) {
    return {
      ...nonEmptyRequests[0],
      requests: nonEmptyRequests,
    };
  }

  return {
    missingIds: [] as string[],
    slug: String(fallbackSlug || ''),
    netId: String(fallbackNetId || ''),
    requests: nonEmptyRequests,
  };
};

export const buildNormalizedRenderedQuestionIds = ({
  renderedIds = [],
}: BuildNormalizedRenderedQuestionIdsArgs = {}): string[] => Array.from(
  new Set(
    Array.from(renderedIds || [])
      .map((id) => normalizeQuestionIdKey(id))
      .filter(Boolean)
  )
);

export const buildQuestionSlugMapForIds = ({
  questionIds = [],
  poolQuestions = null,
  normalizeSlug = null,
  resolveQuestionSlug = null,
}: BuildQuestionSlugMapForIdsArgs = {}): Map<string, string> => {
  const normalizedIds = buildNormalizedRenderedQuestionIds({ renderedIds: questionIds });
  const slugByQuestionId = new Map<string, string>();
  if (normalizedIds.length === 0) return slugByQuestionId;

  const poolQuestionById = new Map<string, unknown>();
  (Array.isArray(poolQuestions) ? poolQuestions : []).forEach((question) => {
    const questionId = normalizeQuestionIdKey(
      isRecord(question) ? question.id : null
    );
    if (!questionId || poolQuestionById.has(questionId)) return;
    poolQuestionById.set(questionId, question);
  });

  normalizedIds.forEach((questionId) => {
    const resolvedSlug = typeof resolveQuestionSlug === 'function'
      ? resolveQuestionSlug({
        questionId,
        question: poolQuestionById.get(questionId),
      })
      : '';
    slugByQuestionId.set(
      questionId,
      typeof normalizeSlug === 'function'
        ? normalizeSlug(resolvedSlug)
        : String(resolvedSlug ?? '')
    );
  });

  return slugByQuestionId;
};

export const buildSubmissionGroupContext = ({
  questionIds = [],
  slugByQuestionId = null,
  fallbackSlug = '',
  normalizeSlug = null,
  multiSessionError = 'Cannot submit responses from multiple sessions at once. Narrow the question view to one session and try again.',
}: BuildSubmissionGroupContextArgs = {}) => {
  const normalizedIds = buildNormalizedRenderedQuestionIds({ renderedIds: questionIds });
  const normalizeValue = (value: unknown): string => (
    typeof normalizeSlug === 'function'
      ? normalizeSlug(value)
      : String(value ?? '')
  );

  if (normalizedIds.length === 0) {
    return {
      ok: true,
      submissionGroupKey: normalizeValue(fallbackSlug),
      sessionSlugs: [] as string[],
      slugByQuestionId: new Map<string, string>(),
    };
  }

  const normalizedSlugByQuestionId = new Map<string, string>();
  const sessionSlugs: string[] = [];
  const seenSlugs = new Set<string>();

  normalizedIds.forEach((questionId) => {
    const resolvedSlug = normalizeValue(
      slugByQuestionId instanceof Map ? slugByQuestionId.get(questionId) : ''
    );
    normalizedSlugByQuestionId.set(questionId, resolvedSlug);
    if (seenSlugs.has(resolvedSlug)) return;
    seenSlugs.add(resolvedSlug);
    sessionSlugs.push(resolvedSlug);
  });

  if (sessionSlugs.length > 1) {
    return {
      ok: false,
      submissionGroupKey: '',
      sessionSlugs,
      slugByQuestionId: normalizedSlugByQuestionId,
      error: multiSessionError,
    };
  }

  return {
    ok: true,
    submissionGroupKey: sessionSlugs[0] ?? normalizeValue(fallbackSlug),
    sessionSlugs,
    slugByQuestionId: normalizedSlugByQuestionId,
  };
};

export const buildLocalCacheHydrationSignature = ({
  surveyIndex = 0,
  scopeSlugs = [],
  networkIdStr = '',
  account = '',
  renderedIds = [],
  questionsCacheNonce = 0,
  questionResponsesNonce = 0,
  suppressPrefill = false,
  submissionError = '',
  submissionComplete = false,
}: BuildLocalCacheHydrationSignatureArgs = {}): string => [
  String(surveyIndex),
  Array.isArray(scopeSlugs) ? scopeSlugs.join(',') : '',
  String(networkIdStr || ''),
  String(account || '').trim().toLowerCase(),
  buildRenderedIdsSignature(Array.from(renderedIds || [])),
  Number(questionsCacheNonce || 0),
  Number(questionResponsesNonce || 0),
  suppressPrefill ? 1 : 0,
  submissionError ? 1 : 0,
  submissionComplete ? 1 : 0,
].join('|');

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
