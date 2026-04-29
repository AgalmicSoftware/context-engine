type SurveyToolLikeProps = Record<string, any>;
type SurveyToolLikeState = Record<string, any>;
type SetStateUpdate =
  | Record<string, unknown>
  | null
  | ((prevState: any) => Record<string, unknown> | null);
type SafeSetState = (update: SetStateUpdate) => unknown;

const hasEncryptedResponseFields = (response: any) => !!(
  response?.answer?.encryptedPortion
  || response?.additional?.encryptedPortion
  || response?.answer?.encrypted
  || response?.additional?.encrypted
);

export const readSingleQuestionCachedResponderResponse = ({
  responder = '',
  questionId = '',
  netIdStr = '',
  questionsCache = null,
  cloneValue = (value: unknown) => value,
}: {
  responder?: unknown;
  questionId?: unknown;
  netIdStr?: unknown;
  questionsCache?: unknown;
  cloneValue?: (value: unknown) => unknown;
} = {}) => {
  const addr = String(responder || '').toLowerCase();
  const netId = String(netIdStr || '');
  const qid = String(questionId || '').toLowerCase();
  if (!addr || !netId || !qid || !questionsCache || typeof questionsCache !== 'object') {
    return null;
  }

  const cached = (questionsCache as any)?.[netId]?.questionResponses?.[qid]?.[addr] || null;
  if (!cached || typeof cached !== 'object') return null;
  return cloneValue(cached);
};

export const readFreshSingleQuestionCachedResponderResponse = async ({
  responder = '',
  questionId = '',
  netIdStr = '',
  effectiveSingleSlug = '',
  readQuestionsCacheAsync = async () => null,
  ensureQuestionsNet = (cache: unknown) => cache,
  cloneValue = (value: unknown) => value,
  updateQuestionsCache = () => {},
}: {
  responder?: unknown;
  questionId?: unknown;
  netIdStr?: unknown;
  effectiveSingleSlug?: unknown;
  readQuestionsCacheAsync?: (slug: string) => Promise<unknown>;
  ensureQuestionsNet?: (cache: unknown, netId: string) => unknown;
  cloneValue?: (value: unknown) => unknown;
  updateQuestionsCache?: (cache: unknown) => void;
} = {}) => {
  const addr = String(responder || '').toLowerCase();
  const qid = String(questionId || '').toLowerCase();
  const netId = String(netIdStr || '').trim();
  const slug = String(effectiveSingleSlug || '');
  if (!addr || !qid || !slug) return null;

  let freshCache = null;
  try {
    freshCache = await readQuestionsCacheAsync(slug);
  } catch (_) {
    freshCache = null;
  }
  if (!freshCache || typeof freshCache !== 'object') return null;

  const netCandidates: string[] = [];
  if (netId) netCandidates.push(netId);
  Object.keys(freshCache as any).forEach((candidateNetId) => {
    const normalizedNetId = String(candidateNetId || '').trim();
    if (!normalizedNetId || netCandidates.includes(normalizedNetId)) return;
    netCandidates.push(normalizedNetId);
  });

  for (const candidateNetId of netCandidates) {
    const cached = (freshCache as any)?.[candidateNetId]?.questionResponses?.[qid]?.[addr] || null;
    if (!cached || typeof cached !== 'object') continue;
    updateQuestionsCache(ensureQuestionsNet(freshCache, netId || candidateNetId));
    return cloneValue(cached);
  }
  return null;
};

export const writeSingleQuestionResponseToCache = async ({
  responder = '',
  respObj = null,
  questionId = '',
  effectiveSingleSlug = '',
  netIdStr = '',
  readQuestionsCacheAsync = async () => ({}),
  ensureQuestionsNet = (cache: unknown) => cache,
  writeQuestionsCache = async () => {},
}: {
  responder?: unknown;
  respObj?: any;
  questionId?: unknown;
  effectiveSingleSlug?: unknown;
  netIdStr?: unknown;
  readQuestionsCacheAsync?: (slug: string) => Promise<unknown>;
  ensureQuestionsNet?: (cache: unknown, netId: string) => any;
  writeQuestionsCache?: (slug: string, cache: unknown) => Promise<unknown>;
} = {}) => {
  if (!responder || !respObj) return null;
  const addr = String(responder).toLowerCase();
  const slug = String(effectiveSingleSlug || '');
  const netId = String(netIdStr || '');
  const qid = String(questionId || '').toLowerCase();
  if (!addr || !slug || !netId || !qid) return null;

  const currentCache = ensureQuestionsNet(await readQuestionsCacheAsync(slug), netId);
  currentCache[netId] = currentCache[netId] || {};
  currentCache[netId].questionResponses = currentCache[netId].questionResponses || {};
  currentCache[netId].questionResponses[qid] =
    currentCache[netId].questionResponses[qid] || {};
  currentCache[netId].questionResponsesMeta = currentCache[netId].questionResponsesMeta || {};
  currentCache[netId].questionResponsesMeta[qid] =
    currentCache[netId].questionResponsesMeta[qid] || {};

  const prev = currentCache[netId].questionResponsesMeta[qid][addr] || { bn: 0, txi: 0, li: 0, ts: 0 };
  const prevBn = Number(prev?.bn ?? prev?.blockNumber ?? 0) || 0;
  const prevTxi = Number(prev?.txi ?? prev?.transactionIndex ?? prev?.txIndex ?? 0) || 0;
  const prevLi = Number(prev?.li ?? prev?.logIndex ?? 0) || 0;
  const prevTs = Number(prev?.ts ?? prev?.timestamp ?? 0) || 0;
  const bn = Number(respObj?.blockNumber ?? respObj?.bn ?? 0) || 0;
  const txi = Number(respObj?.transactionIndex ?? respObj?.txIndex ?? respObj?.txi ?? 0) || 0;
  const li = Number(respObj?.logIndex ?? respObj?.li ?? 0) || 0;
  const ts = Number(respObj?.timestamp ?? respObj?.ts ?? 0) || 0;
  const isStaleResponse =
    bn < prevBn
    || (
      bn === prevBn
      && (
        txi < prevTxi
        || (
          txi === prevTxi
          && (
            li < prevLi
            || (
              li === prevLi
              && ts <= prevTs
            )
          )
        )
      )
    );
  if (isStaleResponse) return currentCache;

  currentCache[netId].questionResponses[qid][addr] = respObj;
  currentCache[netId].questionResponsesMeta[qid][addr] = { bn, txi, li, ts };
  await writeQuestionsCache(slug, currentCache);
  return currentCache;
};

export const executeViewedSingleQuestionResponseBootstrap = async ({
  props = {},
  state = {},
  questionId = '',
  responderAddress = '',
  effectiveSingleSlug = '',
  bootstrapRetryAttempt = 0,
  runId = 0,
  isStaleRun = () => false,
  safeSetState = () => {},
  updateSingleQuestionDebug = () => {},
  normalizeViewedResponse = (value: unknown) => value,
  mergeViewedResponse = (_prev: unknown, next: unknown) => next,
  scheduleRetry = () => false,
  clearRetry = () => {},
  getResponse = async () => null,
  getResponseHash = async () => null,
  writeResponseToCache = async () => {},
  readCachedResponderResponse = () => null,
  readFreshCachedResponderResponse = async () => null,
  prefillSingleQuestionResponse = () => {},
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  questionId?: unknown;
  responderAddress?: unknown;
  effectiveSingleSlug?: unknown;
  bootstrapRetryAttempt?: number;
  runId?: number;
  isStaleRun?: () => boolean;
  safeSetState?: SafeSetState;
  updateSingleQuestionDebug?: (payload: Record<string, unknown>) => void;
  normalizeViewedResponse?: (value: unknown) => any;
  mergeViewedResponse?: (prev: unknown, latest: unknown) => unknown;
  scheduleRetry?: (args?: any) => boolean;
  clearRetry?: () => void;
  getResponse?: (args?: any) => Promise<any>;
  getResponseHash?: (args?: any) => Promise<any>;
  writeResponseToCache?: (responder: string, respObj: any) => Promise<unknown>;
  readCachedResponderResponse?: (responder: string) => any;
  readFreshCachedResponderResponse?: (responder: string) => Promise<any>;
  prefillSingleQuestionResponse?: (userAnswer: unknown) => void;
} = {}) => {
  const nextProps = props || {};
  const nextState = state || {};
  const qid = String(questionId || '').toLowerCase();
  const responderLower = String(responderAddress || '').toLowerCase();

  updateSingleQuestionDebug({
    phase: 'responder-fetch-start',
    runId,
    questionId: qid,
    effectiveSingleSlug: String(effectiveSingleSlug || ''),
    responderAddress: responderLower,
    bootstrapRetryAttempt,
  });
  safeSetState({ isLoadingResponse: true, responseLookupWarning: '' });

  let latest: any = null;
  let latestFromCache = false;
  let latestCacheSource = '';
  let responseHash = null;
  let responseFetchFailed = false;
  try {
    latest = await getResponse({
      provider: nextProps.provider,
      responderAddress,
      questionId: qid,
      effectiveSingleSlug,
      forceArweaveFetch: bootstrapRetryAttempt > 0,
    });
  } catch (_) {
    latest = null;
    responseFetchFailed = true;
  }
  if (!latest) {
    const cachedLatest = readCachedResponderResponse(String(responderAddress || ''));
    if (cachedLatest) {
      latest = cachedLatest;
      latestFromCache = true;
      latestCacheSource = 'snapshot';
    }
  }
  if (!latest) {
    const freshCachedLatest = await readFreshCachedResponderResponse(String(responderAddress || ''));
    if (freshCachedLatest) {
      latest = freshCachedLatest;
      latestFromCache = true;
      latestCacheSource = 'persistent';
    }
  }
  if (!latest) {
    try {
      responseHash = await getResponseHash({
        provider: nextProps.provider,
        responderAddress,
        questionId: qid,
        effectiveSingleSlug,
      });
    } catch (_) {
      responseHash = null;
      responseFetchFailed = true;
    }
  }
  if (isStaleRun()) return { applied: false, reason: 'stale' };

  if (latest) {
    const normalizedLatest = normalizeViewedResponse(latest);
    if (!normalizedLatest) {
      clearRetry();
      const malformedWarning = `Response payload for this question could not be rendered for ${responderLower}.`;
      updateSingleQuestionDebug({
        phase: 'responder-malformed-response',
        runId,
        questionId: qid,
        effectiveSingleSlug: String(effectiveSingleSlug || ''),
        responderAddress: responderLower,
        latestFromCache,
      });
      safeSetState({
        viewAddressAnswers: '',
        parsedViewAddressAnswers: null,
        noResponse: true,
        responseLookupWarning: malformedWarning,
        isLoadingResponse: false,
      });
      return { applied: false, reason: 'malformed' };
    }

    latest = normalizedLatest;
    clearRetry();
    if (!latestFromCache) {
      await writeResponseToCache(String(responderAddress || ''), latest);
    }
    updateSingleQuestionDebug({
      phase: 'responder-response-loaded',
      runId,
      questionId: qid,
      effectiveSingleSlug: String(effectiveSingleSlug || ''),
      responderAddress: responderLower,
      latestFromCache,
      latestCacheSource: latestCacheSource || null,
      responseHash: String(latest?.arweaveTxId || responseHash || ''),
    });
    safeSetState((prev) => {
      const merged = mergeViewedResponse((prev || {}).parsedViewAddressAnswers, latest);
      return {
        viewAddressAnswers: JSON.stringify(merged),
        parsedViewAddressAnswers: merged,
        noResponse: false,
        responseLookupWarning: '',
      };
    });
  } else if (responseHash) {
    const didScheduleRetry = scheduleRetry({
      questionId: qid,
      attempt: bootstrapRetryAttempt,
      reason: responseFetchFailed
        ? 'response-payload-fetch-failed'
        : 'response-payload-pending',
    });
    updateSingleQuestionDebug({
      phase: didScheduleRetry
        ? 'responder-hash-no-payload-retrying'
        : 'responder-hash-no-payload-exhausted',
      runId,
      questionId: qid,
      effectiveSingleSlug: String(effectiveSingleSlug || ''),
      responderAddress: responderLower,
      responseHash: String(responseHash || ''),
      responseFetchFailed,
      retryAttempt: bootstrapRetryAttempt,
      didScheduleRetry: !!didScheduleRetry,
    });
    safeSetState({
      viewAddressAnswers: '',
      parsedViewAddressAnswers: null,
      noResponse: false,
      responseLookupWarning: '',
    });
    if (didScheduleRetry) {
      safeSetState({ isLoadingResponse: true });
      return { applied: false, reason: 'retrying' };
    }
    clearRetry();
    safeSetState({
      viewAddressAnswers: '',
      parsedViewAddressAnswers: null,
      noResponse: true,
      responseLookupWarning: '',
    });
  } else {
    clearRetry();
    updateSingleQuestionDebug({
      phase: 'responder-no-response',
      runId,
      questionId: qid,
      effectiveSingleSlug: String(effectiveSingleSlug || ''),
      responderAddress: responderLower,
      responseFetchFailed,
    });
    safeSetState({
      viewAddressAnswers: '',
      parsedViewAddressAnswers: null,
      noResponse: true,
      responseLookupWarning: '',
    });
  }

  const isOwn = !!(
    nextProps.account
    && nextProps.responderAddress
    && String(nextProps.account).toLowerCase() === String(nextProps.responderAddress).toLowerCase()
  );

  if (isOwn && latest && !nextState.startFresh && !nextState.suppressPrefill) {
    const hasEncrypted = hasEncryptedResponseFields(latest);
    safeSetState({
      userHasResponse: true,
      userResponseEncrypted: !!hasEncrypted,
      userAnswers: latest,
    });
    if (isStaleRun()) return { applied: false, reason: 'stale' };
    prefillSingleQuestionResponse(latest);
    if (!hasEncrypted) {
      safeSetState({ displayAnswerMode: false, isEditing: true });
    }
  } else if (isOwn && !latest && !nextState.startFresh) {
    safeSetState({ userHasResponse: false, userResponseEncrypted: false, userAnswers: null });
  }

  updateSingleQuestionDebug({
    phase: 'responder-fetch-complete',
    runId,
    questionId: qid,
    effectiveSingleSlug: String(effectiveSingleSlug || ''),
    responderAddress: responderLower,
    isLoadingResponse: false,
    noResponse: !latest && !responseHash,
  });
  safeSetState({ isLoadingResponse: false });
  return {
    applied: true,
    reason: latest ? 'loaded' : (responseHash ? 'hash-only' : 'no-response'),
    latest,
  };
};

export const executeOwnSingleQuestionResponseBootstrap = async ({
  props = {},
  state = {},
  questionId = '',
  effectiveSingleSlug = '',
  isStaleRun = () => false,
  safeSetState = () => {},
  getResponse = async () => null,
  writeResponseToCache = async () => {},
  areResponsesConsistent = () => false,
  prefillSingleQuestionResponse = () => {},
}: {
  props?: SurveyToolLikeProps | null;
  state?: SurveyToolLikeState | null;
  questionId?: unknown;
  effectiveSingleSlug?: unknown;
  isStaleRun?: () => boolean;
  safeSetState?: SafeSetState;
  getResponse?: (args?: any) => Promise<any>;
  writeResponseToCache?: (responder: string, respObj: any) => Promise<unknown>;
  areResponsesConsistent?: (latest: unknown, surveyIndex: number) => boolean;
  prefillSingleQuestionResponse?: (userAnswer: unknown) => void;
} = {}) => {
  const nextProps = props || {};
  const nextState = state || {};
  safeSetState({ responseLookupWarning: '' });

  if (!nextProps.account) {
    safeSetState({ isLoadingResponse: false });
    return { applied: false, reason: 'no-account' };
  }

  let latest = null;
  try {
    latest = await getResponse({
      provider: nextProps.provider,
      responderAddress: nextProps.account,
      questionId: String(questionId || '').toLowerCase(),
      effectiveSingleSlug,
      forceArweaveFetch: false,
    });
  } catch (_) {
    latest = null;
  }
  if (isStaleRun()) return { applied: false, reason: 'stale' };

  if (nextState.submissionComplete) {
    if (latest && areResponsesConsistent(latest, 0)) {
      const hasEncrypted = hasEncryptedResponseFields(latest);
      safeSetState({
        userHasResponse: true,
        userResponseEncrypted: !!hasEncrypted,
        userAnswers: latest,
        submissionComplete: false,
      });
      void writeResponseToCache(String(nextProps.account || ''), latest);
    }
  } else if (latest && !nextState.startFresh && !nextState.suppressPrefill) {
    const hasEncrypted = hasEncryptedResponseFields(latest);
    safeSetState({
      userHasResponse: true,
      userResponseEncrypted: !!hasEncrypted,
      userAnswers: latest,
    });
    void writeResponseToCache(String(nextProps.account || ''), latest);
    if (!hasEncrypted) {
      if (isStaleRun()) return { applied: false, reason: 'stale' };
      prefillSingleQuestionResponse(latest);
      safeSetState({ displayAnswerMode: false, isEditing: true });
    }
  } else if (!nextState.startFresh && !nextState.submissionComplete) {
    safeSetState({ userHasResponse: false, userResponseEncrypted: false, userAnswers: null });
  }

  safeSetState({ isLoadingResponse: false });
  return {
    applied: true,
    reason: latest ? 'loaded' : 'no-response',
    latest,
  };
};
