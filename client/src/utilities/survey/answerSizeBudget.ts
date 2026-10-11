import { encodePaddedEnvelopePlaintext } from '@ce-shared/encryption/envelopeV1Core.mjs';
import { sanitizeQuestionPromptForResponsePayload } from '../arweave/noLeakPayloads';
import { usesCloudflareSessionStorage } from '../storage/sessionStorageConfig';
import { STORAGE_RESOURCE_KEYS } from '../storage/storageRefs';

/**
 * The session Worker stores each answer as one JSON entry and refuses an entry
 * over MAX_STORED_ANSWER_BYTES (its MAX_RESPONSE_ITEM_BYTES). The entry repeats
 * the question prompt and holds an encrypted envelope for each locked field.
 * Answer and comment text also share MAX_ANSWER_PLAINTEXT_BYTES (its
 * MAX_RESPONSE_PLAINTEXT_BYTES), each counted as a JSON string in UTF-8.
 */
export const MAX_STORED_ANSWER_BYTES = 96 * 1024;
export const MAX_ANSWER_PLAINTEXT_BYTES = 48 * 1024;

// Room for the entry's ids, hashes, audience fields and small extras.
const ENTRY_OVERHEAD_BYTES = 2 * 1024;
// Envelope fields around one locked value's ciphertext, as stored: owner and
// Worker recipients take about 1.6 KiB; a Lit gate recipient takes more.
const LOCKED_FIELD_OVERHEAD_BYTES = 2 * 1024;
const GATE_LOCKED_FIELD_OVERHEAD_BYTES = 4 * 1024;
const AES_GCM_TAG_BYTES = 16;
// Locking adds a 32-byte salt to the padded plaintext.
const SALT_HEX = `0x${'0'.repeat(64)}`;
const LOCKED_VALUE_MASK = '*';
const LOCKED_KINDS = new Set(['binary', 'multichoice', 'quadratic', 'rating']);

const PROMPT_TOO_LONG_MESSAGE =
  "Answers to this question can't be saved because its prompt is too long. Ask the session admin to shorten it.";
const LOCKED_ANSWER_TOO_LONG_MESSAGE =
  "This locked answer can't be saved with this question's long prompt. Unlock it, or ask the session admin to shorten the question.";

type UnknownRecord = Record<string, unknown>;

export type StoredAnswerSizeInput = {
  /** The question as the client stores it; its prompt is copied into the answer. */
  question?: unknown;
  /** Whether the question is locked, so the copied prompt is masked. */
  promptLocked?: boolean;
  /** Response fields: { value, encrypted, encryptionAudience, encryptedPortion }. */
  answer?: unknown;
  comment?: unknown;
  /** Importance and conviction values, locked with the answer when a field is locked. */
  ratingCount?: number;
};

type FieldSize = {
  locked: boolean;
  overheadBytes: number;
  storedBytes: number;
  // Stored bytes the field would take with no text.
  emptyBytes: number;
  plaintextBytes: number;
  characters: number;
};

const encoder = new TextEncoder();
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';

const toJsonText = (value: unknown): string => {
  try {
    return JSON.stringify(value ?? '') ?? '""';
  } catch {
    return '""';
  }
};
const jsonBytes = (value: unknown): number => encoder.encode(toJsonText(value)).byteLength;

const hasValue = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim() !== '';
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return value != null;
};

// The encrypted envelope as stored: padded plaintext, GCM tag, base64, and the
// recipients and metadata around it.
const lockedEnvelopeBytes = (value: unknown, kind: string, question: unknown, overheadBytes: number): number => {
  const padded = encodePaddedEnvelopePlaintext(
    { v: 1, value, kind, salt: SALT_HEX },
    isRecord(question) ? question : {},
  ).byteLength;
  return 4 * Math.ceil((padded + AES_GCM_TAG_BYTES) / 3) + overheadBytes;
};

const measureField = (field: unknown, kind: string, question: unknown): FieldSize => {
  const record = isRecord(field) ? field : {};
  const value = record.value;
  const plaintextBytes = jsonBytes(value);
  const characters = toJsonText(value).length;
  if (record.encrypted !== true || !hasValue(value)) {
    const emptyBytes = jsonBytes('');
    return { locked: false, overheadBytes: 0, storedBytes: plaintextBytes, emptyBytes, plaintextBytes, characters };
  }
  const overheadBytes =
    record.encryptionAudience === 'gate' ? GATE_LOCKED_FIELD_OVERHEAD_BYTES : LOCKED_FIELD_OVERHEAD_BYTES;
  const maskBytes = jsonBytes(LOCKED_VALUE_MASK);
  if (value === LOCKED_VALUE_MASK) {
    // An unchanged locked field keeps its stored envelope, which the responder cannot shorten.
    const storedBytes = maskBytes + jsonBytes(record.encryptedPortion || '');
    return { locked: true, overheadBytes, storedBytes, emptyBytes: storedBytes, plaintextBytes: 0, characters: 0 };
  }
  return {
    locked: true,
    overheadBytes,
    storedBytes: maskBytes + lockedEnvelopeBytes(value, kind, question, overheadBytes),
    emptyBytes: maskBytes + lockedEnvelopeBytes('', kind, question, overheadBytes),
    plaintextBytes,
    characters,
  };
};

const readAnswerKind = (question: unknown): string => {
  const type = String((isRecord(question) && question.type) || '').toLowerCase();
  return LOCKED_KINDS.has(type) ? type : 'freeform';
};

const toCountMessage = (characters: number): string => {
  const unit = characters === 1 ? 'character' : 'characters';
  return `This answer is too long to save. Shorten it by about ${characters.toLocaleString('en-US')} ${unit}.`;
};

/**
 * Returns why the session Worker would refuse this answer, or ''. Counts the
 * stored entry: the prompt copy, the answer and comment (as envelopes when
 * locked), locked ratings, and the entry's own fields.
 */
export const readAnswerTooLongMessage = ({
  question = null,
  promptLocked = false,
  answer = null,
  comment = null,
  ratingCount = 0,
}: StoredAnswerSizeInput = {}): string => {
  const answerSize = measureField(answer, readAnswerKind(question), question);
  const commentSize = measureField(comment, 'freeform', question);
  // Ratings are locked like the answer, so they carry the same recipients.
  const ratingOverheadBytes = Math.max(answerSize.overheadBytes, commentSize.overheadBytes);
  const ratingEnvelopeBytes =
    answerSize.locked || commentSize.locked
      ? Math.max(0, Math.min(2, Math.floor(Number(ratingCount) || 0))) *
        lockedEnvelopeBytes(0, 'rating', null, ratingOverheadBytes)
      : 0;
  const promptBytes = jsonBytes(sanitizeQuestionPromptForResponsePayload(question, { isLocked: promptLocked }));
  if (ENTRY_OVERHEAD_BYTES + promptBytes + 2 * jsonBytes('') > MAX_STORED_ANSWER_BYTES) {
    return PROMPT_TOO_LONG_MESSAGE;
  }
  // Locking costs room no shortening can win back.
  const fixedBytes = ENTRY_OVERHEAD_BYTES + promptBytes + ratingEnvelopeBytes;
  const emptyBytes = fixedBytes + answerSize.emptyBytes + commentSize.emptyBytes;
  if (emptyBytes > MAX_STORED_ANSWER_BYTES) return LOCKED_ANSWER_TOO_LONG_MESSAGE;

  const storedBytes = fixedBytes + answerSize.storedBytes + commentSize.storedBytes;
  const plaintextBytes = answerSize.plaintextBytes + commentSize.plaintextBytes;
  const characters = answerSize.characters + commentSize.characters;
  const overStoredBytes = storedBytes - MAX_STORED_ANSWER_BYTES;
  const overPlaintextBytes = plaintextBytes - MAX_ANSWER_PLAINTEXT_BYTES;
  if (overStoredBytes <= 0 && overPlaintextBytes <= 0) return '';
  // Multi-byte characters and locking use more of each budget, so convert at this text's own rate.
  const fromPlaintext = overPlaintextBytes > 0 ? Math.ceil((overPlaintextBytes * characters) / plaintextBytes) : 0;
  const fromStored =
    overStoredBytes > 0 ? Math.ceil((overStoredBytes * characters) / Math.max(1, storedBytes - emptyBytes)) : 0;
  return toCountMessage(Math.max(1, fromPlaintext, fromStored));
};

/** Only answers the session Worker stores have this budget. */
export const sessionStoresAnswersInWorker = (sessionConfig: unknown): boolean =>
  usesCloudflareSessionStorage(sessionConfig, { resource: STORAGE_RESOURCE_KEYS.RESPONSES });
