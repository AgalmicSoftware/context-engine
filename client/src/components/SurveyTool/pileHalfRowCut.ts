/** @file pileHalfRowCut.ts: where a scrolling answer list ends, so its last visible row is always cut through. */
import React, { useLayoutEffect, useState } from 'react';

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

// The most a gap between rows may grow: a one-line option's height. That fills any room with one-line options
// (the most they need is 70% of a row and a gap, 40px for a 46px row); taller ones would open a gap wider than an
// option, so past this the list is shortened for the rest.
const SPREAD_MAX = 44;

export type PileListFit = {
  /** Space to add to each gap between rows. */
  spread: number;
  /** The list's height where it must be shorter than its room; undefined where it keeps the room. */
  height?: number;
};

/**
 * How a scrolling list fills `available` and still ends inside a row. The cut alone can only shorten a list, so
 * room that ended between one row's middle part and the next left a blank band under it: the rows above the cut
 * one spread apart instead, by what brings that row's cut to the room's end. Where no row is above it, or the gaps
 * would grow past SPREAD_MAX, the list is shortened as before.
 */
export const resolvePileListFit = (available: number, rows: PileListRow[]): PileListFit => {
  const cut = resolvePileHalfRowCut(available, rows);
  if (cut === undefined) return { spread: 0 };
  const cutRow = rows.find((row) => cut > row.top && cut < row.top + row.height);
  if (!cutRow) return { spread: 0, height: cut };
  const gapsAbove = rows.filter((row) => row.top < cutRow.top).length;
  const end = cutRow.top + cutRow.height * CUT_TO;
  const slack = available - end;
  if (gapsAbove === 0 || slack <= 0) return { spread: 0, height: cut };
  const spread = slack / gapsAbove;
  if (spread <= SPREAD_MAX) return { spread };
  return { spread: SPREAD_MAX, height: Math.floor(end + gapsAbove * SPREAD_MAX) };
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

export type PileListCue = 'none' | 'start' | 'middle' | 'end';

// Read by the list's styles as extra space between its rows.
const ROW_SPREAD = '--pile-list-row-spread';

/**
 * Keeps a scrolling answer area ending inside a row, and marks which ends have more (`data-list-cue`), so a long list
 * never looks complete. The rows spread apart to fill the room, and the area shortens where they cannot
 * (resolvePileListFit). Applies only while the area scrolls (phones); elsewhere it leaves it alone. Returns the
 * cue, or 'off' where the area cannot scroll.
 */
export const usePileHalfRowCut = (
  ref: React.RefObject<HTMLElement | null>,
  rowSelector: string,
): PileListCue | 'off' => {
  const [listCue, setListCue] = useState<PileListCue | 'off'>('off');
  useLayoutEffect(() => {
    const area = ref.current;
    const frame = area?.parentElement;
    if (!area || !frame || typeof ResizeObserver === 'undefined') return;
    const updateCue = () => {
      // The list ends where its last option does, as the cut measures it: the padding and wrapper space below only
      // keep that option clear of the fade, and are not more to see.
      const rows = Array.from(area.querySelectorAll(rowSelector));
      const end = rows.length
        ? Math.max(...measurePileListRows(area, rows).map((row) => row.top + row.height))
        : area.scrollHeight - (parseFloat(getComputedStyle(area).paddingBottom) || 0);
      const overflowY = getComputedStyle(area).overflowY;
      const scrollable = overflowY === 'auto' || overflowY === 'scroll';
      const scrolls = scrollable && end > area.clientHeight + 1;
      const atStart = area.scrollTop <= 1;
      const atEnd = area.scrollTop + area.clientHeight >= end - 1;
      const cue: PileListCue = !scrolls ? 'none' : atStart ? 'start' : atEnd ? 'end' : 'middle';
      if (area.dataset.listCue !== cue) area.dataset.listCue = cue;
      setListCue(scrollable ? cue : 'off');
    };
    const fit = () => {
      // Measure the rows as they lie on their own, without the last fit. Undoing it can shorten the content, which
      // would pull a scrolled list back; it keeps its place.
      const scrolled = area.scrollTop;
      area.style.maxHeight = '';
      area.style.removeProperty(ROW_SPREAD);
      const rows = Array.from(area.querySelectorAll(rowSelector));
      const overflowY = getComputedStyle(area).overflowY;
      if (rows.length && (overflowY === 'auto' || overflowY === 'scroll')) {
        const { spread, height } = resolvePileListFit(area.clientHeight, measurePileListRows(area, rows));
        if (spread > 0) area.style.setProperty(ROW_SPREAD, `${Math.round(spread * 100) / 100}px`);
        if (height !== undefined) area.style.maxHeight = `${height}px`;
      }
      if (area.scrollTop !== scrolled) area.scrollTop = scrolled;
      updateCue();
    };
    // The frame keeps its size whatever the area's own height, and a row keeps its size however far apart the
    // rows are spread, so fitting never feeds back: the rows are watched, not the list around them, which the
    // spread resizes. The prompt above can change size (it shrinks a long one to fit) and so change the room; rows
    // that wrap differently (rotation, font size, a tick beside a long label) resize; a new question replaces them.
    const observer = new ResizeObserver(fit);
    const observeContent = () => {
      observer.disconnect();
      observer.observe(frame);
      Array.from(frame.children).forEach((sibling) => sibling !== area && observer.observe(sibling));
      const rows = Array.from(area.querySelectorAll(rowSelector));
      (rows.length ? rows : Array.from(area.children)).forEach((watched) => observer.observe(watched));
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
      area.style.removeProperty(ROW_SPREAD);
      delete area.dataset.listCue;
      setListCue('off');
    };
  }, [ref, rowSelector]);
  return listCue;
};
