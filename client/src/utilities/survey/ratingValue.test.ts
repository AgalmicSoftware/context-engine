import { getRatingFillPercent, normalizeRatingValue, RATING_MAX, RATING_MIN } from './ratingValue.js';

describe('ratingValue', () => {
  it('returns the fallback for blank or invalid values', () => {
    expect(normalizeRatingValue('', 4)).toBe(4);
    expect(normalizeRatingValue('   ', 4)).toBe(4);
    expect(normalizeRatingValue('not-a-number', 4)).toBe(4);
    expect(normalizeRatingValue(undefined, 4)).toBe(4);
  });

  it('clamps values to the supported rating range', () => {
    expect(normalizeRatingValue(-3)).toBe(RATING_MIN);
    expect(normalizeRatingValue(7)).toBe(7);
    expect(normalizeRatingValue(99)).toBe(RATING_MAX);
  });

  it('computes rating fill percent from the normalized value', () => {
    expect(getRatingFillPercent(RATING_MIN)).toBe(0);
    expect(getRatingFillPercent(5)).toBe(50);
    expect(getRatingFillPercent(RATING_MAX)).toBe(100);
    expect(getRatingFillPercent(null, 3)).toBe(30);
  });
});
