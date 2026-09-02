import {
  DEFAULT_SESSION_SLUG,
  DEFAULT_SESSION_STORAGE_KEY,
  canonicalizeSessionSlug,
  normalizeBoundedSessionStorageSlug,
  normalizeRegistrySessionSlugForRead,
  normalizeRegistrySessionSlugForWriteValue,
  normalizeSessionSlugAlias,
  normalizeSessionSlugToken,
  parseSessionSlug,
  sanitizeSessionSlug,
  sessionSlugStorageKey,
} from './sessionSlug';

describe('sessionSlug', () => {
  it('keeps identity and storage sentinels explicit', () => {
    expect(DEFAULT_SESSION_SLUG).toBe('');
    expect(DEFAULT_SESSION_STORAGE_KEY).toBe('general');
    expect(canonicalizeSessionSlug(' general ')).toBe('');
    expect(sessionSlugStorageKey('')).toBe('general');
    expect(sessionSlugStorageKey('Alpha')).toBe('alpha');
  });

  it('preserves custom identity spelling while rejecting reserved object keys', () => {
    expect(parseSessionSlug(' Mixed Session ')).toEqual({ ok: true, slug: 'Mixed Session' });
    expect(parseSessionSlug('__proto__')).toEqual({ ok: false, error: 'This session slug is reserved.' });
    expect(canonicalizeSessionSlug('constructor')).toBe('');
  });

  it('keeps the historical comparison and Worker-config conversions distinct', () => {
    expect(normalizeSessionSlugAlias(' Mixed Session ')).toBe('mixed session');
    expect(sanitizeSessionSlug(' Mixed Session! ')).toBe('mixedsession');
    expect(normalizeSessionSlugToken('GENERAL')).toBe('');
    expect(normalizeRegistrySessionSlugForWriteValue('', 'primary')).toBe('primary');
    expect(normalizeRegistrySessionSlugForRead('primary', 'primary')).toBe('');
    expect(normalizeRegistrySessionSlugForRead('Primary', 'primary')).toBe('Primary');
    expect(normalizeBoundedSessionStorageSlug('')).toBe('general');
    expect(normalizeBoundedSessionStorageSlug('bad slug')).toBe('');
  });
});
