import { ensureHttpUrl, normalizeBaseUrl, normalizeOrigin, normalizeOriginList } from './urlUtils.js';

describe('urlUtils', () => {
  describe('ensureHttpUrl', () => {
    it('preserves empty values, absolute URLs, and root-relative paths', () => {
      expect(ensureHttpUrl(null)).toBe('');
      expect(ensureHttpUrl('https://example.test/path')).toBe('https://example.test/path');
      expect(ensureHttpUrl('/api/session')).toBe('/api/session');
    });

    it('adds an http scheme for loopback hosts and https for other hosts', () => {
      expect(ensureHttpUrl('localhost:3000')).toBe('http://localhost:3000');
      expect(ensureHttpUrl('127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
      expect(ensureHttpUrl('example.test/path')).toBe('https://example.test/path');
    });

    it('normalizes protocol-relative URLs to https', () => {
      expect(ensureHttpUrl('//cdn.example.test/file.js')).toBe('https://cdn.example.test/file.js');
    });
  });

  describe('normalizeBaseUrl', () => {
    it('removes trailing slashes after applying the default scheme', () => {
      expect(normalizeBaseUrl('example.test/path///')).toBe('https://example.test/path');
      expect(normalizeBaseUrl('/api/session///')).toBe('/api/session');
    });
  });

  describe('normalizeOrigin', () => {
    it('returns the origin for absolute or scheme-normalized URLs', () => {
      expect(normalizeOrigin('https://example.test/path?x=1')).toBe('https://example.test');
      expect(normalizeOrigin('example.test/path')).toBe('https://example.test');
      expect(normalizeOrigin('localhost:3000/path')).toBe('http://localhost:3000');
    });

    it('returns an empty string for relative or malformed values', () => {
      expect(normalizeOrigin('/api/session')).toBe('');
      expect(normalizeOrigin('://bad')).toBe('');
      expect(normalizeOrigin(undefined)).toBe('');
    });
  });

  describe('normalizeOriginList', () => {
    it('normalizes, filters, and dedupes array entries in first-seen order', () => {
      expect(
        normalizeOriginList(['https://example.test/a', 'example.test/b', '/api/session', 'http://localhost:3000/path']),
      ).toEqual(['https://example.test', 'http://localhost:3000']);
    });

    it('accepts a single non-array value', () => {
      expect(normalizeOriginList('contextengine.example.test/path')).toEqual(['https://contextengine.example.test']);
    });
  });
});
