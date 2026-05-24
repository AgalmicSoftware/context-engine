import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResultsImage } from './resultImage.mjs';

function readU32(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}

function decodeStoredPng(image) {
  const bytes = image.bytes;
  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];
  while (offset < bytes.length) {
    const length = readU32(bytes, offset);
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    const data = bytes.slice(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = readU32(data, 0);
      height = readU32(data, 4);
    }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }
  const zlib = new Uint8Array(idat.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of idat) {
    zlib.set(part, cursor);
    cursor += part.length;
  }
  const rawParts = [];
  let z = 2;
  while (z < zlib.length - 4) {
    const len = zlib[z + 1] | (zlib[z + 2] << 8);
    rawParts.push(zlib.slice(z + 5, z + 5 + len));
    z += 5 + len;
  }
  const scanlines = new Uint8Array(rawParts.reduce((sum, part) => sum + part.length, 0));
  cursor = 0;
  for (const part of rawParts) {
    scanlines.set(part, cursor);
    cursor += part.length;
  }
  const pixels = new Uint8Array(width * height * 4);
  const stride = width * 4;
  for (let y = 0; y < height; y += 1) {
    const src = y * (stride + 1);
    assert.equal(scanlines[src], 0);
    pixels.set(scanlines.slice(src + 1, src + 1 + stride), y * stride);
  }
  return { width, height, pixels };
}

function pixelAt(decoded, x, y) {
  const offset = ((y * decoded.width) + x) * 4;
  return Array.from(decoded.pixels.slice(offset, offset + 4));
}

test('consensus result image uses white A1 layout with response distribution bars', () => {
  const image = buildResultsImage({
    mode: 'consensus',
    sessionTitle: 'telegram-demo-2',
    responseCount: 5,
    demo: true,
    beeswarmRows: [
      {
        label: 'Q1',
        prompt: 'Arriving 10 minutes early is better than arriving exactly on time.',
        answers: ['Agree', 'Agree', 'Agree', 'Unsure', 'Disagree'],
      },
    ],
  });
  const decoded = decodeStoredPng(image);

  assert.deepEqual(pixelAt(decoded, 4, 4), [247, 249, 252, 255]);
  assert.deepEqual(pixelAt(decoded, 24, 24), [255, 255, 255, 255]);
  assert.deepEqual(pixelAt(decoded, 420, 244), [18, 181, 105, 255]);
  assert.deepEqual(pixelAt(decoded, 790, 244), [245, 181, 0, 255]);
  assert.deepEqual(pixelAt(decoded, 950, 244), [255, 68, 61, 255]);
});

test('participant result image draws connected group outlines below a white header', () => {
  const image = buildResultsImage({
    mode: 'group',
    sessionTitle: 'telegram-demo-2',
    responseCount: 5,
    participants: [
      { participant: 'P1', answers: [{ question: 'Q1', label: 'Agree' }, { question: 'Q2', label: 'Agree' }] },
      { participant: 'P2', answers: [{ question: 'Q1', label: 'Agree' }, { question: 'Q2', label: 'Unsure' }] },
      { participant: 'P3', answers: [{ question: 'Q1', label: 'Disagree' }, { question: 'Q2', label: 'Disagree' }] },
      { participant: 'P4', answers: [{ question: 'Q1', label: 'Disagree' }, { question: 'Q2', label: 'Unsure' }] },
    ],
    groups: [
      { label: 'Group 1', aliases: ['P1', 'P2'], theme: 'higher agreement' },
      { label: 'Group 2', aliases: ['P3', 'P4'], theme: 'higher disagreement' },
    ],
  });
  const decoded = decodeStoredPng(image);

  assert.deepEqual(pixelAt(decoded, 24, 24), [255, 255, 255, 255]);
  assert.deepEqual(pixelAt(decoded, 513, 246), [31, 119, 214, 255]);
  assert.deepEqual(pixelAt(decoded, 85, 598), [31, 119, 214, 255]);
  assert.deepEqual(pixelAt(decoded, 539, 598), [255, 159, 28, 255]);
});
