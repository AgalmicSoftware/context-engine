import {
  applyDraftHydrationEffects,
  applyLocalCacheRehydrateMissEffects,
  applyLocalCacheRehydrateUpdatePlan,
  buildDraftHydrationRunPlan,
  buildDraftHydrationSeedContext,
  buildLocalCacheRehydrationUpdatePlan,
  loadDraftAnswersByQuestionIdSafely,
  prepareLocalCacheRehydrateRun,
  runPriorResponseBackfillAttempt,
  shouldBackfillPriorResponses,
  shouldSkipDraftHydrationRun,
} from './surveyToolHydrationFlow.js';

type SurveyToolLikeProps = Record<string, any>;
type SurveyToolLikeState = Record<string, any>;
type SetStateUpdate = Record<string, unknown> | null | ((prevState: any) => Record<string, unknown> | null);
type SetState = (update: SetStateUpdate, callback?: () => void) => unknown;
type CloneValue = (value: any) => any;

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
  shouldBackfill?: (args?: any) => boolean;
  runBackfillAttempt?: (args?: any) => Promise<boolean> | boolean;
} = {}): false | Promise<boolean> => {
  const nextProps = props || {};
  const nextState = state || {};
  if (!shouldBackfill({
    loginComplete: nextProps.loginComplete,
    account: nextProps.account,
    displayAnswerMode: nextProps.displayAnswerMode,
    viewAddress: nextProps.viewAddress,
    singleQuestionMode: nextProps.singleQuestionMode,
    responderAddress: nextProps.responderAddress,
    hasRefreshQuestionResponses: typeof nextProps.refreshQuestionResponses === 'function',
    submissionComplete: nextState.submissionComplete,
    isSubmitting: nextState.isSubmitting,
  })) {
    return false;
  }

  const inFlight = typeof getCurrentInFlight === 'function'
    ? getCurrentInFlight()
    : null;
  if (inFlight) {
    return inFlight;
  }

  const responderLower = String(nextProps.account || '').trim().toLowerCase();
  let trackedPromise: Promise<boolean> | null = null;
  const runPromise = Promise.resolve().then(() => runBackfillAttempt({
    responderLower,
    slug: slug as any,
    attemptedSet,
    loadMissingInfo: ({ responder, slug: nextSlug }: { responder: string; slug?: string | null }) => getMissingRenderedResponseIdsForAccount({
      responder,
      slug: nextSlug,
    }) as Promise<any>,
    setHydratingState,
    isMounted,
    refreshQuestionResponses: nextProps.refreshQuestionResponses,
    readQuestionsCacheAsync: readQuestionsCacheAsync as any,
    onFailure,
    resetLocalCacheMemo,
    triggerRehydrate,
  }));

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
  cloneBaseline = ((value: any) => value) as CloneValue,
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
  skipDraftHydrationRun?: (args?: any) => boolean;
  buildDraftSeedContext?: (args?: any) => { surveyIndex?: number; prevSlice?: any };
  buildDraftRunPlan?: (args?: any) => { renderedQuestionIds?: string[]; updates?: Record<string, unknown> };
  applyDraftEffects?: (args?: any) => void;
} = {}) => {
  try {
    const nextProps = props || {};
    const nextState = state || {};
    const draft = loadDraft();
    if (skipDraftHydrationRun({
      suppressPrefill: nextState.suppressPrefill,
      submissionError: nextState.submissionError,
      draft,
    })) {
      return { reason: 'skip', applied: false, renderedQuestionIds: [] };
    }

    const { surveyIndex, prevSlice } = buildDraftSeedContext({
      isStandalone: nextProps.isStandalone,
      singleQuestionMode: nextProps.singleQuestionMode,
      surveyIndex: nextProps.surveyIndex,
      surveysResponseState: nextState.surveysResponseState,
    });
    const pendingStats =
      (typeof getPendingEditStats === 'function' && getPendingEditStats()) ||
      { total: nextState.modifiedCount || 0 };
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
      draft: draft as any,
      prevSlice,
      prevBaseline: nextState.editBaseline,
      cloneBaseline: cloneBaseline as any,
      applyDraftEntryToSlice: applyDraftHydrationEntryToSlice,
    });
    const renderedQuestionIds = Array.isArray(draftRunPlan.renderedQuestionIds)
      ? draftRunPlan.renderedQuestionIds
      : [];
    const updates = draftRunPlan.updates && typeof draftRunPlan.updates === 'object'
      ? draftRunPlan.updates
      : {};

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

    setState(updates, () => applyDraftEffects({
      updateJsonPreview,
    }));
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
  cloneBaseline = ((value: any) => value) as CloneValue,
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
  prepareRehydrateRun?: (args?: any) => { shouldSkip?: boolean; shouldBumpNoop?: boolean; hydrationSig?: string; baseSlice?: any };
  loadDraftAnswersByQid?: (args?: any) => Record<string, unknown>;
  buildRehydrationUpdatePlan?: (args?: any) => { changed?: boolean; baselineChanged?: boolean; updates?: any };
  applyRehydrateMissEffects?: (args?: any) => void;
  applyRehydrateUpdatePlan?: (args?: any) => boolean;
} = {}) => {
  try {
    const nextProps = props || {};
    const nextState = state || {};
    const surveyIndex =
      nextProps.isStandalone || nextProps.singleQuestionMode
        ? 0
        : nextProps.surveyIndex;
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
      cloneBaseline: cloneBaseline as any,
      buildDraftAwareCacheHydrationState: buildDraftAwareCacheHydrationState as any,
      applyLocalCacheHydrationEntryToSlice,
      debugLabel: '[Survey][rehydrateLocal]',
    });

    applyRehydrateUpdatePlan({
      changed: rehydrationUpdatePlan.changed,
      baselineChanged: rehydrationUpdatePlan.baselineChanged,
      updates: rehydrationUpdatePlan.updates,
      applyStateUpdates: (nextUpdates: SetStateUpdate, done?: () => void) => setState(nextUpdates, done),
      updateJsonPreview,
      recalculateEditStats,
      ensurePriorResponses,
      callback,
      onNoChange,
    });

    return {
      reason: rehydrationUpdatePlan.changed || rehydrationUpdatePlan.baselineChanged
        ? 'applied'
        : 'no-change',
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
