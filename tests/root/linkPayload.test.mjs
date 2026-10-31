import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeLinkBytes,
  decodeLinkJson,
  decodeLinkText,
  encodeLinkJson,
  parseLinkJson,
  readLinkParam,
} from '../../shared/linkPayload.mjs';

const value = {
  name: 'Salon <b>night</b> & friends',
  note: 'ünïcödé, “quotes” and emoji 🌱',
  list: [1, { deep: true }],
};
const encoded = encodeLinkJson(value);
const error = (result) => {
  assert.equal(result.ok, false, JSON.stringify(result));
  return result.error;
};

test('a value round-trips as unpadded base64url of its UTF-8 JSON', () => {
  assert.match(encoded, /^[\w-]+$/);
  assert.equal(encoded, Buffer.from(JSON.stringify(value)).toString('base64url'));
  assert.deepEqual(decodeLinkJson(encoded), { ok: true, value });
});

test('whitespace and padding from chat apps and other encoders are tolerated', () => {
  const padded = `${encoded}${'='.repeat((4 - (encoded.length % 4)) % 4)}`;
  const wrapped = `${encoded.slice(0, 20)}\n  ${encoded.slice(20, 41)}\t${encoded.slice(41)}`;
  for (const text of [padded, `${encoded}==`, wrapped, ` ${encoded} `]) {
    assert.deepEqual(decodeLinkJson(text), { ok: true, value }, text.slice(0, 30));
  }
  // A browser keeps a wrapped link's spaces as %20, and a re-serialized fragment as "+".
  for (const hash of [`#setup=${encoded.slice(0, 30)}%20${encoded.slice(30)}`, `#setup=${encoded.slice(0, 30)}+${encoded.slice(30)}`]) {
    assert.deepEqual(decodeLinkJson(readLinkParam(hash, 'setup')), { ok: true, value });
  }
});

test('a link cut off at any point says so', () => {
  for (let end = 1; end < encoded.length; end += 1) {
    assert.match(error(decodeLinkJson(encoded.slice(0, end))), /cut off/, `cut at ${end}`);
  }
  // A character split by the cut, at the byte level.
  const bytes = new TextEncoder().encode('{"a":"🌱"}');
  assert.match(error(decodeLinkText(Buffer.from(bytes.subarray(0, 8)).toString('base64url'))), /cut off/);
});

test('damage is reported, never decoded into something else', () => {
  assert.match(error(decodeLinkBytes('')), /no data/);
  assert.match(error(decodeLinkBytes('abc$def')), /base64url/);
  assert.match(error(decodeLinkBytes('ab=cd')), /base64url/);
  assert.match(error(decodeLinkBytes('a'.repeat(8001), { maxLength: 8000 })), /longer than 8,000 characters/);
  // A fatal decoder: invalid UTF-8 is never replaced with U+FFFD.
  const notUtf8 = Buffer.from([0x7b, 0x22, 0x61, 0x22, 0x3a, 0xff, 0x7d]).toString('base64url');
  assert.match(error(decodeLinkText(notUtf8)), /not UTF-8/);
  assert.match(error(parseLinkJson('{"a":1}}')), /not valid JSON/);
  assert.match(error(parseLinkJson('{"a":"x\\"}')), /cut off/);
  assert.match(error(parseLinkJson('not json')), /not valid JSON/);
});

test('outsized or padding-filled values are refused in linear time', () => {
  const timed = (value, options) => {
    const started = performance.now();
    const result = decodeLinkBytes(value, options);
    assert.ok(performance.now() - started < 1000, `${value.length} characters took too long`);
    return error(result);
  };
  // A long run of "=" before another character once made the padding pattern
  // quadratic: 80,000 took 2.5 s. The raw length is now checked before any
  // pattern, with room for a wrapped link's whitespace, and padding is at most two.
  assert.match(timed(`${'='.repeat(300_000)}A`, { maxLength: 100_000 }), /longer than 100,000 characters/);
  assert.match(timed(`${'='.repeat(150_000)}A`, { maxLength: 100_000 }), /longer than 100,000 characters/);
  assert.match(timed(`${'='.repeat(150_000)}A`), /base64url/);
  assert.match(timed(`${encoded}===`), /base64url/);
});

test('fragments are read by key, with percent-encoding undone', () => {
  assert.equal(readLinkParam('#a=1&setup=abc%3D%3D', 'setup'), 'abc==');
  assert.equal(readLinkParam('setup=abc', 'setup'), 'abc');
  assert.equal(readLinkParam('#a=1', 'setup'), null);
  assert.equal(readLinkParam(undefined, 'setup'), null);
});
