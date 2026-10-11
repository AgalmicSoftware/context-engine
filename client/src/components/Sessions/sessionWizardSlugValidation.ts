import { getReservedLegacySessionSlugs } from '../../utilities/session/sessionDemoCompat.js';
import { canonicalizeSessionSlug } from '../../utilities/session/sessionSlug';
import { toStr } from '../../utilities/shared/primitives.js';

// Slugs whose link opens a different session: the default-session alias, the
// retired `debate` alias the session Worker maps to `rxc`
// (workers/sessionCorsWorker/sessionSlugResolution.js), and names the session
// route resolves to the default session (sessionSlug.ts).
export const RESERVED_SESSION_SLUGS: ReadonlySet<string> = new Set([
  ...getReservedLegacySessionSlugs(),
  'debate',
  'constructor',
  'prototype',
]);
export const REQUIRED_SESSION_SLUG_ERROR = 'A session slug is required.';

const RESERVED_SESSION_SLUG_LIST = Array.from(RESERVED_SESSION_SLUGS)
  .map((slug) => `"${slug}"`)
  .join(', ');

export const RESERVED_SESSION_SLUG_ERROR = `This slug is reserved because its link opens a different session (${RESERVED_SESSION_SLUG_LIST}). Please choose a different slug.`;

export const INVALID_SESSION_SLUG_FORMAT_ERROR =
  'Session slugs must start with a lowercase letter or number and use at most 128 lowercase letters, numbers, "_" or "-".';

// The participant link opens only slugs the Worker bootstrap accepts
// (validateExactSlug in sessionWorkerDiscovery.ts). Anything looser would
// publish a session nobody can open.
const VALID_SESSION_SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{0,127}$/;

export const isMissingSessionSlug = (slug: unknown): boolean => toStr(slug).trim() === '';

export const isReservedSessionSlug = (slug: unknown): boolean => {
  const normalized = toStr(slug).trim().toLowerCase();
  if (!normalized) return false;
  return RESERVED_SESSION_SLUGS.has(normalized) || canonicalizeSessionSlug(normalized) !== normalized;
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
