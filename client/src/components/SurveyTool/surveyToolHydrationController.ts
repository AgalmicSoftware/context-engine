import {
  applyPrefillUpdatePlan,
  applyDraftHydrationEffects,
  applyLocalCacheRehydrateMissEffects,
  applyLocalCacheRehydrateUpdatePlan,
  buildDraftHydrationRunPlan,
  buildDraftHydrationSeedContext,
  buildPrefilledSingleQuestionUpdatePlan,
  buildPrefilledSurveyUpdatePlan,
  buildLocalCacheRehydrationUpdatePlan,
  loadDraftAnswersByQuestionIdSafely,
  loadLocalCacheHydrationSlice,
  prepareLocalCacheRehydrateRun,
  resolveLocalCacheSliceLookup,
  resolveMissingRenderedResponseLookup,
  runPriorResponseBackfillAttempt,
  shouldBackfillPriorResponses,
  shouldSkipDraftHydrationRun,
} from './surveyToolHydrationFlow.js';

type SurveyToolLikeProps = Record<string, unknown>;
type SurveyToolLikeState = Record<string, unknown>;
type SetStateUpdate =
  Record<string, unknown> | null | ((prevState: SurveyToolLikeState) => Record<string, unknown> | null);
type SetState = (update: SetStateUpdate, callback?: () => void) => unknown;
type CloneValue = (value: unknown) => unknown;
type PrefillStateUpdate = Record<string, unknown> | ((prevState: SurveyToolLikeState) => Record<string, unknown>);

const readUserAnswerResponses = (userAnswers: unknown): unknown[] | null => {
  if (!userAnswers || typeof userAnswers !== 'object') return null;
  const responses = (userAnswers as { responses?: unknown }).responses;
  return Array.isArray(responses) ? responses : null;
};

const buildSetStateApplyHandler =
  (setState: SetState = () => {}) =>
  (nextUpdates: PrefillStateUpdate, done?: () => void) =>
    setState(nextUpdates as SetStateUpdate, done);

const executeSurveyPrefillPlan = ({
  updates = null,
  setState = () => {},
  updateJsonPreview = () => {},
  recalculateEditStats = () => {},
}: {
  updates?: PrefillStateUpdate | null;
  setState?: SetState;
  updateJsonPreview?: () => void;
  recalculateEditStats?: () => void;
} = {}) =>
  applyPrefillUpdatePlan({
    updates,
    applyStateUpdates: buildSetStateApplyHandler(setState),
    updateJsonPreview,
    recalculateEditStats,
  });

export const buildSurveyLocalCacheSlice = ({
  props = {},
  rawSlug = '',
  renderedIds = [],
  localCacheSliceMemo = null,
  resolveResponseHydrationContext = null,
  normalizeSessionSlugValue = null,
  getExtraScopeSlugs = null,
  readQuestionsCache = null,
  mergeQuestionResponses = null,
  parseResponse = null,
  applyCachedResponseEntryToSlice = () => false,
  setLocalCacheMemo = () => {},
  resolveLocalCacheSlice = resolveLocalCacheSliceLookup,
  loadLocalCacheSlice = loadLocalCacheHydrationSlice,
  onError = () => {},
}: {
  props?: SurveyToolLikeProps | null;
  rawSlug?: unknown;
  renderedIds?: unknown[];
  localCacheSliceMemo?: Record<string, unknown> | null;
  resolveResponseHydrationContext?: ((rawSlug: unknown) => Record<string, unknown> | null | undefined) | null;
  normalizeSessionSlugValue?: ((value: unknown) => string) | null;
  getExtraScopeSlugs?: ((slug: string) => unknown[] | null | undefined) | null;
  readQuestionsCache?: ((slug: string) => unknown) | null;
  mergeQuestionResponses?: ((target: Record<string, unknown>, source: Record<string, unknown>) => void) | null;
  parseResponse?: ((raw: unknown) => unknown) | null;
  applyCachedResponseEntryToSlice?: (args: Record<string, unknown>) => boolean;
  setLocalCacheMemo?: (nextMemo: { key: string; value: unknown; hasValue: boolean }) => void;
  resolveLocalCacheSlice?: (args?: Record<string, unknown>) => {
    scopeSlugs?: unknown[];
    networkIdStr?: unknown;
    renderedIds?: unknown[];
    normalizedAccount?: string;
    memoKey?: string;
    shouldUseMemo?: boolean;
    memoizedValue?: unknown;
  };
  loadLocalCacheSlice?: (args?: Record<string, unknown>) => unknown;
  onError?: (error: unknown) => void;
} = {}) => {
  try {
    const nextProps = props || {};
    const localCacheLookup = resolveLocalCacheSlice({
      rawSlug,
      account: nextProps.account,
      renderedIds,
      minifiedMode: nextProps.minifiedMode,
      questionsCacheNonce: nextProps.questionsCacheNonce,
      questionResponsesNonce: nextProps.questionResponsesNonce,
      existingMemo: localCacheSliceMemo,
      resolveResponseHydrationContext,
      normalizeSessionSlugValue,
      getExtraScopeSlugs,
    });

    if (localCacheLookup.shouldUseMemo) {
      return localCacheLookup.memoizedValue ?? null;
    }

    const memoize = (value: unknown) => {
      setLocalCacheMemo({
        key: String(localCacheLookup.memoKey || ''),
        value,
        hasValue: true,
      });
      return value;
    };

    const slice = loadLocalCacheSlice({
      scopeSlugs: Array.isArray(localCacheLookup.scopeSlugs) ? localCacheLookup.scopeSlugs : [],
      networkIdStr: localCacheLookup.networkIdStr,
      account: localCacheLookup.normalizedAccount,
      renderedQuestionIds: Array.isArray(localCacheLookup.renderedIds) ? localCacheLookup.renderedIds : [],
      readQuestionsCache,
      mergeQuestionResponses,
      parseResponse,
      applyCachedResponseEntryToSlice,
    });

    if (!slice) {
      return memoize(null);
    }

    return memoize(slice);
  } catch (error) {
    setLocalCacheMemo({ key: '', value: null, hasValue: false });
    onError(error);
    return null;
  }
};

export const resolveSurveyMissingRenderedResponseLookup = ({
  props = {},
  responder = '',
  slug = '',
  fallbackSlug = '',
  renderedIds = [],
  resolveQuestionSlugMapForIds = () => new Map<string, unknown>(),
  resolveResponseHydrationContext = null,
  normalizeSessionSlugValue = null,
  getExtraScopeSlugs = null,
  resolveScopeNetId = null,
  readQuestionsCacheAsync = null,
  ensureQuestionsNet = null,
  resolveMissingLookup = resolveMissingRenderedResponseLookup,
}: {
  props?: SurveyToolLikeProps | null;
  responder?: unknown;
  slug?: unknown;
  fallbackSlug?: unknown;
  renderedIds?: unknown[];
  resolveQuestionSlugMapForIds?: (
    questionIds: string[],
    context?: Record<string, unknown>,
  ) => Map<string, unknown> | null | undefined;
  resolveResponseHydrationContext?: ((rawSlug: unknown) => Record<string, unknown> | null | undefined) | null;
  normalizeSessionSlugValue?: ((value: unknown) => string) | null;
  getExtraScopeSlugs?: ((slug: string) => unknown[] | null | undefined) | null;
  resolveScopeNetId?: ((slug: string, entryNetId: string, fallbackNetId: string) => string | null | undefined) | null;
  readQuestionsCacheAsync?: ((slug: string) => Promise<unknown>) | null;
  ensureQuestionsNet?: ((cache: unknown, netId: string) => unknown) | null;
  resolveMissingLookup?: (args?: Record<string, unknown>) => Promise<unknown>;
} = {}) => {
  const nextProps = props || {};
  return resolveMissingLookup({
    responderLower: responder || nextProps.account,
    rawSlug: slug,
    fallbackSlug,
    renderedIds,
    minifiedMode: nextProps.minifiedMode,
    surveyId: nextProps.surveyId || null,
    resolveResponseHydrationContext,
    normalizeSessionSlugValue,
    getExtraScopeSlugs,
    resolveQuestionSlugMapForIds,
    resolveScopeNetId,
    readQuestionsCacheAsync,
    ensureQuestionsNet,
  });
};

export const executeSurveyResponsePrefill = ({
  state = {},
  surveyIndex = 0,
  userAnswers = null,
  buildSliceFromUserAnswers = null,
  applyResponseHydrationListToSlice = null,
  setState = () => {},
  updateJsonPreview = () => {},
  recalculateEditStats = () => {},
  buildUpdatePlan = buildPrefilledSurveyUpdatePlan,
}: {
  state?: SurveyToolLikeState | null;
  surveyIndex?: number;
  userAnswers?: unknown;
  buildSliceFromUserAnswers?: ((userAnswers: unknown, prevSlice?: unknown) => unknown) | null;
  applyResponseHydrationListToSlice?: ((args: Record<string, unknown>) => boolean) | null;
  setState?: SetState;
  updateJsonPreview?: () => void;
  recalculateEditStats?: () => void;
  buildUpdatePlan?: (args?: Record<string, unknown>) => { updates?: Record<string, unknown> | null | undefined };
} = {}) => {
  const responses = readUserAnswerResponses(userAnswers);
  if (!responses) {
    return { applied: false, reason: 'skip' };
  }

  executeSurveyPrefillPlan({
    updates: (prev: SurveyToolLikeState) => {
      const updatePlan = buildUpdatePlan({
        surveyIndex,
        prevSurveysResponseState: prev?.surveysResponseState,
        prevEditBaseline: prev?.editBaseline,
        isDirty: prev?.isDirty,
        submissionComplete: prev?.submissionComplete,
        responses,
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      });
      return updatePlan?.updates && typeof updatePlan.updates === 'object' ? updatePlan.updates : {};
    },
    setState,
    updateJsonPreview,
    recalculateEditStats,
  });

  return { applied: true, reason: 'applied' };
};

export const executeSurveySingleQuestionPrefill = ({
  state = {},
  questionId = '',
  userAnswer = null,
  buildSliceFromUserAnswers = null,
  applyResponseHydrationListToSlice = null,
  setState = () => {},
  updateJsonPreview = () => {},
  recalculateEditStats = () => {},
  buildUpdatePlan = buildPrefilledSingleQuestionUpdatePlan,
}: {
  state?: SurveyToolLikeState | null;
  questionId?: unknown;
  userAnswer?: unknown;
  buildSliceFromUserAnswers?: ((userAnswers: unknown, prevSlice?: unknown) => unknown) | null;
  applyResponseHydrationListToSlice?: ((args: Record<string, unknown>) => boolean) | null;
  setState?: SetState;
  updateJsonPreview?: () => void;
  recalculateEditStats?: () => void;
  buildUpdatePlan?: (args?: Record<string, unknown>) => { updates?: Record<string, unknown> | null | undefined };
} = {}) => {
  const normalizedQuestionId = String(questionId || '');
  if (!userAnswer || !normalizedQuestionId) {
    return { applied: false, reason: 'skip' };
  }

  executeSurveyPrefillPlan({
    updates: (prev: SurveyToolLikeState) => {
      const updatePlan = buildUpdatePlan({
        surveyIndex: 0,
        questionId: normalizedQuestionId,
        prevSurveysResponseState: prev?.surveysResponseState,
        prevEditBaseline: prev?.editBaseline,
        isDirty: prev?.isDirty,
        submissionComplete: prev?.submissionComplete,
        userAnswer,
        applyResponseHydrationListToSlice,
        buildSliceFromUserAnswers,
      });
      return updatePlan?.updates && typeof updatePlan.updates === 'object' ? updatePlan.updates : {};
    },
    setState,
    updateJsonPreview,
    recalculateEditStats,
  });

  return { applied: true, reason: 'applied' };
};

export const executeSurveyPriorResponseBackfill = ({
  props = {},
  state = {},
  slug = '',
  attemptedSet = new Set<string>(),
  getMissingRenderedResponseIdsForAccount = async () => ({ missingIds: [], slug: '', netId: '' }),
  setHydratingState = () => {},
  isMounted = false,
  refreshQuestionResponses = null,
  readQuestionsCacheAsync = null,
  resetLocalCacheMemo = () => {},
  triggerRehydrate = () => {},
  onFailure = () => {},
  getCurrentInFlight = () => null,
  setCurrentInFlight = () => {},
  shouldBackfill = shouldBackfillPriorResponses,
  runBackfillAttempt = runPriorResponseBackfillAttempt,
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  slug?: string | null;
  attemptedSet?: Set<string>;
  getMissingRenderedResponseIdsForAccount?: (args: { responder: string; slug?: string | null }) => Promise<unknown>;
  setHydratingState?: (active: boolean) => void;
  isMounted?: boolean;
  refreshQuestionResponses?: unknown;
  readQuestionsCacheAsync?: unknown;
  resetLocalCacheMemo?: () => void;
  triggerRehydrate?: () => void;
  onFailure?: (error: unknown) => void;
  getCurrentInFlight?: () => Promise<boolean> | null;
  setCurrentInFlight?: (value: Promise<boolean> | null) => void;
  shouldBackfill?: (args?: Record<string, unknown>) => boolean;
  runBackfillAttempt?: (args?: Record<string, unknown>) => Promise<boolean> | boolean;
} = {}): false | Promise<boolean> => {
  const nextProps = props || {};
  const nextState = state || {};
  if (
    !shouldBackfill({
      loginComplete: nextProps.loginComplete,
      account: nextProps.account,
      displayAnswerMode: nextProps.displayAnswerMode,
      viewAddress: nextProps.viewAddress,
      singleQuestionMode: nextProps.singleQuestionMode,
      responderAddress: nextProps.responderAddress,
      hasRefreshQuestionResponses: typeof nextProps.refreshQuestionResponses === 'function',
      submissionComplete: nextState.submissionComplete,
      isSubmitting: nextState.isSubmitting,
    })
  ) {
    return false;
  }

  const inFlight = typeof getCurrentInFlight === 'function' ? getCurrentInFlight() : null;
  if (inFlight) {
    return inFlight;
  }

  const responderLower = String(nextProps.account || '')
    .trim()
    .toLowerCase();
  let trackedPromise: Promise<boolean> | null = null;
  const runPromise = Promise.resolve().then(() =>
    runBackfillAttempt({
      responderLower,
      slug,
      attemptedSet,
      loadMissingInfo: ({ responder, slug: nextSlug }: { responder: string; slug?: string | null }) =>
        getMissingRenderedResponseIdsForAccount({
          responder,
          slug: nextSlug,
        }),
      setHydratingState,
      isMounted,
      refreshQuestionResponses: nextProps.refreshQuestionResponses,
      readQuestionsCacheAsync,
      onFailure,
      resetLocalCacheMemo,
      triggerRehydrate,
    }),
  );

  trackedPromise = runPromise.finally(() => {
    if (typeof getCurrentInFlight === 'function' && getCurrentInFlight() === trackedPromise) {
      setCurrentInFlight(null);
    }
  });
  setCurrentInFlight(trackedPromise);
  return trackedPromise;
};

export const executeSurveyDraftHydration = ({
  props = {},
  state = {},
  loadDraft = () => null,
  getPendingEditStats = null,
  getHydrationQuestionIds = () => [],
  applyDraftHydrationEntryToSlice = () => false,
  cloneBaseline = ((value: unknown) => value) as CloneValue,
  setState = () => {},
  updateJsonPreview = () => {},
  onError = () => {},
  skipDraftHydrationRun = shouldSkipDraftHydrationRun,
  buildDraftSeedContext = buildDraftHydrationSeedContext,
  buildDraftRunPlan = buildDraftHydrationRunPlan,
  applyDraftEffects = applyDraftHydrationEffects,
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  loadDraft?: () => unknown;
  getPendingEditStats?: (() => { total?: number | null } | null) | null;
  getHydrationQuestionIds?: () => unknown[];
  applyDraftHydrationEntryToSlice?: (args: Record<string, unknown>) => boolean;
  cloneBaseline?: CloneValue;
  setState?: SetState;
  updateJsonPreview?: () => void;
  onError?: (error: unknown) => void;
  skipDraftHydrationRun?: (args?: Record<string, unknown>) => boolean;
  buildDraftSeedContext?: (args?: Record<string, unknown>) => { surveyIndex?: number; prevSlice?: unknown };
  buildDraftRunPlan?: (args?: Record<string, unknown>) => {
    renderedQuestionIds?: string[];
    updates?: Record<string, unknown>;
  };
  applyDraftEffects?: (args?: Record<string, unknown>) => void;
} = {}) => {
  try {
    const nextProps = props || {};
    const nextState = state || {};
    const draft = loadDraft();
    if (
      skipDraftHydrationRun({
        suppressPrefill: nextState.suppressPrefill,
        submissionError: nextState.submissionError,
        draft,
      })
    ) {
      return { reason: 'skip', applied: false, renderedQuestionIds: [] };
    }

    const { surveyIndex, prevSlice } = buildDraftSeedContext({
      isStandalone: nextProps.isStandalone,
      singleQuestionMode: nextProps.singleQuestionMode,
      surveyIndex: nextProps.surveyIndex,
      surveysResponseState: nextState.surveysResponseState,
    });
    const pendingStats = (typeof getPendingEditStats === 'function' && getPendingEditStats()) || {
      total: nextState.modifiedCount || 0,
    };
    const draftRunPlan = buildDraftRunPlan({
      hydrationQuestionIds: getHydrationQuestionIds(),
      pileQuestions: nextState.pileQuestions,
      forceOverwrite: false,
      isDirty: nextState.isDirty,
      modifiedCount: nextState.modifiedCount,
      pendingStats,
      submittedSinceLastEdit: nextState.submittedSinceLastEdit,
      submissionComplete: nextState.submissionComplete,
      prevSurveysResponseState: nextState.surveysResponseState,
      surveyIndex,
      draft,
      prevSlice,
      prevBaseline: nextState.editBaseline,
      cloneBaseline,
      applyDraftEntryToSlice: applyDraftHydrationEntryToSlice,
    });
    const renderedQuestionIds = Array.isArray(draftRunPlan.renderedQuestionIds) ? draftRunPlan.renderedQuestionIds : [];
    const updates = draftRunPlan.updates && typeof draftRunPlan.updates === 'object' ? draftRunPlan.updates : {};

    if (renderedQuestionIds.length === 0) {
      return { reason: 'no-rendered-ids', applied: false, renderedQuestionIds: [] };
    }
    if (Object.keys(updates).length === 0) {
      return {
        reason: 'no-updates',
        applied: false,
        renderedQuestionIds,
      };
    }

    setState(updates, () =>
      applyDraftEffects({
        updateJsonPreview,
      }),
    );
    return {
      reason: 'applied',
      applied: true,
      renderedQuestionIds,
    };
  } catch (error) {
    onError(error);
    return { reason: 'error', applied: false, renderedQuestionIds: [] };
  }
};

export const executeSurveyLocalCacheRehydrate = async ({
  props = {},
  state = {},
  lastHydrationSig = '',
  getHydrationQuestionIds = () => [],
  buildHydrationSignature = () => '',
  buildSliceFromLocalCache = async () => null,
  setLastHydrationSig = () => {},
  loadDraft = () => null,
  buildDraftAnswersByQuestionId = null,
  cloneBaseline = ((value: unknown) => value) as CloneValue,
  buildDraftAwareCacheHydrationState = (args: Record<string, unknown>) => args,
  applyLocalCacheHydrationEntryToSlice = () => false,
  setState = () => {},
  updateJsonPreview = () => {},
  recalculateEditStats = () => {},
  ensurePriorResponses = () => {},
  callback = null,
  bumpNoop = () => {},
  onNoChange = () => {},
  onError = () => {},
  prepareRehydrateRun = prepareLocalCacheRehydrateRun,
  loadDraftAnswersByQid = loadDraftAnswersByQuestionIdSafely,
  buildRehydrationUpdatePlan = buildLocalCacheRehydrationUpdatePlan,
  applyRehydrateMissEffects = applyLocalCacheRehydrateMissEffects,
  applyRehydrateUpdatePlan = applyLocalCacheRehydrateUpdatePlan,
  isStaleRun = () => false,
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  lastHydrationSig?: string | null;
  getHydrationQuestionIds?: () => unknown[];
  buildHydrationSignature?: (surveyIndex: number, renderedIds: unknown[]) => string;
  buildSliceFromLocalCache?: () => Promise<unknown> | unknown;
  setLastHydrationSig?: (value: string) => void;
  loadDraft?: () => unknown;
  buildDraftAnswersByQuestionId?: ((draft: unknown) => unknown) | null;
  cloneBaseline?: CloneValue;
  buildDraftAwareCacheHydrationState?: (args: Record<string, unknown>) => unknown;
  applyLocalCacheHydrationEntryToSlice?: (args: Record<string, unknown>) => boolean;
  setState?: SetState;
  updateJsonPreview?: () => void;
  recalculateEditStats?: () => void;
  ensurePriorResponses?: () => void;
  callback?: (() => void) | null;
  bumpNoop?: () => void;
  onNoChange?: () => void;
  onError?: (error: unknown) => void;
  prepareRehydrateRun?: (args?: Record<string, unknown>) => {
    shouldSkip?: boolean;
    shouldBumpNoop?: boolean;
    hydrationSig?: string;
    baseSlice?: unknown;
  };
  loadDraftAnswersByQid?: (args?: Record<string, unknown>) => Record<string, unknown>;
  buildRehydrationUpdatePlan?: (args?: Record<string, unknown>) => {
    changed?: boolean;
    baselineChanged?: boolean;
    updates?: Record<string, unknown>;
  };
  applyRehydrateMissEffects?: (args?: Record<string, unknown>) => void;
  applyRehydrateUpdatePlan?: (args?: Record<string, unknown>) => boolean;
  isStaleRun?: () => boolean;
} = {}) => {
  try {
    const nextProps = props || {};
    const nextState = state || {};
    const surveyIndex = nextProps.isStandalone || nextProps.singleQuestionMode ? 0 : nextProps.surveyIndex;
    const renderedQuestionIds = getHydrationQuestionIds();
    const rehydrateRun = prepareRehydrateRun({
      state: nextState,
      surveyIndex,
      renderedIds: renderedQuestionIds,
      lastHydrationSig,
      buildHydrationSignature,
    });

    if (rehydrateRun.shouldSkip) {
      if (rehydrateRun.shouldBumpNoop) {
        bumpNoop();
      }
      if (typeof callback === 'function') {
        callback();
      }
      return {
        reason: 'skip',
        applied: false,
        renderedQuestionIds,
        hydrationSig: rehydrateRun.hydrationSig,
      };
    }

    const cacheSlice = await buildSliceFromLocalCache();
    if (isStaleRun()) {
      return {
        reason: 'stale',
        applied: false,
        renderedQuestionIds,
        hydrationSig: rehydrateRun.hydrationSig,
      };
    }
    if (!cacheSlice) {
      applyRehydrateMissEffects({
        clearHydrationSignature: () => {
          setLastHydrationSig('');
        },
        ensurePriorResponses,
        callback,
      });
      return {
        reason: 'cache-miss',
        applied: false,
        renderedQuestionIds,
        hydrationSig: '',
      };
    }

    const hydrationSig = String(rehydrateRun.hydrationSig || '');
    setLastHydrationSig(hydrationSig);
    const draftAnswersByQuestionId = loadDraftAnswersByQid({
      loadDraft,
      buildDraftAnswersByQuestionId,
      onError,
    });
    const rehydrationUpdatePlan = buildRehydrationUpdatePlan({
      prevSurveysResponseState: nextState.surveysResponseState,
      surveyIndex,
      renderedQuestionIds,
      baseSlice: rehydrateRun.baseSlice || {},
      prevBaseline: nextState.editBaseline,
      cacheSlice,
      draftAnswersByQuestionId,
      cloneBaseline,
      buildDraftAwareCacheHydrationState,
      applyLocalCacheHydrationEntryToSlice,
      debugLabel: '[Survey][rehydrateLocal]',
    });

    applyRehydrateUpdatePlan({
      changed: rehydrationUpdatePlan.changed,
      baselineChanged: rehydrationUpdatePlan.baselineChanged,
      updates: rehydrationUpdatePlan.updates,
      applyStateUpdates: buildSetStateApplyHandler(setState),
      updateJsonPreview,
      recalculateEditStats,
      ensurePriorResponses,
      callback,
      onNoChange,
    });

    return {
      reason: rehydrationUpdatePlan.changed || rehydrationUpdatePlan.baselineChanged ? 'applied' : 'no-change',
      applied: !!(rehydrationUpdatePlan.changed || rehydrationUpdatePlan.baselineChanged),
      renderedQuestionIds,
      hydrationSig,
    };
  } catch (error) {
    setLastHydrationSig('');
    onError(error);
    if (typeof callback === 'function') {
      callback();
    }
    return {
      reason: 'error',
      applied: false,
      renderedQuestionIds: [],
      hydrationSig: '',
    };
  }
};
