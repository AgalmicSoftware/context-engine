import { normalizeSbtHistorySummary, buildSbtHistorySummaryFromCounts } from './sbtHistoryHelpers.js';

describe('sbtHistoryHelpers', () => {
  describe('normalizeSbtHistorySummary', () => {
    it('normalizes null, undefined, and non-object input to null', () => {
      expect(normalizeSbtHistorySummary(null)).toBeNull();
      expect(normalizeSbtHistorySummary(undefined)).toBeNull();
      expect(normalizeSbtHistorySummary('summary')).toBeNull();
      expect(normalizeSbtHistorySummary(1)).toBeNull();
    });

    it('normalizes valid fields as canonical digit strings', () => {
      expect(
        normalizeSbtHistorySummary({
          totalMinted: '005',
          totalBurned: '000',
          activeSupply: '03',
          currentHolderCount: '02',
          historicalHolderCount: '010',
        }),
      ).toEqual({
        totalMinted: '5',
        totalBurned: '0',
        activeSupply: '3',
        currentHolderCount: '2',
        historicalHolderCount: '10',
      });
    });

    it('normalizes missing required fields to null', () => {
      expect(
        normalizeSbtHistorySummary({
          totalMinted: '1',
          totalBurned: '0',
          activeSupply: '1',
          currentHolderCount: '1',
        }),
      ).toBeNull();
    });

    it('normalizes non-numeric field values to null', () => {
      expect(
        normalizeSbtHistorySummary({
          totalMinted: '1',
          totalBurned: 'x',
          activeSupply: '1',
          currentHolderCount: '1',
          historicalHolderCount: '1',
        }),
      ).toBeNull();
    });
  });

  describe('buildSbtHistorySummaryFromCounts', () => {
    it('builds a zero-valued summary from empty counts', () => {
      expect(buildSbtHistorySummaryFromCounts({})).toEqual({
        totalMinted: '0',
        totalBurned: '0',
        activeSupply: '0',
        currentHolderCount: '0',
        historicalHolderCount: '0',
      });
    });

    it('builds active supply and holder count from minted counts', () => {
      expect(
        buildSbtHistorySummaryFromCounts({
          mintedCountByAddress: {
            '0xA': 2,
            '0xB': 1,
          },
        }),
      ).toEqual({
        totalMinted: '3',
        totalBurned: '0',
        activeSupply: '3',
        currentHolderCount: '2',
        historicalHolderCount: '2',
      });
    });

    it('builds net active supply from minted and burned counts', () => {
      expect(
        buildSbtHistorySummaryFromCounts({
          mintedCountByAddress: {
            '0xA': 2,
            '0xB': 1,
          },
          burnedCountByAddress: {
            '0xA': 1,
          },
        }),
      ).toEqual({
        totalMinted: '3',
        totalBurned: '1',
        activeSupply: '2',
        currentHolderCount: '2',
        historicalHolderCount: '2',
      });
    });

    it('returns null when derived values fail history summary normalization', () => {
      expect(
        buildSbtHistorySummaryFromCounts({
          mintedEventCount: Infinity,
        }),
      ).toBeNull();
    });
  });
});
