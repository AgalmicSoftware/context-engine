export const CONTEXT_CARD_LIMITS: Readonly<{
  summaryChars: number;
  tags: number;
  tagChars: number;
  names: number;
  nameChars: number;
  bytes: number;
  sourceChars: number;
  documentBytes: number;
  replyChars: number;
  modelChars: number;
}>;

export const CONTEXT_CARD_COST_USD: number;

export const CONTEXT_CARD_WRITERS: readonly ['ai', 'admin', 'adder'];

/** What a card says of its source. */
export type ContextCardContent = { summary: string; tags: string[]; names: string[] };

/** A stored card: its content, who wrote it and when, and the model when the session's AI did. */
export type ContextCard = ContextCardContent & { by: 'ai' | 'admin' | 'adder'; at?: string; model?: string };

/** A source that was not read, for a prompt block's "not read" list. */
export type ContextNotReadEntry = { title?: string; kind?: 'link' | 'file'; card?: unknown };

export function contextCardContent(value: unknown): ContextCardContent | null;
export function normalizeContextCard(value: unknown): ContextCard | null;
export function parseContextCardReply(reply: unknown): ContextCardContent | null;

export const NOT_READ_NOTE: string;
export function fitNotRead(
  entries: unknown,
  room: number,
  encode?: (value: unknown) => string,
): { data: { notRead: Array<Record<string, unknown>>; notReadMore?: number } | null; chars: number };
