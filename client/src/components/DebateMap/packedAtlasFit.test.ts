import { estimateTextWidth, fitPackedAtlasCirclesToBox, fitPackedAtlasLabel } from './packedAtlasFit';

describe('a built atlas on a phone', () => {
  it('grows the circles to the panel width, centred and set against the top', () => {
    // Two circles side by side, 100 wide in all, in a box 300 wide and tall enough.
    const circles = [
      { x: 125, y: 140, r: 25 },
      { x: 175, y: 140, r: 25 },
    ];
    const fit = fitPackedAtlasCirclesToBox(circles, { width: 300, height: 600 }, 4);
    expect(fit.scale).toBeCloseTo(3);
    const placed = circles.map((circle) => ({
      x: circle.x * fit.scale + fit.dx,
      y: circle.y * fit.scale + fit.dy,
      r: circle.r * fit.scale,
    }));
    expect(placed[0].x - placed[0].r).toBeCloseTo(0);
    expect(placed[1].x + placed[1].r).toBeCloseTo(300);
    expect(placed[0].y - placed[0].r).toBeCloseTo(0);
  });

  it('stops at the box height and at the most it may grow, and never shrinks', () => {
    const circles = [{ x: 50, y: 50, r: 50 }];
    expect(fitPackedAtlasCirclesToBox(circles, { width: 300, height: 150 }).scale).toBeCloseTo(1.5);
    expect(fitPackedAtlasCirclesToBox(circles, { width: 900, height: 900 }).scale).toBeCloseTo(2.4);
    expect(fitPackedAtlasCirclesToBox(circles, { width: 60, height: 60 }).scale).toBe(1);
    expect(fitPackedAtlasCirclesToBox([], { width: 300, height: 300 })).toEqual({ scale: 1, dx: 0, dy: 0 });
  });
});

describe("a circle's title", () => {
  const widest = (lines: string[], fontSizePx: number) =>
    Math.max(...lines.map((line) => estimateTextWidth(line, fontSizePx)));

  it('is set in whole words on lines that fit the circle, at the largest size that does', () => {
    const name = 'Neighbourhood Confidence and Preparedness';
    const fit = fitPackedAtlasLabel(name, 120, { maxFontPx: 14 });
    expect(fit).not.toBeNull();
    expect(fit?.lines.join(' ')).toBe(name);
    expect(fit?.lines.every((line) => !/-$/.test(line))).toBe(true);
    expect(widest(fit?.lines || [], fit?.fontSizePx || 0)).toBeLessThanOrEqual(120 * 0.82);
    // A roomier circle sets the same title larger, and never above the size it was given.
    const roomy = fitPackedAtlasLabel(name, 240, { maxFontPx: 14 });
    expect(roomy?.fontSizePx).toBe(14);
    expect(roomy?.fontSizePx).toBeGreaterThan(fit?.fontSizePx || 0);
  });

  it('keeps a short title on one line and leaves no line empty', () => {
    expect(fitPackedAtlasLabel('Repairs', 120, { maxFontPx: 14 })).toEqual({ fontSizePx: 14, lines: ['Repairs'] });
    const fit = fitPackedAtlasLabel('Trials and Collaboration', 100, { maxFontPx: 14 });
    expect(fit?.lines.every(Boolean)).toBe(true);
  });

  it('gives no fit where a single word cannot fit whole at the smallest size', () => {
    expect(fitPackedAtlasLabel('Counterrevolutionaries', 40, { maxFontPx: 14 })).toBeNull();
    expect(fitPackedAtlasLabel('', 120, { maxFontPx: 14 })).toBeNull();
    expect(fitPackedAtlasLabel('Repairs', 0, { maxFontPx: 14 })).toBeNull();
  });
});
