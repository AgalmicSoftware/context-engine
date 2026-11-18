import type { ContextNotReadEntry } from './contextCards.mjs';

export const SESSION_CONTEXT_TEXT_LIMITS: Readonly<{ itemChars: number; totalChars: number }>;

/** A context source's text, from the items the person the AI acts for may read. */
export type SessionContextPromptSource = {
  title?: string;
  kind?: 'link' | 'file';
  url?: string;
  text?: string;
  /** Text the session's AI read from a PDF. */
  readByAi?: boolean;
  /** Its card, when it has one: a source that finds no room in the block is then named there. */
  card?: unknown;
};

/** The session's notes, links and sources as one delimited block of untrusted data. */
export function buildSessionContextPrompt(input?: {
  sessionContext?: unknown;
  sources?: SessionContextPromptSource[];
  /** Sources not read for lack of room; those with a card are named in the block. */
  notRead?: ContextNotReadEntry[];
  itemChars?: number;
  totalChars?: number;
}): {
  text: string;
  included: number;
  omitted: number;
  /** Each included item: which of the session's links or notes, or of `sources`, by its place in that list. */
  items: Array<{ part: 'links' | 'notes' | 'sources'; index: number }>;
};
