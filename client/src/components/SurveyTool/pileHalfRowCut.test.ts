import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { resolvePileHalfRowCut, usePileHalfRowCut } from './pileHalfRowCut';

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

describe('usePileHalfRowCut', () => {
  // jsdom has no layout, so the area and its rows report the sizes a phone would.
  const ROW = 44;
  const GAP = 8;
  const rowTops = [0, 1, 2, 3].map((index) => index * (ROW + GAP));
  const lastRowEnd = rowTops[3] + ROW;

  class StubResizeObserver {
    observe() {}
    disconnect() {}
  }

  const List = ({ overflowY }: { overflowY: string }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    usePileHalfRowCut(ref, '.row');
    return React.createElement(
      'div',
      null,
      React.createElement(
        'div',
        { ref, 'data-testid': 'area', style: { overflowY } },
        rowTops.map((top) => React.createElement('div', { key: top, className: 'row' })),
      ),
    );
  };

  const shape = (area: HTMLElement, height: number, scrollHeight: number) => {
    Object.defineProperty(area, 'clientHeight', { configurable: true, get: () => height });
    Object.defineProperty(area, 'offsetHeight', { configurable: true, get: () => height });
    Object.defineProperty(area, 'scrollHeight', { configurable: true, get: () => scrollHeight });
    area.getBoundingClientRect = () => ({ top: 0, height }) as DOMRect;
    Array.from(area.children).forEach((row, index) => {
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

  it('ends a scrolling list inside a row and marks which ends have more', async () => {
    const { area } = await renderList('auto', 120);
    // The third row runs 104 to 148, too far down for a cut; the second, 52 to 96, is cut at 70%.
    expect(area.style.maxHeight).toBe('82px');
    expect(area.dataset.listCue).toBe('start');
    area.scrollTop = 40;
    fireEvent.scroll(area);
    expect(area.dataset.listCue).toBe('middle');
    area.scrollTop = lastRowEnd - 120;
    fireEvent.scroll(area);
    expect(area.dataset.listCue).toBe('end');
  });

  it('shows no cue when every option fits, whatever space is left below the last', async () => {
    const { area } = await renderList('auto', lastRowEnd + 4, lastRowEnd + 40);
    expect(area.style.maxHeight).toBe('');
    expect(area.dataset.listCue).toBe('none');
  });

  it('leaves a list that does not scroll its own height', async () => {
    const { area } = await renderList('hidden', 120);
    expect(area.style.maxHeight).toBe('');
  });

  it('clears its cut and cue when it goes', async () => {
    const { area, view } = await renderList('auto', 120);
    expect(area.style.maxHeight).not.toBe('');
    view.unmount();
    expect(area.dataset.listCue).toBeUndefined();
    expect(area.style.maxHeight).toBe('');
  });
});
