import { getQuestionTagDisplayList } from './questionTags.js';

describe('questionTags', () => {
  it('keeps first-seen display casing while deduping normalized tags', () => {
    expect(getQuestionTagDisplayList([' governance ', 'AI Policy', 'Governance', 'ai policy'])).toEqual([
      'governance',
      'AI Policy',
    ]);
  });

  it('returns an empty list for non-array inputs', () => {
    expect(getQuestionTagDisplayList(null)).toEqual([]);
    expect(getQuestionTagDisplayList('governance')).toEqual([]);
  });
});
