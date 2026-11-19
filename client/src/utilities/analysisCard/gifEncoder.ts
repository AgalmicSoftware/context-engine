// A small animated-GIF writer: one shared palette of up to 256 colours for all frames, chosen by median cut,
// and standard LZW compression. Enough for a short card animation; it does no dithering or frame differencing.

export type GifFrame = { pixels: Uint8ClampedArray | Uint8Array; delayMs: number };

const BINS = 32 * 32 * 32;
const bin = (r: number, g: number, b: number): number => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);

type Box = { bins: number[]; weight: number };

// Up to `size` colours covering the frames: 15-bit colour bins are split along their widest channel at the
// weighted median until there are enough boxes, and each box becomes its weighted mean colour.
const buildPalette = (frames: GifFrame[], size: number): { palette: Uint8Array; lookup: Uint8Array } => {
  const count = new Uint32Array(BINS);
  const sums = new Float64Array(BINS * 3);
  frames.forEach(({ pixels }) => {
    for (let at = 0; at < pixels.length; at += 4) {
      const index = bin(pixels[at], pixels[at + 1], pixels[at + 2]);
      count[index] += 1;
      sums[index * 3] += pixels[at];
      sums[index * 3 + 1] += pixels[at + 1];
      sums[index * 3 + 2] += pixels[at + 2];
    }
  });
  const used: number[] = [];
  for (let index = 0; index < BINS; index += 1) if (count[index]) used.push(index);
  const channel = (index: number, which: number): number => sums[index * 3 + which] / count[index];
  const weigh = (bins: number[]): number => bins.reduce((sum, index) => sum + count[index], 0);
  const boxes: Box[] = [{ bins: used, weight: weigh(used) }];
  while (boxes.length < size) {
    // Split the heaviest box that still holds more than one colour.
    const target = boxes.filter((box) => box.bins.length > 1).sort((a, b) => b.weight - a.weight)[0];
    if (!target) break;
    const spread = [0, 1, 2].map((which) => {
      let low = 255;
      let high = 0;
      target.bins.forEach((index) => {
        const value = channel(index, which);
        if (value < low) low = value;
        if (value > high) high = value;
      });
      return high - low;
    });
    const widest = spread.indexOf(Math.max(...spread));
    const sorted = target.bins.slice().sort((a, b) => channel(a, widest) - channel(b, widest));
    let running = 0;
    let cut = 0;
    while (cut < sorted.length - 1 && running + count[sorted[cut]] <= target.weight / 2) {
      running += count[sorted[cut]];
      cut += 1;
    }
    cut = Math.max(1, cut);
    const first = sorted.slice(0, cut);
    const second = sorted.slice(cut);
    boxes.splice(
      boxes.indexOf(target),
      1,
      { bins: first, weight: weigh(first) },
      { bins: second, weight: weigh(second) },
    );
  }
  const palette = new Uint8Array(size * 3);
  const lookup = new Uint8Array(BINS);
  boxes.forEach((box, colour) => {
    const total = [0, 0, 0];
    box.bins.forEach((index) => {
      lookup[index] = colour;
      total[0] += sums[index * 3];
      total[1] += sums[index * 3 + 1];
      total[2] += sums[index * 3 + 2];
    });
    if (box.weight) total.forEach((sum, which) => (palette[colour * 3 + which] = Math.round(sum / box.weight)));
  });
  return { palette, lookup };
};

// GIF's LZW: codes grow from 9 to 12 bits, packed low bit first into blocks of at most 255 bytes.
const writeLzw = (indices: Uint8Array, out: number[]): void => {
  const CLEAR = 256;
  const END = 257;
  let buffer = 0;
  let bits = 0;
  let block: number[] = [];
  const flushBlock = (): void => {
    if (!block.length) return;
    out.push(block.length, ...block);
    block = [];
  };
  let codeSize = 9;
  const emit = (code: number): void => {
    buffer |= code << bits;
    bits += codeSize;
    while (bits >= 8) {
      block.push(buffer & 255);
      if (block.length === 255) flushBlock();
      buffer >>>= 8;
      bits -= 8;
    }
  };
  let table = new Map<number, number>();
  let next = END + 1;
  out.push(8);
  emit(CLEAR);
  let prefix = indices[0];
  for (let at = 1; at < indices.length; at += 1) {
    const value = indices[at];
    const key = (prefix << 8) | value;
    const known = table.get(key);
    if (known !== undefined) {
      prefix = known;
    } else {
      emit(prefix);
      if (next === 4096) {
        emit(CLEAR);
        table = new Map();
        next = END + 1;
        codeSize = 9;
      } else {
        table.set(key, next);
        if (next === 1 << codeSize) codeSize += 1;
        next += 1;
      }
      prefix = value;
    }
  }
  emit(prefix);
  emit(END);
  if (bits) block.push(buffer & 255);
  flushBlock();
  out.push(0);
};

// Every frame is `width` × `height` RGBA pixels. The result is a complete, looping GIF89a file.
export const encodeGif = (width: number, height: number, frames: GifFrame[]): Uint8Array => {
  const { palette, lookup } = buildPalette(frames, 256);
  const word = (value: number): number[] => [value & 255, (value >> 8) & 255];
  const out: number[] = [];
  const chunks: Uint8Array[] = [];
  const flush = (): void => {
    chunks.push(Uint8Array.from(out));
    out.length = 0;
  };
  out.push(...[...'GIF89a'].map((char) => char.charCodeAt(0)), ...word(width), ...word(height), 0xf7, 0, 0);
  flush();
  chunks.push(palette);
  // Loop for ever.
  out.push(0x21, 0xff, 11, ...[...'NETSCAPE2.0'].map((char) => char.charCodeAt(0)), 3, 1, 0, 0, 0);
  frames.forEach(({ pixels, delayMs }) => {
    const indices = new Uint8Array(width * height);
    for (let at = 0; at < indices.length; at += 1) {
      indices[at] = lookup[bin(pixels[at * 4], pixels[at * 4 + 1], pixels[at * 4 + 2])];
    }
    out.push(0x21, 0xf9, 4, 0x04, ...word(Math.max(2, Math.round(delayMs / 10))), 0, 0);
    out.push(0x2c, ...word(0), ...word(0), ...word(width), ...word(height), 0);
    writeLzw(indices, out);
    flush();
  });
  chunks.push(Uint8Array.of(0x3b));
  const file = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  chunks.forEach((chunk) => {
    file.set(chunk, offset);
    offset += chunk.length;
  });
  return file;
};
