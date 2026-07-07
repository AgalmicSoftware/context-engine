import type { UnknownRecord } from './surveyToolTypes';
import {
  getBlockedQuestionIdsSet,
  getSessionSlugHintFromProps,
  getSessionSlugPinnedFromProps,
  normalizeSessionSlugValue,
  resolveEffectiveSlug,
  resolveExplicitSessionContext,
  resolveSlugForIds,
} from './surveyToolUtils';

type QuestionPayload = UnknownRecord & {
  creator?: unknown;
  id?: string;
  tags?: unknown;
};

type QuestionsCache = Record<
  string,
  {
    questions: Record<string, QuestionPayload>;
  } & UnknownRecord
>;

type CacheState = {
  netIdStr: string;
  questionsCache: QuestionsCache;
};

type SeededHydrationPlan = {
  questionData: QuestionPayload;
  isLoadingResponse: boolean;
};

type CacheBootstrapFlowRetryPlan = {
  reason: string;
  retryingPhase: string;
  exhaustedPhase: string;
  exhaustedStatePatch: UnknownRecord;
};

type QuestionFetchCandidateSlugResolver = (
  questionId: string,
  preferredSlug: string,
  options: { allowPinnedFallback: boolean },
) => string[];

type BlockedQuestionIdsResolver = (sessionSlug: string) => Set<string>;

type SourceRestoreRetryCleanupAction = 'none' | 'clear-current-attempt' | 'clear-different-question';

type SourceRestoreCommonPlan = {
  bootstrapRetryAttempt: number;
  hasPendingRetryForQuestion: boolean;
  pendingRetryQuestionId: string;
  pendingRetrySig: string;
  questionId: string;
  retryCleanupAction: SourceRestoreRetryCleanupAction;
};

export type SingleQuestionSourceRestoreMissingQuestionPlan = SourceRestoreCommonPlan & {
  status: 'missing-question-id';
  debugPayload: UnknownRecord;
  statePatch: UnknownRecord;
};

export type SingleQuestionSourceRestoreBlockedQuestionPlan = SourceRestoreCommonPlan & {
  status: 'blocked-question';
  effectiveSingleSlug: string;
  explicitSingleSlug: string;
  explicitSingleSlugKnown: boolean;
  fetchCandidateSlugs: string[];
  resolvedSingleSlug: string;
  slugPinned: boolean;
  startDebugPayload: UnknownRecord;
  debugPayload: UnknownRecord;
  statePatch: UnknownRecord;
};

export type SingleQuestionSourceRestoreReadyPlan = SourceRestoreCommonPlan & {
  status: 'ready';
  effectiveSingleSlug: string;
  explicitSingleSlug: string;
  explicitSingleSlugKnown: boolean;
  fetchCandidateSlugs: string[];
  resolvedSingleSlug: string;
  slugPinned: boolean;
  startDebugPayload: UnknownRecord;
};

export type SingleQuestionSourceRestoreContextPlan =
  | SingleQuestionSourceRestoreMissingQuestionPlan
  | SingleQuestionSourceRestoreBlockedQuestionPlan
  | SingleQuestionSourceRestoreReadyPlan;

export type CacheBootstrapFlowContinue = {
  action: 'continue';
  cacheState: CacheState;
  questionData: QuestionPayload | null;
  recentPayloadForAccount: QuestionPayload | null;
  seededHydration: SeededHydrationPlan | null;
};

export type CacheBootstrapFlowStop = {
  action: 'stop';
  debugPhase: string;
  fallbackStatePatch: UnknownRecord;
  logMissingCacheState: boolean;
  preserveCurrentPoolPatch: UnknownRecord | null;
  retryPlan: CacheBootstrapFlowRetryPlan | null;
  seededHydration: SeededHydrationPlan | null;
};

export type CacheBootstrapFlowPlan = CacheBootstrapFlowContinue | CacheBootstrapFlowStop;

export type CacheBootstrapStopHandlingContinue = {
  action: 'continue';
};

export type CacheBootstrapStopHandlingRetry = {
  action: 'retry';
  retryRequest: {
    questionId: string;
    attempt: number;
    reason: string;
  };
  retryOutcome: {
    debugPayload: UnknownRecord;
    exhaustedStatePatch: UnknownRecord | null;
    shouldClearRetry: boolean;
  } | null;
};

export type CacheBootstrapStopHandlingFallback = {
  action: 'fallback';
  debugPayload: UnknownRecord | null;
  fallbackStatePatch: UnknownRecord | null;
  logMissingCacheState: boolean;
  preserveCurrentPoolPatch: UnknownRecord | null;
  shouldApplyFallbackStatePatch: boolean;
};

export type CacheBootstrapStopHandlingPlan =
  CacheBootstrapStopHandlingContinue | CacheBootstrapStopHandlingRetry | CacheBootstrapStopHandlingFallback;

export type SingleQuestionPreservedPoolPlan =
  | {
      action: 'preserve';
      statePatch: UnknownRecord & { questionPool: QuestionPayload[] };
    }
  | {
      action: 'skip';
      statePatch: null;
    };

export type SingleQuestionCacheBootstrapTarget = {
  account: string;
  effectiveSingleSlug: string;
  questionId: string;
  responderAddress: string;
};

export type CacheBootstrapReady = {
  status: 'ready';
  cacheState: CacheState;
  questionData: QuestionPayload | null;
  recentPayloadForAccount: QuestionPayload | null;
  target: SingleQuestionCacheBootstrapTarget;
};

export type CacheBootstrapSeeded = {
  status: 'seeded-from-recent';
  cacheState: CacheState | null;
  questionData: QuestionPayload;
  recentPayloadForAccount: QuestionPayload;
  shouldBootstrapViewedResponse: boolean;
  fallbackNetId: string;
  target: SingleQuestionCacheBootstrapTarget;
};

export type CacheBootstrapMissing = {
  status: 'missing-cache-state';
  target: SingleQuestionCacheBootstrapTarget;
};

export type CacheBootstrapResult = CacheBootstrapReady | CacheBootstrapSeeded | CacheBootstrapMissing;

const buildMissingCacheStateStopPlan = (
  seededHydration: SeededHydrationPlan | null = null,
): CacheBootstrapFlowStop => ({
  action: 'stop',
  debugPhase: 'missing-cache-state',
  fallbackStatePatch: { isLoadingResponse: false },
  logMissingCacheState: true,
  preserveCurrentPoolPatch: { isLoadingResponse: false },
  retryPlan: null,
  seededHydration,
});

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const buildSingleQuestionSourceRestoreContextPlan = ({
  bootstrapRetryAttempt = 0,
  getBlockedQuestionIds = getBlockedQuestionIdsSet,
  getQuestionFetchCandidateSlugs = () => [],
  maxCandidateSlugs = 0,
  pendingRetrySig = '',
  props = {},
  questionPool = [],
  runId = null,
}: {
  bootstrapRetryAttempt?: unknown;
  getBlockedQuestionIds?: BlockedQuestionIdsResolver;
  getQuestionFetchCandidateSlugs?: QuestionFetchCandidateSlugResolver;
  maxCandidateSlugs?: unknown;
  pendingRetrySig?: unknown;
  props?: UnknownRecord;
  questionPool?: unknown;
  runId?: unknown;
} = {}): SingleQuestionSourceRestoreContextPlan => {
  const retryAttempt = Number(bootstrapRetryAttempt || 0);
  const rawQuestionId = props.questionID;
  const retrySig = String(pendingRetrySig || '')
    .trim()
    .toLowerCase();
  const pendingRetryQuestionId = retrySig ? retrySig.split(':')[0] : '';

  if (!rawQuestionId) {
    return {
      status: 'missing-question-id',
      bootstrapRetryAttempt: retryAttempt,
      debugPayload: {
        phase: 'missing-question-id',
        runId,
        bootstrapRetryAttempt: retryAttempt,
      },
      hasPendingRetryForQuestion: false,
      pendingRetryQuestionId,
      pendingRetrySig: retrySig,
      questionId: '',
      retryCleanupAction: 'none',
      statePatch: { isLoadingResponse: false },
    };
  }

  const questionId = String(rawQuestionId).toLowerCase();
  const hasPendingRetryForQuestion = !!(pendingRetryQuestionId && pendingRetryQuestionId === questionId);
  const retryCleanupAction: SourceRestoreRetryCleanupAction =
    retryAttempt > 0
      ? 'clear-current-attempt'
      : pendingRetryQuestionId && pendingRetryQuestionId !== questionId
        ? 'clear-different-question'
        : 'none';
  const slugPinned = !!getSessionSlugPinnedFromProps(props);
  const explicitSingleSlug = normalizeSessionSlugValue(getSessionSlugHintFromProps(props));
  const explicitSingleSlugKnown =
    explicitSingleSlug === '' || !!resolveExplicitSessionContext(explicitSingleSlug).sessionConfig;
  const currentQuestionSessionName = (questionPool as { [index: number]: UnknownRecord } | null)?.[0]?.sessionName;
  const resolvedSingleSlug = resolveSlugForIds({
    sessionName: props.sessionName || currentQuestionSessionName,
    questionId: rawQuestionId,
    surveyId: null,
    props,
    network: props.network as UnknownRecord | null | undefined,
  });
  const effectiveSingleSlug = explicitSingleSlug || resolvedSingleSlug || resolveEffectiveSlug(props);
  const fetchCandidateSlugs = getQuestionFetchCandidateSlugs(questionId, effectiveSingleSlug, {
    allowPinnedFallback: !slugPinned || retryAttempt > 0 || !explicitSingleSlugKnown,
  }).slice(0, Math.max(0, Number(maxCandidateSlugs || 0)));
  const startDebugPayload = {
    phase: 'start',
    runId,
    questionId,
    responderAddress: String(props.responderAddress || '').toLowerCase(),
    bootstrapRetryAttempt: retryAttempt,
    pendingRetrySig: retrySig || null,
    hasPendingRetryForQuestion,
    questionResponsesNonce: Number(props.questionResponsesNonce || 0),
    questionsCacheNonce: Number(props.questionsCacheNonce || 0),
  };
  const common = {
    bootstrapRetryAttempt: retryAttempt,
    effectiveSingleSlug,
    explicitSingleSlug,
    explicitSingleSlugKnown,
    fetchCandidateSlugs,
    hasPendingRetryForQuestion,
    pendingRetryQuestionId,
    pendingRetrySig: retrySig,
    questionId,
    resolvedSingleSlug,
    retryCleanupAction,
    slugPinned,
    startDebugPayload,
  };

  if (getBlockedQuestionIds(effectiveSingleSlug).has(questionId)) {
    return {
      ...common,
      status: 'blocked-question',
      debugPayload: {
        phase: 'blocked-question',
        runId,
        questionId,
        effectiveSingleSlug: String(effectiveSingleSlug || ''),
      },
      statePatch: {
        questionPool: [],
        isLoadingResponse: false,
        noResponse: true,
        responseLookupWarning: '',
        displayAnswerMode: true,
      },
    };
  }

  return {
    ...common,
    status: 'ready',
  };
};

export const buildSingleQuestionPreservedPoolState = ({
  questionId = '',
  questionPool = [],
  extraState = {},
}: {
  questionId?: unknown;
  questionPool?: unknown;
  extraState?: unknown;
} = {}): SingleQuestionPreservedPoolPlan => {
  const normalizedQuestionId = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!normalizedQuestionId || !Array.isArray(questionPool)) {
    return { action: 'skip', statePatch: null };
  }

  const existingQuestion = questionPool.find(
    (item) =>
      isRecord(item) &&
      String(item.id || item.questionID || '')
        .trim()
        .toLowerCase() === normalizedQuestionId,
  );
  if (!isRecord(existingQuestion)) {
    return { action: 'skip', statePatch: null };
  }

  const extraPatch = isRecord(extraState) ? extraState : {};
  return {
    action: 'preserve',
    statePatch: {
      questionPool: [{ ...existingQuestion, id: normalizedQuestionId }],
      ...extraPatch,
    },
  };
};

export const resolveSingleQuestionCacheBootstrapFlowPlan = ({
  cacheBootstrapResult = null,
}: {
  cacheBootstrapResult?: CacheBootstrapResult | null;
} = {}): CacheBootstrapFlowPlan => {
  if (!cacheBootstrapResult || cacheBootstrapResult.status === 'missing-cache-state') {
    return buildMissingCacheStateStopPlan();
  }

  if (cacheBootstrapResult.status === 'ready') {
    return {
      action: 'continue',
      cacheState: cacheBootstrapResult.cacheState,
      questionData: cacheBootstrapResult.questionData,
      recentPayloadForAccount: cacheBootstrapResult.recentPayloadForAccount,
      seededHydration: null,
    };
  }

  const seededHydration = {
    questionData: cacheBootstrapResult.questionData,
    isLoadingResponse: cacheBootstrapResult.shouldBootstrapViewedResponse,
  };

  if (cacheBootstrapResult.shouldBootstrapViewedResponse) {
    return {
      action: 'stop',
      debugPhase: '',
      fallbackStatePatch: {},
      logMissingCacheState: false,
      preserveCurrentPoolPatch: null,
      retryPlan: {
        reason: 'recent-payload-waiting-for-response-bootstrap',
        retryingPhase: 'recent-payload-response-bootstrap-retrying',
        exhaustedPhase: 'recent-payload-response-bootstrap-exhausted',
        exhaustedStatePatch: {
          viewAddressAnswers: '',
          parsedViewAddressAnswers: null,
          noResponse: true,
          responseLookupWarning: '',
          isLoadingResponse: false,
        },
      },
      seededHydration,
    };
  }

  if (!cacheBootstrapResult.fallbackNetId) {
    return {
      action: 'stop',
      debugPhase: 'recent-payload-missing-network',
      fallbackStatePatch: { isLoadingResponse: false },
      logMissingCacheState: false,
      preserveCurrentPoolPatch: null,
      retryPlan: null,
      seededHydration,
    };
  }

  if (!cacheBootstrapResult.cacheState) {
    return buildMissingCacheStateStopPlan(seededHydration);
  }

  return {
    action: 'continue',
    cacheState: cacheBootstrapResult.cacheState,
    questionData: cacheBootstrapResult.questionData,
    recentPayloadForAccount: cacheBootstrapResult.recentPayloadForAccount,
    seededHydration,
  };
};

export const buildSingleQuestionSeededHydrationState = ({
  prevState = {},
  questionData = null,
  isLoadingResponse = false,
  mergeSurveyResponseState = (previous: unknown) => previous,
}: {
  prevState?: UnknownRecord;
  questionData?: QuestionPayload | null;
  isLoadingResponse?: unknown;
  mergeSurveyResponseState?: (
    previousResponseState: unknown,
    questionPool: QuestionPayload[],
    surveyIndex: number,
  ) => unknown;
} = {}) => {
  const seededQuestion = { ...((questionData || {}) as QuestionPayload), id: questionData?.id };
  const previousResponseState = prevState.surveysResponseState || [
    { answers: {}, importance: {}, conviction: {}, additionalComments: {} },
  ];

  return {
    questionPool: [seededQuestion],
    surveysResponseState: mergeSurveyResponseState(previousResponseState, [seededQuestion], 0),
    viewAddressAnswers: '',
    parsedViewAddressAnswers: null,
    noResponse: false,
    isLoadingResponse: !!isLoadingResponse,
  };
};

const hasObjectKeys = (value: unknown): boolean =>
  !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value as UnknownRecord).length > 0;

const buildSingleQuestionCacheBootstrapTarget = ({
  account = '',
  effectiveSingleSlug = '',
  questionId = '',
  responderAddress = '',
}: {
  account?: unknown;
  effectiveSingleSlug?: unknown;
  questionId?: unknown;
  responderAddress?: unknown;
} = {}): SingleQuestionCacheBootstrapTarget => ({
  account: String(account || ''),
  effectiveSingleSlug: String(effectiveSingleSlug || ''),
  questionId: String(questionId || ''),
  responderAddress: String(responderAddress || ''),
});

export const resolveSingleQuestionCacheBootstrapStopHandlingPlan = ({
  bootstrapRetryAttempt = 0,
  cacheBootstrapPlan = null,
  didScheduleRetry,
  effectiveSingleSlug = '',
  questionId = '',
  responderAddress = '',
  runId = null,
}: {
  bootstrapRetryAttempt?: unknown;
  cacheBootstrapPlan?: CacheBootstrapFlowPlan | null;
  didScheduleRetry?: unknown;
  effectiveSingleSlug?: unknown;
  questionId?: unknown;
  responderAddress?: unknown;
  runId?: unknown;
} = {}): CacheBootstrapStopHandlingPlan => {
  if (!cacheBootstrapPlan || cacheBootstrapPlan.action !== 'stop') {
    return { action: 'continue' };
  }

  const retryAttempt = Number(bootstrapRetryAttempt || 0);
  const normalizedQuestionId = String(questionId || '')
    .trim()
    .toLowerCase();
  const effectiveSlug = String(effectiveSingleSlug || '');

  if (cacheBootstrapPlan.retryPlan) {
    const retryRequest = {
      questionId: normalizedQuestionId,
      attempt: retryAttempt,
      reason: cacheBootstrapPlan.retryPlan.reason,
    };
    const hasRetryOutcome = typeof didScheduleRetry === 'boolean';

    return {
      action: 'retry',
      retryRequest,
      retryOutcome: hasRetryOutcome
        ? {
            debugPayload: {
              phase: didScheduleRetry
                ? cacheBootstrapPlan.retryPlan.retryingPhase
                : cacheBootstrapPlan.retryPlan.exhaustedPhase,
              runId,
              questionId: normalizedQuestionId,
              effectiveSingleSlug: effectiveSlug,
              responderAddress: String(responderAddress || '').toLowerCase(),
              retryAttempt,
              didScheduleRetry: !!didScheduleRetry,
            },
            exhaustedStatePatch: didScheduleRetry ? null : cacheBootstrapPlan.retryPlan.exhaustedStatePatch,
            shouldClearRetry: !didScheduleRetry,
          }
        : null,
    };
  }

  const debugPayload = cacheBootstrapPlan.debugPhase
    ? {
        phase: cacheBootstrapPlan.debugPhase,
        runId,
        questionId: normalizedQuestionId,
        effectiveSingleSlug: effectiveSlug,
        ...(cacheBootstrapPlan.debugPhase === 'recent-payload-missing-network' ? { retryAttempt } : {}),
      }
    : null;
  const fallbackStatePatch = hasObjectKeys(cacheBootstrapPlan.fallbackStatePatch)
    ? cacheBootstrapPlan.fallbackStatePatch
    : null;

  return {
    action: 'fallback',
    debugPayload,
    fallbackStatePatch,
    logMissingCacheState: !!cacheBootstrapPlan.logMissingCacheState,
    preserveCurrentPoolPatch: cacheBootstrapPlan.preserveCurrentPoolPatch || null,
    shouldApplyFallbackStatePatch: !!fallbackStatePatch,
  };
};

export const resolveSingleQuestionCacheBootstrap = async ({
  questionId = '',
  effectiveSingleSlug = '',
  responderAddress = '',
  account = '',
  resolveCacheState = async () => null,
  readRecentPayload = () => null,
  canUseRecentPayload = () => false,
  resolveBootstrapNetworkId = () => '',
  updateCacheAtomic = async () => null,
  ensureQuestionsNet = (cache, _netId) => cache as QuestionsCache,
  pickBetterQuestionPayload = (_current, next) => next,
  areQuestionPayloadsEquivalent = (left, right) => left === right,
  writeQuestionsCache = async () => {},
}: {
  questionId?: string;
  effectiveSingleSlug?: string;
  responderAddress?: string;
  account?: string;
  resolveCacheState?: (slug: string) => Promise<CacheState | null>;
  readRecentPayload?: (questionId: string) => unknown;
  canUseRecentPayload?: (payload: unknown, account: string) => boolean;
  resolveBootstrapNetworkId?: (slug: string) => string;
  updateCacheAtomic?: (key: string, slug: string, updater: (current: unknown) => QuestionsCache) => Promise<unknown>;
  ensureQuestionsNet?: (cache: unknown, netId: string) => QuestionsCache;
  pickBetterQuestionPayload?: (current: QuestionPayload | null, next: QuestionPayload) => QuestionPayload | null;
  areQuestionPayloadsEquivalent?: (left: QuestionPayload | null, right: QuestionPayload) => boolean;
  writeQuestionsCache?: (slug: string, cache: QuestionsCache) => Promise<unknown>;
} = {}): Promise<CacheBootstrapResult> => {
  const target = buildSingleQuestionCacheBootstrapTarget({
    account,
    effectiveSingleSlug,
    questionId,
    responderAddress,
  });
  let qData: QuestionPayload | null = null;
  const recentPayload = readRecentPayload(questionId);
  const recentPayloadForAccount = canUseRecentPayload(recentPayload, account)
    ? { ...(recentPayload as UnknownRecord), id: questionId }
    : null;
  let cacheState = await resolveCacheState(effectiveSingleSlug);

  if (!cacheState) {
    if (!recentPayloadForAccount) {
      return { status: 'missing-cache-state', target };
    }

    const shouldBootstrapViewedResponse = !!responderAddress;
    qData = { ...recentPayloadForAccount, id: questionId };
    if (!qData.creator) qData.creator = '';
    if (!Array.isArray(qData.tags)) qData.tags = [];

    const fallbackNetId = resolveBootstrapNetworkId(effectiveSingleSlug);
    if (fallbackNetId) {
      const bootstrapCache = await updateCacheAtomic('questionsCache', effectiveSingleSlug, (current) => {
        const nextCache = ensureQuestionsNet(current && typeof current === 'object' ? current : {}, fallbackNetId);
        nextCache[fallbackNetId].questions[questionId] = {
          ...(nextCache[fallbackNetId].questions[questionId] || {}),
          ...qData,
          id: questionId,
        };
        return nextCache;
      });
      cacheState = {
        netIdStr: fallbackNetId,
        questionsCache: ensureQuestionsNet(bootstrapCache || {}, fallbackNetId),
      };
    }

    return {
      status: 'seeded-from-recent',
      cacheState,
      questionData: qData,
      recentPayloadForAccount,
      shouldBootstrapViewedResponse,
      fallbackNetId,
      target,
    };
  }

  const { netIdStr, questionsCache } = cacheState;
  qData = questionsCache[netIdStr].questions?.[questionId];

  if (!qData && recentPayloadForAccount) {
    qData = { ...recentPayloadForAccount, id: questionId };
    questionsCache[netIdStr].questions[questionId] = {
      ...(questionsCache[netIdStr].questions[questionId] || {}),
      ...qData,
    };
    void writeQuestionsCache(effectiveSingleSlug, questionsCache);
  }

  if (qData && recentPayloadForAccount) {
    const pickedFromRecent = pickBetterQuestionPayload(qData, recentPayloadForAccount) || qData;
    const normalizedPicked = { ...pickedFromRecent, id: questionId };
    const shouldWriteRecentUpgrade = !areQuestionPayloadsEquivalent(qData, normalizedPicked);
    qData = normalizedPicked;
    if (shouldWriteRecentUpgrade) {
      questionsCache[netIdStr].questions[questionId] = normalizedPicked;
      void writeQuestionsCache(effectiveSingleSlug, questionsCache);
    }
  }

  return {
    status: 'ready',
    cacheState,
    questionData: qData,
    recentPayloadForAccount,
    target,
  };
};
