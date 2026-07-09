import { getRelevantDefaultTags, hasAnyTagOverlap, isDefaultTagRelevant, parseDefaultTags } from './defaultTags';

describe('defaultTags helpers', () => {
  it('parseDefaultTags normalizes, trims, and de-dupes', () => {
    expect(parseDefaultTags(' Foo,bar,  ,BAR ,baz ')).toEqual(['foo', 'bar', 'baz']);
  });

  it('parseDefaultTags returns [] for non-strings', () => {
    expect(parseDefaultTags(null)).toEqual([]);
    expect(parseDefaultTags(undefined)).toEqual([]);
  });

  it('hasAnyTagOverlap returns true when requiredTags is empty (no gating)', () => {
    expect(hasAnyTagOverlap(['a'], [])).toBe(true);
    expect(hasAnyTagOverlap([], [])).toBe(true);
    expect(hasAnyTagOverlap(null, [])).toBe(true);
  });

  it('hasAnyTagOverlap returns false when question tags are empty but requiredTags is not', () => {
    expect(hasAnyTagOverlap([], ['a'])).toBe(false);
    expect(hasAnyTagOverlap(null, ['a'])).toBe(false);
  });

  it('hasAnyTagOverlap uses OR semantics across requiredTags', () => {
    expect(hasAnyTagOverlap(['a'], ['a', 'b'])).toBe(true);
    expect(hasAnyTagOverlap(['b'], ['a', 'b'])).toBe(true);
    expect(hasAnyTagOverlap(['c'], ['a', 'b'])).toBe(false);
  });

  it('hasAnyTagOverlap matches case-insensitively and ignores whitespace', () => {
    expect(hasAnyTagOverlap(['  RXC '], ['rxc'])).toBe(true);
    expect(hasAnyTagOverlap(['rxc'], [' RXC '])).toBe(true);
  });

  it('hasAnyTagOverlap accepts non-array iterable tag inputs', () => {
    expect(hasAnyTagOverlap(new Set(['alpha', 'beta']), [' BETA '])).toBe(true);
    expect(hasAnyTagOverlap('alpha,beta', ['alpha'])).toBe(false);
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
