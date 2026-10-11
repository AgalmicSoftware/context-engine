import { encodePaddedEnvelopePlaintext } from '@ce-shared/encryption/envelopeV1Core.mjs';
import { LOCKED_FIELD_MASK, sanitizeQuestionPromptForResponsePayload } from '../arweave/noLeakPayloads';
import { usesCloudflareSessionStorage } from '../storage/sessionStorageConfig';
import { STORAGE_RESOURCE_KEYS } from '../storage/storageRefs';

/**
 * The session Worker refuses a stored answer over MAX_STORED_ANSWER_BYTES (its
 * MAX_RESPONSE_ITEM_BYTES). Each stored answer repeats the question prompt, and
 * a locked answer, comment or rating is stored as an encrypted envelope.
 *
 * Locked answer and comment text also keeps to MAX_LOCKED_TEXT_BYTES, the
 * amount of locked text the Worker's cap was sized to hold (its
 * MAX_RESPONSE_PLAINTEXT_BYTES). The Worker enforces only the stored cap, so
 * unlocked text has no budget of its own.
 */
export const MAX_STORED_ANSWER_BYTES = 96 * 1024;
export const MAX_LOCKED_TEXT_BYTES = 48 * 1024;

// Room for the Worker's session fields, locked-field hashes and other small
// differences between the built answer and the uploaded one.
const ENTRY_ALLOWANCE_BYTES = 512;
// Without the built answer: room for its ids, hashes, audience fields and extras.
const ENTRY_OVERHEAD_BYTES = 2 * 1024;
// Envelope fields around one locked value's ciphertext, as stored: the owner
// and Worker recipients take about 1.6 KiB, the owner recipient alone 1 KiB.
const LOCKED_FIELD_OVERHEAD_BYTES = 2 * 1024;
const SELF_RECIPIENT_OVERHEAD_BYTES = 1024;
// Each Lit gate recipient carries its policy and wrapped key, and repeats the
// gate's SBT list in its access conditions and policy.
const LIT_RECIPIENT_BYTES = 2304;
const LIT_SBT_BYTES = 512;
const AES_GCM_TAG_BYTES = 16;
// Locking adds a 32-byte salt to the padded plaintext.
const SALT_HEX = `0x${'0'.repeat(64)}`;
const LOCKED_VALUE_MASK = '*';
const LOCKED_KINDS = new Set(['binary', 'multichoice', 'quadratic', 'rating']);
// Copies of a text in the stored answer (as in interview records) shrink with
// it; shorter strings are left alone so unrelated equal values are not counted.
const MIN_COPIED_TEXT_LENGTH = 16;

const PROMPT_TOO_LONG_MESSAGE =
  "Answers to this question can't be saved because its prompt is too long. Ask the session admin to shorten it.";
const LOCKED_ANSWER_TOO_LONG_MESSAGE =
  "This locked answer can't be saved with this question's long prompt. Unlock it, or ask the session admin to shorten the question.";

type UnknownRecord = Record<string, unknown>;

export type StoredAnswerSizeInput = {
  /** The question; its prompt is copied into the stored answer. */
  question?: unknown;
  /** Whether the question is locked, so the copied prompt is masked. */
  promptLocked?: boolean;
  /** The stored answer as the payload builder makes it, before locking; counted in full when given. */
  entry?: unknown;
  /**
   * Response fields as they will be stored: { value, encrypted, encryptionAudience,
   * encryptedPortion }, plus gateRecipients when a gate locks them.
   */
  answer?: unknown;
  comment?: unknown;
  /** Each rating the upload carries: a value it may lock, and any saved envelope it may keep. */
  ratings?: Array<{ value?: unknown; savedEnvelope?: unknown }>;
  /** Whether new rating values are locked; by default, when the answer or comment is. */
  ratingsLocked?: boolean;
  /** Rating values locked with the answer, when `ratings` isn't given. */
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
  copyableText: string;
};

const encoder = new TextEncoder();
const isRecord = (value: unknown): value is UnknownRecord => !!value && typeof value === 'object';
const asRecord = (value: unknown): UnknownRecord => (isRecord(value) && !Array.isArray(value) ? value : {});

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

const countGateSbts = (recipient: unknown): number => {
  let count = 0;
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (isRecord(value) && typeof value.contractAddress === 'string') count += 1;
  };
  visit(asRecord(recipient).accessControlConditions);
  return Math.max(1, count);
};

const gateOverheadBytes = (recipients: unknown): number => {
  const list = Array.isArray(recipients) && recipients.length ? recipients : [null];
  return list.reduce<number>(
    (sum, recipient) => sum + LIT_RECIPIENT_BYTES + LIT_SBT_BYTES * countGateSbts(recipient),
    SELF_RECIPIENT_OVERHEAD_BYTES,
  );
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
  const record = asRecord(field);
  const value = record.value;
  const text = toJsonText(value);
  const plaintextBytes = encoder.encode(text).byteLength;
  const characters = text.length;
  if (record.encrypted !== true || !hasValue(value)) {
    const copyableText = typeof value === 'string' && value.length >= MIN_COPIED_TEXT_LENGTH ? value : '';
    const emptyBytes = jsonBytes('');
    return {
      locked: false,
      overheadBytes: 0,
      storedBytes: plaintextBytes,
      emptyBytes,
      plaintextBytes,
      characters,
      copyableText,
    };
  }
  const overheadBytes =
    record.encryptionAudience === 'gate' ? gateOverheadBytes(record.gateRecipients) : LOCKED_FIELD_OVERHEAD_BYTES;
  const maskBytes = jsonBytes(LOCKED_VALUE_MASK);
  if (value === LOCKED_VALUE_MASK) {
    // An unchanged locked field keeps its stored envelope, which the responder cannot shorten.
    const storedBytes = maskBytes + jsonBytes(record.encryptedPortion || '');
    return {
      locked: true,
      overheadBytes,
      storedBytes,
      emptyBytes: storedBytes,
      plaintextBytes: 0,
      characters: 0,
      copyableText: '',
    };
  }
  return {
    locked: true,
    overheadBytes,
    storedBytes: maskBytes + lockedEnvelopeBytes(value, kind, question, overheadBytes),
    emptyBytes: maskBytes + lockedEnvelopeBytes('', kind, question, overheadBytes),
    plaintextBytes,
    characters,
    copyableText: '',
  };
};

// A known rating locks into a new envelope (or keeps its saved one); unlocked,
// it goes public. A rating this browser never decrypted keeps its envelope.
const ratingEnvelopeBytes = (
  { value, savedEnvelope }: { value?: unknown; savedEnvelope?: unknown },
  locked: boolean,
  overheadBytes: number,
): number => {
  const savedBytes = typeof savedEnvelope === 'string' && savedEnvelope ? jsonBytes(savedEnvelope) : 0;
  const known = value !== null && value !== undefined;
  if (!known) return savedBytes;
  return locked ? Math.max(savedBytes, lockedEnvelopeBytes(0, 'rating', null, overheadBytes)) : 0;
};

// The built answer with both fields' text and every rating envelope removed,
// and, when `texts` is given, every copy of those texts blanked as well.
const withoutFieldText = (entry: unknown, texts: Set<string> | null): unknown => {
  const blankCopies = (value: unknown): unknown => {
    if (typeof value === 'string') return texts?.has(value) ? '' : value;
    if (Array.isArray(value)) return value.map(blankCopies);
    if (isRecord(value))
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, blankCopies(item)]));
    return value;
  };
  const record = asRecord(entry);
  const stripped: UnknownRecord = {
    ...record,
    answer: { ...asRecord(record.answer), value: '', encryptedPortion: '' },
    additional: { ...asRecord(record.additional), value: '', encryptedPortion: '' },
  };
  delete stripped.importanceEncrypted;
  delete stripped.convictionEncrypted;
  return texts ? blankCopies(stripped) : stripped;
};

const readAnswerKind = (question: unknown): string => {
  const type = String((isRecord(question) && question.type) || '').toLowerCase();
  return LOCKED_KINDS.has(type) ? type : 'freeform';
};

const formatCount = (characters: number): string =>
  `${characters.toLocaleString('en-US')} ${characters === 1 ? 'character' : 'characters'}`;

const toTooLongMessage = (characters: number, commentIsLonger: boolean): string =>
  commentIsLonger
    ? `This answer or comment is too long to save. Shorten them by about ${formatCount(characters)}.`
    : `This answer is too long to save. Shorten it by about ${formatCount(characters)}.`;

/**
 * Returns why the session Worker would refuse this answer, or ''. Counts the
 * stored answer: the prompt copy, the answer and comment (as envelopes when
 * locked), the ratings it carries, and the rest of the built answer.
 */
export const readAnswerTooLongMessage = ({
  question = null,
  promptLocked = false,
  entry = null,
  answer = null,
  comment = null,
  ratings,
  ratingsLocked,
  ratingCount = 0,
}: StoredAnswerSizeInput = {}): string => {
  const promptBytes = jsonBytes(sanitizeQuestionPromptForResponsePayload(question, { isLocked: promptLocked }));
  if (ENTRY_OVERHEAD_BYTES + promptBytes > MAX_STORED_ANSWER_BYTES) return PROMPT_TOO_LONG_MESSAGE;

  const answerSize = measureField(answer, readAnswerKind(question), question);
  const commentSize = measureField(comment, 'freeform', question);
  const anyLocked = answerSize.locked || commentSize.locked;
  const ratingOverheadBytes = answerSize.locked
    ? answerSize.overheadBytes
    : commentSize.locked
      ? commentSize.overheadBytes
      : LOCKED_FIELD_OVERHEAD_BYTES;
  const ratingList = Array.isArray(ratings)
    ? ratings
    : Array.from({ length: Math.max(0, Math.min(2, Math.floor(Number(ratingCount) || 0))) }, () => ({ value: 0 }));
  const ratingBytes = ratingList.reduce(
    (sum, rating) => sum + ratingEnvelopeBytes(rating || {}, ratingsLocked ?? anyLocked, ratingOverheadBytes),
    0,
  );

  // Copies of unlocked text elsewhere in the built answer grow and shrink with it.
  const copiedTexts = new Set([answerSize.copyableText, commentSize.copyableText].filter(Boolean));
  const restBytes = entry ? jsonBytes(withoutFieldText(entry, copiedTexts)) + ENTRY_ALLOWANCE_BYTES : 0;
  const copiesBytes = entry ? jsonBytes(withoutFieldText(entry, null)) + ENTRY_ALLOWANCE_BYTES - restBytes : 0;
  const fixedBytes = (entry ? restBytes : ENTRY_OVERHEAD_BYTES + promptBytes) + ratingBytes;
  const emptyBytes = fixedBytes + answerSize.emptyBytes + commentSize.emptyBytes;
  // Locking costs room no shortening can win back.
  if (emptyBytes > MAX_STORED_ANSWER_BYTES) return anyLocked ? LOCKED_ANSWER_TOO_LONG_MESSAGE : PROMPT_TOO_LONG_MESSAGE;

  const storedBytes = fixedBytes + copiesBytes + answerSize.storedBytes + commentSize.storedBytes;
  const characters = answerSize.characters + commentSize.characters;
  const lockedTextBytes =
    (answerSize.locked ? answerSize.plaintextBytes : 0) + (commentSize.locked ? commentSize.plaintextBytes : 0);
  const lockedCharacters =
    (answerSize.locked ? answerSize.characters : 0) + (commentSize.locked ? commentSize.characters : 0);
  const overStoredBytes = storedBytes - MAX_STORED_ANSWER_BYTES;
  const overLockedTextBytes = lockedTextBytes - MAX_LOCKED_TEXT_BYTES;
  if (overStoredBytes <= 0 && overLockedTextBytes <= 0) return '';
  // Multi-byte characters, copies and locking use more of each budget, so convert at this text's own rate.
  const fromStored =
    overStoredBytes > 0 ? Math.ceil((overStoredBytes * characters) / Math.max(1, storedBytes - emptyBytes)) : 0;
  const fromLockedText =
    overLockedTextBytes > 0 ? Math.ceil((overLockedTextBytes * lockedCharacters) / lockedTextBytes) : 0;
  return toTooLongMessage(Math.max(1, fromStored, fromLockedText), commentSize.characters > answerSize.characters);
};

/** Names a question in a notice: its prompt, or a short id when the prompt is locked. */
export const nameQuestionForNotice = (prompt: unknown, questionId: unknown): string => {
  const text = String(prompt ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text && text !== LOCKED_FIELD_MASK && text !== LOCKED_VALUE_MASK) {
    return `“${text.length > 60 ? `${text.slice(0, 57).trimEnd()}…` : text}”`;
  }
  const id = String(questionId ?? '').trim();
  return id ? `Question ${id.slice(0, 10)}…` : 'A question';
};

/** Only answers the session Worker stores have this budget. */
export const sessionStoresAnswersInWorker = (sessionConfig: unknown): boolean =>
  usesCloudflareSessionStorage(sessionConfig, { resource: STORAGE_RESOURCE_KEYS.RESPONSES });
