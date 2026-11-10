export type SessionContextLink = { label: string; url: string };

/**
 * A session's notes and links as stored in its config, or instead an uploaded
 * HTML page (`html`), which replaces the paragraphs and links. The title stays.
 */
export type SessionContext = { title: string; paragraphs: string[]; links: SessionContextLink[]; html?: string };

export const SESSION_CONTEXT_LIMITS: Readonly<{
  titleChars: number;
  paragraphs: number;
  paragraphChars: number;
  links: number;
  labelChars: number;
  urlChars: number;
  htmlChars: number;
}>;

export type SessionContextError = { path: string; message: string };

export function isHttpsUrl(value: unknown): boolean;

/** Some HTML's words, one line per block. Runs without a DOM; not a sanitizer. */
export function htmlToPlainText(html: unknown): string;

/** For readers: invalid entries dropped and text clamped to the limits; never null. */
export function normalizeSessionContext(value: unknown): SessionContext;

/** True when the context has HTML, a paragraph or a link. */
export function hasSessionContext(value: unknown): boolean;

/** The HTML's words, without tags; '' when the context is typed text. */
export function sessionContextHtmlText(value: unknown): string;

/** For writers: refuses wrong types, over-limit text, and text with HTML; returns the stored form. */
export function validateSessionContext(
  value: unknown,
): { ok: true; value: SessionContext | null; errors: [] } | { ok: false; errors: SessionContextError[] };

/** Title, HTML words, paragraphs and link labels as one line of plain text. */
export function sessionContextPlainText(value: unknown): string;
