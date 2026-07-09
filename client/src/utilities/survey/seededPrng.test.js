import { hashSeed, mulberry32 } from './seededPrng';

describe('seededPrng', () => {
  it('preserves deterministic FNV-style seed hashing', () => {
    expect(hashSeed('context')).toBe(2357661820);
    expect(hashSeed(null)).toBe(hashSeed(''));
    expect(hashSeed(0)).toBe(hashSeed(''));
  });

  it('preserves the existing mulberry32 sequence', () => {
    const firstRand = mulberry32(hashSeed('context'));
    const secondRand = mulberry32(hashSeed('context'));

    const firstSequence = Array.from({ length: 16 }, () => firstRand());
    const secondSequence = Array.from({ length: 16 }, () => secondRand());

    expect(firstSequence[0]).toBe(0.5816554201301187);
    expect(secondSequence.every((value, index) => Object.is(value, firstSequence[index]))).toBe(true);
  });

  it('diverges for different seeds', () => {
    const contextRand = mulberry32(hashSeed('context'));
    const alternateRand = mulberry32(hashSeed('alternate-context'));

    const contextSequence = Array.from({ length: 16 }, () => contextRand());
    const alternateSequence = Array.from({ length: 16 }, () => alternateRand());

    expect(alternateSequence).not.toEqual(contextSequence);
  });
});
