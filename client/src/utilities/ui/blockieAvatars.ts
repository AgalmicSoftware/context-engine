/**
 * @file blockieAvatars.js
 * @module blockieAvatars
 * @description Deterministic blockie avatar generation — converts Ethereum addresses into
 *              unique colored grid avatars using FNV-1a hashing and HSL color derivation.
 *
 * Key exports: generateBlockieDataUrl, getBlockieDataUrl, hashSeed, hslToRgb
 */

import { hashSeed, mulberry32 } from '../survey/seededPrng.js';
import { FIXED_MEDIA_LIGHT } from './fixedMediaColors';

// Tiny PRNG used in existing code (mulberry32)
export function mulberry32(a: number): () => number {
  return function (): number {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// HSL → RGB (same math used previously)
export function hslToRgb(h: number, s: number, l: number): number[] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number): number => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
}

// Generate symmetric blockie as a data URL (8×8 grid by default)
// Browser-only guard: return '' when document is unavailable (e.g., SSR/tests)
export function generateBlockieDataUrl(seed: unknown, cells = 8, scale = 4): string {
  if (typeof document === 'undefined' || !document?.createElement) return '';

  const s = String(seed || '').toLowerCase();
  const prng = mulberry32(hashSeed(s));
  const hue = Math.floor(prng() * 360);
  const [r, g, b] = hslToRgb(hue, 0.6, 0.5);

  const size = cells * scale;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = FIXED_MEDIA_LIGHT;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = `rgb(${r},${g},${b})`;
  const half = Math.ceil(cells / 2);

  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < half; x++) {
      if (prng() > 0.5) {
        ctx.fillRect(x * scale, y * scale, scale, scale);
        const rx = cells - 1 - x; // mirror horizontally
        ctx.fillRect(rx * scale, y * scale, scale, scale);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

// Optional alias for convenience
export const getBlockieDataUrl = generateBlockieDataUrl;
