import { applySbtPageHistorySummaryFallback, normalizeSbtPageHistorySummary } from './sbtPageHistorySummaryHelpers';

describe('sbtPageHistorySummaryHelpers', () => {
  it('normalizes SBT history summary counts without changing invalid fallback handling', () => {
    expect(
      normalizeSbtPageHistorySummary({
        totalMinted: '0005',
        totalBurned: 1,
        activeSupply: '004',
        currentHolderCount: '4',
        historicalHolderCount: '005',
      }),
    ).toEqual({
      totalMinted: '5',
      totalBurned: '1',
      activeSupply: '4',
      currentHolderCount: '4',
      historicalHolderCount: '5',
    });
    expect(
      normalizeSbtPageHistorySummary({
        totalMinted: '5',
        totalBurned: 'not-a-number',
        activeSupply: '4',
        currentHolderCount: '4',
        historicalHolderCount: '5',
      }),
    ).toBeNull();
    expect(normalizeSbtPageHistorySummary(null)).toBeNull();
  });

  it('applies SBT history summary fallbacks without clobbering existing state on invalid values', () => {
    expect(
      applySbtPageHistorySummaryFallback({
        summaryValue: { currentHolderCount: '04', totalMinted: '0007' },
        sourceLabel: 'summary-cache',
      }),
    ).toEqual({
      mintedTokensOverride: '4',
      mintedTokensSource: 'summary-cache',
      ownerLookupUpperBound: '7',
    });

    expect(
      applySbtPageHistorySummaryFallback({
        mintedTokensOverride: '3',
        mintedTokensSource: 'summary-group',
        ownerLookupUpperBound: '8',
        summaryValue: { currentHolderCount: 'bad', totalMinted: null },
        sourceLabel: 'ignored',
      }),
    ).toEqual({
      mintedTokensOverride: '3',
      mintedTokensSource: 'summary-group',
      ownerLookupUpperBound: '8',
    });
  });
});
