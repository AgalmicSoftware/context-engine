import {
  INVALID_SESSION_SLUG_FORMAT_ERROR,
  REQUIRED_SESSION_SLUG_ERROR,
  RESERVED_SESSION_SLUG_ERROR,
  getSessionSlugValidationError,
  hasInvalidSessionSlugFormat,
  isMissingSessionSlug,
  isReservedSessionSlug,
} from './sessionWizardSlugValidation';

describe('SessionWizard reserved slug validation', () => {
  it('marks "general" as reserved regardless of case or surrounding whitespace', () => {
    expect(isReservedSessionSlug('general')).toBe(true);
    expect(isReservedSessionSlug(' GENERAL ')).toBe(true);
    expect(isReservedSessionSlug('General')).toBe(true);
  });

  it('does not mark removed legacy demo aliases as reserved', () => {
    expect(isReservedSessionSlug('debate')).toBe(false);
    expect(isReservedSessionSlug(' DEBATE ')).toBe(false);
    expect(isReservedSessionSlug('rxc')).toBe(false);
    expect(isReservedSessionSlug(' RXC ')).toBe(false);
  });

  it('does not mark non-reserved slugs as reserved', () => {
    expect(isReservedSessionSlug('general-1')).toBe(false);
    expect(isReservedSessionSlug('community')).toBe(false);
  });

  it('rejects slug formats the worker will not accept', () => {
    expect(hasInvalidSessionSlugFormat('Bad Slug')).toBe(true);
    expect(hasInvalidSessionSlugFormat('mixedCase')).toBe(true);
    expect(hasInvalidSessionSlugFormat('bad.slug')).toBe(true);
    expect(hasInvalidSessionSlugFormat('good_slug-1')).toBe(false);
  });

  it('marks empty and blank slugs as missing (not reserved)', () => {
    expect(isMissingSessionSlug('')).toBe(true);
    expect(isMissingSessionSlug('   ')).toBe(true);
    expect(isReservedSessionSlug('')).toBe(false);
    expect(isReservedSessionSlug('   ')).toBe(false);
  });

  it('returns required-vs-reserved slug errors for the correct condition', () => {
    expect(getSessionSlugValidationError('')).toBe(REQUIRED_SESSION_SLUG_ERROR);
    expect(getSessionSlugValidationError('   ')).toBe(REQUIRED_SESSION_SLUG_ERROR);
    expect(getSessionSlugValidationError('Bad Slug')).toBe(INVALID_SESSION_SLUG_FORMAT_ERROR);
    expect(getSessionSlugValidationError('general')).toBe(RESERVED_SESSION_SLUG_ERROR);
    expect(getSessionSlugValidationError('debate')).toBe('');
    expect(getSessionSlugValidationError('rxc')).toBe('');
    expect(getSessionSlugValidationError('community')).toBe('');
  });

  it('uses the exact slug validation error copy', () => {
    expect(REQUIRED_SESSION_SLUG_ERROR).toBe('A session slug is required.');
    expect(INVALID_SESSION_SLUG_FORMAT_ERROR).toBe('Session slugs must use lowercase letters, numbers, "_" or "-".');
    expect(RESERVED_SESSION_SLUG_ERROR).toBe(
      'This slug is reserved for the default session or legacy compatibility aliases ("general"). Please choose a different slug.',
    );
  });
});
