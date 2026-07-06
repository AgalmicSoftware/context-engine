import {
  compareResponseRecency,
  toResponseRecencyPair,
} from './responseRecency';

describe('responseRecency', () => {
  it('normalizes recency metadata from either wrapper or response payload', () => {
    expect(toResponseRecencyPair(
      { blockNumber: 10, txIndex: 2 },
      { logIndex: 4, timestamp: 1000 }
    )).toEqual({
      bn: 10,
      txi: 2,
      li: 4,
      ts: 1000,
    });
  });

  it('orders response recency by block, transaction, log, then timestamp', () => {
    expect(compareResponseRecency(
      { bn: 11, txi: 0, li: 0, ts: 0 },
      { bn: 10, txi: 99, li: 99, ts: 99 }
    )).toBe(1);
    expect(compareResponseRecency(
      { bn: 10, txi: 2, li: 3, ts: 4 },
      { bn: 10, txi: 2, li: 3, ts: 5 }
    )).toBe(-1);
    expect(compareResponseRecency(
      { bn: 10, txi: 2, li: 3, ts: 4 },
      { bn: 10, txi: 2, li: 3, ts: 4 }
    )).toBe(0);
  });
});
