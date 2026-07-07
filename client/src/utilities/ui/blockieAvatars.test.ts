import { generateBlockieDataUrl, hashSeed, hslToRgb, mulberry32 } from './blockieAvatars.js';

describe('blockieAvatars', () => {
  it('hashSeed preserves deterministic string and falsy seed normalization', () => {
    expect(hashSeed('context')).toBe(2357661820);
    expect(hashSeed(null)).toBe(hashSeed(''));
    expect(hashSeed(0)).toBe(hashSeed(''));
  });

  it('keeps the PRNG and HSL conversion deterministic', () => {
    const rand = mulberry32(hashSeed('context'));

    expect(rand()).toBeCloseTo(0.5816554201301187, 12);
    expect(hslToRgb(120, 0.6, 0.5)).toEqual([51, 204, 51]);
  });

  it('generates a canvas data URL from unknown seed inputs', () => {
    const originalCreateElement = document.createElement.bind(document);
    const context = {
      fillStyle: '',
      fillRect: jest.fn(),
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: jest.fn(() => context),
      toDataURL: jest.fn(() => 'data:image/png;base64,mock-blockie'),
    };
    const createElementSpy = jest.spyOn(document, 'createElement');

    createElementSpy.mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      if (tagName === 'canvas') return canvas as unknown as HTMLCanvasElement;
      return originalCreateElement(tagName, options);
    }) as typeof document.createElement);

    try {
      expect(generateBlockieDataUrl({ toString: () => 'Seed Value' }, 2, 3)).toBe('data:image/png;base64,mock-blockie');
      expect(canvas.width).toBe(6);
      expect(canvas.height).toBe(6);
      expect(context.fillRect).toHaveBeenCalledWith(0, 0, 6, 6);
      expect(canvas.toDataURL).toHaveBeenCalledWith('image/png');
    } finally {
      createElementSpy.mockRestore();
    }
  });
});
