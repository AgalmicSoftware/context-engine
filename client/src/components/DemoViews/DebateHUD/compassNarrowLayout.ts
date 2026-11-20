/** @file compassNarrowLayout.ts: the two-axis chart's geometry and labels where it is drawn narrow, as on a phone. */

/** Below this drawn width the chart uses the narrow geometry: its own units are then about a screen pixel each. */
export const COMPASS_NARROW_BELOW_PX = 440;

export type CompassGeometry = { svgW: number; svgH: number; padX: number; padY: number; edgeFontPx: number };

// Wide: a 500-unit square with room at each side for an axis label on one or two lines.
export const WIDE_COMPASS_GEOMETRY: CompassGeometry = { svgW: 800, svgH: 700, padX: 150, padY: 80, edgeFontPx: 14 };
// Narrow: the square takes nearly the whole width; the side labels run up and down the sides.
export const NARROW_COMPASS_GEOMETRY: CompassGeometry = { svgW: 400, svgH: 436, padX: 38, padY: 56, edgeFontPx: 13 };

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

export type CompassLabelBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
};

/**
 * Where a point's name goes on the narrow chart: wrapped to at most three lines and kept inside the square, so it
 * never covers an axis label. It is tried above the point, below it, and to each side; the first place that
 * covers neither its own point nor another wins, and failing that the place that covers the fewest. Wide charts
 * keep the single line above the point.
 */
export const layoutNarrowPointLabel = ({
  name,
  px,
  py,
  size,
  fontPx,
  bounds,
  others,
}: {
  name: string;
  px: number;
  py: number;
  size: number;
  fontPx: number;
  /** The square the points are drawn in. */
  bounds: { left: number; top: number; right: number; bottom: number };
  others: Array<{ px: number; py: number }>;
}): CompassLabelBox => {
  const room = bounds.right - bounds.left - 4;
  const lines = wrapCompassLabel(name, room * 0.7, fontPx, 3);
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
  ].map((place) => ({ x: clampX(place.x), y: clampY(place.y) }));
  // A point is covered when its centre, with room for its mark, falls inside the label's box.
  const covers = (place: { x: number; y: number }, point: { px: number; py: number }, margin: number) =>
    point.px > place.x - margin &&
    point.px < place.x + width + margin &&
    point.py > place.y - margin &&
    point.py < place.y + height + margin;
  const cost = (place: { x: number; y: number }) =>
    others.filter((other) => covers(place, other, 8)).length + (covers(place, { px, py }, size) ? 10 : 0);
  const best = places.reduce((chosen, place) => (cost(place) < cost(chosen) ? place : chosen), places[0]);
  return { x: best.x, y: best.y, width, height, lines, lineHeight };
};
