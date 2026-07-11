import { hashSeed, mulberry32 } from './seededPrng';

describe('seededPrng', () => {
  it('preserves deterministic FNV-style seed hashing', () => {
    expect(hashSeed('context')).toBe(2357661820);
    expect(hashSeed(null)).toBe(hashSeed(''));
    expect(hashSeed(0)).toBe(hashSeed(''));
  });

  it('preserves the existing mulberry32 sequence', () => {
    // Vectors derived from the pre-refactor inline mulberry32 implementation at d99788004.
    const expectedBySeed = {
      42: [
        0.6011037519201636, 0.44829055899754167, 0.8524657934904099, 0.6697340414393693, 0.17481389874592423,
        0.5265925421845168, 0.2732279943302274, 0.6247446539346129, 0.8654746483080089, 0.4723170551005751,
        0.24992373422719538, 0.8820588334929198, 0.7457375649828464, 0.3070015134289861, 0.19725383794866502,
        0.5007294877432287,
      ],
      1337: [
        0.1844118325971067, 0.18998925131745636, 0.8104719922412187, 0.6437488221563399, 0.430774615611881,
        0.381045897025615, 0.5265626488253474, 0.5485863720532507, 0.5440049681346864, 0.5436235317029059,
        0.6605437572579831, 0.19069375889375806, 0.45512870186939836, 0.39513605600222945, 0.20250066346488893,
        0.7981366943567991,
      ],
    };

    Object.entries(expectedBySeed).forEach(([seed, expectedSequence]) => {
      const rand = mulberry32(Number(seed));
      const sequence = Array.from({ length: 16 }, () => rand());
      expect(sequence).toEqual(expectedSequence);
    });
  });

  it('diverges for different seeds', () => {
    const contextRand = mulberry32(hashSeed('context'));
    const alternateRand = mulberry32(hashSeed('alternate-context'));

    const contextSequence = Array.from({ length: 16 }, () => contextRand());
    const alternateSequence = Array.from({ length: 16 }, () => alternateRand());

    expect(alternateSequence).not.toEqual(contextSequence);
  });
});
