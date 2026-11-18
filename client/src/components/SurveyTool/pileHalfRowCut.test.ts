import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { resolvePileHalfRowCut, resolvePileListFit, usePileHalfRowCut } from './pileHalfRowCut';

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

describe('resolvePileListFit', () => {
  const spreadBy = (rows: { top: number; height: number }[], spread: number) =>
    rows.map((row, index) => ({ top: row.top + index * spread, height: row.height }));
  // Where the list ends on screen, and how far through which row.
  const shownEnd = (available: number, rows: { top: number; height: number }[]) => {
    const { spread, height } = resolvePileListFit(available, rows);
    const end = height ?? available;
    const row = cutRow(end, spreadBy(rows, spread));
    return { spread, end, share: row ? (end - row.top) / row.height : NaN };
  };

  it('fills the room with one-line options and still ends inside one, wherever the room ends', () => {
    [
      [46, 46, 46, 46, 46, 46],
      [44, 44, 44, 44, 44, 44, 44, 44],
    ].forEach((heights) => {
      const rows = rowsOf(heights);
      const total = rows[rows.length - 1].top + rows[rows.length - 1].height;
      // From the first room that reaches the second row's middle part: one row above it can take the space.
      for (let available = Math.ceil(rows[1].top + rows[1].height * 0.4); available < total; available += 1) {
        const { spread, end, share } = shownEnd(available, rows);
        // No blank band: the list ends where its room does.
        expect(available - end).toBeLessThanOrEqual(1);
        expect(spread).toBeLessThanOrEqual(44);
        expect(share).toBeGreaterThanOrEqual(0.39);
        expect(share).toBeLessThanOrEqual(0.71);
      }
    });
  });

  it('never opens a gap wider than an option for tall options, and never ends worse than the cut alone', () => {
    [
      [64, 44, 86, 44, 64, 108, 44, 64],
      [108, 108, 86, 64, 64],
      [64, 108, 108],
    ].forEach((heights) => {
      const rows = rowsOf(heights);
      const total = rows[rows.length - 1].top + rows[rows.length - 1].height;
      for (let available = 60; available < total; available += 1) {
        const { spread, end, share } = shownEnd(available, rows);
        expect(spread).toBeLessThanOrEqual(44);
        expect(end).toBeLessThanOrEqual(available);
        expect(end).toBeGreaterThanOrEqual(resolvePileHalfRowCut(available, rows) as number);
        expect(share).toBeGreaterThanOrEqual(0.39);
        expect(share).toBeLessThanOrEqual(0.71);
        // Short of the limit, the room is filled.
        if (spread > 0 && spread < 44) expect(available - end).toBeLessThanOrEqual(1);
      }
    });
    // Rows of 64, 108 and 108 in a 230px room: 77px would go to the one gap; it takes 44 and the list ends 34 short.
    expect(resolvePileListFit(230, rowsOf([64, 108, 108]))).toEqual({ spread: 44, height: 196 });
  });

  it('shares the space evenly between the rows above the cut one', () => {
    // Rows of 46 at 7, 61, 115 and 169: a 169px room ends where the fourth row starts, 21.8px past the third's cut.
    const rows = rowsOf([46, 46, 46, 46, 46, 46], 8, 7);
    const fit = resolvePileListFit(169, rows);
    expect(fit.spread).toBeCloseTo((169 - (115 + 46 * 0.7)) / 2, 5);
    expect(fit.height).toBeUndefined();
  });

  it('only shortens the list when the room already ends inside a row, or no row is above the cut one', () => {
    const rows = rowsOf([46, 46, 46, 46], 8, 7);
    expect(resolvePileListFit(rows[2].top + 23, rows)).toEqual({ spread: 0, height: rows[2].top + 23 });
    // The first row is the cut one; the second starts below the room.
    expect(resolvePileListFit(58, rows)).toEqual({ spread: 0, height: 39 });
  });

  it('leaves a list that fits alone', () => {
    expect(resolvePileListFit(400, rowsOf([46, 46, 46, 46], 8, 7))).toEqual({ spread: 0 });
  });
});

describe('usePileHalfRowCut', () => {
  // jsdom has no layout, so the area and its rows report the sizes a phone would.
  const ROW = 44;
  const GAP = 8;
  const rowTops = [0, 1, 2, 3].map((index) => index * (ROW + GAP));
  const lastRowEnd = rowTops[3] + ROW;

  const watched = new Set<Element>();
  class StubResizeObserver {
    observe(element: Element) {
      watched.add(element);
    }
    disconnect() {
      watched.clear();
    }
  }

  const List = ({ overflowY }: { overflowY: string }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const cue = usePileHalfRowCut(ref, '.row');
    return React.createElement(
      'div',
      { 'data-testid': 'frame', 'data-cue': cue },
      React.createElement(
        'div',
        { ref, 'data-testid': 'area', style: { overflowY } },
        React.createElement(
          'div',
          { 'data-testid': 'list' },
          rowTops.map((top) => React.createElement('div', { key: top, className: 'row' })),
        ),
      ),
    );
  };

  const shape = (area: HTMLElement, height: number, scrollHeight: number) => {
    Object.defineProperty(area, 'clientHeight', { configurable: true, get: () => height });
    Object.defineProperty(area, 'offsetHeight', { configurable: true, get: () => height });
    Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    area.getBoundingClientRect = () => ({ top: 0, height }) as DOMRect;
    Array.from(area.querySelectorAll('.row')).forEach((row, index) => {
      row.getBoundingClientRect = () => ({ top: rowTops[index] - area.scrollTop, height: ROW }) as DOMRect;
    });
  };

  // Sizes go on after mount, as layout would; a content change then makes the hook fit again.
  const renderList = async (overflowY: string, height: number, scrollHeight = lastRowEnd + 28) => {
    const view = render(React.createElement(List, { overflowY }));
    const area = screen.getByTestId('area');
    shape(area, height, scrollHeight);
    await act(async () => {
      area.append(document.createElement('span'));
    });
    return { area, view };
  };

  beforeAll(() => {
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = StubResizeObserver;
  });

  afterAll(() => {
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
  });

  it('spreads the rows to fill the room, still ending inside one, and marks which ends have more', async () => {
    const { area } = await renderList('auto', 120);
    // The third row runs 104 to 148, too far down for a cut; the second, 52 to 96, is cut at 70% (82.8). The 37.2px
    // of room past it goes to the one gap above, so the list keeps its whole room rather than leave it blank.
    expect(area.style.maxHeight).toBe('');
    expect(area.style.getPropertyValue('--pile-list-row-spread')).toBe('37.2px');
    expect(area.dataset.listCue).toBe('start');
    area.scrollTop = 40;
    fireEvent.scroll(area);
    expect(area.dataset.listCue).toBe('middle');
    area.scrollTop = lastRowEnd - 120;
    fireEvent.scroll(area);
    expect(area.dataset.listCue).toBe('end');
    // The card's chevrons follow the same cue.
    expect(screen.getByTestId('frame').dataset.cue).toBe('end');
  });

  it('watches the rows, not the list the spread resizes, so a fit never calls for another', async () => {
    const { area } = await renderList('auto', 120);
    expect(area.style.getPropertyValue('--pile-list-row-spread')).not.toBe('');
    expect(Array.from(area.querySelectorAll('.row')).every((row) => watched.has(row))).toBe(true);
    expect(watched.has(screen.getByTestId('list'))).toBe(false);
    expect(watched.has(area)).toBe(false);
    expect(watched.has(screen.getByTestId('frame'))).toBe(true);
  });

  it('shortens the list instead when no row is above the cut one', async () => {
    const { area } = await renderList('auto', 60);
    // Only the first row, 0 to 44, is in reach: it is cut at 70%.
    expect(area.style.maxHeight).toBe('30px');
    expect(area.style.getPropertyValue('--pile-list-row-spread')).toBe('');
  });

  it('leaves the rows alone when the room already ends inside one', async () => {
    const { area } = await renderList('auto', 78);
    expect(area.style.maxHeight).toBe('78px');
    expect(area.style.getPropertyValue('--pile-list-row-spread')).toBe('');
  });

  it('shows no cue when every option fits, whatever space is left below the last', async () => {
    const { area } = await renderList('auto', lastRowEnd + 4, lastRowEnd + 40);
    expect(area.style.maxHeight).toBe('');
    expect(area.dataset.listCue).toBe('none');
    expect(screen.getByTestId('frame').dataset.cue).toBe('none');
  });

  it('leaves a list that does not scroll its own height', async () => {
    const { area } = await renderList('hidden', 120);
    expect(area.style.maxHeight).toBe('');
    expect(area.style.getPropertyValue('--pile-list-row-spread')).toBe('');
    // It cannot scroll, so the card has no place for chevrons.
    expect(screen.getByTestId('frame').dataset.cue).toBe('off');
  });

  it('clears its fit and cue when it goes', async () => {
    const spread = await renderList('auto', 120);
    expect(spread.area.style.getPropertyValue('--pile-list-row-spread')).not.toBe('');
    spread.view.unmount();
    expect(spread.area.dataset.listCue).toBeUndefined();
    expect(spread.area.style.getPropertyValue('--pile-list-row-spread')).toBe('');
    const cut = await renderList('auto', 60);
    expect(cut.area.style.maxHeight).not.toBe('');
    cut.view.unmount();
    expect(cut.area.style.maxHeight).toBe('');
  });
});
