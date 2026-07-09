import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeArweaveUploadJsonPayload,
  readArweaveUploadRequestPayload,
} from './arweaveUploadRequestNormalization.js';

const decoder = new TextDecoder();

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

test('normalizeArweaveUploadJsonPayload trims requestId and preserves JSON upload fields', () => {
  const normalized = normalizeArweaveUploadJsonPayload({
    data: { prompt: 'json-upload' },
    contentType: 'application/vnd.test+json',
    tags: '[{"name":"CE-Test","value":"ok"}]',
    requestId: ' req-1 ',
    arweaveJwk: ' {"kty":"RSA"} ',
  });

  assert.equal(normalized.ok, true);
  assert.equal(normalized.error, '');
  assert.equal(decoder.decode(normalized.payload.bytes), JSON.stringify({ prompt: 'json-upload' }));
  assert.equal(normalized.payload.contentType, 'application/vnd.test+json');
  assert.equal(normalized.payload.tagsInput, '[{"name":"CE-Test","value":"ok"}]');
  assert.equal(normalized.payload.requestId, 'req-1');
  assert.equal(normalized.payload.providedJwk, ' {"kty":"RSA"} ');
});

test('readArweaveUploadRequestPayload trims multipart requestId and normalizes multipart upload fields', async () => {
  const request = createMultipartRequest([
    ['data', new Blob(['multipart-upload'], { type: 'application/json' }), 'payload.json'],
    ['contentType', 'application/vnd.test+json'],
    ['tags', '[{"name":"CE-Test","value":"ok"}]'],
    ['requestId', ' req-2 '],
    ['arweaveJwk', ' {"kty":"RSA"} '],
  ]);

  const normalized = await readArweaveUploadRequestPayload(request);

  assert.equal(normalized.ok, true);
  assert.equal(normalized.error, '');
  assert.equal(decoder.decode(normalized.payload.bytes), 'multipart-upload');
  assert.equal(normalized.payload.contentType, 'application/vnd.test+json');
  assert.equal(normalized.payload.tagsInput, '[{"name":"CE-Test","value":"ok"}]');
  assert.equal(normalized.payload.requestId, 'req-2');
  assert.equal(normalized.payload.providedJwk, '{"kty":"RSA"}');
});

test('readArweaveUploadRequestPayload keeps JSON and multipart canonical payload fields aligned', async () => {
  const jsonRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: 'same-payload',
      contentType: 'text/plain',
      tags: '[{"name":"CE-Test","value":"ok"}]',
      requestId: ' req-3 ',
      arweaveJwk: '{"kty":"RSA"}',
    }),
  });
  const multipartRequest = createMultipartRequest([
    ['data', new Blob(['same-payload'], { type: 'text/plain' }), 'payload.txt'],
    ['contentType', 'text/plain'],
    ['tags', '[{"name":"CE-Test","value":"ok"}]'],
    ['requestId', ' req-3 '],
    ['arweaveJwk', '{"kty":"RSA"}'],
  ]);

  const [jsonPayload, multipartPayload] = await Promise.all([
    readArweaveUploadRequestPayload(jsonRequest),
    readArweaveUploadRequestPayload(multipartRequest),
  ]);

  assert.equal(jsonPayload.ok, true);
  assert.equal(multipartPayload.ok, true);
  assert.equal(decoder.decode(jsonPayload.payload.bytes), decoder.decode(multipartPayload.payload.bytes));
  assert.equal(jsonPayload.payload.contentType, multipartPayload.payload.contentType);
  assert.equal(jsonPayload.payload.tagsInput, multipartPayload.payload.tagsInput);
  assert.equal(jsonPayload.payload.requestId, multipartPayload.payload.requestId);
  assert.equal(jsonPayload.payload.providedJwk, multipartPayload.payload.providedJwk);
});

test('readArweaveUploadRequestPayload supports repeated reads from the same request via cloning', async () => {
  const request = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: 'repeatable',
      contentType: 'text/plain',
      requestId: ' req-4 ',
      arweaveJwk: '{"kty":"RSA"}',
    }),
  });

  const first = await readArweaveUploadRequestPayload(request);
  const second = await readArweaveUploadRequestPayload(request);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(decoder.decode(first.payload.bytes), 'repeatable');
  assert.equal(decoder.decode(second.payload.bytes), 'repeatable');
  assert.equal(first.payload.requestId, 'req-4');
  assert.equal(second.payload.requestId, 'req-4');
  assert.equal(first.payload.providedJwk, '{"kty":"RSA"}');
  assert.equal(second.payload.providedJwk, '{"kty":"RSA"}');
});

test('readArweaveUploadRequestPayload rejects oversized content-length before parsing', async () => {
  let parsed = false;
  const request = {
    headers: {
      get: (name) => (name.toLowerCase() === 'content-type'
        ? 'application/json'
        : name.toLowerCase() === 'content-length'
          ? '12'
          : ''),
    },
    json: async () => {
      parsed = true;
      return { data: 'oversized' };
    },
  };

  const result = await readArweaveUploadRequestPayload(request, { maxUploadBytes: 4 });

  assert.equal(parsed, false);
  assert.equal(result.ok, false);
  assert.equal(result.status, 413);
  assert.match(result.error, /Upload payload too large/);
});

test('readArweaveUploadRequestPayload rejects oversized JSON and multipart payload bytes', async () => {
  const jsonRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'too-large' }),
  });
  const multipartRequest = createMultipartRequest([
    ['data', new Blob(['too-large'], { type: 'text/plain' }), 'payload.txt'],
  ]);

  const [jsonPayload, multipartPayload] = await Promise.all([
    readArweaveUploadRequestPayload(jsonRequest, { maxUploadBytes: 4 }),
    readArweaveUploadRequestPayload(multipartRequest, { maxUploadBytes: 4 }),
  ]);

  assert.equal(jsonPayload.ok, false);
  assert.equal(jsonPayload.status, 413);
  assert.match(jsonPayload.error, /Upload payload too large/);
  assert.equal(multipartPayload.ok, false);
  assert.equal(multipartPayload.status, 413);
  assert.match(multipartPayload.error, /Upload payload too large/);
});

test('readArweaveUploadRequestPayload preserves parse and missing-data errors', async () => {
  const invalidJsonRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: '{"bad"',
  });
  const missingJsonDataRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ contentType: 'application/json' }),
  });
  const invalidMultipartRequest = {
    headers: {
      get: () => 'multipart/form-data; boundary=broken',
    },
    formData: async () => {
      throw new Error('broken');
    },
  };
  const missingMultipartFileRequest = {
    headers: {
      get: () => 'multipart/form-data; boundary=broken',
    },
    formData: async () => ({
      get: () => null,
      has: () => false,
    }),
  };
  const unsupportedRequest = new Request('https://worker.example/arweave/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: 'hello',
  });

  const [invalidJson, missingJsonData, invalidMultipart, missingMultipartFile, unsupported] = await Promise.all([
    readArweaveUploadRequestPayload(invalidJsonRequest),
    readArweaveUploadRequestPayload(missingJsonDataRequest),
    readArweaveUploadRequestPayload(invalidMultipartRequest),
    readArweaveUploadRequestPayload(missingMultipartFileRequest),
    readArweaveUploadRequestPayload(unsupportedRequest),
  ]);

  assert.deepEqual(invalidJson, {
    ok: false,
    error: 'Invalid JSON',
    payload: null,
  });
  assert.deepEqual(missingJsonData, {
    ok: false,
    error: 'Missing "data" in JSON body',
    payload: null,
  });
  assert.deepEqual(invalidMultipart, {
    ok: false,
    error: 'Expected multipart/form-data',
    payload: null,
  });
  assert.deepEqual(missingMultipartFile, {
    ok: false,
    error: 'Missing "file" or "data" field',
    payload: null,
  });
  assert.deepEqual(unsupported, {
    ok: false,
    error: 'Unsupported Content-Type',
    payload: null,
  });
});
