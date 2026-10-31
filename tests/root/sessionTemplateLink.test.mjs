import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_TEMPLATE_FORMAT, SESSION_TEMPLATE_MAX_BYTES, validateSessionTemplate } from '../../shared/sessionTemplate.mjs';
import {
  SESSION_TEMPLATE_LINK_MAX_LENGTH,
  decodeSessionTemplateLink,
  encodeSessionTemplateLink,
  hasSessionTemplateLink,
} from '../../shared/sessionTemplateLink.mjs';

const format = SESSION_TEMPLATE_FORMAT;
const template = (fields = {}) => {
  const result = validateSessionTemplate({ format, ...fields });
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  return result.template;
};
const deflate = async (bytes) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
const linkFor = async (text) => `#template=${Buffer.from(await deflate(new TextEncoder().encode(text))).toString('base64url')}`;
const failure = async (hash) => {
  const result = await decodeSessionTemplateLink(hash);
  assert.equal(result?.ok, false, hash.slice(0, 60));
  return result.errors;
};
// Seeded noise that compresses poorly, standing in for a very long setup.
const noise = (length) => {
  let state = 3;
  return Array.from({ length }, () => {
    state = (state * 48271) % 2147483647;
    return 'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ'[state % 53];
  }).join('');
};

test('a template survives a link round trip in the URL fragment', async () => {
  const original = template({
    draftId: 'draft-1',
    sessionName: 'Salon <script>alert("x")</script> & friends',
    sessionInfo: 'Line one\nLine two – with ünïcödé and emoji 🌱',
    sessionContext: { title: 'Read first', paragraphs: ['A note'], links: [{ label: 'Essay', url: 'https://example.com/essay' }] },
    contextFiles: [{ name: 'deck.pdf' }],
  });
  const encoded = await encodeSessionTemplateLink(original);
  assert.equal(encoded.ok, true);
  assert.match(encoded.fragment, /^#template=[A-Za-z0-9_-]+$/);
  assert.deepEqual(await decodeSessionTemplateLink(encoded.fragment), { ok: true, template: original });
  assert.deepEqual(await decodeSessionTemplateLink(`#other=1&${encoded.fragment.slice(1)}`), { ok: true, template: original });
  assert.equal(await decodeSessionTemplateLink(''), null);
  assert.equal(await decodeSessionTemplateLink('#sessionId=abc'), null);
});

test('a template too long for a link asks for a .json download instead', async () => {
  const result = await encodeSessionTemplateLink(template({ sessionInfo: noise(12000) }));
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'too_long');
  assert.ok(result.length > SESSION_TEMPLATE_LINK_MAX_LENGTH, String(result.length));
});

test('an invalid or secret-bearing template never becomes a link', async () => {
  const result = await encodeSessionTemplateLink({ ...template(), sessionInfo: `key sk-proj-${'a1B2'.repeat(8)}` });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'invalid');
  assert.deepEqual(result.errors.map((error) => error.path), ['sessionInfo']);
  assert.equal((await encodeSessionTemplateLink({ format, colour: 'red' })).reason, 'invalid');
});

test('damaged links are refused with a reason', async () => {
  for (const hash of ['#template=abc$def', '#template=%%%', '#template=abc=d']) {
    assert.match((await failure(hash))[0].message, /base64url/, hash);
  }
  assert.match((await failure('#template='))[0].message, /no data/);
  assert.match((await failure('#template=a'))[0].message, /cut off/);
  const bad = Buffer.from([0xff, 0xff, 0xff, 0xff]).toString('base64url');
  assert.match((await failure(`#template=${bad}`))[0].message, /unpacked/);
  const packed = await deflate(new TextEncoder().encode(JSON.stringify(template({ sessionInfo: noise(2000) }))));
  const truncated = Buffer.from(packed.subarray(0, packed.length - 20)).toString('base64url');
  assert.match((await failure(`#template=${truncated}`))[0].message, /unpacked/);
  const notUtf8 = Buffer.from(await deflate(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]))).toString('base64url');
  assert.match((await failure(`#template=${notUtf8}`))[0].message, /UTF-8/);
  assert.match((await failure(await linkFor('not json')))[0].message, /JSON/);
  assert.match((await failure(await linkFor(`{"format":"${format}","sessionName":"Cut`)))[0].message, /cut off/);
  assert.match((await failure(await linkFor('[1, 2]')))[0].message, /JSON object/);
});

// What an AI writes: base64url of the template's UTF-8 JSON, no deflate.
const setupLink = (value) => `#setup=${Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url')}`;

test('#setup= links carry plain base64url JSON, the form an AI can write', async () => {
  const written = {
    format,
    sessionName: 'Neighbourhood budget – ünïcödé 🌱',
    questions: [{ prompt: 'Parks need more shade.', type: 'binary' }],
  };
  const expected = template(written);
  const hash = setupLink(written);
  assert.equal(hasSessionTemplateLink(hash), true);
  assert.equal(hasSessionTemplateLink(`#other=1&${hash.slice(1)}`), true);
  assert.equal(hasSessionTemplateLink('#sessionId=abc'), false);
  assert.deepEqual(await decodeSessionTemplateLink(hash), { ok: true, template: expected });
  // Chat apps wrap long links, and some encoders pad.
  const value = hash.slice('#setup='.length);
  const padded = `${value}${'='.repeat((4 - (value.length % 4)) % 4)}`;
  for (const variant of [`#setup=${value.slice(0, 40)}%20%0A${value.slice(40)}`, `#setup=${value.slice(0, 40)}+${value.slice(40)}`, `#setup=${padded}`]) {
    assert.deepEqual(await decodeSessionTemplateLink(variant), { ok: true, template: expected }, variant.slice(0, 60));
  }
  // A share link wins when a fragment somehow carries both.
  const shared = await encodeSessionTemplateLink(template({ sessionName: 'Shared' }));
  assert.equal((await decodeSessionTemplateLink(`${shared.fragment}&${hash.slice(1)}`)).template.sessionName, 'Shared');
});

test('broken #setup= links get clear errors, and invalid fields are named', async () => {
  const hash = setupLink({ format, sessionName: 'Cut short', sessionInfo: noise(400) });
  for (const end of [hash.length - 1, hash.length - 2, hash.length - 3, Math.floor(hash.length / 2), 12]) {
    assert.match((await failure(hash.slice(0, end)))[0].message, /cut off/, `cut at ${end}`);
  }
  assert.match((await failure('#setup='))[0].message, /no data/);
  assert.match((await failure('#setup=eyJ$'))[0].message, /base64url/);
  assert.match((await failure(`#setup=${Buffer.from([0x7b, 0xff, 0x7d]).toString('base64url')}`))[0].message, /UTF-8/);
  assert.match((await failure(setupLink('{"format":1}}')))[0].message, /not valid JSON/);
  const errors = await failure(
    setupLink({ format, sessionNmae: 'Typo', questions: [{ prompt: 'Pick one', type: 'multichoice', options: ['Only'] }] }),
  );
  assert.deepEqual(errors.map((entry) => entry.path), ['sessionNmae', 'questions.0.options']);
  assert.deepEqual((await failure(setupLink({ format, sessionInfo: `my key sk-proj-${'a1B2'.repeat(8)}` }))).map((entry) => entry.path), ['sessionInfo']);
  assert.deepEqual((await failure(setupLink(`{"format":"${format}","__proto__":{"polluted":true}}`))).map((entry) => entry.path), ['__proto__']);
  assert.equal({}.polluted, undefined);
});

test('#setup= links stop at the template size cap', async () => {
  const largest = setupLink({ format, sessionInfo: noise(SESSION_TEMPLATE_MAX_BYTES - 4000) });
  assert.equal((await decodeSessionTemplateLink(largest)).ok, true);
  const huge = setupLink({ format, sessionInfo: noise(SESSION_TEMPLATE_MAX_BYTES) });
  assert.match((await failure(huge))[0].message, /longer than/);
});

test('links that unpack past the size cap are refused without unpacking them whole', async () => {
  const bomb = await linkFor(`{"format":"${format}","sessionInfo":"${'0'.repeat(4 * SESSION_TEMPLATE_MAX_BYTES)}"}`);
  assert.ok(bomb.length < SESSION_TEMPLATE_LINK_MAX_LENGTH, String(bomb.length));
  assert.match((await failure(bomb))[0].message, /larger/);
  // No share link is longer than the encoder's limit, so nothing longer is unpacked.
  assert.match((await failure(`#template=${'A'.repeat(SESSION_TEMPLATE_LINK_MAX_LENGTH + 1)}`))[0].message, /longer/);
});

test('decoding feeds the decompressor small slices, which bounds memory in any browser', async () => {
  const Native = globalThis.DecompressionStream;
  const slices = [];
  globalThis.DecompressionStream = function SpyDecompressionStream(kind) {
    const native = new Native(kind);
    const spy = new TransformStream({
      transform(chunk, controller) {
        slices.push(chunk.byteLength);
        controller.enqueue(chunk);
      },
    });
    spy.readable.pipeTo(native.writable).catch(() => {});
    return { writable: spy.writable, readable: native.readable };
  };
  try {
    const original = template({ sessionInfo: noise(6000) });
    const encoded = await encodeSessionTemplateLink(original);
    assert.equal(encoded.ok, true);
    assert.deepEqual(await decodeSessionTemplateLink(encoded.fragment), { ok: true, template: original });
  } finally {
    globalThis.DecompressionStream = Native;
  }
  assert.ok(slices.length > 1, String(slices));
  assert.ok(Math.max(...slices) <= 1024, String(slices));
});

test('prototype keys are refused and script text stays text', async () => {
  for (const [json, path] of [
    [`{"format":"${format}","__proto__":{"polluted":true}}`, '__proto__'],
    [`{"format":"${format}","ai":{"constructor":{"prototype":{"polluted":true}}}}`, 'ai.constructor'],
    [`{"format":"${format}","sessionContext":{"links":[{"prototype":{}}]}}`, 'sessionContext.links.0.prototype'],
  ]) {
    assert.deepEqual((await failure(await linkFor(json))).map((error) => error.path), [path]);
  }
  assert.equal({}.polluted, undefined);
  const script = '<img src=x onerror="alert(document.cookie)"><script>fetch("//evil")</script>';
  const decoded = await decodeSessionTemplateLink(await linkFor(JSON.stringify({ format, sessionName: script })));
  assert.equal(decoded.ok, true);
  assert.equal(decoded.template.sessionName, script);
});
