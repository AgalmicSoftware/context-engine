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
import {
  applyDecryptedQuestionResponseValues,
  applyDecryptedQuestionResponseValuesToContainer,
  applyDecryptedQuestionStateToSurveySlice,
  buildSelfQuestionDecryptBaseline,
  buildSelfQuestionDecryptSuccessState,
  buildSurveyDecryptSuccessState,
  buildViewedResponseDecryptBaseline,
  buildViewedResponseDecryptSuccessState,
  ensureQuestionDecryptSliceShape,
  getQuestionRatingEnvelopes,
  mergeLatestEncryptedQuestionFields,
  mergeQuestionRatingEnvelopeState,
  mergeQuestionResponseOverrideIntoDecryptSlice,
  normalizeBulkDecryptedSliceForSurveyState,
  syncDecryptedQuestionIntoBaseline,
} from './surveyToolDecryptSliceState';
import {
  buildSurveyDecryptAttemptSourceInputs,
  buildSurveyDecryptSourceState,
  carryForwardSurveyQuestionRatings,
  collectQuestionRatingEnvelopesByQid,
  decryptQuestionRatingEnvelopeMap,
  decryptQuestionRatingEnvelopes,
} from './surveyToolDecryptSurveySource';
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
  applyDecryptedQuestionResponseValues,
  applyDecryptedQuestionResponseValuesToContainer,
  applyDecryptedQuestionStateToSurveySlice,
  buildSelfQuestionDecryptBaseline,
  buildSelfQuestionDecryptSuccessState,
  buildSurveyDecryptSuccessState,
  buildViewedResponseDecryptBaseline,
  buildViewedResponseDecryptSuccessState,
  ensureQuestionDecryptSliceShape,
  getQuestionRatingEnvelopes,
  mergeLatestEncryptedQuestionFields,
  mergeQuestionRatingEnvelopeState,
  mergeQuestionResponseOverrideIntoDecryptSlice,
  normalizeBulkDecryptedSliceForSurveyState,
  syncDecryptedQuestionIntoBaseline,
} from './surveyToolDecryptSliceState';
export {
  buildSurveyDecryptAttemptSourceInputs,
  buildSurveyDecryptSourceState,
  carryForwardSurveyQuestionRatings,
  collectQuestionRatingEnvelopesByQid,
  decryptQuestionRatingEnvelopeMap,
  decryptQuestionRatingEnvelopes,
} from './surveyToolDecryptSurveySource';

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
