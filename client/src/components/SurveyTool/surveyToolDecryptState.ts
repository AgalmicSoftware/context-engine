type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const getRecord = (value: unknown): UnknownRecord => (isRecord(value) ? value : {});

const firstDefined = (...values: unknown[]): unknown => {
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] !== undefined) return values[i];
  }
  return undefined;
};

const normalizeField = (field: unknown, fallbackValue: unknown): UnknownRecord => {
  const nextField = isRecord(field) ? { ...field } : {};
  const scalar = field != null && typeof field !== 'object' ? field : undefined;
  const value = firstDefined(nextField.value, scalar, fallbackValue);
  if (value !== undefined) nextField.value = value;
  return nextField;
};

export const buildEmptyQuestionDecryptSlice = () => ({
  answers: {},
  importance: {},
  conviction: {},
  additionalComments: {},
});

export const parseEncryptedEnvelope = (field: unknown = null): unknown | null => {
  try {
    const encryptedPortion = getRecord(field).encryptedPortion;
    return encryptedPortion ? JSON.parse(String(encryptedPortion)) : null;
  } catch {
    return null;
  }
};

export const buildFieldDecryptState = (
  field: unknown = null,
  {
    loginComplete = false,
    account = '',
    busy = false,
  }: { loginComplete?: boolean; account?: string; busy?: boolean } = {},
) => {
  const record = getRecord(field);
  const envelope = parseEncryptedEnvelope(record);
  const masked = !!(record.value === '*' && (record.encryptedPortion || record.encrypted));
  const allowDecrypt = masked && (!!envelope || (!!loginComplete && !!account));

  return {
    envelope,
    masked,
    allowDecrypt,
    busy: !!busy,
  };
};

export const buildQuestionFieldDisplayState = ({
  answer = null,
  additional = null,
  answerDecryptState = null,
  additionalDecryptState = null,
  hasAdditionalContent = false,
  decryptTooltip = 'Login to decrypt this encrypted field.',
}: {
  answer?: unknown;
  additional?: unknown;
  answerDecryptState?: unknown;
  additionalDecryptState?: unknown;
  hasAdditionalContent?: boolean;
  decryptTooltip?: string;
} = {}) => {
  const answerRecord = getRecord(answer);
  const additionalRecord = getRecord(additional);
  return {
    answerDecryptState: answerDecryptState || buildFieldDecryptState(answer),
    additionalDecryptState: additionalDecryptState || buildFieldDecryptState(additional),
    hasAdditionalContent: !!hasAdditionalContent,
    glowAnswer: !!answerRecord.encrypted,
    glowAdditional: !!(additionalRecord.encrypted && hasAdditionalContent),
    decryptTooltip,
  };
};

export const buildQuestionResponseDisplayState = ({
  answer = null,
  additional = null,
  convictionValue = null,
  importanceValue = null,
  hasConvictionImportanceValue = false,
  sliderMode = 'conviction',
}: {
  answer?: unknown;
  additional?: unknown;
  convictionValue?: unknown;
  importanceValue?: unknown;
  hasConvictionImportanceValue?: boolean;
  sliderMode?: string;
} = {}) => ({
  answer,
  additional,
  convictionValue,
  importanceValue,
  hasConvictionImportanceValue: !!hasConvictionImportanceValue,
  sliderMode,
  activeSliderValue: sliderMode === 'importance' ? importanceValue : convictionValue,
});

export const buildQuestionRenderDisplayState = ({
  responseDisplayState = {},
  fieldDisplayState = {},
}: {
  responseDisplayState?: UnknownRecord;
  fieldDisplayState?: UnknownRecord;
} = {}) => {
  const answerDecryptState = getRecord(fieldDisplayState.answerDecryptState);
  const additionalDecryptState = getRecord(fieldDisplayState.additionalDecryptState);
  return {
    ...responseDisplayState,
    ...fieldDisplayState,
    maskedAnswer: !!answerDecryptState.masked,
    maskedAdditional: !!additionalDecryptState.masked,
    allowDecryptAnswer: !!answerDecryptState.allowDecrypt,
    allowDecryptAdditional: !!additionalDecryptState.allowDecrypt,
    isAnswerDecrypting: !!answerDecryptState.busy,
    isAdditionalDecrypting: !!additionalDecryptState.busy,
  };
};

export const buildQuestionFieldDecryptControlDisplayState = ({
  actionLabel = 'Decrypt Answer',
  allowDecrypt = false,
  autoDecryptEnabled = false,
  busy = false,
  decryptTooltip = 'Login to decrypt this encrypted field.',
  isDecrypting = false,
  showBusySpinnerWhenAutoDecryptEnabled = false,
  wrapperStyle = undefined,
}: {
  actionLabel?: string;
  allowDecrypt?: boolean;
  autoDecryptEnabled?: boolean;
  busy?: boolean;
  decryptTooltip?: string;
  isDecrypting?: boolean;
  showBusySpinnerWhenAutoDecryptEnabled?: boolean;
  wrapperStyle?: unknown;
} = {}) => ({
  actionLabel,
  autoDecryptEnabled: !!autoDecryptEnabled,
  busy: !!busy,
  disabled: !!isDecrypting || !allowDecrypt,
  showBusySpinnerWhenAutoDecryptEnabled: !!showBusySpinnerWhenAutoDecryptEnabled,
  title: !allowDecrypt ? decryptTooltip : undefined,
  wrapperStyle,
});

export const buildAutoDecryptMaskedFieldSignature = (field: unknown = null): string => {
  if (!isRecord(field)) return '';
  return [
    String(field.value ?? ''),
    field.encrypted ? '1' : '0',
    String(field.encryptedPortion || ''),
    String(field.hash || ''),
    String(field.encryptionAudience || ''),
  ].join('|');
};

export const buildDecryptTaskKey = (
  mode: unknown,
  questionId: unknown,
  fieldToDecrypt: unknown = 'both',
  responseOverride: unknown = null,
  defaultResponder = '',
): string => {
  const overrideRecord = getRecord(responseOverride);
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  const field = String(fieldToDecrypt || 'both')
    .trim()
    .toLowerCase();
  const responder = String(overrideRecord.responder || overrideRecord.responderAddress || defaultResponder || '')
    .trim()
    .toLowerCase();
  const answerSig = buildAutoDecryptMaskedFieldSignature(overrideRecord.answer);
  const additionalSig = buildAutoDecryptMaskedFieldSignature(overrideRecord.additional);
  return [String(mode || 'self'), qid, field, responder, answerSig, additionalSig].join('|');
};

export const normalizeSingleQuestionViewedResponse = (rawResponse: unknown = null): UnknownRecord | null => {
  if (rawResponse == null) return null;

  if (!isRecord(rawResponse)) {
    return {
      answer: { value: rawResponse },
      additional: { value: '' },
    };
  }

  const nestedResponse = isRecord(rawResponse.response) ? rawResponse.response : null;
  const base = nestedResponse ? { ...rawResponse, ...nestedResponse } : { ...rawResponse };

  const answerFallback = firstDefined(
    base.answerValue,
    base.value,
    base.responseValue,
    base.answerText,
    base.responseText,
    base.answer == null &&
      (typeof base.response === 'string' || typeof base.response === 'number' || typeof base.response === 'boolean')
      ? base.response
      : undefined,
  );
  const additionalFallback = firstDefined(
    base.additionalComment,
    base.additionalComments,
    base.comment,
    base.comments,
    base.additionalText,
  );

  const normalized = {
    ...base,
    answer: normalizeField(base.answer, answerFallback),
    additional: normalizeField(base.additional, additionalFallback),
  };
  const hasShapeHints = !!(
    base.answer !== undefined ||
    base.additional !== undefined ||
    answerFallback !== undefined ||
    additionalFallback !== undefined ||
    base.importance !== undefined ||
    base.conviction !== undefined ||
    base.storageRef ||
    base.arweaveTxId ||
    base.transactionHash ||
    base.txHash ||
    base.blockNumber !== undefined ||
    base.transactionIndex !== undefined ||
    base.logIndex !== undefined ||
    base.timestamp !== undefined
  );
  return hasShapeHints ? normalized : null;
};

export const getViewedResponseOverrideForQuestion = (
  questionId: unknown,
  responseContainer: unknown,
  viewedResponder = '',
): UnknownRecord | null => {
  const qid = String(questionId || '')
    .trim()
    .toLowerCase();
  if (!qid || !isRecord(responseContainer)) return null;
  const normalizedViewedResponder = String(viewedResponder || '')
    .trim()
    .toLowerCase();

  const decorateResponse = (rawResponse: unknown): UnknownRecord | null => {
    if (!isRecord(rawResponse)) return null;
    const next = { ...rawResponse };
    const rawId = String(next.questionID || next.questionId || '')
      .trim()
      .toLowerCase();
    if (rawId && rawId !== qid) return null;
    if (!next.questionID && !next.questionId) next.questionID = qid;
    if (normalizedViewedResponder) {
      if (!next.responder) next.responder = normalizedViewedResponder;
      if (!next.responderAddress) next.responderAddress = normalizedViewedResponder;
    }
    return next;
  };

  if (Array.isArray(responseContainer.responses)) {
    for (const response of responseContainer.responses) {
      const decorated = decorateResponse(response);
      if (decorated) return decorated;
    }
    return null;
  }

  return decorateResponse(responseContainer);
};

export const resolveQuestionDecryptHandlingMode = (
  { questionId, responseOverride = null, viewerAccount = '', viewedResponder = '' }: UnknownRecord = {},
  {
    getViewedResponseOverrideForQuestion: resolveOverride,
  }: { getViewedResponseOverrideForQuestion?: (questionId: unknown) => unknown } = {},
) => {
  const viewerLower = String(viewerAccount || '')
    .trim()
    .toLowerCase();
  const viewedResponderLower = String(viewedResponder || '')
    .trim()
    .toLowerCase();
  const resolveOverridePort = resolveOverride as (questionId: unknown) => unknown;
  const effectiveResponseOverride =
    responseOverride && isRecord(responseOverride) ? responseOverride : resolveOverridePort(questionId);
  const hasResponseOverride = !!(effectiveResponseOverride && isRecord(effectiveResponseOverride));
  const isViewedResponseMode = !!viewedResponderLower && viewedResponderLower !== viewerLower;

  return {
    viewerLower,
    viewedResponderLower,
    effectiveResponseOverride,
    hasResponseOverride,
    isViewedResponseMode,
  };
};

export const resolveDecryptSurveyId = (
  baselineForDecrypt: unknown,
  { propSurveyId = '', questionId = null, defaultSurveyId = '' }: UnknownRecord = {},
): unknown => {
  if (propSurveyId) return propSurveyId;

  const getEnvelopeSurveyId = (field: unknown) => {
    const envelope = getRecord(parseEncryptedEnvelope(field));
    return getRecord(envelope.aad).surveyId || null;
  };

  const normalizedQuestionId = questionId == null ? '' : String(questionId).trim().toLowerCase();
  const baseline = getRecord(baselineForDecrypt);
  const answers = getRecord(baseline.answers);
  const additionalComments = getRecord(baseline.additionalComments);

  if (normalizedQuestionId) {
    const scopedSurveyId =
      getEnvelopeSurveyId(answers[normalizedQuestionId]) ||
      getEnvelopeSurveyId(additionalComments[normalizedQuestionId]);
    if (scopedSurveyId) return scopedSurveyId;
  }

  const containers = [answers, additionalComments];

  for (const container of containers) {
    for (const key of Object.keys(container)) {
      const surveyId = getEnvelopeSurveyId(container[key]);
      if (surveyId) return surveyId;
    }
  }

  return defaultSurveyId;
};
