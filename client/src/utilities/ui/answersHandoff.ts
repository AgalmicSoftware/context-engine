/**
 * @file answersHandoff.ts: a person's unsaved answers, copied out of a browser where sign-in failed and loaded
 * into another, usually a phone. The answers travel only in the address fragment, as `#answers=`, or in a pasted
 * message; no request carries them. They are the browser's own signed-out records, moved as they are: a typed
 * answer stays typed, an interview's review keeps its edits and research choices, and nothing is relabelled.
 * This is not `#prefill=`, which holds an AI's drafts and marks them as such.
 */
import {
  decodeLinkBytes,
  decodeLinkUtf8,
  deflateLinkBytes,
  encodeBase64Url,
  inflateLinkBytes,
  parseLinkJson,
  readLinkParam,
} from '../../../../shared/linkPayload.mjs';
import { buildCopyPageLink } from './arrivalLink';

export const ANSWERS_KEY = 'answers';
const PASTE_VALUE = 'paste';
// Typed answers kept signed out, in this tab: dg:surveyDraft:<session>:<network>:anon:<scope>.
const TYPED_PREFIX = 'dg:surveyDraft:';
const TYPED_KEY = /^dg:surveyDraft:[^:]*:[^:]+:anon:.+$/;
// An interview's review kept signed out, in this browser: ce:interview-review:v1:<session>:browser.
const REVIEW_PREFIX = 'ce:interview-review:v1:';
const REVIEW_KEY = /^ce:interview-review:v1:[^:]+:browser$/;
const NOTE_KEY = 'ce:answersHandoff:note';
// Chat apps and email keep a link of this length whole; a longer one goes as a short link and a code to paste.
export const ANSWERS_LINK_MAX_CHARS = 2000;
const MAX_PACKED_CHARS = 400_000;
const MAX_UNPACKED_BYTES = 2_000_000;

type Records = Record<string, Record<string, unknown>>;
type Packet = { typed: Records; reviews: Records };

/** What arrived, for the notice: how many answers loaded, and how many stayed out because the phone had its own. */
export type AnswersHandoffNote =
  { kind: 'loaded'; typed: number; interview: number; kept: number } | { kind: 'paste'; error: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const readRecord = (store: Storage, key: string): Record<string, unknown> | null => {
  try {
    const value = JSON.parse(store.getItem(key) || 'null');
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
};
const stores = (): { tab: Storage; browser: Storage } | null => {
  try {
    return { tab: window.sessionStorage, browser: window.localStorage };
  } catch {
    return null;
  }
};
const typedCount = (record: Record<string, unknown> | null) =>
  isRecord(record?.answers) ? Object.keys(record.answers).length : 0;
// The drafts of a kept review that the person has not removed.
const reviewCount = (record: Record<string, unknown> | null) => {
  const review = isRecord(record?.review) ? record.review : {};
  const removed = isRecord(review.removedDraftIds) ? review.removedDraftIds : {};
  return (Array.isArray(review.drafts) ? review.drafts : []).filter(
    (draft) => isRecord(draft) && typeof draft.questionId === 'string' && removed[draft.questionId] !== true,
  ).length;
};

// The session this page shows, from its address: /session/<slug> or ?session=<slug>.
const pageSessionSlug = (): string => {
  const fromPath = /^\/session\/([^/]+)/.exec(window.location.pathname)?.[1] || '';
  const slug = fromPath ? decodeURIComponent(fromPath) : new URLSearchParams(window.location.search).get('session');
  return String(slug || '')
    .trim()
    .toLowerCase();
};

const collect = (): Packet => {
  const packet: Packet = { typed: {}, reviews: {} };
  const held = stores();
  if (!held) return packet;
  const slugs = new Set([pageSessionSlug()]);
  for (let index = 0; index < held.tab.length; index += 1) {
    const key = held.tab.key(index) || '';
    if (!TYPED_KEY.test(key)) continue;
    const record = readRecord(held.tab, key);
    if (!record || !typedCount(record)) continue;
    packet.typed[key] = record;
    slugs.add(key.slice(TYPED_PREFIX.length).split(':')[0].toLowerCase());
  }
  slugs.forEach((slug) => {
    const key = `${REVIEW_PREFIX}${slug}:browser`;
    const record = slug ? readRecord(held.browser, key) : null;
    if (record && reviewCount(record)) packet.reviews[key] = record;
  });
  return packet;
};

const countOf = ({ typed, reviews }: Packet) =>
  Object.values(typed).reduce((sum, record) => sum + typedCount(record), 0) +
  Object.values(reviews).reduce((sum, record) => sum + reviewCount(record), 0);

/** How many unsaved answers this browser holds signed out: typed here, or drafted in an interview. */
export const countUnsavedAnswers = (): number => {
  try {
    return countOf(collect());
  } catch {
    return 0;
  }
};

const pack = async (packet: Packet): Promise<string> =>
  encodeBase64Url(
    await deflateLinkBytes(new TextEncoder().encode(JSON.stringify({ v: 1, t: packet.typed, r: packet.reviews }))),
  );

const withAnswersPart = (value: string): string => {
  const link = buildCopyPageLink();
  const [page, fragment = ''] = link.split('#', 2);
  const parts = fragment.split('&').filter((part) => part && part.split('=', 1)[0] !== ANSWERS_KEY);
  return `${page}#${[...parts, `${ANSWERS_KEY}=${value}`].join('&')}`;
};

/**
 * The text to copy: one link while it is short enough to survive a chat app, else a short link that opens the
 * paste box and, on its own line, the code to paste there. Null when there is nothing unsaved, or where this
 * browser cannot pack it.
 */
export const buildAnswersCopyText = async (): Promise<string | null> => {
  const packet = collect();
  if (!countOf(packet)) return null;
  try {
    const code = await pack(packet);
    const link = withAnswersPart(code);
    return link.length <= ANSWERS_LINK_MAX_CHARS ? link : `${withAnswersPart(PASTE_VALUE)}\n${code}`;
  } catch {
    return null;
  }
};

/**
 * The copy text for a one-line box, such as the browser's own prompt when the clipboard is refused: the two-line
 * form with a space for its line break, so the short link still ends before the code.
 */
export const answersCopyTextOnOneLine = (text: string): string => text.replace(/\s*\n\s*/g, ' ');

// The code out of whatever was pasted: a whole link, the two-line message, or the code alone. A link's own
// `answers=` part comes first, then a code on a line of its own; the link may also carry an AI's drafts, which are
// a code of another kind and can be the longer one.
const codeIn = (pasted: string): string => {
  const text = String(pasted || '');
  const longest = (codes: string[]) => [...codes].sort((a, b) => b.length - a.length)[0] || '';
  const parts = [...text.matchAll(/[#&]answers=([A-Za-z0-9_-]+)/g)].map((match) => match[1]);
  const lines = text.split(/\s+/).filter((line) => /^[A-Za-z0-9_-]{24,}$/.test(line));
  return (
    longest(parts.filter((part) => part !== PASTE_VALUE)) ||
    longest(lines) ||
    longest(text.match(/[A-Za-z0-9_-]{24,}/g) || [])
  );
};

const UNREADABLE = 'These answers couldn’t be read: the link or message was cut off. Paste all of it here.';

const unpack = async (code: string): Promise<Packet | null> => {
  const decoded = decodeLinkBytes(code, { maxLength: MAX_PACKED_CHARS });
  if (!decoded.ok) return null;
  let bytes: Uint8Array | null;
  try {
    bytes = await inflateLinkBytes(decoded.bytes, MAX_UNPACKED_BYTES);
  } catch {
    return null;
  }
  const text = bytes ? decodeLinkUtf8(bytes) : null;
  const parsed = text?.ok ? parseLinkJson(text.text) : null;
  const value = parsed?.ok && isRecord(parsed.value) ? parsed.value : null;
  if (value?.v !== 1) return null;
  const kept = (records: unknown, pattern: RegExp): Records =>
    Object.fromEntries(
      Object.entries(isRecord(records) ? records : {}).filter(
        (entry): entry is [string, Record<string, unknown>] => pattern.test(entry[0]) && isRecord(entry[1]),
      ),
    );
  return { typed: kept(value.t, TYPED_KEY), reviews: kept(value.r, REVIEW_KEY) };
};

/**
 * Loads copied answers into this browser's own signed-out records, where the page already looks for them.
 * Answers this browser holds for the same record are kept, and counted. An interview's review starts its hour
 * afresh here, and is asked about before it shows, like every review kept signed out; it is marked as copied,
 * so it is offered on a phone that is already signed in too.
 */
export const loadCopiedAnswers = async (pasted: string, now = Date.now()): Promise<AnswersHandoffNote> => {
  const failed: AnswersHandoffNote = { kind: 'paste', error: UNREADABLE };
  const code = codeIn(pasted);
  // A box that dropped the line break joins the short link's `paste` to the code; the code read whole comes first.
  const packet = code
    ? ((await unpack(code)) ?? (code.startsWith(PASTE_VALUE) ? await unpack(code.slice(PASTE_VALUE.length)) : null))
    : null;
  const held = stores();
  if (!packet || !held || !countOf(packet)) return failed;
  const note = { kind: 'loaded' as const, typed: 0, interview: 0, kept: 0 };
  try {
    Object.entries(packet.typed).forEach(([key, record]) => {
      if (typedCount(readRecord(held.tab, key))) note.kept += typedCount(record);
      else {
        held.tab.setItem(key, JSON.stringify(record));
        note.typed += typedCount(record);
      }
    });
    Object.entries(packet.reviews).forEach(([key, record]) => {
      if (reviewCount(readRecord(held.browser, key))) note.kept += reviewCount(record);
      else {
        // Marked as copied, so a phone already signed in still offers it (asking first), as no account owns it.
        held.browser.setItem(key, JSON.stringify({ ...record, v: 1, owner: 'browser', savedAt: now, copied: true }));
        note.interview += reviewCount(record);
      }
    });
  } catch {
    return { kind: 'paste', error: 'This browser couldn’t keep the answers: its storage is full or turned off.' };
  }
  return note;
};

const leaveNote = (note: AnswersHandoffNote) => {
  try {
    window.sessionStorage.setItem(NOTE_KEY, JSON.stringify(note));
  } catch {
    /* Without storage there was nowhere to load answers either. */
  }
};

/** The notice left by an arrival or a paste, read once. */
export const takeAnswersHandoffNote = (): AnswersHandoffNote | null => {
  try {
    const note = JSON.parse(window.sessionStorage.getItem(NOTE_KEY) || 'null');
    window.sessionStorage.removeItem(NOTE_KEY);
    return isRecord(note) && (note.kind === 'loaded' || note.kind === 'paste') ? (note as AnswersHandoffNote) : null;
  } catch {
    return null;
  }
};

/** Loads a pasted message, then reloads so the page reads the answers; says why when it cannot. */
export const loadPastedAnswers = async (pasted: string): Promise<string> => {
  const note = await loadCopiedAnswers(pasted);
  if (note.kind === 'paste') return note.error;
  leaveNote(note);
  window.location.reload();
  return '';
};

/** Whether the address carries copied answers, or asks for the box to paste them into. */
export const hasAnswersInAddress = (): boolean => readLinkParam(window.location.hash, ANSWERS_KEY) !== null;

/**
 * Takes `#answers=` out of the address as the app starts, before the router reads it and before anything is
 * fetched, and loads what it carried. Resolves at once when the address has none.
 */
export const takeAnswersFromAddress = async (): Promise<void> => {
  const { pathname, search, hash } = window.location;
  const value = readLinkParam(hash, ANSWERS_KEY);
  if (value === null) return;
  const rest = hash
    .replace(/^#/, '')
    .split('&')
    .filter((part) => part && part.split('=', 1)[0] !== ANSWERS_KEY);
  window.history.replaceState(
    window.history.state,
    '',
    `${pathname}${search}${rest.length ? `#${rest.join('&')}` : ''}`,
  );
  leaveNote(value === PASTE_VALUE ? { kind: 'paste', error: '' } : await loadCopiedAnswers(value));
};

/** A link pasted into a tab that is already open changes only the fragment: take it, then reload to read it. */
export const watchAddressForAnswers = () => {
  window.addEventListener('hashchange', () => {
    if (!hasAnswersInAddress()) return;
    void takeAnswersFromAddress().then(() => window.location.reload());
  });
};
