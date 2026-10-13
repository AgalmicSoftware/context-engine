import { RATING_MAX, RATING_MIN } from './ratingValue';

// Interview drafts saved before 2026-09-30 stored ratings on a 0-100 scale.
const LEGACY_RATING_MAX = 100;

/**
 * Reads a stored importance or conviction rating on the 0-10 slider scale.
 *
 * Every reader uses this rule, and the Worker results analysis mirrors it:
 * - A number or numeric string is read as a number. A `{ value }` wrapper is
 *   unwrapped once.
 * - A value above 10 and at most 100 is a legacy interview rating on the 0-100
 *   scale and is divided by 10. Stored responses were not migrated.
 * - The result is clamped to 0-10.
 * - Missing, blank, non-numeric, masked ('*') or encrypted values read as null.
 *
 * A legacy rating of 10 or less cannot be told apart from a 0-10 rating, so it
 * reads as given.
 */
export const readStoredRating = (value: unknown): number | null => {
  const record =
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  if (record?.encrypted === true) return null;
  const raw = record ? record.value : value;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const rating = Number(raw);
  if (!Number.isFinite(rating)) return null;
  const scaled = rating > RATING_MAX && rating <= LEGACY_RATING_MAX ? rating / 10 : rating;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, scaled));
};
