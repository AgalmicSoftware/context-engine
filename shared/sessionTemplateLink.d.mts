import type { SessionTemplateError, SessionTemplateResult } from './sessionTemplate.mjs';

/** Above this many characters, offer the template as a .json download instead of a link. */
export const SESSION_TEMPLATE_LINK_MAX_LENGTH: number;

export type SessionTemplateLinkResult =
  | { ok: true; fragment: string }
  | { ok: false; reason: 'too_long'; length: number }
  | { ok: false; reason: 'invalid'; errors: SessionTemplateError[] };

/** Validates a template, then packs it into a `#template=` URL fragment. */
export function encodeSessionTemplateLink(template: unknown): Promise<SessionTemplateLinkResult>;

/**
 * Reads a URL fragment such as `location.hash`: null when it carries no
 * template; otherwise the validated template or the reasons it was refused.
 */
export function decodeSessionTemplateLink(hash: unknown): Promise<SessionTemplateResult | null>;
