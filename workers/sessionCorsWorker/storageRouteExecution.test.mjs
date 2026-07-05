import test from 'node:test';
import assert from 'node:assert/strict';

import { storageRoute } from './storageRouteExecution.js';
import { rotateStorageEnvelopeKeys } from './storageEnvelopeEncryption.js';

const TX_ID = 'abc123abc123abc123abc123abc123abc123abc1230';
const CF_ID = 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA';
const CLOUDFLARE_WORKER_GATE_CONFIG = {
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: { mode: 'worker_sbt_gate' },
  },
  __registry: {
    gatesByResource: {
      docUploads: { sbtAddresses: [], chainId: 84532, mode: 0 },
      questionResponses: { sbtAddresses: [], chainId: 84532, mode: 0 },
      surveyResponses: { sbtAddresses: [], chainId: 84532, mode: 0 },
    },
  },
};

const fixedRandomBytes = () => Uint8Array.from({ length: 32 }, (_, index) => index + 1);
const fixedGetRandomValues = (target) => {
  target.set(fixedRandomBytes());
  return target;
};
const shortRandomBytes = () => Uint8Array.from({ length: 31 }, (_, index) => index + 1);
const createSequenceRandomBytes = (initial = 1) => {
  let seed = initial;
  return (length) => Uint8Array.from({ length }, () => {
    const value = seed % 251;
    seed += 1;
    return value;
  });
};
const createCryptoDecryptSpy = () => {
  const cryptoImpl = globalThis.crypto;
  let decryptCalls = 0;
  return {
    crypto: {
      getRandomValues: cryptoImpl.getRandomValues.bind(cryptoImpl),
      subtle: {
        digest: (...args) => cryptoImpl.subtle.digest(...args),
        importKey: (...args) => cryptoImpl.subtle.importKey(...args),
        encrypt: (...args) => cryptoImpl.subtle.encrypt(...args),
        decrypt: (...args) => {
          decryptCalls += 1;
          return cryptoImpl.subtle.decrypt(...args);
        },
      },
    },
    get decryptCalls() { return decryptCalls; },
  };
};

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

const readStorageIndexMetadata = async (kv, slug, resource, id) => JSON.parse(
  await kv.get(`ce-storage:${slug}:${resource}:${id}`)
);

const writeStorageIndexMetadata = async (kv, slug, resource, metadata) => {
  await kv.put(`ce-storage:${slug}:${resource}:${metadata.id}`, JSON.stringify(metadata));
  const payloadKey = `ce-storage-payload:${slug}:${metadata.id}`;
  const payloadEnvelope = JSON.parse(await kv.get(payloadKey));
  if (payloadEnvelope?.metadata) {
    payloadEnvelope.metadata = metadata;
    await kv.put(payloadKey, JSON.stringify(payloadEnvelope));
  }
};

const createEnvelopeConfig = (overrides = {}) => ({
  storageProfile: {
    backend: 'cloudflare',
    payloadAccessControl: {
      gate: 'none',
      encryption: 'worker_envelope',
      ...(overrides.payloadAccessControl || {}),
    },
  },
  adminAddress: '0x0000000000000000000000000000000000000abc',
  workerRoles: {
    reviewer: ['0x0000000000000000000000000000000000000def'],
  },
  ...overrides.config,
});

const uploadEnvelopePayload = async ({
  env,
  config,
  setConfig,
  data = 'classified payload',
  resource = 'docsContext',
  uploaderAddress = '0x0000000000000000000000000000000000000abc',
  deps = {},
} = {}) => {
  const response = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, contentType: 'text/plain', resource }),
    }),
    env,
    config,
    slug: 'session-a',
    uploaderAddress,
    baseHeaders: {},
    deps: {
      json,
      randomBytes: createSequenceRandomBytes(),
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
      putSessionConfig: async (_env, _slug, nextConfig) => setConfig(nextConfig),
      ...deps,
    },
  });
  return { response, body: await readJson(response) };
};

test('storageRoute delegates Arweave uploads and returns storageRef compatibility fields', async () => {
  const request = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ok: true }, contentType: 'application/json', resource: 'questions' }),
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
  assert.deepEqual(body.storageRef, {
    backend: 'arweave',
    id: TX_ID,
    uri: `ar://${TX_ID}`,
    contentType: 'application/json',
    resource: 'questions',
  });
});

test('storageRoute returns lit-arweave storageRef for encrypted Arweave session storage', async () => {
  const request = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: { ok: true }, payloadEncrypted: true, resource: 'responses' }),
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
    contentType: 'application/json',
    encrypted: true,
    resource: 'responses',
  });
});

for (const resource of ['questions', 'surveys', 'responses']) {
  test(`storageRoute stores and lists Cloudflare ${resource} payloads behind opaque refs`, async () => {
    const r2 = createMockR2();
    const kv = createMockKv();
    const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
    const uploadRequest = new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { resource, ok: true },
        contentType: 'application/json',
        resource,
        payloadEncrypted: resource === 'responses',
        tags: [{ name: 'CE-Resource', value: resource }],
      }),
    });

    const uploadResponse = await storageRoute({
      path: '/storage/upload',
      method: 'POST',
      request: uploadRequest,
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: {
        json,
        randomBytes: fixedRandomBytes,
        now: () => Date.parse('2026-01-02T03:04:05.000Z'),
      },
    });

    const uploadBody = await readJson(uploadResponse);
    assert.equal(uploadBody.storageRef.backend, 'cloudflare');
    assert.equal(uploadBody.storageRef.id.length, 43);
    assert.equal(uploadBody.storageRef.resource, resource);
    assert.equal(uploadBody.storageRef.encrypted === true, resource === 'responses');
    assert.equal(Object.hasOwn(uploadBody, 'arweaveTxId'), false);
    assert.doesNotMatch(JSON.stringify(uploadBody), /sessions\/session-a\/storage|account|bucket|token|secret|r2:\/\//i);

    const readResponse = await storageRoute({
      path: '/storage/read',
      method: 'GET',
      request: new Request(`https://worker.example/storage/read?id=${encodeURIComponent(uploadBody.storageRef.id)}`),
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: { json },
    });
    assert.equal(readResponse.headers.get('X-CE-Storage-Ref'), uploadBody.storageRef.id);
    assert.deepEqual(JSON.parse(await readResponse.text()), { resource, ok: true });

    const listResponse = await storageRoute({
      path: '/storage/list',
      method: 'GET',
      request: new Request(`https://worker.example/storage/list?resource=${resource}`),
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: { json },
    });

    const listed = await readJson(listResponse);
    assert.equal(listed.items.length, 1);
    assert.equal(listed.items[0].storageRef.id, uploadBody.storageRef.id);
    assert.equal(listed.items[0].storageRef.resource, resource);
    assert.doesNotMatch(JSON.stringify(listed), /sessions\/session-a\/storage|bucket|token|secret/i);
  });
}

for (const contentType of ['application/json; charset=utf-8', 'application/ld+json']) {
  test(`storageRoute serializes Cloudflare JSON object uploads for ${contentType}`, async () => {
    const r2 = createMockR2();
    const kv = createMockKv();
    const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
    const uploadResponse = await storageRoute({
      path: '/storage/upload',
      method: 'POST',
      request: new Request('https://worker.example/storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { title: 'JSON payload', count: 1 },
          contentType,
          resource: 'questions',
        }),
      }),
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: {
        json,
        randomBytes: fixedRandomBytes,
        now: () => Date.parse('2026-01-02T03:04:05.000Z'),
      },
    });

    const uploadBody = await readJson(uploadResponse);
    assert.equal(uploadResponse.status, 200);
    assert.equal(uploadBody.storageRef.contentType, contentType);

    const readResponse = await storageRoute({
      path: '/storage/read',
      method: 'GET',
      request: new Request(`https://worker.example/storage/read?id=${encodeURIComponent(uploadBody.storageRef.id)}`),
      env,
      config: CLOUDFLARE_WORKER_GATE_CONFIG,
      slug: 'session-a',
      uploaderAddress: '0xabc',
      baseHeaders: {},
      deps: { json },
    });

    assert.equal(readResponse.status, 200);
    assert.equal(await readResponse.text(), '{"title":"JSON payload","count":1}');
  });
}

test('storageRoute can use KV-only Cloudflare payload storage when R2 is unavailable', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Question from KV storage?', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 200);
  assert.equal(uploadBody.storageRef.backend, 'cloudflare');
  assert.equal(uploadBody.storageRef.id, CF_ID);
  assert.equal(uploadBody.storageRef.resource, 'questions');
  assert.doesNotMatch(JSON.stringify(uploadBody), /ce-storage-payload|sessions\/session-a\/storage|bucket|token|secret/i);
  assert.equal(kv.store.has(`ce-storage-payload:session-a:${CF_ID}`), true);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${CF_ID}`),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('X-CE-Storage-Backend'), 'cloudflare');
  assert.deepEqual(JSON.parse(await readResponse.text()), { prompt: 'Question from KV storage?', ok: true });

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].storageRef.id, CF_ID);
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'worker_sbt_gate');
  assert.doesNotMatch(JSON.stringify(listed), /ce-storage-payload|bucket|token|secret/i);
});

test('storageRoute accepts deploy-helper KV alias bindings for Cloudflare payload storage', async () => {
  const kv = createMockKv();
  const env = { GROUP_KV: kv, CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Aliased KV storage works', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  assert.equal(uploadResponse.status, 200);
  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadBody.storageRef.backend, 'cloudflare');
  assert.equal(kv.store.has(`ce-storage-payload:session-a:${uploadBody.storageRef.id}`), true);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  assert.equal(readResponse.status, 200);
  assert.deepEqual(JSON.parse(await readResponse.text()), { prompt: 'Aliased KV storage works', ok: true });
});

test('storageRoute uses Web Crypto getRandomValues for Cloudflare storage refs when randomBytes is absent', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Question from Web Crypto entropy?', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      getRandomValues: fixedGetRandomValues,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 200);
  assert.equal(uploadBody.storageRef.backend, 'cloudflare');
  assert.equal(uploadBody.storageRef.id, CF_ID);
  assert.equal(kv.store.has(`ce-storage-payload:session-a:${CF_ID}`), true);
});

test('storageRoute fails closed when Cloudflare storage ref entropy is unavailable', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Question without entropy?', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      getRandomValues: null,
    },
  });

  const body = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 500);
  assert.match(body.error, /Secure randomness is required/);
  assert.equal(r2.store.size, 0);
  assert.equal(kv.store.size, 0);
});

test('storageRoute rejects short injected Cloudflare storage ref entropy without Web Crypto fallback', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Question with short entropy?', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: shortRandomBytes,
      getRandomValues: null,
    },
  });

  const body = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 500);
  assert.match(body.error, /Secure randomness is required/);
  assert.equal(r2.store.size, 0);
  assert.equal(kv.store.size, 0);
});

test('storageRoute reads Cloudflare list resource from POST JSON body', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Question body resource', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'POST',
    request: new Request('https://worker.example/storage/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'questions' }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  const listed = await readJson(listResponse);
  assert.equal(listResponse.status, 200);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].storageRef.id, uploadBody.storageRef.id);
  assert.equal(listed.items[0].storageRef.resource, 'questions');
});

test('storageRoute gives Cloudflare list query resource precedence over POST body', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Question query resource', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'POST',
    request: new Request('https://worker.example/storage/list?resource=questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resource: 'docsContext' }),
    }),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  const listed = await readJson(listResponse);
  assert.equal(listResponse.status, 200);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].storageRef.id, uploadBody.storageRef.id);
  assert.equal(listed.items[0].storageRef.resource, 'questions');
});

test('storageRoute rejects invalid Cloudflare list POST JSON body', async () => {
  const response = await storageRoute({
    path: '/storage/list',
    method: 'POST',
    request: new Request('https://worker.example/storage/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }),
    env: { CE_STORAGE_INDEX_KV: createMockKv() },
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  assert.equal(response.status, 400);
  assert.equal((await readJson(response)).error, 'Invalid JSON.');
});

test('storageRoute reads legacy KV payloads after an R2 binding is added', async () => {
  const kv = createMockKv();
  const uploadEnv = { CE_STORAGE_INDEX_KV: kv };
  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { prompt: 'Still in KV after R2 attach', ok: true },
        contentType: 'application/json',
        resource: 'questions',
      }),
    }),
    env: uploadEnv,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env: { CE_STORAGE_R2: createMockR2(), CE_STORAGE_INDEX_KV: kv },
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  assert.equal(readResponse.status, 200);
  assert.deepEqual(JSON.parse(await readResponse.text()), { prompt: 'Still in KV after R2 attach', ok: true });
});

test('storageRoute rejects Cloudflare storage when neither R2 nor KV payload storage is configured', async () => {
  const response = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'missing storage', resource: 'questions' }),
    }),
    env: {},
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(response.status, 501);
  assert.equal((await readJson(response)).error, 'Cloudflare storage binding not configured.');
});

test('storageRoute stores Cloudflare docs payloads behind opaque refs and reads them back', async () => {
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
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://app.example' },
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadBody.id, CF_ID);
  assert.deepEqual(uploadBody.storageRef, {
    backend: 'cloudflare',
    id: CF_ID,
    uri: `/storage/read?id=${CF_ID}`,
    contentType: 'text/plain',
    gate: 'docUploads',
    resource: 'docsContext',
    createdAt: '2026-01-02T03:04:05.000Z',
  });
  assert.doesNotMatch(JSON.stringify(uploadBody), /account|bucket|token|secret|r2:\/\//i);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${CF_ID}`),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.headers.get('X-CE-Storage-Ref'), CF_ID);
  assert.equal(readResponse.headers.get('Content-Type'), 'text/plain');
  assert.equal(await readResponse.text(), 'hello storage');
});

test('storageRoute treats docLibrary provider cloudflare as a worker storage backend', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const config = {
    docLibrary: { provider: 'cloudflare' },
    __registry: CLOUDFLARE_WORKER_GATE_CONFIG.__registry,
  };
  const uploadRequest = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: 'doc-library provider storage',
      contentType: 'text/plain',
      resource: 'docsContext',
    }),
  });

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: uploadRequest,
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  assert.equal(uploadResponse.status, 200);
  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadBody.storageRef.backend, 'cloudflare');

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=docsContext'),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  const listBody = await readJson(listResponse);
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.items.length, 1);
  assert.equal(listBody.items[0].storageRef.id, CF_ID);
});

test('storageRoute accepts Cloudflare document tags that look like ordinary filenames', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const uploadRequest = new Request('https://worker.example/storage/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      data: 'document bytes',
      contentType: 'text/plain',
      resource: 'docsContext',
      tags: [{ name: 'CE-DocName', value: 'secret.txt' }],
    }),
  });

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: uploadRequest,
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });

  const body = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 200);
  assert.equal(body.storageRef.backend, 'cloudflare');
  assert.doesNotMatch(JSON.stringify(body), /account|bucket|token|secret|r2:\/\//i);
});

test('storageRoute denies Cloudflare worker_sbt_gate reads when SBT gate check fails', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const gatedConfig = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'worker_sbt_gate' },
    },
    __registry: {
      gatesByResource: {
        docUploads: {
          sbtAddresses: ['0x00000000000000000000000000000000000000aa'],
          chainId: 84532,
          mode: 'all',
        },
      },
    },
  };

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'gated', contentType: 'text/plain', resource: 'docsContext' }),
    }),
    env,
    config: gatedConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate: async () => true,
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: gatedConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate: async () => false,
    },
  });
  const denied = await readJson(readResponse);
  assert.equal(readResponse.status, 403);
  assert.equal(denied.error, 'Access denied: Cloudflare worker SBT gate failed.');
});

test('storageRoute allows public_read Cloudflare reads and lists without requester auth', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const publicConfig = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'public_read' },
    },
  };

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'public question', contentType: 'text/plain', resource: 'questions' }),
    }),
    env,
    config: publicConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: publicConfig,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('X-CE-Payload-Access-Mode'), 'public_read');
  assert.equal(await readResponse.text(), 'public question');

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: publicConfig,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.equal(listResponse.status, 200);
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'public_read');
});

test('storageRoute scaffold rejects plaintext Cloudflare lit_encrypted uploads', async () => {
  const r2 = createMockR2();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: createMockKv() };
  const litConfig = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { mode: 'lit_encrypted' },
    },
  };

  const plaintextResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'plain', contentType: 'text/plain', resource: 'docsContext' }),
    }),
    env,
    config: litConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(plaintextResponse.status, 400);
  assert.match((await readJson(plaintextResponse)).error, /payloadEncrypted=true/);

  const encryptedResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: '{"ciphertext":"encrypted"}',
        contentType: 'application/json',
        resource: 'responses',
        payloadEncrypted: true,
      }),
    }),
    env,
    config: litConfig,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const encryptedBody = await readJson(encryptedResponse);
  assert.equal(encryptedResponse.status, 200);
  assert.equal(encryptedBody.storageRef.backend, 'cloudflare');
  assert.equal(encryptedBody.storageRef.encrypted, true);
});

test('storageRoute accepts v2 public-read payload access while preserving legacy metadata strings', async () => {
  const r2 = createMockR2();
  const kv = createMockKv();
  const env = { CE_STORAGE_R2: r2, CE_STORAGE_INDEX_KV: kv };
  const publicV2Config = {
    storageProfile: {
      backend: 'cloudflare',
      payloadAccessControl: { gate: 'none', encryption: 'none' },
    },
  };

  const uploadResponse = await storageRoute({
    path: '/storage/upload',
    method: 'POST',
    request: new Request('https://worker.example/storage/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'public v2', contentType: 'text/plain', resource: 'questions' }),
    }),
    env,
    config: publicV2Config,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: {
      json,
      randomBytes: fixedRandomBytes,
      now: () => Date.parse('2026-01-02T03:04:05.000Z'),
    },
  });
  const uploadBody = await readJson(uploadResponse);
  assert.equal(uploadResponse.status, 200);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${uploadBody.storageRef.id}`),
    env,
    config: publicV2Config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('X-CE-Payload-Access-Mode'), 'public_read');
  assert.equal(await readResponse.text(), 'public v2');

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: publicV2Config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.deepEqual(listed.items[0].metadata.payloadAccessControl, { gate: 'none', encryption: 'none' });
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'public_read');
});

test('storageRoute read-normalizes legacy payloadAccessMode metadata rows into v2 list metadata', async () => {
  const kv = createMockKv();
  const env = { CE_STORAGE_INDEX_KV: kv };
  await kv.put(`ce-storage:session-a:questions:${CF_ID}`, JSON.stringify({
    id: CF_ID,
    backend: 'cloudflare',
    resource: 'questions',
    contentType: 'text/plain',
    encrypted: false,
    payloadAccessMode: 'worker_sbt_gate',
    createdAt: '2026-01-02T03:04:05.000Z',
  }));

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=questions'),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });
  const listed = await readJson(listResponse);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(listed.items[0].metadata.payloadAccessControl, { gate: 'sbt_gate', encryption: 'none' });
  assert.equal(listed.items[0].metadata.payloadAccessMode, 'worker_sbt_gate');
});

test('storageRoute worker_envelope stores ciphertext only and audits successful key release', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { response, body } = await uploadEnvelopePayload({ env, config, setConfig });
  assert.equal(response.status, 200);
  assert.equal(body.storageRef.encrypted, true);

  const dump = [...kv.store.values()].join('\n');
  assert.doesNotMatch(dump, /classified payload/);
  assert.match(dump, /worker_envelope/);
  assert.ok(config.storageEnvelope?.sessionKey?.wrappedKey);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: {
      json,
      now: () => Date.parse('2026-01-02T03:04:06.000Z'),
      randomUUID: () => 'audit-id',
    },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(readResponse.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(await readResponse.text(), 'classified payload');
  assert.equal(
    [...kv.store.keys()].some((key) => key.startsWith(`ce-storage-audit:session-a:${body.storageRef.id}:`)),
    true
  );
});

test('storageRoute worker_envelope denies conditions before key unwrap', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body } = await uploadEnvelopePayload({ env, config, setConfig });
  const metadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', body.storageRef.id);
  metadata.accessConditions = {
    match: 'all',
    conditions: [{ kind: 'worker_role', role: 'admin' }],
  };
  metadata.envelope.accessConditions = metadata.accessConditions;
  await writeStorageIndexMetadata(kv, 'session-a', 'docsContext', metadata);

  const deniedResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env: { CE_STORAGE_INDEX_KV: kv },
    config,
    slug: 'session-a',
    uploaderAddress: '0x0000000000000000000000000000000000000bad',
    baseHeaders: {},
    deps: { json },
  });
  const denied = await readJson(deniedResponse);
  assert.equal(deniedResponse.status, 403);
  assert.equal(denied.reason, 'worker_role_denied');
  assert.equal([...kv.store.keys()].some((key) => key.startsWith('ce-storage-audit:')), false);
});

test('storageRoute worker_envelope audits before decrypting payload bytes', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body } = await uploadEnvelopePayload({ env, config, setConfig });

  const originalPut = kv.put.bind(kv);
  kv.put = async (key, value) => {
    if (String(key).startsWith('ce-storage-audit:')) {
      throw new Error('audit store unavailable');
    }
    return originalPut(key, value);
  };
  const cryptoSpy = createCryptoDecryptSpy();

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: {
      json,
      crypto: cryptoSpy.crypto,
      randomUUID: () => 'audit-fail',
    },
  });

  const result = await readJson(readResponse);
  assert.equal(readResponse.status, 403);
  assert.match(result.error, /audit store unavailable/);
  assert.equal(cryptoSpy.decryptCalls, 0);
});

test('storageRoute worker_envelope evaluates any/all and supported condition kinds', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body } = await uploadEnvelopePayload({ env, config, setConfig });
  const setConditions = async (doc) => {
    const metadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', body.storageRef.id);
    metadata.accessConditions = doc;
    metadata.envelope.accessConditions = doc;
    await writeStorageIndexMetadata(kv, 'session-a', 'docsContext', metadata);
  };
  let auditCounter = 0;
  const read = async ({
    requesterAddress = '0x0000000000000000000000000000000000000bad',
    authScopes = {},
    checkSbtGate = async () => false,
  } = {}) => storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${body.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: requesterAddress,
    authScopes,
    baseHeaders: {},
    deps: {
      json,
      now: () => Date.parse('2026-01-02T03:04:06.000Z'),
      randomUUID: () => {
        auditCounter += 1;
        return `audit-${auditCounter}`;
      },
      resolveRpcUrlListForGate: () => ['https://rpc.example'],
      checkSbtGate,
    },
  });

  await setConditions({
    match: 'any',
    conditions: [
      { kind: 'worker_role', role: 'admin' },
      { kind: 'agent_grant_scope', scope: 'storage' },
    ],
  });
  const anyResponse = await read({ authScopes: { storage: true } });
  assert.equal(anyResponse.status, 200);
  assert.equal(await anyResponse.text(), 'classified payload');

  await setConditions({
    match: 'all',
    conditions: [
      { kind: 'worker_role', role: 'admin' },
      { kind: 'agent_grant_scope', scope: 'storage' },
    ],
  });
  const allDeniedResponse = await read({
    requesterAddress: '0x0000000000000000000000000000000000000abc',
    authScopes: {},
  });
  assert.equal(allDeniedResponse.status, 403);
  assert.equal((await readJson(allDeniedResponse)).reason, 'agent_grant_scope_denied');
  const allAllowedResponse = await read({
    requesterAddress: '0x0000000000000000000000000000000000000abc',
    authScopes: { storage: true },
  });
  assert.equal(allAllowedResponse.status, 200);

  let sbtChecked = false;
  await setConditions({
    match: 'all',
    conditions: [{ kind: 'sbt_onchain', chainId: 11155420, contract: '0x00000000000000000000000000000000000000aa' }],
  });
  const sbtAllowedResponse = await read({
    checkSbtGate: async ({ sbtAddresses, chainId, mode }) => {
      sbtChecked = true;
      assert.deepEqual(sbtAddresses, ['0x00000000000000000000000000000000000000aa']);
      assert.equal(chainId, 11155420);
      assert.equal(mode, 'any');
      return true;
    },
  });
  assert.equal(sbtAllowedResponse.status, 200);
  assert.equal(sbtChecked, true);

  await setConditions({ match: 'all', conditions: [{ kind: 'worker_group', groupId: 'reserved' }] });
  const reservedResponse = await read();
  assert.equal(reservedResponse.status, 403);
  assert.equal((await readJson(reservedResponse)).reason, 'reserved_condition_kind');

  await setConditions({ match: 'all', conditions: [{ kind: 'future_kind' }] });
  const unknownResponse = await read();
  assert.equal(unknownResponse.status, 403);
  assert.equal((await readJson(unknownResponse)).reason, 'unknown_condition_kind');
});

test('rotateStorageEnvelopeKeys rewraps keys without changing ciphertext bytes', async () => {
  const kv = createMockKv();
  const env = {
    CE_STORAGE_INDEX_KV: kv,
    CE_STORAGE_ENVELOPE_KEK: 'test deployment envelope kek',
  };
  let config = createEnvelopeConfig();
  const setConfig = (nextConfig) => { config = nextConfig; };
  const { body: firstBody } = await uploadEnvelopePayload({
    env,
    config,
    setConfig,
    deps: { randomBytes: createSequenceRandomBytes(1) },
  });
  const { body: secondBody } = await uploadEnvelopePayload({
    env,
    config,
    setConfig,
    data: 'second classified payload',
    deps: { randomBytes: createSequenceRandomBytes(71) },
  });
  const firstPayloadKey = `ce-storage-payload:session-a:${firstBody.storageRef.id}`;
  const secondPayloadKey = `ce-storage-payload:session-a:${secondBody.storageRef.id}`;
  const firstBeforePayload = JSON.parse(kv.store.get(firstPayloadKey));
  const secondBeforePayload = JSON.parse(kv.store.get(secondPayloadKey));
  const firstBeforeMetadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', firstBody.storageRef.id);
  const secondBeforeMetadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', secondBody.storageRef.id);
  const originalList = kv.list.bind(kv);
  kv.list = async ({ prefix = '', cursor = '' } = {}) => {
    const allKeys = (await originalList({ prefix })).keys
      .map((entry) => entry.name)
      .sort();
    const offset = cursor ? Number(cursor) : 0;
    const pageKeys = allKeys.slice(offset, offset + 1);
    const nextOffset = offset + pageKeys.length;
    const complete = nextOffset >= allKeys.length;
    return {
      keys: pageKeys.map((name) => ({ name })),
      list_complete: complete,
      cursor: complete ? '' : String(nextOffset),
    };
  };

  const rotation = await rotateStorageEnvelopeKeys({
    env,
    slug: 'session-a',
    config,
    deps: {
      putSessionConfig: async (_env, _slug, nextConfig) => setConfig(nextConfig),
      randomBytes: createSequenceRandomBytes(101),
      now: () => Date.parse('2026-01-03T03:04:05.000Z'),
    },
  });
  assert.equal(rotation.payloadsRewrapped, 2);
  const firstAfterPayload = JSON.parse(kv.store.get(firstPayloadKey));
  const secondAfterPayload = JSON.parse(kv.store.get(secondPayloadKey));
  const firstAfterMetadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', firstBody.storageRef.id);
  const secondAfterMetadata = await readStorageIndexMetadata(kv, 'session-a', 'docsContext', secondBody.storageRef.id);
  assert.equal(firstAfterPayload.payloadBase64url, firstBeforePayload.payloadBase64url);
  assert.equal(secondAfterPayload.payloadBase64url, secondBeforePayload.payloadBase64url);
  assert.notEqual(firstAfterMetadata.envelope.dek.wrappedKey, firstBeforeMetadata.envelope.dek.wrappedKey);
  assert.notEqual(secondAfterMetadata.envelope.dek.wrappedKey, secondBeforeMetadata.envelope.dek.wrappedKey);

  const readResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${firstBody.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json, randomUUID: () => 'audit-rotation-read' },
  });
  assert.equal(readResponse.status, 200);
  assert.equal(await readResponse.text(), 'classified payload');

  const secondReadResponse = await storageRoute({
    path: '/storage/read',
    method: 'GET',
    request: new Request(`https://worker.example/storage/read?id=${secondBody.storageRef.id}`),
    env,
    config,
    slug: 'session-a',
    uploaderAddress: '',
    baseHeaders: {},
    deps: { json, randomUUID: () => 'audit-rotation-read-2' },
  });
  assert.equal(secondReadResponse.status, 200);
  assert.equal(await secondReadResponse.text(), 'second classified payload');
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
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json, randomBytes: fixedRandomBytes, now: () => Date.parse('2026-01-02T03:04:05.000Z') },
  });

  const listResponse = await storageRoute({
    path: '/storage/list',
    method: 'GET',
    request: new Request('https://worker.example/storage/list?resource=docsContext'),
    env,
    config: CLOUDFLARE_WORKER_GATE_CONFIG,
    slug: 'session-a',
    uploaderAddress: '0xabc',
    baseHeaders: {},
    deps: { json },
  });

  const body = await readJson(listResponse);
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].storageRef.id, CF_ID);
  assert.equal(body.items[0].storageRef.backend, 'cloudflare');
  assert.doesNotMatch(JSON.stringify(body), /sessions\/session-a\/storage|bucket|token|secret/i);
});
