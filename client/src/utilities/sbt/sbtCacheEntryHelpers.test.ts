import { resolveSbtCreationBlock } from './sbtCacheEntryHelpers.js';

describe('sbtCacheEntryHelpers', () => {
  describe('resolveSbtCreationBlock', () => {
    it('returns null when no valid creation block candidates are present', () => {
      expect(resolveSbtCreationBlock()).toBeNull();
      expect(resolveSbtCreationBlock(null, undefined, -1, 'bad')).toBeNull();
    });

    it('floors valid candidates and returns the earliest block', () => {
      expect(resolveSbtCreationBlock(15.9, '12.8', 20)).toBe(12);
    });

    it('ignores invalid candidates while preserving zero as a valid block', () => {
      expect(resolveSbtCreationBlock('bad', 0, 3)).toBe(0);
    });
  });
});
