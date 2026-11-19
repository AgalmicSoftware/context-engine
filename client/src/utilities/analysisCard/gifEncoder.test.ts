import { encodeGif } from './gifEncoder';

type Decoded = { width: number; height: number; loops: boolean; frames: Array<{ delayCs: number; rgb: number[][] }> };

// An independent reader written from the GIF89a specification, enough to check what the writer produced.
const decodeGif = (file: Uint8Array): Decoded => {
  let at = 0;
  const byte = (): number => file[at++];
  const word = (): number => byte() | (byte() << 8);
  expect(String.fromCharCode(...file.slice(0, 6))).toBe('GIF89a');
  at = 6;
  const width = word();
  const height = word();
  const packed = byte();
  at += 2;
  expect(packed & 0x80).toBe(0x80);
  const palette = file.slice(at, at + 3 * (1 << ((packed & 7) + 1)));
  at += palette.length;
  const subBlocks = (): number[] => {
    const data: number[] = [];
    for (let size = byte(); size; size = byte()) {
      data.push(...file.slice(at, at + size));
      at += size;
    }
    return data;
  };
  const decoded: Decoded = { width, height, loops: false, frames: [] };
  let delayCs = 0;
  for (;;) {
    const marker = byte();
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = byte();
      if (label === 0xf9) {
        expect(byte()).toBe(4);
        byte();
        delayCs = word();
        at += 2;
      } else {
        const size = byte();
        const name = String.fromCharCode(...file.slice(at, at + size));
        at += size;
        const data = subBlocks();
        if (name === 'NETSCAPE2.0') decoded.loops = data[0] === 1 && data[1] === 0 && data[2] === 0;
      }
    } else {
      expect(marker).toBe(0x2c);
      at += 4;
      expect([word(), word()]).toEqual([width, height]);
      byte();
      const minSize = byte();
      const data = subBlocks();
      const clear = 1 << minSize;
      const end = clear + 1;
      let size = minSize + 1;
      let table: number[][] = [];
      const reset = (): void => {
        table = Array.from({ length: end + 1 }, (_, index) => (index < clear ? [index] : []));
        size = minSize + 1;
      };
      reset();
      let buffer = 0;
      let bits = 0;
      let cursor = 0;
      let previous: number[] | null = null;
      const indices: number[] = [];
      for (;;) {
        while (bits < size) {
          buffer |= data[cursor++] << bits;
          bits += 8;
        }
        const code = buffer & ((1 << size) - 1);
        buffer >>>= size;
        bits -= size;
        if (code === end) break;
        if (code === clear) {
          reset();
          previous = null;
        } else {
          const entry: number[] =
            code < table.length ? table[code] : [...(previous as number[]), (previous as number[])[0]];
          indices.push(...entry);
          if (previous && table.length < 4096) table.push([...previous, entry[0]]);
          if (table.length === 1 << size && size < 12) size += 1;
          previous = entry;
        }
      }
      expect(indices).toHaveLength(width * height);
      decoded.frames.push({ delayCs, rgb: indices.map((index) => [...palette.slice(index * 3, index * 3 + 3)]) });
    }
  }
  return decoded;
};

const frameOf = (colours: number[][]): Uint8ClampedArray =>
  Uint8ClampedArray.from(colours.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('encodeGif', () => {
  it('writes a looping file whose frames read back as the colours that went in', () => {
    const red = [200, 16, 16];
    const teal = [16, 120, 120];
    const white = [248, 248, 248];
    const first = [red, red, teal, white, white, teal];
    const second = [white, teal, teal, red, red, red];
    const decoded = decodeGif(
      encodeGif(3, 2, [
        { pixels: frameOf(first), delayMs: 2400 },
        { pixels: frameOf(second), delayMs: 60 },
      ]),
    );

    expect(decoded).toMatchObject({ width: 3, height: 2, loops: true });
    expect(decoded.frames.map((frame) => frame.delayCs)).toEqual([240, 6]);
    expect(decoded.frames[0].rgb).toEqual(first);
    expect(decoded.frames[1].rgb).toEqual(second);
  });

  it('survives a frame with more code words than the 12-bit table holds', () => {
    // Noise defeats the compression, so the table fills and must be cleared several times.
    const side = 160;
    let seed = 7;
    const noise = Array.from({ length: side * side }, () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const shade = (seed >> 8) & 0xf8;
      return [shade, 255 - shade, (shade * 3) & 0xf8];
    });
    const decoded = decodeGif(encodeGif(side, side, [{ pixels: frameOf(noise), delayMs: 100 }]));
    const error = decoded.frames[0].rgb.reduce(
      (worst, colour, index) => Math.max(worst, ...colour.map((value, which) => Math.abs(value - noise[index][which]))),
      0,
    );

    // 32 shades fit the palette, so every pixel comes back within a colour bin of itself.
    expect(error).toBeLessThan(8);
  });
});
