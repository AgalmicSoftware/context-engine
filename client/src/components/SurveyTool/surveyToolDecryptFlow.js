import {
  buildSurveyQuestionDecryptExecutionPlan,
  buildSurveyQuestionDecryptRequestPlan,
} from './surveyQuestionDecryptRequestPlan';
import {
  buildClearedQuestionDecryptBusyTokens,
  buildQuestionDecryptBusyTokenRegistration,
  buildQuestionDecryptFailureState,
  buildQuestionDecryptOwnedClearState,
  buildQuestionDecryptStartState,
  clearQuestionFieldBusyMap,
  getQuestionFieldDecryptSelection,
  getQuestionFieldTaskKey,
  getQuestionFieldTaskKeys,
  hasQuestionDecryptBusy,
  markQuestionFieldBusyMap,
  ownsQuestionDecryptBusyTokens,
  runDedupedDecryptTask,
} from './surveyToolDecryptBusyState';
import {
  buildAutoDecryptMaskedFieldSignature,
  buildDecryptTaskKey,
  buildEmptyQuestionDecryptSlice,
  buildFieldDecryptState,
  buildQuestionFieldDecryptControlDisplayState,
  buildQuestionFieldDisplayState,
  buildQuestionRenderDisplayState,
  buildQuestionResponseDisplayState,
  getViewedResponseOverrideForQuestion,
  normalizeSingleQuestionViewedResponse,
  parseEncryptedEnvelope,
  resolveDecryptSurveyId,
  resolveQuestionDecryptHandlingMode,
} from './surveyToolDecryptState';
import { normalizeQuestionIdKey } from './surveyToolSignatures';

export {
  buildAutoDecryptMaskedFieldSignature,
  buildDecryptTaskKey,
  buildEmptyQuestionDecryptSlice,
  buildFieldDecryptState,
  buildQuestionFieldDecryptControlDisplayState,
  buildQuestionFieldDisplayState,
  buildQuestionRenderDisplayState,
  buildQuestionResponseDisplayState,
  getViewedResponseOverrideForQuestion,
  normalizeSingleQuestionViewedResponse,
  parseEncryptedEnvelope,
  resolveDecryptSurveyId,
  resolveQuestionDecryptHandlingMode,
} from './surveyToolDecryptState';

export {
  buildClearedQuestionDecryptBusyTokens,
  buildQuestionDecryptBusyTokenRegistration,
  buildQuestionDecryptFailureState,
  buildQuestionDecryptOwnedClearState,
  buildQuestionDecryptStartState,
  clearQuestionFieldBusyMap,
  getQuestionFieldDecryptSelection,
  getQuestionFieldTaskKey,
  getQuestionFieldTaskKeys,
  hasQuestionDecryptBusy,
  markQuestionFieldBusyMap,
  ownsQuestionDecryptBusyTokens,
  runDedupedDecryptTask,
} from './surveyToolDecryptBusyState';

export const startQuestionDecryptAttemptStatus = ({
  host = null,
  questionId = '',
  fieldToDecrypt = 'both',
  baselineForDecrypt = null,
  prepareQuestionDecryptAttempt = null,
  registerQuestionDecryptBusyTokens = null,
  setState = null,
  buildQuestionDecryptStartState: buildStartState = null,
} = {}) => {
  const preparePort =
    prepareQuestionDecryptAttempt || ((options) => host?.prepareQuestionDecryptAttempt?.(options) || {});
  const registerBusyPort =
    registerQuestionDecryptBusyTokens || ((keys) => host?.registerQuestionDecryptBusyTokens?.(keys));
  const setStatePort = setState || (host?.setState ? host.setState.bind(host) : () => {});
  const buildStartPort =
    buildStartState ||
    ((prev, keys) => host?.buildQuestionDecryptStartState?.(prev, keys) || buildQuestionDecryptStartState(prev, keys));

  const preparedAttempt = preparePort({ questionId, fieldToDecrypt, baselineForDecrypt }) || {};
  if (!preparedAttempt.shouldDecrypt) {
    return { shouldReturn: true, result: false, reason: 'no-masked-field' };
  }

  const decryptSelection = preparedAttempt.decryptSelection || {};
  const keysToMark = decryptSelection.keysToMark || [];
  const decryptAttemptToken = registerBusyPort(keysToMark);
  setStatePort((prev) => buildStartPort(prev, keysToMark));

  return {
    shouldReturn: false,
    result: null,
    reason: 'started',
    decryptAttemptToken,
    decryptSelection,
    keysToMark,
    clearMode: decryptSelection.clearMode,
    chainId: preparedAttempt.chainId,
    lit: preparedAttempt.lit,
    opts: preparedAttempt.opts,
  };
};

export const applyQuestionDecryptCompletionStatus = ({
  host = null,
  context = null,
  questionId = '',
  fieldToDecrypt = 'both',
  decryptAttemptToken = null,
  keysToMark = [],
  setState = null,
  clearQuestionDecryptBusyTokens = null,
  isDecryptContextCurrent = null,
  canUpdateStateForAsyncSnapshot = null,
  ownsQuestionDecryptBusyTokens = null,
  buildQuestionDecryptStaleState = null,
  buildSuccessState = null,
  successStateKind = '',
  successStateOptions = {},
  onSuccessStateApplied,
} = {}) => {
  const setStatePort = setState || (host?.setState ? host.setState.bind(host) : () => {});
  const clearBusyPort =
    clearQuestionDecryptBusyTokens || ((keys, token) => host?.clearQuestionDecryptBusyTokens?.(keys, token));
  const isCurrentPort =
    isDecryptContextCurrent ||
    ((snapshot) => (host?.isDecryptContextCurrent ? host.isDecryptContextCurrent(snapshot) : true));
  const canUpdatePort =
    canUpdateStateForAsyncSnapshot ||
    ((snapshot) => (host?.canUpdateStateForAsyncSnapshot ? host.canUpdateStateForAsyncSnapshot(snapshot) : false));
  const ownsBusyPort =
    ownsQuestionDecryptBusyTokens ||
    ((keys, token) => (host?.ownsQuestionDecryptBusyTokens ? host.ownsQuestionDecryptBusyTokens(keys, token) : true));
  const buildStalePort =
    buildQuestionDecryptStaleState ||
    ((prev, targetQid, targetField, token) =>
      host?.buildQuestionDecryptStaleState?.(prev, targetQid, targetField, token) || null);
  const buildSuccessPort =
    buildSuccessState ||
    ((prev) => {
      if (successStateKind === 'viewed') {
        return host?.buildViewedResponseDecryptSuccessState?.(prev, successStateOptions) || null;
      }
      if (successStateKind === 'self') {
        return host?.buildSelfQuestionDecryptSuccessState?.(prev, successStateOptions) || null;
      }
      return null;
    });

  if (!isCurrentPort(context)) {
    if (canUpdatePort(context)) {
      setStatePort((prev) => buildStalePort(prev, questionId, fieldToDecrypt, decryptAttemptToken));
    }
    return { shouldReturn: true, result: false, reason: 'stale-context' };
  }

  if (!ownsBusyPort(keysToMark, decryptAttemptToken)) {
    setStatePort((prev) => buildStalePort(prev, questionId, fieldToDecrypt, decryptAttemptToken));
    return { shouldReturn: true, result: false, reason: 'stale-busy-token' };
  }

  clearBusyPort(keysToMark, decryptAttemptToken);
  setStatePort((prev) => buildSuccessPort(prev), onSuccessStateApplied);
  return { shouldReturn: false, result: null, reason: 'applied' };
};

export const applyQuestionDecryptFailureStatus = ({
  host = null,
  context = null,
  questionId = '',
  fieldToDecrypt = 'both',
  decryptAttemptToken = null,
  error = null,
  setState = null,
  isDecryptContextCurrent = null,
  canUpdateStateForAsyncSnapshot = null,
  buildQuestionDecryptStaleState = null,
  buildQuestionDecryptFailureStateForAttempt = null,
} = {}) => {
  const setStatePort = setState || (host?.setState ? host.setState.bind(host) : () => {});
  const isCurrentPort =
    isDecryptContextCurrent ||
    ((snapshot) => (host?.isDecryptContextCurrent ? host.isDecryptContextCurrent(snapshot) : true));
  const canUpdatePort =
    canUpdateStateForAsyncSnapshot ||
    ((snapshot) => (host?.canUpdateStateForAsyncSnapshot ? host.canUpdateStateForAsyncSnapshot(snapshot) : false));
  const buildStalePort =
    buildQuestionDecryptStaleState ||
    ((prev, targetQid, targetField, token) =>
      host?.buildQuestionDecryptStaleState?.(prev, targetQid, targetField, token) || null);
  const buildFailurePort =
    buildQuestionDecryptFailureStateForAttempt ||
    ((prev, targetQid, targetField, message, token) =>
      host?.buildQuestionDecryptFailureStateForAttempt?.(prev, targetQid, targetField, message, token) || null);

  if (!isCurrentPort(context)) {
    if (decryptAttemptToken != null && canUpdatePort(context)) {
      setStatePort((prev) => buildStalePort(prev, questionId, fieldToDecrypt, decryptAttemptToken));
    }
    return false;
  }

  setStatePort((prev) => buildFailurePort(prev, questionId, fieldToDecrypt, error?.message, decryptAttemptToken));
  return false;
};

export const decryptQuestionRatingEnvelopes = async (
  ratingEnvelopes = null,
  { chainId, lit, account, providerLike } = {},
  { decryptEnvelopeValue, logWarn = () => {} } = {},
) => {
  let decryptedImportance = null;
  let decryptedConviction = null;
  try {
    const toNum = (value) => {
      if (value === undefined || value === null) return null;
      const next = Number(value);
      return Number.isNaN(next) ? null : next;
    };

    const litOpts = lit ? lit : undefined;
    if (ratingEnvelopes?.importanceEncrypted) {
      try {
        const value = await decryptEnvelopeValue(ratingEnvelopes.importanceEncrypted, {
          account,
          chainId,
          providerLike,
          ...(litOpts ? { litOpts } : {}),
        });
        decryptedImportance = toNum(value);
      } catch (error) {
        logWarn(error);
      }
    }
    if (ratingEnvelopes?.convictionEncrypted) {
      try {
        const value = await decryptEnvelopeValue(ratingEnvelopes.convictionEncrypted, {
          account,
          chainId,
          providerLike,
          ...(litOpts ? { litOpts } : {}),
        });
        decryptedConviction = toNum(value);
      } catch (error) {
        logWarn(error);
      }
    }
  } catch (error) {
    logWarn(error);
  }

  return { decryptedImportance, decryptedConviction };
};

export const decryptQuestionRatingEnvelopeMap = async (
  ratingEnvelopesByQid = {},
  { chainId, lit, account, providerLike } = {},
  { decryptEnvelopeValue, logWarn = () => {} } = {},
) => {
  const decryptedImportanceFromEnv = {};
  const decryptedConvictionFromEnv = {};
  try {
    const litOpts = lit ? lit : undefined;
    const toNum = (value) => {
      if (value === undefined || value === null) return null;
      const next = Number(value);
      return Number.isNaN(next) ? null : next;
    };
    const qids = Object.keys(ratingEnvelopesByQid || {});
    for (const questionId of qids) {
      const envs = ratingEnvelopesByQid[questionId] || {};
      if (envs.importanceEncrypted) {
        try {
          const value = await decryptEnvelopeValue(envs.importanceEncrypted, {
            account,
            chainId,
            providerLike,
            ...(litOpts ? { litOpts } : {}),
          });
          const next = toNum(value);
          if (next !== null) decryptedImportanceFromEnv[questionId] = next;
        } catch (error) {
          logWarn(error);
        }
      }
      if (envs.convictionEncrypted) {
        try {
          const value = await decryptEnvelopeValue(envs.convictionEncrypted, {
            account,
            chainId,
            providerLike,
            ...(litOpts ? { litOpts } : {}),
          });
          const next = toNum(value);
          if (next !== null) decryptedConvictionFromEnv[questionId] = next;
        } catch (error) {
          logWarn(error);
        }
      }
    }
  } catch (error) {
    logWarn(error);
  }

  return {
    decryptedImportanceFromEnv,
    decryptedConvictionFromEnv,
  };
};

export const collectQuestionRatingEnvelopesByQid = (source = null) => {
  const ratingEnvelopesByQid = {};
  try {
    const addFromResponseObject = (responseObject) => {
      if (!responseObject || typeof responseObject !== 'object') return;
      const questionId = String(
        responseObject?.questionID || responseObject?.questionId || responseObject?.questionIDHash || '',
      )
        .trim()
        .toLowerCase();
      if (!questionId) return;
      const importanceEncrypted =
        typeof responseObject?.importanceEncrypted === 'string' ? responseObject.importanceEncrypted : '';
      const convictionEncrypted =
        typeof responseObject?.convictionEncrypted === 'string' ? responseObject.convictionEncrypted : '';
      if (!importanceEncrypted && !convictionEncrypted) return;
      ratingEnvelopesByQid[questionId] = {
        importanceEncrypted,
        convictionEncrypted,
      };
    };

    if (source && typeof source === 'object') {
      if (Array.isArray(source.responses)) {
        source.responses.forEach(addFromResponseObject);
      } else {
        addFromResponseObject(source);
      }
    }
  } catch (_) {
    return {};
  }

  return ratingEnvelopesByQid;
};

export const carryForwardSurveyQuestionRatings = (sourceSlice = null, previousStateSlice = null) => {
  const nextSourceSlice = ensureQuestionDecryptSliceShape(sourceSlice);
  Object.keys(previousStateSlice?.importance || {}).forEach((questionId) => {
    if (nextSourceSlice.importance[questionId] === undefined || nextSourceSlice.importance[questionId] === null) {
      nextSourceSlice.importance[questionId] = previousStateSlice.importance[questionId];
    }
  });
  Object.keys(previousStateSlice?.conviction || {}).forEach((questionId) => {
    if (nextSourceSlice.conviction[questionId] === undefined || nextSourceSlice.conviction[questionId] === null) {
      nextSourceSlice.conviction[questionId] = previousStateSlice.conviction[questionId];
    }
  });
  return nextSourceSlice;
};

export const buildSurveyDecryptSourceState = (
  latestResponse = null,
  fallbackSourceSlice = null,
  previousStateSlice = null,
  buildSliceFromUserAnswers = (value) => value,
) => {
  const baseSourceSlice = latestResponse
    ? buildSliceFromUserAnswers(latestResponse)
    : ensureQuestionDecryptSliceShape(fallbackSourceSlice || buildEmptyQuestionDecryptSlice());

  return {
    sourceSlice: carryForwardSurveyQuestionRatings(baseSourceSlice, previousStateSlice),
    ratingEnvelopesByQid: collectQuestionRatingEnvelopesByQid(latestResponse),
  };
};

export const buildSurveyDecryptAttemptSourceInputs = ({
  decryptContext = null,
  state = null,
  getEffectiveDraftSlug = null,
} = {}) => {
  const surveyIndex = decryptContext?.surveyIndex || 0;
  const fallbackSourceSlice = state?.surveysResponseState?.[surveyIndex] || buildEmptyQuestionDecryptSlice();

  return {
    surveyIndex,
    slug: decryptContext?.sessionSlug || (typeof getEffectiveDraftSlug === 'function' ? getEffectiveDraftSlug() : ''),
    fallbackUserAnswers: state?.userAnswers,
    fallbackSourceSlice,
    previousStateSlice: state?.surveysResponseState?.[surveyIndex] || {},
  };
};

export const applySurveyDecryptStaleStatus = ({
  host = null,
  context = null,
  attemptId = null,
  isDecryptContextCurrent = null,
  canUpdateSurveyDecryptAttempt = null,
  finishSurveyDecryptAttempt = null,
  setSurveyDecryptStaleState = null,
  buildSurveyDecryptStaleState = null,
} = {}) => {
  const isCurrentPort =
    typeof isDecryptContextCurrent === 'function'
      ? isDecryptContextCurrent
      : (snapshot) => (host?.isDecryptContextCurrent ? host.isDecryptContextCurrent(snapshot) : true);

  if (isCurrentPort(context)) {
    return { shouldReturn: false, reason: 'current-context' };
  }

  const canUpdatePort =
    typeof canUpdateSurveyDecryptAttempt === 'function'
      ? canUpdateSurveyDecryptAttempt
      : (snapshot, targetAttemptId) =>
          host?.canUpdateSurveyDecryptAttempt ? host.canUpdateSurveyDecryptAttempt(snapshot, targetAttemptId) : false;

  if (canUpdatePort(context, attemptId)) {
    const finishPort = finishSurveyDecryptAttempt || host?.finishSurveyDecryptAttempt;
    if (typeof finishPort === 'function') {
      finishPort(attemptId);
    }
    const setStalePort = setSurveyDecryptStaleState || (host?.setState ? host.setState.bind(host) : null);
    if (typeof setStalePort === 'function') {
      const buildStalePort = buildSurveyDecryptStaleState || host?.buildSurveyDecryptStaleState;
      const stalePatch = typeof buildStalePort === 'function' ? buildStalePort() : { isDecrypting: false };
      setStalePort(stalePatch);
    }
    return { shouldReturn: true, reason: 'stale-context-applied' };
  }

  return { shouldReturn: true, reason: 'stale-context-skipped' };
};

export const hydrateLatestQuestionDecryptState = async (
  {
    questionId,
    fieldToDecrypt = 'both',
    baselineForDecrypt,
    initialRatingEnvelopes = null,
    account = '',
    responderForLatest = '',
    sessionSlug = '',
    networkID = '',
  } = {},
  {
    getQuestionFieldDecryptSelection,
    readQuestionsCache,
    getLatestQuestionResponse,
    mergeLatestEncryptedQuestionFields,
    mergeQuestionRatingEnvelopeState = (previousState) => previousState,
    logWarn = () => {},
  } = {},
) => {
  let nextBaselineForDecrypt = baselineForDecrypt;
  let nextRatingEnvelopes = initialRatingEnvelopes;

  try {
    const hydrateSelection = getQuestionFieldDecryptSelection(questionId, fieldToDecrypt, nextBaselineForDecrypt);
    const { maskedAnswer: maskedAnswerForHydrate, maskedAdditional: maskedAdditionalForHydrate } = hydrateSelection;

    if ((maskedAnswerForHydrate || maskedAdditionalForHydrate) && account && networkID) {
      const questionsCache = readQuestionsCache(sessionSlug) || {};
      const fetchQuestionId = String(questionId || '').toLowerCase();
      const latest = await getLatestQuestionResponse(
        responderForLatest || account,
        fetchQuestionId,
        networkID,
        questionsCache,
      );

      if (latest) {
        nextRatingEnvelopes = mergeQuestionRatingEnvelopeState(nextRatingEnvelopes, latest, questionId);
        nextBaselineForDecrypt = mergeLatestEncryptedQuestionFields(nextBaselineForDecrypt, questionId, latest, {
          includeAnswer: maskedAnswerForHydrate,
          includeAdditional: maskedAdditionalForHydrate,
        });
      }
    }
  } catch (error) {
    logWarn(error);
  }

  return {
    baselineForDecrypt: nextBaselineForDecrypt,
    ratingEnvelopes: nextRatingEnvelopes,
  };
};

export const prepareViewedQuestionDecryptState = async (
  {
    questionId,
    fieldToDecrypt = 'both',
    responseOverride = null,
    account = '',
    responderForLatest = '',
    sessionSlug = '',
    networkID = '',
  } = {},
  { buildViewedResponseDecryptBaseline, hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptStateFn } = {},
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  let baselineForDecrypt = buildViewedResponseDecryptBaseline(responseOverride, qid);
  let ratingEnvelopes = {
    importanceEncrypted:
      typeof responseOverride?.importanceEncrypted === 'string' ? responseOverride.importanceEncrypted : '',
    convictionEncrypted:
      typeof responseOverride?.convictionEncrypted === 'string' ? responseOverride.convictionEncrypted : '',
  };

  if (qid && responseOverride && typeof responseOverride === 'object') {
    const hydrated = await hydrateLatestQuestionDecryptStateFn({
      questionId: qid,
      fieldToDecrypt,
      baselineForDecrypt,
      initialRatingEnvelopes: ratingEnvelopes,
      account,
      responderForLatest,
      sessionSlug,
      networkID,
    });
    baselineForDecrypt = hydrated.baselineForDecrypt;
    ratingEnvelopes = hydrated.ratingEnvelopes;
  }

  return {
    questionId: qid,
    baselineForDecrypt,
    ratingEnvelopes,
  };
};

export const prepareSelfQuestionDecryptState = async (
  {
    surveyIndex = 0,
    questionId,
    fieldToDecrypt = 'both',
    responseOverride = null,
    userAnswers = null,
    account = '',
    sessionSlug = '',
    networkID = '',
  } = {},
  {
    buildSelfQuestionDecryptBaseline,
    mergeQuestionResponseOverrideIntoDecryptSlice,
    mergeQuestionRatingEnvelopeState,
    hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptStateFn,
    logWarn = () => {},
  } = {},
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  let { baselineSlice, baselineForDecrypt } = buildSelfQuestionDecryptBaseline(surveyIndex);

  if (responseOverride && typeof responseOverride === 'object') {
    try {
      baselineForDecrypt = mergeQuestionResponseOverrideIntoDecryptSlice(baselineForDecrypt, qid, responseOverride);
    } catch (error) {
      logWarn(error);
    }
  }

  let ratingEnvelopes = mergeQuestionRatingEnvelopeState(null, responseOverride, qid);
  ratingEnvelopes = mergeQuestionRatingEnvelopeState(ratingEnvelopes, userAnswers, qid);

  const hydrated = await hydrateLatestQuestionDecryptStateFn({
    questionId: qid,
    fieldToDecrypt,
    baselineForDecrypt,
    initialRatingEnvelopes: ratingEnvelopes,
    account,
    responderForLatest: account,
    sessionSlug,
    networkID,
  });

  baselineForDecrypt = hydrated.baselineForDecrypt;
  ratingEnvelopes = hydrated.ratingEnvelopes;

  return {
    questionId: qid,
    baselineSlice,
    baselineForDecrypt,
    ratingEnvelopes,
  };
};

export const resolveLatestSurveyDecryptResponse = async (
  {
    singleQuestionMode = false,
    questionId = '',
    account = '',
    providerLike = null,
    slug = '',
    surveyId = '',
    fallbackUserAnswers = null,
  } = {},
  { getLatestQuestionResponse, getLatestSurveyResponse } = {},
) => {
  let latest = null;

  if (singleQuestionMode) {
    const qid = String(questionId || '')
      .trim()
      .toLowerCase();
    latest = qid && account ? await getLatestQuestionResponse(providerLike, account, qid, slug) : null;
  } else {
    latest = account ? await getLatestSurveyResponse(account, surveyId) : null;
  }

  return latest || fallbackUserAnswers || null;
};

export const prepareSurveyDecryptAttempt = async (
  {
    singleQuestionMode = false,
    questionId = '',
    account = '',
    providerLike = null,
    slug = '',
    surveyId = '',
    fallbackUserAnswers = null,
    fallbackSourceSlice = null,
    previousStateSlice = null,
  } = {},
  { resolveLatestSurveyDecryptResponse, buildSurveyDecryptSourceState, buildSurveyDecryptExecutionContext } = {},
) => {
  const latest = await resolveLatestSurveyDecryptResponse({
    singleQuestionMode,
    questionId,
    account,
    providerLike,
    slug,
    surveyId,
    fallbackUserAnswers,
  });

  const { sourceSlice, ratingEnvelopesByQid } = buildSurveyDecryptSourceState(
    latest,
    fallbackSourceSlice,
    previousStateSlice,
  );

  const { chainId, lit, opts, poolForDecrypt } = buildSurveyDecryptExecutionContext(sourceSlice, questionId);

  return {
    latest,
    sourceSlice,
    ratingEnvelopesByQid,
    chainId,
    lit,
    opts,
    poolForDecrypt,
  };
};

export const finalizeSurveyDecryptAttempt = async (
  {
    sourceSlice,
    ratingEnvelopesByQid = {},
    account = '',
    providerLike = null,
    chainId,
    lit,
    poolForDecrypt = [],
    opts,
    previousStateSlice = null,
  } = {},
  { decryptMultipleAnswers, decryptQuestionRatingEnvelopeMap, normalizeBulkDecryptedSliceForSurveyState } = {},
) => {
  const decryptedSlice = await decryptMultipleAnswers(sourceSlice, poolForDecrypt, opts);

  const { decryptedImportanceFromEnv, decryptedConvictionFromEnv } = await decryptQuestionRatingEnvelopeMap(
    ratingEnvelopesByQid,
    {
      account,
      chainId,
      lit,
      providerLike,
    },
  );

  const normalizedDecryptedSlice = normalizeBulkDecryptedSliceForSurveyState(decryptedSlice, {
    previousStateSlice,
    baselineSlice: sourceSlice,
  });

  return {
    normalizedDecryptedSlice,
    decryptedImportanceFromEnv,
    decryptedConvictionFromEnv,
  };
};

export const buildQuestionDecryptExecutionContext = ({
  baselineForDecrypt,
  questionId,
  provider,
  account,
  network,
  questionPool,
  pileQuestions,
  litHooks,
  hasher,
  resolveDecryptSurveyId,
  getProviderKind,
} = {}) => {
  const providerKind = getProviderKind(provider);
  const chainId = network?.id;
  const surveyId = resolveDecryptSurveyId(baselineForDecrypt, questionId);
  const resolvedQuestionPool =
    Array.isArray(questionPool) && questionPool.length > 0
      ? questionPool
      : Array.isArray(pileQuestions)
        ? pileQuestions
        : [];
  const executionPlan = buildSurveyQuestionDecryptExecutionPlan({
    account,
    chainId,
    hasher,
    litHooks,
    provider,
    providerKind,
    questionId,
    questionPool: resolvedQuestionPool,
    surveyId,
  });

  return {
    ...executionPlan,
  };
};

export const buildSurveyDecryptExecutionContext = ({
  sourceSlice,
  questionId = null,
  provider,
  account,
  network,
  questionPool,
  pileQuestions,
  litHooks,
  hasher,
  resolveDecryptSurveyId,
  getProviderKind,
} = {}) => {
  const providerKind = getProviderKind(provider);
  const chainId = network?.id;
  const surveyId = resolveDecryptSurveyId(sourceSlice, questionId);
  const poolForDecrypt =
    Array.isArray(questionPool) && questionPool.length > 0
      ? questionPool
      : Array.isArray(pileQuestions)
        ? pileQuestions
        : [];
  const lit = litHooks && litHooks.getKey ? { getKey: litHooks.getKey } : undefined;

  return {
    providerKind,
    chainId,
    surveyId,
    poolForDecrypt,
    lit,
    opts: {
      providerKind,
      provider,
      account,
      chainId,
      surveyId,
      ...(lit ? { lit } : {}),
      hasher,
      throwOnError: true,
    },
  };
};

export const prepareQuestionDecryptAttempt = (
  { questionId, fieldToDecrypt = 'both', baselineForDecrypt } = {},
  { getQuestionFieldDecryptSelection, buildQuestionDecryptExecutionContext } = {},
) => {
  const decryptSelection = getQuestionFieldDecryptSelection(questionId, fieldToDecrypt, baselineForDecrypt);

  if (!decryptSelection.hasMaskedField) {
    return {
      blockedReason: 'no-masked-field',
      shouldDecrypt: false,
      decryptSelection,
    };
  }

  const { chainId, lit, opts, target } = buildQuestionDecryptExecutionContext(baselineForDecrypt, questionId);
  const requestPlan = buildSurveyQuestionDecryptRequestPlan({
    account: opts?.account,
    baselineForDecrypt,
    chainId,
    decryptSelection,
    fieldToDecrypt,
    hasher: opts?.hasher,
    litHooks: lit,
    provider: opts?.provider,
    providerKind: opts?.providerKind,
    questionId,
    questionPool: opts?.questionPool,
    surveyId: opts?.surveyId,
  });
  const decryptRequest = requestPlan.decryptRequest
    ? { ...requestPlan.decryptRequest, options: opts || requestPlan.decryptRequest.options }
    : null;

  return {
    blockedReason: requestPlan.blockedReason,
    shouldDecrypt: requestPlan.shouldDecrypt,
    decryptSelection: requestPlan.decryptSelection,
    chainId: requestPlan.chainId,
    decryptRequest,
    lit,
    opts,
    target: requestPlan.target || target,
  };
};

export const finalizeQuestionDecryptAttempt = async (
  {
    questionId,
    fieldToDecrypt = 'both',
    baselineForDecrypt,
    ratingEnvelopes = null,
    account = '',
    providerLike = null,
    chainId,
    lit,
    opts,
  } = {},
  { decryptSingleField, decryptQuestionRatingEnvelopes } = {},
) => {
  const qid = normalizeQuestionIdKey(questionId);
  const decryptedStateSlice = await decryptSingleField(baselineForDecrypt, qid, fieldToDecrypt, opts);

  const producedAnswer = !!(decryptedStateSlice.answers && decryptedStateSlice.answers[qid]);
  const producedAdditional = !!(decryptedStateSlice.additionalComments && decryptedStateSlice.additionalComments[qid]);
  const didUpdate = producedAnswer || producedAdditional;

  const { decryptedImportance, decryptedConviction } = await decryptQuestionRatingEnvelopes(ratingEnvelopes, {
    account,
    chainId,
    lit,
    providerLike,
  });

  return {
    decryptedStateSlice,
    didUpdate,
    decryptedImportance,
    decryptedConviction,
  };
};

export const ensureQuestionDecryptSliceShape = (responseSlice) => {
  const base = responseSlice && typeof responseSlice === 'object' ? responseSlice : buildEmptyQuestionDecryptSlice();

  return {
    ...base,
    answers: { ...(base.answers || {}) },
    importance: { ...(base.importance || {}) },
    conviction: { ...(base.conviction || {}) },
    additionalComments: { ...(base.additionalComments || {}) },
  };
};

export const applyDecryptedQuestionResponseValues = (
  responseRecord,
  { questionId, decryptedStateSlice, decryptedImportance = null, decryptedConviction = null } = {},
) => {
  if (!responseRecord || typeof responseRecord !== 'object') return responseRecord;
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const next = { ...responseRecord };
  let changed = false;

  if (qid && decryptedStateSlice?.answers?.[qid]) {
    const nextValue = decryptedStateSlice.answers[qid]?.value;
    next.answer = {
      ...(next.answer || {}),
      value: nextValue,
    };
    changed = changed || responseRecord.answer?.value !== nextValue;
  }
  if (qid && decryptedStateSlice?.additionalComments?.[qid]) {
    const nextValue = decryptedStateSlice.additionalComments[qid]?.value;
    next.additional = {
      ...(next.additional || {}),
      value: nextValue,
    };
    changed = changed || responseRecord.additional?.value !== nextValue;
  }
  if (decryptedImportance !== null && decryptedImportance !== undefined) {
    next.importance = decryptedImportance;
    changed = changed || responseRecord.importance !== decryptedImportance;
  }
  if (decryptedConviction !== null && decryptedConviction !== undefined) {
    next.conviction = decryptedConviction;
    changed = changed || responseRecord.conviction !== decryptedConviction;
  }

  return changed ? next : responseRecord;
};

export const applyDecryptedQuestionResponseValuesToContainer = (viewedResponseContainer, options = {}) => {
  if (!viewedResponseContainer || typeof viewedResponseContainer !== 'object') {
    return viewedResponseContainer;
  }

  if (Array.isArray(viewedResponseContainer.responses)) {
    const qid = String(options?.questionId || '')
      .trim()
      .toLowerCase();
    let changed = false;
    const nextResponses = viewedResponseContainer.responses.map((responseRecord) => {
      const rid = String(responseRecord?.questionID || responseRecord?.questionId || '')
        .trim()
        .toLowerCase();
      if (qid && rid !== qid) return responseRecord;
      const nextResponseRecord = applyDecryptedQuestionResponseValues(responseRecord, options);
      changed = changed || nextResponseRecord !== responseRecord;
      return nextResponseRecord;
    });
    return changed ? { ...viewedResponseContainer, responses: nextResponses } : viewedResponseContainer;
  }

  return applyDecryptedQuestionResponseValues(viewedResponseContainer, options);
};

export const buildViewedResponseDecryptSuccessState = (
  prevState,
  {
    questionId,
    clearMode = 'both',
    didUpdate = false,
    decryptedStateSlice,
    decryptedImportance = null,
    decryptedConviction = null,
  } = {},
) => {
  const nextViewed = applyDecryptedQuestionResponseValuesToContainer(prevState?.parsedViewAddressAnswers, {
    questionId,
    decryptedStateSlice,
    decryptedImportance,
    decryptedConviction,
  });

  const viewAddressAnswers =
    nextViewed && nextViewed !== prevState?.parsedViewAddressAnswers
      ? JSON.stringify(nextViewed)
      : prevState?.viewAddressAnswers;

  return {
    parsedViewAddressAnswers: nextViewed,
    viewAddressAnswers,
    isDecrypting: false,
    decryptingByKey: clearQuestionFieldBusyMap(prevState?.decryptingByKey, questionId, clearMode),
    ...(didUpdate ? {} : { submissionError: 'Decryption failed.' }),
  };
};

export const applyDecryptedQuestionStateToSurveySlice = (
  targetStateSlice,
  {
    questionId,
    decryptedStateSlice,
    baselineSlice = null,
    decryptedImportance = null,
    decryptedConviction = null,
  } = {},
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid) return targetStateSlice;

  const nextTargetStateSlice = {
    ...(targetStateSlice || {}),
  };

  if (decryptedStateSlice?.answers?.[qid]) {
    const prevEncrypted = nextTargetStateSlice.answers?.[qid]?.encrypted;
    const incoming = decryptedStateSlice.answers[qid];
    nextTargetStateSlice.answers = { ...(nextTargetStateSlice.answers || {}) };
    nextTargetStateSlice.answers[qid] = {
      ...(nextTargetStateSlice.answers[qid] || {}),
      value: incoming.value,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(
              baselineSlice?.answers?.[qid]?.value === '*' &&
              (baselineSlice?.answers?.[qid]?.encryptedPortion || baselineSlice?.answers?.[qid]?.encrypted)
            ),
      ...(incoming.zkSalt ? { zkSalt: incoming.zkSalt } : {}),
    };
  }

  if (decryptedStateSlice?.additionalComments?.[qid]) {
    const prevEncrypted = nextTargetStateSlice.additionalComments?.[qid]?.encrypted;
    const incoming = decryptedStateSlice.additionalComments[qid];
    nextTargetStateSlice.additionalComments = {
      ...(nextTargetStateSlice.additionalComments || {}),
    };
    nextTargetStateSlice.additionalComments[qid] = {
      ...(nextTargetStateSlice.additionalComments[qid] || {}),
      value: incoming.value,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(
              baselineSlice?.additionalComments?.[qid]?.value === '*' &&
              (baselineSlice?.additionalComments?.[qid]?.encryptedPortion ||
                baselineSlice?.additionalComments?.[qid]?.encrypted)
            ),
      ...(incoming.zkSalt ? { zkSalt: incoming.zkSalt } : {}),
    };
  }

  if (decryptedImportance !== null && decryptedImportance !== undefined) {
    nextTargetStateSlice.importance = nextTargetStateSlice.importance || {};
    nextTargetStateSlice.importance[qid] = decryptedImportance;
  }
  if (decryptedConviction !== null && decryptedConviction !== undefined) {
    nextTargetStateSlice.conviction = nextTargetStateSlice.conviction || {};
    nextTargetStateSlice.conviction[qid] = decryptedConviction;
  }

  return nextTargetStateSlice;
};

export const buildSelfQuestionDecryptSuccessState = (
  prevState,
  {
    surveyIndex = 0,
    questionId,
    clearMode = 'both',
    didUpdate = false,
    baselineSlice = null,
    decryptedStateSlice,
    decryptedImportance = null,
    decryptedConviction = null,
  } = {},
  deepClone = (value) => value,
) => {
  const surveysResponseStateCopy = [...(prevState?.surveysResponseState || [])];
  const targetStateSlice = applyDecryptedQuestionStateToSurveySlice(
    surveysResponseStateCopy[surveyIndex] || buildEmptyQuestionDecryptSlice(),
    {
      questionId,
      decryptedStateSlice,
      baselineSlice,
      decryptedImportance,
      decryptedConviction,
    },
  );

  surveysResponseStateCopy[surveyIndex] = targetStateSlice;

  return {
    surveysResponseState: surveysResponseStateCopy,
    isEditing: true,
    displayAnswerMode: false,
    isDecrypting: false,
    suppressPrefill: true,
    decryptingByKey: clearQuestionFieldBusyMap(prevState?.decryptingByKey, questionId, clearMode),
    editBaseline: syncDecryptedQuestionIntoBaseline(
      prevState?.editBaseline,
      baselineSlice,
      targetStateSlice,
      {
        questionId,
        decryptedStateSlice,
        decryptedImportance,
        decryptedConviction,
      },
      deepClone,
    ),
    ...(didUpdate ? {} : { submissionError: 'Decryption failed.' }),
  };
};

export const buildSurveyDecryptSuccessState = (
  prevState,
  { surveyIndex = 0, decryptedSlice = {}, decryptedImportanceFromEnv = {}, decryptedConvictionFromEnv = {} } = {},
  deepClone = (value) => value,
) => {
  const surveysResponseStateCopy = [...(prevState?.surveysResponseState || [])];
  const nextSlice = {
    answers: {
      ...(prevState?.surveysResponseState?.[surveyIndex]?.answers || {}),
      ...(decryptedSlice.answers || {}),
    },
    importance: {
      ...(prevState?.surveysResponseState?.[surveyIndex]?.importance || {}),
      ...(decryptedSlice.importance || {}),
      ...(decryptedImportanceFromEnv || {}),
    },
    conviction: {
      ...(prevState?.surveysResponseState?.[surveyIndex]?.conviction || {}),
      ...(decryptedConvictionFromEnv || {}),
    },
    additionalComments: {
      ...(prevState?.surveysResponseState?.[surveyIndex]?.additionalComments || {}),
      ...(decryptedSlice.additionalComments || {}),
    },
  };

  Object.keys(decryptedSlice.answers || {}).forEach((questionId) => {
    const state = decryptedSlice.answers[questionId];
    if (state && state.zkSalt) {
      nextSlice.answers[questionId] = {
        ...(nextSlice.answers[questionId] || {}),
        zkSalt: state.zkSalt,
      };
    }
  });
  Object.keys(decryptedSlice.additionalComments || {}).forEach((questionId) => {
    const state = decryptedSlice.additionalComments[questionId];
    if (state && state.zkSalt) {
      nextSlice.additionalComments[questionId] = {
        ...(nextSlice.additionalComments[questionId] || {}),
        zkSalt: state.zkSalt,
      };
    }
  });

  surveysResponseStateCopy[surveyIndex] = nextSlice;

  return {
    surveysResponseState: surveysResponseStateCopy,
    startFresh: false,
    displayAnswerMode: false,
    isEditing: true,
    isDecrypting: false,
    suppressPrefill: true,
    editBaseline: deepClone(nextSlice),
    isDirty: false,
    modifiedCount: 0,
  };
};

export const normalizeBulkDecryptedSliceForSurveyState = (
  decryptedSlice = {},
  { previousStateSlice = null, baselineSlice = null } = {},
) => {
  const nextDecryptedSlice = {
    ...(decryptedSlice || {}),
    answers: { ...(decryptedSlice?.answers || {}) },
    additionalComments: { ...(decryptedSlice?.additionalComments || {}) },
  };

  Object.keys(nextDecryptedSlice.answers || {}).forEach((questionId) => {
    const nextAnswer = nextDecryptedSlice.answers[questionId] || {};
    const prevEncrypted = previousStateSlice?.answers?.[questionId]?.encrypted;
    nextDecryptedSlice.answers[questionId] = {
      ...nextAnswer,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(
              baselineSlice?.answers?.[questionId]?.value === '*' &&
              (baselineSlice?.answers?.[questionId]?.encryptedPortion ||
                baselineSlice?.answers?.[questionId]?.encrypted)
            ),
    };
  });

  Object.keys(nextDecryptedSlice.additionalComments || {}).forEach((questionId) => {
    const nextAdditional = nextDecryptedSlice.additionalComments[questionId] || {};
    const prevEncrypted = previousStateSlice?.additionalComments?.[questionId]?.encrypted;
    nextDecryptedSlice.additionalComments[questionId] = {
      ...nextAdditional,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(
              baselineSlice?.additionalComments?.[questionId]?.value === '*' &&
              (baselineSlice?.additionalComments?.[questionId]?.encryptedPortion ||
                baselineSlice?.additionalComments?.[questionId]?.encrypted)
            ),
    };
  });

  return nextDecryptedSlice;
};

export const syncDecryptedQuestionIntoBaseline = (
  editBaseline,
  fallbackBaseline,
  nextTargetStateSlice,
  { questionId, decryptedStateSlice, decryptedImportance = null, decryptedConviction = null } = {},
  deepClone = (value) => value,
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  let nextBaseline = editBaseline
    ? deepClone(editBaseline)
    : deepClone(fallbackBaseline || buildEmptyQuestionDecryptSlice());

  if (!qid) return nextBaseline;

  if (!nextBaseline.answers) nextBaseline.answers = {};
  if (!nextBaseline.additionalComments) nextBaseline.additionalComments = {};

  if (decryptedStateSlice?.answers?.[qid]) {
    nextBaseline.answers[qid] = deepClone(nextTargetStateSlice.answers?.[qid]);
  }
  if (decryptedStateSlice?.additionalComments?.[qid]) {
    nextBaseline.additionalComments[qid] = deepClone(nextTargetStateSlice.additionalComments?.[qid]);
  }
  if (decryptedImportance !== null && decryptedImportance !== undefined) {
    nextBaseline.importance = nextBaseline.importance || {};
    nextBaseline.importance[qid] = decryptedImportance;
  }
  if (decryptedConviction !== null && decryptedConviction !== undefined) {
    nextBaseline.conviction = nextBaseline.conviction || {};
    nextBaseline.conviction[qid] = decryptedConviction;
  }

  return nextBaseline;
};

export const mergeLatestEncryptedQuestionFields = (
  responseSlice,
  questionId,
  latestResponse,
  { includeAnswer = false, includeAdditional = false } = {},
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid || !latestResponse || typeof latestResponse !== 'object') return responseSlice;

  let nextResponseSlice =
    responseSlice && typeof responseSlice === 'object' ? { ...responseSlice } : { answers: {}, additionalComments: {} };

  if (includeAnswer && latestResponse.answer?.encryptedPortion) {
    nextResponseSlice.answers = { ...(nextResponseSlice.answers || {}) };
    nextResponseSlice.answers[qid] = {
      ...(nextResponseSlice.answers[qid] || { value: '*', encrypted: true, hash: '' }),
      encrypted: !!(latestResponse.answer.encrypted || nextResponseSlice.answers?.[qid]?.encrypted),
      hash: latestResponse.answer.hash || nextResponseSlice.answers?.[qid]?.hash || '',
      encryptedPortion: latestResponse.answer.encryptedPortion,
    };
  }

  if (includeAdditional && latestResponse.additional?.encryptedPortion) {
    nextResponseSlice.additionalComments = { ...(nextResponseSlice.additionalComments || {}) };
    nextResponseSlice.additionalComments[qid] = {
      ...(nextResponseSlice.additionalComments[qid] || { value: '*', encrypted: true, hash: '' }),
      encrypted: !!(latestResponse.additional.encrypted || nextResponseSlice.additionalComments?.[qid]?.encrypted),
      hash: latestResponse.additional.hash || nextResponseSlice.additionalComments?.[qid]?.hash || '',
      encryptedPortion: latestResponse.additional.encryptedPortion,
    };
  }

  return nextResponseSlice;
};

export const mergeQuestionResponseOverrideIntoDecryptSlice = (responseSlice, questionId, responseOverride) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid || !responseOverride || typeof responseOverride !== 'object') return responseSlice;

  const ans = responseOverride.answer || {};
  const add = responseOverride.additional || {};
  const nextResponseSlice =
    responseSlice && typeof responseSlice === 'object' ? { ...responseSlice } : { answers: {}, additionalComments: {} };

  nextResponseSlice.answers = { ...(nextResponseSlice.answers || {}) };
  nextResponseSlice.additionalComments = { ...(nextResponseSlice.additionalComments || {}) };

  nextResponseSlice.answers[qid] = {
    ...(nextResponseSlice.answers[qid] || {}),
    ...(Object.prototype.hasOwnProperty.call(ans, 'value') ? { value: ans.value } : {}),
    encrypted: !!(ans.encrypted || ans.encryptedPortion || nextResponseSlice.answers?.[qid]?.encrypted),
    ...(ans.hash ? { hash: ans.hash } : {}),
    ...(ans.encryptedPortion ? { encryptedPortion: ans.encryptedPortion } : {}),
  };
  nextResponseSlice.additionalComments[qid] = {
    ...(nextResponseSlice.additionalComments[qid] || {}),
    ...(Object.prototype.hasOwnProperty.call(add, 'value') ? { value: add.value } : {}),
    encrypted: !!(add.encrypted || add.encryptedPortion || nextResponseSlice.additionalComments?.[qid]?.encrypted),
    ...(add.hash ? { hash: add.hash } : {}),
    ...(add.encryptedPortion ? { encryptedPortion: add.encryptedPortion } : {}),
  };

  return nextResponseSlice;
};

export const getQuestionRatingEnvelopes = (source, questionId = null) => {
  if (!source || typeof source !== 'object') return null;

  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  let target = source;

  if (Array.isArray(source.responses)) {
    target =
      source.responses.find(
        (response) =>
          String(response?.questionID || response?.questionId || '')
            .trim()
            .toLowerCase() === qid,
      ) || null;
  } else if (qid) {
    const sourceId = String(source.questionID || source.questionId || '')
      .trim()
      .toLowerCase();
    if (sourceId && sourceId !== qid) return null;
  }

  if (!target || typeof target !== 'object') return null;

  const importanceEncrypted = typeof target.importanceEncrypted === 'string' ? target.importanceEncrypted : '';
  const convictionEncrypted = typeof target.convictionEncrypted === 'string' ? target.convictionEncrypted : '';

  if (!importanceEncrypted && !convictionEncrypted) return null;
  return { importanceEncrypted, convictionEncrypted };
};

export const mergeQuestionRatingEnvelopeState = (previousState, nextSource, questionId = null) => {
  const previous = previousState && typeof previousState === 'object' ? previousState : null;
  const next = getQuestionRatingEnvelopes(nextSource, questionId);
  if (!previous) return next;
  if (!next) return previous;
  return {
    importanceEncrypted: next.importanceEncrypted || previous.importanceEncrypted || '',
    convictionEncrypted: next.convictionEncrypted || previous.convictionEncrypted || '',
  };
};

export const buildViewedResponseDecryptBaseline = (responseOverride, questionId, buildSliceFromUserAnswers) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid || !responseOverride || typeof responseOverride !== 'object') {
    return buildEmptyQuestionDecryptSlice();
  }

  const shaped = { ...responseOverride };
  if (!shaped.questionID && shaped.questionId) shaped.questionID = shaped.questionId;
  if (!shaped.questionID) shaped.questionID = qid;

  let baselineForDecrypt = null;
  try {
    baselineForDecrypt = buildSliceFromUserAnswers(shaped);
  } catch (_) {
    baselineForDecrypt = null;
  }

  return ensureQuestionDecryptSliceShape(baselineForDecrypt);
};

export const buildSelfQuestionDecryptBaseline = (
  surveyIndex,
  surveysResponseState,
  userAnswers,
  buildSliceFromUserAnswers,
  deepClone,
) => {
  let baselineSlice = surveysResponseState?.[surveyIndex];
  if (!baselineSlice && userAnswers) {
    baselineSlice = buildSliceFromUserAnswers(userAnswers);
  }
  return {
    baselineSlice,
    baselineForDecrypt: deepClone(ensureQuestionDecryptSliceShape(baselineSlice)),
  };
};
