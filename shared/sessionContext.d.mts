export type SessionContextLink = { label: string; url: string };

/** A session's notes and links as stored in its config. */
export type SessionContext = { title: string; paragraphs: string[]; links: SessionContextLink[] };

export const SESSION_CONTEXT_LIMITS: Readonly<{
  titleChars: number;
  paragraphs: number;
  paragraphChars: number;
  links: number;
  labelChars: number;
  urlChars: number;
}>;

export type SessionContextError = { path: string; message: string };

export function isHttpsUrl(value: unknown): boolean;

/** For readers: invalid entries dropped and text clamped to the limits; never null. */
export function normalizeSessionContext(value: unknown): SessionContext;

/** True when the context has a paragraph or a link. */
export function hasSessionContext(value: unknown): boolean;

/** For writers: refuses wrong types and over-limit text; returns the stored form. */
export function validateSessionContext(
  value: unknown,
): { ok: true; value: SessionContext | null; errors: [] } | { ok: false; errors: SessionContextError[] };

/** Title, paragraphs and link labels as one line of plain text. */
export function sessionContextPlainText(value: unknown): string;
