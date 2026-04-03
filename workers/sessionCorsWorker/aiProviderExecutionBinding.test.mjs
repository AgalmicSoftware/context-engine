import test from 'node:test';
import assert from 'node:assert/strict';

import { createAiProviderProxiesWithWorkerDeps } from './aiProviderExecutionBinding.js';

test('createAiProviderProxiesWithWorkerDeps preserves the worker-specific AI provider deps bundle', async () => {
  const payload = { prompt: 'ping' };
  const secrets = { openaiKey: 'sk-openai' };
  const baseHeaders = { 'Access-Control-Allow-Origin': 'https://allowed.example' };
  const responses = {
    anthropic: new Response('anthropic'),
    openai: new Response('openai'),
    openrouter: new Response('openrouter'),
    custom: new Response('custom'),
  };

  const proxies = createAiProviderProxiesWithWorkerDeps({
    deps: {
      proxyAnthropic: async (value) => {
        assert.deepEqual(value, {
          payload,
          secrets,
          baseHeaders,
          deps: {
            json: 'json',
          },
        });
        return responses.anthropic;
      },
      proxyOpenAI: async (value) => {
        assert.deepEqual(value, {
          payload,
          secrets,
          baseHeaders,
          deps: {
            json: 'json',
          },
        });
        return responses.openai;
      },
      proxyOpenRouter: async (value) => {
        assert.deepEqual(value, {
          payload,
          secrets,
          baseHeaders,
          deps: {
            json: 'json',
          },
        });
        return responses.openrouter;
      },
      proxyCustomRPC: async (value) => {
        assert.deepEqual(value, {
          payload,
          secrets,
          baseHeaders,
          deps: {
            json: 'json',
            safeFetch: 'safeFetch',
            isBlockedOutboundUrl: 'isBlockedOutboundUrl',
          },
        });
        return responses.custom;
      },
      json: 'json',
      safeFetch: 'safeFetch',
      isBlockedOutboundUrl: 'isBlockedOutboundUrl',
    },
  });

  assert.equal(
    await proxies.proxyAnthropic({ payload, secrets, baseHeaders }),
    responses.anthropic
  );
  assert.equal(
    await proxies.proxyOpenAI({ payload, secrets, baseHeaders }),
    responses.openai
  );
  assert.equal(
    await proxies.proxyOpenRouter({ payload, secrets, baseHeaders }),
    responses.openrouter
  );
  assert.equal(
    await proxies.proxyCustomRPC({ payload, secrets, baseHeaders }),
    responses.custom
  );
});
