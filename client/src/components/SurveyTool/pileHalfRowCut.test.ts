import { resolvePileHalfRowCut } from './pileHalfRowCut';

// Rows shaped like a phone choice list: uneven heights where long options wrap, 8px apart.
const rowsOf = (heights: number[], gap = 8, start = 5) => {
  let top = start;
  return heights.map((height) => {
    const row = { top, height };
    top += height + gap;
    return row;
  });
};

const cutRow = (cut: number, rows: { top: number; height: number }[]) =>
  rows.find((row) => cut > row.top && cut < row.top + row.height);

describe('resolvePileHalfRowCut', () => {
  it('leaves a list that fits alone', () => {
    expect(resolvePileHalfRowCut(400, rowsOf([44, 44, 44]))).toBeUndefined();
  });

  it('always ends inside a row, away from its edges, for any space and any row heights', () => {
    const shapes = [
      [44, 44, 44, 44, 44, 44, 44, 44],
      [64, 44, 86, 44, 64, 108, 44, 64],
      [108, 108, 86, 64, 64],
      [44, 130, 44, 130, 44, 130],
    ];
    shapes.forEach((heights) => {
      const rows = rowsOf(heights);
      const total = rows[rows.length - 1].top + rows[rows.length - 1].height;
      for (let available = 60; available < total; available += 1) {
        const cut = resolvePileHalfRowCut(available, rows);
        expect(cut).toBeDefined();
        expect(cut).toBeLessThanOrEqual(available);
        const row = cutRow(cut as number, rows);
        expect(row).toBeDefined();
        const share = ((cut as number) - row!.top) / row!.height;
        expect(share).toBeGreaterThanOrEqual(0.39);
        expect(share).toBeLessThanOrEqual(0.71);
        // Little space is given up: never more than one row's worth.
        expect(available - (cut as number)).toBeLessThan(Math.max(...heights) + 8);
      }
    });
  });

  it('uses all the space when it already ends in the middle of a row', () => {
    const rows = rowsOf([44, 44, 44, 44]);
    expect(resolvePileHalfRowCut(rows[2].top + 22, rows)).toBe(rows[2].top + 22);
  });
});
