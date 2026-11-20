import {
  HEADER_INLINE_MAX_BYTES,
  HEADER_INLINE_TOO_LARGE_MESSAGE,
  HEADER_INLINE_UNREADABLE_MESSAGE,
  shrinkHeaderImageToDataUrl,
  type InlineImageDeps,
} from './sessionHeaderInlineImage';

const canvasOf = (width: number, height: number) => ({ width, height }) as HTMLCanvasElement;

// A picture whose encoded size is its area times a quality factor, so each step down can be checked.
const fakeDeps = (width: number, height: number, bytesPerPixel: number): InlineImageDeps & { drawn: number[][] } => {
  const drawn: number[][] = [];
  return {
    drawn,
    decode: async () => ({
      width,
      height,
      draw: (w, h) => {
        drawn.push([w, h]);
        return canvasOf(w, h);
      },
    }),
    encode: async (canvas, quality) =>
      ({ size: Math.round(canvas.width * canvas.height * bytesPerPixel * quality) }) as Blob,
    toDataUrl: async (blob) => `data:image/webp;base64,size-${blob.size}`,
  };
};

describe('shrinkHeaderImageToDataUrl', () => {
  it('fits the longest side to 1200 px and keeps the best quality under the cap', async () => {
    const deps = fakeDeps(4000, 2000, 0.1);
    const url = await shrinkHeaderImageToDataUrl(new Blob(), deps);
    expect(deps.drawn[0]).toEqual([1200, 600]);
    expect(url).toBe(`data:image/webp;base64,size-${Math.round(1200 * 600 * 0.1 * 0.82)}`);
  });

  it('never enlarges a small picture', async () => {
    const deps = fakeDeps(300, 200, 0.1);
    await shrinkHeaderImageToDataUrl(new Blob(), deps);
    expect(deps.drawn).toEqual([[300, 200]]);
  });

  it('steps down in quality, then in size, until it fits', async () => {
    const deps = fakeDeps(1200, 1200, 0.3);
    const url = await shrinkHeaderImageToDataUrl(new Blob(), deps);
    expect(deps.drawn).toEqual([
      [1200, 1200],
      [900, 900],
    ]);
    const size = Number(url.split('size-')[1]);
    expect(size).toBeLessThanOrEqual(HEADER_INLINE_MAX_BYTES);
  });

  it('refuses plainly a picture that will not fit, or cannot be read', async () => {
    await expect(shrinkHeaderImageToDataUrl(new Blob(), fakeDeps(1200, 1200, 10))).rejects.toThrow(
      HEADER_INLINE_TOO_LARGE_MESSAGE,
    );
    const unreadable = { ...fakeDeps(1, 1, 1), decode: async () => Promise.reject(new Error('bad')) };
    await expect(shrinkHeaderImageToDataUrl(new Blob(), unreadable)).rejects.toThrow(HEADER_INLINE_UNREADABLE_MESSAGE);
  });
});
