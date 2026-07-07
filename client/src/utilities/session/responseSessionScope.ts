import { normalizeSessionSlug } from './sessionNaming.js';

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};

const firstNormalizedSlug = (...values: unknown[]): string => {
  for (const value of values) {
    const slug = normalizeSessionSlug(value || '');
    if (slug) return slug;
  }
  return '';
};

export const resolveResponseSessionSlug = (response: unknown): string => {
  const record = asRecord(response);
  const sessionRecord = asRecord(record.session);
  const metadataRecord = asRecord(record.metadata);
  const metaRecord = asRecord(record.meta);
  const contextRecord = asRecord(record.context);
  return firstNormalizedSlug(
    record.sessionSlug,
    record.slug,
    record.groupSlug,
    record.questionSessionSlug,
    record.sourceSessionSlug,
    record.__sessionSlug,
    sessionRecord.slug,
    sessionRecord.sessionSlug,
    metadataRecord.sessionSlug,
    metadataRecord.slug,
    metaRecord.sessionSlug,
    metaRecord.slug,
    contextRecord.sessionSlug,
    contextRecord.slug,
  );
};

export const isResponseAllowedForSessionSlug = (response: unknown, expectedSessionSlug: unknown = ''): boolean => {
  const expected = normalizeSessionSlug(expectedSessionSlug || '');
  if (!expected) return true;
  const actual = resolveResponseSessionSlug(response);
  return !actual || actual === expected;
};
