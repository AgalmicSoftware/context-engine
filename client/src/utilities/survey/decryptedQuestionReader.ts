import { normalizeWorkerCanonicalCacheReader } from './workerCanonicalCacheReader';

type UnknownRecord = Record<string, unknown>;

// Chain cache nodes are shared by every account using this browser, so question
// text decrypted there records the account it was decrypted for.
const DECRYPTED_FOR_FIELD = 'decryptedFor';
const LOCKED_FIELDS = [
  ['promptDecrypted', 'prompt', () => '[encrypted]'],
  ['optionsDecrypted', 'options', () => []],
  ['tagsDecrypted', 'tags', () => []],
] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasDecryptedText = (question: unknown): question is UnknownRecord =>
  isRecord(question) && LOCKED_FIELDS.some(([flag]) => question[flag]);

/** Records the reader a question's decrypted text belongs to; other questions are returned as they are. */
export const stampDecryptedQuestion = <T extends object>(question: T, reader: unknown): T =>
  hasDecryptedText(question)
    ? { ...question, [DECRYPTED_FOR_FIELD]: normalizeWorkerCanonicalCacheReader(reader) }
    : question;

/** The question locked again when its text was decrypted for another reader; null when it can stay. */
export const remaskQuestionForReader = (question: unknown, reader: string): UnknownRecord | null => {
  if (!hasDecryptedText(question)) return null;
  if (question[DECRYPTED_FOR_FIELD] === reader) return null;
  const masked: UnknownRecord = { ...question };
  LOCKED_FIELDS.forEach(([flag, field, locked]) => {
    if (masked[flag]) masked[field] = locked();
    delete masked[flag];
  });
  delete masked[DECRYPTED_FOR_FIELD];
  return masked;
};
