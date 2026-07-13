import assert from 'node:assert/strict';
import test from 'node:test';

import { callOpenAiCompatibleChat } from '../src/adapters/openai-compatible.mjs';

const okResponse = {
  ok: true,
  json: async () => ({ choices: [{ message: { content: '{"answer":"Agree"}' } }] }),
};

test('local provider targets a local OpenAI-compatible chat endpoint', async () => {
  const seen = {};
  const content = await callOpenAiCompatibleChat({
    provider: 'local',
    model: 'local-model',
    prompt: 'Answer.',
    env: { AIDB_LOCAL_BASE_URL: 'http://127.0.0.1:11434/v1' },
    fetchImpl: async (url, options) => {
      seen.url = url;
      seen.options = options;
      return okResponse;
    },
  });

  assert.equal(content.content, '{"answer":"Agree"}');
  assert.equal(content.metadata.provider, 'local');
  assert.equal(content.metadata.requestedModel, 'local-model');
  assert.equal(content.metadata.endpoint, 'http://127.0.0.1:11434/v1');
  assert.equal(seen.url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(seen.options.headers.authorization, 'Bearer local');
  assert.equal(JSON.parse(seen.options.body).response_format.type, 'json_schema');
  assert.equal(
    JSON.parse(seen.options.body).response_format.json_schema.schema.properties.confidence.type,
    'number',
  );
  assert.equal(content.metadata.structuredOutput.used, 'json_schema');
});

test('auto structured output falls back only on capability errors and records the downgrade', async () => {
  const bodies = [];
  const result = await callOpenAiCompatibleChat({
    provider: 'local',
    model: 'no-schema-model',
    prompt: 'Answer.',
    env: { AIDB_LOCAL_BASE_URL: 'http://127.0.0.1:11434/v1' },
    fetchImpl: async (_url, options) => {
      bodies.push(JSON.parse(options.body));
      if (bodies.length === 1) {
        return { ok: false, status: 400, text: async () => 'response_format is unsupported' };
      }
      return okResponse;
    },
  });

  assert.equal(bodies[0].response_format.type, 'json_schema');
  assert.equal('response_format' in bodies[1], false);
  assert.equal(result.metadata.structuredOutput.used, 'none');
  assert.equal(result.metadata.structuredOutput.fallback.status, 400);
});

test('auto structured output does not hide authentication or server failures', async () => {
  let calls = 0;
  await assert.rejects(
    callOpenAiCompatibleChat({
      provider: 'openrouter',
      model: 'provider/failing-model',
      prompt: 'Answer.',
      env: { OPENROUTER_API_KEY: 'test-key' },
      fetchImpl: async () => {
        calls += 1;
        return { ok: false, status: 401, text: async () => 'invalid key' };
      },
    }),
    (error) => error.status === 401 && error.retryable === false,
  );
  assert.equal(calls, 1);
});

test('OpenRouter provider sends required auth and attribution headers', async () => {
  const seen = {};
  const providerRouting = {
    order: ['anthropic'],
    allow_fallbacks: false,
    require_parameters: true,
    data_collection: 'deny',
  };
  await callOpenAiCompatibleChat({
    provider: 'openrouter',
    model: 'openai/example',
    prompt: 'Answer.',
    providerRouting,
    env: {
      OPENROUTER_API_KEY: 'test-key',
      OPENROUTER_SITE_URL: 'https://example.test',
      OPENROUTER_APP_NAME: 'ai-discourse-bench-test',
    },
    fetchImpl: async (url, options) => {
      seen.url = url;
      seen.options = options;
      return okResponse;
    },
  });

  assert.equal(seen.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(seen.options.headers.authorization, 'Bearer test-key');
  assert.equal(seen.options.headers['HTTP-Referer'], 'https://example.test');
  assert.equal(seen.options.headers['X-Title'], 'ai-discourse-bench-test');
  assert.deepEqual(JSON.parse(seen.options.body).provider, providerRouting);
});

test('local requests do not leak OpenRouter routing fields', async () => {
  let body;
  await callOpenAiCompatibleChat({
    provider: 'local',
    model: 'local-model',
    prompt: 'Answer.',
    providerRouting: { allow_fallbacks: false },
    env: { AIDB_LOCAL_BASE_URL: 'http://127.0.0.1:11434/v1' },
    fetchImpl: async (_url, options) => {
      body = JSON.parse(options.body);
      return okResponse;
    },
  });
  assert.equal('provider' in body, false);
});

test('OpenAI-compatible requests time out instead of hanging indefinitely', async () => {
  await assert.rejects(
    callOpenAiCompatibleChat({
      provider: 'local',
      model: 'slow-model',
      prompt: 'Answer.',
      timeoutMs: 5,
      env: { AIDB_LOCAL_BASE_URL: 'http://127.0.0.1:11434/v1' },
      fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      }),
    }),
    (error) => error.code === 'AIDB_REQUEST_TIMEOUT'
  );
});
