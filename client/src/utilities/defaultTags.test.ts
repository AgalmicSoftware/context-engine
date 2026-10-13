import { getRelevantDefaultTags, isDefaultTagRelevant, normalizeTagList } from './defaultTags';

describe('defaultTags helpers', () => {
  it('normalizeTagList lowercases, trims, and de-dupes tags', () => {
    expect(normalizeTagList([' Foo', 'bar', '  ', 'BAR ', 'baz '])).toEqual(['foo', 'bar', 'baz']);
  });

  it('normalizeTagList accepts iterables and ignores strings and nullish input', () => {
    expect(normalizeTagList(new Set(['alpha', ' BETA ']))).toEqual(['alpha', 'beta']);
    expect(normalizeTagList('alpha,beta')).toEqual([]);
    expect(normalizeTagList(null)).toEqual([]);
    expect(normalizeTagList(undefined)).toEqual([]);
  });

  it('isDefaultTagRelevant matches exact words and compacted variants', () => {
    expect(isDefaultTagRelevant('Legacy 2025 governance forum', 'legacy2025')).toBe(true);
    expect(isDefaultTagRelevant('Climate change working group', 'climatechange')).toBe(true);
    expect(isDefaultTagRelevant('A debate about funding', 'debate')).toBe(true);
    expect(isDefaultTagRelevant('A broad discussion', 'rxc')).toBe(false);
    expect(isDefaultTagRelevant('Prevent burnout', 'event')).toBe(false);
    expect(isDefaultTagRelevant('Ideal candidate', 'idea')).toBe(false);
  });

  it('getRelevantDefaultTags returns only relevant defaults in original order', () => {
    expect(
      getRelevantDefaultTags(
        ['Legacy 2025 governance forum', 'Debate about voting systems'],
        ['rxc', 'legacy2025', 'debate', 'governance'],
      ),
    ).toEqual(['legacy2025', 'debate', 'governance']);
  });
});
