import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAuthenticatedRouteEntryWithWorkerDeps } from './authenticatedRouteEntryBinding.js';

test('dispatchAuthenticatedRouteEntryWithWorkerDeps preserves authenticated entry wiring, context binding, and env-bound dispatch binding', async () => {
  const request = new Request('https://worker.example/ai', { method: 'POST' });
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const auth = { ok: true, slug: 'session-a', payload: { sub: '0xabc' } };
  const authenticatedContext = {
    ok: true,
    slug: 'session-a',
    config: { limits: { perWalletPerDay: 7 } },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
    scopes: { ai: true },
    address: '0xabc',
    limit: 7,
  };
  const response = new Response('ok');

  const result = await dispatchAuthenticatedRouteEntryWithWorkerDeps({
    path: '/ai',
    method: 'POST',
    request,
    env,
    baseHeaders,
    deps: {
      dispatchAuthenticatedRouteEntry: async (value) => {
        assert.equal(value.path, '/ai');
        assert.equal(value.method, 'POST');
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.requireAuth, 'requireAuth');

        const contextResponse = await value.deps.resolveAuthenticatedRouteContext({
          request,
          env,
          auth,
          baseHeaders,
        });
        assert.equal(contextResponse, 'contextResponse');

        const dispatchResponse = await value.deps.dispatchAuthenticatedRoute({
          path: '/ai',
          method: 'POST',
          request,
          authenticatedContext,
        });
        assert.equal(dispatchResponse, 'dispatchResponse');

        return response;
      },
      resolveAuthenticatedRouteContext: async (value) => {
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.auth, auth);
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.deps.getSessionConfig, 'getSessionConfig');
        assert.equal(value.deps.getCorsContext, 'getCorsContext');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.toStr, 'toStr');
        assert.equal(value.deps.SESSION_CONFIG_NOT_FOUND_ERROR, 'Session config not found.');
        return 'contextResponse';
      },
      dispatchAuthenticatedRoute: async (value) => {
        assert.equal(value.path, '/ai');
        assert.equal(value.method, 'POST');
        assert.equal(value.request, request);
        assert.equal(value.authenticatedContext, authenticatedContext);
        assert.equal(value.deps.readAuthenticatedActionPayload, 'readAuthenticatedActionPayload');
        assert.equal(value.deps.json, 'json');

        assert.equal(
          await value.deps.dispatchAuthenticatedSecretPathRoute({ path: '/transcribe' }),
          'secretPathResponse',
        );
        assert.equal(
          await value.deps.dispatchAuthenticatedNonSecretActionRoute({ action: 'fetch_url' }),
          'nonSecretResponse',
        );
        assert.equal(
          await value.deps.dispatchAuthenticatedSecretActionRoute({ action: 'ai' }),
          'secretActionResponse',
        );
        return 'dispatchResponse';
      },
      json: 'json',
      requireAuth: 'requireAuth',
      getSessionConfig: 'getSessionConfig',
      getCorsContext: 'getCorsContext',
      toStr: 'toStr',
      dispatchAuthenticatedSecretPathRoute: async (value) => {
        assert.equal(value.env, env);
        assert.equal(value.path, '/transcribe');
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
        assert.equal(value.action, 'fetch_url');
        assert.equal(value.deps.evaluateAuthenticatedRoutePreflight, 'evaluateAuthenticatedRoutePreflight');
        assert.equal(value.deps.fetchImage, 'fetchImage');
        assert.equal(value.deps.fetchUrl, 'fetchUrl');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');
        assert.equal(value.deps.json, 'json');
        return 'nonSecretResponse';
      },
      dispatchAuthenticatedSecretActionRoute: async (value) => {
        assert.equal(value.env, env);
        assert.equal(value.action, 'ai');
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
    },
    constants: {
      sessionConfigNotFoundError: 'Session config not found.',
    },
  });

  assert.equal(result, response);
});
