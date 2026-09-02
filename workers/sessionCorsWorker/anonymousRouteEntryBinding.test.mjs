import test from 'node:test';
import assert from 'node:assert/strict';

import { dispatchAnonymousRouteEntryWithWorkerDeps } from './anonymousRouteEntryBinding.js';

test('dispatchAnonymousRouteEntryWithWorkerDeps preserves entry and env-bound dispatch wiring', async () => {
  const request = new Request('https://worker.example/ai', { method: 'POST' });
  const env = { GROUP_KV: { id: 'kv' } };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const anonymousContext = {
    slug: 'session-a',
    config: { limits: { perWalletPerDay: 7 } },
    headers: { 'Access-Control-Allow-Origin': 'https://allowed.example' },
  };
  const response = new Response('ok');

  const result = await dispatchAnonymousRouteEntryWithWorkerDeps({
    path: '/ai',
    anonymousRoute: 'ai',
    request,
    env,
    slugHint: 'session-hint',
    baseHeaders,
    deps: {
      dispatchAnonymousRouteEntry: async (value) => {
        assert.equal(value.path, '/ai');
        assert.equal(value.anonymousRoute, 'ai');
        assert.equal(value.request, request);
        assert.equal(value.env, env);
        assert.equal(value.slugHint, 'session-hint');
        assert.equal(value.baseHeaders, baseHeaders);
        assert.equal(value.deps.resolveRequestSlugWithoutToken, 'resolveRequestSlugWithoutToken');
        assert.equal(value.deps.json, 'json');
        assert.equal(value.deps.MISSING_SLUG_ERROR, 'Missing sessionSlug.');
        assert.equal(value.deps.getSessionConfig, 'getSessionConfig');
        assert.equal(value.deps.SESSION_CONFIG_NOT_FOUND_ERROR, 'Session config not found.');
        assert.equal(value.deps.getCorsContext, 'getCorsContext');
        assert.equal(value.deps.resolveAnonymousRateIdentity, 'resolveAnonymousRateIdentity');
        assert.equal(value.deps.checkRateLimit, 'checkRateLimit');

        const dispatchResponse = await value.deps.dispatchAnonymousRoute({
          path: '/ai',
          request,
          anonymousContext,
        });
        assert.equal(dispatchResponse, 'anonymousDispatchResponse');

        return response;
      },
      dispatchAnonymousRoute: async (value) => {
        assert.equal(value.path, '/ai');
        assert.equal(value.request, request);
        assert.equal(value.anonymousContext, anonymousContext);
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
        assert.deepEqual(await value.deps.getSessionSecrets('session-a'), { openaiKey: 'sk-worker' });
        return 'anonymousDispatchResponse';
      },
      resolveRequestSlugWithoutToken: 'resolveRequestSlugWithoutToken',
      json: 'json',
      getSessionConfig: 'getSessionConfig',
      getCorsContext: 'getCorsContext',
      resolveAnonymousRateIdentity: 'resolveAnonymousRateIdentity',
      checkRateLimit: 'checkRateLimit',
      storageRoute: 'storageRoute',
      dispatchPublicWorkerGroupListRequest: 'dispatchPublicWorkerGroupListRequest',
      readTranscribeRequestPayload: 'readTranscribeRequestPayload',
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
    },
    constants: {
      missingSlugError: 'Missing sessionSlug.',
      sessionConfigNotFoundError: 'Session config not found.',
      anonymousRouteDeniedError: 'Anonymous access denied.',
    },
  });

  assert.equal(result, response);
});
