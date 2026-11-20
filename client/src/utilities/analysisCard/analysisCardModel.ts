// The words on a personal analysis card, built from the AI analysis and the answers it was made from. Which
// answers it shows is chosen in shared/analysisCardAnswers.mjs, as the MCP chooses them.
import { chooseAnalysisCardAnswers } from '@ce-shared/analysisCardAnswers.mjs';

export const ANALYSIS_CARD_TASTES = ['book', 'game', 'film', 'song'] as const;
export type AnalysisCardTaste = (typeof ANALYSIS_CARD_TASTES)[number];
export type AnalysisCardPick = { title: string; by: string };
export type AnalysisCardYesNo = { prompt: string; text: string };
export type AnalysisCardOwnWords = { prompt: string; text: string; stance: string; trimmed: boolean };
// kind: the person picked options ('chose') or spread votes and these got the most ('votes').
export type AnalysisCardVote = { prompt: string; kind: 'chose' | 'votes'; items: string[] };
export type AnalysisCard = {
  // Whether the card is about the viewer's own answers; it decides "my" or "their" in the card's labels.
  own: boolean;
  // Where the card was made, printed at its foot: the site and the session's page, without "https://".
  link: string;
  // The account the answers belong to, shortened ("0x12ab…cd34"), or empty when it is not a wallet address.
  account: string;
  title: string;
  matchNote: string;
  figure: string;
  figureName: string;
  years: string;
  tastes: Record<AnalysisCardTaste, AnalysisCardPick | null>;
  answers: {
    yesNo: AnalysisCardYesNo | null;
    ownWords: AnalysisCardOwnWords | null;
    vote: AnalysisCardVote | null;
  };
};
// What the page knows about the card that the analysis does not.
export type AnalysisCardPlace = { own?: boolean; link?: string; account?: string };

type UnknownRecord = Record<string, unknown>;
const record = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
const flat = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/g, ' ').trim() : '';
// Text the model wrote is held to a length the card can set; the card's own layout cuts it to its lines.
const capped = (value: unknown, max: number): string => flat(value).slice(0, max).trim();

export const ANALYSIS_CARD_SITE = 'contextengine.sh';
const TITLE_MAX = 90;
const MATCH_NOTE_MAX = 340;
const WORK_MAX = 80;

// The printed link is plain text on a picture: a host and a path, never a query, and short enough to read.
const cardLink = (value: unknown): string => {
  const link = flat(value)
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  if (/^[a-z0-9.-]+(?::\d+)?(?:\/[\w.~%-]+)*$/i.test(link) && link.length <= 80) return link;
  // A link that cannot be printed whole is cut to its site. A site that cannot be printed either shows nothing:
  // another site's name must never stand in for it.
  const host = link.split('/')[0];
  return /^[a-z0-9.-]+(?::\d+)?$/i.test(host) && host.length <= 80 ? host : '';
};

// "0x12ab…cd34" from a full wallet address, or from a form already shortened; anything else shows nothing.
const cardAccount = (value: unknown): string => {
  const text = flat(value);
  const full = /^0x([0-9a-f]{4})[0-9a-f]{32}([0-9a-f]{4})$/i.exec(text);
  if (full) return `0x${full[1]}…${full[2]}`.toLowerCase();
  return /^0x[0-9a-f]{4}…[0-9a-f]{4}$/i.test(text) ? text.toLowerCase() : '';
};

const splitFigure = (figure: string): { figureName: string; years: string } => {
  const match = figure.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  return match ? { figureName: match[1].trim(), years: match[2].trim() } : { figureName: figure, years: '' };
};

// Reads a card back from the analysis cache, keeping only well-formed parts.
export const normalizeAnalysisCard = (value: unknown): AnalysisCard | null => {
  const card = record(value);
  const figure = capped(card.figure, 90);
  const title = capped(card.title, TITLE_MAX).replace(/[.]$/, '');
  if (!figure || !title) return null;
  const tastes = record(card.tastes);
  const answers = record(card.answers);
  const pick = (kind: AnalysisCardTaste): AnalysisCardPick | null => {
    const work = record(tastes[kind]);
    return flat(work.title) ? { title: capped(work.title, WORK_MAX), by: capped(work.by, WORK_MAX) } : null;
  };
  const yesNo = record(answers.yesNo);
  const ownWords = record(answers.ownWords);
  const vote = record(answers.vote);
  const items = (Array.isArray(vote.items) ? vote.items : []).map(flat).filter(Boolean);
  return {
    own: card.own === true,
    // Only a card that was never given a place falls back to the site's own name.
    link: card.link === undefined ? ANALYSIS_CARD_SITE : cardLink(card.link),
    account: cardAccount(card.account),
    title,
    matchNote: capped(card.matchNote, MATCH_NOTE_MAX),
    figure,
    ...splitFigure(figure),
    tastes: { book: pick('book'), game: pick('game'), film: pick('film'), song: pick('song') },
    answers: {
      yesNo: flat(yesNo.prompt) && flat(yesNo.text) ? { prompt: flat(yesNo.prompt), text: flat(yesNo.text) } : null,
      ownWords:
        flat(ownWords.prompt) && flat(ownWords.text)
          ? {
              prompt: flat(ownWords.prompt),
              text: flat(ownWords.text),
              stance: flat(ownWords.stance),
              trimmed: ownWords.trimmed === true,
            }
          : null,
      vote:
        flat(vote.prompt) && items.length
          ? { prompt: flat(vote.prompt), kind: vote.kind === 'votes' ? 'votes' : 'chose', items }
          : null,
    },
  };
};

// Builds the card from the model's reply and the questions payload the analysis was given. Returns null when
// there is no figure or no title to show.
export const buildAnalysisCard = (
  analysis: unknown,
  questions: unknown,
  place: AnalysisCardPlace = {},
): AnalysisCard | null => {
  const reply = record(analysis);
  const raw = record(reply.card);
  return normalizeAnalysisCard({
    ...place,
    title: raw.title,
    matchNote: raw.matchNote,
    figure: record(reply.historicalAlignment).figure,
    tastes: raw.tastes,
    answers: chooseAnalysisCardAnswers(questions, raw.answers),
  });
};
