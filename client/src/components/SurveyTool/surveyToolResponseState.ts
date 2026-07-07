import { createLogger } from 'utilities/logging.js';
import { normalizeRatingValue, RATING_MIN } from '../../utilities/survey/ratingValue.js';
import { normalizeQuestionIdKey } from './surveyToolSignatures.js';
import type { UnknownRecord } from './surveyToolTypes.js';

type RatingResponse = {
  answer?: unknown;
  additional?: unknown;
  conviction?: unknown;
  importance?: unknown;
} & UnknownRecord;

type RatingSlice = {
  conviction?: Record<string, unknown> | null;
  importance?: Record<string, unknown> | null;
} & UnknownRecord;

type MultichoiceQuestion = {
  type?: unknown;
  singleSelect?: unknown;
  oneSelectionOnly?: unknown;
  singleChoice?: unknown;
} & UnknownRecord;

type QuestionResponseHydrationDeps = {
  parseValue?: ((value: unknown) => unknown) | null;
  areEnvelopesEquivalent?:
    | ((
        incomingEnvelope: unknown,
        currentEnvelope: unknown,
        incomingEncrypted?: unknown,
        currentEncrypted?: unknown,
      ) => boolean)
    | null;
  normalizeResponseEncryptionAudience?: ((audience: unknown, questionId?: string) => unknown) | null;
  getDefaultResponseEncryptionAudienceForQid?: ((questionId?: string) => unknown) | null;
  resolveFieldEncryptionGateId?: ((field: UnknownRecord, questionId?: string, fieldKey?: string) => unknown) | null;
  normalizeFieldAudienceMode?: ((audienceMode: unknown, fieldKey?: string, field?: UnknownRecord) => unknown) | null;
  buildInheritedAdditionalFieldState?:
    ((additionalState: UnknownRecord, answerState: UnknownRecord, questionId?: string) => UnknownRecord) | null;
  buildEmptyResponseFieldState?: ((questionId?: string, fieldKey?: string) => UnknownRecord) | null;
};

type BuildQuestionResponseHydrationPatchArgs = {
  questionId?: unknown;
  response?: RatingResponse | null;
  currentAnswer?: UnknownRecord | null;
  currentAdditional?: UnknownRecord | null;
  hasCurrentImportance?: boolean;
  hasCurrentConviction?: boolean;
  allowOverwrite?: boolean;
  deps?: QuestionResponseHydrationDeps;
};

type BuildQuestionCacheHydrationPatchArgs = {
  questionId?: unknown;
  response?: RatingResponse | null;
  deps?: QuestionResponseHydrationDeps;
};

const surveyLog = createLogger('surveys');

const hasPresentResponseValue = (value: unknown): boolean =>
  value !== undefined && value !== null && (Array.isArray(value) ? value.length > 0 : String(value).length > 0);

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasHydratableFieldPayload = (field: unknown): field is UnknownRecord => {
  if (!isRecord(field)) return false;
  return (
    Object.prototype.hasOwnProperty.call(field, 'value') ||
    Object.prototype.hasOwnProperty.call(field, 'encrypted') ||
    Object.prototype.hasOwnProperty.call(field, 'encryptedPortion') ||
    Object.prototype.hasOwnProperty.call(field, 'hash') ||
    Object.prototype.hasOwnProperty.call(field, 'encryptionAudience') ||
    Object.prototype.hasOwnProperty.call(field, 'audienceMode')
  );
};

export const toNumberOrNull = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return Number.isNaN(num) ? null : num;
};

export const getNormalizedUiRatingValue = (value: unknown): number => {
  const normalizedValue = normalizeRatingValue(value, RATING_MIN);
  return normalizedValue == null ? RATING_MIN : normalizedValue;
};

export const clampSliderValue = (value: unknown, min: number, max: number): number => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return min;
  return Math.min(max, Math.max(min, numericValue));
};

export const getConvictionFromResponse = (resp: RatingResponse | null | undefined): number | null => {
  if (!resp || typeof resp !== 'object') return null;
  if (resp.conviction !== undefined && resp.conviction !== null) {
    return toNumberOrNull(resp.conviction);
  }
  if (resp.importance !== undefined && resp.importance !== null) {
    return toNumberOrNull(resp.importance);
  }
  return null;
};

export const getImportanceFromResponse = (resp: RatingResponse | null | undefined): number | null => {
  if (!resp || typeof resp !== 'object') return null;
  if (resp.importance !== undefined && resp.importance !== null) {
    return toNumberOrNull(resp.importance);
  }
  return null;
};

export const buildRatingEnvelopeQidSetFromUserAnswers = (userAnswers: unknown): Set<string> => {
  const out = new Set<string>();
  try {
    const src = userAnswers && typeof userAnswers === 'object' ? (userAnswers as UnknownRecord) : null;
    const list = src ? (Array.isArray(src.responses) ? src.responses : [src]) : [];
    list.forEach((row) => {
      const record = row && typeof row === 'object' ? (row as UnknownRecord) : {};
      const id = normalizeQuestionIdKey(record.questionID || record.questionId || record.questionIDHash || '');
      if (!id) return;
      const impEnv = typeof record.importanceEncrypted === 'string' ? record.importanceEncrypted : '';
      const convEnv = typeof record.convictionEncrypted === 'string' ? record.convictionEncrypted : '';
      if (impEnv || convEnv) out.add(id);
    });
  } catch (e) {
    surveyLog.warn('SurveyTool: fallback', e);
  }
  return out;
};

export const buildQuestionResponseHydrationPatch = ({
  questionId = '',
  response = null,
  currentAnswer = null,
  currentAdditional = null,
  hasCurrentImportance = false,
  hasCurrentConviction = false,
  allowOverwrite = false,
  deps = {},
}: BuildQuestionResponseHydrationPatchArgs = {}) => {
  if (!response || typeof response !== 'object') {
    return {
      changed: false,
      answerState: undefined,
      additionalState: undefined,
      importanceChanged: false,
      importanceValue: undefined,
      convictionChanged: false,
      convictionValue: undefined,
    };
  }

  const qid = normalizeQuestionIdKey(questionId);
  const hasAnswerPayload = hasHydratableFieldPayload(response.answer);
  const hasAdditionalPayload = hasHydratableFieldPayload(response.additional);
  const ans = hasAnswerPayload ? (response.answer as UnknownRecord) : {};
  const add = hasAdditionalPayload ? (response.additional as UnknownRecord) : {};
  const prevAns = currentAnswer && typeof currentAnswer === 'object' ? currentAnswer : {};
  const prevAdd = currentAdditional && typeof currentAdditional === 'object' ? currentAdditional : {};
  const parseValue = deps.parseValue;
  const areEnvelopesEquivalent = deps.areEnvelopesEquivalent;
  const normalizeResponseEncryptionAudience = deps.normalizeResponseEncryptionAudience;
  const getDefaultResponseEncryptionAudienceForQid = deps.getDefaultResponseEncryptionAudienceForQid;
  const resolveFieldEncryptionGateId = deps.resolveFieldEncryptionGateId;
  const normalizeFieldAudienceMode = deps.normalizeFieldAudienceMode;
  const buildInheritedAdditionalFieldState = deps.buildInheritedAdditionalFieldState;
  const buildEmptyResponseFieldState = deps.buildEmptyResponseFieldState;

  const ansIsMasked = ans.value === '*' && (ans.encrypted || ans.encryptedPortion);
  const ansPrevDecrypted = prevAns && prevAns.value !== '*' && prevAns.value !== undefined && prevAns.value !== null;
  const ansEnvMatches =
    typeof areEnvelopesEquivalent === 'function' && prevAns
      ? areEnvelopesEquivalent(ans.encryptedPortion, prevAns.encryptedPortion, ans.encrypted, prevAns.encrypted)
      : false;
  const addIsMasked = add.value === '*' && (add.encrypted || add.encryptedPortion);
  const addPrevDecrypted = prevAdd && prevAdd.value !== '*' && prevAdd.value !== undefined && prevAdd.value !== null;
  const addEnvMatches =
    typeof areEnvelopesEquivalent === 'function' && prevAdd
      ? areEnvelopesEquivalent(add.encryptedPortion, prevAdd.encryptedPortion, add.encrypted, prevAdd.encrypted)
      : false;

  let changed = false;
  let answerState;
  let additionalState;
  let importanceValue;
  let convictionValue;
  let importanceChanged = false;
  let convictionChanged = false;

  if (hasAnswerPayload && (!hasPresentResponseValue(prevAns?.value) || allowOverwrite)) {
    const answerAudience =
      typeof normalizeResponseEncryptionAudience === 'function'
        ? normalizeResponseEncryptionAudience(
            ans.encryptionAudience ||
              (ans.encrypted || ans.encryptedPortion
                ? typeof getDefaultResponseEncryptionAudienceForQid === 'function'
                  ? getDefaultResponseEncryptionAudienceForQid(qid)
                  : 'gate'
                : 'self'),
            qid,
          )
        : ans.encryptionAudience;

    answerState = {
      ...prevAns,
      value:
        ansIsMasked && ansPrevDecrypted && ansEnvMatches
          ? prevAns.value
          : typeof parseValue === 'function'
            ? parseValue(ans.value)
            : ans.value,
      encrypted: !!(ans.encrypted || ans.encryptedPortion),
      encryptionAudience: answerAudience,
      encryptionGateId:
        answerAudience === 'gate' && typeof resolveFieldEncryptionGateId === 'function'
          ? resolveFieldEncryptionGateId({ ...ans, encryptionAudience: answerAudience }, qid, 'answer')
          : null,
      audienceMode: 'explicit',
      hash: ans.hash || '',
      encryptedPortion: ans.encryptedPortion || '',
      ...(ansEnvMatches && prevAns?.zkSalt ? { zkSalt: prevAns.zkSalt } : {}),
    };
    changed = true;
  }

  if (!hasCurrentConviction || allowOverwrite) {
    const nextConviction = getConvictionFromResponse(response);
    if (nextConviction !== null) {
      convictionValue = nextConviction;
      convictionChanged = true;
      changed = true;
    }
  }

  if (!hasCurrentImportance || allowOverwrite) {
    const nextImportance = getImportanceFromResponse(response);
    if (nextImportance !== null) {
      importanceValue = nextImportance;
      importanceChanged = true;
      changed = true;
    }
  }

  if (hasAdditionalPayload && (!hasPresentResponseValue(prevAdd?.value) || allowOverwrite)) {
    const additionalAudienceMode =
      typeof normalizeFieldAudienceMode === 'function'
        ? normalizeFieldAudienceMode(add.audienceMode, 'additional', add)
        : add.audienceMode;
    const additionalAudience =
      typeof normalizeResponseEncryptionAudience === 'function'
        ? normalizeResponseEncryptionAudience(
            add.encryptionAudience ||
              (add.encrypted || add.encryptedPortion
                ? typeof getDefaultResponseEncryptionAudienceForQid === 'function'
                  ? getDefaultResponseEncryptionAudienceForQid(qid)
                  : 'gate'
                : 'self'),
            qid,
          )
        : add.encryptionAudience;

    additionalState = {
      ...prevAdd,
      value:
        addIsMasked && addPrevDecrypted && addEnvMatches
          ? prevAdd.value
          : typeof parseValue === 'function'
            ? parseValue(add.value)
            : add.value,
      encrypted: !!(add.encrypted || add.encryptedPortion),
      encryptionAudience: additionalAudience,
      encryptionGateId:
        additionalAudience === 'gate' && typeof resolveFieldEncryptionGateId === 'function'
          ? resolveFieldEncryptionGateId({ ...add, encryptionAudience: additionalAudience }, qid, 'additional')
          : null,
      audienceMode: additionalAudienceMode,
      hash: add.hash || '',
      encryptedPortion: add.encryptedPortion || '',
      ...(addEnvMatches && prevAdd?.zkSalt ? { zkSalt: prevAdd.zkSalt } : {}),
    };
    if (additionalAudienceMode === 'inherit' && typeof buildInheritedAdditionalFieldState === 'function') {
      additionalState = buildInheritedAdditionalFieldState(
        additionalState,
        answerState ||
          prevAns ||
          (typeof buildEmptyResponseFieldState === 'function' ? buildEmptyResponseFieldState(qid) : {}),
        qid,
      ) as UnknownRecord;
    }
    changed = true;
  }

  return {
    changed,
    answerState,
    additionalState,
    importanceChanged,
    importanceValue,
    convictionChanged,
    convictionValue,
  };
};

export const buildQuestionCacheHydrationPatch = ({
  questionId = '',
  response = null,
  deps = {},
}: BuildQuestionCacheHydrationPatchArgs = {}) => {
  if (!response || typeof response !== 'object') {
    return {
      changed: false,
      answerState: undefined,
      additionalState: undefined,
      importanceChanged: false,
      importanceValue: undefined,
      convictionChanged: false,
      convictionValue: undefined,
    };
  }

  const qid = normalizeQuestionIdKey(questionId);
  const hasAnswerPayload = hasHydratableFieldPayload(response.answer);
  const hasAdditionalPayload = hasHydratableFieldPayload(response.additional);
  const ans = hasAnswerPayload ? (response.answer as UnknownRecord) : {};
  const add = hasAdditionalPayload ? (response.additional as UnknownRecord) : {};
  const parseValue = deps.parseValue;
  const normalizeResponseEncryptionAudience = deps.normalizeResponseEncryptionAudience;
  const getDefaultResponseEncryptionAudienceForQid = deps.getDefaultResponseEncryptionAudienceForQid;
  const resolveFieldEncryptionGateId = deps.resolveFieldEncryptionGateId;
  const normalizeFieldAudienceMode = deps.normalizeFieldAudienceMode;
  const buildInheritedAdditionalFieldState = deps.buildInheritedAdditionalFieldState;
  const buildEmptyResponseFieldState = deps.buildEmptyResponseFieldState;

  const answerEncrypted = !!(ans.encrypted || ans.encryptedPortion);
  const answerAudience =
    hasAnswerPayload && typeof normalizeResponseEncryptionAudience === 'function'
      ? normalizeResponseEncryptionAudience(
          ans.encryptionAudience ||
            (answerEncrypted
              ? typeof getDefaultResponseEncryptionAudienceForQid === 'function'
                ? getDefaultResponseEncryptionAudienceForQid(qid)
                : 'gate'
              : 'self'),
          qid,
        )
      : ans.encryptionAudience;
  const answerState = hasAnswerPayload
    ? {
        value: answerEncrypted ? '*' : typeof parseValue === 'function' ? parseValue(ans.value) : ans.value,
        encrypted: answerEncrypted,
        encryptionAudience: answerAudience,
        encryptionGateId:
          answerAudience === 'gate' && typeof resolveFieldEncryptionGateId === 'function'
            ? resolveFieldEncryptionGateId({ ...ans, encryptionAudience: answerAudience }, qid, 'answer')
            : null,
        audienceMode: 'explicit',
        hash: ans.hash || '',
        encryptedPortion: ans.encryptedPortion || '',
      }
    : undefined;

  const additionalEncrypted = !!(add.encrypted || add.encryptedPortion);
  const additionalAudienceMode =
    hasAdditionalPayload && typeof normalizeFieldAudienceMode === 'function'
      ? normalizeFieldAudienceMode(add.audienceMode, 'additional', add)
      : add.audienceMode;
  const additionalAudience =
    hasAdditionalPayload && typeof normalizeResponseEncryptionAudience === 'function'
      ? normalizeResponseEncryptionAudience(
          add.encryptionAudience ||
            (additionalEncrypted
              ? typeof getDefaultResponseEncryptionAudienceForQid === 'function'
                ? getDefaultResponseEncryptionAudienceForQid(qid)
                : 'gate'
              : 'self'),
          qid,
        )
      : add.encryptionAudience;
  let additionalState: UnknownRecord | undefined = hasAdditionalPayload
    ? {
        value: additionalEncrypted ? '*' : typeof parseValue === 'function' ? parseValue(add.value) : add.value,
        encrypted: additionalEncrypted,
        encryptionAudience: additionalAudience,
        encryptionGateId:
          additionalAudience === 'gate' && typeof resolveFieldEncryptionGateId === 'function'
            ? resolveFieldEncryptionGateId({ ...add, encryptionAudience: additionalAudience }, qid, 'additional')
            : null,
        audienceMode: additionalAudienceMode,
        hash: add.hash || '',
        encryptedPortion: add.encryptedPortion || '',
      }
    : undefined;
  if (
    additionalState &&
    additionalAudienceMode === 'inherit' &&
    typeof buildInheritedAdditionalFieldState === 'function'
  ) {
    additionalState = buildInheritedAdditionalFieldState(
      additionalState,
      answerState || (typeof buildEmptyResponseFieldState === 'function' ? buildEmptyResponseFieldState(qid) : {}),
      qid,
    ) as UnknownRecord;
  }

  const convictionValue = getConvictionFromResponse(response);
  const importanceValue = getImportanceFromResponse(response);
  const convictionChanged = convictionValue !== null;
  const importanceChanged = importanceValue !== null;

  return {
    changed: !!(answerState || additionalState || importanceChanged || convictionChanged),
    answerState,
    additionalState,
    importanceChanged,
    importanceValue: importanceChanged ? importanceValue : undefined,
    convictionChanged,
    convictionValue: convictionChanged ? convictionValue : undefined,
  };
};

export const getConvictionFromSlice = (slice: RatingSlice | null | undefined, qid: string): number | null => {
  if (!slice || !qid) return null;
  if (slice.conviction && Object.prototype.hasOwnProperty.call(slice.conviction, qid)) {
    return toNumberOrNull(slice.conviction[qid]);
  }
  if (slice.importance && Object.prototype.hasOwnProperty.call(slice.importance, qid)) {
    return toNumberOrNull(slice.importance[qid]);
  }
  return null;
};

export const getConvictionFromSliceStrict = (slice: RatingSlice | null | undefined, qid: string): number | null => {
  if (!slice || !qid) return null;
  if (slice.conviction && Object.prototype.hasOwnProperty.call(slice.conviction, qid)) {
    return toNumberOrNull(slice.conviction[qid]);
  }
  return null;
};

export const getImportanceFromSlice = (slice: RatingSlice | null | undefined, qid: string): number | null => {
  if (!slice || !qid) return null;
  if (slice.importance && Object.prototype.hasOwnProperty.call(slice.importance, qid)) {
    return toNumberOrNull(slice.importance[qid]);
  }
  return null;
};

export const normalizeMultichoiceValue = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
};

export const isSingleSelectMultichoice = (question: MultichoiceQuestion | null | undefined): boolean => {
  if (!question || question.type !== 'multichoice') return false;
  return !!(question.singleSelect || question.oneSelectionOnly || question.singleChoice);
};
