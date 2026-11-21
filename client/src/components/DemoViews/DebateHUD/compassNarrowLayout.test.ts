import {
  COMPASS_NARROW_BELOW_PX,
  NARROW_COMPASS_GEOMETRY,
  WIDE_COMPASS_GEOMETRY,
  compassLayoutFor,
  fitCompassLabel,
  layoutNarrowPointLabel,
  layoutPointLabels,
  wrapCompassLabel,
} from './compassNarrowLayout';

const { svgW, svgH, padX, padY } = NARROW_COMPASS_GEOMETRY;
const bounds = { left: padX, top: padY, right: svgW - padX, bottom: svgH - padY };

describe('the two-axis chart drawn narrow', () => {
  it('wraps an axis label between words, on lines of about equal length', () => {
    expect(wrapCompassLabel('Short label', 300, 13)).toEqual(['Short label']);
    const lines = wrapCompassLabel('Prioritize careful trials and long discussion in every district', 300, 13);
    expect(lines).toHaveLength(2);
    expect(lines.join(' ')).toBe('Prioritize careful trials and long discussion in every district');
    expect(Math.abs(lines[0].length - lines[1].length)).toBeLessThan(12);
    expect(wrapCompassLabel('', 300, 13)).toEqual([]);
  });

  it("keeps a point's name inside the square, so it never covers an axis label", () => {
    const name = 'Balanced rollout through diverse local partners';
    for (const [px, py] of [
      [padX + 4, padY + 4],
      [svgW - padX - 4, padY + 4],
      [padX + 4, svgH - padY - 4],
      [svgW - padX - 4, svgH - padY - 4],
    ]) {
      const box = layoutNarrowPointLabel({ name, px, py, size: 7, fontPx: 10, bounds, others: [] });
      expect(box.lines.join(' ')).toBe(name);
      expect(box.x).toBeGreaterThanOrEqual(bounds.left);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.right);
      expect(box.y).toBeGreaterThanOrEqual(bounds.top);
      expect(box.y + box.height).toBeLessThanOrEqual(bounds.bottom);
      // Never over its own point.
      const overOwn = px > box.x && px < box.x + box.width && py > box.y && py < box.y + box.height;
      expect(overOwn).toBe(false);
    }
  });

  it('moves the name off another point that sits where it would go', () => {
    const point = { px: 300, py: 320 };
    const above = layoutNarrowPointLabel({ name: 'A position', ...point, size: 7, fontPx: 10, bounds, others: [] });
    expect(above.y + above.height).toBeLessThan(point.py);
    // A participant sits just above the position: the name goes elsewhere.
    const participant = { px: 300, py: 320 - 24 };
    const moved = layoutNarrowPointLabel({
      name: 'A position',
      ...point,
      size: 7,
      fontPx: 10,
      bounds,
      others: [participant],
    });
    const covers =
      participant.px > moved.x &&
      participant.px < moved.x + moved.width &&
      participant.py > moved.y &&
      participant.py < moved.y + moved.height;
    expect(covers).toBe(false);
  });

  it('never cuts an axis label: it wraps, then is set smaller', () => {
    const fits = ({ lines, fontPx }: { lines: string[]; fontPx: number }, room: number) =>
      lines.every((line) => line.length * fontPx * 0.62 <= room);
    // Beside the wide square there is room for about fifteen characters a line.
    const room = WIDE_COMPASS_GEOMETRY.padX - 20;
    const side = fitCompassLabel('Existing arrangements should be replaced entirely', room, 14, 6);
    expect(side.lines.join(' ')).toBe('Existing arrangements should be replaced entirely');
    expect(side.lines.length).toBeGreaterThan(2);
    expect(side.fontPx).toBe(14);
    expect(fits(side, room)).toBe(true);
    // One word longer than a line is set smaller, not cut.
    const word = fitCompassLabel('Institutionalisation everywhere', room, 14, 6);
    expect(word.fontPx).toBeLessThan(14);
    expect(fits(word, room)).toBe(true);
    // More words than the lines hold, even at the smallest size: it takes another line.
    const long = fitCompassLabel('one two three four five six seven eight nine ten eleven twelve', 120, 13, 2);
    expect(long.fontPx).toBe(8);
    expect(long.lines.length).toBe(3);
    expect(long.lines.join(' ')).toBe('one two three four five six seven eight nine ten eleven twelve');
    expect(fits(long, 120)).toBe(true);
  });

  it('sizes its text for the width it is drawn at', () => {
    expect(compassLayoutFor(0)).toEqual({ narrow: false, geometry: WIDE_COMPASS_GEOMETRY, pointFontPx: 10 });
    expect(compassLayoutFor(400)).toEqual({ narrow: true, geometry: NARROW_COMPASS_GEOMETRY, pointFontPx: 10 });
    expect(NARROW_COMPASS_GEOMETRY).toEqual({ svgW: 400, svgH: 442, padX: 38, padY: 59, edgeFontPx: 13 });
    for (const width of [
      250,
      290,
      330,
      370,
      500,
      COMPASS_NARROW_BELOW_PX - 1,
      COMPASS_NARROW_BELOW_PX,
      720,
      900,
      1200,
    ]) {
      const { narrow, geometry, pointFontPx } = compassLayoutFor(width);
      expect(narrow).toBe(width < COMPASS_NARROW_BELOW_PX);
      const scale = width / geometry.svgW;
      // Rounded to whole units of the drawing, so within half a unit of the bounds.
      expect(geometry.edgeFontPx * scale).toBeGreaterThanOrEqual(11 - scale / 2);
      expect(geometry.edgeFontPx * scale).toBeLessThanOrEqual(15 + scale / 2);
      expect(pointFontPx * scale).toBeGreaterThanOrEqual(9 - scale / 2);
      // The narrow chart keeps room for two lines along each side and three above and below: the lines between
      // (E + 3 apart), the gap to the square, and the outer line's own height (ascent 0.8 E, descent 0.25 E).
      if (narrow) {
        const E = geometry.edgeFontPx;
        expect(geometry.padX).toBeGreaterThanOrEqual(8 + (E + 3) + 0.8 * E);
        expect(geometry.padY).toBeGreaterThanOrEqual(10 + 2 * (E + 3) + 0.8 * E);
        expect(geometry.padY).toBeGreaterThanOrEqual(E + 6 + 2 * (E + 3) + 0.25 * E);
      }
    }
  });

  it('keeps two names apart when their points sit side by side', () => {
    const wide = WIDE_COMPASS_GEOMETRY;
    const square = { left: wide.padX, top: wide.padY, right: wide.svgW - wide.padX, bottom: wide.svgH - wide.padY };
    const points = [
      { key: 'a', name: 'Reinvent schooling through local practice', px: 200, py: 130, size: 10, fontPx: 11 },
      { key: 'b', name: 'Renew schools with the outcome uncertain', px: 400, py: 140, size: 10, fontPx: 11 },
    ];
    const placed = layoutPointLabels(points, points, square, 0.45);
    const [a, b] = [placed.get('a'), placed.get('b')];
    expect(a && b).toBeTruthy();
    if (!a || !b) return;
    const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlap).toBe(false);
    for (const box of [a, b]) {
      expect(box.x).toBeGreaterThanOrEqual(square.left);
      expect(box.x + box.width).toBeLessThanOrEqual(square.right);
    }
  });

  it('never cuts a long point name, even on a phone', () => {
    // The longest name a build stores is a hundred characters.
    const name = 'Coordinate neighbourhood services with regional transit while reforming how councils are elected';
    expect(name.length).toBeGreaterThan(90);
    for (const width of [254, 276, 331, 364]) {
      const { geometry, pointFontPx } = compassLayoutFor(width);
      const square = {
        left: geometry.padX,
        top: geometry.padY,
        right: geometry.svgW - geometry.padX,
        bottom: geometry.svgH - geometry.padY,
      };
      const fontPx = pointFontPx + 1;
      const box = layoutNarrowPointLabel({ name, px: 200, py: 200, size: 10, fontPx, bounds: square, others: [] });
      expect(box.lines.join(' ')).toBe(name);
      box.lines.forEach((line) => expect(line.length * fontPx * 0.62 + 10).toBeLessThanOrEqual(box.width + 0.01));
      expect(box.x).toBeGreaterThanOrEqual(square.left);
      expect(box.x + box.width).toBeLessThanOrEqual(square.right);
      expect(box.y).toBeGreaterThanOrEqual(square.top);
      expect(box.y + box.height).toBeLessThanOrEqual(square.bottom);
    }
  });
});
