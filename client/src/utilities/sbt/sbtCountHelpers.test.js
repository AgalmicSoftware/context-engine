import {
  normalizeSbtCountMap,
  sumSbtCountMap,
  mergeSbtCountMaps,
  mergeSbtCountsPayload,
  getCurrentHolderAddressesFromCounts,
  normalizeSbtCountsScanCheckpoint,
} from './sbtCountHelpers.js';

describe('sbtCountHelpers', () => {
  describe('normalizeSbtCountMap', () => {
    it('normalizes empty input to an empty object', () => {
      expect(normalizeSbtCountMap(null)).toEqual({});
      expect(normalizeSbtCountMap(undefined)).toEqual({});
      expect(normalizeSbtCountMap({})).toEqual({});
    });

    it('lowercases addresses and filters zero and negative counts', () => {
      expect(
        normalizeSbtCountMap({
          '0xAbC': '2',
          '0xDef': 0,
          '0xGhi': -1,
        }),
      ).toEqual({
        '0xabc': 2,
      });
    });
  });

  describe('sumSbtCountMap', () => {
    it('sums empty input as zero', () => {
      expect(sumSbtCountMap(null)).toBe(0);
      expect(sumSbtCountMap({})).toBe(0);
    });

    it('sums a single entry', () => {
      expect(sumSbtCountMap({ '0xabc': '3' })).toBe(3);
    });

    it('sums multiple normalized entries', () => {
      expect(
        sumSbtCountMap({
          '0xAbC': '2',
          '0xDef': '3.9',
          '0xNope': 0,
        }),
      ).toBe(5);
    });
  });

  describe('mergeSbtCountMaps', () => {
    it('merges into an empty base', () => {
      expect(
        mergeSbtCountMaps(
          {},
          {
            '0xABC': 2,
          },
        ),
      ).toEqual({
        '0xabc': 2,
      });
    });

    it('adds overlapping normalized keys', () => {
      expect(
        mergeSbtCountMaps(
          {
            '0xabc': 1,
          },
          {
            '0xABC': 3,
          },
        ),
      ).toEqual({
        '0xabc': 4,
      });
    });

    it('preserves non-overlapping keys', () => {
      expect(
        mergeSbtCountMaps(
          {
            '0xabc': 1,
          },
          {
            '0xDEF': 2,
          },
        ),
      ).toEqual({
        '0xabc': 1,
        '0xdef': 2,
      });
    });
  });

  describe('mergeSbtCountsPayload', () => {
    it('combines minted and burned maps and event counters', () => {
      expect(
        mergeSbtCountsPayload(
          {
            mintedCountByAddress: { '0xabc': 1 },
            burnedCountByAddress: { '0xdef': 2 },
            mintedEventCount: 3,
            burnedEventCount: 1,
          },
          {
            mintedCountByAddress: { '0xABC': 2, '0x999': 1 },
            burnedCountByAddress: { '0xDEF': 4 },
            mintedEventCount: '5',
            burnedEventCount: '6',
          },
        ),
      ).toEqual({
        mintedCountByAddress: {
          '0x999': 1,
          '0xabc': 3,
        },
        burnedCountByAddress: {
          '0xdef': 6,
        },
        mintedEventCount: 8,
        burnedEventCount: 7,
      });
    });
  });

  describe('getCurrentHolderAddressesFromCounts', () => {
    it('returns no holders for empty counts', () => {
      expect(getCurrentHolderAddressesFromCounts({})).toEqual([]);
    });

    it('keeps addresses with partial burns', () => {
      expect(
        getCurrentHolderAddressesFromCounts({
          mintedCountByAddress: {
            '0xABC': 2,
          },
          burnedCountByAddress: {
            '0xabc': 1,
          },
        }),
      ).toEqual(['0xabc']);
    });

    it('filters addresses with full burns', () => {
      expect(
        getCurrentHolderAddressesFromCounts({
          mintedCountByAddress: {
            '0xABC': 1,
            '0xDEF': 3,
          },
          burnedCountByAddress: {
            '0xabc': 1,
            '0xdef': 3,
          },
        }),
      ).toEqual([]);
    });
  });

  describe('normalizeSbtCountsScanCheckpoint', () => {
    it('rejects missing checkpoints and non-activity phases', () => {
      expect(normalizeSbtCountsScanCheckpoint(null, { startBlock: 10, toBlock: 20 })).toBeNull();
      expect(
        normalizeSbtCountsScanCheckpoint({ phase: 'metadata', blockNumber: 12 }, { startBlock: 10, toBlock: 20 }),
      ).toBeNull();
      expect(
        normalizeSbtCountsScanCheckpoint({ phase: 'activity', blockNumber: 12 }, { startBlock: 'bad', toBlock: 20 }),
      ).toBeNull();
    });

    it('clamps the block number and canonicalizes count maps', () => {
      expect(
        normalizeSbtCountsScanCheckpoint(
          {
            phase: ' activity ',
            blockNumber: 25,
            mintedCountByAddress: {
              '0xAAA': '2',
              '0xbbb': 0,
            },
            burnedCountByAddress: {
              '0xAAA': 1,
            },
            mintedEventCount: 7,
            burnedEventCount: 0,
          },
          {
            startBlock: 10,
            toBlock: 20,
          },
        ),
      ).toEqual({
        phase: 'activity',
        blockNumber: 20,
        scanStartBlock: 10,
        scanToBlock: 20,
        mintedCountByAddress: {
          '0xaaa': 2,
        },
        burnedCountByAddress: {
          '0xaaa': 1,
        },
        mintedEventCount: 7,
        burnedEventCount: 1,
      });
    });

    it('floors checkpoints to the pre-scan block and falls back to summed counts', () => {
      expect(
        normalizeSbtCountsScanCheckpoint(
          {
            phase: 'activity',
            blockNumber: 4,
            mintedCountByAddress: {
              '0xAAA': 2,
              '0xBBB': 3,
            },
            burnedCountByAddress: {
              '0xAAA': 1,
            },
            mintedEventCount: -1,
            burnedEventCount: 'not-a-number',
          },
          {
            startBlock: 10,
            toBlock: 20,
          },
        ),
      ).toEqual({
        phase: 'activity',
        blockNumber: 9,
        scanStartBlock: 10,
        scanToBlock: 20,
        mintedCountByAddress: {
          '0xaaa': 2,
          '0xbbb': 3,
        },
        burnedCountByAddress: {
          '0xaaa': 1,
        },
        mintedEventCount: 5,
        burnedEventCount: 1,
      });
    });
  });
});
