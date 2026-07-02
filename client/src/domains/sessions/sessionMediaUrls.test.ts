import { normalizeSessionMediaUrl } from './sessionMediaUrls.js';

describe('sessionMediaUrls', () => {
  it('leaves non-Arweave URLs normalized only for surrounding whitespace', () => {
    expect(normalizeSessionMediaUrl(' https://example.test/header.png '))
      .toBe('https://example.test/header.png');
  });

  it('returns empty strings for empty media references', () => {
    expect(normalizeSessionMediaUrl('   ')).toBe('');
    expect(normalizeSessionMediaUrl(null)).toBe('');
  });
});
