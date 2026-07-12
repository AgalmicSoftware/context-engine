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
});

test('OpenRouter provider sends required auth and attribution headers', async () => {
  const seen = {};
  await callOpenAiCompatibleChat({
    provider: 'openrouter',
    model: 'openai/example',
    prompt: 'Answer.',
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
