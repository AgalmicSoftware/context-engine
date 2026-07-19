import test from 'node:test';
import assert from 'node:assert/strict';

import {
  arweaveUpload,
  resolveArweaveCtor,
} from './arweaveUploadExecution.js';
import { resolveRpcUrlListForGate } from './gateRpcResolution.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('resolveArweaveCtor prefers the first matching candidate and preserves module-resolved logging', async () => {
  const logs = [];

  const ctor = await resolveArweaveCtor({
    deps: {
      log: (...args) => {
        logs.push(args);
      },
      arweaveCtorCandidates: [
        { name: 'candidate-a', loader: async () => ({ default: { init: () => 'ctor-a' } }) },
        { name: 'candidate-b', loader: async () => ({ init: () => 'ctor-b' }) },
      ],
    },
  });

  assert.equal(typeof ctor.init, 'function');
  assert.equal(ctor.init(), 'ctor-a');
  assert.deepEqual(logs, [[
    '[arweave] module resolved',
    { source: 'candidate-a' },
  ]]);
});

test('arweaveUpload preserves tag rejection logging and response payloads', async () => {
  const logs = [];
  let associationCalled = false;

  const result = await arweaveUpload({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    config: null,
    slug: 'session-a',
    uploaderAddress: '',
    deps: {
      json: createJsonStub(),
      log: (...args) => {
        logs.push(args);
      },
      readArweaveUploadRequestPayload: async () => ({
        ok: true,
        payload: {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: 'application/json',
          providedJwk: null,
          requestId: 'req-tag',
          tagsInput: '[bad-json',
        },
      }),
      resolveArweaveCtor: async () => ({ init: () => ({}) }),
      resolveArweaveUploadJwk: () => ({
        ok: true,
        jwk: { kty: 'RSA' },
        hasProvidedJwk: false,
        hasWorkerJwk: true,
      }),
      normalizeArweaveCeTags: () => ({
        ok: false,
        error: 'Invalid tags JSON.',
      }),
      normalizeArweaveAssociationTags: async () => {
        associationCalled = true;
        return { ok: true };
      },
    },
  });

  assert.equal(associationCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Invalid tags JSON.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
  assert.deepEqual(logs, [[
    '[arweave] tag reject',
    { requestId: 'req-tag', error: 'Invalid tags JSON.' },
  ]]);
});

test('arweaveUpload rejects oversized uploads before resolving Arweave dependencies', async () => {
  let resolvedArweave = false;
  const result = await arweaveUpload({
    request: new Request('https://worker.example/arweave/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'too-large' }),
    }),
    env: { CE_MAX_UPLOAD_BYTES: '4' },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    config: null,
    slug: 'session-a',
    uploaderAddress: '',
    deps: {
      json: createJsonStub(),
      resolveArweaveCtor: async () => {
        resolvedArweave = true;
        return null;
      },
    },
  });

  assert.equal(resolvedArweave, false);
  assert.equal(result.status, 413);
  assert.match(result.body.error, /Upload payload too large/);
});

test('arweaveUpload preserves session-id resolve rejection logging and status passthrough', async () => {
  const logs = [];

  const result = await arweaveUpload({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    config: { registryAddress: '0x0000000000000000000000000000000000000001' },
    slug: 'session-a',
    uploaderAddress: '',
    deps: {
      json: createJsonStub(),
      log: (...args) => {
        logs.push(args);
      },
      readArweaveUploadRequestPayload: async () => ({
        ok: true,
        payload: {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: 'application/json',
          providedJwk: null,
          requestId: 'req-assoc',
          tagsInput: [{ name: 'CE-SessionId', value: '0x11' }],
        },
      }),
      resolveArweaveCtor: async () => ({ init: () => ({}) }),
      resolveArweaveUploadJwk: () => ({
        ok: true,
        jwk: { kty: 'RSA' },
        hasProvidedJwk: false,
        hasWorkerJwk: true,
      }),
      normalizeArweaveCeTags: () => ({
        ok: true,
        tags: [{ name: 'CE-SessionId', value: '0x11' }],
      }),
      normalizeArweaveAssociationTags: async ({ chainAttestationCache }) => {
        assert.ok(chainAttestationCache instanceof Map);
        return {
          ok: false,
          status: 400,
          error: 'registry read failed',
          reason: 'session-id-resolve',
        };
      },
    },
  });

  assert.deepEqual(result, {
    body: { error: 'registry read failed' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
  assert.deepEqual(logs, [[
    '[arweave] sessionId resolve failed',
    {
      requestId: 'req-assoc',
      slug: 'session-a',
      error: 'registry read failed',
    },
  ]]);
});

test('arweaveUpload supplies the session-secret RPC to SBT association checks', async () => {
  const secretRpcUrl = 'https://private-rpc.example.test/eth';
  const publicConfig = {
    networkChainId: 31337,
    sessionModeProfile: { authority: { mode: 'worker_canonical' } },
  };
  let associationRpcUrls = [];

  const result = await arweaveUpload({
    request: { headers: new Headers() },
    secrets: {
      arweaveJwk: '{}',
      customRpcUrl: secretRpcUrl,
    },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    config: publicConfig,
    slug: 'session-a',
    uploaderAddress: '0x0000000000000000000000000000000000000abc',
    deps: {
      json: createJsonStub(),
      readArweaveUploadRequestPayload: async () => ({
        ok: true,
        payload: {
          bytes: new Uint8Array([1, 2, 3]),
          contentType: 'application/json',
          providedJwk: null,
          requestId: 'req-secret-rpc',
          tagsInput: [],
        },
      }),
      resolveArweaveCtor: async () => ({ init: () => ({}) }),
      resolveArweaveUploadJwk: () => ({
        ok: true,
        jwk: { kty: 'RSA' },
        hasProvidedJwk: false,
        hasWorkerJwk: true,
      }),
      normalizeArweaveCeTags: () => ({ ok: true, tags: [] }),
      normalizeArweaveAssociationTags: async ({ config }) => {
        associationRpcUrls = resolveRpcUrlListForGate({
          config,
          gateChainId: 31337,
        });
        return {
          ok: false,
          status: 403,
          error: 'stop after rpc assertion',
          reason: 'sbt-association',
        };
      },
    },
  });

  assert.equal(result.status, 403);
  assert.deepEqual(associationRpcUrls, [secretRpcUrl]);
  assert.equal(JSON.stringify(publicConfig).includes(secretRpcUrl), false);
});

test('arweaveUpload preserves upload start/success logging and transaction tag wiring', async () => {
  const logs = [];
  const tx = {
    id: 'tx-123',
    tags: [],
    addTag(name, value) {
      this.tags.push({ name, value });
    },
  };
  const uploader = {
    isComplete: false,
    uploadChunkCalls: 0,
    async uploadChunk() {
      this.uploadChunkCalls += 1;
      this.isComplete = true;
    },
  };
  const arweaveApi = {
    createTransaction: async (payload, jwk) => {
      assert.deepEqual(payload, { data: new Uint8Array([4, 5, 6]) });
      assert.deepEqual(jwk, { kty: 'RSA' });
      return tx;
    },
    transactions: {
      sign: async (value, jwk) => {
        assert.equal(value, tx);
        assert.deepEqual(jwk, { kty: 'RSA' });
      },
      getUploader: async (value) => {
        assert.equal(value, tx);
        return uploader;
      },
      post: async () => {
        throw new Error('should not fallback to post');
      },
    },
  };

  const result = await arweaveUpload({
    request: {
      headers: new Headers({ authorization: 'Bearer token' }),
    },
    secrets: {
      arweaveJwk: '{"kty":"RSA"}',
    },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
    config: { registryAddress: '0x0000000000000000000000000000000000000001' },
    slug: 'session-success',
    uploaderAddress: '0xabc',
    deps: {
      json: createJsonStub(),
      log: (...args) => {
        logs.push(args);
      },
      readArweaveUploadRequestPayload: async () => ({
        ok: true,
        payload: {
          bytes: new Uint8Array([4, 5, 6]),
          contentType: 'application/json',
          providedJwk: null,
          requestId: 'req-success',
          tagsInput: [{ name: 'CE-Test', value: 'ok' }],
        },
      }),
      resolveArweaveCtor: async () => ({
        init: (config) => {
          assert.deepEqual(config, {
            host: 'arweave.net', // intentional: real URL — tests allowlist enforcement
            port: 443,
            protocol: 'https',
            timeout: 60000,
            connectTimeout: 60000,
            logging: false,
          });
          return arweaveApi;
        },
      }),
      resolveArweaveUploadJwk: () => ({
        ok: true,
        jwk: { kty: 'RSA' },
        hasProvidedJwk: false,
        hasWorkerJwk: true,
      }),
      normalizeArweaveCeTags: () => ({
        ok: true,
        tags: [{ name: 'CE-Test', value: 'ok' }],
      }),
      normalizeArweaveAssociationTags: async ({ tags }) => {
        tags.push({ name: 'CE-SessionId', value: '0x1234' });
        return { ok: true, tags };
      },
    },
  });

  assert.deepEqual(result, {
    body: { id: 'tx-123' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example.test' },
  });
  assert.equal(uploader.uploadChunkCalls, 1);
  assert.deepEqual(tx.tags, [
    { name: 'Content-Type', value: 'application/json' },
    { name: 'App-Name', value: 'ContextEngine' },
    { name: 'CE-Test', value: 'ok' },
    { name: 'CE-SessionId', value: '0x1234' },
  ]);
  assert.deepEqual(logs, [
    ['[arweave] upload start', {
      requestId: 'req-success',
      contentType: 'application/json',
      size: 3,
      hasProvidedJwk: false,
      hasWorkerJwk: true,
      hasAuthHeader: true,
      tags: 2,
    }],
    ['[arweave] upload success', {
      requestId: 'req-success',
      id: 'tx-123',
    }],
  ]);
});

test('arweaveUpload preserves transactions.post fallback error details in upload-error responses', async () => {
  const logs = [];

  const result = await arweaveUpload({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    config: null,
    slug: 'session-a',
    uploaderAddress: '',
    deps: {
      json: createJsonStub(),
      log: (...args) => {
        logs.push(args);
      },
      toStr: (value) => `${value ?? ''}`,
      readArweaveUploadRequestPayload: async () => ({
        ok: true,
        payload: {
          bytes: new Uint8Array([7, 8, 9]),
          contentType: 'application/json',
          providedJwk: null,
          requestId: 'req-post-fail',
          tagsInput: [],
        },
      }),
      resolveArweaveCtor: async () => ({
        init: () => ({
          createTransaction: async () => ({
            id: 'tx-post-fail',
            addTag: () => {},
          }),
          transactions: {
            sign: async () => {},
            getUploader: async () => {
              throw new Error('chunk upload unavailable');
            },
            post: async () => ({
              status: 503,
              statusText: 'Service Unavailable',
              text: async () => 'upstream rejected',
            }),
          },
        }),
      }),
      resolveArweaveUploadJwk: () => ({
        ok: true,
        jwk: { kty: 'RSA' },
        hasProvidedJwk: false,
        hasWorkerJwk: false,
      }),
      normalizeArweaveCeTags: () => ({ ok: true, tags: [] }),
      normalizeArweaveAssociationTags: async () => ({ ok: true, tags: [] }),
    },
  });

  assert.deepEqual(result, {
    body: {
      error: 'Arweave post failed (503): Service Unavailable | upstream rejected',
    },
    status: 500,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
  assert.equal(logs[0][0], '[arweave] upload start');
  assert.deepEqual(logs[1], ['[arweave] upload error', {
    requestId: 'req-post-fail',
    message: 'Arweave post failed (503): Service Unavailable | upstream rejected',
    stack: logs[1][1].stack,
  }]);
  assert.match(logs[1][1].stack, /Arweave post failed \(503\): Service Unavailable \| upstream rejected/);
});
