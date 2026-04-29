export const getQuestionEncryptionGates = (question: any): any[] => {
  const enc = question?.encryption;
  if (!enc || typeof enc !== 'object') return [];
  if (enc.enabled === false) return [];
  const gates = Array.isArray(enc.gates)
    ? enc.gates
    : (enc.gate && typeof enc.gate === 'object' ? [enc.gate] : []);
  return gates.filter((gate: any) => gate && typeof gate === 'object');
};

export const normalizeFieldAudienceMode = (
  value: any,
  fieldKey: string,
  field: any,
  hasMeaningfulFieldValue: (v: any) => boolean,
): string => {
  const normalizedFieldKey = String(fieldKey || '').trim().toLowerCase() === 'additional'
    ? 'additional'
    : 'answer';
  if (normalizedFieldKey !== 'additional') return 'explicit';

  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'inherit' || raw === 'follow' || raw === 'follow-answer') return 'inherit';
  if (raw === 'explicit') return 'explicit';

  const hasPersistedState =
    hasMeaningfulFieldValue(field) ||
    !!field?.encrypted ||
    !!field?.encryptedPortion ||
    !!field?.hash;
  return hasPersistedState ? 'explicit' : 'inherit';
};

export const buildInheritedAdditionalFieldState = (
  additionalField: any,
  answerField: any,
  questionId: string | null,
  deps: {
    resolveFieldEncryptionAudience: (field: any, qid: string | null, fieldKey: string) => string;
    resolveFieldEncryptionGateId: (field: any, qid: string | null, fieldKey: string) => any;
  },
): Record<string, any> => ({
  ...(additionalField && typeof additionalField === 'object' ? additionalField : {}),
  encrypted: !!answerField?.encrypted,
  encryptionAudience: deps.resolveFieldEncryptionAudience(answerField || {}, questionId, 'answer'),
  encryptionGateId: deps.resolveFieldEncryptionGateId(answerField || {}, questionId, 'answer'),
  audienceMode: 'inherit',
});

export const normalizeResponseEncryptionAudience = (
  value: any,
  questionId: string | null,
  deps: {
    isQuestionLocked: (qid: string) => boolean;
    getEffectiveRecipientsForQid: (qid: string) => any[];
    hasDefaultGateRecipients: () => boolean;
  },
): string => {
  const qid = questionId ? String(questionId).toLowerCase() : '';
  if (qid && deps.isQuestionLocked(qid)) return 'gate';

  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'gate') {
    if (qid) {
      return deps.getEffectiveRecipientsForQid(qid).length ? 'gate' : 'self';
    }
    return deps.hasDefaultGateRecipients() ? 'gate' : 'self';
  }
  return 'self';
};

export const buildEmptyResponseFieldState = (
  questionId: string | null,
  fieldKey: string,
  deps: {
    getDefaultAudienceForQid: (qid: string) => string;
    getDefaultAudience: () => string;
    resolveFieldEncryptionGateId: (field: any, qid: string | null, fieldKey: string) => any;
    normalizeFieldAudienceMode: (value: any, fieldKey: string, field: any) => string;
  },
): Record<string, any> => {
  const qid = questionId ? String(questionId).toLowerCase() : '';
  const audience = qid
    ? deps.getDefaultAudienceForQid(qid)
    : deps.getDefaultAudience();
  const gateId = audience === 'gate'
    ? deps.resolveFieldEncryptionGateId({ encryptionAudience: audience }, qid || null, fieldKey)
    : null;
  return {
    value: '',
    encrypted: audience === 'gate',
    encryptionAudience: audience,
    encryptionGateId: gateId,
    audienceMode: deps.normalizeFieldAudienceMode('', fieldKey, {}),
    encryptedPortion: '',
    hash: '',
  };
};

export const resolveFieldEncryptionAudience = (
  field: any,
  questionId: string | null,
  fieldKey: string,
  deps: {
    normalizeAudience: (value: any, qid: string | null) => string;
    getDefaultAudienceForQid: (qid: string) => string;
    getDefaultAudience: () => string;
  },
): string => {
  const qid = questionId ? String(questionId).toLowerCase() : '';
  if (field && typeof field === 'object' && field.encryptionAudience) {
    return deps.normalizeAudience(field.encryptionAudience, qid || null);
  }
  return qid
    ? deps.getDefaultAudienceForQid(qid)
    : deps.getDefaultAudience();
};

export const normalizeGateLabelText = (value: any): string => {
  const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!raw) return '';
  if (/^\[object\s+object\]$/i.test(raw)) return '';
  return raw;
};
