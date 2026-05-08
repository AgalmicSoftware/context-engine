import test from 'node:test';
import assert from 'node:assert/strict';

import { storageRoute } from './storageRouteExecution.js';

const TX_ID = 'abc123abc123abc123abc123abc123abc123abc1230';

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, 'Content-Type': 'application/json' },
});

const readJson = async (response) => JSON.parse(await response.text());

const createMockR2 = () => {
  const store = new Map();
  return {
    store,
    async put(key, value, opts = {}) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      store.set(key, {
        httpMetadata: opts.httpMetadata || {},
        customMetadata: opts.customMetadata || {},
        async arrayBuffer() {
          return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        },
        async text() {
          return new TextDecoder().decode(bytes);
        },
      });
    },
    async get(key) {
      return store.get(key) || null;
    },
  };
};

const createMockKv = () => {
  const store = new Map();
  return {
    store,
    async put(key, value) { store.set(key, value); },
    async get(key) { return store.get(key) || null; },
    async list({ prefix = '' } = {}) {
      return { keys: [...store.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({ name })) };
    },
  };
};

test('storageRoute delegates Arweave uploads and returns storageRef compatibility fields', async () => {
  const request = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ok: true }, contentType: 'application/json' }),
  });
  let uploadContext = null;

  const response = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request,
    config: { storageProfile: { backend: 'arweave' } },
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://app.example' },
    deps: {
      json,
      getSessionSecrets: async () => ({ arweaveJwk: '{}' }),
      arweaveUpload: async (value) => {
        uploadContext = value;
        return json({ id: TX_ID });
      },
    },
  });

  assert.equal(uploadContext.slug, 'session-a');
  assert.equal(uploadContext.uploaderAddress, '0xabc');
  const body = await readJson(response);
  assert.equal(body.id, TX_ID);
  assert.equal(body.arweaveTxId, TX_ID);
  assert.deepEqual(body.storageRef, { backend: 'arweave', id: TX_ID, uri: `ar://${TX_ID}` });
});

test('storageRoute returns lit-arweave storageRef for encrypted Arweave session storage', async () => {
  const request = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ok: true }, payloadEncrypted: true }),
  });

  const response = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request,
    config: { storageProfile: { backend: 'lit-arweave' } },
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      getSessionSecrets: async () => ({ arweaveJwk: '{}' }),
      arweaveUpload: async () => json({ id: TX_ID }),
    },
  });

  const body = await readJson(response);
  assert.deepEqual(body.storageRef, {
    backend: 'lit-arweave',
    id: TX_ID,
    uri: `lit-arweave://${TX_ID}`,
    encrypted: true,
  });
});

test('storageRoute stores Cloudflare payloads behind opaque refs and reads them back', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const uploadRequest = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: 'hello storage',
      contentType: 'text/plain',
      resource: 'docsContext',
      gate: 'docUploads',
      tags: [{ name: 'CE-SessionId', value: '0xabc' }],
    }),
  });

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: uploadRequest,
    env,
    config: { storageProfile: { backend: 'cloudflare' } },
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://app.example' },
    deps: {
      json,
      randomUUID: () => '01J7SAFEOPAQUEID',
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadBody.id, 'cf_01j7safeopaqueid');
  assert.deepEqual(uploadBody.storageRef, {
    backend: 'cloudflare',
    id: 'cf_01j7safeopaqueid',
    uri: '/storage/read?id=cf_01j7safeopaqueid',
    contentType: 'text/plain',
    gate: 'docUploads',
    resource: 'docsContext',
    createdAt: '2026-01-02T03:04:05.000Z',
  });
  assert.doesNotMatch(JSON.stringify(uploadBody), /account|bucket|token|secret|r2:\/\//i);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request('https://worker.example/storage/read?id=cf_01j7safeopaqueid'),
    env,
    config: { storageProfile: { backend: 'cloudflare' } },
    slug: 'session-a',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.headers.get('X-CE-Storage-Ref'), 'cf_01j7safeopaqueid');
  assert.equal(readResponse.headers.get('Content-Type'), 'text/plain');
  assert.equal(await readResponse.text(), 'hello storage');
});

test('storageRoute lists Cloudflare refs from the metadata index without raw object keys', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const uploadRequest = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: 'indexed', contentType: 'text/plain', resource: 'docsContext' }),
  });

  await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: uploadRequest,
    env,
    config: { storageProfile: { backend: 'cloudflare' } },
    slug: 'session-a',
    baseHeaders: {},
    deps: { json, randomUUID: () => '01J7LISTOPAQUEID', now: () => Date.parse('2026-01-02T03:04:05.000Z') },
  });

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=docsContext'),
    env,
    config: { storageProfile: { backend: 'cloudflare' } },
    slug: 'session-a',
    baseHeaders: {},
    deps: { json },
  });

  const body = await readJson(listResponse);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].storageRef.id, 'cf_01j7listopaqueid');
  assert.equal(body.items[0].storageRef.backend, 'cloudflare');
  assert.doesNotMatch(JSON.stringify(body), /sessions\/session-a\/storage|bucket|token|secret/i);
});
