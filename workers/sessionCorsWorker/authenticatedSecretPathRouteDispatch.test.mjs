import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedSecretPathRoute } from './authenticatedSecretPathRouteDispatch.js';

test('dispatchAuthenticatedSecretPathRoute ignores unrelated routes', async () => {
  let called = false;

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/',
    method: 'POST',
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => {
        called = true;
        return { ok: true };
      },
    },
  });

  assert.equal(called, false);
  assert.deepEqual(result, { handled: false });
});

test('dispatchAuthenticatedSecretPathRoute preserves preflight failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Token missing transcribe scope.' }), {
    status: 403,
  });

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/transcribe',
    method: 'POST',
    request: { headers: new Headers() },
    config: { allowOrigins: ['https://allowed.example'] },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { transcribe: false },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'transcribe');
        assert.equal(value.route, 'transcribe');
        return { ok: false, response };
      },
      resolveAuthenticatedRouteSecrets: async () => {
        throw new Error('should not resolve secrets');
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => ({}),
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedSecretPathRoute resolves secrets and hands transcribe requests downstream', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const secrets = { openaiKey: 'sk-openai' };
  const downstreamResponse = new Response('ok');

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/transcribe',
    method: 'POST',
    request,
    config: { allowOrigins: ['https://allowed.example'] },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { transcribe: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      transcribe: async (value) => {
        assert.deepEqual(value, {
          request,
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretPathRoute preserves secret resolution failure passthrough', async () => {
  const response = new Response(JSON.stringify({ error: 'Session secrets not configured.' }), {
    status: 401,
  });

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/arweave/upload',
    method: 'POST',
    request: { headers: new Headers() },
    config: { allowOrigins: ['https://allowed.example'] },
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': '*' },
    scopes: { arweave: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: false, response }),
      arweaveUpload: async () => {
        throw new Error('should not dispatch upload');
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => null,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, response);
});

test('dispatchAuthenticatedSecretPathRoute allows authenticated arweave uploads with a provided JWK when worker secrets are missing', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const config = { registryAddress: '0x0000000000000000000000000000000000000001' };
  const response = new Response(JSON.stringify({ error: 'Session secrets not configured.' }), {
    status: 401,
  });
  const downstreamResponse = new Response('uploaded-via-provided-jwk');

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/arweave/upload',
    method: 'POST',
    request,
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { arweave: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async () => ({ ok: true, tokenHasScope: true }),
      resolveAuthenticatedRouteSecrets: async () => ({ ok: false, reason: 'missing_secrets', response }),
      readArweaveUploadRequestPayload: async (value) => {
        assert.equal(value, request);
        return {
          ok: true,
          payload: {
            providedJwk: '{"kty":"RSA"}',
          },
        };
      },
      arweaveUpload: async (value) => {
        assert.deepEqual(value, {
          request,
          secrets: {},
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config,
          slug: 'session-a',
          uploaderAddress: '0xabc',
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => null,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretPathRoute hands authenticated arweave uploads downstream with config and uploader context', async () => {
  const request = { headers: new Headers({ Origin: 'https://allowed.example' }) };
  const config = { registryAddress: '0x0000000000000000000000000000000000000001' };
  const secrets = { arweaveJwk: '{}' };
  const downstreamResponse = new Response('uploaded');

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/arweave/upload',
    method: 'POST',
    request,
    config,
    slug: 'session-a',
    address: '0xabc',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { arweave: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'arweave');
        assert.equal(value.route, 'arweave');
        return { ok: true, tokenHasScope: true };
      },
      resolveAuthenticatedRouteSecrets: async () => ({ ok: true, secrets }),
      arweaveUpload: async (value) => {
        assert.deepEqual(value, {
          request,
          secrets,
          baseHeaders: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
          config,
          slug: 'session-a',
          uploaderAddress: '0xabc',
        });
        return downstreamResponse;
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => secrets,
      json: () => null,
    },
  });

  assert.equal(result.handled, true);
  assert.equal(result.response, downstreamResponse);
});

test('dispatchAuthenticatedSecretPathRoute issues Lit payment delegation for authorized users', async () => {
  const request = {
    clone: () => ({
      json: async () => ({
        sessionPublicKey: '6e28158980f0a619cb6c90ddc396e5c79bdf65cf60b1ab5df0e9972620c07ef4',
        audience: 'https://phishing.example',
        expiresAt: '2099-01-01T00:00:00.000Z',
      }),
    }),
    headers: new Headers({ Origin: 'https://allowed.example' }),
  };

  const result = await dispatchAuthenticatedSecretPathRoute({
    path: '/lit/payment-delegation',
    method: 'POST',
    request,
    config: { lit: { network: 'naga-test' } },
    slug: 'session-a',
    address: '0x00000000000000000000000000000000000000aa',
    env: { GROUP_KV: {} },
    limit: 7,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { lit: true },
    deps: {
      evaluateAuthenticatedRoutePreflight: async (value) => {
        assert.equal(value.scope, 'lit');
        assert.equal(value.route, 'lit-payment-delegation');
        return { ok: true, tokenHasScope: true };
      },
      resolveAuthenticatedRouteSecrets: async () => ({
        ok: true,
        secrets: { litPayerPrivateKey: '0xabc123' },
      }),
      issueLitPaymentDelegation: async (value) => {
        assert.deepEqual(value, {
          requesterAddress: '0x00000000000000000000000000000000000000aa',
          sessionPublicKey: '6e28158980f0a619cb6c90ddc396e5c79bdf65cf60b1ab5df0e9972620c07ef4',
          litNetwork: 'naga-test',
          litPayerPrivateKey: '0xabc123',
          audience: 'https://allowed.example',
          expiresAt: '2099-01-01T00:00:00.000Z',
        });
        return {
          capabilityAuthSig: { sig: '0xsig' },
          payerAddress: '0x00000000000000000000000000000000000000bb',
        };
      },
      checkRateLimit: async () => true,
      getSessionSecrets: async () => ({ litPayerPrivateKey: '0xabc123' }),
      json: (body, status, headers) => ({ body, status, headers }),
    },
  });

  assert.equal(result.handled, true);
  assert.deepEqual(result.response, {
    body: {
      ok: true,
      capabilityAuthSig: { sig: '0xsig' },
      payerAddress: '0x00000000000000000000000000000000000000bb',
    },
    status: 200,
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  });
});
