import { isSingleHttpUrlInput } from './SurveyGenerator';

describe('AudioSurveyGenerator URL detection', () => {
  it('detects a single URL string', () => {
    expect(isSingleHttpUrlInput('https://example.com/article')).toBe(true);
  });

  it('does not detect non-URL text as a URL', () => {
    expect(isSingleHttpUrlInput('this is plain text content')).toBe(false);
  });
});
