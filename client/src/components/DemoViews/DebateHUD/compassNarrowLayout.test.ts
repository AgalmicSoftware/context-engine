import { NARROW_COMPASS_GEOMETRY, layoutNarrowPointLabel, wrapCompassLabel } from './compassNarrowLayout';

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
});
