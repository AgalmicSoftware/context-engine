import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANONYMOUS_CUSTOM_RPC_URL_REQUIRED_ERROR,
  DEFAULT_MODEL_WHITELIST,
  inferAiProviderFromModel,
  isModelAllowed,
  normalizeAiRequestPayload,
  readAiRequestPayload,
  resolveAiProvider,
  validateAnonymousAiRequest,
} from './aiRequestNormalization.js';

test('inferAiProviderFromModel and resolveAiProvider preserve provider inference precedence', () => {
  assert.equal(inferAiProviderFromModel('claude-3-5-sonnet'), 'anthropic');
  assert.equal(inferAiProviderFromModel('gpt-5'), 'openai');
  assert.equal(inferAiProviderFromModel('openrouter/auto'), 'openrouter');
  assert.equal(inferAiProviderFromModel('evil-model/injection'), 'openrouter');

  assert.equal(resolveAiProvider({ provider: ' custom ' }), 'custom');
  assert.equal(resolveAiProvider({ provider: 'auto', model: 'claude-3-5-sonnet' }), 'anthropic');
  assert.equal(resolveAiProvider({ model: 'gpt-5' }), 'openai');
  assert.equal(resolveAiProvider({}), 'openai');
});

test('isModelAllowed preserves default whitelist rules and custom openrouter restrictions', () => {
  assert.equal(isModelAllowed('claude-sonnet-4-5-20250514', 'anthropic'), true);
  assert.equal(isModelAllowed('gpt-5.4', 'openai'), true);
  assert.equal(isModelAllowed('o3-mini', 'openai'), true);
  assert.equal(isModelAllowed('evil-model/injection', 'openrouter'), true);
  assert.equal(
    isModelAllowed('evil-model/injection', 'openrouter', {
      ...DEFAULT_MODEL_WHITELIST,
      openrouter: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet'],
    }),
    false,
  );
});

test('normalizeAiRequestPayload trims request apiKey/rpcUrl while preserving the original payload', () => {
  const payload = {
    provider: ' default ',
    model: 'openrouter/auto',
    apiKey: ' sk-local ',
    rpcUrl: ' https://rpc.example/v1/chat/completions ',
  };

  assert.deepEqual(normalizeAiRequestPayload({ payload }), {
    ok: true,
    status: 200,
    error: '',
    payload,
    provider: 'openrouter',
    requestApiKey: 'sk-local',
    requestRpcUrl: 'https://rpc.example/v1/chat/completions',
  });
});

test('readAiRequestPayload preserves application/json and invalid JSON failures', async () => {
  const wrongContentType = new Request('https://worker.example/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: 'ping',
  });
  assert.deepEqual(
    await readAiRequestPayload({ request: wrongContentType }),
    {
      ok: false,
      status: 400,
      error: 'Expected application/json.',
      payload: null,
      provider: '',
      requestApiKey: '',
      requestRpcUrl: '',
    }
  );

  const badJson = new Request('https://worker.example/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad-json',
  });
  assert.deepEqual(
    await readAiRequestPayload({ request: badJson }),
    {
      ok: false,
      status: 400,
      error: 'Invalid JSON.',
      payload: null,
      provider: '',
      requestApiKey: '',
      requestRpcUrl: '',
    }
  );
});

test('validateAnonymousAiRequest preserves custom request-api-key rpcUrl requirement', () => {
  assert.deepEqual(
    validateAnonymousAiRequest({
      provider: 'custom',
      requestRpcUrl: '   ',
      anonymousAccessReason: 'request-api-key',
    }),
    {
      ok: false,
      status: 400,
      error: ANONYMOUS_CUSTOM_RPC_URL_REQUIRED_ERROR,
    }
  );

  assert.deepEqual(
    validateAnonymousAiRequest({
      provider: 'custom',
      requestRpcUrl: 'https://rpc.example/v1/chat/completions',
      anonymousAccessReason: 'request-api-key',
    }),
    {
      ok: true,
      status: 200,
      error: '',
    }
  );
});
