import { normalizeWorkerCanonicalCacheReader } from './workerCanonicalCacheReader';

type UnknownRecord = Record<string, unknown>;
type LockedField = readonly [flag: string, field: string, locked: () => unknown];

// Chain cache nodes are shared by every account using this browser, so question
// and survey text decrypted there records the account it was decrypted for.
const DECRYPTED_FOR_FIELD = 'decryptedFor';
const QUESTION_FIELDS: readonly LockedField[] = [
  ['promptDecrypted', 'prompt', () => '[encrypted]'],
  ['optionsDecrypted', 'options', () => []],
  ['tagsDecrypted', 'tags', () => []],
];
const SURVEY_FIELDS: readonly LockedField[] = [
  ['titleDecrypted', 'title', () => '[encrypted]'],
  ['documentURLsDecrypted', 'documentURLs', () => []],
];

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasDecryptedText = (fields: readonly LockedField[], payload: unknown): payload is UnknownRecord =>
  isRecord(payload) && fields.some(([flag]) => payload[flag]);

/** Records the reader decrypted text belongs to; payloads without decrypted text are returned as they are. */
const stampFor =
  (fields: readonly LockedField[]) =>
  <T extends object>(payload: T, reader: unknown): T =>
    hasDecryptedText(fields, payload)
      ? { ...payload, [DECRYPTED_FOR_FIELD]: normalizeWorkerCanonicalCacheReader(reader) }
      : payload;

/** The payload locked again when its text was decrypted for another reader; null when it can stay. */
const remaskFor =
  (fields: readonly LockedField[]) =>
  (payload: unknown, reader: string): UnknownRecord | null => {
    if (!hasDecryptedText(fields, payload)) return null;
    if (payload[DECRYPTED_FOR_FIELD] === reader) return null;
    const masked: UnknownRecord = { ...payload };
    fields.forEach(([flag, field, locked]) => {
      if (masked[flag]) masked[field] = locked();
      delete masked[flag];
    });
    delete masked[DECRYPTED_FOR_FIELD];
    return masked;
  };

export const stampDecryptedQuestion = stampFor(QUESTION_FIELDS);
export const remaskQuestionForReader = remaskFor(QUESTION_FIELDS);
export const stampDecryptedSurvey = stampFor(SURVEY_FIELDS);
