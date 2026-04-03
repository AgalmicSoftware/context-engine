import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchBootstrapArweaveUpload } from './bootstrapArweaveUploadDispatch.js';

test('dispatchBootstrapArweaveUpload ignores authenticated upload requests', async () => {
  let payloadCalled = false;

  const result = await dispatchBootstrapArweaveUpload({
    request: { headers: new Headers() },
    hasAuthorization: true,
    deps: {
      readArweaveBootstrapUploadPayload: async () => {
        payloadCalled = true;
        return { ok: true };
      },
    },
  });

  assert.equal(payloadCalled, false);
  assert.deepEqual(result, { handled: false });
});

test('dispatchBootstrapArweaveUpload preserves bootstrap payload parse failures', async () => {
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };

  const result = await dispatchBootstrapArweaveUpload({
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    hasAuthorization: false,
    deps: {
      corsHeaders: () => headers,
      readArweaveBootstrapUploadPayload: async () => ({
        ok: false,
        error: 'Invalid JSON.',
      }),
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
    },
  });

  assert.deepEqual(result, {
    handled: true,
    response: {
      body: { error: 'Invalid JSON.' },
      status: 400,
      headers,
    },
  });
});

test('dispatchBootstrapArweaveUpload preserves missing bootstrap slug failure', async () => {
  const headers = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  let configCalled = false;

  const result = await dispatchBootstrapArweaveUpload({
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    hasAuthorization: false,
    deps: {
      corsHeaders: () => headers,
      readArweaveBootstrapUploadPayload: async () => ({
        ok: true,
        body: { requestId: 'bootstrap-1' },
        hasProvidedArweaveJwk: true,
      }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: '', explicitSlugProvided: false }),
      getSessionConfig: async () => {
        configCalled = true;
        return null;
      },
      MISSING_SLUG_ERROR: 'Missing sessionSlug.',
      json: (body, status, responseHeaders) => ({ body, status, headers: responseHeaders }),
    },
  });

  assert.equal(configCalled, false);
  assert.deepEqual(result, {
    handled: true,
    response: {
      body: { error: 'Missing sessionSlug.' },
      status: 400,
      headers,
    },
  });
});

test('dispatchBootstrapArweaveUpload accepts an explicit general-session slug', async () => {
  const response = new Response('ok');

  const result = await dispatchBootstrapArweaveUpload({
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    hasAuthorization: false,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': 'https://allowed.example' }),
      readArweaveBootstrapUploadPayload: async () => ({
        ok: true,
        body: { requestId: 'bootstrap-general', sessionSlug: 'general' },
        hasProvidedArweaveJwk: true,
      }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: '', explicitSlugProvided: true }),
      getSessionConfig: async (slug) => {
        assert.equal(slug, '');
        return { allowOrigins: ['https://allowed.example'] };
      },
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      }),
      verifyAdminSignature: async (value) => {
        assert.equal(value.slugHint, '');
        return { ok: true, address: '0xabc' };
      },
      getSessionSecrets: async (slug) => {
        assert.equal(slug, '');
        return {};
      },
      arweaveUpload: async (value) => {
        assert.equal(value.slug, '');
        return response;
      },
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.deepEqual(result, {
    handled: true,
    response,
  });
});

test('dispatchBootstrapArweaveUpload rejects missing-config bootstrap uploads without request arweaveJwk', async () => {
  let corsCalled = false;
  let adminCalled = false;
  let uploadCalled = false;

  const result = await dispatchBootstrapArweaveUpload({
    request: { headers: new Headers() },
    hasAuthorization: false,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
      readArweaveBootstrapUploadPayload: async () => ({
        ok: true,
        body: { requestId: 'bootstrap-2' },
        hasProvidedArweaveJwk: false,
      }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: 'session-a' }),
      getSessionConfig: async () => null,
      getCorsContext: async () => {
        corsCalled = true;
        return { ok: true };
      },
      verifyAdminSignature: async () => {
        adminCalled = true;
        return { ok: true };
      },
      arweaveUpload: async () => {
        uploadCalled = true;
        return new Response('ok');
      },
      BOOTSTRAP_SESSION_CONFIG_REQUIRED_ERROR:
        'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(corsCalled, false);
  assert.equal(adminCalled, false);
  assert.equal(uploadCalled, false);
  assert.deepEqual(result, {
    handled: true,
    response: {
      body: {
        error: 'Session config not found. Provide arweaveJwk for bootstrap uploads or register session config first.',
      },
      status: 404,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  });
});

test('dispatchBootstrapArweaveUpload preserves bootstrap CORS rejection passthrough', async () => {
  const corsResponse = new Response(JSON.stringify({ error: 'Origin not allowed.' }), {
    status: 403,
  });
  let adminCalled = false;

  const result = await dispatchBootstrapArweaveUpload({
    request: { headers: new Headers({ Origin: 'https://blocked.example' }) },
    hasAuthorization: false,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
      readArweaveBootstrapUploadPayload: async () => ({
        ok: true,
        body: { requestId: 'bootstrap-3' },
        hasProvidedArweaveJwk: true,
      }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: 'session-a' }),
      getSessionConfig: async () => ({
        allowOrigins: ['https://allowed.example'],
      }),
      getCorsContext: async (value) => {
        assert.deepEqual(value.config, {
          allowOrigins: ['https://allowed.example'],
        });
        return { ok: false, response: corsResponse };
      },
      verifyAdminSignature: async () => {
        adminCalled = true;
        return { ok: true };
      },
      json: () => null,
    },
  });

  assert.equal(adminCalled, false);
  assert.equal(result.handled, true);
  assert.equal(result.response, corsResponse);
});

test('dispatchBootstrapArweaveUpload preserves bootstrap admin verification failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Admin authorization failed.' }), {
    status: 403,
  });
  let secretsCalled = false;

  const result = await dispatchBootstrapArweaveUpload({
    request: { headers: new Headers({ Origin: 'https://allowed.example' }) },
    hasAuthorization: false,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
      readArweaveBootstrapUploadPayload: async () => ({
        ok: true,
        body: { requestId: 'bootstrap-4' },
        hasProvidedArweaveJwk: true,
      }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: 'session-a' }),
      getSessionConfig: async () => ({
        registryAddress: '0x0000000000000000000000000000000000000001',
      }),
      getCorsContext: async () => ({
        ok: true,
        headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
      }),
      verifyAdminSignature: async (value) => {
        assert.equal(value.allowBootstrapWithoutConfig, false);
        return { ok: false, response };
      },
      getSessionSecrets: async () => {
        secretsCalled = true;
        return {};
      },
      arweaveUpload: async () => new Response('ok'),
      json: () => null,
    },
  });

  assert.equal(secretsCalled, false);
  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchBootstrapArweaveUpload bootstraps uploads without config when request arweaveJwk is provided', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const uploadResponse = new Response('uploaded');

  const result = await dispatchBootstrapArweaveUpload({
    request,
    hasAuthorization: false,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
      readArweaveBootstrapUploadPayload: async () => ({
        ok: true,
        body: { requestId: 'bootstrap-5' },
        hasProvidedArweaveJwk: true,
      }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: 'session-a' }),
      getSessionConfig: async () => null,
      getCorsContext: async (value) => {
        assert.deepEqual(value.config, {});
        return {
          ok: true,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        };
      },
      verifyAdminSignature: async (value) => {
        assert.equal(value.slugHint, 'session-a');
        assert.equal(value.allowBootstrapWithoutConfig, true);
        return { ok: true, address: '0xabc' };
      },
      getSessionSecrets: async () => {
        throw new Error('should not load worker secrets');
      },
      arweaveUpload: async (value) => {
        assert.deepEqual(value, {
          request,
          secrets: {},
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config: null,
          slug: 'session-a',
          uploaderAddress: '0xabc',
        });
        return uploadResponse;
      },
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, uploadResponse);
});

test('dispatchBootstrapArweaveUpload loads existing config and secrets before upload handoff', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const config = { allowOrigins: ['https://allowed.example'] };
  const secrets = { arweaveJwk: '{"kty":"RSA"}' };
  const uploadResponse = new Response('uploaded');

  const result = await dispatchBootstrapArweaveUpload({
    request,
    hasAuthorization: false,
    deps: {
      corsHeaders: () => ({ 'Access-Control-Allow-Origin': '*' }),
      readArweaveBootstrapUploadPayload: async () => ({
        ok: true,
        body: { requestId: 'bootstrap-6' },
        hasProvidedArweaveJwk: false,
      }),
      resolveWorkerBodySlugContext: () => ({ ok: true, targetSlug: 'session-a' }),
      getSessionConfig: async (slug) => {
        assert.equal(slug, 'session-a');
        return config;
      },
      getCorsContext: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.config, config);
        return {
          ok: true,
          headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        };
      },
      verifyAdminSignature: async (value) => {
        assert.equal(value.allowBootstrapWithoutConfig, false);
        assert.equal(value.config, config);
        return { ok: true, address: '0xdef' };
      },
      getSessionSecrets: async (slug) => {
        assert.equal(slug, 'session-a');
        return secrets;
      },
      arweaveUpload: async (value) => {
        assert.deepEqual(value, {
          request,
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config,
          slug: 'session-a',
          uploaderAddress: '0xdef',
        });
        return uploadResponse;
      },
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, uploadResponse);
});
