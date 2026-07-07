import { ethers } from 'ethers';
import { __test__contractScriptsSbtHistory } from './chainGateway.js';

describe('contractScripts SBT history helpers', () => {
  const { normalizeHistorySummaryCount, normalizeSbtHistorySummary, deriveSbtHistorySummaryFromCounts } =
    __test__contractScriptsSbtHistory;

  it('normalizes numeric summary counts from strings and BigNumbers', () => {
    expect(normalizeHistorySummaryCount('0007')).toBe('7');
    expect(normalizeHistorySummaryCount(0)).toBe('0');
    expect(normalizeHistorySummaryCount(ethers.BigNumber.from('12'))).toBe('12');
    expect(normalizeHistorySummaryCount('not-a-count')).toBeNull();
  });

  it('accepts both object and tuple-like summary payloads', () => {
    expect(
      normalizeSbtHistorySummary({
        totalMinted: '4',
        totalBurned: '1',
        activeSupply: '3',
        currentHolderCount: '2',
        historicalHolderCount: '3',
      }),
    ).toEqual({
      totalMinted: '4',
      totalBurned: '1',
      activeSupply: '3',
      currentHolderCount: '2',
      historicalHolderCount: '3',
    });

    expect(normalizeSbtHistorySummary([ethers.BigNumber.from('4'), ethers.BigNumber.from('1'), '3', '2', '3'])).toEqual(
      {
        totalMinted: '4',
        totalBurned: '1',
        activeSupply: '3',
        currentHolderCount: '2',
        historicalHolderCount: '3',
      },
    );
  });

  it('derives active supply and holder counts from minted and burned totals', () => {
    expect(
      deriveSbtHistorySummaryFromCounts({
        mintedCountByAddress: {
          '0xaaa': 2,
          '0xbbb': 1,
          '0xccc': 3,
        },
        burnedCountByAddress: {
          '0xaaa': 1,
          '0xbbb': 1,
          '0xccc': 5,
        },
        mintedEventCount: 6,
        burnedEventCount: 7,
      }),
    ).toEqual({
      totalMinted: '6',
      totalBurned: '7',
      activeSupply: '1',
      currentHolderCount: '1',
      historicalHolderCount: '3',
    });
  });
});
