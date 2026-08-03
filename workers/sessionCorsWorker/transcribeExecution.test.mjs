import test from 'node:test';
import assert from 'node:assert/strict';

import { transcribe } from './transcribeExecution.js';

const createJsonStub = () => (body, status, headers) => ({ body, status, headers });

test('transcribe preserves pre-read transcribeRequest usage and OpenAI secret-backed success', async () => {
  let readCalled = false;
  let fetchArgs = null;
  const upstreamFormData = new FormData();
  upstreamFormData.append('file', new File(['audio'], 'clip.mp3', { type: 'audio/mpeg' }));

  const result = await transcribe({
    request: { headers: new Headers() },
    secrets: { openaiKey: ' sk-openai ' },
    baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    transcribeRequest: {
      ok: true,
      payload: {
        provider: 'openai',
        requestApiKey: '',
        requestRpcUrl: '',
        upstreamFormData,
      },
    },
    deps: {
      json: createJsonStub(),
      toStr: (value) => `${value ?? ''}`,
      readTranscribeRequestPayload: async () => {
        readCalled = true;
        return { ok: false };
      },
      isBlockedOutboundUrl: () => false,
      safeFetch: async (...args) => {
        fetchArgs = args;
        return new Response(JSON.stringify({ text: 'pong' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
    constants: {
      openAiTranscribeUrl: 'https://api.openai.example/v1/audio/transcriptions',
    },
  });

  assert.equal(readCalled, false);
  assert.deepEqual(fetchArgs, [
    'https://api.openai.example/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: { authorization: 'Bearer sk-openai' },
      body: upstreamFormData,
    },
  ]);
  assert.deepEqual(result, {
    body: { text: 'pong' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});

test('transcribe preserves parse error passthrough from the extracted request normalization helper', async () => {
  const result = await transcribe({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      readTranscribeRequestPayload: async () => ({
        ok: false,
        status: 400,
        error: 'Expected multipart/form-data.',
      }),
      safeFetch: async () => {
        throw new Error('should not fetch');
      },
    },
  });

  assert.deepEqual(result, {
    body: { error: 'Expected multipart/form-data.' },
    status: 400,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('transcribe preserves custom provider blocked-target rejection before upstream fetch', async () => {
  let fetchCalled = false;

  const result = await transcribe({
    request: { headers: new Headers() },
    secrets: { openaiKey: 'sk-worker' },
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      readTranscribeRequestPayload: async () => ({
        ok: true,
        payload: {
          provider: 'custom',
          requestApiKey: 'sk-local',
          requestRpcUrl: 'https://127.0.0.1:8080/transcribe',
          upstreamFormData: new FormData(),
        },
      }),
      isBlockedOutboundUrl: () => true,
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Custom transcription URL target is not allowed' },
    status: 403,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('transcribe rejects malformed, insecure, and credential-bearing custom URLs before fetch', async () => {
  const cases = [
    ['not-a-url', 'Custom transcription URL target is not allowed'],
    ['http://transcribe.example/v1', 'Custom transcription URL must use HTTPS'],
    ['https://user:[redacted-email]/v1', 'Custom transcription URL must not contain credentials'],
  ];

  for (const [requestRpcUrl, expectedError] of cases) {
    let fetchCalled = false;
    const result = await transcribe({
      request: { headers: new Headers() },
      secrets: {},
      baseHeaders: { 'Access-Control-Allow-Origin': '*' },
      deps: {
        json: createJsonStub(),
        readTranscribeRequestPayload: async () => ({
          ok: true,
          payload: {
            provider: 'custom',
            requestApiKey: 'sk-local',
            requestRpcUrl,
            upstreamFormData: new FormData(),
          },
        }),
        isBlockedOutboundUrl: () => false,
        safeFetch: async () => {
          fetchCalled = true;
          return new Response();
        },
      },
    });

    assert.equal(fetchCalled, false);
    assert.deepEqual(result, {
      body: { error: expectedError },
      status: 403,
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  }
});

test('transcribe applies strict redirect policy to valid custom HTTPS requests', async () => {
  const upstreamFormData = new FormData();
  let fetchArgs = null;

  const result = await transcribe({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      readTranscribeRequestPayload: async () => ({
        ok: true,
        payload: {
          provider: 'custom',
          requestApiKey: 'sk-local',
          requestRpcUrl: 'https://transcribe.example/v1',
          upstreamFormData,
        },
      }),
      isBlockedOutboundUrl: () => false,
      safeFetch: async (...args) => {
        fetchArgs = args;
        return new Response(JSON.stringify({ text: 'done' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });

  assert.deepEqual(fetchArgs, [
    'https://transcribe.example/v1',
    {
      method: 'POST',
      headers: { authorization: 'Bearer sk-local' },
      body: upstreamFormData,
      outboundUrlPolicy: 'strict-https-no-credentials',
    },
  ]);
  assert.deepEqual(result, {
    body: { text: 'done' },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('transcribe preserves missing worker openaiKey failure for non-custom providers', async () => {
  let fetchCalled = false;

  const result = await transcribe({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      readTranscribeRequestPayload: async () => ({
        ok: true,
        payload: {
          provider: 'openai',
          requestApiKey: '',
          requestRpcUrl: '',
          upstreamFormData: new FormData(),
        },
      }),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => {
        fetchCalled = true;
        return new Response();
      },
    },
  });

  assert.equal(fetchCalled, false);
  assert.deepEqual(result, {
    body: { error: 'Server misconfigured: openaiKey is missing.' },
    status: 401,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('transcribe preserves unauthorized upstream fallback message and details when the server returns 401', async () => {
  const upstreamFormData = new FormData();

  const result = await transcribe({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders: { 'Access-Control-Allow-Origin': '*' },
    deps: {
      json: createJsonStub(),
      readTranscribeRequestPayload: async () => ({
        ok: true,
        payload: {
          provider: 'custom',
          requestApiKey: 'sk-local',
          requestRpcUrl: 'https://rpc.example/transcribe',
          upstreamFormData,
        },
      }),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => new Response('{}', {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  });

  assert.deepEqual(result, {
    body: {
      error: 'Unauthorized: invalid API key on server.',
      details: {},
    },
    status: 401,
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
});

test('transcribe preserves upstream error message precedence for string and object payloads', async () => {
  const baseHeaders = { 'Access-Control-Allow-Origin': '*' };
  const upstreamFormData = new FormData();

  const stringError = await transcribe({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders,
    deps: {
      json: createJsonStub(),
      readTranscribeRequestPayload: async () => ({
        ok: true,
        payload: {
          provider: 'custom',
          requestApiKey: 'sk-local',
          requestRpcUrl: 'https://rpc.example/transcribe',
          upstreamFormData,
        },
      }),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => new Response(JSON.stringify({ error: 'custom failure' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  });

  const objectError = await transcribe({
    request: { headers: new Headers() },
    secrets: {},
    baseHeaders,
    deps: {
      json: createJsonStub(),
      readTranscribeRequestPayload: async () => ({
        ok: true,
        payload: {
          provider: 'custom',
          requestApiKey: 'sk-local',
          requestRpcUrl: 'https://rpc.example/transcribe',
          upstreamFormData,
        },
      }),
      isBlockedOutboundUrl: () => false,
      safeFetch: async () => new Response(JSON.stringify({ error: { message: 'nested failure' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    },
  });

  assert.deepEqual(stringError, {
    body: {
      error: 'custom failure',
      details: { error: 'custom failure' },
    },
    status: 502,
    headers: baseHeaders,
  });
  assert.deepEqual(objectError, {
    body: {
      error: 'nested failure',
      details: { error: { message: 'nested failure' } },
    },
    status: 500,
    headers: baseHeaders,
  });
});
