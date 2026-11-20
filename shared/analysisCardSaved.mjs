// A personal analysis card as it is saved on a person's page: the card's words only, never the page it is shown
// on or whose page it is (the Worker files it under the signed-in person's own address, and the page prints its
// own link and account). The same check runs in the Worker before a card is stored and in the page before one is
// sent, so a card the page would show is a card the Worker will keep.
import { parseAnalysisCardFigure } from './analysisCardPicture.mjs';

const TASTES = ['book', 'game', 'film', 'song'];
// The largest card kept, as UTF-8 JSON. The caps below keep every card well under it in Latin script; a card in a
// script of three-byte letters can reach it, and is then refused rather than cut.
export const ANALYSIS_CARD_SAVED_MAX_BYTES = 8_000;

// What the model writes is held to what the card can set, as the page holds it.
const TITLE_MAX = 90;
const MATCH_NOTE_MAX = 340;
const WORK_MAX = 80;
// The person's own words. The card shows at most eight lines of an answer, so a longer one is cut at a word, with
// an ellipsis, well past anything the card can show.
const PROMPT_MAX = 300;
const ANSWER_MAX = 600;
const STANCE_MAX = 40;
// The card shows a vote's first three options and counts the rest ("+ 5 more"), so every option is kept, the
// uncounted ones short.
const VOTE_ITEMS_MAX = 40;
const VOTE_ITEM_MAX = 120;
const VOTE_MORE_MAX = 40;
const VOTE_SHOWN = 3;

const record = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const flat = (value) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).normalize('NFC').replace(/\s+/g, ' ').trim() : '';
const capped = (value, max) => [...flat(value)].slice(0, max).join('').trim();
const atWord = (value, max) => {
  const text = flat(value);
  const letters = [...text];
  if (letters.length <= max) return text;
  const cut = letters.slice(0, max - 1).join('');
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).trim()}…`;
};

const work = (value) => {
  const pick = record(value);
  const title = capped(pick.title, WORK_MAX);
  return title ? { title, by: capped(pick.by, WORK_MAX) } : null;
};

const yesNoOf = (value) => {
  const answer = record(value);
  const prompt = atWord(answer.prompt, PROMPT_MAX);
  const text = capped(answer.text, STANCE_MAX);
  return prompt && text ? { prompt, text } : null;
};

const ownWordsOf = (value) => {
  const answer = record(value);
  const prompt = atWord(answer.prompt, PROMPT_MAX);
  const text = atWord(answer.text, ANSWER_MAX);
  return prompt && text
    ? { prompt, text, stance: capped(answer.stance, STANCE_MAX), trimmed: answer.trimmed === true }
    : null;
};

const voteOf = (value) => {
  const answer = record(value);
  const prompt = atWord(answer.prompt, PROMPT_MAX);
  const items = (Array.isArray(answer.items) ? answer.items : [])
    .map((item) => flat(item))
    .filter(Boolean)
    .slice(0, VOTE_ITEMS_MAX)
    .map((item, index) => atWord(item, index < VOTE_SHOWN ? VOTE_ITEM_MAX : VOTE_MORE_MAX));
  return prompt && items.length ? { prompt, kind: answer.kind === 'votes' ? 'votes' : 'chose', items } : null;
};

// The card to keep, in one shape, or null when it is not a card: it needs a title and a figure the picture route
// would accept ("Name (years)"), and must fit ANALYSIS_CARD_SAVED_MAX_BYTES. Anything else in the value is dropped.
export const normalizeSavedAnalysisCard = (value) => {
  const card = record(value);
  const figure = parseAnalysisCardFigure(card.figure)?.figure;
  const title = capped(card.title, TITLE_MAX);
  if (!figure || !title) return null;
  const tastes = record(card.tastes);
  const answers = record(card.answers);
  const saved = {
    title,
    matchNote: capped(card.matchNote, MATCH_NOTE_MAX),
    figure,
    tastes: Object.fromEntries(TASTES.map((kind) => [kind, work(tastes[kind])])),
    answers: { yesNo: yesNoOf(answers.yesNo), ownWords: ownWordsOf(answers.ownWords), vote: voteOf(answers.vote) },
  };
  return new TextEncoder().encode(JSON.stringify(saved)).length <= ANALYSIS_CARD_SAVED_MAX_BYTES ? saved : null;
};

/** What a Session Worker with the analysis card advertises; an older one has neither its picture nor saved card. */
export const ANALYSIS_CARD_FEATURE = 'analysis_card_v1';

/**
 * What a Session Worker advertises when it keeps the drawn picture of a saved card and answers for a figure's
 * portrait without drawing one. An older Worker would draw (and spend an AI call) for the same request, so
 * neither is ever asked of a Worker that doesn't list this.
 */
export const ANALYSIS_CARD_DRAWING_FEATURE = 'analysis_card_drawing_v1';
// The drawn card: its two pages as the page draws them, each a JPEG or PNG of at most this many bytes.
export const ANALYSIS_CARD_DRAWING_PAGES_MAX = 2;
export const ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES = 1024 * 1024;
const DRAWING_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const DRAWING_SIGNATURES = Object.freeze({
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
});

/**
 * The pages of a drawn card to keep, as `[{ mime, base64 }]`, or null when they are not that: one or two pages,
 * each standard base64 of a JPEG or PNG whose first bytes say so, within the size limit. Nothing else is kept.
 */
export const normalizeAnalysisCardDrawing = (value) => {
  if (!Array.isArray(value) || !value.length || value.length > ANALYSIS_CARD_DRAWING_PAGES_MAX) return null;
  const pages = [];
  for (const entry of value) {
    const page = record(entry);
    const signature = Object.hasOwn(DRAWING_SIGNATURES, page.mime) ? DRAWING_SIGNATURES[page.mime] : null;
    const base64 = typeof page.base64 === 'string' ? page.base64 : '';
    // Four characters hold three bytes, so the length bounds the size before anything is decoded.
    if (!signature || !base64 || base64.length % 4 !== 0 || base64.length > Math.ceil(ANALYSIS_CARD_DRAWING_PAGE_MAX_BYTES / 3) * 4) return null;
    if (!DRAWING_BASE64.test(base64)) return null;
    let head;
    try {
      head = atob(base64.slice(0, 12));
    } catch {
      return null;
    }
    if (!signature.every((byte, index) => head.charCodeAt(index) === byte)) return null;
    pages.push({ mime: page.mime, base64 });
  }
  return pages;
};

/**
 * The analysis card is off unless the session has it on (`analysisCardEnabled: true`). A session made on /new
 * starts with it on, because the box there starts ticked; one that never saved the setting, as every session
 * from before the card, has it off until an admin turns it on in Settings. Off, the Worker refuses the card's
 * picture and saved card before counting, reading or storing anything, and the page neither makes nor shows a
 * card. This is the one place that reads the switch.
 */
export const analysisCardOn = (config) => config?.analysisCardEnabled === true;

/**
 * Whether the session keeps each person's answers to that person and its admins (results shown as totals only,
 * or to admins only). A card is made from a person's answers and quotes them, so none is saved on a page there:
 * the Worker refuses the save and the page does not offer it.
 */
export const analysisCardAnswersArePrivate = (config) => {
  const profile = config?.sessionModeProfile;
  const visibility = profile?.results?.visibility;
  return (
    profile?.authority?.mode === 'worker_canonical' &&
    !!visibility &&
    visibility !== 'public_full_if_storage_public' &&
    visibility !== 'session_member_full'
  );
};
