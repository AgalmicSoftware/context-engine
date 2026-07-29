import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAnonymousRouteWithWorkerDeps } from './anonymousRouteDispatchBinding.js';

test('dispatchAnonymousRouteWithWorkerDeps preserves anonymous dispatch wiring and env-bound secrets lookup', async () => {
  const request = new Request('https://worker.example/ai', { method: 'POST' });
  const anonymousContext = {
    slug: 'session-a',
    config: { scopes: { ai: true } },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  };
  const env = { GROUP_KV: { id: 'kv' } };
  const response = new Response('ok');
  const calls = [];

  const result = await dispatchAnonymousRouteWithWorkerDeps({
    path: '/ai',
    request,
    anonymousContext,
    env,
    deps: {
      dispatchAnonymousRoute: async (value) => {
        calls.push(['dispatchAnonymousRoute', value.path, value.request, value.anonymousContext]);
        const secretResult = await value.deps.getSessionSecrets('session-a');
        calls.push(['getSessionSecrets', secretResult]);
        assert.equal(value.deps.storageRoute, 'storageRoute');
        assert.equal(value.deps.dispatchPublicWorkerGroupListRequest, 'dispatchPublicWorkerGroupListRequest');
        assert.equal(value.deps.readTranscribeRequestPayload, 'readTranscribeRequestPayload');
        assert.equal(value.deps.evaluateAnonymousRouteAccess, 'evaluateAnonymousRouteAccess');
        assert.equal(value.deps.transcribe, 'transcribe');
        assert.equal(value.deps.readAiRequestPayload, 'readAiRequestPayload');
        assert.equal(value.deps.validateAnonymousAiRequest, 'validateAnonymousAiRequest');
        assert.equal(value.deps.proxyAnthropic, 'proxyAnthropic');
        assert.equal(value.deps.proxyOpenAI, 'proxyOpenAI');
        assert.equal(value.deps.proxyOpenRouter, 'proxyOpenRouter');
        assert.equal(value.deps.proxyCustomRPC, 'proxyCustomRPC');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.ANONYMOUS_ROUTE_DENIED_ERROR, 'Anonymous access denied.');
        return response;
      },
      readTranscribeRequestPayload: 'readTranscribeRequestPayload',
      storageRoute: 'storageRoute',
      dispatchPublicWorkerGroupListRequest: 'dispatchPublicWorkerGroupListRequest',
      evaluateAnonymousRouteAccess: 'evaluateAnonymousRouteAccess',
      getSessionSecrets: async (receivedEnv, slug) => {
        assert.equal(receivedEnv, env);
        assert.equal(slug, 'session-a');
        return { openaiKey: 'sk-worker' };
      },
      transcribe: 'transcribe',
      readAiRequestPayload: 'readAiRequestPayload',
      validateAnonymousAiRequest: 'validateAnonymousAiRequest',
      proxyAnthropic: 'proxyAnthropic',
      proxyOpenAI: 'proxyOpenAI',
      proxyOpenRouter: 'proxyOpenRouter',
      proxyCustomRPC: 'proxyCustomRPC',
      json: 'json',
    },
    constants: {
      anonymousRouteDeniedError: 'Anonymous access denied.',
    },
  });

  assert.equal(result, response);
  assert.deepEqual(calls, [
    ['dispatchAnonymousRoute', '/ai', request, anonymousContext],
    ['getSessionSecrets', { openaiKey: 'sk-worker' }],
  ]);
});
