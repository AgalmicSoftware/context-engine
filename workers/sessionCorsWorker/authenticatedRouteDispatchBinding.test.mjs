import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedRouteWithWorkerDeps } from './authenticatedRouteDispatchBinding.js';

test('dispatchAuthenticatedRouteWithWorkerDeps preserves authenticated dispatch wiring and env-bound nested helpers', async () => {
  const request = new Request('https://worker.example/ai', { method: 'POST' });
  const authenticatedContext = {
    ok: true,
    slug: 'session-a',
    config: { limits: { perWalletPerDay: 7 } },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { ai: true },
    address: '0xabc',
    limit: 7,
  };
  const env = { GROUP_KV: { id: 'kv' } };
  const response = new Response('ok');

  const result = await dispatchAuthenticatedRouteWithWorkerDeps({
    path: '/ai',
    method: 'POST',
    request,
    authenticatedContext,
    env,
    deps: {
      dispatchAuthenticatedRoute: async (value) => {
        assert.deepEqual(value.path, '/ai');
        assert.deepEqual(value.method, 'POST');
        assert.equal(value.request, request);
        assert.equal(value.authenticatedContext, authenticatedContext);
        assert.equal(value.deps.readAuthenticatedActionPayload, 'readAuthenticatedActionPayload');
        assert.equal(value.deps.json, 'json');

        const secretPathResponse = await value.deps.dispatchAuthenticatedSecretPathRoute({
          path: '/transcribe',
        });
        assert.equal(secretPathResponse, 'secretPathResponse');

        const nonSecretResponse = await value.deps.dispatchAuthenticatedNonSecretActionRoute({
          action: 'fetch_url',
        });
        assert.equal(nonSecretResponse, 'nonSecretResponse');

        const secretActionResponse = await value.deps.dispatchAuthenticatedSecretActionRoute({
          action: 'ai',
        });
        assert.equal(secretActionResponse, 'secretActionResponse');

        return response;
      },
      dispatchAuthenticatedSecretPathRoute: async (value) => {
        assert.equal(value.env, env);
        assert.deepEqual(value.path, '/transcribe');
        assert.equal(value.deps.evaluateAuthenticatedRoutePreflight, 'evaluateAuthenticatedRoutePreflight');
        assert.equal(value.deps.resolveAuthenticatedRouteSecrets, 'resolveAuthenticatedRouteSecrets');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
        assert.equal(value.deps.getSessionSecrets, 'getSessionSecrets');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.transcribe, 'transcribe');
        assert.equal(value.deps.arweaveUpload, 'arweaveUpload');
        return 'secretPathResponse';
      },
      readAuthenticatedActionPayload: 'readAuthenticatedActionPayload',
      dispatchAuthenticatedNonSecretActionRoute: async (value) => {
        assert.equal(value.env, env);
        assert.deepEqual(value.action, 'fetch_url');
        assert.equal(value.deps.evaluateAuthenticatedRoutePreflight, 'evaluateAuthenticatedRoutePreflight');
        assert.equal(value.deps.fetchImage, 'fetchImage');
        assert.equal(value.deps.fetchUrl, 'fetchUrl');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
        assert.equal(value.deps.json, 'json');
        return 'nonSecretResponse';
      },
      dispatchAuthenticatedSecretActionRoute: async (value) => {
        assert.equal(value.env, env);
        assert.deepEqual(value.action, 'ai');
        assert.equal(value.deps.evaluateAuthenticatedRoutePreflight, 'evaluateAuthenticatedRoutePreflight');
        assert.equal(value.deps.resolveAuthenticatedRouteSecrets, 'resolveAuthenticatedRouteSecrets');
        assert.equal(value.deps.normalizeAiRequestPayload, 'normalizeAiRequestPayload');
        assert.equal(value.deps.proxyAnthropic, 'proxyAnthropic');
        assert.equal(value.deps.proxyOpenAI, 'proxyOpenAI');
        assert.equal(value.deps.proxyOpenRouter, 'proxyOpenRouter');
        assert.equal(value.deps.proxyCustomRPC, 'proxyCustomRPC');
        assert.equal(value.deps.faucet, 'faucet');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
        assert.equal(value.deps.getSessionSecrets, 'getSessionSecrets');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.toStr, 'toStr');
        return 'secretActionResponse';
      },
      evaluateAuthenticatedRoutePreflight: 'evaluateAuthenticatedRoutePreflight',
      resolveAuthenticatedRouteSecrets: 'resolveAuthenticatedRouteSecrets',
      checkRateLimit: 'checkRateLimit',
      getSessionSecrets: 'getSessionSecrets',
      json: 'json',
      transcribe: 'transcribe',
      arweaveUpload: 'arweaveUpload',
      fetchImage: 'fetchImage',
      fetchUrl: 'fetchUrl',
      normalizeAiRequestPayload: 'normalizeAiRequestPayload',
      proxyAnthropic: 'proxyAnthropic',
      proxyOpenAI: 'proxyOpenAI',
      proxyOpenRouter: 'proxyOpenRouter',
      proxyCustomRPC: 'proxyCustomRPC',
      faucet: 'faucet',
      toStr: 'toStr',
    },
  });

  assert.equal(result, response);
});
