import { isResponseRecencyAtLeast, isResponseRecencyNewer, toResponseRecencyPair } from './responseRecency';

describe('responseRecency', () => {
  it('normalizes recency metadata from either wrapper or response payload', () => {
    expect(toResponseRecencyPair({ blockNumber: 10, txIndex: 2 }, { logIndex: 4, timestamp: 1000 })).toEqual({
      bn: 10,
      txi: 2,
      li: 4,
      ts: 1000,
    });
  });

  it('orders response recency by block, transaction, log, then timestamp', () => {
    expect(isResponseRecencyNewer({ bn: 11, txi: 0, li: 0, ts: 0 }, { bn: 10, txi: 99, li: 99, ts: 99 })).toBe(true);
    expect(isResponseRecencyNewer({ bn: 10, txi: 2, li: 3, ts: 4 }, { bn: 10, txi: 2, li: 3, ts: 5 })).toBe(false);
    expect(isResponseRecencyAtLeast({ bn: 10, txi: 2, li: 3, ts: 4 }, { bn: 10, txi: 2, li: 3, ts: 4 })).toBe(true);
  });

  it('centralizes strict and equal-recency merge decisions', () => {
    const existingMeta = { bn: 10, txi: 2, li: 3, ts: 4 };

    expect(isResponseRecencyNewer({ ...existingMeta }, existingMeta)).toBe(false);
    expect(isResponseRecencyAtLeast({ ...existingMeta }, existingMeta)).toBe(true);
    expect(isResponseRecencyNewer({ ...existingMeta, li: 4 }, existingMeta)).toBe(true);
    expect(isResponseRecencyAtLeast({ ...existingMeta, bn: 9 }, existingMeta)).toBe(false);
  });

  it('fails closed when the decisive cached recency field is malformed', () => {
    expect(isResponseRecencyAtLeast({ bn: 10, txi: 0, li: 0, ts: 0 }, { bn: 'invalid' })).toBe(false);
    expect(isResponseRecencyNewer({ bn: 10, txi: 1, li: 0, ts: 0 }, { bn: 10, txi: 'invalid' })).toBe(false);
    expect(isResponseRecencyNewer({ bn: 11, txi: 0, li: 0, ts: 0 }, { bn: 10, txi: 'invalid' })).toBe(true);
  });
});
