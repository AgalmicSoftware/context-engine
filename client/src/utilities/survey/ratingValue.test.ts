import {
  getRatingFillPercent,
  hasRatingScaleMetadata,
  normalizeRatingScale,
  normalizeRatingValue,
  RATING_MAX,
  RATING_MIN,
} from './ratingValue.js';

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

  it('normalizes per-question rating scales and clamps values against them', () => {
    const scale = normalizeRatingScale({
      scale: { min: 1, max: 10, minLabel: '1', maxLabel: '10' },
    });

    expect(scale).toEqual({ min: 1, max: 10, minLabel: '1', maxLabel: '10' });
    expect(normalizeRatingValue(0, scale.min, scale)).toBe(1);
    expect(normalizeRatingValue(11, scale.min, scale)).toBe(10);
    expect(getRatingFillPercent(5.5, scale.min, scale)).toBe(50);
  });

  it('matches catalog scale presence for aliases and label-only metadata', () => {
    expect(hasRatingScaleMetadata({})).toBe(false);
    expect(hasRatingScaleMetadata({ scale: {}, ratingScale: {} })).toBe(false);

    const aliasedScale = {
      scale: {},
      ratingScale: { lowLabel: 'Strongly oppose', highLabel: 'Strongly support' },
    };

    expect(hasRatingScaleMetadata(aliasedScale)).toBe(true);
    expect(normalizeRatingScale(aliasedScale)).toEqual({
      min: 0,
      max: 10,
      minLabel: 'Strongly oppose',
      maxLabel: 'Strongly support',
    });
  });

  it('normalizes invalid explicit scale ranges to the default scale', () => {
    expect(hasRatingScaleMetadata({ scale: { min: 10, max: 1 } })).toBe(true);
    expect(normalizeRatingScale({ scale: { min: 10, max: 1, minLabel: 'High', maxLabel: 'Low' } })).toEqual({
      min: 0,
      max: 10,
      minLabel: '0',
      maxLabel: '10',
    });
  });
});
