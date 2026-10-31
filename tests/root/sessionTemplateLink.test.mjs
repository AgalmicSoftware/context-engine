import test from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_TEMPLATE_FORMAT, SESSION_TEMPLATE_MAX_BYTES, validateSessionTemplate } from '../../shared/sessionTemplate.mjs';
import {
  SESSION_TEMPLATE_LINK_MAX_LENGTH,
  decodeSessionTemplateLink,
  encodeSessionTemplateLink,
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
  for (const hash of ['#template=', '#template=abc$def', '#template=a', '#template=%%%', '#template=abc=d']) {
    assert.match((await failure(hash))[0].message, /base64url/, hash);
  }
  const bad = Buffer.from([0xff, 0xff, 0xff, 0xff]).toString('base64url');
  assert.match((await failure(`#template=${bad}`))[0].message, /unpacked/);
  const packed = await deflate(new TextEncoder().encode(JSON.stringify(template({ sessionInfo: noise(2000) }))));
  const truncated = Buffer.from(packed.subarray(0, packed.length - 20)).toString('base64url');
  assert.match((await failure(`#template=${truncated}`))[0].message, /unpacked/);
  const notUtf8 = Buffer.from(await deflate(new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]))).toString('base64url');
  assert.match((await failure(`#template=${notUtf8}`))[0].message, /UTF-8/);
  assert.match((await failure(await linkFor('not json')))[0].message, /JSON/);
  assert.match((await failure(await linkFor('[1, 2]')))[0].message, /JSON object/);
});

test('links that unpack past the size cap are refused without unpacking them whole', async () => {
  const bomb = await linkFor(`{"format":"${format}","sessionInfo":"${'0'.repeat(4 * SESSION_TEMPLATE_MAX_BYTES)}"}`);
  assert.ok(bomb.length < SESSION_TEMPLATE_LINK_MAX_LENGTH, String(bomb.length));
  assert.match((await failure(bomb))[0].message, /larger/);
  assert.match((await failure(`#template=${'A'.repeat(4 * SESSION_TEMPLATE_MAX_BYTES)}`))[0].message, /larger/);
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
