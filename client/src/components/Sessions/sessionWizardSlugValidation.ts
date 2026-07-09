import { getReservedLegacySessionSlugs } from '../../utilities/session/sessionDemoCompat.js';
import { toStr } from '../../utilities/shared/primitives.js';

export const RESERVED_SESSION_SLUGS = getReservedLegacySessionSlugs();
export const REQUIRED_SESSION_SLUG_ERROR = 'A session slug is required.';

const RESERVED_SESSION_SLUG_LIST = Array.from(RESERVED_SESSION_SLUGS)
  .map((slug) => `"${slug}"`)
  .join(', ');

export const RESERVED_SESSION_SLUG_ERROR = `This slug is reserved for the default session or legacy compatibility aliases (${RESERVED_SESSION_SLUG_LIST}). Please choose a different slug.`;

export const INVALID_SESSION_SLUG_FORMAT_ERROR = 'Session slugs must use lowercase letters, numbers, "_" or "-".';

const VALID_SESSION_SLUG_REGEX = /^[a-z0-9_-]+$/;

export const isMissingSessionSlug = (slug: unknown): boolean => toStr(slug).trim() === '';

export const isReservedSessionSlug = (slug: unknown): boolean => {
  const normalized = toStr(slug).trim().toLowerCase();
  return RESERVED_SESSION_SLUGS.has(normalized);
};

export const hasInvalidSessionSlugFormat = (slug: unknown): boolean => {
  const raw = toStr(slug).trim();
  if (!raw) return false;
  return !VALID_SESSION_SLUG_REGEX.test(raw);
};

export const getSessionSlugValidationError = (slug: unknown): string => {
  if (isMissingSessionSlug(slug)) return REQUIRED_SESSION_SLUG_ERROR;
  if (hasInvalidSessionSlugFormat(slug)) return INVALID_SESSION_SLUG_FORMAT_ERROR;
  if (isReservedSessionSlug(slug)) return RESERVED_SESSION_SLUG_ERROR;
  return '';
};
