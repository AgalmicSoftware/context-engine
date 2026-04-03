import { readPublicUrlBasePath } from './publicUrl.js';

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
