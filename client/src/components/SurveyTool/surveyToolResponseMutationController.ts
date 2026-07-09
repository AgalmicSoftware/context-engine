import type { UnknownRecord } from './surveyToolTypes';

export interface ResponseFieldState {
  value?: unknown;
  encrypted?: boolean;
  encryptionAudience?: string;
  encryptionGateId?: string | null;
  audienceMode?: string;
  hash?: string;
  encryptedPortion?: string;
  [key: string]: unknown;
}

export interface MutationDeps {
  buildEmptyResponseFieldState: (qid: string, fieldKey?: string) => ResponseFieldState;
  resolveFieldEncryptionAudience: (field: ResponseFieldState, qid: string, fieldKey?: string) => string;
  resolveFieldEncryptionGateId: (field: ResponseFieldState, qid: string | null, fieldKey: string) => string | null;
  isQuestionLockedForResponse: (qid: string) => boolean;
  getEffectiveRecipientsForQid: (qid: string) => unknown[];
  normalizeFieldAudienceMode: (value: unknown, fieldKey: string, field: ResponseFieldState) => string;
  buildInheritedAdditionalFieldState: (
    additionalField: ResponseFieldState,
    answerField: ResponseFieldState,
    qid: string | null,
  ) => ResponseFieldState;
  valuesEqual: (a: unknown, b: unknown) => boolean;
  getQuestionById: (qid: string) => UnknownRecord | null | undefined;
  computeHash: (value: string) => string;
}

type MutationSourceSlice = {
  answers: Record<string, ResponseFieldState>;
  additionalComments: Record<string, ResponseFieldState>;
};

export const resolveFieldEncryptionDefaults = (
  prevFieldState: ResponseFieldState,
  questionId: string,
  fieldKey: string,
  deps: Pick<
    MutationDeps,
    | 'isQuestionLockedForResponse'
    | 'resolveFieldEncryptionAudience'
    | 'getEffectiveRecipientsForQid'
    | 'resolveFieldEncryptionGateId'
  >,
): {
  questionLocked: boolean;
  resolvedAudience: string;
  resolvedGateId: string | null;
  nextEncrypted: boolean;
} => {
  const questionLocked = deps.isQuestionLockedForResponse(questionId);
  const previousAudience = deps.resolveFieldEncryptionAudience(prevFieldState, questionId, fieldKey);
  const isUntouchedPlainSelfDefault =
    previousAudience === 'self' &&
    prevFieldState.encrypted === false &&
    (prevFieldState.value === undefined ||
      prevFieldState.value === null ||
      String(prevFieldState.value).length === 0) &&
    !prevFieldState.encryptedPortion &&
    !prevFieldState.hash &&
    !prevFieldState.encryptionGateId;
  const effectivePreviousAudience = isUntouchedPlainSelfDefault ? '' : previousAudience;
  const hasExistingEncryptionState = typeof prevFieldState.encrypted === 'boolean' && !!effectivePreviousAudience;
  const autoEncrypt =
    questionLocked || (hasExistingEncryptionState ? false : deps.getEffectiveRecipientsForQid(questionId).length > 0);
  const defaultAudience = autoEncrypt ? 'gate' : 'self';
  const resolvedAudience = questionLocked ? 'gate' : effectivePreviousAudience || defaultAudience;
  const resolvedGateId =
    questionLocked || resolvedAudience === 'gate'
      ? deps.resolveFieldEncryptionGateId(prevFieldState, questionId, fieldKey)
      : null;
  const nextEncrypted = questionLocked ? true : hasExistingEncryptionState ? !!prevFieldState.encrypted : autoEncrypt;

  return {
    questionLocked,
    resolvedAudience,
    resolvedGateId,
    nextEncrypted,
  };
};

export interface AnswerUpdatePlan {
  changed: boolean;
  nextAnswerState: ResponseFieldState;
  nextAdditionalState: ResponseFieldState | null;
}

export const buildAnswerUpdatePlan = (
  questionId: string,
  answer: unknown,
  sourceSlice: MutationSourceSlice,
  deps: MutationDeps,
): AnswerUpdatePlan => {
  const prevAnswerState = sourceSlice.answers?.[questionId] || deps.buildEmptyResponseFieldState(questionId);
  const question = deps.getQuestionById(questionId);
  const isBinaryQuestion = !!(question && question.type === 'binary');
  const currentAnswer = prevAnswerState.value;

  let finalAnswer = answer;
  if (isBinaryQuestion && deps.valuesEqual(currentAnswer, answer)) {
    finalAnswer = '';
  }

  const previousAudience = deps.resolveFieldEncryptionAudience(prevAnswerState, questionId, 'answer');
  const { resolvedAudience, resolvedGateId, nextEncrypted } = resolveFieldEncryptionDefaults(
    prevAnswerState,
    questionId,
    'answer',
    deps,
  );

  const shouldHash = !Array.isArray(finalAnswer) && typeof finalAnswer !== 'number' && !isBinaryQuestion;
  const hasExistingHash = typeof prevAnswerState.hash === 'string' && prevAnswerState.hash.length > 0;
  const unchangedValue = deps.valuesEqual(currentAnswer, finalAnswer);
  const unchangedEncryption =
    !!prevAnswerState.encrypted === !!nextEncrypted &&
    (previousAudience || '') === (resolvedAudience || '') &&
    String(prevAnswerState.encryptionGateId || '') === String(resolvedGateId || '');

  // Regression guard: unchanged writes must preserve existing hashes so wrappers do not
  // mark the draft dirty when the serialized response payload is identical.
  if (unchangedValue && unchangedEncryption && (!shouldHash || hasExistingHash)) {
    return {
      changed: false,
      nextAnswerState: prevAnswerState,
      nextAdditionalState: null,
    };
  }

  const answerStr =
    Array.isArray(finalAnswer) || typeof finalAnswer === 'number'
      ? JSON.stringify(finalAnswer)
      : String(finalAnswer ?? '');
  const newAnswerHash = shouldHash ? deps.computeHash(answerStr) : '';

  const nextAnswerState: ResponseFieldState = {
    ...prevAnswerState,
    value: finalAnswer,
    encrypted: nextEncrypted,
    encryptionAudience: resolvedAudience,
    encryptionGateId: resolvedGateId,
    audienceMode: 'explicit',
    hash: newAnswerHash,
  };

  const prevAdditionalState =
    sourceSlice.additionalComments?.[questionId] || deps.buildEmptyResponseFieldState(questionId, 'additional');

  let nextAdditionalState: ResponseFieldState | null = null;
  if (
    deps.normalizeFieldAudienceMode(prevAdditionalState.audienceMode, 'additional', prevAdditionalState) !== 'explicit'
  ) {
    // Keep inherited additional encryption aligned with the updated answer unless the
    // field has explicitly opted out of inheritance.
    nextAdditionalState = deps.buildInheritedAdditionalFieldState(prevAdditionalState, nextAnswerState, questionId);
  }

  return {
    changed: true,
    nextAnswerState,
    nextAdditionalState,
  };
};

export interface AdditionalUpdatePlan {
  changed: boolean;
  nextAdditionalState: ResponseFieldState;
}

export const buildAdditionalUpdatePlan = (
  questionId: string,
  additionalComments: unknown,
  sourceSlice: MutationSourceSlice,
  deps: MutationDeps,
): AdditionalUpdatePlan => {
  const inheritedAnswerState = sourceSlice.answers?.[questionId] || deps.buildEmptyResponseFieldState(questionId);
  const baseAdditionalState =
    sourceSlice.additionalComments?.[questionId] || deps.buildEmptyResponseFieldState(questionId, 'additional');
  const additionalAudienceMode = deps.normalizeFieldAudienceMode(
    baseAdditionalState.audienceMode,
    'additional',
    baseAdditionalState,
  );
  const prevAdditionalState =
    additionalAudienceMode === 'inherit'
      ? deps.buildInheritedAdditionalFieldState(baseAdditionalState, inheritedAnswerState, questionId)
      : baseAdditionalState;
  const currentValue = prevAdditionalState.value;
  const normalizedAdditional = String(additionalComments ?? '');

  const previousAudience = deps.resolveFieldEncryptionAudience(prevAdditionalState, questionId, 'additional');
  const { resolvedAudience, resolvedGateId, nextEncrypted } = resolveFieldEncryptionDefaults(
    prevAdditionalState,
    questionId,
    'additional',
    deps,
  );

  const unchangedValue = deps.valuesEqual(currentValue, normalizedAdditional);
  const unchangedEncryption =
    !!prevAdditionalState.encrypted === !!nextEncrypted &&
    (previousAudience || '') === (resolvedAudience || '') &&
    String(prevAdditionalState.encryptionGateId || '') === String(resolvedGateId || '') &&
    deps.normalizeFieldAudienceMode(prevAdditionalState.audienceMode, 'additional', prevAdditionalState) ===
      additionalAudienceMode;
  const hasExistingHash = typeof prevAdditionalState.hash === 'string' && prevAdditionalState.hash.length > 0;

  if (unchangedValue && unchangedEncryption && hasExistingHash) {
    return {
      changed: false,
      nextAdditionalState: prevAdditionalState,
    };
  }

  const newAdditionalHash = deps.computeHash(normalizedAdditional);
  const nextAdditionalState: ResponseFieldState = {
    ...prevAdditionalState,
    value: normalizedAdditional,
    encrypted: nextEncrypted,
    encryptionAudience: resolvedAudience,
    encryptionGateId: resolvedGateId,
    audienceMode: additionalAudienceMode,
    hash: newAdditionalHash,
  };

  return {
    changed: true,
    nextAdditionalState,
  };
};
