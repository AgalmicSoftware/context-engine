/** @file compassNarrowLayout.ts: the two-axis chart's geometry and labels where it is drawn narrow, as on a phone. */

/**
 * Below this drawn width the chart uses the narrow geometry. The wide one keeps its axis labels beside the square,
 * and drawn any smaller its text would fall under a readable size.
 */
export const COMPASS_NARROW_BELOW_PX = 620;

export type CompassGeometry = { svgW: number; svgH: number; padX: number; padY: number; edgeFontPx: number };

// Wide: a 500-unit square with room at each side for an axis label on a few short lines.
export const WIDE_COMPASS_GEOMETRY: CompassGeometry = { svgW: 800, svgH: 700, padX: 150, padY: 80, edgeFontPx: 14 };
// Narrow: the square takes nearly the whole width; the side labels run up and down the sides, on up to two lines,
// and the top and bottom labels take up to three.
const narrowGeometry = (edgeFontPx: number): CompassGeometry => {
  const lineHeight = edgeFontPx + 3;
  const padX = Math.round(2 * lineHeight + 6);
  // Three lines above, and three below with their descenders.
  const padY = Math.round(3 * lineHeight + 8 + edgeFontPx / 4);
  return { svgW: 400, svgH: 400 - 2 * padX + 2 * padY, padX, padY, edgeFontPx };
};
export const NARROW_COMPASS_GEOMETRY: CompassGeometry = narrowGeometry(13);

// A size in the chart's own units that is drawn between `minPx` and `maxPx` on screen at `scale`.
const onScreen = (basePx: number, scale: number, minPx: number, maxPx: number) =>
  Math.min(Math.max(basePx * scale, minPx), maxPx) / scale;

/**
 * The chart's geometry and text sizes for the width it is drawn at. The drawing scales with its width, so its text
 * is sized against that: axis labels start 11 to 15 pixels tall on screen and point names 9 to 13, at any width.
 * (An axis label too long for its room is then set smaller, see fitCompassLabel.) A width of 0, not yet measured,
 * gives the wide chart at its own size.
 */
export const compassLayoutFor = (drawnWidth: number) => {
  const narrow = drawnWidth > 0 && drawnWidth < COMPASS_NARROW_BELOW_PX;
  const scale = drawnWidth > 0 ? drawnWidth / (narrow ? 400 : WIDE_COMPASS_GEOMETRY.svgW) : 1;
  const geometry = narrow
    ? narrowGeometry(Math.round(onScreen(13, scale, 11, 14)))
    : { ...WIDE_COMPASS_GEOMETRY, edgeFontPx: Math.round(onScreen(14, scale, 11, 15)) };
  return { narrow, geometry, pointFontPx: Math.round(onScreen(10, scale, 9, 13)) };
};

// The chart's text is set in the page's monospace font, 0.6 of its size per character; a little is added for bold.
const charWidth = (fontPx: number) => fontPx * 0.62;

/** A label on as few lines as hold it within `roomPx`, at most `maxLines`, broken only between words. */
export const wrapCompassLabel = (label: string, roomPx: number, fontPx: number, maxLines = 2): string[] => {
  const words = String(label || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];
  const perLine = Math.max(1, Math.floor(roomPx / charWidth(fontPx)));
  for (let count = 1; count <= maxLines; count += 1) {
    // Lines of about equal length, so two short lines are not one long and one stub.
    const target = Math.min(perLine, Math.ceil(words.join(' ').length / count) + 2);
    const lines: string[] = [];
    for (const word of words) {
      const last = lines[lines.length - 1];
      if (last !== undefined && `${last} ${word}`.length <= target) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word);
    }
    if (lines.length <= count && lines.every((line) => line.length <= perLine)) return lines;
  }
  // Too long for the room even on every line: fill each line and let the last run on.
  const lines: string[] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (`${last} ${word}`.length <= perLine || lines.length === maxLines)) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else lines.push(word);
  }
  return lines;
};

/**
 * An axis label that is never cut: wrapped to at most `maxLines`, and where a line still runs past `roomPx` (one
 * long word, or more words than the lines hold) set smaller, down to `minFontPx`. A label too long even then takes
 * the further lines it needs at that size.
 */
export const fitCompassLabel = (
  label: string,
  roomPx: number,
  fontPx: number,
  maxLines: number,
  minFontPx = 8,
): { lines: string[]; fontPx: number } => {
  const fits = (lines: string[], size: number) => lines.every((line) => line.length * charWidth(size) <= roomPx);
  for (let size = fontPx; size >= minFontPx; size -= 1) {
    const lines = wrapCompassLabel(label, roomPx, size, maxLines);
    if (fits(lines, size)) return { lines, fontPx: size };
  }
  const size = Math.min(fontPx, minFontPx);
  for (let count = maxLines + 1; count < maxLines + 6; count += 1) {
    const lines = wrapCompassLabel(label, roomPx, size, count);
    if (fits(lines, size)) return { lines, fontPx: size };
  }
  return { lines: wrapCompassLabel(label, roomPx, size, maxLines + 6), fontPx: size };
};

export type CompassLabelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
};

/**
 * Where a point's name goes: wrapped, to three lines where it can be, and kept inside the square, so it never covers an
 * axis label. It is tried above the point, below it, to each side and at each corner; the first place that covers
 * no point and no name already placed wins, and failing that the place that covers the least.
 */
export const layoutNarrowPointLabel = ({
  name,
  px,
  py,
  size,
  fontPx,
  bounds,
  others,
  taken = [],
  wrapShare = 0.7,
}: {
  name: string;
  px: number;
  py: number;
  size: number;
  fontPx: number;
  /** The square the points are drawn in. */
  bounds: { left: number; top: number; right: number; bottom: number };
  others: Array<{ px: number; py: number }>;
  /** Names already placed, which this one keeps off. */
  taken?: CompassLabelBox[];
  /** How much of the square's width a line may take before the name wraps. */
  wrapShare?: number;
}): CompassLabelBox => {
  const room = bounds.right - bounds.left - 4;
  const short = wrapCompassLabel(name, room * wrapShare, fontPx, 3);
  // A name too long for three short lines takes the square's width and the lines it needs, so it is never cut.
  const lines = short.every((line) => line.length * charWidth(fontPx) + 10 <= room)
    ? short
    : wrapCompassLabel(name, room - 10, fontPx, 12);
  const lineHeight = fontPx + 2;
  const width = Math.min(room, Math.max(...lines.map((line) => line.length), 1) * charWidth(fontPx) + 10);
  const height = lines.length * lineHeight + 6;
  const gap = size + 5;
  const clampX = (x: number) => Math.min(Math.max(x, bounds.left + 2), bounds.right - 2 - width);
  const clampY = (y: number) => Math.min(Math.max(y, bounds.top + 2), bounds.bottom - 2 - height);
  const places = [
    { x: px - width / 2, y: py - gap - height },
    { x: px - width / 2, y: py + gap },
    { x: px + gap, y: py - height / 2 },
    { x: px - gap - width, y: py - height / 2 },
    { x: px + gap, y: py - gap - height },
    { x: px - gap - width, y: py - gap - height },
    { x: px + gap, y: py + gap },
    { x: px - gap - width, y: py + gap },
  ].map((place) => ({ x: clampX(place.x), y: clampY(place.y) }));
  // A point is covered when its centre, with room for its mark, falls inside the label's box.
  const covers = (place: { x: number; y: number }, point: { px: number; py: number }, margin: number) =>
    point.px > place.x - margin &&
    point.px < place.x + width + margin &&
    point.py > place.y - margin &&
    point.py < place.y + height + margin;
  // How much of this name another already placed would hide, from 0 to 1.
  const hidden = (place: { x: number; y: number }, box: CompassLabelBox) =>
    (Math.max(0, Math.min(place.x + width, box.x + box.width) - Math.max(place.x, box.x)) *
      Math.max(0, Math.min(place.y + height, box.y + box.height) - Math.max(place.y, box.y))) /
    (width * height);
  const cost = (place: { x: number; y: number }) =>
    others.filter((other) => covers(place, other, 8)).length +
    taken.reduce((sum, box) => sum + (hidden(place, box) > 0 ? 1 + 3 * hidden(place, box) : 0), 0) +
    (covers(place, { px, py }, size) ? 10 : 0);
  const best = places.reduce((chosen, place) => (cost(place) < cost(chosen) ? place : chosen), places[0]);
  return { x: best.x, y: best.y, width, height, lines, lineHeight };
};

/** Every shown name's place, each keeping off the points and the names placed before it. */
export const layoutPointLabels = <Key>(
  labels: Array<{ key: Key; name: string; px: number; py: number; size: number; fontPx: number }>,
  points: Array<{ px: number; py: number }>,
  bounds: { left: number; top: number; right: number; bottom: number },
  wrapShare: number,
): Map<Key, CompassLabelBox> => {
  const placed = new Map<Key, CompassLabelBox>();
  for (const { key, ...label } of labels) {
    const others = points.filter((point) => point.px !== label.px || point.py !== label.py);
    placed.set(key, layoutNarrowPointLabel({ ...label, bounds, others, taken: [...placed.values()], wrapShare }));
  }
  return placed;
};
