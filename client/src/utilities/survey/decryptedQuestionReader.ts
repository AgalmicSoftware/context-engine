import { normalizeWorkerCanonicalCacheReader, WORKER_CANONICAL_CACHE_SCOPE_KEY } from './workerCanonicalCacheReader';

type UnknownRecord = Record<string, unknown>;
// The envelope fields are the names the text's envelope is read from.
type LockedField = readonly [flag: string, field: string, locked: () => unknown, envelopeFields: readonly string[]];
type ChainText = { collection: string; fields: readonly LockedField[] };

// Chain cache nodes are shared by every account using this browser, so question
// and survey text decrypted there records the account it was decrypted for.
const DECRYPTED_FOR_FIELD = 'decryptedFor';
const QUESTION_FIELDS: readonly LockedField[] = [
  ['promptDecrypted', 'prompt', () => '[encrypted]', ['promptEncrypted', 'encryptedPrompt']],
  ['optionsDecrypted', 'options', () => [], ['optionsEncrypted', 'encryptedOptions']],
  ['tagsDecrypted', 'tags', () => [], ['tagsEncrypted', 'encryptedTags']],
];
const SURVEY_FIELDS: readonly LockedField[] = [
  ['titleDecrypted', 'title', () => '[encrypted]', ['titleEncrypted', 'encryptedTitle']],
  ['documentURLsDecrypted', 'documentURLs', () => [], ['documentURLsEncrypted', 'docUrlsEncrypted']],
];
const CHAIN_TEXT: Readonly<Record<string, ChainText>> = {
  questionsCache: { collection: 'questions', fields: QUESTION_FIELDS },
  surveysCache: { collection: 'surveys', fields: SURVEY_FIELDS },
};

const isRecord = (value: unknown): value is UnknownRecord =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const hasDecryptedText = (fields: readonly LockedField[], payload: unknown): payload is UnknownRecord =>
  isRecord(payload) && fields.some(([flag]) => payload[flag]);

// Decrypted text shows only to the signed-in account it was decrypted for.
const isHiddenFrom = (fields: readonly LockedField[], payload: unknown, reader: string): payload is UnknownRecord =>
  hasDecryptedText(fields, payload) && !(reader && payload[DECRYPTED_FOR_FIELD] === reader);

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
    if (!isHiddenFrom(fields, payload, reader)) return null;
    const masked: UnknownRecord = { ...payload };
    fields.forEach(([flag, field, locked]) => {
      if (masked[flag]) masked[field] = locked();
      delete masked[flag];
    });
    delete masked[DECRYPTED_FOR_FIELD];
    return masked;
  };

export const stampDecryptedQuestion = stampFor(QUESTION_FIELDS);
export const stampDecryptedSurvey = stampFor(SURVEY_FIELDS);

/** Records in place that the text just decrypted into `payload` belongs to `reader`. */
export const markDecryptedFor = (payload: UnknownRecord, reader: unknown): void => {
  payload[DECRYPTED_FOR_FIELD] = normalizeWorkerCanonicalCacheReader(reader);
};

/** Whether a cache namespace keeps question or survey text in chain nodes. */
export const holdsChainText = (namespace: string): boolean =>
  Object.prototype.hasOwnProperty.call(CHAIN_TEXT, namespace);

// A cache root with `change` applied to the entries of its chain nodes. Only what
// changes is copied, and a root with no changes is returned as it is.
const mapChainEntries = (
  { collection }: ChainText,
  root: unknown,
  change: (entry: unknown, scope: string, id: string) => UnknownRecord | null,
): unknown => {
  if (!isRecord(root)) return root;
  let next: UnknownRecord | null = null;
  for (const [scope, node] of Object.entries(root)) {
    if (scope === WORKER_CANONICAL_CACHE_SCOPE_KEY || !isRecord(node) || !isRecord(node[collection])) continue;
    const entries = node[collection] as UnknownRecord;
    let changed: UnknownRecord | null = null;
    for (const id of Object.keys(entries)) {
      const entry = change(entries[id], scope, id);
      if (entry) (changed ??= { ...entries })[id] = entry;
    }
    if (changed) (next ??= { ...root })[scope] = { ...node, [collection]: changed };
  }
  return next ?? root;
};

/** The cache as `reader` may see it: chain text decrypted for anyone else is locked in a copy. */
export const readerViewOfChainText = (namespace: string, root: unknown, reader: string): unknown => {
  if (!holdsChainText(namespace)) return root;
  const chain = CHAIN_TEXT[namespace];
  const remask = remaskFor(chain.fields);
  return mapChainEntries(chain, root, (entry) => remask(entry, reader));
};

// The envelopes an entry's text is decrypted from, one per field.
const envelopesOf = (fields: readonly LockedField[], entry: UnknownRecord): unknown[] =>
  fields.map(([, , , envelopeFields]) => envelopeFields.map((name) => entry[name]).find(Boolean) ?? null);

type KeptText = { text: UnknownRecord; envelopes: unknown[] };
type DecryptedChainText = Record<string, Record<string, KeptText>>;

/** A copy of the decrypted chain text in `stored`, whoever it is for; null when there is none. */
export const decryptedChainTextIn = (namespace: string, stored: unknown): DecryptedChainText | null => {
  if (!holdsChainText(namespace)) return null;
  const chain = CHAIN_TEXT[namespace];
  let kept: DecryptedChainText | null = null;
  // Only reads each entry: the callback changes none of them.
  mapChainEntries(chain, stored, (entry, scope, id) => {
    if (!hasDecryptedText(chain.fields, entry)) return null;
    const text: UnknownRecord = {};
    chain.fields.forEach(([flag, field]) => {
      if (!entry[flag]) return;
      text[flag] = entry[flag];
      text[field] = Array.isArray(entry[field]) ? [...(entry[field] as unknown[])] : entry[field];
    });
    if (DECRYPTED_FOR_FIELD in entry) text[DECRYPTED_FOR_FIELD] = entry[DECRYPTED_FOR_FIELD];
    ((kept ??= {})[scope] ??= {})[id] = { text, envelopes: envelopesOf(chain.fields, entry) };
    return null;
  });
  return kept;
};

/**
 * `next` with `kept` put back on entries that come without decrypted text. A writer
 * may have read that text locked, as another account or before signing in, and
 * saving what it read must not lock it for the account it belongs to. Text the
 * writer decrypted itself wins, entries it left out stay out, and text goes back
 * only onto the envelopes it was decrypted from, so an edit never shows old text.
 */
export const withChainTextKept = (namespace: string, next: unknown, kept: DecryptedChainText | null): unknown => {
  if (!kept || !holdsChainText(namespace)) return next;
  const chain = CHAIN_TEXT[namespace];
  return mapChainEntries(chain, next, (entry, scope, id) => {
    const stored = kept[scope]?.[id];
    if (!stored || !isRecord(entry) || chain.fields.some(([flag]) => entry[flag])) return null;
    const envelopes = envelopesOf(chain.fields, entry);
    if (stored.envelopes.some((envelope, i) => envelope !== envelopes[i])) return null;
    return { ...entry, ...stored.text };
  });
};
