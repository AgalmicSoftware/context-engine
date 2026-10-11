import { formatQuadraticAllocation, validateQuadraticAllocation } from '../../shared/questions/quadraticAllocation.mjs';

const unwrap = (value, depth = 0) => value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, 'value') && depth < 5
  ? unwrap(value.value, depth + 1) : value;
const scalarText = (value) => ['string', 'number', 'boolean'].includes(typeof value) ? String(value).trim() : '';
const binaryAliases = new Map([
  ...['agree', 'yes', 'y', 'true', '1'].map((key) => [key, 'Agree']),
  ...['disagree', 'no', 'n', 'false', '-1'].map((key) => [key, 'Disagree']),
  ...['unsure', 'unknown', 'maybe', 'neutral', '0'].map((key) => [key, 'Unsure']),
]);

// Validate readable canonical answers before lossy AI formatting or participant counts.
// Opaque storage remains type-agnostic; invalid submissions must not become model evidence.
export const formatValidAnalysisAnswer = (raw, question) => {
  const value = unwrap(raw);
  if (value == null || (typeof value === 'string' && !value.trim())) return '';
  switch (question.type) {
    case 'binary':
      return binaryAliases.get(scalarText(value).toLowerCase()) ?? null;
    case 'rating': {
      if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null;
      const number = Number(value);
      const { min = 0, max = 10 } = question.scale || {};
      return Number.isFinite(number) && number >= min && number <= max ? String(number) : null;
    }
    case 'multichoice': {
      const values = Array.isArray(value) ? value : [value];
      if (!values.length) return '';
      if (values.some((entry) => typeof entry !== 'string' || !entry.trim())) return null;
      const options = question.options || [];
      const selected = values.map((entry) => options.find((option) => option.toLowerCase() === entry.trim().toLowerCase()));
      if (selected.some((entry) => !entry)) return null;
      const unique = [...new Set(selected)];
      const limit = question.singleSelect ? 1 : question.maxSelections || options.length;
      return unique.length <= limit ? unique.join('; ') : null;
    }
    case 'quadratic':
      return validateQuadraticAllocation(value, question) ? null : formatQuadraticAllocation(value, question.options);
    case 'freeform':
    case 'text':
      return scalarText(value) || null;
    default:
      return scalarText(value) || null;
  }
};

const RATING_MIN = 0;
const RATING_MAX = 10;
// Interview drafts saved before 2026-09-30 stored ratings on a 0-100 scale.
const LEGACY_RATING_MAX = 100;

// Reads a stored importance or conviction rating on the 0-10 slider scale.
// Mirrors readStoredRating in client/src/utilities/survey/storedRating.ts:
// one `{ value }` wrapper is unwrapped; missing, blank, non-numeric, masked or
// encrypted values read as null; a value above 10 and at most 100 is a legacy
// 0-100 rating divided by 10; the result is clamped to 0-10.
export const readStoredRating = (value) => {
  const record = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  if (record?.encrypted === true) return null;
  const raw = record ? record.value : value;
  if (typeof raw !== 'number' && typeof raw !== 'string') return null;
  if (typeof raw === 'string' && !raw.trim()) return null;
  const rating = Number(raw);
  if (!Number.isFinite(rating)) return null;
  const scaled = rating > RATING_MAX && rating <= LEGACY_RATING_MAX ? rating / 10 : rating;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, scaled));
};
