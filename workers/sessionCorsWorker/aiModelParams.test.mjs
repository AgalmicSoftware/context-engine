import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyChatCompletionBudget,
  isChatReasoningModel,
  resolveResponsesOutputTokens,
  usesOpenAiResponsesApi,
} from './aiModelParams.js';

test('usesOpenAiResponsesApi recognizes native OpenAI GPT-5 models only', () => {
  assert.equal(usesOpenAiResponsesApi({ provider: 'openai', model: 'gpt-5' }), true);
  assert.equal(usesOpenAiResponsesApi({ provider: 'openai', model: 'gpt-5-mini' }), true);
  assert.equal(usesOpenAiResponsesApi({ provider: 'openai', model: 'gpt-4o-mini' }), false);
  assert.equal(usesOpenAiResponsesApi({ provider: 'openrouter', model: 'openai/gpt-5' }), false);
  assert.equal(usesOpenAiResponsesApi({ provider: 'openai', endpoint: 'responses' }), true);
});

test('isChatReasoningModel recognizes o-series chat reasoning models but not GPT-5', () => {
  assert.equal(isChatReasoningModel({ model: 'o3-mini' }), true);
  assert.equal(isChatReasoningModel({ model: 'gpt-5' }), false);
  assert.equal(isChatReasoningModel({ model: 'gpt-4o-mini' }), false);
});

test('applyChatCompletionBudget uses max_completion_tokens for chat reasoning models', () => {
  const body = {};
  applyChatCompletionBudget({
    body,
    model: 'o3-mini',
    max_tokens: 321,
  });

  assert.equal(body.max_completion_tokens, 321);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'max_tokens'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'temperature'), false);
});

test('applyChatCompletionBudget keeps max_tokens for non-reasoning chat models', () => {
  const body = {};
  applyChatCompletionBudget({
    body,
    model: 'gpt-4o-mini',
    max_tokens: 123,
    temperature: 0.2,
  });

  assert.equal(body.max_tokens, 123);
  assert.equal(body.temperature, 0.2);
  assert.equal(Object.prototype.hasOwnProperty.call(body, 'max_completion_tokens'), false);
});

test('resolveResponsesOutputTokens prefers explicit responses output tokens', () => {
  assert.equal(resolveResponsesOutputTokens({ max_output_tokens: 999, max_completion_tokens: 500, max_tokens: 400 }), 999);
  assert.equal(resolveResponsesOutputTokens({ max_completion_tokens: 500, max_tokens: 400 }), 500);
  assert.equal(resolveResponsesOutputTokens({ max_tokens: 400 }), 400);
});
