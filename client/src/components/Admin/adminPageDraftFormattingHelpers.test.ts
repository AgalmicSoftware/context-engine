import {
  buildUserPageUrl,
  dedupeTrimmedList,
  formatAllowOriginsDraft,
  formatDefaultFilterStateDraft,
  formatDelimitedDraftList,
  formatPreviewValue,
  parseAllowOriginsDraft,
  parseDefaultFilterStateDraft,
  parseDelimitedDraftList,
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

  it('dedupes and parses delimited draft lists', () => {
    expect(dedupeTrimmedList([' Alpha ', 'alpha', 'Beta', '', null])).toEqual(['Alpha', 'Beta']);
    expect(formatDelimitedDraftList(['one', 'ONE', 'two'])).toBe('one\ntwo');
    expect(formatDelimitedDraftList('one,two')).toBe('');
    expect(parseDelimitedDraftList('one, two\nONE')).toEqual(['one', 'two']);
    expect(parseDelimitedDraftList('[" one ", "two", "ONE"]')).toEqual(['one', 'two']);
    expect(parseDelimitedDraftList('')).toEqual([]);
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

  it('formats and parses default filter state drafts', () => {
    expect(formatDefaultFilterStateDraft({ query: 'alpha' })).toBe('{\n  "query": "alpha"\n}');
    expect(formatDefaultFilterStateDraft('plain')).toBe('plain');
    expect(formatDefaultFilterStateDraft(null)).toBe('');
    expect(parseDefaultFilterStateDraft('{"query":"alpha"}')).toEqual({ query: 'alpha' });
    expect(parseDefaultFilterStateDraft('plain query')).toBe('plain query');
    expect(parseDefaultFilterStateDraft('')).toBeNull();
    expect(() => parseDefaultFilterStateDraft('{bad')).toThrow('Default filter state must be valid JSON');
  });
});
