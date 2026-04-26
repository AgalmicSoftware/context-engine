import { buildPublicRoute, buildPublicUrlPath, readPublicUrlBasePath } from './publicUrl.js';

describe('readPublicUrlBasePath', () => {
  it('returns an empty string when process is unavailable', () => {
    expect(readPublicUrlBasePath(undefined)).toBe('');
  });

  it('normalizes trailing slashes from path-like PUBLIC_URL values', () => {
    expect(readPublicUrlBasePath({ env: { PUBLIC_URL: '/ce/' } })).toBe('/ce');
  });

  it('extracts only the pathname from absolute PUBLIC_URL values', () => {
    expect(readPublicUrlBasePath({ env: { PUBLIC_URL: 'https://ce.example.com/base/' } })).toBe('/base');
  });
});

describe('buildPublicUrlPath', () => {
  it('prefixes relative paths with the configured PUBLIC_URL base path', () => {
    expect(buildPublicUrlPath('/new', { env: { PUBLIC_URL: '/ce/' } })).toBe('/ce/new');
  });

  it('leaves relative paths unchanged when PUBLIC_URL is unset', () => {
    expect(buildPublicUrlPath('/new', { env: {} })).toBe('/new');
  });
});

describe('buildPublicRoute', () => {
  it('returns the configured base path when no pathname is provided', () => {
    expect(buildPublicRoute('', { env: { PUBLIC_URL: '/ce/' } })).toBe('/ce');
  });

  it('falls back to the site root when no pathname or PUBLIC_URL is provided', () => {
    expect(buildPublicRoute('', { env: {} })).toBe('/');
  });
});
