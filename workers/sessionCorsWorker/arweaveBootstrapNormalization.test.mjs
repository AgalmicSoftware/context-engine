import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeArweaveBootstrapUploadPayload,
  readArweaveBootstrapUploadPayload,
} from './arweaveBootstrapNormalization.js';

const createMultipartRequest = (entries = []) => {
  const form = new FormData();
  entries.forEach(([key, value, filename]) => {
    if (filename) {
      form.append(key, value, filename);
      return;
    }
    form.append(key, value);
  });
  return new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    body: form,
  });
};

test('normalizeArweaveBootstrapUploadPayload trims requestId and treats JSON string/object arweaveJwk as provided', () => {
  const withStringJwk = normalizeArweaveBootstrapUploadPayload({
    address: ' 0xabc ',
    message: 'hello\r\nworld',
    signature: ' 0xsig ',
    requestId: ' req-1 ',
    sessionSlug: ' alpha ',
    arweaveJwk: ' {"kty":"RSA"} ',
  });

  assert.equal(withStringJwk.ok, true);
  assert.equal(withStringJwk.hasProvidedArweaveJwk, true);
  assert.deepEqual(withStringJwk.body, {
    address: '0xabc',
    message: 'hello\nworld',
    signature: ' 0xsig ',
    requestId: 'req-1',
    sessionSlug: 'alpha',
    arweaveJwk: ' {"kty":"RSA"} ',
  });

  const withObjectJwk = normalizeArweaveBootstrapUploadPayload({
    requestId: ' req-2 ',
    groupSlug: ' beta ',
    arweaveJwk: { kty: 'RSA', n: 'abc', e: 'AQAB' },
  });

  assert.equal(withObjectJwk.ok, true);
  assert.equal(withObjectJwk.hasProvidedArweaveJwk, true);
  assert.equal(withObjectJwk.body.requestId, 'req-2');
  assert.equal(withObjectJwk.body.groupSlug, 'beta');
  assert.deepEqual(withObjectJwk.body.arweaveJwk, { kty: 'RSA', n: 'abc', e: 'AQAB' });
});

test('readArweaveBootstrapUploadPayload trims multipart requestId and treats multipart arweaveJwk payloads as provided', async () => {
  const request = createMultipartRequest([
    ['address', ' 0xabc '],
    ['message', 'hello\r\nworld'],
    ['signature', ' 0xsig '],
    ['requestId', ' req-3 '],
    ['groupSlug', ' alpha '],
    ['arweaveJwk', new Blob(['{"kty":"RSA"}'], { type: 'application/json' }), 'jwk.json'],
  ]);

  const normalized = await readArweaveBootstrapUploadPayload(request);

  assert.equal(normalized.ok, true);
  assert.equal(normalized.hasProvidedArweaveJwk, true);
  assert.equal(normalized.body.requestId, 'req-3');
  assert.equal(normalized.body.groupSlug, 'alpha');
  assert.equal(normalized.body.address, '0xabc');
  assert.equal(normalized.body.message, 'hello\nworld');
});

test('readArweaveBootstrapUploadPayload normalizes JSON and multipart bootstrap bodies to the same canonical fields', async () => {
  const jsonRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      address: ' 0xabc ',
      message: 'hello\r\nworld',
      signature: ' 0xsig ',
      requestId: ' req-4 ',
      sessionSlug: ' alpha ',
      arweaveJwk: ' {"kty":"RSA"} ',
      data: { prompt: 'bootstrap' },
    }),
  });
  const multipartRequest = createMultipartRequest([
    ['address', ' 0xabc '],
    ['message', 'hello\r\nworld'],
    ['signature', ' 0xsig '],
    ['requestId', ' req-4 '],
    ['sessionSlug', ' alpha '],
    ['arweaveJwk', ' {"kty":"RSA"} '],
    ['data', new Blob([JSON.stringify({ prompt: 'bootstrap' })], { type: 'application/json' }), 'payload.json'],
  ]);

  const [jsonPayload, multipartPayload] = await Promise.all([
    readArweaveBootstrapUploadPayload(jsonRequest),
    readArweaveBootstrapUploadPayload(multipartRequest),
  ]);

  assert.equal(jsonPayload.ok, true);
  assert.equal(multipartPayload.ok, true);
  assert.deepEqual(jsonPayload.body, multipartPayload.body);
  assert.equal(jsonPayload.hasProvidedArweaveJwk, true);
  assert.equal(multipartPayload.hasProvidedArweaveJwk, true);
});

test('readArweaveBootstrapUploadPayload preserves bootstrap parse errors for invalid JSON, invalid multipart, and unsupported content types', async () => {
  const invalidJsonRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{"bad"',
  });
  const invalidMultipartRequest = {
    headers: {
      get: () => 'multipart/form-data; boundary=broken',
    },
    clone: () => ({
      formData: async () => {
        throw new Error('broken');
      },
    }),
  };
  const unsupportedRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: 'hello',
  });

  const [invalidJson, invalidMultipart, unsupported] = await Promise.all([
    readArweaveBootstrapUploadPayload(invalidJsonRequest),
    readArweaveBootstrapUploadPayload(invalidMultipartRequest),
    readArweaveBootstrapUploadPayload(unsupportedRequest),
  ]);

  assert.deepEqual(invalidJson, {
    ok: false,
    error: 'Invalid JSON.',
    body: null,
    hasProvidedArweaveJwk: false,
  });
  assert.deepEqual(invalidMultipart, {
    ok: false,
    error: 'Expected multipart/form-data.',
    body: null,
    hasProvidedArweaveJwk: false,
  });
  assert.deepEqual(unsupported, {
    ok: false,
    error: 'Unsupported Content-Type.',
    body: null,
    hasProvidedArweaveJwk: false,
  });
});
