import { clearQuestionFieldBusyMap } from './surveyToolDecryptBusyState';
import { buildEmptyQuestionDecryptSlice } from './surveyToolDecryptState';

type UnknownRecord = Record<string, unknown>;

const isObjectLike = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

const asRecord = (value: unknown): UnknownRecord => (isObjectLike(value) ? value : {});

const normalizeQuestionKey = (questionId: unknown): string =>
  String(questionId || '')
    .trim()
    .toLowerCase();

export const ensureQuestionDecryptSliceShape = (responseSlice: unknown) => {
  const base = isObjectLike(responseSlice) ? responseSlice : buildEmptyQuestionDecryptSlice();

  return {
    ...base,
    answers: { ...asRecord(base.answers) },
    importance: { ...asRecord(base.importance) },
    conviction: { ...asRecord(base.conviction) },
    additionalComments: { ...asRecord(base.additionalComments) },
  };
};

export const applyDecryptedQuestionResponseValues = (
  responseRecord: unknown,
  {
    questionId,
    decryptedStateSlice,
    decryptedImportance = null,
    decryptedConviction = null,
  }: {
    questionId?: unknown;
    decryptedStateSlice?: unknown;
    decryptedImportance?: unknown;
    decryptedConviction?: unknown;
  } = {},
) => {
  if (!isObjectLike(responseRecord)) return responseRecord;
  const qid = normalizeQuestionKey(questionId);
  const next = { ...responseRecord };
  let changed = false;
  const decryptedSlice = asRecord(decryptedStateSlice);
  const decryptedAnswers = asRecord(decryptedSlice.answers);
  const decryptedAdditionalComments = asRecord(decryptedSlice.additionalComments);

  if (qid && isObjectLike(decryptedAnswers[qid])) {
    const nextValue = asRecord(decryptedAnswers[qid]).value;
    next.answer = {
      ...asRecord(next.answer),
      value: nextValue,
    };
    changed = changed || asRecord(responseRecord.answer).value !== nextValue;
  }
  if (qid && isObjectLike(decryptedAdditionalComments[qid])) {
    const nextValue = asRecord(decryptedAdditionalComments[qid]).value;
    next.additional = {
      ...asRecord(next.additional),
      value: nextValue,
    };
    changed = changed || asRecord(responseRecord.additional).value !== nextValue;
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

export const applyDecryptedQuestionResponseValuesToContainer = (
  viewedResponseContainer: unknown,
  options: UnknownRecord = {},
) => {
  if (!isObjectLike(viewedResponseContainer)) {
    return viewedResponseContainer;
  }

  if (Array.isArray(viewedResponseContainer.responses)) {
    const qid = normalizeQuestionKey(options.questionId);
    let changed = false;
    const nextResponses = viewedResponseContainer.responses.map((responseRecord) => {
      const response = asRecord(responseRecord);
      const rid = normalizeQuestionKey(response.questionID || response.questionId);
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
  prevState: unknown,
  {
    questionId,
    clearMode = 'both',
    didUpdate = false,
    decryptedStateSlice,
    decryptedImportance = null,
    decryptedConviction = null,
  }: {
    questionId?: unknown;
    clearMode?: unknown;
    didUpdate?: boolean;
    decryptedStateSlice?: unknown;
    decryptedImportance?: unknown;
    decryptedConviction?: unknown;
  } = {},
) => {
  const previous = asRecord(prevState);
  const nextViewed = applyDecryptedQuestionResponseValuesToContainer(previous.parsedViewAddressAnswers, {
    questionId,
    decryptedStateSlice,
    decryptedImportance,
    decryptedConviction,
  });

  const viewAddressAnswers =
    nextViewed && nextViewed !== previous.parsedViewAddressAnswers
      ? JSON.stringify(nextViewed)
      : previous.viewAddressAnswers;

  return {
    parsedViewAddressAnswers: nextViewed,
    viewAddressAnswers,
    isDecrypting: false,
    decryptingByKey: clearQuestionFieldBusyMap(previous.decryptingByKey, questionId, clearMode),
    ...(didUpdate ? {} : { submissionError: 'Decryption failed.' }),
  };
};

export const applyDecryptedQuestionStateToSurveySlice = (
  targetStateSlice: unknown,
  {
    questionId,
    decryptedStateSlice,
    baselineSlice = null,
    decryptedImportance = null,
    decryptedConviction = null,
  }: {
    questionId?: unknown;
    decryptedStateSlice?: unknown;
    baselineSlice?: unknown;
    decryptedImportance?: unknown;
    decryptedConviction?: unknown;
  } = {},
) => {
  const qid = normalizeQuestionKey(questionId);
  if (!qid) return targetStateSlice;

  const nextTargetStateSlice = {
    ...asRecord(targetStateSlice),
  };
  const decryptedSlice = asRecord(decryptedStateSlice);
  const decryptedAnswers = asRecord(decryptedSlice.answers);
  const decryptedAdditionalComments = asRecord(decryptedSlice.additionalComments);
  const baseline = asRecord(baselineSlice);
  const baselineAnswers = asRecord(baseline.answers);
  const baselineAdditionalComments = asRecord(baseline.additionalComments);

  if (isObjectLike(decryptedAnswers[qid])) {
    const currentAnswers = asRecord(nextTargetStateSlice.answers);
    const currentAnswer = asRecord(currentAnswers[qid]);
    const prevEncrypted = currentAnswer.encrypted;
    const incoming = asRecord(decryptedAnswers[qid]);
    const baselineAnswer = asRecord(baselineAnswers[qid]);
    nextTargetStateSlice.answers = { ...currentAnswers };
    asRecord(nextTargetStateSlice.answers)[qid] = {
      ...currentAnswer,
      value: incoming.value,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(baselineAnswer.value === '*' && (baselineAnswer.encryptedPortion || baselineAnswer.encrypted)),
      ...(incoming.zkSalt ? { zkSalt: incoming.zkSalt } : {}),
    };
  }

  if (isObjectLike(decryptedAdditionalComments[qid])) {
    const currentAdditionalComments = asRecord(nextTargetStateSlice.additionalComments);
    const currentAdditional = asRecord(currentAdditionalComments[qid]);
    const prevEncrypted = currentAdditional.encrypted;
    const incoming = asRecord(decryptedAdditionalComments[qid]);
    const baselineAdditional = asRecord(baselineAdditionalComments[qid]);
    nextTargetStateSlice.additionalComments = {
      ...currentAdditionalComments,
    };
    asRecord(nextTargetStateSlice.additionalComments)[qid] = {
      ...currentAdditional,
      value: incoming.value,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(
              baselineAdditional.value === '*' &&
              (baselineAdditional.encryptedPortion || baselineAdditional.encrypted)
            ),
      ...(incoming.zkSalt ? { zkSalt: incoming.zkSalt } : {}),
    };
  }

  if (decryptedImportance !== null && decryptedImportance !== undefined) {
    nextTargetStateSlice.importance = nextTargetStateSlice.importance || {};
    asRecord(nextTargetStateSlice.importance)[qid] = decryptedImportance;
  }
  if (decryptedConviction !== null && decryptedConviction !== undefined) {
    nextTargetStateSlice.conviction = nextTargetStateSlice.conviction || {};
    asRecord(nextTargetStateSlice.conviction)[qid] = decryptedConviction;
  }

  return nextTargetStateSlice;
};

export const buildSelfQuestionDecryptSuccessState = (
  prevState: unknown,
  {
    surveyIndex = 0,
    questionId,
    clearMode = 'both',
    didUpdate = false,
    baselineSlice = null,
    decryptedStateSlice,
    decryptedImportance = null,
    decryptedConviction = null,
  }: {
    surveyIndex?: number;
    questionId?: unknown;
    clearMode?: unknown;
    didUpdate?: boolean;
    baselineSlice?: unknown;
    decryptedStateSlice?: unknown;
    decryptedImportance?: unknown;
    decryptedConviction?: unknown;
  } = {},
  deepClone: (value: unknown) => unknown = (value) => value,
) => {
  const previous = asRecord(prevState);
  const surveysResponseStateCopy = [...((previous.surveysResponseState as unknown[]) || [])];
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
    decryptingByKey: clearQuestionFieldBusyMap(previous.decryptingByKey, questionId, clearMode),
    editBaseline: syncDecryptedQuestionIntoBaseline(
      previous.editBaseline,
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
  prevState: unknown,
  {
    surveyIndex = 0,
    decryptedSlice = {},
    decryptedImportanceFromEnv = {},
    decryptedConvictionFromEnv = {},
  }: {
    surveyIndex?: number;
    decryptedSlice?: unknown;
    decryptedImportanceFromEnv?: unknown;
    decryptedConvictionFromEnv?: unknown;
  } = {},
  deepClone: (value: unknown) => unknown = (value) => value,
) => {
  const previous = asRecord(prevState);
  const previousSurveysResponseState = (previous.surveysResponseState as unknown[]) || [];
  const previousSlice = asRecord(previousSurveysResponseState[surveyIndex]);
  const slice = asRecord(decryptedSlice);
  const sliceAnswers = asRecord(slice.answers);
  const sliceAdditionalComments = asRecord(slice.additionalComments);
  const nextSlice = {
    answers: {
      ...asRecord(previousSlice.answers),
      ...sliceAnswers,
    },
    importance: {
      ...asRecord(previousSlice.importance),
      ...asRecord(slice.importance),
      ...asRecord(decryptedImportanceFromEnv),
    },
    conviction: {
      ...asRecord(previousSlice.conviction),
      ...asRecord(decryptedConvictionFromEnv),
    },
    additionalComments: {
      ...asRecord(previousSlice.additionalComments),
      ...sliceAdditionalComments,
    },
  };

  Object.keys(sliceAnswers).forEach((questionId) => {
    const state = asRecord(sliceAnswers[questionId]);
    if (state && state.zkSalt) {
      nextSlice.answers[questionId] = {
        ...asRecord(nextSlice.answers[questionId]),
        zkSalt: state.zkSalt,
      };
    }
  });
  Object.keys(sliceAdditionalComments).forEach((questionId) => {
    const state = asRecord(sliceAdditionalComments[questionId]);
    if (state && state.zkSalt) {
      nextSlice.additionalComments[questionId] = {
        ...asRecord(nextSlice.additionalComments[questionId]),
        zkSalt: state.zkSalt,
      };
    }
  });

  const surveysResponseStateCopy = [...previousSurveysResponseState];
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
  decryptedSlice: unknown = {},
  { previousStateSlice = null, baselineSlice = null }: { previousStateSlice?: unknown; baselineSlice?: unknown } = {},
) => {
  const slice = asRecord(decryptedSlice);
  const previousSlice = asRecord(previousStateSlice);
  const baseline = asRecord(baselineSlice);
  const nextDecryptedSlice = {
    ...slice,
    answers: { ...asRecord(slice.answers) },
    additionalComments: { ...asRecord(slice.additionalComments) },
  };

  Object.keys(nextDecryptedSlice.answers || {}).forEach((questionId) => {
    const nextAnswer = asRecord(nextDecryptedSlice.answers[questionId]);
    const prevEncrypted = asRecord(asRecord(previousSlice.answers)[questionId]).encrypted;
    const baselineAnswer = asRecord(asRecord(baseline.answers)[questionId]);
    nextDecryptedSlice.answers[questionId] = {
      ...nextAnswer,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(baselineAnswer.value === '*' && (baselineAnswer.encryptedPortion || baselineAnswer.encrypted)),
    };
  });

  Object.keys(nextDecryptedSlice.additionalComments || {}).forEach((questionId) => {
    const nextAdditional = asRecord(nextDecryptedSlice.additionalComments[questionId]);
    const prevEncrypted = asRecord(asRecord(previousSlice.additionalComments)[questionId]).encrypted;
    const baselineAdditional = asRecord(asRecord(baseline.additionalComments)[questionId]);
    nextDecryptedSlice.additionalComments[questionId] = {
      ...nextAdditional,
      encrypted:
        typeof prevEncrypted === 'boolean'
          ? prevEncrypted
          : !!(
              baselineAdditional.value === '*' &&
              (baselineAdditional.encryptedPortion || baselineAdditional.encrypted)
            ),
    };
  });

  return nextDecryptedSlice;
};

export const syncDecryptedQuestionIntoBaseline = (
  editBaseline: unknown,
  fallbackBaseline: unknown,
  nextTargetStateSlice: unknown,
  {
    questionId,
    decryptedStateSlice,
    decryptedImportance = null,
    decryptedConviction = null,
  }: {
    questionId?: unknown;
    decryptedStateSlice?: unknown;
    decryptedImportance?: unknown;
    decryptedConviction?: unknown;
  } = {},
  deepClone: (value: unknown) => unknown = (value) => value,
) => {
  const qid = normalizeQuestionKey(questionId);
  const nextBaseline = (
    editBaseline ? deepClone(editBaseline) : deepClone(fallbackBaseline || buildEmptyQuestionDecryptSlice())
  ) as UnknownRecord;

  if (!qid) return nextBaseline;

  if (!nextBaseline.answers) nextBaseline.answers = {};
  if (!nextBaseline.additionalComments) nextBaseline.additionalComments = {};

  const decryptedSlice = asRecord(decryptedStateSlice);
  const targetSlice = asRecord(nextTargetStateSlice);
  if (isObjectLike(asRecord(decryptedSlice.answers)[qid])) {
    asRecord(nextBaseline.answers)[qid] = deepClone(asRecord(targetSlice.answers)[qid]);
  }
  if (isObjectLike(asRecord(decryptedSlice.additionalComments)[qid])) {
    asRecord(nextBaseline.additionalComments)[qid] = deepClone(asRecord(targetSlice.additionalComments)[qid]);
  }
  if (decryptedImportance !== null && decryptedImportance !== undefined) {
    nextBaseline.importance = nextBaseline.importance || {};
    asRecord(nextBaseline.importance)[qid] = decryptedImportance;
  }
  if (decryptedConviction !== null && decryptedConviction !== undefined) {
    nextBaseline.conviction = nextBaseline.conviction || {};
    asRecord(nextBaseline.conviction)[qid] = decryptedConviction;
  }

  return nextBaseline;
};

export const mergeLatestEncryptedQuestionFields = (
  responseSlice: unknown,
  questionId: unknown,
  latestResponse: unknown,
  { includeAnswer = false, includeAdditional = false }: { includeAnswer?: boolean; includeAdditional?: boolean } = {},
) => {
  const qid = normalizeQuestionKey(questionId);
  if (!qid || !isObjectLike(latestResponse)) return responseSlice;

  const nextResponseSlice = isObjectLike(responseSlice)
    ? { ...responseSlice }
    : { answers: {}, additionalComments: {} };
  const latestAnswer = asRecord(latestResponse.answer);
  const latestAdditional = asRecord(latestResponse.additional);

  if (includeAnswer && latestAnswer.encryptedPortion) {
    const currentAnswers = asRecord(nextResponseSlice.answers);
    const currentAnswer = asRecord(currentAnswers[qid]);
    nextResponseSlice.answers = { ...currentAnswers };
    asRecord(nextResponseSlice.answers)[qid] = {
      ...(isObjectLike(currentAnswers[qid]) ? currentAnswer : { value: '*', encrypted: true, hash: '' }),
      encrypted: !!(latestAnswer.encrypted || currentAnswer.encrypted),
      hash: latestAnswer.hash || currentAnswer.hash || '',
      encryptedPortion: latestAnswer.encryptedPortion,
    };
  }

  if (includeAdditional && latestAdditional.encryptedPortion) {
    const currentAdditionalComments = asRecord(nextResponseSlice.additionalComments);
    const currentAdditional = asRecord(currentAdditionalComments[qid]);
    nextResponseSlice.additionalComments = { ...currentAdditionalComments };
    asRecord(nextResponseSlice.additionalComments)[qid] = {
      ...(isObjectLike(currentAdditionalComments[qid]) ? currentAdditional : { value: '*', encrypted: true, hash: '' }),
      encrypted: !!(latestAdditional.encrypted || currentAdditional.encrypted),
      hash: latestAdditional.hash || currentAdditional.hash || '',
      encryptedPortion: latestAdditional.encryptedPortion,
    };
  }

  return nextResponseSlice;
};

export const mergeQuestionResponseOverrideIntoDecryptSlice = (
  responseSlice: unknown,
  questionId: unknown,
  responseOverride: unknown,
) => {
  const qid = normalizeQuestionKey(questionId);
  if (!qid || !isObjectLike(responseOverride)) return responseSlice;

  const ans = asRecord(responseOverride.answer);
  const add = asRecord(responseOverride.additional);
  const nextResponseSlice = isObjectLike(responseSlice)
    ? { ...responseSlice }
    : { answers: {}, additionalComments: {} };

  nextResponseSlice.answers = { ...asRecord(nextResponseSlice.answers) };
  nextResponseSlice.additionalComments = { ...asRecord(nextResponseSlice.additionalComments) };

  const currentAnswer = asRecord(asRecord(nextResponseSlice.answers)[qid]);
  asRecord(nextResponseSlice.answers)[qid] = {
    ...currentAnswer,
    ...(Object.prototype.hasOwnProperty.call(ans, 'value') ? { value: ans.value } : {}),
    encrypted: !!(ans.encrypted || ans.encryptedPortion || currentAnswer.encrypted),
    ...(ans.hash ? { hash: ans.hash } : {}),
    ...(ans.encryptedPortion ? { encryptedPortion: ans.encryptedPortion } : {}),
  };
  const currentAdditional = asRecord(asRecord(nextResponseSlice.additionalComments)[qid]);
  asRecord(nextResponseSlice.additionalComments)[qid] = {
    ...currentAdditional,
    ...(Object.prototype.hasOwnProperty.call(add, 'value') ? { value: add.value } : {}),
    encrypted: !!(add.encrypted || add.encryptedPortion || currentAdditional.encrypted),
    ...(add.hash ? { hash: add.hash } : {}),
    ...(add.encryptedPortion ? { encryptedPortion: add.encryptedPortion } : {}),
  };

  return nextResponseSlice;
};

export const getQuestionRatingEnvelopes = (source: unknown, questionId: unknown = null) => {
  if (!isObjectLike(source)) return null;

  const qid = normalizeQuestionKey(questionId);
  let target: unknown = source;

  if (Array.isArray(source.responses)) {
    target =
      source.responses.find((response) => {
        const responseRecord = asRecord(response);
        return normalizeQuestionKey(responseRecord.questionID || responseRecord.questionId) === qid;
      }) || null;
  } else if (qid) {
    const sourceId = normalizeQuestionKey(source.questionID || source.questionId);
    if (sourceId && sourceId !== qid) return null;
  }

  if (!isObjectLike(target)) return null;

  const importanceEncrypted = typeof target.importanceEncrypted === 'string' ? target.importanceEncrypted : '';
  const convictionEncrypted = typeof target.convictionEncrypted === 'string' ? target.convictionEncrypted : '';

  if (!importanceEncrypted && !convictionEncrypted) return null;
  return { importanceEncrypted, convictionEncrypted };
};

export const mergeQuestionRatingEnvelopeState = (
  previousState: unknown,
  nextSource: unknown,
  questionId: unknown = null,
) => {
  const previous = isObjectLike(previousState) ? previousState : null;
  const next = getQuestionRatingEnvelopes(nextSource, questionId);
  if (!previous) return next;
  if (!next) return previous;
  return {
    importanceEncrypted: next.importanceEncrypted || previous.importanceEncrypted || '',
    convictionEncrypted: next.convictionEncrypted || previous.convictionEncrypted || '',
  };
};

export const buildViewedResponseDecryptBaseline = (
  responseOverride: unknown,
  questionId: unknown,
  buildSliceFromUserAnswers: (value: unknown) => unknown,
) => {
  const qid = normalizeQuestionKey(questionId);
  if (!qid || !isObjectLike(responseOverride)) {
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
  surveyIndex: number,
  surveysResponseState: unknown,
  userAnswers: unknown,
  buildSliceFromUserAnswers: (value: unknown) => unknown,
  deepClone: (value: unknown) => unknown,
) => {
  const responseState = (surveysResponseState as unknown[]) || [];
  let baselineSlice = responseState[surveyIndex];
  if (!baselineSlice && userAnswers) {
    baselineSlice = buildSliceFromUserAnswers(userAnswers);
  }
  return {
    baselineSlice,
    baselineForDecrypt: deepClone(ensureQuestionDecryptSliceShape(baselineSlice)),
  };
};
