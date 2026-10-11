import { usesCloudflareSessionStorage } from '../storage/sessionStorageConfig';
import { STORAGE_RESOURCE_KEYS } from '../storage/storageRefs';

/**
 * The session Worker refuses an answer whose text and comment exceed this
 * budget (its MAX_RESPONSE_PLAINTEXT_BYTES): the answer and the comment are
 * each counted as a JSON string in UTF-8. A locked field counts its
 * plaintext; the Worker's stored cap leaves room for its envelope.
 */
export const MAX_ANSWER_PLAINTEXT_BYTES = 48 * 1024;

const encoder = new TextEncoder();

const toJsonText = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return '';
  }
};

/** Returns the message for an answer and comment over the budget, or ''. */
export const readAnswerTooLongMessage = (answer: unknown, comment: unknown): string => {
  const text = toJsonText(answer) + toJsonText(comment);
  const bytes = encoder.encode(text).byteLength;
  const overBytes = bytes - MAX_ANSWER_PLAINTEXT_BYTES;
  if (overBytes <= 0) return '';
  // Multi-byte characters use more of the budget, so convert at this text's own rate.
  const characters = Math.max(1, Math.ceil((overBytes * text.length) / bytes));
  const unit = characters === 1 ? 'character' : 'characters';
  return `This answer is too long to save. Shorten it by about ${characters.toLocaleString('en-US')} ${unit}.`;
};

/** Only answers the session Worker stores have this budget. */
export const sessionStoresAnswersInWorker = (sessionConfig: unknown): boolean =>
  usesCloudflareSessionStorage(sessionConfig, { resource: STORAGE_RESOURCE_KEYS.RESPONSES });
