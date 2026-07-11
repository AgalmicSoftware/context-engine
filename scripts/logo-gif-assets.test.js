'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

function skipSubBlocks(buffer, startOffset) {
  let offset = startOffset;
  while (offset < buffer.length) {
    const blockSize = buffer[offset];
    offset += 1;
    if (blockSize === 0) return offset;
    offset += blockSize;
  }
  throw new Error('GIF sub-block data is truncated');
}

function readGifMetadata(relativePath) {
  const buffer = fs.readFileSync(path.join(REPO_ROOT, relativePath));
  assert.match(buffer.subarray(0, 6).toString('ascii'), /^GIF8[79]a$/);

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  const globalColorTableFlags = buffer[10];
  let offset = 13;
  if (globalColorTableFlags & 0x80) {
    offset += 3 * (2 ** ((globalColorTableFlags & 0x07) + 1));
  }

  let frameCount = 0;
  let durationCentiseconds = 0;
  let loopCount = null;
  while (offset < buffer.length) {
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0x3b) break;

    if (marker === 0x21) {
      const extensionLabel = buffer[offset];
      offset += 1;
      if (extensionLabel === 0xf9) {
        const blockSize = buffer[offset];
        offset += 1;
        assert.equal(blockSize, 4, `${relativePath} has an invalid graphic-control block`);
        durationCentiseconds += buffer.readUInt16LE(offset + 1);
        offset += blockSize;
        assert.equal(buffer[offset], 0, `${relativePath} has an unterminated graphic-control block`);
        offset += 1;
      } else if (extensionLabel === 0xff) {
        const blockSize = buffer[offset];
        offset += 1;
        const applicationName = buffer.subarray(offset, offset + blockSize).toString('ascii');
        offset += blockSize;
        if (
          applicationName === 'NETSCAPE2.0'
          && buffer[offset] === 3
          && buffer[offset + 1] === 1
        ) {
          loopCount = buffer.readUInt16LE(offset + 2);
        }
        offset = skipSubBlocks(buffer, offset);
      } else {
        offset = skipSubBlocks(buffer, offset);
      }
      continue;
    }

    assert.equal(marker, 0x2c, `${relativePath} has an unexpected GIF block marker`);
    frameCount += 1;
    const localColorTableFlags = buffer[offset + 8];
    offset += 9;
    if (localColorTableFlags & 0x80) {
      offset += 3 * (2 ** ((localColorTableFlags & 0x07) + 1));
    }
    offset += 1; // LZW minimum code size.
    offset = skipSubBlocks(buffer, offset);
  }

  return {
    bytes: buffer.length,
    durationCentiseconds,
    frameCount,
    height,
    loopsForever: loopCount === 0,
    width,
  };
}

test('logo GIFs keep the optimized dimensions, timing, looping, and size budgets', () => {
  const forward = readGifMetadata('client/src/assets/img/context_engine_logo_animation.gif');
  const pingpong = readGifMetadata('client/src/assets/img/context_engine_logo_animation_pingpong.gif');

  assert.deepEqual(
    { ...forward, bytes: undefined },
    {
      bytes: undefined,
      durationCentiseconds: 1287,
      frameCount: 206,
      height: 320,
      loopsForever: true,
      width: 320,
    },
  );
  assert.deepEqual(
    { ...pingpong, bytes: undefined },
    {
      bytes: undefined,
      durationCentiseconds: 2575,
      frameCount: 412,
      height: 320,
      loopsForever: true,
      width: 320,
    },
  );
  assert.ok(forward.bytes <= 2_600_000, `forward logo GIF regrew to ${forward.bytes} bytes`);
  assert.ok(pingpong.bytes <= 5_100_000, `ping-pong logo GIF regrew to ${pingpong.bytes} bytes`);
});

module.exports = { readGifMetadata };
