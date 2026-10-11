/**
 * How a draft refers to the saved answer it was written against: the draft field shapes,
 * the saved baseline a draft stores, and the per-field checks run when it is restored.
 */
import { keepConsentWithdrawals } from './sessionInterviewConsent';
import { normalizeQuestionIdKey } from './surveyToolSignatures.js';
import type { UnknownRecord } from './surveyToolTypes.js';

export type SurveyDraftField = {
  value?: unknown;
  encrypted?: boolean;
} & UnknownRecord;

export type SurveyDraftQuestionEntry = {
  value?: unknown;
  answerEncrypted?: unknown;
  answerEncryptionAudience?: unknown;
  answerEncryptionGateId?: unknown;
  answerAudienceMode?: unknown;
  answerEncryptedPortion?: unknown;
  additional?: unknown;
  additionalEncrypted?: unknown;
  additionalEncryptionAudience?: unknown;
  additionalEncryptionGateId?: unknown;
  additionalAudienceMode?: unknown;
  additionalEncryptedPortion?: unknown;
  importance?: unknown;
  conviction?: unknown;
  interviewProvenance?: unknown;
} & UnknownRecord;

export type PersistedDraftSliceLike = {
  answers?: Record<string, UnknownRecord | unknown> | null;
  additionalComments?: Record<string, UnknownRecord | unknown> | null;
  importance?: Record<string, unknown> | null;
  conviction?: Record<string, unknown> | null;
  interviewProvenance?: Record<string, UnknownRecord | unknown> | null;
} & UnknownRecord;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export const hasMeaningfulFieldValue = (field: SurveyDraftField | null | undefined = {}): boolean => {
  if (!isRecord(field)) return false;
  const val = field.value;
  if (val === '*') return true;
  if (typeof val === 'boolean') return true;
  if (typeof val === 'number') return true;
  if (Array.isArray(val)) return val.length > 0;
  if (val && typeof val === 'object') return Object.keys(val).length > 0;
  if (typeof val === 'string') return val.trim().length > 0;
  return false;
};

export const buildStableDraftValueSignature = (value: unknown): string => {
  if (value === undefined) return 'u';
  if (value === null) return 'n';
  if (typeof value === 'string') return `s:${value}`;
  if (typeof value === 'number') return `d:${Number.isNaN(value) ? 'NaN' : String(value)}`;
  if (typeof value === 'boolean') return value ? 'b:1' : 'b:0';
  if (Array.isArray(value)) {
    return `a:[${value.map((item) => buildStableDraftValueSignature(item)).join(',')}]`;
  }
  if (isRecord(value)) {
    const keys = Object.keys(value).sort();
    return `o:{${keys.map((key) => `${key}:${buildStableDraftValueSignature(value[key])}`).join('|')}}`;
  }
  return `${typeof value}:${String(value)}`;
};

export const ANSWER_DRAFT_KEYS = [
  'value',
  'answerEncrypted',
  'answerEncryptionAudience',
  'answerEncryptionGateId',
  'answerAudienceMode',
  'answerEncryptedPortion',
] as const;
export const ADDITIONAL_DRAFT_KEYS = [
  'additional',
  'additionalEncrypted',
  'additionalEncryptionAudience',
  'additionalEncryptionGateId',
  'additionalAudienceMode',
  'additionalEncryptedPortion',
] as const;

/**
 * Drafts never hold a locked value's plaintext, so an unlock stored with the masked
 * value cannot be restored: applying it would make "*" public. Such fields stay locked
 * as saved, and the caller is told which ones lost their unlock.
 */
export const withoutUnrestorableUnlocks = (entry: SurveyDraftQuestionEntry) => {
  let restorable = entry;
  const lostUnlocks: Array<'answer' | 'additional'> = [];
  (
    [
      ['answer', 'value', 'answerEncrypted', ANSWER_DRAFT_KEYS],
      ['additional', 'additional', 'additionalEncrypted', ADDITIONAL_DRAFT_KEYS],
    ] as const
  ).forEach(([field, valueKey, lockKey, keys]) => {
    if (restorable[valueKey] !== '*' || restorable[lockKey]) return;
    restorable = { ...restorable };
    keys.forEach((key) => delete restorable[key]);
    lostUnlocks.push(field);
  });
  return { entry: restorable, lostUnlocks };
};

export const readSliceQuestion = (slice: PersistedDraftSliceLike, qid: string) => {
  const readNumber = (map: Record<string, unknown> | null | undefined) =>
    map && Object.prototype.hasOwnProperty.call(map, qid) ? map[qid] : null;
  return {
    answer: isRecord(slice.answers?.[qid]) ? (slice.answers?.[qid] as UnknownRecord) : {},
    additional: isRecord(slice.additionalComments?.[qid]) ? (slice.additionalComments?.[qid] as UnknownRecord) : {},
    importance: readNumber(slice.importance),
    conviction: readNumber(slice.conviction),
  };
};

/**
 * The saved answer a draft was written against. Locked fields keep only their
 * envelope, so the draft never stores decrypted plaintext of a saved answer.
 * `ratingsEncrypted` says the saved ratings carry envelopes of their own.
 */
export const buildDraftBaselineEntry = (
  baselineSlice: PersistedDraftSliceLike | null | undefined,
  questionId: unknown,
  ratingsEncrypted = false,
): SurveyDraftQuestionEntry | null => {
  const qid = normalizeQuestionIdKey(questionId);
  if (!qid || !isRecord(baselineSlice)) return null;
  const { answer, additional, importance, conviction } = readSliceQuestion(baselineSlice, qid);
  const saved = (field: UnknownRecord) =>
    field.encryptedPortion ? '*' : hasMeaningfulFieldValue(field) ? field.value : undefined;
  // Encrypted ratings, or ratings of a locked response, keep their plaintext out of storage.
  const locked = ratingsEncrypted || !!(answer.encryptedPortion || additional.encryptedPortion);
  const entry: SurveyDraftQuestionEntry = {
    ...(saved(answer) !== undefined ? { value: saved(answer) } : {}),
    ...(answer.encryptedPortion ? { answerEncryptedPortion: answer.encryptedPortion } : {}),
    ...(saved(additional) !== undefined ? { additional: saved(additional) } : {}),
    ...(additional.encryptedPortion ? { additionalEncryptedPortion: additional.encryptedPortion } : {}),
    ...(!locked && importance !== null ? { importance } : {}),
    ...(!locked && conviction !== null ? { conviction } : {}),
  };
  return Object.keys(entry).length ? entry : null;
};

/**
 * A draft field is stale when the saved value it was written against has since changed,
 * for example on another device; only that field is dropped. A draft written while the
 * saved answers were unknown never conflicts, and a consent withdrawal is never dropped.
 */
export const withoutStaleDraftFields = (
  entry: SurveyDraftQuestionEntry,
  storedBaselineEntry: unknown,
  currentBaselineSlice: PersistedDraftSliceLike | null | undefined,
  questionId: unknown,
): SurveyDraftQuestionEntry => {
  const current = buildDraftBaselineEntry(currentBaselineSlice, questionId);
  // Nothing to conflict with: the saved answer was unknown when drafted, or is not loaded yet.
  if (!isRecord(storedBaselineEntry) || !current) return entry;
  const stored = storedBaselineEntry as SurveyDraftQuestionEntry;
  // A locked field is identified by its envelope; a blank field by having no value.
  const savedSignature = (source: SurveyDraftQuestionEntry, valueKey: string, envelopeKey: string) =>
    source[envelopeKey]
      ? `envelope:${String(source[envelopeKey])}`
      : hasMeaningfulFieldValue({ value: source[valueKey] })
        ? buildStableDraftValueSignature(source[valueKey])
        : 'none';
  const staleKeys: string[] = [];
  (
    [
      [ANSWER_DRAFT_KEYS, 'value', 'answerEncryptedPortion'],
      [ADDITIONAL_DRAFT_KEYS, 'additional', 'additionalEncryptedPortion'],
    ] as const
  ).forEach(([keys, valueKey, envelopeKey]) => {
    if (
      keys.some((key) => key in entry) &&
      savedSignature(stored, valueKey, envelopeKey) !== savedSignature(current, valueKey, envelopeKey)
    )
      staleKeys.push(...keys);
  });
  (['importance', 'conviction'] as const).forEach((key) => {
    if (key in entry && stored[key] != null && current[key] != null && Number(stored[key]) !== Number(current[key]))
      staleKeys.push(key);
  });
  if (!staleKeys.length) return entry;
  const fresh: SurveyDraftQuestionEntry = { ...entry };
  staleKeys.forEach((key) => delete fresh[key]);
  if (isRecord(fresh.interviewProvenance)) {
    const qid = normalizeQuestionIdKey(questionId);
    const savedConsent = isRecord(currentBaselineSlice?.interviewProvenance)
      ? currentBaselineSlice.interviewProvenance[qid]
      : null;
    // The rest of the draft may be stale, but a withdrawal it records still applies.
    const withdrawals = keepConsentWithdrawals(savedConsent, fresh.interviewProvenance);
    if (withdrawals) fresh.interviewProvenance = withdrawals;
    else delete fresh.interviewProvenance;
  }
  return fresh;
};
