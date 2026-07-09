import { hashSeed, mulberry32 } from './seededPrng';

describe('seededPrng', () => {
  it('preserves deterministic FNV-style seed hashing', () => {
    expect(hashSeed('context')).toBe(2357661820);
    expect(hashSeed(null)).toBe(hashSeed(''));
    expect(hashSeed(0)).toBe(hashSeed(''));
  });

  it('preserves the existing mulberry32 sequence', () => {
    const rand = mulberry32(hashSeed('context'));

    expect(rand()).toBeCloseTo(0.5816554201301187, 12);
    expect(rand()).toBeCloseTo(0.1238897442817688, 12);
    expect(rand()).toBeCloseTo(0.32682808698154986, 12);
  });
});
