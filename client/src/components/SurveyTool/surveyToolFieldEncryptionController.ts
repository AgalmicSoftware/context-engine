import type { ResponseFieldState } from './surveyToolAudienceDerivationController';

export interface FieldEncryptionDeps {
  isQuestionLockedForResponse: (qid: string) => boolean;
  buildEmptyResponseFieldState: (qid: string, fieldKey?: string) => ResponseFieldState;
  resolveFieldEncryptionAudience: (field: ResponseFieldState, qid: string, fieldKey: string) => string;
  resolveFieldEncryptionGateId: (field: ResponseFieldState, qid: string | null, fieldKey: string) => string | null;
  normalizeFieldAudienceMode: (value: unknown, fieldKey: string, field: ResponseFieldState) => string;
  buildInheritedAdditionalFieldState: (
    additionalField: ResponseFieldState,
    answerField: ResponseFieldState,
    qid: string | null,
  ) => ResponseFieldState;
  normalizeResponseEncryptionAudience: (audience: unknown, qid: string) => string;
}

export interface EncryptionTogglePlan {
  nextFieldState: ResponseFieldState;
  nextAdditionalState: ResponseFieldState | null;
  clearMenus: boolean;
}

export interface AudienceSelectionPlan {
  nextAnswerState: ResponseFieldState;
  nextAdditionalState: ResponseFieldState;
}

type FieldKey = 'answer' | 'additional';
type FieldSliceKey = 'answers' | 'additionalComments';
type FieldSlice = {
  answers: Record<string, ResponseFieldState>;
  additionalComments: Record<string, ResponseFieldState>;
};

const FIELD_SLICE_KEYS: Record<FieldKey, FieldSliceKey> = {
  answer: 'answers',
  additional: 'additionalComments',
};

const getEmptyFieldState = (qid: string, fieldKey: FieldKey, deps: FieldEncryptionDeps): ResponseFieldState =>
  fieldKey === 'additional'
    ? deps.buildEmptyResponseFieldState(qid, 'additional')
    : deps.buildEmptyResponseFieldState(qid);

const getFieldState = (
  slice: FieldSlice,
  qid: string,
  fieldKey: FieldKey,
  deps: FieldEncryptionDeps,
): ResponseFieldState => {
  const sliceKey = FIELD_SLICE_KEYS[fieldKey];
  return {
    ...((slice?.[sliceKey] || {})[qid] || getEmptyFieldState(qid, fieldKey, deps)),
  };
};

const buildExplicitFieldState = ({
  baseFieldState,
  encrypted,
  encryptionAudience,
  encryptionGateId,
}: {
  baseFieldState: ResponseFieldState;
  encrypted: boolean;
  encryptionAudience: string;
  encryptionGateId: string | null;
}): ResponseFieldState => ({
  ...baseFieldState,
  encrypted,
  encryptionAudience,
  encryptionGateId,
  audienceMode: 'explicit',
});

const buildToggleFieldState = (
  qid: string,
  fieldKey: FieldKey,
  newEncryptedState: boolean,
  slice: FieldSlice,
  deps: FieldEncryptionDeps,
): {
  nextFieldState: ResponseFieldState;
  effectiveEncrypted: boolean;
} => {
  const locked = deps.isQuestionLockedForResponse(qid);
  const effectiveEncrypted = locked ? true : !!newEncryptedState;
  const currentFieldState = getFieldState(slice, qid, fieldKey, deps);
  const encryptionAudienceValue = locked
    ? 'gate'
    : effectiveEncrypted
      ? deps.resolveFieldEncryptionAudience(currentFieldState, qid, fieldKey)
      : 'self';
  const nextFieldState: ResponseFieldState = {
    ...currentFieldState,
    encrypted: effectiveEncrypted,
    encryptionAudience: encryptionAudienceValue,
    encryptionGateId:
      effectiveEncrypted && encryptionAudienceValue === 'gate'
        ? deps.resolveFieldEncryptionGateId(currentFieldState, qid, fieldKey)
        : null,
    audienceMode: 'explicit',
  };

  return {
    nextFieldState,
    effectiveEncrypted,
  };
};

const buildExplicitAudienceSelectionFieldState = (
  qid: string,
  fieldKey: FieldKey,
  audience: string,
  gateId: string,
  slice: FieldSlice,
  deps: FieldEncryptionDeps,
): ResponseFieldState => {
  const currentFieldState = getFieldState(slice, qid, fieldKey, deps);
  const rawAudience = String(audience || '')
    .trim()
    .toLowerCase();
  const normalizedAudience = rawAudience === 'gate' ? 'gate' : deps.normalizeResponseEncryptionAudience(audience, qid);
  const normalizedGateId =
    normalizedAudience === 'gate'
      ? deps.resolveFieldEncryptionGateId(
          {
            encryptionAudience: normalizedAudience,
            encryptionGateId: gateId || '',
          },
          qid,
          fieldKey,
        ) ||
        String(gateId || '').trim() ||
        null
      : null;

  return buildExplicitFieldState({
    baseFieldState: currentFieldState,
    encrypted: true,
    encryptionAudience: normalizedAudience,
    encryptionGateId: normalizedGateId,
  });
};

export const buildEncryptionTogglePlan = (
  qid: string,
  fieldKey: 'answer' | 'additional',
  newEncryptedState: boolean,
  slice: FieldSlice,
  deps: FieldEncryptionDeps,
): EncryptionTogglePlan => {
  const { nextFieldState, effectiveEncrypted } = buildToggleFieldState(qid, fieldKey, newEncryptedState, slice, deps);

  let nextAdditionalState: ResponseFieldState | null = null;
  if (fieldKey === 'answer') {
    const currentAdditionalState = getFieldState(slice, qid, 'additional', deps);
    if (
      deps.normalizeFieldAudienceMode(currentAdditionalState.audienceMode, 'additional', currentAdditionalState) !==
      'explicit'
    ) {
      nextAdditionalState = deps.buildInheritedAdditionalFieldState(currentAdditionalState, nextFieldState, qid);
    }
  }

  return {
    nextFieldState,
    nextAdditionalState,
    clearMenus: !effectiveEncrypted,
  };
};

export const buildAnswerAudienceSelectionPlan = (
  qid: string,
  audience: string,
  gateId: string,
  slice: FieldSlice,
  deps: FieldEncryptionDeps,
): AudienceSelectionPlan => {
  const nextAnswerState = buildExplicitAudienceSelectionFieldState(qid, 'answer', audience, gateId, slice, deps);
  const currentAdditionalState = getFieldState(slice, qid, 'additional', deps);
  const nextAdditionalMode = deps.normalizeFieldAudienceMode(
    currentAdditionalState.audienceMode,
    'additional',
    currentAdditionalState,
  );

  const nextAdditionalState =
    nextAdditionalMode !== 'explicit'
      ? deps.buildInheritedAdditionalFieldState(currentAdditionalState, nextAnswerState, qid)
      : currentAdditionalState;

  return {
    nextAnswerState,
    nextAdditionalState,
  };
};

export const buildAdditionalAudienceSelectionPlan = (
  qid: string,
  audience: string,
  gateId: string,
  slice: FieldSlice,
  deps: FieldEncryptionDeps,
): { nextAdditionalState: ResponseFieldState } => {
  const nextAnswerState = getFieldState(slice, qid, 'answer', deps);
  const nextAdditionalState = getFieldState(slice, qid, 'additional', deps);
  const rawAudience = String(audience || '')
    .trim()
    .toLowerCase();

  if (rawAudience === 'inherit' || rawAudience === 'follow' || rawAudience === 'follow-answer') {
    return {
      nextAdditionalState: deps.buildInheritedAdditionalFieldState(nextAdditionalState, nextAnswerState, qid),
    };
  }

  if (rawAudience === 'none' || rawAudience === 'plaintext' || rawAudience === 'not-encrypted') {
    return {
      nextAdditionalState: buildExplicitFieldState({
        baseFieldState: nextAdditionalState,
        encrypted: false,
        encryptionAudience: 'self',
        encryptionGateId: null,
      }),
    };
  }

  return {
    nextAdditionalState: buildExplicitAudienceSelectionFieldState(qid, 'additional', rawAudience, gateId, slice, deps),
  };
};
