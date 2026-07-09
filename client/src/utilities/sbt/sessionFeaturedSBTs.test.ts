import { getCanonicalSessionFeaturedSBTs } from './sessionFeaturedSBTs.js';

describe('sessionFeaturedSBTs', () => {
  it('merges canonical featured SBT arrays while preserving first casing and order', () => {
    expect(
      getCanonicalSessionFeaturedSBTs({
        defaultFeaturedSBTs: [
          ' 0xABC0000000000000000000000000000000000000 ',
          { address: '0xDEF0000000000000000000000000000000000000' },
          null,
          { value: '' },
        ],
        featured_SBTs_LIST: [
          { sbtAddress: '0xabc0000000000000000000000000000000000000' },
          { value: '0x1230000000000000000000000000000000000000' },
        ],
      }),
    ).toEqual([
      '0xABC0000000000000000000000000000000000000',
      '0xDEF0000000000000000000000000000000000000',
      '0x1230000000000000000000000000000000000000',
    ]);
  });

  it('returns an empty list for missing or malformed config arrays', () => {
    expect(getCanonicalSessionFeaturedSBTs(null)).toEqual([]);
    expect(
      getCanonicalSessionFeaturedSBTs({
        defaultFeaturedSBTs: '0xabc',
        featured_SBTs_LIST: { address: '0xdef' },
      }),
    ).toEqual([]);
  });
});
