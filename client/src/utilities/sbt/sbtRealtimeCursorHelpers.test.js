import { normalizeSbtRealtimeEventCursor, compareSbtRealtimeEventCursor } from './sbtRealtimeCursorHelpers.js';

describe('sbtRealtimeCursorHelpers', () => {
  describe('normalizeSbtRealtimeEventCursor', () => {
    it('normalizes null, undefined, and non-object input to null', () => {
      expect(normalizeSbtRealtimeEventCursor(null)).toBeNull();
      expect(normalizeSbtRealtimeEventCursor(undefined)).toBeNull();
      expect(normalizeSbtRealtimeEventCursor('cursor')).toBeNull();
      expect(normalizeSbtRealtimeEventCursor(1)).toBeNull();
    });

    it('normalizes missing or negative blockNumber to null', () => {
      expect(normalizeSbtRealtimeEventCursor({})).toBeNull();
      expect(normalizeSbtRealtimeEventCursor({ blockNumber: -1 })).toBeNull();
    });

    it('defaults missing transactionIndex and logIndex to -1', () => {
      expect(normalizeSbtRealtimeEventCursor({ blockNumber: 12 })).toEqual({
        blockNumber: 12,
        transactionIndex: -1,
        logIndex: -1,
      });
    });

    it('defaults invalid transactionIndex and logIndex to -1', () => {
      expect(
        normalizeSbtRealtimeEventCursor({
          blockNumber: 12,
          transactionIndex: -1,
          logIndex: 'latest',
        }),
      ).toEqual({
        blockNumber: 12,
        transactionIndex: -1,
        logIndex: -1,
      });
    });

    it('normalizes a valid full cursor to integer fields', () => {
      expect(
        normalizeSbtRealtimeEventCursor({
          blockNumber: '12',
          transactionIndex: '3',
          logIndex: '4',
        }),
      ).toEqual({
        blockNumber: 12,
        transactionIndex: 3,
        logIndex: 4,
      });
    });

    it('floors a float blockNumber', () => {
      expect(
        normalizeSbtRealtimeEventCursor({
          blockNumber: 12.9,
          transactionIndex: 3,
          logIndex: 4,
        }),
      ).toEqual({
        blockNumber: 12,
        transactionIndex: 3,
        logIndex: 4,
      });
    });
  });

  describe('compareSbtRealtimeEventCursor', () => {
    it('returns 0 when both cursors are null', () => {
      expect(compareSbtRealtimeEventCursor(null, null)).toBe(0);
    });

    it('orders null before a valid right cursor', () => {
      expect(compareSbtRealtimeEventCursor(null, { blockNumber: 1 })).toBe(-1);
    });

    it('orders a valid left cursor after null', () => {
      expect(compareSbtRealtimeEventCursor({ blockNumber: 1 }, null)).toBe(1);
    });

    it('orders different cursors by blockNumber', () => {
      expect(compareSbtRealtimeEventCursor({ blockNumber: 1 }, { blockNumber: 2 })).toBeLessThan(0);
      expect(compareSbtRealtimeEventCursor({ blockNumber: 2 }, { blockNumber: 1 })).toBeGreaterThan(0);
    });

    it('orders same-block cursors by transactionIndex', () => {
      expect(
        compareSbtRealtimeEventCursor(
          { blockNumber: 1, transactionIndex: 2, logIndex: 5 },
          { blockNumber: 1, transactionIndex: 3, logIndex: 1 },
        ),
      ).toBeLessThan(0);
      expect(
        compareSbtRealtimeEventCursor(
          { blockNumber: 1, transactionIndex: 3, logIndex: 1 },
          { blockNumber: 1, transactionIndex: 2, logIndex: 5 },
        ),
      ).toBeGreaterThan(0);
    });

    it('orders same-block and same-transaction cursors by logIndex', () => {
      expect(
        compareSbtRealtimeEventCursor(
          { blockNumber: 1, transactionIndex: 2, logIndex: 5 },
          { blockNumber: 1, transactionIndex: 2, logIndex: 6 },
        ),
      ).toBeLessThan(0);
      expect(
        compareSbtRealtimeEventCursor(
          { blockNumber: 1, transactionIndex: 2, logIndex: 6 },
          { blockNumber: 1, transactionIndex: 2, logIndex: 5 },
        ),
      ).toBeGreaterThan(0);
    });

    it('returns 0 for identical cursors', () => {
      expect(
        compareSbtRealtimeEventCursor(
          { blockNumber: 1, transactionIndex: 2, logIndex: 3 },
          { blockNumber: 1, transactionIndex: 2, logIndex: 3 },
        ),
      ).toBe(0);
    });
  });
});
