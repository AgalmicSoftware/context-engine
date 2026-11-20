import { FIXED_MEDIA_LIGHT } from '../../utilities/ui/fixedMediaColors';

/**
 * A Centralized session keeps its header picture in its config, which every participant reads on every page
 * load, so a chosen picture is shrunk in the browser and kept as a data: URL of at most HEADER_INLINE_MAX_BYTES.
 */
export const HEADER_INLINE_MAX_BYTES = 100_000;
const SIDES = [1200, 900, 600];
const QUALITIES = [0.82, 0.65, 0.5, 0.38];

export const HEADER_INLINE_TOO_LARGE_MESSAGE =
  "This picture can't be made small enough to keep with the session. Try a simpler picture, or use an image link.";
export const HEADER_INLINE_UNREADABLE_MESSAGE = "This picture couldn't be read. Try another, or use an image link.";

type Decoded = {
  width: number;
  height: number;
  draw: (width: number, height: number) => HTMLCanvasElement;
  /** Frees the decoded pixels. */
  close?: () => void;
};

export type InlineImageDeps = {
  decode: (file: Blob) => Promise<Decoded>;
  encode: (canvas: HTMLCanvasElement, quality: number) => Promise<Blob | null>;
  toDataUrl: (blob: Blob) => Promise<string>;
};

const browserDeps: InlineImageDeps = {
  decode: async (file) => {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (width, height) => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
        return canvas;
      },
      close: () => bitmap.close(),
    };
  },
  // WebP keeps transparency and is small. A browser that can't write it hands back another type, and JPEG is
  // used instead, over white, since JPEG has no transparency.
  encode: (canvas, quality) =>
    new Promise((resolve) => {
      canvas.toBlob(
        (webp) => {
          if (webp?.type === 'image/webp') {
            resolve(webp);
            return;
          }
          const flat = document.createElement('canvas');
          flat.width = canvas.width;
          flat.height = canvas.height;
          const context = flat.getContext('2d');
          if (context) {
            context.fillStyle = FIXED_MEDIA_LIGHT;
            context.fillRect(0, 0, flat.width, flat.height);
            context.drawImage(canvas, 0, 0);
          }
          flat.toBlob(resolve, 'image/jpeg', quality);
        },
        'image/webp',
        quality,
      );
    }),
  toDataUrl: (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    }),
};

/** The picture as a data: URL within the cap, trying smaller sizes and lower quality in turn; throws a plain message. */
export const shrinkHeaderImageToDataUrl = async (file: Blob, deps: InlineImageDeps = browserDeps): Promise<string> => {
  let image: Decoded;
  try {
    image = await deps.decode(file);
  } catch {
    throw new Error(HEADER_INLINE_UNREADABLE_MESSAGE);
  }
  try {
    if (!image.width || !image.height) throw new Error(HEADER_INLINE_UNREADABLE_MESSAGE);
    for (const side of SIDES) {
      const scale = Math.min(1, side / Math.max(image.width, image.height));
      const canvas = image.draw(
        Math.max(1, Math.round(image.width * scale)),
        Math.max(1, Math.round(image.height * scale)),
      );
      for (const quality of QUALITIES) {
        const blob = await deps.encode(canvas, quality);
        if (blob && blob.size <= HEADER_INLINE_MAX_BYTES) return await deps.toDataUrl(blob);
      }
    }
    throw new Error(HEADER_INLINE_TOO_LARGE_MESSAGE);
  } finally {
    image.close?.();
  }
};
