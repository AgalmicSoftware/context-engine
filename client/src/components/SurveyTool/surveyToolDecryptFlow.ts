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
import type {
  ApplyQuestionDecryptCompletionStatusOptions,
  ApplyQuestionDecryptFailureStatusOptions,
  ApplySurveyDecryptStaleStatusOptions,
  BuildQuestionDecryptExecutionContextOptions,
  BuildSurveyDecryptExecutionContextOptions,
  DecryptResponseSlice,
  FinalizeQuestionDecryptAttemptOptions,
  FinalizeQuestionDecryptAttemptPorts,
  FinalizeSurveyDecryptAttemptOptions,
  FinalizeSurveyDecryptPorts,
  HydrateLatestQuestionDecryptStateOptions,
  HydrateLatestQuestionDecryptStatePorts,
  PrepareQuestionDecryptAttemptOptions,
  PrepareQuestionDecryptAttemptPorts,
  PrepareSelfQuestionDecryptStateOptions,
  PrepareSelfQuestionDecryptStatePorts,
  PrepareSurveyDecryptAttemptOptions,
  PrepareSurveyDecryptAttemptPorts,
  PrepareViewedQuestionDecryptStateOptions,
  PrepareViewedQuestionDecryptStatePorts,
  ResolveLatestSurveyDecryptResponseOptions,
  ResolveLatestSurveyDecryptResponsePorts,
  ResponseSlice,
  StartQuestionDecryptAttemptStatusOptions,
} from './surveyToolDecryptFlowTypes';

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
}: StartQuestionDecryptAttemptStatusOptions = {}) => {
  const preparePort =
    prepareQuestionDecryptAttempt || ((options) => host?.prepareQuestionDecryptAttempt?.(options) || {});
  const registerBusyPort =
    registerQuestionDecryptBusyTokens || ((keys) => host?.registerQuestionDecryptBusyTokens?.(keys));
  const setStatePort = setState || (host?.setState ? host.setState.bind(host) : () => {});
  const buildStartPort =
    buildStartState ||
    ((prev: unknown, keys: unknown[]) =>
      host?.buildQuestionDecryptStartState?.(prev, keys) || buildQuestionDecryptStartState(prev, keys));

  const preparedAttempt = preparePort({ questionId, fieldToDecrypt, baselineForDecrypt }) || {};
  if (!preparedAttempt.shouldDecrypt) {
    return { shouldReturn: true, result: false, reason: 'no-masked-field' };
  }

  const decryptSelection = preparedAttempt.decryptSelection || {};
  const keysToMark = Array.isArray(decryptSelection.keysToMark) ? decryptSelection.keysToMark : [];
  const decryptAttemptToken = registerBusyPort(keysToMark);
  setStatePort((prev: unknown) => buildStartPort(prev, keysToMark));

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
}: ApplyQuestionDecryptCompletionStatusOptions = {}) => {
  const setStatePort = setState || (host?.setState ? host.setState.bind(host) : () => {});
  const clearBusyPort =
    clearQuestionDecryptBusyTokens || ((keys, token) => host?.clearQuestionDecryptBusyTokens?.(keys, token));
  const isCurrentPort =
    isDecryptContextCurrent ||
    ((snapshot: unknown) => (host?.isDecryptContextCurrent ? host.isDecryptContextCurrent(snapshot) : true));
  const canUpdatePort =
    canUpdateStateForAsyncSnapshot ||
    ((snapshot: unknown) =>
      host?.canUpdateStateForAsyncSnapshot ? host.canUpdateStateForAsyncSnapshot(snapshot) : false);
  const ownsBusyPort =
    ownsQuestionDecryptBusyTokens ||
    ((keys: unknown, token: unknown) =>
      host?.ownsQuestionDecryptBusyTokens ? host.ownsQuestionDecryptBusyTokens(keys, token) : true);
  const buildStalePort =
    buildQuestionDecryptStaleState ||
    ((prev: unknown, targetQid: unknown, targetField: unknown, token: unknown) =>
      host?.buildQuestionDecryptStaleState?.(prev, targetQid, targetField, token) || null);
  const buildSuccessPort =
    buildSuccessState ||
    ((prev: unknown) => {
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
      setStatePort((prev: unknown) => buildStalePort(prev, questionId, fieldToDecrypt, decryptAttemptToken));
    }
    return { shouldReturn: true, result: false, reason: 'stale-context' };
  }

  if (!ownsBusyPort(keysToMark, decryptAttemptToken)) {
    setStatePort((prev: unknown) => buildStalePort(prev, questionId, fieldToDecrypt, decryptAttemptToken));
    return { shouldReturn: true, result: false, reason: 'stale-busy-token' };
  }

  clearBusyPort(keysToMark, decryptAttemptToken);
  setStatePort((prev: unknown) => buildSuccessPort(prev), onSuccessStateApplied);
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
}: ApplyQuestionDecryptFailureStatusOptions = {}) => {
  const setStatePort = setState || (host?.setState ? host.setState.bind(host) : () => {});
  const isCurrentPort =
    isDecryptContextCurrent ||
    ((snapshot: unknown) => (host?.isDecryptContextCurrent ? host.isDecryptContextCurrent(snapshot) : true));
  const canUpdatePort =
    canUpdateStateForAsyncSnapshot ||
    ((snapshot: unknown) =>
      host?.canUpdateStateForAsyncSnapshot ? host.canUpdateStateForAsyncSnapshot(snapshot) : false);
  const buildStalePort =
    buildQuestionDecryptStaleState ||
    ((prev: unknown, targetQid: unknown, targetField: unknown, token: unknown) =>
      host?.buildQuestionDecryptStaleState?.(prev, targetQid, targetField, token) || null);
  const buildFailurePort =
    buildQuestionDecryptFailureStateForAttempt ||
    ((prev: unknown, targetQid: unknown, targetField: unknown, message: unknown, token: unknown) =>
      host?.buildQuestionDecryptFailureStateForAttempt?.(prev, targetQid, targetField, message, token) || null);

  if (!isCurrentPort(context)) {
    if (decryptAttemptToken != null && canUpdatePort(context)) {
      setStatePort((prev: unknown) => buildStalePort(prev, questionId, fieldToDecrypt, decryptAttemptToken));
    }
    return false;
  }

  setStatePort((prev: unknown) =>
    buildFailurePort(prev, questionId, fieldToDecrypt, error?.message, decryptAttemptToken),
  );
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
}: ApplySurveyDecryptStaleStatusOptions = {}) => {
  const isCurrentPort =
    typeof isDecryptContextCurrent === 'function'
      ? isDecryptContextCurrent
      : (snapshot: unknown) => (host?.isDecryptContextCurrent ? host.isDecryptContextCurrent(snapshot) : true);

  if (isCurrentPort(context)) {
    return { shouldReturn: false, reason: 'current-context' };
  }

  const canUpdatePort =
    typeof canUpdateSurveyDecryptAttempt === 'function'
      ? canUpdateSurveyDecryptAttempt
      : (snapshot: unknown, targetAttemptId: unknown) =>
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
  }: HydrateLatestQuestionDecryptStateOptions = {},
  {
    getQuestionFieldDecryptSelection,
    readQuestionsCache,
    getLatestQuestionResponse,
    mergeLatestEncryptedQuestionFields,
    mergeQuestionRatingEnvelopeState = (previousState) => previousState,
    logWarn = () => {},
  }: HydrateLatestQuestionDecryptStatePorts = {},
) => {
  let nextBaselineForDecrypt = baselineForDecrypt;
  let nextRatingEnvelopes = initialRatingEnvelopes;
  const getQuestionFieldDecryptSelectionPort = getQuestionFieldDecryptSelection as NonNullable<
    HydrateLatestQuestionDecryptStatePorts['getQuestionFieldDecryptSelection']
  >;
  const readQuestionsCachePort = readQuestionsCache as NonNullable<
    HydrateLatestQuestionDecryptStatePorts['readQuestionsCache']
  >;
  const getLatestQuestionResponsePort = getLatestQuestionResponse as NonNullable<
    HydrateLatestQuestionDecryptStatePorts['getLatestQuestionResponse']
  >;
  const mergeLatestEncryptedQuestionFieldsPort = mergeLatestEncryptedQuestionFields as NonNullable<
    HydrateLatestQuestionDecryptStatePorts['mergeLatestEncryptedQuestionFields']
  >;

  try {
    const hydrateSelection = getQuestionFieldDecryptSelectionPort(questionId, fieldToDecrypt, nextBaselineForDecrypt);
    const { maskedAnswer: maskedAnswerForHydrate, maskedAdditional: maskedAdditionalForHydrate } = hydrateSelection;

    if ((maskedAnswerForHydrate || maskedAdditionalForHydrate) && account && networkID) {
      const questionsCache = readQuestionsCachePort(sessionSlug) || {};
      const fetchQuestionId = String(questionId || '').toLowerCase();
      const latest = await getLatestQuestionResponsePort(
        responderForLatest || account,
        fetchQuestionId,
        networkID,
        questionsCache,
      );

      if (latest) {
        nextRatingEnvelopes = mergeQuestionRatingEnvelopeState(nextRatingEnvelopes, latest, questionId);
        nextBaselineForDecrypt = mergeLatestEncryptedQuestionFieldsPort(nextBaselineForDecrypt, questionId, latest, {
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
  }: PrepareViewedQuestionDecryptStateOptions = {},
  {
    buildViewedResponseDecryptBaseline,
    hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptStateFn,
  }: PrepareViewedQuestionDecryptStatePorts = {},
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const buildViewedResponseDecryptBaselinePort = buildViewedResponseDecryptBaseline as NonNullable<
    PrepareViewedQuestionDecryptStatePorts['buildViewedResponseDecryptBaseline']
  >;
  const hydrateLatestQuestionDecryptStatePort = hydrateLatestQuestionDecryptStateFn as NonNullable<
    PrepareViewedQuestionDecryptStatePorts['hydrateLatestQuestionDecryptState']
  >;
  let baselineForDecrypt = buildViewedResponseDecryptBaselinePort(responseOverride, qid);
  let ratingEnvelopes: unknown = {
    importanceEncrypted:
      typeof responseOverride?.importanceEncrypted === 'string' ? responseOverride.importanceEncrypted : '',
    convictionEncrypted:
      typeof responseOverride?.convictionEncrypted === 'string' ? responseOverride.convictionEncrypted : '',
  };

  if (qid && responseOverride && typeof responseOverride === 'object') {
    const hydrated = await hydrateLatestQuestionDecryptStatePort({
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
  }: PrepareSelfQuestionDecryptStateOptions = {},
  {
    buildSelfQuestionDecryptBaseline,
    mergeQuestionResponseOverrideIntoDecryptSlice,
    mergeQuestionRatingEnvelopeState,
    hydrateLatestQuestionDecryptState: hydrateLatestQuestionDecryptStateFn,
    logWarn = () => {},
  }: PrepareSelfQuestionDecryptStatePorts = {},
) => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const buildSelfQuestionDecryptBaselinePort = buildSelfQuestionDecryptBaseline as NonNullable<
    PrepareSelfQuestionDecryptStatePorts['buildSelfQuestionDecryptBaseline']
  >;
  const mergeQuestionResponseOverrideIntoDecryptSlicePort =
    mergeQuestionResponseOverrideIntoDecryptSlice as NonNullable<
      PrepareSelfQuestionDecryptStatePorts['mergeQuestionResponseOverrideIntoDecryptSlice']
    >;
  const mergeQuestionRatingEnvelopeStatePort = mergeQuestionRatingEnvelopeState as NonNullable<
    PrepareSelfQuestionDecryptStatePorts['mergeQuestionRatingEnvelopeState']
  >;
  const hydrateLatestQuestionDecryptStatePort = hydrateLatestQuestionDecryptStateFn as NonNullable<
    PrepareSelfQuestionDecryptStatePorts['hydrateLatestQuestionDecryptState']
  >;
  let { baselineSlice, baselineForDecrypt } = buildSelfQuestionDecryptBaselinePort(surveyIndex);

  if (responseOverride && typeof responseOverride === 'object') {
    try {
      baselineForDecrypt = mergeQuestionResponseOverrideIntoDecryptSlicePort(baselineForDecrypt, qid, responseOverride);
    } catch (error) {
      logWarn(error);
    }
  }

  let ratingEnvelopes = mergeQuestionRatingEnvelopeStatePort(null, responseOverride, qid);
  ratingEnvelopes = mergeQuestionRatingEnvelopeStatePort(ratingEnvelopes, userAnswers, qid);

  const hydrated = await hydrateLatestQuestionDecryptStatePort({
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
  }: ResolveLatestSurveyDecryptResponseOptions = {},
  { getLatestQuestionResponse, getLatestSurveyResponse }: ResolveLatestSurveyDecryptResponsePorts = {},
) => {
  let latest = null;
  const getLatestQuestionResponsePort = getLatestQuestionResponse as NonNullable<
    ResolveLatestSurveyDecryptResponsePorts['getLatestQuestionResponse']
  >;
  const getLatestSurveyResponsePort = getLatestSurveyResponse as NonNullable<
    ResolveLatestSurveyDecryptResponsePorts['getLatestSurveyResponse']
  >;

  if (singleQuestionMode) {
    const qid = String(questionId || '')
      .trim()
      .toLowerCase();
    latest = qid && account ? await getLatestQuestionResponsePort(providerLike, account, qid, slug) : null;
  } else {
    latest = account ? await getLatestSurveyResponsePort(account, surveyId) : null;
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
  }: PrepareSurveyDecryptAttemptOptions = {},
  {
    resolveLatestSurveyDecryptResponse,
    buildSurveyDecryptSourceState,
    buildSurveyDecryptExecutionContext,
  }: PrepareSurveyDecryptAttemptPorts = {},
) => {
  const resolveLatestSurveyDecryptResponsePort = resolveLatestSurveyDecryptResponse as NonNullable<
    PrepareSurveyDecryptAttemptPorts['resolveLatestSurveyDecryptResponse']
  >;
  const buildSurveyDecryptSourceStatePort = buildSurveyDecryptSourceState as NonNullable<
    PrepareSurveyDecryptAttemptPorts['buildSurveyDecryptSourceState']
  >;
  const buildSurveyDecryptExecutionContextPort = buildSurveyDecryptExecutionContext as NonNullable<
    PrepareSurveyDecryptAttemptPorts['buildSurveyDecryptExecutionContext']
  >;

  const latest = await resolveLatestSurveyDecryptResponsePort({
    singleQuestionMode,
    questionId,
    account,
    providerLike,
    slug,
    surveyId,
    fallbackUserAnswers,
  });

  const { sourceSlice, ratingEnvelopesByQid } = buildSurveyDecryptSourceStatePort(
    latest,
    fallbackSourceSlice,
    previousStateSlice,
  );

  const { chainId, lit, opts, poolForDecrypt } = buildSurveyDecryptExecutionContextPort(sourceSlice, questionId);

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
  }: FinalizeSurveyDecryptAttemptOptions = {},
  {
    decryptMultipleAnswers,
    decryptQuestionRatingEnvelopeMap,
    normalizeBulkDecryptedSliceForSurveyState,
  }: Partial<FinalizeSurveyDecryptPorts> = {},
) => {
  const decryptMultipleAnswersPort = decryptMultipleAnswers as NonNullable<
    FinalizeSurveyDecryptPorts['decryptMultipleAnswers']
  >;
  const decryptQuestionRatingEnvelopeMapPort = decryptQuestionRatingEnvelopeMap as NonNullable<
    FinalizeSurveyDecryptPorts['decryptQuestionRatingEnvelopeMap']
  >;
  const normalizeBulkDecryptedSliceForSurveyStatePort = normalizeBulkDecryptedSliceForSurveyState as NonNullable<
    FinalizeSurveyDecryptPorts['normalizeBulkDecryptedSliceForSurveyState']
  >;
  const decryptedSlice = await decryptMultipleAnswersPort(sourceSlice as DecryptResponseSlice, poolForDecrypt, opts);

  const { decryptedImportanceFromEnv, decryptedConvictionFromEnv } = await decryptQuestionRatingEnvelopeMapPort(
    ratingEnvelopesByQid,
    {
      account,
      chainId,
      lit,
      providerLike,
    },
  );

  const normalizedDecryptedSlice = normalizeBulkDecryptedSliceForSurveyStatePort(decryptedSlice, {
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
}: BuildQuestionDecryptExecutionContextOptions = {}) => {
  const getProviderKindPort = getProviderKind as NonNullable<
    BuildQuestionDecryptExecutionContextOptions['getProviderKind']
  >;
  const resolveDecryptSurveyIdPort = resolveDecryptSurveyId as NonNullable<
    BuildQuestionDecryptExecutionContextOptions['resolveDecryptSurveyId']
  >;
  const providerKind = getProviderKindPort(provider);
  const chainId = network?.id;
  const surveyId = resolveDecryptSurveyIdPort(baselineForDecrypt, questionId);
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
}: BuildSurveyDecryptExecutionContextOptions = {}) => {
  const getProviderKindPort = getProviderKind as NonNullable<
    BuildSurveyDecryptExecutionContextOptions['getProviderKind']
  >;
  const resolveDecryptSurveyIdPort = resolveDecryptSurveyId as NonNullable<
    BuildSurveyDecryptExecutionContextOptions['resolveDecryptSurveyId']
  >;
  const litHooksRecord = litHooks && typeof litHooks === 'object' ? (litHooks as { getKey?: unknown }) : null;
  const providerKind = getProviderKindPort(provider);
  const chainId = network?.id;
  const surveyId = resolveDecryptSurveyIdPort(sourceSlice, questionId);
  const poolForDecrypt =
    Array.isArray(questionPool) && questionPool.length > 0
      ? questionPool
      : Array.isArray(pileQuestions)
        ? pileQuestions
        : [];
  const lit = litHooksRecord?.getKey ? { getKey: litHooksRecord.getKey } : undefined;

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
  { questionId, fieldToDecrypt = 'both', baselineForDecrypt = null }: PrepareQuestionDecryptAttemptOptions = {},
  { getQuestionFieldDecryptSelection, buildQuestionDecryptExecutionContext }: PrepareQuestionDecryptAttemptPorts = {},
) => {
  const getQuestionFieldDecryptSelectionPort = getQuestionFieldDecryptSelection as NonNullable<
    PrepareQuestionDecryptAttemptPorts['getQuestionFieldDecryptSelection']
  >;
  const buildQuestionDecryptExecutionContextPort = buildQuestionDecryptExecutionContext as NonNullable<
    PrepareQuestionDecryptAttemptPorts['buildQuestionDecryptExecutionContext']
  >;
  const responseSlice = baselineForDecrypt as ResponseSlice | null;
  const decryptSelection = getQuestionFieldDecryptSelectionPort(questionId, fieldToDecrypt, responseSlice);

  if (!decryptSelection.hasMaskedField) {
    return {
      blockedReason: 'no-masked-field',
      shouldDecrypt: false,
      decryptSelection,
    };
  }

  const { chainId, lit, opts, target } = buildQuestionDecryptExecutionContextPort(responseSlice, questionId);
  const requestPlan = buildSurveyQuestionDecryptRequestPlan({
    account: opts?.account,
    baselineForDecrypt: responseSlice,
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
  }: FinalizeQuestionDecryptAttemptOptions = {},
  { decryptSingleField, decryptQuestionRatingEnvelopes }: FinalizeQuestionDecryptAttemptPorts = {},
) => {
  const qid = normalizeQuestionIdKey(questionId);
  const decryptSingleFieldPort = decryptSingleField as NonNullable<
    FinalizeQuestionDecryptAttemptPorts['decryptSingleField']
  >;
  const decryptQuestionRatingEnvelopesPort = decryptQuestionRatingEnvelopes as NonNullable<
    FinalizeQuestionDecryptAttemptPorts['decryptQuestionRatingEnvelopes']
  >;
  const decryptedStateSlice = await decryptSingleFieldPort(
    baselineForDecrypt as ResponseSlice | null,
    qid,
    fieldToDecrypt,
    opts,
  );

  const producedAnswer = !!(decryptedStateSlice.answers && decryptedStateSlice.answers[qid]);
  const producedAdditional = !!(decryptedStateSlice.additionalComments && decryptedStateSlice.additionalComments[qid]);
  const didUpdate = producedAnswer || producedAdditional;

  const { decryptedImportance, decryptedConviction } = await decryptQuestionRatingEnvelopesPort(ratingEnvelopes, {
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
