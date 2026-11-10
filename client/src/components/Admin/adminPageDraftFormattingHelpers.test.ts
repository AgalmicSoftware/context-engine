import {
  buildUserPageUrl,
  formatAllowOriginsDraft,
  formatPreviewValue,
  parseAllowOriginsDraft,
  splitAllowOriginsInput,
} from './adminPageDraftFormattingHelpers';

describe('adminPageDraftFormattingHelpers', () => {
  it('formats previews and user URLs', () => {
    expect(formatPreviewValue('abcdef', 4)).toBe('abcd…');
    expect(formatPreviewValue('abc', 4)).toBe('abc');
    expect(formatPreviewValue('', 4)).toBe('');
    expect(buildUserPageUrl(' 0xAb C ')).toBe('/u/0xAb%20C');
    expect(buildUserPageUrl('  ')).toBe('');
  });

  it('normalizes allowOrigins drafts', () => {
    expect(splitAllowOriginsInput([' https://a.example ', 'https://b.example, https://a.example'])).toEqual([
      'https://a.example',
      'https://b.example',
      'https://a.example',
    ]);
    expect(parseAllowOriginsDraft(' https://a.example,\nhttps://a.example ')).toEqual(['https://a.example']);
    expect(formatAllowOriginsDraft([' https://a.example ', 'https://b.example'])).toBe(
      'https://a.example\nhttps://b.example',
    );
  });
});
