export interface FieldEncryptionDeps {
  isQuestionLockedForResponse: (qid: string) => boolean;
  buildEmptyResponseFieldState: (qid: string, fieldKey?: string) => Record<string, any>;
  resolveFieldEncryptionAudience: (field: any, qid: string, fieldKey: string) => string;
  resolveFieldEncryptionGateId: (field: any, qid: string | null, fieldKey: string) => string | null;
  normalizeFieldAudienceMode: (value: any, fieldKey: string, field: any) => string;
  buildInheritedAdditionalFieldState: (additionalField: any, answerField: any, qid: string | null) => Record<string, any>;
  normalizeResponseEncryptionAudience: (audience: any, qid: string) => string;
}

export interface EncryptionTogglePlan {
  nextFieldState: Record<string, any>;
  nextAdditionalState: Record<string, any> | null;
  clearMenus: boolean;
}

export interface AudienceSelectionPlan {
  nextAnswerState: Record<string, any>;
  nextAdditionalState: Record<string, any>;
}

type FieldKey = 'answer' | 'additional';
type FieldSliceKey = 'answers' | 'additionalComments';
type FieldSlice = {
  answers: Record<string, any>;
  additionalComments: Record<string, any>;
};

const FIELD_SLICE_KEYS: Record<FieldKey, FieldSliceKey> = {
  answer: 'answers',
  additional: 'additionalComments',
};

const getEmptyFieldState = (
  qid: string,
  fieldKey: FieldKey,
  deps: FieldEncryptionDeps,
): Record<string, any> => (
  fieldKey === 'additional'
    ? deps.buildEmptyResponseFieldState(qid, 'additional')
    : deps.buildEmptyResponseFieldState(qid)
);

const getFieldState = (
  slice: FieldSlice,
  qid: string,
  fieldKey: FieldKey,
  deps: FieldEncryptionDeps,
): Record<string, any> => {
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
  baseFieldState: Record<string, any>;
  encrypted: boolean;
  encryptionAudience: string;
  encryptionGateId: string | null;
}): Record<string, any> => ({
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
  nextFieldState: Record<string, any>;
  effectiveEncrypted: boolean;
} => {
  const locked = deps.isQuestionLockedForResponse(qid);
  const effectiveEncrypted = locked ? true : !!newEncryptedState;
  const currentFieldState = getFieldState(slice, qid, fieldKey, deps);
  const encryptionAudienceValue = locked
    ? 'gate'
    : (effectiveEncrypted ? deps.resolveFieldEncryptionAudience(currentFieldState, qid, fieldKey) : 'self');
  const nextFieldState: Record<string, any> = {
    ...currentFieldState,
    encrypted: effectiveEncrypted,
    encryptionAudience: encryptionAudienceValue,
    encryptionGateId: effectiveEncrypted && encryptionAudienceValue === 'gate'
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
  normalizedAudience: string,
  gateId: string,
  slice: FieldSlice,
  deps: FieldEncryptionDeps,
): Record<string, any> => {
  const currentFieldState = getFieldState(slice, qid, fieldKey, deps);
  const normalizedGateId = normalizedAudience === 'gate'
    ? deps.resolveFieldEncryptionGateId({
        encryptionAudience: normalizedAudience,
        encryptionGateId: gateId || '',
      }, qid, fieldKey)
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
  slice: { answers: Record<string, any>; additionalComments: Record<string, any> },
  deps: FieldEncryptionDeps,
): EncryptionTogglePlan => {
  const { nextFieldState, effectiveEncrypted } = buildToggleFieldState(
    qid,
    fieldKey,
    newEncryptedState,
    slice,
    deps,
  );

  let nextAdditionalState: Record<string, any> | null = null;
  if (fieldKey === 'answer') {
    const currentAdditionalState = getFieldState(slice, qid, 'additional', deps);
    if (
      deps.normalizeFieldAudienceMode(
        currentAdditionalState.audienceMode,
        'additional',
        currentAdditionalState,
      ) !== 'explicit'
    ) {
      nextAdditionalState = deps.buildInheritedAdditionalFieldState(
        currentAdditionalState,
        nextFieldState,
        qid,
      );
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
  slice: { answers: Record<string, any>; additionalComments: Record<string, any> },
  deps: FieldEncryptionDeps,
): AudienceSelectionPlan => {
  const normalizedAudience = deps.normalizeResponseEncryptionAudience(audience, qid);
  const nextAnswerState = buildExplicitAudienceSelectionFieldState(
    qid,
    'answer',
    normalizedAudience,
    gateId,
    slice,
    deps,
  );
  const currentAdditionalState = getFieldState(slice, qid, 'additional', deps);
  const nextAdditionalMode = deps.normalizeFieldAudienceMode(
    currentAdditionalState.audienceMode,
    'additional',
    currentAdditionalState,
  );

  const nextAdditionalState = nextAdditionalMode !== 'explicit'
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
  slice: { answers: Record<string, any>; additionalComments: Record<string, any> },
  deps: FieldEncryptionDeps,
): { nextAdditionalState: Record<string, any> } => {
  const nextAnswerState = getFieldState(slice, qid, 'answer', deps);
  const nextAdditionalState = getFieldState(slice, qid, 'additional', deps);
  const rawAudience = String(audience || '').trim().toLowerCase();

  if (rawAudience === 'inherit' || rawAudience === 'follow' || rawAudience === 'follow-answer') {
    return {
      nextAdditionalState: deps.buildInheritedAdditionalFieldState(
        nextAdditionalState,
        nextAnswerState,
        qid,
      ),
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

  const normalizedAudience = deps.normalizeResponseEncryptionAudience(rawAudience, qid);
  return {
    nextAdditionalState: buildExplicitAudienceSelectionFieldState(
      qid,
      'additional',
      normalizedAudience,
      gateId,
      slice,
      deps,
    ),
  };
};
