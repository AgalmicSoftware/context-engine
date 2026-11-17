/** @file pileHalfRowCut.ts: where a scrolling answer list ends, so its last visible row is always cut through. */
import React, { useLayoutEffect } from 'react';

export type PileListRow = { top: number; height: number };

// The cut lands in the middle part of a row: never near its top or bottom edge, where the list could look complete.
const CUT_FROM = 0.4;
const CUT_TO = 0.7;

/**
 * The tallest list height, at most `available`, whose bottom edge cuts through a row. Rows are measured from the
 * top of the list's content. Returns undefined when everything fits, or when no cut fits.
 */
export const resolvePileHalfRowCut = (available: number, rows: PileListRow[]): number | undefined => {
  const contentBottom = Math.max(0, ...rows.map((row) => row.top + row.height));
  if (!(available > 0) || contentBottom <= available) return undefined;
  let cut: number | undefined;
  for (const { top, height } of rows) {
    if (!(height > 0)) continue;
    const from = top + height * CUT_FROM;
    if (from > available) continue;
    const candidate = Math.min(available, top + height * CUT_TO);
    if (cut === undefined || candidate > cut) cut = candidate;
  }
  return cut === undefined ? undefined : Math.floor(cut);
};

/**
 * Rows measured from the top of a scrolling list's content, whatever it has scrolled to, in layout pixels: a card
 * still scaling in as it arrives would otherwise shrink every measure.
 */
export const measurePileListRows = (list: HTMLElement, rows: Element[]): PileListRow[] => {
  const box = list.getBoundingClientRect();
  const scale = list.offsetHeight > 0 && box.height > 0 ? box.height / list.offsetHeight : 1;
  return rows.map((row) => {
    const rect = row.getBoundingClientRect();
    return { top: (rect.top - box.top) / scale + list.scrollTop, height: rect.height / scale };
  });
};

/**
 * Keeps a scrolling answer area ending inside a row, and marks which ends have more (`data-list-cue`), so a long
 * list never looks complete. Applies only while the area scrolls (phones); elsewhere it leaves it alone.
 */
export const usePileHalfRowCut = (ref: React.RefObject<HTMLElement | null>, rowSelector: string): void => {
  useLayoutEffect(() => {
    const area = ref.current;
    const frame = area?.parentElement;
    if (!area || !frame || typeof ResizeObserver === 'undefined') return;
    const updateCue = () => {
      // The bottom padding only keeps the last option clear of the fade; it is not more to see.
      const end = area.scrollHeight - (parseFloat(getComputedStyle(area).paddingBottom) || 0);
      const scrolls = end > area.clientHeight + 1;
      const atStart = area.scrollTop <= 1;
      const atEnd = area.scrollTop + area.clientHeight >= end - 1;
      const cue = !scrolls ? 'none' : atStart ? 'start' : atEnd ? 'end' : 'middle';
      if (area.dataset.listCue !== cue) area.dataset.listCue = cue;
    };
    const fit = () => {
      area.style.maxHeight = '';
      const rows = Array.from(area.querySelectorAll(rowSelector));
      const overflowY = getComputedStyle(area).overflowY;
      if (rows.length && (overflowY === 'auto' || overflowY === 'scroll')) {
        const cut = resolvePileHalfRowCut(area.clientHeight, measurePileListRows(area, rows));
        if (cut !== undefined) area.style.maxHeight = `${cut}px`;
      }
      updateCue();
    };
    // The frame keeps its size whatever the area's own height, so fitting it never feeds back. The prompt above
    // can change size (it shrinks a long one to fit) and so change the room; rows that wrap differently (rotation,
    // font size) resize the content; a new question replaces it.
    const observer = new ResizeObserver(fit);
    const observeContent = () => {
      observer.disconnect();
      observer.observe(frame);
      Array.from(frame.children).forEach((sibling) => sibling !== area && observer.observe(sibling));
      Array.from(area.children).forEach((child) => observer.observe(child));
    };
    const contentWatcher = new MutationObserver(() => {
      observeContent();
      fit();
    });
    contentWatcher.observe(area, { childList: true, subtree: true });
    observeContent();
    fit();
    area.addEventListener('scroll', updateCue, { passive: true });
    return () => {
      observer.disconnect();
      contentWatcher.disconnect();
      area.removeEventListener('scroll', updateCue);
      area.style.maxHeight = '';
      delete area.dataset.listCue;
    };
  }, [ref, rowSelector]);
};
