import type { UnknownRecord } from './surveyToolTypes';

export type ResponseFieldState = UnknownRecord & {
  audienceMode?: unknown;
  encrypted?: unknown;
  encryptedPortion?: unknown;
  encryptionAudience?: unknown;
  encryptionGateId?: unknown;
  hash?: unknown;
  value?: unknown;
};

type EncryptionConfig = UnknownRecord & {
  enabled?: unknown;
  gate?: unknown;
  gates?: unknown;
};

const isObjectRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asResponseFieldState = (value: unknown): ResponseFieldState =>
  isObjectRecord(value) ? (value as ResponseFieldState) : {};

export const getQuestionEncryptionGates = (question: unknown): UnknownRecord[] => {
  const questionRecord = isObjectRecord(question) ? question : {};
  const enc = isObjectRecord(questionRecord.encryption) ? (questionRecord.encryption as EncryptionConfig) : null;
  if (!enc) return [];
  if (enc.enabled === false) return [];
  const gates = Array.isArray(enc.gates) ? enc.gates : isObjectRecord(enc.gate) ? [enc.gate] : [];
  return gates.filter(isObjectRecord);
};

export const normalizeFieldAudienceMode = (
  value: unknown,
  fieldKey: string,
  field: unknown,
  hasMeaningfulFieldValue: (v: unknown) => boolean,
): string => {
  const normalizedFieldKey =
    String(fieldKey || '')
      .trim()
      .toLowerCase() === 'additional'
      ? 'additional'
      : 'answer';
  if (normalizedFieldKey !== 'additional') return 'explicit';

  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (raw === 'inherit' || raw === 'follow' || raw === 'follow-answer') return 'inherit';
  if (raw === 'explicit') return 'explicit';
  const fieldState = asResponseFieldState(field);

  const hasPersistedState =
    hasMeaningfulFieldValue(field) || !!fieldState.encrypted || !!fieldState.encryptedPortion || !!fieldState.hash;
  if (hasPersistedState) return 'explicit';

  // Regression guard: blank comments are independent by default. Only an explicit
  // follow/inherit selection may mirror the answer lock into the comments field.
  return 'explicit';
};

export const buildInheritedAdditionalFieldState = (
  additionalField: unknown,
  answerField: unknown,
  questionId: string | null,
  deps: {
    resolveFieldEncryptionAudience: (field: ResponseFieldState, qid: string | null, fieldKey: string) => string;
    resolveFieldEncryptionGateId: (field: ResponseFieldState, qid: string | null, fieldKey: string) => unknown;
  },
): ResponseFieldState => {
  const answerState = asResponseFieldState(answerField);
  return {
    ...(isObjectRecord(additionalField) ? additionalField : {}),
    encrypted: !!answerState.encrypted,
    encryptionAudience: deps.resolveFieldEncryptionAudience(answerState, questionId, 'answer'),
    encryptionGateId: deps.resolveFieldEncryptionGateId(answerState, questionId, 'answer'),
    audienceMode: 'inherit',
  };
};

export const normalizeResponseEncryptionAudience = (
  value: unknown,
  questionId: string | null,
  deps: {
    isQuestionLocked: (qid: string) => boolean;
    getEffectiveRecipientsForQid: (qid: string) => unknown[];
    hasDefaultGateRecipients: () => boolean;
  },
): string => {
  const qid = questionId ? String(questionId).toLowerCase() : '';
  if (qid && deps.isQuestionLocked(qid)) return 'gate';

  const raw = String(value || '')
    .trim()
    .toLowerCase();
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
    resolveFieldEncryptionGateId: (field: ResponseFieldState, qid: string | null, fieldKey: string) => unknown;
    normalizeFieldAudienceMode: (value: unknown, fieldKey: string, field: ResponseFieldState) => string;
  },
): ResponseFieldState => {
  const qid = questionId ? String(questionId).toLowerCase() : '';
  const audience = qid ? deps.getDefaultAudienceForQid(qid) : deps.getDefaultAudience();
  const gateId =
    audience === 'gate'
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
  field: unknown,
  questionId: string | null,
  fieldKey: string,
  deps: {
    normalizeAudience: (value: unknown, qid: string | null) => string;
    getDefaultAudienceForQid: (qid: string) => string;
    getDefaultAudience: () => string;
  },
): string => {
  const qid = questionId ? String(questionId).toLowerCase() : '';
  const fieldState = asResponseFieldState(field);
  if (fieldState.encryptionAudience) {
    if (
      String(fieldState.encryptionAudience || '')
        .trim()
        .toLowerCase() === 'gate' &&
      String(fieldState.encryptionGateId || '').trim()
    ) {
      return 'gate';
    }
    return deps.normalizeAudience(fieldState.encryptionAudience, qid || null);
  }
  return qid ? deps.getDefaultAudienceForQid(qid) : deps.getDefaultAudience();
};

export const normalizeGateLabelText = (value: unknown): string => {
  const raw = (typeof value === 'string' ? value : value == null ? '' : String(value)).trim();
  if (!raw) return '';
  if (/^\[object\s+object\]$/i.test(raw)) return '';
  return raw;
};
