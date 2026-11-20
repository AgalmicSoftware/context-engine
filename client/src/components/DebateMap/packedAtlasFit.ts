/** @file packedAtlasFit.ts: fitting a built atlas's circles to a phone, and each circle's title inside it. */

type Circle = { x: number; y: number; r: number };

/**
 * How to grow packed circles so they fill a box: `x * scale + dx`, `y * scale + dy`, `r * scale`. The pack lays its
 * circles inside one enclosing circle, which on a phone leaves most of a tall panel empty; the circles' own bounds
 * are fitted to the box's width instead, centred, and set against its top. Never shrinks, and grows at most
 * `maxScale` times.
 */
export const fitPackedAtlasCirclesToBox = (
  circles: Circle[],
  box: { width: number; height: number },
  maxScale = 2.4,
): { scale: number; dx: number; dy: number } => {
  const usable = circles.filter((circle) => circle.r > 0);
  if (!usable.length || !(box.width > 0) || !(box.height > 0)) return { scale: 1, dx: 0, dy: 0 };
  const left = Math.min(...usable.map((circle) => circle.x - circle.r));
  const right = Math.max(...usable.map((circle) => circle.x + circle.r));
  const top = Math.min(...usable.map((circle) => circle.y - circle.r));
  const bottom = Math.max(...usable.map((circle) => circle.y + circle.r));
  const scale = Math.max(1, Math.min(maxScale, box.width / (right - left), box.height / (bottom - top)));
  return { scale, dx: (box.width - (right - left) * scale) / 2 - left * scale, dy: -top * scale };
};

/** A text's width at a font size. The page measures with the font in use; elsewhere a wide estimate stands in. */
export type MeasureText = (text: string, fontSizePx: number) => number;

// Bold text in the body font averages a little under 0.6 of its size per character; the estimate errs wide.
export const estimateTextWidth: MeasureText = (text, fontSizePx) => text.length * fontSizePx * 0.62;

/** Measures in `fontFamily` at weight 700 on a canvas, or estimates where there is none (tests, old browsers). */
export const createTextMeasurer = (fontFamily: string): MeasureText => {
  let context: CanvasRenderingContext2D | null = null;
  try {
    // jsdom has no canvas and says so loudly; tests use the estimate.
    const canDraw = typeof document !== 'undefined' && !/jsdom/i.test(globalThis.navigator?.userAgent || '');
    context = canDraw ? document.createElement('canvas').getContext('2d') : null;
  } catch {
    context = null;
  }
  if (!context || !fontFamily) return estimateTextWidth;
  const drawing = context;
  return (text, fontSizePx) => {
    drawing.font = `700 ${fontSizePx}px ${fontFamily}`;
    // A little over the measure: the web font may still be loading, and its stand-in can be narrower.
    const width = drawing.measureText(text).width * 1.04;
    return width > 0 ? width : estimateTextWidth(text, fontSizePx);
  };
};

const LINE_HEIGHT = 1.12;
const MAX_LINES = 6;

/**
 * A circle's title set in whole words: the largest size from `maxFontPx` down to `minFontPx` at which the words
 * fit on lines no wider than the circle is at each line's height. Null when even the smallest size cannot hold a
 * word whole; the caller then lets the browser break it.
 */
export const fitPackedAtlasLabel = (
  name: string,
  diameter: number,
  {
    maxFontPx,
    minFontPx = 8,
    measure = estimateTextWidth,
  }: { maxFontPx: number; minFontPx?: number; measure?: MeasureText },
): { fontSizePx: number; lines: string[] } | null => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  // The title keeps clear of the circle's rim, and inside the box the circle gives its label.
  const radius = (Math.max(0, Number(diameter) || 0) / 2) * 0.9;
  const widest = Math.max(0, Number(diameter) || 0) * 0.82;
  if (!words.length || !(radius > 0)) return null;
  for (let fontSizePx = Math.max(maxFontPx, minFontPx); fontSizePx >= minFontPx - 0.001; fontSizePx -= 0.5) {
    const lineHeight = fontSizePx * LINE_HEIGHT;
    for (let count = 1; count <= Math.min(words.length, MAX_LINES); count += 1) {
      const height = count * lineHeight;
      if (height > radius * 2) break;
      const lines: string[] = [];
      let next = 0;
      for (let index = 0; index < count && next < words.length; index += 1) {
        // A line is as wide as the circle where the line's far edge (from the centre) crosses it.
        const lineTop = -height / 2 + index * lineHeight;
        const far = Math.max(Math.abs(lineTop), Math.abs(lineTop + lineHeight));
        const room = far >= radius ? 0 : Math.min(widest, 2 * Math.sqrt(radius * radius - far * far));
        // Words still to place are shared out over the lines left, so the last line is never left with too many.
        const linesLeft = count - index;
        let line = '';
        while (next < words.length) {
          const candidate = line ? `${line} ${words[next]}` : words[next];
          if (measure(candidate, fontSizePx) > room) break;
          line = candidate;
          next += 1;
          if (linesLeft > 1 && words.length - next <= linesLeft - 1) break;
        }
        if (!line) break;
        lines.push(line);
      }
      if (next === words.length && lines.length === count) return { fontSizePx, lines };
    }
  }
  return null;
};
